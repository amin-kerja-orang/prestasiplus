# L07 Dashboard Murid (M05 S1, `/dashboard`) - G5 QA

Date: 2026-10-09 (resumed from the 2026-10-03 pause). Branch: feature/student-prototype. Slug: L07-dashboard-murid (task M05-T3, roles-matrix row L07 Murid part). Inputs: SRS M05 v1.20 S1 (FR-M05-01..28, 131, DV-M05-17/18, sections 9 and 10), URS AC-M05-01.1 to 10.4. G4 was Approved.

**Verdict: READY (G5 Pass).** All 33 ACs (01.1 to 10.4) executed and Pass on mobile 375, tablet 768 and desktop 1280 (320 px checked on mobile). No open bug of any severity. Four link targets from S1 return the 404 page because their screens are not built yet (known dependencies, not S1 defects, listed below).

## Environment
Own config `playwright.5140.config.ts` (copy of `playwright.5023.config.ts`, port 5140, `dist-e2e-5140`, `test-results-5140`), vite build `--mode e2e` and a separate `vite preview` on 5140 that was checked alive before and during the runs. The first attempt used port 5108; the lead moved the session to 5140 because of a clash, so all 5108 results were discarded and everything was re-run on 5140. Only processes bound to my own ports were stopped. Config, dist, test results and preview are deleted. 4173/5173/live untouched. `E2E_BOOT_TIMEOUT_MS=90000`, 15 s expect timeout (spec), workers 3.

## Commands and counts
| Run | Command | Result |
|---|---|---|
| Smoke (earlier session) | `npx playwright test -c playwright.5025.config.ts e2e/m05-practice/smoke-dashboard.spec.ts --workers=2` | 36/36 pass (12 tests x 3 projects) |
| Full regression, run 1 | `E2E_BOOT_TIMEOUT_MS=90000 npx playwright test -c playwright.5140.config.ts e2e/m05-practice/qa-l07-dashboard.spec.ts --workers=3` | 246 tests (82 x 3 projects): 213 passed, 2 skipped (320 px test runs on mobile only), 31 failed (all spec mistakes, see below) |
| Re-run of the 31 failing tests after spec fixes | same command with `-g "AC-03.1\|AC-03.2\|AC-03.5\|AC-05.2\|FR-11\|AC-08.2\|NFR-RESP no horizontal\|DV-M05-17\|touch targets\|every S1 link"` | 41 passed, 1 failed (tablet dots test: test error, see below) |
| Dots test after final spec fix | `... -g "DV-M05-17 dots"` | 3/3 pass (mobile, tablet, desktop) |

Net: every one of the 244 executed regression tests passes on its latest run (213 from run 1 plus the 31 re-run and fixed). The 2 skips are by design. Typecheck of the spec shows no error. Unit/integration suites were not part of this G5 task (G3/G4 already covered them).

## Spec mistakes found and fixed (not app defects, source untouched)
| Item | Cause | Fix in `e2e/m05-practice/qa-l07-dashboard.spec.ts` |
|---|---|---|
| AC-03.5, AC-03.2, AC-03.1 hidden arrows, hit-area tests, touch-target test (slow machine) | The page clock keeps running, so on a loaded PC autoplay (5 s) moved the carousel during the test; slide-0 controls then had 0x0 size | `freeze()` helper (mouseenter pauses autoplay, FR-M05-08) and `clock.pauseAt` before the autoplay test |
| AC-05.2, FR-11 | Count-up already finished when read | Pause the page clock (`pauseAt(now+60 s)`) on `/practice`, then navigate to `/dashboard`; values start at 0 and are advanced with `mock.advanceTime` |
| AC-06.1 | DOM text "Progres0/10" has no spaces | regexp `/\/\s*10/` |
| AC-09.3 | No space after the emoji in the level group title | regexp `🏫\s*Sekolah Rendah (KSSR)` etc. |
| AC-10.4 | Trailing space in "15414 soalan " | regexp allows surrounding whitespace |
| AC-08.2 mobile/tablet | The aside element is in the DOM but hidden below 1024 (SRS: hidden) | assert `toBeHidden()` instead of count 0 |
| NFR-RESP element-edge scan | Counted decorative blobs and off-screen slides that are clipped by `overflow:hidden` ancestors (page itself has no horizontal scroll) | skip elements clipped by an ancestor that fits the viewport |
| DV-M05-17 dots click test | Bounding box was read before `scrollIntoViewIfNeeded`, and on tablet/mobile the dots ended under the fixed bottom navigation, so the 15 px "below" click hit the nav links. Diagnosed with `elementFromPoint`: up to 17 px above the dot resolves to the dot at every width and every dot; below, it does too when the dots are not under the bottom nav | scroll the dots to the viewport centre first, then measure and click |
| Link resolution | Four S1 links hit screens not built yet (below) | those four are recorded as dependencies; any other 404 still fails the test; per-test timeout 360 s |

