/**
 * /attractions/:slug
 *
 * The tour page's layout with the itinerary swapped for the attraction's
 * steps: "How to reach" and "What to prepare" always, then any custom steps.
 * Picking a step shows its photos and text on the right; Overview goes back
 * to the attraction's own.
 */

import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import { Skeleton } from "@workspace/mnt-embark/components/ui/skeleton";
import { Separator } from "@workspace/mnt-embark/components/ui/separator";
import { cn } from "@workspace/mnt-embark/lib/utils";
import {
  MapPin,
  Clock,
  Navigation,
  Backpack,
  ListChecks,
  ChevronLeft,
  ChevronRight,
  Images,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import EnquiryModal from "@/components/EnquiryModal";
import { ClassificationBadge, HotelsNote } from "@/components/AttractionCard";
import { useAttraction, placeOf, type Attraction, type AttractionStep } from "@/lib/attractions-api";

const STEP_ICON = { reach: Navigation, prepare: Backpack, custom: ListChecks } as const;

function StepIcon({ step }: { step: AttractionStep }) {
  const Icon = STEP_ICON[step.kind] ?? ListChecks;
  return <Icon className="h-4 w-4" />;
}

/** Activities, grouped the way the filter sidebar groups them. */
function ActivitiesPanel({ attraction }: { attraction: Attraction }) {
  if (attraction.activities.length === 0) return null;
  const groups = new Map<string, { name: string; items: Attraction["activities"] }>();
  for (const a of attraction.activities) {
    const g = groups.get(a.groupSlug) ?? { name: a.groupName, items: [] };
    g.items.push(a);
    groups.set(a.groupSlug, g);
  }
  return (
    <div>
      <p className="font-sans text-xs font-medium uppercase tracking-widest text-primary mb-4">Activities</p>
      <div className="space-y-4">
        {[...groups.entries()].map(([slug, g]) => (
          <div key={slug}>
            <p className="font-sans text-xs text-muted-foreground uppercase tracking-widest mb-2">{g.name}</p>
            <div className="flex flex-wrap gap-1.5">
              {g.items.map((act) => (
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

export default function AttractionDetailPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { data: a, isLoading, isError } = useAttraction(slug);

  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [enquiryOpen, setEnquiryOpen] = useState(false);

  useEffect(() => {
    setActiveStep(null);
    setImageIndex(0);
    setVisible(true);
  }, [slug]);

  const changeStep = (idx: number | null) => {
    setVisible(false);
    setTimeout(() => {
      setActiveStep(idx);
      setImageIndex(0);
      setVisible(true);
    }, 300);
  };

  const steps = a?.steps ?? [];
  const step = activeStep !== null ? steps[activeStep] : undefined;
  const mainImages = a ? (a.images.length ? [a.coverImage, ...a.images.filter((i) => i !== a.coverImage)] : [a.coverImage]) : [];
  // A step without photos keeps showing the attraction's, rather than going blank.
  const images = step?.images.length ? step.images : mainImages;
  const index = images.length ? Math.min(imageIndex, images.length - 1) : 0;
  const prev = () => images.length > 1 && setImageIndex((i) => (i === 0 ? images.length - 1 : i - 1));
  const next = () => images.length > 1 && setImageIndex((i) => (i === images.length - 1 ? 0 : i + 1));

  useEffect(() => {
    if (images.length <= 1 || enquiryOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setImageIndex((i) => (i === 0 ? images.length - 1 : i - 1));
      if (e.key === "ArrowRight") setImageIndex((i) => (i === images.length - 1 ? 0 : i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images.length, enquiryOpen]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <Navbar />
        <div className="flex flex-col md:flex-row pt-20" style={{ minHeight: "100dvh" }}>
          <div className="md:w-80 shrink-0 p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded" />
            ))}
          </div>
          <Skeleton className="flex-1 min-h-[50vh]" />
        </div>
      </div>
    );
  }

  if (isError || !a) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <Navbar />
        <div className="flex items-center justify-center" style={{ minHeight: "100dvh" }}>
          <div className="text-center max-w-md px-6">
            <div className="w-16 h-px bg-primary mx-auto mb-8" />
            <h1 className="font-serif text-4xl font-light text-foreground mb-4">Attraction Not Found</h1>
            <p className="font-sans text-sm text-muted-foreground mb-8">
              It may have been renamed or taken down. The others are all here.
            </p>
            <Link href="/attractions">
              <Button variant="outline" className="font-sans text-xs uppercase tracking-widest">
                View All Attractions
              </Button>
            </Link>
            <div className="w-16 h-px bg-primary mx-auto mt-8" />
          </div>
        </div>
      </div>
    );
  }

  const place = placeOf(a);
  const mainCategory = a.categories[0];

  return (
    <div className="min-h-[100dvh] bg-background">
      <Navbar />

      <div className="flex flex-col-reverse md:flex-row" style={{ minHeight: "100dvh" }}>
        {/* ── Left strip ─────────────────────────────────────────────── */}
        <div className="w-full md:w-80 shrink-0 bg-background md:border-r border-border/40 md:pt-20" data-testid="attraction-strip">
          <div className="p-6">
            {/* Breadcrumb: the main category, then the place. */}
            <nav className="font-sans text-[11px] uppercase tracking-widest text-muted-foreground mb-3 flex flex-wrap gap-1" aria-label="Breadcrumb">
              <Link href="/attractions" className="hover:text-primary">Attractions</Link>
              {mainCategory && (
                <>
                  <span>/</span>
                  <Link href={`/attractions?categorySlug=${encodeURIComponent(mainCategory.slug)}`} className="hover:text-primary">
                    {mainCategory.name}
                  </Link>
                </>
              )}
            </nav>

            <ClassificationBadge classification={a.classification} block />
            <h1 className="font-serif text-2xl font-light text-foreground leading-tight mb-3">{a.name}</h1>
            <div className="flex flex-col gap-1.5 text-muted-foreground mb-6">
              <div className="flex items-center gap-2">
                <MapPin className="h-3 w-3 text-primary" />
                {a.country ? (
                  <span className="font-sans text-xs">
                    <Link href={`/attractions?locationSlug=${encodeURIComponent(a.location.slug)}`} className="hover:text-primary">
                      {a.location.name}
                    </Link>
                    {a.country.name !== a.location.name && (
                      <>
                        {", "}
                        <Link href={`/attractions?countrySlug=${encodeURIComponent(a.country.slug)}`} className="hover:text-primary">
                          {a.country.name}
                        </Link>
                      </>
                    )}
                  </span>
                ) : (
                  <span className="font-sans text-xs">{place}</span>
                )}
              </div>
              {a.visitDuration && (
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3 text-primary" />
                  <span className="font-sans text-xs">{a.visitDuration}</span>
                </div>
              )}
              <HotelsNote attraction={a} withNote />
              {a.priceFrom != null && (
                <p className="font-sans text-xs">From ${a.priceFrom.toLocaleString()}</p>
              )}
            </div>

            <Separator className="bg-border/40 mb-6" />

            <div className="flex items-center justify-between mb-4">
              <p className="font-sans text-xs font-medium uppercase tracking-widest text-primary">Plan your visit</p>
              <button
                type="button"
                onClick={() => changeStep(null)}
                data-testid="attraction-overview-btn"
                className={cn(
                  "font-sans text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded transition-all duration-200 border",
                  activeStep === null
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground border-border/60 hover:border-primary/40 bg-card/50",
                )}
              >
                Overview
              </button>
            </div>

            <div className="space-y-1">
              {steps.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => changeStep(idx)}
                  data-testid={`attraction-step-${idx}`}
                  className={cn(
                    "w-full text-left flex items-start gap-3 p-3 rounded transition-all duration-200 border",
                    idx === activeStep ? "bg-primary/10 border-primary/30" : "hover:bg-card border-transparent",
                  )}
                >
                  <span className={cn("shrink-0 mt-0.5", idx === activeStep ? "text-primary" : "text-muted-foreground")}>
                    <StepIcon step={s} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block font-sans text-sm leading-tight", idx === activeStep ? "text-foreground" : "text-foreground/75")}>
                      {s.title}
                    </span>
                    {s.images.length > 1 && (
                      <span className="inline-flex items-center gap-1 font-sans text-[10px] text-muted-foreground mt-1">
                        <Images className="w-2.5 h-2.5" /> {s.images.length} photos
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>

            <Separator className="bg-border/40 my-6" />

            {a.categories.length > 0 && (
              <>
                <p className="font-sans text-xs font-medium uppercase tracking-widest text-primary mb-3">Categories</p>
                <div className="flex flex-wrap gap-1.5 mb-6">
                  {a.categories.map((c) => (
                    <Link
                      key={c.id}
                      href={`/attractions?categorySlug=${encodeURIComponent(c.slug)}`}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full border border-border/60 font-sans text-xs text-foreground/80 hover:border-primary hover:text-primary transition-colors"
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
              </>
            )}

            {a.activities.length > 0 && (
              <>
                <ActivitiesPanel attraction={a} />
                <Separator className="bg-border/40 my-6" />
              </>
            )}

            <Button
              className="w-full font-sans text-xs uppercase tracking-widest"
              onClick={() => setEnquiryOpen(true)}
              data-testid="attraction-enquire-btn"
            >
              Enquire Now
            </Button>
          </div>
        </div>

        {/* ── Right panel ───────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden pt-20">
          <div className="relative overflow-hidden select-none min-h-[50vh] md:flex-1">
            <div className={cn("absolute inset-0 transition-opacity duration-300", visible ? "opacity-100" : "opacity-0")}>
              <img
                key={`${activeStep ?? "overview"}-${index}`}
                src={images[index]}
                alt={step?.title ?? a.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80" />
            </div>

            {images.length > 1 && visible && (
              <>
                <div className="absolute top-6 right-6 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-white">
                  <Images className="w-3.5 h-3.5 text-primary" />
                  <span className="font-sans text-xs font-medium tracking-widest">
                    {index + 1} / {images.length}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="Previous image"
                  onClick={prev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/45 hover:bg-black/75 text-white border border-white/20 flex items-center justify-center backdrop-blur-md"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  aria-label="Next image"
                  onClick={next}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-black/45 hover:bg-black/75 text-white border border-white/20 flex items-center justify-center backdrop-blur-md"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            <div className={cn("absolute bottom-0 left-0 right-0 p-6 md:p-8 z-10 transition-opacity duration-300", visible ? "opacity-100" : "opacity-0")}>
              <p className="font-sans text-xs uppercase tracking-widest text-accent mb-1">{step ? a.name : place}</p>
              <h2 className="font-serif text-2xl md:text-3xl font-light text-white">{step ? step.title : a.name}</h2>
            </div>
          </div>

          <div className={cn("bg-background border-t border-border/40 p-6 md:p-8 transition-opacity duration-300", visible ? "opacity-100" : "opacity-0")}>
            <p className="font-sans text-sm text-muted-foreground leading-relaxed max-w-3xl whitespace-pre-line" data-testid="attraction-panel-text">
              {step ? step.description : a.description}
            </p>
          </div>
        </div>
      </div>

      <Footer />

      <EnquiryModal
        open={enquiryOpen}
        onClose={() => setEnquiryOpen(false)}
        attraction={{
          id: a.id,
          title: a.name,
          coverImage: a.coverImage,
          location: place,
          featured: a.classification === "exclusive",
          subtitle: a.visitDuration,
        }}
      />
    </div>
  );
}
