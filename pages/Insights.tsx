import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api.ts';
import {
  DollarSign, Percent, Users, Megaphone, Thermometer, RefreshCw, Loader2,
  Plus, Trash2, X, CheckCircle2, AlertTriangle, Sparkles, Send, Clock,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

type Tab = 'pricing' | 'foodcost' | 'retention' | 'social' | 'haccp';

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size?: number | string; className?: string }> }[] = [
  { id: 'pricing', label: 'Dynamic Pricing', icon: DollarSign },
  { id: 'foodcost', label: 'Food Cost', icon: Percent },
  { id: 'retention', label: 'Retention', icon: Users },
  { id: 'social', label: 'Social', icon: Megaphone },
  { id: 'haccp', label: 'Health & Safety', icon: Thermometer },
];

const Insights = () => {
  const [tab, setTab] = useState<Tab>('pricing');
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-shift-dark">Manager Insights</h1>
        <p className="text-gray-500 text-sm">Pricing power, cost intelligence, team health, social and safety</p>
      </div>
      <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit max-w-full overflow-x-auto shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${
              tab === t.id ? 'bg-shift-dark text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>
      {tab === 'pricing' && <PricingTab />}
      {tab === 'foodcost' && <FoodCostTab />}
      {tab === 'retention' && <RetentionTab />}
      {tab === 'social' && <SocialTab />}
      {tab === 'haccp' && <HaccpTab />}
    </div>
  );
};

// ===========================================================================
// DYNAMIC PRICING
// ===========================================================================

interface QuoteItem { id: string; name: string; base_price: number; effective_price: number; delta: number; applied: { rule_id: string; name: string; multiplier: number; reason: string }[] | null; is_available: boolean }
interface Quote { date: string; time: string; rules_active: number; items: QuoteItem[] }
interface Rule { id: string; name: string; type: string; multiplier: number; config: Record<string, unknown>; active: boolean }
interface Demand { window_days: number; buckets: Record<string, { orders: number; items: number }[]>; top_sellers: { name: string; qty: number }[] }

