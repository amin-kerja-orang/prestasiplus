# BE-10 Question workflow: reports, imports, quality, DSKP source

| Field | Value |
|---|---|
| Size | M |
| Lane | PC-5 (folders: sessions.md section 5) |
| Priority | P1 |
| Wave | 2 |
| Depends on | BE-09 |
| Parallel with | BE-12, BE-15, BE-17 |
| Owner module | M04 |

## Goal

The review lifecycle and the supporting M04 features: Draf, Semakan, Lulus, Terbit, Diarkib transitions with audit, Guru verification of own uploads, Admin Pusat approval/publication, student question reports, CSV import with templates, quality audit, diagram audit, DSKP source lookups, AI-explanation **stub**.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/requirements/v2-question-bank.md` (4.1 lifecycle and transition table, 4.7 reports, 4.8 quality gates, review stories and ACs), `docs/requirements/v2-exam-schema.md` D12
- `docs/requirements/srs/M04-question-bank.md` (BR-M04-11 to BR-M04-16 reports, BR-M04-21/22 quality, BR-M04-23 master notes, BR-M04-24 AI explanation, BR-M04-25 DSKP)
- Mock: `src/modules/m04-question-bank/mock/handlers/{workflow,workflow-common,reports,submissions,imports,quality,diagram-audit,dskp,dskp-source,master-notes,ai-explanation,structured}.ts`, `src/modules/m04-question-bank/mock/import/csv.ts` (import messages), `src/modules/m10-teacher-class/mock/handlers/{questions,csv}.ts` (Guru import/template); client `src/modules/m04-question-bank/api/*`; mock tests `src/modules/m04-question-bank/__tests__/mock/**`
- BE-09 outputs (`QuestionsService.setStatus`, tables)
- Requirements: BE-FR-12, BE-FR-35, BE-FR-36; BE-NFR-08, BE-NFR-38 ([URS 9.2](../../requirements/v2-backend-urs.md))
- API catalogue part B2 (learning, question bank, exam): [learning-exam.md](../../architecture/v2-api-catalogue/learning-exam.md) (endpoint list, wire conventions and open questions for this card's scope)
- Data model: [v2-data-model.md](../../architecture/v2-data-model.md) (tables, keys and indexes of this card; being written 2026-10-19)

## Outputs

- Contract: `packages/contract/src/question-workflow/**` (a new contract folder for lane PC-5; add it to the lane list in `sessions.md` section 5 in the same PR via the lead)
- `apps/api/prisma/schema/questions-workflow.prisma` + migration: `question_reports`, `question_imports`, `question_status_events`, `source_papers` (provenance, rights declaration, `natural_key`, `content_hash` for the BE-30 backfill), `quality_audits`
- `apps/api/src/modules/questions/workflow/**` (lane PC-5; code and tables are separate from PC-2's `questions/` and `questions.prisma`, so this card never edits them; it calls `QuestionsService.setStatus` from BE-09)
- Tests under `apps/api/test/questions-workflow/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/modules/questions/workflow/**`.
- Prisma file(s): `apps/api/prisma/schema/questions-workflow.prisma` and one migration folder under `apps/api/prisma/migrations/`.
- Contract: `packages/contract/src/question-workflow/**` (new files only), registered in `src/openapi.ts`; `openapi.json` is regenerated with `npm run contract:emit`, never hand-edited.
- Seeds: none.
- Tests: `apps/api/test/questions-workflow/**`, and (after BE-31) new scenario files in `apps/api/test/conformance/questions-workflow/`.
- Append-only shared files (one line each, never reorder): `apps/api/src/modules/index.ts` (one import and one array entry); `apps/api/prisma/migratable-models.json` (model names, alphabetical); your own rows of the mapping matrix, plan section 14.7; `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: BE-10 and BE-38 are both PC-5 but use different Prisma files (questions-workflow.prisma, intake.prisma) and are ordered by Depends on (BE-38 needs BE-10).
- **Exception needing the lead's approval in the PR (outside the lane list):** the contract folder `question-workflow/` is not in the PC-5 list of sessions.md section 5; the lead adds it when merging this card (a one-word list change).

## Endpoints (paths from the mock)

Every route below exists in the mock (verified).

| Method and path | Notes |
|---|---|
| `POST /api/question-reports`, `GET /api/question-reports`, `GET /api/question-reports/mine`, `PATCH /api/question-reports/:id` | any signed-in user reports (mock `#15`); admin lists and resolves; a report that deactivates calls `QuestionsRepository.deactivate` |
| ~~`GET /api/question-submissions`~~, ~~`GET /api/question-submissions/:id/files/:index`~~, ~~`PATCH /api/question-submissions/:id/status`~~ | **Not ported here (D53/OWN-1).** There is one table for a question-paper submission: `intake_batches` (BE-37) is the Submission and `question_submissions` is dropped. Each mock route is served by intake: the queue list and detail by `GET /api/intake/batches` (BE-37); the file download by `GET /api/intake/files/:id/original` (BE-37); the teacher upload `POST /api/guru/question-papers` (listed in BE-18) by `POST /api/intake/batches` plus `.../files` (BE-37); the admin status/note change by the BE-37 cancel and BE-38 reject actions plus the batch note (BE-37 open question 3). `source_papers` stays the paper identity and rights registry that an intake batch points to (data model OWN-2). BE-10 adds no read endpoint over intake. |
| `GET /api/question-imports`, `POST /api/question-imports`, `GET /api/question-imports/template` | Excel/CSV import with per-row report; every valid row becomes a `draft` question |
| `GET /api/question-quality`, `POST /api/question-quality/audit` | quality dashboard and re-audit |
| `GET /api/diagram-audit`, `POST /api/diagram-audit/:kind/:id/image`, `POST /api/diagram-audit/:kind/:id/dismiss` | diagram audit tools |
| `POST /api/guru/questions/import`, `GET /api/guru/questions/template` | Guru CSV contribution (same import service) |
| `GET /api/guru/dskp/bidang`, `GET /api/guru/dskp/sk`, `GET /api/guru/dskp/sp` | DSKP lookups for the teacher's picking list (the POSTs are BE-18). Questions are tagged with `curriculum_node` only (D53(h), v2-exam-schema D9); `dskp_*` rows are never a question tag |
| `GET /api/master-notes`, `POST /api/master-notes/:id/:action` | notes lookup and the approve / unflag / regen actions (SRS BR-M04-23) |
| `POST /api/questions/:id/ai-explanation` | **stub** (see criterion 8) |

The status-transition endpoint: the mock changes status through `POST /api/questions/bulk-action` and `PUT /api/questions/:id` (BE-09 routes). This card owns the transition table behind them (BE-09's controller calls the workflow service).

## DB tables touched

`question_reports`, `question_imports`, `question_status_events`, `source_papers`, `quality_audits`, `questions`, `files` (diagram image).

## Acceptance criteria

1. Allowed transitions are exactly the table of `v2-question-bank.md` 4.1: Draf to Semakan (Guru own, Admin Pusat; submit gate 4.8), Draf to Diarkib, Semakan to Lulus (Admin Pusat), Semakan to Draf (reason mandatory), Lulus to Terbit (publish gate), Lulus to Draf (reason mandatory), Terbit to Diarkib (reason mandatory), Terbit to new version n+1 as Draf, Diarkib to Draf. Every other pair returns 409 `CONFLICT`. A table-driven test walks all 5x5 pairs per role. Each transition writes a `question_status_events` row with actor, role, time, from, to and reason.
2. Guru can move an own draft to Semakan; only `admin` can do the other transitions (403 otherwise); Admin Sekolah has no access to any route of this card (403); a Guru acting on another Guru's question gets 404.
3. Reports (mock `reports.ts`): body validation returns 422 with the mock's field messages: "Sila pilih sekurang-kurangnya satu sebab laporan.", "Sebab laporan tidak sah.", "Sumber laporan tidak sah.", "Jenis soalan tidak sah.", "Sila pilih soalan.", "Rujukan sesi atau bilik tidak sah.", "Komen tidak boleh melebihi 500 aksara."; update validation "Status tidak sah." and "Nota admin tidak boleh melebihi 1000 aksara."; success flash "Laporan berjaya dikemaskini."; reasons per question type and displayed statuses (Menunggu, Disemak, Diperbaiki, Ditolak, Dikeluarkan) as SRS BR-M04-14/15. Duplicate open report by the same user for the same question: replay the case in the mock test and assert the same status.
4. Resolving or filing a report that deactivates a question removes it from `eligibleForPractice` immediately (integration test with BE-09). Which reports deactivate is Open question 2.
5. CSV import: header validation, row limit and size limit equal the mock constants in `src/modules/m04-question-bank/mock/import/csv.ts` and `src/modules/m10-teacher-class/mock/handlers/csv.ts`; row error messages are the mock's (for example "Baris tidak lengkap.", "Jawapan betul mesti A, B, C atau D.", "Subjek tidak sah.", "Tahap kesukaran mesti 1 hingga 5.", "Markah mesti nombor bulat sekurang-kurangnya 1."); valid rows import and invalid rows are reported with the row number; nothing partial is published; the template download header row equals the mock template; cells starting with `=`, `+`, `-`, `@` are neutralised in any generated CSV.
6. A takedown at source level (`source_papers`): removing a source marks all its questions `archived` through `setStatus`, with a status event per question (D40c mitigation).
7. Quality audit (`POST /api/question-quality/audit`) scores only questions created at runtime in the mock; in v2 it scores every question and stores `quality_audits` rows. The score bands are SRS BR-M04-21 (Cemerlang 76 to 100, Baik 51 to 75, Lemah 26 to 50, Kritikal 0 to 25). The scoring function itself is the mock's `score(q)` (SRS 6.12); copy it, do not invent a new one.
8. The AI explanation endpoint never calls the network. It returns the mock's deterministic explanation (without `force` an existing one is returned unchanged, with `force` it is replaced; SRS BR-M04-24) and the response and the OpenAPI description say it is a stub (OD-7).
9. Roles: no session 401; missing CSRF 403 `CSRF_INVALID`; the student-facing report routes (`POST /api/question-reports`, `GET /api/question-reports/mine`) accept any signed-in user; all other routes need the role stated above.
10. Versioning (BE-FR-35, `v2-question-bank.md` 4.6): publishing version n+1 archives version n as `Diarkib (digantikan)` in the same transaction, so there is never a moment with zero live version unless an admin withdraws (test: a forced failure after the archive step leaves n live); practice and Bijak answer rows keep the question id and version served, so history is unchanged after an edit (cross-card test with BE-12). (added 2026-10-19)
11. Report fix loop (BE-FR-36, `v2-question-bank.md` 4.7): a report carries the question and its version; the reporter is notified (`NotificationsService`) on every status change; the status becomes Diperbaiki when the linked fixing version is Terbit; a comment of 501 characters is rejected 422. Create, list, mine and patch are tested per role. (added 2026-10-19)
12. Quality gates of `v2-question-bank.md` 4.8 are enforced by name: "Submit for review", "Approve" (reviewer is not the AI service, tags valid, marks total equals part marks), "Publish" and "No bypass" (the same gate applies to single, paper-level and bulk actions; a bulk action reports a failing question and skips it). One test per gate for its failing rule. (added 2026-10-19)

## Test commands

```
npm run be:test -- apps/api/test/question-workflow
npm run be:verify
npm run contract:check
npm run be:test -- apps/api/test/conformance   # only after BE-31 is merged
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green; if anything under `packages/**` changed, root `npm run typecheck && npm test` is green too. Paste the real tail of the output in the PR.
3. Conformance (BE-31): once BE-31 is merged, add this card's scenarios as new files in `apps/api/test/conformance/questions-workflow/` and run `npm run be:test -- apps/api/test/conformance`; a failure is a blocker. Before BE-31 merges, `be:verify` is the gate; write "conformance scenarios pending BE-31" in the PR.
4. Migration-first checklist of plan section 14.9 (items 1 to 6) is complete for every table this card creates. Item 6 (insert a `legacy_source = 'cloud'` row twice through the BE-34 upsert helper and assert one row) applies once BE-34 is merged; state in the PR whether it was available.
5. No security review is required; list any security-relevant decision in the PR anyway.
6. The card's tracker row is updated (status, PR number, one-line note) and the PR description follows the template in `docs/plan/backend-tasks/README.md`. Nothing stays only on your PC (AGENT-SYNC.md section 4).

## Migration-first (plan sections 14 and 14.9)

- Follow the checklist of plan section 14.9 (items 1 to 6) for every table listed under "DB tables touched".
- Each table that could receive .cloud rows has `legacy_source text null`, `legacy_id text null` and `unique (legacy_source, legacy_id)`, and is listed in `apps/api/prisma/migratable-models.json`. These columns never appear in the contract or in an API response.
- Enums are `text` + `check` with English codes (no Postgres enum types); anything the source may lack is nullable or has a documented default; seeds never set `legacy_*` and are idempotent.
- Add or update this entity's row in the mapping matrix (plan section 14.7) in the same PR.

## Open questions

Do not guess these; write your working assumption in the PR and ask the lead (issue labelled `question`) if it blocks you.

1. The mock reports deactivate an MCQ at the first report and a structured question at the third (SRS BR-M04-12); `v2-question-bank.md` Q7 says v2 unifies this. Which rule does the API implement? Working assumption: the mock's rule until Q7 is answered.
2. The mock's status values differ from the v2 lifecycle; see BE-09 open question 1. The transition table above uses the v2 statuses.
3. `source_papers` columns `natural_key` and `content_hash` are required by BE-30; confirm their definition (plan 14.7) before the migration.
4. Pending LEAD decision: OQ-22 of the URS (auto-hide threshold for reported questions; URS default: pending review after 3 reports from different students, Admin Pusat can hide at once; this is the same question as item 1) and OQ-25 (CSV as the mock versus the Excel template of v2-question-bank 4.3). Build the mock behaviour until answered. (added 2026-10-19)

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-10 (question-workflow). Work in this repo clone on branch be/BE-10-question-workflow, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-10-question-workflow.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-10 on top of BE-09 (lane PC-5: module apps/api/src/modules/questions/workflow/**, schema questions-workflow.prisma; PDF and AI imports belong to BE-38, so create no PDF/OCR question_imports pipeline; keep Excel import, lifecycle, reports and quality gates here). Port workflow/reports/submissions/imports/quality behaviour from the m04 mock handlers and the lifecycle of docs/requirements/v2-question-bank.md 4.1. Admin Pusat alone approves and publishes (D40a). AI explanation must remain a stub (OD-7). Record every ambiguity in the PR instead of choosing silently.
```
