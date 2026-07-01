import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

const STATUS_ORDER = ["pending", "in_progress", "ready", "served"] as const;
const STATUS_LABELS: Record<string, string> = {
  pending: "PENDING",
  in_progress: "IN KITCHEN",
  ready: "READY",
  served: "SERVED",
};
const STATUS_COLORS: Record<string, { border: string; bg: string; badge: string }> = {
  pending: { border: "#8a6100", bg: "#fff9e8", badge: "#8a6100" },
  in_progress: { border: "#1a1c1c", bg: "#f5f5f5", badge: "#1a1c1c" },
  ready: { border: "#1e7d3c", bg: "#eef8f1", badge: "#1e7d3c" },
  served: { border: "#e0e0e0", bg: "transparent", badge: "#747878" },
};

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

export default function KDSPage() {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["orders", "active"],
    queryFn: async () => { const r = await api.orders.active.$get(); return r.json(); },
    refetchInterval: 8000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const r = await api.orders[":id"].status.$put({
        param: { id: id.toString() },
        json: { status },
      });
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });

  const orders: any[] = (data as any)?.orders ?? [];

  function nextStatus(status: string) {
    const idx = STATUS_ORDER.indexOf(status as any);
    return STATUS_ORDER[Math.min(idx + 1, STATUS_ORDER.length - 1)];
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold font-display" style={{ color: "var(--primary)" }}>Kitchen Display</h1>
        <div className="text-xs" style={{ color: "var(--muted-2)" }}>
          Auto-refreshes every 8s · {orders.length} active
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-24" style={{ color: "var(--muted-2)" }}>
          <div className="text-5xl mb-3">🍳</div>
          <div className="text-sm">Kitchen's clear. Enjoy the calm.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {orders.map((order: any) => {
            const sc = STATUS_COLORS[order.status] ?? STATUS_COLORS.pending;
            const next = nextStatus(order.status);
            return (
              <div
                key={order.id}
                className="p-4 slide-in"
                style={{
                  background: sc.bg,
                  border: `1px solid ${sc.border}`,
                  borderRadius: "var(--radius-lg)",
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-bold text-lg" style={{ color: "var(--primary)" }}>#{order.id}</span>
                    <span className="text-xs ml-2" style={{ color: "var(--muted-2)" }}>
                      Table {order.tableNumber ?? "—"}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className="text-xs px-2 py-0.5 font-medium"
                      style={{ background: "#ffffff", color: sc.badge, borderRadius: "9999px", border: `1px solid ${sc.badge}30` }}
                    >
                      {STATUS_LABELS[order.status]}
                    </span>
                    <span className="text-xs" style={{ color: "var(--muted-2)" }}>
                      {timeAgo(order.createdAt)} ago
                    </span>
                  </div>
                </div>

                {order.kitchenNotes && (
                  <div className="text-xs mb-2 p-2" style={{ background: "var(--warning-bg)", color: "var(--warning)", borderRadius: "var(--radius)" }}>
                    ⚠ {order.kitchenNotes}
                  </div>
                )}

                <div className="text-sm" style={{ color: "var(--muted-2)" }}>
                  {order.notes || "No special notes"}
                </div>

                {order.status !== "served" && (
                  <button
                    onClick={() => updateStatus.mutate({ id: order.id, status: next })}
                    className="w-full mt-3 py-2 text-xs font-bold uppercase tracking-widest transition-all"
                    style={{
                      background: sc.badge === "#1a1c1c" ? "var(--primary)" : "#ffffff",
                      border: `1px solid ${sc.badge}`,
                      color: sc.badge === "#1a1c1c" ? "#ffffff" : sc.badge,
                      cursor: "pointer",
                      borderRadius: "var(--radius)",
                    }}
                  >
                    → {STATUS_LABELS[next]}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
