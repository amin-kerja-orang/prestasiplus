# Backend developer guide (v2-backend)

The one handbook a backend developer or Claude Code session needs. It turns the plan and the requirements into daily practice so that code written on different PCs looks the same and behaves the same.

- **Read order for a session:** [AGENT-SYNC.md](AGENT-SYNC.md) (claim a card), the requirements for your domain in [v2-backend-urs.md](../requirements/v2-backend-urs.md) plus its sections 5 to 7, **this guide**, then your card file in [backend-tasks/](backend-tasks/README.md).
- **Authority:** TRACKER decisions, requirements, the [plan](../architecture/v2-backend-plan.md), ADRs, this guide, code. Where the plan decides something this guide links it. Where the plan is silent this guide picks the conventional NestJS/Prisma option and marks it **(guide default; LEAD may change)**.
- **Names in snippets are illustrative.** BE-01, BE-02 and BE-03 define the real helper names. Read `apps/api/src/common/**` and `apps/api/src/db/**` before writing your first controller; if a name here differs from the code, the code wins and this guide is fixed in the same PR.
- **Never invent business rules.** The frontend mock is the behavioural spec, `@pp/contract` is the wire spec. An unknown rule is a line under "Open questions" in your PR (and, if it blocks, a GitHub issue labelled `question`).
- **Sibling documents** (written alongside this guide; link, do not copy): endpoint list [../architecture/v2-api-catalogue.md](../architecture/v2-api-catalogue.md); tables and columns [../architecture/v2-data-model.md](../architecture/v2-data-model.md); frontend and backend meeting point [fullstack-integration-guide.md](fullstack-integration-guide.md); the other side [frontend-dev-guide.md](frontend-dev-guide.md); first day [onboarding.md](onboarding.md); test strategy [../qa/v2-test-strategy.md](../qa/v2-test-strategy.md).

## 1. Repository layout

```
apps/api/                         @pp/api (backend-owned; created by BE-01)
  src/
    main.ts, app.module.ts
    common/                       config, logging, errors (filter + AppException), pipes (zod), guards,
                                  scope, decorators, pagination helpers, security, health, audit
    db/                           PrismaService, transaction helper, Clock, ids (bigint <-> string)
    modules/index.ts              module registry (append-only: one import and one array entry per module)
    modules/<owner>/              one Nest module per owner module of ADR-0014 (see section 3)
    migration/                    .cloud ETL CLI (BE-34, BE-27 to BE-30); never imported by the API
  prisma/
    schema/base.prisma            datasource + generator (prismaSchemaFolder)
    schema/<owner>.prisma         one file per owner module
    migrations/                   append-only SQL
    migratable-models.json        models that can receive legacy rows (lint input, BE-34)
    seed/index.ts                 seed registry (append-only), seed/<domain>.ts
  test/
    support/{db.ts,app.ts}        Testcontainers + createTestApp()
    <domain>/*.unit.test.ts, *.int.test.ts
    conformance/<domain>/         scenarios for the BE-31 suite (new files only)
    fixtures/                     fictitious fixtures only
packages/contract/src/<domain>/   zod schemas + path registration (you own new domain folders; the lead owns common/session/auth/access)
packages/contract/openapi.json    generated, never edited by hand
packages/contract-tests/          @pp/contract-tests, the conformance scenarios (BE-31)
packages/exam-core/               shared marking and blueprint engine (BE-14)
docker/api/Dockerfile             multi-stage, non-root, read-only rootfs
.github/workflows/api.yml         backend CI
compose.yaml                      frontend + api + db (api and db are activated by BE-01 and BE-02)
docs/architecture/v2-backend-deviations.md   append-only deviation log (created by BE-01)
docs/ops/api-runbook.md           operations runbook (BE-33)
```

Who may edit which folder is in [sessions.md](sessions.md) sections 5 and 6 and plan section 9; this guide does not repeat it. You never edit `src/**`, `e2e/**`, `docs/TRACKER.md`, `packages/contract/src/{common,session,auth,access}/**` or another lane's folders: open a GitHub issue labelled `cross-lane` or `contract` instead.

**Look-ups:** endpoints, request/response shapes and error codes per route are in [v2-api-catalogue.md](../architecture/v2-api-catalogue.md); tables, columns and owners are in [v2-data-model.md](../architecture/v2-data-model.md). Check both before writing a contract or a migration.

## 2. Commands

Run everything from the repository root. Only the first block exists today; the rest is added by the named card, so before that card merges the command does not exist (do not write docs or CI that assume it). Before BE-01 merges, use the checks per card type in [AGENT-SYNC.md](AGENT-SYNC.md) section 4 instead of `be:verify`.

| Command | Exists now | Added by | What it does |
|---|---|---|---|
| `npm ci` | yes | n/a | Install every workspace. |
| `npm run contract:emit` | yes | n/a | Regenerate `packages/contract/openapi.json` from the zod schemas. |
| `npm run contract:check` | yes | n/a | Fail if `openapi.json` is stale. Run after any contract edit. |
| `npm run typecheck`, `npm test`, `npm run lint`, `npm run verify` | yes | n/a | Frontend and shared-package checks. Run `typecheck` and `test` when you touch `packages/**`. |
| `npm run be:dev` | no | BE-01 | `nest start --watch` against the compose `db` (port 3000). |
| `npm run be:build`, `be:lint`, `be:typecheck` | no | BE-01 | Build, ESLint and `tsc --noEmit` for `@pp/api`. |
| `npm run be:test -- <path>` | no | BE-01 (harness by BE-02) | Vitest for `@pp/api`; integration tests need Docker for Testcontainers. |
| `npm run be:db:migrate`, `be:db:reset`, `be:db:seed` | no | BE-01 declares, BE-02 makes them work | `prisma migrate deploy`; reset (refuses when `NODE_ENV=production`); deterministic seed. |
| `npm run be:lint:migration` | no | BE-34 | Fails when a model in `migratable-models.json` lacks the legacy columns or unique index, or a migration adds a Postgres enum type. Part of `be:verify` after BE-34. |
| `npm run be:verify` | no | BE-01 | The Definition of Done command: `contract:check` + lint + typecheck + test + build (+ `be:lint:migration` after BE-34). Paste its real output in the PR. |
| `npm run staging:load`, `staging:profile` | no | BE-27 | Load `staging_cloud` from fixtures or an anonymised dump; profiling report. |
| `npm run anonymise:run`, `fixtures:generate` | no | BE-35 | Lead-only anonymiser; synthetic fixture generator (`--size tiny\|small\|medium --seed N`). |
| `npm run migrate:core`, `migrate:activity` | no | BE-28, BE-29 | Entity loaders (`--dry-run` default, `--apply`). |
| `npm run migrate:all`, `migrate:delta`, `migrate:verify` | no | BE-30 | Orchestrator, delta run, reconciliation. |
| `npm run stack:up`, `stack:down`, `test:e2e:http` | no | BE-32 | Compose stack and the `@api`-tagged Playwright run. |

