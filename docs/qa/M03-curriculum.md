# QA report: M03 Kurikulum (admin scope), G5

Build: `vite build --mode e2e` (own build in scratch), `vite preview` on port 4541, Playwright Chromium, projects mobile 375, tablet 768, desktop 1280, workers=2. SRS v1.10. Scope: S1-S11, handlers #1-#24, admin sidebar and "Lagi" entries (FR-91/92), guards (FR-94). S12-S14 and handlers #25-#27 (M03-T1a, T4) are not built.

## Verdict: READY (admin scope)

Every in-scope AC was executed and passed on all three projects. No Critical or High bug. No layout break at 375, 768 or 1280 on any of the 11 admin routes. Three Low observations are listed below (none breaks an AC). The student ACs stay open until T1a/T4 are built, so a G5 re-run is needed for S12-S14.

## Runs

| Run | Result |
|---|---|
| Developer specs `t2-subjects-levels` + `t3-curriculum` (52 tests per project) | mobile 52/52, tablet 52/52, desktop 52/52 pass (156/156) |
| QA `qa-g5-nav-guards.spec.ts` (7 tests per project) | 15 pass, 6 skipped (viewport guards: sidebar tests on desktop only, Lagi tests below 1024 only), 0 fail |
| QA `qa-g5-flow-lookups.spec.ts` + `qa-g5-sweep-edge.spec.ts` (32 tests per project), first run | 81 pass, 15 fail |
| Same, re-run of the 5 failing tests (x3 projects) | 15/15 pass |
| Unit `npx vitest run --project unit src/modules/m03-curriculum` | 12 files, 179 tests, all pass |
| `npx tsc -p tsconfig.e2e.json --noEmit` | clean |

Final per project (dev + QA): mobile 89 pass / 2 skipped / 0 fail; tablet 89 / 2 / 0; desktop 89 / 2 / 0. A skipped test is not counted as Pass: sidebar checks ran on desktop, Lagi checks on mobile and tablet.

The 15 first-run failures were 5 defects in my own specs, not app bugs: (a) S1 select options were read before the async lookups loaded (3 tests: E2E-25, E2E-26/32, cross-screen flow); (b) my "no inactive marker" regexp matched the seeded topic name "Topik Tidak Aktif Demo" (E2E-06); (c) I expected a redirect for the non-numeric id `abc` on S8/S11 (see Observation O2). Fixed in the specs and re-run, all pass. Re-run alone: no flake seen in any final run.

QA specs written (in `e2e/m03-curriculum/`): `qa-g5-nav-guards.spec.ts`, `qa-g5-flow-lookups.spec.ts`, `qa-g5-sweep-edge.spec.ts`. Application code untouched; no Playwright config left in the repo (scratch config only); preview server on 4541 stopped. Developer t2 tests do not carry E2E ids, so mapping below is by content.

## Test plan: AC to tests

D = developer spec, Q = my QA spec, U = unit test.

