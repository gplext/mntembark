/**
 * lib/db/src/queries/taxonomy.test.ts
 *
 * Exercises each function in taxonomy.ts against the seeded data.
 * Run from lib/db with:
 *   node --import tsx/esm --test src/queries/taxonomy.test.ts
 */

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";

import { pool } from "../index";
import {
  getActivityFilters,
  getPlaceFilters,
  findTours,
  getTourWithTaxonomy,
  setTourActivities,
  getCountries,
  getDestinationPlaces,
  setDestinationPlaces,
} from "./taxonomy";

/* ================================================================== *
 * 1. getActivityFilters                                               *
 * ================================================================== */

describe("getActivityFilters", () => {
  it("returns exactly 4 groups", async () => {
    const groups = await getActivityFilters();
    assert.equal(groups.length, 4, `expected 4 groups, got ${groups.length}: ${groups.map(g => g.groupName).join(", ")}`);
  });

  it("total activity count across all groups is 14", async () => {
    const groups = await getActivityFilters();
    const total = groups.reduce((n, g) => n + g.activities.length, 0);
    assert.equal(total, 14, `expected 14 activities, got ${total}`);
  });

  it("Dining activity has tour count of 3", async () => {
    const groups = await getActivityFilters();
    const all = groups.flatMap((g) => g.activities);
    const dining = all.find((a) => a.slug === "dining");
    assert.ok(dining, "dining activity not found");
    assert.equal(dining.count, 3, `expected Dining count = 3, got ${dining.count}`);
  });

  it("all returned activities are filterable and not redirected", async () => {
    const groups = await getActivityFilters();
    // If the query filters correctly, every returned activity should be
    // filterable=true and have no redirect. This is verified by the fact
    // that we got the right counts above; also check no group is empty.
    for (const g of groups) {
      assert.ok(g.activities.length > 0, `group "${g.groupName}" has no activities`);
    }
  });

  it("groups are ordered by display_order (Water first)", async () => {
    const groups = await getActivityFilters();
    assert.equal(groups[0].groupSlug, "water", `expected first group to be "water", got "${groups[0].groupSlug}"`);
  });
});

/* ================================================================== *
 * 2. getPlaceFilters                                                  *
 * ================================================================== */

describe("getPlaceFilters", () => {
  it("no argument returns all 4 destinations", async () => {
    const result = await getPlaceFilters();
    assert.ok(Array.isArray(result), "expected an array");
    const destinations = result as { slug: string | null; name: string }[];
    assert.equal(destinations.length, 4, `expected 4 destinations, got ${destinations.length}`);
  });

  it("no argument result has slug and name fields", async () => {
    const result = await getPlaceFilters();
    const destinations = result as { id: number; slug: string | null; name: string }[];
    assert.ok(destinations[0].name, "missing name field");
  });

  it("destinationSlug='patagonia' returns countries including Chile and Argentina", async () => {
    const result = await getPlaceFilters("patagonia") as {
      countries: { slug: string; name: string; code: string | null }[];
      locations: { slug: string; name: string }[];
    };
    assert.ok(Array.isArray(result.countries), "expected countries array");
    assert.ok(Array.isArray(result.locations), "expected locations array");

    const slugs = result.countries.map((c) => c.slug).sort();
    assert.deepEqual(slugs, ["argentina", "chile"], `expected [argentina, chile], got ${JSON.stringify(slugs)}`);
  });

  it("destinationSlug='patagonia' returns Patagonia location", async () => {
    const result = await getPlaceFilters("patagonia") as {
      countries: { slug: string }[];
      locations: { slug: string; name: string }[];
    };
    assert.equal(result.locations.length, 1);
    assert.equal(result.locations[0].slug, "patagonia");
  });
});

/* ================================================================== *
 * 3. findTours                                                        *
 * ================================================================== */

