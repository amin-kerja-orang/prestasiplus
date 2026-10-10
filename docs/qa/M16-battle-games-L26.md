# M16 Battle, Games & Competitions - L26 Permainan (Murid) - G5 QA

Date: 2026-10-10. Branch `s3-qa-l26` (worktree, HEAD 9c67d87). Role under test: Murid (`pelajar@demo.test`, Tingkatan 4). Inputs: URS/SRS/discovery M16, live screenshots in the main tree `docs/discovery/img/M16/`.

> Round 2 below supersedes this verdict: see "Round 2" at the end of this document.
Scope: every screen reached from the S6 hub: S1-S5, S6, S7-S12, S13-S19 (+ `/permainan/jutawan/main`, darjah picker), S20-S22. Out of scope (other matrix rows): S23-S29, AC-M16-01.1/01.2/01.5, 03.x banner fixtures beyond what the hub shows, 32-39.

## Verdict: NOT READY for L26

- 1 open Medium bug that fails two in-scope ACs (BUG-L26-01, wrong text "PPD PPD ...", AC-M16-13.1 / 13.4).
- 1 open Medium fidelity bug (BUG-L26-02, S6-S12 visual theming differs from live and from the rebuilt solo games).
- No Critical or High bug. Responsive: no horizontal scroll on any M16 screen at 320/375/768/1280.
- All 261 automated E2E tests pass (first run, no reruns needed) and the 813 unit tests pass.
- Several ACs have no executed test (listed as Not executed below); they are not marked Pass.

## Environment and runs

| Item | Result |
|---|---|
| E2E, `e2e/m16-battle-games`, scratch config, port 5120, workers=1, timeout 120 s, expect 30 s, `E2E_BOOT_TIMEOUT_MS=60000` | First run **261 passed / 0 failed** (1.9 h, heavily loaded machine). Rerun of failures: none needed. No timing flakes occurred. |
| Unit: `vitest run src/modules/m16-battle-games src/components/icon --pool=threads --maxWorkers=2` | **38 files, 813 tests passed.** (An earlier attempt was cut by my own 580 s shell timeout while E2E was building; it was rerun without a timeout and passed in 1122 s.) |
| Exploratory, Playwright MCP lane 3, preview on 5120, 375 / 768 / 1280 and a 320 scroll check | Done, see below. |

E2E per spec (tests per project; all three projects mobile 375x812 / tablet 768x1024 / desktop 1280x800 passed):

| Spec | Tests per project | mobile | tablet | desktop |
|---|---|---|---|---|
| smoke-hub | 5 | 5/5 | 5/5 | 5/5 |
| smoke-lobbies | 15 | 15/15 | 15/15 | 15/15 |
| smoke-battle | 27 | 27/27 | 27/27 | 27/27 |
| smoke-solo | 13 | 13/13 | 13/13 | 13/13 |
| smoke-competition | 9 | 9/9 | 9/9 | 9/9 |
| smoke-tournament (not L26, run for completeness) | 10 | 10/10 | 10/10 | 10/10 |
| smoke-sekolah-bersaing (not L26, run for completeness) | 8 | 8/8 | 8/8 | 8/8 |
| Total | 87 | 87/87 | 87/87 | 87/87 |

Note: E2E-M16-41/42 check S4 with a loose text match, so BUG-L26-01 passed the whole suite.

## Exploratory checks (executed in the browser)

