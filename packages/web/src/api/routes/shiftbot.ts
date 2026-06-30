import { Hono } from "hono";
import { db } from "../database";
import { aiChatLogs, orders, menuItems, inventory, reservations } from "../database/schema";
import { requireAuth } from "../middleware/auth";
import { GoogleGenAI } from "@google/genai";
import { desc, inArray } from "drizzle-orm";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const shiftbotRouter = new Hono()
  .post("/chat", requireAuth, async (c) => {
    const { prompt, messages = [] } = await c.req.json();

    // Build live context snapshot
    const [activeOrders, lowInventory, todayRes, topMenu] = await Promise.all([
      db.select().from(orders).where(inArray(orders.status, ["pending", "in_progress", "ready"])),
      db.select().from(inventory),
      db.select().from(reservations),
      db.select().from(menuItems).limit(20),
    ]);

    const lowStock = lowInventory.filter(
      (i) => i.reorderThreshold && parseFloat(i.quantity) <= parseFloat(i.reorderThreshold)
    );

    const context = `
LIVE RESTAURANT DATA (${new Date().toLocaleString("en-MX", { timeZone: "America/Mexico_City" })}):
- Active orders: ${activeOrders.length} (pending: ${activeOrders.filter((o) => o.status === "pending").length}, in_progress: ${activeOrders.filter((o) => o.status === "in_progress").length}, ready: ${activeOrders.filter((o) => o.status === "ready").length})
- Low stock alerts: ${lowStock.map((i) => `${i.name} (${i.quantity}${i.unit})`).join(", ") || "None"}
- Today's reservations: ${todayRes.length}
- Menu items available: ${topMenu.filter((m) => m.isAvailable).length}/${topMenu.length}
`;

    const systemInstruction = `You are "ShiftBot", the AI Operations Assistant for "SHIFT HAPPENS!" restaurant.
Tone: professional, efficient, slightly witty — like a sharp GM who's seen it all.
Rules:
1. Keep answers under 100 words unless a detailed report is requested.
2. Only recommend menu items that exist in the system.
3. Format output clearly using Markdown where helpful.
4. You have access to real-time restaurant data — use it.

${context}`;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
      config: { systemInstruction },
    });

    const reply = response.text ?? "Having trouble processing that. Check GEMINI_API_KEY.";

    // Log conversation
    await db.insert(aiChatLogs).values({
      messages: [...messages, { role: "user", content: prompt }, { role: "assistant", content: reply }],
    });

    return c.json({ reply }, 200);
  });
