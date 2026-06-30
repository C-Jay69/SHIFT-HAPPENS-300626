import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { menuItems } from "./packages/web/src/api/database/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

const items = [
  // Burgers
  { name: "Shift Smash Burger", category: "burgers", price: 18900, description: "Double smash, American cheese, pickles, ShiftSauce", available: true, imageUrl: null },
  { name: "BBQ Bacon Stack", category: "burgers", price: 21500, description: "Triple patty, crispy bacon, BBQ glaze, onion rings", available: true, imageUrl: null },
  { name: "Vegan Shift Burger", category: "burgers", price: 17500, description: "Black bean patty, avocado, chipotle mayo, sprouts", available: true, imageUrl: null },
  // Tacos
  { name: "Birria Taco", category: "tacos", price: 8500, description: "Slow-braised beef, consommé for dipping, onion, cilantro", available: true, imageUrl: null },
  { name: "Al Pastor Taco", category: "tacos", price: 7500, description: "Marinated pork, pineapple, salsa verde, onion", available: true, imageUrl: null },
  { name: "Crispy Fish Taco", category: "tacos", price: 9000, description: "Beer-battered mahi, slaw, chipotle crema", available: true, imageUrl: null },
  // Drinks
  { name: "House Lager", category: "drinks", price: 7200, description: "Cold draft, 500ml", available: true, imageUrl: null },
  { name: "Agua Fresca", category: "drinks", price: 4500, description: "Daily rotation — ask your server", available: true, imageUrl: null },
  { name: "ShiftBot Shake", category: "drinks", price: 9800, description: "Chocolate & salted caramel milkshake, whipped cream", available: true, imageUrl: null },
  // Sides
  { name: "Loaded Fries", category: "sides", price: 9500, description: "Crinkle fries, cheese sauce, jalapeños, bacon bits", available: true, imageUrl: null },
  { name: "Elote Cup", category: "sides", price: 6500, description: "Mexican street corn, cotija, tajín, lime", available: true, imageUrl: null },
  { name: "Onion Rings", category: "sides", price: 7000, description: "Beer-battered thick cut, chipotle dip", available: true, imageUrl: null },
  // Desserts
  { name: "Churro Bites", category: "desserts", price: 7500, description: "Cinnamon sugar, dulce de leche dipping sauce", available: true, imageUrl: null },
  { name: "Tres Leches Slice", category: "desserts", price: 8500, description: "Classic Mexican tres leches, fresh cream", available: true, imageUrl: null },
  { name: "Paleta del Día", category: "desserts", price: 5000, description: "Artisan ice pop — flavour rotates daily", available: true, imageUrl: null },
];

async function seed() {
  console.log("Seeding menu items...");
  await db.delete(menuItems);
  const result = await db.insert(menuItems).values(items).returning({ id: menuItems.id, name: menuItems.name });
  console.log(`Inserted ${result.length} items:`);
  result.forEach(r => console.log(` ✓ ${r.name}`));
  console.log("Done.");
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
