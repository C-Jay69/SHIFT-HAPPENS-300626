import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "../lib/api";
import { authClient } from "../lib/auth";

const MENU_CATEGORIES = ["STARTERS", "MAINS", "DESSERT", "DRINKS", "SPECIALS"] as const;
const STAFF_ROLES = ["admin", "manager", "server", "host"] as const;
const STAFF_STATUSES = ["active", "inactive", "on_leave"] as const;

const TABS = ["analytics", "menu", "orders", "staff", "reservations"] as const;
type Tab = (typeof TABS)[number];

const fmt = (n: number | string | null | undefined) => `$${(Number(n) || 0).toFixed(2)}`;

export default function AdminPage() {
  const qc = useQueryClient();
  const { data: session } = authClient.useSession();
  const [tab, setTab] = useState<Tab>("analytics");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", category: "MAINS" as any, price: "", cost: "", isAvailable: true, isSpecial: false, allergens: "", tags: "" });

  // ─── Analytics queries ───────────────────────────────
  const { data: summary } = useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: async () => { const r = await (api as any).analytics.summary.$get(); return r.json(); },
    enabled: tab === "analytics",
  });
  const { data: revenueData } = useQuery({
    queryKey: ["analytics", "revenue"],
    queryFn: async () => { const r = await (api as any).analytics.revenue.$get({ query: { days: "14" } }); return r.json(); },
    enabled: tab === "analytics",
  });
  const { data: topItemsData } = useQuery({
    queryKey: ["analytics", "top-items"],
    queryFn: async () => { const r = await (api as any).analytics["top-items"].$get({ query: { limit: "8" } }); return r.json(); },
    enabled: tab === "analytics",
  });
  const { data: statusData } = useQuery({
    queryKey: ["analytics", "order-status"],
    queryFn: async () => { const r = await (api as any).analytics["order-status"].$get(); return r.json(); },
    enabled: tab === "analytics",
  });

  // ─── Menu ───────────────────────────────
  const { data: menuData } = useQuery({
    queryKey: ["menu"],
    queryFn: async () => { const r = await api.menu.$get(); return r.json(); },
  });

  // ─── Orders ───────────────────────────────
  const { data: ordersData } = useQuery({
    queryKey: ["orders", "admin"],
    queryFn: async () => { const r = await api.orders.$get(); return r.json(); },
    enabled: tab === "orders",
  });

  // ─── Staff roles ───────────────────────────────
  const { data: staffData } = useQuery({
    queryKey: ["analytics", "staff-roles"],
    queryFn: async () => { const r = await (api as any).analytics["staff-roles"].$get(); return r.json(); },
    enabled: tab === "staff",
  });

  // ─── Reservations overview ───────────────────────────────
  const { data: resOverview } = useQuery({
    queryKey: ["analytics", "reservations-overview"],
    queryFn: async () => { const r = await (api as any).analytics["reservations-overview"].$get(); return r.json(); },
    enabled: tab === "reservations",
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

  const updateStaffRole = useMutation({
    mutationFn: async ({ id, role, status }: { id: number; role?: string; status?: string }) => {
      const r = await (api as any).analytics["staff-roles"][":id"].$put({ param: { id: id.toString() }, json: { role, status } });
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["analytics", "staff-roles"] }),
  });

  const items: any[] = (menuData as any)?.items ?? [];
  const orders: any[] = (ordersData as any)?.orders ?? [];
  const staff: any[] = (staffData as any)?.staff ?? [];
  const upcoming: any[] = (resOverview as any)?.upcoming ?? [];
  const byStatus: any[] = (resOverview as any)?.byStatus ?? [];
  const revenue: any[] = (revenueData as any)?.revenue ?? [];
  const topItems: any[] = (topItemsData as any)?.items ?? [];
  const statuses: any[] = (statusData as any)?.statuses ?? [];
  const kpi = (summary as any) ?? {};

  const exportCSV = () => {
    window.open("/api/analytics/export/orders", "_blank");
  };

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold gradient-text font-mono">Admin Panel</h1>
          <div className="text-xs mt-0.5" style={{ color: "#71717a" }}>Signed in as {session?.user.email}</div>
        </div>
        <div className="flex gap-2">
          {tab === "orders" && (
            <button onClick={exportCSV} className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#f5f5f5", cursor: "pointer" }}>
              ⬇ Export CSV
            </button>
          )}
          {tab === "menu" && (
            <button onClick={() => setShowForm(true)} className="btn-gradient px-4 py-2 rounded-lg text-sm font-semibold">
              + Add Menu Item
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 p-1 rounded-lg overflow-x-auto" style={{ background: "#0a0a0a", width: "fit-content" }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-1.5 rounded text-sm font-mono capitalize whitespace-nowrap"
            style={{ background: tab === t ? "linear-gradient(135deg,#7c3aed,#06b6d4)" : "transparent", color: tab === t ? "#fff" : "#71717a", border: "none", cursor: "pointer" }}>
            {t}
          </button>
        ))}
      </div>

      {/* ─── ANALYTICS ─── */}
      {tab === "analytics" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Total Revenue", value: fmt(kpi.totalRevenue) },
              { label: "Paid Orders", value: kpi.totalOrders ?? 0 },
              { label: "Avg Order Value", value: fmt(kpi.avgOrderValue) },
              { label: "Reservations", value: kpi.totalReservations ?? 0 },
              { label: "Active Staff", value: kpi.activeStaff ?? 0 },
            ].map((k) => (
              <div key={k.label} className="rounded-xl p-4" style={{ background: "#111", border: "1px solid #1e1e1e" }}>
                <div className="text-xs font-mono uppercase tracking-widest mb-1" style={{ color: "#71717a" }}>{k.label}</div>
                <div className="text-lg font-bold gradient-text">{k.value}</div>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl p-4" style={{ background: "#111", border: "1px solid #1e1e1e" }}>
              <h3 className="text-sm font-mono uppercase tracking-widest mb-3" style={{ color: "#71717a" }}>Revenue — Last 14 Days</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={revenue}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                  <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #2a2a2a" }} />
                  <Area type="monotone" dataKey="revenue" stroke="#7c3aed" fill="url(#rev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-xl p-4" style={{ background: "#111", border: "1px solid #1e1e1e" }}>
              <h3 className="text-sm font-mono uppercase tracking-widest mb-3" style={{ color: "#71717a" }}>Top-Selling Items</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topItems} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
                  <XAxis type="number" tick={{ fill: "#71717a", fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fill: "#71717a", fontSize: 10 }} width={100} />
                  <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #2a2a2a" }} />
                  <Bar dataKey="totalQty" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl p-4" style={{ background: "#111", border: "1px solid #1e1e1e" }}>
            <h3 className="text-sm font-mono uppercase tracking-widest mb-3" style={{ color: "#71717a" }}>Order Status Breakdown</h3>
            <div className="flex flex-wrap gap-2">
              {statuses.map((s: any) => (
                <div key={s.status} className="px-3 py-2 rounded-lg text-xs font-mono" style={{ background: "#0a0a0a", border: "1px solid #1e1e1e" }}>
                  <span style={{ color: "#71717a" }} className="capitalize">{s.status}</span>: <span className="gradient-text font-bold">{s.count}</span>
                </div>
              ))}
              {statuses.length === 0 && <div className="text-sm" style={{ color: "#71717a" }}>No orders yet</div>}
            </div>
          </div>
        </div>
      )}

      {/* ─── MENU ─── */}
      {tab === "menu" && (
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
                  <td className="px-4 py-3 font-mono" style={{ color: "#7c3aed" }}>{fmt(item.price)}</td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "#71717a" }}>{item.cost ? fmt(item.cost) : "—"}</td>
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
      )}

      {/* ─── ORDERS ─── */}
      {tab === "orders" && (
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
                  <td className="px-4 py-3 font-mono" style={{ color: "#7c3aed" }}>{fmt(o.total)}</td>
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

      {/* ─── STAFF ROLES ─── */}
      {tab === "staff" && (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #1e1e1e" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#080808", borderBottom: "1px solid #1e1e1e" }}>
                {["Name", "Email", "Role", "Status", "Rate"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-mono uppercase tracking-widest" style={{ color: "#71717a" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((s: any, i: number) => (
                <tr key={s.id} style={{ background: i % 2 === 0 ? "#111" : "#0d0d0d", borderBottom: "1px solid #1a1a1a" }}>
                  <td className="px-4 py-3 font-medium">{s.userName ?? "—"}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "#71717a" }}>{s.userEmail ?? "—"}</td>
                  <td className="px-4 py-3">
                    <select value={s.role} onChange={(e) => updateStaffRole.mutate({ id: s.id, role: e.target.value })}
                      className="text-xs px-2 py-1 rounded font-mono capitalize"
                      style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#f5f5f5" }}>
                      {STAFF_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select value={s.status} onChange={(e) => updateStaffRole.mutate({ id: s.id, status: e.target.value })}
                      className="text-xs px-2 py-1 rounded font-mono capitalize"
                      style={{
                        background: s.status === "active" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                        color: s.status === "active" ? "#22c55e" : "#ef4444",
                        border: "none",
                      }}>
                      {STAFF_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "#71717a" }}>{s.hourlyRate ? fmt(s.hourlyRate) + "/hr" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {staff.length === 0 && <div className="text-center py-8 text-sm" style={{ color: "#71717a" }}>No staff profiles yet</div>}
        </div>
      )}

      {/* ─── RESERVATIONS OVERVIEW ─── */}
      {tab === "reservations" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {byStatus.map((s: any) => (
              <div key={s.status} className="px-3 py-2 rounded-lg text-xs font-mono" style={{ background: "#111", border: "1px solid #1e1e1e" }}>
                <span style={{ color: "#71717a" }} className="capitalize">{s.status}</span>: <span className="gradient-text font-bold">{s.count}</span>
              </div>
            ))}
          </div>
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #1e1e1e" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#080808", borderBottom: "1px solid #1e1e1e" }}>
                  {["Guest", "Date", "Time", "Party", "Table", "Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-mono uppercase tracking-widest" style={{ color: "#71717a" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {upcoming.map((r: any, i: number) => (
                  <tr key={r.id} style={{ background: i % 2 === 0 ? "#111" : "#0d0d0d", borderBottom: "1px solid #1a1a1a" }}>
                    <td className="px-4 py-3 font-medium">{r.guestName}</td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: "#71717a" }}>{r.date}</td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: "#71717a" }}>{r.time}</td>
                    <td className="px-4 py-3">{r.partySize}</td>
                    <td className="px-4 py-3">{r.tableNumber ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-mono capitalize" style={{ background: "rgba(124,58,237,0.15)", color: "#7c3aed" }}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {upcoming.length === 0 && <div className="text-center py-8 text-sm" style={{ color: "#71717a" }}>No upcoming reservations</div>}
          </div>
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
