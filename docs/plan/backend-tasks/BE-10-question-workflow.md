# BE-10 Question workflow: reports, submissions, imports, quality, DSKP source

| Field | Value |
|---|---|
| Size | M |
| Wave | 2 |
| Depends on | BE-09 |
| Parallel with | BE-12, BE-15, BE-17 |
| Owner module | M04 |

## Goal

The review lifecycle and the supporting M04 features: Draf, Semakan, Lulus, Terbit, Diarkib transitions with audit, Guru verification of own uploads, Admin Pusat approval/publication, student question reports, teacher submissions, CSV import with templates, quality audit, diagram audit, DSKP source lookups, AI-explanation **stub**.

## Inputs (read these)

- `docs/requirements/v2-question-bank.md` (4.1 lifecycle, review stories and ACs), `docs/requirements/v2-exam-schema.md` D12
- `docs/requirements/srs/M04-question-bank.md`
- Mock: `src/modules/m04-question-bank/mock/handlers/{workflow,workflow-common,reports,submissions,imports,quality,diagram-audit,dskp,dskp-source,master-notes,ai-explanation,structured}.ts`; client `src/modules/m04-question-bank/api/*`
- BE-09 outputs

## Outputs

- Contract: `packages/contract/src/question-workflow/**`
- `apps/api/prisma/schema/question-workflow.prisma` + migration: `question_reports`, `question_submissions`, `question_imports`, `question_status_events`, `source_papers` (provenance, rights declaration), `quality_audits`
- `apps/api/src/modules/question-workflow/**`
- Tests under `apps/api/test/question-workflow/**`

## Endpoints (paths from the mock)

| Method and path | Notes |
|---|---|
| `POST /api/question-reports`, `GET /api/question-reports`, `GET /api/question-reports/mine`, `PATCH /api/question-reports/:id` | student reports; admin resolution; resolving as "wrong" calls `QuestionsRepository.deactivate` (practice eligibility updates) |
| `GET /api/question-submissions` | teacher submissions queue |
| `GET /api/question-imports`, `POST /api/question-imports`, `GET /api/question-imports/template` | CSV import with per-row report; import creates `draft` questions |
| `GET /api/question-quality`, `POST /api/question-quality/audit`, `GET /api/diagram-audit`, `POST /api/diagram-audit/:kind/:id/image` | quality tools |
| `POST /api/guru/questions/import`, `GET /api/guru/questions/template` | Guru CSV contribution (same import service) |
| `GET /api/guru/dskp/bidang`, `GET /api/guru/dskp/sk`, `GET /api/guru/dskp/sp` | DSKP lookups for question tagging |
| `GET /api/master-notes` | notes lookup |
| `POST /api/questions/:id/ai-explanation` | **stub** returning the mock's deterministic explanation or a clear "not available" error; no external call (OD-7) |

## DB tables touched

`question_reports`, `question_submissions`, `question_imports`, `question_status_events`, `source_papers`, `quality_audits`, `questions`, `files` (diagram image).

## Acceptance criteria

1. Allowed transitions are exactly those of `v2-question-bank.md` 4.1 / D12; any other transition returns 409 `CONFLICT`; each transition writes a status event with actor and time.
2. Guru can move own draft to Semakan; only `admin` can Lulus/Terbit/Diarkib (403 otherwise); Admin Sekolah has no access (403).
3. Reporting a question requires a signed-in student; duplicate open report by the same user for the same question is handled as the mock does.
4. Resolving a report with deactivation removes the question from `eligibleForPractice` (cross-card integration test with BE-09).
5. CSV import: header validation, row limit, per-row error list, nothing partial is published; template download matches the mock columns.
6. A takedown action exists at source level (`source_papers`): removing a source marks all its questions `archived` (D40c mitigation).
7. The AI explanation endpoint never calls the network and is clearly marked stub in the response/docs.

## Test commands

```
npm run be:test -- apps/api/test/question-workflow
npm run be:verify
```

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-10 (question-workflow). Work in this repo clone on branch be/BE-10-question-workflow, created from the latest origin/feature/v2-backend.
Read first, in order: AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10); docs/plan/backend-tasks/BE-10-question-workflow.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs.
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-10 on top of BE-09. Port workflow/reports/submissions/imports/quality behaviour from the m04 mock handlers and the lifecycle of docs/requirements/v2-question-bank.md 4.1. Admin Pusat alone approves and publishes (D40a). AI explanation must remain a stub (OD-7). Record every ambiguity in the PR instead of choosing silently.
```
