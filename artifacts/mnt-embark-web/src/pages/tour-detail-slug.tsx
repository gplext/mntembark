/**
 * Single tour detail page.
 *
 * Route: /tours/:slugOrId
 *
 * - Non-numeric param  → fetch by slug (useGetTourBySlug), render full
 *   taxonomy page with breadcrumb and activity sections.
 *
 * - Numeric param      → fetch by id (useGetTour), then:
 *     • has slug  → redirect to /tours/:slug (replace, so Back works)
 *     • no slug   → render basic page in-place (no breadcrumb/activities)
 *
 * The slug field was added to the Tour schema (additive, no logic change)
 * specifically to enable the numeric-id → slug redirect.
 */

import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import {
  useGetTour,
  getGetTourQueryKey,
  useGetTourBySlug,
  getGetTourBySlugQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import { Badge } from "@workspace/mnt-embark/components/ui/badge";
import { Skeleton } from "@workspace/mnt-embark/components/ui/skeleton";
import { Separator } from "@workspace/mnt-embark/components/ui/separator";
import { cn } from "@workspace/mnt-embark/lib/utils";
import {
  MapPin,
  Clock,
  Plane,
  Hotel,
  Car,
  Activity,
  Navigation,
  CreditCard,
  Anchor,
} from "lucide-react";
import type { ItineraryStep, TourActivitySection } from "@workspace/api-client-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import EnquiryModal from "@/components/EnquiryModal";

// ── Itinerary step icons ──────────────────────────────────────────────────────

const stepIcons: Record<string, React.FC<{ className?: string }>> = {
  Pickup: Navigation,
  Flight: Plane,
  Visa: CreditCard,
  Layover: Anchor,
  Ride: Car,
  Hotel: Hotel,
  Activities: Activity,
};

function ItineraryIcon({ type }: { type: string }) {
  const Icon = stepIcons[type] || Navigation;
  return <Icon className="h-4 w-4" />;
}

// ── Activity sections ─────────────────────────────────────────────────────────

function ActivitySectionsPanel({ sections }: { sections: TourActivitySection[] }) {
  if (sections.length === 0) return null;
  return (
    <div>
      <p className="font-sans text-xs font-medium uppercase tracking-widest text-primary mb-4">
        Activities
      </p>
      <div className="space-y-4">
        {sections.map((group) => (
          <div key={group.groupSlug}>
            <p className="font-sans text-xs text-muted-foreground uppercase tracking-widest mb-2">
              {group.groupName}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {group.activities.map((act) => (
                <Link
                  key={act.slug}
                  href={`/activities/${act.slug}`}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full border border-border/60 font-sans text-xs text-foreground/80 hover:border-primary hover:text-primary transition-colors"
                >
                  {act.name}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TourDetailPage() {
  const { slugOrId } = useParams<{ slugOrId: string }>();
  const [, navigate] = useLocation();

  const isNumeric = /^\d+$/.test(slugOrId ?? "");
  const numId = isNumeric ? Number(slugOrId) : 0;
  const slugParam = isNumeric ? "" : (slugOrId ?? "");

  // ── Both hooks declared unconditionally; `enabled` controls which fires ──

  const {
    data: tourById,
    isLoading: loadingById,
    isError: errorById,
  } = useGetTour(numId, {
    query: {
      enabled: isNumeric,
      queryKey: getGetTourQueryKey(numId),
    },
  });

  const {
    data: tourBySlug,
    isLoading: loadingBySlug,
    isError: errorBySlug,
  } = useGetTourBySlug(slugParam, {
    query: {
      enabled: !isNumeric && slugParam.length > 0,
      queryKey: getGetTourBySlugQueryKey(slugParam),
    },
  });

  // ── Redirect: numeric id with a valid slug → /tours/:slug ─────────────────
  useEffect(() => {
    if (isNumeric && tourById?.slug) {
      navigate(`/tours/${tourById.slug}`, { replace: true });
    }
  }, [isNumeric, tourById?.slug, navigate]);

  // ── Shared state ──────────────────────────────────────────────────────────
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [imageVisible, setImageVisible] = useState(true);
  const [enquiryOpen, setEnquiryOpen] = useState(false);

  const handleStepChange = (idx: number) => {
    setImageVisible(false);
    setTimeout(() => {
      setActiveStepIndex(idx);
      setImageVisible(true);
    }, 400);
  };

  useEffect(() => {
    setActiveStepIndex(0);
    setImageVisible(true);
  }, [slugOrId]);

  // ── Guard: loading ────────────────────────────────────────────────────────
  const isLoading = isNumeric ? loadingById : loadingBySlug;
  // While the redirect effect is about to fire, keep showing the spinner
  const isRedirecting = isNumeric && !!tourById?.slug;

  if (isLoading || isRedirecting) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <Navbar />
        <div className="flex" style={{ minHeight: "100dvh" }}>
          <div className="w-72 shrink-0 bg-card border-r border-border/40 pt-24 p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded" />
            ))}
          </div>
          <div className="flex-1">
            <Skeleton className="w-full h-full" style={{ minHeight: "100dvh" }} />
          </div>
        </div>
      </div>
    );
  }

  // ── Guard: error / not found ──────────────────────────────────────────────
  const isError = isNumeric ? errorById : errorBySlug;
  const hasTour = isNumeric ? !!tourById : !!tourBySlug;

  if (isError || !hasTour) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <Navbar />
        <div className="flex items-center justify-center" style={{ minHeight: "100dvh" }}>
          <div className="text-center max-w-md px-6">
            <div className="w-16 h-px bg-primary mx-auto mb-8" />
            <h1 className="font-serif text-4xl font-light text-foreground mb-4">
              Tour Not Found
            </h1>
            <p className="font-sans text-sm text-muted-foreground mb-8">
              This journey may no longer be available. Explore our other exclusive tours.
            </p>
            <Link href="/tours">
              <Button
                variant="outline"
                data-testid="tour-not-found-back"
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

  // ── Derive display values ─────────────────────────────────────────────────
  //
  // hasTaxonomy  → we fetched by slug; full TourWithTaxonomy available
  // !hasTaxonomy → numeric id with null slug; basic Tour available
  //
  const hasTaxonomy = !isNumeric;

  const title         = hasTaxonomy ? tourBySlug!.title         : tourById!.title;
  const description   = hasTaxonomy ? tourBySlug!.description   : tourById!.description;
  const coverImage    = hasTaxonomy ? tourBySlug!.coverImage    : tourById!.coverImage;
  const images        = hasTaxonomy ? tourBySlug!.images        : tourById!.images;
  const durationDays  = hasTaxonomy ? tourBySlug!.durationDays  : tourById!.durationDays;
  const featured      = hasTaxonomy ? tourBySlug!.featured      : tourById!.featured;
  const classification = hasTaxonomy
    ? tourBySlug!.classification
    : (tourById as { classification?: string | null }).classification;
  const steps: ItineraryStep[] = hasTaxonomy
    ? tourBySlug!.itinerarySteps
    : (tourById!.itinerarySteps ?? []);

  // Location display string (for sidebar pill and EnquiryModal)
  const locationDisplay = hasTaxonomy
    ? (tourBySlug!.location?.name ?? tourBySlug!.locationName ?? "")
    : (tourById!.locationName ?? tourById!.location ?? "");

  // Taxonomy-only fields (empty / skipped when hasTaxonomy is false)
  const activitySections: TourActivitySection[] =
    hasTaxonomy ? tourBySlug!.activitySections : [];

  const activeStep = steps[activeStepIndex];
  const currentImage = activeStep?.image || coverImage || "";
  const hasActivities = activitySections.length > 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-background">
      <Navbar />

      <div className="flex" style={{ minHeight: "100dvh" }}>
        {/* ── Left strip ─────────────────────────────────────────────────── */}
        <div
          className="w-72 md:w-80 shrink-0 bg-background border-r border-border/40 overflow-y-auto"
          style={{ paddingTop: "80px" }}
          data-testid="itinerary-strip"
        >
          <div className="p-6">
            {/* Tour name + meta */}
            <div className="mb-6">
              {featured && (
                <Badge
                  variant="outline"
                  className="border-primary text-primary text-xs tracking-widest uppercase mb-3"
                >
                  Exclusive
                </Badge>
              )}
              <h1 className="font-serif text-2xl font-light text-foreground leading-tight mb-3">
                {title}
              </h1>
              <div className="flex flex-col gap-1 text-muted-foreground">
                {locationDisplay && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3 w-3 text-primary" />
                    <span className="font-sans text-xs">{locationDisplay}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3 text-primary" />
                  <span className="font-sans text-xs">{durationDays} days</span>
                </div>
              </div>
            </div>

            <Separator className="bg-border/40 mb-6" />

            {/* Itinerary label */}
            <p className="font-sans text-xs font-medium uppercase tracking-widest text-primary mb-4">
              Exclusive Itinerary
            </p>

            {/* Itinerary steps */}
            {steps.length === 0 ? (
              <p className="font-sans text-xs text-muted-foreground">
                Itinerary details coming soon.
              </p>
            ) : (
              <div className="space-y-1">
                {steps.map((step, idx) => (
                  <button
                    key={idx}
                    data-testid={`itinerary-step-${idx}`}
                    onClick={() => handleStepChange(idx)}
                    className={cn(
                      "w-full text-left flex items-start gap-3 p-3 rounded transition-all duration-200",
                      idx === activeStepIndex
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-card border border-transparent"
                    )}
                  >
                    <div
                      className={cn(
                        "shrink-0 mt-0.5",
                        idx === activeStepIndex ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      <ItineraryIcon type={step.type} />
                    </div>
                    <div>
                      <p
                        className={cn(
                          "font-sans text-xs uppercase tracking-widest mb-0.5",
                          idx === activeStepIndex ? "text-primary" : "text-muted-foreground"
                        )}
                      >
                        {step.type}
                      </p>
                      <p
                        className={cn(
                          "font-sans text-sm leading-tight",
                          idx === activeStepIndex ? "text-foreground" : "text-foreground/70"
                        )}
                      >
                        {step.title}
                      </p>
                    </div>
                    {idx === activeStepIndex && (
                      <div className="ml-auto shrink-0 w-1 self-stretch bg-primary rounded-full" />
                    )}
                  </button>
                ))}
              </div>
            )}

            <Separator className="bg-border/40 my-6" />

            {/* Activities — only when taxonomy sections exist */}
            {hasActivities && (
              <>
                <ActivitySectionsPanel sections={activitySections} />
                <Separator className="bg-border/40 my-6" />
              </>
            )}

            {/* Enquire CTA */}
            <Button
              data-testid="tour-enquire-btn"
              className="w-full font-sans text-xs uppercase tracking-widest"
              onClick={() => setEnquiryOpen(true)}
            >
              Enquire Now
            </Button>
          </div>
        </div>

        {/* ── Right panel ────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ paddingTop: "80px" }}>
          {/* Hero image */}
          <div className="flex-1 relative overflow-hidden">
            <div
              className={cn(
                "absolute inset-0 transition-opacity duration-500",
                imageVisible ? "opacity-100" : "opacity-0"
              )}
            >
              <img
                src={currentImage}
                alt={activeStep?.title || title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />
            </div>

            {/* Caption */}
            <div
              className={cn(
                "absolute bottom-0 left-0 right-0 p-8 transition-opacity duration-500",
                imageVisible ? "opacity-100" : "opacity-0"
              )}
            >
              {activeStep && (
                <div>
                  <p className="font-sans text-xs uppercase tracking-widest text-accent mb-1">
                    {activeStep.type}
                  </p>
                  <h2 className="font-serif text-3xl font-light text-white">
                    {activeStep.title}
                  </h2>
                </div>
              )}
            </div>
          </div>

          {/* Step description */}
          {activeStep && (
            <div
              className={cn(
                "bg-background border-t border-border/40 p-8 transition-opacity duration-500",
                imageVisible ? "opacity-100" : "opacity-0"
              )}
            >
              <p className="font-sans text-sm text-muted-foreground leading-relaxed max-w-3xl">
                {activeStep.description}
              </p>
            </div>
          )}
        </div>
      </div>

      <Footer />

      {/* Enquiry modal */}
      <EnquiryModal
        open={enquiryOpen}
        onClose={() => setEnquiryOpen(false)}
        tour={{
          title,
          coverImage,
          durationDays,
          location: locationDisplay,
          featured,
        }}
      />
    </div>
  );
}
