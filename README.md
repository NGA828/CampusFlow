# CampusFlow

Campus discovery, indoor and outdoor navigation, and student services for the
universities and grandes écoles of **Yaoundé, Cameroon**.

This is a clean rebuild. The previous Laravel + Next.js + Expo codebase was removed
and replaced with a small, dependency-light monorepo that actually runs in one
command.

```
apps/api     REST API — Node standard library only, no framework, no runtime deps
apps/web     Next.js 16 web app (visitor, student, staff, administrator) + MapLibre
tools/dev.mjs  starts both with a single Ctrl+C
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

## Known limits

- Storage is in memory. Restarting the API resets accounts, bookings and
  notifications to the seed — `/api/v1/health` says so in its own payload.
- The IAI indoor model is a working model of the Nkol Anga'a campus, not a survey.
- The Expo mobile client (QR camera scanning, GPS, push notifications) is not in this
  rebuild yet; the API endpoints it needs (`/positioning/scan`, `/navigation/route`,
  `/notifications`) already exist and are tested.
