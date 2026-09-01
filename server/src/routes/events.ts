import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth, currentUser } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';
import {
  docusignConfigured,
  sendContractForSignature,
  refreshContractStatus,
} from '../lib/docusign.js';

const router = Router();
router.use(requireAuth);

// --- Event leads ---

const leadSchema = z.object({
  contactName: z.string().min(1),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional().or(z.literal('')),
  eventType: z.string().optional(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  guestCount: z.number().int().positive().optional(),
  budget: z.number().nonnegative().optional(),
  status: z.enum(['new', 'contacted', 'proposed', 'won', 'lost']).optional(),
  notes: z.string().optional(),
});

router.get('/leads', async (req, res, next) => {
  try {
    const user = currentUser(req);
    const { rows } = await pool.query(
      `SELECT l.*, COUNT(p.id) AS proposal_count
         FROM event_leads l
         LEFT JOIN event_proposals p ON p.lead_id = l.id
        WHERE l.restaurant_id = $1
        GROUP BY l.id
        ORDER BY l.created_at DESC`,
      [user.restaurantId],
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/leads', async (req, res, next) => {
  try {
    const user = currentUser(req);
    const body = leadSchema.parse(req.body);
    const { rows } = await pool.query(
      `INSERT INTO event_leads (restaurant_id, contact_name, contact_email, contact_phone, event_type, event_date, guest_count, budget, notes)
       VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''), $5, $6, $7, $8, NULLIF($9, '')) RETURNING *`,
      [user.restaurantId, body.contactName, body.contactEmail ?? '', body.contactPhone ?? '', body.eventType ?? null, body.eventDate ?? null, body.guestCount ?? null, body.budget ?? null, body.notes ?? ''],
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.patch('/leads/:id', async (req, res, next) => {
  try {
    const body = leadSchema.partial().parse(req.body);
    const map: Record<string, string> = {
      contactName: 'contact_name',
      contactEmail: 'contact_email',
      contactPhone: 'contact_phone',
      eventType: 'event_type',
      eventDate: 'event_date',
      guestCount: 'guest_count',
      budget: 'budget',
      status: 'status',
      notes: 'notes',
    };
    const keys = Object.keys(body);
    if (keys.length === 0) throw new ApiError(400, 'No fields to update');
    const sets = keys.map((k, i) => `${map[k]} = $${i + 2}`).join(', ');
    const values = keys.map((k) => body[k as keyof typeof body] ?? null);
    const { rows } = await pool.query(
      `UPDATE event_leads SET ${sets} WHERE id = $1 RETURNING *`,
      [req.params.id, ...values],
    );
    if (!rows[0]) throw new ApiError(404, 'Lead not found');
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// --- Proposals & contracts ---

const proposalSchema = z.object({
  leadId: z.string().uuid(),
  totalAmount: z.number().nonnegative(),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

router.post('/proposals', async (req, res, next) => {
  try {
    const body = proposalSchema.parse(req.body);
    const { rows } = await pool.query(
      `INSERT INTO event_proposals (lead_id, total_amount, valid_until)
       VALUES ($1, $2, $3) RETURNING *`,
      [body.leadId, body.totalAmount, body.validUntil ?? null],
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.post('/proposals/:id/accept', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE event_proposals SET status = 'accepted' WHERE id = $1 RETURNING *`,
      [req.params.id],
    );
    if (!rows[0]) throw new ApiError(404, 'Proposal not found');

    const { rows: contracts } = await pool.query(
      `INSERT INTO event_contracts (proposal_id, deposit_amount)
       VALUES ($1, $2) RETURNING *`,
      [rows[0].id, rows[0].total_amount * 0.2],
    );

    // Kick off e-signature when DocuSign is configured (fire-and-forget —
    // acceptance must not depend on DocuSign availability).
    const contract = contracts[0];
    void (async () => {
      try {
        if (!docusignConfigured()) return;
        await sendContractForSignature(String(contract.id));
        console.log(`[events] Contract ${String(contract.id).slice(0, 8)} sent for signature.`);
      } catch (err) {
        console.warn('[events] DocuSign auto-send failed:', err);
      }
    })();

    res.status(201).json({ proposal: rows[0], contract });
  } catch (e) {
    next(e);
  }
});

// Lazily refresh DocuSign envelope states so the UI shows live signatures
// without waiting for a background poller (bounded to 3 per request).
async function refreshSentContracts(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await Promise.allSettled(
    ids.slice(0, 3).map((id) => refreshContractStatus(id)),
  ).then((results) => {
    for (const r of results) {
      if (r.status === 'rejected') console.warn('[events] DocuSign refresh failed:', r.reason);
    }
  });
}

router.get('/contracts', async (req, res, next) => {
  try {
    const user = currentUser(req);
    const { rows } = await pool.query(
      `SELECT c.*, p.total_amount, l.contact_name, l.event_date, l.event_type
         FROM event_contracts c
         JOIN event_proposals p ON p.id = c.proposal_id
         JOIN event_leads l ON l.id = p.lead_id
        WHERE l.restaurant_id = $1
        ORDER BY c.created_at DESC`,
      [user.restaurantId],
    );
    if (docusignConfigured()) {
      await refreshSentContracts(rows.filter((c) => c.docusign_status === 'sent').map((c) => String(c.id)));
      const refreshed = await pool.query(
        `SELECT c.*, p.total_amount, l.contact_name, l.event_date, l.event_type
           FROM event_contracts c
           JOIN event_proposals p ON p.id = c.proposal_id
           JOIN event_leads l ON l.id = p.lead_id
          WHERE l.restaurant_id = $1
          ORDER BY c.created_at DESC`,
        [user.restaurantId],
      );
      return res.json(refreshed.rows);
    }
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// Send an existing contract for signature (manual trigger / retry).
router.post('/contracts/:id/send-docusign', async (_req, res, next) => {
  try {
    if (!docusignConfigured()) throw new ApiError(503, 'DocuSign is not configured. Set DOCUSIGN_ACCESS_TOKEN.');
    const envelopeId = await sendContractForSignature(_req.params.id);
    res.json({ envelopeId, status: 'sent' });
  } catch (e) {
    next(e);
  }
});

// Poll one envelope now and persist the outcome.
router.post('/contracts/:id/refresh-docusign', async (_req, res, next) => {
  try {
    if (!docusignConfigured()) throw new ApiError(503, 'DocuSign is not configured.');
    const state = await refreshContractStatus(_req.params.id);
    if (!state) throw new ApiError(404, 'Contract has no DocuSign envelope — send it first');
    res.json(state);
  } catch (e) {
    next(e);
  }
});

// Record deposit payment.
router.post('/contracts/:id/deposit-paid', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE event_contracts SET deposit_paid = true WHERE id = $1 RETURNING *`,
      [_req.params.id],
    );
    if (!rows[0]) throw new ApiError(404, 'Contract not found');
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

export const eventsRouter = router;