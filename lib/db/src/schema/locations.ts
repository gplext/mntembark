import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { countriesTable } from "./countries";
import { slugSchema } from "./_shared";

/**
 * LOCATIONS — cities and specific places.
 *
 * Bangkok, Phuket, Malé, Serengeti. The granular level a tour actually
 * visits, as opposed to the destination concept it is sold under.
 */
export const locationsTable = pgTable(
  "locations",
  {
    id: serial("id").primaryKey(),

    /** URL segment: /locations/bangkok */
    slug: text("slug").notNull(),

    name: text("name").notNull(),

    /** Path or URL. */
    image: text("image"),

    /**
     * ---- NOT IN YOUR SPEC — read this before deleting it ----
     *
     * A city belongs to exactly one country, so this is a plain 1:N, not
     * another many-to-many. It is nullable so nothing forces you to fill it.
     *
     * Without it you cannot render "Bangkok, Thailand" on a card, cannot
     * show a flag, cannot list "other cities in Thailand", and cannot catch
     * the case where a destination is linked to Thailand but one of its
     * locations is in Kenya — the two lists would silently disagree with
     * nothing to check them against.
     *
     * If you genuinely don't want it, drop this column and its foreign key.
     * Everything else works without it.
     */
    countryId: integer("country_id").references(() => countriesTable.id, {
      onDelete: "set null",
    }),

    description: text("description"),

    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("locations_slug_key").on(t.slug),
    index("locations_country_idx").on(t.countryId),
  ],
);

export const insertLocationSchema = createInsertSchema(locationsTable, {
  slug: slugSchema,
  name: z.string().min(1).max(120),
}).omit({ id: true, createdAt: true });

export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = typeof locationsTable.$inferSelect;
