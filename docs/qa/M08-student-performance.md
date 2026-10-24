# QA report: M08 Prestasi Murid (Student Performance), G5

Build: `npx vite build --mode e2e` into the scratch folder, served with `vite preview` on port 4512 (stopped afterwards), Playwright Chromium, projects mobile 375x812, tablet 768x1024, desktop 1280x800, `--workers=2`. The Playwright config lives only in the scratch folder (`.../scratchpad/m08-g5/pw.config.mjs`); nothing was added to the repo outside `e2e/m08-student-performance/qa-g5-*.spec.ts`. URS v1.12, SRS v1.18 (with the v1.15 CH-M08-01 note). The Playwright MCP servers were not connected, so all browser work was done with the `@playwright/test` CLI (no manual exploratory session, no screenshots; failures were diagnosed from the test error output and text probes).

M08 source did not change between the build and the last run (only M03 files and a dev hub file changed), so the G4 re-review fixes for S16-S18 had not landed; the T3 specs passed on the build under test.

## First-run verdict: NOT READY (superseded: see "Final verdict" at the end, READY after the re-run)

Reasons (G5 needs every in-scope AC executed and Pass):
- 8 open bugs, all Medium or Low. No Critical or High bug. No layout break, no horizontal page scroll and no text under 12px on any built route at 375, 768 or 1280.
- Five Medium bugs break explicit ACs on observed data: AC-M08-07.1 (S1 subject table has 16 rows, not 18), 08.2 (S1 observed teacher cards missing), 09.4 (S3 T5 header "25 subjek", not 26), 21.1 / 23.4 (S10 and the S11 "Tukar Kelas" box list 748 classes, not 750) and 22.1 (S11 class 228 first observed row not present).
- Three Low bugs: AC-10.4 T5 class labels, AC-20.3 / 20.4 S9 filter-pill order, AC-27.2-27.4 number format on S15.
- Fix the owners' items below and re-run only `qa-g5-values.spec.ts` and `qa-g5-headcount-gaps.spec.ts` (the 10 failing tests are the regression checks).

## Runs

| Run | Result |
|---|---|
| Existing `e2e/m08-student-performance` (t3, t4, t5, t6, t7, smoke-analitik; 135 tests per project), mobile | 134 pass, 0 fail, 1 skipped |
| Same, tablet | 134 pass, 0 fail, 1 skipped |
| Same, desktop | 134 pass, 0 fail, 1 skipped |
| New QA specs (203 tests per project), mobile | 193 pass, 10 fail |
| New QA specs, tablet | 193 pass, 10 fail |
| New QA specs, desktop | 193 pass, 10 fail |
| **Total per project (338 tests)** | **327 pass, 10 fail, 1 skipped** (x3 projects: 981 pass, 30 fail, 3 skipped) |
| Re-run of every failure alone (`--workers=1`, all 3 projects, plus a probe of the page text) | All 10 failing tests fail again at the same assertion on all 3 projects: real bugs, not flakes. |
| `npx vitest run --project unit src/modules/m08-student-performance` | 22 files, 345 pass, 1 skipped, 1 todo, 0 fail |
| `npx tsc -p tsconfig.e2e.json --noEmit` | clean (exit 0) |
| `eslint` + `prettier` on `qa-g5-*.spec.ts` | clean |

The one skipped test is the developer's `test.fixme` "S5 class 228: Perlu Perhatian (57)" in `t7-class.spec.ts` line 240 (comment says the total is (0)). It is stale: my `qa-g5-class228.spec.ts` shows the app now gives (57) and the three observed rows, and passes at all 3 widths. The fixme can be removed (test code, for the Delivery Lead or developer).

Provisional tests: 14 per project in the developer suite are tagged `@provisional` (unobserved teacher, school-admin and L-12 behaviour); they all pass. They are counted as Pass below but are marked "provisional" where an AC says so.