| Check | Result |
|---|---|
| S6 hub, 18 cards in live order, click each card button from the hub at 1280 | All 18 resolve: `/papan-bijak`, `/battle`, `/perang-fakta`, `/benteng-ilmu`, `/perlumbaan-matematik`, `/kuiz-relay`, `/teka-silang-kata`, `/permainan/betul-salah`, `/permainan/roda-nasib`, `/permainan/pertandingan`, `/peta-belajar` (M03 page loads), `/permainan/uji-minda`, `/permainan/cabaran-kilat`, `/permainan/jutawan`, `/permainan/susun-jawapan`, `/permainan/tembak-jawapan`, `/permainan/sambung-kata` (handled 500, DV-03), `/permainan/kad-memori`. |
| Horizontal scroll sweep, 25 URLs (hub, lobbies, battle S1-S5, solo games with `?darjah=4`, competition, `/peta-belajar`) | 375, 768, 1280: none. 320: none on M16 pages. `/peta-belajar` (M03, not M16) overflows by 18 px at 320: noted for M03, not an L26 bug. |
| Text below 12 px, 13 content areas at 375 | None. |
| `/permainan/roda-nasib/spin` | 404 page (AC-02.4). |
| Roda Nasib spin at 375 | Button "Sedang Pusing...", prize modal "2 Syiling" + "Tutup", no "+n Syiling" / "Ditambah ke akaun kamu!" at setting 0 (DV-23). Matches live modal layout. |
| Betul atau Salah play-through at 375 (picker, Darjah 4, 45 s, result) | Picker, countdown, HUD, result card (Skor Total, Ketepatan, Kombo Max, Syiling, Rekod Baru, Main Lagi, Hub) match live layout. Score 0 gives "TERUSKAN!" per URS FN-M16-6.2.3 (live screenshot shows "Habat!" at 0/0; see Low-3). |
| Perang Fakta room (S8 create, room page, Mula, reload) | Room code created, bot joins, round 1/15 with a 10 s clock; after a reload the clock had advanced to round 2 (server clock not reset). |
| Battle quick match (Matematik) to arena to result, then S5, S2, S3, S4 | Search card, 0:00 timer, arena `/battle/arena/{uuid}` with Soalan 1/10, result "Kalah 1734 vs 5967" with "Mula Battle" / "Sejarah Battle"; history row "baru sahaja"; S2 and S4 reflect the battle. |
| Visual compare with live (375): S1 `/battle`, S13 result, S19 Jutawan | Close match in copy, layout and colour. |
| Visual compare with live: S6 hub, S7 Papan Bijak, S8 Perang Fakta | Differences, BUG-L26-02. |

## Test plan: AC to result (L26 in scope)

Legend: Pass (E2E) = covered by a passing spec in this run (ID shown); Pass (manual) = executed by me in the browser; Not executed = no E2E or manual run; not marked Pass.

