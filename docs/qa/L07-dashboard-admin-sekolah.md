# L07 Dashboard Sekolah (M27 S0, `/admin-sekolah`) - G5 QA

Date: 2026-10-09. Branch: feature/student-prototype (S0 code uncommitted in the main checkout). Slug: L07-dashboard-admin-sekolah (roles-matrix row L07, Admin Sekolah part). Inputs: SRS M27 v1.8 S0 sections (FR-M27-01..37, BR-M27-01..18, sections 9, 10, 12 E2E-M27-01..34), URS AC-M27-01.1 to 11.3 (51 ACs). G4 was Approved.

**Verdict: READY (G5 Pass), no open Critical/High/Medium/Low bug.** Every executable AC passed on mobile 375, tablet 768 and desktop 1280 (320 px checked on mobile). Two ACs are not executed and recorded as deferrals, not failures: AC-03.5 (needs an admin session to post four perutusan, E2E-M27-11) and AC-04.2 (`/perutusan`, M09-T4, out-of-1.0 deferral by DL decision).

## Environment
Own config `playwright.5143.config.mjs` (copy of `playwright.5141.config.mjs`, port, `dist-e2e-5143`, `test-results-5143`, workers 1, 60 s expect), vite build `--mode e2e` and `vite preview` on 5143 started by the Playwright webServer. `E2E_BOOT_TIMEOUT_MS=90000`. 4173, 5173 and live untouched; no node/vite/playwright process was killed. After the runs the config, `dist-e2e-5143` and `test-results-5143` were deleted and port 5143 was confirmed free. No worktree, junction, install or stash was used. No source file was changed.

## Commands and counts
| Run | Command | Result |
|---|---|---|
| Type-check | `npx tsc --noEmit -p tsconfig.e2e.json` (run before and after the spec fixes) | 0 errors both times |
| Run 1 (smoke + QA spec, 3 projects) | `E2E_BOOT_TIMEOUT_MS=90000 npx playwright test -c playwright.5143.config.mjs e2e/m27-school-admin/smoke-dashboard.spec.ts e2e/m27-school-admin/qa-l07-dashboard.spec.ts --workers=1` | 186 tests: 164 passed, 15 skipped, 7 failed (3.8 h) |
| Run 2 (re-run of the 7 failed) | `E2E_BOOT_TIMEOUT_MS=90000 npx playwright test -c playwright.5143.config.mjs e2e/m27-school-admin/qa-l07-dashboard.spec.ts --workers=1 -g "loading state\|error states\|sidebar \"Dashboard\" is active"` | 9 tests: 7 passed, 2 skipped (sidebar test is desktop-only) |

Net: 171 passed, 0 failing on the latest run. Run 1 contributed 164 passes, and the 7 failures were re-run and passed in run 2 (the 3 desktop-skipped sidebar variants stay skipped by design).

### The 7 run-1 failures were spec mistakes, not app defects (spec fixed, source untouched)
| Test (x3 projects) | Cause | Fix in `e2e/m27-school-admin/qa-l07-dashboard.spec.ts` |
|---|---|---|
| loading state | `setLatency` was armed, then `gotoApp` reloaded the page, which drops the latency; the page loaded with no spinner | arm the latency and enter S0 by in-app navigation (`spaGoto`), as the smoke spec does |
| error states | same: `networkErrorNext` / `failNext` lost on reload | navigate away and back in-app after arming |
| sidebar active only on S0 (desktop) | `/admin-sekolah/command-center` uses the M17 full-screen layout without the user sidebar | use `/admin-sekolah/monitoring` (user shell), as smoke E2E-M27-01 does |

### Skips in run 1 (15)
By design: E2E-M27-01 on 375/768 and E2E-M27-02 on 1280 (breakpoint-specific); E2E-M27-21 on 375/768 (request-only, runs once on desktop); QA sidebar test on 375/768; QA 320 px test on 768/1280 (mobile only). Declared skips: E2E-M27-11 (x3) and E2E-M27-13 (x3).

