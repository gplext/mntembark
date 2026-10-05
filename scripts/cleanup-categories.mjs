#!/usr/bin/env node
/**
 * Keep the nine standard categories and remove the rest.
 *
 *   node scripts/cleanup-categories.mjs --url https://mntembark.com --password '...'
 *   node scripts/cleanup-categories.mjs --url https://mntembark.com --password '...' --apply
 *
 * Nothing is deleted until you pass --apply, because a delete cannot be undone.
 *
 * The nine below are the ones the attractions use. Anything else — usually a
 * category typed into the admin panel, which the form saves without a slug, so
 * its page and its filter never worked — is removed. A tour that pointed at a
 * removed category simply loses its category; the tour itself is untouched.
 *
 * Edit KEEP if you want to keep more.
 */

import process from "node:process";

const KEEP = [
  "safari",
  "expedition-cruising",
  "island-coast",
  "mountain-wilderness",
  "architecture-history",
  "family-fun",
  "relaxation-spa",
  "rail-road",
  "active-lifestyle",
];

const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(`--${name}`); return i !== -1 ? args[i + 1] : undefined; };
const BASE = (arg("url") ?? process.env.SITE_URL ?? "").replace(/\/$/, "");
const PASSWORD = arg("password") ?? process.env.ADMIN_PASSWORD;
const EMAIL = arg("email");
const APPLY = args.includes("--apply");

if (!BASE || !PASSWORD) {
  console.error("Usage: node scripts/cleanup-categories.mjs --url https://your-site --password YOUR_ADMIN_PASSWORD [--apply]");
  process.exit(1);
}

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
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${data?.error ?? text.slice(0, 200)}`);
  return data;
}

console.log(`\n${APPLY ? "Cleaning up" : "DRY RUN — nothing will be deleted"} on ${BASE}\n`);
await api("POST", "/admin/login", EMAIL ? { email: EMAIL, password: PASSWORD } : { password: PASSWORD });

const all = (await api("GET", "/categories")) ?? [];
const keep = all.filter((c) => KEEP.includes(c.slug ?? ""));
const drop = all.filter((c) => !KEEP.includes(c.slug ?? ""));

console.log(`Keeping ${keep.length}:`);
for (const c of keep) console.log(`  · ${c.name}  (${c.slug})`);

console.log(`\n${APPLY ? "Removing" : "Would remove"} ${drop.length}:`);
let gone = 0, failed = 0;
for (const c of drop) {
  if (!APPLY) { console.log(`  - ${c.name}${c.slug ? `  (${c.slug})` : "  (no slug)"}`); continue; }
  try {
    await api("DELETE", `/categories/${c.id}`);
    gone++; console.log(`  - ${c.name} removed`);
  } catch (err) {
    failed++; console.log(`  ! ${c.name} — ${err.message}`);
  }
}

if (APPLY) console.log(`\nRemoved ${gone}${failed ? `, ${failed} refused (see ! above)` : ""}. ${keep.length} categories left.`);
else console.log(`\nRe-run with --apply to remove them. Missing one you want to keep? Add its slug to KEEP at the top of this file.`);
