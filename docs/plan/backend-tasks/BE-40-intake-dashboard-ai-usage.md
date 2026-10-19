# BE-40 Intake dashboard, AI usage and budget endpoints

| Field | Value |
|---|---|
| Size | S |
| Lane | PC-5 (folders: sessions.md section 5) |
| Priority | P2 |
| Wave | 4 |
| Depends on | BE-36, BE-38 |
| Parallel with | BE-20, BE-21, BE-22, BE-26 |
| Owner module | intake (read models) |
| Security review | not required beyond the BE-36/38 reviews (aggregates, admin only) |

## Goal

(v2-question-bank US-29) The Admin Pusat intake dashboard data: submissions by status, queue size and oldest item age, extraction success rate, percentage of AI tags accepted unchanged per field, duplicate rate, and AI cost this month versus the cap. Pure read models over BE-36/BE-38 tables.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/requirements/v2-question-bank.md` US-29 and AC-29.1, AC-29.2, AC-29.3; NFR-03
- BE-36 (`ai_usage_logs`, `ai_settings`), BE-38 (`intake_items`, `intake_item_events`, batches) outputs
- No intake dashboard screen exists in `src/` yet (checked: `src/modules/m28-bijak-spm/admin/intake/pages/` has list, upload and review only); the wire shape is defined by this card's contract PR from AC-29.1 and the lead aligns the future screen through it.

## Outputs

- Contract: `packages/contract/src/intake/dashboard.ts`
- `apps/api/src/modules/intake/dashboard/**` (SQL read models, no new tables unless a materialised view is justified in the PR)
- Tests under `apps/api/test/intake-dashboard/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/modules/intake/dashboard/**`.
- Prisma file(s): none (no schema change).
- Contract: `packages/contract/src/intake/dashboard.ts` (new files only), registered in `src/openapi.ts`; `openapi.json` is regenerated with `npm run contract:emit`, never hand-edited.
- Seeds: none.
- Tests: `apps/api/test/intake-dashboard/**`, and (after BE-31) new scenario files in `apps/api/test/conformance/intake/`.
- Append-only shared files (one line each, never reorder): `apps/api/src/modules/index.ts` (one import and one array entry); `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: No Prisma file (SQL read models; a materialised view would need a migration and a justification in the PR). It runs after BE-38 (intake.prisma), in parallel with BE-20, BE-21, BE-22 and BE-26.

## Endpoints (new; Admin Pusat only; no mock route exists; paths fixed in this card's contract PR)

| Method and path | Notes |
|---|---|
| `GET /api/intake/dashboard` | all AC-29.1 figures for a month (`month=YYYY-MM`, default the current Malaysia month): submissions by status, queue size and oldest item age, extraction success rate, percentage of tags accepted unchanged per field, duplicate rate, AI cost this month |
| `GET /api/intake/dashboard/cost` | cost by day, provider and batch, the budget and the percent used (from `ai_settings` and `ai_usage_logs`) |

## DB tables touched

Reads only.

## Acceptance criteria

1. Every figure of AC-29.1 is computed from seeded fixtures and equals a hand-computed expectation written in the test (one assertion per figure, fixture values listed in the test).
2. Month boundaries use `Asia/Kuala_Lumpur`: rows at 2026-09-30T23:59+08:00 and 2026-10-01T00:01+08:00 fall into September and October respectively.
3. Runs of the `mock` provider are labelled by their provider and cost 0; the cost endpoint can filter by provider so development runs do not distort a real month (test with one `mock` and one real-provider row).
4. Guru, Admin Sekolah and Murid get 403; no session 401; both endpoints are GET, so no CSRF case.
5. The percent used equals `cost / AI_MONTHLY_BUDGET_SEN` (or the `ai_settings` override) rounded to one decimal, and 80% / 100% flags match BE-36's thresholds.

## Test commands

```
npm run be:test -- apps/api/test/intake-dashboard
npm run contract:check
npm run be:verify
npm run be:test -- apps/api/test/conformance   # only after BE-31 is merged
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green; if anything under `packages/**` changed, root `npm run typecheck && npm test` is green too. Paste the real tail of the output in the PR.
3. Conformance (BE-31): once BE-31 is merged, add this card's scenarios as new files in `apps/api/test/conformance/intake/` and run `npm run be:test -- apps/api/test/conformance`; a failure is a blocker. Before BE-31 merges, `be:verify` is the gate; write "conformance scenarios pending BE-31" in the PR.
4. This card creates no tables; the migration-first checklist (plan section 14.9) does not apply, but no change may break `npm run be:lint:migration` (once BE-34 is merged).
5. No security review is required; list any security-relevant decision in the PR anyway.
6. The card's tracker row is updated (status, PR number, one-line note) and the PR description follows the template in `docs/plan/backend-tasks/README.md`. Nothing stays only on your PC (AGENT-SYNC.md section 4).

## Open questions

Do not guess these; write your working assumption in the PR and ask the lead (issue labelled `question`) if it blocks you.

1. "Percentage of tags accepted unchanged per field": which fields count (subject, level, chapter, DSKP topic, difficulty per NFR-01)? Working assumption: those five.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-40 (intake-dashboard-ai-usage). Work in this repo clone on branch be/BE-40-intake-dashboard-ai-usage, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/plan/sessions.md section 5 (folder ownership); docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 15); docs/plan/backend-tasks/BE-40-intake-dashboard-ai-usage.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/intake/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend dashboard mock (paths from the lead) and docs/requirements/v2-question-bank.md US-29 are the spec: do not invent business rules; unknowns go under "Open questions" in the PR. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders. Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
Task: implement BE-40 read models for the intake dashboard and AI cost view.
When finished run npm run be:verify and report: files changed, endpoints, real test output, deviations, open questions. Update docs/plan/backend-tracker.md (your card row) in the same PR.
```
