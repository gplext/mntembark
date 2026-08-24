import { useSearchParams } from "wouter";
import {
  useListCategories,
  useListDestinations,
  useGetDestinationPlaces,
  getGetDestinationPlacesQueryKey,
  useListActivityFilters,
} from "@workspace/api-client-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/mnt-embark/components/ui/select";
import { Checkbox } from "@workspace/mnt-embark/components/ui/checkbox";
import { Separator } from "@workspace/mnt-embark/components/ui/separator";
import { Label } from "@workspace/mnt-embark/components/ui/label";
import { cn } from "@workspace/mnt-embark/lib/utils";

// ─── small helpers ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground mb-3">
      {children}
    </p>
  );
}

function SubLabel({
  children,
  dim,
}: {
  children: React.ReactNode;
  dim?: boolean;
}) {
  return (
    <Label
      className={cn(
        "font-sans text-[10px] uppercase tracking-wider mb-1.5 block transition-colors",
        dim ? "text-muted-foreground/30" : "text-muted-foreground/70",
      )}
    >
      {children}
    </Label>
  );
}

// ─── TourFilterSidebar ────────────────────────────────────────────────────────

interface Props {
  /** Number of active filter selections — shown next to "Clear all". */
  activeCount: number;
}

export function TourFilterSidebar({ activeCount }: Props) {
  const [urlParams, setUrlParams] = useSearchParams();

  // ── current selections ──────────────────────────────────────────────────────
  const categorySlug    = urlParams.get("categorySlug") ?? "";
  const destinationSlug = urlParams.get("destinationSlug") ?? "";
  const countrySlug     = urlParams.get("countrySlug") ?? "";
  const locationSlug    = urlParams.get("locationSlug") ?? "";
  const classifications = urlParams.getAll("classification");
  const activitySlugs  = urlParams.getAll("activitySlugs");

  // ── data ────────────────────────────────────────────────────────────────────
  const { data: categories }     = useListCategories();
  const { data: destinations }   = useListDestinations();
  const { data: places }         = useGetDestinationPlaces(destinationSlug, {
    query: {
      enabled:  Boolean(destinationSlug),
      queryKey: getGetDestinationPlacesQueryKey(destinationSlug),
    },
  });
  const { data: activityGroups } = useListActivityFilters();

  // ── setters ─────────────────────────────────────────────────────────────────

  /** Set or delete a single-value URL param. */
  function setSingle(key: string, value: string) {
    setUrlParams(prev => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  }

  /** Set the destination slug and clear the dependent country + location. */
  function setDestination(slug: string) {
    setUrlParams(prev => {
      const next = new URLSearchParams(prev);
      if (slug) next.set("destinationSlug", slug);
      else next.delete("destinationSlug");
      next.delete("countrySlug");
      next.delete("locationSlug");
      return next;
    });
  }

  /** Set the country slug and clear the dependent location. */
  function setCountry(slug: string) {
    setUrlParams(prev => {
      const next = new URLSearchParams(prev);
      if (slug) next.set("countrySlug", slug);
      else next.delete("countrySlug");
      next.delete("locationSlug");
      return next;
    });
  }

  /** Toggle one value in a repeated URL param (multi-select). */
  function toggleRepeated(key: string, value: string) {
    setUrlParams(prev => {
      const next    = new URLSearchParams(prev);
      const current = prev.getAll(key);
      next.delete(key);
      if (current.includes(value)) {
        current.filter(v => v !== value).forEach(v => next.append(key, v));
      } else {
        [...current, value].forEach(v => next.append(key, v));
      }
      return next;
    });
  }

  /** Remove all sidebar filter params, keeping the text-search param (`q`). */
  function clearFilters() {
    setUrlParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete("categorySlug");
      next.delete("destinationSlug");
      next.delete("countrySlug");
      next.delete("locationSlug");
      next.delete("classification");
      next.delete("activitySlugs");
      return next;
    });
  }

  // Locations shown in the Location select — narrow by country when one is chosen
  const visibleLocations =
    countrySlug
      ? (places?.locations.filter(loc => loc.countrySlug === countrySlug) ?? [])
      : (places?.locations ?? []);

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <aside
      className="w-72 shrink-0 self-start sticky top-24"
      data-testid="filter-sidebar"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <span className="font-sans text-xs font-semibold uppercase tracking-widest text-foreground">
          Filters
        </span>
        {activeCount > 0 && (
          <button
            onClick={clearFilters}
            className="font-sans text-[10px] uppercase tracking-widest text-primary hover:text-primary/60 transition-colors"
            data-testid="sidebar-clear-all"
          >
            Clear all · {activeCount}
          </button>
        )}
      </div>

      {/* ── Block 1: Category ──────────────────────────────────────────────── */}
      <section aria-label="Category" data-testid="filter-section-category">
        <SectionLabel>Category</SectionLabel>
        <Select
          value={categorySlug || "__none__"}
          onValueChange={v => setSingle("categorySlug", v === "__none__" ? "" : v)}
        >
          <SelectTrigger
            className="bg-background border-border/60 font-sans text-sm rounded-none h-9"
            data-testid="filter-category"
          >
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="__none__">All Categories</SelectItem>
            {categories
              ?.filter(c => c.slug)
              .map(cat => (
                <SelectItem key={cat.id} value={cat.slug!}>
                  {cat.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </section>

      <Separator className="my-5 bg-border/30" />

      {/* ── Block 2: Places ────────────────────────────────────────────────── */}
      <section aria-label="Places" data-testid="filter-section-places">
        <SectionLabel>Places</SectionLabel>
        <div className="space-y-3">

          {/* Destination */}
          <div>
            <SubLabel>Destination</SubLabel>
            <Select
              value={destinationSlug || "__none__"}
              onValueChange={v => setDestination(v === "__none__" ? "" : v)}
            >
              <SelectTrigger
                className="bg-background border-border/60 font-sans text-sm rounded-none h-9"
                data-testid="filter-destination"
              >
                <SelectValue placeholder="All Destinations" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="__none__">All Destinations</SelectItem>
                {destinations
                  ?.filter(d => d.slug)
                  .map(dest => (
                    <SelectItem key={dest.id} value={dest.slug!}>
                      {dest.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Country — disabled until a Destination is chosen */}
          <div>
            <SubLabel dim={!destinationSlug}>Country</SubLabel>
            <Select
              value={countrySlug || "__none__"}
              onValueChange={v => setCountry(v === "__none__" ? "" : v)}
              disabled={!destinationSlug}
            >
              <SelectTrigger
                className="bg-background border-border/60 font-sans text-sm rounded-none h-9 disabled:opacity-35 disabled:cursor-not-allowed"
                data-testid="filter-country"
              >
                <SelectValue placeholder="All Countries" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="__none__">All Countries</SelectItem>
                {places?.countries.map(c => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location — disabled until a Destination is chosen */}
          <div>
            <SubLabel dim={!destinationSlug}>Location</SubLabel>
            <Select
              value={locationSlug || "__none__"}
              onValueChange={v => setSingle("locationSlug", v === "__none__" ? "" : v)}
              disabled={!destinationSlug}
            >
              <SelectTrigger
                className="bg-background border-border/60 font-sans text-sm rounded-none h-9 disabled:opacity-35 disabled:cursor-not-allowed"
                data-testid="filter-location"
              >
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="__none__">All Locations</SelectItem>
                {visibleLocations.map(loc => (
                  <SelectItem key={loc.slug} value={loc.slug}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

        </div>
      </section>

      <Separator className="my-5 bg-border/30" />

      {/* ── Block 3: Activities ────────────────────────────────────────────── */}
      <section aria-label="Activities" data-testid="filter-section-activities">
        <SectionLabel>Activities</SectionLabel>
        <div className="space-y-5">
          {activityGroups?.map(group => (
            <div key={group.groupSlug}>
              <p className="font-sans text-[10px] uppercase tracking-wider text-foreground/35 mb-2.5">
                {group.groupName}
              </p>
              <div className="space-y-2.5">
                {group.activities.map(activity => {
                  const checked  = activitySlugs.includes(activity.slug);
                  const disabled = activity.count === 0;
                  return (
                    <div
                      key={activity.slug}
                      className="flex items-center gap-2.5"
                    >
                      <Checkbox
                        id={`act-${activity.slug}`}
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={() =>
                          toggleRepeated("activitySlugs", activity.slug)
                        }
                        className="rounded-none border-border/60 data-[state=checked]:bg-primary data-[state=checked]:border-primary shrink-0"
                        data-testid={`activity-checkbox-${activity.slug}`}
                      />
                      <label
                        htmlFor={`act-${activity.slug}`}
                        className={cn(
                          "font-sans text-xs leading-none select-none flex-1 flex items-center justify-between gap-2",
                          disabled
                            ? "text-muted-foreground/30 cursor-not-allowed"
                            : "text-foreground/75 cursor-pointer",
                        )}
                      >
                        <span>{activity.name}</span>
                        <span
                          className={cn(
                            "text-[10px] tabular-nums shrink-0",
                            disabled
                              ? "text-muted-foreground/20"
                              : "text-muted-foreground/50",
                          )}
                        >
                          {activity.count}
                        </span>
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Separator className="my-5 bg-border/30" />

      {/* ── Block 4: Classification ────────────────────────────────────────── */}
      <section
        aria-label="Classification"
        data-testid="filter-section-classification"
      >
        <SectionLabel>Classification</SectionLabel>
        <div className="space-y-2.5">
          {(["exclusive", "special"] as const).map(value => {
            const checked = classifications.includes(value);
            return (
              <div key={value} className="flex items-center gap-2.5">
                <Checkbox
                  id={`cls-${value}`}
                  checked={checked}
                  onCheckedChange={() => toggleRepeated("classification", value)}
                  className="rounded-none border-border/60 data-[state=checked]:bg-primary data-[state=checked]:border-primary shrink-0"
                  data-testid={`classification-checkbox-${value}`}
                />
                <label
                  htmlFor={`cls-${value}`}
                  className="font-sans text-xs text-foreground/75 leading-none select-none cursor-pointer capitalize"
                >
                  {value}
                </label>
              </div>
            );
          })}
        </div>
      </section>
    </aside>
  );
}
