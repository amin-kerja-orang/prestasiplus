# Backend developer guide (v2-backend)

The handbook every backend session follows, on every PC. It turns the plan and the requirements into daily practice so that code written by different people looks the same and behaves the same.

- **Read order for a session:** [AGENT-SYNC.md](AGENT-SYNC.md) (claim a card), the requirements section for your domain in [v2-backend-urs.md](../requirements/v2-backend-urs.md) plus its sections 5 to 7, **this guide**, then your card file.
- **Authority:** TRACKER decisions, requirements, the [plan](../architecture/v2-backend-plan.md), ADRs, this guide, code. Where the plan decides something this guide links it. Where the plan is silent this guide picks the conventional NestJS/Prisma option and marks it **(guide default; LEAD may change)**. Class and helper names in snippets are illustrative: BE-01, BE-02 and BE-03 define the real ones, so read `apps/api/src/common/**` and `apps/api/src/db/**` before writing your first controller.
- **Never invent business rules.** The frontend mock is the behavioural spec, `@pp/contract` is the wire spec. Unknown means a line under "Open questions" in your PR.

## 1. Repository layout

```
apps/api/                         @pp/api (backend-owned)
  src/
    main.ts, app.module.ts
    common/                       config, logging, errors (filter + AppException), pipes (zod), guards,
                                  scope, decorators, pagination helpers, security, health
    db/                           PrismaService, transaction helper, Clock, ids (bigint <-> string)
    modules/<owner>/              one Nest module per owner module of ADR-0014 (see section 2)
    migration/                    .cloud ETL CLI (BE-34, BE-27 to BE-30); never imported by the API
  prisma/
    schema/base.prisma            datasource + generator (prismaSchemaFolder)
    schema/<owner>.prisma         one file per owner module
    migrations/                   append-only SQL
    migratable-models.json        models that can receive legacy rows (lint input)
    seed/index.ts, seed/<domain>.ts
  test/
    support/{db.ts,app.ts}        Testcontainers + createTestApp()
    <domain>/*.unit.test.ts, *.int.test.ts, *.conformance.test.ts
    fixtures/                     fictitious fixtures only
packages/contract/src/<domain>/   zod schemas, paths registration (you own new domain folders; lead owns common/session/auth/access)
packages/exam-core/               shared marking and blueprint engine (BE-14)
docker/api/Dockerfile, .github/workflows/api.yml
```

Who may edit what is in [sessions.md](sessions.md) sections 5 and 6 and plan section 9; this guide does not repeat it. You never edit `src/**`, `e2e/**`, `docs/TRACKER.md`, or another lane's folders.

## 2. Module anatomy

One Nest module per owner module. A module owns its tables; everything else goes through its exported service (ADR-0014).

