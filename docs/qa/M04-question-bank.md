# QA report: M04 Bank Soalan (admin), G5

Build: `vite build --mode e2e` (rebuilt after T6 landed), `vite preview` on port 4402, Playwright Chromium, projects mobile 375, tablet 768, desktop 1280, workers=2. SRS v1.18. Scope: S1-S6, S5h, S7-S14 (T6a/b/c built and in scope).

## Verdict: READY (after targeted re-run, see "Re-run after fixes")

The first-run verdict below is kept for the record; BUG-01..04 are closed.

### First-run verdict: NOT READY

Reasons: 3 open Medium bugs (BUG-01, 02, 03) break explicit ACs (AC-32.2, AC-26.2/28.4, AC-23.2). No Critical or High bug found; no layout break at any width. G5 needs every AC Pass, so re-gate after the three Mediums are fixed (or the SRS is amended). Everything else passes.

## Runs

| Run | Result |
|---|---|
| Full `e2e/m04-question-bank` (developer 59+T6 specs and my 4 QA specs), desktop | 146 pass, 1 skipped (by design), 5 fail |
| Same, tablet | 145 pass, 2 skipped, 5 fail |
| Same, mobile | 145 pass, 2 skipped, 5 fail |
| Re-run of each failure alone | BUG-01 (x2 ids), BUG-02, BUG-03 and the drawer test (BUG-04) fail again (real). The t6 "modal touch target" test (43.5-43.85 px vs 44) passed 6/6 alone: flake, see stale items. |
| Unit `npx vitest run --project unit src/modules/m04-question-bank` | 26 files, 417 tests, all pass |
| `npx tsc -p tsconfig.e2e.json` | clean (QA spec type errors fixed); eslint clean on `qa-g5-*` |

Skips are viewport guards in my specs (desktop-only sidebar test, mobile-only drawer test, desktop-only badge test); a skipped test is not counted as Pass: the drawer check ran on tablet and mobile, the sidebar and badge checks on desktop.

An earlier tablet run of dev test `t7-structured` "header, stats..." failed once on `touch target height`, then passed 7/7 alone and in a 6x repeat: flake.

QA specs written (all in `e2e/m04-question-bank/`): `qa-g5-list-detail.spec.ts` (S1, S3, nav, guards), `qa-g5-forms-import-quality.spec.ts` (S2, S4, S5, S5h, S6), `qa-g5-cross-cutting.spec.ts` (14-route responsive and 12px sweep, lookups, counts, PKSK, user-portal nav, S8/S9), `qa-g5-reports.spec.ts` (S7, S13, S14). Source and developer tests untouched. No config left in the repo (scratch config is in the scratchpad).

## Bugs

| ID | Sev | Repro | Expected vs actual | Owner |
|---|---|---|---|---|
| BUG-01 | Medium | Admin opens `/admin/questions/178460` (also `/178000`). Neighbouring PKSK ids (177698, 178100, 178459) open. API `GET /api/questions/178460` answers 404. Test: `qa-g5-cross-cutting` "S3 of PKSK id 178460 / 178000". | AC-32.2 / E2E-M04-62: S3 of 178460 shows the text and options, "-" for Subjek and Tahap. Actual: in-page 404. The unit test (`contributions.test.ts`) says `questions.get(178460)` exists, so the runtime store differs from the unit boot. Only two sampled gaps found (22 ids sampled); the full extent is not scanned. | backend-developer (mock store) |
| BUG-02 | Medium | Admin dismisses an MCQ on `/admin/soalan-gambar` (count drops to 6,143), then opens `/admin/master-notes` (user shell, desktop). | AC-26.2 ("SHU badge -1") / AC-28.4 / FR-M04-108: badge equals the live unfiltered MCQ count. Actual: "Gambar Rajah" stays 6,144; the badge is a hard-coded string in `src/shells/nav/user-nav.ts` line 568. | frontend-developer (shell nav) |
| BUG-03 | Medium | `/admin/structured-questions/3698` and `/4454`. | AC-23.2 / E2E-M04-47: part labels "3(A)", "3(B)", "3(C)" for 3698 and "A" for 4454. Actual: "a", "b", "c" (raw `partLabel`; `questionNumber` is not used, no upper-casing). | frontend-developer (display) / backend-developer (seed) |
| BUG-04 | Low | Mobile or tablet, admin, `/admin/master-notes`, open "Lagi" drawer. | AC-28.4: drawer has "Semakan Nota Master" and "Laporan Soalan" only (of the M04 entries). Actual: "Kertas Soalan Guru" is also listed. Confirm against live; may be a shell-wide rule. | frontend-developer (shell) / product-analyst |

