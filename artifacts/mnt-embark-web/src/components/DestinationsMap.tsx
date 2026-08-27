import { useState, useCallback } from "react";
import { Link } from "wouter";
import { Mountain, Waves, Wind, Sun, type LucideProps } from "lucide-react";
import countriesTopology from "world-atlas/countries-110m.json";
import { feature } from "topojson-client";
import type { Tour } from "@workspace/api-client-react";
import { cn } from "@workspace/mnt-embark/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Destination {
  id: number;
  slug?: string | null;
  name: string;
  country?: string | null;
  region?: string | null;
  description?: string | null;
  coverImage?: string | null;
}

interface CategoryMeta {
  label: string;
  Icon: React.FC<LucideProps>;
  markerFill: string;
  markerStroke: string;
  iconColor: string;
  regionFill: string;
  glowColor: string;
}

// ─── Category ────────────────────────────────────────────────────────────────

type Category = "polar" | "desert" | "wilderness" | "island" | "unknown";

const SLUG_CATEGORY_MAP: Record<string, Category> = {
  iceland: "polar",
  morocco: "desert",
  patagonia: "wilderness",
  "the-maldives": "island",
};

function deriveCategory(slug: string | null | undefined): Category {
  if (!slug) return "unknown";
  return SLUG_CATEGORY_MAP[slug.toLowerCase()] ?? "unknown";
}

const CATEGORY_META: Record<Category, CategoryMeta> = {
  polar: {
    label: "Polar",
    Icon: Wind,
    markerFill: "hsl(var(--chart-4))",
    markerStroke: "hsl(var(--background))",
    iconColor: "hsl(var(--background))",
    regionFill: "hsl(var(--chart-4) / 0.25)",
    glowColor: "hsl(var(--chart-4) / 0.3)",
  },
  desert: {
    label: "Desert",
    Icon: Sun,
    markerFill: "hsl(var(--primary))",
    markerStroke: "hsl(var(--background))",
    iconColor: "hsl(var(--primary-foreground))",
    regionFill: "hsl(var(--primary) / 0.2)",
    glowColor: "hsl(var(--primary) / 0.28)",
  },
  wilderness: {
    label: "Wilderness",
    Icon: Mountain,
    markerFill: "hsl(var(--chart-2))",
    markerStroke: "hsl(var(--background))",
    iconColor: "hsl(var(--background))",
    regionFill: "hsl(var(--chart-2) / 0.22)",
    glowColor: "hsl(var(--chart-2) / 0.3)",
  },
  island: {
    label: "Island",
    Icon: Waves,
    markerFill: "hsl(var(--chart-3))",
    markerStroke: "hsl(var(--background))",
    iconColor: "hsl(var(--background))",
    regionFill: "hsl(var(--chart-3) / 0.22)",
    glowColor: "hsl(var(--chart-3) / 0.3)",
  },
  unknown: {
    label: "Destination",
    Icon: Wind,
    markerFill: "hsl(var(--muted-foreground))",
    markerStroke: "hsl(var(--background))",
    iconColor: "hsl(var(--background))",
    regionFill: "hsl(var(--muted-foreground) / 0.15)",
    glowColor: "hsl(var(--muted-foreground) / 0.22)",
  },
};

// ─── Projection ───────────────────────────────────────────────────────────────
// Equirectangular: 1200 × 580 px

const MAP_W = 1200;
const MAP_H = 580;

function proj(lat: number, lng: number): [number, number] {
  const x = ((lng + 180) / 360) * MAP_W;
  const y = ((90 - lat) / 180) * MAP_H;
  return [x, y];
}

// Helpers so we can write coordinates as (lat, lng) tuples
function p(lat: number, lng: number) {
  const [x, y] = proj(lat, lng);
  return `${x.toFixed(1)},${y.toFixed(1)}`;
}
function mv(lat: number, lng: number) { return `M ${p(lat, lng)}`; }
function lv(lat: number, lng: number) { return `L ${p(lat, lng)}`; }
// Quadratic bezier with lat/lng control point
function qv(clat: number, clng: number, lat: number, lng: number) {
  return `Q ${p(clat, clng)} ${p(lat, lng)}`;
}
// Cubic bezier with lat/lng control points
function cv(c1lat: number, c1lng: number, c2lat: number, c2lng: number, lat: number, lng: number) {
  return `C ${p(c1lat, c1lng)} ${p(c2lat, c2lng)} ${p(lat, lng)}`;
}

// ─── Geographic base map ─────────────────────────────────────────────────────
//
// The world outline comes from the public Natural Earth-derived world-atlas
// dataset. We project every coordinate with the same equirectangular function
// used by the destination pins, which keeps the geography and locations aligned.

type GeoGeometry = {
  type?: string;
  coordinates?: unknown;
} | null | undefined;

function ringToPath(ring: unknown): string {
  if (!Array.isArray(ring) || ring.length === 0) return "";

  const points = ring as unknown[][];
  const commands = points
    .filter((point): point is [number, number] =>
      Array.isArray(point) &&
      typeof point[0] === "number" &&
      typeof point[1] === "number"
    )
    .map(([lng, lat], index) => `${index === 0 ? "M" : "L"} ${p(lat, lng)}`);

  return commands.length > 0 ? `${commands.join(" ")} Z` : "";
}

function geometryToPath(geometry: GeoGeometry): string {
  if (!geometry?.coordinates) return "";

  if (geometry.type === "Polygon") {
    return (geometry.coordinates as unknown[]).map(ringToPath).join(" ");
  }

  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates as unknown[])
      .flatMap((polygon) => (polygon as unknown[]).map(ringToPath))
      .join(" ");
  }

  return "";
}

const countriesFeatureCollection = feature(
  countriesTopology as never,
  (countriesTopology as unknown as { objects: { countries: never } }).objects.countries
) as unknown as {
  features: Array<{ id?: string | number; geometry?: GeoGeometry }>;
};

const WORLD_COUNTRY_PATHS = countriesFeatureCollection.features
  .map((country, index) => ({
    id: String(country.id ?? index),
    d: geometryToPath(country.geometry),
  }))
  .filter((country) => country.d.length > 0);

// ─── Known destination coordinates ───────────────────────────────────────────

const DESTINATION_COORDS: Record<string, [number, number]> = {
  iceland: [64.9631, -19.0208],
  morocco: [31.7917, -7.0926],
  patagonia: [-45.5, -69.0],
  "the-maldives": [3.2028, 73.2207],
};

function getCoords(slug: string | null | undefined): [number, number] | null {
  if (!slug) return null;
  return DESTINATION_COORDS[slug.toLowerCase()] ?? null;
}