| AC | Test cases | Result |
|---|---|---|
| 01.3 (S1-S5 titles) | E2E-M16-03; manual S4 title | Pass |
| 01.4 (S6-S21 header titles) | E2E-M16-43; manual (hub "Zona Permainan", solo pages) | Pass |
| 01.6 (tab titles) | E2E-M16-03 and manual (titles observed on every route) | Pass |
| 02.1 (no session to login) | not run (provisional) | Not executed |
| 02.3 / 02.4 (404 routes) | E2E-M16-07; manual `/roda-nasib/spin` | Pass |
| 02.5 (leaderboard/ranking params) | E2E smoke-battle (period tests) | Pass |
| 03.1, 03.4 (banner on hub) | hub renders with default seed; no banner fixtures run | Not executed |
| 04.1 (no text < 12 px at 375) | manual sweep, 13 pages | Pass (sample) |
| 04.2 (no horizontal scroll, tables scroll in card) | manual sweep 320/375/768/1280, 25 URLs; all projects of E2E | Pass |
| 04.3 (fictitious names from M02) | manual S2/S7/S8; E2E-M16-50, 52 | Pass |
| 04.4 (replay determinism) | covered by unit suite only | Not executed (E2E) |
| 05.1-05.4, 05.6 | E2E-M16-16, 17, 18, 20; manual S1 | Pass |
| 05.5 (Tingkatan 4 SPM unlocked) | E2E-M16-19 | Pass |
| 06.1, 06.2, 06.3 | E2E-M16-21, 22; manual quick match to arena | Pass |
| 06.4, 06.5, 06.6 | E2E-M16-23, 24, 25 | Pass |
| 07.1-07.3 | E2E-M16-26, 27 | Pass |
| 08.1-08.4 | E2E-M16-28, 29, 30, 31 | Pass |
| 09.1 | manual arena (2 players, Skor 0, Soalan 1/10, 4 options); E2E-M16-22 | Pass |
| 09.2 (scoring 900 at 3 s) | manual run only shows scores, exact formula not re-derived | Not executed |
| 09.3 ("Tamatkan" forfeit) | E2E-M16-32/33/34 | Pass |
| 09.4 (result) | manual: "Kalah", both scores, "Mula Battle", "Sejarah Battle" | Pass |
| 10.1, 10.2 | E2E-M16-35; manual history row | Pass |
| 11.1, 11.2, 11.3 | E2E-M16-37, 38; manual S2 after one battle | Pass |
| 12.1-12.5 | E2E-M16-39, 40 | Pass |
| 13.1 (S4 hero "PPD HULU LANGAT · Selangor · SMK") | manual: shows "PPD PPD HULU LANGAT" | **Fail** (BUG-L26-01) |
| 13.2, 13.3, 13.5, 13.6 | E2E-M16-41, 42 | Pass |
| 13.4 (school 900 empty, hero "PPD KUALA LANGAT · ...") | manual: "PPD PPD KUALA LANGAT" | **Fail** (BUG-L26-01) |
| 14.1-14.5 | E2E-M16-43, 44, 45; manual 18 cards clicked at 1280 | Pass |
| 15.1-15.6 | E2E-M16-46, 47, 48 | Pass |
| 16.1-16.3 | E2E-M16-49 | Pass |
| 17.1, 17.2 | E2E-M16-50 | Pass |
| 18.1-18.4 | E2E-M16-51, 52 | Pass |
| 18.5, 18.6 | E2E-M16-53, 54 | Pass |
| 19.1, 19.2 (Perang Fakta room, 15 rounds, result) | E2E-M16-55; manual room, clock survives reload | Pass |
| 19.3 (win count and S29 rise) | no test (S29 is M16-T7) | Not executed |
| 19.4 (Papan Bijak board counts) | E2E "Papan Bijak room: bot joins, Mula, board of 50 tiles" (tile type counts not asserted) | Not executed (partial) |
| Rooms S9-S12 (play) | lobbies/create/join only; no room play-through | Not executed |
| 20.1-20.3 | E2E-M16-57; manual picker | Pass |
| 21.1-21.4 | E2E-M16-58; manual play to result | Pass |
| 22.1-22.3 | E2E-M16-59, 66 | Pass |
| 23.1-23.3 | E2E-M16-60 | Pass |
| 24.1-24.4 | E2E-M16-61 | Pass |
| 25.1-25.3 | E2E-M16-62 | Pass |
| 26.1 (payload counts) | unit/handler tests only | Not executed (E2E) |
| 26.2, 26.3, 26.4 | E2E-M16-58, 59, 66 | Pass |
| 27.1-27.4 | E2E-M16-67, 68, 69; manual spin | Pass |
| 27.5 (already spun, 409 alert) | E2E-M16-67 (lock for the day); 409 alert not exercised | Not executed (partial) |
| 28.1-28.5 | E2E-M16-70, 71; manual picker | Pass |
| 29.1-29.6 | E2E-M16-72, 73, 74 (re-verified; DV-38 `test.fail` as accepted) | Pass |
| 30.1 (Uji Minda) | smoke-competition; manual title "Uji Minda - Belum Ada Cabaran" | Pass |
| 31.1 (Sambung Kata handled 500) | E2E-M16-75; manual | Pass |
| 40.x (cross-module contracts) | unit suite only | Not executed (E2E) |

Counts (L26 in scope, counted per AC group above): Pass 40, Fail 2 (13.1, 13.4), Not executed 10 (02.1, 03.x, 04.4, 09.2, 19.3, 19.4, 26.1, 27.5, S9-S12 play, 40.x). Not executed items are not Blocked by a defect; they lack a runnable test or fixture.

## Bugs