Docker: `docker compose up -d db` (PostgreSQL 16, no host port; use an uncommitted `compose.override.yaml` for a host port, plan 11). Windows PCs are first-class: no Bash-only npm scripts, use Node path APIs, expect CRLF in the working tree (git normalises).

## 3. Module anatomy

One Nest module per owner module. A module owns its tables; everything else goes through its exported service (ADR-0014, [store ownership](../adr/0014-store-ownership-and-repositories.md)). The owner of each store is in plan section 5; do not create a second schema for a store another card owns.

```
apps/api/src/modules/curriculum/
  index.ts                        barrel: exports only the service and its public types
  curriculum.module.ts            providers + exports (only the service is exported)
  curriculum-admin.controller.ts  one controller per audience: admin, learner, teacher (thin)
  curriculum.controller.ts
  curriculum.service.ts           rules, orchestration, transactions
  curriculum.repository.ts        the only file that talks to Prisma/SQL for this module's tables
  curriculum.mapper.ts            DB row -> contract object (bigint -> string, Date -> +08:00)
  curriculum.errors.ts            module error codes and exact BM messages (constants)
  curriculum.constants.ts         flash texts, enum code lists
```

| Layer | May do | Must not |
|---|---|---|
| Controller | Declare route, guards, parse input with the contract schema, call one service method, return `{ data }` / `{ data, meta }` | Contain rules, touch Prisma, build SQL, read scope from the request |
| Service | Apply business rules, call other modules' **services**, open the transaction, throw `AppException` | Import another module's repository or Prisma model, return DB rows |
| Repository | Queries using the `ScopeContext`, bulk SQL, `$queryRaw` for aggregates | Throw HTTP errors, hold rules, ignore scope |
| Mapper | Pure conversion to the contract shape | Query the DB |

Naming **(guide default)**: files `kebab-case.<role>.ts`; classes `PascalCase` + role (`CurriculumService`); tables `snake_case` plural; contract schemas `<Thing>Schema`, requests `<Verb><Thing>Request`; no `class-validator` DTO classes, the contract zod schemas are the DTOs. An ESLint `no-restricted-imports` rule blocks imports of `modules/*/**.repository` from other modules.

Registering a module: add one import and one array entry to `modules/index.ts`; a seed to `prisma/seed/index.ts` in dependency order; model names to `migratable-models.json` (alphabetical). These three files are append-only and shared, so add your line and nothing else.

Cross-module reads use the owner's service. Example from the mock: the admin level list shows `questionCount`, which M03 gets from `questions.groupCount('Q-ACTIVE', 'educationLevelId')` (M04) and `subjectCount` from its own store. In the API, `CurriculumService` calls `QuestionsService.groupCount`; it never queries `questions`.

## 4. Contract-first workflow, step by step

The contract is the acceptance test (ADR-0018, plan 6.2, [BE-NFR-26](../requirements/v2-backend-urs.md)). The contract describes the **current mock wire shape**, so the later frontend switch is a no-op. Only three things change: ids become strings (OD-9), timestamps carry `+08:00`, and anything else is a listed deviation.

**Open list and `contract-only` cards.** You may start only cards on the Open list of [AGENT-SYNC.md](AGENT-SYNC.md). A `contract-only` row means: do steps 1 to 5 below (and nothing else) on branch `be/<card-id>-contract` with the PR label `contract`; the card then returns to `todo` with the note "contract merged".

1. **Read** the card, the SRS (`docs/requirements/srs/Mnn-*.md`), the mock handlers (`src/modules/<mNN>/mock/handlers/*.ts`), the frontend client and types (`src/modules/<mNN>/api/*`), and the module tests in `src/modules/<mNN>/__tests__/mock`. Write the checklist of section 5 for every route.
2. **Schemas.** Add files under `packages/contract/src/<domain>/` (new files only). `import { z } from '../zod'`, never from `'zod'` (the OpenAPI patch must run first). Request schemas are `z.strictObject`; give every exported schema `.meta({ id: 'Name' })`. Ids are `IdSchema`; timestamps `TimestampSchema`; lists use `listEnvelopeOf`, single results `envelopeOf`.
3. **Barrel and registration (append-only lines in lead-owned files; the `index.ts` line is a guide default, plan 9 names only the `COMPONENT_SCHEMAS` and `openapi.ts` lines):** add `export * from './<domain>'` to `packages/contract/src/index.ts`; append your components to `COMPONENT_SCHEMAS` and one `register<Domain>Paths(registry)` call to `buildOpenApiDocument` in `src/openapi.ts`, following `src/session/paths.ts` (`registry.registerPath({ method, path, tags, summary, request, responses })`; paths are relative to `/api`; list every error status with the code in its description). On a merge conflict keep both sides' lines.
4. **Emit and test.** `npm run contract:emit`, commit the changed `openapi.json`, run `npm run contract:check`, add a schema test (a valid sample parses, an invalid one and an unknown key do not) next to `packages/contract/src/__tests__`.
5. **Contract PR.** For a domain the frontend still consumes through the mock, open this as its own small PR labelled `contract` so the lead can align the mock and UI types. The lead merges contract PRs first.
6. **Implement** schema, migration, repository, service, controller, mapper (sections 6 to 12). Parse every response with the contract schema in tests.
7. **Verify** with `npm run be:verify`; list deviations in the PR and append a dated row to `docs/architecture/v2-backend-deviations.md`.
8. **Switch.** The lead flips the module to http after your PR merges (plan 7). You never edit `src/**`.

