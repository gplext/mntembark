import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';

const CORE_SWATCHES = [
  { name: 'Primary — Gold', className: 'bg-primary' },
  { name: 'Secondary — Charcoal', className: 'bg-secondary' },
  { name: 'Accent — Light Gold', className: 'bg-accent' },
] as const;

const SUPPORTING_SWATCHES = [
  { name: 'Background', className: 'border bg-background' },
  { name: 'Foreground (text)', className: 'bg-foreground' },
  { name: 'Card', className: 'border bg-card' },
  { name: 'Muted', className: 'bg-muted' },
  { name: 'Destructive', className: 'bg-destructive' },
  { name: 'Border', className: 'bg-border' },
  { name: 'Ring', className: 'bg-ring' },
] as const;

const CHART_SWATCHES = [
  { name: 'Chart 1', className: 'bg-chart-1' },
  { name: 'Chart 2', className: 'bg-chart-2' },
  { name: 'Chart 3', className: 'bg-chart-3' },
  { name: 'Chart 4', className: 'bg-chart-4' },
  { name: 'Chart 5', className: 'bg-chart-5' },
] as const;

const TYPE_SCALE = [
  { label: 'Display', className: 'font-serif text-4xl font-light tracking-wide' },
  { label: 'Heading', className: 'font-serif text-2xl font-semibold' },
  { label: 'Subheading', className: 'font-sans text-lg font-medium tracking-wide uppercase' },
  { label: 'Body', className: 'font-sans text-base' },
  { label: 'Label', className: 'font-sans text-sm font-medium' },
  { label: 'Caption', className: 'font-sans text-sm text-muted-foreground' },
] as const;

const SPACING_SCALE = [
  { label: '4', className: 'w-4' },
  { label: '8', className: 'w-8' },
  { label: '12', className: 'w-12' },
  { label: '16', className: 'w-16' },
  { label: '24', className: 'w-24' },
] as const;

function Swatch({
  name,
  className,
}: {
  name: string;
  className: string;
}) {
  return (
    <div className="space-y-2">
      <div className={`h-16 rounded ${className}`} />
      <p className="text-xs font-medium text-muted-foreground">{name}</p>
    </div>
  );
}

export function OverviewPage() {
  return (
    <div className="space-y-6">
      {/* Brand statement */}
      <section className="rounded border bg-card p-6 text-card-foreground">
        <p className="font-sans text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Brand identity
        </p>
        <h2 className="mt-3 font-serif text-3xl font-light tracking-wide">
          MNT Embark
        </h2>
        <p className="mt-1 font-sans text-sm text-muted-foreground italic">
          Exclusive like no other
        </p>
        <p className="mt-4 font-sans text-sm leading-relaxed text-muted-foreground max-w-xl">
          Ultra-luxury all-inclusive tours for elite travelers. The visual language is built on jet-black surfaces, warm gold accents, and the interplay of a high-contrast serif display typeface with a refined geometric sans. Every element should feel unhurried, tactile, and confident.
        </p>
      </section>

      {/* Core palette */}
      <section className="rounded border bg-card p-6 text-card-foreground">
        <h2 className="font-sans text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Core palette
        </h2>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {CORE_SWATCHES.map((swatch) => (
            <Swatch key={swatch.name} {...swatch} />
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Typography */}
        <section className="rounded border bg-card p-6 text-card-foreground">
          <h2 className="font-sans text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Typography
          </h2>
          <div className="mt-4 space-y-3">
            {TYPE_SCALE.map((entry) => (
              <p key={entry.label} className={entry.className}>
                {entry.label}
              </p>
            ))}
          </div>
        </section>

        {/* In use */}
        <section className="rounded border bg-card p-6 text-card-foreground">
          <h2 className="font-sans text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Components in context
          </h2>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="font-serif font-light tracking-wide">Patagonia Expedition</CardTitle>
              <CardDescription>
                12-day all-inclusive private tour — Torres del Paine
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="overview-name">Travel dates</Label>
                <Input id="overview-name" placeholder="Select departure" />
              </div>
              <div className="flex items-center gap-2">
                <Switch defaultChecked id="overview-notify" />
                <Label htmlFor="overview-notify">Private jet transfer</Label>
                <Badge className="ml-auto">Exclusive</Badge>
              </div>
            </CardContent>
            <CardFooter className="gap-2">
              <Button>Reserve</Button>
              <Button variant="outline">Enquire</Button>
            </CardFooter>
          </Card>
        </section>
      </div>

      {/* Component strip */}
      <section className="space-y-4 rounded border bg-card p-6 text-card-foreground">
        <h2 className="font-sans text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Key components
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Reserve now</Button>
          <Button variant="secondary">Learn more</Button>
          <Button variant="outline">Enquire</Button>
          <Button variant="ghost">Dismiss</Button>
          <Badge>Exclusive</Badge>
          <Badge variant="secondary">Luxury</Badge>
          <Badge variant="outline">All-inclusive</Badge>
        </div>
      </section>
    </div>
  );
}

export function ColorsPage() {
  return (
    <div className="space-y-8 rounded border bg-card p-6 text-card-foreground">
      <section className="space-y-4">
        <div>
          <h2 className="font-serif text-xl font-light">Brand colors</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The signature gold, deep charcoal, and lighter gold accent that define MNT Embark.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {CORE_SWATCHES.map((swatch) => (
            <Swatch key={swatch.name} {...swatch} />
          ))}
        </div>
      </section>

      <section className="space-y-4 border-t pt-6">
        <div>
          <h2 className="font-serif text-xl font-light">Semantic and surface colors</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Roles for backgrounds, text, borders, muted content, and danger states.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
          {SUPPORTING_SWATCHES.map((swatch) => (
            <Swatch key={swatch.name} {...swatch} />
          ))}
        </div>
      </section>

      <section className="space-y-4 border-t pt-6">
        <div>
          <h2 className="font-serif text-xl font-light">Chart palette</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Five gold-bronze tones for data visualization — warm, harmonious, on-brand.
          </p>
        </div>
        <div className="grid grid-cols-5 gap-4">
          {CHART_SWATCHES.map((swatch) => (
            <Swatch key={swatch.name} {...swatch} />
          ))}
        </div>
      </section>
    </div>
  );
}

export function FontsPage() {
  return (
    <div className="space-y-8 rounded border bg-card p-6 text-card-foreground">
      <section>
        <h2 className="font-sans text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Display — Cormorant Garamond
        </h2>
        <p className="mt-4 font-serif text-5xl font-light tracking-wide">
          Journey Beyond
        </p>
        <p className="mt-1 font-serif text-3xl italic text-muted-foreground">
          Exclusive like no other
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Cormorant Garamond is the brand's display typeface — high contrast, elegant, and authoritative. Used for headlines, tour names, and editorial moments.
        </p>
      </section>

      <section className="border-t pt-6">
        <h2 className="font-sans text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Body — Montserrat
        </h2>
        <p className="mt-4 font-sans text-base leading-relaxed max-w-xl">
          Every MNT Embark experience is meticulously curated from door to destination. Montserrat brings geometric clarity and refined weight to interface copy, labels, and all functional text.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Montserrat provides clarity and structure. Used for body copy, labels, navigation, UI chrome, and all interactive elements.
        </p>
      </section>

      <section className="border-t pt-6 space-y-4">
        <h2 className="font-sans text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Type scale
        </h2>
        {TYPE_SCALE.map((entry) => (
          <div key={entry.label} className="grid gap-2 sm:grid-cols-[120px_1fr]">
            <span className="pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {entry.label}
            </span>
            <p className={entry.className}>Discover the world's most exclusive destinations.</p>
          </div>
        ))}
      </section>
    </div>
  );
}

export function LayoutPage() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded border bg-card p-6 text-card-foreground">
        <h2 className="font-serif text-xl font-light">Spacing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Base spacing step is 4 px. Components multiply this to build a measured, airy rhythm.
        </p>
        <div className="mt-6 space-y-4">
          {SPACING_SCALE.map((space) => (
            <div key={space.label} className="flex items-center gap-4">
              <span className="w-8 text-xs text-muted-foreground">
                {space.label}
              </span>
              <div className={`h-2 rounded-sm bg-primary ${space.className}`} />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded border bg-card p-6 text-card-foreground">
        <h2 className="font-serif text-xl font-light">Radius</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Base radius is 4 px — architectural and crisp, not rounded or playful. Matches the brand's precise, unhurried character.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-4">
          {[
            { label: 'Small', className: 'rounded-sm' },
            { label: 'Medium', className: 'rounded-md' },
            { label: 'Large', className: 'rounded-lg' },
            { label: 'Extra large', className: 'rounded-xl' },
          ].map((radius) => (
            <div
              key={radius.label}
              className={`flex h-24 items-end border bg-muted p-3 ${radius.className}`}
            >
              <span className="text-xs font-medium">{radius.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
