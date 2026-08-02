import { Router, type IRouter } from "express";
import { eq, count } from "drizzle-orm";
import { db, toursTable, destinationsTable, categoriesTable, journalsTable } from "@workspace/db";
import { GetStatsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/stats", async (_req, res): Promise<void> => {
  const [tourCount] = await db.select({ count: count() }).from(toursTable);
  const [destinationCount] = await db.select({ count: count() }).from(destinationsTable);
  const [categoryCount] = await db.select({ count: count() }).from(categoriesTable);
  const [journalCount] = await db.select({ count: count() }).from(journalsTable);
  const [featuredCount] = await db.select({ count: count() }).from(toursTable).where(eq(toursTable.featured, true));

  res.json(
    GetStatsResponse.parse({
      tourCount: tourCount.count,
      destinationCount: destinationCount.count,
      categoryCount: categoryCount.count,
      journalCount: journalCount.count,
      featuredTourCount: featuredCount.count,
    })
  );
});

export default router;
