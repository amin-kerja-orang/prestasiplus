# BE-31 Contract conformance suite and OpenAPI breaking-change gate

| Field | Value |
|---|---|
| Size | M |
| Wave | starts after BE-03; grows with every domain card (finish in wave 4) |
| Depends on | BE-03 (then add each domain as it lands) |
| Parallel with | all domain cards |
| Owner module | platform / contract (V2-T29, V2-T30) |

## Goal

Make the contract the acceptance test for both implementations: a suite of HTTP-level scenarios with a **pluggable transport** that can run against the mock (in the frontend repo's test runner) and against the NestJS API in CI, plus a CI gate that reports breaking changes in `openapi.json`.

## Inputs (read these)

- `docs/adr/0018-contract-first-shared-schemas.md` (items 3, 5), `docs/architecture/v2-frontend.md` section 6 (steps 2, 5, 6)
- `packages/contract/**` (schemas, `openapi.json`, emit/check scripts), `src/api/transport.ts`, `src/api/http-transport.ts`, `src/mock/server/__tests__/server.test.ts`
- Existing mock handler tests: `src/modules/*/__tests__/mock/**`

## Outputs

- `packages/contract-tests/` (new workspace package `@pp/contract-tests`): scenario definitions written against a minimal `HttpClient` interface (`request(method, path, body, headers) -> {status, headers, body}`); helpers for session login with CSRF; a runner that, for every registered path in `openapi.json`, asserts that every scenario response parses with the contract schema
- `apps/api/test/conformance/run.spec.ts`: runs the suite against the Nest app (supertest adapter) on the seeded database
- A mock adapter owned by the frontend lead (not part of this card; document the interface in the package README)
- `.github/workflows/api.yml` step: `openapi-diff` (e.g. `oasdiff`) comparing `packages/contract/openapi.json` with the base branch; breaking changes fail the check unless the PR carries the label `contract-breaking`
- Scenario files per domain added by each domain card (the first scenarios: auth and session from BE-03)

## Endpoints

None.

## DB tables touched

None (runs on the seeded test database).

## Acceptance criteria

1. The suite runs in CI against the Nest app and passes for the BE-03 scenarios (login success/failure, throttle, role switch, Mod Pelajar, CSRF).
2. A coverage report lists every operation in `openapi.json` and whether a scenario touches it; the CI summary prints the covered percentage and does not fail below a threshold until wave 4 (then required at 100% for carded domains).
3. Introducing a response field that violates the schema in a controller makes a conformance test fail (negative test).
4. The breaking-change gate fails on removing a field, narrowing an enum or making an optional field required, and passes on additive changes (demonstrated by two sample diffs in the PR).
5. The `HttpClient` interface is small enough that the frontend lead can implement the mock adapter in under 50 lines (example included in README).

## Test commands

```
npm run be:test -- apps/api/test/conformance
npm run contract:check
npm run be:verify
```

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-31 (conformance-suite). Work in this repo clone on branch be/BE-31-conformance-suite, created from the latest origin/feature/v2-backend.
Read first, in order: AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10); docs/plan/backend-tasks/BE-31-conformance-suite.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs.
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-31. Create @pp/contract-tests with transport-agnostic scenarios and a Nest supertest adapter, add the openapi-diff breaking-change gate to the CI workflow, and a coverage report of operations vs scenarios. Do not edit the frontend; document the mock adapter interface for the lead. Every later BE card must add its scenarios here; put that instruction in the package README.
```
