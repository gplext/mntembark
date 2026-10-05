import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@workspace/mnt-embark/components/ui/sheet";
import { cn } from "@workspace/mnt-embark/lib/utils";

// ── Link groups ───────────────────────────────────────────────────────────────
const leftLinks = [
  { href: "/destinations", label: "Destinations" },
];

const rightLinks = [
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact Us" },
];

const brandLogoSrc = "/mnt-embark-logo.png";

// ── NavLink ───────────────────────────────────────────────────────────────────

interface NavLinkProps {
  href: string;
  label: string;
  hasSurface: boolean;
  location: string;
}

function NavLink({ href, label, hasSurface, location }: NavLinkProps) {
  const isActive = location === href || (href !== "/" && location.startsWith(href));
  return (
    <Link
      href={href}
      data-testid={`nav-link-${label.toLowerCase().replace(/\s+/g, "-")}`}
      className={cn(
        "font-sans text-xs font-semibold uppercase tracking-widest transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm",
        isActive
          ? hasSurface ? "text-primary" : "text-accent"
          : hasSurface
            ? "text-muted-foreground hover:text-foreground"
            : "text-white/90 hover:text-white"
      )}
    >
      {label}
    </Link>
  );
}

// ── Navbar ────────────────────────────────────────────────────────────────────

export default function Navbar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const updateScrollState = () => setIsScrolled(window.scrollY > 24);
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, []);

  // Close sheet on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  const hasSurface = isScrolled || location !== "/";

  // ── Mobile link item ───────────────────────────────────────────────────────

  function MobileLinkItem({ href, label }: { href: string; label: string }) {
    const isActive = location === href || (href !== "/" && location.startsWith(href));
    return (
      <Link
        href={href}
        data-testid={`mobile-nav-link-${label.toLowerCase().replace(/\s+/g, "-")}`}
        onClick={() => setMobileOpen(false)}
        className={cn(
          "font-sans text-xs font-semibold uppercase tracking-widest py-3 px-2 transition-colors duration-200 border-b border-border/20 block",
          isActive
            ? "text-primary font-bold"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {label}
      </Link>
    );
  }

  const allLinks = [...leftLinks, ...rightLinks];

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 border-b transition-all duration-300",
        hasSurface
          ? "bg-background/95 backdrop-blur-md border-border/60 shadow-sm"
          : "bg-transparent border-transparent"
      )}
      data-scrolled={isScrolled}
      data-testid="navbar"
    >
      <div className="max-w-7xl mx-auto px-6">

        {/* ── Desktop ──────────────────────────────────────────────────────── */}
        <div className="hidden md:flex h-16 items-center justify-between">

          {/* Left nav */}
          <div className="flex items-center gap-8">
            {leftLinks.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                label={link.label}
                hasSurface={hasSurface}
                location={location}
              />
            ))}
          </div>

          {/* Center brand */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <Link
              href="/"
              data-testid="nav-brand"
              className="inline-flex items-center justify-center"
            >
              <img
                src={brandLogoSrc}
                alt="MNT Embark"
                className="h-14 w-auto object-contain"
              />
            </Link>
          </div>

          {/* Right nav */}
          <div className="flex items-center gap-8">
            {rightLinks.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                label={link.label}
                hasSurface={hasSurface}
                location={location}
              />
            ))}
          </div>
        </div>

        {/* ── Mobile ───────────────────────────────────────────────────────── */}
        <div className="relative flex h-14 items-center justify-between md:hidden">

          {/* Hamburger menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                data-testid="nav-mobile-menu"
                aria-label="Menu"
                className={cn(
                  "transition-colors duration-300",
                  hasSurface ? "text-muted-foreground hover:text-foreground" : "text-white/90 hover:text-white"
                )}
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="bg-background border-border w-72">
              <div className="flex flex-col gap-1 mt-8">
                <div className="mb-5 pb-4 border-b border-border/40">
                  <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.15em] text-primary mb-1">
                    Navigation
                  </p>
                  <p className="font-serif text-xl font-light text-foreground">
                    MNT Embark
                  </p>
                </div>
                <MobileLinkItem href="/" label="Home" />
                {allLinks.map((link) => (
                  <MobileLinkItem key={link.href} href={link.href} label={link.label} />
                ))}
              </div>
            </SheetContent>
          </Sheet>

          {/* Center brand */}
          <Link
            href="/"
            data-testid="nav-brand-mobile"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 inline-flex items-center justify-center"
          >
            <img
              src={brandLogoSrc}
              alt="MNT Embark"
              className="h-12 w-auto object-contain"
            />
          </Link>

          <div className="w-10" />
        </div>

      </div>
    </nav>
  );
}
