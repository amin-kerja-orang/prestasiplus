# QA report: M10 Teacher Class (G5)

Scope: L13 Kelas Saya (S33 `/kelas-saya`; S4 `/guru/kelas`, S5 `/guru/kelas/cipta`, S35 404), L31 Set Soalan Guru (S34 `/set-soalan-saya`), L46 Pelajar Saya (S6 `/guru/pelajar`), L49 Sumbang Soalan (S21-S24 `/guru/soalan*`), L06 Command Center, teacher side (S2 `/guru/command-center` and the mounted M17 drill pages under `/guru/command-center/...`).
Date: 2026-10-03. Branch `feature/student-prototype` (worktree). Tester: qa-engineer.
Inputs: URS M10 v1.17, SRS M10 v1.20, M17 SRS v1.15 FR-M17-60 / E2E-M17-70, `docs/AKAUN-DEMO.md`, TRACKER D9, D10, D22, D24.

## Summary

- No Critical, High, Medium or Low product bug found in the M10 scope. Every in-scope AC is Pass (E2E, unit or manual); the ACs marked (P) are provisional (PROPOSED / INFERRED / UNVERIFIED copy), executed as specified, and stay provisional by design.
- M10 E2E: 186 tests (62 per project). First run 185 pass, 1 fail (infrastructure, Playwright trace-file ENOENT, no assertion failure); the same test passed 3/3 on re-run. Net: 186/186 Pass.
- Unit: 24 files, 329 pass, 5 todo, 0 fail.
- Side finding outside the rows: two M17 board E2E tests fail deterministically at desktop 1280 (see Observations O-1). They belong to M17 S2/S3 (admin / admin sekolah board), not to the teacher mount, and are not counted against these rows.

| Row | Screens | Verdict |
|---|---|---|
| L13 Kelas Saya | S33, S4, S5, S35 | Ready |
| L31 Set Soalan Guru | S34 | Ready |
| L46 Pelajar Saya | S6 | Ready |
| L49 Sumbang Soalan | S21, S22, S23, S24 | Ready |
| L06 Command Center (guru side) | S2 + mounted M17 drill pages | Ready |

## Environment

- Build `npx vite build --mode e2e --outDir dist-e2e-4816`, served by `vite preview --port 4816 --strictPort` (by the Playwright webServer for the main run; a second preview on the same build for manual checks and the re-run). Ports 4173 and 5173 not used. Preview stopped; `dist-e2e-4816`, `test-results-4816` and the scratch config deleted.
- Scratch config = copy of `playwright.config.ts`: port 4816, testDir = repo `e2e`, 1 worker, `fullyParallel: false`, test timeout 120 s, webServer timeout 600 s, outputDir `test-results-4816`; env `E2E_BOOT_TIMEOUT_MS=60000`.
- Chromium; projects mobile 375x812, tablet 768x1024, desktop 1280x800. Manual checks used Playwright MCP lane 2 only, against the local preview (never the live site), at 1280 / 768 / 375 / 320.
- The machine was heavily shared (other QA runs on 4817, 4818 and others in parallel): the E2E run took 1.9 h.
- Accounts used: guru 5, admin 1, pelajar 2, pelajar2 (no class), adminsekolah 8, ibubapa. Mock clock as in the specs.

## Runs

| Run | Command | Result |
|---|---|---|
| E2E (6 M10 spec files; the pattern `smoke-command-center` also matched the two M17 files `smoke-command-center-board` and `smoke-command-center-drill`, which ran too) | `npx playwright test -c <scratch config> smoke-kelas.spec smoke-pelajar smoke-kelas-saya smoke-set-soalan-saya smoke-soalan smoke-command-center` | Total 324: 318 pass, 3 fail, 3 skipped (the 3 skipped are the M17 test E2E-M17-67, one per project) |
| Re-run of the 3 failures | `... --grep "E2E-M10-08\|E2E-M17-40\|E2E-M17-106"` | 7 pass, 2 fail (see below) |
| Unit | `npx vitest run --project unit src/modules/m10-teacher-class --pool=threads --maxWorkers=1` | 24 files, 329 pass, 5 todo, 0 fail (454 s) |

