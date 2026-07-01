import { useState } from "react";
import { Link, useLocation } from "wouter";
import { authClient, clearToken } from "../lib/auth";

const NAV = [
  { path: "/", label: "Dashboard", icon: "⬛" },
  { path: "/pos", label: "POS", icon: "🧾" },
  { path: "/kds", label: "Kitchen", icon: "🍳" },
  { path: "/reservations", label: "Reservations", icon: "📅" },
  { path: "/guests", label: "Guests", icon: "👥" },
  { path: "/inventory", label: "Inventory", icon: "📦" },
  { path: "/staff", label: "Staff", icon: "👷" },
  { path: "/shiftbot", label: "ShiftBot", icon: "🤖" },
  { path: "/admin", label: "Admin", icon: "⚙️" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { data: session } = authClient.useSession();

  async function handleSignOut() {
    await authClient.signOut();
    clearToken();
    window.location.href = "/sign-in";
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--background)" }}>
      {/* Sidebar */}
      <aside
        className="flex flex-col flex-shrink-0 transition-all duration-200"
        style={{
          width: collapsed ? 60 : 220,
          background: "#ffffff",
          borderRight: "1px solid var(--border)",
        }}
      >
        {/* Logo */}
        <div className="flex items-center px-3 py-4" style={{ borderBottom: "1px solid var(--border)", minHeight: 56 }}>
          {!collapsed && (
            <span className="font-bold font-display text-sm tracking-tight" style={{ color: "var(--primary)" }}>
              SHIFT HAPPENS!
            </span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto text-xs p-1 transition-colors"
            style={{ color: "var(--muted-2)", background: "transparent", border: "none", cursor: "pointer", borderRadius: "var(--radius)" }}
          >
            {collapsed ? "→" : "←"}
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV.map(({ path, label, icon }) => {
            const active = location === path || (path !== "/" && location.startsWith(path));
            return (
              <Link key={path} href={path}>
                <div
                  className="flex items-center gap-3 px-3 py-2 mx-2 my-0.5 cursor-pointer transition-all text-sm"
                  style={{
                    background: active ? "#1a1c1c" : "transparent",
                    color: active ? "#ffffff" : "var(--muted-2)",
                    borderRadius: "var(--radius)",
                    borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
                  }}
                >
                  <span className="text-base flex-shrink-0">{icon}</span>
                  {!collapsed && <span className="font-medium truncate">{label}</span>}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-3 py-3" style={{ borderTop: "1px solid var(--border)" }}>
          {!collapsed && session && (
            <div className="text-xs mb-2 truncate" style={{ color: "var(--muted-2)" }}>
              {session.user.name || session.user.email}
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="w-full text-xs py-1.5 transition-colors text-left px-2"
            style={{ background: "var(--surface-container-low)", color: "var(--muted)", border: "none", cursor: "pointer", borderRadius: "var(--radius)" }}
          >
            {collapsed ? "↩" : "Sign Out"}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="h-full fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
