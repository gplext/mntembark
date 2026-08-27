import { Router, type IRouter } from "express";
import { and, eq, desc, inArray, SQL, getTableColumns } from "drizzle-orm";
import { db, toursTable, locationsTable, countriesTable, MAX_ACTIVITIES_PER_TOUR } from "@workspace/db";
import { findTours, getTourWithTaxonomy } from "@workspace/db/queries";
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
  GetTourBySlugParams,
  GetTourBySlugResponse,
  GetTourParams,
  GetTourResponse,
  UpdateTourParams,
  UpdateTourBody,
  UpdateTourResponse,
  DeleteTourParams,
  SetTourActivitiesParams,
  SetTourActivitiesBody,
} from "@workspace/api-zod";
import {
  embeddingsEnabled,
  getEmbedding,
  cosineSimilarity,
  tourToEmbeddingText,
} from "../lib/embeddings";
import { setTourActivities } from "@workspace/db/queries";

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

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Base SELECT that always includes the location and country display names
 * so the tour card can show "Location, Country" without a second round trip.
 * Chain .where() / .orderBy() / .limit() on the result as normal.
 */
function selectToursWithPlace() {
  return db
    .select({
      ...getTableColumns(toursTable),
      locationId: toursTable.locationId,
      locationName: locationsTable.name,
      countryName: countriesTable.name,
    })
    .from(toursTable)
    .leftJoin(locationsTable, eq(locationsTable.id, toursTable.locationId))
    .leftJoin(countriesTable, eq(countriesTable.id, locationsTable.countryId));
}

// ── Routes ────────────────────────────────────────────────────────────────────

/** Normalize Express query values to string[] for repeatable params. */
function toArray(v: unknown): string[] | undefined {
  if (v === undefined || v === null) return undefined;
  if (Array.isArray(v)) return v.map(String);
  return [String(v)];
}

/** Normalize text before comparing a natural-language search query. */
function normalizeSearchText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Small, dependency-free edit-distance implementation for typo-tolerant search. */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

/**
 * Score how closely a query's words match the searchable tour text.
 * Exact words, prefixes, and small spelling errors all receive useful scores.
 */
function fuzzyTextScore(query: string, text: string): number {
  const queryTokens = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  const textTokens = normalizeSearchText(text).split(/\s+/).filter(Boolean);
  if (queryTokens.length === 0 || textTokens.length === 0) return 0;

  const tokenScores = queryTokens.map((queryToken) => {
    let best = 0;
    for (const textToken of textTokens) {
      if (textToken === queryToken) {
        best = 1;
        break;
      }
      if (textToken.startsWith(queryToken) || queryToken.startsWith(textToken)) {
        best = Math.max(best, 0.9);
        continue;
      }
      const maxLength = Math.max(queryToken.length, textToken.length);
      if (maxLength >= 3) {
        const similarity =
          1 - levenshteinDistance(queryToken, textToken) / maxLength;
        best = Math.max(best, similarity >= 0.65 ? similarity : 0);
      }
    }
    return best;
  });

  const matchedTokens = tokenScores.filter((score) => score > 0).length;
  const average =
    tokenScores.reduce((sum, score) => sum + score, 0) / queryTokens.length;
  const coverage = matchedTokens / queryTokens.length;
  const normalizedQuery = normalizeSearchText(query);
  const phraseBonus = normalizeSearchText(text).includes(normalizedQuery)
    ? 0.15
    : 0;

  return Math.min(1, average * 0.7 + coverage * 0.3 + phraseBonus);
}

function tourSearchText(tour: {
  title: string;
  description: string;
  location: string;
  locationName?: string | null;
  countryName?: string | null;
  itinerarySteps: unknown;
}): string {
  const itineraryText = Array.isArray(tour.itinerarySteps)
    ? (tour.itinerarySteps as Array<{ type?: string; title?: string; description?: string }>)
        .map((step) => [step.type, step.title, step.description].filter(Boolean).join(" "))
        .join(" ")
    : "";

  return [
    tour.title,
    tour.description,
    tour.location,
    tour.locationName,
    tour.countryName,
    itineraryText,
  ]
    .filter(Boolean)
    .join(". ");
}

