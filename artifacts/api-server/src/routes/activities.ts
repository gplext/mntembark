import { Router, type IRouter } from "express";
import { eq, sql, asc, count } from "drizzle-orm";
import {
  db,
  activitiesTable,
  activityGroupsTable,
  tourActivitiesTable,
} from "@workspace/db";
import { getActivityFilters, getActivityBySlug } from "@workspace/db/queries";
import { serialize } from "../lib/serialize";
import { requireAdmin } from "../middleware/requireAdmin";
import {
  ListActivityFiltersResponse,
  GetActivityBySlugResponse,
  ListActivityGroupsResponse,
  CreateActivityGroupBody,
  CreateActivityGroupResponse,
  UpdateActivityGroupParams,
  UpdateActivityGroupBody,
  UpdateActivityGroupResponse,
  DeleteActivityGroupParams,
  ListAllActivitiesResponse,
  CreateActivityBody,
  CreateActivityResponse,
  UpdateActivityParams,
  UpdateActivityBody,
  UpdateActivityResponse,
  DeleteActivityParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

/**
 * Postgres unique-violation. Slugs are unique in the database, and letting it
 * be the one to decide avoids the check-then-insert race where two admins
 * saving the same slug at once both pass the check.
 */
const UNIQUE_VIOLATION = "23505";

/*
 * Walks the cause chain. Drizzle does not rethrow the driver's error as-is —
 * it wraps it in a DrizzleQueryError carrying the SQL and params, and hangs the
 * original off `cause`. Checking only the top-level object misses every
 * violation, which is how the first version of this returned a 500 with a stack
 * trace where it meant to return a 409.
 */
function uniqueViolation(
  err: unknown,
): { constraint: string | undefined } | null {
  let cur: unknown = err;
  for (let depth = 0; cur != null && depth < 5; depth++) {
    const e = cur as { code?: string; constraint?: string; cause?: unknown };
    if (typeof cur === "object" && e.code === UNIQUE_VIOLATION) {
      return { constraint: e.constraint };
    }
    cur = e.cause;
  }
  return null;
}

/**
 * Which field the admin actually has to change.
 *
 * `activities` is unique on name as well as slug — a constraint that exists in
 * the database but not in the drizzle schema — so reporting every violation as
 * a slug clash sends someone off editing the wrong field while the name they
 * chose is the real problem.
 */
function duplicateMessage(
  constraint: string | undefined,
  values: { slug?: string; name?: string },
): string {
  if (constraint?.includes("name") && values.name) {
    return `The name "${values.name}" is already used by another activity.`;
  }
  if (values.slug) {
    return `Slug "${values.slug}" is already in use.`;
  }
  return "That slug is already in use.";
}

/**
 * The rule the activities schema documents but the database deliberately does
 * not enforce: an activity may be filterable from the moment it exists, but it
 * may not be marked indexable until someone has written a description and
 * chosen a cover image. A landing page with neither is thin content.
 *
 * Takes the merged row rather than the request body, so a PATCH that sets only
 * isIndexable is judged against the description and image already stored.
 */
function indexableIsEarned(row: {
  isIndexable?: boolean | null;
  description?: string | null;
  coverImage?: string | null;
}): boolean {
  if (!row.isIndexable) return true;
  return Boolean(row.description?.trim()) && Boolean(row.coverImage?.trim());
}

const INDEXABLE_ERROR =
  "An activity needs both a description and a cover image before it can be marked indexable.";

// Specific route first — avoids any ambiguity with the parameterised segment
router.get("/activities/:slug", async (req, res): Promise<void> => {
  const { slug } = req.params;
  const activity = await getActivityBySlug(slug);
  if (!activity) {
    res.status(404).json({ error: "Activity not found" });
    return;
  }
  res.json(GetActivityBySlugResponse.parse(serialize(activity)));
});

router.get("/activities", async (_req, res): Promise<void> => {
  const groups = await getActivityFilters();
  res.json(ListActivityFiltersResponse.parse(serialize(groups)));
});

/* ==================================================================== *
 * Administration
 *
 * Distinct from the two public routes above, which serve the filter
 * sidebar: those return only filterable activities, grouped, with live
 * tour counts. These return rows as stored, including the ones the
 * public site never shows, because you cannot edit what you cannot see.
 * ==================================================================== */

router.get(
  "/admin/activity-groups",
  requireAdmin,
  async (_req, res): Promise<void> => {
    const rows = await db
      .select({
        id: activityGroupsTable.id,
        slug: activityGroupsTable.slug,
        name: activityGroupsTable.name,
        description: activityGroupsTable.description,
        coverImage: activityGroupsTable.coverImage,
        icon: activityGroupsTable.icon,
        selectionMode: activityGroupsTable.selectionMode,
        displayOrder: activityGroupsTable.displayOrder,
        // Left join so a group with no activities still appears — those are
        // exactly the ones an admin needs to see in order to fill or remove.
        activityCount: sql<number>`count(${activitiesTable.id})::int`,
      })
      .from(activityGroupsTable)
      .leftJoin(
        activitiesTable,
        eq(activitiesTable.groupId, activityGroupsTable.id),
      )
      .groupBy(activityGroupsTable.id)
      .orderBy(asc(activityGroupsTable.displayOrder), asc(activityGroupsTable.name));

    res.json(ListActivityGroupsResponse.parse(serialize(rows)));
  },
);

router.post(
  "/admin/activity-groups",
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = CreateActivityGroupBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    try {
      const [row] = await db
        .insert(activityGroupsTable)
        .values(parsed.data)
        .returning();
      res.status(201).json(
        CreateActivityGroupResponse.parse(
          serialize({ ...row, activityCount: 0 }),
        ),
      );
    } catch (err) {
      const dup = uniqueViolation(err);
      if (dup) {
        res
          .status(409)
          .json({ error: duplicateMessage(dup.constraint, parsed.data) });
        return;
      }
      throw err;
    }
  },
);

