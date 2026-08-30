import { Link, useLocation } from "wouter";
import { cn } from "@workspace/mnt-embark/lib/utils";
import { LayoutDashboard, Tag, BookOpen, Globe, ArrowLeft, Inbox, Compass, PenLine } from "lucide-react";

const navItems = [
  { href: "/admin/tours", label: "Tours", icon: LayoutDashboard },
  { href: "/admin/destinations", label: "Destinations", icon: Globe },
  { href: "/admin/categories", label: "Categories", icon: Tag },
  { href: "/admin/activities", label: "Activities", icon: Compass },
  { href: "/admin/guides", label: "Guides", icon: PenLine },
  { href: "/admin/journals", label: "Journals", icon: BookOpen },
  { href: "/admin/enquiries", label: "Enquiries", icon: Inbox },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

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
            <p className="font-sans text-xs text-muted-foreground tracking-widest uppercase mt-0.5" style={{ fontSize: "0.6rem" }}>
              Admin Panel
            </p>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = location === href || location.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                data-testid={`admin-nav-${label.toLowerCase()}`}
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

        {/* Back to site */}
        <div className="p-4 border-t border-border/40">
          <Link
            href="/"
            data-testid="admin-back-to-site"
            className="flex items-center gap-2 font-sans text-xs text-muted-foreground hover:text-foreground uppercase tracking-widest transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Site
          </Link>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
