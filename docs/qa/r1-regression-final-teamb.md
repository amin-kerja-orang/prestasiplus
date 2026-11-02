# R1 final E2E regression (team B, lane B4)

Date 2026-11-02. Local stack only, nothing on any server. Verdict: **Ready**.

## 1. What was tested

| Item | SHA |
|---|---|
| Tree under test | `62de3746d` on `r1/b4-e2e-flakes` (spec fixes `fcb85eadd` merged with BASE-207) |
| Base | `origin/feature/v3-bijak-r1` BASE-207 `7db748ac5` |
| Base tip when the runs ended | BASE-208 `9160bc8d8`, docs only (`git diff 7db748ac5 9160bc8d8` outside `docs/` is empty), so not re-run |

- The tree under test differs from BASE-207 only in `e2e/api/helpers.ts`, `e2e/api/r1-e2e-baseline.spec.ts`, `e2e/bijak/admin-publish-http.spec.ts` and `playwright.r1-e2e.config.ts`. BASE-205 to BASE-207 changes `.github/workflows/api.yml`, `.gitleaksignore` and `docs/TRACKER.md` only, so this is the product code of BASE-205 `87466accd`.
- No spec was changed in this round (`git diff fcb85eadd 62de3746d -- e2e` is empty).

Stack: own Postgres 16 container `b4-flakes-pg` (port 55491, UTC), API `dist/main.js` (`NODE_ENV=development`, `JOBS_WORKER_ENABLED=true`), SPA built `VITE_API_MODE=http --mode demo` on `vite preview`, Node 22.23.4, Playwright 1.63.0 CLI, 1 worker per run.

**Fresh DB, every run:** a new database, then migrate, seed `poc`, seed `e2e`, and a new API process. This closes the gap in the earlier 375 run, where a second API failed to bind and the run used the old database. Before each run the script checked that the started API process owns the port and that the run's database has a connection from it.

Throttle settings:
- **raised:** every `THROTTLE_*` name in `.env.api.example` set to 100000.
- **default:** no `THROTTLE_*` set (global ceiling 300 per address per minute).
- **global 3000:** only `THROTTLE_GLOBAL_PER_MINUTE=3000`, all others default. This matches `deploy/vps/api.env.example:51`, the only throttle that file sets.

## 2. Results

`r1-e2e-baseline` (43 steps):

| Throttles | Execution | 1280 | 768 | 375 |
|---|---|---|---|---|
| raised | parallel lanes | 36 / 0 / 7 | 36 / 0 / 7 | 36 / 0 / 7 |
| global 3000 | serial | 36 / 0 / 7 | 36 / 0 / 7 | 36 / 0 / 7 |
| global 3000 | parallel lanes | 36 / 0 / 7 | not run | not run |
| default | parallel lanes | not run | 31 / 6 / 6 | 32 / 5 / 6 |

Pass / fail / skip. Skips at raised and global 3000 are the same seven as the BASE-205 report: S2g, S2c, S2d, S5d, S3f, S3g, B-02. 768 and 375 at global 3000 were added to the request so that the comparison uses the widths that failed on default.

`admin-publish-http` (6 tests), raised:

| Execution | 1280 | 768 | 375 |
|---|---|---|---|
| serial | 6 / 0 / 0 | 6 / 0 / 0 | 6 / 0 / 0 |
| parallel lanes | 6 / 0 / 0 | 5 / 1 / 0 | 5 / 1 / 0 |

"Opening an existing paper" no longer skips at any width in any run.

## 3. Every failure, with cause and owner

All failures are listed. None is a product fault.

### 3.1 Default throttles: 429 from the global ceiling

| Width | Failed steps (all at `login`, `POST /api/auth/login` answered 429) |
|---|---|
| 768 | B-01, B-02, B-04, B-04c, B-04b, B-05 |
| 375 | S6, B-01, B-02, B-04, B-04c |