M10 E2E per project (first run), spec files kelas 9, pelajar 7, kelas-saya 5, set-soalan-saya 5, soalan 19, command-center 17 = 62 tests per project:

| Project | Pass | Fail | Notes |
|---|---|---|---|
| mobile 375 | 61 | 1 | E2E-M10-08 failed on a harness error (below); re-run passes |
| tablet 768 | 62 | 0 | |
| desktop 1280 | 62 | 0 | |
| After re-run | 62 / 62 / 62 | 0 | |

Failure classification:

- Flake (infrastructure): `smoke-command-center.spec.ts` "E2E-M10-08 tab title, no shell, top bar, KPI values, empty panels, insight, footer, 10 s poll", mobile. Error was only `browserContext.close: ENOENT ... test-results-4816\.playwright-artifacts-0\traces\...trace` (trace artifact file missing); no assertion failed. Passed on re-run on mobile, tablet and desktop (3/3), and the mobile run also passed on the other two projects in the first run.
- Real failures, outside M10 scope (M17): `smoke-command-center-board.spec.ts` E2E-M17-40 (S2 admin layout) and E2E-M17-106 / 113 (S2 / S3 admin sekolah alias), desktop only. Both fail with "Aktiviti Hari Ini is not clipped: expected <= 1, received 26" in both runs. See O-1.

## AC table

Method key: E = E2E spec test (executed on all three projects, mapping by SRS §12 number and test title; I did not audit the depth of every assertion), U = unit test in `src/modules/m10-teacher-class/__tests__`, M = manual check on the local preview with lane 2. Provisional ACs are marked (P).

### US-M10-01 Menus and titles

| AC | Verified by | Result |
|---|---|---|
| 01.1 sidebar (admin, 1280) | M: admin sidebar lists "Dashboard Guru" `/guru`, "Kelas Guru" `/guru/kelas`, "Sumbang Soalan" `/guru/soalan`, "Databank Soalan" `/guru/databank`, "Kelas Saya" `/kelas-saya`, "Set Soalan Guru" `/set-soalan-saya` | Pass |
| 01.2 drawer (375 / 768) | M: drawer at 375 shows the M10 groups, "Kelas Saya" + "BARU" `/kelas-saya`, "Command Center LIVE" `/guru/command-center`, Dashboard Guru, Misi Harian, Pelajar Saya, Sumbang Soalan etc. Screenshot `.playwright-mcp/lane2/m10-drawer-375.png` | Pass |
| 01.3 header title and subtitle | M: S4 "Portal Guru" / "Urus kelas dan tugasan anda", S5 "Cipta Kelas Baru" / "Isi butiran kelas anda", S6 "Pelajar" / "Urus pelajar dalam kelas anda", S21 "Sumbang Soalan" / "Sumbangan anda kepada bank soalan kebangsaan PrestasiPlus", S22 "Tambah Soalan Baru" / "Sumbangkan soalan untuk pelajar Malaysia", S23 "Detail Soalan" and S24 "Edit Soalan" / "Selamat datang kembali", S33 "Kelas Saya" / "Sertai kelas guru anda", S34 "Set Soalan Guru" / "Set soalan yang disediakan oleh guru anda" (all equal FN-M10-1.1.3). Also E for S4, S6, S21, S33, S34 | Pass |
| 01.4 | Not in scope (S3, S17-S20, S25, S26, S29-S31) | n/a |

### US-M10-02 Access and error pages

