/**
 * lib/db/src/queries/taxonomy.ts
 *
 * Read queries (and one write) for the Phase-1 taxonomy:
 * activity groups, place hierarchy, tour filter, and the full tour
 * detail with all relations loaded.
 *
 * Rules:
 *  - Drizzle query builder throughout.
 *  - sql`` is used only for the AND-semantics activity subquery, which
 *    requires HAVING COUNT(DISTINCT …) — not expressible with the
 *    builder alone.
 *  - Relations are defined here so the schema files remain untouched.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { relations, eq, and, isNull, inArray, count, asc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { pool, db } from "../index";
import {
  activityGroupsTable,
  activitiesTable,
  tourActivitiesTable,
  toursTable,
  categoriesTable,
  destinationsTable,
  destinationCountriesTable,
  destinationLocationsTable,
  locationsTable,
  countriesTable,
  MAX_ACTIVITIES_PER_TOUR,
} from "../schema/index";

/* ------------------------------------------------------------------ *
 * Relational relations                                                 *
 *                                                                     *
 * Defined here, not in the schema files, so the schema files are not  *
 * touched. The `rdb` instance below is the only consumer.            *
 * ------------------------------------------------------------------ */

const toursRelations = relations(toursTable, ({ one, many }) => ({
  category: one(categoriesTable, {
    fields: [toursTable.categoryId],
    references: [categoriesTable.id],
  }),
  destination: one(destinationsTable, {
    fields: [toursTable.destinationId],
    references: [destinationsTable.id],
  }),
  location: one(locationsTable, {
    fields: [toursTable.locationId],
    references: [locationsTable.id],
  }),
  tourActivities: many(tourActivitiesTable),
}));

const tourActivitiesRelations = relations(tourActivitiesTable, ({ one }) => ({
  tour: one(toursTable, {
    fields: [tourActivitiesTable.tourId],
    references: [toursTable.id],
  }),
  activity: one(activitiesTable, {
    fields: [tourActivitiesTable.activityId],
    references: [activitiesTable.id],
  }),
}));

const activitiesRelations = relations(activitiesTable, ({ one, many }) => ({
  group: one(activityGroupsTable, {
    fields: [activitiesTable.groupId],
    references: [activityGroupsTable.id],
  }),
  tourActivities: many(tourActivitiesTable),
}));

const activityGroupsRelations = relations(activityGroupsTable, ({ many }) => ({
  activities: many(activitiesTable),
}));

const locationsRelations = relations(locationsTable, ({ one }) => ({
  country: one(countriesTable, {
    fields: [locationsTable.countryId],
    references: [countriesTable.id],
  }),
}));

/**
 * Drizzle instance with relations — used only by getTourWithTaxonomy
 * so that db.query.* is available for that one-round-trip fetch.
 */
const rdb = drizzle(pool, {
  schema: {
    toursTable,
    toursRelations,
    categoriesTable,
    destinationsTable,
    locationsTable,
    countriesTable,
    activitiesTable,
    activityGroupsTable,
    activityGroupsRelations,
    activitiesRelations,
    tourActivitiesTable,
    tourActivitiesRelations,
    locationsRelations,
  },
});

/* ================================================================== *
 * 1. getActivityFilters                                               *
 * ================================================================== */

export interface ActivityFilterItem {
  id: number;
  slug: string;
  name: string;
  icon: string | null;
  aliases: string[];
  count: number;
}

export interface ActivityFilterGroup {
  groupSlug: string;
  groupName: string;
  activities: ActivityFilterItem[];
}

/**
 * The four activity-group sections, each with their filterable
 * activities and a live tour count per activity.
 *
 * Excludes:
 *   – activities where is_filterable = false
 *   – activities with a redirect_to_id (merged / retired)
 *
 * Ordered by activity_groups.display_order, then activities.display_order.
 */
