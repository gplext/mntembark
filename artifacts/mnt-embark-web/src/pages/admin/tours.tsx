import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListTours,
  useCreateTour,
  useUpdateTour,
  useDeleteTour,
  useListCategories,
  useListDestinations,
  useListLocations,
  useListActivityFilters,
  useGetTourBySlug,
  useSetTourActivities,
  getGetFeaturedToursQueryKey,
  getGetTourBySlugQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import { Input } from "@workspace/mnt-embark/components/ui/input";
import { Textarea } from "@workspace/mnt-embark/components/ui/textarea";
import { Badge } from "@workspace/mnt-embark/components/ui/badge";
import { Skeleton } from "@workspace/mnt-embark/components/ui/skeleton";
import { Checkbox } from "@workspace/mnt-embark/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/mnt-embark/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@workspace/mnt-embark/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@workspace/mnt-embark/components/ui/alert-dialog";
import { useToast } from "@workspace/mnt-embark/hooks/use-toast";
import { Separator } from "@workspace/mnt-embark/components/ui/separator";
import { cn } from "@workspace/mnt-embark/lib/utils";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { ImageUploadField, ImageGalleryUploadField } from "@/components/ImageUploadField";
import type {
  Tour,
  TourInput,
  TourUpdate,
  TourClassification,
  ItineraryStep,
  ActivityFilterGroup,
} from "@workspace/api-client-react";

const STEP_TYPES = ["Pickup", "Flight", "Visa", "Layover", "Ride", "Hotel", "Activities"] as const;
const MAX_ACTIVITIES = 10;
const CLASSIFICATION_OPTIONS: { value: TourClassification; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "special",  label: "Special" },
  { value: "exclusive", label: "Exclusive" },
];

// ── ActivityMultiSelect ───────────────────────────────────────────────────────

