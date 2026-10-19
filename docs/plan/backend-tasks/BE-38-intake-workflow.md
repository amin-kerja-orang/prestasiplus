# BE-38 Intake batches, extraction orchestration, review workflow, accept-to-Draf, duplicates

| Field | Value |
|---|---|
| Size | L |
| Lane | PC-5 (folders: sessions.md section 5) |
| Priority | P1 |
| Wave | 3 |
| Depends on | BE-09, BE-10, BE-36, BE-37 |
| Parallel with | BE-39, BE-12, BE-16, BE-17 |
| Owner module | intake (workflow side); questions stay owned by M04 |
| Security review | required (AI egress, uploads, role-based approval) |

## Goal

(D52) Connect upload, OCR and the AI service to the question bank: an extraction job turns a batch into reviewable **items**; reviewers edit, accept (creating a Draf question through the M04 owner service), reject or mark duplicates; the existing BE-10 lifecycle then carries Draf -> Semakan -> Lulus -> Terbit. The AI never approves.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/architecture/v2-backend-plan.md` section 15 (Workflow, Duplicates, Jobs rows)
- `docs/requirements/v2-question-bank.md`: 4.1 (status model), 4.2 (upload), 4.5 (review queue), 4.8 (quality gates); US-04 to US-10 and their ACs; US-16 (provenance); US-29 context
- `docs/requirements/v2-exam-schema.md`: D1 to D12 (types, keys, mark-scheme points, stimulus groups, tags, duplicates D11, lifecycle D12)
- BE-09 (`QuestionsService`, tables), BE-10 (lifecycle, quality gates, audit), BE-36 (extraction contract), BE-37 (batches, pages, figures, jobs)
- The frontend review/queue screens and mock handlers: `src/modules/m28-bijak-spm/admin/intake/pages/{IntakeListPage,IntakeReviewPage,IntakeUploadPage}.vue`, `admin/intake/components/{QuestionEditor,SchemeEditor}.vue`, `admin/intake/domain/{grouping,marks,validation}.ts`, `admin/intake/types.ts` (`IntakeQuestion`, `IntakeStimulus`, `lowFields`, `confirmed`, `needsManual`), the store methods `listIntakeBatches`, `getIntakeBatch`, `saveExtracted`, `submitForReview` in `src/modules/m28-bijak-spm/server/store.ts` (messages "Kumpulan ekstrak tidak ditemui", "Kumpulan sudah dihantar untuk semakan"), and `src/modules/m28-bijak-spm/__tests__/intake.test.ts`

## Outputs

- Contract: `packages/contract/src/intake/items.ts` and `packages/contract/src/intake/review.ts` (item with fields + confidence + region + suggested tags + duplicate flags; review actions; queue filters; list meta)
- Prisma (append to `intake.prisma` after BE-37 merged): `intake_items` (batch/file/page/region, number label, extracted payload jsonb validated against the question schema, per-field confidence, review state `generated | needs_review | accepted | rejected | duplicate` with BM labels Dijana, Perlu semakan, Diterima, Ditolak, Pendua, reject reason, accepted question id + version, run id), `intake_item_events` (who/when/what, previous AI text kept per AC-08.2), `duplicate_links`
- `apps/api/src/modules/intake/workflow/**`: extraction job handler (reads pages/blocks, calls the BE-36 provider with redaction, maps output to items, runs the duplicate check, sets batch status), review service (edit field, accept, reject with reason, mark duplicate, bulk accept above a confidence threshold only for Admin Pusat), accept-to-Draf via `QuestionsService` with provenance (source paper, file, page, region, number label, `source_type`, run id, model), submit-for-review hooks into BE-10
- Budget behaviour: when BE-36 reports the budget exhausted the batch stays queued with status Dihantar and a visible reason; it resumes when the cap is raised
- Tests under `apps/api/test/intake-workflow/**` using the mock provider

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/modules/intake/workflow/**`.
- Prisma file(s): `apps/api/prisma/schema/intake.prisma` and one migration folder under `apps/api/prisma/migrations/`.
- Contract: `packages/contract/src/intake/items.ts`, `packages/contract/src/intake/review.ts` (new files only), registered in `src/openapi.ts`; `openapi.json` is regenerated with `npm run contract:emit`, never hand-edited.
- Seeds: none.
- Tests: `apps/api/test/intake-workflow/**`, and (after BE-31) new scenario files in `apps/api/test/conformance/intake/`.
- Other files: `.env.api.example` (PC-5 block only).
- Append-only shared files (one line each, never reorder): `apps/api/src/modules/index.ts` (one import and one array entry); `apps/api/prisma/migratable-models.json` (model names, alphabetical); your own rows of the mapping matrix, plan section 14.7; `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: intake.prisma was last changed by BE-37 (BE-38 depends on it); BE-40 depends on BE-38. BE-38 runs in parallel with BE-39 (exam), BE-12, BE-16 and BE-17.

## Endpoints (new; Guru sees own, Admin Pusat all; no HTTP mock exists; paths fixed in this card's contract PR)

| Method and path | Notes |
|---|---|
| `POST /api/intake/batches/:id/extract` | enqueue extraction (idempotent; blocked for an already-imported file hash before any cost) |
| `GET /api/intake/items`, `GET /api/intake/items/:id` | review queue: filters by status, batch, subject, uploader, confidence band, duplicate flag |
| `PATCH /api/intake/items/:id` | edit extracted fields (marks the field "Disunting oleh manusia", keeps the AI text in history) |
| `POST /api/intake/items/:id/accept`, `POST /api/intake/items/:id/reject`, `POST /api/intake/items/:id/duplicate` | accept creates a Draf question; reject needs a reason; duplicate links to the matching question |
| `POST /api/intake/items/bulk` | bulk accept/reject with the rules above |

Submit, approve and publish of the resulting questions use the BE-10 endpoints; do not duplicate them here.

## DB tables touched

New: `intake_items`, `intake_item_events`, `duplicate_links`. Writes questions only through `QuestionsService`.

## Acceptance criteria

1. End to end with the mock provider (this is also a test named `intake-e2e`): upload (BE-37) -> extract -> items appear with confidence and region -> accept -> a Draf question exists with provenance; the item stores the question id and version.
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
npm run be:test -- apps/api/test/conformance   # only after BE-31 is merged
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green; if anything under `packages/**` changed, root `npm run typecheck && npm test` is green too. Paste the real tail of the output in the PR.
3. Conformance (BE-31): once BE-31 is merged, add this card's scenarios as new files in `apps/api/test/conformance/intake/` and run `npm run be:test -- apps/api/test/conformance`; a failure is a blocker. Before BE-31 merges, `be:verify` is the gate; write "conformance scenarios pending BE-31" in the PR.
4. Migration-first checklist of plan section 14.9 (items 1 to 6) is complete for every table this card creates. Item 6 (insert a `legacy_source = 'cloud'` row twice through the BE-34 upsert helper and assert one row) applies once BE-34 is merged; state in the PR whether it was available.
5. Label `security-review` on the PR; list the security decisions and the tests that prove them.
6. The card's tracker row is updated (status, PR number, one-line note) and the PR description follows the template in `docs/plan/backend-tasks/README.md`. Nothing stays only on your PC (AGENT-SYNC.md section 4).

## Migration-first (plan sections 14 and 14.9)

- Follow the checklist of plan section 14.9 (items 1 to 6) for every table listed under "DB tables touched".
- Each table that could receive .cloud rows has `legacy_source text null`, `legacy_id text null` and `unique (legacy_source, legacy_id)`, and is listed in `apps/api/prisma/migratable-models.json`. These columns never appear in the contract or in an API response.
- Enums are `text` + `check` with English codes (no Postgres enum types); anything the source may lack is nullable or has a documented default; seeds never set `legacy_*` and are idempotent.
- Add or update this entity's row in the mapping matrix (plan section 14.7) in the same PR.
- Not migrated from .cloud (pipeline tables are archived): these tables are NOT in `migratable-models.json` and have no `legacy_*` columns; state that in the PR. Provenance fields on questions follow the BE-09 and BE-10 mapping rows (`source_papers.natural_key`, `content_hash`) so the BE-30 backfill can match later; do not drop them.

## Open questions

Do not guess these; write your working assumption in the PR and ask the lead (issue labelled `question`) if it blocks you.

1. The browser mock saves a whole batch (`saveExtracted(id, payload)`) and submits the batch (`submitForReview`), while this card is item-based (`PATCH /api/intake/items/:id`, accept/reject). Working assumption: the contract PR defines the item-based API and the lead adapts the frontend client; the mock's batch statuses `draf` / `semakan` map to "batch has unreviewed items" / "all items reviewed".
2. The confidence threshold for bulk accept is not specified. Working assumption: configurable, default `High` band only (v2-question-bank NFR-01 calibration); confirm.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-38 (intake-workflow). Work in this repo clone on branch be/BE-38-intake-workflow, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/plan/sessions.md section 5 (folder ownership); docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14, 15); docs/requirements/v2-question-bank.md; docs/plan/backend-tasks/BE-38-intake-workflow.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/intake/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend review screens and mock (paths from the lead) are the behavioural spec: do not invent business rules; unknowns go under "Open questions" in the PR. Questions are owned by M04: create and change them only through QuestionsService from BE-09/BE-10, never their tables. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders. Keep the diff inside the card Outputs (the workflow code lives under apps/api/src/modules/intake/workflow/**).
Task: implement BE-38: extraction orchestration job, intake items and review actions, accept-to-Draf with provenance, duplicate detection, budget-aware recovery. Needs a security review.
When finished run npm run be:verify and report: files changed, endpoints, tables, real test output, deviations, open questions. Update docs/plan/backend-tracker.md (your card row) in the same PR.
```
