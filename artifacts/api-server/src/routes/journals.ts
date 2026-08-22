import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, journalsTable } from "@workspace/db";
import { serialize } from "../lib/serialize";
import { requireAdmin } from "../middleware/requireAdmin";
import {
  ListJournalEntriesResponse,
  CreateJournalEntryBody,
  CreateJournalEntryResponse,
  GetJournalEntryParams,
  GetJournalEntryResponse,
  UpdateJournalEntryParams,
  UpdateJournalEntryBody,
  UpdateJournalEntryResponse,
  DeleteJournalEntryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/journals", async (_req, res): Promise<void> => {
  const rows = await db.select().from(journalsTable).orderBy(desc(journalsTable.publishedAt));
  res.json(ListJournalEntriesResponse.parse(serialize(rows)));
});

router.post("/journals", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateJournalEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = {
    ...parsed.data,
    publishedAt: parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : new Date(),
  };
  const [row] = await db.insert(journalsTable).values(data).returning();
  res.status(201).json(CreateJournalEntryResponse.parse(serialize(row)));
});

router.get("/journals/:id", async (req, res): Promise<void> => {
  const params = GetJournalEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.select().from(journalsTable).where(eq(journalsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Journal entry not found" });
    return;
  }
  res.json(GetJournalEntryResponse.parse(serialize(row)));
});

router.patch("/journals/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateJournalEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateJournalEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.publishedAt) {
    updateData.publishedAt = new Date(parsed.data.publishedAt);
  }
  const [row] = await db.update(journalsTable).set(updateData).where(eq(journalsTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Journal entry not found" });
    return;
  }
  res.json(UpdateJournalEntryResponse.parse(serialize(row)));
});

router.delete("/journals/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteJournalEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.delete(journalsTable).where(eq(journalsTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Journal entry not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
