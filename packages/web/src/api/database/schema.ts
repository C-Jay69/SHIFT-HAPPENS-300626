import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  decimal,
  pgEnum,
  serial,
  jsonb,
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────────────────────────
export const roleEnum = pgEnum("role", ["admin", "manager", "server", "host"]);
export const reservationStatusEnum = pgEnum("reservation_status", [
  "pending",
  "confirmed",
  "seated",
  "completed",
  "cancelled",
  "no_show",
]);
export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "in_progress",
  "ready",
  "served",
  "paid",
  "voided",
]);
export const menuCategoryEnum = pgEnum("menu_category", [
  "STARTERS",
  "MAINS",
  "DESSERT",
  "DRINKS",
  "SPECIALS",
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "card",
  "stripe",
  "split",
]);
export const staffStatusEnum = pgEnum("staff_status", [
  "active",
  "inactive",
  "on_leave",
]);

// ─── Better Auth tables (generated separately) ───────────────────────────────
export * from "./auth-schema";

// ─── Staff / Users extension ─────────────────────────────────────────────────
export const staffProfiles = pgTable("staff_profiles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(), // FK to better-auth user
  role: roleEnum("role").notNull().default("server"),
  pin: text("pin"), // 4-digit PIN for quick POS login
  hourlyRate: decimal("hourly_rate", { precision: 8, scale: 2 }),
  status: staffStatusEnum("status").notNull().default("active"),
  phone: text("phone"),
  emergencyContact: text("emergency_contact"),
  hireDate: timestamp("hire_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Guests / CRM ────────────────────────────────────────────────────────────
export const guests = pgTable("guests", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").unique(),
  phone: text("phone"),
  dietaryPreferences: text("dietary_preferences").array(),
  allergies: text("allergies").array(),
  notes: text("notes"),
  loyaltyPoints: integer("loyalty_points").notNull().default(0),
  totalVisits: integer("total_visits").notNull().default(0),
  totalSpend: decimal("total_spend", { precision: 10, scale: 2 }).default("0"),
  birthday: text("birthday"), // MM-DD format
  isVip: boolean("is_vip").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Reservations ─────────────────────────────────────────────────────────────
export const reservations = pgTable("reservations", {
  id: serial("id").primaryKey(),
  guestId: integer("guest_id").references(() => guests.id),
  guestName: text("guest_name").notNull(), // for walk-ins without CRM record
  guestPhone: text("guest_phone"),
  guestEmail: text("guest_email"),
  partySize: integer("party_size").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  time: text("time").notNull(), // HH:MM
  tableNumber: integer("table_number"),
  status: reservationStatusEnum("status").notNull().default("pending"),
  specialRequests: text("special_requests"),
  occasion: text("occasion"),
  confirmedBy: text("confirmed_by"), // staff user_id
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Menu ─────────────────────────────────────────────────────────────────────
export const menuItems = pgTable("menu_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: menuCategoryEnum("category").notNull(),
  price: decimal("price", { precision: 8, scale: 2 }).notNull(),
  cost: decimal("cost", { precision: 8, scale: 2 }), // COGS
  isAvailable: boolean("is_available").notNull().default(true),
  isSpecial: boolean("is_special").notNull().default(false),
  allergens: text("allergens").array(),
  tags: text("tags").array(), // vegetarian, vegan, gluten-free
  imageUrl: text("image_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Orders ──────────────────────────────────────────────────────────────────
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  tableNumber: integer("table_number"),
  guestId: integer("guest_id").references(() => guests.id),
  reservationId: integer("reservation_id").references(() => reservations.id),
  serverId: text("server_id"), // staff user_id
  status: orderStatusEnum("status").notNull().default("pending"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
  tax: decimal("tax", { precision: 10, scale: 2 }).notNull().default("0"),
  tip: decimal("tip", { precision: 10, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull().default("0"),
  paymentMethod: paymentMethodEnum("payment_method"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  notes: text("notes"),
  kitchenNotes: text("kitchen_notes"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  menuItemId: integer("menu_item_id")
    .notNull()
    .references(() => menuItems.id),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 8, scale: 2 }).notNull(),
  modifiers: text("modifiers"), // e.g. "no onions, extra sauce"
  status: orderStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Inventory ───────────────────────────────────────────────────────────────
export const inventory = pgTable("inventory", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  unit: text("unit").notNull(), // kg, L, each, etc.
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull().default("0"),
  reorderThreshold: decimal("reorder_threshold", { precision: 10, scale: 3 }),
  costPerUnit: decimal("cost_per_unit", { precision: 8, scale: 2 }),
  supplier: text("supplier"),
  category: text("category"), // Proteins, Produce, Dairy, Dry Goods, Beverages
  lastRestocked: timestamp("last_restocked"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Shifts / Scheduling ──────────────────────────────────────────────────────
export const shifts = pgTable("shifts", {
  id: serial("id").primaryKey(),
  staffUserId: text("staff_user_id").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  startTime: text("start_time").notNull(), // HH:MM
  endTime: text("end_time").notNull(), // HH:MM
  role: roleEnum("role").notNull(),
  clockIn: timestamp("clock_in"),
  clockOut: timestamp("clock_out"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── AI Chat Logs ────────────────────────────────────────────────────────────
export const aiChatLogs = pgTable("ai_chat_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  messages: jsonb("messages").notNull(), // full conversation array
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
