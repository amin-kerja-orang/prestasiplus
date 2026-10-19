# QA report: M12 Kirkpatrick, G5 (L16 Kirkpatrick, screens S1-S8)

Scope: L16 Kirkpatrick: S1 Overview `/admin/kirkpatrick`, S2 T1 Reaksi, S3 T2 Pembelajaran, S4 T3 Tingkah Laku, S5 T4 Hasil, S6 Rantaian Impak, S7 Intervensi, S8 student detail `/admin/kirkpatrick/pelajar/{id}`, the `/guru/kirkpatrick*` twins, and the Admin Sekolah alias `/admin-sekolah/kirkpatrick` (S1 only). Out of scope for this row: S9 `/kirkpatrick` and S10 `/maklum-balas` (not part of L16 S1-S8; both are 404 in this build, so their ACs are Blocked).
Date: 2026-10-03. Branch `feature/student-prototype` (working tree, uncommitted changes present). Tester: qa-engineer. Docs: URS v1.7, SRS v1.8.

## Verdict

| Row | Screens | Verdict |
|---|---|---|
| L16 Kirkpatrick | S1-S8, `/guru` twins, Admin Sekolah alias | **Ready** |

- No Critical or High bug. All 66 M12 E2E tests pass on mobile, tablet and desktop (two skips by design, see Runs; desktop needed re-runs because of load timeouts only).
- No defect found in any S1-S8 AC. Blocked items are screens outside the L16 S1-S8 scope (S9, S10) and one owner item.
- Bugs: 0 Critical, 0 High, 0 Medium, 2 Low (test design and a demo-data contradiction). Details below.

## Environment

Same as `docs/qa/M11-teacher-analytics.md` (one shared run for both modules): preview on port 4817 (`vite build --mode e2e --outDir dist-e2e-4817`), scratch config copy, 1 worker, 120 s test timeout, `E2E_BOOT_TIMEOUT_MS=60000`, a second scratch copy with 300 s test and 20 s `expect` timeouts for the load re-runs. Chromium on mobile 375x812, tablet 768x1024, desktop 1280x800. Manual checks on lane 3 (`mcp__playwright3__*`) against the local preview only, at 320, 375, 768, 1280. Accounts admin 1, guru 5, adminsekolah 8. The machine was shared (85-100 % CPU). The preview, `dist-e2e-4817`, the scratch configs and test-results folders were removed afterwards.

## Runs

| Run | Command | Result |
|---|---|---|
| E2E, M12 specs (`smoke-kirkpatrick-overview` 27 tests, `smoke-kirkpatrick-levels` 39 tests), 66 per project | `npx playwright test -c <scratch config> e2e/m11-teacher-analytics e2e/m12-kirkpatrick` (plus re-runs below) | mobile 65 pass / 0 fail / 1 skip; tablet 65 / 0 / 1; desktop 66 / 0 / 0 |
| Unit | `npx vitest run --project unit src/modules/m11-teacher-analytics src/modules/m12-kirkpatrick --pool=threads --maxWorkers=1` | 22 files, 503 tests: 500 pass, 3 expected fail, 0 fail (the three `it.fails` are M11 owner gaps, none belongs to M12) |

E2E run history (see the M11 file for the full account of the double start): the clean full run passed all M12 tests on mobile and tablet. On desktop it was cut by the 2 h background cap after about 330 of 372 tests, with 7 M12 failures. These were re-run: 4 passed at default settings, 2 passed in the next invocation (`E2E-M12-28`, `E2E-M12-29`), 5 other tests (`E2E-M12-16/19`, `-17`, `-27`, `-65`, `-60`) failed with "element not found within 5 s" while the data was loading and passed with the 20 s `expect` budget, and the 10-navigation test `school administrator 8 on S4-S8` timed out at 120 s twice and passed with the 300 s budget. Every failure was a load timeout (S1/S3/S5/S8 data takes more than 5 s to appear at 100 % CPU); none was an assertion on a wrong value. Classified as flakes caused by the environment (BUG-M12-01, Low). The 2 skips are `E2E-M12-08` (desktop-only sidebar test) on mobile and tablet, by design.

## AC table

Method key: E = E2E (E2E-M12 id), U = unit (`src/modules/m12-kirkpatrick/__tests__`), M = manual check (lane 3), B = Blocked. All E rows ran on the three projects.

