import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export default function GuestsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", notes: "", birthday: "", isVip: false });

  const { data } = useQuery({
    queryKey: ["guests", search],
    queryFn: async () => {
      const r = await api.guests.$get({ query: search ? { search } : {} });
      return r.json();
    },
    debounce: 300,
  } as any);

  const create = useMutation({
    mutationFn: async () => {
      const r = await api.guests.$post({ json: form });
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["guests"] }); setShowForm(false); setForm({ firstName: "", lastName: "", email: "", phone: "", notes: "", birthday: "", isVip: false }); },
  });

  const guests: any[] = (data as any)?.guests ?? [];

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold font-display" style={{ color: "var(--primary)" }}>Guest CRM</h1>
        <button onClick={() => setShowForm(true)} className="btn-gradient px-4 py-2 text-sm font-semibold">
          + Add Guest
        </button>
      </div>

      <input
        type="text"
        placeholder="Search guests by name, email or phone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-2 text-sm mb-4"
        style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)", borderRadius: "var(--radius-lg)" }}
      />

      <div className="space-y-2">
        {guests.length === 0 ? (
          <div className="text-center py-12 text-sm" style={{ color: "var(--muted-2)" }}>
            {search ? "No guests found" : "No guests yet. Add your first one!"}
          </div>
        ) : (
          guests.map((g: any) => (
            <div key={g.id} className="p-4 flex items-center justify-between"
              style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
              <div className="flex items-center gap-4">
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
                  style={{ background: "var(--primary)", color: "#fff" }}>
                  {g.firstName[0]}{g.lastName[0]}
                </div>
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    {g.firstName} {g.lastName}
                    {g.isVip && <span className="text-xs px-1.5 py-0.5 font-bold" style={{ background: "var(--accent)", color: "var(--accent-strong)", borderRadius: "var(--radius)" }}>VIP</span>}
                  </div>
                  <div className="text-xs" style={{ color: "var(--muted-2)" }}>
                    {g.email || "—"} {g.phone ? `· ${g.phone}` : ""}
                  </div>
                </div>
              </div>
              <div className="text-right text-xs">
                <div style={{ color: "var(--primary)" }} className="font-semibold">{g.totalVisits} visits</div>
                <div style={{ color: "var(--muted-2)" }}>${parseFloat(g.totalSpend || "0").toFixed(2)} total</div>
                <div style={{ color: "var(--accent-strong)" }}>{g.loyaltyPoints} pts</div>
              </div>
            </div>
          ))
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-md p-6" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
            <h2 className="text-lg font-bold font-display mb-4" style={{ color: "var(--primary)" }}>Add Guest</h2>
            <div className="space-y-3">
              {[
                { key: "firstName", label: "First Name", required: true },
                { key: "lastName", label: "Last Name", required: true },
                { key: "email", label: "Email" },
                { key: "phone", label: "Phone" },
                { key: "birthday", label: "Birthday (MM-DD)" },
                { key: "notes", label: "Notes" },
              ].map(({ key, label, required }) => (
                <div key={key}>
                  <label className="block text-xs uppercase tracking-widest mb-1 font-bold" style={{ color: "var(--muted)" }}>{label}</label>
                  <input
                    type="text"
                    value={(form as any)[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    required={required}
                    className="w-full px-3 py-2 text-sm"
                    style={{ background: "#fff", border: "1px solid var(--border-strong)", color: "var(--foreground)", borderRadius: "var(--radius)" }}
                  />
                </div>
              ))}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isVip} onChange={(e) => setForm((f) => ({ ...f, isVip: e.target.checked }))} />
                <span className="text-sm">VIP Guest</span>
              </label>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2 text-sm"
                style={{ background: "var(--surface-container-low)", border: "none", color: "var(--muted-2)", cursor: "pointer", borderRadius: "var(--radius)" }}>Cancel</button>
              <button onClick={() => create.mutate()} disabled={create.isPending}
                className="flex-1 py-2 text-sm font-semibold btn-gradient">
                {create.isPending ? "Saving..." : "Add Guest"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
