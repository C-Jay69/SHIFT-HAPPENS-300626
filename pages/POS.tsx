
import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store.tsx';
import { MenuItem, TableStatus, OrderItem } from '../types.ts';
import { Plus, Minus, Trash2, CreditCard, ChefHat, StickyNote, X, Divide, Users, CheckCircle, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import { generateRestaurantAssistantResponse } from '../services/openrouterService.ts';

const POS = () => {
  const { 
    tables, 
    activeOrder, 
    createOrder, 
    addToOrder, 
    completeOrder, 
    menuItems, 
    updateOrderItemQuantity, 
    removeOrderItem, 
    updateOrderItemNotes,
    ingredients
  } = useAppStore();
  
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'FOOD' | 'DRINK'>('ALL');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  
  // AI Suggestions State
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<{name: string, reason: string}[]>([]);
  
  // Split Bill State
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [splitMode, setSplitMode] = useState<'EQUAL' | 'ITEM'>('EQUAL');
  const [splitGuests, setSplitGuests] = useState(2);
  
  // Item Split State
  const [guestChecks, setGuestChecks] = useState<{id: number, name: string}[]>([{id: 1, name: 'Guest 1'}, {id: 2, name: 'Guest 2'}]);
  const [selectedGuestId, setSelectedGuestId] = useState<number>(1);
  const [itemAssignments, setItemAssignments] = useState<Record<string, number>>({});

  const filteredItems = selectedCategory === 'ALL' 
    ? menuItems 
    : menuItems.filter(i => i.category === selectedCategory);

  const handleGetAISuggestions = async () => {
    if (!activeOrder || activeOrder.items.length === 0) return;
    
    setIsSuggesting(true);
    setSuggestions([]);

    const currentItems = activeOrder.items.map(i => i.name).join(', ');
    const menuList = menuItems.map(m => `${m.name} ($${m.price})`).join(', ');
    const lowStock = ingredients.filter(ing => ing.stock <= ing.threshold).map(ing => ing.name).join(', ');

    const prompt = `Based on the current order containing [${currentItems}], suggest exactly 2 or 3 items from our menu that would pair well. 
    Menu: [${menuList}]. 
    Avoid suggesting: [${lowStock}] because they are low on stock.
    Return your answer in this exact JSON format: [{"name": "Item Name", "reason": "Short one sentence pairing reason"}]
    Do not include any other text.`;

    try {
      const response = await generateRestaurantAssistantResponse(prompt, "POS context", "You are a savvy restaurant sales expert. You only output JSON.");
      // Attempt to find JSON in response (the AI might wrap in markdown blocks)
      const jsonMatch = response.match(/\[.*\]/s);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setSuggestions(parsed);
      }
    } catch (e) {
      console.error("Failed to parse AI suggestions", e);
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleAddSuggested = (itemName: string) => {
    const item = menuItems.find(m => m.name.toLowerCase() === itemName.toLowerCase());
    if (item) {
      addToOrder(item);
      setSuggestions(prev => prev.filter(s => s.name.toLowerCase() !== itemName.toLowerCase()));
    }
  };

  // Split Bill Helpers
  useEffect(() => {
    if (isSplitModalOpen && activeOrder) {
      setSplitGuests(2);
      setGuestChecks([{id: 1, name: 'Guest 1'}, {id: 2, name: 'Guest 2'}]);
      setItemAssignments({});
    }
  }, [isSplitModalOpen, activeOrder]);

  const getExplodedItems = () => {
    if (!activeOrder) return [];
    let exploded: { uniqueKey: string, item: OrderItem }[] = [];
    activeOrder.items.forEach((item, itemIdx) => {
        for(let i = 0; i < item.quantity; i++) {
            exploded.push({
                uniqueKey: `${item.menuItemId}-${itemIdx}-${i}`,
                item: item
            });
        }
    });
    return exploded;
  };

  const handleAssignItem = (uniqueKey: string) => {
      setItemAssignments(prev => {
          const currentOwner = prev[uniqueKey];
          if (currentOwner === selectedGuestId) {
              const newState = { ...prev };
              delete newState[uniqueKey];
              return newState;
          }
          return { ...prev, [uniqueKey]: selectedGuestId };
      });
  };

  const getGuestTotal = (guestId: number) => {
      const exploded = getExplodedItems();
      return exploded.reduce((sum, { uniqueKey, item }) => {
          if (itemAssignments[uniqueKey] === guestId) {
              return sum + item.price;
          }
          return sum;
      }, 0);
  };
  
  const getUnassignedTotal = () => {
      const exploded = getExplodedItems();
      return exploded.reduce((sum, { uniqueKey, item }) => {
          if (!itemAssignments[uniqueKey]) {
              return sum + item.price;
          }
          return sum;
      }, 0);
  };

  if (!activeOrder) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-6">
        <div className="bg-white p-10 rounded-2xl shadow-lg border-2 border-shift-gray text-center max-w-md">
          <h2 className="text-3xl font-bold mb-2 text-shift-blue">Start Tab</h2>
          <p className="text-gray-500 mb-8">Select a table to begin a new order.</p>
          
          <div className="grid grid-cols-3 gap-4">
            {tables.map(table => (
              <button
                key={table.id}
                disabled={table.status === TableStatus.OCCUPIED}
                onClick={() => createOrder(table.id)}
                className={`p-4 rounded-xl border-2 transition-all ${
                  table.status === TableStatus.OCCUPIED 
                    ? 'border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed'
                    : 'border-shift-blue bg-blue-50 text-shift-blue hover:bg-shift-blue hover:text-white font-bold'
                }`}
              >
                {table.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-2rem)] gap-6 overflow-hidden relative">
      {/* Menu Grid */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Category Filters */}
        <div className="flex gap-3 overflow-x-auto pb-2">
          {['ALL', 'FOOD', 'DRINK'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat as any)}
              className={`px-6 py-3 rounded-full font-bold text-sm transition-colors ${
                selectedCategory === cat 
                  ? 'bg-shift-dark text-white' 
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pb-20">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => addToOrder(item)}
              className={`${item.color} h-32 rounded-2xl p-4 flex flex-col justify-between items-start text-left transition-transform active:scale-95 hover:opacity-90 shadow-sm border-2 border-black/5`}
            >
              <span className="font-bold text-lg leading-tight text-shift-dark bg-white/80 px-2 py-1 rounded">{item.name}</span>
              <span className="bg-white/90 px-2 py-1 rounded-md font-mono font-bold text-shift-dark">${item.price.toFixed(2)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Current Order Sidebar */}
      <div className="w-full lg:w-96 bg-white border-l-2 border-gray-200 flex flex-col shadow-2xl rounded-l-2xl z-20">
        <div className="p-5 border-b border-gray-100 bg-gray-50">
           <div className="flex justify-between items-center">
             <h3 className="font-bold text-xl">Order #{activeOrder.id.slice(-4)}</h3>
             <span className="text-xs font-mono bg-green-100 text-green-800 px-2 py-1 rounded">ACTIVE</span>
           </div>
           <p className="text-sm text-gray-500 mt-1">Table: {tables.find(t => t.id === activeOrder.tableId)?.name}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeOrder.items.map((item, idx) => (
            <div key={`${item.menuItemId}-${idx}`} className="flex flex-col bg-white border border-gray-100 p-3 rounded-lg shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3 flex-1">
                    <div className="flex items-center bg-gray-100 rounded-lg border border-gray-200 shrink-0">
                        <button 
                            onClick={(e) => { e.stopPropagation(); updateOrderItemQuantity(item.menuItemId, -1); }}
                            className="p-1.5 hover:bg-gray-200 rounded-l-lg text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            disabled={item.quantity <= 1}
                        >
                            <Minus size={12} strokeWidth={3} />
                        </button>
                        <span className="w-6 text-center font-mono text-sm font-bold text-gray-800">{item.quantity}</span>
                        <button 
                            onClick={(e) => { e.stopPropagation(); updateOrderItemQuantity(item.menuItemId, 1); }}
                            className="p-1.5 hover:bg-gray-200 rounded-r-lg text-gray-600"
                        >
                            <Plus size={12} strokeWidth={3} />
                        </button>
                    </div>
                    
                    <div className="flex-1 min-w-0 pl-1">
                    <p className="font-bold text-sm truncate" title={item.name}>{item.name}</p>
                    <p className="text-xs text-gray-400">${item.price.toFixed(2)}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 pl-2 shrink-0">
                    <p className="font-bold font-mono text-sm">${(item.price * item.quantity).toFixed(2)}</p>
                    <button 
                        onClick={(e) => { e.stopPropagation(); removeOrderItem(item.menuItemId); }}
                        className="text-gray-300 hover:text-red-500 transition-colors p-1"
                        title="Remove item"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
              </div>

              <div className="mt-2 border-t border-gray-50 pt-2">
                 {editingNoteId === item.menuItemId ? (
                     <div className="flex gap-2 animate-fade-in">
                         <input 
                            type="text"
                            autoFocus
                            placeholder="Add note..."
                            defaultValue={item.notes || ''}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    updateOrderItemNotes(item.menuItemId, e.currentTarget.value);
                                    setEditingNoteId(null);
                                } else if (e.key === 'Escape') {
                                    setEditingNoteId(null);
                                }
                            }}
                            onBlur={(e) => {
                                updateOrderItemNotes(item.menuItemId, e.target.value);
                                setEditingNoteId(null);
                            }}
                            className="flex-1 text-xs p-2 bg-blue-50 border border-blue-200 rounded text-shift-dark focus:outline-none focus:border-shift-blue"
                         />
                         <button onClick={() => setEditingNoteId(null)} className="p-1 hover:bg-gray-200 rounded text-gray-500">
                             <X size={14} />
                         </button>
                     </div>
                 ) : (
                    <div 
                        className="flex items-center gap-2 cursor-pointer group"
                        onClick={() => setEditingNoteId(item.menuItemId)}
                    >
                         <div className={`p-1 rounded ${item.notes ? 'text-shift-blue bg-blue-50' : 'text-gray-300 group-hover:text-gray-500'}`}>
                            <StickyNote size={14} />
                         </div>
                         {item.notes ? (
                             <p className="text-xs font-bold text-shift-blue">{item.notes}</p>
                         ) : (
                             <p className="text-xs text-gray-300 group-hover:text-gray-400 italic">Add note...</p>
                         )}
                    </div>
                 )}
              </div>
            </div>
          ))}
          
          {/* AI Suggestions Box */}
          {(suggestions.length > 0 || isSuggesting) && (
            <div className="mt-6 bg-gradient-to-br from-shift-blue/5 to-shift-magenta/5 border border-shift-blue/20 rounded-xl p-4 animate-fade-in">
               <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-black uppercase tracking-widest text-shift-blue flex items-center gap-1.5">
                    <Sparkles size={14} /> ShiftBot Suggests
                  </h4>
                  {isSuggesting && <Loader2 size={14} className="animate-spin text-shift-blue" />}
                  {!isSuggesting && <button onClick={() => setSuggestions([])} className="text-gray-400 hover:text-gray-600"><X size={12}/></button>}
               </div>
               
               <div className="space-y-3">
                 {suggestions.map((s, i) => (
                   <button 
                    key={i}
                    onClick={() => handleAddSuggested(s.name)}
                    className="w-full text-left bg-white p-3 rounded-lg border border-shift-blue/10 shadow-sm hover:border-shift-blue hover:shadow-md transition-all group"
                   >
                     <div className="flex justify-between items-center">
                        <span className="font-bold text-sm text-shift-dark group-hover:text-shift-blue transition-colors">{s.name}</span>
                        <Plus size={14} className="text-shift-blue" />
                     </div>
                     <p className="text-[10px] text-gray-400 mt-1 italic">{s.reason}</p>
                   </button>
                 ))}
               </div>
            </div>
          )}

          {activeOrder.items.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-gray-300 space-y-2 py-10">
              <ChefHat size={48} />
              <p>No items yet</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-200 space-y-3">
          <div className="flex justify-between items-center text-lg font-bold">
            <span>Total</span>
            <span className="font-mono text-2xl text-shift-blue">${activeOrder.total.toFixed(2)}</span>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setIsSplitModalOpen(true)}
                disabled={activeOrder.items.length === 0}
                className="py-4 bg-white text-shift-dark border-2 border-gray-200 rounded-xl font-bold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                title="Split Bill"
              >
                  <Divide size={20} />
              </button>
              <button
                onClick={handleGetAISuggestions}
                disabled={activeOrder.items.length === 0 || isSuggesting}
                className="py-4 bg-shift-magenta text-white rounded-xl font-bold hover:bg-magenta-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-magenta-900/20"
                title="AI Upsell"
              >
                  {isSuggesting ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
              </button>
              <button 
                onClick={() => completeOrder(activeOrder.id)}
                disabled={activeOrder.items.length === 0}
                className="py-4 bg-shift-blue text-white rounded-xl font-bold text-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
              >
                PAY
              </button>
          </div>
        </div>
      </div>

      {/* Split Bill Modal (Unchanged) */}
      {isSplitModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-4xl h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fade-in">
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                      <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <Divide className="text-shift-blue" /> Split Bill
                        </h2>
                        <p className="text-sm text-gray-500">Order #{activeOrder.id.slice(-4)} • Total: ${activeOrder.total.toFixed(2)}</p>
                      </div>
                      <button onClick={() => setIsSplitModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full">
                          <X size={24} />
                      </button>
                  </div>
                  
                  <div className="flex p-2 bg-white border-b border-gray-100">
                      <button 
                        onClick={() => setSplitMode('EQUAL')}
                        className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${splitMode === 'EQUAL' ? 'bg-shift-dark text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                      >
                          Equal Split (By Head)
                      </button>
                      <button 
                        onClick={() => setSplitMode('ITEM')}
                        className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${splitMode === 'ITEM' ? 'bg-shift-dark text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
                      >
                          Split by Item
                      </button>
                  </div>

                  <div className="flex-1 overflow-hidden p-6 bg-[#F8F9FA]">
                      {splitMode === 'EQUAL' ? (
                          <div className="h-full flex flex-col items-center justify-center space-y-8">
                               <div className="flex items-center gap-6">
                                   <button onClick={() => setSplitGuests(Math.max(2, splitGuests - 1))} className="w-16 h-16 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center hover:bg-gray-100"><Minus size={24} /></button>
                                   <div className="text-center">
                                       <div className="text-6xl font-bold text-shift-blue">{splitGuests}</div>
                                       <p className="text-gray-400 font-bold uppercase tracking-widest mt-2">Guests</p>
                                   </div>
                                   <button onClick={() => setSplitGuests(Math.min(20, splitGuests + 1))} className="w-16 h-16 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center hover:bg-gray-100"><Plus size={24} /></button>
                               </div>
                               <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center">
                                   <p className="text-gray-500 mb-2">Amount per person</p>
                                   <div className="text-5xl font-mono font-bold text-shift-dark mb-6">${(activeOrder.total / splitGuests).toFixed(2)}</div>
                                   <button onClick={() => { completeOrder(activeOrder.id); setIsSplitModalOpen(false); }} className="w-full py-4 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors flex items-center justify-center gap-2"><CheckCircle size={20} /> Mark All Paid</button>
                               </div>
                          </div>
                      ) : (
                          <div className="h-full flex gap-6">
                              <div className="w-1/3 flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                  <div className="p-4 bg-gray-50 border-b border-gray-100 font-bold flex justify-between">
                                      <span>Order Items</span>
                                      <span className="text-xs bg-gray-200 px-2 py-1 rounded">${getUnassignedTotal().toFixed(2)} Left</span>
                                  </div>
                                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                      {getExplodedItems().map(({uniqueKey, item}) => {
                                          const assignedGuestId = itemAssignments[uniqueKey];
                                          const isAssigned = assignedGuestId !== undefined;
                                          const assignedGuestName = guestChecks.find(g => g.id === assignedGuestId)?.name;
                                          return (
                                              <button key={uniqueKey} onClick={() => handleAssignItem(uniqueKey)} className={`w-full text-left p-3 rounded-lg border transition-all flex justify-between items-center ${isAssigned ? 'bg-gray-50 border-gray-100 opacity-50' : 'bg-white border-gray-200 hover:border-shift-blue shadow-sm'}`}>
                                                  <div>
                                                      <p className={`font-bold text-sm ${isAssigned ? 'text-gray-400' : 'text-gray-800'}`}>{item.name}</p>
                                                      <p className="text-xs text-gray-400 font-mono">${item.price.toFixed(2)}</p>
                                                  </div>
                                                  {isAssigned ? <span className="text-[10px] font-bold bg-gray-200 text-gray-500 px-2 py-1 rounded">{assignedGuestName}</span> : <ArrowRight size={16} className="text-shift-blue" />}
                                              </button>
                                          );
                                      })}
                                  </div>
                              </div>
                              <div className="flex-1 flex flex-col gap-4">
                                  <div className="flex gap-2 overflow-x-auto pb-2">
                                      {guestChecks.map(guest => (
                                          <button key={guest.id} onClick={() => setSelectedGuestId(guest.id)} className={`px-4 py-3 rounded-xl font-bold whitespace-nowrap transition-all border-2 ${selectedGuestId === guest.id ? 'bg-shift-blue text-white border-shift-blue shadow-lg scale-105' : 'bg-white text-gray-600 border-transparent hover:bg-gray-100'}`}>
                                              {guest.name}
                                              <div className="text-xs font-mono font-normal mt-1 opacity-80">${getGuestTotal(guest.id).toFixed(2)}</div>
                                          </button>
                                      ))}
                                      <button onClick={() => { const newId = guestChecks.length + 1; setGuestChecks([...guestChecks, {id: newId, name: `Guest ${newId}`}]); setSelectedGuestId(newId); }} className="px-4 py-2 bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200 border-2 border-transparent border-dashed border-gray-300"><Plus size={20} /></button>
                                  </div>
                                  <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col">
                                      <h3 className="font-bold text-lg mb-4 text-shift-blue flex items-center gap-2"><Users size={18}/> {guestChecks.find(g => g.id === selectedGuestId)?.name}'s Bill</h3>
                                      <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                                          {getExplodedItems().filter(({uniqueKey}) => itemAssignments[uniqueKey] === selectedGuestId).map(({uniqueKey, item}) => (
                                                <div key={uniqueKey} className="flex justify-between items-center p-2 border-b border-gray-50">
                                                    <span className="text-sm font-medium">{item.name}</span>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-mono text-sm">${item.price.toFixed(2)}</span>
                                                        <button onClick={() => handleAssignItem(uniqueKey)} className="text-gray-300 hover:text-red-500"><X size={14} /></button>
                                                    </div>
                                                </div>
                                            ))}
                                      </div>
                                      <div className="pt-4 border-t border-gray-100">
                                          <div className="flex justify-between items-center mb-4"><span className="font-bold">Subtotal</span><span className="font-mono font-bold text-xl">${getGuestTotal(selectedGuestId).toFixed(2)}</span></div>
                                          <button className="w-full py-3 bg-shift-dark text-white rounded-lg font-bold hover:bg-black transition-colors" onClick={() => alert(`Printing bill for ${guestChecks.find(g => g.id === selectedGuestId)?.name}...`)}>Print {guestChecks.find(g => g.id === selectedGuestId)?.name}'s Check</button>
                                      </div>
                                  </div>
                                  <button onClick={() => { completeOrder(activeOrder.id); setIsSplitModalOpen(false); }} disabled={getUnassignedTotal() > 0} className="w-full py-4 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed shadow-lg transition-all">{getUnassignedTotal() > 0 ? `Assign remaining $${getUnassignedTotal().toFixed(2)} to finish` : 'Complete All Payments'}</button>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default POS;
