# CPL Platform — Design System

**Version:** 1.0  
**Stack:** Shadcn UI · Tailwind CSS · Lucide Icons · Plus Jakarta Sans

---

## Design Philosophy

Premium SaaS aesthetic inspired by Affsense admin dashboards (deep navy + indigo), with HubSpot/Stripe clarity.

**Goals:** Modern · Clean · Fast · Professional · Affiliate-friendly · Mobile Responsive

**Avoid:** Dark heavy content areas · Too many colors · Cluttered dashboards

---

## Color Tokens

| Token | Value | CSS Variable | Usage |
|-------|-------|--------------|-------|
| Primary | `#4F46F5` | `--primary` / `--theme-primary` | CTAs, links, focus rings |
| Accent purple | `#713BFF` | `--theme-accent-purple` / `--chart-4` | Gradients, chart tertiary |
| Success | `#12A150` | `--success` / `--theme-success` | Approved, positive metrics |
| Warning | `#F59E0B` | `--warning` | Pending, caps nearing |
| Danger | `#EF4444` | `--destructive` | Rejected, errors, destructive |
| Background | `#F7F9FC` | `--background` / `--theme-bg` | Page background |
| Card | `#FFFFFF` | `--card` | Cards, modals |
| Text Primary | `#111827` | `--foreground` | Primary text |
| Text Secondary | `#667085` | `--muted-foreground` | Secondary text |
| Border | `#E7EAF0` | `--border` / `--input` | Dividers, inputs |
| Sidebar | `#07162D` | `--sidebar` / `--theme-sidebar-*` | Deep navy shell (solid) |
| Active nav | `#4F46F5` → `#713BFF` | `--theme-sidebar-active-*` | Indigo→purple gradient |

Default pack is **Coral + Navy** (`coral-navy`). Chart accents follow the active theme pack.

### Shadcn CSS Variables (`globals.css`)

```css
:root,
[data-theme="slate-pro"] {
  --background: #F7F9FC;
  --foreground: #111827;
  --card: #FFFFFF;
  --primary: #4F46F5;
  --primary-foreground: #FFFFFF;
  --secondary: #07162D;
  --muted-foreground: #667085;
  --accent: #EEF2FF;
  --destructive: #EF4444;
  --border: #E7EAF0;
  --ring: #4F46F5;
  --radius: 0.5rem; /* 8px controls */
  --radius-card: 0.875rem; /* 14px cards */
  --success: #12A150;
  --warning: #F59E0B;
  --theme-sidebar-from: #07162D;
  --theme-sidebar-to: #07162D;
  --theme-sidebar-active-from: #4F46F5;
  --theme-sidebar-active-to: #713BFF;
  --theme-primary: #4F46F5;
  --theme-accent-purple: #713BFF;
}
```

---

## Typography

**Font Family:** Plus Jakarta Sans, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif  
Loaded via `next/font` as `--font-sans` (weights 400 / 500 / 600 / 700).

| Level | Size | Weight | CSS token |
|-------|------|--------|-----------|
| Page title | 24px | 700 | `--type-page-title` |
| Section heading | 20px | 600 | `--type-section` |
| Card heading | 16px | 600 | `--type-card-heading` |
| Body | 14px | 400 | `--type-body` |
| Secondary | 13px | 400 | `--type-secondary` |
| Small labels | 12px | 500 | `--type-label` |
| Dashboard metric | 26px | 700 | `--type-metric` |
| Sidebar / nav | 14px | 500 | body + `font-medium` |
| Button | 14px | 600 / 500 | body + weight utilities |

Line height: `--leading-body` (1.55) for body; `--leading-heading` (1.25) for headings.  
Letter spacing: `--tracking-body` (`0`) for UI text, labels, and card titles; `--tracking-display` (−0.01em) only for page titles. Avoid `tracking-tight` on KPI labels.

Baseline is applied on `body` in `globals.css` (`font-size: var(--type-body)`).

---

## Additional dashboard themes

Registered in `themes.ts` / `globals.css` (switcher + `/admin/themes`). Runtime default is **Coral + Navy** (`coral-navy`).

| ID | Name | Primary | Sidebar shell | Background | Border |
|----|------|---------|---------------|------------|--------|
| `coral-navy` | Coral + Navy | `#FF6B6B` | `#0B1F3A` | `#FFF5F2` | `#F1D9D5` |
| `deep-teal-peach` | Deep Teal + Peach | `#006D77` | `#006D77` (+ peach accent `#FFB4A2`) | `#F6FFF8` | `#D9EAE6` |
| `ocean-blue-mist` | Ocean Blue + Mist | `#0077B6` | `#16324F` | `#F8FBFF` | `#DCEAF3` |

