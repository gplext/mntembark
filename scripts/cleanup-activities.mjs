#!/usr/bin/env node
/**
 * Tidy the activity taxonomy on a running MNT Embark site.
 *
 *   node scripts/cleanup-activities.mjs --url https://mntembark.com --password '...'
 *   node scripts/cleanup-activities.mjs --url https://mntembark.com --password '...' --apply
 *   node scripts/cleanup-activities.mjs --url https://mntembark.com --password '...' --apply --images
 *
 * DRY RUN IS THE DEFAULT, deliberately. The importer defaults to writing
 * because creating a row you did not want is a delete away from fixed. This
 * script deletes, and a deleted activity takes its tour links with it. So
 * nothing happens here until you pass --apply.
 *
 * The server refuses to delete an activity that is on any tour (409) and a
 * group that still holds activities (409). This script does not fight either
 * guard — it reports what they blocked, which is the useful information.
 *
 * Everything below is editable. It is a plan, not a policy.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";

/* ------------------------------------------------------------------ plan */

/**
 * Activities in the wrong group. slug -> the group NAME it belongs in.
 *
 * Name rather than slug on purpose. Groups that already existed keep their
 * original slugs — the seeded "Land & Adventure" is `land-adventure`, not the
 * `land-and-adventure` the import CSV proposed, because the importer matched
 * it by name and reused it. Keying on slug here silently found nothing.
 */
const REGROUP = {
  hiking: "Land & Adventure",
  cycling: "Land & Adventure",
};

/** Activities to remove. Anything on a tour will be refused and reported. */
const DELETE_ACTIVITIES = [
  // Left over from earlier experimenting.
  "snow-jumping",
  // Off-brand for private conservancies and polar expeditions.
  "theatre",
  "concerts",
  "theme-parks",
  "cafes",
  // Duplicates of something more specific that already exists.
  "dining",            // -> private-dining
  "desert",            // -> desert-exploration
  "walking",           // -> hiking
  "wildlife-tracking", // -> game-drives / rhino-tracking
];

/**
 * Judgement calls, left in place on purpose. Swimming is reasonable on a beach
 * itinerary, camping on a safari one, and off-road is arguably distinct from a
 * game drive. Move a slug up into the list above if you disagree.
 */
const KEPT_ON_PURPOSE = ["swimming", "camping", "off-road"];

/** Groups to remove once they are empty. */
const DELETE_GROUPS = [
  "Beyngee Jumping",
  "Wildlife and Nature",
  "Culture & Entertainment",
  "Food & Drink",
];

/** Names that read oddly beside the newer entries. slug -> new name. */
const RENAME = {
  diving: "Diving",              // was "Diving & Snorkelling", beside a separate Snorkelling
  canoeing: "Canoeing",          // was "Canoeing & Kayaking"
};

/* ------------------------------------------------------------------ args */

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(`--${n}`); return i !== -1 && args[i + 1] ? args[i + 1] : d; };

const BASE = (arg("url", process.env.SITE_URL) ?? "").replace(/\/$/, "");
const PASSWORD = arg("password", process.env.ADMIN_PASSWORD);
const APPLY = args.includes("--apply");
const IMAGES = args.includes("--images");

