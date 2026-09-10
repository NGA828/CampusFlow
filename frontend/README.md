# CampusFlow — Web (Next.js)

The CampusFlow web app: public landing, authentication, and the student
experience (dashboard, schedule). Staff and administrator portals follow in
later phases.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Inter
(self-hosted).

## Run

```sh
npm install
cp .env.example .env.local   # optional — set NEXT_PUBLIC_API_URL
npm run dev                  # http://localhost:3000
```

- With `NEXT_PUBLIC_API_URL` set, the app talks to the Laravel API.
- Without it, the app runs in a **clearly-marked demo (mock) mode** so the UI
  can be previewed before the backend is reachable.

## Checks

```sh
npm run lint        # eslint
npx tsc --noEmit    # typecheck
npm run build       # production build
```

## Structure

```
app/               # route groups: (auth), student/, coming-soon
features/          # authentication, dashboard, timetable (feature-owned code)
components/ui/     # design-system primitives
components/layout/ # shells + brand + demo banner
lib/api/           # centralized client, contract types, dev mock
lib/auth/          # token/session handling
hooks/             # useApiResource, useSession
```

API contract and design-system documentation live in `../docs/`.
