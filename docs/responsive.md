# Responsive web and mobile guide

Updated 2026-09-15. This replaces the older static-only audit. CampusFlow retains its
Next.js/Tailwind web workspaces and its separate Expo/React Native companion; a small browser
window does **not** gain mobile-only capabilities.

## What changed

### Web

- The desktop shell uses `264px minmax(0,1fr)`, with shrinkable content capped at 1600px.
  Nested grid/flex children can shrink. Long values wrap instead of enlarging the whole page.
- Dense split panes (map, assistant, admin dashboard, queue and office operations) stack until
  `xl`, when there is room for both panes beside the sidebar.
- The landing header moves account creation into the section menu on phones. The phone
  showcase uses a **container query**, showing its side devices only when its own container
  is at least 720px wide. Code examples scroll locally, not at page level.
- Admin searches can shrink below their preferred width, filter/toolbars and pagination wrap.
  Tables retain all columns in a labelled, keyboard-focusable horizontal scroll region.
  Table headers stay on one line; prose wrapping must not squeeze columns into vertical letters.
- Selecting the timetable's week grid on a phone creates a local 720px scroll surface. The
  default phone view remains the day list; users keep their explicit view choice.
- Notifications anchor to the viewport on phones and to the bell on wider screens; their
  height is bounded on short landscape screens. Both disclosure buttons expose expanded state
  and support Escape. The workspace drawer provides account access at every width.
- Dialogs are portalled outside grid/animation ancestors. The **whole dialog**, including header
  and footer, is capped by `dvh`; only its content scrolls. Actions remain visible, focus stays
  within the dialog, Escape closes it, and focus returns to the trigger. Typing no longer resets
  focus when a parent rerenders with a new callback.
- Shared buttons/tabs/toggles have a 44px minimum height (48px large buttons); icon buttons have
  a 44px minimum width. Heights are minimums, not fixed boxes that clip multi-line labels.
- Phone form fields use 16px text. `any-pointer: coarse` also covers touch-enabled tablets and
  laptops. Inline prose links are excluded from blanket target enlargement.
- Viewport zoom is unrestricted; `viewport-fit=cover`, safe-area padding and bottom-navigation
  clearance are included. Shared CSS honours reduced motion.
- Browser API requests default to `/api/v1`, using the existing same-origin proxy. Server
  rendering still uses the internal API origin; no browser is sent to sandbox localhost.

### Mobile (native app and its Expo web rendering)

- `Screen` no longer applies `flex: 1` to unbounded ScrollView content. Scroll content grows
  naturally, so long forms and the last card remain reachable. Non-scrolling chat remains flex-based.
- Content is centred at a readable 720dp maximum; auth forms use 560dp. Avoid stretching a form
  edge-to-edge on tablets simply because there is more room.
- `AdaptiveRow` measures its **actual container** with `onLayout` and combines it with the live
  `fontScale` from `useWindowDimensions`. Stat and action groups reflow from several columns to
  one when space or text size demands it. It is used in student, staff and admin screens.
- Keyboard avoidance wraps the scroll surface, rather than sitting inside it. The offset comes
  from Expo Router's header context instead of a hard-coded chat offset. Chat's explanatory header
  is part of the scrolling thread so it does not consume the composer on short screens.
- Standalone screens reserve the bottom safe area. Tab screens let the tab bar own that inset,
  avoiding duplicate padding. Native headers own the top inset when shown.
- Buttons have 48dp minimum targets, vertical padding and wrapping, centred labels. Section
  headings and badges can wrap; key/value text can shrink without colliding.
- Tab labels remain below their icons, bar height responds to font scale and bottom safe area,
  and the bar hides while the keyboard is open.
- The camera frame follows available width with a 4:3 aspect ratio and a 360dp cap. Its permission
  fallback can grow with text rather than clipping inside a fixed-height camera surface.
- `orientation: default` permits portrait and landscape. **Rebuild/install the native app** to
  apply that configuration; a JavaScript refresh alone does not update the native orientation policy.

## Recommended framework strategy

**Keep Tailwind CSS 4 for web.** Use its mobile-first responsive variants and existing CampusFlow
components/tokens. CSS Modules are a good option for complex component-specific rules. Adding
Bootstrap or Material UI alongside the current kit would duplicate resets, spacing and components;
a migration is not needed to solve these problems.

**Keep React Native StyleSheet and Flexbox for mobile.** Tailwind CSS itself does not lay out native
views. NativeWind could be considered if utility-style authoring becomes a team-wide requirement,
but it is not needed here and should not be introduced just to gain breakpoints. Prefer existing
`Screen`, `AdaptiveRow`, `Button` and `Stat` primitives over per-screen device detection.

