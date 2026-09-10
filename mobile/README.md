# CampusFlow mobile

The CampusFlow mobile client — Expo SDK 57 + expo-router, talking to the same REST API as the web
app (`server/`). It is not a wrapper around the website: every screen calls the API through
`src/lib/api.ts`, so role rules, queue transactions and navigation logic are identical on both
clients.

## Run it

```bash
cd mobile
npm install

# Point the app at the API. Use your machine's LAN address — a phone cannot reach 127.0.0.1.
EXPO_PUBLIC_API_URL=http://192.168.1.20:3000/api/v1 npm run start
```

Then open the QR code with **Expo Go** (Android/iOS) or press `a` / `i` for an emulator. The API
must be running (`npm --prefix ../server run dev`) and reachable from the device. The web target is
also available with `npm run web` for a quick look at the layout.

Demo accounts (seeded by `npm --prefix ../server run db:seed`): `student@campusflow.dev`,
`staff@campusflow.dev`, `admin@campusflow.dev` — password `CampusFlow2026!`.

## Screens

| Route | What it does |
| --- | --- |
| `(auth)/login`, `(auth)/register` | Session handling; the token is kept in `expo-secure-store` and validated against `GET /auth/me` on launch |
| `(tabs)/index` | Dashboard: next class with countdown, today's sessions, active queue/office tickets, notices, building alerts |
| `(tabs)/timetable` | Week selector and per-day sessions derived from enrolments, with navigate and room-detail actions |
| `(tabs)/map` | Buildings and room search straight from the campus API |
| `(tabs)/queue` | Live room queues: join (with an optional GPS fix for the geofence), position, ETA, check-in, cancel |
| `(tabs)/more` | Offices, scanner, assistant, notifications and profile |
| `scan` | `expo-camera` QR scanning with manual code/payload fallback and the API's rejection reasons |
| `offices`, `office/[code]` | Office status, service windows, ticket request, check-in and cancel |
| `room/[code]` | Availability computed from the timetable, free slots, amenities, join queue |
| `navigate/[code]` | Route steps from the walking graph, live tracking via `expo-location`, off-route warning with the grace countdown |
| `notifications` | Notification centre with unread state and mark-as-read |
| `assistant` | Campus assistant chat showing the backend tool calls behind each answer |
| `profile` | Profile edits, session/device details, push registration status |

## Push notifications

`src/lib/notifications.ts` requests permission and registers the Expo push token with
`POST /me/devices` (best-effort: Expo Go and simulators cannot always mint a token). In-app and
websocket delivery work regardless, and the notification centre always reads `GET /me/notifications`.

## Checks

```bash
npx tsc --noEmit          # types
npx expo export --platform web   # bundles every route (fast smoke test without a device)
```
