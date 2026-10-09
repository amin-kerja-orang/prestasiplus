# QA report: M07 Premium PKSK, G5

Scope: roles-matrix row **L24** (student PKSK: S1 hub, S2 dashboard, S3 domains, S4 history, S4a practice, S4b exam, the level gate) and the **admin PKSK screens** (S5 `/admin/pksk/questions`, S6 create, S7 edit, S8 `/admin/pksk/access`). Sources: URS and SRS `M07-pksk.md` v1.7, accounts in `docs/AKAUN-DEMO.md`. Branch `feature/student-prototype` (tip 45a2a98 plus the uncommitted work of other sessions).

Build: `npx vite build --mode e2e`, served by my own `vite preview` on port 5107 (stopped at the end, PID only). Chromium; projects mobile 375x812, tablet 768x1024, desktop 1280x800; `--workers=1`, 2 retries, `E2E_BOOT_MS=E2E_BOOT_TIMEOUT_MS=150000`, test timeout 360-400 s.

**Method notes.** Playwright MCP lane 1 was in use by another session, so exploration was scripted (computed-style audits, state probes through the specs), not interactive; there are no defect screenshots (failure evidence is Playwright `error-context.md` in the scratch folder, paths below). The machine ran at ~100% CPU with ~100 node processes from other sessions, so cold boots took 25-60 s. The default `expect` timeout of 5 s produced a wave of false failures in the existing specs (page rendered a moment after the assertion gave up); with `expect.timeout = 30 s` in my scratch config the same tests pass. That is a load flake, not an app defect (see Flakes). The browser cannot call the in-process mock directly (`fetch('/api/...')` hits the static server and gets 404), so API-level assertions (403 on admin endpoints, no `isCorrect` in payloads, SEC-M07-12) are covered by the vitest mock tests, not by E2E.

## Verdicts

| Scope | Verdict | Reason |
|---|---|---|
| **Student (L24)** | **Ready** | Every in-scope AC executed and Pass at 375 / 768 / 1280; no Critical/High bug; no student-side bug at all. |
| **Admin (S5-S8)** | **Ready** (one Medium bug open, fix recommended) | Every in-scope AC executed and Pass; no Critical/High. BUG-M07-01 (Medium): S5 selection checkboxes are 16x16 px below lg. It does not contradict a literal AC (AC-24.x state no 44 px figure) but breaks the 44 px rule of SRS section 10 / NFR-RESP-03. |

## Runs

Tests per width: **119** = 57 developer specs (`admin-s5-s8` 37, `student-s1-s4b` 20) + 62 QA specs (`qa-g5-flows` 16, `qa-g5-guards-responsive` 46).

| Width | Pass | Fail (final) | Notes |
|---|---|---|---|
| mobile 375 | **115** | **4** (BUG-M07-01: S5 sweep x4) | all 4 failures are the same touch-target defect |
| tablet 768 | **115** | **4** (BUG-M07-01: S5 sweep x4) | same |
| desktop 1280 | **119** | 0 | touch targets not applicable at lg |

How the final numbers were reached (state at the end, per test, after targeted re-runs of each failure):

| Run | Result |
|---|---|
| Full run 1, default 5 s expect | invalid: 20+ false failures from the 5 s expect timeout under load; stopped. |
| Full run 2, 30 s expect, all 3 widths in parallel (1 worker each) | developer admin spec 37/37 pass at all widths; QA flow tests pass except those listed under "test defects fixed"; run stopped when it was clear that several of my own tests were too long. |
| Run 3 (guards sweep, student spec, 4 changed flow tests) | student spec 20/20 at all widths; flow tests 4/4 at all widths; sweep: all pass except the S5 touch targets at 375/768. |
| Run 4 (guards: 5 role tests, 7 account-gate tests, S1 level-card contrast) | 13/13 at all widths. |
| `npx vitest run --project unit --maxWorkers=2 src/modules/m07-pksk` | 6 files, **170 tests pass**, 0 fail (631 s). |
| `npx tsc -p tsconfig.e2e.json --noEmit` | exit 0 (after the last spec edit). |

Test defects of mine found and fixed during the run (not app bugs): regexes lost their escapes through a heredoc (syntax error); raw `fetch('/api')` does not reach the in-process mock (rewritten to UI plus `mock.requests`); two tests were too long for the 400 s budget on a loaded machine (split); `stats()` read before the table rendered (AC-23.3); moving the clock a day ahead expired the mock session (step removed); the contrast probe flagged the solid-green "AKTIF" badge (probe narrowed). The developer specs were not changed.

## QA specs written (`e2e/m07-pksk/`)

