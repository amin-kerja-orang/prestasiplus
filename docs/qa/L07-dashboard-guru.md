# L07 Dashboard Guru (M10 S1, `/guru`) - G5 QA

Date: 2026-10-03. Branch: feature/student-prototype. Slug: L07-dashboard-guru (task M10-T2, roles-matrix row L07 Guru part).
Inputs: SRS M10 (FR-M10-03, 08..13, 129; BR-M10-05/06; DV-M10-12/28; section 9 and 10), URS M10 (AC-M10-03.1 to 05.4, 48.1/48.2).

## Verdict: NOT READY (1 Medium bug open, 0 Critical/High)

10 ACs executed: 8 Pass, 2 Fail (AC-04.1 and AC-04.2, both for the same defect BUG-L07-01: the "Soalan" caption lacks the literal "✅" glyph). Everything else passes at 375, 768 and 1280 (and 320). G5 needs every AC Pass, so the gate stays open until BUG-L07-01 is fixed (one-line change) or the SRS/URS is amended to accept an icon. No layout, font-size, touch-target or role-access defect found.

## Test runs

Environment: real tree (shared, dirty working tree) built with `vite build --mode e2e --outDir dist-e2e-5022`, `vite preview` on port 5022, own config copy `playwright.5022.config.ts` (port/outDir/outputDir changed from the 5021 config). Machine was heavily loaded (about 20 to 40 s per test), so `E2E_BOOT_TIMEOUT_MS=90000` and `--workers=2` (workers=1 for one re-run). Config copy, `dist-e2e-5022`, `test-results-5022` deleted and the 5022 server stopped; 4173/5173 and live prestasiplus.my never touched.

| Run | Command (abridged) | Result |
|---|---|---|
| Existing smoke | `E2E_BOOT_TIMEOUT_MS=90000 npx playwright test -c playwright.5022.config.ts e2e/m10-teacher-class/smoke-dashboard.spec.ts ... --workers=2` | 4 tests x 3 projects = 12/12 pass (E2E-M10-02/06, 05, responsive, 07) |
| QA spec, first full run (default 5 s expect timeout) | same, with `qa-l07-dashboard.spec.ts` | 93 pass, 10 fail: 3 x BUG-L07-01 and 7 timeouts where the first assertion after boot found nothing (5 s budget on a loaded machine). Different tests failed in different runs and passed on retry. My spec bug, not the app |
| Targeted re-runs (workers=1) | `-g "AC-03.1\|AC-05.4\|..."` | 22 pass, 5 fail, all again first-assertion timeouts (random tests) |
| Final QA spec run, expect timeout 15 s (as the smoke spec does) | `npx playwright test -c playwright.5022.config.ts e2e/m10-teacher-class/qa-l07-dashboard.spec.ts --workers=2` | 31 tests x 3 projects: **88 passed, 2 skipped (320px test runs only on the mobile project by design), 3 failed = BUG-L07-01 on mobile, tablet, desktop**. No other failure |
| Unit | `npx vitest run src/modules/m10-teacher-class/__tests__/dashboard` | 1 file, 8/8 pass |

New regression spec kept in repo: `e2e/m10-teacher-class/qa-l07-dashboard.spec.ts` (the "✅ glyph" test is red on purpose until BUG-L07-01 is fixed). Typecheck/lint not run (not requested; G3/G4 already passed).

## Test plan: AC to result

Evidence: Q = `qa-l07-dashboard.spec.ts` test, S = `smoke-dashboard.spec.ts` test, M = manual check (Playwright MCP lane 1, `.playwright-mcp/l07-guru-375.png`). All E2E rows ran on mobile, tablet and desktop.

