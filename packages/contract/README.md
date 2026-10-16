# @pp/contract

Zod schemas (source of truth) and the generated OpenAPI 3.1 file `openapi.json` (ADR-0018).

- `npm run contract:emit` regenerates `openapi.json`; `npm run contract:check` fails if it is stale.
- Import `z` from `src/zod.ts`, never from `'zod'` (it patches zod for OpenAPI first).
- Register new shared schemas in `COMPONENT_SCHEMAS` (`src/openapi.ts`).
- Envelopes: `envelopeOf(item)` gives `{ data }`, `listEnvelopeOf(item)` gives `{ data, meta }`; each
  endpoint registers its own concrete envelope (`IdEnvelope` and `IdListEnvelope` are examples).

Contract-first API schemas (zod) and the generated OpenAPI 3.1 (`openapi.json`), shared by the frontend, the mock and the future NestJS backend (ADR-0018).

- Import `z` from `../zod`, never from `'zod'` (the OpenAPI extension must be applied first).
- After any schema change run `npm run contract:emit`; `npm run contract:check` (and the contract tests) fail when `openapi.json` is stale.
- Domain tasks append their components to `COMPONENT_SCHEMAS` and register their paths in `src/openapi.ts`.

## Session contract (V2-T07)

Files: `src/session/{scope,session,paths}.ts`, `src/auth/{login,errors}.ts`. Design: `docs/architecture/v2-frontend.md` 4.3, ADR-0017.

| Endpoint | Request | Success | Errors |
|---|---|---|---|
| `POST /auth/login` | `LoginRequest { identifier (e-mail or username), password, schoolId?, remember }` | 200 `{ data: Session }` | 401 `INVALID_CREDENTIALS`; 403 `ACCOUNT_INACTIVE`, `SCHOOL_INACTIVE`; 422 `VALIDATION_ERROR`, `AMBIGUOUS_USERNAME` (`details.schools`); 429 `RATE_LIMITED` |
| `POST /auth/logout` | none | 204 | 401 |
| `GET /session` | none | 200 `{ data: Session }` | 401 |
| `POST /session/role` | `SwitchRoleRequest { role }` | 200 `{ data: Session }` | 401; 403 `ROLE_NOT_ALLOWED`; 409 `MODE_ACTIVE`; 422 |
| `POST /session/mode` | `EnterModeRequest { mode: 'mod_pelajar' }` | 200 `{ data: Session }` | 401; 403 `MODE_NOT_ALLOWED`; 409 `MODE_ALREADY_ACTIVE`; 422 |
| `DELETE /session/mode` | none | 200 `{ data: Session }` (return role active) | 401; 409 `NO_MODE_ACTIVE` |

Rules encoded in the schemas (`SessionSchema` cross-field checks):

- Roles: English codes; `roles` is a non-empty unique list, one active. `student` never combines with another role; `admin` is single-role. `portal` is a function of the role (`ROLE_PORTAL`).
- Scope is server-derived: it appears only in responses (`RoleGrant.scope`, `ActiveRole.scope`). Every request schema is strict, so a client-sent `scope` (or `role` on login) is rejected. `ppd_officer` gets `district` in v2.0; `state` is kept open.
- Mod Pelajar (`mode.kind = 'mod_pelajar'`, `canEnterModPelajar`): `admin` and `school_admin` only (D33b). The session then acts as the account itself as `student` with `self` scope (`active.via = 'mod_pelajar'`), `mode.returnRole` is the role to return to and `mode.isTest` is always `true` (data written is test data). `mode` is `null` in normal operation. Role switching is blocked while a mode is on.
- `capabilities` is a plain list of capability keys for now; V2-T08 (access matrix) replaces it with key to access mode.
- Error messages (BM) are in `AUTH_ERROR_MESSAGES`; the first three are the exact live copy (AC-01.4 to AC-01.6).
