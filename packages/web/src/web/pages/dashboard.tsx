import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="rounded-xl p-5" style={{ background: "#111", border: "1px solid #1e1e1e" }}>
      <div className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: "#71717a" }}>{label}</div>
      <div className="text-3xl font-bold font-mono" style={{ color }}>{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color: "#71717a" }}>{sub}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const { data: activeOrders } = useQuery({
    queryKey: ["orders", "active"],
    queryFn: async () => {
      const res = await api.orders.active.$get();
      return res.json();
    },
    refetchInterval: 15000,
  });

  const { data: reservationsData } = useQuery({
    queryKey: ["reservations", "today"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const res = await api.reservations.$get({ query: { date: today } });
      return res.json();
    },
  });

  const { data: lowStock } = useQuery({
    queryKey: ["inventory", "low"],
    queryFn: async () => {
      const res = await (api.inventory as any)["low-stock"].$get();
      return res.json();
    },
  });

  const orders = (activeOrders as any)?.orders ?? [];
  const reservations = (reservationsData as any)?.reservations ?? [];
  const lowStockItems = (lowStock as any)?.items ?? [];

  const pending = orders.filter((o: any) => o.status === "pending").length;
  const inProgress = orders.filter((o: any) => o.status === "in_progress").length;
  const ready = orders.filter((o: any) => o.status === "ready").length;

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold gradient-text font-mono">Dashboard</h1>
        <div className="text-sm mt-1" style={{ color: "#71717a" }}>
          {new Date().toLocaleDateString("en-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Orders" value={orders.length} color="#7c3aed" />
        <StatCard label="Pending" value={pending} color="#f59e0b" />
        <StatCard label="In Kitchen" value={inProgress} color="#06b6d4" />
        <StatCard label="Ready" value={ready} color="#22c55e" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Today's reservations */}
        <div className="rounded-xl p-5" style={{ background: "#111", border: "1px solid #1e1e1e" }}>
          <div className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: "#71717a" }}>
            Today's Reservations ({reservations.length})
          </div>
          {reservations.length === 0 ? (
            <div className="text-sm" style={{ color: "#3f3f3f" }}>No reservations today</div>
          ) : (
            <div className="space-y-2">
              {reservations.slice(0, 5).map((r: any) => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{r.guestName}</span>
                    <span className="ml-2 text-xs" style={{ color: "#71717a" }}>party of {r.partySize}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs" style={{ color: "#06b6d4" }}>{r.time}</span>
                    <StatusBadge status={r.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low stock */}
        <div className="rounded-xl p-5" style={{ background: "#111", border: "1px solid #1e1e1e" }}>
          <div className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: "#71717a" }}>
            Low Stock Alerts ({lowStockItems.length})
          </div>
          {lowStockItems.length === 0 ? (
            <div className="text-sm" style={{ color: "#22c55e" }}>✓ All stocked up</div>
          ) : (
            <div className="space-y-2">
              {lowStockItems.slice(0, 6).map((i: any) => (
                <div key={i.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{i.name}</span>
                  <span className="font-mono text-xs" style={{ color: "#ef4444" }}>
                    {i.quantity} {i.unit} left
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active orders list */}
      {orders.length > 0 && (
        <div className="rounded-xl p-5 mt-4" style={{ background: "#111", border: "1px solid #1e1e1e" }}>
          <div className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: "#71717a" }}>
            Active Orders
          </div>
          <div className="space-y-2">
            {orders.map((o: any) => (
              <div key={o.id} className="flex items-center justify-between text-sm py-1"
                style={{ borderBottom: "1px solid #1a1a1a" }}>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs" style={{ color: "#71717a" }}>#{o.id}</span>
                  <span>Table {o.tableNumber ?? "—"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm" style={{ color: "#7c3aed" }}>
                    ${parseFloat(o.total).toFixed(2)}
                  </span>
                  <StatusBadge status={o.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    pending: { bg: "rgba(245,158,11,0.15)", text: "#f59e0b" },
    in_progress: { bg: "rgba(124,58,237,0.15)", text: "#7c3aed" },
    ready: { bg: "rgba(34,197,94,0.15)", text: "#22c55e" },
    served: { bg: "rgba(6,182,212,0.15)", text: "#06b6d4" },
    paid: { bg: "rgba(34,197,94,0.1)", text: "#22c55e" },
    confirmed: { bg: "rgba(6,182,212,0.15)", text: "#06b6d4" },
    cancelled: { bg: "rgba(239,68,68,0.15)", text: "#ef4444" },
    no_show: { bg: "rgba(239,68,68,0.15)", text: "#ef4444" },
    seated: { bg: "rgba(34,197,94,0.15)", text: "#22c55e" },
  };
  const c = colors[status] ?? { bg: "rgba(113,113,122,0.15)", text: "#71717a" };
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-mono capitalize"
      style={{ background: c.bg, color: c.text }}>
      {status.replace("_", " ")}
    </span>
  );
}
