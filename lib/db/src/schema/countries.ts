import {
  pgTable,
  text,
  serial,
  integer,
  real,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { slugSchema } from "./_shared";

/**
 * COUNTRIES — the real-world political places.
 *
 * One row per country, ever. Replaces the free-text `country` column that
 * used to sit on every destination row, where "UAE", "U.A.E." and "United
 * Arab Emirates" were three different unjoinable strings.
 */
export const countriesTable = pgTable(
  "countries",
  {
    id: serial("id").primaryKey(),

    /** URL segment: /countries/thailand */
    slug: text("slug").notNull(),

    name: text("name").notNull(),

    /** Path or URL. */
    image: text("image"),

    /**
     * ISO 3166-1 alpha-2 (TH, AE, KE). This is what drives flag icons,
     * currency defaults, phone codes and visa content — all of which break
     * quietly when the country is a string that might be spelled three ways.
     */
    code: text("code"),

    /** Centroid latitude (-90 to +90) for map placement. */
    latitude: real("latitude"),

    /** Centroid longitude (-180 to +180) for map placement. */
    longitude: real("longitude"),

    description: text("description"),

    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("countries_slug_key").on(t.slug),
    uniqueIndex("countries_name_key").on(t.name),
  ],
);

export const insertCountrySchema = createInsertSchema(countriesTable, {
  slug: slugSchema,
  name: z.string().min(1).max(120),
  code: z
    .string()
    .length(2)
    .regex(/^[A-Z]{2}$/, "Uppercase ISO 3166-1 alpha-2")
    .nullish(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
}).omit({ id: true, createdAt: true });

export type InsertCountry = z.infer<typeof insertCountrySchema>;
export type Country = typeof countriesTable.$inferSelect;
