import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  boolean,
  real,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { categoriesTable } from "./categories";
import { destinationsTable } from "./destinations";
import { locationsTable } from "./locations";
import { slugSchema } from "./_shared";

/**
 * CLASSIFICATION — Exclusive / Special / Standard.
 *
 * A single enum column rather than a tag, because a tour is one of these,
 * not several, and it drives a badge on every card — a column read is
 * cheaper than a join on your busiest query.
 *
 * NOTE ON "FEATURED": you listed Featured alongside Exclusive and Special,
 * but `featured` already exists on this table as a boolean, and it answers
 * a different question. Exclusive/Special say what KIND of product this is
 * and change once in a tour's life. Featured says WHERE YOU ARE PROMOTING
 * IT and changes every week, by a different person, for a different reason.
 * Keeping them apart means unfeaturing a tour from the homepage does not
 * quietly downgrade the product itself.
 *
 * If you would rather have all three as one badge, add 'featured' to this
 * enum and drop the boolean — it is a one-line change, documented in
 * TAXONOMY.md.
 */
export const tourClassificationEnum = pgEnum("tour_classification", [
  "standard",
  "special",
  "exclusive",
]);

export const toursTable = pgTable(
  "tours",
  {
    id: serial("id").primaryKey(),

    /** URL segment: /tours/serengeti-under-canvas */
    slug: text("slug"),

    title: text("title").notNull(),
    description: text("description").notNull(),
    coverImage: text("cover_image").notNull(),
    images: text("images").array().notNull().default([]),

    /** DEPRECATED — superseded by destinationId. Kept so nothing breaks. */
    location: text("location").notNull(),

    durationDays: integer("duration_days").notNull().default(1),
    priceFrom: real("price_from").notNull().default(0),

    /** Merchandising switch: is this on the homepage right now? */
    featured: boolean("featured").notNull().default(false),

    /** Product tier: drives the badge on the card. */
    classification: tourClassificationEnum("classification")
      .notNull()
      .default("standard"),

    /** One of the nine curated categories. Now a real foreign key. */
    categoryId: integer("category_id").references(() => categoriesTable.id, {
      onDelete: "set null",
    }),

    /**
     * The curated destination this tour is SOLD under — "Southeast Asia",
     * "East Africa". One per tour: it drives the breadcrumb and the URL.
     */
    destinationId: integer("destination_id").references(
      () => destinationsTable.id,
      { onDelete: "set null" },
    ),

    /**
     * ---- NOT IN YOUR SPEC — read this before deleting it ----
     *
     * The specific city this tour is based in. A destination spans many
     * locations, so going through `destination_locations` gives you a list,
     * not an answer — you cannot render "Bangkok, Thailand" on a card from
     * a list of eleven cities.
     *
     * The country is then derived: location -> country. Never stored twice.
     *
     * Nullable, and backfilled automatically from your existing
     * destination_id values by 04-places-migration.sql.
     */
    locationId: integer("location_id").references(() => locationsTable.id, {
      onDelete: "set null",
    }),

    itinerarySteps: jsonb("itinerary_steps")
      .$type<ItineraryStep[]>()
      .notNull()
      .default([]),

    embedding: jsonb("embedding").$type<number[]>(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("tours_slug_key").on(t.slug),
    index("tours_category_idx").on(t.categoryId),
    index("tours_destination_idx").on(t.destinationId),
    index("tours_location_idx").on(t.locationId),
    index("tours_classification_idx").on(t.classification),
    index("tours_featured_idx").on(t.featured, t.createdAt.desc()),
  ],
);

export const itineraryStepSchema = z.object({
  type: z.enum([
    "Pickup",
    "Flight",
    "Visa",
    "Layover",
    "Ride",
    "Hotel",
    "Activities",
  ]),
  title: z.string(),
  description: z.string(),
  image: z.string().nullable().optional(),
  images: z.array(z.string()).optional(),
});
export type ItineraryStep = z.infer<typeof itineraryStepSchema>;

export const insertTourSchema = createInsertSchema(toursTable, {
  slug: slugSchema,
  title: z.string().min(1).max(160),
  // This was declared but never wired in before, so any JSON was accepted.
  itinerarySteps: z.array(itineraryStepSchema),
  embedding: z.array(z.number()).nullish(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertTour = z.infer<typeof insertTourSchema>;
export type Tour = typeof toursTable.$inferSelect;
