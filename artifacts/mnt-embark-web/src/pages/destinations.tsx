import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useListDestinations, useListCountries } from "@workspace/api-client-react";
import { useAttractions } from "@/lib/attractions-api";
import { Skeleton } from "@workspace/mnt-embark/components/ui/skeleton";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import { Badge } from "@workspace/mnt-embark/components/ui/badge";
import { Globe2, MapPin, Compass, Search } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { CountryCard } from "@/components/CountryCard";
import {
  REGIONS_DATA,
  COUNTRIES_DATA,
  type RegionGroup,
  type CountryItem,
} from "@/lib/countriesData";

export default function DestinationsPage() {
  const [location] = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), [location]);
  const initialRegion = searchParams.get("region") || "all";

  const [selectedRegion, setSelectedRegion] = useState<string>(initialRegion);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: destinations, isLoading, isError, refetch } = useListDestinations();
  const { data: countries } = useListCountries();
  const { data: attractions, isLoading: attractionsLoading } = useAttractions();

  // Filtered regions & countries
  const displayedRegions = useMemo(() => {
    let list = REGIONS_DATA;

    if (selectedRegion !== "all") {
      list = list.filter((r) => r.slug === selectedRegion);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list
        .map((region) => ({
          ...region,
          countries: region.countries.filter(
            (c) =>
              c.name.toLowerCase().includes(q) ||
              c.description.toLowerCase().includes(q) ||
              c.regionLabel.toLowerCase().includes(q) ||
              (c.highlights && c.highlights.some((h) => h.toLowerCase().includes(q)))
          ),
        }))
        .filter((region) => region.countries.length > 0);
    }

    return list;
  }, [selectedRegion, searchQuery]);

  const totalCountries = useMemo(() => {
    return displayedRegions.reduce((acc, r) => acc + r.countries.length, 0);
  }, [displayedRegions]);

  return (
    <div className="min-h-[100dvh] bg-background">
      <Navbar />

      {/* Header */}
      <div className="pt-36 pb-16 border-b border-border/30 bg-card/20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 font-sans text-xs font-semibold uppercase tracking-[0.25em] text-primary">
              <Globe2 className="h-3.5 w-3.5" />
              Worldwide Portfolio
            </span>
          </div>

          <h1 className="font-serif text-5xl md:text-7xl font-light text-foreground mb-6">
            Destinations & Regions
          </h1>

          <p className="font-sans text-sm md:text-base text-muted-foreground max-w-2xl leading-relaxed">
            From the serene bamboo groves of the Far East and limestone bays of Southeast Asia, to the imperial capitals of Europe and untamed savannas of Africa.
          </p>
        </div>
      </div>

      {/* Regional Explorer Controls */}
      <div className="sticky top-16 z-30 bg-background/95 backdrop-blur-md border-y border-border/40 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Region Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
            <button
              onClick={() => setSelectedRegion("all")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-sans font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
                selectedRegion === "all"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-card text-muted-foreground hover:text-foreground hover:bg-card/80 border border-border/50"
              }`}
            >
              All Regions ({COUNTRIES_DATA.length})
            </button>

            {REGIONS_DATA.map((r) => (
              <button
                key={r.slug}
                onClick={() => setSelectedRegion(r.slug)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-sans font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
                  selectedRegion === r.slug
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-card text-muted-foreground hover:text-foreground hover:bg-card/80 border border-border/50"
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search countries, highlights..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs font-sans rounded-full bg-card border border-border/60 focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/70"
            />
          </div>
        </div>
      </div>

      {/* Regional Groupings Showcase */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        {displayedRegions.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-px bg-primary mx-auto mb-8" />
            <h3 className="font-serif text-3xl font-light text-foreground mb-4">
              No Destinations Found
            </h3>
            <p className="font-sans text-sm text-muted-foreground mb-6">
              We couldn't find any destinations matching "{searchQuery}".
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedRegion("all");
                setSearchQuery("");
              }}
              className="font-sans text-xs uppercase tracking-widest"
            >
              View All Destinations
            </Button>
            <div className="w-16 h-px bg-primary mx-auto mt-8" />
          </div>
        ) : (
          <div className="space-y-24">
            {displayedRegions.map((region) => (
              <section
                key={region.slug}
                id={region.slug}
                className="scroll-mt-36"
                data-testid={`region-section-${region.slug}`}
              >
                {/* Region Section Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 pb-4 border-b border-border/40 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-sans font-semibold uppercase tracking-[0.2em] text-primary">
                        <Compass className="h-3 w-3" />
                        Regional Collection
                      </span>
                    </div>

                    <h2 className="font-serif text-3xl md:text-5xl font-light text-foreground">
                      {region.name}
                    </h2>

                    <p className="font-sans text-xs md:text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
                      {region.description}
                    </p>
                  </div>

                  <span className="shrink-0 font-sans text-xs font-semibold uppercase tracking-widest text-primary/80 bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                    {region.countries.length} {region.countries.length === 1 ? "Country" : "Countries"}
                  </span>
                </div>

                {/* Countries Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {region.countries.map((country) => (
                    <CountryCard key={country.slug} country={country} height="360px" />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
