import "express-session";

declare module "express-session" {
  interface SessionData {
    isAdmin?: boolean;
    isSuperAdmin?: boolean;
    adminId?: number;
    adminEmail?: string;
  }
}
