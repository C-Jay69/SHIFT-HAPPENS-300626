# ***SHIFT HAPPENS\! by HYDRAFORGE BUILD PROMPT NEW & IMPROVED FOR 13TH JAN 2026***

TO:       You (the LLM)  
FROM:     Product Owner  
PROJECT:  "SHIFT HAPPENS\! by HYDRAFORGE AI"  
TYPE:     Comprehensive Restaurant Management Platform  
MODE:     Architect-First, Then Iterative Build

---

## **YOUR ROLE**

You are a Senior Full-Stack Software Architect and Lead Engineer. Your job is not to immediately write code—it's to *think first, structure completely, then build modularly*.

Treat this as a real-world engagement where you're accountable for:

* Long-term maintainability  
* Seamless integration between modules  
* Preventing future technical debt  
* Making the "smart" choice over the "quick" choice

---

## **THE VISION (Read This First—It Matters)**

Most restaurant software solves *one* problem (POS, or reservations, or scheduling). They don't talk to each other. Data lives in silos. Staff uses 5 apps. Nothing is connected.

SHIFT HAPPENS\! is different. It's a unified, interconnected platform where:

* A reservation triggers table assignment, guest preference loading, and staff alerts  
* A POS sale deducts inventory in real-time and forecasts restock needs  
* An AI phone agent handles calls 24/7, books tables, and knows the menu better than most staff  
* Everything lives in one data layer with enforced relationships

This isn't "software for restaurants." It's restaurant operations infrastructure.

---

## **🚀 THE UNFAIR ADVANTAGE (Build Around This)**

### **AI Phone Agent (Voice AI)**

Why this is the killer feature:

* Restaurants get 50+ calls during dinner rush  
* Staff can't answer → missed reservations → lost revenue  
* An AI that sounds human, knows the menu, handles FAQs, and books tables? Worth $500/month easy

Capabilities:

| Function | Description |
| ----- | ----- |
| 24/7 Call Handling | Never miss a reservation again |
| FAQ Responses | "Do you have gluten-free options?" "What time do you close?" |
| Live Booking | Checks availability, books tables, sends confirmation |
| Smart Escalation | Transfers to staff only when necessary |
| RAG-Powered Knowledge | Accesses menu, allergens, local events, personalized context |

Tech approach: Twilio Voice \+ Gemini API \+ RAG pipeline pulling from restaurant knowledge base.

*⚠️ Architectural Directive: This feature should be a first-class citizen in the schema and API design—not bolted on later.*

---

## **TECHNICAL CONSTRAINTS**

### **Stack (Non-Negotiable)**

| Layer | Technology |
| ----- | ----- |
| Frontend | React (Vite) or Next.js |
| Backend | Node.js / Express |
| Database | PostgreSQL |
| Styling | Tailwind CSS |
| Architecture | Modular Monolith |

### **Design Philosophy**

| Principle | Implementation |
| ----- | ----- |
| Mobile-First | Responsive breakpoints, touch-friendly interfaces |
| PWA Support | Offline capabilities for POS terminal |
| Modular Monolith | Shared database, separate domain modules, clean boundaries |
| API-First | All frontend interactions through versioned REST/GraphQL endpoints |

---

## **🎨 DESIGN SYSTEM REFERENCE**

### **Color Palette**

Backgrounds:

text

Black:      \#000000  →  bg-black  
Dark Gray:  \#2a2a2a  →  bg-\[\#2a2a2a\]

Gray 900:   \#111827  →  bg-gray-900

Gradients:

text

Primary BG:     from-gray-900 to-black  
Accent:         from-purple-500 to-cyan-500  
Text Gradient:  from-blue-400 to-cyan-400 (bg-clip-text text-transparent)

Alt Text:       from-purple-400 to-blue-400

Text Colors:

text

Primary:    \#ffffff  →  text-white  
Secondary:  \#d1d5db  →  text-gray-300  
Tertiary:   \#9ca3af  →  text-gray-400  
Muted:      \#6b7280  →  text-gray-500

Subtle:     \#4b5563  →  text-gray-600

Accents:

text

Blue 400:    \#60a5fa  
Cyan 400:    \#22d3ee  
Cyan 500:    \#06b6d4  
Purple 400:  \#c084fc

Purple 500:  \#a855f7

Borders:

text

Default:  \#1f2937  →  border-gray-800

Emphasis: \#ffffff  →  border-white

### **Component Patterns**