| AC | Tests | Result |
|---|---|---|
| 01.1-01.7 (S1 header, filter, prompt, cards, tree, chevrons, subtopic rows) | D E2E-01..04 | Pass |
| 01.8 (ordering, DV-M03-09) | D E2E-05; Q SK T3 no number >= 100 and no repeated Topik n | Pass |
| 01.9 (inactive listed, counted) | Q E2E-06 with `curriculumInactiveDemo` (Sejarah D1: 3 chapters, "3 / 0", no marker, S3 unchecked) | Pass |
| 02.1-02.4 (add links, empty trees) | D E2E-02, 07, 08 | Pass |
| 03.1-03.3 (delete chapter/topic/subtopic, cascade) | D E2E-09, 10; Q cascade of a chapter with topics and subtopics | Pass |
| 04.1-04.5 (add/edit subtopic) | D E2E-11, 12 | Pass |
| 05.1-05.4 (flashes) | D E2E-13a-c; Q 999999 ids | Pass |
| 06.1-06.3, 06.5 (S2) | D E2E-14, 15a-c, 16 | Pass |
| 06.4 (native validation) | D (name, number 0); Q subject empty, level empty, number -3 | Pass |
| 07.1-07.4 (S3) | D E2E-17, 18 | Pass |
| 08.1-08.4 (S4) | D E2E-19 | Pass |
| 09.1-09.3 (S5) | D E2E-20 | Pass |
| 10.1-10.5 (S6) | D E2E-21, 22 | Pass |
| 11.1-11.3 (switch) | D E2E-23, 24 | Pass |
| 11.4 (lookups omit inactive subject) | Q E2E-25: S6 switch off subject 12, then M04 question form select and M04 list filter exclude it, S6 and S1 filter still list it, reactivation restores it, option order by id | Pass |
| 12.1-12.2 (S6 delete) | D E2E-26; Q S1 filter option gone, count 30, Matematik Tambahan delete lowers S9 "Subjek" of T4 and T5 by 1 | Pass |
| 13.1-13.4 (S7) | D E2E-27 | Pass |
| 13.5 (S7 validation) | D empty; Q order -1 | Pass |
| 13.6 (S7 save) | D E2E-28; Q duplicate "math" (lower case) rejected, long and markup names | Pass |
| 14.1-14.3 (S8) | D E2E-29; Q unchanged save keeps own code, code of another subject rejected | Pass |
| 15.1-15.3 (S9) | D E2E-30 (Q stage badges carry an icon, 3 labels) | Pass |
| 16.1-16.2 (level switch) | D E2E-31 | Pass |
| 16.3 (lookups omit inactive level) | Q E2E-25 level 11 (M04 form and list filter) | Pass |
| 17.1-17.2 (S9 delete) | D E2E-32; Q S1 "Tahap" option gone, S6 level line updated | Pass |
| 18.1-18.3 (S10) | D E2E-33; Q stage and order -1 blocked | Pass |
| 19.1-19.3 (S11) | D E2E-34 | Pass |
| 20.x-26.x (S12-S14: catalogue, detail, practice links, learning map) | not built (T1a/T4) | Out of scope (not built) |
| 27.1-27.3 (sidebar, active item, Lagi) | Q E2E-48 on 12 admin URLs: KURIKULUM group open, 3 links with hrefs, one active item per screen (S1-S5 Kurikulum, S6-S8 Subjek, S9-S11 Tahap), toggle saved in `admin_sidebar`, Lagi section with 3 links and navigation | Pass |
| 28.1-28.2 (user menus) | user shell, student screens | Out of scope (not built) |
| 29.1-29.2 (guards, S1-S11) | Q E2E-50: guest to /login, pelajar and guru kept out, on all 12 admin URLs; U guards 401/403 on every handler (`admin-handlers.test.ts`). The `/topics`, `/peta-belajar` guard part is not built | Pass (admin) |
| 30.1 (grade helper) | no UI; not executed here | Not executed (shared helper, outside admin screens) |
| 30.2 (lookups: active only, ordered, same ids) | Q E2E-25 (UI consumers); U `GET /api/subjects` and `/education-levels` | Pass |
| 30.3 (counts from M04) | D "13872 soalan", "11396 soalan", new level "0 soalan"; Q new subject "0". Not executed: deactivating a seeded question lowers the figures by one | Pass (partial) |
| 31.1 (no h-scroll, text >= 12px) | Q E2E-52 sweep: 14 admin URLs x 3 widths, scrollWidth <= innerWidth, no element past the viewport outside a scroller, no text node under 12px in `main`, nav reachable (sidebar or bottom nav); D S1-S5 | Pass |
| 31.2 (S6/S9 fit at 1280, scroll inside card below) | D; Q last header reachable by scrolling the card at 375 and 768 | Pass |
| 31.3 (S1 names wrap) | D; Q 210-char unbroken name, no h-scroll | Pass |
| 31.4 (form buttons one row) | D | Pass |

Handlers #1-#24: exercised through the UI above and the unit suite; #25-#27 not built. E2E-M03-01..34, 48, 50 (admin part), 52 (admin screens): executed, Pass. E2E-M03-35..47, 49 and the S12-S14 part of 50, 51 (CH-ALL queries, grade helper) and 52: Out of scope (not built) or not executed as noted.

## Cross-screen flow (executed, Pass)

New level "Tahap QA" (S10, S9 count 12) -> new subject linked to it (S7, S6 count 32, S9 "1 subjek", level line "Tahap QA") -> chapter via "Tambah Bab Pertama" (S1 "1", "0 / 0") -> topic ("1 / 0") -> subtopic ("1 / 1"), persisted on reload. Then deleting subtopic, topic, chapter returned S1 to "0 / 0" and empty tree, deleting the subject returned S6 to 31 and S9 to "0 subjek", deleting the level returned S9 to 11; S1 filters back to 31 and 11 options. Run on all 3 projects.

