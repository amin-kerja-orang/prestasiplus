# M14 Gamification - G5 QA, Session 5 student rows (L33, L34, L35, L39, L41 + linked S14, S17, S18)

Date: 2026-10-03. Branch: feature/student-prototype. Slug: m14-gamification.
Scope: roles-matrix rows L33 Syiling & Token (S11 `/gamification`), L34 Tukar Token (S12 `/gamification/convert`), L35 Cabaran Harian (S13 `/gamification/challenges`), L39 Pencapaian (S15 `/gamification/achievements`), L41 Rujuk Kawan (S16 `/gamification/referral`), and the linked S14 `/gamification/leaderboard`, S17 `/gamification/history`, S18 `/gamification/kad-kongsi`. Roles: Murid (pelajar, pelajar2 = user 3, pelajarmaju) and Admin (S11-S18 are shared). Teacher/admin screens S1-S10 and S19-S22 are out of scope. Sources: URS v1.6, SRS v1.9 (sections 4, 8, 10, 12), DV-M14-01..15.

## Verdict: READY (Session 5 student scope)

No Critical, High or Medium bug found. All executed ACs pass. Items not executed or not coverable here are listed explicitly (E2E-M14-25 unit-only, E2E-M14-30 needs admin S3, guard tests 06/07/09 and 41-47 are not in the student specs). One Low observation. Known decisions (DV-M14-01..15, PROPOSED copy, Muat Turun download = OQ-M14-20 / D22) are not counted as bugs.

## Test runs

Build: `vite build --mode e2e --outDir dist-e2e-s5-qa14`, preview on port 4752 (own PID, stopped afterwards). Temp config, dist and results removed.

| Run | Result |
|---|---|
| `e2e/m14-gamification`: student-a (17 tests), student-b (19), qa-session-hook (1, new) x mobile 375x812 / tablet 768x1024 / desktop 1280x800 = 111 | 111 pass in the end (see notes) |
| Unit `npx vitest run --project unit src/modules/m14-gamification --pool=threads --testTimeout=90000` | 14 files, 210 tests, all passed (75 s) |
| `npx vue-tsc -b --noEmit` | Exit 0, no errors |

Notes on the E2E runs:
- The machine was at 100 % CPU from other work, so app boot took 14-15 s against the fixed 15 s `APP_BOOT_TIMEOUT_MS` in `e2e/fixtures/mock-handle.ts`. The first two attempts (workers 2, then workers 1, default budget) failed almost everything with `page.waitForFunction: Timeout 15000ms` in `waitForMock`. That is an environment/budget problem, not a product defect (the same test passes alone: E2E-M14-16 desktop, 33 s).
- To get a real result I made the constant overridable with the default unchanged: `Number(process.env.E2E_BOOT_TIMEOUT_MS) || 15_000` (one line in a test-support file; left in the tree for the lead to keep or revert). Final run: `E2E_BOOT_TIMEOUT_MS=90000`, `--timeout=180000`, `--workers=1` (1 because of load; 2 was tried first).
- Final full run: 107 passed, 4 failed. Three failures were my new qa spec (wrong user id, then rows read before render; test bugs, fixed). One was the S14 podium test on mobile (`lb-podium-card` count 0 inside the 5 s expect, under load); re-running `student-b.spec.ts:151` on all three projects passed, and the manual 320/375/768 podium measurement agrees. qa spec re-run: 3/3 pass.
- Added test: `e2e/m14-gamification/qa-session-hook.spec.ts` (E2E-M14-28).

## Exploratory (Playwright MCP lane 3, local build on 4752; screenshots in `.playwright-mcp/lane3/m14-*-375.png` and `m14-*-1280.png`)