- `qa-g5-guards-responsive.spec.ts` (46 tests/width): guest redirected from all 15 M07 routes; five non-admin accounts never see an admin PKSK screen; a redirected student sends no admin API request; level access for 7 accounts (pelajar, pelajarmaju, admin, ibubapa open both levels; pelajar2, guru, tidakaktif open none); a no-access student gets 403 from 8 level API endpoints and is redirected with no message; unknown level 404 wins over the gate; 13 malformed student URLs and 11 malformed/unlinked admin URLs are the global 404 (incl. an M04 id, `0`, `abc`, `-1`, `1.5`); non-PKSK id not editable and M04 question untouched; text contrast on gradient heroes (S1 banner, S2 T1/T4 hero, S1 level cards); responsive sweep of 22 route states (no horizontal scroll, no text < 12 px in `main`, touch targets >= 44 px below lg, with bulk bar open, grant form open, 6 options, empty states, last page); shell navigation (user drawer / sidebar, admin sidebar / "Lagi" sheet).
- `qa-g5-flows.spec.ts` (16 tests/width): student flow hub -> dashboard (55% C 2 59.7%) -> domains -> practice (10 items, submit 201, mastery changes, another domain untouched) -> exam (30/70/1) -> history (3 rows newest first, T4 empty); exam submitted empty = one attempt, 0% E; 500 on the dashboard shows the retry card and recovers; admin lifecycle create A -> edit (prefill) -> bulk approve / reject / restore -> row delete (cancel keeps, accept removes, stats move) -> edit URL 404; cross-role grant T4 -> student hub shows only T4 "AKTIF" -> new question counted 81 -> deleted 80 -> revoke -> student loses access; M04 totals/search unaffected and M04 detail shows the PKSK question; reject lowers the student count (26) but "Ting. 1" stays 383; whitespace-only text is not saved, HTML-looking text is rendered as text and nothing executes, 400 unbroken characters are cut to 80 + "..." without page scroll, a 500 keeps the input; odd query values; list network failure; expiry (yesterday = "Tamat Tempoh", today = "Aktif", Kombo/T4 counts 5/4/4); M02 "Pakej PKSK" switch opens both levels; stale revoke (second tab) answered 409 and the list reloads with the row "Ditarik" and cards 2/2/2; grant with 999999 / 0 / -5 / a failing server; access search by case, e-mail and padding.

## AC-by-AC

Dev = developer specs (`admin-s5-s8`, `student-s1-s4b`), QA = my specs. Every result was executed at all three widths unless stated.

