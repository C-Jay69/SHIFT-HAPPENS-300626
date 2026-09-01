# SHIFT HAPPENS! — Design System

**Canonical theme: bright.** Restaurant operations software is read for hours
in bright rooms — the content canvas is light, high-contrast, and scannable.
A dark *chrome* (sidebar / top bar) anchors the interface, but **content
surfaces are always light**. Do not introduce a dark content theme.

All tokens are defined in `index.css` (Tailwind v4 `@theme` block). If a token
doesn't exist there, don't hard-code a hex — extend the theme block first.

---

## 1. Color

### Brand palette (`shift-*` tokens)

| Token           | Hex       | Role                                                                 |
| --------------- | --------- | -------------------------------------------------------------------- |
| `shift-blue`    | `#0000FF` | Primary brand color. Primary buttons, active nav, links, key accents. |
| `shift-dark`    | `#1a1a1a` | Ink / text on light surfaces; dark app chrome (sidebar); active tab pills; secondary primary buttons. |
| `shift-amber`   | `#FFBF00` | Warm accent (menu highlights, star ratings).                          |
| `shift-lime`    | `#BEF754` | Active-nav indicator stripe; success-ish accents.                     |
| `shift-cyan`    | `#00FFFF` | Cool accent (AI/agent surfaces).                                      |
| `shift-magenta` | `#FF00FF` | Event/catering accent.                                                |
| `shift-gray`    | `#DCDFD5` | Neutral surface tint (menu "gray" card style, scrollbar track).       |

### Canvas & structure

| Surface            | Value     | Notes                                   |
| ------------------ | --------- | --------------------------------------- |
| App canvas         | `#F5F5F5` | Page background (`body`, `AppShell`).    |
| Card               | `#FFFFFF` | Every content block lives in a white card. |
| Sidebar            | `#1A1A1A` | Dark chrome only.                        |
| Top bar            | `#0A0A0A` | Dark chrome only; `#1E1E1E` dividers.    |

### Semantic status (always these pairings)

| State    | Badge / text                  | Use                                            |
| -------- | ----------------------------- | ---------------------------------------------- |
| Success  | `bg-green-100 text-green-700` | Confirmed, paid, ok, completed, signed.        |
| Warning  | `bg-amber-100 text-amber-700` | Pending, watch, scheduled, flagged-mild.       |
| Danger   | `bg-red-100 text-red-700`     | Failed, low stock, open flags, high risk.      |
| Neutral  | `bg-gray-100 text-gray-400`   | Off, disabled, resolved, not started.          |

Buttons: primary `bg-shift-blue text-white hover:bg-blue-700`;
secondary primary `bg-shift-dark text-white hover:bg-black`;
danger `bg-red-600 text-white hover:bg-red-700`;
outline actions `border-2 border-<color>-300 text-<color>-600 hover:bg-<color>-50`.

**Accessibility rules**

- Never use brand colors for text on white (pure `#0000FF`/`#FF00FF`/`#00FFFF`
  fail WCAG AA for small text). Brand colors are for fills, icons, borders —
  text on light is `text-shift-dark`, `text-gray-*`, or the 600/700 shades
  above.
- Minimum touch target ~36 px; body text ≥ 13 px (`text-sm` is the floor for
  dense UI, `text-xs`/`text-[10px]` only for labels/badges).
- State is never color-only: every status badge carries a text label.

---

## 2. Typography

- **Sans:** Inter (UI, body, labels). **Mono:** JetBrains Mono (prices, IDs,
  times, code, `font-mono`).
- Page title: `text-2xl font-bold text-shift-dark` + one-line
  `text-gray-500 text-sm` subtitle.
- Section/card title: `font-bold` (16 px) or `text-lg font-bold`.
- Body: `text-sm text-gray-600/700`. Supporting text: `text-xs text-gray-400`.
- Labels/uppercase eyebrows: `text-[10px] font-bold uppercase text-gray-400`.
- Prices and numerics: always `font-mono`, right-aligned in tables.
- Line height: `leading-relaxed` for any paragraph > 2 lines.

---

## 3. Layout

- App frame: left sidebar (56 px icon rail at `md`, 256 px at `lg`) + top bar
  (64 px) + scrollable content with `p-4 md:p-8`.
- Page rhythm: `space-y-4` (dense) or `space-y-6` (standard) between blocks.
- Cards: `bg-white rounded-2xl border border-gray-200 shadow-sm` (rounded-xl
  for compact/nested cards). Card padding `p-5`/`p-6`.
