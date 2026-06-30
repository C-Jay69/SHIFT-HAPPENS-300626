import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export default function InventoryPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", unit: "kg", quantity: "", reorderThreshold: "", costPerUnit: "", supplier: "", category: "Produce" });

  const { data } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => { const r = await api.inventory.$get(); return r.json(); },
  });

  const { data: lowData } = useQuery({
    queryKey: ["inventory", "low"],
    queryFn: async () => { const r = await (api.inventory as any)["low-stock"].$get(); return r.json(); },
  });

  const create = useMutation({
    mutationFn: async () => {
      const r = await api.inventory.$post({ json: { ...form, quantity: form.quantity || "0", costPerUnit: form.costPerUnit || null, reorderThreshold: form.reorderThreshold || null } });
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); setShowForm(false); setForm({ name: "", unit: "kg", quantity: "", reorderThreshold: "", costPerUnit: "", supplier: "", category: "Produce" }); },
  });

  const update = useMutation({
    mutationFn: async ({ id, quantity }: { id: number; quantity: string }) => {
      const r = await api.inventory[":id"].$put({ param: { id: id.toString() }, json: { quantity, lastRestocked: new Date().toISOString() } });
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory"] }),
  });

  const all: any[] = (data as any)?.items ?? [];
  const lowStock: any[] = (lowData as any)?.items ?? [];
  const filtered = all.filter((i: any) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.category ?? "").toLowerCase().includes(search.toLowerCase())
  );

  function isLow(item: any) {
    return item.reorderThreshold && parseFloat(item.quantity) <= parseFloat(item.reorderThreshold);
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold gradient-text font-mono">Inventory</h1>
        <button onClick={() => setShowForm(true)} className="btn-gradient px-4 py-2 rounded-lg text-sm font-semibold">
          + Add Item
        </button>
      </div>

      {lowStock.length > 0 && (
        <div className="mb-4 p-3 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
          ⚠ {lowStock.length} item{lowStock.length !== 1 ? "s" : ""} below reorder threshold: {lowStock.map((i: any) => i.name).join(", ")}
        </div>
      )}

      <input
        type="text"
        placeholder="Search inventory..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-2 rounded-xl text-sm mb-4"
        style={{ background: "#111", border: "1px solid #1e1e1e", color: "#f5f5f5" }}
      />

      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #1e1e1e" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#080808", borderBottom: "1px solid #1e1e1e" }}>
              {["Item", "Category", "Qty", "Unit", "Threshold", "Supplier", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-mono uppercase tracking-widest" style={{ color: "#71717a" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((item: any, i: number) => (
              <tr key={item.id} style={{ background: i % 2 === 0 ? "#111" : "#0d0d0d", borderBottom: "1px solid #1a1a1a" }}>
                <td className="px-4 py-3 font-medium">{item.name}</td>
                <td className="px-4 py-3 text-xs" style={{ color: "#71717a" }}>{item.category}</td>
                <td className="px-4 py-3 font-mono" style={{ color: isLow(item) ? "#ef4444" : "#22c55e" }}>
                  {parseFloat(item.quantity).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "#71717a" }}>{item.unit}</td>
                <td className="px-4 py-3 text-xs font-mono" style={{ color: "#71717a" }}>
                  {item.reorderThreshold ?? "—"}
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: "#71717a" }}>{item.supplier ?? "—"}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => {
                      const q = prompt(`New quantity for ${item.name} (currently ${item.quantity} ${item.unit}):`);
                      if (q !== null && !isNaN(parseFloat(q))) update.mutate({ id: item.id, quantity: q });
                    }}
                    className="text-xs px-2 py-1 rounded"
                    style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#71717a", cursor: "pointer" }}
                  >
                    Update
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-sm" style={{ color: "#71717a" }}>No inventory items found</div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: "#111", border: "1px solid #1e1e1e" }}>
            <h2 className="text-lg font-bold font-mono mb-4 gradient-text">Add Inventory Item</h2>
            <div className="space-y-3">
              {[
                { key: "name", label: "Item Name", required: true },
                { key: "unit", label: "Unit (kg, L, each...)" },
                { key: "quantity", label: "Current Quantity" },
                { key: "reorderThreshold", label: "Reorder Threshold" },
                { key: "costPerUnit", label: "Cost Per Unit" },
                { key: "supplier", label: "Supplier" },
                { key: "category", label: "Category" },
              ].map(({ key, label, required }) => (
                <div key={key}>
                  <label className="block text-xs font-mono uppercase tracking-widest mb-1" style={{ color: "#71717a" }}>{label}</label>
                  <input
                    type="text"
                    value={(form as any)[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    required={required}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#f5f5f5" }}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2 rounded-lg text-sm"
                style={{ background: "#1e1e1e", border: "none", color: "#71717a", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => create.mutate()} disabled={create.isPending}
                className="flex-1 py-2 rounded-lg text-sm font-semibold btn-gradient">
                {create.isPending ? "Saving..." : "Add Item"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
