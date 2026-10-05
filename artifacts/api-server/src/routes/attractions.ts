import { Router, type IRouter, type Request } from "express";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  attractionsTable,
  attractionCategoriesTable,
  attractionActivitiesTable,
  locationsTable,
  countriesTable,
  categoriesTable,
  activitiesTable,
  activityGroupsTable,
  destinationsTable,
  destinationLocationsTable,
  destinationCountriesTable,
  attractionBodySchema,
  attractionPatchSchema,
  type AttractionStep,
} from "@workspace/db";
import { requireAdmin } from "../middleware/requireAdmin";
import { uniqueAttractionSlug } from "../lib/slug";
import { fuzzyTextScore } from "../lib/search";

/**
 * Attractions: what destinations, categories and activities lead to.
 *
 * Typed by hand with zod schemas from @workspace/db rather than through the
 * OpenAPI spec, the same way the airlines screens were, so the web app's
 * types live in one file (lib/attractions-api.ts) next to its hooks.
 *
 * The catalogue is small - dozens to a few hundred rows - so the list is
 * filtered in memory after one enrichment pass. That keeps every filter,
 * including "in this destination" (which goes through the location OR the
 * country), in plain TypeScript instead of a subquery per filter.
 */

const router: IRouter = Router();

/* ------------------------------------------------------------ shapes */

interface Ref {
  id: number;
  slug: string;
  name: string;
}

