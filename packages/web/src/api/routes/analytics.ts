import { Hono } from "hono";
import { db } from "../database";
import { orders, orderItems, menuItems, reservations, staffProfiles, user } from "../database/schema";
import { eq, gte, desc, sql, sum, count } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

export const analyticsRouter = new Hono()
  // Revenue over time (last N days, default 14)
  .get("/revenue", requireAuth, async (c) => {
    const days = Number(c.req.query("days") ?? 14);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const rows = await db
      .select({
        date: sql<string>`to_char(${orders.paidAt}, 'YYYY-MM-DD')`.as("date"),
        revenue: sum(orders.total).mapWith(Number),
        orderCount: count(orders.id),
      })
      .from(orders)
      .where(gte(orders.paidAt, since))
      .groupBy(sql`to_char(${orders.paidAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${orders.paidAt}, 'YYYY-MM-DD')`);

    return c.json({ revenue: rows }, 200);
  })
  // Top-selling items
  .get("/top-items", requireAuth, async (c) => {
    const limit = Number(c.req.query("limit") ?? 10);
    const rows = await db
      .select({
        menuItemId: orderItems.menuItemId,
        name: menuItems.name,
        category: menuItems.category,
        totalQty: sum(orderItems.quantity).mapWith(Number),
        totalRevenue: sql<number>`sum(${orderItems.quantity} * ${orderItems.unitPrice})`.mapWith(Number),
      })
      .from(orderItems)
      .innerJoin(menuItems, eq(orderItems.menuItemId, menuItems.id))
      .groupBy(orderItems.menuItemId, menuItems.name, menuItems.category)
      .orderBy(desc(sql`sum(${orderItems.quantity})`))
      .limit(limit);

    return c.json({ items: rows }, 200);
  })
  // Summary KPIs
  .get("/summary", requireAuth, async (c) => {
    const [revenueRow] = await db
      .select({
        totalRevenue: sum(orders.total).mapWith(Number),
        totalOrders: count(orders.id),
        avgOrderValue: sql<number>`avg(${orders.total})`.mapWith(Number),
      })
      .from(orders)
      .where(eq(orders.status, "paid"));

    const [resRow] = await db
      .select({ totalReservations: count(reservations.id) })
      .from(reservations);

    const [staffRow] = await db
      .select({ activeStaff: count(staffProfiles.id) })
      .from(staffProfiles)
      .where(eq(staffProfiles.status, "active"));

    return c.json(
      {
        totalRevenue: revenueRow?.totalRevenue ?? 0,
        totalOrders: revenueRow?.totalOrders ?? 0,
        avgOrderValue: revenueRow?.avgOrderValue ?? 0,
        totalReservations: resRow?.totalReservations ?? 0,
        activeStaff: staffRow?.activeStaff ?? 0,
      },
      200
    );
  })
  // Order status breakdown
  .get("/order-status", requireAuth, async (c) => {
    const rows = await db
      .select({ status: orders.status, count: count(orders.id) })
      .from(orders)
      .groupBy(orders.status);
    return c.json({ statuses: rows }, 200);
  })
  // CSV export of orders (with date range)
  .get("/export/orders", requireAuth, async (c) => {
    const from = c.req.query("from");
    const to = c.req.query("to");

    let query = db.select().from(orders).orderBy(desc(orders.createdAt));
    const rows = await query;

    const filtered = rows.filter((o) => {
      if (!from && !to) return true;
      const created = new Date(o.createdAt).getTime();
      if (from && created < new Date(from).getTime()) return false;
      if (to && created > new Date(to).getTime()) return false;
      return true;
    });

    const header = ["id", "tableNumber", "status", "subtotal", "tax", "tip", "total", "paymentMethod", "createdAt", "paidAt"];
    const csvRows = [
      header.join(","),
      ...filtered.map((o) =>
        [o.id, o.tableNumber ?? "", o.status, o.subtotal, o.tax, o.tip, o.total, o.paymentMethod ?? "", o.createdAt, o.paidAt ?? ""]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ];

    c.header("Content-Type", "text/csv");
    c.header("Content-Disposition", `attachment; filename="orders-export-${Date.now()}.csv"`);
    return c.body(csvRows.join("\n"));
  })
  // Reservations overview (upcoming + by status)
  .get("/reservations-overview", requireAuth, async (c) => {
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = await db
      .select()
      .from(reservations)
      .where(gte(reservations.date, today))
      .orderBy(reservations.date, reservations.time)
      .limit(50);

    const byStatus = await db
      .select({ status: reservations.status, count: count(reservations.id) })
      .from(reservations)
      .groupBy(reservations.status);

    return c.json({ upcoming, byStatus }, 200);
  })
  // Staff list with user info (for role management)
  .get("/staff-roles", requireAuth, async (c) => {
    const rows = await db
      .select({
        id: staffProfiles.id,
        userId: staffProfiles.userId,
        role: staffProfiles.role,
        status: staffProfiles.status,
        hourlyRate: staffProfiles.hourlyRate,
        userName: user.name,
        userEmail: user.email,
      })
      .from(staffProfiles)
      .leftJoin(user, eq(staffProfiles.userId, user.id))
      .orderBy(staffProfiles.createdAt);
    return c.json({ staff: rows }, 200);
  })
  // Update staff role
  .put("/staff-roles/:id", requireAuth, async (c) => {
    const id = parseInt(c.req.param("id"));
    const { role, status } = await c.req.json();
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (role) updates.role = role;
    if (status) updates.status = status;
    const [updated] = await db
      .update(staffProfiles)
      .set(updates)
      .where(eq(staffProfiles.id, id))
      .returning();
    return c.json({ profile: updated }, 200);
  });