## AC table
Result is the latest run on mobile / tablet / desktop (all three Pass unless stated). "S" = also covered by the smoke spec.

| AC | Steps (summary) | Result | Evidence |
|---|---|---|---|
| 01.1 | admin: tab title "Dashboard - PRESTASIPLUS", header "Dashboard", subtitle "Selamat datang kembali", also after navigation away and back | Pass x3 | `AC-01.1`, S |
| 01.2 | admin: h1 "Selamat Petang, Admin Demo 👋", line "Jom teruskan latihan hari ini! 🚀", 🎓 cap visible and right-aligned from 768, hidden at 375 | Pass x3 | `AC-01.2` |
| 01.3 | Greeting boundaries at 00:00 and 11:59 Pagi, 12:00 and 14:59 Tengah Hari, 15:00 and 18:59 Petang, 19:00 and 23:59 Malam (frozen clock, pelajar2) | Pass x3 (8 cases each) | `AC-01.3 BR-02 boundary` |
| 02.1 | admin trial card: icon, upper-case "Percubaan Percuma", "Baki 0 / 50 soalan", link "Langgan Sekarang" to `/pricing`, hit height >= 44 | Pass x3 | `AC-02.1/2.2/2.3` |
| 02.2 | pelajar2: "Baki 50 / 50 soalan" | Pass x3 | `AC-02.2` |
| 02.3 | pelajarmaju (subscriber): no trial card | Pass x3 | `AC-02.3` |
| 03.1 | slide 1: icon, badge HERO, title, 2-line clamp, "Baca Selanjutnya", arrows, 5 dots with wide active dot, "1 / 5", others hidden | Pass x3 | `AC-03.1` |
| 03.2 | 5 slides in order with exact badge/title/body (M09 mapping), next wraps 5 to 1, prev wraps 1 to 5 | Pass x3 | `AC-03.2` |
| 03.3 | every dot jumps to its slide, becomes the single wide dot, counter updates | Pass x3 | `AC-03.3` |
| 03.4 | toggle expands/collapses (Tutup, chevron rotate-180), state kept per slide | Pass x3 | `AC-03.4` |
| 03.5 | autoplay after 5 s (not at 4.5 s), pause while hovered 10 s, resume, wrap 5 to 1 (page clock paused, advanced manually) | Pass x3 | `AC-03.5`, S |
| 04.1 | admin Kombo banner: ⚠️, "Kombo 1 hari akan putus!", copy, "Mula Latihan" to `/practice`, hit >= 44 | Pass x3 | `AC-04.1` |
| 04.2 / 04.3 | pelajarmaju, pelajar, pelajar2: no banner (pelajar2 streak 0) | Pass x3 | `AC-04.2/04.3` x3 users |
| 05.1 | pelajarmaju: 267 / 432 "Mata (Lvl 3)" bar 100% / 3 / 4 / 70% with labels | Pass x3 | `AC-05.1`, S |
| 05.2 | all numbers 0 right after load (paused clock), climb monotonically with intermediate values, settle at 267 | Pass x3 | `AC-05.2` |
| 05.3 | admin: 256 / 8 "Mata (Lvl 2)" / 1 / 0 / 0%, 5 cards; FR-10 grid 2 columns below 1024, 5 from lg | Pass x3 | `AC-05.3`, `FR-10` |
| 06.1 / 06.2 | admin: "📱 Misi Harian", sub-line, upper-case "Progres", 0 / 10, 10 quests in order with emoji, title, chip text/colour (green/amber/red), 12 px upper-case chip, description, 0/target, +reward, locked chest "Selesaikan 10 lagi misi untuk buka peti! 🔒", 10 dots | Pass x3 | `AC-06.1/06.2` |
| 06.3 / 06.4 | pelajarmaju: progress 2/3, 60/80, 3/3, 9/10, 1/1, 5/5, 7/10, 2/2, 60/90, 6/20, bar widths capped at 100%, 4 / 10 done, "Selesaikan 6 lagi misi...", 4 filled dots | Pass x3 | `AC-06.3/06.4` |
| 07.1 | empty badge shelf for admin, pelajarmaju, pelajar2: 🏆, "Belum Ada Lencana Lagi!", copy | Pass x3 | `AC-07.1` x3 users |
| 07.2 | 5 quick actions: emoji, label, href; 2 columns at 375, 5 from 768 | Pass x3 | `AC-07.2` |
| 07.3 | admin revision badge "72" red, top right; pelajar2 none | Pass x3 | `AC-07.3` x2 |
| 07.4 | "Panel Admin" only for admin (icons, full width, `/admin`); absent for pelajarmaju, pelajar, pelajar2, guru, adminsekolah | Pass x3 | `AC-07.4` x6 |
| 07.5 | no unobserved sections (battle, sasaran harian, topik lemah, set soalan, tugasan, ganjaran/hadiah baharu) in text | Pass x3 | `AC-07.5` |
| 08.1 | "📚 Artikel Untuk Kamu", "Lihat Semua" to `/artikel`, 5 distinct article cards (icon, upper-case chip, relative time, `/artikel/<slug>`), strip scrolls inside itself (hidden scrollbar), page has no horizontal scroll, first card opens its page (not 404) | Pass x3 | `AC-08.1` |
| 08.2 | "Artikel Terkini" aside only from 1024 (5 same articles, "Lihat Semua Artikel", width 280-305); hidden below; FR-22 boundary 1023 hidden / 1024 shown | Pass x3 | `AC-08.2`, `FR-22` |
| 09.1 | 31 subject cards, "31 subjek", 7 "⭐ Subjek Teras", icons, "{n} soalan" (Matematik 13872 = S2 card 13,872), "Mula Latihan 🚀" with 31 distinct `/practice?subject=` hrefs; FR-23 grid 1 / 2 / 3 | Pass x3 | `AC-09.1`, `FR-23`, S |
| 09.2 | Matematik start opens `/practice/MATH` (not 404) | Pass x3 | `AC-09.2`, S |
| 09.3 | 3 level groups, 11 pills "{name} ({count})" with `/practice?level=D1..T5`, first pill (11396) | Pass x3 | `AC-09.3`, S |
| 09.4 / 09.5 | level pill opens plain S2 list "Latih Tubi 🎯"; `?topic_id=7` resolves to `/practice/MATH`; unknown topic_id stays on `/practice` | Pass x3 | `AC-09.4` |
| 10.1 | Statistik Platform 130152 / 31 / 11 / 129752 with labels; 6-digit values stay inside the card (DV-M05-18); 2 / 4 columns; FR-11 step timing (starts at 0, steps of 4339 for total) | Pass x3 | `AC-10.1`, `FR-11`, S |
| 10.2 | "Soalan Terkini": 5 items, upper-case subject chip, stars, text cut at 100 chars + "...", level chip D1-T5, relative time, not links, 2-line clamp | Pass x3 | `AC-10.2` |
| 10.3 | Tahap Kesukaran 39694 / 47138 / 33720 / 9600 / 0, proportional bars, total 130152, beside Soalan Terkini from lg, stacked below | Pass x3 | `AC-10.3` |
| 10.4 | Statistik Subjek: 31 cards sorted by question count desc, "Kesukaran:", "Digunakan: 0x", icons, grid 1 / 2 / 3 | Pass x3 | `AC-10.4`, S |

