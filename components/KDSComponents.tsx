import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '../store.tsx';
import { Order, OrderStatus, OrderItem, Table } from '../types.ts';
import { connectRealtime, onRealtime } from '../services/realtime.ts';
import { Clock, CheckCircle, ChefHat, Coffee, AlertCircle, Bell, BellOff, MoreVertical, X, Zap, Loader2 } from 'lucide-react';

interface OrderTicketProps {
  order: Order;
  tables: Table[];
  onBump: (orderId: string, currentStatus: OrderStatus) => void;
  onViewDetails: (order: Order) => void;
  autoRefresh?: boolean;
}

const STATUS_CONFIG: Record<OrderStatus, { 
  bg: string; 
  border: string; 
  headerBg: string; 
  text: string; 
  icon: React.ReactNode;
  label: string;
  nextLabel: string;
}> = {
  [OrderStatus.PENDING]: { 
    bg: 'bg-gray-50', 
    border: 'border-gray-300', 
    headerBg: 'bg-gray-400', 
    text: 'text-gray-700',
    icon: <Clock size={16} className="text-gray-500" />,
    label: 'Pending',
    nextLabel: 'Send to Kitchen'
  },
  [OrderStatus.PREPARING]: { 
    bg: 'bg-blue-50', 
    border: 'border-blue-500', 
    headerBg: 'bg-blue-600', 
    text: 'text-blue-700',
    icon: <ChefHat size={16} className="text-blue-500" />,
    label: 'Preparing',
    nextLabel: 'Mark Ready'
  },
  [OrderStatus.READY]: { 
    bg: 'bg-green-50', 
    border: 'border-green-500', 
    headerBg: 'bg-green-600', 
    text: 'text-green-700',
    icon: <CheckCircle size={16} className="text-green-500" />,
    label: 'Ready',
    nextLabel: 'Mark Served'
  },
  [OrderStatus.SERVED]: { 
    bg: 'bg-purple-50', 
    border: 'border-purple-500', 
    headerBg: 'bg-purple-600', 
    text: 'text-purple-700',
    icon: <Coffee size={16} className="text-purple-500" />,
    label: 'Served',
    nextLabel: 'Complete'
  },
  [OrderStatus.PAID]: { 
    bg: 'bg-gray-100', 
    border: 'border-gray-300', 
    headerBg: 'bg-gray-500', 
    text: 'text-gray-600',
    icon: <CheckCircle size={16} className="text-gray-500" />,
    label: 'Paid',
    nextLabel: ''
  },
  [OrderStatus.VOID]: { 
    bg: 'bg-red-50', 
    border: 'border-red-300', 
    headerBg: 'bg-red-500', 
    text: 'text-red-700',
    icon: <X size={16} className="text-red-500" />,
    label: 'Void',
    nextLabel: ''
  },
};

