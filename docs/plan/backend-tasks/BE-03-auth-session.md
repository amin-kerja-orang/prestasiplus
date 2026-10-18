# BE-03 Authentication, session, roles, scope and Mod Pelajar

| Field | Value |
|---|---|
| Size | L |
| Wave | 0 |
| Depends on | BE-02 |
| Parallel with | BE-14, BE-27 |
| Owner module | M01 (base identity) |
| Security review | required (auth, session, personal data) |

## Goal

Implement the six session endpoints of `@pp/contract`, the identity tables they need, the guards (`AuthGuard`, `RolesGuard`, `CapabilityGuard`), the request-scoped `ScopeContext` / `ScopeFilter`, CSRF, login throttling, and an `audit_events` writer. This is the base every other card builds on.

## Inputs (read these)

- `packages/contract/README.md` (session contract table), `packages/contract/src/{session,auth,access,common}/**`, `packages/contract/openapi.json`
- `docs/architecture/v2-frontend.md` section 4 (4.2 to 4.5), `docs/adr/0016-two-portal-architecture.md`, `docs/adr/0017-role-list-active-role-scope.md`
- `docs/requirements/v2-portals.md` (US-05, US-08, US-15, US-16 and their ACs), `docs/requirements/role-access-matrix.md`
- `docs/requirements/srs/M01-authentication.md` (login, throttle, inactive/suspended rules), `docs/requirements/srs/M02-users-schools.md` (user fields)
- Mock behaviour: `src/modules/m01-authentication/mock/handlers/{auth,auth-deps,auth-input,auth-state}.ts`, `src/mock/auth/*`, `src/mock/core-data/{accounts,resolve-session,client-session}.ts`
- `docs/AKAUN-DEMO.md` (demo accounts, for seeds only)
- `docs/architecture/v2-data-migration.md` section 4.1 and section 5 (password hashes, IC, roles)

## Outputs

- `apps/api/prisma/schema/identity.prisma` and a migration: `users`, `user_roles`, `user_scopes`, `schools` (minimal: id, name, code, state, district, is_active; BE-05 extends), `sessions`, `login_attempts`, `audit_events`
- `apps/api/src/modules/auth/**`: controller, service, session store (Postgres), cookie + CSRF handling, password hashing service (argon2id for new, bcrypt `$2y$` verify with rehash-on-login), throttle
- `apps/api/src/common/{guards,scope}/**`: `AuthGuard`, `RolesGuard`, `CapabilityGuard` (reads `capabilitiesFor(role, scope)` from `@pp/contract/access`), `@Roles()`, `@Capability()`, `ScopeContext`, `ScopeFilter` helper for repositories
- `apps/api/src/modules/audit/audit.service.ts` (role switch, mode enter/exit, login failures)
- Seed module `apps/api/prisma/seed/identity.ts`: the canonical demo accounts of `docs/AKAUN-DEMO.md` for roles student, teacher, school_admin, admin plus one dual-role teacher + school_admin account, one inactive and one suspended account (fictitious names)
- Contract additions only if a session case is missing (tag the lead; do not edit `session/` yourself)
- Tests under `apps/api/test/auth/**`

## Endpoints (shapes are the existing contract schemas)

| Method and path | Request | Success | Errors |
|---|---|---|---|
| `POST /api/auth/login` | `LoginRequest { identifier, password, schoolId?, remember }` | 200 `{ data: Session }` + `Set-Cookie` (HTTP-only, `Secure`, `SameSite=Lax`, session id regenerated) | 401 `INVALID_CREDENTIALS`; 403 `ACCOUNT_INACTIVE`, `SCHOOL_INACTIVE`; 422 `VALIDATION_ERROR`, `AMBIGUOUS_USERNAME` (`details.schools`); 429 `RATE_LIMITED` (`retryAfter`) |
| `POST /api/auth/logout` | none, `X-CSRF-Token` when a session exists | 204, idempotent | 403 `CSRF_INVALID` |
| `GET /api/session` | none | 200 `{ data: Session }` | 401 |
| `POST /api/session/role` | `SwitchRoleRequest { role }` | 200 `{ data: Session }`, session id regenerated, audit row | 401; 403 `ROLE_NOT_ALLOWED`, `CSRF_INVALID`; 409 `MODE_ACTIVE`; 422 |
| `POST /api/session/mode` | `EnterModeRequest { mode: 'mod_pelajar' }` | 200 `{ data: Session }` (`active.via = 'mod_pelajar'`, `mode.isTest = true`) | 401; 403 `MODE_NOT_ALLOWED`; 409 `MODE_ALREADY_ACTIVE`; 422 |
| `DELETE /api/session/mode` | none | 200 `{ data: Session }` (return role active) | 401; 409 `NO_MODE_ACTIVE` |

