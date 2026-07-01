import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "#fff3d6", text: "#8a6100" },
  confirmed: { bg: "#fff3d6", text: "#735c00" },
  seated: { bg: "#e3f5e9", text: "#1e7d3c" },
  completed: { bg: "#eeeeee", text: "#747878" },
  cancelled: { bg: "#ffdad6", text: "#ba1a1a" },
  no_show: { bg: "#ffdad6", text: "#ba1a1a" },
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
        <h1 className="text-xl font-bold font-display" style={{ color: "var(--primary)" }}>Reservations</h1>
        <button onClick={() => setShowForm(true)} className="btn-gradient px-4 py-2 text-sm font-semibold">
          + New Reservation
        </button>
      </div>

      {/* Date picker */}
      <div className="flex items-center gap-2 mb-4">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-3 py-1.5 text-sm"
          style={{ background: "#fff", border: "1px solid var(--border-strong)", color: "var(--foreground)", borderRadius: "var(--radius)" }}
        />
        <span className="text-sm" style={{ color: "var(--muted-2)" }}>{reservations.length} reservation{reservations.length !== 1 ? "s" : ""}</span>
      </div>

      {/* List */}
      <div className="space-y-2">
        {reservations.length === 0 ? (
          <div className="text-center py-12 text-sm" style={{ color: "var(--muted-2)" }}>No reservations for this date</div>
        ) : (
          reservations.map((r: any) => {
            const sc = STATUS_COLORS[r.status] ?? { bg: "#eeeeee", text: "#747878" };
            return (
              <div key={r.id} className="p-4 flex items-center justify-between"
                style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
                <div className="flex items-center gap-4">
                  <div className="text-xl font-bold" style={{ color: "var(--accent-strong)", minWidth: 56 }}>{r.time}</div>
                  <div>
                    <div className="font-semibold">{r.guestName}</div>
                    <div className="text-xs" style={{ color: "var(--muted-2)" }}>
                      Party of {r.partySize} {r.occasion ? `· ${r.occasion}` : ""}
                      {r.specialRequests ? ` · ${r.specialRequests}` : ""}
                    </div>
                    {r.guestPhone && <div className="text-xs" style={{ color: "var(--muted-2)" }}>{r.guestPhone}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 font-medium" style={{ background: sc.bg, color: sc.text, borderRadius: "9999px" }}>
                    {r.status}
                  </span>
                  <select
                    value={r.status}
                    onChange={(e) => updateStatus.mutate({ id: r.id, status: e.target.value })}
                    className="text-xs px-2 py-1"
                    style={{ background: "#fff", border: "1px solid var(--border-strong)", color: "var(--foreground)", borderRadius: "var(--radius)" }}
                  >
                    {["pending", "confirmed", "seated", "completed", "cancelled", "no_show"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New reservation modal */}
      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-md p-6" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
            <h2 className="text-lg font-bold font-display mb-4" style={{ color: "var(--primary)" }}>New Reservation</h2>
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
                  <label className="block text-xs uppercase tracking-widest mb-1 font-bold" style={{ color: "var(--muted)" }}>{label}</label>
                  <input
                    type={type}
                    value={(form as any)[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    required={required}
                    className="w-full px-3 py-2 text-sm"
                    style={{ background: "#fff", border: "1px solid var(--border-strong)", color: "var(--foreground)", borderRadius: "var(--radius)" }}
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs uppercase tracking-widest mb-1 font-bold" style={{ color: "var(--muted)" }}>Party Size</label>
                <input
                  type="number"
                  min={1}
                  value={form.partySize}
                  onChange={(e) => setForm((f) => ({ ...f, partySize: parseInt(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 text-sm"
                  style={{ background: "#fff", border: "1px solid var(--border-strong)", color: "var(--foreground)", borderRadius: "var(--radius)" }}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2 text-sm" style={{ background: "var(--surface-container-low)", border: "none", color: "var(--muted-2)", cursor: "pointer", borderRadius: "var(--radius)" }}>
                Cancel
              </button>
              <button onClick={() => create.mutate()}
                disabled={create.isPending}
                className="flex-1 py-2 text-sm font-semibold btn-gradient">
                {create.isPending ? "Saving..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
