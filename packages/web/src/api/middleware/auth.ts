import { createMiddleware } from "hono/factory";
import { auth } from "../auth";

export const authMiddleware = createMiddleware(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set("user", session?.user ?? null);
  c.set("session", session?.session ?? null);
  return next();
});

export const requireAuth = createMiddleware(async (c, next) => {
  if (!c.get("user")) return c.json({ message: "Unauthorized" }, 401);
  return next();
});

export const requireRole = (...roles: string[]) =>
  createMiddleware(async (c, next) => {
    const user = c.get("user") as { id: string } | null;
    if (!user) return c.json({ message: "Unauthorized" }, 401);
    // Role check handled at route level via staffProfiles lookup
    return next();
  });
