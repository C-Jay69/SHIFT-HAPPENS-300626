import { Hono } from "hono";
import { db } from "../database";
import { orders, orderItems, menuItems } from "../database/schema";
import { eq, desc, ne, inArray } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-05-28.basil" });

export const ordersRouter = new Hono()
  .get("/", requireAuth, async (c) => {
    const status = c.req.query("status");
    const query = status
      ? db.select().from(orders).where(eq(orders.status, status as any)).orderBy(desc(orders.createdAt))
      : db.select().from(orders).orderBy(desc(orders.createdAt)).limit(50);
    const result = await query;
    return c.json({ orders: result }, 200);
  })
  .get("/active", requireAuth, async (c) => {
    const active = await db
      .select()
      .from(orders)
      .where(inArray(orders.status, ["pending", "in_progress", "ready"]))
      .orderBy(desc(orders.createdAt));
    return c.json({ orders: active }, 200);
  })
  .get("/:id", requireAuth, async (c) => {
    const id = parseInt(c.req.param("id"));
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) return c.json({ message: "Not found" }, 404);
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
    return c.json({ order, items }, 200);
  })
  .post("/", requireAuth, async (c) => {
    const body = await c.req.json();
    const { items: lineItems, ...orderData } = body;

    // Calculate totals
    let subtotal = 0;
    const resolvedItems = await Promise.all(
      (lineItems || []).map(async (li: { menuItemId: number; quantity: number; modifiers?: string }) => {
        const [menu] = await db.select().from(menuItems).where(eq(menuItems.id, li.menuItemId));
        const unitPrice = parseFloat(menu?.price ?? "0");
        subtotal += unitPrice * li.quantity;
        return { ...li, unitPrice: unitPrice.toFixed(2) };
      })
    );
    const tax = subtotal * 0.16; // 16% Mexican IVA
    const total = subtotal + tax;

    const [order] = await db
      .insert(orders)
      .values({
        ...orderData,
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        total: total.toFixed(2),
      })
      .returning();

    if (resolvedItems.length > 0) {
      await db.insert(orderItems).values(
        resolvedItems.map((li) => ({ ...li, orderId: order.id }))
      );
    }

    return c.json({ order }, 201);
  })
  .put("/:id/status", requireAuth, async (c) => {
    const id = parseInt(c.req.param("id"));
    const { status } = await c.req.json();
    const [order] = await db
      .update(orders)
      .set({ status, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return c.json({ order }, 200);
  })
  .post("/:id/pay", requireAuth, async (c) => {
    const id = parseInt(c.req.param("id"));
    const { method, tip = 0 } = await c.req.json();

    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) return c.json({ message: "Not found" }, 404);

    if (method === "stripe") {
      const total = parseFloat(order.total) + parseFloat(tip.toString());
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(total * 100), // cents
        currency: "mxn",
        metadata: { orderId: id.toString() },
      });
      return c.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id }, 200);
    }

    // Cash/card — mark paid immediately
    const [updated] = await db
      .update(orders)
      .set({
        status: "paid",
        paymentMethod: method,
        tip: tip.toString(),
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id))
      .returning();
    return c.json({ order: updated }, 200);
  })
  .post("/:id/stripe-confirm", requireAuth, async (c) => {
    const id = parseInt(c.req.param("id"));
    const { paymentIntentId, tip = 0 } = await c.req.json();
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.status !== "succeeded") return c.json({ message: "Payment not confirmed" }, 400);
    const [order] = await db
      .update(orders)
      .set({
        status: "paid",
        paymentMethod: "stripe",
        stripePaymentIntentId: paymentIntentId,
        tip: tip.toString(),
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id))
      .returning();
    return c.json({ order }, 200);
  });
