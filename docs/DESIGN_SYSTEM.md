# CampusFlow — Design System

A single visual language shared across web, mobile, student, staff and admin.
Tokens live in `frontend/app/globals.css` (Tailwind v4 `@theme`) and are
mirrored in the mobile theme constants.

---

## Identity

- **Name:** CampusFlow
- **Tagline:** Navigate. Learn. Connect.
- **Personality:** calm, precise, trustworthy, warm — a campus utility that
  feels like a modern product, not a CRUD admin template.

## Color

| Token | Role | Hex |
|-------|------|-----|
| `brand-600` | Primary actions, identity | `#254beb` |
| `brand-50..950` | Brand ramp | see `globals.css` |
| `ink-25..950` | Neutral text/surfaces/borders | cool gray ramp |
| `accent-600` | AI/assistant surfaces | `#7c2aed` |
| `success/warning/danger/info` | Status semantics | emerald / amber / red / blue |

Rules:

- Use brand for primary actions and focus rings, accent exclusively for the AI
  assistant, semantic colors for status.
- Text on light surfaces uses `ink-900`/`ink-600`/`ink-500` (never pure black).
- Cards are white on `ink-50`; borders `ink-200`.

## Typography

- Primary: **Inter Variable** (self-hosted via `@fontsource-variable/inter` —
  no runtime Google Fonts dependency).
- Scale: 12/13/14 (UI), 17 (wordmark), 20–24 (headings), 34–48 (hero).
- Tabular numerals (`.tnum`) for times, positions, metrics.

## Spacing & radius

- 4px base grid (`px-4`, `py-3`, `gap-4`…).
- Radius: `sm 8`, `md 12`, `lg 16`, `xl 20`, `2xl 28`, `full`.
- Cards: `rounded-xl`; inputs/buttons: `rounded-lg`/`rounded-md`.

## Elevation

- `shadow-soft` (inputs, subtle), `shadow-card` (cards), `shadow-lifted`
  (overlays, hover), `shadow-glow` (focus rings).

## Components

| Component | Notes |
|-----------|-------|
| Button | variants `primary|secondary|ghost|danger|accent`; sizes sm/md/lg/icon; loading state |
| Card / CardHeader | `padded`, `interactive` hover lift |
| Badge | tones incl. `success/warning/danger/info/neutral/accent`, optional dot |
| Input | label/hint/error; danger border on error |
| States | `LoadingState`, `ErrorState` (retry), `EmptyState` (action slot) |
| Shell | `StudentShell` — desktop sidebar + mobile drawer |
| Brand | `Logo` / `LogoMark` (original route-between-nodes mark) |

## States (always visible)

- **Loading** — centered spinner + label.
- **Error** — friendly title + actionable message + Retry.
- **Empty** — icon, title, message, optional action.
- **Success** — inline confirmations via badges/toasts.

## Motion

- `animate-fade-up` (page/section entrance), `animate-fade-in` (overlays),
  `animate-pulse-soft` (live indicators).
- Durations 150–400ms, eased (`--ease-out-soft`); all motion disabled under
  `prefers-reduced-motion`.

## Accessibility

- Visible focus ring (`:focus-visible`) on every interactive element.
- `aria-label` on icon-only buttons; `role="alert"` on form errors; semantic
  headings; 44px touch targets on mobile; color is never the only status signal
  (dots + labels).

## Honesty rule

When running in demo (mock) mode, a visible banner states the API is not
connected. Placeholder features are rendered disabled and labelled **Soon** —
never as working buttons.