- Grids: `grid gap-4` (forms/dense) / `gap-6` (page sections); KPI rows are
  `grid-cols-2 lg:grid-cols-4`.
- Max-width content flows with the frame; no centered narrow columns.

### Tab pattern (used by Admin, Insights, AI Manager)

```
container:  flex gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm
inactive:   px-4 py-2 rounded-lg text-sm font-bold text-gray-500 hover:bg-gray-100
active:     px-4 py-2 rounded-lg text-sm font-bold bg-shift-dark text-white
```

Tabs are icon + label (`lucide` icon 16 px), `whitespace-nowrap`, horizontal
scroll on overflow.

---

## 4. Components

### Buttons

| Variant   | Classes                                                        |
| --------- | -------------------------------------------------------------- |
| Primary   | `bg-shift-blue text-white font-bold rounded-lg hover:bg-blue-700` |
| Dark      | `bg-shift-dark text-white font-bold rounded-lg hover:bg-black`  |
| Danger    | `bg-red-600 text-white font-bold rounded-lg hover:bg-red-700`   |
| Outline   | `border border-gray-200 text-gray-600 hover:bg-gray-50`         |
| Icon-only | `p-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100` |

Sizes: `px-4 py-2` (default), `px-3 py-1.5 text-[11px]` (inline/dense),
`w-full py-2.5` (modal primary). Loading state: swap icon for
`Loader2 animate-spin`, keep width, `disabled:opacity-50`.

### Badges & chips

`text-[10px] font-bold px-2 py-0.5 rounded-full` + semantic bg/text pair.
Uppercase optional. Chips with counts: `font-mono`.

### Tables

```
container: bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden
thead:     bg-gray-50 text-[10px] uppercase text-gray-400 font-bold
rows:      divide-y divide-gray-50; hover:bg-gray-50 (only on row-level actions)
cells:     px-4/px-5 py-2.5; numerics right-aligned font-mono
```

### Forms

- Inputs: `px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg
  focus:outline-none focus:ring-2 focus:ring-shift-blue/20` (or `bg-gray-50`
  inside modals).
- Labels: `text-xs font-bold text-gray-500 uppercase` above the control.
- Selects styled identically to inputs. Ranges: `accent-blue-600`.
- Validation is inline `alert()`-free where possible; destructive actions
  always confirm.

### Modals

Overlay: `fixed inset-0 bg-black/50 backdrop-blur-sm z-50 p-4`.
Panel: `bg-white rounded-2xl p-6 max-h-[90vh] overflow-y-auto` +
`flex justify-between` header with `✕` close.

### Empty states

`p-12 text-center text-gray-300` with a centered 40 px lucide icon and one
plain-language line ("No calls logged yet"). Never an empty white card.

### KPI cards

`bg-white rounded-2xl border border-gray-200 shadow-sm p-4` →
eyebrow label (10 px uppercase gray-400) + `text-2xl font-bold` value.
Semantic accent color on the value only when the metric is good/bad.

---

## 5. Motion

- One animation: `animate-fade-in` (200 ms, 4 px rise) on page/tab content
  mount. Nothing else by default.
- `animate-spin` (Loader2 / RefreshCw) for loading; `animate-pulse` only for
  live-status dots.
- No parallax, no scale hovers on content, no transitions on layout shifts.

---

## 6. Do / Don't

**Do**

- Keep every content surface light; dark is for chrome + primary buttons.
- Reuse the `shift-*` tokens and the status pairings above.
- Put prices/times/IDs in `font-mono`.
- Pair every status color with a text label.
- Match the page's existing density (don't mix `gap-4` and `gap-6` siblings).

**Don't**

- Don't re-theme to dark content backgrounds (explicit product decision).
- Don't use pure brand hexes for body text on white.
- Don't add new animations or shadows (`shadow-sm` is the only card shadow;
  modals may use `shadow-xl`).
- Don't use gradients on content surfaces (avatar gradient is the only
  exception).
- Don't hard-code colors in `style={{}}` when a token exists.

---

## 7. Reference pages

- `pages/Insights.tsx` — tab pattern, KPI rows, data tables, form panels.
- `pages/Admin.tsx` — tabs, integration status list, danger zone.
- `pages/AIAgent.tsx` — chat surfaces, config cards, call log.
- `components/AppShell.tsx` + `components/Sidebar.tsx` — the dark chrome.
- `components/TrainingPanel.tsx` / `VendorsPanel.tsx` / `FinancePanel.tsx` —
  dense operational panels (lists + inline forms + state buttons).
