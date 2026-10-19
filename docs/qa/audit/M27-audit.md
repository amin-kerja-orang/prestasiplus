# M27 — School Admin Portal, S0 "Dashboard Sekolah" (`/admin-sekolah`) — Independent G1 Audit (round 1)

| Field | Value |
|---|---|
| Documents audited | `docs/requirements/urs/M27-school-admin.md` v1.0 (9 stories, 25 FN, 36 AC), `docs/requirements/srs/M27-school-admin.md` v1.0 (29 FR, 11 BR, 25 E2E + CHK-M27-01) |
| Evidence | `docs/discovery/L07-dashboard-admin-sekolah.md`, `docs/discovery/M27-school-admin.md`; the screenshot `roles-matrix/admin sekolah/WhatsApp Image 2026-09-26 at 12.04.10.jpeg` (viewed); repository `src/` (grep) for every fixture id, store function, route and nav entry cited; M08, M09, M11, M12, M17 SRS for cross-module rules. Live is unobservable (D24); no live access was used. |
| Auditor | independent audit agent (not an author). Read-only except this report. |
| Date | 2026-10-03 |

## Verdict: **FAIL**

| Severity | Count |
|---|---|
| Critical | 0 |
| Major | 2 |
| Minor | 9 |
| Info | 3 |

Verdict rule (as in the M17 audit): any open Major = FAIL. Both Majors are fixable in the documents without new evidence.

## What is good (verified)

- **Counts are exact.** 25 FN (4+5+5+1+3+2+4+1), 36 AC, 9 stories, 29 FR, 25 E2E, 8 provisional (03, 05, 10, 11, 13, 15, 16, 24). Every AC maps to an E2E or CHK-M27-01; every FR has an AC; every story has FR and E2E in SRS §3.1. No unknown FN or FR is cited.
- **Screenshot-visible elements are covered with exact copy.** "Perutusan Terkini", "Lihat semua →", "Pengetua · {n} bulan yang lepas" (the capture reads "6 bulan yang lepas"), "← Papan Pemuka", "Dashboard Sekolah" (current, bold), "Admin Sekolah", "Selangor", "PPD HULU LANGAT", "# Kod:", hamburger / bell / avatar / logout, the gold icon, the dark card, the red banner, the building icon, and the four tinted slots (blue, teal, pink/red, green) with icon tiles at top-left. Order (card, breadcrumb, banner, slots) matches the capture.
- **No stat-card label or figure is invented.** Slots are empty, tagged PLACEHOLDER/PROPOSED (FR-M27-23, 24; AC-06.x; BR-M27-07; no API field).
- **Fixtures and contracts exist in `src/`:** M02 fixture schools 900001/900002/900003 with the exact name, state, district and code (`schools-anchors.ts:62-89`); `schoolsRepo.get` serves fixtures; users 3102/3103/3104 with the cited names, school ids and `ppdDistrict` (`users-anchors.ts:376-399`); canonical user 8 `adminsekolah@demo.test` at 900001 (`accounts.ts:163`); admin 1, guru 5 and pelajar 2 exist; `perutusanRepo.list(viewer)` (pinned first, then newest; visibility rule `perutusanVisibleTo`), `roleLabelOf` (`school_admin` → "Pengetua"), `initialsOf` (first two words); M09 seeds #2/#3/#4 with schools 900001/900002/900003 and authors 3103/3104/3102; school 8090 has exactly one school admin (`users-store.test.ts:186`). Relative time: #2/#3/#4 are 6 months and 7-9 days before 2026-09-25 = "6 bulan yang lepas" (floor, M09 BR-M09-09). Initials AD / SA / SM are correct.
- **Nav and links that resolve:** `user-nav.ts:369` "Dashboard" → `/admin-sekolah` (exact-active via `admin-nav.ts:597`), HARIAN items present, M17 `board-copy.ts:11` "← Dashboard", `/admin-sekolah/command-center`, `/monitoring`, `/kirkpatrick` routes built, global 403/404 outcome exists (`src/app/router/outcome.ts`, `onForbidden: '403'`), M01 landing `school_admin` → `/dashboard` (`landing.ts:24`, BR-07).
- **Access rules agree with M17** (FR-M17-102, 104, 105, 112; BR-M17-34 exists at M17 SRS line 300): 403 in place for the platform admin and all other roles, no school = 403, school never taken from the request. The M11 and M12 alias rules concern different routes and do not conflict (M11 FR-M11-88 / BR-M11-35, M12 FR-M12-94 / BR-M12-35; both force the session school).
- **Deviation DV-M27-01** correctly applies D9 to the live 302 → 500; DV-M27-02 correctly refuses the server defect. Responsive table (SRS §10), 12 px rule, security notes and test hooks are present. Tags OBSERVED/INFERRED/PROPOSED are used honestly for header, tab title, breadcrumb target, empty state, max 3 rows and chip omission.

