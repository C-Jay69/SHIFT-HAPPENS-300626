# SHIFT HAPPENS! — Architecture

**Module:** Modular Monolith · **Stack:** React (Vite) + Node/Express + PostgreSQL
**Goal:** One database, clean domain boundaries, API-first, deploy-ready.

> Status: the SPA is production-buildable and PWA-ready. The Express API is
> scaffolded with the Tier-1 core flows implemented. Remaining work is listed
> in [Deployment Roadmap](#deployment-roadmap).

---

## 1. Directory Structure

```
SHIFT_HAPPENS_170626/
├── App.tsx                 # App shell, lazy routes, mobile nav
├── components/             # Shared UI (Sidebar, ErrorBoundary)
├── pages/                  # Route modules (POS, Inventory, Reservations, KDS, Admin, AI Agent)
├── services/               # Client-side service clients (api, openrouterService)
├── store.tsx               # In-memory context store (frontend demo fallback)
├── constants.ts / types.ts
├── index.css               # Tailwind v4 theme (shift colors, animations)
├── db/
│   └── schema.sql          # Complete PostgreSQL schema (all entity groups)
├── public/
│   └── icons/              # PWA manifest icons
└── server/                 # Express API (workspace package @shift-happens/api)
    ├── src/
    │   ├── index.ts        # App bootstrap, route mounting
    │   ├── db.ts           # pg connection pool
    │   ├── migrate.ts      # Applies db/schema.sql
    │   ├── seed.ts         # Creates owner role + admin user
    │   ├── lib/            # password hashing
    │   ├── middleware/     # auth (JWT + RBAC), error handling
    │   └── routes/         # auth · guests · reservations · menu · inventory · orders
    └── tsconfig.json
```

## 2. API Surface (`/api/v1`)

| Method | Route | Purpose | Auth |
|---|---|---|---|
| POST | `/auth/register` | Create user | — |
| POST | `/auth/login` | Issue JWT | — |
| GET | `/auth/me` | Current user | Bearer |
| GET/POST | `/guests` · `/guests/:id` (PATCH) | Guest CRM | Bearer |
| GET/POST | `/reservations` · `/reservations/:id` (PATCH) | Bookings | Bearer |
| GET | `/reservations/waitlist` | Waitlist queue | Bearer |
| GET/POST | `/menu/categories` | Menu categories | Bearer / `menu.manage` |
| GET/POST | `/menu/items` · `/menu/items/:id` (PATCH/DELETE) | Menu + recipes | `menu.manage` |
| GET/POST | `/inventory/ingredients` | Stock levels | `inventory.manage` |
| POST | `/inventory/adjustments` | Audited stock movement | `inventory.manage` |
| GET/POST | `/inventory/suppliers` | Suppliers | `inventory.manage` |
| GET | `/inventory/alerts` | Open low-stock alerts | Bearer |
| POST | `/orders` | Connected POS sale (transactional) | Bearer |
| GET | `/orders` | Order list with items | Bearer |
| POST | `/orders/:id/pay` | Payment + close | Bearer |

## 3. Core Workflows (implemented)

**Smart Reservation** — resolves/creates the guest → finds an available table
(capacity ≥ party, table `available`, no live reservation within ±2h) →
`confirmed` reservation + table marked `reserved`, **or** adds to `waitlist` and
returns position + estimated wait. Fully transactional.

**Connected POS Sale** — creates order + line items inside one transaction →
deducts recipe ingredients per sold unit → writes `stock_transactions`
(`sale_deduction`) → fires `inventory_alerts` when below threshold → computes
total + tax → marks table `occupied`. **Rolls back on any failure.**

**Payment** — writes `transactions`, flips order to `paid`, bumps
`guests.total_spend`, frees the table. Stripe gateway is stubbed behind
`STRIPE_SECRET_KEY`.

## 4. Integrations Map (build prompt → wiring)

| Service | Phase | Status |
|---|---|---|
| OpenRouter (AI gateway) | AI chat / upsell | ✅ backend proxy (`/api/v1/ai/chat`) + RAG |
| Twilio Voice | AI Phone Agent | 🔜 needs `twilio` + webhook route |
| Twilio SMS / SendGrid / Google+Outlook Cal | Reservation notifications | 🔜 |
| Stripe | Payments | 🔜 gateway in `orders/:id/pay` |
| DocuSign / Places / Yelp / SerpApi | Tiers 2–3 | 🔜 |

## 5. Deployment Roadmap

- **Phase 3 (next):** replace in-memory store with API calls; add Twilio Voice
  webhook + RAG (`knowledge_base` is already in the schema with pgvector);
  Vite backend proxy is already configured.
- **Phase 4:** Stripe Connect, SendGrid/SMS confirmations, KDS via WebSockets.
- **Phase 5:** staff scheduling, events/catering, floor-plan drag & drop,
  Tier-3 intelligence modules.

## 6. Commands

```bash
npm run dev          # Vite SPA on :3000 (proxies /api → :4000)
npm run dev:api      # Express API on :4000
npm run migrate      # apply db/schema.sql to DATABASE_URL
npm run seed         # create owner role + admin user
npm run build        # production SPA (PWA included)
npm run build:api    # compile server
npm run typecheck    # frontend tsc
```
