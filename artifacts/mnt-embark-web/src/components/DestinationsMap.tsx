import { useState, useCallback, useRef, useEffect } from "react";
import { Link } from "wouter";
import { Mountain, Waves, Wind, type LucideProps } from "lucide-react";
import countriesTopology from "world-atlas/countries-110m.json";
import { feature } from "topojson-client";
import type { Tour } from "@workspace/api-client-react";
import { cn } from "@workspace/mnt-embark/lib/utils";
import {
  MAP_W,
  MAP_H,
  proj,
  resolveDefaultCountryCoords,
  COUNTRY_DEFAULT_COORDINATES,
} from "@/lib/countryCoordinates";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DestinationCountryItem {
  id: number;
  slug: string;
  name: string;
  code?: string | null;
  image?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface Destination {
  id: number;
  slug?: string | null;
  name: string;
  country?: string | null;
  region?: string | null;
  description?: string | null;
  coverImage?: string | null;
  countries?: DestinationCountryItem[];
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

type Category = "wilderness" | "island" | "unknown";

const SLUG_CATEGORY_MAP: Record<string, Category> = {
  patagonia: "wilderness",
  "the-maldives": "island",
};

function deriveCategory(slug: string | null | undefined): Category {
  if (!slug) return "unknown";
  return SLUG_CATEGORY_MAP[slug.toLowerCase()] ?? "unknown";
}

const CATEGORY_META: Record<Category, CategoryMeta> = {
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
    markerFill: "hsl(var(--primary))",
    markerStroke: "hsl(var(--background))",
    iconColor: "hsl(var(--primary-foreground))",
    regionFill: "hsl(var(--primary) / 0.15)",
    glowColor: "hsl(var(--primary) / 0.25)",
  },
};

// ─── Projection helpers ───────────────────────────────────────────────────────

// Helpers so we can write coordinates as (lat, lng) tuples
function p(lat: number, lng: number) {
  const [x, y] = proj(lat, lng);
  return `${x.toFixed(1)},${y.toFixed(1)}`;
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
  if (!Array.isArray(ring) || ring.length < 3) return "";

  const points = ring.filter(
    (point): point is [number, number] =>
      Array.isArray(point) &&
      typeof point[0] === "number" &&
      typeof point[1] === "number"
  );

  if (points.length < 3) return "";

  // Unwrap longitudes so adjacent vertices never jump by > 180 degrees
  // This preserves the natural, continuous curvature of eastern Russia / Chukotka
  const unwrapped: [number, number][] = [points[0]];
  let currentOffset = 0;

  for (let i = 1; i < points.length; i++) {
    const prevRawLng = points[i - 1][0];
    const currRawLng = points[i][0];
    const dLng = currRawLng - prevRawLng;

    if (dLng < -180) {
      currentOffset += 360;
    } else if (dLng > 180) {
      currentOffset -= 360;
    }

    const unwrappedLng = currRawLng + currentOffset;
    unwrapped.push([unwrappedLng, points[i][1]]);
  }

  const lngs = unwrapped.map((pt) => pt[0]);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  if (maxLng - minLng <= 360) {
    const avgLng = (minLng + maxLng) / 2;
    let shift = 0;
    if (avgLng < -180) shift = 360;
    else if (avgLng > 360) shift = -360;

    const commands = unwrapped.map(([lng, lat], idx) => {
      return `${idx === 0 ? "M" : "L"} ${p(lat, lng + shift)}`;
    });
    return `${commands.join(" ")} Z`;
  }

  // Fallback for global wrapping polygons
  const commands = points.map(([lng, lat], index) => `${index === 0 ? "M" : "L"} ${p(lat, lng)}`);
  return `${commands.join(" ")} Z`;
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

export const WORLD_COUNTRY_PATHS = countriesFeatureCollection.features
  .map((country, index) => ({
    id: String(country.id ?? index),
    d: geometryToPath(country.geometry),
  }))
  .filter((country) => country.d.length > 0);

// ─── Resolve destination / country coordinates ───────────────────────────────

function getDestinationCoords(
  dest: Destination,
  allCountries: DestinationCountryItem[] = [],
): [number, number] | null {
  // 1. Check if any linked country has explicit lat/lng
  if (dest.countries && dest.countries.length > 0) {
    for (const c of dest.countries) {
      if (
        c.latitude !== null &&
        c.latitude !== undefined &&
        c.longitude !== null &&
        c.longitude !== undefined
      ) {
        return [c.latitude, c.longitude];
      }
    }
  }

  // 2. Check matching country in allCountries
  const match = allCountries.find(
    (c) =>
      (dest.country && c.name.toLowerCase() === dest.country.toLowerCase()) ||
      (dest.slug && c.slug.toLowerCase() === dest.slug.toLowerCase()) ||
      (c.code && dest.slug && c.code.toLowerCase() === dest.slug.toLowerCase()) ||
      (dest.name && c.name.toLowerCase() === dest.name.toLowerCase()),
  );
  if (
    match &&
    match.latitude !== null &&
    match.latitude !== undefined &&
    match.longitude !== null &&
    match.longitude !== undefined
  ) {
    return [match.latitude, match.longitude];
  }

  // 3. Fallback to country / slug dictionary
  const bySlug = resolveDefaultCountryCoords(dest.name, null, dest.slug);
  if (bySlug) return bySlug;

  if (dest.country) {
    const byCountry = resolveDefaultCountryCoords(dest.country, null, null);
    if (byCountry) return byCountry;
  }

  if (dest.slug && COUNTRY_DEFAULT_COORDINATES[dest.slug.toLowerCase()]) {
    return COUNTRY_DEFAULT_COORDINATES[dest.slug.toLowerCase()];
  }

  return null;
}

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
  pinImage?: string | null;
  onActivate: (id: number | null) => void;
}

function DestinationMarker({ dest, cx, cy, meta, isActive, pinImage, onActivate }: MarkerProps) {
  const slug = encodeURIComponent(dest.slug ?? "");
  const isCountryOnly = dest.id < 0;
  const href = isCountryOnly ? `/tours?countrySlug=${slug}` : `/tours?destinationSlug=${slug}`;
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
      onMouseMove={handleMouseEnter}
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
          onMouseEnter={handleMouseEnter}
          onMouseMove={handleMouseEnter}
        />
      </foreignObject>

      {/* Lucide icon or custom Country/Destination Pin Image centred in disc */}
      {pinImage ? (
        <foreignObject
          x={-DISC_R + 1}
          y={-DISC_R + 1}
          width={(DISC_R - 1) * 2}
          height={(DISC_R - 1) * 2}
          style={{ pointerEvents: "none" }}
        >
          <img
            src={pinImage}
            alt={dest.name}
            className="w-full h-full object-cover rounded-full shadow-inner border border-background bg-card"
          />
        </foreignObject>
      ) : (
        <foreignObject x={-12} y={-12} width={24} height={24} style={{ pointerEvents: "none" }}>
          <Icon
            style={{ color: meta.iconColor, display: "block", width: "24px", height: "24px" }}
            strokeWidth={2.2}
          />
        </foreignObject>
      )}

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

      {/* Country label only if different from destination name */}
      {dest.country && dest.country.trim().toLowerCase() !== dest.name.trim().toLowerCase() && (
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
  countries?: DestinationCountryItem[];
  tours: Tour[];
  toursLoading?: boolean;
}

export default function DestinationsMap({
  destinations,
  countries = [],
  tours,
  toursLoading = false,
}: DestinationsMapProps) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const handleActivate = useCallback(
    (id: number | null) => {
      clearCloseTimeout();
      if (id !== null) {
        setActiveId(id);
      } else {
        closeTimeoutRef.current = setTimeout(() => {
          setActiveId(null);
        }, 280);
      }
    },
    [clearCloseTimeout]
  );

  const handlePopupMouseEnter = useCallback(() => {
    clearCloseTimeout();
  }, [clearCloseTimeout]);

  const handlePopupMouseLeave = useCallback(() => {
    clearCloseTimeout();
    closeTimeoutRef.current = setTimeout(() => {
      setActiveId(null);
    }, 280);
  }, [clearCloseTimeout]);

  useEffect(() => {
    return () => {
      clearCloseTimeout();
    };
  }, [clearCloseTimeout]);

  const graticuleD = buildGraticule();
  const subGraticuleD = buildSubGraticule();

  // 1. Destination items with resolved coordinates and custom images
  const destinationItems = destinations.map((dest) => {
    const coords = getDestinationCoords(dest, countries);
    const category = deriveCategory(dest.slug);
    const meta = CATEGORY_META[category];
    const [cx, cy] = coords ? proj(coords[0], coords[1]) : [null, null];
    const pinImage =
      dest.countries?.find((c) => c.image)?.image ||
      countries.find((c) => dest.country && c.name.toLowerCase() === dest.country.toLowerCase())?.image ||
      dest.coverImage ||
      null;
    return { dest, category, meta, cx, cy, pinImage };
  });

  // 2. Identify standalone countries not represented by destinations
  const linkedCountrySlugs = new Set<string>();
  destinations.forEach((d) => {
    d.countries?.forEach((c) => linkedCountrySlugs.add(c.slug.toLowerCase()));
    if (d.country) linkedCountrySlugs.add(d.country.toLowerCase());
    if (d.slug) linkedCountrySlugs.add(d.slug.toLowerCase());
  });

  const standaloneCountryItems = countries
    .filter(
      (c) =>
        !linkedCountrySlugs.has(c.slug.toLowerCase()) &&
        !linkedCountrySlugs.has(c.name.toLowerCase()),
    )
    .map((country) => {
      const coords: [number, number] | null =
        country.latitude !== null &&
        country.latitude !== undefined &&
        country.longitude !== null &&
        country.longitude !== undefined
          ? [country.latitude, country.longitude]
          : resolveDefaultCountryCoords(country.name, country.code, country.slug);

      const [cx, cy] = coords ? proj(coords[0], coords[1]) : [null, null];
      const category: Category = "unknown";
      const meta = CATEGORY_META[category];
      const destProxy: Destination = {
        id: -country.id,
        slug: country.slug,
        name: country.name,
        country: country.name,
        coverImage: country.image,
      };
      return {
        dest: destProxy,
        category,
        meta,
        cx,
        cy,
        pinImage: country.image || null,
      };
    });

  const enriched = [...destinationItems, ...standaloneCountryItems];

  const mappable = enriched.filter((e) => e.cx !== null && e.cy !== null) as {
    dest: Destination;
    category: Category;
    meta: CategoryMeta;
    cx: number;
    cy: number;
    pinImage?: string | null;
  }[];

  const routeLines = buildRouteLines(mappable);
  const activeItem = mappable.find((e) => e.dest.id === activeId) ?? null;
  const activeTours = activeItem
    ? tours.filter((tour) =>
        activeItem.dest.id < 0 ? true : tour.destinationId === activeItem.dest.id,
      )
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
              {mappable.map(({ dest, category, meta, cx, cy, pinImage }) => (
                <g key={dest.id}>
                  <DestinationMarker
                    dest={dest}
                    cx={cx}
                    cy={cy}
                    category={category}
                    meta={meta}
                    isActive={activeId === dest.id}
                    pinImage={pinImage}
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
              onMouseEnter={handlePopupMouseEnter}
              onMouseLeave={handlePopupMouseLeave}
              className={cn(
                "pointer-events-auto absolute z-20 hidden w-[min(19rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-sm border border-primary/30 bg-primary px-4 py-3 text-primary-foreground shadow-lg sm:block",
                activeItem.cy < 150
                  ? "before:absolute before:left-0 before:right-0 before:bottom-full before:h-6 before:content-['']"
                  : "after:absolute after:left-0 after:right-0 after:top-full after:h-6 after:content-['']"
              )}
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
                    <Link
                      key={tour.id}
                      href={`/tours/${tour.slug}`}
                      className="block border-l border-primary-foreground/40 py-1 pl-2 text-left transition-colors hover:border-primary-foreground hover:bg-primary-foreground/10 rounded-r-sm cursor-pointer"
                    >
                      <p className="font-serif text-sm leading-tight hover:underline">{tour.title}</p>
                      <p className="mt-1 font-sans text-[10px] uppercase tracking-widest opacity-70">
                        {tour.durationDays} days
                      </p>
                    </Link>
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
    </section>
  );
}