export interface AttractionView {
  id: number;
  slug: string;
  name: string;
  summary: string | null;
  description: string;
  coverImage: string;
  images: string[];
  classification: "standard" | "special" | "exclusive";
  featured: boolean;
  visitDuration: string | null;
  priceFrom: number | null;
  hotelsAvailable: boolean;
  stayNote: string | null;
  steps: AttractionStep[];
  isActive: boolean;
  displayOrder: number;
  location: Ref;
  country: (Ref & { code: string | null }) | null;
  /** Main category first. */
  categories: Ref[];
  activities: (Ref & { groupSlug: string; groupName: string })[];
  /** Every destination that lists this attraction's location or its country. */
  destinationIds: number[];
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------ loading */

/**
 * Every attraction matching `where`, with its place, categories, activities
 * and destinations attached. Four queries whatever the row count.
 */
async function loadAttractions(opts: { activeOnly: boolean; id?: number; slug?: string }) {
  const conds = [];
  if (opts.activeOnly) conds.push(eq(attractionsTable.isActive, true));
  if (opts.id !== undefined) conds.push(eq(attractionsTable.id, opts.id));
  if (opts.slug !== undefined) conds.push(eq(attractionsTable.slug, opts.slug));

  const rows = await db
    .select({
      a: attractionsTable,
      locId: locationsTable.id,
      locSlug: locationsTable.slug,
      locName: locationsTable.name,
      countryId: countriesTable.id,
      countrySlug: countriesTable.slug,
      countryName: countriesTable.name,
      countryCode: countriesTable.code,
    })
    .from(attractionsTable)
    .innerJoin(locationsTable, eq(locationsTable.id, attractionsTable.locationId))
    .leftJoin(countriesTable, eq(countriesTable.id, locationsTable.countryId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(attractionsTable.displayOrder), asc(attractionsTable.name));

  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.a.id);
  const locIds = [...new Set(rows.map((r) => r.locId))];
  const countryIds = [...new Set(rows.map((r) => r.countryId).filter((x): x is number => x !== null))];

  const [cats, acts, destByLoc, destByCountry] = await Promise.all([
    db
      .select({
        attractionId: attractionCategoriesTable.attractionId,
        id: categoriesTable.id,
        slug: categoriesTable.slug,
        name: categoriesTable.name,
      })
      .from(attractionCategoriesTable)
      .innerJoin(categoriesTable, eq(categoriesTable.id, attractionCategoriesTable.categoryId))
      .where(inArray(attractionCategoriesTable.attractionId, ids))
      .orderBy(asc(attractionCategoriesTable.displayOrder)),
    db
      .select({
        attractionId: attractionActivitiesTable.attractionId,
        id: activitiesTable.id,
        slug: activitiesTable.slug,
        name: activitiesTable.name,
        groupSlug: activityGroupsTable.slug,
        groupName: activityGroupsTable.name,
      })
      .from(attractionActivitiesTable)
      .innerJoin(activitiesTable, eq(activitiesTable.id, attractionActivitiesTable.activityId))
      .innerJoin(activityGroupsTable, eq(activityGroupsTable.id, activitiesTable.groupId))
      .where(inArray(attractionActivitiesTable.attractionId, ids))
      .orderBy(asc(attractionActivitiesTable.displayOrder)),
    db
      .select({ key: destinationLocationsTable.locationId, dest: destinationLocationsTable.destinationId })
      .from(destinationLocationsTable)
      .where(inArray(destinationLocationsTable.locationId, locIds)),
    countryIds.length
      ? db
          .select({ key: destinationCountriesTable.countryId, dest: destinationCountriesTable.destinationId })
          .from(destinationCountriesTable)
          .where(inArray(destinationCountriesTable.countryId, countryIds))
      : Promise.resolve([] as { key: number; dest: number }[]),
  ]);

  const group = <T extends { key: number }>(list: T[]) => {
    const m = new Map<number, T[]>();
    for (const x of list) m.set(x.key, [...(m.get(x.key) ?? []), x]);
    return m;
  };
  const catsBy = group(cats.map((c) => ({ ...c, key: c.attractionId })));
  const actsBy = group(acts.map((c) => ({ ...c, key: c.attractionId })));
  const locDest = group(destByLoc);
  const countryDest = group(destByCountry);

  return rows.map(({ a, ...p }): AttractionView => {
    const destinationIds = new Set<number>();
    for (const d of locDest.get(p.locId) ?? []) destinationIds.add(d.dest);
    if (p.countryId !== null) for (const d of countryDest.get(p.countryId) ?? []) destinationIds.add(d.dest);

    return {
      id: a.id,
      slug: a.slug,
      name: a.name,
      summary: a.summary,
      description: a.description,
      coverImage: a.coverImage,
      images: a.images,
      classification: a.classification,
      featured: a.featured,
      visitDuration: a.visitDuration,
      priceFrom: a.priceFrom,
      hotelsAvailable: a.hotelsAvailable,
      stayNote: a.stayNote,
      steps: a.steps,
      isActive: a.isActive,
      displayOrder: a.displayOrder,
      location: { id: p.locId, slug: p.locSlug, name: p.locName },
      country:
        p.countryId !== null
          ? { id: p.countryId, slug: p.countrySlug!, name: p.countryName!, code: p.countryCode ?? null }
          : null,
      categories: (catsBy.get(a.id) ?? []).map((c) => ({ id: c.id, slug: c.slug ?? "", name: c.name })),
      activities: (actsBy.get(a.id) ?? []).map((x) => ({
        id: x.id,
        slug: x.slug,
        name: x.name,
        groupSlug: x.groupSlug,
        groupName: x.groupName,
      })),
      destinationIds: [...destinationIds].sort((x, y) => x - y),
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  });
}

/* ------------------------------------------------------------- public */

const many = (v: unknown): string[] =>
  v === undefined || v === null ? [] : (Array.isArray(v) ? v : [v]).map(String).filter(Boolean);
const one = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

function searchText(a: AttractionView): string {
  return [
    a.name,
    a.summary,
    a.description,
    a.location.name,
    a.country?.name,
    ...a.categories.map((c) => c.name),
    ...a.activities.map((x) => x.name),
  ]
    .filter(Boolean)
    .join(". ");
}

/**
 * GET /attractions
 *
 *   q                 typo-tolerant search; results come back best match first
 *   categorySlug      in that category (any of its categories, not only the main one)
 *   destinationSlug   its location or its country is in that destination
 *   countrySlug, locationSlug
 *   classification    repeatable, any of
 *   activitySlugs     repeatable, all of
 *   featured=true
 */
async function listPublic(req: Request) {
  const q = one(req.query["q"]);
  const categorySlug = one(req.query["categorySlug"]);
  const destinationSlug = one(req.query["destinationSlug"]);
  const countrySlug = one(req.query["countrySlug"]);
  const locationSlug = one(req.query["locationSlug"]);
  const classification = many(req.query["classification"]);
  const activitySlugs = many(req.query["activitySlugs"]);
  const featured = one(req.query["featured"]) === "true";

  let list = await loadAttractions({ activeOnly: true });

  if (destinationSlug) {
    const [dest] = await db
      .select({ id: destinationsTable.id })
      .from(destinationsTable)
      .where(eq(destinationsTable.slug, destinationSlug))
      .limit(1);
    list = dest ? list.filter((a) => a.destinationIds.includes(dest.id)) : [];
  }
  if (categorySlug) list = list.filter((a) => a.categories.some((c) => c.slug === categorySlug));
  if (countrySlug) list = list.filter((a) => a.country?.slug === countrySlug);
  if (locationSlug) list = list.filter((a) => a.location.slug === locationSlug);
  if (classification.length) list = list.filter((a) => classification.includes(a.classification));
  if (activitySlugs.length)
    list = list.filter((a) => activitySlugs.every((s) => a.activities.some((x) => x.slug === s)));
  if (featured) list = list.filter((a) => a.featured);

  if (q) {
    return list
      .map((a) => ({ a, score: fuzzyTextScore(q, searchText(a)) }))
      .filter((x) => x.score >= 0.35)
      .sort((x, y) => y.score - x.score || Number(y.a.featured) - Number(x.a.featured))
      .map((x) => x.a);
  }
  return list.sort(
    (x, y) =>
      Number(y.featured) - Number(x.featured) ||
      x.displayOrder - y.displayOrder ||
      x.name.localeCompare(y.name),
  );
}

router.get("/attractions", async (req, res): Promise<void> => {
  res.json(await listPublic(req));
});

router.get("/attractions/:slug", async (req, res): Promise<void> => {
  const slug = String(req.params["slug"] ?? "");
  const [a] = await loadAttractions({ activeOnly: true, slug });
  if (!a) {
    res.status(404).json({ error: "Attraction not found" });
    return;
  }
  res.json(a);
});

/* -------------------------------------------------------------- admin */

router.get("/admin/attractions", requireAdmin, async (_req, res): Promise<void> => {
  res.json(await loadAttractions({ activeOnly: false }));
});

/**
 * 400 with a readable sentence when an id in the body does not exist, rather
 * than letting the foreign key fail as a 500 inside the transaction.
 */
async function checkRefs(body: { locationId?: number; categoryIds?: number[]; activityIds?: number[] }) {
  if (body.locationId !== undefined) {
    const [loc] = await db
      .select({ id: locationsTable.id })
      .from(locationsTable)
      .where(eq(locationsTable.id, body.locationId));
    if (!loc) return "That location no longer exists";
  }
  if (body.categoryIds?.length) {
    const found = await db
      .select({ id: categoriesTable.id })
      .from(categoriesTable)
      .where(inArray(categoriesTable.id, body.categoryIds));
    if (found.length !== new Set(body.categoryIds).size) return "One of the categories no longer exists";
  }
  if (body.activityIds?.length) {
    const found = await db
      .select({ id: activitiesTable.id })
      .from(activitiesTable)
      .where(inArray(activitiesTable.id, body.activityIds));
    if (found.length !== new Set(body.activityIds).size) return "One of the activities no longer exists";
  }
  return null;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function replaceLinks(tx: Tx, id: number, categoryIds?: number[], activityIds?: number[]) {
  if (categoryIds) {
    await tx.delete(attractionCategoriesTable).where(eq(attractionCategoriesTable.attractionId, id));
    const unique = [...new Set(categoryIds)];
    if (unique.length)
      await tx
        .insert(attractionCategoriesTable)
        .values(unique.map((categoryId, i) => ({ attractionId: id, categoryId, displayOrder: i })));
  }
  if (activityIds) {
    await tx.delete(attractionActivitiesTable).where(eq(attractionActivitiesTable.attractionId, id));
    const unique = [...new Set(activityIds)];
    if (unique.length)
      await tx
        .insert(attractionActivitiesTable)
        .values(unique.map((activityId, i) => ({ attractionId: id, activityId, displayOrder: i })));
  }
}

const firstIssue = (e: { issues: { message: string; path: PropertyKey[] }[] }) => {
  const i = e.issues[0];
  return i ? `${i.path.length ? `${i.path.join(".")}: ` : ""}${i.message}` : "Invalid attraction";
};

router.post("/admin/attractions", requireAdmin, async (req, res): Promise<void> => {
  const parsed = attractionBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: firstIssue(parsed.error) });
    return;
  }
  const { categoryIds, activityIds, slug: givenSlug, ...fields } = parsed.data;
  const refError = await checkRefs(parsed.data);
  if (refError) {
    res.status(400).json({ error: refError });
    return;
  }
  if (givenSlug) {
    const [taken] = await db
      .select({ id: attractionsTable.id })
      .from(attractionsTable)
      .where(eq(attractionsTable.slug, givenSlug));
    if (taken) {
      res.status(409).json({ error: `The address "${givenSlug}" is already used by another attraction` });
      return;
    }
  }
  const slug = givenSlug ?? (await uniqueAttractionSlug(fields.name));

  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(attractionsTable)
      .values({ ...fields, slug })
      .returning({ id: attractionsTable.id });
    await replaceLinks(tx, row!.id, categoryIds, activityIds);
    return row!.id;
  });

  const [created] = await loadAttractions({ activeOnly: false, id });
  res.status(201).json(created);
});