## Findings

| ID | Severity | Doc and section | Issue | Required fix |
|---|---|---|---|---|
| AUD-M27-01 | **Major** | SRS FR-M27-27, NFR-M27-04, E2E §12 CHK-M27-01; URS FN-M27-1.7.3, AC-M27-08.6 | The static check "the screenshot's school name, code and post title appear in no source, seed or doc file" cannot pass and contradicts the specified fixtures. (a) The post title "Video Ucapan Selamat Hari Raya 2026" is M09 seed #3 (`src/modules/m09-content/mock/data/content.ts:162`) and AC-M27-03.2 / E2E-M27-08 require that very row to render for `suhaimi@demo.test`; it is also in M09 URS/SRS and 748 matches of the three strings sit in 46 files under `docs/`. (b) "PANDAN INDAH", the screenshot school, is an observed public anchor (M02 school 8090) quoted in M17 tests (`command-center-live*.test.ts`) and M17/M18 docs. (c) The empty-perutusan persona in URS §1.4, SRS §6.2 and AC-M27-03.4 / E2E-M27-10 is the admin of school 8090, so the banner for that persona prints the screenshot school's real name. (d) The discovery file `L07-dashboard-admin-sekolah.md` line 55 itself writes the post title, against its own privacy section. | Redefine the rule and the check: the check scans M27-owned files only (M27 URS/SRS, M27 tests, any M27 seed) for the screenshot school code and the exact name/title as written in the screenshot, and states explicitly that the existing M02/M09/M17 observed public anchors (including the M09 #3 title and school 8090) are exempt and owner-managed. Either keep persona 8090 and record that its banner shows an observed public M02 name, or choose a different empty-feed school. Remove the title from `L07` discovery line 55 (replace with "{post title}"). Update AC-M27-08.6, FR-M27-27, NFR-M27-04 and CHK-M27-01 accordingly. |
| AUD-M27-02 | **Major** | SRS §2.1 row "← Papan Pemuka" → `/dashboard`; BR-M27-11; URS DL-3, AC-M27-05.2, E2E-M27-15 | The SRS states `/dashboard` "**yes** (M05 S1, `m05-practice/routes/dashboard.ts`)". Verified false: that file is an empty route fragment (`const routes: RouteRecordRaw[] = []`, "M05-T3 ... the UI task fills it"). The only `/dashboard` route today is the dev PreviewHub (`src/app/router/core-routes.ts:132`, `access: 'auth'`, no role list). Whether M05 S1 admits `school_admin` is unverified: L07 discovery §7 and OQ-L07-04 flagged it, and the SRS dropped it. Other modules already point their "← Papan Pemuka" at `/dashboard` (M08 `AnalisaItem*Page.vue`, `analisaItemTarget`), which supports the choice but does not make it exist. | Correct §2.1: `/dashboard` is a dependency (M05-T3 not built; today a dev preview stub). Add an XR (to M05) that S1 admits `school_admin` without a redirect, add it to OQ-M27-02, and mark AC-M27-05.2 / E2E-M27-15 `@blocked-by M05-T3` (as done for M09-T4). |
| AUD-M27-03 | Minor | SRS FR-M27-20; URS FN-M27-1.5.2, AC-M27-02.1 | The screenshot shows a pin glyph before the state chip and a separate small icon before the "PPD HULU LANGAT" chip. The spec writes "📍 {state}" as an emoji (not confirmable from a small glyph) and the PPD chip with no icon. OQ-M27-05 mentions "exact icons" but the FR is stated as OBSERVED. | State that the state chip and the PPD chip each carry a leading icon (type unreadable, PROPOSED), or tag "📍" as INFERRED. Keep the "# Kod:" chip as text. |
| AUD-M27-04 | Minor | URS FN-M27-1.6.1; SRS FR-M27-23 | The four icon tiles show four different glyphs in the capture (person, chart-like, door, card-like). The spec says only "a coloured icon tile" and leaves the glyph undefined, so the implementer will guess. | Say whether the tiles render a glyph (observed shapes, unlabeled, PROPOSED) or are blank, and test it in AC-M27-06.1. |
| AUD-M27-05 | Minor | URS §7 deviations table | Intended differences from live are not all listed. Missing: the four slots deliberately omit the live labels, values and anything below (UD-2); empty-state, max-3 and chip-omission are unobserved choices; the 403/404 pages replace unobserved role handling. Only DV-M27-01..03 exist. | Add DV-M27-04 (placeholder slots and omitted lower content, UD-2, status "Approved (user)") and one row for the PROPOSED unobserved states, or state in §7 why they are not deviations. |
| AUD-M27-06 | Minor | SRS FR-M27-08, FR-M27-09, BR-M27-01; URS §2, FN-M27-1.2.3/1.2.4 | Tagged SERVER (`StaffScope.php:128-148`). L07 §0 states there is no server route for `/admin-sekolah`; the rule comes from adjacent screens, and live has a picker (302) for users without a chosen school, so "no school = 403" is a rebuild decision (DL-1), not a server behaviour for this route. | Tag "SERVER (adjacent screen) / PROPOSED (DL-1)". |
| AUD-M27-07 | Minor | SRS §3 FR-M27-02, AC-M27-01.1, E2E-M27-01, E2E-M27-25 | FR-M27-02 requires "Dashboard" to be active on exactly `/admin-sekolah` and not on `/admin-sekolah/*`, but no AC or E2E checks the negative half (e.g. Dashboard not active on `/admin-sekolah/command-center`). AC-M27-01.1 only checks other items are not active. | Add an AC and an E2E step: on `/admin-sekolah/monitoring` the "Dashboard" item is not active. |
| AUD-M27-08 | Minor | SRS FR-M27-04 | The shell avatar initials rule is attributed to "M09 BR-M09-29" (a perutusan card rule). The shell's own rule is `src/shells/shared/avatar.ts` `initialsOf` (M01 BR-15). Same result, wrong owner. | Cite M01 BR-15 / the shell for the avatar and M09 BR-M09-29 for the perutusan row. |
| AUD-M27-09 | Minor | URS AC-M27-02.4; SRS FR-M27-22, E2E-M27-06 | "No other school's name (not 'SMK DEMO', not 'SK Demo')" collides with the page's own banner when the name is displayed in capitals by data (OQ-M27-05 leaves capitals-by-CSS-or-data open): "SMK DEMO SERI PUTRA" contains "SMK DEMO". Also the primary persona's banner reads "SMK Demo Seri Putra" while its M09 #4 title names "SMK Bandar Seri Putra", a visible contradiction on one page that AC-02.4 exempts silently. | Make the assertion exact (compare the banner name and test other school names as whole strings, or fix capitals as CSS-only so `textContent` keeps the stored case). Add a note that the #4 title is M09 content outside M27 scope. |
| AUD-M27-10 | Minor | URS §6 coverage matrix EL-L07-09; SRS §1 | The screenshot sidebar footer card (school short name and code, logout icon; discovery §1.1) shows the viewer's school and is not named in the coverage matrix or assigned to the shell. | Add a line under EL-L07-09: footer card is shell-owned, data from M02 school of the session user; M27 adds nothing. |
| AUD-M27-11 | Minor | URS AC-M27-01.2, SRS §10 | AC-01.2 asserts no sidebar at 768, while the only evidence is a tablet-width capture showing the sidebar and the hamburger together. The docs say the real width is unknown, but the AC is not tagged PROPOSED. | Tag AC-M27-01.2 (768 case) as shell-owned / PROPOSED per `shells.md`, or note the capture width is unknown. |
| AUD-M27-12 | Info | Cross-module | Name collision: M08 S1 `/prestasi/sekolah` is also titled "Dashboard Sekolah" (M08 FR-M08-04, header "Dashboard Sekolah" / "Selamat datang kembali", Admin Sekolah INFERRED, `PrestasiSekolahPage.vue`). Not mentioned in M27. It also corroborates the subtitle "Selamat datang kembali" (M08 notes live uses "Dashboard"). | Add a one-line cross-reference in M27 SRS §1 and in OQ-M27-04 (tab titles differ: M08 "Dashboard Sekolah — Prestasi" vs M27 "Dashboard Sekolah - PRESTASIPLUS"). |
| AUD-M27-13 | Info | `docs/design/shells.md` line 73 | States the `/admin-sekolah` routes "are in no SRS yet". Stale once M27 is approved. | Shell owner to refresh at the next revision. |
| AUD-M27-14 | Info | SRS §6.4 | `seedSchoolAdminWithoutSchool()` must bypass M02 FR-M02-27 (school required at creation). Acceptable as a test hook; no `school_admin` with a null school exists in any seed. | None; confirm the hook writes through the M01 mock store only. |

