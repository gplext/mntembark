import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import { Input } from "@workspace/mnt-embark/components/ui/input";
import { Badge } from "@workspace/mnt-embark/components/ui/badge";
import { Skeleton } from "@workspace/mnt-embark/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { useToast } from "@workspace/mnt-embark/hooks/use-toast";
import {
  Plus,
  Trash2,
  KeyRound,
  Shield,
  ShieldCheck,
  UserCheck,
  Search,
  AlertCircle,
  Info,
} from "lucide-react";
import { format } from "date-fns";
import AdminLayout from "@/components/AdminLayout";
import { useAdminAuth } from "@/context/AdminAuthContext";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface AdminUserRecord {
  id: number;
  email: string;
  isSuperAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AdminAdminsPage() {
  const { isSuperAdmin, adminId } = useAdminAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [resetTargetAdmin, setResetTargetAdmin] = useState<AdminUserRecord | null>(null);
  const [deleteTargetAdmin, setDeleteTargetAdmin] = useState<AdminUserRecord | null>(null);

  // Form states
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newIsSuperAdmin, setNewIsSuperAdmin] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [formError, setFormError] = useState("");

  // 1. Fetch sub-admins
  const {
    data: admins = [],
    isLoading,
    isError,
  } = useQuery<AdminUserRecord[]>({
    queryKey: ["admin", "sub-admins"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/admin/sub-admins`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch admins");
      }
      return res.json();
    },
    enabled: isSuperAdmin === true,
  });

  // 2. Create sub-admin mutation
  const createMutation = useMutation({
    mutationFn: async (data: { email: string; password: string; isSuperAdmin: boolean }) => {
      const res = await fetch(`${API_BASE}/api/admin/sub-admins`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to create sub-admin");
      }
      return res.json();
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "sub-admins"] });
      toast({
        title: "Admin Created",
        description: `${created.email} has been created with full administrative access.`,
      });
      setIsAddOpen(false);
      setNewEmail("");
      setNewPassword("");
      setNewIsSuperAdmin(false);
      setFormError("");
    },
    onError: (err: Error) => {
      setFormError(err.message);
    },
  });

  // 3. Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ id, password }: { id: number; password: string }) => {
      const res = await fetch(`${API_BASE}/api/admin/sub-admins/${id}/password`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to update password");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Password Updated",
        description: "The admin's password has been successfully updated.",
      });
      setResetTargetAdmin(null);
      setResetPassword("");
      setFormError("");
    },
    onError: (err: Error) => {
      setFormError(err.message);
    },
  });

  // 4. Delete admin mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_BASE}/api/admin/sub-admins/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to delete admin");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "sub-admins"] });
      toast({
        title: "Admin Removed",
        description: "The sub-admin account has been deleted.",
      });
      setDeleteTargetAdmin(null);
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
      setDeleteTargetAdmin(null);
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!newEmail || !newEmail.includes("@")) {
      setFormError("Please provide a valid email address.");
      return;
    }

    if (!newPassword || newPassword.length < 4) {
      setFormError("Password must be at least 4 characters long.");
      return;
    }

    createMutation.mutate({
      email: newEmail.trim().toLowerCase(),
      password: newPassword,
      isSuperAdmin: newIsSuperAdmin,
    });
  };

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!resetTargetAdmin) return;
    if (!resetPassword || resetPassword.length < 4) {
      setFormError("Password must be at least 4 characters long.");
      return;
    }

    resetPasswordMutation.mutate({
      id: resetTargetAdmin.id,
      password: resetPassword,
    });
  };

  // Filter admins by search query
  const filteredAdmins = admins.filter((a) =>
    a.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isSuperAdmin) {
    return (
      <AdminLayout>
        <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-xl font-serif">Super Admin Access Required</h2>
          <p className="text-sm text-muted-foreground">
            Only Super Administrators can create and manage sub-admin accounts.
          </p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-serif tracking-wide text-foreground">
              Admin Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Create and manage sub-admins with full administrative access to all portal features.
            </p>
          </div>

          <Button
            onClick={() => {
              setFormError("");
              setIsAddOpen(true);
            }}
            className="gap-2 shrink-0 bg-primary text-primary-foreground hover:opacity-90"
            data-testid="admin-add-subadmin-btn"
          >
            <Plus className="h-4 w-4" />
            Add Sub Admin
          </Button>
        </div>

        {/* Info card */}
        <div className="bg-card border border-border/60 rounded-lg p-4 flex items-start gap-3 text-sm text-muted-foreground">
          <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-foreground font-medium">Sub-Admin Permissions</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Sub-admins have full permissions to manage tours, destinations, categories, activities,
              guides, journals, enquiries, and media uploads. Email addresses do not require verification.
            </p>
          </div>
        </div>

        {/* Search filter bar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search admins by email…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-card border-border/60 text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {filteredAdmins.length} {filteredAdmins.length === 1 ? "admin" : "admins"} found
          </p>
        </div>

        {/* Table / List */}
        <div className="bg-card border border-border/60 rounded-lg overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : isError ? (
            <div className="p-8 text-center text-destructive text-sm">
              Failed to load admin accounts. Please refresh the page.
            </div>
          ) : filteredAdmins.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <UserCheck className="h-10 w-10 text-muted-foreground/60 mx-auto" />
              <p className="text-sm font-medium text-foreground">No sub-admins created yet</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Click &quot;Add Sub Admin&quot; above to create administrative credentials for your team.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/30 text-xs font-sans uppercase tracking-wider text-muted-foreground">
                    <th className="py-3.5 px-4 font-medium">Admin</th>
                    <th className="py-3.5 px-4 font-medium">Role</th>
                    <th className="py-3.5 px-4 font-medium">Created Date</th>
                    <th className="py-3.5 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filteredAdmins.map((admin) => {
                    const isSelf = admin.id === adminId;
                    return (
                      <tr key={admin.id} className="hover:bg-muted/10 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-xs shrink-0">
                              {admin.email.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{admin.email}</p>
                              {isSelf && (
                                <span className="text-[10px] text-primary font-sans uppercase tracking-wider">
                                  Current Account
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {admin.isSuperAdmin ? (
                            <Badge className="bg-primary/15 text-primary border-primary/30 gap-1 text-[11px]">
                              <ShieldCheck className="h-3 w-3" />
                              Super Admin
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground gap-1 text-[11px]">
                              <Shield className="h-3 w-3" />
                              Sub Admin
                            </Badge>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-muted-foreground">
                          {admin.createdAt ? format(new Date(admin.createdAt), "MMM d, yyyy · HH:mm") : "—"}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setResetTargetAdmin(admin);
                                setResetPassword("");
                                setFormError("");
                              }}
                              className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1"
                              title="Reset Password"
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Reset Password</span>
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isSelf}
                              onClick={() => setDeleteTargetAdmin(admin)}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30"
                              title={isSelf ? "Cannot delete yourself" : "Delete Admin"}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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

        {/* ── Dialog: Add Sub Admin ─────────────────────────────────────── */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="sm:max-w-md bg-card border-border/80">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">Create Sub Admin</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Enter the email and password for the new admin. The account will be active immediately
                with full administrative access.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-sans uppercase tracking-wider text-muted-foreground mb-1.5">
                  Email Address
                </label>
                <Input
                  type="email"
                  required
                  placeholder="admin@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="bg-background"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-sans uppercase tracking-wider text-muted-foreground mb-1.5">
                  Password <span className="text-[10px] lowercase text-muted-foreground/70">(at least 4 characters)</span>
                </label>
                <Input
                  type="password"
                  required
                  minLength={4}
                  placeholder="Enter password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-background"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="grantSuperAdmin"
                  checked={newIsSuperAdmin}
                  onChange={(e) => setNewIsSuperAdmin(e.target.checked)}
                  className="rounded border-border"
                />
                <label htmlFor="grantSuperAdmin" className="text-xs text-muted-foreground cursor-pointer select-none">
                  Grant Super Admin privileges (allows managing other admins)
                </label>
              </div>

              {formError && (
                <div className="bg-destructive/10 border border-destructive/20 rounded p-2.5 text-xs text-destructive">
                  {formError}
                </div>
              )}

              <DialogFooter className="pt-3 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddOpen(false)}
                  disabled={createMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || !newEmail || newPassword.length < 4}
                  className="bg-primary text-primary-foreground hover:opacity-90"
                >
                  {createMutation.isPending ? "Creating…" : "Create Admin"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Dialog: Reset Password ────────────────────────────────────── */}
        <Dialog
          open={!!resetTargetAdmin}
          onOpenChange={(open) => {
            if (!open) {
              setResetTargetAdmin(null);
              setResetPassword("");
              setFormError("");
            }
          }}
        >
          <DialogContent className="sm:max-w-md bg-card border-border/80">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">Reset Admin Password</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Set a new password for <span className="font-medium text-foreground">{resetTargetAdmin?.email}</span>.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleResetSubmit} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-sans uppercase tracking-wider text-muted-foreground mb-1.5">
                  New Password <span className="text-[10px] lowercase text-muted-foreground/70">(at least 4 characters)</span>
                </label>
                <Input
                  type="password"
                  required
                  minLength={4}
                  placeholder="Enter new password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  className="bg-background"
                  autoFocus
                />
              </div>

              {formError && (
                <div className="bg-destructive/10 border border-destructive/20 rounded p-2.5 text-xs text-destructive">
                  {formError}
                </div>
              )}

              <DialogFooter className="pt-3 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setResetTargetAdmin(null)}
                  disabled={resetPasswordMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={resetPasswordMutation.isPending || resetPassword.length < 4}
                  className="bg-primary text-primary-foreground hover:opacity-90"
                >
                  {resetPasswordMutation.isPending ? "Updating…" : "Update Password"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Alert Dialog: Delete Admin ────────────────────────────────── */}
        <AlertDialog
          open={!!deleteTargetAdmin}
          onOpenChange={(open) => {
            if (!open) setDeleteTargetAdmin(null);
          }}
        >
          <AlertDialogContent className="bg-card border-border/80">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-serif">Delete Admin Account</AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-muted-foreground">
                Are you sure you want to remove <span className="font-medium text-foreground">{deleteTargetAdmin?.email}</span>?
                They will immediately lose administrative access to the portal.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteTargetAdmin) {
                    deleteMutation.mutate(deleteTargetAdmin.id);
                  }
                }}
                disabled={deleteMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete Account"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}