- Cause: one test client on one address passes the default 300 requests per minute. The first failure comes late in the run, when the short login-only steps follow each other; every later login then fails until the window clears. 429s in the API log: 18 at 768, 16 at 375, on `/api/session`, `/api/public/stats` and `/api/auth/login`, plus one `/api/bijak/papers/:id/attempts` at 375.
- It is the global bucket and not the login bucket: `GET /api/session` also got 429, and the login throttle stayed at its default in the global 3000 runs with no 429.
- B-02 is a failure here rather than its usual skip because the login fails before the skip is reached. That is why these runs show 6 skips.
- **At the production setting they disappear:** global 3000 serial has 0 429 and 0 5xx at all three widths, about 1,050 requests per run, peak about 490 in any 60 s (ceiling 3000).
- Owner: B4 (harness: use raised throttles or the production value for E2E). Not a product fault.

**Deploy condition (release owner):** the production `api.env` must have `THROTTLE_GLOBAL_PER_MINUTE=3000`. Left unset it is 300, this failure appears, and `deploy/vps/deploy.sh:198` only warns. The live `api.env` was not read for this report.

### 3.2 `admin-publish-http` in parallel lanes: my own load

| Width | Step | Spec line |
|---|---|---|
| 375 | "draft, assemble to Sepadan...": `paper-unpublish` not visible within 5 s after Terbitkan | 287 |
| 768 | same test: `paper-publish` not visible within 5 s after Tarik balik | 300 |

- Cause: three lanes, each with its own API, browser and Chromium, ran at once on one Mac, along with unrelated work on the same machine. The spec uses the 5 s default `expect` timeout. Traces show no error response: at 768 `withdraw` 200 in 2.5 s, then `GET paper` 1.3 s and `GET review` 1.8 s; at 375 `PUT paper` took 4.5 s and `publish` had not answered when the 5 s ended.
- Run alone on a fresh DB, all three widths pass: `publish` 61 to 134 ms, `withdraw` 13 to 27 ms, the whole file about 47 s instead of about 3.5 min. There were no 5xx in either execution.
- Owner: B4 (my run setup). Not a product fault. This says nothing about production capacity, which this report does not measure.

## 4. B-04 at 375

B-04 passed in every run where login was not throttled: 375 raised, 375 global 3000, and the other widths. The race fixed in `fcb85eadd` did not recur. Cause and repeat numbers are in that commit.

## 5. "Belum ada kertas" while the admin paper list loads: confirmed, Low

**Confirmed; a user does see it on a slow connection, at 768 and wider.** Measured on `/admin/spm/kertas` as Admin Pusat, 5 papers in the database:

| Width | While loading | No slowdown | List response held 4 s | Slow 3G (400 ms RTT, 50 KB/s) |
|---|---|---|---|---|
| 1280 | "Belum ada kertas" + "Tekan Kertas Baharu untuk mula." | about 50 ms | until about 4.4 s | about 0.5 s |
| 768 | same | about 60 ms | until about 4.2 s | about 0.4 s |
| 375 | skeleton rows, no empty text | none | none | none |

The cell values are how long the empty text stayed visible. It lasts as long as the list response takes. On all three widths the stat tiles show 0 for Jumlah kertas, Draf and Diterbitkan until the list arrives.

- Cause: `src/ds/DsDataTable.vue` shows a skeleton when `loading && !wide`, but on wide screens it passes `loading` to `UTable` with an `#empty` slot, and that slot renders during the load. A thin loading bar under the table header is the only other sign. The tiles read `data ?? []` in `PaperListPage.vue`.
- Impact: an admin on a slow connection is told briefly that no paper exists, then the list appears. No data is affected and nothing is blocked. The list corrects itself.
- Severity Low, owner C, after R1 (product code is frozen). `DsDataTable` is shared, so other wide lists may do the same; only this screen was measured.

## 6. Not run

Default throttles at 1280 and `admin-publish-http` on default or global 3000 (not asked). Unit and API DB suites, lint, type-check, any server. No load or capacity measurement. `NODE_ENV=development` throughout, not production.

## 7. Verdict: Ready

- `r1-e2e-baseline`: no failure at any width with raised throttles or at the production global setting, each on a fresh DB.
- `admin-publish-http`: no failure at any width when run alone on a fresh DB.
- Every failure in section 3 is explained and is not a product fault.
- Condition: `THROTTLE_GLOBAL_PER_MINUTE=3000` in the production `api.env`.
- Open product finding: section 5, Low, not blocking.
