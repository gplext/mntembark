#!/usr/bin/env node
/**
 * Check a running site against the content CSVs and report what is missing.
 *
 *   node scripts/check-live.mjs --url https://mntembark.com --password '...'
 *
 * Reads only — it changes nothing. It answers:
 *   is everything from the CSVs on the site?
 *   does every attraction have its place, categories, activities and steps?
 *   is every region linked to its countries and places?
 *   how many photographs are still missing, and where?
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CONTENT = join(dirname(fileURLToPath(import.meta.url)), "..", "content");

const args = process.argv.slice(2);
const arg = (n) => { const i = args.indexOf(`--${n}`); return i !== -1 ? args[i + 1] : undefined; };
const BASE = (arg("url") ?? process.env.SITE_URL ?? "").replace(/\/$/, "");
const PASSWORD = arg("password") ?? process.env.ADMIN_PASSWORD;
const EMAIL = arg("email");
const VERBOSE = args.includes("--verbose");

if (!BASE) {
  console.error("Usage: node scripts/check-live.mjs --url https://your-site [--password YOUR_ADMIN_PASSWORD] [--verbose]");
  process.exit(1);
}

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
const read = (f) => { try { return parseCsv(readFileSync(join(CONTENT, f), "utf8")); } catch { return []; } };
const key = (s) => (s ?? "").trim().toLowerCase();
const isPlaceholder = (v) => !v || String(v).startsWith("/api/placeholder.svg");

let cookie = "";
async function api(method, path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const set = res.headers.getSetCookie?.() ?? [];
  if (set.length) cookie = set.map((c) => c.split(";")[0]).join("; ");
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* not json */ }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${data?.error ?? text.slice(0, 120)}`);
  return data;
}

const line = (ok, text) => console.log(`  ${ok ? "✓" : "✗"} ${text}`);
const some = (list, n = 6) => list.slice(0, n).join(", ") + (list.length > n ? `, and ${list.length - n} more` : "");
let problems = 0;
const bad = (text) => { problems++; line(false, text); };

console.log(`\nChecking ${BASE}\n`);
if (PASSWORD) await api("POST", "/admin/login", EMAIL ? { email: EMAIL, password: PASSWORD } : { password: PASSWORD });

/* ------------------------------------------------------------- the data */

const csvRegions = read("regions.csv");
const csvCountries = read("countries.csv");
const csvLocations = read("locations.csv");
const csvAttractions = read("attractions.csv");
const csvSteps = read("attraction_steps.csv");
const csvCats = read("attraction_categories.csv");
const csvActs = read("attraction_activities.csv");

const destinations = (await api("GET", "/destinations")) ?? [];
const countries = (await api("GET", "/countries")) ?? [];
const locations = (await api("GET", "/locations")) ?? [];
const attractions = (await api("GET", "/attractions")) ?? [];
const categories = (await api("GET", "/categories")) ?? [];
const actsRes = PASSWORD ? await api("GET", "/admin/activities") : (await api("GET", "/activities")) ?? [];
const activities = Array.isArray(actsRes) ? actsRes : (actsRes.activities ?? actsRes.flatMap?.((g) => g.activities ?? []) ?? []);

/* --------------------------------------------------------------- counts */

console.log("Everything from the CSVs is on the site");
const missDest = csvRegions.filter((r) => !destinations.some((d) => key(d.slug) === key(r.slug) || key(d.name) === key(r.name)));
missDest.length ? bad(`${missDest.length} regions missing: ${some(missDest.map((r) => r.name))}`)
  : line(true, `${csvRegions.length} regions`);

const missCountry = csvCountries.filter((c) => !countries.some((x) => key(x.name) === key(c.name)));
missCountry.length ? bad(`${missCountry.length} countries missing: ${some(missCountry.map((c) => c.name))}`)
  : line(true, `${csvCountries.length} countries`);

const missLoc = csvLocations.filter((l) => !locations.some((x) => key(x.name) === key(l.name) && key(x.countryName) === key(l.country)));
missLoc.length ? bad(`${missLoc.length} places missing: ${some(missLoc.map((l) => `${l.name}, ${l.country}`))}`)
  : line(true, `${csvLocations.length} cities and areas`);

const bySlug = new Map(attractions.map((a) => [a.slug, a]));
const missAttr = csvAttractions.filter((a) => !bySlug.has(a.slug));
missAttr.length ? bad(`${missAttr.length} attractions missing: ${some(missAttr.map((a) => a.name))}`)
  : line(true, `${csvAttractions.length} attractions`);

/* ------------------------------------------------- every attraction wired */

console.log("\nEvery attraction is wired up");
const wantCats = new Map(), wantActs = new Map(), wantSteps = new Map();
for (const c of csvCats) wantCats.set(c.attraction_slug, (wantCats.get(c.attraction_slug) ?? 0) + 1);
for (const a of csvActs) wantActs.set(a.attraction_slug, (wantActs.get(a.attraction_slug) ?? 0) + 1);
for (const s of csvSteps) wantSteps.set(s.attraction_slug, (wantSteps.get(s.attraction_slug) ?? 0) + 1);

const noPlace = [], fewCats = [], fewActs = [], fewSteps = [], noCats = [], noActs = [];
for (const row of csvAttractions) {
  const a = bySlug.get(row.slug);
  if (!a) continue;
  if (!a.location?.name || !a.country?.name) noPlace.push(a.name);
  else if (key(a.location.name) !== key(row.location) || key(a.country.name) !== key(row.country))
    noPlace.push(`${a.name} (site says ${a.location?.name}, ${a.country?.name})`);
  const cats = a.categories?.length ?? 0, acts = a.activities?.length ?? 0, steps = a.steps?.length ?? 0;
  if (cats === 0 && (wantCats.get(row.slug) ?? 0) > 0) noCats.push(a.name);
  else if (cats < (wantCats.get(row.slug) ?? 0)) fewCats.push(`${a.name} ${cats}/${wantCats.get(row.slug)}`);
  if (acts === 0 && (wantActs.get(row.slug) ?? 0) > 0) noActs.push(a.name);
  else if (acts < (wantActs.get(row.slug) ?? 0)) fewActs.push(`${a.name} ${acts}/${wantActs.get(row.slug)}`);
  if (steps < (wantSteps.get(row.slug) ?? 0)) fewSteps.push(`${a.name} ${steps}/${wantSteps.get(row.slug)}`);
}
noPlace.length ? bad(`${noPlace.length} in the wrong place: ${some(noPlace)}`) : line(true, "every attraction sits in its city and country");
noCats.length ? bad(`${noCats.length} with no category at all: ${some(noCats)}`) : line(true, "every attraction has at least one category");
fewCats.length ? bad(`${fewCats.length} missing some categories: ${some(fewCats)}`) : line(true, "all category links are there");
noActs.length ? bad(`${noActs.length} with no activity at all: ${some(noActs)}`) : line(true, "every attraction has its activities");
fewActs.length ? bad(`${fewActs.length} missing some activities: ${some(fewActs)}`) : line(true, "all activity links are there");
fewSteps.length ? bad(`${fewSteps.length} missing steps: ${some(fewSteps)}`) : line(true, "every attraction has all of its steps");

/* ----------------------------------------------------------- the regions */

console.log("\nEvery region holds its countries and places");
for (const r of csvRegions) {
  const d = destinations.find((x) => key(x.slug) === key(r.slug) || key(x.name) === key(r.name));
  if (!d) continue;
  const want = (r.countries ?? "").split("|").map((s) => s.trim()).filter(Boolean);
  let places;
  try { places = await api("GET", `/destinations/${d.id}/places`); } catch { places = null; }
  if (!places) { bad(`${d.name}: could not read its places`); continue; }
  const haveCountries = (places.countryIds ?? []).length, haveLocations = (places.locationIds ?? []).length;
  const wantLocations = csvLocations.filter((l) => want.some((c) => key(c) === key(l.country))).length;
  if (haveCountries < want.length || haveLocations < wantLocations)
    bad(`${d.name}: ${haveCountries}/${want.length} countries, ${haveLocations}/${wantLocations} places`);
  else line(true, `${d.name}: ${haveCountries} countries, ${haveLocations} places`);
}

/* -------------------------------------------------------------- the taxonomy */

console.log("\nCategories and activities");
const usedCats = new Set(csvCats.map((c) => c.category_slug));
const missingCats = [...usedCats].filter((s) => !categories.some((c) => c.slug === s));
missingCats.length ? bad(`missing categories: ${missingCats.join(", ")}`) : line(true, `all ${usedCats.size} categories the attractions use exist`);
const extraCats = categories.filter((c) => !usedCats.has(c.slug ?? ""));
if (extraCats.length) line(true, `${extraCats.length} extra categories nothing uses: ${some(extraCats.map((c) => c.name))}`);

const usedActs = new Set(csvActs.map((a) => a.activity_slug));
const missingActs = [...usedActs].filter((s) => !activities.some((a) => a.slug === s));
missingActs.length ? bad(`missing activities: ${missingActs.join(", ")}`) : line(true, `all ${usedActs.size} activities the attractions use exist`);
const extraActs = activities.filter((a) => !usedActs.has(a.slug));
if (extraActs.length) line(true, `${extraActs.length} extra activities nothing uses: ${some(extraActs.map((a) => a.name))}`);

/* ---------------------------------------------------------------- photos */

console.log("\nPhotographs");
const shots = (label, rows, pic, name) => {
  const missing = rows.filter((r) => isPlaceholder(pic(r)));
  console.log(`  ${rows.length - missing.length}/${rows.length} ${label} have a photo${missing.length ? ` — still to do: ${some(missing.map(name), VERBOSE ? 999 : 8)}` : ""}`);
  return missing.length;
};
const left =
  shots("regions", destinations.filter((d) => csvRegions.some((r) => key(r.slug) === key(d.slug))), (d) => d.coverImage, (d) => d.name) +
  shots("countries", countries, (c) => c.image, (c) => c.name) +
  shots("cities and areas", locations, (l) => l.image, (l) => `${l.name}, ${l.countryName ?? "?"}`) +
  shots("attractions", attractions, (a) => a.coverImage, (a) => a.name);

console.log(`\n${left} photographs still to fill in.`);
console.log(problems ? `${problems} thing${problems > 1 ? "s" : ""} to fix — see the ✗ lines above.` : "Everything else is wired up correctly.");
if (!VERBOSE && left) console.log("Add --verbose to list every missing photo.");