QA specs written (all in `e2e/m08-student-performance/`):
- `qa-g5-responsive.spec.ts`: 74 route/role cases plus 2 guest cases at the three widths (admin 39 routes, guru 16, school admin 9, pelajar 10, guest `/pelajar/1` and `/pelajar/2`): no horizontal page scroll (3 samples), no M08 content text under 12px (checked that the sweep sees real text: 12px is the smallest size actually used), and every table wider than the viewport sits in a horizontally scrolling container.
- `qa-g5-access-nav.spec.ts`: menus (sidebar at 1280, "Lagi" drawer at 375/768, teacher "PENILAIAN" group), 22 header title/subtitle checks (AC-01.3 / 01.4), guest redirects for 20 routes, 13 unknown-id 404 cases, 403 pages, `/analisa-item` redirect per role, role guards.
- `qa-g5-class228.spec.ts`: CH-M08-01 (57, first three rows).
- `qa-g5-values.spec.ts`: observed values and copy of S1, S3, S4, S5, S9, S10, S11 not asserted before, including the S1 trend chart datasets, reversed axis and tooltip texts through `window.__charts`.
- `qa-g5-headcount-gaps.spec.ts`: 27.6, 35.1, 35.2, 35.4, 19.4, 36.1, 36.3 and the S15 number format.
- `qa-g5-style.spec.ts`: upper-case table headers, S11 Tahap pill colours, school admin S1 GPS, S5 class trend chart datasets.

Touch targets: neither the URS nor the SRS states a touch-target size for M08 screens (only text >= 12px, AC-M08-34.2), so no touch-target size was asserted. The developer suite checks the S12 hero button text size.

Notes on confidence: for ACs marked "dev spec" I relied on the developer specs (all passing at 3 widths) plus a read of their key assertions, not on a re-derivation of every value. Where an AC lists CSS classes or icon names (`fa-*`), I asserted copy, values, hrefs and the colours listed under 22.7, not the icon glyphs (icons are lucide SVGs by project convention).

## Test plan: AC to result

Legend: **Pass** executed and passed. **Fail** executed and failed (bug id). **Out of scope** not built or BLOCKED by the spec. `dev:` developer spec file in `e2e/m08-student-performance/`; `qa:` my `qa-g5-*` spec. All screens in the brief are built, so no AC is "not built".

