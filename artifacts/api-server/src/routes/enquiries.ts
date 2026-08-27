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
} from "@workspace/api-zod";
import { requireAdmin } from "../middleware/requireAdmin";
import { serialize } from "../lib/serialize";

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

export default router;