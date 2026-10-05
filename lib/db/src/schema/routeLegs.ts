import {
  pgTable,
  text,
  real,
  timestamp,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

/**
 * ROUTE LEGS — who actually flies between two airports, from AeroDataBox.
 *
 * One row per (origin, destination, airline). Nothing here is written by hand;
 * scripts/refresh-routes.mjs fills it from the API and overwrites each origin
 * wholesale, so a route an airline has dropped disappears on the next run
 * rather than lingering.
 *
 * ── WHY LEGS AND NOT ROUTES ────────────────────────────────────────────────
 *
 * Nothing flies Pakistan to East Africa direct. Every itinerary this company
 * sells connects once, and the API only publishes direct routes out of a
 * single airport — so a one-stop journey is not something it can be asked
 * for. It has to be assembled: the legs out of Lahore, the legs out of Doha,
 * and the airlines that appear in both.
 *
 * That assembly is a join, not a second table. Storing computed connections
 * would mean two things to keep in step, and the join is cheap — a few
 * thousand rows at most, indexed both ways.
 *
 * ── WHAT THIS IS FOR ───────────────────────────────────────────────────────
 *
 * Checking the curated airlines table, not replacing it. The API is good and
 * not perfect: it lists Air Djibouti under another carrier's code, and around
 * a tenth of its destinations arrive with no IATA code at all. It is a second
 * opinion worth having, which is different from an authority worth obeying.
 */

export const routeLegsTable = pgTable(
  "route_legs",
  {
    /** IATA of the departure airport, always three uppercase letters. */
    fromIata: text("from_iata").notNull(),
    toIata: text("to_iata").notNull(),

    /**
     * The destination as the feed named it, kept for display.
     *
     * "Arusha Kilimanjaro" is more use on an admin screen than "JRO", and the
     * feed's own spelling is what someone comparing the two will recognise.
     */
    toName: text("to_name"),
    /** ISO-2 of the destination country — how a destination is matched. */
    toCountry: text("to_country"),

    /**
     * The airline, normalised.
     *
     * Part of the primary key because it is the only identifier every operator
     * has: Fly Jinnah comes back with no IATA code at all, under three
     * different names depending on which airport you asked.
     */
    airlineName: text("airline_name").notNull(),
    airlineIata: text("airline_iata"),

    /** Flights per day, averaged by the feed over the preceding week. */
    avgDaily: real("avg_daily"),

    observedAt: timestamp("observed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.fromIata, t.toIata, t.airlineName] }),
    /*
     * The PK covers "what leaves Lahore". This covers the other direction —
     * "who arrives at Kilimanjaro" — which is the half of the join that runs
     * against every hub at once.
     */
    index("route_legs_to_idx").on(t.toIata),
    index("route_legs_airline_idx").on(t.airlineName),
  ],
);

/* ------------------------------------------------------------------ Zod */

const iata = z
  .string()
  .regex(/^[A-Z]{3}$/, "three uppercase letters, e.g. DOH");

export const routeLegSchema = z.object({
  toIata: iata,
  toName: z.string().max(200).nullish(),
  toCountry: z
    .string()
    .regex(/^[A-Z]{2}$/, "two uppercase letters, e.g. TZ")
    .nullish(),
  airlineName: z.string().min(1).max(200),
  airlineIata: z
    .string()
    .regex(/^[A-Z0-9]{2}$/)
    .nullish(),
  avgDaily: z.number().nonnegative().nullish(),
});

/**
 * The body of a refresh: every leg observed out of one airport.
 *
 * Whole-airport replacement rather than per-leg upsert, because the useful
 * signal is as much what has *gone* as what is there. A partial update cannot
 * tell you an airline stopped flying somewhere.
 */
export const routeLegsBodySchema = z.object({
  legs: z.array(routeLegSchema).max(500),
});

export const routeLegsOriginParamSchema = z.object({ iata });

export type RouteLeg = typeof routeLegsTable.$inferSelect;
export type RouteLegInput = z.infer<typeof routeLegSchema>;

/**
 * Where a journey may begin. Used by the connections query as the set of
 * "origin" airports, and by the refresh script as the airports to poll first.
 */
export const PAKISTAN_ORIGINS = ["LHE", "KHI", "ISB"] as const;
