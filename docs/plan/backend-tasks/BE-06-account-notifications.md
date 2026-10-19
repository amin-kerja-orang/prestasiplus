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

- `docs/requirements/srs/M01-authentication.md`, `docs/requirements/urs/M01-authentication.md`
- Mock: `src/modules/m01-authentication/mock/handlers/{auth,auth-account,auth-stats,notifications,notifications-store}.ts`; client `src/modules/m01-authentication/api/*`
- `docs/architecture/v2-data-migration.md` section 4.1, section 5 (reset forced for roster accounts)
- BE-03, BE-04 outputs

## Outputs

- Contract: `packages/contract/src/account/**`, `packages/contract/src/notifications/**`
- `apps/api/prisma/schema/{account,notifications}.prisma` + migration: `password_resets`, `user_settings`, `notifications`
- `apps/api/src/modules/{account,notifications}/**`; `NotificationsService.push(userId, {type, category, title, body}, {push?})` exported for other modules
- A `MailPort` interface with a logging implementation (no provider; OD-7): reset links are logged in dev, never e-mailed in B1
- Tests under `apps/api/test/account/**`

## Endpoints (paths from the mock)

| Method and path | Notes |
|---|---|
| `POST /api/auth/register` | self-registration per SRS (school join code, role limited to student/teacher/parent as the SRS says) |
| `POST /api/auth/password/email`, `POST /api/auth/password/reset`, `POST /api/auth/password/reset-ic` | generic response regardless of account existence; token single-use, expiry per SRS |
| `PUT /api/me`, `PUT /api/me/password`, `POST /api/me/picture` | profile, change password (current password required), avatar (BE-04) |
| `GET /api/me`, `GET /api/me/settings`, `PUT /api/me/settings` | `GET /api/me` is the `UserMe` projection still used by un-migrated pages; keep it consistent with `GET /api/session` |
| `GET /api/me/notifications`, `GET /api/me/notifications/unread-count`, `POST /api/me/notifications/{read-all,bulk-read,bulk-delete}` | paginated inbox |
| `GET /api/public/stats` | public landing counters (computed from the DB, no hard-coded figures) |

## DB tables touched

`users`, `password_resets`, `user_settings`, `notifications`, `files` (via BE-04), `audit_events`.

## Acceptance criteria

1. All endpoints match the mock handler behaviour and BM messages for the same inputs.
2. Password reset never discloses whether an e-mail/IC exists; tokens are stored hashed, single-use, expire; reuse returns the contract error; resetting invalidates the user's other sessions.
3. Accounts flagged `must_reset_password` (roster accounts) are forced through reset on first login (flag exists now, set by the migration later).
4. Changing the password requires the current password and rehashes with argon2id.
5. Registration rate-limited; duplicate e-mail/username follows the mock rule.
6. Notifications are only visible to their owner (404 for others); bulk operations ignore foreign ids silently as the mock does (verify against the mock).
7. `GET /api/me` and `GET /api/session` agree on the same user fields.

## Test commands

```
npm run be:test -- apps/api/test/account
npm run be:verify
```

## Migration-first (plan section 14)

- Every new table that could receive .cloud rows carries `legacy_source`, `legacy_id` and `unique (legacy_source, legacy_id)`, and is added to `apps/api/prisma/migratable-models.json`. Not in the contract.
- Enums are `text` + `check` (English codes); anything the source may lack is nullable or has a documented default.
- Add or update this entity's row in the mapping matrix (plan section 14.7) in the same PR; seeds must not set `legacy_*` and must be idempotent.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-06 (account-notifications). Work in this repo clone on branch be/BE-06-account-notifications, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-06-account-notifications.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-06 from the M01 SRS and the m01 mock handlers (auth-account, notifications, auth-stats). Write the contract first, then the account and notifications modules. Reset links must be logged through a MailPort stub and never sent; tokens stored hashed. Export NotificationsService.push for other modules. Needs a security review.
```