| AC | Result | Evidence |
|---|---|---|
| 01.1 sidebar M08 links at 1280 | Pass | qa access-nav (7 labels and hrefs; navigation to /ranking and /analisa-item) |
| 01.2 drawer links at 375/768 and teacher PENILAIAN | Pass | qa access-nav |
| 01.3 live header titles/subtitles | Pass | qa access-nav (S2, S3 t4, S4, S5 228 and 516, S7, S8, S9, S10, S11, S16, S17, S20) |
| 01.4 DV-01 titles "Selamat datang kembali" | Pass | qa access-nav (S1, S6, S12, S13, S14, S15, S19, S22, S23) |
| 02.1 guest redirects, /pelajar/1 public | Pass | qa access-nav (20 routes) and dev t3, t5, t6, smoke |
| 02.2 /prestasi to /prestasi/sekolah | Pass | qa access-nav, dev t5 |
| 02.3 404 page for unknown ids | Pass | qa access-nav (13 ids incl. t3, 99999999, sc-419, /headcount/1) |
| 02.4 403 page for /analisa-item/kelas/99999999 | Pass | qa access-nav (copy, links, tab title) |
| 02.5 /timeline/1 is 404 | Pass | qa access-nav, dev t3 |
| 03.1 admin Analisa Item opens S10 | Pass | qa access-nav (sidebar click), dev t5 |
| 03.2 teacher to S10, pelajar to /dashboard | Pass (provisional) | qa access-nav |
| 03.3 school admin to S9 | Pass (provisional) | qa access-nav, dev t5 |
| 03.4 pelajar `/prestasi` to own S6; S1-S3 and S9 are the 403 page (UAT 2026-10-24 M-09, T4; replaces the former "pelajar S9 own school" expectation of 03.3, DV-M08-39) | Pass | `uat-m09-prestasi-murid.spec.ts` (3 viewports), dev t5 pelajar group |
| 04.1 S1 header, pills | Pass | dev t5 |
| 04.2 S1 seven stat cards | Pass | dev t5 (values and separators; grid columns by viewport not asserted separately) |
| 04.3 school admin S1 figures | Pass (provisional) | dev t5, qa style (5.33, Sederhana, 6 entri) |
| 05.1 GPS card 3.45 / Baik / 744 | Pass | qa values |
| 05.2 grade distribution rows, 744 rekod | Pass | qa values (bar widths not asserted) |
| 06.1 trend caption, chart datasets, reversed axis | Pass | qa values (copy, `window.__charts`: overall 5.2/4.8/4.5/4.3, 6 dashed, y 0-9 reversed, "A+ (0)" ... "G (9)") |
| 06.2 trend table rows | Pass | qa values, dev t5 |
| 06.3 tooltip texts | Pass | qa values (tooltip callbacks: "Tahun 2022", "GPS Keseluruhan: 5.20 (Sederhana)", "...: Tiada data"); real hover not driven (canvas) |
| 07.1 subject GPS table, 18 rows | **Fail** | BUG-01 (rows 1-16 exact, rows 17-18 missing) |
| 07.2 grade, colour, Pencapaian bar | Pass (rows 1-16) | qa values (grade/GPS/counts exact; bar width and colour band not asserted) |
| 08.1 level cards T4 / T5 | Pass | dev t5 |
| 08.2 Prestasi Guru 310 cards, observed cards | **Fail** | BUG-02 (310 cards, scroll box 384px pass; observed cards absent) |
| 08.3 quick links | Pass | qa values (4 labels, hrefs) |
| 09.1 S2 cards | Pass | dev t5 |
| 09.2 S3 T4 header, pills, cards | Pass | dev t5 |
| 09.3 Headcount Keseluruhan T4/T5 | Pass | qa values (45%, 34 / 41; 28%, 114 / 289) |
| 09.4 S3 T5 header "645 kelas · 26 subjek" | **Fail** | BUG-03 |
| 10.1 S3 T4 13 rows in order with hrefs | Pass | qa values, dev t5 |
| 10.2 "Kelas Sekolah" rows no link, Guru "—" | Pass | qa values, dev t5 |
| 10.3 Murid Terbaik T4 and T5 (cap 100%) | Pass | dev t5, qa values (10 rows "100%", none above) |
| 10.4 Murid Berisiko T4 and T5 | **Fail** (T4 Pass) | BUG-04 (T5 class labels) |
| 10.5 cards vs table definitions (13 / 2) | Pass | qa values (4 Simulasi row 15 0 0% 13 2) |
| 11.1 S4 empty state, "Cipta Kelas" href | Pass | qa values |
| 11.2 teacher S4 cards | Pass (provisional) | dev t7 |
| 12.1 S5 class 228 header and cards | Pass | qa values, dev t7 |
| 12.2 class 4 cards, empty select | Pass | dev t7 |
| 12.3 teacher class 2001 cards, class switch | Pass (provisional) | dev t7 |
| 13.1 class 4 attention 58 Tak Aktif, empty trend, N/A | Pass | qa values, dev t7 |
| 13.2 class 2001 attention (6) | Pass (provisional) | dev t7 |
| 13.2a class 228 attention (57), 3 observed rows, ordering rule | Pass | qa class228, qa values (observed 48.3 / 45 / 44.6, later rows < 50% and non-increasing, idle last, sessions + idle = 57; the 11/46 split is not asserted) |
| 13.3 class 2001 trend chart (3 points, 2 datasets) | Pass (provisional) | qa style (`__charts`: 09-15, 09-22, 09-24; "Purata Ketepatan (%)", "Sesi") |
| 13.4 Kedudukan Murid class 2001 | Pass | dev t7 |
| 14.1 S6 hero /prestasi/1 | Pass | dev smoke-analitik |
| 14.2 S6 /prestasi/3001 cards, 5 headcount cards | Pass | dev smoke-analitik |
| 14.3 chip rows wrap at 375 | Pass | dev smoke-analitik, qa responsive (/prestasi/3001, /prestasi/3201) |
| 14.4 S6 /prestasi/3201 headcount cards | Pass | dev smoke-analitik |
| 15.1 Penguasaan Subjek empty state, Aktiviti | Pass | dev smoke-analitik |
| 15.2 /prestasi/3001 mastery bars | Pass | dev smoke-analitik |
| 15.3 heatmap 90 cells, tooltip toggle | Pass | dev smoke-analitik |
| 15.4 24/09 cell tooltip, colour | Pass (provisional) | dev smoke-analitik |
| 15.5 Lencana (3) | Pass | dev smoke-analitik |
| 16.1 admin weak topics and Cadangan | Pass | dev smoke-analitik |
| 16.2 3008 weak topics ascending | Pass | dev smoke-analitik |
| 16.3 3008 Cadangan texts | Pass | dev smoke-analitik |
| 16.4 3201 Cadangan | Pass | dev smoke-analitik |
| 17.1 S7 top weak (4) cards | Pass | dev smoke-analitik |
| 17.2 S7 bar 13 and "Lihat semua 17 topik lemah" | Pass | dev smoke-analitik |
| 17.3 S7 Sejarah keeps list open (13, bar 9) | Pass | dev smoke-analitik |
| 17.4 "Latihan Fokus (25 soalan)" count=25 | Pass | dev smoke-analitik |
| 18.1 S7 tabs, BM ring, KPIs | Pass | dev smoke-analitik |
| 18.2 Sejarah ring 8 / 23 SP | Pass | dev smoke-analitik |
| 18.3 red message box | Pass | dev smoke-analitik |
| 18.4 DSKP map | Pass | dev smoke-analitik, qa responsive (legend wrap, no overflow at 375) |
| 18.5 progressing student no-data S7 | Pass (provisional) | dev smoke-analitik |
| 18.6 new student no-data S7 | Pass (provisional) | dev smoke-analitik |
| 19.1 S8 without parameters | Pass | dev t7 |
| 19.2 S8 class 4 cards, subjects, rows | Pass | dev t7 |
| 19.3 S8 "Rendah" filter keeps URL | Pass | dev t7 |
| 19.4 name and "Lihat Analitik" to /prestasi/{id} | Pass | qa headcount-gaps |
| 19.5 teacher S8 2001 / Kimia | Pass (provisional) | dev t7 |
| 20.1 S9 own school empty state, chips | Pass | qa values |
| 20.2 S9 Tingkatan 4 chip, subtitle | Pass | qa values, dev t5 |
| 20.3 S9 8880 values, subject rows, GPS, first card, pill order | **Fail** | BUG-05 (all values Pass; pill order differs) |
| 20.4 S9 8880 T4 76.3%, table, pills, Sains filter | **Fail** | BUG-05 (values and filter Pass; pill order differs) |
| 20.5 S9 card expand, wrong-answer chips | Pass | qa values |
| 20.6 S9 2700 zero state; id without pupils | Pass | qa values, dev t5 |
| 20.7 S9 other school is 403 | Pass (provisional) | qa access-nav, dev t5 |
| 21.1 S10 750 cards, first three, columns | **Fail** | BUG-06 (first three exact; 748 cards) |
| 21.2 teacher S10 two classes | Pass (provisional) | dev t7 |
| 22.1 S11 class 228 summary, tabs, 596 rows, first observed row | **Fail** | BUG-07 (summary 93 / 596 / 381 / 78 / 137 and 596 rows Pass; first observed rows absent) |
| 22.2 S11 class 2001 difficulty table | Pass | qa values (order, indexes, accuracies), dev t5 |
| 22.3 row expand Q1, chips | Pass | dev t5 |
| 22.4 sort and search | Pass | dev t5 |
| 22.5 S11 class 6 empty state | Pass | qa values, dev t5 |
| 22.6 375px layout (column hidden, inline line) | Pass | dev t5, qa responsive (tables contained at 375) |
| 22.7 Tahap pill colours Sederhana / Mudah | Pass | qa style (#FEF3C7 / #92400E, #DCFCE7 / #166534) |
| 23.1 discrimination guide, controls hidden | Pass | qa values |
| 23.2 discrimination table class 2001 | Pass | qa values (1.000 x3, 0.500, 0.333, 0.250, 0.000, -0.500) |
| 23.3 class 2002 "Data Tidak Mencukupi" | Pass | dev t5 |
| 23.4 "Tukar Kelas" 750 chips | **Fail** | BUG-06 (748 chips; navigation Pass) |
| 24.1 S12 admin hero | Pass | dev t6 |
| 24.2 Auto-Setup modal | Pass | dev t6 |
| 24.3 modal closing | Pass | dev t6 |
| 24.4 modal at 375, text >= 12px | Pass | dev t6 |
| 24.5 teacher Auto-Setup T5 | Pass (provisional) | dev t6 |
| 24.6 teacher 5 config cards | Pass (provisional) | dev t6 |
| 25.1 S13 admin empty | Pass | dev t6 |
| 25.2 S13 teacher 6 / 48 / 3 / 3, 50% | Pass (provisional) | dev t6, qa responsive |
| 25.3 S13 Tingkatan 4 filter | Pass (provisional) | dev t6 |
| 26.1 S14 fields and defaults | Pass | dev t6 |
| 26.2 native validation | Pass | dev t6 |
| 26.3 Manual mode highlight | Pass | dev t6 |
| 26.4 teacher create and 409 | Pass (provisional) | dev t6 |
| 26.5 S14 mode cards 1/2 columns | Pass | dev t6 |
| 27.1 S15 3001 header, 5 sections | Pass | dev t6 |
| 27.2 section 503 "Belum Ada Data", "TOV: 58.0% (C+)" | **Fail** | BUG-08 (pill, ETR "—", no RS, dashes Pass; app prints "TOV: 58% (C+)") |
| 27.3 section 501 chips, table, tint | **Fail** | BUG-08 (structure Pass; "TOV: 60% (B)", "ETR: 75% (A-)" lack ".0"). Provisional rules. |
| 27.4 section 505 RS, chart label, accuracy box | **Fail** | BUG-08 (RS badge "82.0%" Pass; "ETR (Ramalan): 80% (A)" and "RS (Sebenar): 82% (A)" lack ".0") |
| 27.5 3201 Sejarah section | Pass | dev t6 (RS badge 56.4, Menurun, 13 Apr 2026, +0.4, Ramalan Tepat); the chips "TOV: 67% (B+)" / "ETR: 56% (C+)" print without ".0" (same format as BUG-08; AC-27.5 itself lists "67.0%") |
| 27.6 3203 and 3202 accuracy boxes | Pass | qa headcount-gaps (values, verdict, copy; the ".0" format is BUG-08) |
| 27.7 3201 Sains slate pill (DV-21) | Pass | dev t6 |
| 28.1 S16 admin | Pass | dev t3 |
| 28.2 copy button | Pass | dev t3 |
| 28.3 S16 pelajar posts | Pass (provisional) | dev t3 |
| 29.1 S17 fields and defaults | Pass | dev t3 |
| 29.2 native required | Pass | dev t3 |
| 29.3 photos: 6 files, 3 MB alert | Pass | dev t3 |
| 29.4 publish with and without image | Pass (provisional) | dev t3 |
| 29.5 "Batal" | Pass | dev t3 |
| 29.6 caption persistence (DV-30) | Pass | dev t3 |
| 30.1 S18 guest profile | Pass | dev t3 |
| 30.2 S18 cover chips, tier card "Bronze · Tahap 1" | Pass | dev t3 (admin at 256 syiling; Tahap = ordinal, INFERRED) |
| 30.3 sponsor and footer copy | Pass | dev t3 |
| 30.4 "Kongsi" with and without `navigator.share` | Pass | dev t3 |
| 30.5 S18 at 375 | Pass | dev t3, qa responsive (guest `/pelajar/1`, `/pelajar/2`) |
| 31.1 S19 national | Pass | dev t4 |
| 31.2 S19 Matematik | Pass | dev t4 |
| 31.3 S19 Negeri | Pass | dev t4 |
| 31.4 S19 Daerah / Sekolah / tingkatan | Pass | dev t4 |
| 31.5 `?scope=xyz` | Pass | dev t4 |
| 32.1 S20 week own card, podium | Pass | dev t4 |
| 32.2 S20 all | Pass | dev t4 |
| 32.3 S20 month | Pass | dev t4 |
| 32.4 `?period=xyz`, subtitle | Pass | dev t4 |
| 32.5 S20 pelajar | Pass (provisional) | dev t4 |
| 32.6 S20 responsive columns, pill colours | Pass | dev t4 |
| 33.1 /laporan-mingguan 403 for admin | Pass | qa access-nav, dev t5 |
| 33.2 "Laporan Mingguan" in sidebar and drawer | Pass | qa access-nav |
| 33.3 /laporan-mingguan for student, teacher | Out of scope (BLOCKED, OQ-M08-01) | Spec says not specified; only a no-crash check (teacher) and the 403 pages for pelajar / school admin were run, not asserted as spec |
| 34.1 no horizontal scroll, every screen x 3 widths | Pass | qa responsive (76 route/role cases x 3), plus the developer specs' own checks |
| 34.2 no M08 content text under 12px | Pass | qa responsive (all 76 cases x 3) |
| 34.3 wide tables scroll inside their card | Pass | qa responsive (every `table` wider than the viewport has an `overflow-x: auto` ancestor, all routes x 3) |
| 35.1 class 516 header and headcount block | Pass | qa headcount-gaps (7 / 8 / 0, bars 46.67 / 53.33, 62.1, 71.9, link /headcount/213/summary) |
| 35.2 class 516 ranking 7 On Track / 8 Below, attention (15) | Pass | qa headcount-gaps |
| 35.3 teacher class 2001 block (config 504) | Pass (provisional) | dev t7 |
| 35.4 classes 4 and 228 no block | Pass | qa headcount-gaps |
| 36.1 S22 header, cards | Pass | qa headcount-gaps, dev t6 |
| 36.2 per-OTR distribution | Pass | dev t6 |
| 36.3 buttons, export href | Pass (provisional) | qa headcount-gaps, dev t6 |
| 37.1 S23 header, chips | Pass | dev t6 |
| 37.2 S23 table, AR3 colours, Purata Kelas, sort | Pass | dev t6 |
| 37.3 actions and dropdown hrefs | Pass (provisional) | dev t6 |
| 37.4 Reset / Padam modals | Pass | dev t6 |
| 37.5 selection bar | Pass | dev t6 |
| 37.6 reset / delete / drop / restore effects | Pass (provisional) | dev t6 |

Count: 157 ACs. Pass 144 (25 of them marked provisional), Fail 12 (AC-07.1, 08.2, 09.4, 10.4, 20.3, 20.4, 21.1, 22.1, 23.4, 27.2, 27.3, 27.4), Out of scope 1 (33.3). Total 157. (07.2 and 27.5 pass for what they assert; the format note on 27.5 is under BUG-08.)

## Bugs

No screenshots were taken (no MCP browser in this session). Evidence is the failing Playwright assertion and the page text. Test names are in `e2e/m08-student-performance/`.

| ID | Sev | Repro | Expected vs actual | Owner |
|---|---|---|---|---|
| BUG-01 | Medium | Admin opens `/prestasi/sekolah`. Test: `qa-g5-values` "AC-07.1 / 07.2 subject GPS table: 18 rows". | AC-M08-07.1 / discovery A.2: 18 rows, rows 17 "Pendidikan Seni Visual" and 18 "Sains Sukan" with "—" and 0 counts after "Perniagaan". Actual: 16 rows; the two no-data rows are never listed (`subjectRows` in `mock/repository/performance.ts` only builds subjects that have graded entries; its comment says "none is listed here"). Rows 1-16 match exactly. | frontend-developer / backend (M08-T1, S1 read model); or Delivery Lead if the omission is intended (then AC and SRS must say so) |
| BUG-02 | Medium | Admin opens `/prestasi/sekolah`, reads the "Prestasi Guru" box. Test: `qa-g5-values` "AC-08.2 / 08.3 teacher cards". | AC-M08-08.2 / SRS §6.2 ("3 observed + 307 generated, A to Z"): the observed cards "2 kelas · 76 murid" "72.5%" and "3 kelas · 89 murid" "72.7%" are present (and "1 kelas · 0 murid / Ketepatan: 0% / Tiada data headcount"). Actual: 310 cards (count and 384px scrolling box are correct) but neither "76 murid" nor "89 murid" appears anywhere, and neither 72.5% nor 72.7%; first card is "7 kelas · 164 murid". | frontend-developer / backend (M08-T1 / M10 class and owner build) |
| BUG-03 | Medium | Admin opens `/prestasi/tingkatan/t5`. Test: `qa-g5-values` "AC-09.4 S3 T5 header". | AC-M08-09.4 / E2E-M08-10: "Dashboard Prestasi Tingkatan · 645 kelas · 26 subjek". Actual: "... · 645 kelas · 25 subjek" (T4 "5 subjek" is correct; cards 645 / 3911 / 79.7% / 29,971 / 114 / 289 are correct). | frontend-developer / backend (M08-T1 subject count for T5 vs M10 "27 distinct subjects") |
| BUG-04 | Low | Admin opens `/prestasi/tingkatan/t5`, "Murid Berisiko". Test: `qa-g5-values` "AC-10.4 ... observed class labels" (the value-only variant passes). | AC-M08-10.4: first row "5 LEQOE · OTR3: 0.00% (sasaran 70.00%) -70", last observed "5 JUJUR · OTR3: 40.00% (sasaran 71.00%) -31". Actual: same pupil text with other class labels ("5 KEMBOJA ..." for -70 and "5 INSAF ..." for -31) and a 15th generated row "5 Simulasi · OTR3: 67.00% (sasaran 96.00%) -29" (the 15th row is allowed by SRS v1.13 note 2). Values, gaps and order match; only the observed class names differ. T4 list matches exactly. | backend-developer (M08-T1b seeds) |
| BUG-05 | Low | Admin opens `/analisa-item/sekolah/8880` and `?tingkatan=T4`. Test: `qa-g5-values` "AC-20.3 ..." and "AC-20.4 ...". | AC-M08-20.3 / 20.4 / E2E-M08-70: pills in alphabetical order "Semua (20)", "Bahasa Melayu (13)", "Sains (6)", "Sejarah (1)"; T4: "Bahasa Inggeris (1)", "Bahasa Melayu (11)", "Sains (2)", "Sejarah (6)". Actual order: "Semua (20)", "Sains (6)", "Bahasa Melayu (13)", "Sejarah (1)"; T4 "Sains (2)", "Bahasa Melayu (11)", "Sejarah (6)", "Bahasa Inggeris (1)" (order of first appearance). Counts and the filter itself are correct. | frontend-developer (M08-T5, S9 filter pills) |
| BUG-06 | Medium | Admin opens `/analisa-item/kelas` (S10) and `/analisa-item/kelas/2001` (S11 "Tukar Kelas"). Tests: `qa-g5-values` "AC-21.1 / NFR-01 S10 lists 750 cards", "AC-23.4 ... 750 for the admin". | AC-M08-21.1 / 23.4 / NFR-M08-01: 750 cards and 750 chips (S1 shows "750 kelas"). Actual: 748 (the 743 classrooms and the 5 designed classes; the two school classes sc-419 and sc-806 are not listed). The first three cards (1156, 1155, 1154) are exact. | frontend-developer (M08-T5) with Delivery Lead: either list all 750 or amend the AC and SRS to say the two school classes are excluded |
| BUG-07 | Medium | Admin opens `/analisa-item/kelas/228`. Test: `qa-g5-values` "AC-22.1 S11 class 228 first observed row". | AC-M08-22.1 / E2E-M08-31 ("first three rows exact"): first row "Which of the following is a fact?" with "2 pelajar salah", 2 attempts, "2 pelajar", 0.0%, 1.00, "Sukar". Actual: first row is "Choose the correct word to complete the sentence about daily routines." with "1 pelajar salah" and 1 attempt; the string "Which of the following is a fact?" appears nowhere in `src`. The summary (93, 596, 381 / 64%, 78 / 13%, 137 / 23%), the 596 rows and the 596 / 596 tabs are correct. | backend-developer (M08-T1 / M04 class 228 question seed, XR-M08-M05-03) |
| BUG-08 | Low | Admin opens `/headcount/student/3001` (also 3201, 3202, 3203). Test: `qa-g5-headcount-gaps` "AC-27.2 / 27.3 / 27.4 ... one decimal". | AC-M08-27.2 / 27.3 / 27.4: "TOV: 58.0% (C+)", "TOV: 60.0% (B)", "ETR: 75.0% (A-)", "ETR (Ramalan): 80.0% (A)", "RS (Sebenar): 82.0% (A)" (observed one decimal). Actual: "TOV: 58% (C+)", "TOV: 60% (B)", "ETR: 75% (A-)", "ETR (Ramalan): 80% (A)", "RS (Sebenar): 82% (A)" (trailing ".0" dropped; the RS badge "RS: 82.0% (A)" does keep it). The developer test `t6-headcount.spec.ts` line 299 asserts "TOV: 60% (B)" and so contradicts the AC; one of the two must change. Note AC-27.5 for 3201 lists "Unjuran: 56% (C+)" without a decimal but "TOV: 67.0%", and AC-27.3 lists "Unjuran: 75.0%", so the AC is itself inconsistent for "Unjuran". | frontend-developer (M08-T6 `StudentSection.vue` formatting); Delivery Lead to settle the Unjuran format |

## Flakes

None. No test in the 405-test developer run or the 477-test QA sweep passed on a re-run after failing; the 10 failures per project are deterministic (3 runs each). Boot time (7-14 s cold boot against the 2 s budget, F-34) was seen in the test durations (most tests 4-14 s) and is a known open item, not an M08 bug.

## Stale or contradictory developer tests (for the Delivery Lead, not changed by me)

- `t7-class.spec.ts` line 240 `test.fixme('S5 class 228: Perlu Perhatian (57)')`: the comment says the total is (0); the app now gives (57) and the three observed rows (see 13.2a). Remove the fixme or replace it with `qa-g5-class228.spec.ts`.
- `t6-headcount.spec.ts` line 299 asserts "TOV: 60% (B)" while AC-27.3 reads "TOV: 60.0% (B)" (BUG-08).
- `t5-prestasi.spec.ts` "S9 /8880 ..." checks the pill count but not the pill order, so BUG-05 passed G4.

## Re-gate plan

1. Owners fix BUG-01, 02, 03, 06, 07 (Medium) and, ideally, BUG-04, 05, 08 (Low), or the Delivery Lead amends the URS/SRS where the build is intended (BUG-01, 06, 08 are candidates).
2. Re-run `qa-g5-values.spec.ts` and `qa-g5-headcount-gaps.spec.ts` on the 3 projects (10 tests per project currently fail); then the full `e2e/m08-student-performance` once more.
3. Verdict flips to Ready when those pass and no Critical/High bug is open.

## Re-run after fixes (final)

All 8 bugs were fixed (BUG-01..08) and passed a combined G4 review. Fresh `vite build --mode e2e` into the scratch folder, `vite preview` on port 4612 (stopped afterwards; no server from the interrupted attempt was left running except the one I stopped), `--workers=2`, `--timeout=60000`. Decided changes seen: DV-M08-38 (S1 rows 17-18 as display constants), 750 classrooms plus 2 school classes, S15 one decimal except Unjuran and Selisih (URS AC-27.3 amended to "Unjuran: 75% (A-)"), timeline seed posts removed, stale `test.fixme` removed from `t7-class.spec.ts`, mock versions M04 6, M05 4, M08 3, M10 3.

| Run | Result |
|---|---|
| Full `e2e/m08-student-performance` (developer specs 134 + my `qa-g5-*` 203 per project = 337), mobile | 336 pass, 1 fail (timeout, see below; passes alone) |
| Same, tablet | 337 pass, 0 fail |
| Same, desktop | 337 pass, 0 fail |
| Total | 1010 pass, 1 timeout failure, 0 skipped (the fixme is gone) |
| Failure re-run alone (`--workers=1`, `--timeout=90000`, all 3 projects, 9 tests) | all pass |
| `npx vitest run --project unit --maxWorkers=3 src/modules/m08-student-performance` | 23 files, 349 pass, 1 skipped, 1 todo, 0 fail |
| `npx tsc -p tsconfig.e2e.json --noEmit` | exit 2 with ONE error outside M08: `e2e/m01-authentication/qa-account.spec.ts(13,15) TS18048 'v' is possibly 'undefined'` (M01 spec, not mine, not M08). No error in any M08 spec (the run before the re-run was clean). |

Timeout (flake, not a bug): mobile `qa-g5-access-nav` "/analisa-item/kelas/228 -> Analisa Item" failed once at the 5 s `expect` on the header title while the machine was under load (test duration 21 s); it passed 9/9 alone. No other timeouts.

Stale `qa-g5-*` assertions: none needed changing. My specs never relied on seeded timeline posts, on the 748 / 16-row / 25-subject values, or on the old format: the 10 tests that failed per project in the first run (BUG-01..08 regression checks) now pass unchanged, which confirms each fix against the AC text. No half-finished edits were found in the `qa-g5-*` specs (all compile under `tsc`).

### Bugs after the re-run

| ID | Status |
|---|---|
| BUG-01 | Closed (AC-07.1 passes, 18 rows) |
| BUG-02 | Closed (AC-08.2 passes) |
| BUG-03 | Closed (AC-09.4 passes, 26 subjek) |
| BUG-04 | Closed (AC-10.4 passes) |
| BUG-05 | Closed (AC-20.3 / 20.4 pass, alphabetical pills) |
| BUG-06 | Closed (AC-21.1 / 23.4 pass, 750) |
| BUG-07 | Closed (AC-22.1 passes) |
| BUG-08 | Closed (AC-27.2-27.4 pass with the amended Unjuran format) |

Open bugs: none. The tsc error above is an M01 test-code issue for the M01 QA owner.

### Updated AC result

157 ACs: 156 Pass (25 provisional), 0 Fail, 1 Out of scope (AC-33.3, BLOCKED OQ-M08-01). The 12 ACs listed as Fail in the table above (07.1, 08.2, 09.4, 10.4, 20.3, 20.4, 21.1, 22.1, 23.4, 27.2, 27.3, 27.4) are now Pass.

## Final verdict: READY

Every in-scope AC is executed and Pass, no Critical/High (or any) bug is open, no layout break at 375 / 768 / 1280. Caveats: provisional ACs rest on INFERRED behaviour; boot time (F-34) remains a known open item outside M08.
