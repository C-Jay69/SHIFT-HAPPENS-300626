import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../store.tsx';
import { Guest } from '../types.ts';
import { Search, X, UserPlus, Phone, Mail, MapPin, Star, Clock, ChevronDown } from 'lucide-react';

interface GuestSearchProps {
  onSelect: (guest: Guest) => void;
  placeholder?: string;
  className?: string;
  value?: string;
  onChange?: (value: string) => void;
}

const GuestSearch = ({ 
  onSelect, 
  placeholder = 'Search guest by name, phone, or email...', 
  className = '',
  value = '',
  onChange 
}: GuestSearchProps) => {
  const { guests } = useAppStore();
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const filteredGuests = guests
    .filter(guest => {
      const search = query.toLowerCase();
      const name = `${guest.first_name} ${guest.last_name}`.toLowerCase();
      return name.includes(search) || 
             guest.phone?.toLowerCase().includes(search) || 
             guest.email?.toLowerCase().includes(search);
    })
    .sort((a, b) => {
      const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
      const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setQuery(newValue);
    setIsOpen(true);
    setSelectedIndex(-1);
    onChange?.(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredGuests.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && filteredGuests[selectedIndex]) {
          onSelect(filteredGuests[selectedIndex]);
          setQuery(`${filteredGuests[selectedIndex].first_name} ${filteredGuests[selectedIndex].last_name}`);
          setIsOpen(false);
          setSelectedIndex(-1);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleGuestClick = (guest: Guest) => {
    onSelect(guest);
    setQuery(`${guest.first_name} ${guest.last_name}`);
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.blur();
  };

  const handleBlur = () => {
    setTimeout(() => setIsOpen(false), 200);
  };

  const handleFocus = () => {
    if (guests.length > 0) {
      setIsOpen(true);
    }
  };

  const clearSearch = () => {
    setQuery('');
    onChange?.('');
    inputRef.current?.focus();
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-shift-blue focus:outline-none text-sm"
          autoComplete="off"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
            aria-label="Clear search"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-96"
        >
          {filteredGuests.length === 0 ? (
            <div className="p-6 text-center">
              <UserPlus className="mx-auto mb-2 text-gray-300" size={24} />
              <p className="text-sm text-gray-500 mb-1">No guests found</p>
              <button
                onClick={() => {
                  setIsOpen(false);
                  // Could emit event to open guest creation modal
                }}
                className="text-sm font-bold text-shift-blue hover:underline"
              >
                Create new guest
              </button>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {filteredGuests.map((guest, index) => (
                <button
                  key={guest.id}
                  onClick={() => handleGuestClick(guest)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full p-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 ${
                    selectedIndex === index ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      guest.vip_status ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {guest.vip_status ? (
                        <Star size={16} className="fill-current" />
                      ) : (
                        <span className="font-bold text-sm">
                          {guest.first_name[0]}{guest.last_name[0]}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm text-shift-dark truncate">
                          {guest.first_name} {guest.last_name}
                        </p>
                        {guest.vip_status && (
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold">
                            VIP
                          </span>
                        )}
                        {guest.loyalty_points && guest.loyalty_points > 0 && (
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[10px] font-bold">
                            {guest.loyalty_points} pts
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        {guest.phone && (
                          <span className="flex items-center gap-1 whitespace-nowrap">
                            <Phone size={12} /> {guest.phone}
                          </span>
                        )}
                        {guest.email && (
                          <span className="flex items-center gap-1 whitespace-nowrap truncate">
                            <Mail size={12} /> {guest.email}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronDown className="text-gray-300 flex-shrink-0 mt-1" size={16} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GuestSearch;