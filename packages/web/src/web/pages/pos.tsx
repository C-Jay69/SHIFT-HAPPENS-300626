import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

const CATEGORIES = ["ALL", "STARTERS", "MAINS", "DESSERT", "DRINKS", "SPECIALS"] as const;

type CartItem = { menuItemId: number; name: string; quantity: number; unitPrice: number; modifiers?: string };

export default function POSPage() {
  const qc = useQueryClient();
  const [category, setCategory] = useState<string>("ALL");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tableNumber, setTableNumber] = useState<number>(1);
  const [notes, setNotes] = useState("");
  const [payMethod, setPayMethod] = useState<"cash" | "card">("cash");
  const [orderSuccess, setOrderSuccess] = useState(false);

  const { data: menuData } = useQuery({
    queryKey: ["menu"],
    queryFn: async () => { const r = await api.menu.$get(); return r.json(); },
  });

  const createOrder = useMutation({
    mutationFn: async () => {
      const r = await api.orders.$post({
        json: {
          tableNumber,
          notes,
          items: cart.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity, modifiers: i.modifiers })),
        },
      });
      return r.json();
    },
    onSuccess: async (data: any) => {
      const orderId = data.order.id;
      // Mark as paid immediately (cash/card)
      await api.orders[":id"].pay.$post({
        param: { id: orderId.toString() },
        json: { method: payMethod, tip: 0 },
      });
      setCart([]);
      setOrderSuccess(true);
      setTimeout(() => setOrderSuccess(false), 3000);
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const items: any[] = (menuData as any)?.items ?? [];
  const filtered = category === "ALL" ? items : items.filter((i: any) => i.category === category);
  const available = filtered.filter((i: any) => i.isAvailable);

  function addToCart(item: any) {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (existing) return prev.map((c) => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menuItemId: item.id, name: item.name, quantity: 1, unitPrice: parseFloat(item.price) }];
    });
  }

  function removeFromCart(menuItemId: number) {
    setCart((prev) => prev.filter((c) => c.menuItemId !== menuItemId));
  }

  function updateQty(menuItemId: number, qty: number) {
    if (qty <= 0) return removeFromCart(menuItemId);
    setCart((prev) => prev.map((c) => c.menuItemId === menuItemId ? { ...c, quantity: qty } : c));
  }

  const subtotal = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0);
  const tax = subtotal * 0.16;
  const total = subtotal + tax;

  return (
    <div className="flex h-full" style={{ maxHeight: "100vh" }}>
      {/* Menu panel */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        <div className="mb-4">
          <h1 className="text-xl font-bold font-display" style={{ color: "var(--primary)" }}>Point of Sale</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs" style={{ color: "var(--muted-2)" }}>Table:</span>
            <input
              type="number"
              value={tableNumber}
              onChange={(e) => setTableNumber(parseInt(e.target.value) || 1)}
              className="w-16 text-sm px-2 py-1"
              style={{ background: "#fff", border: "1px solid var(--border-strong)", color: "var(--foreground)", borderRadius: "var(--radius)" }}
            />
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 mb-3 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className="px-3 py-1 text-xs uppercase tracking-widest transition-all font-medium"
              style={{
                background: category === cat ? "var(--primary)" : "var(--surface-container-low)",
                color: category === cat ? "#fff" : "var(--muted-2)",
                border: "none",
                cursor: "pointer",
                borderRadius: "var(--radius)",
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Menu grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {available.map((item: any) => (
              <button
                key={item.id}
                onClick={() => addToCart(item)}
                className="p-3 text-left transition-all hover:shadow-sm"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                  color: "var(--foreground)",
                  borderRadius: "var(--radius-lg)",
                }}
              >
                <div className="font-medium text-sm truncate">{item.name}</div>
                <div className="text-xs mt-1" style={{ color: "var(--muted-2)" }}>{item.category}</div>
                <div className="font-bold mt-1" style={{ color: "var(--accent-strong)" }}>
                  ${parseFloat(item.price).toFixed(2)}
                </div>
              </button>
            ))}
          </div>
          {available.length === 0 && (
            <div className="text-center py-12 text-sm" style={{ color: "var(--muted-2)" }}>
              No items in this category
            </div>
          )}
        </div>
      </div>

      {/* Cart panel */}
      <div className="w-72 flex flex-col" style={{ background: "#ffffff", borderLeft: "1px solid var(--border)" }}>
        <div className="p-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Order Cart</div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 && (
            <div className="text-center py-8 text-xs" style={{ color: "var(--muted-2)" }}>
              Tap items to add
            </div>
          )}
          {cart.map((item) => (
            <div key={item.menuItemId} className="p-2" style={{ background: "var(--surface-container-low)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
              <div className="flex items-start justify-between">
                <div className="text-sm font-medium flex-1 truncate">{item.name}</div>
                <button onClick={() => removeFromCart(item.menuItemId)}
                  style={{ color: "var(--danger)", background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>✕</button>
              </div>
              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(item.menuItemId, item.quantity - 1)}
                    className="w-5 h-5 text-xs"
                    style={{ background: "#e8e8e8", border: "none", color: "var(--foreground)", cursor: "pointer", borderRadius: "var(--radius)" }}>−</button>
                  <span className="text-xs px-1">{item.quantity}</span>
                  <button onClick={() => updateQty(item.menuItemId, item.quantity + 1)}
                    className="w-5 h-5 text-xs"
                    style={{ background: "#e8e8e8", border: "none", color: "var(--foreground)", cursor: "pointer", borderRadius: "var(--radius)" }}>+</button>
                </div>
                <span className="text-xs font-semibold" style={{ color: "var(--accent-strong)" }}>
                  ${(item.unitPrice * item.quantity).toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Totals + checkout */}
        <div className="p-4" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="space-y-1 text-xs mb-3">
            <div className="flex justify-between"><span style={{ color: "var(--muted-2)" }}>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span style={{ color: "var(--muted-2)" }}>IVA 16%</span><span>${tax.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm font-bold mt-1">
              <span>TOTAL</span><span style={{ color: "var(--primary)" }}>${total.toFixed(2)}</span>
            </div>
          </div>

          <textarea
            placeholder="Notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full text-xs px-2 py-1 mb-2 resize-none"
            style={{ background: "#fff", border: "1px solid var(--border-strong)", color: "var(--foreground)", borderRadius: "var(--radius)" }}
          />

          <div className="flex gap-1 mb-2">
            {(["cash", "card"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setPayMethod(m)}
                className="flex-1 py-1 text-xs uppercase font-medium"
                style={{
                  background: payMethod === m ? "var(--primary)" : "var(--surface-container-low)",
                  color: payMethod === m ? "#fff" : "var(--muted-2)",
                  border: "none",
                  cursor: "pointer",
                  borderRadius: "var(--radius)",
                }}
              >{m}</button>
            ))}
          </div>

          <button
            disabled={cart.length === 0 || createOrder.isPending}
            onClick={() => createOrder.mutate()}
            className="w-full py-2.5 font-semibold text-sm btn-gold"
          >
            {createOrder.isPending ? "Processing..." : `PAY $${total.toFixed(2)}`}
          </button>

          {orderSuccess && (
            <div className="text-center text-xs mt-2 py-1" style={{ color: "var(--success)", background: "var(--success-bg)", borderRadius: "var(--radius)" }}>
              ✓ Order placed!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
