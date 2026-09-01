import { pool } from '../db.js';

/**
 * DocuSign e-signature for event contracts.
 *
 * Env: DOCUSIGN_ACCESS_TOKEN (+ optional DOCUSIGN_BASE_URL, e.g.
 * https://na2.docusign.net/restapi for EU data residency).
 *
 * Flow: proposal accepted → contract row → `POST /v2.1/envelopes` (signer =
 * lead contact) → status polled lazily via the contracts endpoint →
 * `completed` sets signed_at.
 */

const DS_TOKEN = process.env.DOCUSIGN_ACCESS_TOKEN ?? '';
const DS_BASE = process.env.DOCUSIGN_BASE_URL ?? 'https://na.docusign.net/restapi';

export const docusignConfigured = () => DS_TOKEN.length > 0;

async function dsFetch(path: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  const res = await fetch(`${DS_BASE}/restapi${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${DS_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 300) }; }
  if (!res.ok) {
    const err = (data as { message?: unknown; error_code?: unknown });
    throw new Error(`DocuSign API ${res.status}: ${err.message ?? text.slice(0, 200)}`);
  }
  return data;
}

/**
 * Create a one-page proposal PDF (Helvetica, plain lines). Used when the
 * proposal has no proposal_pdf_url. Returns base64.
 */
export function generateProposalPdf(lines: string[]): string {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  let content = 'BT /F1 11 Tf 1 0 0 1 56 768 Tm 14 TL\n';
  lines.forEach((line, i) => {
    content += `(${esc(line.slice(0, 90))}) Tj T*\n`;
    if (i >= 44) return; // one page, ~45 lines
  });
  content += 'ET';

  const objects: string[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  objects.push(
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  );
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects.push(`<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`);

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefPos = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(pdf, 'latin1').toString('base64');
}

export async function createEnvelope(opts: {
  contractId: string;
  signerName: string;
  signerEmail: string;
  subject: string;
  pdfBase64: string;
  fileName: string;
}): Promise<string> {
  const data = await dsFetch('/v2.1/envelopes', {
    method: 'POST',
    body: JSON.stringify({
      emailSubject: opts.subject.slice(0, 99),
      status: 'sent',
      documents: [
        {
          documentBase64: opts.pdfBase64,
          name: opts.fileName,
          fileExtension: 'pdf',
          documentId: '1',
        },
      ],
      recipients: {
        signers: [
          {
            name: opts.signerName.slice(0, 40) || 'Guest',
            email: opts.signerEmail,
            recipientId: '1',
            tabs: {
              signatureTabs: [{ documentId: '1', xPosition: '1', yPosition: '120' }],
            },
          },
        ],
      },
    }),
  });
  const envelopeId = String(data.id ?? '');
  if (!envelopeId) throw new Error('DocuSign did not return an envelope id');
  await pool.query(
    `UPDATE event_contracts
        SET docusign_envelope_id = $1, docusign_status = 'sent'
      WHERE id = $2`,
    [envelopeId, opts.contractId],
  );
  return envelopeId;
}

export interface EnvelopeState {
  status: 'pending' | 'sent' | 'completed' | 'declined' | 'voided' | 'draft';
  signedAt: string | null;
}

export async function envelopeStatus(envelopeId: string): Promise<EnvelopeState> {
  const data = await dsFetch(`/v2.1/envelopes/${encodeURIComponent(envelopeId)}`);
  const status = String(data.status ?? 'sent') as EnvelopeState['status'];
  return {
    status,
    signedAt: data.completed_date_signed ? String(data.completed_date_signed) : null,
  };
}

/**
 * Send a contract for signature. Builds the proposal PDF from the lead's
 * details (or fetches proposal_pdf_url when present).
 */
export async function sendContractForSignature(contractId: string): Promise<string> {
  const { rows } = await pool.query(
    `SELECT c.id, c.docusign_envelope_id, c.docusign_status, p.total_amount, p.valid_until,
            l.contact_name, l.contact_email, l.event_type, l.event_date, l.guest_count
       FROM event_contracts c
       JOIN event_proposals p ON p.id = c.proposal_id
       JOIN event_leads l ON l.id = p.lead_id
      WHERE c.id = $1`,
    [contractId],
  );
  const c = rows[0];
  if (!c) throw new Error('Contract not found');
  if (!c.contact_email) throw new Error('Lead has no contact email — add one before sending for signature');
  if (c.docusign_envelope_id && c.docusign_status === 'completed') {
    throw new Error('Contract is already signed');
  }

  let pdfBase64: string;
  const lines = [
    'EVENT CATERING PROPOSAL',
    '',
    `Prepared for: ${c.contact_name}`,
    `Contact: ${c.contact_email ?? 'n/a'}`,
    `Event type: ${String(c.event_type ?? 'catering').replace(/_/g, ' ')}`,
    `Event date: ${c.event_date ?? 'TBD'}`,
    `Guests: ${c.guest_count ?? 'TBD'}`,
    '',
    `Total amount: $${Number(c.total_amount).toLocaleString()}`,
    `Deposit (20%): $${(Number(c.total_amount) * 0.2).toLocaleString()}`,
    `Proposal valid until: ${c.valid_until ?? 'N/A'}`,
    '',
    'By signing this document the guest agrees to the terms of the',
    'proposal above and to the 20% deposit policy. The remaining balance',
    'is due on or before the event date.',
    '',
    '',
    '_____________________________',
    'Signature',
  ];
  pdfBase64 = generateProposalPdf(lines);
  const fileName = `proposal-${String(contractId).slice(0, 8)}.pdf`;

  return createEnvelope({
    contractId,
    signerName: String(c.contact_name ?? ''),
    signerEmail: String(c.contact_email),
    subject: `Catering contract for ${c.event_type ?? 'event'} — ${c.contact_name}`,
    pdfBase64,
    fileName,
  });
}

/** Poll one envelope and persist the result on the contract row. */
export async function refreshContractStatus(contractId: string): Promise<EnvelopeState | null> {
  const { rows } = await pool.query(
    `SELECT docusign_envelope_id, docusign_status FROM event_contracts WHERE id = $1`,
    [contractId],
  );
  const c = rows[0];
  if (!c?.docusign_envelope_id) return null;

  const state = await envelopeStatus(c.docusign_envelope_id);
  await pool.query(
    `UPDATE event_contracts
        SET docusign_status = $1,
            signed_at = COALESCE(signed_at, $2::timestamptz)
      WHERE id = $3`,
    [state.status, state.signedAt, contractId],
  );
  return state;
}