| AC | Steps | Result | Evidence |
|---|---|---|---|
| AC-03.1 guide content | Open `/guru` as admin and guru; check h3, intro, 3 badges, titles, texts, link labels and hrefs (`/guru/kelas`, `/guru/pelajar`, `/guru/monitoring`), tip "Tip: Hover atas mana-mana menu ..." | Pass | Q AC-03.1 (x2 accounts), S E2E-M10-05; M screenshot |
| AC-03.2 close/pill persistence | Close: key `hideGuruGuide` = "true", card gone, pill "Tunjuk panduan Mula Di Sini"; reload keeps pill; click pill: key removed, guide back; reload keeps guide; close again and reload. Also value "false" keeps guide; blocked storage (getItem/setItem throw): guide shown, close raises no page error | Pass | Q AC-03.2, FR-08 other value, FR-08 storage failure; S E2E-M10-05 |
| AC-04.1 admin checklist and cards | 0/3, 0%, bar width 0, 3 rows with subtitles and "Lihat" hrefs; cards Kelas Aktif 0 / "0 jumlah kelas", Pelajar 0 / "Merentasi semua kelas", Soalan 20719 (no separator) / "19361 diluluskan", Tugasan 0 / "Jumlah tugasan dibuat" | **Fail** (literal text) | Everything matches except the caption is "19361 diluluskan", not "✅ 19361 diluluskan" (BUG-L07-01). Q AC-04.1 passes without the glyph; Q glyph test red |
| AC-04.2 guru checklist and cards | 3/3, 100%, bar 100%, Kelas Aktif 2 / "2 jumlah kelas", Pelajar 8, Soalan 1 / "1 diluluskan", Tugasan 0; after `createQuestionFixture` (id 700301) Soalan 2 / diluluskan 1 | **Fail** (same glyph) | Values and the fixture behaviour pass: Q AC-04.2 x2, S E2E-M10-07 (provisional). Glyph missing, BUG-L07-01 |
| AC-05.1 Tindakan Hari Ini | Admin: label, h2, description, counters Pelajar 0 / Topik 0 / Tindakan 0, "Top 3", "Analitik Kelas →" `/analitik/kelas`, "Rule-based", both empty texts, action card, "Permulaan", text, "Buka Kelas →" `/guru/kelas`; guru sees the same (FR-11) | Pass | Q AC-05.1 x2, S E2E-M10-02/06 |
| AC-05.2 peer + quick tiles | "PEER TUTOR MATCHING" computed `text-transform: uppercase`, title, text, empty box exact; 4 tiles with subtitles and hrefs (`/guru/kelas/cipta`, `/guru/soalan/cipta`, `/guru/pelajar`, `/guru/profil/edit`), admin and guru | Pass | Q AC-05.2 x2, S |
| AC-05.3 admin Kelas Saya / Penghantaran | "Semua →" `/guru/kelas`, "Belum ada kelas. Cipta sekarang!", both submission empty texts | Pass | Q AC-05.3, S |
| AC-05.4 guru class lines | Exactly "5 MARIKH - Kimia · 8 pelajar" and "5 MARIKH - Sejarah · 8 pelajar"; submissions still empty | Pass | Q AC-05.4, S E2E-M10-07 |
| AC-48.1 (S1 part) no h-scroll | `scrollWidth <= clientWidth` (3 samples) at 375, 768, 1280, and 320 (mobile project), guide shown and hidden, loaded and error states; no element in `main` past the right edge | Pass | Q NFR-RESP, Q 320px, S responsive |
| AC-48.2 / FR-129 text >= 12px | Every text node in `main`, guru account, guide card and pill states, all three widths and 320 | Pass | Q AC-48.2, Q 320px, S E2E-M10-02 |

Other requirements checked (not separate ACs): FR-03 header ("Dashboard Guru", "Selamat datang, Guru Demo 👩‍🏫", `nowrap` + `ellipsis`, tab title "Dashboard Guru - PRESTASIPLUS": Pass). Stat grid 2 per row below 1024, 4 at 1280 and the "Tindakan Hari Ini" columns stacked below 1024 / side by side at 1280: Pass (S responsive). Touch targets (guide close, pill, 3 "Lihat", 4 tiles, "Semua →", "Analitik Kelas →", "Buka Kelas →", retry; and every `a`/`button` in `main` at least 44 px high): Pass at all three widths.

## Exploratory results

