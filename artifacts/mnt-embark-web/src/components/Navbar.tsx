import { useEffect, useState } from "react";
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

const brandLogoSrc = "/mnt-embark-logo.png";

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

  const hasSurface = isScrolled || location !== "/";

  const NavLink = ({ href, label }: { href: string; label: string }) => {
    const isActive = location === href || (href !== "/" && location.startsWith(href));
    return (
      <Link
        href={href}
        data-testid={`nav-link-${label.toLowerCase().replace(/\s+/g, "-")}`}
        className={cn(
          "font-sans text-xs font-semibold uppercase tracking-widest transition-colors duration-200",
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
  };

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
        {/* Desktop */}
        <div className="hidden md:flex h-16 items-center justify-between">
          {/* Left nav */}
          <div className="flex items-center gap-8">
            {leftLinks.map((link) => (
              <NavLink key={link.href} {...link} />
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
              <NavLink key={link.href} {...link} />
            ))}
          </div>
        </div>

        {/* Mobile */}
        <div className="relative flex h-14 items-center justify-end md:hidden">
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
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                data-testid="nav-mobile-menu"
                className={cn(
                  "transition-colors duration-300",
                  hasSurface ? "text-muted-foreground hover:text-foreground" : "text-white/90 hover:text-white"
                )}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-background border-border w-72">
              <div className="flex flex-col gap-1 mt-8">
                <div className="mb-4 pb-4 border-b border-border/40">
                  <img
                    src={brandLogoSrc}
                    alt="MNT Embark"
                    className="h-20 w-auto object-contain"
                  />
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
                        "font-sans text-xs font-semibold uppercase tracking-widest py-3 px-2 transition-colors duration-200 border-b border-border/20",
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
