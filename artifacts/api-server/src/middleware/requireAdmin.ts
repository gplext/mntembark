import type { Request, Response, NextFunction } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.isAdmin === true) {
    next();
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
}