1. Link targets (admin, client-side navigation): `/guru/kelas`, `/guru/pelajar`, `/guru/monitoring`, `/analitik/kelas`, `/guru/kelas/cipta`, `/guru/soalan/cipta` all resolve to real pages. `/guru/misi-harian/cipta` (S12) and `/guru/profil/edit` (S32) show the 404 page = known unbuilt dependencies, not S1 bugs (SRS does not require them to exist yet).
2. Role access (SRS section 9; murid is UNVERIFIED/INFERRED there): guest goes to `/login`. Murid, ibu bapa, penaja and admin sekolah are redirected to `/dashboard`; PPD to `/ppd/dashboard`; JPN to `/jpn/dashboard` (role landing redirect, matches "the M01 landing redirect (INFERRED)"). No dashboard content is rendered for any of them. In this build those landing routes are not built, so the redirect ends on the 404 page: known dependency on M08 and the PPD/JPN modules, not an S1 bug. Teacher and admin allowed (Pass).
3. Loading and error states: slow response (1.5 s latency) shows the spinner (`dashboard-loading`) and no content, then content. API 500, 403 and a network error each show "Gagal memuatkan dashboard. Sila cuba lagi." with a "Cuba Lagi" button (touch target OK, no h-scroll, guide card still shown); retry recovers to 3/3. Pass.
4. Visual check at 375 (`.playwright-mcp/l07-guru-375.png`, full page): cards, panels and tiles stack correctly, nothing clipped, bottom navigation reachable. The fixed bottom nav overlaps the guide card only in the full-page screenshot (a capture artefact of fixed positioning).
5. Console: not separately audited beyond the page-error assertion in the storage-failure test (no page errors). Not claimed otherwise.
6. Not tested: very long class names (no data fixture; the list item has `break-words`), populated "Tindakan Hari Ini"/peer data (SRS: unobservable, prototype never returns it), real device touch.

## Bugs

| ID | Severity | Steps to reproduce | Expected vs actual | Evidence | Suspected owner |
|---|---|---|---|---|---|
| BUG-L07-01 | Medium | Log in as admin (or guru), open `/guru`, read the "Soalan" stat card caption | Expected (AC-M10-04.1/04.2, EL-M10-S1-043, live inventory `docs/discovery/inventory/M10/S1-guru-dashboard.json` line 1090): text "✅ 19361 diluluskan" (guru: "✅ 1 diluluskan"). Actual: the literal "✅" is replaced by a lucide `CircleCheck` icon, so the text is "19361 diluluskan". The existing smoke spec asserts only "19361 diluluskan", which hides the gap. No DV entry covers this replacement (CLAUDE.md section 6: replicate exact copy) | Failing test `AC-04.1/04.2 Soalan caption carries the literal "✅" glyph` (3 projects); actual text "Soalan2071919361 diluluskan" | frontend-developer (`components/dashboard/StatCards.vue`: render "✅ " in the caption text, drop the `CircleCheck` icon; or product-analyst if the icon is to be a documented deviation) |

No Critical or High bug. Medium so G5 not passed.

## Known dependencies (not S1 bugs)

- `/guru/misi-harian/cipta` (S12) and `/guru/profil/edit` (S32) are unbuilt (404). Checklist row 3, and the "Edit Profil Guru" tile, point at them as specified.
- `/dashboard`, `/ppd/dashboard`, `/jpn/dashboard` landing routes (used when other roles are redirected away from `/guru`) are unbuilt, so those roles currently end on the 404 page.
- Teacher-derived counts (E2E-M10-07, AC-04.2, AC-05.4) are provisional (INFERRED definitions, DV-M10-12, R-M04-03); they pass against the current seed.

## Notes on test reliability

The run was slow because other sessions share the machine. Tests with the default 5 s expect timeout failed randomly right after boot; this is why `qa-l07-dashboard.spec.ts` configures a 15 s expect timeout. Spec files were not changed by others during my runs. Temp files: `C:\Users\hp\AppData\Local\Temp\claude\d--Dev-Projects-pretasiplus-app\b18204ce-e23b-4755-b5c3-be74bfd73dd7\scratchpad\l07-qa-guru\` (logs, JSON results).
