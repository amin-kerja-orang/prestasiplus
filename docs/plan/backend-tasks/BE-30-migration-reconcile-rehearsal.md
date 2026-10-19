# BE-30 .cloud migration: reconciliation, rehearsal and cutover scripts

| Field | Value |
|---|---|
| Size | M |
| Lane | PC-4 (folders: sessions.md section 5) |
| Priority | P2 |
| Wave | M |
| Depends on | BE-29, BE-35 (a staging environment from the lead/devops, MIG-08, is needed only for the rehearsal) |
| Parallel with | BE-33 |
| Owner module | migration (MIG-07 part 3, MIG-09) |

## Goal

Prove the migration end to end on a staging copy: full-run orchestrator, reconciliation reports, delta (incremental by `updated_at`) run for the freeze window, rollback by dropping the target schema, plus the optional post-reload backfill job that links old attempts to new bank questions by natural key + content hash (MIG-09).

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/architecture/v2-data-migration.md` sections 3.3 (backfill), 5 (cutover), 6; `docs/architecture/v2-backend-plan.md` section 14.6 (reconciliation contract) and 14.8
- `docs/architecture/v2-migration-runbook.md` (created by BE-27; BE-35 adds fixture and dump sections), BE-28/29 CLIs, BE-35 fixtures
- `docs/ops/containers.md`
- Requirements: BE-MIG-04, BE-MIG-11, BE-MIG-12, BE-MIG-13, BE-MIG-16; BE-OPS-07 ([URS 9.2](../../requirements/v2-backend-urs.md))

## Outputs

- `apps/api/src/migration/orchestrate.ts` (npm scripts `migrate:all`, `migrate:delta`, `migrate:verify`, run with `-w @pp/api`)
- `apps/api/src/migration/verify/**`: row-count reconciliation per table, sample-free statistical checks (distribution of answers per subject, ledger sums, users per role per school), orphan scan on the v2 side, per entity as plan 14.6
- `apps/api/src/migration/backfill/link-questions.ts` (best-effort link by `source_papers.natural_key` + `content_hash` from BE-10, run only after the new bank exists; never overwrites a non-null `question_id`)
- Runbook updates in `docs/architecture/v2-migration-runbook.md`: rehearsal checklist, freeze window steps, rollback, post-cutover verification, deletion of dumps
- Tests under `apps/api/test/migration/verify/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/migration/orchestrate.ts`, `apps/api/src/migration/verify/**`, `apps/api/src/migration/backfill/**`, `apps/api/test/migration/verify/**`, `docs/architecture/v2-migration-runbook.md`.
- Prisma file(s): none (no schema change).
- Contract: none.
- Seeds: none.
- Tests: `apps/api/test/migration/verify/**`.
- Other files: `apps/api/package.json` (scripts `migrate:all`, `migrate:delta`, `migrate:verify`).
- Append-only shared files (one line each, never reorder): `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: PC-4 only; no Prisma file. It edits the runbook created by BE-27 and extended by BE-35 (BE-30 depends on both).

## Endpoints

None.

## DB tables touched

All migrated v2 tables (read), `etl_*`, `practice_answers.question_id` (backfill only, through SQL; no schema change).

## Acceptance criteria

1. `migrate:all` on the BE-35 synthetic fixtures finishes with a green `migrate:verify`; the report is written to `.migration-out/` (git-ignored) and contains one row per entity in the plan 14.7 matrix with source count, loaded, rejected, `expected_delta` and status.
2. `migrate:delta` applied after changing one fixture row (newer `updated_at`) updates only that row (row-level diff in the test) and is idempotent when run twice.
3. Rollback: the documented procedure (drop the loaded `legacy_source = 'cloud'` rows, or the target schema in a rehearsal database) restores the pre-migration row counts of every migrated table; the source stays untouched, proven by the read-only role check of BE-27 (privileges, not trust).
4. The backfill never changes answer correctness or dimensions; it sets `question_id` only when exactly one candidate matches, lists ambiguities and non-matches in the report, and never overwrites a non-null `question_id` (tests for all four cases).
5. The rehearsal checklist in the runbook covers freeze, dump import, dry-run, apply, verify, go/no-go criteria, rollback and dump deletion; the lead reviews it and signs off in the PR (acceptance by the lead, not a test).
6. No secrets in scripts; every secret comes from the environment or the platform secret store (secret scan green).

## Test commands

```
npm run be:test -- apps/api/test/migration
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

1. `source_papers.natural_key` and `content_hash` are defined by BE-10; the backfill needs their definition. Confirm in the BE-10 PR before coding the matcher.
2. A staging environment for the rehearsal comes from the lead (MIG-08); the card is complete without it, the rehearsal itself is a lead task (L2).

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-30 (migration-reconcile-rehearsal). Work in this repo clone on branch be/BE-30-migration-reconcile-rehearsal, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-30-migration-reconcile-rehearsal.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-30. Orchestrate the BE-27..29 stages, add reconciliation and delta modes, the rollback procedure and the optional question backfill. Everything is tested on synthetic fixtures; the real rehearsal is run by the lead. Update docs/architecture/v2-migration-runbook.md.
```
