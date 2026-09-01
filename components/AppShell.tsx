import React, { useState, Suspense, lazy, ReactNode } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Menu, X, Bell, BellOff, LogOut, Settings, HelpCircle, ChevronRight, UserCircle, Shield, LayoutDashboard, Utensils, Package, Calendar, Users, ChefHat, Bot, Settings as SettingsIcon, BarChart3, Building2 } from 'lucide-react';
import { useAppStore } from '../store.tsx';
import Sidebar from './Sidebar.tsx';
import RoleSwitcher from './RoleSwitcher.tsx';

const Dashboard = lazy(() => import('../pages/Dashboard.tsx'));
const POS = lazy(() => import('../pages/POS.tsx'));
const Inventory = lazy(() => import('../pages/Inventory.tsx'));
const Reservations = lazy(() => import('../pages/Reservations.tsx'));
const FloorPlan = lazy(() => import('../pages/FloorPlan.tsx'));
const AIAgent = lazy(() => import('../pages/AIAgent.tsx'));
const KDS = lazy(() => import('../pages/KDS.tsx'));
const Staff = lazy(() => import('../pages/Staff.tsx'));
const Events = lazy(() => import('../pages/Events.tsx'));
const Insights = lazy(() => import('../pages/Insights.tsx'));
const Admin = lazy(() => import('../pages/Admin.tsx'));
const Login = lazy(() => import('../pages/Login.tsx'));

const PageLoader = () => (
  <div className="h-full min-h-[50vh] flex items-center justify-center">
    <div className="w-10 h-10 border-4 border-shift-blue border-t-transparent rounded-full animate-spin" />
  </div>
);

const MobileHeader = ({ 
  onOpenSidebar, 
  onOpenUserMenu,
  title 
}: { 
  onOpenSidebar: () => void; 
  onOpenUserMenu: () => void;
  title: string;
}) => (
  <header className="md:hidden flex items-center justify-between p-3 bg-[#0a0a0a] text-white sticky top-0 z-30 shadow-lg border-b border-[#1e1e1e]">
    <button onClick={onOpenSidebar} className="p-2 hover:bg-[#1e1e1e] rounded-lg -ml-1">
      <Menu size={24} />
    </button>
    <h1 className="font-bold font-mono text-lg flex-1 text-center truncate">{title}</h1>
    <button onClick={onOpenUserMenu} className="p-2 hover:bg-[#1e1e1e] rounded-lg -mr-1">
      <UserCircle size={24} />
    </button>
  </header>
);

const TopBar = ({ 
  onOpenSidebar,
  user,
  onLogout,
  onOpenSettings,
  onOpenHelp
}: { 
  onOpenSidebar: () => void;
  user: { name: string; role: string; avatar?: string } | null;
  onLogout: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
}) => (
  <header className="hidden md:flex items-center justify-between h-16 px-6 bg-[#0a0a0a] border-b border-[#1e1e1e] sticky top-0 z-20">
    <div className="flex items-center gap-4">
      <button onClick={onOpenSidebar} className="p-2 hover:bg-[#1e1e1e] rounded-lg">
        <Menu size={24} />
      </button>
      <div className="hidden lg:block">
        <h1 className="font-bold font-mono text-lg text-white">SHIFT<span className="text-shift-blue">HAPPENS</span></h1>
        <p className="text-xs text-gray-500">Restaurant Operations Platform</p>
      </div>
    </div>

    <div className="flex items-center gap-4">
      <RoleSwitcher className="mr-2" />
      
      <div className="hidden lg:flex items-center gap-2">
        <button className="relative p-2 hover:bg-[#1e1e1e] rounded-lg" aria-label="Notifications">
          <Bell size={20} />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">3</span>
        </button>
        <button className="p-2 hover:bg-[#1e1e1e] rounded-lg" aria-label="Settings" onClick={onOpenSettings}>
          <Settings size={20} />
        </button>
        <button className="p-2 hover:bg-[#1e1e1e] rounded-lg" aria-label="Help" onClick={onOpenHelp}>
          <HelpCircle size={20} />
        </button>
      </div>

      <div className="flex items-center gap-3 pl-4 border-l border-[#1e1e1e]">
        <div className="text-right hidden sm:block">
          <p className="font-bold text-sm text-white">{user?.name || 'Guest'}</p>
          <p className="text-xs text-gray-500 capitalize">{user?.role || 'server'}</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
          {user?.name?.charAt(0) || 'U'}
        </div>
      </div>
    </div>
  </header>
);

