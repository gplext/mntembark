/**
 * Admin: attractions.
 *
 * One form saves everything about an attraction in one request - its fields,
 * its categories in order, its activities and its steps - so a failure
 * cannot leave it half saved the way the old two-request tour form could.
 */

import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  useListCategories,
  useListLocations,
  useListActivityFilters,
  useListCountries,
} from "@workspace/api-client-react";
import type { ActivityFilterGroup } from "@workspace/api-client-react";
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
import { Plus, Pencil, Trash2, X, ArrowUp, ArrowDown, ExternalLink, Star } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { ImageUploadField, ImageGalleryUploadField } from "@/components/ImageUploadField";
import {
  useAdminAttractions,
  useCreateAttraction,
  useUpdateAttraction,
  useDeleteAttraction,
  useCreateLocation,
  placeOf,
  FIXED_STEP_TITLES,
  MAX_ATTRACTION_STEPS,
  MAX_CATEGORIES,
  MAX_ACTIVITIES,
  type Attraction,
  type AttractionInput,
  type AttractionStep,
  type Classification,
} from "@/lib/attractions-api";

const CLASSIFICATION_OPTIONS: { value: Classification; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "special", label: "Special" },
  { value: "exclusive", label: "Exclusive" },
];

const labelCls = "font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1";
const fieldCls = "bg-background border-border/60 font-sans text-sm";

function blankSteps(): AttractionStep[] {
  return [
    { kind: "reach", title: FIXED_STEP_TITLES.reach, description: "", images: [] },
    { kind: "prepare", title: FIXED_STEP_TITLES.prepare, description: "", images: [] },
  ];
}

/* ------------------------------------------------------------ categories */

/**
 * Pick several; the order is the order they were picked, and the first is
 * the main one. Arrows reorder, so the main category can be changed without
 * unticking everything.
 */
