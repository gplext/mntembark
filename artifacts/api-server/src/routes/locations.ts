import { Router, type IRouter } from "express";
import { getLocations, createLocation, updateLocation, deleteLocation } from "@workspace/db/queries";
import { serialize } from "../lib/serialize";
import { requireAdmin } from "../middleware/requireAdmin";
import {
  ListLocationsResponse,
  CreateLocationBody,
  CreateLocationResponse,
  UpdateLocationParams,
  UpdateLocationBody,
  UpdateLocationResponse,
  DeleteLocationParams,
  DeleteLocationResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/locations", async (_req, res): Promise<void> => {
  const rows = await getLocations();
  res.json(ListLocationsResponse.parse(serialize(rows)));
});

router.post("/locations", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateLocationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const location = await createLocation(parsed.data);
  res.status(201).json(CreateLocationResponse.parse(serialize(location)));
});

router.patch("/locations/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateLocationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateLocationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updated = await updateLocation(params.data.id, parsed.data);
  if (!updated) {
    res.status(404).json({ error: "Location not found" });
    return;
  }
  res.json(UpdateLocationResponse.parse(serialize(updated)));
});

router.delete("/locations/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteLocationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const success = await deleteLocation(params.data.id);
  if (!success) {
    res.status(404).json({ error: "Location not found" });
    return;
  }
  res.json(DeleteLocationResponse.parse({ success: true }));
});

export default router;
