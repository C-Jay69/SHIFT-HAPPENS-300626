/*
 * SHIFT HAPPENS! — end-to-end smoke test.
 *
 * Usage:
 *   node smoke-test.mjs
 *
 * Env (defaults match docker-compose):
 *   SH_BASE_URL   API/SPA base URL            (default http://127.0.0.1:4000)
 *   DATABASE_URL  direct DB connection string (default postgresql://shift:shift-happens@127.0.0.1:5432/shifthappens)
 *   ADMIN_EMAIL / ADMIN_PASSWORD  seeded admin (defaults match seed.ts)
 *
 * WARNING: resets the schema and reseeds the demo dataset first.
 */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(path.join(REPO, 'package.json'));
const { Pool } = require('pg');

const BASE = process.env.SH_BASE_URL ?? 'http://127.0.0.1:4000';
const db = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://shift:shift-happens@127.0.0.1:5432/shifthappens',
});
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@shifthappens.test';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'ChangeMe123!';

// Deterministic starting state: reset schema + reseed (running server is fine —
// node-pg uses no prepared statements and the pool survives the schema drop).
// Invoked via tsx directly: nested `npm run` chains drop extra CLI args, so
// `npm run migrate -- --reset` would not forward the --reset flag.
console.log('\n[0] Reset + reseed (deterministic state)');
execSync('npx tsx src/migrate.ts --reset', { cwd: REPO + '/server', stdio: 'inherit' });
execSync('npx tsx src/seed.ts', { cwd: REPO + '/server', stdio: 'inherit' });

let passed = 0, failed = 0;
const fail = (name, detail) => { failed++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); };
const ok = (name) => { passed++; console.log(`  ✓ ${name}`); };
const check = (name, cond, detail) => (cond ? ok(name) : fail(name, detail));

async function req(method, path, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) { headers['Content-Type'] = 'application/x-www-form-urlencoded'; payload = new URLSearchParams(form).toString(); }
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(BASE + path, { method, headers, body: payload });
  let data = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('json')) data = await res.json().catch(() => null);
  else data = await res.text().catch(() => null);
  return { status: res.status, data };
}

const today = new Date().toISOString().slice(0, 10);

console.log('\n[1] Health + SPA');
check('GET /health', (await req('GET', '/health')).status === 200);
check('GET /api/health', (await req('GET', '/api/health')).status === 200);
const spa = await fetch(BASE + '/');
const spaHtml = await spa.text();
check('GET / serves SPA index.html', spa.ok && spaHtml.includes('<div id="root">'), spa.status + '');
check('SPA references built assets', /assets\/index-/.test(spaHtml));
const pwa = await fetch(BASE + '/manifest.webmanifest');
check('PWA manifest served', pwa.ok);
const sw = await fetch(BASE + '/sw.js');
check('PWA service worker served', sw.ok);