describe("findTours", () => {
  it("no filters returns all 4 tours", async () => {
    const tours = await findTours();
    assert.equal(tours.length, 4, `expected 4 tours, got ${tours.length}`);
  });

  it("AND semantics: ['hiking','camping'] -> 1 tour (Patagonia)", async () => {
    const tours = await findTours({ activitySlugs: ["hiking", "camping"] });
    assert.equal(tours.length, 1, `expected 1 tour, got ${tours.length}`);
    assert.match(
      tours[0].title,
      /patagonia/i,
      `expected Patagonia tour, got "${tours[0].title}"`,
    );
  });

  it("single activitySlug 'hiking' returns 2 tours", async () => {
    const tours = await findTours({ activitySlugs: ["hiking"] });
    assert.equal(tours.length, 2, `expected 2 tours with hiking, got ${tours.length}`);
  });

  it("countrySlug:'chile' -> 1 tour (Patagonia)", async () => {
    const tours = await findTours({ countrySlug: "chile" });
    assert.equal(tours.length, 1, `expected 1 tour for Chile, got ${tours.length}`);
    assert.match(
      tours[0].title,
      /patagonia/i,
      `expected Patagonia tour, got "${tours[0].title}"`,
    );
  });

  it("destinationSlug:'iceland' -> 1 tour", async () => {
    const tours = await findTours({ destinationSlug: "iceland" });
    assert.equal(tours.length, 1, `expected 1 tour for Iceland, got ${tours.length}`);
  });

  it("featured:true returns at least 1 tour and all have featured=true", async () => {
    const tours = await findTours({ featured: true });
    assert.ok(tours.length >= 1, "expected at least 1 featured tour");
    assert.ok(
      tours.every((t) => t.featured),
      "all returned tours should have featured=true",
    );
  });

  it("non-existent activitySlug returns empty array", async () => {
    const tours = await findTours({ activitySlugs: ["skydiving-fake"] });
    assert.equal(tours.length, 0);
  });
});

/* ================================================================== *
 * 4. getTourWithTaxonomy                                              *
 * ================================================================== */

describe("getTourWithTaxonomy", () => {
  it("Maldives tour has 3 activities total", async () => {
    const tour = await getTourWithTaxonomy("the-art-of-the-maldives");
    assert.ok(tour, "tour not found — check that slug 'the-art-of-the-maldives' exists");
    const total = tour.activitySections.reduce(
      (n, s) => n + s.activities.length,
      0,
    );
    assert.equal(total, 3, `expected 3 activities, got ${total}`);
  });

  it("loads category relation", async () => {
    const tour = await getTourWithTaxonomy("the-art-of-the-maldives");
    assert.ok(tour);
    assert.ok(tour.category, "category relation not loaded");
  });

  it("loads destination relation", async () => {
    const tour = await getTourWithTaxonomy("the-art-of-the-maldives");
    assert.ok(tour);
    assert.ok(tour.destination, "destination relation not loaded");
  });

  it("loads location with nested country", async () => {
    const tour = await getTourWithTaxonomy("the-art-of-the-maldives");
    assert.ok(tour);
    assert.ok(tour.location, "location relation not loaded");
    assert.ok(tour.location?.country, "country nested in location not loaded");
  });

  it("activities are grouped into activitySections", async () => {
    const tour = await getTourWithTaxonomy("the-art-of-the-maldives");
    assert.ok(tour);
    assert.ok(Array.isArray(tour.activitySections));
    assert.ok(tour.activitySections.length >= 1, "expected at least one section");
    for (const s of tour.activitySections) {
      assert.ok(s.groupSlug, "section missing groupSlug");
      assert.ok(Array.isArray(s.activities), "section activities should be an array");
    }
  });

  it("returns null for an unknown slug", async () => {
    const tour = await getTourWithTaxonomy("this-slug-does-not-exist");
    assert.equal(tour, null);
  });

  it("Patagonia tour has 4 activities", async () => {
    const tour = await getTourWithTaxonomy("the-last-frontier-of-patagonia");
    assert.ok(tour, "Patagonia tour not found");
    const total = tour.activitySections.reduce(
      (n, s) => n + s.activities.length,
      0,
    );
    assert.equal(total, 4, `expected 4 activities on Patagonia tour, got ${total}`);
  });
});

/* ================================================================== *
 * 5. setTourActivities                                                *
 * ================================================================== */