## Checks with no finding

- Privacy in the audited docs: no real person name appears; the screenshot school name, code and post title are not written in the M27 URS or SRS (the exposure is in L07 discovery, M09 and M17 content, see AUD-M27-01). Fictitious fixtures only (Azlan Demo, Salina Aziz Demo, Suhaimi Mat Demo).
- Tags: INFERRED/PROPOSED items are listed in SRS §8.2 and carry `@provisional` E2E; nothing unobserved is written as OBSERVED apart from AUD-M27-03 and 06.
- Owner contracts: M27 owns no store (D12); M09 route `/perutusan` is an empty fragment (M09-T4), disclosed in §2.1, XR-M27-01, OQ-M27-07 and AC-M27-04.2 / E2E-M27-13 `@blocked-by`. Landing unchanged (DL-2, consistent with M01 BR-07).
- Responsive: SRS §10 covers 375 / 768 / 1280; E2E runs on all three.

## Required before re-audit

Fix AUD-M27-01 and AUD-M27-02 (Major). Minor findings should be fixed in the same pass; they are doc-only. No re-walk of live is possible or needed.

---

# Round 2 (re-audit of URS v1.1 and SRS v1.1)

| Field | Value |
|---|---|
| Documents | `urs/M27-school-admin.md` v1.1 (9 stories, 25 FN, 37 AC), `srs/M27-school-admin.md` v1.1 (29 FR, 25 E2E, 9 provisional, CHK-M27-01); `discovery/L07-dashboard-admin-sekolah.md` line 55 |
| Basis | Delivery Lead decisions of 2026-10-03: privacy rule = personal names only; school 8090 and the M09 seed #3 title are owner-managed public anchors and allowed; CHK-M27-01 scoped to M27-owned files; `/dashboard` = dependency on M05-T3. Re-checked against the documents, `M05-practice` SRS and the repository. |