A change to `common`, `session`, `auth` or `access` is a `contract` issue to the lead.

## 5. Reading a mock handler

For each `route(...)` in `src/modules/<mNN>/mock/handlers/*.ts` write down:

1. Method and path string. Keep it exactly, including BM paths such as `/api/kelas-saya`. Path params and their parsers (`{ params: { id: int() } }`).
2. Guards: `requireAuth()` is 401 without a session; `requireRole(...)` is 401 then 403; `requireOwner(...)` is 404 for a missing or foreign resource (never 403).
3. Input: `normalise()` style trimming ("" becomes null), the validation rule list and each rule's message string, unknown-field behaviour.
4. Existence checks and the exact not-found message.
5. Side effects: which other store is written (ADR-0014 hooks) and what runs in one transaction.
6. The responder, mapped to the API like this:

| Mock responder | API behaviour |
|---|---|
| `ok(data, extra?)` | 200 `{ data, ...extra }` |
| `created(data, extra?)` | 201 `{ data, ...extra }` |
| `noContent()` | 204 |
| `paginate` / `list` + `pageMeta` | 200 `{ data, meta }` (section 8) |
| `unpaged(items)` | 200 `{ data, meta }` with all items; keep unpaged only for reference data that is bounded by its nature |
| `raw(status, body)` | the body is sent un-enveloped exactly as the mock does (client `raw: true`) |
| `blob(...)` / `contentDisposition` | file download with the same `Content-Type` and file name |
| `notFound/forbidden/conflict(msg, code?)`, `validationError(fields)`, `rateLimited(retryAfter)` | `AppException` with that status, code and the mock's message |

7. Where the data comes from: the repository and seed (the seed module) and any count computed from another store.

### 5.1 Worked example: `POST /api/admin/education-levels` (M03)

Source: `src/modules/m03-curriculum/mock/handlers/admin-levels.ts` and `admin-common.ts`.

| Item | What the mock does | Backend consequence |
|---|---|---|
| Guard | `[adminOnly]` = `requireRole('admin')` | `@Roles('admin')`; no session 401, other role 403 |
| Input | `normalise(body)`: strings trimmed, `""` to `null` | Contract strict schema with a trimming preprocess (document it) |
| Rules | `name`, `nameEn`, `curriculum`: required string max 255; `code`: required string max 10 and unique (case-insensitive against other levels); `stage`: one of `primary`, `lower_secondary`, `upper_secondary`; `order`: optional integer at least 0 (a numeric string is accepted) | Zod fields; uniqueness is a **service rule** returning 422 `fields.code`, backed by a unique index |
| Validation errors | `validationError(fields)`: 422 `VALIDATION_ERROR`, `message` = first field message (+ "(and N more errors)"), `fields` = field to message; messages are English Laravel-style defaults such as `The :attribute field is required.` (OQ-4) | Reproduce byte for byte; capture the strings by calling the mock |
| Success | `created(level, { status: 'Tahap Pendidikan berjaya ditambah.' })` | 201 `{ data: EducationLevel, status: <BM flash> }`; keep `status` |
| Not found (other routes) | `notFound('Tahap Pendidikan tidak dijumpai.')` | `NOT_FOUND` 404 with that message |

Step 1, contract (`packages/contract/src/curriculum/levels.ts`; then steps 3 and 4 of section 4):

```ts
import { z } from '../zod'
import { IdSchema } from '../common/ids'

export const LEVEL_STAGES = ['primary', 'lower_secondary', 'upper_secondary'] as const

export const CreateLevelRequestSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(255),
    nameEn: z.string().trim().min(1).max(255),
    code: z.string().trim().min(1).max(10),
    stage: z.enum(LEVEL_STAGES),
    curriculum: z.string().trim().min(1).max(255),
    order: z.coerce.number().int().min(0).default(0),
  })
  .meta({ id: 'CreateLevelRequest' })

export const EducationLevelSchema = z
  .object({ id: IdSchema, name: z.string(), nameEn: z.string(), code: z.string(), stage: z.enum(LEVEL_STAGES),
            curriculum: z.string(), order: z.number().int(), isActive: z.boolean() })
  .meta({ id: 'EducationLevel' })

export const CreateLevelResponseSchema = z.object({ data: EducationLevelSchema, status: z.string() })
```

The zod messages must produce the mock's strings: use zod `error` maps that return the mock text, or map zod issues to `fields` in the one shared formatter in `common/` (BE-01 owns it; do not write one per module).

Step 2, Prisma and migration (section 10). Step 3, implementation:

```ts
// curriculum-admin.controller.ts
@Controller('admin/education-levels')
@Roles('admin')
export class CurriculumAdminController {
  constructor(private readonly curriculum: CurriculumService) {}

  @Post()
  @HttpCode(201)
  async createLevel(
    @Body(new ZodValidationPipe(CreateLevelRequestSchema)) body: CreateLevelRequest,
    @CurrentScope() scope: ScopeContext,
  ) {
    const level = await this.curriculum.createLevel(scope, body)
    return { data: level, status: CURRICULUM_FLASH.level.created }
  }
}

// curriculum.service.ts
async createLevel(scope: ScopeContext, input: CreateLevelRequest): Promise<EducationLevel> {
  const code = input.code.toUpperCase()                       // check the mock repository for the normalisation
  if (await this.repo.levelCodeTaken(code)) {
    throw AppException.validation({ code: MSG.codeTaken })      // exact mock string
  }
  const row = await this.repo.createLevel({ ...input, code })
  return toEducationLevel(row)
}
```

Step 4, tests (`apps/api/test/curriculum/levels.int.test.ts`): no session 401, student 403, valid body 201 and the body parses `CreateLevelResponseSchema`, each rule violated gives 422 with the exact `fields` text, duplicate code 422, strict schema rejects an unknown key, the row exists with `legacy_source` null. Then compare with the mock on the tested fields (section 11.3).

## 6. Validation

