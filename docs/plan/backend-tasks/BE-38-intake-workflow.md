# BE-38 Intake batches, extraction orchestration, review workflow, accept-to-Draf, duplicates

| Field | Value |
|---|---|
| Size | L |
| Wave | 3 |
| Depends on | BE-09, BE-10, BE-36, BE-37 |
| Parallel with | BE-39, BE-12, BE-16, BE-17 |
| Owner module | intake (workflow side); questions stay owned by M04 |
| Security review | required (AI egress, uploads, role-based approval) |

## Goal

(D52) Connect upload, OCR and the AI service to the question bank: an extraction job turns a batch into reviewable **items**; reviewers edit, accept (creating a Draf question through the M04 owner service), reject or mark duplicates; the existing BE-10 lifecycle then carries Draf -> Semakan -> Lulus -> Terbit. The AI never approves.

## Inputs (read these)

- `docs/architecture/v2-backend-plan.md` section 15 (Workflow, Duplicates, Jobs rows)
- `docs/requirements/v2-question-bank.md`: 4.1 (status model), 4.2 (upload), 4.5 (review queue), 4.8 (quality gates); US-04 to US-10 and their ACs; US-16 (provenance); US-29 context
- `docs/requirements/v2-exam-schema.md`: D1 to D12 (types, keys, mark-scheme points, stimulus groups, tags, duplicates D11, lifecycle D12)
- BE-09 (`QuestionsService`, tables), BE-10 (lifecycle, quality gates, audit), BE-36 (extraction contract), BE-37 (batches, pages, figures, jobs)
- The frontend review/queue screens and mock handlers (paths from the lead, OD-20): the item shape, filters and actions

## Outputs

- Contract: `packages/contract/src/intake/{items,review}.ts` (item with fields + confidence + region + suggested tags + duplicate flags; review actions; queue filters; list meta)
- Prisma (append to `intake.prisma` after BE-37 merged): `intake_items` (batch/file/page/region, number label, extracted payload jsonb validated against the question schema, per-field confidence, review state `generated | needs_review | accepted | rejected | duplicate`, reject reason, accepted question id + version, run id), `intake_item_events` (who/when/what, previous AI text kept per AC-08.2), `duplicate_links`
- `apps/api/src/modules/intake/workflow/**`: extraction job handler (reads pages/blocks, calls the BE-36 provider with redaction, maps output to items, runs duplicate check, sets batch status), review service (edit field, accept, reject with reason, mark duplicate, bulk accept above a confidence threshold only for Admin Pusat), accept-to-Draf via `QuestionsService` with provenance (source paper, file, page, region, number label, `source_type`, run id, model), submit-for-review hooks into BE-10
- Budget behaviour: when BE-36 reports the budget exhausted the batch stays queued with status Dihantar and a visible reason; resumes when the cap is raised
- Tests under `apps/api/test/intake-workflow/**` using the mock provider

## Endpoints (relative to `/api`; final paths from the contract commit)

| Method and path (indicative) | Notes |
|---|---|
| `POST /intake/batches/:id/extract` | enqueue extraction (idempotent; blocked for an already-imported file hash before any cost) |
| `GET /intake/items`, `GET /intake/items/:id` | review queue: filters by status, batch, subject, uploader, confidence band, duplicate flag; Guru sees own, Admin Pusat all |
| `PATCH /intake/items/:id` | edit extracted fields (marks the field "Disunting oleh manusia", keeps AI text in history) |
| `POST /intake/items/:id/accept`, `.../reject`, `.../duplicate` | accept creates Draf question; reject needs a reason; duplicate links to the matching question |
| `POST /intake/items/bulk` | bulk accept/reject with rules above |

Submit/approve/publish of the resulting questions use the BE-10 endpoints; do not duplicate them here.

## DB tables touched

New: `intake_items`, `intake_item_events`, `duplicate_links`. Writes questions only through `QuestionsService`.

## Acceptance criteria

1. End to end with the mock provider: upload (BE-37) -> extract -> items appear with confidence and region -> accept -> a Draf question exists with provenance; the item stores the question id and version.
2. The AI service/adapters cannot set any state beyond `generated`/`needs_review` and cannot call accept; only an authenticated human reviewer can (test through the service API).
3. Roles per D40a: Guru reviews only own batches and can move own Draf to Semakan; only Admin Pusat approves/publishes; Admin Sekolah and PPD have no access (403); out-of-scope id 404.
4. Quality gates of BE-10 are enforced on accept/submit (tags valid against the taxonomy, marks total equals sum of part marks, figure references resolve to stored crops).
5. Duplicate check flags exact and variant duplicates against existing bank questions and across the batch, with the matching id; re-extracting the same file hash is refused before any provider call.
6. Editing keeps the previous AI text in `intake_item_events`; every transition is audit-logged (who, when, from, to, reason).
7. Provider failure or budget exhaustion leaves the batch recoverable (status and reason visible, retry works, no duplicate items after retry).
8. No student, teacher or school identifier is stored in the extracted payload or sent to the provider (reuses BE-36 redaction; test with a planted cover page).

## Test commands

```
npm run be:test -- apps/api/test/intake-workflow
npm run contract:check
npm run be:verify
```

## Migration-first (plan section 14)

- Not migrated from .cloud (pipeline tables are archived). Provenance fields on questions follow the BE-09 mapping rows (`source_papers.natural_key`, `content_hash`) so the optional post-reload backfill (BE-30) can match later; do not drop them.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-38 (intake-workflow). Work in this repo clone on branch be/BE-38-intake-workflow, created from the latest origin/feature/v2-backend.
Read first, in order: AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14, 15); docs/requirements/v2-question-bank.md; docs/plan/backend-tasks/BE-38-intake-workflow.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/intake/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend review screens and mock (paths from the lead) are the behavioural spec: do not invent business rules; unknowns go under "Open questions" in the PR. Questions are owned by M04: create and change them only through QuestionsService from BE-09/BE-10, never their tables. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders. Keep the diff inside the card Outputs (the workflow code lives under apps/api/src/modules/intake/workflow/**).
Task: implement BE-38: extraction orchestration job, intake items and review actions, accept-to-Draf with provenance, duplicate detection, budget-aware recovery. Needs a security review.
When finished run npm run be:verify and report: files changed, endpoints, tables, real test output, deviations, open questions. Update docs/plan/backend-tracker.md (your card row) in the same PR.
```
