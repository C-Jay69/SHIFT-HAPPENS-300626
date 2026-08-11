// Global Types

export enum OrderStatus {
  PENDING = 'PENDING',
  PREPARING = 'PREPARING',
  READY = 'READY',
  SERVED = 'SERVED',
  PAID = 'PAID'
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
}

export interface Table {
  id: string;
  name: string;
  seats: number;
  status: TableStatus;
  currentOrderId?: string;
  x: number; // For floorplan
  y: number;
}

export interface OrderItem {
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
  notes?: string;
}

export interface Order {
  id: string;
  tableId: string;
  items: OrderItem[];
  status: OrderStatus;
  total: number;
  timestamp: Date;
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