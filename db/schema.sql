-- ============================================================================
-- SHIFT HAPPENS! by HYDRAFORGE — PostgreSQL Schema
-- Modular Monolith · single database · strict foreign-key enforcement
--
-- Design principles (from build prompt):
--   * UUID public-facing PKs, SERIAL for internal human-facing numbers
--   * created_at on all tables, updated_at on key tables, deleted_at soft deletes
--   * JSONB for flexible data (roles.permissions, restaurants.settings,
--     menu_items.tags, order_items.modifiers)
--   * Indexes on all FK columns and frequently queried columns
--   * pgvector for the AI phone agent knowledge base
-- ============================================================================

-- pgvector extension (supported on Neon). Enables RAG retrieval for the AI agent.
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE reservation_status AS ENUM (
  'pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'
);

CREATE TYPE reservation_source AS ENUM (
  'phone', 'web', 'ai_agent', 'walk_in', 'third_party'
);

CREATE TYPE table_status AS ENUM (
  'available', 'occupied', 'reserved', 'dirty'
);

CREATE TYPE stock_transaction_reason AS ENUM (
  'purchase', 'sale_deduction', 'waste', 'adjustment', 'transfer'
);

CREATE TYPE order_status AS ENUM (
  'open', 'sent_to_kitchen', 'preparing', 'ready', 'served', 'paid', 'void'
);

CREATE TYPE order_type AS ENUM (
  'dine_in', 'takeout', 'delivery'
);

CREATE TYPE call_outcome AS ENUM (
  'reservation_booked', 'faq_answered', 'transferred_to_staff', 'voicemail', 'abandoned'
);

CREATE TYPE payment_status AS ENUM (
  'pending', 'succeeded', 'failed', 'refunded'
);

-- ============================================================================
-- AUTHENTICATION & AUTHORIZATION
-- ============================================================================

-- A restaurant tenant. All operational data hangs off this.
CREATE TABLE restaurants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  address     TEXT,
  phone       TEXT,
  timezone    TEXT NOT NULL DEFAULT 'UTC',
  settings    JSONB NOT NULL DEFAULT '{}'::jsonb,   -- hours, policies, etc.
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Role + permission set (permissions stored as JSONB array, e.g. ["pos.charge","admin.menu"])
CREATE TABLE roles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL UNIQUE,
  permissions  JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Platform users. password_hash is a bcrypt hash, never plaintext.
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  role_id         UUID NOT NULL REFERENCES roles(id),
  restaurant_id   UUID REFERENCES restaurants(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_role_id       ON users(role_id);
CREATE INDEX idx_users_restaurant_id ON users(restaurant_id);

-- ============================================================================
-- GUEST MANAGEMENT / CRM
-- ============================================================================

-- One guest profile across all restaurants in the platform.
CREATE TABLE guests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name     TEXT NOT NULL,
  last_name      TEXT NOT NULL,
  email          TEXT,
  phone          TEXT,
  vip_status     BOOLEAN NOT NULL DEFAULT false,
  total_spend    NUMERIC(10,2) NOT NULL DEFAULT 0,
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ                            -- soft delete
);

CREATE INDEX idx_guests_email ON guests(email);
CREATE INDEX idx_guests_phone ON guests(phone);

-- Guest preferences: dietary, seating, allergies (one row per type).
CREATE TABLE guest_preferences (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id          UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  preference_type   TEXT NOT NULL,                      -- e.g. 'dietary', 'seating'
  preference_value  TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_guest_preferences_guest_id ON guest_preferences(guest_id);

-- Every completed visit, for history + spend analytics.
CREATE TABLE guest_visits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id        UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  reservation_id  UUID,                                  -- FK added after reservations table
  visit_date      DATE NOT NULL,
  spend_amount    NUMERIC(10,2) NOT NULL DEFAULT 0
);

CREATE INDEX idx_guest_visits_guest_id  ON guest_visits(guest_id);
CREATE INDEX idx_guest_visits_visit_date ON guest_visits(visit_date);

-- ============================================================================
-- RESERVATIONS & FLOOR PLAN
-- ============================================================================

