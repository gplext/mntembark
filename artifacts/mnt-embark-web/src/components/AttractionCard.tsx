/**
 * Attraction cards.
 *
 * AttractionCard  grid card: home page, destination and category pages.
 * AttractionRow   list row: /attractions and the activity pages.
 *
 * Badge rules follow the tour cards they replace: exclusive is a solid gold
 * badge, special an outline, standard nothing. `featured` is homepage
 * placement, never a badge.
 */

import { Link } from "wouter";
import { Badge } from "@workspace/mnt-embark/components/ui/badge";
import { MapPin, Clock, ArrowRight, BedDouble } from "lucide-react";
import { placeOf, type Attraction } from "@/lib/attractions-api";

export function ClassificationBadge({
  classification,
  block = false,
}: {
  classification?: string | null;
  block?: boolean;
}) {
  if (classification === "exclusive") {
    return (
      <Badge variant="default" className={`font-sans text-xs uppercase tracking-widest shrink-0${block ? " mb-2" : ""}`}>
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

/** "Hotels available", the line that stands in for the old hotel pages. */
export function HotelsNote({ attraction, withNote = false }: { attraction: Attraction; withNote?: boolean }) {
  if (!attraction.hotelsAvailable) return null;
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground" data-testid="hotels-available">
      <BedDouble className="h-3 w-3 text-primary" />
      <span className="font-sans text-xs">
        Hotels available
        {withNote && attraction.stayNote ? ` · ${attraction.stayNote}` : ""}
      </span>
    </span>
  );
}

export function AttractionCard({ attraction: a }: { attraction: Attraction }) {
  return (
    <Link
      href={`/attractions/${a.slug}`}
      data-testid={`attraction-card-${a.id}`}
      className="group relative bg-card border border-border/40 overflow-hidden rounded hover:border-primary/40 transition-colors duration-300 block"
    >
      <div className="aspect-[16/10] overflow-hidden">
        <img
          src={a.coverImage}
          alt={a.name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      </div>
      <div className="p-6">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-serif text-xl font-light text-foreground leading-tight">{a.name}</h3>
          {a.classification !== "standard" && (
            <span className="ml-2 shrink-0">
              <ClassificationBadge classification={a.classification} />
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-muted-foreground mb-3">
          <MapPin className="h-3 w-3 text-primary" />
          <span className="font-sans text-xs">{placeOf(a)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {a.visitDuration && <span className="font-sans text-xs text-muted-foreground">{a.visitDuration}</span>}
          <HotelsNote attraction={a} />
        </div>
      </div>
      <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-primary/0 group-hover:bg-primary/60 transition-all duration-300" />
    </Link>
  );
}

export function AttractionRow({ attraction: a }: { attraction: Attraction }) {
  return (
    <Link
      href={`/attractions/${a.slug}`}
      data-testid={`attraction-row-${a.id}`}
      className="group relative flex flex-col sm:flex-row gap-0 sm:gap-6 bg-card border border-border/40 rounded overflow-hidden hover:border-primary/40 transition-all duration-300"
    >
      <div className="sm:w-64 shrink-0 overflow-hidden aspect-[16/10] sm:aspect-auto">
        <img
          src={a.coverImage}
          alt={a.name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          style={{ minHeight: "160px" }}
        />
      </div>
      <div className="flex-1 p-6 sm:pl-0 flex flex-col justify-between">
        <div>
          <ClassificationBadge classification={a.classification} block />
          <h3 className="font-serif text-2xl font-light text-foreground leading-tight">{a.name}</h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 mb-3">
            <span className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-3 w-3 text-primary" />
              <span className="font-sans text-xs">{placeOf(a)}</span>
            </span>
            {a.visitDuration && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3 text-primary" />
                <span className="font-sans text-xs">{a.visitDuration}</span>
              </span>
            )}
            <HotelsNote attraction={a} />
          </div>
          <p className="font-sans text-sm text-muted-foreground leading-relaxed line-clamp-2">
            {a.summary ?? a.description}
          </p>
        </div>
        <div className="flex items-center mt-4">
          <span className="font-sans text-xs text-primary uppercase tracking-widest flex items-center gap-1 transition-all group-hover:gap-2">
            View attraction <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </div>
      <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-primary/0 group-hover:bg-primary/60 transition-all duration-300" />
    </Link>
  );
}
