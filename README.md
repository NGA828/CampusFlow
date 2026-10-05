# CampusFlow

Campus discovery, indoor and outdoor navigation, and student services for the
universities and grandes écoles of **Yaoundé, Cameroon**.

This is a clean rebuild. The previous Laravel + Next.js + Expo codebase was removed
and replaced with a small, dependency-light monorepo that actually runs in one
command.

```
apps/api     REST API — Node standard library only, no framework, no runtime deps
apps/web     Next.js 16 web app (visitor, student, staff, administrator) + MapLibre
apps/mobile  Expo student app — QR positioning, GPS, MapLibre native, notifications
tools/dev.mjs  starts the API and the web app with a single Ctrl+C
```

## Run it

```bash
npm install
npm run dev          # web on :3000, API on :4000
```

The browser only ever talks to the web port: `apps/web/next.config.ts` rewrites
`/api/v1/*` to the API process, so the hosted preview never makes a cross-origin
request and never depends on a third-party cookie.

```bash
npm run typecheck    # both workspaces
npm test             # API route tests (authorisation, bookings, routing)
npm run check        # typecheck + tests
```

## Signing in

Opening `/login` signs you in as the walkthrough **student** immediately — that is
the demo entry point. It is a real sign-in: the API issues a bearer token and checks
the role on every later request.

| Role | Email | Password |
| --- | --- | --- |
| Student | `etudiant@iaicameroun.cm` | `CampusFlow2026` |
| Staff (scolarité) | `scolarite@iaicameroun.cm` | `CampusFlow2026` |
| Administrator | `direction@iaicameroun.cm` | `CampusFlow2026` |

`/login?manual=1` skips the automatic sign-in and shows the form — that is how you
reach the staff and administrator accounts.

## What each role gets

**Visitor** — the public directory of 20 Yaoundé institutions on a MapLibre map,
with search and type filters, plus published events and announcements, and student
registration.

**Student** — a dashboard of appointments, notifications, events and notices; the
IAI campus map with QR-anchor positioning and step-by-step indoor routes (including
a step-free option); room browsing and administrative room requests.

**Staff** — the room requests queue with approve/decline and a note to the student,
and announcement publishing that notifies every student of the institution.

**Administrator** — account issuing (student, staff, administrator), the account
list and directory statistics.

## The directory

20 institutions, each with the sources it came from: public universities (UY1, UY2
Soa), grandes écoles (ENSPY/Polytechnique, ENS, ENSTP, ESSTIC, IRIC, FMSB), the
military academy (EMIA), inter-state and international institutions (IAI Cameroun,
UCAC) and nine private institutions (Siantou, ICT University, PKFokam, IUG, ISTA,
Ndi Samba and others).

Coordinates say what they are worth: `CITY_LOCATION` means the point locates the
institution in the city, `CAMPUS_POINT` means it came from a mapped campus feature.
No entry claims a surveyed boundary.

**IAI Cameroun is the indoor pilot** (`indoorMappingPriority: 1`): three buildings,
five floors, 14 rooms, 8 printed QR anchors and a 36-node walking graph that the API
routes over with Dijkstra, with a fixed penalty per level change and a step-free mode
that removes stairs entirely.

## Storage

Records live in memory and are mirrored to `.data/campusflow.json` after every
successful write (temporary file + rename, so a crash mid-write cannot truncate the
file). The API restores that file on boot and only falls back to the seed when it is
missing. Sessions are deliberately **not** persisted: restarting the API signs
everyone out, but their accounts, bookings, notifications and announcements survive.

Set `CAMPUSFLOW_DATA_FILE` to move the file; delete it to go back to the seed.
`GET /api/v1/health` reports the path in use.

## The mobile app

`apps/mobile` is the student experience on a phone: four tabs (Aujourd'hui, Scanner,
Carte, Salles), QR anchors scanned with the camera and resolved by the API, GPS
outdoors, MapLibre native rendering of the same campus model the web app draws, room
requests, and local notifications for time-sensitive guidance.

It is kept out of the npm workspaces on purpose — it needs a native toolchain, which
this repository's CI does not have, and installing it would slow every `npm install`
down. See `apps/mobile/README.md` for how to build the development client.

## Known limits

- The JSON data file is a single-writer store for one API process — fine for a
  demo and a pilot campus, not a substitute for a database.
- The IAI indoor model is a working model of the Nkol Anga'a campus, not a survey.
- The mobile app is shipped as source: it requires a custom Expo development build
  (MapLibre native and `expo-camera` do not run in Expo Go) and cannot be compiled
  in this sandbox.
