import { Router, type IRouter } from "express";
import { and, eq, count } from "drizzle-orm";
import { db, attractionsTable, destinationsTable, categoriesTable, journalsTable } from "@workspace/db";
import { GetStatsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/stats", async (_req, res): Promise<void> => {
  const [attractionCount] = await db.select({ count: count() }).from(attractionsTable).where(eq(attractionsTable.isActive, true));
  const [destinationCount] = await db.select({ count: count() }).from(destinationsTable);
  const [categoryCount] = await db.select({ count: count() }).from(categoriesTable);
  const [journalCount] = await db.select({ count: count() }).from(journalsTable);
  const [featuredCount] = await db
    .select({ count: count() })
    .from(attractionsTable)
    .where(and(eq(attractionsTable.isActive, true), eq(attractionsTable.featured, true)));

  res.json(
    GetStatsResponse.parse({
      attractionCount: attractionCount.count,
      destinationCount: destinationCount.count,
      categoryCount: categoryCount.count,
      journalCount: journalCount.count,
      featuredAttractionCount: featuredCount.count,
    })
  );
});

export default router;
