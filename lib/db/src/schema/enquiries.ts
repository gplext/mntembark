import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const enquirySourceEnum = pgEnum("enquiry_source", ["tour", "contact"]);
export const enquiryStatusEnum = pgEnum("enquiry_status", ["new", "handled"]);

export const enquiriesTable = pgTable(
  "enquiries",
  {
    id: serial("id").primaryKey(),
    source: enquirySourceEnum("source").notNull(),
    status: enquiryStatusEnum("status").notNull().default("new"),
    title: text("title"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    isTravelAdvisor: boolean("is_travel_advisor"),
    notes: text("notes"),
    acceptPrivacy: boolean("accept_privacy").notNull().default(false),
    receiveUpdates: boolean("receive_updates").notNull().default(false),
    tourTitle: text("tour_title"),
    tourLocation: text("tour_location"),
    tourDurationDays: integer("tour_duration_days"),
    enquiryType: text("enquiry_type"),
    budget: text("budget"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    handledAt: timestamp("handled_at", { withTimezone: true }),
  },
  (table) => [
    index("enquiries_status_created_idx").on(table.status, table.createdAt.desc()),
    index("enquiries_created_idx").on(table.createdAt.desc()),
  ],
);

export const insertEnquirySchema = createInsertSchema(enquiriesTable).omit({
  id: true,
  status: true,
  createdAt: true,
  handledAt: true,
});
export type InsertEnquiry = z.infer<typeof insertEnquirySchema>;
export type Enquiry = typeof enquiriesTable.$inferSelect;