### BUG-L26-01 (Medium) S4 school hero line shows "PPD" twice
- Steps: log in as the student, open `/battle/ranking-sekolah/8106` (also 8090, 900), read the hero line under the school name.
- Expected (AC-M16-13.1, 13.4, discovery): "PPD HULU LANGAT · Selangor · SMK" and "PPD KUALA LANGAT · Selangor · SK".
- Actual: "PPD PPD HULU LANGAT · Selangor · SMK", "PPD PPD KUALA LANGAT · Selangor · SK".
- Cause (read from code, not changed): `BattleSchoolDetailPage.vue` `heroLine` prefixes `PPD ` to `s.ppd`, and the M02 value already starts with "PPD".
- Screenshot: `.playwright-mcp/l26-bug-ppd-ppd.png` (worktree, git-ignored).
- Owner: frontend-developer (M16). Also tighten the S4 hero assertion in E2E-M16-41/42 to an exact match.

### BUG-L26-02 (Medium) S6-S12 visual theming differs from live
- Steps: compare `/permainan`, `/papan-bijak`, `/perang-fakta` (and the other S8-S12 lobbies) at 375 and 1280 with `docs/discovery/img/M16/permainan-desktop.png`, `permainan-mobile.png`, `papan-bijak-mobile.png`, `perang-fakta-mobile.png`.
- Expected (live, not listed as a DV): S6 purple gradient hero with white text, per-card coloured gradient banners with a large emoji and per-card coloured buttons (red Battle/Perang Fakta, green Benteng Ilmu, orange Roda Nasib, ...); S7 purple hero, lavender "Cipta Bilik" panel, green "Masuk Bilik" panel, amber "Cari Lawan Auto" panel, pink "Papan Markah" panel, uppercase labels, gradient buttons; S8 red gradient hero, red buttons, code input on one row with the "Masuk" button and placeholder "CONTOH: ABC123", level chip "Darjah 4 (auto)" in a green box.
- Actual: white cards with small emoji, single blue-violet button colour on every card; S7 and S8 plain white panels; S8 code input stacked above its button. (Copy, order, chips and routes match.)
- Screenshots: ours `.playwright-mcp/l26-hub-1280.png`, `l26-hub-375.png`, `l26-pb-375.png`, `l26-pf-lobby-375.png`; live `docs/discovery/img/M16/` (main tree).
- Owner: frontend-developer (M16 hub and lobby components); lead to decide whether a DV is wanted instead.
- Note: S1, S13-S19 match live closely, so this is a gap in S6-S12 only. The "Tingkatan 4 (auto)" label versus live "Darjah 4 (auto)" follows the test account's level (not a bug).

## Medium/Low fidelity differences for the lead (not blocking)

- Low-1: Icon weights (outline in the rebuild, solid FontAwesome on live) on S1/S6 and the hero icon; the bottom-nav "Game" tab is not highlighted on `/battle`, `/papan-bijak` and `/permainan/*` pages (live highlights it). Shell/icon-system level; confirm against design-system v1.12.
- Low-2: Question text quality in game seeds, e.g. Betul atau Salah Darjah 4 can show an Arabic fragment ("... هذا") and arena questions such as "Hitung nilai purata yang diberi." with no data. These come from the M04 pool used by SOURCE rules; owner M04/M16 seed, not an M16 UI bug.
- Low-3: Live screenshot `betul-salah-done.png` shows title "Habat!" at score 0/0; URS FN-M16-6.2.3 says "TERUSKAN!" below 80. Spec and rebuild agree; the screenshot may predate the rule. Lead to confirm.
- Low-4: S7 Top-10 table scrolls inside its card at 375 with the "Jumlah" column partly cut (as live, DV not needed); verified.
- Out of L26: `/peta-belajar` (M03) overflows horizontally by 18 px at 320.

## Cleanup

My scratch config `playwright.qa5120.config.ts`, `dist-e2e-5120` and `test-results` were deleted, and my 5120 preview was stopped after the report. Screenshots under `.playwright-mcp/` are git-ignored.

---

# Round 2 (2026-10-10, branch `s3-qa-l26-r2`)

