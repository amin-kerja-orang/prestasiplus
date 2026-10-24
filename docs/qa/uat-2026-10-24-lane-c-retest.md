# UAT 2026-10-24 lane C: targeted G5 re-test (Fast track)

- Branch `claude/keen-mayer-zpmv2g`, HEAD `baf0cb9` (lane C fixes: 54af0b9, 4d4d8c6, d049646, 96a1c67, 114f6fe, 59b72de, acb34a5).
- Base for comparison: `3e192a7` (git worktree, removed after the run).
- Source of the rows: `git show origin/claude/wizardly-euler-glqplr:docs/qa/uat-2026-10-24-triage.md`.
- Runner: Playwright test runner only (no browser MCP), `playwright.lanec.config.mjs` (uncommitted), 3 projects: mobile 375x812, tablet 768x1024, desktop 1280x800. Chromium headless, 2 workers (3 for base runs).
- Two builds of HEAD: scope OFF (default `.env.e2e`, legacy shells, port 5310) and scope ON (`VITE_PROTOTYPE_SCOPE=on npx vite build --mode e2e`, v2 Pembelajaran/Pentadbiran layouts, port 5311).
  - Scope ON confirmed from the built bundle (`VITE_PROTOTYPE_SCOPE:\`on\`` in `dist-lanec-5311/assets/*.js`, `off` in `dist-lanec-5310`), and by the spec DOM: the failure snapshot of the S-55 tablet case shows `pembelajaran-bottom-nav`, i.e. the Pembelajaran layout rendered.
  - `.env.e2e` still sets `VITE_DATA_PROFILE=full` in both builds, so the data is the same; only the scope/layout differs.

## Verdict: READY for the lane C rows (updated after BUG-C1 fix `bb3215f`, see Addendum)

Original verdict before the BUG-C1 fix: NOT READY (strict G5 reading), lane C fixes themselves verified.

Every lane C fix passes its spec at all three viewports in the build it targets. Two High layout defects that are NOT caused by lane C (both reproduce identically at base `3e192a7`) block a clean "no open Critical/High" G5. One of them (BUG-C1) makes the S-55 "Cetak / PDF" button unclickable on a tablet in the demo (scope ON) build, so S-55 is recorded as Fail at tablet in scope ON.

## 1. Per UAT row

Counts are pass/fail per viewport (mobile / tablet / desktop). "Run 1" = scope OFF, "Run 2" = scope ON.

| UAT row | Fix | Spec | Run 1 (scope OFF) | Run 2 (scope ON) | Result |
|---|---|---|---|---|---|
| M-09 (T4) murid `/prestasi` to own Prestasi 360; S1-S3, S9 403 | acb34a5 | `e2e/m08-student-performance/uat-m09-prestasi-murid.spec.ts` | 10/0, 10/0, 10/0 | 10/0, 10/0, 10/0 | Pass |
| M-09 pelajar group of `t5-prestasi.spec.ts` (+ guest group) | acb34a5 | `e2e/m08-student-performance/t5-prestasi.spec.ts` ("T5 pelajar", "T5 guest") | pelajar 6/0 x3, guest 7/0 x3 | pelajar 6/0 x3, guest 7/0 x3 | Pass |
| S-15 (T5) no Negeri filter for Admin Sekolah | 54af0b9 | `e2e/m11-teacher-analytics/smoke-monitoring.spec.ts -g "no Negeri"` | 1/0, 1/0, 1/0 | 1/0, 1/0, 1/0 | Pass |
| S-52 (T7) heatmap legibility (3 cases: T4, T5, T5 Kimia) | 96a1c67, 114f6fe | `e2e/m27-school-admin/t7-heatmap-legibility.spec.ts` | 3/0, 3/0, 3/0 | 3/0, 3/0, 3/0 | Pass |
| G-06, S-06 (T8) Command Center same tab | 4d4d8c6 | `e2e/m10-teacher-class/uat-command-center-same-tab.spec.ts` | 2/0, 2/0, 2/0 | 2/0, 2/0, 2/0 | Pass |
| G-16, A-PM11 (T9) single Kirkpatrick tab strip (12 cases) | d049646 | `e2e/m12-kirkpatrick/uat-single-tab-strip.spec.ts` | 10/2, 12/0, 12/0 (see note 1) | 12/0, 12/0, 12/0 | Pass in scope ON (the meaningful config); scope OFF has 2 unrelated failures (BUG-C2) |
| G-47 (T10) Guru export | 59b72de | `e2e/m11-teacher-analytics/t10-guru-export.spec.ts` (7 cases) | 7/0, 7/0, 7/0 | 7/0, 7/0, 7/0 | Pass |
| S-56 (T10) CSV export Senarai Pelajar / Guru | 59b72de | `e2e/m27-school-admin/t10-export-print.spec.ts` (2 CSV cases) | 2/0 x3 | 2/0 x3 | Pass |
| S-55 (T10) Laporan Bulanan print (2 cases) | 59b72de | `e2e/m27-school-admin/t10-export-print.spec.ts` | 2/0 x3 | mobile 2/0, desktop 2/0, **tablet 1/1** → after BUG-C1 fix 2/0 x3 | Pass (was Fail at tablet in scope ON before BUG-C1 fix) |