router.patch(
  "/admin/activity-groups/:id",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = UpdateActivityGroupParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateActivityGroupBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    try {
      const [row] = await db
        .update(activityGroupsTable)
        .set(parsed.data)
        .where(eq(activityGroupsTable.id, params.data.id))
        .returning();
      if (!row) {
        res.status(404).json({ error: "Activity group not found" });
        return;
      }

      const [{ activityCount }] = await db
        .select({ activityCount: count() })
        .from(activitiesTable)
        .where(eq(activitiesTable.groupId, row.id));

      res.json(
        UpdateActivityGroupResponse.parse(serialize({ ...row, activityCount })),
      );
    } catch (err) {
      const dup = uniqueViolation(err);
      if (dup) {
        res
          .status(409)
          .json({ error: duplicateMessage(dup.constraint, parsed.data) });
        return;
      }
      throw err;
    }
  },
);

router.delete(
  "/admin/activity-groups/:id",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = DeleteActivityGroupParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    /*
     * activities.group_id is ON DELETE RESTRICT, so the database would refuse
     * this anyway — but it would surface as a 500 with a constraint name in it.
     * Checking first turns that into a 409 an admin screen can explain.
     */
    const [{ activityCount }] = await db
      .select({ activityCount: count() })
      .from(activitiesTable)
      .where(eq(activitiesTable.groupId, params.data.id));

    if (activityCount > 0) {
      res.status(409).json({
        error: `This group still holds ${activityCount} ${
          activityCount === 1 ? "activity" : "activities"
        }. Move or delete them first.`,
      });
      return;
    }

    const [row] = await db
      .delete(activityGroupsTable)
      .where(eq(activityGroupsTable.id, params.data.id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Activity group not found" });
      return;
    }
    res.sendStatus(204);
  },
);

router.get(
  "/admin/activities",
  requireAdmin,
  async (_req, res): Promise<void> => {
    const rows = await db
      .select({
        id: activitiesTable.id,
        groupId: activitiesTable.groupId,
        groupName: activityGroupsTable.name,
        slug: activitiesTable.slug,
        name: activitiesTable.name,
        description: activitiesTable.description,
        coverImage: activitiesTable.coverImage,
        icon: activitiesTable.icon,
        aliases: activitiesTable.aliases,
        isFilterable: activitiesTable.isFilterable,
        isIndexable: activitiesTable.isIndexable,
        displayOrder: activitiesTable.displayOrder,
        /*
         * Counted live rather than read from activities.usage_count, which a
         * nightly job maintains and is explicitly documented as good enough for
         * sorting facets but not for correctness. An admin deciding whether an
         * activity is safe to delete needs the true number.
         */
        tourCount: sql<number>`count(${tourActivitiesTable.tourId})::int`,
      })
      .from(activitiesTable)
      .innerJoin(
        activityGroupsTable,
        eq(activityGroupsTable.id, activitiesTable.groupId),
      )
      .leftJoin(
        tourActivitiesTable,
        eq(tourActivitiesTable.activityId, activitiesTable.id),
      )
      /*
       * Group by both primary keys, not by the group's name. Postgres lets you
       * select and order by any column of a table you have grouped by its
       * primary key, but grouping by activity_groups.name alone leaves
       * display_order neither grouped nor aggregated — and the ORDER BY below
       * uses it, so the query is rejected outright.
       */
      .groupBy(activitiesTable.id, activityGroupsTable.id)
      .orderBy(
        asc(activityGroupsTable.displayOrder),
        asc(activitiesTable.displayOrder),
        asc(activitiesTable.name),
      );

    res.json(ListAllActivitiesResponse.parse(serialize(rows)));
  },
);