Scope: re-test BUG-L26-01 and BUG-L26-02, execute the 10 AC groups that round 1 did not execute, rerun smoke-hub, smoke-lobbies and smoke-battle, rerun the unit suite. Murid account `pelajar@demo.test` (Tingkatan 4). Screenshots are under `.playwright-mcp/` in the worktree (git-ignored; the MCP lane may only write there, not into the scratch folder), names `r2-*.png`. Logs are in the scratch folder `...\scratchpad\m16-qa-l26-r2\`.

## Round 2 verdict: NOT READY (one open Medium, no Critical or High)

- BUG-L26-01 is fixed and verified.
- BUG-L26-02 is fixed except one visible defect that I log as new **BUG-L26-03 (Medium)**: on S6 and S7-S12 the hero title (`h1`) is dark slate `rgb(30, 41, 59)` on the coloured gradient, while live shows white text. The hero subtitle is white, so the hero looks half-themed, and the title fails WCAG contrast on the red, orange, violet and green heroes (measured about 1.5:1 to 3.3:1). The acceptance for BUG-L26-02 was "everything else must match live colours", so this is a failure of that fix. By the strict rule "no open Critical or High" alone the release would be allowed, so the lead decides; my recommendation is to fix it first (a one-class change, owner frontend-developer).
- All 52 AC groups in scope now pass. Four sub-items are Blocked because the prototype has no such page (listed below). No Critical or High bug. Responsive: no horizontal scroll at 320, 375, 768 and 1280 on S6-S12, the rooms and S4.
- Tests: smoke-hub, smoke-lobbies and smoke-battle 141/141 passed; new QA spec 39/39 passed; unit 39 files, 822 tests passed.

## Bug status

| ID | Round 1 | Round 2 | Evidence |
|---|---|---|---|
| BUG-L26-01 S4 hero "PPD PPD" | Open, Medium | **Fixed.** Hero line reads exactly "PPD HULU LANGAT · Selangor · SMK" (schools 8106 and 8090) and "PPD KUALA LANGAT · Selangor · SK" (school 900) at 375, 768 and 1280. E2E-M16-41 asserts the full text and passed; my QA-R2-13 also checks 8090 and 900. | `.playwright-mcp/r2-s4-8106-*.png`, `r2-s4-900-*.png` |
| BUG-L26-02 S6-S12 visual theming | Open, Medium | **Fixed except the hero title colour (BUG-L26-03).** Checklist below. | `r2-s6-1280.png`, `r2-s7-375.png`, `r2-s7-1280.png`, `r2-s8-375.png`, `r2-s12-375.png` |
| BUG-L26-03 hero title colour (new) | - | **Open, Medium** | below |

### BUG-L26-02 checklist against the live screenshots (`docs/discovery/img/M16/`)

| Item | Result |
|---|---|
| S6 gradient hero; 18 cards in live order; per-card gradient banner with large emoji, badge and chips; per-card gradient button (red Battle and Perang Fakta, green Benteng Ilmu, blue Perlumbaan, violet Kuiz Relay and Betul atau Salah, amber Roda Nasib, green Pertandingan, violet Peta, pink Uji Minda, cyan Cabaran Kilat, amber Jutawan, teal Susun, orange Tembak, green Sambung Kata, violet Kad Memori) | Matches live at 1280 (3-column grid). |
| S7 violet "Cipta Bilik" panel, green "Masuk Bilik" panel with "Cara Bermain" inside it, amber "Cari Lawan" panel, pink "Papan Markah" panel; Top 10 rows are cards with medal, avatar and pill columns; gradient buttons | Matches live at 375 and 1280. |
| S8-S12 hero in the game colour (red, green, blue, violet, orange); join code and "Masuk" button on one row; "Tingkatan 4 (auto)" green box with "Tukar" | Matches live (S8 and S12 compared at 375; S9-S11 seen in the room runs). |
| DV-M16-49 contrast fixes only: Roda Nasib and Jutawan buttons amber-dark; S7 "Cari Lawan" gradient starts `rgb(217,119,6)`; S7 "Masuk Bilik" starts `rgb(5,150,105)`; hub chip text slate-500 (`GameCard.vue`); Top 10 rank-3 "Betul" `rgb(6,95,70)` on the peach row, while rank 1 and ranks 4-10 keep the live emerald `rgb(5,150,105)` | As accepted. Measured with computed styles on S7 (chip colour read from code and the screenshot). |
| Everything else equal to live colours | Fails for the hero title only (BUG-L26-03). |

### BUG-L26-03 (Medium, new) Hero title is dark on the gradient hero (S6, S7, S8-S12)
- Steps: log in as the Murid, open `/permainan`, `/papan-bijak`, `/perang-fakta`, `/benteng-ilmu`, `/perlumbaan-matematik`, `/kuiz-relay`, `/teka-silang-kata` and read the hero `h1`.
- Expected (live `permainan-desktop.png`, `papan-bijak-desktop.png`, `perang-fakta-mobile.png`): white title on the gradient.
- Actual: `getComputedStyle(h1).color` is `rgb(30, 41, 59)` on all 7 screens; the subtitle is white. Example: the dark title on red `rgb(185,28,28)` to `rgb(127,29,29)` is about 1.5-2.2:1.
- Cause (read from code, not changed): the hero `h1` classes are `font-heading text-2xl font-bold sm:text-3xl` without `text-white`, so the global heading colour overrides the colour inherited from the hero (`LobbyPage.vue:76`, `PapanBijakPage.vue:69`, `PermainanPage.vue:33`).
- Screenshots: `.playwright-mcp/r2-s7-1280.png`, `r2-s8-375.png`, `r2-s12-375.png`, `r2-s6-1280.png`.
- Owner: frontend-developer (M16).

## Round 1 "not executed" ACs: results

How executed: manual browser (Playwright MCP lane 3) for 02.1, 03.x and the visual compare; the Playwright runner with the mock clock for the clock-driven ACs (new `e2e/m16-battle-games/qa-round2.spec.ts`, 13 tests per project, tag `@m16`); a handler-level vitest for contracts that have no UI in the Murid role (new `src/modules/m16-battle-games/__tests__/mock/qa-round2.test.ts`). Real-vs-real play is simulated by deterministic bots (D4) and rooms are host-driven.

| AC | Result | How and evidence |
|---|---|---|
| 02.1 no session goes to `/login` | **Pass** for the L26 routes; **Blocked** for `/liga` and `/admin/permainan` | Fresh browser context without session: `/battle`, `/permainan`, `/papan-bijak` and `/battle/ranking-sekolah` all end on `/login` ("Log Masuk"). `/liga` and `/admin/permainan` show the 404 page: those routes (Liga S25-S27, admin S29) are M16-T6/T7, other matrix rows, not in this bundle. |
| 03.1 no tournament: `GET /api/tournament/active` once per page, `[]`, no banner | **Pass** (admin session) | `/dashboard`, `/permainan`, `/tournament`: 1 request each, status 200, no `tournament-banner`. The "no call on `/admin/permainan`" part is **Blocked** (route not built). |
| 03.2 / 03.3 fixture banners | **Pass** | Hook `m16Fixture('tournaments')`, then `/permainan`: three cards in API order: "Contoh Tournament Pendaftaran / Pendaftaran dibuka / DAFTAR"; "Contoh Tournament Berlangsung / Sedang berlangsung" (no badge); "Contoh Tournament LIVE / LIVE: ... vs ... / MAIN". Links go to `/tournament/{uuid}`. Screenshot `r2-ac03-banner.png`. |
| 03.4 `failNext 500` | **Pass** | After an in-app navigation with `failNext('/api/tournament/active', 500)`: request recorded as 500 faulted, no banner, no alert, hub renders 18 cards. (A full page load clears the fault queue, so the fault was armed in the page.) |
| 03.5 admin creates a tournament, banner shows it | **Blocked** | The admin create form (`/tournament/create`, S24) is not in the bundle (404). Banner rendering of stored tournaments is covered by 03.2 and 03.3. |
| 04.4 replay determinism | **Pass** | QA-R2-04.4, 3 projects: two fresh browser contexts, same flow (quick match, 10 answers, Roda Nasib spin, Perang Fakta room with 15 votes) give identical bot answers and scores (700, 700, 700, 1433, 2166 ... 5967), spin "3 Syiling", room result "Pelajar Demo 12 mata, Pelajar Demo 001786 11 mata". Replay needs a fresh context (IDB persists ids across page loads) and a frozen clock: with a running clock my own answer time drifted from 3 s to 4 s (867 instead of 900), which is test noise, not a defect. |
| 09.2 scoring | **Pass** | QA-R2-09.2 (3 projects): answer after exactly 3 s (frozen clock) shows "+900", a wrong answer "+0"; score A equals the running sum; bot score and "Lawan: betul/salah" appear after each answer. QA-R2-09.2b: an answer after 14 s gives "+533" = 1000 - round(500 x 14 / 15). At 15 s the question times out and moves on, so the 15 s edge is covered only by the handler test in `battle-handlers.test.ts`. Screenshots `r2-ac092-*.png`. |
| 19.3 won room raises my wins; S29 "Selesai" | **Pass** (handler level); S29 UI **Blocked** | UI: QA-R2-19.3 plays a Perang Fakta room and shows "🏆 Pelajar Demo menang!"; the Pendahulu list stays at 10 rows because a first win (1) is below the visible cut (2 or more). Handler test (Benteng Ilmu, all answers correct using the M04 keys): the Murid wins, Pendahulu rows go 8 to 9 and my row 0 to 1 "menang"; `GET /api/admin/games` stats.finished goes 0 to 1 (the S29 "Selesai" value). The S29 page is not built (M16-T7). |
| 19.4 Papan Bijak board | **Pass** | QA-R2-19.4 (3 projects): after "Mula" there are 50 tiles: 3 ladders, 3 snakes, 2 bonus, 2 traps, 35 quiz (counted by tile emoji). Screenshots `r2-ac194-*.png`. |
| 26.1 payload counts, M04 ids, session prefixes | **Pass** | Handler test: betul-salah 40, cabaran-kilat 30, tembak-jawapan 30, susun-jawapan **20**, kad-memori 12; the 100 MCQ item ids all exist in the M04 store; prefixes `tf_`, `speed_`, `shoot_`, `ws_`, `mem_`. |
| 27.5 already spun | **Pass** | QA-R2-27.5 (3 projects): after a spin the button reads "✅ Sudah Spin Hari Ini" and is disabled. A second, stale tab opened before the spin still offers "SPIN!"; clicking it gives the native alert "Anda sudah spin hari ini." and the button locks; requests 200 then 409. The page guards a direct re-click in the same tab, so the 409 can only be reached from a stale tab. Next day enabled: E2E-M16-69 (round 1) and the handler test (25 h later). Screenshots `r2-ac275-*.png`. |
| 40.1 `onGameResult` once; displayed syiling equals `coinsCredited` | **Pass** (handler level) | With the setting on (`settingCoins`): each of 2 solo submits adds exactly one M14 ledger row of 1 syiling and the response `syiling_awarded` is 1; a forfeited battle reports once. |
| 40.2 Q-ANS-ALL unchanged | **Pass** | `practiceAnswers.count('Q-ANS-ALL')` is 478,499 before and after 2 games and 1 battle. |
| 40.3 M11 counts | **Pass** (reader port); M11 panel **not exercised** | `battles.countFor` +1 and `gameResults.countFor` +2 for the student. The M11 "Pecahan Aktiviti" panel belongs to M11 (provisional until XR-M16-05 is adopted). |
| 40.4 M01 and M02 totals unchanged; anchors present | **Pass** | `U-ALL` 5,159 and `S-ALL` 10,220 before and after; anchor users and schools exist. |
| S8-S12 room play-through | **Pass** (3 projects) | QA-R2-room: create, bots join, "Mula", play to the result, no horizontal scroll, "Hub" link to `/permainan`. Perang Fakta (15 rounds) "🏆 Pelajar Demo menang!"; Benteng Ilmu result after 3 answers (HP); Perlumbaan Matematik after 20 steps; Kuiz Relay with 4 players "Pasukan B menang!" and MVP; Teka Silang Kata with wrong words until the 5:00 clock ends. Screenshots `r2-room-<game>-wait|play|result-<viewport>.png`. |

## Updated AC counts (L26 in scope, per AC group)

| | Round 1 | Round 2 |
|---|---|---|
| Pass | 40 | **52** |
| Fail | 2 (13.1, 13.4) | **0** |
| Not executed | 10 | **0** |
| Blocked sub-items (prototype limits, not failures) | - | 4: `/liga` and `/admin/permainan` routes (02.1, 03.1), 03.5 admin create form, 19.3 S29 page |

## Runs

| Run | Result |
|---|---|
| E2E smoke-hub, smoke-lobbies, smoke-battle (scratch config, port 5120, workers 1, timeout 120 s, expect 30 s) | **141 passed, 0 failed, no reruns**: smoke-hub 5/5/5, smoke-lobbies 15/15/15, smoke-battle 27/27/27 (mobile / tablet / desktop). 45 minutes on a loaded machine. |
| E2E QA spec `qa-round2.spec.ts` (09.2, 09.2b, 04.4, 13, 19.3, 19.4, 27.5, 320 px sweep, 5 room play-throughs = 13 per project) | **39 passed** on mobile, tablet, desktop. Fixed during development, all test-side: 09.2b needed answer times below 15 s; 27.5 needed a second tab; 04.4 needed fresh contexts and a frozen clock; one trace-file write error ("End of central directory record not found", infrastructure, passed on rerun). |
| Unit `vitest run src/modules/m16-battle-games src/components/icon --pool=threads --maxWorkers=2` | **39 files, 822 tests passed** (600 s), including the 4 new QA tests. |
| Exploratory, Playwright MCP lane 3, preview on 5120 | S6, S7, S8, S12 at 375 and 1280, 02.1, 03.x. Two MCP calls hung for 30 minutes each (the lane page stuck on a spinner after many sessions in one profile), so the clock-driven checks were run with the Playwright runner. |

## Low items (information, the lead decides)

- **Low-3 "Habat!" versus "TERUSKAN!"**: live `betul-salah-done.png` shows the title "Habat!" (dark text on the dark modal, with the green tick icon) at **score 0 and 0/0 answers** with "REKOD BARU!". URS FN-M16-6.2.3 says: 300 or more "🏆 LEGENDA!", 150 or more "🔥 LUAR BIASA!", 80 or more "✅ HEBAT!", else "💪 TERUSKAN!". So the live screenshot contradicts the URS ladder at score 0: either live uses another rule when nothing was answered, or the screenshot is from an older build. The text "Habat!" also looks like a typo of "HEBAT!". The rebuild follows the URS ("TERUSKAN!" at 0). Not re-tested.
- Low-2 (seed question text) and the shell bottom-nav highlight: not re-tested, as instructed.
- New Low: S7 "Cari Lawan Auto" at 375 stacks the "Subjek" and "Padanan" selects; live shows them side by side. S7 Top 10 names wrap to 2-3 lines at 375 where live keeps one line. Both are layout nuances without scroll or clipping.
- Names in rooms ("Pelajar Demo 001786", "Murid Simulasi 14") are fictitious, as required.

## Cleanup (round 2)

My scratch config, `dist-e2e-5120` and `test-results` were removed and my 5120 preview stopped. Kept for the commit: `e2e/m16-battle-games/qa-round2.spec.ts` and `src/modules/m16-battle-games/__tests__/mock/qa-round2.test.ts`.

## Lead note (2026-10-10)

- BUG-L26-03 fixed by the lead: the hero `h1` on S6 (`hub-h1`), S7 (`pb-h1`) and S8–S12 (`lobby-h1`) now carries `text-white`, as on live. Re-verified by QA before L26 is closed.
- Low-3 ("Habat!" at 0/0 on the live screenshot vs the URS "TERUSKAN!" ladder) is recorded as DV-M16-50: the rebuild follows the URS.
- The round-2 evidence files `e2e/m16-battle-games/qa-round2.spec.ts` and `src/modules/m16-battle-games/__tests__/mock/qa-round2.test.ts` were not merged: they fail the repo lint rules (restricted cross-module import, unused variable). Their results are recorded above and remain the evidence for the formerly not-executed ACs.