## Verdict (round 2): **PASS**

0 Critical, 0 Major, 1 new Minor (non-blocking), 1 Info carried.

## Closure of round 1 findings

| ID | Status | Evidence |
|---|---|---|
| AUD-M27-01 (Major) | **Closed** | DL-7, FR-M27-27, NFR-M27-04, FN-M27-1.7.3, AC-M27-08.6 and CHK-M27-01 now cover M27-owned files only (M27 docs, `src/modules/m27-*`, `e2e/m27-*`); the scan list lives outside the repo; school 8090 and the M09 #3 title are declared exempt owner anchors; URS §1.4 and SRS §6.2 state that the 8090 banner shows its public name. L07 discovery line 55 now reads "{post title}"; no screenshot title, name or code remains in either M27 document or in L07. The rule matches CLAUDE.md §6 (personal names; public anchors allowed). |
| AUD-M27-02 (Major) | **Closed** | SRS §2.1, DL-3, OQ-M27-02: `/dashboard` is an empty M05 fragment plus a dev PreviewHub stub (`core-routes.ts`); M05-T3 is named as the dependency (matches build-plan row "Dashboard / M05-T3"); XR-M27-04 asks M05 to admit `school_admin`; the M05 SRS quote ("Same as Pelajar (INFERRED)", M05 SRS line 801) is accurate; AC-M27-05.2 and E2E-M27-15 carry `@blocked-by M05-T3`. |
| AUD-M27-03 | Closed | FR-M27-20 and AC-M27-02.1: leading pin icon on the state chip, own icon on the PPD chip, types PROPOSED; no emoji claimed; AC-02.3 and E2E use "Johor"/"Selangor" text consistently. |
| AUD-M27-04 | Closed | FR-M27-23 and AC-M27-06.1: each tile holds one decorative unlabeled glyph (person, chart-like, door, card-like; PROPOSED). |
| AUD-M27-05 | Closed | DV-M27-04 (placeholder slots, UD-2) and DV-M27-05 (unobserved states) added; SRS §0.1 references both. |
| AUD-M27-06 | Closed | FR-M27-08, 09 and BR-M27-01 read "SERVER on adjacent screens ... no server route / PROPOSED (DL-1)". |
| AUD-M27-07 | Closed (see R2-01) | AC-M27-01.5 and the second step of E2E-M27-01 test "Dashboard" not active on `/admin-sekolah/monitoring`. |
| AUD-M27-08 | Closed | FR-M27-04 and AC-M27-01.4 cite M01 BR-15 and `avatar.ts`; M09 BR-M09-29 only for the perutusan row. |
| AUD-M27-09 | Closed | FR-M27-19: stored case in `textContent`, capitals by CSS only; AC-M27-02.4 is exact (banner name and Perutusan card excluded, case-sensitive, whole strings); the #4 title mismatch is noted as M09 content outside M27 scope (FR-M27-22). |
| AUD-M27-10 | Closed | EL-L07-09 now includes the footer card, shell-owned, data from the session user's M02 school. |
| AUD-M27-11 | Closed | AC-M27-01.2 tagged PROPOSED, shell-owned, breakpoint from `shells.md`; E2E-M27-02 is `@provisional`. |
| AUD-M27-12 (Info) | Closed | SRS §1 cross-reference to M08 S1 with the differing tab titles. |
| AUD-M27-13 (Info) | Closed | OQ-M27-09 assigns the `shells.md` line 73 refresh to the shell owner. |
| AUD-M27-14 (Info) | Closed | SRS §6.4 states the hook bypasses M02 FR-M02-27 and writes only through the M01 mock store; XR-M27-05 and OQ-M27-10 added. |

