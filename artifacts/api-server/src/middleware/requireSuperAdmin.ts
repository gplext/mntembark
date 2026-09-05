import type { Request, Response, NextFunction } from "express";

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.isAdmin === true && req.session?.isSuperAdmin === true) {
    next();
  } else if (req.session?.isAdmin === true) {
    res.status(403).json({ error: "Forbidden: Super Admin access required" });
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
}