Shared: Success `#16A34A`, Warning `#F59E0B`, Error `#DC2626`.  
Radii on these packs: `--radius` 8px (controls), `--radius-card` 10px (cards).

---

## Spacing & Layout

| Element | Value |
|---------|-------|
| Sidebar width | 256px (collapsed: 64px icon-only) |
| Header height | ~72px admin / 64px default |
| Content max-width | 1280px (dashboard); full-width for tables |
| Spacing system | 8px base (`gap-2`, `p-4`, `p-5`, `p-6`) |
| Card padding | 20–24px (`p-5` / `p-6`) |
| Border radius (cards) | 14px (`--radius-card`; 10px on coral/teal/ocean packs) |
| Border radius (buttons/inputs) | 8px (`rounded-md` / `--radius`) |
| Default shadow | `--shadow-card` (subtle) |
| Interactive card hover | `--shadow-card-hover` |

### Global Shell Layout

```
┌─────────────────────────────────────────────────────────┐
│ [Logo]  Breadcrumb Trail          [Search] [🔔] [Avatar]│  ← Header (64px)
├──────────┬──────────────────────────────────────────────┤
│ Sidebar  │  Page Title + Actions                        │
│ (256px)  │  ─────────────────────────────────────────  │
│          │  Main Content (cards, tables, charts)        │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
```

---

## Shadcn Components (MVP)

Install via `npx shadcn@latest add <component>`:

| Category | Components |
|----------|------------|
| Forms | Button, Input, Label, Select, Textarea, Form, Checkbox, Switch |
| Data Display | Card, Table, Badge, Avatar, Tabs, Progress, Tooltip |
| Feedback | Toast (Sonner), Alert, Skeleton |
| Overlay | Dialog, Sheet, Popover, Dropdown Menu |
| Navigation | Breadcrumb, Separator, Pagination |
| Advanced | Command (search), Calendar, DatePicker, DataTable (TanStack Table) |

---

## Component Patterns

### Stat Cards

```
┌─────────────────────────────┐
│ [Icon]  Label               │
│         1,234               │
│         ↑ 12% vs last period│
└─────────────────────────────┘
```

- Lucide icon (muted color) + label (text-muted-foreground)
- Large number (text-2xl font-bold)
- Trend badge: green for positive, red for negative

### Data Tables

- Sticky header
- Row hover (`hover:bg-muted/50`)
- Column sort indicators
- Filters bar above table
- Pagination below
- Empty state with illustration + CTA

### Forms

- Single-column layout
- Section headers with descriptions
- Inline validation (red border + message)
- Sticky save bar on long forms (bottom fixed)

### Status Badges

| Status | Color | Variant |
|--------|-------|---------|
| approved | Green | `bg-green-100 text-green-800` |
| pending | Amber | `bg-amber-100 text-amber-800` |
| rejected | Red | `bg-red-100 text-red-800` |
| paused | Gray | `bg-gray-100 text-gray-800` |
| active | Blue | `bg-blue-100 text-blue-800` |

### Empty States

- Centered layout
- Subtle illustration or icon (64px, muted)
- Headline (H3)
- Description (muted text)
- Primary CTA button

### Loading States

- Skeleton loaders matching layout shape
- Never spinner-only for page loads
- Pulse animation on skeleton blocks

---

## Responsive Behavior

| Breakpoint | Behavior |
|------------|----------|
| `< 768px` | Sidebar → Sheet drawer; stat cards 1-col; tables → card list |
| `768–1024px` | Sidebar collapsed by default |
| `> 1024px` | Full sidebar expanded |

### Mobile Navigation

- Hamburger menu triggers Sheet from left
- Bottom-safe padding for mobile browsers
- Touch targets minimum 44px

---

## Iconography

**Library:** Lucide React

| Context | Icon |
|---------|------|
| Dashboard | `LayoutDashboard` |
| Campaigns | `Megaphone` |
| Leads | `Users` |
| Wallet | `Wallet` |
| Payouts | `Banknote` |
| Reports | `BarChart3` |
| Settings | `Settings` |
| Support | `LifeBuoy` |
| Notifications | `Bell` |
| Search | `Search` |
| Add/Create | `Plus` |
| Edit | `Pencil` |
| Delete | `Trash2` |
| Export | `Download` |
| Approve | `CheckCircle` |
| Reject | `XCircle` |

---

## Accessibility

- WCAG 2.1 AA compliance for core flows
- Focus rings on all interactive elements (`ring-2 ring-primary`)
- Sufficient color contrast (4.5:1 minimum)
- Screen reader labels on icon-only buttons
- Keyboard navigation for modals and dropdowns