-- Physical tables, positioned on the floor plan canvas.
CREATE TABLE tables (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  capacity      INTEGER NOT NULL CHECK (capacity > 0),
  floor_plan_x  INTEGER NOT NULL DEFAULT 0,
  floor_plan_y  INTEGER NOT NULL DEFAULT 0,
  status        table_status NOT NULL DEFAULT 'available',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tables_restaurant_id ON tables(restaurant_id);

-- A booking. time_slot is the local wall-clock start (e.g. '19:00').
CREATE TABLE reservations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id    UUID REFERENCES guests(id) ON DELETE SET NULL,
  table_id    UUID REFERENCES tables(id) ON DELETE SET NULL,
  party_size  INTEGER NOT NULL CHECK (party_size > 0),
  date        DATE NOT NULL,
  time_slot   TIME NOT NULL,
  status      reservation_status NOT NULL DEFAULT 'pending',
  source      reservation_source NOT NULL DEFAULT 'web',
  notes       TEXT,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reservations_date_time   ON reservations(date, time_slot);
CREATE INDEX idx_reservations_guest_id    ON reservations(guest_id);
CREATE INDEX idx_reservations_table_id    ON reservations(table_id);
CREATE INDEX idx_reservations_status      ON reservations(status);

-- Idempotent upgrade: Google Calendar sync link (added after initial release).
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS google_event_id TEXT;

-- Waitlist for when no table is available at the requested slot.
CREATE TABLE waitlist (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id        UUID REFERENCES guests(id) ON DELETE SET NULL,
  party_size      INTEGER NOT NULL CHECK (party_size > 0),
  requested_date  DATE NOT NULL,
  requested_time  TIME NOT NULL,
  status          TEXT NOT NULL DEFAULT 'waiting',      -- waiting | notified | seated | cancelled
  notified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_waitlist_date_status ON waitlist(requested_date, status);

-- Circular FK: guest_visits.reservation_id -> reservations.
ALTER TABLE guest_visits
  ADD CONSTRAINT fk_guest_visits_reservation
  FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE SET NULL;

-- ============================================================================
-- MENU & RECIPES
-- ============================================================================

CREATE TABLE menu_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE menu_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   UUID NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  price         NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  image_url     TEXT,
  is_available  BOOLEAN NOT NULL DEFAULT true,
  tags          JSONB NOT NULL DEFAULT '[]'::jsonb,     -- e.g. ["gluten-free", "spicy"]
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX idx_menu_items_category_id ON menu_items(category_id);

-- Add-on options (e.g. "extra cheese", "well done").
CREATE TABLE modifiers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  price_adjustment  NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_required       BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Junction: which modifiers apply to which menu items.
CREATE TABLE menu_item_modifiers (
  menu_item_id  UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  modifier_id   UUID NOT NULL REFERENCES modifiers(id) ON DELETE CASCADE,
  PRIMARY KEY (menu_item_id, modifier_id)
);

-- Recipe links a menu item to its ingredient requirements.
CREATE TABLE recipes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id  UUID NOT NULL UNIQUE REFERENCES menu_items(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- INVENTORY
-- ============================================================================

CREATE TABLE ingredients (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  unit              TEXT NOT NULL,
  current_stock     NUMERIC(12,3) NOT NULL DEFAULT 0,
  reorder_threshold NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit_cost         NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_ingredients_restaurant_id ON ingredients(restaurant_id);

-- Ingredient components of a recipe (drives POS auto-deduction).
CREATE TABLE recipe_ingredients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id     UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity      NUMERIC(10,3) NOT NULL CHECK (quantity > 0),
  unit          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recipe_ingredients_recipe_id     ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ingredients_ingredient_id ON recipe_ingredients(ingredient_id);

CREATE TABLE suppliers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  contact_email  TEXT,
  contact_phone  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Which suppliers carry which ingredients, at what price/lead time.
CREATE TABLE ingredient_suppliers (
  ingredient_id    UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  supplier_id      UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  price            NUMERIC(10,2) NOT NULL,
  lead_time_days   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ingredient_id, supplier_id)
);

-- Audit log of every stock movement (the source of truth for COGS).
CREATE TABLE stock_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id     UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity_change   NUMERIC(12,3) NOT NULL,             -- signed: +purchase / -sale_deduction
  reason            stock_transaction_reason NOT NULL,
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_transactions_ingredient_id ON stock_transactions(ingredient_id);
CREATE INDEX idx_stock_transactions_created_at    ON stock_transactions(created_at);

-- Low-stock / reorder alerts generated by the POS sale workflow.
CREATE TABLE inventory_alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  alert_type    TEXT NOT NULL DEFAULT 'low_stock',      -- low_stock | reorder_suggested
  message       TEXT,
  status        TEXT NOT NULL DEFAULT 'open',           -- open | resolved
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at   TIMESTAMPTZ
);

CREATE INDEX idx_inventory_alerts_status ON inventory_alerts(status);

-- ============================================================================
-- POS & ORDERS
-- ============================================================================

CREATE TABLE orders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number SERIAL UNIQUE,                            -- internal human-readable #
  table_id    UUID REFERENCES tables(id) ON DELETE SET NULL,
  guest_id    UUID REFERENCES guests(id) ON DELETE SET NULL,
  server_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  status      order_status NOT NULL DEFAULT 'open',
  order_type  order_type NOT NULL DEFAULT 'dine_in',
  total       NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax         NUMERIC(10,2) NOT NULL DEFAULT 0,
  tip         NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at   TIMESTAMPTZ
);

-- Idempotent upgrade path: databases created before orders.updated_at existed
-- gain the column on the next `npm run migrate` without a full --reset.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX idx_orders_status     ON orders(status);
CREATE INDEX idx_orders_table_id   ON orders(table_id);
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- Line items. modifiers stored as JSONB snapshot, e.g. [{name:"Extra Cheese", price:1.5}]
CREATE TABLE order_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id  UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  unit_price    NUMERIC(10,2) NOT NULL,
  modifiers     JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'active',          -- active | void
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- Payment ledger per order (supports split checks: multiple rows per order).
CREATE TABLE transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_method    TEXT NOT NULL,                        -- card | cash | split
  amount            NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  stripe_payment_id TEXT,
  status            payment_status NOT NULL DEFAULT 'pending',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_order_id ON transactions(order_id);

-- ============================================================================
-- STAFF & SCHEDULING
-- ============================================================================

-- Staff are users with restaurant-specific employment details.
CREATE TABLE staff (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  role          TEXT NOT NULL,                            -- manager | server | cook | host
  hourly_rate   NUMERIC(10,2) NOT NULL DEFAULT 0,
  hire_date     DATE,
  status        TEXT NOT NULL DEFAULT 'active',           -- active | on_leave | terminated
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_restaurant_id ON staff(restaurant_id);

CREATE TABLE shifts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id      UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  role          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shifts_staff_id ON shifts(staff_id);
CREATE INDEX idx_shifts_date     ON shifts(date);

CREATE TABLE time_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id       UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  clock_in       TIMESTAMPTZ NOT NULL,
  clock_out      TIMESTAMPTZ,
  break_minutes  INTEGER NOT NULL DEFAULT 0,
  tips_declared  NUMERIC(10,2) NOT NULL DEFAULT 0
);

CREATE INDEX idx_time_logs_staff_id ON time_logs(staff_id);

-- ============================================================================
-- EVENTS & CATERING
-- ============================================================================

CREATE TABLE event_leads (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  contact_name   TEXT NOT NULL,
  contact_email  TEXT,
  contact_phone  TEXT,
  event_type     TEXT,
  event_date     DATE,
  guest_count    INTEGER,
  budget         NUMERIC(10,2),
  status         TEXT NOT NULL DEFAULT 'new',             -- new | contacted | proposed | won | lost
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_leads_restaurant_id ON event_leads(restaurant_id);

CREATE TABLE event_proposals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id           UUID NOT NULL REFERENCES event_leads(id) ON DELETE CASCADE,
  proposal_pdf_url  TEXT,
  total_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  valid_until       DATE,
  status            TEXT NOT NULL DEFAULT 'draft',        -- draft | sent | accepted | declined
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE event_contracts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id          UUID NOT NULL REFERENCES event_proposals(id) ON DELETE CASCADE,
  docusign_envelope_id TEXT,
  docusign_status      TEXT,                              -- pending | sent | completed | declined | voided
  signed_at            TIMESTAMPTZ,
  deposit_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  deposit_paid         BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotent upgrade: DocuSign envelope state (added after initial release).
ALTER TABLE event_contracts ADD COLUMN IF NOT EXISTS docusign_status TEXT;

-- ============================================================================
-- AI PHONE AGENT
-- ============================================================================

-- Every call handled by the AI agent (Twilio Voice).
CREATE TABLE call_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  phone_number   TEXT,
  direction      TEXT NOT NULL DEFAULT 'inbound',         -- inbound | outbound
  twilio_call_sid TEXT UNIQUE,                            -- idempotent per-call logging
  duration       INTEGER NOT NULL DEFAULT 0,              -- seconds
  transcript     TEXT,
  outcome        call_outcome,
  reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_call_logs_restaurant_id ON call_logs(restaurant_id);
CREATE INDEX idx_call_logs_created_at    ON call_logs(created_at);

-- RAG knowledge base. embedding is a pgvector column (1536d for text-embedding-3-small).
CREATE TABLE knowledge_base (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category       TEXT NOT NULL,                           -- menu | hours | policies | allergens
  question       TEXT,
  answer         TEXT NOT NULL,
  embedding      VECTOR(1536),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_knowledge_base_category ON knowledge_base(category);
CREATE INDEX idx_knowledge_base_embedding ON knowledge_base
  USING hnsw (embedding vector_cosine_ops);

-- ============================================================================
-- SERVICE CREDENTIALS (per-user OAuth tokens, e.g. Google Calendar)
-- ============================================================================

-- User-level provider credentials. Only refresh tokens are stored persistently
-- (access tokens are short-lived and refreshed in lib/googleCalendar.ts).
CREATE TABLE service_credentials (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service       TEXT NOT NULL,                            -- e.g. 'google_calendar'
  scope         TEXT,
  access_token  TEXT,
  refresh_token TEXT,
  expires_at    TIMESTAMPTZ,
  raw           JSONB NOT NULL DEFAULT '{}'::jsonb,       -- provider-specific extras
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, service)
);

CREATE INDEX idx_service_credentials_user ON service_credentials(user_id);

-- ============================================================================
-- TIER 3: DYNAMIC PRICING / SOCIAL AUTOMATION / HEALTH & SAFETY (HACCP)
-- ============================================================================

-- Demand-based pricing rules. Multipliers stack multiplicatively when several
-- rules match the same item/time. config examples:
--   peak_hours / happy_hour: {"start":"17:00","end":"21:30","days":[3,4,5,6]}
--   weekend:                {"days":[5,6]}
--   low_stock:               {"ingredient_id":"<uuid>"}  (empty = any recipe
--                        ingredient at/below its reorder threshold)
CREATE TABLE IF NOT EXISTS pricing_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('peak_hours','happy_hour','weekend','low_stock')),
  multiplier  NUMERIC(4,2) NOT NULL CHECK (multiplier > 0 AND multiplier < 10),
  config      JSONB NOT NULL DEFAULT '{}'::jsonb,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Social media automation: drafted / scheduled / published posts.
CREATE TABLE IF NOT EXISTS social_posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  platform      TEXT NOT NULL DEFAULT 'generic',      -- instagram | facebook | x | generic
  content       TEXT NOT NULL,
  source        TEXT NOT NULL DEFAULT 'manual',        -- manual | llm | template
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','published')),
  scheduled_at  TIMESTAMPTZ,
  published_at  TIMESTAMPTZ,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status);

