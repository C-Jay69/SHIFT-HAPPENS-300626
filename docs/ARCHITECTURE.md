# SHIFT HAPPENS! — Architecture

**Module:** Modular Monolith · **Stack:** React (Vite) + Node/Express + PostgreSQL (pgvector)
**Goal:** One database, clean domain boundaries, API-first, deploy-ready.

> Status: single production process (Express serves the built SPA + REST API +
> socket.io on one port). Tier-1 cores plus Stripe payments, real-time KDS,
> staff scheduling, and events/catering are implemented. The `laravel-restaurant-main/`
> and `tastyigniter-setup-4.0.0/` directories are feature references only and are
> excluded from the build.

---

## 1. Directory Structure

```
SHIFT-HAPPENS-300626/
├── App.tsx                 # App shell, lazy routes, mobile nav
├── components/             # Shared UI (Sidebar, ErrorBoundary)
├── pages/                  # Dashboard · POS · Reservations · Inventory · KDS · AIAgent · Staff · Events · Admin · Login
├── services/               # Client-side clients (api, openrouterService, realtime)
├── store.tsx               # Context store: server-backed with demo fallback + realtime refresh
├── constants.ts / types.ts
├── index.css               # Tailwind v4 theme (shift colors, animations)
├── db/
│   └── schema.sql          # Complete PostgreSQL schema (all entity groups incl. staff, events)
├── public/
│   └── icons/              # PWA manifest icons
├── server/                 # Express API + SPA static host + socket.io
│   ├── src/
│   │   ├── index.ts        # Bootstrap: createServer, socket.io, static SPA, route mounting
│   │   ├── db.ts           # pg connection pool
│   │   ├── migrate.ts      # Applies db/schema.sql
│   │   ├── seed.ts         # Categories, ingredients, menu + recipes, demo staff/events
│   │   ├── lib/            # payment.ts (Stripe) · realtime.ts (socket.io) · reservation.ts · knowledge.ts
│   │   ├── middleware/     # auth (JWT + RBAC), error handling
│   │   └── routes/         # auth · staff · events · guests · reservations · menu · inventory · orders · tables · ai · knowledge-base · voice · integrations · stripe
│   └── dist/               # Compiled (npm run build:api)
├── ecosystem.config.cjs    # PM2 (single API process, cwd repo root)
├── .env.example            # All env vars the server reads
└── laravel-restaurant-main/  # FEATURE REFERENCE ONLY (excluded from build)
```

## 2. API Surface

All routes mounted under `/api/v1` (payloads are camelCase, DB rows snake_case).

| Method | Route | Purpose |
|---|---|---|
| POST | `/auth/register` · `/auth/login` · GET `/auth/me` | Users, JWT |
| GET/POST | `/guests` · PATCH `/guests/:id` | Guest CRM |
| GET/POST | `/reservations` · PATCH `/reservations/:id` · GET `/waitlist` | Smart booking + waitlist |
| GET/POST | `/tables` · PATCH `/tables/:id` | Floor plan + status |
| GET/POST | `/menu/categories` · `/menu/items` · PATCH/DELETE `/menu/items/:id` | Menu + recipes |
| GET/POST | `/inventory/ingredients` · `/adjustments` · `/suppliers` · GET `/alerts` | Stock + alerts |
| GET/POST | `/orders` · PATCH `/orders/:id/status` · POST `/orders/:id/pay` · POST `/orders/:id/void` | POS + payment + void |
| GET/POST | `/staff` · `/staff/shifts` (PATCH/DELETE) · `/staff/clock-in|clock-out` · `/staff/time-logs` | Roster + scheduling |
| GET/POST | `/events/leads` (PATCH) · `/events/proposals` · `/events/proposals/:id/accept` · GET `/events/contracts` | Events + catering |
| POST | `/stripe/payment-intents/:orderId` | Card payment via POS |
| POST | `/stripe/webhook` | `payment_intent.succeeded` → finalize order (raw body) |
| GET/POST | `/ai/chat` · GET `/ai/status` | ShiftBot (LLM + RAG) |
| GET/POST | `/knowledge-base` | RAG source documents |
| GET/POST | `/voice/calls` | Twilio AI phone agent webhooks |
| GET | `/integrations` | Liveness of Stripe/Twilio/SendGrid/Google/DocuSign/LLM/Yelp |
| GET | `/health` | Liveness (unauthenticated) |

## 3. Core Workflows (implemented)

**Smart Reservation** — resolves/creates the guest → finds an available table
(capacity ≥ party, `available`, no live reservation within ±2h) → `confirmed`
reservation + table marked `reserved`, or adds to `waitlist` and returns
position + estimated wait. Fully transactional.

**Connected POS Sale** — order + line items in one transaction → deducts recipe
ingredients per unit → writes `stock_transactions` (`sale_deduction`) → fires
`inventory_alerts` below threshold → computes total + tax → marks table
`occupied`. **Rolls back on failure.**

**Stripe Payment** — `POST /orders/:id/pay` with `method=card` creates a
PaymentIntent (via `lib/payment.ts`) and returns `clientSecret`; the Stripe
webhook confirms it and `finalizePaidOrder` marks the order `paid`, records the
`transactions` row, bumps `guests.total_spend`, and frees the table. `void`
reverses stock.

**Real-time KDS** — `lib/realtime.ts` wraps an `http.Server` with socket.io.
Server emits `order:created` / `order:status` (via `broadcastOrderUpdate`) and
`table:updated`. The frontend `services/realtime.ts` connects once and the root
store refreshes from the API on every event — so a terminal on any room (POS,
KDS, phone) updates live.

## 4. Integrations Map

| Service | Wiring | Status |
|---|---|---|
| OpenRouter / Gemini | `ai` + `knowledge-base` routes (RAG, pgvector) | ✅ |
| Stripe | `stripe` route + webhook, `finalizePaidOrder` shared | ✅ (needs keys) |
| Twilio Voice | `voice` route (call flow, waitlist, transfer) | ✅ (needs keys) |
| Twilio SMS / SendGrid | notification helpers gated on key presence | 🟡 code present, keys required |
| Google Calendar / Maps / Places | calendar sync + floor plan + reviews | 🟡 key-gated |
| DocuSign | event contracts (`DEPOSIT` 20%) | 🟡 key-gated |
| Yelp | review sentiment in AI context | 🟡 key-gated |

## 5. Deployment

One Node process serves everything. Configure `.env` (see `.env.example`).

```bash
npm install && npm run migrate && npm run seed
npm run build      # dist/ (SPA + PWA)
npm run build:api  # server/dist/
```

- **Local:** `npm run dev` (:3000 Vite, proxies `/api` → :4000) + `npm run dev:api`
- **PM2:** `pm2 start ecosystem.config.cjs` runs `server/dist/index.js` once, serving API + SPA + socket.io on `:4000`
- **Reverse proxy:** point your web server at `:4000` (or set `PORT`); a
  `docker-compose.yml` (postgres + web) is included.
- **Note:** root `npm install` can fail on the arborist workspace link bug
  ("Cannot read properties of null"); use `bun add <pkg>` as a drop-in for new deps.

## 6. Commands

```bash
npm run dev          # Vite SPA on :3000 (proxies /api → :4000)
npm run dev:api      # Express API on :4000
npm run migrate      # apply db/schema.sql to DATABASE_URL
npm run seed         # owner role + admin user + demo data
npm run build        # production SPA (PWA included)
npm run build:api    # compile server
npm run typecheck    # frontend tsc
```