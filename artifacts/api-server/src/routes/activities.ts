import { Router, type IRouter } from "express";
import { getActivityFilters, getActivityBySlug } from "@workspace/db/queries";
import { serialize } from "../lib/serialize";
import {
  ListActivityFiltersResponse,
  GetActivityBySlugResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

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

export default router;
