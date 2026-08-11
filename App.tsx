import React, { useState, Suspense, lazy } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './store.tsx';
import Sidebar from './components/Sidebar.tsx';
import { Menu } from 'lucide-react';

const Dashboard = lazy(() => import('./pages/Dashboard.tsx'));
const POS = lazy(() => import('./pages/POS.tsx'));
const Inventory = lazy(() => import('./pages/Inventory.tsx'));
const Reservations = lazy(() => import('./pages/Reservations.tsx'));
const AIAgent = lazy(() => import('./pages/AIAgent.tsx'));
const KDS = lazy(() => import('./pages/KDS.tsx'));
const Admin = lazy(() => import('./pages/Admin.tsx'));
const Login = lazy(() => import('./pages/Login.tsx'));

const PageLoader = () => (
  <div className="h-full min-h-[50vh] flex items-center justify-center">
    <div className="w-10 h-10 border-4 border-shift-blue border-t-transparent rounded-full animate-spin" />
  </div>
);

const MobileHeader = ({ onOpen }: { onOpen: () => void }) => (
  <div className="md:hidden flex items-center justify-between p-4 bg-shift-dark text-white sticky top-0 z-30 shadow-md">
    <h1 className="font-bold font-mono text-lg">SHIFT<span className="text-shift-blue">HAPPENS</span></h1>
    <button onClick={onOpen} className="p-2 hover:bg-gray-800 rounded-lg"><Menu /></button>
  </div>
);

function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <AppProvider>
      <HashRouter>
        <div className="flex min-h-screen bg-[#F5F5F5]">
          <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
          <div className="flex-1 flex flex-col w-full overflow-hidden">
            <MobileHeader onOpen={() => setIsMobileMenuOpen(true)} />
            <main className="flex-1 p-4 md:p-8 overflow-y-auto overflow-x-hidden scroll-smooth">
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/pos" element={<POS />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/reservations" element={<Reservations />} />
                  <Route path="/agent" element={<AIAgent />} />
                  <Route path="/kds" element={<KDS />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/login" element={<Login />} />
                </Routes>
              </Suspense>
            </main>
          </div>
        </div>
      </HashRouter>
    </AppProvider>
  );
}

export default App;