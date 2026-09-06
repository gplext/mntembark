/**
 * The little language the email templates are written in, and the branded shell
 * their text is poured into.
 *
 * Deliberately tiny: placeholders and optional sections, nothing else. A
 * template is edited by whoever answers the enquiries, in a text box, and every
 * feature added here is another way for that person to save something that
 * throws at send time — on the one path where throwing means a client never
 * hears back.
 */

/** `{{firstName}}` — replaced by the value, or by nothing if there isn't one. */
const PLACEHOLDER = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

/**
 * `{{#notes}}...{{/notes}}` — kept only when the value is present.
 *
 * Without this, a template that mentions the visitor's message prints its
 * "here is what you sent us" preamble above a blank space whenever they left
 * the box empty.
 */
const SECTION = /\{\{#\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}([\s\S]*?)\{\{\/\s*\1\s*\}\}/g;

export type TemplateValues = Record<string, string | null | undefined>;

function isPresent(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && value.trim() !== "";
}

/**
 * Fill a template in.
 *
 * Unknown placeholders render as nothing rather than staying on the page. A
 * client reading "Dear {{frstName}}," is worse than a client reading "Dear ,":
 * both are mistakes, but only one of them looks like the site is broken. The
 * admin screen warns about unknown names at save time, which is where the
 * mistake can still be fixed.
 */
export function render(template: string, values: TemplateValues): string {
  const withSections = template.replace(SECTION, (_m, name: string, inner: string) =>
    isPresent(values[name]) ? inner : "",
  );

  return withSections
    .replace(PLACEHOLDER, (_m, name: string) => values[name]?.toString() ?? "")
    /*
     * A dropped section leaves the blank lines that surrounded it. Collapsing
     * runs of three or more keeps the message from developing a hole in the
     * middle.
     */
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Every placeholder name a template uses, including those inside sections. */
export function placeholdersUsed(template: string): string[] {
  const names = new Set<string>();
  for (const [, name] of template.matchAll(PLACEHOLDER)) names.add(name);
  for (const [, name] of template.matchAll(SECTION)) names.add(name);
  return [...names];
}

/** Names used by the template that the site cannot supply a value for. */
export function unknownPlaceholders(
  template: string,
  known: readonly string[],
): string[] {
  const allowed = new Set(known);
  return placeholdersUsed(template).filter((n) => !allowed.has(n));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/*
 * The palette, matching the site: near-black ground, off-white text, a muted
 * gold accent. Written as literals rather than pulled from the frontend's
 * theme, because email has no stylesheets — every colour has to be inlined into
 * the markup anyway.
 */
const INK = "#1a1a1a";
const PAPER = "#faf9f7";
const MUTED = "#6b6b6b";
const GOLD = "#a08442";
const RULE = "#e6e2da";

/**
 * Wrap a plain-text body in the branded HTML part.
 *
 * Tables and inline styles, which is the ugly-looking but correct way to write
 * email: Outlook renders with Word's engine, Gmail strips <style> blocks, and
 * neither supports the layout properties that would make this pleasant. A dark
 * header band and a rule are as much decoration as survives everywhere.
 *
 * No remote images. Most clients block them by default, so a logo would render
 * as a broken box for a first-time recipient — precisely the person being
 * welcomed. The wordmark is text.
 */
export function brandedHtml(options: {
  body: string;
  brand: string;
  siteUrl?: string;
}): string {
  const { body, brand, siteUrl } = options;

  const paragraphs = body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(
      (block) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${INK};">${escapeHtml(
          block,
        ).replace(/\n/g, "<br />")}</p>`,
    )
    .join("");

  const footerLink = siteUrl
    ? `<a href="${escapeHtml(siteUrl)}" style="color:${GOLD};text-decoration:none;">${escapeHtml(
        siteUrl.replace(/^https?:\/\//, ""),
      )}</a>`
    : "";

  return `<!doctype html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /><title>${escapeHtml(
    brand,
  )}</title></head>
<body style="margin:0;padding:0;background:${PAPER};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${RULE};">
  <tr><td style="background:${INK};padding:22px 32px;">
    <span style="font-family:Georgia,'Times New Roman',serif;font-size:17px;letter-spacing:3px;text-transform:uppercase;color:${PAPER};">${escapeHtml(
      brand,
    )}</span>
  </td></tr>
  <tr><td style="padding:32px;font-family:Georgia,'Times New Roman',serif;">${paragraphs}</td></tr>
  <tr><td style="padding:0 32px 28px;">
    <div style="border-top:1px solid ${RULE};padding-top:16px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:${MUTED};">
      This message was sent automatically because an enquiry was submitted at ${escapeHtml(
        brand,
      )}.${footerLink ? ` ${footerLink}` : ""}
    </div>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}
