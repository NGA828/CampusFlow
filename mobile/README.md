# CampusFlow mobile

The CampusFlow mobile client — Expo SDK 57 + expo-router, talking to the same REST API as the web
app (`backend/`). It is not a wrapper around the website: every screen calls the API through
`src/lib/api.ts`, so role rules, queue transactions and navigation logic are identical on both
clients.

## Run it

```bash
cd mobile
npm install

# Point the app at the API. Use your machine's LAN address — a phone cannot reach 127.0.0.1.
EXPO_PUBLIC_API_URL=http://[IP_ADDRESS]/api/v1 npm run start
```

Then open the QR code with **Expo Go** (Android/iOS) or press `a` / `i` for an emulator. The API
must be running (`php ../backend/artisan serve --host=0.0.0.0 --port=8001`) and reachable from the device. The web target is
also available with `npm run web` for a quick look at the layout.

Demo accounts (seeded by `php ../backend/artisan db:seed`): `student@campusflow.edu`,
`staff@campusflow.edu`, `admin@campusflow.edu` — password `password123`.

## Screens

| Route | What it does |
| --- | --- |
| `(auth)/login`, `(auth)/register` | Session handling; bearer tokens are stored in `expo-secure-store` and validated against `GET /me` on launch |
| `student/(tabs)/index` | Student home: next class, today's sessions, active tickets and notices |
| `student/(tabs)/map` | Campus/building and room search with route planning |
| `student/(tabs)/queue` | Room queue requests, ticket status, proximity check-in and cancellation |
| `student/(tabs)/scan` | Camera QR scan plus manual anchor lookup and backend validation feedback |
| `student/timetable`, `student/room/[code]` | Student timetable and room information/availability |
| `student/offices`, `student/office/[code]` | Office directory, ticket request, check-in and cancellation |
| `student/navigate/[code]` | Live GPS/QR-based route origin, mapped floor/campus route trace, route steps and GPS tracking |
| `student/notifications`, `student/assistant`, `student/profile` | In-app inbox, campus assistant and account settings |
| `staff/(tabs)/*`, `staff/line/[id]`, `staff/office/[id]` | Staff queue and office operations for assigned services |
| `admin/(tabs)/*`, `admin/alert/[key]` | Admin monitoring and alert acknowledgement; no configuration forms on mobile |

## Mobile route tracing

Starting a walk uses a recent QR position on the same indoor floor when available; otherwise the app
asks for foreground location and sends a GPS fix. The API snaps that point to the nearest active,
accessible navigation node and returns its published route legs. The mobile navigation screen draws
those indoor plan-coordinate and outdoor GPS-coordinate legs as a traced line and keeps the user's
location marker moving while GPS tracking is enabled. Indoor starting points are most accurate after
scanning a nearby anchor. Sections without published geometry are called out rather than drawn as a
misleading straight-line shortcut.

## Push notifications

`src/lib/notifications.ts` requests permission, registers the Expo push token with
`POST /me/devices`, and unregisters it on sign-out. The Laravel API stores tokens in `device_tokens`;
notifications are delivered by the queued Expo sender. Run the database queue worker (`npm run dev`
starts it for local development; production must run `php artisan queue:work --queue=notifications,default`).
Expo Go and simulators may not issue a remote push token, so push delivery requires a compatible
physical-device development build and configured Expo/EAS project. In-app notifications remain
available from `GET /me/notifications`. Websocket updates are not yet connected to Laravel Reverb.

To test Android push notifications, use a development build instead of Expo Go:

```bash
npx expo install expo-dev-client
npx expo run:android
npx expo start --dev-client
```

The `expo-notifications` config plugin in `app.json` is already configured for that build.

## Checks

```bash
npx tsc --noEmit          # types
npx expo export --platform web   # bundles every route (fast smoke test without a device)
```
