@PROMPT.md

# CampusFlow — Hard Rules (abridged)

Full specification: PROMPT.md (the complete master development prompt).

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
10. Incremental, backend-first development per §75.
