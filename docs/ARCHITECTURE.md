# SHIFT HAPPENS! — Architecture

**Module:** Modular Monolith · **Stack:** React (Vite) + Node/Express + PostgreSQL (pgvector)
**Goal:** One database, clean domain boundaries, API-first, deploy-ready.

> Status: **deployment-ready**. Single production process (Express serves the
> built SPA + REST API + socket.io on one port). Tier-1 cores plus Stripe
> payments, real-time KDS, staff scheduling, events/catering, reservation
> confirmations (Twilio SMS + SendGrid), and an in-process waitlist cron are
> implemented. `db/schema.sql` applies with or without the `pgvector`
> extension (vector RAG degrades to keyword search when it's absent). The
> `laravel-restaurant-main/` and `tastyigniter-setup-4.0.0/` directories are
> feature references only and are excluded from the build (and from the Docker
> image via `.dockerignore`).

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
│   │   ├── index.ts        # Bootstrap: createServer, socket.io, static SPA, waitlist cron, route mounting
│   │   ├── db.ts           # pg connection pool
│   │   ├── migrate.ts      # Applies db/schema.sql (auto-detects pgvector)
│   │   ├── seed.ts         # Roles, admin, menu + recipes, demo staff/events
│   │   ├── lib/            # payment.ts (Stripe) · realtime.ts (socket.io) · reservation.ts ·
│   │   │                   # knowledgeBase.ts (RAG) · pgvector.ts (feature detect) ·
│   │   │                   # notify.ts (Twilio SMS + SendGrid) · waitlist.ts (auto-seat cron)
│   │   ├── middleware/     # auth (JWT + RBAC), error handling
│   │   └── routes/         # auth · staff · events · guests · reservations · menu · inventory · orders · tables · ai · knowledge-base · voice · integrations · stripe
│   └── dist/               # Compiled (npm run build:api)
├── ecosystem.config.cjs    # PM2 (single API process, cwd repo root)
├── smoke-test.mjs          # End-to-end API + workflow test (resets + reseeds first)
├── .env.example            # All env vars the server reads
├── .dockerignore           # Keeps reference dirs / node_modules out of the image
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
| GET/POST | `/knowledge-base` (+ `/ingest-menu`, `/search`) | RAG source documents |
| POST/GET | `/voice` · `/voice/turn` · GET `/voice/calls` | Twilio AI phone agent webhooks |
| GET | `/integrations` | Liveness of Stripe/Twilio/SendGrid/Google/DocuSign/LLM/Yelp |
| GET | `/health` | Liveness (unauthenticated) |

## 3. Core Workflows (implemented)

**Smart Reservation** — resolves/creates the guest → finds an available table
(capacity ≥ party, `available`, no live reservation within ±2h) → `confirmed`
reservation + table marked `reserved`, or adds to `waitlist` and returns
position + estimated wait. Fully transactional. On confirm, fire-and-forget
Twilio SMS + SendGrid email confirmations are sent (`lib/notify.ts`,
key-gated). When waitlisted, the guest gets a "you're #N" SMS.

**Waitlist auto-seat cron** — `lib/waitlist.ts` ticks every `WAITLIST_CRON_MS`
(default 60s, `0` disables) and re-runs availability for waiting entries whose
date has arrived. When a slot opens the guest is booked (`source='phone'`),
the waitlist row is marked `notified`, and the guest is pinged by SMS/email.
Re-checks use `skipWaitlist` so entries are never double-added.

**Connected POS Sale** — order + line items in one transaction → deducts recipe
ingredients per unit → writes `stock_transactions` (`sale_deduction`) → fires
`inventory_alerts` below threshold → computes total + tax → marks table
`occupied`. **Rolls back on failure.**

**Stripe Payment** — `POST /orders/:id/pay` with `method=card` creates a
PaymentIntent (via `lib/payment.ts`) and returns `clientSecret`; the Stripe
webhook confirms it and `finalizePaidOrder` marks the order `paid`, records the
`transactions` row, bumps `guests.total_spend`, and frees the table. Cash/split
payments finalize inline. `void` reverses stock.

**Real-time KDS** — `lib/realtime.ts` wraps an `http.Server` with socket.io.
Server emits `order:created` / `order:status` (via `broadcastOrderUpdate`) and
`table:updated`. The frontend `services/realtime.ts` connects once and the root
store refreshes from the API on every event — so a terminal on any room (POS,
KDS, phone) updates live.

**AI Phone Agent** — Twilio Voice webhook → `routes/voice.ts` builds TwiML by
hand: greeting + `<Gather>` speech loop, intent detection (book / transfer /
FAQ / goodbye), free-form party/time parsing, live booking through the same
`smartReservation` flow (source `ai_agent`), staff transfer via `<Dial>`, FAQ
answers from the RAG knowledge base, full transcript + outcome in `call_logs`.

## 4. Integrations Map

| Service | Wiring | Status |
|---|---|---|
| OpenRouter (any OpenAI-compatible LLM) | `ai` + `knowledge-base` routes (RAG; pgvector when available) | ✅ key-gated |
| Stripe | `stripe` route + webhook, `finalizePaidOrder` shared | ✅ key-gated |
| Twilio Voice | `voice` route (call flow, booking, transfer) | ✅ key-gated |
| Twilio SMS | `lib/notify.ts` — reservation + waitlist SMS | ✅ key-gated |
| SendGrid | `lib/notify.ts` — reservation + waitlist email | ✅ key-gated |
| Google Calendar / Maps / Places | calendar sync + floor plan + reviews | 🟡 env vars wired, API calls TBD |
| DocuSign | event contracts (`DEPOSIT` 20%) | 🟡 env vars wired, API calls TBD |
| Yelp | review sentiment in AI context | 🟡 env var wired, API calls TBD |

All integrations are key-gated: with zero third-party keys the platform runs
fully (POS, reservations, KDS, inventory, scheduling, RAG keyword search); each
key you add switches on the corresponding channel. `GET /integrations` reports
live status for the Admin page.

## 5. Deployment

One Node process serves everything. Configure `.env` (see `.env.example`).

```bash
npm install && npm run migrate && npm run seed
npm run build      # dist/ (SPA + PWA)
npm run build:api  # server/dist/
```

- **Local:** `npm run dev` (:3000 Vite, proxies `/api` → :4000) + `npm run dev:api`
- **PM2:** `pm2 start ecosystem.config.cjs` runs `server/dist/index.js` once, serving API + SPA + socket.io on `:4000`
- **Docker:** `docker compose up --build` starts `pgvector/pgvector:pg16` + the
  web service (API + SPA + socket.io on :4000)
- **Database:** any PostgreSQL 14+. With the `pgvector` extension (Neon,
  Supabase, the compose image) the AI knowledge base uses vector RAG with an
  HNSW index; without it, `migrate` automatically applies a JSONB-embedding
  variant and RAG falls back to full-text keyword search.
- **Verify:** `node smoke-test.mjs` — resets + reseeds, then exercises 66
  end-to-end checks across auth/RBAC, POS (stock deduction, alerts, payment,
  void), KDS status, reservations (book/waitlist/cancel), the AI phone agent
  call flow, RAG, staff clock, events, and the waitlist auto-seat cron.

## 6. Deployment-Ready Checklist

| Item | Status |
|---|---|
| `npm install` resolves on a clean checkout | ✅ (React 19 peer-deps fixed) |
| Frontend `tsc --noEmit` + production build + PWA (manifest + SW) | ✅ |
| Server `tsc` build | ✅ |
| Schema applies fresh (with and without pgvector) + idempotent re-migrate | ✅ |
| Seed is idempotent (safe to re-run) | ✅ |
| E2E smoke suite (66 checks) | ✅ |
| Single-port production serving (API + SPA + socket.io) | ✅ |
| Docker image (multi-stage, `.dockerignore`) + compose (db + web) | ✅ |
| PM2 single-process config | ✅ |
| `.env.example` covers every variable the server reads | ✅ |
| Secrets: never committed; `.env` git-ignored | ✅ |

## 7. Commands

```bash
npm run dev          # Vite SPA on :3000 (proxies /api → :4000)
npm run dev:api      # Express API on :4000
npm run migrate      # apply db/schema.sql to DATABASE_URL (--reset to drop first)
npm run seed         # roles + admin user + demo data (idempotent)
npm run build        # production SPA (PWA included)
npm run build:api    # compile server
npm run typecheck    # frontend tsc
node smoke-test.mjs  # end-to-end API + workflow verification
```