- All 8 routes at 320, 375, 768, 1280: `scrollWidth` equals `clientWidth` everywhere, no element past the right edge, no main link/button under 32 px, document titles as specified. Hero `h1` colour is white (rgb 255,255,255) on S11, S12, S13, S14, S15, S16, so the global h1 rule does not leak. S17 and S18 headings are slate-800 on a light header, as designed.
- S14 podium at 320 (cards 8-99 / 107-198 / 206-297 of 305), 375 (9-351 of 360) and 768: all inside the viewport. Rows #4-#50 render with initials avatars.
- S12 (admin): input min 50 / max 256; 30 and 49 disabled; 50 and 51 enabled (preview 1); 256 enabled (5); 257, 300, -5 and empty disabled; "Semua" sets 256, "250 syiling" sets 250, "50 syiling" sets 50; rate line "Kadar: 50 syiling = 1 token (Gangsa)". Convert 250 shows "Berjaya! 250 syiling ditukar kepada 5 token.", balances 6 / 5, S11 hero 6 / 5, S17 first row "Tukar 250 syiling → 5 token", -250, "Baki: 6". The 422 path cannot be reached from the UI (button disabled); covered by unit tests only.
- S13 (admin, real clock): "0/10 Selesai", ten cards in the specified order with rewards and difficulty, all 0 %, Kombo 2 Hari "0/2". Midnight reset is E2E-M14-29 (pass).
- S15: header "0/25 dicapai" and streak card; after `gamificationSession` for the admin, two cards unlock and the share modal opens (name, "🎓 PRESTASIPLUS", 5 syiling, 3 XP, Muat Turun, WhatsApp, Tutup); dialog sits inside the 375x812 viewport (x 16-344); Tutup closes it. Muat Turun does nothing (known D22). The share modal has no copy-link control (none is specified).
- S16: code 4JURJTT, tiles 50 / 25; "Salin Kod" gives "✓ Disalin!" with clipboard "4JURJTT"; "Salin Link" gives "✓ Link Disalin!" with `https://prestasiplus.my/register?ref=4JURJTT`; WhatsApp and Telegram hrefs encode only spaces (`%20`); stats 0 / 0 / 0; buttons 44 px high. Clicking the share anchors opened real wa.me and t.me tabs (closed again); expected for real share links.
- S18: tabs Profil, Kombo, Penguasaan, Kedudukan (44 px high); Profil card "A / Admin Demo / Soalan 119 / 38.7% / Sesi / 🥉 Bronze / Lvl 2" (English "Bronze" is the observed live copy).
- S17: pills Semua / Dapat / Belanja / Tukar / Bonus are 44 px high. Tier labels on S11 are readable (DV-M14-15; also asserted by E2E-M14-19 and 22).
- Console: no application errors seen on the M14 routes (only the known unrelated `/favicon.ico` 404 on login; `/admin` 404 after admin login is the unbuilt admin module, out of scope).

## Test plan: AC to result

E2E ids are SRS section 12. A = student-a.spec, B = student-b.spec, QA = qa-session-hook.spec, U = M14 unit tests, M = manual check above. "x3" = mobile, tablet and desktop all executed.

