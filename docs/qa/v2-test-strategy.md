# v2 Test Strategy (slug: v2-test-strategy)

- **Owner:** QA lead (`qa-engineer` role). **Audience:** every PC and Claude Code session that builds, reviews or tests v2.
- **Status:** Proposed. Becomes binding when the lead approves it. Open questions are in section 9.
- **Scope:** the Vue 3 + Nuxt UI frontend (in-browser mock), the NestJS 11 + Prisma + PostgreSQL backend (cards BE-01..BE-40), the shared `@pp/contract` package, and the data migration from the old .cloud system.
- **Sources:** [CLAUDE.md](../../CLAUDE.md) (gates G1-G6, tracks, responsive rule), [AGENTS.md](../../AGENTS.md), [v2-backend-plan](../architecture/v2-backend-plan.md) (6.2, 9, 10, 14.6), [v2-backend-urs](../requirements/v2-backend-urs.md) (BE-NFR, BE-MIG, BE-OPS and verification codes), [v2-data-migration](../architecture/v2-data-migration.md), cards [BE-01](../plan/backend-tasks/BE-01-scaffold-ci.md), [BE-02](../plan/backend-tasks/BE-02-db-orm.md), [BE-03](../plan/backend-tasks/BE-03-auth-session.md), [BE-30](../plan/backend-tasks/BE-30-migration-reconcile-rehearsal.md), [BE-31](../plan/backend-tasks/BE-31-conformance-suite.md), [BE-32](../plan/backend-tasks/BE-32-http-switch-e2e.md), [BE-33](../plan/backend-tasks/BE-33-hardening-release.md), [BE-35](../plan/backend-tasks/BE-35-anonymiser-fixtures.md).
- **Siblings (written in parallel):** [fullstack-integration-guide](../plan/fullstack-integration-guide.md), [frontend-dev-guide](../plan/frontend-dev-guide.md), [backend-dev-guide](../plan/backend-dev-guide.md), [onboarding](../plan/onboarding.md), [v2-api-catalogue](../architecture/v2-api-catalogue.md). This file does not repeat them; it says how things are tested and what each gate needs.

## 0. Conventions used in this document

- **Verified** command: exists in the root `package.json` of the worktree at the time of writing. **Planned (added by BE-xx)**: does not exist yet; the named card creates it. A planned command must not be quoted in a PR as "run" until its card has merged.
- Level codes match the URS: **UT** unit, **IT** integration (supertest + real PostgreSQL), **CT** contract/conformance, **SEC** security review, **CI** pipeline step, **RUN** runbook or rehearsal executed once with evidence, **PILOT** measured on a pilot sample set. This strategy adds **CMP** (component), **E2E**, **API** (Playwright request), **MIG** (migration), **PERF**.
- Evidence means real tool output (command, counts, exit status), never "should pass" (CLAUDE.md section 7).

## 1. Test pyramid and what each level proves

```
                      PILOT / RUN (rehearsal, extraction quality)         few, manual, evidence-based
                  E2E UI  (Playwright, 375/768/1280, mock + compose)       per module / per domain
              API tests (Playwright request) + security + performance      per card, per release
        CT conformance (same scenarios on mock and API)  +  MIG tests      per domain / per migration card
     IT backend integration (Testcontainers Postgres: repository, migrations, scope)
  contract tests (zod, openapi emit, breaking-change gate)   CMP (Vue)   UT (frontend + backend services)   many, fast
```

