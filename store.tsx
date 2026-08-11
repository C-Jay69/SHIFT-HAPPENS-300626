import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { Ingredient, MenuItem, Table, Order, Reservation, OrderStatus, TableStatus } from './types.ts';
import { INITIAL_INGREDIENTS, INITIAL_TABLES, INITIAL_RESERVATIONS, MENU_ITEMS as INITIAL_MENU_ITEMS } from './constants.ts';
import { api, AuthUser, ApiClientError, loadStoredUser } from './services/api.ts';
import { connectRealtime, onRealtime } from './services/realtime.ts';

// ---------------------------------------------------------------------------
// Mapping helpers: backend rows (snake_case) -> frontend types.
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  FOOD: 'bg-shift-amber',
  DRINK: 'bg-shift-cyan',
  DESSERT: 'bg-shift-magenta',
};

const categoryKey = (name?: string): 'FOOD' | 'DRINK' | 'DESSERT' => {
  const n = (name ?? '').toLowerCase();
  if (n.includes('drink')) return 'DRINK';
  if (n.includes('dessert')) return 'DESSERT';
  return 'FOOD';
};

const toMenuItem = (raw: any): MenuItem => {
  const category = categoryKey(raw.category_name);
  return {
    id: raw.id,
    name: raw.name,
    category,
    price: Number(raw.price),
    color: CATEGORY_COLORS[category],
    recipe: (raw.recipe ?? []).map((r: any) => ({ ingredientId: r.ingredientId, quantity: Number(r.quantity) })),
  };
};

const toIngredient = (raw: any): Ingredient => ({
  id: raw.id,
  name: raw.name,
  stock: Number(raw.current_stock),
  unit: raw.unit,
  threshold: Number(raw.reorder_threshold),
  costPerUnit: Number(raw.unit_cost ?? 0),
});

const TABLE_STATUS_MAP: Record<string, TableStatus> = {
  available: TableStatus.AVAILABLE,
  occupied: TableStatus.OCCUPIED,
  reserved: TableStatus.RESERVED,
  dirty: TableStatus.DIRTY,
};

const TABLE_STATUS_TO_API: Record<TableStatus, string> = {
  [TableStatus.AVAILABLE]: 'available',
  [TableStatus.OCCUPIED]: 'occupied',
  [TableStatus.RESERVED]: 'reserved',
  [TableStatus.DIRTY]: 'dirty',
};

const toTable = (raw: any): Table => ({
  id: raw.id,
  name: raw.name,
  seats: raw.capacity,
  status: TABLE_STATUS_MAP[raw.status] ?? TableStatus.AVAILABLE,
  currentOrderId: raw.current_order_id ?? undefined,
  x: raw.floor_plan_x,
  y: raw.floor_plan_y,
});

const toReservation = (raw: any): Reservation => ({
  id: raw.id,
  guestName: `${raw.first_name ?? ''}${raw.last_name ? ` ${raw.last_name}` : ''}`.trim(),
  guestPhone: raw.guest_phone ?? '',
  time: String(raw.time_slot ?? '').slice(0, 5),
  guests: raw.party_size,
  status: raw.status === 'cancelled' || raw.status === 'no_show' ? 'CANCELLED'
        : raw.status === 'pending' ? 'WAITLIST' : 'CONFIRMED',
  vip: (raw.notes ?? '').toLowerCase().includes('vip') || (raw.notes ?? '').toLowerCase().includes('anniversary'),
  notes: raw.notes ?? undefined,
  tableId: raw.table_id ?? undefined,
});

const RESERVATION_STATUS_TO_API: Record<string, string> = {
  CONFIRMED: 'confirmed',
  WAITLIST: 'pending',
  CANCELLED: 'cancelled',
};

const ORDER_STATUS_MAP: Record<string, OrderStatus> = {
  open: OrderStatus.PENDING,
  sent_to_kitchen: OrderStatus.PREPARING,
  preparing: OrderStatus.PREPARING,
  ready: OrderStatus.READY,
  served: OrderStatus.SERVED,
  paid: OrderStatus.PAID,
};

const toOrder = (raw: any, menuItems: MenuItem[]): Order => ({
  id: raw.id,
  tableId: raw.table_id ?? '',
  items: (raw.items ?? []).map((i: any) => {
    const match = menuItems.find((m) => m.id === i.menu_item_id);
    return {
      menuItemId: i.menu_item_id,
      name: i.name ?? match?.name ?? 'Item',
      quantity: i.quantity,
      price: Number(i.unit_price ?? match?.price ?? 0),
      notes: i.notes ?? undefined,
    };
  }),
  status: ORDER_STATUS_MAP[raw.status] ?? OrderStatus.PENDING,
  total: Number(raw.total ?? 0),
  timestamp: new Date(raw.created_at),
});

