import { useState } from "react";
import { useSearchParams } from "wouter";
import {
  useListTours,
  useSearchTours,
  getListToursQueryKey,
  getSearchToursQueryKey,
} from "@workspace/api-client-react";
import type { ListToursClassificationItem } from "@workspace/api-client-react";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import { Input } from "@workspace/mnt-embark/components/ui/input";
import { Badge } from "@workspace/mnt-embark/components/ui/badge";
import { Skeleton } from "@workspace/mnt-embark/components/ui/skeleton";
import { Search, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { TourRow } from "@/components/TourCard";
import { TourFilterSidebar } from "@/components/TourFilterSidebar";

// Valid classification values for the type guard
const VALID_CLASSIFICATIONS: ReadonlyArray<ListToursClassificationItem> = [
  "standard",
  "special",
  "exclusive",
];
function isClassification(v: string): v is ListToursClassificationItem {
  return VALID_CLASSIFICATIONS.includes(v as ListToursClassificationItem);
}

export default function ToursPage() {
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

  // ── data hooks ────────────────────────────────────────────────────────────
  const isSearching = Boolean(qParam);

  const listParams = {
    ...(categorySlug    ? { categorySlug }    : {}),
    ...(destinationSlug ? { destinationSlug } : {}),
    ...(countrySlug     ? { countrySlug }     : {}),
    ...(locationSlug    ? { locationSlug }    : {}),
    ...(classifications.length > 0 ? { classification: classifications } : {}),
    ...(activitySlugs.length   > 0 ? { activitySlugs }                  : {}),
  };

  const { data: listTours, isLoading: listLoading } = useListTours(listParams, {
    query: { enabled: !isSearching, queryKey: getListToursQueryKey(listParams) },
  });

  const searchQueryParams = { q: qParam };
  const { data: searchTours, isLoading: searchLoading } = useSearchTours(
    searchQueryParams,
    {
      query: {
        enabled: isSearching,
        queryKey: getSearchToursQueryKey(searchQueryParams),
      },
    },
  );

  const tours     = isSearching ? searchTours : listTours;
  const isLoading = isSearching ? searchLoading : listLoading;

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
          <h1 className="font-serif text-5xl font-light text-foreground mb-2">
            Exclusive Tours
          </h1>
          <p className="font-sans text-sm text-muted-foreground">
            Each journey, a masterpiece composed for the discerning traveler.
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="max-w-7xl mx-auto px-6 py-6 border-b border-border/20">
        <div className="flex gap-4 items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              data-testid="tours-search-input"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="Describe the journey you want — destination, mood, or activity..."
              className="pl-12 pr-12 h-12 bg-card border-border/60 font-sans text-sm rounded-none focus-visible:ring-primary placeholder:text-muted-foreground/60"
            />
            {searchInput && (
              <button
                onClick={clearSearch}
                data-testid="tours-search-clear"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            onClick={handleSearch}
            data-testid="tours-search-submit"
            className="h-12 px-6 font-sans text-xs uppercase tracking-widest rounded-none"
          >
            Search
          </Button>
        </div>
        <p className="mt-3 font-sans text-xs text-muted-foreground">
          AI-assisted search understands journey descriptions and close spellings.
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

      {/* Main content: sidebar + tour listing */}
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row gap-10 items-start">

          {/* Sidebar */}
          <TourFilterSidebar activeCount={activeFilterCount} />

          {/* Tour list */}
          <main className="flex-1 min-w-0">
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-40 w-full rounded bg-card" />
                ))}
              </div>
            ) : !tours || tours.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-px bg-primary mx-auto mb-8" />
                <h3 className="font-serif text-3xl font-light text-foreground mb-4">
                  No Journeys Found
                </h3>
                <p className="font-sans text-sm text-muted-foreground mb-6">
                  {qParam
                    ? "No tours match your search. Try a different query."
                    : "No tours are available with the current filters."}
                </p>
                <Button
                  variant="outline"
                  data-testid="tours-empty-clear"
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
                  {tours.length}{" "}
                  {tours.length === 1 ? "Journey" : "Journeys"} Available
                  {activeFilterCount > 0 && (
                    <span className="ml-2 text-primary">
                      · {activeFilterCount}{" "}
                      {activeFilterCount === 1 ? "filter" : "filters"} active
                    </span>
                  )}
                </p>
                {tours.map(tour => (
                  <TourRow key={tour.id} tour={tour} />
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
