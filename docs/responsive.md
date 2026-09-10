# Responsive behaviour

CampusFlow is a responsive web app **and** a native mobile app, and both are built so the same
screen works from a 320 px phone through to a wide desktop display. This document records the
breakpoints, the patterns, and the audit that was run against the code.

## 1. Breakpoints

Tailwind's default scale is used unchanged (confirmed in the compiled stylesheet, where these four
media queries are emitted):

| Token | Width | What changes |
| --- | --- | --- |
| `sm` | ≥ 40 rem (640 px) | Small buttons regain their compact height, modals become centred dialogs, 2-column grids start |
| `md` | ≥ 48 rem (768 px) | The timetable offers the week grid, room/office cards go 2-up, hero overlay chips appear |
| `lg` | ≥ 64 rem (1024 px) | The sidebar replaces the mobile top-bar drawer + bottom navigation, fixed-track layouts (`lg:grid-cols-[320px_1fr]`) switch on |
| `xl` | ≥ 80 rem (1280 px) | 3–4 column card and analytics grids |

Page viewport is set in `frontend/app/layout.tsx` (`width=device-width, initial-scale=1,
maximumScale=5`) so browser zoom is never blocked.

## 2. Application shell

`components/layout/app-shell.tsx` renders **one** navigation model at a time:

- **≥ 1024 px** — a 264 px sticky sidebar (`lg:grid lg:grid-cols-[264px_1fr]`) with the full,
  role-aware navigation list.
- **< 1024 px** — a sticky top bar with a hamburger, a 2-column drawer listing every destination
  (capped at `max-h-[70dvh]` and scrollable so a 21-item admin menu stays reachable on a short
  screen), plus a fixed bottom navigation with the five primary destinations
  (`Dashboard · Timetable · Map · Queue · Assistant`) and `pb-[env(safe-area-inset-bottom)]` for
  notched devices.
- `main` reserves `pb-24` below the content so the fixed bottom bar never covers the last card.

## 3. Content patterns

| Concern | Pattern used everywhere |
| --- | --- |
| Multi-column layouts | Single column by default, columns added at `sm:`/`md:`/`lg:`/`xl:`. No page has a fixed multi-column grid without a breakpoint gate. |
| Wide tables | `components/admin/table.tsx` renders a `min-w-[680px]` table inside `overflow-x-auto`, so the table scrolls inside its card instead of forcing the page to scroll sideways. |
| Toolbars and filters | `flex flex-wrap` with `min-w-[220px] flex-1` search fields, so controls stack on phones. |
| Maps and plans | Both map components render SVG with a `viewBox` (`h-full w-full`), so a floor plan or route scales to the container instead of pixel-fitting. |
| Timetable | The 5-day grid needs room, so it is the default ≥ 768 px (`useMediaQuery('(min-width: 768px)')`) and the stacked day list is the default below that; the segmented control always wins once tapped. |
| Modals | Bottom-sheet style below `sm` (`items-end rounded-t-2xl`) and centred dialog at `sm`+, with the body capped at `max-h-[70vh]` and internally scrollable. |
| Popovers | The notification popover is `w-[340px] max-w-[calc(100vw-2rem)]` so it cannot exceed a narrow viewport. |
| Long values | `KeyValue` keeps right-aligned values but allows them to shrink and wrap (`min-w-0 break-words`); identifiers in tables are truncated or shown via `min-w-0` wrappers. |
| Touch targets | Buttons are 40 px (`md`), 48 px (`lg`) and 40 px (`icon`); the compact `sm` size used inside dense admin rows grows to 40 px below `sm` (`max-sm:h-10`). Bottom-navigation items are ~44 px tall. |
| Typography | Page titles are 22 px and lift to 26 px at `sm`; body text stays ≥ 13 px with `leading-relaxed` so it survives 200 % zoom. |

## 4. Landing page

- Hero: single column with the product mock below the copy; at `lg` it becomes
  `lg:grid-cols-[1.05fr_1fr]`. The full-bleed photograph is a `next/image` with `fill` and
  `sizes="100vw"`, so the browser downloads an appropriately sized file per viewport.
- Floating data chips are `hidden md:block` (they would crowd a phone) and the statistics grid is
  2 columns → 4 at `sm`.
- The mobile-app showcase drops from three device frames to one below `sm`; the 232 px frame fits
  a 320 px viewport with page padding.
- All motion collapses to static content under `prefers-reduced-motion`, and the animated counters
  are server-rendered with their real values so the page reads without JavaScript.

## 5. Mobile app (Expo)

- Every screen is a `ScrollView` (or a flex container for the chat) with pull-to-refresh, so
  content adapts to any phone height; there are no fixed-height content areas apart from the QR
  camera viewport.
- Layouts use React Native flexbox with `flex: 1` content and `flexShrink` on long values, so text
  wraps rather than clipping.
- `Screen` centres content in a `maxWidth: 720` column, so tablets get a readable column instead of
  edge-to-edge cards.
- Safe areas come from `SafeAreaProvider` + `SafeAreaView` (top/left/right) and the tab bar handles
  the home-indicator inset.
- Camera, location and notification permission strings live in `app.json` for both platforms; the
  scanner has a manual-entry fallback when a camera is unavailable or denied.

## 6. Audit record

Run against the working tree on 2026-09-10:

1. **Breakpoint coverage** — every page/component was scanned for Tailwind responsive variants; the
   only components with none are layout-neutral (e.g. `motion-primitives`) or use a JS media query
   instead (the timetable's grid/list switch).
2. **Fixed sizes** — all fixed pixel widths were reviewed; the remaining ones are either inside
   `overflow-x-auto`, clamped (`max-w-[calc(100vw-2rem)]`), or hidden below their breakpoint
   (`hidden md:block`).
3. **Fixed-track grids** — none exist without a breakpoint gate; the timetable week grid uses
   `minmax(0,1fr)` for its day columns and is only the default on wider screens.
4. **Compiled CSS** — the production stylesheet contains the `40rem`/`48rem`/`64rem`/`80rem` media
   queries and the specific responsive utilities (`264px` sidebar, `56px` timetable axis,
   `100vw - 2rem` popover clamp, `70dvh` drawer, `100dvh` chat height).
5. **Gates** — `npx tsc --noEmit` (web and mobile) and `npx next build` are green after the changes.

Fixes applied during this audit:

| Fix | File |
| --- | --- |
| Notification popover could exceed a ≤ 340 px viewport | `components/layout/app-shell.tsx` |
| Mobile navigation drawer could not scroll when the menu was taller than the viewport (admin) | `components/layout/app-shell.tsx` |
| Compact (`sm`) buttons were 32 px tall on touch screens | `components/ui/kit.tsx` |
| Assistant chat height assumed desktop chrome | `app/(app)/assistant/page.tsx` |
| Timetable defaulted to the week grid on phones | `app/(app)/timetable/page.tsx` |
| `KeyValue` values could not wrap unbroken strings | `components/ui/kit.tsx`, `mobile/src/components/ui.tsx` |
| Tablet layouts stretched edge to edge | `mobile/src/components/ui.tsx` |

**Verification scope, stated honestly:** this environment has no browser or headless renderer, so
the audit is static (class-by-class review), build-level (compiled CSS inspected) and
type-level — not a screenshot comparison at each viewport. Re-running the checklist in a real
browser or DevTools device toolbar is the remaining confirmation step.
