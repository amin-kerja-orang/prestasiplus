# L51-L55 Admin Sekolah analytics (M27 Part B S1 to S5) - G5 QA

Date: 2026-10-10. Branch: feature/student-prototype. Slug: m27-school-admin (roles-matrix rows L51 Statistik Penggunaan, L52 DSKP Heatmap, L53 Laporan Aktiviti, L54 Amaran Awal, L55 Laporan Bulanan). Inputs: SRS M27 Part B (FR-M27-38 to 87, E2E-M27-35 to 82), URS Part B AC-M27-12.1 to 24.4, G1-4, G1-5, G1-7, DV-M27-08 to 23.

**Verdict: READY (G5 Pass for L51, L52, L53, L55; L54 Pass for its own scope).** No open Critical or High bug. Three ACs are not Pass and are recorded as Blocked, not Fail: AC-22.2 follow-up pages and AC-22.3 (M18 routes deferred, DV-M27-23, `@blocked-by M18`) and AC-14.5 (the M01 global error page is not built; an inline error block shows). Two Low observations (BUG-M27B-01, BUG-M27B-02) do not block.

## SHA and environment
- Code under test: M27 module source is identical to `c5e1a7f` (`git diff c5e1a7f HEAD -- src/modules/m27-school-admin` is empty). HEAD at report time `c3c52f7` (shell `UserBottomNav.vue` changed after `c5e1a7f`; the tested build included it). `partb-amaran.spec.ts` was re-committed (`97b9245`) while the run was in progress; the S4 populated block was re-run against the committed version (see Commands).
- Build: `vite build --mode e2e` into `dist-e2e-5116` (existing specs) and `dist-e2e-5117` (QA spec), `vite preview` on ports 5116 and 5117, Playwright `--workers=1`, `E2E_BOOT_TIMEOUT_MS=90000`, expect timeout 60 s. Projects: mobile 375x812, tablet 768x1024, desktop 1280x800 (320 checked inside the mobile project). Own temporary config, deleted afterwards.
- Personas: P1 `azlan@demo.test` (school 900003, "SMK Demo Seri Putra", no pupil, teacher or class); P2 `adminsekolah@demo.test` (school 900001, populated); P4 = user 1214 (populated school admin used by the existing specs). Null-school admin from `window.__mock.seedSchoolAdminWithoutSchool()`.
- Exploratory browser checks used Playwright MCP lane 2 only, against the local preview.

