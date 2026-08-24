import { useListDestinations } from "@workspace/api-client-react";
import { Skeleton } from "@workspace/mnt-embark/components/ui/skeleton";
import { MapPin } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { DestinationCoverImage } from "@/components/DestinationCoverImage";

export default function DestinationsPage() {
  const { data: destinations, isLoading, isError, refetch } = useListDestinations();

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
              return (
                <div
                  key={dest.id}
                  data-testid={`destination-card-${dest.id}`}
                  className={`group relative overflow-hidden rounded cursor-default ${isLarge ? "md:col-span-1" : ""}`}
                  style={{ height: isLarge ? "420px" : "300px" }}
                >
                  <DestinationCoverImage
                    coverImage={dest.coverImage}
                    alt={dest.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {/* Content */}
                  <div className="absolute bottom-0 left-0 right-0 p-6">
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
                    <p className="font-sans text-xs text-white/70 leading-relaxed line-clamp-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      {dest.description}
                    </p>
                  </div>

                  {/* Top border on hover */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/0 group-hover:bg-primary/60 transition-all duration-300" />
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
