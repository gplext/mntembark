import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, destinationsTable } from "@workspace/db";
import { serialize } from "../lib/serialize";
import { requireAdmin } from "../middleware/requireAdmin";
import {
  ListDestinationsResponse,
  CreateDestinationBody,
  CreateDestinationResponse,
  GetDestinationParams,
  GetDestinationResponse,
  UpdateDestinationParams,
  UpdateDestinationBody,
  UpdateDestinationResponse,
  DeleteDestinationParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/destinations", async (_req, res): Promise<void> => {
  const rows = await db.select().from(destinationsTable).orderBy(destinationsTable.name);
  res.json(ListDestinationsResponse.parse(serialize(rows)));
});

router.post("/destinations", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateDestinationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(destinationsTable).values(parsed.data).returning();
  res.status(201).json(CreateDestinationResponse.parse(serialize(row)));
});

router.get("/destinations/:id", async (req, res): Promise<void> => {
  const params = GetDestinationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.select().from(destinationsTable).where(eq(destinationsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Destination not found" });
    return;
  }
  res.json(GetDestinationResponse.parse(serialize(row)));
});

router.patch("/destinations/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateDestinationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateDestinationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.update(destinationsTable).set(parsed.data).where(eq(destinationsTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Destination not found" });
    return;
  }
  res.json(UpdateDestinationResponse.parse(serialize(row)));
});

router.delete("/destinations/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteDestinationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.delete(destinationsTable).where(eq(destinationsTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Destination not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
