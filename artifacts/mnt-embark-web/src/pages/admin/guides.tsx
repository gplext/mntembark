/**
 * /admin/guides — write the editorial copy that appears on /guide.
 *
 * Guide copy has no existence apart from a tour, so this screen is a list of
 * tours rather than a list of guides: every tour is a row, and the row says
 * whether anyone has written it up yet. There is no "create" button, because
 * you cannot write a guide entry for a tour that does not exist.
 */

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListTours,
  useListAllTourGuides,
  useSetTourGuide,
  useDeleteTourGuide,
  getListAllTourGuidesQueryKey,
  getListTourGuidesQueryKey,
} from "@workspace/api-client-react";
import type { Tour, TourGuide } from "@workspace/api-client-react";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import { Input } from "@workspace/mnt-embark/components/ui/input";
import { Textarea } from "@workspace/mnt-embark/components/ui/textarea";
import { Switch } from "@workspace/mnt-embark/components/ui/switch";
import { Skeleton } from "@workspace/mnt-embark/components/ui/skeleton";
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
import { Pencil, Trash2 } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { apiErrorMessage } from "@/lib/api-error";

const fieldLabel =
  "font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1";
const fieldInput = "bg-background border-border/60 font-sans text-sm";

function GuideForm({
  tour,
  guide,
  onClose,
}: {
  tour: Tour;
  guide?: TourGuide;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const setGuide = useSetTourGuide();

  const [form, setForm] = useState({
    opener: guide?.opener ?? "",
    body: guide?.body ?? "",
    closer: guide?.closer ?? "",
    guideName: guide?.guideName ?? "",
    guideRole: guide?.guideRole ?? "",
    guideNote: guide?.guideNote ?? "",
    isPublished: guide?.isPublished ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGuide.mutate(
      {
        id: tour.id,
        data: {
          opener: form.opener.trim(),
          body: form.body.trim(),
          closer: form.closer.trim(),
          // Empty means absent, not an empty string — the public page decides
          // whether to show the credit block by whether there is a name.
          guideName: form.guideName.trim() || null,
          guideRole: form.guideRole.trim() || null,
          guideNote: form.guideNote.trim() || null,
          isPublished: form.isPublished,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListAllTourGuidesQueryKey(),
          });
          // The public page reads the other list; a save or delete changes it too.
          queryClient.invalidateQueries({
            queryKey: getListTourGuidesQueryKey(),
          });
          toast({ title: "Guide saved" });
          onClose();
        },
        onError: (err) =>
          toast({
            title: "Could not save guide",
            description: apiErrorMessage(err, "Please try again."),
            variant: "destructive",
          }),
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="guide-form">
      <div>
        <label className={fieldLabel}>Opening paragraph</label>
        <Textarea
          required
          value={form.opener}
          onChange={(e) => setForm({ ...form, opener: e.target.value })}
          rows={4}
          data-testid="guide-form-opener"
          className={`${fieldInput} resize-none`}
        />
      </div>
      <div>
        <label className={fieldLabel}>Middle paragraph</label>
        <Textarea
          required
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          rows={4}
          data-testid="guide-form-body"
          className={`${fieldInput} resize-none`}
        />
      </div>
      <div>
        <label className={fieldLabel}>Closing paragraph</label>
        <Textarea
          required
          value={form.closer}
          onChange={(e) => setForm({ ...form, closer: e.target.value })}
          rows={3}
          data-testid="guide-form-closer"
          className={`${fieldInput} resize-none`}
        />
        <p className="font-sans text-[11px] text-muted-foreground mt-1">
          Printed in italics as the sign-off.
        </p>
      </div>

      <div className="border-t border-border/40 pt-4 space-y-4">
        <p className="font-sans text-xs uppercase tracking-widest text-primary">
          Credited guide
        </p>
        <div>
          <label className={fieldLabel}>Name</label>
          <Input
            value={form.guideName}
            onChange={(e) => setForm({ ...form, guideName: e.target.value })}
            data-testid="guide-form-name"
            className={fieldInput}
          />
          <p className="font-sans text-[11px] text-muted-foreground mt-1">
            Leave empty to print the copy with no credit block.
          </p>
        </div>
        <div>
          <label className={fieldLabel}>Role</label>
          <Input
            value={form.guideRole}
            onChange={(e) => setForm({ ...form, guideRole: e.target.value })}
            placeholder="Lead guide"
            data-testid="guide-form-role"
            className={fieldInput}
          />
        </div>
        <div>
          <label className={fieldLabel}>Note</label>
          <Input
            value={form.guideNote}
            onChange={(e) => setForm({ ...form, guideNote: e.target.value })}
            placeholder="Twelve years in the High Atlas."
            data-testid="guide-form-note"
            className={fieldInput}
          />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border/40 pt-4">
        <div>
          <p className="font-sans text-sm text-foreground">Published</p>
          <p className="font-sans text-[11px] text-muted-foreground">
            Off keeps the draft here and shows the generated copy on the site.
          </p>
        </div>
        <Switch
          checked={form.isPublished}
          onCheckedChange={(v) => setForm({ ...form, isPublished: v })}
          data-testid="guide-form-published"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          disabled={setGuide.isPending}
          data-testid="guide-form-submit"
          className="flex-1 font-sans text-xs uppercase tracking-widest"
        >
          {setGuide.isPending ? "Saving..." : "Save"}
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

export default function AdminGuidesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: tours, isLoading: toursLoading } = useListTours();
  /*
   * One request for every entry rather than one per tour, and the admin
   * variant rather than /guides: that one omits unpublished drafts, which
   * would make a drafted tour read as "not written" and open its editor empty.
   */
  const { data: guides, isLoading: guidesLoading } = useListAllTourGuides();
  const deleteGuide = useDeleteTourGuide();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTour, setEditTour] = useState<Tour | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Tour | undefined>();

  const guideByTour = new Map((guides ?? []).map((g) => [g.tourId, g]));

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteGuide.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListAllTourGuidesQueryKey(),
          });
          // The public page reads the other list; a save or delete changes it too.
          queryClient.invalidateQueries({
            queryKey: getListTourGuidesQueryKey(),
          });
          toast({ title: "Guide copy removed" });
          setDeleteTarget(undefined);
        },
        onError: (err) =>
          toast({
            title: "Could not remove guide copy",
            description: apiErrorMessage(err, "Please try again."),
            variant: "destructive",
          }),
      },
    );
  };

  const isLoading = toursLoading || guidesLoading;

  return (
    <AdminLayout>
      <div className="p-8" data-testid="admin-guides">
        <div className="mb-8">
          <p className="font-sans text-xs uppercase tracking-widest text-primary mb-1">
            Admin
          </p>
          <h1 className="font-serif text-3xl font-light text-foreground">
            Guides
          </h1>
          <p className="font-sans text-sm text-muted-foreground mt-2 max-w-2xl">
            The editorial write-up shown for each tour on the Guide page. A tour
            with nothing written here still appears on the site using generated
            copy.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded bg-card" />
            ))}
          </div>
        ) : !tours || tours.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border/40 rounded">
            <p className="font-serif text-2xl font-light text-foreground mb-2">
              No Tours
            </p>
            <p className="font-sans text-sm text-muted-foreground">
              Guide copy is written per tour. Add a tour first.
            </p>
          </div>
        ) : (
          <div className="border border-border/40 rounded overflow-hidden">
            <table className="w-full" data-testid="guides-table">
              <thead className="bg-card border-b border-border/40">
                <tr>
                  <th className="text-left p-4 font-sans text-xs uppercase tracking-widest text-muted-foreground">
                    Tour
                  </th>
                  <th className="text-left p-4 font-sans text-xs uppercase tracking-widest text-muted-foreground hidden md:table-cell">
                    Guide
                  </th>
                  <th className="text-left p-4 font-sans text-xs uppercase tracking-widest text-muted-foreground">
                    Status
                  </th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody>
                {tours.map((tour) => {
                  const guide = guideByTour.get(tour.id);
                  return (
                    <tr
                      key={tour.id}
                      data-testid={`guide-row-${tour.id}`}
                      className="border-b border-border/20 hover:bg-card/40 transition-colors"
                    >
                      <td className="p-4">
                        <p className="font-sans text-sm text-foreground">
                          {tour.title}
                        </p>
                        <p className="font-sans text-xs text-muted-foreground">
                          {tour.location}
                        </p>
                      </td>
                      <td className="p-4 hidden md:table-cell font-sans text-xs text-muted-foreground">
                        {guide?.guideName ?? "—"}
                      </td>
                      <td className="p-4">
                        <span
                          className={
                            guide
                              ? "font-sans text-[11px] uppercase tracking-widest text-primary"
                              : "font-sans text-[11px] uppercase tracking-widest text-muted-foreground"
                          }
                        >
                          {guide ? "Written" : "Generated"}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`edit-guide-${tour.id}`}
                            onClick={() => {
                              setEditTour(tour);
                              setSheetOpen(true);
                            }}
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={!guide}
                            data-testid={`delete-guide-${tour.id}`}
                            onClick={() => setDeleteTarget(tour)}
                            className="h-7 w-7 text-muted-foreground hover:text-destructive disabled:opacity-30"
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

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="bg-card border-border w-full max-w-lg overflow-y-auto"
          data-testid="guide-sheet"
        >
          <SheetHeader className="mb-6">
            <SheetTitle className="font-serif text-2xl font-light text-foreground">
              {editTour?.title}
            </SheetTitle>
          </SheetHeader>
          {editTour && (
            <GuideForm
              key={editTour.id}
              tour={editTour}
              guide={guideByTour.get(editTour.id)}
              onClose={() => setSheetOpen(false)}
            />
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(undefined)}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-xl font-light text-foreground">
              Remove Guide Copy
            </AlertDialogTitle>
            <AlertDialogDescription className="font-sans text-sm text-muted-foreground">
              Discard the written copy for "{deleteTarget?.title}"? The tour goes
              back to generated text on the Guide page. To take it off the site
              without losing the writing, switch Published off instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-sans text-xs uppercase tracking-widest">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              data-testid="delete-guide-confirm"
              className="bg-destructive text-destructive-foreground font-sans text-xs uppercase tracking-widest"
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
