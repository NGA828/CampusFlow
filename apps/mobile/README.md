# CampusFlow — student mobile app (Expo)

The student experience on a phone: QR-anchor indoor positioning, GPS outdoors, the
MapLibre campus map with server-computed indoor routes, room requests and
notifications.

## Run it

```bash
cd apps/mobile
npm install
EXPO_PUBLIC_API_URL=http://<your-lan-ip>:4000/api/v1 npx expo start
```

`@maplibre/maplibre-react-native` and `expo-camera` contain native code, so **Expo Go
cannot run this app** — build a development client once:

```bash
npx expo run:android      # or: npx expo run:ios
```

The dependencies are not installed in this repository's sandbox (no Android/iOS
toolchain is available here), so this app is shipped as source. Everything it calls
is already implemented and tested in `apps/api`: `/auth/login`, `/auth/me`,
`/universities/iai-cameroun/campus`, `/positioning/scan`, `/navigation/route`,
`/bookings`, `/notifications`, `/events`, `/announcements`.

## Screens

| Tab | What it does |
| --- | --- |
| Aujourd'hui | Appointments, notifications (tap to mark read), events, announcements |
| Scanner | Camera QR reading; the **server** resolves the anchor, an unknown code is refused |
| Carte | GPS position outdoors, QR position indoors, route line + turn-by-turn steps |
| Salles | Request an administrative room, follow the scolarité's decision |
