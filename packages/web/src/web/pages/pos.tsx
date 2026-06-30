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
          <h1 className="text-xl font-bold gradient-text font-mono">Point of Sale</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-mono" style={{ color: "#71717a" }}>Table:</span>
            <input
              type="number"
              value={tableNumber}
              onChange={(e) => setTableNumber(parseInt(e.target.value) || 1)}
              className="w-16 text-sm px-2 py-1 rounded"
              style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#f5f5f5" }}
            />
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 mb-3 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className="px-3 py-1 rounded-lg text-xs font-mono uppercase tracking-widest transition-all"
              style={{
                background: category === cat ? "linear-gradient(135deg,#7c3aed,#06b6d4)" : "#1e1e1e",
                color: category === cat ? "#fff" : "#71717a",
                border: "none",
                cursor: "pointer",
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
                className="p-3 rounded-xl text-left transition-all hover:scale-[1.02]"
                style={{
                  background: "#111",
                  border: "1px solid #1e1e1e",
                  cursor: "pointer",
                  color: "#f5f5f5",
                }}
              >
                <div className="font-medium text-sm truncate">{item.name}</div>
                <div className="text-xs mt-1" style={{ color: "#71717a" }}>{item.category}</div>
                <div className="font-mono font-bold mt-1" style={{ color: "#7c3aed" }}>
                  ${parseFloat(item.price).toFixed(2)}
                </div>
              </button>
            ))}
          </div>
          {available.length === 0 && (
            <div className="text-center py-12 text-sm" style={{ color: "#71717a" }}>
              No items in this category
            </div>
          )}
        </div>
      </div>

      {/* Cart panel */}
      <div className="w-72 flex flex-col" style={{ background: "#080808", borderLeft: "1px solid #1e1e1e" }}>
        <div className="p-4" style={{ borderBottom: "1px solid #1e1e1e" }}>
          <div className="text-sm font-mono font-bold" style={{ color: "#71717a" }}>ORDER CART</div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 && (
            <div className="text-center py-8 text-xs" style={{ color: "#3f3f3f" }}>
              Tap items to add
            </div>
          )}
          {cart.map((item) => (
            <div key={item.menuItemId} className="rounded-lg p-2" style={{ background: "#111", border: "1px solid #1e1e1e" }}>
              <div className="flex items-start justify-between">
                <div className="text-sm font-medium flex-1 truncate">{item.name}</div>
                <button onClick={() => removeFromCart(item.menuItemId)}
                  style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>✕</button>
              </div>
              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(item.menuItemId, item.quantity - 1)}
                    className="w-5 h-5 rounded text-xs"
                    style={{ background: "#1e1e1e", border: "none", color: "#f5f5f5", cursor: "pointer" }}>−</button>
                  <span className="text-xs font-mono px-1">{item.quantity}</span>
                  <button onClick={() => updateQty(item.menuItemId, item.quantity + 1)}
                    className="w-5 h-5 rounded text-xs"
                    style={{ background: "#1e1e1e", border: "none", color: "#f5f5f5", cursor: "pointer" }}>+</button>
                </div>
                <span className="text-xs font-mono" style={{ color: "#7c3aed" }}>
                  ${(item.unitPrice * item.quantity).toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Totals + checkout */}
        <div className="p-4" style={{ borderTop: "1px solid #1e1e1e" }}>
          <div className="space-y-1 text-xs font-mono mb-3">
            <div className="flex justify-between"><span style={{ color: "#71717a" }}>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span style={{ color: "#71717a" }}>IVA 16%</span><span>${tax.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm font-bold mt-1">
              <span>TOTAL</span><span style={{ color: "#7c3aed" }}>${total.toFixed(2)}</span>
            </div>
          </div>

          <textarea
            placeholder="Notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full text-xs px-2 py-1 rounded mb-2 resize-none"
            style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#f5f5f5" }}
          />

          <div className="flex gap-1 mb-2">
            {(["cash", "card"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setPayMethod(m)}
                className="flex-1 py-1 text-xs rounded font-mono uppercase"
                style={{
                  background: payMethod === m ? "linear-gradient(135deg,#7c3aed,#06b6d4)" : "#1e1e1e",
                  color: payMethod === m ? "#fff" : "#71717a",
                  border: "none",
                  cursor: "pointer",
                }}
              >{m}</button>
            ))}
          </div>

          <button
            disabled={cart.length === 0 || createOrder.isPending}
            onClick={() => createOrder.mutate()}
            className="w-full py-2.5 rounded-lg font-semibold text-sm btn-gradient"
          >
            {createOrder.isPending ? "Processing..." : `PAY $${total.toFixed(2)}`}
          </button>

          {orderSuccess && (
            <div className="text-center text-xs mt-2 py-1 rounded" style={{ color: "#22c55e", background: "rgba(34,197,94,0.1)" }}>
              ✓ Order placed!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
