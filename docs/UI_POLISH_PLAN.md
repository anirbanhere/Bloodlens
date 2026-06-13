# BloodLens UI Polish → Modern SaaS Dashboard

> UI-polish-only plan. **No data, API, parser, schema, or behavior changes.** The only
> non-component file touched is `src/lib/status.ts`, and only its label/className constants.

## Context

BloodLens works end-to-end but looks like a default Tailwind scaffold: a thin top navbar, a
narrow centered column, flat shadowless cards, ad-hoc `bg-blue-600` buttons, and no icons.
Two latent bugs hurt it:

1. `globals.css` forces `font-family: Arial` on `body`, silently overriding the Geist font
   the layout loads.
2. A `@media (prefers-color-scheme: dark)` block flips the page background to near-black while
   every component keeps hardcoded `text-slate-800` — unreadable for dark-mode users.

This effort restyles the existing surfaces into a cohesive, modern SaaS dashboard.

### Decisions
| Area | Choice |
|------|--------|
| **Navigation** | Left sidebar (collapses to a drawer on mobile), replacing the top navbar |
| **Icons** | Add `lucide-react` |
| **Theme** | Light-only. Remove broken dark-mode; fix Arial-over-Geist override |
| **Accent palette** (by usage) | `#7982C9` indigo = brand/primary · `#83C979` green = secondary/in-range · `#C97982` rose = tertiary/above-range |

## Current state (verified)
- Stack: Next 16.2.9, React 19.2, Tailwind **v4** (`@import "tailwindcss"`, `@theme`), Geist via `next/font`.
- `src/app/layout.tsx` — top `NavBar` + `<main className="max-w-5xl ... px-4 py-6">` + footer disclaimer.
- `src/components/NavBar.tsx` — top bar, links: Patients, Admin; red-dot logo.
- Card pattern repeated everywhere: `bg-white rounded-xl border border-slate-200 p-4/5` (no shadow).
- Primary button repeated: `bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700`.
- Status colors centralized in `src/lib/status.ts` (`STATUS_LABELS`, `STATUS_CLASSES`): red=high, amber=low, green=normal, slate=unknown — one place to retint.
- Status dot helper is duplicated inline in `patients/[id]/page.tsx`.
- `TrendChart.tsx` line is `#2563eb`, grid `#e2e8f0`, reference band green `#22c55e`.
- Pages (12): `/`, `/patients`, `/patients/new`, `/patients/[id]`, `/patients/[id]/edit`,
  `/patients/[id]/table`, `/patients/[id]/markers/[key]`, `/patients/[id]/summary`,
  `/reports/new`, `/reports/[id]`, `/extractions/[eid]/review`, `/admin`.
- Components (10): NavBar, PatientForm, ReportForm, MarkerEntry, MarkerTable, TrendChart,
  ExtractionReviewTable, FileSection, DeleteReportButton, PrintButton.

## Design system

### 1. Tokens — rewrite `src/app/globals.css`
Remove the dark-mode media query and the `body { font-family: Arial }` line. Define tokens in
the Tailwind v4 `@theme` block so classes like `bg-brand-500`, `text-ok-700`, `shadow-card` work:

- **brand** (indigo) around `#7982C9`: `50 #f2f3fb`, `100 #e4e6f6`, `200 #c9cdec`, `300 #a8aee0`,
  `400 #9097d6`, **`500 #7982c9`** (primary), `600 #616bb2` (hover), `700 #4e5790`.
- **ok** (green) around `#83C979`: `50 #f1f8ef`, `100 #ddeed9`, `500 #83c979`, `600 #5fa755`, `700 #4a8242`.
- **alert** (rose) around `#C97982`: `50 #fbf1f2`, `100 #f3dadd`, `500 #c97982`, `600 #b25c66`, `700 #8f4751`.
- **warn** (harmonized muted gold for *below-range*): `50 #fbf6ec`, `100 #f3e7c9`, `500 #c9a979`, `600 #b08e5c`, `700 #8f7147`.
- **Surfaces / shape:** `--color-canvas: #f7f8fb`, `--color-surface: #ffffff`, `--radius-card: 1rem`,
  `--shadow-card` (soft 2-layer), `--shadow-card-hover` (brand-tinted lift). Keep `--font-sans: var(--font-geist-sans)`.
- `body { background: var(--color-canvas); }` — **no** font-family override.

### 2. UI primitives — new `src/components/ui/`
Small presentational components to kill repeated class strings. Use `clsx` (add) for conditional classes.
- `Card.tsx` — surface + `rounded-card` + `shadow-card`; `hover` prop adds lift + border-brand.
- `Button.tsx` — variants `primary`/`secondary`/`ghost`/`danger`; sizes `sm`/`md`; optional lucide icon. Renders `<button>` or `<a>`/`Link`.
- `Badge.tsx` — status pill mapping `MarkerStatus` → retinted `STATUS_CLASSES`; dot + label.
- `StatusDot.tsx` — single source for the colored dot.
- `StatCard.tsx` — KPI tile: label, large `tabular-nums` value, lucide icon in tinted circle.
- `PageHeader.tsx` — title + optional subtitle + right-aligned actions slot.
- `EmptyState.tsx` — centered icon + message + CTA.

