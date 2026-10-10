# QA report: M25 Heatmap Topik Lemah (AI Centre, student screen S1), G5

Scope: `/buku-nota/heatmap` (roles-matrix row L19, Release 1.0). URS v1.2 (39 ACs, 10 stories), SRS v1.2 (E2E-M25-01...30). Code: `feature/student-prototype` at 74093f9 (working tree as found). Build: `npx vite build --mode e2e --outDir dist-e2e-s7-m25qa`, served by `vite preview` on port 5137 (stopped afterwards, own PID only). Config copy and logs: `<scratchpad>/m25-qa/` (`playwright.s7.config.mjs`, outputDir moved into the scratchpad because `test-results/s7` is shared with another session; per-test timeout raised to 120 s because the mock boot takes about 25 s per test under machine load). Projects mobile 375x812, tablet 768x1024, desktop 1280x800, `--workers=1`, `E2E_BOOT_TIMEOUT_MS=120000`. Exploratory work: Playwright MCP lane 1 only, at 375/768/1280. No application code was edited. The unit suites were not part of this brief and were not run.

## Verdict: NOT READY

- AC counts: 39 ACs, **36 Pass, 1 Fail (AC-M25-04.1), 2 Blocked (AC-M25-01.1 and 01.5, F-19b)**.
- The brief's "READY except F-19b" does not apply: besides the known F-19b there is one failing AC (B-1, Medium) and one new dead link (B-2, Medium).
- Bugs: 1 High (F-19b, known, Blocked), 2 Medium (B-1, B-2), 3 Low (B-3, B-4, B-5). No Critical.
- To reach READY: fix F-19b and re-run E2E-M25-01 (student-nav part, unskip), fix B-1 (hero h1 colour), decide B-2 (empty-state button target); then re-run E2E-M25-10, 17 and 01 only.

## Runs

