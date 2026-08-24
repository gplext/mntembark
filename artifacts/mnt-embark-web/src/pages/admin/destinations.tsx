import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListDestinations,
  useCreateDestination,
  useUpdateDestination,
  useDeleteDestination,
  useListCountries,
  useListLocations,
  useGetDestinationPlacesById,
  useSetDestinationPlaces,
  getListDestinationsQueryKey,
  getGetDestinationPlacesByIdQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import { Input } from "@workspace/mnt-embark/components/ui/input";
import { Textarea } from "@workspace/mnt-embark/components/ui/textarea";
import { Skeleton } from "@workspace/mnt-embark/components/ui/skeleton";
import { Checkbox } from "@workspace/mnt-embark/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@workspace/mnt-embark/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@workspace/mnt-embark/components/ui/alert-dialog";
import { Separator } from "@workspace/mnt-embark/components/ui/separator";
import { useToast } from "@workspace/mnt-embark/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { ImageUploadField } from "@/components/ImageUploadField";
import type { Destination, CountrySummary, LocationSummary } from "@workspace/api-client-react";

// ── CountryMultiSelect ────────────────────────────────────────────────────────

function CountryMultiSelect({
  countries,
  selectedIds,
  onChange,
  "data-testid": testId,
}: {
  countries: CountrySummary[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
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
      <span className="font-sans text-xs text-muted-foreground">
        {selectedIds.length} selected
      </span>
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
                  className="font-sans text-xs text-foreground cursor-pointer select-none"
                >
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
  "data-testid": testId,
}: {
  locations: LocationSummary[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
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
      <span className="font-sans text-xs text-muted-foreground">
        {selectedIds.length} selected
      </span>
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

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

  // Load current places for edit mode — must resolve BEFORE we know what to check
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

  // Places selection — derived from the query result, not from props at mount.
  // Dependency array is honest: placesData changes when the query resolves.
  const [selectedCountryIds, setSelectedCountryIds] = useState<number[]>([]);
  const [selectedLocationIds, setSelectedLocationIds] = useState<number[]>([]);

  useEffect(() => {
    if (!destination?.id) return; // new destination — stay empty
    if (!placesLoaded || !placesData) return;
    setSelectedCountryIds(placesData.countryIds);
    setSelectedLocationIds(placesData.locationIds);
  }, [placesData, placesLoaded, destination?.id]);

  const placesReady = !destination?.id || placesLoaded || placesError;

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

    // Client-side slug validation
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
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="destination-form">
      <div>
        <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">Name</label>
        <Input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          data-testid="dest-form-name"
          className="bg-background border-border/60 font-sans text-sm"
        />
      </div>

      <div>
        <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">Slug</label>
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
          {isPending ? "Saving…" : destination ? "Update" : "Create"}
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
  );
}

// ── AdminDestinationsPage ─────────────────────────────────────────────────────

export default function AdminDestinationsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: destinations, isLoading } = useListDestinations();
  const deleteDestination = useDeleteDestination();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editDest, setEditDest] = useState<Destination | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Destination | undefined>();

  const openCreate = () => { setEditDest(undefined); setSheetOpen(true); };
  const openEdit = (d: Destination) => { setEditDest(d); setSheetOpen(true); };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteDestination.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListDestinationsQueryKey() });
          toast({ title: "Destination Deleted" });
          setDeleteTarget(undefined);
        },
        onError: () => toast({ title: "Error", description: "Failed to delete.", variant: "destructive" }),
      },
    );
  };

  return (
    <AdminLayout>
      <div className="p-8" data-testid="admin-destinations">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="font-sans text-xs uppercase tracking-widest text-primary mb-1">Admin</p>
            <h1 className="font-serif text-3xl font-light text-foreground">Destinations</h1>
          </div>
          <Button onClick={openCreate} data-testid="create-destination-btn" className="font-sans text-xs uppercase tracking-widest gap-2">
            <Plus className="h-4 w-4" /> New Destination
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded bg-card" />)}</div>
        ) : !destinations || destinations.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border/40 rounded">
            <p className="font-serif text-2xl font-light text-foreground mb-2">No Destinations</p>
            <p className="font-sans text-sm text-muted-foreground mb-6">Add your first destination.</p>
            <Button onClick={openCreate} data-testid="create-destination-empty" className="font-sans text-xs uppercase tracking-widest">Add Destination</Button>
          </div>
        ) : (
          <div className="border border-border/40 rounded overflow-hidden">
            <table className="w-full" data-testid="destinations-table">
              <thead className="bg-card border-b border-border/40">
                <tr>
                  <th className="text-left p-4 font-sans text-xs uppercase tracking-widest text-muted-foreground">Name</th>
                  <th className="text-left p-4 font-sans text-xs uppercase tracking-widest text-muted-foreground hidden md:table-cell">Countries</th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody>
                {destinations.map((dest) => (
                  <tr key={dest.id} data-testid={`dest-row-${dest.id}`} className="border-b border-border/20 hover:bg-card/40 transition-colors">
                    <td className="p-4"><p className="font-sans text-sm text-foreground">{dest.name}</p></td>
                    <td className="p-4 hidden md:table-cell"><p className="font-sans text-xs text-muted-foreground">{(dest.countries ?? []).map(c => c.name).join(", ") || "—"}</p></td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 justify-end">
                        <Button variant="ghost" size="icon" data-testid={`edit-dest-${dest.id}`} onClick={() => openEdit(dest)} className="h-7 w-7 text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" data-testid={`delete-dest-${dest.id}`} onClick={() => setDeleteTarget(dest)} className="h-7 w-7 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="bg-card border-border w-full max-w-md overflow-y-auto" data-testid="destination-sheet">
          <SheetHeader className="mb-6">
            <SheetTitle className="font-serif text-2xl font-light text-foreground">{editDest ? "Edit Destination" : "New Destination"}</SheetTitle>
          </SheetHeader>
          <DestinationForm destination={editDest} onClose={() => setSheetOpen(false)} />
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(undefined)}>
        <AlertDialogContent className="bg-card border-border" data-testid="delete-dest-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-xl font-light text-foreground">Delete Destination</AlertDialogTitle>
            <AlertDialogDescription className="font-sans text-sm text-muted-foreground">Delete "{deleteTarget?.name}"? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="delete-dest-cancel" className="font-sans text-xs uppercase tracking-widest">Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid="delete-dest-confirm" onClick={handleDelete} className="bg-destructive text-destructive-foreground font-sans text-xs uppercase tracking-widest">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