## New checks

- **Counts:** 25 FN (unchanged), 37 AC (36 + AC-M27-01.5), 29 FR, 25 E2E, 9 provisional (02, 03, 05, 10, 11, 13, 15, 16, 24; list in SRS §12 matches), 1 static check. URS and SRS totals agree.
- **Traceability:** every AC maps to an E2E or CHK-M27-01 (01.5 → E2E-01; 01.2 → E2E-02); every story and FR is covered; new XR-M27-04/05 and OQ-M27-09/10 are cross-referenced.
- **Tags:** OBSERVED/INFERRED/PROPOSED/SERVER used correctly in the changed rows; no unobserved item became fact; no stat-card label or figure was added; no privacy regression.

## Open findings (non-blocking)

| ID | Severity | Doc and section | Issue | Required fix |
|---|---|---|---|---|
| R2-01 | Minor | SRS §3 FR-M27-02 (AC column), URS FN-M27-1.1.4 | The new AC-M27-01.5 verifies FR-M27-02, but the FR-M27-02 row still lists only AC "01.1, 01.2". Forward trace FR to AC is incomplete (reverse trace is fine). | Add 01.5 to the AC column of FR-M27-02 (SRS) at the next edit. |

Carried (not a defect): OQ-M27-01 (the four stat cards and anything below) keeps the Admin Sekolah part of L07 "not final-complete"; M09-T4 and M05-T3 stay build-order dependencies for AC-M27-04.2 / E2E-M27-13 and AC-M27-05.2 / E2E-M27-15.

G1 gate for the visible parts of M27 S0: auditor verdict **PASS**; user approval is still required before build.


---

# Round 3 (re-audit of URS v1.2 and SRS v1.2, scope grew under D24)

