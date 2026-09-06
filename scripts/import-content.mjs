#!/usr/bin/env node
/**
 * Load the content CSVs into a running MNT Embark site.
 *
 * Runs against the public HTTPS API rather than the database, which means it
 * works from any machine with Node and needs no access to the Coolify host, no
 * redeploy and no Dockerfile change. It authenticates the same way you do.
 *
 *   node scripts/import-content.mjs --url https://mntembark.com --password '...'
 *   node scripts/import-content.mjs --url https://mntembark.com --password '...' --dry-run
 *
 * Safe to run more than once. Everything is matched on its natural key —
 * slug for tours and activities, name for categories and destinations — and
 * anything already present is left alone rather than duplicated. Edit a CSV,
 * run it again, and only the new rows are created.
 *
 * Order matters: a tour cannot reference a destination that does not exist yet,
 * and an activity cannot exist without its group.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CONTENT = join(dirname(fileURLToPath(import.meta.url)), "..", "content");

/* ------------------------------------------------------------------ args */

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = (arg("url", process.env.SITE_URL) ?? "").replace(/\/$/, "");
const PASSWORD = arg("password", process.env.ADMIN_PASSWORD);
const EMAIL = arg("email", "superadmin@mntembark.internal");
const DRY = args.includes("--dry-run");

if (!BASE || !PASSWORD) {
  console.error("Usage: node scripts/import-content.mjs --url https://your-site --password YOUR_ADMIN_PASSWORD [--dry-run]");
  process.exit(1);
}

/* ------------------------------------------------------------------- csv */

/** RFC4180 enough: handles quoted fields containing commas and newlines. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((c) => c !== ""));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

const read = (file) => parseCsv(readFileSync(join(CONTENT, file), "utf8"));
/** Multi-value cells are pipe-separated so they survive a spreadsheet round trip. */
const list = (v) => (v ?? "").split("|").map((s) => s.trim()).filter(Boolean);

/**
 * Build a slug the API will accept: slugSchema is
 * /^[a-z0-9]+(?:-[a-z0-9]+)*$/, min 2, max 120.
 *
 * The NFD pass matters — "Galápagos" without it slugs to "gal-pagos", because
 * the accented character is stripped as punctuation rather than folded to its
 * base letter.
 */
const slugify = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);

/* ------------------------------------------------------------------- api */

let cookie = "";

async function api(method, path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // express-session hands back the session on login; every later call needs it.
  const set = res.headers.getSetCookie?.() ?? [];
  if (set.length) cookie = set.map((c) => c.split(";")[0]).join("; ");

  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* not json */ }

  if (!res.ok) {
    // The server's own words. "duplicate key value violates unique constraint"
    // tells you what to fix; "request failed" starts a search.
    const msg = data?.error ?? data?.message ?? text.slice(0, 300);
    throw new Error(`${method} ${path} → ${res.status}: ${msg}`);
  }
  return data;
}

/* --------------------------------------------------------------- helpers */

let created = 0, skipped = 0;

function note(kind, name, existed) {
  if (existed) { skipped++; console.log(`  · ${kind} "${name}" already there`); }
  else { created++; console.log(`  ${DRY ? "would create" : "+"} ${kind} "${name}"`); }
}

/** Create only if absent. Returns the id either way. */
async function ensure(kind, name, existing, keyOf, path, payload) {
  const hit = existing.find((e) => keyOf(e) === name);
  if (hit) { note(kind, name, true); return hit.id; }
  note(kind, name, false);
  if (DRY) return -1;
  const made = await api("POST", path, payload);
  return made?.id ?? made?.data?.id;
}

/* ---------------------------------------------------------------- import */

console.log(`\n${DRY ? "DRY RUN — nothing will be written" : "Importing"} to ${BASE}\n`);

await api("POST", "/admin/login", { email: EMAIL, password: PASSWORD });
console.log("Signed in.\n");

// -- destinations ----------------------------------------------------------
console.log("Destinations");
const existingDest = (await api("GET", "/destinations")) ?? [];
const destIds = new Map();
for (const d of read("destinations.csv")) {
  destIds.set(d.name, await ensure("destination", d.name, existingDest, (e) => e.name, "/destinations", {
    slug: slugify(d.name),
    name: d.name,
    country: d.country,
    region: d.region,
    description: d.description,
    coverImage: d.coverImage,
  }));
}

// -- categories ------------------------------------------------------------
// These already exist from the original seed; looked up, not created.
console.log("\nCategories");
const existingCat = (await api("GET", "/categories")) ?? [];
const catIds = new Map(existingCat.map((c) => [c.name, c.id]));
for (const name of new Set(read("tours.csv").map((t) => t.category))) {
  if (catIds.has(name)) console.log(`  · category "${name}" already there`);
  else console.log(`  ! category "${name}" is MISSING — create it in the admin panel first`);
}

