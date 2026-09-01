import './env.js';
import { pool } from './db.js';
import { hashPassword } from './lib/password.js';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@shifthappens.test';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'ChangeMe123!';

// Demo dataset mirrors the frontend demo constants so the wired dashboards
// show real seeded data right after login.
const CATEGORIES: { name: string; displayOrder: number }[] = [
  { name: 'Food', displayOrder: 1 },
  { name: 'Drinks', displayOrder: 2 },
  { name: 'Desserts', displayOrder: 3 },
];

const INGREDIENTS: { name: string; unit: string; stock: number; threshold: number; cost: number }[] = [
  { name: 'Beef Patty', unit: 'pcs', stock: 50, threshold: 10, cost: 2.5 },
  { name: 'Brioche Bun', unit: 'pcs', stock: 40, threshold: 15, cost: 0.5 },
  { name: 'Cheddar Cheese', unit: 'slices', stock: 100, threshold: 20, cost: 0.2 },
  { name: 'Lettuce', unit: 'heads', stock: 20, threshold: 5, cost: 1 },
  { name: 'Vodka', unit: 'bottles', stock: 10, threshold: 2, cost: 15 },
  { name: 'Lime', unit: 'pcs', stock: 30, threshold: 10, cost: 0.3 },
  { name: 'Ginger Beer', unit: 'cans', stock: 48, threshold: 12, cost: 1 },
];

const MENU_ITEMS: { name: string; category: string; price: number; description: string; recipe: { ingredient: string; quantity: number; unit: string }[] }[] = [
  {
    name: 'Classic Smash',
    category: 'Food',
    price: 14,
    description: 'Smash burger with brioche bun and cheddar',
    recipe: [
      { ingredient: 'Beef Patty', quantity: 1, unit: 'pcs' },
      { ingredient: 'Brioche Bun', quantity: 1, unit: 'pcs' },
      { ingredient: 'Cheddar Cheese', quantity: 2, unit: 'slices' },
    ],
  },
  {
    name: 'Moscow Mule',
    category: 'Drinks',
    price: 12,
    description: 'Vodka, lime and ginger beer over ice',
    recipe: [
      { ingredient: 'Vodka', quantity: 0.05, unit: 'bottles' },
      { ingredient: 'Lime', quantity: 0.5, unit: 'pcs' },
      { ingredient: 'Ginger Beer', quantity: 1, unit: 'cans' },
    ],
  },
  {
    name: 'House Salad',
    category: 'Food',
    price: 10,
    description: 'Fresh greens with house dressing',
    recipe: [{ ingredient: 'Lettuce', quantity: 0.25, unit: 'heads' }],
  },
  {
    name: 'Double Trouble',
    category: 'Food',
    price: 18,
    description: 'Double smash patties, double cheese',
    recipe: [
      { ingredient: 'Beef Patty', quantity: 2, unit: 'pcs' },
      { ingredient: 'Brioche Bun', quantity: 1, unit: 'pcs' },
      { ingredient: 'Cheddar Cheese', quantity: 4, unit: 'slices' },
    ],
  },
];

const TABLES: { name: string; seats: number; status: string; x: number; y: number }[] = [
  { name: 'Table 1', seats: 2, status: 'available', x: 20, y: 20 },
  { name: 'Table 2', seats: 2, status: 'occupied', x: 120, y: 20 },
  { name: 'Table 3', seats: 4, status: 'available', x: 220, y: 20 },
  { name: 'Booth A', seats: 6, status: 'reserved', x: 20, y: 150 },
  { name: 'Booth B', seats: 6, status: 'dirty', x: 20, y: 280 },
  { name: 'Bar 1', seats: 1, status: 'available', x: 300, y: 150 },
  { name: 'Bar 2', seats: 1, status: 'available', x: 300, y: 200 },
];

const RESERVATIONS: { firstName: string; phone: string; partySize: number; timeSlot: string; status: string; notes: string; tableName?: string }[] = [
  { firstName: 'J. Doe', phone: '555-0123', partySize: 4, timeSlot: '19:00', status: 'confirmed', notes: 'Anniversary — VIP', tableName: 'Booth A' },
  { firstName: 'S. Connor', phone: '555-0987', partySize: 2, timeSlot: '19:30', status: 'pending', notes: 'Window seat preferred' },
  { firstName: 'T. Stark', phone: '555-1111', partySize: 6, timeSlot: '20:00', status: 'confirmed', notes: 'VIP — birthday dessert on us', tableName: 'Booth B' },
];

const STAFF: { firstName: string; lastName: string; role: string; hourlyRate: number }[] = [
  { firstName: 'Marcus', lastName: 'Reyes', role: 'manager', hourlyRate: 28 },
  { firstName: 'Dana', lastName: 'Kim', role: 'server', hourlyRate: 12 },
  { firstName: 'Priya', lastName: 'Shah', role: 'cook', hourlyRate: 16 },
  { firstName: 'Leo', lastName: 'Grant', role: 'host', hourlyRate: 11 },
];

const EVENT_LEADS: { contactName: string; eventType: string; guestCount: number; budget: number; status: string; notes: string }[] = [
  { contactName: 'Nina Petrova', eventType: 'birthday', guestCount: 20, budget: 900, status: 'new', notes: 'Saturday evening, birthday for 21st' },
  { contactName: 'Apex Consulting', eventType: 'corporate', guestCount: 45, budget: 3500, status: 'contacted', notes: 'Quarterly offsite — needs A/V check' },
];

const client = await pool.connect();
try {
  const role = await client.query(`SELECT id FROM roles WHERE name = 'owner' LIMIT 1`);
  if (!role.rowCount) throw new Error('Owner role not found — run `migrate` first');

  const restaurant = await client.query('SELECT id FROM restaurants LIMIT 1');
  if (!restaurant.rowCount) throw new Error('No restaurants found — run `migrate` first');
  const restaurantId = restaurant.rows[0].id;

  let adminId: string | null = null;
  const existing = await client.query('SELECT id FROM users WHERE email = $1', [ADMIN_EMAIL]);
  if (existing.rowCount) {
    console.log('ℹ️  Admin user already exists — skipping.');
    adminId = existing.rows[0].id;
  } else {
    const passwordHash = await hashPassword(ADMIN_PASSWORD);
    const created = await client.query(
      `INSERT INTO users (email, password_hash, role_id, restaurant_id)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [ADMIN_EMAIL, passwordHash, role.rows[0].id, restaurantId],
    );
    adminId = created.rows[0].id;
    console.log('✅ Admin user created:', ADMIN_EMAIL);
    console.log(`   Password: ${ADMIN_PASSWORD} (change via ADMIN_PASSWORD env)`);
  }

  // --- Demo dataset (idempotent: clears prior demo rows, then reseeds) ---
  await client.query('BEGIN');
  try {
    // Clear any previously seeded demo data (single-restaurant demo app).
    await client.query('DELETE FROM waitlist');
    await client.query('DELETE FROM reservations');
    await client.query('DELETE FROM guests');
    await client.query('DELETE FROM event_contracts');
    await client.query('DELETE FROM event_proposals');
    await client.query('DELETE FROM event_leads');
    await client.query('DELETE FROM shifts');
    await client.query('DELETE FROM time_logs');
    await client.query('DELETE FROM staff');
    await client.query(
      `DELETE FROM menu_items WHERE category_id IN (SELECT id FROM menu_categories WHERE restaurant_id = $1)`,
      [restaurantId],
    );
    await client.query(`DELETE FROM menu_categories WHERE restaurant_id = $1`, [restaurantId]);
    await client.query(`DELETE FROM ingredients WHERE restaurant_id = $1`, [restaurantId]);
    await client.query(`DELETE FROM tables WHERE restaurant_id = $1`, [restaurantId]);

    // Ingredients first so recipes can reference them.
    const ingredientIds = new Map<string, string>();
    for (const ing of INGREDIENTS) {
      const res = await client.query(
        `INSERT INTO ingredients (restaurant_id, name, unit, current_stock, reorder_threshold, unit_cost)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [restaurantId, ing.name, ing.unit, ing.stock, ing.threshold, ing.cost],
      );
      ingredientIds.set(ing.name, res.rows[0].id);
    }

    const categoryIds = new Map<string, string>();
    for (const cat of CATEGORIES) {
      const res = await client.query(
        `INSERT INTO menu_categories (restaurant_id, name, display_order)
         VALUES ($1, $2, $3) RETURNING id`,
        [restaurantId, cat.name, cat.displayOrder],
      );
      categoryIds.set(cat.name, res.rows[0].id);
    }

    for (const item of MENU_ITEMS) {
      const res = await client.query(
        `INSERT INTO menu_items (category_id, name, description, price, tags)
         VALUES ($1, $2, $3, $4, '[]'::jsonb) RETURNING id`,
        [categoryIds.get(item.category), item.name, item.description, item.price],
      );
      const recipe = await client.query(
        'INSERT INTO recipes (menu_item_id) VALUES ($1) RETURNING id',
        [res.rows[0].id],
      );
      for (const r of item.recipe) {
        await client.query(
          `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
           VALUES ($1, $2, $3, $4)`,
          [recipe.rows[0].id, ingredientIds.get(r.ingredient), r.quantity, r.unit],
        );
      }
    }

    const tableIds = new Map<string, string>();
    for (const t of TABLES) {
      const res = await client.query(
        `INSERT INTO tables (restaurant_id, name, capacity, floor_plan_x, floor_plan_y, status)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [restaurantId, t.name, t.seats, t.x, t.y, t.status],
      );
      tableIds.set(t.name, res.rows[0].id);
    }

    for (const r of RESERVATIONS) {
      const parts = r.firstName.trim().split(/\s+/);
      const guestRes = await client.query(
        `INSERT INTO guests (first_name, last_name, phone, notes)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [parts[0], parts.slice(1).join(' '), r.phone, r.notes],
      );
      await client.query(
        `INSERT INTO reservations (guest_id, table_id, party_size, date, time_slot, status, source, notes, created_by)
         VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, 'web', $6, $7)`,
        [guestRes.rows[0].id, r.tableName ? tableIds.get(r.tableName) : null, r.partySize, r.timeSlot, r.status, r.notes, adminId],
      );
    }

    // Demo staff + a week of shifts.
    const staffIds = new Map<string, string>();
    for (const s of STAFF) {
      const res = await client.query(
        `INSERT INTO staff (restaurant_id, first_name, last_name, role, hourly_rate, hire_date, status)
         VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, 'active') RETURNING id`,
        [restaurantId, s.firstName, s.lastName, s.role, s.hourlyRate],
      );
      staffIds.set(`${s.firstName} ${s.lastName}`, res.rows[0].id);
    }
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    for (const [name, staffId] of staffIds) {
      const member = STAFF.find((s) => `${s.firstName} ${s.lastName}` === name);
      if (!member) continue;
      const isDay = member.role === 'cook' || member.role === 'manager';
      for (let day = 1; day <= 7; day++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + day);
        const dateStr = date.toISOString().slice(0, 10);
        await client.query(
          `INSERT INTO shifts (staff_id, date, start_time, end_time, role)
           VALUES ($1, $2, $3, $4, $5)`,
          [staffId, dateStr, isDay ? '10:00' : '16:00', isDay ? '18:00' : '23:30', member.role],
        );
      }
    }

    // Demo event leads + one accepted contract chain for the corporate lead.
    for (const e of EVENT_LEADS) {
      await client.query(
        `INSERT INTO event_leads (restaurant_id, contact_name, contact_email, event_type, event_date, guest_count, budget, status, notes)
         VALUES ($1, $2, NULL, $3, CURRENT_DATE + 14, $4, $5, $6, $7)`,
        [restaurantId, e.contactName, e.eventType, e.guestCount, e.budget, e.status, e.notes],
      );
    }

    await client.query('COMMIT');
    console.log(`✅ Demo dataset seeded: ${INGREDIENTS.length} ingredients, ${MENU_ITEMS.length} menu items, ${TABLES.length} tables, ${RESERVATIONS.length} reservations, ${STAFF.length} staff, ${EVENT_LEADS.length} event leads.`);  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
} catch (err) {
  console.error('❌ Seed failed:', err);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}