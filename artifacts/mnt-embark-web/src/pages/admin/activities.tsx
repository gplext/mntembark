/**
 * /admin/activities — manage the activity taxonomy.
 *
 * Two tables on one screen because the two things are one subject: an activity
 * cannot exist without a group, and the first thing you do after adding a group
 * is put activities in it. Splitting them across two pages would mean leaving
 * the screen to finish a single thought.
 */

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListActivityGroups,
  useCreateActivityGroup,
  useUpdateActivityGroup,
  useDeleteActivityGroup,
  getListActivityGroupsQueryKey,
  useListAllActivities,
  useCreateActivity,
  useUpdateActivity,
  useDeleteActivity,
  getListAllActivitiesQueryKey,
  getListActivityFiltersQueryKey,
} from "@workspace/api-client-react";
import type {
  AdminActivity,
  AdminActivityGroup,
} from "@workspace/api-client-react";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import { Input } from "@workspace/mnt-embark/components/ui/input";
import { Textarea } from "@workspace/mnt-embark/components/ui/textarea";
import { Switch } from "@workspace/mnt-embark/components/ui/switch";
import { Skeleton } from "@workspace/mnt-embark/components/ui/skeleton";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/mnt-embark/components/ui/alert-dialog";
import { useToast } from "@workspace/mnt-embark/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { ImageUploadField } from "@/components/ImageUploadField";
import { apiErrorMessage } from "@/lib/api-error";

/**
 * Turns a display name into a URL slug so nobody has to type one twice.
 *
 * Only ever used to prefill a slug that is still empty or still matches the old
 * name — a slug that has been live is an address, and silently rewriting it
 * when someone fixes a typo in the name would break every link to it.
 */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const fieldLabel =
  "font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1";
const fieldInput = "bg-background border-border/60 font-sans text-sm";

/* ── Group form ────────────────────────────────────────────────────────────── */