| Field | Value |
|---|---|
| Documents | `urs/M27-school-admin.md` v1.2 (11 stories, 34 FN, 51 AC), `srs/M27-school-admin.md` v1.2 (37 FR, 18 BR, 34 E2E, XR-M27-01…10) |
| Evidence | SERVER-DECK images `prestasiplus-reference/backend/public/images/present/ss-admin.png` and `ss-prestasi-sekolah.png` (both viewed); `docs/discovery/M27-admin-sekolah-screens.md`; server `Support/SchoolAggregates.php` (lines 40-48, 76-77) and `Support/StaffScope.php`; repository `src/` for M08 (`mock/repository/performance.ts`, `api/types.ts`, `routes/prestasi.ts`), M10 (`classrooms.ts`), M02 (`subscriptions.ts`, `seeds/billing.ts`, `overrides.test.ts`), M18 (`mock/index.ts`); M08, M02, M18 SRS. |

## Verdict (round 3): **FAIL**

0 Critical, 1 Major, 3 Minor, 2 Info. The Major is a wording and factual correction in DV-M27-07 and its dependants; no new evidence is needed.

## Verified (no finding)

- **Deck-visible elements and copy are complete and exact.** ss-admin: header "Dashboard Sekolah" / school name; "Admin Sekolah" pill (DV-M27-06, live wins); chips (pin + state, map icon + PPD, "# Kod:"); cards "JUMLAH PELAJAR" / "JUMLAH GURU" / "KELAS AKTIF" / "LANGGANAN" with "Belum Ada" in the grey card; glyphs (pupil cap, teacher at board, door, ID card) and foot bars; "Ringkasan Prestasi" and its subtitle "GPS, risiko murid, ketepatan latihan & perbandingan tingkatan"; panels "GPS SEKOLAH" ("{grade} · {band}", "{n} entri headcount"), "AMARAN AWAL" ("Selamat", "Berhati", "Berisiko", "{n} murid dinilai"), "LATIHAN" ("Purata Ketepatan", "{n} sesi · {n} soalan"), "TINGKATAN" ("Tingkatan 4/5", "Click untuk detail", both amber at 50-69.9); "Taburan Gred (Anggaran)" and "Lihat penuh →". ss-prestasi-sekolah is correctly identified as M08 S1 (head, "Tingkatan"/"Kelas" pills, GPS ring, grade bars, "Jumlah: {n} rekod"). The deck's GPS shown as "B · Sederhana" confirms the round(GPS) grade rule and the band rule of BR-M27-15.
- **Live wins where they differ:** card 4 colour (DV-M27-04), role line position (DV-M27-06), sidebar (OQ-M27-06). Header "Dashboard Sekolah" / school name is consistent with the live capture's covered "D…" / "S…".
- **Server definitions trace correctly.** `SchoolAggregates.php` counts `users` by `role` and `school_id` for pupils and teachers (lines 40-43, 76-77) and `AVG(practice_sessions.accuracy)` with a "—" convention, as BR-M27-12/17/18 state; `StaffScope.php:128-148` is cited as an adjacent screen only. KELAS AKTIF and LANGGANAN have no server definition and are correctly tagged INFERRED/PROPOSED.
- **Owner claims, checked in `src/`:** M08 `schoolPerformance(scope, year)` (`performance.ts:218`) returns `gps {value, band, entries}` (no `grade`, so XR-M27-06(b) is accurate), `distribution`, `levels [{code, accuracy, ...}]` and `stats {sessions, answered, accuracy}`; its handler maps `school_admin` to the school scope (`handlers/performance.ts:21-23`), so XR-M27-06(a) holds. M18 has only an empty `defineMockModule` stub, so "M18 has no mock yet" (XR-M27-08, OQ-M27-14) is accurate; `Q-M18-RISK(scope|classId|schoolId)`, BR-M18-13/14 and S22 exist in the M18 SRS. M02 users can be counted by `role` and `schoolId` (`adminList`, `roleCounts`), so XR-M27-10 is a valid confirmation request.
- **Links:** `/prestasi/sekolah` and `/prestasi/tingkatan` exist (`m08-student-performance/routes/prestasi.ts`, `access: 'auth'`, no role list) and the data handler gives `school_admin` its own-school view (M08 FR-M08-13).
- **Counts and traceability:** FN 34 (25 − 2 + 4 + 7), AC 51 (5+4+5+2+3+5+6+6+2+10+3), FR 37, E2E 34, 10 provisional (02, 03, 05, 10, 11, 13, 15, 24, 27, 33). Every AC maps to an E2E or CHK-M27-01, every FR to an AC, every story to FR and E2E (SRS §3.1 includes US-M27-10/11). Privacy: the deck's school name, code and PPD do not appear in the M27 URS/SRS or in the discovery files; no invented figure (all values are oracle-based, none pinned).

