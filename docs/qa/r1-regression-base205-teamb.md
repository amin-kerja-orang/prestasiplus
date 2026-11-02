# R1 E2E regression on BASE-205 + T10 (team B, lane B4)

Date 2026-11-02. Local stack only, nothing on any server. Tree: branch `r1/b4-e2e-base105-t10` (`r1/t23-e2e-c` + BASE-102 harness fix + T10 + the T10-flow spec + the `Muat lagi` spec fix, previously merged to BASE-195) merged with `origin/feature/v3-bijak-r1` **BASE-205 `87466accd`**, no conflict, as merge commit **`8217030c3`**. Fetch wrapped in `perl -e 'alarm 120; exec @ARGV' git fetch`. `npx prisma generate` run in `apps/api`; API and SPA rebuilt from this tree. All runs were at `8217030c3`. Neither spec file was changed in this round (`git diff` of both specs against the previous commit is empty).

Stack: own Postgres 16 container `b4-e2e-105-pg` (port 55475, UTC, removed afterwards), a fresh DB per width and per spec (migrate, seed `poc`, seed `e2e`), API `dist/main.js` on 3475 (`JOBS_WORKER_ENABLED=true`), SPA built `VITE_API_MODE=http --mode demo` on `vite preview` 5475, Node 22.23.4, Playwright CLI, 1 worker, raised throttle env. No default-throttle run this round (as asked). Only what I started was stopped; `b4-r1e2e-pg` and port 5244 were not touched.

## 1. Verdict: Ready, with one unexplained single failure noted

- First graded run: 1280 and 768 are 36 pass, 0 fail, 7 skip; 375 had **one failure (B-04)**: 35 pass, 1 fail, 7 skip.
- The B-04 failure did not reproduce: B-04 alone at 375, 5 repeats on a fresh DB, all pass; a second complete run at 375 on a fresh DB is 36 / 0 / 7. Its cause was not established (section 3). I call the tree Ready on the repeat evidence, and report the first result as it was.
- `admin-publish-http`: no failure at any width; one test skips at all three widths (a race in the spec, section 4).
- No assertion was wrong because of REQ-B-076, REQ-B-079, the "Soalan ini sudah diterbitkan." flash text or the P2028-to-429 mapping: no step failed on any of them, so no spec was edited.
- No layout break: `expectNoHScroll` passed on every visited screen at 375, 768 and 1280.

## 2. `r1-e2e-baseline` (43 steps), raised throttles

| Width | Pass / Fail / Skip | Failing |
|---|---|---|
| 1280 | 36 / 0 / 7 | none |
| 768 | 36 / 0 / 7 | none |
| 375, first run | 35 / 1 / 7 | B-04 |
| 375, repeat run (fresh DB) | 36 / 0 / 7 | none |

Skips (same at every width and run): S2g (intake editor already set Aras pemikiran), S2c (S2a approved through the UI), S2d and S5d (not applicable since BASE-4), S3f and S3g (papers published through the UI), B-02 (known, "no Sains Kertas 2 paper on the hub; self-mark is covered by S4b").

All steps that failed on earlier bases pass (S1h, S2a, S2e, S3a to S3e, S4b, B-05); no step fails in 1280 or 768. New failures vs BASE-195: only the single B-04 at 375 in the first run. Carried failures: none.

## 3. The B-04 failure at 375 (first run)

- Step: "Simulasi Kuiz in the UI: hub entry, answer, Semak, Tamat, result", failing at its `expect.poll` after pressing next ("Timeout 15000ms exceeded while waiting on the predicate", spec line 2893: waits for `kuiz-done` visible or the counter text to change).
- Trace and page state: the quiz ran fully: 20 `POST .../kuiz/sessions/:id/check` all HTTP 200 (each under 60 ms) and `POST .../finish` HTTP 200 (117 ms); the only non-2xx request in the trace is the usual 401 on `/api/session` before login. The page snapshot at the failure shows "Kuiz Selesai!" with 6/20 and "Masa: 00:03". So the quiz finished in about 3 s, but the poll on the last question did not see `kuiz-done` visible within 15 s. I did not find out why (no 429, no error response).
- Reproduction attempts: B-04 alone at 375, `--repeat-each=5` on a fresh DB: 5 of 5 pass (about 4.6 s each); complete run at 375 on a fresh DB: 36 / 0 / 7, B-04 passes. The BASE-102 report also mentions an earlier B-04 flake. Owner if it recurs: B4 (spec timing) or C (the quiz page at 375); undecided.

## 4. `admin-publish-http`

| Width | Pass / Fail / Skip |
|---|---|
| 1280 | 5 / 0 / 1 |
| 768 | 5 / 0 / 1 |
| 375 | 5 / 0 / 1 |

The skipped test at every width is "opening an existing paper renders the editor read-only path" (the spec's own skip, "no existing paper in this environment"). At BASE-195 it passed at 1280 and skipped at 768 and 375. Cause, verified: the spec reads `open.count()` right after `papers-page` is visible, without waiting for the list to load, so it skips whenever the list is not there yet. On a fresh DB the API lists 6 papers (the e2e K2 fixture paper, the Matematik demo paper and four others). Repeating that single test 6 times at 1280 on a fresh DB gave 5 skips and 1 pass. So the skip is a race in the spec, not a data or product fault (owner B4; the spec was not changed this round). The write test (draft, assemble to Sepadan through the picker pages, Simpan, Terbitkan through the T10 override, student sees it, Tarik balik with its confirm, delete) passes at all three widths.

## 5. Not run

Unit and API DB suites, lint, type-check, a default-throttle run, and the other widths repeated.

## 6. Commits (local, not pushed)

`8217030c3` merge of BASE-205; this report.
