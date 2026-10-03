# L07 Dashboard Murid (M05 S1, `/dashboard`) - G5 QA

**Status: IN PROGRESS - paused 2026-10-03** (PC shutdown requested by the Delivery Lead). No verdict yet. Slug: L07-dashboard-murid (task M05-T3, roles-matrix row L07 Murid part). Inputs: SRS M05 v1.20 S1 (FR-M05-01..28, 131, DV-M05-17/18, sections 9 and 10), URS AC-M05-01.1 to 10.4.

## Environment and cleanup
Own config copy `playwright.5025.config.ts`, build `dist-e2e-5025`, preview on 5025 (PID 16368). All deleted/stopped (the preview had already exited mid-run: later tests failed with ERR_CONNECTION_REFUSED, which is not an app result). 4173/5173/live never touched. Regression spec kept: `e2e/m05-practice/qa-l07-dashboard.spec.ts` (untracked, about 75 tests x 3 projects). To resume: copy `playwright.5023.config.ts` to a 5025 config (replace 5023 by 5025), `E2E_BOOT_TIMEOUT_MS=90000 npx playwright test -c playwright.5025.config.ts e2e/m05-practice/qa-l07-dashboard.spec.ts --workers=3` (run in the background, it takes more than 10 minutes per project).

## Executed so far
| Run | Result |
|---|---|
| Existing `smoke-dashboard.spec.ts`, 3 projects, workers=2 | 36/36 pass |
| Hit-area probe (elementFromPoint), admin at 375/768/1280 | 64/64/70 links+buttons, none under 44 px high (trial link 36 visible -> 44; toggle 20 -> 44; arrows 32 -> 44; dots 10 -> 44 high but only 18 px wide; Lihat Semua 24 -> 44; subject start 40 -> 44). No text under 12 px on S1 at any of the 3 widths. |
| `qa-l07-dashboard.spec.ts`, desktop project only, first run (cut by my 590 s timeout) | about 55 pass on desktop. Pass: AC-01.x, 02.x, 03.1-03.4, 04.x, 05.1, 05.3, 06.3/06.4, 07.1-07.5, 08.1, 08.2, 09.1, 09.2, 09.4/09.5, 10.1-10.3, responsive (4 accounts), text size, DV-M05-17 hit areas, role access (all 9 roles land on `/dashboard`), guest to `/login`, loading state. |
| Re-run of failures (desktop) | 14 failed, of which 8 are the dead server. Real failures analysed below. |

Tablet and mobile projects of the new spec: NOT yet run. Error-state, console-error, link-resolution and M09 banner tests: NOT yet run to a valid result (server died).

## Failures seen, all judged test-spec problems (to fix in the spec, not app bugs, still to confirm)
- AC-03.5: counter was "5 / 5" not "1 / 5" after advancing 4900 ms, because the preceding `mock.advanceTime` ticks after load; the test must read the counter after load and compare relatively.
- AC-05.2: stat values were already 267 at first read, meaning the count-up had finished before my assertion (the frozen-clock assumption is wrong on desktop); use `mock.advanceTime` ordering as in smoke, or sample earlier. FR-11 test same cause (t1 already 130152).
- AC-06.1: text is "Progres0/10" with no spaces (DOM text, separate spans); assertion should use `dash-quest-done` and regexp `0\s*/\s*10`.
- AC-09.3: group heading text has no space after emoji in DOM text ("🏫Sekolah Rendah (KSSR)"); assertion needs to drop the space.
- AC-10.4: `dash-stat-bank` text is "15414 soalan " (trailing space); trim before regexp.
- Not diagnosed yet: "DV-M05-17 dots" mouse-click test (clicks 15 px above/below a dot) - failure reason not read; must be checked, it may be a real hit-area defect or a test geometry error.

## AC table (provisional; nothing marked Pass that was not executed)
| AC | Desktop | Mobile / tablet |
|---|---|---|
| 01.1, 01.2, 01.3 | Pass | not run (smoke passes 3 projects for 01.1-01.3) |
| 02.1-02.3 | Pass | smoke passes 3 projects |
| 03.1-03.4 | Pass | smoke passes carousel 3 projects (03.5 smoke Pass) |
| 03.5 | smoke Pass; my stricter test needs a spec fix | - |
| 04.1-04.3 | Pass | smoke Pass |
| 05.1, 05.3 | Pass | smoke Pass |
| 05.2 | Pending (spec fix) | - |
| 06.1/06.2 | Pending (spec fix; content seen correct in failure output) | smoke partly |
| 06.3/06.4 | Pass | smoke Pass |
| 07.1-07.5 | Pass | smoke partly |
| 08.1, 08.2 | Pass | smoke Pass |
| 09.1, 09.2, 09.4, 09.5 | Pass | smoke Pass (09.1, 09.2) |
| 09.3 | Pending (spec fix; content seen correct) | smoke Pass |
| 10.1-10.3 | Pass | smoke Pass |
| 10.4 | Pending (spec fix) | smoke Pass |

Remaining: fix the 5 spec issues, diagnose the dots click test, run the whole spec on mobile, tablet, desktop (plus 320 px), run link-resolution, error/network states, console errors and the M09 banner mapping test, then finalise bugs, known dependencies and verdict.

## Bugs
None confirmed so far. One open question: dots hit area is 18 px wide (SRS DV-M05-17 requires height only, so not a bug against the SRS).

## Verdict
Pending. Do not use this file as a G5 result.
