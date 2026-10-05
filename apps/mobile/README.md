# CampusFlow — student mobile app (Expo)

The student experience on a phone: QR-anchor indoor positioning, GPS outdoors, the
MapLibre campus map with server-computed indoor routes, room requests and
notifications. One codebase, three targets — Android, iOS and the browser.

## Run it

```bash
npm install

# in a browser, against the API on :4000 — no native toolchain needed
npm run build:web && npm run serve:web      # http://localhost:8081

# on a phone or emulator
npx expo run:android                        # or: npx expo run:ios
EXPO_PUBLIC_API_URL=http://<your-lan-ip>:4000/api/v1 npx expo start
```

`@maplibre/maplibre-react-native` and `expo-camera` contain native code, so **Expo Go
cannot run this app** — `expo run:android` builds the development client once, then
`expo start` attaches to it. The web target has no such constraint, which is why the
browser build exists: it is the same screens, the same API calls, reviewable anywhere.

### Where the API is

No hardcoded host. `EXPO_PUBLIC_API_URL` wins if set; otherwise the app works it out:

| Target | Default |
| --- | --- |
| Web, hosted preview (`8081-<sandbox>.e2b.app`) | the API on the same sandbox, port 4000 |
| Web, local | `http://<same host>:4000/api/v1` |
| Android emulator | `http://10.0.2.2:4000/api/v1` (the emulator's alias for your machine) |

A physical phone is not on the emulator's network, so set `EXPO_PUBLIC_API_URL` to
your machine's LAN address there.

## Screens

| Tab | What it does |
| --- | --- |
| Aujourd'hui | Appointments, notifications (tap to mark read), events, announcements |
| Scanner | Camera QR, typed code, or the anchor list — the **server** resolves the fix |
| Carte | GPS outdoors, QR position indoors, route line + turn-by-turn steps, step-free mode |
| Salles | Request an administrative room, follow the scolarité's decision |

Decisions and new announcements arrive as device notifications while the app is open
(`src/useLiveNotifications.ts`), and the Today feed reloads with them.

## How it is tested

```bash
npm run typecheck      # the whole app, native and web files alike
npm run smoke:web      # a real click-through against a running app + API
```

`tools/smoke-web.mjs` loads the **production web bundle** in a DOM and drives the app
the way a student would: sign in, scan an anchor, ask for a route, file a room
request — then withdraws its own request so it can run again. It asserts the map's
no-WebGL fallback too, because that is what an old handset gets.

```
ok   the sign-in screen offers the demo student
ok   signing in reaches the student's day
ok   the feed carries real notifications
ok   an anchor fixes the indoor position
ok   a device without WebGL still gets the screen
ok   the server returns walkable steps
ok   a room request is filed and pending
ok   no uncaught errors
```

Start the API (`npm run dev` at the repository root) and the web build
(`npm run serve:web`) before running it.

## Platform splits

The bundler picks the file per platform; nothing above these pairs branches on
`Platform.OS`:

| Native | Web | Why |
| --- | --- | --- |
| `src/token-store.ts` (SecureStore keychain) | `.web.ts` (localStorage) | SecureStore has no browser implementation |
| `src/components/CampusMapView.tsx` (MapLibre Native) | `.web.tsx` (MapLibre GL JS) | different renderers, same style and data |
| `src/components/QrCamera.tsx` (expo-camera) | `.web.tsx` (getUserMedia + BarcodeDetector) | the browser decodes QR only where the platform API exists |
| `src/notify.ts` (expo-notifications) | `.web.ts` (Notification API) | web push needs infrastructure this demo does not have |

Where a capability is genuinely missing the app says so and offers the way round it —
the anchor list instead of the camera, the step list instead of the map — rather than
pretending or crashing.

## Not done

- No custom native build is produced here: this sandbox has no Android/iOS toolchain,
  so the native target is verified by type-checking and shared code, not by running it.
- Notifications are local. Real push needs an Expo project id and a server holding
  device tokens.
- Offline use is not supported: every screen reads live from the API.