## Breakpoints and flexible layout recipes

| Web token | Minimum width at default root font | Appropriate use |
| --- | --- | --- |
| base | Any width; tested down to 320px | One column, wrapping controls, phone navigation |
| `sm` | 40rem / 640px | Two-column forms when content fits; centred dialogs |
| `md` | 48rem / 768px | Timetable grid default; larger card groups |
| `lg` | 64rem / 1024px | Desktop sidebar; not automatically enough room for dense split panes |
| `xl` | 80rem / 1280px | Dense split panes and multi-column analytics |

Break at the point **content stops fitting**, not at a particular phone brand. Test widths between
breakpoints too. Do not use user-agent detection or cache window dimensions at app startup.

```css
/* Example for new reusable card groups, not a replacement for every existing grid. */
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  gap: 1rem;
}
.toolbar { display: flex; flex-wrap: wrap; gap: .75rem; }
.toolbar > * { min-width: 0; }
.detail { display: grid; gap: 1rem; }
@media (min-width: 80rem) {
  .detail { grid-template-columns: minmax(0, 1fr) 22rem; }
}
@media (any-pointer: coarse) {
  .icon-action { min-width: 44px; min-height: 44px; }
}
```

Use `min-height` rather than fixed height for text controls. Use `rem`, percentages, `minmax` and
`clamp()` where appropriate. Retain local scrolling for genuinely two-dimensional data such as
maps and tables; do not hide rows/columns or set `body { overflow-x: hidden }` to hide layout bugs.
For fixed chrome, reserve its height plus `env(safe-area-inset-bottom)` in content. Use `dvh` for
height-constrained overlays and test both mobile browser chrome and the software keyboard.

```tsx
// Native: margin/padding belongs on the outer row; children get measured widths.
<AdaptiveRow minItemWidth={140} style={{ marginTop: 12 }}>
  <Stat label="People ahead" value={snapshot.people_ahead} />
  <Stat label="Estimated wait" value={snapshot.eta_label} />
</AdaptiveRow>
```

Keep native font scaling enabled. Don't reduce text size or cap accessibility scaling to make a
row fit: reduce the column count instead. Use FlatList for very large native lists rather than
putting thousands of cards in a ScrollView.

## Responsive images and maps

- Use `next/image` for web photos, with explicit intrinsic dimensions or `fill` inside a sized
  `position: relative` wrapper. Always give `fill` images an accurate `sizes` expression, e.g.
  `sizes="(min-width: 80rem) 40vw, (min-width: 48rem) 50vw, 100vw"`.
- Existing landing photos already use Next Image and `sizes`. Keep that pipeline: its generated
  `srcset` lets the browser choose an appropriate resource. Do not download a desktop-size photo
  for every phone. Lazy-load below-the-fold images; only preload a measured LCP image.
- Standard `<img>`/video media are constrained to `max-width: 100%; height: auto`. Reserve aspect
  ratio/dimensions to prevent layout shift. Use `object-fit: cover` for decorative crops and
  `contain` for floor plans/diagrams where cropping would remove information.
- Keep meaningful alt text; use empty alt text for purely decorative imagery. Do not bake important
  text or interactive actions into an image.
- Preserve SVG `viewBox` sizing for floor plans/routes. Map canvases need a sized container and
  resize handling; never apply blanket image CSS to map canvases or stretch spatial coordinates.
- In native screens, use the already-installed `expo-image` when adding photos: set a bounded
  width/aspectRatio, `contentFit`, a placeholder and an appropriate source resolution/cache policy.
  Provide local `@2x`/`@3x` assets where useful. No new native photo component was needed in this pass.

## Verification and how to rerun

From the repository root:

```sh
npm run check                       # PHP parsing, API/platform contracts, both client typechecks
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix mobile run test:responsive  # Node 22.18+; pure width/font-scale policy tests

# In a separate terminal, start the actual web app (backend optional for isolated layout fixtures):
HOSTNAME=0.0.0.0 npm --prefix frontend run dev

# In your test terminal:
cd frontend
npx playwright install --with-deps chromium
npm run test:responsive -- layout.spec.ts
```

The browser tests intercept API calls **inside the tests only**, for long-name fixtures, populated
admin tables, representative student data and deliberate error states. They do not prove backend
integration or authorization. `RESPONSIVE_BASE_URL` overrides the default web URL.