- Every body, query and path parameter is parsed with a contract zod schema through `ZodValidationPipe`; there is no second validation layer. Request schemas are `strictObject`: an unknown key (including `scope`, `role` or `schoolId` where the caller must not set it) is a 422, never silently dropped (BE-NFR-05).
- Trimming and `""` to `null` happen in the schema (`z.string().trim()`, preprocess), the same as the mock's `normalise`. Numeric strings from form posts are accepted only where the mock accepts them (`z.coerce.number()`).
- Failures produce `422 VALIDATION_ERROR` with `fields` (field to message) and `message` = the first field message plus "(and N more error(s))" when there are several, as `summarizeFields` in the mock does. One shared formatter in `common/` does this.
- Rules that need data (uniqueness, existence, quota) are service rules that throw the same error shape; back every uniqueness rule with a unique index and catch the violation (no read-then-write).
- Query filters and sort keys come from an allow-list in the contract; never interpolate a client string into SQL or `orderBy`.
- Pagination query: `page` and `pageSize` per section 8. Invalid `page` handling is open (OQ-27): follow the mock (missing or invalid means 1) and `pageSize` above 100 is 422.

## 7. Errors, envelopes and BM messages

Authority: `packages/contract/src/common/{error,envelope}.ts`, `auth/errors.ts`; plan 6.1; URS BE-NFR-22 to 25. The full code and message catalogue per endpoint is in the [API catalogue](../architecture/v2-api-catalogue.md).

| Case | Status | `code` | Where the message comes from |
|---|---|---|---|
| Body/query/param invalid | 422 | `VALIDATION_ERROR` + `fields` | mock rule strings |
| No or expired session | 401 | `UNAUTHORIZED` | mock default (English, OQ-4) |
| Wrong role or capability | 403 | `FORBIDDEN` | mock default (English, OQ-4) |
| Missing or wrong CSRF | 403 | `CSRF_INVALID` | `AUTH_ERROR_MESSAGES` (BM) |
| Unknown id **or out of scope** | 404 | `NOT_FOUND` | the module's exact not-found text |
| State conflict, duplicate action, second submit | 409 | `CONFLICT` or a module code | mock |
| Too many attempts | 429 | `RATE_LIMITED` + `retryAfter` (and `Retry-After` header) | `AUTH_ERROR_MESSAGES.RATE_LIMITED` |
| Unexpected | 500 | `SERVER_ERROR` | generic; no stack, no SQL |
| Auth and session codes (`INVALID_CREDENTIALS`, `ACCOUNT_INACTIVE`, `SCHOOL_INACTIVE`, `AMBIGUOUS_USERNAME`, `ROLE_NOT_ALLOWED`, `MODE_*`, `NO_MODE_ACTIVE`) | per `AUTH_ERROR_STATUS` | as named | `AUTH_ERROR_MESSAGES` |

Rules:

1. **Throw, do not return.** Services throw `AppException` (code, message, optional `fields` / `details` / `retryAfter`); the single exception filter in `common/errors` builds `{ error: { code, message, fields?, details?, retryAfter?, requestId } }`, picks the status from `ERROR_STATUS` / `AUTH_ERROR_STATUS` and puts `requestId` in the `X-Request-Id` header too. Never build an error body by hand in a controller.
2. **Module codes** live in the module's `*.errors.ts` and are added to the contract (`<domain>/errors.ts` with a status map and a message map, like `auth/errors.ts`) before use. Examples already in the cards: `NO_BLUEPRINT`, `SHORTAGE`, `AI_BUDGET_EXHAUSTED`, `CHAPTER_LOCKED`.
3. **BM copy is copied, never composed.** Search the mock handler, the SRS section "States & messages" and the contract for the string, paste it into the module's constants, and add a "copy diff" table to the PR (mock string, your string, identical yes/no). Do not translate, fix punctuation or re-word. If no copy exists anywhere, use the contract's proposed copy or raise a question; do not write new BM. The mock's generic messages are English Laravel defaults (`Unauthenticated.`, `This action is unauthorized.`, `Not Found.`, `Server Error`); copy them exactly until OQ-4 is answered.
4. Never leak existence: login failure is always `INVALID_CREDENTIALS`; cross-scope ids are 404.
5. Success shapes: `{ data }`, `{ data, meta }` or the mock's un-enveloped body when the handler used `raw`. Keep extra keys next to `data` (`status`).
6. In dev and test every response is parsed with its contract schema (`ZodSerializerInterceptor`); a mismatch fails the test. In production it only logs.

## 8. Wire formats: ids, time, money, pagination

| Topic | Rule |
|---|---|
| Ids | `IdSchema` is an opaque string of 1 to 64 characters. DB bigint identity keys are converted with the helper in `db/ids.ts` at the mapper (`.toString()`), parsed from the path with a digits-only check, and never `JSON.stringify`-ed as `BigInt`. Session-like records (practice session, Bijak attempt) use UUID, also sent as strings. Clients never parse or compare ids. |
| Time | Stored as UTC `timestamptz`, serialised with the explicit `+08:00` offset (`TimestampSchema`); date-only columns are `@db.Date` and `DateOnlySchema` (`YYYY-MM-DD`). Day logic (streak, daily limit, quest, month boundary) uses `Asia/Kuala_Lumpur` through the helper in `db/clock.ts`. Services get the time from an injected `Clock`; tests use the fixed clock. Never `Date.now()` or `new Date()` in a service or a seed. |
| Money | `numeric(10,2)` RM in the DB, integer sen where the source uses sen (`cost_sen`, `cost_value_sen`). Convert Prisma `Decimal` explicitly; the wire format is whatever the module's contract schema says (the prototype sends prices as strings). Never use floating point for money. |
| Enums | English codes stored as `text` plus a SQL `CHECK`; BM labels live only in the UI. |
| Booleans and nulls | As the mock: absent optional fields are omitted or `null` exactly as the contract schema says; do not "tidy" them. |
| Pagination | Replicate `src/mock/server/paginate.ts`: `totalPages = max(1, ceil(total / pageSize))`; an out-of-range page is an empty page that keeps the requested `page`; `from`/`to` are 1-based and `null` when the page is empty; named totals go in `meta.counts`; extra meta may never override a computed key. Use the shared helper in `common/pagination` (not one per module). `pageSize` is at most 100 (default 20, `PageQuerySchema`). |
| Ordering | Always add a deterministic tie-break (`id`) to `orderBy`. |
| `legacy_*` | Never appear in a response (the conformance suite checks it). |

