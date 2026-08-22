import { Link } from "wouter";
import { Separator } from "@workspace/mnt-embark/components/ui/separator";

export default function Footer() {
  return (
    <footer className="bg-background border-t border-border/40 mt-24" data-testid="footer">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <h3 className="font-serif text-xl font-light text-primary tracking-widest uppercase">
              MNT Embark
            </h3>
            <p className="font-sans text-xs text-muted-foreground tracking-widest uppercase mt-1 mb-4" style={{ fontSize: "0.6rem" }}>
              Exclusive like no other
            </p>
            <p className="font-sans text-sm text-muted-foreground leading-relaxed">
              Crafting extraordinary journeys for those who refuse to settle for the ordinary.
            </p>
          </div>

          {/* Discover */}
          <div>
            <p className="font-sans text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4">
              Discover
            </p>
            <div className="flex flex-col gap-3">
              <Link href="/tours" data-testid="footer-link-tours" className="font-sans text-sm text-foreground/70 hover:text-primary transition-colors">
                Exclusive Tours
              </Link>
              <Link href="/destinations" data-testid="footer-link-destinations" className="font-sans text-sm text-foreground/70 hover:text-primary transition-colors">
                Destinations
              </Link>
              <Link href="/categories" data-testid="footer-link-categories" className="font-sans text-sm text-foreground/70 hover:text-primary transition-colors">
                Categories
              </Link>
            </div>
          </div>

          {/* Editorial */}
          <div>
            <p className="font-sans text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4">
              Editorial
            </p>
            <div className="flex flex-col gap-3">
              <Link href="/journals" data-testid="footer-link-journals" className="font-sans text-sm text-foreground/70 hover:text-primary transition-colors">
                Travel Journals
              </Link>
              <Link href="/about" data-testid="footer-link-about" className="font-sans text-sm text-foreground/70 hover:text-primary transition-colors">
                About Us
              </Link>
              <Link href="/contact" data-testid="footer-link-contact" className="font-sans text-sm text-foreground/70 hover:text-primary transition-colors">
                Contact
              </Link>
            </div>
          </div>

          {/* Contact info */}
          <div>
            <p className="font-sans text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4">
              Enquiries
            </p>
            <div className="flex flex-col gap-3">
              <p className="font-sans text-sm text-foreground/70">reservations@mntembark.com</p>
              <p className="font-sans text-sm text-foreground/70">+1 (800) MNT-EMBARK</p>
              <p className="font-sans text-sm text-foreground/70">Available 24/7 for members</p>
            </div>
          </div>
        </div>

        <Separator className="my-10 bg-border/40" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="font-sans text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} MNT Embark. All rights reserved.
          </p>
          <p className="font-sans text-xs text-muted-foreground tracking-widest uppercase">
            Curated Exclusively for Elite Travelers
          </p>
        </div>
      </div>
    </footer>
  );
}
