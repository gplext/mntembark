import { eq } from "drizzle-orm";
import { db, toursTable } from "@workspace/db";

/**
 * Turning a title into the URL segment it will live at.
 *
 * The NFD pass is not decoration: "Galápagos: Out of Season" without it slugs
 * to "gal-pagos-out-of-season", because the accented character is stripped as
 * punctuation rather than folded to its base letter. That URL then ships, gets
 * linked, and is not something you want to change later.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/**
 * A slug for a new tour that is not already taken.
 *
 * `tours_slug_key` is a unique index, so two tours called "Serengeti" would
 * collide and the second insert would fail with a constraint error the person
 * saving cannot act on. Suffixing is the quieter answer: the second one
 * becomes "serengeti-2" and both save.
 *
 * The loop is bounded because an unbounded one against a database is how a
 * request hangs forever if something unexpected is true.
 */
export async function uniqueTourSlug(title: string): Promise<string> {
  const base = slugify(title) || "tour";

  for (let n = 1; n <= 50; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const [taken] = await db
      .select({ id: toursTable.id })
      .from(toursTable)
      .where(eq(toursTable.slug, candidate))
      .limit(1);
    if (!taken) return candidate;
  }

  /*
   * Fifty titles that slugify identically means something is wrong upstream,
   * but a save must not fail over it. The timestamp is ugly and unique.
   */
  return `${base}-${Date.now()}`;
}
