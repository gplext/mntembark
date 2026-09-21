import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  smallint,
  timestamp,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { destinationsTable } from "./destinations";
import { slugSchema } from "./_shared";

/**
 * AIRLINES
 * ========
 * Who can actually fly a client from Pakistan to somewhere we operate.
 *
 * Two tables:
 *   airlines              -> the carrier, its hub, and its photographs
 *   airline_destinations  -> which of our destinations it serves
 *
 * The link is its own table for the same reason tour_activities is: an airline
 * serves many destinations and a destination is served by many airlines, and
 * there is no way to say that with a column.
 *
 * Which airlines fly where is curated here rather than derived from a dataset.
 * OurAirports publishes airports but no routes; OpenFlights publishes routes
 * but stopped updating them around 2014. Telling a client that an airline
 * flies somewhere it abandoned years ago is worse than showing a shorter list
 * that happens to be true, so this is entered by someone who checked.
 */

export const airlinesTable = pgTable(
  "airlines",
  {
    id: serial("id").primaryKey(),

    /** Public identity — the URL segment on /flights. Immutable once live. */
    slug: text("slug").notNull(),

    /** "Qatar Airways". Display name, safe to reword. */
    name: text("name").notNull(),

    /**
     * Where the airline connects through — Dubai for Emirates, Doha for Qatar.
     *
     * Free text rather than an airport id, because the useful answer is the
     * city a traveller recognises, and some carriers hub through more than one
     * airport in the same city.
     */
    baseCity: text("base_city").notNull(),

    /** IATA of the hub, when it is worth showing on a flight step. */
    baseAirportCode: text("base_airport_code"),

    /** Two-letter IATA carrier code, for reference rather than display. */
    iataCode: text("iata_code"),

    /** One or two sentences for the card. Optional — a logo and a hub is enough. */
    description: text("description"),

    /**
     * Up to three photographs for the Flights list.
     *
     * The cap is not enforced by the database because a fourth photo is not a
     * data integrity problem — it is a layout one, and the admin form is the
     * right place to say so. See MAX_AIRLINE_IMAGES.
     */
    images: text("images").array().notNull().default(sql`'{}'::text[]`),

    /**
     * The two itinerary steps have their own photographs, separate from the
     * gallery above. A shot of the Lahore terminal belongs on the departure
     * step and nowhere else; reusing a gallery image there makes the itinerary
     * look like a slideshow of the same aircraft.
     */
    departureImage: text("departure_image"),
    arrivalImage: text("arrival_image"),

    /** Hidden from the public site without deleting the row or its links. */
    isActive: boolean("is_active").notNull().default(true),

    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("airlines_slug_key").on(t.slug),
    index("airlines_order_idx").on(t.displayOrder),
  ],
);

/* ------------------------------------------------------------------ *
 * airline_destinations — which of our destinations an airline serves
 * ------------------------------------------------------------------ */

export const airlineDestinationsTable = pgTable(
  "airline_destinations",
  {
    airlineId: integer("airline_id")
      .notNull()
      .references(() => airlinesTable.id, { onDelete: "cascade" }),
    destinationId: integer("destination_id")
      .notNull()
      .references(() => destinationsTable.id, { onDelete: "cascade" }),

    /**
     * The airport the airline actually lands at, IATA.
     *
     * Kept per link rather than per airline: the same carrier arrives at
     * Kilimanjaro for one destination and Zanzibar for another, and the
     * itinerary step should name the right one.
     */
    arrivalAirportCode: text("arrival_airport_code"),

    displayOrder: smallint("display_order").notNull().default(0),
  },
  (t) => [
    // Also stops the same airline being added twice to one destination —
    // enforced by the database rather than by remembering to check.
    primaryKey({ columns: [t.airlineId, t.destinationId] }),
    // The PK indexes airline_id already. This covers the other direction,
    // which is the one the Flights page asks: "who flies to Tanzania?"
    index("airline_destinations_destination_idx").on(t.destinationId),
  ],
);

/* ------------------------------------ Zod ------------------------------ */

export const insertAirlineSchema = createInsertSchema(airlinesTable, {
  slug: slugSchema,
  name: z.string().min(1).max(120),
  baseCity: z.string().min(1).max(120),
  baseAirportCode: z
    .string()
    .regex(/^[A-Z]{3}$/, "three uppercase letters, e.g. DXB")
    .nullish(),
  iataCode: z
    .string()
    .regex(/^[A-Z0-9]{2}$/, "two characters, e.g. QR")
    .nullish(),
  description: z.string().max(600).nullish(),
  /*
   * Optional, defaulting to none.
   *
   * drizzle-zod makes a NOT NULL column required even when the table supplies
   * a default, which would mean an airline could not be saved until somebody
   * had found three photographs for it. An airline with a name and a hub and
   * no pictures yet is a perfectly ordinary row, and is exactly what the
   * no-photo fallback case needs.
   */
  images: z.array(z.string().min(1).max(500)).max(3).optional().default([]),
  departureImage: z.string().min(1).max(500).nullish(),
  arrivalImage: z.string().min(1).max(500).nullish(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const updateAirlineSchema = insertAirlineSchema.partial();

export const insertAirlineDestinationSchema = createInsertSchema(
  airlineDestinationsTable,
  {
    arrivalAirportCode: z
      .string()
      .regex(/^[A-Z]{3}$/, "three uppercase letters, e.g. JRO")
      .nullish(),
  },
);

/**
 * Request shapes for the airline routes.
 *
 * They live here, beside the table, rather than in the route file because the
 * API server has no zod dependency of its own — it only has the generated
 * @workspace/api-zod package. Exporting finished schemas from here keeps the
 * route free of validation plumbing and avoids adding a dependency that would
 * make everyone run an install.
 */
export const airlineIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const airlineDestinationsBodySchema = z.object({
  destinations: z
    .array(
      z.object({
        destinationId: z.number().int().positive(),
        arrivalAirportCode: z
          .string()
          .regex(/^[A-Z]{3}$/, "three uppercase letters, e.g. JRO")
          .nullish(),
      }),
    )
    .max(60),
});

export type AirlineDestinationsBody = z.infer<typeof airlineDestinationsBodySchema>;

export type InsertAirline = z.infer<typeof insertAirlineSchema>;
export type Airline = typeof airlinesTable.$inferSelect;
export type AirlineDestination = typeof airlineDestinationsTable.$inferSelect;

/**
 * The Flights list shows three photographs per airline and no more.
 *
 * Enforced in the service layer rather than the database, the same way
 * MAX_ACTIVITIES_PER_TOUR is: it is a decision about how the page looks, and
 * it should be changeable without a migration.
 */
export const MAX_AIRLINE_IMAGES = 3;