| # | Level | What it proves | What it must NOT be used for |
|---|---|---|---|
| L1 | **Unit (UT)** frontend (`src/**`, mock handlers, stores, libs) and backend services (`apps/api/src/**/*.spec.ts`) | A rule, calculation, transform or guard is right in isolation, with an injected `Clock` and seeded PRNG. | Proving DB behaviour or HTTP wiring. Backend repositories are never unit-tested with a mocked DB layer (plan section 3). |
| L2 | **Component (CMP)** Vue components with Vitest + `@vue/test-utils` in jsdom | Rendering, props/emits, states (loading, empty, error), BM copy, design-system usage. | Layout at real viewports (use E2E), or backend behaviour. |
| L3 | **Contract tests** (`packages/contract/src/**/__tests__`), `contract:check`, the breaking-change gate | Schemas parse good and reject bad input (strict), enums and ids behave, `openapi.json` equals what the schemas emit, no breaking change slips in. | Behaviour of either implementation. |
| L4 | **Backend integration (IT)** Vitest + supertest + Testcontainers PostgreSQL 16 | Each endpoint with the envelope, status codes and exact BM errors; repositories and scope filters on real SQL; migrations apply on an empty DB and on the previous head; transactions, idempotency, audit rows. | Mocking Prisma. A green IT with a mocked DB does not count. |
| L5 | **Conformance (CT)** BE-31 `@pp/contract-tests` | The **same scenario** sent to the mock and to the real API returns a contract-valid body with the same status, error code and BM message. This is what makes the per-domain http switch a no-op. | Business-rule depth (that is IT). |
| L6 | **API tests** (Playwright `request`, tag `@api`) against the compose stack | The deployed shape: nginx proxy, cookie flags, CSRF through the real origin, upload limits, headers. | Replacing IT. |
| L7 | **E2E UI** (Playwright, 3 viewports) | A user flow works end to end, on mobile 375, tablet 768 and desktop 1280 with no horizontal page scroll; mock mode and (per switched domain) compose/http mode. | Rule coverage (too slow); it traces SRS `E2E-Mnn-nn` ids. |
| L8 | **Migration tests (MIG)** BE-27..BE-30, BE-34, BE-35 | The ETL is idempotent, dry-run first, rejects (not guesses) bad rows, and the reconciliation report is green on fixtures; the rehearsal on an anonymised dump is the go/no-go (RUN). | Proving production data quality (only the lead's rehearsal does). |
| L9 | **Security checks (SEC/IT)** `apps/api/test/security`, authz matrix test, review by `security-engineer` | Default-deny, role/capability/scope, CSRF, rate limit, upload, SSRF, AI redaction, log hygiene. | Replacing the G4 human review for auth/payments/PII/uploads/new external input. |
| L10 | **Performance/NFR (PERF)** | BE-NFR-15/16 numbers on the seeded profile; frontend `*.perf.test.ts` budgets. Loose regression catchers, not load tests. | Capacity planning (no card owns it, OQ-TS-3). |
| L11 | **Accessibility** | Replicates live (D10): ARIA, keyboard, focus, reduced motion are kept as observed. | New accessibility enhancements are **out of scope** (D10, section 6 of CLAUDE.md). A finding is a bug only if it makes a control unusable on touch or text unreadable (D9). |

## 2. Per-level detail

### 2.1 Unit (frontend)

| Item | Detail |
|---|---|
| Tool | Vitest 5, project `unit` (`vitest.config.ts`). Node environment by default; jsdom only with the `// @vitest-environment jsdom` docblock (ADR-0011). |
| Location | `src/**/__tests__/**/*.test.ts`, `packages/**/__tests__/**/*.test.ts`, `scripts/**/__tests__/**/*.test.mjs`, `eslint/**/__tests__/**/*.test.mjs`. Module logic under `src/modules/<mNN-slug>/__tests__/` (mock handlers in `.../__tests__/mock/`). |
| Naming | `<subject>.test.ts`; `describe` names the unit; a test traced to a requirement starts its title with the id (section 6). |
| Data | Mock seeds and D11 virtual datasets via the mock runtime; fixed clock `TEST_NOW` from `src/mock/server/__tests__/helpers.ts`; `VITE_PROTOTYPE_SCOPE=off`, `VITE_DATA_PROFILE=full` set by the config. |
| Run (verified) | `npm test` (= `vitest run --project unit`); one file: `npx vitest run --project unit <path>`; watch: `npm run test:watch`; coverage: `npm run test:coverage`. |
| CI | Frontend CI job: **planned**, no `.github/workflows` exists in the worktree at the time of writing; BE-01 creates `.github/workflows/api.yml` (backend, path-filtered). The frontend gate today is the lead running `npm run verify` (OQ-TS-1). |
| Boot test | `src/mock/server/__tests__/registry-boot.test.ts` boots the real registry (core + all modules, 466k-question dataset, about 56 s quiet, 120 s ceiling, `BOOT_TEST_TIMEOUT_MS` overrides). It must pass before any shared-store-data change is merged back (CLAUDE.md "Shared working tree"). Run it alone: `npx vitest run --project unit src/mock/server/__tests__/registry-boot.test.ts`. |

### 2.2 Component (Vue)

| Item | Detail |
|---|---|
| Tool | Vitest + `@vue/test-utils`, jsdom docblock; Nuxt UI is inlined (`server.deps.inline`) and the virtual plugin is stubbed (`src/test-support/nuxt-ui-plugin-stub.ts`). |
| Location | `src/**/__tests__/*.test.ts` next to the component (for example `src/ds/__tests__/`). Design-system components have tests per primitive. |
| What to assert | Props/emits, states, exact BM copy, class/token hooks used by E2E. No pixel assertions. |
| Static checks that belong here | `npm run lint` (ESLint + stylelint + `lint:ds`), `npm run lint:ds`, `npm run lint:ds:css`, `npm run typecheck`, `npm run format:check`. Pages use only design-system components and theme tokens. |
| Run (verified) | Same as 2.1. |

### 2.3 Contract tests

| Item | Detail |
|---|---|
| Tool | Vitest (runs inside the root `unit` project through the `packages/**` glob), `jiti` for the emit script. |
| Location | `packages/contract/src/<domain>/` with tests in `packages/contract/src/__tests__/` (today: `common.test.ts`, `session.test.ts`, `session-rules.test.ts`) and `packages/contract/src/access/__tests__/` (`access.test.ts`, `access-doc.test.ts`). New domains add their tests beside the schemas. |
| Must cover per domain | Valid sample parses; each strict-schema violation (extra field, wrong id type, bad enum) fails; envelope and error shapes; `+08:00` timestamps; ids as opaque strings. |
| Emit gate | `npm run contract:emit` regenerates `packages/contract/openapi.json` (never hand-edited); `npm run contract:check` fails if it is stale. Both verified. |
| Breaking-change gate | **Planned (added by BE-31):** `oasdiff` (or equivalent) compares `openapi.json` with the base branch in `.github/workflows/api.yml`; a removed field, narrowed enum or optional-to-required field fails unless the PR carries the label `contract-breaking`. Demonstrated with two sample diffs in the BE-31 PR. |
| Rule | Contract first: the contract commit precedes the implementation commit (plan 6.2). A PR that changes `packages/contract/src/{common,session,auth,access}` needs the lead (both sides must agree). |

### 2.4 Backend unit and integration (IT)

| Item | Detail |
|---|---|
| Tool | Vitest (+ `unplugin-swc`) and supertest; **Testcontainers PostgreSQL 16**, fallback `docker compose` test DB on `DATABASE_URL` (BE-02). Fallback runner Jest + `@swc/jest` only if BE-01 records it. |
| Location | `apps/api/src/**/*.spec.ts` for UT; `apps/api/test/<area>/*.spec.ts` for IT (examples named in the cards: `test/auth`, `test/seed`, `test/security`, `test/conformance`, `test/migration`). |
| Naming | `<area>.spec.ts`; test title starts with the requirement id where one exists (`BE-NFR-03 ...`, `BE-03 AC5 ...`). |
| Data | Each IT file gets a throw-away database from the harness (BE-02) and either rolls back inside a transaction or truncates; the seed runner (`be:db:seed --profile=test`) provides fictitious deterministic fixtures. Time comes only from the injectable `Clock`; randomness from the seeded PRNG (BE-NFR-19/20). |
| Every endpoint test must | (1) parse the success body with the contract schema; (2) assert the exact BM `message` and `code` on each error path; (3) cover 401 (no session), 403 (wrong role), 404 (id out of scope, never 403), 403 `CSRF_INVALID` (mutation without token), 422 (strict schema, extra fields); (4) for lists, the paging `meta` and an out-of-range page returning an empty page. |
| Repository and migration tests | Repositories run on real Postgres. Migrations are tested twice in CI: applied to an empty database and applied on top of the previous head (BE-OPS-04). Never edit a merged migration. |
| Run | **Planned (added by BE-01/BE-02):** `npm run be:test` (needs Docker); one folder: `npm run be:test -- apps/api/test/auth`; `npm run be:db:migrate`, `be:db:reset`, `be:db:seed`; `npm run be:lint`, `be:typecheck`, `be:build`. |
| CI | `.github/workflows/api.yml` (BE-01): `npm ci`, `contract:check`, lint, typecheck, tests with a PostgreSQL 16 service container, `be:lint:migration`, docker build, secret scan (gitleaks), `npm audit --omit=dev` and image scan (BE-33). Triggers on `apps/api/**`, `packages/**`, `docker/api/**`, `compose.yaml`. |

### 2.5 Conformance against the mock (BE-31)

| Item | Detail |
|---|---|
| Tool | New workspace package `@pp/contract-tests` (`packages/contract-tests/`): scenarios written against a minimal `HttpClient` (`request(method, path, body, headers) -> {status, headers, body}`), a runner that checks every response against the contract schema, a supertest adapter for Nest. The **mock adapter is owned by the frontend lead** (README shows an adapter in under 50 lines). |
| Location | Scenarios per domain in `packages/contract-tests/`; runner for the API in `apps/api/test/conformance/run.spec.ts`; the mock-side runner lives in the frontend test run (`unit` project) once the lead writes the adapter. |
| What a scenario asserts | Same request, same session role, same seed intent: status code, error `code`, exact BM `message`, envelope kind, contract-valid body, no `legacy_*` key anywhere in a body. Values that depend on the seed (ids, counts) are not compared across implementations; shapes and rules are. |
| Coverage | A report lists every operation in `openapi.json` and whether a scenario touches it. Not failing below a threshold until wave 4; then **100% of carded domains** is required (BE-31 AC2). |
| Negative test | A controller returning a field outside the schema must make a conformance test fail (BE-31 AC3). |
| Rule | Every later BE card adds its scenarios here (package README). First scenarios: auth and session (BE-03): login success/failure, throttle, role switch, Mod Pelajar, CSRF. Intake and paper-builder scenarios are added as BE-37..BE-39 merge. |
| Run | **Planned (added by BE-31):** `npm run be:test -- apps/api/test/conformance`. |

### 2.6 API tests (Playwright request)

| Item | Detail |
|---|---|
| Tool | `@playwright/test` `request` fixture in the http-mode config (`playwright.http.config.ts`, **planned, added by BE-32**) against `docker compose up -d --build` on one origin (`http://localhost:5192`). |
| Use for | Properties only visible through nginx: `HttpOnly; SameSite=Lax` cookie, same-origin `/api` proxy, upload size/timeouts, security headers. The same specs carry the tag `@api`. |
| Not for | Rule coverage; that is IT. |

### 2.7 E2E UI (Playwright)

| Item | Detail |
|---|---|
| Tool | `@playwright/test` ^1.63, `playwright.config.ts`: projects **mobile 375x812**, **tablet 768x1024**, **desktop 1280x800**; locale `ms-MY`, timezone `Asia/Kuala_Lumpur`; `fullyParallel`; CI: one retry, `forbidOnly`, html report; trace `retain-on-failure`. Web server: `npm run build:e2e` then `vite preview` on port 4173. |
| Location | `e2e/<mNN-slug>/*.spec.ts` (one folder per module), `e2e/global/*.spec.ts` (`@smoke`: harness, guards, not-found, prototype scope, user shell, cross-tab), helpers in `e2e/fixtures/` (`test.ts`, `mock-page.ts`, `mock-handle.ts`) and `e2e/support/` (`act-as.ts`, `assertions.ts`, `viewport.ts`, `tags.ts`, `probe-route.ts`). |
| Rules | Every spec runs on all three projects; branch on viewport helpers, never on project name. Navigate with the `gotoApp` fixture (own 15 s boot budget, `expect` keeps 5 s). Never delete or edit a spec to hide a failure; exclude mock-only specs from http runs by **tag**. |
| Tags and ids | Title starts with the SRS id (`E2E-M06-31 ...`), tag `@mNN`; `@provisional` (via `provisional(reason)`) for unobserved or proposed behaviour; `@smoke`; `@api` for specs valid against a real backend (BE-32). |
| Responsive | Required (CLAUDE.md section 7): no horizontal page scroll at 375/768/1280; 320 px is spot-checked by QA (it was not covered by the final sweep, OQ-TS-6). |
| Run (verified) | `npm run test:e2e` (all, 3 projects); `npm run test:e2e:observed` (excludes `@provisional`); `npm run test:e2e:module -- m05-practice` (one module); `npm run check:trace` (traceability SRS id to test, add `--all` at G5 via `node scripts/check-e2e-trace.mjs --all`). Other configs exist for isolated ports (`playwright.5021/5024/5142/bijak/scope.config.mjs`); use one with its own port so the shared 4173/5173 are never touched. |
| Run (planned, BE-32) | `npm run test:e2e:http -- --grep @api` against the compose stack; module run in http mode `npm run test:e2e:module -- mNN` with the http config. Domain complete when its module e2e is green in **both** modes. |
| Exploratory | Interactive checks use the Playwright MCP lanes (`playwright`, `playwright2`, `playwright3`); one agent per lane, lanes 2-3 log in themselves; keep load modest; scripts and screenshots in the agent's own scratchpad subfolder. |

### 2.8 Migration tests

| Item | Detail |
|---|---|
| Location | `apps/api/test/migration/**` (sub-folders `anonymise`, `fixtures`, per-entity). No file over 1 MB there (BE-NFR-13). |
| Levels | (a) **UT/IT per transform**: enum maps, hash classification (bcrypt `$2y$` to `$2b$`, non-bcrypt flagged `must_reset`), IC dropped at extract (BE-MIG-10); (b) **IT per loader**: idempotent second run changes nothing (`upsertByLegacy`), rows with `legacy_source IS NULL` untouched, unknown enum/orphan/duplicate go to `etl_rejects` with reason code and no personal value (BE-MIG-03/07); (c) **IT runner**: default `--dry-run`, `--apply` refused without a passing dry-run on the same input hash, resumable from `etl_checkpoints` (BE-34); (d) **IT source safety**: a credential able to INSERT aborts before reading (BE-MIG-05); (e) **IT reconciliation** (BE-30): see section 5.4; (f) **IT delta and rollback**: `--since` loads only changed rows and is idempotent; dropping the v2 data schema restores the pre-state and the source is untouched, checked by privileges (BE-MIG-12/13); (g) **lint**: `be:lint:migration` fails when a model in `apps/api/prisma/migratable-models.json` lacks `legacy_source`, `legacy_id` or the unique index. |
| Data | Only the BE-35 synthetic generator (`tiny`, `small`, `medium`) in CI. The anonymised dump is for the lead's rehearsal only and never enters git, a PR or CI artifacts. |
| Run | **Planned:** `npm run be:test -- apps/api/test/migration` (BE-30/34), `... apps/api/test/migration/anonymise apps/api/test/migration/fixtures` (BE-35), `npm run be:lint:migration` (BE-34), `npm run migrate:all`, `migrate:delta`, `migrate:verify`, `migrate:core` (BE-28/30; names as written in the cards, confirm at merge). |
| Rehearsal (RUN) | The lead runs the full rehearsal on the anonymised dump with the runbook (`docs/architecture/v2-migration-runbook.md`, written by BE-30); QA records the recon report aggregates (not row data) as evidence. |

### 2.9 Security checks

| Item | Detail |
|---|---|
| Authz matrix test | **Derived from the role-access matrix** (`packages/contract/src/access/matrix.ts`, documented in `docs/requirements/role-access-matrix.md`). A generated IT enumerates every (route, role) pair and asserts the contract's allowed/forbidden outcome: allowed gives 2xx, forbidden gives 403, no session gives 401. A **route-inventory test** lists all routes and fails when a protected controller lacks a role/capability decorator (BE-NFR-01, default-deny). The same matrix drives the frontend guard tests (`e2e/global/guards.spec.ts`). |
| Scope | Out-of-scope id returns 404, never 403; a request carrying a scope field is rejected; extra body fields rejected (BE-NFR-05). Sampled per domain (BE-33 AC1). |
| CSRF | One test per mutating route group: missing/wrong `X-CSRF-Token` gives 403 `CSRF_INVALID`; GET needs none (BE-NFR-03). |
| Rate limit | Login, registration, password reset, upload, ticket creation return 429 `RATE_LIMITED` with `retryAfter`, with a fixed clock; a success resets the login counter (BE-NFR-04). |
| Other | Session fixation (id changes on login, role switch, mode change), cookie flags, no token in a body, log capture free of password/cookie/IC/e-mail, SQL-injection strings on search endpoints, oversized body, upload magic bytes and caps, SSRF cases for `AI_BASE_URL`, AI redaction canary, planted-secret demonstration for the secret scan. |
| Review | `security-engineer` (read-only) reviews every change touching auth, payments, personal data, file uploads or new external input (G4), and does the final pass at G6 (BE-OPS-10). Findings go to the owning role. |
| Run | **Planned (BE-33):** `npm run be:test -- apps/api/test/security`; `npm audit --omit=dev`; the `docker run --read-only` check in BE-33. |

### 2.10 Performance and NFR checks

| Target (BE-NFR-15, proposed, lead may change) | Check |
|---|---|
| p95 at most 300 ms single-resource read/write; at most 800 ms list/report, on the PoC profile (about 20 students), developer laptop | IT with loose timing assertions on the seeded profile (BE-26). Re-run alone, not beside other suites. |
| Intake: 40-question paper extracts in at most 10 min (p90); review screen data at most 2 s (p90); review queue pages 5,000 open items | Measured once in the BE-26 or BE-38 PR (RUN), evidence pasted in the PR. |
| Lists paginated, `pageSize` at most 100, indexed filters, aggregates in SQL (BE-NFR-16) | IT: a request over 100 is clamped/rejected; query-plan or row-count assertion on one list per domain. |
| Frontend budgets | `npm run test:perf` (project `perf`, files `src/**/__tests__/**/*.perf.test.ts`, one at a time, after the unit group; currently dataset, M01, M02, M04, M05). |
| Extraction quality (BE-NFR-36) | PILOT targets on the pilot sample set, not CI gates. A miss raises the review threshold, never enables auto-approval. No card owns the measurement (OQ-TS-4). |

## 3. Gate matrix

Gates follow CLAUDE.md section 2. "Required" means the evidence is attached to the gate report; the `code-reviewer` / `qa-engineer` does not pass a gate without it. All commands in the table are those of sections 2 and 3.5; planned ones apply once their card has merged.

### 3.1 G3 Build (developer evidence, before review)

| Change type | Required evidence |
|---|---|
| **Frontend-only** (mock mode) | `npm run lint`, `npm run typecheck`, `npm test` (or the targeted tests of the changed area, per CLAUDE.md "keep agents fast"), `npm run build` for shell/route/build-config changes. New or changed module logic: UT. New or changed component: CMP. Mock data/handler change: handler tests + `registry-boot.test.ts` when shared data changed. New screen flow: the E2E spec exists for the three viewports and passes (`npm run test:e2e:module -- mNN`). |
| **Backend card** (BE-xx) | The full Definition of Done (3.5): `npm run be:verify` green with real output in the PR; contract committed first; IT for every endpoint incl. 401/403/404/CSRF/422 paths; migration applies on empty DB and on previous head; seed module idempotent; scenarios added to the conformance package (BE-31 rule). If `packages/**` changed: root `npm run typecheck` and `npm test` also green. |
| **Contract change** | `npm run contract:emit` committed, `npm run contract:check` green, contract tests for the new/changed schemas, breaking-change gate green (or label `contract-breaking` with both sides' agreement), mock handler and frontend types aligned in the lead's PR, deviations listed in `v2-backend-deviations.md` and the PR. Root `typecheck` + `test` green. |
| **Migration card** (BE-27..BE-30, BE-34, BE-35) | `be:verify` incl. `be:lint:migration`; all MIG tests on synthetic fixtures (idempotency, dry-run, rejects, read-only source guard); mapping-matrix row added/updated in the same PR (BE-MIG-17); leak scan green (BE-35); no file over 1 MB, no dump, no `.migration-out/` staged; recon report on fixtures attached as aggregates only. |
| **Per-domain http switch** (lead PR "switch Mnn to http") | BE card merged; prefix added to the hybrid list; module e2e green in **both** modes: `npm run test:e2e:module -- mNN` on mock, then `npm run test:e2e:http` (planned, BE-32) on the compose stack; conformance scenarios of the domain green; the BE-32 checklist (`docs/plan/http-switch-checklist.md`) row filled in. |

### 3.2 G4 Review

| Reviewer | Required |
|---|---|
| `code-reviewer` (always) | Verdict Approve; no open Blocker/Major. Checks: contract-first order, tests present for each AC, no mocked DB in backend tests, determinism (`Clock`, seeded PRNG), BM copy exact, no real names/credentials/data, responsive rule and design-system use for UI, mapping-matrix row for schema cards. |
| `security-engineer` (when change touches auth, payments, personal data, file uploads or new external input) | Verdict Pass; threat-model table (asset, threat, control, test) in the PR for BE-33; SEC items of the URS for the card. |
| Track note | Fast track: owning developer, then `code-reviewer`. Standard: short requirement note, developer, G4, targeted G5. Trivial: no subagent. |

### 3.3 G5 Test

| Change type | Required evidence (QA report, section 5.3) |
|---|---|
| Frontend module/screen | Every AC executed and Pass at **375, 768 and 1280**: E2E per module (`test:e2e:module`), `check:trace --all`, `test:e2e:observed` count vs `@provisional` count reported separately; exploratory pass via a Playwright MCP lane for what scripts cannot judge (legibility, overlap, tap targets, dark/light as the module supports). No open Critical/High bug. |
| Backend card | Every AC of the card and every URS requirement mapped to the card has a passing test id; QA re-runs `be:verify` and the card's test commands on a clean checkout; spot-checks the API through the compose stack (API tests) when BE-32 exists. |
| Contract change | Conformance report: all affected operations covered, mock and API agree. |
| Migration | Reconciliation report green on fixtures (CI) and, for the release, on the anonymised dump (lead's rehearsal): all entities `status: ok` or an `expected_delta` documented and accepted; rollback rehearsed; delta rehearsed. |
| Per-domain http switch | Module e2e in both modes, plus one cross-role flow (login, role switch, Mod Pelajar write stamped `is_test`, logout). |
| Verdict | **Ready** only if every AC is executed and Pass and no Critical/High bug is open. **Not ready** otherwise, with the failing ACs listed (as in `M05-practice.md`). |

### 3.4 G6 Release

| Required | Evidence |
|---|---|
| Backend CI green on the release commit | all `api.yml` steps incl. `contract:check`, breaking-change gate, secret scan, `npm audit --omit=dev`, image scan, migration lint. |
| Full verification | `npm run be:verify` and root `npm run verify` green (real output). |
| Stack | `docker compose up -d --build`, `npm run test:e2e:http -- --grep @api` green on three viewports; `/api/health` and `/api/ready` (503 with a pending migration, 200 after). |
| Security | `security-engineer` final pass: uploads, AI keys, SSRF, migration data handling (BE-OPS-10); `docker run --read-only --tmpfs /tmp` works; SIGTERM finishes in-flight requests. |
| Operations | Runbook executed once: `pg_dump` backup and restore into a fresh database; secret rotation steps present. |
| Migration (go-live release only) | Rehearsal recon green; rollback tested; freeze plan; delta run rehearsed. |
| Human gate | **User explicitly confirms** the deploy. No agent deploys on its own. |

### 3.5 Backend Definition of Done (`be:verify`)

`be:verify` is **planned (added by BE-01)** and equals: `contract:check` + `be:lint` + `be:typecheck` + `be:test` + `be:build` (plan section 4; BE-34 adds `be:lint:migration`). A backend PR is done only if (plan section 10):

1. Contract committed first; `contract:check` passes; deviations listed.
2. Endpoints use the contract envelope, status codes and exact BM errors; every response in tests parsed by the contract schema.
3. 403 wrong role, 404 out-of-scope id, 401 no session, 403 `CSRF_INVALID` tested.
4. Prisma schema and SQL migration committed; applies on empty DB and on previous head; no destructive change to merged migrations.
5. UT for rules and IT (supertest + real Postgres) per endpoint incl. validation paths; behaviour compared with the mock handler's tests where they exist.
6. Idempotent deterministic seed module wired into `be:db:seed` where the card says so.
7. `be:verify` green with real output in the PR; root `typecheck` and `test` green if `packages/**` changed.
8. No secrets, no real names, no personal data in logs.
9. PR description from the template.
10. Reviewed and approved by the lead (security review where required).

Until `be:verify` exists, the nearest verified equivalent for the shared parts is `npm run contract:check && npm run typecheck && npm test`.

## 4. Test data strategy

| Source | Used by | Rules |
|---|---|---|
| **Mock seeds and D11 virtual datasets** (`src/mock/**`, module `mock/` stores, `scripts/fixtures`) | Frontend UT/CMP/E2E, mock-side conformance | Deterministic virtual datasets report live totals and generate rows on demand; observed anchor records override generated rows; every count is computed from the dataset, with only the documented per-module display constants as exceptions. Seeds mirror observation: never invent records or tune values to make totals agree. Test time is `TEST_NOW`. Shared-store changes (M01 users, M05 practice, M10 classes, M04 questions, any `datasets/`, `seeds/` or `spec` file) are made in an isolated git worktree and merged back only when `registry-boot.test.ts` and the owner module's tests pass. |
| **Backend seed profiles** (`apps/api/prisma/seed/`, BE-07, BE-26, per-domain modules) | Backend IT, conformance, compose e2e | One command `be:db:reset && be:db:seed` (planned). `--profile=test` is minimal per-test fixtures; `--profile=poc` is the coherent PoC database (D45: about 20 students, a few teachers, school admins, one admin, a few papers) with `docs/plan/seed-profile.md` listing counts per table. Seeds are idempotent, use a seeded PRNG, never `Math.random` or `Date.now`, never set `legacy_*`. `seed/verify.ts` checks counts, referential coherence and ledger = wallet. Canonical demo accounts (BE-03) stay unchanged; the demo password `Demo1234` is the only credential allowed, for seeded demo accounts only. |
| **Test stamp `is_test`** | Mod Pelajar ("Pratonton sebagai Pelajar", D33b, V2-T19) | Every write under Mod Pelajar is stamped `is_test=true` in the owner repository (practice sessions/answers, wallet/ledger, notes, notifications); aggregates (rankings, class and school reports, command center) **exclude** it. Required tests: a stamped write exists; rankings/aggregates unchanged after it; the flag is never settable by a client body. |
| **Anonymised fixtures** (BE-35) | Migration tests in CI | Deterministic synthetic generator in sizes `tiny`, `small`, `medium`, emitting the `staging_cloud` shape with planted anomalies (orphans, duplicate e-mails, unknown enums, non-bcrypt hashes, users without e-mail, date-only edge cases) and a manifest of planted counts that the profiler must reproduce. Fictitious names only, checked against a deny-list pattern; no committed file over 1 MB. |
| **Anonymised dump** | Lead's rehearsal only | HMAC pseudonyms (same value, same pseudonym, so relations survive), password hashes replaced by the hash of a documented dummy, default-deny column rules, leak scan. Key and raw dumps never in the repo; the anonymised dump is shared out-of-band, encrypted, deleted after the rehearsal. |
| **Never** | everyone | Live data (.my or .cloud), real names (even inside example copy), IC numbers, e-mails, phones, credentials. Live remains read-only and its credentials stay outside the repo. A QA report never pastes a secret or a real person's name. |

## 5. Traceability and reporting

### 5.1 Id convention

| Artifact | Id format | Example |
|---|---|---|
| Frontend SRS scenario | `E2E-Mnn-nn` (defined in the SRS section 12) | `E2E-M06-31` |
| Frontend AC | `AC-<story>.<n>` in the module requirement | `AC-35.3` |
| Backend requirement | `BE-FR-nn`, `BE-NFR-nn`, `BE-MIG-nn`, `BE-OPS-nn` | `BE-NFR-03` |
| Card AC | `BE-nn ACn` | `BE-03 AC5` |
| Bug | `BUG-<slug>-nn` (module code or slug) | `BUG-M05-01`, `BUG-BE03-02` |
| Open question | `OQ-<area>-n` | `OQ-TS-1` |

### 5.2 Test id convention

- **E2E:** the title starts with the SRS id and carries the module tag: `'E2E-M01-03 Admin login ... @m01'`. `npm run check:trace` enforces: id defined, traced once, tagged, provisional consistent (errors S1/S2/T1-T4/P1-P3).
- **Vitest (frontend):** `describe('<unit>')` / `it('AC-18.1 <behaviour>')`; the AC or FN id is first when the test verifies one.
- **Backend:** `it('BE-NFR-03 mutating call without CSRF returns 403 CSRF_INVALID')` and `it('BE-03 AC5 ...')`. One test may cite several ids, an id may be cited by several tests. Conformance scenarios are named `<domain>.<operation>.<case>` (for example `auth.login.invalid-credentials`).
- **Matrix upkeep:** the URS section 9.1 (requirement to cards to verification code) is the planned coverage; the QA report in 5.3 is the executed coverage. A requirement with no test id is a gap, reported, not hidden.

### 5.3 QA report format (as in `docs/qa/Mnn-*.md`, `v2-final-sweep.md`)

File: `docs/qa/<slug>.md` (frontend modules keep `Mnn-<slug>.md`; backend cards use `BE-nn-<slug>.md` or one `v2-backend-g5.md` per wave). Sections in this order:

1. **Header:** scope, sources read, build/commit tested, environment (ports, stack, profile), tools, viewports, tester role.
2. **Verdict** (Ready / Not ready) with the counts (Blocker/Critical, High/Major, Medium, Low) and the rows covered.
3. **Runs** table: command, project/viewport, pass, fail, skip, flaky, retries, wall time.
4. **AC execution table:**

   | AC / req id | Description | Test id(s) | Level | 375 | 768 | 1280 | Result | Bug |
   |---|---|---|---|---|---|---|---|---|
   | AC-35.3 | Only "Soalan by Chapter" active on S4/S5 | `qa-g5-flows.spec.ts` menus | E2E | Pass | Pass | Fail | Fail | BUG-M05-02 |

   Backend rows use level `IT/CT/SEC/RUN` and `n/a` for viewports.
5. **Bug table:** `ID | Severity | Steps (role, path, size) | Expected (AC cite) | Actual | Evidence (log, screenshot path) | Owner role`.
6. **Not covered / caveats** (what was not tested and why; mid-load audits; harness artefacts). Silence is not coverage.
7. **Re-run log:** which failing items were re-run after fixes and the final numbers.

### 5.4 Reconciliation evidence (migration)

Per entity, the BE-30 report (`.migration-out/recon-<run>.md/json`, git-ignored, aggregates only) shows: source count; eligible after documented exclusions (for example `question_set_items` are not migrated); loaded (inserted, updated, unchanged); rejected by reason; `expected_delta`; check result. Semantic checks (plan 14.6):

| Check | Gate behaviour |
|---|---|
| Counts: source = loaded + rejected + documented exclusions (users, enrolment pairs) | Mismatch not explained by `expected_delta` = fail. |
| Sums: ledger `SUM(amount)` vs wallet balance; `SUM(correct)` vs correct answer rows | **Reported, not corrected** (risk "Ledger integrity"); QA lists differences and the lead decides. |
| Distinct sets: (state, district) pairs vs JPN/PPD rows created | Mismatch = fail. |
| Sample parity: N deterministic sample users, key fields equal after transform, on anonymised data only | Mismatch = fail. |
| Accepted drift: streak, mastery, rankings recomputed in v2 | Listed, accepted, not a failure. |

QA copies **numbers and statuses** into the report, never row data.

## 6. Defect severity and gate blocking

| Severity | Definition | Examples | Blocks |
|---|---|---|---|
| **Blocker / Critical** | Data loss or corruption, security hole (authz bypass, cross-scope read, token or personal data exposed, secret committed, SSRF), a main flow impossible, or a wrong record written to the owner store. For migration: a non-idempotent load, a write to the source, personal data leaked into a v2 table, log or fixture. | Out-of-scope id returns 200; CSRF not enforced; real name in a fixture; non-read-only source accepted. | G3 (do not hand to review), G4, G5, G6. Fix first, same day. |
| **High / Major** | Visible defect on a main screen, wrong rule or total, wrong BM copy on a contract-visible message, unreadable or clipped important text, layout broken at 375/768/1280, horizontal page scroll, control unusable on touch, a contract-invalid response, a performance miss of more than 2x the target, reconciliation mismatch without explanation. | Heading illegible on a hero; 500 instead of 422; list not paginated. | G4 (open Major blocks Approve), G5 (open High blocks Ready), G6. |
| **Medium** | Wrong but contained behaviour, wrong sidebar highlight, copy or label deviation that does not change meaning, a flaky test with a real cause. | Two sidebar items active. | Does not block G4/G5 if the owner has accepted it in writing and it is listed; blocks G6 only if it recurs on a main flow. |
| **Low / Minor** | Polish: spacing, icon colour, duplicate title, tap target slightly under the guideline. | | Never blocks; tracked in the report. |

Rules: a bug is judged against the AC or requirement it violates and against D9 (broken = 404/dead link, wrong labels/titles, visual bug, responsive breakage, controls unusable on touch, unreadable text, contradictory rules). A deliberate live limitation is not a bug. Accessibility "enhancements" are not bugs (D10). Severity is set by QA; a developer may ask for a re-rating with evidence. Failed gate: findings go to the owning role, then **only that gate is re-run** (CLAUDE.md section 2). Test failures are never cured by deleting or loosening a test; a flaky test is tagged and fixed or quarantined with a ticket (section 7).

## 7. Flakiness and multi-session rules

### 7.1 Shared tree and processes (mandatory)

- Several sessions work in one folder. **Never kill all `node.exe`, Playwright or vite processes**; other sessions and the dev server on 5173 depend on them. Stop only the PIDs/ports you started, and say which in your report.
- Ports: do not use 5173 (dev server), 4173 (default e2e preview), 5191 (Docker preview `pretasiplus-preview`), 5192 (compose frontend). For your own preview or Playwright config pick an unused port, check it is free first, and stop it afterwards. Preview only via the Docker container `pretasiplus-preview`; no hidden background servers left running.
- Playwright MCP lanes: one agent per lane (`playwright`, `playwright2`, `playwright3`); never two agents on one lane.
- Scratch files and scripts live in your own subfolder of the scratchpad (`<scratchpad>/<role-or-module>/`); run only scripts from your own subfolder.
- Never leave half-done data edits in the shared tree: a failing boot blocks every session. Shared-store changes use a worktree, as in section 4. Commit checkpoints only after a green boot, and only when the user has asked.
- Git: feature branch, never commit to `main`; backend branches `be/<task-id>-<slug>`. QA agents do not commit unless asked.

### 7.2 Flakiness handling

| Cause | Rule |
|---|---|
| CPU saturation (the M05 G5 run saw boot timeouts at ~100% CPU and many tests passing only on retry) | Use `--workers=2` or fewer when other sessions run; raise the timeout in your own scratch config, not in the repo; report the machine load. Run `*.perf.test.ts` and timing ITs alone. |
| App boot is slow (mock about 1.5 s alone, up to about 6 s with every worker booting) | Use the `gotoApp` fixture, never fixed sleeps; wait on the specific element or response. |
| Mid-load audits (slow pages such as `/practice/progress` or command center) | Wait for the content signal, not for the h1. |
| Shared state between tests | Reset by new context/session; backend ITs use their own database or rolled-back transaction; no test depends on another's rows. Time via `Clock`, randomness via seed. |
| Retries | CI allows one retry; a test that needs the retry is **flaky**: it is listed in the report with its flake count. A failure that passes on retry is not a pass at G5 until the cause is understood or the test is quarantined with an owner and a date. Never raise `retries` to get green. |
| Quarantine | Tag `@flaky` (planned, tag convention to be added to `e2e/support/tags.ts` by the lead, OQ-TS-5) and exclude by `--grep-invert`, never delete. The quarantine list is reviewed each gate. |
| Harness artefacts | After a role switch inside one session a reload may restore the old session if IndexedDB is not cleared: clear all storage (local, session, IndexedDB) or use a fresh context. |
| Docker/Testcontainers | Needs Docker running; one container per test worker group; always clean up your own containers, never `docker rm -f` everything. |

## 8. Pre-flight checklist for any session that tests

1. Read `docs/TRACKER.md` for the current stage and the card's tracker row.
2. Read the AC/requirement list you will execute, and this file's section 3 row for your change type.
3. Confirm planned commands exist (`npm run` lists scripts) before using them; if one is missing, say so in the report.
4. Check ports and Docker state; start only what you need; plan to stop only what you started.
5. Use fictitious data only; keep scratch work in your subfolder.
6. Report in the section 5.3 format with real output; say what was not covered.

## 9. Open questions (OQ-TS-n)

| ID | Question | Why it matters | Proposed answer |
|---|---|---|---|
| OQ-TS-1 | There is no frontend CI workflow (`.github/workflows` does not exist in the worktree; BE-01 adds only `api.yml`). Who adds a frontend job running `npm run verify` and the three-viewport e2e on PRs? | Frontend gates rely on the lead running things by hand. | Add `web.yml` (lint, typecheck, test, build, `test:e2e:observed`) owned by `devops-engineer`, path-filtered to `src/**`, `e2e/**`, `packages/**`. |
| OQ-TS-2 | Mock-side conformance adapter (BE-31) is "owned by the frontend lead" but has no card or date. | Without it, "same request to mock and API" is only half run. | Create a frontend task and schedule it before the first http switch (wave 1). |
| OQ-TS-3 | No card owns performance/load testing beyond loose IT timings (URS notes this). Are the BE-NFR-15 numbers final (URS OQ-1), and is a load test needed before go-live? | G6 cannot claim capacity. | Keep loose timings now; decide a k6 smoke before G6 if the user expects real traffic. |
| OQ-TS-4 | No card owns the extraction-quality PILOT measurement (BE-NFR-36) or the sample set. | The quality targets cannot be evidenced. | Assign to QA with a pilot set supplied by the lead; report as PILOT, not as a gate. |
| OQ-TS-5 | Quarantine tag `@flaky` and a `test:e2e:http` / `playwright.http.config.ts` naming are proposals. | Consistent selection by tag. | Lead approves; BE-32 and `tags.ts` follow. |
| OQ-TS-6 | 320 px is required by CLAUDE.md section 7 ("mobile >= 320px") but the Playwright projects and the final sweep use 375, 768, 1280 (and 1440 once). Add a fourth 320 project or keep 320 as a QA spot check? | Rule says 320 but tests do not run it. | Keep 375/768/1280 in the suite; QA spot-checks 320 on layout-heavy screens at G5 and lists it. |
| OQ-TS-7 | Authz matrix test: is `packages/contract/src/access/matrix.ts` complete enough to generate the route-level (route, role) cases, or does each BE card hand-write them? | Default-deny proof depends on it. | Generate from the matrix and fall back to hand-written cases for routes the matrix does not name; track gaps in the BE-33 PR. |
| OQ-TS-8 | Data-subject rights (access, correction, erasure) have no rule and no card (BE-NFR-14). Out of test scope until a rule exists. | Possible PDPA gap. | Escalate to the user at G2/G6; add tests when the rule is decided. |
| OQ-TS-9 | Exact migration script names (`migrate:all`, `migrate:delta`, `migrate:verify`, `migrate:core`) come from card text; they may change at implementation. | Docs quote them. | Re-verify against root/`@pp/api` `package.json` when BE-28..BE-30 merge. |
