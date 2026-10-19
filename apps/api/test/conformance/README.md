# Conformance suite: API target (BE-31)

The contract is the acceptance test of the API. The shared scenarios of `@pp/contract-tests`
(`packages/contract-tests/src/scenarios`) run here against the real API: Nest in process, supertest
as the `HttpClient`, a fresh migrated and seeded PostgreSQL per run (Testcontainers, a clone of the
template database), a fixed clock and a temporary upload folder.

```
npm run conformance:api          # = npm run be:test -- test/conformance
CONFORMANCE_LIST=1 npm run conformance:api   # also list uncovered / not-yet-implemented operations
CONFORMANCE_MIN_COVERAGE=100 npm run conformance:api
npm run conformance              # the same scenarios against the frontend mock (about 1 minute)
```

`be:test` takes its path relative to `apps/api` (`test/conformance`), not `apps/api/test/conformance`.
The folder is part of `npm run be:verify`, so CI runs it on every PR.

## Files

| File | Purpose |
|---|---|
| `run.spec.ts` | Boots the app, runs shared + API-only scenarios, prints the run summary and the coverage report, fails on a violation or a stale known mismatch |
| `negative.spec.ts` | Proves the suite fails: a test-only controller breaks its response schema (AC3), exposes a `legacy_` key (AC5); known-mismatch and not-yet-implemented handling |
| `boot.ts` | The whole API (`featureModules`) on a seeded database; the environment (`conformanceEnv`) and the seed list (`CONFORMANCE_SEEDS`) |
| `api-target.ts` | The API `Target`: supertest adapter (`set-cookie`, multipart), route introspection, per-scenario client address, cookie + CSRF login |
| `accounts.ts` | Role to seeded account table (the BE-07 hook, see below) |
| `known-mismatches.ts` | Understood differences, each tied to a row of `docs/architecture/v2-backend-deviations.md` |
| `scenarios.ts` | The scenario list: shared scenarios plus one spread line per domain folder |
| `<domain>/*.ts` | API-only deep scenarios of that domain (`auth`, `users`, `schools`, `files`) |

## How it stays deterministic

- Each scenario gets its own client address (`X-Forwarded-For`, `TRUST_PROXY_HOPS=1`), so the login
  counters (5 per minute per identifier and address, 20 failures per address) of one scenario never
  reach another, and the throttle scenario can prove the 6th attempt is 429 with the production
  limits. The login limits are NOT raised.
- The volume-based ceilings (public and admin reads and writes, import, uploads, file reads) are
  raised through their documented environment variables in `conformanceEnv`. No production code is
  changed or bypassed.
- No failed-login delay and a cheap dummy bcrypt (`LOGIN_FAILURE_FLOOR_MS=0`, `LEGACY_BCRYPT_DUMMY_COST=4`), as in every other integration suite.

## Not yet implemented

An operation counts as implemented when the Nest app registered a route for it. A scenario that
needs an operation without a route stops there and is reported as "not yet implemented" (never as a
failure, and the request is not sent). The coverage report counts only implemented operations in its
percentage and lists the others. When a later card adds its controller, its operations enter the
percentage automatically and its scenarios start to run; nothing needs unlisting.

## Adding scenarios (every domain card)

1. If the scenario also makes sense on the mock, add it to the package (`packages/contract-tests/src/scenarios`).
2. If it needs a cookie session with CSRF, a file part or seeded data, add `apps/api/test/conformance/<domain>/<name>.ts`
   exporting a `Scenario[]` with `targets: ['api']` (new file only) and one import + one spread line in `scenarios.ts`.
3. A difference between the API and a shared scenario goes in `known-mismatches.ts` with the deviation row; never skip silently.
4. Run `npm run conformance:api` and paste the tail in the PR.

## Hook for BE-07 (demo accounts)

The suite uses the accounts of the core identity seed (`pelajar@demo.test`, `guru@demo.test`,
`adminsekolah@demo.test`, `admin@demo.test`, ...). When BE-07 merges, add its seed to
`CONFORMANCE_SEEDS` in `boot.ts` and update the table in `accounts.ts`; nothing else names an
account. `ppd_officer` and `jpn_officer` have no seeded account yet, so a scenario asking for one
fails with a clear message.