-- HACCP: temperature logs, cleaning checks, safety incidents.
-- Temperature thresholds are applied at write time (cold ≤ 4 °C, hot ≥ 60 °C)
-- and out-of-range readings are auto-flagged for follow-up.
CREATE TABLE IF NOT EXISTS haccp_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('temperature','cleaning','incident')),
  station       TEXT,
  celsius       NUMERIC(5,1),
  status        TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','flagged','resolved')),
  notes         TEXT,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_haccp_logs_created_at ON haccp_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_haccp_logs_status     ON haccp_logs(status);

-- ============================================================================
-- SEED DATA (roles + a demo restaurant)
-- ============================================================================

INSERT INTO roles (name, permissions) VALUES
  ('owner',        '["*"]'),
  ('general_manager', '["pos.charge","pos.refund","inventory.manage","reservations.manage","staff.manage","reports.view","menu.manage","ai.configure"]'),
  ('manager',      '["pos.charge","inventory.manage","reservations.manage","reports.view","menu.manage"]'),
  ('server',       '["pos.charge","reservations.create","guest.view"]'),
  ('host',         '["reservations.manage","guest.view"]'),
  ('cook',         '["kds.view","inventory.view"]')
ON CONFLICT (name) DO NOTHING;

INSERT INTO restaurants (id, name, timezone, settings) VALUES
  (gen_random_uuid(), 'SHIFT HAPPENS!', 'America/Denver',
   '{"hours":{"mon":["11:00","22:00"],"tue":["11:00","22:00"],"wed":["11:00","22:00"],"thu":["11:00","23:00"],"fri":["11:00","23:00"],"sat":["10:00","23:00"],"sun":["10:00","21:00"]}}'::jsonb);
