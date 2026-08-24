import { z } from "zod/v4";

/**
 * Shared validators. This file imports nothing from the other schema files
 * on purpose — putting it anywhere else creates a circular import that
 * drizzle-kit fails on with "Cannot access X before initialization".
 */
export const slugSchema = z
  .string()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase, hyphen-separated");