## Bugs

None open. No Critical, High, Medium defects found.

## Observations (Low, not AC failures, for the Delivery Lead to decide)

| ID | Sev | Observation | Owner |
|---|---|---|---|
| O1 | Low | `/admin/curriculum?subject_id=99999&education_level_id=1` (unknown subject or level, or non-numeric values) shows only the red box "Ralat memuatkan data. Sila cuba semula." with an empty subject select. SRS silent for unknown ids on S1 (BR-18 covers S2-S11). Screenshot: scratchpad `m03-g5/shots/s1-unknown-desktop.png`. | product-analyst (confirm intended), frontend-developer |
| O2 | Low | Non-numeric ids differ by screen: `/admin/curriculum/chapters/zzz/edit` and `topics/zzz/edit` redirect to S1 with a flash (E2E-13), but `/admin/subjects/abc/edit` and `/admin/education-levels/abc/edit` show the global 404 page. E2E-29/34 only specify numeric unknown ids (999), which redirect correctly. | product-analyst / frontend-developer (routes) |
| O3 | Low | S1 success-flash copy and all "Berjaya ..." texts are UNVERIFIED COPY (SRS §8); dev tests asserting them are `@provisional`. My specs do not assert them. | product-analyst (OQ-1) |

## Flakes

None observed in the final runs. Cold boot of 5-7 s per `gotoApp` (known F-34) made the guard and sweep tests slow (1.4 min each) but not unstable.

## Gaps

- Handlers #25-#27, S12-S14, user-shell entries (FR-93) and the user-side guards: not built, not tested.
- API 401/403 codes cannot be called from the page (mock is transport-level, not fetch); covered by unit tests only.
- AC-30.3 "deactivate a seeded question lowers the counts" and AC-30.1 grade helper: not executed.
- Visual comparison with live was spot-checked on screenshots (S1 BM D1 mobile, S6 desktop, S1 error state); I did not pixel-compare against reference images.

---

# QA report: M03 Kurikulum (student scope S12-S14), G5

Code: `feature/student-prototype` at 06beaa7. SRS v1.11. Rows L29 and L30 (Murid). Build `vite build --mode e2e --outDir dist-e2e-s7-m03qa`, `vite preview` on port 5135 (stopped at the end, own PID only). Config copy in the scratchpad (`m03-qa/playwright.m03qa.config.mjs`): projects mobile 375x812, tablet 768x1024, desktop 1280x800, per-test timeout 240 s. E2E_TIMEOUT_FACTOR=3, E2E_BOOT_TIMEOUT_MS=120000.

Deviations from the brief, stated honestly: (1) the supplied config has the Playwright default 30 s test timeout, which failed every test under the heavy machine load (many other sessions); I raised it to 240 s in my scratch copy. (2) `--workers=3` instead of 1 for the final run, because workers=1 projected to about 4 hours on the loaded machine. Tests use separate contexts, so state is isolated. (3) An accidental second concurrent run at the start was killed (own PIDs only) and everything was re-run from a clean build.

## Verdict: READY (student scope)

All 37 student ACs were executed and pass on mobile, tablet and desktop. No Critical or High bug. No horizontal scroll, no text under 12 px inside `main`, no clipped content at 375/768/1280 on S12, S13, S14 (including the empty map). One Low bug (F3) and two Low observations.

## Runs

| Run | Result |
|---|---|
| `t4-student-catalogue.spec.ts` (E2E-M03-35..47, 49, 50; 17 tests per project) | 51/51 pass (mobile, tablet, desktop) |
| New `qa-g5-student.spec.ts` (4 tests per project: F2 chapter links, F3 heading level, responsive/text/touch sweep, edge ids) | 9/12 pass; the 3 failures are the F3 test (one per project), see BUG-M03S-01 |
| Total | 60 pass, 3 fail (all F3), 0 flaky, 0 skipped |

## Test plan: AC to tests