// -- activity groups -------------------------------------------------------
console.log("\nActivity groups");
// Not wrapped in a catch: a failure here must stop the run, because an empty
// list would look like "nothing exists yet" and try to recreate every group.
const existingGroups = (await api("GET", "/admin/activity-groups")) ?? [];
const groupIds = new Map();
for (const g of read("activity_groups.csv")) {
  groupIds.set(g.slug, await ensure("group", g.name, existingGroups, (e) => e.name, "/admin/activity-groups", {
    slug: g.slug,
    name: g.name,
    description: g.description,
    icon: g.icon,
    selectionMode: g.selectionMode,
    displayOrder: Number(g.displayOrder),
  }));
}

// -- activities ------------------------------------------------------------
console.log("\nActivities");
// /admin/activities, not /activities — the public one nests activities inside
// their groups, so a flat scan of it finds nothing and every slug looks new.
const existingActs = (await api("GET", "/admin/activities")) ?? [];
const actList = Array.isArray(existingActs) ? existingActs : (existingActs.activities ?? []);
const actIds = new Map(actList.map((a) => [a.slug, a.id]));
for (const a of read("activities.csv")) {
  if (actIds.has(a.slug)) { note("activity", a.name, true); continue; }
  note("activity", a.name, false);
  if (DRY) continue;
  const made = await api("POST", "/admin/activities", {
    groupId: groupIds.get(a.group_slug),
    slug: a.slug,
    name: a.name,
    description: a.description,
    coverImage: a.coverImage,
    icon: a.icon,
    aliases: list(a.aliases),
    isFilterable: a.isFilterable === "true",
    isIndexable: a.isIndexable === "true",
    displayOrder: Number(a.displayOrder),
  });
  actIds.set(a.slug, made?.id ?? made?.data?.id);
}

// -- tours -----------------------------------------------------------------
console.log("\nTours");
const steps = read("itinerary_steps.csv");
const links = read("tour_activities.csv");
const existingTours = (await api("GET", "/tours")) ?? [];
const tourList = Array.isArray(existingTours) ? existingTours : (existingTours.tours ?? existingTours.data ?? []);

/*
 * Matched on title, not slug, and that is not a preference.
 *
 * CreateTourBody has no `slug` field, so the API silently drops the one we
 * send and every tour it creates is stored with an empty slug. Checking
 * against slug therefore matches nothing on a second run and quietly inserts
 * the whole set again. Title is the only key that survives the round trip
 * until the spec is fixed.
 */
const haveTitles = new Set(tourList.map((t) => t.title));

for (const t of read("tours.csv")) {
  if (haveTitles.has(t.title)) { note("tour", t.title, true); continue; }
  note("tour", t.title, false);
  if (DRY) continue;

  const mine = steps
    .filter((s) => s.tour_slug === t.slug)
    .sort((a, b) => Number(a.step_order) - Number(b.step_order))
    .map((s) => ({
      type: s.type,
      title: s.title,
      description: s.description,
      image: s.image || null,
      images: list(s.images),
    }));

  const made = await api("POST", "/tours", {
    slug: t.slug,
    title: t.title,
    description: t.description,
    coverImage: t.coverImage,
    images: list(t.images),
    location: t.location,
    durationDays: Number(t.durationDays),
    priceFrom: Number(t.priceFrom),
    featured: t.featured === "true",
    categoryId: catIds.get(t.category) ?? null,
    destinationId: destIds.get(t.destination) ?? null,
    locationId: null,
    itinerarySteps: mine,
  });

  const tourId = made?.id ?? made?.data?.id;
  const mineActs = links
    .filter((l) => l.tour_slug === t.slug)
    .sort((a, b) => Number(a.displayOrder) - Number(b.displayOrder))
    .map((l) => actIds.get(l.activity_slug))
    .filter((id) => id !== undefined);

  if (tourId && mineActs.length) {
    await api("PUT", `/tours/${tourId}/activities`, { activityIds: mineActs });
    console.log(`    ↳ ${mineActs.length} activities attached, ${mine.length} itinerary steps`);
  }
}

console.log(`\n${DRY ? "Would create" : "Created"} ${created}, left ${skipped} already-present alone.`);
if (DRY) console.log("Re-run without --dry-run to apply.");

/*
 * Two things the API drops on the floor. Both are in the generated request
 * schema rather than the database, which already has columns for them, so both
 * are fixed in openapi.yaml and a regenerate — not here.
 */
console.log(`
Note — two fields the API discards on create, so they are not in your site yet:

  slug            CreateTourBody has no slug field, so every tour created
                  through this script OR the admin panel is stored with an
                  empty slug. /tours/slug/:slug cannot find them.

  step images[]   Itinerary steps keep only the single "image". The multiple
                  images per step in itinerary_steps.csv are dropped, so the
                  per-step carousels the admin form offers stay empty.

Both live in lib/api-spec/openapi.yaml.`);
