import { Hono } from "hono";
import { db } from "../database";
import { menuItems } from "../database/schema";
import { eq, asc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

export const menuRouter = new Hono()
  .get("/", async (c) => {
    const items = await db
      .select()
      .from(menuItems)
      .orderBy(menuItems.category, asc(menuItems.sortOrder));
    return c.json({ items }, 200);
  })
  .post("/", requireAuth, async (c) => {
    const body = await c.req.json();
    const [item] = await db.insert(menuItems).values(body).returning();
    return c.json({ item }, 201);
  })
  .put("/:id", requireAuth, async (c) => {
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();
    const [item] = await db
      .update(menuItems)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(menuItems.id, id))
      .returning();
    return c.json({ item }, 200);
  })
  .delete("/:id", requireAuth, async (c) => {
    const id = parseInt(c.req.param("id"));
    await db.delete(menuItems).where(eq(menuItems.id, id));
    return c.json({ message: "Deleted" }, 200);
  });
