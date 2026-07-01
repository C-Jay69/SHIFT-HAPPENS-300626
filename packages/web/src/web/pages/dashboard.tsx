import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className="p-5" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
      <div className="text-xs uppercase tracking-widest mb-2 font-bold" style={{ color: "var(--muted-2)" }}>{label}</div>
      <div className="text-3xl font-bold font-display" style={{ color: accent ? "var(--accent-strong)" : "var(--primary)" }}>{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color: "var(--muted-2)" }}>{sub}</div>}
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
        <h1 className="text-2xl font-bold font-display" style={{ color: "var(--primary)" }}>Dashboard</h1>
        <div className="text-sm mt-1" style={{ color: "var(--muted-2)" }}>
          {new Date().toLocaleDateString("en-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Orders" value={orders.length} />
        <StatCard label="Pending" value={pending} accent />
        <StatCard label="In Kitchen" value={inProgress} />
        <StatCard label="Ready" value={ready} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Today's reservations */}
        <div className="p-5" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
          <div className="text-xs uppercase tracking-widest mb-3 font-bold" style={{ color: "var(--muted-2)" }}>
            Today's Reservations ({reservations.length})
          </div>
          {reservations.length === 0 ? (
            <div className="text-sm" style={{ color: "var(--muted-2)" }}>No reservations today</div>
          ) : (
            <div className="space-y-2">
              {reservations.slice(0, 5).map((r: any) => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{r.guestName}</span>
                    <span className="ml-2 text-xs" style={{ color: "var(--muted-2)" }}>party of {r.partySize}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium" style={{ color: "var(--accent-strong)" }}>{r.time}</span>
                    <StatusBadge status={r.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low stock */}
        <div className="p-5" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
          <div className="text-xs uppercase tracking-widest mb-3 font-bold" style={{ color: "var(--muted-2)" }}>
            Low Stock Alerts ({lowStockItems.length})
          </div>
          {lowStockItems.length === 0 ? (
            <div className="text-sm" style={{ color: "var(--success)" }}>✓ All stocked up</div>
          ) : (
            <div className="space-y-2">
              {lowStockItems.slice(0, 6).map((i: any) => (
                <div key={i.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{i.name}</span>
                  <span className="text-xs font-medium" style={{ color: "var(--danger)" }}>
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
        <div className="p-5 mt-4" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
          <div className="text-xs uppercase tracking-widest mb-3 font-bold" style={{ color: "var(--muted-2)" }}>
            Active Orders
          </div>
          <div className="space-y-2">
            {orders.map((o: any) => (
              <div key={o.id} className="flex items-center justify-between text-sm py-1"
                style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={{ color: "var(--muted-2)" }}>#{o.id}</span>
                  <span>Table {o.tableNumber ?? "—"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold" style={{ color: "var(--primary)" }}>
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
    pending: { bg: "var(--warning-bg)", text: "var(--warning)" },
    in_progress: { bg: "#eeeeee", text: "#1a1c1c" },
    ready: { bg: "var(--success-bg)", text: "var(--success)" },
    served: { bg: "#fff3d6", text: "#735c00" },
    paid: { bg: "var(--success-bg)", text: "var(--success)" },
    confirmed: { bg: "#fff3d6", text: "#735c00" },
    cancelled: { bg: "var(--danger-bg)", text: "var(--danger)" },
    no_show: { bg: "var(--danger-bg)", text: "var(--danger)" },
    seated: { bg: "var(--success-bg)", text: "var(--success)" },
  };
  const c = colors[status] ?? { bg: "var(--surface-container-low)", text: "var(--muted-2)" };
  return (
    <span className="text-xs px-2 py-0.5 font-medium capitalize" style={{ background: c.bg, color: c.text, borderRadius: "9999px" }}>
      {status.replace("_", " ")}
    </span>
  );
}