## Findings

| ID | Severity | Doc and section | Issue | Required fix |
|---|---|---|---|---|
| R3-01 | **Major** | URS DV-M27-07, OQ-M27-12, AC-M27-11.3; SRS BR-M27-13, E2E-M27-34, OQ-M27-12 | The Delivery Lead decision is that each S0 card follows its own SERVER definition, is not tuned to match M08 S1, and that the deck's difference is recorded as observed behaviour. DV-M27-07 does not say that: it is categorised "Contradiction avoided", and its rebuild column says the two screens "agree for pupils", with AC-M27-11.3 and E2E-M27-34 *requiring* "JUMLAH PELAJAR" to equal the M08 S1 "{n} murid". The deck shows them differing for the same school (S0 pupils 9 against 171 murid, teachers 0 against 4, classes 0 against 26), so the requirement removes an observed difference without recording it as a deviation. The stated reason is also wrong: DV-M27-07, BR-M27-13 and OQ-M27-12 say M08 S1's "Guru" and "Kelas" tiles are class-derived, but M08 FR-M08-12 and the code (`performance.ts:218-230`: `stats.teachers` and `students` come from `users.adminList({role, schoolId})`; "Kelas" from `classesOf` = active classrooms with the school's `schoolId`) show they use M02 / M10 counts of the same school. In the rebuild the pupil and teacher cards will therefore coincide with M08 by construction, and classes nearly. | Rewrite DV-M27-07 as observed server behaviour: "Deck (original server): for one school the S0 cards (9 / 0 / 0) and the M08 S1 tiles (171 / 4 / 26) differ. Rebuild: each S0 card follows its own owner definition (M02 / M10 / M02 subscriptions); no value is tuned or aligned; any agreement with M08 S1 in the rebuild is a consequence of both reading the same owner data, not a requirement, and the deck's difference is not reproduced." Correct the M08 description in BR-M27-13 and OQ-M27-12 (point to M08 FR-M08-12). Remove "JUMLAH PELAJAR equals the M08 header" from AC-M27-11.3 and E2E-M27-34 (keep GPS, entries, sessions, questions, accuracy). (The deck figures in this fix text are for the fixer only; do not copy them into the M27 files, FR-M27-27.) |
| R3-02 | Minor | SRS XR-M27-07, XR-M27-09 | The requests state a read is missing, but M10 already has `classrooms.forSchool(schoolId)` (`classrooms.ts:220`) and `list({isActive, schoolId})` (`:204`, used by M08 `classesOf`), and M02 already has `subscriptions.forSchool(schoolId)` (`subscriptions.ts:147`). What is genuinely new is only the definition ("owned by teachers of the school" against the class `schoolId`) and the "current subscription" rule. | Reword XR-M27-07 as "confirm which school link defines an active class (teacher's school or class `schoolId`) and use `forSchool`/`list`", and XR-M27-09 as "add the current-status rule on top of `forSchool`". |
| R3-03 | Minor | SRS §6.2 (persona 900001), AC-M27-06.4, E2E-M27-27; BR-M27-14 | "M02 holds one grace row at 900001" is only true under the test-only reset profile `subscriptions-extra` (`seeds/billing.ts:182`, `overrides.test.ts:112`); the default seed has none, so the E2E would read "Belum Ada" unless the profile is loaded. BR-M27-14 also ignores the M02 status `cancelled` ("Dibatalkan", M02 FR-M02-83). | State that the scenario needs `mock.reset({profile: 'subscriptions-extra'})`; define the result for `cancelled` (for example treated as no current subscription, PROPOSED). |
| R3-04 | Minor | SRS BR-M27-18 | The format example "1,094" is a deck figure (the deck's soalan count), against FR-M27-27 / NFR-M27-04 ("nor any deck figure"). | Use a neutral example such as "1,234". |
| R3-05 | Info | `discovery/M27-admin-sekolah-screens.md` §5.3 | Quotes the deck's Amaran tallies. Discovery files are outside the DL-7 file list and the numbers are not personal data. | None required; do not carry them into the SRS. |
| R3-06 | Info | SRS §6.2 | The populated school is left to build time (8090, 8078 or 8102 by oracle). Acceptable because E2E use owner oracles, but the first build task must confirm M08 headcount entries exist for it, or E2E-M27-28/32 become no-data scenarios. | Build-task note only. |

## Required before re-audit

Fix R3-01 (Major); R3-02 to R3-04 in the same pass. Everything else in v1.2 passes.

---

# Round 4 (re-audit of URS v1.3 and SRS v1.3)

## Verdict (round 4): **PASS**

0 Critical, 0 Major, 1 new Minor (stale line, non-blocking).

## Closure of round 3 findings

| ID | Status | Evidence |
|---|---|---|
| R3-01 (Major) | **Closed** | DV-M27-07 is now "Observed server behaviour, not reproduced": the deck's difference is recorded, each S0 card follows its own owner definition, nothing is tuned or aligned, any agreement with M08 S1 is a consequence of both reading the same owner stores (M08 FR-M08-12), and no AC requires equality. AC-M27-11.3 and E2E-M27-34 now compare only GPS, entries, sessions, questions and accuracy with M08 S1 and exclude the three count cards. BR-M27-13 and OQ-M27-12 describe M08 correctly (Murid and Guru from M02 counts, Kelas from active classrooms; `performance.ts:218-230`). No deck figure was added. |
| R3-02 (Minor) | Closed | XR-M27-07 is now "confirm the school link" using existing `classrooms.list({isActive, schoolId})` / `forSchool`; XR-M27-09 adds only the current-status rule on top of existing `subscriptions.forSchool`; SRS §6.1 states both reads exist. Both reads exist in `src/` (`classrooms.ts:204,220`, `subscriptions.ts:147`). |
| R3-03 (Minor) | Closed | AC-M27-06.4 names `mock.reset({profile: 'subscriptions-extra'})` as the only source of the grace row at 900001 and says the default reads "Belum Ada"; `cancelled` is "not a current subscription" in BR-M27-14, FR-M27-30 and FN-M27-1.6.4. |
| R3-04 (Minor) | Closed | BR-M27-18 example is now "1,234". |

## Checks requested by the coordinator

- **KELAS AKTIF = `classrooms.list({isActive: true, schoolId})`:** matches the code (`classrooms.ts:204` filter; M08 `classesOf` uses the same read with `kind: 'classroom'`). It is tagged INFERRED, and the alternative "owned by a teacher of the school" is left to M10 (XR-M27-07). M10 SRS only defines "kelas aktif" as the viewer's own active classes (FR-M10-28), so no M10 SRS conflict.
- **LANGGANAN labels "Aktif" / "Tempoh Ihsan" / "Tamat":** match M02 BR-23 (badge "Aktif", "Tempoh Ihsan" (INFERRED), "Tamat"; the status set `active, grace, expired, cancelled` is quoted correctly). The v1.2 wording "Tamat Tempoh" (M02 stat-card label) was replaced consistently. "Batal" is not used because `cancelled` maps to "Belum Ada" (PROPOSED), which is declared.
- **Counts:** unchanged and consistent: 34 FN, 51 AC, 37 FR, 34 E2E, 10 provisional; traceability intact.

## Open finding (non-blocking)

| ID | Severity | Doc and section | Issue | Required fix |
|---|---|---|---|---|
| R4-01 | Minor | SRS §8.2 row 10 | Still reads "KELAS AKTIF definition: active M10 classes of the school's teachers", the v1.2 definition that v1.3 replaced (BR-M27-13, FR-M27-24 use the class `schoolId` read). Also E2E-M27-27 does not repeat the `subscriptions-extra` profile that AC-M27-06.4 requires. | Change row 10 to "active M10 classes of the school (`classrooms.list({isActive, schoolId})`), school link to be confirmed (XR-M27-07)"; add the profile to E2E-M27-27. |

G1 for M27 S0 v1.3: auditor verdict **PASS**; user re-approval of the v1.2 scope growth (URS §0.2) is still required before build.
