import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, adminsTable } from "@workspace/db";
import { requireAdmin } from "../middleware/requireAdmin";
import { requireSuperAdmin } from "../middleware/requireSuperAdmin";
import { hashPassword, verifyPassword } from "../lib/password";

const router: IRouter = Router();

// ── Admin Login ─────────────────────────────────────────────────────────────

router.post("/admin/login", async (req, res): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };
  const adminMasterPassword = process.env["ADMIN_PASSWORD"];

  if (!password) {
    res.status(400).json({ error: "Password is required" });
    return;
  }

  const cleanEmail = email?.trim().toLowerCase();

  // 1. Check master password (environment variable override for super admin)
  if (adminMasterPassword && password === adminMasterPassword) {
    req.session.isAdmin = true;
    req.session.isSuperAdmin = true;
    req.session.adminEmail = cleanEmail || "superadmin@mntembark.internal";
    res.json({
      ok: true,
      isSuperAdmin: true,
      email: req.session.adminEmail,
    });
    return;
  }

  // 2. Check registered sub-admins / admins in database
  if (cleanEmail) {
    try {
      const [admin] = await db
        .select()
        .from(adminsTable)
        .where(sql`LOWER(${adminsTable.email}) = ${cleanEmail}`)
        .limit(1);

      if (admin && verifyPassword(password, admin.passwordHash)) {
        req.session.isAdmin = true;
        req.session.isSuperAdmin = admin.isSuperAdmin;
        req.session.adminId = admin.id;
        req.session.adminEmail = admin.email;

        res.json({
          ok: true,
          isSuperAdmin: admin.isSuperAdmin,
          email: admin.email,
        });
        return;
      }
    } catch (err) {
      // In case table is still initializing
      res.status(500).json({ error: "Authentication database error" });
      return;
    }
  }

  res.status(401).json({ error: "Invalid email or password" });
});

// ── Admin Logout ────────────────────────────────────────────────────────────

router.post("/admin/logout", (req, res): void => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// ── Current Admin Session Info ──────────────────────────────────────────────

router.get("/admin/me", requireAdmin, (req, res): void => {
  res.json({
    isAdmin: true,
    isSuperAdmin: req.session?.isSuperAdmin === true,
    email: req.session?.adminEmail ?? "admin",
    id: req.session?.adminId,
  });
});

// ── Sub-Admin Management (Super Admin only) ─────────────────────────────────

router.get("/admin/sub-admins", requireSuperAdmin, async (_req, res): Promise<void> => {
  try {
    const list = await db
      .select({
        id: adminsTable.id,
        email: adminsTable.email,
        isSuperAdmin: adminsTable.isSuperAdmin,
        createdAt: adminsTable.createdAt,
        updatedAt: adminsTable.updatedAt,
      })
      .from(adminsTable)
      .orderBy(sql`${adminsTable.createdAt} DESC`);

    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch sub-admins" });
  }
});

router.post("/admin/sub-admins", requireSuperAdmin, async (req, res): Promise<void> => {
  const { email, password, isSuperAdmin = false } = req.body as {
    email?: string;
    password?: string;
    isSuperAdmin?: boolean;
  };

  const cleanEmail = email?.trim().toLowerCase();

  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    res.status(400).json({ error: "A valid email address is required" });
    return;
  }

  if (!password || typeof password !== "string" || password.length < 4) {
    res.status(400).json({ error: "Password must be at least 4 characters" });
    return;
  }

  try {
    // Check if email already exists
    const [existing] = await db
      .select({ id: adminsTable.id })
      .from(adminsTable)
      .where(sql`LOWER(${adminsTable.email}) = ${cleanEmail}`)
      .limit(1);

    if (existing) {
      res.status(409).json({ error: "An admin with this email already exists" });
      return;
    }

    const passwordHash = hashPassword(password);

    const [created] = await db
      .insert(adminsTable)
      .values({
        email: cleanEmail,
        passwordHash,
        isSuperAdmin: Boolean(isSuperAdmin),
      })
      .returning({
        id: adminsTable.id,
        email: adminsTable.email,
        isSuperAdmin: adminsTable.isSuperAdmin,
        createdAt: adminsTable.createdAt,
        updatedAt: adminsTable.updatedAt,
      });

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: "Failed to create sub-admin" });
  }
});

router.delete("/admin/sub-admins/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id || Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid admin ID" });
    return;
  }

  try {
    // Prevent super admin from deleting themselves via ID if they are logged in with that ID
    if (req.session?.adminId && req.session.adminId === id) {
      res.status(400).json({ error: "You cannot delete your own account" });
      return;
    }

    const result = await db.delete(adminsTable).where(eq(adminsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete sub-admin" });
  }
});

router.patch("/admin/sub-admins/:id/password", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id || Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid admin ID" });
    return;
  }

  const { password } = req.body as { password?: string };
  if (!password || typeof password !== "string" || password.length < 4) {
    res.status(400).json({ error: "Password must be at least 4 characters" });
    return;
  }

  try {
    const passwordHash = hashPassword(password);
    await db
      .update(adminsTable)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(adminsTable.id, id));

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update password" });
  }
});

export default router;