| AC | How verified | Result |
|---|---|---|
| 01.1 admin sidebar group KIRKPATRICK with the 7 items, "Laporan" after the group | M (1280 on `/admin/kirkpatrick/results`: Overview, T1-T4, Rantaian Impak, Intervensi with their `/admin/kirkpatrick…` targets, "T4: Hasil" active) | Pass |
| 01.2 "Lagi" lists Kirkpatrick at 375 | M ("Kirkpatrick" → `/admin/kirkpatrick`) | Pass |
| 01.3 tab strip on S2-S5, S7; none on S1, S6 | E (E-M12-03) | Pass |
| 01.4 headers and tab titles S1-S5, S7 | E (E-M12-04) | Pass |
| 01.5 S6 and S8 headers and tab titles | E (E-M12-05), M (title "Kirkpatrick — Pelajar Demo 004664", "Kirkpatrick Impact Chain") | Pass |
| 01.6 S9/S10 headers | M: `/kirkpatrick` and `/maklum-balas` give the 404 page | Blocked (S9/S10 not built, outside L16 S1-S8) |
| 01.7 admin shell on S1-S8, both prefixes | E (E-M12-07/15) | Pass (S1-S8); S9/S10 part Blocked |
| 02.1, 02.2 active item on the `/guru` twins | E (E-M12-08, desktop; skipped on mobile/tablet by design), M (`/guru/kirkpatrick` "Overview" active) | Pass |
| 03.1 guest → `/login` | E (E-M12-09, S1, S2, S3) | Pass for S1-S3; S4+ chain and S9/S10 not driven |
| 03.2 probed paths → 404 | M (`/admin/kirkpatrick/pelajar`, `/interventions/1/edit`, `/survey`, `/sekolah/8080`, `/feedback` → 404 page) | Pass |
| 03.3 `/interventions/1` and `/create` → 404, no "405" | E (E-M12-11), M | Pass |
| 03.4 `/pelajar/99999999` → 403 page with exact copy | E (E-M12-12/63), M (also 5571) | Pass |
| 03.5 `school_id` ignored on S2 and S6 | E (E-M12-25, S2), U (`handlers.test.ts` reaction/chain, `KirkpatrickReactionPage.test.ts`) | Pass |
| 03.6 `?school_id=99999999` zero state | E (E-M12-61) | Pass (provisional) |
| 04.1 teacher drawer "Kirkpatrick" submenu (7 items) | E (E-M12-14), M (guru: 7 items Ringkasan, T1-T4, Rantaian Impak, Intervensi, hrefs on `/guru/kirkpatrick…`) | Pass (provisional) |
| 04.2 `/guru` twins equal the `/admin` twins; links follow the mount prefix (v1.8) | E (E-M12-07/15 on S1-S3 and S4-S8) | Pass |
| 04.3 teacher opens `/guru/kirkpatrick` with platform figures; tabs | E (E-M12-14), M (guru: 946/4158, 82.8 %, 306,133, tabs under `/guru/kirkpatrick/…`) | Pass (provisional) |
| 05.1, 05.2, 05.3 S1 filter options (58 schools, 11 states), 8080 values | E (E-M12-16/19, E-M12-17) | Pass |
| 05.4 `?state=Kelantan` zero values, GPS 4.30 | E (E-M12-18) | Pass |
| 05.5 S1 filter fits at 375, selects ≥ 36 px (44 px below `lg`) | E (E-M12-16/19, 320 px test) | Pass |
| 06.1, 06.2, 06.3 level cards, targets, 1/2/4 columns | E (E-M12-20), M (320 screenshot) | Pass |
| 06.4 school without SPM history (9167) | E (E-M12-65) | Pass |
| 07.1, 07.2, 07.3 flow circles / list, pills with 8080 | E (E-M12-21) | Pass |
| 08.1, 08.2, 08.3, 08.6 comparison default, deltas, summary, stacking | E (E-M12-22) | Pass |
| 08.4, 08.5 comparison for 8080 and Kelantan | E (E-M12-23) | Pass |
| 09.1, 09.2, 09.3, 09.4 KPI links, engagement tiles, info card, 5 columns at 375 | E (E-M12-24) | Pass |
| 10.1, 10.2 S2 cards, T1 unchanged under filters | E (E-M12-25) | Pass |
| 10.3 feedback submit changes S2 and S1 | B (needs S10, not built) | Blocked (S10) |
| 11.1, 11.3, 11.4 S3 KPIs, Learning Gain card, columns | E (E-M12-27) | Pass |
| 11.2, 12.2 S3 for 8080 | E (E-M12-28) | Pass |
| 12.1, 12.3 S3 26 subject rows, inert rows | E (E-M12-29) | Pass |
| 13.1, 13.2, 13.3 S3 school table | E (E-M12-30) | Pass |
| 14.1, 14.2, 14.3 S4 filter and KPIs, 8080 | E (E-M12-31) | Pass |
| 14.4 school 9167 consistency | E (E-M12-64) | Pass |
| 15.1, 15.2 band tiles default and 8080 | E (E-M12-32) | Pass |
| 15.3 band boundaries 20/5/0 | U (`handlers.test.ts`, `addSegmentStudent`) | Pass (unit only, provisional) |
| 16.1, 16.2 S4 school table | E (E-M12-34) | Pass |
| 17.1, 17.2 heat map | E (E-M12-35) | Pass |
| 18.1, 18.2, 18.3 alerts (35 items), mood card | E (E-M12-36) | Pass |
| 18.4, 18.1 (filtered) alerts for 9167, 10220, 8298 | E (E-M12-62, E-M12-64) | Pass |
| 19.1, 19.2 S5 KPIs default and 8080 | E (E-M12-37) | Pass |
| 19.3 S5 school 9167 | E (E-M12-65) | Pass |
| 19.4 S5 school 8880 (GPS 2.88, no grade card, "-" with "150 calon") | E (`S5 school 8880 (D9)`) | Pass (INFERRED values, D9) |
| 20.1, 20.2 grade distribution | E (E-M12-38) | Pass |
| 21.1, 21.2, 21.3, 21.4 subject GPS and trend tables | E (E-M12-39/40) | Pass |
| 22.1, 22.2, 22.3 school table, 946 predictions, 8080 rows | E (E-M12-41, E-M12-41/63) | Pass |
| 23.1, 23.2, 23.3, 23.4 ALESA | E (E-M12-42) | Pass |
| 24.1, 24.2, 24.3 ROI and insights | E (E-M12-43) | Pass |
| 25.1, 25.2, 25.3 S6 header, cards, layout | E (E-M12-05/44) | Pass |
| 26.1, 26.2 S6 correlation, conclusions | E (E-M12-45) | Pass |
| 27.1 "Muat Turun Laporan" new tab, PDF | E (E-M12-46) | Pass (provisional) |
| 28.1, 28.3 S7 zero KPIs, empty list, 2 × 2 | E (E-M12-47) | Pass |
| 28.2, 29.4 create interventions, KPIs, list order | E (E-M12-50) | Pass (provisional) |
| 29.1, 29.2, 29.6 S7 panel, fields, layout | E (E-M12-48) | Pass |
| 29.3 required check blocks submit | E (E-M12-49) | Pass |
| 29.5 unknown student "Pelajar tidak dijumpai." | E (E-M12-51) | Pass (provisional) |
| 30.1, 30.2, 31.1, 31.4 S8 Student A | E (E-M12-05/52) | Pass |
| 30.3, 31.2 S8 Student B | E (E-M12-53) | Pass |
| 30.4 M11 school page → S8 for a student without answers | E (M11 test `#55`, link `/guru/kirkpatrick/pelajar/4644`; E-M12-54 in the levels spec) | Pass |
| 30.5 5571 / 5551 → 403, S5 links to 4664 / 4644 | E (E-M12-12/63, E-M12-41/63) | Pass |
| 31.3 S8 for a student without answers | E (E-M12-55) | Pass (provisional) |
| 32.1, 32.2, 32.3 S9 | B (S9 `/kirkpatrick` is 404) | Blocked (S9 not built) |
| 33.1-33.4 S10 | B (S10 `/maklum-balas` is 404) | Blocked (S10 not built) |
| 35.1, 35.2 Admin Sekolah alias S1 only, other screens refused | E (alias describe, 4 tests: renders S1 in the user shell, filter keeps own school, S2/S3 paths not routes, refused for the admin pages; S4-S8 redirect test), M (`/admin-sekolah/kirkpatrick` S1 for SMK DEMO with `?school_id=8078&state=Johor` ignored; `/admin-sekolah/kirkpatrick/behavior` → 404; `/admin/kirkpatrick` and `/admin/kirkpatrick/pelajar/4664` → landing path) | Pass (provisional) |
| 34.1 no horizontal scroll on S1-S10 at 375/768/1280 | E (E-M12-60 and the per-screen tests), M sweep at 320, 375, 768, 1280 on S1-S8 for admin and the `/guru/kirkpatrick/behavior` twin: `scrollWidth` equals the viewport minus the scrollbar everywhere | Pass for S1-S8; S9/S10 Blocked |
| 34.2 S2 2 × 2, S7 KPI 2 × 2, S5 ALESA 3 columns, tables scroll in cards | E (E-M12-27, 47, 60 and the S5 tests) | Pass |

