# ADR-0018: Contract-first API types as a shared zod package that emits OpenAPI

- **Status:** Proposed
- **Date:** 2026-10-16
- **Related:** TRACKER D28(b), D32(c); ADR-0004 (mock service layer), ADR-0014 (store ownership); `docs/architecture/v2-data-migration.md` §4; `docs/architecture/v2-frontend.md` §8

## Context
- The frontend is built first against a mock; the NestJS + PostgreSQL backend is built later, split across several PCs and handed out through GitHub issues. Types today are re-declared per module (`src/modules/*/api/types.ts`, `src/stores/session-types.ts` duplicates the mock's `UserMe`), which drifts.
- The migration analysis lists contract realignments for M01, M02 and M05 before backend work.
- The transport seam (ADR-0004) already allows swapping the mock for `HttpTransport`.

## Decision
1. **A workspace package `packages/contract`** (name `@pp/contract`, npm workspaces) is the single source of API truth: zod schemas for requests, responses, enums, the envelope and error format, the session and the access matrix; TypeScript types are `z.infer` of those schemas.
2. **OpenAPI 3.1 is generated** from the schemas (`zod-to-openapi` or equivalent) into `packages/contract/openapi.json`, committed, and diffed in CI (breaking-change check) so reviewers see contract changes as a file diff.
3. **Mock handlers validate** every request body/query against the schema, and in dev and test also validate every response, so the mock cannot drift from the contract. Module `api/` functions import types from `@pp/contract`; per-module `types.ts` files re-export from it as modules are touched.
4. **NestJS consumes the same package** (zod pipes for DTO validation, for example `nestjs-zod`, and the access matrix for guards) by package or git dependency; the backend repo may also read `openapi.json`. Whether the backend lives in this repo or a separate one is a devops decision; the package is publishable either way.
5. **Conformance suite:** the scenarios used to test mock handlers are written against the HTTP contract (vitest + a transport parameter) so the same suite later runs against NestJS (V2-T30).
6. **Conventions kept from the prototype:** `{ data }`, `{ data, meta }`, `{ error: { code, message, fields?, retryAfter? } }`, `+08:00` timestamps, English enum codes, BM labels in the UI only, opaque ids. Added: `requestId` on errors, cookie session plus CSRF header (ADR-0016/0017).
7. **Hybrid transport:** `VITE_API_MODE=hybrid` routes configured path prefixes to the real API and the rest to the mock, so backend domains can go live one at a time (V2-T31).

## Alternatives considered
- **OpenAPI hand-written YAML first, generate code both sides:** language-neutral, but generating idiomatic NestJS controllers is awkward and YAML review is slower than TypeScript. Rejected.
- **NestJS code-first (swagger decorators) as source:** the backend does not exist yet and the frontend must not wait. Rejected.
- **Keep per-module types:** status quo, drifts. Rejected.
- **tRPC / GraphQL:** a different protocol from the REST shape every SRS specifies. Rejected.

## Consequences
- A new package, a build step for OpenAPI, and a CI diff gate. Small cost, paid once (V2-T06, V2-T30).
- Module owners keep owning their domain schemas (ADR-0014): the schema for a store lives in `packages/contract/src/<domain>/` and is edited only by the owner module's task.
- Zod validation cost in dev/test responses is acceptable; it is off in the production build.
- If the user later prefers a Java/other backend, the generated OpenAPI is still usable.
