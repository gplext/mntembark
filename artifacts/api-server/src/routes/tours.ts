import { Router, type IRouter } from "express";
import { and, eq, desc, ilike, or, sql, SQL } from "drizzle-orm";
import { db, toursTable } from "@workspace/db";
import { serialize } from "../lib/serialize";
import { requireAdmin } from "../middleware/requireAdmin";
import { logger } from "../lib/logger";
import {
  ListToursQueryParams,
  ListToursResponse,
  CreateTourBody,
  CreateTourResponse,
  GetFeaturedToursResponse,
  SearchToursQueryParams,
  SearchToursResponse,
  GetTourParams,
  GetTourResponse,
  UpdateTourParams,
  UpdateTourBody,
  UpdateTourResponse,
  DeleteTourParams,
} from "@workspace/api-zod";
import {
  embeddingsEnabled,
  getEmbedding,
  cosineSimilarity,
  tourToEmbeddingText,
} from "../lib/embeddings";

const router: IRouter = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate and store an embedding for a tour in the background.
 * Never throws — errors are logged but do not affect the response.
 */
async function embedTourAsync(tourId: number): Promise<void> {
  if (!embeddingsEnabled()) return;
  try {
    const [tour] = await db
      .select()
      .from(toursTable)
      .where(eq(toursTable.id, tourId));
    if (!tour) return;
    const text = tourToEmbeddingText(tour);
    const embedding = await getEmbedding(text);
    if (!embedding) return;
    await db
      .update(toursTable)
      .set({ embedding })
      .where(eq(toursTable.id, tourId));
  } catch (err) {
    logger.warn({ err, tourId }, "Failed to generate tour embedding");
  }
}

/**
 * On server startup, generate embeddings for any tours that are missing one.
 * Runs concurrently but silently — search still works via ILIKE for un-embedded tours.
 */
export async function backfillTourEmbeddings(): Promise<void> {
  if (!embeddingsEnabled()) return;
  const tours = await db.select().from(toursTable);
  const missing = tours.filter((t) => !t.embedding);
  if (missing.length === 0) return;
  logger.info({ count: missing.length }, "Backfilling tour embeddings");
  // Process in small batches to avoid hammering the OpenAI rate limit
  for (const tour of missing) {
    await embedTourAsync(tour.id);
  }
  logger.info("Tour embedding backfill complete");
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get("/tours", async (req, res): Promise<void> => {
  const params = ListToursQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conditions: SQL[] = [];
  if (params.data.categoryId) {
    conditions.push(eq(toursTable.categoryId, params.data.categoryId));
  }
  if (params.data.destinationId) {
    conditions.push(eq(toursTable.destinationId, params.data.destinationId));
  }

  const rows = await db
    .select()
    .from(toursTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(toursTable.featured), toursTable.title);
  res.json(ListToursResponse.parse(serialize(rows)));
});

router.get("/tours/featured", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(toursTable)
    .where(eq(toursTable.featured, true))
    .orderBy(desc(toursTable.createdAt))
    .limit(6);
  res.json(GetFeaturedToursResponse.parse(serialize(rows)));
});

router.get("/tours/search", async (req, res): Promise<void> => {
  const params = SearchToursQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // ── Vector search path ────────────────────────────────────────────────────
  if (embeddingsEnabled()) {
    try {
      const queryEmbedding = await getEmbedding(params.data.q);
      if (queryEmbedding) {
        // Fetch all tours (small catalog — cosine similarity in JS is fine)
        const allTours = await db.select().from(toursTable);

        // Apply hard filters
        const filtered = allTours.filter((t) => {
          if (params.data.categoryId && t.categoryId !== params.data.categoryId)
            return false;
          if (
            params.data.destinationId &&
            t.destinationId !== params.data.destinationId
          )
            return false;
          return true;
        });

        // Score by cosine similarity; tours with no embedding float to the bottom
        const scored = filtered
          .map((tour) => ({
            tour,
            score: tour.embedding
              ? cosineSimilarity(queryEmbedding, tour.embedding)
              : -1,
          }))
          .sort((a, b) => b.score - a.score);

        res.json(SearchToursResponse.parse(serialize(scored.map((x) => x.tour))));
        return;
      }
    } catch (err) {
      logger.warn({ err }, "Vector search failed, falling back to keyword search");
    }
  }

  // ── Keyword (ILIKE) fallback ──────────────────────────────────────────────
  const q = `%${params.data.q}%`;
  const conditions: SQL[] = [
    or(
      ilike(toursTable.title, q),
      ilike(toursTable.description, q),
      ilike(toursTable.location, q),
      sql`${toursTable.itinerarySteps}::text ilike ${q}`
    ) as SQL,
  ];

  if (params.data.categoryId) {
    conditions.push(eq(toursTable.categoryId, params.data.categoryId));
  }
  if (params.data.destinationId) {
    conditions.push(eq(toursTable.destinationId, params.data.destinationId));
  }

  const rows = await db
    .select()
    .from(toursTable)
    .where(and(...conditions))
    .orderBy(desc(toursTable.featured), toursTable.title);
  res.json(SearchToursResponse.parse(serialize(rows)));
});

router.get("/tours/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid tour id" });
    return;
  }
  const params = GetTourParams.safeParse({ id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.select().from(toursTable).where(eq(toursTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Tour not found" });
    return;
  }
  res.json(GetTourResponse.parse(serialize(row)));
});

router.post("/tours", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateTourBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(toursTable)
    .values({
      ...parsed.data,
      images: parsed.data.images ?? [],
      itinerarySteps: parsed.data.itinerarySteps ?? [],
    })
    .returning();
  // Fire-and-forget: embed in background so admin response is instant
  embedTourAsync(row.id);
  res.status(201).json(CreateTourResponse.parse(serialize(row)));
});

router.patch("/tours/:id", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid tour id" });
    return;
  }
  const params = UpdateTourParams.safeParse({ id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTourBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(toursTable)
    .set(parsed.data)
    .where(eq(toursTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Tour not found" });
    return;
  }
  // Re-embed in background if semantic fields changed
  embedTourAsync(row.id);
  res.json(UpdateTourResponse.parse(serialize(row)));
});

router.delete("/tours/:id", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid tour id" });
    return;
  }
  const params = DeleteTourParams.safeParse({ id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.delete(toursTable).where(eq(toursTable.id, params.data.id)).returning();
  if (!row) {
    res.status(404).json({ error: "Tour not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
