# QA report: M06 SPM (G5)

Scope: roles-matrix row **L18**. Built screens: S1, S2 + Q1, S3, S4 + Q2, S10 (M06-T2); S5, S6 + Q3, S8 (M06-T3); S11, Q4 (provisional), S12, S13 (M06-T4). S7 and S9 are M05-T7 routes already QA'd in M05; here only the links and the BM/BI redirect were checked.
Sources: URS `M06-spm.md` (99 ACs), SRS `M06-spm.md` §0.1, §8, §10, §12, demo accounts in `docs/AKAUN-DEMO.md`.
Branch `feature/student-prototype`, tip 6ae9a2c plus the other sessions' uncommitted working-tree changes at build time.

Method: `npx vite build --mode e2e` into a scratch folder, served by my own `vite preview` on port 5106 (stopped afterwards, PID only). Chromium, projects mobile 375x812, tablet 768x1024, desktop 1280x800, `--workers=1`, 2 retries (0 for targeted re-runs), expect timeout 30 s (20 s in the earlier runs), test timeout 360 s, `E2E_BOOT_MS=150000`. The three Playwright MCP lanes were not used; exploration was done with scripted probes and the error-context snapshots. The machine was at ~100 % CPU the whole time (other agents), cold boot per test was 20-60 s.

## Verdict: READY (with the notes below)

Every in-scope AC was executed and passed on all three widths. There is no open Critical, High or Medium bug. One Low observation (BUG-M06-01) is recorded for the owner; it does not break an AC under normal conditions. Provisional ACs (Q4 AC-20.x, Q1/Q2/Q3 quiz paths L-1..L-5, AC-23.2) pass against their placeholder copy; they stay provisional until the live behaviour is observed.

## Runs

Final full runs (fresh build, all spec files in `e2e/m06-spm/`):

| Width | Tests | Pass | Fail | Flaky (passed on retry) | Duration |
|---|---|---|---|---|---|
| mobile 375 | 139 | **139** | 0 | 0 | 1.6 h (run in parallel with tablet) |
| tablet 768 | 139 | **139** | 0 | 0 | 1.6 h |
| desktop 1280 | 139 | **139** | 0 | 0 | 1.3 h |
| `qa-g5-counts.spec.ts` (AC-02.2, written after the full runs, run alone, retries 0) | 1 per width | 3 pass | 0 | 0 | |

Per width 139 = 66 developer tests + 73 QA tests (guards 6 + 7 readiness + 15 guest + 11 unknown ids + 2 ownership/links + 2 menus, sweep 26, flows 4; counts is the extra 1 above). Other runs:

| Check | Result |
|---|---|
| `npx vitest run --project unit --maxWorkers=2 src/modules/m06-spm` | 9 files, **125 tests pass** |
| `npx tsc -p tsconfig.e2e.json --noEmit` | clean (exit 0), re-run after the last spec edit |
| registry-boot | not run (per brief) |

History of earlier runs (not counted above): a first desktop/tablet pass was interrupted by the `node_modules` / `npm ci` incident (worker exit 3221225794 / `ERR_MODULE_NOT_FOUND`); these were treated as environment failures and the whole suite was re-run on a fresh build. Under the 5 s default expect timeout two developer tests (E2E-M06-08, Q1 count outside 5/10/20) failed on screen-render timing at 100 % CPU; with 20-30 s they pass.

## QA specs written (`e2e/m06-spm/`)

- `qa-g5-guards-responsive.spec.ts`: guest to `/login` for 15 routes; 6 roles (pelajar, pelajarmaju, guru, admin, ibubapa, adminsekolah) open all 10 list screens with no redirect and no PRO badge or package prompt inside `main`; readiness card absent for pelajar, guru, ibubapa, penaja, adminsekolah, ppd, jpn (one fresh context each); 11 unknown or malformed ids give the global 404 page with "Mula Latihan"; student cannot open the admin's mocks 16 and 317; BM/BI redirect and S7/S9 links resolve; student menus and admin menus (sidebar group at lg, "Lagi" sheet below); responsive sweep of 26 route states (no horizontal scroll, no text under 12 px, touch targets of at least 44 px below lg, heading contrast on dark heroes, user and admin shells).
- `qa-g5-flows.spec.ts`: F1 hub, databank, Q1, results, S10 and S1 stats; F2 S3, S4 (Tingkatan 5 + Sukar), Q2, results, S10 `latih_tubi`; F3 refused set (GEO set 2 and malformed `year`/`set`, no session, no alert), then S5, S6 AKAUN, Set 3, Q3, results, S10 `ramalan`; F4 S11, Q4, S12, S13 (provisional).
- `qa-g5-counts.spec.ts`: AC-M06-02.2 through the real M04 form.

