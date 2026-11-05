import { Button } from "@workspace/mnt-embark/components/ui/button";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function AboutPage() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <Navbar />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="pt-32 pb-24 border-b border-border/30 text-center">
        <div className="max-w-2xl mx-auto px-6">
          <p className="font-sans text-sm font-medium tracking-[0.3em] uppercase text-foreground mb-2">
            MNT EMBARK
          </p>
          <p className="font-sans text-xs font-medium tracking-[0.25em] uppercase text-primary mb-10">
            Beyond the Reach of the Ordinary
          </p>
          <h1 className="font-serif text-6xl md:text-7xl font-light text-foreground leading-[1.05] mb-8">
            Curators of the{" "}
            <em>Unreachable</em>
          </h1>
          <p className="font-sans text-base text-muted-foreground leading-relaxed mb-10 max-w-lg mx-auto">
            Unlocking doors that remain closed to the ordinary traveler, granting
            you entry to extraordinary places and rare experiences.
          </p>
          <a
            href="#our-story"
            className="font-sans text-xs tracking-[0.2em] uppercase text-primary border-b border-primary/50 pb-0.5 hover:border-primary transition-colors"
          >
            Our Story
          </a>
        </div>
      </div>

      {/* ── What luxury means here ────────────────────────────────────────── */}
      <div className="border-b border-border/30">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-serif text-4xl md:text-5xl font-light text-foreground leading-[1.15] mb-8">
                True luxury is experiencing the world through{" "}
                <em className="text-primary not-italic font-serif">
                  quiet, untouched and rare
                </em>{" "}
                places.
              </h2>
              <p className="font-sans text-sm text-muted-foreground leading-relaxed">
                It is the privilege of stepping off the beaten path into pristine
                corners of the earth, where the world feels unspoiled and every
                moment is one of wonder. We craft journeys that grant you quiet
                access to these extraordinary places, allowing you to experience
                the world in its most serene and authentic form.
              </p>
            </div>

            <div className="relative overflow-hidden rounded-sm aspect-[4/5] md:aspect-auto md:h-[520px]">
              <img
                src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&q=85&auto=format&fit=crop"
                alt="Private beach sanctuary at golden hour"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── The company ───────────────────────────────────────────────────── */}
      <div id="our-story" className="border-b border-border/30 bg-card/20">
        <div className="max-w-7xl mx-auto px-6 py-20 md:py-24">

          <div className="max-w-3xl">
            <p className="font-sans text-xs font-medium uppercase tracking-widest text-primary mb-3">
              Our Story
            </p>
            <h2 className="font-serif text-4xl md:text-5xl font-light text-foreground leading-[1.1] mb-8">
              Multinational Travels{" "}
              <span className="text-muted-foreground">(Pvt) Ltd</span>
            </h2>
            <p className="font-sans text-base text-muted-foreground leading-relaxed mb-5">
              A premier luxury travel management company trusted by industry
              leaders and discerning travelers worldwide. For over four decades
              we have set the standard for excellence in luxury travel, on a
              reputation built on trust, precision, and an unwavering commitment
              to exceptional service.
            </p>
            <p className="font-sans text-base text-muted-foreground leading-relaxed">
              We specialize in crafting seamless, ultra-exclusive travel
              experiences and bespoke luxury itineraries tailored to the distinct
              needs of our clients.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16">
            <div className="border-t border-primary/30 pt-6">
              <h3 className="font-serif text-2xl md:text-3xl font-light text-foreground leading-snug mb-4">
                Who We Serve
              </h3>
              <p className="font-sans text-sm text-muted-foreground leading-relaxed">
                Our esteemed clientele spans leading multinational corporations,
                premier financial institutions, fashion houses, event management
                agencies, and private travelers seeking extraordinary, exotic
                destinations.
              </p>
            </div>

            <div className="border-t border-primary/30 pt-6">
              <h3 className="font-serif text-2xl md:text-3xl font-light text-foreground leading-snug mb-4">
                Direct Global Operations
              </h3>
              <p className="font-sans text-sm text-muted-foreground leading-relaxed">
                To deliver the ultimate in luxury, exclusivity and seamless
                execution, Multinational Travels works directly with elite global
                service operators and DMC network partners. Working directly with
                premier partners ensures our clients enjoy unmatched access,
                superior value, and flawless execution for every journey.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* ── Curation ──────────────────────────────────────────────────────── */}
      <div className="border-b border-border/30 bg-background">
        <div className="max-w-3xl mx-auto px-6 py-20 md:py-24 text-center">
          <p className="font-sans text-xs font-medium uppercase tracking-widest text-primary mb-4">
            Curation
          </p>
          <h2 className="font-serif text-3xl md:text-4xl font-light text-foreground leading-snug mb-6">
            No two journeys are ever the same.
          </h2>
          <p className="font-sans text-base text-muted-foreground leading-relaxed max-w-xl mx-auto">
            We curate every single itinerary around your unique desires, turning
            personal travel dreams into seamless realities.
          </p>
        </div>
      </div>

      {/* ── Call to action ────────────────────────────────────────────────── */}
      <div className="py-20 bg-card/20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="w-16 h-px bg-primary mx-auto mb-8" />
          <h2 className="font-serif text-4xl font-light text-foreground mb-4">
            Begin Your Journey
          </h2>
          <p className="font-sans text-sm text-muted-foreground leading-relaxed mb-8">
            Our team is ready to compose your perfect journey. Every detail,
            personally curated.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/contact">
              <Button
                data-testid="about-contact-cta"
                className="font-sans text-xs uppercase tracking-widest"
              >
                Make an Enquiry
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
