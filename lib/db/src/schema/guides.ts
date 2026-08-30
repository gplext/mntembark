import { pgTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { toursTable } from "./tours";

/**
 * TOUR GUIDES
 * ===========
 * The editorial write-up shown for a tour on /guide.
 *
 * That page used to assemble its prose from three hardcoded arrays picked by
 * `tour.id % arrayLength`, so every tour got real-looking copy that nobody had
 * written and nobody could change. This table is where the authored version
 * lives.
 *
 * One row per tour, so `tour_id` is the primary key rather than a serial of its
 * own: a tour has one guide entry or none. There is no separate "guides" list
 * to browse — a guide entry has no meaning apart from the tour it describes,
 * which is also why the row is deleted with its tour.
 *
 * Absence is normal. A tour with no row here still renders on /guide using the
 * generated fallback, so adding a tour never leaves a hole on the page and the
 * copy can be written later.
 */
export const tourGuidesTable = pgTable("tour_guides", {
  /**
   * PK and FK at once. Cascade because the write-up describes this tour
   * specifically — there is nothing to keep once the tour is gone.
   */
  tourId: integer("tour_id")
    .primaryKey()
    .references(() => toursTable.id, { onDelete: "cascade" }),

  /** Three paragraphs, in the order the page prints them. */
  opener: text("opener").notNull(),
  body: text("body").notNull(),
  closer: text("closer").notNull(),

  /**
   * The named guide credited above the copy ("Your guide · Amina Cherkaoui").
   * Nullable as a set: a tour may have authored copy with nobody credited, and
   * the page hides the whole block when there is no name.
   */
  guideName: text("guide_name"),
  guideRole: text("guide_role"),
  guideNote: text("guide_note"),

  /**
   * Lets a draft sit in the database without appearing on the site. An
   * unpublished entry falls back to the generated copy exactly as a missing
   * row does, so unpublishing is never destructive.
   */
  isPublished: boolean("is_published").notNull().default(true),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ------------------------------------ Zod ------------------------------ */

export const insertTourGuideSchema = createInsertSchema(tourGuidesTable, {
  opener: z.string().min(1).max(2000),
  body: z.string().min(1).max(2000),
  closer: z.string().min(1).max(2000),
  guideName: z.string().max(80).nullish(),
  guideRole: z.string().max(80).nullish(),
  guideNote: z.string().max(300).nullish(),
}).omit({ updatedAt: true });

export type InsertTourGuide = z.infer<typeof insertTourGuideSchema>;
export type TourGuide = typeof tourGuidesTable.$inferSelect;
