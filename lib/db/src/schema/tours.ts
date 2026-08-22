import { pgTable, text, serial, integer, timestamp, boolean, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const toursTable = pgTable("tours", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  coverImage: text("cover_image").notNull(),
  images: text("images").array().notNull().default([]),
  location: text("location").notNull(),
  durationDays: integer("duration_days").notNull().default(1),
  priceFrom: real("price_from").notNull().default(0),
  featured: boolean("featured").notNull().default(false),
  categoryId: integer("category_id"),
  destinationId: integer("destination_id"),
  itinerarySteps: jsonb("itinerary_steps").notNull().default([]),
  embedding: jsonb("embedding").$type<number[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const itineraryStepSchema = z.object({
  type: z.enum(["Pickup", "Flight", "Visa", "Layover", "Ride", "Hotel", "Activities"]),
  title: z.string(),
  description: z.string(),
  image: z.string().nullable().optional(),
});

export const insertTourSchema = createInsertSchema(toursTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTour = z.infer<typeof insertTourSchema>;
export type Tour = typeof toursTable.$inferSelect;
