import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store.tsx';
import { MenuItem, Modifier, OrderItem } from '../types.ts';
import { X, Check, Minus, Plus, AlertCircle, Info } from 'lucide-react';

interface ModifierModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: MenuItem;
  onConfirm: (modifiers: any[]) => void;
  selectedModifiers?: any[];
}

const ModifierModal = ({ isOpen, onClose, item, onConfirm, selectedModifiers = [] }: ModifierModalProps) => {
  const [localModifiers, setLocalModifiers] = useState<any[]>(selectedModifiers);
  const [showRequiredOnly, setShowRequiredOnly] = useState(false);

  useEffect(() => {
    setLocalModifiers(selectedModifiers);
  }, [selectedModifiers, isOpen]);

  const requiredModifiers = item.modifiers?.filter(m => m.is_required) || [];
  const optionalModifiers = item.modifiers?.filter(m => !m.is_required) || [];

  const handleModifierToggle = (modifier: Modifier) => {
    setLocalModifiers(prev => {
      const existing = prev.find(m => m.id === modifier.id);
      if (existing) {
        if (existing.quantity > 1) {
          return prev.map(m => m.id === modifier.id ? { ...m, quantity: m.quantity - 1 } : m);
        }
        return prev.filter(m => m.id !== modifier.id);
      }
      return [...prev, { ...modifier, quantity: 1 }];
    });
  };

  const handleQuantityChange = (modifierId: string, delta: number) => {
    setLocalModifiers(prev => prev.map(m => 
      m.id === modifierId ? { ...m, quantity: Math.max(1, m.quantity + delta) } : m
    ));
  };

  const modifierPrice = localModifiers.reduce((sum, m) => sum + (m.price_adjustment * m.quantity), 0);
  const totalPrice = item.price + modifierPrice;

  const handleConfirm = () => {
    // Check required modifiers
    const missingRequired = requiredModifiers.filter(
      req => !localModifiers.some(m => m.id === req.id)
    );
    if (missingRequired.length > 0) {
      alert(`Please select required modifiers: ${missingRequired.map(m => m.name).join(', ')}`);
      return;
    }
    onConfirm(localModifiers);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">
              {item.category === 'DRINK' ? '����' : item.category === 'DESSERT' ? '����' : '�������'}
            </div>
            <div>
              <h3 className="font-bold text-lg text-shift-dark">{item.name}</h3>
              <p className="text-sm text-gray-500">${item.price.toFixed(2)} each</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={24} /></button>
        </div>

        {/* Modifier Sections */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Required Modifiers */}
          {requiredModifiers.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-sm text-gray-700 uppercase tracking-wide flex items-center gap-2">
                  <AlertCircle size={14} className="text-red-500" />
                  Required Modifiers
                </h4>
                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                  {requiredModifiers.length} required
                </span>
              </div>
              <div className="space-y-2">
                {requiredModifiers.map(modifier => (
                  <ModifierRow
                    key={modifier.id}
                    modifier={modifier}
                    isSelected={localModifiers.some(m => m.id === modifier.id)}
                    quantity={localModifiers.find(m => m.id === modifier.id)?.quantity || 1}
                    onToggle={() => handleModifierToggle(modifier)}
                    onQuantityChange={(delta) => handleQuantityChange(modifier.id, delta)}
                    required
                  />
                ))}
              </div>
            </div>
          )}

          {/* Optional Modifiers */}
          {optionalModifiers.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-gray-700 uppercase tracking-wide">
                    Optional Add-ons
                  </h4>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showRequiredOnly}
                      onChange={(e) => setShowRequiredOnly(e.target.checked)}
                      className="w-4 h-4 text-shift-blue rounded border-gray-300 focus:ring-shift-blue"
                    />
                    <span className="text-xs text-gray-500">Show selected only</span>
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                {optionalModifiers
                  .filter(m => !showRequiredOnly || localModifiers.some(lm => lm.id === m.id))
                  .map(modifier => (
                    <ModifierRow
                      key={modifier.id}
                      modifier={modifier}
                      isSelected={localModifiers.some(m => m.id === modifier.id)}
                      quantity={localModifiers.find(m => m.id === modifier.id)?.quantity || 1}
                      onToggle={() => handleModifierToggle(modifier)}
                      onQuantityChange={(delta) => handleQuantityChange(modifier.id, delta)}
                    />
                  ))}
              </div>
            </div>
          )}

          {requiredModifiers.length === 0 && optionalModifiers.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <Info size={32} className="mx-auto mb-2 opacity-50" />
              <p>No modifiers available for this item</p>
            </div>
          )}
        </div>

        {/* Price Summary */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Base Price</span>
              <span className="font-bold">${item.price.toFixed(2)}</span>
            </div>
            {modifierPrice > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Modifiers</span>
                <span className="font-bold text-shift-blue">+${modifierPrice.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg border-t border-gray-200 pt-2">
              <span className="font-bold">Total</span>
              <span className="font-bold text-shift-dark">${totalPrice.toFixed(2)}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-3 border border-gray-200 rounded-xl font-bold hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={handleConfirm} className="flex-1 py-3 bg-shift-dark text-white rounded-xl font-bold hover:bg-black">
              Add to Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ModifierRowProps {
  modifier: Modifier;
  isSelected: boolean;
  quantity: number;
  onToggle: () => void;
  onQuantityChange: (delta: number) => void;
  required?: boolean;
}

const ModifierRow = ({ modifier, isSelected, quantity, onToggle, onQuantityChange, required }: ModifierRowProps) => {
  const priceText = modifier.price_adjustment > 0 ? `+$${modifier.price_adjustment.toFixed(2)}` : modifier.price_adjustment < 0 ? `$${modifier.price_adjustment.toFixed(2)}` : 'No charge';

  return (
    <div className={`p-3 rounded-xl border-2 transition-all ${
      isSelected ? 'border-shift-blue bg-blue-50' : 'border-gray-200 hover:border-gray-300'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={onToggle}
            className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
              isSelected ? 'border-shift-blue bg-shift-blue text-white' : 'border-gray-300 text-transparent hover:border-shift-blue'
            }`}
          >
            {isSelected && <Check size={10} />}
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-shift-dark truncate">{modifier.name}</p>
            <p className="text-xs text-gray-500">{priceText} {required && '• Required'}</p>
          </div>
        </div>
        {isSelected && (
          <div className="flex items-center gap-2 ml-3">
            <button
              onClick={() => onQuantityChange(-1)}
              className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-100"
            >
              <Minus size={16} />
            </button>
            <span className="font-bold text-lg min-w-[2rem] text-center">{quantity}</span>
            <button
              onClick={() => onQuantityChange(1)}
              className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-100"
            >
              <Plus size={16} />
            </button>
            <span className="font-bold text-gray-700 w-16 text-right">
              ${(modifier.price_adjustment * quantity).toFixed(2)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModifierModal;