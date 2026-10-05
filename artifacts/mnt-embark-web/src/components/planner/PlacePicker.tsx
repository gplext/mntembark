/**
 * Where to: a country, a place in it, or one attraction there.
 *
 * One searchable list, grouped the way people think about a trip: the
 * country first and largest, its cities and places under it, and the
 * attractions under those. Any level can be picked, and picking a place
 * or an attraction fills in the levels above it, so "Maasai Mara" is
 * never sent without "Kenya".
 */

import { useMemo, useState } from "react";
import { useListCountries, useListLocations } from "@workspace/api-client-react";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/mnt-embark/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@workspace/mnt-embark/components/ui/command";
import { cn } from "@workspace/mnt-embark/lib/utils";
import { MapPin, Landmark, Globe2, X } from "lucide-react";
import { useAttractions } from "@/lib/attractions-api";

export interface PlaceValue {
  country: string | null;
  location: string | null;
  attractionName: string | null;
  attractionSlug: string | null;
}

interface Group {
  country: string;
  places: { name: string; attractions: { name: string; slug: string }[] }[];
}

export function placeLabel(v: PlaceValue): { main: string; sub: string | null } | null {
  if (v.attractionName) return { main: v.attractionName, sub: [v.location, v.country].filter(Boolean).join(", ") || null };
  if (v.location) return { main: v.location, sub: v.country };
  if (v.country) return { main: v.country, sub: null };
  return null;
}

export default function PlacePicker({
  value,
  onChange,
  triggerClassName,
}: {
  value: PlaceValue;
  onChange: (v: PlaceValue) => void;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const { data: countries } = useListCountries();
  const { data: locations } = useListLocations();
  const { data: attractions } = useAttractions();

  /*
   * Countries that have places or attractions come first: those are the ones
   * we can say something about. The rest still follow, because "somewhere in
   * Peru" is a perfectly good start to an enquiry.
   */
  const groups = useMemo<Group[]>(() => {
    const byCountry = new Map<string, Group>();
    const group = (c: string) => {
      if (!byCountry.has(c)) byCountry.set(c, { country: c, places: [] });
      return byCountry.get(c)!;
    };
    const place = (g: Group, name: string) => {
      let p = g.places.find((x) => x.name === name);
      if (!p) g.places.push((p = { name, attractions: [] }));
      return p;
    };
    for (const l of locations ?? []) if (l.countryName) place(group(l.countryName), l.name);
    for (const a of attractions ?? []) {
      if (!a.country) continue;
      place(group(a.country.name), a.location.name).attractions.push({ name: a.name, slug: a.slug });
    }
    const withContent = [...byCountry.values()].sort((a, b) => a.country.localeCompare(b.country));
    for (const g of withContent) g.places.sort((a, b) => b.attractions.length - a.attractions.length || a.name.localeCompare(b.name));
    const rest = (countries ?? [])
      .map((c) => c.name)
      .filter((n) => !byCountry.has(n))
      .sort()
      .map((country) => ({ country, places: [] }));
    return [...withContent, ...rest];
  }, [countries, locations, attractions]);

  const pick = (v: PlaceValue) => {
    onChange(v);
    setOpen(false);
  };
  const label = placeLabel(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn("w-full text-left flex items-center gap-2 min-w-0", triggerClassName)}
          data-testid="planner-place"
        >
          <MapPin className="h-3.5 w-3.5 text-[#A8823E] shrink-0" />
          {label ? (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] text-[#16130F]">{label.main}</span>
              {label.sub && <span className="block truncate text-[10px] uppercase tracking-[0.12em] text-[#A8823E]">{label.sub}</span>}
            </span>
          ) : (
            <span className="flex-1 truncate text-[13px] text-[#8B8173]">Country, city or attraction</span>
          )}
          {label && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear place"
              onClick={(e) => {
                e.stopPropagation();
                onChange({ country: null, location: null, attractionName: null, attractionSlug: null });
              }}
              className="text-[#8B8173] hover:text-[#16130F]"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="p-0 w-[min(22rem,calc(100vw-2rem))] border-[#E6DCC8] bg-[#FDFBF7] z-[70]"
      >
        <Command className="bg-transparent">
          <CommandInput placeholder="Search a country, city or attraction…" className="text-[13px]" />
          <CommandList className="max-h-[320px]">
            <CommandEmpty className="py-6 text-center text-xs text-[#8B8173]">
              Nothing matches. Type it in your enquiry and we will find it.
            </CommandEmpty>
            {groups.map((g) => (
              <CommandGroup key={g.country}>
                <CommandItem
                  value={`${g.country}`}
                  onSelect={() => pick({ country: g.country, location: null, attractionName: null, attractionSlug: null })}
                  className="gap-2 py-2"
                >
                  <Globe2 className="h-4 w-4 text-[#A8823E]" />
                  <span className="font-serif text-[17px] leading-none text-[#16130F]">{g.country}</span>
                  <span className="ml-auto text-[9px] uppercase tracking-[0.15em] text-[#A8823E]">Country</span>
                </CommandItem>
                {g.places.map((p) => (
                  <div key={p.name}>
                    <CommandItem
                      value={`${g.country} ${p.name}`}
                      onSelect={() => pick({ country: g.country, location: p.name, attractionName: null, attractionSlug: null })}
                      className="gap-2 pl-7 text-[13px]"
                    >
                      <MapPin className="h-3.5 w-3.5 text-[#A8823E]" />
                      {p.name}
                    </CommandItem>
                    {p.attractions.map((a) => (
                      <CommandItem
                        key={a.slug}
                        value={`${g.country} ${p.name} ${a.name}`}
                        onSelect={() => pick({ country: g.country, location: p.name, attractionName: a.name, attractionSlug: a.slug })}
                        className="gap-2 pl-12 text-[12px] text-[#5E564B]"
                      >
                        <Landmark className="h-3 w-3 text-[#A8823E]/70" />
                        {a.name}
                      </CommandItem>
                    ))}
                  </div>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
