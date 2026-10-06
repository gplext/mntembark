import { useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, MapPin, Send, Sparkles } from "lucide-react";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import EnquiryModal from "@/components/EnquiryModal";
import { getCountryBySlug } from "@/lib/countriesData";

/**
 * One country, one page: a single photograph, the description, and a way to
 * start a conversation. Deliberately the whole of it — attractions, tours and
 * itineraries arrive in later phases, and until then this page should read as
 * finished rather than as something with pieces missing.
 */
export default function CountryDetailPage() {
  const params = useParams<{ slug: string }>();
  const country = getCountryBySlug(params.slug ?? "");
  const [enquiryOpen, setEnquiryOpen] = useState(false);

  if (!country) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <Navbar />
        <div className="pt-48 pb-32 max-w-3xl mx-auto px-6 text-center">
          <h1 className="font-serif text-4xl font-light text-foreground mb-4">
            We don't travel there yet
          </h1>
          <p className="font-sans text-sm text-muted-foreground mb-8">
            That destination isn't part of the portfolio. Browse the countries we
            do curate, or tell us where you had in mind.
          </p>
          <Link href="/destinations">
            <Button size="lg">Browse destinations</Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <Navbar />

      {/* ── The single photograph ─────────────────────────────────────────── */}
      <div className="relative h-[60vh] min-h-[420px] w-full overflow-hidden">
        <img
          src={country.image}
          alt={country.name}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-black/55 to-black/15" />

        <div className="relative z-10 h-full max-w-5xl mx-auto px-6 flex flex-col justify-end pb-14">
          <span className="inline-flex w-fit items-center gap-1.5 px-2.5 py-1 mb-5 rounded-full text-[10px] font-sans font-semibold uppercase tracking-wider bg-black/45 backdrop-blur-md text-white border border-white/15">
            <MapPin className="h-3 w-3 text-accent" />
            {country.regionLabel}
          </span>

          <h1
            data-testid="country-title"
            className="font-serif text-5xl md:text-7xl font-light text-white tracking-wide leading-none"
          >
            {country.name}
          </h1>
        </div>
      </div>

      {/* ── Description and enquiry ───────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-6 py-16 md:py-20">
        <p
          data-testid="country-description"
          className="font-sans text-base md:text-lg text-muted-foreground leading-relaxed"
        >
          {country.description}
        </p>

        {country.highlights && country.highlights.length > 0 && (
          <div className="mt-12 pt-10 border-t border-border/40">
            <h2 className="flex items-center gap-2 font-sans text-xs font-semibold uppercase tracking-[0.25em] text-primary mb-5">
              <Sparkles className="h-3.5 w-3.5" />
              What draws us here
            </h2>
            <ul className="space-y-3">
              {country.highlights.map((highlight, idx) => (
                <li
                  key={idx}
                  className="flex gap-3 font-sans text-sm text-foreground/85 leading-relaxed"
                >
                  <span className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-primary" />
                  {highlight}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-14 pt-10 border-t border-border/40 flex flex-col sm:flex-row sm:items-center gap-5 sm:justify-between">
          <div>
            <p className="font-serif text-xl font-light text-foreground mb-1">
              Travelling to {country.name}?
            </p>
            <p className="font-sans text-xs text-muted-foreground">
              Tell us roughly what you have in mind and we'll shape it around you.
            </p>
          </div>

          <Button
            size="lg"
            data-testid="country-enquire"
            onClick={() => setEnquiryOpen(true)}
            className="gap-2 shrink-0"
          >
            <Send className="h-4 w-4" />
            Enquire
          </Button>
        </div>

        <Link
          href="/destinations"
          className="mt-14 inline-flex items-center gap-1.5 font-sans text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          All destinations
        </Link>
      </div>

      <Footer />

      {enquiryOpen && (
        <EnquiryModal
          open={enquiryOpen}
          onClose={() => setEnquiryOpen(false)}
          attraction={{
            id: country.id ?? 1,
            title: `${country.name} Expedition`,
            coverImage: country.image,
            location: country.regionLabel,
            subtitle: "Bespoke Journey",
          }}
        />
      )}
    </div>
  );
}
