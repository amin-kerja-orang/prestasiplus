# BE-03 Authentication, session, roles, scope and Mod Pelajar

| Field | Value |
|---|---|
| Size | L |
| Lane | PC-1 (folders: sessions.md section 5) |
| Priority | P0 |
| Wave | 0 |
| Depends on | BE-02 |
| Parallel with | BE-14, BE-34 |
| Owner module | M01 (base identity) |
| Security review | required (auth, session, personal data) |

## Goal

Implement the six session endpoints of `@pp/contract`, the identity tables they need, the guards (`AuthGuard`, `RolesGuard`, `CapabilityGuard`), the request-scoped `ScopeContext` / `ScopeFilter`, CSRF, login throttling, and an `audit_events` writer. This is the base every other card builds on.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `packages/contract/README.md` (session contract table), `packages/contract/src/{session,auth,access,common}/**`, `packages/contract/openapi.json`
- `docs/architecture/v2-frontend.md` section 4 (4.2 to 4.5), `docs/adr/0016-two-portal-architecture.md`, `docs/adr/0017-role-list-active-role-scope.md`
- `docs/requirements/v2-portals.md` (US-05, US-08, US-15, US-16 and their ACs), `docs/requirements/role-access-matrix.md`
- `docs/requirements/srs/M01-authentication.md` (login, throttle, inactive rules), `docs/requirements/srs/M02-users-schools.md` (user fields)
- Mock behaviour to port (rules only; the wire shape is the contract's): `src/modules/m01-authentication/mock/handlers/{auth,auth-deps,auth-input,auth-state}.ts`, `src/mock/auth/{sessions,middleware,landing}.ts`, `src/mock/core-data/{accounts,resolve-session,client-session}.ts`. The mock has `POST /api/auth/login` and `POST /api/auth/logout`; the four `/api/session*` routes have no mock route and come from the contract.
- `docs/AKAUN-DEMO.md` (demo accounts, for seeds only)
- `docs/architecture/v2-data-migration.md` section 4.1 and section 5 (password hashes, IC, roles)

## Outputs

- `apps/api/prisma/schema/identity.prisma` and `apps/api/prisma/schema/schools.prisma` plus one migration: `users`, `user_roles`, `user_scopes`, `sessions`, `login_attempts`, `audit_events` (identity); `schools` (minimal: id, name, code, state, district, is_active; BE-05 extends) (schools). `users` carries `legacy_source`, `legacy_id`, `legacy_hash` and the unique pair from the first migration (plan 14.2), `email` nullable, a `username` column, and the status flags of `v2-data-migration.md` section 4.1.
- `apps/api/src/modules/auth/**`: controller, service, Postgres session store, cookie + CSRF handling, password hashing service (argon2id for new hashes, bcrypt `$2y$` verify with rehash-on-login), login throttle
- `apps/api/src/common/{guards,scope}/**`: `AuthGuard`, `RolesGuard`, `CapabilityGuard` (reads `capabilitiesFor(role, scope)` from `@pp/contract/access`), `@Roles()`, `@Capability()`, `ScopeContext`, `ScopeFilter` helper for repositories
- `apps/api/src/common/audit/audit.service.ts`: the `AuditService` every later card calls (role switch, mode enter/exit, login failures)
- Seed `apps/api/prisma/seed/core/identity.ts`: the canonical demo accounts of `docs/AKAUN-DEMO.md` for roles student, teacher, school_admin, admin plus one dual-role teacher + school_admin account, one inactive and one suspended account (fictitious names)
- No contract files: `session/`, `auth/` and `access/` are lead-owned. A missing case goes to a GitHub issue labelled `contract`; do not edit them.
- Tests under `apps/api/test/auth/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/modules/auth/**`, `apps/api/src/common/guards/**`, `apps/api/src/common/scope/**`, `apps/api/src/common/audit/**`.
- Prisma file(s): `apps/api/prisma/schema/identity.prisma`, `apps/api/prisma/schema/schools.prisma` and one migration folder under `apps/api/prisma/migrations/`.
- Contract: none.
- Seeds: `apps/api/prisma/seed/core/identity.ts`, plus one line in `apps/api/prisma/seed/index.ts`.
- Tests: `apps/api/test/auth/**`. The conformance scenarios for auth and session are written by BE-31 (it depends on this card), not here.
- Append-only shared files (one line each, never reorder): `apps/api/src/modules/index.ts` (one import and one array entry); `apps/api/prisma/migratable-models.json` (model names, alphabetical); your own rows of the mapping matrix, plan section 14.7; `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: identity.prisma is shared with BE-05 and BE-06, schools.prisma with BE-05 and BE-25; all are ordered by Depends on, so a PC following AGENT-SYNC.md section 1 never has two of them open together.

## Endpoints (shapes are the existing contract schemas)

| Method and path | Request | Success | Errors |
|---|---|---|---|
| `POST /api/auth/login` | `LoginRequest { identifier, password, schoolId?, remember }` | 200 `{ data: Session }` + `Set-Cookie` (HTTP-only, `Secure`, `SameSite=Lax`, session id regenerated) | 401 `INVALID_CREDENTIALS`; 403 `ACCOUNT_INACTIVE`, `SCHOOL_INACTIVE`; 422 `VALIDATION_ERROR`, `AMBIGUOUS_USERNAME` (`details.schools`); 429 `RATE_LIMITED` (`retryAfter`) |
| `POST /api/auth/logout` | none, `X-CSRF-Token` when a session exists | 204, idempotent | 403 `CSRF_INVALID` |
| `GET /api/session` | none | 200 `{ data: Session }` | 401 `UNAUTHORIZED` |
| `POST /api/session/role` | `SwitchRoleRequest { role }` | 200 `{ data: Session }`, session id regenerated, audit row | 401; 403 `ROLE_NOT_ALLOWED`, `CSRF_INVALID`; 409 `MODE_ACTIVE`; 422 |
| `POST /api/session/mode` | `EnterModeRequest { mode: 'mod_pelajar' }` | 200 `{ data: Session }` (`active.via = 'mod_pelajar'`, `mode.isTest = true`) | 401; 403 `MODE_NOT_ALLOWED`; 409 `MODE_ALREADY_ACTIVE`; 422 |
| `DELETE /api/session/mode` | none | 200 `{ data: Session }` (return role active) | 401; 409 `NO_MODE_ACTIVE` |

Rules to enforce (all from the contract and `v2-portals.md`): login by e-mail or username (+ school when the username is ambiguous); roles are a list, one active; `student` never combines with another role; `admin` is single-role; scope is derived server-side only (strict request schemas reject a client `scope`); `capabilities` come from the access matrix for the active role and scope; `landingPath` per role (`v2-frontend.md` 4.4); Mod Pelajar only for `admin` and `school_admin` (D33b); role switch blocked while a mode is on; no token is ever returned in a body (only `csrf`).

## DB tables touched

`users`, `user_roles`, `user_scopes`, `schools` (minimal), `sessions`, `login_attempts`, `audit_events`. Passwords are stored as hashes only; IC is never stored in clear (hash + masked), see `v2-data-migration.md` section 5.

## Acceptance criteria

1. Every case in the table above is covered by a supertest test, and every success body parses with `SessionSchema`; every error body parses with `ErrorBodySchema` and uses the status of `ERROR_STATUS` / the table.
2. The messages are exactly `AUTH_ERROR_MESSAGES` in `packages/contract/src/auth/errors.ts` (for example `INVALID_CREDENTIALS` "E-mel/Nama pengguna atau kata laluan tidak sah."). A wrong password and an unknown identifier return identical status, code and message (one test compares the two responses byte for byte except `requestId`).
3. Throttle (mock BR-02: `LOGIN_MAX_ATTEMPTS = 5`, `LOGIN_DECAY_MS = 60 s`): config `THROTTLE_LOGIN_PER_MINUTE` defaults to 5 failed attempts per identifier+IP in 60 seconds. The 6th attempt returns 429 `RATE_LIMITED` with `retryAfter` between 1 and 60, even with the correct password; a success resets the counter; a refusal for an inactive account does not count as a failed attempt (mock BR-23).
4. Session fixation and lifetime: the session id changes on login, role switch and mode change; logout invalidates it server-side (a second request with the old cookie gets 401); without `remember` a session expires 120 minutes after the last authenticated request (sliding, slid at most once per minute; mock BR-06, `SESSION_LIFETIME_MS`); with `remember` the lifetime is configurable and does not slide — default **30 calendar days** for learner roles (`SESSION_REMEMBER_DAYS`), and for staff roles — `admin`, `school_admin`, `ppd_officer`, `jpn_officer` (including dual-role accounts) — default **1 day**, `0` disables remember (`SESSION_REMEMBER_DAYS_STAFF`). This is a v2 security change from the 5-calendar-year mock (lead decision 2026-10-19; DV in `docs/architecture/v2-backend-deviations.md`). Tests use the injected `Clock`.
5. A mutating request with a valid session and a missing or wrong `X-CSRF-Token` returns 403 `CSRF_INVALID` (message from `AUTH_ERROR_MESSAGES`); GET requests do not need it.
6. `RolesGuard` and `CapabilityGuard` unit tests: a role without the capability gets 403; the guard reads the active role, not the whole role list.
7. `ScopeFilter` test: a school admin of school A reading a school B record gets 404 (not 403); scope is never taken from query or body.
8. A bcrypt `$2y$` hash (generated in the test, no real hashes) verifies and is rehashed to argon2id on the first successful login.
9. A log-capture test proves no password, cookie value or IC number appears in the logs.
10. Each seeded demo account logs in with the demo password and gets the `landingPath` and scope of its role; the inactive and the suspended account get 403 `ACCOUNT_INACTIVE`.

## Test commands

```
npm run be:db:migrate && npm run be:db:seed
npm run be:test -- apps/api/test/auth
npm run be:verify
npm run contract:check
npm run be:test -- apps/api/test/conformance   # only after BE-31 is merged
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green. Paste the real tail of the output in the PR.
3. Conformance: BE-31 depends on this card and writes the auth and session scenarios; here `be:verify` is the gate. Keep the supertest cases of acceptance criterion 1 reusable (plain request/response assertions) so BE-31 can lift them.
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

1. Plan 14.9 item 6 needs the BE-34 upsert helper. If BE-34 has not merged when this card is ready, who adds the double-upsert test for the tables created here? Working assumption: BE-34 adds a generic test over `migratable-models.json`; note it in the PR.
2. ~~The 5-calendar-year remembered session (mock DATA-M01-02) is a long-lived credential.~~ **Resolved (lead, 2026-10-19):** remember default = 30 days learners (`SESSION_REMEMBER_DAYS`), 1 day staff / 0 = off (`SESSION_REMEMBER_DAYS_STAFF`); configurable; deviation from the 5-year mock recorded in `v2-backend-deviations.md`.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-03 (auth-session). Work in this repo clone on branch be/BE-03-auth-session, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-03-auth-session.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-03 exactly as the six session endpoints in packages/contract (do not change the session contract; if something is missing write it under Open questions). Use a Postgres-backed session table with an HTTP-only cookie and X-CSRF-Token. Build AuthGuard, RolesGuard, CapabilityGuard (from @pp/contract/access) and a request-scoped ScopeContext/ScopeFilter that all later repositories must use. Port the login rules from src/modules/m01-authentication/mock/handlers/auth*.ts and the M01 SRS. Seed fictitious demo accounts from docs/AKAUN-DEMO.md. This card needs a security review: list the threat model checks you covered in the PR.
```
