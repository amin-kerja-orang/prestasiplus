# M15 Rewards Shop - G5 QA, Session 5 student rows (L36 Kedai Hadiah, L40 Kotak Misteri, L27 Cabutan Bertuah, L43 Kedai Hadiah Digital)

Date: 2026-10-03. Branch: feature/student-prototype. Slug: m15-rewards-shop.
Scope: roles-matrix rows L36 (S5 `/gamification/rewards`), L40 (S6 `/gamification/mystery-box`), L27 (S7 `/cabutan`), L43 (S10 `/cikgu/hadiah`, S11 `/cikgu/hadiah/saya`) for Murid (pelajar@demo.test, id 2; pelajar2 not needed) and the admin view where the SRS says any logged-in user. Admin screens S1-S4, S8 and S9 are out of scope. Known decisions (not bugs): S5/S10/S11 empty for every account (OQ-M15-01, L43 lead decision), PROPOSED copy in SRS 8.2, DV-M15-16..20.

## Verdict: READY (no open Critical/High/Medium bug)

Every in-scope AC that could be executed passed. Two Low observations and one environment note are listed below; none blocks release of the Session 5 rows.

## Test runs (real tree, `vite build --mode e2e --outDir dist-e2e-s5-qa15`, preview on port 4751)

| Run | Result |
|---|---|
| E2E `e2e/m15-rewards-shop` (`student.spec.ts` 14 tests, `digital.spec.ts` 12, new `qa-student.spec.ts` 6 = 32 tests per project) on mobile / tablet / desktop | **96 / 96 passed** (42.8 min, `--workers=1`, `--retries=1`, no retry was needed, `--timeout=240000`, `E2E_BOOT_TIMEOUT_MS=90000`). |
| Unit `npx vitest run --project unit --pool=threads src/modules/m15-rewards-shop` | 4 files, **77 / 77 passed**. |
| `npx vue-tsc -b --noEmit` | 1 error, **none in M15**: `src/modules/m10-teacher-class/__tests__/dashboard/GuruDashboardPage.test.ts(172,55) TS2339 'exists'` (M10, out of scope, reported to the lead). |
| eslint `e2e/m15-rewards-shop/qa-student.spec.ts` | clean. |

Note on counts: 96 = 32 tests x 3 projects (student.spec 14 + digital.spec 12 + qa-student 6; the 14 and 12 include the `@provisional` tests, which were all run).

Environment note (honest account of earlier runs): the machine was saturated by other sessions (CPU 97-100 percent, dozens of vitest workers). Runs 1-4 (workers=2 and workers=1, default 15 s app-boot budget) produced only boot timeouts (`page.waitForFunction ... Timeout 15000ms exceeded` in `waitForMock`, and 30 s test timeouts), 29 / 78 failed in run 1; none of those failures was an assertion failure. They were discarded as invalid and the suite was re-run in full with the existing `E2E_BOOT_TIMEOUT_MS` override (already present in `e2e/fixtures/mock-handle.ts`, I did not touch it) set to 90 s, which gave the 96 / 96 above. Workers were 1 for the final run because of the load.

## Exploratory (Playwright MCP lane 3, local build, role Murid; screenshots in `.playwright-mcp/lane3/`)

- S5 at 375: hero "Kedai Hadiah" (white), tile "0" "Baki Token", empty state; no h-scroll. (`m15-s5-375.png`)
- S6: with 0 tokens all four boxes disabled "Token Tidak Cukup" (colour rgb(75,85,99) on rgb(209,213,219), about 5:1, readable, DV-M15-20 Pass); `setWallet(2,{tokens:5})` enables boxes 1-2, 3-4 stay locked; opening Kotak Gangsa shows the full-screen modal at 375 (360 x 812 with scrollbar) with "+1 syiling, +7 XP" and "Tutup"; chip 5 to 3; wallet 372 to 373 syiling, tokens 5 to 3, XP +7; ledger row "Kotak Misteri: Kotak Gangsa"; Escape closes the modal; after reload the "Sejarah Kotak Misteri" card lists the opening. (`m15-s6-375-5tok.png`, `m15-s6-375-modal.png`, `m15-s6-375-locked.png`)
- S7: no open draw shows the empty line; `createDraw` (limit 3, 50 syiling) shows the card; three purchases take the balance 373 to 223 with ledger rows "Tiket Cabutan: Cabutan Demo" -50, "Tiket anda: 3/3" and the button disables; balance 40 disables the button. (`m15-s7-375-limit.png`)
- S10 at 320/375/768/1280: no horizontal scroll (scrollWidth = clientWidth), min text 12 px, chips wrap onto 5 / 4 / 2 / 2 rows, caption "50 syiling = 1 token" (bronze rate), "Tebusan Saya" button to `/cikgu/hadiah/saya`; `?cat=gaming` and `?cat=flagship` mark one chip active, `?cat=bogus` returns the page with no active chip, all show "Tiada hadiah dalam kategori ini."; h1 is dark slate on the light page (not a hero gradient, so readable). (`m15-s10-375.png`, `m15-s10-1280.png`, other widths saved)
- S11 at 4 widths: content, "Layari Kedai Hadiah" back to S10; no h-scroll; min text 14 px.
- Sweep of S5, S6, S7, S11 at 320/375/768/1280: scroll overflow 0 on all 16; on S6 only the rotated ribbons extend 1 px past the viewport and are clipped by their card (not a page scroll); min text 12 px.
- Nav: desktop sidebar entry "Kedai Hadiah DIGITAL" and the mobile drawer entry both link `/cikgu/hadiah` and open S10 (not the 404); plain "Kedai Hadiah" stays `/gamification/rewards`.
- 404s: `/kedai-hadiah`, `/hadiah`, `/kedai`, `/cikgu/hadiah/1` render "404 - Halaman Tidak Dijumpai | PRESTASIPLUS".
- Guest: `/gamification/rewards`, `/gamification/mystery-box`, `/cabutan`, `/cikgu/hadiah?cat=gaming`, `/cikgu/hadiah/saya` all redirect to `/login` (after the app boot; waited 15 s).
- Test hooks `setWallet`, `getWallet`, `ledger`, `createDraw`, `m15LoadFixture('draw')` (returns `{loaded:'draw'}`), `m15MysteryNext` (exercised by the E2E) all work.
- Console: no errors on the M15 pages other than the known `/favicon.ico` 404 (BUG-M01-05, platform).

