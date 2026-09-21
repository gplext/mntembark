import { useState } from "react";
import { useSearchParams } from "wouter";
import { useAttractions } from "@/lib/attractions-api";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import { Input } from "@workspace/mnt-embark/components/ui/input";
import { Badge } from "@workspace/mnt-embark/components/ui/badge";
import { Skeleton } from "@workspace/mnt-embark/components/ui/skeleton";
import { Search, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { AttractionRow } from "@/components/AttractionCard";
import { AttractionFilterSidebar } from "@/components/AttractionFilterSidebar";

const VALID_CLASSIFICATIONS = ["standard", "special", "exclusive"];
const isClassification = (v: string) => VALID_CLASSIFICATIONS.includes(v);

/**
 * /attractions - every attraction, filterable by the URL so a filtered view
 * can be linked from destination, category and activity pages.
 */
export default function AttractionsPage() {
  const [urlParams, setUrlParams] = useSearchParams();

  // ── search (q lives in URL so the view is shareable) ──────────────────────
  const qParam = urlParams.get("q") ?? "";
  // Controlled input value — decoupled from URL until the user submits
  const [searchInput, setSearchInput] = useState(qParam);

  // ── taxonomy filters (all from URL) ───────────────────────────────────────
  const categorySlug    = urlParams.get("categorySlug")    ?? undefined;
  const destinationSlug = urlParams.get("destinationSlug") ?? undefined;
  const countrySlug     = urlParams.get("countrySlug")     ?? undefined;
  const locationSlug    = urlParams.get("locationSlug")    ?? undefined;

  const rawClassifications = urlParams.getAll("classification");
  const classifications    = rawClassifications.filter(isClassification);
  const activitySlugs      = urlParams.getAll("activitySlugs");

  // Count of active sidebar filter selections (shown next to "Clear all")
  const activeFilterCount =
    (categorySlug ? 1 : 0) +
    (destinationSlug ? 1 : 0) +
    (countrySlug ? 1 : 0) +
    (locationSlug ? 1 : 0) +
    classifications.length +
    activitySlugs.length;

  // ── data ──────────────────────────────────────────────────────────────────
  // One endpoint for both: with `q` the server ranks by match, without it by
  // featured and display order. Filters apply either way.
  const { data: attractions, isLoading } = useAttractions({
    q: qParam,
    categorySlug,
    destinationSlug,
    countrySlug,
    locationSlug,
    classification: classifications,
    activitySlugs,
  });

  // ── handlers ──────────────────────────────────────────────────────────────
  function handleSearch() {
    const trimmed = searchInput.trim();
    setUrlParams(prev => {
      const next = new URLSearchParams(prev);
      if (trimmed) next.set("q", trimmed);
      else next.delete("q");
      return next;
    });
  }

  function clearSearch() {
    setSearchInput("");
    setUrlParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete("q");
      return next;
    });
  }

  function clearAll() {
    setSearchInput("");
    setUrlParams(new URLSearchParams());
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[100dvh] bg-background">
      <Navbar />

      {/* Page header */}
      <div className="pt-24 pb-12 border-b border-border/30">
        <div className="max-w-7xl mx-auto px-6">
          <p className="font-sans text-xs font-medium uppercase tracking-widest text-primary mb-3">
            Our Collection
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl font-light text-foreground mb-2">
            Attractions
          </h1>
          <p className="font-sans text-sm text-muted-foreground">
            The places worth the journey, with how to reach each one and what to bring.
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="max-w-7xl mx-auto px-6 py-6 border-b border-border/20">
        <div className="flex gap-4 items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              data-testid="attractions-search-input"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="Search by place, country, category or activity…"
              className="pl-12 pr-12 h-12 bg-card border-border/60 font-sans text-sm rounded-none focus-visible:ring-primary placeholder:text-muted-foreground/60"
            />
            {searchInput && (
              <button
                onClick={clearSearch}
                data-testid="attractions-search-clear"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            onClick={handleSearch}
            data-testid="attractions-search-submit"
            className="h-12 px-6 font-sans text-xs uppercase tracking-widest rounded-none"
          >
            Search
          </Button>
        </div>
        <p className="mt-3 font-sans text-xs text-muted-foreground">
          Close spellings are fine.
        </p>

        {/* Active search badge */}
        {qParam && (
          <div className="mt-3 flex items-center gap-2">
            <p className="font-sans text-sm text-muted-foreground">
              Searching for:
            </p>
            <Badge
              variant="outline"
              className="border-primary text-primary font-sans text-xs gap-1"
            >
              {qParam}
              <button
                onClick={clearSearch}
                data-testid="active-search-clear"
              >
                <X className="h-3 w-3 ml-1" />
              </button>
            </Badge>
          </div>
        )}
      </div>

      {/* Main content: sidebar + listing */}
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row gap-10 items-start">

          {/* Sidebar */}
          <AttractionFilterSidebar activeCount={activeFilterCount} />

          {/* Attraction list */}
          <main className="flex-1 min-w-0">
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-40 w-full rounded bg-card" />
                ))}
              </div>
            ) : !attractions || attractions.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-px bg-primary mx-auto mb-8" />
                <h3 className="font-serif text-3xl font-light text-foreground mb-4">
                  Nothing Found
                </h3>
                <p className="font-sans text-sm text-muted-foreground mb-6">
                  {qParam
                    ? "No attractions match your search. Try a different word."
                    : "No attractions match these filters yet."}
                </p>
                <Button
                  variant="outline"
                  data-testid="attractions-empty-clear"
                  onClick={clearAll}
                  className="font-sans text-xs uppercase tracking-widest"
                >
                  Clear All
                </Button>
                <div className="w-16 h-px bg-primary mx-auto mt-8" />
              </div>
            ) : (
              <div className="space-y-4">
                <p className="font-sans text-xs text-muted-foreground uppercase tracking-widest mb-6">
                  {attractions.length}{" "}
                  {attractions.length === 1 ? "Attraction" : "Attractions"}
                  {activeFilterCount > 0 && (
                    <span className="ml-2 text-primary">
                      · {activeFilterCount}{" "}
                      {activeFilterCount === 1 ? "filter" : "filters"} active
                    </span>
                  )}
                </p>
                {attractions.map(a => (
                  <AttractionRow key={a.id} attraction={a} />
                ))}
              </div>
            )}
          </main>

        </div>
      </div>

      <Footer />
    </div>
  );
}
