# QA report: M11 Teacher analytics, G5 (L47 Laporan, L15 Monitoring)

Scope: L47 Laporan (S1 `/guru/laporan`, S6 `/guru/analisis-item`) and L15 Monitoring (S2-S5 `/guru/monitoring*`, Admin Sekolah alias `/admin-sekolah/monitoring*`). Out of scope: S7 `/guru/perbandingan-kelas` and S8 `/guru/laporan-mingguan-kelas` (M11-T4/T5, not built), the `/admin/monitoring*` mount (M17), M12 (see `docs/qa/M12-kirkpatrick.md`).
Date: 2026-10-03. Branch `feature/student-prototype` (working tree, uncommitted changes present). Tester: qa-engineer. Docs: URS v1.12, SRS v1.12.

## Verdict

| Row | Screens | Verdict |
|---|---|---|
| L47 Laporan | S1, S6 | **Ready** |
| L15 Monitoring | S2, S3, S4, S5, Admin Sekolah alias | **Ready** (see conditions) |

- No Critical or High bug. Every executed E2E test passes on all three projects (flakes under machine load only, see Runs).
- Conditions for L15 (none block the G5 rows, all are recorded owner items): Selangor school count 25 vs 28 (M02, Blocked), the admin sidebar "Monitoring" item lands on `/admin/monitoring` which is a 404 until M17 mounts it (BUG-M11-01, Medium, M17), two teacher/admin menu items to unbuilt S7/S8 lead to 404 (BUG-M11-02, Medium, M11-T4/T5).
- Bugs: 0 Critical, 0 High, 2 Medium, 3 Low. Details below.

## Environment

- App: `npx vite build --mode e2e --outDir dist-e2e-4817`, served by `vite preview --port 4817 --strictPort`. Ports 4173/5173 not used. Preview stopped and `dist-e2e-4817`, scratch configs and `test-results-m11m12qa*` deleted afterwards.
- Scratch Playwright config (copy of `playwright.config.ts`): port 4817, testDir `e2e`, 1 worker, test timeout 120 s, webServer timeout 600 s, `E2E_BOOT_TIMEOUT_MS=60000`. For the re-runs of load-timeouts a second scratch copy with test timeout 300 s and `expect` timeout 20 s was used (see Runs).
- Chromium; projects mobile 375x812, tablet 768x1024, desktop 1280x800. Manual checks: Playwright MCP lane 3 only (`mcp__playwright3__*`) on the local preview at 320, 375, 768, 1280. Where period figures were checked the browser clock was pinned to the project default `2026-09-25 15:40 +08:00` (E2E default); without the pin the 7d/30d/3m figures differ because the real date is later.
- Accounts: admin 1, guru 5, adminsekolah 8 (SMK DEMO 900001), all `Demo1234`.
- The machine was shared and at 85-100 % CPU for the whole session (other sessions running). Total E2E wall time more than 4 h.

## Runs

| Run | Command | Result |
|---|---|---|
| E2E, M11 specs (`smoke-laporan`, `smoke-monitoring`), 58 tests per project (the two M12 specs add 66 more, reported in the M12 file) | `npx playwright test -c <scratch config> e2e/m11-teacher-analytics e2e/m12-kirkpatrick` | mobile 123 pass / 0 fail / 1 skip; tablet 123 / 0 / 1; desktop 124 / 0 / 0 (both modules, 124 tests per project, 372 in all: 370 pass, 2 skip) |
| Unit | `npx vitest run --project unit src/modules/m11-teacher-analytics src/modules/m12-kirkpatrick --pool=threads --maxWorkers=1` | 22 files, 503 tests: 500 pass, 3 expected fail (`it.fails`), 0 fail. M11 owner gaps: Selangor 28, 8300 code, Student A Tajuk names |

How the E2E totals were reached (honest account). The first attempt was a single full run; a second full run was started by mistake while the first was still alive (two runs wrote to one file and competed for the same port), and the second hit the 2 h background cap. All M11 mobile/tablet tests passed in the clean full run. For desktop the clean run covered tests 1 to about 330 of 372 and then was cut by the 2 h cap; the remainder and the load failures were re-run in three further invocations:

