import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListJournalEntries,
  useCreateJournalEntry,
  useUpdateJournalEntry,
  useDeleteJournalEntry,
  getListJournalEntriesQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import { Input } from "@workspace/mnt-embark/components/ui/input";
import { Textarea } from "@workspace/mnt-embark/components/ui/textarea";
import { Skeleton } from "@workspace/mnt-embark/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@workspace/mnt-embark/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@workspace/mnt-embark/components/ui/alert-dialog";
import { useToast } from "@workspace/mnt-embark/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import AdminLayout from "@/components/AdminLayout";
import { ImageUploadField, ImageGalleryUploadField } from "@/components/ImageUploadField";
import type { JournalEntry } from "@workspace/api-client-react";

function JournalForm({ entry, onClose }: { entry?: JournalEntry; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createEntry = useCreateJournalEntry();
  const updateEntry = useUpdateJournalEntry();

  const [form, setForm] = useState({
    title: entry?.title ?? "",
    excerpt: entry?.excerpt ?? "",
    content: entry?.content ?? "",
    coverImage: entry?.coverImage ?? "",
    images: entry?.images ?? [],
    location: entry?.location ?? "",
    author: entry?.author ?? "",
    publishedAt: entry?.publishedAt ? entry.publishedAt.split("T")[0] : new Date().toISOString().split("T")[0],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: form.title,
      excerpt: form.excerpt,
      content: form.content,
      coverImage: form.coverImage,
      images: form.images,
      location: form.location,
      author: form.author,
      publishedAt: new Date(form.publishedAt).toISOString(),
    };

    if (entry) {
      updateEntry.mutate(
        { id: entry.id, data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListJournalEntriesQueryKey() });
            toast({ title: "Journal Updated" });
            onClose();
          },
          onError: () => toast({ title: "Error", variant: "destructive" }),
        }
      );
    } else {
      createEntry.mutate(
        { data: payload },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListJournalEntriesQueryKey() });
            toast({ title: "Journal Created" });
            onClose();
          },
          onError: () => toast({ title: "Error", variant: "destructive" }),
        }
      );
    }
  };

  const isPending = createEntry.isPending || updateEntry.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="journal-form">
      <div>
        <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">Title</label>
        <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="journal-form-title" className="bg-background border-border/60 font-sans text-sm" />
      </div>
      <div>
        <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">Excerpt</label>
        <Textarea required value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} data-testid="journal-form-excerpt" rows={2} className="bg-background border-border/60 font-sans text-sm resize-none" />
      </div>
      <div>
        <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">Content</label>
        <Textarea required value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} data-testid="journal-form-content" rows={6} className="bg-background border-border/60 font-sans text-sm resize-none" />
      </div>
      <ImageUploadField
        label="Cover Image"
        value={form.coverImage}
        onChange={(url) => setForm({ ...form, coverImage: url })}
        required
        data-testid="journal-form-cover"
      />
      <ImageGalleryUploadField
        label="Additional Images"
        values={form.images}
        onChange={(images) => setForm({ ...form, images })}
        data-testid="journal-form-images"
      />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">Location</label>
          <Input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} data-testid="journal-form-location" className="bg-background border-border/60 font-sans text-sm" />
        </div>
        <div>
          <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">Author</label>
          <Input required value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} data-testid="journal-form-author" className="bg-background border-border/60 font-sans text-sm" />
        </div>
      </div>
      <div>
        <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">Published At</label>
        <Input type="date" value={form.publishedAt} onChange={(e) => setForm({ ...form, publishedAt: e.target.value })} data-testid="journal-form-published" className="bg-background border-border/60 font-sans text-sm" />
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending} data-testid="journal-form-submit" className="flex-1 font-sans text-xs uppercase tracking-widest">
          {isPending ? "Saving..." : entry ? "Update" : "Create"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose} data-testid="journal-form-cancel" className="font-sans text-xs uppercase tracking-widest">Cancel</Button>
      </div>
    </form>
  );
}