Stale or flaky developer tests (for the Delivery Lead, not changed by me):
- `t6-reports.spec.ts` "the modal: MCQ content..." asserts 44 px touch targets while the modal is still scaling in (43.5-43.85 px on all 3 projects in the full run; 6/6 pass alone). Needs a wait for the open transition.
- `t7-structured.spec.ts` "header, stats, filter..." same kind of transient (1 failure in about 9 runs).
- Dev specs do not reference E2E ids; mapping below is by content.

Other observations (not bugs): icons are Lucide SVG, not Font Awesome classes (checked by presence, not by name). `mock.setUser` must be used without `loginAs` to switch users (loginAs re-applies its session on every load).

## Test plan: AC to tests

D = developer spec, Q = my QA spec, U = unit test. Result is for all three projects unless noted.

| AC | Tests | Result |
|---|---|---|
| 01.1-01.7 (S1 header, shell title, columns, rows, pager) | D smoke-list; Q list-detail (columns, row badges, status, pager window, 768 pager fit) | Pass |
| 02.1-02.3 (tiles, Bahasa Cina/Tamil, tile filter) | D; Q (7+24 tiles, values, tile sum = 465,278) | Pass |
| 03.1-03.5 (filters, URL, compliance, ignored params, empty) | Q (all 7 option lists, combined filters, archived, pending_mapping, missing_source, draft, verified_generated, ignored params, empty) | Pass |
| 04.1-04.5 (bulk) | D; Q (four verbs' confirm text, cancel sends no write, archive 2 and delete 1, filters kept) | Pass |
| 05.1-05.3 (row actions) | D; Q (hrefs, cancel keeps row) | Pass |
| 06.1-06.6 (S2) | D; Q (copy, difficulty cards, required one by one, create then first row, total 465,279) | Pass |
| 07.1-07.5 (answer cards) | D; Q (A-D rows, T/F, short, essay, optional) | Pass |
| 08.1-08.5 (keyboard) | D; Q (36x36, titles, 9 harakat, Jawi letters, 580 px panel, bottom sheet, newline, focus, Esc/close) | Pass |
| 09.1-09.6 (DSKP) | D; Q (chain, disabled states, tag, clear Subjek keeps tag, set both resets) | Pass |
| 10.1-10.5, 10.7 (S3) | D; Q (564159, archived 129114, sidebar placement, delete cancel/accept, states-profile answer cards) | Pass |
| 10.6 (status buttons) | Q (570001, states profile) | Pass |
| 11.1-11.5 (AI) | D; Q (loading line, regenerate confirm/cancel/accept) | Pass |
| 12.1-12.5 (S4) | D; Q (required options, save shows new text, Batal, 570010-13, 570022 image remove flags) | Pass |
| 13.1-13.6 (S5) | D; Q (copy, suffix, required, 3-row CSV 2/1 then 3/0, template file name and header) | Pass |
| 14.1-14.2 (S5h) | D; Q (no buttons, Kembali) | Pass |
| 15.1-15.5 (S6) | D; Q (shell title, KPI labels, upper-case buckets, backticks, Purata desc, 11 levels, action list) | Pass |
| 16.1-16.2 (audit) | D; Q (busy state, no dialog) | Pass |
| 17.1-17.6, 17.8, 17.9 (modal) | D; Q (7 reasons with descriptions, 500 max, cancel/Esc send nothing, "Menghantar...", default failure text, source defaults) | Pass |
| 17.7 (report on S7, MCQ inactive) | Q (send via harness, S7 Menunggu + Dinyahaktif) | Pass |
| 18.1-18.3 (structured modal) | D; Q (descriptions; 2 reports active, 3rd inactive) | Pass |
| 19.1-19.9 (S7) | D; Q (badge order, MCQ block, tabs/URL/counts, no pager, unknown status) | Pass |
| 20.1-20.4 | D; Q (no dialog, counts, Nyahaktif note, reactivation) | Pass |
| 21.1-21.3 (S13) | D; Q (seeded 5001: 3/1/1/1/0, empty admin, other users' reports never show) | Pass |
| 22.1-22.5 (S8) | D; Q (copy, add href, KBAT options, alphabetical pills, counter) | Pass |
| 23.1, 23.3 (S9 header, actions) | D; Q (edit href, back links) | Pass |
| 23.2 (part labels) | Q (3698 labels) | Fail (BUG-03) |
| 24.1-24.5 (S10) | D | Pass |
| 25.1-25.6, 26.1, 26.3 (S11 and actions) | D | Pass |
| 26.2 (counts -1, badge -1) | D (counts); Q (badge) | Fail (BUG-02, stat part passes) |
| 27.1-27.5 (S12) | D | Pass |
| 28.1-28.3 | Q (desktop group items and hrefs, bottom nav, Lagi, shell titles S2-S11) | Pass |
| 28.4 | Q (desktop sidebar entries; badge value 6,144; drawer) | Fail (BUG-02 dynamic, BUG-04 drawer); static entries Pass |
| 29.1-29.2 | Q (guests to /login on 9 admin routes plus S7/S13, pelajar redirected from S1 and S7, S13 allowed) | Pass |
| 29.3 | Q (465,278; Prinsip Perakaunan 2,970; S6; S8 4,064; S11 6,144/522/6,666); U | Pass |
| 29.4 | Q (select lists agree across S1/S2/S5, id order; S8/S11 alphabetical). Direct comparison with `GET /api/subjects` not possible from the page (fetch is not intercepted), covered by U | Pass (partial) |
| 30.1, 30.6 | Q sweep: 14 routes x 3 widths, scroll width and no text node under 12px | Pass |
| 30.2-30.5 | D + Q (pager fit, 240 px column, stacking, 44 px targets) | Pass |
| 31.x, 33.x, 34.x (store contracts) | U only (`questions-store`, `contributions`, `reports`, `workflow-*`); not exercised in a browser | Pass (unit) |
| 32.1, 32.3 | Q (search finds no PKSK text), U | Pass |
| 32.2 | Q | Fail (BUG-01) |

E2E-M04-01..58: covered by the rows above (each Q test name carries its E2E id). E2E-M04-59: Pass (partial, see 29.4). E2E-M04-60..69: store-contract cases, Pass via unit tests only, no browser run. Deferred: none (S7, S13, S14 are built and verified).

Gaps: AC-30.5 on S1 mobile is checked for the first row only; keyboard-panel and modal targets as listed; drag-and-drop is not applicable.

## Responsive and fidelity spot-check

Screenshots in `scratchpad/m04-g5/shots/` (`sN-375/768/1280.png`, S1, S2, S6, S7, S8, S10, S11, S12). No horizontal page scroll at any width on any of the 8 screens (scrollWidth equals innerWidth; also asserted across 14 routes by the sweep). S1 at 1280 was compared side by side with `questions-list-desktop.png`: same structure (tile groups, filter grid, columns, badges, pager). Accepted items not counted as gaps: S12 0/0/525 default, S6 narrow labels below the bar, S11 2+1 layout at 375. I did not pixel-compare S2, S6, S8, S10, S11 and S12 against every reference image; only S1 (desktop) was visually compared and S11 mobile was glanced at (stat cards and filters match the reference layout). Visible differences on S1 versus the reference are the already-documented fixes (subject cell book icon, shell title without subtitle). No other fidelity gap observed.

## Re-run after fixes (2026-10-02)

Fresh build (`vite build --mode e2e`, port 4402). Full `e2e/m04-question-bank` suite, workers=2:

| Project | Pass | Skipped (viewport guards) | Fail |
|---|---|---|---|
| desktop | 151 | 1 | 0 |
| tablet | 149 | 2 | 1 |
| mobile | 149 | 2 | 1 |

The two failures are the same developer test, `t6-reports` "the modal: MCQ content..." (touch target 43.76-43.85 px vs 44). Re-run alone 9 times (3 projects x 3): 5 pass, 4 fail (desktop x3, mobile x1; heights 43.65-43.99). It is intermittent and passes at rest, so it is a test-timing defect (the modal is still scaling in when the box is read; the "wait for layout to settle" change did not remove it), not a layout bug. Reported as a stale or flaky test (Low, owner: the developer who wrote t6). The t7 structured touch-target test passed on all 3 projects.

| Bug | Result |
|---|---|
| BUG-01 PKSK ids 178000 / 178460 | Closed. My specs for both ids pass on all 3 projects. |
| BUG-02 "Gambar Rajah" badge | Closed. After a dismiss, navigating to S12 shows 6,143 (desktop). I judge refresh on the next user-shell page load acceptable for AC-26.2 / AC-28.4: the badge is a nav counter, and the AC compares counts after the action, not live push. |
| BUG-03 S9 labels | Closed. 3698 shows 3(A) 3(B) 3(C); the label test passes on all 3 projects. |
| BUG-04 drawer entries | Closed. The drawer test passes on tablet and mobile (only "Semakan Nota Master" and "Laporan Soalan"). |

Unit tests were not re-run after the fixes (last run: 26 files, 417 pass); the e2e suite above is the regression check.

### Final verdict: READY for the built scope. No open Critical, High or Medium bug. Open: one Low flaky developer test (modal touch-target timing).
