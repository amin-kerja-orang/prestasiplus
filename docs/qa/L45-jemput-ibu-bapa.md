# L45 Jemput Ibu Bapa - G5 QA

Date: 2026-10-02. Branch: feature/student-prototype. Slug: L45-jemput-ibu-bapa.
Scope: S1 `/jemput-ibu-bapa` (M02, user shell, murid only) and S2 `/ibu-bapa/terima/:token` (M01, public). Inputs: URS and SRS v0.3 (52 ACs, DV-L45-01..06, E2E-L45-01..24), observed copy in `docs/discovery/L45-jemput-ibu-bapa.md` and `docs/discovery/img/L45/`.

## Verdict: READY (after re-run, 2026-10-02)

The initial run was Not ready (BUG-L45-01 High, BUG-L45-02 Medium: dark H1 on gradient headers). The lead added `text-white` to the three H1s; the targeted re-run below is green, so no Critical/High bug is open. All 52 ACs pass. Original findings kept below for the record.

## Test runs (real tree, `vite build --mode e2e --outDir dist-e2e-s2-qa45`, preview on port 4722)

| Run | Result |
|---|---|
| Both L45 specs (`l45-jemput-ibu-bapa.spec.ts` 19 tests, `l45-terima-jemputan.spec.ts` 14 tests = 33 per project) x mobile/tablet/desktop, `--workers=2` | 99 tests: 95 passed, 4 failed. All 4 were the 15 s app-boot budget in `gotoApp` (`page.waitForFunction` timeout) while I was running browser sweeps, vitest and typecheck at the same time: tablet E2E-L45-08, tablet E2E-L45-12, tablet E2E-L45-24 (flash/error), desktop E2E-L45-15 (guest). |
| Re-run of those 4 tests on tablet and desktop, `--workers=1`, nothing else running | 8/8 passed. Net: 99/99 pass (95 + 4 re-run). First attempt of the full run was cut by my own 590 s shell timeout after 33 passing tests and discarded. |
| Spec files unchanged during my runs (md5 `c303fcb5...` and `3d8480a0...`, checked before and after), so no re-run was needed for the developer's concurrent additions; the admin-menu-absence and teacher/parent 403 tests are present in the run. | |
| Unit (first run) `parent-invites.test.ts`, `JemputIbuBapaPage.test.ts`, `jemput.test.ts`, `ParentInviteAcceptPage.test.ts` | Blocked at first: `parent-invites.test.ts` suite failed to boot with `M05 practice build check failed: class 228 ...` (another module's in-flight seed work, not L45). Not worked around. |
| Unit re-run of the same 4 files after M05 settled | 4 files, 70 tests, all passed (parent-invites 45). |
| `npm run typecheck` | Exit 0, no errors (nothing out of scope reported). |
| QA spec `e2e/m01-authentication/qa-l45-contrast.spec.ts` (added by QA), 3 tests x 3 projects, `--workers=2` | 9 tests, 9 failed, as intended: it asserts the headings are readable and exposes BUG-L45-01/02. Stays in the repo as the regression test. |

Load note: workers=2 for the main run (1 for the re-run); the machine was loaded by my concurrent work. Temp config `playwright.s2qa45.config.ts`, `dist-e2e-s2-qa45`, `test-results-s2-qa45` removed; the 4722 server stopped. Never touched 4173/5173 or prestasiplus.my.

## Exploratory (Playwright MCP lane 3, local app, screenshots in `.playwright-mcp/lane3/l45-*.png`)

Full flow, all in one browser, 375 wide unless stated:
1. pelajar2 opens S1: hero, link card, empty state; "Salin" (clipboard stub) shows "Disalin!" then "Salin" after 2 s; WhatsApp click opens no page and the URL stays; `href` matches the SRS.
2. "Jana Link Baru": flash "Link jemputan baru telah dijana!", token ...001 to ...002, URL unchanged.
3. Guest opens the old link: "Link Tidak Sah" (title with em dash). New link: guest card (no school line for student 3), login CTA, register note, caption. CTA goes to `/login`; login as guru lands on `/dashboard`, not the invite.
4. Teacher opens the link: non-parent state; S1 for the teacher: 403 "Akses Ditolak" in place. "Log Keluar & Log Masuk Sebagai Ibu Bapa" ends on `/login`.
5. ibubapa opens the link: "Berjaya Berhubung", green box "Akaun anda (Ibu Bapa Demo) ...", "Lihat Profil Kemajuan" goes to `/pelajar/3` (title "Pelajar Dua Demo - Pelajar PRESTASIPLUS"). Re-open: still linked (no duplicate). pelajar2's S1 then lists "Ibu Bapa Demo" / ibubapa@demo.test.
6. ibubapa S1 and admin S1: 403 page, URL unchanged, tab title "403 - Akses Ditolak | PRESTASIPLUS", links `/` and `/login`. Guest S1 goes to `/login`.
7. Widths 320 / 375 / 768 / 1280, S1 and S2 (invalid, guest, non-parent, linked): `scrollWidth == innerWidth` everywhere, no element past the right edge, every visible link and button at least 44 px high, no text under 12 px, S2 card 296 / 351 / 512 / 512 px wide (448 for the invalid page, as live), 12 px side margins at 320.
8. Console: only `/favicon.ico` 404 (known platform item BUG-M01-05, not L45).
9. Contrast (computed colours): S1 hero H1 `rgb(30,41,59)` on rose-600 to pink-600 = 3.1:1; S2 valid H1 `rgb(30,41,59)` on indigo-600 to purple-700 = 2.1 to 2.3:1; S2 invalid H1 `rgb(30,41,59)` on slate-500 to slate-700 = 1.4 to 3.1:1. Live shows the invalid H1 in white (`terima-invalid-token-desktop.png`).

## Test plan: AC to result

E2E ids are the SRS §12 scenarios (traceability done by hand; `check-e2e-trace.mjs` does not read E2E-L45-*). All 24 scenarios E2E-L45-01..24 exist in the two specs and were executed on mobile, tablet and desktop. U = unit test file, M = manual lane-3 check above. Note the SRS says E2E-L45-13 `POST generate` as non-student is unit-tested only.

| AC | Test cases | Result |
|---|---|---|
| 01.1 content and three buttons | E2E-01; M1 | Pass |
| 01.2 field = origin + `/ibu-bapa/terima/` + 64 hex | E2E-01 (first token 63 zeros + 1), E2E-02; M | Pass |
| 01.3 same token on reload and relogin | E2E-02; M (token ...001 stable) | Pass |
| 01.4 two students differ | E2E-02 | Pass |
| 02.1 copy, "Disalin!", check icon, emerald | E2E-04; M1 | Pass |
| 02.2 reverts after 2 s, indigo | E2E-04 (clock); M1 | Pass |
| 02.3 clipboard refused: label unchanged, no error | E2E-04 (reject stub) | Pass |
| 03.1 WhatsApp href | E2E-05; M1 | Pass |
| 03.2 no navigation, no new tab | E2E-05; M1 (0 new pages, URL unchanged) | Pass |
| 03.3 href follows the new URL | E2E-06 | Pass |
| 04.1 regenerate: new link, same page, flash | E2E-06; M2 | Pass |
| 04.2 old link "Link Tidak Sah", new valid | E2E-07; M3 | Pass |
| 04.3 parents list unchanged | E2E-08 | Pass |
| 04.4 button disabled while pending | E2E-06 | Pass |
| 04.5 failed regenerate: old link, red alert | E2E-08 | Pass |
| 05.1 parent row (name, email) for student 2 | E2E-09 | Pass |
| 05.2 empty state for student 3 | E2E-10; M1 | Pass |
| 05.3 order A to Z, truncation | E2E-11 (two parents, ordered), E2E-24 (`text-overflow: ellipsis` computed style). A long-name fixture was not used | Pass (ellipsis checked by style only) |
| 05.4 list follows accept and M02 admin add/remove | E2E-11; M5 | Pass |
| 05.5 no chip, no remove control | E2E-09 | Pass |
| 05.6 loading spinner and load-error alert | E2E-03 | Pass |
| 06.1 guest to `/login`, no message | E2E-12; M6 | Pass |
| 06.2 admin 403 (copy, links, title, URL) | E2E-13 (admin); M6 | Pass |
| 06.3 other roles 403 | E2E-13 (teacher, parent); M4, M6. Penaja, Admin Sekolah, PPD, JPN not executed (same guard) | Pass for teacher and parent; the other four roles not executed |
| 06.4 generate refused 403 / 401 | U `parent-invites.test.ts` ('permissions (§9) on #1 and #2'), 45/45 | Pass (unit only) |
| 07.1 menu item for pelajar only (sidebar, drawer) | E2E-14; E2E-13 (absent for admin, teacher, parent) | Pass |
| 07.2 current page marked | E2E-14 | Pass |
| 08.1 invalid page content | E2E-15 (admin, guest, parent); M3 | Pass (copy, icons, hrefs; H1 colour is BUG-L45-01) |
| 08.2 replaced link shows the same page | E2E-07 | Pass |
| 08.3 deactivated student's link invalid | E2E-16 | Pass |
| 08.4 `zzzz` and 64 zeros show the same page | E2E-17 | Pass |
| 08.5 "Log Masuk" to `/login`, "Laman Utama" and footer to `/` | E2E-15 (clicks and hrefs) | Pass |
| 08.6 title "Link Tidak Sah — PRESTASIPLUS" | E2E-15; M | Pass |
| 09.1 guest card, initials, school line when present | E2E-18 (student 2 with school, student 3 without); M3 | Pass |
| 09.2 guest text and CTA to `/login` | E2E-18; M3 | Pass |
| 09.3 register note (DV-L45-01) | E2E-18 | Pass |
| 09.4 guest creates no link | E2E-18 | Pass |
| 09.5 login hand-off lands on landing page, reopen shows linked | E2E-19; M3-5 (`/dashboard`, then linked) | Pass |
| 09.6 caption | E2E-18 | Pass |
| 09.7 tab title | E2E-18 | Pass |
| 10.1 linked state copy and profile link | E2E-20; M5 | Pass |
| 10.2 student list shows the parent; admin M02 shows linked child | E2E-20, E2E-11; M5 for the student side. The admin-side parent record (linked child chip) was not opened | Pass for the student side; admin parent-record view not executed |
| 10.3 idempotent reopen | E2E-21; M5 | Pass |
| 10.4 second student keeps the first link | E2E-21 | Pass |
| 10.5 failed accept: alert, no link | E2E-22 | Pass |
| 11.1 non-parent state, no link | E2E-23; M4 | Pass |
| 11.2 switch button logs out to `/login` | E2E-23; M4 | Pass |
| 12.1 no h-scroll at 320/375/768/1280, every state | E2E-24 (375/768/1280 projects plus a 320/375/768/1280 sweep inside the test); M7 | Pass |
| 12.2 tap targets at least 44 px | E2E-24; M7 | Pass |
| 12.3 long URL scrolls in its field; page not widened | E2E-24 (field overflow at 320/375) | Pass |
| 12.4 no text under 12 px | E2E-24; M7 | Pass |
| 12.5 buttons stack below 640 px, side by side from 640 | E2E-24 | Pass |

Counts: 52 ACs, 52 Pass, 0 Fail, 0 Blocked. Caveats stated in the rows: 05.3 (style only), 06.3 (4 roles not run), 10.2 (admin side not run). No AC states a heading colour, so BUG-L45-01/02 are defects against D9, FR-L45-05 and the observed live page, not against an AC row.

Coverage of SRS §12: E2E-L45-01..24 all executed (24/24). FR coverage claimed by the SRS (32/32) not re-derived.

## Bugs

| ID | Severity | Steps to reproduce | Expected | Actual | Screenshot | Owner |
|---|---|---|---|---|---|---|
| BUG-L45-01 (FIXED, verified) | High | 1. Open `/ibu-bapa/terima/0000` (any viewer, any width). 2. Open a valid link as guest, teacher or parent (e.g. `/ibu-bapa/terima/{token of student 3}`). 3. Read the H1 in the gradient header. | White H1 on the header. Live (observed) shows "Link Tidak Sah" in white on the slate header (FR-L45-19, `terima-invalid-token-desktop.png`); the valid card header needs readable text (D9 unreadable text). | H1 colour is `rgb(30,41,59)` (the global `h1` rule in `src/styles/base.css`) on the gradient: valid card on indigo-600 to purple-700 = 2.1 to 2.3:1; invalid page on slate-500 to slate-700 = 1.4 to 3.1:1 (almost invisible at the dark end). Eyebrow and subtitle are fine. Same defect class as BUG-M01-01. | `.playwright-mcp/lane3/l45-invalid-375.png`, `l45-guest-375.png`, `l45-other-375.png`, `l45-linked-375.png` | L45-T2 (M01 screens: `InviteValidCard.vue` and the invalid card) |
| BUG-L45-02 (FIXED, verified) | Medium | Log in as pelajar2@demo.test, open `/jemput-ibu-bapa`, read the hero H1 "Jemput Ibu Bapa" at any width. | White text (SRS FR-L45-05; URS DV-L45-06 says the darkened gradient keeps white text readable). | H1 is `rgb(30,41,59)` on rose-600 to pink-600 (3.1:1, borderline); the `.user-shell [class*='-hero']` white rule does not match this hero (it has only `data-testid`). The subtitle line is white, so the hero text is inconsistent. | `.playwright-mcp/lane3/l45-s1-1280.png`, `l45-s1-320.png` | L45-T2 (M02 `JemputIbuBapaPage.vue`) |
| BUG-L45-03 | Low (not L45, known) | Any first page load: console shows `/favicon.ico` 404. | No console error. | 404. Already tracked as BUG-M01-05. | n/a | Platform / shell |

Why the specs missed it: no L45 test asserts a colour. `e2e/m01-authentication/qa-l45-contrast.spec.ts` now does (S1 hero H1 white and at least 3:1 on every gradient stop; S2 invalid H1 white and at least 3:1; S2 valid H1 at least 3:1).

## Not verified (state honestly)

- Roles Penaja, Admin Sekolah, PPD, JPN on S1 (INFERRED 403, same guard as teacher).
- Admin M02 parent record showing the linked child (AC-10.2 second half) and long-name truncation with a real long fixture.
- Valid-token and S1 copy are PROPOSED (D23) and "Perlu pengesahan"; the tests check them as built, not against live (never observed). OBSERVED parts (403 page, invalid page copy, guest redirect, `zzzz`) were compared to the discovery doc and screenshots: copy matches exactly; only the H1 colour differs (BUG-L45-01).

## Re-test needed to reach Ready

1. L45-T2 fixes BUG-L45-01 and BUG-L45-02 (white headings).
2. Re-run `qa-l45-contrast.spec.ts` (9 tests) and both L45 specs on three projects with `--workers=1` or 2 on an unloaded machine.

## Re-run after the H1 fix (2026-10-02)

Fix: `text-white` on the H1 in `InviteInvalidCard.vue`, `InviteValidCard.vue`, `JemputIbuBapaPage.vue`. Fresh e2e build (`dist-e2e-s2-qa45`), port 4722, temp config, `--workers=2`.

| Run | Result |
|---|---|
| `qa-l45-contrast.spec.ts` + both L45 specs, 3 projects (9 + 99 = 108 tests; the specs' md5 were unchanged since the first run, so the developer's admin menu-absence assertion (E2E-L45-13 admin, `data-nav-id` count 0) was already in the earlier run and passes again) | 98 passed, 10 failed. All 10 were the 15 s `gotoApp` boot timeout under heavy machine load (the run took 38 min; an earlier attempt was also polluted by two orphaned parallel Playwright runs of mine, which I killed and discarded). |
| Re-run of those 10 on their projects, `--workers=1` | 10/10 passed (mobile: L45-08, 11, 13 parent, 22, 23, 24-flash, S1 hero contrast, S2 valid contrast; tablet: the same 5 plus 3 re-run separately: L45-11, 13 parent, 24-flash; the tablet ones were separately re-run in a second batch). |
| Net | 108/108 pass; the 9 contrast tests now pass (they failed 9/9 before the fix). No assertion failures at any point. |
| Lane 3 visual check | H1 computed colour `rgb(255, 255, 255)` for S1 hero, S2 valid card and S2 invalid page at 375 and 1280 (`.playwright-mcp/lane3/l45-fix-{hero,valid,invalid}-{375,1280}.png`); readable on the gradients. |

Mock boot did not fail (no M05 error in this run). Cleanup: temp config, `dist-e2e-s2-qa45`, `test-results-s2-qa45` removed, 4722 server stopped.

Final verdict: **READY**. Open items are not blockers: BUG-L45-03 (favicon 404, Low, platform) and the unexecuted roles/admin-record checks listed under "Not verified".
