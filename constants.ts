import { Ingredient, MenuItem, Table, Reservation, TableStatus } from './types.ts';

export const INITIAL_INGREDIENTS: Ingredient[] = [
  { id: 'ing_1', name: 'Beef Patty', stock: 50, unit: 'pcs', threshold: 10, costPerUnit: 2.50 },
  { id: 'ing_2', name: 'Brioche Bun', stock: 40, unit: 'pcs', threshold: 15, costPerUnit: 0.50 },
  { id: 'ing_3', name: 'Cheddar Cheese', stock: 100, unit: 'slices', threshold: 20, costPerUnit: 0.20 },
  { id: 'ing_4', name: 'Lettuce', stock: 20, unit: 'heads', threshold: 5, costPerUnit: 1.00 },
  { id: 'ing_5', name: 'Vodka', stock: 10, unit: 'bottles', threshold: 2, costPerUnit: 15.00 },
  { id: 'ing_6', name: 'Lime', stock: 30, unit: 'pcs', threshold: 10, costPerUnit: 0.30 },
  { id: 'ing_7', name: 'Ginger Beer', stock: 48, unit: 'cans', threshold: 12, costPerUnit: 1.00 },
];

export const MENU_ITEMS: MenuItem[] = [
  {
    id: 'menu_1',
    name: 'Classic Smash',
    category: 'FOOD',
    price: 14.00,
    color: 'bg-shift-amber',
    recipe: [
      { ingredientId: 'ing_1', quantity: 1 },
      { ingredientId: 'ing_2', quantity: 1 },
      { ingredientId: 'ing_3', quantity: 2 },
    ]
  },
  {
    id: 'menu_2',
    name: 'Moscow Mule',
    category: 'DRINK',
    price: 12.00,
    color: 'bg-shift-cyan',
    recipe: [
      { ingredientId: 'ing_5', quantity: 0.05 }, // portion of bottle
      { ingredientId: 'ing_6', quantity: 0.5 },
      { ingredientId: 'ing_7', quantity: 1 },
    ]
  },
  {
    id: 'menu_3',
    name: 'House Salad',
    category: 'FOOD',
    price: 10.00,
    color: 'bg-shift-lime',
    recipe: [
      { ingredientId: 'ing_4', quantity: 0.25 },
    ]
  },
  {
    id: 'menu_4',
    name: 'Double Trouble',
    category: 'FOOD',
    price: 18.00,
    color: 'bg-shift-magenta',
    recipe: [
      { ingredientId: 'ing_1', quantity: 2 },
      { ingredientId: 'ing_2', quantity: 1 },
      { ingredientId: 'ing_3', quantity: 4 },
    ]
  }
];

export const INITIAL_TABLES: Table[] = [
  { id: 't1', name: 'Table 1', seats: 2, status: TableStatus.AVAILABLE, x: 20, y: 20 },
  { id: 't2', name: 'Table 2', seats: 2, status: TableStatus.OCCUPIED, x: 120, y: 20, currentOrderId: 'ord_1' },
  { id: 't3', name: 'Table 3', seats: 4, status: TableStatus.AVAILABLE, x: 220, y: 20 },
  { id: 't4', name: 'Booth A', seats: 6, status: TableStatus.RESERVED, x: 20, y: 150 },
  { id: 't5', name: 'Booth B', seats: 6, status: TableStatus.DIRTY, x: 20, y: 280 },
  { id: 't6', name: 'Bar 1', seats: 1, status: TableStatus.AVAILABLE, x: 300, y: 150 },
  { id: 't7', name: 'Bar 2', seats: 1, status: TableStatus.AVAILABLE, x: 300, y: 200 },
];

export const INITIAL_RESERVATIONS: Reservation[] = [
  { id: 'res_1', guestName: 'J. Doe', guestPhone: '555-0123', time: '19:00', guests: 4, status: 'CONFIRMED', vip: true, notes: 'Anniversary' },
  { id: 'res_2', guestName: 'S. Connor', guestPhone: '555-0987', time: '19:30', guests: 2, status: 'WAITLIST', notes: 'Window seat preferred' },
  { id: 'res_3', guestName: 'T. Stark', guestPhone: '555-1111', time: '20:00', guests: 6, status: 'CONFIRMED', vip: true },
];