export async function getActivityFilters(): Promise<ActivityFilterGroup[]> {
  const rows = await db
    .select({
      groupSlug: activityGroupsTable.slug,
      groupName: activityGroupsTable.name,
      groupOrder: activityGroupsTable.displayOrder,
      activityId: activitiesTable.id,
      activitySlug: activitiesTable.slug,
      activityName: activitiesTable.name,
      activityIcon: activitiesTable.icon,
      activityAliases: activitiesTable.aliases,
      activityOrder: activitiesTable.displayOrder,
      tourCount: count(tourActivitiesTable.tourId),
    })
    .from(activityGroupsTable)
    .innerJoin(
      activitiesTable,
      eq(activitiesTable.groupId, activityGroupsTable.id),
    )
    .leftJoin(
      tourActivitiesTable,
      eq(tourActivitiesTable.activityId, activitiesTable.id),
    )
    .where(
      and(
        eq(activitiesTable.isFilterable, true),
        isNull(activitiesTable.redirectToId),
      ),
    )
    .groupBy(
      activityGroupsTable.id,
      activityGroupsTable.slug,
      activityGroupsTable.name,
      activityGroupsTable.displayOrder,
      activitiesTable.id,
      activitiesTable.slug,
      activitiesTable.name,
      activitiesTable.icon,
      activitiesTable.aliases,
      activitiesTable.displayOrder,
    )
    .orderBy(
      asc(activityGroupsTable.displayOrder),
      asc(activitiesTable.displayOrder),
    );

  // Fold flat rows into the nested shape while preserving group order
  const map = new Map<string, ActivityFilterGroup>();
  for (const r of rows) {
    if (!map.has(r.groupSlug)) {
      map.set(r.groupSlug, {
        groupSlug: r.groupSlug,
        groupName: r.groupName,
        activities: [],
      });
    }
    map.get(r.groupSlug)!.activities.push({
      id: r.activityId,
      slug: r.activitySlug,
      name: r.activityName,
      icon: r.activityIcon,
      aliases: r.activityAliases,
      count: Number(r.tourCount),
    });
  }
  return [...map.values()];
}

/* ================================================================== *
 * 2. getActivityBySlug                                               *
 * ================================================================== */

export interface ActivityDetail {
  slug: string;
  name: string;
  description: string | null;
  coverImage: string | null;
  icon: string | null;
  groupSlug: string;
  groupName: string;
  isIndexable: boolean;
  redirectToSlug: string | null;
}

/**
 * Fetch a single activity by slug, joined to its group.
 *
 * Returns null when no activity has that slug.
 *
 * When redirect_to_id is set the activity has been merged into another one;
 * the caller should 301 to /activities/{redirectToSlug}. We resolve the id
 * to a slug here so the client needs only one request.
 */
export async function getActivityBySlug(
  slug: string,
): Promise<ActivityDetail | null> {
  const rows = await db
    .select({
      slug: activitiesTable.slug,
      name: activitiesTable.name,
      description: activitiesTable.description,
      coverImage: activitiesTable.coverImage,
      icon: activitiesTable.icon,
      isIndexable: activitiesTable.isIndexable,
      redirectToId: activitiesTable.redirectToId,
      groupSlug: activityGroupsTable.slug,
      groupName: activityGroupsTable.name,
    })
    .from(activitiesTable)
    .innerJoin(
      activityGroupsTable,
      eq(activityGroupsTable.id, activitiesTable.groupId),
    )
    .where(eq(activitiesTable.slug, slug))
    .limit(1);

  if (rows.length === 0) return null;
  const row = rows[0];

  let redirectToSlug: string | null = null;
  if (row.redirectToId !== null) {
    const target = await db
      .select({ slug: activitiesTable.slug })
      .from(activitiesTable)
      .where(eq(activitiesTable.id, row.redirectToId))
      .limit(1);
    redirectToSlug = target.length > 0 ? target[0].slug : null;
  }

  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    coverImage: row.coverImage,
    icon: row.icon,
    isIndexable: row.isIndexable,
    redirectToSlug,
    groupSlug: row.groupSlug,
    groupName: row.groupName,
  };
}

