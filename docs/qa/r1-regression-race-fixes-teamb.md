# R1 spec race fixes and graded set (team B, lane B4)

Date 2026-11-02. Local stack only, nothing on any server. Verdict: **Ready**. No failure in the graded set.

## 1. What was tested

| Item | SHA |
|---|---|
| Tree under test | `7bb7e4126` on `r1/b4-e2e-flakes` (spec fixes on merge `6c21a9d67` with BASE-211 `21d0586b4`) |
| Integration branch | `0aebfa40b` on `r1/b4-spec-race-fixes`, from BASE-212 `62872d967` |
| Base tip when the runs ended | BASE-212 `62872d967`, docs only since BASE-211, so not re-run |

Outside `docs/`, the tree under test differs from base only in `e2e/` and `playwright.r1-e2e.config.ts`, so the product code tested is that of BASE-211 and BASE-212.

Stack: Postgres 16 container `b4-flakes-pg` (port 55491, UTC), API `dist/main.js` (`NODE_ENV=development`, `JOBS_WORKER_ENABLED=true`, `THROTTLE_GLOBAL_PER_MINUTE=3000`, every other throttle at its default), SPA built `VITE_API_MODE=http --mode demo`, Node 22.23.4, Playwright 1.63.0 CLI. One run at a time, each HTTP run on a new database (migrate, seed `poc`, seed `e2e`) and a new API process checked to own the port. No 429 and no 5xx in the API logs. Other sessions kept the machine at a load average of about 5 to 20.

## 2. The fixes

No assertion was loosened; two got stricter.

- **`buildPaper` (S3b, S3d):** the fixed `waitForTimeout(1000)` before reading the picker is gone, in both the search and the empty-search steps. It waits for that search's own response, requires 200 (new), then waits for the list to show exactly the rows the API offered, less the units already added.
- **`set-builder-responsive`:** each "Tambah" waits for "Dalam set" on its own bank row before the next click. A Naik or Turun click waits for the opposite arrow to open, which also proves the move landed (new).

## 3. Graded set (pass / fail / skip)

| Spec | 1280 | 768 | 375 |
|---|---|---|---|
| `r1-e2e-baseline` | 36 / 0 / 7 | 36 / 0 / 7 | 36 / 0 / 7 |
| `admin-publish-http` | 6 / 0 / 0 | 6 / 0 / 0 | 6 / 0 / 0 |
| `set-builder-responsive` (mock only, no DB or throttle) | 1 / 0 / 0 | 1 / 0 / 0 | 1 / 0 / 0 |
| `e2e/api/icons-no-fetch` | 4 / 0 / 0 | 4 / 0 / 0 | 4 / 0 / 0 |

Skips in the baseline are the known seven: S2g, S2c, S2d, S5d, S3f, S3g, B-02.

## 4. Proof the races are gone

- **`buildPaper`:** a local proxy held every first-page picker answer for 2.5 s, against the 1 s of the old wait. Baseline at 1280 on a fresh DB: 36 / 0 / 7; S3b offered 5 and S3d offered 1, the correct counts.
- **`set-builder-responsive`:** 10 repeats at each of the three widths: 30 of 30 pass. Before the fix it failed every time.

## 5. Note for team C: lost update in the mock

`src/modules/m28-bijak-spm/admin/builder/server/memory.ts` reads, changes and saves a section without a lock across its latency, so two "Tambah" clicks close together lose the first add. It exists only where `VITE_API_MODE` is not `http`, such as a demo build. The real API takes a paper lock in a transaction (`builder.service.ts`, `addPlacement`), and two clicks 0 to 400 ms apart kept both questions in 8 of 8 rounds at 1280 with two single questions. The spec no longer hits it, so nothing will fail if it stays. Low, owner C.

## 6. Reaching integration: `r1/b4-spec-race-fixes`, not this branch

- This branch carries 1,055 files under `docs/qa` (mostly screenshots), so it should not be merged whole.
- `r1/b4-spec-race-fixes` has two commits and five files on BASE-212, with no product code:
  - `4c8d80921`: `admin-publish-http.spec.ts` and `set-builder-responsive.spec.ts`, identical to the tested tip. They already exist in base.
  - `0aebfa40b`: `r1-e2e-baseline.spec.ts`, `e2e/api/helpers.ts`, `playwright.r1-e2e.config.ts`, none of which base has yet in this form. The B-04 and S3d fixes live in that spec.
- **One difference from the tested tip:** the second commit drops `@api` from the baseline's describe title. The CI `e2e-api` job runs `test:e2e:http`, which selects `@api` under `e2e/api/`. With the tag, the spec would add 129 stateful tests to that job (498 to 627) under shorter timeouts. Without it, `test:e2e:http` lists 498 tests, none from this spec, and `playwright.r1-e2e.config.ts` still lists its 129.
- Checked on the branch: lint and type-check clean; baseline 36 / 0 / 7 and `admin-publish-http` 6 / 0 / 0 at 1280 on fresh DBs. The other widths were not repeated there, since only the tag differs.

## 7. Not run

Unit and API DB suites, the CI jobs themselves, default or raised throttles, any server. `admin-publish-http` has not run in the CI job with these changes.
