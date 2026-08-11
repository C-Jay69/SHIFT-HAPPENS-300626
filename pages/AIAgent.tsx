import React, { useState, useEffect, useCallback } from 'react';
import { generateRestaurantAssistantResponse } from '../services/openrouterService.ts';
import { api } from '../services/api.ts';
import { useAppStore } from '../store.tsx';
import {
  Bot, Send, Loader2, Sparkles, Phone, PhoneCall, CheckCircle2,
  MessageSquare, Database, Trash2, Plus, BookOpen, Radio, RefreshCw, X, Pencil,
} from 'lucide-react';

interface CallLog {
  id: string;
  phone_number: string;
  direction: string;
  outcome: string;
  duration: number;
  created_at: string;
  transcript: string | null;
  reservation_date?: string | null;
  time_slot?: string | null;
  party_size?: number | null;
}

interface KBEntry {
  id: string;
  category: string;
  question: string | null;
  answer: string;
  created_at: string;
}

interface Integration {
  key: string;
  label: string;
  configured: boolean;
  note?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  menu: 'bg-shift-amber/10 text-amber-800 border-shift-amber/30',
  hours: 'bg-shift-cyan/10 text-cyan-800 border-cyan-500/30',
  faq: 'bg-green-50 text-green-700 border-green-300',
  policies: 'bg-red-50 text-red-700 border-red-300',
};