router.patch("/admin/attractions/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid attraction id" });
    return;
  }
  const parsed = attractionPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: firstIssue(parsed.error) });
    return;
  }
  const refError = await checkRefs(parsed.data);
  if (refError) {
    res.status(400).json({ error: refError });
    return;
  }

  /*
   * Only the keys the caller sent. zod has already dropped unknown ones, and
   * the schema carries no defaults, so a key missing here was missing in the
   * request and must stay as it is in the row.
   */
  const { categoryIds, activityIds, ...fields } = parsed.data;
  const patch = Object.fromEntries(
    Object.entries(fields).filter(([k]) => Object.prototype.hasOwnProperty.call(req.body, k)),
  ) as Partial<typeof fields>;

  if (patch.slug) {
    const [taken] = await db
      .select({ id: attractionsTable.id })
      .from(attractionsTable)
      .where(eq(attractionsTable.slug, patch.slug));
    if (taken && taken.id !== id) {
      res.status(409).json({ error: `The address "${patch.slug}" is already used by another attraction` });
      return;
    }
  }

  const found = await db.transaction(async (tx) => {
    const [row] = Object.keys(patch).length
      ? await tx
          .update(attractionsTable)
          .set(patch)
          .where(eq(attractionsTable.id, id))
          .returning({ id: attractionsTable.id })
      : await tx.select({ id: attractionsTable.id }).from(attractionsTable).where(eq(attractionsTable.id, id));
    if (!row) return false;
    await replaceLinks(
      tx,
      id,
      "categoryIds" in req.body ? categoryIds : undefined,
      "activityIds" in req.body ? activityIds : undefined,
    );
    if (!Object.keys(patch).length) {
      // Links alone changed: still move updated_at so the list shows it.
      await tx.update(attractionsTable).set({ updatedAt: sql`now()` }).where(eq(attractionsTable.id, id));
    }
    return true;
  });

  if (!found) {
    res.status(404).json({ error: "Attraction not found" });
    return;
  }
  const [updated] = await loadAttractions({ activeOnly: false, id });
  res.json(updated);
});

router.delete("/admin/attractions/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid attraction id" });
    return;
  }
  const [row] = await db
    .delete(attractionsTable)
    .where(eq(attractionsTable.id, id))
    .returning({ id: attractionsTable.id });
  if (!row) {
    res.status(404).json({ error: "Attraction not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
