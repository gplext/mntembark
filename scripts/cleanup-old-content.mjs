#!/usr/bin/env node
/**
 * Clear out the leftovers from the old tours site, so the attractions site is
 * all that remains.
 *
 *   node scripts/cleanup-old-content.mjs --url https://mntembark.com --password '...'
 *   node scripts/cleanup-old-content.mjs --url https://mntembark.com --password '...' --apply
 *
 * DRY RUN IS THE DEFAULT. Nothing is deleted until you add --apply, because a
 * delete cannot be undone.
 *
 * What counts as a leftover is decided by the CSVs in content/, not by a list
 * written here — so this stays right as your content grows:
 *
 *   tours          every one. The new site has no tour pages at all.
 *   destinations   any not in regions.csv (Japan, Morocco, Iceland, the African
 *                  ones …). The new site groups places into 8 regions.
 *   locations      any not in locations.csv. One that already has an attraction
 *                  is refused by the server and reported, never forced.
 *   countries      any not in countries.csv.
 *   categories     any outside the nine the attractions use.
 *   activities     any not in activities.csv (swimming, cycling, off-road,
 *                  camping — nothing uses them).
 *
 * Keep a group as it is with --keep-tours, --keep-destinations, --keep-places
 * (countries and locations), --keep-categories or --keep-activities.
 *
 * Run this BEFORE scripts/import-attractions.mjs, then import. An attraction
 * already imported blocks its location from being deleted, which is the
 * safeguard working, not an error.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CONTENT = join(dirname(fileURLToPath(import.meta.url)), "..", "content");

const KEEP_CATEGORIES = [
  "safari", "expedition-cruising", "island-coast", "mountain-wilderness",
  "architecture-history", "family-fun", "relaxation-spa", "rail-road", "active-lifestyle",
];

const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(`--${name}`); return i !== -1 ? args[i + 1] : undefined; };
const BASE = (arg("url") ?? process.env.SITE_URL ?? "").replace(/\/$/, "");
const PASSWORD = arg("password") ?? process.env.ADMIN_PASSWORD;
const EMAIL = arg("email");
const APPLY = args.includes("--apply");
const skip = (what) => args.includes(`--keep-${what}`);

if (!BASE || !PASSWORD) {
  console.error("Usage: node scripts/cleanup-old-content.mjs --url https://your-site --password YOUR_ADMIN_PASSWORD [--apply]");
  process.exit(1);
}

/* ------------------------------------------------------------------- csv */

function parseCsv(text) {
  const rows = [];
  let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
    else if (c !== "\r") f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((x) => x !== ""));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim().replace(/^﻿/, ""), (r[i] ?? "").trim()])));
}
const read = (file) => { try { return parseCsv(readFileSync(join(CONTENT, file), "utf8")); } catch { return []; } };
const key = (s) => (s ?? "").trim().toLowerCase();

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
  if (!res.ok) throw new Error(`${res.status}: ${data?.error ?? data?.message ?? text.slice(0, 160)}`);
  return data;
}

let removed = 0, kept = 0, refused = 0;

/** Delete the rows `isOld` picks out, and report every decision. */
async function sweep(title, rows, isOld, label, path) {
  console.log(`\n${title}`);
  const old = rows.filter(isOld);
  kept += rows.length - old.length;
  if (rows.length - old.length) console.log(`  · keeping ${rows.length - old.length}`);
  if (!old.length) { console.log("  · nothing to remove"); return; }
  for (const r of old) {
    if (!APPLY) { console.log(`  - would remove ${label(r)}`); removed++; continue; }
    try {
      await api("DELETE", `${path}/${r.id}`);
      removed++; console.log(`  - removed ${label(r)}`);
    } catch (err) {
      refused++; console.log(`  ! kept ${label(r)} — ${err.message}`);
    }
  }
}

/* --------------------------------------------------------------- cleanup */

console.log(`\n${APPLY ? "Cleaning" : "DRY RUN — nothing will be deleted"} on ${BASE}`);
await api("POST", "/admin/login", EMAIL ? { email: EMAIL, password: PASSWORD } : { password: PASSWORD });

const wantRegions = new Set(read("regions.csv").flatMap((r) => [key(r.slug), key(r.name)]));
const wantCountries = new Set(read("countries.csv").flatMap((c) => [key(c.name), key(c.slug)]));
const wantLocations = new Set(read("locations.csv").map((l) => `${key(l.country)}|${key(l.name)}`));
const wantActivities = new Set(read("activities.csv").map((a) => key(a.slug)));
// A country named only in attractions.csv (the Tanzania example) still counts.
for (const a of read("attractions.csv")) {
  wantCountries.add(key(a.country));
  wantLocations.add(`${key(a.country)}|${key(a.location)}`);
}

if (!skip("tours")) {
  const res = (await api("GET", "/tours")) ?? [];
  const tours = Array.isArray(res) ? res : (res.tours ?? res.data ?? []);
  await sweep("Tours (the old site's trips)", tours, () => true, (t) => `tour "${t.title ?? t.slug}"`, "/tours");
}

if (!skip("destinations")) {
  const rows = (await api("GET", "/destinations")) ?? [];
  await sweep("Destinations", rows, (d) => !wantRegions.has(key(d.slug)) && !wantRegions.has(key(d.name)),
    (d) => `destination "${d.name}"`, "/destinations");
}

if (!skip("places")) {
  const locs = (await api("GET", "/locations")) ?? [];
  await sweep("Cities and areas", locs, (l) => !wantLocations.has(`${key(l.countryName)}|${key(l.name)}`),
    (l) => `place "${l.name}${l.countryName ? `, ${l.countryName}` : ""}"`, "/locations");

  const countries = (await api("GET", "/countries")) ?? [];
  await sweep("Countries", countries, (c) => !wantCountries.has(key(c.name)) && !wantCountries.has(key(c.slug)),
    (c) => `country "${c.name}"`, "/countries");
}

if (!skip("categories")) {
  const rows = (await api("GET", "/categories")) ?? [];
  await sweep("Categories", rows, (c) => !KEEP_CATEGORIES.includes(c.slug ?? ""),
    (c) => `category "${c.name}"`, "/categories");
}

if (!skip("activities")) {
  const res = (await api("GET", "/admin/activities")) ?? [];
  const acts = Array.isArray(res) ? res : (res.activities ?? []);
  await sweep("Activities", acts, (a) => !wantActivities.has(key(a.slug)),
    (a) => `activity "${a.name}"`, "/admin/activities");
}

console.log(
  `\n${APPLY ? "Removed" : "Would remove"} ${removed}, left ${kept} in place${refused ? `, ${refused} refused (see ! above)` : ""}.`,
);
if (!APPLY) console.log("Run again with --apply to do it, then run scripts/import-attractions.mjs.");
