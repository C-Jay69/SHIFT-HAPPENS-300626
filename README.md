# SHIFT HAPPENS! by HYDRAFORGE

A comprehensive, mobile-first restaurant management platform that unifies
**POS, Inventory, Reservations, Kitchen Display, Staff Scheduling, Events &
Catering, and a 24/7 AI phone agent** in one modular monolith — one database,
one port, one deploy.

Built to the spec in [`SHIFT HAPPENS BUILD PROMPT.md`](SHIFT%20HAPPENS%20BUILD%20PROMPT.md).
Architecture details live in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Modules

| Tier | Modules |
|---|---|
| Core (Tier 1) | Auth/RBAC · Guest CRM · Smart Reservations + Waitlist · POS (touch) · Menu + Recipes · Inventory with auto-deduction · **AI Phone Agent** (Twilio Voice + RAG) |
| Operations (Tier 2) | Staff & Scheduling + Time Clock · Real-time Kitchen Display (socket.io) · Events & Catering pipeline · Drag-and-drop Floor Plan |
| Platform | PWA (offline-capable POS), Stripe payments + webhooks, integration status dashboard |

Everything is API-first (`/api/v1`), transactional where it matters, and
key-gated for third-party services — the whole platform runs with **zero
external API keys** and each key you add switches on its channel.

## Quickstart (local dev)

```bash
npm install
cp .env.example .env        # set DATABASE_URL (Postgres 14+; pgvector optional)
npm run migrate             # apply db/schema.sql
npm run seed                # roles + admin (admin@shifthappens.test / ChangeMe123!) + demo data
npm run dev                 # Vite SPA on :3000 (proxies /api → :4000)
npm run dev:api             # Express API on :4000
```

Default login after seeding: **admin@shifthappens.test / ChangeMe123!**
(override with `ADMIN_EMAIL` / `ADMIN_PASSWORD`).

## Production build

```bash
npm run build        # dist/  — SPA + PWA service worker + manifest
npm run build:api    # server/dist/ — compiled API
```

One Node process serves the API, the built SPA, and socket.io on a single
port (`PORT`, default 4000):

- **PM2:** `pm2 start ecosystem.config.cjs`
- **Docker:** `docker compose up --build` (Postgres with pgvector + web)
- **Bare metal / VPS:** point any reverse proxy at `:4000`

Database: any PostgreSQL 14+. With the `pgvector` extension (Neon, Supabase,
the compose image) the AI knowledge base uses vector RAG (HNSW index); without
it the migration automatically degrades to a JSONB embedding column +
full-text keyword search so nothing breaks.

## Verify

```bash
node smoke-test.mjs
```

End-to-end suite (66 checks) against a running instance: auth + RBAC, connected
POS sales (stock deduction, low-stock alerts, payment, void/reverse), KDS
status updates, smart reservations (book / waitlist / cancel), the AI phone
agent call flow, RAG search, staff clock-in/out, events pipeline, integration
status, and the waitlist auto-seat cron. **It resets and reseeds the database
first** — don't point it at a production DB.

## Environment variables

See [`.env.example`](.env.example) — every variable the server reads is
documented there:

- **Required:** `DATABASE_URL`, `JWT_SECRET` (or `BETTER_AUTH_SECRET`)
- **AI:** `OPENROUTER_API_KEY` (+ optional model/base-url overrides)
- **Payments:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- **Notifications:** `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER`, `SENDGRID_API_KEY`
- **AI phone agent:** point your Twilio number at `POST /api/v1/voice`, set
  `STAFF_TRANSFER_NUMBER` for human escalation, optional `VOICE_RESTAURANT_ID`
- **Background jobs:** `WAITLIST_CRON_MS` (default 60000, `0` disables)

## Repository layout

```
App.tsx / components/ / pages/   React (Vite) + Tailwind v4 frontend (PWA)
store.tsx / services/            context store + API / socket.io clients
db/schema.sql                    complete PostgreSQL schema (all entity groups)
server/                          Express API: routes · lib · middleware · seed
smoke-test.mjs                   end-to-end verification suite
docs/ARCHITECTURE.md             architecture, API surface, deployment checklist
```

## Security notes

- `.env` is git-ignored — never commit secrets; rotate any credentials that
  have already leaked into history.
- All API routes are JWT-protected with role-based permission checks
  (`requirePermission`); Twilio webhooks are the only unauthenticated
  endpoints (protect them by allowing Twilio's IPs at the proxy if desired).
- Passwords are bcrypt-hashed; the seeded admin password is for development —
  set a strong `ADMIN_PASSWORD` before first deploy.