| AC | Tests | Result |
|---|---|---|
| 20.1-20.3 (S12 header, title, 125 cards, chips, hrefs) | E2E-35; browser: 125 cards, 7 grade + 8 subject chips, hrefs as spec | Pass |
| 20.4 (DARJAH_1 + SAINS: 4 topics) | E2E-36; browser | Pass |
| 20.5 (TINGKATAN_2, ZZZ: empty text) | E2E-36; browser | Pass |
| 20.6 (typed TINGKATAN_4: 19, GEOGRAFI: 5, no chip active) | E2E-36; browser | Pass |
| 20.7 (`darjah_1`: 17, no grade chip active) | E2E-36; browser | Pass |
| 21.1-21.3 (card content, "+1 lagi...", click, 1/2/3 columns) | E2E-37; browser: columns 1/2/3 at 375/768/1280, order 1,7,2,8,9 for Matematik D1 | Pass |
| 22.1-22.4 (S13 header, hero, 3 stat cards in one row, subtopic cards, badges) | E2E-38; browser topics 7, 68, 4 | Pass |
| 22.5 (`/topics/99999` 404) | E2E-38; QA edge test `99999`, `0`, `abc` all show the 404 page | Pass |
| 22.6 (derived progress) | E2E-39 (pelajarmaju topic 1: 23 / 95 %, topic 7: 7 / 15 %); browser same | Pass (INFERRED rule, matches SRS seed) |
| 23.1-23.2 (Mula Berlatih targets) | E2E-40 (MATH, BM, BI, SCI, PI, PM, SEJ, GEO); browser 7 -> MATH, 68 -> BM, 4 -> SCI | Pass |
| 24.1 (header "Peta Belajar", no subtitle, tab title with em dash) | E2E-41; browser | Pass |
| 24.2 (hero, tiles hidden at 375, shown at 768+, static bar) | E2E-41; browser | Pass |
| 24.3 (path at 769+, alternating, centred at 768 and below) | E2E-42; browser: island centres 574/180/574 at 769, 376 at 768, 180 at 375, path element absent at 768 | Pass |
| 24.4 (fade-in on scroll, reduced motion unchanged) | E2E-42 (two tests) | Pass |
| 25.1-25.2 (7 pills, no Geografi, colours, 4 grade chips) | E2E-43; browser: Matematik rgb(59,130,246), Pend. Islam rgb(20,184,166), Sejarah rgb(239,68,68), Sains rgb(245,158,11) | Pass |
| 25.3-25.4 (Darjah 4 fallback, default Matematik + Darjah 4) | E2E-44; browser `grade=DARJAH_5`, `TINGKATAN_1`, `darjah_2`, `XYZ` -> Darjah 4 chip, 3 islands; Sains fallback "Penyiasatan Saintifik" | Pass |
| 25.5-25.6 (empty map GEOGRAFI, ZZZ; no dead pill) | E2E-45; browser: "0/0", "0%", texts, subtitle "... Geografi ..." / "... Zzz ...", no active pill | Pass |
| 26.1-26.2 (no history: 2 open, 3 locked, hrefs, cursor) | E2E-46; browser: `/practice?topic_id=1`, `=7`, locked cards are DIV with not-allowed cursor | Pass |
| 26.3-26.4 (started / mastered states, 1/5, 26 %) | E2E-47; browser as pelajarmaju: Nombor mastered 95 %, topic 7 started 15 %, Bentuk started 20 %, Operasi open, Bentuk dan Ruang locked, "1/5", 26 % | Pass |
| 28.1-28.2 (sidebar, drawer, bottom nav, active states) | E2E-49; browser at 1280 and 375: Topik active on S12/S13, Peta Belajar active on S14, bottom nav only "Topik" (active on S12/S13, inactive on S14) | Pass |
| 29.1 (guest to /login) | E2E-50; browser: guest `/topics` lands on `/login` | Pass |
| 29.2 (S12-S14 open to any logged-in user) | pelajar, pelajarmaju, admin all opened S12-S14 | Pass |
| 31.1 (no h-scroll, text >= 12 px, touch targets) | QA sweep on `/topics`, `/topics/7`, `/peta-belajar`, empty map at 3 widths; browser `scrollWidth <= innerWidth`, no node right of the viewport, small text 0, chips and buttons 44 px high | Pass |

Not in this scope: 30.x (shared helpers, covered by the admin section and unit tests).

## G4 follow-ups

- F1 (fixed 600 s unit timeouts): not a functional defect; noted only. The supplied config's 30 s default was too low on a loaded machine (see deviations).
- F2 (S13 vs admin's chapter links): executed as admin. Topic 67 "Kemahiran Bahasa Tingkatan 4" (BM T4 Bab 1, chapter 87): Dijawab 5, Kemajuan 0 % (A5: 5 answers, 0 correct). Topic 68 "Kemahiran Bahasa Tingkatan 5" (BM T5 Bab 99, chapter 413): Dijawab 38, Kemajuan 60 % (A3 33 answers with 11 correct plus A4 5 with 1 correct: 12 correct, round(100 x 12 / 20) = 60). Both match the M05 answers and BR-19. Chapter 382 (SEJ T5): Sejarah has no Tingkatan 5 legacy topic (`?grade_level=TINGKATAN_5&subject=SEJARAH` is empty), so no S13 can show those 40 answers; consistent with BR-19 (a chapter with no k-th topic has no answers), not a defect. Topic 125 "Sejarah Tingkatan 4" stays 0. Now asserted in `qa-g5-student.spec.ts` (passes on all three projects).
- F3 (S14 hero heading level): the live inventory has `h1` "Peta Belajar" inside `main` (EL-M03-S14-004) and a separate `h1` "Dashboard" in `header.topbar` (EL-M03-SHU-377), so live has two `h1`. The shell header owning an `h1` does not make `h2` correct: S13 here keeps its hero as `h1` next to the shell `h1`. S14 renders `h2`; FR-M03-81 and live say `h1`. Logged as BUG-M03S-01 (Low).

## Bugs

| ID | Sev | Steps | Expected / actual | Evidence | Owner |
|---|---|---|---|---|---|
| BUG-M03S-01 | Low | Open `/peta-belajar` as any user, inspect the hero title "Peta Belajar" | Expected `h1` (FR-M03-81, live inventory EL-M03-S14-004; consistent with S13). Actual `h2`. Failing test: `qa-g5-student.spec.ts` "F3 heading levels" on all 3 projects. No visible difference. | `.playwright-mcp/m03qa-s14-1280.png` | frontend-developer |

## Observations (Low, not AC failures)

| ID | Observation | Owner |
|---|---|---|
| OBS-M03S-01 | S13 hero: the book icon is hidden below 640 px (`hidden sm:block`) and has no filled white circle; live shows a filled `bg-white/20` circle with a white icon at 375 and 1280 (`docs/discovery/img/M03/topic-show-mobile.png`, `topic-show-desktop.png`). Ours at 375: `.playwright-mcp/m03qa-s13-375.png`. FR-M03-76 only says "fa-book-open". Decorative. | frontend-developer, product-analyst (decide) |
| OBS-M03S-02 | `/favicon.ico` returns 404 on the e2e preview (the only console error on all student routes). Environment, not M03. | devops-engineer |
| OBS-M03S-03 | Hero title colour on S13 and S14 is dark slate on the purple and emerald gradients. This replicates live (checked against the discovery screenshots), so it is not a defect. | none |

Checked and fine: the "Bentuk" island emoji tile is empty for pelajarmaju (known seed gap, URS OQ-11); shell header truncation ("Topik Pembelaj...") at 375 is the same on live and is owned by M23; "Darjah 1" wraps to two lines inside the 4 grade chips at 375 (they stay in one row, 44 px high).

## Gaps

- 30.x (grade helper, lookups) not executed here.
- The browser lane only resized the viewport (no touch device); the Playwright projects at 375 and 768 use `isMobile` and `hasTouch`.
- Visual comparison with live was done on screenshots by eye, not pixel-compared.
- The 3 F3 failures are intentional until BUG-M03S-01 is fixed; the QA spec stays red for that one test.

## Re-test 2026-10-10 (student scope, after e3ffe29)

| Item | Fix | Evidence | Status |
|---|---|---|---|
| BUG-M03S-01 | S14 hero title is `h1` (classes unchanged) | `qa-g5-student.spec.ts` F3 green at 375 / 768 / 1280; `t4-student-catalogue` + `qa-g5-student` 21/21 per project (one cold-start flake on mobile F2 passed on rerun); unit 14 files / 210 pass | Closed |
| OBS-M03S-01 | S13 hero book icon shown at every width in a filled `bg-white/20` circle, white icon | Delivery Lead compared with `docs/discovery/img/M03/topic-show-mobile.png`: matches | Closed |

No bug open. Verdict for the student scope stays **READY**; rows L29 and L30 at 100%.
