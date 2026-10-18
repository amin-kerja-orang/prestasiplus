# BE-01 Scaffold the NestJS app and backend CI

| Field | Value |
|---|---|
| Size | M |
| Wave | 0 (foundation) |
| Depends on | none (first card) |
| Parallel with | BE-14 (starts after BE-01 merges) |
| Owner module | platform |

## Goal

Create `apps/api` (NestJS 11, TypeScript strict, ESM) as an npm workspace package `@pp/api` with the cross-cutting plumbing every later card uses: validated config, structured logging with `requestId`, the contract-shaped error filter, the zod validation pipe, a health endpoint, root scripts, a Dockerfile, and a GitHub Actions workflow. No business endpoints.

## Inputs (read these)

- `docs/architecture/v2-backend-plan.md` sections 3, 4, 9, 11
- `package.json` (root `workspaces`, `engines`, scripts), `tsconfig.json`, `eslint.config.ts`
- `packages/contract/package.json`, `packages/contract/src/index.ts`, `packages/contract/src/common/{error,envelope,ids,time}.ts`, `packages/contract/README.md`
- `compose.yaml`, `docker/frontend/Dockerfile`, `docs/ops/containers.md`, `.env.example`, `.gitignore`

## Outputs

- `apps/api/**` as laid out in plan section 4 (only `common/` and a `health` module are populated)
- Root `package.json`: `"workspaces": ["packages/*", "apps/*"]` and the `be:*` scripts of plan section 4
- `docker/api/Dockerfile` (multi-stage, `node:22.22.2-alpine`, non-root, compatible with a read-only rootfs, health check)
- `compose.yaml`: uncomment and adapt the `api` service (its `depends_on: db` is activated in BE-02)
- `.env.api.example` (placeholders only); `.gitignore` additions for `.env.api` and `.env.db`
- `.github/workflows/api.yml` (path-filtered: `apps/api/**`, `packages/**`, `docker/api/**`, `compose.yaml`): `npm ci`, `contract:check`, lint, typecheck, test, docker build, secret scan (gitleaks)
- `docs/adr/0020-backend-stack.md` (confirmed versions and the choices of plan section 3)
- `docs/architecture/v2-backend-deviations.md` (empty log with a header)

## Endpoints

| Method and path | Response |
|---|---|
| `GET /api/health` | `200 { data: { status: 'ok', time } }`, no auth, no DB check yet |

Cross-cutting behaviour (tested through `/api/health` and a test-only controller):

- Global prefix `api`; request id taken from `X-Request-Id` or generated, echoed in the response header and in every error body.
- `ZodValidationPipe` parses body/query with a contract schema and returns `422 VALIDATION_ERROR` with `fields` (BM messages as the contract defines). Unknown routes return `404 NOT_FOUND` in the error format; unhandled errors return `500 SERVER_ERROR` without stack traces.
- Response helpers produce `{ data }` and `{ data, meta }` (`ListMeta`) per `@pp/contract`.

## DB tables

None.

## Acceptance criteria

1. `npm ci` at the root succeeds on a clean clone and installs `@pp/api`; the existing frontend `npm run typecheck` and `npm test` still pass.
2. Importing `@pp/contract` works in `apps/api` at runtime and in Vitest (a proof test parses a `LoginRequest` with a contract schema). If importing the ESM TypeScript source fails, the documented fallback (a `tsup` build of the contract for the API) is used and recorded in ADR-0019.
3. `GET /api/health` returns the envelope; an invalid body to the test controller returns the exact error shape with `requestId`; 404 and 500 use the error shape.
4. Env validation fails fast with a readable message when a required key is missing; `.env.api.example` lists every key of plan section 11 that exists at this point.
5. Logs are JSON, include `requestId`, and redact `cookie`, `authorization`, `password`.
6. `docker build -f docker/api/Dockerfile .` succeeds and the container runs as a non-root user.
7. The GitHub workflow is valid and runs all steps; the secret scan is demonstrated on a throw-away branch (documented in the PR, nothing left in the repo).
8. No file contains a secret or a real name.

## Test commands

```
npm ci
npm run be:verify
npm run typecheck && npm test        # the frontend must stay green
docker build -f docker/api/Dockerfile -t pretasiplus-api:local .
```

## Programme update (2026-10-19)

- Create the append-only registries other lanes extend, one line per addition: `apps/api/src/modules/index.ts` (module registry imported by `app.module.ts`), `apps/api/prisma/seed/index.ts` (seed registry), and commented per-lane blocks in `.env.api.example`. Also create `apps/api/test/conformance/` as an empty folder with a README (BE-31 fills it). See [../sessions.md](../sessions.md) section 5.
- The backend stack ADR is `docs/adr/0020-backend-stack.md` (0019 is the frontend SPM intake ADR).
- Add the tracker rule to the PR template check: the card row in `docs/plan/backend-tracker.md` is updated in the PR.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-01 (scaffold-ci). Work in this repo clone on branch be/BE-01-scaffold-ci, created from the latest origin/feature/v2-backend.
Read first, in order: AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10); docs/plan/backend-tasks/BE-01-scaffold-ci.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs.
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: scaffold apps/api per BE-01. Confirm the stack in plan section 3 (NestJS 11, Vitest with unplugin-swc, nestjs-pino, @nestjs/config with a zod env schema) and write ADR-0019. Prove that @pp/contract can be imported from apps/api (ESM). Implement the error filter, ZodValidationPipe, request-id middleware, response helpers and the health controller, the root be:* scripts, the Dockerfile, the compose api service, and .github/workflows/api.yml. Keep the root typecheck/lint/test of the frontend green. Do not add business endpoints.
```
