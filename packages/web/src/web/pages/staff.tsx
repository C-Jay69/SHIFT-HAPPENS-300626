import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

const ROLES = ["admin", "manager", "server", "host"] as const;

export default function StaffPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"staff" | "shifts">("staff");
  const [shiftDate, setShiftDate] = useState(new Date().toISOString().split("T")[0]);
  const [showForm, setShowForm] = useState(false);
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [form, setForm] = useState({ userId: "", role: "server" as any, pin: "", hourlyRate: "", phone: "" });
  const [shiftForm, setShiftForm] = useState({ staffUserId: "", date: shiftDate, startTime: "09:00", endTime: "17:00", role: "server" as any, notes: "" });

  const { data: staffData } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => { const r = await api.staff.$get(); return r.json(); },
  });

  const { data: shiftsData } = useQuery({
    queryKey: ["shifts", shiftDate],
    queryFn: async () => { const r = await (api.staff as any).shifts.$get({ query: { date: shiftDate } }); return r.json(); },
  });

  const createStaff = useMutation({
    mutationFn: async () => {
      const r = await api.staff.$post({ json: form });
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["staff"] }); setShowForm(false); },
  });

  const createShift = useMutation({
    mutationFn: async () => {
      const r = await (api.staff as any).shifts.$post({ json: shiftForm });
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["shifts"] }); setShowShiftForm(false); },
  });

  const staff: any[] = (staffData as any)?.staff ?? [];
  const shifts: any[] = (shiftsData as any)?.shifts ?? [];

  const roleColor: Record<string, string> = {
    admin: "#ef4444",
    manager: "#f59e0b",
    server: "#06b6d4",
    host: "#22c55e",
  };

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold gradient-text font-mono">Staff</h1>
        <button onClick={() => tab === "staff" ? setShowForm(true) : setShowShiftForm(true)}
          className="btn-gradient px-4 py-2 rounded-lg text-sm font-semibold">
          + {tab === "staff" ? "Add Staff" : "Add Shift"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ background: "#0a0a0a", width: "fit-content" }}>
        {(["staff", "shifts"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded text-sm font-mono capitalize"
            style={{
              background: tab === t ? "linear-gradient(135deg,#7c3aed,#06b6d4)" : "transparent",
              color: tab === t ? "#fff" : "#71717a",
              border: "none",
              cursor: "pointer",
            }}>{t}</button>
        ))}
      </div>

      {tab === "staff" ? (
        <div className="space-y-2">
          {staff.length === 0 && <div className="text-center py-12 text-sm" style={{ color: "#71717a" }}>No staff added yet</div>}
          {staff.map((s: any) => (
            <div key={s.id} className="rounded-xl p-4 flex items-center justify-between"
              style={{ background: "#111", border: "1px solid #1e1e1e" }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: `${roleColor[s.role]}20`, color: roleColor[s.role] }}>
                  {s.role[0].toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-sm">{s.userId}</div>
                  <div className="text-xs" style={{ color: "#71717a" }}>{s.phone || "No phone"}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs px-2 py-0.5 rounded-full font-mono"
                  style={{ background: `${roleColor[s.role]}20`, color: roleColor[s.role] }}>{s.role}</span>
                {s.hourlyRate && <span className="text-xs font-mono" style={{ color: "#71717a" }}>${s.hourlyRate}/hr</span>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <input type="date" value={shiftDate} onChange={(e) => setShiftDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm"
              style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#f5f5f5" }} />
            <span className="text-sm" style={{ color: "#71717a" }}>{shifts.length} shift{shifts.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="space-y-2">
            {shifts.length === 0 && <div className="text-center py-12 text-sm" style={{ color: "#71717a" }}>No shifts scheduled</div>}
            {shifts.map((s: any) => (
              <div key={s.id} className="rounded-xl p-4 flex items-center justify-between"
                style={{ background: "#111", border: "1px solid #1e1e1e" }}>
                <div>
                  <div className="font-medium text-sm">{s.staffUserId}</div>
                  <div className="text-xs font-mono" style={{ color: "#71717a" }}>
                    {s.startTime} – {s.endTime}
                  </div>
                  {s.notes && <div className="text-xs mt-1" style={{ color: "#71717a" }}>{s.notes}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full font-mono"
                    style={{ background: `${roleColor[s.role] ?? "#71717a"}20`, color: roleColor[s.role] ?? "#71717a" }}>{s.role}</span>
                  <div className="text-xs" style={{ color: s.clockIn ? "#22c55e" : "#71717a" }}>
                    {s.clockIn ? "Clocked in" : s.clockOut ? "Done" : "Scheduled"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Staff form */}
      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: "#111", border: "1px solid #1e1e1e" }}>
            <h2 className="text-lg font-bold font-mono mb-4 gradient-text">Add Staff Profile</h2>
            <div className="space-y-3">
              {[{ key: "userId", label: "User ID / Email" }, { key: "pin", label: "PIN (4 digits)" }, { key: "hourlyRate", label: "Hourly Rate" }, { key: "phone", label: "Phone" }].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-mono uppercase tracking-widest mb-1" style={{ color: "#71717a" }}>{label}</label>
                  <input type="text" value={(form as any)[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#f5f5f5" }} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-mono uppercase tracking-widest mb-1" style={{ color: "#71717a" }}>Role</label>
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as any }))}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#f5f5f5" }}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg text-sm"
                style={{ background: "#1e1e1e", border: "none", color: "#71717a", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => createStaff.mutate()} disabled={createStaff.isPending}
                className="flex-1 py-2 rounded-lg text-sm font-semibold btn-gradient">
                {createStaff.isPending ? "Saving..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
