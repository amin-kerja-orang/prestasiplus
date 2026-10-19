# BE-06 Account basics (M01): register, password reset, profile, settings, notifications

| Field | Value |
|---|---|
| Size | M |
| Lane | PC-1 (folders: sessions.md section 5) |
| Priority | P1 |
| Wave | 1 |
| Depends on | BE-03, BE-04, BE-05 |
| Parallel with | BE-08, BE-11, BE-25 |
| Owner module | M01 |
| Security review | required (credentials, reset tokens, personal data) |

## Goal

The rest of M01 beyond the session endpoints: self-registration, password reset (e-mail and IC variants), profile update, password change, picture upload (using BE-04), personal settings, and the notification inbox. This also exposes `pushNotification` as the M01 service other modules call (ADR-0014 hooks).

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/requirements/srs/M01-authentication.md`, `docs/requirements/urs/M01-authentication.md`
- Mock: `src/modules/m01-authentication/mock/handlers/{auth,auth-account,auth-stats,notifications,notifications-store}.ts` (messages and rules are constants in these files), `src/modules/m01-authentication/mock/repository/*`; client `src/modules/m01-authentication/api/*`; mock tests `src/modules/m01-authentication/__tests__/mock/**`
- `src/mock/core-data/me.ts` (the `GET /api/me` projection)
- `docs/architecture/v2-data-migration.md` section 4.1, section 5 (reset forced for roster accounts)
- BE-03, BE-04 and BE-05 outputs

## Outputs

- Contract: `packages/contract/src/account/**`, `packages/contract/src/notifications/**`
- `apps/api/prisma/schema/identity.prisma` (adds `password_resets`, `user_settings`, `notifications`) + migration
- `apps/api/src/modules/{account,notifications}/**`; `NotificationsService.push(userId, {type, category, title, body}, {push?})` exported for other modules (BE-24, BE-36 call it)
- A `MailPort` interface with a logging implementation (no provider; OD-7): reset links are logged in dev and never e-mailed in B1
- Tests under `apps/api/test/account/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/modules/account/**`, `apps/api/src/modules/notifications/**`.
- Prisma file(s): `apps/api/prisma/schema/identity.prisma` and one migration folder under `apps/api/prisma/migrations/`.
- Contract: `packages/contract/src/account/**`, `packages/contract/src/notifications/**` (new files only), registered in `src/openapi.ts`; `openapi.json` is regenerated with `npm run contract:emit`, never hand-edited.
- Seeds: none.
- Tests: `apps/api/test/account/**`, and (after BE-31) new scenario files in `apps/api/test/conformance/account/`.
- Append-only shared files (one line each, never reorder): `apps/api/src/modules/index.ts` (one import and one array entry); `apps/api/prisma/migratable-models.json` (model names, alphabetical); your own rows of the mapping matrix, plan section 14.7; `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: identity.prisma was last changed by BE-05 (BE-06 depends on it); BE-25 touches schools.prisma and BE-24 depends on BE-06, so no two of these are open together.

## Endpoints (paths from the mock)

Every route below exists in the mock (verified).

| Method and path | Notes |
|---|---|
| `POST /api/auth/register` | self-registration; roles limited to `SELF_REGISTER_ROLES`; validation rules in `auth.ts` `register()` (name, e-mail unique, phone max 14, role, grade 1 to 11 for students, `icNumber` max 14, school exists, password min 6 + confirmation) |
| `POST /api/auth/password/email`, `POST /api/auth/password/reset`, `POST /api/auth/password/reset-ic` | reset flow (see acceptance criteria) |
| `PUT /api/me`, `PUT /api/me/password`, `POST /api/me/picture` | profile (`e-mail` in the body is ignored, BR-13), change password (current password required), avatar via BE-04 |
| `GET /api/me`, `GET /api/me/settings`, `PUT /api/me/settings` | `GET /api/me` is the `UserMe` projection still used by un-migrated pages (mock: `src/mock/core-data/routes.ts`); keep it consistent with `GET /api/session` |
| `GET /api/me/notifications`, `GET /api/me/notifications/unread-count`, `POST /api/me/notifications/read-all`, `POST /api/me/notifications/bulk-read`, `POST /api/me/notifications/bulk-delete`, `POST /api/me/notifications/:id/read`, `DELETE /api/me/notifications/:id` | paginated inbox and single-item actions |
| `GET /api/public/stats` | public landing counters (computed from the DB, no hard-coded figures) |

`GET /api/me/gamification-summary` (also in `src/mock/core-data/routes.ts`) belongs to BE-11, not here.

## DB tables touched

`users`, `password_resets`, `user_settings`, `notifications`, `files` (via BE-04), `audit_events`.

## Acceptance criteria

1. Each endpoint gives the same status, `error.code`, exact message and body shape as the mock handler for the same input. Proof: port the cases of `src/modules/m01-authentication/__tests__/mock/**` to supertest and parse bodies with the contract schemas. Success messages: profile "Profil berjaya dikemaskini.", picture "Gambar profil berjaya dikemaskini.", password "Kata laluan berjaya dikemaskini.", settings "Tetapan berjaya disimpan." (mock `MSG_*`). A wrong current password is 422 with `fields.currentPassword`.
2. Password reset (mock BR-10, BR-11): a token is valid 60 minutes, single use (a second use fails with the mock's `MSG_TOKEN_INVALID` text), stored hashed; a second request for the same e-mail within 60 seconds is 429 `RATE_LIMITED` with `retryAfter`; the IC variant failure message is `Email atau No Kad Pengenalan tidak sepadan.`; resetting invalidates the user's other sessions.
3. **Deviation (security, log in `v2-backend-deviations.md`):** the mock answers an unknown e-mail with "We can't find a user with that email address."; the API answers an unknown e-mail or IC exactly like a known one (same status and success message `We have emailed your password reset link.`, same timing class), so existence is never disclosed. The lead confirms in Open questions.
4. Accounts flagged `must_reset_password` (roster accounts; the flag exists now and is set by the migration later) are forced through reset: login succeeds only into a "reset required" state defined by the contract, or the lead decides the shape (Open question 2).
5. Changing the password requires the current password and rehashes with argon2id.
6. Registration is rate-limited (reuse the BE-03 throttle component, same default) and a duplicate e-mail gives the mock's 422 `fields.email`; a duplicate username follows BE-05's rule.
7. Notifications are visible only to their owner: another user's id gives 404 on `:id/read` and `DELETE`; bulk operations silently ignore foreign ids exactly as the mock does (test with a foreign id mixed into the list).
8. `GET /api/me` and `GET /api/session` agree on the shared user fields (id, name, e-mail, roles, school) for every seeded demo account.
9. `GET /api/public/stats` counts equal the row counts in the DB for the seeded data (test inserts a user and the count moves by one).

## Test commands

```
npm run be:test -- apps/api/test/account
npm run be:verify
npm run contract:check
npm run be:test -- apps/api/test/conformance   # only after BE-31 is merged
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green; if anything under `packages/**` changed, root `npm run typecheck && npm test` is green too. Paste the real tail of the output in the PR.
3. Conformance (BE-31): once BE-31 is merged, add this card's scenarios as new files in `apps/api/test/conformance/account/` and run `npm run be:test -- apps/api/test/conformance`; a failure is a blocker. Before BE-31 merges, `be:verify` is the gate; write "conformance scenarios pending BE-31" in the PR.
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

1. Reset non-disclosure deviates from the mock (acceptance criterion 3). Confirm.
2. What does login do for a `must_reset_password` account? The mock has no such state. Working assumption: login succeeds and the session carries a flag the UI uses to force the reset page; the contract change goes through a `contract` issue.
3. The mock's `UserSettings` includes `faith` (BR-17) but the migration plan drops `faith` (Q7). Working assumption: keep the settings field `faith` (nullable, a personal preference, not migrated) because the UI shows it; confirm.
4. Reset e-mails are only logged in B1 (OD-7); confirm that no mail provider is needed before release.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-06 (account-notifications). Work in this repo clone on branch be/BE-06-account-notifications, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-06-account-notifications.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-06 from the M01 SRS and the m01 mock handlers (auth-account, notifications, auth-stats). Write the contract first, then the account and notifications modules. Reset links must be logged through a MailPort stub and never sent; tokens stored hashed. Export NotificationsService.push for other modules. Needs a security review.
```
