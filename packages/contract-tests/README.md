# @pp/contract-tests

The contract is the acceptance test for both implementations (ADR-0018 item 5, BE-31). This package
holds HTTP-level scenarios written against a tiny `HttpClient` interface. The same scenarios run
against the frontend mock and, after BE-03, against the NestJS API.

**Every later BE card adds its scenarios here.** One file per domain in `src/scenarios/<domain>.ts`
(new file, spread into `allScenarios` in `src/scenarios/index.ts`: one added line). A card is not
done until its endpoints are touched by a scenario.

## What the runner checks

For every response of every scenario call:

1. The request matches an operation of `packages/contract/openapi.json` (else `unknown_operation`).
2. The status is declared for that operation (else `undocumented_status`).
3. The body parses with the response schema of that path + method + status (else `schema`). The
   schema is built from `openapi.json` with `z.fromJSONSchema`; a nullable `$ref`
   (`allOf: [$ref, {type: [T, "null"]}]`, 61 places) is read as `anyOf: [$ref, null]`.
4. No key at any depth starts with `legacy_` (else `legacy_key`; plan 14.2, AC5).
5. A 204 or other body-less response has no body.

Scenario assertions (`ctx.expectStatus`, `ctx.check`) add `assertion` violations. A violation never
aborts the run; all are collected and reported.

### Coverage (AC2)

`computeCoverage` lists every operation in `openapi.json` and whether a scenario sent a request to
it, grouped by tag, and prints the covered percentage. `CONFORMANCE_MIN_COVERAGE` (percent, default
`0`) is the failure threshold. The lead raises it (100 for carded domains) in wave 4.

### Known mismatches

A mismatch that is understood is listed in the target's `knownMismatches` (`{ scenario, kind?,
reason }`). The runner reports it apart from real failures and does not fail on it. An entry that no
longer occurs is reported as **stale** and fails the run, so the list can only shrink. Nothing in
`packages/contract` or `src/**` is edited to make a scenario pass.

## The `HttpClient` interface

```ts
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
interface HttpClient {
  request(
    method: HttpMethod,
    path: string, // relative to the contract server base: '/articles', never '/api/articles'
    init?: { body?: unknown; headers?: Record<string, string> },
  ): Promise<{ status: number; headers: Record<string, string>; body: unknown }>
}
```

Header names are lower-case. Several `set-cookie` values are joined with a newline. A transport
never throws for an HTTP error status. A `Target` adds `name`, `anonymous` (a client with no
credentials), `actor(role)` (a client logged in as a seeded account) and `credentials(role)`.

Session helpers (`src/session.ts`): `sessionLogin(client, { identifier, password })` does
`POST /auth/login`, keeps the cookies, and sends `X-CSRF-Token` (`Session.csrf`) on every non-GET
call; `.withoutCsrf()` gives the same session without the header for `CSRF_INVALID` scenarios.

### Sample adapter (the frontend mock, 15 lines, AC7)

This is `mockClient` in `mock/mock-client.ts`:

```ts
export function mockClient(transport: Transport, token?: string): HttpClient {
  return {
    async request(method: HttpMethod, path: string, init: HttpRequestInit = {}) {
      const headers: Record<string, string> = { accept: 'application/json', ...init.headers }
      if (token) headers.authorization = `Bearer ${token}`
      const res = await transport.request({
        method,
        url: `/api${path}`,
        headers,
        ...(init.body === undefined ? {} : { body: init.body }),
      })
      return { status: res.status, headers: res.headers, body: res.body ?? null }
    },
  }
}
```

The mock still has numeric ids and `Z` instants where the wire has string ids and `+08:00`
(ADR-0018 item 6). `mockTarget` applies that documented mapping (`withWireMapping`) to response
bodies, otherwise every response with an id fails and hides the real mismatches. `MOCK_RAW=1` turns
it off. The mock logs in with `{ email, password }` and a Bearer token (no cookie, no CSRF), so its
`actor()` uses that login.

## Commands

Against the frontend mock now (boots the whole mock registry, about 1 minute):

```
npm test -w @pp/contract-tests                       # harness unit tests + the mock run
npx vitest run --project unit --disableConsoleIntercept packages/contract-tests/mock   # also prints the run summary and coverage
CONFORMANCE_MIN_COVERAGE=50 npx vitest run --project unit packages/contract-tests/mock # enforce a threshold
CONFORMANCE_DUMP=out.json npx vitest run --project unit packages/contract-tests/mock   # full result as JSON
npm run typecheck -w @pp/contract-tests
```

Breaking-change gate (local twin of the `openapi-diff` job in `.github/workflows/api.yml`; needs
Docker or an `oasdiff` binary):

```
npm run contract:diff -w @pp/contract-tests                    # HEAD vs the merge-base with origin/feature/v2-backend
npm run contract:diff -w @pp/contract-tests -- --base-ref origin/main
npm run contract:diff -w @pp/contract-tests -- --base a.json --head b.json
npm run contract:diff:samples -w @pp/contract-tests            # 3 breaking samples must fail, 1 additive must pass
```

oasdiff (`tufin/oasdiff:v1.34.0`) fails on severity `ERR`, for example a removed required response
property, a request enum value removed, or a request property that became required. Adding fields,
optional request properties and new paths passes. A PR that must break the contract carries the
label `contract-breaking`.

## Against the NestJS API (after BE-03; not wired yet)

TODO(BE-03): `apps/api/test/conformance/run.spec.ts` builds the Nest app on the seeded database,
wraps supertest in an `HttpClient` (same interface, `set-cookie` surfaced), builds a `Target` whose
`actor(role)` is `sessionLogin(...)` for the seeded account of that role, then calls
`runScenarios(allScenarios(contract), { target, contract })`, prints `formatRun` and
`formatCoverage`, and fails on `report.ok === false` or `coverageFailure(coverage)`. The command
every later card runs will be:

```
npm run be:test -- apps/api/test/conformance
```

BE-03 also adds its scenarios (login success, wrong password, unknown user with an identical
response, throttle on the 6th attempt with `retryAfter`, role switch, Mod Pelajar enter and exit,
logout, missing CSRF 403 `CSRF_INVALID`) as `src/scenarios/auth-*.ts`.

## Layout

```
src/            runner, contract index, coverage, legacy_ guard, session helpers, scenarios
src/scenarios/  auth.ts (smoke), smoke.ts (one per route group, derived from openapi.json), index.ts
mock/           mock adapter, known-mismatches.ts, the mock run (vitest)
scripts/        contract-diff.mjs
diff-samples/   base + 3 breaking + 1 additive sample documents for the gate
```
