# M27 Part B (S1 to S11, rows L51 to L58) - independent audit

| Field | Value |
|---|---|
| Audited | `docs/requirements/urs/M27-school-admin.md` v1.4 Part B (section 10 to 17, lines 389 to 1016) and `docs/requirements/srs/M27-school-admin.md` v1.4 Part B (section 14 to 25, lines 405 to 908) |
| Date | 2026-10-03 |
| Method | Read-only. Compared every provenance tag with the reference backend (`D:\Dev Projects\prestasiplus-reference\backend`: routes, StaffScope, SchoolAggregates, LaporanController, LaporanEksekutifController, UserDirectory, UsersController, Panel\UsersController, ExportController, SchoolPicker, views), the deck images (`ss-admin.png`, `ss-amaran-awal.png`, `ss-prestasi-sekolah.png`), the two roles-matrix screenshots, the M09 Panduan discovery, the owner SRS/URS (M01, M02, M05, M08, M10, M17, M18) and the built repo data (`src/modules/m01`, `m02`, `m10`, `user-nav.ts`). Traceability and counts were machine-checked (node script in the scratchpad `m27b-audit/`). D24 applied: "needs a school-admin account" is not a finding. No browser used. |
| Part A | Only checked for contradictions (none found; QS8-01 to 05 cover the stale Part A wording). |

## Verdict: FAIL (0 Critical, 2 Major, 14 Minor)

Both Majors are factual errors in SERVER claims or owner-contract premises that decide what S6/S7/S8 may contain; each fix is small (re-tag, one row of text, one owner request). With them corrected and the Minors triaged, Part B is a PASS candidate. Everything else checked out: counts, traceability, endpoint shapes, XR list, most copy.

## Findings

### Major