const AIAgent = () => {
  const [tab, setTab] = useState<'chat' | 'phone' | 'kb'>('chat');
  const { systemPrompt } = useAppStore();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-shift-dark">AI Manager</h1>
          <p className="text-gray-500 text-sm">ShiftBot chat, phone agent, and knowledge base</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit shadow-sm">
        {([
          { id: 'chat', icon: MessageSquare, label: 'ShiftBot Chat' },
          { id: 'phone', icon: Phone, label: 'Phone Agent' },
          { id: 'kb', icon: Database, label: 'Knowledge Base' },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              tab === t.id ? 'bg-shift-dark text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'chat' && <ChatTab systemPrompt={systemPrompt} />}
      {tab === 'phone' && <PhoneTab />}
      {tab === 'kb' && <KBTab />}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

const ChatTab = ({ systemPrompt }: { systemPrompt: string }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([
    { role: 'ai', text: "Hello! I'm ShiftBot. Ask me about recipes, inventory, menu items, or hours." }
  ]);
  const [loading, setLoading] = useState(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    api.get<{ configured: boolean }>('/ai/status')
      .then((s) => setAiConfigured(s.configured))
      .catch(() => setAiConfigured(false));
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    // Prefer the backend (RAG + LLM); fall back to the direct client call.
    let responseText = '';
    try {
      const res = await api.post<{ text: string }>('/ai/chat', { message: userMsg, systemPrompt });
      responseText = res.text;
    } catch (e) {
      responseText = await generateRestaurantAssistantResponse(userMsg, '', systemPrompt);
    }
    setMessages(prev => [...prev, { role: 'ai', text: responseText }]);
    setLoading(false);
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="flex flex-col bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden" style={{ height: '60vh' }}>
        <div className="bg-gradient-to-r from-shift-blue to-shift-cyan p-6 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-full backdrop-blur-sm">
              <Sparkles size={24} />
            </div>
            <div>
              <h2 className="font-bold text-xl">ShiftBot Assistant</h2>
              <p className="text-sm opacity-90">RAG over the knowledge base</p>
            </div>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${
            aiConfigured === null ? 'bg-white/20 animate-pulse' :
            aiConfigured ? 'bg-green-500/90' : 'bg-red-500/90'
          }`}>
            {aiConfigured === null ? 'Checking…' : aiConfigured ? 'AI Online' : 'No LLM Key'}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${
                msg.role === 'user'
                  ? 'bg-shift-dark text-white rounded-tr-none'
                  : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'
              }`}>
                {msg.role === 'ai' && <Bot size={16} className="mb-2 text-shift-blue" />}
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white p-4 rounded-2xl border border-gray-200 rounded-tl-none flex items-center gap-2">
                <Loader2 className="animate-spin text-shift-blue" size={16} />
                <span className="text-xs font-bold text-gray-400">Thinking...</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-white border-t border-gray-200 shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask about the menu, inventory, or hours..."
              className="flex-1 bg-gray-100 border-0 rounded-xl px-4 focus:ring-2 focus:ring-shift-blue focus:outline-none"
            />
            <button
              onClick={handleSend}
              disabled={loading}
              className="p-4 bg-shift-blue text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Suggested prompts */}
      <div className="flex flex-col gap-3">
        <h3 className="font-bold text-gray-500 text-sm uppercase tracking-wide">Try asking</h3>
        {[
          'What are tonight\'s specials?',
          'Which ingredients are low?',
          'Do you have gluten-free options?',
          'What are your opening hours?',
          'Can I book a table for 4 at 7pm?',
        ].map((q) => (
          <button
            key={q}
            onClick={() => { setInput(q); }}
            className="text-left p-4 bg-white rounded-xl border border-gray-200 hover:border-shift-blue hover:shadow-sm transition-all text-sm font-bold text-gray-600"
          >
            {q}
          </button>
        ))}
        <div className="p-4 bg-shift-amber/10 border border-shift-amber/30 rounded-xl text-xs text-amber-800">
          <b className="font-bold">RAG pipeline:</b> your question is embedded server-side, matched against
          knowledge_base entries by cosine similarity, then answered by the LLM. Seed it from the
          Knowledge Base tab.
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Phone Agent
// ---------------------------------------------------------------------------

const PhoneTab = () => {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [c, i] = await Promise.all([
      api.get<CallLog[]>('/voice/calls').catch(() => []),
      api.get<Integration[]>('/integrations').catch(() => []),
    ]);
    setCalls(c);
    setIntegrations(i);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const twilio = integrations.find((i) => i.key === 'twilio_voice');
  const voiceReady = twilio?.configured ?? false;

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Config + setup */}
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h3 className="font-bold flex items-center gap-2"><Phone className="text-shift-blue" /> Phone Agent</h3>

          <div className={`rounded-xl p-4 border ${
            voiceReady ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
          }`}>
            <div className="flex items-center gap-2">
              <Radio size={18} className={voiceReady ? 'text-green-600' : 'text-amber-600 animate-pulse'} />
              <span className={`font-bold text-sm ${voiceReady ? 'text-green-700' : 'text-amber-700'}`}>
                {voiceReady ? 'Live & ready' : 'Not configured'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">{twilio?.note ?? 'Set TWILIO_* + STAFF_TRANSFER_NUMBER in .env'}</p>
          </div>

          <div className="text-xs space-y-2 text-gray-500">
            <p className="font-bold uppercase tracking-wide text-gray-400 text-[10px]">What it handles</p>
            <ul className="space-y-1.5">
              {['Answer phone with a natural voice', 'Book reservations by speech', 'Answer menu/hour FAQs via RAG', 'Transfer callers to staff', 'Log transcripts to call_logs'].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-green-500 shrink-0" /> {f}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] font-bold uppercase text-gray-400 mb-1">Setup</p>
            <code className="text-[11px] text-shift-blue break-all">
              Twilio Voice → POST /api/v1/voice
            </code>
            <p className="text-[10px] text-gray-400 mt-1">Webhooks: <code>/api/v1/voice</code> and <code>/api/v1/voice/turn</code></p>
          </div>
        </div>

        {/* Other integrations */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><Bot size={16} className="text-shift-blue" /> AI Stack</h3>
          <div className="space-y-2">
            {integrations.filter((i) => ['llm', 'stripe', 'sendgrid', 'docusign'].includes(i.key)).map((i) => (
              <div key={i.key} className="flex items-center justify-between text-xs">
                <span className="font-bold text-gray-600">{i.label}</span>
                <span className={`px-2 py-0.5 rounded-full font-bold ${
                  i.configured ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                }`}>
                  {i.configured ? 'Configured' : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Call log */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-xl flex flex-col overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2"><PhoneCall className="text-shift-blue" size={18} /> Call Log</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-bold">{calls.length}</span>
            <button onClick={load} className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-100">
              <RefreshCw size={14} className="text-gray-500" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ maxHeight: '50vh' }}>
          {loading && <p className="text-center text-gray-300 text-sm p-8">Loading…</p>}
          {!loading && calls.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-gray-300 space-y-2 py-12">
              <PhoneCall size={40} />
              <p className="text-sm">No calls logged yet</p>
              <p className="text-[10px] text-center px-4">Once Twilio is pointed at /api/v1/voice, every call is logged here with transcript + outcome.</p>
            </div>
          )}
          {calls.map((call) => (
            <div key={call.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold">{call.phone_number || 'Unknown'}</span>
                <span className="text-[10px] text-gray-400">{new Date(call.created_at).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] font-bold uppercase text-green-700">
                  <CheckCircle2 size={11} className="inline mr-1" />
                  {call.outcome?.replace(/_/g, ' ')}
                  {call.reservation_date && ` · ${call.party_size}pp ${call.time_slot}`}
                </span>
                <button
                  onClick={() => setExpanded(expanded === call.id ? null : call.id)}
                  className="text-[10px] font-bold text-shift-blue hover:underline"
                >
                  {call.transcript ? (expanded === call.id ? 'Hide' : 'View transcript') : ''}
                </button>
              </div>
              {expanded === call.id && call.transcript && (
                <pre className="mt-2 p-2 bg-white border border-gray-200 rounded-lg text-[10px] whitespace-pre-wrap text-gray-600 font-mono max-h-40 overflow-y-auto">{call.transcript}</pre>
              )}
              {!call.transcript && <p className="text-[10px] text-gray-400 italic mt-1">No transcript recorded</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Knowledge Base
// ---------------------------------------------------------------------------

const KBTab = () => {
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<KBEntry | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState({ category: 'faq', question: '', answer: '' });

  const load = useCallback(async () => {
    const list = await api.get<KBEntry[]>('/knowledge-base').catch(() => []);
    setEntries(list);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm({ category: 'faq', question: '', answer: '' });
    setShowForm(true);
  };

  const openEdit = (e: KBEntry) => {
    setEditing(e);
    setForm({ category: e.category, question: e.question ?? '', answer: e.answer });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.answer.trim()) return;
    if (editing) {
      await api.patch(`/knowledge-base/${editing.id}`, {
        category: form.category,
        question: form.question || null,
        answer: form.answer,
      }).catch((err) => alert(err.message));
    } else {
      await api.post('/knowledge-base', form).catch((err) => alert(err.message));
    }
    setShowForm(false);
    load();
  };

  const remove = async (id: string) => {
    await api.delete(`/knowledge-base/${id}`).catch((err) => alert(err.message));
    load();
  };

  const ingestMenu = async () => {
    setIngesting(true);
    await api.post<{ ingested: number }>('/knowledge-base/ingest-menu').catch((err) => alert(err.message));
    setIngesting(false);
    load();
  };

  const filtered = entries.filter(
    (e) => e.category.includes(filter.toLowerCase()) || (e.answer + (e.question ?? '')).toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-gray-500">
          Chunks the phone agent & ShiftBot search by embeddings. <b className="font-bold">menu + hours</b> seed automatically.
        </p>
        <div className="flex gap-2 flex-wrap">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter…"
            className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-shift-blue focus:outline-none"
          />
          <button
            onClick={ingestMenu}
            disabled={ingesting}
            className="px-4 py-2 text-sm bg-shift-cyan/10 text-cyan-800 border border-shift-cyan/40 rounded-lg font-bold hover:bg-shift-cyan hover:text-white transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <BookOpen size={14} /> {ingesting ? <Loader2 size={14} className="animate-spin" /> : 'Ingest Menu'}
          </button>
          <button onClick={openNew} className="px-4 py-2 text-sm bg-shift-dark text-white rounded-lg font-bold flex items-center gap-2 hover:bg-black">
            <Plus size={14} /> Add Entry
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((e) => {
          const color = CATEGORY_COLORS[e.category] ?? 'bg-gray-50 text-gray-600 border-gray-200';
          return (
            <div key={e.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${color}`}>{e.category}</span>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(e)} className="p-1.5 rounded-md bg-gray-50 text-gray-400 hover:bg-shift-blue hover:text-white">
                    <Pencil size={11} />
                  </button>
                  <button onClick={() => remove(e.id)} className="p-1.5 rounded-md bg-gray-50 text-gray-400 hover:bg-red-500 hover:text-white">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
              {e.question && <p className="text-sm font-bold text-shift-dark">Q: {e.question}</p>}
              <p className="text-xs text-gray-500 line-clamp-4">{e.answer}</p>
              <p className="text-[10px] text-gray-300 mt-auto pt-1">{new Date(e.created_at).toLocaleDateString()}</p>
            </div>
          );
        })}
        {!loading && filtered.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3 p-12 text-center text-gray-300">
            <Database size={40} className="mx-auto mb-2" />
            <p className="text-sm">No knowledge base entries yet. Ingest the menu or add a QA entry.</p>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">{editing ? 'Edit Entry' : 'Add Knowledge Entry'}</h3>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Category</label>
                <select className="w-full mt-1 p-3 bg-gray-50 border border-gray-200 rounded-xl" value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="menu">menu</option>
                  <option value="hours">hours</option>
                  <option value="faq">faq</option>
                  <option value="policies">policies</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Question (optional)</label>
                <input className="w-full mt-1 p-3 bg-gray-50 border border-gray-200 rounded-xl" value={form.question}
                  onChange={(e) => setForm({ ...form, question: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Answer</label>
              <textarea className="w-full mt-1 p-3 bg-gray-50 border border-gray-200 rounded-xl h-32" value={form.answer}
                onChange={(e) => setForm({ ...form, answer: e.target.value })} />
            </div>
            <button onClick={save} className="w-full py-3 bg-shift-dark text-white font-bold rounded-xl hover:bg-black">
              {editing ? 'Save Changes' : 'Add Entry'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAgent;