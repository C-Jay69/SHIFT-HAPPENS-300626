import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api.ts';
import { Truck, Plus, Trash2, RefreshCw, Package, Send, CheckCircle2, X } from 'lucide-react';

interface Supplier { id: string; name: string; contact_email: string | null; contact_phone: string | null; category: string | null; product_count: number; carried_ingredients: number }
interface Product { id: string; name: string; unit: string; unit_cost: number; min_order: number }
interface CompareRow { id: string; name: string; unit: string; stock: number; threshold: number; best_supplier: string; best_price: number; best_lead_days: number; sources: number }
interface Order { id: string; supplier_name: string; status: string; items: { name: string; qty: number; unit: string; unit_cost: number }[]; total: number; created_at: string; notes: string | null }

const OrderList = ({ orders, onReceive, onCancel }: { orders: Order[]; onReceive: (o: Order) => void; onCancel: (o: Order) => void }) => (
  <div className="space-y-2">
    {orders.map((o) => (
      <div key={o.id} className="border border-gray-100 rounded-xl p-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm">
            <span className="font-bold">{o.supplier_name}</span>
            <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${
              o.status === 'received' ? 'bg-green-100 text-green-700' : o.status === 'cancelled' ? 'bg-gray-100 text-gray-400' : 'bg-amber-100 text-amber-700'
            }`}>{o.status.toUpperCase()}</span>
            <span className="ml-2 font-mono font-bold text-shift-blue">${Number(o.total).toFixed(2)}</span>
          </div>
          {o.status === 'sent' && (
            <div className="flex gap-1.5">
              <button onClick={() => onReceive(o)} className="flex items-center gap-1 px-2.5 py-1.5 bg-green-600 text-white text-[11px] font-bold rounded-lg hover:bg-green-700">
                <CheckCircle2 size={11} /> Receive (auto-stock)
              </button>
              <button onClick={() => onCancel(o)} className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 text-gray-500 text-[11px] font-bold rounded-lg hover:bg-gray-50">
                <X size={11} /> Cancel
              </button>
            </div>
          )}
        </div>
        <p className="text-[11px] text-gray-400 mt-1">{(o.items ?? []).map((i) => `${i.qty}${i.unit} ${i.name}`).join(' · ')} · {new Date(o.created_at).toLocaleDateString()}</p>
      </div>
    ))}
    {orders.length === 0 && <p className="text-sm text-gray-300 text-center py-4">No purchase orders yet.</p>}
  </div>
);

const VendorsPanel = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [compare, setCompare] = useState<CompareRow[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [supForm, setSupForm] = useState({ name: '', category: '', email: '' });
  const [prodForm, setProdForm] = useState({ name: '', unit: 'kg', unitCost: '', minOrder: '' });
  const [orderItems, setOrderItems] = useState<Record<string, string>>({}); // productId -> qty

  const load = useCallback(async () => {
    setLoading(true);
    const [s, c, o] = await Promise.all([
      api.get<Supplier[]>('/vendors').catch(() => []),
      api.get<CompareRow[]>('/vendors/compare').catch(() => []),
      api.get<Order[]>('/vendors/orders').catch(() => []),
    ]);
    setSuppliers(s);
    setCompare(c);
    setOrders(o);
    if (!selected && s.length) setSelected(s[0].id);
    setLoading(false);
  }, [selected]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selected) { setProducts([]); return; }
    api.get<Product[]>(`/vendors/${selected}/products`).then(setProducts).catch(() => setProducts([]));
  }, [selected]);

  const addSupplier = async () => {
    if (supForm.name.trim().length < 2) return alert('Name the supplier');
    await api.post('/vendors', { name: supForm.name, category: supForm.category || null, contactEmail: supForm.email || undefined }).catch((e) => alert((e as Error).message));
    setSupForm({ name: '', category: '', email: '' });
    load();
  };

  const addProduct = async () => {
    if (!selected || prodForm.name.trim().length < 1) return alert('Name the product');
    await api.post(`/vendors/${selected}/products`, {
      name: prodForm.name,
      unit: prodForm.unit,
      unitCost: Number(prodForm.unitCost || 0),
      minOrder: Number(prodForm.minOrder || 0),
    }).catch((e) => alert((e as Error).message));
    setProdForm({ name: '', unit: 'kg', unitCost: '', minOrder: '' });
    load();
  };

  const placeOrder = async () => {
    if (!selected) return;
    const items = Object.entries(orderItems)
      .filter(([, q]) => Number(q) > 0)
      .map(([productId, qty]) => ({ productId, qty: Number(qty) }));
    if (!items.length) return alert('Add at least one line item with a quantity');
    await api.post('/vendors/orders', { supplierId: selected, items }).catch((e) => alert((e as Error).message));
    setOrderItems({});
    load();
  };

  const receive = async (o: Order) => {
    try {
      const r = await api.post<{ stocked: { name: string; matched: boolean }[] }>(`/vendors/orders/${o.id}/receive`);
      const unmatched = (r.stocked ?? []).filter((s) => !s.matched).map((s) => s.name);
      alert(unmatched.length ? `Order received. No matching ingredient for: ${unmatched.join(', ')}` : 'Order received — stock updated ✓');
    } catch (e) {
      alert((e as Error).message);
    }
    load();
  };

  const cancel = async (o: Order) => {
    if (!window.confirm('Cancel this purchase order?')) return;
    await api.post(`/vendors/orders/${o.id}/cancel`).catch((e) => alert((e as Error).message));
    load();
  };

  const selectedSupplier = suppliers.find((s) => s.id === selected);

  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Suppliers */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold flex items-center gap-2"><Truck size={16} className="text-shift-blue" /> Suppliers</h3>
            <button onClick={load} className="p-1.5 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100">
              {loading ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} className="text-gray-400" />}
            </button>
          </div>
          <div className="space-y-1.5 mb-4">
            {suppliers.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${
                  selected === s.id ? 'border-shift-blue bg-blue-50/50' : 'border-gray-100 hover:bg-gray-50'
                }`}
              >
                <p className="text-sm font-bold">{s.name} {s.category && <span className="text-[10px] text-gray-400 font-normal">· {s.category}</span>}</p>
                <p className="text-[11px] text-gray-400">{s.product_count} products · {s.carried_ingredients} tracked ingredients</p>
              </button>
            ))}
            {suppliers.length === 0 && <p className="text-sm text-gray-300 text-center py-4">No suppliers yet.</p>}
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
            <input placeholder="Supplier name" value={supForm.name} onChange={(e) => setSupForm({ ...supForm, name: e.target.value })} className="col-span-2 px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            <input placeholder="Category (produce…)" value={supForm.category} onChange={(e) => setSupForm({ ...supForm, category: e.target.value })} className="px-2 py-2 text-sm border border-gray-200 rounded-lg" />
            <input placeholder="Email" value={supForm.email} onChange={(e) => setSupForm({ ...supForm, email: e.target.value })} className="px-2 py-2 text-sm border border-gray-200 rounded-lg" />
            <button onClick={addSupplier} className="col-span-2 py-2 bg-shift-dark text-white text-sm font-bold rounded-lg hover:bg-black flex items-center justify-center gap-2">
              <Plus size={14} /> Add Supplier
            </button>
          </div>
        </div>

        {/* Products of selected supplier + order builder */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-bold mb-3 flex items-center gap-2"><Package size={16} className="text-shift-blue" /> {selectedSupplier ? `${selectedSupplier.name} — Products` : 'Products'}</h3>
          <div className="space-y-1.5 mb-4 max-h-56 overflow-y-auto">
            {products.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm border border-gray-100 rounded-lg px-3 py-2">
                <span className="font-bold">{p.name}</span>
                <span className="text-xs text-gray-400 font-mono">${Number(p.unit_cost).toFixed(2)}/{p.unit}{Number(p.min_order) > 0 ? ` · min ${p.min_order}` : ''}</span>
              </div>
            ))}
            {products.length === 0 && selectedSupplier && <p className="text-sm text-gray-300 text-center py-3">No products listed.</p>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Product name" value={prodForm.name} onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })} className="col-span-2 px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            <input placeholder="Unit (kg, ea, L)" value={prodForm.unit} onChange={(e) => setProdForm({ ...prodForm, unit: e.target.value })} className="px-2 py-2 text-sm border border-gray-200 rounded-lg" />
            <input type="number" step="0.01" placeholder="Cost" value={prodForm.unitCost} onChange={(e) => setProdForm({ ...prodForm, unitCost: e.target.value })} className="px-2 py-2 text-sm border border-gray-200 rounded-lg" />
            <input type="number" placeholder="Min order" value={prodForm.minOrder} onChange={(e) => setProdForm({ ...prodForm, minOrder: e.target.value })} className="col-span-2 px-2 py-2 text-sm border border-gray-200 rounded-lg" />
            <button onClick={addProduct} disabled={!selected} className="col-span-2 py-2 bg-shift-blue text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-2">
              <Plus size={14} /> Add Product
            </button>
          </div>

          {products.length > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-3">
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">New Purchase Order</p>
              <div className="space-y-1.5 mb-2">
                {products.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span>{p.name} <span className="text-[10px] text-gray-400">${Number(p.unit_cost).toFixed(2)}/{p.unit}</span></span>
                    <input
                      type="number"
                      min={0}
                      placeholder="qty"
                      value={orderItems[p.id] ?? ''}
                      onChange={(e) => setOrderItems({ ...orderItems, [p.id]: e.target.value })}
                      className="w-20 px-2 py-1 text-sm border border-gray-200 rounded-md text-right"
                    />
                  </div>
                ))}
              </div>
              <button onClick={placeOrder} className="w-full py-2 bg-shift-dark text-white text-sm font-bold rounded-lg hover:bg-black flex items-center justify-center gap-2">
                <Send size={13} /> Send Order — ${Object.entries(orderItems).reduce((a, [id, q]) => a + (Number(q) || 0) * (products.find((p) => p.id === id)?.unit_cost ?? 0), 0).toFixed(2)}
              </button>
            </div>
          )}
        </div>

        {/* Cheapest source */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h3 className="font-bold">Cheapest Source per Ingredient</h3>
            <p className="text-[11px] text-gray-400">Live comparison across supplier pricing & lead times</p>
          </div>
          <table className="w-full text-left">
            <thead className="text-[10px] uppercase text-gray-400 font-bold bg-gray-50">
              <tr><th className="px-4 py-2">Ingredient</th><th className="px-4 py-2">Best supplier</th><th className="text-right">Price</th><th className="text-right">Lead</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {compare.map((c) => (
                <tr key={c.id} className={c.stock <= c.threshold ? 'bg-red-50/40' : ''}>
                  <td className="px-4 py-2.5">
                    <p className="font-bold text-xs">{c.name}</p>
                    <p className="text-[10px] text-gray-400">stock {c.stock} {c.unit}{c.stock <= c.threshold ? ' · LOW' : ''} · {c.sources} source{c.sources === 1 ? '' : 's'}</p>
                  </td>
                  <td className="px-4 py-2.5 text-xs">{c.best_supplier}</td>
                  <td className="text-right font-mono text-xs">${Number(c.best_price).toFixed(2)}</td>
                  <td className="text-right font-mono text-xs text-gray-400">{c.best_lead_days}d</td>
                </tr>
              ))}
              {compare.length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-gray-300 text-sm">
                  Link ingredients to suppliers (ingredient_suppliers) to unlock comparisons.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Orders */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h3 className="font-bold">Purchase Orders</h3>
          <p className="text-[11px] text-gray-400">Receiving an order auto-stocks any matching ingredient (name match) with a purchase audit entry.</p>
        </div>
        <div className="p-5">
          <OrderList orders={orders} onReceive={receive} onCancel={cancel} />
        </div>
      </div>
    </div>
  );
};

export default VendorsPanel;
