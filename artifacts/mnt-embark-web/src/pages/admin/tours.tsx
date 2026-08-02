import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListTours,
  useCreateTour,
  useUpdateTour,
  useDeleteTour,
  useListCategories,
  useListDestinations,
  getGetFeaturedToursQueryKey,
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
import { Plus, Pencil, Trash2, X } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { ImageUploadField, ImageGalleryUploadField } from "@/components/ImageUploadField";
import type { Tour, TourInput, ItineraryStep } from "@workspace/api-client-react";

const STEP_TYPES = ["Pickup", "Flight", "Visa", "Layover", "Ride", "Hotel", "Activities"] as const;

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
      { type: "Hotel", title: "", description: "", image: null },
    ]);
  };

  const removeStep = (idx: number) => {
    onChange(steps.filter((_, i) => i !== idx));
  };

  const updateStep = (idx: number, field: keyof ItineraryStep, value: string) => {
    onChange(
      steps.map((s, i) => (i === idx ? { ...s, [field]: value || (field === "image" ? null : "") } : s))
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-sans text-xs uppercase tracking-widest text-muted-foreground">
          Itinerary Steps
        </p>
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

      {steps.map((step, idx) => (
        <div
          key={idx}
          className="border border-border/40 rounded p-3 space-y-2 bg-background/50"
          data-testid={`itinerary-step-builder-${idx}`}
        >
          <div className="flex items-center justify-between">
            <p className="font-sans text-xs text-muted-foreground">Step {idx + 1}</p>
            <button
              type="button"
              data-testid={`remove-step-${idx}`}
              onClick={() => removeStep(idx)}
              className="text-muted-foreground hover:text-destructive transition-colors"
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
          <ImageUploadField
            value={step.image || ""}
            onChange={(url) => updateStep(idx, "image", url || "")}
            data-testid={`step-${idx}-image`}
          />
        </div>
      ))}
    </div>
  );
}

function TourForm({
  tour,
  onClose,
}: {
  tour?: Tour;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: categories } = useListCategories();
  const { data: destinations } = useListDestinations();

  const createTour = useCreateTour();
  const updateTour = useUpdateTour();

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
  });

  const [steps, setSteps] = useState<ItineraryStep[]>(tour?.itinerarySteps ?? []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

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

    if (tour) {
      updateTour.mutate(
        { id: tour.id, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetFeaturedToursQueryKey() });
            queryClient.invalidateQueries({ queryKey: ["/api/tours"] });
            toast({ title: "Tour Updated", description: `"${payload.title}" has been updated.` });
            onClose();
          },
          onError: () => {
            toast({ title: "Error", description: "Failed to update tour.", variant: "destructive" });
          },
        }
      );
    } else {
      createTour.mutate(
        { data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetFeaturedToursQueryKey() });
            queryClient.invalidateQueries({ queryKey: ["/api/tours"] });
            toast({ title: "Tour Created", description: `"${payload.title}" has been created.` });
            onClose();
          },
          onError: () => {
            toast({ title: "Error", description: "Failed to create tour.", variant: "destructive" });
          },
        }
      );
    }
  };

  const isPending = createTour.isPending || updateTour.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-1" data-testid="tour-form">
      <div className="grid grid-cols-2 gap-3">
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
        <div className="col-span-2">
          <ImageUploadField
            label="Cover Image"
            value={form.coverImage}
            onChange={(url) => setForm({ ...form, coverImage: url })}
            required
            data-testid="tour-form-cover-image"
          />
        </div>
        <div className="col-span-2">
          <ImageGalleryUploadField
            label="Additional Images"
            values={form.images}
            onChange={(images) => setForm({ ...form, images })}
            data-testid="tour-form-images"
          />
        </div>
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
      </div>

      <Separator className="bg-border/20" />
      <ItineraryStepBuilder steps={steps} onChange={setSteps} />

      <Separator className="bg-border/20" />
      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          data-testid="tour-form-submit"
          disabled={isPending}
          className="flex-1 font-sans text-xs uppercase tracking-widest"
        >
          {isPending ? "Saving..." : tour ? "Update Tour" : "Create Tour"}
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
                {tours.map((tour) => (
                  <tr
                    key={tour.id}
                    data-testid={`tour-row-admin-${tour.id}`}
                    className="border-b border-border/20 hover:bg-card/40 transition-colors"
                  >
                    <td className="p-4">
                      <p className="font-sans text-sm text-foreground">{tour.title}</p>
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      <p className="font-sans text-xs text-muted-foreground">{tour.location}</p>
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
                        <span className="font-sans text-xs text-muted-foreground">Standard</span>
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
                ))}
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