Count: **33 of 33 ACs Pass, 0 Fail, 0 Blocked.**

## Non-functional checks
| Check | Result |
|---|---|
| NFR-RESP no horizontal scroll and nothing past the right edge, admin / pelajarmaju / pelajar2 / guru, at 375, 768, 1280 | Pass x3 (all 4 accounts) |
| 320 px (mobile project): no horizontal scroll, platform total inside the viewport, expanded slide, no text under 12 px | Pass (runs on mobile only; skipped on the other two by design) |
| FR-131 text >= 12 px everywhere on S1 (admin, pelajarmaju) | Pass x3 |
| DV-M05-17 real hit areas by `elementFromPoint`: trial link, toggle, arrows, 5 dots, Kombo link, Lihat Semua, subject start (first/last), aside link are all >= 44 px high; visible dot < 12 px and arrow <= 34 px (visible size unchanged) | Pass x3 |
| Every `a`/`button` on S1 (admin) reports hit height >= 44 | Pass x3 |
| Dots: click 15 px above and 15 px below the visible dot selects that dot; neighbours not swallowed | Pass x3 (after the spec fix). Note: dots are 18 px wide for the active one only 10 px for others, SRS requires height only |
| SRS section 9 role access: pelajar, pelajarmaju, guru, admin, adminsekolah, ibubapa, penaja, ppd, jpn all land on `/dashboard` and see it without horizontal scroll | Pass x3 (9 roles) |
| Guest to `/login` (FR-130) | Pass x3 |
| Loading state (2.5 s latency): empty content area, no error, then page | Pass x3 |
| Error states: API 500, 403, 404 and network error show "Maaf, berlaku ralat. Sila cuba semula."; "Cuba Semula" (hit >= 44) recovers | Pass x3 (4 cases) |
| No page errors, console errors or failed requests while loading, advancing the clock, using the carousel and navigating away and back | Pass x3 |
| M09 mapping: editing `ActiveBanner.description` in admin changes slide-1 body; deactivating banner 5 gives "1 / 4", 4 dots, prev wraps to "4 / 4" | Pass x3 |
| Link resolution: every unique `href` on S1 (admin) opens something other than the 404 page, except the four dependencies below | Pass x3 with the dependency filter |

