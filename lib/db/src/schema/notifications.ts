import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { enquiriesTable } from "./enquiries";

/**
 * NOTIFICATIONS
 * =============
 * One row per message the site owes somebody — currently the confirmation to a
 * client who enquired, and the alert to the office.
 *
 * This is an outbox, not a log written after the fact. The row is created in
 * the same breath as the enquiry and starts life as "queued"; a worker picks it
 * up afterwards and records what happened. That ordering is the whole point:
 *
 *   - A submission can never be lost because the mail server was slow, refused
 *     the connection, or rejected one address. The enquiry is saved and the
 *     visitor gets their confirmation page regardless.
 *   - A failure is visible and retryable instead of vanishing into a log.
 *   - "Did they get it?" has an answer, per message, in the admin panel.
 *
 * `channel` is deliberately open text rather than an enum: WhatsApp is coming,
 * and adding a channel should not require a schema migration.
 */
export const notificationsTable = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),

    /**
     * Cascades: a deleted enquiry's messages have nothing left to describe.
     * Nullable so the table can also carry messages that belong to no enquiry —
     * the admin's "send test email" is one, and there will be others.
     */
    enquiryId: integer("enquiry_id").references(() => enquiriesTable.id, {
      onDelete: "cascade",
    }),

    /** "email" today; "whatsapp" next. */
    channel: text("channel").notNull(),

    /** Which message this is — see TEMPLATES in the api-server's lib/templates. */
    templateKey: text("template_key").notNull(),

    /** Email address or phone number, resolved at queue time. */
    recipient: text("recipient").notNull(),

    /**
     * Rendered at queue time, not at send time.
     *
     * The message then says what was true when the person wrote in, even if the
     * tour is renamed or deleted before the retry succeeds — and what the admin
     * screen shows is what actually went out.
     */
    subject: text("subject"),
    body: text("body").notNull(),

    /** queued | sent | failed */
    status: text("status").notNull().default("queued"),

    attempts: integer("attempts").notNull().default(0),

    /** Last error verbatim, so the admin screen can explain a failure. */
    lastError: text("last_error"),

    /** The provider's id for the sent message, for tracing a complaint later. */
    providerMessageId: text("provider_message_id"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [
    // The worker's only query: oldest queued first.
    index("notifications_status_created_idx").on(t.status, t.createdAt),
    index("notifications_enquiry_idx").on(t.enquiryId),
    /*
     * Belt and braces against duplicate sends. A double-clicked form creates
     * two enquiries (two rows, two ids) which is correct — but a retry, a
     * restarted container, or two workers racing must never produce a second
     * copy of the SAME message. One template per recipient per enquiry.
     */
    uniqueIndex("notifications_dedupe_idx").on(
      t.enquiryId,
      t.templateKey,
      t.recipient,
    ),
  ],
);

/* ------------------------------------ Zod ------------------------------ */

export const insertNotificationSchema = createInsertSchema(notificationsTable, {
  channel: z.enum(["email", "whatsapp"]),
  status: z.enum(["queued", "sent", "failed"]),
}).omit({ id: true, createdAt: true });

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;
