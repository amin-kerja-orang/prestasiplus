# QA report: M02 Users & Schools (admin), G5

Build: `vite build --mode e2e` to a scratch dir, served on port 4401. Browser: Playwright Chromium, projects mobile 375, tablet 768, desktop 1280, workers=2. SRS v1.29.

## Verdict: READY (after targeted re-run, see section "Re-run after fixes")

The first-run verdict below (Not ready) is kept for the record; every bug it lists is now closed.

### First-run verdict: NOT READY

Reasons: two open Medium bugs (BUG-02, BUG-03), two E2E-M02 cases with no executable path (38 tail, 54), and 6 developer tests that fail deterministically on every project (tab title of the in-page 404, BUG-01). No Critical or High bug was found. Re-gate after BUG-01..03 are routed (or the SRS/tests are corrected) and the visual gaps in BUG-04 are decided.

## Runs

Run 1 (first attempt, 231 developer tests): invalid. At about test 96 the host crashed Chromium ("Target crashed", worker exit 3221225794), producing 137 spurious failures. Before the crash: 94 passed, 3 real failures (the two 404-title tests and the SJK(C) test, a 30 s timeout). Not used for the verdict.

Run 2 (clean, per project and per file, 369 tests = 231 developer + 138 QA-written):

| Project | Passed | Failed |
|---|---|---|
| desktop | 116 | 7 |
| tablet | 117 | 6 |
| mobile | 119 | 4 |
| Total | 352 | 17 |

Re-run once on its own (second run):
- 18 tests (6 QA tests x3; my first versions had wrong assumptions: default passwords, PPD option value, no-code school id 9681, class-select behaviour; tests corrected): 18/18 pass. Not app defects.
- Tablet "delete a user through the modal": passed on re-run (flake, boot timeout under load).
- Developer SJK(C) test E2E-M02-33: fails again (30 s timeout, two full app boots, no timeout extension). Test-budget problem, not an app defect; the same AC passes in my QA test (120 s budget, 3/3).
- 404 title tests (unknown school edit, unknown user edit), 3 projects each = 6 tests: fail twice, deterministic. See BUG-01.

Net after re-runs: 6 failing developer tests (BUG-01) plus the SJK(C) developer test (timeout). Everything else passes.

`@provisional` tests (assert UNVERIFIED copy): all pass except the SJK(C) one (timeout, copy not at issue). No provisional failure shows wrong behaviour.

Unit: `npx vitest run --project unit src/modules/m02-users-schools`: 24 files, 512 tests, all pass. API 401/403 of every endpoint is asserted there (users-admin, imports, comp-students, schools-admin, subscriptions).

`tsc -p tsconfig.e2e.json`: clean.

## Bugs

| ID | Sev | Summary and repro | Expected vs actual | Owner |
|---|---|---|---|---|
| BUG-01 | Low (or stale test; owner decides) | Tab title on in-page 404 keeps the route title. Admin opens `/admin/schools/99999999/edit` or `/admin/users/99999999/edit`. | Developer tests expect `404 - Halaman Tidak Dijumpai \| PRESTASIPLUS`. Actual: the heading "Halaman Tidak Dijumpai" shows but the title stays "Edit Sekolah - Admin PRESTASIPLUS" / "Edit Pengguna - Admin Panel". SRS AB-01 says only "standard 404 page"; if the in-page 404 keeps the route title, the two tests are stale. | frontend-developer / product-analyst |
| BUG-02 | Medium | Test hooks required by SRS §12 are not implemented. `mock.reset({ comp: 0 })` throws "unknown key(s) 'comp'. Known: curriculumInactiveDemo, importRuns, questionStore"; profile `subscriptions-extra` absent. | E2E-M02-38 (S6 empty list) and E2E-M02-54 (grace row "Tempoh Ihsan") cannot run in e2e. Empty text covered only by unit test `CompStudentListPage.test.ts`. | backend-developer (mock) |
| BUG-03 | Medium (confirm vs live) | S6 out-of-range page shows an empty table without empty text. `/admin/comp-students?page=9`. | Only the table header is shown; no "Tiada pelajar komplimen lagi. Daftar baru." Possibly fine if live only shows it at total 0. | frontend-developer |
| BUG-04 | Low (visual) | S9 differs from `docs/discovery/img/M02/schools-list-desktop.png` at 1280. | Live: header cells title case, zero Pelajar/Guru counts dimmed grey, status control is a green toggle. Build: headers UPPER case, zeros bold dark, eye-like icon. | frontend-developer |
| DOC-01 | Low (doc) | SRS contradicts itself: E2E-M02-13 / FR-M02-21 say `grade` is still posted for Admin Sekolah "as live"; §0.2 AB-06 says it is not sent. Build follows AB-06 (verified by my test). | Fix E2E-M02-13 wording. | product-analyst |
| DOC-02 | Low (doc) | Default passwords differ per flow: S4 `Import2026`, S2 generator `Sekolah2026`, S7 `20262026`; none is `Demo1234`. SRS E2E text says "fixture default". Build is consistent. | Clarify per screen. | product-analyst |

Stale or invalid developer tests (not changed by me): the two 404-title tests (BUG-01) and the SJK(C) test (needs a longer timeout and in-app navigation).

## Test plan: AC to test

D = developer spec, Q = my specs (`qa-g5-shell-users`, `qa-g5-forms`, `qa-g5-imports-comp-subs`), U = unit. Result is for all three projects.

