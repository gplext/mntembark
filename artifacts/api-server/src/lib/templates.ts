import { eq } from "drizzle-orm";
import { db, emailTemplatesTable, type Enquiry } from "@workspace/db";
import { logger } from "./logger";
import { brandedHtml, render, unknownPlaceholders } from "./templateRender";

/**
 * The wording of each automatic message.
 *
 * Every template exists twice: as the copy below, which ships with the code,
 * and optionally as a row in `email_templates` that someone edited in the admin
 * panel. The stored row wins when it has content; otherwise the code wins.
 *
 * That fallback is the safety property this whole file is arranged around. A
 * template can be cleared, half-written, or saved with a typo in a placeholder,
 * and the worst that happens is a client receives the wording that shipped —
 * never nothing at all.
 *
 * The body is plain text. The branded HTML part is generated from that same
 * text at send time rather than being a second field, so the two can't drift
 * apart. Recipients get both and their mail client picks; anything that refuses
 * HTML still gets a readable message.
 */

export interface RenderedMessage {
  subject: string;
  body: string;
  html: string;
}

export const TEMPLATE_KEYS = {
  clientConfirmation: "enquiry_client_confirmation",
  adminAlert: "enquiry_admin_alert",
  test: "test_email",
} as const;

export type TemplateKey = (typeof TEMPLATE_KEYS)[keyof typeof TEMPLATE_KEYS];

const BRAND = process.env["MAIL_FROM_NAME"]?.trim() || "MNT Embark";
const SITE_URL = process.env["PUBLIC_SITE_URL"]?.trim() || undefined;

/* --------------------------- values a template can use -------------------- */

function fullName(e: Enquiry): string {
  return [e.title, e.firstName, e.lastName].filter(Boolean).join(" ");
}

/** What the enquiry was about, in one line, whichever form it came from. */
function subjectLine(e: Enquiry): string {
  if (e.tourTitle) {
    return [e.tourTitle, e.tourLocation].filter(Boolean).join(" — ");
  }
  return e.enquiryType ?? "General enquiry";
}

/**
 * Only the fields this enquiry actually has.
 *
 * A tour enquiry and a contact enquiry fill in different columns, and printing
 * "Budget: —" for every blank one buries the three lines that matter.
 */
function detailLines(e: Enquiry): string {
  const rows: Array<[string, string | number | null | undefined]> = [
    ["Name", fullName(e)],
    ["Email", e.email],
    ["Phone", e.phone],
    ["Tour", e.tourTitle],
    ["Location", e.tourLocation],
    ["Duration", e.tourDurationDays ? `${e.tourDurationDays} days` : null],
    ["Enquiry type", e.enquiryType],
    ["Budget", e.budget],
    ["Travel advisor", e.isTravelAdvisor ? "Yes" : null],
    ["Wants updates", e.receiveUpdates ? "Yes" : null],
  ];
  return rows
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}

function valuesFor(e: Enquiry): Record<string, string> {
  return {
    firstName: e.firstName,
    lastName: e.lastName,
    fullName: fullName(e),
    email: e.email,
    phone: e.phone ?? "",
    about: subjectLine(e),
    tourTitle: e.tourTitle ?? "",
    tourLocation: e.tourLocation ?? "",
    tourDuration: e.tourDurationDays ? `${e.tourDurationDays} days` : "",
    enquiryType: e.enquiryType ?? "",
    budget: e.budget ?? "",
    notes: e.notes ?? "",
    source: e.source,
    details: detailLines(e),
    brand: BRAND,
  };
}

/**
 * What the admin screen offers, and what save-time validation checks against.
 *
 * One list per template rather than one shared list, because `details` in a
 * client's confirmation would send them a summary of their own budget, and
 * that is a mistake worth making impossible to save by accident.
 */
