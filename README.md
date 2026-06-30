# SHIFT HAPPENS! 🍔

Full-stack restaurant management platform. POS, KDS, reservations, staff scheduling, inventory, analytics, and an AI assistant — all in one.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + Vite + TailwindCSS |
| Backend | Hono (Bun runtime) |
| Database | Neon Postgres + Drizzle ORM |
| Auth | better-auth (email/password) |
| Payments | Stripe |
| AI | Google Gemini 1.5 Flash via `@google/genai` |
| Monorepo | Turborepo + Bun workspaces |

---

## Features

- **POS** — Full point-of-sale with menu grid, cart, table assignment, Stripe payment
- **KDS** (Kitchen Display System) — Live order queue with status updates, 8s polling
- **Reservations** — Booking management with status workflow
- **Staff** — Scheduling, shift tracking, performance
- **Inventory** — Stock management, low-stock alerts
- **Analytics** — Revenue, top items, covers, trends
- **ShiftBot** — AI assistant powered by Gemini 1.5 Flash

---

## Env Variables

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://...           # Neon Postgres pooler URL
BETTER_AUTH_SECRET=...                  # 32+ char random string
BETTER_AUTH_URL=http://localhost:4200   # Base URL (update for prod)
STRIPE_SECRET_KEY=sk_live_...          # Stripe secret key
GEMINI_API_KEY=...                      # Google AI Studio API key
```

---

## Development

```bash
# Install dependencies
bun install

# Push DB schema
cd packages/web && bunx drizzle-kit push

# Seed menu data
bun run seed.ts  # (from packages/web/)

# Dev server (port 4200)
bun run dev
```

---

## Production Build

```bash
bun run build
```

Output: `packages/web/dist/`

---

## Coolify Deployment (self-hosted VPS)

1. In Coolify, create a new **Application** → **Git Repository**
2. Point to this repo
3. Set build command: `bun install && bun run build`
4. Set start command: `bun run packages/web/src/api/index.ts`
5. Add all env vars from above
6. Set port to **4200**
7. Deploy

> **Note**: Update `BETTER_AUTH_URL` to your production domain before deploying.

---

## Railway Deployment

1. Connect repo in Railway
2. Add a **Postgres** plugin (or use Neon — set `DATABASE_URL` manually)
3. Set env vars in Railway dashboard
4. Railway auto-detects Bun — deploy as-is
5. Set the start command: `bun run packages/web/src/api/index.ts`

---

## First Login

Register via `/auth/sign-up`. First user registered is effectively admin — no role enforcement gate on registration.

To promote to admin role, update the `role` column in the `user` table directly via Neon console or Drizzle Studio.

---

## Menu Categories

Schema uses uppercase enums: `STARTERS`, `MAINS`, `DESSERT`, `DRINKS`, `SPECIALS`

---

## Tax

16% IVA (Mexican) applied server-side on all orders.

---

## License

Proprietary — SHIFT HAPPENS! © 2025
