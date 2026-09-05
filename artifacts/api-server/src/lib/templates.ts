import type { Enquiry } from "@workspace/db";

/**
 * The wording of each message, rendered from an enquiry.
 *
 * Held in code for now. Moving these into a database table so they can be
 * edited without a deploy is the next phase; keeping the shape here — a key, a
 * subject, a body — is what makes that a swap rather than a rewrite.
 *
 * Deliberately plain text. HTML mail means a second body to keep in step, more
 * ways to land in spam, and a rendering matrix to test; none of that earns its
 * place for a two-paragraph acknowledgement.
 */

export interface RenderedMessage {
  subject: string;
  body: string;
}

const BRAND = "MNT Embark";

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
function detailLines(e: Enquiry): string[] {
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
    .map(([label, value]) => `${label}: ${value}`);
}

/** Sent to the person who enquired. */
export function clientConfirmation(e: Enquiry): RenderedMessage {
  const about = subjectLine(e);

  const body = [
    `Dear ${e.firstName},`,
    "",
    `Thank you for your enquiry about ${about}. It has reached our team and`,
    `someone will be in touch personally, usually within one working day.`,
    "",
    e.notes ? `For your records, this is what you sent us:` : null,
    e.notes ? "" : null,
    e.notes ? e.notes : null,
    e.notes ? "" : null,
    `There is nothing further you need to do. If anything has changed in the`,
    `meantime, simply reply to this message and it will reach us directly.`,
    "",
    `Kind regards,`,
    `${BRAND}`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  return { subject: `We have your enquiry — ${about}`, body };
}

/**
 * Sent to the office. Everything needed to act on the enquiry without opening
 * the admin panel, because the reply usually happens straight from the inbox.
 */
export function adminAlert(e: Enquiry): RenderedMessage {
  const about = subjectLine(e);

  const body = [
    `New ${e.source} enquiry.`,
    "",
    ...detailLines(e),
    "",
    e.notes ? "Message:" : null,
    e.notes ? e.notes : null,
    e.notes ? "" : null,
    `Reply to this email to answer ${e.firstName} directly.`,
  ]
    .filter((line) => line !== null)
    .join("\n");

  return { subject: `New enquiry: ${about} — ${fullName(e)}`, body };
}

export const TEMPLATE_KEYS = {
  clientConfirmation: "enquiry_client_confirmation",
  adminAlert: "enquiry_admin_alert",
  test: "test_email",
} as const;
