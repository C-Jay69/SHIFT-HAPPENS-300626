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
  pending: { border: "#f59e0b", bg: "rgba(245,158,11,0.05)", badge: "#f59e0b" },
  in_progress: { border: "#7c3aed", bg: "rgba(124,58,237,0.05)", badge: "#7c3aed" },
  ready: { border: "#22c55e", bg: "rgba(34,197,94,0.05)", badge: "#22c55e" },
  served: { border: "#1e1e1e", bg: "transparent", badge: "#71717a" },
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
        <h1 className="text-xl font-bold gradient-text font-mono">Kitchen Display</h1>
        <div className="text-xs font-mono" style={{ color: "#71717a" }}>
          Auto-refreshes every 8s · {orders.length} active
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-24" style={{ color: "#3f3f3f" }}>
          <div className="text-5xl mb-3">🍳</div>
          <div className="font-mono text-sm">Kitchen's clear. Enjoy the calm.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {orders.map((order: any) => {
            const sc = STATUS_COLORS[order.status] ?? STATUS_COLORS.pending;
            const next = nextStatus(order.status);
            return (
              <div
                key={order.id}
                className="rounded-xl p-4 slide-in"
                style={{
                  background: sc.bg,
                  border: `2px solid ${sc.border}`,
                  borderRadius: "12px",
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-mono font-bold text-lg">#{order.id}</span>
                    <span className="text-xs ml-2" style={{ color: "#71717a" }}>
                      Table {order.tableNumber ?? "—"}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className="text-xs font-mono px-2 py-0.5 rounded-full"
                      style={{ background: `${sc.badge}20`, color: sc.badge }}
                    >
                      {STATUS_LABELS[order.status]}
                    </span>
                    <span className="text-xs font-mono" style={{ color: "#71717a" }}>
                      {timeAgo(order.createdAt)} ago
                    </span>
                  </div>
                </div>

                {order.kitchenNotes && (
                  <div className="text-xs mb-2 p-2 rounded" style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
                    ⚠ {order.kitchenNotes}
                  </div>
                )}

                <div className="text-sm" style={{ color: "#71717a" }}>
                  {order.notes || "No special notes"}
                </div>

                {order.status !== "served" && (
                  <button
                    onClick={() => updateStatus.mutate({ id: order.id, status: next })}
                    className="w-full mt-3 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-widest transition-all"
                    style={{
                      background: `linear-gradient(135deg, ${sc.badge}30, ${sc.badge}15)`,
                      border: `1px solid ${sc.badge}50`,
                      color: sc.badge,
                      cursor: "pointer",
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