Run totals: Run 1 = 324 tests (225 pass, 99 fail; all 99 fail in files outside the lane C rows, see section 3). Run 2 = 114 + 60 tests (166 pass, 8 fail: 1 BUG-C1, 7 in the t5 Admin Sekolah group which is not a lane C row, see section 3).

Note 1: the 2 failures are `learning: each level tab shows once` at mobile, for both guru and admin, failing `expectNoHorizontalScroll` with 27px overflow, after the "each tab shows once" counts had already passed. It is BUG-C2 (pre-existing, scope OFF legacy shell only).

### Red/green evidence (does the spec detect the original bug?)

The lane C specs were copied into the base worktree (`3e192a7`, spec files only, no source change) and run:

| Spec | Base 3e192a7 result | Reading |
|---|---|---|
| uat-m09 (desktop, scope OFF) | 5 fail (`/prestasi` landing + 4 school views not 403), 5 pass | Detects the bug, fixed at HEAD |
| t7-heatmap-legibility (desktop, scope OFF) | 3/3 fail | Detects the bug, fixed at HEAD |
| uat-command-center-same-tab (desktop, scope OFF and scope ON) | 2/2 fail in both builds | Detects the bug, fixed at HEAD |
| uat-single-tab-strip (desktop, scope ON) | 10 of 12 cases fail (all "each level tab shows once"; the two heading/toggle cases pass) | Detects the bug, fixed at HEAD. In scope OFF at base it passes (legacy shell has one strip), so only the scope ON run proves this fix |
| t10-export-print `prints the report only` (desktop) | fail | Detects the bug, fixed at HEAD |
| t10-export-print `Cetak / PDF calls window.print` and both CSV cases (desktop) | pass | Regression guards only, they do not fail without the fix |
| t10-guru-export, all 7 cases (desktop) | pass | Regression guards only: the spec does not reproduce the G-47 defect at base, so G-47 passing at HEAD proves "export still works", not "the original defect is gone". Recommend the owner confirm the original G-47 symptom is covered |

## 2. Regression (scope OFF build of HEAD, port 5310 reused)

Specs: `e2e/m10-teacher-class/smoke-command-center.spec.ts` (the only other m10 spec mentioning command-center), `uat-command-center-same-tab.spec.ts`, all of `e2e/m12-kirkpatrick/`, `e2e/m27-school-admin/qa-l51-l55.spec.ts`. HEAD: 402 tests, 181 pass, 193 fail, 28 skipped (1.2 h).

Base `3e192a7` was run for the same four failing files (smoke-command-center, smoke-kirkpatrick-levels, smoke-kirkpatrick-overview, qa-l51-l55) on mobile + desktop (240 tests: 96 pass, 130 fail, 14 skipped). Comparison by test title per project:

| Spec | HEAD fails (mobile / tablet / desktop) | Base fails (mobile / desktop) | In HEAD but not in base | Classification |
|---|---|---|---|---|
| m10 `smoke-command-center` | 15 / 15 / 15 | 15 / 15 | none | Pre-existing (spec expects "no shell" and `cc-*` test ids that the current page does not render the same way; fails identically at base). Not lane C |
| m12 `smoke-kirkpatrick-levels` | 31 / 31 / 32 | 31 / 32 (minus 1 base-only) | none | Pre-existing |
| m12 `smoke-kirkpatrick-overview` | 18 / 14 / 14 | same set | none | Pre-existing |
| m12 `uat-single-tab-strip` | 2 / 0 / 0 | 2 / 0 (same two cases, run with the spec copied into base) | none | Pre-existing BUG-C2 (not a regression of T9) |
| m27 `qa-l51-l55` | 2 / 2 / 2 | 2 / 2 | none | Pre-existing: S2 P1 and S2 P2 `1280 default: controls off-canvas or under 24 px` (`small 1px: Bahasa Arab...`, the language switch) |
| m10 `uat-command-center-same-tab` | 0 / 0 / 0 | n/a (new spec, fails at base as expected) | none | Pass |

