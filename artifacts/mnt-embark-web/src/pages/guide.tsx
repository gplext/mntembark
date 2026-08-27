/**
 * /guide — editorial tour guide covering every tour with deterministic
 * local-made-up guide/editorial copy. Backed by useListTours().
 *
 * Presents tours in an editorial long-read format rather than a catalog grid.
 */

import { useState } from "react";
import { Link } from "wouter";
import {
  useListTours,
  getListToursQueryKey,
} from "@workspace/api-client-react";
import type { Tour } from "@workspace/api-client-react";
import { Skeleton } from "@workspace/mnt-embark/components/ui/skeleton";
import { Separator } from "@workspace/mnt-embark/components/ui/separator";
import { Badge } from "@workspace/mnt-embark/components/ui/badge";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import { cn } from "@workspace/mnt-embark/lib/utils";
import { MapPin, Clock, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { DestinationCoverImage } from "@/components/DestinationCoverImage";

// ── Deterministic editorial copy ──────────────────────────────────────────────
// Seeded by tour ID for stability across renders. No randomness.

const EDITORIAL_OPENERS = [
  "There is a kind of stillness that belongs only to places that have not yet been overrun — where the landscape still sets the terms and the traveler arrives as a guest rather than a consumer.",
  "To travel well is to be changed by the experience in ways that persist long after the return flight. This is not a journey for those seeking comfort at the expense of meaning.",
  "The most discerning itineraries are not assembled — they are composed, the way a conductor brings silence and sound into conversation across an evening.",
  "Few destinations reward patience the way this one does. The first hours are an overture; the landscape reveals itself gradually, each day a deeper key.",
  "An encounter with genuine remoteness realigns the senses. The scale of what surrounds you diminishes the self in the most liberating of ways.",
  "What distinguishes an exceptional journey from a superior holiday is the intelligence of its design — the invisible architecture that makes every transition feel inevitable.",
  "Some places have accumulated so many layers of human story that to walk through them is an act of archaeology. Each step is a document waiting to be read.",
  "The luxury of unhurried time is among the rarest commodities in modern life. This itinerary has been constructed to protect it at every stage.",
];

const EDITORIAL_MIDDLES = [
  "The accommodation here is not incidental to the experience but constitutive of it — each property chosen because it understands its setting and has the restraint not to compete with it.",
  "Meals in this region are understood as events. The produce is hyperlocal, the preparation is disciplined, and the setting — whether a candlelit cellar or a terrace above the valley — is always considered.",
  "Your MNT Embark guide holds relationships in this region that took years to cultivate, opening spaces that are formally closed and perspectives that are not available on any standard programme.",
  "The pace is deliberate. Nothing on this itinerary is included to fill time — every element earns its place through the quality of the experience it provides.",
  "Private transfers throughout mean that even the journey between one place and the next becomes an opportunity to observe, to decompress, or to simply watch the landscape change.",
  "The balance between structured programming and open time has been calibrated across many iterations of this journey. What remains is the version that our guests consistently describe as perfect.",
  "An expert naturalist accompanies each expedition into the field. Their knowledge is matched only by their ability to make that knowledge feel like conversation rather than instruction.",
  "Evenings are rarely prescribed in advance. The guide holds a portfolio of possibilities — an introduction to a local family, a visit to a private collection, a table at a restaurant that takes no general bookings — and deploys them according to the group's temperament.",
];

const EDITORIAL_CLOSERS = [
  "What you carry home is not a collection of photographs but a recalibration of what extraordinary actually means.",
  "Travelers who have completed this journey reliably report that it becomes the measure against which all subsequent trips are judged.",
  "The memory of this journey is not filed away — it remains active, colouring the way its participants understand the world they returned to.",
  "Those who travel here once invariably begin planning their return before they have left.",
  "This is not a journey that resolves at the end of its final day. It continues, quietly, in the imagination.",
  "Each element of this experience has been constructed to resist reduction — to remain irreducible to the photographs and the notes and the conversations that try to describe it.",
];

const GUIDE_PROFILES = [
  {
    name: "Amara Vale",
    role: "Naturalist & Expedition Host",
    note: "Amara reads weather, terrain, and the small signs that make a place feel immediately alive.",
  },
  {
    name: "Theo Mercer",
    role: "Cultural Historian",
    note: "Theo's relationships open doors to the working studios, kitchens, and rooms where a destination keeps its real stories.",
  },
  {
    name: "Leila Hart",
    role: "Slow Travel Curator",
    note: "Leila believes the best days are paced by curiosity rather than a clock, with space left for the unexpected.",
  },
  {
    name: "Jonas Reed",
    role: "Wilderness Guide",
    note: "Jonas brings a calm precision to remote landscapes, pairing deep field knowledge with an instinct for memorable pauses.",
  },
];

function seededPick<T>(arr: T[], id: number, offset: number = 0): T {
  return arr[(id + offset) % arr.length];
}

function getEditorialCopy(tour: Tour): { opener: string; middle: string; closer: string } {
  return {
    opener: seededPick(EDITORIAL_OPENERS, tour.id, 0),
    middle: seededPick(EDITORIAL_MIDDLES, tour.id, 1),
    closer: seededPick(EDITORIAL_CLOSERS, tour.id, 2),
  };
}

function getGuideProfile(tour: Tour) {
  return GUIDE_PROFILES[tour.id % GUIDE_PROFILES.length];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function tourPlace(tour: Tour): string {
  const locationName = (tour as { locationName?: string | null }).locationName;
  const countryName = (tour as { countryName?: string | null }).countryName;
  if (locationName) {
    const parts = [locationName, countryName].filter(
      (v, i, arr) => Boolean(v) && arr.indexOf(v) === i
    );
    return parts.join(", ");
  }
  return tour.location;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <Navbar />
      <div className="pt-24 pb-12 border-b border-border/30">
        <div className="max-w-4xl mx-auto px-6">
          <Skeleton className="h-3 w-24 mb-3" />
          <Skeleton className="h-12 w-64 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-6 py-16 space-y-20">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-6">
            <Skeleton className="w-full h-72 rounded" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tour entry ─────────────────────────────────────────────────────────────────

interface GuideEntryProps {
  tour: Tour;
  index: number;
}

function GuideEntry({ tour, index }: GuideEntryProps) {
  const [imgError, setImgError] = useState(false);
  const copy = getEditorialCopy(tour);
  const guide = getGuideProfile(tour);
  const place = tourPlace(tour);
  const classification = (tour as { classification?: string | null }).classification;

  const isEven = index % 2 === 0;

  return (
    <article
      data-testid={`guide-entry-${tour.id}`}
      className="group"
    >
      <div className={cn("flex flex-col md:flex-row gap-10", !isEven && "md:flex-row-reverse")}>
        {/* Image */}
        <div className="md:w-2/5 shrink-0">
          <Link
            href={`/tours/${tour.slug ?? tour.id}`}
            className="block overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            tabIndex={0}
          >
            <div className="aspect-[4/3] overflow-hidden bg-muted relative">
              {tour.coverImage && !imgError ? (
                <img
                  src={tour.coverImage}
                  alt={tour.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  onError={() => setImgError(true)}
                />
              ) : (
                <DestinationCoverImage
                  coverImage={null}
                  alt={tour.title}
                  className="w-full h-full"
                />
              )}
              {/* Issue number overlay */}
              <div className="absolute top-4 left-4">
                <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-white/70 bg-black/30 px-2 py-1">
                  No. {String(index + 1).padStart(2, "0")}
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col justify-between">
          <div>
            {/* Meta */}
            <div className="flex items-center gap-3 mb-4">
              {classification && classification !== "standard" && (
                <Badge
                  variant={classification === "exclusive" ? "default" : "outline"}
                  className={cn(
                    "font-sans text-[10px] uppercase tracking-widest",
                    classification === "special" && "border-muted-foreground/50 text-muted-foreground"
                  )}
                >
                  {classification}
                </Badge>
              )}
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-3 w-3 text-primary" />
                <span className="font-sans text-xs">{place}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3 text-primary" />
                <span className="font-sans text-xs">{tour.durationDays} days</span>
              </div>
            </div>

            {/* Title */}
            <Link href={`/tours/${tour.slug ?? tour.id}`} tabIndex={-1}>
              <h2 className="font-serif text-3xl md:text-4xl font-light text-foreground leading-tight mb-5 hover:text-primary transition-colors duration-200">
                {tour.title}
              </h2>
            </Link>

            <div className="border-l-2 border-primary/50 pl-4 mb-6">
              <p className="font-sans text-[10px] uppercase tracking-widest text-primary mb-1">
                Your guide · {guide.name}
              </p>
              <p className="font-sans text-xs text-muted-foreground leading-relaxed">
                {guide.role} — {guide.note}
              </p>
            </div>

            {/* Editorial copy */}
            <p className="font-sans text-sm text-muted-foreground leading-relaxed mb-4">
              {copy.opener}
            </p>
            <p className="font-sans text-sm text-muted-foreground leading-relaxed mb-4">
              {copy.middle}
            </p>
            <p className="font-sans text-sm text-foreground/60 leading-relaxed italic">
              {copy.closer}
            </p>
          </div>

          {/* CTA */}
          <div className="mt-8">
            <Link href={`/tours/${tour.slug ?? tour.id}`}>
              <Button
                variant="outline"
                className="font-sans text-xs uppercase tracking-widest group/btn gap-2"
                data-testid={`guide-cta-${tour.id}`}
              >
                View Full Itinerary
                <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover/btn:translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GuidePage() {
  const {
    data: tours,
    isLoading,
    isError,
    refetch,
  } = useListTours(undefined, {
    query: {
      queryKey: getListToursQueryKey(),
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
              The Guide Is Unavailable
            </h1>
            <p className="font-sans text-sm text-muted-foreground mb-8">
              We were unable to load the guide at this time. Please try again momentarily.
            </p>
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="font-sans text-xs uppercase tracking-widest"
              data-testid="guide-error-retry"
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

  const list = tours ?? [];

  return (
    <div className="min-h-[100dvh] bg-background">
      <Navbar />

      {/* ── Hero header ─────────────────────────────────────────────────────── */}
      <div className="pt-24 pb-16 border-b border-border/30">
        <div className="max-w-4xl mx-auto px-6">
          <p className="font-sans text-xs font-medium uppercase tracking-widest text-primary mb-4">
            The MNT Embark
          </p>
          <h1 className="font-serif text-6xl font-light text-foreground mb-5 leading-none">
            Guide
          </h1>
          <div className="w-12 h-px bg-primary mb-6" />
          <p className="font-sans text-base text-muted-foreground leading-relaxed max-w-2xl">
            An editorial account of every journey in our collection. Read each entry as you
            would a travel dispatch — written to convey not just what a tour includes, but
            what it feels like to be inside it.
          </p>
        </div>
      </div>

      {/* ── Tour entries ─────────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        {list.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-px bg-primary mx-auto mb-8" />
            <h2 className="font-serif text-3xl font-light text-foreground mb-4">
              The Guide Is Being Written
            </h2>
            <p className="font-sans text-sm text-muted-foreground mb-8">
              Our editorial team is preparing entries for each journey. Please return shortly.
            </p>
            <div className="w-16 h-px bg-primary mx-auto mt-8" />
          </div>
        ) : (
          <div>
            {/* Tour count line */}
            <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-16">
              {list.length} {list.length === 1 ? "Journey" : "Journeys"} — Volume I
            </p>

            <div className="space-y-0">
              {list.map((tour, idx) => (
                <div key={tour.id}>
                  <GuideEntry tour={tour} index={idx} />
                  {idx < list.length - 1 && (
                    <Separator className="my-20 bg-border/30" />
                  )}
                </div>
              ))}
            </div>

            {/* Closing flourish */}
            <div className="mt-20 text-center">
              <div className="w-16 h-px bg-primary mx-auto mb-8" />
              <p className="font-serif text-xl font-light text-foreground/60 italic">
                End of Volume I
              </p>
              <div className="w-16 h-px bg-primary mx-auto mt-8" />
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
