# Working in this repository

CampusFlow is a small npm-workspace monorepo. Read this before changing anything.

## Layout

| Path | What it is |
| --- | --- |
| `apps/api` | REST API, Node standard library only. Run with `node --experimental-strip-types`. |
| `apps/web` | Next.js 16 app router, React 19, MapLibre GL. |
| `apps/mobile` | Expo student app. **Not** an npm workspace, not installed, not type-checked in CI. |
| `tools/dev.mjs` | Starts the API (4000) and the web app (3000) together. |
| `docs/` | Content provenance for the directory and the content feed. |

## Rules that are not negotiable

1. **The API has no runtime dependencies.** No express, no bcrypt, no tsx, no test
   framework — `node:http`, `node:crypto` and `node --test` do the job. Keep it that
   way: it is why `npm install` is 58 packages and why nothing here can break on a
   flaky registry.
2. **The browser never calls port 4000.** `apps/web/next.config.ts` rewrites
   `/api/v1/*` to `API_ORIGIN`. Front-end code uses relative URLs only — the hosted
   preview runs on a different host from the sandbox.
3. **Directory entries cite their sources.** Every institution in
   `apps/api/src/data/universities.ts` carries `sources[]` and an honest
   `locationPrecision` (`CITY_LOCATION` vs `CAMPUS_POINT`). Do not invent coordinates.
4. **Tests must not touch the data file.** `apps/api/test/api.test.ts` calls
   `disablePersistence()` before anything else; new test files must too.
5. **IAI Cameroun is the indoor pilot.** Other campuses answer 404 on
   `/universities/:slug/campus` by design; the message says so.

## Before you finish

```bash
npm run check   # typecheck both workspaces + the API test suite
```

Both must pass. If you changed routing, bookings or authorisation, add a case to
`apps/api/test/api.test.ts` — the suite drives `router.match()` handlers directly, so
a new case is a few lines and needs no server.
