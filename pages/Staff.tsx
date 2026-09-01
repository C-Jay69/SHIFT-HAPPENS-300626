import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import { CalendarDays, Clock, Plus, X, UserPlus, LogIn, LogOut } from 'lucide-react';
import TrainingPanel from '../components/TrainingPanel.tsx';

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  hourly_rate: string;
  status: string;
}

interface Shift {
  id: string;
  staff_id: string;
  date: string;
  start_time: string;
  end_time: string;
  first_name?: string;
  last_name?: string;
}

const ROLE_OPTIONS = ['manager', 'server', 'cook', 'host'];

const Staff = () => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [showNewStaff, setShowNewStaff] = useState(false);
  const [showNewShift, setShowNewShift] = useState(false);
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return d.toISOString().slice(0, 10);
  });

  const [staffForm, setStaffForm] = useState({ firstName: '', lastName: '', role: 'server', hourlyRate: 15 });
  const [shiftForm, setShiftForm] = useState({ staffId: '', date: '', startTime: '11:00', endTime: '19:00' });

  const load = async () => {
    const [s, sh] = await Promise.all([
      api.get<StaffMember[]>('/staff').catch(() => []),
      api.get<Shift[]>('/staff/shifts').catch(() => []),
    ]);
    setStaff(s);
    setShifts(sh);
  };

  useEffect(() => { load(); }, []);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

  const staffName = (id: string) => {
    const m = staff.find((s) => s.id === id);
    return m ? `${m.first_name} ${m.last_name}` : 'Unknown';
  };

  const createStaff = async () => {
    await api.post('/staff', { ...staffForm }).catch((e) => alert(e.message));
    setShowNewStaff(false);
    setStaffForm({ firstName: '', lastName: '', role: 'server', hourlyRate: 15 });
    load();
  };

  const createShift = async () => {
    await api.post('/staff/shifts', shiftForm).catch((e) => alert(e.message));
    setShowNewShift(false);
    setShiftForm({ staffId: '', date: weekStart, startTime: '11:00', endTime: '19:00' });
    load();
  };

  const dayName = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-shift-dark">Staff & Scheduling</h1>
          <p className="text-gray-500 text-sm">Shifts, time clock, and roles</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowNewStaff(true)} className="px-4 py-2 bg-shift-dark text-white rounded-lg font-bold flex items-center gap-2 hover:bg-black">
            <UserPlus size={16} /> Add Staff
          </button>
          <button onClick={() => setShowNewShift(true)} className="px-4 py-2 bg-shift-blue text-white rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700">
            <Plus size={16} /> Add Shift
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Staff roster */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div className="p-4 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
            <h3 className="font-bold flex items-center gap-2"><UserPlus size={16} className="text-shift-blue" /> Roster</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {staff.map((s) => (
              <div key={s.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-shift-magenta to-shift-blue text-white flex items-center justify-center font-bold">
                    {s.first_name?.[0]}{s.last_name?.[0]}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{s.first_name} {s.last_name}</p>
                    <p className="text-xs text-gray-400 capitalize">{s.role} · ${Number(s.hourly_rate).toFixed(2)}/hr</p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                  s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>{s.status.toUpperCase()}</span>
              </div>
            ))}
            {staff.length === 0 && (
              <p className="p-8 text-center text-gray-300 text-sm">No staff yet. Add your first team member.</p>
            )}
          </div>
        </div>

        {/* Schedule grid */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-x-auto">
          <div className="p-4 border-b border-gray-100 bg-gray-50 rounded-t-2xl flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2"><CalendarDays size={16} className="text-shift-blue" /> Week Schedule</h3>
            <input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              className="text-xs p-2 bg-white border border-gray-200 rounded-lg"
            />
          </div>
          <div className="min-w-[560px]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-2 text-left text-[10px] font-bold text-gray-400 uppercase">Staff</th>
                  {weekDays.map((d) => (
                    <th key={d} className="p-2 text-center text-[10px] font-bold text-gray-400 uppercase">
                      {dayName(d)}<br /><span className="font-mono text-gray-300">{d.slice(5)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} className="border-t border-gray-50">
                    <td className="p-2 font-bold text-xs">{s.first_name} {s.last_name}</td>
                    {weekDays.map((d) => {
                      const shift = shifts.find((sh) => sh.staff_id === s.id && sh.date === d);
                      return (
                        <td key={d} className="p-1 text-center">
                          {shift ? (
                            <div className="mx-auto bg-shift-blue/10 border border-shift-blue/30 text-shift-blue rounded-lg px-1 py-1.5">
                              <div className="flex items-center justify-center gap-1">
                                <Clock size={10} />
                                <span className="text-[10px] font-bold">{shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)}</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-200">·</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* New staff modal */}
      {showNewStaff && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">Add Staff Member</h3>
              <button onClick={() => setShowNewStaff(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">First name</label>
                <input className="w-full mt-1 p-3 bg-gray-50 border border-gray-200 rounded-xl" value={staffForm.firstName}
                  onChange={(e) => setStaffForm({ ...staffForm, firstName: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Last name</label>
                <input className="w-full mt-1 p-3 bg-gray-50 border border-gray-200 rounded-xl" value={staffForm.lastName}
                  onChange={(e) => setStaffForm({ ...staffForm, lastName: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Role</label>
                <select className="w-full mt-1 p-3 bg-gray-50 border border-gray-200 rounded-xl" value={staffForm.role}
                  onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}>
                  {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Hourly rate</label>
                <input type="number" className="w-full mt-1 p-3 bg-gray-50 border border-gray-200 rounded-xl" value={staffForm.hourlyRate}
                  onChange={(e) => setStaffForm({ ...staffForm, hourlyRate: Number(e.target.value) })} />
              </div>
            </div>
            <button onClick={createStaff} className="w-full py-3 bg-shift-dark text-white font-bold rounded-xl hover:bg-black">Add Staff</button>
          </div>
        </div>
      )}

      {/* New shift modal */}
      {showNewShift && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">Add Shift</h3>
              <button onClick={() => setShowNewShift(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Staff member</label>
              <select className="w-full mt-1 p-3 bg-gray-50 border border-gray-200 rounded-xl" value={shiftForm.staffId}
                onChange={(e) => setShiftForm({ ...shiftForm, staffId: e.target.value })}>
                <option value="">Select…</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Date</label>
              <input type="date" className="w-full mt-1 p-3 bg-gray-50 border border-gray-200 rounded-xl" value={shiftForm.date}
                onChange={(e) => setShiftForm({ ...shiftForm, date: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Start</label>
                <input type="time" className="w-full mt-1 p-3 bg-gray-50 border border-gray-200 rounded-xl" value={shiftForm.startTime}
                  onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">End</label>
                <input type="time" className="w-full mt-1 p-3 bg-gray-50 border border-gray-200 rounded-xl" value={shiftForm.endTime}
                  onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })} />
              </div>
            </div>
            <button onClick={createShift} className="w-full py-3 bg-shift-blue text-white font-bold rounded-xl hover:bg-blue-700">Add Shift</button>
          </div>
        </div>
      )}

      {/* Training & certifications */}
      <TrainingPanel />
    </div>
  );
};

export default Staff;