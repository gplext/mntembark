import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, toursTable, tourGuidesTable } from "@workspace/db";
import { serialize } from "../lib/serialize";
import { requireAdmin } from "../middleware/requireAdmin";
import {
  ListTourGuidesResponse,
  ListAllTourGuidesResponse,
  GetTourGuideParams,
  GetTourGuideResponse,
  SetTourGuideParams,
  SetTourGuideBody,
  SetTourGuideResponse,
  DeleteTourGuideParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

/**
 * Every authored entry in one request.
 *
 * /guide renders all tours on one page, so fetching each tour's copy
 * separately would mean one request per tour and a wave of 404s for the tours
 * nobody has written up yet. The page takes the whole set and matches by
 * tourId.
 *
 * Unpublished entries are withheld here rather than filtered on the client:
 * a draft that ships to the browser is published, whatever the flag says.
 */
router.get("/guides", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(tourGuidesTable)
    .where(eq(tourGuidesTable.isPublished, true))
    .orderBy(asc(tourGuidesTable.tourId));

  res.json(ListTourGuidesResponse.parse(serialize(rows)));
});

/**
 * The same set including drafts, for the editor.
 *
 * The admin screen lists every tour and marks which have copy. Building that
 * from /guides would mean an unpublished draft reads as "not written" and its
 * editor opens empty, inviting someone to rewrite work that already exists.
 */
router.get("/admin/guides", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(tourGuidesTable)
    .orderBy(asc(tourGuidesTable.tourId));

  res.json(ListAllTourGuidesResponse.parse(serialize(rows)));
});

/**
 * Admin-only, and unlike the public list it returns drafts — this is what the
 * editor loads to keep working on one.
 */
router.get(
  "/tours/:id/guide",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = GetTourGuideParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [row] = await db
      .select()
      .from(tourGuidesTable)
      .where(eq(tourGuidesTable.tourId, params.data.id));

    if (!row) {
      // Ordinary state, not a failure: no copy has been written yet.
      res.status(404).json({ error: "No guide copy for this tour" });
      return;
    }
    res.json(GetTourGuideResponse.parse(serialize(row)));
  },
);

router.put(
  "/tours/:id/guide",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = SetTourGuideParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = SetTourGuideBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    /*
     * tour_guides.tour_id is a foreign key, so an unknown id would fail as a
     * constraint violation and surface as a 500. Check first and answer 404,
     * which is what a client deleting a tour in another tab should see.
     */
    const [tour] = await db
      .select({ id: toursTable.id })
      .from(toursTable)
      .where(eq(toursTable.id, params.data.id));
    if (!tour) {
      res.status(404).json({ error: "Tour not found" });
      return;
    }

    /*
     * PUT replaces, so an omitted optional field means "no value", not "leave
     * whatever was there". Spelling the nulls out matters: passing only the
     * provided keys to `set` would make it impossible to clear a guide's name
     * by submitting an empty field — the old name would survive every save.
     */
    const values = {
      tourId: params.data.id,
      opener: parsed.data.opener,
      body: parsed.data.body,
      closer: parsed.data.closer,
      guideName: parsed.data.guideName ?? null,
      guideRole: parsed.data.guideRole ?? null,
      guideNote: parsed.data.guideNote ?? null,
      isPublished: parsed.data.isPublished ?? true,
    };

    /*
     * Upsert rather than insert-or-update in two steps: the primary key makes
     * "one row per tour" the database's job, and PUT is meant to be
     * idempotent — saving the same copy twice must not depend on whether a row
     * happened to exist when the request started.
     */
    const [row] = await db
      .insert(tourGuidesTable)
      .values(values)
      .onConflictDoUpdate({
        target: tourGuidesTable.tourId,
        set: { ...values, updatedAt: new Date() },
      })
      .returning();

    res.json(SetTourGuideResponse.parse(serialize(row)));
  },
);

/**
 * Reverts the tour to the generated copy on /guide. Destructive in the sense
 * that the authored text is gone, which is why the admin screen asks first;
 * unpublishing is the non-destructive way to take copy off the site.
 */
router.delete(
  "/tours/:id/guide",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = DeleteTourGuideParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [row] = await db
      .delete(tourGuidesTable)
      .where(eq(tourGuidesTable.tourId, params.data.id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "No guide copy for this tour" });
      return;
    }
    res.sendStatus(204);
  },
);

export default router;
