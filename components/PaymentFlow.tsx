import React, { useState, useCallback, useEffect } from 'react';
import { useAppStore } from '../store.tsx';
import { Order, OrderStatus } from '../types.ts';
import { CreditCard, DollarSign, Users, Divide, CheckCircle, X, ArrowLeft, Loader2, Zap, Receipt, Smartphone, Calendar, AlertCircle, Check, Minus, Plus } from 'lucide-react';

interface PaymentFlowProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  onComplete: (payment: { method: string; amount: number; tip: number; split?: any }) => void;
}

const PAYMENT_METHODS = [
  { id: 'card', label: 'Credit/Debit Card', icon: <CreditCard size={20} />, color: 'bg-blue-100 text-blue-700' },
  { id: 'cash', label: 'Cash', icon: <DollarSign size={20} />, color: 'bg-green-100 text-green-700' },
  { id: 'mobile', label: 'Mobile Pay', icon: <Smartphone size={20} />, color: 'bg-purple-100 text-purple-700' },
  { id: 'split', label: 'Split Bill', icon: <Divide size={20} />, color: 'bg-amber-100 text-amber-700' },
];

const TIP_PRESETS = [15, 18, 20, 25];

interface SplitGuest {
  id: number;
  name: string;
  items: string[];
  amount: number;
}

