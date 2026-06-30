import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { menuItems } from "./src/api/database/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

const items = [
  // STARTERS
  { name: "Loaded Fries", category: "STARTERS" as const, price: 9500, description: "Crinkle fries, cheese sauce, jalapeños, bacon bits", isAvailable: true, imageUrl: null },
  { name: "Elote Cup", category: "STARTERS" as const, price: 6500, description: "Mexican street corn, cotija, tajín, lime", isAvailable: true, imageUrl: null },
  { name: "Onion Rings", category: "STARTERS" as const, price: 7000, description: "Beer-battered thick cut, chipotle dip", isAvailable: true, imageUrl: null },
  // MAINS
  { name: "Shift Smash Burger", category: "MAINS" as const, price: 18900, description: "Double smash, American cheese, pickles, ShiftSauce", isAvailable: true, imageUrl: null },
  { name: "BBQ Bacon Stack", category: "MAINS" as const, price: 21500, description: "Triple patty, crispy bacon, BBQ glaze, onion rings", isAvailable: true, imageUrl: null },
  { name: "Vegan Shift Burger", category: "MAINS" as const, price: 17500, description: "Black bean patty, avocado, chipotle mayo, sprouts", isAvailable: true, imageUrl: null },
  { name: "Birria Taco", category: "MAINS" as const, price: 8500, description: "Slow-braised beef, consommé for dipping, onion, cilantro", isAvailable: true, imageUrl: null },
  { name: "Al Pastor Taco", category: "MAINS" as const, price: 7500, description: "Marinated pork, pineapple, salsa verde, onion", isAvailable: true, imageUrl: null },
  { name: "Crispy Fish Taco", category: "MAINS" as const, price: 9000, description: "Beer-battered mahi, slaw, chipotle crema", isAvailable: true, imageUrl: null },
  // DESSERT
  { name: "Churro Bites", category: "DESSERT" as const, price: 7500, description: "Cinnamon sugar, dulce de leche dipping sauce", isAvailable: true, imageUrl: null },
  { name: "Tres Leches Slice", category: "DESSERT" as const, price: 8500, description: "Classic Mexican tres leches, fresh cream", isAvailable: true, imageUrl: null },
  { name: "Paleta del Día", category: "DESSERT" as const, price: 5000, description: "Artisan ice pop — flavour rotates daily", isAvailable: true, imageUrl: null },
  // DRINKS
  { name: "House Lager", category: "DRINKS" as const, price: 7200, description: "Cold draft, 500ml", isAvailable: true, imageUrl: null },
  { name: "Agua Fresca", category: "DRINKS" as const, price: 4500, description: "Daily rotation — ask your server", isAvailable: true, imageUrl: null },
  { name: "ShiftBot Shake", category: "DRINKS" as const, price: 9800, description: "Chocolate & salted caramel milkshake, whipped cream", isAvailable: true, imageUrl: null },
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
