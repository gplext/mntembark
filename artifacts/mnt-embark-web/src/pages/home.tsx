import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useGetFeaturedTours, useListJournalEntries, useListDestinations } from "@workspace/api-client-react";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import { Badge } from "@workspace/mnt-embark/components/ui/badge";
import { Skeleton } from "@workspace/mnt-embark/components/ui/skeleton";
import { Separator } from "@workspace/mnt-embark/components/ui/separator";
import { cn } from "@workspace/mnt-embark/lib/utils";
import { MapPin, Clock, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { TourCard } from "@/components/TourCard";
import { DestinationCoverImage } from "@/components/DestinationCoverImage";
import { DestinationMontage } from "@/components/DestinationMontage";

const CAROUSEL_FADE_MS = 240;
const CAROUSEL_GAP_MS = 16;

function HeroCarousel() {
  const { data: tours, isLoading } = useGetFeaturedTours();
  const [activeIndex, setActiveIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [transitionPhase, setTransitionPhase] = useState<"idle" | "out" | "black" | "ready" | "in">("idle");
  const [pendingLoaded, setPendingLoaded] = useState(false);
  const transitionTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const loadedImageUrls = useRef(new Set<string>());

  const clearTransitionTimers = () => {
    transitionTimers.current.forEach((timer) => clearTimeout(timer));
    transitionTimers.current = [];
  };

  const beginTransition = (nextIndex: number) => {
    if (fading || nextIndex === activeIndex) return;

    clearTransitionTimers();
    setFading(true);
    setPendingIndex(nextIndex);
    setPendingLoaded(loadedImageUrls.current.has(tours?.[nextIndex]?.coverImage ?? ""));
    setTransitionPhase("out");
    transitionTimers.current = [
      setTimeout(() => setTransitionPhase("black"), CAROUSEL_FADE_MS),
    ];
  };

  const revealPending = () => {
    if (pendingIndex === null || pendingLoaded) return;

    setPendingLoaded(true);
  };

  const cancelTransition = () => {
    clearTransitionTimers();
    setPendingIndex(null);
    setPendingLoaded(false);
    setTransitionPhase("idle");
    setFading(false);
  };

  useEffect(() => () => clearTransitionTimers(), []);

  useEffect(() => {
    if (!tours || tours.length === 0) return;

    const preloadedImages = tours.map((tour) => {
      const image = new Image();
      image.onload = () => loadedImageUrls.current.add(tour.coverImage);
      image.src = tour.coverImage;
      return image;
    });

    return () => {
      preloadedImages.forEach((image) => {
        image.onload = null;
        image.onerror = null;
      });
    };
  }, [tours]);

  useEffect(() => {
    if (transitionPhase !== "black" || pendingIndex === null || !pendingLoaded) return;
    setActiveIndex(pendingIndex);
    setTransitionPhase("ready");
  }, [transitionPhase, pendingIndex, pendingLoaded]);

  useEffect(() => {
    if (transitionPhase !== "ready") return;

    const timer = setTimeout(() => {
      setTransitionPhase("in");
    }, CAROUSEL_GAP_MS);

    return () => clearTimeout(timer);
  }, [transitionPhase]);

  useEffect(() => {
    if (transitionPhase !== "in") return;

    const timer = setTimeout(() => {
      setTransitionPhase("idle");
      setPendingIndex(null);
      setPendingLoaded(false);
      setFading(false);
    }, CAROUSEL_FADE_MS);

    return () => clearTimeout(timer);
  }, [transitionPhase]);

  useEffect(() => {
    if (!tours || tours.length === 0 || fading) return;
    const timeout = setTimeout(
      () => beginTransition((activeIndex + 1) % tours.length),
      4000,
    );
    return () => clearTimeout(timeout);
  }, [tours, activeIndex, fading]);

  const goTo = (idx: number) => {
    beginTransition(idx);
  };

  if (isLoading) {
    return (
      <div className="relative w-full" style={{ height: "100dvh" }}>
        <Skeleton className="w-full h-full bg-card" />
      </div>
    );
  }

  if (!tours || tours.length === 0) {
    return (
      <div
        className="relative w-full flex items-center justify-center bg-card"
        style={{ height: "100dvh" }}
      >
        <div className="text-center">
          <h1 className="font-serif text-6xl font-light text-foreground tracking-wide">
            MNT Embark
          </h1>
          <p className="mt-4 font-sans text-sm text-muted-foreground tracking-widest uppercase">
            Exclusive like no other
          </p>
        </div>
      </div>
    );
  }

  const tour = tours[activeIndex];
  const pendingTour = pendingIndex === null ? null : tours[pendingIndex];
  const slideOpacity = transitionPhase === "idle" || transitionPhase === "in" ? 1 : 0;
  const renderTourContent = (displayTour: typeof tour) => (
    <div className="max-w-4xl">
      {displayTour.featured && (
        <Badge
          variant="outline"
          className="border-accent text-accent font-sans text-xs font-semibold tracking-widest uppercase mb-4"
        >
          Featured
        </Badge>
      )}
      <h2 className="font-serif text-5xl md:text-7xl font-light text-white leading-tight mb-4">
        {displayTour.title}
      </h2>
      <div className="flex items-center gap-2 mb-6">
        <MapPin className="h-4 w-4 text-accent" />
        <span className="font-sans text-sm text-white/80 tracking-wide">
          {displayTour.location}
        </span>
        <span className="text-white/60 mx-2">|</span>
        <Clock className="h-4 w-4 text-accent" />
        <span className="font-sans text-sm text-white/80 tracking-wide">
          {displayTour.durationDays} days
        </span>
      </div>
      <div className="flex gap-4">
        <Link
          href={`/tours/${displayTour.slug ?? displayTour.id}`}
          data-testid={`hero-cta-${displayTour.id}`}
        >
          <Button
            variant="default"
            className="font-sans text-xs font-semibold tracking-widest uppercase text-white hover:text-white"
          >
            Discover Journey
          </Button>
        </Link>
        <Link
          href="/tours"
          data-testid="hero-view-all"
        >
          <Button
            variant="outline"
            className="font-sans text-xs font-semibold tracking-widest uppercase text-white hover:text-white border-white/60 hover:border-white"
          >
            View All Tours
          </Button>
        </Link>
      </div>
    </div>
  );

  return (
    <div
      className="relative w-full overflow-hidden bg-black"
      style={{ height: "100dvh" }}
      data-testid="hero-carousel"
    >
      {/* Background image */}
      <div
        className="absolute inset-0"
        style={{
          opacity: slideOpacity,
          transition: `opacity ${CAROUSEL_FADE_MS}ms ease`,
        }}
      >
        <img
          src={tour.coverImage}
          alt={tour.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/80" />
      </div>

      {/* Preload the next image without allowing it to appear before the fade. */}
      {pendingTour && (
        <div
          className="absolute inset-0 pointer-events-none opacity-0"
          aria-hidden="true"
          style={{
            visibility: "hidden",
          }}
        >
          <img
            src={pendingTour.coverImage}
            alt=""
            onLoad={revealPending}
            onError={cancelTransition}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Slide content follows the same fade timing as the image. */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 p-8 md:p-16"
        style={{
          opacity: slideOpacity,
          transition: `opacity ${CAROUSEL_FADE_MS}ms ease`,
          pointerEvents: transitionPhase === "idle" || transitionPhase === "in" ? "auto" : "none",
        }}
      >
        {renderTourContent(tour)}
      </div>

      {/* Slide controls */}
      <div className="absolute right-8 md:right-16 bottom-1/2 translate-y-1/2 flex flex-col gap-3">
        {tours.map((_, idx) => (
          <button
            key={idx}
            data-testid={`hero-dot-${idx}`}
            onClick={() => goTo(idx)}
            className={cn(
              "w-1 rounded-full transition-all duration-300",
              idx === activeIndex ? "h-8 bg-primary" : "h-3 bg-foreground/30 hover:bg-foreground/60"
            )}
          />
        ))}
      </div>

      {/* Prev/next */}
      <button
        data-testid="hero-prev"
        onClick={() => goTo((activeIndex - 1 + tours.length) % tours.length)}
        className="absolute left-6 top-1/2 -translate-y-1/2 p-2 text-foreground/50 hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        data-testid="hero-next"
        onClick={() => goTo((activeIndex + 1) % tours.length)}
        className="absolute right-6 md:right-14 top-1/2 -translate-y-1/2 p-2 text-foreground/50 hover:text-foreground transition-colors"
      >
        <ChevronRight className="h-6 w-6" />
      </button>
    </div>
  );
}

function LatestTravelsSection() {
  const { data: tours, isLoading } = useGetFeaturedTours();

  const portraitTours = tours?.slice(0, 4) ?? [];

  return (
    <section className="max-w-7xl mx-auto px-6 py-20" data-testid="latest-travels">
      <div className="flex items-end justify-between mb-12">
        <div>
          <p className="font-sans text-xs font-medium uppercase tracking-widest text-primary mb-2">
            Latest Travels
          </p>
          <h2 className="font-serif text-4xl font-light text-foreground">
            Recent Expeditions
          </h2>
        </div>
        <Link href="/tours">
          <Button variant="ghost" data-testid="latest-travels-view-all" className="font-sans text-xs uppercase tracking-widest text-muted-foreground hover:text-primary gap-2">
            View All <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded">
                <Skeleton className="w-full h-full bg-card" />
              </div>
            ))
          : portraitTours.map((tour, idx) => (
              <Link
                key={tour.id}
                href={`/tours/${tour.slug ?? tour.id}`}
                data-testid={`latest-travel-card-${tour.id}`}
                className="group relative overflow-hidden rounded block"
                style={{ aspectRatio: "2/3" }}
              >
                <img
                  src={tour.images[0] || tour.coverImage}
                  alt={tour.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                    <p className="font-serif text-base font-bold text-white leading-tight">
                    {tour.title}
                  </p>
                  <p className="font-sans text-xs font-bold text-accent mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {tour.location}
                  </p>
                </div>
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center">
                    <ArrowRight className="h-3 w-3 text-accent" />
                  </div>
                </div>
              </Link>
            ))}
      </div>
    </section>
  );
}

function JournalCarousel() {
  const { data: journals, isLoading } = useListJournalEntries();
  const [activeIndex, setActiveIndex] = useState(0);

  if (isLoading) {
    return (
      <section className="py-20 bg-card/30">
        <div className="max-w-7xl mx-auto px-6">
          <Skeleton className="h-96 w-full rounded" />
        </div>
      </section>
    );
  }

  if (!journals || journals.length === 0) return null;

  const journal = journals[activeIndex];

  return (
    <section className="py-20 bg-card/30" data-testid="journal-carousel">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-end justify-between mb-12">
          <div>
            <p className="font-sans text-xs font-medium uppercase tracking-widest text-primary mb-2">
              Travel Journals
            </p>
            <h2 className="font-serif text-4xl font-light text-foreground">
              Editorial Perspectives
            </h2>
          </div>
          <Link href="/journals">
            <Button variant="ghost" data-testid="journals-view-all" className="font-sans text-xs uppercase tracking-widest text-muted-foreground hover:text-primary gap-2">
              All Journals <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div className="relative aspect-[4/3] overflow-hidden rounded">
            <img
              src={journal.coverImage}
              alt={journal.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/20" />
          </div>
          <div className="space-y-6">
            <div>
              <p className="font-sans text-xs font-medium uppercase tracking-widest text-primary mb-3">
                {journal.location}
              </p>
              <h3 className="font-serif text-3xl md:text-4xl font-light text-foreground leading-tight mb-4">
                {journal.title}
              </h3>
              <p className="font-sans text-sm text-muted-foreground leading-relaxed">
                {journal.excerpt}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-8 h-px bg-primary" />
              <p className="font-sans text-xs text-muted-foreground tracking-widest uppercase">
                {journal.author}
              </p>
            </div>
            <Link href={`/journals/${journal.id}`}>
              <Button variant="outline" data-testid={`journal-read-${journal.id}`} className="font-sans text-xs uppercase tracking-widest">
                Read Journal
              </Button>
            </Link>
          </div>
        </div>

        {/* Dots */}
        <div className="flex gap-3 mt-8 justify-center">
          {journals.map((_, idx) => (
            <button
              key={idx}
              data-testid={`journal-dot-${idx}`}
              onClick={() => setActiveIndex(idx)}
              className={cn(
                "h-1 rounded-full transition-all duration-300",
                idx === activeIndex ? "w-8 bg-primary" : "w-3 bg-foreground/20 hover:bg-foreground/40"
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function DestinationsCarousel() {
  const { data: destinations, isLoading } = useListDestinations();
  const [startIdx, setStartIdx] = useState(0);

  const visible = 3;

  if (isLoading) {
    return (
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-80 rounded bg-card" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!destinations || destinations.length === 0) return null;

  const displayed = destinations.slice(startIdx, startIdx + visible);

  return (
    <section className="py-20" data-testid="destinations-section">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-end justify-between mb-12">
          <div>
            <p className="font-sans text-xs font-medium uppercase tracking-widest text-primary mb-2">
              Where to Go
            </p>
            <h2 className="font-serif text-4xl font-light text-foreground">
              Our Best Sellers
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <button
              data-testid="destinations-prev"
              onClick={() => setStartIdx(Math.max(0, startIdx - 1))}
              disabled={startIdx === 0}
              className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              data-testid="destinations-next"
              onClick={() => setStartIdx(Math.min(destinations.length - visible, startIdx + 1))}
              disabled={startIdx + visible >= destinations.length}
              className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <Link href="/destinations">
              <Button variant="ghost" data-testid="destinations-view-all" className="font-sans text-xs uppercase tracking-widest text-muted-foreground hover:text-primary gap-2">
                All <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {displayed.map((dest, idx) => (
            <Link
              key={dest.id}
              href={`/destinations`}
              data-testid={`destination-card-${dest.id}`}
              className="group relative overflow-hidden rounded block"
              style={{ height: idx === 1 ? "420px" : "320px" }}
            >
              <DestinationCoverImage
                coverImage={dest.coverImage}
                alt={dest.name}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <p className="font-sans text-xs font-bold uppercase tracking-widest text-accent mb-1">
                  {dest.country}
                </p>
                    <h3 className="font-serif text-2xl font-bold text-white">
                  {dest.name}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function ToursCarousel() {
  const { data: tours, isLoading } = useGetFeaturedTours();
  const exclusiveTours = (tours || []).filter(
    (tour) => tour.classification === "exclusive",
  );

  return (
    <section className="py-20 bg-card/20" data-testid="tours-section">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-end justify-between mb-12">
          <div>
            <p className="font-sans text-xs font-medium uppercase tracking-widest text-primary mb-2">
              Our Unique Offerings
            </p>
            <h2 className="font-serif text-4xl font-light text-foreground">
              Signature Journeys
            </h2>
          </div>
          <Link href="/tours?classification=exclusive&classification=special">
            <Button variant="ghost" data-testid="tours-view-all" className="font-sans text-xs uppercase tracking-widest text-muted-foreground hover:text-primary gap-2">
              Signature Tours <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded bg-card" />
              ))
            : exclusiveTours.slice(0, 3).map((tour) => (
                <TourCard key={tour.id} tour={tour} />
              ))}
        </div>
      </div>
    </section>
  );
}

function VideoSection() {
  return (
    <section
      className="relative w-full overflow-hidden bg-card"
      style={{ height: "70vh" }}
      data-testid="video-section"
    >
      <div
        className="absolute inset-0 bg-gradient-to-br from-background via-card to-background"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 60% 40%, hsl(var(--primary)/0.08) 0%, transparent 60%)",
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center max-w-3xl px-6">
          <div className="w-16 h-px bg-primary mx-auto mb-8" />
          <h2 className="font-serif text-5xl md:text-6xl font-light text-foreground tracking-wide mb-6">
            MNT Embark
          </h2>
          <p className="font-sans text-sm tracking-widest uppercase text-primary mb-6">
            Exclusive like no other
          </p>
          <p className="font-sans text-base text-muted-foreground leading-relaxed mb-8">
            Every journey begins with a single extraordinary choice. We exist for those
            who understand that true luxury is not a destination — it is how you arrive.
          </p>
          <div className="w-16 h-px bg-primary mx-auto" />
        </div>
      </div>

      <div className="absolute top-8 left-8 w-12 h-12 border-t border-l border-primary/30" />
      <div className="absolute top-8 right-8 w-12 h-12 border-t border-r border-primary/30" />
      <div className="absolute bottom-8 left-8 w-12 h-12 border-b border-l border-primary/30" />
      <div className="absolute bottom-8 right-8 w-12 h-12 border-b border-r border-primary/30" />
    </section>
  );
}

function PhilosophySection() {
  return (
    <section
      className="bg-background px-6 py-12 text-center md:py-16"
      data-testid="philosophy-section"
    >
      <div className="mx-auto max-w-5xl">
        <p className="font-sans text-xs font-medium uppercase tracking-[0.35em] text-primary/60">
          Our Philosophy
        </p>
        <h2 className="mt-8 font-serif text-3xl font-light leading-tight tracking-wide text-foreground md:text-5xl">
          <span className="block">We craft journeys that redefine the possible.</span>
          <span className="mt-2 block">Every detail considered, every moment elevated.</span>
        </h2>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <Navbar />
      <HeroCarousel />
      <PhilosophySection />
      <LatestTravelsSection />
      <Separator className="bg-border/20" />
      <JournalCarousel />
      <DestinationsCarousel />
      <ToursCarousel />
      <DestinationMontage />
      <VideoSection />
      <Footer />
    </div>
  );
}
