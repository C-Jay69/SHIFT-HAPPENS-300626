import React from 'react';
import { useAppStore } from '../store.tsx';
import { OrderStatus } from '../types.ts';
import { Clock, CheckCircle, ChefHat, Coffee, AlertCircle } from 'lucide-react';

const KDS = () => {
  const { orders, updateOrderStatus, tables } = useAppStore();

  // Filter for active kitchen orders
  const activeOrders = orders.filter(
    o => o.status === OrderStatus.PREPARING || o.status === OrderStatus.READY
  );

  const handleBump = (orderId: string, currentStatus: OrderStatus) => {
    if (currentStatus === OrderStatus.PREPARING) {
      updateOrderStatus(orderId, OrderStatus.READY);
    } else if (currentStatus === OrderStatus.READY) {
      updateOrderStatus(orderId, OrderStatus.SERVED);
    }
  };

  if (activeOrders.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
        <div className="p-6 bg-white rounded-full shadow-sm">
          <ChefHat size={64} className="text-shift-gray" />
        </div>
        <h2 className="text-2xl font-bold text-shift-dark">Kitchen is Clear</h2>
        <p>No active orders to prepare.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-x-auto">
      <div className="flex gap-4 min-w-max p-2">
        {activeOrders.map(order => {
          const table = tables.find(t => t.id === order.tableId);
          const isReady = order.status === OrderStatus.READY;
          
          return (
            <div 
              key={order.id} 
              className={`w-80 flex flex-col rounded-xl border-2 shadow-lg overflow-hidden transition-all ${
                isReady ? 'border-green-500 bg-green-50' : 'border-shift-blue bg-white'
              }`}
            >
              {/* Header */}
              <div className={`p-4 text-white flex justify-between items-center ${
                isReady ? 'bg-green-500' : 'bg-shift-blue'
              }`}>
                <div>
                  <h3 className="font-bold text-lg">#{order.id.slice(-4)}</h3>
                  <span className="text-xs font-mono opacity-90">{table?.name || 'Unknown Table'}</span>
                </div>
                <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded text-xs font-bold">
                  <Clock size={14} />
                  <span>{new Date(order.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
              </div>

              {/* Items */}
              <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[400px]">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 border-b border-gray-100 pb-2 last:border-0">
                    <span className="font-mono font-bold text-lg text-shift-dark min-w-[2rem]">{item.quantity}x</span>
                    <div className="flex-1">
                      <p className="font-bold text-gray-800 leading-tight">{item.name}</p>
                      {item.notes ? (
                          <div className="flex items-start gap-1 mt-1 text-red-600 bg-red-50 p-1.5 rounded">
                              <AlertCircle size={12} className="shrink-0 mt-0.5" />
                              <p className="text-xs font-bold">{item.notes}</p>
                          </div>
                      ) : (
                          <p className="text-xs text-gray-300 italic mt-1">No modifiers</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer / Action */}
              <div className="p-4 border-t border-gray-200 bg-white/50">
                <button
                  onClick={() => handleBump(order.id, order.status)}
                  className={`w-full py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition-colors shadow-md ${
                    isReady 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-shift-dark hover:bg-black'
                  }`}
                >
                  {isReady ? (
                    <>
                      <CheckCircle size={20} /> ORDER SERVED
                    </>
                  ) : (
                    <>
                      <Coffee size={20} /> MARK READY
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default KDS;