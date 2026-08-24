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
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { toursTable } from "./tours";
import { slugSchema } from "./_shared";

/**
 * ACTIVITIES
 * ==========
 * What you actually DO on a tour: Swimming, Hiking, Cycling, Dining...
 *
 * Three tables:
 *   activity_groups  -> the filter sections   (Water, Land & Adventure...)
 *   activities       -> the values inside     (Swimming, Hiking & Trekking)
 *   tour_activities  -> many-to-many to tours
 *
 * A tour has many activities and an activity belongs to many tours, so the
 * link has to be its own table. There is no way to express that with a
 * column on `tours`.
 */

/* ------------------------------------------------------------------ *
 * activity_groups — the four filter sections
 * ------------------------------------------------------------------ */

export const activityGroupsTable = pgTable(
  "activity_groups",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),

    /** Short line under the section heading in the filter sidebar. */
    description: text("description"),

    /** Optional banner for a section landing page. Path or URL. */
    coverImage: text("cover_image"),

    /** Icon key for the section heading (lucide / heroicons). */
    icon: text("icon"),

    /** "single" = radio buttons, "multiple" = checkboxes. */
    selectionMode: text("selection_mode").notNull().default("multiple"),

    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("activity_groups_slug_key").on(t.slug),
    index("activity_groups_order_idx").on(t.displayOrder),
  ],
);

/* ------------------------------------------------------------------ *
 * activities
 * ------------------------------------------------------------------ */

export const activitiesTable = pgTable(
  "activities",
  {
    id: serial("id").primaryKey(),

    /** Every activity belongs to exactly one group. No orphans, no "Other". */
    groupId: integer("group_id")
      .notNull()
      .references(() => activityGroupsTable.id, { onDelete: "restrict" }),

    /** Public identity — the URL segment. Immutable once live. */
    slug: text("slug").notNull(),

    /** Display label. Safe to reword at any time. */
    name: text("name").notNull(),

    /**
     * Intro copy for /activities/[slug] and the tooltip in the filter.
     * Nullable on purpose — see the note at the bottom of this file.
     */
    description: text("description"),

    /**
     * Hero image for the activity landing page and the card background.
     * Path or full URL — matches the `cover_image` convention already used
     * on tours, categories, destinations and journals.
     */
    coverImage: text("cover_image"),

    /**
     * Small monochrome icon for the filter checkbox and the chips on a tour
     * page. Separate from coverImage: one is a 24px glyph, the other is a
     * 1600px photograph. Trying to use one for both looks bad in both places.
     */
    icon: text("icon"),

    /**
     * Synonyms that resolve to THIS activity instead of creating a duplicate.
     * "bike" and "biking" both point at Cycling.
     */
    aliases: text("aliases").array().notNull().default(sql`'{}'::text[]`),

    /** Merge pointer — see the merge recipe in TAXONOMY.md. Never delete. */
    redirectToId: integer("redirect_to_id").references(
      (): AnyPgColumn => activitiesTable.id,
      { onDelete: "set null" },
    ),

    /** Appears in the public filter sidebar. */
    isFilterable: boolean("is_filterable").notNull().default(true),

    /**
     * Search engines may index this activity's landing page.
     * Separate flag on purpose — a page with two tours and no written intro
     * is thin content. Default false; promote when it earns it.
     */
    isIndexable: boolean("is_indexable").notNull().default(false),

    /** Refreshed by the nightly job. For sorting facets, not correctness. */
    usageCount: integer("usage_count").notNull().default(0),

    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("activities_slug_key").on(t.slug),
    index("activities_group_idx").on(t.groupId, t.displayOrder),
    index("activities_aliases_idx").using("gin", t.aliases),
  ],
);

/* ------------------------------------------------------------------ *
 * tour_activities — the many-to-many
 * ------------------------------------------------------------------ */

export const tourActivitiesTable = pgTable(
  "tour_activities",
  {
    tourId: integer("tour_id")
      .notNull()
      .references(() => toursTable.id, { onDelete: "cascade" }),
    activityId: integer("activity_id")
      .notNull()
      .references(() => activitiesTable.id, { onDelete: "cascade" }),

    /** Order of the chips on the tour page. */
    displayOrder: smallint("display_order").notNull().default(0),
  },
  (t) => [
    // Composite PK also guarantees an activity can't be added twice to the
    // same tour — the database rejects it, no application check needed.
    primaryKey({ columns: [t.tourId, t.activityId] }),
    // The PK already indexes tour_id (leftmost column), so "what does this
    // tour do?" is fast for free. This covers the OTHER direction —
    // "which tours have Hiking?" — for the /activities/[slug] pages.
    index("tour_activities_activity_idx").on(t.activityId),
  ],
);

/* ------------------------------------ Zod ------------------------------ */

export const insertActivityGroupSchema = createInsertSchema(
  activityGroupsTable,
  {
    slug: slugSchema,
    name: z.string().min(1).max(60),
    selectionMode: z.enum(["single", "multiple"]),
  },
).omit({ id: true, createdAt: true });

export const insertActivitySchema = createInsertSchema(activitiesTable, {
  slug: slugSchema,
  name: z.string().min(1).max(60),
  description: z.string().max(600).nullish(),
  coverImage: z.string().min(1).max(500).nullish(),
  aliases: z.array(slugSchema).max(12),
}).omit({ id: true, createdAt: true, usageCount: true });

export const insertTourActivitySchema = createInsertSchema(tourActivitiesTable);

export type InsertActivityGroup = z.infer<typeof insertActivityGroupSchema>;
export type ActivityGroup = typeof activityGroupsTable.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activitiesTable.$inferSelect;
export type TourActivity = typeof tourActivitiesTable.$inferSelect;

/** Enforce in the service layer — the database does not check this. */
export const MAX_ACTIVITIES_PER_TOUR = 10;

/* ------------------------------------------------------------------ *
 * WHY description AND coverImage ARE NULLABLE
 * ------------------------------------------------------------------ *
 * Every other table you have makes `description` and `cover_image` NOT
 * NULL, and that is right for them: a category or destination without copy
 * and a hero image is a broken page.
 *
 * An activity is different. It works as a filter checkbox the moment it
 * exists — no copy needed. Requiring both up front would mean you cannot
 * add "Kitesurfing" on a Tuesday without also commissioning a photograph.
 *
 * The rule that replaces the constraint: an activity may not be marked
 * `isIndexable` until it HAS a description and a coverImage. Filterable
 * from day one, crawlable once someone has done the work. That check
 * belongs in your admin save handler, not in the database.
 * ------------------------------------------------------------------ */
