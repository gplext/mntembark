import {
  pgTable,
  text,
  serial,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * ADMINS — System administrators and sub-administrators.
 *
 * Super admins can create and manage sub-admins.
 * Sub-admins have all portal permissions of super admin.
 */
export const adminsTable = pgTable(
  "admins",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    isSuperAdmin: boolean("is_super_admin").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("admins_email_key").on(t.email),
  ],
);

export const insertAdminSchema = createInsertSchema(adminsTable, {
  email: z.string().email(),
  passwordHash: z.string().min(1),
  isSuperAdmin: z.boolean().default(false),
}).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertAdmin = z.infer<typeof insertAdminSchema>;
export type Admin = typeof adminsTable.$inferSelect;
