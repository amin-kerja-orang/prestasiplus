# BE-31 Contract conformance suite and OpenAPI breaking-change gate

| Field | Value |
|---|---|
| Size | M |
| Lane | PC-6 (folders: sessions.md section 5) |
| Priority | P0 |
| Wave | starts after BE-03; grows with every domain card (finish in wave 4) |
| Depends on | BE-03 (then add each domain as it lands) |
| Parallel with | all domain cards |
| Owner module | platform / contract (V2-T29, V2-T30) |

## Goal

Make the contract the acceptance test for both implementations: a suite of HTTP-level scenarios with a **pluggable transport** that can run against the mock (in the frontend repo's test runner) and against the NestJS API in CI, plus a CI gate that reports breaking changes in `openapi.json`.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/adr/0018-contract-first-shared-schemas.md` (items 3, 5), `docs/architecture/v2-frontend.md` section 6 (steps 2, 5, 6)
- `packages/contract/**` (schemas, `openapi.json`, emit/check scripts), `src/api/transport.ts`, `src/api/http-transport.ts`, `src/mock/server/__tests__/server.test.ts`
- Existing mock handler tests: `src/modules/*/__tests__/mock/**`
- BE-03 outputs (auth scenarios), `.github/workflows/api.yml` (BE-01)

## Outputs

- `packages/contract-tests/` (new workspace package `@pp/contract-tests`; the root `workspaces` glob `packages/*` already includes it): scenario definitions written against a minimal `HttpClient` interface (`request(method, path, body, headers) -> {status, headers, body}`); helpers for session login with CSRF; a runner that, for every registered path in `openapi.json`, asserts that every scenario response parses with the contract schema
- `apps/api/test/conformance/run.spec.ts` (+ shared helpers): runs the suite against the Nest app (supertest adapter) on the seeded database
- A mock adapter owned by the frontend lead (not part of this card): document the `HttpClient` interface and a sample adapter in the package README
- `.github/workflows/api.yml` step `openapi-diff` (for example `oasdiff`) comparing `packages/contract/openapi.json` with the base branch version (`git show origin/<base>:packages/contract/openapi.json`); breaking changes fail the check unless the PR carries the label `contract-breaking`
- Scenario files per domain are added by each domain card in `apps/api/test/conformance/<domain>/` (new files only); first scenarios: auth and session from BE-03; later: intake (upload, batch status, accept, forbidden roles) and paper builder as BE-37 to BE-39 merge
- README of the package: "every later BE card adds its scenarios here"

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `packages/contract-tests/**`, `apps/api/test/conformance/**`.
- Prisma file(s): none (no schema change).
- Contract: none.
- Seeds: none.
- Tests: `apps/api/test/conformance/**`.
- Other files: `.github/workflows/api.yml` (one `openapi-diff` step; the file is PC-1's); `package-lock.json` (new workspace package).
- Append-only shared files (one line each, never reorder): `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: PC-6 owns `apps/api/test/conformance/**`; other lanes add only new files in their own sub-folder. No Prisma file.
- **Exception needing the lead's approval in the PR (outside the lane list):** `packages/contract-tests/**` and the `openapi-diff` step in `.github/workflows/api.yml` are outside the PC-6 list of sessions.md section 5; the lead approves both in the PR (add them to the PC-6 list when merging).

## Endpoints

None.

## DB tables touched

None (runs on the seeded test database).

## Acceptance criteria

1. The suite runs in CI against the Nest app and passes for the BE-03 scenarios: login success, wrong password, unknown user (identical response), throttle (6th attempt 429 with `retryAfter`), role switch, Mod Pelajar enter/exit, logout, and a missing-CSRF 403 `CSRF_INVALID`.
2. A coverage report lists every operation in `openapi.json` and whether a scenario touches it; the CI summary prints the covered percentage. The failure threshold is the environment variable `CONFORMANCE_MIN_COVERAGE` (default 0 until wave 4; the lead sets 100 for carded domains then).
3. Negative test: a controller that returns a field violating its response schema makes a conformance test fail (a test-only controller proves it).
4. The breaking-change gate fails on removing a field, narrowing an enum and making an optional field required, and passes on additive changes; two sample diffs are demonstrated in the PR (one failing, one passing).
5. A scenario helper asserts that no response body in the suite contains a key starting with `legacy_` (plan 14.2: never exposed).
6. Every domain already merged when this card is built (for example files, users, schools, account, curriculum, content) gets one smoke scenario file in `apps/api/test/conformance/<domain>/` (one happy-path call per route group plus one 401 and one 403), so no merged domain is left uncovered; later cards add their own.
7. The `HttpClient` interface is small enough that the lead can implement a mock adapter in under 50 lines; the README contains that example (lines counted in the PR).

## Test commands

```
npm run be:test -- apps/api/test/conformance
npm run contract:check
npm run be:verify
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green. Paste the real tail of the output in the PR.
3. This card is the conformance suite itself: its own scenarios are the BE-03 auth and session scenarios of acceptance criterion 1, and `npm run be:test -- apps/api/test/conformance` must pass in CI and be documented in the package README as the command every later card runs.
4. This card creates no tables; the migration-first checklist (plan section 14.9) does not apply, but no change may break `npm run be:lint:migration` (once BE-34 is merged).
5. No security review is required; list any security-relevant decision in the PR anyway.
6. The card's tracker row is updated (status, PR number, one-line note) and the PR description follows the template in `docs/plan/backend-tasks/README.md`. Nothing stays only on your PC (AGENT-SYNC.md section 4).

## Open questions

Do not guess these; write your working assumption in the PR and ask the lead (issue labelled `question`) if it blocks you.

1. Domains merged before BE-31 (cards that finished early) get smoke scenarios from this card (criterion 6). Confirm that is acceptable, or name the lane that should add them.
2. Which tool for the breaking-change gate (`oasdiff` is the working assumption)? Confirm it runs offline in CI.
3. Should the suite also run against the mock in the frontend repo's runner? The adapter is the lead's; this card only documents the interface.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-31 (conformance-suite). Work in this repo clone on branch be/BE-31-conformance-suite, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-31-conformance-suite.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-31. Create @pp/contract-tests with transport-agnostic scenarios and a Nest supertest adapter, add the openapi-diff breaking-change gate to the CI workflow, and a coverage report of operations vs scenarios. Do not edit the frontend; document the mock adapter interface for the lead. Every later BE card must add its scenarios here; put that instruction in the package README.
```
