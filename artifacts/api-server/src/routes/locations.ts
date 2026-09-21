import { Router, type IRouter } from "express";
import { and, count, eq, sql } from "drizzle-orm";
import { db, locationsTable, countriesTable, attractionsTable, newLocationBodySchema } from "@workspace/db";
import { getLocations, createLocation, updateLocation, deleteLocation } from "@workspace/db/queries";
import { serialize } from "../lib/serialize";
import { slugify } from "../lib/slug";
import { requireAdmin } from "../middleware/requireAdmin";
import {
  ListLocationsResponse,
  CreateLocationBody,
  CreateLocationResponse,
  UpdateLocationParams,
  UpdateLocationBody,
  UpdateLocationResponse,
  DeleteLocationParams,
  DeleteLocationResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/locations", async (_req, res): Promise<void> => {
  const rows = await getLocations();
  res.json(ListLocationsResponse.parse(serialize(rows)));
});

router.post("/locations", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateLocationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const location = await createLocation(parsed.data);
  res.status(201).json(CreateLocationResponse.parse(serialize(location)));
});

router.patch("/locations/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateLocationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateLocationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updated = await updateLocation(params.data.id, parsed.data);
  if (!updated) {
    res.status(404).json({ error: "Location not found" });
    return;
  }
  res.json(UpdateLocationResponse.parse(serialize(updated)));
});

router.delete("/locations/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteLocationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  /*
   * Attractions point at their location and the database refuses to delete a
   * location that still has one, which would surface as a bare 500. Say why.
   */
  const [{ n }] = await db
    .select({ n: count() })
    .from(attractionsTable)
    .where(eq(attractionsTable.locationId, params.data.id));
  if (n > 0) {
    res.status(409).json({
      error: `${n} ${n === 1 ? "attraction is" : "attractions are"} in this location. Move or delete ${n === 1 ? "it" : "them"} first.`,
    });
    return;
  }
  const success = await deleteLocation(params.data.id);
  if (!success) {
    res.status(404).json({ error: "Location not found" });
    return;
  }
  res.json(DeleteLocationResponse.parse({ success: true }));
});

/**
 * POST /admin/locations - add a place from the attraction form.
 *
 * Every attraction needs a location, and until now locations could only be
 * added with SQL, so the destinations added that way have countries but no
 * places inside them. This is the smallest thing that closes that gap: a
 * name plus an existing country, or a new country by name.
 *
 * Adding the same place twice returns the one that exists instead of making
 * a second "Arusha, Tanzania".
 */
async function freeSlug(
  table: typeof locationsTable | typeof countriesTable,
  wanted: string,
): Promise<string> {
  const base = wanted || "place";
  for (let n = 1; n <= 50; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const [taken] = await db.select({ id: table.id }).from(table).where(eq(table.slug, candidate)).limit(1);
    if (!taken) return candidate;
  }
  return `${base}-${Date.now()}`;
}

router.post("/admin/locations", requireAdmin, async (req, res): Promise<void> => {
  const parsed = newLocationBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid place" });
    return;
  }
  const { name, countryId, newCountryName } = parsed.data;

  let country: { id: number; name: string } | undefined;
  if (countryId) {
    [country] = await db
      .select({ id: countriesTable.id, name: countriesTable.name })
      .from(countriesTable)
      .where(eq(countriesTable.id, countryId));
    if (!country) {
      res.status(400).json({ error: "That country no longer exists" });
      return;
    }
  } else {
    // Reuse a country that already exists under that name, whatever the case.
    [country] = await db
      .select({ id: countriesTable.id, name: countriesTable.name })
      .from(countriesTable)
      .where(sql`lower(${countriesTable.name}) = lower(${newCountryName!})`);
    if (!country) {
      [country] = await db
        .insert(countriesTable)
        .values({ name: newCountryName!, slug: await freeSlug(countriesTable, slugify(newCountryName!)) })
        .returning({ id: countriesTable.id, name: countriesTable.name });
    }
  }

  const [existing] = await db
    .select({ id: locationsTable.id })
    .from(locationsTable)
    .where(and(eq(locationsTable.countryId, country!.id), sql`lower(${locationsTable.name}) = lower(${name})`));
  if (existing) {
    res.json({ id: existing.id, name, countryId: country!.id, countryName: country!.name, created: false });
    return;
  }

  // "Victoria" exists in several countries, so a clash falls back to name + country.
  let slug = slugify(name);
  const [clash] = await db.select({ id: locationsTable.id }).from(locationsTable).where(eq(locationsTable.slug, slug));
  if (clash) slug = slugify(`${name} ${country!.name}`);
  slug = await freeSlug(locationsTable, slug);

  const [row] = await db
    .insert(locationsTable)
    .values({ name, slug, countryId: country!.id })
    .returning({ id: locationsTable.id });
  res.status(201).json({ id: row!.id, name, countryId: country!.id, countryName: country!.name, created: true });
});

export default router;
