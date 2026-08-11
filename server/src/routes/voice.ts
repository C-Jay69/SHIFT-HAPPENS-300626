import { Router } from 'express';
import express from 'express';
import { pool } from '../db.js';
import { smartReservation } from '../lib/reservation.js';
import { openrouterChat } from '../lib/openrouter.js';
import { searchKnowledgeBase } from '../lib/knowledgeBase.js';

/**
 * AI Phone Agent — Twilio Voice webhook.
 *
 * Architecture (from build prompt):
 *   Twilio Voice Webhook → Node Handler → OpenRouter + RAG → Response
 *
 * Flow:
 *   POST /api/v1/voice          greeting + first <Gather>
 *   POST /api/v1/voice/turn     per-utterance: book / transfer / FAQ
 *
 * Twilio posts form-encoded callbacks carrying `SpeechResult`, `CallSid`,
 * `From`/`To`, `CallStatus`. TwiML is built by hand (no extra dependency).
 */

const STAFF_TRANSFER_NUMBER = process.env.STAFF_TRANSFER_NUMBER ?? '';
const RESTAURANT_ID = process.env.VOICE_RESTAURANT_ID ?? null; // fallback: first restaurant
const VOICE_TIMEZONE_OFFSET_MS = Number(process.env.VOICE_TIMEZONE_OFFSET_HOURS ?? 0) * 3_600_000;

// Per-call booking state (single-instance cache; move to Redis/DB when scaling).
const callState = new Map<string, { phase: string; partySize?: number; timeSlot?: string; date?: string }>();

const esc = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const xml = (body: string) => `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`;
const say = (text: string) => `<Say>${esc(text)}</Say>`;
const gather = (inner: string, action = '/api/v1/voice/turn') =>
  `<Gather input="speech" timeout="4" speechTimeout="auto" action="${action}" method="POST">${inner}</Gather>`;

async function resolveRestaurantId(): Promise<string | null> {
  if (RESTAURANT_ID) return RESTAURANT_ID;
  const { rows } = await pool.query('SELECT id FROM restaurants ORDER BY created_at ASC LIMIT 1');
  return rows[0]?.id ?? null;
}

async function ensureLog(callSid: string, phoneNumber: string, restaurantId: string) {
  await pool.query(
    `INSERT INTO call_logs (restaurant_id, phone_number, direction, twilio_call_sid)
     VALUES ($1, $2, 'inbound', $3)
     ON CONFLICT (twilio_call_sid) DO NOTHING`,
    [restaurantId, phoneNumber, callSid],
  );
}

async function appendToLog(
  callSid: string,
  line: string,
  outcome: 'reservation_booked' | 'faq_answered' | 'transferred_to_staff' | 'voicemail' | 'abandoned',
  reservationId?: string,
) {
  await pool.query(
    `UPDATE call_logs
        SET transcript = COALESCE(transcript || E'\\n', '') || $1,
            outcome = $2,
            reservation_id = COALESCE($3, reservation_id)
      WHERE twilio_call_sid = $4`,
    [line, outcome, reservationId ?? null, callSid],
  );
}

// --- Booking detail parsing (best-effort, free-form speech) -----------------

const toISODate = (d: Date) => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

interface BookingDetails {
  partySize?: number;
  timeSlot?: string;
  date?: string;
}