router.post("/admin/activities", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateActivityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!indexableIsEarned(parsed.data)) {
    res.status(400).json({ error: INDEXABLE_ERROR });
    return;
  }

  const [group] = await db
    .select({ name: activityGroupsTable.name })
    .from(activityGroupsTable)
    .where(eq(activityGroupsTable.id, parsed.data.groupId));
  if (!group) {
    res.status(400).json({ error: "That activity group does not exist." });
    return;
  }

  try {
    const [row] = await db.insert(activitiesTable).values(parsed.data).returning();
    res.status(201).json(
      CreateActivityResponse.parse(
        serialize({ ...row, groupName: group.name, tourCount: 0 }),
      ),
    );
  } catch (err) {
    const dup = uniqueViolation(err);
    if (dup) {
      res.status(409).json({ error: duplicateMessage(dup.constraint, parsed.data) });
      return;
    }
    throw err;
  }
});

router.patch(
  "/admin/activities/:id",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = UpdateActivityParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateActivityBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [existing] = await db
      .select()
      .from(activitiesTable)
      .where(eq(activitiesTable.id, params.data.id));
    if (!existing) {
      res.status(404).json({ error: "Activity not found" });
      return;
    }

    // Judge the indexable rule against the row as it will be after the patch,
    // not against the patch alone — otherwise flipping isIndexable on its own
    // would always fail, and clearing a description on an already-indexable
    // activity would always pass.
    if (!indexableIsEarned({ ...existing, ...parsed.data })) {
      res.status(400).json({ error: INDEXABLE_ERROR });
      return;
    }

    if (parsed.data.groupId !== undefined) {
      const [group] = await db
        .select({ id: activityGroupsTable.id })
        .from(activityGroupsTable)
        .where(eq(activityGroupsTable.id, parsed.data.groupId));
      if (!group) {
        res.status(400).json({ error: "That activity group does not exist." });
        return;
      }
    }

    try {
      const [row] = await db
        .update(activitiesTable)
        .set(parsed.data)
        .where(eq(activitiesTable.id, params.data.id))
        .returning();

      const [group] = await db
        .select({ name: activityGroupsTable.name })
        .from(activityGroupsTable)
        .where(eq(activityGroupsTable.id, row.groupId));

      const [{ tourCount }] = await db
        .select({ tourCount: count() })
        .from(tourActivitiesTable)
        .where(eq(tourActivitiesTable.activityId, row.id));

      res.json(
        UpdateActivityResponse.parse(
          serialize({ ...row, groupName: group?.name ?? "", tourCount }),
        ),
      );
    } catch (err) {
      const dup = uniqueViolation(err);
      if (dup) {
        res
          .status(409)
          .json({ error: duplicateMessage(dup.constraint, parsed.data) });
        return;
      }
      throw err;
    }
  },
);

router.delete(
  "/admin/activities/:id",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = DeleteActivityParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    /*
     * tour_activities cascades on activity delete, so deleting an activity in
     * use would silently strip it from every tour that has it. Refuse instead
     * and let the admin see the number first — this is the one destructive
     * action on this screen that cannot be undone by re-creating the row.
     */
    const [{ tourCount }] = await db
      .select({ tourCount: count() })
      .from(tourActivitiesTable)
      .where(eq(tourActivitiesTable.activityId, params.data.id));

    if (tourCount > 0) {
      res.status(409).json({
        error: `This activity is on ${tourCount} ${
          tourCount === 1 ? "tour" : "tours"
        }. Remove it from them before deleting it.`,
      });
      return;
    }

    const [row] = await db
      .delete(activitiesTable)
      .where(eq(activitiesTable.id, params.data.id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Activity not found" });
      return;
    }
    res.sendStatus(204);
  },
);

export default router;
