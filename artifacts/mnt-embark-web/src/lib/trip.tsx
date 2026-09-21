/**
 * What the visitor has told us about the trip they are thinking about, and
 * whether they have seen the welcome dialog.
 *
 * The dates and places were read by the flights and hotels pages, which are
 * gone from this branch (the flight features live on the "flights" branch).
 * Now the travel planner (the first-visit form and the globe it folds into)
 * fills it, and the enquiry forms read it to start the message with the plan.
 *
 * Everything is optional. A visitor who dismisses the dialog and never touches
 * the bar still gets a working site; the pages fall back to showing everything.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface Trip {
  /** ISO yyyy-mm-dd, which is what <input type="date"> speaks. */
  startDate: string | null;
  endDate: string | null;
  /** Free text rather than ids: the visitor types before we know our taxonomy. */
  destination: string | null;
  country: string | null;
  location: string | null;
  /** The attraction, when one was picked. The page lives at /attractions/<slug>. */
  attractionName: string | null;
  attractionSlug: string | null;
  /** How many travelling. Null when not said. */
  guests: number | null;
  /** The kind of stay they want, "none" when they need no hotel. Null when not said. */
  hotelType: string | null;
  /** True once the planner's form has been submitted: the globe then carries the plan. */
  planSet: boolean;
}

export const EMPTY_TRIP: Trip = {
  startDate: null,
  endDate: null,
  destination: null,
  country: null,
  location: null,
  attractionName: null,
  attractionSlug: null,
  guests: null,
  hotelType: null,
  planSet: false,
};

const STORAGE_KEY = "mnt-embark.trip";
const SEEN_KEY = "mnt-embark.welcomed";

interface TripContextValue {
  trip: Trip;
  /** Merge a partial update. Passing null for a field clears it. */
  setTrip: (patch: Partial<Trip>) => void;
  clearTrip: () => void;
  /** True once the welcome dialog has been shown, answered or dismissed. */
  welcomed: boolean;
  markWelcomed: () => void;
  /** Whether anything at all has been filled in. */
  hasAny: boolean;
  hasDates: boolean;
}

const TripContext = createContext<TripContextValue | null>(null);

/*
 * Storage access is wrapped because it throws rather than returning null in a
 * few real situations — Safari private browsing, and browsers set to block
 * site data. A visitor with cookies disabled should still see the site.
 */
function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Nothing to do. The session still works, it just will not be remembered. */
  }
}

export function TripProvider({ children }: { children: ReactNode }) {
  /*
   * Lazy initialisers rather than an effect. Reading storage in an effect means
   * the first paint shows an empty bar and then it fills in, which reads as a
   * flicker on every page load.
   */
  const [trip, setTripState] = useState<Trip>(() => readStored(STORAGE_KEY, EMPTY_TRIP));
  const [welcomed, setWelcomed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      // Cannot tell whether they have been welcomed, so do not nag them.
      return true;
    }
  });

  useEffect(() => {
    writeStored(STORAGE_KEY, trip);
  }, [trip]);

  const setTrip = useCallback((patch: Partial<Trip>) => {
    setTripState((prev) => ({ ...prev, ...patch }));
  }, []);

  const clearTrip = useCallback(() => setTripState(EMPTY_TRIP), []);

  const markWelcomed = useCallback(() => {
    setWelcomed(true);
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* They will see the dialog again next visit. Not worth failing over. */
    }
  }, []);

  const value = useMemo<TripContextValue>(() => {
    const hasDates = Boolean(trip.startDate || trip.endDate);
    return {
      trip,
      setTrip,
      clearTrip,
      welcomed,
      markWelcomed,
      hasDates,
      hasAny:
        hasDates ||
        Boolean(
          trip.destination || trip.country || trip.location || trip.attractionName ||
            trip.guests || trip.hotelType,
        ),
    };
  }, [trip, setTrip, clearTrip, welcomed, markWelcomed]);

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip(): TripContextValue {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error("useTrip must be used inside a TripProvider");
  return ctx;
}