const PaymentFlow = ({ isOpen, onClose, order, onComplete }: PaymentFlowProps) => {
  const [step, setStep] = useState<'method' | 'tip' | 'split' | 'processing' | 'success'>('method');
  const [selectedMethod, setSelectedMethod] = useState<string>('card');
  const [tipPercent, setTipPercent] = useState(18);
  const [customTip, setCustomTip] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [splitGuests, setSplitGuests] = useState<SplitGuest[]>([{ id: 1, name: 'Guest 1', items: [], amount: 0 }]);
  const [splitMode, setSplitMode] = useState<'equal' | 'item'>('equal');

  const subtotal = order.total - (order.tip || 0);
  const tax = order.tax || 0;
  const currentTip = subtotal * (tipPercent / 100);
  const total = subtotal + tax + currentTip;

  const handleMethodSelect = (method: string) => {
    setSelectedMethod(method);
    if (method === 'split') {
      setStep('split');
      // Initialize split guests
      const guestCount = Math.max(2, order.items.length);
      setSplitGuests(Array.from({ length: guestCount }, (_, i) => ({
        id: i + 1,
        name: `Guest ${i + 1}`,
        items: [],
        amount: 0,
      })));
    } else {
      setStep('tip');
    }
  };

  const handleTipSelect = (percent: number) => {
    setTipPercent(percent);
    setCustomTip('');
  };

  const handleCustomTipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomTip(value);
    if (value) setTipPercent(parseFloat(value) || 0);
  };

  const handleBack = () => {
    if (step === 'tip') setStep('method');
    else if (step === 'split') setStep('method');
    else if (step === 'processing') setStep(selectedMethod === 'split' ? 'split' : 'tip');
  };

  const handleProcessPayment = async () => {
    setIsProcessing(true);
    setStep('processing');

    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    const payment = {
      method: selectedMethod,
      amount: total,
      tip: currentTip,
      split: selectedMethod === 'split' ? splitGuests : undefined,
    };

    setIsProcessing(false);
    setStep('success');
    
    // Call completion callback
    onComplete(payment);
  };

  const handleAddSplitGuest = () => {
    setSplitGuests(prev => [...prev, { 
      id: Date.now(), 
      name: `Guest ${prev.length + 1}`, 
      items: [], 
      amount: 0 
    }]);
  };

  const handleRemoveSplitGuest = (id: number) => {
    if (splitGuests.length <= 2) return;
    setSplitGuests(prev => prev.filter(g => g.id !== id));
  };

  const handleEqualSplit = () => {
    const perGuest = total / splitGuests.length;
    setSplitGuests(prev => prev.map(g => ({ ...g, amount: perGuest })));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <button onClick={handleBack} className="p-2 hover:bg-gray-100 rounded-lg" disabled={step === 'method'}>
            <ArrowLeft size={24} />
          </button>
          <div className="flex-1 text-center">
            <h3 className="font-bold text-lg text-shift-dark">Payment</h3>
            <p className="text-sm text-gray-500">Order #{order.id.slice(-6)} • {order.items.length} items</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={24} /></button>
        </div>

        {/* Progress Steps */}
        <div className="px-4 py-2 border-b border-gray-100">
          <div className="flex items-center justify-between">
            {['method', 'tip', 'processing', 'success'].map((s, i) => {
              const isActive = ['method', 'tip', 'processing', 'success'].indexOf(step) >= i;
              const isCurrent = step === s;
              return (
                <div key={s} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                    isActive ? 'bg-shift-dark text-white' : 'bg-gray-200 text-gray-400'
                  } ${isCurrent ? 'ring-2 ring-shift-blue ring-offset-2' : ''}`}>
                    {isActive && step !== 'success' && i < ['method', 'tip', 'processing', 'success'].indexOf(step) ? (
                      <Check size={14} />
                    ) : (
                      i + 1
                    )}
                  </div>
                  {i < 3 && <div className={`flex-1 h-1 mx-2 ${isActive && i < ['method', 'tip', 'processing', 'success'].indexOf(step) ? 'bg-shift-dark' : 'bg-gray-200'}`} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Step 1: Payment Method */}
          {step === 'method' && (
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Select Payment Method</p>
              <div className="grid grid-cols-2 gap-3">
                {PAYMENT_METHODS.map(method => (
                  <button
                    key={method.id}
                    onClick={() => handleMethodSelect(method.id)}
                    className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${
                      selectedMethod === method.id
                        ? 'border-shift-blue bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${method.color}`}>
                      {method.icon}
                    </div>
                    <span className="font-bold text-sm">{method.label}</span>
                    {selectedMethod === method.id && (
                      <CheckCircle size={16} className="text-shift-blue" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Tip */}
          {(step === 'tip' || step === 'processing') && selectedMethod !== 'split' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-gray-500 uppercase tracking-wide">Add Tip</p>
                <span className={`font-bold text-lg ${tipPercent > 0 ? 'text-shift-blue' : 'text-gray-400'}`}>
                  ${currentTip.toFixed(2)}
                </span>
              </div>
              <div className="flex gap-2 mb-4 flex-wrap">
                {TIP_PRESETS.map(percent => (
                  <button
                    key={percent}
                    onClick={() => handleTipSelect(percent)}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                      tipPercent === percent
                        ? 'bg-shift-dark text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {percent}%
                  </button>
                ))}
                <div className="flex-1 min-w-[80px]">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={customTip || ''}
                    onChange={handleCustomTipChange}
                    placeholder="Custom %"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-center focus:ring-2 focus:ring-shift-blue focus:outline-none"
                  />
                </div>
              </div>

              {/* Quick tip buttons */}
              <div className="grid grid-cols-3 gap-2 mb-4">
{['$1', '$2', '$3', '$5'].map(amount => (
                    <button
                      key={amount}
                      onClick={() => setTipPercent((parseFloat(amount.replace('$', '')) / subtotal) * 100)}
                      className="py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-bold text-gray-700"
                    >
                      ${amount}
                    </button>
                  ))}
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-bold">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax</span>
                  <span className="font-bold">${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-shift-blue">
                  <span>Tip ({tipPercent}%)</span>
                  <span className="font-bold">${currentTip.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                  <span>Total</span>
                  <span className="text-shift-dark">${total.toFixed(2)}</span>
                </div>
              </div>

              {step === 'processing' ? (
                <div className="text-center py-8">
                  <Loader2 size={48} className="mx-auto mb-4 text-shift-blue animate-spin" />
                  <p className="text-gray-600">Processing payment...</p>
                  <p className="text-sm text-gray-400 mt-1">Please do not close this window</p>
                </div>
              ) : (
                <button
                  onClick={handleProcessPayment}
                  disabled={isProcessing}
                  className="w-full py-4 bg-shift-dark text-white rounded-xl font-bold text-lg hover:bg-black disabled:opacity-50"
                >
                  Pay ${total.toFixed(2)}
                </button>
              )}
            </div>
          )}

          {/* Step 3: Split Bill */}
          {step === 'split' && (
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Split Bill</p>
              
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setSplitMode('equal')}
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                    splitMode === 'equal' ? 'bg-shift-dark text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  Split Equally
                </button>
                <button
                  onClick={() => setSplitMode('item')}
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                    splitMode === 'item' ? 'bg-shift-dark text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  By Item
                </button>
              </div>

              <div className="space-y-3 mb-4">
                {splitGuests.map((guest, index) => (
                  <div key={guest.id} className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <input
                        type="text"
                        value={guest.name}
                        onChange={(e) => setSplitGuests(prev => prev.map((g, i) => i === index ? { ...g, name: e.target.value } : g))}
                        className="font-bold text-sm bg-transparent border-none focus:outline-none w-32"
                      />
                      <div className="flex items-center gap-1">
                        {splitMode === 'item' && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-bold">
                            {guest.items.length} items
                          </span>
                        )}
                        <span className="font-bold text-shift-dark">${guest.amount.toFixed(2)}</span>
                        {splitGuests.length > 2 && (
                          <button
                            onClick={() => handleRemoveSplitGuest(guest.id)}
                            className="p-1 text-gray-400 hover:text-red-500"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                    {splitMode === 'item' && (
                      <div className="space-y-1">
                        {order.items.map((item, itemIndex) => (
                          <label key={itemIndex} className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={guest.items.includes(item.name)}
                              onChange={(e) => setSplitGuests(prev => prev.map((g, i) => 
                                i === index 
                                  ? { ...g, items: e.target.checked 
                                      ? [...g.items, item.name] 
                                      : g.items.filter(n => n !== item.name) }
                                  : g
                              ))}
                              className="w-4 h-4 text-shift-blue rounded border-gray-300"
                            />
                            <span>{item.name} - ${item.unit_price.toFixed(2)} x {item.quantity}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mb-4">
                <button onClick={handleAddSplitGuest} className="flex-1 py-2 border border-gray-200 rounded-lg font-bold hover:bg-gray-50">
                  <Plus size={16} className="inline mr-1" /> Add Guest
                </button>
                <button onClick={handleEqualSplit} className="flex-1 py-2 bg-shift-blue text-white rounded-lg font-bold hover:bg-blue-700">
                  Split Equally
                </button>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total</span>
                  <span className="font-bold text-shift-dark">${total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Per guest ({splitGuests.length})</span>
                  <span className="font-bold">${(total / splitGuests.length).toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setStep('tip');
                }}
                className="w-full py-3 bg-shift-dark text-white rounded-xl font-bold hover:bg-black"
              >
                Continue to Tip
              </button>
            </div>
          )}

          {/* Step 4: Success */}
          {step === 'success' && (
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle size={40} className="text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-shift-dark mb-2">Payment Successful!</h3>
              <p className="text-gray-500 mb-6">
                ${total.toFixed(2)} paid via {PAYMENT_METHODS.find(m => m.id === selectedMethod)?.label || selectedMethod}
              </p>
              <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Transaction ID</span>
                  <span className="font-mono font-bold">txn_{Date.now().toString(36)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Date</span>
                  <span className="font-bold">{new Date().toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Order</span>
                  <span className="font-bold">#{order.id.slice(-6)}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onClose();
                    setStep('method');
                    setSelectedMethod('card');
                    setTipPercent(18);
                    setCustomTip('');
                  }}
                  className="flex-1 py-3 border border-gray-200 rounded-xl font-bold hover:bg-gray-50"
                >
                  New Payment
                </button>
                <button
                  onClick={() => {
                    onClose();
                    setStep('method');
                    setSelectedMethod('card');
                    setTipPercent(18);
                    setCustomTip('');
                  }}
                  className="flex-1 py-3 bg-shift-dark text-white rounded-xl font-bold hover:bg-black"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentFlow;