import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, enquiriesTable } from "@workspace/db";
import {
  CreateEnquiryBody,
  CreateEnquiryResponse,
  ListEnquiriesResponse,
  UpdateEnquiryStatusBody,
  UpdateEnquiryStatusParams,
  UpdateEnquiryStatusResponse,
  ListEnquiryNotificationsParams,
  ListEnquiryNotificationsResponse,
  ResendNotificationParams,
  SendTestEmailBody,
  SendTestEmailResponse,
} from "@workspace/api-zod";
import { requireAdmin } from "../middleware/requireAdmin";
import { serialize } from "../lib/serialize";
import {
  queueEnquiryNotifications,
  notificationsForEnquiry,
  resendNotification,
} from "../lib/notifications";
import { isMailConfigured, mailConfigError, sendMail } from "../lib/mailer";

const router: IRouter = Router();

function optionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

router.post("/enquiries", async (req, res): Promise<void> => {
  const parsed = CreateEnquiryBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid enquiry submission");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const firstName = data.firstName.trim();
  const lastName = data.lastName.trim();
  const email = data.email.trim();
  const notes = optionalText(data.notes);
  const phone = optionalText(data.phone);
  const tourTitle = optionalText(data.tourTitle);
  const tourLocation = optionalText(data.tourLocation);
  const enquiryType = optionalText(data.enquiryType);
  const budget = optionalText(data.budget);

  if (!firstName || !lastName || !email) {
    res.status(400).json({ error: "Name and email are required" });
    return;
  }

  if (data.source === "tour") {
    if (!phone || !data.acceptPrivacy) {
      res.status(400).json({
        error: "A phone number and privacy acceptance are required for tour enquiries",
      });
      return;
    }

    if (
      !tourTitle ||
      !tourLocation ||
      !data.tourDurationDays ||
      !Number.isInteger(data.tourDurationDays)
    ) {
      res.status(400).json({
        error: "Tour title, location, and a whole-day duration are required for tour enquiries",
      });
      return;
    }

    if (enquiryType || budget) {
      res.status(400).json({
        error: "Tour enquiries cannot include contact-only context",
      });
      return;
    }
  }

  if (data.source === "contact") {
    if (!notes || notes.length < 10) {
      res.status(400).json({
        error: "Please provide a message of at least 10 characters",
      });
      return;
    }

    if (!enquiryType) {
      res.status(400).json({ error: "An enquiry type is required" });
      return;
    }

    if (
      tourTitle ||
      tourLocation ||
      data.tourDurationDays ||
      data.title ||
      data.isTravelAdvisor !== undefined
    ) {
      res.status(400).json({
        error: "Contact enquiries cannot include tour-specific context",
      });
      return;
    }
  }

  const [enquiry] = await db
    .insert(enquiriesTable)
    .values({
      source: data.source,
      title: optionalText(data.title),
      firstName,
      lastName,
      email,
      phone,
      isTravelAdvisor: data.isTravelAdvisor ?? null,
      notes,
      acceptPrivacy: data.acceptPrivacy,
      receiveUpdates: data.receiveUpdates,
      tourTitle,
      tourLocation,
      tourDurationDays: data.tourDurationDays ?? null,
      enquiryType,
      budget,
    })
    .returning();

  /*
   * Queue the confirmation and the office alert, but do not wait for them.
   * Sending happens in the background precisely so that a slow or unreachable
   * mail server cannot turn a saved enquiry into an error for the visitor.
   */
  void queueEnquiryNotifications(enquiry);

  res.status(201).json(CreateEnquiryResponse.parse(serialize(enquiry)));
});

router.get("/admin/enquiries", requireAdmin, async (_req, res): Promise<void> => {
  const enquiries = await db
    .select()
    .from(enquiriesTable)
    .orderBy(desc(enquiriesTable.createdAt));

  res.json(ListEnquiriesResponse.parse(serialize(enquiries)));
});

router.patch(
  "/admin/enquiries/:id/status",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = UpdateEnquiryStatusParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = UpdateEnquiryStatusBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [enquiry] = await db
      .update(enquiriesTable)
      .set({
        status: parsed.data.status,
        handledAt: parsed.data.status === "handled" ? new Date() : null,
      })
      .where(eq(enquiriesTable.id, params.data.id))
      .returning();

    if (!enquiry) {
      res.status(404).json({ error: "Enquiry not found" });
      return;
    }

    res.json(UpdateEnquiryStatusResponse.parse(serialize(enquiry)));
  },
);

/* ==================================================================== *
 * Notification delivery
 * ==================================================================== */

router.get(
  "/admin/enquiries/:id/notifications",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = ListEnquiryNotificationsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const rows = await notificationsForEnquiry(params.data.id);
    res.json(ListEnquiryNotificationsResponse.parse(serialize(rows)));
  },
);

router.post(
  "/admin/notifications/:id/resend",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = ResendNotificationParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const ok = await resendNotification(params.data.id);
    if (!ok) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }
    // 202: accepted for sending, not sent yet — the worker owns that.
    res.sendStatus(202);
  },
);

router.post(
  "/admin/notifications/test",
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = SendTestEmailBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    if (!isMailConfigured()) {
      /*
       * 503 rather than 500: nothing is broken, the server simply has no mail
       * credentials. The message names which ones are missing so this is
       * actionable without reading the server log.
       */
      res.status(503).json({
        error: mailConfigError() ?? "Email is not configured on this server",
      });
      return;
    }

    /*
     * Sent inline rather than queued, because the entire point is to find out
     * now whether the credentials work. A queued test would report success the
     * moment it was written to the table, which proves nothing.
     */
    try {
      const result = await sendMail({
        to: parsed.data.to.trim(),
        subject: "MNT Embark — test email",
        text: [
          "This is a test message from the MNT Embark admin panel.",
          "",
          "If you are reading it, outgoing email is working:",
          "credentials accepted, and the message was handed to the mail server.",
        ].join("\n"),
      });
      res.json(SendTestEmailResponse.parse(result));
    } catch (err) {
      res.status(503).json({
        error: err instanceof Error ? err.message : "Sending failed",
      });
    }
  },
);

export default router;