```ts
const [rows, total] = await Promise.all([
  this.db.question.findMany({ where, orderBy: [{ id: 'asc' }], skip: (page - 1) * pageSize, take: pageSize }),
  this.db.question.count({ where }),
])
return { data: rows.map(toQuestionListItem), meta: pageMeta(total, { page, pageSize }, rows.length) }
```

Aggregates and counts are SQL (`groupBy`, `$queryRaw`), never "load all rows then count".

## 9. Authentication, roles, scope, transactions

### 9.1 Auth (decided in plan 3)

Server-side session in PostgreSQL, HTTP-only cookie (`Secure` in production, `SameSite=Lax`, domain from env), `X-CSRF-Token` on every non-GET request that has a session, no JWT and **no Bearer token** (the mock's Bearer is replaced by the cookie). Passwords: argon2id for new hashes; a legacy bcrypt `$2y$` hash verifies as `$2b$` and is rehashed on first login; never log or return a hash. IC: hash and masked tail only. Session lifetime values are in URS BE-NFR-02 (120 minutes idle without "remember", open questions OQ-6).

### 9.2 Guards and scope

- Default-deny: a global `AuthGuard`; public routes use an explicit `@Public()` and must match URS BE-FR-34.
- `@Roles(...)` checks the **active** role, never the role list. `@Capability('...')` reads `capabilitiesFor(role, scope)` from `@pp/contract/access`; capabilities exist only for `admin`, `school_admin` and `ppd_officer` (Portal Pentadbiran). Learner and teacher routes use `@Roles('student')`, `@Roles('teacher')`.
- `ScopeContext` is built by the server from the account (level, school, district, class set) on each request, so a change to a user's role, school or active flag takes effect on the next request (BE-NFR-39). Inject it with a param decorator; never read a school id, role or scope from query, body or headers.
- Every repository method takes the scope as its first argument and applies the helper, so a forgotten filter does not compile:

```ts
async findStudent(scope: ScopeContext, id: bigint) {
  const row = await this.db.user.findFirst({ where: { id, role: 'student', ...scope.schoolWhere() } })
  return row ?? null            // the service turns null into the module's NOT_FOUND 404, never 403
}
```

- A school admin reads own school only, a teacher own classes, a student own rows. `requireOwner` in the mock means an owner check with 404 otherwise.
- Staff write rules (v2-portals 4.2, BE-21): a school admin cannot create or promote a `school_admin`, `admin` or `ppd_officer`, cannot move users between schools and cannot disable their own account; Admin Pusat cannot grant or demote another Admin Pusat or themselves.
- **Mod Pelajar:** the session carries `mode.isTest`; services pass `scope.isTest` to repositories, which stamp `is_test` on writes and exclude `is_test` rows from every aggregate and from other users' history (BE-FR-33). There is one mechanism only (`POST/DELETE /api/session/mode`); do not add a second "act as user" route (OQ-17).
- Audit: write `audit_events` through the audit service for the actions in URS BE-NFR-08; content is ids and codes, never personal text. No UPDATE or DELETE path to that table.
- Rate limits: login, registration, password reset, upload and ticket creation (BE-NFR-04); breach is 429 `RATE_LIMITED` with `retryAfter`.

### 9.3 Transactions

Use the helper of BE-02 (`db/transaction.ts`: commit on success, rollback on throw, nested calls reuse the outer one). Rules:

1. A request that writes in more than one store uses **one** transaction opened in the service, and passes the transactional client to the other modules' service calls (practice submit calls the wallet service inside the same transaction).
2. Never call a network service (AI provider, file storage upload, e-mail) while a transaction is open. Do I/O first, write second, or write a job row and let the worker do it.
3. Idempotent endpoints rely on a unique constraint (`clientUuid`, `idempotencyKey`, wallet source key), not on a read-then-write race: catch the unique violation and return the first result.
4. Inject `Clock`; use the `Asia/Kuala_Lumpur` helper for day logic.

```ts
async submit(scope: ScopeContext, sessionId: string, input: SubmitRequest) {
  return this.tx.run(async (db) => {
    const session = await this.repo.lockOwnSession(db, scope, sessionId)    // 404 if not own
    if (session.completedAt) throw AppException.conflict(MSG.alreadySubmitted)
    const result = await this.grade(db, session, input)
    await this.wallet.credit(db, scope, result.coins, { source: 'practice', key: sessionId })
    return toSubmitResult(result)
  })
}
```

## 10. Prisma, migrations and legacy columns

Decided in the plan (5, 14): `bigint` identity primary keys serialised as decimal strings; `uuid` for session-like records; `timestamptz` UTC; no soft delete; English enum codes as `text` + `check`; legacy columns on migratable tables.

| Topic | Convention |
|---|---|
| Models | PascalCase singular, `@@map("snake_case_plural")`; fields camelCase with `@map("snake_case")` (guide default) |
| Primary key | `id BigInt @id @default(autoincrement())` in the form BE-02 merges; session-like: `id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid` |
| Timestamps | `createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)`; `updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)` |
| Dates without time | `@db.Date` (subscription start/end, `claimed_on`) |
| Money | `Decimal @db.Decimal(10, 2)` RM; integer sen where the source uses sen |
| Flexible data | `Json` (jsonb) only for mark schemes, blueprints, settings; never to avoid modelling a table |
| Enums | `String` + SQL `CHECK (col IN (...))` written in the migration; no Prisma `enum` |
| Deletion | No soft delete. Deactivation is an `is_active` column only where the mock has one; hard delete otherwise |
| Test data | `isTest Boolean @default(false) @map("is_test")` on tables Mod Pelajar can write |
| Foreign keys | Always declared; index every FK and every column the scope filter uses |
| Legacy | On every table in `migratable-models.json` (below) |

```prisma
model EducationLevel {
  id           BigInt   @id @default(autoincrement())
  code         String   @unique @db.VarChar(10)
  name         String
  isActive     Boolean  @default(true) @map("is_active")
  legacySource String?  @map("legacy_source")
  legacyId     String?  @map("legacy_id")
  legacyHash   String?  @map("legacy_hash")
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt    DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  @@unique([legacySource, legacyId], map: "uq_education_levels_legacy")
  @@map("education_levels")
}
```

In the migration SQL add what Prisma cannot express:

```sql
ALTER TABLE education_levels ADD CONSTRAINT ck_education_levels_legacy_source
  CHECK (legacy_source IS NULL OR legacy_source IN ('cloud', 'my'));
ALTER TABLE education_levels ADD CONSTRAINT ck_education_levels_stage
  CHECK (stage IN ('primary', 'lower_secondary', 'upper_secondary'));
-- self-reference loaded in two passes by the ETL:
ALTER TABLE users ADD CONSTRAINT fk_users_referred_by FOREIGN KEY (referred_by)
  REFERENCES users (id) DEFERRABLE INITIALLY DEFERRED;
```

Migration rules (plan 9 and 14.9):

1. Generate with `prisma migrate dev --create-only`, **read the SQL**, then add the `CHECK`s, deferrable FKs and partial/GIN indexes. Name the folder `<timestamp>_<card>_<what>` (guide default).
2. A merged migration is never edited. If your unmerged migration conflicts after a rebase, delete your folder and regenerate it. One open migration PR per Prisma file at a time.
3. No destructive change (drop column/table, type narrowing) without a two-step plan agreed with the LEAD.
4. Every column that could receive source data is nullable or has a default (a `NOT NULL` without default on a table that receives legacy rows breaks the ETL).
5. Add the model to `prisma/migratable-models.json` and its row to the mapping matrix (plan 14.7) in the same PR; `be:lint:migration` (after BE-34) must pass.
6. Add the double-insert test through `upsertByLegacy` (plan 14.9 item 6).
7. Tables of another owner are never queried; call that module's service.
8. The migration must apply on an empty database **and** on top of the previous head (CI runs both).

## 11. Testing

### 11.1 The pyramid

| Layer | Tool | What it proves | Where |
|---|---|---|---|
| Unit | Vitest, no DB | Pure rules: grading, regrade maths, streak by Malaysia day, selection with a seeded PRNG, mappers, guards with fake requests | `test/<domain>/*.unit.test.ts` |
| Integration | Vitest + supertest + **real PostgreSQL 16** via Testcontainers (fallback: compose `db` on `DATABASE_URL`) | Each endpoint end to end: status, envelope, BM text, role/scope matrix, transaction rollback, constraints | `test/<domain>/*.int.test.ts` |
| Contract / conformance | `@pp/contract` schemas, BE-31 harness (`@pp/contract-tests`) | Every response parses with the contract schema; the same scenario passes against mock and API; OpenAPI breaking-change gate | `test/conformance/<domain>/` |
| Security | supertest | CSRF, rate limit, mass assignment, injection strings, cross-user ids (BE-33 patterns) | `test/security/` |
| Migration | Vitest + Testcontainers | Idempotency, dry-run, rejects, reconciliation on synthetic fixtures | `test/migration/**` |

Do not mock the database or Prisma in repository or endpoint tests. Mocks are allowed for true externals only: the AI provider (the `mock` adapter), the clock (`FixedClock`), file storage (the in-memory `FileStorage`). CI makes no network call to an AI provider.

The harness (BE-02): `apps/api/test/support/db.ts` starts a throw-away Postgres 16, `app.ts` exposes `createTestApp()`. Use `request.agent(app)` so the session cookie is kept; log in as a seeded demo account, read `csrf` from the session body and send it as `X-CSRF-Token` on mutating calls.

```ts
it('creates a level (admin) and rejects a student', async () => {
  const admin = await loginAs(app, 'admin')           // illustrative helper: agent + csrf
  const res = await admin.post('/api/admin/education-levels').set('X-CSRF-Token', admin.csrf).send(validBody)
  expect(res.status).toBe(201)
  expect(CreateLevelResponseSchema.parse(res.body).status).toBe('Tahap Pendidikan berjaya ditambah.')
  const student = await loginAs(app, 'student')
  await student.post('/api/admin/education-levels').set('X-CSRF-Token', student.csrf).send(validBody).expect(403)
})
```

### 11.2 Minimum cases per endpoint

1. Success: status, body parses the contract schema, exact BM strings where any.
2. No session 401; wrong role 403; mutating call without CSRF 403 `CSRF_INVALID`.
3. Out-of-scope id 404 (use two schools or users in the fixture).
4. Each validation rule fails with the mock's `fields` text; an unknown body key is rejected.
5. Conflict and idempotency paths (second submit 409, same `clientUuid` same result).
6. Pagination edges where the endpoint lists: empty, out-of-range page, `pageSize` 100 and 101.
7. For multi-store writes: inject a throw mid-way and assert nothing persisted.
8. For time rules: a fixed clock at 23:59 and 00:00 `+08:00`.

### 11.3 Comparing with the mock

The mock handler is the oracle. For each endpoint pick the fields the mock tests assert (`src/modules/<mNN>/__tests__/mock`) and assert the same values on the same seeded input. A difference is either a listed deviation (appended to `docs/architecture/v2-backend-deviations.md`) or a bug. To capture exact strings and shapes, call the mock handler through its transport in a throw-away script under your scratch folder, never inside `src/`.

### 11.4 Fixtures and names

Fictitious only (AGENTS.md section 7). Use obviously artificial names such as `Murid Ujian Satu`, `Guru Contoh A`, `Sekolah Contoh 1`; e-mails `murid.satu@example.test`; phone numbers `000-0000000`; IC test values from a helper that emits `000000-00-NNNN` (state code 00 is not valid). The canonical demo accounts of [AKAUN-DEMO.md](../AKAUN-DEMO.md) use the reserved domain `demo.test`; the e-mail guard in the seed tests must allow both `example.test` and `demo.test`. Do not copy a name, e-mail or number from the live site, a dump or a screenshot, even to "anonymise it later". Fixture files over 1 MB are blocked by CI.

## 12. Cross-cutting features

- **Seeds** (plan 14.9 item 4, URS BE-FR-32). One file per domain, `prisma/seed/<domain>.ts`, exporting `seed(ctx)`; register it in `seed/index.ts` in dependency order. `ctx` provides the client, a **seeded PRNG** and the fixed seed clock: no `Math.random`, no `Date.now`. Upsert by natural key (code, e-mail, `(class, student)`), never truncate, so seeds coexist with migrated rows; never set `legacy_*`. Mirror what the mock seed observed (counts, codes, labels) and compare with the exported mock seed in a test; never tune numbers to make totals agree. The demo password `Demo1234` may appear only for seeded demo accounts; hash it at seed time (or take `SEED_DEMO_PASSWORD_HASH` from env). `be:db:seed` twice must give identical row counts, and seeding refuses `NODE_ENV=production` unless `--force-demo`.
- **Files** (BE-04). Go through `FileStorage` (`put/get/delete/exists`); validate by magic bytes and per-use size; storage keys are random, never the client file name; serve only through authenticated, scope-checked endpoints with `X-Content-Type-Options: nosniff`.
- **Jobs and OCR** (BE-37). Long work is a row in the `jobs` table claimed with `FOR UPDATE SKIP LOCKED`; handlers are idempotent (key = file hash + stage); OCR runs in worker threads, never on the HTTP event loop; pdfjs runs with scripting disabled.
- **AI** (BE-36). Callers use the `ExtractionProvider` interface only; the `mock` adapter is the default in dev, test and CI; keys come from the environment and are never logged or stored; the redaction step runs before every call; the output type has no status beyond `draft`.
- **Exports and rich text.** Neutralise formula-injection cells (`=`, `+`, `-`, `@`) in CSV/XLSX and sanitise HTML on write (BE-NFR-37, BE-NFR-38).
- **Audit and notifications.** Call the audit service and `NotificationsService.push` from services, never from controllers; a notification failure must not undo the main write.

## 13. Logging, secrets and environment

- Logger: `nestjs-pino` JSON. Log `requestId`, method, route pattern, status, duration, actor id and role code. **Never** log bodies, query strings with personal data, cookies, authorization, passwords, tokens, IC, e-mail, phone, free text, AI prompts or provider responses. Redaction paths are configured once in `common/logging`; do not add `console.log` (an ESLint rule forbids it, guide default). Use ids and codes in messages: `logger.info({ sessionId, mode }, 'practice session completed')`.
- Environment: only through the zod-validated config module (`ConfigService` typed getters). No `process.env` elsewhere. A new key is added to the schema, to `.env.api.example` (placeholder value only) and to plan section 11 or 15.3 if the plan lists keys.
- Secrets: `.env.api` and `.env.db` are git-ignored and per PC. CI uses GitHub Actions secrets and the `gitleaks` step must stay green. You do not get, ask for or use credentials to .cloud or any live system; migration work uses fixtures or an anonymised dump the LEAD supplies out of band.
- Compose `db` publishes no host port; use an uncommitted `compose.override.yaml` for local tools (plan 11).

## 14. Git, PR and sync

Branch `be/<card>-<slug>` from `origin/feature/v2-backend`; claim with a draft PR; commit after each green step as `feat(BE-08): ...`; push at least hourly and at the end of the session; rebase daily; the LEAD merges. The full routine, the Open list, what to do when blocked and the end-of-session report are in [AGENT-SYNC.md](AGENT-SYNC.md) and [sessions.md](sessions.md) section 6; the PR template is in [backend-tasks/README.md](backend-tasks/README.md). With every push update your tracker row, the PR description (status, endpoints, tables, real `be:verify` output, deviations, open questions, mapping-matrix rows) and any doc your card changes.

## 15. Checklist per card

Full lists: plan section 10 (cards) and 14.9 (tables). Requirements: [v2-backend-urs.md](../requirements/v2-backend-urs.md) (each card's requirements are in its section 9.2). Tick every line in the PR with real output.

### 15.1 Every card

- [ ] The card is on the Open list and its dependencies are merged (or you are in `contract-only` mode).
- [ ] Contract committed first; `npm run contract:check` green; deviations listed in the PR and appended to `docs/architecture/v2-backend-deviations.md`.
- [ ] Endpoints use the contract envelope, status codes and exact BM copy (copy-diff table in the PR); every test response is parsed by its contract schema; no response contains a `legacy_` key.
- [ ] Role, scope and CSRF tests per route group (401 / 403 / 404 / `CSRF_INVALID`); strict-schema test with an unknown field.
- [ ] Prisma schema and SQL migration committed; applies on an empty database and on the previous head; no merged migration edited.
- [ ] Table checklist (plan 14.9): `migratable-models.json`, legacy pair and unique, enums as `text` + `check`, nullable or default, mapping-matrix row, double-insert test.
- [ ] Unit tests for rules, integration tests for each endpoint including validation errors, compared with the mock on the tested fields.
- [ ] Multi-store writes tested for atomicity; retryable writes tested for idempotency; time rules tested with the fixed clock.
- [ ] Seed module idempotent, deterministic, fictitious, registered in `be:db:seed` where the card says so.
- [ ] No secrets, no real names or personal data in code, seeds, fixtures, logs or docs; logs verified free of personal data.
- [ ] `npm run be:verify` green with the output pasted; root `typecheck` and `test` green if `packages/**` changed.
- [ ] Security review requested if the card says so (auth, scope, personal data, uploads, AI egress, migration data).
- [ ] PR template filled; tracker row updated; open questions listed; branch pushed.

### 15.2 Extra items by domain

| Domain (cards) | Also check |
|---|---|
| Platform (BE-01, BE-02, BE-31 to BE-33) | Health and readiness shape; image runs non-root and read-only; CI path filter; conformance coverage printed; OpenAPI diff gate demonstrated; rate limits and audit coverage tested per BE-33; runbook executed once (backup and restore). |
| Identity (BE-03 to BE-07, BE-25) | argon2id and `$2y$` rehash; IC never stored or logged in clear; throttle and `retryAfter`; session id regenerated on login, role switch and mode change; guards read the active role; reset tokens hashed and single-use; invite tokens hashed; school-admin cross-school 404. |
| Reference data (BE-08) | Seeded counts equal the mock seed counts (asserted, not hard-coded); derived `subject_levels` rule unit-tested; DSKP JSON loads. |
| Question bank (BE-09, BE-10) | Only the owner service touches question tables; no answer key, scheme or explanation in any student response before check; transitions and gates tested for every role; versioning and report statuses; templates and exports neutralise formulas. |
| Practice and wallet (BE-11 to BE-13, BE-23) | One transaction with a forced-failure test; `clientUuid` replay; Malaysia-day boundary tests; ledger sum equals balance; stock races; answer rows carry the curriculum dimensions; read models use dimensions, not a question join. |
| Bijak (BE-14 to BE-16, BE-39) | Marking only through `@pp/exam-core`; deadline from the server clock; recursive key-scan test; concurrent submit test; sweeper test with a fixed clock; publish gate and immutable blueprint versions. |
| Classes and reports (BE-17 to BE-22) | Aggregates in SQL; `is_test` excluded; scope per role; the figures recorded for BE-13/19/22 performance clauses; ETag and `no-store` on Command Center; exports neutralised; no wellbeing or `faith` data. |
| Content and support (BE-24) | HTML sanitised on write; unpublished content never public; ticket user from the session only; admin notified, failure does not undo the ticket. |
| Intake and AI (BE-36 to BE-40) | No network in CI; redaction canary; key never in output; budget thresholds with a fixed clock; AI cannot approve; upload and PDF limits tested with generated PDFs; jobs survive restart; retention job on a fixed clock. |
| Migration (BE-27 to BE-30, BE-34, BE-35) | `--dry-run` default; `--apply` needs a passing dry-run on the same input hash; rejects hold no personal values; loaded + rejected = source; read-only source guard; no dump or `.migration-out/` in git; the lead alone runs the anonymiser. |

## 16. Common mistakes to avoid

| Mistake | Why it hurts | Do instead |
|---|---|---|
| Re-wording or "fixing" a BM message | The UI and tests expect the exact mock text | Copy; add the copy-diff table to the PR |
| Returning 403 for another school's or user's id | Leaks that the id exists | 404 with the not-found message |
| Reading `schoolId`, role or scope from the body or query | Privilege escalation | Scope from `ScopeContext` only; strict schemas |
| A repository method without the scope argument | Cross-tenant read | Scope is the first parameter; review rejects otherwise |
| Importing another module's repository or Prisma model | Breaks store ownership (ADR-0014) | Call its exported service |
| Hand-editing `openapi.json` or a merged migration | Conflicts, drift | `contract:emit`; regenerate your unmerged migration |
| Writing the endpoint before the contract | UI and API drift | Contract commit first |
| Importing `z` from `'zod'` in the contract | OpenAPI metadata is missing | `import { z } from '../zod'` |
| Using `Date.now()`, `new Date()`, `Math.random()` in services or seeds | Flaky tests, non-deterministic data | Inject `Clock` and the seeded PRNG |
| `JSON.stringify` of a `BigInt`, or numeric ids on the wire | Crash or precision loss; contract says string | Mapper converts with `db/ids.ts` |
| Doing network or file I/O inside an open transaction | Long locks, partial state | I/O outside, or write a job row |
| Read-then-write for idempotency | Race creates duplicates | Unique constraint and catch the violation |
| Loading all rows then counting in JS | Slow and wrong at scale | SQL aggregates, pagination |
| Prisma `enum`, `NOT NULL` without default on a migratable table, no legacy columns | Breaks the ETL | `text` + `check`, nullable/default, legacy pair, list the model |
| Seeds that truncate, use real names, or set `legacy_*` | Destroys migrated data, PDPA breach | Upsert by natural key, fictitious data |
| Logging a request body, token, IC or e-mail | PDPA breach (users are minors) | Log ids and codes only |
| Mocking Prisma in repository tests | Passes while the SQL is wrong | Real PostgreSQL via Testcontainers |
| Adding Bearer tokens or a JWT | Contradicts the contract (cookie + CSRF) | Use the session guard |
| A second "act as user" route next to Mod Pelajar | Two mechanisms, wrong audit | Use `POST /api/session/mode` (OQ-17) |
| Inventing a rule the mock does not have | Silent behaviour change | Ask in the PR "Open questions" |
| Editing `src/**`, `e2e/**`, `docs/TRACKER.md` or another lane's files | Merge conflicts, broken frontend | Open a `cross-lane` or `contract` issue |
| Pushing to `feature/v2-backend`, `main`, `feature/student-prototype` | Bypasses review | Only `be/*` branches and PRs |
| Letting the AI service set a status beyond draft or approve | Violates AC-05.6 | Human reviewer endpoints only |
| Skipping the mapping-matrix row | The ETL silently diverges | Add it in the same PR |
| Starting a card that is not on the Open list | Duplicated or premature work | Re-read AGENT-SYNC section 0; report `idle` |

## 17. Where things are

| Need | Go to |
|---|---|
| What the system must do, with acceptance checks | [v2-backend-urs.md](../requirements/v2-backend-urs.md) |
| Design, stack, migration-first, intake | [v2-backend-plan.md](../architecture/v2-backend-plan.md) |
| Task cards, status, lanes | [backend-tasks/](backend-tasks/README.md), [backend-tracker.md](backend-tracker.md), [sessions.md](sessions.md) |
| Rules for every session | [AGENT-SYNC.md](AGENT-SYNC.md) |
| Role to screen matrix | [role-access-matrix.md](../requirements/role-access-matrix.md) |
| Store ownership | [ADR-0014](../adr/0014-store-ownership-and-repositories.md) |
| Contract usage | `packages/contract/README.md` |
| Migration design | [v2-data-migration.md](../architecture/v2-data-migration.md) |
| Question and exam schema | [v2-exam-schema.md](../requirements/v2-exam-schema.md), [v2-question-bank.md](../requirements/v2-question-bank.md) |
