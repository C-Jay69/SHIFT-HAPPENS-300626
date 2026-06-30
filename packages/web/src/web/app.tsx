import { Route, Switch, Redirect } from "wouter";
import { Provider } from "./components/provider";
import { AgentFeedback, RunableBadge } from "@runablehq/website-runtime";
import { authClient } from "./lib/auth";

import SignInPage from "./pages/sign-in";
import Layout from "./components/layout";
import DashboardPage from "./pages/dashboard";
import POSPage from "./pages/pos";
import KDSPage from "./pages/kds";
import ReservationsPage from "./pages/reservations";
import GuestsPage from "./pages/guests";
import InventoryPage from "./pages/inventory";
import StaffPage from "./pages/staff";
import ShiftBotPage from "./pages/shiftbot";
import AdminPage from "./pages/admin";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return (
    <div className="h-screen flex items-center justify-center" style={{ background: "#0a0a0a" }}>
      <div className="text-center">
        <div className="text-2xl font-bold gradient-text font-mono mb-2">SHIFT HAPPENS!</div>
        <div className="text-sm" style={{ color: "#71717a" }}>Loading...</div>
      </div>
    </div>
  );
  if (!session) return <Redirect to="/sign-in" />;
  return <>{children}</>;
}

function App() {
  return (
    <Provider>
      <Switch>
        <Route path="/sign-in" component={SignInPage} />
        <Route>
          <ProtectedRoute>
            <Layout>
              <Switch>
                <Route path="/" component={DashboardPage} />
                <Route path="/pos" component={POSPage} />
                <Route path="/kds" component={KDSPage} />
                <Route path="/reservations" component={ReservationsPage} />
                <Route path="/guests" component={GuestsPage} />
                <Route path="/inventory" component={InventoryPage} />
                <Route path="/staff" component={StaffPage} />
                <Route path="/shiftbot" component={ShiftBotPage} />
                <Route path="/admin" component={AdminPage} />
                <Route>
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="text-6xl font-bold gradient-text font-mono mb-2">404</div>
                      <div style={{ color: "#71717a" }}>Page not found</div>
                    </div>
                  </div>
                </Route>
              </Switch>
            </Layout>
          </ProtectedRoute>
        </Route>
      </Switch>
      {import.meta.env.DEV && <AgentFeedback />}
      {<RunableBadge />}
    </Provider>
  );
}

export default App;
