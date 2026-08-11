import React, { useState } from 'react';
import { useAppStore } from '../store.tsx';
import { TableStatus, Reservation, Table } from '../types.ts';
import { Users, Clock, Phone, Plus, X, Armchair, CheckCircle, AlertCircle, Trash2, Edit2 } from 'lucide-react';

const Reservations = () => {
  const { tables, reservations, addReservation, updateReservation, updateTableStatus } = useAppStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  
  // Form state
  const [editingReservationId, setEditingReservationId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Reservation>>({
    guests: 2,
    time: '19:00',
    status: 'CONFIRMED',
    tableId: ''
  });

  const openNewReservationModal = () => {
    setEditingReservationId(null);
    setForm({ guests: 2, time: '19:00', status: 'CONFIRMED', tableId: '' });
    setIsModalOpen(true);
  };

  const openEditReservationModal = (res: Reservation) => {
    setEditingReservationId(res.id);
    setForm({
      guestName: res.guestName,
      guestPhone: res.guestPhone,
      time: res.time,
      guests: res.guests,
      status: res.status,
      vip: res.vip,
      notes: res.notes,
      tableId: res.tableId || ''
    });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (form.guestName && form.guestPhone && form.time) {
      
      // Logic to handle releasing the old table if we are moving to a new one
      if (editingReservationId) {
        const oldRes = reservations.find(r => r.id === editingReservationId);
        if (oldRes?.tableId && oldRes.tableId !== form.tableId) {
           // Check if the old table is currently marked as reserved. If so, free it.
           // We check specifically for RESERVED status to avoid accidentally clearing OCCUPIED tables
           const oldTable = tables.find(t => t.id === oldRes.tableId);
           if (oldTable?.status === TableStatus.RESERVED) {
             updateTableStatus(oldTable.id, TableStatus.AVAILABLE);
           }
        }
      }

      if (editingReservationId) {
        // Update existing
        updateReservation(editingReservationId, form);
      } else {
        // Create new
        const newRes: Reservation = {
          id: `res_${Date.now()}`,
          guestName: form.guestName,
          guestPhone: form.guestPhone,
          time: form.time,
          guests: form.guests || 2,
          status: 'CONFIRMED',
          notes: form.notes,
          vip: form.vip,
          tableId: form.tableId || undefined
        };
        addReservation(newRes);
      }
      
      // If a table was assigned, update its status visually to reserved
      if (form.tableId) {
        updateTableStatus(form.tableId, TableStatus.RESERVED);
      }

      setIsModalOpen(false);
      setForm({ guests: 2, time: '19:00', status: 'CONFIRMED', tableId: '' });
      setEditingReservationId(null);
    }
  };

  const changeTableStatus = (status: TableStatus) => {
    if (selectedTable) {
      updateTableStatus(selectedTable.id, status);
      setSelectedTable(null);
    }
  };

  const getTableColor = (status: TableStatus) => {
    switch (status) {
      case TableStatus.AVAILABLE: return 'bg-white border-green-500 text-green-700 shadow-[0_4px_0_#22c55e]';
      case TableStatus.OCCUPIED: return 'bg-red-50 border-red-500 text-red-700 shadow-[0_4px_0_#ef4444]';
      case TableStatus.RESERVED: return 'bg-amber-50 border-shift-amber text-amber-800 shadow-[0_4px_0_#FFBF00]';
      case TableStatus.DIRTY: return 'bg-gray-200 border-gray-400 text-gray-600 shadow-[0_4px_0_#9ca3af]';
      default: return 'bg-white';
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-6rem)]">
      {/* Floor Plan Canvas Area */}
      <div className="flex-1 bg-gray-100 border-2 border-gray-300 rounded-xl relative overflow-hidden shadow-inner min-h-[400px] select-none">
        <div className="absolute top-4 left-4 bg-white/90 px-3 py-1 rounded text-xs font-bold text-gray-500 z-10 shadow-sm">
          MAIN FLOOR
        </div>
        
        {/* Render Tables */}
        {tables.map(table => (
          <div
            key={table.id}
            className={`absolute border-2 rounded-xl flex flex-col items-center justify-center transition-transform active:scale-95 cursor-pointer ${getTableColor(table.status)}`}
            style={{
              left: table.x,
              top: table.y,
              width: table.seats > 2 ? 120 : 80,
              height: table.seats > 2 ? 80 : 80,
            }}
            onClick={() => setSelectedTable(table)}
          >
             <span className="font-bold">{table.name}</span>
             <div className="flex items-center gap-1 text-xs opacity-80">
                <Users size={10} /> {table.seats}
             </div>
          </div>
        ))}
      </div>

      {/* Reservation List / Waitlist */}
      <div className="w-full lg:w-96 bg-white rounded-xl border border-gray-200 flex flex-col shadow-lg">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-xl">
          <h3 className="font-bold text-lg">Upcoming</h3>
          <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full">{reservations.length}</span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {reservations.map((res) => {
            const assignedTable = tables.find(t => t.id === res.tableId);
            return (
              <div key={res.id} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-shift-blue transition-colors shadow-sm group relative">
                <div className="bg-shift-dark text-white w-12 h-12 rounded-lg flex flex-col items-center justify-center shrink-0 group-hover:bg-shift-blue transition-colors">
                  <span className="text-xs font-bold">{res.time}</span>
                </div>
                
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                     <h4 className="font-bold text-sm">{res.guestName}</h4>
                     <div className="flex gap-1">
                       {res.vip && <span className="text-[10px] font-bold bg-shift-magenta text-white px-1.5 rounded">VIP</span>}
                       {assignedTable && <span className="text-[10px] font-bold bg-shift-amber text-amber-900 px-1.5 rounded">{assignedTable.name}</span>}
                     </div>
                  </div>
                  
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Users size={12}/> {res.guests}</span>
                    <span className="flex items-center gap-1"><Phone size={12}/> {res.guestPhone}</span>
                  </div>
                  {res.notes && (
                    <p className="text-xs text-shift-blue mt-1 italic">"{res.notes}"</p>
                  )}
                </div>

                <button 
                  onClick={() => openEditReservationModal(res)}
                  className="absolute top-2 right-2 p-1.5 bg-gray-100 rounded-md text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-shift-blue hover:text-white"
                  title="Edit Reservation"
                >
                  <Edit2 size={12} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button 
            onClick={openNewReservationModal}
            className="w-full py-3 bg-shift-dark text-white font-bold rounded-lg hover:bg-black transition-colors flex items-center justify-center gap-2 shadow-lg shadow-black/10"
          >
            <Plus size={18} /> New Reservation
          </button>
        </div>
      </div>

      {/* Table Details Modal (Context Menu for Map) */}
      {selectedTable && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
           <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl overflow-hidden">
             <div className="p-6 text-center bg-gray-50 border-b border-gray-100">
               <div className="w-16 h-16 bg-white border-2 border-gray-200 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                 <Armchair size={32} className="text-shift-dark" />
               </div>
               <h3 className="text-2xl font-bold text-shift-dark">{selectedTable.name}</h3>
               <p className="text-gray-500">{selectedTable.seats} Seats • {selectedTable.status}</p>
             </div>
             <div className="p-4 space-y-2">
               <button 
                 onClick={() => changeTableStatus(TableStatus.AVAILABLE)}
                 className="w-full py-3 rounded-xl bg-green-50 text-green-700 font-bold hover:bg-green-100 flex items-center justify-center gap-2 transition-colors"
               >
                 <CheckCircle size={18} /> Mark Available
               </button>
               <button 
                 onClick={() => changeTableStatus(TableStatus.OCCUPIED)}
                 className="w-full py-3 rounded-xl bg-blue-50 text-blue-700 font-bold hover:bg-blue-100 flex items-center justify-center gap-2 transition-colors"
               >
                 <Users size={18} /> Seat Guests
               </button>
               <button 
                 onClick={() => changeTableStatus(TableStatus.DIRTY)}
                 className="w-full py-3 rounded-xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 flex items-center justify-center gap-2 transition-colors"
               >
                 <Trash2 size={18} /> Mark Dirty
               </button>
               <button 
                 onClick={() => setSelectedTable(null)}
                 className="w-full py-3 text-gray-400 font-bold hover:text-gray-600"
               >
                 Cancel
               </button>
             </div>
           </div>
        </div>
      )}

      {/* Create/Edit Reservation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-fade-in">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-shift-dark">
                {editingReservationId ? 'Edit Reservation' : 'New Reservation'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Guest Name</label>
                <input 
                  type="text" 
                  value={form.guestName || ''}
                  onChange={e => setForm({...form, guestName: e.target.value})}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-shift-blue"
                  placeholder="Jane Doe"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Time</label>
                  <input 
                    type="time" 
                    value={form.time}
                    onChange={e => setForm({...form, time: e.target.value})}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-shift-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Guests</label>
                  <input 
                    type="number" 
                    value={form.guests}
                    onChange={e => setForm({...form, guests: parseInt(e.target.value)})}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-shift-blue"
                  />
                </div>
              </div>

              {/* Table Selection Dropdown */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Assign Table (Optional)</label>
                <select 
                  value={form.tableId}
                  onChange={e => setForm({...form, tableId: e.target.value})}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-shift-blue appearance-none"
                >
                  <option value="">No specific table assigned</option>
                  {tables.map(table => (
                    <option key={table.id} value={table.id}>
                      {table.name} ({table.seats} seats) - {table.status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phone</label>
                <input 
                  type="tel" 
                  value={form.guestPhone || ''}
                  onChange={e => setForm({...form, guestPhone: e.target.value})}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-shift-blue"
                  placeholder="(555) 000-0000"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Notes</label>
                <textarea 
                  value={form.notes || ''}
                  onChange={e => setForm({...form, notes: e.target.value})}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-shift-blue h-20 resize-none"
                  placeholder="Allergies, special requests..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="vip-check"
                  checked={form.vip || false}
                  onChange={e => setForm({...form, vip: e.target.checked})}
                  className="w-5 h-5 text-shift-blue rounded focus:ring-shift-blue"
                />
                <label htmlFor="vip-check" className="text-sm font-bold text-gray-700">Mark as VIP</label>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-3 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                className="flex-1 py-3 rounded-xl font-bold bg-shift-blue text-white hover:bg-blue-700 transition-colors shadow-lg"
              >
                {editingReservationId ? 'Save Changes' : 'Confirm Booking'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reservations;