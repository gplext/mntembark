import { useListDestinations, useListTours } from "@workspace/api-client-react";
import { Skeleton } from "@workspace/mnt-embark/components/ui/skeleton";
import { MapPin } from "lucide-react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { DestinationCoverImage } from "@/components/DestinationCoverImage";
import DestinationsMap from "@/components/DestinationsMap";

export default function DestinationsPage() {
  const { data: destinations, isLoading, isError, refetch } = useListDestinations();
  const { data: tours, isLoading: toursLoading } = useListTours();

  return (
    <div className="min-h-[100dvh] bg-background">
      <Navbar />

      {/* Header */}
      <div className="pt-32 pb-16 border-b border-border/30">
        <div className="max-w-7xl mx-auto px-6">
          <p className="font-sans text-xs font-medium uppercase tracking-widest text-primary mb-3">
            Around the World
          </p>
          <h1 className="font-serif text-6xl font-light text-foreground mb-4">
            Destinations
          </h1>
          <p className="font-sans text-sm text-muted-foreground max-w-xl">
            We select only the world's most extraordinary places — each destination chosen for its singular ability to transform the traveler.
          </p>
        </div>
      </div>

      {/* Illustrated Map — shown whenever data is available */}
      {!isLoading && !isError && destinations && destinations.length > 0 && (
        <DestinationsMap
          destinations={destinations}
          tours={tours ?? []}
          toursLoading={toursLoading}
        />
      )}

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded bg-card" />
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-20">
            <div className="w-16 h-px bg-primary mx-auto mb-8" />
            <h3 className="font-serif text-3xl font-light text-foreground mb-4">
              Unable to Load Destinations
            </h3>
            <p className="font-sans text-sm text-muted-foreground mb-6">
              An error occurred while loading destinations.
            </p>
            <button
              data-testid="destinations-retry"
              onClick={() => refetch()}
              className="font-sans text-xs uppercase tracking-widest text-primary hover:text-foreground transition-colors"
            >
              Try Again
            </button>
            <div className="w-16 h-px bg-primary mx-auto mt-8" />
          </div>
        ) : !destinations || destinations.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-px bg-primary mx-auto mb-8" />
            <h3 className="font-serif text-3xl font-light text-foreground mb-4">
              No Destinations Yet
            </h3>
            <p className="font-sans text-sm text-muted-foreground">
              Our curated destination collection is being assembled. Check back soon.
            </p>
            <div className="w-16 h-px bg-primary mx-auto mt-8" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {destinations.map((dest, idx) => {
              const isLarge = idx % 5 === 0 || idx % 5 === 3;
              const destinationTours = (tours ?? []).filter(
                (tour) => tour.destinationId === dest.id,
              );
              return (
                <Link
                  key={dest.id}
                  href={`/tours?destinationSlug=${encodeURIComponent(dest.slug ?? "")}`}
                  data-testid={`destination-card-${dest.id}`}
                  aria-label={`View tours in ${dest.name}`}
                  className={`group relative overflow-hidden rounded cursor-pointer block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${isLarge ? "md:col-span-1" : ""}`}
                  style={{ height: isLarge ? "420px" : "300px" }}
                >
                  <DestinationCoverImage
                    coverImage={dest.coverImage}
                    alt={dest.name}
                    className="w-full h-full object-cover transition-[filter,transform] duration-700 ease-out group-hover:scale-105 group-hover:blur-sm group-focus-within:scale-105 group-focus-within:blur-sm"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-colors duration-500 group-hover:from-black/80 group-hover:via-black/60 group-hover:to-black/60 group-focus-within:from-black/80 group-focus-within:via-black/60 group-focus-within:to-black/60" />

                  {/* Destination label — stays visible at the bottom until the card is hovered. */}
                  <div className="absolute bottom-0 left-0 right-0 p-6 transition-all duration-300 group-hover:translate-y-2 group-hover:opacity-0 group-focus-within:translate-y-2 group-focus-within:opacity-0">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="h-3 w-3 text-accent" />
                      <p className="font-sans text-xs font-medium uppercase tracking-widest text-accent">
                        {dest.country}
                        {dest.region && ` · ${dest.region}`}
                      </p>
                    </div>
                    <h3 className="font-serif text-2xl font-light text-white mb-2">
                      {dest.name}
                    </h3>
                  </div>

                  {/* Tour preview — the first three tours appear over the blurred image. */}
                  <div
                    className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 opacity-0 transition-all duration-500 group-hover:opacity-100 group-focus-within:opacity-100"
                    data-testid={`destination-card-tours-${dest.id}`}
                  >
                    <div className="w-full max-w-sm">
                      <p className="mb-4 font-sans text-[10px] font-semibold uppercase tracking-widest text-accent">
                        {toursLoading
                          ? "Loading tours…"
                          : `${Math.min(destinationTours.length, 3)} ${destinationTours.length === 1 ? "tour" : "tours"} in ${dest.name}`}
                      </p>
                      {!toursLoading && destinationTours.length > 0 && (
                        <ul className="space-y-3" aria-label={`Tours in ${dest.name}`}>
                          {destinationTours.slice(0, 3).map((tour) => (
                            <li
                              key={tour.id}
                              className="border-l border-accent/70 pl-3 font-serif text-base leading-tight text-white"
                            >
                              {tour.title}
                            </li>
                          ))}
                        </ul>
                      )}
                      {!toursLoading && destinationTours.length === 0 && (
                        <p className="font-sans text-xs text-white/70">
                          No tours available yet.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Top border on hover */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/0 group-hover:bg-primary/60 transition-all duration-300" />
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