Result: the mobile and desktop failure set at HEAD (129) is a strict subset of the base failure set (130). All tablet failures at HEAD are test titles that also fail at mobile and/or desktop (and at base). **No regression caused by lane C was found.**

One base-only failure: `smoke-kirkpatrick-levels` "school administrator 8 on S4-S8 (both prefixes) is redirected to its landing page" failed at base desktop and passes at HEAD. Not re-run at base; classified flaky/unknown, it is not a HEAD problem.

Failure classification used for the rest of run 1 (99 failures) and run 2B (7 failures), all outside the lane C rows:

| Group | HEAD scope OFF fails per viewport (mobile/tablet/desktop) | At base 3e192a7 (mobile + desktop) | Classification |
|---|---|---|---|
| `smoke-monitoring.spec.ts` (all cases except "no Negeri") | 27 / 21 / 21 | the same 48 mobile + desktop cases fail | Pre-existing. The page loads but test ids such as `mon-table-student`, `mon-table-row`, `mon-crumb-monitoring`, `mon-signals-empty` (strict-mode duplicate) no longer match the rendered page. Looks like spec/UI drift after the design-system migration, not data. Owner: M11 test code (QA) / frontend-developer |
| `t5-prestasi.spec.ts` "M08 T5 admin" group | 8 / 8 / 8 | the same 8 fail | Pre-existing: `stat-value` elements missing on S1/S3/S9/S10/S11 for the admin. Not touched by acb34a5 (which only changes the murid path); a data/UI drift to be triaged by the M08 owner (possibly lane A data) |
| `t5-prestasi.spec.ts` "T5 Admin Sekolah" group | 2 / 1 / 1 | S1 and S2 fail at base too | Pre-existing (same `stat-value` / `class-row-` drift). Under scope ON this group also fails on `shell-user-title` (a legacy-shell test id absent from the v2 layout): spec is scope-OFF only |

## 3. Bugs and open issues

### BUG-C1 (High, layout): fixed bottom nav covers the last content on a tablet in the v2 Pembelajaran layout — FIXED
- Build: scope ON only. Viewport: 768x1024 (any width from 640 to 1023px). Pre-existing: the same markup is at base.
- Steps: log in as `adminsekolah@demo.test` (password Demo1234), open `/admin-sekolah/laporan-bulanan`, scroll to the bottom of the page, try to tap "Cetak / PDF" (`data-testid=lb-print`).
- Expected: the button is reachable above the bottom tab bar.
- Actual: `<nav data-testid="pembelajaran-bottom-nav" ...>` intercepts pointer events; Playwright retried 517 times until the 300 s timeout. Reproduced twice (first under load, again alone), so it is not flaky. 375 and 1280 pass.
- Suspected cause: `src/shells/pembelajaran/PembelajaranLayout.vue` line ~457, `<div class="... px-4 py-4 pb-32 sm:py-6 lg:pb-12">`. At `sm` (640px) `sm:py-6` also sets the bottom padding to 1.5rem and overrides `pb-32`, while the nav (`fixed bottom-0 ... lg:hidden`) stays visible until 1024px. Fix idea: `sm:pt-6 sm:pb-32` (or `sm:pb-32 lg:pb-12`). This affects the last element of every page in that layout at 640-1023px, not only S-55.
- Spec: `e2e/m27-school-admin/t10-export-print.spec.ts:85` (tablet). Evidence: `test-results-lanec-5311/` trace was removed with the build output; reproduce with `VITE_PROTOTYPE_SCOPE=on npx vite build --mode e2e --outDir dist-lanec-5311` then `LANEC_SKIP_BUILD=1 LANEC_PORT=5311 LANEC_OUT=dist-lanec-5311 VITE_PROTOTYPE_SCOPE=on npx playwright test -c playwright.lanec.config.mjs e2e/m27-school-admin/t10-export-print.spec.ts --project=tablet`.
- Owner: frontend-developer (shells). Not caused by lane C but it defeats the T10 S-55 fix on a tablet in the demo build.

### BUG-C2 (High, layout): 27px horizontal page overflow at 375px on Kirkpatrick T2 "Pembelajaran"
- Build: scope OFF (legacy shells) only; scope ON mobile passes. Pre-existing (fails the same way at base). Viewport: mobile 375.
- Steps: log in as `guru@demo.test` or `admin@demo.test`, open `/guru/kirkpatrick/learning` or `/admin/kirkpatrick/learning` at 375px.
- Expected: no horizontal page scroll (CLAUDE.md section 7). Actual: document is 27px wider than the viewport (samples 27, 27, 27). The other four Kirkpatrick pages are clean.
- Spec: `e2e/m12-kirkpatrick/uat-single-tab-strip.spec.ts:36` ("learning: each level tab shows once", guru and admin). The tab-strip assertions in these two cases pass; only the overflow check fails.
- Owner: frontend-developer (M12). Because the default e2e build runs scope OFF, this spec stays red in the default suite until fixed.

### Other open items (not lane C)
- Stale M11 `smoke-monitoring` (48 failures at base and HEAD) and M08 `t5-prestasi` admin/Admin Sekolah specs, M12 `smoke-kirkpatrick-*`, M10 `smoke-command-center`: red at base `3e192a7` and at HEAD with identical sets. They need triage by their module owners (spec drift versus real UI regression is not established here; I did not inspect each).
- `qa-l51-l55` S2 P1/P2: a 1px control at 1280 (`Bahasa Arab` / `Bahasa Ingg...` language switch), pre-existing, Medium.
- The G-47 spec passes at base, so it cannot prove the original defect is fixed (see red/green table).
- The first scope ON attempt (whole `t5-prestasi` and `smoke-monitoring` files) was aborted by me after the first minute because those admin specs are scope-OFF only; the scope ON run was redone with only the lane C specs plus `-g "T5 pelajar|T5 guest|T5 Admin Sekolah|no Negeri"`.
- Run 1 ran the whole `smoke-monitoring.spec.ts` (superset of the requested `-g "no Negeri"`) to get the base comparison; the lane C case passes in all three viewports.

## 4. Unit and integration tests (HEAD baf0cb9)

| Command | Result |
|---|---|
| `npx vitest run --project unit src/mock/server/__tests__/registry-boot.test.ts` | 1 file, 3 tests, all pass |
| `npx vitest run --project unit src/modules/m08-student-performance src/modules/m11-teacher-analytics src/modules/m12-kirkpatrick src/modules/m27-school-admin src/shells src/ds src/lib` | 116 files pass; 1760 tests pass, 3 expected fail, 2 skipped, 1 todo (0 failures) |

(The jsdom message "HTMLCanvasElement's getContext() not implemented" is console noise from existing tests.)

## 5. Housekeeping

- Nothing committed; no source, `datasets/`, `seeds/` or mock spec changed. The base worktree was removed (`git worktree list` shows only the main tree). My `dist-lanec-5310/5311` and `test-results-lanec-531x` outputs were deleted; `playwright.lanec.config.mjs` is left in place (uncommitted). Logs are in the scratchpad `.../scratchpad/qa/` (`run1-off.log`, `run2-on-a.log`, `run2-on-b.log`, `run3-reg.log`, `run3-base.log`, `run-base.log`, `redgreen-base*.log`, `rerun-s55.log`, `unit-*.log`).
- Only processes I started were used; none remain running.

## Addendum (2026-10-24): BUG-C1 fixed and re-tested

- Fix: `src/shells/pembelajaran/PembelajaranLayout.vue` `<main>` padding `py-4 pb-32 sm:py-6 lg:pb-12` → `pt-4 pb-32 sm:pt-6 lg:pb-12` (the tab bar is `lg:hidden`, so content now clears it at 640-1023px). Regression spec `e2e/global/pembelajaran-bottom-clearance.spec.ts` (640/768/1023/1024px; fails on the old padding).
- Re-run on a fresh scope ON build (port 5320), all three projects 375/768/1280: `pembelajaran-bottom-clearance`, `t10-export-print`, `uat-single-tab-strip`, `t7-heatmap-legibility`, `uat-command-center-same-tab` → **75 passed, 0 failed**.
- S-55 is now Pass at all three viewports in both scope modes. BUG-C2 stays open (pre-existing, scope OFF legacy shell only, not the UAT configuration); it does not affect a lane C row in the demo build.
