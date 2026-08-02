import { useState, useCallback } from "react";
import { Link } from "wouter";
import {
  useListTours,
  useSearchTours,
  useListCategories,
  useListDestinations,
  getListToursQueryKey,
  getSearchToursQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import { Input } from "@workspace/mnt-embark/components/ui/input";
import { Badge } from "@workspace/mnt-embark/components/ui/badge";
import { Skeleton } from "@workspace/mnt-embark/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/mnt-embark/components/ui/select";
import { Separator } from "@workspace/mnt-embark/components/ui/separator";
import { cn } from "@workspace/mnt-embark/lib/utils";
import { Search, MapPin, Clock, SlidersHorizontal, X, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import type { Tour } from "@workspace/api-client-react";

function TourRow({ tour }: { tour: Tour }) {
  return (
    <Link
      href={`/tours/${tour.id}`}
      data-testid={`tour-row-${tour.id}`}
      className="group relative flex gap-6 bg-card border border-border/40 rounded overflow-hidden hover:border-primary/40 transition-all duration-300 block"
    >
      {/* Image */}
      <div className="w-48 md:w-64 shrink-0 overflow-hidden">
        <img
          src={tour.coverImage}
          alt={tour.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          style={{ minHeight: "160px" }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 py-6 pr-6 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between mb-2">
            <div>
              {tour.featured && (
                <Badge
                  variant="outline"
                  className="border-primary text-primary text-xs tracking-widest uppercase mb-2"
                >
                  Exclusive
                </Badge>
              )}
              <h3 className="font-serif text-2xl font-light text-foreground leading-tight">
                {tour.title}
              </h3>
            </div>
            <div className="text-right shrink-0 ml-4">
              <p className="font-sans text-xs text-muted-foreground mb-1">From</p>
              <p className="font-serif text-2xl font-light text-primary">
                ${tour.priceFrom.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-2 mb-3">
            <div className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-3 w-3 text-primary" />
              <span className="font-sans text-xs">{tour.location}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3 text-primary" />
              <span className="font-sans text-xs">{tour.durationDays} days</span>
            </div>
          </div>

          <p className="font-sans text-sm text-muted-foreground leading-relaxed line-clamp-2">
            {tour.description}
          </p>
        </div>

        <div className="flex items-center mt-4">
          <span className="font-sans text-xs text-primary uppercase tracking-widest group-hover:gap-2 flex items-center gap-1 transition-all">
            View Itinerary <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </div>

      {/* Gold accent right edge */}
      <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-primary/0 group-hover:bg-primary/60 transition-all duration-300" />
    </Link>
  );
}

export default function ToursPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [destinationId, setDestinationId] = useState<string>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data: categories } = useListCategories();
  const { data: destinations } = useListDestinations();

  const isSearching = activeSearch.length > 0;

  const listParams = {
    ...(categoryId !== "all" ? { categoryId: Number(categoryId) } : {}),
    ...(destinationId !== "all" ? { destinationId: Number(destinationId) } : {}),
  };

  const { data: listTours, isLoading: listLoading } = useListTours(listParams, {
    query: { enabled: !isSearching, queryKey: getListToursQueryKey(listParams) },
  });

  const searchParams = {
    q: activeSearch,
    ...(categoryId !== "all" ? { categoryId: Number(categoryId) } : {}),
    ...(destinationId !== "all" ? { destinationId: Number(destinationId) } : {}),
  };

  const { data: searchTours, isLoading: searchLoading } = useSearchTours(
    searchParams,
    {
      query: { enabled: isSearching, queryKey: getSearchToursQueryKey(searchParams) },
    }
  );

  const tours = isSearching ? searchTours : listTours;
  const isLoading = isSearching ? searchLoading : listLoading;

  const handleSearch = useCallback(() => {
    setActiveSearch(searchQuery.trim());
  }, [searchQuery]);

  const clearSearch = () => {
    setSearchQuery("");
    setActiveSearch("");
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <Navbar />

      {/* Header */}
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

      {/* Search + Filters */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-4 items-center">
          {/* Search bar */}
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              data-testid="tours-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search any destination, experience, or activity..."
              className="pl-12 pr-12 h-12 bg-card border-border/60 font-sans text-sm rounded-none focus-visible:ring-primary placeholder:text-muted-foreground/60"
            />
            {searchQuery && (
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
          <Button
            variant="outline"
            onClick={() => setFiltersOpen(!filtersOpen)}
            data-testid="tours-filter-toggle"
            className={cn(
              "h-12 px-4 font-sans text-xs uppercase tracking-widest rounded-none gap-2",
              filtersOpen && "border-primary text-primary"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </Button>
        </div>

        {/* Collapsible Filter Panel */}
        {filtersOpen && (
          <div
            className="mt-4 p-6 bg-card border border-border/40 rounded grid grid-cols-1 md:grid-cols-2 gap-6"
            data-testid="filter-panel"
          >
            <div>
              <p className="font-sans text-xs uppercase tracking-widest text-muted-foreground mb-3">
                Category
              </p>
              <Select
                value={categoryId}
                onValueChange={setCategoryId}
                data-testid="filter-category"
              >
                <SelectTrigger className="bg-background border-border/60 font-sans text-sm">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="font-sans text-xs uppercase tracking-widest text-muted-foreground mb-3">
                Destination
              </p>
              <Select
                value={destinationId}
                onValueChange={setDestinationId}
                data-testid="filter-destination"
              >
                <SelectTrigger className="bg-background border-border/60 font-sans text-sm">
                  <SelectValue placeholder="All Destinations" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="all">All Destinations</SelectItem>
                  {destinations?.map((dest) => (
                    <SelectItem key={dest.id} value={String(dest.id)}>
                      {dest.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button
                variant="ghost"
                data-testid="filter-clear"
                onClick={() => {
                  setCategoryId("all");
                  setDestinationId("all");
                  clearSearch();
                }}
                className="font-sans text-xs uppercase tracking-widest text-muted-foreground"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        )}

        {/* Active search indicator */}
        {activeSearch && (
          <div className="mt-4 flex items-center gap-2">
            <p className="font-sans text-sm text-muted-foreground">
              Searching for:
            </p>
            <Badge variant="outline" className="border-primary text-primary font-sans text-xs gap-1">
              {activeSearch}
              <button onClick={clearSearch} data-testid="active-search-clear">
                <X className="h-3 w-3 ml-1" />
              </button>
            </Badge>
          </div>
        )}
      </div>

      <Separator className="bg-border/20" />

      {/* Tour Listing */}
      <div className="max-w-7xl mx-auto px-6 py-12">
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
              {activeSearch
                ? "No tours match your search. Try a different query."
                : "No tours are available with the current filters."}
            </p>
            <Button
              variant="outline"
              data-testid="tours-empty-clear"
              onClick={() => {
                clearSearch();
                setCategoryId("all");
                setDestinationId("all");
              }}
              className="font-sans text-xs uppercase tracking-widest"
            >
              Clear All
            </Button>
            <div className="w-16 h-px bg-primary mx-auto mt-8" />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="font-sans text-xs text-muted-foreground uppercase tracking-widest mb-6">
              {tours.length} {tours.length === 1 ? "Journey" : "Journeys"} Available
            </p>
            {tours.map((tour) => (
              <TourRow key={tour.id} tour={tour} />
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
