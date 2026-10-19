# ADR-0020: Backend stack (NestJS 11, ESM, Vitest + SWC, pino, zod env)

- **Status:** Accepted (BE-01)
- **Date:** 2026-10-19
- **Related:** ADR-0018 (contract-first shared schemas), `docs/architecture/v2-backend-plan.md` sections 3, 4, 11; card `docs/plan/backend-tasks/BE-01-scaffold-ci.md`. ADR-0019 is the frontend SPM intake decision, so this one is 0020.

## Context
The backend lives in this repository as the npm workspace `apps/api` (`@pp/api`, OD-1) and consumes `@pp/contract`, which ships ESM TypeScript source (`main: ./src/index.ts`, extensionless relative imports, zod 4). Several developers work on it in parallel, so the cross-cutting plumbing must be fixed once.

## Decision
Confirmed versions (exact pins, checked on 2026-10-19):

| Area | Choice | Version |
|---|---|---|
| Runtime | Node 22 (repo `engines`; Docker image `node:22.22.2-alpine`) | local dev Node 22.16 also works |
| Framework | NestJS 11 (`@nestjs/common`, `core`, `platform-express`, `testing`) | 11.2.7 (the latest 12.x exists; plan says default stays 11) |
| Config | `@nestjs/config` + zod env schema (`apps/api/src/common/config/env.schema.ts`) | 4.0.4 |
| Logging | `nestjs-pino` (JSON to stdout, redaction, `requestId`) with `pino` / `pino-http` | 5.3.1 / 10.4.0 / 11.0.0 |
| Validation | in-house `ZodValidationPipe` using the `@pp/contract` schemas (no Nest-zod adapter) | zod 4.6.5 (same as the contract) |
| Errors | one `AllExceptionsFilter` producing the contract `ErrorBody` with `requestId`; generic messages equal the mock's `DEFAULT_ERROR_MESSAGES` | n/a |
| Tests | Vitest 5 + `unplugin-swc` (decorator metadata) + supertest | unplugin-swc 2.0.0, supertest 7.3.1 |
| Compiler | SWC (`@swc/core`) for tests and for the production build | 1.15.47 (see below) |
| Build | `vite build` in SSR mode (`apps/api/vite.build.config.ts`) to one ESM bundle `dist/main.js` | vite 8.3.1 |

Choices:
1. **ESM only** (`"type": "module"`), TypeScript strict, `experimentalDecorators` + `emitDecoratorMetadata`. Cross-cutting code is in `apps/api/src/common/**`; feature modules register through one-line registries (`src/modules/index.ts`, `prisma/seed/index.ts`).
2. **How `@pp/contract` is imported at runtime:** in Vitest and in `tsc` it resolves to the TypeScript source directly. In production the contract is **bundled into `dist/main.js`** (`ssr.noExternal: ['@pp/contract']`), because Node cannot run its extensionless TypeScript imports. All other dependencies stay external and are installed with `npm ci --omit=dev -w @pp/api`. The `tsup` fallback of the plan was not needed (it was tried first but `unplugin-swc` does not work as an esbuild plugin; Vite/Rolldown does). The contract package itself is unchanged.
3. **SWC instead of esbuild** because Nest dependency injection needs `emitDecoratorMetadata`, which esbuild does not emit.
4. **`@swc/core` is pinned to 1.15.47 through a root `overrides` entry.** Version 1.16.18 refuses to load its native binding on a Windows machine whose `C:\` ACL grants replacement rights to "Authenticated Users" (ERR_SWC_NATIVE_CACHE). The pin can be lifted when that is fixed upstream or the machines change.
5. **Logs go to stdout only** (the container root file system is read-only); `cookie`, `authorization`, `x-csrf-token`, `set-cookie` and any `password` field are redacted.
6. Request id: `X-Request-Id` is accepted when it matches `[A-Za-z0-9._-]{1,128}`, otherwise a UUID is generated; it is echoed in the response header and in every error body.
7. `GET /api/health` is liveness only (no DB). Timestamps use the contract `+08:00` form.
8. Malformed JSON and `BadRequestException` map to `422 VALIDATION_ERROR` (the contract has no 400 code).

## Alternatives considered
- **CommonJS Nest build:** cannot import the ESM contract cleanly. Rejected (plan section 3).
- **Jest + `@swc/jest`:** the fallback in the plan; not needed, Vitest with `unplugin-swc` works.
- **`tsup` for the API build:** esbuild cannot emit decorator metadata and the `unplugin-swc` esbuild adapter fails to resolve workspace packages. Rejected in favour of Vite SSR.
- **Compiling the contract to `dist/` for the API only:** extra build step and a second source of truth for imports. Rejected while bundling works.
- **NestJS 12:** newer major available; the plan says default stays 11 unless the lead decides otherwise.

## Consequences
- `npm run be:build` produces `apps/api/dist/main.js`; production runs `node dist/main.js` with only the production dependencies and no TypeScript at runtime.
- Any new contract folder is picked up by the bundle automatically.
- The root `overrides` entry for `@swc/core` is part of `package.json`; remove it when the upstream binding issue is gone.
