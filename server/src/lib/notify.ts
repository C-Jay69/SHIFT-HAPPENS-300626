/**
 * Notification helpers — Twilio SMS + SendGrid email.
 *
 * Both channels are fire-and-forget and key-gated: when the credentials are
 * absent the calls log and no-op, so the platform runs with zero external
 * dependencies and upgrades to real notifications the moment keys are set
 * (see .env.example: TWILIO_* and SENDGRID_API_KEY).
 */

interface GuestContact {
  firstName: string;
  lastName?: string;
  phone?: string | null;
  email?: string | null;
}

interface SlotInfo {
  date: string; // YYYY-MM-DD
  timeSlot: string; // HH:MM
  tableName?: string | null;
  partySize: number;
}

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID ?? '';
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? '';
const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER ?? '';
const SENDGRID_KEY = process.env.SENDGRID_API_KEY ?? '';
const RESTAURANT_NAME = 'SHIFT HAPPENS!';

const twilioReady = () => TWILIO_SID.length > 0 && TWILIO_TOKEN.length > 0 && TWILIO_FROM.length > 0;
const sendgridReady = () => SENDGRID_KEY.length > 0;

/** Send a Twilio SMS. Resolves false when unconfigured or on error. */
export async function sendSms(to: string, message: string): Promise<boolean> {
  if (!twilioReady()) {
    console.log('[notify] Twilio SMS not configured — skipping:', message.slice(0, 60));
    return false;
  }
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: TWILIO_FROM, To: to, Body: message }),
      },
    );
    if (!res.ok) {
      console.error('[notify] Twilio SMS failed:', res.status, (await res.text()).slice(0, 200));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[notify] Twilio SMS error:', err);
    return false;
  }
}

/** Send a SendGrid email (plain-text body). Resolves false when unconfigured or on error. */
export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  if (!sendgridReady()) {
    console.log('[notify] SendGrid not configured — skipping email:', subject);
    return false;
  }
  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: process.env.SENDGRID_FROM_EMAIL ?? 'no-reply@shifthappens.test', name: RESTAURANT_NAME },
        subject,
        content: [{ type: 'text/plain', value: text }],
      }),
    });
    if (!res.ok) {
      console.error('[notify] SendGrid email failed:', res.status, (await res.text()).slice(0, 200));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[notify] SendGrid email error:', err);
    return false;
  }
}

const prettySlot = (s: SlotInfo) => `${s.date} at ${s.timeSlot.slice(0, 5)}`;

/** Steps 2c/2d of the Smart Reservation Flow: SMS + email confirmation. */
export async function notifyReservationConfirmed(guest: GuestContact, slot: SlotInfo): Promise<void> {
  const name = `${guest.firstName} ${guest.lastName ?? ''}`.trim();
  const tableBit = slot.tableName ? ` Table ${slot.tableName} is held for you.` : '';

  if (guest.phone) {
    await sendSms(
      guest.phone,
      `${RESTAURANT_NAME}: your table for ${slot.partySize} on ${prettySlot(slot)} is confirmed.${tableBit} We look forward to seeing you!`,
    );
  }
  if (guest.email) {
    await sendEmail(
      guest.email,
      `Reservation confirmed — ${RESTAURANT_NAME}`,
      `Hi ${name},\n\nYour reservation is confirmed:\n  Guests: ${slot.partySize}\n  When:  ${prettySlot(slot)}${
        slot.tableName ? `\n  Table: ${slot.tableName}` : ''
      }\n\nSee you soon!\n${RESTAURANT_NAME}`,
    );
  }
}

/** Waitlist acknowledgement (added) and notification (slot opened). */
export async function notifyWaitlistAdded(guest: GuestContact, slot: SlotInfo, position: number): Promise<void> {
  if (guest.phone) {
    await sendSms(
      guest.phone,
      `${RESTAURANT_NAME}: no table for ${slot.partySize} on ${prettySlot(slot)} right now — you're #${position} on the waitlist. We'll message you if a table opens.`,
    );
  }
}

export async function notifyWaitlistSeated(guest: GuestContact, slot: SlotInfo): Promise<void> {
  if (guest.phone) {
    await sendSms(
      guest.phone,
      `${RESTAURANT_NAME}: great news — a table for ${slot.partySize} on ${prettySlot(slot)} just opened! We've booked it for you.`,
    );
  }
  if (guest.email) {
    await sendEmail(
      guest.email,
      `Your waitlist table is confirmed — ${RESTAURANT_NAME}`,
      `Hi ${guest.firstName},\n\nA table for ${slot.partySize} on ${prettySlot(slot)} just opened and we booked it for you.\n\n${RESTAURANT_NAME}`,
    );
  }
}
