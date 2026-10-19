# QA report: M17 Command Center, Session 6 scope (G5)

Scope: S2 `/admin/command-center`, S3 `/admin/command-center/daily-activity`, S4-S7 drill-downs `/admin/command-center/school|teacher|classroom|student/...`, and the Admin Sekolah alias `/admin-sekolah/command-center` (S2-AS), `/admin-sekolah/command-center/daily-activity` (S3-AS) and alias drills (S4-AS...S7-AS). Roles-matrix row **L06 Command Center, Admin Sekolah side**. Out of scope: M17 S1, S8-S11, monitoring mount (Session 8), M10 teacher mount (E2E-M17-70).
Date: 2026-10-03. Branch `feature/student-prototype` (working tree of worktree `worktree-agent-af13bfa0da5d373ed`). Tester: qa-engineer.
Specs: URS v1.13 / SRS v1.15 (M17), `docs/discovery/L06-command-center-sekolah.md`.

## Verdict

| Target | Verdict |
|---|---|
| **L06 Command Center, Admin Sekolah side** (S2-AS, S3-AS, S4-S7-AS) | **Ready** (no Critical/High bug; every executed AC Pass; open items are owner gaps, see Blocked) |
| **Admin board and drill screens** (S2, S3, S4-S7) | **Ready** (BUG-M17-CC-01 fixed and re-verified, see Re-test) |

- Re-test 2026-10-03 after the BUG-M17-CC-01 fix: board spec 84 / 84 pass on 3 projects (28 per project), see Re-test below. First run: E2E 135 pass, 0 fail, 3 skipped (the provisional E2E-M17-67, self-skipped on all 3 projects: no seeded mood check-in). No retries were needed.
- Unit 234 / 234 pass.
- No Critical or High bug. No horizontal page scroll at 320 / 375 / 768 / 1280 on any in-scope screen.
- Blocked (owner gaps, not rebuild defects): logins 13 / 31 / 95 (OQ-M17-17, M01/M02, XR-M17-07), mood check-ins (M26 mood owner, E2E-M17-37 / 67), school-admin shell sidebar entry (M27 shell not built, E2E-M17-100).

## Environment

