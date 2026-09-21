import {
  pgTable,
  text,
  serial,
  integer,
  smallint,
  timestamp,
  boolean,
  real,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { slugSchema } from "./_shared";
import { locationsTable } from "./locations";
import { categoriesTable } from "./categories";
import { activitiesTable } from "./activities";
import { tourClassificationEnum } from "./tours";

/**
 * ATTRACTIONS: one place worth travelling to. Country + location + name.
 *
 * This is what the site sells now. Destinations, categories and activities
 * all lead here, the way they used to lead to tours. A tour, if tours come
 * back, is an ordered list of attractions with a day number on each. It is
 * not a bigger attraction, which is why the tours table is left alone and
 * nothing here points at it.
 *
 * WHERE AN ATTRACTION IS
 *
 * Only the location is stored. The country is the location's country, and
 * the destinations it appears under are the ones that list that location or
 * that country. There is no destination_id column on purpose. "East Africa"
 * already says which places it covers, so a second copy of that fact on
 * every attraction could only drift from it. An attraction in Zanzibar
 * appears under every destination that includes Zanzibar or Tanzania.
 */
export const attractionsTable = pgTable(
  "attractions",
  {
    id: serial("id").primaryKey(),
    /** URL segment: /attractions/ngorongoro-crater */
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    /** One or two sentences for the cards. The page shows `description`. */
    summary: text("summary"),
    description: text("description").notNull(),
    coverImage: text("cover_image").notNull(),
    images: text("images").array().notNull().default([]),

    locationId: integer("location_id")
      .notNull()
      .references(() => locationsTable.id, { onDelete: "restrict" }),

    /** Same three tiers and the same badge as tours. */
    classification: tourClassificationEnum("classification").notNull().default("standard"),
    /** Homepage placement. Not a badge. */
    featured: boolean("featured").notNull().default(false),

    /** Free text: "Half day", "2 to 3 hours", "Full day". */
    visitDuration: text("visit_duration"),
    /** Optional. Null prints no price at all rather than "$0". */
    priceFrom: real("price_from"),

    /**
     * "Hotels available" on the page, with an optional line underneath.
     * Text rather than bookings: the site no longer sells rooms or flights.
     */
    hotelsAvailable: boolean("hotels_available").notNull().default(false),
    stayNote: text("stay_note"),

    /**
     * How to reach, what to prepare, then anything else. See attractionStepsSchema.
     */
    steps: jsonb("steps").$type<AttractionStep[]>().notNull().default([]),

    /** Hidden from the public site when false. The admin panel still lists it. */
    isActive: boolean("is_active").notNull().default(true),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("attractions_slug_key").on(t.slug),
    index("attractions_location_idx").on(t.locationId),
    index("attractions_featured_idx").on(t.featured, t.displayOrder),
  ],
);

/**
 * Several categories per attraction. The first by display_order is the main
 * one: it sets the badge on the card and the breadcrumb.
 */
export const attractionCategoriesTable = pgTable(
  "attraction_categories",
  {
    attractionId: integer("attraction_id")
      .notNull()
      .references(() => attractionsTable.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categoriesTable.id, { onDelete: "cascade" }),
    displayOrder: smallint("display_order").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.attractionId, t.categoryId] }),
    index("attraction_categories_category_idx").on(t.categoryId),
  ],
);

export const attractionActivitiesTable = pgTable(
  "attraction_activities",
  {
    attractionId: integer("attraction_id")
      .notNull()
      .references(() => attractionsTable.id, { onDelete: "cascade" }),
    activityId: integer("activity_id")
      .notNull()
      .references(() => activitiesTable.id, { onDelete: "cascade" }),
    displayOrder: smallint("display_order").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.attractionId, t.activityId] }),
    index("attraction_activities_activity_idx").on(t.activityId),
  ],
);

/* ------------------------------------------------------------------ steps */

export const ATTRACTION_STEP_KINDS = ["reach", "prepare", "custom"] as const;
export type AttractionStepKind = (typeof ATTRACTION_STEP_KINDS)[number];

/** The headings the two fixed steps always print under. */
export const FIXED_STEP_TITLES = {
  reach: "How to reach",
  prepare: "What to prepare",
} as const;

export const MAX_ATTRACTION_STEPS = 10;
export const MAX_STEP_IMAGES = 8;

export const attractionStepSchema = z.object({
  kind: z.enum(ATTRACTION_STEP_KINDS),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1, "Write something for every step").max(4000),
  images: z.array(z.string().min(1)).max(MAX_STEP_IMAGES).default([]),
});
export type AttractionStep = z.infer<typeof attractionStepSchema>;

/**
 * Every attraction has "How to reach" first and "What to prepare" second,
 * then any number of custom steps up to the cap.
 *
 * Kept as one ordered list, not two columns plus a list, so the page and the
 * admin form walk one array. The rule about the first two is enforced here
 * rather than trusted to the form.
 */
export const attractionStepsSchema = z
  .array(attractionStepSchema)
  .min(2)
  .max(MAX_ATTRACTION_STEPS)
  .superRefine((steps, ctx) => {
    if (steps[0]?.kind !== "reach") {
      ctx.addIssue({ code: "custom", message: 'The first step must be "How to reach"' });
    }
    if (steps[1]?.kind !== "prepare") {
      ctx.addIssue({ code: "custom", message: 'The second step must be "What to prepare"' });
    }
    if (steps.slice(2).some((s) => s.kind !== "custom")) {
      ctx.addIssue({ code: "custom", message: "Only the first two steps can be the fixed ones" });
    }
  });

/* ------------------------------------------------------------------- body */

export const MAX_CATEGORIES_PER_ATTRACTION = 5;
export const MAX_ACTIVITIES_PER_ATTRACTION = 10;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

/**
 * What the admin form sends. Category and activity ids ride along so one
 * request saves the whole attraction, in one transaction.
 *
 * No `.default()` on anything: `.partial()` for PATCH must leave a missing
 * key missing. A default that survives `.partial()` is how a PATCH that
 * only meant to change the name once wiped an airline's photographs.
 */
export const attractionBodySchema = z.object({
  slug: slugSchema.optional(),
  name: z.string().trim().min(1).max(160),
  summary: optionalText(300),
  description: z.string().trim().min(1).max(8000),
  coverImage: z.string().trim().min(1),
  images: z.array(z.string().min(1)).max(20),
  locationId: z.number().int().positive(),
  classification: z.enum(["standard", "special", "exclusive"]),
  featured: z.boolean(),
  visitDuration: optionalText(60),
  priceFrom: z.number().nonnegative().nullish().transform((v) => v ?? null),
  hotelsAvailable: z.boolean(),
  stayNote: optionalText(300),
  steps: attractionStepsSchema,
  isActive: z.boolean(),
  displayOrder: z.number().int(),
  categoryIds: z.array(z.number().int().positive()).max(MAX_CATEGORIES_PER_ATTRACTION),
  activityIds: z.array(z.number().int().positive()).max(MAX_ACTIVITIES_PER_ATTRACTION),
});
export type AttractionBody = z.infer<typeof attractionBodySchema>;

export const attractionPatchSchema = attractionBodySchema.partial();

export type Attraction = typeof attractionsTable.$inferSelect;