## AC table
"Smoke" = `smoke-dashboard.spec.ts` (E2E id), "QA" = `qa-l07-dashboard.spec.ts`. Result is for mobile / tablet / desktop (all three Pass unless stated).

| AC | Steps (summary) | Result | Evidence |
|---|---|---|---|
| 01.1 | azlan at 1280: user shell, sidebar, "Dashboard" the only active item, other HARIAN links not active; on `/admin-sekolah/monitoring` present but not active | Pass (1280) | Smoke E2E-01, QA sidebar |
| 01.2 | 375/768: no sidebar, hamburger drawer with "Dashboard" active, no h-scroll | Pass (375, 768) | Smoke E2E-02 |
| 01.3 | header "Dashboard Sekolah", subtitle "SMK Demo Seri Putra", tab "Dashboard Sekolah - PRESTASIPLUS", also after navigating away and back | Pass x3 | Smoke E2E-03, QA tab title |
| 01.4 | avatar "AD", bell, logout (desktop), no chips | Pass x3 | Smoke E2E-03 |
| 01.5 | sidebar "Dashboard" not active on monitoring, active on S0 | Pass (1280) | Smoke E2E-01, QA sidebar |
| 02.1 | banner icon, name (textContent, CSS upper case), "Admin Sekolah" below, state / PPD / code chips with icons | Pass x3 | Smoke E2E-04 |
| 02.2 | click name, chips, banner, cards: URL unchanged, no anchors inside | Pass x3 | Smoke E2E-04, QA clicks |
| 02.3 | suhaimi: only "Johor"; no PPD, no code, no placeholder | Pass x3 | Smoke E2E-05, QA suhaimi |
| 02.4 | no other school name outside banner/header/perutusan/grades; `?school_id` ignored | Pass x3 | Smoke E2E-06 |
| 03.1 | azlan: heading, link, one row "AD", M09 #4 title, "Pengetua · 6 bulan yang lepas" | Pass x3 | Smoke E2E-07 |
| 03.2 | suhaimi row #3 "SM", adminsekolah row #2 "SA" | Pass x3 | Smoke E2E-08, 08b |
| 03.3 | titles of #2 and #3 absent from DOM and endpoint | Pass x3 | Smoke E2E-09 |
| 03.4 | school without perutusan: header present, no row, no empty sentence (also populated school: at most 3 rows) | Pass x3 | Smoke E2E-10, QA Perutusan |
| 03.5 | four national posts give exactly 3 rows | Not executed (needs an admin session; E2E-M27-11 declared skip). Max-3 verified for the populated school only | Smoke skip, QA Perutusan |
| 04.1 | "Lihat semua →" link, target `/perutusan` | Pass x3 | Smoke E2E-12, QA Perutusan |
| 04.2 | click opens M09 list | Deferred (out-of-1.0, DL decision; E2E-M27-13 skip). Not a failure | Smoke skip |
| 05.1 | "← Papan Pemuka", separator, "Dashboard Sekolah", between Perutusan card and banner | Pass x3 | Smoke E2E-14 |
| 05.2 | click goes to `/dashboard`, M05 S1 renders, no 403/404 | Pass x3 | Smoke E2E-15, QA links |
| 05.3 | "Dashboard Sekolah" bold, not a link | Pass x3 | Smoke E2E-14 |
| 06.1 | four cards in order, labels, tints, icon tile top-left, foot bar, not links | Pass x3 | Smoke E2E-16 |
| 06.2 | pupils and teachers equal owner counts, ms-MY format, differ between schools | Pass x3 | Smoke E2E-26 |
| 06.3 | KELAS AKTIF equals owner count | Pass x3 | Smoke E2E-26 |
| 06.4 | azlan "Belum Ada" grey; adminsekolah "Tempoh Ihsan" green under profile `subscriptions-extra`; "Tamat" (school 8107) is covered by the handler unit test per the lead, not executed in this E2E run | Pass x3 (Belum Ada, Tempoh Ihsan); Tamat by unit test (referenced, not re-executed here) | Smoke E2E-27 |
| 06.5 | cards are not links, one value each | Pass x3 | Smoke E2E-16, QA clicks |
| 07.1 | guest goes to `/login` | Pass x3 | Smoke E2E-17 |
| 07.2 | admin: 403 page, exact copy, links | Pass x3 | Smoke E2E-18 |
| 07.3 | guru, pelajar (smoke); pelajar2, ibubapa, penaja, ppd, jpn (QA): 403 page, no S0 data, no h-scroll | Pass x3 (7 roles) | Smoke E2E-18, QA AC-07.3 |
| 07.4 | school_admin with null school (`seedSchoolAdminWithoutSchool`): 403, no school text, no cards, endpoint 403 only | Pass x3 | Smoke E2E-19, QA AC-07.4 |
| 07.5 | `?school_id` / `schoolId` ignored (azlan 900003, adminsekolah 900001); `/admin-sekolah/pilih-sekolah` (also with slash and query) gives 404 page with exact copy | Pass x3 | Smoke E2E-20, E2E-06, QA AC-07.5 |
| 07.6 | endpoint: guest/refused role make no call, school admin gets 200 GET with no `school_id` | Pass (1280, request-only) | Smoke E2E-21, QA AC-07.4 |
| 08.1 | no horizontal scroll and nothing past the right edge (populated, azlan, suhaimi); 320 px also | Pass x3, 320 px Pass | Smoke E2E-22, QA presentation |
| 08.2 | every text >= 12 px (populated, azlan, suhaimi; 320 px) | Pass x3 | Smoke E2E-23, QA presentation |
| 08.3 | chips wrap at 375, long titles wrap | Pass x3 | Smoke E2E-22 |
| 08.4 | cards 4/4/2 per row, panels 4/2/1 per row, grade list inside its card | Pass x3 | Smoke E2E-22 |
| 08.5 | endpoint 500: error box, no data (also network error): no data, no h-scroll | Pass x3 | Smoke E2E-24, QA error states |
| 08.6 | static privacy scan (CHK-M27-01) and page text contains no real name or deck data | Pass (page text has no `undefined`/`NaN`/`null`, no deck school; CHK-M27-01 is a unit test not run in this E2E task) | QA no-leak test |
| 09.1 | sidebar / drawer "Dashboard" opens S0 | Pass x3 | Smoke E2E-25 |
| 09.2 | M17 "← Dashboard" opens S0 | Pass x3 | Smoke E2E-25 |
| 10.1 | card title, subtitle, panel order and labels (upper case by CSS), tints | Pass x3 | Smoke E2E-28 to 31, QA panel order |
| 10.2 | GPS equals M08 (2 dec.), "{grade} · {band}", "{n} entri headcount" | Pass x3 | Smoke E2E-28 |
| 10.3 | no-data school: "—", no grade line, "0 entri headcount" | Pass x3 | Smoke E2E-33 |
| 10.4 | AMARAN AWAL Selamat / Berhati / Berisiko equal M18 tallies, "{n} murid dinilai" = sum (populated school and fixture) | Pass x3 | Smoke E2E-29, QA AC-10.4 |
| 10.5 | LATIHAN "{p}%", "Purata Ketepatan", "{n} sesi · {m} soalan" equal M08 | Pass x3 | Smoke E2E-30 |
| 10.6 | no-data: "—", "0 sesi · 0 soalan" | Pass x3 | Smoke E2E-33 |
| 10.7 | TINGKATAN: two rows, M08 accuracy, band colour, bar width, "Click untuk detail" | Pass x3 | Smoke E2E-31 |
| 10.8 | grade list A+..G equals M08 distribution, "Jumlah: {n} rekod" | Pass x3 | Smoke E2E-32 |
| 10.9 | no-data: zeros, "Jumlah: 0 rekod" | Pass x3 | Smoke E2E-33 |
| 10.10 | figures belong to the viewer's school and change with another school admin | Pass x3 | Smoke E2E-34 |
| 11.1 | "Lihat penuh →" target `/prestasi/sekolah`, click opens M08 S1 | Pass x3 | Smoke E2E-32, QA links |
| 11.2 | TINGKATAN panel is a link; click opens `/prestasi/tingkatan` | Pass x3 | Smoke E2E-31, QA links |
| 11.3 | S0 GPS, entries, sessions, questions, accuracy equal M08 S1 | Pass x3 | Smoke E2E-34 |

