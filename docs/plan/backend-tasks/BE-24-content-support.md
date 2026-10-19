# BE-24 Content and support tickets (M09, M22)

| Field | Value |
|---|---|
| Size | M |
| Lane | PC-1 (folders: sessions.md section 5) |
| Priority | P1 |
| Wave | 1 |
| Depends on | BE-03, BE-04, BE-05, BE-06 |
| Parallel with | BE-08, BE-11, BE-25 |
| Owner module | M09, M22 |

## Goal

CMS content (articles, banners, videos, notes, Perutusan messages, screenshots, audio KBAT sets) and the support-ticket flow (learner create/list, admin queue, notify admins). Audio KBAT student play is backlog; only the admin and set listing routes in the mock are carded here.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/requirements/srs/M09-content.md`, `docs/requirements/srs/M22-support-tickets.md` (and `urs/`)
- Mock M09: `src/modules/m09-content/mock/handlers/{articles,videos,perutusan,audio,support,admin-articles,admin-banners,admin-notes,admin-audio,admin-tools,admin-common,common,index}.ts`, tables `src/modules/m09-content/mock/tables/*` and `types.ts`; client `src/modules/m09-content/api/*`; mock tests `src/modules/m09-content/__tests__/mock/**`
- Mock M22: `src/modules/m22-support-tickets/mock/handlers/tickets.ts` (4 routes; notifies every active admin through the M01 hook), table `src/modules/m22-support-tickets/mock/tables/*`; client and messages `src/modules/m22-support-tickets/api/types.ts`; mock tests `src/modules/m22-support-tickets/__tests__/mock/**`
- `docs/requirements/v2-portals.md` (public articles/videos move to `awam`; signed-in learners reach the same content through a learner route: the API stays one set of endpoints)
- BE-06 `NotificationsService`, BE-04 files service, BE-05 for school scoping
- Requirements: BE-FR-09, BE-FR-10, BE-FR-34; BE-NFR-37 ([URS 9.2](../../requirements/v2-backend-urs.md))
- API catalogue part B4 (economy, content, games): [economy-content-games.md](../../architecture/v2-api-catalogue/economy-content-games.md) (endpoint list, wire conventions and open questions for this card's scope)
- Data model: [v2-data-model.md](../../architecture/v2-data-model.md) (tables, keys and indexes of this card; being written 2026-10-19)

## Outputs

- Contract: `packages/contract/src/content/**`, `packages/contract/src/support/**`
- `apps/api/prisma/schema/content.prisma` + migration (support tables live in the same file): `articles`, `article_attachments`, `banners`, `videos`, `video_schools`, `notes`, `perutusan`, `perutusan_comments`, `perutusan_reactions`, `perutusan_reads`, `screenshots`, `audio_kbat_sets`, `support_config`, `support_tickets`
- `apps/api/src/modules/content/**`, `apps/api/src/modules/support/**`
- Seed `apps/api/prisma/seed/content.ts` (a handful of fictitious articles, banners, videos; one line in the registry)
- Tests under `apps/api/test/content/**`, `apps/api/test/support/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/modules/content/**`, `apps/api/src/modules/support/**`.
- Prisma file(s): `apps/api/prisma/schema/content.prisma` and one migration folder under `apps/api/prisma/migrations/`.
- Contract: `packages/contract/src/content/**`, `packages/contract/src/support/**` (new files only), registered in `src/openapi.ts`; `openapi.json` is regenerated with `npm run contract:emit`, never hand-edited.
- Seeds: `apps/api/prisma/seed/content.ts`, plus one line in `apps/api/prisma/seed/index.ts`.
- Tests: `apps/api/test/content/**`, `apps/api/test/support/**`, and (after BE-31) new scenario files in `apps/api/test/conformance/content/`.
- Append-only shared files (one line each, never reorder): `apps/api/src/modules/index.ts` (one import and one array entry); `apps/api/prisma/migratable-models.json` (model names, alphabetical); your own rows of the mapping matrix, plan section 14.7; `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: content.prisma belongs to this card alone (support tables included). It can run in parallel with BE-25 (schools.prisma) once BE-06 has merged.

## Endpoints (45 mock routes, paths from the mock: the 47 M09 and M22 routes minus the two student audio-play routes)

Every route below exists in the mock (verified). Student audio play is backlog and **not** built here: `GET /api/audio-kbat-sets/:id` and `POST /api/audio-kbat-sets/:id/attempts`.

| Group | Endpoints |
|---|---|
| Articles and banners | `GET /api/articles`, `GET /api/articles/hot`, `GET /api/articles/latest`, `GET /api/articles/:slug`, `GET /api/banners/active`, `GET /api/config/support` |
| Videos | `GET /api/videos`, `GET /api/videos/:id`, `GET /api/videos/form-context`, `POST /api/videos`, `PUT /api/videos/:id`, `DELETE /api/videos/:id` |
| Perutusan | `GET /api/perutusan`, `GET /api/perutusan/:id`, `GET /api/perutusan/mine`, `GET /api/perutusan/compose-context`, `POST /api/perutusan`, `POST /api/perutusan/:id/comments`, `POST /api/perutusan/:id/reactions`, `GET /api/public/perutusan/:id` |
| Audio KBAT | `GET /api/audio-kbat-sets` (list only) |
| Admin articles | `GET /api/admin/articles`, `GET /api/admin/articles/:id`, `POST /api/admin/articles`, `PUT /api/admin/articles/:id`, `DELETE /api/admin/articles/:id` |
| Admin banners | `GET /api/admin/banners`, `GET /api/admin/banners/:id`, `POST /api/admin/banners`, `PUT /api/admin/banners/:id`, `DELETE /api/admin/banners/:id` |
| Admin notes | `GET /api/admin/notes`, `GET /api/admin/notes/:id`, `POST /api/admin/notes`, `PUT /api/admin/notes/:id`, `DELETE /api/admin/notes/:id` |
| Admin tools | `GET /api/admin/screenshots`, `POST /api/admin/screenshots`, `GET /api/admin/audio-kbat-sets`, `GET /api/admin/audio-kbat-sets/template`, `POST /api/admin/audio-kbat-sets` |
| Tickets | `GET /api/tiket`, `POST /api/tiket`, `GET /api/admin/tiket`, `GET /api/admin/tiket/open-count` |

## DB tables touched

The tables listed in Outputs; `notifications` (via `NotificationsService`), `files`.

## Acceptance criteria

1. Public article, banner and video endpoints work without a session only where the mock's guards allow; a draft or unpublished item is never returned to the public (test per list endpoint with one draft and one published row).
2. Rich-text article bodies are sanitised on write: a test posts a `<script>` tag and an `onerror=` attribute and expects both removed from the stored and the returned body.
3. Tickets (mock `tickets.ts`): `POST /api/tiket` takes the user from the session (a `userId` in body or query is ignored); `subject` is required ("Subjek diperlukan.") and at most 255 characters ("Subjek tidak boleh melebihi 255 aksara."); `body` is required ("Butiran diperlukan.") and at most 5000 ("Butiran tidak boleh melebihi 5000 aksara."); the success flash is "Tiket dihantar. Pasukan sokongan akan membalas secepat mungkin."; every active admin gets a notification (type `new_ticket`, title "Tiket baru", body "Tiket sokongan baharu telah diterima.") through `NotificationsService`, and a notification failure does not undo the ticket.
4. `GET /api/admin/tiket` and `.../open-count` are `admin` only (403 for others), read-only (D27); `GET /api/tiket` returns only the caller's tickets.
5. Video visibility by school (`video_schools`) honours scope; teacher-uploaded videos start in the approval state the mock uses (replay the mock case).
6. Slugs are unique and stable (a rename keeps the slug unless the mock regenerates it; replay the mock case); list pagination and `meta` as in the mock.
7. Uploaded images (banners, article attachments, screenshots) go through BE-04 with `purpose=cms_image`.
8. Roles: admin routes need `admin`; teacher routes as the mock guards; no session 401 where a session is required; missing CSRF 403 `CSRF_INVALID`.

## Test commands

```
npm run be:test -- apps/api/test/content apps/api/test/support
npm run be:verify
npm run contract:check
npm run be:test -- apps/api/test/conformance   # only after BE-31 is merged
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green; if anything under `packages/**` changed, root `npm run typecheck && npm test` is green too. Paste the real tail of the output in the PR.
3. Conformance (BE-31): once BE-31 is merged, add this card's scenarios as new files in `apps/api/test/conformance/content/` and run `npm run be:test -- apps/api/test/conformance`; a failure is a blocker. Before BE-31 merges, `be:verify` is the gate; write "conformance scenarios pending BE-31" in the PR.
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

1. Student Audio KBAT play (`GET /api/audio-kbat-sets/:id`, `POST .../attempts`) is backlog; confirm it stays out of B1.
2. Who may create videos (`POST /api/videos`) and Perutusan (`POST /api/perutusan`) is defined by the mock guards; if a guard is missing in the mock, ask before choosing.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-24 (content-support). Work in this repo clone on branch be/BE-24-content-support, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-24-content-support.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-24. Port content and ticket behaviour from the m09 and m22 mock handlers. Sanitise all HTML on write, never trust a client-sent userId, and notify admins through NotificationsService (BE-06). Cover audio KBAT only for the routes listed; student audio play is backlog.
```