export const TEMPLATE_PLACEHOLDERS: Record<TemplateKey, readonly string[]> = {
  [TEMPLATE_KEYS.clientConfirmation]: [
    "firstName",
    "lastName",
    "fullName",
    "about",
    "tourTitle",
    "tourLocation",
    "tourDuration",
    "notes",
    "brand",
  ],
  [TEMPLATE_KEYS.adminAlert]: [
    "firstName",
    "lastName",
    "fullName",
    "email",
    "phone",
    "about",
    "tourTitle",
    "tourLocation",
    "tourDuration",
    "enquiryType",
    "budget",
    "notes",
    "source",
    "details",
    "brand",
  ],
  [TEMPLATE_KEYS.test]: ["brand"],
};

/* ------------------------------ the defaults ------------------------------ */

interface TemplateDefinition {
  key: TemplateKey;
  /** Shown in the admin list. */
  name: string;
  description: string;
  subject: string;
  body: string;
}

export const TEMPLATE_DEFAULTS: Record<TemplateKey, TemplateDefinition> = {
  [TEMPLATE_KEYS.clientConfirmation]: {
    key: TEMPLATE_KEYS.clientConfirmation,
    name: "Confirmation to client",
    description:
      "Sent to the person who enquired, immediately after they submit the form.",
    subject: "We have your enquiry — {{about}}",
    body: `Dear {{firstName}},

Thank you for your enquiry about {{about}}. It has reached our team and someone will be in touch personally, usually within one working day.

{{#notes}}For your records, this is what you sent us:

{{notes}}
{{/notes}}
There is nothing further you need to do. If anything has changed in the meantime, simply reply to this message and it will reach us directly.

Kind regards,
{{brand}}`,
  },

  [TEMPLATE_KEYS.adminAlert]: {
    key: TEMPLATE_KEYS.adminAlert,
    name: "Alert to office",
    description:
      "Sent to your notification addresses so an enquiry can be answered from the inbox.",
    subject: "New enquiry: {{about}} — {{fullName}}",
    body: `New {{source}} enquiry.

{{details}}

{{#notes}}Message:
{{notes}}
{{/notes}}
Reply to this email to answer {{firstName}} directly.`,
  },

  [TEMPLATE_KEYS.test]: {
    key: TEMPLATE_KEYS.test,
    name: "Test email",
    description:
      "Sent by the Test email button. Proves the mail settings work without creating an enquiry.",
    subject: "Test email from {{brand}}",
    body: `This is a test message from the {{brand}} admin panel.

If you are reading it, outgoing email is working: the server accepted the message and your provider delivered it.

Nothing was created and nobody else was contacted.`,
  },
};

/* --------------------------- stored overrides ----------------------------- */

interface StoredTemplate {
  subject: string;
  body: string;
}

/**
 * The wording to use for one template, stored version first.
 *
 * Never throws and never returns nothing. A database that is down, a row that
 * was cleared, a key that has no row — all end at the same place, which is the
 * copy above.
 */
async function resolve(key: TemplateKey): Promise<StoredTemplate> {
  const fallback = TEMPLATE_DEFAULTS[key];

  try {
    const [row] = await db
      .select()
      .from(emailTemplatesTable)
      .where(eq(emailTemplatesTable.key, key));

    if (!row) return { subject: fallback.subject, body: fallback.body };

    /*
     * Per field, not per row. Someone who clears just the subject should get
     * the shipped subject and keep their own body, rather than silently losing
     * the body they spent time on.
     */
    return {
      subject: row.subject.trim() ? row.subject : fallback.subject,
      body: row.body.trim() ? row.body : fallback.body,
    };
  } catch (err) {
    logger.error(
      { err, key },
      "Could not read the stored email template — using the built-in wording",
    );
    return { subject: fallback.subject, body: fallback.body };
  }
}

function compose(
  key: TemplateKey,
  stored: StoredTemplate,
  values: Record<string, string>,
): RenderedMessage {
  const body = render(stored.body, values);
  return {
    subject: render(stored.subject, values),
    body,
    html: brandedHtml({ body, brand: BRAND, siteUrl: SITE_URL }),
  };
}

/** Sent to the person who enquired. */
export async function clientConfirmation(e: Enquiry): Promise<RenderedMessage> {
  const key = TEMPLATE_KEYS.clientConfirmation;
  return compose(key, await resolve(key), valuesFor(e));
}

