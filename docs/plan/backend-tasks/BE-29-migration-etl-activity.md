# BE-29 .cloud migration: ETL for activity, wallet, content and operations

| Field | Value |
|---|---|
| Size | L |
| Wave | M |
| Depends on | BE-28, BE-12, BE-11, BE-23, BE-24, BE-16; **OD-10** (Q4, Q5, Q8, Q9, Q10) |
| Parallel with | API cards |
| Owner module | migration (MIG-07 part 2) |

## Goal

Load the activity and operations groups of `v2-data-migration.md` section 6.1 steps 3 and 4 using the **historical snapshot** approach for question-dependent data (section 3.3): practice sessions and answers (with curriculum dimensions, nullable `question_id`, `historical = true`), exam attempt headers and scores, wallets and ledger, challenges, achievements, battles (only if built), feedback, interventions (if the feature exists), timeline, content, tickets.

## Inputs (read these)

- `docs/architecture/v2-data-migration.md` sections 3 (question-dependent data), 4.3 to 4.12, 5 (ledger integrity, derived data drift, timestamps), 6.1 steps 3 and 4, 7
- v2 schema from BE-11, 12, 16, 23, 24
- BE-27/BE-28 outputs

## Outputs

- `apps/api/src/migration/transform/{practice,exam,wallet,gamification,content,support}.ts`
- `apps/api/src/migration/load/**` (batched `COPY`, checkpoints)
- CLI: `migrate:activity --dry-run | --apply [--table=...]`
- A `migration_snapshot_dims` helper that computes subject/level/chapter/topic/difficulty/type/isCorrect for each `question_attempts` row **from the staging question tables** at extract time, then those tables are archived only
- Reconciliation + drift report (`derived figures old vs new`, accepted differences list)
- Tests with synthetic fixtures under `apps/api/test/migration/activity/**`

## Endpoints

None.

## DB tables touched

`practice_sessions`, `practice_answers`, `exam_attempts`, `attempt_results` (scores only), `wallets`, `coin_ledger`, `challenge_completions`, `user_achievements`, `articles`, `banners`, `videos`, `notes`, `support_tickets`, `feedback`, `migration_*`.

## Acceptance criteria

1. Every migrated answer row carries its own dimensions and correctness, `question_id` is null, `historical = true`; mastery and accuracy read from these rows give the same figures as the .cloud answer log for a fixture (test).
2. Review schedules and question-bound lists are dropped; teacher question sets keep headers only (Q4 default); structured/exam free-text answers and AI feedback are not migrated (Q5 default): only scores.
3. Ledger and wallet are migrated as is (both counters); the reconciliation report lists wallets whose balance differs from the ledger sum and does **not** correct them.
4. Dates: datetimes become `timestamptz`; date-only columns are kept; streaks and daily limits are recomputed in `Asia/Kuala_Lumpur` and a drift report is produced (Q8 default).
5. Sensitive categories (mood, psychometric, wellbeing alerts, foster applications) are not migrated unless the lead confirms (Q7).
6. Idempotent apply, dry-run without writes, per-table checkpoint resume after an injected failure (test).
7. Load throughput noted for 1M synthetic answer rows (bulk `COPY`, indexes created after load); numbers in the PR.
8. No personal data in logs or reports.

## Test commands

```
npm run be:test -- apps/api/test/migration/activity
npm run be:verify
```

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-29 (migration-etl-activity). Work in this repo clone on branch be/BE-29-migration-etl-activity, created from the latest origin/feature/v2-backend.
Read first, in order: AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10); docs/plan/backend-tasks/BE-29-migration-etl-activity.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs.
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-29 using the snapshot approach of docs/architecture/v2-data-migration.md section 3.3. Drop question-bound working state, keep scores only for structured/exam attempts, migrate ledger and wallet without correcting them, and report drift. Bulk-load with COPY, create indexes after load, support resuming from checkpoints.
```