if (!BASE || !PASSWORD) {
  console.error("Usage: node scripts/cleanup-activities.mjs --url https://your-site --password PASS [--apply] [--images]");
  process.exit(1);
}

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
  try { data = JSON.parse(text); } catch { /* 204 and friends */ }

  // 409 is a designed answer here, not a failure — hand it back to the caller.
  if (res.status === 409) return { conflict: data?.error ?? text.slice(0, 200) };
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${data?.error ?? text.slice(0, 200)}`);
  return data ?? {};
}

/* --------------------------------------------------------- image sources */

/**
 * Parse the URLs out of activity_image_urls.txt rather than duplicating them
 * here, so the file stays the single place they are edited.
 */
function imageUrls() {
  const f = join(dirname(fileURLToPath(import.meta.url)), "..", "content", "activity_image_urls.txt");
  if (!existsSync(f)) return {};
  const out = {};
  const lines = readFileSync(f, "utf8").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = /^\S.*\((?<slug>[a-z0-9-]+)\)\s*$/.exec(lines[i]);
    const url = (lines[i + 1] ?? "").trim();
    if (m && url.startsWith("https://images.unsplash.com/")) out[m.groups.slug] = url;
  }
  return out;
}

/* ----------------------------------------------------------------- start */

console.log(`\n${APPLY ? "APPLYING to" : "DRY RUN — nothing will change on"} ${BASE}\n`);

await api("POST", "/admin/login", { email: "superadmin@mntembark.internal", password: PASSWORD });

const groups = await api("GET", "/admin/activity-groups");
const acts = await api("GET", "/admin/activities");
const groupByName = new Map(groups.map((g) => [g.name, g]));
const groupBySlug = new Map(groups.map((g) => [g.slug, g]));
const actBySlug = new Map(acts.map((a) => [a.slug, a]));

console.log(`Found ${groups.length} groups, ${acts.length} activities.\n`);

const done = [], blocked = [], missing = [];
const act = (s) => (APPLY ? "" : "would ");

/* 1. Re-group, so the groups being deleted below can actually empty out. */
console.log("Re-group");
for (const [slug, targetName] of Object.entries(REGROUP)) {
  const a = actBySlug.get(slug);
  const g = groupByName.get(targetName) ?? groupBySlug.get(targetName);
  if (!a) { missing.push(`activity "${slug}"`); console.log(`  ? ${slug} not found`); continue; }
  if (!g) { missing.push(`group "${targetName}"`); console.log(`  ? group "${targetName}" not found`); continue; }
  if (a.groupId === g.id) { console.log(`  · ${a.name} already in ${g.name}`); continue; }
  console.log(`  ${act()}move ${a.name} → ${g.name}`);
  if (APPLY) { await api("PATCH", `/admin/activities/${a.id}`, { groupId: g.id }); done.push(`moved ${a.name}`); }
}

/* 2. Rename before deleting, so the log reads in the order things happen. */
console.log("\nRename");
for (const [slug, name] of Object.entries(RENAME)) {
  const a = actBySlug.get(slug);
  if (!a) { console.log(`  ? ${slug} not found`); continue; }
  if (a.name === name) { console.log(`  · ${name} already named that`); continue; }
  console.log(`  ${act()}rename "${a.name}" → "${name}"`);
  if (APPLY) { await api("PATCH", `/admin/activities/${a.id}`, { name }); done.push(`renamed ${name}`); }
}

/* 3. Cover images, only when asked for. */
if (IMAGES) {
  const urls = imageUrls();
  const n = Object.keys(urls).length;
  console.log(`\nCover images (${n} found in content/activity_image_urls.txt)`);
  for (const [slug, url] of Object.entries(urls)) {
    const a = actBySlug.get(slug);
    if (!a) { console.log(`  ? ${slug} not found`); continue; }
    console.log(`  ${act()}set ${a.name}`);
    if (APPLY) { await api("PATCH", `/admin/activities/${a.id}`, { coverImage: url }); done.push(`image ${a.name}`); }
  }
}

/* 4. Activities. The 409 guard is the point: it is load-bearing, not an error. */
console.log("\nDelete activities");
for (const slug of DELETE_ACTIVITIES) {
  const a = actBySlug.get(slug);
  if (!a) { console.log(`  · ${slug} already gone`); continue; }
  if (!APPLY) { console.log(`  would delete ${a.name}`); continue; }
  const r = await api("DELETE", `/admin/activities/${a.id}`);
  if (r?.conflict) { blocked.push(`${a.name}: ${r.conflict}`); console.log(`  BLOCKED ${a.name} — ${r.conflict}`); }
  else { done.push(`deleted ${a.name}`); console.log(`  deleted ${a.name}`); }
}

/* 5. Groups last — a group only empties once its activities are gone. */
console.log("\nDelete groups");
for (const name of DELETE_GROUPS) {
  const g = groupByName.get(name);
  if (!g) { console.log(`  · "${name}" already gone`); continue; }
  if (!APPLY) { console.log(`  would delete group "${name}"`); continue; }
  const r = await api("DELETE", `/admin/activity-groups/${g.id}`);
  if (r?.conflict) { blocked.push(`group ${name}: ${r.conflict}`); console.log(`  BLOCKED "${name}" — ${r.conflict}`); }
  else { done.push(`deleted group ${name}`); console.log(`  deleted group "${name}"`); }
}

/* ---------------------------------------------------------------- report */

console.log("\n" + "=".repeat(58));
if (!APPLY) {
  console.log("Nothing was changed. Re-run with --apply to carry this out.");
  console.log("Add --images to also set cover images from content/activity_image_urls.txt.");
} else {
  console.log(`${done.length} changes applied.`);
  if (blocked.length) {
    console.log(`\n${blocked.length} blocked by the server's own guard:`);
    for (const b of blocked) console.log(`  - ${b}`);
    console.log("\nThese are still on tours. Remove them from those tours first,");
    console.log("then run this again — nothing was half-done.");
  }
  if (missing.length) console.log(`\nNot found: ${missing.join(", ")}`);
}
console.log(`\nLeft in place on purpose: ${KEPT_ON_PURPOSE.join(", ")}`);
