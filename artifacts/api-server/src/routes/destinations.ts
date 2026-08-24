import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, destinationsTable } from "@workspace/db";

/** Returns true when `err` (or any wrapped `cause`) is a PostgreSQL
 *  unique-constraint violation on the destinations slug column (pg error
 *  code 23505).  Drizzle surfaces the raw pg error under `.cause`. */
function isSlugConflict(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as Record<string, unknown>;
  if (e["code"] === "23505" &&
      typeof e["constraint"] === "string" &&
      (e["constraint"] as string).includes("slug")) {
    return true;
  }
  // Drizzle wraps the pg error inside `.cause`
  if ("cause" in e) return isSlugConflict(e["cause"]);
  return false;
}
import { getPlaceFilters, getDestinationPlaces, setDestinationPlaces, listDestinationsWithCountries } from "@workspace/db/queries";
import { serialize } from "../lib/serialize";
import { requireAdmin } from "../middleware/requireAdmin";
import {
  ListDestinationsResponse,
  CreateDestinationBody,
  CreateDestinationResponse,
  GetDestinationParams,
  GetDestinationResponse,
  GetDestinationPlacesParams,
  GetDestinationPlacesResponse,
  GetDestinationPlacesByIdParams,
  GetDestinationPlacesByIdResponse,
  SetDestinationPlacesParams,
  SetDestinationPlacesBody,
  UpdateDestinationParams,
  UpdateDestinationBody,
  UpdateDestinationResponse,
  DeleteDestinationParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/destinations", async (_req, res): Promise<void> => {
  const rows = await listDestinationsWithCountries();
  res.json(ListDestinationsResponse.parse(serialize(rows)));
});

router.post("/destinations", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateDestinationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const [row] = await db.insert(destinationsTable).values(parsed.data).returning();
    res.status(201).json(CreateDestinationResponse.parse(serialize(row)));
  } catch (err) {
    if (isSlugConflict(err)) {
      res.status(409).json({ error: "Slug already taken" });
      return;
    }
    throw err;
  }
});

// ── Admin: read/write place IDs by numeric destination id ─────────────────
// Registered before the slug handler so numeric ids are caught first.
// When `:id` is non-numeric (e.g. a slug) safeParse fails and next() falls
// through to the slug handler below.
router.get("/destinations/:id/places", async (req, res, next): Promise<void> => {
  const params = GetDestinationPlacesByIdParams.safeParse(req.params);
  if (!params.success) {
    next();
    return;
  }
  const places = await getDestinationPlaces(params.data.id);
  res.json(GetDestinationPlacesByIdResponse.parse(places));
});

router.put("/destinations/:id/places", requireAdmin, async (req, res): Promise<void> => {
  const params = SetDestinationPlacesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = SetDestinationPlacesBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  await setDestinationPlaces(params.data.id, body.data);
  res.sendStatus(204);
});

router.get("/destinations/:slug/places", async (req, res): Promise<void> => {
  const params = GetDestinationPlacesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const result = await getPlaceFilters(params.data.slug);
  // getPlaceFilters(slug) always returns PlaceFiltersForDestination, never the array overload
  if (Array.isArray(result)) {
    res.status(404).json({ error: "Destination not found" });
    return;
  }
  res.json(GetDestinationPlacesResponse.parse(serialize(result)));
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
  try {
    const [row] = await db.update(destinationsTable).set(parsed.data).where(eq(destinationsTable.id, params.data.id)).returning();
    if (!row) {
      res.status(404).json({ error: "Destination not found" });
      return;
    }
    res.json(UpdateDestinationResponse.parse(serialize(row)));
  } catch (err) {
    if (isSlugConflict(err)) {
      res.status(409).json({ error: "Slug already taken" });
      return;
    }
    throw err;
  }
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
