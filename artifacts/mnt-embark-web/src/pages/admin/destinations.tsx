import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListDestinations,
  useCreateDestination,
  useUpdateDestination,
  useDeleteDestination,
  getListDestinationsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import { Input } from "@workspace/mnt-embark/components/ui/input";
import { Textarea } from "@workspace/mnt-embark/components/ui/textarea";
import { Skeleton } from "@workspace/mnt-embark/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@workspace/mnt-embark/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@workspace/mnt-embark/components/ui/alert-dialog";
import { useToast } from "@workspace/mnt-embark/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { ImageUploadField } from "@/components/ImageUploadField";
import type { Destination } from "@workspace/api-client-react";

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

  const [form, setForm] = useState({
    name: destination?.name ?? "",
    country: destination?.country ?? "",
    region: destination?.region ?? "",
    description: destination?.description ?? "",
    coverImage: destination?.coverImage ?? "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      country: form.country,
      region: form.region || undefined,
      description: form.description,
      coverImage: form.coverImage,
    };

    if (destination) {
      updateDestination.mutate(
        { id: destination.id, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListDestinationsQueryKey() });
            toast({ title: "Destination Updated" });
            onClose();
          },
          onError: () => toast({ title: "Error", description: "Failed to update.", variant: "destructive" }),
        }
      );
    } else {
      createDestination.mutate(
        { data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListDestinationsQueryKey() });
            toast({ title: "Destination Created" });
            onClose();
          },
          onError: () => toast({ title: "Error", description: "Failed to create.", variant: "destructive" }),
        }
      );
    }
  };

  const isPending = createDestination.isPending || updateDestination.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="destination-form">
      <div>
        <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">Name</label>
        <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="dest-form-name" className="bg-background border-border/60 font-sans text-sm" />
      </div>
      <div>
        <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">Country</label>
        <Input required value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} data-testid="dest-form-country" className="bg-background border-border/60 font-sans text-sm" />
      </div>
      <div>
        <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">Region (Optional)</label>
        <Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} data-testid="dest-form-region" className="bg-background border-border/60 font-sans text-sm" />
      </div>
      <div>
        <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">Description</label>
        <Textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="dest-form-description" rows={3} className="bg-background border-border/60 font-sans text-sm resize-none" />
      </div>
      <ImageUploadField
        label="Cover Image"
        value={form.coverImage}
        onChange={(url) => setForm({ ...form, coverImage: url })}
        required
        data-testid="dest-form-cover"
      />
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending} data-testid="dest-form-submit" className="flex-1 font-sans text-xs uppercase tracking-widest">
          {isPending ? "Saving..." : destination ? "Update" : "Create"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose} data-testid="dest-form-cancel" className="font-sans text-xs uppercase tracking-widest">Cancel</Button>
      </div>
    </form>
  );
}

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
      }
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
                  <th className="text-left p-4 font-sans text-xs uppercase tracking-widest text-muted-foreground hidden md:table-cell">Country</th>
                  <th className="text-left p-4 font-sans text-xs uppercase tracking-widest text-muted-foreground hidden md:table-cell">Region</th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody>
                {destinations.map((dest) => (
                  <tr key={dest.id} data-testid={`dest-row-${dest.id}`} className="border-b border-border/20 hover:bg-card/40 transition-colors">
                    <td className="p-4"><p className="font-sans text-sm text-foreground">{dest.name}</p></td>
                    <td className="p-4 hidden md:table-cell"><p className="font-sans text-xs text-muted-foreground">{dest.country}</p></td>
                    <td className="p-4 hidden md:table-cell"><p className="font-sans text-xs text-muted-foreground">{dest.region ?? "—"}</p></td>
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