// ─── Continent geography ──────────────────────────────────────────────────────
//
// Paths are constructed by tracing real lat/lng boundary points through the
// equirectangular projection so shapes are geographically accurate and
// recognisable — not artistic blobs.
//
// Each path uses M/L/C/Q in projected coordinates. The hand-drawn filter
// adds only a VERY subtle waver (scale=1.5) so shapes stay recognisable.

const CONTINENTS: { id: string; d: string; label: string; tint?: string }[] = [
  // ── North America (including Alaska peninsula as part of path) ───────────
  {
    id: "na",
    label: "North America",
    d: [
      // Start Alaska tip, trace west coast down then east coast up
      mv(72, -141), lv(68, -166), lv(60, -162), lv(55, -160),   // Alaska
      lv(58, -137), lv(60, -140), lv(57, -135), lv(52, -128),   // BC coast
      lv(48, -124), lv(45, -124), lv(37, -122), lv(32, -117),   // US west coast
      lv(29, -110), lv(23, -106), lv(16, -90),  lv(10, -84),    // Mexico/CA
      lv(10, -76),  lv(15, -84),  lv(22, -90),  lv(24, -82),    // Caribbean coast
      lv(25, -80),  lv(35, -75),  lv(41, -70),  lv(44, -66),    // US east coast
      lv(47, -60),  lv(51, -55),  lv(57, -60),  lv(60, -65),    // Maritimes/Labrador
      lv(64, -64),  lv(66, -82),  lv(70, -90),  lv(72, -90),    // Hudson Bay
      lv(74, -80),  lv(78, -74),  lv(82, -62),  lv(83, -50),    // Baffin
      lv(80, -68),  lv(76, -72),  lv(72, -141),                  // close
      "Z",
    ].join(" "),
  },
  // ── Greenland ────────────────────────────────────────────────────────────
  {
    id: "greenland",
    label: "Greenland",
    d: [
      mv(83, -28), lv(82, -12), lv(75, -18), lv(70, -22),
      lv(60, -44), lv(63, -52), lv(68, -52), lv(75, -56),
      lv(76, -68), lv(80, -58), lv(83, -40), lv(83, -28), "Z",
    ].join(" "),
  },
  // ── South America ────────────────────────────────────────────────────────
  {
    id: "sa",
    label: "South America",
    d: [
      mv(12, -72), lv(11, -63), lv(10, -62), lv(7, -60),
      lv(4, -52),  lv(0, -50),  lv(-5, -36), lv(-10, -38),
      lv(-15, -39), lv(-20, -41), lv(-23, -42), lv(-28, -50),
      lv(-34, -58), lv(-40, -62), lv(-45, -66), lv(-52, -68),
      lv(-55, -66), lv(-54, -64), lv(-50, -72), lv(-46, -74),
      lv(-40, -72), lv(-35, -72), lv(-30, -72), lv(-24, -70),
      lv(-18, -70), lv(-12, -76), lv(-4, -80),
      lv(-2, -78),  lv(2, -76),  lv(6, -75),
      lv(8, -77),  lv(10, -75),  lv(12, -72), "Z",
    ].join(" "),
  },
  // ── Europe (main body + Iberia) ───────────────────────────────────────────
  {
    id: "eu",
    label: "Europe",
    d: [
      // Iberian SW corner, trace coastal outline
      mv(36, -10), lv(43, -9), lv(44, -1), lv(51, 2), lv(51, 5),
      lv(54, 8),  lv(55, 12), lv(57, 10), lv(60, 5),  lv(60, 12),
      lv(58, 16), lv(55, 14), lv(54, 18), lv(57, 22), lv(55, 24),
      lv(58, 28), lv(60, 25), lv(65, 26), lv(70, 26), lv(70, 30),
      lv(68, 34), lv(64, 30), lv(60, 28), lv(58, 24), lv(54, 20),
      lv(50, 14), lv(48, 18), lv(46, 14), lv(44, 12), lv(42, 14),
      lv(38, 16), lv(38, 26), lv(40, 28), lv(42, 28), lv(40, 22),
      lv(36, 22), lv(36, 14), lv(38, 6),  lv(36, 2),
      lv(36, -6), lv(36, -10), "Z",
    ].join(" "),
  },
  // ── Scandinavia ───────────────────────────────────────────────────────────
  {
    id: "scandinavia",
    label: "Scandinavia",
    d: [
      mv(56, 8),  lv(58, 6),  lv(60, 5),  lv(62, 6),  lv(64, 14),
      lv(66, 16), lv(68, 16), lv(70, 22), lv(70, 26), lv(66, 26),
      lv(64, 24), lv(62, 22), lv(60, 24), lv(60, 28), lv(58, 26),
      lv(56, 22), lv(55, 18), lv(56, 14), lv(58, 10), lv(56, 8), "Z",
    ].join(" "),
  },
  // ── British Isles ─────────────────────────────────────────────────────────
  {
    id: "uk",
    label: "British Isles",
    d: [
      mv(50, -5),  lv(52, -4), lv(53, -3), lv(54, -2), lv(56, -2),
      lv(58, -4),  lv(58, -5), lv(56, -6), lv(56, -4), lv(54, -5),
      lv(52, -6),  lv(51, -5), lv(50, -5), "Z",
    ].join(" "),
  },
  // ── Iceland land mass ─────────────────────────────────────────────────────
  {
    id: "iceland-land",
    label: "Iceland",
    d: [
      mv(63, -25), lv(65, -24), lv(66, -22), lv(66, -18), lv(65, -14),
      lv(64, -13), lv(63, -16), lv(63, -20), lv(63, -24), lv(63, -25), "Z",
    ].join(" "),
  },
  // ── Africa ───────────────────────────────────────────────────────────────
  {
    id: "africa",
    label: "Africa",
    tint: "hsl(var(--primary) / 0.08)",
    d: [
      // NW corner Morocco/Algeria, trace clockwise
      mv(37, -6),  lv(37, 10),  lv(36, 14),  lv(34, 14),
      lv(33, 12),  lv(32, 14),  lv(30, 32),  lv(22, 38),
      lv(12, 44),  lv(11, 42),  lv(8, 40),   lv(4, 40),
      lv(4, 34),   lv(-2, 40),  lv(-10, 40), lv(-16, 36),
      lv(-22, 36), lv(-26, 32), lv(-30, 30), lv(-34, 26),
      lv(-34, 20), lv(-34, 18), lv(-32, 18), lv(-30, 16),
      lv(-26, 14), lv(-22, 14), lv(-18, 12), lv(-14, 12),
      lv(-10, 14), lv(-4, 14),  lv(-4, 8),   lv(-4, 2),
      lv(0, 2),    lv(4, 2),    lv(4, -6),   lv(8, -16),
      lv(10, -16), lv(14, -18), lv(16, -16), lv(18, -14),
      lv(22, -18), lv(24, -15), lv(26, -14),
      lv(30, -10), lv(34, -8),  lv(37, -6),  "Z",
    ].join(" "),
  },
  // ── Madagascar ───────────────────────────────────────────────────────────
  {
    id: "madagascar",
    label: "Madagascar",
    d: [
      mv(-13, 50), lv(-16, 44), lv(-20, 44), lv(-24, 46),
      lv(-25, 48), lv(-22, 50), lv(-18, 50), lv(-13, 50), "Z",
    ].join(" "),
  },
  // ── Russia/Eurasia north band ─────────────────────────────────────────────
  {
    id: "russia",
    label: "Russia",
    d: [
      mv(72, 24),  lv(74, 36),  lv(74, 52),  lv(72, 62),
      lv(74, 74),  lv(72, 90),  lv(68, 104), lv(68, 120),
      lv(64, 140), lv(60, 150), lv(56, 142), lv(52, 142),
      lv(52, 136), lv(56, 130), lv(60, 122), lv(58, 112),
      lv(54, 100), lv(52, 80),  lv(54, 62),  lv(54, 50),
      lv(50, 40),  lv(48, 46),  lv(42, 46),  lv(36, 42),
      lv(38, 36),  lv(40, 28),  lv(44, 22),  lv(48, 18),
      lv(54, 18),  lv(58, 24),  lv(64, 26),  lv(66, 30),
      lv(70, 26),  lv(70, 22),  lv(72, 24),  "Z",
    ].join(" "),
  },
  // ── Siberia / Far East extension ──────────────────────────────────────────
  {
    id: "siberia",
    label: "Siberia",
    d: [
      mv(72, 90),  lv(74, 110), lv(76, 130), lv(74, 150), lv(70, 160),
      lv(64, 168), lv(60, 172), lv(64, 140), lv(68, 120), lv(68, 104),
      lv(72, 90),  "Z",
    ].join(" "),
  },
  // ── Kamchatka ─────────────────────────────────────────────────────────────
  {
    id: "kamchatka",
    label: "Kamchatka",
    d: [
      mv(60, 162), lv(56, 160), lv(52, 160), lv(52, 163),
      lv(56, 163), lv(58, 165), lv(60, 162), "Z",
    ].join(" "),
  },
  // ── Asia (Middle East / South / SE Asia connected) ────────────────────────
  {
    id: "asia",
    label: "Asia",
    d: [
      // Arabian peninsula
      mv(30, 32),  lv(28, 34),  lv(24, 38),  lv(22, 60),
      lv(16, 54),  lv(14, 42),  lv(12, 44),
      // Indian subcontinent
      lv(22, 68),  lv(22, 72),  lv(18, 72),  lv(8, 78),
      lv(8, 80),   lv(14, 80),  lv(22, 88),  lv(22, 92),
      lv(20, 92),  lv(16, 80),  lv(22, 80),
      // Bay of Bengal / SE Asia
      lv(22, 92),  lv(20, 100), lv(16, 100), lv(10, 104),
      lv(2, 104),  lv(2, 108),  lv(6, 108),  lv(8, 104),
      lv(14, 106), lv(18, 104), lv(22, 114), lv(22, 120),
      // China coast / Korea
      lv(24, 122), lv(28, 122), lv(32, 122), lv(36, 122),
      lv(38, 122), lv(36, 120), lv(36, 116), lv(38, 114),
      lv(40, 116), lv(42, 132), lv(44, 136), lv(40, 132),
      // back through Manchuria
      lv(44, 124), lv(48, 136), lv(52, 142),
      lv(50, 40),  lv(42, 46),  lv(36, 42),  lv(30, 32), "Z",
    ].join(" "),
  },
  // ── Japan ─────────────────────────────────────────────────────────────────
  {
    id: "japan",
    label: "Japan",
    d: [
      mv(40, 140), lv(38, 141), lv(36, 140), lv(34, 136),
      lv(34, 131), lv(35, 130), lv(36, 132), lv(37, 137),
      lv(38, 140), lv(40, 142), lv(43, 142), lv(44, 144),
      lv(43, 146), lv(42, 144), lv(40, 142), lv(40, 140), "Z",
    ].join(" "),
  },
  // ── Indonesia / Malaysia (simplified) ────────────────────────────────────
  {
    id: "indonesia",
    label: "Indonesia",
    d: [
      mv(2, 104),  lv(0, 108),  lv(-2, 110), lv(-6, 108), lv(-8, 112),
      lv(-8, 116), lv(-6, 116), lv(-4, 112), lv(-2, 114), lv(-2, 118),
      lv(0, 118),  lv(2, 112),  lv(2, 108),  lv(2, 104), "Z",
      mv(2, 118),  lv(-2, 124), lv(-4, 128), lv(-2, 132), lv(0, 130),
      lv(2, 126),  lv(4, 124),  lv(2, 118), "Z",
    ].join(" "),
  },
  // ── Philippines ───────────────────────────────────────────────────────────
  {
    id: "philippines",
    label: "Philippines",
    d: [
      mv(18, 122), lv(16, 120), lv(10, 124), lv(8, 126),
      lv(10, 124), lv(14, 122), lv(18, 122), "Z",
    ].join(" "),
  },
  // ── Australia ─────────────────────────────────────────────────────────────
  {
    id: "australia",
    label: "Australia",
    d: [
      mv(-14, 130), lv(-14, 136), lv(-12, 136), lv(-10, 142),
      lv(-14, 146), lv(-18, 148), lv(-24, 152), lv(-28, 154),
      lv(-32, 152), lv(-36, 150), lv(-38, 146), lv(-36, 138),
      lv(-34, 136), lv(-32, 132), lv(-32, 124), lv(-28, 114),
      lv(-24, 114), lv(-20, 116), lv(-18, 122), lv(-16, 128),
      lv(-14, 130), "Z",
    ].join(" "),
  },
  // ── New Zealand ───────────────────────────────────────────────────────────
  {
    id: "nz",
    label: "New Zealand",
    d: [
      mv(-36, 175), lv(-38, 176), lv(-40, 176), lv(-44, 172),
      lv(-44, 170), lv(-42, 170), lv(-36, 174), lv(-36, 175), "Z",
      mv(-44, 170), lv(-46, 168), lv(-46, 170), lv(-44, 172),
      lv(-44, 170), "Z",
    ].join(" "),
  },
];

