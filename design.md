# SHIFT HAPPENS! — Design System

## Brand Personality
Sharp. Fast. Slightly sarcastic. A restaurant platform that doesn't take itself too seriously but gets the job done.

## Colors
- Background: `#0a0a0a` (near-black)
- Surface: `#111111` (cards/panels)
- Border: `#1e1e1e`
- Primary: `#7c3aed` (purple-600) → `#06b6d4` (cyan-500) gradient
- Accent: `#7c3aed` (purple)
- Text primary: `#f5f5f5`
- Text muted: `#71717a`
- Success: `#22c55e`
- Warning: `#f59e0b`
- Danger: `#ef4444`
- KDS colors: pending=#f59e0b, in_progress=#7c3aed, ready=#22c55e

## Typography
- Font: JetBrains Mono (monospace headings/labels) + Inter (body)
- Import from Google Fonts
- Heading sizes: 2xl–4xl, bold
- Labels: uppercase tracking-widest text-xs (monospace)
- Body: text-sm/base Inter

## Layout
- Sidebar nav: fixed left, 64px collapsed / 240px expanded, dark bg
- Main content: flex-1, scrollable, dark bg
- Cards: bg-[#111] border border-[#1e1e1e] rounded-xl p-4
- Tables: dark striped, hover highlight

## Components
- Buttons: gradient bg (purple→cyan) for primary; ghost outline for secondary
- Badges: pill shape, color-coded by status
- Input fields: bg-[#1e1e1e] border-[#2a2a2a] text-white focus:ring-purple-500
- Tabs: underline style with purple active indicator
- Modals: backdrop-blur dark overlay
- KDS cards: large, color-bordered by ticket status
- POS grid: touch-friendly 2-col or 3-col item grid

## Sidebar Navigation
- Dashboard
- POS
- KDS (Kitchen Display)
- Reservations
- Guests (CRM)
- Inventory
- Staff
- ShiftBot (AI)
- Admin

## Motion
- Page transitions: fade-in 150ms
- KDS ticket updates: slide-in from left
- Toast notifications: slide-up from bottom-right
