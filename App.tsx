import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './store.tsx';
import AppShell from './components/AppShell.tsx';

const Dashboard = lazy(() => import('./pages/Dashboard.tsx'));
const POS = lazy(() => import('./pages/POS.tsx'));
const Inventory = lazy(() => import('./pages/Inventory.tsx'));
const Reservations = lazy(() => import('./pages/Reservations.tsx'));
const FloorPlan = lazy(() => import('./pages/FloorPlan.tsx'));
const AIAgent = lazy(() => import('./pages/AIAgent.tsx'));
const KDS = lazy(() => import('./pages/KDS.tsx'));
const Admin = lazy(() => import('./pages/Admin.tsx'));
const Login = lazy(() => import('./pages/Login.tsx'));
const Staff = lazy(() => import('./pages/Staff.tsx'));
const Events = lazy(() => import('./pages/Events.tsx'));
const Insights = lazy(() => import('./pages/Insights.tsx'));

const PageLoader = () => (
  <div className="h-full min-h-[50vh] flex items-center justify-center">
    <div className="w-10 h-10 border-4 border-shift-blue border-t-transparent rounded-full animate-spin" />
  </div>
);

function App() {
  return (
    <AppProvider>
      <HashRouter>
        <AppShell>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/pos" element={<POS />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/reservations" element={<Reservations />} />
              <Route path="/floorplan" element={<FloorPlan />} />
              <Route path="/agent" element={<AIAgent />} />
              <Route path="/kds" element={<KDS />} />
              <Route path="/staff" element={<Staff />} />
              <Route path="/events" element={<Events />} />
              <Route path="/insights" element={<Insights />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/login" element={<Login />} />
            </Routes>
          </Suspense>
        </AppShell>
      </HashRouter>
    </AppProvider>
  );
}

export default App;