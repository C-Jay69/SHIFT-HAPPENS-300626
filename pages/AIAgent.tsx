import React, { useState, useEffect } from 'react';
import { generateRestaurantAssistantResponse } from '../services/openrouterService.ts';
import { api } from '../services/api.ts';
import { useAppStore } from '../store.tsx';
import { Bot, Send, Loader2, Sparkles, Phone, PhoneCall, CheckCircle2 } from 'lucide-react';

interface CallLog {
  id: string;
  phone_number: string;
  direction: string;
  outcome: string;
  duration: number;
  created_at: string;
  transcript: string | null;
}

const AIAgent = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{role: 'user' | 'ai', text: string}[]>([
    { role: 'ai', text: "Hello! I'm ShiftBot. Ask me about recipes, inventory, menu items, or hours." }
  ]);
  const [loading, setLoading] = useState(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [calls, setCalls] = useState<CallLog[]>([]);
  const { systemPrompt } = useAppStore();

  useEffect(() => {
    api.get<{ configured: boolean }>('/ai/status')
      .then((s) => setAiConfigured(s.configured))
      .catch(() => setAiConfigured(false));
    api.get<CallLog[]>('/voice/calls')
      .then(setCalls)
      .catch(() => setCalls([]));
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    const responseText = await generateRestaurantAssistantResponse(userMsg, '', systemPrompt);

    setMessages(prev => [...prev, { role: 'ai', text: responseText }]);
    setLoading(false);
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6 h-[calc(100vh-4rem)]">
      <div className="lg:col-span-2 flex flex-col bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-shift-blue to-shift-cyan p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-full backdrop-blur-sm">
              <Sparkles size={24} />
            </div>
            <div>
              <h2 className="font-bold text-xl">AI Manager Assistant</h2>
              <p className="text-sm opacity-90">ShiftBot · OpenRouter + RAG via backend</p>
            </div>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${
            aiConfigured === null ? 'bg-white/20 animate-pulse' :
            aiConfigured ? 'bg-green-500/90' : 'bg-red-500/90'
          }`}>
            {aiConfigured === null ? 'Checking…' : aiConfigured ? 'AI Online' : 'AI Not Configured'}
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

        <div className="p-4 bg-white border-t border-gray-200">
          <div className="flex gap-2">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask about the menu, inventory, or draft a response..."
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

      {/* Call log side panel */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl flex flex-col overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2"><Phone className="text-shift-blue" size={18} /> AI Phone Calls</h3>
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-bold">{calls.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {calls.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-gray-300 space-y-2">
              <PhoneCall size={40} />
              <p className="text-sm">No calls logged yet</p>
              <p className="text-[10px] text-center px-4">Point a Twilio Voice number at POST /api/v1/voice</p>
            </div>
          )}
          {calls.map((call) => (
            <div key={call.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold">{call.phone_number || 'Unknown'}</span>
                <span className="text-[10px] text-gray-400">{new Date(call.created_at).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <CheckCircle2 size={12} className="text-green-600" />
                <span className="text-[10px] font-bold text-green-700 uppercase">{call.outcome?.replace(/_/g, ' ')}</span>
              </div>
              {call.transcript && (
                <p className="text-[10px] text-gray-500 mt-1 line-clamp-3 italic">{call.transcript}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AIAgent;
