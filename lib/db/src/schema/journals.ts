import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const journalsTable = pgTable("journals", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull(),
  content: text("content").notNull(),
  coverImage: text("cover_image").notNull(),
  images: text("images").array().notNull().default([]),
  location: text("location").notNull(),
  author: text("author").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertJournalSchema = createInsertSchema(journalsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertJournal = z.infer<typeof insertJournalSchema>;
export type Journal = typeof journalsTable.$inferSelect;