| AC | Verified by | Result |
|---|---|---|
| 02.1 guest to `/login` (P) | E: guest tests in smoke-kelas, smoke-pelajar, smoke-kelas-saya, smoke-set-soalan-saya, smoke-soalan, smoke-command-center | Pass |
| 02.2 `/settings`, `/guru/3` 404 page | M (guru): exact copy "404", "🔍", "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", links `/` and `/practice`, "PRESTASIPLUS"; tab title "404 - Halaman Tidak Dijumpai \| PRESTASIPLUS" | Pass |
| 02.3 `/guru/set-soalan/1`, `/guru/broadcast/1` | M: same 404 page | Pass |
| 02.4 qr-data 404 (admin, class not owned); teacher `/guru/kelas/2001/edit`, `/guru/live-kelas/cipta` 404 page | U: guru-handlers.test `qr-data` (admin and unknown class 404); M: both teacher URLs and `/guru/kelas/2001` render the 404 page; E: smoke-kelas "#02 /guru/kelas/:id and /edit render the 404 page" | Pass (qr-data at unit level only, the mock API is not reachable over HTTP) |

### US-M10-06 / 07 / 08 / 09 / 10 Command Center (S2)

| AC | Verified by | Result |
|---|---|---|
| 06.1 admin layout, tab title, top bar, KPIs | E: E2E-M10-08 | Pass (mobile flake, then pass) |
| 06.2 empty panels, insight, footer | E: E2E-M10-08 | Pass |
| 06.3 responsive 1 / 2 / 4 per row, links reachable, LIVE and clock, text >= 12 px | E: E2E-M10-09; M: guru S2 at 1280 / 768 / 375 / 320 no horizontal scroll (scrollWidth <= viewport; page scrollbar takes 15 px at 1280, 768 and 375 as designed) | Pass |
| 06.4 guru KPIs 8 / 0 aktif / 83, class rows (P) | E: E2E-M10-10; M: tab title "Command Center — Guru: Guru Demo" | Pass |
| 06.5 10 s poll, clock | E: E2E-M10-08 (poll part) | Pass |
| 07.1 "Pelajar Berdaftar" modal loading then "Tiada data" | E: E2E-M10-11 | Pass |
| 07.2 "GPS Sekolah", T1, mood titles | E: E2E-M10-11 | Pass |
| 07.3 guru drill table, 8 rows "Login", row opens mounted M17 S7 in a new tab (P) | E: E2E-M10-12, 12b, E2E-M17-70; M: `/guru/command-center/student/3001` titled "Murid Demo 01 - Command Center", `/guru/command-center/classroom/2001` titled "5 MARIKH - Kimia - Command Center", breadcrumb Guru Demo, no overflow at 1280 / 375 / 320 | Pass |
| 07.4 close by "×" and backdrop | E: E2E-M10-11 | Pass |
| 08.1 class summary (admin) | E: E2E-M10-13 | Pass |
| 08.2 SPM prediction (admin) | E: E2E-M10-13 | Pass |
| 08.3 class table guru (P) | E: E2E-M10-14, 14b, 14c | Pass |
| 09.1 Remedial admin | E: E2E-M10-15 | Pass |
| 09.2 Remedial guru table, actions (P) | E: E2E-M10-16 | Pass |
| 09.3 "Jana Kimia" states (P) | E: E2E-M10-16 | Pass |
| 09.4 "Batal & Jana Semula" (P) | E: E2E-M10-16 | Pass |
| 09.5 `failNext` scan, "Ralat memuatkan data. Sila cuba semula." (DV-M10-44) | E: E2E-M10-15 | Pass |
| 10.1 Evaluate admin (P) | E: E2E-M10-17 | Pass |
| 10.2 Badges admin (P) | E: E2E-M10-17 | Pass |
| 10.3 Evaluate and Badges guru (P) | E: E2E-M10-17 | Pass |

### US-M10-12 / 13 / 14 / 15 Classes (S4, S5)

