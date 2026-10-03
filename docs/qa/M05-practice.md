# QA report: M05 Practice (Session 4), G5

Scope (D21): roles-matrix rows **L14** Soalan by Chapter, **L17** Remedial, **L21** Latih Tubi, **L22** Soalan Berstruktur. Built screens: S2, S3, Q1, S4, S5, Q2, S6, S7, S10 (incl. `scope=spm` and `track=bahasa`), Q3, S13, Q4 (+ teacher/admin preview), S14, Q5, S15, Q6 (M05-T2 #15-#21 + `GET /api/remedial-tests/:id`, T4, T5, T7).
Sources: URS `M05-practice.md`, SRS v1.20 (§0.1, §8, §10, §12), demo accounts in `docs/AKAUN-DEMO.md`.

Build: `npx vite build --mode e2e --outDir <scratch>/dist`, served by my own `vite preview` on port 4911 (stopped afterwards, PID only). Playwright config lives in the scratch folder. Chromium, projects mobile 375x812, tablet 768x1024, desktop 1280x800.

**Method note.** The three Playwright MCP servers failed to connect (CONNECT_TIMEOUT), so there was no interactive exploratory browsing. Exploration was done with scripted Playwright probes (computed styles, contrast, drawer/sidebar link dumps, screenshots). The machine was at ~100% CPU the whole time (many other agents), so cold boot (> 15 s, known item F-34) caused timeouts; see Flakes.

## First-run verdict: NOT READY (superseded: see "Final verdict" at the end, READY after the re-run)

No Critical or High bug. Not ready because G5 requires every in-scope AC to be executed and Pass, and **5 ACs fail** on 3 Medium/Low bugs (all in shell/hero styling, none in the practice logic):

- BUG-M05-01 (Medium): the hero headings on S2 (banner), S4 and S5 are dark slate on a dark gradient (S5 h1 contrast 1.22:1). Fails AC-11.2, 18.1, 19.1 as readable text (D9 "unreadable text").
- BUG-M05-02 (Medium): the sidebar highlights two items on S4/S5 and one wrong item on S6/S7. Fails AC-35.3.
- BUG-M05-03 (Low): the drawer (375/768) lists "Target SPM", "Misi Harian", "Remedial". Fails AC-35.2.

All three are front-end fixes with no data or API impact. After the fix, re-run only `qa-g5-guards-responsive.spec.ts` ("heading legibility" tests) and `qa-g5-flows.spec.ts` ("menus" tests); everything else is green.

Rows covered by the verdict: **L14, L17, L21, L22** (all four are Not ready because of the three bugs above; the L17 and L22 flows themselves pass; L21 and L14 flows pass; the S2/S4/S5 headings and the menu items belong to L21/L14 and the shared shell).

## Runs

Tests per project: 174 (developer specs plus my three QA specs).

| Run | mobile 375 | tablet 768 | desktop 1280 |
|---|---|---|---|
| Final state per project (full run, then targeted re-runs of every failure, see below) | **169 pass, 4 fail, 1 skip** | **169 pass, 4 fail, 1 skip** | **170 pass, 4 fail** |
| Real failures (same 4 on every project) | BUG-01 x3 (S2, S4, S5 headings), BUG-03 | BUG-01 x3, BUG-03 | BUG-01 x3, BUG-02 |
| Skip | the desktop-only "active sidebar item" test | same | none |

Details of how the final numbers were reached (2 retries each, `--workers=2`):

| Step | Result |
|---|---|
| Full suite, desktop (30 s default timeout) | 157 pass, 11 fail: 4 dev-spec timeouts, 2 test bugs of mine (S14/Q5 clock, Fizik reload), 5 real (3 headings, menu x1, plus the 2 below) |
| Re-run of 6 spec files, desktop, 90 s timeout | 148 pass, 4 fail (the real ones). The 4 timeouts passed |
| Full suite, tablet | 111 pass, 23 flaky (passed on retry), 33 fail: 24 app-boot timeouts (15 s) + 7 test timeouts under CPU saturation, 2 real |
| Full suite again, tablet (90 s timeout) | 156 pass + 4 flaky, 7 fail: 4 real, 3 role-access tests that hit my own 120 s cap (raised to 300 s; re-run: 3 pass) |
| Full suite, mobile (60 s timeout) | 160 pass, 7 fail: 4 real, Fizik (test bug, fixed, re-run pass), 2 dev-spec timeouts (re-run alone on mobile and desktop: both pass, ~66 s on mobile) |
| New gap-fill spec `qa-g5-revision-report.spec.ts` (6 tests) | 18/18 pass (3 projects) |
| `npx vitest run --project unit --maxWorkers=3 src/modules/m05-practice` | 18 files, **368 pass, 0 fail** (353 s) |
| `npx tsc -p tsconfig.e2e.json --noEmit` | clean (exit 0, after another module's file stopped erroring) |

All `@provisional` tests (LS-1, 2, 3, 7, 8, 10, 12, Q4 preview) pass; the 4 failing tests per project are not provisional.

## QA specs written (`e2e/m05-practice/`)

- `qa-g5-guards-responsive.spec.ts`: guest to `/login` for 18 routes; student, teacher, admin can open S2/S3/S4/S5/S6/S10/S13/S14/S15; teacher S4 to S5; 14 unknown/malformed ids give the global 404 page; Q4/Q6 foreign or draft ids give 404; responsive sweep of 23 route states (no horizontal scroll, no text < 12 px in `main`, touch targets >= 44 px below lg); heading legibility on dark heroes; shell navigation reachable.
- `qa-g5-flows.spec.ts`: one flow per row (L21 S2-S3-Q1-results; L14 S4-S5-Q2-S5-S6-S7 plus the 70% unlock boundary 69/70; L17 3008 S13-Q4-results-"Selesai" plus guru preview, guru2 404, 3007; L22 S10-Q3-submit-marks sum check), mission 7101 coins (3 per correct), Q6 set 7402 (10 questions, second start refused), S15 admin/pelajar/save, menus and active item, S4 totals = sum of S5 levels.
- `qa-g5-revision-report.spec.ts`: S7 card/feedback copy, network failure on check, report modal copy/enable/send/failure/close.

Quiz answers are picked blind, so scores are read back and checked for consistency (score text, coins, review list); exact scores such as 7/10 are not forced.

## Test plan: AC to result

Dev = existing developer spec in `e2e/m05-practice/` (run and passing at all 3 widths); QA = my specs. "Pass (partial)" means the AC has parts I did not assert; see "Coverage gaps".

| AC | Test cases | Result |
|---|---|---|
| 11.1, 11.3, 11.4 | Dev S2 header/hero/31 cards/columns/click; QA L21 flow | Pass |
| 11.2 | Dev banner text/href; QA heading legibility (S2 banner h2) | **Fail** (BUG-01: h2 colour rgb(30,41,59) on emerald gradient) |
| 12.1, 12.2 | Dev entry params; QA `?subject=BM`, `?subject=XYZ` | Pass |
| 13.1-13.5 | Dev S3 default/levels/selections/summary; QA S3 total 6,538 vs S2 card 13,872 | Pass |
| 14.1-14.4 | Dev start link/ready/not-enough/trial notice/404; QA pelajar2 notice "Baki ... 50 soalan lagi." and /pricing href | Pass |
| 15.1-15.4 | Dev Q1 loading/header/timer/pick/check/last button; trial gate to /pricing, no session | Pass (provisional LS-1/LS-8) |
| 16.1, 16.2 | Dev results (score, band, time, rewards, review); QA coins = correct | Pass (partial: only the band the blind run reaches; provisional LS-2) |
| 16.3 | Depends on S9/S8 | Out of scope (S8/S9 not built) |
| 17.1, 17.2 | Dev subjective link absent/fixture/404 | Pass |
| 18.1 | Dev S4 header/tab/hero/link; QA legibility (S4 hero h1) | **Fail** (BUG-01: h1 rgb(30,41,59), contrast 2.73:1) |
| 18.2 | Dev 10 cards and counts; QA S4 total = sum of S5 level options (first 3 subjects) | Pass |
| 19.1 | Dev S5 hero/select/options; QA legibility (S5 h1) | **Fail** (BUG-01: h1 contrast 1.22:1, text invisible; screenshot `.playwright-mcp/m05-g5-s5-hero-h1-unreadable.png`) |
| 19.2-19.7 | Dev open/locked, pelajarmaju, admin BM, ADDMATH, 404, 375 wrap; QA ADDMATH | Pass |
| 20.1, 20.2, 20.3 | Dev Q2 unanswered questions, 90% unlock (`answerChapter`), locked URL 409 back to S5; QA flow, 69%/70% boundary | Pass (provisional LS-3; 69% keeps Bab 2 locked, 70% opens it with 4 buttons, Bab 3 locked) |
| 21.1-21.4 | Dev S6 admin/flash/404/empty | Pass |
| 22.1 | Dev S7 as pelajarmaju (admin blocked by BR-07, v1.20 E2E-31) | Pass (partial: "20 daripada 46" admin figure not asserted) |
| 22.2, 22.3, 22.5 | QA: "Soalan 1", "Salah 2x", DSKP label, "Betul! Kali ini berjaya!" / "Masih belum tepat", network failure leaves option selected; Dev failNext check | Pass |
| 22.4 | Dev failNext start: alert and back to S6 | Pass |
| 23.1, 23.2 | Dev run to results: message/percent/corrected line for the band reached | Pass (partial: 100/85/50/<50 bands not each forced) |
| 23.3, 23.4, 23.5 | Dev rewards card, review toggle, S6 count after corrections, retry/back links | Pass (partial: S1 badge part Out of scope; submit-failure card not asserted) |
| 24.1-24.4 | QA modal copy, 7 reasons, 0/500, tints, enable, "Menghantar...", "Terima Kasih!", source `revision`, network-failure message, Batal/X/Esc, reopen cleared | Pass (backdrop click not asserted) |
| 25.1-25.6 | Dev S10 header/filter/cards/pager/empty/scope; QA SPM filter keeps scope | Pass |
| 26.1, 26.2 | Dev Q3 stimulus/sub-questions/hint/Lapor/Hantar; QA total = sum of per-sub marks, max = sum of sub-marks, empty submit | Pass (provisional LS-7) |
| 26.3 | Dev `4454?scope=spm` back link | Pass (provisional) |
| 31.1 | Dev + QA S13 empty (pelajar, pelajarmaju) | Pass |
| 31.2 | Dev + QA 3008 card (Kimia, 5 soalan, start href) | Pass (provisional LS-12; cancelled-test filter not exercised, no cancelled seed) |
| 31.3 | QA/Dev 3008 runs 7601: coins = correct, "Selesai", no start button, re-open refused; 3007 7602 | Pass (partial: `afterAccuracy` 40.0 and exactly-2-correct not asserted, answers are blind; 404 of 7602 for 3008 and 999999 asserted) |
| 31.4 | QA/Dev guru and admin preview: banner, correct option marked, no check button, no session POST; guru2 404 | Pass (provisional, PROPOSED) |
| 32.1, 32.2 | Dev/QA S14 empty copy | Pass |
| 32.3 | QA/Dev 3001 sees 7101 only (7102 not listed) | Pass (partial: the "teacher launches today" path cannot be run, no launch handler in the M10 mock) |
| 32.4 | QA 3001 runs 7101: coins = 3 x correct, "Selesai ✓", second start refused | Pass (partial: exactly 4 correct not forced; wallet +12 and 409 code not asserted) |
| 32.5 | Mission 7102 cannot start (pool needs M06, known decision); no empty-pool mission available | Out of scope (known decision) |
| 33.1, 33.2 | QA admin 20 rows "Bahasa Arab" to "Tasawwur Islam", all "Belum mula", 10 options, legend | Pass |
| 33.3 | QA pelajar A / B+ / A- selected; Dev `setSpmProgress` 75% / A- | Pass (provisional LS-10) |
| 33.4 | Dev track >= 80% row width at 375 | Pass |
| 34.1, 34.2 | QA save A+ for Fizik and clear BM, persists after reload; Dev failNext error flash keeps choices | Pass |
| 35.1 | QA sidebar (1280): items and hrefs for Latih Tubi, Soalan by Chapter, Soalan Berstruktur, Dashboard, Pembetulan, Penguasaan, Target SPM, Misi Harian, Remedial | Pass (group headings not asserted) |
| 35.2 | QA drawer at 375/768 | **Fail** (BUG-03); bottom-nav "Home" to `/dashboard` Pass |
| 35.3 | QA active item per page | **Fail** (BUG-02) |
| 36.1 | QA S2 card 13,872 vs S3 "Semua Tahap" 6,538 (Matematik) | Pass (partial: only Matematik; sums over 31 subjects not run) |
| 36.2 | Needs S8/S9 | Out of scope |
| 36.3 | QA S4 total = sum of S5 levels for 3 of 10 subjects | Pass (partial: S1 totals Out of scope) |
| 36.4 | Dev separators on S2-S5 | Pass (S1 part Out of scope) |
| 36.5 | Session list read for M06 S10 (not in T2 #15-#21, M06 not built) | Out of scope |
| 37.1 | QA guest on 18 routes redirected to `/login` | Pass |
| 37.2 | API without a session returns 401 (mock-level) | Pass via vitest handler suite (368 tests), not re-run in the browser |
| 38.1 | QA sweep: 23 route states x 3 widths, no horizontal scroll | Pass |
| 38.2 | Dev icons on S2/S3/S4 | Pass (S1, S12 Out of scope) |
| 38.3 | QA text >= 12 px in `main` on all 23 route states (incl. S3, S15) and touch targets >= 44 px below lg | Pass (S9 Out of scope) |
| 39.1-39.4 | Dev + QA SPM and Tracking A variants, 16/3 subject options, hidden params, Mula hrefs, empty state | Pass |
| 40.1 | QA 3001 runs 7402 (10 questions, title "Set Soalan Guru"), second start "Tiada percubaan lagi untuk set ini."; 7401 draft and foreign ids 404 | Pass (partial: time-limit countdown not executed, no way to create a timed published set) |
| 01.x - 10.x (S1), 27.x - 30.x (S8, S9, S11, S12), 41.1 - 41.10 | S1 is row L07 (Session 8); S8/S9/S11/S12 not built; 41.x are answer-log dataset checks outside these rows | Out of scope |

Count (in-scope ACs, 94 incl. 36.2 excluded): **89 Pass, 5 Fail** (11.2, 18.1, 19.1, 35.2, 35.3), plus Out of scope: S1 (10 stories), S8-S12 (27-30), 16.3, 32.5, 36.2, 36.5, 41.x.

## Bugs

| ID | Sev | Repro | Expected vs actual | Evidence | Owner |
|---|---|---|---|---|---|
| BUG-M05-01 | Medium | Log in as `pelajar2@demo.test`; open `/practice` (banner), `/practice/chapter` (hero), `/practice/chapter/MATH` (hero). At any width. | Hero/banner headings readable (white on the dark gradient). Actual: heading colour is `rgb(30,41,59)` (slate-800) on dark emerald/teal. S5 h1 "Matematik" contrast 1.22:1 (invisible), S4 h1 and S2 h2 "Soalan by Chapter" 2.73:1. The shell subtitle repeats the subject name, so no information is lost on S5, but the page's main heading is unreadable. Likely a base `h1/h2/h3` colour rule overriding the parent's `text-white`. | `.playwright-mcp/m05-g5-s5-hero-h1-unreadable.png`; tests "heading legibility on dark heroes" (3 per project) | frontend-developer |
| BUG-M05-02 | Medium | As `pelajar@demo.test` at 1280, open `/practice/chapter` (and `/practice/chapter/MATH`, `/practice/revision`). | AC-35.3: only "Soalan by Chapter" active on S4/S5; no item active on S6/S7. Actual: "Latih Tubi" is active as well on S4/S5 (two items), and "Latih Tubi" alone is active on S6/S7. Cause: `isActivePath` in `src/shells/nav/user-nav.ts:696` is a prefix match (`/practice` matches `/practice/chapter`). | test "the active sidebar item follows ..." (desktop) | frontend-developer (shell nav) |
| BUG-M05-03 | Low | As `pelajar@demo.test` at 375 or 768, open the drawer on any M05 page. | AC-35.2 / FN-M05-9.1.4: no "Target SPM", "Misi Harian", "Remedial" in the drawer (as live). Actual: all three are present with their hrefs. Every item stays reachable, so navigation is not blocked. | test "sidebar / drawer: M05 items" (mobile, tablet); drawer link dump | frontend-developer (shell nav) |

Observations (not bugs, no change requested):
- S3 "Semua Tahap" (6,538) differs from the S2 card (13,872) for Matematik: by design (Q-PRACTICE vs Q-ELIGIBLE, AC-36.1).
- White-on-gradient labels such as "Teras" (1.67:1) and "-" on S15 (1.42:1) have low contrast but replicate the live palette; left as fidelity.
- A parent account (`ibubapa@demo.test`) on `/practice` was only recorded (lands on an allowed path), not asserted; the role matrix does not list parents for these rows.

## Flakes

- **App boot timeout (15 s, `waitForApp`)**: 24 tests on the first tablet run, all in 404/guard/smoke specs, all passed on the later runs. Cause: machine at 100% CPU (F-34 cold boot). Not a defect.
- **30 s default test timeout** on 4 developer tests (`chapter-revision` "completing a chapter with 90%", `practice-s2-s3-q1` "entry parameters", "subjective link", "no horizontal scroll ... S3"): each takes 28-66 s under load; all pass alone with a 90-150 s timeout on desktop and mobile. Suggest raising their timeout (`test.describe.configure({ timeout: 120_000 })`, as the T7 specs do).
- My own role-access tests (3 accounts x 9 pages, one boot each) need ~2 minutes; the timeout was raised to 300 s.
- 4 tests passed only on retry on the tablet re-run (Q6 flow, admin S15, guest `/misi-harian`, `/remedial/abc` 404), same cause.

## Coverage gaps (honest list)

- Not executed: Q6 time-limit countdown (AC-40.1); teacher-launched mission and the empty-pool alert (AC-32.3 launch path, 32.5): no M10 handler to create them; admin starting S7 (blocked by BR-07, E2E-31 v1.20).
- Not forced: exact scores (7/10, 85%, 20/20, 10/20, 6/20 bands), `afterAccuracy` 40.0, wallet +12: answers are blind and the UI does not show these; covered only by vitest handler tests.
- Not asserted: report modal backdrop click; sums over all 31 subjects for AC-36.1; S4/S5 sums for 7 of 10 subjects; sidebar group headings.
- Playwright MCP servers were unreachable, so there was no interactive exploratory pass.
- The repo-wide `npm run check:trace` reports 575 errors for other modules (missing E2E ids); the new specs use `E2E-M05-nn` ids where an SRS row exists.

## Re-run after fixes

Fixes reported by the coordinator: BUG-M05-01 (headings on S2, S4, S5 and S6 carry `text-white`), BUG-M05-02 (`activeExcept` on "Latih Tubi": not active on S4-S9), BUG-M05-03 ("Target SPM", "Misi Harian", "Remedial" in the sidebar only). Fresh build (`npx vite build --mode e2e`, scratch folder), my own `vite preview` on port 4911 (stopped afterwards, PID only), 1 worker, 2 retries, mobile / tablet / desktop.

Scope was narrowed at the coordinator's request. I stopped my own full `qa-g5-guards-responsive.spec.ts` regression run (my Playwright tasks only). The developer's post-fix run of that spec (201 pass) and the shell unit tests (135 pass) are accepted as the regression evidence and were not reproduced by me.

I added one test: the S6 `/practice/revision` banner h1 legibility check (luminance of the computed colour > 0.6, as for S2, S4, S5).

| Test | AC / bug | mobile 375 | tablet 768 | desktop 1280 |
|---|---|---|---|---|
| S2 banner h2 is light text | 11.2, BUG-01 | pass | pass | pass |
| S4 hero h1 is light text | 18.1, BUG-01 | pass (on retry) | pass (on retry) | pass (on retry) |
| S5 hero h1 is light text | 19.1, BUG-01 | pass (on retry) | pass | pass |
| S6 banner h1 is light text (new) | BUG-01, same defect on S6 | pass | pass | pass |
| Menus: M05 items and hrefs, bottom-nav Home, drawer has no Target SPM / Misi Harian / Remedial | 35.2, BUG-03 | pass | pass | pass |
| Active sidebar item per page (S2, S3, S4, S5, S6 = none, S10, S13, S14, S15) | 35.3, BUG-02 | skipped (desktop-only test) | skipped | pass |

Result of this re-run: 0 failures; the only skips are the two desktop-only active-item runs on mobile and tablet. A probe of `/practice` showed the h2 colour already `rgb(255, 255, 255)`.

Flakes in the re-run: several attempts of the S2, S4, S5 heading tests and of the menu tests failed on the 15 s app-boot budget (`waitForFunction`), not on an assertion; the machine was at about 100% CPU and `/practice` booted in 18 s in a probe, with no console error. To remove this noise from the evidence, the S2 heading test and the two menu tests now boot with their own 90 s budget (`waitForApp(page, 90_000)`). With that change every one of them passed at all three widths. The S4 and S5 heading tests were not re-run after that change; their passes (some on retry) come from the batch before it.

Bug status: BUG-M05-01, 02 and 03 are fixed and verified. No new bug found.

AC status: AC-11.2, 18.1, 19.1, 35.2 and 35.3 change from Fail to **Pass**. In-scope total: **94 Pass, 0 Fail**. The "Pass (partial)" notes and the coverage gaps above still apply. Out of scope is unchanged (S1, S8-S12, 16.3, 32.5, 36.2, 36.5, 41.x).

## Final verdict: READY (rows L14, L17, L21, L22)

- Every in-scope AC was executed and passed on the last runs, and there is no open bug of any severity.
- Conditions: the full responsive/guard spec was not re-run by me after the shell change (developer: 201 pass; shell unit tests: 135 pass). The items in "Coverage gaps" (Q6 time-limit countdown, teacher-launched mission, forced exact scores) remain unverified and rest on the provisional and known-decision notes.
- Rows covered: **L14 Soalan by Chapter, L17 Remedial, L21 Latih Tubi, L22 Soalan Berstruktur.** S1 (row L07) and S8-S12 are not covered.