console.log('\n[2] Auth');
const login = await req('POST', '/api/v1/auth/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
check('admin login → 201/200 + token', (login.status === 200 || login.status === 201) && !!login.data?.token, JSON.stringify(login.data).slice(0, 120));
const admin = login.data.token;
const me = await req('GET', '/api/v1/auth/me', { token: admin });
check('GET /auth/me (owner)', me.status === 200 && me.data?.role === 'owner', JSON.stringify(me.data).slice(0, 120));
check('unauthenticated → 401', (await req('GET', '/api/v1/guests')).status === 401);

// register a server-role user for RBAC checks
const roleIds = await db.query(`SELECT name, id FROM roles WHERE name IN ('server','owner')`);
const serverRole = roleIds.rows.find(r => r.name === 'server').id;
const rest = (await db.query('SELECT id FROM restaurants LIMIT 1')).rows[0].id;
const reg = await req('POST', '/api/v1/auth/register', { body: { email: 'server1@shifthappens.test', password: 'ServerPass123!', roleId: serverRole, restaurantId: rest } });
check('register server-role user', (reg.status === 200 || reg.status === 201) && !!reg.data?.token, JSON.stringify(reg.data).slice(0, 120));
const serverTok = reg.data.token;
const rbac = await req('POST', '/api/v1/staff/shifts', { token: serverTok, body: { staffId: '00000000-0000-0000-0000-000000000000', date: today, startTime: '10:00', endTime: '18:00' } });
check('RBAC: server cannot create shifts → 403', rbac.status === 403, 'got ' + rbac.status);

console.log('\n[3] Read models');
const items = await req('GET', '/api/v1/menu/items', { token: admin });
check('menu items (4 seeded, with recipes)', items.status === 200 && items.data.length === 4 && items.data[0].recipe.length > 0, JSON.stringify(items.data?.[0]?.recipe));
const smash = items.data.find(i => i.name === 'Classic Smash');
const mule = items.data.find(i => i.name === 'Moscow Mule');
const salad = items.data.find(i => i.name === 'House Salad');
const ings = await req('GET', '/api/v1/inventory/ingredients', { token: admin });
check('ingredients (7 seeded)', ings.status === 200 && ings.data.length === 7, 'got ' + ings.data?.length);
const cheddar = ings.data.find(i => i.name === 'Cheddar Cheese');
const lettuce = ings.data.find(i => i.name === 'Lettuce');
const tables = await req('GET', '/api/v1/tables', { token: admin });
check('tables (7 seeded)', tables.status === 200 && tables.data.length === 7, 'got ' + tables.data?.length);
const table1 = tables.data.find(t => t.name === 'Table 1');
const reseeds = await req('GET', '/api/v1/reservations', { token: admin });
check('reservations (3 seeded)', reseeds.status === 200 && reseeds.data.length === 3, 'got ' + reseeds.data?.length);

console.log('\n[4] Connected POS sale (inventory deduction + alerts)');
// drop cheddar to just above threshold so one smash burger triggers the low-stock alert
const adj = await req('POST', '/api/v1/inventory/adjustments', { token: admin, body: { ingredientId: cheddar.id, quantityChange: -81, reason: 'waste' } });
check('stock adjustment (waste) → newStock 19', adj.status === 201 && Number(adj.data.newStock) === 19, JSON.stringify(adj.data));
const orderRes = await req('POST', '/api/v1/orders', { token: admin, body: { tableId: table1.id, orderType: 'dine_in', items: [{ menuItemId: smash.id, quantity: 2 }, { menuItemId: mule.id, quantity: 1 }] } });
check('create order → 201, total 40.00 + tax 3.40', orderRes.status === 201 && Number(orderRes.data.order.total) === 40 && Math.abs(Number(orderRes.data.order.tax) - 3.4) < 0.001, JSON.stringify(orderRes.data?.order).slice(0, 200));
const orderId = orderRes.data.order.id;
const ingsAfter = await req('GET', '/api/v1/inventory/ingredients', { token: admin });
const beef = ingsAfter.data.find(i => i.name === 'Beef Patty');
const cheAfter = ingsAfter.data.find(i => i.name === 'Cheddar Cheese');
const vodka = ingsAfter.data.find(i => i.name === 'Vodka');
check('stock deducted: Beef 50→48', Number(beef.current_stock) === 48, 'got ' + beef.current_stock);
check('stock deducted: Cheddar 19→15 (below threshold 20)', Number(cheAfter.current_stock) === 15 && cheAfter.is_low === true, 'got ' + cheAfter.current_stock);
check('stock deducted: Vodka 10→9.95', Math.abs(Number(vodka.current_stock) - 9.95) < 0.001, 'got ' + vodka.current_stock);
const alerts = await req('GET', '/api/v1/inventory/alerts', { token: admin });
check('low-stock alert fired for Cheddar', alerts.status === 200 && alerts.data.some(a => a.ingredient_name === 'Cheddar Cheese'), JSON.stringify(alerts.data));
const txRows = await db.query(`SELECT count(*)::int n FROM stock_transactions WHERE reason='sale_deduction'`);
check('stock_transactions rows written (sale_deduction)', txRows.rows[0].n >= 3, 'got ' + txRows.rows[0].n);
const tableAfterOrder = (await req('GET', '/api/v1/tables', { token: admin })).data.find(t => t.id === table1.id);
check('table marked occupied', tableAfterOrder.status === 'occupied', tableAfterOrder.status);

console.log('\n[5] KDS status updates (the orders.updated_at fix)');
const s1 = await req('PATCH', `/api/v1/orders/${orderId}/status`, { token: admin, body: { status: 'preparing' } });
check('PATCH status → preparing (was 500 before fix)', s1.status === 200 && s1.data.status === 'preparing', 'got ' + s1.status + ' ' + JSON.stringify(s1.data).slice(0, 100));
const s2 = await req('PATCH', `/api/v1/orders/${orderId}/status`, { token: admin, body: { status: 'ready' } });
check('PATCH status → ready', s2.status === 200 && s2.data.status === 'ready', 'got ' + s2.status);

console.log('\n[6] Payment (cash) → paid, guest spend, table freed');
const guestRes = await req('POST', '/api/v1/guests', { token: admin, body: { firstName: 'Smoke', lastName: 'Tester', phone: '+15550001111', email: 'smoke@test.dev', vipStatus: false } });
check('create guest', guestRes.status === 201 && !!guestRes.data.id, JSON.stringify(guestRes.data).slice(0, 100));
const guestId = guestRes.data.id;
// attach guest via order? orders were created without guest; use a fresh order for the guest-spend check
const order2 = await req('POST', '/api/v1/orders', { token: admin, body: { tableId: table1.id, guestId, orderType: 'dine_in', items: [{ menuItemId: mule.id, quantity: 1 }] } });
const o2 = order2.data.order.id;
const pay = await req('POST', `/api/v1/orders/${o2}/pay`, { token: admin, body: { method: 'cash' } });
check('cash pay → 201 + transaction', pay.status === 201 && !!pay.data.transaction?.id, JSON.stringify(pay.data).slice(0, 150));
const order2Row = await db.query(`SELECT status, total FROM orders WHERE id=$1`, [o2]);
check('order marked paid', order2Row.rows[0].status === 'paid', order2Row.rows[0].status);
const guestRow = await db.query(`SELECT total_spend FROM guests WHERE id=$1`, [guestId]);
check('guest.total_spend bumped (12.00 + 1.02 tax)', Math.abs(Number(guestRow.rows[0].total_spend) - 13.02) < 0.001, 'got ' + guestRow.rows[0].total_spend);
const tableAfterPay = (await req('GET', '/api/v1/tables', { token: admin })).data.find(t => t.id === table1.id);
check('table freed (occupied → dirty)', tableAfterPay.status === 'dirty', tableAfterPay.status);

console.log('\n[7] Void flow → stock restored');
const order3 = await req('POST', '/api/v1/orders', { token: admin, body: { orderType: 'takeout', items: [{ menuItemId: salad.id, quantity: 2 }] } });
const o3 = order3.data.order.id;
const letAfterVoid1 = (await req('GET', '/api/v1/inventory/ingredients', { token: admin })).data.find(i => i.name === 'Lettuce');
check('salad order deducted lettuce 20→19.5', Math.abs(Number(letAfterVoid1.current_stock) - 19.5) < 0.001, 'got ' + letAfterVoid1.current_stock);
const voided = await req('POST', `/api/v1/orders/${o3}/void`, { token: admin, body: { reason: 'smoke test' } });
check('void order → 201', voided.status === 201, 'got ' + voided.status);
const letAfterVoid2 = (await req('GET', '/api/v1/inventory/ingredients', { token: admin })).data.find(i => i.name === 'Lettuce');
check('stock restored on void (19.5→20)', Math.abs(Number(letAfterVoid2.current_stock) - 20) < 0.001, 'got ' + letAfterVoid2.current_stock);

console.log('\n[8] Smart reservation flow (book + waitlist)');
const book1 = await req('POST', '/api/v1/reservations', { token: admin, body: { firstName: 'Res', lastName: 'A', phone: '+15552220001', partySize: 2, date: today, timeSlot: '12:30', source: 'web' } });
check('book party of 2 @12:30 → 201 confirmed', book1.status === 201 && !!book1.data.reservation, 'got ' + book1.status);
check('reservation linked to a table', !!book1.data.reservation?.table_id, JSON.stringify(book1.data.reservation).slice(0, 120));
check('no calendarConflict field when calendar not connected', !('calendarConflict' in book1.data), JSON.stringify(Object.keys(book1.data)));
const bookFull = await req('POST', '/api/v1/reservations', { token: admin, body: { firstName: 'Big', lastName: 'Party', phone: '+15552220002', partySize: 12, date: today, timeSlot: '12:30', source: 'web' } });
check('party of 12 → 202 waitlisted (no table big enough)', bookFull.status === 202 && !!bookFull.data.waitlistPosition, 'got ' + bookFull.status + ' ' + JSON.stringify(bookFull.data));
const wl = await req('GET', '/api/v1/reservations/waitlist', { token: admin });
check('waitlist shows 1 waiting entry', wl.status === 200 && wl.data.some(w => w.party_size === 12 && w.status === 'waiting'), JSON.stringify(wl.data));
// cancel the confirmed booking → table released
const cancel = await req('PATCH', `/api/v1/reservations/${book1.data.reservation.id}`, { token: admin, body: { status: 'cancelled' } });
const bookedTableId = book1.data.reservation.table_id;
const tAfterCancel = (await req('GET', '/api/v1/tables', { token: admin })).data.find(t => t.id === bookedTableId);
check('cancel releases reserved table', cancel.status === 200 && tAfterCancel.status === 'available', 'table=' + tAfterCancel.status);

console.log('\n[9] AI phone agent (Twilio Voice webhook)');
const vEntry = await req('POST', '/api/v1/voice', { form: { CallSid: 'SMOKESID1', From: '+15550009999' } });
check('voice entry → TwiML with Gather', vEntry.status === 200 && typeof vEntry.data === 'string' && vEntry.data.includes('<Gather'), String(vEntry.data).slice(0, 100));
const vTurn1 = await req('POST', '/api/v1/voice/turn', { form: { CallSid: 'SMOKESID1', From: '+15550009999', SpeechResult: 'I would like to book a table' } });
check('turn 1 (book intent) → asks party size', vTurn1.status === 200 && /How many people/.test(String(vTurn1.data)), String(vTurn1.data).slice(0, 120));
const vTurn2 = await req('POST', '/api/v1/voice/turn', { form: { CallSid: 'SMOKESID1', From: '+15550009999', SpeechResult: '2' } });
check('turn 2 ("2") → asks time', vTurn2.status === 200 && /What time/.test(String(vTurn2.data)), String(vTurn2.data).slice(0, 120));
const vTurn3 = await req('POST', '/api/v1/voice/turn', { form: { CallSid: 'SMOKESID1', From: '+15550009999', SpeechResult: '5 pm' } });
check('turn 3 ("5 pm") → books the reservation', vTurn3.status === 200 && /booked|waitlist/i.test(String(vTurn3.data)), String(vTurn3.data).slice(0, 150));
const callRows = await db.query(`SELECT outcome, transcript FROM call_logs WHERE twilio_call_sid='SMOKESID1'`);
check('call_log written with transcript', callRows.rows.length === 1 && (callRows.rows[0].transcript ?? '').includes('Caller:'), JSON.stringify(callRows.rows[0] ?? {}).slice(0, 120));
const voiceCalls = await req('GET', '/api/v1/voice/calls', { token: admin });
check('GET /voice/calls lists the call', voiceCalls.status === 200 && voiceCalls.data.length >= 1, 'got ' + voiceCalls.data?.length);

console.log('\n[10] ShiftBot + Knowledge base (RAG, keyword fallback)');
const kbIngest = await req('POST', '/api/v1/knowledge-base/ingest-menu', { token: admin });
check('ingest-menu → 5+ entries (4 items + hours)', kbIngest.status === 201 && kbIngest.data.ingested >= 5, JSON.stringify(kbIngest.data));
const kbAdd = await req('POST', '/api/v1/knowledge-base', { token: admin, body: { category: 'policies', question: 'Do you take walk-ins?', answer: 'Yes, we always welcome walk-ins.' } });
check('ingest custom policy entry', kbAdd.status === 201 && !!kbAdd.data.id, JSON.stringify(kbAdd.data));
const kbSearch = await req('POST', '/api/v1/knowledge-base/search', { token: admin, body: { query: 'walk' } });
check('RAG keyword search finds walk-in policy', kbSearch.status === 200 && kbSearch.data.some(r => /walk/i.test(r.answer)), JSON.stringify(kbSearch.data).slice(0, 150));
const kbSearchMenu = await req('POST', '/api/v1/knowledge-base/search', { token: admin, body: { query: 'burger' } });
check('RAG keyword search finds menu item', kbSearchMenu.status === 200 && kbSearchMenu.data.some(r => /burger/i.test(r.answer)), JSON.stringify(kbSearchMenu.data).slice(0, 150));
const aiStatus = await req('GET', '/api/v1/ai/status');
check('ai/status reports unconfigured (no key)', aiStatus.status === 200 && aiStatus.data.configured === false);
const aiChat = await req('POST', '/api/v1/ai/chat', { token: admin, body: { message: 'hello' } });
check('ai/chat degrades gracefully → 503 (no LLM key)', aiChat.status === 503, 'got ' + aiChat.status);

console.log('\n[11] Staff & scheduling');
const staff = await req('GET', '/api/v1/staff', { token: admin });
check('staff roster (4 seeded)', staff.status === 200 && staff.data.length === 4, 'got ' + staff.data?.length);
const shifts = await req('GET', '/api/v1/staff/shifts', { token: admin });
check('shifts seeded (28 = 4 staff × 7 days)', shifts.status === 200 && shifts.data.length === 28, 'got ' + shifts.data?.length);
const staffId = staff.data[0].id;
const ci = await req('POST', '/api/v1/staff/clock-in', { token: admin, body: { staffId, tipsDeclared: 0 } });
check('clock-in → 201', ci.status === 201, 'got ' + ci.status);
const ci2 = await req('POST', '/api/v1/staff/clock-in', { token: admin, body: { staffId } });
check('double clock-in → 409', ci2.status === 409, 'got ' + ci2.status);
const co = await req('POST', '/api/v1/staff/clock-out', { token: admin, body: { staffId, tipsDeclared: 15 } });
check('clock-out → 200 with tips', co.status === 200 && Number(co.data.tips_declared) === 15, JSON.stringify(co.data).slice(0, 100));

console.log('\n[12] Events & catering');
const leads = await req('GET', '/api/v1/events/leads', { token: admin });
check('event leads (2 seeded)', leads.status === 200 && leads.data.length === 2, 'got ' + leads.data?.length);
const leadId = leads.data[0].id;
const prop = await req('POST', '/api/v1/events/proposals', { token: admin, body: { leadId, totalAmount: 1200, validUntil: '2026-10-01' } });
check('create proposal → 201', prop.status === 201 && !!prop.data.id, JSON.stringify(prop.data).slice(0, 100));
const accept = await req('POST', `/api/v1/events/proposals/${prop.data.id}/accept`, { token: admin, body: {} });
check('accept proposal → contract chain', accept.status === 201 || accept.status === 200, 'got ' + accept.status + ' ' + JSON.stringify(accept.data).slice(0, 120));
const contracts = await req('GET', '/api/v1/events/contracts', { token: admin });
check('contracts listed', contracts.status === 200 && contracts.data.length >= 1, 'got ' + contracts.data?.length);
const firstContract = contracts.data[0];
check('contract row exposes DocuSign fields (null when unconfigured)',
  firstContract && 'docusign_envelope_id' in firstContract && 'docusign_status' in firstContract
  && firstContract.docusign_status === null && firstContract.docusign_envelope_id === null,
  JSON.stringify(firstContract).slice(0, 160));
check('deposit = 20% of total', Math.abs(Number(firstContract.deposit_amount) - 0.2 * Number(firstContract.total_amount)) < 0.001,
  'deposit=' + firstContract?.deposit_amount + ' total=' + firstContract?.total_amount);
const depositPaid = await req('POST', `/api/v1/events/contracts/${firstContract.id}/deposit-paid`, { token: admin, body: {} });
check('mark deposit paid → deposit_paid true', depositPaid.status === 200 && depositPaid.data.deposit_paid === true, JSON.stringify(depositPaid.data).slice(0, 120));

console.log('\n[13] Integrations + realtime socket');
const integ = await req('GET', '/api/v1/integrations', { token: admin });
const keys = Object.fromEntries((integ.data ?? []).map(i => [i.key, i.configured]));
check('integrations status: all key-gated services off',
  integ.status === 200 && keys.stripe === false && keys.twilio_voice === false && keys.sendgrid === false
  && keys.llm === false && keys.google_calendar === false && keys.docusign === false && keys.yelp === false,
  JSON.stringify(keys));

// --- Google Calendar (unconfigured path) ---
const gcalStatus = await req('GET', '/api/v1/integrations/google-calendar', { token: admin });
check('google-calendar status → {configured:false, connected:false}', gcalStatus.status === 200 && gcalStatus.data.configured === false && gcalStatus.data.connected === false, JSON.stringify(gcalStatus.data));
const gcalAuth = await req('GET', '/api/v1/integrations/google-calendar/authorize', { token: admin });
check('google-calendar authorize (unconfigured) → 503', gcalAuth.status === 503, 'got ' + gcalAuth.status);
const gcalDisconnect = await req('POST', '/api/v1/integrations/google-calendar/disconnect', { token: admin, body: {} });
check('google-calendar disconnect (no-op) → 200', gcalDisconnect.status === 200 && gcalDisconnect.data.disconnected === true, JSON.stringify(gcalDisconnect.data));

// --- DocuSign (unconfigured path) ---
const dsignSend = await req('POST', `/api/v1/events/contracts/${firstContract.id}/send-docusign`, { token: admin, body: {} });
check('send-docusign (unconfigured) → 503', dsignSend.status === 503, 'got ' + dsignSend.status);
const dsignRefresh = await req('POST', `/api/v1/events/contracts/${firstContract.id}/refresh-docusign`, { token: admin, body: {} });
check('refresh-docusign (unconfigured) → 503', dsignRefresh.status === 503, 'got ' + dsignRefresh.status);

// --- Yelp (unconfigured path) ---
const yelpReviews = await req('GET', '/api/v1/integrations/yelp/reviews', { token: admin });
check('yelp reviews (unconfigured) → 503', yelpReviews.status === 503, 'got ' + yelpReviews.status);

const socketPing = await fetch(BASE + '/socket.io/?EIO=4&transport=polling');
check('socket.io endpoint reachable', socketPing.status === 200);

console.log('\n[14] Waitlist cron (auto-seat when a slot opens)');
// Deterministic state entering this section: Table 1 is 'dirty' (paid order),
// Table 3 is 'reserved' (voice booking @17:00), Table 2 'occupied', Booth A
// 'reserved', Booth B 'dirty' — the only 'available' tables are the two bar
// seats (capacity 1). Book both, then a third party of 1 MUST waitlist.
const block1 = async (first, phone, tableId) =>
  req('POST', '/api/v1/reservations', { token: admin, body: { firstName: first, lastName: 'B', phone, partySize: 1, date: today, timeSlot: '14:00', source: 'web', tableId } });
const wlA = await block1('Cron', '+15552220003', undefined);   // → one bar seat
check('bar seat 1 booked @14:00', wlA.status === 201, 'got ' + wlA.status);
const barTables = (await req('GET', '/api/v1/tables', { token: admin })).data.filter(t => t.capacity === 1);
const otherBar = barTables.find(t => t.id !== wlA.data.reservation.table_id);
const wlB = otherBar ? await block1('Block', '+15552220004', otherBar.id) : null;
check('bar seat 2 booked @14:00', wlB?.status === 201, 'got ' + wlB?.status);
const wait1 = await block1('CronWait', '+15552220005', undefined);
check('third party of 1 waitlisted (no available tables)', wait1.status === 202, 'got ' + wait1.status);
// release one seat → cron should auto-seat the waiter
await req('PATCH', `/api/v1/reservations/${wlA.data.reservation.id}`, { token: admin, body: { status: 'cancelled' } });
let seated = false;
for (let i = 0; i < 30 && !seated; i++) {
  await new Promise(r => setTimeout(r, 2000));
  const w = await req('GET', '/api/v1/reservations/waitlist', { token: admin });
  seated = !w.data.some(x => (x.guest_phone ?? '').endsWith('0005') && x.status === 'waiting');
}
check('waitlist cron auto-seated the freed slot within ~60s', seated, 'still waiting');
const dup = await db.query(`SELECT count(*)::int n FROM waitlist WHERE party_size = 12`);
check('cron did NOT duplicate the party-of-12 waitlist entry', dup.rows[0].n === 1, 'got ' + dup.rows[0].n);

await db.end();
console.log(`\n================ RESULT: ${passed} passed, ${failed} failed ================`);
process.exit(failed ? 1 : 0);