## Known dependencies (not S1 defects)
These links are specified by the SRS for S1 and are correct on S1, but the target screen does not exist in the build yet, so they land on the 404 page until the owning task ships:
- `/practice/progress` (M05 S8) and `/practice/history` (M05 S9), quick actions "Kemajuan" and "Sejarah Latihan". Owner: later M05 tasks.
- `/pricing` (M19 Packages), trial card "Langgan Sekarang". Owner: M19 build.
- `/admin` (M17 admin dashboard, not built; the dev preview-hub placeholder is not served in the e2e build), "Panel Admin" for admin. Owner: M17 build.
The spec records them as `PENDING` in `every S1 link target resolves`; once those screens exist, remove them from that list so the test turns strict.

## Bugs
None. No Critical, High, Medium or Low defect found in S1. Observations only (no action required): the inactive dots are 10 px wide with a 18 px wide hit area (SRS DV-M05-17 mandates only the 44 px height); on mobile and tablet the fixed bottom navigation covers the lower hit-area extension of the dots when they are scrolled to the very bottom of the viewport (normal scrolling clears it).

## Files
- Regression spec (kept, 3 projects): `D:\Dev Projects\pretasiplus-app\e2e\m05-practice\qa-l07-dashboard.spec.ts`
- Smoke spec (existing): `D:\Dev Projects\pretasiplus-app\e2e\m05-practice\smoke-dashboard.spec.ts`
- This report: `D:\Dev Projects\pretasiplus-app\docs\qa\L07-dashboard-murid.md`
- Run logs: scratchpad `l07-qa-murid\full.log`, `rerun.log`. Screenshots: none needed (no defect).