function CategoryPicker({
  options,
  selected,
  onChange,
}: {
  options: { id: number; name: string }[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const atCap = selected.length >= MAX_CATEGORIES;
  const name = (id: number) => options.find((o) => o.id === id)?.name ?? `#${id}`;
  const move = (i: number, d: -1 | 1) => {
    const next = [...selected];
    [next[i], next[i + d]] = [next[i + d]!, next[i]!];
    onChange(next);
  };

  return (
    <div className="space-y-2" data-testid="attraction-form-categories">
      {selected.length > 0 && (
        <ol className="space-y-1">
          {selected.map((id, i) => (
            <li key={id} className="flex items-center gap-2 border border-border/40 rounded px-2 py-1 bg-background/50">
              {i === 0 ? (
                <Star className="h-3 w-3 text-primary shrink-0" aria-label="Main category" />
              ) : (
                <span className="w-3 shrink-0" />
              )}
              <span className="font-sans text-xs text-foreground flex-1">
                {name(id)}
                {i === 0 && <span className="text-muted-foreground"> · main</span>}
              </span>
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="text-muted-foreground hover:text-foreground disabled:opacity-20" aria-label="Move up">
                <ArrowUp className="h-3 w-3" />
              </button>
              <button type="button" disabled={i === selected.length - 1} onClick={() => move(i, 1)} className="text-muted-foreground hover:text-foreground disabled:opacity-20" aria-label="Move down">
                <ArrowDown className="h-3 w-3" />
              </button>
              <button type="button" onClick={() => onChange(selected.filter((x) => x !== id))} className="text-muted-foreground hover:text-destructive" aria-label="Remove">
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap gap-1.5">
        {options
          .filter((o) => !selected.includes(o.id))
          .map((o) => (
            <button
              key={o.id}
              type="button"
              disabled={atCap}
              onClick={() => onChange([...selected, o.id])}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-border/60 font-sans text-xs text-foreground/80 hover:border-primary hover:text-primary disabled:opacity-40 disabled:hover:border-border/60 disabled:hover:text-foreground/80"
            >
              <Plus className="h-3 w-3" /> {o.name}
            </button>
          ))}
      </div>
      <p className="font-sans text-[11px] text-muted-foreground">
        {selected.length === 0
          ? "None picked. The first one you pick is the main category."
          : `${selected.length} / ${MAX_CATEGORIES}. The main one sets the badge and breadcrumb.`}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ activities */

function ActivityPicker({
  groups,
  selected,
  onChange,
}: {
  groups: ActivityFilterGroup[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const [search, setSearch] = useState("");
  const atCap = selected.length >= MAX_ACTIVITIES;
  const q = search.toLowerCase();
  const filtered = groups
    .map((g) => ({
      ...g,
      activities: g.activities.filter(
        (a) => !q || a.name.toLowerCase().includes(q) || a.aliases.some((x) => x.toLowerCase().includes(q)),
      ),
    }))
    .filter((g) => g.activities.length > 0);

  const toggle = (id: number) =>
    selected.includes(id) ? onChange(selected.filter((x) => x !== id)) : !atCap && onChange([...selected, id]);

  return (
    <div className="space-y-2" data-testid="attraction-form-activities">
      <div className="flex items-center justify-between">
        <span className="font-sans text-xs text-muted-foreground">
          {selected.length} / {MAX_ACTIVITIES} selected
        </span>
        {atCap && <span className="font-sans text-xs text-amber-500">Cap reached</span>}
      </div>
      <Input
        placeholder="Search by name or alias…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="bg-background border-border/60 font-sans text-xs h-8"
      />
      <div className="border border-border/40 rounded overflow-y-auto max-h-56 p-2 space-y-3">
        {filtered.length === 0 ? (
          <p className="font-sans text-xs text-muted-foreground text-center py-4">No activities found</p>
        ) : (
          filtered.map((g) => (
            <div key={g.groupSlug}>
              <p className="font-sans text-xs uppercase tracking-widest text-muted-foreground mb-1 pb-1 border-b border-border/20">
                {g.groupName}
              </p>
              <div className="space-y-1 mt-1">
                {g.activities.map((a) => {
                  const checked = selected.includes(a.id);
                  const disabled = !checked && atCap;
                  return (
                    <div key={a.id} className={cn("flex items-center gap-2 py-0.5", disabled && "opacity-40")}>
                      <Checkbox id={`act-${a.id}`} checked={checked} disabled={disabled} onCheckedChange={() => toggle(a.id)} />
                      <label htmlFor={`act-${a.id}`} className="font-sans text-xs text-foreground select-none cursor-pointer">
                        {a.name}
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

/* ----------------------------------------------------------------- steps */

/**
 * The two fixed steps are always there and cannot be removed or renamed;
 * custom steps follow and can be added, removed and reordered.
 */
function StepsEditor({ steps, onChange }: { steps: AttractionStep[]; onChange: (s: AttractionStep[]) => void }) {
  const update = (i: number, patch: Partial<AttractionStep>) =>
    onChange(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...steps];
    [next[i], next[i + d]] = [next[i + d]!, next[i]!];
    onChange(next);
  };
  const atCap = steps.length >= MAX_ATTRACTION_STEPS;

  return (
    <div className="space-y-3" data-testid="attraction-form-steps">
      <div className="flex items-center justify-between">
        <p className="font-sans text-xs uppercase tracking-widest text-muted-foreground">Steps</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={atCap}
          data-testid="add-step"
          onClick={() => onChange([...steps, { kind: "custom", title: "", description: "", images: [] }])}
          className="font-sans text-xs uppercase tracking-widest gap-1"
        >
          <Plus className="h-3 w-3" /> Add step
        </Button>
      </div>

      {steps.map((step, i) => {
        const fixed = step.kind !== "custom";
        return (
          <div key={i} className={cn("border rounded p-3 space-y-2", fixed ? "border-primary/30 bg-primary/5" : "border-border/40 bg-background/50")} data-testid={`step-editor-${i}`}>
            <div className="flex items-center justify-between gap-2">
              {fixed ? (
                <p className="font-sans text-xs font-medium text-foreground">
                  {step.title} <span className="text-muted-foreground font-normal">· required</span>
                </p>
              ) : (
                <Input
                  value={step.title}
                  onChange={(e) => update(i, { title: e.target.value })}
                  placeholder="Step heading, e.g. Best time to visit"
                  required
                  className="bg-background border-border/60 font-sans text-xs h-8"
                  data-testid={`step-${i}-title`}
                />
              )}
              {!fixed && (
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" disabled={i === 2} onClick={() => move(i, -1)} className="text-muted-foreground hover:text-foreground disabled:opacity-20" aria-label="Move up">
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button type="button" disabled={i === steps.length - 1} onClick={() => move(i, 1)} className="text-muted-foreground hover:text-foreground disabled:opacity-20" aria-label="Move down">
                    <ArrowDown className="h-3 w-3" />
                  </button>
                  <button type="button" onClick={() => onChange(steps.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive" aria-label="Remove step" data-testid={`remove-step-${i}`}>
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
            <Textarea
              value={step.description}
              onChange={(e) => update(i, { description: e.target.value })}
              placeholder={
                step.kind === "reach"
                  ? "Nearest airport, transfer time, road or boat access…"
                  : step.kind === "prepare"
                    ? "What to wear and bring, permits, fitness, best season…"
                    : "Details"
              }
              required
              rows={3}
              className="bg-background border-border/60 font-sans text-xs resize-y"
              data-testid={`step-${i}-description`}
            />
            <ImageGalleryUploadField
              label="Photos for this step (optional)"
              values={step.images}
              onChange={(images) => update(i, { images })}
              data-testid={`step-${i}-images`}
            />
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ new place */

/**
 * Inline "add a location", because an attraction cannot be saved without one
 * and there is nowhere else in the panel to add a place.
 */
function NewLocation({ onCreated, onCancel }: { onCreated: (id: number) => void; onCancel: () => void }) {
  const { data: countries } = useListCountries();
  const create = useCreateLocation();
  const [name, setName] = useState("");
  const [countryId, setCountryId] = useState("");
  const [newCountry, setNewCountry] = useState("");
  const [error, setError] = useState<string | null>(null);
  const addingCountry = countryId === "new";

  const save = () => {
    setError(null);
    if (!name.trim()) return setError("Type the place name.");
    if (!countryId) return setError("Pick its country.");
    if (addingCountry && !newCountry.trim()) return setError("Type the new country's name.");
    create.mutate(
      addingCountry ? { name, newCountryName: newCountry } : { name, countryId: Number(countryId) },
      { onSuccess: (r) => onCreated(r.id), onError: (e) => setError(e.message) },
    );
  };

  return (
    <div className="mt-2 border border-border/40 rounded p-3 space-y-2 bg-background/50" data-testid="new-location">
      <p className="font-sans text-xs text-foreground">New location</p>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Place name, e.g. Arusha" className="bg-background border-border/60 font-sans text-xs h-8" data-testid="new-location-name" />
      <Select value={countryId || "none"} onValueChange={(v) => v && setCountryId(v === "none" ? "" : v)}>
        <SelectTrigger className="bg-background border-border/60 font-sans text-xs h-8" data-testid="new-location-country">
          <SelectValue placeholder="Country" />
        </SelectTrigger>
        <SelectContent className="bg-card border-border">
          <SelectItem value="none">Country</SelectItem>
          {countries?.map((c) => (
            <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
          ))}
          <SelectItem value="new">+ A country not in this list</SelectItem>
        </SelectContent>
      </Select>
      {addingCountry && (
        <Input value={newCountry} onChange={(e) => setNewCountry(e.target.value)} placeholder="Country name" className="bg-background border-border/60 font-sans text-xs h-8" />
      )}
      {error && <p className="font-sans text-[11px] text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={save} disabled={create.isPending} className="font-sans text-[11px] uppercase tracking-widest h-7" data-testid="new-location-save">
          {create.isPending ? "Adding…" : "Add location"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} className="font-sans text-[11px] uppercase tracking-widest h-7">
          Cancel
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ form */

function AttractionForm({ attraction, onClose }: { attraction?: Attraction; onClose: () => void }) {
  const { toast } = useToast();
  const { data: categories } = useListCategories();
  const { data: locations } = useListLocations();
  const { data: activityGroups } = useListActivityFilters();
  const create = useCreateAttraction();
  const update = useUpdateAttraction();

  const [form, setForm] = useState({
    name: attraction?.name ?? "",
    summary: attraction?.summary ?? "",
    description: attraction?.description ?? "",
    coverImage: attraction?.coverImage ?? "",
    images: attraction?.images ?? ([] as string[]),
    locationId: attraction ? String(attraction.location.id) : "",
    classification: (attraction?.classification ?? "standard") as Classification,
    featured: attraction?.featured ?? false,
    visitDuration: attraction?.visitDuration ?? "",
    priceFrom: attraction?.priceFrom != null ? String(attraction.priceFrom) : "",
    hotelsAvailable: attraction?.hotelsAvailable ?? false,
    stayNote: attraction?.stayNote ?? "",
    isActive: attraction?.isActive ?? true,
    displayOrder: String(attraction?.displayOrder ?? 0),
  });
  const [steps, setSteps] = useState<AttractionStep[]>(attraction?.steps?.length ? attraction.steps : blankSteps());
  const [categoryIds, setCategoryIds] = useState<number[]>(attraction?.categories.map((c) => c.id) ?? []);
  const [activityIds, setActivityIds] = useState<number[]>(attraction?.activities.map((a) => a.id) ?? []);
  const [error, setError] = useState<string | null>(null);
  const [addingLocation, setAddingLocation] = useState(false);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const country = locations?.find((l) => String(l.id) === form.locationId)?.countryName;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.locationId) return setError("Pick a location.");
    if (!form.coverImage) return setError("Add a cover image.");

    const payload: AttractionInput = {
      name: form.name.trim(),
      summary: form.summary.trim() || null,
      description: form.description.trim(),
      coverImage: form.coverImage,
      images: form.images,
      locationId: Number(form.locationId),
      classification: form.classification,
      featured: form.featured,
      visitDuration: form.visitDuration.trim() || null,
      priceFrom: form.priceFrom.trim() === "" ? null : Number(form.priceFrom),
      hotelsAvailable: form.hotelsAvailable,
      stayNote: form.hotelsAvailable ? form.stayNote.trim() || null : null,
      steps: steps.map((s) => ({ ...s, title: s.title.trim(), description: s.description.trim() })),
      isActive: form.isActive,
      displayOrder: Number(form.displayOrder) || 0,
      categoryIds,
      activityIds,
    };

    const done = (label: string) => {
      toast({ title: label, description: `"${payload.name}" has been saved.` });
      onClose();
    };
    const fail = (err: Error) => setError(err.message);

    if (attraction) update.mutate({ id: attraction.id, data: payload }, { onSuccess: () => done("Attraction updated"), onError: fail });
    else create.mutate(payload, { onSuccess: () => done("Attraction created"), onError: fail });
  };

  const pending = create.isPending || update.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-1" data-testid="attraction-form">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelCls}>Name</label>
          <Input required value={form.name} onChange={(e) => set("name", e.target.value)} className={fieldCls} data-testid="attraction-form-name" />
        </div>

        <div className="col-span-2">
          <label className={labelCls}>Location</label>
          {/*
            An empty value is ignored: Radix Select reports "" when the chosen
            value is briefly missing from its options, which is exactly what
            happens between adding a location and the list refetching.
          */}
          <Select value={form.locationId || "none"} onValueChange={(v) => v && set("locationId", v === "none" ? "" : v)}>
            <SelectTrigger className={fieldCls} data-testid="attraction-form-location">
              <SelectValue placeholder="Pick a location" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="none">Pick a location</SelectItem>
              {locations?.map((l) => (
                <SelectItem key={l.id} value={String(l.id)}>
                  {l.name}
                  {l.countryName ? ` — ${l.countryName}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="font-sans text-[11px] text-muted-foreground mt-1">
            {form.locationId
              ? `Country: ${country ?? "not set on this location"}. It appears under every destination that includes this location or its country.`
              : "Not in the list? "}
            {!form.locationId && !addingLocation && (
              <button type="button" onClick={() => setAddingLocation(true)} className="text-primary hover:underline" data-testid="add-location-btn">
                Add a new location
              </button>
            )}
          </p>
          {addingLocation && (
            <NewLocation
              onCreated={(id) => {
                set("locationId", String(id));
                setAddingLocation(false);
              }}
              onCancel={() => setAddingLocation(false)}
            />
          )}
        </div>

        <div className="col-span-2">
          <label className={labelCls}>Summary (for cards)</label>
          <Input value={form.summary} maxLength={300} onChange={(e) => set("summary", e.target.value)} className={fieldCls} placeholder="One or two sentences" data-testid="attraction-form-summary" />
        </div>

        <div className="col-span-2">
          <label className={labelCls}>Description</label>
          <Textarea required rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} className={`${fieldCls} resize-y`} data-testid="attraction-form-description" />
        </div>

        <div className="col-span-2">
          <ImageUploadField label="Cover Image" value={form.coverImage} onChange={(url) => set("coverImage", url)} required data-testid="attraction-form-cover" />
        </div>
        <div className="col-span-2">
          <ImageGalleryUploadField label="More Images" values={form.images} onChange={(images) => set("images", images)} data-testid="attraction-form-images" />
        </div>

        <div>
          <label className={labelCls}>Visit duration</label>
          <Input value={form.visitDuration} maxLength={60} onChange={(e) => set("visitDuration", e.target.value)} className={fieldCls} placeholder="Half day" data-testid="attraction-form-duration" />
        </div>
        <div>
          <label className={labelCls}>Price from ($, optional)</label>
          <Input type="number" min={0} value={form.priceFrom} onChange={(e) => set("priceFrom", e.target.value)} className={fieldCls} placeholder="Leave empty to show no price" data-testid="attraction-form-price" />
        </div>

        <div>
          <label className={labelCls}>Classification</label>
          <Select value={form.classification} onValueChange={(v) => set("classification", v as Classification)}>
            <SelectTrigger className={fieldCls} data-testid="attraction-form-classification">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {CLASSIFICATION_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className={labelCls}>Display order</label>
          <Input type="number" value={form.displayOrder} onChange={(e) => set("displayOrder", e.target.value)} className={fieldCls} />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="featured" checked={form.featured} onCheckedChange={(v) => set("featured", !!v)} data-testid="attraction-form-featured" />
          <label htmlFor="featured" className="font-sans text-sm text-foreground cursor-pointer">Featured on the homepage</label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="active" checked={form.isActive} onCheckedChange={(v) => set("isActive", !!v)} data-testid="attraction-form-active" />
          <label htmlFor="active" className="font-sans text-sm text-foreground cursor-pointer">Visible on the site</label>
        </div>
      </div>

      <Separator className="bg-border/20" />

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox id="hotels" checked={form.hotelsAvailable} onCheckedChange={(v) => set("hotelsAvailable", !!v)} data-testid="attraction-form-hotels" />
          <label htmlFor="hotels" className="font-sans text-sm text-foreground cursor-pointer">Hotels available</label>
        </div>
        {form.hotelsAvailable && (
          <Input value={form.stayNote} maxLength={300} onChange={(e) => set("stayNote", e.target.value)} className={fieldCls} placeholder="Optional line, e.g. Lodges on the crater rim" data-testid="attraction-form-stay-note" />
        )}
      </div>

      <Separator className="bg-border/20" />
      <StepsEditor steps={steps} onChange={setSteps} />

      <Separator className="bg-border/20" />
      <div>
        <label className={labelCls}>Categories</label>
        <CategoryPicker options={categories ?? []} selected={categoryIds} onChange={setCategoryIds} />
      </div>

      <Separator className="bg-border/20" />
      <div>
        <label className={labelCls}>Activities</label>
        <ActivityPicker groups={activityGroups ?? []} selected={activityIds} onChange={setActivityIds} />
      </div>

      {error && (
        <p className="font-sans text-xs text-destructive border border-destructive/40 rounded p-2" role="alert" data-testid="attraction-form-error">
          {error}
        </p>
      )}

      <Separator className="bg-border/20" />
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={pending} className="flex-1 font-sans text-xs uppercase tracking-widest" data-testid="attraction-form-submit">
          {pending ? "Saving…" : attraction ? "Update Attraction" : "Create Attraction"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose} className="font-sans text-xs uppercase tracking-widest">
          Cancel
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ page */

export default function AdminAttractionsPage() {
  const { toast } = useToast();
  const { data: attractions, isLoading, isError, error } = useAdminAttractions();
  const remove = useDeleteAttraction();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Attraction | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Attraction | undefined>();
  const [filter, setFilter] = useState("");

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (attractions ?? []).filter(
      (a) => !q || a.name.toLowerCase().includes(q) || placeOf(a).toLowerCase().includes(q),
    );
  }, [attractions, filter]);

  const open = (a?: Attraction) => {
    setEditing(a);
    setSheetOpen(true);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    remove.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast({ title: "Attraction deleted", description: `"${deleteTarget.name}" has been removed.` });
        setDeleteTarget(undefined);
      },
      onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });
  };

  return (
    <AdminLayout>
      <div className="p-8" data-testid="admin-attractions">
        <div className="flex items-center justify-between mb-8 gap-4">
          <div>
            <p className="font-sans text-xs uppercase tracking-widest text-primary mb-1">Admin</p>
            <h1 className="font-serif text-3xl font-light text-foreground">Attractions</h1>
          </div>
          <div className="flex items-center gap-3">
            {(attractions?.length ?? 0) > 5 && (
              <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by name or place" className="h-9 w-56 bg-background border-border/60 font-sans text-xs" />
            )}
            <Button onClick={() => open()} className="font-sans text-xs uppercase tracking-widest gap-2" data-testid="create-attraction-btn">
              <Plus className="h-4 w-4" /> New Attraction
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded bg-card" />
            ))}
          </div>
        ) : isError ? (
          <p className="font-sans text-sm text-destructive">{error.message}</p>
        ) : !attractions?.length ? (
          <div className="text-center py-20 border border-dashed border-border/40 rounded">
            <p className="font-serif text-2xl font-light text-foreground mb-2">No attractions yet</p>
            <p className="font-sans text-sm text-muted-foreground mb-6">
              Add the first one. It needs a location, so set up the destination's places first if they are missing.
            </p>
            <Button onClick={() => open()} className="font-sans text-xs uppercase tracking-widest">Create Attraction</Button>
          </div>
        ) : (
          <div className="border border-border/40 rounded overflow-hidden">
            <table className="w-full" data-testid="attractions-table">
              <thead className="bg-card border-b border-border/40">
                <tr>
                  <th className="text-left p-4 font-sans text-xs uppercase tracking-widest text-muted-foreground">Name</th>
                  <th className="text-left p-4 font-sans text-xs uppercase tracking-widest text-muted-foreground hidden md:table-cell">Place</th>
                  <th className="text-left p-4 font-sans text-xs uppercase tracking-widest text-muted-foreground hidden lg:table-cell">Categories</th>
                  <th className="text-left p-4 font-sans text-xs uppercase tracking-widest text-muted-foreground">Status</th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody>
                {shown.map((a) => (
                  <tr key={a.id} className="border-b border-border/20 hover:bg-card/40 transition-colors" data-testid={`attraction-row-${a.id}`}>
                    <td className="p-4">
                      <p className="font-sans text-sm text-foreground">{a.name}</p>
                      {a.hotelsAvailable && <p className="font-sans text-[11px] text-muted-foreground">Hotels available</p>}
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      <p className="font-sans text-xs text-muted-foreground">{placeOf(a)}</p>
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      <p className="font-sans text-xs text-muted-foreground">{a.categories.map((c) => c.name).join(", ") || "—"}</p>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {!a.isActive && <Badge variant="outline" className="border-amber-500/60 text-amber-500 font-sans text-xs">Hidden</Badge>}
                        {a.featured && <Badge variant="outline" className="border-primary text-primary font-sans text-xs">Featured</Badge>}
                        {a.classification !== "standard" && (
                          <span className="font-sans text-xs text-muted-foreground capitalize">{a.classification}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 justify-end">
                        {a.isActive && (
                          <Link href={`/attractions/${a.slug}`} className="text-muted-foreground hover:text-foreground" aria-label="Open on the site">
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => open(a)} className="h-7 w-7 text-muted-foreground hover:text-foreground" data-testid={`edit-attraction-${a.id}`}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(a)} className="h-7 w-7 text-muted-foreground hover:text-destructive" data-testid={`delete-attraction-${a.id}`}>
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

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="bg-card border-border w-full max-w-xl overflow-y-auto" data-testid="attraction-sheet">
          <SheetHeader className="mb-6">
            <SheetTitle className="font-serif text-2xl font-light text-foreground">
              {editing ? "Edit Attraction" : "New Attraction"}
            </SheetTitle>
          </SheetHeader>
          {sheetOpen && <AttractionForm key={editing?.id ?? "new"} attraction={editing} onClose={() => setSheetOpen(false)} />}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(undefined)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-xl font-light text-foreground">Delete attraction</AlertDialogTitle>
            <AlertDialogDescription className="font-sans text-sm text-muted-foreground">
              Delete "{deleteTarget?.name}"? This cannot be undone. To take it off the site but keep it, edit it and untick "Visible on the site" instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-sans text-xs uppercase tracking-widest">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground font-sans text-xs uppercase tracking-widest hover:bg-destructive/90" data-testid="delete-attraction-confirm">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
