import React, { useState, useCallback } from 'react';
import { useAppStore } from '../store.tsx';
import { WaitlistEntry, Guest, TableStatus } from '../types.ts';
import { Phone, Users, Clock, AlertCircle, CheckCircle, X, Bell, BellOff, MoreVertical, Edit2, Trash2, Send, Plus } from 'lucide-react';

interface WaitlistPanelProps {
  className?: string;
}

const WaitlistPanel = ({ className = '' }: WaitlistPanelProps) => {
  const { 
    waitlist, 
    guests, 
    addWaitlistEntry, 
    updateWaitlistEntry, 
    removeWaitlistEntry,
    tables,
    reservations,
    addReservation,
    updateTableStatus 
  } = useAppStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WaitlistEntry | null>(null);
  const [form, setForm] = useState({
    guestId: '',
    guestName: '',
    guestPhone: '',
    partySize: 2,
    requestedDate: new Date().toISOString().slice(0, 10),
    requestedTime: '19:00',
    notes: '',
  });
  const [filterStatus, setFilterStatus] = useState<'all' | 'waiting' | 'notified' | 'seated'>('all');

  const openNewModal = () => {
    setEditingEntry(null);
    setForm({
      guestId: '',
      guestName: '',
      guestPhone: '',
      partySize: 2,
      requestedDate: new Date().toISOString().slice(0, 10),
      requestedTime: '19:00',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (entry: WaitlistEntry) => {
    const guest = guests.find(g => g.id === entry.guestId);
    setEditingEntry(entry);
    setForm({
      guestId: entry.guestId,
      guestName: entry.guestName,
      guestPhone: entry.guestPhone,
      partySize: entry.partySize,
      requestedDate: entry.requestedDate,
      requestedTime: entry.requestedTime,
      notes: entry.notes || '',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEntry(null);
    setForm({
      guestId: '',
      guestName: '',
      guestPhone: '',
      partySize: 2,
      requestedDate: new Date().toISOString().slice(0, 10),
      requestedTime: '19:00',
      notes: '',
    });
  };

  const handleSave = () => {
    if (!form.guestName || !form.guestPhone) return;

    if (editingEntry) {
      updateWaitlistEntry(editingEntry.id, form);
    } else {
      const newEntry: WaitlistEntry = {
        id: `wl_${Date.now()}`,
        guestId: form.guestId || `guest_${Date.now()}`,
        guestName: form.guestName,
        guestPhone: form.guestPhone,
        partySize: form.partySize,
        requestedDate: form.requestedDate,
        requestedTime: form.requestedTime,
        status: 'waiting',
        notes: form.notes,
        createdAt: new Date().toISOString(),
      };
      addWaitlistEntry(newEntry);
    }
    closeModal();
  };

  const handleSeat = (entry: WaitlistEntry) => {
    const availableTable = tables.find(t => 
      t.seats >= entry.partySize && 
      t.status === TableStatus.AVAILABLE
    );

    if (availableTable) {
      const newRes = {
        id: `res_${Date.now()}`,
        guestName: entry.guestName,
        guestPhone: entry.guestPhone,
        time: entry.requestedTime,
        guests: entry.partySize,
        status: 'CONFIRMED' as const,
        tableId: availableTable.id,
        notes: entry.notes,
      };
      addReservation(newRes);
      updateTableStatus(availableTable.id, TableStatus.RESERVED);
      updateWaitlistEntry(entry.id, { status: 'seated' });
    } else {
      updateWaitlistEntry(entry.id, { status: 'notified', notifiedAt: new Date().toISOString() });
      alert(`No available table for ${entry.partySize} guests. Guest notified.`);
    }
  };

  const handleNotify = (entry: WaitlistEntry) => {
    updateWaitlistEntry(entry.id, { 
      status: entry.status === 'notified' ? 'waiting' : 'notified',
      notifiedAt: entry.status === 'notified' ? undefined : new Date().toISOString()
    });
  };

  const handleRemove = (entry: WaitlistEntry) => {
    if (window.confirm(`Remove ${entry.guestName} from waitlist?`)) {
      removeWaitlistEntry(entry.id);
    }
  };

  const filteredWaitlist = waitlist
    .filter(entry => filterStatus === 'all' || entry.status === filterStatus)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const waitingCount = waitlist.filter(e => e.status === 'waiting').length;
  const notifiedCount = waitlist.filter(e => e.status === 'notified').length;

  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold flex items-center gap-2 text-lg">
            <Users className="text-shift-blue" size={20} /> Waitlist
          </h3>
          <button onClick={openNewModal} className="px-3 py-1.5 bg-shift-dark text-white rounded-lg text-sm font-bold flex items-center gap-1 hover:bg-black">
            <Plus size={14} /> Add
          </button>
        </div>

        {/* Status Filter */}
        <div className="flex gap-2">
          {(['all', 'waiting', 'notified', 'seated'] as const).map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterStatus === status
                  ? 'bg-shift-dark text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              {status !== 'all' && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  status === 'waiting' ? 'bg-amber-100 text-amber-700' :
                  status === 'notified' ? 'bg-blue-100 text-blue-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {status === 'waiting' ? waitingCount : status === 'notified' ? notifiedCount : waitlist.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Waitlist Entries */}
      <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
        {filteredWaitlist.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Users size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">{filterStatus === 'all' ? 'No guests on waitlist' : `No ${filterStatus} guests`}</p>
          </div>
        ) : (
          filteredWaitlist.map((entry, index) => {
            const statusConfig = {
              waiting: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: <Clock size={14} className="text-amber-600" />, label: 'Waiting' },
              notified: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: <Bell size={14} className="text-blue-600" />, label: 'Notified' },
              seated: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', icon: <CheckCircle size={14} className="text-green-600" />, label: 'Seated' },
              cancelled: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-500', icon: <X size={14} className="text-gray-400" />, label: 'Cancelled' },
            }[entry.status];

            const waitTime = entry.status === 'waiting' || entry.status === 'notified'
              ? Math.floor((Date.now() - new Date(entry.createdAt).getTime()) / 60000)
              : null;

            return (
              <div key={entry.id} className={`p-4 hover:bg-gray-50 transition-colors ${statusConfig.bg} ${statusConfig.border} border-l-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-bold text-sm ${statusConfig.text} flex items-center gap-1`}>
                        {statusConfig.icon}
                        {statusConfig.label}
                      </span>
                      {waitTime && (
                        <span className="px-2 py-0.5 bg-white/70 rounded-full text-xs font-mono font-bold text-gray-600">
                          {waitTime} min
                        </span>
                      )}
                      <span className="text-xs text-gray-400 font-mono">#{index + 1}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600 mb-1">
                      <span className="font-bold text-shift-dark">{entry.guestName}</span>
                      {entry.guestPhone && (
                        <span className="flex items-center gap-1">
                          <Phone size={12} /> {entry.guestPhone}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Users size={12} /> {entry.partySize} guests
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {entry.requestedTime}
                      </span>
                    </div>
                    {entry.notes && (
                      <p className="text-xs text-gray-500 italic mt-1">{entry.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {entry.status === 'waiting' && (
                      <>
                        <button
                          onClick={() => handleNotify(entry)}
                          className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                          title="Notify guest"
                        >
                          <Bell size={16} />
                        </button>
                        <button
                          onClick={() => handleSeat(entry)}
                          className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                          title="Seat guest"
                        >
                          <CheckCircle size={16} />
                        </button>
                      </>
                    )}
                    {entry.status === 'notified' && (
                      <button
                        onClick={() => handleNotify(entry)}
                        className="p-2 bg-amber-100 text-amber-600 rounded-lg hover:bg-amber-200 transition-colors"
                        title="Mark as waiting"
                      >
                        <BellOff size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => openEditModal(entry)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleRemove(entry)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">{editingEntry ? 'Edit Waitlist Entry' : 'Add to Waitlist'}</h3>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
            </div>

            <div>
              <label className="text-sm font-bold text-gray-500 uppercase mb-1 block">Guest</label>
              <div className="relative">
                <input
                  type="text"
                  value={form.guestName}
                  onChange={(e) => setForm({ ...form, guestName: e.target.value })}
                  placeholder="Search existing guest or enter new name"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-shift-blue focus:outline-none"
                />
                {guests.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {guests.map(guest => (
                      <button
                        key={guest.id}
                        onClick={() => setForm({ 
                          ...form, 
                          guestId: guest.id, 
                          guestName: `${guest.first_name} ${guest.last_name}`,
                          guestPhone: guest.phone || '',
                        })}
                        className="w-full p-3 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0"
                      >
                        <p className="font-bold text-sm">{guest.first_name} {guest.last_name}</p>
                        <p className="text-xs text-gray-500">{guest.phone || 'No phone'}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-bold text-gray-500 uppercase mb-1 block">Phone</label>
                <input
                  type="tel"
                  value={form.guestPhone}
                  onChange={(e) => setForm({ ...form, guestPhone: e.target.value })}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-shift-blue focus:outline-none"
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <label className="text-sm font-bold text-gray-500 uppercase mb-1 block">Party Size</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={form.partySize}
                  onChange={(e) => setForm({ ...form, partySize: Number(e.target.value) })}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-shift-blue focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-bold text-gray-500 uppercase mb-1 block">Date</label>
                <input
                  type="date"
                  value={form.requestedDate}
                  onChange={(e) => setForm({ ...form, requestedDate: e.target.value })}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-shift-blue focus:outline-none"
                  min={new Date().toISOString().slice(0, 10)}
                />
              </div>
              <div>
                <label className="text-sm font-bold text-gray-500 uppercase mb-1 block">Time</label>
                <input
                  type="time"
                  value={form.requestedTime}
                  onChange={(e) => setForm({ ...form, requestedTime: e.target.value })}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-shift-blue focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-bold text-gray-500 uppercase mb-1 block">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-shift-blue focus:outline-none"
                placeholder="Special requests, allergies, etc."
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={closeModal} className="flex-1 py-3 border border-gray-200 rounded-xl font-bold hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleSave} className="flex-1 py-3 bg-shift-dark text-white rounded-xl font-bold hover:bg-black">
                {editingEntry ? 'Save Changes' : 'Add to Waitlist'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WaitlistPanel;