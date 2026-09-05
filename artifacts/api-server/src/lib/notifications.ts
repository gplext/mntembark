import { and, asc, eq, lt, sql } from "drizzle-orm";
import { db, notificationsTable, type Enquiry } from "@workspace/db";
import { logger } from "./logger";
import { isMailConfigured, mailConfigError, sendMail, adminRecipients } from "./mailer";
import { adminAlert, clientConfirmation, TEMPLATE_KEYS } from "./templates";

/**
 * The outbox: queue messages, then send them on a timer.
 *
 * Queuing is a database insert in the request; sending happens afterwards in
 * the background. That separation is what keeps a slow or unreachable mail
 * server from turning a successful enquiry into a failed one for the visitor.
 */

/** Give up after this many tries and leave the row failed for a human. */
const MAX_ATTEMPTS = 5;

/** How often the worker looks for queued messages. */
const POLL_INTERVAL_MS = 30_000;

/** How long a message waits after a failure before the next attempt. */
function backoffMs(attempts: number): number {
  return Math.min(60_000 * 2 ** (attempts - 1), 60 * 60_000);
}

/**
 * Queue both messages for a new enquiry.
 *
 * Never throws. A failure here must not fail the enquiry — the visitor has
 * already given us what they came to give, and losing that to a queueing
 * problem would be the worst outcome available.
 */
export async function queueEnquiryNotifications(enquiry: Enquiry): Promise<void> {
  try {
    const client = await clientConfirmation(enquiry);
    const admin = await adminAlert(enquiry);

    const rows = [
      {
        enquiryId: enquiry.id,
        channel: "email",
        templateKey: TEMPLATE_KEYS.clientConfirmation,
        recipient: enquiry.email,
        subject: client.subject,
        body: client.body,
        bodyHtml: client.html,
      },
      ...adminRecipients().map((to) => ({
        enquiryId: enquiry.id,
        channel: "email",
        templateKey: TEMPLATE_KEYS.adminAlert,
        recipient: to,
        subject: admin.subject,
        body: admin.body,
        bodyHtml: admin.html,
      })),
    ];

    await db
      .insert(notificationsTable)
      .values(rows)
      /*
       * The unique index makes a repeat insert a no-op rather than an error.
       * Matters when this is reached twice for one enquiry — a retried request,
       * or a resend that races the worker.
       */
      .onConflictDoNothing();

    // Don't wait for the send: the caller is answering an HTTP request.
    void processQueue();
  } catch (err) {
    logger.error({ err, enquiryId: enquiry.id }, "Could not queue notifications");
  }
}

async function deliver(row: typeof notificationsTable.$inferSelect): Promise<void> {
  if (row.channel !== "email") {
    throw new Error(`No sender for channel "${row.channel}"`);
  }

  const { messageId } = await sendMail({
    to: row.recipient,
    subject: row.subject ?? "",
    text: row.body,
    /*
     * Whatever was rendered when the message was queued, not a fresh render.
     * A template edited between queueing and a retry must not change what a
     * client is about to receive halfway through.
     */
    html: row.bodyHtml ?? undefined,
    /*
     * Only the office alert gets a Reply-To pointing at the client. Setting it
     * on the client's own confirmation would send their reply back to
     * themselves.
     */
    replyTo:
      row.templateKey === TEMPLATE_KEYS.adminAlert
        ? await enquiryEmail(row.enquiryId)
        : undefined,
  });

  await db
    .update(notificationsTable)
    .set({
      status: "sent",
      sentAt: new Date(),
      providerMessageId: messageId,
      lastError: null,
      attempts: row.attempts + 1,
    })
    .where(eq(notificationsTable.id, row.id));
}

async function enquiryEmail(enquiryId: number | null): Promise<string | undefined> {
  if (enquiryId === null) return undefined;
  const { enquiriesTable } = await import("@workspace/db");
  const [row] = await db
    .select({ email: enquiriesTable.email })
    .from(enquiriesTable)
    .where(eq(enquiriesTable.id, enquiryId));
  return row?.email;
}

let running = false;

/**
 * Send everything currently due.
 *
 * Guarded against overlapping runs: the timer keeps firing whether or not the
 * previous pass finished, and two passes over the same rows would send twice.
 */
export async function processQueue(): Promise<void> {
  if (running) return;
  if (!isMailConfigured()) return;

  running = true;
  try {
    const due = await db
      .select()
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.status, "queued"),
          lt(notificationsTable.attempts, MAX_ATTEMPTS),
        ),
      )
      .orderBy(asc(notificationsTable.createdAt))
      .limit(25);

    for (const row of due) {
      // Respect the backoff without needing a "next attempt at" column.
      if (row.attempts > 0) {
        const waited = Date.now() - new Date(row.createdAt).getTime();
        if (waited < backoffMs(row.attempts)) continue;
      }

      try {
        await deliver(row);
        logger.info(
          { id: row.id, to: row.recipient, template: row.templateKey },
          "Notification sent",
        );
      } catch (err) {
        const attempts = row.attempts + 1;
        const message = err instanceof Error ? err.message : String(err);

        await db
          .update(notificationsTable)
          .set({
            attempts,
            lastError: message,
            // Stays "queued" while retries remain, so the worker picks it up.
            status: attempts >= MAX_ATTEMPTS ? "failed" : "queued",
          })
          .where(eq(notificationsTable.id, row.id));

        logger.warn(
          { id: row.id, attempts, err: message },
          attempts >= MAX_ATTEMPTS
            ? "Notification failed permanently"
            : "Notification failed, will retry",
        );
      }
    }
  } catch (err) {
    logger.error({ err }, "Notification queue pass failed");
  } finally {
    running = false;
  }
}

/**
 * Put a failed message back in the queue.
 *
 * Resets the counter, because a resend is a deliberate human decision after
 * fixing something — usually the credentials or a typo in the address — and
 * should get a full set of attempts rather than inheriting an exhausted one.
 */
export async function resendNotification(id: number): Promise<boolean> {
  const [row] = await db
    .update(notificationsTable)
    .set({ status: "queued", attempts: 0, lastError: null })
    .where(eq(notificationsTable.id, id))
    .returning();

  if (!row) return false;
  void processQueue();
  return true;
}

export function startNotificationWorker(): void {
  if (!isMailConfigured()) {
    logger.warn(
      { reason: mailConfigError() },
      "Notification worker not started — email is not configured",
    );
    return;
  }

  setInterval(() => void processQueue(), POLL_INTERVAL_MS).unref();
  void processQueue();
  logger.info({ intervalMs: POLL_INTERVAL_MS }, "Notification worker started");
}

/** Rows for one enquiry, newest first, for the admin screen. */
export async function notificationsForEnquiry(enquiryId: number) {
  return db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.enquiryId, enquiryId))
    .orderBy(asc(notificationsTable.id));
}

/** How many messages are waiting or have given up — shown in the admin header. */
export async function queueSummary(): Promise<{ queued: number; failed: number }> {
  const [row] = await db
    .select({
      queued: sql<number>`count(*) filter (where status = 'queued')::int`,
      failed: sql<number>`count(*) filter (where status = 'failed')::int`,
    })
    .from(notificationsTable);
  return row ?? { queued: 0, failed: 0 };
}
