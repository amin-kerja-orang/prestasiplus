# BE-37 Intake files, page images, figure crops, server OCR and job runner

| Field | Value |
|---|---|
| Size | L |
| Wave | 2 (starts after BE-04) |
| Depends on | BE-04 (and BE-03) |
| Parallel with | BE-36, BE-08, BE-09, BE-05 |
| Owner module | intake (new; files and processing side) |
| Security review | required (file upload, untrusted PDF parsing) |

## Goal

(D52) The server-side half of "upload a paper": accept PDFs (and the other formats the lead lists, OD-20), store the originals, render page images, run OCR for large or scanned uploads, crop figures, and run all of it as durable background jobs. Uses **pdfjs-dist** for text PDFs and **tesseract.js** for scans, the same libraries as the frontend prototype.

## Inputs (read these)

- `docs/architecture/v2-backend-plan.md` section 15 (15.2 OCR, Storage, Jobs rows; 15.3 config), section 3 (Jobs, Files)
- `docs/requirements/v2-question-bank.md` flow 4.2 (declaration, several files per submission, 20 MB default), AC around Submission status, NFR-01 (accuracy targets), NFR-04 (privacy)
- `docs/requirements/v2-exam-schema.md` section 9 (sample PDFs: digital-born versus scans)
- BE-04 outputs (`FileStorage`, `files`, upload pipeline)
- The frontend intake code that does OCR in the browser today (paths from the lead) so the server output has the same block/region shape the review UI expects

## Outputs

- Contract: `packages/contract/src/intake/files.ts` (submission declaration, file status, page list, region/block shape, figure crop reference)
- `apps/api/prisma/schema/intake.prisma` + migration (first part; BE-38 adds the item/workflow tables in the same file after this merges): `intake_batches` (declaration fields, status, owner), `intake_files` (storage key, sha256, pages, status), `intake_pages` (page no, image key, thumb key, text layer present, OCR status), `intake_figures` (page, bbox, crop key, alt-text suggestion), `jobs` (platform job table: type, payload ref, state, attempts, run_after, idempotency key, error code)
- `apps/api/src/modules/jobs/**`: DB-backed job runner (`FOR UPDATE SKIP LOCKED`, tick via `@nestjs/schedule`, retry/backoff, cancel, stuck-job sweeper, graceful shutdown)
- `apps/api/src/modules/ocr/**`: text-layer extraction with pdfjs-dist (no scripts, no eval), page rendering, scanned-page detection (text density threshold, configurable), tesseract.js worker pool (`OCR_WORKERS`, `OCR_PAGE_TIMEOUT_MS`, `OCR_MAX_PAGES`) with `msa` and `eng`, output text blocks with bboxes and confidences
- `apps/api/src/modules/intake/files/**`: upload endpoint, magic-byte and size validation, hash de-duplication, page/figure services, authenticated image serving with scope checks
- Tests under `apps/api/test/intake-files/**` using small **generated** PDFs (one digital-born, one scan-like image PDF) created in the test, no real papers committed

## Endpoints (relative to `/api`; Guru for own batches, Admin Pusat for all; final paths from the contract commit)

| Method and path (indicative) | Notes |
|---|---|
| `POST /intake/batches` | create a batch with the declaration (paper type, subject, level, year, source declaration, notes) |
| `POST /intake/batches/:id/files` | multipart upload of one or more files (size/page limits); returns file ids |
| `GET /intake/batches/:id`, `GET /intake/batches` | status Dihantar / Sedang diproses / Sedia untuk semakan / Gagal, per-file progress |
| `GET /intake/files/:id/pages/:n/image`, `.../thumb` | authenticated, scope-checked image serving |
| `GET /intake/figures/:id/image` | figure crop |
| `POST /intake/batches/:id/cancel` | cancel pending jobs |

## DB tables touched

New: `intake_batches`, `intake_files`, `intake_pages`, `intake_figures`, `jobs`. Writes files through `FileStorage`.

## Acceptance criteria

1. A digital-born test PDF yields page text and blocks without running OCR; an image-only PDF triggers rendering and tesseract; both end with identical output shape.
2. A batch survives an API restart: jobs resume, none run twice (idempotency key), statuses follow the Dihantar -> Sedang diproses -> Sedia untuk semakan | Gagal model.
3. Validation: wrong magic bytes, oversize (`INTAKE_MAX_FILE_MB`), over `OCR_MAX_PAGES`, encrypted/corrupt PDF, and a zip/PDF bomb sample are rejected with BM messages and 4xx, never crash the worker; a page timeout marks only that page failed.
4. A file with the same sha256 already imported in a finished batch is flagged before processing (feeds AC-06.4).
5. Images are only served to the owner Guru or Admin Pusat (others get 404); no public URL; no storage path leaks in responses.
6. Concurrency bounded (`OCR_WORKERS`); memory stays under a documented ceiling on a 50-page fixture; the worker never blocks the HTTP event loop (OCR runs in worker threads).
7. pdfjs runs with scripting disabled; a PDF containing JavaScript or external links does not execute or fetch anything (test).
8. Role checks: Murid 403; no session 401; no CSRF 403; out-of-scope id 404.

## Test commands

```
npm run be:test -- apps/api/test/intake-files
npm run contract:check
npm run be:verify
```

## Migration-first (plan section 14)

- No .cloud data lands here (the .cloud pipeline tables are archived, not migrated), so these tables are **not** in `migratable-models.json`. State that in the PR. The shared `jobs` table must not carry migration state.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-37 (intake-files-ocr). Work in this repo clone on branch be/BE-37-intake-files-ocr, created from the latest origin/feature/v2-backend.
Read first, in order: AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 15); docs/plan/backend-tasks/BE-37-intake-files-ocr.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/intake/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend intake code (paths from the lead) and docs/requirements/v2-question-bank.md are the behavioural spec: do not invent business rules; unknowns go under "Open questions" in the PR. Never commit secrets, real papers or real personal names; generate test PDFs inside the tests. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders. Keep the diff inside the card Outputs. Use BE-04 FileStorage; do not write files to disk any other way.
Task: implement BE-37: batches and file upload, DB-backed job runner, pdfjs-dist text extraction, page rendering, tesseract.js OCR in a bounded worker pool, figure crops, authenticated image serving. Needs a security review.
When finished run npm run be:verify and report: files changed, endpoints, tables, real test output, deviations, open questions. Update docs/plan/backend-tracker.md (your card row) in the same PR.
```