export default function AdminJournalsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: journals, isLoading } = useListJournalEntries();
  const deleteEntry = useDeleteJournalEntry();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<JournalEntry | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<JournalEntry | undefined>();

  const openCreate = () => { setEditEntry(undefined); setSheetOpen(true); };
  const openEdit = (j: JournalEntry) => { setEditEntry(j); setSheetOpen(true); };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteEntry.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListJournalEntriesQueryKey() });
          toast({ title: "Journal Deleted" });
          setDeleteTarget(undefined);
        },
        onError: () => toast({ title: "Error", variant: "destructive" }),
      }
    );
  };

  return (
    <AdminLayout>
      <div className="p-8" data-testid="admin-journals">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="font-sans text-xs uppercase tracking-widest text-primary mb-1">Admin</p>
            <h1 className="font-serif text-3xl font-light text-foreground">Journal Entries</h1>
          </div>
          <Button onClick={openCreate} data-testid="create-journal-btn" className="font-sans text-xs uppercase tracking-widest gap-2">
            <Plus className="h-4 w-4" /> New Entry
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded bg-card" />)}</div>
        ) : !journals || journals.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border/40 rounded">
            <p className="font-serif text-2xl font-light text-foreground mb-2">No Journal Entries</p>
            <p className="font-sans text-sm text-muted-foreground mb-6">Create your first journal entry.</p>
            <Button onClick={openCreate} data-testid="create-journal-empty" className="font-sans text-xs uppercase tracking-widest">Create Entry</Button>
          </div>
        ) : (
          <div className="border border-border/40 rounded overflow-hidden">
            <table className="w-full" data-testid="journals-table">
              <thead className="bg-card border-b border-border/40">
                <tr>
                  <th className="text-left p-4 font-sans text-xs uppercase tracking-widest text-muted-foreground">Title</th>
                  <th className="text-left p-4 font-sans text-xs uppercase tracking-widest text-muted-foreground hidden md:table-cell">Author</th>
                  <th className="text-left p-4 font-sans text-xs uppercase tracking-widest text-muted-foreground hidden md:table-cell">Location</th>
                  <th className="text-left p-4 font-sans text-xs uppercase tracking-widest text-muted-foreground hidden md:table-cell">Published</th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody>
                {journals.map((journal) => (
                  <tr key={journal.id} data-testid={`journal-row-admin-${journal.id}`} className="border-b border-border/20 hover:bg-card/40 transition-colors">
                    <td className="p-4"><p className="font-sans text-sm text-foreground">{journal.title}</p></td>
                    <td className="p-4 hidden md:table-cell"><p className="font-sans text-xs text-muted-foreground">{journal.author}</p></td>
                    <td className="p-4 hidden md:table-cell"><p className="font-sans text-xs text-muted-foreground">{journal.location}</p></td>
                    <td className="p-4 hidden md:table-cell"><p className="font-sans text-xs text-muted-foreground">{format(new Date(journal.publishedAt), "MMM d, yyyy")}</p></td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 justify-end">
                        <Button variant="ghost" size="icon" data-testid={`edit-journal-${journal.id}`} onClick={() => openEdit(journal)} className="h-7 w-7 text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" data-testid={`delete-journal-${journal.id}`} onClick={() => setDeleteTarget(journal)} className="h-7 w-7 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
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
        <SheetContent side="right" className="bg-card border-border w-full max-w-xl overflow-y-auto" data-testid="journal-sheet">
          <SheetHeader className="mb-6">
            <SheetTitle className="font-serif text-2xl font-light text-foreground">{editEntry ? "Edit Journal Entry" : "New Journal Entry"}</SheetTitle>
          </SheetHeader>
          <JournalForm entry={editEntry} onClose={() => setSheetOpen(false)} />
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(undefined)}>
        <AlertDialogContent className="bg-card border-border" data-testid="delete-journal-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-xl font-light text-foreground">Delete Journal Entry</AlertDialogTitle>
            <AlertDialogDescription className="font-sans text-sm text-muted-foreground">Delete "{deleteTarget?.title}"?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="delete-journal-cancel" className="font-sans text-xs uppercase tracking-widest">Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid="delete-journal-confirm" onClick={handleDelete} className="bg-destructive text-destructive-foreground font-sans text-xs uppercase tracking-widest">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