interface AppContextType {
  ingredients: Ingredient[];
  tables: Table[];
  orders: Order[];
  reservations: Reservation[];
  activeOrder: Order | null;
  menuItems: MenuItem[];
  systemPrompt: string;

  // Auth
  authUser: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, roleId?: string) => Promise<void>;
  logout: () => void;

  // Data loading
  refreshData: () => Promise<void>;

  // Actions
  createOrder: (tableId: string) => void;
  addToOrder: (menuItem: MenuItem) => void;
  updateOrderItemQuantity: (menuItemId: string, delta: number) => void;
  updateOrderItemNotes: (menuItemId: string, notes: string) => void;
  removeOrderItem: (menuItemId: string) => void;
  completeOrder: (orderId: string) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  updateTableStatus: (tableId: string, status: TableStatus) => void;
  addReservation: (reservation: Reservation) => void;
  updateReservation: (id: string, updates: Partial<Reservation>) => void;
  deductInventory: (menuItem: MenuItem) => void;
  updateIngredient: (id: string, updates: Partial<Ingredient>) => void;

  // Admin Actions
  updateSystemPrompt: (prompt: string) => void;
  addMenuItem: (item: MenuItem) => void;
  updateMenuItem: (id: string, updates: Partial<MenuItem>) => void;
  deleteMenuItem: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEFAULT_SYSTEM_PROMPT = `
You are "ShiftBot", the AI Operations Assistant for a busy restaurant called "SHIFT HAPPENS!".
Your tone is professional, efficient, but slightly witty.
Your capabilities:
1. Answer questions about current inventory levels.
2. Suggest recipes based on menu items.
3. Draft responses to guest reviews (simulate this).
4. Provide advice on handling operational conflicts.

Keep answers concise (under 150 words) unless asked for a detailed report.
Format your response with Markdown if helpful.
`.trim();

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [ingredients, setIngredients] = useState<Ingredient[]>(INITIAL_INGREDIENTS);
  const [tables, setTables] = useState<Table[]>(INITIAL_TABLES);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>(INITIAL_RESERVATIONS);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(INITIAL_MENU_ITEMS);
  const [systemPrompt, setSystemPrompt] = useState<string>(DEFAULT_SYSTEM_PROMPT);
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => loadStoredUser());
  const categoryIdsRef = useRef<Record<string, string>>({});

  // -------------------------------------------------------------------------
  // Server data loading (falls back to demo constants when offline/empty).
  // -------------------------------------------------------------------------
  const loadFromApi = async () => {
    if (!api.getToken()) return;
    try {
      const [menuRaw, ingRaw, tablesRaw, resRaw, ordersRaw, categoriesRaw] = await Promise.all([
        api.get<any[]>('/menu/items'),
        api.get<any[]>('/inventory/ingredients'),
        api.get<any[]>('/tables'),
        api.get<any[]>('/reservations'),
        api.get<any[]>('/orders'),
        api.get<any[]>('/menu/categories'),
      ]);

      categoryIdsRef.current = Object.fromEntries(
        (categoriesRaw ?? []).map((c: any) => [c.name.toLowerCase(), c.id]),
      );

      const menu = (menuRaw ?? []).map(toMenuItem);
      if (menu.length) setMenuItems(menu);
      if ((ingRaw ?? []).length) setIngredients(ingRaw.map(toIngredient));
      if ((tablesRaw ?? []).length) setTables(tablesRaw.map(toTable));
      if ((resRaw ?? []).length) setReservations(resRaw.map(toReservation));
      const mappedOrders = (ordersRaw ?? []).map((o) => toOrder(o, menu));
      if (mappedOrders.length) setOrders(mappedOrders);
    } catch (e) {
      console.warn('[store] API load failed — keeping demo data', e);
    }
  };

  const refreshData = async () => {
    await loadFromApi();
  };

  useEffect(() => {
    if (api.getToken()) {
      // Best-effort refresh of the stored session.
      api.get<AuthUser>('/auth/me')
        .then((me) => {
          setAuthUser(me);
          loadFromApi();
        })
        .catch(() => api.clearSession());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time: keep the store fresh when orders/tables change on the server
  // (POS on another terminal, the KDS, or the AI phone agent).
  useEffect(() => {
    if (!api.getToken()) return;
    connectRealtime();
    const unsubs = [
      onRealtime('order:created', () => loadFromApi()),
      onRealtime('order:status', () => loadFromApi()),
      onRealtime('table:updated', () => loadFromApi()),
    ];
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  const login = async (email: string, password: string) => {
    const data = await api.post<{ token: string; user: AuthUser }>('/auth/login', { email, password });
    api.setSession(data.token, data.user);
    setAuthUser(data.user);
    await loadFromApi();
  };

  const register = async (email: string, password: string, roleId?: string) => {
    try {
      await api.post('/auth/register', { email, password, roleId });
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 400) {
        throw new Error('Registration requires a roleId — create roles in the database first.');
      }
      throw e;
    }
  };

  const logout = () => {
    api.clearSession();
    setAuthUser(null);
  };

  // -------------------------------------------------------------------------
  // POS order drafting (local). Persisted server-side on completeOrder.
  // -------------------------------------------------------------------------
  const createOrder = (tableId: string) => {
    const newOrder: Order = {
      id: `ord_${Date.now()}`,
      tableId,
      items: [],
      status: OrderStatus.PENDING,
      total: 0,
      timestamp: new Date(),
    };
    setOrders([...orders, newOrder]);
    setActiveOrder(newOrder);
    updateTableStatus(tableId, TableStatus.OCCUPIED);
  };

  const addToOrder = (menuItem: MenuItem) => {
    if (!activeOrder) return;

    const updatedOrder = { ...activeOrder };
    const existingItemIndex = updatedOrder.items.findIndex(i => i.menuItemId === menuItem.id);

    if (existingItemIndex >= 0) {
      updatedOrder.items[existingItemIndex].quantity += 1;
    } else {
      updatedOrder.items.push({
        menuItemId: menuItem.id,
        name: menuItem.name,
        quantity: 1,
        price: menuItem.price
      });
    }

    updatedOrder.total += menuItem.price;

    // Update local active order state
    setActiveOrder(updatedOrder);

    // Update in global orders list
    setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
  };

  const updateOrderItemQuantity = (menuItemId: string, delta: number) => {
    if (!activeOrder) return;

    const updatedOrder = { ...activeOrder };
    const itemIndex = updatedOrder.items.findIndex(i => i.menuItemId === menuItemId);

    if (itemIndex >= 0) {
      const item = { ...updatedOrder.items[itemIndex] };
      const newQuantity = item.quantity + delta;

      if (newQuantity > 0) {
          item.quantity = newQuantity;
          updatedOrder.items[itemIndex] = item;

          // Recalculate total
          updatedOrder.total = updatedOrder.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);

          setActiveOrder(updatedOrder);
          setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
      }
    }
  };

  const updateOrderItemNotes = (menuItemId: string, notes: string) => {
    if (!activeOrder) return;

    const updatedOrder = { ...activeOrder };
    const itemIndex = updatedOrder.items.findIndex(i => i.menuItemId === menuItemId);

    if (itemIndex >= 0) {
      const item = { ...updatedOrder.items[itemIndex] };
      item.notes = notes;
      updatedOrder.items[itemIndex] = item;

      setActiveOrder(updatedOrder);
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    }
  };

  const removeOrderItem = (menuItemId: string) => {
    if (!activeOrder) return;

    const updatedOrder = { ...activeOrder };
    updatedOrder.items = updatedOrder.items.filter(i => i.menuItemId !== menuItemId);

    // Recalculate total
    updatedOrder.total = updatedOrder.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);

    setActiveOrder(updatedOrder);
    setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
  };

  const deductInventory = (menuItem: MenuItem) => {
    setIngredients(prevIngredients => {
      return prevIngredients.map(ing => {
        const recipeItem = menuItem.recipe.find(r => r.ingredientId === ing.id);
        if (recipeItem) {
          return { ...ing, stock: Math.max(0, ing.stock - recipeItem.quantity) };
        }
        return ing;
      });
    });
  };

  const updateIngredient = (id: string, updates: Partial<Ingredient>) => {
    const prev = ingredients.find(i => i.id === id);
    setIngredients(prevList => prevList.map(ing => ing.id === id ? { ...ing, ...updates } : ing));

    if (!api.getToken() || !prev || updates.stock === undefined) return;
    // Persist stock changes as an audited stock adjustment.
    api.post('/inventory/adjustments', {
      ingredientId: id,
      quantityChange: updates.stock - prev.stock,
      reason: 'adjustment',
    }).catch(() => undefined);
  };

  const completeOrder = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    // Optimistic: deduct inventory locally + mark preparing.
    order.items.forEach(item => {
      const menuItem = menuItems.find(m => m.id === item.menuItemId);
      if (menuItem) {
        for(let i=0; i < item.quantity; i++) {
            deductInventory(menuItem);
        }
      }
    });

    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: OrderStatus.PREPARING } : o));
    setActiveOrder(null);

    if (!api.getToken() || order.items.length === 0) return;

    // Server: creates the order, deducts real stock, fires low-stock alerts.
    api.post<{ order: any }>('/orders', {
      tableId: order.tableId || undefined,
      orderType: 'dine_in',
      items: order.items.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity, notes: i.notes })),
    })
      .then(() => loadFromApi()) // refresh stock/tables/orders to server truth
      .catch((e) => console.warn('[store] order sync failed — kept local', e));
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
  };

  const updateTableStatus = (tableId: string, status: TableStatus) => {
    setTables(prev => prev.map(t => t.id === tableId ? { ...t, status } : t));

    if (!api.getToken()) return;
    api.patch(`/tables/${tableId}`, { status: TABLE_STATUS_TO_API[status] })
      .catch(() => undefined);
  };

  const addReservation = (reservation: Reservation) => {
    setReservations(prev => [...prev, reservation]);
    if (!api.getToken()) return;

    const parts = (reservation.guestName ?? '').trim().split(/\s+/);
    api.post('/reservations', {
      firstName: parts[0] ?? '',
      lastName: parts.slice(1).join(' '),
      phone: reservation.guestPhone,
      partySize: reservation.guests,
      date: new Date().toISOString().slice(0, 10),
      timeSlot: reservation.time,
      tableId: reservation.tableId || undefined,
      notes: reservation.notes,
      source: 'web',
    })
      .then(() => loadFromApi())
      .catch((e) => console.warn('[store] reservation create failed — kept local', e));
  };

  const updateReservation = (id: string, updates: Partial<Reservation>) => {
    setReservations(prev => prev.map(res => res.id === id ? { ...res, ...updates } : res));
    if (!api.getToken()) return;

    api.patch(`/reservations/${id}`, {
      partySize: updates.guests,
      timeSlot: updates.time,
      status: updates.status ? RESERVATION_STATUS_TO_API[updates.status] : undefined,
      tableId: updates.tableId ?? null,
      notes: updates.notes,
    }).catch(() => undefined);
  };

  // Admin Actions
  const updateSystemPrompt = (prompt: string) => {
    setSystemPrompt(prompt);
  };

  const addMenuItem = (item: MenuItem) => {
    setMenuItems(prev => [...prev, item]);
    if (!api.getToken()) return;

    const categoryId = categoryIdsRef.current[item.category.toLowerCase()];
    api.post('/menu/items', {
      categoryId,
      name: item.name,
      price: item.price,
      isAvailable: true,
    })
      .then(() => loadFromApi())
      .catch((e) => console.warn('[store] menu create failed — kept local', e));
  };

  const updateMenuItem = (id: string, updates: Partial<MenuItem>) => {
    setMenuItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
    if (!api.getToken()) return;

    const body: Record<string, unknown> = {};
    if (updates.name !== undefined) body.name = updates.name;
    if (updates.price !== undefined) body.price = updates.price;
    if (updates.category !== undefined) body.categoryId = categoryIdsRef.current[updates.category.toLowerCase()];

    api.patch(`/menu/items/${id}`, body).catch(() => undefined);
  };

  const deleteMenuItem = (id: string) => {
    setMenuItems(prev => prev.filter(item => item.id !== id));
    if (!api.getToken()) return;
    api.delete(`/menu/items/${id}`).catch(() => undefined);
  };

  return (
    <AppContext.Provider value={{
      ingredients,
      tables,
      orders,
      reservations,
      activeOrder,
      menuItems,
      systemPrompt,
      authUser,
      isAuthenticated: authUser !== null,
      login,
      register,
      logout,
      refreshData,
      createOrder,
      addToOrder,
      updateOrderItemQuantity,
      updateOrderItemNotes,
      removeOrderItem,
      completeOrder,
      updateOrderStatus,
      updateTableStatus,
      addReservation,
      updateReservation,
      deductInventory,
      updateIngredient,
      updateSystemPrompt,
      addMenuItem,
      updateMenuItem,
      deleteMenuItem
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppStore = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppStore must be used within an AppProvider");
  }
  return context;
};