| AC | Verified by | Result |
|---|---|---|
| 12.1 admin empty list | E: smoke-kelas "#20" | Pass |
| 12.2 guru two cards (P) | E: smoke-kelas "#21 guru: 2 kelas aktif, two cards, cards per row by width" | Pass |
| 13.1 QR modal (P) | E: smoke-kelas "#21 QR modal: spinner then name and school, canvas 192px, URL" | Pass |
| 13.2 copy "Disalin!", Cetak, Tutup | E: same test | Pass |
| 14.1 form fields, 31 subjects in id order, 11 tiles | E: smoke-kelas "#22 fields ..." | Pass |
| 14.2 school search (1 char no request, "de", "zzz") | E: smoke-kelas "#22 school search" | Pass |
| 14.3 level tiles follow school type | E: same | Pass |
| 14.4 no required radios | E: "#22 fields ... no required radios" | Pass |
| 15.1 native required message, no request | E: smoke-kelas "#23" | Pass |
| 15.2 create "5 Bestari", 3 kelas aktif, unique code (P) | E: smoke-kelas "#24" | Pass |

### US-M10-16 Students (S6)

| AC | Verified by | Result |
|---|---|---|
| 16.1 admin counter, tabs, empty card, "Cipta Pelajar" returns to `/guru/pelajar` | E: smoke-pelajar "#25" (two tests) | Pass |
| 16.2 admin school tab | E: smoke-pelajar "#25 admin school tab" | Pass |
| 16.3 375 label "Cipta" | E: smoke-pelajar "#25 admin: counter, link label" | Pass |
| 16.4 guru 8 rows, school tab, add pelajar to 2002 gives 9 (P) | E: smoke-pelajar "#26" (three tests incl. remove after confirm) | Pass |

### US-M10-17 Join (S33)

| AC | Verified by | Result |
|---|---|---|
| 17.1 field, maxlength 6, empty texts | E: smoke-kelas-saya "E2E-M10-27"; M: pelajar2 text "Masukkan Kod Kelas / Sertai / Belum Sertai Mana-Mana Kelas / Minta kod kelas daripada guru anda dan masukkan di atas" | Pass |
| 17.2 join DMO101 (P) | E: "E2E-M10-28" | Pass |
| 17.3 unknown code refused (P) | E: "E2E-M10-28" | Pass |
| 17.4 teacher `POST /api/kelas-saya/join` gives 403 (P) | U: KelasSayaPelajarPage.test, guru-handlers.test; E: "E2E-M10-03 a teacher is not served the student page". The mock API is in-process, so no HTTP call from the browser | Pass (unit level) |

### US-M10-27 Student set list (S34)

| AC | Verified by | Result |
|---|---|---|
| 27.1 empty state | E: smoke-set-soalan-saya "E2E-M10-47" (two tests); M: pelajar2 text "Tiada Set Soalan / Guru anda belum sediakan set soalan untuk anda." | Pass |
| 27.2 after joining DMO102 set 7402 listed, draft 7401 not (P) | E: "E2E-M10-48" | Pass |

### US-M10-33 to 39 Sumbang Soalan (S21-S24)

