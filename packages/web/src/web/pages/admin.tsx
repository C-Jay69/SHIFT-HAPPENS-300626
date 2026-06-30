import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { authClient } from "../lib/auth";

const MENU_CATEGORIES = ["STARTERS", "MAINS", "DESSERT", "DRINKS", "SPECIALS"] as const;

export default function AdminPage() {
  const qc = useQueryClient();
  const { data: session } = authClient.useSession();
  const [tab, setTab] = useState<"menu" | "orders">("menu");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", category: "MAINS" as any, price: "", cost: "", isAvailable: true, isSpecial: false, allergens: "", tags: "" });

  const { data: menuData } = useQuery({
    queryKey: ["menu"],
    queryFn: async () => { const r = await api.menu.$get(); return r.json(); },
  });

  const { data: ordersData } = useQuery({
    queryKey: ["orders", "admin"],
    queryFn: async () => { const r = await api.orders.$get(); return r.json(); },
    enabled: tab === "orders",
  });

  const create = useMutation({
    mutationFn: async () => {
      const r = await api.menu.$post({
        json: {
          ...form,
          allergens: form.allergens ? form.allergens.split(",").map((s) => s.trim()) : [],
          tags: form.tags ? form.tags.split(",").map((s) => s.trim()) : [],
        },
      });
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["menu"] }); setShowForm(false); setForm({ name: "", description: "", category: "MAINS", price: "", cost: "", isAvailable: true, isSpecial: false, allergens: "", tags: "" }); },
  });

  const toggleAvailable = useMutation({
    mutationFn: async ({ id, isAvailable }: { id: number; isAvailable: boolean }) => {
      const r = await api.menu[":id"].$put({ param: { id: id.toString() }, json: { isAvailable } });
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menu"] }),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: number) => {
      const r = await api.menu[":id"].$delete({ param: { id: id.toString() } });
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menu"] }),
  });

  const items: any[] = (menuData as any)?.items ?? [];
  const orders: any[] = (ordersData as any)?.orders ?? [];

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold gradient-text font-mono">Admin Panel</h1>
          <div className="text-xs mt-0.5" style={{ color: "#71717a" }}>Signed in as {session?.user.email}</div>
        </div>
        {tab === "menu" && (
          <button onClick={() => setShowForm(true)} className="btn-gradient px-4 py-2 rounded-lg text-sm font-semibold">
            + Add Menu Item
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ background: "#0a0a0a", width: "fit-content" }}>
        {(["menu", "orders"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded text-sm font-mono capitalize"
            style={{ background: tab === t ? "linear-gradient(135deg,#7c3aed,#06b6d4)" : "transparent", color: tab === t ? "#fff" : "#71717a", border: "none", cursor: "pointer" }}>
            {t}
          </button>
        ))}
      </div>

      {tab === "menu" ? (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #1e1e1e" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#080808", borderBottom: "1px solid #1e1e1e" }}>
                {["Name", "Category", "Price", "Cost", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-mono uppercase tracking-widest" style={{ color: "#71717a" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, i: number) => (
                <tr key={item.id} style={{ background: i % 2 === 0 ? "#111" : "#0d0d0d", borderBottom: "1px solid #1a1a1a" }}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{item.name}</div>
                    {item.description && <div className="text-xs mt-0.5" style={{ color: "#71717a" }}>{item.description.slice(0, 40)}{item.description.length > 40 ? "…" : ""}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "#71717a" }}>{item.category}</td>
                  <td className="px-4 py-3 font-mono" style={{ color: "#7c3aed" }}>${parseFloat(item.price).toFixed(2)}</td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "#71717a" }}>{item.cost ? `$${parseFloat(item.cost).toFixed(2)}` : "—"}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleAvailable.mutate({ id: item.id, isAvailable: !item.isAvailable })}
                      className="text-xs px-2 py-0.5 rounded-full font-mono"
                      style={{
                        background: item.isAvailable ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                        color: item.isAvailable ? "#22c55e" : "#ef4444",
                        border: "none",
                        cursor: "pointer",
                      }}>
                      {item.isAvailable ? "Available" : "86'd"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => { if (confirm(`Delete "${item.name}"?`)) deleteItem.mutate(item.id); }}
                      className="text-xs px-2 py-1 rounded"
                      style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "none", cursor: "pointer" }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <div className="text-center py-8 text-sm" style={{ color: "#71717a" }}>No menu items yet</div>}
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #1e1e1e" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#080808", borderBottom: "1px solid #1e1e1e" }}>
                {["#", "Table", "Total", "Status", "Payment", "Date"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-mono uppercase tracking-widest" style={{ color: "#71717a" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o: any, i: number) => (
                <tr key={o.id} style={{ background: i % 2 === 0 ? "#111" : "#0d0d0d", borderBottom: "1px solid #1a1a1a" }}>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "#71717a" }}>#{o.id}</td>
                  <td className="px-4 py-3">{o.tableNumber ?? "—"}</td>
                  <td className="px-4 py-3 font-mono" style={{ color: "#7c3aed" }}>${parseFloat(o.total).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full font-mono capitalize"
                      style={{ background: "rgba(124,58,237,0.15)", color: "#7c3aed" }}>{o.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "#71717a" }}>{o.paymentMethod ?? "—"}</td>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: "#71717a" }}>
                    {new Date(o.createdAt).toLocaleString("en-MX", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && <div className="text-center py-8 text-sm" style={{ color: "#71717a" }}>No orders yet</div>}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 overflow-y-auto"
          style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-md rounded-2xl p-6 my-4" style={{ background: "#111", border: "1px solid #1e1e1e" }}>
            <h2 className="text-lg font-bold font-mono mb-4 gradient-text">Add Menu Item</h2>
            <div className="space-y-3">
              {[
                { key: "name", label: "Name", required: true },
                { key: "description", label: "Description" },
                { key: "price", label: "Price (MXN)", required: true },
                { key: "cost", label: "Cost / COGS" },
                { key: "allergens", label: "Allergens (comma separated)" },
                { key: "tags", label: "Tags (vegetarian, vegan...)" },
              ].map(({ key, label, required }) => (
                <div key={key}>
                  <label className="block text-xs font-mono uppercase tracking-widest mb-1" style={{ color: "#71717a" }}>{label}</label>
                  <input type="text" value={(form as any)[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    required={required}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#f5f5f5" }} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-mono uppercase tracking-widest mb-1" style={{ color: "#71717a" }}>Category</label>
                <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as any }))}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#f5f5f5" }}>
                  {MENU_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={form.isAvailable} onChange={(e) => setForm((f) => ({ ...f, isAvailable: e.target.checked }))} />
                  Available
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="checkbox" checked={form.isSpecial} onChange={(e) => setForm((f) => ({ ...f, isSpecial: e.target.checked }))} />
                  Daily Special
                </label>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg text-sm"
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
