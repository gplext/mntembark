import { Router, type IRouter } from "express";
import { getCountries } from "@workspace/db/queries";
import { serialize } from "../lib/serialize";
import { ListCountriesResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/countries", async (_req, res): Promise<void> => {
  const rows = await getCountries();
  res.json(ListCountriesResponse.parse(serialize(rows)));
});

export default router;
