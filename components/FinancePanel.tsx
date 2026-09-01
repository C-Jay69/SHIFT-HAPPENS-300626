import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api.ts';
import { Wallet, Banknote, Coffee, TrendingUp, Plus, Trash2, RefreshCw, CheckCircle2, X } from 'lucide-react';

interface Payroll {
  staff: { staff_id: string; name: string; role: string; rate: number; scheduled_hours: number; worked_hours: number; tips: number; wages: number; total_comp: number }[];
  totals: { wages: number; tips: number; total: number; scheduled_hours: number };
}
interface Advance { id: string; staff_name: string; amount: string; reason: string | null; status: string; created_at: string }
interface Expense { id: string; category: string; vendor: string | null; amount: string; notes: string | null; created_at: string }

const ADVANCE_STYLE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  repaid: 'bg-green-100 text-green-700',
  rejected: 'bg-gray-100 text-gray-400',
};

const FinancePanel = () => {
  const [payroll, setPayroll] = useState<Payroll | null>(null);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<{ by_category: { category: string; n: number; total: number }[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [advForm, setAdvForm] = useState({ staffId: '', amount: '', reason: '' });
  const [expForm, setExpForm] = useState({ category: 'supplies', vendor: '', amount: '', notes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const [p, a, e, s] = await Promise.all([
      api.get<Payroll>('/finance/payroll-summary?days=14').catch(() => null),
      api.get<Advance[]>('/finance/advances').catch(() => []),
      api.get<Expense[]>('/finance/expenses').catch(() => []),
      api.get<{ by_category: { category: string; n: number; total: number }[] }>('/finance/expense-summary').catch(() => null),
    ]);
    setPayroll(p);
    setAdvances(a);
    setExpenses(e);
    setSummary(s);
    setAdvForm((f) => ({ ...f, staffId: f.staffId || p?.staff?.[0]?.staff_id || '' }));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const requestAdvance = async () => {
    if (!advForm.staffId || !(Number(advForm.amount) > 0)) return alert('Pick a staff member and an amount');
    await api.post('/finance/advances', { staffId: advForm.staffId, amount: Number(advForm.amount), reason: advForm.reason || undefined }).catch((e) => alert((e as Error).message));
    setAdvForm({ ...advForm, amount: '', reason: '' });
    load();
  };

  const advanceAction = async (a: Advance, action: 'approve' | 'reject' | 'repay') => {
    await api.post(`/finance/advances/${a.id}/${action}`).catch((e) => alert((e as Error).message));
    load();
  };

  const addExpense = async () => {
    if (!(Number(expForm.amount) >= 0) || expForm.amount === '') return alert('Enter an amount');
    await api.post('/finance/expenses', {
      category: expForm.category,
      vendor: expForm.vendor || undefined,
      amount: Number(expForm.amount),
      notes: expForm.notes || undefined,
    }).catch((e) => alert((e as Error).message));
    setExpForm({ ...expForm, vendor: '', amount: '', notes: '' });
    load();
  };

  const deleteExpense = async (ex: Expense) => {
    if (!window.confirm('Delete this expense?')) return;
    await api.delete(`/finance/expenses/${ex.id}`).catch((e) => alert((e as Error).message));
    load();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Payroll */}
      <div>
        <h3 className="font-bold text-lg mb-3 flex items-center gap-2"><Wallet size={18} className="text-shift-blue" /> Payroll · last 14 days</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          {[
            { label: 'Wages (scheduled)', value: payroll ? `$${payroll.totals.wages.toLocaleString()}` : '—', icon: Banknote },
            { label: 'Tips (declared)', value: payroll ? `$${payroll.totals.tips.toLocaleString()}` : '—', icon: Coffee },
            { label: 'Total comp', value: payroll ? `$${payroll.totals.total.toLocaleString()}` : '—', icon: TrendingUp },
            { label: 'Scheduled hours', value: payroll ? `${payroll.totals.scheduled_hours}h` : '—', icon: RefreshCw },
          ].map((c) => (
            <div key={c.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
              <c.icon size={18} className="text-shift-blue shrink-0" />
              <div>
                <p className="text-[10px] font-bold uppercase text-gray-400">{c.label}</p>
                <p className="text-xl font-bold">{c.value}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 font-bold">
              <tr><th className="px-4 py-2.5">Staff</th><th className="text-right">Rate</th><th className="text-right">Hours</th><th className="text-right">Wages</th><th className="text-right">Tips</th><th className="text-right">Total</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {payroll?.staff.map((s) => (
                <tr key={s.staff_id}>
                  <td className="px-4 py-2.5 font-bold">{s.name} <span className="text-[10px] text-gray-400 font-normal capitalize">· {s.role}</span></td>
                  <td className="text-right font-mono text-gray-500">${s.rate.toFixed(2)}</td>
                  <td className="text-right font-mono">{s.scheduled_hours}h</td>
                  <td className="text-right font-mono">${s.wages.toFixed(2)}</td>
                  <td className="text-right font-mono text-gray-500">${s.tips.toFixed(2)}</td>
                  <td className="text-right font-mono font-bold">${s.total_comp.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Advances */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-bold flex items-center gap-2"><Banknote size={16} className="text-shift-blue" /> Pay Advances</h3>
            <p className="text-[11px] text-gray-400">Request → approve → repay lifecycle</p>
          </div>
          <div className="p-4 grid grid-cols-3 gap-2 mb-3">
            <select value={advForm.staffId} onChange={(e) => setAdvForm({ ...advForm, staffId: e.target.value })} className="px-2 py-2 text-sm border border-gray-200 rounded-lg">
              {payroll?.staff.map((s) => <option key={s.staff_id} value={s.staff_id}>{s.name}</option>)}
            </select>
            <input type="number" placeholder="Amount" value={advForm.amount} onChange={(e) => setAdvForm({ ...advForm, amount: e.target.value })} className="px-2 py-2 text-sm border border-gray-200 rounded-lg" />
            <button onClick={requestAdvance} className="bg-shift-dark text-white text-sm font-bold rounded-lg hover:bg-black flex items-center justify-center gap-1">
              <Plus size={13} /> Request
            </button>
            <input placeholder="Reason (optional)" value={advForm.reason} onChange={(e) => setAdvForm({ ...advForm, reason: e.target.value })} className="col-span-3 px-2 py-2 text-sm border border-gray-200 rounded-lg" />
          </div>
          <div className="divide-y divide-gray-50">
            {advances.map((a) => (
              <div key={a.id} className="px-4 py-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">{a.staff_name} — ${Number(a.amount).toFixed(2)}</p>
                  <p className="text-[10px] text-gray-400 truncate">{a.reason ?? 'no reason'} · {new Date(a.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ADVANCE_STYLE[a.status]}`}>{a.status.toUpperCase()}</span>
                  {a.status === 'pending' && (
                    <>
                      <button onClick={() => advanceAction(a, 'approve')} className="p-1.5 bg-green-50 text-green-700 rounded-md hover:bg-green-100" title="Approve"><CheckCircle2 size={13} /></button>
                      <button onClick={() => advanceAction(a, 'reject')} className="p-1.5 bg-red-50 text-red-600 rounded-md hover:bg-red-100" title="Reject"><X size={13} /></button>
                    </>
                  )}
                  {a.status === 'approved' && (
                    <button onClick={() => advanceAction(a, 'repay')} className="text-[11px] font-bold px-2 py-1 bg-green-600 text-white rounded-md hover:bg-green-700">Mark repaid</button>
                  )}
                </div>
              </div>
            ))}
            {advances.length === 0 && <p className="p-6 text-center text-sm text-gray-300">No advances yet.</p>}
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-bold flex items-center gap-2"><TrendingUp size={16} className="text-shift-blue" /> Operating Expenses · last 30d</h3>
            {summary && summary.by_category.length > 0 && (
              <p className="text-[11px] text-gray-400">
                {summary.by_category.map((c) => `${c.category} $${Number(c.total).toFixed(0)}`).join(' · ')}
              </p>
            )}
          </div>
          <div className="p-4 grid grid-cols-4 gap-2 mb-3">
            <select value={expForm.category} onChange={(e) => setExpForm({ ...expForm, category: e.target.value })} className="px-2 py-2 text-sm border border-gray-200 rounded-lg">
              {['supplies', 'utilities', 'maintenance', 'marketing', 'payroll', 'other'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input placeholder="Vendor" value={expForm.vendor} onChange={(e) => setExpForm({ ...expForm, vendor: e.target.value })} className="px-2 py-2 text-sm border border-gray-200 rounded-lg" />
            <input type="number" placeholder="Amount" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} className="px-2 py-2 text-sm border border-gray-200 rounded-lg" />
            <button onClick={addExpense} className="bg-shift-dark text-white text-sm font-bold rounded-lg hover:bg-black flex items-center justify-center gap-1">
              <Plus size={13} /> Add
            </button>
            <input placeholder="Notes" value={expForm.notes} onChange={(e) => setExpForm({ ...expForm, notes: e.target.value })} className="col-span-4 px-2 py-2 text-sm border border-gray-200 rounded-lg" />
          </div>
          <div className="divide-y divide-gray-50">
            {expenses.slice(0, 8).map((ex) => (
              <div key={ex.id} className="px-4 py-2.5 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">{ex.vendor ?? ex.category} <span className="text-[10px] text-gray-400 font-normal">· {ex.category}</span></p>
                  {ex.notes && <p className="text-[10px] text-gray-400 truncate">{ex.notes}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-sm font-bold">${Number(ex.amount).toFixed(2)}</span>
                  <button onClick={() => deleteExpense(ex)} className="p-1 bg-gray-50 text-gray-400 rounded-md hover:bg-red-50 hover:text-red-600"><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
            {expenses.length === 0 && <p className="p-6 text-center text-sm text-gray-300">No expenses recorded yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancePanel;
