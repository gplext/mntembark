import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * EMAIL TEMPLATES
 * ===============
 * The wording of each automatic message, editable without a deploy.
 *
 * A row here is an *override*, not the message itself. Every template also
 * exists in code, and that code version is what sends when no row exists or the
 * row is blank. The consequence is the one that matters: no edit in the admin
 * panel — not a deletion, not an empty box, not a half-finished draft saved by
 * accident — can stop a client being acknowledged. The worst case is that the
 * message reverts to the wording that shipped.
 *
 * Only the subject and one body are stored. The branded HTML is built from that
 * same body at send time rather than being a second field to edit, because two
 * hand-maintained bodies drift: someone fixes a phone number in one and the
 * other keeps the old one for a year, and nobody notices because mail clients
 * show only one of them.
 */
export const emailTemplatesTable = pgTable("email_templates", {
  /**
   * The template key, matching TEMPLATE_KEYS in the api-server's lib/templates
   * — "enquiry_client_confirmation" and so on. Also the primary key: a template
   * is a single named thing, and a second row for the same key would be an
   * ambiguity with no correct resolution.
   */
  key: text("key").primaryKey(),

  subject: text("subject").notNull(),

  /**
   * Plain text with {{placeholders}}. Sent as the text part verbatim and
   * wrapped in the branded shell for the HTML part.
   */
  body: text("body").notNull(),

  /** Who last changed it, for the "edited by" line in the admin screen. */
  updatedBy: text("updated_by"),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ------------------------------------ Zod ------------------------------ */

export const insertEmailTemplateSchema = createInsertSchema(
  emailTemplatesTable,
).omit({ updatedAt: true });

export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type EmailTemplate = typeof emailTemplatesTable.$inferSelect;
