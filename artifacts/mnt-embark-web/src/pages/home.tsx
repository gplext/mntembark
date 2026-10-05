import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "wouter";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import { Badge } from "@workspace/mnt-embark/components/ui/badge";
import { Skeleton } from "@workspace/mnt-embark/components/ui/skeleton";
import { Separator } from "@workspace/mnt-embark/components/ui/separator";
import { cn } from "@workspace/mnt-embark/lib/utils";
import { MapPin, ArrowRight, ChevronLeft, ChevronRight, Compass, Sparkles, Send } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CountryCard } from "@/components/CountryCard";
import { DestinationMontage } from "@/components/DestinationMontage";
import EnquiryModal from "@/components/EnquiryModal";
import {
  COUNTRIES_DATA,
  REGIONS_DATA,
  getFeaturedCountries,
  type CountryItem,
} from "@/lib/countriesData";

const CAROUSEL_FADE_MS = 280;
const CAROUSEL_GAP_MS = 16;

function HeroCarousel() {
  const items = useMemo(() => getFeaturedCountries(), []);
  const [activeIndex, setActiveIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [transitionPhase, setTransitionPhase] = useState<"idle" | "out" | "black" | "ready" | "in">("idle");
  const [pendingLoaded, setPendingLoaded] = useState(false);
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<CountryItem | null>(null);
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
    setPendingLoaded(loadedImageUrls.current.has(items?.[nextIndex]?.image ?? ""));
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
    if (!items || items.length === 0) return;

    const preloadedImages = items.map((item) => {
      const image = new Image();
      image.onload = () => loadedImageUrls.current.add(item.image);
      image.src = item.image;
      return image;
    });

    return () => {
      preloadedImages.forEach((image) => {
        image.onload = null;
        image.onerror = null;
      });
    };
  }, [items]);

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
    if (!items || items.length === 0 || fading) return;
    const timeout = setTimeout(
      () => beginTransition((activeIndex + 1) % items.length),
      5000,
    );
    return () => clearTimeout(timeout);
  }, [items, activeIndex, fading]);

  const goTo = (idx: number) => {
    beginTransition(idx);
  };

  if (!items || items.length === 0) {
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

  const currentCountry = items[activeIndex];
  const pendingCountry = pendingIndex === null ? null : items[pendingIndex];
  const slideOpacity = transitionPhase === "idle" || transitionPhase === "in" ? 1 : 0;

  return (
    <>
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
            src={currentCountry.image}
            alt={currentCountry.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/40" />
        </div>

        {/* Preload the next image without allowing it to appear before the fade. */}
        {pendingCountry && (
          <div
            className="absolute inset-0 pointer-events-none opacity-0"
            aria-hidden="true"
            style={{ visibility: "hidden" }}
          >
            <img
              src={pendingCountry.image}
              alt=""
              onLoad={revealPending}
              onError={cancelTransition}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Slide content */}
        <div
          className="absolute bottom-0 left-0 right-0 z-20 p-8 md:p-16 max-w-5xl"
          style={{
            opacity: slideOpacity,
            transition: `opacity ${CAROUSEL_FADE_MS}ms ease`,
            pointerEvents: transitionPhase === "idle" || transitionPhase === "in" ? "auto" : "none",
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-sans font-semibold uppercase tracking-widest bg-primary text-primary-foreground shadow-md">
              <Compass className="h-3.5 w-3.5" />
              {currentCountry.regionLabel}
            </span>
          </div>

          <h1 className="font-serif text-5xl sm:text-6xl md:text-8xl font-light text-white leading-tight mb-4 tracking-wide">
            {currentCountry.name}
          </h1>

          <p className="font-sans text-sm sm:text-base text-white/90 max-w-2xl leading-relaxed mb-6 font-light">
            {currentCountry.description}
          </p>

          {currentCountry.highlights && currentCountry.highlights.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8">
              {currentCountry.highlights.map((h, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-sans text-white/95 bg-white/10 backdrop-blur-md border border-white/20"
                >
                  <Sparkles className="h-3 w-3 text-accent" />
                  {h}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <Link href={`/destinations?region=${currentCountry.region}&country=${currentCountry.slug}`}>
              <Button
                variant="default"
                className="font-sans text-xs font-semibold tracking-widest uppercase text-white hover:text-white px-6 py-5 shadow-lg"
              >
                Explore Destinations <ArrowRight className="h-3.5 w-3.5 ml-2" />
              </Button>
            </Link>

            <Button
              variant="outline"
              onClick={() => {
                setSelectedCountry(currentCountry);
                setEnquiryOpen(true);
              }}
              className="font-sans text-xs font-semibold tracking-widest uppercase text-white hover:text-white border-white/60 hover:border-white px-6 py-5 backdrop-blur-sm"
            >
              Curate Private Itinerary
            </Button>
          </div>
        </div>

        {/* Slide controls */}
        <div className="absolute right-8 md:right-16 bottom-1/2 translate-y-1/2 flex flex-col gap-3 z-30">
          {items.map((_, idx) => (
            <button
              key={idx}
              data-testid={`hero-dot-${idx}`}
              onClick={() => goTo(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              className={cn(
                "w-1.5 rounded-full transition-all duration-300",
                idx === activeIndex ? "h-10 bg-primary shadow-glow" : "h-3 bg-white/40 hover:bg-white/80"
              )}
            />
          ))}
        </div>

        {/* Prev/next buttons */}
        <button
          data-testid="hero-prev"
          aria-label="Previous destination"
          onClick={() => goTo((activeIndex - 1 + items.length) % items.length)}
          className="absolute left-6 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white bg-black/20 hover:bg-black/50 backdrop-blur-sm rounded-full transition-all"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button
          data-testid="hero-next"
          aria-label="Next destination"
          onClick={() => goTo((activeIndex + 1) % items.length)}
          className="absolute right-6 md:right-14 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white bg-black/20 hover:bg-black/50 backdrop-blur-sm rounded-full transition-all"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      {/* Enquiry Modal */}
      {selectedCountry && (
        <EnquiryModal
          open={enquiryOpen}
          onClose={() => {
            setEnquiryOpen(false);
            setSelectedCountry(null);
          }}
          attraction={{
            id: selectedCountry.id ?? 1,
            title: `${selectedCountry.name} Journey`,
            coverImage: selectedCountry.image,
            location: selectedCountry.regionLabel,
            subtitle: "Private Expedition",
          }}
        />
      )}
    </>
  );
}

function PhilosophySection() {
  return (
    <section
      className="bg-background px-6 py-20 text-center border-b border-border/30"
      data-testid="philosophy-section"
    >
      <div className="mx-auto max-w-4xl">
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.35em] text-primary mb-6">
          Our Philosophy
        </p>
        <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-light leading-tight tracking-wide text-foreground">
          <span className="block">We curate extraordinary journeys across</span>
          <span className="mt-2 block italic text-primary">Asia, Europe, and Africa.</span>
        </h2>
        <p className="mt-6 font-sans text-sm md:text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto">
          Every destination is chosen for its singular ability to transform the traveler — pairing unmatched cultural depth with seamless private luxury.
        </p>
      </div>
    </section>
  );
}

function FeaturedCountriesSection() {
  const featured = useMemo(() => COUNTRIES_DATA.slice(0, 8), []);

  return (
    <section className="max-w-7xl mx-auto px-6 py-24" data-testid="featured-countries-section">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-14 gap-4">
        <div>
          <p className="font-sans text-xs font-semibold uppercase tracking-widest text-primary mb-2">
            Curated Portfolio
          </p>
          <h2 className="font-serif text-4xl md:text-5xl font-light text-foreground">
            Featured Countries
          </h2>
        </div>
        <Link href="/destinations">
          <Button
            variant="ghost"
            data-testid="countries-view-all"
            className="font-sans text-xs uppercase tracking-widest text-muted-foreground hover:text-primary gap-2"
          >
            All Regional Destinations <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {featured.map((country) => (
          <CountryCard key={country.slug} country={country} height="380px" />
        ))}
      </div>
    </section>
  );
}

function RegionalExpeditionsSection() {
  return (
    <section className="py-24 bg-card/30 border-y border-border/40" data-testid="regions-section">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="font-sans text-xs font-semibold uppercase tracking-widest text-primary mb-3">
            Worldwide Collections
          </p>
          <h2 className="font-serif text-4xl md:text-5xl font-light text-foreground mb-4">
            Expeditions by Region
          </h2>
          <p className="font-sans text-sm text-muted-foreground leading-relaxed">
            Explore curated itineraries grouped by distinct geographic and cultural landscapes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {REGIONS_DATA.map((region) => (
            <Link
              key={region.slug}
              href={`/destinations?region=${region.slug}`}
              className="group relative overflow-hidden rounded-md border border-border/50 bg-card shadow-sm hover:shadow-xl transition-all duration-500 block"
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                <img
                  src={region.coverImage}
                  alt={region.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <p className="font-serif text-2xl font-light text-white group-hover:text-accent transition-colors">
                    {region.name}
                  </p>
                  <p className="font-sans text-xs text-white/70 italic mt-1">
                    {region.tagline}
                  </p>
                </div>
              </div>

              <div className="p-5">
                <p className="font-sans text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
                  {region.description}
                </p>
                <div className="flex items-center justify-between pt-3 border-t border-border/40">
                  <span className="font-sans text-xs font-semibold text-primary uppercase tracking-wider">
                    {region.countries.length} Countries
                  </span>
                  <span className="inline-flex items-center gap-1 font-sans text-xs font-semibold uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">
                    Explore <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </div>
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
      style={{ height: "65vh" }}
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
          <p className="font-sans text-sm tracking-widest uppercase text-primary mb-6 font-semibold">
            Exclusive like no other
          </p>
          <p className="font-sans text-base text-muted-foreground leading-relaxed mb-8">
            Every journey begins with an extraordinary choice. We curate private, transformational
            travels for those who appreciate fine detail and effortless luxury.
          </p>
          <Link href="/contact">
            <Button className="font-sans text-xs font-semibold tracking-widest uppercase text-white hover:text-white px-8 py-5">
              Contact Our Travel Specialists
            </Button>
          </Link>
          <div className="w-16 h-px bg-primary mx-auto mt-8" />
        </div>
      </div>

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
      <PhilosophySection />
      <FeaturedCountriesSection />
      <RegionalExpeditionsSection />
      <DestinationMontage />
      <VideoSection />
      <Footer />
    </div>
  );
}
