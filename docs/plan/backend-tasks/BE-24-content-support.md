# BE-24 Content and support tickets (M09, M22)

| Field | Value |
|---|---|
| Size | M |
| Lane | PC-1 (folders: sessions.md section 5) |
| Priority | P1 |
| Wave | 1 |
| Depends on | BE-03, BE-04 (BE-05 for school scoping) |
| Parallel with | BE-08, BE-11, BE-25 |
| Owner module | M09, M22 |

## Goal

CMS content (articles, banners, videos, notes, Perutusan messages, screenshots, audio KBAT sets) and the support-ticket flow (learner create/list, admin queue, notify admins). Audio KBAT student play is backlog; only the admin and set listing routes in the mock are carded here.

## Inputs (read these)

- `docs/requirements/srs/M09-content.md`, `docs/requirements/srs/M22-support-tickets.md` (and `urs/`)
- Mock M09: `src/modules/m09-content/mock/handlers/{articles,videos,perutusan,audio,support,admin-articles,admin-banners,admin-notes,admin-audio,admin-tools,admin-common,common,index}.ts`, tables `content.*`; client `src/modules/m09-content/api/*`
- Mock M22: `src/modules/m22-support-tickets/mock/handlers/tickets.ts` (4 routes; notifies every active admin through the M01 hook), table `m22.supportTickets`; client `src/modules/m22-support-tickets/api/*`
- `docs/requirements/v2-portals.md` (public articles/videos move to `awam`; signed-in learners reach the same content through a learner route: the API stays one set of endpoints)
- BE-06 `NotificationsService`, BE-04 files

## Outputs

- Contract: `packages/contract/src/content/**`, `packages/contract/src/support/**`
- `apps/api/prisma/schema/{content,support}.prisma` + migration: `articles`, `article_attachments`, `banners`, `videos`, `video_schools`, `notes`, `perutusan`, `perutusan_comments`, `perutusan_reactions`, `perutusan_reads`, `screenshots`, `audio_kbat_sets`, `support_config`, `support_tickets`
- `apps/api/src/modules/{content,support}/**`
- Seed: `apps/api/prisma/seed/content.ts` (a handful of fictitious articles, banners, videos)
- Tests under `apps/api/test/content/**`, `apps/api/test/support/**`

## Endpoints (paths from the mock)

| Group | Endpoints |
|---|---|
| Public/learner | `GET /api/articles`, `GET /api/articles/hot`, `GET /api/articles/latest`, `GET /api/articles/:slug`, `GET /api/banners/active`, `GET /api/videos`, `GET /api/videos/form-context`, `POST /api/videos`, `GET /api/config/support`, `GET /api/audio-kbat-sets` |
| Perutusan | `GET /api/perutusan`, `GET /api/perutusan/mine`, `GET /api/perutusan/compose-context`, `POST /api/perutusan` |
| Admin | `GET/POST /api/admin/articles`, `/admin/banners`, `/admin/notes`, `/admin/screenshots`, `/admin/audio-kbat-sets` (+ `/admin/audio-kbat-sets/template`) |
| Tickets | `GET /api/tiket`, `POST /api/tiket`, `GET /api/admin/tiket` (+ the 4th route in `tickets.ts`) |

## DB tables touched

The tables listed in Outputs; `notifications` (via `NotificationsService`), `files`.

## Acceptance criteria

1. Public article/banner/video endpoints work without a session only where the mock allows; draft or unpublished content is never returned to the public.
2. Rich-text article bodies are sanitised on write (no script/event-handler HTML); a test posts `<script>` and an `onerror` payload and expects it removed.
3. Creating a ticket forces the user from the session (a `userId` in the body is ignored), validates subject/body length per the mock constants, and notifies every active admin; a notification failure does not undo the ticket.
4. The admin ticket queue is `admin` only (403 for others), read-only as the mock (D27).
5. Video visibility by school (`video_schools`) honours scope; teachers' uploaded videos need the approval state the mock uses.
6. Slugs are unique and stable; list pagination and `meta` as in the mock.

## Test commands

```
npm run be:test -- apps/api/test/content apps/api/test/support
npm run be:verify
```

## Migration-first (plan section 14)

- Every new table that could receive .cloud rows carries `legacy_source`, `legacy_id` and `unique (legacy_source, legacy_id)`, and is added to `apps/api/prisma/migratable-models.json`. Not in the contract.
- Enums are `text` + `check` (English codes); anything the source may lack is nullable or has a documented default.
- Add or update this entity's row in the mapping matrix (plan section 14.7) in the same PR; seeds must not set `legacy_*` and must be idempotent.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-24 (content-support). Work in this repo clone on branch be/BE-24-content-support, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-24-content-support.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-24. Port content and ticket behaviour from the m09 and m22 mock handlers. Sanitise all HTML on write, never trust a client-sent userId, and notify admins through NotificationsService (BE-06). Cover audio KBAT only for the routes listed; student audio play is backlog.
```