| AC | Verified by | Result |
|---|---|---|
| 33.1 admin stats, tiers, target | E: smoke-soalan "#57" | Pass |
| 33.2 subject breakdown order | E: "#57" | Pass |
| 33.3 guru anchors 1/1/0/0 and fixture 700301 (P) | E: "#58 default seed anchors" | Pass |
| 34.1 template download | E: "#59 template download and the import form" | Pass |
| 34.2 import form toggles | E: "#59" | Pass |
| 34.3 CSV import, one invalid row (P) | E: "#60 imports a 2-row CSV" | Pass |
| 34.4 audio links, AI card static, template files | E: "#59" (ai-card text); M: links `/guru/audio-kbat/template`, `/template-word`, `/create`, list; "Template XLSX" downloads `template-audio-kbat.csv` (BOM, header `tajuk,kod_subjek,kod_tingkatan,nama_fail_audio`, one example row), "Template Word" downloads `template-audio-kbat.docx` (valid zip, table with the four headings); U: guru-handlers #63 | Pass |
| 35.1 admin cards, first #522425 | E: "#57" | Pass |
| 35.2 card opens, Edit / Padam | E: "#57" | Pass |
| 35.3 delete confirm, cancel, confirm on 700302 (P) | E: "#58 ... delete 700302" | Pass |
| 35.4 pager 1 to 20 of 16817, page 2 | E: "#57", "observed anchors" | Pass |
| 36.1 paper form texts, options, limits | E: "#61 Hantar Kertas texts"; M: form fields confirmed (jenis_soalan, subject, tingkatan, tahun, disediakan_oleh, catatan, files[]) | Pass |
| 36.2 file list with icon, name, MB | E: "#61" | Pass |
| 36.3 paper appears in M04 as Pending (P) | U: guru-handlers (paper test, `GET /api/question-submissions` as admin contains the id, status pending) | Pass (unit level) |
| 36.4 empty year falls back to clock, success and failure copy (P) | M: Trial Paper / Kimia / Tingkatan 5 with a PDF and empty Tahun shows "Kertas soalan berjaya dihantar kepada admin."; U: `#60 an empty level, year and note are optional`. The failure copy "Gagal menghantar kertas soalan." and the empty "Belum ada soalan." were not executed in the browser | Pass (success and year at M/U; failure copy not executed, see O-5) |
| 37.1 S22 fields, difficulty, default MCQ | E: "#63 S22 fields" | Pass |
| 37.2 type blocks | E: "#63" | Pass |
| 37.3 Arab / Jawi keyboard | E: "#63" | Pass |
| 37.4 diagram gallery empty | E: "#63" | Pass |
| 37.5 Batal, no scroll at 375 | E: "#63"; M: S22 at 1280 / 768 / 375 / 320 no horizontal scroll | Pass |
| 37.6 send valid MCQ gives Menunggu 1 (P) | E: "#64 and #66 teacher creates an MCQ" | Pass |
| 38.1 detail of 522425 | E: "#65 S23 and S24 of 522425" | Pass |
| 39.1 edit form, "Sukar" preselected | E: "#65" | Pass |
| 39.2 edit own question (P) | E: "#64 and #66 ... then edits it" | Pass |

### US-M10-48 Responsive and readable

| AC | Verified by | Result |
|---|---|---|
| 48.1 no horizontal scroll, in-scope screens at 375 / 768 / 1280 | E: width checks inside the specs (all three projects); M: scrollWidth versus viewport at 1280 / 768 / 375 / 320 for guru S4, S5, S6, S21, S22, S2 and the two mounted drill pages, admin S23 / S24 headers, pelajar2 S33, S34: no page scrolls sideways (scrollWidth = viewport, or viewport minus the 15 px scrollbar) | Pass |
| 48.2 text >= 12 px (S21, S2 with modal) | E: E2E-M10-09 (S2); M: no text node under 12 px in `main` on guru S21, S22, S4, S6, S33, S34 and the mount pages at all widths | Pass |
| 48.3 forms stack in one column at 375 (S5, S22) | E: "#22", "#63"; M: S5 and S22 at 375 and 320 within width | Pass |

### Cross-cutting checks (roles, D10, D22, privacy)

| Check | Verified by | Result |
|---|---|---|
| Role refusals, pelajar | M: on `/guru/kelas`, `/guru/kelas/cipta`, `/guru/pelajar`, `/guru/soalan`, `/guru/soalan/cipta`, `/guru/command-center`, `/guru/command-center/student/3001` the URL becomes the landing `/dashboard`; `/kelas-saya` and `/set-soalan-saya` open | Pass |
| Role refusals, adminsekolah 8 | M: all 9 routes (the 7 above plus `/kelas-saya`, `/set-soalan-saya`) refused, land on `/dashboard`. Also ibubapa: all 9 refused | Pass (SRS §9 INFERRED) |
| Guru 5 and admin 1 | M and E: open S4, S5, S6, S21-S24, S2, mount; guru gets 404 on admin-owned #522425 (own-question rule, E "#65 a question that is not own is the 404 page") | Pass |
| D10 no added ARIA | M: no `role` or `aria-*` attributes in `main` on guru S2 mount, S4, S5, S6, S21, S22, pelajar2 S33, S34 once loaded. Source shows `role="status"` on loading spinners of S21, S23, S24 and the import card (transient states only) | Pass, see O-3 |
| D22 no generated media | M and source: no image, audio or video assets in `src/modules/m10-teacher-class`; the QR is a canvas drawn at runtime (E "#21 QR modal ... canvas 192px"); the only media-like string is the template example filename `kbat-sains-1.mp3` | Pass |
| Privacy | Source and UI: only fictitious names (Admin Demo, Guru Demo, Murid Demo 01-08, "SMK DEMO"); classes "5 MARIKH - Kimia" / "Sejarah"; no real person name found in M10 mock seeds, pages or the pages I opened. The M04 question text and tier names were not audited for names (M04 scope) | Pass |