Count: **49 of 51 ACs Pass (including 06.4 with "Tamat" by the referenced unit test), 0 Fail, 2 not Pass: AC-03.5 not executed (needs admin session) and AC-04.2 deferred (out of 1.0).** Neither blocks G5 under the lead's decision.

## Non-functional and exploratory checks
| Check | Result |
|---|---|
| No horizontal scroll and no element past the right edge, 375/768/1280, three school types | Pass |
| 320 px (mobile project): no h-scroll, banner / cards / performance / grades inside 320 px, text >= 12 px | Pass |
| Text >= 12 px (azlan, suhaimi, populated school 1214) | Pass x3 |
| Loading state (2.5 s latency): spinner only, no banner and no error, then page | Pass x3 |
| Error states: network error and HTTP 500 show the error box, no cards or performance, no h-scroll | Pass x3 |
| Console and page errors while loading S0 and following the TINGKATAN link | Pass x3 (none) |
| Placeholders: no "undefined", "NaN", "null", "[object" in the page text for 4 accounts | Pass x3 |
| Privacy: the doc and spec name no deck/screenshot school; the QA spec asserts only fixture schools | Pass |
| Touch targets: SRS M27 S0 states no touch-target rule (replicate live, D10), so heights are observations only. The QA test asserts the TINGKATAN panel is >= 44 px (Pass x3). Heights of the other links (crumb, "Lihat semua →", "Lihat penuh →") are attached as test annotations; the list reporter did not print them, so no values are reported here | Observation, no defect |
| Evidence images (live capture and SERVER-DECK `ss-admin.png`) | Not re-opened in this run; copy and structure were checked through the SRS and the smoke assertions that quote them. A visual side-by-side was not done |