router.get("/tours", async (req, res): Promise<void> => {
  // Normalise repeatable params: Express gives a bare string for one value,
  // an array for multiple. Zod expects an array in both cases.
  const rawQuery = {
    ...req.query,
    classification: toArray(req.query.classification),
    activitySlugs: toArray(req.query.activitySlugs),
  };
  const params = ListToursQueryParams.safeParse(rawQuery);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const {
    categorySlug, destinationSlug, countrySlug, locationSlug,
    classification, activitySlugs,
  } = params.data;

  const hasTaxonomyFilter =
    categorySlug || destinationSlug || countrySlug || locationSlug ||
    (classification && classification.length > 0) ||
    (activitySlugs && activitySlugs.length > 0);

  if (hasTaxonomyFilter) {
    const matched = await findTours({
      categorySlug,
      destinationSlug,
      countrySlug,
      locationSlug,
      activitySlugs,
      classification: classification && classification.length > 0 ? classification : undefined,
    });
    if (matched.length === 0) {
      res.json(ListToursResponse.parse([]));
      return;
    }
    const ids = matched.map((t) => t.id);
    const rows = await selectToursWithPlace().where(inArray(toursTable.id, ids));
    res.json(ListToursResponse.parse(serialize(rows)));
    return;
  }

  // Legacy numeric filters (categoryId, destinationId)
  const conditions: SQL[] = [];
  if (params.data.categoryId) {
    conditions.push(eq(toursTable.categoryId, params.data.categoryId));
  }
  if (params.data.destinationId) {
    conditions.push(eq(toursTable.destinationId, params.data.destinationId));
  }

  const rows = await selectToursWithPlace()
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(toursTable.featured), toursTable.title);
  res.json(ListToursResponse.parse(serialize(rows)));
});

router.get("/tours/featured", async (_req, res): Promise<void> => {
  const rows = await selectToursWithPlace()
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
        const allTours = await selectToursWithPlace();

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

        // Blend AI semantic similarity with typo-tolerant text matching. The
        // description and itinerary are part of both signals, so searches such
        // as "quiet desert stargazing" can find a tour without title overlap.
        const scored = filtered
          .map((tour) => ({
            tour,
            semanticScore: tour.embedding
              ? cosineSimilarity(queryEmbedding, tour.embedding)
              : 0,
            fuzzyScore: fuzzyTextScore(params.data.q, tourSearchText(tour)),
          }))
          .map((result) => ({
            ...result,
            score: result.semanticScore * 0.75 + result.fuzzyScore * 0.25,
          }))
          .filter((result) => result.score >= 0.18 || result.fuzzyScore >= 0.65)
          .sort((a, b) => b.score - a.score);

        res.json(SearchToursResponse.parse(serialize(scored.map((x) => x.tour))));
        return;
      }
    } catch (err) {
      logger.warn({ err }, "Vector search failed, falling back to keyword search");
    }
  }

  // ── Fuzzy fallback ─────────────────────────────────────────────────────────
  // Keep search useful even if the embedding model is unavailable. The catalog
  // is intentionally small, so scoring the joined rows in memory is cheap.
  const conditions: SQL[] = [];
  if (params.data.categoryId) {
    conditions.push(eq(toursTable.categoryId, params.data.categoryId));
  }
  if (params.data.destinationId) {
    conditions.push(eq(toursTable.destinationId, params.data.destinationId));
  }

  const rows = await selectToursWithPlace().where(
    conditions.length > 0 ? and(...conditions) : undefined,
  );
  const scored = rows
    .map((tour) => ({
      tour,
      score: fuzzyTextScore(params.data.q, tourSearchText(tour)),
    }))
    .filter(({ score }) => score >= 0.35)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.tour.featured) - Number(a.tour.featured) ||
        a.tour.title.localeCompare(b.tour.title),
    );
  res.json(SearchToursResponse.parse(serialize(scored.map((x) => x.tour))));
});

router.get("/tours/slug/:slug", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const params = GetTourBySlugParams.safeParse({ slug: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const tour = await getTourWithTaxonomy(params.data.slug);
  if (!tour) {
    res.status(404).json({ error: "Tour not found" });
    return;
  }

  // Drizzle's relational query API shadows the legacy `tours.location: text`
  // column with the joined Location relation under the same key. We destructure
  // to separate them, then promote country to the top level as the spec requires.
  const {
    location: locationObj,   // joined Location relation (shadows text column)
    tourActivities: _ta,     // raw join table rows — not part of the response
    activitySections,
    ...tourFields
  } = tour;

  const countryObj = locationObj?.country ?? null;

  const payload = {
    ...tourFields,
    location: locationObj
      ? { slug: locationObj.slug, name: locationObj.name }
      : null,
    country: countryObj
      ? { slug: countryObj.slug, name: countryObj.name, code: countryObj.code ?? null }
      : null,
    activitySections,
  };

  res.json(GetTourBySlugResponse.parse(serialize(payload)));
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
  const [row] = await selectToursWithPlace().where(eq(toursTable.id, params.data.id));
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

router.put("/tours/:id/activities", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid tour id" });
    return;
  }
  const params = SetTourActivitiesParams.safeParse({ id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = SetTourActivitiesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // 400 before touching the DB when the cap would be exceeded
  if (parsed.data.activityIds.length > MAX_ACTIVITIES_PER_TOUR) {
    res
      .status(400)
      .json({
        error: `A tour may not have more than ${MAX_ACTIVITIES_PER_TOUR} activities (got ${parsed.data.activityIds.length}).`,
      });
    return;
  }
  // Verify tour exists
  const [tour] = await db
    .select({ id: toursTable.id })
    .from(toursTable)
    .where(eq(toursTable.id, params.data.id));
  if (!tour) {
    res.status(404).json({ error: "Tour not found" });
    return;
  }
  await setTourActivities(params.data.id, parsed.data.activityIds);
  res.sendStatus(204);
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