- Clean full run: mobile 123 pass / 1 skip, tablet 123 pass / 1 skip, desktop 104 pass, 7 fail (all M12, all "page still loading at 5 s" or the test timeout), 13 not run.
- Re-run of the 13 not-run plus the failures at default settings: 5 more M12 desktop tests timed out at 5 s (the S1/S3 data had not loaded yet under 100 % CPU). Four of the seven failed M12 tests passed.
- Re-run with the scratch `expect` timeout 20 s and test timeout 300 s: the five remaining S1/S3 tests and the one 10-navigation test (`school administrator 8 on S4-S8`, which needs more than 120 s on this machine) all passed.
- Every desktop test, M11 and M12, has at least one passing execution (124 unique test names). Not a single assertion failure was a product defect; every failure was a load timeout and passed on re-run. Classified as flakes (environment), not bugs. Recommendation: run G5 E2E on a quiet machine or with 2 workers max, and keep the per-test navigations of one test under about 8.
- The 2 skips are `E2E-M12-08` (desktop-only sidebar assertion) on mobile and tablet, by design.

## AC table

Method key: E = E2E spec (SRS §12 number in brackets, all 3 projects executed), U = unit test (`src/modules/m11-teacher-analytics/__tests__`), M = manual check on the local preview (lane 3), B = Blocked.
"/admin/monitoring" is the M17 mount (not built), see BUG-M11-01. Where an AC names `/admin/monitoring…` for a link or form target the build deliberately uses the mount prefix (DV-M11-28, SRS v1.12); that is not a failure.