## Test results summary
| Suite | Result |
|---|---|
| Vitest `m27-school-admin/__tests__/{usage,heatmap,activity,amaran,monthly}` + `school-admin/read-endpoints.test.ts` (`--maxWorkers=2`) | 7 files, 179 tests, all passed |
| Existing E2E `partb-analytics`, `partb-proposed` (S2, S5 only), `partb-amaran`, 3 projects | 203 passed, 31 skipped (by design: 1280-only tests on 375/768, drawer test on 1280, `@blocked-by` tests), 3 failed (E2E-M27-75 `@blocked-by M18`, see AC-22.3) |
| S4 populated block re-run (E2E-M27-70, 71, 73; the first run's grep-invert excluded it by mistake) | 12 passed, 3 skipped (E2E-73b `@blocked-by M18`) |
| New `qa-l51-l55.spec.ts`, 3 projects, 111 tests | first run 78 passed, 26 skipped (by design: extra roles at 1280 only, odd-query/privacy narrow-width skips), 7 failed; all 7 were spec mistakes, fixed; re-run of the affected tests 21 passed |
| `tsc --noEmit -p tsconfig.e2e.json` | exit 0, no errors |

The 7 first-run failures of the new spec (spec defects, no product change): QA-NAV on mobile and tablet (asserted that a drawer item is in the viewport before scrolling the drawer list; the item is reachable and the click works); QA-ERR S4 on 3 projects (wrong fault pattern, needs `/api/amaran/schools/*`); QA-RESP S3 P1 and P2 on mobile (in-place resize 375 to 320 inside mobile emulation, see BUG-M27B-01; the spec now loads each page at 320 as a phone would).

## AC matrix
Result is for mobile / tablet / desktop unless stated. "Existing" = specs by the build team (re-executed by me); "QA" = `qa-l51-l55.spec.ts`; "Unit" = the Vitest run above.

### Shared (S1 to S5 parts of stories 12 to 14)
| AC | Result | Evidence |
|---|---|---|
| 12.1 guest goes to /login on each of the five routes | Pass x3 | QA-ACC-1; Existing E2E-M27-35 (S1), 72 (S4), shared S2/S5 loop |
| 12.2 admin, guru, pelajar get the 403 page in place | Pass x3 | Existing E2E-M27-36, 72; QA-ACC-2 on all 5 routes for admin, guru, pelajar (x3) and pelajar2, ibubapa, penaja, ppd, jpn (1280); no 200 from the endpoints for any of them |
| 12.3 school admin with no school gets 403, no school name, figure or row | Pass x3 | QA-ACC-3 (`seedSchoolAdminWithoutSchool`): 403 page on S1 to S5, no `SMK Demo Seri Putra`, no M27 copy, no 200 from the five endpoints |
| 12.4 forged `school`, `school_id`, `role` do not widen scope (S1 to S5 part; S6 to S8 are another session) | Pass x3 | QA-ACC-4 (P1 with `?school=900001&school_id=900001&schoolId=900001&role=teacher`: sub-line stays P1 school on all five; S1 Pelajar 0, S4 Jumlah Pelajar 0, S5 Penglibatan 0%, S3 Murid list empty); Existing E2E-M27-55b |
| 12.6 endpoints: 401 guest, 403 other role, 403 no school | Pass (Unit) plus browser | Unit `read-endpoints.test.ts` (179-test run); browser evidence that the page never receives a 200 (QA-ACC-2, QA-ACC-3). Request-level guest/401 is not driven from Playwright (no raw request fixture to the mock); covered by the handler test |
| 13.1 header title and school sub-line | Pass x3 | Existing E2E-M27-41 (S1, S3, S4 incl. " - Tingkatan n", S2, S5); QA-NAV asserts each title after navigation |
| 13.2 tab titles (S4 "Amaran Awal - Sekolah \| PRESTASIPLUS") | Pass x3 | Existing E2E-M27-41 |
| 13.3 sidebar item active, Dashboard not, at 1280 | Pass (1280) | Existing E2E-M27-42 (S1, S2, S3, S4 also with `?tingkatan=`, S5); drawer variant E2E-42b Pass at 375/768 |
| 13.4 breadcrumb on S1, S2, S3, S5; none on S4 | Pass x3 | Existing E2E-M27-41, 41b (link opens S0) |
| 14.1 no horizontal page scroll at 375/768/1280 | Pass x3 | QA-RESP (5 screens x P1 and P2, default and second view, S3 tabs, S2 four subjects); Existing E2E-M27-43 |
| 14.2 text at least 12 px | Pass x3 | QA-RESP text scan; Existing E2E-M27-43 |
| 14.3 wide tables scroll inside their card | Pass x3 | QA-RESP table-container check (S1 modes, S3 guru/murid, S4 risk list, S5 statistik); Existing S1/S3/S4 responsive tests |
| 14.4 no IC, no platform-wide wording, no other-school data | Pass (1280) | QA-PRIV S1 to S5 P2 (no IC pattern, no "keseluruhan/seluruh platform", no P1 school name, no undefined/NaN/null, e-mails on the test domain only) |
| 14.5 server error shows the M01 global error page (provisional) | Blocked | M01 global error page not built. Inline error block verified: S1, S3 (Existing E2E-M27-45), S2, S4, S5 (QA-ERR, incl. a network error on S5): block visible, no figures, no horizontal scroll. See BUG-M27B-02 |
| 14.6 paginator | N/A for S1 to S5 | no paginated list in these screens (S6 to S8 belong to other sessions) |

### S1 Statistik Penggunaan (L51)
| AC | Result | Evidence |
|---|---|---|
| 15.1 seven tiles in order, pills, "30 Hari" active | Pass x3 | Existing E2E-M27-48 |
| 15.2 values equal owner queries per period | Pass x3 | Existing E2E-M27-49 (per period: consistent, nested in time, Pelajar equals S0 card), 49b (ms-MY separators); Unit `usage` page and handler tests. Caveat: E2E compares invariants and the S0 card, not a second independent M05 recomputation; the recomputation is in the Unit run |
| 15.3 `?period=bogus` gives 30 days, `7days` activates "7 Hari" | Pass (1280) | Existing E2E-M27-50; QA-ODD S1 (empty, XSS-style, duplicate, upper-case values) |
| 15.4 school without pupils: 0, 0%, never 100% | Pass (1280) | Existing E2E-M27-51 |
| 16.1 "Mengikut Mod Latihan" order and sum | Pass x3 | Existing E2E-M27-52 |
| 16.2 empty card text, 30 and 7 days | Pass x3 | Existing E2E-M27-53 |
| 16.3 `today` sentence with two links | Pass x3 | Existing E2E-M27-54 |
| 16.4 "—", footnote, no export | Pass x3 | Existing E2E-M27-55 |

### S2 DSKP Heatmap (L52)
| AC | Result | Evidence |
|---|---|---|
| 17.1 heading, caption, legend (P2 Kimia T5) | Pass x3 | Existing E2E-M27-56 |
| 17.2 tiles grouped by Bidang in code order | Pass x3 | Existing E2E-M27-57 |
| 17.3 value, status thresholds 75/50, colour, slate "Belum cuba" | Pass x3 | Existing E2E-M27-58; Unit `heatmap` tests |
| 17.4 tile title format, tiles not links | Pass (1280) | Existing E2E-M27-59 |
| 18.1 select and level pills reload with the query | Pass x3 | Existing E2E-M27-60 |
| 18.2 "Tiada Standard Pembelajaran ..." for a level or subject without SP | Pass (1280) | Existing E2E-M27-61; QA-ODD S2 (`subjectId=999999/abc/-1`, `tingkatan=T9/t4/<img>`) renders, falls back, no error |
| 18.3 school without SP records: every tile "Belum cuba" | Pass (1280) | Existing E2E-M27-61 |
| 18.4 P2 has values, P4 none, no platform total | Pass (1280) | Existing E2E-M27-62 |

### S3 Laporan Aktiviti (L53)
| AC | Result | Evidence |
|---|---|---|
| 19.1 title, tabs without "Sekolah", range pills | Pass x3 | Existing E2E-M27-63 |
| 19.2 four overview cards equal the M17 queries restricted to the school, each range | Pass x3 | Existing E2E-M27-64/65; Unit `activity-handler.test.ts` |
| 19.3 no "Skor Purata", no "Struktur" chip, no platform wording | Pass x3 | Existing E2E-M27-64/65; QA-PRIV S3 (also Guru and Murid tabs) |
| 19.4 trend, breakdown (4 rows), top pupils (max 10), teachers never logged (max 20) | Pass x3 | Existing E2E-M27-66 |
| 19.5 `?range=5` gives 30 | Pass x3 | Existing E2E-M27-63; QA-ODD S3 (`0, -7, abc, 7.5, huge number, duplicate`) |
| 20.1 Guru tab heading, pills, search, tiles, columns, no school column | Pass x3 | Existing E2E-M27-67 |
| 20.2 Murid tab heading "Top 200", pills each list pupils, columns, max 200 | Pass x3 | Existing E2E-M27-68, 68b (P1 empty) |
| 20.3 no "Sekolah" tab; search with no match shows no rows, no error | Pass x3 | Existing E2E-M27-67/68 (`zzz-tiada-padanan`) |

### S4 Amaran Awal (L54)
| AC | Result | Evidence |
|---|---|---|
| 21.1 header, pills, four tiles | Pass x3 | Existing E2E-M27-41, 70. The `@blocked-by M18` tag in the URS refers to M18 PPD/JPN pages; the S4 content itself is provided (Session 8) and was executed |
| 21.2 tiles and "Taburan Risiko Seluruh Sekolah" equal `Q-M18-RISK` and the S0 panel | Pass x3 | Existing E2E-M27-70 (tally and S0 panel oracle), 47 equivalent |
| 21.3 subject analysis rows and the 8-column risk list in score order | Pass x3 | Existing E2E-M27-71 |
| 21.4 sidebar "Amaran Awal" opens `/amaran/sekolah` | Pass (1280 sidebar; 375/768 drawer) | Existing E2E-M27-72; QA-NAV (drawer and sidebar) |
| 21.5 guru and admin get the 403 page | Pass x3 | Existing E2E-M27-72; QA-ACC-2 |
| 22.1 three buttons in order, labels, icons, hrefs; CSV is a download link | Pass x3 | Existing E2E-M27-73 (hrefs asserted). Following the first two links: Blocked (E2E-73b skipped, `@blocked-by M18`, DV-M27-23) |
| 22.2 CSV file name `amaran-sekolah-{id}-{yyyymmdd}.csv`, columns, pupils of the school only, no IC/e-mail/phone | Pass (1280) | Existing E2E-M27-74 |
| 22.3 foreign school id on M18 routes is refused with 403 | Blocked | `/amaran/sekolah/{id}` is an M18 route that is not built: P1 gets the 404 page where M18 will answer 403. E2E-M27-75 failed as written on 375/768 (title 404 vs 403) and is now skipped in the re-committed spec. Not an S4 defect; L54 counts at 100% for its scope (task decision) |
| 22.4 school without pupils: zeros, empty bar, no rows, no error | Pass x3 | Existing E2E-M27-76 |
| 22.5 `?tingkatan=T4` pill, sub-line suffix, narrower tally | Pass x3 | Existing E2E-M27-71 (second case); QA-ODD S4 (`T9, t4, ' OR 1=1, empty`) |

### S5 Laporan Bulanan (L55)
| AC | Result | Evidence |
|---|---|---|
| 23.1 heading, previous link, no next link in current month | Pass x3 | Existing E2E-M27-77 |
| 23.2 four cards equal the school queries for the month; sub-lines | Pass x3 | Existing E2E-M27-78; Unit `monthly` tests |
| 23.3 `?bulan=2026-08` both links; `2027-01`, `x` give the current month | Pass x3 | Existing E2E-M27-77; QA-ODD S5 (`2026-13, 2026-00, 0000-01, 1900-01, 2026-9, 2026-09-01, <script>, duplicate, 2099-01`, plus `2020-01` heading and both links) |
| 23.4 month without answers: "0%", "0", "—", "0", no sections | Pass x3 | Existing E2E-M27-79 |
| 24.1 "Statistik Bulanan" table, "Jumlah" footer | Pass x3 | Existing E2E-M27-80 |
| 24.2 empty "Tiada data" | Pass x3 | Existing E2E-M27-79 |
| 24.3 strongest, weakest, one row per subject | Pass x3 | Existing E2E-M27-81 |
| 24.4 footer reads the clock, "Cetak / PDF" calls `window.print()` once | Pass (1280) | Existing E2E-M27-82 (marked PROPOSED/provisional in the spec) |

### Counts
57 ACs listed (15 shared, S1 8, S2 8, S3 8, S4 10, S5 8). Pass 54, Fail 0, Blocked 2 (AC-14.5 M01 error page not built; AC-22.3 M18 route deferred), Not applicable 1 (AC-14.6). Sub-step blocked inside a Pass: following the first two S4 buttons (AC-22.1, E2E-73b). AC-12.6 request-level guest 401 is carried by the Unit run. By roles-matrix row: L51 8/8 Pass, L52 8/8 Pass, L53 8/8 Pass, L54 9 Pass and 1 Blocked (22.3), L55 8/8 Pass.

## Responsive table
Each cell is the result of `QA-RESP` (no horizontal page scroll with three samples, no element escaping the viewport outside a scroll container, no text under 12 px, no overlapping controls, no control off-canvas or under 24 px, tables inside their card), P1 and P2, default view plus a second view (`alt`) and S3 tabs/S2 subjects. Navigation reachability is `QA-NAV` (sidebar at 1280, drawer below 1024).

| Screen | 320 (fresh load) | 375 | 768 | 1280 |
|---|---|---|---|---|
| S1 Statistik Penggunaan | Pass | Pass | Pass | Pass |
| S2 DSKP Heatmap (4 subjects, T4 and T5) | Pass | Pass | Pass | Pass |
| S3 Laporan Aktiviti (Overview, Guru, Murid) | Pass | Pass | Pass | Pass |
| S4 Amaran Awal (`?tingkatan=T5`) | Pass | Pass | Pass | Pass |
| S5 Laporan Bulanan (`?bulan=2026-08`) | Pass | Pass | Pass | Pass |
| Nav reachable S1 to S5 | n/a | Pass (drawer) | Pass (drawer) | Pass (sidebar) |

## Bugs
| ID | Severity | Summary |
|---|---|---|
| BUG-M27B-01 | Low | S3 mobile emulation: resizing the viewport in place from 375 to 320 after visiting the tabs leaves the layout viewport 27 px wider (`scrollWidth` 347 vs `clientWidth` 320; the "Murid" tab button reports right edge 368). Not reproducible on a fresh load at 320 (P1 and P2, all tabs, `?range=90`: scroll width 0, tab strip scrolls inside its container), nor in a non-mobile browser resize. Steps: mobile project (isMobile), sign in P1, open `/admin-sekolah/laporan-aktiviti`, click Guru, Murid, Overview, `setViewportSize(320x700)`; expected no page overflow, actual 27 px. Probably a mobile-emulation relayout artefact of the `la-tabs` strip (`flex min-w-0 gap-1 overflow-x-auto`, tabs 8..364 at 320); verify on a real 320 px device. Owner: frontend-developer. No screenshot of the artefact (mobile emulation only); fresh-load evidence: `.playwright-mcp/lane2/bug-m27b-01-s3-320.png`, tab strip at 375 and 320: `.playwright-mcp/lane2/bug-m27b-01-s3-tabs-375.png`, `...-tabs-320.png`. |
| BUG-M27B-02 | Low | FR-M27-48 says a server error shows the M01 global error page; S1 to S5 show an inline error block (`su-error`, `dh-error`, `la-error`, `am-error`, `lb-error`) because the M01 error page is not built (AC-14.5 is provisional). Steps: force 500 on the screen's endpoint (`mock.failNext`), navigate in-app; expected global error page, actual inline `AlertBox`. No figures are shown and nothing overflows. Owner: frontend-developer / M01 (error page). |

Observation (not a bug): in the drawer below 1024 px the S1 to S5 items sit far below the fold (item `y` about 2140 px at 375); the drawer list scrolls and the click works.

## Commands run
```
npx vitest run src/modules/m27-school-admin/__tests__/{usage,heatmap,activity,amaran,monthly} src/modules/m27-school-admin/__tests__/school-admin/read-endpoints.test.ts --maxWorkers=2
  -> 7 files, 179 tests passed (132 s)
npx tsc --noEmit -p tsconfig.e2e.json  -> exit 0
QA_PORT=5116 QA_MATCH=partb-analytics,partb-proposed,partb-amaran E2E_BOOT_TIMEOUT_MS=90000 \
  npx playwright test -c playwright.5116.config.ts --workers=1 --grep-invert "S8|E2E-M27-9[6-9]|E2E-M27-4[67]"
  -> 203 passed, 31 skipped, 3 failed (E2E-M27-75 x3, @blocked-by M18) in 2.0 h
  (the grep-invert also dropped the S4 populated block; re-run below. S8 is out of scope)
QA_PORT=5117 QA_MATCH=qa-l51-l55 npx playwright test -c playwright.5116.config.ts --workers=1
  -> 78 passed, 26 skipped, 7 failed (spec defects) in 1.8 h
QA_REUSE=1 QA_PORT=5117 ... --workers=1 -g "QA-RESP S3|QA-NAV|QA-ERR"  -> 21 passed (7.2 min), after fixing the spec
QA_REUSE=1 QA_PORT=5117 QA_MATCH=partb-amaran ... -g "S4 populated school" -> 12 passed, 3 skipped (E2E-73b)
```
No Playwright or Vitest worker timeout occurred. A first launch of the 5116 run was started twice by mistake (two builds into one `dist-e2e-5116` made the preview crash with ENOENT); both process trees (all started by me) were stopped, the dist deleted and the run restarted once. No result of the aborted runs is used.

## Files
- Written: `e2e/m27-school-admin/qa-l51-l55.spec.ts`, `docs/qa/L51-L55-admin-sekolah-analitik.md`.
- Temporary files and the config `playwright.5116.config.ts`, `dist-e2e-5116`, `dist-e2e-5117`, `test-results-5116`, `test-results-5117` deleted; ports 5116 and 5117 confirmed free. No source or existing spec changed, no git write, no install, no junction.
