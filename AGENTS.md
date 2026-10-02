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
   every backend file, and `npm run typecheck` covers both clients.
   `npm run check:test` runs the actual PHPUnit suite.
   `npm run check` is the fast static gate (parse, contract, typecheck) and
   deliberately skips the suite so it stays usable; `npm run check:full`
   runs everything. **Rule 9 applies to `check:full`.** A green `check` alone
   is not a finished change — `check:php` cannot see a file that is
   syntactically valid and behaviourally broken, and one of those has
   already shipped through this gate.
   See docs/role-platform-matrix.md and docs/platform-role-audit.md.
9c. The PHP runtime IS available (PHP 8.5 at
   "C:\Program Files\php-8.5.2\php.exe"; the WinGet PHP 8.2 on PATH is the
   wrong one). Run the suite instead of trusting `check:php`: parsing proves
   a file is syntactically valid, never that it behaves. A change that only
   failed at runtime has shipped through this gate before.
10. Incremental, backend-first development per §75.