| AC | How verified | Result |
|---|---|---|
| 01.1 teacher menu: Laporan, Monitoring, Analisis Item, Perbandingan Kelas, Laporan Mingguan in order | M guru 1280 and 375 (items present with the right hrefs); E-M11-49 not in the spec | Pass for Laporan, Monitoring, Analisis Item; the Perbandingan Kelas and Laporan Mingguan items exist but lead to 404 (BUG-M11-02) |
| 01.2 admin: "Portal Guru" group exists but is not displayed | M admin on `/guru/laporan`: the teacher block (Laporan, Monitoring, Analisis Item, Perbandingan Kelas, Laporan Mingguan) is displayed in the user sidebar | Fail (Low, BUG-M11-03: spec vs shell capture conflict) |
| 01.3 headers and tab titles of S1, S6, S2 | E (#01, E-M11-01/07, E-M11-43) | Pass |
| 01.4 S3/S4/S5 headers, breadcrumb | E (#01/#02), M (S3 8080 header, breadcrumb "Monitoring" → mount prefix) | Pass |
| 01.5 shells (S1/S6 user shell, S2-S5 admin shell) | E (#01), M | Pass |
| 02.1 "Monitoring" active at 1280 on `/guru/monitoring`, `/guru/monitoring/sekolah/8080` | M (active item "Monitoring"); `/admin/monitoring` part | Pass; `/admin/monitoring` part Blocked (M17) |
| 02.2 "Monitoring" active in "Lagi" at 375 | M | Pass |
| 03.1 guest → `/login` | E (#03) | Pass |
| 03.2 unknown ids, `/guru/laporan/4`, `/guru/perbandingan` → 404 | E (#04, laporan "unknown sub-paths") | Pass |
| 03.3 Student A under school 940 renders | E (#05) | Pass |
| 03.4 teacher S1/S6 render; non-admin on `/admin/monitoring…` | E (E-M11-06 teacher, role refusals for pelajar/ibubapa/adminsekolah), M adminsekolah refused → `/dashboard` | Pass (provisional) |
| 04.1, 04.2 S1 filter, pills, `range=999` | E (E-M11-01/07) | Pass |
| 04.3 teacher class filter keeps range, pill drops class | E (E-M11-08) | Pass (provisional) |
| 05.1 admin zero cards | E (E-M11-09) | Pass |
| 05.2, 05.3, 05.4 teacher figures 100 % / 8/8 / 14 / 46 %; classes equal; 7 d total 7 | E (E-M11-10); M `/guru/laporan` guru "100% 8 / 8 pelajar … 14 … 46%" | Pass (provisional) |
| 06.1, 06.2, 06.3 panels, ring, zero copy, range 7 | E (E-M11-11) | Pass |
| 06.4 teacher panels 14/0/0/0/0/0/14, 46 % | E (E-M11-12) | Pass (provisional) |
| 07.1 chart 30 labels, zeros, y step 1, no legend | E (E-M11-13) | Pass |
| 07.2 teacher chart values | E (E-M11-14) | Pass (provisional) |
| 08.1 admin lists copy | E (E-M11-15) | Pass |
| 08.2 teacher lists, "3 aktiviti" | E (E-M11-16) | Pass (provisional) |
| 08.3 long e-mail truncates, no h-scroll at 375 | E (E-M11-15, two tests) | Pass |
| 09.1 guide tiles, anchors, tip | E (#17) | Pass |
| 09.2 ✕ hides, persists, "Tunjuk panduan" | E (#17) | Pass |
| 09.3 legend line (DV-M11-03) | E (#17), M (320 screenshot shows the legend) | Pass |
| 09.4 tile click scrolls to weekly table | E (#17 anchor) | Pass |
| 10.1 filter defaults, options, no Reset | E (#18) | Pass |
| 10.2 "7 Hari" + Tapis → query + Reset | E (#18); target is the mount prefix (DV-M11-28) | Pass |
| 10.3 Refresh re-submits selections | E (#18) | Pass |
| 10.4 selects touch-sized, wrap rows | E (#18, ≥ 44 px below `lg`, 36 px from `lg`) | Pass |
| 11.1, 11.2 export hrefs, with query | E (#19) | Pass |
| 11.3 CSV download `monitoring-penglibatan.csv`, 33 data lines | E (#20) | Pass (provisional) |
| 12.1, 12.2, 12.3 auto-refresh count, pause/play, 0:00 refresh without page reload | E (#21) | Pass |
| 13.1 default KPIs 57 · 4,158 · 1,462 · 35.2 % · 472,371 · 323.1 · 522 · 277 · 53.1 % | E (#22), M | Pass |
| 13.2 `period=7d` 57 · 4,158 · 44 · 1.1 % · 7,651 · 173.9 | M (clock pinned) | Pass |
| 13.3 `period=3m` 57 · 4,158 · 298 · 7.2 % · 86,697 · 290.9 | M (clock pinned) | Pass |
| 13.4 Selangor+Kritikal 28 · 4,042 · 1,424 · 35.2 % · 460,858 · 323.6 · 517 · 273 · 52.8 %; Johor 7 · 84 · 37 · 44 % · 10,418 · 281.6 · 2 · 1 · 50 % | M: all values match except "Jumlah Sekolah" 25 (spec 28); Johor matches | Blocked, owner M02 (Selangor 28 vs 25, known gap, `it.fails`); rest Pass |
| 13.5 Kelantan+Cemerlang 2 · 0 · 0 · 0 % · … | E (#23), M | Pass |
| 13.6 `period=30d` 57 · 4,158 · 89 · 2.1 % · 22,207 · 249.5; "30 Hari" preselected; first rows 8284, 8080 18/184 9.8 % | M (clock pinned: KPIs, rows "8284 … 100%", "8080 184 18 9.8") | Pass |
| 14.1, 14.2 student table: 33 rows, order, colours, bars | E (#22/#24) | Pass |
| 14.3 teacher table "13 sekolah" and rows | M count 13 and, with Selangor+Kritikal, 10; U overview tests for the rows | Pass |
| 14.4 Selangor+Kritikal: student table 2 sekolah, teacher table 10 | M | Pass |
| 14.5 school link target (first row 940) | E (#22/#24, link uses mount prefix) | Pass |
| 14.6 SMK DEMO absent from S2 in any period or filter | M (7 queries: no `/sekolah/900001`), U | Pass |
| 14.7 runtime school appears (mock hook) | U (`overview.test.ts`, `addRuntimeSchool`) | Pass (unit only) |
| 15.1, 15.2, 15.3 weekly table columns M1-M32, 33 rows, 8080 cells, Trend, Best | E (#26/#27) | Pass |
| 15.4 Selangor+Kritikal: 21 weekly rows (2/4/15) | M (21 rows; trend split not counted separately); U | Pass |
| 16.1, 16.2, 16.3 lists default | E (#28) | Pass |
| 16.4 7d/30d/3m lists | M: 7d 1/32/31, 30d 1/32/31, 3m 2/29/26; first attention items "… 12/184 (6.5 %)" and "… 18/184 (9.8 %)"; Terbaik 8284 | Pass |
| 16.5 Kelantan+Cemerlang → empty card only | E (#23), M | Pass |
| 17.1 `/guru/monitoring` = `/admin/monitoring` | E (#30, guru vs admin on `/guru/monitoring`); `/admin/monitoring` itself | Pass for `/guru/monitoring`; `/admin/monitoring` Blocked (M17, BUG-M11-01) |
| 17.2 empty filter result, "Jumlah Sekolah" 2 | E (#23), M | Pass |
| 18.1, 18.2 S3 8080, 940 | E (#31/#32/#34) | Pass |
| 18.3 8765 cards 16 · 6 · 222 · 0 · 0, "Sederhana — 37.5 %" | M (E-test title is stale "16 / 1 / 209" and asserts only the first card) | Pass (manual; see OBS-M11-01) |
| 18.4 8087 and 10220 one-sentence warnings | M (8087 "⚠ 3 akaun …", 10220 "⚠ 1 akaun …", no "daripadanya") | Pass |
| 18.5 8102 Cancelled, 8107 Expired | E (#52) | Pass |
| 19.1, 19.2, 19.3, 19.4 S3 pills, rows, search | E (#32) | Pass |
| 19.5 apostrophe name filters, no script error | M ("Nur'ain Demo": search, 4 pills, `zzzz`, 0 console errors) | Pass |
| 20.1 S3 teacher table 8080 | E (#34) | Pass |
| 20.2 8082: 68 teachers, "Belum Login" 17, "Pernah Login" 51 | M | Pass |
| 21.1, 21.2, 21.3 Student A header, cards, tabs, subject, topic rows | E (#35) | Pass; note the four chapter-title Tajuk names (M03 owner gap, `it.fails`) |
| 21.4 Student B and C | E (#36) | Pass |
| 21.5 0-answer student renders zero state | E (#55) | Pass (provisional) |
| 22.1, 22.2 question list, "Papar lagi", modal | E (#37) | Pass |
| 22.3 question without options | U (`pages.test.ts`) | Pass (unit only, provisional) |
| 23.1, 23.2 Jawapan Salah, 97 cards | E (#39, #36) | Pass |
| 24.1 Student B Gap tab (2 gaps, only the gap panel visible) | M ("Gap Analysis 2", Kritikal ×2, "Topik Kuat 81 %", only `mon-panel-gaps` visible) | Pass (provisional values) |
| 24.2 Student A empty gap state, untried subjects | M ("Tiada topik lemah dikesan!", none of Student A's subjects in the untried list) | Pass |
| 24.3 Pemerhatian sentences | M (Student A and B) | Pass |
| 25.1, 25.2, 25.3 S5 Teacher T | E (#42) | Pass |
| 26.1, 26.2 S6 admin | E (E-M11-43, two tests) | Pass |
| 26.3 S6 teacher class 2001 rows | E (E-M11-44) | Pass (provisional) |
| 27.1 S7 `/guru/perbandingan-kelas` | M: 404 for guru; route fragment is empty (`routes/perbandingan-kelas.ts`) | Blocked, owner M11-T5 (not built) |
| 28.1 S8 admin 403 | M: 404 (route fragment empty) | Blocked, owner M11-T4 (not built) |
| 28.2 S8 teacher stand-in | M: 404 | Blocked, owner M11-T4 |
| 29.1 no horizontal scroll at 375/768/1280 on S1-S6 | E (#48, E-M11-48) and M sweep at 320, 375, 768, 1280 over S1, S6, S2, S3, S4, S5 (admin and guru): `scrollWidth` equals the viewport minus the scrollbar everywhere; wide tables scroll inside cards | Pass |
| 29.2 S1 grid 2 per row at 375/768, 5 columns at 1280 | E (E-M11-48) | Pass |
| 29.3 S4 tabs wrap, modal fills width | E (#48 / E-M11-48) | Pass |
| 30.1 AS alias S2 own school, S3-S5 under `/admin-sekolah/monitoring` | E (alias describe, 3 tests); M (S2 "Jumlah Sekolah 1", 9 pupils, 177 answers; S3 `/sekolah/900001`, S4 pupil 3001) | Pass (provisional) |
| 30.2 AS other school/pupil/teacher → 404; `/guru/laporan`, `/guru/analisis-item` refused | E (alias refusals); M (8080, 8078, pupil 2008 under 900001 → 404; `/guru/*` → `/dashboard`) | Pass (provisional) |
| 30.3 AS S2 with `period`/`tahap`, `state`/`schoolId` ignored | U (handlers); not driven in the browser | Pass (unit only) |

Summary of results: Fail 1 (AC-01.2, Low). Blocked: AC-13.4 school count (M02), AC-27.1, 28.1, 28.2 (S7/S8 not built), and the `/admin/monitoring` parts of AC-02.1 and 17.1 (M17). AC-01.1 passes for the three built items and is partial for the two unbuilt ones (BUG-M11-02). Every other AC is Pass (E2E, unit or manual as stated). Unit-only passes: 14.7, 22.3, 30.3.

## Bugs

| ID | Severity | Steps | Expected | Actual | Screenshot | Owner |
|---|---|---|---|---|---|---|
| BUG-M11-01 | Medium | Log in as admin (1). Open `/guru/monitoring`. Click the admin sidebar item "Monitoring" (at 375: "Lagi" → "Monitoring"), or open `/admin/monitoring`, `/admin/monitoring/sekolah/8080`. | S2 renders (AC-02.1, 17.1, 17.2 name `/admin/monitoring`). | The sidebar item targets `/admin/monitoring`, which shows the standalone 404 page. `src/modules/m17-admin-dashboard/routes/monitoring.ts` is an empty fragment waiting for the M17 mount. `/guru/monitoring` works. | none (404 page) | M17 (mount, M17-T3b) |
| BUG-M11-02 | Medium | Log in as guru (5) or admin. In the user sidebar click "Perbandingan Kelas" or "Laporan Mingguan". | Provisional S7/S8 pages (FR-M11-81, 82, 83). | Both lead to the 404 page. The two route fragments (`perbandingan-kelas.ts`, `laporan-mingguan.ts`) are empty. D9: dead links. Not an L47/L15 screen, but the links sit in the L47/L15 menu group. | none | M11 frontend (M11-T4/T5) |
| BUG-M11-03 | Low | Log in as admin. Open `/guru/laporan` at 1280 and scroll the user sidebar. | AC-M11-01.2: the "Portal Guru" group and its links exist but are not displayed (as live). | The teacher block (Laporan, Monitoring, Analisis Item, Perbandingan Kelas, Laporan Mingguan and the rest) is displayed for the admin (`src/shells/nav/user-nav.ts`, "teacher block as captured in the ADMIN identity's drawer"). Spec and shell disagree; one of the two documents is wrong. | none | Delivery Lead to decide; shell (user-nav) or M11 URS/SRS |
| BUG-M11-04 | Low | Read `e2e/m11-teacher-analytics/smoke-monitoring.spec.ts` test "SRS §12 #52 variants … 8765 cards 16 / 1 / 209". | Title and assertions follow v1.11 (16 / 6 / 222, "Sederhana — 37.5 %"). | Stale title and only the first card is asserted, so AC-M11-18.3 and 18.4 have no E2E guard. I verified both manually and they pass. | none | frontend (test code) |
| BUG-M11-05 | Low | Run the M11 and M12 E2E on this machine at 85-100 % CPU. | Tests pass with the 5 s `expect` budget. | Desktop tests of the data-heavy M12 screens (S1, S3, S5, S8) timed out at 5 s while the data was still loading, and a test with 10 navigations exceeds 120 s. They pass when the budgets are raised. Environment and spec-design issue rather than a product defect. | none | frontend (E2E specs) |

## Observations

- OBS-M11-01: `/admin-sekolah/kirkpatrick` for SMK DEMO shows T3 "0/9" and "0 soalan dijawab" while `/admin-sekolah/monitoring` for the same school shows 9 active pupils and 177 answers. SRS M12 BR-M12-01 excludes fixture schools from the session segment; the build includes the viewer's own fixture school (v1.8) but with no sessions. It is a visible cross-screen contradiction for the demo account only. Owner M12 (or M05 fixture sessions).
- OBS-M11-02: Open owner gaps stay as recorded: Selangor 25 schools vs 28 (M02), school 8300 code (M02), four Student A Tajuk names (M03, `it.fails`). The M05 gaps in SRS §13 (8080 status counts 174/3/7 vs 174/4/6, accuracy bands, 8080 30-day active) were not re-measured here; AC-13.6 8080 "18/184" and the 30-day KPIs match.
- OBS-M11-03: D10 spot check on S1-S6: the only ARIA in `main` is `aria-hidden` on the icon SVGs; no `role`, `aria-label`, `aria-expanded` or `aria-selected` was added. D22: no `img` in `main` on S1-S6, and no request to a host other than the preview (no generated or fabricated media).
- OBS-M11-04: Privacy: S3 8080 rows (184 pupils, 34 teachers) are all "… Demo" names with `@demo.test` e-mails; no real personal name was seen. School names are the public anchors allowed by CLAUDE.md §6.
- OBS-M11-05: Console: no `pageerror` and no console error on S1-S6 across 320/375/768/1280 (the pre-existing `/favicon.ico` 404 known from M01 BUG-M01-05 is the only error on the login page).
- OBS-M11-06: At 320 px S1-S6 have no horizontal page scroll; screenshots reviewed: `.playwright-mcp/m11m12qa/monitoring-320.png`, `s3-8080-320.png`, `laporan-320.png`.

## Re-test notes

- After M17 mounts `/admin/monitoring*`: re-run AC 02.1, 17.1, 17.2 on that prefix and remove BUG-M11-01.
- After M11-T4/T5: AC 27.1, 28.1, 28.2 and BUG-M11-02.
- After M02/M03 owner fixes: flip the three `it.fails` tests and re-run AC 13.4 (school count).
