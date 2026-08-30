/**
 * /activities — editorial index of every activity, grouped by category.
 *
 * Data: useListActivityFilters() → ActivityFilterGroup[]
 *
 * Every card shows the activity's own stored name, description and cover image,
 * and each section's intro is the group's own description. All of it used to be
 * hardcoded here and took precedence over the database, which is why anything
 * written in the admin panel never appeared on this page.
 */

import { Link } from "wouter";
import {
  useListActivityFilters,
  getListActivityFiltersQueryKey,
} from "@workspace/api-client-react";
import type { ActivityFilterGroup } from "@workspace/api-client-react";
import { Skeleton } from "@workspace/mnt-embark/components/ui/skeleton";
import { Separator } from "@workspace/mnt-embark/components/ui/separator";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import { cn } from "@workspace/mnt-embark/lib/utils";
import { ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { DestinationCoverImage } from "@/components/DestinationCoverImage";

/*
 * Small gold kicker sitting above each group's serif heading, mirroring the
 * page header's "Curated Experiences" / "Activities" pairing. Keyed by slug and
 * Keyed by slug, and the one piece of this section's copy still held in the
 * page rather than the database.
 *
 * A group with no entry here falls back to its size rather than to a guessed
 * phrase — see groupKicker below.
 */
const GROUP_KICKERS: Record<string, string> = {
  "water": "Ocean, Reef & River",
  "land-adventure": "Terrain & Wilderness",
  "culture": "Traditions & Craft",
  "culture-entertainment": "Traditions & Craft",
  "food-drink": "Table & Vineyard",
  "wellness": "Thermal & Restorative",
  "in-air": "Flight & Altitude",
};

function groupKicker(group: ActivityFilterGroup): string {
  const kicker = GROUP_KICKERS[group.groupSlug];
  if (kicker) return kicker;
  const n = group.activities.length;
  return `${n} ${n === 1 ? "Experience" : "Experiences"}`;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <Navbar />
      <div className="pt-24 pb-12 border-b border-border/30">
        <div className="max-w-7xl mx-auto px-6">
          <Skeleton className="h-3 w-28 mb-3" />
          <Skeleton className="h-12 w-72 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-16 space-y-20">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="h-4 w-32 mb-6" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, j) => (
                <Skeleton key={j} className="h-24 rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Activity tile ─────────────────────────────────────────────────────────────

interface ActivityTileProps {
  slug: string;
  name: string;
  description: string | null;
  coverImage: string | null;
  count: number;
}

/**
 * Shows what is stored for the activity, and nothing else.
 *
 * This card used to read from a hardcoded map keyed by slug, with a generic
 * blurb and a stock photograph for anything not in it. So a description and
 * image written in the admin panel were invisible here and only appeared on the
 * activity's own page, while every card advertised copy nobody had written.
 *
 * An activity with no description now shows none — a card with a title and a
 * tour count is honest, and the empty space is what tells you there is writing
 * still to do. Same for the image: the placeholder below is visibly a
 * placeholder rather than a photograph of somewhere else.
 */
function ActivityTile({
  slug,
  name,
  description,
  coverImage,
  count,
}: ActivityTileProps) {

  return (
    <Link
      href={`/activities/${slug}`}
      data-testid={`activity-tile-${slug}`}
      className={cn(
        "group relative flex flex-col bg-card border border-border/40 overflow-hidden",
        "hover:border-primary/50 hover:shadow-sm transition-all duration-300",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      )}
    >
      <div className="aspect-[4/3] overflow-hidden bg-muted">
        {coverImage ? (
          <DestinationCoverImage
            coverImage={coverImage}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            data-testid={`activity-tile-no-image-${slug}`}
          >
            <span className="font-sans text-[10px] uppercase tracking-widest text-muted-foreground/60">
              No image yet
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-between p-5">
        <div>
          <span className="font-serif text-xl font-light text-foreground leading-snug group-hover:text-primary transition-colors duration-200">
            {name}
          </span>
          {description && (
            <p className="mt-3 font-sans text-xs text-muted-foreground leading-relaxed line-clamp-3">
              {description}
            </p>
          )}
        </div>
        <div className="mt-5 flex items-center justify-between">
          <span className={cn(
            "font-sans text-[10px] uppercase tracking-widest",
            count > 0 ? "text-muted-foreground" : "text-muted-foreground/40"
          )}>
            {count > 0 ? `${count} ${count === 1 ? "Tour" : "Tours"}` : "Coming soon"}
          </span>
          <span className="flex items-center gap-1 font-sans text-[10px] uppercase tracking-widest text-primary">
            Explore
            <ArrowRight
              className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-1"
              aria-hidden
            />
          </span>
        </div>
      </div>
      {/* Gold accent left edge */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary/0 group-hover:bg-primary/60 transition-all duration-300" />
    </Link>
  );
}

// ── Group section ─────────────────────────────────────────────────────────────

function ActivityGroup({ group }: { group: ActivityFilterGroup }) {

  return (
    <section
      aria-labelledby={`group-${group.groupSlug}`}
      data-testid={`activity-group-${group.groupSlug}`}
    >
      <div className="flex flex-col md:flex-row md:items-start md:gap-12 mb-8">
        <div className="md:w-64 shrink-0 mb-4 md:mb-0">
          {/*
            The gold eyebrow is a kicker above the name, the way the page
            header pairs "Curated Experiences" with "Activities". It used to
            render group.groupName as well, so every section showed its title
            twice — "WATER" over "Water".
          */}
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.15em] text-primary mb-2">
            {groupKicker(group)}
          </p>
          <h2
            id={`group-${group.groupSlug}`}
            className="font-serif text-3xl font-light text-foreground"
          >
            {group.groupName}
          </h2>
        </div>
        {/*
          The section intro, as written in the admin panel. It used to come from
          a hardcoded map keyed by slug, with a generic paragraph for anything
          not in it — so the text could not be edited, and a group added through
          the admin panel silently borrowed somebody else's words. A group with
          no description now prints no intro.
        */}
        {group.groupDescription && (
          <p className="font-sans text-sm text-muted-foreground leading-relaxed flex-1 max-w-2xl">
            {group.groupDescription}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {group.activities.map((activity) => (
          <ActivityTile
            key={activity.slug}
            slug={activity.slug}
            name={activity.name}
            description={activity.description}
            coverImage={activity.coverImage}
            count={activity.count}
          />
        ))}
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ActivitiesPage() {
  const {
    data: groups,
    isLoading,
    isError,
    refetch,
  } = useListActivityFilters({
    query: {
      queryKey: getListActivityFiltersQueryKey(),
    },
  });

  if (isLoading) return <PageSkeleton />;

  if (isError) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <Navbar />
        <div className="flex items-center justify-center" style={{ minHeight: "80dvh" }}>
          <div className="text-center max-w-md px-6">
            <div className="w-16 h-px bg-primary mx-auto mb-8" />
            <h1 className="font-serif text-4xl font-light text-foreground mb-4">
              Unable to Load Activities
            </h1>
            <p className="font-sans text-sm text-muted-foreground mb-8">
              We were unable to retrieve our activities at this time. Please try again.
            </p>
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="font-sans text-xs uppercase tracking-widest"
              data-testid="activities-error-retry"
            >
              Try Again
            </Button>
            <div className="w-16 h-px bg-primary mx-auto mt-8" />
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const nonEmpty = groups?.filter((g) => g.activities.length > 0) ?? [];

  return (
    <div className="min-h-[100dvh] bg-background">
      <Navbar />

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="pt-24 pb-12 border-b border-border/30">
        <div className="max-w-7xl mx-auto px-6">
          <p className="font-sans text-xs font-medium uppercase tracking-widest text-primary mb-3">
            Curated Experiences
          </p>
          <h1 className="font-serif text-5xl font-light text-foreground mb-3">
            Activities
          </h1>
          <p className="font-sans text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Every extraordinary journey is shaped by the moments within it. Browse our
            complete catalogue of activities and find the experiences that define your next
            chapter.
          </p>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        {nonEmpty.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-px bg-primary mx-auto mb-8" />
            <h2 className="font-serif text-3xl font-light text-foreground mb-4">
              No Activities Listed
            </h2>
            <p className="font-sans text-sm text-muted-foreground mb-8">
              Our activity catalogue is being assembled. Check back shortly.
            </p>
            <Link href="/tours">
              <Button
                variant="outline"
                className="font-sans text-xs uppercase tracking-widest"
              >
                Browse All Tours
              </Button>
            </Link>
            <div className="w-16 h-px bg-primary mx-auto mt-8" />
          </div>
        ) : (
          <div className="space-y-0">
            {nonEmpty.map((group, idx) => (
              <div key={group.groupSlug}>
                <ActivityGroup group={group} />
                {idx < nonEmpty.length - 1 && (
                  <Separator className="my-16 bg-border/30" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
