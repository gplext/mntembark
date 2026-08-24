import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { slugSchema } from "./_shared";

/**
 * CATEGORIES — the nine curated buckets.
 *
 *   Cruise · Island & Coast · Mountain & Wilderness · Safari
 *   Architecture & History · Family Fun · Relaxation & Spa
 *   Rail & Road · Active Lifestyle
 *
 * These are NOT tags. Each one earns a hero image, written copy and a slot
 * in the main navigation. That is the whole difference: a category is a
 * destination page in its own right, a tag is a filter checkbox.
 *
 * Keep this list closed. Nine is a good number; fifteen is a warning sign.
 * When something new comes up, it is almost always an Activity tag.
 *
 * WHAT CHANGED: added slug (for /categories/safari), icon and displayOrder.
 */
export const categoriesTable = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),

    /** URL segment: /categories/mountain-wilderness */
    slug: text("slug"),

    name: text("name").notNull(),
    description: text("description").notNull(),
    coverImage: text("cover_image").notNull(),

    /** Icon key for nav and filter chips (lucide / heroicons). */
    icon: text("icon"),

    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("categories_slug_key").on(t.slug),
    uniqueIndex("categories_name_key").on(t.name),
  ],
);

export const insertCategorySchema = createInsertSchema(categoriesTable, {
  slug: slugSchema,
  name: z.string().min(1).max(60),
}).omit({ id: true, createdAt: true });

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categoriesTable.$inferSelect;
