import React, { useState } from 'react';
import { useAppStore } from '../store.tsx';
import { AlertTriangle, ArrowDown, Search, Pencil, X, RefreshCcw, Truck, Plus, Check, Save } from 'lucide-react';
import { Ingredient } from '../types.ts';

interface Supplier {
  id: string;
  name: string;
  contact: string;
  ingredients: string[];
}

const Inventory = () => {
  const { ingredients, updateIngredient } = useAppStore();
  
  // Edit Ingredient State
  const [editingId, setEditingId] = useState<string | null>(null);
  // Use string | number to handle input state gracefully
  const [editForm, setEditForm] = useState<{
    stock: string | number;
    threshold: string | number;
    costPerUnit: string | number;
  }>({ stock: 0, threshold: 0, costPerUnit: 0 });

  // Supplier State
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([
    { id: 'sup_1', name: 'Sysco', contact: '555-0199', ingredients: ['Beef Patty', 'Brioche Bun'] },
    { id: 'sup_2', name: 'Local Farms', contact: '555-0288', ingredients: ['Lettuce', 'Tomato'] }
  ]);
  const [newSupplierName, setNewSupplierName] = useState('');

  const startEdit = (ing: Ingredient) => {
    setEditingId(ing.id);
    setEditForm({
      stock: ing.stock,
      threshold: ing.threshold,
      costPerUnit: ing.costPerUnit
    });
  };

  const handleSave = () => {
    if (editingId) {
      updateIngredient(editingId, {
        stock: Number(editForm.stock),
        threshold: Number(editForm.threshold),
        costPerUnit: Number(editForm.costPerUnit)
      });
      setEditingId(null);
      setEditForm({ stock: 0, threshold: 0, costPerUnit: 0 });
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({ stock: 0, threshold: 0, costPerUnit: 0 });
  };
  
  const handleQuickRestock = (ing: Ingredient) => {
    updateIngredient(ing.id, { stock: ing.threshold * 2.5 });
  };
  
  const handleAddSupplier = () => {
    if (newSupplierName.trim()) {
      setSuppliers([...suppliers, {
        id: `sup_${Date.now()}`,
        name: newSupplierName,
        contact: 'Pending',
        ingredients: []
      }]);
      setNewSupplierName('');
      setIsSupplierModalOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-shift-dark">Inventory</h2>
          <p className="text-gray-500">Live tracking. Connected to POS.</p>
        </div>
        <button 
          onClick={() => setIsSupplierModalOpen(true)}
          className="bg-shift-dark text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-800 active:scale-95 transition-all flex items-center gap-2"
        >
          <Truck size={16} /> Manage Suppliers
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-red-100 text-red-600 rounded-lg">
              <AlertTriangle size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-bold">Low Stock Items</p>
              <p className="text-2xl font-bold">{ingredients.filter(i => i.stock <= i.threshold).length}</p>
            </div>
         </div>
         <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
              <Truck size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-bold">Active Suppliers</p>
              <p className="text-2xl font-bold">{suppliers.length}</p>
            </div>
         </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
           <div className="relative w-full md:w-64">
             <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
             <input 
                type="text" 
                placeholder="Search ingredients..." 
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-shift-blue"
             />
           </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold">
              <tr>
                <th className="px-6 py-4">Ingredient Name</th>
                <th className="px-6 py-4">Current Stock</th>
                <th className="px-6 py-4">Unit</th>
                <th className="px-6 py-4">Status / Threshold</th>
                <th className="px-6 py-4 text-right">Cost/Unit</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ingredients.map((ing) => {
                const isEditing = ing.id === editingId;
                const isLow = ing.stock <= ing.threshold;

                if (isEditing) {
                  return (
                    <tr key={ing.id} className="bg-blue-50/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{ing.name}</td>
                      <td className="px-6 py-4">
                        <input 
                          type="number" 
                          min="0"
                          value={editForm.stock}
                          onChange={(e) => setEditForm({...editForm, stock: e.target.value})}
                          className="w-24 p-2 border border-shift-blue rounded-lg font-mono bg-white focus:outline-none focus:ring-2 focus:ring-shift-blue/20"
                          autoFocus
                        />
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-sm">{ing.unit}</td>
                      <td className="px-6 py-4">
                         <div className="flex items-center gap-2">
                           <span className="text-[10px] uppercase font-bold text-gray-400">Min</span>
                           <input 
                            type="number" 
                            min="0"
                            value={editForm.threshold}
                            onChange={(e) => setEditForm({...editForm, threshold: e.target.value})}
                            className="w-20 p-2 border border-shift-blue rounded-lg font-mono bg-white text-sm focus:outline-none focus:ring-2 focus:ring-shift-blue/20"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <div className="flex justify-end items-center gap-1">
                           <span className="text-gray-400 text-sm">$</span>
                           <input 
                              type="number" 
                              step="0.01"
                              min="0"
                              value={editForm.costPerUnit}
                              onChange={(e) => setEditForm({...editForm, costPerUnit: e.target.value})}
                              className="w-24 p-2 border border-shift-blue rounded-lg font-mono bg-white text-right focus:outline-none focus:ring-2 focus:ring-shift-blue/20"
                            />
                         </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={handleSave} 
                            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm flex items-center gap-1 text-xs font-bold"
                            title="Save Changes"
                          >
                            <Check size={14} /> Save
                          </button>
                          <button 
                            onClick={handleCancel} 
                            className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors shadow-sm flex items-center gap-1 text-xs font-bold"
                            title="Discard Changes"
                          >
                            <X size={14} /> Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={ing.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{ing.name}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-mono font-bold ${isLow ? 'text-red-600' : 'text-gray-700'}`}>
                          {ing.stock.toFixed(2)}
                        </span>
                        {isLow && <ArrowDown size={14} className="text-red-500" />}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-sm">{ing.unit}</td>
                    <td className="px-6 py-4">
                      {isLow ? (
                        <button 
                          onClick={() => handleQuickRestock(ing)}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-700 border border-red-200 hover:bg-red-200 transition-colors"
                          title="Click to Quick Restock"
                        >
                          <RefreshCcw size={10} /> REORDER (Low)
                        </button>
                      ) : (
                        <span className="px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                          OK
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-sm text-gray-600">
                      ${ing.costPerUnit.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => startEdit(ing)} 
                        className="flex items-center gap-1 ml-auto px-3 py-1.5 bg-gray-100 hover:bg-blue-100 text-gray-600 hover:text-shift-blue rounded-lg transition-colors text-xs font-bold"
                        aria-label="Edit ingredient"
                      >
                        <Pencil size={14} /> Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supplier Modal */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-fade-in">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-shift-dark">Manage Suppliers</h3>
              <button onClick={() => setIsSupplierModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <div className="p-6">
               <div className="mb-6 space-y-3">
                 {suppliers.map(sup => (
                   <div key={sup.id} className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex justify-between items-center">
                      <div>
                        <p className="font-bold">{sup.name}</p>
                        <p className="text-xs text-gray-500">{sup.contact}</p>
                      </div>
                      <span className="text-xs font-bold bg-green-100 text-green-800 px-2 py-1 rounded">Active</span>
                   </div>
                 ))}
               </div>
               
               <div className="border-t border-gray-100 pt-4">
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Add New Supplier</label>
                 <div className="flex gap-2">
                   <input 
                     type="text"
                     value={newSupplierName}
                     onChange={(e) => setNewSupplierName(e.target.value)}
                     placeholder="Supplier Name"
                     className="flex-1 p-2 border border-gray-200 rounded-lg focus:outline-none focus:border-shift-blue"
                   />
                   <button 
                     onClick={handleAddSupplier}
                     className="bg-shift-dark text-white px-4 rounded-lg font-bold hover:bg-gray-800"
                   >
                     <Plus size={20} />
                   </button>
                 </div>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;