function ActivityMultiSelect({
  groups,
  selectedIds,
  onChange,
  "data-testid": testId,
}: {
  groups: ActivityFilterGroup[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  "data-testid"?: string;
}) {
  const [search, setSearch] = useState("");
  const atCap = selectedIds.length >= MAX_ACTIVITIES;

  const toggle = (id: number) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else if (!atCap) {
      onChange([...selectedIds, id]);
    }
  };

  const q = search.toLowerCase();
  const filteredGroups = groups
    .map((g) => ({
      ...g,
      activities: g.activities.filter(
        (a) =>
          q === "" ||
          a.name.toLowerCase().includes(q) ||
          a.aliases.some((alias) => alias.toLowerCase().includes(q))
      ),
    }))
    .filter((g) => g.activities.length > 0);

  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="flex items-center justify-between">
        <span className="font-sans text-xs text-muted-foreground">
          {selectedIds.length} / {MAX_ACTIVITIES} selected
        </span>
        {atCap && (
          <span className="font-sans text-xs text-amber-500">Cap reached</span>
        )}
      </div>
      <Input
        placeholder="Search by name or alias…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="bg-background border-border/60 font-sans text-xs h-8"
        data-testid="activity-search"
      />
      <div
        className="border border-border/40 rounded overflow-y-auto max-h-56 p-2 space-y-3"
        data-testid="activity-list"
      >
        {filteredGroups.length === 0 ? (
          <p className="font-sans text-xs text-muted-foreground text-center py-4">
            No activities found
          </p>
        ) : (
          filteredGroups.map((group) => (
            <div key={group.groupSlug}>
              <p className="font-sans text-xs uppercase tracking-widest text-muted-foreground mb-1 pb-1 border-b border-border/20">
                {group.groupName}
              </p>
              <div className="space-y-1 mt-1">
                {group.activities.map((activity) => {
                  const checked = selectedIds.includes(activity.id);
                  const disabled = !checked && atCap;
                  return (
                    <div
                      key={activity.id}
                      className={cn("flex items-center gap-2 py-0.5", disabled && "opacity-40")}
                    >
                      <Checkbox
                        id={`activity-${activity.id}`}
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={() => toggle(activity.id)}
                        data-testid={`activity-checkbox-${activity.slug}`}
                      />
                      <label
                        htmlFor={`activity-${activity.id}`}
                        className={cn(
                          "font-sans text-xs text-foreground select-none",
                          disabled ? "cursor-not-allowed" : "cursor-pointer"
                        )}
                      >
                        {activity.name}
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

// ── ItineraryStepBuilder ──────────────────────────────────────────────────────

function ItineraryStepBuilder({
  steps,
  onChange,
}: {
  steps: ItineraryStep[];
  onChange: (steps: ItineraryStep[]) => void;
}) {
  const addStep = () => {
    onChange([
      ...steps,
      { type: "Hotel", title: "", description: "", image: null, images: [] },
    ]);
  };

  const removeStep = (idx: number) => {
    onChange(steps.filter((_, i) => i !== idx));
  };

  const updateStep = (idx: number, field: keyof ItineraryStep, value: unknown) => {
    onChange(
      steps.map((s, i) =>
        i === idx
          ? {
              ...s,
              [field]:
                value ||
                (field === "image" ? null : field === "images" ? [] : ""),
            }
          : s
      )
    );
  };

  const updateStepImages = (idx: number, newImages: string[]) => {
    onChange(
      steps.map((s, i) => {
        if (i !== idx) return s;
        return {
          ...s,
          images: newImages,
          image: newImages[0] || null,
        };
      })
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-sans text-xs uppercase tracking-widest text-muted-foreground">
            Itinerary Steps
          </p>
          <p className="font-sans text-[11px] text-muted-foreground/80 mt-0.5">
            Add multiple images to any step to display an interactive carousel.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="add-itinerary-step"
          onClick={addStep}
          className="font-sans text-xs uppercase tracking-widest gap-1"
        >
          <Plus className="h-3 w-3" />
          Add Step
        </Button>
      </div>

      {steps.map((step, idx) => {
        const stepImages =
          step.images && step.images.length > 0
            ? step.images
            : step.image
            ? [step.image]
            : [];

        return (
          <div
            key={idx}
            className="border border-border/40 rounded p-3 space-y-3 bg-background/50"
            data-testid={`itinerary-step-builder-${idx}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-sans text-xs font-semibold text-primary uppercase tracking-wider">
                  Step {idx + 1}
                </span>
                {stepImages.length > 1 && (
                  <Badge variant="outline" className="text-[10px] border-primary/40 text-primary py-0 px-1.5 font-sans">
                    {stepImages.length} Images (Carousel)
                  </Badge>
                )}
              </div>
              <button
                type="button"
                data-testid={`remove-step-${idx}`}
                onClick={() => removeStep(idx)}
                className="text-muted-foreground hover:text-destructive transition-colors"
                title="Remove Step"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <Select
              value={step.type}
              onValueChange={(v) => updateStep(idx, "type", v)}
            >
              <SelectTrigger className="bg-background border-border/60 font-sans text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {STEP_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="font-sans text-xs">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={step.title}
              onChange={(e) => updateStep(idx, "title", e.target.value)}
              placeholder="Step title"
              className="bg-background border-border/60 font-sans text-xs h-8"
            />
            <Textarea
              value={step.description}
              onChange={(e) => updateStep(idx, "description", e.target.value)}
              placeholder="Step description"
              rows={2}
              className="bg-background border-border/60 font-sans text-xs resize-none"
            />
            <ImageGalleryUploadField
              label="Step Images (Upload multiple for carousel)"
              values={stepImages}
              onChange={(urls) => updateStepImages(idx, urls)}
              data-testid={`step-${idx}-gallery`}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── TourForm ──────────────────────────────────────────────────────────────────

function TourForm({
  tour,
  onClose,
}: {
  tour?: Tour;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Data hooks
  const { data: categories } = useListCategories();
  const { data: destinations } = useListDestinations();
  const { data: locations } = useListLocations();
  const { data: activityGroups } = useListActivityFilters();
  const tourSlug = tour?.slug ?? "";
  const { data: tourDetail, isSuccess: tourDetailLoaded, isError: tourDetailError } =
    useGetTourBySlug(tourSlug, {
      query: { queryKey: getGetTourBySlugQueryKey(tourSlug), enabled: !!tour?.slug },
    });

  // Mutations
  const createTour = useCreateTour();
  const updateTour = useUpdateTour();
  const setActivitiesMutation = useSetTourActivities();

  // Core form state
  const [form, setForm] = useState({
    title: tour?.title ?? "",
    description: tour?.description ?? "",
    coverImage: tour?.coverImage ?? "",
    images: tour?.images ?? [] as string[],
    location: tour?.location ?? "",
    durationDays: String(tour?.durationDays ?? ""),
    priceFrom: String(tour?.priceFrom ?? ""),
    featured: tour?.featured ?? false,
    categoryId: String(tour?.categoryId ?? ""),
    destinationId: String(tour?.destinationId ?? ""),
    classification: (tour?.classification ?? "standard") as TourClassification,
  });

  const [steps, setSteps] = useState<ItineraryStep[]>(tour?.itinerarySteps ?? []);

  const [locationId, setLocationId] = useState(
    tour?.locationId != null ? String(tour.locationId) : ""
  );

  // Activity selection — loaded once both activityGroups and tourDetail are available
  const [selectedActivityIds, setSelectedActivityIds] = useState<number[]>([]);
  const activitiesInitialized = useRef(false);
  useEffect(() => {
    if (activitiesInitialized.current || !activityGroups) return;
    // If editing a tour with a slug, wait for the slug detail to finish loading
    if (tour?.slug && !tourDetailLoaded && !tourDetailError) return;

    activitiesInitialized.current = true;

    if (!tourDetail?.activitySections?.length) return;

    const slugToId = new Map<string, number>();
    for (const group of activityGroups) {
      for (const a of group.activities) slugToId.set(a.slug, a.id);
    }

    const ids: number[] = [];
    for (const section of tourDetail.activitySections) {
      for (const item of section.activities) {
        const id = slugToId.get(item.slug);
        if (id !== undefined) ids.push(id);
      }
    }
    setSelectedActivityIds(ids);
  }, [activityGroups, tourDetailLoaded, tourDetailError]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save flow ──────────────────────────────────────────────────────────────

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetFeaturedToursQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["/api/tours"] });
  };

  const doActivities = (tourId: number, label: string) => {
    setActivitiesMutation.mutate(
      { id: tourId, data: { activityIds: selectedActivityIds } },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: label, description: `"${form.title}" has been saved.` });
          onClose();
        },
        onError: () => {
          invalidate();
          toast({
            title: "Saved with errors",
            description: `Tour ${label.toLowerCase()} successfully, but activities could not be saved.`,
            variant: "destructive",
          });
          onClose();
        },
      }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (tour) {
      const payload: TourUpdate = {
        title: form.title,
        description: form.description,
        coverImage: form.coverImage,
        images: form.images,
        location: form.location,
        durationDays: Number(form.durationDays),
        priceFrom: Number(form.priceFrom),
        featured: form.featured,
        classification: form.classification,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        destinationId: form.destinationId ? Number(form.destinationId) : null,
        locationId: locationId ? Number(locationId) : null,
        itinerarySteps: steps,
      };
      updateTour.mutate(
        { id: tour.id, data: payload },
        {
          onSuccess: () => doActivities(tour.id, "Tour Updated"),
          onError: () => {
            toast({ title: "Error", description: "Failed to update tour.", variant: "destructive" });
          },
        }
      );
    } else {
      const payload: TourInput = {
        title: form.title,
        description: form.description,
        coverImage: form.coverImage,
        images: form.images,
        location: form.location,
        durationDays: Number(form.durationDays),
        priceFrom: Number(form.priceFrom),
        featured: form.featured,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        destinationId: form.destinationId ? Number(form.destinationId) : null,
        itinerarySteps: steps,
      };
      createTour.mutate(
        { data: payload },
        {
          onSuccess: (created) => doActivities(created.id, "Tour Created"),
          onError: () => {
            toast({ title: "Error", description: "Failed to create tour.", variant: "destructive" });
          },
        }
      );
    }
  };

  const isPending =
    createTour.isPending || updateTour.isPending || setActivitiesMutation.isPending;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-1" data-testid="tour-form">
      <div className="grid grid-cols-2 gap-3">
        {/* Title */}
        <div className="col-span-2">
          <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">Title</label>
          <Input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            data-testid="tour-form-title"
            className="bg-background border-border/60 font-sans text-sm"
          />
        </div>

        {/* Description */}
        <div className="col-span-2">
          <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">Description</label>
          <Textarea
            required
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            data-testid="tour-form-description"
            rows={3}
            className="bg-background border-border/60 font-sans text-sm resize-none"
          />
        </div>

        {/* Cover Image */}
        <div className="col-span-2">
          <ImageUploadField
            label="Cover Image"
            value={form.coverImage}
            onChange={(url) => setForm({ ...form, coverImage: url })}
            required
            data-testid="tour-form-cover-image"
          />
        </div>

        {/* Additional Images */}
        <div className="col-span-2">
          <ImageGalleryUploadField
            label="Additional Images"
            values={form.images}
            onChange={(images) => setForm({ ...form, images })}
            data-testid="tour-form-images"
          />
        </div>

        {/* Location (freetext) */}
        <div>
          <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">Location</label>
          <Input
            required
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            data-testid="tour-form-location"
            className="bg-background border-border/60 font-sans text-sm"
          />
        </div>

        {/* Duration */}
        <div>
          <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">Duration (days)</label>
          <Input
            required
            type="number"
            min={1}
            value={form.durationDays}
            onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
            data-testid="tour-form-duration"
            className="bg-background border-border/60 font-sans text-sm"
          />
        </div>

        {/* Price */}
        <div>
          <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">Price From ($)</label>
          <Input
            required
            type="number"
            min={0}
            value={form.priceFrom}
            onChange={(e) => setForm({ ...form, priceFrom: e.target.value })}
            data-testid="tour-form-price"
            className="bg-background border-border/60 font-sans text-sm"
          />
        </div>

        {/* Featured */}
        <div className="flex items-center gap-2 pt-5">
          <Checkbox
            id="featured"
            checked={form.featured}
            onCheckedChange={(v) => setForm({ ...form, featured: !!v })}
            data-testid="tour-form-featured"
          />
          <label htmlFor="featured" className="font-sans text-sm text-foreground cursor-pointer">
            Featured
          </label>
        </div>

        {/* Category */}
        <div>
          <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">Category</label>
          <Select
            value={form.categoryId || "none"}
            onValueChange={(v) => setForm({ ...form, categoryId: v === "none" ? "" : v })}
          >
            <SelectTrigger className="bg-background border-border/60 font-sans text-sm" data-testid="tour-form-category">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="none">None</SelectItem>
              {categories?.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Destination */}
        <div>
          <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">Destination</label>
          <Select
            value={form.destinationId || "none"}
            onValueChange={(v) => setForm({ ...form, destinationId: v === "none" ? "" : v })}
          >
            <SelectTrigger className="bg-background border-border/60 font-sans text-sm" data-testid="tour-form-destination">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="none">None</SelectItem>
              {destinations?.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Location select (structured) */}
        <div>
          <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">Location (Structured)</label>
          <Select
            value={locationId || "none"}
            onValueChange={(v) => setLocationId(v === "none" ? "" : v)}
          >
            <SelectTrigger className="bg-background border-border/60 font-sans text-sm" data-testid="tour-form-location-id">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="none">None</SelectItem>
              {locations?.map((l) => (
                <SelectItem key={l.id} value={String(l.id)}>
                  {l.name}{l.countryName ? ` — ${l.countryName}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Classification */}
        <div>
          <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">Classification</label>
          <Select
            value={form.classification}
            onValueChange={(v) => setForm({ ...form, classification: v as TourClassification })}
          >
            <SelectTrigger className="bg-background border-border/60 font-sans text-sm" data-testid="tour-form-classification">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {CLASSIFICATION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="font-sans text-sm">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator className="bg-border/20" />
      <ItineraryStepBuilder steps={steps} onChange={setSteps} />

      <Separator className="bg-border/20" />

      {/* Activities */}
      <div>
        <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-2">Activities</label>
        <ActivityMultiSelect
          groups={activityGroups ?? []}
          selectedIds={selectedActivityIds}
          onChange={setSelectedActivityIds}
          data-testid="tour-form-activities"
        />
      </div>

      <Separator className="bg-border/20" />
      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          data-testid="tour-form-submit"
          disabled={isPending}
          className="flex-1 font-sans text-xs uppercase tracking-widest"
        >
          {isPending ? "Saving…" : tour ? "Update Tour" : "Create Tour"}
        </Button>
        <Button
          type="button"
          variant="outline"
          data-testid="tour-form-cancel"
          onClick={onClose}
          className="font-sans text-xs uppercase tracking-widest"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ── AdminToursPage ────────────────────────────────────────────────────────────

export default function AdminToursPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: tours, isLoading } = useListTours();
  const deleteTour = useDeleteTour();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTour, setEditTour] = useState<Tour | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Tour | undefined>();

  const openCreate = () => {
    setEditTour(undefined);
    setSheetOpen(true);
  };

  const openEdit = (tour: Tour) => {
    setEditTour(tour);
    setSheetOpen(true);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteTour.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetFeaturedToursQueryKey() });
          queryClient.invalidateQueries({ queryKey: ["/api/tours"] });
          toast({ title: "Tour Deleted", description: `"${deleteTarget.title}" has been removed.` });
          setDeleteTarget(undefined);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to delete tour.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <AdminLayout>
      <div className="p-8" data-testid="admin-tours">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="font-sans text-xs uppercase tracking-widest text-primary mb-1">Admin</p>
            <h1 className="font-serif text-3xl font-light text-foreground">Tours</h1>
          </div>
          <Button
            onClick={openCreate}
            data-testid="create-tour-btn"
            className="font-sans text-xs uppercase tracking-widest gap-2"
          >
            <Plus className="h-4 w-4" />
            New Tour
          </Button>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded bg-card" />
            ))}
          </div>
        ) : !tours || tours.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border/40 rounded">
            <p className="font-serif text-2xl font-light text-foreground mb-2">No Tours</p>
            <p className="font-sans text-sm text-muted-foreground mb-6">Create your first tour to get started.</p>
            <Button onClick={openCreate} data-testid="create-tour-empty" className="font-sans text-xs uppercase tracking-widest">
              Create Tour
            </Button>
          </div>
        ) : (
          <div className="border border-border/40 rounded overflow-hidden">
            <table className="w-full" data-testid="tours-table">
              <thead className="bg-card border-b border-border/40">
                <tr>
                  <th className="text-left p-4 font-sans text-xs uppercase tracking-widest text-muted-foreground">Title</th>
                  <th className="text-left p-4 font-sans text-xs uppercase tracking-widest text-muted-foreground hidden md:table-cell">Location</th>
                  <th className="text-left p-4 font-sans text-xs uppercase tracking-widest text-muted-foreground hidden md:table-cell">Duration</th>
                  <th className="text-left p-4 font-sans text-xs uppercase tracking-widest text-muted-foreground hidden md:table-cell">Price</th>
                  <th className="text-left p-4 font-sans text-xs uppercase tracking-widest text-muted-foreground">Status</th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody>
                {tours.map((tour) => {
                  // Build location string from structured fields; fall back to "—"
                  const locationDisplay = tour.locationName
                    ? tour.countryName
                      ? `${tour.locationName}, ${tour.countryName}`
                      : tour.locationName
                    : "—";

                  return (
                    <tr
                      key={tour.id}
                      data-testid={`tour-row-admin-${tour.id}`}
                      className="border-b border-border/20 hover:bg-card/40 transition-colors"
                    >
                      <td className="p-4">
                        <p className="font-sans text-sm text-foreground">{tour.title}</p>
                      </td>
                      <td className="p-4 hidden md:table-cell">
                        <p className="font-sans text-xs text-muted-foreground">{locationDisplay}</p>
                      </td>
                      <td className="p-4 hidden md:table-cell">
                        <p className="font-sans text-xs text-muted-foreground">{tour.durationDays}d</p>
                      </td>
                      <td className="p-4 hidden md:table-cell">
                        <p className="font-sans text-xs text-foreground">${tour.priceFrom.toLocaleString()}</p>
                      </td>
                      <td className="p-4">
                        {tour.featured ? (
                          <Badge variant="outline" className="border-primary text-primary font-sans text-xs">
                            Featured
                          </Badge>
                        ) : (
                          <span className="font-sans text-xs text-muted-foreground">
                            {tour.classification === "special"
                              ? "Special"
                              : tour.classification === "exclusive"
                              ? "Exclusive"
                              : "Standard"}
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`edit-tour-${tour.id}`}
                            onClick={() => openEdit(tour)}
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`delete-tour-${tour.id}`}
                            onClick={() => setDeleteTarget(tour)}
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="bg-card border-border w-full max-w-xl overflow-y-auto"
          data-testid="tour-sheet"
        >
          <SheetHeader className="mb-6">
            <SheetTitle className="font-serif text-2xl font-light text-foreground">
              {editTour ? "Edit Tour" : "New Tour"}
            </SheetTitle>
          </SheetHeader>
          <TourForm
            tour={editTour}
            onClose={() => setSheetOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(undefined)}>
        <AlertDialogContent className="bg-card border-border" data-testid="delete-tour-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-xl font-light text-foreground">
              Delete Tour
            </AlertDialogTitle>
            <AlertDialogDescription className="font-sans text-sm text-muted-foreground">
              Are you sure you want to delete "{deleteTarget?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              data-testid="delete-tour-cancel"
              className="font-sans text-xs uppercase tracking-widest"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="delete-tour-confirm"
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground font-sans text-xs uppercase tracking-widest hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