const OrderTicket = ({ order, tables, onBump, onViewDetails, autoRefresh = true }: OrderTicketProps) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isUrgent, setIsUrgent] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const table = tables.find(t => t.id === order.tableId);
  const statusConfig = STATUS_CONFIG[order.status];
  const startTime = new Date(order.timestamp).getTime();

  useEffect(() => {
    if (autoRefresh && (order.status === OrderStatus.PREPARING || order.status === OrderStatus.READY)) {
      const updateTimer = () => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setElapsedTime(elapsed);
        setIsUrgent(elapsed > 900); // 15 minutes
      };
      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [autoRefresh, order.status, startTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleBump = () => onBump(order.id, order.status);

  return (
    <div 
      className={`w-80 flex flex-col rounded-xl border-2 shadow-lg overflow-hidden transition-all ${
        statusConfig.bg} ${statusConfig.border}`}
      style={{ 
        animation: isUrgent ? 'pulse 1s infinite' : 'none',
        borderWidth: isUrgent ? '3px' : '2px',
      }}
    >
      {/* Header */}
      <div className={`${statusConfig.headerBg} text-white p-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          {statusConfig.icon}
          <div>
            <h3 className="font-bold text-lg">#{order.id.slice(-6)}</h3>
            <span className="text-xs opacity-90 font-mono">{table?.name || 'Unknown Table'} • {order.guests} guests</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-bold font-mono">
            {formatTime(elapsedTime)}
          </span>
          {isUrgent && (
            <span className="flex items-center gap-1 bg-red-500/20 px-2 py-0.5 rounded-full text-xs font-bold animate-pulse">
              <Zap size={10} /> URGENT
            </span>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[350px]">
        {order.items.map((item: OrderItem, idx) => (
          <div key={idx} className="border-b border-white/30 last:border-0 pb-2">
            <div className="flex items-start gap-3">
              <span className="font-mono font-bold text-lg text-white/90 min-w-[2rem]">{item.quantity}x</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white leading-tight">{item.name}</p>
                {item.modifiers && item.modifiers.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {item.modifiers.map((mod: any, mi: number) => (
                      <span key={mi} className="px-1.5 py-0.5 bg-white/20 rounded text-xs font-medium">
                        + {mod.name} {mod.price > 0 ? `($${mod.price.toFixed(2)})` : ''}
                      </span>
                    ))}
                  </div>
                )}
                {item.notes && (
                  <div className="mt-1 flex items-start gap-1">
                    <AlertCircle size={10} className="text-yellow-300 shrink-0 mt-0.5" />
                    <p className="text-xs text-yellow-100 font-bold">{item.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer / Action */}
      <div className="p-3 border-t border-white/20 bg-white/10">
        {order.status === OrderStatus.PREPARING || order.status === OrderStatus.READY ? (
          <button
            onClick={handleBump}
            className={`w-full py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition-colors shadow-md ${
              order.status === OrderStatus.READY
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {order.status === OrderStatus.READY ? (
              <>
                <CheckCircle size={20} /> MARK SERVED
              </>
            ) : (
              <>
                <Coffee size={20} /> MARK READY
              </>
            )}
          </button>
        ) : order.status === OrderStatus.PENDING ? (
          <button
            onClick={handleBump}
            className="w-full py-3 bg-white/20 hover:bg-white/30 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition-colors"
          >
            <Zap size={20} /> SEND TO KITCHEN
          </button>
        ) : (
          <div className="flex items-center justify-center gap-2 text-white/70 text-sm">
            <span className="font-bold">{statusConfig.label}</span>
            {order.status === OrderStatus.SERVED && <span>• Ready for payment</span>}
          </div>
        )}
      </div>
    </div>
  );
};

interface TicketTimerProps {
  startTime: number;
  warningThreshold?: number; // seconds
  urgentThreshold?: number; // seconds
  className?: string;
}

const TicketTimer = ({ 
  startTime, 
  warningThreshold = 600, // 10 minutes
  urgentThreshold = 1200, // 20 minutes
  className = ''
}: TicketTimerProps) => {
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const update = () => setElapsed(Math.floor((Date.now() - startTime) / 1000));
    update();
    timerRef.current = setInterval(update, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startTime]);

  const isWarning = elapsed >= warningThreshold;
  const isUrgent = elapsed >= urgentThreshold;
  const progress = Math.min((elapsed / urgentThreshold) * 100, 100);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative w-24 h-24">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="48"
            cy="48"
            r="42"
            className="text-gray-200"
            strokeWidth="4"
            fill="none"
          />
          <circle
            cx="48"
            cy="48"
            r="42"
            className={`${isUrgent ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-blue-500'} transition-all duration-500`}
            strokeWidth="4"
            strokeDasharray={264}
            strokeDashoffset={264 * (1 - progress / 100)}
            fill="none"
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-mono font-bold text-lg ${isUrgent ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-blue-600'}`}>
            {formatTime(elapsed)}
          </span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${
              isUrgent ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-blue-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className={`text-xs font-medium mt-1 ${isUrgent ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-gray-600'}`}>
          {isUrgent ? 'URGENT - Over 20 min' : isWarning ? 'Warning - Over 10 min' : 'On track'}
        </p>
      </div>
    </div>
  );
};

interface KDSBoardProps {
  station?: string;
  orders: Order[];
  tables: Table[];
  onBump: (orderId: string, currentStatus: OrderStatus) => void;
  onViewDetails: (order: Order) => void;
}

const KDSBoard = ({ station, orders, tables, onBump, onViewDetails }: KDSBoardProps) => {
  const statusOrder = [OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.SERVED];
  
  const groupedOrders = statusOrder.reduce((acc, status) => {
    const statusOrders = orders.filter(o => o.status === status);
    if (statusOrders.length > 0) {
      acc[status] = statusOrders;
    }
    return acc;
  }, {} as Record<OrderStatus, Order[]>);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 bg-white border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ChefHat size={28} className="text-shift-blue" />
          <div>
            <h2 className="text-xl font-bold text-shift-dark">Kitchen Display</h2>
            <p className="text-sm text-gray-500">{orders.length} active tickets</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-gray-100 rounded-lg" aria-label="Refresh">
            <Loader2 size={20} className="text-gray-500" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-lg" aria-label="Settings">
            <Bell size={20} className="text-gray-500" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-4 min-w-max">
          {Object.entries(groupedOrders).map(([status, statusOrders]) => {
            const statusConfig = STATUS_CONFIG[status as OrderStatus];
            return (
              <div key={status} className="w-84 flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className={`p-3 ${statusConfig.headerBg} text-white`}>
                  <h3 className="font-bold flex items-center gap-2">
                    {statusConfig.icon}
                    {statusConfig.label}
                    <span className="ml-auto px-2 py-0.5 bg-white/20 rounded-full text-xs font-bold">{statusOrders.length}</span>
                  </h3>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {statusOrders.map(order => (
                    <OrderTicket
                      key={order.id}
                      order={order}
                      tables={tables}
                      onBump={onBump}
                      onViewDetails={onViewDetails}
                      autoRefresh={status === OrderStatus.PREPARING || status === OrderStatus.READY}
                    />
                  ))}
                  {statusOrders.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
                      <ChefHat size={32} className="mb-2 opacity-50" />
                      <p className="text-sm">No {statusConfig.label.toLowerCase()} orders</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Real-time KDS with WebSocket integration
const RealTimeKDS = () => {
  const { orders, tables, updateOrderStatus } = useAppStore();
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const socket = connectRealtime();
    if (!socket) return;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    const handleOrderUpdate = (data: { order: Order; action: 'created' | 'updated' | 'deleted' }) => {
      setLastUpdate(new Date());
      // The store will be updated via the realtime service
    };

    socket.on('order:updated', handleOrderUpdate);
    socket.on('order:created', handleOrderUpdate);
    socket.on('order:deleted', handleOrderUpdate);

    return () => {
      socket.off('order:updated', handleOrderUpdate);
      socket.off('order:created', handleOrderUpdate);
      socket.off('order:deleted', handleOrderUpdate);
    };
  }, []);

  const activeOrders = orders.filter(
    o => o.status === OrderStatus.PREPARING || o.status === OrderStatus.READY || o.status === OrderStatus.PENDING
  );

  const handleBump = useCallback((orderId: string, currentStatus: OrderStatus) => {
    if (currentStatus === OrderStatus.PENDING) {
      updateOrderStatus(orderId, OrderStatus.PREPARING);
    } else if (currentStatus === OrderStatus.PREPARING) {
      updateOrderStatus(orderId, OrderStatus.READY);
    } else if (currentStatus === OrderStatus.READY) {
      updateOrderStatus(orderId, OrderStatus.SERVED);
    }
  }, [updateOrderStatus]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 bg-white border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <ChefHat size={28} className="text-shift-blue" />
          <div>
            <h2 className="text-xl font-bold text-shift-dark">Kitchen Display</h2>
            <p className="text-sm text-gray-500">
              {activeOrders.length} active tickets
              {lastUpdate && ` • Last update: ${lastUpdate.toLocaleTimeString()}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-bold ${isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {isConnected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto p-4">
        {activeOrders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <ChefHat size={64} className="mb-4" />
            <h3 className="text-2xl font-bold text-shift-dark">Kitchen is Clear</h3>
            <p>No active orders to prepare</p>
          </div>
        ) : (
          <KDSBoard
            orders={activeOrders}
            tables={tables}
            onBump={handleBump}
            onViewDetails={() => {}}
          />
        )}
      </div>
    </div>
  );
};

export { OrderTicket, TicketTimer, KDSBoard, RealTimeKDS };
export default RealTimeKDS;