## Bugs

None found in the M10 scope.

## Observations (not bugs against these rows)

- O-1 (M17 board, outside the five rows; suggested severity High for the M17 gate, to be triaged by M17 QA and the M17 frontend owner): `e2e/m17-admin-dashboard/smoke-command-center-board.spec.ts` E2E-M17-40 and E2E-M17-106/113 fail on the desktop project (1280x800): "Aktiviti Hari Ini is not clipped", panel `scrollHeight - clientHeight` = 26 px, reproduced in the first run and in the re-run, not on mobile or tablet. Evidence: `test-results-4816` (deleted with the run; reproduce with `npx playwright test <config> smoke-command-center-board --project=desktop -g "E2E-M17-40"`). Caveat: the spec file changed between my two runs (the failing tests moved from line 249 to 279 and 528 to 559), so another agent is editing it and the build under test may not match that edit. The teacher mount (drill pages S4-S7 of M17 under `/guru/command-center`) is not affected: its drill specs all passed. My attempt to open `/admin/command-center` manually timed out waiting for "Aktiviti Hari Ini" (admin shell), so I have no screenshot of the clip.
- O-2 (outside M10): after login, guru, pelajar, adminsekolah and ibubapa land on `/dashboard`, which shows the 404 page; admin lands on `/admin`, also 404 (AKAUN-DEMO says these screens are not built yet). Because refused roles are sent to that landing page, the M10 role-refusal ACs visibly end on a 404 page. Owner: whoever owns the student/admin landing pages (M05 / M17).
- O-3 (Low, needs a live baseline to decide): `role="status"` is set on the loading placeholders of S21 (`SumbangSoalanPage.vue` lines 93 and 128), S23 (`SumbangSoalanDetailPage.vue` 54), S24 (`SumbangSoalanEditPage.vue` 128) and `ImportCard.vue` 101. Live S21-S24 are server-rendered, so a loading state does not exist there; D10 says no added ARIA. Not visible once loaded. Owner: frontend-developer, decision for the Delivery Lead.
- O-4 (outside M10): the app shell requests `/favicon.ico` and gets 404, one console error on every page load.
- O-5 (coverage notes): AC-17.4 (join 403 for a teacher), AC-02.4 qr-data and AC-36.3 are verified at unit/handler level because the mock API is in-process; AC-36.4 failure copy "Gagal menghantar kertas soalan." and the empty "Belum ada soalan." were not executed in the browser (the empty copy has no E2E, the failure path is not reachable without a hook I did not use).
- O-6: the provisional ACs (PROPOSED / INFERRED / UNVERIFIED) pass as specified; they cannot be confirmed against the live site and remain provisional.
- O-7: the first E2E-M10-08 failure shows the run is sensitive to heavy machine load (trace files lost under concurrent runs). Re-run once to confirm any single red.

## Verdict: READY (all five rows)

- L13 Kelas Saya: Ready
- L31 Set Soalan Guru: Ready
- L46 Pelajar Saya: Ready
- L49 Sumbang Soalan: Ready
- L06 Command Center, guru side: Ready

Reasons: every in-scope AC executed and Pass, no open Critical or High bug in M10, unit suite green, all E2E green on mobile, tablet and desktop after one infrastructure flake was re-run. The M17 board desktop failures (O-1) do not block these rows but should be resolved or triaged by M17 before its own G5.