Summary of results: no Fail. Blocked: AC-01.6, 10.3, 32.x, 33.x (S9/S10 not built) and the S9/S10 half of 01.7 and 34.1. Unit-only: 15.3.

## Bugs

| ID | Severity | Steps | Expected | Actual | Screenshot | Owner |
|---|---|---|---|---|---|---|
| BUG-M12-01 | Low | Run `smoke-kirkpatrick-overview` and `-levels` on desktop at 85-100 % CPU. | The 5 s `expect` budget is enough once the app has booted. | S1, S3, S5 and S8 data takes more than 5 s to appear under load, so 12 desktop tests failed at least once ("element not found", wrong tab title "Kirkpatrick" while loading); one test with 10 navigations exceeds 120 s. All pass when the budgets are raised. No wrong value was ever observed. Either the S1/S3/S5/S8 aggregates need a lighter first load (NFR perf) or the specs need explicit waits. | none | frontend / M12 mock (perf) and the E2E specs |
| BUG-M12-02 | Low | Log in as adminsekolah (8, SMK DEMO). Open `/admin-sekolah/kirkpatrick`, then `/admin-sekolah/monitoring`. | The same school should not read as having no activity on one screen and 9 active pupils on the other. | S1 shows T3 "0/9 … 0 sesi · 0% ketepatan", T2 "0% … 0 soalan dijawab" and "Tiada Data vs Tiada Data"; M11 shows 9 active pupils and 177 answers for SMK DEMO. M12 BR-M12-35 includes the viewer's own fixture school but the fixture has no session segment. | none | M12 (or M05 fixture sessions); demo account only |

