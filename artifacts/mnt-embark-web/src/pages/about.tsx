import { useGetStats } from "@workspace/api-client-react";
import { Separator } from "@workspace/mnt-embark/components/ui/separator";
import { Button } from "@workspace/mnt-embark/components/ui/button";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const values = [
  {
    title: "Exclusivity",
    description:
      "We limit our tours to intimate groups, ensuring every detail receives the attention it deserves. When you travel with MNT Embark, the world belongs to you.",
  },
  {
    title: "Authenticity",
    description:
      "We connect you with the true essence of every destination — beyond the tourist trail, into the living heart of each culture and landscape.",
  },
  {
    title: "Precision",
    description:
      "Every element of your journey is choreographed to perfection. Logistics disappear; only the experience remains.",
  },
  {
    title: "Discretion",
    description:
      "Our members trust us with their most precious resource — their time. We honor that trust with absolute privacy and personal care.",
  },
];

const team = [
  {
    name: "Alexandre Morel",
    title: "Founder & Chief Curator",
    bio: "Twenty years crafting the world's most extraordinary private journeys. Former concierge at Hotel de Crillon, Paris.",
  },
  {
    name: "Isabella Chen",
    title: "Director of Experiences",
    bio: "A decade leading expedition design across six continents. Specialist in remote and extreme luxury environments.",
  },
  {
    name: "Rafi Al-Rashid",
    title: "Head of Member Relations",
    bio: "Former private banker turned travel architect. Fluent in five languages; at home in forty countries.",
  },
];

export default function AboutPage() {
  const { data: stats } = useGetStats();

  return (
    <div className="min-h-[100dvh] bg-background">
      <Navbar />

      {/* Hero */}
      <div className="pt-32 pb-24 border-b border-border/30 text-center">
        <div className="max-w-2xl mx-auto px-6">
          <p className="font-sans text-sm font-medium tracking-[0.3em] uppercase text-foreground mb-2">
            MNT EMBARK
          </p>
          <p className="font-sans text-xs font-medium tracking-[0.25em] uppercase text-primary mb-10">
            Beyond the Reach of the Ordinary
          </p>
          <h1 className="font-serif text-6xl md:text-7xl font-light text-foreground leading-[1.05] mb-8">
            Curators of the{" "}
            <em>Unreachable.</em>
          </h1>
          <p className="font-sans text-base text-muted-foreground leading-relaxed mb-10 max-w-lg mx-auto">
            Serving the world's most discerning families with private access to the planet's remaining sanctuaries.
          </p>
          <a
            href="#our-philosophy"
            className="font-sans text-xs tracking-[0.2em] uppercase text-primary border-b border-primary/50 pb-0.5 hover:border-primary transition-colors"
          >
            Our Philosophy
          </a>
        </div>
      </div>

      {/* Philosophy */}
      <div id="philosophy" className="border-b border-border/30">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Text */}
            <div>
              <h2 className="font-serif text-4xl md:text-5xl font-light text-foreground leading-[1.1] mb-8">
                True luxury is the{" "}
                <em className="text-primary not-italic font-serif">absence</em>{" "}
                of the public.
              </h2>
              <p className="font-sans text-sm text-muted-foreground leading-relaxed mb-5">
                We do not sell itineraries. We do not aggregate hotels. We secure access to closed ecosystems, private royal courts, and untouched geographies that remain hidden from standard wealth.
              </p>
              <p className="font-sans text-sm text-muted-foreground leading-relaxed mb-8">
                For the families who have experienced everything, we offer the one thing money rarely buys: absolute exclusivity and profound, unhurried peace.
              </p>
              <Link href="/contact">
                <span className="font-sans text-xs tracking-[0.2em] uppercase text-primary border-b border-primary/50 pb-0.5 hover:border-primary transition-colors cursor-pointer">
                  Discover Our Philosophy
                </span>
              </Link>
            </div>
            {/* Image */}
            <div className="relative overflow-hidden rounded-sm aspect-[4/5] md:aspect-auto md:h-[520px]">
              <img
                src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&q=85&auto=format&fit=crop"
                alt="Private beach sanctuary at golden hour"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="py-16 bg-card/20" data-testid="about-stats">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-8 text-center">
              {[
                { label: "Exclusive Tours", value: stats.tourCount },
                { label: "Destinations", value: stats.destinationCount },
                { label: "Categories", value: stats.categoryCount },
                { label: "Journal Entries", value: stats.journalCount },
                { label: "Featured Journeys", value: stats.featuredTourCount },
              ].map((stat) => (
                <div key={stat.label} data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, "-")}`}>
                  <p className="font-serif text-5xl font-light text-primary mb-2">
                    {stat.value}
                  </p>
                  <p className="font-sans text-xs uppercase tracking-widest text-muted-foreground">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Philosophy / Values */}
      <div id="our-philosophy" className="max-w-7xl mx-auto px-6 py-20">
        <div className="mb-12">
          <p className="font-sans text-xs font-medium uppercase tracking-widest text-primary mb-3">
            What We Stand For
          </p>
          <h2 className="font-serif text-4xl font-light text-foreground">
            Our Philosophy
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {values.map((value) => (
            <div key={value.title} data-testid={`value-${value.title.toLowerCase()}`} className="border-t border-primary/30 pt-6">
              <h3 className="font-serif text-2xl font-light text-foreground mb-4">
                {value.title}
              </h3>
              <p className="font-sans text-sm text-muted-foreground leading-relaxed">
                {value.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      <Separator className="bg-border/20" />

      {/* Team */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="mb-12">
          <p className="font-sans text-xs font-medium uppercase tracking-widest text-primary mb-3">
            The People
          </p>
          <h2 className="font-serif text-4xl font-light text-foreground">
            Our Team
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {team.map((member) => (
            <div
              key={member.name}
              data-testid={`team-member-${member.name.split(" ")[0].toLowerCase()}`}
              className="border border-border/40 rounded p-8 bg-card/20"
            >
              {/* Avatar placeholder */}
              <div className="w-16 h-16 rounded-full bg-card border border-primary/30 flex items-center justify-center mb-6">
                <span className="font-serif text-xl text-primary font-light">
                  {member.name.charAt(0)}
                </span>
              </div>
              <h3 className="font-serif text-xl font-light text-foreground mb-1">
                {member.name}
              </h3>
              <p className="font-sans text-xs uppercase tracking-widest text-primary mb-4">
                {member.title}
              </p>
              <p className="font-sans text-sm text-muted-foreground leading-relaxed">
                {member.bio}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="py-20 bg-card/20 border-t border-border/30">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="w-16 h-px bg-primary mx-auto mb-8" />
          <h2 className="font-serif text-4xl font-light text-foreground mb-4">
            Begin Your Journey
          </h2>
          <p className="font-sans text-sm text-muted-foreground leading-relaxed mb-8">
            Our team is ready to compose your perfect journey. Every detail, personally curated.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/contact">
              <Button
                data-testid="about-contact-cta"
                className="font-sans text-xs uppercase tracking-widest"
              >
                Make an Enquiry
              </Button>
            </Link>
            <Link href="/tours">
              <Button
                variant="outline"
                data-testid="about-tours-cta"
                className="font-sans text-xs uppercase tracking-widest"
              >
                View Tours
              </Button>
            </Link>
          </div>
          <div className="w-16 h-px bg-primary mx-auto mt-8" />
        </div>
      </div>

      <Footer />
    </div>
  );
}
