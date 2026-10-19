# BE-29 .cloud migration: ETL for activity, wallet, content and operations

| Field | Value |
|---|---|
| Size | L |
| Lane | PC-4 (folders: sessions.md section 5) |
| Priority | P2 |
| Wave | M |
| Depends on | BE-28, BE-11, BE-12, BE-16, BE-23, BE-24; **OD-10** (Q4, Q5, Q8, Q9, Q10) |
| Parallel with | API cards |
| Owner module | migration (MIG-07 part 2) |

## Goal

Load the activity and operations groups of `v2-data-migration.md` section 6.1 steps 3 and 4 using the **historical snapshot** approach for question-dependent data (section 3.3): practice sessions and answers (with curriculum dimensions, nullable `question_id`, `historical = true`), exam attempt headers and scores, wallets and ledger, challenges, achievements, battles (only if built), feedback, interventions (if the feature exists), timeline, content, tickets.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/architecture/v2-data-migration.md` sections 3 (question-dependent data), 4.3 to 4.12, 5 (ledger integrity, derived data drift, timestamps), 6.1 steps 3 and 4, 7; `docs/architecture/v2-backend-plan.md` section 14 and the matrix rows marked BE-29 in 14.7
- v2 schema from BE-11, 12, 16, 23, 24 (`apps/api/prisma/schema/{wallet,practice,exam,gamification,content}.prisma`)
- BE-27, BE-28 and BE-34 outputs

## Outputs

- `apps/api/src/migration/transform/{practice,exam,wallet,gamification,content,support}.ts`
- `apps/api/src/migration/load/**` (batched `COPY`, checkpoints in `etl_checkpoints`, `upsertByLegacy`)
- CLI (`apps/api/package.json` scripts, run as `npm run migrate:activity -w @pp/api -- --dry-run | --apply [--table=...]`): `migrate:activity`
- A `snapshot-dims` helper that computes subject/level/chapter/topic/difficulty/type/isCorrect for each `question_attempts` row **from the staging question tables** at extract time, after which those tables are archive-only
- Reconciliation + drift report (`derived figures old vs new`, accepted differences list) through `etl_recon`
- Tests with synthetic fixtures under `apps/api/test/migration/activity/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/migration/transform/**`, `apps/api/src/migration/load/**`, `apps/api/src/migration/snapshot-dims/**`, `apps/api/test/migration/activity/**`.
- Prisma file(s): none (no schema change).
- Contract: none.
- Seeds: none.
- Tests: `apps/api/test/migration/activity/**`.
- Other files: `apps/api/package.json` (script `migrate:activity`).
- Append-only shared files (one line each, never reorder): `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: Same as BE-28: SQL loads into other lanes' tables, no Prisma change; BE-28 and BE-29 are ordered by Depends on.

## Endpoints

None.

## DB tables touched

v2 targets: `practice_sessions`, `practice_answers`, `exam_attempts`, `attempt_results` (scores only), `wallets`, `coin_ledger`, `challenge_completions`, `user_achievements`, `articles`, `banners`, `videos`, `notes`, `support_tickets`. Loaded only if the owning card has merged, otherwise skipped and listed in the report: `timeline_posts` (BE-19), `feedback` and `interventions` (BE-20, only if the feature exists, Q7), `ai_usage_logs` (BE-36), battle tables (not built). Control tables: `etl_*`.

## Acceptance criteria

1. Every migrated answer row carries its own dimensions and correctness, `question_id` is null and `historical = true`; mastery and accuracy read from these rows equal the .cloud answer log for the fixture (test compares both).
2. Review schedules and question-bound lists are dropped; teacher question sets keep headers only (Q4 default); structured/exam free-text answers and AI feedback are not migrated (Q5 default): only scores. A test asserts no free-text column of the .cloud attempt tables reaches a v2 table.
3. Ledger and wallet are migrated as is (both counters); the reconciliation report lists wallets whose balance differs from the ledger sum and does **not** correct them (test with a planted mismatch: the v2 balance equals the .cloud balance and the report names the user id).
4. Dates: datetimes become `timestamptz`; date-only columns are kept; streaks and daily limits are recomputed in `Asia/Kuala_Lumpur`, and a drift report is produced (Q8 default); a fixture row at 23:30 UTC (07:30 next day in Malaysia) lands on the Malaysia date.
5. Sensitive categories (mood, psychometric, wellbeing alerts, foster applications) are not migrated unless the lead confirms (Q7); a test asserts their staging tables are never read by the transforms.
6. Idempotent apply (twice gives the same content hash), dry-run without writes outside `etl_*`, and per-table checkpoint resume after an injected failure (test kills the run after batch N and resumes at N+1 with identical final data).
7. Load throughput for 1M synthetic answer rows (bulk `COPY`, indexes created after the load) is measured and written in the PR (a number to record, not a pass/fail threshold).
8. No personal data in logs or reports (log-capture test on the fixtures).

## Test commands

```
npm run be:test -- apps/api/test/migration/activity
npm run be:verify
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green. Paste the real tail of the output in the PR.
3. This card has no HTTP endpoints, so it adds no conformance scenarios; after BE-31 merges, `npm run be:test -- apps/api/test/conformance` must still pass.
4. This card creates no tables; the migration-first checklist (plan section 14.9) does not apply, but no change may break `npm run be:lint:migration` (once BE-34 is merged).
5. No security review is required; list any security-relevant decision in the PR anyway.
6. The card's tracker row is updated (status, PR number, one-line note) and the PR description follows the template in `docs/plan/backend-tasks/README.md`. Nothing stays only on your PC (AGENT-SYNC.md section 4).

## Open questions

Do not guess these; write your working assumption in the PR and ask the lead (issue labelled `question`) if it blocks you.

1. OD-10 answers for Q4, Q5, Q8, Q9 and Q10 are needed before an `--apply` on real data.
2. Entities whose owning card is not merged (see "DB tables touched") are skipped, not faked. Confirm that skipping is acceptable for the rehearsal.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-29 (migration-etl-activity). Work in this repo clone on branch be/BE-29-migration-etl-activity, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-29-migration-etl-activity.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-29 using the snapshot approach of docs/architecture/v2-data-migration.md section 3.3. Drop question-bound working state, keep scores only for structured/exam attempts, migrate ledger and wallet without correcting them, and report drift. Bulk-load with COPY, create indexes after load, support resuming from checkpoints.
```
