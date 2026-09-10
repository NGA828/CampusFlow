<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# CampusFlow — Project Rules

These rules come from `/PROMPT.md`, the complete master development
prompt for CampusFlow. Read that file before starting. The rules below
are hard requirements and cannot be skipped for convenience.

## Architecture & backend authority

- Backend (Laravel) is authoritative for auth, authorization, queue
  positions, capacity, tickets, and route calculation. Frontend role
  checks are UI-only; never trust the frontend for critical state.
- Centralized API client via `NEXT_PUBLIC_API_URL` — never scatter
  `fetch("http://localhost:8000/...")` calls; never hardcode URLs.
- Real-time via Laravel Echo/WebSockets; subscribe only to authorized
  channels, handle reconnection, and clean up subscriptions.
- Every API request must handle loading, success, validation,
  auth/authz, not-found, conflict, rate-limit, server, network, and
  timeout errors. Never show success if the backend failed.

## Design research (hard gate)

- Every major screen requires design research before final UI
  implementation (Dribbble primary, plus Behance/Mobbin/Awwwards):
  search → inspect ≥3 references (4–6 for Dashboard, Campus Map,
  Navigation, Queue, Office Ticketing, AI Assistant) → score 1–10 →
  compare → select → document → then implement.
- No generic Tailwind/shadcn template as the final design.
- Document research in `docs/design-research.md` and per-screen records
  in `docs/design-decisions/`.
- Never fabricate sources or URLs; record "Not available" when unknown.
- Score the implemented screen (visual quality, usability, hierarchy,
  consistency, responsiveness, accessibility, interaction, performance,
  CampusFlow relevance, originality); target average ≥ 8/10. Improve
  below 8/10 before marking complete.

## UI quality

- Role-specific dashboards (student/staff/admin) — not the same layout
  for every role; not plain tables + forms + default buttons.
- Meaningful loading (skeletons), empty, and error states everywhere.
- Accessibility: contrast, keyboard navigation, semantic HTML, focus
  states, reduced-motion, non-color-only status indicators.
- Framer Motion where it improves UX; do not over-animate.

## Process

- Build feature by feature, backend-first, in the order in PROMPT.md
  §75. Test before declaring completion (PROMPT.md §93 Definition of
  Done).
- No fake functionality, no placeholder API calls, no buttons that do
  nothing. Compiling does not mean complete.