/* ================================================================== *
 * 3. getLocations                                                     *
 * ================================================================== */

export interface LocationSummary {
  id: number;
  slug: string;
  name: string;
  countryName: string | null;
}

/**
 * All locations joined to their country name, ordered alphabetically.
 * Used by admin location selects so the admin can distinguish two
 * cities with the same name (e.g. "Springfield, Illinois" vs "Springfield,
 * Missouri").
 */
export async function getLocations(): Promise<LocationSummary[]> {
  return db
    .select({
      id: locationsTable.id,
      slug: locationsTable.slug,
      name: locationsTable.name,
      countryName: countriesTable.name,
    })
    .from(locationsTable)
    .leftJoin(countriesTable, eq(countriesTable.id, locationsTable.countryId))
    .orderBy(asc(locationsTable.name));
}

/* ================================================================== *
 * 4. getPlaceFilters                                                  *
 * ================================================================== */

export interface DestinationSummary {
  id: number;
  slug: string | null;
  name: string;
}

export interface PlaceFiltersForDestination {
  countries: { slug: string; name: string; code: string | null }[];
  locations: { slug: string; name: string; countrySlug: string | null }[];
}

/**
 * Without an argument: all destinations (for the global filter panel).
 * With a destinationSlug: the countries and locations linked to it via
 * destination_countries and destination_locations.
 *
 * Note: a destination can span several countries (Patagonia spans Chile
 * and Argentina), which is why both joins are many-to-many.
 */
export async function getPlaceFilters(
  destinationSlug?: string,
): Promise<DestinationSummary[] | PlaceFiltersForDestination> {
  if (!destinationSlug) {
    return db
      .select({
        id: destinationsTable.id,
        slug: destinationsTable.slug,
        name: destinationsTable.name,
      })
      .from(destinationsTable)
      .orderBy(asc(destinationsTable.displayOrder));
  }

  const [countries, locations] = await Promise.all([
    db
      .select({
        slug: countriesTable.slug,
        name: countriesTable.name,
        code: countriesTable.code,
      })
      .from(destinationCountriesTable)
      .innerJoin(
        destinationsTable,
        eq(destinationsTable.id, destinationCountriesTable.destinationId),
      )
      .innerJoin(
        countriesTable,
        eq(countriesTable.id, destinationCountriesTable.countryId),
      )
      .where(eq(destinationsTable.slug, destinationSlug))
      .orderBy(asc(destinationCountriesTable.displayOrder)),

    db
      .select({
        slug: locationsTable.slug,
        name: locationsTable.name,
        countrySlug: countriesTable.slug,
      })
      .from(destinationLocationsTable)
      .innerJoin(
        destinationsTable,
        eq(destinationsTable.id, destinationLocationsTable.destinationId),
      )
      .innerJoin(
        locationsTable,
        eq(locationsTable.id, destinationLocationsTable.locationId),
      )
      .leftJoin(
        countriesTable,
        eq(countriesTable.id, locationsTable.countryId),
      )
      .where(eq(destinationsTable.slug, destinationSlug))
      .orderBy(asc(destinationLocationsTable.displayOrder)),
  ]);

  return { countries, locations };
}

/* ================================================================== *
 * 3. findTours                                                        *
 * ================================================================== */

export interface FindToursFilter {
  categorySlug?: string;
  destinationSlug?: string;
  /** tours.location_id -> locations.country_id -> countries.slug */
  countrySlug?: string;
  locationSlug?: string;
  /** AND semantics: tour must have ALL listed activities */
  activitySlugs?: string[];
  /** OR semantics: tour must match ANY of the listed classifications */
  classification?: ("standard" | "special" | "exclusive")[];
  featured?: boolean;
}

