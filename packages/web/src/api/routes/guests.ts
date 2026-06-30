import { Hono } from "hono";
import { db } from "../database";
import { guests } from "../database/schema";
import { eq, ilike, or, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

export const guestsRouter = new Hono()
  .get("/", requireAuth, async (c) => {
    const search = c.req.query("search");
    if (search) {
      const results = await db
        .select()
        .from(guests)
        .where(
          or(
            ilike(guests.firstName, `%${search}%`),
            ilike(guests.lastName, `%${search}%`),
            ilike(guests.email, `%${search}%`),
            ilike(guests.phone, `%${search}%`)
          )
        )
        .orderBy(desc(guests.totalVisits))
        .limit(50);
      return c.json({ guests: results }, 200);
    }
    const all = await db.select().from(guests).orderBy(desc(guests.totalVisits)).limit(100);
    return c.json({ guests: all }, 200);
  })
  .get("/:id", requireAuth, async (c) => {
    const id = parseInt(c.req.param("id"));
    const [guest] = await db.select().from(guests).where(eq(guests.id, id));
    if (!guest) return c.json({ message: "Guest not found" }, 404);
    return c.json({ guest }, 200);
  })
  .post("/", requireAuth, async (c) => {
    const body = await c.req.json();
    const [guest] = await db.insert(guests).values(body).returning();
    return c.json({ guest }, 201);
  })
  .put("/:id", requireAuth, async (c) => {
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();
    const [guest] = await db
      .update(guests)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(guests.id, id))
      .returning();
    return c.json({ guest }, 200);
  })
  .delete("/:id", requireAuth, async (c) => {
    const id = parseInt(c.req.param("id"));
    await db.delete(guests).where(eq(guests.id, id));
    return c.json({ message: "Deleted" }, 200);
  });