| E2E-M02 | Tests | Result |
|---|---|---|
| 01, 02 | D smoke-users; Q (cards order/hrefs, columns, "-", dates newest first, page 2 starts at 26, JPN badge) | Pass |
| 03 | D (table fit or in-card scroll, no h-scroll); computed font size not asserted | Pass (partial) |
| 04 | D; Q (filter kept in pager links, mobile Previous as text) | Pass |
| 05 | Q (combined filters, ring via box-shadow, no ring for JPN); school option sort order not strictly asserted | Pass (partial) |
| 06 | D | Pass |
| 07 | D; Q (dismiss, spinner while pending, inactive user 11 and a newly deactivated user refused at login) | Pass |
| 08, 09, 10, 11 | Q + D | Pass |
| 12, 13 | D; Q (values kept across role switch, generator reset, AB-06) | Pass |
| 14 | Q (grade 10 payload, maxlength 14, Batal) + D | Pass |
| 15 | Q (role visibility, inactive school not searchable) | Pass |
| 16 | D (provisional copy) | Pass |
| 17 | D + Q (loading, <=15 rows, no duplicate, "Buang") | Pass |
| 18 | D + Q (no-code school warning, generator output, badges) | Pass |
| 19 | D ("Disalin!" 2 s, real timers) | Pass (partial) |
| 20 | Q (JPN fault, 10 PPD, ppdState/ppdDistrict in request body; store not inspectable from UI) | Pass (partial) |
| 21, 22 | D + Q (JPN officer role kept, password round trip, blank keeps old, invalid e-mail) | Pass |
| 23 | D + Q (chip clear, latency, empty, fault, pick); package change tested with "personal" only | Pass (partial) |
| 24, 25 | D + Q | Pass |
| 26 | D | Pass |
| 27, 28, 29 | Q + D (drag-drop not run) | Pass (partial) |
| 30, 31 | Q + D | Pass |
| 32 | D (existing list); class filter T1-T5 not asserted | Pass (partial) |
| 33 | Q (SJK(C) via S10) | Pass |
| 34 | D | Pass |
| 35 | Q (940 refusal, valid paste, Title Case, new student logs in) + D (8078 refusal) | Pass |
| 36, 37 | D | Pass |
| 38 | D (pager, page 2); empty state needs `reset({comp:0})` | Blocked (BUG-02); unit only |
| 39, 40 | Q (classes by teacher with latency, fault, created students log in) + D | Pass |
| 41, 42 | D | Pass |
| 43-46 | D | Pass |
| 47-53 | D | Pass |
| 54 | D (cancelled / expired rows); grace row needs `subscriptions-extra` | Blocked (BUG-02) |
| 55-59 | D + Q (upgrade end date and note timestamp) | Pass |
| 60, 61, 62 | Q (menus; guest and student redirects on 16 routes; 16-route no-h-scroll sweep; S3 note card; modal width) | Pass; API 403 by unit |

URS AC-M02-xx.y trace to these rows through SRS §3.1. ACs not executed in a browser: grace-badge (28.7 part), S6 empty state (21.6), API 401/403 (31.4, unit only), drag-drop CSV (18.5 part), table font-size (01.7 part), clock-driven toast (31 part). I did not write separate manual scripts for them.

## Responsive and fidelity spot checks

Screenshots in the scratchpad `m02-g5/shots/` for S1, S2, S6, S9, S12, S14, S15 at 375, 768, 1280 (viewport and full page). Automated: no horizontal page scroll on any of the 16 routes (E2E-M02-62 passes) and the spot script asserted no overflow for 7 pages x 3 widths (21/21). Compared by eye against `docs/discovery/img/M02`: S1 desktop (no gap in the visible part; the live image is a full-page capture) and S9 desktop (BUG-04). S2, S6, S12, S14, S15 and the 375/768 shots were captured but not compared by eye.

## Files

- New tests: `e2e/m02-users-schools/qa-g5-shell-users.spec.ts`, `qa-g5-forms.spec.ts`, `qa-g5-imports-comp-subs.spec.ts`

## Re-run after fixes (fresh build, port 4401)

Fixes verified (targeted run, 24/24 pass on mobile, tablet, desktop):
- BUG-01: the two 404-title tests (unknown school edit, unknown user edit) now pass on all three projects.
- BUG-02: new QA tests in `qa-g5-retest.spec.ts`. E2E-M02-38: with `overrides: { comp: 0 }` the S6 list shows "Tiada pelajar komplimen lagi." and the "Daftar baru." link. E2E-M02-54: with profile `subscriptions-extra` S12 has 15 rows, stat "1 Tempoh Ihsan", and S14 (id 16) badge reads "Tempoh Ihsan". Note: `mock.reset(...)` called at run time is lost when the page reloads, so these tests pass the overrides through `mockInit.overrides`; both pass.
- BUG-03: `/admin/comp-students?page=9` shows the empty text and the pager at 375, 768 and 1280.
- BUG-04: S9 at 1280 compared by eye with `schools-list-desktop.png`: title-case headers, dim-grey zero counts, green toggle pill. Matches. (Automated check also added.)
- SJK(C) developer test E2E-M02-33: passes with the 120 s timeout.

Full regression (all of `e2e/m02-users-schools`, 128 tests per project, workers=2): desktop 128/128, tablet 128/128, mobile 127/128 on the first run. The one mobile failure (smoke-subscriptions "filters narrow the rows...", 30 s timeout under load) passed when re-run alone. Total 384 tests; 383 first-run passes, 1 flake that passes on re-run; 0 real failures.

`tsc -p tsconfig.e2e.json`: see the coordinator note on the temporary probe file; no errors from M02 specs.

Remaining bugs: none open. Doc items DOC-01 and DOC-02 remain Low (SRS wording), not blocking.

Final verdict: **READY**.
