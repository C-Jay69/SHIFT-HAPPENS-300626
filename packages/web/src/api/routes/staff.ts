import { Hono } from "hono";
import { db } from "../database";
import { staffProfiles, shifts, user } from "../database/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

export const staffRouter = new Hono()
  .get("/", requireAuth, async (c) => {
    const profiles = await db.select().from(staffProfiles).orderBy(staffProfiles.createdAt);
    return c.json({ staff: profiles }, 200);
  })
  .post("/", requireAuth, async (c) => {
    const body = await c.req.json();
    const [profile] = await db.insert(staffProfiles).values(body).returning();
    return c.json({ profile }, 201);
  })
  .put("/:id", requireAuth, async (c) => {
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();
    const [profile] = await db
      .update(staffProfiles)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(staffProfiles.id, id))
      .returning();
    return c.json({ profile }, 200);
  })
  // Shifts
  .get("/shifts", requireAuth, async (c) => {
    const date = c.req.query("date");
    const query = date
      ? db.select().from(shifts).where(eq(shifts.date, date))
      : db.select().from(shifts).orderBy(desc(shifts.date)).limit(100);
    const result = await query;
    return c.json({ shifts: result }, 200);
  })
  .post("/shifts", requireAuth, async (c) => {
    const body = await c.req.json();
    const [shift] = await db.insert(shifts).values(body).returning();
    return c.json({ shift }, 201);
  })
  .put("/shifts/:id/clock", requireAuth, async (c) => {
    const id = parseInt(c.req.param("id"));
    const { action } = await c.req.json(); // "in" | "out"
    const [shift] = await db
      .update(shifts)
      .set(action === "in" ? { clockIn: new Date() } : { clockOut: new Date() })
      .where(eq(shifts.id, id))
      .returning();
    return c.json({ shift }, 200);
  });
