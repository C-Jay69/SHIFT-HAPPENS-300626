import { Hono } from "hono";
import { db } from "../database";
import { reservations } from "../database/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

export const reservationsRouter = new Hono()
  .get("/", requireAuth, async (c) => {
    const date = c.req.query("date");
    const query = date
      ? db.select().from(reservations).where(eq(reservations.date, date)).orderBy(reservations.time)
      : db.select().from(reservations).orderBy(desc(reservations.createdAt)).limit(100);
    const result = await query;
    return c.json({ reservations: result }, 200);
  })
  .get("/:id", requireAuth, async (c) => {
    const id = parseInt(c.req.param("id"));
    const [res] = await db.select().from(reservations).where(eq(reservations.id, id));
    if (!res) return c.json({ message: "Not found" }, 404);
    return c.json({ reservation: res }, 200);
  })
  .post("/", requireAuth, async (c) => {
    const body = await c.req.json();
    const [res] = await db.insert(reservations).values(body).returning();
    return c.json({ reservation: res }, 201);
  })
  .put("/:id", requireAuth, async (c) => {
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();
    const [res] = await db
      .update(reservations)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(reservations.id, id))
      .returning();
    return c.json({ reservation: res }, 200);
  })
  .delete("/:id", requireAuth, async (c) => {
    const id = parseInt(c.req.param("id"));
    await db.delete(reservations).where(eq(reservations.id, id));
    return c.json({ message: "Deleted" }, 200);
  });
