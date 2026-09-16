# CampusFlow — Navigate. Learn. Connect.

An intelligent campus management, navigation and student-services platform: a **Next.js web app**,
an **Expo mobile app** and a **Laravel REST API** sharing one set of contracts, backed by
PostgreSQL/PostGIS.

```
frontend/   Next.js 16 (App Router, React 19, Tailwind v4) — student, staff and admin consoles
mobile/     Expo SDK 57 (expo-router) — scanner, queues, timetable, live navigation
backend/    Laravel API — auth/RBAC, campus, positioning, navigation, queues, offices,
            engagement, notifications and administration
scripts/    dev launcher
docs/       Architecture, API and design-research documentation
```

## Quick start

```bash
npm run setup        # installs Laravel, frontend and mobile, migrates + seeds the database
npm run dev          # Laravel API on :8001, web app on :3000
```

Open <http://localhost:3000>. Seeded accounts (password `password123`):

| Role | Email |
| --- | --- |
| Student | `student@campusflow.edu` |
| Staff | `staff@campusflow.edu` |
| Admin | `admin@campusflow.edu` |

Database helpers: `npm run db:migrate`, `npm run db:seed`, `npm run db:reset`. Checks:
`npm run typecheck`, `npm test` (Laravel API), and the Laravel feature tests provide the
end-to-end API coverage.

### Mobile app

```bash
cd mobile && npm install
EXPO_PUBLIC_API_URL=http://<your-lan-ip>:8001/api/v1 npm run start   # scan the QR with Expo Go
```

A phone cannot reach `127.0.0.1`, so point `EXPO_PUBLIC_API_URL` at your machine's LAN address.
See [`mobile/README.md`](mobile/README.md) for the screen list and push-notification notes.

## What it does

- **Personal timetable** derived from enrolments → courses → the master timetable.
- **Campus map & indoor positioning** — buildings, floors, rooms, floor plans and signed QR
  anchors validated by the API.
- **Navigation** — A* over a stored walking graph, turn-by-turn indoor/outdoor steps, accessible
  (step-free) preference, live tracking, off-route warning with a grace period and automatic
  recalculation.
- **Room admission queues** — geofence-checked joins, one active ticket per student enforced by
  transactions, row locks and unique constraints; position, ETA, check-in window and no-show policy.
- **Administrative office ticketing** — ticket numbers per office, position, expected service
  window, proximity check-in and the full service lifecycle.
- **Engagement** — events, announcements and notifications delivered in-app, over the websocket
  (Reverb-style channel model on `/api/ws`) and as push where the device allows it.
- **AI Campus Assistant** — a natural-language gateway to a controlled set of backend tools; it
  never issues SQL and never bypasses the caller's own authorization.
- **Staff and admin consoles** — queue/office operations, timetable publishing, content, users and
  roles, campus and spatial editing, service configuration and analytics computed from live data.

## Documentation

- **[Setup, user & test guide (PDF)](docs/guides/guide.pdf)** — new-machine installation,
  role-by-role web/mobile usage, a handover-call walkthrough, 95 acceptance-test scenarios,
  troubleshooting and known limitations. [Editable source and rebuild instructions](docs/guides/README.md).

- [`docs/design-research.md`](docs/design-research.md) — the blocking design-research gate: the
  references that were inspected, the weighted rubric, the per-screen decisions and the review
  scores.

- [`docs/responsive.md`](docs/responsive.md) — responsive web/native patterns, framework and image
  recommendations, automated layout checks, and the remaining physical-device QA checklist.

Additional documents (architecture, API, database, navigation, queue system, administrative
office, AI assistant, testing, deployment) are listed in `AGENTS.md`/`PROMPT.md`; they are written
from the same source of truth as the code in `backend/` and `frontend/`.

### Enable the AI model

The Laravel assistant uses OpenAI `gpt-4o-mini` as an intent planner when an API key is configured.
The model can only choose from tools already authorized for the signed-in role and platform; Laravel
still reads the campus data and executes the tool. Without a key, the built-in deterministic planner
remains available for local testing.

Add these values to `backend/.env` (never commit the key):

```dotenv
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_TIMEOUT_SECONDS=20
```

Then clear cached Laravel configuration and restart the API:

```powershell
php backend\artisan config:clear
php backend\artisan serve --host=0.0.0.0 --port=8001
```

The assistant capabilities response reports `planner: openai` when the model is active. If the key is
empty, it reports `planner: deterministic`.
