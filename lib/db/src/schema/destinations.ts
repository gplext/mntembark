import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const destinationsTable = pgTable("destinations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  country: text("country").notNull(),
  region: text("region"),
  description: text("description").notNull(),
  coverImage: text("cover_image").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDestinationSchema = createInsertSchema(destinationsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDestination = z.infer<typeof insertDestinationSchema>;
export type Destination = typeof destinationsTable.$inferSelect;