/* ------------------------------------------------------------------ format */

/**
 * Dates as a person would write them, not as the machine stores them.
 *
 * Built on Intl rather than a date library: the only thing needed here is one
 * readable line, and adding date-fns to the bundle for it would cost more than
 * it returns.
 */
export function formatTripDates(trip: Trip): string | null {
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  if (trip.startDate && trip.endDate) {
    // Same month reads better without repeating it: "4 – 12 Mar 2027".
    const a = new Date(`${trip.startDate}T00:00:00`);
    const b = new Date(`${trip.endDate}T00:00:00`);
    if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
      return `${a.getDate()} – ${fmt(trip.endDate)}`;
    }
    return `${fmt(trip.startDate)} – ${fmt(trip.endDate)}`;
  }
  if (trip.startDate) return `From ${fmt(trip.startDate)}`;
  if (trip.endDate) return `Until ${fmt(trip.endDate)}`;
  return null;
}

/** "Mara Crossing, Maasai Mara, Kenya" from whichever of the place fields are filled in. */
export function formatTripPlace(trip: Trip): string | null {
  const parts = [trip.attractionName, trip.location, trip.destination, trip.country]
    .map((p) => p?.trim())
    .filter((p, i, arr) => Boolean(p) && arr.indexOf(p) === i);
  return parts.length ? parts.join(", ") : null;
}

/** "14–24 Oct" or "28 Oct–3 Nov": short enough for the globe. */
export function formatTripDatesShort(trip: Trip): string | null {
  const d = (iso: string) => new Date(`${iso}T00:00:00`);
  const mon = (x: Date) => x.toLocaleDateString("en-GB", { month: "short" });
  if (trip.startDate && trip.endDate) {
    const a = d(trip.startDate);
    const b = d(trip.endDate);
    return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
      ? `${a.getDate()}–${b.getDate()} ${mon(b)}`
      : `${a.getDate()} ${mon(a)}–${b.getDate()} ${mon(b)}`;
  }
  const one = trip.startDate ?? trip.endDate;
  return one ? `${d(one).getDate()} ${mon(d(one))}` : null;
}

export const HOTEL_TYPES = [
  { value: "none", label: "No hotel needed" },
  { value: "luxury-hotel", label: "Luxury hotel" },
  { value: "boutique", label: "Boutique hotel" },
  { value: "resort", label: "Resort" },
  { value: "lodge", label: "Safari lodge or camp" },
  { value: "villa", label: "Private villa" },
] as const;

export const hotelLabel = (v: string | null) => HOTEL_TYPES.find((h) => h.value === v)?.label ?? null;

/**
 * The plan in words, for the top of an enquiry's message. Only the lines the
 * visitor actually filled in; an empty plan gives null, so the form stays blank.
 */
export function tripSummary(trip: Trip): string | null {
  const nights = tripNights(trip);
  const lines = [
    formatTripPlace(trip) && `Place: ${formatTripPlace(trip)}`,
    formatTripDates(trip) && `Dates: ${formatTripDates(trip)}${nights ? ` (${nights} nights)` : ""}`,
    trip.guests && `Guests: ${trip.guests >= 10 ? "10 or more" : trip.guests}`,
    hotelLabel(trip.hotelType) && `Stay: ${hotelLabel(trip.hotelType)}`,
  ].filter(Boolean);
  return lines.length ? `My travel plan\n${lines.join("\n")}\n\n` : null;
}

/** Nights between the two dates, when both are set and in order. */
export function tripNights(trip: Trip): number | null {
  if (!trip.startDate || !trip.endDate) return null;
  const ms =
    new Date(`${trip.endDate}T00:00:00`).getTime() -
    new Date(`${trip.startDate}T00:00:00`).getTime();
  const nights = Math.round(ms / 86_400_000);
  return nights > 0 ? nights : null;
}
