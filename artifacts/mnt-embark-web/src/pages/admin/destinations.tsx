import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListDestinations,
  useCreateDestination,
  useUpdateDestination,
  useDeleteDestination,
  useListCountries,
  useCreateCountry,
  useUpdateCountry,
  useDeleteCountry,
  useListLocations,
  useCreateLocation,
  useUpdateLocation,
  useDeleteLocation,
  useGetDestinationPlacesById,
  useSetDestinationPlaces,
  getListDestinationsQueryKey,
  getListCountriesQueryKey,
  getListLocationsQueryKey,
  getGetDestinationPlacesByIdQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import { Input } from "@workspace/mnt-embark/components/ui/input";
import { Textarea } from "@workspace/mnt-embark/components/ui/textarea";
import { Skeleton } from "@workspace/mnt-embark/components/ui/skeleton";
import { Badge } from "@workspace/mnt-embark/components/ui/badge";
import { Checkbox } from "@workspace/mnt-embark/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/mnt-embark/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@workspace/mnt-embark/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/mnt-embark/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/mnt-embark/components/ui/alert-dialog";
import { Separator } from "@workspace/mnt-embark/components/ui/separator";
import { useToast } from "@workspace/mnt-embark/hooks/use-toast";
import { cn } from "@workspace/mnt-embark/lib/utils";
import { Plus, Pencil, Trash2, Globe, MapPin, Compass, Search, Filter } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { ImageUploadField } from "@/components/ImageUploadField";
import type {
  Destination,
  CountrySummary,
  CountryInput,
  CountryUpdateInput,
  LocationSummary,
  LocationInput,
  LocationUpdateInput,
} from "@workspace/api-client-react";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function autoSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── Quick Add Country Dialog ──────────────────────────────────────────────────

function QuickAddCountryModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (country: CountrySummary) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createCountryMutation = useCreateCountry();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [slug, setSlug] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setCode("");
      setSlug("");
    }
  }, [open]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slug || slug === autoSlug(name)) {
      setSlug(autoSlug(val));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createCountryMutation.mutate(
      {
        data: {
          name: name.trim(),
          code: code.trim().toUpperCase() || null,
          slug: slug.trim() || autoSlug(name),
        },
      },
      {
        onSuccess: (created) => {
          queryClient.invalidateQueries({ queryKey: getListCountriesQueryKey() });
          toast({ title: "Country Added", description: `${created.name} is ready.` });
          onCreated(created);
          onOpenChange(false);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to create country.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl font-light text-foreground flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" /> Add New Country
          </DialogTitle>
          <DialogDescription className="font-sans text-xs text-muted-foreground">
            Quickly create a sovereign country to associate with destinations and tours.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">
              Country Name *
            </label>
            <Input
              required
              placeholder="e.g. Greece, Norway, Japan"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="bg-background border-border/60 font-sans text-sm"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">
                ISO Code (2-Letter)
              </label>
              <Input
                placeholder="e.g. GR, NO, JP"
                maxLength={2}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="bg-background border-border/60 font-sans text-sm uppercase"
              />
            </div>
            <div>
              <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">
                Slug
              </label>
              <Input
                placeholder="e.g. greece"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="bg-background border-border/60 font-sans text-sm"
              />
            </div>
          </div>
          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="font-sans text-xs uppercase tracking-widest"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createCountryMutation.isPending || !name.trim()}
              className="font-sans text-xs uppercase tracking-widest"
            >
              {createCountryMutation.isPending ? "Adding…" : "Add Country"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Quick Add Location Dialog ─────────────────────────────────────────────────

function QuickAddLocationModal({
  open,
  onOpenChange,
  countries,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  countries: CountrySummary[];
  onCreated: (location: LocationSummary) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createLocationMutation = useCreateLocation();

  const [name, setName] = useState("");
  const [countryId, setCountryId] = useState<string>("none");
  const [slug, setSlug] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setCountryId("none");
      setSlug("");
    }
  }, [open]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slug || slug === autoSlug(name)) {
      setSlug(autoSlug(val));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createLocationMutation.mutate(
      {
        data: {
          name: name.trim(),
          countryId: countryId === "none" ? null : Number(countryId),
          slug: slug.trim() || autoSlug(name),
        },
      },
      {
        onSuccess: (created) => {
          queryClient.invalidateQueries({ queryKey: getListLocationsQueryKey() });
          toast({ title: "Location Added", description: `${created.name} is ready.` });
          onCreated(created);
          onOpenChange(false);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to create location.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl font-light text-foreground flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" /> Add New Location
          </DialogTitle>
          <DialogDescription className="font-sans text-xs text-muted-foreground">
            Create a city, base, or specific landmark.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">
              Location / City Name *
            </label>
            <Input
              required
              placeholder="e.g. Santorini, Bergen, Kyoto"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="bg-background border-border/60 font-sans text-sm"
              autoFocus
            />
          </div>
          <div>
            <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">
              Belongs to Country
            </label>
            <Select value={countryId} onValueChange={setCountryId}>
              <SelectTrigger className="bg-background border-border/60 font-sans text-sm">
                <SelectValue placeholder="Select country (optional)" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border max-h-56">
                <SelectItem value="none" className="font-sans text-xs text-muted-foreground">
                  (No country assigned)
                </SelectItem>
                {countries.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)} className="font-sans text-xs">
                    {c.name} {c.code ? `(${c.code})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">
              Slug
            </label>
            <Input
              placeholder="e.g. santorini"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="bg-background border-border/60 font-sans text-sm"
            />
          </div>
          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="font-sans text-xs uppercase tracking-widest"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createLocationMutation.isPending || !name.trim()}
              className="font-sans text-xs uppercase tracking-widest"
            >
              {createLocationMutation.isPending ? "Adding…" : "Add Location"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── CountryMultiSelect ────────────────────────────────────────────────────────

function CountryMultiSelect({
  countries,
  selectedIds,
  onChange,
  onOpenQuickAdd,
  "data-testid": testId,
}: {
  countries: CountrySummary[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  onOpenQuickAdd: () => void;
  "data-testid"?: string;
}) {
  const toggle = (id: number) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="flex items-center justify-between">
        <span className="font-sans text-xs text-muted-foreground">
          {selectedIds.length} selected
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onOpenQuickAdd}
          className="h-6 px-2 font-sans text-xs text-primary hover:text-primary/80 gap-1"
        >
          <Plus className="h-3 w-3" /> New Country
        </Button>
      </div>
      <div className="border border-border/40 rounded overflow-y-auto max-h-44 p-2 space-y-1">
        {countries.length === 0 ? (
          <p className="font-sans text-xs text-muted-foreground text-center py-4">No countries available</p>
        ) : (
          countries.map((c) => {
            const checked = selectedIds.includes(c.id);
            return (
              <div key={c.id} className="flex items-center gap-2 py-0.5">
                <Checkbox
                  id={`country-${c.id}`}
                  checked={checked}
                  onCheckedChange={() => toggle(c.id)}
                  data-testid={`country-checkbox-${c.id}`}
                />
                <label
                  htmlFor={`country-${c.id}`}
                  className="font-sans text-xs text-foreground cursor-pointer select-none flex items-center gap-1.5"
                >
                  {c.code && (
                    <span className="text-[10px] px-1 py-0.2 bg-muted/60 text-muted-foreground rounded font-mono">
                      {c.code}
                    </span>
                  )}
                  {c.name}
                </label>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── LocationMultiSelect ───────────────────────────────────────────────────────

function LocationMultiSelect({
  locations,
  selectedIds,
  onChange,
  onOpenQuickAdd,
  "data-testid": testId,
}: {
  locations: LocationSummary[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  onOpenQuickAdd: () => void;
  "data-testid"?: string;
}) {
  const [search, setSearch] = useState("");

  const toggle = (id: number) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = locations.filter(
      (l) =>
        !q ||
        l.name.toLowerCase().includes(q) ||
        (l.countryName ?? "").toLowerCase().includes(q),
    );
    const map = new Map<string, LocationSummary[]>();
    for (const l of filtered) {
      const key = l.countryName ?? "Other";
      const arr = map.get(key) ?? [];
      arr.push(l);
      map.set(key, arr);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [locations, search]);

  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="flex items-center justify-between">
        <span className="font-sans text-xs text-muted-foreground">
          {selectedIds.length} selected
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onOpenQuickAdd}
          className="h-6 px-2 font-sans text-xs text-primary hover:text-primary/80 gap-1"
        >
          <Plus className="h-3 w-3" /> New Location
        </Button>
      </div>
      <Input
        placeholder="Search locations…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="bg-background border-border/60 font-sans text-xs h-8"
        data-testid="location-search"
      />
      <div className="border border-border/40 rounded overflow-y-auto max-h-56 p-2 space-y-3">
        {grouped.length === 0 ? (
          <p className="font-sans text-xs text-muted-foreground text-center py-4">
            No locations found
          </p>
        ) : (
          grouped.map(([country, locs]) => (
            <div key={country}>
              <p className="font-sans text-xs uppercase tracking-widest text-muted-foreground mb-1 pb-1 border-b border-border/20">
                {country}
              </p>
              <div className="space-y-1 mt-1">
                {locs.map((l) => {
                  const checked = selectedIds.includes(l.id);
                  return (
                    <div key={l.id} className="flex items-center gap-2 py-0.5">
                      <Checkbox
                        id={`location-${l.id}`}
                        checked={checked}
                        onCheckedChange={() => toggle(l.id)}
                        data-testid={`location-checkbox-${l.id}`}
                      />
                      <label
                        htmlFor={`location-${l.id}`}
                        className="font-sans text-xs text-foreground cursor-pointer select-none"
                      >
                        {l.name}{l.countryName ? ` — ${l.countryName}` : ""}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── DestinationForm ───────────────────────────────────────────────────────────

function DestinationForm({
  destination,
  onClose,
}: {
  destination?: Destination;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createDestination = useCreateDestination();
  const updateDestination = useUpdateDestination();
  const setPlacesMutation = useSetDestinationPlaces();

  const { data: countries } = useListCountries();
  const { data: locations } = useListLocations();

  const [quickCountryOpen, setQuickCountryOpen] = useState(false);
  const [quickLocationOpen, setQuickLocationOpen] = useState(false);

  const placesId = destination?.id ?? 0;
  const {
    data: placesData,
    isSuccess: placesLoaded,
    isError: placesError,
  } = useGetDestinationPlacesById(placesId, {
    query: {
      queryKey: getGetDestinationPlacesByIdQueryKey(placesId),
      enabled: !!destination?.id,
    },
  });

  const [form, setForm] = useState({
    name: destination?.name ?? "",
    slug: destination?.slug ?? "",
    description: destination?.description ?? "",
    coverImage: destination?.coverImage ?? "",
    displayOrder: destination?.displayOrder ?? 0,
  });
  const [slugError, setSlugError] = useState<string | null>(null);

  const [selectedCountryIds, setSelectedCountryIds] = useState<number[]>([]);
  const [selectedLocationIds, setSelectedLocationIds] = useState<number[]>([]);

  useEffect(() => {
    if (!destination?.id) return;
    if (!placesLoaded || !placesData) return;
    setSelectedCountryIds(placesData.countryIds);
    setSelectedLocationIds(placesData.locationIds);
  }, [placesData, placesLoaded, destination?.id]);

  const placesReady = !destination?.id || placesLoaded || placesError;

  const handleNameChange = (val: string) => {
    setForm((prev) => ({
      ...prev,
      name: val,
      slug: !prev.slug || prev.slug === autoSlug(prev.name) ? autoSlug(val) : prev.slug,
    }));
  };

  const doSavePlaces = (id: number, label: string) => {
    setPlacesMutation.mutate(
      { id, data: { countryIds: selectedCountryIds, locationIds: selectedLocationIds } },
      {
        onSuccess: () => {
          if (destination?.id) {
            queryClient.invalidateQueries({
              queryKey: getGetDestinationPlacesByIdQueryKey(id),
            });
          }
          queryClient.invalidateQueries({ queryKey: getListDestinationsQueryKey() });
          toast({ title: label });
          onClose();
        },
        onError: () => {
          queryClient.invalidateQueries({ queryKey: getListDestinationsQueryKey() });
          toast({
            title: "Saved with errors",
            description: `Destination ${label.toLowerCase()} but places could not be saved.`,
            variant: "destructive",
          });
          onClose();
        },
      },
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!SLUG_PATTERN.test(form.slug)) {
      setSlugError("Lowercase letters, numbers, and hyphens only (e.g. patagonia or south-east-asia)");
      return;
    }
    setSlugError(null);

    if (destination) {
      updateDestination.mutate(
        {
          id: destination.id,
          data: {
            name: form.name,
            slug: form.slug,
            description: form.description,
            coverImage: form.coverImage,
            displayOrder: form.displayOrder,
          },
        },
        {
          onSuccess: () => doSavePlaces(destination.id, "Destination Updated"),
          onError: (error) => {
            if (
              typeof error === "object" &&
              error !== null &&
              "status" in error &&
              (error as { status: number }).status === 409
            ) {
              setSlugError("This slug is already taken");
              return;
            }
            toast({
              title: "Error",
              description: "Failed to update destination.",
              variant: "destructive",
            });
          },
        },
      );
    } else {
      createDestination.mutate(
        {
          data: {
            name: form.name,
            slug: form.slug,
            description: form.description,
            coverImage: form.coverImage,
            displayOrder: form.displayOrder,
          },
        },
        {
          onSuccess: (created) => doSavePlaces(created.id, "Destination Created"),
          onError: (error) => {
            if (
              typeof error === "object" &&
              error !== null &&
              "status" in error &&
              (error as { status: number }).status === 409
            ) {
              setSlugError("This slug is already taken");
              return;
            }
            toast({
              title: "Error",
              description: "Failed to create destination.",
              variant: "destructive",
            });
          },
        },
      );
    }
  };

  const isPending =
    createDestination.isPending ||
    updateDestination.isPending ||
    setPlacesMutation.isPending;

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="destination-form">
        <div>
          <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">Name *</label>
          <Input
            required
            value={form.name}
            onChange={(e) => handleNameChange(e.target.value)}
            data-testid="dest-form-name"
            className="bg-background border-border/60 font-sans text-sm"
          />
        </div>

        <div>
          <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">Slug *</label>
          <Input
            required
            value={form.slug}
            onChange={(e) => {
              setForm({ ...form, slug: e.target.value });
              setSlugError(null);
            }}
            data-testid="destination-form-slug"
            className={`bg-background font-sans text-sm ${slugError ? "border-destructive" : "border-border/60"}`}
            placeholder="e.g. patagonia"
          />
          {slugError && (
            <p className="font-sans text-xs text-destructive mt-1">{slugError}</p>
          )}
        </div>

        <div>
          <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">Description</label>
          <Textarea
            required
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            data-testid="dest-form-description"
            rows={3}
            className="bg-background border-border/60 font-sans text-sm resize-none"
          />
        </div>

        <ImageUploadField
          label="Cover Image"
          value={form.coverImage}
          onChange={(url) => setForm({ ...form, coverImage: url })}
          required
          data-testid="dest-form-cover"
        />

        <Separator className="bg-border/20" />

        {/* Countries */}
        <div>
          <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-2">Countries</label>
          {!placesReady ? (
            <div className="space-y-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full rounded bg-card" />
              ))}
            </div>
          ) : (
            <CountryMultiSelect
              countries={countries ?? []}
              selectedIds={selectedCountryIds}
              onChange={setSelectedCountryIds}
              onOpenQuickAdd={() => setQuickCountryOpen(true)}
              data-testid="destination-form-country-ids"
            />
          )}
        </div>

        {/* Locations */}
        <div>
          <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-2">Locations</label>
          {!placesReady ? (
            <div className="space-y-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full rounded bg-card" />
              ))}
            </div>
          ) : (
            <LocationMultiSelect
              locations={locations ?? []}
              selectedIds={selectedLocationIds}
              onChange={setSelectedLocationIds}
              onOpenQuickAdd={() => setQuickLocationOpen(true)}
              data-testid="destination-form-location-ids"
            />
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="submit"
            disabled={isPending || !placesReady}
            data-testid="dest-form-submit"
            className="flex-1 font-sans text-xs uppercase tracking-widest"
          >
            {isPending ? "Saving…" : destination ? "Update Destination" : "Create Destination"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            data-testid="dest-form-cancel"
            className="font-sans text-xs uppercase tracking-widest"
          >
            Cancel
          </Button>
        </div>
      </form>

      {/* Quick Add Modals */}
      <QuickAddCountryModal
        open={quickCountryOpen}
        onOpenChange={setQuickCountryOpen}
        onCreated={(newCountry) => {
          setSelectedCountryIds((prev) => [...prev, newCountry.id]);
        }}
      />
      <QuickAddLocationModal
        open={quickLocationOpen}
        onOpenChange={setQuickLocationOpen}
        countries={countries ?? []}
        onCreated={(newLoc) => {
          setSelectedLocationIds((prev) => [...prev, newLoc.id]);
        }}
      />
    </>
  );
}

// ── CountryFormSheet ──────────────────────────────────────────────────────────

function CountryForm({
  country,
  onClose,
}: {
  country?: CountrySummary;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createCountry = useCreateCountry();
  const updateCountry = useUpdateCountry();

  const [form, setForm] = useState({
    name: country?.name ?? "",
    code: country?.code ?? "",
    slug: country?.slug ?? "",
    image: country?.image ?? "",
    description: country?.description ?? "",
    displayOrder: country?.displayOrder ?? 0,
  });
  const [slugError, setSlugError] = useState<string | null>(null);

  const handleNameChange = (val: string) => {
    setForm((prev) => ({
      ...prev,
      name: val,
      slug: !prev.slug || prev.slug === autoSlug(prev.name) ? autoSlug(val) : prev.slug,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    if (form.slug && !SLUG_PATTERN.test(form.slug)) {
      setSlugError("Lowercase letters, numbers, and hyphens only");
      return;
    }
    setSlugError(null);

    const payload: CountryInput = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase() || null,
      slug: form.slug.trim() || autoSlug(form.name),
      image: form.image || null,
      description: form.description || null,
      displayOrder: Number(form.displayOrder) || 0,
    };

    if (country) {
      updateCountry.mutate(
        { id: country.id, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListCountriesQueryKey() });
            toast({ title: "Country Updated" });
            onClose();
          },
          onError: () => toast({ title: "Error", description: "Failed to update country.", variant: "destructive" }),
        }
      );
    } else {
      createCountry.mutate(
        { data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListCountriesQueryKey() });
            toast({ title: "Country Created" });
            onClose();
          },
          onError: () => toast({ title: "Error", description: "Failed to create country.", variant: "destructive" }),
        }
      );
    }
  };

  const isPending = createCountry.isPending || updateCountry.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">
          Country Name *
        </label>
        <Input
          required
          value={form.name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="e.g. Chile, Japan, Morocco"
          className="bg-background border-border/60 font-sans text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">
            ISO Alpha-2 Code
          </label>
          <Input
            maxLength={2}
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="e.g. CL, JP, MA"
            className="bg-background border-border/60 font-sans text-sm uppercase"
          />
        </div>
        <div>
          <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">
            Display Order
          </label>
          <Input
            type="number"
            value={form.displayOrder}
            onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value) || 0 })}
            className="bg-background border-border/60 font-sans text-sm"
          />
        </div>
      </div>

      <div>
        <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">
          Slug *
        </label>
        <Input
          required
          value={form.slug}
          onChange={(e) => {
            setForm({ ...form, slug: e.target.value });
            setSlugError(null);
          }}
          placeholder="e.g. chile"
          className={`bg-background font-sans text-sm ${slugError ? "border-destructive" : "border-border/60"}`}
        />
        {slugError && <p className="font-sans text-xs text-destructive mt-1">{slugError}</p>}
      </div>

      <ImageUploadField
        label="Cover Image"
        value={form.image}
        onChange={(url) => setForm({ ...form, image: url })}
      />

      <div>
        <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">
          Description
        </label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
          placeholder="Overview of the country, geography, visa, or culture…"
          className="bg-background border-border/60 font-sans text-sm resize-none"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          disabled={isPending}
          className="flex-1 font-sans text-xs uppercase tracking-widest"
        >
          {isPending ? "Saving…" : country ? "Update Country" : "Create Country"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="font-sans text-xs uppercase tracking-widest"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ── LocationFormSheet ─────────────────────────────────────────────────────────

function LocationForm({
  location,
  countries,
  onClose,
}: {
  location?: LocationSummary;
  countries: CountrySummary[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createLocation = useCreateLocation();
  const updateLocation = useUpdateLocation();

  const [form, setForm] = useState({
    name: location?.name ?? "",
    countryId: location?.countryId ? String(location.countryId) : "none",
    slug: location?.slug ?? "",
    image: location?.image ?? "",
    description: location?.description ?? "",
    displayOrder: location?.displayOrder ?? 0,
  });
  const [slugError, setSlugError] = useState<string | null>(null);

  const handleNameChange = (val: string) => {
    setForm((prev) => ({
      ...prev,
      name: val,
      slug: !prev.slug || prev.slug === autoSlug(prev.name) ? autoSlug(val) : prev.slug,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    if (form.slug && !SLUG_PATTERN.test(form.slug)) {
      setSlugError("Lowercase letters, numbers, and hyphens only");
      return;
    }
    setSlugError(null);

    const payload: LocationInput = {
      name: form.name.trim(),
      countryId: form.countryId === "none" ? null : Number(form.countryId),
      slug: form.slug.trim() || autoSlug(form.name),
      image: form.image || null,
      description: form.description || null,
      displayOrder: Number(form.displayOrder) || 0,
    };

    if (location) {
      updateLocation.mutate(
        { id: location.id, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListLocationsQueryKey() });
            toast({ title: "Location Updated" });
            onClose();
          },
          onError: () => toast({ title: "Error", description: "Failed to update location.", variant: "destructive" }),
        }
      );
    } else {
      createLocation.mutate(
        { data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListLocationsQueryKey() });
            toast({ title: "Location Created" });
            onClose();
          },
          onError: () => toast({ title: "Error", description: "Failed to create location.", variant: "destructive" }),
        }
      );
    }
  };

  const isPending = createLocation.isPending || updateLocation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">
          Location Name *
        </label>
        <Input
          required
          value={form.name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="e.g. Kyoto, Torres del Paine, Serengeti"
          className="bg-background border-border/60 font-sans text-sm"
        />
      </div>

      <div>
        <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">
          Country
        </label>
        <Select
          value={form.countryId}
          onValueChange={(val) => setForm({ ...form, countryId: val })}
        >
          <SelectTrigger className="bg-background border-border/60 font-sans text-sm">
            <SelectValue placeholder="Select country" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border max-h-56">
            <SelectItem value="none" className="font-sans text-xs text-muted-foreground">
              (No country assigned)
            </SelectItem>
            {countries.map((c) => (
              <SelectItem key={c.id} value={String(c.id)} className="font-sans text-xs">
                {c.name} {c.code ? `(${c.code})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">
            Slug *
          </label>
          <Input
            required
            value={form.slug}
            onChange={(e) => {
              setForm({ ...form, slug: e.target.value });
              setSlugError(null);
            }}
            placeholder="e.g. kyoto"
            className={`bg-background font-sans text-sm ${slugError ? "border-destructive" : "border-border/60"}`}
          />
        </div>
        <div>
          <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">
            Display Order
          </label>
          <Input
            type="number"
            value={form.displayOrder}
            onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value) || 0 })}
            className="bg-background border-border/60 font-sans text-sm"
          />
        </div>
      </div>
      {slugError && <p className="font-sans text-xs text-destructive mt-1">{slugError}</p>}

      <ImageUploadField
        label="Cover Image"
        value={form.image}
        onChange={(url) => setForm({ ...form, image: url })}
      />

      <div>
        <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">
          Description
        </label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
          placeholder="Brief description of the place, highlights…"
          className="bg-background border-border/60 font-sans text-sm resize-none"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          disabled={isPending}
          className="flex-1 font-sans text-xs uppercase tracking-widest"
        >
          {isPending ? "Saving…" : location ? "Update Location" : "Create Location"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="font-sans text-xs uppercase tracking-widest"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ── AdminDestinationsPage Main Hub ────────────────────────────────────────────

export default function AdminDestinationsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"destinations" | "countries" | "locations">("destinations");

  // Destinations data & mutations
  const { data: destinations, isLoading: destsLoading } = useListDestinations();
  const deleteDestination = useDeleteDestination();

  // Countries data & mutations
  const { data: countries, isLoading: countriesLoading } = useListCountries();
  const deleteCountry = useDeleteCountry();

  // Locations data & mutations
  const { data: locations, isLoading: locationsLoading } = useListLocations();
  const deleteLocation = useDeleteLocation();

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [locationCountryFilter, setLocationCountryFilter] = useState<string>("all");

  // Sheet states
  const [destSheetOpen, setDestSheetOpen] = useState(false);
  const [editDest, setEditDest] = useState<Destination | undefined>();

  const [countrySheetOpen, setCountrySheetOpen] = useState(false);
  const [editCountry, setEditCountry] = useState<CountrySummary | undefined>();

  const [locSheetOpen, setLocSheetOpen] = useState(false);
  const [editLocation, setEditLocation] = useState<LocationSummary | undefined>();

  // Deletion targets
  const [deleteTargetDest, setDeleteTargetDest] = useState<Destination | undefined>();
  const [deleteTargetCountry, setDeleteTargetCountry] = useState<CountrySummary | undefined>();
  const [deleteTargetLoc, setDeleteTargetLoc] = useState<LocationSummary | undefined>();

  // Handlers
  const handleDeleteDest = () => {
    if (!deleteTargetDest) return;
    deleteDestination.mutate(
      { id: deleteTargetDest.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListDestinationsQueryKey() });
          toast({ title: "Destination Deleted" });
          setDeleteTargetDest(undefined);
        },
        onError: () => toast({ title: "Error", description: "Failed to delete destination.", variant: "destructive" }),
      }
    );
  };

  const handleDeleteCountry = () => {
    if (!deleteTargetCountry) return;
    deleteCountry.mutate(
      { id: deleteTargetCountry.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCountriesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListLocationsQueryKey() });
          toast({ title: "Country Deleted" });
          setDeleteTargetCountry(undefined);
        },
        onError: () => toast({ title: "Error", description: "Failed to delete country.", variant: "destructive" }),
      }
    );
  };

  const handleDeleteLoc = () => {
    if (!deleteTargetLoc) return;
    deleteLocation.mutate(
      { id: deleteTargetLoc.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLocationsQueryKey() });
          toast({ title: "Location Deleted" });
          setDeleteTargetLoc(undefined);
        },
        onError: () => toast({ title: "Error", description: "Failed to delete location.", variant: "destructive" }),
      }
    );
  };

  // Filtered lists
  const filteredDestinations = useMemo(() => {
    if (!destinations) return [];
    const q = searchTerm.toLowerCase().trim();
    if (!q) return destinations;
    return destinations.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.slug ?? "").toLowerCase().includes(q) ||
        (d.countries ?? []).some((c) => c.name.toLowerCase().includes(q))
    );
  }, [destinations, searchTerm]);

  const filteredCountries = useMemo(() => {
    if (!countries) return [];
    const q = searchTerm.toLowerCase().trim();
    if (!q) return countries;
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.code ?? "").toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q)
    );
  }, [countries, searchTerm]);

  const filteredLocations = useMemo(() => {
    if (!locations) return [];
    const q = searchTerm.toLowerCase().trim();
    return locations.filter((l) => {
      const matchSearch =
        !q ||
        l.name.toLowerCase().includes(q) ||
        l.slug.toLowerCase().includes(q) ||
        (l.countryName ?? "").toLowerCase().includes(q);

      const matchCountry =
        locationCountryFilter === "all" ||
        (locationCountryFilter === "unassigned" && !l.countryId) ||
        String(l.countryId) === locationCountryFilter;

      return matchSearch && matchCountry;
    });
  }, [locations, searchTerm, locationCountryFilter]);

  return (
    <AdminLayout>
      <div className="p-8" data-testid="admin-destinations">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <p className="font-sans text-xs uppercase tracking-widest text-primary mb-1">Admin Panel</p>
            <h1 className="font-serif text-3xl font-light text-foreground">Destinations & Places</h1>
            <p className="font-sans text-xs text-muted-foreground mt-1">
              Curate commercial destinations, sovereign countries, and specific itinerary locations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === "destinations" && (
              <Button
                onClick={() => {
                  setEditDest(undefined);
                  setDestSheetOpen(true);
                }}
                data-testid="create-destination-btn"
                className="font-sans text-xs uppercase tracking-widest gap-2"
              >
                <Plus className="h-4 w-4" /> New Destination
              </Button>
            )}
            {activeTab === "countries" && (
              <Button
                onClick={() => {
                  setEditCountry(undefined);
                  setCountrySheetOpen(true);
                }}
                data-testid="create-country-btn"
                className="font-sans text-xs uppercase tracking-widest gap-2"
              >
                <Plus className="h-4 w-4" /> New Country
              </Button>
            )}
            {activeTab === "locations" && (
              <Button
                onClick={() => {
                  setEditLocation(undefined);
                  setLocSheetOpen(true);
                }}
                data-testid="create-location-btn"
                className="font-sans text-xs uppercase tracking-widest gap-2"
              >
                <Plus className="h-4 w-4" /> New Location
              </Button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-border/40 mb-6">
          <button
            onClick={() => {
              setActiveTab("destinations");
              setSearchTerm("");
            }}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 font-sans text-xs uppercase tracking-widest transition-colors border-b-2",
              activeTab === "destinations"
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Compass className="h-3.5 w-3.5" /> Destinations
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground">
              {destinations?.length ?? 0}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab("countries");
              setSearchTerm("");
            }}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 font-sans text-xs uppercase tracking-widest transition-colors border-b-2",
              activeTab === "countries"
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Globe className="h-3.5 w-3.5" /> Countries
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground">
              {countries?.length ?? 0}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab("locations");
              setSearchTerm("");
            }}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 font-sans text-xs uppercase tracking-widest transition-colors border-b-2",
              activeTab === "locations"
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <MapPin className="h-3.5 w-3.5" /> Locations
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground">
              {locations?.length ?? 0}
            </span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={`Search ${activeTab}…`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-background border-border/60 font-sans text-xs h-9"
            />
          </div>

          {activeTab === "locations" && (
            <div className="w-full sm:w-64">
              <Select value={locationCountryFilter} onValueChange={setLocationCountryFilter}>
                <SelectTrigger className="bg-background border-border/60 font-sans text-xs h-9">
                  <SelectValue placeholder="Filter by Country" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border max-h-56">
                  <SelectItem value="all" className="font-sans text-xs">
                    All Countries
                  </SelectItem>
                  <SelectItem value="unassigned" className="font-sans text-xs text-muted-foreground">
                    (No country assigned)
                  </SelectItem>
                  {(countries ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)} className="font-sans text-xs">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* ── TAB 1: Destinations Table ────────────────────────────────────── */}
        {activeTab === "destinations" && (
          <div>
            {destsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded bg-card" />
                ))}
              </div>
            ) : filteredDestinations.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-border/40 rounded">
                <p className="font-serif text-2xl font-light text-foreground mb-2">No Destinations Found</p>
                <p className="font-sans text-sm text-muted-foreground mb-6">
                  {searchTerm ? "No destinations match your search query." : "Add your first curated destination."}
                </p>
                <Button
                  onClick={() => {
                    setEditDest(undefined);
                    setDestSheetOpen(true);
                  }}
                  className="font-sans text-xs uppercase tracking-widest"
                >
                  Add Destination
                </Button>
              </div>
            ) : (
              <div className="border border-border/40 rounded overflow-hidden">
                <table className="w-full" data-testid="destinations-table">
                  <thead className="bg-card border-b border-border/40">
                    <tr>
                      <th className="text-left p-4 font-sans text-xs uppercase tracking-widest text-muted-foreground">
                        Destination
                      </th>
                      <th className="text-left p-4 font-sans text-xs uppercase tracking-widest text-muted-foreground hidden md:table-cell">
                        Linked Countries
                      </th>
                      <th className="text-left p-4 font-sans text-xs uppercase tracking-widest text-muted-foreground hidden lg:table-cell">
                        Slug
                      </th>
                      <th className="p-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDestinations.map((dest) => (
                      <tr
                        key={dest.id}
                        data-testid={`dest-row-${dest.id}`}
                        className="border-b border-border/20 hover:bg-card/40 transition-colors"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {dest.coverImage ? (
                              <img
                                src={dest.coverImage}
                                alt={dest.name}
                                className="w-10 h-10 object-cover rounded border border-border/40 shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded bg-muted/40 flex items-center justify-center text-muted-foreground shrink-0">
                                <Compass className="w-4 h-4" />
                              </div>
                            )}
                            <div>
                              <p className="font-sans text-sm font-medium text-foreground">{dest.name}</p>
                              {dest.description && (
                                <p className="font-sans text-xs text-muted-foreground line-clamp-1">
                                  {dest.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 hidden md:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {(dest.countries ?? []).length > 0 ? (
                              (dest.countries ?? []).map((c) => (
                                <Badge
                                  key={c.id}
                                  variant="outline"
                                  className="font-sans text-[11px] font-normal border-border/60 bg-background/50"
                                >
                                  {c.name}
                                </Badge>
                              ))
                            ) : (
                              <span className="font-sans text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 hidden lg:table-cell">
                          <span className="font-mono text-xs text-muted-foreground">/{dest.slug}</span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              data-testid={`edit-dest-${dest.id}`}
                              onClick={() => {
                                setEditDest(dest);
                                setDestSheetOpen(true);
                              }}
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              data-testid={`delete-dest-${dest.id}`}
                              onClick={() => setDeleteTargetDest(dest)}
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: Countries Table ───────────────────────────────────────── */}
        {activeTab === "countries" && (
          <div>
            {countriesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded bg-card" />
                ))}
              </div>
            ) : filteredCountries.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-border/40 rounded">
                <p className="font-serif text-2xl font-light text-foreground mb-2">No Countries Found</p>
                <p className="font-sans text-sm text-muted-foreground mb-6">
                  {searchTerm ? "No countries match your search query." : "Add sovereign countries to your catalog."}
                </p>
                <Button
                  onClick={() => {
                    setEditCountry(undefined);
                    setCountrySheetOpen(true);
                  }}
                  className="font-sans text-xs uppercase tracking-widest"
                >
                  Add Country
                </Button>
              </div>
            ) : (
              <div className="border border-border/40 rounded overflow-hidden">
                <table className="w-full" data-testid="countries-table">
                  <thead className="bg-card border-b border-border/40">
                    <tr>
                      <th className="text-left p-4 font-sans text-xs uppercase tracking-widest text-muted-foreground">
                        Country
                      </th>
                      <th className="text-left p-4 font-sans text-xs uppercase tracking-widest text-muted-foreground hidden sm:table-cell">
                        ISO Code
                      </th>
                      <th className="text-left p-4 font-sans text-xs uppercase tracking-widest text-muted-foreground hidden md:table-cell">
                        Slug
                      </th>
                      <th className="text-left p-4 font-sans text-xs uppercase tracking-widest text-muted-foreground hidden lg:table-cell">
                        Order
                      </th>
                      <th className="p-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCountries.map((country) => (
                      <tr
                        key={country.id}
                        data-testid={`country-row-${country.id}`}
                        className="border-b border-border/20 hover:bg-card/40 transition-colors"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {country.image ? (
                              <img
                                src={country.image}
                                alt={country.name}
                                className="w-10 h-10 object-cover rounded border border-border/40 shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded bg-muted/40 flex items-center justify-center text-muted-foreground shrink-0 font-mono text-xs">
                                {country.code || <Globe className="w-4 h-4" />}
                              </div>
                            )}
                            <div>
                              <p className="font-sans text-sm font-medium text-foreground">{country.name}</p>
                              {country.description && (
                                <p className="font-sans text-xs text-muted-foreground line-clamp-1">
                                  {country.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 hidden sm:table-cell">
                          {country.code ? (
                            <Badge variant="outline" className="font-mono text-xs">
                              {country.code}
                            </Badge>
                          ) : (
                            <span className="font-sans text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-4 hidden md:table-cell">
                          <span className="font-mono text-xs text-muted-foreground">/{country.slug}</span>
                        </td>
                        <td className="p-4 hidden lg:table-cell">
                          <span className="font-sans text-xs text-muted-foreground">{country.displayOrder ?? 0}</span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              data-testid={`edit-country-${country.id}`}
                              onClick={() => {
                                setEditCountry(country);
                                setCountrySheetOpen(true);
                              }}
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              data-testid={`delete-country-${country.id}`}
                              onClick={() => setDeleteTargetCountry(country)}
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: Locations Table ───────────────────────────────────────── */}
        {activeTab === "locations" && (
          <div>
            {locationsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded bg-card" />
                ))}
              </div>
            ) : filteredLocations.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-border/40 rounded">
                <p className="font-serif text-2xl font-light text-foreground mb-2">No Locations Found</p>
                <p className="font-sans text-sm text-muted-foreground mb-6">
                  {searchTerm || locationCountryFilter !== "all"
                    ? "No locations match your current search and filters."
                    : "Add your first specific city or landmark."}
                </p>
                <Button
                  onClick={() => {
                    setEditLocation(undefined);
                    setLocSheetOpen(true);
                  }}
                  className="font-sans text-xs uppercase tracking-widest"
                >
                  Add Location
                </Button>
              </div>
            ) : (
              <div className="border border-border/40 rounded overflow-hidden">
                <table className="w-full" data-testid="locations-table">
                  <thead className="bg-card border-b border-border/40">
                    <tr>
                      <th className="text-left p-4 font-sans text-xs uppercase tracking-widest text-muted-foreground">
                        Location
                      </th>
                      <th className="text-left p-4 font-sans text-xs uppercase tracking-widest text-muted-foreground hidden sm:table-cell">
                        Country
                      </th>
                      <th className="text-left p-4 font-sans text-xs uppercase tracking-widest text-muted-foreground hidden md:table-cell">
                        Slug
                      </th>
                      <th className="text-left p-4 font-sans text-xs uppercase tracking-widest text-muted-foreground hidden lg:table-cell">
                        Order
                      </th>
                      <th className="p-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLocations.map((loc) => (
                      <tr
                        key={loc.id}
                        data-testid={`location-row-${loc.id}`}
                        className="border-b border-border/20 hover:bg-card/40 transition-colors"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {loc.image ? (
                              <img
                                src={loc.image}
                                alt={loc.name}
                                className="w-10 h-10 object-cover rounded border border-border/40 shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded bg-muted/40 flex items-center justify-center text-muted-foreground shrink-0">
                                <MapPin className="w-4 h-4" />
                              </div>
                            )}
                            <div>
                              <p className="font-sans text-sm font-medium text-foreground">{loc.name}</p>
                              {loc.description && (
                                <p className="font-sans text-xs text-muted-foreground line-clamp-1">
                                  {loc.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 hidden sm:table-cell">
                          {loc.countryName ? (
                            <Badge variant="outline" className="font-sans text-xs border-border/60">
                              {loc.countryName}
                            </Badge>
                          ) : (
                            <span className="font-sans text-xs text-muted-foreground italic">(Unassigned)</span>
                          )}
                        </td>
                        <td className="p-4 hidden md:table-cell">
                          <span className="font-mono text-xs text-muted-foreground">/{loc.slug}</span>
                        </td>
                        <td className="p-4 hidden lg:table-cell">
                          <span className="font-sans text-xs text-muted-foreground">{loc.displayOrder ?? 0}</span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              data-testid={`edit-location-${loc.id}`}
                              onClick={() => {
                                setEditLocation(loc);
                                setLocSheetOpen(true);
                              }}
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              data-testid={`delete-location-${loc.id}`}
                              onClick={() => setDeleteTargetLoc(loc)}
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Destination Drawer ──────────────────────────────────────────────── */}
      <Sheet open={destSheetOpen} onOpenChange={setDestSheetOpen}>
        <SheetContent side="right" className="bg-card border-border w-full max-w-md overflow-y-auto" data-testid="destination-sheet">
          <SheetHeader className="mb-6">
            <SheetTitle className="font-serif text-2xl font-light text-foreground">
              {editDest ? "Edit Destination" : "New Destination"}
            </SheetTitle>
          </SheetHeader>
          <DestinationForm destination={editDest} onClose={() => setDestSheetOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* ── Country Drawer ──────────────────────────────────────────────────── */}
      <Sheet open={countrySheetOpen} onOpenChange={setCountrySheetOpen}>
        <SheetContent side="right" className="bg-card border-border w-full max-w-md overflow-y-auto" data-testid="country-sheet">
          <SheetHeader className="mb-6">
            <SheetTitle className="font-serif text-2xl font-light text-foreground">
              {editCountry ? "Edit Country" : "New Country"}
            </SheetTitle>
          </SheetHeader>
          <CountryForm country={editCountry} onClose={() => setCountrySheetOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* ── Location Drawer ─────────────────────────────────────────────────── */}
      <Sheet open={locSheetOpen} onOpenChange={setLocSheetOpen}>
        <SheetContent side="right" className="bg-card border-border w-full max-w-md overflow-y-auto" data-testid="location-sheet">
          <SheetHeader className="mb-6">
            <SheetTitle className="font-serif text-2xl font-light text-foreground">
              {editLocation ? "Edit Location" : "New Location"}
            </SheetTitle>
          </SheetHeader>
          <LocationForm
            location={editLocation}
            countries={countries ?? []}
            onClose={() => setLocSheetOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* ── Delete Destination Confirmation ─────────────────────────────────── */}
      <AlertDialog open={!!deleteTargetDest} onOpenChange={(o) => !o && setDeleteTargetDest(undefined)}>
        <AlertDialogContent className="bg-card border-border" data-testid="delete-dest-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-xl font-light text-foreground">Delete Destination</AlertDialogTitle>
            <AlertDialogDescription className="font-sans text-sm text-muted-foreground">
              Delete "{deleteTargetDest?.name}"? This destination will be removed from navigation and place links.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="delete-dest-cancel" className="font-sans text-xs uppercase tracking-widest">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="delete-dest-confirm"
              onClick={handleDeleteDest}
              className="bg-destructive text-destructive-foreground font-sans text-xs uppercase tracking-widest"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete Country Confirmation ─────────────────────────────────────── */}
      <AlertDialog open={!!deleteTargetCountry} onOpenChange={(o) => !o && setDeleteTargetCountry(undefined)}>
        <AlertDialogContent className="bg-card border-border" data-testid="delete-country-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-xl font-light text-foreground">Delete Country</AlertDialogTitle>
            <AlertDialogDescription className="font-sans text-sm text-muted-foreground">
              Delete "{deleteTargetCountry?.name}"? Locations currently assigned to this country will have their country association cleared.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-sans text-xs uppercase tracking-widest">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCountry}
              className="bg-destructive text-destructive-foreground font-sans text-xs uppercase tracking-widest"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete Location Confirmation ────────────────────────────────────── */}
      <AlertDialog open={!!deleteTargetLoc} onOpenChange={(o) => !o && setDeleteTargetLoc(undefined)}>
        <AlertDialogContent className="bg-card border-border" data-testid="delete-loc-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-xl font-light text-foreground">Delete Location</AlertDialogTitle>
            <AlertDialogDescription className="font-sans text-sm text-muted-foreground">
              Delete "{deleteTargetLoc?.name}"? Tours referencing this base location will have their location link cleared.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-sans text-xs uppercase tracking-widest">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLoc}
              className="bg-destructive text-destructive-foreground font-sans text-xs uppercase tracking-widest"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
