#!/usr/bin/env node
/**
 * Load the world content — regions, countries, places and attractions — into
 * a running MNT Embark site, through the same admin API the panel uses.
 *
 *   node scripts/import-attractions.mjs --url http://localhost:8080 --password 'YOUR_ADMIN_PASSWORD'
 *   node scripts/import-attractions.mjs --url https://mntembark.com --password '...' --dry-run
 *   node scripts/import-attractions.mjs --url ... --password '...' --country "Turkey,Japan"
 *   node scripts/import-attractions.mjs --url ... --password '...' --update
 *   node scripts/import-attractions.mjs --url ... --password '...' --flags
 *
 * Reads, from content/:
 *   regions.csv                 → Destinations (Western Europe, East Asia …) linked to their countries
 *   countries.csv               → Countries
 *   locations.csv               → Locations (cities and areas)
 *   attractions.csv             → Attractions
 *   attraction_steps.csv        → their steps (How to reach, What to prepare, …)
 *   attraction_categories.csv   → their categories (first = main)
 *   attraction_activities.csv   → their activities
 *
 * Safe to run again and again:
 *   - anything missing is created;
 *   - anything already there keeps what you typed in the admin panel. Only
 *     empty fields are filled in;
 *   - --flags only copies Featured, the Standard/Special/Exclusive tag and
 *     the display order from attractions.csv onto attractions already there;
 *   - --update rewrites the text from the CSVs, but still never replaces a
 *     real photo you uploaded with a placeholder. Images are only written
 *     where the site still shows a placeholder (or nothing).
 *
 * Images: a cell that is empty or starts with /api/placeholder.svg is a
 * placeholder. Put a real URL in the CSV (or upload in the admin panel) and
 * that one wins.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CONTENT = join(dirname(fileURLToPath(import.meta.url)), "..", "content");

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const BASE = (arg("url", process.env.SITE_URL) ?? "").replace(/\/$/, "");
const PASSWORD = arg("password", process.env.ADMIN_PASSWORD);
const EMAIL = arg("email");
const DRY = args.includes("--dry-run");
const UPDATE = args.includes("--update");
/** Only sync featured / classification / display order of existing attractions. */
const FLAGS = args.includes("--flags");
const ONLY = arg("country") ? new Set(arg("country").split(",").map((s) => s.trim().toLowerCase())) : null;

if (!BASE || !PASSWORD) {
  console.error(
    "Usage: node scripts/import-attractions.mjs --url http://localhost:8080 --password YOUR_ADMIN_PASSWORD [--dry-run] [--update] [--country \"Turkey,Japan\"]",
  );
  process.exit(1);
}

/* ------------------------------------------------------------------- csv */

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
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim().replace(/^﻿/, ""), (r[i] ?? "").trim()])));
}
const read = (file) => parseCsv(readFileSync(join(CONTENT, file), "utf8"));
const list = (v) => (v ?? "").split("|").map((s) => s.trim()).filter(Boolean);
const bool = (v, d = false) => (v === "" || v == null ? d : /^(true|yes|1)$/i.test(v));
const num = (v) => (v === "" || v == null ? null : Number(v));
const key = (s) => (s ?? "").trim().toLowerCase();
const isPlaceholder = (v) => !v || String(v).startsWith("/api/placeholder.svg");

/* ------------------------------------------------------------------- api */

