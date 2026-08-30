/**
 * /activities — editorial index of every activity, grouped by category.
 *
 * Data: useListActivityFilters() → ActivityFilterGroup[]
 * Each group has activities with id, slug, name, icon, count.
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

// ── Editorial copy keyed by groupSlug ─────────────────────────────────────────
// Deterministic local copy; no API involvement.
const GROUP_INTROS: Record<string, string> = {
  "water": "The world's most storied waterways, reinterpreted for those who demand more than a cabin and a horizon. From open-ocean passages to warm-water reef excursions and backcountry lake systems, each experience has been hand-selected for its remoteness, exclusivity, and seamless service.",
  "land-adventure": "Ground-level encounters with wilderness, culture, and terrain that no aircraft window could ever frame. Whether it's a dawn trek across volcanic plateaus, a private safari at the edge of a predator's range, or a traverse through unmapped desert, these activities redefine what it means to arrive somewhere.",
  "culture": "Immersive encounters with living traditions — not as spectators but as guests. Private access to ateliers, monasteries, vineyards, and workshops that reveal the interior life of a place rather than its curated facade. Each experience is arranged through relationships built over many years.",
  "culture-entertainment": "Immersive encounters with living traditions — not as spectators but as guests. Private access to ateliers, monasteries, vineyards, and workshops that reveal the interior life of a place rather than its curated facade.",
  "food-drink": "To understand a place through what it produces and how it eats is one of the more direct routes into its character. These culinary experiences — from private vineyard tastings to kitchen-table dinners hosted by the people who actually cook — are selected for their authenticity and their access.",
  "wellness": "Restoration designed around geography. Whether it means a thermal soak in a volcanic spring, forest bathing at altitude, or a bespoke spa programme carried out in a historic riad, these experiences put the landscape at the centre of recovery.",
  "in-air": "Altitude as a lens. Balloon ascents over ancient landscapes, helicopter approaches to inaccessible coastlines, and high-altitude transfers that transform transit into the headline act. Each aerial experience is operated by crews with impeccable safety records.",
};

const FALLBACK_INTRO =
  "A curated selection of experiences assembled for travelers who seek something beyond the conventional itinerary.";

/*
 * Small gold kicker sitting above each group's serif heading, mirroring the
 * page header's "Curated Experiences" / "Activities" pairing. Keyed by slug and
 * kept alongside GROUP_INTROS so a group's copy lives in one place.
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

interface ActivityEditorial {
  title: string;
  description: string;
  image: string;
}

// Editorial presentation content is intentionally local: the activity API owns
// taxonomy, while this page supplies the made-up catalogue copy requested for
// the public index.
const ACTIVITY_EDITORIAL: Record<string, ActivityEditorial> = {
  swimming: {
    title: "Thermal Waters & Open Sea",
    description: "Move through warm volcanic pools and sheltered coves where the water is as restorative as the view.",
    image: "/images/hero-maldives.jpg",
  },
  diving: {
    title: "Below the Blue",
    description: "Descend into clear, living waters with private instruction and unhurried time among the reef.",
    image: "/images/hero-maldives.jpg",
  },
  canoeing: {
    title: "Quiet Water Expeditions",
    description: "Paddle beyond the usual trail into hidden lakes, fjords, and rivers chosen for their sense of solitude.",
    image: "/images/hero-patagonia.jpg",
  },
  hiking: {
    title: "Trails Beyond the Map",
    description: "Follow expert-led paths across wild country, with every summit, valley, and pause chosen for its character.",
    image: "/images/hero-patagonia.jpg",
  },
  walking: {
    title: "A City on Foot",
    description: "Read a destination at street level through private walks, quiet corners, and the people who know them best.",
    image: "/images/dest-morocco.jpg",
  },
  cycling: {
    title: "Two Wheels, Farther Out",
    description: "Cover beautiful ground at your own pace, from coastal lanes to mountain roads beyond the standard itinerary.",
    image: "/images/dest-iceland.jpg",
  },
  "off-road": {
    title: "The Long Way Around",
    description: "Take the landscape seriously with private 4x4 routes that turn remote terrain into the day's main event.",
    image: "/images/hero-sahara.jpg",
  },
  camping: {
    title: "Under Canvas",
    description: "Sleep close to the elements without giving up the quiet service, considered details, and comfort of a private camp.",
    image: "/images/hero-patagonia.jpg",
  },
  desert: {
    title: "Across the Dunes",
    description: "Travel by changing light through immense desert country, with time for stillness between every horizon.",
    image: "/images/hero-sahara.jpg",
  },
  theatre: {
    title: "After the Curtain",
    description: "Enter the creative life of a place through intimate performances and access arranged beyond the public programme.",
    image: "/images/cat-cruise.jpg",
  },
  concerts: {
    title: "A Room Full of Sound",
    description: "Hear exceptional musicians in settings where the atmosphere and the music are part of the same experience.",
    image: "/images/cat-cruise_2.jpg",
  },
  "theme-parks": {
    title: "Wonder, Reconsidered",
    description: "Enjoy a more personal side of play with priority access, thoughtful pacing, and moments made for all ages.",
    image: "/images/cat-beach.jpg",
  },
  dining: {
    title: "The Table Is the Destination",
    description: "Meet a region through its kitchens, markets, cellars, and the people who make its most memorable meals.",
    image: "/images/dest-morocco.jpg",
  },
  cafes: {
    title: "Coffee, Slowly",
    description: "Find the cafés worth lingering in, from morning roasters to old rooms where a cup carries local history.",
    image: "/images/journal-2.jpg",
  },
};

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
  count: number;
}

function ActivityTile({ slug, name, count }: ActivityTileProps) {
  const editorial = ACTIVITY_EDITORIAL[slug] ?? {
    title: name,
    description: "A carefully selected experience for travelers who want to see more of a destination.",
    image: "/images/hero-patagonia.jpg",
  };

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
      <div className="aspect-[4/3] overflow-hidden">
        <DestinationCoverImage
          coverImage={editorial.image}
          alt={editorial.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col justify-between p-5">
        <div>
          <span className="font-serif text-xl font-light text-foreground leading-snug group-hover:text-primary transition-colors duration-200">
            {editorial.title}
          </span>
          <p className="mt-3 font-sans text-xs text-muted-foreground leading-relaxed line-clamp-3">
            {editorial.description}
          </p>
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
  const intro = GROUP_INTROS[group.groupSlug] ?? FALLBACK_INTRO;

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
        <p className="font-sans text-sm text-muted-foreground leading-relaxed flex-1 max-w-2xl">
          {intro}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {group.activities.map((activity) => (
          <ActivityTile
            key={activity.slug}
            slug={activity.slug}
            name={activity.name}
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
