/**
 * Shared tour card components.
 *
 * TourCard  — grid-style card used on the home page carousel section.
 * TourRow   — horizontal list-row used on the /tours page.
 *
 * Badge rules (tours.classification):
 *   exclusive → most prominent: solid gold fill (default variant)
 *   special   → secondary:      muted outline
 *   standard  → no badge at all
 *
 * tours.featured is intentionally NOT shown as a badge.
 * It controls homepage placement only.
 */

import { Link } from "wouter";
import { Badge } from "@workspace/mnt-embark/components/ui/badge";
import { MapPin, Clock, ArrowRight } from "lucide-react";
import type { Tour } from "@workspace/api-client-react";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Badge for tours.classification.
 * Returns null for "standard" or any null/undefined value.
 */
function ClassificationBadge({
  classification,
  block = false,
}: {
  classification?: string | null;
  /** When true, renders as block (above a title in list rows). */
  block?: boolean;
}) {
  if (classification === "exclusive") {
    return (
      <Badge
        variant="default"
        className={`font-sans text-xs uppercase tracking-widest shrink-0${block ? " mb-2" : ""}`}
      >
        Exclusive
      </Badge>
    );
  }
  if (classification === "special") {
    return (
      <Badge
        variant="outline"
        className={`border-muted-foreground/50 text-muted-foreground font-sans text-xs uppercase tracking-widest shrink-0${block ? " mb-2" : ""}`}
      >
        Special
      </Badge>
    );
  }
  return null;
}

/**
 * Display string for the tour's physical place.
 * Prefers the joined "Location, Country" from the DB relations.
 * Falls back to the legacy tour.location text field if joins are absent.
 */
function tourPlace(tour: Tour): string {
  const locationName = (tour as { locationName?: string | null }).locationName;
  const countryName = (tour as { countryName?: string | null }).countryName;
  if (locationName) {
    // Deduplicate when both names are identical (e.g. locations named "Iceland"
    // inside a country also named "Iceland").
    const parts = [locationName, countryName].filter(
      (v, i, arr) => Boolean(v) && arr.indexOf(v) === i,
    );
    return parts.join(", ");
  }
  return tour.location;
}

// ── TourCard (grid) ───────────────────────────────────────────────────────────

export function TourCard({ tour }: { tour: Tour }) {
  const classification = (tour as { classification?: string | null }).classification;

  return (
    <Link
      href={`/tours/${tour.slug ?? tour.id}`}
      data-testid={`tour-card-${tour.id}`}
      className="group relative bg-card border border-border/40 overflow-hidden rounded hover:border-primary/40 transition-colors duration-300 block"
    >
      <div className="aspect-[16/10] overflow-hidden">
        <img
          src={tour.coverImage}
          alt={tour.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      </div>

      <div className="p-6">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-serif text-xl font-light text-foreground leading-tight">
            {tour.title}
          </h3>
          {classification && classification !== "standard" && (
            <span className="ml-2 shrink-0">
              <ClassificationBadge classification={classification} />
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-muted-foreground mb-4">
          <MapPin className="h-3 w-3 text-primary" />
          <span className="font-sans text-xs">{tourPlace(tour)}</span>
        </div>

        <div className="flex items-center">
          <span className="font-sans text-xs text-muted-foreground">
            {tour.durationDays} days
          </span>
        </div>
      </div>

      {/* Gold accent bar */}
      <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-primary/0 group-hover:bg-primary/60 transition-all duration-300" />
    </Link>
  );
}

// ── TourRow (list) ────────────────────────────────────────────────────────────

export function TourRow({ tour }: { tour: Tour }) {
  const classification = (tour as { classification?: string | null }).classification;

  return (
    <Link
      href={`/tours/${tour.slug ?? tour.id}`}
      data-testid={`tour-row-${tour.id}`}
      className="group relative flex gap-6 bg-card border border-border/40 rounded overflow-hidden hover:border-primary/40 transition-all duration-300 block"
    >
      {/* Image */}
      <div className="w-48 md:w-64 shrink-0 overflow-hidden">
        <img
          src={tour.coverImage}
          alt={tour.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          style={{ minHeight: "160px" }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 py-6 pr-6 flex flex-col justify-between">
        <div>
          <div className="mb-2">
            <div>
              {/* Badge sits above the title when present */}
              <ClassificationBadge classification={classification} block />
              <h3 className="font-serif text-2xl font-light text-foreground leading-tight">
                {tour.title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-2 mb-3">
            <div className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-3 w-3 text-primary" />
              <span className="font-sans text-xs">{tourPlace(tour)}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3 text-primary" />
              <span className="font-sans text-xs">{tour.durationDays} days</span>
            </div>
          </div>

          <p className="font-sans text-sm text-muted-foreground leading-relaxed line-clamp-2">
            {tour.description}
          </p>
        </div>

        <div className="flex items-center mt-4">
          <span className="font-sans text-xs text-primary uppercase tracking-widest flex items-center gap-1 transition-all group-hover:gap-2">
            View Itinerary <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </div>

      {/* Gold accent right edge */}
      <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-primary/0 group-hover:bg-primary/60 transition-all duration-300" />
    </Link>
  );
}