| Run | Result |
|---|---|
| `e2e/m25-ai-centre` full, 3 projects (40 tests each, 120 total) | 116 pass, 3 skipped (E2E-M25-01 student-menu test, all 3 viewports, F-19b), 1 fail: E2E-M25-30 on tablet (test timeout 2.0 min, 3 mock boots under load) |
| E2E-M25-30 re-run alone, tablet | pass |
| E2E-M25-30 re-run, mobile + desktop, per-test timeout 120 s | both timed out again (mock boots about 25 s each, three per test, machine loaded by other sessions' Playwright runs) |
| E2E-M25-30 re-run, mobile + desktop, timeout 300 s | both pass (7.5 min for the two) |
| Net | 117 pass, 3 skipped (F-19b), 0 genuine failures. E2E-M25-30 passed at all 3 viewports; it is timing-fragile (B-5). |
| An earlier first attempt using the shared `test-results/s7` output dir | aborted: another session's run deleted trace files (ENOENT) and the 30 s default timeout failed 4 tests. Not counted; environmental. |

## Test plan: AC to result

`E2E` = the developer spec `e2e/m25-ai-centre/s1-heatmap.spec.ts` (passes at mobile / tablet / desktop unless noted). `Expl` = my exploratory check on the preview. Viewport columns: M = 375, T = 768, D = 1280.

| AC | Test cases | M | T | D | Result |
|---|---|---|---|---|---|
| 01.1 student menu href `/buku-nota/heatmap` | E2E-01 (skipped, F-19b); Expl: sidebar (1280) and drawer (375) of pelajarmaju both show href `/heatmap-topik-lemah` | - | - | - | **Blocked (F-19b)** |
| 01.2 admin has no entry | E2E-01 admin | Pass | Pass | Pass | Pass |
| 01.3 header and tab title | E2E-02; Expl title "Heatmap Topik Lemah" | Pass | Pass | Pass | Pass |
| 01.4 user shell, no LIVE/MAIN/DAFTAR, no tab bar/filter/form/back | E2E-02 | Pass | Pass | Pass | Pass |
| 01.5 active menu item | E2E-01 (skipped, F-19b) | - | - | - | **Blocked (F-19b)** |
| 02.1 guest to /login | E2E-03; Expl guest -> `/login` (API 401 asserted in unit test `heatmap.test.ts`, not re-run) | Pass | Pass | Pass | Pass |
| 02.2 admin and pelajarmaju render | E2E-04; Expl | Pass | Pass | Pass | Pass |
| 02.3 `/heatmap-topik-lemah` global 404 | E2E-05; Expl copy matches; "Mula Latihan" goes to `/practice`, AC text says `/latih-tubi` (documented M01 DV-02, see B-3) | Pass | Pass | Pass | Pass (AC text stale, B-3) |
| 02.4 latency and fault | E2E-06 | Pass | Pass | Pass | Pass |
| 02.5 other roles redirected to own home | E2E-04 (guru, ibubapa, penaja, school_admin, ppd, jpn); Expl: guru, ibubapa, penaja, adminsekolah land on `/dashboard`; ppd on `/ppd/dashboard`, jpn on `/jpn/dashboard` (both render the global 404, B-4) | Pass | Pass | Pass | Pass (B-4) |
| 03.1 grid 1 / 3 / 4 columns | E2E-07; Expl cols 1 / 3 / 4 for both blocks | Pass | Pass | Pass | Pass |
| 03.2 no h-scroll, legend wraps, text >= 12 px, cells >= 44 px | E2E-08; Expl: scrollWidth = clientWidth at 360 (375 minus scrollbar), 768, 1265; legend 2 rows at 375; cell height 58-75 px; no text under 12 px | Pass | Pass | Pass | Pass |
| 03.3 hover styles | E2E-09; Expl cell `translateY(-2px)`, `0 4px 8px rgba(0,0,0,.1)`, pointer; card border `#c026d3`, `0 12px 24px rgba(192,38,211,.12)`; no title/ARIA | Pass | Pass | Pass | Pass |
| 03.4 widths at 1280 | E2E-07 | Pass | Pass | Pass | Pass |
| 04.1 hero copy, gradient, white text | E2E-10 passes, but Expl: hero h1 computed colour `rgb(30,41,59)` on `#b91c1c`, not white (B-1); paragraph is white | - | - | - | **Fail (B-1)** |
| 04.2 legend pills | E2E-11 | Pass | Pass | Pass | Pass |
| 05.1 admin cells and order | E2E-12; Expl six cells with exact figures | Pass | Pass | Pass | Pass |
| 05.2 band colours | E2E-13; Expl backgrounds red/red/red/amber/green/red | Pass | Pass | Pass | Pass |
| 05.3 cell = one link, 12 px `#475569` | E2E-12; Expl 12 px `rgb(71,85,105)` | Pass | Pass | Pass | Pass |
| 05.4 pelajarmaju | E2E-14; Expl Matematik: 43% red, 57% amber, 83% green, in that order | Pass | Pass | Pass | Pass |
| 05.5 fixture `m25-ties` | E2E-15; Expl order Aspek Tatabahasa D3, Kemahiran Membaca D3, Kemahiran Menulis D3 | Pass | Pass | Pass | Pass |
| 06.1 cell links `/practice/chapter` | E2E-16; Expl click Kemahiran Menulis opens `/practice/chapter` "Soalan by Chapter" | Pass | Pass | Pass | Pass |
| 07.1 pelajar2 SERVER empty state | E2E-17; Expl exact message and button "Mula Latih Tubi" -> `/latih-tubi`; no subject block, no cell. The target is a 404 page in the rebuild (B-2) | Pass | Pass | Pass | Pass (B-2) |
| 07.2 no gray cell for admin | E2E-17 | Pass | Pass | Pass | Pass |
| 08.1 Cikgu Pakar card, one slug of three | E2E-18 (seeds 1, 5, 11); Expl shows Bahasa, Matematik across loads, h4 name | Pass | Pass | Pass | Pass |
| 08.2 avatar 56x56, gradient, gold ring, pills >= 12 px | E2E-19; Expl 56px, 50%, `#4338ca` -> `#c026d3`, white, 700, ring `#fbbf24`, 4 pills 12 px | Pass | Pass | Pass | Pass |
| 08.3 block absent when #2 fails | E2E-20; Expl `failNext('/api/duta/recommendations',500)`: no card, hero and 6 cells still render | Pass | Pass | Pass | Pass |
| 08.4 order card, hero, blocks | E2E-18; Expl | Pass | Pass | Pass | Pass |
| 08.5 card link `/bilik-duta/{slug}` | E2E-21; Expl href `/bilik-duta/cikgu-demo-bahasa` | Pass | Pass | Pass | Pass |
| 08.6 same seed same card | E2E-18 | Pass | Pass | Pass | Pass |
| 09.1 totals 116 / 45, 3 / 1 hidden | E2E-22; Expl sum 5+38+18+5+10+40 = 116 | Pass | Pass | Pass | Pass |
| 09.2 Sejarah and Darjah 1 equal M05 | E2E-23 | Pass | Pass | Pass | Pass |
| 09.3 D2 chapter threshold | E2E-24 | Pass | Pass | Pass | Pass |
| 09.4 one more wrong answer, 6 cuba / 117 | E2E-25 | Pass | Pass | Pass | Pass |
| 09.5 fixture `m25-bands` | E2E-26; Expl 40 red, 50 amber, 79 amber, 80 green, 80 green | Pass | Pass | Pass | Pass |
| 10.1 only the two API reads | E2E-28 (the in-process mock gives no page-level request events in MCP, so Expl could not re-check) | Pass | Pass | Pass | Pass |
| 10.2 `?user_id` / `?userId` ignored | E2E-29 | Pass | Pass | Pass | Pass |
| 10.3 no M25 store, 6 / 3 / 0 cells | E2E-30 (timeout-fragile, B-5) | Pass | Pass | Pass | Pass |
| 10.4 M08 S6 unchanged | E2E-27 | Pass | Pass | Pass | Pass |

Counts: Pass 36, Fail 1, Blocked 2 (total 39).

Exploratory notes (compared with `docs/discovery/img/R10/heatmap-topik-lemah-*.png`): layout, card, legend, cell colours, figures and wording match the live desktop capture; the deliberate differences (round gradient avatar, header "Heatmap Topik Lemah" instead of "Dashboard", pills 12 px) are as specified. The fullPage screenshot `m25-admin-1280.png` shows the fixed sidebar over the content, which is a screenshot artifact; the viewport capture `m25-admin-1280-viewport.png` is correct (hero starts at x=281, sidebar ends at 256). The page has two h1 elements (shell header and hero), consistent with DV-M25-01.

Screenshots in `D:\Dev Projects\pretasiplus-app\.playwright-mcp\`: `m25-admin-1280-viewport.png`, `m25-admin-1280.png`, `m25-admin-768.png`, `m25-admin-375.png`, `m25-admin-noduta-1280.png`, `m25-maju-1280.png`, `m25-pelajarmaju-768.png`, `m25-pelajarmaju-375.png`, `m25-p2-empty-1280.png`, `m25-pelajar2-375.png`.

## Bugs

| ID | Severity | Steps to reproduce | Expected vs actual | Screenshot | Owner |
|---|---|---|---|---|---|
| F-19b | High (known, Blocked) | Sign in as pelajarmaju, open any user-shell page at 1280 (sidebar) or 375 (drawer), inspect "Heatmap Topik Lemah" under "Pusat AI". | Expected href `/buku-nota/heatmap` (AC-01.1, 01.5). Actual `/heatmap-topik-lemah`, which is the global 404 (AC-02.3). The only student entry to S1 is a dead link. Waiting on another session's uncommitted shell edits. | `m25-maju-1280.png` | frontend-developer (`src/shells/nav/user-nav.ts`) |
| B-1 | Medium | Open S1 as admin at any width, read the hero heading. | Expected white h1 on the red gradient (AC-M25-04.1, live is white). Actual `h1` colour `rgb(30,41,59)` (#1e293b) on `#b91c1c`, contrast about 2.3:1. The paragraph is white. E2E-10 does not catch it (it checks the container colour). | `m25-admin-1280-viewport.png` | frontend-developer (hero h1 inherits the global h1 colour; needs an explicit white) |
| B-2 | Medium | Sign in as pelajar2, open S1, click "Mula Latih Tubi". | SRS FN-M25-2.2.6 / AC-07.1 specify `/latih-tubi`. In the rebuild `/latih-tubi` is the global 404 (also noted in M01 DV-02: live `/latih-tubi` is itself a 404, M01 sends its own button to `/practice`). Under D9 (dead link) the button should go to `/practice`. SRS owner to decide; then developer to change. | `m25-p2-empty-1280.png` | product-analyst (SRS decision), frontend-developer |
| B-3 | Low | Compare AC-M25-02.3 and E2E-M25-05 text with the 404 page. | AC says "Mula Latihan" -> `/latih-tubi`. The page, the M01 DV-02 deviation and the developer test all use `/practice`. The AC text is stale. | none | product-analyst |
| B-4 | Low | Sign in as ppd@demo.test or jpn@demo.test, open `/buku-nota/heatmap`. | The redirect to the role home happens (correct), but `/ppd/dashboard` and `/jpn/dashboard` render the global 404 page (those homes are not built). Not an M25 defect. | none | M01 / role-home owner |
| B-5 | Low (test code) | Run E2E-M25-30 under load. | The test boots the app three times and times out at the 120 s default budget when the machine is busy (failed tablet in the full run; failed mobile and desktop on a re-run; passes with 300 s). Split it or give it a longer `test.setTimeout`. | none | qa-engineer / developer (test code) |

## Final verdict

**NOT READY.** G5 needs every AC executed and Pass with no open Critical/High bug. Open: 1 Fail (AC-M25-04.1, B-1), 2 Blocked (AC-M25-01.1, 01.5, F-19b, which is itself a High dead-link bug), plus B-2 (Medium). Everything else (36 of 39 ACs, 117 automated tests across the three viewports) passes with no horizontal scroll, no text under 12 px and all figures (116 / 45, 37 / 26 style totals, 43 / 57 / 83 order, band edges, tie order, empty state, role redirects, mock-failure hiding of the Cikgu Pakar card) as specified. A re-run after the fixes should be limited to E2E-M25-01 (unskipped), 10, 17 and 19.

---

# Re-test after fixes (G5 final, 2026-10-10)

Code: `feature/student-prototype` at 242aa56, which contains `d697423` (B-1, B-2, B-5) and `78efd4b` (F-19b, DV-M25-09). Build: `npx vite build --mode e2e --outDir <scratch>/dist`, served by my own `vite preview` on port 5109 (stopped afterwards, own PID only). Playwright: `--workers=1`, 2 retries, 30 s expect timeout, `E2E_BOOT_TIMEOUT_MS=150000`, `E2E_BOOT_MS=150000`, projects mobile 375x812, tablet 768x1024, desktop 1280x800. The temporary config was removed from the repo root. No application code was edited. Logs are in `<scratchpad>/m25-g5/` (`e2e.log`, `report.json`, `unit5.log`, `tsc.log`).

Spec changes (test code only, `e2e/m25-ai-centre/s1-heatmap.spec.ts`):
- E2E-M25-01 student menu: the `test.fixme` for F-19b had already been removed in `d697423`, so the test now runs at all 3 widths (sidebar at 1280, drawer at 375 and 768). I added an assertion that the entry has the `active` class (AC-M25-01.5 was never asserted before).
- E2E-M25-17: after the href check, the test now clicks "Mula Latih Tubi" and asserts the URL ends in `/practice` and "Halaman Tidak Dijumpai" is absent (B-2).

## Runs

| Run | Result |
|---|---|
| `e2e/m25-ai-centre`, 3 projects, 40 tests each (120) | **120 passed, 0 failed, 0 skipped, 0 flaky** (41.5 min). Mobile 40/40, tablet 40/40, desktop 40/40. No retry was used. |
| E2E-M25-01 (student menu, now un-skipped) | pass at 375 (drawer), 768 (drawer) and 1280 (sidebar): href `/buku-nota/heatmap`, not `/heatmap-topik-lemah`, entry is active |
| E2E-M25-10 (hero) | pass at 3 widths: h1, p and container computed colour `rgb(255, 255, 255)` (admin) |
| E2E-M25-17 (pelajar2 empty state) | pass at 3 widths: button href `/practice`, click lands on `/practice`, no 404 page |
| E2E-M25-30 (timing-fragile before, B-5) | pass at 3 widths with `test.slow()` |
| `npx vitest run --project unit --maxWorkers=2 src/modules/m25-ai-centre` | **4 files, 26 tests passed**. Note: the first three attempts failed only with a vitest worker start timeout for `heatmap-page.test.ts` ("Timeout waiting for worker to respond", 3 other files passed) while the machine was loaded by the e2e build and other sessions; no assertion failed. The re-run after the e2e run finished passed all 4 files. This is environmental. |
| `npx tsc -p tsconfig.e2e.json --noEmit` | exit 0, no errors |

## Re-tested ACs

| AC | Evidence | M | T | D | Result |
|---|---|---|---|---|---|
| 01.1 student menu href `/buku-nota/heatmap` | E2E-01 (un-skipped) | Pass | Pass | Pass | **Pass** |
| 01.5 active menu item | E2E-01 active-class assertion (added) | Pass | Pass | Pass | **Pass** |
| 04.1 hero white text on red gradient | E2E-10 h1, p, container all `rgb(255,255,255)` for admin. For students the hero is the same `HeatmapHero.vue` (explicit `text-white` on h1 and p, no role branch), and pelajarmaju / pelajar2 render it in E2E-14 / 17; the student h1 colour itself is not separately asserted in a test. | Pass | Pass | Pass | **Pass** |
| 07.1 pelajar2 empty state, button target | E2E-17 href plus click to `/practice` (DV-M25-10) | Pass | Pass | Pass | **Pass** |
| 02.3 404 page | E2E-05 still passes; AC text now reads `/practice` (see B-3) | Pass | Pass | Pass | **Pass** |

All other ACs: regression run green at 375 / 768 / 1280 (see Runs). No horizontal scroll, text under 12 px or clipped content was reported by E2E-08 and `expectNoHorizontalScroll`.

Updated counts: **39 ACs, 39 Pass, 0 Fail, 0 Blocked**.

## Bug status

| ID | Severity | Status |
|---|---|---|
| F-19b | High | **Closed.** Menu href is `/buku-nota/heatmap` at 1280 (sidebar) and 375 / 768 (drawer), entry active. |
| B-1 | Medium | **Closed.** h1 is white; E2E-10 now asserts it. |
| B-2 | Medium | **Closed.** Button goes to `/practice` and the click lands there (DV-M25-10, D9 dead-link fix). |
| B-3 | Low | **Closed.** AC-M25-02.3 in `docs/requirements/urs/M25-ai-centre.md` already reads "Mula Latihan" -> `/practice` (M01 DV-02); no stale text left, no doc note needed. |
| B-4 | Low | Open, not an M25 defect: `/ppd/dashboard` and `/jpn/dashboard` render the global 404 (role homes not built). Owner: M01 / role-home owner. Does not block. |
| B-5 | Low | **Closed.** `test.slow()` added; E2E-M25-30 passed at all 3 widths with no retry. |

No open Critical or High bug.

## Final verdict: READY

All 39 ACs are executed and Pass (36 from the first run plus the 3 re-tested here), the full suite is 120 of 120 at mobile, tablet and desktop, the unit suite (26 tests) and the e2e type-check are clean, and the only open item is the Low, non-M25 B-4. Caveats stated honestly: the student-account h1 colour rests on the shared component plus the admin assertion, and the unit run needed a re-run because of a load-related worker start timeout.