## Observations

- OBS-M12-01: `/admin-sekolah/kirkpatrick` shows the school select "Semua Sekolah / SMK DEMO" and the state select; a `?school_id=8078&state=Johor` in the URL changes nothing (AC-35.1). Level cards and flow pills are non-links as specified (v1.8).
- OBS-M12-02: D10: only `aria-hidden` on icon SVGs inside `main` on S1-S8 (S8 has none); no added `role` or `aria-*`. D22: no `img` in `main` on S1-S8 and no network request outside the preview. Privacy: S8 "Pelajar Demo 004664"; S3/S5 rows use the "Demo" names and `@demo.test` e-mails.
- OBS-M12-03: Console: no page error or console error on S1-S8 across 320/375/768/1280.
- OBS-M12-04: At 320 px the S1 "Negeri" select clips its text ("Semua Nege…", `.playwright-mcp/m11m12qa/kp-s1-320.png`). It stays within the card and meets AC-05.5 (box inside the card, ≥ 36 px); cosmetic only at 320.
- OBS-M12-05: The three M05 owner items of M11 SRS §13 (8080 bands, 30-day active) do not affect M12 values: S1 8080 (53/184, 15,007, 75.6 %) and the platform figures match every asserted AC.
- OBS-M12-06: Menu "Monitoring" and the M12 `Monitoring` links ("Pelajar Berdaftar", "Guru Aktif", school links) target `/admin/monitoring…`, which is 404 until M17 mounts it (see BUG-M11-01 in the M11 report); the `/guru` twins and the alias use their own prefix and work.

## Re-test notes

- When S9/S10 are built: AC 01.6, 10.3, 32.x, 33.x, and the S9/S10 half of 01.7 and 34.1.
- After M17 mounts `/admin/monitoring*`: re-check the KPI and band links from S1, S4 and S5 on the `/admin` prefix.
