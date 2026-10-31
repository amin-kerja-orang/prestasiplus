# ADR-0028: One shared `servable(question, activity)` service for student pools and admin indicators

Status: Proposed
Date: 2026-10-30

## Context
Each activity today has its own filter (practice `eligible`, Bijak `question-bank.source`, games `game-questions.service`, spm `pool.service`, battle deps). They disagree, silently drop shapes and cannot explain why. AC-05.6 requires the admin "Dilihat murid di" indicator and the student pools to be computed from the same rules.

## Decision
Create `apps/api/src/modules/questions/serving/` (owner: M04 questions module, exported through the module barrel; D11/D12: other modules call it, never re-implement).

1. **Facts.** A table `question_version_facts` (one row per question version, written in the same transaction as every question write, plus a reconcile job) stores the shape facts: leaf count, single-MCQ, answer modes, option count, option images, stem image, stimulus kinds, in-group, key present, scheme present, assets resolved, `unsupported_codes[]`, `dskp_complete`, `has_kbat`, `tp_max`. `computeFacts(record)` is the only writer of the columns.
2. **Rules.** One declarative file `activity-rules.ts`: for each `ActivityKey` an ordered list of rules `{ code, test(facts, ctx) -> boolean, sql: Prisma.Sql, messageMs, fixMs }`. The TypeScript `test` and the SQL fragment sit next to each other in the same object.
3. **API.** `ServabilityService.evaluate(record|facts, activity | family) -> { ok, reasons[] }` (single question, used for admin reads, post-draw re-verification, paper builder rows) and `ServabilityService.where(activity) -> Prisma.Sql` (pools, counts, samples). Reasons are stable codes (`not_approved`, `archived`, `level_inactive`, `dskp_incomplete`, `legacy_untagged`, `has_image_game`, `image_missing`, `no_key`, `no_scheme`, `shape_unsupported:<detail>`, `not_in_published_paper`, `not_in_tracking_set`, `not_pksk`, `grouped_unsupported`) mapped to the BM sentences of design spec section 9.3 in the contract package (`packages/contract/src/servability/copy.ts`).
4. **Families.** The seven "Dilihat murid di" families are a fixed grouping of the 19 activity keys; `evaluateFamilies()` returns the structure `VisibilityList` renders.
5. **Defence in depth.** Student pools draw ids with `where(activity)`, hydrate, and re-run `evaluate` on each drawn record. A disagreement is dropped, logged and counted in `servability_mismatch_total` (should stay 0).
6. **Parity test.** A matrix test builds one fixture question per shape x status x level state in a real database and asserts `where()` membership equals `evaluate().ok` for every activity (G3 gate; it is the AC-05.6 proof).

## Alternatives rejected
- Keep per-module filters and add reasons to each: five rule sets, drift guaranteed.
- Compute only in TypeScript and filter after fetching: unacceptable for the 7,199 row legacy bank and random draws (NFR: draws under 2 s p90).
- Put the rules in the frontend (FE-P1 `visibility.ts` idea): the browser cannot decide student eligibility, and it was a mock-mode design.

## Consequences
- Every pool consumer is refactored to call `where()` (tasks BE-B4..B7).
- Admin lists call `POST /api/admin/questions/servability:batch` (<= 100 ids, one query on the facts table).
- Adding an activity or a shape means one edit in `activity-rules.ts`.
