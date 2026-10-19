# BE-37 Intake files, page images, figure crops, server OCR and job runner

| Field | Value |
|---|---|
| Size | L |
| Lane | PC-5 (folders: sessions.md section 5) |
| Priority | P1 |
| Wave | 2 (starts after BE-04) |
| Depends on | BE-04 |
| Parallel with | BE-36, BE-08, BE-09, BE-05 |
| Owner module | intake (new; files and processing side) |
| Security review | required (file upload, untrusted PDF parsing) |

## Goal

(D52) The server-side half of "upload a paper": accept PDFs (and the other formats the lead lists, OD-20), store the originals, render page images, run OCR for large or scanned uploads, crop figures, and run all of it as durable background jobs. Uses **pdfjs-dist** for text PDFs and **tesseract.js** for scans, the same libraries as the frontend prototype.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/architecture/v2-backend-plan.md` section 15 (15.2 OCR, Storage, Jobs rows; 15.3 config), section 3 (Jobs, Files)
- `docs/requirements/v2-question-bank.md` flow 4.2 (declaration, several files per submission, 20 MB default), AC around Submission status, NFR-01 (accuracy targets), NFR-04 (privacy)
- `docs/requirements/v2-exam-schema.md` section 9 (sample PDFs: digital-born versus scans)
- BE-04 outputs (`FileStorage`, `files`, upload pipeline, derived-file limit)
- The frontend intake code that OCRs in the browser today, so the server output has the shape the review UI expects: `src/modules/m28-bijak-spm/admin/intake/lib/{ocr,page-images,sample-paper,seed,intake-routes}.ts`, `src/modules/m28-bijak-spm/admin/intake/types.ts` (`PageText`, `PageImage`, `IntakeMeta` with `PAPER_TYPES` and `COPYRIGHT_OPTIONS`, `IntakeBatch`), and the mock store methods `listIntakeBatches`, `getIntakeBatch`, `createIntakeBatch` in `src/modules/m28-bijak-spm/server/store.ts`
- Requirements: BE-FR-22; BE-NFR-14, BE-NFR-15, BE-NFR-18, BE-NFR-21, BE-NFR-29, BE-NFR-30; BE-OPS-03 ([URS 9.2](../../requirements/v2-backend-urs.md))
- API catalogue part B2 (learning, question bank, exam): [learning-exam.md](../../architecture/v2-api-catalogue/learning-exam.md) (endpoint list, wire conventions and open questions for this card's scope)
- Data model: [v2-data-model.md](../../architecture/v2-data-model.md) (tables, keys and indexes of this card; being written 2026-10-19)

## Outputs

- Contract: `packages/contract/src/intake/files.ts` (submission declaration, file status, page list, region/block shape, figure crop reference)
- `apps/api/prisma/schema/intake.prisma` + migration (first part; BE-38 appends the item/workflow tables to the same file after this merges): `intake_batches` (declaration fields, status, owner), `intake_files` (storage key, sha256, pages, status), `intake_pages` (page no, image key, thumb key, text layer present, OCR status), `intake_figures` (page, bbox, crop key, alt-text suggestion), `jobs` (platform job table: type, payload ref, state, attempts, run_after, idempotency key, error code)
- `apps/api/src/modules/jobs/**`: DB-backed job runner (`FOR UPDATE SKIP LOCKED`, tick via `@nestjs/schedule`, retry/backoff, cancel, stuck-job sweeper, graceful shutdown)
- `apps/api/src/modules/ocr/**`: text-layer extraction with pdfjs-dist (no scripts, no eval), page rendering, scanned-page detection (text density threshold, configurable), tesseract.js worker pool (`OCR_WORKERS`, `OCR_PAGE_TIMEOUT_MS`, `OCR_MAX_PAGES`) with `msa` and `eng`, output text blocks with bboxes and confidences
- `apps/api/src/modules/intake/files/**`: upload endpoint, magic-byte and size validation, hash de-duplication, page/figure services, authenticated image serving with scope checks
- Tests under `apps/api/test/intake-files/**` using small **generated** PDFs (one digital-born, one scan-like image PDF) created in the test, no real papers committed

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/modules/jobs/**`, `apps/api/src/modules/ocr/**`, `apps/api/src/modules/intake/files/**`.
- Prisma file(s): `apps/api/prisma/schema/intake.prisma` and one migration folder under `apps/api/prisma/migrations/`.
- Contract: `packages/contract/src/intake/files.ts` (new files only), registered in `src/openapi.ts`; `openapi.json` is regenerated with `npm run contract:emit`, never hand-edited.
- Seeds: none.
- Tests: `apps/api/test/intake-files/**`, and (after BE-31) new scenario files in `apps/api/test/conformance/intake/`.
- Other files: `.env.api.example` (PC-5 block only).
- Append-only shared files (one line each, never reorder): `apps/api/src/modules/index.ts` (one import and one array entry); `apps/api/prisma/migratable-models.json` (model names, alphabetical); your own rows of the mapping matrix, plan section 14.7; `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: intake.prisma is shared with BE-38 and BE-40 (BE-38 depends on BE-37, BE-40 on BE-38). BE-37 runs in parallel with BE-36 (ai.prisma) and BE-10.

**D53/OWN-1 (owner decision, 2026-10-19):** `intake_batches` IS the question-paper Submission. There is no separate `question_submissions` table (dropped from BE-10); the mock routes `GET /api/question-submissions*`, `PATCH /api/question-submissions/:id/status` and `POST /api/guru/question-papers` are served by the batch endpoints below. `source_papers` (BE-10) stays the paper identity and rights registry; BE-38 adds the nullable `intake_batches.source_paper_id` pointer once BE-10 has merged.

Frontend routes of the D52 admin flow (merged locally, pending push): upload `/admin/spm/soalan/muat-naik`, intake list `/admin/spm/soalan/ekstrak`, review `/admin/spm/soalan/ekstrak/:batchId`, bank `/admin/spm/soalan`, review queue `/admin/spm/semakan`, papers `/admin/spm/kertas`. These are UI routes, not API paths.

## Endpoints (new; Guru for own batches, Admin Pusat for all; no mock route exists; paths fixed in this card's contract PR)

| Method and path | Notes |
|---|---|
| `POST /api/intake/batches` | create a batch with the declaration (paper type, subject, level, year, source declaration, notes) |
| `POST /api/intake/batches/:id/files` | multipart upload of one or more files (size and page limits); returns file ids |
| `GET /api/intake/batches`, `GET /api/intake/batches/:id` | status Dihantar / Sedang diproses / Sedia untuk semakan / Gagal, per-file progress |
| `GET /api/intake/files/:id/pages/:n/image`, `GET /api/intake/files/:id/pages/:n/thumb` | authenticated, scope-checked image serving |
| `GET /api/intake/figures/:id/image` | figure crop |
| `GET /api/intake/files/:id/original` | download of the stored original (replaces mock `GET /api/question-submissions/:id/files/:index`): owner Guru or Admin Pusat, `Content-Disposition: attachment`, stored `Content-Type`, `nosniff`; others 404 |
| `POST /api/intake/batches/:id/cancel` | cancel pending jobs |

The browser mock tracks a batch as `draf` / `semakan` only (review state, BE-38); the processing statuses above are new (D52).

## DB tables touched

New: `intake_batches`, `intake_files`, `intake_pages`, `intake_figures`, `jobs`. Writes files through `FileStorage`.

## Acceptance criteria

1. A digital-born test PDF yields page text and blocks without running OCR; an image-only PDF triggers rendering and tesseract; both end with the same output shape (a shape test compares keys and types).
2. A batch survives an API restart: killing the process mid-batch and restarting resumes the jobs, none runs twice (idempotency key = file hash + stage), and the statuses follow Dihantar, Sedang diproses, then Sedia untuk semakan or Gagal.
3. Validation: wrong magic bytes, a file over `INTAKE_MAX_FILE_MB`, a page count over `OCR_MAX_PAGES`, an encrypted or corrupt PDF, and a zip/PDF bomb sample are each rejected with a 4xx and a BM message and never crash the worker; a page timeout (`OCR_PAGE_TIMEOUT_MS`) marks only that page failed. (The BM wording is new copy; list it in the PR, Open question 1.)
4. A file with the same sha256 as one already imported in a finished batch is flagged before any processing (feeds AC-06.4).
5. Images are served only to the owner Guru or Admin Pusat (others get 404); there is no public URL and no storage path in any response (recursive scan).
6. Concurrency is bounded by `OCR_WORKERS`; peak memory on a 50-page generated fixture is measured and written in the PR; the worker never blocks the HTTP event loop (OCR runs in worker threads; a test issues `GET /api/health` during OCR and gets an answer within 200 ms).
7. pdfjs runs with scripting disabled; a PDF containing JavaScript or external links executes and fetches nothing (test with a local HTTP listener that must receive zero requests).
8. Role checks: Murid 403; Admin Sekolah 403; no session 401; missing CSRF 403 `CSRF_INVALID`; an out-of-scope id gives 404.

## Test commands

```
npm run be:test -- apps/api/test/intake-files
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
- No .cloud data lands in these tables (the .cloud pipeline tables are archived, not migrated), so they are NOT listed in `migratable-models.json` and carry no `legacy_*` columns. State that in the PR. The shared `jobs` table must not carry migration state.

## Open questions

Do not guess these; write your working assumption in the PR and ask the lead (issue labelled `question`) if it blocks you.

1. BM wording for upload rejections (type, size, pages, encrypted, duplicate) is not in any spec. Working assumption: short new copy listed in the PR; the lead approves it.
2. Which input formats beyond PDF (OD-20 / Q10 of v2-question-bank)? Working assumption: PDF only in this card.
3. Submission statuses (D53/OWN-1): the mock Submission has `pending|processing|done|rejected` plus `adminNotes` (max 1000 characters, message "Nota admin tidak boleh melebihi 1000 aksara."); the batch has Dihantar / Sedang diproses / Sedia untuk semakan / Gagal. Working assumption: keep the batch statuses, add a nullable `admin_notes` column on `intake_batches` edited by Admin Pusat, and let the UI map the labels. Lead to confirm.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-37 (intake-files-ocr). Work in this repo clone on branch be/BE-37-intake-files-ocr, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/plan/sessions.md section 5 (folder ownership); docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 15); docs/plan/backend-tasks/BE-37-intake-files-ocr.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/intake/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend intake code (paths from the lead) and docs/requirements/v2-question-bank.md are the behavioural spec: do not invent business rules; unknowns go under "Open questions" in the PR. Never commit secrets, real papers or real personal names; generate test PDFs inside the tests. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders. Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md). Use BE-04 FileStorage; do not write files to disk any other way.
Task: implement BE-37: batches and file upload, DB-backed job runner, pdfjs-dist text extraction, page rendering, tesseract.js OCR in a bounded worker pool, figure crops, authenticated image serving. Needs a security review.
When finished run npm run be:verify and report: files changed, endpoints, tables, real test output, deviations, open questions. Update docs/plan/backend-tracker.md (your card row) in the same PR.
```