/**
 * Filter tours by any combination of taxonomy attributes.
 * All parameters are optional and combinable.
 *
 * Activity filtering is AND: passing ['hiking','camping'] returns only
 * tours that have BOTH, not either.
 *
 * Place filters:
 *   destinationSlug -> tours.destination_id
 *   countrySlug     -> tours.location_id -> locations.country_id
 *   locationSlug    -> tours.location_id
 */
export async function findTours(filters: FindToursFilter = {}) {
  const {
    categorySlug,
    destinationSlug,
    countrySlug,
    locationSlug,
    activitySlugs,
    classification,
    featured,
  } = filters;

  const conditions: SQL[] = [];

  if (classification && classification.length > 0) {
    conditions.push(inArray(toursTable.classification, classification));
  }
  if (featured !== undefined) {
    conditions.push(eq(toursTable.featured, featured));
  }
  if (categorySlug) {
    conditions.push(
      inArray(
        toursTable.categoryId,
        db
          .select({ id: categoriesTable.id })
          .from(categoriesTable)
          .where(eq(categoriesTable.slug, categorySlug)),
      ),
    );
  }
  if (destinationSlug) {
    conditions.push(
      inArray(
        toursTable.destinationId,
        db
          .select({ id: destinationsTable.id })
          .from(destinationsTable)
          .where(eq(destinationsTable.slug, destinationSlug)),
      ),
    );
  }
  if (locationSlug) {
    conditions.push(
      inArray(
        toursTable.locationId,
        db
          .select({ id: locationsTable.id })
          .from(locationsTable)
          .where(eq(locationsTable.slug, locationSlug)),
      ),
    );
  }
  if (countrySlug) {
    // tour -> location -> country
    conditions.push(
      inArray(
        toursTable.locationId,
        db
          .select({ id: locationsTable.id })
          .from(locationsTable)
          .innerJoin(
            countriesTable,
            eq(locationsTable.countryId, countriesTable.id),
          )
          .where(eq(countriesTable.slug, countrySlug)),
      ),
    );
  }

  // AND-semantics: tour must have ALL requested activities.
  // sql`` is required here because the builder has no HAVING COUNT(DISTINCT).
  // We build an explicit ARRAY[…] so pg-node binds each slug as a separate
  // parameter — interpolating a plain JS array produces ($1,$2) which ANY
  // rejects as a row constructor rather than an array.
  if (activitySlugs && activitySlugs.length > 0) {
    const n = activitySlugs.length;
    const slugArray = sql`ARRAY[${sql.join(
      activitySlugs.map((s) => sql`${s}`),
      sql`, `,
    )}]`;
    conditions.push(
      sql`${toursTable.id} IN (
        SELECT ta.tour_id
        FROM   tour_activities ta
        JOIN   activities a ON a.id = ta.activity_id
        WHERE  a.slug = ANY(${slugArray})
        GROUP  BY ta.tour_id
        HAVING count(DISTINCT a.id) = ${n}
      )`,
    );
  }

  return db
    .select()
    .from(toursTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(toursTable.createdAt));
}

/* ================================================================== *
 * 4. getTourWithTaxonomy                                              *
 * ================================================================== */

/**
 * Fetch one tour with all taxonomy relations in a single round trip,
 * using the Drizzle relational query API.
 *
 * Returns null when no tour has that slug.
 *
 * The returned object adds `activitySections`: the tour's activities
 * folded by section (group), in display order.
 */
export async function getTourWithTaxonomy(slug: string) {
  const raw = await rdb.query.toursTable.findFirst({
    where: eq(toursTable.slug, slug),
    with: {
      category: true,
      destination: true,
      location: {
        with: { country: true },
      },
      tourActivities: {
        orderBy: (ta, { asc: a }) => [a(ta.displayOrder)],
        with: {
          activity: {
            with: { group: true },
          },
        },
      },
    },
  });

  if (!raw) return null;

  // Fold activities into sections (groups) in their display order
  type ActivityRow = (typeof raw.tourActivities)[number]["activity"];
  const sectionMap = new Map<
    string,
    { groupSlug: string; groupName: string; activities: ActivityRow[] }
  >();

  for (const ta of raw.tourActivities) {
    const g = ta.activity.group;
    if (!sectionMap.has(g.slug)) {
      sectionMap.set(g.slug, {
        groupSlug: g.slug,
        groupName: g.name,
        activities: [],
      });
    }
    sectionMap.get(g.slug)!.activities.push(ta.activity);
  }

  return { ...raw, activitySections: [...sectionMap.values()] };
}

