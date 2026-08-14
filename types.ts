// Global Types

export enum OrderStatus {
  PENDING = 'PENDING',
  PREPARING = 'PREPARING',
  READY = 'READY',
  SERVED = 'SERVED',
  PAID = 'PAID',
  VOID = 'VOID'
}

export enum TableStatus {
  AVAILABLE = 'AVAILABLE',
  OCCUPIED = 'OCCUPIED',
  RESERVED = 'RESERVED',
  DIRTY = 'DIRTY'
}

export interface Ingredient {
  id: string;
  name: string;
  stock: number;
  unit: string;
  threshold: number;
  costPerUnit: number;
}

export interface MenuItem {
  id: string;
  name: string;
  category: 'FOOD' | 'DRINK' | 'DESSERT';
  price: number;
  color: string;
  recipe: { ingredientId: string; quantity: number }[];
  modifiers?: Modifier[];
}

export interface Modifier {
  id: string;
  name: string;
  price_adjustment: number;
  is_required: boolean;
}

export interface Table {
  id: string;
  name: string;
  seats: number;
  capacity: number;
  status: TableStatus;
  currentOrderId?: string;
  x: number;
  y: number;
  shape?: 'square' | 'rectangle' | 'round' | 'largeRound';
}

export interface OrderItem {
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
  unit_price: number;
  notes?: string;
  modifiers?: { id: string; name: string; price_adjustment: number; quantity: number }[];
}

export interface Order {
  id: string;
  tableId: string;
  items: OrderItem[];
  status: OrderStatus;
  total: number;
  timestamp: Date;
  tax?: number;
  tip?: number;
  guests?: number;
}

export interface Reservation {
  id: string;
  guestName: string;
  guestPhone: string;
  time: string;
  guests: number;
  status: 'CONFIRMED' | 'WAITLIST' | 'CANCELLED';
  vip?: boolean;
  notes?: string;
  tableId?: string;
}

export interface WaitlistEntry {
  id: string;
  guestId: string;
  guestName: string;
  guestPhone: string;
  partySize: number;
  requestedDate: string;
  requestedTime: string;
  status: 'waiting' | 'notified' | 'seated' | 'cancelled';
  notes?: string;
  createdAt: string;
  notifiedAt?: string;
}

export interface Guest {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  vip_status: boolean;
  total_spend: number;
  loyalty_points: number;
  notes?: string;
  created_at: string;
}