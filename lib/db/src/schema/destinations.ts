import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { countriesTable } from "./countries";
import { locationsTable } from "./locations";
import { slugSchema } from "./_shared";

/**
 * DESTINATIONS — the curated concept you sell.
 *
 * "Southeast Asia", "The Amalfi Coast", "East Africa", "The Silk Road".
 * Not a political place: a destination spans however many countries and
 * cities it needs to, which is exactly why both links below are
 * many-to-many.
 *
 * Deliberately thin — a name and an image. Everything about WHERE it
 * actually is lives in the join tables.
 *
 * WHAT CHANGED FROM YOUR ORIGINAL TABLE
 * -------------------------------------
 * Your existing rows (Bangkok, Phuket, Malé...) are cities, so the
 * migration copies them into `locations` and turns the free-text `country`
 * column into real `countries` rows. This table is then yours to fill with
 * actual destination concepts.
 *
 * The old columns (`country`, `region`, `description`) are KEPT and made
 * nullable so nothing that still reads them breaks mid-migration.
 */
export const destinationsTable = pgTable(
  "destinations",
  {
    id: serial("id").primaryKey(),

    /** URL segment: /destinations/southeast-asia */
    slug: text("slug"),

    name: text("name").notNull(),

    /**
     * The image. Reuses the `cover_image` column you already have rather
     * than adding a second one — it is already populated and your existing
     * code already reads it. Rename it to `image` later if you want the
     * three place tables to match; it is a one-line ALTER.
     */
    coverImage: text("cover_image"),

    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    /** DEPRECATED — superseded by destination_countries. Kept, nullable. */
    country: text("country"),
    /** DEPRECATED — superseded by destination_locations. Kept, nullable. */
    region: text("region"),
    /** DEPRECATED — no longer required. Kept, nullable. */
    description: text("description"),
  },
  (t) => [uniqueIndex("destinations_slug_key").on(t.slug)],
);

/* ------------------------------------------------------------------ *
 * destination <-> country   (many-to-many)
 * ------------------------------------------------------------------ */

export const destinationCountriesTable = pgTable(
  "destination_countries",
  {
    destinationId: integer("destination_id")
      .notNull()
      .references(() => destinationsTable.id, { onDelete: "cascade" }),
    countryId: integer("country_id")
      .notNull()
      .references(() => countriesTable.id, { onDelete: "cascade" }),
    displayOrder: integer("display_order").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.destinationId, t.countryId] }),
    // Reverse lookup: "which destinations include Thailand?"
    index("destination_countries_country_idx").on(t.countryId),
  ],
);

/* ------------------------------------------------------------------ *
 * destination <-> location   (many-to-many)
 * ------------------------------------------------------------------ */

export const destinationLocationsTable = pgTable(
  "destination_locations",
  {
    destinationId: integer("destination_id")
      .notNull()
      .references(() => destinationsTable.id, { onDelete: "cascade" }),
    locationId: integer("location_id")
      .notNull()
      .references(() => locationsTable.id, { onDelete: "cascade" }),
    displayOrder: integer("display_order").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.destinationId, t.locationId] }),
    index("destination_locations_location_idx").on(t.locationId),
  ],
);

/* ------------------------------------------ Zod ------------------- */

export const insertDestinationSchema = createInsertSchema(destinationsTable, {
  slug: slugSchema,
  name: z.string().min(1).max(120),
}).omit({ id: true, createdAt: true });

export const insertDestinationCountrySchema = createInsertSchema(
  destinationCountriesTable,
);
export const insertDestinationLocationSchema = createInsertSchema(
  destinationLocationsTable,
);

export type InsertDestination = z.infer<typeof insertDestinationSchema>;
export type Destination = typeof destinationsTable.$inferSelect;
export type DestinationCountry = typeof destinationCountriesTable.$inferSelect;
export type DestinationLocation = typeof destinationLocationsTable.$inferSelect;
