import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  confirmed: "#06b6d4",
  seated: "#22c55e",
  completed: "#71717a",
  cancelled: "#ef4444",
  no_show: "#ef4444",
};

export default function ReservationsPage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ guestName: "", guestPhone: "", guestEmail: "", partySize: 2, date, time: "19:00", specialRequests: "", occasion: "" });

  const { data } = useQuery({
    queryKey: ["reservations", date],
    queryFn: async () => { const r = await api.reservations.$get({ query: { date } }); return r.json(); },
  });

  const create = useMutation({
    mutationFn: async () => {
      const r = await api.reservations.$post({ json: form });
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reservations"] }); setShowForm(false); setForm({ guestName: "", guestPhone: "", guestEmail: "", partySize: 2, date, time: "19:00", specialRequests: "", occasion: "" }); },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const r = await api.reservations[":id"].$put({ param: { id: id.toString() }, json: { status } });
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reservations"] }),
  });

  const reservations: any[] = (data as any)?.reservations ?? [];

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold gradient-text font-mono">Reservations</h1>
        <button onClick={() => setShowForm(true)} className="btn-gradient px-4 py-2 rounded-lg text-sm font-semibold">
          + New Reservation
        </button>
      </div>

      {/* Date picker */}
      <div className="flex items-center gap-2 mb-4">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm"
          style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#f5f5f5" }}
        />
        <span className="text-sm" style={{ color: "#71717a" }}>{reservations.length} reservation{reservations.length !== 1 ? "s" : ""}</span>
      </div>

      {/* List */}
      <div className="space-y-2">
        {reservations.length === 0 ? (
          <div className="text-center py-12 text-sm" style={{ color: "#71717a" }}>No reservations for this date</div>
        ) : (
          reservations.map((r: any) => (
            <div key={r.id} className="rounded-xl p-4 flex items-center justify-between"
              style={{ background: "#111", border: "1px solid #1e1e1e" }}>
              <div className="flex items-center gap-4">
                <div className="font-mono text-xl font-bold" style={{ color: "#06b6d4", minWidth: 56 }}>{r.time}</div>
                <div>
                  <div className="font-semibold">{r.guestName}</div>
                  <div className="text-xs" style={{ color: "#71717a" }}>
                    Party of {r.partySize} {r.occasion ? `· ${r.occasion}` : ""}
                    {r.specialRequests ? ` · ${r.specialRequests}` : ""}
                  </div>
                  {r.guestPhone && <div className="text-xs" style={{ color: "#71717a" }}>{r.guestPhone}</div>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full font-mono"
                  style={{ background: `${STATUS_COLORS[r.status]}20`, color: STATUS_COLORS[r.status] }}>
                  {r.status}
                </span>
                <select
                  value={r.status}
                  onChange={(e) => updateStatus.mutate({ id: r.id, status: e.target.value })}
                  className="text-xs px-2 py-1 rounded"
                  style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#f5f5f5" }}
                >
                  {["pending", "confirmed", "seated", "completed", "cancelled", "no_show"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New reservation modal */}
      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: "#111", border: "1px solid #1e1e1e" }}>
            <h2 className="text-lg font-bold font-mono mb-4 gradient-text">New Reservation</h2>
            <div className="space-y-3">
              {[
                { key: "guestName", label: "Guest Name", type: "text", required: true },
                { key: "guestPhone", label: "Phone", type: "tel" },
                { key: "guestEmail", label: "Email", type: "email" },
                { key: "date", label: "Date", type: "date", required: true },
                { key: "time", label: "Time", type: "time", required: true },
                { key: "occasion", label: "Occasion", type: "text" },
                { key: "specialRequests", label: "Special Requests", type: "text" },
              ].map(({ key, label, type, required }) => (
                <div key={key}>
                  <label className="block text-xs font-mono uppercase tracking-widest mb-1" style={{ color: "#71717a" }}>{label}</label>
                  <input
                    type={type}
                    value={(form as any)[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    required={required}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#f5f5f5" }}
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-mono uppercase tracking-widest mb-1" style={{ color: "#71717a" }}>Party Size</label>
                <input
                  type="number"
                  min={1}
                  value={form.partySize}
                  onChange={(e) => setForm((f) => ({ ...f, partySize: parseInt(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#f5f5f5" }}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-lg text-sm" style={{ background: "#1e1e1e", border: "none", color: "#71717a", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={() => create.mutate()}
                disabled={create.isPending}
                className="flex-1 py-2 rounded-lg text-sm font-semibold btn-gradient">
                {create.isPending ? "Saving..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
