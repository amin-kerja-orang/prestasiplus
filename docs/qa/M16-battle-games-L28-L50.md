# M16 Battle & Permainan, G5 for L28 Tournament and L50 Sekolah Bersaing

Slug: M16-battle-games (task M16-T6, roles-matrix rows L28 and L50, plus the S20-S22 part of row L26 as input). Tested 2026-10-09/10 on branch `s3-qa-m16-t6` at 55d79b9 (worktree of `feature/student-prototype`). Inputs: SRS M16 (FRs, section 8 states, section 10, section 12, section 0.1), URS M16 (AC-M16-*, DV-M16-01..41), discovery M16, live screenshots in `docs/discovery/img/M16/` (main tree). Live was not touched.

## Verdict

| Row | Screens | Verdict | Reason |
|---|---|---|---|
| L28 Tournament (Murid) | S23 `/tournament`, tournament detail (provisional), S30 banner | **Ready** (re-tested) | Every in-scope AC passes (S24-dependent AC-M16-03.5 stays Deferred), 3 viewports green after the fidelity fixes; F-1 Pass. No Critical/High bug. One Low residual at 375 (O-6). |
| L50 Sekolah Bersaing (Admin Sekolah) | S28 `/sekolah-bersaing`, `?week=` | **Ready** (re-tested) | AC-M16-38.1..38.6 pass, 3 viewports green after the fidelity fixes; F-2, F-3, F-4 Pass. No Critical/High bug. Two Low residuals (O-7, O-8). |

L26 input (S20-S22): all pass except one data finding, AC-M16-29.5 rows 6-20 (B-1, now covered by DV-M16-38 (extended)); S20/S21 F-4 re-tested Pass. See "Note for L26".

## Environment and runs

- Scratch config (copy of `playwright.config.ts`: port 5120, `vite build --mode e2e --outDir dist-e2e-5120` + `vite preview`, webServer timeout 900000, `expect.timeout` 30000). Preview on 5120 (my process, PID 17164) stopped at the end; the scratch config, `dist-e2e-5120` and `test-results` were deleted. No `node_modules` was created in the worktree (resolved from the parent main tree). Nothing else was touched.
- Machine heavily loaded (a plain `grep` took more than 120 s at times; the full unit run took 17 min).

| Run | Result |
|---|---|
| E2E run 1, default `expect` 5 s, `--workers=1 --timeout=120000` | Aborted by me after 17/81. 8 failures, all `element(s) not found` at the 5 s expect while the page was still booting under load (S20, S28 on mobile). Not app results. Log kept in my scratch folder (`e2e-run1-aborted-5s-expect.log`). |
| E2E run 2, `expect.timeout` 30 s, same command, all 3 specs `smoke-competition`, `smoke-sekolah-bersaing`, `smoke-tournament` | **81 passed, 0 failed (1.0 h)**. Per viewport: mobile 27/27, tablet 27/27, desktop 27/27. The 6 known-gap tests (E2E-M16-73b and 73c, one per viewport each) are `test.fail` and count as passed because they failed as expected (DV-M16-38). |
| Unit `npx vitest run src/modules/m16-battle-games --pool=threads --maxWorkers=2` | 7 of 8 files, 218 tests passed. `sekolah-bersaing.test.ts` hit "Failed to start threads worker ... Timeout waiting for worker" (load, no test ran). |
| Unit re-run of that file alone, `--maxWorkers=1` | 9/9 passed. Total 227/227 tests pass. |
| Exploratory, Playwright lane 3 (`mcp__playwright3__*`) against the 5120 preview with mock clock 2026-09-25T15:40+08:00 (same as the E2E clock) | See below. |