Rules to enforce (all from the contract and v2-portals): login by e-mail or username (+ school when the username is ambiguous); roles are a list, one active; `student` never combines with another role; `admin` is single-role; scope is derived server-side only (strict request schemas reject a client `scope`); `capabilities` come from the access matrix for the active role and scope; `landingPath` per role (`v2-frontend.md` 4.4); Mod Pelajar only for `admin` and `school_admin` (D33b); role switch blocked while a mode is on; no tokens ever returned in the body (only `csrf`).

## DB tables touched

`users`, `user_roles`, `user_scopes`, `schools` (minimal), `sessions`, `login_attempts`, `audit_events`. Passwords are stored as hashes only; IC is never stored in clear (hash + masked), see `v2-data-migration.md` section 5.

## Acceptance criteria

1. Every case in the table above is covered by a supertest test, and every success body parses with `SessionSchema`.
2. The exact BM messages of `AUTH_ERROR_MESSAGES` are returned; invalid credentials never reveal whether the account exists.
3. After N failed attempts per identifier+IP (config `THROTTLE_LOGIN_PER_MINUTE`) the API returns 429 with `retryAfter`; a success resets it.
4. Session fixation: the session id changes on login, role switch and mode change; logout invalidates it server-side; an expired session returns 401.
5. A mutating request with a valid session but missing/incorrect `X-CSRF-Token` returns 403 `CSRF_INVALID`; GET requests do not need it.
6. `RolesGuard`/`CapabilityGuard` unit tests: a role without the capability gets 403; the guard reads the active role (not the whole list).
7. `ScopeFilter` test: a school admin of school A cannot read a school B record (404, not 403); scope is never taken from query or body.
8. A bcrypt `$2y$` hash verifies and is rehashed to argon2id on first successful login (test with a generated hash, no real hashes).
9. No password, cookie or IC appears in logs (log capture test).
10. Seeded demo accounts can log in with the demo password; inactive/suspended accounts get the right 403.

## Test commands

```
npm run be:db:migrate && npm run be:db:seed
npm run be:test -- apps/api/test/auth
npm run be:verify
npm run contract:check
```

## Migration-first (plan section 14)

- Every new table that could receive .cloud rows carries `legacy_source`, `legacy_id` and `unique (legacy_source, legacy_id)`, and is added to `apps/api/prisma/migratable-models.json`. Not in the contract.
- Enums are `text` + `check` (English codes); anything the source may lack is nullable or has a documented default.
- Add or update this entity's row in the mapping matrix (plan section 14.7) in the same PR; seeds must not set `legacy_*` and must be idempotent.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-03 (auth-session). Work in this repo clone on branch be/BE-03-auth-session, created from the latest origin/feature/v2-backend.
Read first, in order: AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10); docs/plan/backend-tasks/BE-03-auth-session.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs.
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-03 exactly as the six session endpoints in packages/contract (do not change the session contract; if something is missing write it under Open questions). Use a Postgres-backed session table with an HTTP-only cookie and X-CSRF-Token. Build AuthGuard, RolesGuard, CapabilityGuard (from @pp/contract/access) and a request-scoped ScopeContext/ScopeFilter that all later repositories must use. Port the login rules from src/modules/m01-authentication/mock/handlers/auth*.ts and the M01 SRS. Seed fictitious demo accounts from docs/AKAUN-DEMO.md. This card needs a security review: list the threat model checks you covered in the PR.
```