| Element | Style |
| ----- | ----- |
| Cards | bg-\[\#2a2a2a\] rounded-lg with subtle shadow |
| Primary Button | bg-gradient-to-r from-purple-500 to-cyan-500 text-white |
| Secondary Button | border-2 border-white with hover invert |
| Headings | Gradient text using bg-gradient-to-r bg-clip-text text-transparent |
| Image Placeholders | bg-gray-900 centered placeholder text |

### **Layout Patterns**

| Section | Desktop | Mobile |
| ----- | ----- | ----- |
| Navigation | Fixed top bar, horizontal links | Hamburger menu |
| Hero | Two-column (text \+ image) | Stacked |
| Features | Alternating two-column | Stacked |
| Process | Three-column grid | Single column |
| CTA | Centered with gradient BG | Same, scaled |
| Footer | Centered text with border-t | Same |

Responsive Typography: text-3xl md:text-5xl lg:text-7xl

---

## **📦 FEATURE MODULES (Prioritized)**

### **Tier 1: Core Platform (MVP)**

| Module | Purpose | Key Entities |
| ----- | ----- | ----- |
| Auth/Users | Role-based access control | User, Role, Permissions |
| Guests/CRM | Guest profiles, preferences, history | Guest, Preference, VisitHistory |
| Reservations | Smart booking with waitlist | Reservation, Table, TimeSlot |
| POS | Touch-friendly order entry | Order, OrderItem, Transaction |
| Menu | Items, modifiers, recipes | MenuItem, Modifier, Recipe |
| Inventory | Stock tracking with auto-deduction | Ingredient, StockLevel, Supplier |
| AI Phone Agent | Voice AI for calls | CallLog, KnowledgeBase, Transcript |

### **Tier 2: Operations**

| Module | Purpose |
| ----- | ----- |
| Staff/Scheduling | Shifts, time logs, role assignment |
| Kitchen Display (KDS) | Real-time order feed for BOH |
| Events/Catering | Leads, proposals, contracts, deposits |
| Floor Plan | Drag-and-drop table layout |

### **Tier 3: Intelligence (Differentiation)**

| Module | Value Proposition |
| ----- | ----- |
| Dynamic Pricing Engine | Saturday 7pm costs more than Tuesday 5pm. Auto early-bird discounts. \+10-15% revenue potential. |
| Food Cost Intelligence | Real-time COGS tracking. Commodity price API integration. Alert when chicken spikes 20%. Suggest menu pivots. |
| Employee Retention Analytics | Predict flight risk. Track satisfaction signals. Benchmark pay. Reduce $3-5k per turnover. |
| Review/Sentiment Engine | Pull Google/Yelp reviews. Analyze sentiment. Draft responses. Identify trends. |
| Social Media Automation | Auto-post specials. Aggregate UGC. Identify micro-influencers. Schedule by engagement. |
| Health & Safety Compliance | HACCP checklists. Temp logging (smart thermometer integration). Inspection prep. Allergen tracking. |

### **Tier 4: Platform Play (Long-Term Moat)**

| Module | Revenue Model |
| ----- | ----- |
| Embedded Finance | Cash flow forecasting. Working capital loans (à la Toast Capital). Instant payout. |
| Training System | Video modules. Quizzes. Certification. New hire checklists. Role-play scenarios. |
| Vendor Marketplace | Two-sided network. Connect restaurants with suppliers. Take 2-3% transaction fee. Network effects \= moat. |

---

## **🗄️ DATABASE SCHEMA REQUIREMENTS**

Design a relational PostgreSQL schema with strict foreign key enforcement.

### **Required Entity Groups:**

Authentication & Authorization:

text

\- users (id, email, password\_hash, role\_id, restaurant\_id, created\_at)  
\- roles (id, name, permissions JSONB)

\- restaurants (id, name, address, phone, timezone, settings JSONB)

Guest Management:

text

\- guests (id, first\_name, last\_name, email, phone, vip\_status, total\_spend, loyalty\_points, notes, created\_at)  
\- guest\_preferences (id, guest\_id, preference\_type, preference\_value) \-- e.g., dietary, seating

\- guest\_visits (id, guest\_id, reservation\_id, visit\_date, spend\_amount)

Reservations:

text

\- tables (id, restaurant\_id, name, capacity, floor\_plan\_x, floor\_plan\_y, status)  
\- reservations (id, guest\_id, table\_id, party\_size, date, time\_slot, status, notes, source, created\_by, created\_at)  
  \-- status: ENUM('pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no\_show')  
  \-- source: ENUM('phone', 'web', 'ai\_agent', 'walk\_in', 'third\_party')

\- waitlist (id, guest\_id, party\_size, requested\_date, requested\_time, status, notified\_at)

Menu & Recipes:

text

\- menu\_categories (id, restaurant\_id, name, display\_order)  
\- menu\_items (id, category\_id, name, description, price, image\_url, is\_available, tags JSONB)  
\- modifiers (id, name, price\_adjustment, is\_required)  
\- menu\_item\_modifiers (menu\_item\_id, modifier\_id) \-- junction  
\- recipes (id, menu\_item\_id)

\- recipe\_ingredients (id, recipe\_id, ingredient\_id, quantity, unit)

Inventory:

text

\- ingredients (id, restaurant\_id, name, unit, current\_stock, reorder\_threshold, unit\_cost)  
\- suppliers (id, name, contact\_email, contact\_phone)  
\- ingredient\_suppliers (ingredient\_id, supplier\_id, price, lead\_time\_days)  
\- stock\_transactions (id, ingredient\_id, quantity\_change, reason, created\_at, created\_by)

  \-- reason: ENUM('purchase', 'sale\_deduction', 'waste', 'adjustment', 'transfer')

POS & Orders:

text

\- orders (id, table\_id, guest\_id, server\_id, status, order\_type, total, tax, tip, created\_at, closed\_at)  
  \-- status: ENUM('open', 'sent\_to\_kitchen', 'preparing', 'ready', 'served', 'paid', 'void')  
  \-- order\_type: ENUM('dine\_in', 'takeout', 'delivery')  
\- order\_items (id, order\_id, menu\_item\_id, quantity, unit\_price, modifiers JSONB, notes, status)

\- transactions (id, order\_id, payment\_method, amount, stripe\_payment\_id, status, created\_at)

Staff & Scheduling:

text

\- staff (id, user\_id, restaurant\_id, first\_name, last\_name, role, hourly\_rate, hire\_date, status)  
\- shifts (id, staff\_id, date, start\_time, end\_time, role)

\- time\_logs (id, staff\_id, clock\_in, clock\_out, break\_minutes, tips\_declared)

Events & Catering:

text

\- event\_leads (id, restaurant\_id, contact\_name, contact\_email, contact\_phone, event\_type, event\_date, guest\_count, budget, status, notes, created\_at)  
\- event\_proposals (id, lead\_id, proposal\_pdf\_url, total\_amount, valid\_until, status)

\- event\_contracts (id, proposal\_id, docusign\_envelope\_id, signed\_at, deposit\_amount, deposit\_paid)

AI Agent:

text

\- call\_logs (id, restaurant\_id, phone\_number, direction, duration, transcript, outcome, reservation\_id, created\_at)  
  \-- outcome: ENUM('reservation\_booked', 'faq\_answered', 'transferred\_to\_staff', 'voicemail', 'abandoned')

\- knowledge\_base (id, restaurant\_id, category, question, answer, embedding VECTOR)

### **Schema Design Principles:**

* Use UUIDs for public-facing IDs, SERIAL for internal  
* All tables have created\_at, key ones have updated\_at  
* Soft deletes via deleted\_at where appropriate  
* JSONB for flexible data (settings, modifiers, tags)  
* Proper indexing on frequently queried columns  
* Consider partitioning for high-volume tables (orders, call\_logs)

---

## **🧠 MODULE LOGIC REQUIREMENTS**

Provide pseudocode/API logic for these workflows:

### **1\. Smart Reservation Flow**

text

INPUT: guest\_info, party\_size, requested\_date, requested\_time, source

FLOW:  
1\. Check availability (query tables where capacity \>= party\_size, not reserved for time\_slot)  
2\. IF available:  
   a. Create/find guest record  
   b. Create reservation (status: 'confirmed')  
   c. Trigger Twilio SMS confirmation  
   d. Trigger SendGrid email confirmation  
   e. Sync to Google Calendar (OAuth)  
   f. Return success \+ reservation details  
3\. IF not available:  
   a. Add to waitlist  
   b. Return waitlist position \+ estimated wait  
   c. Set up cron/trigger to notify if slot opens

EDGE CASES:  
\- Guest already has reservation that day → warn/allow  
\- VIP guest → prioritize or hold specific tables  
\- Large party → might need table combinations

### **2\. Connected POS Sale**

text

INPUT: order with line items

FLOW:  
1\. For each order\_item:  
   a. Lookup menu\_item → get recipe  
   b. For each recipe\_ingredient:  
      i. Deduct quantity from ingredients.current\_stock  
      ii. Create stock\_transaction record  
      iii. IF new current\_stock \< reorder\_threshold:  
          \- Create alert for manager  
          \- Queue low-stock notification  
          \- (Optional) Auto-create purchase order draft  
2\. Calculate order total with modifiers  
3\. Process payment via Stripe  
4\. Mark order as 'paid'  
5\. Emit socket event to KDS for prep items  
6\. Update guest.total\_spend if guest attached

SAFETY:  
\- Wrap in transaction → rollback if payment fails  
\- Handle partial payments (split checks)  
\- Handle voids/refunds (reverse stock transactions)

### **3\. AI Phone Agent Pipeline**

text

ARCHITECTURE: Twilio Voice Webhook → Node Handler → Gemini \+ RAG → Response

COMPONENTS:  
1\. Knowledge Base Builder:  
   \- Ingest menu items, allergens, hours, policies  
   \- Chunk and embed using text-embedding model  
   \- Store in PostgreSQL with pgvector

2\. Real-Time Retrieval:  
   \- Transcribe caller speech (Twilio transcription or Whisper)  
   \- Embed query  
   \- Vector search knowledge\_base for top-k relevant chunks  
   \- Inject into Gemini prompt as context

3\. External Knowledge (Optional):  
   \- SerpApi for local events ("What's happening downtown tonight?")  
   \- Integrate cached responses for common queries

4\. Action Detection:  
   \- If intent \= "book reservation" → extract details → call reservation API  
   \- If intent \= "speak to human" → transfer call  
   \- If intent \= "question" → answer from RAG

5\. Logging:  
   \- Store full transcript in call\_logs  
   \- Track outcome for analytics  
   \- Link to reservation if created

---

## **🖥️ FRONTEND COMPONENT STRUCTURE**

### **Core Components Required:**

Layout:

* AppShell — sidebar nav, top bar, main content area  
* MobileNav — hamburger menu for mobile  
* RoleSwitcher — for testing different permission levels

Reservations:

* ReservationCalendar — day/week view with slots  
* ReservationModal — create/edit form  
* WaitlistPanel — current waitlist with actions  
* GuestSearch — autocomplete for existing guests

Floor Plan:

* FloorPlanCanvas — SVG/Canvas based drag-and-drop  
* TableNode — individual table with status color coding  
* TableAssignment — modal to assign reservation to table

POS:

* POSTerminal — main touch interface  
* MenuGrid — category tabs \+ item tiles  
* OrderCart — current order with running total  
* ModifierModal — select modifiers for item  
* PaymentFlow — Stripe integration, split checks, tips

Kitchen Display (KDS):

* KDSBoard — columns by station or priority  
* OrderTicket — individual order card with items  
* TicketTimer — visual countdown, color changes as aging  
* Real-time via WebSocket (Socket.io)

Inventory:

* StockDashboard — at-a-glance levels, alerts  
* IngredientTable — sortable, filterable list  
* StockAdjustmentModal — manual adjustments with reason

Staff:

* ScheduleGrid — week view by staff member  
* ShiftBuilder — drag to create shifts  
* TimeClockWidget — staff clock in/out

---

## **🔌 INTEGRATIONS MAP**

| Service | Purpose | Auth Method | Key Actions |
| ----- | ----- | ----- | ----- |
| Stripe Connect | Payments | OAuth | Charge, refund, split payments, deposits |
| Twilio Voice | AI Phone Agent | API Key | Inbound calls, transcription, transfer |
| Twilio SMS | Notifications | API Key | Reservation confirmations, waitlist alerts |
| SendGrid | Email | API Key | Confirmations, marketing, receipts |
| Google Calendar | Sync | OAuth2 | Push reservations, pull conflicts |
| Outlook Calendar | Sync | OAuth2 | Same as Google |
| DocuSign | Contracts | OAuth2 | Send, track, store signed event contracts |
| Google Places API | Reviews | API Key | Pull reviews for sentiment analysis |
| Yelp Fusion API | Reviews | API Key | Pull reviews for sentiment analysis |
| SerpApi | Local Knowledge | API Key | What's happening nearby (for AI agent) |
| OpenAI/Gemini | AI | API Key | Embeddings, completions, voice AI |

---

## **📁 EXPECTED OUTPUT (Phased)**

### **Phase 1: Architecture (This Response)**

Provide:

1. Complete SQL Schema  
   * All CREATE TABLE statements  
   * Indexes, constraints, enums  
   * Comments explaining relationships  
2. Project Directory Structure  
   * Full tree for monorepo  
   * Clear separation: /apps, /packages, /services  
   * Explain the purpose of each directory  
3. package.json Dependencies  
   * Root package.json  
   * Key dependencies per workspace  
   * Dev dependencies (ESLint, Prettier, testing)  
4. Environment Variables Template  
   * .env.example with all required vars

---

### **Phase 2+ (Subsequent Responses)**

After I confirm Phase 1, we'll build module-by-module:

* Auth system  
* Guest/CRM module  
* Reservations module  
* POS module  
* Inventory module  
* AI Phone Agent  
* etc.

Each module request will specify:

* Which files to generate  
* Which tests to include  
* Integration points with other modules

---

## **✋ BEFORE YOU BEGIN**

1. Do not write the entire codebase. Start as the Architect.  
2. Ask clarifying questions if any requirement is ambiguous.  
3. State assumptions you're making.  
4. Explain your decisions — I want to understand the "why."

When ready, provide:

* SQL Schema  
* Directory Structure  
* Dependencies  
* Await my go-ahead for code generation

---

*Let's build something restaurants actually want to use.*  
