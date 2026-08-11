import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppStore } from '../store.tsx';
import { LayoutDashboard, UtensilsCrossed, CalendarDays, Boxes, Bot, ChefHat, X, Lock, LogIn, Users, PartyPopper } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const ROLES = ['owner', 'general_manager', 'manager', 'server', 'host', 'cook'];

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { authUser } = useAppStore();
  const [demoRole, setDemoRole] = useState(authUser?.role ?? 'manager');

  useEffect(() => {
    if (authUser) setDemoRole(authUser.role);
  }, [authUser]);

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/pos', icon: UtensilsCrossed, label: 'POS Terminal' },
    { path: '/reservations', icon: CalendarDays, label: 'Reservations' },
    { path: '/inventory', icon: Boxes, label: 'Inventory' },
    { path: '/kds', icon: ChefHat, label: 'Kitchen Display' },
    { path: '/staff', icon: Users, label: 'Staff & Shifts' },
    { path: '/events', icon: PartyPopper, label: 'Events & Catering' },
    { path: '/agent', icon: Bot, label: 'AI Manager' },
    { path: '/admin', icon: Lock, label: 'Admin Panel' },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-shift-dark text-white border-r border-shift-gray transform transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0 md:flex md:flex-col md:w-20 lg:w-64 md:h-screen md:sticky md:top-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 flex items-center justify-between md:justify-center lg:justify-start border-b border-gray-800">
          <div className="flex items-center">
             <div className="w-8 h-8 bg-shift-blue rounded-full shrink-0 flex items-center justify-center font-bold text-white">S</div>
             <h1 className="ml-3 font-mono font-bold text-xl md:hidden lg:block tracking-tighter">SHIFT<span className="text-shift-blue">HAPPENS</span></h1>
          </div>
          <button onClick={onClose} className="md:hidden text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => onClose()}
                className={`flex items-center px-6 py-3 transition-colors duration-200 ${
                  isActive 
                    ? 'bg-shift-blue text-white border-l-4 border-shift-lime' 
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span className="ml-4 font-medium md:hidden lg:block">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-gray-800 space-y-3">
          {authUser ? (
            <>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-shift-magenta to-shift-blue shrink-0" />
                <div className="md:hidden lg:block min-w-0">
                  <p className="text-sm font-bold truncate">{authUser.email}</p>
                  <p className="text-xs text-gray-500">{authUser.role}</p>
                </div>
              </div>
              <div className="md:hidden lg:block">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Role (demo)</label>
                <select
                  value={demoRole}
                  onChange={(e) => setDemoRole(e.target.value)}
                  className="w-full mt-1 p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 focus:outline-none"
                  title="Preview different permission levels (server still enforces real roles)"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <Link
              to="/login"
              onClick={() => onClose()}
              className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
                <LogIn size={18} />
              </div>
              <div className="md:hidden lg:block">
                <p className="text-sm font-bold">Sign in</p>
                <p className="text-xs text-gray-500">Staff access</p>
              </div>
            </Link>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;