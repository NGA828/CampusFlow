# CampusFlow — Hard Rules (abridged)

Full specification: PROMPT.md (the complete master development prompt).
Read it before starting any work on this repository.

Hard gates — never skip for convenience:

1. Inspect the repository before modifying anything (PROMPT.md §4, §94).
2. Backend (Laravel) is authoritative for auth, authorization, queue
   positions, capacity, tickets, and routes. The LLM/AI assistant never
   touches the database directly (§7, §31, §33).
3. Design research is a blocking gate before final UI implementation of
   every major screen: search → inspect ≥3 references → score 1–10 →
   compare → select → document → then implement (§45–§59). No generic
   Tailwind/shadcn template as the final design (§3, §44, §77).
4. Document research in docs/design-research.md and docs/design-decisions/
   with real sources — never fabricate URLs or claims (§49).
5. Score every implemented screen; average ≥ 8/10 or improve (§57).
6. Concurrency-critical queue logic: transactions, row locking, unique
   constraints — never frontend-only (§21).
7. No fake functionality, placeholder APIs, dead buttons, or success
   without backend confirmation (§3, §38, §41).
8. Centralized API clients via NEXT_PUBLIC_API_URL / EXPO_PUBLIC_API_URL —
   no scattered hardcoded URLs (§36).
9. Tests before "done" (§64–§69, §93).
9b. Role × platform separation is enforced by scripts, not by review:
   `npm run check:separation` fails when either client calls a route that
   does not exist, when a mobile-only capability is wired into the web
   client (or the reverse), when a feature test asserts against a dead path,
   or when a route has no screen in front of it. `npm run check:php` parses
   every backend file (there is no PHP runtime in this environment, so a
   syntax error is otherwise invisible until someone runs `artisan`), and
   `npm run typecheck` covers both clients. All three run in
   `npm run check` and must be green before a claim of "done".
   See docs/role-platform-matrix.md and docs/platform-role-audit.md.
10. Incremental, backend-first development per §75.
