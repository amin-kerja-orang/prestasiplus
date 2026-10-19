# BE-01 Scaffold the NestJS app and backend CI

| Field | Value |
|---|---|
| Size | M |
| Lane | PC-1 (folders: sessions.md section 5) |
| Priority | P0 |
| Wave | 0 (foundation) |
| Depends on | none (first card) |
| Parallel with | BE-14 (starts after BE-01 merges) |
| Owner module | platform |

## Goal

Create `apps/api` (NestJS 11, TypeScript strict, ESM) as an npm workspace package `@pp/api` with the cross-cutting plumbing every later card uses: validated config, structured logging with `requestId`, the contract-shaped error filter, the zod validation pipe, a health endpoint, root scripts, a Dockerfile, and a GitHub Actions workflow. No business endpoints.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md` (claim, commit, push rules), `docs/plan/sessions.md` section 5 (folder ownership and the append-only shared files), `docs/plan/backend-tracker.md`
- `docs/architecture/v2-backend-plan.md` sections 3, 4, 9, 11 (and 14 for the registries and the migration conventions later cards rely on)
- `package.json` (root `workspaces`, `engines`, scripts), `tsconfig.json`, `eslint.config.ts`
- `packages/contract/package.json`, `packages/contract/src/index.ts`, `packages/contract/src/common/{error,envelope,ids,time}.ts`, `packages/contract/src/auth/login.ts`, `packages/contract/README.md`
- `src/mock/server/respond.ts` (`DEFAULT_ERROR_MESSAGES`: the generic error copy to reproduce)
- `compose.yaml`, `docker/frontend/Dockerfile`, `docs/ops/containers.md`, `.env.example`, `.gitignore`
- Prerequisites: OD-1 (backend lives in this repo as a workspace) and OD-3 (NestJS 11 + Prisma + Vitest) are settled by the S0 defaults in the lead notice of `docs/plan/AGENT-SYNC.md`. If the lead changes them, stop and ask.
- Requirements: BE-FR-31, BE-FR-34; BE-NFR-07, BE-NFR-09, BE-NFR-22, BE-NFR-27; BE-OPS-01, BE-OPS-03, BE-OPS-06, BE-OPS-08 ([URS 9.2](../../requirements/v2-backend-urs.md))
- API catalogue part B1 (core, identity, curriculum): [core-identity-curriculum.md](../../architecture/v2-api-catalogue/core-identity-curriculum.md) (endpoint list, wire conventions and open questions for this card's scope)

## Outputs

- `apps/api/**` as laid out in plan section 4. Only these are populated: `src/main.ts`, `src/app.module.ts`, `src/common/**` (config, logging, error filter, zod pipe, request id, response helpers, `common/health/`), `package.json`, `tsconfig.json`, `vitest.config.ts`.
- **Registries that other lanes extend with one line each:** `apps/api/src/modules/index.ts` (module registry imported by `app.module.ts`), `apps/api/prisma/seed/index.ts` (seed registry, empty list), commented per-lane blocks in `.env.api.example`.
- `apps/api/test/conformance/` as an empty folder with a `README.md` (BE-31 fills it).
- Root `package.json`: `"workspaces": ["packages/*", "apps/*"]` and the `be:*` scripts of plan section 4 (`be:dev`, `be:build`, `be:lint`, `be:typecheck`, `be:test`, `be:db:*`, `be:verify`); `be:db:*` may print "not configured until BE-02".
- `docker/api/Dockerfile` (multi-stage, `node:22.22.2-alpine`, non-root, compatible with a read-only rootfs, health check).
- `compose.yaml`: uncomment and adapt the `api` service (its `depends_on: db` is activated in BE-02).
- `.env.api.example` (placeholders only); `.gitignore` additions for `.env.api` and `.env.db`.
- `.github/workflows/api.yml` (path-filtered: `apps/api/**`, `packages/**`, `docker/api/**`, `compose.yaml`): `npm ci`, `contract:check`, lint, typecheck, test, docker build, secret scan (gitleaks).
- `docs/adr/0020-backend-stack.md` (confirmed versions and the choices of plan section 3; 0019 is the frontend SPM intake ADR).
- `docs/architecture/v2-backend-deviations.md` (empty log with a header: date, item, mock/contract/doc said, API does, why, who agreed).

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/**`, `package.json`, `package-lock.json`, `docker/api/**`, `compose.yaml`, `.env.api.example`, `.gitignore`, `.github/workflows/api.yml`, `docs/adr/0020-backend-stack.md`, `docs/architecture/v2-backend-deviations.md`.
- Prisma file(s): none (no schema change).
- Contract: none.
- Seeds: none.
- Tests: `apps/api/test/**`.
- Append-only shared files (one line each, never reorder): `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: BE-01 is the first card and the only one that creates the scaffold; nothing else can start before it merges (BE-14 starts after it).

## Endpoints

| Method and path | Response |
|---|---|
| `GET /api/health` | `200 { data: { status: 'ok', time } }`; `time` is a contract `Timestamp` (ISO 8601 with `+08:00`); no auth, no cookie, no DB check yet |

There is no mock route for it (new). Cross-cutting behaviour, tested through `/api/health` and a test-only controller that is not registered in production:

- Global prefix `api`; request id taken from `X-Request-Id` or generated, echoed in the response header and in every error body.
- `ZodValidationPipe` parses body and query with a contract schema; failure gives `422 VALIDATION_ERROR` with `fields`.
- Unknown routes give `404 NOT_FOUND`; unhandled errors give `500 SERVER_ERROR` without a stack trace.
- Generic error messages are exactly the mock's `DEFAULT_ERROR_MESSAGES` (`src/mock/server/respond.ts`): `VALIDATION_ERROR` "The given data was invalid.", `NOT_FOUND` "Not Found.", `SERVER_ERROR` "Server Error", `UNAUTHORIZED` "Unauthenticated.", `FORBIDDEN` "This action is unauthorized.", `CONFLICT` "Conflict.", `RATE_LIMITED` "Too Many Attempts.". Module-specific messages are the BM copy of the mock handler (see each card).
- Response helpers produce `{ data }` and `{ data, meta }` (`ListMeta`) per `@pp/contract`.

## DB tables

None.

## Acceptance criteria

1. `npm ci` at the root succeeds on a clean clone and installs `@pp/api`; root `npm run typecheck` and `npm test` (frontend) still pass. Proof: CI job output.
2. `@pp/contract` imports in `apps/api` at runtime (`node dist/main.js` boots) and in Vitest: `apps/api/test/contract-import.spec.ts` parses a valid `LoginRequest` (`{ identifier, password, remember }`) and rejects an unknown extra key. If importing the ESM TypeScript source fails, the documented fallback (a `tsup` build of the contract for the API) is used and recorded in ADR-0020.
3. `GET /api/health` returns the envelope; `data.time` parses with `TimestampSchema`; the response sets no cookie.
4. Supertest cases, each response parsed with `ErrorBodySchema` and carrying `error.requestId` equal to the `X-Request-Id` response header: invalid body to the test controller gives 422 `VALIDATION_ERROR`, message "The given data was invalid." and a non-empty `fields` map; an unknown path gives 404 `NOT_FOUND` "Not Found."; a controller that throws gives 500 `SERVER_ERROR` "Server Error" and the body contains no stack trace (no `at ` frames, no file paths).
5. A request with `X-Request-Id: abc-123` is echoed unchanged; a request without one gets a generated id (UUID) in the header.
6. Env validation: a unit test calls the config loader with each required key missing and expects an error that names the key. A second test proves every key in `.env.api.example` is declared in the zod env schema and vice versa; the file lists every key of plan section 11 that exists at this point.
7. Logs are JSON and include `requestId`; a log-capture test proves `cookie`, `authorization` and `password` values never appear.
8. `docker build -f docker/api/Dockerfile -t pretasiplus-api:local .` succeeds; `docker run --rm --entrypoint id pretasiplus-api:local -u` prints a non-zero uid; the container starts with `--read-only --tmpfs /tmp` and its health check reports healthy.
9. Registries exist and are wired: a test adds a dummy Nest module through one line in `apps/api/src/modules/index.ts` and a dummy seed through one line in `apps/api/prisma/seed/index.ts`; `.env.api.example` contains one commented block per lane (PC-1 to PC-6); `apps/api/test/conformance/README.md` exists.
10. `npm run be:verify` from the root runs contract:check, lint, typecheck, test and build in that order and exits 0 on a clean clone.
11. The GitHub workflow is valid and runs all listed steps; the secret scan is demonstrated on a throw-away branch (documented in the PR, nothing left in the repo).
12. No file contains a secret or a real person's name (gitleaks green).

## Test commands

```
npm ci
npm run be:verify
npm run typecheck && npm test        # the frontend must stay green
docker build -f docker/api/Dockerfile -t pretasiplus-api:local .
docker run --rm --entrypoint id pretasiplus-api:local -u
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green. Paste the real tail of the output in the PR.
3. This card has no HTTP endpoints, so it adds no conformance scenarios; after BE-31 merges, `npm run be:test -- apps/api/test/conformance` must still pass.
4. This card creates no tables; the migration-first checklist (plan section 14.9) does not apply, but no change may break `npm run be:lint:migration` (once BE-34 is merged).
5. No security review is required; list any security-relevant decision in the PR anyway.
6. The card's tracker row is updated (status, PR number, one-line note) and the PR description follows the template in `docs/plan/backend-tasks/README.md`. Nothing stays only on your PC (AGENT-SYNC.md section 4).

## Open questions

None known. If you meet a rule that neither the mock, the SRS nor this card states, do not invent it: write it under "Open questions" in the PR, and open a GitHub issue labelled `question` if it blocks you.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-01 (scaffold-ci). Work in this repo clone on branch be/BE-01-scaffold-ci, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-01-scaffold-ci.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: scaffold apps/api per BE-01. Confirm the stack in plan section 3 (NestJS 11, Vitest with unplugin-swc, nestjs-pino, @nestjs/config with a zod env schema) and write ADR-0020 (docs/adr/0020-backend-stack.md; 0019 is the frontend's). Prove that @pp/contract can be imported from apps/api (ESM). Implement the error filter, ZodValidationPipe, request-id middleware, response helpers and the health controller, the root be:* scripts, the Dockerfile, the compose api service, and .github/workflows/api.yml. Keep the root typecheck/lint/test of the frontend green. Do not add business endpoints. Also create the registries (apps/api/src/modules/index.ts, apps/api/prisma/seed/index.ts, the per-lane blocks in .env.api.example) and the empty apps/api/test/conformance/ with a README, exactly as the card's Outputs say.
```
