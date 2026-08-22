import { useParams, Link } from "wouter";
import { useGetJournalEntry, getGetJournalEntryQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@workspace/mnt-embark/components/ui/skeleton";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import { Separator } from "@workspace/mnt-embark/components/ui/separator";
import { MapPin, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function JournalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const journalId = Number(id);

  const { data: journal, isLoading, isError } = useGetJournalEntry(journalId, {
    query: {
      enabled: !!journalId && !isNaN(journalId),
      queryKey: getGetJournalEntryQueryKey(journalId),
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <Navbar />
        <div className="max-w-4xl mx-auto px-6 pt-32 space-y-8">
          <Skeleton className="h-8 w-32 bg-card" />
          <Skeleton className="aspect-[16/9] w-full rounded bg-card" />
          <Skeleton className="h-12 w-3/4 bg-card" />
          <Skeleton className="h-32 w-full bg-card" />
        </div>
      </div>
    );
  }

  if (isError || !journal) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <Navbar />
        <div className="flex items-center justify-center" style={{ minHeight: "100dvh" }}>
          <div className="text-center max-w-md px-6">
            <div className="w-16 h-px bg-primary mx-auto mb-8" />
            <h1 className="font-serif text-4xl font-light text-foreground mb-4">
              Journal Not Found
            </h1>
            <p className="font-sans text-sm text-muted-foreground mb-8">
              This entry may no longer be available.
            </p>
            <Link href="/journals">
              <Button
                variant="outline"
                data-testid="journal-not-found-back"
                className="font-sans text-xs uppercase tracking-widest"
              >
                All Journals
              </Button>
            </Link>
            <div className="w-16 h-px bg-primary mx-auto mt-8" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <Navbar />

      <div className="max-w-4xl mx-auto px-6 pt-28 pb-16">
        {/* Back */}
        <Link
          href="/journals"
          data-testid="journal-back-link"
          className="inline-flex items-center gap-2 font-sans text-xs text-muted-foreground hover:text-foreground uppercase tracking-widest mb-10 transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Travel Journals
        </Link>

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <MapPin className="h-3 w-3 text-primary" />
            <p className="font-sans text-xs font-medium uppercase tracking-widest text-primary">
              {journal.location}
            </p>
          </div>
          <h1 className="font-serif text-5xl md:text-6xl font-light text-foreground leading-tight mb-6">
            {journal.title}
          </h1>
          <p className="font-sans text-base text-muted-foreground leading-relaxed mb-8">
            {journal.excerpt}
          </p>
          <div className="flex items-center gap-4">
            <div className="w-8 h-px bg-primary" />
            <div>
              <p className="font-sans text-xs uppercase tracking-widest text-foreground">
                {journal.author}
              </p>
              <p className="font-sans text-xs text-muted-foreground mt-0.5">
                {format(new Date(journal.publishedAt), "MMMM d, yyyy")}
              </p>
            </div>
          </div>
        </div>

        {/* Cover image */}
        <div className="relative aspect-[16/9] overflow-hidden rounded mb-12">
          <img
            src={journal.coverImage}
            alt={journal.title}
            className="w-full h-full object-cover"
            data-testid="journal-cover-image"
          />
        </div>

        <Separator className="bg-primary/20 mb-12" />

        {/* Content */}
        <div
          className="font-sans text-base text-foreground/90 leading-relaxed space-y-6"
          data-testid="journal-content"
        >
          {journal.content.split("\n\n").map((paragraph, idx) => (
            <p key={idx}>{paragraph}</p>
          ))}
        </div>

        {/* Additional images */}
        {journal.images && journal.images.length > 0 && (
          <div className="mt-12 grid grid-cols-2 gap-4">
            {journal.images.map((img, idx) => (
              <div key={idx} className="aspect-[4/3] overflow-hidden rounded">
                <img
                  src={img}
                  alt={`${journal.title} — image ${idx + 1}`}
                  data-testid={`journal-image-${idx}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}

        <Separator className="bg-border/20 mt-16 mb-10" />

        {/* Footer nav */}
        <div className="flex items-center justify-between">
          <Link href="/journals">
            <Button
              variant="ghost"
              data-testid="journal-back-btn"
              className="font-sans text-xs uppercase tracking-widest text-muted-foreground hover:text-primary gap-2"
            >
              <ArrowLeft className="h-3 w-3" />
              All Journals
            </Button>
          </Link>
          <Link href="/contact">
            <Button
              data-testid="journal-enquire-btn"
              className="font-sans text-xs uppercase tracking-widest"
            >
              Plan Your Journey
            </Button>
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
}