| AC | Test cases | Result |
|---|---|---|
| 01.1-01.4 | Dev E2E-01; QA contrast of hub banner | Pass |
| 02.1-02.3 | Dev E2E-01/02/40; QA level access x7, cross-role grant | Pass (02.3 INFERRED L-1) |
| 03.1-03.4 | Dev E2E-03/04; QA student flow, T4 empty after exam | Pass |
| 04.1-04.4 | Dev E2E-05/44 | Pass |
| 05.1-05.4 | Dev E2E-06; QA counts 27 / 26 / 81 / 80 | Pass |
| 06.1-06.3 | Dev E2E-07; QA history order after a new exam | Pass |
| 07.1, 07.2 | Dev E2E-08; QA practice (10 items) and exam (30/70/1) | Pass (provisional pages, L-2/L-3) |
| 07.3 | Dev E2E-09; QA 13 malformed URLs | Pass |
| 07.4 | Dev E2E-45 (reduced: request 201, answers sent, mastery format); QA flow | Pass (reduced): the flagged options are not served, so "all correct = 100%" and the M05 session / QuizAnswer / M14 ledger rows are not asserted in E2E; they are covered by the mock tests (vitest) |
| 08.1 | Dev E2E-10; QA 8 level endpoints 403 + redirect, 7 accounts | Pass |
| 08.2 | Dev E2E-11a; QA cross-role grant (T4 only) | Pass |
| 08.3 | Dev E2E-09; QA | Pass |
| 09.1-09.5 | Dev E2E-12..15 | Pass |
| 10.1-10.4 | Dev E2E-16..18; QA odd queries | Pass |
| 11.1-11.5 | Dev E2E-19..22; QA bulk approve/reject/restore | Pass |
| 12.1, 12.2 | Dev E2E-23; QA row delete in lifecycle | Pass |
| 13.1-13.4 | Dev E2E-24/25 | Pass |
| 14.1-14.4 | Dev E2E-26/27 | Pass |
| 15.1, 15.2, 15.4 | Dev E2E-28/30; QA whitespace, XSS text | Pass |
| 15.3 | Dev E2E-29; QA lifecycle (#9000001) | Pass (INFERRED L-5) |
| 16.1-16.4, 16.6, 16.7 | Dev E2E-31/32/30/09a; QA 11 admin 404s | Pass |
| 16.5 | Dev E2E-33; QA lifecycle edit to pending | Pass (INFERRED L-5) |
| 17.1-17.3 | Dev E2E-34/35; QA search | Pass |
| 18.1-18.3 | Dev E2E-36 | Pass |
| 18.4 | Dev E2E-11a; QA cross-role | Pass (INFERRED L-7) |
| 18.5 | Dev E2E-37; QA 999999 / 0 / -5 / 500 | Pass (copy UNVERIFIED) |
| 19.1, 19.2 | Dev E2E-38/38b; QA revoke and stale revoke 409 | Pass |
| 19.3 | Dev E2E-39 (edge fixture); QA expiry | Pass (labels UNVERIFIED) |
| 20.1, 20.4 | QA level access x7 | Pass |
| 20.2 | QA expired yesterday | Pass (flaky once, see Flakes) |
| 20.3 | QA M02 switch | Pass |
| 20.5 | Dev E2E-34; QA 4/3/4, 5/4/4 | Pass |
| 21.1-21.3 | Dev E2E-41/12; QA shell navigation | Pass |
| 22.1 | Dev E2E-42; QA 15 routes | Pass |
| 22.2 | Dev E2E-42; QA 5 roles redirected, no admin request sent | Pass (redirect). The "admin endpoints answer 403" half is covered by vitest only, not E2E (browser cannot call the mock) |
| 23.1, 23.2 | QA M04 totals, search, detail | Pass (M04 count tiles other than "Jumlah" not asserted) |
| 23.3 | QA reject lowers student count, "Ting. 1" stays 383 | Pass |
| 24.1, 24.3, 24.4, 24.5 | Dev E2E-44 family; QA sweep of 22 route states | Pass at all widths (no horizontal scroll, no text < 12 px) |
| 24.2 | Dev E2E-44c/44d (in-card scroll) | Pass |

Not executed in E2E (stated, not marked Pass): time roll-over of an expiring grant (midnight) because moving the clock expires the mock session; response-body checks (`isCorrect`, SEC-M07-07/12) which need the mock directly (vitest only).

## Bugs

| ID | Severity | Where | Steps | Expected | Actual | Evidence | Owner |
|---|---|---|---|---|---|---|---|
| BUG-M07-01 | **Medium** | S5 `/admin/pksk/questions` (also `?page=39`, `?status=pending` empty), 375 and 768 | Log in as admin, open S5, measure the "select all" checkbox in the header and the 20 row checkboxes | Touch targets >= 44 px below lg (SRS section 10: icon actions keep their visual size but reach 44 px through hit area; NFR-RESP-03) | Header and row checkboxes are bare `h-4 w-4` inputs (16x16) inside a padded `<td>` that is not clickable; the bulk-select feature is hard to use on touch. Edit/delete icons, bulk buttons, filters, S6-S8 controls all pass. Hub/dashboard radios pass (label 44 px) | scratchpad `m07-g5/tr2g-mobile/*78b0c*`, `*a5f07*`, `tr2g-tablet/*2203f*`, `*293f3*` (`error-context.md`); test `qa-g5-guards-responsive.spec.ts` "S5 list ... touch targets" | frontend-developer. Suggested fix: wrap the checkbox in a `label` with `min-h-11 min-w-11` or enlarge the cell hit area below lg (M04 S1 uses 20x20, same family) |

Observation, not a bug (replicated from live, D10): white 12 px bold "AKTIF" on green-500 has a contrast of about 2.3:1 (SRS FR-M07-05 fixes these colours).

No student-side bug. No Critical or High bug.

## Flakes

- 5 s default `expect` timeout under 100% CPU: about 25 developer and QA tests failed 1-3 times at the first assertion after navigation in run 1 (page snapshot in the failure showed the element rendered a moment later). All pass with `expect.timeout = 30 s`. Recommend the project config keeps a larger `expect` timeout (or per-test `E2E_*` budget) for loaded machines.
- Desktop, "AC-18..20 expiry boundary ...": first attempt timed out at 400 s waiting for `grant-toggle` (likely a user switch with `mock.setUser` + reload landing on the wrong page under load); passed on retry (2.2 min). Cause not isolated; not an M07 defect as far as seen.
- Mobile, AC-23.3: failed first run because of my own test (stats read before render); fixed.
- Cold boot 25-60 s per `gotoApp`; multi-reload tests were split to stay within 400 s.

## Housekeeping

Scratch folder: `C:\Users\hp\AppData\Local\Temp\claude\d--Dev-Projects-pretasiplus-app\6b12bffb-2834-479a-8490-417467c285d2\scratchpad\m07-g5\` (config `pw.config.ts`, logs `pass1-*`, `p2*-*`, `p3-*`, `vitest.log`, `sum.mjs`). Preview server on 5107 stopped. No `node_modules` junction created, no repo file changed except the two new specs and this report.
