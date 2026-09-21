#!/usr/bin/env node
/**
 * Point the content CSVs at the photos you saved in
 * artifacts/mnt-embark-web/public/images/world/.
 *
 *   node scripts/use-world-images.mjs
 *
 * Looks for, by file name (jpg, jpeg, webp or png):
 *   world/regions/<region-slug>.jpg                 → regions.csv     coverImage
 *   world/countries/<country-slug>.jpg              → countries.csv   image
 *   world/locations/<country-slug>--<place>.jpg     → locations.csv   image
 *   world/attractions/<attraction-slug>.jpg         → attractions.csv coverImage
 *
 * Only rows with a photo on disk change; the rest keep their placeholder.
 * Then rebuild the site and run scripts/import-attractions.mjs again.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = join(ROOT, "content");
const WORLD = join(ROOT, "artifacts", "mnt-embark-web", "public", "images", "world");
const EXT = new Set([".jpg", ".jpeg", ".webp", ".png"]);

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
  return { head: head.map((h) => h.replace(/^﻿/, "")), rows: body.map((r) => Object.fromEntries(head.map((h, i) => [h.replace(/^﻿/, ""), r[i] ?? ""]))) };
}
const cell = (v) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const toCsv = ({ head, rows }) => [head.join(","), ...rows.map((r) => head.map((h) => cell(r[h] ?? "")).join(","))].join("\n") + "\n";
const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** name (without extension) -> web path, for one folder */
function photos(folder) {
  const dir = join(WORLD, folder);
  if (!existsSync(dir)) return new Map();
  return new Map(
    readdirSync(dir)
      .filter((f) => EXT.has(parse(f).ext.toLowerCase()))
      .map((f) => [parse(f).name.toLowerCase(), `/images/world/${folder}/${f}`]),
  );
}

let total = 0;
function apply(file, folder, column, keyOf) {
  const path = join(CONTENT, file);
  const csv = parseCsv(readFileSync(path, "utf8"));
  const found = photos(folder);
  let n = 0;
  for (const r of csv.rows) {
    const url = found.get(keyOf(r));
    if (url && r[column] !== url) { r[column] = url; n++; }
  }
  if (n) writeFileSync(path, toCsv(csv));
  total += n;
  console.log(`${file.padEnd(18)} ${String(n).padStart(3)} updated   (${found.size} photos in world/${folder})`);
}

apply("regions.csv", "regions", "coverImage", (r) => r.slug);
apply("countries.csv", "countries", "image", (r) => r.slug || slug(r.name));
apply("locations.csv", "locations", "image", (r) => `${slug(r.country)}--${slug(r.name)}`);
apply("attractions.csv", "attractions", "coverImage", (r) => r.slug);

console.log(total
  ? "\nNext: rebuild the site (docker compose up -d --build), then run scripts/import-attractions.mjs again."
  : "\nNothing to change. Check the photos are in artifacts/mnt-embark-web/public/images/world/ with the names from content/gemini/image_list.csv.");
