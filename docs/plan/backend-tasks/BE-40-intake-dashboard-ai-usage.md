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

- `docs/requirements/v2-question-bank.md` US-29 and AC-29.1, AC-29.2; NFR-03
- BE-36 (`ai_usage_logs`, `ai_settings`), BE-38 (`intake_items`, `intake_item_events`, batches)
- The frontend intake dashboard screen/mock (paths from the lead)

## Outputs

- Contract: `packages/contract/src/intake/dashboard.ts`
- `apps/api/src/modules/intake/dashboard/**` (SQL read models, no new tables unless a materialised view is justified in the PR)
- Tests under `apps/api/test/intake-dashboard/**`

## Endpoints (Admin Pusat only; final paths from the contract commit)

| Method and path (indicative) | Notes |
|---|---|
| `GET /intake/dashboard` | all AC-29.1 figures for a month (default current, Malaysia time) |
| `GET /intake/dashboard/cost` | cost by day/provider/batch, budget, percent used |

## DB tables touched

Reads only.

## Acceptance criteria

1. Every figure of AC-29.1 is computed from seeded fixtures and equals a hand-computed expectation in the test.
2. Month boundaries use `Asia/Kuala_Lumpur`; test with rows at 23:59 and 00:01 local time.
3. Test-data rows (`is_test`) are excluded.
4. Guru, Admin Sekolah, Murid get 403; no session 401.

## Test commands

```
npm run be:test -- apps/api/test/intake-dashboard
npm run contract:check
npm run be:verify
```

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-40 (intake-dashboard-ai-usage). Work in this repo clone on branch be/BE-40-intake-dashboard-ai-usage, created from the latest origin/feature/v2-backend.
Read first, in order: AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 15); docs/plan/backend-tasks/BE-40-intake-dashboard-ai-usage.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/intake/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend dashboard mock (paths from the lead) and docs/requirements/v2-question-bank.md US-29 are the spec: do not invent business rules; unknowns go under "Open questions" in the PR. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders. Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
Task: implement BE-40 read models for the intake dashboard and AI cost view.
When finished run npm run be:verify and report: files changed, endpoints, real test output, deviations, open questions. Update docs/plan/backend-tracker.md (your card row) in the same PR.
```