Optional rendering checks for the separate mobile client:

```sh
cd mobile
EXPO_PUBLIC_API_URL=/api/v1 npx expo export --platform web
# Serve dist with an HTML-aware static server on a separate port, e.g. npx serve dist -l 3101.
# Then, from frontend:
RESPONSIVE_MOBILE_URL=http://127.0.0.1:3101 npm run test:responsive
```

Use `/api/v1` only for the mobile **web** export served behind a same-origin API proxy. Native
phones still need `EXPO_PUBLIC_API_URL` pointing to a reachable HTTPS/LAN API, never localhost.

### Results from this pass

- `npm run check`: passed; 125 PHP files parsed, 199 routes checked, no contract/platform problems;
  both clients typecheck.
- Web ESLint and production build: passed.
- Expo SDK 57 web export: passed (the expected web push-notification support warning remains).
- Native sizing policy: 3 tests passed, including 220 width/font-scale/item-count combinations.
- Chromium: 21 web tests passed across 320, 360, 390, 430, 768, 1024, 1280 and 1920px widths and
  844×390 landscape; tests include local table scrolling, popover containment, modal bounds/actions,
  keyboard focus/typing, live resizing, 200% root text size, and touch tablet form sizing.
- Expo **React Native Web rendering**: 5 additional tests passed at 320×568, 390×844, 768×1024,
  844×390 and 1280×800. Auth forms scroll to their final actions; student cards and the chat composer
  stay within the viewport. No page-level JavaScript errors in those test flows.
- Initial browser failures exposed real landing intrinsic-width overflow and a table-header
  over-wrapping issue; both were corrected rather than hiding page overflow.
- Screenshots inspected: phone landing, phone native-rendered login, phone admin table and short
  landscape dialog. Artifacts live in ignored scratch/test output, not the app or Git.

The default browser CDN/system-package downloads were unavailable in this sandbox. Tests ran
against Chromium 153 from an external, temporary browser package via
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; that package is **not** an application dependency.

### Review scores (engineering self-review, not user research)

Dimensions, in order: visual quality / usability / hierarchy / consistency / responsiveness /
accessibility / interaction / performance / CampusFlow relevance / originality. Existing visual
identity is preserved. Scores for unrendered native views are provisional code-review scores.

| Shared surface / affected screens | Scores | Mean | Evidence |
| --- | --- | --- | --- |
| Landing and account entry | 9/9/9/9/9/8/8/8/9/8 | 8.6 | Browser matrix; phone landing screenshot |
| Role shells and admin users/table/dialog patterns | 8/9/9/9/9/8/9/8/9/8 | 8.6 | All nine viewport sizes; modal interactions and phone/landscape screenshots |
| Student dashboard, timetable, map, assistant, offices | 8/9/9/9/9/8/8/8/9/8 | 8.5 | 320px representative rendered states; grid scrolling; shared constraints |
| Admin alerts/dashboard/services/settings; staff queue/office detail | 8/8/8/9/8/8/8/8/9/8 | 8.2 | Shared pattern adoption and code review; not every populated detail page rendered |
| Native auth, student dashboard and assistant | 8/9/9/9/9/8/8/8/9/8 | 8.5 | Expo web render tests; auth screenshot; native hardware confirmation pending |
| Native student map/queue/scan/timetable/room/offices/navigation; staff desk/line/office; admin monitoring/alerts | 8/8/8/9/8/8/8/8/9/8 | 8.2 | Adaptive row policy tests and code review; native hardware confirmation pending |

### Still required before a full device sign-off

- Safari/iOS and Firefox; real iPhone/Android small and large screens, iPad/tablet split-screen.
- Native rebuild, portrait↔landscape rotation, notches/home indicators, keyboard show/hide, Android
  resize behaviour, screen-reader navigation and OS Dynamic Type at 100%, 150%, 200% and maximum.
- Actual browser 200–400% page zoom and native maximum text sizes. Root-font scaling in automation
  is useful but is not equivalent to every browser zoom or OS text-scaling implementation.
- Camera permission fallback/scan flow in both orientations, live map resizing, native navigation,
  poor network, real API data and long localized strings. Test every role's populated detail flows.
- Backend tests/integration against running Laravel and PostgreSQL were not run in this UI pass.
- Existing mobile dependency audit reports 14 moderate findings. No forced dependency upgrades were
  mixed into this responsiveness change; review them separately.

Research sources and pre-implementation comparison:
[responsive-foundation.md](design-decisions/responsive-foundation.md).
