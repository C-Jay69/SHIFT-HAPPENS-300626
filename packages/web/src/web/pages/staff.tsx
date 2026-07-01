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

  const roleColor: Record<string, { bg: string; text: string }> = {
    admin: { bg: "#ffdad6", text: "#ba1a1a" },
    manager: { bg: "#fff3d6", text: "#8a6100" },
    server: { bg: "#eeeeee", text: "#1a1c1c" },
    host: { bg: "#e3f5e9", text: "#1e7d3c" },
  };

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold font-display" style={{ color: "var(--primary)" }}>Staff</h1>
        <button onClick={() => tab === "staff" ? setShowForm(true) : setShowShiftForm(true)}
          className="btn-gradient px-4 py-2 text-sm font-semibold">
          + {tab === "staff" ? "Add Staff" : "Add Shift"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 p-1" style={{ background: "var(--surface-container-low)", width: "fit-content", borderRadius: "var(--radius)" }}>
        {(["staff", "shifts"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-1.5 text-sm capitalize font-medium"
            style={{
              background: tab === t ? "var(--primary)" : "transparent",
              color: tab === t ? "#fff" : "var(--muted-2)",
              border: "none",
              cursor: "pointer",
              borderRadius: "var(--radius)",
            }}>{t}</button>
        ))}
      </div>

      {tab === "staff" ? (
        <div className="space-y-2">
          {staff.length === 0 && <div className="text-center py-12 text-sm" style={{ color: "var(--muted-2)" }}>No staff added yet</div>}
          {staff.map((s: any) => {
            const rc = roleColor[s.role] ?? { bg: "#eeeeee", text: "#747878" };
            return (
              <div key={s.id} className="p-4 flex items-center justify-between"
                style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: rc.bg, color: rc.text }}>
                    {s.role[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{s.userId}</div>
                    <div className="text-xs" style={{ color: "var(--muted-2)" }}>{s.phone || "No phone"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs px-2 py-0.5 font-medium" style={{ background: rc.bg, color: rc.text, borderRadius: "9999px" }}>{s.role}</span>
                  {s.hourlyRate && <span className="text-xs" style={{ color: "var(--muted-2)" }}>${s.hourlyRate}/hr</span>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <input type="date" value={shiftDate} onChange={(e) => setShiftDate(e.target.value)}
              className="px-3 py-1.5 text-sm"
              style={{ background: "#fff", border: "1px solid var(--border-strong)", color: "var(--foreground)", borderRadius: "var(--radius)" }} />
            <span className="text-sm" style={{ color: "var(--muted-2)" }}>{shifts.length} shift{shifts.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="space-y-2">
            {shifts.length === 0 && <div className="text-center py-12 text-sm" style={{ color: "var(--muted-2)" }}>No shifts scheduled</div>}
            {shifts.map((s: any) => {
              const rc = roleColor[s.role] ?? { bg: "#eeeeee", text: "#747878" };
              return (
                <div key={s.id} className="p-4 flex items-center justify-between"
                  style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
                  <div>
                    <div className="font-medium text-sm">{s.staffUserId}</div>
                    <div className="text-xs" style={{ color: "var(--muted-2)" }}>
                      {s.startTime} – {s.endTime}
                    </div>
                    {s.notes && <div className="text-xs mt-1" style={{ color: "var(--muted-2)" }}>{s.notes}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 font-medium" style={{ background: rc.bg, color: rc.text, borderRadius: "9999px" }}>{s.role}</span>
                    <div className="text-xs" style={{ color: s.clockIn ? "var(--success)" : "var(--muted-2)" }}>
                      {s.clockIn ? "Clocked in" : s.clockOut ? "Done" : "Scheduled"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Staff form */}
      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-md p-6" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
            <h2 className="text-lg font-bold font-display mb-4" style={{ color: "var(--primary)" }}>Add Staff Profile</h2>
            <div className="space-y-3">
              {[{ key: "userId", label: "User ID / Email" }, { key: "pin", label: "PIN (4 digits)" }, { key: "hourlyRate", label: "Hourly Rate" }, { key: "phone", label: "Phone" }].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs uppercase tracking-widest mb-1 font-bold" style={{ color: "var(--muted)" }}>{label}</label>
                  <input type="text" value={(form as any)[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-3 py-2 text-sm"
                    style={{ background: "#fff", border: "1px solid var(--border-strong)", color: "var(--foreground)", borderRadius: "var(--radius)" }} />
                </div>
              ))}
              <div>
                <label className="block text-xs uppercase tracking-widest mb-1 font-bold" style={{ color: "var(--muted)" }}>Role</label>
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as any }))}
                  className="w-full px-3 py-2 text-sm"
                  style={{ background: "#fff", border: "1px solid var(--border-strong)", color: "var(--foreground)", borderRadius: "var(--radius)" }}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 text-sm"
                style={{ background: "var(--surface-container-low)", border: "none", color: "var(--muted-2)", cursor: "pointer", borderRadius: "var(--radius)" }}>Cancel</button>
              <button onClick={() => createStaff.mutate()} disabled={createStaff.isPending}
                className="flex-1 py-2 text-sm font-semibold btn-gradient">
                {createStaff.isPending ? "Saving..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift form */}
      {showShiftForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-md p-6" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
            <h2 className="text-lg font-bold font-display mb-4" style={{ color: "var(--primary)" }}>Add Shift</h2>
            <div className="space-y-3">
              {[{ key: "staffUserId", label: "Staff User ID", type: "text" }, { key: "date", label: "Date", type: "date" }, { key: "startTime", label: "Start Time", type: "time" }, { key: "endTime", label: "End Time", type: "time" }, { key: "notes", label: "Notes", type: "text" }].map(({ key, label, type }) => (
                <div key={key}>
                  <label className="block text-xs uppercase tracking-widest mb-1 font-bold" style={{ color: "var(--muted)" }}>{label}</label>
                  <input type={type} value={(shiftForm as any)[key]} onChange={(e) => setShiftForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-3 py-2 text-sm"
                    style={{ background: "#fff", border: "1px solid var(--border-strong)", color: "var(--foreground)", borderRadius: "var(--radius)" }} />
                </div>
              ))}
              <div>
                <label className="block text-xs uppercase tracking-widest mb-1 font-bold" style={{ color: "var(--muted)" }}>Role</label>
                <select value={shiftForm.role} onChange={(e) => setShiftForm((f) => ({ ...f, role: e.target.value as any }))}
                  className="w-full px-3 py-2 text-sm"
                  style={{ background: "#fff", border: "1px solid var(--border-strong)", color: "var(--foreground)", borderRadius: "var(--radius)" }}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowShiftForm(false)} className="flex-1 py-2 text-sm"
                style={{ background: "var(--surface-container-low)", border: "none", color: "var(--muted-2)", cursor: "pointer", borderRadius: "var(--radius)" }}>Cancel</button>
              <button onClick={() => createShift.mutate()} disabled={createShift.isPending}
                className="flex-1 py-2 text-sm font-semibold btn-gradient">
                {createShift.isPending ? "Saving..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
