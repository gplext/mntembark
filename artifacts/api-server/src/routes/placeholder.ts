/**
 * An elegant stand-in image for places that have no photograph yet.
 *
 *   /api/placeholder.svg?t=Hagia%20Sophia&s=Istanbul%2C%20Turkey
 *
 * Imported content points its cover images here so every card and hero
 * looks finished on day one. Replace any of them later with a real photo
 * (Admin → Upload, or paste a URL); nothing else needs to change.
 *
 * The tint is picked from the title, so the same place always gets the
 * same colours and a grid of cards does not look like one image repeated.
 */

import { Router, type IRouter } from "express";

const router: IRouter = Router();

const PALETTES = [
  { a: "#16130F", b: "#2B241A" }, // night
  { a: "#1B2320", b: "#2F3A33" }, // olive
  { a: "#241A16", b: "#3E2B22" }, // clay
  { a: "#141C24", b: "#24313D" }, // sea
  { a: "#201A24", b: "#352B3B" }, // dusk
  { a: "#1E1F17", b: "#35352A" }, // stone
];

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Split a long title over two lines at the space nearest the middle. */
function lines(title: string): string[] {
  if (title.length <= 22) return [title];
  const mid = title.length / 2;
  let best = -1;
  for (let i = 0; i < title.length; i++) {
    if (title[i] === " " && (best === -1 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  }
  return best === -1 ? [title] : [title.slice(0, best), title.slice(best + 1)];
}

router.get("/placeholder.svg", (req, res) => {
  const title = String(req.query.t ?? "MNT Embark").slice(0, 80);
  const sub = String(req.query.s ?? "").slice(0, 80);
  const h = hash(title);
  const p = PALETTES[h % PALETTES.length];
  const tl = lines(title);
  const size = tl.some((l) => l.length > 18) ? 84 : 104;
  const top = 500 - ((tl.length - 1) * size * 1.05) / 2;

  // Faint contour rings, offset per place: reads as "map" without being one.
  const cx = 300 + (h % 1000);
  const cy = 200 + ((h >> 10) % 600);
  const rings = Array.from({ length: 14 }, (_, i) => {
    const r = 120 + i * 70;
    return `<ellipse cx="${cx}" cy="${cy}" rx="${r * 1.35}" ry="${r}" transform="rotate(${(h >> 4) % 40 - 20} ${cx} ${cy})"/>`;
  }).join("");

  const titleSvg = tl
    .map((l, i) => `<text x="800" y="${top + i * size * 1.05}" font-size="${size}">${esc(l)}</text>`)
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" width="1600" height="1000" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.b}"/><stop offset="1" stop-color="${p.a}"/></linearGradient>
<radialGradient id="v" cx="0.5" cy="0.45" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.45"/></radialGradient>
</defs>
<rect width="1600" height="1000" fill="url(#g)"/>
<g fill="none" stroke="#C9A55C" stroke-opacity="0.09" stroke-width="1.5">${rings}</g>
<rect width="1600" height="1000" fill="url(#v)"/>
<rect x="48" y="48" width="1504" height="904" fill="none" stroke="#C9A55C" stroke-opacity="0.45" stroke-width="1.5"/>
<rect x="60" y="60" width="1480" height="880" fill="none" stroke="#C9A55C" stroke-opacity="0.18" stroke-width="1"/>
<g text-anchor="middle" font-family="'Cormorant Garamond','Playfair Display',Georgia,'Times New Roman',serif" fill="#F4EDE0">
${titleSvg}
</g>
<g text-anchor="middle" font-family="'Helvetica Neue',Arial,sans-serif" fill="#E2C27A">
<line x1="740" y1="${top + (tl.length - 1) * size * 1.05 + 60}" x2="860" y2="${top + (tl.length - 1) * size * 1.05 + 60}" stroke="#C9A55C" stroke-width="1.5"/>
${sub ? `<text x="800" y="${top + (tl.length - 1) * size * 1.05 + 120}" font-size="26" letter-spacing="8">${esc(sub.toUpperCase())}</text>` : ""}
<text x="800" y="900" font-size="16" letter-spacing="10" fill-opacity="0.55">MNT EMBARK</text>
</g>
</svg>`;

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=604800, immutable");
  res.send(svg);
});

export default router;