// ─── Small island dots ────────────────────────────────────────────────────────

const ISLAND_DOTS: { id: string; lat: number; lng: number; r: number }[] = [
  { id: "azores",    lat: 38,  lng: -28, r: 2.5 },
  { id: "canary",    lat: 28,  lng: -15, r: 2.5 },
  { id: "cape-verde",lat: 16,  lng: -24, r: 2.0 },
  { id: "maldives1", lat: 4,   lng: 73,  r: 2.0 },
  { id: "maldives2", lat: 2,   lng: 73,  r: 1.8 },
  { id: "maldives3", lat: 0,   lng: 73,  r: 1.6 },
  { id: "srilanka",  lat: 8,   lng: 81,  r: 2.5 },
  { id: "reunion",   lat: -21, lng: 56,  r: 2.0 },
  { id: "hawaii",    lat: 20,  lng: -157, r: 2.5 },
  { id: "cuba",      lat: 22,  lng: -80, r: 2.5 },
  { id: "svalbard",  lat: 78,  lng: 16,  r: 2.2 },
  { id: "faroe",     lat: 62,  lng: -7,  r: 1.8 },
  { id: "cyprus",    lat: 35,  lng: 33,  r: 1.8 },
];

// ─── Graticule ────────────────────────────────────────────────────────────────