| AC | Test cases | Result |
|---|---|---|
| 01.3-01.6 headers, tab titles, user shell on S11-S13, S17 | E2E-03, 04 (A x3); M | Pass |
| 01.1-01.2 sidebar / admin panel (admin shell) | out of student scope | Not executed |
| 02.1 guest sent to /login | E2E-05 (A x3, S11 and S12) | Pass |
| 02.2, 02.3, 02.5 role guards, `/kombo`, 404 | E2E-06, 07, 09 are not in the student specs | Not executed |
| 02.4 odd query values | E2E-08 S17 part (A x3); S14 `?period=week` (B x3); S15 `?rarity=zzz` (B x3) | Pass |
| 03.1-03.2 header chips, balances agree | E2E-13 (A x3); M | Pass |
| 03.4 pelajar2 defaults | E2E-13 (A x3) | Pass |
| 04.1-04.3 S11 hero, progress, buttons | E2E-15 (A x3); M | Pass |
| 04.4-04.5 S11 stat cards (admin; student +198/+370) | E2E-16, 17 (A x3) | Pass |
| 05.1-05.5 S11 challenges, recent, mastery, tiers, next title, Kad Kongsi | E2E-18, 19 (A x3); M | Pass |
| 06.1-06.3 S17 header, 14 rows, balance chain, filters, convert row | E2E-20, 21, 24 (A x3); M | Pass |
| 07.1-07.3 S12 render, quick buttons, tier grid, tip | E2E-22 (A x3); M | Pass |
| 08.1 S12 min/max disabling | E2E-23 (A x3); M (30, 49, 50, 51, 256, 257, 300, -5, empty) | Pass |
| 08.2 convert 250, S11/S17 agree | E2E-24 (A x3); M | Pass |
| 08.3 direct #6 300 gives 422, no change | E2E-25 unit tests (U) only; not reachable from UI | Pass (unit only) |
| 09.1 S13 admin 0/10, ten cards, 0 % | E2E-26 (A x3); M | Pass |
| 09.2 S13 student 7/10 | E2E-27 (A x3) | Pass |
| 10.1 `gamificationSession` pelajar2 at 26/09 09:00: "2/10", rows +6 / +10 / +12, Langkah Pertama +5, balance 33 | E2E-28 (QA x3, new) | Pass |
| 10.2 second session: Kilat Matematik +30, Mula Hari Ini not repeated | E2E-28 (QA x3) | Pass |
| 10.3 after midnight all 0 %, "0/10" | E2E-29 (A x3) | Pass |
| 10.4 admin deactivates challenge (S3) | E2E-30 needs admin S3, out of scope | Not executed |
| 11.1-11.3 S14 podium, 47 rows, no period/own-rank, privacy, viewport | E2E-31, 32, 94, 97 (B x3); M (320/375/768) | Pass |
| 12.1-12.3 S15 header, streak card, 25 locked cards, pills, active purple | E2E-33, 34 (B x3) | Pass |
| 13.1-13.2 share modal, WhatsApp text and profile link, Tutup, backdrop | E2E-35 (B x3, pelajarmaju); M (admin unlock) | Pass (download = D22) |
| 14.1-14.3 unlock rows, Langkah Pertama only | E2E-36 core via QA (x3: +5 syiling, row "Pencapaian: Langkah Pertama", balance 33); M | Pass (admin S15 stays 0/25 and pelajarmaju 3/25 sub-checks not run separately) |
| 15.1-15.2 S18 Profil card and tabs | E2E-37 (B x3); M | Pass |
| 15.3 S18 WhatsApp texts | E2E-38 (B x3) | Pass |
| 15.4 S18 Muat Turun file name and download guard | E2E-39 cannot be proven: no download bytes (OQ-M14-20 / D22) | Blocked (user decision) |
| 16.1-16.3 S16 render, copy buttons, hrefs | E2E-40 (B x3); M | Pass |
| 17.1-17.2 referral credit on registration | E2E-41 not in the student specs | Not executed |
| 18-19 session credit, streak rules | U (integration, endpoints) and E2E-28; E2E-42..47 not run | Pass (U only) |
| 41.1 responsive S11-S18 | E2E-94 (A, B x3); M at 320/375/768/1280 | Pass |
| 41.2 no text under 12 px (S11, S13, S15, S18) | E2E-95 (A, B x3) | Pass |
| 41.3 touch targets | E2E-96 (A x3); M (referral buttons 44, tabs 44, pills 44) | Pass |
| DV-M14-15 tier label colours | E2E-19, 22; M | Pass |
| BR-M14-12 Kombo today-only | M (admin 0/2), E2E-26, 27, 29 | Pass |

Counts of the table: Pass 30 rows (incl. 2 unit-only), Blocked 1, Not executed 5.

## Bugs

| ID | Severity | Steps | Expected / actual | Screenshot | Owner |
|---|---|---|---|---|---|
| BUG-M14-01 | Low (observation, not blocking) | Open `/gamification` at 375 as any student. | Header title "Gamifikasi Dashboard" is cut to "Gamifikasi Dash..." by the shell ellipsis beside bell, hamburger and logo. No overflow. Live was not visited, so whether live truncates the same is unverified; if live wraps or shortens, adjust the user shell. | `.playwright-mcp/lane3/m14-dash-375.png` | frontend-developer (user shell) |
| NOTE-M14-02 | Test infrastructure, not a product bug | Run E2E under heavy machine load. | The fixed 15 s `APP_BOOT_TIMEOUT_MS` produces mass false failures when mock boot takes about 14 s. QA made it env-overridable (default unchanged). | n/a | qa / devops |

No Critical, High or Medium bugs; 0 functional defects.

## Open items for the lead
- E2E-M14-25 is unit-only, E2E-M14-30 needs S3 (admin), E2E-M14-06/07/09/41-47 are not in the student specs and were not run.
- Muat Turun (S15 modal, S18) stays a user decision (D22, OQ-M14-20).
- `e2e/fixtures/mock-handle.ts` has the one-line env override; keep or revert.
