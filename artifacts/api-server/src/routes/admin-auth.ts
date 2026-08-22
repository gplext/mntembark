import { Router, type IRouter } from "express";
import { requireAdmin } from "../middleware/requireAdmin";
import { seedDatabaseIfEmpty } from "@workspace/db";

const router: IRouter = Router();

router.post("/admin/login", (req, res): void => {
  const { password } = req.body as { password?: string };
  const adminPassword = process.env["ADMIN_PASSWORD"];

  if (!adminPassword) {
    res.status(500).json({ error: "Admin password not configured" });
    return;
  }

  if (!password || password !== adminPassword) {
    res.status(401).json({ error: "Invalid password" });
    return;
  }

  req.session.isAdmin = true;
  res.json({ ok: true });
});

router.post("/admin/logout", (req, res): void => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

router.get("/admin/me", requireAdmin, (_req, res): void => {
  res.json({ isAdmin: true });
});

router.post("/seed", async (_req, res): Promise<void> => {
  try {
    await seedDatabaseIfEmpty(true);
    res.json({ ok: true, message: "Database re-seeded successfully." });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;