const PricingTab = () => {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [demand, setDemand] = useState<Demand | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'peak_hours' as Rule['type'], multiplier: 1.2, start: '17:00', end: '21:00', days: '0,1,2,3,4,5,6' });

  const load = useCallback(async () => {
    setLoading(true);
    const [q, d, r] = await Promise.all([
      api.get<Quote>(`/pricing/quote?date=${date}&time=${time}`).catch(() => null),
      api.get<Demand>('/pricing/demand').catch(() => null),
      api.get<Rule[]>('/pricing/rules').catch(() => []),
    ]);
    setQuote(q); setDemand(d); setRules(r);
    setLoading(false);
  }, [date, time]);

  useEffect(() => { load(); }, [load]);

  const addRule = async () => {
    if (!form.name.trim()) return alert('Name the rule');
    const config: Record<string, unknown> = {};
    if (form.type === 'peak_hours' || form.type === 'happy_hour') {
      config.start = form.start; config.end = form.end; config.days = form.days.split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n));
    } else if (form.type === 'weekend') {
      config.days = form.days.split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n));
    }
    await api.post('/pricing/rules', { name: form.name, type: form.type, multiplier: Number(form.multiplier), config }).catch((e) => alert((e as Error).message));
    setForm({ ...form, name: '' });
    load();
  };

  const toggleRule = async (r: Rule) => {
    await api.patch(`/pricing/rules/${r.id}`, { active: !r.active }).catch((e) => alert((e as Error).message));
    load();
  };
  const deleteRule = async (r: Rule) => {
    if (!window.confirm(`Delete rule "${r.name}"?`)) return;
    await api.delete(`/pricing/rules/${r.id}`).catch((e) => alert((e as Error).message));
    load();
  };

  // 30-min buckets across 10:00–23:00, averaged over weekdays present
  const chartData = (() => {
    if (!demand) return [];
    const days = Object.keys(demand.buckets);
    if (!days.length) return [];
    const out: { t: string; orders: number }[] = [];
    for (let b = 20; b < 48; b++) {
      const mins = b * 30;
      const h = Math.floor(mins / 60);
      const label = `${String(h).padStart(2, '0')}:${mins % 60 ? '30' : '00'}`;
      const total = days.reduce((acc, d) => acc + (demand.buckets[d][b]?.orders ?? 0), 0);
      out.push({ t: label, orders: Math.round((total / days.length) * 10) / 10 });
    }
    return out;
  })();

  return (
    <div className="grid lg:grid-cols-5 gap-4">
      <div className="lg:col-span-3 space-y-4">
        {/* Quote */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <h3 className="font-bold">Effective Prices</h3>
            <div className="flex items-center gap-2">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg" />
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            </div>
          </div>
          {loading && <p className="text-sm text-gray-300 p-6 text-center">Loading…</p>}
          {!loading && quote && (
            <table className="w-full text-left">
              <thead className="text-[10px] uppercase text-gray-400 font-bold">
                <tr><th className="py-2">Item</th><th className="text-right">Menu</th><th className="text-right">Effective</th><th className="text-right">Δ</th><th className="pl-3">Rules applied</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm">
                {quote.items.map((it) => (
                  <tr key={it.id} className={!it.is_available ? 'opacity-40' : ''}>
                    <td className="py-2.5 font-bold">{it.name}</td>
                    <td className="text-right font-mono text-gray-400">${it.base_price.toFixed(2)}</td>
                    <td className={`text-right font-mono font-bold ${it.delta > 0 ? 'text-green-600' : it.delta < 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                      ${it.effective_price.toFixed(2)}
                    </td>
                    <td className={`text-right font-mono text-xs ${it.delta !== 0 ? 'text-gray-600' : 'text-gray-300'}`}>
                      {it.delta > 0 ? '+' : ''}{it.delta.toFixed(2)}
                    </td>
                    <td className="pl-3">
                      {it.applied ? (
                        <span className="flex flex-wrap gap-1">
                          {it.applied.map((a) => (
                            <span key={a.rule_id} title={a.reason} className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full">
                              {a.name} ×{a.multiplier}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-300">base</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Demand chart */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-bold mb-1">Demand — paid orders by time slot</h3>
          <p className="text-xs text-gray-400 mb-3">Avg per weekday, last {demand?.window_days ?? 14} days. Use peaks to justify multipliers.</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="t" tick={{ fontSize: 10 }} interval={3} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals />
                <Tooltip />
                <Bar dataKey="orders" fill="#0000FF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {demand && demand.top_sellers.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {demand.top_sellers.slice(0, 5).map((s) => (
                <span key={s.name} className="text-[11px] font-bold bg-gray-50 border border-gray-200 px-2 py-1 rounded-full">
                  {s.name} · {s.qty} sold
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Rules */}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-bold mb-3">Pricing Rules ({rules.filter((r) => r.active).length} active)</h3>
          <div className="space-y-2">
            {rules.map((r) => (
              <div key={r.id} className={`flex items-center justify-between border rounded-xl px-3 py-2.5 ${r.active ? 'border-blue-200 bg-blue-50/40' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
                <div>
                  <p className="text-sm font-bold">{r.name} <span className="text-blue-600">×{r.multiplier}</span></p>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">
                    {r.type}
                    {r.config && r.config.start ? ` · ${r.config.start}–${r.config.end}` : ''}
                    {r.config && r.config.days ? ` · days ${(r.config.days as number[]).map((d) => ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d]).join('')}` : ''}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => toggleRule(r)} className={`p-1.5 rounded-md ${r.active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                    <CheckCircle2 size={14} />
                  </button>
                  <button onClick={() => deleteRule(r)} className="p-1.5 rounded-md bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {rules.length === 0 && <p className="text-sm text-gray-300 text-center py-4">No rules yet — add one below.</p>}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
          <h3 className="font-bold text-sm">New Rule</h3>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Rule name (e.g. Dinner Peak)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="col-span-2 px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Rule['type'] })} className="px-3 py-2 text-sm border border-gray-200 rounded-lg">
              <option value="peak_hours">Peak hours</option>
              <option value="happy_hour">Happy hour (discount)</option>
              <option value="weekend">Weekend</option>
              <option value="low_stock">Low-stock surcharge</option>
            </select>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">×</span>
              <input type="number" step="0.05" min="0.1" max="5" value={form.multiplier} onChange={(e) => setForm({ ...form, multiplier: Number(e.target.value) })} className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg" />
            </div>
            {(form.type === 'peak_hours' || form.type === 'happy_hour') && (
              <>
                <input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className="px-2 py-2 text-sm border border-gray-200 rounded-lg" />
                <input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} className="px-2 py-2 text-sm border border-gray-200 rounded-lg" />
              </>
            )}
            <input placeholder="Days (0=Sun…6=Sat)" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} className="px-2 py-2 text-sm border border-gray-200 rounded-lg" />
          </div>
          <button onClick={addRule} className="w-full py-2.5 bg-shift-blue text-white text-sm font-bold rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
            <Plus size={14} /> Add Rule
          </button>
          {form.type === 'low_stock' && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Applies to any item using an ingredient at/below its reorder threshold — automatic, no config needed.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ===========================================================================
// FOOD COST
// ===========================================================================

interface CostItem { id: string; name: string; price: number; food_cost: number; margin: number; margin_pct: number; cogs_pct: number; status: 'healthy' | 'watch' | 'high'; unit_mismatch: boolean; has_recipe: boolean; is_available: boolean }
interface CostSummary { window_days: number; revenue: number; cogs: number; blended_cogs_pct: number | null; on_hand_value: number; top_waste: { name: string; qty: number; cost: number }[] }
interface Suggestions { target_margin_pct: number; suggestions: { id: string; name: string; current_price: number; food_cost: number; current_margin_pct: number; suggested_price: number; increase: number }[] }

const COST_STATUS: Record<string, string> = {
  healthy: 'bg-green-100 text-green-700',
  watch: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
};

const FoodCostTab = () => {
  const [items, setItems] = useState<CostItem[]>([]);
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [sugg, setSugg] = useState<Suggestions | null>(null);
  const [target, setTarget] = useState(70);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [i, s] = await Promise.all([
      api.get<CostItem[]>('/food-cost/items').catch(() => []),
      api.get<CostSummary>('/food-cost/summary').catch(() => null),
    ]);
    setItems(i); setSummary(s);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadSuggestions = async () => {
    const s = await api.get<Suggestions>(`/food-cost/suggestions?target=${target}`).catch(() => null);
    setSugg(s);
  };

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: `Revenue · last ${summary?.window_days ?? 7}d`, value: summary ? `$${summary.revenue.toLocaleString()}` : '—', accent: 'text-shift-dark' },
          { label: 'COGS (deducted stock)', value: summary ? `$${summary.cogs.toLocaleString()}` : '—', accent: 'text-shift-dark' },
          { label: 'Blended food cost %', value: summary?.blended_cogs_pct != null ? `${summary.blended_cogs_pct}%` : '—', accent: (summary?.blended_cogs_pct ?? 0) > 35 ? 'text-red-600' : 'text-green-600' },
          { label: 'On-hand inventory value', value: summary ? `$${summary.on_hand_value.toLocaleString()}` : '—', accent: 'text-shift-dark' },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <p className="text-[10px] font-bold uppercase text-gray-400">{c.label}</p>
            <p className={`text-2xl font-bold mt-1 ${c.accent}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Item table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold">Per-Item Cost & Margin</h3>
            <button onClick={load} className="p-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} className="text-gray-500" />}
            </button>
          </div>
          <table className="w-full text-left">
            <thead className="text-[10px] uppercase text-gray-400 font-bold bg-gray-50">
              <tr><th className="px-5 py-2.5">Item</th><th className="text-right">Price</th><th className="text-right">Cost</th><th className="text-right">Margin</th><th className="px-5 py-2.5">COGS %</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {items.map((it) => (
                <tr key={it.id} className={!it.is_available ? 'opacity-40' : ''}>
                  <td className="px-5 py-3">
                    <p className="font-bold">{it.name}</p>
                    {!it.has_recipe && <p className="text-[10px] text-gray-300">no recipe — add ingredients for cost tracking</p>}
                    {it.unit_mismatch && <p className="text-[10px] text-amber-600">unit mismatch in recipe</p>}
                  </td>
                  <td className="text-right font-mono">${it.price.toFixed(2)}</td>
                  <td className="text-right font-mono text-gray-500">${it.food_cost.toFixed(2)}</td>
                  <td className={`text-right font-mono font-bold ${it.margin_pct < 60 ? 'text-red-600' : 'text-gray-700'}`}>{it.margin_pct}%</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-100 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${it.status === 'high' ? 'bg-red-500' : it.status === 'watch' ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, it.cogs_pct)}%` }} />
                      </div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${COST_STATUS[it.status]}`}>{it.cogs_pct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Waste + suggestions */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h3 className="font-bold mb-3">Top Waste · last 7d</h3>
            <div className="space-y-2">
              {(summary?.top_waste ?? []).map((w) => (
                <div key={w.name} className="flex justify-between text-sm">
                  <span className="text-gray-600">{w.name}</span>
                  <span className="font-mono font-bold text-red-600">−${w.cost.toFixed(2)}</span>
                </div>
              ))}
              {(summary?.top_waste.length ?? 0) === 0 && <p className="text-sm text-gray-300">No waste recorded this week 🎉</p>}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h3 className="font-bold mb-2">Price Suggestions</h3>
            <div className="flex gap-2 mb-3">
              <input type="number" min="20" max="90" value={target} onChange={(e) => setTarget(Number(e.target.value))} className="w-20 px-2 py-2 text-sm border border-gray-200 rounded-lg" />
              <span className="text-xs text-gray-400 self-center">% target margin</span>
              <button onClick={loadSuggestions} className="ml-auto px-3 py-2 bg-shift-dark text-white text-xs font-bold rounded-lg hover:bg-black">Compute</button>
            </div>
            <div className="space-y-2">
              {sugg?.suggestions.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm border border-gray-100 rounded-lg px-3 py-2">
                  <div>
                    <p className="font-bold">{s.name}</p>
                    <p className="text-[10px] text-gray-400">now {s.current_margin_pct}% margin</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-gray-400 line-through text-xs">${s.current_price.toFixed(2)}</p>
                    <p className="font-mono font-bold text-green-700">${s.suggested_price.toFixed(2)}</p>
                  </div>
                </div>
              ))}
              {sugg && sugg.suggestions.length === 0 && <p className="text-sm text-green-600 font-bold">All items meet the {target}% target 🎯</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ===========================================================================
// RETENTION
// ===========================================================================

interface StaffRisk {
  staff_id: string; name: string; role: string; status: string;
  tenure_days: number | null; weekly_hours_avg: number; longest_streak: number;
  shifts_14d: number; tips_30d: number; tip_trend_pct: number | null; hours_logged_30d: number;
  risk_score: number; risk_level: 'low' | 'medium' | 'high'; factors: string[];
}
interface Retention { as_of: string; staff: StaffRisk[]; aggregate: { headcount: number; at_risk: number; avg_tenure_days: number; avg_risk_score: number } }

const RISK_COLOR: Record<string, string> = {
  low: 'bg-green-500',
  medium: 'bg-amber-500',
  high: 'bg-red-500',
};

const RetentionTab = () => {
  const [data, setData] = useState<Retention | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setData(await api.get<Retention>('/retention/overview').catch(() => null));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Active staff', value: data?.aggregate.headcount ?? '—' },
          { label: 'At risk', value: data?.aggregate.at_risk ?? '—', accent: (data?.aggregate.at_risk ?? 0) > 0 ? 'text-red-600' : 'text-green-600' },
          { label: 'Avg tenure', value: data ? `${data.aggregate.avg_tenure_days}d` : '—' },
          { label: 'Avg risk score', value: data ? `${data.aggregate.avg_risk_score}/100` : '—' },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <p className="text-[10px] font-bold uppercase text-gray-400">{c.label}</p>
            <p className={`text-2xl font-bold mt-1 ${c.accent ?? 'text-shift-dark'}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {loading && <p className="text-sm text-gray-300 text-center py-8">Loading…</p>}
      {!loading && data && (
        <div className="grid md:grid-cols-2 gap-3">
          {data.staff.map((s) => (
            <div key={s.staff_id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-bold">{s.name} {s.status === 'on_leave' && <span className="text-[10px] font-bold text-amber-600">· ON LEAVE</span>}</p>
                  <p className="text-xs text-gray-400 capitalize">{s.role} · tenure {s.tenure_days != null ? `${s.tenure_days}d` : 'n/a'}</p>
                </div>
                <div className="text-center">
                  <p className={`text-2xl font-bold ${s.risk_level === 'high' ? 'text-red-600' : s.risk_level === 'medium' ? 'text-amber-600' : 'text-green-600'}`}>{s.risk_score}</p>
                  <p className="text-[9px] font-bold uppercase text-gray-400">risk</p>
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
                <div className={`h-1.5 rounded-full ${RISK_COLOR[s.risk_level]}`} style={{ width: `${Math.max(4, s.risk_score)}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
                <div className="bg-gray-50 rounded-lg py-2">
                  <p className="font-bold">{s.weekly_hours_avg}h</p>
                  <p className="text-[9px] text-gray-400 uppercase">avg /wk</p>
                </div>
                <div className="bg-gray-50 rounded-lg py-2">
                  <p className="font-bold">{s.longest_streak}d</p>
                  <p className="text-[9px] text-gray-400 uppercase">max streak</p>
                </div>
                <div className="bg-gray-50 rounded-lg py-2">
                  <p className={`font-bold ${s.tip_trend_pct != null && s.tip_trend_pct < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                    {s.tip_trend_pct != null ? `${s.tip_trend_pct > 0 ? '+' : ''}${s.tip_trend_pct}%` : '—'}
                  </p>
                  <p className="text-[9px] text-gray-400 uppercase">tip trend</p>
                </div>
              </div>
              {s.factors.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {s.factors.map((f) => (
                    <span key={f} className="text-[10px] font-bold bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertTriangle size={10} /> {f}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-green-600 font-bold flex items-center gap-1"><CheckCircle2 size={12} /> Healthy signals</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ===========================================================================
// SOCIAL
// ===========================================================================

interface Post { id: string; platform: string; content: string; source: string; status: string; scheduled_at: string | null; published_at: string | null; created_at: string }
interface SocialStats { by_status: Record<string, number>; by_platform: Record<string, number>; next_scheduled: Post | null }

const SocialTab = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState<SocialStats | null>(null);
  const [content, setContent] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, s] = await Promise.all([
      api.get<Post[]>('/social/posts').catch(() => []),
      api.get<SocialStats>('/social/stats').catch(() => null),
    ]);
    setPosts(p); setStats(s);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (content.trim().length < 3) return;
    await api.post('/social/posts', { platform, content }).catch((e) => alert((e as Error).message));
    setContent('');
    load();
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await api.post<{ source: string; posts: Post[] }>('/social/generate', {});
      alert(`${res.source === 'llm' ? 'LLM' : 'Template'} drafts created: ${res.posts.length}`);
    } catch (e) {
      alert((e as Error).message);
    }
    setGenerating(false);
    load();
  };

  const publish = async (p: Post) => {
    await api.post(`/social/posts/${p.id}/publish`, {}).catch((e) => alert((e as Error).message));
    load();
  };
  const remove = async (p: Post) => {
    if (!window.confirm('Delete this post?')) return;
    await api.delete(`/social/posts/${p.id}`).catch((e) => alert((e as Error).message));
    load();
  };

  const STATUS_STYLE: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-500',
    scheduled: 'bg-amber-100 text-amber-700',
    published: 'bg-green-100 text-green-700',
  };

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="space-y-4">
        {/* Composer */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
          <h3 className="font-bold text-sm">Draft Post</h3>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg">
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="x">X / Twitter</option>
            <option value="generic">Generic</option>
          </select>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Tonight's special is…" className="w-full h-24 px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none" />
          <button onClick={create} className="w-full py-2.5 bg-shift-blue text-white text-sm font-bold rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
            <Plus size={14} /> Save Draft
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-bold text-sm mb-2">Auto-Generate</h3>
          <p className="text-xs text-gray-500 mb-3">Drafts 3 posts from tonight's menu, reservations and events. Uses the LLM when configured, templates otherwise.</p>
          <button onClick={generate} disabled={generating} className="w-full py-2.5 bg-shift-dark text-white text-sm font-bold rounded-lg hover:bg-black flex items-center justify-center gap-2 disabled:opacity-50">
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Generate 3 Ideas
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-bold text-sm mb-3">Pipeline</h3>
          <div className="flex gap-2">
            {(['draft', 'scheduled', 'published'] as const).map((s) => (
              <div key={s} className="flex-1 text-center bg-gray-50 rounded-lg py-2">
                <p className="text-lg font-bold">{stats?.by_status?.[s] ?? 0}</p>
                <p className="text-[9px] uppercase font-bold text-gray-400">{s}</p>
              </div>
            ))}
          </div>
          {stats?.next_scheduled && (
            <p className="mt-3 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <Clock size={12} /> Next: {stats.next_scheduled.platform} @ {new Date(stats.next_scheduled.scheduled_at!).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* Feed */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold">Posts</h3>
          <button onClick={load} className="p-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} className="text-gray-500" />}
          </button>
        </div>
        <div className="divide-y divide-gray-50">
          {posts.map((p) => (
            <div key={p.id} className="p-5">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[p.status]}`}>{p.status.toUpperCase()}</span>
                  <span className="text-[10px] text-gray-400 uppercase font-bold">{p.platform}</span>
                  {p.source === 'llm' && <span className="text-[10px] font-bold bg-purple-50 text-purple-600 border border-purple-100 px-1.5 py-0.5 rounded-full">AI</span>}
                  {p.source === 'template' && <span className="text-[10px] font-bold bg-gray-50 text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded-full">TEMPLATE</span>}
                </div>
                <div className="flex gap-1">
                  {p.status !== 'published' && (
                    <button onClick={() => publish(p)} className="flex items-center gap-1 px-2.5 py-1.5 bg-shift-blue text-white text-[11px] font-bold rounded-lg hover:bg-blue-700">
                      <Send size={11} /> Publish
                    </button>
                  )}
                  <button onClick={() => remove(p)} className="p-1.5 bg-gray-50 text-gray-400 rounded-md hover:bg-red-50 hover:text-red-600">
                    <X size={13} />
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-700">{p.content}</p>
              <p className="text-[10px] text-gray-300 mt-1.5">
                {p.published_at ? `Published ${new Date(p.published_at).toLocaleString()}` : p.scheduled_at ? `Scheduled ${new Date(p.scheduled_at).toLocaleString()}` : `Created ${new Date(p.created_at).toLocaleString()}`}
              </p>
            </div>
          ))}
          {posts.length === 0 && (
            <div className="p-12 text-center text-gray-300">
              <Megaphone size={40} className="mx-auto mb-2" />
              <p className="text-sm">No posts yet. Write one or auto-generate 3 ideas.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ===========================================================================
// HEALTH & SAFETY (HACCP)
// ===========================================================================

interface HaccpLog { id: string; type: string; station: string | null; celsius: number | null; status: string; notes: string | null; created_at: string; resolved_at: string | null }
interface HaccpSummary { open_flags: number; threshold_cold_max_c: number; threshold_hot_min_c: number; trend_14d: { day: string; ok: number; flagged: number }[]; recent_logs: HaccpLog[] }

const HaccpTab = () => {
  const [summary, setSummary] = useState<HaccpSummary | null>(null);
  const [form, setForm] = useState({ type: 'temperature' as HaccpLog['type'], station: 'Walk-in fridge', celsius: '', notes: '' });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setSummary(await api.get<HaccpSummary>('/haccp/summary').catch(() => null));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const addLog = async () => {
    await api.post('/haccp/logs', {
      type: form.type,
      station: form.station || null,
      celsius: form.celsius === '' ? null : Number(form.celsius),
      notes: form.notes || null,
    }).catch((e) => alert((e as Error).message));
    setForm({ ...form, celsius: '', notes: '' });
    load();
  };

  const resolve = async (l: HaccpLog) => {
    await api.patch(`/haccp/logs/${l.id}`, { status: 'resolved' }).catch((e) => alert((e as Error).message));
    load();
  };

  const STATUS_STYLE: Record<string, string> = {
    ok: 'bg-green-100 text-green-700',
    flagged: 'bg-red-100 text-red-700',
    resolved: 'bg-gray-100 text-gray-500',
  };

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm">Quick Log</h3>
            <button onClick={load} className="p-1.5 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100">
              {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} className="text-gray-400" />}
            </button>
          </div>
          <div className="space-y-2.5">
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as HaccpLog['type'] })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg">
              <option value="temperature">Temperature check</option>
              <option value="cleaning">Cleaning check</option>
              <option value="incident">Safety incident</option>
            </select>
            <input value={form.station} onChange={(e) => setForm({ ...form, station: e.target.value })} placeholder="Station (e.g. Walk-in fridge, Hot line)" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            {form.type === 'temperature' && (
              <input type="number" step="0.1" value={form.celsius} onChange={(e) => setForm({ ...form, celsius: e.target.value })} placeholder="°C" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            )}
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes (optional)" className="w-full h-14 px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none" />
            <button onClick={addLog} className="w-full py-2.5 bg-shift-dark text-white text-sm font-bold rounded-lg hover:bg-black flex items-center justify-center gap-2">
              <Plus size={14} /> Log It
            </button>
          </div>
          <p className="mt-3 text-[11px] text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
            Auto-flagged out of range: cold &gt; {summary?.threshold_cold_max_c ?? 4} °C · hot &lt; {summary?.threshold_hot_min_c ?? 60} °C
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-bold text-sm mb-2">Open Flags</h3>
          <p className={`text-4xl font-bold ${(summary?.open_flags ?? 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>{summary?.open_flags ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">unresolved temperature / incident items</p>
        </div>
      </div>

      <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h3 className="font-bold">Recent Logs</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {(summary?.recent_logs ?? []).map((l) => (
            <div key={l.id} className="p-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[l.status]}`}>{l.status.toUpperCase()}</span>
                  <span className="text-xs font-bold text-gray-700 uppercase">{l.type}</span>
                  <span className="text-xs text-gray-400">{l.station}</span>
                  {l.celsius != null && <span className="text-xs font-mono font-bold text-shift-blue">{l.celsius} °C</span>}
                </div>
                {l.notes && <p className="text-sm text-gray-600 mt-1">{l.notes}</p>}
                <p className="text-[10px] text-gray-300 mt-1">
                  {new Date(l.created_at).toLocaleString()}
                  {l.resolved_at && ` · resolved ${new Date(l.resolved_at).toLocaleString()}`}
                </p>
              </div>
              {l.status === 'flagged' && (
                <button onClick={() => resolve(l)} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 border border-green-300 text-green-700 text-xs font-bold rounded-lg hover:bg-green-50">
                  <CheckCircle2 size={13} /> Resolve
                </button>
              )}
            </div>
          ))}
          {(summary?.recent_logs.length ?? 0) === 0 && (
            <div className="p-12 text-center text-gray-300">
              <Thermometer size={40} className="mx-auto mb-2" />
              <p className="text-sm">No logs yet. Record your first temperature check.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Insights;
