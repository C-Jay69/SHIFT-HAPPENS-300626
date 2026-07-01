import { useState, useRef, useEffect } from "react";
import { api } from "../lib/api";

type Message = { role: "user" | "assistant"; content: string };

export default function ShiftBotPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hey, I'm **ShiftBot** — your AI ops assistant. Ask me about active orders, low stock, today's reservations, menu suggestions, or anything else going on in the restaurant." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: userMsg }]);
    setLoading(true);
    try {
      const r = await (api.shiftbot as any).chat.$post({
        json: { prompt: userMsg, messages },
      });
      const data = await r.json();
      setMessages((m) => [...m, { role: "assistant", content: (data as any).reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Error reaching ShiftBot. Check GEMINI_API_KEY." }]);
    } finally {
      setLoading(false);
    }
  }

  function formatMessage(text: string) {
    // Very basic markdown: bold, newlines
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <h1 className="text-xl font-bold font-display" style={{ color: "var(--primary)" }}>ShiftBot 🤖</h1>
        <div className="text-xs mt-0.5" style={{ color: "var(--muted-2)" }}>
          AI Operations Assistant · powered by Gemini · has live restaurant data
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className="max-w-lg px-4 py-3 text-sm leading-relaxed"
              style={
                msg.role === "user"
                  ? { background: "var(--primary)", color: "#fff", borderRadius: "18px 18px 4px 18px" }
                  : { background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)", borderRadius: "18px 18px 18px 4px" }
              }
              dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
            />
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="px-4 py-3 text-sm" style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted-2)", borderRadius: "18px 18px 18px 4px" }}>
              <span className="animate-pulse">ShiftBot is thinking...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="p-4" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask ShiftBot anything about the restaurant..."
            className="flex-1 px-4 py-2.5 text-sm"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)", borderRadius: "var(--radius-lg)" }}
            disabled={loading}
          />
          <button type="submit" disabled={loading || !input.trim()}
            className="px-5 py-2.5 font-semibold text-sm btn-gradient" style={{ borderRadius: "var(--radius-lg)" }}>
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
