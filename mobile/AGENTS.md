# Expo HAS CHANGED
php artisan serve --host=0.0.0.0 --port=8000

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# CampusFlow — Project Rules

These rules come from `/PROMPT.md`, the complete master development
prompt for CampusFlow. Read that file before starting. The rules below
are hard requirements and cannot be skipped for convenience.

## Backend authority

- Backend (Laravel) is authoritative for auth, queue positions,
  capacity, tickets, and route calculation. Never calculate critical
  queue/ticket state only on the client; never show success the backend
  did not confirm.
- Centralized API client via `EXPO_PUBLIC_API_URL` — no hardcoded URLs.
- Secure storage for tokens (expo-secure-store). Real-time via
  authorized channels only, with reconnection handling and subscription
  cleanup.

## Offline & poor network

- Graceful failure states: "Unable to join the queue. Check your
  connection and try again." Retry where safe, stale-data indicators,
  optimistic UI only when reversible. No optimistic critical-state
  changes without backend confirmation.

## Design research (hard gate)

- Every major screen requires design research before final UI
  implementation (Dribbble primary, plus Behance/Mobbin/Awwwards):
  search → inspect ≥3 references → score 1–10 → compare → select →
  document → then implement. No generic template as the final design.
- Document research in `docs/design-research.md` and per-screen records
  in `docs/design-decisions/`; never fabricate sources or URLs.
- Score the implemented screen; target average ≥ 8/10 (PROMPT.md §57).
- Mobile-first: thumb-friendly controls, bottom navigation, map
  interactions, QR scanning, fast actions. Meaningful loading, empty,
  and error states. Non-color-only status indicators.

## Location & QR

- Sensible location intervals (distance/time-based), lifecycle-aware;
  stop tracking when navigation ends. QR payloads are untrusted — always
  validate against backend records.

## Process

- Feature-by-feature, backend-first, per PROMPT.md §75. Test before
  declaring completion (§93): Expo starts, navigation, auth, QR,
  permissions, notifications, secure storage, API connection, poor
  network, device/emulator behavior.
- No fake functionality, no placeholder API calls, no buttons that do
  nothing.