let cookie = "";
async function api(method, path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const set = res.headers.getSetCookie?.() ?? [];
  if (set.length) cookie = set.map((c) => c.split(";")[0]).join("; ");
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* not json */ }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${data?.error ?? data?.message ?? text.slice(0, 300)}`);
  return data;
}
const write = async (method, path, body) => (DRY ? { id: -1 } : api(method, path, body));

const tally = { created: 0, updated: 0, kept: 0, failed: 0 };
const log = (sym, kind, name, extra = "") => console.log(`  ${sym} ${kind.padEnd(10)} ${name}${extra ? `  (${extra})` : ""}`);

/** Only the fields whose site value is empty (or a placeholder image). With --update, text too. */
function changes(current, wanted, imageFields = []) {
  const out = {};
  for (const [k, v] of Object.entries(wanted)) {
    if (v === undefined || v === null || v === "") continue;
    if (imageFields.includes(k)) {
      if (isPlaceholder(current[k]) && current[k] !== v) out[k] = v;
    } else if (current[k] === null || current[k] === undefined || current[k] === "" || (UPDATE && current[k] !== v)) {
      out[k] = v;
    }
  }
  return out;
}

/* ---------------------------------------------------------------- import */

console.log(`\n${DRY ? "DRY RUN — nothing will be written" : UPDATE ? "Importing (with --update)" : "Importing"} to ${BASE}\n`);
await api("POST", "/admin/login", EMAIL ? { email: EMAIL, password: PASSWORD } : { password: PASSWORD });
console.log("Signed in.\n");

const countriesCsv = read("countries.csv").filter((c) => !ONLY || ONLY.has(key(c.name)));
const locationsCsv = read("locations.csv").filter((l) => !ONLY || ONLY.has(key(l.country)));
const attractionsCsv = read("attractions.csv").filter((a) => !ONLY || ONLY.has(key(a.country)));
const stepsCsv = read("attraction_steps.csv");
const catsCsv = read("attraction_categories.csv");
const actsCsv = read("attraction_activities.csv");

/* -- countries -- */
console.log("Countries");
const countries = (await api("GET", "/countries")) ?? [];
const countryId = new Map(countries.map((c) => [key(c.name), c.id]));
async function ensureCountry(row) {
  const wanted = {
    name: row.name,
    slug: row.slug || undefined,
    code: row.code || undefined,
    description: row.description || undefined,
    image: row.image || undefined,
    displayOrder: num(row.displayOrder) ?? undefined,
  };
  const hit = countries.find((c) => key(c.name) === key(row.name) || (row.slug && c.slug === row.slug));
  if (!hit) {
    const made = await write("POST", "/countries", wanted);
    countryId.set(key(row.name), made.id);
    tally.created++; log("+", "country", row.name);
    return;
  }
  countryId.set(key(row.name), hit.id);
  const { name, slug, ...rest } = wanted;
  const diff = changes(hit, rest, ["image"]);
  if (Object.keys(diff).length) {
    await write("PATCH", `/countries/${hit.id}`, diff);
    tally.updated++; log("~", "country", row.name, Object.keys(diff).join(", "));
  } else { tally.kept++; log("·", "country", row.name, "already there"); }
}
for (const c of countriesCsv) await ensureCountry(c);

/* -- locations -- */
console.log("\nLocations");
const locations = (await api("GET", "/locations")) ?? [];
const locKey = (country, name) => `${key(country)}|${key(name)}`;
const locationId = new Map(locations.map((l) => [locKey(l.countryName, l.name), l.id]));
async function ensureLocation(row) {
  let cId = countryId.get(key(row.country));
  if (cId === undefined) {
    // A country named only in attractions.csv (e.g. the Tanzania example).
    await ensureCountry({ name: row.country });
    cId = countryId.get(key(row.country));
  }
  const wanted = {
    description: row.description || undefined,
    image: row.image || undefined,
    displayOrder: num(row.displayOrder) ?? undefined,
  };
  const hit = locations.find((l) => key(l.name) === key(row.name) && key(l.countryName) === key(row.country));
  if (!hit) {
    const made = await write("POST", "/locations", { name: row.name, countryId: cId > 0 ? cId : undefined, ...wanted });
    locationId.set(locKey(row.country, row.name), made.id);
    tally.created++; log("+", "location", `${row.name}, ${row.country}`);
    return;
  }
  const diff = changes(hit, wanted, ["image"]);
  if (Object.keys(diff).length) {
    await write("PATCH", `/locations/${hit.id}`, diff);
    tally.updated++; log("~", "location", `${row.name}, ${row.country}`, Object.keys(diff).join(", "));
  } else { tally.kept++; log("·", "location", `${row.name}, ${row.country}`, "already there"); }
}
for (const l of locationsCsv) await ensureLocation(l);

/* -- regions (destinations) -- */
console.log("\nDestinations (regions)");
const regionsCsv = read("regions.csv").filter((r) => !ONLY || list(r.countries).some((c) => ONLY.has(key(c))));
const destinations = (await api("GET", "/destinations")) ?? [];
for (const r of regionsCsv) {
  const names = list(r.countries);
  const ids = names.map((c) => countryId.get(key(c))).filter((id) => id !== undefined && id > 0);
  // Every city and area of those countries goes on the region too.
  const locIds = [...locationId.entries()]
    .filter(([k]) => names.some((c) => k.startsWith(`${key(c)}|`)))
    .map(([, id]) => id)
    .filter((id) => id > 0);
  const locCount = locationsCsv.filter((l) => names.some((c) => key(c) === key(l.country))).length;
  const hit = destinations.find((d) => d.slug === r.slug || key(d.name) === key(r.name));
  let id = hit?.id;
  if (!hit) {
    const made = await write("POST", "/destinations", {
      slug: r.slug, name: r.name, description: r.description, coverImage: r.coverImage, displayOrder: num(r.displayOrder) ?? 0,
    });
    id = made.id;
    tally.created++; log("+", "region", r.name);
  } else {
    const diff = changes(hit, { description: r.description, coverImage: r.coverImage }, ["coverImage"]);
    if (Object.keys(diff).length) {
      await write("PATCH", `/destinations/${hit.id}`, diff);
      tally.updated++; log("~", "region", r.name, Object.keys(diff).join(", "));
    } else { tally.kept++; log("·", "region", r.name, "already there"); }
  }
  // Add this region's countries and places; never remove ones you linked by hand.
  if (id > 0) {
    const now = (await api("GET", `/destinations/${id}/places`)) ?? { countryIds: [], locationIds: [] };
    const hadC = now.countryIds ?? [], hadL = now.locationIds ?? [];
    const c = [...new Set([...hadC, ...ids])], l = [...new Set([...hadL, ...locIds])];
    if (c.length !== hadC.length || l.length !== hadL.length) {
      await write("PUT", `/destinations/${id}/places`, { countryIds: c, locationIds: l });
      console.log(`      ↳ ${DRY ? "would link" : "linked"} ${c.length - hadC.length} countries, ${l.length - hadL.length} places`);
    }
  } else if (DRY) console.log(`      ↳ would link ${names.length} countries, ${locCount} places`);
}

/* -- taxonomy lookups -- */
const missing = new Set();
const categories = (await api("GET", "/categories")) ?? [];
const catId = new Map(categories.map((c) => [c.slug, c.id]));
const actsRaw = (await api("GET", "/admin/activities")) ?? [];
const acts = Array.isArray(actsRaw) ? actsRaw : (actsRaw.activities ?? []);
const actId = new Map(acts.map((a) => [a.slug, a.id]));

/*
 * Activities the attractions use but the site does not have yet are created
 * from activities.csv (and their group from activity_groups.csv), so every
 * attraction gets all of its activities attached.
 */
console.log("\nActivities");
const neededActs = new Set(
  actsCsv.filter((l) => attractionsCsv.some((a) => a.slug === l.attraction_slug)).map((l) => l.activity_slug),
);
const actDefs = read("activities.csv");
const groupDefs = read("activity_groups.csv");
const groups = (await api("GET", "/admin/activity-groups")) ?? [];
const groupId = new Map();
for (const g of groups) { groupId.set(g.slug, g.id); groupId.set(key(g.name), g.id); }
for (const slug of neededActs) {
  if (actId.has(slug)) { tally.kept++; continue; }
  const def = actDefs.find((d) => d.slug === slug);
  if (!def) { missing.add(slug); continue; }
  try {
    const gDef = groupDefs.find((g) => g.slug === def.group_slug);
    let gId = groupId.get(def.group_slug) ?? (gDef ? groupId.get(key(gDef.name)) : undefined);
    if (gId === undefined && gDef) {
      const made = await write("POST", "/admin/activity-groups", {
        slug: gDef.slug, name: gDef.name, description: gDef.description, icon: gDef.icon,
        selectionMode: gDef.selectionMode || "multiple", displayOrder: num(gDef.displayOrder) ?? 0,
      });
      gId = made.id;
      groupId.set(gDef.slug, gId); groupId.set(key(gDef.name), gId);
      tally.created++; log("+", "group", gDef.name);
    }
    const made = await write("POST", "/admin/activities", {
      groupId: gId, slug: def.slug, name: def.name, description: def.description, coverImage: def.coverImage,
      icon: def.icon, aliases: list(def.aliases), isFilterable: bool(def.isFilterable, true),
      isIndexable: bool(def.isIndexable), displayOrder: num(def.displayOrder) ?? 0,
    });
    actId.set(slug, made.id);
    tally.created++; log("+", "activity", def.name);
  } catch (err) {
    tally.failed++; missing.add(slug); log("!", "activity", def.name, err.message);
  }
}
const ordered = (rows, col, map) =>
  rows
    .sort((a, b) => Number(a.displayOrder) - Number(b.displayOrder))
    .map((r) => { const id = map.get(r[col]); if (id === undefined) missing.add(r[col]); return id; })
    .filter((id) => id !== undefined && id > 0);

/* -- attractions -- */
console.log("\nAttractions");
const existing = (await api("GET", "/admin/attractions")) ?? [];
for (const a of attractionsCsv) {
  try {
    let locId = locationId.get(locKey(a.country, a.location));
    if (locId === undefined) {
      await ensureLocation({ name: a.location, country: a.country });
      locId = locationId.get(locKey(a.country, a.location));
    }
    const hit = existing.find((e) => e.slug === a.slug);
    const csvSteps = stepsCsv
      .filter((s) => s.attraction_slug === a.slug)
      .sort((x, y) => Number(x.step_order) - Number(y.step_order))
      .map((s, i) => {
        // Keep photos already added to this step in the admin panel.
        const had = hit?.steps?.[i];
        const imgs = list(s.images);
        return { kind: s.kind, title: s.title, description: s.description, images: imgs.length ? imgs : (had?.images ?? []) };
      });
    const body = {
      slug: a.slug,
      name: a.name,
      summary: a.summary || null,
      description: a.description,
      coverImage: a.coverImage,
      images: list(a.images),
      locationId: locId > 0 ? locId : 1,
      classification: a.classification || "standard",
      featured: bool(a.featured),
      visitDuration: a.visitDuration || null,
      priceFrom: num(a.priceFrom),
      hotelsAvailable: bool(a.hotelsAvailable),
      stayNote: a.stayNote || null,
      steps: csvSteps,
      isActive: bool(a.isActive, true),
      displayOrder: num(a.displayOrder) ?? 0,
      categoryIds: ordered(catsCsv.filter((c) => c.attraction_slug === a.slug), "category_slug", catId),
      activityIds: ordered(actsCsv.filter((c) => c.attraction_slug === a.slug), "activity_slug", actId),
    };

    if (!hit) {
      await write("POST", "/admin/attractions", body);
      tally.created++; log("+", "attraction", `${a.name} — ${a.location}, ${a.country}`);
      continue;
    }
    if (FLAGS && !UPDATE) {
      const patch = {};
      if (hit.featured !== body.featured) patch.featured = body.featured;
      if (hit.classification !== body.classification) patch.classification = body.classification;
      if (hit.displayOrder !== body.displayOrder) patch.displayOrder = body.displayOrder;
      if (Object.keys(patch).length) {
        await write("PATCH", `/admin/attractions/${hit.id}`, patch);
        tally.updated++; log("~", "attraction", a.name, Object.entries(patch).map(([k, v]) => `${k}: ${v}`).join(", "));
      } else { tally.kept++; }
      continue;
    }
    if (!UPDATE) {
      // Fill a missing cover and add missing categories/activities; keep everything else as you left it.
      const patch = {};
      if (isPlaceholder(hit.coverImage) && hit.coverImage !== a.coverImage && !isPlaceholder(a.coverImage)) patch.coverImage = a.coverImage;
      const hasC = (hit.categories ?? []).map((c) => c.id), hasA = (hit.activities ?? []).map((x) => x.id);
      const allC = [...new Set([...hasC, ...body.categoryIds])].slice(0, 5);
      const allA = [...new Set([...hasA, ...body.activityIds])].slice(0, 10);
      if (allC.length > hasC.length) patch.categoryIds = allC;
      if (allA.length > hasA.length) patch.activityIds = allA;
      if (Object.keys(patch).length) {
        await write("PATCH", `/admin/attractions/${hit.id}`, patch);
        tally.updated++; log("~", "attraction", a.name, Object.keys(patch).join(", "));
      } else { tally.kept++; log("·", "attraction", a.name, "already there"); }
      continue;
    }
    const { slug, ...patch } = body;
    if (!isPlaceholder(hit.coverImage) && isPlaceholder(a.coverImage)) delete patch.coverImage;
    if ((hit.images ?? []).length && !patch.images.length) delete patch.images;
    await write("PATCH", `/admin/attractions/${hit.id}`, patch);
    tally.updated++; log("~", "attraction", a.name, "text, steps, tags");
  } catch (err) {
    tally.failed++; log("!", "attraction", a.name, err.message);
  }
}

console.log(
  `\n${DRY ? "Would create" : "Created"} ${tally.created}, ${DRY ? "would update" : "updated"} ${tally.updated}, left ${tally.kept} as they were${tally.failed ? `, ${tally.failed} FAILED (see ! above)` : ""}.`,
);
if (missing.size) console.log(`Not attached (no such category/activity): ${[...missing].join(", ")}  — add them in the admin panel, then run again.`);
if (DRY) console.log("Run again without --dry-run to apply.");