Exploratory coverage: student (`pelajar@demo.test`) and school_admin (`adminsekolah@demo.test`), logged in through the real login form (demo password from `src/mock/core-data/accounts.ts`). Widths 375, 768, 1280 and 320 for S20, S21, S22, S23, S28 (and S23/S28 with the `tournaments` fixture banner). Measured per page: horizontal scroll (`scrollWidth` vs `innerWidth`), smallest rendered text in `main`, shell title, tab title. Result at all four widths for both roles: no horizontal page scroll (scrollWidth never above innerWidth), smallest text 12 px (S23: 14 to 16 px), titles as listed below. S28 at 375 and 768 hides "Streak Avg" and "Nota/Pelajar" (E2E-M16-89 asserts it; at 320 the school name is ellipsised inside its cell, no overflow). Screenshots: `C:\Users\hp\AppData\Local\Temp\claude\d--Dev-Projects-pretasiplus-app\3cab13af-f8cd-4424-9a30-02762f740563\scratchpad\m16-qa-t6\` (`s-<screen>-<width>.png`, `s-tournament-fx-*.png`, `v-sb-*.png`, `sa_*.png`). Console on the e2e preview: only `GET /favicon.ico 404` (Observation O-1). Not run: a separate visual pass of the provisional tournament detail page (covered by E2E-M16-80 on 3 viewports with a no-horizontal-scroll assertion).

## AC table, L28 and L50 (22 ACs: 21 Pass, 1 Deferred, 0 Fail, 0 Blocked)

| AC | Evidence | Result |
|---|---|---|
| 01.3 (S23 header "Liga & Tournament" / "Senarai tournament antara sekolah") | E2E-M16-76 x3; exploratory title/subtitle at 4 widths | Pass |
| 01.5 (S28 in the user shell, "Sekolah Bersaing" / "Selamat datang kembali") | E2E-M16-05 admin and student x3, E2E-M16-89 school admin x3; exploratory school_admin and student at 4 widths | Pass |
| 01.6 (tab titles: S23 "Liga & Tournament", S28 "Sekolah Bersaing — Leaderboard Mingguan", tournament 404 "404 - Halaman Tidak Dijumpai \| PRESTASIPLUS") | E2E `expectTabTitle` x3, exploratory `document.title` | Pass |
| 02.2 (student: no "Cipta Tournament Baru" on `/tournament`) | E2E-M16-06 x3. The S24 redirect half is deferred with S24 | Pass |
| 02.3 (`/tournament/1` renders the M01 404) | E2E-M16-81 x3; exploratory `/tournament/1` and an all-zero uuid: "404 / Halaman Tidak Dijumpai / Halaman Utama / Mula Latihan". Other listed paths (`/tournament/admin`, `/tournament/create`) not executed (S24 area, deferred) | Pass |
| 03.1 (no active tournament: one `GET /api/tournament/active` per load on `/dashboard`, `/tournament`, `/sekolah-bersaing`, no banner) | E2E-M16-09 x3 paths x3 viewports | Pass |
| 03.2 (registration card, "Pendaftaran dibuka", badge "DAFTAR", links to `/tournament/{uuid}`) | E2E-M16-10 x3 (provisional); exploratory with fixture at 4 widths | Pass (provisional) |
| 03.3 (three cards in API order, "Sedang berlangsung", red LIVE card with "MAIN") | E2E-M16-10 x3; exploratory screenshot `s-tournament-fx-1280/375.png` | Pass (provisional) |
| 03.4 (banner request 500: no banner, no message, page renders) | E2E-M16-09 failing request x3 | Pass |
| 03.5 (tournament created through S24 appears in the banner; draft never) | Needs S24 `/tournament/admin/create` (XR-M16-11) | Deferred |
| 04.1 (no text below 12 px at 375, content area) | Exploratory sweep of leaf text in `main`, S23/S28 at 375 and 320 (minimum 12 px) | Pass |
| 04.2 (no horizontal scroll at 375/768/1280; S28 included) | `expectNoHorizontalScroll` in E2E x3, exploratory at 4 widths x 2 roles | Pass |
| 32.1 (S23 hero, admin button "Cipta Tournament Baru" to `/tournament/admin/create`, empty text) | E2E-M16-76 x3 (admin). The link is the known dead link (S24 deferred) | Pass (known dead link) |
| 32.2 (two or more cards with "Pendaftaran dibuka" / "Sedang berlangsung", linking to uuids) | E2E-M16-77 x3 (provisional) | Pass (provisional) |
| 34.1 (detail page of the registration tournament: title, "Pendaftaran dibuka", read-only settings) | E2E-M16-80 x3 (provisional) | Pass (provisional) |
| 34.2 (unknown uuid renders 404) | E2E-M16-81 x3, exploratory | Pass |
| 38.1 (hero "🏆 Sekolah Bersaing", subtitle, "Minggu 21 Sep 2026 · 49 sekolah dalam pertandingan", column headers) | E2E-M16-89 x3; exploratory text dump | Pass |
| 38.2 (49 rows; gold Kelantan 0.0% 🔥 15.0 0.0, silver Johor 🔥 9.3, bronze Sabah 🔥 8.6; #17 Selangor 0.5% 🔥 1.6; #49 Selangor 🔥 0.0) | E2E-M16-89 x3; exploratory rows 17/18/20 at 375 and 1280 | Pass |
| 38.3 (375 px: "Streak Avg" and "Nota/Pelajar" hidden, "aktif" 12 px) | E2E-M16-89 mobile branch (mobile and tablet projects hide them below 768); exploratory at 375/320 | Pass |
| 38.4 (footer "💡 Untuk Cikgu Besar / PIBG: ...") | E2E-M16-89 x3; screenshot `s-sb-1280.png` | Pass |
| 38.5 (`?week=` 14 Sep, 07 Sep, 31 Aug with 48 rows; 2025-01-06 empty state; row checks; Sabah #46 absent) | E2E-M16-90 x3 (E2E uses `?week=2026-09-16` for the 14 Sep week, a mid-week date that snaps to Monday). Exploratory with `?week=2026-09-14`: "Minggu 14 Sep 2026 · 48", row 18 Kelantan 0.0% 🔥 2.4, row 20 Kuala Lumpur 🔥 1.5; 07 Sep 48 rows; 31 Aug row 17 Selangor 0.2% 🔥 1.7; 2025-01-06 "📊 Data minggu ini belum dijana." / "Cron mingguan akan kira pada Isnin pagi. Tunggu kejap ya." and no rows | Pass |
| 38.6 (`?week=bogus` shows the current week, DV-M16-30) | E2E-M16-90 x3; exploratory also `?week=`, `?week=2026-02-30`: all show 21 Sep 2026 · 49 | Pass |

Not applicable to these rows: AC-M16-04.3 (S28 shows schools, no person names; checked for S20 below).

## S20-S22 (part of L26), input for the lead

| AC | Evidence | Result |
|---|---|---|
| 01.4 (header page title and "Selamat datang kembali") | E2E-M16-72/74, exploratory | Pass |
| 01.6 (tab titles) | S20 "Pertandingan Mingguan — PRESTASIPLUS", S21 "Uji Minda — Belum Ada Cabaran", S22 "500 - Ralat Pelayan \| PRESTASIPLUS" (exact URS values) | Pass |
| 04.1 / 04.2 | exploratory at 4 widths: no h-scroll, min text 12 px | Pass |
| 04.3 (names are the fictitious M02 names) | S20 shows "Murid Demo 20xx", "Pelajar Demo 000xxx", "Guru Demo", "Pelajar Maju Demo"; no real names | Pass |
| 29.1 (title, subtitle, "Minggu Ini 21 Sep — 27 Sep 2026", countdown "2h 8j 19m") | E2E-M16-72 x3; screenshot | Pass |
| 29.2 (countdown decrements, "Tamat!") | E2E-M16-72 (countdown ends) x3 | Pass |
| 29.3 (prizes Juara +100, Naib Juara +50, Tempat Ketiga +25, 3 columns at every width) | E2E-M16-72 x3; screenshots 375 and 1280 | Pass |
| 29.4 (no session this week: "Belum mula lagi minggu ini!", "Mula Latih Tubi") | E2E-M16-72 x3; screenshots | Pass |
| 29.5 (20 rows in Q-WEEK-RANK order) | E2E-M16-73 x3 checks rows 1 to 4 and 14 only. Rows 1, 2 and 5 match the AC; rows 3 and 4 are the accepted DV-M16-38. **Row 6 shows 96 betul, 85.2%, "6 sesi" where the AC reads "100 · 75.0%"** and rows 6 to 20 differ from live (B-1) | **Fail** (data, Medium, not blocking L28/L50) |
| 29.6 (own-status card) | E2E-M16-73 pelajarmaju x3 (provisional) | Pass (provisional) |
| 30.1 (S21 text, box, four ✅ lines) | E2E-M16-74 x3; screenshot vs `uji-minda.png` | Pass |
| 31.1 (S22 handled 500 page, "Halaman Utama" to `/`, "Cuba Semula") | E2E-M16-75 x3; exploratory text and links at 375/1280 | Pass |

## Bugs

Severity rule: Critical/High block a row. None found.

| ID | Sev | Screen | Steps | Expected | Actual | Evidence | Owner |
|---|---|---|---|---|---|---|---|
| B-1 | Medium | S20 `/permainan/pertandingan` | Log in as student or admin at the project clock, open S20, read rows 6-20 | AC-M16-29.5 row 6 "100 betul · 75.0%"; live rows 6-20 (screenshot `pertandingan-desktop.png`): 100/75.0%, 93/72.8%, 84/80.7%, 78/97.5% ... | Row 6 96 betul, 85.2%, 6 sesi; rows 7-20 take other values (65/77.6%, 45/67.5% ...). Same cause and class as DV-M16-38 (M05 weekRank seed), but DV-38 and the `test.fail` cover only rows 3 and 4 (see `s-pertandingan-1280.png`) | `s-pertandingan-1280.png` vs live image | M05 owner (seed). **Status (re-test): covered by DV-M16-38 (extended); not a blocking bug.** |

## Fidelity differences from live for the lead to rule on (none listed as a DV)

| ID | Sev | Screen | Difference (ours vs live) | Evidence |
|---|---|---|---|---|
| F-1 | Low | S23 | Hero has less padding: height about 116 px vs 136 px on live at 1280, content starts 24 px from the left vs 32 px; on mobile live wraps the title to two lines at a larger inset, ours stays on one line. Gradient is slightly less saturated (live violet/hot pink). Title colour white is DV-M16-39 and accepted. | `s-tournament-1280.png` vs `tournament-desktop.png`; `s-tournament-fx-375.png` vs `tournament-banner-mobile.png` |
| F-2 | Medium | S28 | Smaller typography and spacing than live: hero h1 24 px (live about 26 px at 1280, wraps to two lines at 375 where ours is one line), hero about 148 px high vs about 158 px, week card text 14 px vs about 16 px (card 52 px vs 60 px), column header cells 12 px brown vs live "% AKTIF / STREAK AVG / NOTA/PELAJAR" about 14 px dark, row height 61 px vs 70 px. Text colour (DV-M16-40) is excluded. | `v-sb-1280.png` vs `sekolah-bersaing-desktop.png`; `v-sb-375.png` vs `sekolah-bersaing-mobile.png` |
| F-3 | Low | S28 | Hero corners: live top corners are almost square and bottom corners strongly rounded; ours rounds all four corners equally. | same pair |
| F-4 | Low | S20 and S21 | Page content at 375 sits closer to the screen edge (about 10 px) than live (about 25 px); S21 content starts about 37 px higher than live at 1280; S21 body text and the pink help-box text are darker than live's grey/rose; S20 mobile title about 20 px vs live smaller (about 18 px). | `sa_permainan_pertandingan-375.png` vs `pertandingan-mobile.png`; `s-ujiminda-1280.png` vs `uji-minda.png` |

## Observations

- O-1: every page logs `GET /favicon.ico 404` on the e2e preview build. Likely a build-mode artefact; not checked on the dev server.
- O-2: the shell (all pages) draws the sidebar and bottom-nav icons grey and outlined, where live shows coloured filled icons (`tournament-desktop.png`). Shell-level, outside M16; reported for the shell owner.
- O-3: with the `tournaments` fixture the banner shows the third tournament as the red LIVE card ("LIVE: {school} vs {school}", real seed school names) while S23 lists the same tournament as a plain "Sedang berlangsung" card. Live's screenshot shows `<school> vs <school>` because its data is redacted. Not compared against a live S23 list (none observed).
- O-4: AC-M16-38.5 text names `?week=2026-09-14` while the E2E uses `2026-09-16`; both resolve to the 14 Sep week in the app (I executed 09-14 manually). Suggest aligning the E2E with the AC.
- O-5: `/tournament/admin/create` shows the M01 404 for school_admin (admin-only, S24 deferred); not a defect.

## Re-test notes

Re-test 2026-10-10 on branch `s3-qa-l28-retest` (after commit 2068076, fidelity fixes F-1..F-4). Build `vite build --mode e2e`, preview on port 5122, student account `pelajar@demo.test` at the project clock. Screenshots and raw measurements (scratch, not in the repo): the folder shots/ under the QA scratchpad, files s20-375.png ... s28-1280.png and measure.json. Live references: `docs/discovery/img/M16/` in the main tree. 768 px has no live reference: layout checked for breakage only (no clipping, no overlap, no horizontal scroll; all four screens look sound).

### E2E (smoke-competition, smoke-tournament, smoke-sekolah-bersaing; 27 tests x 3 projects = 81)

| Viewport | Result |
|---|---|
| mobile 375x812 | 26 of 27 first run; the one failure (E2E-M16-72 header ..., first test after the cold start) was `Failed to fetch dynamically imported module .../PertandinganPage-*.js` inside `gotoApp`, a cold-server timing flake. Re-run alone: **pass**. Effective 27 of 27. |
| tablet 768x1024 | 27 of 27 pass |
| desktop 1280x800 | 27 of 27 pass |

No real failure. No spec was changed. Total first run: 80 passed, 1 flake (47 min with --workers=1).

### Horizontal scroll at 320

S20, S21, S23, S28: `scrollWidth` = `clientWidth` = 320. Pass. Also equal at 375, 768 and 1280.

### Fidelity items

| Item | Result | Measured (ours) vs live |
|---|---|---|
| F-1 S23 hero | **Pass** | 1280: hero 973 x 136 px (live 136), title at 32 px inset (x 314 vs hero x 282), gradient `#5a3cf5 -> #9a14ff -> #f5399f` (rgb 90,60,245 / 154,20,255 / 245,57,159) matches live. 375: title wraps to two lines (72 px block, 30 px font) like live. Title white (DV-M16-39, accepted). 768 one-line title, no breakage. |
| F-2 S28 | **Pass** | 1280: hero 158 px (live 158), h1 26 px; week card text 16 px, card 60 px (live 60); right header labels "% AKTIF / STREAK AVG / NOTA/PELAJAR" 14 px dark (live same, visual compare); rows 69 px (live 69-70). 375: h1 30 px on two lines. Hero text dark amber (DV-M16-40, accepted). |
| F-3 S28 hero corners | **Pass** | computed `border-radius: 6px 6px 24px 24px`: top almost square, bottom strongly rounded, as live. |
| F-4 S20/S21 | **Pass** | 375: content left edge x = 25 px on S20 and S21 (live about 25). S20 mobile title 18 px (live about 18). S21 1280: back link at y 170 vs live 171, so the offset is fixed; body text and the help box text now light grey/rose like live. |

### New residual observations (Low, none blocking, none in the first-round list)

- O-6 S23 at 375: hero 196 px high vs about 179 px on live (vertical padding about 8 px more at top and bottom on ours). 1280 is exact.
- O-7 S28: gaps are tighter than live at 1280 (hero to week card 16 px vs about 25 px, week card to table 16 px vs about 22 px). At 375 the hero is 220 px vs about 243 px on live (live h1 has a taller line-height on its two lines). Sizes and rows otherwise match.
- O-8 S21 at 1280: the brain illustration is about 60 px wide vs about 72 px on live, so the card sits about 31 px higher than live below the title. Back link position matches.

### Still open

- If the M05 weekRank seed is reconciled, re-run E2E-M16-73/73b/73c; the two `test.fail` tests will then flip to unexpected passes and need their `test.fail` removed. B-1 itself is covered by DV-M16-38 (extended).
- After S24 is built, execute AC-M16-03.5 and the S24 redirect half of AC-M16-02.2, and click "Cipta Tournament Baru".

### Verdicts after re-test

- **L28 Tournament: Ready.**
- **L50 Sekolah Bersaing: Ready.**
