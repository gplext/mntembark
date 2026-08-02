import { useState, useEffect } from "react";
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

function HeroCarousel() {
  const { data: tours, isLoading } = useGetFeaturedTours();
  const [activeIndex, setActiveIndex] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!tours || tours.length === 0) return;
    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setActiveIndex((i) => (i + 1) % tours.length);
        setFading(false);
      }, 600);
    }, 6000);
    return () => clearInterval(interval);
  }, [tours]);

  const goTo = (idx: number) => {
    setFading(true);
    setTimeout(() => {
      setActiveIndex(idx);
      setFading(false);
    }, 400);
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

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: "100dvh" }}
      data-testid="hero-carousel"
    >
      {/* Background image */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-700",
          fading ? "opacity-0" : "opacity-100"
        )}
      >
        <img
          src={tour.coverImage}
          alt={tour.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/80" />
      </div>

      {/* Content */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 p-8 md:p-16 transition-opacity duration-700",
          fading ? "opacity-0" : "opacity-100"
        )}
      >
        <div className="max-w-4xl">
          {tour.featured && (
            <Badge
              variant="outline"
              className="border-primary text-primary font-sans text-xs tracking-widest uppercase mb-4"
            >
              Featured
            </Badge>
          )}
          <h2 className="font-serif text-5xl md:text-7xl font-light text-foreground leading-tight mb-4">
            {tour.title}
          </h2>
          <div className="flex items-center gap-2 mb-6">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="font-sans text-sm text-muted-foreground tracking-wide">
              {tour.location}
            </span>
            <span className="text-border mx-2">|</span>
            <Clock className="h-4 w-4 text-primary" />
            <span className="font-sans text-sm text-muted-foreground tracking-wide">
              {tour.durationDays} days
            </span>
          </div>
          <div className="flex gap-4">
            <Link href={`/tours/${tour.id}`}>
              <Button
                variant="default"
                data-testid={`hero-cta-${tour.id}`}
                className="font-sans text-xs tracking-widest uppercase"
              >
                Discover Journey
              </Button>
            </Link>
            <Link href="/tours">
              <Button
                variant="outline"
                data-testid="hero-view-all"
                className="font-sans text-xs tracking-widest uppercase"
              >
                View All Tours
              </Button>
            </Link>
          </div>
        </div>
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
                href={`/tours/${tour.id}`}
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
                  <p className="font-serif text-base font-light text-foreground leading-tight">
                    {tour.title}
                  </p>
                  <p className="font-sans text-xs text-primary mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {tour.location}
                  </p>
                </div>
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
                    <ArrowRight className="h-3 w-3 text-primary" />
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
              Curated Destinations
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
              <img
                src={dest.coverImage}
                alt={dest.name}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <p className="font-sans text-xs font-medium uppercase tracking-widest text-primary mb-1">
                  {dest.country}
                </p>
                <h3 className="font-serif text-2xl font-light text-foreground">
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

  return (
    <section className="py-20 bg-card/20" data-testid="tours-section">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-end justify-between mb-12">
          <div>
            <p className="font-sans text-xs font-medium uppercase tracking-widest text-primary mb-2">
              Exclusive Offerings
            </p>
            <h2 className="font-serif text-4xl font-light text-foreground">
              Signature Journeys
            </h2>
          </div>
          <Link href="/tours">
            <Button variant="ghost" data-testid="tours-view-all" className="font-sans text-xs uppercase tracking-widest text-muted-foreground hover:text-primary gap-2">
              All Tours <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded bg-card" />
              ))
            : (tours || []).slice(0, 3).map((tour) => (
                <Link
                  key={tour.id}
                  href={`/tours/${tour.id}`}
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
                      {tour.featured && (
                        <Badge variant="outline" className="border-primary text-primary text-xs shrink-0 ml-2">
                          Exclusive
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground mb-4">
                      <MapPin className="h-3 w-3 text-primary" />
                      <span className="font-sans text-xs">{tour.location}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="font-sans text-xs text-muted-foreground">
                          {tour.durationDays} days
                        </span>
                      </div>
                      <p className="font-sans text-sm text-foreground">
                        From{" "}
                        <span className="text-primary font-medium">
                          ${tour.priceFrom.toLocaleString()}
                        </span>
                      </p>
                    </div>
                  </div>
                  {/* Gold accent bar */}
                  <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-primary/0 group-hover:bg-primary/60 transition-all duration-300" />
                </Link>
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
        className="absolute inset-0 bg-gradient-to-br from-black via-card to-black"
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

      {/* Decorative corner lines */}
      <div className="absolute top-8 left-8 w-12 h-12 border-t border-l border-primary/30" />
      <div className="absolute top-8 right-8 w-12 h-12 border-t border-r border-primary/30" />
      <div className="absolute bottom-8 left-8 w-12 h-12 border-b border-l border-primary/30" />
      <div className="absolute bottom-8 right-8 w-12 h-12 border-b border-r border-primary/30" />
    </section>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <Navbar />
      <HeroCarousel />
      <LatestTravelsSection />
      <Separator className="bg-border/20" />
      <JournalCarousel />
      <DestinationsCarousel />
      <ToursCarousel />
      <VideoSection />
      <Footer />
    </div>
  );
}