Quiz answers are picked blind, so scores are read back and checked for consistency; exact scores are never forced.

## Test plan: AC to result

Dev = developer spec (all pass at 3 widths); QA = my spec. "Unit" = vitest in `src/modules/m06-spm`.

| AC | Test cases | Result |
|---|---|---|
| 01.1-01.3, 01.5 | Dev E2E-M06-01 | Pass |
| 01.4 | Dev E2E-M06-02 (admin 4 / 21.8% / 26 / 84; pelajar2 0s) | Pass |
| 02.1 | Dev E2E-M06-03 (19 subjects S2 = S3 = S4, T4 + T5 = total) | Pass |
| 02.2 | QA counts spec: new approved MATH T5 MCQ adds 1 to S4 total, Tingkatan 5, S2, S3; hub constant unchanged. The Sains deactivation half is covered by unit test `spm.test.ts` only (not in a browser) | Pass (create half in browser at 3 widths; deactivate half by unit test) |
| 03.1, 03.2 | QA menus (student sidebar / bottom nav / drawer), Dev E2E-M06-04 | Pass |
| 03.3 | Dev E2E-M06-04 (headers incl. S4, S6, S11-S13 admin shell) | Pass |
| 03.4 | QA admin menu (sidebar group at lg, "Lagi" sheet below lg, 4 links + walkthrough + mock) | Pass |
| 04.1 | QA guest sweep (15 routes) + Dev E2E-M06-06 | Pass |
| 04.2 | QA 11 unknown ids + Dev E2E-M06-06 | Pass |
| 04.3 | QA role pages (no PRO / package text in `main`, 6 roles x 10 screens) | Pass |
| 05.1-05.3 | Dev E2E-M06-07 | Pass |
| 06.1 | Dev E2E-M06-08 (POST body, 10 questions, "Lapor Soalan" modal opens). Not asserted: the report request `source:'spm'` and the item in the M04 queue (covered by M04 report specs, `t6-reports.spec.ts`) | Pass (partial) |
| 06.2 | Dev E2E-M06-08, QA F1 (S10 row, S1 count +1) | Pass |
| 07.1-07.3 | Dev E2E-M06-09, -10 | Pass |
| 08.1-08.5 | Dev E2E-M06-11 | Pass |
| 09.1-09.3 | Dev E2E-M06-12 | Pass |
| 10.1, 10.3 | Dev E2E-M06-13, QA F2 | Pass |
| 10.2 | Dev E2E-M06-14 | Pass (message is PROPOSED COPY) |
| 10.4 | Dev E2E-M06-41 | Pass |
| 11.1-11.3 | Dev E2E-M06-15 | Pass |
| 12.1-12.3 | Dev E2E-M06-16 (admin) | Pass |
| 12.4 | Dev E2E-M06-16 + QA 7 roles in fresh contexts at 3 widths | Pass |
| 13.1, 13.2 | Dev E2E-M06-15/17, QA redirect test | Pass |
| 13.3-13.8 | S7 internals are the M05-T7 route, QA'd in M05 | Out of scope (M05) |
| 14.1-14.6 | Dev E2E-M06-21, -22 | Pass |
| 15.1 | Dev E2E-M06-23, QA F3 | Pass |
| 15.2 | Dev E2E-M06-23, QA F3 (before any trial is used) | Pass |
| 15.3 | Dev E2E-M06-23, QA F3 | Pass |
| 16.1-16.4 | Dev E2E-M06-24 | Pass |
| 17.1-17.3 | S9 is the M05-T7 route, QA'd in M05; the S8-to-S9 link and back link were checked | Out of scope (M05); link Pass |
| 17.4 | Dev E2E-M06-26 (pelajar2, set 2510) | Pass (provisional L-7) |
| 18.1-18.6 | Dev E2E-M06-27, -28 | Pass |
| 19.1-19.5 | Dev E2E-M06-29, -30 | Pass |
| 20.1, 20.2 | Dev E2E-M06-31, QA F4 | Pass (provisional L-8) |
| 20.3, 20.4 | Dev E2E-M06-32, QA F4 | Pass (provisional L-8) |
| 21.1-21.6 | Dev E2E-M06-33, -34 | Pass |
| 22.1-22.5 | Dev E2E-M06-35, -36, -37, -42, QA F4 | Pass |
| 23.1, 23.2 | Dev E2E-M06-38 | Pass |
| 24.1, 24.5 | QA responsive sweep (26 route states) + Dev E2E-M06-39 | Pass |
| 24.2-24.4 | Dev E2E-M06-40 (S11 stacking, S4 2/4 columns, S13); 24.4 pager is S7/S9 (M05) | Pass (24.4 out of scope, M05) |