### 3. App shell — `layout.tsx` + new `Sidebar.tsx` (replaces `NavBar.tsx`)
- Shell: `flex min-h-screen bg-canvas` → `<Sidebar/>` + `<main className="flex-1 min-w-0 px-6 py-8 max-w-6xl mx-auto">`. Footer disclaimer stays (slimmer).
- `Sidebar.tsx` (client; `usePathname` for active state): brand logo mark, links **Patients** / **Admin**
  with lucide icons, active link = brand-50 bg + brand-700 text + left accent bar. Fixed `w-64` on `lg+`.
- Mobile: slim top bar + hamburger toggles an off-canvas drawer (overlay + slide-in) via `useState`.

## Per-page polish (presentational only)

- **`/patients`** — `PageHeader` + Add-patient `Button`. Patient cards → `Card hover` with initial-avatar
  circle (brand tint), report-count `Badge`, last-report meta, chevron. `EmptyState` when none.
- **`/patients/[id]`** *(flagship dashboard)* — **KPI stat row** of `StatCard`s: Markers tracked,
  Outside range (alert-tinted when >0), Reports, Last report date — from already-computed data. Category
  cards: per-category lucide icon, shared `StatusDot`, alert-token pill, tighter rows. Reports list: hover,
  marker/file `Badge`s, chevron. Actions → `Button`s with icons.
- **`/patients/[id]/markers/[key]`** — hero header: big `tabular-nums` value + status `Badge` + unit;
  chart in a `Card`; history table restyled (zebra, status-tinted).
- **`TrendChart.tsx`** — line → brand `#7982c9`; subtle gradient area fill; grid `#eef0f6`; reference band
  → `ok` green tint; keep rounded tooltip; larger active dot.
- **`/patients/[id]/table` + `MarkerTable.tsx`** — sticky header, sticky first column, zebra rows,
  status-tinted cells, `tabular-nums`.
- **`/patients/[id]/summary`** — sectioned `Card`s, status `Badge`s, clean print layout; `PrintButton` as secondary `Button`.
- **`/reports/[id]` + `MarkerEntry.tsx`** — grouped inputs with shared `.input` style, value-type-aware widgets, `Button` primitives, `Badge` statuses.
- **`/extractions/[eid]/review` + `ExtractionReviewTable.tsx`** — polished table, confidence as badge/meter, styled checkboxes + inline-edit row.
- **`FileSection.tsx`** — restyle file rows, password unlock form, upload as primary `Button`, refined preview frame. (All logic, incl. password flow, preserved.)
- **Forms `PatientForm.tsx` / `ReportForm.tsx`** — shared input styling, labels, helper text, brand focus rings, `Button` actions.
- **`/admin`** — backup `Card`, download as primary `Button`, restore steps as styled list.
- **`/`, `/patients/new`, `/patients/[id]/edit`, `/reports/new`** — apply `PageHeader` + shell spacing.

## Shared retint — `src/lib/status.ts`
Update **only** `STATUS_CLASSES` (leave `STATUS_LABELS` and all logic untouched):
- `high → bg-alert-50 text-alert-700 border-alert-100`
- `low → bg-warn-50 text-warn-700 border-warn-100`
- `normal → bg-ok-50 text-ok-700 border-ok-100`
- `unknown → bg-slate-50 text-slate-500 border-slate-200`

## Cross-cutting polish
- Consistent `rounded-card`, `shadow-card`, brand `focus-visible` rings on interactive elements.
- `tabular-nums` on every numeric value; smooth `transition` on hover.
- Brand-colored logo mark + matching `app/icon` dot.
- Optional `loading.tsx` skeletons for `/patients` and `/patients/[id]`.

## Dependencies to add
`lucide-react` (icons), `clsx` (className composition).

## Files
- **New:** `src/components/Sidebar.tsx`; `src/components/ui/{Card,Button,Badge,StatusDot,StatCard,PageHeader,EmptyState}.tsx`.
- **Rewrite:** `src/app/globals.css`, `src/app/layout.tsx`.
- **Remove/replace:** `src/components/NavBar.tsx` (superseded by Sidebar).
- **Restyle (no logic change):** all 12 `page.tsx` + `MarkerTable`, `TrendChart`, `MarkerEntry`,
  `ExtractionReviewTable`, `FileSection`, `PatientForm`, `ReportForm`, `PrintButton`, `DeleteReportButton`.
- **Constants only:** `src/lib/status.ts` (`STATUS_CLASSES`).

## Verification
1. `npm install` (lucide-react, clsx) → `npx tsc --noEmit` → `npm run build` (all clean).
2. `npm run dev`; walk every page; confirm Geist applied (no Arial), no dark-mode flip, status colors map
   to indigo/green/rose/gold, sidebar active states, **no behavior/data change**.
3. Responsive: ~375px (drawer + hamburger) and desktop (`w-64` sidebar).
4. Commit and push to `main` (Railway auto-deploys). No DB/seed impact.
