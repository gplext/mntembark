import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useGetTour, getGetTourQueryKey } from "@workspace/api-client-react";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import { Badge } from "@workspace/mnt-embark/components/ui/badge";
import { Skeleton } from "@workspace/mnt-embark/components/ui/skeleton";
import { Separator } from "@workspace/mnt-embark/components/ui/separator";
import { cn } from "@workspace/mnt-embark/lib/utils";
import {
  MapPin,
  Clock,
  DollarSign,
  Plane,
  Hotel,
  Car,
  Activity,
  Navigation,
  CreditCard,
  Anchor,
  ArrowLeft,
} from "lucide-react";
import type { ItineraryStep } from "@workspace/api-client-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import EnquiryModal from "@/components/EnquiryModal";

const stepIcons: Record<string, React.FC<{ className?: string }>> = {
  Pickup: Navigation,
  Flight: Plane,
  Visa: CreditCard,
  Layover: Anchor,
  Ride: Car,
  Hotel: Hotel,
  Activities: Activity,
};

function ItineraryIcon({ type }: { type: string }) {
  const Icon = stepIcons[type] || Navigation;
  return <Icon className="h-4 w-4" />;
}

export default function TourDetailPage() {
  const { id } = useParams<{ id: string }>();
  const tourId = Number(id);

  const { data: tour, isLoading, isError } = useGetTour(tourId, {
    query: { enabled: !!tourId && !isNaN(tourId), queryKey: getGetTourQueryKey(tourId) },
  });

  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [imageVisible, setImageVisible] = useState(true);
  const [enquiryOpen, setEnquiryOpen] = useState(false);

  const steps = tour?.itinerarySteps ?? [];
  const activeStep = steps[activeStepIndex];

  const currentImage =
    activeStep?.image || tour?.coverImage || "";

  const handleStepChange = (idx: number) => {
    setImageVisible(false);
    setTimeout(() => {
      setActiveStepIndex(idx);
      setImageVisible(true);
    }, 400);
  };

  useEffect(() => {
    setActiveStepIndex(0);
    setImageVisible(true);
  }, [tourId]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <Navbar />
        <div className="flex" style={{ minHeight: "100dvh" }}>
          <div className="w-72 shrink-0 bg-card border-r border-border/40 pt-24 p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded" />
            ))}
          </div>
          <div className="flex-1">
            <Skeleton className="w-full h-full" style={{ minHeight: "100dvh" }} />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !tour) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <Navbar />
        <div className="flex items-center justify-center" style={{ minHeight: "100dvh" }}>
          <div className="text-center max-w-md px-6">
            <div className="w-16 h-px bg-primary mx-auto mb-8" />
            <h1 className="font-serif text-4xl font-light text-foreground mb-4">
              Tour Not Found
            </h1>
            <p className="font-sans text-sm text-muted-foreground mb-8">
              This journey may no longer be available. Explore our other exclusive tours.
            </p>
            <Link href="/tours">
              <Button
                variant="outline"
                data-testid="tour-not-found-back"
                className="font-sans text-xs uppercase tracking-widest"
              >
                View All Tours
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

      <div className="flex" style={{ minHeight: "100dvh" }}>
        {/* Left itinerary strip */}
        <div
          className="w-72 md:w-80 shrink-0 bg-background border-r border-border/40 overflow-y-auto"
          style={{ paddingTop: "80px" }}
          data-testid="itinerary-strip"
        >
          <div className="p-6">
            {/* Back */}
            <Link
              href="/tours"
              data-testid="tour-back-link"
              className="flex items-center gap-2 font-sans text-xs text-muted-foreground hover:text-foreground uppercase tracking-widest mb-8 transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              All Tours
            </Link>

            {/* Tour name */}
            <div className="mb-6">
              {tour.featured && (
                <Badge
                  variant="outline"
                  className="border-primary text-primary text-xs tracking-widest uppercase mb-3"
                >
                  Exclusive
                </Badge>
              )}
              <h1 className="font-serif text-2xl font-light text-foreground leading-tight mb-3">
                {tour.title}
              </h1>
              <div className="flex flex-col gap-1 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3 w-3 text-primary" />
                  <span className="font-sans text-xs">{tour.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3 text-primary" />
                  <span className="font-sans text-xs">{tour.durationDays} days</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-3 w-3 text-primary" />
                  <span className="font-sans text-xs">
                    From ${tour.priceFrom.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <Separator className="bg-border/40 mb-6" />

            {/* Itinerary label */}
            <p className="font-sans text-xs font-medium uppercase tracking-widest text-primary mb-4">
              Exclusive Itinerary
            </p>

            {/* Steps */}
            {steps.length === 0 ? (
              <p className="font-sans text-xs text-muted-foreground">
                Itinerary details coming soon.
              </p>
            ) : (
              <div className="space-y-1">
                {steps.map((step: ItineraryStep, idx: number) => (
                  <button
                    key={idx}
                    data-testid={`itinerary-step-${idx}`}
                    onClick={() => handleStepChange(idx)}
                    className={cn(
                      "w-full text-left flex items-start gap-3 p-3 rounded transition-all duration-200",
                      idx === activeStepIndex
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-card border border-transparent"
                    )}
                  >
                    <div
                      className={cn(
                        "shrink-0 mt-0.5",
                        idx === activeStepIndex ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      <ItineraryIcon type={step.type} />
                    </div>
                    <div>
                      <p
                        className={cn(
                          "font-sans text-xs uppercase tracking-widest mb-0.5",
                          idx === activeStepIndex
                            ? "text-primary"
                            : "text-muted-foreground"
                        )}
                      >
                        {step.type}
                      </p>
                      <p
                        className={cn(
                          "font-sans text-sm leading-tight",
                          idx === activeStepIndex ? "text-foreground" : "text-foreground/70"
                        )}
                      >
                        {step.title}
                      </p>
                    </div>
                    {idx === activeStepIndex && (
                      <div className="ml-auto shrink-0 w-1 self-stretch bg-primary rounded-full" />
                    )}
                  </button>
                ))}
              </div>
            )}

            <Separator className="bg-border/40 my-6" />

            {/* CTA */}
            <Button
              data-testid="tour-enquire-btn"
              className="w-full font-sans text-xs uppercase tracking-widest"
              onClick={() => setEnquiryOpen(true)}
            >
              Enquire Now
            </Button>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ paddingTop: "80px" }}>
          {/* Hero image */}
          <div className="flex-1 relative overflow-hidden">
            <div
              className={cn(
                "absolute inset-0 transition-opacity duration-500",
                imageVisible ? "opacity-100" : "opacity-0"
              )}
            >
              <img
                src={currentImage}
                alt={activeStep?.title || tour.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />
            </div>

            {/* Image caption */}
            <div
              className={cn(
                "absolute bottom-0 left-0 right-0 p-8 transition-opacity duration-500",
                imageVisible ? "opacity-100" : "opacity-0"
              )}
            >
              {activeStep && (
                <div>
                  <p className="font-sans text-xs uppercase tracking-widest text-primary mb-1">
                    {activeStep.type}
                  </p>
                  <h2 className="font-serif text-3xl font-light text-foreground">
                    {activeStep.title}
                  </h2>
                </div>
              )}
            </div>
          </div>

          {/* Step description */}
          {activeStep && (
            <div
              className={cn(
                "bg-background border-t border-border/40 p-8 transition-opacity duration-500",
                imageVisible ? "opacity-100" : "opacity-0"
              )}
            >
              <p className="font-sans text-sm text-muted-foreground leading-relaxed max-w-3xl">
                {activeStep.description}
              </p>
            </div>
          )}
        </div>
      </div>

      <Footer />

      {/* Enquiry modal */}
      {tour && (
        <EnquiryModal
          open={enquiryOpen}
          onClose={() => setEnquiryOpen(false)}
          tour={{
            title: tour.title,
            coverImage: tour.coverImage,
            durationDays: tour.durationDays,
            priceFrom: tour.priceFrom,
            location: tour.location,
            featured: tour.featured,
          }}
        />
      )}
    </div>
  );
}
