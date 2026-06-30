import { useState } from "react";
import { useLocation } from "wouter";
import { authClient, captureToken } from "../lib/auth";

export default function SignInPage() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error: err } = await authClient.signIn.email(
          { email, password },
          { onSuccess: captureToken }
        );
        if (err) throw new Error(err.message);
      } else {
        const { error: err } = await authClient.signUp.email(
          { email, password, name },
          { onSuccess: captureToken }
        );
        if (err) throw new Error(err.message);
      }
      navigate("/");
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 fade-in"
      style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #0f0a1e 100%)" }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-4xl font-bold gradient-text font-mono tracking-tight mb-1">
            SHIFT HAPPENS!
          </div>
          <div className="text-sm uppercase tracking-widest font-mono" style={{ color: "#71717a" }}>
            Restaurant Operations Platform
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8" style={{ background: "#111", border: "1px solid #1e1e1e" }}>
          {/* Tabs */}
          <div className="flex mb-6 rounded-lg overflow-hidden" style={{ background: "#0a0a0a" }}>
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(""); }}
                className="flex-1 py-2 text-sm font-medium transition-all font-mono"
                style={{
                  background: mode === m ? "linear-gradient(135deg, #7c3aed, #06b6d4)" : "transparent",
                  color: mode === m ? "#fff" : "#71717a",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {m === "signin" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="block text-xs font-mono uppercase tracking-widest mb-1" style={{ color: "#71717a" }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Your name"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all"
                  style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#f5f5f5" }}
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest mb-1" style={{ color: "#71717a" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@shifthappens.com"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all"
                style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#f5f5f5" }}
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest mb-1" style={{ color: "#71717a" }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all"
                style={{ background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#f5f5f5" }}
              />
            </div>

            {error && (
              <div className="text-sm px-3 py-2 rounded-lg" style={{ background: "#2a0a0a", color: "#ef4444", border: "1px solid #3f0e0e" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg font-semibold text-sm btn-gradient mt-2"
            >
              {loading ? "Please wait..." : mode === "signin" ? "Sign In →" : "Create Account →"}
            </button>
          </form>
        </div>

        <div className="text-center mt-4 text-xs font-mono" style={{ color: "#3f3f3f" }}>
          SHIFT HAPPENS! © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
