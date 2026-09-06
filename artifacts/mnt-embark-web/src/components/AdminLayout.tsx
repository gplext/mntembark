import { Link, useLocation } from "wouter";
import { cn } from "@workspace/mnt-embark/lib/utils";
import {
  LayoutDashboard,
  Tag,
  BookOpen,
  Globe,
  ArrowLeft,
  Inbox,
  Compass,
  PenLine,
  Mail,
  Users,
  LogOut,
  Shield,
  ShieldCheck,
} from "lucide-react";
import { useAdminAuth } from "@/context/AdminAuthContext";

const baseNavItems = [
  { href: "/admin/tours", label: "Tours", icon: LayoutDashboard },
  { href: "/admin/destinations", label: "Destinations", icon: Globe },
  { href: "/admin/categories", label: "Categories", icon: Tag },
  { href: "/admin/activities", label: "Activities", icon: Compass },
  { href: "/admin/guides", label: "Guides", icon: PenLine },
  { href: "/admin/journals", label: "Journals", icon: BookOpen },
  { href: "/admin/enquiries", label: "Enquiries", icon: Inbox },
  { href: "/admin/email-templates", label: "Email wording", icon: Mail },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { isSuperAdmin, adminEmail, logout } = useAdminAuth();

  const navItems = isSuperAdmin
    ? [...baseNavItems, { href: "/admin/admins", label: "Sub Admins", icon: Users }]
    : baseNavItems;

  return (
    <div className="min-h-[100dvh] bg-background flex">
      {/* Sidebar */}
      <aside
        className="w-64 shrink-0 bg-card border-r border-border/40 flex flex-col"
        data-testid="admin-sidebar"
      >
        {/* Brand */}
        <div className="p-6 border-b border-border/40">
          <Link href="/" data-testid="admin-brand-link">
            <p className="font-serif text-lg font-light text-primary tracking-widest uppercase">
              MNT Embark
            </p>
            <p
              className="font-sans text-xs text-muted-foreground tracking-widest uppercase mt-0.5"
              style={{ fontSize: "0.6rem" }}
            >
              Admin Panel
            </p>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = location === href || location.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                data-testid={`admin-nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded font-sans text-sm transition-colors duration-200",
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/80"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User profile & footer */}
        <div className="p-4 border-t border-border/40 space-y-3 bg-card/50">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground truncate">
                {isSuperAdmin ? (
                  <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                ) : (
                  <Shield className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="truncate" title={adminEmail ?? "Admin"}>
                  {adminEmail ?? "Admin"}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                {isSuperAdmin ? "Super Admin" : "Sub Admin"}
              </p>
            </div>
            <button
              onClick={() => logout()}
              title="Sign Out"
              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          <div className="pt-2 border-t border-border/20">
            <Link
              href="/"
              data-testid="admin-back-to-site"
              className="flex items-center gap-2 font-sans text-xs text-muted-foreground hover:text-foreground uppercase tracking-widest transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to Site
            </Link>
          </div>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto bg-background">
        {children}
      </main>
    </div>
  );
}
