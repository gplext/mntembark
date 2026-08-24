import { Router, type IRouter } from "express";
import { getLocations } from "@workspace/db/queries";
import { serialize } from "../lib/serialize";
import { ListLocationsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/locations", async (_req, res): Promise<void> => {
  const rows = await getLocations();
  res.json(ListLocationsResponse.parse(serialize(rows)));
});

export default router;
