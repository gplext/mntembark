/**
 * Activity landing page.
 *
 * Route: /activities/:slug
 *
 * - redirectToSlug set  → activity has been merged; 301 to the target slug.
 * - API 404            → standard not-found state.
 * - Normal             → hero + description + tour list filtered by this activity.
 *
 * Tours come from GET /tours?activitySlugs={slug} — no new endpoint.
 */

import { useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import {
  useGetActivityBySlug,
  getGetActivityBySlugQueryKey,
  useListTours,
  getListToursQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import { Skeleton } from "@workspace/mnt-embark/components/ui/skeleton";
import { Separator } from "@workspace/mnt-embark/components/ui/separator";
import { ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { TourRow } from "@/components/TourCard";
import { DestinationCoverImage } from "@/components/DestinationCoverImage";

export default function ActivityDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();

  const {
    data: activity,
    isLoading,
    isError,
  } = useGetActivityBySlug(slug ?? "", {
    query: {
      enabled: Boolean(slug),
      queryKey: getGetActivityBySlugQueryKey(slug ?? ""),
    },
  });

  // Redirect merged activities before rendering anything
  useEffect(() => {
    if (activity?.redirectToSlug) {
      navigate(`/activities/${activity.redirectToSlug}`, { replace: true });
    }
  }, [activity?.redirectToSlug, navigate]);

  // noindex: mutate the existing meta[name="robots"] tag while mounted,
  // restore its original value on unmount. One tag, one value, no ambiguity.
  // Falls back to creating/removing a tag if no static tag exists.
  useEffect(() => {
    if (!activity || activity.isIndexable) return;

    const existing = document.querySelector(
      'meta[name="robots"]',
    ) as HTMLMetaElement | null;

    if (existing) {
      const prev = existing.content;
      existing.content = "noindex, follow";
      return () => {
        existing.content = prev;
      };
    }

    // No static tag present — create one and remove on cleanup
    const meta = document.createElement("meta");
    meta.setAttribute("name", "robots");
    meta.setAttribute("content", "noindex, follow");
    document.head.appendChild(meta);
    return () => {
      meta.remove();
    };
  }, [activity?.isIndexable]);

  const tourParams = { activitySlugs: [slug ?? ""] };
  const { data: tours, isLoading: toursLoading } = useListTours(tourParams, {
    query: {
      enabled:
        Boolean(slug) &&
        !isLoading &&
        !isError &&
        !activity?.redirectToSlug,
      queryKey: getListToursQueryKey(tourParams),
    },
  });

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <Navbar />
        <div style={{ paddingTop: "80px" }}>
          <Skeleton className="w-full h-80 md:h-[420px] rounded-none" />
          <div className="max-w-5xl mx-auto px-6 py-12 space-y-4">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-10 w-72" />
            <Skeleton className="h-4 w-full max-w-xl" />
            <Skeleton className="h-4 w-3/4 max-w-xl" />
          </div>
        </div>
      </div>
    );
  }

  // ── Redirect in flight — do not render ────────────────────────────────────
  if (activity?.redirectToSlug) {
    return null;
  }

  // ── Not found ─────────────────────────────────────────────────────────────
  if (isError || !activity) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <Navbar />
        <div
          className="flex items-center justify-center"
          style={{ minHeight: "100dvh" }}
        >
          <div className="text-center max-w-md px-6">
            <div className="w-16 h-px bg-primary mx-auto mb-8" />
            <h1 className="font-serif text-4xl font-light text-foreground mb-4">
              Activity Not Found
            </h1>
            <p className="font-sans text-sm text-muted-foreground mb-8">
              This activity may no longer be available. Explore our tours to
              discover what's on offer.
            </p>
            <Link href="/tours">
              <Button
                variant="outline"
                className="font-sans text-xs uppercase tracking-widest"
              >
                View All Tours
              </Button>
            </Link>
            <div className="w-16 h-px bg-primary mx-auto mt-8" />
          </div>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-background">
      <Navbar />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div style={{ paddingTop: "80px" }}>
        <div className="relative h-80 md:h-[420px] overflow-hidden">
          <DestinationCoverImage
            coverImage={activity.coverImage}
            alt={activity.name}
            className="w-full h-full object-cover"
          />

          {/* Gradient — dark at bottom so text is legible over any image */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />

          {/* Group eyebrow + activity name */}
          <div className="absolute bottom-0 left-0 right-0 p-8 md:px-16">
            <p className="font-sans text-xs uppercase tracking-widest text-accent mb-2">
              {activity.groupName}
            </p>
            <h1 className="font-serif text-4xl md:text-5xl font-light text-white leading-tight">
              {activity.name}
            </h1>
          </div>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Back link */}
        <Link
          href="/tours"
          className="flex items-center gap-2 font-sans text-xs text-muted-foreground hover:text-foreground uppercase tracking-widest mb-8 transition-colors w-fit"
        >
          <ArrowLeft className="h-3 w-3" />
          All Tours
        </Link>

        {/* Description — only when present */}
        {activity.description && (
          <>
            <p className="font-sans text-sm text-muted-foreground leading-relaxed max-w-2xl mb-10">
              {activity.description}
            </p>
            <Separator className="bg-border/40 mb-10" />
          </>
        )}

        {/* Tour list */}
        <p className="font-sans text-xs font-medium uppercase tracking-widest text-primary mb-6">
          Tours featuring this activity
        </p>

        {toursLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded" />
            ))}
          </div>
        ) : tours && tours.length > 0 ? (
          <div className="space-y-4">
            {tours.map((tour) => (
              <TourRow key={tour.id} tour={tour} />
            ))}
          </div>
        ) : (
          <p className="font-sans text-sm text-muted-foreground">
            No tours are currently listed for this activity.
          </p>
        )}
      </div>

      <Footer />
    </div>
  );
}
