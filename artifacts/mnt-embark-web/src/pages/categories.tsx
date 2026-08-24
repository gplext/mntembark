import { Link } from "wouter";
import { useListCategories } from "@workspace/api-client-react";
import { Skeleton } from "@workspace/mnt-embark/components/ui/skeleton";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import { ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function CategoriesPage() {
  const { data: categories, isLoading, isError, refetch } = useListCategories();

  return (
    <div className="min-h-[100dvh] bg-background">
      <Navbar />

      {/* Header */}
      <div className="pt-32 pb-16 border-b border-border/30">
        <div className="max-w-7xl mx-auto px-6">
          <p className="font-sans text-xs font-medium uppercase tracking-widest text-primary mb-3">
            Journey Types
          </p>
          <h1 className="font-serif text-6xl font-light text-foreground mb-4">
            Categories
          </h1>
          <p className="font-sans text-sm text-muted-foreground max-w-xl">
            From untamed safaris to serene coastal retreats — choose the essence of your next extraordinary journey.
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-80 rounded bg-card" />
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-20">
            <div className="w-16 h-px bg-primary mx-auto mb-8" />
            <h3 className="font-serif text-3xl font-light text-foreground mb-4">
              Unable to Load
            </h3>
            <p className="font-sans text-sm text-muted-foreground mb-6">
              An error occurred while loading categories.
            </p>
            <Button
              variant="outline"
              data-testid="categories-retry"
              onClick={() => refetch()}
              className="font-sans text-xs uppercase tracking-widest"
            >
              Try Again
            </Button>
            <div className="w-16 h-px bg-primary mx-auto mt-8" />
          </div>
        ) : !categories || categories.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-px bg-primary mx-auto mb-8" />
            <h3 className="font-serif text-3xl font-light text-foreground mb-4">
              No Categories Yet
            </h3>
            <p className="font-sans text-sm text-muted-foreground">
              Our tour categories are being curated. Check back soon.
            </p>
            <div className="w-16 h-px bg-primary mx-auto mt-8" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/tours?categoryId=${category.id}`}
                data-testid={`category-card-${category.id}`}
                className="group relative overflow-hidden rounded block"
                style={{ height: "380px" }}
              >
                <img
                  src={category.coverImage}
                  alt={category.name}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                <div className="absolute bottom-0 left-0 right-0 p-8">
                  <h3 className="font-serif text-3xl font-light text-white mb-2">
                    {category.name}
                  </h3>
                  <p className="font-sans text-sm text-white/75 leading-relaxed mb-4 line-clamp-2">
                    {category.description}
                  </p>
                  <div className="flex items-center gap-2 text-accent font-sans text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    Explore Journeys <ArrowRight className="h-3 w-3" />
                  </div>
                </div>

                {/* Gold line accent on hover */}
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent/0 group-hover:bg-accent/60 transition-all duration-500" />
              </Link>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