function buildGraticule() {
  const parts: string[] = [];
  // Major lat lines
  for (const lat of [-60, -30, 0, 30, 60]) {
    const [, y] = proj(lat, -180);
    parts.push(`M 0 ${y.toFixed(1)} L ${MAP_W} ${y.toFixed(1)}`);
  }
  // Major lng lines every 30°
  for (let lng = -150; lng <= 180; lng += 30) {
    const [x] = proj(0, lng);
    parts.push(`M ${x.toFixed(1)} 0 L ${x.toFixed(1)} ${MAP_H}`);
  }
  return parts.join(" ");
}

function buildSubGraticule() {
  const parts: string[] = [];
  for (let lat = -80; lat <= 80; lat += 15) {
    if (lat % 30 === 0) continue;
    const [, y] = proj(lat, -180);
    parts.push(`M 0 ${y.toFixed(1)} L ${MAP_W} ${y.toFixed(1)}`);
  }
  for (let lng = -165; lng <= 180; lng += 15) {
    if (lng % 30 === 0) continue;
    const [x] = proj(0, lng);
    parts.push(`M ${x.toFixed(1)} 0 L ${x.toFixed(1)} ${MAP_H}`);
  }
  return parts.join(" ");
}

// ─── Decorative route lines ───────────────────────────────────────────────────

function buildRouteLines(
  mappable: { cx: number; cy: number; dest: Destination }[]
): { id: string; d: string }[] {
  const routes: { id: string; d: string }[] = [];
  for (let i = 0; i < mappable.length - 1; i++) {
    for (let j = i + 1; j < mappable.length; j++) {
      const a = mappable[i];
      const b = mappable[j];
      const mx = (a.cx + b.cx) / 2;
      const my = Math.min(a.cy, b.cy) - Math.abs(b.cx - a.cx) * 0.14 - 20;
      routes.push({
        id: `r-${a.dest.id}-${b.dest.id}`,
        d: `M ${a.cx.toFixed(1)},${a.cy.toFixed(1)} Q ${mx.toFixed(1)},${my.toFixed(1)} ${b.cx.toFixed(1)},${b.cy.toFixed(1)}`,
      });
    }
  }
  return routes;
}

// ─── Destination contour rings ────────────────────────────────────────────────

function DestinationContours({
  cx,
  cy,
  category,
}: {
  cx: number;
  cy: number;
  category: Category;
}) {
  const meta = CATEGORY_META[category];
  return (
    <>
      <ellipse
        cx={cx} cy={cy} rx={56} ry={44}
        fill={meta.regionFill}
        stroke={meta.markerFill}
        strokeWidth={0.7}
        strokeDasharray="3 7"
        opacity={0.22}
      />
      <ellipse
        cx={cx} cy={cy} rx={80} ry={60}
        fill={meta.regionFill}
        stroke={meta.markerFill}
        strokeWidth={0.5}
        strokeDasharray="2 12"
        opacity={0.12}
      />
    </>
  );
}

// ─── Compass rose ─────────────────────────────────────────────────────────────

