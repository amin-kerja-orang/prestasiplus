# BE-04 File storage service and upload handling

| Field | Value |
|---|---|
| Size | S |
| Lane | PC-1 (folders: sessions.md section 5) |
| Priority | P0 |
| Wave | 1 |
| Depends on | BE-03 |
| Parallel with | BE-05, BE-08, BE-11, BE-14 |
| Owner module | platform (used by M01, M04, M28, M09) |
| Security review | required (file uploads) |

## Goal

A `FileStorage` abstraction with a local-volume implementation, an authenticated upload and download pipeline with type/size limits, and the `files` table, so avatar, Bijak working photos, question images and CMS images share one safe path.

## Inputs (read these)

- `docs/architecture/v2-backend-plan.md` sections 3, 11, 13 (OD-6)
- `src/modules/m01-authentication/mock/handlers/auth-account.ts` (picture upload rules: size, types, messages)
- `src/modules/m28-bijak-spm/lib/photo-store.ts`, `src/modules/m28-bijak-spm/domain/types.ts` (`PhotoMeta`)
- `docs/requirements/v2-bijak-spm.md` (photo-of-working limits, search "photo")
- `docs/architecture/v2-data-migration.md` section 5 ("Files")

## Outputs

- `apps/api/src/modules/files/**`: `FileStorage` interface (`put`, `get`, `delete`, `exists`), `LocalDiskStorage` (root `FILE_STORAGE_DIR`), `FilesService`, `FilesController`
- `apps/api/prisma/schema/files.prisma` + migration: `files`
- Contract: `packages/contract/src/files/**` (`FileRef`, upload response)
- Tests under `apps/api/test/files/**`; compose volume `apifiles` for the `api` service

## Endpoints

| Method and path | Request | Response |
|---|---|---|
| `POST /api/files` | `multipart/form-data` field `file`, query `purpose` in (`avatar`, `bijak_photo`, `question_image`, `cms_image`) | 201 `{ data: FileRef { id, url, mime, size, purpose } }`; 413/422 with BM message |
| `GET /api/files/:id` | none | file bytes with correct `Content-Type`, `X-Content-Type-Options: nosniff`, private cache; owner or authorised role only (404 otherwise) |
| `DELETE /api/files/:id` | none | 204 for the owner |

Limits: MIME allow-list by magic bytes (not by filename), max size `MAX_UPLOAD_MB`, random storage names, no path traversal, images re-encoded or at least stripped of EXIF GPS (decide and note in PR).

## DB tables touched

`files` (id, owner_user_id, purpose, mime, size_bytes, sha256, storage_key, created_at, is_test).

## Acceptance criteria

1. Upload of a valid PNG/JPEG succeeds; a file renamed to `.png` but with other content is rejected 422; an oversize file is rejected 413 with the BM copy the mock uses.
2. A user cannot download another user's `bijak_photo` (404); `avatar` and `cms_image` visibility rules follow the mock (note the rule you chose in the PR if the mock is silent).
3. Storage keys never contain the original filename; `../` in a name has no effect (test).
4. The `FileStorage` interface has a second in-memory implementation used by tests.
5. Files survive container restart (volume), and `docker compose down -v` is the only thing that deletes them.

## Test commands

```
npm run be:test -- apps/api/test/files
npm run be:verify
```

## Migration-first (plan section 14)

- Every new table that could receive .cloud rows carries `legacy_source`, `legacy_id` and `unique (legacy_source, legacy_id)`, and is added to `apps/api/prisma/migratable-models.json`. Not in the contract.
- Enums are `text` + `check` (English codes); anything the source may lack is nullable or has a documented default.
- Add or update this entity's row in the mapping matrix (plan section 14.7) in the same PR; seeds must not set `legacy_*` and must be idempotent.

## Programme update (2026-10-19)

- Programme update (D52): must also store derived files (intake page images, figure crops) under per-use size limits (`INTAKE_MAX_FILE_MB`); BE-37 builds on this interface. Coordinate any interface change with lane PC-5 through the lead.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-04 (file-storage). Work in this repo clone on branch be/BE-04-file-storage, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-04-file-storage.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-04. Build the FileStorage interface with a local-disk implementation, the files table, and the three endpoints. Validate by magic bytes, enforce size limits, never use client filenames for storage, and restrict download to the owner or an authorised role. Copy the limits and BM messages from the M01 picture upload mock handler. This card needs a security review.
```