/* ================================================================== *
 * 5. setTourActivities                                                *
 * ================================================================== */

/**
 * Replace a tour's entire activity set in one transaction.
 *
 * Throws if activityIds.length > MAX_ACTIVITIES_PER_TOUR (10).
 * The database does not enforce this limit — enforcement lives here.
 */
export async function setTourActivities(
  tourId: number,
  activityIds: number[],
): Promise<void> {
  if (activityIds.length > MAX_ACTIVITIES_PER_TOUR) {
    throw new Error(
      `A tour may not have more than ${MAX_ACTIVITIES_PER_TOUR} activities ` +
        `(got ${activityIds.length}).`,
    );
  }

  await db.transaction(async (tx) => {
    // Delete all existing links for this tour
    await tx
      .delete(tourActivitiesTable)
      .where(eq(tourActivitiesTable.tourId, tourId));

    // Re-insert in the order provided
    if (activityIds.length > 0) {
      await tx.insert(tourActivitiesTable).values(
        activityIds.map((activityId, i) => ({
          tourId,
          activityId,
          displayOrder: i,
        })),
      );
    }
  });
}

/* ================================================================== *
 * 6. getCountries                                                     *
 * ================================================================== */

export interface CountrySummary {
  id: number;
  slug: string;
  name: string;
  code: string | null;
  image: string | null;
}

/**
 * All countries ordered by display_order then alphabetically by name.
 * Used by admin destination selects.
 */
export async function getCountries(): Promise<CountrySummary[]> {
  return db
    .select({
      id: countriesTable.id,
      slug: countriesTable.slug,
      name: countriesTable.name,
      code: countriesTable.code,
      image: countriesTable.image,
    })
    .from(countriesTable)
    .orderBy(asc(countriesTable.displayOrder), asc(countriesTable.name));
}

/* ================================================================== *
 * 7. getDestinationPlaces / setDestinationPlaces                     *
 * ================================================================== */

export interface DestinationPlacesIds {
  countryIds: number[];
  locationIds: number[];
}

/**
 * Returns the country and location IDs linked to a destination,
 * ordered by their display_order. Returns empty arrays for a
 * destination that has no links — never null or undefined.
 */
export async function getDestinationPlaces(
  destinationId: number,
): Promise<DestinationPlacesIds> {
  const [countryRows, locationRows] = await Promise.all([
    db
      .select({ countryId: destinationCountriesTable.countryId })
      .from(destinationCountriesTable)
      .where(eq(destinationCountriesTable.destinationId, destinationId))
      .orderBy(asc(destinationCountriesTable.displayOrder)),
    db
      .select({ locationId: destinationLocationsTable.locationId })
      .from(destinationLocationsTable)
      .where(eq(destinationLocationsTable.destinationId, destinationId))
      .orderBy(asc(destinationLocationsTable.displayOrder)),
  ]);
  return {
    countryIds: countryRows.map((r) => r.countryId),
    locationIds: locationRows.map((r) => r.locationId),
  };
}

/**
 * Replace a destination's entire country and location link sets in one
 * transaction (delete-then-insert).
 *
 * - display_order is derived from the position in each input array.
 * - Duplicates in the input are de-duplicated before inserting (first
 *   occurrence wins, preserving order).
 * - IDs that do not exist in the reference table are silently ignored
 *   rather than throwing a FK violation.
 * - An empty array means "remove all links", not "leave unchanged".
 */
