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
    <div className="min-h-screen flex items-center justify-center p-4 fade-in relative overflow-hidden">
      {/* Ambient background photo */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url(/images/signin-bg.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "brightness(0.35)",
        }}
      />
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(249,249,249,0.95) 0%, rgba(249,249,249,0.88) 100%)" }} />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-4xl font-display font-bold tracking-tight mb-1" style={{ color: "var(--primary)" }}>
            SHIFT HAPPENS!
          </div>
          <div className="text-sm uppercase tracking-widest" style={{ color: "var(--muted-2)" }}>
            Restaurant Operations Platform
          </div>
        </div>

        {/* Card */}
        <div className="p-8" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "0px 20px 40px rgba(0,0,0,0.04)" }}>
          {/* Tabs */}
          <div className="flex mb-6 overflow-hidden" style={{ background: "var(--surface-container-low)", borderRadius: "var(--radius)" }}>
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(""); }}
                className="flex-1 py-2 text-sm font-medium transition-all"
                style={{
                  background: mode === m ? "var(--primary)" : "transparent",
                  color: mode === m ? "#fff" : "var(--muted-2)",
                  border: "none",
                  cursor: "pointer",
                  borderRadius: "var(--radius)",
                }}
              >
                {m === "signin" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="block text-xs uppercase tracking-widest mb-1 font-bold" style={{ color: "var(--muted)" }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Your name"
                  className="w-full px-3 py-2 text-sm outline-none transition-all"
                  style={{ background: "#fff", border: "1px solid var(--border-strong)", color: "var(--foreground)", borderRadius: "var(--radius)" }}
                />
              </div>
            )}
            <div>
              <label className="block text-xs uppercase tracking-widest mb-1 font-bold" style={{ color: "var(--muted)" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@shifthappens.com"
                className="w-full px-3 py-2 text-sm outline-none transition-all"
                style={{ background: "#fff", border: "1px solid var(--border-strong)", color: "var(--foreground)", borderRadius: "var(--radius)" }}
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest mb-1 font-bold" style={{ color: "var(--muted)" }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-3 py-2 text-sm outline-none transition-all"
                style={{ background: "#fff", border: "1px solid var(--border-strong)", color: "var(--foreground)", borderRadius: "var(--radius)" }}
              />
            </div>

            {error && (
              <div className="text-sm px-3 py-2" style={{ background: "var(--danger-bg)", color: "var(--danger)", borderRadius: "var(--radius)" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 font-semibold text-sm btn-gradient mt-2"
            >
              {loading ? "Please wait..." : mode === "signin" ? "Sign In →" : "Create Account →"}
            </button>
          </form>
        </div>

        <div className="text-center mt-4 text-xs" style={{ color: "var(--muted-2)" }}>
          SHIFT HAPPENS! © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
