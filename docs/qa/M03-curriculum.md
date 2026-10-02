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