Counts: 99 ACs; 10 out of scope (13.3-13.8 = 6, 17.1-17.3 = 3, 24.4 = 1; S7/S9 internals); the rest Pass. No Fail, no Blocked.

## Bugs

| ID | Severity | Summary | Status |
|---|---|---|---|
| BUG-M06-01 | Low (observation) | With an exhausted M05 trial (the demo pupil's trial limit is 50 answers; one finished 40-question set plus the seeded answers uses it up) any session start redirects to `/pricing`, including the refused set URL `/spm/ramalan/GEO?year=2026&set=2` and the malformed `year`/`set` cases, instead of staying on S6. | Open |

BUG-M06-01 detail
- Steps: `pelajar@demo.test`, finish AKAUN Set 3 (40 questions), then open `/spm/ramalan/GEO?year=2026&set=2`.
- Expected (AC-M06-15.2): no session starts and the URL becomes `/spm/ramalan/GEO`.
- Actual: `/pricing` (the M05 start rule BR-07 / `planStart` checks the trial before the mode rules, so the 402 `TRIAL_EXHAUSTED` wins).
- Evidence: failed attempts of the first F3 version (before I reordered the test); trace kept in the scratch folder only. With trial left, AC-15.2 passes at 3 widths.
- Owner: backend-developer (M05 `mock/repository/start.ts`, shared by M06). Severity Low because the trial limit is M05/LS-8 provisional and the user ends on a pricing page, not on a broken page. Not a G5 blocker.

Not bugs (investigated and closed)
- "Admin Sekolah sees the Admin Readiness card" seen in one early run: caused by my own test (new tabs in the admin's browser context shared its stored session). With one fresh context per role, the card is absent for pelajar, guru, ibubapa, penaja, adminsekolah, ppd and jpn at all three widths; admin sees it.
- S11 hero heading contrast measured 2.8:1 against the lightest gradient stop: the heading sits at the amber-700 end (about 5:1); with the mean gradient colour the ratio passes. Replicates live (D9: not unreadable).
- PRO badges found in the first role test were in the shell sidebar (not M06 content); the check is now limited to `main`.
- `count=5` on MATH goes back to S4 (fixed target 40, BR-M06-07): a test bug, the sweep now uses PERNIAGA `count=10`.
- Non-numeric `year`/`set` render S6 at the same URL (by design in `TrackingACodePage`); no session is created.

## Flakes

None in the final runs (0 flaky at all three widths). Earlier-run flakes and failures were all load or environment related: the `node_modules` break (worker exit 3221225794), the 5 s default expect timeout at 100 % CPU, and one Playwright trace-artifact ENOENT when two runs shared an output folder (now separate `--output` folders). Also noted: cold boot of a fresh context costs 20-60 s on this machine (mock DB re-seeds after the core v7 bump), so a width takes 1.3-1.6 h.

## Notes and gaps

- AC-02.2 deactivation half and the `source:'spm'` report payload are not asserted in the browser (unit and M04 specs cover them).
- Q4, Q1-Q3 quiz paths and the S13 answers stay provisional (L-1..L-11); they pass against the placeholder copy.
- Lanes: no Playwright MCP session was used; all evidence is from scripted runs and error-context page snapshots.
- Temporary files: `playwright.5106.config.ts` deleted from the repo root; preview server on 5106 stopped; scratch folder `...\scratchpad\m06-g5\` holds logs, build and traces.