```
apps/api/src/modules/curriculum/
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

Naming (guide default): files `kebab-case.<role>.ts`; classes `PascalCase` + role (`CurriculumService`); DB tables `snake_case` plural; contract schemas `<Thing>Schema`, request types `<Verb><Thing>Request`; no `class-validator` DTO classes, the contract zod schemas are the DTOs. Cross-module imports use the barrel `modules/<owner>/index.ts` exporting only the service and its public types. An ESLint `no-restricted-imports` rule blocks `modules/*/**.repository` imports from other modules (guide default).

## 3. Contract-first, and how to read a mock handler

Order of work for every card (plan 6.2): 1 read SRS + mock handler + frontend client types; 2 contract commit; 3 contract PR if the lead must align the UI; 4 implement; 5 verify. The contract describes the **current mock wire shape**, so the later frontend switch is a no-op. Ids become strings (OD-9), timestamps `+08:00`; anything else you change is a listed deviation.

### 3.1 Reading a handler: checklist

For each `route(...)` in `src/modules/<mNN>/mock/handlers/*.ts` write down:

1. Method and path string (keep it exactly, including BM paths). Path params and their parsers.
2. Guards: `requireRole(...)`, `requireAuth()`, `requireOwner(...)` mean 401/403/404 rules.
3. Input: `normalise()` style trimming ("" becomes null), validation rules and their message strings, unknown-field behaviour.
4. Existence checks and the exact not-found message.
5. Side effects: which other store is written (ADR-0014 hooks), what happens in one transaction.
6. Responder: `ok` 200, `created` 201, `noContent` 204, `paged/paginate` list envelope, `raw` (un-enveloped), and **extra keys next to `data`** (for example `status` flash text).
7. Where the data comes from: the repository and seed (for the seed module) and any counts computed from another store.

### 3.2 Worked example: `POST /api/admin/education-levels` (M03)

Source: `src/modules/m03-curriculum/mock/handlers/admin-levels.ts` and `admin-common.ts`.

| Item | What the mock does | Backend consequence |
|---|---|---|
| Guard | `[adminOnly]` = `requireRole('admin')` | `@Roles('admin')`; no session 401, other role 403 |
| Input | `normalise(body)`: strings trimmed, `""` to `null` | Contract strict schema with a trimming preprocess (document it) |
| Rules | `name`, `nameEn`, `curriculum`: required string max 255; `code`: required string max 10 and unique (case-insensitive against other levels); `stage`: one of `primary`, `lower_secondary`, `upper_secondary`; `order`: optional integer at least 0 (a numeric string is accepted: "form posts send text") | Zod fields; uniqueness is a **service rule** returning 422 `fields.code`, backed by a unique index |
| Validation errors | `validationError(fields)`: 422 `VALIDATION_ERROR`, `message` = first field message (+ "(and N more errors)"), `fields` = field to message; messages are Laravel-style English defaults such as `The :attribute field is required.` | Reproduce byte for byte (see NQ-4 in the URS); capture the strings by calling the mock |
| Success | `created(level, { status: 'Tahap Pendidikan berjaya ditambah.' })` | 201 `{ data: EducationLevel, status: <BM flash> }`; keep `status` |
| Not found (other routes) | `notFound('Tahap Pendidikan tidak dijumpai.')` | `NOT_FOUND` 404 with that message |

Step 1, contract (`packages/contract/src/curriculum/levels.ts`, then register it in `COMPONENT_SCHEMAS` and `openapi.ts`, run `npm run contract:emit`, commit `openapi.json`):

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

Note: the zod messages must produce the mock's strings. Either use zod `error` maps that return the mock text or map zod issues to `fields` in one shared formatter in `common/` (the formatter is BE-01's; do not write one per module).

Step 2, Prisma (`schema/curriculum.prisma`) and migration, see section 7. Step 3, implementation:

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

Step 4, tests (`apps/api/test/curriculum/levels.int.test.ts`): no session 401, student 403, valid body 201 and the body parses `CreateLevelResponseSchema`, each rule violated gives 422 with the exact `fields` text, duplicate code 422, strict schema rejects an unknown key, the row exists with `legacy_source` null. Then compare with the mock on the tested fields (section 9.3).

## 4. Errors, envelopes and BM messages

Authority: `packages/contract/src/common/{error,envelope}.ts`, `auth/errors.ts`; plan 6.1; URS BE-NFR-22 to 25.

| Case | Status | `code` | Where the message comes from |
|---|---|---|---|
| Body/query/param invalid | 422 | `VALIDATION_ERROR` + `fields` | mock rule strings |
| No or expired session | 401 | `UNAUTHORIZED` | mock/contract |
| Wrong role or capability | 403 | `FORBIDDEN` | mock |
| Missing or wrong CSRF | 403 | `CSRF_INVALID` | `AUTH_ERROR_MESSAGES` |
| Unknown id **or out of scope** | 404 | `NOT_FOUND` | the module's exact not-found text |
| State conflict, duplicate action, second submit | 409 | `CONFLICT` or a module code | mock |
| Too many attempts | 429 | `RATE_LIMITED` + `retryAfter` (and `Retry-After` header) | `AUTH_ERROR_MESSAGES.RATE_LIMITED` |
| Unexpected | 500 | `SERVER_ERROR` | generic; no stack, no SQL |

Rules:

1. **Throw, do not return.** Services throw `AppException` (code, message, optional `fields` / `details` / `retryAfter`); the single exception filter in `common/errors` builds `{ error: { code, message, fields?, details?, retryAfter?, requestId } }` and picks the status from `ERROR_STATUS` / `AUTH_ERROR_STATUS`. Never build an error body by hand in a controller.
2. **Module codes** live in the module's `*.errors.ts` and are added to the contract (`<domain>/errors.ts`, status map and message map, like `auth/errors.ts`) before use.
3. **BM copy is copied, never composed.** Search the mock handler, the SRS section "States & messages" and the contract for the string, paste it into the module's constants, and add a "copy diff" table to the PR (mock string, your string, identical yes/no). Do not translate, fix punctuation or re-word. If no copy exists anywhere, use the contract's proposed copy or raise a question; do not write new BM.
4. Never leak existence: login failure is always `INVALID_CREDENTIALS`; cross-scope ids are 404.
5. Success shapes: `{ data }`, `{ data, meta }` or the mock's un-enveloped body when the handler used `raw`. Keep extra keys next to `data` (`status`).
6. Dev/test mode parses every response with the contract schema (`ZodSerializerInterceptor`); a mismatch fails the test, in production it only logs.

## 5. Authentication, roles, scope

Decided in the plan (3, "Auth" and "Authorisation"): server-side session in PostgreSQL, HTTP-only cookie, `X-CSRF-Token` on non-GET, no JWT, no Bearer.

- Default-deny: a global `AuthGuard`; public routes use an explicit `@Public()`. Add `@Roles(...)` (active role) and, where the access matrix defines one, `@Capability('...')` (reads `capabilitiesFor(role, scope)` from `@pp/contract/access`). The guard checks the **active** role, not the role list.
- `ScopeContext` is built by the server from the account (level, school, district, class set). Inject it with a param decorator; never read a school id, role or scope from query, body or headers. Request schemas are strict, so a stray `scope` or `schoolId` field is a 422.
- Every repository method takes the scope as its first argument and applies the helper, so a forgotten filter does not compile:

```ts
async findStudent(scope: ScopeContext, id: bigint) {
  const row = await this.db.user.findFirst({ where: { id, role: 'student', ...scope.schoolWhere() } })
  return row ?? null            // the service turns null into the module's NOT_FOUND 404, never 403
}
```

- A school admin reads own school only, a teacher own classes, a student own rows (`requireOwner` in the mock means owner check, 404 otherwise).
- Mod Pelajar: the session carries `mode.isTest`; services pass `scope.isTest` to the repositories, which stamp `is_test` on writes and exclude `is_test` rows from every aggregate (URS BE-FR-33).
- Passwords: argon2id for new hashes; accept bcrypt `$2y$` as `$2b$` and rehash on first login; never log or return a hash. IC: hash + mask only.
- Audit: write `audit_events` through the audit service for the actions listed in URS BE-NFR-08; content is ids and codes, never personal text.

## 6. Pagination and transactions

**Pagination.** Replicate `src/mock/server/paginate.ts`: query `page` (default 1, invalid means 1) and `pageSize` (contract `PageQuerySchema`, max 100); `totalPages = max(1, ceil(total / pageSize))`; an out-of-range page is an empty page that keeps the requested `page`; `from`/`to` are 1-based, `null` when empty; named totals go in `meta.counts`. Use the shared helper in `common/pagination` (do not re-implement per module):

```ts
const [rows, total] = await Promise.all([
  this.db.question.findMany({ where, orderBy: [{ id: 'asc' }], skip: (page - 1) * pageSize, take: pageSize }),
  this.db.question.count({ where }),
])
return { data: rows.map(toQuestionListItem), meta: pageMeta(total, { page, pageSize }, rows.length) }
```

Always add a deterministic tie-break (`id`) to `orderBy`. Endpoints the mock returns unpaged (`unpaged(items)`) stay unpaged but must still be bounded by the data they list (reference data). Aggregates and counts are SQL (`groupBy`, `$queryRaw`), never "load all rows then count".

**Transactions.** Use the helper of BE-02 (`db/transaction.ts`: commit on success, rollback on throw, nested calls reuse the outer one). Rules:

1. A request that writes in more than one store uses **one** transaction opened in the service, and passes the transactional client to the other modules' service calls (for example practice submit calls the wallet service inside the same transaction).
2. Never call a network service (AI provider, file storage upload, e-mail) while a transaction is open. Do I/O first, write second, or write a job row and let the worker do it.
3. Idempotent endpoints rely on a unique constraint (`clientUuid`, `idempotencyKey`), not on a read-then-write race; catch the unique violation and return the first result.
4. Inject `Clock`; never `Date.now()` or `new Date()` in services. Day logic uses the `Asia/Kuala_Lumpur` helper from `db/clock.ts`.

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

## 7. Prisma conventions and migrations

Decided in the plan (5, 14): `bigint` identity primary keys serialised as decimal strings; `uuid` for session-like records; `timestamptz` UTC; no soft delete; English enum codes as `text` + `check`; legacy columns on migratable tables.

| Topic | Convention |
|---|---|
| Models | PascalCase singular, `@@map("snake_case_plural")`; fields camelCase with `@map("snake_case")` (guide default) |
| Primary key | `id BigInt @id @default(autoincrement())` as the form BE-02 merges; session-like: `id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid`. Convert at the mapper with the helper in `db/ids.ts`; never `JSON.stringify` a `BigInt`. |
| Timestamps | `createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)`; `updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)` |
| Dates without time | `@db.Date` (for example subscription start/end) |
| Money | `Decimal @db.Decimal(10, 2)` RM; integer sen where the source uses sen |
| Flexible data | `Json` (jsonb) only for mark schemes, blueprints, settings; never to avoid modelling a table |
| Enums | `String` + SQL `CHECK (col IN (...))` written in the migration; no Prisma `enum` |
| Deletion | No soft delete. Deactivation is an `is_active` column only where the mock has one; hard delete otherwise |
| Test data | `isTest Boolean @default(false) @map("is_test")` on tables Mod Pelajar can write |
| Foreign keys | Always declared; index every FK and every column the scope filter uses |
| Legacy | On every table in `migratable-models.json` (below) |

```prisma
model EducationLevel {
  id          BigInt   @id @default(autoincrement())
  code        String   @unique @db.VarChar(10)
  name        String
  isActive    Boolean  @default(true) @map("is_active")
  legacySource String? @map("legacy_source")
  legacyId     String? @map("legacy_id")
  legacyHash   String? @map("legacy_hash")
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  @@unique([legacySource, legacyId], map: "uq_education_levels_legacy")
  @@map("education_levels")
}
```

Migration rules (plan 9 and 14.9):

1. Generate with `prisma migrate dev --create-only`, **read the SQL**, then add what Prisma cannot express: `CHECK` constraints, `DEFERRABLE INITIALLY DEFERRED` FKs for self-references, partial/GIN indexes. Name the folder `<timestamp>_<card>_<what>` (guide default).
2. A merged migration is never edited. If your unmerged migration conflicts after a rebase, delete your folder and regenerate it. One open migration PR per owner module at a time.
3. No destructive change (drop column/table, type narrowing) without a two-step plan agreed with the LEAD.
4. Every new column that could receive source data is nullable or has a default (a `NOT NULL` without default on a table that receives legacy rows breaks the ETL).
5. Add the model to `prisma/migratable-models.json` and its row to the mapping matrix (plan 14.7) in the same PR; `be:lint:migration` must pass.
6. Add the double-insert test through `upsertByLegacy` (14.9 item 6).
7. Tables of another owner are never queried; call that module's service.

## 8. Seeds

Plan 14.9 item 4 and URS BE-FR-32.

- One file per domain, `prisma/seed/<domain>.ts`, exporting `seed(ctx)`; register it in `seed/index.ts` in dependency order. `ctx` provides the client, a **seeded PRNG** and the fixed seed clock. No `Math.random`, no `Date.now`.
- Idempotent: upsert by natural key (code, email, `(class, student)`), never truncate, so seeds coexist with migrated rows. Never set `legacy_*`.
- Mirror what the mock seed observed (counts, codes, labels) and compare with the exported mock seed in a test; never tune numbers to make totals agree.
- Fictitious data only (section 9.4). The demo password `Demo1234` may appear only for seeded demo accounts of `docs/AKAUN-DEMO.md`; hash it at seed time (or take `SEED_DEMO_PASSWORD_HASH` from env), never store the plain value in a table.
- `be:db:seed` twice must give identical row counts (a test asserts it).

## 9. Testing

### 9.1 The pyramid

| Layer | Tool | What it proves | Where |
|---|---|---|---|
| Unit | Vitest, no DB | Pure rules: grading, regrade maths, streak by Malaysia day, selection with a seeded PRNG, mappers, guards with fake requests | `test/<domain>/*.unit.test.ts` |
| Integration | Vitest + supertest + **real PostgreSQL 16** via Testcontainers (fallback: compose `db` on `DATABASE_URL`) | Each endpoint end to end: status, envelope, BM text, role/scope matrix, transaction rollback, constraints | `test/<domain>/*.int.test.ts` |
| Contract / conformance | `@pp/contract` schemas, BE-31 harness | Response parses with the contract schema; same scenario passes against mock and API; OpenAPI breaking-change gate | `test/<domain>/*.conformance.test.ts` |
| Security | supertest | CSRF, rate limit, mass assignment, injection strings, cross-user ids (BE-33 patterns) | `test/security/` |

Do not mock the database or Prisma in repository or endpoint tests. Mocks are allowed for true externals only: the AI provider (the `mock` adapter), the clock (`FixedClock`), file storage (the in-memory `FileStorage`).

### 9.2 Minimum cases per endpoint

1. Success: status, body parses the contract schema, exact BM strings where any.
2. No session 401; wrong role 403; mutating call without CSRF 403 `CSRF_INVALID`.
3. Out-of-scope id 404 (use two schools/users in the fixture).
4. Each validation rule fails with the mock's `fields` text; unknown body key rejected.
5. Conflict/idempotency paths (second submit 409, same `clientUuid` same result).
6. Pagination edges where the endpoint lists: empty, out-of-range page, `pageSize` max.
7. For multi-store writes: inject a throw mid-way and assert nothing persisted.

### 9.3 Comparing with the mock

The mock handler is the oracle. For each endpoint pick the fields the mock tests assert (`src/modules/<mNN>/__tests__/mock`) and assert the same values on the same seeded input. Differences are either a listed deviation (`docs/architecture/v2-backend-deviations.md`, append-only) or a bug. To capture exact strings and shapes, call the mock handler through its transport in a throw-away script under your scratch folder, never inside `src/`.

### 9.4 Fixtures and names

Fictitious only (AGENTS.md section 7). Use obviously artificial names: `Murid Ujian Satu`, `Guru Contoh A`, `Sekolah Contoh 1`; e-mails `murid.satu@example.test`; phone numbers `000-0000000`; IC test values from a helper that emits `000000-00-NNNN` (state code 00 is not valid). Do not copy a name, e-mail or number from the live site, a dump or a screenshot, even to "anonymise it later". Fixture files over 1 MB are blocked by CI.

## 10. Logging, secrets and environment

- Logger: `nestjs-pino` JSON. Log `requestId`, method, route pattern, status, duration, actor id and role code. **Never** log bodies, query strings with personal data, cookies, authorization, passwords, tokens, IC, e-mail, phone, free text, AI prompts or provider responses. Redaction paths are configured once in `common/logging`; do not add `console.log` (an ESLint rule forbids it, guide default).
- Use ids and codes in log messages: `logger.info({ sessionId, mode }, 'practice session completed')`.
- Environment: only through the zod-validated config module (`ConfigService` typed getters). No `process.env` elsewhere. New key = add to the schema, to `.env.api.example` (placeholder value only) and to plan section 11/15.3 if the plan lists keys.
- Secrets: `.env.api` and `.env.db` are git-ignored and per PC. CI uses GitHub Actions secrets. The `gitleaks` step must stay green. You do not get, ask for or use credentials to .cloud or any live system; migration work uses fixtures or an anonymised dump the LEAD supplies out of band.
- Compose `db` publishes no host port; for local tools use an uncommitted `compose.override.yaml` (plan 11).

## 11. Git, PR and sync (short)

Branch `be/<card>-<slug>` from `origin/feature/v2-backend`; claim with a draft PR; commit after each green step as `feat(BE-08): ...`; push at least hourly and at the end of the session; rebase daily; the LEAD merges. Details: [AGENT-SYNC.md](AGENT-SYNC.md), plan 9. Update your tracker row and the PR description with every push (status, endpoints, tables, real `be:verify` output, deviations, open questions, mapping-matrix rows).

## 12. Useful commands

```
npm run contract:emit && npm run contract:check   # after any contract edit
npm run be:db:migrate && npm run be:db:seed
npm run be:test -- apps/api/test/<domain>
npm run be:lint:migration                          # after BE-34
npm run be:verify                                  # the DoD command
npm run typecheck && npm test                      # root, when packages/** changed
```

## 13. Common mistakes to avoid

| Mistake | Why it hurts | Do instead |
|---|---|---|
| Re-wording or "fixing" a BM message | The UI and tests expect the exact mock text | Copy; add the copy-diff table to the PR |
| Returning 403 for another school's or user's id | Leaks that the id exists | 404 with the not-found message |
| Reading `schoolId`, role or scope from the body or query | Privilege escalation | Scope from `ScopeContext` only; strict schemas |
| A repository method without the scope argument | Cross-tenant read | Scope is the first parameter; review rejects otherwise |
| Importing another module's repository or Prisma model | Breaks store ownership (ADR-0014) | Call its exported service |
| Hand-editing `openapi.json` or a merged migration | Conflicts, drift | `contract:emit`; regenerate your unmerged migration |
| Writing the endpoint before the contract | UI and API drift | Contract commit first |
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
| Inventing a rule the mock does not have | Silent behaviour change | Ask in the PR "Open questions" |
| Editing `src/**`, `e2e/**`, `docs/TRACKER.md` or another lane's files | Merge conflicts, broken frontend | Open a `cross-lane` or `contract` issue |
| Pushing to `feature/v2-backend`, `main`, `feature/student-prototype` | Bypasses review | Only `be/*` branches and PRs |
| Letting the AI service set a status beyond draft or approve | Violates AC-05.6 | Human reviewer endpoints only |
| Skipping the mapping-matrix row | The ETL silently diverges | Add it in the same PR |

## 14. Definition of Done checklist

Full list: plan section 10 (cards) and 14.9 (tables). Requirements: [v2-backend-urs.md](../requirements/v2-backend-urs.md). Tick every line in the PR with real output.

- [ ] Contract committed first; `npm run contract:check` green; deviations listed in the PR and appended to `docs/architecture/v2-backend-deviations.md`.
- [ ] Endpoints of the card use the contract envelope, status codes and exact BM copy (copy-diff table in the PR); every test response parsed by its contract schema.
- [ ] Role, scope and CSRF tests per route group (401 / 403 / 404 / `CSRF_INVALID`).
- [ ] Prisma schema and SQL migration committed; applies on an empty database and on the previous head; no merged migration edited.
- [ ] Table checklist 14.9: `migratable-models.json`, legacy pair and unique, enums as `text` + `check`, nullable/default, matrix row, double-insert test.
- [ ] Unit tests for rules, integration tests for each endpoint including validation errors, compared with the mock on the tested fields.
- [ ] Multi-store writes tested for atomicity; retryable writes tested for idempotency.
- [ ] Seed module idempotent, deterministic, fictitious, registered in `be:db:seed`.
- [ ] No secrets, no real names or personal data in code, seeds, fixtures, logs, docs.
- [ ] `npm run be:verify` green, output pasted; root `typecheck` and `test` green if `packages/**` changed.
- [ ] Security review requested if the card is marked so (auth, scope, personal data, uploads, AI egress, migration data).
- [ ] PR template filled; tracker row updated; open questions listed; branch pushed.