**AUD-M27B-01 (Major) - SERVER claims about the school-admin user pages are false or incomplete; scope exclusions rest on them.**
Evidence:
- URS section 16 row "Creating a pupil one by one" (urs line 982): "Server: pupils come through import only (`importableRoles`)". False. `importableRoles` governs only the bulk importer (`StaffScope.php` ~L180-190). The server has a single-pupil create for school admins: `UsersController::create/store` (`UsersController.php:162-220`, guard `StaffScope::canManageStudents`, `school_admin` pinned to own school by `resolveSchoolId`), shown on the school admin's list as the button "Tambah Pelajar" (`views/admin/users.blade.php:147`, comment "school admins land pre-scoped").
- URS FN-M27-8.1.6 (line 603) "No Import Pelajar, Tambah or delete control ... (targets not built or admin-only)". For "Tambah" it is not admin-only on the server. The same page also offers "Eksport CSV" (`users.blade.php:142`, `ExportController::users` L46-86, confined to the school for `admin_sekolah`) and "Import Pengguna" (L151). OQ-M27-20 (urs line 1001) and URS section 16 state "no export" as a bare PROPOSED default and never mention that SERVER has one.
- SRS BR-M27-30 (line 592) and URS section 10.2 S6 row cite "`StaffScope` `onlyRoles`" for "a school admin never lists peers or other roles". `onlyRoles` is a parameter of `UserDirectory::paginate` (`UserDirectory.php:64,77`), not of `StaffScope`, and is passed only by the Panel page, whose `SCHOOL_ROLES = ['pelajar','guru','admin_sekolah']` (`Panel/UsersController.php:31,68`, "pupils, teachers and fellow school admins", Desa 23 Sep) deliberately includes peers. The `/admin/users` page passes no `onlyRoles` at all (`UsersController.php:41-70`). The statement is true of S6/S7 only because those pages are role-fixed by design.
- The discovery and URS treat S6/S7/S9/S10 purely as ANALOGUE (M02 live) plus "SERVER rules". The server's own school-admin variants (`users.blade.php`, `users-edit.blade.php`: username, "Digantung" suspension box, `kelas`, teaching fields, one-click "Reset", "Sunting" label) are real school-admin pages under D24 and appear nowhere in the coverage matrix (section 14 has no element for them).
Why it matters: D24 says SERVER is the spec where live is unobservable; dropping server-evidenced controls (Tambah Pelajar, Eksport CSV) on a false server claim is an unrecorded deviation, and the matrix cannot prove completeness without those elements.
Fix: (a) Correct the section 16 row, FN-M27-8.1.6 and BR-M27-30 source text to the true facts (single create, export and import exist on the server's `/admin/users`; peers are listed by the server Panel). (b) Add coverage elements EL-S6-13..16 (Tambah Pelajar, Eksport CSV, Import Pengguna, server edit-form extras) with status N or MD and the real reason (for example "not in rows L51-L58; live M02 template is the better evidence for the same page; Panduan names only bulk import"), and record them in the deviation table as PROPOSED, or adopt them. (c) Replace the `onlyRoles` citation by "page is role-fixed".

**AUD-M27B-02 (Major) - Owner-contract premise for S8 "both kinds" is false; AC-M27-31.3 and E2E-M27-97 cannot be satisfied.**
Evidence: SRS XR-M27-14(a) (line 668) and BR-M27-35 (line 597), FN-M27-10.1.3 (urs line 648) assume `classrooms.list({schoolId})` returns the `school_class` rows of the school ("they carry `schoolId`"). M10 DATA-M10-01 has `schoolId` optional (`M10 SRS` DATA-M10-01 table, "no", used by S5 "Pilih Sekolah"), and the only two observed `school_class` rows have `schoolId: null` (`src/modules/m10-teacher-class/mock/data/spec.ts:325-343`, classes 419 and 806). M10 offers no way to create a `school_class` (SRS: "S4/S5 create only `classroom`"), and URS section 18.2 forbids M27 seeds. So no school ever lists a `school_class` row; AC-M27-31.3 ("Given a `school_class` row of the school") and E2E-M27-97 have no arrangeable fixture.
Fix: change XR-M27-14(a) from "confirm" to a real request (M10 owner decides whether the two observed school classes, or a designed pair, get a `schoolId`), or mark FN-M27-10.1.3, AC-M27-31.3 and E2E-M27-97 `@provisional` + blocked-by-XR-M27-14 and state that today S8 lists `classroom` rows only.

### Minor

**AUD-M27B-03 - Password-reset bar label differs from the cited analogue, untagged.** FN-M27-8.3.2 / FR-M27-95 title the amber bar "Reset Kata Laluan" and cite "A (M02 FR-M02-43)", but M02 FR-M02-43 (`M02 SRS` line 167) is "Tukar Kata Laluan". The Panduan sentence (`discovery/M09-content.md:1156`) supports the button name "Reset Kata Laluan"; both are live copy. Also silently omitted from the M02 S3 subset: the "Nota Keselamatan" card (FR-M02-44). Fix: tag the label as L (Panduan) over M02, add one row to section 15 or section 20.2 (PROPOSED), and list the omitted card.

**AUD-M27B-04 - "No breadcrumb on S1 to S8" is tagged D (deck) without deck evidence.** FN-M27-2.2.4 (urs line 480) says "deck pages have none". Only the Amaran deck page (`ss-amaran-awal.png`) lacks one; the deck S0 (`ss-admin.png`) and the live S0 screenshot (`...12.04.10.jpeg`) both show "← Papan Pemuka / Dashboard Sekolah", and the analogue M18 S3 has a breadcrumb (discovery 2.2). For S1-S3, S5-S8 there is no evidence either way. Fix: re-tag as PROPOSED, note the S0 precedent, add a coverage element for the analogue breadcrumb (currently absent), and decide consciously.

**AUD-M27B-05 - Wrong owner cross-reference.** FR-M27-71 (srs line 499) cites M17 FR-M17-93 for the Guru tab; FR-M17-93 is the Sekolah tab, the Guru tab is FR-M17-94 (`M17 SRS` lines 176-177). Fix the id.

**AUD-M27B-06 - DV-M27-08 and DV-M27-13 rationales are inaccurate against SERVER.** DV-M27-08 (urs line 961) rejects pointing the sidebar at `/admin/laporan` because "that path is the platform admin's page"; the server gives school admins exactly `/admin/laporan`, confined to the school (`LaporanController.php:17-26`, discovery 4.1). The alias is still a defensible D9 choice (M17 alias precedent `/admin-sekolah/command-center`), but say that. DV-M27-13 (line 966) says "Skor Purata" has no definition; the server does define it for the school scope (`LaporanController.php:82-83`, label "purata ketepatan sesi", `views/admin/laporan.blade.php:59-61`). The reason for hiding it is the live display constant DC-M17-06 and the M17 precedent, not absence of a definition. Fix the wording.

**AUD-M27B-07 - Some S1 tags overstate SERVER/OWNER.** (a) FN-M27-3.1.4 / BR-M27-22 tag windowing and "completed" filter as `S SchoolAggregates`; the server aggregate is all-time `AVG(practice_sessions.accuracy)` over all sessions, no window (`SchoolAggregates.php:61-66`; discovery 2.3 itself says windowing is PROPOSED). (b) FN-M27-3.2.1 / BR-M27-23 tag the mode labels as "S (mode split); O (M05 S9)". The server prints the raw `mode` string (`views/admin/ppd/statistik.blade.php:18`), and in M05 only "Latihan" is OBSERVED, the other labels ("Bab", "Ulang Kaji", "Tracking A") are PROPOSED COPY (M05 BR-21, DATA-M05-10). Fix: tag window/filter as P and the labels as O with the PROPOSED COPY caveat inherited.

**AUD-M27B-08 - S5 copy and rule inconsistencies.** (a) FN-M27-7.1.2 / FR-M27-82 label the card "Ketepatan" and add "Sesi Latihan" replacing "Konsistensi", while citing M17 FN-M17-6.4.2 whose labels are "Ketepatan Akhir" and "Konsistensi"; "P (set)" covers the set but not the label change. (b) "Statistik Bulanan" lists "months with sessions" (FN-M27-7.2.1, AC-M27-24.2) but BR-M27-28 (srs line 590) says "months with no answer are not listed"; M05 has answers without sessions (BR-33, 6,604 answers), so the two rules differ for such months. Fix: one rule (M18 FN-M18-2.9.6 says sessions), and name the label change.

**AUD-M27B-09 - S2 filter scope inconsistency and data feasibility.** FN-M27-4.2.1 (urs line 533) lists "subjects that have SPs"; FR-M27-59 and BR-M27-25 say "at the chosen level". Under the SRS wording the empty-state copy (FN-M27-4.2.2) is reachable only when no subject has SPs at that level. Separately, M08 DATA-M08-04 states SpRecords exist only for the admin anchors and the designed pupils 700001-700008, the M05 anchors carry `dskpSpId = null`; so for P4 (generated school 8090) nearly every tile is "Belum cuba", and AC-M27-18.4 / E2E-M27-62 ("P1 and P4 give different values") and AC-M27-17.3 have no data. Fix: align the two texts; extend XR-M27-13(a) with the seed need or mark those AC provisional.

**AUD-M27B-10 - Fixtures: P1 school has no population.** `users-spec.ts:601-607` and `users-anchors.ts:376-382`: school 900003 holds only school admin 3102 (no pupil, teacher or class; pupils 3105-3109 carry no school). So AC-M27-12.5 ("a teacher of school 900003"), AC-M27-25.3 and AC-M27-31.5 for P1 are vacuous or unarrangeable as written, and SRS 18.2 lists no arrangement for them (it covers inactive users and empty schools only). AC-M27-28.3 and AC-M27-31.2 pin "2 kelas" and class names although section 10.3 says "no figure is pinned" (they are anchor facts: fine, but say so). Fix: add the arrangement step (move a teacher through M02 admin endpoint #5) or use P2/P4 for those ACs.

**AUD-M27B-11 - Deck figure quoted inside an M27 doc.** EL-S8-09 (urs line 944) quotes "26 kelas · 171 murid" (a real school's figure from `ss-prestasi-sekolah.png`). NFR-M27-10 and CHK-M27-02 forbid deck figures in M27-owned docs and scan them. Fix: reword without the numbers ("a school class and pupil total shown in the deck").

**AUD-M27B-12 - Document control and numbering not updated.** SRS row "Source URS" (srs line 10) still reads "v1.3 (11 stories, 34 FN, 51 AC)"; both H1 and "Document" rows still say "screen S0" only; SRS section 0.1 lists no DV-M27-08..17; URS has FT-M27-8.3 with no 8.2 and FN-M27-10.2.1 under the FT-10.1 table with no FT-10.2 heading. Cosmetic but it breaks "ids as in the doc" greps. Fix the rows and renumber (8.3 to 8.2, add FT-M27-10.2).

**AUD-M27B-13 - Responsive tables not fully consistent with owner analogues or each other.** S3 overview cards "4 per row at 768" (FR-M27-68, section 22) while the cited M17 FN-M17-8.6.1 is `grid-cols-2 lg:grid-cols-5` (2 per row at 768); not flagged as a change. S7 "Cipta Pengguna" is "in the header row" (URS section 13) but "full width under the heading" at 375 (SRS section 22): acceptable only if stated as the 375 behaviour. "cards 1 to 3 per row" at 375 for S6/S7 is not testable. Fix with exact counts and mark deviations P.

**AUD-M27B-14 - Inactive-account behaviour underspecified on read endpoints.** Section 19 lists 403 for inactive accounts on #8, #9, #13, #15 only, while the page S9/S10 answers 403 for an inactive account (FR-M27-96, 105) and loads through GET #7/#11 (errors listed: 401, 403, 404). Check order (foreign inactive account: 404 or 403) is unstated; BR-M27-31 implies 404 first. Fix: add 403 to #7/#11 for inactive in-school accounts and state the order.

**AUD-M27B-15 - Policy decisions classified as non-blocking should be flagged for user confirmation at G1.** OQ-M27-21 (S11 creates teachers active, against the server approval gate `importsNeedApproval`) and DV-M27-10 (school admin activates/deactivates teachers, against `canActivate`) change an access-control policy. URS section 17 says "None blocks G1" and Part B has no counterpart of Part A section 0.2 ("changes that need the user's G1 re-approval"). The defaults are reasoned (Panduan LIVE wins), so non-blocking is acceptable, but list them and the three PROPOSED screens (S2, S5, S8) in a G1 confirmation list. QS8-01 to 05 are sensible and complete.

**AUD-M27B-16 - Two small owner details dropped from S4.** M18 FN-M18-4.6.1 appends " — Tingkatan {n}" to the shell sub-line when a level filter is active; FN-M27-6.1.2 and AC-M27-22.5 do not. FR-M27-78 / BR-M27-27 say M18 FR-M18-09 "defines for a school admin (403)"; FR-M18-09 (`M18 SRS` line 100) speaks of "the officer's scope" and the school-admin cell is in the M18 section 9 matrix ("own school"). Fix the citation (BR-M18-01 + section 9) and add the sub-line suffix.

## Claims checked

| Area | Claim | Result |
|---|---|---|
| SERVER | `StaffScope.php:128-148` `listScopeSchoolId`, `openedScopeOrAbort` (403 for a school admin without a school) | True (lines 128-131, 142-148) |
| SERVER | `canManageAccount` own school, pupil/teacher only, active only, decision 22 Sep; peers excluded | True (L200-215 and comment) |
| SERVER | `canActivate` national admin only; imports land inactive (`importsNeedApproval`) | True; basis of DV-M27-10 |
| SERVER | `importableRoles` school admin = guru; `resolveSchoolId`; locked `SchoolPicker`, meta "{code} · {district} · {state}" | True (`StaffScope.php`, `SchoolPicker.php:45-70`) |
| SERVER | `SchoolAggregates` formulas: Pelajar/Guru by role+school, active = distinct answerers, Penglibatan `reg>0 ? round : 0`, accuracy AVG one decimal, null "—" | True (windowing and "completed" are not server: AUD-07) |
| SERVER | Statistik page: "Mengikut Mod Latihan" table (Mod, Sesi, Ketepatan Purata), strip labels, footnote text, "Mengikut Sekolah" | True (`statistik.blade.php`, `_shell.blade.php:52`); labels are raw modes (AUD-07) |
| SERVER | `pusat:` middleware excludes `admin_sekolah` from `/ppd` and `/jpn` pages | True (`web.php:830-860`) |
| SERVER | `LaporanController` scoped (13 queries), `$totalSchools = 1`, teachers never logged in with e-mails, proxy `email_verified_at` | True; `avgScore` defined (AUD-06) |
| SERVER | `LaporanEksekutifController` school focus report, league tables withheld when scoped | True (L21-25) |
| SERVER | pupils through import only; peers never listed; no server school-admin pages | False / incomplete (AUD-01) |
| SERVER-DECK | `ss-amaran-awal.png`: header "Amaran Awal — Sekolah" + school sub-line, pills, tiles 9/0/6/3, bar 67%/33%, legend, two buttons only, subject analysis, no breadcrumb | True |
| SERVER-DECK | Deck sidebar: PENGURUSAN (Kelas Sekolah door icon, Senarai Pelajar, Senarai Guru, Statistik Penggunaan), TINDAKAN (Cipta Pengguna, Import Pelajar) | True (EL-S1-04, S6-12, S7-10, S8-03, DV-M27-14) |
| SERVER-DECK | `ss-prestasi-sekolah.png` labels "Sesi Latihan", "Soalan Dijawab", "Purata Ketepatan" | True (not cited by S1 row; add) |
| LIVE | Roles-matrix screenshots: sidebar labels, groups and order for the eight items; "Statistik Penggunaan" after "Analitik Adaptif"; "Laporan Aktiviti" last in ANALITIK; "Laporan Bulanan" after "Amaran Awal" | True |
| LIVE | Panduan sentences (Urus Pelajar, Urus Guru, Daftar Guru, reset FAQ, Statistik card) | True (`M09-content.md:1138-1156`) |
| Shell | XR-M27-11: `user-nav.ts:370-392` item ids and hrefs, `sa-amaran-awal` = `/amaran`, `laporan-aktiviti` href | True |
| ANALOGUE | M18 S22 (FN-M18-4.6.1-4.6.6, 4.9.3 CSV link S22-023), S3 pills/empty copy, S9 "Statistik Bulanan"/"Prestasi Per Kelas"/"Senarai Guru", endpoints #21, #22, #24, #30 accept school admin | True (except AUD-16) |
| ANALOGUE | M17 S11 copy (FN-M17-8.1.1-8.5.1), S9 cards/footer, FR-M17-105/114, BR-M17-01/02/04/05/20/22/34 | True (AUD-05 id, AUD-08 labels) |
| ANALOGUE | M02 S1/S2/S3 (FR-M02-02/03/06/07/08/18/19/20-36/37-46), password field names, toggle confirm text, S3 header "Edit Pengguna"/"Kemaskini maklumat pengguna" | True (AUD-03 bar label) |
| ANALOGUE/OWNER | M08 FR-M08-52 (caption, legend, colours, title format), DATA-M08-04 SpRecord shape; M05 S9 labels; M10 `list`, `forTeacher`, `memberCount`, `forSchool` | True (AUD-02, 07, 09) |
| Counts | 22 stories, 73 FN, 99 AC, 79 FR (38-116), 21 BR (19-39), 65 E2E (35-99; 6 provisional; 7 blocked-by M18), 15 endpoints (#2-#16), 9 XR (11-19), 5 SEC, 6 NFR, 10 DV (08-17), 11 OQ (15-25) | All correct |
| Matrix | 93 elements = 56 M + 20 MD + 17 N, 0 unmapped | Correct (script count); completeness gap in AUD-01, AUD-04 |
| Trace | US to FR: every FR 38-116 reached; every AC referenced by an FR and an E2E; every FN covered by an FR (script) | Complete |
| Privacy | No real person name, IC, e-mail in Part B; school names only fixtures (`SMK Demo Seri Putra` is a fictitious M02 anchor) | Pass, except AUD-11 |
| Part A | S0 rules DV-M27-01 (403 not 500), DL-1, DL-6, BR-M27-12/13/16 counts reused unchanged; 403/404 page texts by reference | No contradiction |
| PROPOSED | S2, S5, S8 minimal, labelled, no invented totals; invented copy is marked provisional | Acceptable (AUD-08, 09) |
| D12 | No parallel schemas; reads through owners; writes only via M02/M01 contracts (XR-M27-17/18); M05 school-scoped queries requested (XR-M27-12) | Pass (AUD-02 premise) |
| Questions | QS8-01..05 and OQ-M27-15..25 sensible; build-order dependencies (M18, M08 XR-M27-13) correctly non-blocking | Pass (AUD-15) |

## Recommended order of fixes

1. AUD-M27B-01 and AUD-M27B-02 (the only gate-blocking items).
2. AUD-M27B-03, 04, 06, 07 (tag and rationale accuracy).
3. AUD-M27B-05, 08, 09, 10, 14, 16 (consistency and testability).
4. AUD-M27B-11, 12, 13, 15 (hygiene and G1 list).

A short re-audit of the changed rows is enough; no re-discovery is needed.

---

# Round 2 (URS/SRS v1.5)

| Field | Value |
|---|---|
| Date | 2026-10-03 |
| Audited | URS v1.5 Part B (section 10 to 17, now 1089 lines) and SRS v1.5 Part B (section 14 to 25, 938 lines); `git diff` against the committed v1.4 used to confirm what changed, including in Part A |
| Method | Same as round 1. Each closure re-checked against the reference code (`UsersController`, `users.blade.php`, `users-create.blade.php`, `users-edit.blade.php`, `new-credential.blade.php`, `ExportController`, `ImpersonateController`), the M01/M02/M08/M10 repo data and owner SRS. Counts and traceability by script (`m27b-audit/r2.js`, `r3.js`). |

## Round 2 verdict: FAIL (0 Critical, 1 Major, 5 Minor)

Both round 1 Majors are properly closed, and all 16 round 1 findings are closed in substance. One new Major is the same class of error as AUD-M27B-01: a corrected SERVER claim that is still false (impersonation). It is a one-line fix plus one matrix row; a short re-check of a few rows will pass it.

## Closure of the round 1 findings

| Finding | Status | Evidence |
|---|---|---|
| AUD-01 (Major) false SERVER claims, S12 and Eksport CSV | Closed in substance; one residual in R2-01 | Single-pupil create, "Tambah Pelajar", "Eksport CSV", "Import Pengguna", `onlyRoles` on `UserDirectory`, Panel `SCHOOL_ROLES` are now stated correctly (URS FN-8.1.6, BR-M27-30, DV-M27-19/21, EL-S6-13..21). S12 verified against `users-create.blade.php` (title, sub-line "Cipta satu akaun pelajar", "Nama penuh *", "Kelas", hint "minimum 8 aksara", "Cipta Pelajar", "Batal"), `new-credential.blade.php` ("Maklumat log masuk pelajar — catat sekarang, ia tidak akan dipaparkan semula.", "Nama:", "Sekolah:", "Nama pengguna:", "Kata laluan:"), the flash `Pelajar "{name}" berjaya dicipta.` (`UsersController::store`) and the CSV (`ExportController::users`, `streamCsv`, `sanitizeCsvCell`: BOM first, guard on `= + - @ tab CR`, order by id, name `users-{role}-{Y-m-d}.csv`, confined to the school, same form fields). Adaptations (e-mail required, no username, class from M10, two columns dropped) are in DV-M27-19 and the G1 list. Edit-view extras confirmed in `users-edit.blade.php`. |
| AUD-02 (Major) S8 `school_class` premise | Closed | S8 is `classroom` only (FN-10.1.3, BR-M27-35, FR-M27-113, endpoint shape, E2E-97, AC-31.3), DV-M27-20, XR-M27-14 reworded, new XR-M27-20 to M10, QS8-03 added. Re-verified: classes 419 and 806 have `schoolId: null` (`m10 mock/data/spec.ts:325-343`); 2001 and 2002 carry school 900001 and teacher 5 (`spec.ts:347-365`). Equality with S0 "KELAS AKTIF" holds today and the condition is stated (FR-M27-50). |
| AUD-03 reset label | Closed | DV-M27-18, FN-8.2.2, FR-M27-95; "Nota Keselamatan" omission stated. |
| AUD-04 breadcrumb tag | Closed | FN-M27-2.2.4 re-tagged P with the S0 and M18 S3 precedent, S4 follows its deck page, DV-M27-22, EL-X-05, AC-13.4, FR-M27-44, E2E-41, G1-7. |
| AUD-05 FR-M17-94 | Closed | FR-M27-71. |
| AUD-06 DV-08 / DV-13 rationales | Closed | Text matches `LaporanController.php:17-26, 82-83`. |
| AUD-07 S1 tags | Closed | FN-3.1.4, 3.2.1, BR-M27-22/23 and the section 10.2 S1 row: window and "completed" are P; labels carry the M05 PROPOSED COPY caveat; deck labels cited. |
| AUD-08 S5 label and rule | Closed | FN-7.1.2 names both label changes; "Statistik Bulanan" has one rule (sessions) in FN-7.2.1, BR-M27-28, FR-84, AC-24.1/24.2. |
| AUD-09 S2 scope and data | Closed | Level-scoped subject select in FN-4.2.1, FR-59, BR-25, AC-18.2; demo data moved to P2 Kimia at T5, P4 all "Belum cuba". Re-verified: Kimia `levelId 11`, SP 9001-9004 from the designed answers of pupils 3001-3008 (`m08 mock/data/designed.ts:14-24, 75-85`; `seeds/m08-t1.ts:135-177`), pupils belong to 900001. XR-M27-13 carries the seed note. (Correction to my round 1 wording: 700001-700008 are fixture question ids, not pupils; the finding itself stands.) |
| AUD-10 fixtures | Closed | P1 900003 is the empty school, P2 900001 populated; anchor facts named as the only fixed values; arrangements via M02 #5 and #8 (SRS 18.2). School 900003 verified empty (`users-anchors.ts:376-382`, `users-spec.ts:601-607`). ACs moved accordingly (12.4, 12.5, 25.3, 28.x, 31.x). |
| AUD-11 deck figure | Closed | EL-S8-09 reworded; no deck figure or real school code remains in either M27 file (searched). `BEA4001` in AC-34.2 is the M02 fixture anchor (`schools-anchors.ts`), not an observed school. |
| AUD-12 document control | Closed | Titles, Document, Version, Source URS (Part A 11/34/51, Part B 24/78/107), SRS 0.1 pointer, FT renumbering (8.2, 8.3, 8.4, 9.4, 10.2). |
| AUD-13 responsive | Closed | S3 2 per row at 768 and 4 at 1280 with the M17 `lg` reasoning; S7 button wrap at 375 in both documents; count cards stated (3 / 3 / 2). |
| AUD-14 inactive on read endpoints | Closed | #7, #11 list 403; check order stated (role, 404, then 403 for an inactive in-school account); matrix and E2E-40 updated; #14 exempt. |
| AUD-15 G1 list | Closed | New URS 17.1 G1-1..G1-7. |
| AUD-16 S4 suffix and M18 citation | Closed | FN-6.1.2, FR-75, AC-22.5 (" — Tingkatan {n}"); FN-6.2.2, FR-78, BR-27 cite BR-M18-01, section 9 and FR-M18-09. |

## Regression and consistency checks

| Check | Result |
|---|---|
| Counts (script) | 24 stories, 78 FN (78 unique), 107 AC, 83 FR (38-120), 23 BR (19-41), 68 E2E (35-102), 15 DV (08-22), 10 XR (11-20), endpoints #2-#19, 5 SEC, 6 NFR, 11 OQ: all match the stated totals. `@blocked-by M18` = 7 scenarios. `@provisional` = 5 tagged (45, 61, 76, 82, 99) plus a provisional variant described inside E2E-97. |
| Coverage matrix | 104 elements = 55 M + 28 MD + 21 N, 0 unmapped, no duplicate ids. Arithmetic from v1.4 (93/56/20/17) reconciles exactly with the two re-statuses (EL-S6-04, EL-S8-07) and the 11 new rows. |
| Traceability (script) | Every FR (38-120) is in the US table and in at least one E2E; every AC is in an FR and in an E2E; every FN is in an FR; no FR cites an undefined FN or AC; every US has ACs. |
| Endpoints and shapes | #17-#19 consistent with FR-117..120, BR-40/41, AC-34/35, E2E-100..102; route order for `/guru/baru` and `/pelajar/baru` stated; SchoolClassRow shape matches the classroom-only rule. |
| Owner links | XR-M27-17 `createPupil`, XR-M27-14(e) enrolment source `school_admin` (present in M10 DATA-M10-02), default password from M02 `mock.config` (M02 S4 default, SEC-M02-03). |
| Part A | Body untouched except the two allowed link-status rows (URS section 8, SRS 2.1), titles and document-control cells. One extra edit: R2-05. |

## New findings

**R2-01 (Major) - A corrected SERVER claim is still false: impersonation.** URS section 16 row "Delete, Login As, bulk actions, role change, school change on S6, S7" says the server's `/admin/users` does not offer them to a school admin ("delete and impersonation are not on the school admin's page"). Delete and role change are indeed absent, but a school admin does get "Menyamar" (impersonate) on the server: `views/admin/users.blade.php` (the `$canImpersonate` block, true for an active pupil or teacher of the same school; `$impersonateWhyNot` copy "Pengguna ini bukan dari sekolah anda"), route `web.php:758-759`, and `ImpersonateController::start` (`ImpersonateController.php:17-29, 36-54`) admits `admin_sekolah` for non-staff targets of its own school. FN-M27-8.1.6, FR-M27-92 and DV-M27-17 also say "no Login As" without this fact, and no matrix element records the server's "Menyamar". This is the AUD-M27B-01 pattern again: a server-evidenced control dropped on a false statement.
Fix: correct the section 16 row ("Delete and role change are not offered; 'Menyamar' is offered for own-school pupils and teachers"); add a matrix element (for example EL-S6-22 "Menyamar" / `ImpersonateController`) with status N and the real reason (security-sensitive, outside rows L51-L58, no M27 owner contract beyond M02's admin "Login As") or adopt it; record it in DV-M27-21; add it to the G1 list (G1-8) because it is a privileged capability. Matrix totals become 105 = 55 M + 28 MD + 22 N.

**R2-02 (Minor) - New S12 breaks the "no password in pages" rule without a carve-out.** FN-M27-2.3.3, FR-M27-47, NFR-M27-10, AC-M27-14.4 and E2E-M27-44 say no password appears in pages. S12 renders the typed or default password in the one-time credential block (FN-8.3.3; endpoint #19 returns it). Fix: add "except the one-time credential block of S12 (BR-M27-41)" in those five places and keep E2E-44 on P1 and P4 without a create.

**R2-03 (Minor) - "Aktif" and "Tidak Aktif" count cards are tagged S and A but exist in neither.** FN-M27-8.1.1, FR-M27-88 (and the S7 equivalents) cite `users.blade.php` `roleStats` and M02 FR-M02-02; both produce role cards (Pelajar, Guru, Admin Sekolah, ...), not active/inactive cards. The set "Pelajar / Aktif / Tidak Aktif" is a rebuild composition (carried over from v1.4, missed in round 1). Fix: tag the Aktif and Tidak Aktif cards P and add them to SRS section 20.2.

**R2-04 (Minor) - S12 password rule differs from the M02 contract it calls.** BR-M27-41 and the S12 hint require 8 to 255 characters (server), while S11 and M02 S2/S3 require at least 6 (M02 section 5), and XR-M27-17 `createPupil` "reuses the admin validation". DV-M27-19 does not list this adaptation. Fix: either use M02's rule (6) and mark the server's 8 as not adopted, or keep 8 and add it to DV-M27-19 and XR-M27-17 (M02 must accept the stricter rule for this entry point).

**R2-05 (Minor) - Hygiene.** (a) SRS section 0.1 (Part A body) gained a Part B sentence, outside the allowed Part A edits (two link-status rows and titles); move it to section 14 or accept it explicitly. (b) The SRS total line says 5 provisional scenarios while E2E-M27-97 also carries a provisional variant; say "5 tagged, plus the variant in 97".

## Required for round 3

Fix R2-01 (with the totals update); R2-02 to R2-05 may go in the same pass. Re-check scope: URS section 16 row, FN-8.1.6, FR-92, DV-17/21, matrix summary line, G1 list, and the five password statements. No other area needs re-audit.

---

# Round 3 (URS/SRS v1.6, targeted)

| Field | Value |
|---|---|
| Date | 2026-10-03 |
| Scope | The round 2 findings R2-01 to R2-05 and everything the v1.6 changes touch (S6 and S7 "Menyamar", endpoints #20 and #21, matrix, G1 list, password statements, count cards); counts and traceability re-run by script; Part A re-diffed against the committed v1.4 |
| Method | `ImpersonateController`, `users.blade.php`, `impersonation-banner.blade.php` read in full for the adopted behaviour; M01/M02 SRS and repo checked for the "no return path" premise of XR-M27-21; scripts `m27b-audit/r2.js`, `r3.js` |

## Round 3 verdict: PASS (0 Critical, 0 Major, 3 Minor)

Every round 2 finding is closed. No new Critical or Major. The three Minors are cosmetic or traceability gaps that can be fixed in the same edit as G1 approval.

## Closure of the round 2 findings

| Finding | Status | Evidence |
|---|---|---|
| R2-01 (Major) "Menyamar" claim | Closed | The false statement is gone: URS section 16 now reads "Delete and role change are not offered ... The server's 'Menyamar' ... IS offered and is adopted" (urs ~line 1053); FN-M27-8.1.6, FR-M27-92, DV-M27-17, DV-M27-21 updated; new FT-M27-8.5, FN-8.5.1/8.5.2, US-M27-36, AC-36.1-36.5, FR-121..124, BR-M27-42, endpoints #20 and #21, E2E-103..105, EL-S6-22 (MD), SEC-M27-11/12, G1-8, XR-M27-21. Every adopted detail verified against the server: button copy "Menyamar", `title` "Log masuk sebagai pengguna ini", confirm "Log masuk sebagai {name}? Anda boleh kembali bila-bila masa.", disabled-state title "Akaun ini tidak aktif", flash "Anda kini menyamar sebagai {name}.", leave flash "Anda telah kembali ke akaun pentadbir.", banner "Mod menyamar — anda melihat sebagai {name}" with "Kembali ke Admin" (sticky, amber, `fa-user-secret`, `fa-arrow-left-long`), guards (staff, self, inactive, other school, nested), audit rows `impersonate.start` / `impersonate.leave` (`ImpersonateController.php`, `impersonation-banner.blade.php`, `users.blade.php`). Adaptations are stated: HTTP codes instead of redirects (server 403 for another school, spec 404 to hide existence), return to S6/S7 instead of `/admin/users`, no suspension check (no M01 field). The XR-M27-21 premise is true: M02 #9, FR-M02-12 and BR-07 give "no return control / no return path", and no M01, M02 or M17 contract holds an impersonator (searched). Matrix arithmetic: 105 = 55 M + 29 MD + 21 N (script), reconciles with v1.5 (55/28/21 plus EL-S6-22 as MD). |
| R2-02 password statements | Closed | One-time credential exception stated in FN-M27-2.3.3, AC-M27-14.4, FR-M27-47, NFR-M27-10, E2E-M27-44 (run without an S12 create; the exception asserted in E2E-101) and BR-M27-41. |
| R2-03 count cards | Closed | One role card "Pelajar" / "Guru" (the server's `roleStats` card); "Aktif" and "Tidak Aktif" remain only as filter options. Consistent in FN-8.1.1, 9.1.1, AC-25.1, 28.1, FR-88, 99, section 20.1, 20.2 #17, section 22, E2E-83, 90, URS section 13. |
| R2-04 S12 password minimum | Closed | Stated in BR-M27-41, DV-M27-19, XR-M27-17 (M02 must accept a per-entry-point rule) and G1-9; S9 to S11 keep M02's 6. |
| R2-05 hygiene | Closed with one formatting side effect (R3-01) | The Part B sentence moved from section 0.1 to section 14.0; `git diff` of Part A against v1.4 now shows only titles, document-control rows and the two allowed link-status rows (plus one blank line, R3-01). Provisional line now says "5 tagged ... plus the provisional variant in E2E-97", matching the table. |

## Re-run checks (script, v1.6)

| Check | Result |
|---|---|
| Counts | 25 stories, 80 FN (80 unique), 112 AC, 87 FR (38-124), 24 BR (19-42), 71 E2E (35-105), 15 DV (08-22), 11 XR (11-21), 18 endpoints (#2-#21), 7 SEC (06-12), 6 NFR, 11 OQ, 9 G1 items. All equal the totals printed in both documents (URS 687 and 887, SRS 12, 561, 626, 940). `@blocked-by M18`: 7 scenarios; `@blocked-by XR-M27-21`: 104, 105. |
| Coverage matrix | 105 elements, 0 unmapped, no duplicate ids; 55 / 29 / 21 as printed. |
| Traceability | Every FR is in the US table and in an E2E; every AC is in an FR and an E2E; every FN is in an FR; no dangling FN or AC reference; every story has ACs (US-M27-36: FR 121-124, E2E 103-105). |
| Endpoints | #20 and #21 coherent with FR-122/123/124, BR-42, SEC-11/12, permissions matrix (section 21 row added), S6 and S7 API column (section 14.2), AC-36.4 status codes. |
| Part A | Untouched except titles, document-control cells and the two link-status rows (URS section 8, SRS 2.1). |

## New findings

**R3-01 (Minor) - Markdown side effect of the §0.1 revert.** `srs/M27-school-admin.md` line 30: removing the Part B sentence also removed the blank line between the section 0.1 paragraph and the `---` rule, so many renderers show that paragraph as a level-2 heading (setext). Restore the blank line (the committed v1.4 had it).

**R3-02 (Minor) - Blocked tag missing in the URS.** AC-M27-36.2, 36.3, 36.4 and 36.5 depend on XR-M27-21 (a session switch with a return path that M01 does not have) but carry no `@blocked-by XR-M27-21` marker; only E2E-104 and E2E-105 in the SRS do. Add the marker to those four ACs (as the S4 ACs do for M18) so they stay out of the G5 gate until M01 provides the contract. AC-36.1 can run.

**R3-03 (Minor) - Banner owner request.** XR-M27-21 asks M01 for the session switch and says the shell can read the impersonation state, but nothing asks the shell owner to render the sticky banner "Mod menyamar — anda melihat sebagai {name}" with "Kembali ke Admin" on every page (XR-M27-11 is the shell request and does not mention it). Add (e) to XR-M27-11 or name the shell as co-owner in XR-M27-21.

## Overall status of Part B (v1.6)

Across three rounds: 2 Major and 14 Minor (round 1), 1 Major and 5 Minor (round 2), 0 Major and 3 Minor (round 3), all Majors fixed with evidence. Part B can proceed to G1 once R3-01 to R3-03 are tidied; none needs re-audit. Remaining user decisions are the nine items of URS section 17.1 (G1-1 to G1-9), the most consequential being G1-1 (school admin activates teachers), G1-2 (accounts created active) and G1-8 (impersonation).