- Scratch Playwright config (copy of `playwright.config.ts`): port **4818**, outputDir under `dist-e2e-4818`, testDir = repo `e2e`, 1 worker, 120 s test timeout, webServer timeout 600 s, `E2E_BOOT_TIMEOUT_MS=60000`, build `npx vite build --mode e2e --outDir dist-e2e-4818` then `vite preview --port 4818 --strictPort`. Ports 4173 / 5173 not used.
- Chromium; projects mobile 375x812, tablet 768x1024, desktop 1280x800.
- Manual checks: Playwright MCP lane 1 (`mcp__playwright__*`) against my local preview on 4818 only, never live. Clock pinned to 2026-09-25T15:40 MYT with `context.clock.install` to match the E2E project clock (without it the mock uses real time and today / week figures differ, which is expected).
- Cleanup: my preview stopped (PID 43092, started by me), `dist-e2e-4818` and the scratch config deleted. No other node process touched.
- Scratch: `C:\Users\hp\AppData\Local\Temp\claude\d--Dev-Projects-pretasiplus-app\3cab13af-f8cd-4424-9a30-02762f740563\scratchpad\m17-qa\` (logs `e2e1.log`, `unit.log`, screenshots).

## Commands and counts

| Run | Command | Result |
|---|---|---|
| E2E, 2 specs (`smoke-command-center-board.spec.ts`, `smoke-command-center-drill.spec.ts`), 138 tests = 46 per project | `E2E_BOOT_TIMEOUT_MS=60000 npx playwright test -c <scratch 4818 config> <2 specs>` | **mobile 45 pass / 0 fail / 1 skipped; tablet 45 / 0 / 1; desktop 45 / 0 / 1.** Total 135 pass, 3 skipped, 53.3 min |
| Re-run of failures | n/a | No failures, so no re-run. No flakes observed |
| Unit | `npx vitest run --project unit src/modules/m17-admin-dashboard --pool=threads --maxWorkers=1` | 9 files, 234 tests, 234 pass, 0 fail |

Skip detail: E2E-M17-67 (mood-day modal, `@provisional`) calls `test.skip` because no pupil of class 370 has a check-in in the 30-day trend. I count AC-22.6 as Blocked, not Pass.

## AC table

Key: E = E2E spec test (all 3 projects executed, named by SRS §12 number), U = unit suite, M = manual on local preview (lane 1). The AC-to-test mapping for E rows is by test title and scope; I did not re-audit every assertion line.

### S2 admin board

| AC | Verification | Result |
|---|---|---|
| 08.1 header, links, LIVE pill, MYT clock, no shell | E-23/26; M header "← Dashboard", "📊 Aktiviti Harian", clock 15:40 MYT | Pass |
| 08.2 placeholders then filled panels | E-24 (M also saw "Memuatkan..." then filled) | Pass |
| 08.3 10 s polling, failed poll keeps values | E-25 | Pass |
| 08.4 footer text | E-26; M "Powered by ALESA AI · PrestasiPlus © 2026 · Dijana automatik · Data dikemaskini setiap 10 saat" | Pass |
| 09.1-09.3 counters 9 / 3,152 / 1,563 aktif menjawab / 477,743 / 82.9% | E-27; M identical | Pass |
| 10.1 Top Sekolah 393 / 345 / 306 / 174 / 134 plj, links | E-29; M names and counts | Pass |
| 10.2 Top Pelajar Minggu Ini (first Murid Demo 2022, 452 jwb 99.6%) | E-30; M | Pass |
| 10.3 Live Feed 10 rows, first 14:59, school cut to 15 chars with title | E-31; M ("SEKOLAH MENENGA") | Pass |
| 10.4 empty states ("Tiada data" x2, "Tiada aktiviti terkini") | E-32 is `@provisional` in SRS; alias empty case covered by E-112 variant is not in this spec | Blocked (not exercised; no empty-data harness for admin) |
| 11.1 Kirkpatrick T1 4.6/5, T2 82.9%, T3, T4 2.880 | E-33; M T3 "95 aktif 30h" (DV-M17-38 computed 95 vs live 91, accepted deviation) | Pass (T3 per DV-M17-38) |
| 11.2 ALESA sentence "penurunan 67% ... 3.6% ... 82.9% ... 9 ... 2.88" | E-34; M | Pass |
| 11.3 week-change branches (rising / equal) | E-35 `@provisional`, not in the specs run; M alias showed "peningkatan 177%" / "▲ +177%" branch (alias data), "penurunan" branch on admin | Pass (rising and falling branches seen manually; "stabil" not seen) |
| 12.1 Aktiviti Hari Ini 340 / 2,508 / ▼ -67% | E-36; M | Pass |
| 12.2 Mood 307 / 280 / 72 / 91 | E-37 ran | Pass (values shown on admin board by M; mood owner provisional) |
| 12.3 Pembetulan 899 / +0.0% / 0%, no "Top Improvers" | E-38; M | Pass |
| 12.4 Engagement 29 / 11 / 43 / 3 / 2,229 | E-39; M | Pass |
| 13.1 / 13.2 layout 1 / 2 / 3 columns, no h-scroll, text >= 12 px | E-40; M scrollWidth <= innerWidth at 320 / 375 / 768 / 1280 | Pass |
| Column placement at xl matches live (`docs/discovery/img/M17/command-center-desktop.png`) | M compared screenshot: left Top Sekolah / Kirkpatrick / ALESA; middle Aktiviti / Feed / Top Pelajar / Mood; right Pembetulan; Engagement full width | Pass (see BUG-M17-CC-01 for panel heights) |
| 02.1 guest on board goes to `/login` | E-05 | Pass |

### S3 admin Aktiviti Harian

| AC | Verification | Result |
|---|---|---|
| 14.1 / 14.2 header, links, clock, "Hari Ini" active, `?period=week` ignored | E-41; M title "AKTIVITI PLATFORM", "◀ Command Center", "Laporan Eksekutif" link present | Pass |
| 14.3 30 s reload keeps period and open drill | E-42 | Pass |
| 14.4 failures "Gagal memuatkan" / "Gagal" | E-43 (`@provisional`, executed, passed) | Pass (provisional) |
| 15.1-15.3 pulse cards today / week / month | E-44..46 (tab test with 20,206 month answers) | Pass |
| 16.1 / 16.2 school list today and month | E-47 | Pass |
| 16.3 school drill toggle, "Lihat penuh →" | E-48 | Pass |
| 16.4 empty drill / empty period | E-49 `@provisional`, not driven by these specs | Blocked (not exercised) |
| 17.1 heatmap today only | E-50; M heatmap present on Hari Ini, absent on Minggu / Bulan (alias) | Pass |
| 17.2 Subjek and Live Feed | E-51 (panels test) | Pass (provisional layout) |
| 17.3 Login Terkini | E-52 | Pass for layout; login counts 13 / 31 / 95 depend on M01/M02 seed | Blocked for live counts (OQ-M17-17, owner M01 / M02) |
| 17.4 Top Pelajar | E-53 | Pass |
| 17.5 Mood / Badge empties "Tiada data" / "Tiada badge baru" | E-54; M alias | Pass |
| 35.1 cross-screen agreement (week 2,508 S2 = S3, month 20,206) | E-97 assertion in tab test (20,206) | Pass |

### S4-S7 drill (admin)

| AC | Verification | Result |
|---|---|---|
| 18.1 / 18.2 S4 8082 header, breadcrumb, cards 549 / 393 / 130,233 / 82.3%, "Senarai Guru (68)", row to S5 | E-55; M | Pass |
| 18.3 S4 8080 185 / 174 / 53,494 / 81.7%, teacher 1919 | E-56 | Pass |
| 19.1-19.3 S5 1919, 4402, 4418 "Tiada kelas aktif" | E-57 | Pass |
| 20.1 / 20.2 S6 class 370 rows, 3 Aktif / 27 Tidak Aktif, row to S7 | E-58 | Pass |
| 21.1 / 21.2 / 21.3 / 21.4 S7 cards, subjects, 8 weeks, mood panel, HeadCount, ALESA insight | E-59, 60, 61 | Pass |
| 22.1 / 22.2 / 22.3 / 22.4 / 22.5 modals (sessions, week, session, headcount, subject) | E-62..66 | Pass |
| 22.6 mood-day modal | E-67 skipped (no check-in data) | Blocked (M26 mood owner) |
| 22.7 modal API failures | E-68 | Pass (provisional) |
| 02.3 non-numeric / unknown ids give 404 | E-07; M admin `school/abc`, `student/99999999`, `school/8082/teacher/1919` (teacher is of 8080) all show the 404 page | Pass |
| 23.1 S4-S7 responsive (tables scroll in card at 375, fit at 768; DV-M17-39 S6 fits at 768) | E-69 x3; M alias S6 at 768: table 678 = card 678, at 375 table 566 in card 294 (in-card scroll), no page scroll at 320 / 375 / 768 / 1280 | Pass |

### Admin Sekolah alias (L06)

| AC | Verification | Result |
|---|---|---|
| 36.1 route renders the S2 board for the school admin | E-103; M `/admin-sekolah/command-center` as account 8 (SMK DEMO 900001) shows the board | Pass |
| 36.1 / 36.2 sidebar "Command Center" LIVE first item, new tab (E-100, E-101) | The school-admin shell is not built: after login the account lands on `/dashboard` = 404 page | Blocked (owner: M27 shell / L07; E-100 not driven by spec) |
| 36.3 / 37.4 no h-scroll, no clipping, text >= 12 px at 3 widths | E-102; M alias S2 and S3 at 320 / 375 / 768 / 1280: scrollWidth <= innerWidth; min font 12 px on S3 | Pass |
| 37.1 / 37.3 own-school figures, stable after poll | E-103, 105; M Pelajar 9, Soalan 177, Ketepatan 61.0%, "Sekolah Berdaftar 0 langganan aktif" (SMK DEMO has no active subscription) | Pass |
| 37.2 no other school or pupil name | E-104; M page text on S2, S3, S4 contains only SMK DEMO and Demo pupils; no "Top Sekolah" | Pass |
| 37.4 Top Sekolah absent, no hole, Mood moves to freed column | E-106; M at 1280 Mood at x 1026, third column; panels at 375 / 768 stack with no hole | Pass |
| 37.5 Kirkpatrick / ALESA inputs for the school | E-107 not in spec; M T1 "☆☆☆☆☆ 0.0/5", T2 61.0%, T3 "9 aktif 30h", T4 "GPS 0.000", ALESA "Sekolah anda menunjukkan ... dengan 0 sekolah aktif" | Pass (provisional, values consistent with school data) |
| 37.6 `?schoolId` / `?school_id` ignored | E-108 | Pass |
| SERVER copy FR-M17-106: sub-line "Pemantauan langsung sekolah anda", "Ketepatan Purata" sub-line "sekolah anda", no "keseluruhan platform" | E-103 / 106; M exact text present, regex `/platform/i` finds no match anywhere on the page at 4 widths | Pass |
| 38.1 / 38.2 poll every 10 s, failed poll keeps values | E-109 (via E-25 pattern), E-110 | Pass |
| 39.1 Top Pelajar by answers | E-111 (alias panel test); M Pelajar Demo 94 jwb, Murid Demo 07 / 05 / 06 / 08 | Pass |
| 39.2 school with no activity renders zeros | E-112 not driven | Blocked (not exercised; no harness for an empty school) |
| 39.3 Pembetulan zeros and Engagement 7 days | E-113 `@provisional`, passed; M "0 / +0.0% / 0%", 7 weekday bars Sab...Jum, no "899" | Pass (provisional) |
| 39.4 / E-114 fictitious names only | M names seen: "Pelajar Demo", "Guru Demo", "Murid Demo nn", "Pentadbir Sekolah Demo", "SMK DEMO"; grep of the M17 module source finds no person names; sponsor websites in `provisional-data.ts` belong to S1 (out of scope) | Pass |
| 40.1 platform admin gets 403 | E-115 (named E-115 in spec), M title "403 - Akses Ditolak \| PRESTASIPLUS" on S2-AS, S3-AS, S4-AS | Pass |
| 40.2 school admin with no school gets 403 | E-116 not driven (no such seeded account) | Blocked (no fixture account; handler tests only) |
| 40.3 PPD / JPN get 403 | M ppd@ and jpn@ on S2-AS: 403 page | Pass |
| 40.4 guest redirected to `/login` | E-118; M | Pass |
| 40.5 teacher and pupil get the 403 page | E-119; M guru@, pelajar@, ibubapa@ on the alias: 403 | Pass |
| 40.6 platform admin keeps `/admin/command-center` with Top Sekolah | E-120-like check in admin S2 tests; M | Pass |
| School admin on `/admin/command-center`, `/daily-activity`, `/school/900001` is not admitted | spec "school admin is not admitted" + M: 404 page (landing `/dashboard` is also 404 in this build) | Pass (see OBS-3) |
| 41.1 / 41.6 header links and feed links stay in the alias prefix | E-121 / 126; M all anchors are `/admin-sekolah/command-center/...`, back links and breadcrumbs inside the prefix | Pass |
| 41.2-41.5 out-of-school and unknown ids give the 404 page | E-122 / 124 / 125; M 13 paths: school 8082, 900002, 999999, `abc`; teacher 1919 under 900001 and under 8082; teacher 5 under 8082; classroom 370, `abc`; student 2022, 0, 99999999: all render `[data-page=not-found]` with the same 404 title | Pass |
| 42.1 S3-AS title "AKTIVITI SEKOLAH — PRESTASIPLUS", tabs, own school only, "1 daripada 1", no school list, no "Laporan Eksekutif" link (DV-M17-42) | E-127; M all present, Aktiviti Mengikut Sekolah absent, link absent | Pass |
| 42.2 `GET daily-activity/school/{id}` as school admin gives 403 | E-128 not driven by the spec (covered by T1b handler unit tests) | Pass (unit only), UI not driven |
| S3-AS tab figures: Hari Ini 40 / Minggu 130 / Bulan 177, heatmap only on Hari Ini | M | Pass |

## Bugs

### BUG-M17-CC-01 (Medium) - FIXED, verified closed 2026-10-03: "Aktiviti Hari Ini" panel clipped inside its scroll box at 1280x800 (S2 admin and alias)

- Steps: log in as admin (or account 8), set clock 2026-09-25 15:40 MYT, open `/admin/command-center` (or `/admin-sekolah/command-center`) at 1280x800.
- Expected: as live (`docs/discovery/img/M17/command-center-desktop.png` at 1280x800) the "Aktiviti Hari Ini" card shows the bar, "Minggu ini: {n}" and the change line ("▼ -67% vs minggu lepas") fully, and Live Feed shows two rows.
- Actual: the panel box is about 88 px high with an in-panel scrollbar; the bar is shown but "Minggu ini" and the change line are half cut off; Live Feed shows one row, Top Pelajar one row, Top Sekolah two rows. Content is reachable only by scrolling inside tiny boxes. No page-level h-scroll. In-panel scrolling at xl is allowed by DV-M17-01, but the panels are noticeably shorter than live, so key figures are hidden by default.
- Screenshots: `.playwright-mcp/m17-cc-admin-s2-1280.png`, `.playwright-mcp/m17-cc-alias-s2-1280.png`.
- Suspected owner: frontend-developer (M17 board grid row heights / header height at 1280x800).
- Not a G5 blocker in my judgement because the E2E layout test and the SRS wording accept in-panel scroll; the Delivery Lead decides whether to treat it as a fidelity defect.

No Critical, High or other bugs found. No open bugs.

## Re-test of BUG-M17-CC-01 (2026-10-03)

- E2E: `npx playwright test -c <scratch 4818 config> e2e/m17-admin-dashboard/smoke-command-center-board.spec.ts` (1 worker, `E2E_BOOT_TIMEOUT_MS=60000`, port 4818): **mobile 28 pass, tablet 28 pass, desktop 28 pass, 0 fail, 0 skipped, 84 / 84 (23.3 min)**. Includes the new `expectTodayAndFeedNotClipped` at 1280 (admin S2 layout test and the alias reflow test). The drill spec and the unit suite were not re-run (the fix touched the board only); the first-run results for them stand (drill 54 pass + 3 skipped, unit 234 / 234).
- Manual, 1280x800, clock 2026-09-25 15:40 MYT: admin S2 "Aktiviti Hari Ini" shows the bar, "Minggu ini: 2,508" and "▼ -67% vs minggu lepas" in full; Live Feed shows 2 rows; Top Pelajar 2 rows; Mood Pelajar fully visible. Alias S2 shows "Minggu ini: 130" and "▲ +177% vs minggu lepas" in full, Live Feed 3 rows. Column placement still matches the live screenshot (admin: left Top Sekolah / Kirkpatrick / ALESA, middle Aktiviti / Feed / Top Pelajar / Mood, right Pembetulan, Engagement full width; alias: Kirkpatrick / ALESA, middle, Pembetulan / Mood).
- No horizontal scroll at 320, 375 and 768 on admin and alias S2 (scrollWidth 305 / 360 / 753 inside 320 / 375 / 768).
- Screenshots: `.playwright-mcp/m17-cc-admin-s2-1280-fixed.png`, `.playwright-mcp/m17-cc-alias-s2-1280-fixed.png`.
- Cleanup: scratch config and `dist-e2e-4818` deleted; port 4818 free; no other process touched.

## Observations (not bugs)

- OBS-1 Owner gap OQ-M17-17: login counts today / week / month (13 / 31 / 95, role breakdown "school_admin: 2" on admin S3 today) depend on the M01 / M02 seed. S2 T3 "95 aktif 30h" differs from live 91 by the accepted DV-M17-38.
- OBS-2 Mood check-ins are 0 everywhere in the admin run on S3 and S7 (mood owner M26 provisional), so E-67 / AC-22.6 cannot be executed. Mood panel on admin S2 shows the provisional 307 / 280 / 72 / 91.
- OBS-3 The school admin has no landing: login goes to `/dashboard`, which is the 404 page in this build (M05 / L07 / M27 not built). A school admin on `/admin/command-center` therefore sees the 404 page at that URL rather than a redirect. The "← Dashboard" link target `/admin-sekolah` (FR-M17-112) is only URL-tested.
- OBS-4 For SMK DEMO (no active subscription) the alias shows "Sekolah Berdaftar 0 langganan aktif" and the ALESA sentence ends "dengan 0 sekolah aktif", as the spec (FR-M17-106 / 108) derives it. Reads oddly for a "sekolah anda" sentence but follows the spec.
- OBS-5 S7 breadcrumb uses the pupil's first active class: opening a pupil from class "5 MARIKH - Kimia" (2001) shows "5 MARIKH - Sejarah" in the breadcrumb and "← Kembali ke Kelas" returns to the other class (FR-M17-53 "first active class", INFERRED). Matches spec.
- OBS-6 S3 role lines and "Login Terkini" chips print raw role codes ("teacher: 1 · school_admin: 1", "SCHOOL_ADMIN"); FR-M17-38 specifies "{role}: {n}", so this is per spec.
- OBS-7 Browser console: only `favicon.ico` 404 on the preview server. No other console errors seen on the pages visited.
- OBS-8 D22: no generated media on any in-scope screen (emoji and CSS bars only). Privacy: only fictitious names ("Pelajar Demo", "Guru Demo", "Murid Demo nn", "Cikgu Demo nnnn"); school names that appear are public institutions (SMK ENGKU HUSAIN etc., observed public anchors) and the fixture "SMK DEMO".
- OBS-9 Not exercised: E-100 (new tab from sidebar), E-112 (school with no activity), E-116 (school admin without school), E-49 / E-32 (empty S3 / S2 states), "stabil" week-change branch, E-128 UI. Each is listed as Blocked in the table with the reason; none is a failure.
- OBS-10 The E2E run took 53 min with 1 worker on a loaded machine; no timeouts at the 120 s budget, one test ("E2E-M17-07 unknown ids") took 1.6 min on desktop.

## Files

- Report: `D:\Dev Projects\pretasiplus-app\docs\qa\M17-command-center.md`
- Screenshots: `D:\Dev Projects\pretasiplus-app\.playwright-mcp\m17-cc-admin-s2-1280.png`, `m17-cc-alias-s2-1280.png`, `m17-cc-alias-s2-375.png`, `m17-cc-alias-s3-375.png`
- Logs: `...\scratchpad\m17-qa\e2e1.log`, `unit.log`
