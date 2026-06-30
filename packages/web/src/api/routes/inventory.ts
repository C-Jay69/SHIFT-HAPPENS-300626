import { Hono } from "hono";
import { db } from "../database";
import { inventory } from "../database/schema";
import { eq, lte, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

export const inventoryRouter = new Hono()
  .get("/", requireAuth, async (c) => {
    const items = await db.select().from(inventory).orderBy(inventory.category, inventory.name);
    return c.json({ items }, 200);
  })
  .get("/low-stock", requireAuth, async (c) => {
    // Items where quantity <= reorderThreshold
    const items = await db.select().from(inventory);
    const lowStock = items.filter(
      (i) => i.reorderThreshold && parseFloat(i.quantity) <= parseFloat(i.reorderThreshold)
    );
    return c.json({ items: lowStock }, 200);
  })
  .post("/", requireAuth, async (c) => {
    const body = await c.req.json();
    const [item] = await db.insert(inventory).values(body).returning();
    return c.json({ item }, 201);
  })
  .put("/:id", requireAuth, async (c) => {
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();
    const [item] = await db
      .update(inventory)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(inventory.id, id))
      .returning();
    return c.json({ item }, 200);
  })
  .delete("/:id", requireAuth, async (c) => {
    const id = parseInt(c.req.param("id"));
    await db.delete(inventory).where(eq(inventory.id, id));
    return c.json({ message: "Deleted" }, 200);
  });
