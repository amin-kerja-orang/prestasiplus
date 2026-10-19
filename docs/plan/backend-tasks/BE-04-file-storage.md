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

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/architecture/v2-backend-plan.md` sections 3, 11, 13 (OD-6) and 15.2 (Storage row)
- `src/modules/m01-authentication/mock/handlers/auth-account.ts` (picture upload: `PICTURE_TYPES` allow-list, size limit, validation messages, `MSG_PICTURE_SAVED`)
- `src/modules/m28-bijak-spm/lib/photo-store.ts`, `src/modules/m28-bijak-spm/domain/types.ts` (`PhotoMeta`)
- `docs/requirements/v2-bijak-spm.md` (photo-of-working limits; search "photo")
- `docs/architecture/v2-data-migration.md` section 5 ("Files")
- BE-03 outputs (guards, `ScopeFilter`)

## Outputs

- `apps/api/src/modules/files/**`: `FileStorage` interface (`put`, `get`, `delete`, `exists`), `LocalDiskStorage` (root `FILE_STORAGE_DIR`), an in-memory implementation for tests, `FilesService`, `FilesController`
- Derived files: the same interface also stores **derived files** (intake page images and figure crops, D52) under their own per-use size limit (`INTAKE_MAX_FILE_MB`); BE-37 builds on this interface. Any change to the interface is coordinated with lane PC-5 through the lead.
- `apps/api/prisma/schema/files.prisma` + migration: `files`
- Contract: `packages/contract/src/files/**` (`FileRef`, upload response)
- Tests under `apps/api/test/files/**`; compose volume `apifiles` for the `api` service

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/modules/files/**`.
- Prisma file(s): `apps/api/prisma/schema/files.prisma` and one migration folder under `apps/api/prisma/migrations/`.
- Contract: `packages/contract/src/files/**` (new files only), registered in `src/openapi.ts`; `openapi.json` is regenerated with `npm run contract:emit`, never hand-edited.
- Seeds: none.
- Tests: `apps/api/test/files/**`, and (after BE-31) new scenario files in `apps/api/test/conformance/files/`.
- Other files: `compose.yaml` (the `apifiles` volume only).
- Append-only shared files (one line each, never reorder): `apps/api/src/modules/index.ts` (one import and one array entry); `apps/api/prisma/migratable-models.json` (model names, alphabetical); your own rows of the mapping matrix, plan section 14.7; `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: files.prisma belongs to this card alone; BE-37 and BE-16 only use the service.

## Endpoints

| Method and path | Request | Response |
|---|---|---|
| `POST /api/files` | `multipart/form-data` field `file`, query `purpose` in (`avatar`, `bijak_photo`, `question_image`, `cms_image`) | 201 `{ data: FileRef { id, url, mime, size, purpose } }`; 422 `VALIDATION_ERROR` with `fields.file` for a wrong type or an oversize file (the mock's picture rule; nginx answers 413 above its own limit) |
| `GET /api/files/:id` | none | file bytes with correct `Content-Type`, `X-Content-Type-Options: nosniff`, private cache; owner or authorised role only (404 otherwise) |
| `DELETE /api/files/:id` | none | 204 for the owner |

These three routes are new (no mock route). The rules come from the M01 picture upload handler (`POST /api/me/picture`, which BE-06 wires to this service) and the M28 photo store.

Limits: MIME allow-list by magic bytes (not by filename), max size `MAX_UPLOAD_MB`, random storage names, no path traversal, images re-encoded or at least stripped of EXIF GPS (decide and note in the PR).

## DB tables touched

`files` (id, owner_user_id, purpose, mime, size_bytes, sha256, storage_key, created_at, is_test).

## Acceptance criteria

1. A valid PNG, JPEG and WebP upload succeeds with 201 and a `FileRef` that parses with the contract schema; the allowed types equal the mock's `PICTURE_TYPES` (jpeg, png, webp) for `avatar`.
2. Limits are the mock's (`auth-account.ts`): `avatar` accepts `image/jpeg`, `image/png`, `image/webp` up to 2048 KB (`PICTURE_MAX_KB`). A text file renamed `.png` is rejected 422 `VALIDATION_ERROR` with `fields.file` "The file field must be a file of type: jpeg, png, webp."; a 2049 KB image is rejected 422 with `fields.file` "The file field must not be greater than 2048 kilobytes." (the mock validator copy, with the attribute name `file`; `POST /api/me/picture` in BE-06 keeps the attribute name `profilePicture`, "The profile picture field must ..."). `bijak_photo` accepts `image/jpeg` and `image/png` only, up to 5 MB (`MAX_PHOTO_BYTES`) and at most 3 per part (`MAX_PHOTOS_PER_PART`, enforced by BE-16 which owns the part link), with the mock copy `Gambar mesti JPG atau PNG, maksimum 5 MB.` (`MSG_PHOTO_TYPE` in `photo-store.ts`). `MAX_UPLOAD_MB` is the global ceiling and the per-purpose limits live in one config table.
3. A user cannot download another user's `bijak_photo` (404). `avatar` and `cms_image` visibility follows the mock; where the mock is silent the working rule is "avatar visible to any signed-in user, `cms_image` public" and it is listed under Open questions.
4. Storage keys never contain the original filename; a client filename such as `../../x.png` has no effect (test checks the stored key and the DB row).
5. `FileStorage` has the second in-memory implementation and the contract tests run against both implementations.
6. Files survive a container restart (named volume `apifiles`); `docker compose down` keeps them and only `down -v` removes them (documented, manual check noted in the PR).
7. A derived file (`purpose` used by BE-37) is accepted by the interface up to `INTAKE_MAX_FILE_MB` and refused above it (unit test through the service; no public endpoint for that purpose).
8. Role/scope: no session gives 401; a mutating call without CSRF gives 403 `CSRF_INVALID`; deleting someone else's file gives 404.

## Test commands

```
npm run be:test -- apps/api/test/files
npm run be:verify
npm run contract:check
npm run be:test -- apps/api/test/conformance   # only after BE-31 is merged
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green; if anything under `packages/**` changed, root `npm run typecheck && npm test` is green too. Paste the real tail of the output in the PR.
3. Conformance (BE-31): once BE-31 is merged, add this card's scenarios as new files in `apps/api/test/conformance/files/` and run `npm run be:test -- apps/api/test/conformance`; a failure is a blocker. Before BE-31 merges, `be:verify` is the gate; write "conformance scenarios pending BE-31" in the PR.
4. Migration-first checklist of plan section 14.9 (items 1 to 6) is complete for every table this card creates. Item 6 (insert a `legacy_source = 'cloud'` row twice through the BE-34 upsert helper and assert one row) applies once BE-34 is merged; state in the PR whether it was available.
5. Label `security-review` on the PR; list the security decisions and the tests that prove them.
6. The card's tracker row is updated (status, PR number, one-line note) and the PR description follows the template in `docs/plan/backend-tasks/README.md`. Nothing stays only on your PC (AGENT-SYNC.md section 4).

## Migration-first (plan sections 14 and 14.9)

- Follow the checklist of plan section 14.9 (items 1 to 6) for every table listed under "DB tables touched".
- Each table that could receive .cloud rows has `legacy_source text null`, `legacy_id text null` and `unique (legacy_source, legacy_id)`, and is listed in `apps/api/prisma/migratable-models.json`. These columns never appear in the contract or in an API response.
- Enums are `text` + `check` with English codes (no Postgres enum types); anything the source may lack is nullable or has a documented default; seeds never set `legacy_*` and are idempotent.
- Add or update this entity's row in the mapping matrix (plan section 14.7) in the same PR.

## Open questions

Do not guess these; write your working assumption in the PR and ask the lead (issue labelled `question`) if it blocks you.

1. Visibility of `avatar` and `cms_image` files is not stated by the mock (it stores a data URL). Working rule: avatar readable by any signed-in user, `cms_image` public. Confirm.
2. Re-encode images or only strip EXIF GPS? Working assumption: strip metadata and re-encode raster images.
3. Type and size limits for `question_image` and `cms_image` are not in the mock or the SRS. Working assumption: JPEG, PNG, WebP up to 2048 KB like `avatar`. Confirm.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-04 (file-storage). Work in this repo clone on branch be/BE-04-file-storage, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-04-file-storage.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-04. Build the FileStorage interface with a local-disk implementation, the files table, and the three endpoints. Validate by magic bytes, enforce size limits, never use client filenames for storage, and restrict download to the owner or an authorised role. Copy the limits and BM messages from the M01 picture upload mock handler. This card needs a security review.
```