## Test plan: AC to result

Abbreviations: ST = `student.spec.ts` (test number = SRS 12 scenario), DG = `digital.spec.ts`, QA = new `qa-student.spec.ts`, M = manual browser check above. All E2E rows ran on mobile / tablet / desktop (96 / 96 passed).

| AC | Test cases | Result |
|---|---|---|
| 01.1 / 01.2 menu entries (Cabutan Bertuah, Kedai Hadiah, Kotak Misteri) | M (sidebar and drawer links and hrefs); QA AC-24.5 | Pass (icon colours and badge classes not re-measured; covered by developer unit tests) |
| 01.5 active menu item on S5/S6/S7 | not separately executed | Not executed (no assertion; screenshots show the shell only) |
| 01.6 / 01.7 header and tab titles S5-S7 | ST #41, #43, #47, #07 (student) | Pass |
| 02.1 guest to `/login` (S5, S6, S7) | ST #05; M | Pass |
| 02.3 student opens S5, S6, S7 in the user shell (S8 part out of scope) | ST #07; M | Pass |
| 02.4 404 sub-paths of S5-S7 | ST #08; M | Pass |
| 14.1 S5 hero, tile "0", empty state, h1 14 px / 24 px, white h1 | ST #41; M | Pass |
| 14.2 `?category=gaming` identical to S5 | ST #41 | Pass |
| 14.3 tile follows token balance (50) | ST #42 | Pass |
| 14.4 active reward does not populate S5 | ST #42 | Pass |
| 15.1 S6 hero, subtitle, "Token Anda" chip | ST #43; M | Pass |
| 15.2 four cards, costs, ranges, ribbons RARE/EPIC/LEGENDARY upper case by CSS | ST #43; M | Pass |
| 15.3 0 tokens: four disabled "Token Tidak Cukup", nothing sent | ST #43 (also checks no request); M | Pass |
| 16.1 5 tokens: boxes 1-2 open, 3-4 locked; 25 tokens all open, touch target | ST #44; M | Pass |
| 16.2 open Kotak Gangsa: modal, chip 5 to 3, "Tutup" | ST #45; M | Pass |
| 16.3 history card "Sejarah Kotak Misteri" after an opening, absent before | ST #46; M | Pass |
| 16.4 wallet 268 / 3 / 12, ledger row, S7 tile 268 | ST #45 | Pass |
| 17.1 S7 empty state, tile, "Cabutan Dibuka" | ST #47; M | Pass |
| 18.1 draw card content | ST #48; M | Pass |
| 18.2 buy a ticket, tile 206, "Tiket anda: 1/10", ledger | ST #49; QA AC-18.3 (limit 2); M | Pass |
| 18.3 button disabled at 40 syiling, at the ticket limit, closed draw not listed | ST #49; QA AC-18.3 (x2); M | Pass |
| 21.1 no h-scroll S5-S7 at 375/768/1280 (320 manual) | ST #54, #41, #43, #47; M | Pass |
| 21.3 S6 one / three / four boxes per row (375 / 768 / 1280) | ST #54 | Pass |
| 21.4 text >= 12 px on S5, S6, S7 | ST #54, #47; M (script at 320-1280) | Pass |
| 22.1 S10 title, header, h1, subtitle | DG #59; M | Pass |
| 22.2 balance card values, labels, caption "50 syiling = 1 token" (DV-M15-16), "Tebusan Saya" link | DG #59; M | Pass |
| 22.3 ten chips in order, hrefs, only "Semua" active | DG #61; M | Pass |
| 22.4 empty copy, no card or "Tebus" | DG #61; M | Pass |
| 22.5 each chip: URL, same page, one active chip | DG #62; M (gaming, flagship) | Pass |
| 22.6 `?cat=bogus` page shown, no active chip | DG #63; M | Pass |
| 22.7 student with 20 tokens / 300 syiling shows 20 and 300 | DG #60 (provisional) | Pass |
| 22.8 active reward / any account still empty | DG #64 (provisional) | Pass |
| 23.1 S11 title, header, back button, decorative gift, text, link | DG #65; M | Pass |
| 23.2 both links open S10 default | DG #66; M | Pass |
| 23.3 fixture `queue` leaves S11 empty | DG #64 (provisional) | Pass |
| 24.1 guest to `/login` for S10 and S11 | DG #67; M | Pass |
| 24.2 student, parent, teacher render S10 and S11 | DG #67 (provisional); M (student) | Pass (murid view Perlu pengesahan against live, as the SRS says) |
| 24.3 `/kedai-hadiah`, `/hadiah`, `/kedai`, `/cikgu/hadiah/1` give the 404 | DG #68; M | Pass |
| 24.4 sidebar and drawer "Kedai Hadiah DIGITAL" opens S10 | QA AC-24.4 (3 projects: sidebar on desktop, drawer on mobile/tablet); M | Pass |
| 24.5 plain "Kedai Hadiah" entry opens S5 with its own copy | QA AC-24.5; M | Pass |
| 25.1 S10/S11 layout at 375 / 768 / 1280, no h-scroll, card and chip rows | DG #70; M (320 too) | Pass |
| 25.2 text >= 12 px on S10/S11 (caption, labels, DV-M15-19) | DG #70; M | Pass |
| 25.3 failed wallet/items read shows the shared error state | DG #71 | Pass |
| DV-M15-20 disabled box text readable (>= 4.5:1) | QA DV-M15-20 (4 boxes); M | Pass |
| Hero heading readability (global h1 colour pitfall) S5, S6, S7, S10, S11 | ST #41; QA hero headings; M | Pass |