function parseBookingDetails(text: string): BookingDetails {
  const lower = text.toLowerCase();
  const details: BookingDetails = {};

  const party = lower.match(/(\d{1,2})\s*(?:of us|people|guests|persons?|party|of them)/);
  if (party) details.partySize = Math.min(20, Math.max(1, Number(party[1])));

  const time = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (time) {
    let hours = Number(time[1]);
    const minutes = Number(time[2] ?? 0);
    if (time[3] === 'pm' && hours < 12) hours += 12;
    if (time[3] === 'am' && hours === 12) hours = 0;
    if (hours >= 6 && hours <= 23) details.timeSlot = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  const now = new Date(Date.now() + VOICE_TIMEZONE_OFFSET_MS);
  details.date = toISODate(now);
  if (lower.includes('tomorrow')) details.date = toISODate(new Date(now.getTime() + 86_400_000));

  return details;
}

// --- Intent detection -------------------------------------------------------

function detectIntent(text: string): 'book' | 'transfer' | 'goodbye' | 'faq' {
  const lower = text.toLowerCase();
  if (/(book|reserve|make a reservation|table for)/.test(lower)) return 'book';
  if (/(speak to|talk to|human|person|manager|representative|someone)/.test(lower)) return 'transfer';
  if (/(goodbye|bye|thanks|thank you|that'?s all|no thanks|nothing else|hang up)/.test(lower)) return 'goodbye';
  return 'faq';
}

// --- Routes -----------------------------------------------------------------

export const voiceRouter = Router();
voiceRouter.use(express.urlencoded({ extended: false }));

// Entry: greeting + first speech gather.
voiceRouter.post('/', async (req, res, next) => {
  try {
    const restaurantId = await resolveRestaurantId();
    if (!restaurantId) {
      return res.type('text/xml').send(xml(say('Sorry, this restaurant is not configured.')));
    }
    await ensureLog(req.body.CallSid, req.body.From, restaurantId);
    const greeting =
      'Thanks for calling SHIFT HAPPENS. Say book a table to make a reservation, or ask me anything about the menu or hours.';
    res.type('text/xml').send(xml(gather(say(greeting))));
  } catch (e) {
    next(e);
  }
});

// Per-utterance turn.
voiceRouter.post('/turn', async (req, res, next) => {
  try {
    const restaurantId = await resolveRestaurantId();
    if (!restaurantId) {
      return res.type('text/xml').send(xml(say('Sorry, this restaurant is not configured.')));
    }

    const callSid = req.body.CallSid;
    const speech = String(req.body.SpeechResult ?? req.body.TranscriptionText ?? '').trim();
    const state = callState.get(callSid) ?? { phase: 'idle' };

    if (!speech) {
      return res
        .type('text/xml')
        .send(xml(gather(say('I did not catch that. Please say book a table, or ask me a question.'))));
    }

    const intent = state.phase === 'booking' ? 'book' : detectIntent(speech);
    await appendToLog(callSid, `Caller: ${speech}`, 'faq_answered');

    // --- BOOKING ---
    if (intent === 'book') {
      const details = parseBookingDetails(speech);
      state.phase = 'booking';
      state.partySize = details.partySize ?? state.partySize;
      state.timeSlot = details.timeSlot ?? state.timeSlot;
      state.date = details.date ?? state.date;

      // A bare number answers the missing question.
      const bare = speech.trim().match(/^(\d{1,2})$/);
      if (bare) {
        if (!state.partySize) state.partySize = Math.min(20, Math.max(1, Number(bare[1])));
        else if (!state.timeSlot) state.timeSlot = `${String(Math.min(23, Math.max(6, Number(bare[1])))).padStart(2, '0')}:00`;
      }

      if (!state.partySize || !state.timeSlot) {
        callState.set(callSid, state);
        const ask = !state.partySize ? 'How many people are in your party?' : 'What time would you like to book?';
        return res.type('text/xml').send(xml(gather(say(ask))));
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await smartReservation(client, {
          partySize: state.partySize,
          date: state.date!,
          timeSlot: state.timeSlot,
          source: 'ai_agent',
          createdBy: null,
          restaurantId,
        });
        await client.query('COMMIT');

        if (result.reservation) {
          const reservationId = (result.reservation as { id: string }).id;
          await appendToLog(callSid, `ShiftBot: Confirmed ${state.partySize} at ${state.timeSlot}.`, 'reservation_booked', reservationId);
          callState.delete(callSid);
          return res
            .type('text/xml')
            .send(xml(gather(say(`You are booked for ${state.partySize} at ${state.timeSlot}. Anything else I can help with?`))));
        }

        const msg = `I could not find a table for ${state.partySize} at ${state.timeSlot}. You are on the waitlist, position ${result.waitlistPosition}, estimated wait ${result.estimatedWaitMinutes} minutes.`;
        await appendToLog(callSid, `ShiftBot: ${msg}`, 'faq_answered');
        callState.delete(callSid);
        return res.type('text/xml').send(xml(say(msg)));
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // --- TRANSFER TO STAFF ---
    if (intent === 'transfer') {
      await appendToLog(callSid, 'ShiftBot: Transferring to staff.', 'transferred_to_staff');
      callState.delete(callSid);
      if (STAFF_TRANSFER_NUMBER) {
        return res.type('text/xml').send(xml(`<Dial>${STAFF_TRANSFER_NUMBER}</Dial>`));
      }
      return res
        .type('text/xml')
        .send(xml(say('Please hold, I will connect you with a staff member shortly.')));
    }

    // --- GOODBYE ---
    if (intent === 'goodbye') {
      await appendToLog(callSid, 'ShiftBot: Ended call.', 'faq_answered');
      callState.delete(callSid);
      return res.type('text/xml').send(xml(`${say('Thank you for calling SHIFT HAPPENS. Have a great day.')}<Hangup/>`));
    }

    // --- FAQ via RAG ---
    const results = await searchKnowledgeBase(restaurantId, speech, 5);
    const context = results.length
      ? results.map((r) => `[${r.category}] ${r.answer}`).join('\n')
      : 'No knowledge base match.';
    const systemPrompt = `You are ShiftBot, the phone assistant for SHIFT HAPPENS! restaurant. Answer using only this knowledge:\n${context}\nBe brief and natural for a phone conversation.`;
    const answer = (await openrouterChat(speech, systemPrompt)) ?? 'I am sorry, I could not find that information. Please say talk to a manager for help.';
    await appendToLog(callSid, `ShiftBot: ${answer}`, 'faq_answered');

    return res.type('text/xml').send(xml(gather(say(answer))));
  } catch (e) {
    next(e);
  }
});

// Call history for the SPA AI Agent page.
voiceRouter.get('/calls', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, r.date AS reservation_date, r.time_slot, r.party_size
         FROM call_logs c
         LEFT JOIN reservations r ON r.id = c.reservation_id
        ORDER BY c.created_at DESC
        LIMIT 100`,
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});
