import React, { useState, useRef, useEffect } from 'react';
import { UserCircle, Shield, Key, Eye, EyeOff, ChevronDown, Check } from 'lucide-react';

interface RoleSwitcherProps {
  currentRole?: string;
  onRoleChange?: (role: string) => void;
  className?: string;
}

const ROLES = [
  { id: 'owner', name: 'Owner', permissions: ['*'], color: 'bg-purple-100 text-purple-700', icon: <Shield size={14} className="text-purple-600" /> },
  { id: 'general_manager', name: 'General Manager', permissions: ['pos.charge', 'pos.refund', 'inventory.manage', 'reservations.manage', 'staff.manage', 'reports.view', 'menu.manage', 'ai.configure'], color: 'bg-blue-100 text-blue-700', icon: <UserCircle size={14} className="text-blue-600" /> },
  { id: 'manager', name: 'Manager', permissions: ['pos.charge', 'inventory.manage', 'reservations.manage', 'reports.view', 'menu.manage'], color: 'bg-green-100 text-green-700', icon: <Key size={14} className="text-green-600" /> },
  { id: 'server', name: 'Server', permissions: ['pos.charge', 'reservations.create', 'guest.view'], color: 'bg-amber-100 text-amber-700', icon: <UserCircle size={14} className="text-amber-600" /> },
  { id: 'host', name: 'Host', permissions: ['reservations.manage', 'guest.view'], color: 'bg-cyan-100 text-cyan-700', icon: <UserCircle size={14} className="text-cyan-600" /> },
  { id: 'cook', name: 'Cook', permissions: ['kds.view', 'inventory.view'], color: 'bg-red-100 text-red-700', icon: <UserCircle size={14} className="text-red-600" /> },
];

const RoleSwitcher = ({ 
  currentRole = 'server', 
  onRoleChange, 
  className = '' 
}: RoleSwitcherProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const currentRoleData = ROLES.find(r => r.id === currentRole) || ROLES[3];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowPermissions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRoleChange = (roleId: string) => {
    const role = ROLES.find(r => r.id === roleId);
    if (role) {
      onRoleChange?.(roleId);
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 transition-colors"
        aria-label="Switch role"
        aria-expanded={isOpen}
      >
        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${currentRoleData.color}`}>
          {currentRoleData.icon}
        </span>
        <span className="font-bold text-sm text-gray-700 hidden sm:block">{currentRoleData.name}</span>
        <ChevronDown className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} size={14} />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50 animate-in fade-in-0 zoom-in-95 duration-150"
        >
          <div className="p-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Switch Role</p>
            <p className="text-xs text-gray-400 mt-0.5">For testing permission levels</p>
          </div>
          
          <div className="py-2 max-h-64 overflow-y-auto">
            {ROLES.map(role => (
              <button
                key={role.id}
                onClick={() => handleRoleChange(role.id)}
                className={`w-full px-3 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 ${
                  currentRole === role.id ? 'bg-blue-50' : ''
                }`}
              >
                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${role.color}`}>
                  {role.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-shift-dark truncate">{role.name}</p>
                  <p className="text-xs text-gray-500 truncate">{role.permissions.length} permissions</p>
                </div>
                {currentRole === role.id && (
                  <Check className="text-green-500 flex-shrink-0" size={16} />
                )}
              </button>
            ))}
          </div>

          <div className="border-t border-gray-100 p-3">
            <button
              onClick={() => setShowPermissions(!showPermissions)}
              className="w-full flex items-center justify-between px-2 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <span className="flex items-center gap-2">
                <Eye size={14} className={showPermissions ? 'text-shift-blue' : 'text-gray-400'} />
                View Permissions
              </span>
              <ChevronDown className={`text-gray-400 transition-transform ${showPermissions ? 'rotate-180' : ''}`} size={12} />
            </button>

            {showPermissions && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg max-h-48 overflow-y-auto">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  {currentRoleData.name} Permissions
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {currentRoleData.permissions.map((perm, i) => (
                    <span key={i} className="px-2 py-0.5 bg-white border border-gray-200 rounded text-[10px] font-mono font-medium text-gray-600">
                      {perm === '*' ? 'All permissions' : perm}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleSwitcher;