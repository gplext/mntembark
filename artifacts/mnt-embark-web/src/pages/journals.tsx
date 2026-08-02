import { Link } from "wouter";
import { useListJournalEntries } from "@workspace/api-client-react";
import { Skeleton } from "@workspace/mnt-embark/components/ui/skeleton";
import { Separator } from "@workspace/mnt-embark/components/ui/separator";
import { MapPin } from "lucide-react";
import { format } from "date-fns";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function JournalsPage() {
  const { data: journals, isLoading, isError, refetch } = useListJournalEntries();

  return (
    <div className="min-h-[100dvh] bg-background">
      <Navbar />

      {/* Header */}
      <div className="pt-32 pb-16 border-b border-border/30">
        <div className="max-w-7xl mx-auto px-6">
          <p className="font-sans text-xs font-medium uppercase tracking-widest text-primary mb-3">
            Editorial
          </p>
          <h1 className="font-serif text-6xl font-light text-foreground mb-4">
            Travel Journals
          </h1>
          <p className="font-sans text-sm text-muted-foreground max-w-xl">
            Intimate accounts from extraordinary places. Our correspondents document the moments that define a journey.
          </p>
        </div>
      </div>

      {/* Journals */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        {isLoading ? (
          <div className="space-y-12">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="grid md:grid-cols-2 gap-8">
                <Skeleton className="aspect-[4/3] rounded bg-card" />
                <div className="space-y-4 py-4">
                  <Skeleton className="h-4 w-24 bg-card" />
                  <Skeleton className="h-8 w-3/4 bg-card" />
                  <Skeleton className="h-16 w-full bg-card" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-20">
            <div className="w-16 h-px bg-primary mx-auto mb-8" />
            <h3 className="font-serif text-3xl font-light text-foreground mb-4">
              Unable to Load Journals
            </h3>
            <p className="font-sans text-sm text-muted-foreground mb-6">
              An error occurred while loading the travel journals.
            </p>
            <button
              data-testid="journals-retry"
              onClick={() => refetch()}
              className="font-sans text-xs uppercase tracking-widest text-primary hover:text-foreground transition-colors"
            >
              Try Again
            </button>
            <div className="w-16 h-px bg-primary mx-auto mt-8" />
          </div>
        ) : !journals || journals.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-px bg-primary mx-auto mb-8" />
            <h3 className="font-serif text-3xl font-light text-foreground mb-4">
              No Journals Yet
            </h3>
            <p className="font-sans text-sm text-muted-foreground">
              Our travel correspondents are composing their accounts. Check back soon.
            </p>
            <div className="w-16 h-px bg-primary mx-auto mt-8" />
          </div>
        ) : (
          <div className="space-y-0">
            {journals.map((journal, idx) => {
              const isEven = idx % 2 === 0;
              return (
                <div key={journal.id}>
                  <Link
                    href={`/journals/${journal.id}`}
                    data-testid={`journal-row-${journal.id}`}
                    className="group grid md:grid-cols-2 gap-8 md:gap-16 items-center py-12 block"
                  >
                    <div
                      className={`relative overflow-hidden rounded aspect-[4/3] ${
                        isEven ? "md:order-1" : "md:order-2"
                      }`}
                    >
                      <img
                        src={journal.coverImage}
                        alt={journal.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    </div>
                    <div className={`space-y-5 ${isEven ? "md:order-2" : "md:order-1"}`}>
                      <div className="flex items-center gap-3">
                        <MapPin className="h-3 w-3 text-primary" />
                        <p className="font-sans text-xs font-medium uppercase tracking-widest text-primary">
                          {journal.location}
                        </p>
                      </div>
                      <h2 className="font-serif text-3xl md:text-4xl font-light text-foreground leading-tight">
                        {journal.title}
                      </h2>
                      <p className="font-sans text-sm text-muted-foreground leading-relaxed">
                        {journal.excerpt}
                      </p>
                      <div className="flex items-center gap-4">
                        <div className="w-6 h-px bg-primary" />
                        <div>
                          <p className="font-sans text-xs text-foreground uppercase tracking-widest">
                            {journal.author}
                          </p>
                          <p className="font-sans text-xs text-muted-foreground mt-0.5">
                            {format(new Date(journal.publishedAt), "MMMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      <div className="pt-2">
                        <span className="font-sans text-xs uppercase tracking-widest text-primary group-hover:gap-2 inline-flex items-center gap-1 transition-all">
                          Read Journal
                          <span className="inline-block w-4 h-px bg-primary group-hover:w-6 transition-all duration-300" />
                        </span>
                      </div>
                    </div>
                  </Link>
                  {idx < journals.length - 1 && (
                    <Separator className="bg-border/20" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
