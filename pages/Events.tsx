import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import { CalendarPlus, Plus, X, PartyPopper, FileText } from 'lucide-react';

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

const Events = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ contactName: '', contactEmail: '', contactPhone: '', eventType: 'private_dinner', eventDate: '', guestCount: 10, budget: 500, notes: '' });

  const load = async () => {
    const [l, p] = await Promise.all([
      api.get<Lead[]>('/events/leads').catch(() => []),
      api.get<Proposal[]>('/events/proposals').catch(() => []),
    ]);
    setLeads(l);
    setProposals(p);
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