/* ================================================================== *
 * 8. listDestinationsWithCountries                                    *
 * ================================================================== */

export interface DestinationCountryRef {
  id: number;
  slug: string;
  name: string;
}

export interface DestinationListItem {
  id: number;
  slug: string | null;
  name: string;
  displayOrder: number;
  country: string | null;
  region: string | null;
  description: string | null;
  coverImage: string | null;
  createdAt: Date;
  countries: DestinationCountryRef[];
}

/**
 * Returns all destinations ordered by name, each with a `countries` array
 * (ordered by destination_countries.display_order) sourced from the
 * destination_countries join table — not the deprecated `country` text column.
 *
 * Two queries: one for the destinations, one for all their country links.
 * Grouping is done in JS so we avoid a LEFT JOIN that fans out rows.
 */
export async function listDestinationsWithCountries(): Promise<DestinationListItem[]> {
  const [destinations, links] = await Promise.all([
    db
      .select()
      .from(destinationsTable)
      .orderBy(asc(destinationsTable.name)),
    db
      .select({
        destinationId: destinationCountriesTable.destinationId,
        id: countriesTable.id,
        slug: countriesTable.slug,
        name: countriesTable.name,
      })
      .from(destinationCountriesTable)
      .innerJoin(
        countriesTable,
        eq(countriesTable.id, destinationCountriesTable.countryId),
      )
      .orderBy(
        asc(destinationCountriesTable.destinationId),
        asc(destinationCountriesTable.displayOrder),
      ),
  ]);

  const countryMap = new Map<number, DestinationCountryRef[]>();
  for (const link of links) {
    const arr = countryMap.get(link.destinationId) ?? [];
    arr.push({ id: link.id, slug: link.slug, name: link.name });
    countryMap.set(link.destinationId, arr);
  }

  return destinations.map((d) => ({
    ...d,
    countries: countryMap.get(d.id) ?? [],
  }));
}

export async function setDestinationPlaces(
  destinationId: number,
  {
    countryIds,
    locationIds,
  }: { countryIds: number[]; locationIds: number[] },
): Promise<void> {
  // De-duplicate while preserving order (first occurrence wins)
  const uniqueCountryIds = [...new Set(countryIds)];
  const uniqueLocationIds = [...new Set(locationIds)];

  await db.transaction(async (tx) => {
    // Delete both sets first so a partial failure cannot leave mixed data
    await tx
      .delete(destinationCountriesTable)
      .where(eq(destinationCountriesTable.destinationId, destinationId));
    await tx
      .delete(destinationLocationsTable)
      .where(eq(destinationLocationsTable.destinationId, destinationId));

    // Re-insert countries, silently dropping any id that does not exist
    if (uniqueCountryIds.length > 0) {
      const existing = await tx
        .select({ id: countriesTable.id })
        .from(countriesTable)
        .where(inArray(countriesTable.id, uniqueCountryIds));
      const existingSet = new Set(existing.map((r) => r.id));
      const valid = uniqueCountryIds.filter((id) => existingSet.has(id));
      if (valid.length > 0) {
        await tx.insert(destinationCountriesTable).values(
          valid.map((countryId, i) => ({
            destinationId,
            countryId,
            displayOrder: i,
          })),
        );
      }
    }

    // Re-insert locations, silently dropping any id that does not exist
    if (uniqueLocationIds.length > 0) {
      const existing = await tx
        .select({ id: locationsTable.id })
        .from(locationsTable)
        .where(inArray(locationsTable.id, uniqueLocationIds));
      const existingSet = new Set(existing.map((r) => r.id));
      const valid = uniqueLocationIds.filter((id) => existingSet.has(id));
      if (valid.length > 0) {
        await tx.insert(destinationLocationsTable).values(
          valid.map((locationId, i) => ({
            destinationId,
            locationId,
            displayOrder: i,
          })),
        );
      }
    }
  });
}