/**
 * Sent to the office. Everything needed to act on the enquiry without opening
 * the admin panel, because the reply usually happens straight from the inbox.
 */
export async function adminAlert(e: Enquiry): Promise<RenderedMessage> {
  const key = TEMPLATE_KEYS.adminAlert;
  return compose(key, await resolve(key), valuesFor(e));
}

/** Sent by the admin's Test email button. */
export async function testMessage(): Promise<RenderedMessage> {
  const key = TEMPLATE_KEYS.test;
  return compose(key, await resolve(key), { brand: BRAND });
}

/* ------------------------- what the admin screen needs -------------------- */

/**
 * A plausible enquiry to render a preview against.
 *
 * Preview matters more than it sounds: the only other way to see what a
 * template produces is to send yourself a real one, and the only way to see
 * what an edit broke is to have a client receive it.
 */
export function sampleValues(key: TemplateKey): Record<string, string> {
  if (key === TEMPLATE_KEYS.test) return { brand: BRAND };

  const sample = {
    id: 0,
    source: "tour",
    status: "new",
    title: null,
    firstName: "Amelia",
    lastName: "Hart",
    email: "amelia.hart@example.com",
    phone: "+44 7700 900123",
    isTravelAdvisor: false,
    notes: "We are hoping to travel in early March, two adults, no children.",
    tourTitle: "Water in Gold",
    tourLocation: "Maldives",
    tourDurationDays: 9,
    enquiryType: "custom-journey",
    budget: "£15,000 – £25,000",
    acceptPrivacy: true,
    receiveUpdates: true,
  } as unknown as Enquiry;

  return valuesFor(sample);
}

export interface TemplateSummary {
  key: TemplateKey;
  name: string;
  description: string;
  subject: string;
  body: string;
  /** True when the stored wording differs from what ships in the code. */
  isCustomised: boolean;
  updatedAt: string | null;
  placeholders: string[];
  defaultSubject: string;
  defaultBody: string;
}

export async function templateSummaries(): Promise<TemplateSummary[]> {
  const rows = await db.select().from(emailTemplatesTable);
  const stored = new Map(rows.map((r) => [r.key, r]));

  return Object.values(TEMPLATE_DEFAULTS).map((def) => {
    const row = stored.get(def.key);
    const subject = row?.subject.trim() ? row.subject : def.subject;
    const body = row?.body.trim() ? row.body : def.body;

    return {
      key: def.key,
      name: def.name,
      description: def.description,
      subject,
      body,
      isCustomised: subject !== def.subject || body !== def.body,
      updatedAt: row ? row.updatedAt.toISOString() : null,
      placeholders: [...TEMPLATE_PLACEHOLDERS[def.key]],
      defaultSubject: def.subject,
      defaultBody: def.body,
    };
  });
}

export function isTemplateKey(value: string): value is TemplateKey {
  return Object.prototype.hasOwnProperty.call(TEMPLATE_DEFAULTS, value);
}

/**
 * Names a template uses that nothing can fill in.
 *
 * Reported as a warning on save rather than a refusal: the person editing knows
 * what they meant, and a template held hostage over a placeholder they are
 * about to fix is worse than one that sends with a gap. It renders as nothing,
 * so the failure is visible in the preview beside it.
 */
export function templateWarnings(key: TemplateKey, subject: string, body: string) {
  const known = TEMPLATE_PLACEHOLDERS[key];
  return [
    ...unknownPlaceholders(subject, known),
    ...unknownPlaceholders(body, known),
  ];
}

/** Render one template for the preview pane, without touching the database. */
export function previewOf(
  key: TemplateKey,
  subject: string,
  body: string,
): RenderedMessage {
  const values = sampleValues(key);
  const rendered = render(body, values);
  return {
    subject: render(subject, values),
    body: rendered,
    html: brandedHtml({ body: rendered, brand: BRAND, siteUrl: SITE_URL }),
  };
}