function CompassRose({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`} opacity={0.82}>
      {/* Outer rings */}
      <circle r={32} fill="hsl(var(--background))" fillOpacity={0.85} stroke="hsl(var(--primary))" strokeWidth={1.2} />
      <circle r={27} fill="none" stroke="hsl(var(--primary))" strokeWidth={0.5} opacity={0.45} />
      <circle r={22} fill="none" stroke="hsl(var(--primary))" strokeWidth={0.3} opacity={0.3} />

      {/* North arm — gold */}
      <polygon points="0,-26 4,-10 0,-15 -4,-10" fill="hsl(var(--primary))" />
      {/* South arm — slate */}
      <polygon points="0,26 4,10 0,15 -4,10" fill="hsl(var(--chart-4))" />
      {/* East arm */}
      <polygon points="26,0 10,4 15,0 10,-4" fill="hsl(var(--chart-4))" />
      {/* West arm */}
      <polygon points="-26,0 -10,4 -15,0 -10,-4" fill="hsl(var(--chart-4))" />
      {/* Diagonal half-arms */}
      <polygon points="0,-26 3,-14 0,-18" fill="hsl(var(--primary))" opacity={0.35} transform="rotate(45)" />
      <polygon points="0,-26 3,-14 0,-18" fill="hsl(var(--chart-4))" opacity={0.35} transform="rotate(135)" />
      <polygon points="0,-26 3,-14 0,-18" fill="hsl(var(--chart-4))" opacity={0.35} transform="rotate(225)" />
      <polygon points="0,-26 3,-14 0,-18" fill="hsl(var(--primary))" opacity={0.35} transform="rotate(315)" />

      {/* Centre jewel */}
      <circle r={4} fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth={1.2} />
      <circle r={1.5} fill="hsl(var(--primary))" />

      {/* Cardinal labels */}
      <text textAnchor="middle" y={-35} fontSize="9" fontFamily="var(--app-font-serif)" fontWeight="700" fill="hsl(var(--primary))">N</text>
      <text textAnchor="middle" y={45} fontSize="8" fontFamily="var(--app-font-serif)" fill="hsl(var(--foreground))" opacity={0.55}>S</text>
      <text textAnchor="start" x={36} y={3} fontSize="8" fontFamily="var(--app-font-serif)" fill="hsl(var(--foreground))" opacity={0.55}>E</text>
      <text textAnchor="end" x={-36} y={3} fontSize="8" fontFamily="var(--app-font-serif)" fill="hsl(var(--foreground))" opacity={0.55}>W</text>
    </g>
  );
}

// ─── Marker ───────────────────────────────────────────────────────────────────

interface MarkerProps {
  dest: Destination;
  cx: number;
  cy: number;
  category: Category;
  meta: CategoryMeta;
  isActive: boolean;
  onActivate: (id: number | null) => void;
}

function DestinationMarker({ dest, cx, cy, meta, isActive, onActivate }: MarkerProps) {
  const slug = encodeURIComponent(dest.slug ?? "");
  const href = `/tours?destinationSlug=${slug}`;
  const { Icon } = meta;

  const handleMouseEnter = useCallback(() => onActivate(dest.id), [dest.id, onActivate]);
  const handleMouseLeave = useCallback(() => onActivate(null), [onActivate]);
  const handleFocus = useCallback(() => onActivate(dest.id), [dest.id, onActivate]);
  const handleBlur = useCallback(() => onActivate(null), [onActivate]);

  const RING_R = 26;    // outermost ring
  const DISC_R = 18;    // coloured disc
  const PIN_Y  = RING_R + 8; // tip of pin below marker
  const LABEL_Y = PIN_Y + 14; // name text baseline

  return (
    <g
      data-testid={`map-marker-${dest.id}`}
      aria-label={`${dest.name} — ${meta.label} destination`}
      transform={`translate(${cx},${cy})`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ cursor: "pointer" }}
    >
      {/* Radial glow / halo */}
      <circle
        r={RING_R + 14}
        fill={meta.glowColor}
        style={{ pointerEvents: "none", transition: "opacity 0.25s" }}
        opacity={isActive ? 1 : 0.45}
      />

      {/* Active emphasis ring.
          Keep it mounted at all times so activating a marker never changes
          the SVG group's bounds or shifts the marker. */}
      <circle
        r={RING_R + 6}
        fill="none"
        stroke={meta.markerFill}
        strokeWidth={1.8}
        strokeDasharray="3 4"
        opacity={isActive ? 0.72 : 0}
        style={{ pointerEvents: "none", transition: "opacity 0.2s" }}
      />

      {/* White ring */}
      <circle
        r={RING_R}
        fill="hsl(var(--background))"
        stroke={meta.markerFill}
        strokeWidth={1.8}
        style={{ filter: isActive ? "drop-shadow(0 2px 8px hsl(var(--foreground) / 0.28))" : "none", transition: "stroke-width 0.2s, filter 0.2s" }}
      />

      {/* Inner coloured disc */}
      <circle
        r={DISC_R}
        fill={meta.markerFill}
        stroke="hsl(var(--background))"
        strokeWidth={1.5}
      />

      {/* Pin stem */}
      <line
        x1={0} y1={DISC_R}
        x2={0} y2={PIN_Y}
        stroke={meta.markerFill}
        strokeWidth={2}
        strokeLinecap="round"
        style={{ transition: "opacity 0.2s" }}
      />
      {/* Pin tip drop */}
      <circle
        cx={0} cy={PIN_Y}
        r={4}
        fill={meta.markerFill}
        stroke="hsl(var(--background))"
        strokeWidth={1.5}
      />

      {/* Focusable hit area */}
      <foreignObject
        x={-(RING_R + 14)}
        y={-(RING_R + 8)}
        width={(RING_R + 14) * 2}
        height={RING_R * 2 + 60}
        style={{ overflow: "visible" }}
      >
        <Link
          href={href}
          className="block w-full h-full rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={`View tours in ${dest.name}${dest.country ? `, ${dest.country}` : ""}`}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </foreignObject>

      {/* Lucide icon centred in disc */}
      <foreignObject x={-12} y={-12} width={24} height={24} style={{ pointerEvents: "none" }}>
        <Icon
          style={{ color: meta.iconColor, display: "block", width: "24px", height: "24px" }}
          strokeWidth={2.2}
        />
      </foreignObject>

      {/* Name label with strong knockout stroke */}
      <text
        y={LABEL_Y}
        textAnchor="middle"
        fontSize="13"
        fontFamily="var(--app-font-serif)"
        fontStyle="italic"
        fontWeight={isActive ? "700" : "600"}
        fill={isActive ? meta.markerFill : "hsl(var(--foreground))"}
        stroke="hsl(var(--background))"
        strokeWidth="5"
        paintOrder="stroke"
        style={{ transition: "fill 0.2s", pointerEvents: "none" }}
      >
        {dest.name}
      </text>

      {/* Country label stays mounted to preserve the marker's SVG bounds. */}
      {dest.country && (
        <text
          y={LABEL_Y + 15}
          textAnchor="middle"
          fontSize="8.5"
          fontFamily="var(--app-font-sans)"
          fontWeight="600"
          fill={meta.markerFill}
          stroke="hsl(var(--background))"
          strokeWidth="4"
          paintOrder="stroke"
          opacity={isActive ? 1 : 0}
          style={{ pointerEvents: "none", letterSpacing: "0.1em", transition: "opacity 0.2s" }}
        >
          {dest.country.toUpperCase()}
        </text>
      )}
    </g>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function MapLegend({ categories }: { categories: Category[] }) {
  const unique = Array.from(new Set(categories)).filter((c) => c !== "unknown");
  if (unique.length === 0) return null;
  return (
    <div
      className="flex flex-wrap gap-2 mt-5 justify-center"
      aria-label="Map legend"
      role="list"
    >
      {unique.map((cat) => {
        const meta = CATEGORY_META[cat];
        const { Icon } = meta;
        return (
          <div
            key={cat}
            role="listitem"
            className="flex items-center gap-2 px-3 py-1.5 rounded-sm border border-border bg-card"
          >
            <span
              className="inline-flex items-center justify-center rounded-full w-6 h-6 shrink-0"
              style={{ backgroundColor: meta.markerFill }}
              aria-hidden="true"
            >
              <Icon style={{ color: meta.iconColor, width: "13px", height: "13px" }} strokeWidth={2.5} />
            </span>
            <span className="font-sans text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              {meta.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Active callout bar ───────────────────────────────────────────────────────

function ActiveCallout({
  activeItem,
  tours = [],
  toursLoading = false,
}: {
  activeItem: { dest: Destination; meta: CategoryMeta; category: Category } | null;
  tours?: Tour[];
  toursLoading?: boolean;
}) {
  return (
    <div
      className={cn(
        "mt-4 sm:hidden transition-all duration-300 overflow-hidden",
        activeItem ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
      )}
      aria-live="polite"
      aria-atomic="true"
    >
      {activeItem && (() => {
        const { Icon } = activeItem.meta;
        return (
            <div className="px-5 py-4 bg-card border border-border rounded-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="inline-flex items-center justify-center rounded-full w-10 h-10 shrink-0"
                    style={{ backgroundColor: activeItem.meta.markerFill }}
                  >
                    <Icon style={{ color: activeItem.meta.iconColor, width: "20px", height: "20px" }} strokeWidth={2} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-serif text-lg font-light italic text-foreground leading-tight truncate">
                      {activeItem.dest.name}
                    </p>
                    <p className="font-sans text-xs text-muted-foreground uppercase tracking-widest mt-0.5">
                      {[activeItem.dest.country, activeItem.dest.region, activeItem.meta.label]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/tours?destinationSlug=${encodeURIComponent(activeItem.dest.slug ?? "")}`}
                  className="font-sans text-xs font-semibold uppercase tracking-widest text-primary hover:text-foreground transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm px-3 py-2 border border-primary/40 hover:border-foreground/40 shrink-0"
                >
                  View Tours
                </Link>
              </div>

              <div className="mt-3 border-t border-border pt-3">
                <p className="mb-2 font-sans text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {toursLoading ? "Loading tours…" : `${tours.length} ${tours.length === 1 ? "tour" : "tours"} in this destination`}
                </p>
                <div className="space-y-2">
                  {toursLoading ? (
                    <p className="font-sans text-xs text-muted-foreground">Loading tours…</p>
                  ) : tours.length > 0 ? (
                    tours.map((tour) => (
                      <div key={tour.id} className="border-l-2 border-primary/40 pl-3">
                        <p className="font-serif text-sm text-foreground leading-tight">{tour.title}</p>
                        <p className="mt-1 font-sans text-[10px] uppercase tracking-widest text-muted-foreground">
                          {tour.durationDays} days
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="font-sans text-xs text-muted-foreground">No tours available yet.</p>
                  )}
                </div>
              </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface DestinationsMapProps {
  destinations: Destination[];
  tours: Tour[];
  toursLoading?: boolean;
}

export default function DestinationsMap({
  destinations,
  tours,
  toursLoading = false,
}: DestinationsMapProps) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const handleActivate = useCallback((id: number | null) => setActiveId(id), []);

  const graticuleD = buildGraticule();
  const subGraticuleD = buildSubGraticule();

  const enriched = destinations.map((dest) => {
    const coords = getCoords(dest.slug);
    const category = deriveCategory(dest.slug);
    const meta = CATEGORY_META[category];
    const [cx, cy] = coords ? proj(coords[0], coords[1]) : [null, null];
    return { dest, category, meta, cx, cy };
  });

  const mappable = enriched.filter((e) => e.cx !== null && e.cy !== null) as {
    dest: Destination;
    category: Category;
    meta: CategoryMeta;
    cx: number;
    cy: number;
  }[];

  const categories = enriched.map((e) => e.category);
  const routeLines = buildRouteLines(mappable);
  const activeItem = mappable.find((e) => e.dest.id === activeId) ?? null;
  const activeTours = activeItem
    ? tours.filter((tour) => tour.destinationId === activeItem.dest.id)
    : [];

  // Lat labels for reference lines
  const LAT_LABELS: { lat: number; label: string }[] = [
    { lat: 66.5,  label: "Arctic Circle" },
    { lat: 23.5,  label: "Tropic of Cancer" },
    { lat: 0,     label: "Equator" },
    { lat: -23.5, label: "Tropic of Capricorn" },
  ];

  return (
    <section
      className="max-w-7xl mx-auto px-6 pb-14 pt-6"
      aria-label="Interactive world destinations map"
      data-testid="destinations-map"
    >
        {/* ── Section label ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 mb-7">
          <div className="w-10 h-px bg-primary" />
          <p className="font-sans text-xs font-semibold uppercase tracking-widest text-primary">
            Expedition Atlas
          </p>
          <div className="flex-1 h-px bg-border/50" />
        </div>

        {/* ── Map frame ─────────────────────────────────────────────────── */}
        <div
          className="relative z-10 w-full rounded-sm overflow-visible"
          style={{
            border: "1px solid hsl(var(--border))",
            boxShadow:
              "0 6px 40px hsl(var(--foreground) / 0.07), 0 1px 4px hsl(var(--foreground) / 0.05)",
          }}
        >
          {/* Gold gradient top accent */}
          <div
            className="absolute top-0 left-0 right-0 h-0.5 z-10"
            style={{ background: "linear-gradient(to right, transparent, hsl(var(--primary)) 30%, hsl(var(--accent)) 70%, transparent)" }}
          />
          {/* Gold gradient bottom accent */}
          <div
            className="absolute bottom-0 left-0 right-0 h-px z-10"
            style={{ background: "linear-gradient(to right, transparent, hsl(var(--primary) / 0.4), transparent)" }}
          />

          <svg
            viewBox={`0 0 ${MAP_W} ${MAP_H}`}
            className="w-full block"
              style={{ height: "auto", maxHeight: "620px" }}
            role="img"
            aria-label="World map showing MNT Embark expedition destinations"
            data-testid="destinations-map-svg"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* ── Ocean ─────────────────────────────────────────────────── */}
              <linearGradient id="ocean" x1="0%" y1="0%" x2="10%" y2="100%">
                <stop offset="0%"   stopColor="hsl(var(--chart-4))" stopOpacity="0.55" />
                <stop offset="40%"  stopColor="hsl(var(--secondary))" stopOpacity="0.9" />
                <stop offset="100%" stopColor="hsl(var(--muted))" stopOpacity="1" />
              </linearGradient>

              {/* ── Land parchment ────────────────────────────────────────── */}
              {/* Base warm parchment */}
              <linearGradient id="land" x1="10%" y1="0%" x2="90%" y2="100%">
                <stop offset="0%"   stopColor="hsl(var(--accent))"  stopOpacity="0.62" />
                <stop offset="50%"  stopColor="hsl(var(--card))"    stopOpacity="1" />
                <stop offset="100%" stopColor="hsl(var(--accent))"  stopOpacity="0.48" />
              </linearGradient>

              {/* Inner warm tint layered on top */}
              <linearGradient id="landWarm" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor="hsl(var(--primary))" stopOpacity="0.06" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.14" />
              </linearGradient>

              {/* Edge vignette */}
              <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
                <stop offset="55%" stopColor="transparent" />
                <stop offset="100%" stopColor="hsl(var(--chart-4))" stopOpacity="0.28" />
              </radialGradient>

              {/* Polar ice cap tint */}
              <linearGradient id="polarTint" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%"   stopColor="hsl(var(--chart-4))" stopOpacity="0.38" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>

              {/* Desert warm tint */}
              <radialGradient id="desertTint" cx="55%" cy="45%" r="55%">
                <stop offset="0%"   stopColor="hsl(var(--primary))" stopOpacity="0.2" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>

              {/* ── Filters ───────────────────────────────────────────────── */}

              {/* Subtle sketch displacement — small scale keeps shapes recognisable */}
              <filter id="sketch" x="-3%" y="-3%" width="106%" height="106%">
                <feTurbulence type="fractalNoise" baseFrequency="1.2 0.9" numOctaves="3" seed="5" result="noise" />
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5" xChannelSelector="R" yChannelSelector="G" />
              </filter>

              {/* Glow for markers */}
              <filter id="markerGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* ── Patterns ──────────────────────────────────────────────── */}

              {/* Fine diagonal hatch on land */}
              <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
                <line x1="0" y1="0" x2="0" y2="7" stroke="hsl(var(--primary))" strokeWidth="0.55" opacity="0.28" />
              </pattern>

              {/* Cross-hatch for topographic depth */}
              <pattern id="xhatch" width="12" height="12" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="12" y2="12" stroke="hsl(var(--primary))" strokeWidth="0.4" opacity="0.15" />
                <line x1="12" y1="0" x2="0" y2="12" stroke="hsl(var(--primary))" strokeWidth="0.4" opacity="0.15" />
              </pattern>

              {/* Subtle ocean dot grid */}
              <pattern id="oceanGrid" width="22" height="22" patternUnits="userSpaceOnUse">
                <circle cx="11" cy="11" r="0.9" fill="hsl(var(--chart-4))" opacity="0.22" />
              </pattern>

              {/* Map boundary clip */}
              <clipPath id="bounds">
                <rect width={MAP_W} height={MAP_H} />
              </clipPath>

              {/* Real country paths are also the mask for illustrated land washes. */}
              <clipPath id="landMask">
                {WORLD_COUNTRY_PATHS.map((country) => (
                  <path key={`mask-${country.id}`} d={country.d} />
                ))}
              </clipPath>
            </defs>

            <g clipPath="url(#bounds)">

              {/* ── Ocean ─────────────────────────────────────────────────── */}
              <rect width={MAP_W} height={MAP_H} fill="url(#ocean)" />
              <rect width={MAP_W} height={MAP_H} fill="url(#oceanGrid)" opacity={0.7} />

              {/* Polar ice cap tint (top ~15%) */}
              <rect
                x={0} y={0} width={MAP_W}
                height={proj(55, 0)[1]}
                fill="url(#polarTint)"
                style={{ pointerEvents: "none" }}
              />

              {/* Desert warm wash */}
              <rect
                x={proj(0, -20)[0]}
                y={proj(40, 0)[1]}
                width={proj(0, 60)[0] - proj(0, -20)[0]}
                height={proj(-10, 0)[1] - proj(40, 0)[1]}
                fill="url(#desertTint)"
                opacity={0.55}
                style={{ pointerEvents: "none" }}
              />

              {/* ── Sub-graticule ─────────────────────────────────────────── */}
              <path
                d={subGraticuleD}
                fill="none"
                stroke="hsl(var(--chart-4))"
                strokeWidth="0.35"
                opacity="0.2"
              />

              {/* ── Major graticule ───────────────────────────────────────── */}
              <path
                d={graticuleD}
                fill="none"
                stroke="hsl(var(--chart-4))"
                strokeWidth="0.8"
                strokeDasharray="5 9"
                opacity="0.42"
              />

              {/* ── Reference latitude lines ──────────────────────────────── */}
              {LAT_LABELS.map(({ lat, label }) => {
                const [, y] = proj(lat, 0);
                const isEq = lat === 0;
                return (
                  <g key={label}>
                    <line
                      x1={0} y1={y.toFixed(1)} x2={MAP_W} y2={y.toFixed(1)}
                      stroke="hsl(var(--primary))"
                      strokeWidth={isEq ? 1.1 : 0.65}
                      strokeDasharray={isEq ? "6 8" : "2 11"}
                      opacity={isEq ? 0.6 : 0.38}
                    />
                    <text
                      x={10}
                      y={y - 4}
                      fontSize="7"
                      fontFamily="var(--app-font-serif)"
                      fontStyle="italic"
                      fill="hsl(var(--primary))"
                      opacity={isEq ? 0.72 : 0.45}
                    >
                      {label}
                    </text>
                  </g>
                );
              })}

              {/* ── Wave marks ────────────────────────────────────────────── */}
              {[95, 195, 310, 400, 480, 540].map((y) => (
                <path
                  key={`w${y}`}
                  d={`M 0,${y} C 150,${y - 6} 300,${y + 6} 450,${y} C 600,${y - 6} 750,${y + 6} 900,${y} C 1050,${y - 5} 1150,${y + 5} 1200,${y}`}
                  fill="none"
                  stroke="hsl(var(--chart-4))"
                  strokeWidth="0.75"
                  opacity="0.28"
                />
              ))}

              {/* ── Geographic land base ──────────────────────────────────── */}
              {/* These country boundaries are drawn from real geographic data. */}
              <g aria-label="Geographic country outlines">
                {WORLD_COUNTRY_PATHS.map((country) => (
                  <path
                    key={country.id}
                    d={country.d}
                    fill="url(#land)"
                    stroke="hsl(var(--primary))"
                    strokeWidth="0.55"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                ))}
              </g>

              {/* ── Illustrated overlay, clipped to real coastlines ───────── */}
              <g clipPath="url(#landMask)" style={{ pointerEvents: "none" }}>
                <rect width={MAP_W} height={MAP_H} fill="url(#landWarm)" />
                <rect width={MAP_W} height={MAP_H} fill="url(#hatch)" opacity={0.72} />
                <rect width={MAP_W} height={MAP_H} fill="url(#xhatch)" opacity={0.34} />

                {/* Location-led watercolor fields add color without changing geography. */}
                <ellipse
                  cx={proj(64, -20)[0]}
                  cy={proj(64, -20)[1]}
                  rx="205"
                  ry="94"
                  fill="hsl(var(--chart-4) / 0.2)"
                />
                <ellipse
                  cx={proj(27, 10)[0]}
                  cy={proj(27, 10)[1]}
                  rx="250"
                  ry="126"
                  fill="hsl(var(--primary) / 0.18)"
                />
                <ellipse
                  cx={proj(-36, -67)[0]}
                  cy={proj(-36, -67)[1]}
                  rx="178"
                  ry="118"
                  fill="hsl(var(--chart-2) / 0.2)"
                />
                <ellipse
                  cx={proj(5, 79)[0]}
                  cy={proj(5, 79)[1]}
                  rx="170"
                  ry="82"
                  fill="hsl(var(--chart-3) / 0.18)"
                />
              </g>

              {/* ── Edge vignette ─────────────────────────────────────────── */}
              <rect width={MAP_W} height={MAP_H} fill="url(#vignette)" style={{ pointerEvents: "none" }} />

              {/* ── Decorative route lines ────────────────────────────────── */}
              {routeLines.map((route) => (
                <path
                  key={route.id}
                  d={route.d}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="1.2"
                  strokeDasharray="5 9"
                  opacity="0.35"
                  style={{ pointerEvents: "none" }}
                />
              ))}

              {/* Small arrowheads along routes (halfway point markers) */}
              {routeLines.map((route) => {
                // Extract midpoint from quadratic bezier path
                const match = route.d.match(/Q ([\d.]+),([\d.]+)/);
                if (!match) return null;
                const mx = parseFloat(match[1]);
                const my = parseFloat(match[2]);
                return (
                  <circle
                    key={`rm-${route.id}`}
                    cx={mx} cy={my} r={2.5}
                    fill="hsl(var(--primary))"
                    opacity={0.3}
                    style={{ pointerEvents: "none" }}
                  />
                );
              })}

              {/* ── Destination contours ──────────────────────────────────── */}
              {mappable.map(({ cx, cy, category, dest }) => (
                <g key={`contour-${dest.id}`} style={{ pointerEvents: "none" }}>
                  <DestinationContours cx={cx} cy={cy} category={category} />
                </g>
              ))}

              {/* ── Compass rose ──────────────────────────────────────────── */}
              <CompassRose x={MAP_W - 72} y={MAP_H - 72} />

              {/* ── Atlas title ───────────────────────────────────────────── */}
              <text
                x={16} y={22}
                fontSize="13"
                fontFamily="var(--app-font-serif)"
                fontStyle="italic"
                fontWeight="600"
                fill="hsl(var(--primary))"
                opacity="0.82"
              >
                MNT Embark
              </text>
              <text
                x={16} y={38}
                fontSize="9"
                fontFamily="var(--app-font-serif)"
                fontStyle="italic"
                fill="hsl(var(--primary))"
                opacity="0.56"
                letterSpacing="1.5"
              >
                EXPEDITION ATLAS
              </text>
              {/* Decorative line under title */}
              <line
                x1={16} y1={42} x2={130} y2={42}
                stroke="hsl(var(--primary))"
                strokeWidth="0.6"
                opacity="0.4"
              />

              {/* ── Lat/lng reference labels ──────────────────────────────── */}
              {[-60, -30, 30, 60].map((lat) => {
                const [, y] = proj(lat, 0);
                return (
                  <text
                    key={`ll-${lat}`}
                    x={6} y={y + 4}
                    fontSize="6"
                    fontFamily="var(--app-font-serif)"
                    fill="hsl(var(--primary))"
                    opacity="0.38"
                  >
                    {Math.abs(lat)}°{lat >= 0 ? "N" : "S"}
                  </text>
                );
              })}

              {/* ── Destination markers ───────────────────────────────────── */}
              {mappable.map(({ dest, category, meta, cx, cy }) => (
                <g key={dest.id}>
                  <DestinationMarker
                    dest={dest}
                    cx={cx}
                    cy={cy}
                    category={category}
                    meta={meta}
                    isActive={activeId === dest.id}
                    onActivate={handleActivate}
                  />
                </g>
              ))}

            </g>
          </svg>

          {/* Keep hover details in HTML. SVG groups do not provide a stable
              anchor for popper positioning, so this panel uses the same
              projected coordinates as the marker instead. */}
          {activeItem && (
            <div
              role="tooltip"
              data-testid={`destination-tour-hover-${activeItem.dest.id}`}
              className="pointer-events-none absolute z-20 hidden w-[min(19rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-sm border border-primary/30 bg-primary px-4 py-3 text-primary-foreground shadow-lg sm:block"
              style={{
                left: `clamp(10.5rem, ${(activeItem.cx / MAP_W) * 100}%, calc(100% - 10.5rem))`,
                top: `${(activeItem.cy / MAP_H) * 100}%`,
                transform: activeItem.cy < 150
                  ? "translate(-50%, 18px)"
                  : "translate(-50%, calc(-100% - 18px))",
              }}
            >
              <div className="flex items-start justify-between gap-3 border-b border-primary-foreground/20 pb-2">
                <div className="min-w-0">
                  <p className="truncate font-serif text-base font-light italic">
                    {activeItem.dest.name}
                  </p>
                  <p className="mt-0.5 font-sans text-[10px] uppercase tracking-widest opacity-75">
                    {[activeItem.dest.country, activeItem.meta.label]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span className="shrink-0 font-sans text-[10px] font-semibold uppercase tracking-widest opacity-80">
                  {toursLoading ? "…" : `${activeTours.length} ${activeTours.length === 1 ? "tour" : "tours"}`}
                </span>
              </div>

              <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto pr-1">
                {toursLoading ? (
                  <p className="font-sans text-xs opacity-80">Loading tours…</p>
                ) : activeTours.length > 0 ? (
                  activeTours.map((tour) => (
                    <div
                      key={tour.id}
                      className="border-l border-primary-foreground/40 py-1 pl-2 text-left"
                    >
                      <p className="font-serif text-sm leading-tight">{tour.title}</p>
                      <p className="mt-1 font-sans text-[10px] uppercase tracking-widest opacity-70">
                        {tour.durationDays} days
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="font-sans text-xs opacity-80">No tours available yet.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Active callout ─────────────────────────────────────────────── */}
        <ActiveCallout
          activeItem={activeItem}
          tours={activeTours}
          toursLoading={toursLoading}
        />

        {/* ── Legend ─────────────────────────────────────────────────────── */}
        <MapLegend categories={categories} />
    </section>
  );
}
