import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@workspace/mnt-embark/components/ui/sheet";
import { cn } from "@workspace/mnt-embark/lib/utils";

const leftLinks = [
  { href: "/tours", label: "Exclusive Tours" },
  { href: "/categories", label: "Categories" },
  { href: "/destinations", label: "Destinations" },
];

const rightLinks = [
  { href: "/journals", label: "Travel Journals" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const NavLink = ({ href, label }: { href: string; label: string }) => {
    const isActive = location === href || (href !== "/" && location.startsWith(href));
    return (
      <Link
        href={href}
        data-testid={`nav-link-${label.toLowerCase().replace(/\s+/g, "-")}`}
        className={cn(
          "font-sans text-xs font-medium uppercase tracking-widest transition-colors duration-200",
          isActive
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border/40"
      data-testid="navbar"
    >
      <div className="max-w-7xl mx-auto px-6 py-4">
        {/* Desktop */}
        <div className="hidden md:flex items-center justify-between">
          {/* Left nav */}
          <div className="flex items-center gap-8">
            {leftLinks.map((link) => (
              <NavLink key={link.href} {...link} />
            ))}
          </div>

          {/* Center brand */}
          <div className="text-center absolute left-1/2 -translate-x-1/2">
            <Link href="/" data-testid="nav-brand">
              <h1 className="font-serif text-xl font-light text-primary tracking-widest uppercase">
                MNT Embark
              </h1>
              <p className="font-sans text-xs text-muted-foreground tracking-widest uppercase" style={{ fontSize: "0.6rem" }}>
                Exclusive like no other
              </p>
            </Link>
          </div>

          {/* Right nav */}
          <div className="flex items-center gap-8">
            {rightLinks.map((link) => (
              <NavLink key={link.href} {...link} />
            ))}
          </div>
        </div>

        {/* Mobile */}
        <div className="flex md:hidden items-center justify-between">
          <Link href="/" data-testid="nav-brand-mobile">
            <span className="font-serif text-lg font-light text-primary tracking-widest">
              MNT Embark
            </span>
          </Link>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                data-testid="nav-mobile-menu"
                className="text-muted-foreground hover:text-foreground"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-background border-border w-72">
              <div className="flex flex-col gap-1 mt-8">
                <div className="mb-4 pb-4 border-b border-border/40">
                  <p className="font-serif text-lg font-light text-primary">MNT Embark</p>
                  <p className="font-sans text-xs text-muted-foreground tracking-widest uppercase mt-1" style={{ fontSize: "0.6rem" }}>
                    Exclusive like no other
                  </p>
                </div>
                {[...leftLinks, ...rightLinks].map((link) => {
                  const isActive = location === link.href || (link.href !== "/" && location.startsWith(link.href));
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      data-testid={`mobile-nav-link-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "font-sans text-xs font-medium uppercase tracking-widest py-3 px-2 transition-colors duration-200 border-b border-border/20",
                        isActive
                          ? "text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