const MobileUserMenu = ({ 
  isOpen, 
  onClose, 
  user, 
  onLogout, 
  onOpenSettings,
  onOpenHelp 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  user: { name: string; role: string; avatar?: string } | null;
  onLogout: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
}) => (
  isOpen && (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-xl z-50 md:hidden animate-in slide-in-from-bottom-full duration-200">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <p className="font-bold text-lg">Account</p>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={24} /></button>
        </div>
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div>
              <p className="font-bold">{user?.name || 'Guest'}</p>
              <p className="text-sm text-gray-500 capitalize">{user?.role || 'server'}</p>
            </div>
          </div>
        </div>
        <nav className="px-4 py-2 space-y-1">
          {[
            { icon: SettingsIcon, label: 'Settings', onClick: onOpenSettings },
            { icon: HelpCircle, label: 'Help & Support', onClick: onOpenHelp },
            { icon: Shield, label: 'Permissions', onClick: () => {} },
            { icon: LogOut, label: 'Sign Out', onClick: onLogout, destructive: true },
          ].map((item, i) => (
            <button
              key={i}
              onClick={() => { item.onClick(); onClose(); }}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left font-medium transition-colors ${item.destructive ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              <item.icon size={20} className={item.destructive ? 'text-red-600' : 'text-gray-400'} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="h-16" /> {/* Safe area */}
      </div>
    </>
  )
);

const NavigationItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['owner', 'general_manager', 'manager', 'server', 'host', 'cook'] },
  { path: '/pos', label: 'POS', icon: Utensils, roles: ['owner', 'general_manager', 'manager', 'server'] },
  { path: '/reservations', label: 'Reservations', icon: Calendar, roles: ['owner', 'general_manager', 'manager', 'server', 'host'] },
  { path: '/floorplan', label: 'Floor Plan', icon: LayoutDashboard, roles: ['owner', 'general_manager', 'manager', 'host'] },
  { path: '/guests', label: 'Guests', icon: Users, roles: ['owner', 'general_manager', 'manager', 'server', 'host'] },
  { path: '/inventory', label: 'Inventory', icon: Package, roles: ['owner', 'general_manager', 'manager', 'cook'] },
  { path: '/kds', label: 'KDS', icon: ChefHat, roles: ['owner', 'general_manager', 'manager', 'cook'] },
  { path: '/staff', label: 'Staff', icon: Users, roles: ['owner', 'general_manager', 'manager'] },
  { path: '/events', label: 'Events', icon: Calendar, roles: ['owner', 'general_manager', 'manager'] },
  { path: '/insights', label: 'Insights', icon: BarChart3, roles: ['owner', 'general_manager', 'manager'] },
  { path: '/agent', label: 'ShiftBot', icon: Bot, roles: ['owner', 'general_manager', 'manager'] },
  { path: '/analytics', label: 'Analytics', icon: BarChart3, roles: ['owner', 'general_manager', 'manager'] },
  { path: '/admin', label: 'Admin', icon: SettingsIcon, roles: ['owner', 'general_manager'] },
];

const AppShell = ({ children }: { children: ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobileUserMenuOpen, setIsMobileUserMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const location = useLocation();
  const { authUser, logout } = useAppStore();

  const currentPath = location.pathname;
  const currentNav = NavigationItems.find(n => n.path === currentPath) || NavigationItems[0];

  const handleLogout = () => {
    logout();
    setIsMobileUserMenuOpen(false);
  };

  const user = authUser ? {
    name: authUser.email.split('@')[0],
    role: authUser.role,
  } : null;

  return (
    <div className="flex min-h-screen bg-[#F5F5F5]">
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        currentPath={currentPath}
        user={user}
      />
      
      <div className="flex-1 flex flex-col w-full overflow-hidden">
        <MobileHeader 
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onOpenUserMenu={() => setIsMobileUserMenuOpen(true)}
          title={currentNav.label}
        />
        
        <TopBar
          onOpenSidebar={() => setIsSidebarOpen(true)}
          user={user}
          onLogout={handleLogout}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenHelp={() => setIsHelpOpen(true)}
        />

        <main className="flex-1 p-4 md:p-8 overflow-y-auto overflow-x-hidden scroll-smooth">
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
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>

      <MobileUserMenu
        isOpen={isMobileUserMenuOpen}
        onClose={() => setIsMobileUserMenuOpen(false)}
        user={user}
        onLogout={handleLogout}
        onOpenSettings={() => { setIsSettingsOpen(true); setIsMobileUserMenuOpen(false); }}
        onOpenHelp={() => { setIsHelpOpen(true); setIsMobileUserMenuOpen(false); }}
      />

      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Settings</h3>
            <p className="text-gray-500 mb-4">Settings panel coming soon...</p>
            <button onClick={() => setIsSettingsOpen(false)} className="w-full py-3 bg-shift-dark text-white rounded-xl font-bold hover:bg-black">
              Close
            </button>
          </div>
        </div>
      )}

      {isHelpOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">Help & Support</h3>
            <p className="text-gray-500 mb-4">Help center coming soon...</p>
            <button onClick={() => setIsHelpOpen(false)} className="w-full py-3 bg-shift-dark text-white rounded-xl font-bold hover:bg-black">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppShell;