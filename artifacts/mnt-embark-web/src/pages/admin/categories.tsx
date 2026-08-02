import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  getListCategoriesQueryKey,
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
import type { Category } from "@workspace/api-client-react";

function CategoryForm({ category, onClose }: { category?: Category; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  const [form, setForm] = useState({
    name: category?.name ?? "",
    description: category?.description ?? "",
    coverImage: category?.coverImage ?? "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (category) {
      updateCategory.mutate(
        { id: category.id, data: form },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
            toast({ title: "Category Updated" });
            onClose();
          },
          onError: () => toast({ title: "Error", variant: "destructive" }),
        }
      );
    } else {
      createCategory.mutate(
        { data: form },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
            toast({ title: "Category Created" });
            onClose();
          },
          onError: () => toast({ title: "Error", variant: "destructive" }),
        }
      );
    }
  };

  const isPending = createCategory.isPending || updateCategory.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="category-form">
      <div>
        <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">Name</label>
        <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="cat-form-name" className="bg-background border-border/60 font-sans text-sm" />
      </div>
      <div>
        <label className="font-sans text-xs uppercase tracking-widest text-muted-foreground block mb-1">Description</label>
        <Textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="cat-form-description" rows={3} className="bg-background border-border/60 font-sans text-sm resize-none" />
      </div>
      <ImageUploadField
        label="Cover Image"
        value={form.coverImage}
        onChange={(url) => setForm({ ...form, coverImage: url })}
        required
        data-testid="cat-form-cover"
      />
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending} data-testid="cat-form-submit" className="flex-1 font-sans text-xs uppercase tracking-widest">
          {isPending ? "Saving..." : category ? "Update" : "Create"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose} data-testid="cat-form-cancel" className="font-sans text-xs uppercase tracking-widest">Cancel</Button>
      </div>
    </form>
  );
}

export default function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: categories, isLoading } = useListCategories();
  const deleteCategory = useDeleteCategory();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editCat, setEditCat] = useState<Category | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Category | undefined>();

  const openCreate = () => { setEditCat(undefined); setSheetOpen(true); };
  const openEdit = (c: Category) => { setEditCat(c); setSheetOpen(true); };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteCategory.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
          toast({ title: "Category Deleted" });
          setDeleteTarget(undefined);
        },
        onError: () => toast({ title: "Error", variant: "destructive" }),
      }
    );
  };

  return (
    <AdminLayout>
      <div className="p-8" data-testid="admin-categories">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="font-sans text-xs uppercase tracking-widest text-primary mb-1">Admin</p>
            <h1 className="font-serif text-3xl font-light text-foreground">Categories</h1>
          </div>
          <Button onClick={openCreate} data-testid="create-category-btn" className="font-sans text-xs uppercase tracking-widest gap-2">
            <Plus className="h-4 w-4" /> New Category
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded bg-card" />)}</div>
        ) : !categories || categories.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border/40 rounded">
            <p className="font-serif text-2xl font-light text-foreground mb-2">No Categories</p>
            <p className="font-sans text-sm text-muted-foreground mb-6">Add your first category.</p>
            <Button onClick={openCreate} data-testid="create-category-empty" className="font-sans text-xs uppercase tracking-widest">Add Category</Button>
          </div>
        ) : (
          <div className="border border-border/40 rounded overflow-hidden">
            <table className="w-full" data-testid="categories-table">
              <thead className="bg-card border-b border-border/40">
                <tr>
                  <th className="text-left p-4 font-sans text-xs uppercase tracking-widest text-muted-foreground">Name</th>
                  <th className="text-left p-4 font-sans text-xs uppercase tracking-widest text-muted-foreground hidden md:table-cell">Description</th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.id} data-testid={`cat-row-${cat.id}`} className="border-b border-border/20 hover:bg-card/40 transition-colors">
                    <td className="p-4"><p className="font-sans text-sm text-foreground">{cat.name}</p></td>
                    <td className="p-4 hidden md:table-cell"><p className="font-sans text-xs text-muted-foreground line-clamp-1">{cat.description}</p></td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 justify-end">
                        <Button variant="ghost" size="icon" data-testid={`edit-cat-${cat.id}`} onClick={() => openEdit(cat)} className="h-7 w-7 text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" data-testid={`delete-cat-${cat.id}`} onClick={() => setDeleteTarget(cat)} className="h-7 w-7 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
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
        <SheetContent side="right" className="bg-card border-border w-full max-w-md overflow-y-auto" data-testid="category-sheet">
          <SheetHeader className="mb-6">
            <SheetTitle className="font-serif text-2xl font-light text-foreground">{editCat ? "Edit Category" : "New Category"}</SheetTitle>
          </SheetHeader>
          <CategoryForm category={editCat} onClose={() => setSheetOpen(false)} />
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(undefined)}>
        <AlertDialogContent className="bg-card border-border" data-testid="delete-cat-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-xl font-light text-foreground">Delete Category</AlertDialogTitle>
            <AlertDialogDescription className="font-sans text-sm text-muted-foreground">Delete "{deleteTarget?.name}"?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="delete-cat-cancel" className="font-sans text-xs uppercase tracking-widest">Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid="delete-cat-confirm" onClick={handleDelete} className="bg-destructive text-destructive-foreground font-sans text-xs uppercase tracking-widest">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