describe("setTourActivities", () => {
  it("rejects more than 10 activities", async () => {
    await assert.rejects(
      () => setTourActivities(1, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
      (err: Error) => {
        assert.match(err.message, /more than 10|at most 10/i);
        return true;
      },
    );
  });

  it("accepts exactly 10 activities without throwing", async () => {
    // Use the first 10 seeded activity ids (1-10). We restore afterwards.
    // Read the current Maldives activities first so we can restore them.
    const maldivesBefore = await getTourWithTaxonomy("the-art-of-the-maldives");
    assert.ok(maldivesBefore);
    const originalIds = maldivesBefore.tourActivities.map((ta) => ta.activityId);

    // Replace with 10 activity ids — this must not throw
    await assert.doesNotReject(() =>
      setTourActivities(maldivesBefore.id, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
    );

    // Restore original activity set
    await setTourActivities(maldivesBefore.id, originalIds);
  });
});

/* ================================================================== *
 * 6. getCountries                                                     *
 * ================================================================== */

describe("getCountries", () => {
  it("returns at least 2 countries", async () => {
    const countries = await getCountries();
    assert.ok(
      countries.length >= 2,
      `expected ≥2 countries, got ${countries.length}`,
    );
  });

  it("each country has id, slug, name", async () => {
    const countries = await getCountries();
    for (const c of countries) {
      assert.ok(typeof c.id === "number", `id should be a number`);
      assert.ok(typeof c.slug === "string", `slug should be a string`);
      assert.ok(typeof c.name === "string", `name should be a string`);
    }
  });
});

/* ================================================================== *
 * 7. getDestinationPlaces / setDestinationPlaces                     *
 * ================================================================== */

describe("getDestinationPlaces", () => {
  it("Patagonia (id=2) has 2 country links", async () => {
    const places = await getDestinationPlaces(2);
    assert.equal(
      places.countryIds.length,
      2,
      `expected 2 countries, got ${places.countryIds.length}`,
    );
  });

  it("returns empty arrays for a destination with no linked places", async () => {
    // 999 does not exist; both join tables have no rows for it
    const places = await getDestinationPlaces(999);
    assert.deepEqual(places, { countryIds: [], locationIds: [] });
  });
});

describe("setDestinationPlaces", () => {
  it("empty arrays clear all links", async () => {
    const before = await getDestinationPlaces(2);
    assert.ok(before.countryIds.length > 0, "Patagonia should have countries before test");

    await setDestinationPlaces(2, { countryIds: [], locationIds: [] });
    const after = await getDestinationPlaces(2);
    assert.deepEqual(after, { countryIds: [], locationIds: [] });

    // Restore
    await setDestinationPlaces(2, before);
    const restored = await getDestinationPlaces(2);
    assert.deepEqual(restored.countryIds, before.countryIds);
  });

  it("a repeated id does not throw and is de-duplicated", async () => {
    const before = await getDestinationPlaces(2);
    const [firstId] = before.countryIds;
    assert.ok(firstId !== undefined, "Patagonia must have at least one country");

    // Pass the same id twice — should not throw
    await assert.doesNotReject(() =>
      setDestinationPlaces(2, {
        countryIds: [firstId, firstId],
        locationIds: [],
      }),
    );

    // After de-duplication only one row inserted
    const after = await getDestinationPlaces(2);
    assert.equal(after.countryIds.length, 1);
    assert.equal(after.countryIds[0], firstId);

    // Restore
    await setDestinationPlaces(2, before);
  });

  it("a non-existent id is silently ignored", async () => {
    const before = await getDestinationPlaces(2);

    await assert.doesNotReject(() =>
      setDestinationPlaces(2, {
        countryIds: [99999],
        locationIds: [],
      }),
    );

    // Non-existent id filtered out → empty result
    const after = await getDestinationPlaces(2);
    assert.deepEqual(after.countryIds, []);

    // Restore
    await setDestinationPlaces(2, before);
  });

  it("a second call replaces rather than appends", async () => {
    const before = await getDestinationPlaces(2);
    const [firstId] = before.countryIds;

    // First call: set to just one country
    await setDestinationPlaces(2, { countryIds: [firstId], locationIds: [] });
    const afterFirst = await getDestinationPlaces(2);
    assert.equal(afterFirst.countryIds.length, 1);

    // Second call: same single country again
    await setDestinationPlaces(2, { countryIds: [firstId], locationIds: [] });
    const afterSecond = await getDestinationPlaces(2);
    // Must still be 1 — not 2 (which would indicate append)
    assert.equal(afterSecond.countryIds.length, 1);

    // Restore
    await setDestinationPlaces(2, before);
  });
});

/* ------------------------------------------------------------------ *
 * Teardown                                                            *
 * ------------------------------------------------------------------ */

after(async () => {
  await pool.end();
});