## Bugs
None. No Critical, High, Medium or Low defect found in S0. The 7 run-1 failures were test mistakes (table above).

## Known deferrals and dependencies
- `/perutusan` (M09-T4) is not built: "Lihat semua →" renders and has the right target, but opening it is deferred (out of 1.0). Owner: M09.
- AC-03.5 / E2E-M27-11 needs an admin session that posts four national perutusan; not executed. Max 3 rows is verified only on existing seeds. Owner for the follow-up: M09 / QA when an admin-session helper exists.
- "Tamat" for LANGGANAN (school 8107) is covered by the M27 handler unit test (reported by the lead), not by an E2E case here.
- Provisional ACs (01.2, 01.3, 02.3, 03.4, 05.2, 06.4, 08.5, 10.3, 10.6, 10.8, 10.9, 11.2) are INFERRED / PROPOSED items; they passed and match the SRS wording.
- Populated school 1214 (school 8078) loads slowly on first request (about 1 min per test on this machine); a 60 s expect timeout was needed. The M08 cache is merging separately, so this is performance only.

## Files
- Regression spec (kept, 3 projects, typechecks clean): `D:\Dev Projects\pretasiplus-app\e2e\m27-school-admin\qa-l07-dashboard.spec.ts`
- Existing smoke spec (not modified): `D:\Dev Projects\pretasiplus-app\e2e\m27-school-admin\smoke-dashboard.spec.ts`
- This report: `D:\Dev Projects\pretasiplus-app\docs\qa\L07-dashboard-admin-sekolah.md`
- Logs: scratchpad `l07-qa-as\run1.log`, `run2.log`. Screenshots: none needed (no defect).
