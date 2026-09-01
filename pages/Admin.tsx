import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../store.tsx';
import { MenuItem } from '../types.ts';
import { api } from '../services/api.ts';
import FinancePanel from '../components/FinancePanel.tsx';
import { Lock, Save, Plus, Trash2, AlertTriangle, Activity, Database, Bot, Settings, RefreshCcw, Check, X, LogOut, Calendar, Plug, ExternalLink } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#0000FF', '#FFBF00', '#BEF754', '#FF00FF', '#00FFFF'];

const COLOR_OPTIONS = [
  { name: 'Amber', class: 'bg-shift-amber', hex: '#FFBF00' },
  { name: 'Lime', class: 'bg-shift-lime', hex: '#BEF754' },
  { name: 'Cyan', class: 'bg-shift-cyan', hex: '#00FFFF' },
  { name: 'Magenta', class: 'bg-shift-magenta', hex: '#FF00FF' },
  { name: 'Gray', class: 'bg-shift-gray', hex: '#DCDFD5' },
  { name: 'Blue', class: 'bg-shift-blue text-white', hex: '#0000FF' },
];

const Admin = () => {
  const { menuItems, updateMenuItem, addMenuItem, deleteMenuItem, systemPrompt, updateSystemPrompt, orders, ingredients, authUser, logout } = useAppStore();
  
  // Tabs (INTEGRATIONS opens directly from the Google OAuth callback URL)
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'MENU' | 'AI' | 'SYSTEM' | 'INTEGRATIONS' | 'FINANCE'>(
    () => (searchParams.get('tab') === 'INTEGRATIONS' ? 'INTEGRATIONS' : 'DASHBOARD'),
  );
  const gcalConnected = searchParams.get('gcal') === 'connected';
  
  // Forms
  const [editItem, setEditItem] = useState<Partial<MenuItem> | null>(null);
  const [isNewItem, setIsNewItem] = useState(false);
  const [promptForm, setPromptForm] = useState(systemPrompt);

  const handleSaveMenuItem = () => {
    if (!editItem || !editItem.name || !editItem.price) {
        alert("Name and Price are required.");
        return;
    }
    
    if (isNewItem) {
      const newItem: MenuItem = {
        id: `menu_${Date.now()}`,
        name: editItem.name,
        price: Number(editItem.price),
        category: editItem.category || 'FOOD',
        color: editItem.color || 'bg-shift-gray',
        recipe: [] // Simplified for this demo
      };
      addMenuItem(newItem);
    } else if (editItem.id) {
      updateMenuItem(editItem.id, editItem);
    }
    
    setEditItem(null);
    setIsNewItem(false);
  };

  const handleSavePrompt = () => {
    updateSystemPrompt(promptForm);
    alert('AI Persona Updated Successfully');
  };

  if (!authUser) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh]">
        <div className="bg-white p-8 rounded-2xl shadow-2xl border border-gray-200 w-full max-w-sm text-center space-y-6">
          <div className="w-16 h-16 bg-shift-dark rounded-full flex items-center justify-center mx-auto text-white">
            <Lock size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-shift-dark">Admin Access</h2>
            <p className="text-gray-500">Sign in to continue</p>
          </div>
          <Link to="/login" className="block w-full py-4 bg-shift-blue text-white font-bold rounded-xl hover:bg-blue-700 transition-colors">
            GO TO SIGN IN
          </Link>
        </div>
      </div>
    );
  }

  // Analytics Data Prep
  const salesByCategory = menuItems.map(item => {
    const count = orders.reduce((acc, order) => acc + order.items.filter(i => i.menuItemId === item.id).reduce((s, i) => s + i.quantity, 0), 0);
    return { name: item.name, value: count };
  }).filter(i => i.value > 0);

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
           <h1 className="text-2xl font-bold flex items-center gap-2">
             <Activity className="text-shift-blue" /> Admin Console
           </h1>
           <p className="text-sm text-gray-500">System configuration and advanced analytics.</p>
           <p className="text-xs text-gray-400 mt-1 font-mono">
             Signed in as <span className="font-bold text-shift-blue">{authUser.email}</span> · {authUser.role}
             <button onClick={logout} className="ml-3 text-red-500 hover:text-red-700 font-bold inline-flex items-center gap-1">
               <LogOut size={12} /> Sign out
             </button>
           </p>
        </div>
        <div className="flex gap-2 mt-4 md:mt-0">
           {['DASHBOARD', 'MENU', 'AI', 'INTEGRATIONS', 'FINANCE', 'SYSTEM'].map(tab => (
             <button
               key={tab}
               onClick={() => setActiveTab(tab as any)}
               className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                 activeTab === tab 
                   ? 'bg-shift-dark text-white' 
                   : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
               }`}
             >
               {tab}
             </button>
           ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* DASHBOARD TAB */}
        {activeTab === 'DASHBOARD' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
             <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
               <h3 className="font-bold mb-4">Sales Mix by Item</h3>
               <div className="h-64">
                 <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                     <Pie
                       data={salesByCategory}
                       cx="50%"
                       cy="50%"
                       innerRadius={60}
                       outerRadius={80}
                       paddingAngle={5}
                       dataKey="value"
                     >
                       {salesByCategory.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                       ))}
                     </Pie>
                     <Tooltip />
                   </PieChart>
                 </ResponsiveContainer>
               </div>
             </div>
             
             <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
               <h3 className="font-bold mb-4">Inventory Health</h3>
               <div className="space-y-4">
                 {ingredients.slice(0, 5).map(ing => (
                   <div key={ing.id}>
                     <div className="flex justify-between text-xs mb-1">
                       <span className="font-bold">{ing.name}</span>
                       <span className="text-gray-500">{ing.stock} / {ing.threshold * 3} {ing.unit}</span>
                     </div>
                     <div className="w-full bg-gray-100 rounded-full h-2">
                       <div 
                         className={`h-2 rounded-full ${ing.stock < ing.threshold ? 'bg-red-500' : 'bg-green-500'}`} 
                         style={{ width: `${Math.min(100, (ing.stock / (ing.threshold * 3)) * 100)}%` }}
                       />
                     </div>
                   </div>
                 ))}
               </div>
             </div>
          </div>
        )}

        {/* MENU TAB */}
        {activeTab === 'MENU' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-fade-in">
             <div className="p-6 border-b border-gray-100 flex justify-between items-center">
               <h3 className="font-bold">Menu Management</h3>
               <button 
                 onClick={() => { setIsNewItem(true); setEditItem({ name: '', price: 0, category: 'FOOD', color: 'bg-shift-gray' }); }}
                 className="flex items-center gap-2 bg-shift-blue text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
               >
                 <Plus size={16} /> Add Item
               </button>
             </div>
             
             {editItem && (
               <div className="p-6 bg-blue-50 border-b border-blue-100 animate-fade-in">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="font-bold text-blue-800">{isNewItem ? 'Create New Item' : 'Edit Item'}</h4>
                    <button onClick={() => setEditItem(null)} className="text-blue-400 hover:text-blue-800"><X size={18}/></button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Left Column: Inputs */}
                    <div className="space-y-4">
                        <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Name</label>
                        <input 
                            className="w-full p-3 border border-blue-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-shift-blue/20" 
                            value={editItem.name} 
                            onChange={e => setEditItem({...editItem, name: e.target.value})}
                            placeholder="e.g., Truffle Fries"
                        />
                        </div>
                        <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Price ($)</label>
                        <input 
                            type="number"
                            step="0.01"
                            className="w-full p-3 border border-blue-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-shift-blue/20" 
                            value={editItem.price} 
                            onChange={e => setEditItem({...editItem, price: parseFloat(e.target.value)})}
                        />
                        </div>
                        <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Category</label>
                        <select 
                            className="w-full p-3 border border-blue-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-shift-blue/20"
                            value={editItem.category}
                            onChange={e => setEditItem({...editItem, category: e.target.value as any})}
                        >
                            <option value="FOOD">FOOD</option>
                            <option value="DRINK">DRINK</option>
                            <option value="DESSERT">DESSERT</option>
                        </select>
                        </div>
                    </div>

                    {/* Right Column (Color) */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Card Style</label>
                        <div className="grid grid-cols-3 gap-3">
                            {COLOR_OPTIONS.map((option) => (
                                <button
                                    key={option.name}
                                    onClick={() => setEditItem({...editItem, color: option.class})}
                                    className={`
                                        relative h-16 rounded-lg border-2 transition-all flex flex-col items-center justify-center
                                        ${editItem.color === option.class ? 'border-black ring-1 ring-black scale-105' : 'border-transparent hover:border-gray-300'}
                                    `}
                                    style={{ backgroundColor: option.hex }}
                                >
                                    <span className={`text-[10px] font-bold uppercase ${option.name === 'Blue' || option.name === 'Dark' ? 'text-white' : 'text-black'}`}>
                                        {option.name}
                                    </span>
                                    {editItem.color === option.class && (
                                        <div className="absolute -top-2 -right-2 bg-black text-white rounded-full p-0.5">
                                            <Check size={12} />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                        
                        <div className="mt-6 p-3 bg-white rounded-lg border border-gray-200">
                             <p className="text-xs text-gray-400 uppercase font-bold mb-2">Preview</p>
                             <div className={`${editItem.color} h-24 rounded-lg p-3 flex flex-col justify-between shadow-sm`}>
                                <span className="font-bold text-sm leading-tight text-shift-dark bg-white/80 px-2 py-1 rounded w-fit">{editItem.name || 'Item Name'}</span>
                                <span className="bg-white/90 px-2 py-1 rounded-md font-mono font-bold text-shift-dark w-fit">${Number(editItem.price || 0).toFixed(2)}</span>
                             </div>
                        </div>
                    </div>
                  </div>

                  {/* Recipe Breakdown Section */}
                  <div className="mb-6">
                     <h4 className="text-xs font-bold text-shift-blue uppercase mb-2 flex items-center gap-2">
                        <Database size={14} /> Recipe & Inventory Impact
                     </h4>
                     <div className="bg-white rounded-lg border border-blue-200 p-4">
                        {editItem.recipe && editItem.recipe.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {editItem.recipe.map((r, idx) => {
                                    const ing = ingredients.find(i => i.id === r.ingredientId);
                                    return (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm text-gray-700">{ing?.name || 'Unknown'}</span>
                                                <span className="text-[10px] text-gray-400 uppercase">In Stock: {ing?.stock} {ing?.unit}</span>
                                            </div>
                                            <span className="font-mono font-bold text-shift-blue bg-blue-100 px-2 py-1 rounded text-xs">
                                                -{r.quantity} {ing?.unit}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center p-8 text-gray-400 italic bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                No ingredients configured. This item will not deduct from inventory.
                            </div>
                        )}
                     </div>
                  </div>
                  
                  <div className="flex gap-3 justify-end pt-4 border-t border-blue-200">
                    <button onClick={() => setEditItem(null)} className="px-6 py-2 text-gray-500 font-bold hover:bg-blue-100 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleSaveMenuItem} className="px-6 py-2 bg-shift-blue text-white font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                        <Save size={18} /> Save Item
                    </button>
                  </div>
               </div>
             )}

             <table className="w-full text-left">
               <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold">
                 <tr>
                   <th className="px-6 py-3">Name</th>
                   <th className="px-6 py-3">Category</th>
                   <th className="px-6 py-3 text-right">Price</th>
                   <th className="px-6 py-3 text-right">Actions</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                 {menuItems.map(item => (
                   <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                     <td className="px-6 py-3 font-medium flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full ${item.color.split(' ')[0]}`} style={{ border: '1px solid rgba(0,0,0,0.1)' }} />
                        {item.name}
                     </td>
                     <td className="px-6 py-3">
                       <span className={`text-xs font-bold px-2 py-1 rounded ${item.category === 'FOOD' ? 'bg-orange-100 text-orange-800' : item.category === 'DRINK' ? 'bg-purple-100 text-purple-800' : 'bg-pink-100 text-pink-800'}`}>
                         {item.category}
                       </span>
                     </td>
                     <td className="px-6 py-3 text-right font-mono">${item.price.toFixed(2)}</td>
                     <td className="px-6 py-3 text-right">
                       <div className="flex justify-end gap-2">
                         <button onClick={() => { setIsNewItem(false); setEditItem(item); }} className="p-2 hover:bg-blue-100 rounded-full text-blue-600 transition-colors"><Settings size={16}/></button>
                         <button 
                            onClick={() => {
                                if(window.confirm('Are you sure you want to delete this item?')) {
                                    deleteMenuItem(item.id);
                                }
                            }} 
                            className="p-2 hover:bg-red-100 rounded-full text-red-600 transition-colors"
                        >
                            <Trash2 size={16}/>
                        </button>
                       </div>
                     </td>
                   </tr>
                 ))}
                 {menuItems.length === 0 && (
                     <tr>
                         <td colSpan={4} className="p-8 text-center text-gray-400 italic">No menu items found. Click "Add Item" to create one.</td>
                     </tr>
                 )}
               </tbody>
             </table>
          </div>
        )}

        {/* AI TAB */}
        {activeTab === 'AI' && (
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm animate-fade-in">
             <div className="flex items-start gap-4 mb-6">
               <div className="p-3 bg-shift-magenta text-white rounded-lg">
                 <Bot size={24} />
               </div>
               <div>
                 <h3 className="font-bold text-lg">AI Personality Trainer</h3>
                 <p className="text-gray-500 text-sm">Configure the system prompt and context for ShiftBot.</p>
               </div>
             </div>
             
             <div className="space-y-4">
               <label className="block font-bold text-sm">System Instruction / Persona</label>
               <textarea 
                 className="w-full h-64 p-4 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm focus:border-shift-magenta focus:outline-none resize-none"
                 value={promptForm}
                 onChange={(e) => setPromptForm(e.target.value)}
               />
               <div className="flex justify-between items-center">
                 <p className="text-xs text-gray-400">Changes apply to new chat sessions immediately.</p>
                 <button 
                   onClick={handleSavePrompt}
                   className="px-6 py-3 bg-shift-dark text-white font-bold rounded-xl hover:bg-black flex items-center gap-2"
                 >
                   <Save size={18} /> Update Persona
                 </button>
               </div>
             </div>
          </div>
        )}

        {/* INTEGRATIONS TAB */}
        {activeTab === 'INTEGRATIONS' && (
          <IntegrationsTab gcalConnected={gcalConnected} />
        )}

        {/* FINANCE TAB */}
        {activeTab === 'FINANCE' && (
          <FinancePanel />
        )}

        {/* SYSTEM TAB */}
        {activeTab === 'SYSTEM' && (
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm animate-fade-in">
             <h3 className="font-bold text-lg mb-6 text-red-600 flex items-center gap-2">
               <AlertTriangle size={20} /> Danger Zone
             </h3>
             <div className="p-4 border border-red-100 bg-red-50 rounded-xl flex justify-between items-center">
                <div>
                  <p className="font-bold text-red-900">Factory Reset</p>
                  <p className="text-sm text-red-700">Clears all local data, orders, and reservations.</p>
                </div>
                <button 
                  onClick={() => window.location.reload()} 
                  className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700"
                >
                  Reset App
                </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Integrations tab — live service status + Google Calendar connection
// ---------------------------------------------------------------------------

interface IntegrationInfo {
  key: string;
  label: string;
  configured: boolean;
  note?: string;
}

const IntegrationsTab = ({ gcalConnected }: { gcalConnected: boolean }) => {
  const [integrations, setIntegrations] = useState<IntegrationInfo[]>([]);
  const [gcal, setGcal] = useState<{ configured: boolean; connected: boolean } | null>(null);

  const load = () => {
    api.get<IntegrationInfo[]>('/integrations').then(setIntegrations).catch(() => setIntegrations([]));
    api.get<{ configured: boolean; connected: boolean }>('/integrations/google-calendar')
      .then(setGcal).catch(() => setGcal(null));
  };

  useEffect(load, []);

  const connect = async () => {
    try {
      const { url } = await api.get<{ url: string }>('/integrations/google-calendar/authorize');
      window.open(url, 'gcal-auth', 'width=520,height=680');
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const disconnect = async () => {
    try {
      await api.post('/integrations/google-calendar/disconnect');
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {gcalConnected && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl flex items-center gap-2 font-bold">
          <Check size={16} /> Google Calendar connected — reservations will sync to your calendar.
        </div>
      )}

      {/* Google Calendar card */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-shift-blue/10 text-shift-blue rounded-lg">
              <Calendar size={22} />
            </div>
            <div>
              <h3 className="font-bold text-lg">Google Calendar</h3>
              <p className="text-sm text-gray-500 max-w-md">
                Confirmed reservations appear in your primary calendar; cancellations remove them.
                You'll also get a conflict warning when booking over an existing calendar commitment.
              </p>
            </div>
          </div>
          {gcal?.connected ? (
            <button onClick={disconnect} className="px-4 py-2 border-2 border-red-300 text-red-600 font-bold rounded-lg hover:bg-red-50 text-sm whitespace-nowrap">
              Disconnect
            </button>
          ) : (
            <button
              onClick={connect}
              disabled={!gcal?.configured}
              className="px-4 py-2 bg-shift-blue text-white font-bold rounded-lg hover:bg-blue-700 text-sm flex items-center gap-2 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ExternalLink size={14} /> Connect
            </button>
          )}
        </div>
        {gcal && !gcal.configured && (
          <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Server needs GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and PUBLIC_BASE_URL set in .env (see .env.example).
          </p>
        )}
      </div>

      {/* Status list */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="font-bold text-lg mb-1 flex items-center gap-2"><Plug size={18} /> Service Status</h3>
        <p className="text-sm text-gray-500 mb-4">Key-gated: every service switches on when its credentials are set.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {integrations.map((i) => (
            <div key={i.key} className="flex items-center justify-between border border-gray-100 rounded-lg px-4 py-3">
              <div>
                <p className="font-bold text-sm">{i.label}</p>
                {i.note && <p className="text-[11px] text-gray-400 mt-0.5">{i.note}</p>}
              </div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${i.configured ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                {i.configured ? 'CONFIGURED' : 'OFF'}
              </span>
            </div>
          ))}
          {integrations.length === 0 && <p className="text-gray-400 text-sm">API unreachable.</p>}
        </div>
      </div>
    </div>
  );
};

export default Admin;