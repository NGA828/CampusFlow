# CampusFlow

> **Navigate. Learn. Connect.**

CampusFlow is an intelligent campus management, navigation and student-services
platform. It replaces disconnected systems — paper schedules, physical queues,
verbal directions, WhatsApp groups and manual office visits — with one connected
campus experience for **students**, **staff** and **administrators**.

Students see their next class, navigate indoors via QR positioning, join
room-admission queues and administrative-office ticket queues, receive real-time
notifications, and talk to an AI campus assistant that acts through controlled
backend tools (never direct database access).

---

## Repository layout

```
CampusFlow/
├── backend/     # Laravel 13 (PHP) — authoritative API, business logic, realtime
├── frontend/    # Next.js 16 (React 19, TypeScript, Tailwind v4) — web app
├── mobile/      # Expo (React Native, TypeScript) — student mobile app
└── docs/        # Architecture, API contract, design system, design research
```

The application follows **feature-oriented organization**: each major
functionality owns its code (e.g. `features/queue/`, `app/Services/Queue/`),
rather than one giant `components/` / `controllers/` folder.

---

## Technology stack

| Layer      | Technology |
|------------|------------|
| Web frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 |
| Mobile     | React Native (Expo SDK 57), TypeScript, expo-router, expo-camera |
| Backend    | Laravel 13, PHP 8.3+ |
| Database   | PostgreSQL + PostGIS (spatial data) |
| Realtime   | Laravel Reverb + Laravel Echo (WebSockets) |
| Cache/Jobs | Redis |
| Auth       | Laravel Sanctum (bearer tokens) |
| Routing    | A* / Dijkstra (server-side navigation engine) |
| AI         | LLM via a controlled Laravel AI service/tool layer |

---

## Getting started

Each app is self-contained. See `backend/README.md` (Laravel),
`frontend/README.md` (Next.js) and `mobile/README.md` (Expo) after the
CampusFlow-specific instructions below.

### Prerequisites

- PHP 8.3+ and Composer (backend)
- Node.js 20+ (frontend, mobile)
- PostgreSQL 15+ with the PostGIS extension
- Redis
- (optional) an LLM API key for the AI assistant

### Backend

```sh
cd backend
composer install
cp .env.example .env
php artisan key:generate
# edit .env — set DB_*, REDIS_*, REVERB_* and AI_* values
php artisan migrate --seed
php artisan serve            # API on http://localhost:8000
php artisan reverb:start     # WebSocket server
```

### Frontend

```sh
cd frontend
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL=http://localhost:8000/api
npm run dev                  # http://localhost:3000
```

If `NEXT_PUBLIC_API_URL` is left empty the frontend runs in a clearly-marked
**demo (mock) mode** so the UI can be designed and previewed before the API is
reachable. See `docs/API.md`.

### Mobile

```sh
cd mobile
npm install
cp .env.example .env.local   # set EXPO_PUBLIC_API_URL
npx expo start
```

---

## Key architectural principles

- **The backend is authoritative.** AI and frontends interpret and present; the
  Laravel backend makes every business decision (auth, capacity, geofence,
  queue position). See `docs/ARCHITECTURE.md`.
- **Safe queue concurrency.** Positions are assigned inside a PostgreSQL
  transaction with row-level locking — two simultaneous students can never
  receive the same position.
- **Deterministic routing.** Routes come from A*/Dijkstra over a navigation
  graph, never from an LLM.
- **QR nodes as positioning anchors.** A scanned QR resolves to a known spatial
  node (`building/floor/x/y/z`).
- **Standardized API contract.** Every response uses a `{success, data,
  message, errors}` envelope and consistent HTTP status codes. See
  `docs/API.md`.

---

## Documentation

| Document | Purpose |
|----------|---------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Architectural decisions, domain modules, data model overview |
| [`docs/API.md`](docs/API.md) | API contract, envelope, status codes, endpoint reference |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | Design tokens, components, states, accessibility |
| [`docs/DESIGN_RESEARCH.md`](docs/DESIGN_RESEARCH.md) | Traceable design research log + decision records |
| [`docs/PHASES.md`](docs/PHASES.md) | Delivery-phase tracker with status |

---

## Testing

```sh
cd backend && php artisan test      # PHPUnit feature + unit tests
cd frontend && npm run lint && npx tsc --noEmit && npm run build
cd mobile && npx tsc --noEmit && npm run lint
```

Critical end-to-end workflows (login → dashboard → timetable, queue
concurrency, office ticket lifecycle, geofencing, realtime updates) are
documented in `docs/PHASES.md` and covered by automated tests as each phase
lands.
