import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import { CalendarPlus, Plus, X, PartyPopper, FileText, PenLine, RefreshCw, CheckCircle2 } from 'lucide-react';

interface Lead {
  id: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  event_type: string;
  event_date: string;
  guest_count: number;
  budget: string;
  status: string;
  notes: string;
  proposal_count?: number;
}

interface Proposal {
  id: string;
  lead_id: string;
  total_amount: string;
  status: string;
}

interface Contract {
  id: string;
  docusign_envelope_id: string | null;
  docusign_status: string | null;
  signed_at: string | null;
  deposit_amount: string;
  deposit_paid: boolean;
  total_amount: string;
  contact_name: string;
  event_date: string | null;
  event_type: string | null;
}

const Events = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ contactName: '', contactEmail: '', contactPhone: '', eventType: 'private_dinner', eventDate: '', guestCount: 10, budget: 500, notes: '' });

  const load = async () => {
    const [l, p, c] = await Promise.all([
      api.get<Lead[]>('/events/leads').catch(() => []),
      api.get<Proposal[]>('/events/proposals').catch(() => []),
      api.get<Contract[]>('/events/contracts').catch(() => []),
    ]);
    setLeads(l);
    setProposals(p);
    setContracts(c);
  };

  const sendForSignature = async (c: Contract) => {
    try {
      await api.post(`/events/contracts/${c.id}/send-docusign`);
      alert('Sent for signature via DocuSign.');
    } catch (e) {
      alert((e as Error).message);
    }
    load();
  };

  const refreshSignature = async (c: Contract) => {
    try {
      const state = await api.post<{ status: string }>(`/events/contracts/${c.id}/refresh-docusign`);
      if (state.status === 'completed') alert('Contract signed! 🎉');
    } catch (e) {
      alert((e as Error).message);
    }
    load();
  };

  const markDepositPaid = async (c: Contract) => {
    try {
      await api.post(`/events/contracts/${c.id}/deposit-paid`);
    } catch (e) {
      alert((e as Error).message);
    }
    load();
  };

  useEffect(() => { load(); }, []);

  const createLead = async () => {
    await api.post('/events/leads', form).catch((e) => alert(e.message));
    setShowModal(false);
    setForm({ contactName: '', contactEmail: '', contactPhone: '', eventType: 'private_dinner', eventDate: '', guestCount: 10, budget: 500, notes: '' });
    load();
  };

  const createProposal = async (lead: Lead) => {
    await api.post('/events/proposals', { leadId: lead.id, totalAmount: lead.budget || 500 }).catch((e) => alert(e.message));
    load();
  };

  const statusColor = (s: string) => ({
    new: 'bg-blue-100 text-blue-700',
    contacted: 'bg-amber-100 text-amber-700',
    proposed: 'bg-purple-100 text-purple-700',
    won: 'bg-green-100 text-green-700',
    lost: 'bg-gray-100 text-gray-500',
  }[s] ?? 'bg-gray-100 text-gray-500');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-shift-dark">Events & Catering</h1>
          <p className="text-gray-500 text-sm">Leads, proposals, and contracts</p>
        </div>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-shift-dark text-white rounded-lg font-bold flex items-center gap-2 hover:bg-black">
          <Plus size={16} /> New Lead
        </button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {leads.map((lead) => {
          const proposal = proposals.find((p) => p.lead_id === lead.id);
          return (
            <div key={lead.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-shift-magenta/10 text-shift-magenta flex items-center justify-center">
                    <PartyPopper size={18} />
                  </div>
                  <div>
                    <p className="font-bold">{lead.contact_name}</p>
                    <p className="text-xs text-gray-400 capitalize">{lead.event_type?.replace(/_/g, ' ')}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${statusColor(lead.status)}`}>{lead.status.toUpperCase()}</span>
              </div>

              <div className="space-y-1 text-xs text-gray-500">
                <p>{lead.event_date ? new Date(lead.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Date TBD'} · {lead.guest_count} guests</p>
                {lead.contact_email && <p>{lead.contact_email}</p>}
                {lead.contact_phone && <p>{lead.contact_phone}</p>}
                <p className="font-mono font-bold text-shift-dark">Budget: ${Number(lead.budget || 0).toLocaleString()}</p>
              </div>

              {proposal ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-lg p-2.5">
                  <span className="text-xs font-bold text-green-700 flex items-center gap-1.5">
                    <FileText size={14} /> Proposal ${Number(proposal.total_amount).toLocaleString()} · {proposal.status}
                  </span>
                </div>
              ) : (
                <button onClick={() => createProposal(lead)} className="w-full py-2.5 bg-shift-blue/10 text-shift-blue border border-shift-blue/30 rounded-lg text-xs font-bold hover:bg-shift-blue hover:text-white transition-colors">
                  Create Proposal
                </button>
              )}
            </div>
          );
        })}
        {leads.length === 0 && (
          <div className="md:col-span-2 lg:col-span-3 p-12 text-center text-gray-300">
            <CalendarPlus size={40} className="mx-auto mb-3" />
            <p>No event leads yet. Add your first catering inquiry.</p>
          </div>
        )}
      </div>

      {/* Contracts & e-signatures */}
      {contracts.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <FileText size={18} className="text-shift-blue" />
            <h2 className="font-bold">Contracts & E-Signatures</h2>
            <span className="ml-auto text-xs text-gray-400">DocuSign-driven · auto-sent on acceptance when configured</span>
          </div>
          <div className="divide-y divide-gray-100">
            {contracts.map((c) => (
              <div key={c.id} className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{c.contact_name}</p>
                  <p className="text-xs text-gray-400 capitalize">
                    {c.event_type?.replace(/_/g, ' ')}
                    {c.event_date ? ` · ${new Date(c.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
                    <span className="font-mono font-bold text-shift-dark">Total ${Number(c.total_amount).toLocaleString()}</span>
                    <span className={`flex items-center gap-1 ${c.deposit_paid ? 'text-green-600 font-bold' : 'text-gray-400'}`}>
                      <CheckCircle2 size={13} className={c.deposit_paid ? 'text-green-500' : 'text-gray-300'} />
                      Deposit ${Number(c.deposit_amount).toLocaleString()} {c.deposit_paid ? 'paid' : 'due'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {c.docusign_status === 'completed' ? (
                    <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1.5">
                      <CheckCircle2 size={14} /> Signed{c.signed_at ? ` ${new Date(c.signed_at).toLocaleDateString()}` : ''}
                    </span>
                  ) : c.docusign_status === 'sent' ? (
                    <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1.5">
                      <RefreshCw size={13} className="animate-spin" /> Awaiting signature
                    </span>
                  ) : c.docusign_status === 'declined' ? (
                    <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-red-100 text-red-700">Declined</span>
                  ) : (
                    <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-gray-100 text-gray-400">Not sent</span>
                  )}

                  {c.docusign_status !== 'completed' && c.docusign_status !== 'sent' && (
                    <button
                      onClick={() => sendForSignature(c)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-shift-blue text-white rounded-lg text-xs font-bold hover:bg-blue-700"
                    >
                      <PenLine size={13} /> Send for signature
                    </button>
                  )}
                  {c.docusign_status === 'sent' && (
                    <button
                      onClick={() => refreshSignature(c)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200"
                    >
                      <RefreshCw size={13} /> Check status
                    </button>
                  )}
                  {!c.deposit_paid && (
                    <button
                      onClick={() => markDepositPaid(c)}
                      className="px-3 py-1.5 border border-green-300 text-green-700 rounded-lg text-xs font-bold hover:bg-green-50"
                    >
                      Mark deposit paid
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">New Event Lead</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Contact name</label>
              <input className="w-full mt-1 p-3 bg-gray-50 border border-gray-200 rounded-xl" value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Email</label>
                <input className="w-full mt-1 p-3 bg-gray-50 border border-gray-200 rounded-xl" value={form.contactEmail}
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Phone</label>
                <input className="w-full mt-1 p-3 bg-gray-50 border border-gray-200 rounded-xl" value={form.contactPhone}
                  onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Event type</label>
                <select className="w-full mt-1 p-3 bg-gray-50 border border-gray-200 rounded-xl" value={form.eventType}
                  onChange={(e) => setForm({ ...form, eventType: e.target.value })}>
                  <option value="private_dinner">Private dinner</option>
                  <option value="birthday">Birthday</option>
                  <option value="corporate">Corporate</option>
                  <option value="wedding">Wedding</option>
                  <option value="catering">Catering</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Date</label>
                <input type="date" className="w-full mt-1 p-3 bg-gray-50 border border-gray-200 rounded-xl" value={form.eventDate}
                  onChange={(e) => setForm({ ...form, eventDate: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Guests</label>
                <input type="number" className="w-full mt-1 p-3 bg-gray-50 border border-gray-200 rounded-xl" value={form.guestCount}
                  onChange={(e) => setForm({ ...form, guestCount: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Budget ($)</label>
                <input type="number" className="w-full mt-1 p-3 bg-gray-50 border border-gray-200 rounded-xl" value={form.budget}
                  onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Notes</label>
              <textarea className="w-full mt-1 p-3 bg-gray-50 border border-gray-200 rounded-xl h-20" value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <button onClick={createLead} className="w-full py-3 bg-shift-dark text-white font-bold rounded-xl hover:bg-black">Save Lead</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Events;