function GroupForm({
  group,
  onClose,
}: {
  group?: AdminActivityGroup;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createGroup = useCreateActivityGroup();
  const updateGroup = useUpdateActivityGroup();

  const [form, setForm] = useState({
    slug: group?.slug ?? "",
    name: group?.name ?? "",
    description: group?.description ?? "",
    icon: group?.icon ?? "",
    coverImage: group?.coverImage ?? "",
    selectionMode: (group?.selectionMode ?? "multiple") as
      | "single"
      | "multiple",
    displayOrder: group?.displayOrder ?? 0,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getListActivityGroupsQueryKey() });
    // The public filter sidebar is built from groups too, so it goes stale the
    // moment one is renamed or reordered.
    queryClient.invalidateQueries({ queryKey: getListActivityFiltersQueryKey() });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      slug: form.slug.trim(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      icon: form.icon.trim() || null,
      coverImage: form.coverImage.trim() || null,
      selectionMode: form.selectionMode,
      displayOrder: Number(form.displayOrder) || 0,
    };

    const onError = (err: unknown) =>
      toast({
        title: "Could not save group",
        description: apiErrorMessage(err, "Please try again."),
        variant: "destructive",
      });

    if (group) {
      updateGroup.mutate(
        { id: group.id, data },
        {
          onSuccess: () => {
            refresh();
            toast({ title: "Group updated" });
            onClose();
          },
          onError,
        },
      );
    } else {
      createGroup.mutate(
        { data },
        {
          onSuccess: () => {
            refresh();
            toast({ title: "Group created" });
            onClose();
          },
          onError,
        },
      );
    }
  };

  const isPending = createGroup.isPending || updateGroup.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="group-form">
      <div>
        <label className={fieldLabel}>Name</label>
        <Input
          required
          value={form.name}
          onChange={(e) => {
            const name = e.target.value;
            setForm((f) => ({
              ...f,
              name,
              // Track the name only while the slug has never been saved.
              slug: group ? f.slug : slugify(name),
            }));
          }}
          data-testid="group-form-name"
          className={fieldInput}
        />
      </div>
      <div>
        <label className={fieldLabel}>Slug</label>
        <Input
          required
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
          data-testid="group-form-slug"
          className={fieldInput}
        />
        <p className="font-sans text-[11px] text-muted-foreground mt-1">
          Lowercase and hyphens. Used in URLs — changing it on a live group
          breaks existing links.
        </p>
      </div>
      <div>
        <label className={fieldLabel}>Description</label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={2}
          data-testid="group-form-description"
          className={`${fieldInput} resize-none`}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={fieldLabel}>Icon</label>
          <Input
            value={form.icon}
            onChange={(e) => setForm({ ...form, icon: e.target.value })}
            placeholder="waves"
            data-testid="group-form-icon"
            className={fieldInput}
          />
        </div>
        <div>
          <label className={fieldLabel}>Order</label>
          <Input
            type="number"
            value={form.displayOrder}
            onChange={(e) =>
              setForm({ ...form, displayOrder: Number(e.target.value) })
            }
            data-testid="group-form-order"
            className={fieldInput}
          />
        </div>
      </div>
      <div>
        <label className={fieldLabel}>Selection</label>
        <Select
          value={form.selectionMode}
          onValueChange={(v) =>
            setForm({
              ...form,
              selectionMode: v as "single" | "multiple",
            })
          }
        >
          <SelectTrigger
            className={`${fieldInput} h-9`}
            data-testid="group-form-selection"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="multiple">Multiple — checkboxes</SelectItem>
            <SelectItem value="single">Single — radio buttons</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <ImageUploadField
        label="Cover Image"
        value={form.coverImage}
        onChange={(url) => setForm({ ...form, coverImage: url })}
        data-testid="group-form-cover"
      />
      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          disabled={isPending}
          data-testid="group-form-submit"
          className="flex-1 font-sans text-xs uppercase tracking-widest"
        >
          {isPending ? "Saving..." : group ? "Update" : "Create"}
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

/* ── Activity form ─────────────────────────────────────────────────────────── */

function ActivityForm({
  activity,
  groups,
  onClose,
}: {
  activity?: AdminActivity;
  groups: AdminActivityGroup[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();

  const [form, setForm] = useState({
    groupId: activity?.groupId ?? groups[0]?.id ?? 0,
    slug: activity?.slug ?? "",
    name: activity?.name ?? "",
    description: activity?.description ?? "",
    coverImage: activity?.coverImage ?? "",
    icon: activity?.icon ?? "",
    aliases: (activity?.aliases ?? []).join(", "),
    isFilterable: activity?.isFilterable ?? true,
    isIndexable: activity?.isIndexable ?? false,
    displayOrder: activity?.displayOrder ?? 0,
  });

  // Mirrors the server's rule so the switch explains itself before a save is
  // attempted, rather than the save coming back rejected.
  const canIndex =
    Boolean(form.description.trim()) && Boolean(form.coverImage.trim());

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getListAllActivitiesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListActivityGroupsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListActivityFiltersQueryKey() });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      groupId: Number(form.groupId),
      slug: form.slug.trim(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      coverImage: form.coverImage.trim() || null,
      icon: form.icon.trim() || null,
      aliases: form.aliases
        .split(",")
        .map((a) => slugify(a))
        .filter(Boolean),
      isFilterable: form.isFilterable,
      isIndexable: form.isIndexable && canIndex,
      displayOrder: Number(form.displayOrder) || 0,
    };

    const onError = (err: unknown) =>
      toast({
        title: "Could not save activity",
        description: apiErrorMessage(err, "Please try again."),
        variant: "destructive",
      });

    if (activity) {
      updateActivity.mutate(
        { id: activity.id, data },
        {
          onSuccess: () => {
            refresh();
            toast({ title: "Activity updated" });
            onClose();
          },
          onError,
        },
      );
    } else {
      createActivity.mutate(
        { data },
        {
          onSuccess: () => {
            refresh();
            toast({ title: "Activity created" });
            onClose();
          },
          onError,
        },
      );
    }
  };

  const isPending = createActivity.isPending || updateActivity.isPending;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      data-testid="activity-form"
    >
      <div>
        <label className={fieldLabel}>Group</label>
        <Select
          value={String(form.groupId)}
          onValueChange={(v) => setForm({ ...form, groupId: Number(v) })}
        >
          <SelectTrigger
            className={`${fieldInput} h-9`}
            data-testid="activity-form-group"
          >
            <SelectValue placeholder="Choose a group" />
          </SelectTrigger>
          <SelectContent>
            {groups.map((g) => (
              <SelectItem key={g.id} value={String(g.id)}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className={fieldLabel}>Name</label>
        <Input
          required
          value={form.name}
          onChange={(e) => {
            const name = e.target.value;
            setForm((f) => ({
              ...f,
              name,
              slug: activity ? f.slug : slugify(name),
            }));
          }}
          data-testid="activity-form-name"
          className={fieldInput}
        />
      </div>
      <div>
        <label className={fieldLabel}>Slug</label>
        <Input
          required
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
          data-testid="activity-form-slug"
          className={fieldInput}
        />
      </div>
      <div>
        <label className={fieldLabel}>Description</label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={4}
          data-testid="activity-form-description"
          className={`${fieldInput} resize-none`}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={fieldLabel}>Icon</label>
          <Input
            value={form.icon}
            onChange={(e) => setForm({ ...form, icon: e.target.value })}
            placeholder="waves"
            data-testid="activity-form-icon"
            className={fieldInput}
          />
        </div>
        <div>
          <label className={fieldLabel}>Order</label>
          <Input
            type="number"
            value={form.displayOrder}
            onChange={(e) =>
              setForm({ ...form, displayOrder: Number(e.target.value) })
            }
            data-testid="activity-form-order"
            className={fieldInput}
          />
        </div>
      </div>
      <div>
        <label className={fieldLabel}>Aliases</label>
        <Input
          value={form.aliases}
          onChange={(e) => setForm({ ...form, aliases: e.target.value })}
          placeholder="bike, biking"
          data-testid="activity-form-aliases"
          className={fieldInput}
        />
        <p className="font-sans text-[11px] text-muted-foreground mt-1">
          Comma separated. Other words that mean this activity, so searching for
          them finds it instead of creating a duplicate.
        </p>
      </div>
      <ImageUploadField
        label="Cover Image"
        value={form.coverImage}
        onChange={(url) => setForm({ ...form, coverImage: url })}
        data-testid="activity-form-cover"
      />

      <div className="flex items-center justify-between border-t border-border/40 pt-4">
        <div>
          <p className="font-sans text-sm text-foreground">Show in filters</p>
          <p className="font-sans text-[11px] text-muted-foreground">
            Appears as a checkbox on the tours page.
          </p>
        </div>
        <Switch
          checked={form.isFilterable}
          onCheckedChange={(v) => setForm({ ...form, isFilterable: v })}
          data-testid="activity-form-filterable"
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="font-sans text-sm text-foreground">
            Allow search engines
          </p>
          <p className="font-sans text-[11px] text-muted-foreground">
            {canIndex
              ? "Its landing page may be indexed."
              : "Needs a description and a cover image first."}
          </p>
        </div>
        <Switch
          checked={form.isIndexable && canIndex}
          disabled={!canIndex}
          onCheckedChange={(v) => setForm({ ...form, isIndexable: v })}
          data-testid="activity-form-indexable"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          disabled={isPending || !form.groupId}
          data-testid="activity-form-submit"
          className="flex-1 font-sans text-xs uppercase tracking-widest"
        >
          {isPending ? "Saving..." : activity ? "Update" : "Create"}
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

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function AdminActivitiesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: groups, isLoading: groupsLoading } = useListActivityGroups();
  const { data: activities, isLoading: activitiesLoading } =
    useListAllActivities();
  const deleteGroup = useDeleteActivityGroup();
  const deleteActivity = useDeleteActivity();

  const [groupSheet, setGroupSheet] = useState(false);
  const [editGroup, setEditGroup] = useState<AdminActivityGroup | undefined>();
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<
    AdminActivityGroup | undefined
  >();

  const [activitySheet, setActivitySheet] = useState(false);
  const [editActivity, setEditActivity] = useState<AdminActivity | undefined>();
  const [deleteActivityTarget, setDeleteActivityTarget] = useState<
    AdminActivity | undefined
  >();

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: getListActivityGroupsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListAllActivitiesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListActivityFiltersQueryKey() });
  };

  const confirmDeleteGroup = () => {
    if (!deleteGroupTarget) return;
    deleteGroup.mutate(
      { id: deleteGroupTarget.id },
      {
        onSuccess: () => {
          refreshAll();
          toast({ title: "Group deleted" });
          setDeleteGroupTarget(undefined);
        },
        onError: (err) =>
          toast({
            title: "Could not delete group",
            description: apiErrorMessage(err, "Please try again."),
            variant: "destructive",
          }),
      },
    );
  };

  const confirmDeleteActivity = () => {
    if (!deleteActivityTarget) return;
    deleteActivity.mutate(
      { id: deleteActivityTarget.id },
      {
        onSuccess: () => {
          refreshAll();
          toast({ title: "Activity deleted" });
          setDeleteActivityTarget(undefined);
        },
        onError: (err) =>
          toast({
            title: "Could not delete activity",
            description: apiErrorMessage(err, "Please try again."),
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <AdminLayout>
      <div className="p-8" data-testid="admin-activities">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="font-sans text-xs uppercase tracking-widest text-primary mb-1">
              Admin
            </p>
            <h1 className="font-serif text-3xl font-light text-foreground">
              Activities
            </h1>
          </div>
        </div>

        {/* ── Groups ────────────────────────────────────────────────────── */}
        <section className="mb-12">
          <div className="flex items-end justify-between mb-3">
            <div>
              <h2 className="font-serif text-xl font-light text-foreground">
                Groups
              </h2>
              <p className="font-sans text-xs text-muted-foreground">
                The sections activities are filed under.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setEditGroup(undefined);
                setGroupSheet(true);
              }}
              data-testid="create-group-btn"
              className="font-sans text-xs uppercase tracking-widest gap-2"
            >
              <Plus className="h-4 w-4" /> New Group
            </Button>
          </div>

          {groupsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded bg-card" />
              ))}
            </div>
          ) : (
            <div className="border border-border/40 rounded overflow-hidden">
              <table className="w-full" data-testid="groups-table">
                <thead className="bg-card border-b border-border/40">
                  <tr>
                    <th className="text-left p-3 font-sans text-xs uppercase tracking-widest text-muted-foreground">
                      Name
                    </th>
                    <th className="text-left p-3 font-sans text-xs uppercase tracking-widest text-muted-foreground hidden md:table-cell">
                      Slug
                    </th>
                    <th className="text-left p-3 font-sans text-xs uppercase tracking-widest text-muted-foreground">
                      Activities
                    </th>
                    <th className="text-left p-3 font-sans text-xs uppercase tracking-widest text-muted-foreground hidden md:table-cell">
                      Order
                    </th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {(groups ?? []).map((g) => (
                    <tr
                      key={g.id}
                      data-testid={`group-row-${g.id}`}
                      className="border-b border-border/20 hover:bg-card/40 transition-colors"
                    >
                      <td className="p-3 font-sans text-sm text-foreground">
                        {g.name}
                      </td>
                      <td className="p-3 font-sans text-xs text-muted-foreground hidden md:table-cell">
                        {g.slug}
                      </td>
                      <td className="p-3 font-sans text-xs text-muted-foreground">
                        {g.activityCount}
                      </td>
                      <td className="p-3 font-sans text-xs text-muted-foreground hidden md:table-cell">
                        {g.displayOrder}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`edit-group-${g.id}`}
                            onClick={() => {
                              setEditGroup(g);
                              setGroupSheet(true);
                            }}
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`delete-group-${g.id}`}
                            onClick={() => setDeleteGroupTarget(g)}
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
        </section>

        {/* ── Activities ────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-end justify-between mb-3">
            <div>
              <h2 className="font-serif text-xl font-light text-foreground">
                Activities
              </h2>
              <p className="font-sans text-xs text-muted-foreground">
                What guests actually do on a tour.
              </p>
            </div>
            <Button
              onClick={() => {
                setEditActivity(undefined);
                setActivitySheet(true);
              }}
              disabled={!groups || groups.length === 0}
              data-testid="create-activity-btn"
              className="font-sans text-xs uppercase tracking-widest gap-2"
            >
              <Plus className="h-4 w-4" /> New Activity
            </Button>
          </div>

          {activitiesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded bg-card" />
              ))}
            </div>
          ) : !activities || activities.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-border/40 rounded">
              <p className="font-serif text-2xl font-light text-foreground mb-2">
                No Activities
              </p>
              <p className="font-sans text-sm text-muted-foreground">
                {groups && groups.length > 0
                  ? "Add your first activity."
                  : "Create a group first — every activity belongs to one."}
              </p>
            </div>
          ) : (
            <div className="border border-border/40 rounded overflow-hidden">
              <table className="w-full" data-testid="activities-table">
                <thead className="bg-card border-b border-border/40">
                  <tr>
                    <th className="text-left p-3 font-sans text-xs uppercase tracking-widest text-muted-foreground">
                      Name
                    </th>
                    <th className="text-left p-3 font-sans text-xs uppercase tracking-widest text-muted-foreground">
                      Group
                    </th>
                    <th className="text-left p-3 font-sans text-xs uppercase tracking-widest text-muted-foreground hidden lg:table-cell">
                      Slug
                    </th>
                    <th className="text-left p-3 font-sans text-xs uppercase tracking-widest text-muted-foreground">
                      Tours
                    </th>
                    <th className="text-left p-3 font-sans text-xs uppercase tracking-widest text-muted-foreground hidden md:table-cell">
                      Visibility
                    </th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {activities.map((a) => (
                    <tr
                      key={a.id}
                      data-testid={`activity-row-${a.id}`}
                      className="border-b border-border/20 hover:bg-card/40 transition-colors"
                    >
                      <td className="p-3 font-sans text-sm text-foreground">
                        {a.name}
                      </td>
                      <td className="p-3 font-sans text-xs text-muted-foreground">
                        {a.groupName}
                      </td>
                      <td className="p-3 font-sans text-xs text-muted-foreground hidden lg:table-cell">
                        {a.slug}
                      </td>
                      <td className="p-3 font-sans text-xs text-muted-foreground">
                        {a.tourCount}
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        <span className="font-sans text-[11px] text-muted-foreground">
                          {a.isFilterable ? "In filters" : "Hidden"}
                          {a.isIndexable ? " · Indexed" : ""}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`edit-activity-${a.id}`}
                            onClick={() => {
                              setEditActivity(a);
                              setActivitySheet(true);
                            }}
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`delete-activity-${a.id}`}
                            onClick={() => setDeleteActivityTarget(a)}
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
        </section>
      </div>

      <Sheet open={groupSheet} onOpenChange={setGroupSheet}>
        <SheetContent
          side="right"
          className="bg-card border-border w-full max-w-md overflow-y-auto"
          data-testid="group-sheet"
        >
          <SheetHeader className="mb-6">
            <SheetTitle className="font-serif text-2xl font-light text-foreground">
              {editGroup ? "Edit Group" : "New Group"}
            </SheetTitle>
          </SheetHeader>
          {/* Remount per target so the form state starts from the right row. */}
          <GroupForm
            key={editGroup?.id ?? "new"}
            group={editGroup}
            onClose={() => setGroupSheet(false)}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={activitySheet} onOpenChange={setActivitySheet}>
        <SheetContent
          side="right"
          className="bg-card border-border w-full max-w-md overflow-y-auto"
          data-testid="activity-sheet"
        >
          <SheetHeader className="mb-6">
            <SheetTitle className="font-serif text-2xl font-light text-foreground">
              {editActivity ? "Edit Activity" : "New Activity"}
            </SheetTitle>
          </SheetHeader>
          <ActivityForm
            key={editActivity?.id ?? "new"}
            activity={editActivity}
            groups={groups ?? []}
            onClose={() => setActivitySheet(false)}
          />
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={!!deleteGroupTarget}
        onOpenChange={(o) => !o && setDeleteGroupTarget(undefined)}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-xl font-light text-foreground">
              Delete Group
            </AlertDialogTitle>
            <AlertDialogDescription className="font-sans text-sm text-muted-foreground">
              Delete "{deleteGroupTarget?.name}"? A group holding activities
              cannot be deleted until they are moved or removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-sans text-xs uppercase tracking-widest">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteGroup}
              data-testid="delete-group-confirm"
              className="bg-destructive text-destructive-foreground font-sans text-xs uppercase tracking-widest"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteActivityTarget}
        onOpenChange={(o) => !o && setDeleteActivityTarget(undefined)}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-xl font-light text-foreground">
              Delete Activity
            </AlertDialogTitle>
            <AlertDialogDescription className="font-sans text-sm text-muted-foreground">
              Delete "{deleteActivityTarget?.name}"?
              {deleteActivityTarget && deleteActivityTarget.tourCount > 0
                ? ` It is currently on ${deleteActivityTarget.tourCount} ${
                    deleteActivityTarget.tourCount === 1 ? "tour" : "tours"
                  } and cannot be deleted until it is removed from them.`
                : " This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-sans text-xs uppercase tracking-widest">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteActivity}
              data-testid="delete-activity-confirm"
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