Counts: in-scope ACs/checks listed 42; Pass 41; Not executed 1 (01.5 active menu item, not asserted for the student rows; low risk); Fail 0; Blocked 0.

## Bugs

No Critical, High or Medium bug found. Low items:

| ID | Severity | Description | Owner |
|---|---|---|---|
| BUG-M15-S5-01 | Low | After opening a mystery box or buying a ticket, the shell header "koin / mata" chips keep the old value until the page is reloaded (observed: chip 373 koin while the S7 tile read 223 after three tickets; after reload the chip matched). The page tile and wallet are correct. Steps: pelajar@demo.test, `/cabutan` with an open draw, buy a ticket, compare header chip with the "SYILING ANDA" tile. Expected both equal. Screenshot `.playwright-mcp/lane3/m15-s7-375-limit.png` (header 373 vs tile 223). | user shell chips / M14 (not M15) |
| OBS-M15-S5-02 | Low (observation, not a defect against the SRS) | The disabled "Beli Tiket" button is the gradient button at 50 percent opacity with white text, about 2.5:1 contrast (see `m15-s7-375-limit.png`). WCAG exempts disabled controls and AC-18.3 only requires "disabled"; DV-M15-20 (readable disabled text) is scoped to the box buttons. Raise only if the lead wants DV-M15-20 extended to the ticket button. | frontend-developer (M15-T2) |
| ENV-M15-03 | Info | Machine saturation by parallel agent sessions makes the default 15 s app-boot budget unreliable; use `E2E_BOOT_TIMEOUT_MS` (already supported) and `--workers=1` when the load is high. Not a product defect. | devops / lead |

Out of scope, reported: vue-tsc error in M10 `GuruDashboardPage.test.ts(172,55)`.

## Tests added by QA

`e2e/m15-rewards-shop/qa-student.spec.ts` (6 tests x 3 projects, all green): AC-24.4 nav entry to S10 (sidebar on desktop, drawer below), AC-24.5 plain "Kedai Hadiah" entry, AC-18.3 ticket limit (2 tickets, balance 1000 to 900, two ledger rows, button disabled), AC-18.3 balance below price, DV-M15-20 contrast >= 4.5:1 for all four disabled boxes, hero heading colours (S6, S7 white; S10, S11 contrast >= 4.5:1 on the light page). No media files were created.

## Cleanup

Temp config `playwright.s5qa15.config.ts`, `dist-e2e-s5-qa15`, `test-results-s5-qa15` removed; the preview server on port 4751 (PID 17516 and its npx parent 26048) stopped by PID; no other node process was touched. Lane 3 browser closed.
