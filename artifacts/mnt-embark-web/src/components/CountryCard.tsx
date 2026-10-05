import { useState } from "react";
import { Link } from "wouter";
import { MapPin, ArrowRight, Sparkles, Send } from "lucide-react";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import EnquiryModal from "@/components/EnquiryModal";
import type { CountryItem } from "@/lib/countriesData";

interface CountryCardProps {
  country: CountryItem;
  className?: string;
  height?: string;
}

export function CountryCard({ country, className = "", height = "360px" }: CountryCardProps) {
  const [enquiryOpen, setEnquiryOpen] = useState(false);

  return (
    <>
      <div
        data-testid={`country-card-${country.slug}`}
        className={`group relative overflow-hidden rounded-md border border-border/40 bg-card shadow-sm transition-all duration-500 hover:shadow-xl hover:border-primary/50 flex flex-col justify-between ${className}`}
        style={{ height }}
      >
        {/* Background Image */}
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={country.image}
            alt={country.name}
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            loading="lazy"
          />
          {/* Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20 group-hover:from-black/95 group-hover:via-black/50 transition-colors duration-500" />
        </div>

        {/* Top Badges */}
        <div className="relative z-10 p-5 flex items-start justify-between">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-sans font-semibold uppercase tracking-wider bg-black/50 backdrop-blur-md text-white border border-white/10">
            <MapPin className="h-3 w-3 text-accent" />
            {country.regionLabel.split("&")[0].trim()}
          </span>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setEnquiryOpen(true);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-sans font-semibold uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
            title={`Enquire for ${country.name}`}
          >
            <Send className="h-2.5 w-2.5" />
            Enquire
          </button>
        </div>

        {/* Bottom Content */}
        <div className="relative z-10 p-6 transition-transform duration-300">
          <div className="mb-2">
            <h3 className="font-serif text-2xl md:text-3xl font-light text-white tracking-wide leading-tight group-hover:text-accent transition-colors">
              {country.name}
            </h3>
          </div>

          <p className="font-sans text-xs text-white/80 line-clamp-2 leading-relaxed mb-4">
            {country.description}
          </p>

          {/* Highlights Preview on Hover */}
          {country.highlights && country.highlights.length > 0 && (
            <div className="hidden group-hover:flex flex-wrap gap-1.5 pt-2 border-t border-white/15 animate-in fade-in duration-300">
              {country.highlights.slice(0, 2).map((highlight, idx) => (
                <span
                  key={idx}
                  className="text-[10px] font-sans text-white/90 bg-white/10 backdrop-blur-sm px-2 py-0.5 rounded"
                >
                  {highlight}
                </span>
              ))}
            </div>
          )}

          {/* Action Link */}
          <div className="mt-4 flex items-center justify-between pt-2 border-t border-white/10 group-hover:border-white/20">
            <Link
              href={`/destinations?region=${country.region}&country=${country.slug}`}
              className="inline-flex items-center gap-1.5 font-sans text-xs font-semibold uppercase tracking-widest text-accent hover:text-white transition-colors"
            >
              Explore Country <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
            </Link>

            <span className="font-serif italic text-xs text-white/60">
              MNT Curated
            </span>
          </div>
        </div>

        {/* Gold Accent Top Border */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      {/* Quick Enquiry Modal */}
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
    </>
  );
}
