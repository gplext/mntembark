import { Router, type IRouter } from "express";
import { getCountries, createCountry, updateCountry, deleteCountry } from "@workspace/db/queries";
import { serialize } from "../lib/serialize";
import { requireAdmin } from "../middleware/requireAdmin";
import {
  ListCountriesResponse,
  CreateCountryBody,
  CreateCountryResponse,
  UpdateCountryParams,
  UpdateCountryBody,
  UpdateCountryResponse,
  DeleteCountryParams,
  DeleteCountryResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/countries", async (_req, res): Promise<void> => {
  const rows = await getCountries();
  res.json(ListCountriesResponse.parse(serialize(rows)));
});

router.post("/countries", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateCountryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const country = await createCountry(parsed.data);
  res.status(201).json(CreateCountryResponse.parse(serialize(country)));
});

router.patch("/countries/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateCountryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCountryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updated = await updateCountry(params.data.id, parsed.data);
  if (!updated) {
    res.status(404).json({ error: "Country not found" });
    return;
  }
  res.json(UpdateCountryResponse.parse(serialize(updated)));
});

router.delete("/countries/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteCountryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const success = await deleteCountry(params.data.id);
  if (!success) {
    res.status(404).json({ error: "Country not found" });
    return;
  }
  res.json(DeleteCountryResponse.parse({ success: true }));
});

export default router;
