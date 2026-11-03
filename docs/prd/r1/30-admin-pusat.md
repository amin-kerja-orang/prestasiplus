# SRS — Admin Pusat / Portal Pentadbiran (R1)

> **Read this first.** V3 already exists. Each screen's *Action* and *Current gap* say what to change. The *Screen specification* describes the target behaviour; it is **not** an instruction to rebuild the screen. Before coding a card: (1) run a code gap check of the existing V3 code against every FR/AC of the card and post it on the issue (FR/AC → works / broken / missing, with file:line); (2) change only what is broken or missing, in the existing files; (3) prove the ACs, including the AC-CHAIN that passes through the screen (40 §X9).

| | |
|---|---|
| Purpose | Software requirements specification of the Admin Pusat (central admin, Portal Pentadbiran) of PrestasiPlus V3: every screen, field, action and state, enough to build it without opening V1 or V2. |
| Scope | Screens that feed, manage and monitor the 1.0 portals (Murid, Guru, Admin Sekolah) and the rest of the ticked matrix (section 4.H). Out of scope: section 6. |
| Roles | Admin Pusat (role `admin`) is the only role that writes; Admin Sekolah and PPD are KIV for the writing screens (A2). Guru and Admin Sekolah are denied on these screens. |
| Related | [00-index](00-index.md), [01-product-overview](01-product-overview.md), [02-urs](02-urs.md), [40-cross-cutting](40-cross-cutting.md), [50-data-model-erd](50-data-model-erd.md), [60-api-contract](60-api-contract.md) |
| Screen specs | Each screen has a "Screen specification (from V2)" subsection: route, title, regions, fields, columns, filters, buttons, states. Where V2 was not observed it says "Not observed in V2 — follow FR-...". Question entry and import follow FR-X1-4, D90, D105 and the DSKP, not V2. |

Status: draft for user review, fix pass 2026-11-04 applying TRACKER D100-D108. Branch `docs/r1-prd-devplan`. Language: English; every UI string is quoted in exact BM from V2 (or V1 where stated). Copy that is not found in V2/V1 is tagged [PROPOSED] and collected in section 8.4 for approval (D94).
Governing principle (user): "berdasarkan V2+V1 untuk betulkan V3". V2 (`/admin` Blade + Panel admin.prestasiplus.cloud) is primary; V1 is fallback. D79: the Portal Pentadbiran absorbs the Panel and follows .cloud mechanisms and admin UX. D77: no UX change beyond the request. Only the visual theme (Nuxt UI) may differ.
Names: V1 = prestasiplus.my, V2 = prestasiplus.cloud + admin.prestasiplus.cloud, V3 = this build (repo docs say "v2"). GH = V3 build on branch `feature/v3-bijak-r1` (local 5193). UAT = uat.prestasiplus.cloud.
Privacy: no real person name appears in this document.

Evidence base (read, not guessed): the gap analysis files (GAP-ANALYSIS-FULL, ADMIN-PUSAT, FUNCTIONAL-E2E, MATRIX-EVIDENCE); the live sidebars (V2 90 links, V1 87; item list and order) and the V2 sidebar source `resources/views/admin/layout.blade.php:195-727` (group headings); V2 code `D:\Dev Projects\prestasiplus-reference\backend` (routes, `resources/views/admin/**`, `config/features.php`); `docs/discovery/cloud-student-mechanism.md` section 3 (DISC); `docs/discovery/v2-parity/admin.md` (PAR); `docs/discovery/M02-users-schools.md` (V1 users); V3 code (paths cited per screen); `docs/TRACKER.md` D28-D108.
Live V2 was not logged into for this PRD. Anything only live V2 can settle is in section 8.3.

### 0. Conventions
**ID formats.** Screen `R1-ADM-<area>-<nn>` (e.g. R1-ADM-Q-01) has requirements `FR-ADM-<area><nn>.<k>` and `AC-ADM-<area><nn>.<k>` (e.g. FR-ADM-Q01.1, AC-ADM-Q01.2), numbered 1..n per screen with no gaps. Areas: `Q` question pipeline, `C` curriculum, `N` content and settings, `U` users and schools, `M` monitoring and reports, `P2-<nn>` the screens for the rest of the matrix (FR-ADM-P2-01.1; "P2" is only an ID prefix, not a delivery phase). Cross-screen blocks: `QE-<n>` question-entry standard (FR-ADM-QE1.1), `G5`/`G6`/`G7` DSKP guidance flows (AC-ADM-G5.1) and the stimulus-less defect (FR-ADM-G7.1), `R` responsive (FR-ADM-R0.1, AC-ADM-R1..R11), `H0` rules for the matrix-wide screens (FR-ADM-H0.1). Open questions `OQ-*`, evidence `E-*`, UAT data tasks `U-OP-*`, fidelity deviations `FD-*`.
**Priority.** Module priority: a 1.0 module is P0 when the gap analysis rates it Kritikal or Tinggi or it is empty/broken today (Murid 3, 4, 6, 7, 9, 13, 14, 16, 21, 54; Guru 44), otherwise P1. D106: a screen's priority is never lower than the highest priority of the 1.0 module it feeds (feeding = creating the data the module shows). Screens that only monitor, or that duplicate a function available elsewhere, may be lower. P0 = blocks a 1.0 module today; P1 = needed for sign-off or feeds a P1 module; P2 = completeness and does not feed a 1.0 module. Delivery order (D106): 1.0 columns first, then the rest of the matrix; a module linked from a 1.0 screen (Artikel N-02, Set Soalan Guru (teacher-fed), Papan Pendahulu P2-04/P2-15) ships with the first delivery.
FR = functional requirement (one testable statement). AC = acceptance criterion (Given/When/Then). "E2E" = reaches a pupil on UAT.
**Question status words (F-19).** One table for labels and filter values: `draft` = Draf (filter `draft`); `review` = Menunggu Semakan / Reviewed (filter `review`, not `reviewed`); `approved` = Diluluskan / Approved (filter `approved`); `archived` = Diarkibkan (filter `archived`). A rejected teacher question is `draft` with a reason.
**Terms (D-A5, D-A6).** "Bab" always means the textbook chapter (Kurikulum `chapters`, `chapter_id`); the DSKP level is "Tajuk DSKP" (never "Unit" or "Unit (Bab)"). TP (1 to 6) and difficulty (1 to 5) are different fields; "Kesukaran" (`Mudah` / `Sederhana` / `Sukar`) is derived from difficulty.
**V2 reference screens.** Developers and agents never open V1 or V2. Every screen below carries a "Screen specification (from V2)" subsection written from the live desktop pages (`/admin` Blade pages and the admin.prestasiplus.cloud Panel; in V2 captures a number precedes its label, tiles are read "number then label"). Each screen has a line "Action: Keep | Fix | Complete | Build"; the gap and the V2 contradictions are in the register 4.V.2. In the register, `/admin/...` routes are the V2 Blade pages and "Panel /..." routes are the Panel. Question STRUCTURE follows FR-X1-4, D90 and D105, not V2.
**Allowed strings.** Pratonton (admin preview action) is a legitimate admin action in V2 (`Pratonton`, `Pratonton pelajar`) and is allowed; the "no placeholder" rule (FR-ADM-H0.2, AC-X2-3) forbids only "akan datang", "belum tersedia dalam demo", mock-only paths and a control that does nothing.

---

## 1. Purpose and scope

### 1.1 Problem (evidence, 2026-11-03/04)
| # | Fact | Source |
|---|---|---|
| 1 | Three lists are all called "Bank Soalan": `/admin/questions`, `/admin/studio`, `/admin/spm/soalan`. | GAP 5.4; `menu.ts` BS-01, BS-08, KS-02 |
| 2 | "Import & Semakan" (BS-02) and "Senarai Ekstrak" (KS-14) open the same screen `/admin/spm/soalan/ekstrak`. | `menu.ts:96,114` |
| 3 | "Pembina Kertas" (KS-09 `/admin/spm/kertas`) and "Set Builder" (KS-17 `/admin/studio/sets`) list the same papers. | GAP 5.4; E2E F4 |
| 4 | Two review queues disagree: Studio "Menunggu Semakan" = 3, "Baris Gilir Semakan" = 0. | E2E F3 |
| 5 | PDF extraction hangs on "Sedang diproses" for ever (no worker, no OCR). | E2E F2; `jobs.worker.ts:13`, `jobs.config.ts:15,33`, `ocr.config.ts:38`, `env.schema.ts:169,175` |
| 6 | Imported, CSV and manual questions cannot be published without hand editing (publish needs unit + SP + thinking level + paper; CSV has no such columns; paper chosen at upload is not carried). | E2E F1/F2; `dskp-gate.ts:19-23`; HTTP 422 on `POST /api/questions/:id/status` |
| 7 | All 8 contracts are "Spec"; "Disahkan" cannot be picked in the Sumber select. Every paper publish needs an exception. UAT has 0 contracts, 0 papers. | E2E F4/F7; `kontrak/domain/form.ts:65,251` |
| 8 | UAT: 339,112 published questions, all "Belum ditanda DSKP", each "Dilihat murid di 0/6"; T5 pupil sees "Tiada subjek bab tersedia untuk tahap ini." | GAP 5.3; `ChapterIndexPage.vue:55-60`; `overview.repository.ts:136-140` |
| 9 | UAT still shows 11 education levels (Darjah active). | GAP 5.3; D72/D96 |
| 10 | SPM hub has 2 of 6 lane cards; Tracking A and Kertas Subjektif admin return 404; Sumber Kertas missing. | `admin-kandungan.ts:13-29`; E2E F5/F6 |
| 11 | Kiriman Guru: `/admin/question-submissions` shows "Fungsi ini belum tersedia dalam demo"; teacher PDF paper submit = 503 (`UnavailablePaperIntake`, `provideIntake` never called). | E2E F9; `question-sets.ports.ts:46,56,63`; `submissions-unavailable.ts:7` |
| 12 | Dashboard, Analitik, Laporan, Laporan Eksekutif routes are empty files in M17; Tetapan Permainan, Video, Kawalan Ciri, Kelas, Import Pengguna have no menu entry or screen. | `m17/routes/{dashboard,analytics,laporan,laporan-eksekutif}.ts`; ADMIN-PUSAT rows 2,4,7,8,21,41 |

### 1.2 Goal
After this PRD is built, an Admin Pusat can, on UAT and without a developer: load/verify the curriculum, put questions in (PDF, manual, CSV, teacher), tag and approve them, build and publish papers under a Disahkan contract, manage Tracking A sets, create users/schools/classes, control the few flags 1.0 needs, and watch the result; and a T5 pupil, a teacher and a school admin each see what the admin published.

### 1.3 In scope
Admin Pusat screens that feed, manage or monitor every 1.0 module (section 2). Capabilities A to E (section 4), UAT data operations (section 5).

### 1.4 Rest of the matrix and out of scope
User decisions D100-D102, D106 (2026-11-04): every ticked module must be fully working, so section 4.H specifies the admin screens for Murid A4 (Tiket Bantuan) and rows 16-40 except 15 and 37, built after the 1.0 columns unless a 1.0 screen links to them (D106): Gamifikasi, Kedai Hadiah (+ Digital), Kawalan Reward, Kotak Misteri, Cabutan, Marketplace, Tournament, Ranking/Leaderboard, Jemput Ibu Bapa links, Audio KBAT, Artikel/Banner/Nota/Video, Rujuk Kawan settings, full Kawalan Ciri. There are no placeholders anywhere (FR-ADM-H0): no "akan datang", no "belum tersedia dalam demo", no mock-only path. T1-T3 pupils are served like V2 (D101), so curriculum and DSKP tasks cover Tingkatan 1-5; Darjah stays hidden (D96). Out of scope (one line each in section 6): Penajaan/Anak Angkat/Duta (row 15), Chatbot and Pusat AI (row 37, D73), billing, Tetapan beyond the support contact (N-07), Log Audit viewer, Notifikasi, Tanda Karangan (AI), student self-service Jana Kertas (D88).

### 1.5 Assumptions
- A1. One question store (M04 owner, D12): `/admin/questions` and `/admin/studio` read the same `GET /api/questions`; "legacy bank" in V3 is a list style, not a second database.
- A2. Role `admin` (Admin Pusat) is the only role that writes in these screens. Admin Sekolah/PPD are KIV for the writing screens (R1-21 note; D86).
- A3. Approved = servable (D80 AS-1, D85 U2). Papers need Terbit.
- A4. UAT has no AI session acting on servers (D95). Server/env changes are done by the operator named in section 5.
- A5. Pupil surfaces read the same rules code as the admin indicator (R1-17.2 contract test).

---

## 2. Feed map: every 1.0 module to the admin capability that feeds it

Columns: module (matrix row) | what the admin must do for the module to have content or work | screen | R1-ADM IDs | today (GH / UAT).

### 2.1 Murid 1.0
| Module | What the admin does | Screen(s) | R1-ADM | Today |
|---|---|---|---|---|
| A1 Profil Saya, A2 Tetapan Peribadi, A3 Panduan, A5 Log Keluar | Account exists with role, school, Tingkatan; Panduan text and the support contact that Panduan reads (`/api/config/support` returns 404 on UAT, GAP row A3) | Pengguna; Tetapan (support contact); Artikel/Nota (Panduan content) | U-01..U-03, N-07, N-02, N-04 | GH ok / UAT ok except support contact 404 |
| 2 Dashboard | Banner, Artikel shown on the 1.0 Dashboard; subjects exist | Banner, Artikel, Subjek | N-02, N-03, C-02 | built both; verify only |
| 3 Headcount | None (teacher-entered); the central count view M-07 is a monitoring view, not a feeder | none | none | no admin feed needed |
| 4 Prestasi | None (derived from sessions); user/school/class links must exist | Pengguna, Sekolah, Kelas | U-01, U-04, U-08 | ok; student side defect out of this PRD |
| 5 Analitik Adaptif | Curriculum nodes (SP) so mastery maps to DSKP | Kurikulum, DSKP loader | C-01, C-04 | UAT `curriculum_nodes` unverified |
| 6 Analisa Item | Approved, tagged questions; Kualiti Soalan | Studio, Kualiti tab | Q-03, Q-04, Q-21 | Kualiti ok; Q-21 monitors quality, it does not feed the module |
| 7 Video | Add/moderate videos per subject and Bab | Video | N-01 | BE ok; no Pentadbiran screen |
| 8 Kelas Saya | Classes exist, teacher linked | Kelas Sekolah | U-08 | no admin list |
| 9 Soalan by Chapter | Bab/Topik/SP exist; questions linked to a Bab | Kurikulum, Studio "Bab", Tetapkan Bab | C-01, C-05, Q-04 | UAT 0 of 339,112 linked |
| 12 Remedial | None (derived from wrong answers; needs approved questions) | Studio | Q-03 | no admin screen in V1/V2 |
| 13 SPM: Databank | Approved objective questions per subject, figure questions and whole stimulus groups included (D105) | Studio, hub lane `Databank Soalan` | Q-01, Q-02, Q-03, Q-04, Q-05 | lane exists |
| 13 SPM: Bijak SPM | Contract Disahkan, questions tagged, paper built and Terbit | Kontrak, Set Builder, Semak Kertas | Q-13, Q-14, Q-15, Q-16 | UAT 0 contracts, 0 papers |
| 13 SPM: Tracking A | Fill each set to its `target_count` | Tracking A editor | Q-17 | 404; UAT 0 sets |
| 13 SPM: Subjektif | Structured/subjective questions with scheme (lane) and Kertas Subjektif papers (D81), both fully working at release (D104) | Soalan Berstruktur, Kertas Subjektif | Q-18, Q-23 | 404 / read-only |
| 14 Heatmap Topik Lemah | Bab/Topik mapping on questions | Kurikulum, Tetapkan Bab | C-01, C-05 | empty on UAT |
| 16 Latih Tubi (user-added) | Approved questions, figures and groups included (D105); Kawalan Ciri switch `latih-tubi`; T1-T5 (D101) | Studio, Kawalan Ciri | Q-03, N-06 | works T5; no toggle; T1-T3 "akan datang" |
| 21 Permainan | Game settings; `permainan` switch | Tetapan Permainan, Kawalan Ciri | N-05, N-06 | BE only |
| 54 Laporan Soalan | Triage pupil reports (Arkib / Tolak) | Laporan Soalan | Q-22 | built; row action unverified |

### 2.2 Guru 1.0
| Module | What the admin does | Screen | R1-ADM | Today |
|---|---|---|---|---|
| 1 Command Center | Schools, teachers, classes exist | Langsung | M-02, U-04 | built |
| 2 Dashboard, 3 Headcount, 4 Prestasi, 5 Analitik Adaptif, 6 Analisa Item | As Murid rows | as above | C-01, Q-21 | see Murid |
| 7 Video, 8 Kelas Saya, 9 Soalan by Chapter | As Murid rows | N-01, U-08, C-05 | | |
| 10 Monitoring | Central monitoring parity | Monitoring | M-03 | menu points at `/guru/monitoring` (`menu.ts:62`) |
| 11 Kirkpatrick (7 screens) | None; central parity | Kirkpatrick | M-04 | built |
| 41 Pelajar Saya | Create/import pupils, link to class | Pengguna, Import Pelajar, Kelas | U-01, U-05, U-08 | PS-04 built, PS-05 hidden |
| 42 Laporan, 43 Laporan Mingguan | Central Laporan | Laporan | M-06 | empty (`m17/routes/laporan.ts`) |
| 44 Sumbang Soalan | Review what teachers send: single questions and paper PDFs | Import & Semakan tab `Kiriman Guru`, Studio | Q-12, Q-07 | single OK; paper 503; tab "belum tersedia" |

### 2.3 Admin Sekolah 1.0
| Module | What the admin does | Screen | R1-ADM | Today |
|---|---|---|---|---|
| 1 Command Center, 3 Headcount, 4 Prestasi, 5, 6, 7, 10, 11 | As Guru rows | as above | M-02..M-04, N-01 | |
| 45 Sekolah Bersaing, 46 Statistik Penggunaan, 48 Laporan Aktiviti, 49 Amaran Awal, 50 Laporan Bulanan | School-level screens (M27/M18) built; the admin feeds them only through users, schools, classes (U-01..U-08) and pupil activity. M-07 (central views, P2) monitors the same figures and feeds none of these modules | Pengguna, Sekolah, Kelas | U-01, U-04, U-08 | school screens built; data defects belong to the Admin Sekolah PRD |
| 47 DSKP Heatmap | Needs DSKP nodes (SP) and pupil mastery tagged to them | Kurikulum tab `DSKP`, DSKP load | C-01, C-04 | all cells "–" on GH (no mastery data); UAT nodes unverified |
| 51 Senarai Pelajar, 52 Senarai Guru | Create AS account ("Janakan Akaun"), school, pupils, teachers | Pengguna, Sekolah, Import Pelajar | U-01..U-06 | built; AS account on UAT not yet created |
| 53 Kelas Sekolah | Classes per school | Kelas Sekolah | U-08 | no admin list |
| (subscription gate) | School package T4/T5 | Langganan Sekolah | U-09 | built (KW-05) |

### 2.4 Feed map for the rest of the matrix (D100, D106): ticked Murid modules A4 and 16-40 (except 15, 37)
| Module (row) | What the admin does | Screen | R1-ADM |
|---|---|---|---|
| 16 Latih Tubi | see 2.1 | Studio, Kawalan Ciri | Q-03, N-06 |
| 17 Soalan Berstruktur | edit structured questions and schemes | Soalan Berstruktur, Studio | Q-23 |
| 18 Kedudukan, 33 Papan Pendahulu | read views, period reset | Ranking Sekolah, Leaderboard, Gamifikasi Pelajar | P2-15, P2-04 |
| 19 PKSK | PKSK questions and access | Soalan PKSK, Akses PKSK (built) | menu group Premium |
| 20 Artikel | CRUD | Artikel, Banner, Nota | P2-18 |
| 22 Cabutan Bertuah | create and draw | Cabutan | P2-10 |
| 23 Tournament | create and run | Tournament, Liga | P2-14 |
| 24 Topik, 25 Peta Belajar | Bab/Topik | Kurikulum | C-01 |
| 26 Set Soalan Guru | fed by the teacher "Set Soalan" screen of the Guru portal (V2 `/guru/set-soalan`, D108(3)); the admin has no screen for it (the admin's part is the question bank and Kurikulum the teacher picks from) | none in Pentadbiran | Guru PRD |
| 44 Sumbang Soalan (Guru 1.0) | review what teachers send through Sumbang Soalan / Hantar Kertas | Kiriman Guru | Q-12 |
| 27 Audio KBAT | audio sets | Audio KBAT | P2-17 |
| 28 Syiling & Token, 29 Tukar Token, 30 Cabaran Harian | economy | Gamifikasi | P2-01..05 |
| 31 Kedai Hadiah, 38 Kedai Hadiah Digital | catalogue, costs, redemptions | Kedai Hadiah, Tebusan, Kawalan Reward | P2-07..09 |
| 32 Marketplace | products and sellers | Marketplace | P2-12, P2-13 |
| 34 Pencapaian, 39 Timeline | no admin screen found | none | OQ-H3 |
| 35 Kotak Misteri | box config | Kotak Misteri | P2-11 |
| 36 Rujuk Kawan | referral settings | Tetapan Gamifikasi | P2-06 |
| 40 Jemput Ibu Bapa | parent links | Pengguna (tab Ibu Bapa) | P2-16 |
| A4 Tiket Bantuan (ticked for Murid, Guru, Admin Sekolah, D100) | answer pupil/teacher tickets; support contact | Tiket Bantuan, Tetapan | P2-20, N-07 |
| switch any module on/off | flags | Kawalan Ciri | P2-19 |

---

## 3. Target admin menu (FINAL, D107)

TRACKER D107 (user, 2026-11-04) approved this menu: the admin menu follows the V2 sidebar (groups, order, labels), with one "SOALAN" group, and the V3 duplicates removed from the menu with their screens merged or redirected (no function lost). OQ-01 and OQ-04 are closed. Kontrak Simulasi has no sidebar entry; it is opened from Set Builder and from paper review (`Sunting kontrak`), as in V2 (DISC 3.7). Source of the V2 order and labels: the live V2 sidebar plus `resources/views/admin/layout.blade.php:195-727`. An item appears in the rendered menu only when its screen works (FR-ADM-H0.2); items not yet built stay in `PENTADBIRAN_FULL_MENU` with `built:false`.

### 3.1 Sidebar groups and order (V2 order and labels)
V2 section headings are uppercase (HARIAN, ANALITIK, PENGURUSAN, SISTEM); collapsible groups are title case. V3 uses the same words (V3 renders headings in its own typographic style).
| # | V2 section / group | Items in order (label, V3 route) | V3 vs V2 |
|---|---|---|---|
| 0 | top shortcuts | `Command Center` with pill `LIVE` `/admin/command-center`; `Aktiviti Harian` `/admin/command-center/daily-activity`; `Audio KBAT` `/admin/audio-kbat` | V3 labels today: `Langsung` (PM-01), `Aktiviti Harian`, BS-07. Label `Langsung` -> `Command Center` (V2 label). Conflict D77 (restored V3 labels) vs D107 (follow V2): see 8.2 OQ-L1 |
| 1 | HARIAN | `Dashboard` `/admin`, `Laporan Eksekutif` `/admin/laporan-eksekutif` | PP-01, PP-02. `Laporan Eksekutif` appears when M-08 works |
| 2 | ANALITIK | `Analitik` `/admin/analytics`; `Monitoring` `/admin/monitoring`; group `Kirkpatrick`: `Overview`, `T1: Reaksi`, `T2: Pembelajaran`, `T3: Tingkah Laku`, `T4: Hasil`, `Rantaian Impak`, `Intervensi` (`/admin/kirkpatrick...`); `Laporan` `/admin/laporan` | V3 today: `Ringkasan`, `Tahap 1: Reaksi`.. (PM-05..11) -> V2 labels; PM-03 route fixed; `Laporan` added; PM-12..PM-28 stay hidden |
| 3 | PENGURUSAN > group `Kurikulum` | `Kurikulum` `/admin/curriculum`, `Subjek` `/admin/subjects`, `Tahap Pendidikan` `/admin/education-levels` | KK-01, 02, 04; KK-03 `Bab` removed (screens inside Kurikulum) |
| 4 | PENGURUSAN > group `Soalan` | see 3.2 | CHANGE (merge of "Bank Soalan" and "Kertas & SPM") |
| 5 | PENGURUSAN > group `Pengguna` | `Senarai Pengguna` `/admin/users`, `Sekolah` `/admin/schools`, `Langganan Sekolah` `/admin/school-subscriptions`, `Import Pelajar` `/admin/import-students`, `Pelajar Komplimen` `/admin/comp-students`, `Import Pengguna` `/admin/users/bulk-import`, then V3 addition `Kelas Sekolah` `/admin/classes` | V3 label `Pengguna` -> `Senarai Pengguna`; KW-05 moves here; `Kelas Sekolah` is not in V2 (V2 manages classes inside Sekolah, E-04) = FD-MENU-1; `Penajaan`, `Anak Angkat`, `Permohonan` stay hidden (D102) |
| 6 | PENGURUSAN > group `SPM` | `Databank Soalan` `/admin/spm/databank`, `Latih Tubi` `/admin/spm/latih-tubi`, `Tracking A` `/admin/spm/tracking-a`, `Subjektif` `/admin/spm/subjektif` | V2 links these four to the pupil pages (`/spm/tahun-lepas`, ...); in V3 they open the admin lane page, which carries a link `lihat sisi pelajar` = FD-MENU-2 (V2 sends the admin to the pupil page, which shows the admin's own empty history) |
| 7 | PENGURUSAN > group `Premium` | `PKSK Soalan` `/admin/pksk/questions`, `PKSK Akses` `/admin/pksk/access` | BS-06, KW-06; V3 label `Akses PKSK` -> `PKSK Akses` |
| 8 | SISTEM | `Kawalan Ciri` `/admin/feature-toggles` | SY-02 (N-06, P2-19) |
| 9 | SISTEM > group `Gamifikasi` | `Overview`, `Tier Config`, `Cabaran`, `Pelajar`, `Transaksi`, `Kedai Hadiah`, `Kawalan Reward` (+ `Cabutan`, `Kotak Misteri` as sections of Kawalan Reward) | P2-01..11; `Gamifikasi Guru` hidden (teacher module outside the ticked set) |
| 10 | SISTEM > group `Battle & Permainan` | `Ranking Sekolah`, `Leaderboard`, `Tetapan Permainan`, `Tournament` | P2-14, P2-15, N-05; `Battle Live` (a pupil lobby link in V2) not offered |
| 11 | section `Marketplace` | `Produk`, `Penjual` | P2-12, P2-13 |
| 12 | section `Kandungan` | `Artikel`, `Banner`, `Nota`, `Screenshots`, plus V3 addition `Video` | V2 `Video` is Filament-only (no sidebar entry) = FD-MENU-3; `Notifikasi` hidden; V3 label `Upload Screenshot` is kept (D77 restored it) |
| 13 | section `Sistem` | `Tetapan` `/admin/settings` (support contact only, N-07), `Tiket Bantuan` `/admin/tiket` (P2-20) | `Tiket Bantuan` is reachable in V2 (`/admin/tiket`) but not in the captured sidebar; `Prestasi Sistem`, `Audit Logs`, `Chatbot` hidden |
| - | not rendered | `Kewangan` (`Pembayaran`, `Billing`, `Dunning`), `Kerjaya / Duta`, `Pusat AI`, `Pratonton Pelajar` | deferred or excluded (section 6) |

### 3.2 Group "Soalan" (exact)
| Pos | Label (exact) | Route (canonical = existing built route; V2 path = alias redirect) | Replaces |
|---|---|---|---|
| 1 | `SPM` | `/admin/spm` | KS-01 |
| 2 | `Bank Soalan (Studio)` | `/admin/studio` | BS-08 |
| 3 | `Import & Semakan` | `/admin/spm/soalan/ekstrak` (alias `/admin/studio/imports`), tabs `Kelompok Item`, `Kertas Diimport`, `Kiriman Guru` | BS-02, KS-14, KS-15, KS-13, KS-16 |
| 4 | `Set Builder` | `/admin/studio/sets` | KS-17, KS-09 |
| 5 | `Sumber Kertas` | `/admin/source-papers` | BS-03 |
| 6 | `Kertas Subjektif` | `/admin/kertas-subjektif` (alias `/admin/spm/kertas-subjektif`) | KS-07 |
| sub-group | `Bank Lama (Legasi)` | | |
| 7 | `Senarai Soalan` | `/admin/questions`, tabs `Kualiti`, `Laporan` | BS-01, BS-04, BS-05 |
| 8 | `Soalan Berstruktur` | `/admin/structured-questions` | route exists, no menu today |

### 3.3 Mapping of every current V3 question-area menu ID
Actions: KEEP, MERGE (into target), HIDE (route stays reachable by link/button, no sidebar entry), REMOVE (entry and placeholder deleted).
| Current ID | Current label / route | Action | Target | Reason |
|---|---|---|---|---|
| BS-01 | Bank Soalan `/admin/questions` | MERGE (rename) | `Senarai Soalan` under Bank Lama | V2 names it "Senarai Soalan"; removes duplicate "Bank Soalan" |
| BS-02 | Import & Semakan `/admin/spm/soalan/ekstrak` | KEEP (retab) | `Import & Semakan` | V2 `/admin/studio/imports` |
| BS-03 | Sumber Kertas (hidden) | KEEP (build P2) | `Sumber Kertas` | in V2 SOALAN group; D83 D-10 superseded for the menu only (OQ-05) |
| BS-04 | Kualiti Soalan `/admin/questions/quality` | MERGE | tab `Kualiti` of Senarai Soalan | V2 has tabs inside (DISC 3.0) |
| BS-05 | Laporan Soalan `/admin/question-reports` | MERGE | tab `Laporan` of Senarai Soalan | same |
| BS-06 | Soalan PKSK | KEEP (move) | group Premium, label `PKSK Soalan` | V2 group |
| BS-07 | Audio KBAT | KEEP (move) | top shortcut `Audio KBAT` | V2 top-bar shortcut |
| BS-08 | Bank Soalan (Studio) `/admin/studio` | KEEP | `Bank Soalan (Studio)` | V2 canonical bank |
| KS-01 | SPM `/admin/spm` | KEEP | `SPM` | hub |
| KS-02 | Bank Soalan SPM `/admin/spm/soalan` | HIDE | none; list redirects to `/admin/spm/databank`; `/admin/spm/soalan/:qid/sunting` stays as Quick Edit | third "Bank Soalan"; invented by V3 |
| KS-03 | Latih Tubi (hidden) | MERGE | hub lane card and group `SPM` item `Latih Tubi` | V2 lane + V2 group SPM |
| KS-04 | Tracking A (hidden) | MERGE | hub lane card and group `SPM` item `Tracking A` | same |
| KS-05 | Subjektif (hidden) | MERGE | hub lane card and group `SPM` item `Subjektif` | same |
| KS-06 | Bijak SPM (Simulasi) (hidden) | MERGE | hub lane card `/admin/spm/simulasi` (V2 has no group-SPM item for it) | V2 lane |
| KS-07 | Kertas Subjektif (hidden) | KEEP (build) | `Kertas Subjektif` | V2 |
| KS-08 | Kontrak Simulasi `/admin/spm/kontrak` | HIDE | opened by button `Kontrak Simulasi` on the Set Builder landing and `Sunting kontrak` in the Set Builder and Semak Kertas panels; the direct URL works | V2 has no sidebar entry (DISC 3.7); D107 closes OQ-04 |
| KS-09 | Pembina Kertas `/admin/spm/kertas` | MERGE | `Set Builder`; list route redirects to `/admin/studio/sets`; `/admin/spm/kertas/:id` stays as "Semak Kertas Simulasi" reached from lane row `Sunting` | same paper list twice |
| KS-10 | Tanda Karangan (hidden) | REMOVE from definition | none | AI; D73; PAR A24 |
| KS-11 | Ramalan SPM (hidden) | REMOVE | none | merged into Tracking A (PAR A26) |
| KS-12 | Set Soalan (hidden) | REMOVE | none | same |
| KS-13 | Muat Naik Kertas | HIDE | button `Muat Naik Kertas` in Import & Semakan header and `Import PDF` button in Studio header (D83 D-5) | action, not a destination |
| KS-14 | Senarai Ekstrak | MERGE | tab `Kelompok Item` | same screen as BS-02 |
| KS-15 | Baris Gilir Semakan `/admin/spm/semakan` | MERGE | pending extract items live in tab `Kelompok Item` (column `Disemak`); pending questions live in Studio status tile "Reviewed"; route redirects to `/admin/studio?status=reviewed` | two queues disagree |
| KS-16 | Tulis Soalan Manual | HIDE | button in Import & Semakan header; Studio `Cipta baharu` is the V2 path | action |
| KS-17 | Set Builder `/admin/studio/sets` | KEEP | `Set Builder` | V2 |
| (route, no ID) | Soalan Berstruktur `/admin/structured-questions` | KEEP (add) | Bank Lama | V2 |
| (route, no ID) | Kiriman Guru `/admin/question-submissions` | MERGE | tab `Kiriman Guru` | V2 tab |
| (route, no ID) | Import CSV `/admin/questions/import`, `/admin/questions/import-history` | HIDE | button `Import CSV` in Senarai Soalan header (V1 location) and Import & Semakan | action |

Post-change counts: question area goes from 3 "Bank Soalan" + 17 KS/BS items to 8 sidebar items.

### 3.4 Non-question menu changes (final, D107)
| ID | Change | Reason |
|---|---|---|
| PM-01, PM-02 | move to top shortcuts; label `Command Center` + `LIVE` | V2 sidebar |
| PM-03 | label `Monitoring` route `/guru/monitoring` -> `/admin/monitoring`; moves to ANALITIK | admin sees a teacher route (`menu.ts:62`; GAP 6) |
| PM-04 | built at `/admin/analytics`; ANALITIK | V2 `Analitik` |
| PM-05..PM-11 | group `Kirkpatrick`, V2 labels `Overview`, `T1: Reaksi`, `T2: Pembelajaran`, `T3: Tingkah Laku`, `T4: Hasil`, `Rantaian Impak`, `Intervensi` | V2 sidebar |
| new | `Laporan` `/admin/laporan` | V2 sidebar |
| PS-01 | label `Senarai Pengguna` | V2 |
| PS-03, PS-05 | `Kelas Sekolah` at `/admin/classes` (route name chosen by the architect) and `Import Pengguna` at `/admin/users/bulk-import` | V2/V1; FD-MENU-1 |
| KK-03 | removed placeholder | screens inside Kurikulum |
| KK-08 | `Video` built, group `Kandungan` | N-01; FD-MENU-3 |
| PG-01..PG-06, 09..15 | built as P2-01..P2-15 inside groups Gamifikasi, Battle & Permainan, Marketplace | D100 |
| SY-01, new | `Tetapan` (support contact) and `Tiket Bantuan` | N-07, P2-20 (D108(4)) |
| SY-02 | `Kawalan Ciri` built | N-06, P2-19 |

---

## 4. Capability sections

Screen template used below: **ID | Route | Priority | Status GH / UAT**; Outcome; Reference behaviour; FR; Data and dependencies; AC; Gap and root cause; Fidelity deviations; Open questions. "[PROPOSED]" marks BM copy not found in V2/V1 (collected in section 8.4 for the D94 copy review). ID formats: section 0.

### 4.0 Question-entry standard (applies to every screen that creates or edits questions: Q-04, Q-05, Q-08, Q-09, Q-10, Q-11, Q-12, Q-18, Q-24)

**Why V2 entry is not replicated here (D9 deviation, user correction 2026-11-04).** V2/V1 entry is structurally wrong, not just under-tagged. Evidence (`v2-question-bank-oldsystem-findings.md` section A): there is no group entity; the DOCX import links a figure to the first following question only (`DocxSetParser.php` `$pendingStimulus`, `DocxSetImporter.php:279-296`); a new stimulus row and image are made for every question; random generation (`RandomSetGenerator.php`, `PickableQuestionPool`, `QuizController`) splits groups and can include a question without its figure; about 14% of legacy questions say "Rajah 3 menunjukkan..." with no diagram. A rajah/petikan/jadual becomes a standalone "question" and the questions that refer to it are cut off from it. The sources that govern V3 entry, in priority order: `docs/requirements/v2-exam-schema.md` (D1 types, D2 fields, D3 keys, D4 scheme, D5 sections, D6 stimulus and groups, D9 curriculum tag, D10 metadata; approved D46/D47), `v2-question-bank.md` and `v2-question-bank-oldsystem-findings.md`, the DSKP (`docs/reference/dskp/`), `docs/discovery/SPM-paper-patterns.md`, and TRACKER D41, D46, D47, D80, D89, D90, D93 (as amended by D108(1)), D99, D104, D105, D108. From V2 only the workflow is kept: draft, review, approve (Terima / Tolak / Sunting), the batch list, and BM messages that do not conflict.

**State in V3 today (code read, not run).** The group model is largely built: contract and API have stimulus groups (`apps/api/src/modules/questions/http/stimuli.controller.ts:57-174`: create/list/members/order/questions), intake links one figure to every question that names it (`intake/workflow/figure-links.ts`, FE twin `m28/admin/intake/domain/figure-links.ts`), groups stay contiguous (`m28/.../grouping.ts`), Studio has `/admin/studio/groups/:id`, the builder is group-aware (`exam/builder/paper-check.ts`, `builder.service.ts`). What is NOT proven: no E2E (F1-F9) exercised a group; extraction never ran (item 5, section 1.1); migrated questions were never regrouped; "Jana set" behaviour on groups unverified. So the work is: make the path runnable, close the gaps below, and prove it end to end.

#### R1-ADM-QE-01 The stimulus-group rule (centre of question entry) | P0
- **Action: Complete** | gap and differences: 4.V row QE-01. V2 differs: Studio lists "Peta 2 menunjukkan..." and figure-less rows as standalone questions; PRD follows D90/D105.

**Screen specification (from V2).** V2 has no stimulus-group entity, so this block specifies the V3 rule; what V2 shows of a question and of the bank is below.
- Preview route `/admin/studio/questions/{id}/preview`, page title "Pratonton — Soalan #{id} — PRESTASIPLUS". Regions: a "SULIT" header; the notice "Pratonton — Draft." with "Soalan ini belum diterbitkan; pelajar tidak dapat melihatnya lagi."; link `Kembali ke Studio`; the question number with "[15 markah]" and a flag control "⚑" labelled "Pilih soalan ini untuk dijawab"; then the parts (a), (b) ... with sub-parts (i), (ii); each part shows its prompt in BM followed by the English text, its mark "[n markah]" and a "0 patah perkataan" counter under the answer area. Mathematics is typeset.
- Bank behaviour observed in V2 (the defect): in the Studio list and the Databank lane, questions whose text starts "Rajah 14 menunjukkan ...", "Rajah 11 ...", "Peta 2 menunjukkan ..." or "Jadual 1 di bawah menunjukkan ..." appear as ordinary rows with no figure; V2 stores the figure as its own row or drops it. In the set builder bank the same question is a separate card "1 markah · Kertas 1 · 2025" with button `Tambah`.
- V3 behaviour: see FR-ADM-QE1.1..QE1.5. The bank row shows the group badge; the preview shows the stimulus once above its member questions.
- FR-ADM-QE1.1 A stimulus (rajah, petikan, jadual, graf, peta, carta, other; the 7 kinds of R1-13.1) is never a question. It has no marks, no question number and no answer key, and it is never listed as a row in Bank Soalan, Senarai Soalan, a paper section or a pupil question map.
- FR-ADM-QE1.2 A stimulus lives in exactly one stimulus group: a group carries 1 to 3 stimuli (for example a Rajah and a Jadual) shown together once above its members, plus an ordered list of 1..n member questions. A figure used by Q5-Q8 is stored once and referenced by four questions; it is never copied per question.
- FR-ADM-QE1.3 A question can have its own stimulus (question-level) or belong to a group; part-level stimulus (exam schema D2 `stimulus_ref`) is allowed for papers such as Sejarah (c) parts.
- FR-ADM-QE1.4 Removing a question from a group never deletes the stimulus; deleting a stimulus that has members is refused with a message naming the member count [PROPOSED: "Rangsangan ini masih digunakan oleh {n} soalan."].
- FR-ADM-QE1.5 Every list that counts "soalan" counts questions only (members included, stimulus excluded). The UAT figure "339,112" must exclude any row that is only a figure (see U-OP-05).
- AC-ADM-QE1.1 Given a Rajah 3 used by 4 questions, when the admin opens Bank Soalan (Studio), then 4 question rows appear, each shows the badge of the group, and no row represents Rajah 3.
- AC-ADM-QE1.2 Given a group with 4 members, when the admin edits the figure once, then all 4 members show the edited figure to a pupil (one stimulus row in the database).

#### R1-ADM-QE-02 Manual entry: group first, then its questions (D93, D108(1)) | P0
- **Action: Complete** | gap: 4.V row QE-02. V2 differs: tabs `Kertas`, `Rangsangan`, `Sub-bahagian`, `Tag`, no group entity; PRD follows D90/D93.

**Screen specification (from V2).** The V2 create and edit forms are one page in four numbered steps; the full field list is in R1-ADM-Q-04. What matters here: V2 step 2 "Rangsangan (stimulus)" holds the stimulus of ONE question (type, caption, rich editor, "Matematik dipaparkan terus (MathML statik) — ditulis sekali di sini, dipapar sama kepada pelajar."). V2 has no way to select an existing stimulus or to add a second question to it; each question re-enters it. V3 replaces this with group-first entry (FR-ADM-QE2.1..QE2.4): the same step 2 editor (type, caption, editor with Imej / Jadual / math) is shown once on the group page and is read-only inside each member question.
- FR-ADM-QE2.1 Studio `Cipta baharu` offers two starts: `Soalan tunggal` and `Kumpulan rangsangan` [PROPOSED labels]. `Kumpulan rangsangan` opens `/admin/studio/groups/:id` (exists) to enter the stimulus once (Jenis rangsangan, Kapsyen (pilihan), rich editor with Imej / Jadual / math as V2 step 2).
- FR-ADM-QE2.2 Inside the group screen the admin adds question 1, 2, 3 ... with `Tambah soalan` (API `POST /api/stimulus-groups/:id/questions`, exists); each new question opens the wizard with the stimulus already attached and read-only. The admin never re-uploads or re-selects the figure.
- FR-ADM-QE2.3 The admin can reorder members (API `PUT .../members/order`), remove a member, and attach an existing question (`POST .../members`).
- FR-ADM-QE2.4 A stimulus group holds 1..n member questions, in a draft and in a paper (D108(1); real SPM papers have single-question figures). A group with 0 members is a draft only and shows the warning [PROPOSED] "Kumpulan belum mempunyai soalan." and cannot be placed in a paper (blocker [PROPOSED] "Kumpulan perlu sekurang-kurangnya 1 soalan."). The old message "Kumpulan perlu sekurang-kurangnya 2 soalan." is removed. This supersedes the "2 or more" part of D93 (the contract blocker text and its test are updated with the build). OQ-QE1 is closed.
- AC-ADM-QE2.1 Given the admin creates a group with one uploaded figure and adds 3 questions, when saving each, then the figure upload count is 1 and the 3 questions are members in order 1,2,3.
- AC-ADM-QE2.2 Given a group with 1 member, when it is placed in a paper, then it places, the figure shows with its question and no blocker appears; given a group with 0 members, then the blocker "Kumpulan perlu sekurang-kurangnya 1 soalan." appears and the group cannot be placed.

#### R1-ADM-QE-03 DSKP-correct question form | P0
- **Action: Fix** | gap: 4.V row QE-03. V2 differs: "Langkah 1 Kertas & bahagian" first and no DSKP unit/SP/TP step is visible; PRD follows exam schema D9.

**Screen specification (from V2).** V2 step order is Langkah 1 `Kertas & bahagian`, Langkah 2 `Rangsangan (stimulus)`, Langkah 3 `Sub-bahagian`, Langkah 4 `Tag & pengelasan`. Step 4 has only `Bab` (a select whose options are curriculum learning-standard sentences, first option "—"), `Topik` and `Kesukaran` (— / Mudah / Sederhana / Sukar); there is no Unit, no SP picker (1 to 3), no TP and no KBAT field. Step 3 offers 13 answer modes (`mcq`, `short_text`, `numeric`, `numbered_list`, `extended_essay`, `essay_choice`, `working_shown`, `graph_plot`, `draw_on_diagram`, `table_fill`, `sequence_order`, `code`, `gapped_text_match`, `cloze`). Full field list: R1-ADM-Q-04. V3 collects the DSKP tag first (FR-ADM-QE3.1) and offers the 8 types of FR-ADM-QE3.2.
- FR-ADM-QE3.1 The wizard keeps the V2 tab labels `Kertas`, `Rangsangan`, `Sub-bahagian`, `Tag` but collects data in the DSKP order: first `Tag & pengelasan` (Subjek, Tingkatan, Tajuk DSKP, SP (1 to 3), TP, KBAT, then `Bab` from Kurikulum `chapters`), then Kertas & Bahagian, Rangsangan, Sub-bahagian. `Bab` is the textbook chapter of the pupil surfaces (D89) and is a different tree from the DSKP unit; the term "Bab" is never used for the DSKP unit. Every tag value is chosen from `curriculum_node` or Kurikulum rows; no free text (exam schema 8.3 rule 5). TP (1 to 6) and difficulty (1 to 5) are two separate fields (D-A6, FR-ADM-QE3.7); the V2 three-label `Kesukaran` select is removed from this step.
- FR-ADM-QE3.2 Question types offered are the 8 of exam schema D1 with BM labels `Aneka Pilihan`, `Padanan / Lengkapkan Petikan`, `Jawapan Pendek`, `Berstruktur`, `Pengiraan dengan Langkah Kerja`, `Karangan / Respons Terbuka`, `Lukisan / Graf`, `Isi Jadual` (the last two P2). The 13 V2 modes are not offered.
- FR-ADM-QE3.3 Each leaf part carries mode, marks, key of the right kind (D3) and scheme (D4); marks of a part equal the sum of its scheme points; parents have no marks.
- FR-ADM-QE3.4 TP is per leaf (inherits the question's). Aras pemikiran (the 6-level cognitive level) stays an approval gate per leaf for an SPM-bound T4/T5 approval (ADR-0031 item 4, `dskp-gate.ts:58`; D108(2)); the question-level aras is a default that every leaf inherits, so a one-level question needs one choice. KBAT is not a separate gate: it is derived from that level (mengaplikasi, menganalisis, menilai, mencipta = KBAT) and can be overridden per leaf. Sources and dates: the closed OQ-QE2 paragraph below.
- FR-ADM-QE3.7 (F-06, D-A6) The form has two separate fields: `TP` (1 to 6, per leaf, DSKP performance level) and `Tahap kesukaran` (1 to 5, the contract field `difficultyLevel`, required, message "Sila pilih tahap kesukaran."). Neither is derived from the other in the form, and a form never collects one and stores the other. The three-label `Kesukaran` (`Mudah` / `Sederhana` / `Sukar`) is a display value derived from `Tahap kesukaran` with the single mapping documented in 50 (from the code), used by filters and lists; it is not typed. A question created by import, CSV or teacher submission with no difficulty is completed by the admin in the wizard before `Terbitkan`.
- FR-ADM-QE3.5 Levels offered are Tingkatan 1 to 5 only (D96).
- FR-ADM-QE3.6 Provenance (year, exam type, board/negeri, set, paper code) is declared once per upload batch (D99) and copied to every new version; no per-question source or rights gate.
- AC-ADM-QE3.1 Given a new question, when the admin opens the wizard, then the first step asks Subjek, Tingkatan, Tajuk DSKP, SP, TP, KBAT and then Bab in that order, with Tahap kesukaran (1 to 5) as a separate field, and the next step lists only units of that subject and Tingkatan.
- AC-ADM-QE3.3 Given the admin sets TP 3 and Tahap kesukaran 4, when saving, then both values are stored as entered and the list shows the derived label of difficulty 4; given Tahap kesukaran is empty, then saving for review is refused with "Sila pilih tahap kesukaran.".
- AC-ADM-QE3.2 Given the admin picks type `Aneka Pilihan`, then exactly one leaf appears with 3 to 8 option rows and exactly one correct tick.

#### R1-ADM-QE-04 Completeness is shown at entry, not as a late 422 | P0
- **Action: Fix** | gap: 4.V row QE-04.

**Screen specification (from V2).** V2 save bar (bottom of the create and edit form) reads "{n} markah · {m} belum lengkap" (observed "1 markah · 0 belum lengkap") beside the button `Simpan draf`. Each sub-part row in step 3 shows a summary "(?) · short_text · 1 markah" with a tick "✓" and the warning "⚠ tiada skema" when the part has no mark scheme. V2 does not list which fields are missing and shows violations only when `Terbitkan` is pressed. Everything else (names of missing fields, links to steps, blur validation) is V3 behaviour per FR-ADM-QE4.1..QE4.4; the observed V2 copy listed above is kept.
- FR-ADM-QE4.1 The save bar shows the number of missing fields and a panel listing each one by name with a link to its step, from `GET /api/questions/:id/gate-check` (exists, `lifecycle.controller.ts:32`). The text "5 belum lengkap" alone is not acceptable.
- FR-ADM-QE4.2 Missing-field messages use the existing copy (`dskp-gate.ts:18-24`): "Sila pilih unit DSKP.", "Sila pilih sekurang-kurangnya satu SP DSKP.", "Bahagian (b) belum ada TP.", "Sila pilih kertas untuk soalan SPM.", plus "Bahagian (b) belum ada aras pemikiran." (SPM-bound T4/T5, D108(2)), plus "Sila pilih Bab." (D-A5) and "Sila pilih tahap kesukaran." (D-A6) [PROPOSED copy for the new Bab message].
- FR-ADM-QE4.5 (F-05, D-A5) The publish gate requires Bab and SP (and TP / aras) together: a question without `Bab` cannot be published, because the pupil surfaces (Soalan by Chapter, Heatmap Topik Lemah) read `chapter_id` and would never show it. The panel lists "Sila pilih Bab." with a link to the Bab field. Existing approved questions without Bab are handled by the work-list `Soalan tanpa Bab` (FR-ADM-Q03.7), not by blocking them retroactively.
- FR-ADM-QE4.3 A typed SP/unit that is not in the curriculum is rejected on field blur with the intake message "SP "1.1" tiada dalam senarai kurikulum. Pilih SP daripada senarai DSKP." and the field cannot hold free text; today it is rejected only at Terima (E2E F2).
- FR-ADM-QE4.4 Terbitkan stays blocked while any item is missing, and the 422 body names the same fields as the panel.
- AC-ADM-QE4.1 Given a draft missing unit and SP, when the admin opens it, then the panel lists "Sila pilih unit DSKP." and "Sila pilih sekurang-kurangnya satu SP DSKP." with links to step Tag, and the count shows 2.
- AC-ADM-QE4.3 Given a draft with Unit, SP, TP and aras but no Bab, when the admin presses `Terbitkan`, then it is refused, the panel lists "Sila pilih Bab." and the 422 names the same field; once Bab is chosen it publishes.
- AC-ADM-QE4.2 Given the admin types SP "12.1.1" that is not in the subject, when leaving the field, then the message appears at once and Terima/Simpan is not needed to see it.

#### R1-ADM-QE-05 Upload and extraction keep structure | P0
- **Action: Complete** | gap: 4.V row QE-05. V2 differs: DOCX/BI import, figure linked to the first question only; PRD follows D90/D105 and PDF.

**Screen specification (from V2).** V2 upload is two modals on the Studio list header (buttons `Import DOCX (ZIP)` and `Import BI Kertas 1`).
- Modal "Import set DOCX": "Muat naik satu fail ZIP mengandungi folder set (DOCX utama, Skema, imej)." and "Kertas diimport sebagai DRAF — tiada apa-apa diterbitkan kepada pelajar sehingga anda menerbitkannya. Pemprosesan berjalan serta-merta; kertas besar mungkin mengambil beberapa saat."; buttons `Batal`, `Muat naik & proses`.
- Modal "Import BI Kertas 1 (Comprehension)": "Muat naik fail DOCX soalan (Part 1–5). Soalan, pilihan & jawapan diekstrak automatik."; fields `Fail soalan (DOCX) *`, `Fail skema jawapan (DOCX) — pilihan` (hint "Perlu hanya jika fail soalan tiada grid ANSWERS di hujungnya."), `Tajuk kertas — pilihan`; note "Kertas diimport sebagai DRAF — anda semak & betulkan, kemudian terbitkan. Pemprosesan berjalan serta-merta."; buttons `Batal`, `Muat naik & ekstrak`.
- The batch list is the `Kelompok Item` tab of R1-ADM-Q-07. V2 has no field for Kertas, Tahun, Negeri or the source declaration at upload and no stimulus handling; V3 follows FR-ADM-QE5.1..QE5.6 with a PDF upload.
- FR-ADM-QE5.1 Muat Naik Kertas collects, once per batch: Subjek, Tingkatan, Kertas, Tahun, Negeri/badan, Jenis, Set, Kod kertas, Sumber, Status hak cipta (D99 declaration messages "Pengisytiharan sumber diperlukan." / "Status hak cipta diperlukan.").
- FR-ADM-QE5.2 The Kertas, Bahagian (section) and Kod kertas chosen at upload are copied to every extracted item and then to every question created by Terima (today lost: E2E F2). The extractor keeps the printed Bahagian/part structure (exam schema D5) and each item's printed number label.
- FR-ADM-QE5.3 Extraction produces stimuli as stimulus objects, never as items. A figure referenced by "Rajah 3" in questions 5-8 is attached to all four (existing rule `figure-links.ts`; keyword set rajah, figure, diagram, gambar, jadual, table, graf, graph, petikan, passage, peta, map, carta, chart) and stored once.
- FR-ADM-QE5.4 In Semak Ekstrak, before `Terima`, the admin sees each group as a header "Rajah 3 -> soalan 5-8" and can change its range (add/remove a question, move the boundary) and detach/attach a question; Terima on a member creates the draft question inside the group; Terima on the group accepts all members and the stimulus together.
- FR-ADM-QE5.5 The DSKP-aware extractor (D80 US-41/42) pre-fills Unit, SP, TP, KBAT per part with a confidence band; the admin confirms; unconfirmed fields remain missing in the QE-04 panel.
- FR-ADM-QE5.6 No free-text topic; no tag outside `curriculum_node`.
- AC-ADM-QE5.1 Given a paper PDF where Rajah 3 is referenced by Q5, Q6, Q7 and Q8, when extraction finishes, then Semak Ekstrak shows one group "Rajah 3 -> soalan 5-8" with 4 members and 1 stimulus, and no item for the figure.
- AC-ADM-QE5.2 Given the admin changes the range to 5-7 before Terima, when accepting, then the 3 drafts are members of the group and Q8 is a separate draft without the figure.
- AC-ADM-QE5.3 Given upload with Kertas 1 and Bahagian A, when all items are accepted, then every draft has Kertas 1 and Bahagian A without re-selection, and the QE-04 panel does not list "Sila pilih kertas untuk soalan SPM.".

#### R1-ADM-QE-06 CSV carries the DSKP and group fields | P0
- **Action: Build** (new columns on the existing import) | gap: 4.V row QE-06.

**Screen specification (from V2).** V2 `/admin/questions/import` ("Import CSV - Admin Panel") is a dead page that says it is not connected; its full field list is in R1-ADM-Q-11. The V2 CSV format is positional: `body`, `option_a` to `option_d`, `correct` (A/B/C/D), `difficulty` (1-5, optional, default 3), with subject and level chosen on screen and not in the file. V3 columns follow FR-ADM-QE6.1.
- FR-ADM-QE6.1 The CSV template gets columns for subject code, Tingkatan, unit code, `bab_kod` (Bab code or number within subject and Tingkatan; required for publishing, D-A5), SP codes (separated by `;`), TP, difficulty (1 to 5, D-A6), KBAT, kertas, bahagian, number label, and `group_key` (rows that share a `group_key` form one stimulus group; `stimulus_text` / `stimulus_image` on the first row). IDs such as raw `subject_id` / `education_level_id` are replaced by codes (today raw IDs, E2E F2).
- FR-ADM-QE6.2 Rows with missing or unknown codes are rejected with the row number and the field name; valid rows import as drafts (the V3 message "Import selesai: {n} soalan diimport, {m} gagal." is kept).
- FR-ADM-QE6.3 A CSV question with all required fields can be approved without opening the wizard.
- AC-ADM-QE6.1 Given a CSV of 3 rows with `group_key` G1 and a stimulus on row 1, when imported, then 1 stimulus group with 3 members exists.
- AC-ADM-QE6.2 Given a CSV row with every DSKP column filled, when imported and `Terbitkan` pressed, then it publishes with no 422.

#### R1-ADM-QE-07 Papers and generation never split a group | P0
- **Action: Complete** | gap: 4.V row QE-07. V2 differs: the bank lists group members as separate cards; PRD follows D90/D105.

**Screen specification (from V2).** The V2 set builder (R1-ADM-Q-14) shows the question bank as a column of cards, each card: question text (a figure question reads e.g. "Peta 2 menunjukkan lokasi kegiatan ekonomi di Malaysia. Lokasi yang sering kali mengalami hujan asid di Malaysia ialah..."), "1 markah", "· Kertas 1 · 2025" and a button `Tambah`. A card adds one question only; two questions of the same figure are two independent cards, and the paper can end up holding one without the other. V2 random generation (R1-ADM-Q-13 `Jana set`) draws single questions the same way. V3 places and draws groups as units (FR-ADM-QE7.1..QE7.4).
- FR-ADM-QE7.1 Set Builder places a group as one unit: all members contiguous in group order; a member cannot be added alone; removing one member warns and offers "remove group" (D90 (3)).
- FR-ADM-QE7.2 Jana set and Jana Kertas draw groups as units; the pool counts a group by its questions; a draw never includes a question without its stimulus nor a stimulus without all its placed members.
- FR-ADM-QE7.3 Latih Tubi, Databank and Soalan by Chapter serve figure questions and whole stimulus groups, as in a real paper (D105, supersedes the text-only restriction of D92(1), D87 U2 and D91): the figure is shown once per group and a group is never split in a drill. The admin sees in "Dilihat murid di" why a question is not served (D90 (5)); a silent drop of a figure question or a group member is a defect.
- FR-ADM-QE7.4 When a drill draws a group member, it draws the whole group in group order, counted as its number of questions toward the requested count (5/10/20), and the stimulus is shown once above them.
- AC-ADM-QE7.1 Given a pool with groups G(4) and singles, when Jana set asks 10, then every group in the result has all its members adjacent and none is cut.
- AC-ADM-QE7.2 Given the admin adds one member of G to a paper, then the whole group is placed (or the add is refused with the group name), never one question alone.
- AC-ADM-QE7.3 (E2E) Given an approved group "Rajah 3" with 4 questions for Sains T4, when a T4 pupil starts a Latih Tubi of 10 on Sains, then the draw can contain the 4 questions together with Rajah 3 shown once above them, and never fewer than 4 of them or one without the figure.

#### R1-ADM-QE-08 Regroup work-list for migrated questions | P0 (UAT data task, see U-OP-05)
- **Action: Build** | gap: 4.V row QE-08. V2 has no such list; the V2 evidence of the defect is that Studio list rows for figure-only items show no stem text.

**Screen specification (from V2).** Not observed in V2 — follow FR-ADM-QE8.1..QE8.4. What V2 shows of the defect: Studio list rows such as "Rajah 14 menunjukkan dua tin yang sama saiz berayun ..." (status `diluluskan`, 4 pilihan) carry no figure, and the Studio list shows some rows with only a number and a paper name where the stem is empty.
- FR-ADM-QE8.1 A work-list screen (tab `Perlu dikumpulkan semula` [PROPOSED] inside `Senarai Soalan`) lists migrated questions that are broken in the V1/V2 way: (a) the question body is only a figure/passage/table with no answer or marks, (b) the text matches `figure-links.ts` references ("Rajah 3 menunjukkan...") and no stimulus is attached, (c) a stimulus image duplicated across consecutive questions.
- FR-ADM-QE8.2 Per row the admin can: attach a stimulus, create a group from selected consecutive rows (select rows, choose the figure row as stimulus), or mark "Bukan masalah". The figure-only "question" is converted into the stimulus of the group and archived as a question; the action is audited.
- FR-ADM-QE8.3 The list shows the count of open items and the count done; it is filterable by Subjek, Tingkatan, and source paper.
- FR-ADM-QE8.4 Rows are detected by rule only; no content is invented (consistent with D89). Images that were never copied from .cloud (D80 Q-03) stay inactive; the list reports them separately as "gambar tiada".
- AC-ADM-QE8.1 Given a migrated figure-only row followed by two questions that name it, when the admin groups them, then the figure row is archived, one group with two members exists, and the pupil never sees the figure as a question.
- AC-ADM-QE8.2 Given the list is empty for a subject, then the subject is marked "selesai" and the count of detected items for it is 0.

**Fidelity deviations (all of section 4.0).** FD-QE-1 group-first entry and group entity (V2 has none; D90 is a D9 fix). FD-QE-2 8 question types instead of 13 modes (exam schema D1). FD-QE-3 wizard step order Tag first (V2 last; exam schema D9). FD-QE-4 DOCX ZIP import and BI Kertas 1 import are not offered; PDF replaces them (D52, PAR A05). FD-QE-5 CSV columns extended (V2 CSV stub dead; Filament columns `body, option_a-d, correct, [difficulty]`). FD-QE-6 no per-question source/rights gate (D99, follows V2). FD-QE-7 completeness panel (V2 lists violations only at Terbitkan).

**Open questions (entry): both closed by D108.** OQ-QE1 (1-member group in a paper): CLOSED, allowed (D108(1)); see FR-ADM-QE2.4. OQ-QE2 (is "aras pemikiran" per leaf, `dskp-gate.ts:58`, a hard approval gate or optional?): CLOSED, it stays a gate with a question-level default (D108(2)). The sources and dates behind the ruling (all 2026-10-30 unless stated): (a) D76(5), user, 2026-10-29: "TP and cognitive level are stored per leaf part and both are required for pool eligibility". (b) Exam schema `v2-exam-schema.md` D2 line 154, revised 2026-10-30 (DSKP reconciliation): `kbat` is "optional ... independent of TP, not required by any gate". (c) TRACKER D80 second row, 2026-10-30, analyst: KBAT "is not a submit or publish gate" and "the 1-to-6 cognitive level field is withdrawn". (d) TRACKER D83 D-4, LEAD, 2026-10-30, after D80: "Cognitive level is mandatory per leaf part. ... The D80 wording about an optional KBAT tag is superseded." (e) TRACKER D85, user, 2026-10-30, approved the architecture and ADR-0027..0035, which include ADR-0031 item 4: "every leaf has `tp` and `cognitive_level` (\"Bahagian (b) belum ada aras pemikiran.\")". (f) Built: `r1-b05-dskp-gate.md` line 19 and `dskp-gate.ts:58`. Newest and user-approved = (d)+(e)+(f): the gate. The exam schema and D80 text speak about the KBAT tag, which ADR-0031 now derives from the cognitive level (`r1-b05` line 15), so the two do not contradict once KBAT is read as derived. The exam schema was not updated after D83 (the architect was to align it, D76 note). Ruling D108(2) (Delivery Lead, by principle, 2026-11-04): keep the gate for SPM-bound T4/T5 approval, reduce clicks with the question-level default, and fix the exam-schema text (D2/D9) to say "cognitive level required, KBAT derived" (follow-up task for the architect). The user may override.

---

### 4.A Question pipeline (top priority, Bijak SPM first)

#### R1-ADM-Q-01 `SPM` hub "Kandungan SPM" | `/admin/spm` | P0 | GH 2 of 6 cards / UAT same
- **Action: Fix** | gap and differences: 4.V row Q-01.

**Screen specification (from V2).**
- Route and title: `/admin/spm`, page title "SPM - Admin Panel" (the Panel version at `/spm` is titled "Kandungan SPM").
- Regions in order: heading "SPM"; intro "Setiap kad di bawah ialah satu laluan yang pelajar boleh buka. Nombor merah menunjukkan berapa banyak item yang perlu diperiksa."; a grid of six cards.
- Card anatomy (top to bottom): lane name; an optional tag `Flag OFF` (shown on `Kertas Subjektif` and `Latih Tubi` only); one-line description; the lane's item count as a large number; an attention line, in red when something needs checking, otherwise "Semua elok"; in the Panel version a button `Buka senarai` closes the card (the admin text shows no button label; V3 uses `Buka senarai`).
- Cards in order, with description and the V2 production values (V2 data, not to be copied): `Databank Soalan` "Bank soalan objektif SPM mengikut subjek." 449,503 / "Semua elok"; `Tracking A` "Set objektif penuh dan lane bahasa." 60 / "20 set tidak lengkap"; `Subjektif` "Soalan berstruktur dan esei." 4,061 / "2,428 tiada skema — tidak disajikan"; `Bijak SPM` "Kertas SPM penuh dalam format sebenar." 175 / "Semua elok"; `Kertas Subjektif` (tag `Flag OFF`) "Kertas 2, 3 & 4 percubaan negeri." 254 / "Semua elok"; `Latih Tubi` (tag `Flag OFF`) "Latihan ikut topik dan bab." 449,503 / "Semua elok".
- Buttons: `Buka senarai` per card opens the lane list of R1-ADM-Q-02. No filters, no empty or error state observed.
- V3: the `Flag OFF` tag is not reproduced (D104); the counts come from V3 data (FR-ADM-Q01.1..Q01.5).
- Outcome: one entry to the 6 lanes with attention counts.
- Reference (DISC 3.0; AC-R1-21.1): cards in order `Databank Soalan` ("Bank soalan objektif SPM mengikut subjek."), `Tracking A` ("Set objektif penuh dan lane bahasa."), `Subjektif` ("Soalan berstruktur dan esei."), `Bijak SPM` ("Kertas SPM penuh dalam format sebenar."), `Kertas Subjektif` ("Kertas 2, 3 & 4 percubaan negeri."), `Latih Tubi` ("Latihan ikut topik dan bab."); each with attention count (labels "tidak boleh ditanda", "set tidak lengkap", "tiada skema — tidak disajikan", "tiada kunci jawapan", "tiada halaman") and button `Buka senarai`. Padlock "Diuruskan oleh Admin Pusat" for non-national roles (KIV).
- FR-ADM-Q01.1 The hub shows all 6 cards in the order above, under the title "SPM" (page title "SPM - Admin Panel" in V2; the Panel title is "Kandungan SPM") and the intro "Setiap kad di bawah ialah satu laluan yang pelajar boleh buka. Nombor merah menunjukkan berapa banyak item yang perlu diperiksa."; each card shows the lane's item count as a big number, then the attention text, or "Semua elok" when nothing needs attention (V2 production values in 4.V.1: 449,503 / 60 / 4,061 / 175 / 254 / 449,503). V2's "Flag OFF" tag on `Kertas Subjektif` and `Latih Tubi` is not reproduced (D104; N-06).
- FR-ADM-Q01.2 Each card shows the attention count from the same rule the pupil uses (`GET /api/admin/servability/overview`, exists `servability.controller.ts:71`).
- FR-ADM-Q01.3 `Buka senarai` opens `/admin/spm/databank`, `/admin/spm/tracking-a`, `/admin/spm/subjektif`, `/admin/spm/simulasi`, `/admin/spm/kertas-subjektif` (alias of Q-18), `/admin/spm/latih-tubi`.
- FR-ADM-Q01.4 A card whose screen does not exist yet is not shown (R1 U6); at 1.0 sign-off all six exist.
- FR-ADM-Q01.5 Each card also has the link `lihat sisi pelajar` and the same lane is reached from the sidebar group `SPM` (section 3.1 row 6). The hub has no `Kontrak Simulasi` button: the contract is opened from Set Builder and paper review (D107).
- Data: `m28/admin/kandungan/{lanes.ts,pages/KandunganHubPage.vue}`; API overview exists; lanes Tracking A, Subjektif, Latih Tubi need `GET /api/admin/servability/lanes/{lane}` (only `databank`, `bijak-spm` exist, lines 79, 86).
- AC-ADM-Q01.1 Given an Admin Pusat, when opening `/admin/spm`, then 6 cards in order with counts and `Buka senarai`.
- AC-ADM-Q01.2 (E2E) Given the Bijak SPM card shows "0 kertas" attention on UAT, when the admin publishes a paper (Q-15) and reloads, then the count falls and the T5 pupil's Bijak SPM lists the paper.
- Gap: `admin-kandungan.ts:13-29` has only hub, databank, simulasi routes; `lanes.ts` two cards.
- Deviation: none beyond showing all six (PIPE U6 superseded, section 7).
- OQ: none.

#### R1-ADM-Q-02 Lane list "Kandungan SPM" (per lane) | `/admin/spm/:lane` | P0 (feeds Murid 13 and 16) | GH 2 lanes / UAT same
- **Action: Complete** | gap and differences: 4.V row Q-02.

**Screen specification (from V2).**
- Routes and titles: `/admin/spm/databank` "Databank Soalan - Admin Panel"; `/admin/spm/tracking-a` "Tracking A - Admin Panel"; the Panel lanes `/spm/databank`, `/spm/simulasi` (titled "Bijak SPM"), `/spm/tracking-a`, `/spm/subjektif`, `/spm/kertas-subjektif`, `/spm/latih-tubi` use the same frame.
- Regions in order: link `← Semua laluan SPM`; lane heading; the line "{n} item ·" followed by the link `lihat sisi pelajar` (Panel: lane description, e.g. "Latihan ikut topik dan bab. · 449,503 item"); the filter bar; the list; the pager.
- Filters: `Subjek` (select, first option "Semua Subjek", then the 31 subjects in alphabetical order from `Bahasa Arab` to `Tasawwur Islam`); `Status` (select "Semua Status", `Diluluskan`, `Draf`, `Menunggu`, `Ditolak`; present on Databank and Latih Tubi, absent on Tracking A); `Cari` (text); buttons `Cari` (admin) or `Cari`, `Tapis`, `Set Semula` (Panel).
- List, Databank and Latih Tubi (Panel columns `Tajuk`, `Status`, `Perhatian`, `Tindakan`): one row per question: the first ~120 characters of the stem ending "...", the meta line "#451518 · Sains · Tingkatan 4 · 4 pilihan", the status badge in lower case ("diluluskan"), `Perhatian` shown as "—" when nothing is wrong, and the row actions `Pratonton` and `Sunting` (the admin version shows `Sunting` only). Pager: page numbers 1 to 10, "More pages", last two pages.
- List, Tracking A: one row per set: title "Bahasa Melayu · 2026 Set 1", meta "#1 · ramalan · 8 soalan", attention "Hanya 8 daripada 40 soalan — 28471 tersedia untuk diisi" (the available number counts raw questions), the chip "ramalan" and the action `Sunting`; three pages.
- List, Bijak SPM (`/spm/simulasi`, "175 item"): columns `Tajuk`, `Status`, `Perhatian`, `Tindakan`; row "MATEMATIK Kertas 2 (Salinan)" with meta "#360 · Matematik · 17 soalan", status "Draft", `Perhatian` "—", actions `Salin` and `Sunting`.
- Subjektif and Kertas Subjektif lane rows: Not observed in V2 beyond the frame above — follow FR-ADM-Q02.1, Q18.1 and Q23.3.
- States: no empty or error state observed. V3 differences: the Tracking A attention counts questions and groups per D90; V3 adds the BM reason text of FR-ADM-Q02.3.
- Reference (DISC 3.0): filters `Subjek` ("Semua Subjek"), `Status` ("Semua Status"), `Cari`, buttons `Tapis`, `Set Semula`; columns `Senarai`, `Tajuk`, `Perhatian`, `Tindakan`; row actions `Pratonton`, `Salin` (native Simulasi rows), `Sunting`; link "← Semua laluan SPM", "lihat sisi pelajar".
- FR-ADM-Q02.1 Same filters, columns and row actions in every lane.
- FR-ADM-Q02.2 The Bijak SPM lane row `Sunting` opens Semak Kertas Simulasi (Q-15); the Tracking A row `Sunting` opens Q-17; the Kertas Subjektif lane opens Q-18.
- FR-ADM-Q02.3 `Perhatian` text is the BM reason from the servability catalogue (`packages/contract/src/servability/schema.ts:73-74`, e.g. "DSKP belum lengkap — lengkapkan Tag dan TP di borang soalan.").
- FR-ADM-Q02.4 The Latih Tubi lane lists subjects x Tingkatan with servable counts and the `latih-tubi` switch state (N-06).
- AC-ADM-Q02.1 Given the Databank lane filtered by subject, then objective questions including figure questions and group members are listed, each with its BM reason when not servable.
- AC-ADM-Q02.2 Given a Terbit paper, then its lane row shows `Pratonton`, `Salin`, `Sunting`.
- Gap: lane pages `LaneDatabankPage.vue`, `LaneSimulasiPage.vue` only. Deviation: none.

#### R1-ADM-Q-03 `Bank Soalan (Studio)` list | `/admin/studio` | P0 | GH built / UAT built, 339,112 rows "0/6"
- **Action: Fix** | gap and differences: 4.V row Q-03.

**Screen specification (from V2).**
- Route and title: `/admin/studio`, page title "Studio - Admin Panel" (Panel `/studio`: "Question Studio").
- Regions in order: subtitle "Bank kanonikal (pokok peperiksaan v2.1). Soalan model lama masih di bank legasi."; link `Bank lama (legasi) →` (opens R1-ADM-Q-20); four status tiles `Draft`, `Reviewed`, `Approved`, `Archived` each with its count; header buttons `Import DOCX (ZIP)`, `Import BI Kertas 1`, `Cipta baharu`; filter bar; table; pager.
- Filters (selects, first option is the "all" option): `Semua subjek` (31 subjects, ordered Bahasa Melayu, Bahasa Inggeris, Matematik, Sains, Sejarah, Pendidikan Islam, Pendidikan Moral, Matematik Tambahan, Fizik, Kimia, Biologi, Geografi, then the rest); `Semua status` (Draft, Reviewed, Approved, Archived); `Semua tahun` (2025, 2024, 2023, 2022, 2021); `Semua negeri` (Johor, Kedah, Kelantan, Melaka, Negeri Sembilan, Pahang, Perak, Perlis, Pulau Pinang, Sabah, Sarawak, Selangor, Terengganu, WP Kuala Lumpur, WP Labuan, WP Putrajaya, MRSM, SBP, SABK, SMKA, SPM(U), PPD); `Semua kertas` (Kertas 1, Kertas 2, Kertas 3); `Semua jenis` (Percubaan, Sebenar, Modul); button `Tapis`.
- Table columns: `No.`, `Soalan`, `Kertas`, `Sumber`, `Status`, and an actions cell. A row shows: the question number; the stem cut at about 90 characters with "..." (some rows show no stem text, see QE-08); the paper name with the subject code below it (e.g. "MATEMATIK Kertas 2 (Salinan) ... · MATH"); the source badge "Import (PDF/DOCX)"; the status chip (e.g. "Draft"); actions `Pratonton` and `Edit` (Panel adds `Sembunyikan`). Pager: "« Previous", page numbers, "Next »" (admin) or numbered pages with "More pages" (Panel); 25 per page.
- Buttons: `Cipta baharu` opens R1-ADM-Q-04 (create); the two import buttons open the modals described in FR-ADM-QE5 (V3: `Import PDF`); `Pratonton` opens the preview page (R1-ADM-Q-04); `Edit` opens the edit form; the tiles filter the list by status.
- States: the list is never empty in V2 (about 5,700 rows); no empty or error copy observed. V3 adds the `Dilihat murid di` column, the group badge, the filters of FR-ADM-Q03.4 and the bulk bar of FR-ADM-Q03.5.
- Outcome: the one canonical question list. Title "Studio", subtitle "Bank soalan kanonikal - cipta, semak, terbit".
- Reference (DISC 3.1): status tiles (Draft, Reviewed, Approved, Archived with counts); filters `Semua subjek`, `Semua status`, `Semua tahun`, `Semua negeri`, `Semua kertas` (Kertas 1-3), `Semua jenis`; buttons `Tapis`, `Set Semula`; columns `No.`, `Soalan` (90 chars), `Kertas` ("Bank (tiada kertas)"), `Sumber`, `Status`; row actions `Pratonton`, `Edit` / `Edit sebagai draf`; 25 per page; header `Cipta baharu`, `Import PDF` (D83 D-5).
- FR-ADM-Q03.1 List shows questions only (QE-01) with a group badge for members.
- FR-ADM-Q03.2 Each row shows the servability indicator "Dilihat murid di n daripada 7" and expands to the 7 activities with BM reasons (Q-06).
- FR-ADM-Q03.3 `Edit sebagai draf` on an approved row clones to a new draft; flash "Draf baharu #{id} dicipta. Soalan asal kekal diterbitkan sehingga draf ini diterbitkan."
- FR-ADM-Q03.4 Add filters `Tingkatan`, `Bab` and `DSKP` (`Ada DSKP Tag` / `Belum Ditag`) so the Bab work (C-05) can be scoped; D96: Darjah never listed.
- FR-ADM-Q03.5 Bulk bar: select rows or "all results of the filter" with `Tetapkan Bab` (C-05) and the status actions `Hantar untuk semakan`, `Terbitkan`, `Arkib` through `POST /api/questions/bulk-action` and `/bulk-action/filter` (exist, `admin.controller.ts:75,93`; filter action requires a filter, cap `FILTER_ACTION_CAP`, `expectedCount` check).
- FR-ADM-Q03.6 The "Menunggu Semakan" tile equals the count of status Reviewed and is the single review queue (route `/admin/spm/semakan` redirects here, section 3.3).
- FR-ADM-Q03.7 (F-05, D-A5) Work-list `Soalan tanpa Bab`: a saved view of the list (also the `Bab` filter value "Belum dipautkan") of approved questions with no `chapter_id`, with the count in its header and the note "Soalan tanpa Bab tidak akan muncul dalam Soalan by Chapter dan Heatmap Topik Lemah." [PROPOSED copy]. The bulk bar's `Tetapkan Bab` (C-05) sets the chapter for the selected rows or all rows of the filter through `POST /api/admin/curriculum/questions/bulk-chapter` (C documents it); rows whose Subjek or Tingkatan do not match the Bab are skipped and listed. Setting the Bab changes neither status nor Latih Tubi servability.
- Data: `GET /api/questions`, `/summary`, `/filter-options`, servability batch `POST /api/admin/servability/questions/batch` (exists). No migration.
- AC-ADM-Q03.1 Given 3 questions in Reviewed, then the tile shows 3 and the list filtered by Reviewed shows the same 3 (the old queue disagreement, E2E F3, cannot recur).
- AC-ADM-Q03.2 (E2E) Given an admin approves a complete MCQ for Sains T5, when the T5 pupil opens Latih Tubi Sains, then the question can be drawn (UAT Latih Tubi already works for T5).
- AC-ADM-Q03.3 Given 50 approved Sains T5 questions with no Bab, when the admin opens `Soalan tanpa Bab`, then the header shows 50 and the list shows exactly those 50; after `Tetapkan Bab` "X" on all of them the header shows 0, and the T5 pupil's Soalan by Chapter shows 50 soalan in Bab "X" on the next load.
- Gap: three lists, two queues (`menu.ts:95,103,116`; `ReviewQueuePage.vue`); "0/6" for all 339,112 rows is correct for untagged but unexplained (reasons text must show). Deviation: added filters Tingkatan, Bab, DSKP (V2 legacy list has `DSKP` filter, DISC 3.3). OQ: none.

#### R1-ADM-Q-04 Studio `Cipta baharu` / `Sunting soalan` wizard | `/admin/studio/questions/create`, `/admin/studio/questions/:id/sunting` | P0 | GH built / UAT built
- **Action: Fix** | gap and differences: 4.V row Q-04.

**Screen specification (from V2).**
- Routes and titles: create `/admin/studio/questions/create`, "Studio — Cipta soalan - Admin Panel"; edit `/admin/studio/questions/{id}/edit`, "Studio — Sunting soalan - Admin Panel"; preview `/admin/studio/questions/{id}/preview`, "Pratonton — Soalan #{id} — PRESTASIPLUS".
- Regions, edit page (top to bottom): the line "Sumber soalan:" with the source badge "Import (PDF/DOCX)"; the draft-recovery banner "Terdapat kerja yang belum disimpan daripada sesi sebelum ini." with buttons `Pulihkan` and `Buang` (shown on create too); the status bar: `Status`, a badge ("Draft"), "Belum dipapar kepada pelajar." and the buttons `Pratonton`, `Hantar untuk semakan`, `Arkib`; the tab strip `Kertas` / `Rangsangan` / `Sub-bahagian` / `Tag`; the four steps; the save bar. The create page has the same body without the status bar.
- Langkah 1 "Kertas & bahagian": "Letak soalan dalam kertas peperiksaan, atau simpan sebagai soalan bank." Field `Kertas (pilihan)`: select, first option "— Soalan bank (tiada kertas) —", then every paper by name (V2 lists more than 100, sorted alphabetically, including test papers; V3 filters the picker by Subjek, Tahun and Negeri, see the register). Field `Bahagian`: select, first option "—", then "{paper} · {section}" (e.g. "2025 Johor - Bahasa Inggeris Kertas 1 · Part 1").
- Langkah 2 "Rangsangan (stimulus)": "Petikan, rajah atau jadual yang menjadi konteks soalan. Matematik ditulis sekali di sini." Fields: `Jenis rangsangan` (select: Passage, Box, Table, Diagram, Graph, Image, Infographic, Code, Pseudocode, Sql, Math, Audio, Video, Map, Cartoon); `Kapsyen (pilihan)` (text); a rich editor with toolbar `B`, `I`, `• Senarai`, `1. Senarai`, `</>`, `Jadual`, `+Baris`, `+Lajur`, `×Jadual`, `√x`, `√x blok`, `Imej`, undo `↶`, redo `↷`; an inline-math dialog "Matematik dalam baris (LaTeX)" with `Sisip` and `Batal`; the note "Matematik dipaparkan terus (MathML statik) — ditulis sekali di sini, dipapar sama kepada pelajar."
- Langkah 3 "Sub-bahagian": "Setiap bahagian membawa jenis jawapan, markah dan skema tersendiri." with a running "Jumlah markah {n}". Each part is a collapsible row summarised "(?) · short_text · 1 markah" with "✓" and "⚠ tiada skema"; inside: `Label`, `Jenis jawapan` (14 values: mcq, short_text, numeric, numbered_list, extended_essay, essay_choice, working_shown, graph_plot, draw_on_diagram, table_fill, sequence_order, code, gapped_text_match, cloze), `Markah`, `Arahan sub-bahagian`, a button `+ Jawapan diterima`, a button `+ Sub-bahagian`, a button `Buang`, and below all parts a button `+ Bahagian utama`.
- Langkah 4 "Tag & pengelasan": "Bab, topik dan aras kesukaran untuk penapisan dan pelaporan." Fields `Bab` (select, "—" then curriculum learning-standard sentences), `Topik` (select), `Kesukaran` (select "—", `Mudah`, `Sederhana`, `Sukar`).
- Save bar: "{n} markah · {m} belum lengkap" and `Simpan draf`.
- Preview page: see QE-01 (SULIT header, "Pratonton — Draft.", "Soalan ini belum diterbitkan; pelajar tidak dapat melihatnya lagi.", `Kembali ke Studio`, parts with "[n markah]" and "0 patah perkataan").
- Panel variants: Quick Edit and Pratonton at `/spm/soalan/{id}/sunting` and `/pratonton` are specified in R1-ADM-Q-24.
- Validation and flash messages: not shown in the V2 pages as captured — follow the Reference list above (flashes, "Peralihan ... tidak dibenarkan.") and FR-ADM-QE4.
- V3: the order of steps, the 8 types, the DSKP fields and the stimulus-group handling replace V2 steps 1 to 4 as set by FR-ADM-QE2, QE3 and QE4.
- Reference (DISC 3.1): titles "Studio — Cipta soalan" (subtitle "Cipta soalan kanonikal dari kosong (draf)"), "Studio — Sunting soalan" ("Soalan draf #{id}"); status bar `Status`, badge, "Belum dipapar kepada pelajar.", `Pratonton`, `Hantar untuk semakan`, `Arkib`, `Terbitkan` (no confirm); flashes "Soalan draf disimpan. Terbitkan melalui semakan apabila sedia.", "Soalan dihantar untuk semakan.", "Soalan diterbitkan — kini boleh dijawab oleh pelajar.", "Soalan diarkibkan — tidak lagi dipapar kepada pelajar."; "Peralihan '{from}' -> '{to}' tidak dibenarkan."; "Soalan ini telah diterbitkan. Gunakan "Edit sebagai draf" untuk menyuntingnya."; draft recovery "Terdapat kerja yang belum disimpan daripada sesi sebelum ini." `Pulihkan` / `Buang`; transitions draft->reviewed|archived, reviewed->approved|draft|archived, approved->archived, archived->draft.
- FR-ADM-Q04.1 Form content and validation follow QE-02, QE-03, QE-04 (DSKP order, 8 types, panel).
- FR-ADM-Q04.2 Field `Bab` (chapter select, `ChapterSelect.vue`, saved as `question_versions.chapter_id`, D89) sits in the Tag step; chapters are those of the chosen Subjek and Tingkatan; label "Bab"; required at approval (D-A5, FR-ADM-QE4.5; Soalan by Chapter serves only linked questions). Legacy approved questions without Bab stay servable in Latih Tubi (D80) and are completed through `Soalan tanpa Bab` (FR-ADM-Q03.7).
- FR-ADM-Q04.3 4-click path kept: `Cipta baharu`, `Simpan draf`, `Hantar untuk semakan`, `Terbitkan`.
- FR-ADM-Q04.4 `Terbitkan` runs the approval gate; a failure lists every violation (same list as the panel), nothing else.
- FR-ADM-Q04.5 A question inside a Terbit paper is not edited in place (exam schema D12 version n+1; PIPE AC-04.4); archiving warns which Terbit papers are affected.
- FR-ADM-Q04.6 Stimulus step offers `Pilih kumpulan` (existing group) and `Kumpulan baharu` (QE-02), never a per-question re-upload.
- AC-ADM-Q04.1 Given a draft with every DSKP field, when `Terbitkan`, then flash "Soalan diterbitkan — kini boleh dijawab oleh pelajar." and status Approved.
- AC-ADM-Q04.2 Given a draft missing the kertas, then the panel and the 422 both show "Sila pilih kertas untuk soalan SPM." and the count is 1.
- AC-ADM-Q04.3 (E2E) Given the admin sets Bab "{one T5 Sains chapter}" and approves, when the T5 pupil opens Soalan by Chapter Sains, then that chapter lists 1 soalan (the index no longer says "Tiada subjek bab tersedia untuk tahap ini.").
- Gap: bar "n belum lengkap" without detail; 422 at publish (E2E F1); `dskp-gate.ts:58-65`. Deviation: FD-QE-2/3/7, Bab field is not in V2 legacy (D89).
- OQ: none (OQ-QE2 closed by D108(2)).

#### R1-ADM-Q-05 Stimulus group screen | `/admin/studio/groups/:id` | P0 | GH built / UAT unverified
- **Action: Complete** | gap: 4.V row Q-05.

**Screen specification (from V2).** Not observed in V2 — V2 has no group screen; follow FR-ADM-Q05.1..Q05.3, FR-ADM-QE2.1..QE2.4 and D90/D105. The only V2 pieces reused are the stimulus editor controls (type, caption, rich editor, math dialog) listed in R1-ADM-Q-04, Langkah 2.
- Reference: none in V2 (V2 has no group entity); source D90, D93, exam schema D6.
- FR-ADM-Q05.1 Shows the stimulus (kind, caption, editor) once and the ordered member list with `Tambah soalan`, `Buang`, `Naik`/`Turun` (touch buttons instead of drag, D83 D-9).
- FR-ADM-Q05.2 The member count and "Dilihat murid di" reasons per member are shown (D90 (5)).
- FR-ADM-Q05.3 A figure image upload happens once; members never prompt for it.
- AC-ADM-Q05.1 Given a group of 3, when the admin moves member 3 to position 1, then the pupil's paper shows the new order after republish.
- Gap: unproven E2E (section 4.0). Deviation: FD-QE-1.

#### R1-ADM-Q-06 Servability gate and indicator "Dilihat murid di" | in Q-03, Q-04, Q-14, Q-15 | P0 | GH partly / UAT "0/6"
- **Action: Complete** | gap: 4.V row Q-06.

**Screen specification (from V2).** Not observed in V2 — V2 shows only the hub attention line per lane (R1-ADM-Q-01: "Semua elok", "20 set tidak lengkap", "2,428 tiada skema — tidak disajikan") and the `Perhatian` column of the lane lists (R1-ADM-Q-02, shown as "—" when empty). The per-question six-activity indicator is V3 behaviour: follow FR-ADM-Q06.1..Q06.3.
- Reference: V2 has logic only, no UI (PAR A29); source PIPE US-04/05, AC-R1-17.
- FR-ADM-Q06.1 For a question the admin sees seven activities, the enum of 60 API-Q-11 (F-19): `databank` (Databank), `latih_tubi_spm` (Latih Tubi), `bab` (Soalan by Chapter), `simulasi_paper` (Simulasi), `simulasi_kuiz` (Kuiz), `jana_kertas` (Jana Kertas) and `permainan` (Permainan); the labels in brackets are the earlier six-activity names of this PRD, now mapped to those values (the live "0/6" figure is the old six-activity count and becomes "n daripada 7"). Each `Boleh dilihat` / `Tidak boleh dilihat` with a BM reason from the catalogue (e.g. "Belum ditanda DSKP — tidak dimasukkan dalam kertas blueprint dan Jana set.").
- FR-ADM-Q06.2 The indicator and the pupil query use the same rule code (`questions/serving/rules.ts`); a contract test of 20 mixed questions proves equality (AC-R1-17.2).
- FR-ADM-Q06.3 Untagged legacy MCQs show Latih Tubi `Boleh dilihat` and Bijak/Jana set `Tidak boleh dilihat` (D80 Q-01).
- FR-ADM-Q06.4 (F-05, D-A5) For activity `Soalan by Chapter` (and the Heatmap Topik Lemah) a question with no Bab reads `Tidak boleh dilihat` with the reason "Bab belum dipaut - tidak disajikan dalam Soalan by Chapter." [PROPOSED copy], with a link to the Bab field and to the work-list `Soalan tanpa Bab` (FR-ADM-Q03.7).
- AC-ADM-Q06.1 Given a legacy untagged MCQ, then Latih Tubi = Boleh dilihat and Simulasi = Tidak boleh dilihat with the reason above.
- AC-ADM-Q06.2 (E2E) Given the indicator says Latih Tubi `Boleh dilihat` for question X, when the T5 pupil starts a Latih Tubi that can draw X, then X can appear; if `Tidak boleh dilihat`, X never appears.
- Gap: "0/6" shown for rows although Latih Tubi serves them (GAP 5.3): the count denominator/definition must say what the 6 are. Deviation: new UI over V2 logic (D79d allows because it fits the existing list).

#### R1-ADM-Q-07 `Import & Semakan` (3 tabs) | `/admin/spm/soalan/ekstrak` (alias `/admin/studio/imports`) | P0 | GH built (list) / UAT extraction stuck
- **Action: Fix** | gap and differences: 4.V row Q-07.

**Screen specification (from V2).**
- Route and title: `/admin/studio/imports`, "Studio — Import - Admin Panel".
- Regions: a tab strip `Kelompok Item` / `Kertas Diimport` / `Kiriman Guru`; the active tab's table; the pager.
- `Kelompok Item` columns: `Fail Sumber`, `Subjek`, `Bilangan Soalan`, `Disemak`, `Status`, and a row link `Semak` (opens the batch review, R1-ADM-Q-09). Pager "« Previous", "Next »", "Showing 1 to 20 of 43 results", page links 1 2 3 (20 per page).
- `Kertas Diimport` columns `Kertas`, `Subjek`, `Bilangan Soalan`, `Status`, row link `Semak & Terbit`; empty "Tiada kertas diimport lagi."
- `Kiriman Guru` tab: opens `/admin/question-submissions`, page title "Kertas Soalan Guru - Admin Panel": intro "Kertas yang dihantar guru diproses melalui aliran import Studio (DOCX/OCR → semakan → terbit)."; four tiles `Jumlah`, `Pending`, `Processing`, `Selesai` (each a count); a filter select `Semua Status` (Pending, Processing, Selesai, Ditolak) with button `Tapis`; table columns `Guru / Sekolah`, `Tajuk`, `Fail`, `Status`, `Tarikh`; empty state "Tiada kertas soalan dihantar oleh guru lagi."
- The upload buttons live in the Studio header (R1-ADM-Q-03), not on this page. Error and progress copy: not observed — follow FR-ADM-Q07.2.
- Reference (DISC 3.2): tabs `Kelompok Item` (columns `Fail Sumber`, `Subjek`, `Bilangan Soalan`, `Disemak`, `Status`, link `Semak`), `Kertas Diimport` (columns `Kertas`, `Subjek`, `Bilangan Soalan`, `Status`, link `Semak & Terbit`, empty "Tiada kertas diimport lagi."), `Kiriman Guru`.
- FR-ADM-Q07.1 Three tabs with these names and columns; header buttons `Muat Naik Kertas`, `Tulis Soalan Manual`, `Import CSV`.
- FR-ADM-Q07.2 `Kelompok Item` shows a batch status that ends: "Sedang diproses" for at most the job timeout, then "Gagal" with the reason (no infinite spinner; today none, E2E F2) [PROPOSED copy: "Pengekstrakan gagal: {sebab}"], and a `Cuba lagi` button.
- FR-ADM-Q07.3 `Kertas Diimport` lists draft papers created from a batch (Hantar untuk semakan) and links `Semak & Terbit` to Q-15 (OQ-Q07).
- FR-ADM-Q07.6 (F-01, D-A2) `Hantar untuk semakan` on a batch whose items are all decided (none `pending`; at least one accepted) turns the accepted batch into a Bijak/SPM paper: one draft paper per paper code in the batch (`papers` row, `surface='simulasi'`; subject, Tingkatan, Kertas, year, exam board and title from the batch), one section per printed Bahagian (with its rule `semua` / `pilih N` copied from the Disahkan contract when one exists), and one placement per accepted question. The paper keeps the printed question order, the Bahagian of each item and the stimulus groups (each group placed whole and contiguous, never split). The paper is a draft until published through `Semak & Terbit`. API `POST /api/intake/batches/:id/paper` (C documents it); 409 while an item is still `pending`; 422 when a placement would split a group.
- FR-ADM-Q07.7 (D-A2) `Semak & Terbit` opens Q-15 with a preview before publishing: the preview shows the paper as a pupil would see it (sections, order, each stimulus once above its members), and `Terbitkan` is offered only from the preview.
- FR-ADM-Q07.8 (D-A2) Before publishing, the paper is validated against the blueprint (Kontrak Simulasi) of its subject and Kertas, as in Q-15: section count and rules, question count and marks per section, and DSKP coverage. Each violation is listed by name; a paper with a violation is not published (the exception path of Q-15 applies unchanged). A paper with no Disahkan contract follows Q-15's contract rule.
- FR-ADM-Q07.9 (D-A2) `Kertas Diimport` columns stay `Kertas`, `Subjek`, `Bilangan Soalan`, `Status`; `Bilangan Soalan` counts placed questions (stimulus excluded). A batch that already has a paper shows `Semak & Terbit` instead of creating another one.
- FR-ADM-Q07.4 One queue concept: the `Disemak` column counts extract items decided / total; nothing else is called a queue.
- FR-ADM-Q07.5 The extraction worker and OCR run on UAT (U-OP-02); the batch page polls without errors.
- AC-ADM-Q07.1 Given a PDF uploaded on UAT, when 5 minutes pass, then the batch is "Selesai" with items or "Gagal" with a reason; never still "Sedang diproses".
- AC-ADM-Q07.2 (E2E) Given the admin accepts and approves items from a real trial paper, when the T5 pupil opens Databank for that subject, then the approved MCQs can appear (R1-20.4).
- AC-ADM-Q07.3 Given a batch with Bahagian A (10 items) and Bahagian B (5 items), of which items 5-8 form a group, when `Hantar untuk semakan` is pressed, then one draft paper with 2 sections and 15 placements exists, items 5-8 are adjacent in one section in printed order, and `Kertas Diimport` lists it with Bilangan Soalan 15.
- AC-ADM-Q07.4 Given a batch with one item still `pending`, when `Hantar untuk semakan` is pressed, then no paper is created and the message names the number of undecided items; given the placement would split a group, then the request is refused (422) and the group is named.
- AC-ADM-Q07.5 Given the draft paper of AC-ADM-Q07.3, when the admin opens `Semak & Terbit`, then the preview shows 2 sections and the group once above items 5-8; given the blueprint requires 12 questions in Bahagian A, then the violation is listed and `Terbitkan` is refused until fixed or the exception path is used.
- AC-ADM-Q07.6 (E2E) Given the paper is published, when a T5 pupil opens Bijak SPM, then the paper appears with the same question order, sections and group figure as in the preview.
- Gap: `JOBS_WORKER_ENABLED` default false (`jobs.config.ts:15,33`), `OCR_ENGINE` default none (`ocr.config.ts:38`), `AI_PROVIDER=mock` (PAR A06); AC-R1-14.2 not passable. Deviation: FD-QE-4.
- OQ-Q07 what `Kertas Diimport` lists in V3 (V2 lists DOCX papers). Recommendation: papers created from a batch.

#### R1-ADM-Q-08 `Muat Naik Kertas` | `/admin/spm/soalan/muat-naik` | P0 | GH built / UAT form ok, extraction fails
- **Action: Fix** | gap and differences: 4.V row Q-08.

**Screen specification (from V2).** V2 has no PDF upload and no page of its own; the upload is two modals opened from the Studio header. Modal 1 "Import set DOCX": text "Muat naik satu fail ZIP mengandungi folder set (DOCX utama, Skema, imej)." and "Kertas diimport sebagai DRAF — tiada apa-apa diterbitkan kepada pelajar sehingga anda menerbitkannya. Pemprosesan berjalan serta-merta; kertas besar mungkin mengambil beberapa saat."; a file chooser; buttons `Batal` and `Muat naik & proses`. Modal 2 "Import BI Kertas 1 (Comprehension)": "Muat naik fail DOCX soalan (Part 1–5). Soalan, pilihan & jawapan diekstrak automatik."; fields `Fail soalan (DOCX) *`, `Fail skema jawapan (DOCX) — pilihan` (hint "Perlu hanya jika fail soalan tiada grid ANSWERS di hujungnya."), `Tajuk kertas — pilihan`; note "Kertas diimport sebagai DRAF — anda semak & betulkan, kemudian terbitkan. Pemprosesan berjalan serta-merta."; buttons `Batal` and `Muat naik & ekstrak`. No validation or error copy is shown in the capture. V3 page fields: FR-ADM-Q08.1..Q08.4 and FR-ADM-QE5.1.
- Reference: V2 had CLI only (PAR A06); DOCX modal text "Kertas diimport sebagai DRAF — tiada apa-apa diterbitkan kepada pelajar sehingga anda menerbitkannya." kept as notice.
- FR-ADM-Q08.1 Fields per QE-05.1; PDF max size [PROPOSED 30 MB as V2 ZIP]; optional skema PDF.
- FR-ADM-Q08.2 Source/rights declaration messages as D99.
- FR-ADM-Q08.3 After upload the admin lands on the batch page (`/ekstrak/:batchId`) and sees progress.
- FR-ADM-Q08.4 A digital PDF uses its text layer first; a scanned PDF uses OCR (D81, ADR-0034).
- AC-ADM-Q08.1 Given a missing declaration, then "Pengisytiharan sumber diperlukan." and no batch is created.
- Gap: see Q-07. Deviation: FD-QE-4, FD-QE-5.

#### R1-ADM-Q-09 `Semak Ekstrak` (item review) | `/admin/spm/soalan/ekstrak/:batchId` | P0 | GH built / UAT cannot reach (no items)
- **Action: Fix** | gap: 4.V row Q-09.

**Screen specification (from V2).** Not observed in V2 — the review page `/admin/studio/imports/{batch}/review` was not captured (E-21). Follow the Reference list above (labels from V2 code), FR-ADM-Q09.1..Q09.5 and FR-ADM-QE5.4.
- Reference (DISC 3.2): title "Studio — Semak Import"; "← Kembali ke senarai import"; "Item {i} / {n}"; `Terima semua yang belum disemak`; left "Sumber PDF" with `Sebelum`/next; right "Teks soalan", "Pilihan A...", "Jawapan", "Cadangan Provenans"; `Terima (A)`, `Tolak (R)`, `Simpan Sunting (E)`, keys A, R, E.
- FR-ADM-Q09.1 Same actions and keys; Terima creates a draft question (never servable).
- FR-ADM-Q09.2 Groups appear as headers with adjustable range (QE-05.4); the per-part tag editor shows unit, SP, TP, KBAT with suggestion and confidence.
- FR-ADM-Q09.3 Terima validates tags on the form (QE-04) and refuses with the field name; a free-text SP is impossible.
- FR-ADM-Q09.4 After Terima the batch counter "Disemak" updates and `Hantar untuk semakan` is enabled when at least one draft exists (today "Tiada soalan", E2E F2).
- FR-ADM-Q09.5 `Tolak (R)` removes the item from the batch count with a reason [PROPOSED].
- AC-ADM-Q09.1 Given 10 items with 2 groups, when `Terima semua yang belum disemak`, then drafts keep their group membership and kertas/bahagian.
- AC-ADM-Q09.2 (E2E) Given items accepted, tagged and approved (Q-03), then Terbit papers can include them (Q-14) and the pupil sees them in Bijak SPM.
- Gap: `IntakeReviewPage.vue`; manual Terima fails on free-text SP (E2E F2). Deviation: FD-QE-1, 7.

#### R1-ADM-Q-10 `Tulis Soalan Manual` | `/admin/spm/soalan/manual` | P0 (feeds Murid 9, 13, 16) | GH built / UAT built
- **Action: Fix** | gap: 4.V row Q-10.

**Screen specification (from V2).** V2 has no separate manual-batch screen; its manual path is Studio `Cipta baharu` (`/admin/studio/questions/create`), specified field by field in R1-ADM-Q-04. The batch form of V3 (several questions under one upload header) is not observed in V2 — follow FR-ADM-Q10.1..Q10.2 and FR-ADM-QE5.1.
- Reference: V3 addition (D52, PAR A06); V2 path is Studio `Cipta baharu`.
- FR-ADM-Q10.1 Entry into a batch for several questions with the same upload header (QE-05.1) and group support (QE-02); same validation as the wizard.
- FR-ADM-Q10.2 Terima creates drafts carrying paper chosen (E2E F2 "chosen paper not carried").
- AC-ADM-Q10.1 Given a manual batch with Kertas 1, when Terima, then drafts carry Kertas 1.
- Gap: batch 0 questions after Terima (E2E F2). OQ: keep or fold into Studio (recommend keep, hidden from sidebar).

#### R1-ADM-Q-11 `Import CSV` and `Sejarah Import` | `/admin/questions/import`, `/admin/questions/import-history` | P0 (feeds Murid 9, 13, 16) | GH built / UAT built
- **Action: Fix** | gap and differences: 4.V row Q-11.

**Screen specification (from V2).**
- Route and title: `/admin/questions/import`, "Import CSV - Admin Panel". Entry: button `Import CSV` in the Senarai Soalan header (R1-ADM-Q-20).
- Regions in order: link `Kembali`; a notice "Halaman ini tidak aktif — guna alat import yang berfungsi" / "Antara muka ini replika reka bentuk origin dan tidak disambungkan ke enjin import." / "Untuk import sebenar, guna salah satu daripada:" with the links `Import DOCX (Studio)` and `Import CSV (panel Filament)` (V2 defect: the page is not connected; V3 must make it work); card "Muat Naik Fail CSV"; a side card "Format CSV (pengimport Filament)"; a card "Tips".
- Form fields: `Fail CSV *` (file; hint "Saiz maksimum: 5MB. Format: CSV atau TXT"); section "Tetapan Lalai (Opsional)" with "Nilai ini digunakan jika kolum berkaitan tiada dalam CSV."; `Subjek Lalai` (select "-- Tidak ditetapkan --" then 31 subjects); `Tahap Pendidikan` (Darjah 1 to Darjah 6, Tingkatan 1 to Tingkatan 5; V3 offers Tingkatan 1 to 5 only, D96); `Kesukaran` (Sangat Mudah, Mudah, Sederhana, Sukar, Sangat Sukar); note "Soalan akan disimpan sebagai draf"; button `Mula Import`.
- Format card: "Kolum mengikut kedudukan (baris pertama = header, dilangkau):" 1. `body` — Teks soalan; 2-5. `option_a` … `option_d` — Pilihan (kosongkan yang tiada); 6. `correct` — Jawapan (A/B/C/D); 7. `difficulty` — Kesukaran 1-5 (opsional, lalai 3); "Subjek dan tahap dipilih dalam dialog import, bukan dalam fail CSV."
- Tips card: "Fail CSV mesti encoding UTF-8"; "Guna petikan dua (") untuk teks yang ada koma"; "Baris pertama = header kolum"; "Semua soalan disimpan sebagai "draf"".
- States: success and error messages are not shown in the capture — follow R1-ADM-Q-11 and FR-ADM-QE6.1..QE6.3 (V3 columns replace the V2 positional format).
- Reference (V1; V2 stub dead; DISC 3.3): Filament columns `body, option_a-d, correct, [difficulty]`, creates draf.
- FR-ADM-Q11.1 Per QE-06; messages "Import selesai: {n} soalan diimport, {m} gagal." and "Fail CSV mesti mempunyai kolum question_text, correct_answer." (stale success banner cleared on error).
- AC-ADM-Q11.1 Given the admin uploads a CSV with every DSKP column filled (QE-06), when the import finishes, then the message reads "Import selesai: {n} soalan diimport, 0 gagal." and each row can be published without opening the wizard. Gap: no DSKP columns (E2E F2). Deviation: FD-QE-5.

#### R1-ADM-Q-12 `Kiriman Guru` | tab in Import & Semakan, `/admin/question-submissions` | P0 (feeds Guru 44, rated Tinggi) | GH route, BE none / UAT "Fungsi ini belum tersedia dalam demo" (this is the defect to remove, FR-ADM-H0.2)
- **Action: Build** (real backend behind the existing page) | gap and differences: 4.V row Q-12.

**Screen specification (from V2).**
- Route and title: `/admin/question-submissions`, "Kertas Soalan Guru - Admin Panel"; reached by the third tab `Kiriman Guru` of Import & Semakan (tabs `Kelompok Item`, `Kertas Diimport`, `Kiriman Guru` stay visible above the content).
- Regions in order: intro "Kertas yang dihantar guru diproses melalui aliran import Studio (DOCX/OCR → semakan → terbit)."; four count tiles `Jumlah`, `Pending`, `Processing`, `Selesai`; filter select `Semua Status` (options Pending, Processing, Selesai, Ditolak) with button `Tapis`; table with columns `Guru / Sekolah`, `Tajuk`, `Fail`, `Status`, `Tarikh`.
- States: empty "Tiada kertas soalan dihantar oleh guru lagi." (all tiles 0 in the capture). Row actions, detail page and error copy are not observed in V2 — follow FR-ADM-Q12.1..Q12.5.
- V3: the teacher is shown by role label and school, never by e-mail; each row links to `Semak` for papers.
- Reference: V2 lists teacher-uploaded files, admin downloads and imports by hand (DISC 3.2, labels unverified); V1 "Kertas Soalan Guru". Teacher questions arrive as `menunggu`/`guru_sumbang` and are approved with the same controls (DISC 3.3).
- Feeder note (D108(3)): this tab is fed by the Guru screens Sumbang Soalan and Hantar Kertas (Guru 44). It is NOT the feed of Murid 26 "Set Soalan Guru"; that module is fed by the teacher "Set Soalan" screen (V2 `/guru/set-soalan`) in the Guru portal.
- FR-ADM-Q12.1 The tab (page title "Kertas Soalan Guru", intro "Kertas yang dihantar guru diproses melalui aliran import Studio (DOCX/OCR → semakan → terbit).") shows tiles `Jumlah`, `Pending`, `Processing`, `Selesai`; a filter `Semua Status` (Pending, Processing, Selesai, Ditolak) with `Tapis`; a table with columns `Guru / Sekolah`, `Tajuk`, `Fail`, `Status`, `Tarikh`; and the empty state "Tiada kertas soalan dihantar oleh guru lagi."; it lists single questions (they already land in Studio as Reviewed, E2E F9) and paper PDFs. The teacher shows as a role label with the school, never by e-mail.
- FR-ADM-Q12.2 A paper PDF sent by a teacher creates an intake batch (D40 `INTAKE_TEACHER_ENABLED`) visible in `Kelompok Item` with source "Kiriman Guru"; no separate `/api/question-submissions` is built (OQ-Q12).
- FR-ADM-Q12.3 `provideIntake` is wired so `POST /api/guru/question-papers` stops returning 503.
- FR-ADM-Q12.4 Teacher-origin questions are Draft/Reviewed, never auto-approved (U5 only keeps the legacy teacher reference rule).
- FR-ADM-Q12.6 (F-15, D-A14) Teacher submissions come in as intake batches with `source=guru` (single questions and PDFs alike). A teacher MCQ opens in the Studio wizard with Subjek, Tingkatan, options and key prefilled; the admin may complete the DSKP fields (Unit, SP, TP, aras, Bab, Tahap kesukaran, Kertas) during review. Missing DSKP fields never block review or approval of the batch item; the gate blocks `Terbitkan` only (FR-ADM-QE4.5). A teacher's 1 to 5 star difficulty is stored as `difficultyLevel`; TP stays empty until the admin tags it. Status words shown to the teacher: Menunggu Semakan = `review`, Diluluskan = `approved`, Ditolak = `draft` with the rejection reason [PROPOSED].
- FR-ADM-Q12.5 The tab is a working screen backed by a real API in every environment (no mock path, no "belum tersedia" notice); each row shows the batch status and links to `Semak` (Q-09) for papers and to Studio for single questions.
- AC-ADM-Q12.1 (E2E) Given a teacher sends a question, then it shows in the tab and in Studio Reviewed; after the admin approves it, it is servable per its tags.
- AC-ADM-Q12.2 Given a teacher sends a PDF paper, then the response is 201 and the batch shows in Kelompok Item.
- AC-ADM-Q12.3 Given a teacher MCQ with no Unit, SP, TP or Bab, when the admin opens it from `Kiriman Guru`, then the wizard opens with the teacher's fields prefilled and review is allowed; `Terbitkan` is refused until Unit, SP, TP/aras and Bab are completed, then it publishes.
- Gap: `question-sets.ports.ts:46-63` (`UnavailablePaperIntake`, `provideIntake` never called); FE `submissions-unavailable.ts:7`. OQ-Q12 recommendation: reuse intake batches.

#### R1-ADM-Q-13 `Set Builder` landing | `/admin/studio/sets` | P0 | GH built / UAT 0 papers
- **Action: Fix** | gap and differences: 4.V row Q-13.

**Screen specification (from V2).**
- Route and title: `/admin/studio/sets`, "Set Builder - Admin Panel".
- Regions in order: the heading block "Bank soalan" / "Bina set soalan" / "Ambil soalan daripada kertas percubaan mengikut subjek, tahun dan negeri."; the mini form for an empty set; the card "Jana set"; the list "Set sedia ada".
- Empty-set form: `Tajuk set kosong` (text), `Subjek` (select "Subjek" then the 31 subjects, first Bahasa Melayu, Bahasa Inggeris, Matematik, Sains, Sejarah ...), button `Mula kosong` (creates a composite set with three empty sections Bahagian A/B/C, rule answer-all; flash "Set komposit dicipta. Seret soalan ke dalam Bahagian untuk mula.").
- Card "Jana set" / "Ambil soalan secara rawak": `Tajuk set` (placeholder "cth: Latih Tubi Sejarah Mac"), `Subjek` ("Pilih subjek"), `Bilangan soalan` (number 1 to 100), `Tahun — semua jika tiada pilihan` (2025, 2024, 2023, 2022, 2021), `Negeri — semua jika tiada pilihan` (chips: Johor, Kedah, Kelantan, Melaka, MRSM, Negeri Sembilan, Pahang, Perak, Perlis, Pulau Pinang, Sabah, SABK, Sarawak, SBP, Selangor, SMKA, Terengganu, WP Kuala Lumpur, WP Putrajaya).
- Aside "Kolam soalan": "Pilih subjek untuk melihat bilangan soalan tersedia."; "{n} soalan tersedia"; "Anda meminta {k} daripadanya."; warnings "Subjek ini tiada soalan berskema, jadi set tidak boleh dijana.", "Sama dengan jumlah kolam — setiap set akan serupa.", "Kurangkan bilangan soalan atau longgarkan penapis."; button `Jana set` (disabled unless the pool is large enough; flash "{n} soalan dijana secara rawak. Semak sebelum menerbitkan.").
- List "Set sedia ada": per set the title, a chip `Terbit` or `DRAF`, "Geografi · 40 soalan · 40 markah", and a state breakdown of the questions' origin ("Perlis 10", "Perak 8", "Pahang 7", "Selangor 6", "+3 lagi"). Clicking a set opens its builder (R1-ADM-Q-14).
- States: empty list copy and error copy not observed. V3 differences: FR-ADM-Q13.1..Q13.5 (one paper list, Kertas filter, groups drawn as units).
- Reference (DISC 3.4): title "Set Builder", subtitle "Kertas latihan daripada bank soalan percubaan"; "Bank soalan" / "Bina set soalan" / "Ambil soalan daripada kertas percubaan mengikut subjek, tahun dan negeri."; mini form `Tajuk set kosong` + `Subjek` + `Mula kosong` (3 empty sections Bahagian A/B/C, rule answer_all; flash "Set komposit dicipta. Seret soalan ke dalam Bahagian untuk mula."); card "Jana set" / "Ambil soalan secara rawak": `Tajuk set` (placeholder "cth: Latih Tubi Sejarah Mac"), `Subjek` ("Pilih subjek"), `Bilangan soalan` (1-100), `Tahun`, `Negeri` (chips), aside "Kolam soalan": "{n} soalan tersedia", "Anda meminta {k} daripadanya.", "Subjek ini tiada soalan berskema, jadi set tidak boleh dijana.", "Sama dengan jumlah kolam — setiap set akan serupa.", "Kurangkan bilangan soalan atau longgarkan penapis."; `Jana set` disabled unless pool sufficient; flash "{n} soalan dijana secara rawak. Semak sebelum menerbitkan."; list with chip `Terbit` / `Draf`.
- FR-ADM-Q13.1 The list is the only paper list (Pembina Kertas merged); columns title, subjek, kertas, status, soalan, `Dilihat murid`.
- FR-ADM-Q13.2 Jana set adds `Kertas` (D83 D-6), `Tahun` and `Negeri` filters, and a Bilangan field that follows the contract section totals when a Disahkan contract exists (otherwise 1-100 as V2).
- FR-ADM-Q13.3 Jana set draws groups as units (QE-07); the pool count shows questions and groups.
- FR-ADM-Q13.4 Header buttons `Kontrak Simulasi` and, per paper, `Sunting kontrak`.
- FR-ADM-Q13.5 Sejarah offers Kertas 1 and Kertas 2 (today only Kertas 2, E2E F4) when blueprints exist.
- AC-ADM-Q13.1 Given a Disahkan contract for Matematik K1 and a pool >= 40, when `Jana set`, then a 40-question draft with sections per contract is created in one click.
- AC-ADM-Q13.2 Given no Disahkan contract, then the page shows the V2 behaviour (set can be built) and Terbit asks for the audited exception (Q-15).
- Gap: two lists (`PaperListPage.vue` vs `SetBuilderLandingPage.vue`); Jana set lacks Tahun/Negeri/Bilangan free (E2E F4). Deviation: FD-Q13 added Kertas (D83 D-6) and group handling.

#### R1-ADM-Q-14 `Set Builder` (one set) | `/admin/studio/sets/:paper/builder` | P0 | GH built / UAT n/a
- **Action: Fix** | gap and differences: 4.V row Q-14.

**Screen specification (from V2).**
- Route and title: `/admin/studio/sets/{id}/builder`, "Set Builder - Admin Panel".
- Header: the set title, chip `DRAF` (or `Terbit`), "Jumlah markah keseluruhan: {n} markah", link `← Kembali`, button `Terbitkan` (while sending: `Menerbitkan…`).
- Left column "Bank Soalan": filters `Tahun` (2025 to 2021), `Negeri` (19 options, count shown "19 pilihan"), a search box "Cari teks soalan…"; the count line "100 soalan (dipaparkan 150 pertama)"; one card per question showing the stem (some with option lines I, II ...), "1 markah", "· Kertas 1 · 2025" and a button `Tambah` that adds it to the destination section (chosen in a select labelled "Bahagian destinasi").
- Right column: one block per section ("Bahagian A") with the line "1 markah setiap satu · Sumber: Kertas 1 · 2025", the counter "{n} / {N} dipilih", the rule select `Jawab Semua` / `Pilih N` with a number, the hint "Seret soalan ke sini, atau gunakan butang 'Tambah' pada senarai bank.", and the added questions, each with a badge `Terbit` where applicable and a button `Buang`.
- Messages (exact): "Soalan gagal ditambah — cuba lagi.", "Susunan gagal disimpan — muat semula halaman dan cuba lagi.", "Soalan gagal dibuang — cuba lagi.", "Bahagian gagal dikemas kini.", "Ralat semasa mencari bank soalan.", "Set ini tidak lulus pengesahan.", "Ralat tidak dijangka semasa menerbitkan.", "Ralat rangkaian semasa menerbitkan.", after publish "Set ini telah diterbitkan.", and for questions added after publishing "Set ini diterbitkan, tetapi {n} soalan yang ditambah selepas itu belum dibekukan. Terbitkan semula untuk membekukannya." The Panel variant adds title rename ("Set '{title}' telah dinamakan semula."), "Menunjukkan 150 teratas — tapis lagi untuk menyempitkan.", "Tiada soalan sepadan.", the chips `Disematkan` and `Tidak disajikan`, the contract panel (`Kontrak Simulasi`, `Sunting kontrak`) and the override checkbox "Terbitkan walaupun tidak memenuhi kontrak".
- Confirm dialogs: none observed. V3 differences: `Naik` / `Turun` instead of drag, groups as one card, `Pilih N` control — FR-ADM-Q14.1..Q14.6.
- Reference (DISC 3.4): header title and "Jumlah markah keseluruhan: {n} markah", "← Kembali", `Terbitkan` ("Menerbitkan…"); left "Bank Soalan" browser (Tahun, Negeri, "Cari teks soalan…", select aria "Bahagian destinasi", per card `Tambah`); right per Bahagian: "{n} / {N} dipilih", rule select `Jawab Semua` / `Pilih N` with number, hint "Seret soalan ke sini, atau gunakan butang 'Tambah' pada senarai bank.", per item `Buang` and badge `Terbit`; edit link returns "← Kembali ke set “{title}”"; errors "Soalan gagal ditambah — cuba lagi.", "Susunan gagal disimpan — muat semula halaman dan cuba lagi.", "Soalan gagal dibuang — cuba lagi.", "Bahagian gagal dikemas kini.", "Ralat semasa mencari bank soalan.", "Set ini tidak lulus pengesahan.", "Ralat tidak dijangka semasa menerbitkan.", "Ralat rangkaian semasa menerbitkan."; after publish "Set ini telah diterbitkan."; unpinned "Set ini diterbitkan, tetapi {n} soalan yang ditambah selepas itu belum dibekukan. Terbitkan semula untuk membekukannya."; Panel adds title edit ("Set '{title}' telah dinamakan semula."), search "Cari soalan…", "Menunjukkan 150 teratas — tapis lagi untuk menyempitkan.", "Tiada soalan sepadan.", chips `Disematkan`, `Tidak disajikan`, contract panel `Kontrak Simulasi` + `Sunting kontrak`, "Set ini belum memenuhi kontrak penuh (K2 subjektif tiada).", "Set kelihatan belum lengkap — ada bahagian tanpa soalan.", override "Terbitkan walaupun tidak memenuhi kontrak".
- FR-ADM-Q14.1 Add / reorder / remove with `Naik` / `Turun` on touch (D83 D-9); marks and "n / N dipilih" update live.
- FR-ADM-Q14.2 Each Bahagian has the rule control `Jawab Semua` / `Pilih N` (today missing: E2E F4) writing `rule` `all|choose n` (exam schema D5) and `mark_budget` after choose-N.
- FR-ADM-Q14.3 Groups placed as units (QE-07); bank browser shows groups as one card "Rajah 3 · 4 soalan".
- FR-ADM-Q14.4 Only servable (Approved, complete DSKP) questions appear in the bank browser; untagged legacy MCQs do not (D80).
- FR-ADM-Q14.5 `Terbitkan` pins a snapshot per membership; publishing is a single action; the contract gate uses Q-15 rules.
- FR-ADM-Q14.6 Blocker list names each failing item ("Bahagian A: Kurang 9 soalan (perlu 10, ada 1)").
- AC-ADM-Q14.1 Given section B rule `Pilih N` with N=3 of 5, then the pupil answers any 3 and the paper total uses `mark_budget`.
- AC-ADM-Q14.2 (E2E) Given a built paper under a Disahkan contract, when `Terbitkan`, then the T5 pupil sees it in Bijak SPM on the next load (R1-16.1) and a sitting submits and marks.
- Gap: Pembina Kertas duplicate; no Pilih N control (E2E F4). Deviation: none other.

#### R1-ADM-Q-15 `Semak Kertas Simulasi` / Terbit | `/admin/spm/kertas/:id` (from lane row `Sunting`; also `Semak & Terbit` tab) | P0 | GH built (as Pembina Kertas) / UAT n/a
- **Action: Fix** | gap and differences: 4.V row Q-15.

**Screen specification (from V2).**
- Routes and titles: lane list `/spm/simulasi` ("Bijak SPM"; see R1-ADM-Q-02); paper review `/spm/simulasi-paper/{id}/review`, page title "{paper title} · PrestasiPlus Panel".
- Regions in order: link `Kembali ke Simulasi`; heading = paper title with a chip (`Draf` or `Terbit`) and the meta line "Matematik · Kertas 2 · 17 soalan", `Tempoh` ("—" when unset) and `Status` ("Draft"); card `Kemas kini metadata`; card `Bahan rujukan (kulit kertas)`; card `Isu import ({n})`; the publication block ("Belum boleh diterbitkan", "{n} masalah" and each blocker line); the contract block `Kontrak Simulasi`; then the sections.
- `Kemas kini metadata` fields: `Tajuk`; `Tempoh (minit)`; `Kod kertas (kulit)` (hint "Dipapar di kulit kertas (cth. 1449/1). Kosong = kod subjek “MATH”."); `Arahan kulit kertas` (textarea, one numbered instruction per line, hint "Satu baris = satu arahan bernombor. Kosongkan untuk tiada arahan."; example lines "Tulis nombor kad pengenalan, angka giliran, nama dan tingkatan anda pada petak yang disediakan.", "Kertas peperiksaan ini mengandungi tiga bahagian: Bahagian A, Bahagian B dan Bahagian C.", "Jawapan hendaklah ditulis pada ruang jawapan yang disediakan di dalam kertas peperiksaan ini.", "Kertas peperiksaan ini adalah dalam dwibahasa.", "Jawapan boleh ditulis dalam bahasa Melayu / bahasa Inggeris.", "Rajah yang mengiringi soalan tidak dilukis mengikut skala kecuali dinyatakan.", "Kerja mengira anda mesti ditunjukkan."); button `Simpan`.
- `Bahan rujukan (kulit kertas)`: link `Sunting bahan rujukan`; text "Dipapar kepada pelajar di kulit kertas, antara jadual pemeriksa dan Bahagian pertama — cth. halaman rumus, jadual pemalar."; list of panels (e.g. "Rumus Matematik / Mathematical Formulae").
- `Isu import (20)` with a link `Lihat`. Blocker line example: "Soalan 11: Bahagian (i): skema mark_scheme_points kosong." The contract block shows "Tiada kontrak untuk subjek/kertas ini." when none exists.
- Section blocks: heading "Bahagian A" with a link `Sunting bahagian` and the rule text "Jawab semua soalan."; each question "Soalan {n}" with a link `Sunting petikan` (when it has a stimulus) and `Sunting soalan`; each part shows its prompt in BM and EN, the mode (e.g. extended_essay, short_text), "{n} markah" and the label "Ruang jawapan esei".
- Further controls (publish, withdraw, copy, add and delete question) and their exact texts are listed in the Reference above. V3 differences: FR-ADM-Q15.1..Q15.4 (Terbit gate, audited exception, `Dilihat murid di`).
- Reference (DISC 3.4, AC-R1-21.3): blocks in order `Kontrak Simulasi` ("Tiada kontrak untuk subjek/kertas ini."), `Kemas kini metadata` (`Tajuk`, `Tempoh (minit)`, `Kod kertas (kulit)`, `Arahan kulit kertas`; flash "Kertas '{title}' telah dikemas kini."), `Sunting bahagian` (`Label bahagian`, `Peraturan menjawab`, `Bilangan soalan dipilih`, `Arahan bahagian`; "Bahagian '{label}' telah dikemas kini."), `Sunting petikan` (`Tajuk petikan`), `Bahan rujukan (kulit kertas)` (`Tambah gambar`, `Tajuk panel`, `Buang panel`; "Bahan rujukan kertas telah dikemas kini."), `Tambah soalan` (`Nombor soalan`, `Jenis jawapan`, `Markah`; errors "Soalan hanya boleh ditambah ke bahagian yang dicipta oleh admin.", "Nombor soalan {x} sudah digunakan dalam kertas ini."), `Padam soalan` (confirm "Soalan tambahan ini, termasuk bahagian, pilihan jawapan dan skemanya, akan dibuang dari kertas. Tindakan ini tidak boleh dibatalkan."; "Soalan {label} telah dipadam."), `Salin set` ("Set disalin sebagai draf. Sunting dan terbitkan salinan baharu."), `Penerbitan`: "Belum boleh diterbitkan" + blockers + `Terbit`; live "Kertas ini sedang DITERBITKAN — pelajar boleh mengaksesnya di Simulasi." + `Sembunyikan`; publish confirm "Terbitkan kertas ini? Ia akan terus boleh diakses pelajar di Simulasi."; override checkbox "Terbitkan walaupun tidak memenuhi kontrak Simulasi"; flashes "Kertas '{title}' telah DITERBITKAN — kini boleh diakses pelajar di Simulasi.", "Kertas ini belum boleh diterbitkan — {n} masalah perlu dibetulkan.", "Kertas ini tidak memenuhi kontrak blueprint subjek.", "Kertas '{title}' ditarik balik ke DRAF — tidak lagi diakses pelajar." (`Tarik balik ke draf`, confirm "Tarik balik kertas ini ke draf? Pelajar tidak lagi dapat mengaksesnya."); published paper read-only: "Kertas ini sudah diterbitkan — tekan “Salin set” di atas untuk menyunting salinan draf.".
- FR-ADM-Q15.1 The Terbit gate: every question Approved and servable, group integrity, section totals and rules match the Disahkan contract; otherwise blockers list.
- FR-ADM-Q15.2 With a Disahkan contract the exception box is hidden; without it the audited exception (checkbox + reason >= 5 characters + second `Terbitkan`; flash "Diterbitkan dengan 1 pengecualian kontrak (direkodkan).") remains available to Admin Pusat only (R1-16.2).
- FR-ADM-Q15.3 A "Dilihat murid di" line per paper: which Tingkatan and subject pupils see it.
- FR-ADM-Q15.4 Admin Sekolah and Guru cannot publish (403).
- AC-ADM-Q15.1 Given a draft with a blocker, then `Terbit` is disabled with title "Betulkan {n} masalah dahulu".
- AC-ADM-Q15.2 (E2E) Given the paper is Terbit, when the T5 pupil sits it and presses `Cuba Lagi`, then a new attempt starts (E2E F8 already passes on GH).
- AC-ADM-Q15.3 Given `Tarik balik ke draf`, then the pupil no longer lists it (a sitting in progress keeps its pinned version).
- Gap: duplicate with Set Builder; "every publish needs exception" (E2E F4, F7). Deviation: none.

#### R1-ADM-Q-16 `Kontrak Simulasi` (blueprint) | `/admin/spm/kontrak`, `/admin/spm/kontrak/:subjek/:kertas`, `/kolam` | P0 | GH built / UAT 0 contracts
- **Action: Fix** | gap and differences: 4.V row Q-16.

**Screen specification (from V2).**
- Route and title: `/spm/kontrak` (Panel), "Kontrak Simulasi · PrestasiPlus Panel". There is no sidebar entry; it is opened from the paper screens.
- Regions in order: banner "Kontrak dikongsi. Setiap kontrak di bawah ialah peraturan bagi satu subjek × kertas — bukan satu set soalan. Menyunting kontrak ini mengubah pintu terbitan (publish gate) untuk SEMUA kertas subjek tersebut, bukan hanya satu kertas."; heading `Senarai Kontrak` with the count "36 kontrak" and the button `Baharu`; then one card per subject and paper.
- Card header: "{Subjek}" and "Kertas {n}" with a badge `Spec` or "Draf — sahkan dengan LPM"; button `Padam kontrak`.
- Card fields: `Kod Kertas` (text); `Tempoh (minit)` (number); `Jumlah Markah` (number); `Sumber` (select: `Draf`, `Spec`, `Disahkan`); `Boleh tanda auto` (checkbox); `Nota` (text; observed examples "subjektif; no objective paper", "confirm duration against LPM", "draft; confirm against LPM", "Rangka — sahkan struktur, markah & tempoh dengan LPM sebelum guna.").
- Section table (heading `Bahagian`, button `Tambah Bahagian`; empty "Tiada Bahagian lagi."): per row `Label`, `Peraturan Pilihan` (select `Tiada`, `Jawab Semua`, `Pilih N`; `Pilih N` reveals a number), `Markah`, `Arahan (opsyenal)`, `Mod Jawapan Dijangkamc` multi-select (`mcq`, `short text`, `numeric`, `numbered list`, `extended essay`, `essay choice`, `working shown`, `graph plot`, `draw on diagram`, `table fill`, `sequence order`, `code`, `gapped text match`, `cloze`), and a remove-section control; the card ends with button `Simpan`.
- Create dialog `Baharu`, flashes and delete confirm: "Kontrak Baru"/"Kontrak dicipta."/"Kontrak dikemas kini."/"Kontrak dipadam."/"Padam kontrak ini?" are listed in the Reference above (from V2 code); not visible in the capture.
- V3: the 14 modes are replaced by the 8 question types (exam schema D1); `Disahkan` is set only through the verification tab (FR-ADM-Q16.2).
- Reference (DISC 3.7, AC-R1-21.4): heading `Senarai Kontrak`; `Baharu` -> "Kontrak Baharu" (`Subjek`, `Kertas` 1-4, `Cipta`); duplicate "Kontrak untuk subjek/kertas ini sudah wujud."; editor fields in order `Kod Kertas`, `Tempoh (minit)`, `Jumlah Markah`, `Sumber` (`Draf`, `Spec`, `Disahkan`), `Boleh tanda auto`, `Nota`; `Bahagian` table (`Tambah Bahagian`, "Tiada Bahagian lagi.", `Label` "Contoh: Bahagian A", `Peraturan Pilihan` Tiada/Pilih N, `Markah`, `Arahan (opsyenal)`, `Mod Jawapan Dijangka`, "Buang Bahagian"); `Simpan`; flashes "Kontrak dicipta.", "Kontrak dikemas kini.", "Kontrak dipadam."; "Kontrak dikongsi."; dialog "Padam kontrak ini?"; empty "Tiada kontrak lagi. Cipta kontrak pertama menggunakan butang "Baharu" di atas." V3 adds exact unit quotas, TP profile, KBAT quota, tab Pengesahan with evidence (D76).
- FR-ADM-Q16.1 Reached from the Set Builder landing (button `Kontrak Simulasi`), the Set Builder and Semak Kertas panels (`Sunting kontrak`) and the direct URL; there is no sidebar entry and no hub or lane button, as in V2 (DISC 3.7; D107 closes OQ-04). The Set Builder landing is usable with no contract so the first contract can be created there.
- FR-ADM-Q16.2 The `Sumber` select shows `Draf`, `Spec`, `Disahkan`. Choosing `Disahkan` opens the Pengesahan tab (it does not write the value directly); the tab shows the Syarat Disahkan rows with pass/fail, the evidence record (>= 2 bodies incl. skema, D76(4)) and the button `Sahkan`.
- FR-ADM-Q16.3 Only Admin Pusat can set Disahkan (R1-15.1); a Disahkan contract is immutable in place ("Kontrak Disahkan tidak boleh diubah di tempat. Cipta versi baharu dahulu."); a structural edit makes a new Spec version (AC-39.4).
- FR-ADM-Q16.4 When checks fail, every failing check is listed with the field to fix; "Belum lengkap untuk Disahkan (n)" count is shown.
- FR-ADM-Q16.5 The list shows counts Disahkan / Spec / Draf and a filter by Sumber; a contract with no evidence is marked "perlu semakan".
- FR-ADM-Q16.6 `Pratonton Kolam` shows per unit and KBAT quota whether the pool can fill (which unit is short).
- AC-ADM-Q16.1 Given the admin creates Matematik Tambahan K2 3472/2 with sections and fills the evidence, when `Sahkan`, then the source is Disahkan and `servesStudents` is true.
- AC-ADM-Q16.2 Given a failing check (unit quota not met), then `Sahkan` is refused and the list names the check.
- AC-ADM-Q16.3 (E2E) Given Matematik 1449/1 Disahkan and a published paper under it, then the T5 pupil's Bijak SPM lists it without an exception record.
- Gap: Disahkan "cannot be chosen" (E2E F7); all 8 Spec; `form.ts:65` "a Disahkan head is shown, never written". Deviation: FD-Q16 Disahkan via verification (V2 allows selecting it; D76(4) requires evidence) — D9: V2 allows an unverified value, contradicting D76.
- OQ: none (OQ-04 closed by D107).

#### R1-ADM-Q-17 `Tracking A` lane and set editor | `/admin/spm/tracking-a`, `/admin/spm/tracking-a/:set/sunting` | P0 | GH 404 / UAT 404, 0 sets
- **Action: Build** | gap and differences: 4.V row Q-17.

**Screen specification (from V2).**
- Lane list: `/admin/spm/tracking-a` ("Tracking A - Admin Panel") and Panel `/spm/tracking-a`: see R1-ADM-Q-02 (rows "Bahasa Melayu · 2026 Set 1", "#1 · ramalan · 8 soalan", attention "Hanya 8 daripada 40 soalan — 28471 tersedia untuk diisi", action `Sunting`).
- Editor route and title: `/spm/tracking-a/{id}/sunting`, "{Subjek} · 2026 · Set 1 · PrestasiPlus Panel".
- Regions in order: heading "Tracking A"; section "Soalan dalam set" with the counter "8 / 40"; the numbered list of members; the drag help text ("To pick up a draggable item, press the space bar.", "While dragging, use the arrow keys to move the item.", "Press space again to drop the item in its new position, or press escape to cancel."); the block `Isi set`; the right pane `Sunting Soalan`.
- Member row: number, the stem, a status word ("diarkib" for an archived question) with "Tidak disajikan kepada pelajar", and the actions `tukar` and `buang`.
- `Isi set`: button plus "32 soalan lagi diperlukan." and "Soalan tersedia untuk Bahasa Melayu: 28,471" (counts raw questions).
- Right pane: heading `Sunting Soalan`, text "Pilih soalan untuk menyunting." until a member is selected.
- The other texts (`Simpan`, "Set ini lengkap.", "Tiada soalan lain yang boleh disajikan untuk ditukar.", "Set dikemas kini.") are in the Reference above (V2 code), not in the capture. V3: groups as units — FR-ADM-Q17.6.
- Reference (DISC 3.5): screen "Set Tracking A" (title `Tracking A`, section "Soalan dalam set"); drag handle "Susun semula soalan"; per row `tukar` (replace with another servable question; "Tiada soalan lain yang boleh disajikan untuk ditukar." / "Tukar gagal."; notice "Soalan yang ditukar telah dibuang; tukaran diabaikan."), `buang`, chip `Baharu`; `Isi set` (fills shortfall; "Tiada soalan lain yang boleh disajikan untuk mengisi set ini."; hidden when full); "Set ini masih kosong." / "Set ini lengkap."; right pane "Sunting Soalan" ("Pilih soalan untuk menyunting.", "Memuatkan…", `Cuba lagi`, "Buka di laman berasingan"); `Simpan`; nothing committed until Simpan; "Pilih sekurang-kurangnya satu soalan sebelum menyimpan."; success "Set dikemas kini."; click path 5; a set reaches `target_count` to leave locked.
- FR-ADM-Q17.1 Lane list per subject with `Perhatian` "set tidak lengkap".
- FR-ADM-Q17.2 Editor with `Isi set`, `tukar`, `buang`, `Simpan` and `Tambah Set` (U3), touch `Naik`/`Turun`.
- FR-ADM-Q17.3 Candidates are servable questions only, figure questions and stimulus groups included (D105; the R1 text-only restriction of D92(1) is removed); a question is not reused in a sibling set of the same subject/year (`validateSave`).
- FR-ADM-Q17.4 The editor selects existing bank questions; it does not create questions. Any question created from this screen goes through Q-04 (no entry path outside the standard), and a stimulus group is added or removed as one unit (QE-07).
- FR-ADM-Q17.5 Save in one transaction; incomplete sets show "set tidak lengkap" on the hub.
- FR-ADM-Q17.6 Stimulus-group rule (D90, restated here, not only by reference to QE-07): a stimulus group is one unit in a Tracking A set. `Isi set`, `tukar` and `buang` add, replace or remove all questions of a group together, in group order; a set never holds a question without its figure or a figure without the questions placed with it; `target_count` counts questions (a group counts as its number of questions); the pupil sees the figure once above its questions; if a group does not fit the remaining slots, `Isi set` skips it and says so.
- AC-ADM-Q17.1 Given an empty set with target 20 and 30 servable candidates, when `Isi set` then `Simpan`, then the set has 20 and the pupil's Tracking A shows it unlocked.
- AC-ADM-Q17.2 (E2E) Given a saved complete set, when the T5 pupil opens Tracking A, then the set is playable (the "sifar" state gone).
- AC-ADM-Q17.3 Given a candidate group "Rajah 3" of 4 questions and 3 free slots, when `Isi set`, then the group is not split (it is skipped with the reason) and the 3 slots are filled from other candidates; given 4 free slots, then all 4 members are added together in order.
- Data: migration 0104, `/api/admin/spm/tracking-a*` (ADR-0032; not built); table `spm_tracking_sets` seed-only.
- Gap: 404 (E2E F5). Deviation: touch buttons (D9). OQ-Q17 legacy `spm_sets` vs canonical composites — Evidence needed E-07.

#### R1-ADM-Q-18 `Kertas Subjektif` | `/admin/kertas-subjektif` (list), detail `/admin/kertas-subjektif/:id` | P0 (feeds Murid 13 Subjektif; fully working at release, D104) | GH 404 / UAT 404
- **Action: Build** | gap and differences: 4.V row Q-18.

**Screen specification (from V2).**
- Admin route and title: `/admin/kertas-subjektif`, "Kertas Subjektif - Admin Panel". Regions: three tiles `Jumlah Kertas`, `Diterbitkan`, `Ada Skema` (V2 production 254 / 254 / 135); filter selects `Semua Subjek`, `Semua Kertas`, `Semua Status` (with Diterbitkan, Draf) and a button `Tapis`; the table.
- Admin table columns: `Subjek`, `Kertas` ("K2"), `Negeri` (e.g. "Bm Kelantan"), `Tahun`, `Halaman` (e.g. "10", "13 + 14 skema"), `Status` (a badge "tiada skema" or the page count with schema count, and the status word `Diterbitkan`), `Tindakan` with `Pratonton` and `Sembunyi`.
- Panel route and title: `/spm/kertas`, "Kertas Subjektif · PrestasiPlus Panel" (the path `/spm/kertas-subjektif` returns 404 in V2). Regions: tiles as above; filters `Subjek`, `Kertas` (`Semua Kertas`, `Kertas 2`, `Kertas 3`, `Kertas 4`), `Status` (`Semua Status`, `Terbit`, `Draf`), buttons `Cari`, `Tapis`, `Set Semula`; heading `Senarai Kertas` with "254 kertas" and the button `Baharu`.
- Panel table columns: `Tajuk` (e.g. "Kimia Kertas 3 — Mrsm 2025"), `Subjek`, `Kertas`, `Negeri`, `Tahun`, `Halaman` ("9 (+6 skema)" or "14"), `Status` ("Terbit"), `Tindakan`: `Sunting`, `Halaman`, `Sembunyikan`, `Padam`. Pager of 9 pages.
- Create/edit form fields and flash texts (`Tajuk`, `Subjek`, `Kertas`, `Negeri`, `Tahun`, `Tempoh (minit)`, `Jumlah Markah`, `Cipta`/`Batal`; "“{title}” telah dicipta sebagai draf." ...) are listed in the Reference above (V2 code); the detail page `Lihat sebagai pelajar`, `Halaman Kertas`, `Skema` was not captured (the preview link opened the pupil URL) — Not observed in V2 — follow FR-ADM-Q18.1..Q18.8.
- V2 stores page images; V3 stores editable text with stimulus groups (D81). No flag switches the lane off (D104).
- Reference (DISC 3.6): main-site title "Kertas Subjektif", subtitle "Kertas 2/3/4 percubaan negeri — pratonton & terbitan"; tiles `Jumlah Kertas`, `Diterbitkan`, `Ada Skema`; filters (Semua Subjek / Semua Kertas / Semua Status with Diterbitkan, Draf), `Tapis`; columns `Subjek`, `Kertas`, `Negeri`, `Tahun`, `Halaman`, `Status`, `Tindakan`; actions `Pratonton`, `Sembunyi`, `Terbit`; empty "Tiada kertas sepadan penapis." Panel: `Baharu` form (`Tajuk` "Contoh: Bahasa Melayu Kertas 2", `Subjek` "Tiada subjek", `Kertas`, `Negeri`, `Tahun`, `Tempoh (minit)`, `Jumlah Markah`, `Cipta`/`Batal`), flashes "“{title}” telah dicipta sebagai draf.", "“{title}” telah dikemas kini.", "“{title}” telah dipadam.", "“{title}” kini diterbitkan.", "“{title}” disembunyikan daripada pelajar.", error "“{title}” tiada halaman — tidak boleh diterbitkan.", delete "Padam kertas ini?"; badge "tiada skema"; detail `Lihat sebagai pelajar`, `Halaman Kertas`, `Skema`/`Halaman Skema`.
- V2 could not upload page images (CLI only). D81 replaces the content method: upload -> OCR -> sunting -> terbit as reflowing text, skema in a separate tab, students use "Tunjuk Skema Pemarkahan".
- FR-ADM-Q18.1 List, create, edit, `Terbit`/`Sembunyikan`/`Padam` per V2 labels above.
- FR-ADM-Q18.2 Content entry follows D81 and section 4.0: upload paper PDF (+ skema PDF) -> OCR/text layer -> editable text with figures as stimulus groups and numbering kept -> admin edits -> `Terbit`. Figures and passages are stimulus objects shared by their questions, never pages cut into pseudo-questions; page-image storage (V2 `paper_documents`) is not used.
- FR-ADM-Q18.3 Terbit is refused with no content: "“{title}” tiada halaman — tidak boleh diterbitkan." is replaced by [PROPOSED] "“{title}” tiada kandungan — tidak boleh diterbitkan." (D9: pages no longer exist).
- FR-ADM-Q18.4 Student visibility needs only `Terbit`: Kertas Subjektif is fully working at release and no feature flag switches it off (D104, which supersedes the "flag OFF" part of D80(2)); there is no `kertas-subjektif` switch in Kawalan Ciri.
- FR-ADM-Q18.5 OCR engine: Tesseract msa+eng behind `DocumentReader` (U1); the bake-off on 5 scanned papers is a release gate for this screen (E-05).
- FR-ADM-Q18.6 Each question of a Kertas Subjektif paper carries the DSKP tags and structure of QE-03/QE-04: Subjek, Tingkatan, Unit, SP, TP and aras per leaf, Kertas and Bahagian from the contract, type per exam schema D1 (`Berstruktur`, `Karangan / Respons Terbuka`, `Pengiraan dengan Langkah Kerja`), mark scheme K/N/P (D4); the completeness panel (QE-04) lists what is missing and `Terbit` is blocked until none is.
- FR-ADM-Q18.7 Stimuli are stimulus groups (QE-01, QE-02, QE-05): a rajah or petikan referenced by several questions is stored once and shown once above them, in the editor, in the preview and to the pupil; the paper cannot place a question without its stimulus.
- FR-ADM-Q18.8 The skema is edited in its own tab and revealed to the pupil after submit ("Tunjuk Skema Pemarkahan"), so the pupil can self-mark each part against the scheme points; a paper whose question has no scheme is flagged "tiada skema — tidak disajikan" on the hub card (DISC 3.0) and cannot be published.
- AC-ADM-Q18.1 Given an uploaded scanned PDF with Rajah 2 referenced by questions 3-4, when OCR finishes, then the editor shows one stimulus and two questions.
- AC-ADM-Q18.2 (E2E) Given a published Kertas Subjektif with a skema, when a T5 pupil opens it from Subjektif, reads it, submits and presses "Tunjuk Skema Pemarkahan", then the scheme shows and the pupil can self-mark each part; no flag or setting hides it.
- AC-ADM-Q18.3 Given a question with no unit and no TP, when the admin presses `Terbit`, then it is refused with the messages "Sila pilih unit DSKP." and "Bahagian (a) belum ada TP." and the paper stays Draf.
- Gap: not built (KS-07). Deviation: FD-Q18 content method (D81), "kandungan" for "halaman". OQ: evidence E-05.

#### R1-ADM-Q-19 `Sumber Kertas` | `/admin/source-papers`, `/admin/source-papers/:id` | P2 | GH hidden (BS-03) / UAT none
- **Action: Build** | gap: 4.V row Q-19.

**Screen specification (from V2).**
- List route and title: `/admin/source-papers`, "Sumber Kertas - Admin Panel". Regions: two tiles `Jumlah Kertas` (82) and `Perlu Semakan` (2); filter bar: selects `Semua Subjek` (31 subjects), `Semua Tahun` (2025 to 2021), `Semua Negeri` (Johor ... WP Putrajaya, MRSM, SBP, SABK, SMKA, SPM(U), PPD), `Semua Kertas` (Kertas 1, 2, 3), `Semua Jenis` (Percubaan, Sebenar, Modul), a checkbox `Perlu Semakan`, button `Tapis`; table; pager.
- Table columns: `Subjek` ("—" when unset), `Tahun`, `Negeri`, `Kertas`, `Jenis`, `Bilangan Soalan`, `Sumber` ("Import (PDF/DOCX)"), `Status` (badge `OK`; other badges `Perlu Semakan`, `Skema`), link `Lihat`. Empty: "Tiada kertas dijumpai."
- Detail route and title: `/admin/source-papers/{id}`, "Butiran Sumber Kertas - Admin Panel"; link `← Kembali ke Sumber Kertas`; facts `Subjek`, `Tahun`, `Negeri`, `Kertas`, `Jenis`, `Sumber` (a code such as corpus_pdf), `Skema?` (Ya/Tidak), `Perlu Semakan` (Ya/Tidak), `Fail:` (source file name); the section "Isu Import" when issues exist; the section "Soalan Diimport ({n}) — semuanya draf" with columns `No.`, `Soalan` (stem cut with "..."), `Bilangan Bahagian`, and a link `Sunting di Studio` per row; empty "Belum ada soalan diimport untuk kertas ini."
- The page is read-only; 25 per page.
- Reference (V2 code, `SourcePaperController.php`, views `admin/source-papers`): title "Sumber Kertas", subtitle "Registri provenance kertas peperiksaan"; tiles `Jumlah Kertas`, `Perlu Semakan`; filters `Semua Subjek`, `Semua Tahun`, `Semua Negeri`, `Semua Kertas` (Kertas 1-3), `Semua Jenis`, checkbox `Perlu Semakan`, `Tapis`; columns `Subjek`, `Tahun`, `Negeri`, `Kertas`, `Jenis`, `Bilangan Soalan`, `Sumber`, `Status` (badges `Perlu Semakan` / `Skema` / `OK`), link `Lihat`; empty "Tiada kertas dijumpai."; detail title "Butiran Sumber Kertas", "← Kembali ke Sumber Kertas", facts, "Isu Import", "Soalan Diimport ({n}) — semuanya draf" with link `Sunting di Studio`, empty "Belum ada soalan diimport untuk kertas ini."; read-only, 25 per page.
- FR-ADM-Q19.1 Read-only registry over intake batches (the D99 declaration) and migrated source papers, same filters and columns.
- FR-ADM-Q19.2 Detail lists the batch's questions with `Sunting di Studio`.
- AC-ADM-Q19.1 Given a batch uploaded with Tahun 2025 and Negeri Johor, then it appears with those values and its question count.
- Gap: D83 D-10 hid it; V2 menu has it. Deviation: source = V3 batches. OQ-05.

#### R1-ADM-Q-20 `Senarai Soalan` (Bank Lama) | `/admin/questions` | P1 | GH built / UAT built
- **Action: Fix** | gap and differences: 4.V row Q-20.

**Screen specification (from V2).**
- Route and title: `/admin/questions`, "Senarai Soalan - Admin Panel".
- Regions in order: banner "Ini bank soalan lama (model flat). Soalan baharu dicipta dan diterbitkan di bank kanonikal." with link `Bank Soalan (Studio)`; tabs `Senarai` / `Kualiti` / `Laporan`; heading "📚 Pengurusan Soalan" with "Urus bank soalan untuk platform PRESTASIPLUS"; header buttons `Tambah Soalan` (short label `Tambah`), `Import CSV` (`Import`), `Arkib Semua` (`Arkib`); the summary "Ringkasan Bank Soalan" with "Jumlah: {n} soalan"; the filter form; the table; the pager.
- Summary: grouped "Subjek Teras" (Bahasa Melayu, Bahasa Inggeris, Matematik, Sains, Sejarah, Pendidikan Islam, Pendidikan Moral) and "Subjek Elektif" (Matematik Tambahan, Fizik, Kimia, Biologi, Geografi, Pendidikan Seni Visual, ...); each subject shows its total and "{m} lulus".
- Filters: `Subjek` (select, all subjects); `Tahap` (`Semua Tahap`, Darjah 1 to 6, Tingkatan 1 to 5; V3: Tingkatan 1 to 5 only, D96); `Kesukaran` (`Semua`, "⭐ Sangat Mudah", "⭐⭐ Mudah", "⭐⭐⭐ Sederhana", "⭐⭐⭐⭐ Sukar", "⭐⭐⭐⭐⭐ Sangat Sukar"); `Status` (`Semua Status`, `Draf`, `Menunggu`, `Diluluskan`, `Ditolak`, `Diarkib`); `DSKP` (`Semua`, `Ada DSKP Tag`, `Belum Ditag`); `Compliance` (`Semua`, `Verified`, `AI Verified`, `Pending Mapping`, `Tiada Source PDF`); `Source` (`Semua`, `Textbook`, `DSKP`, `Trial`, `Skema`); text search "Cari teks soalan..."; button `Cari`.
- Table columns: `#`, `Soalan`, `Subjek`, `Tahap`, `Kesukaran`, `Status`, `Tindakan`. A row: the question id, the stem cut at about 90 characters with "...", the line "Source: RIP:DATABANK", subject, level, difficulty (empty when unset), the status badge ("Diluluskan"), and the action `Arkib` (approved rows) or `Luluskan` (other rows).
- Dialog and flash texts of `Luluskan Hasil Tapisan` and `Arkib Semua` are in the Reference above; the capture shows no dialog.
- Reference (DISC 3.3): title "Senarai Soalan", subtitle "Pengurusan bank soalan platform", heading "📚 Pengurusan Soalan" / "Urus bank soalan untuk platform PRESTASIPLUS"; header `Tambah Soalan` (redirect to Studio, notice "Borang soalan lama telah dipindahkan ke Studio. Sila cipta soalan baharu di sini."), `Import CSV`, `Luluskan Hasil Tapisan` (title "Luluskan semua soalan yang sepadan dengan tapisan semasa"; confirm "Luluskan SEMUA soalan hasil tapisan ini? Ia akan kelihatan kepada pelajar."; no filter: "Sila pilih sekurang-kurangnya satu penapis (subjek/aras/status/carian) sebelum meluluskan secara pukal."; success "Berjaya luluskan {n} soalan (hasil tapisan) — kini kelihatan kepada pelajar."), `Arkib Semua` (confirm "ARKIB SEMUA soalan?..."; success "Berjaya arkib {n} soalan. Bank pelajar kini kosong — luluskan soalan secara manual untuk memaparkannya semula."); "Ringkasan Bank Soalan" ("Jumlah: {n} soalan"); filters `Subjek`, `Tahap`, `Kesukaran`, `Status` (Draf, Menunggu, Diluluskan, Ditolak, Diarkib), `DSKP` (Ada DSKP Tag / Belum Ditag), `Compliance`, `Source`, "Cari teks soalan...", `Cari`; tabs `Kualiti` (Q-21), `Laporan` (Q-22); row icons "Luluskan — paparkan kepada pelajar", "Arkib — sembunyikan daripada pelajar"; badge `VERIFIED`.
- FR-ADM-Q20.1 Same page, same data as Studio (A1); labels use V3 status names with the V2 names in tooltips only if user approves (OQ none: keep V3 status vocabulary).
- FR-ADM-Q20.2 `Luluskan Hasil Tapisan` applies the approval gate per row; rows failing it are skipped and reported ("n gagal"), never approved untagged for SPM-bound T4/T5 (D80 DEC-2: the gate applies to new approvals).
- FR-ADM-Q20.3 `Arkib Semua` requires a typed confirmation [PROPOSED] because it empties the pupil bank on UAT.
- AC-ADM-Q20.1 Given a filter with 100 rows, when `Luluskan Hasil Tapisan`, then the dry-run message "{eligible} soalan boleh diproses daripada {matched} hasil tapisan." appears before confirm.
- Gap: duplicate "Bank Soalan" label (`menu.ts:95`). Deviation: FD-Q20 gate skipping.

#### R1-ADM-Q-21 `Kualiti Soalan` (tab) | `/admin/questions/quality` | P2 | GH built / UAT built
- **Action: Fix** (becomes a tab) | gap and differences: 4.V row Q-21.

**Screen specification (from V2).**
- Route and title: `/admin/questions/quality`, "Dashboard Kualiti Soalan - Admin Panel"; tabs `Senarai` / `Kualiti` / `Laporan` above.
- Regions in order: four tiles `Jumlah Soalan`, `Disahkan (Verified/AI)` (a percentage), `Bertag DSKP` (a count with a percentage), `Perlu Semakan`; four class cards, each with a count and a line: `Verified` "Disahkan penuh terhadap sumber.", `AI Verified` "Disahkan oleh semakan AI.", `Pending Mapping` "Menunggu pemetaan kurikulum.", `Belum Diklasifikasi` "Tiada status pematuhan lagi."; chart `Taburan Kualiti` with legend `Disahkan` and `Perlu Semakan` and a centre percentage; table `Mengikut Subjek` with columns `Subjek`, `Soalan`, `Disahkan`, `% Disahkan` (rows sorted by % ascending).
- V2 defect: `Perlu Semakan` (902,797) is larger than `Jumlah Soalan` (451,518) and the chart centre reads "199.9%"; V3 computes figures that cannot exceed the total (register row Q-21).
- Buttons and empty/error states: not observed — follow FR-ADM-Q21.1.
- Reference: V1 `Kualiti Soalan`; V3 title "Dashboard Kualiti Soalan", subtitle "Analisa kualiti keseluruhan bank soalan".
- FR-ADM-Q21.1 Reachable as tab `Kualiti` of Senarai Soalan; `POST /api/question-quality/audit` unchanged. AC-ADM-Q21.1 Given the tab, then it shows the same dashboard as the old route. Gap: separate menu item BS-04. Deviation: none.

#### R1-ADM-Q-22 `Laporan Soalan` (tab) | `/admin/question-reports` | P0 (feeds Murid 54, which is P0) | GH built / UAT built (V2 production 0 rows)
- **Action: Fix** | gap and differences: 4.V row Q-22.

**Screen specification (from V2).**
- Route and title: `/admin/question-reports`, "Laporan Soalan - Admin Panel"; tabs `Senarai` / `Kualiti` / `Laporan` above.
- Regions in order: heading "Laporan Soalan" with "Soalan yang dilaporkan oleh pelajar dari kuiz, latihan & Papan Bijak"; status chips "Menunggu ({n})", "Selesai ({n})", "Semua ({n})"; the report list.
- Empty state: "Tiada laporan soalan untuk status ini." (all chips 0 in the capture).
- Row layout and row actions are not observed in V2 (no rows) — follow FR-ADM-Q22.1..Q22.3 and the pupil statuses in the Reference above.
- Reference: PAR A15; D98; AC-R1-18.3/18.4; pupil statuses Menunggu / Disemak / Diperbaiki / Ditolak (and "Dikeluarkan" after Arkib).
- FR-ADM-Q22.1 Each row shows question, paper, reporter role label, status; admin sets status and a note (`PATCH /api/question-reports/:id`).
- FR-ADM-Q22.2 From the row the admin opens the question and archives it (`Arkib`); the answer warns which Terbit papers are affected; archived question leaves Databank/Kuiz at once; a Terbit paper holding it refuses new sittings with "Kertas ini sedang dikemas kini dan tidak boleh dicuba buat masa ini.".
- FR-ADM-Q22.3 A report never auto-deactivates; a re-report never undoes a dismiss (D98).
- AC-ADM-Q22.1 (E2E) Given a T5 pupil reports question X and the admin archives X from the row, then X no longer appears in the pupil's Databank draws and the pupil's `/laporan-soalan` shows the new status.
- Gap: row action unverified (ADMIN-PUSAT row 54). Deviation: none.

#### R1-ADM-Q-23 `Soalan Berstruktur` and the `Subjektif` lane | `/admin/structured-questions`, `/admin/spm/subjektif` | P0 (feeds Murid 13 Subjektif; fully working at release, D104) | GH route, no menu / UAT unverified
- **Action: Complete** | gap and differences: 4.V row Q-23.

**Screen specification (from V2).**
- List route and title: `/admin/structured-questions`, "Soalan Berstruktur - Admin Panel".
- Regions in order: heading "Soalan Berstruktur" with "Semua soalan berstruktur SPM dalam sistem"; tiles `Jumlah Soalan` and `Diluluskan`; card `Agihan Mengikut Subjek` (subject: count, e.g. "Bahasa Inggeris: 773", "Perniagaan: 763", ...); card `Agihan Aras KBAT` ("HOTS 4", "HOTS 5", "HOTS 6", "LOTS 1", "LOTS 2", "MOTS 3" with counts); filter bar; table; pager.
- Filters: `Subjek` (`Semua Subjek` + subjects); `Tahap` (`Semua Tahap`, Darjah 1 ... Tingkatan 5; V3: Tingkatan 1 to 5 only); an aras select (options including `Menganalisis`, `Menilai`, `Mencipta`); `Cari`; `Pemarkahan:` filter links `Semua`, `Ada rubrik ({n})`, `Skema sahaja ({n})`, `Tiada skema — disembunyikan ({n})`.
- Table columns: `#`, `Stimulus` (first ~90 characters with "..."), `Subjek`, `Tahap`, `Aras KBAT` (e.g. "HOTS 4"), `Sub-Soalan` (count), `Markah`, `Pemarkahan` ("Tiada — disembunyikan" when no rubric), `Status` ("Diluluskan"), and a row link.
- Detail route and title: `/admin/structured-questions/{id}`, "Rubrik Soalan Berstruktur - Admin Panel"; link `← Senarai Soalan Berstruktur`; heading "Skema & Rubrik Pemarkahan"; meta "Soalan #{id} · {Subjek} · Tingkatan 4 · 6 markah"; explanation "Rubrik di sini yang menentukan pemarkahan automatik. Setiap poin ialah satu isi yang diberi markah (contoh: A1 whatsapp [1m]). Jumlah markah bahagian tetap menjadi had — rubrik 5 poin pada bahagian 3 markah bermaksud “mana-mana 3”."; block `Stimulus` (the passage text); then each part "(a)", "(i)" ... with its prompt, "[1m]", the label "Skema (ayat penuh)", and a table `Poin Rubrik` of five rows (codes A1 to A5, each a text input plus a mark "m"); hint "Kosongkan baris untuk membuang poin itu."; button `Simpan Skema & Rubrik`.
- The Panel lane `/spm/subjektif` and its editor (`.../sunting`) use the lane frame of R1-ADM-Q-02; the editor was not read in detail — Not observed in V2 — follow FR-ADM-Q23.1..Q23.5.
- V3: the free-text rubric rows are replaced by the K/N/P scheme editor in Studio (FR-ADM-Q23.2); the stimulus is a stimulus group (FR-ADM-Q23.4).
- Reference (DISC 2, PAR A13): list and detail; V1/V2 allow editing sub-questions and rubric points (legacy editor `structured-questions-edit.blade.php:48-75`: one text input per point + mark, never sets `code`).
- FR-ADM-Q23.1 Menu entry under Bank Lama; list and detail (exist).
- FR-ADM-Q23.2 Editing is done in Studio (migrated structured questions are canonical multi-part questions, exam schema D1 `structured`), with the scheme in the K/N/P format (D4) — not the V2 free-text point editor (oldsystem findings C). Detail page has `Sunting di Studio`.
- FR-ADM-Q23.3 The `Subjektif` lane (hub card "Soalan berstruktur dan esei.") lists structured and essay questions with `Perhatian` reasons "tiada skema — tidak disajikan" and "tiada kunci jawapan"; nothing hides the lane from pupils (no flag, D104).
- FR-ADM-Q23.4 Stimulus-group rule restated here (D90, D105): a structured or essay question that refers to a rajah, jadual or petikan belongs to a stimulus group; the stimulus is shown once above its questions in the editor, the preview and to the pupil; the pupil's Subjektif practice serves figure questions and whole groups, never a question without its stimulus nor a group split; the lane flags any structured question whose text names a Rajah/Jadual/Petikan but has no stimulus as `stimulus_missing` (4.G.7) and does not serve it until regrouped. There is no text-only restriction.
- FR-ADM-Q23.5 Entry and validation follow QE-03/QE-04 (Subjek, Tingkatan, Unit, SP, TP and aras per leaf, scheme K/N/P); a structured question cannot be approved with a leaf whose scheme is empty.
- AC-ADM-Q23.1 Given a structured question, then `Sunting di Studio` opens the wizard with parts and scheme.
- AC-ADM-Q23.2 (E2E) Given the admin approves a structured question with Rajah 2 shared by parts (a) and (b) of two questions, when the T5 pupil opens Subjektif practice, then the question is served with Rajah 2 shown once and the pupil can reveal the scheme and self-mark.
- Gap: BE read-only (`structured.controller.ts:15,24`); Evidence E-08 whether migrated rows are already canonical. Deviation: FD-Q23.

#### R1-ADM-Q-24 `Sunting Soalan` (Quick Edit) | `/admin/spm/soalan/:qid/sunting` | P1 | GH built / UAT built
- **Action: Keep** | gap: 4.V row Q-24.

**Screen specification (from V2).**
- Route and title: `/spm/soalan/{id}/sunting?lane=databank`, "Soalan objektif #{id} · PrestasiPlus Panel".
- Regions in order: link `Kembali ke Databank`; heading "Soalan objektif #{id}"; `Teks soalan` (textarea); `Rajah / Gambar` with a button `Buang gambar`; `Pilihan jawapan — pilih yang betul` (rows A, B, C, D, each a text input and a radio); `Status` (radios `Diluluskan (dipaparkan kepada pelajar)`, `Draf`, `Menunggu`, `Ditolak`); section `Tetapan lanjutan` (`Mata pelajaran` e.g. "Sains", `Tingkatan` e.g. "Tingkatan 4", `Tahap kesukaran` e.g. "2", `Sumber` e.g. "rip:databank"); buttons `Simpan` and `Batal`.
- Preview `/spm/soalan/{id}/pratonton`: the question as the pupil sees it — Not observed in detail; follow the Studio preview of R1-ADM-Q-04.
- Validation texts (McqGate) are in the Reference above (V2 code); the capture shows none.
- Reference (DISC 3.3): fields "Teks soalan", "Pilihan jawapan — pilih yang betul", status radios "Diluluskan (dipaparkan kepada pelajar)", "Draf", "Menunggu", "Ditolak", "Tetapan lanjutan", `Buka editor penuh`, `Pratonton pelajar`; McqGate "Soalan ini tidak boleh ditanda seperti sedia ada:" with "Teks soalan tidak boleh kosong.", "Soalan objektif memerlukan sekurang-kurangnya 2 pilihan jawapan.", "Pilihan {x} tidak boleh kosong.", "Tiada jawapan betul dipilih — soalan ini tidak boleh ditanda.", "{n} jawapan betul dipilih. Soalan objektif hanya boleh ada satu.".
- FR-ADM-Q24.1 Quick Edit stays for fast fixes of a single-leaf MCQ; a grouped member or multi-part question shows "Soalan ini di luar skop suntingan Panel — sunting di Studio penuh." and `Buka editor penuh`.
- FR-ADM-Q24.2 It cannot be used to create or to detach from a group.
- AC-ADM-Q24.1 Given a MCQ with 0 correct options, then saving shows "Tiada jawapan betul dipilih — soalan ini tidak boleh ditanda.".
- Gap: reached via the third "Bank Soalan" list (KS-02); keep route, hide list. Deviation: status labels follow V3.

### 4.B Curriculum and DSKP

#### R1-ADM-C-01 `Kurikulum` (Bab, Topik, SP) | `/admin/curriculum` and chapter/topic create/edit routes | P0 | GH built / UAT 686 T4/T5 chapters, DSKP nodes unverified
- **Action: Complete** | gap and differences: 4.V row C-01.

**Screen specification (from V2).**
- Route and title: `/admin/curriculum`, "Kurikulum - Admin Panel".
- Regions: a filter card `Tapis Kurikulum` with select `Subjek` (first option "-- Pilih Subjek --", then the subjects), a second select for the level (Tingkatan 1 to Tingkatan 5 observed at the end of its list; V2 also lists Darjah 1 to 6, hidden in V3, D96), and button `Tapis`.
- Initial state (empty): "Sila pilih subjek dan tahap pendidikan" with "Gunakan penapis di atas".
- The populated tree (Bab, Topik, Subtopik and create/edit forms) was not captured — Not observed in V2 — follow FR-ADM-C01.1..C01.7 and the Reference above.
- Reference (PAR C01; V1 M03): Filament Chapters; Topik, Subtopik per subject and tahap; feeds Soalan by Chapter, Peta Belajar, Heatmap Topik Lemah, Analisa Item.
- FR-ADM-C01.1 Browse by Subjek and Tingkatan (1-5) -> Bab -> Topik -> Subtopik; create, edit, delete (API `/api/admin/curriculum/chapters|topics|subtopics`, `admin.controller.ts:107-170`).
- FR-ADM-C01.2 Each Bab row shows `Bilangan soalan` (approved questions linked, `chapterQuestionCounts`, `overview.repository.ts:140`) so the admin sees which chapters are empty.
- FR-ADM-C01.3 A tab `DSKP` lists the loaded Bidang / SK / SP with TP descriptors read-only, per subject and Tingkatan (the pick-list of the Studio Tag step); counts per subject/level are shown (AC-R1-12.3).
- FR-ADM-C01.4 Deleting a Bab that has linked questions is refused with the count [PROPOSED "Bab ini masih mempunyai {n} soalan."].
- FR-ADM-C01.5 Darjah (D1-D6) nodes are not shown or creatable (D96).
- FR-ADM-C01.6 Tingkatan 1-3 chapters, topics and subtopics exist for every subject that has a T1-T3 syllabus, so Latih Tubi, Soalan by Chapter, Topik and Peta Belajar serve T1-T3 pupils (D101); the admin can create them here when the migrated data has none (task U-OP-15).
- FR-ADM-C01.7 The tab `DSKP` and the Bab tree both feed the school-admin DSKP Heatmap (Admin Sekolah 47): the heatmap rows are DSKP units/SP (C-04) and its cells are filled from pupil answers on questions tagged to them (Q-04).
- AC-ADM-C01.1 Given T5 Sains chapters, when the admin opens Kurikulum, then each Bab shows its question count and an empty Bab is flagged.
- AC-ADM-C01.2 (E2E) Given the admin creates Bab "X" for Sains T5 and links an approved question to it (C-05), when the T5 pupil opens Soalan by Chapter, then Bab "X" lists 1 soalan and Peta Belajar/Heatmap read the same chapter.
- Data: M03 owns curriculum (D12); question link is `question_versions.chapter_id`. Gap: UAT zero links (D89), `ChapterIndexPage.vue:55-60` empty state. Deviation: tab DSKP and counts added (feeds the empty state; not in V2).
- OQ: relation between M03 `chapters` and DSKP `unit` — Evidence E-03.

#### R1-ADM-C-02 `Subjek` | `/admin/subjects` (+ `/create`, `/:id/edit`) | P0 (every picker of Murid 9, 13, 16 reads it) | GH built / UAT built
- **Action: Keep** | gap: 4.V row C-02.

**Screen specification (from V2).**
- List route and title: `/admin/subjects`, "Subjek - Admin Panel". Regions: heading `Senarai Subjek`, "Jumlah: 31 subjek", button `Tambah`, table.
- Columns: `#`, `Ikon`, `Nama (BM)` (with the levels the subject is linked to listed underneath), `Nama (EN)`, `Kod`, `Warna` (hex colour), `Teras?` ("Teras"), `Soalan` ("31,233 soalan"), `Aktif?` ("Aktif"), plus an actions cell (edit, toggle).
- Create route and title: `/admin/subjects/create`, "Tambah Subjek - Admin Panel". Fields: `Nama (BM) *`, `Nama (EN) *`, `Kod *`, `Ikon (Font Awesome)`, `Warna`, `Susunan`, `Subjek Teras` (checkbox), `Aktif` (checkbox); buttons `Simpan Subjek`, `Batal`. Validation copy not observed. The edit form is the same fields (`/admin/subjects/{id}/edit`, not captured).
- Reference: V1/V2 subject CRUD with active flag (PAR C02).
- FR-ADM-C02.1 List, create, edit, activate/deactivate (`PATCH :id/active`, `admin.controller.ts:88`). FR-ADM-C02.2 Each subject shows the Tingkatan it is linked to and whether it is in the SPM catalogue (decides `spmBound`). FR-ADM-C02.3 Deactivating a subject hides it from every pupil picker (existing behaviour, verify).
- AC-ADM-C02.1 Given a subject deactivated, then it disappears from Studio pickers and the pupil's subject lists, and its data stays.
- Gap: none functional. Deviation: none.

#### R1-ADM-C-03 `Tahap Pendidikan` | `/admin/education-levels` (+ create/edit) | P0 | GH built / UAT 11 levels active
- **Action: Fix** | gap and differences: 4.V row C-03.

**Screen specification (from V2).**
- Route and title: `/admin/education-levels`, "Tahap Pendidikan - Admin Panel".
- Regions: heading `Senarai Tahap Pendidikan`, "Jumlah: 11 tahap", table.
- Columns: `#`, `Nama (BM)` (e.g. "Darjah 1"), `Nama (EN)` ("Year 1"), `Kod` ("D1"), `Peringkat` ("Rendah"), `Kurikulum` ("KSSR"), `Soalan` ("13,140 soalan"), `Subjek` ("19 subjek"), `Aktif?` ("Aktif"). V2 lists Darjah 1 to 6 first, then Tingkatan 1 to 5; V3 shows Tingkatan first and Darjah inactive (D96).
- Create/edit forms, toggle confirm and empty/error copy: not observed in V2 — follow FR-ADM-C03.1..C03.3.
- Reference: V1/V2 level CRUD; D72/D96: Darjah D1-D6 inactive, hidden from every picker, list, chart and filter; Tingkatan 1-5 stay.
- FR-ADM-C03.1 Each level has an active switch (`PATCH :id/active`, `admin.controller.ts:47`); the list shows the 5 Tingkatan first and Darjah rows labelled inactive when deactivated (rows and FKs stay; hard delete is a later migration).
- FR-ADM-C03.2 The list follows V2: heading "Senarai Tahap Pendidikan", "Jumlah: {n} tahap", columns `#`, `Nama (BM)`, `Nama (EN)`, `Kod`, `Peringkat`, `Kurikulum`, `Soalan` ("{n} soalan"), `Subjek` ("{n} subjek"), `Aktif?`; the counts come from the question list, not stored figures.
- FR-ADM-C03.3 With Darjah inactive: public statistics show 5 levels, Studio filters offer Tingkatan 1-5, registration, import forms and Kontrak offer Tingkatan only.
- AC-ADM-C03.1 (E2E) Given the admin deactivates D1-D6 on UAT, when the public statistics and the T5 pupil's level picker load, then 5 levels appear (UAT shows 11 today).
- Gap: UAT data (U-OP-03). Deviation: none (D72).

#### R1-ADM-C-04 DSKP load and verification, Tingkatan 1-5 | operator task + report in C-01 tab `DSKP` | P0 | GH loader exists (T4-T5) / UAT unverified
- **Action: Build** (T1-T3 extracts and the C-01 `DSKP` tab; the loader itself is Keep) | gap: 4.V row C-04.

**Screen specification (from V2).** Not observed in V2 — V2 has no DSKP tree or loader screen; follow FR-ADM-C04.1..C04.4. The V2 Studio Tag step lists curriculum learning-standard sentences in its `Bab` select (R1-ADM-Q-04), which is the closest V2 behaviour.
- Reference: R1-12 (AC-R1-12.1 to 12.6), architecture 13.8a, `docs/ops/dskp-loader.md`, extracts `docs/reference/dskp/` (T4-T5 today).
- FR-ADM-C04.1 The loader creates Bidang / SK / SP with TP descriptors, idempotently, for Tingkatan 1-5 (D101); Darjah rows are ignored and reported; a subject loads fully or not at all.
- FR-ADM-C04.2 After a run, `curriculum_nodes` > 0 for every in-scope subject and every level that has an extract on UAT (evidence in the QA table); the loader report lists the subjects/levels still without an extract.
- FR-ADM-C04.3 T1-T3 extraction task (D101): the repo has T4-T5 extracts only. For each subject that has a Tingkatan 1-3 syllabus, extract the official KSSM DSKP into the same JSON format as `docs/reference/dskp/*.json` (units with `level` T1/T2/T3, SK, SP, TP 1-6, `edition` per level, printed codes kept), audit it as the T4-T5 extracts were (`docs/qa/audit/dskp-extracts-audit.md`), copy it to `apps/api/src/modules/curriculum/dskp/data/` and `docs/reference/dskp/` (the checksum test compares them), rebuild and run the loader (`--data-dir` allows a dry run first). Source PDFs needed (none of them is in `D:\prestasiplus-dskp`, which holds Form 4 and Form 5 or T4-T5 PDFs only): the official KPM DSKP KSSM Tingkatan 1, 2 and 3 documents for Matematik, Sains, Bahasa Melayu, Bahasa Inggeris, Sejarah, Pendidikan Islam, Pendidikan Moral and Pendidikan Seni Visual (the subjects of the 13 extracts that continue below Tingkatan 4; whether Fizik, Matematik Tambahan, Tasawwur Islam, Landskap dan Nurseri and Katering dan Penyajian have T1-T3 content is not established, E-16). The missing PDFs are a blocking evidence item (E-16).
- FR-ADM-C04.4 Until a T1-T3 extract is loaded, T1-T3 questions are approved without DSKP tags (R1-U1; the gate binds only SPM-bound T4/T5, ADR-0031), stay out of blueprint papers, and their Bab mapping (C-05) and chapters (C-01.6) still exist so Latih Tubi and Soalan by Chapter serve T1-T3 pupils (D101).
- AC-ADM-C04.1 Given a load, then the report gives counts per subject and level and each rejected row with a plain reason; running again creates no duplicates.
- AC-ADM-C04.2 Given a T2 extract for Matematik has been loaded, when the admin opens the Studio Tag step for Matematik T2, then Unit and SP lists show the T2 nodes; before it is loaded the page says [PROPOSED] "DSKP belum dimuatkan untuk subjek ini." and a T2 question can still be approved without tags.
- Gap: UAT state unknown (Evidence E-03). Deviation: none.

#### R1-ADM-C-05 Bab mapping for questions (`Tetapkan Bab`) | Studio edit field `Bab` + bulk action in Q-03 | P0 | GH single field built (`ChapterSelect.vue`) / UAT 0 of 339,112 linked
- **Action: Build** (bulk action; the single field is Keep) | gap: 4.V row C-05.

**Screen specification (from V2).** Not observed in V2 — V2 has no Bab link for questions and no bulk action; follow FR-ADM-C05.1..C05.5. V2 shows only the `Bab` select in Studio step 4 (R1-ADM-Q-04).
- Reference: none in V2 (0 of 408,197 approved MCQs have a chapter); D89 "Admin pilih bab sendiri"; D80 legacy untagged MCQs stay servable in Latih Tubi, appear in Bab only after the admin sets the Bab.
- FR-ADM-C05.1 Single: the `Bab` select in the Tag step (Q-04), chapters of the question's Subjek and Tingkatan.
- FR-ADM-C05.2 Bulk: in Studio and Senarai Soalan the admin filters (Subjek, Tingkatan, search text, DSKP) then chooses `Tetapkan Bab` for the selected rows or all rows of the filter; a dry-run line shows "{n} soalan akan dipautkan ke Bab {nama}" [PROPOSED]; the action refuses rows whose Subjek/Tingkatan do not match the Bab; it records an audit entry with count and actor; cap per run as `FILTER_ACTION_CAP`. The call is `POST /api/admin/curriculum/questions/bulk-chapter` (D-A5); the work-list `Soalan tanpa Bab` of FR-ADM-Q03.7 uses it.
- FR-ADM-C05.3 Setting a Bab changes no status and no servability other than adding the question to Soalan by Chapter; it does not set unit/SP/TP (not derived from DSKP, D89).
- FR-ADM-C05.4 Progress: Kurikulum shows per Bab the count; Studio filter `Bab` = "Belum dipautkan" lists the rest.
- FR-ADM-C05.5 No automatic mapping by keyword is run (OQ-03).
- Data: new bulk action `set_chapter` on `POST /api/questions/bulk-action(/filter)` (contract today carries no chapter action; `packages/contract/src/questions` has no bulk chapter field); writes a new version or an in-place link per ADR (architect decides; legacy approved rows must not be re-gated, D80 DEC-2).
- AC-ADM-C05.1 Given 50 legacy Sains T5 MCQs matching a filter, when the admin bulk-sets Bab "X", then Kurikulum shows 50 for Bab "X" and their status and Latih Tubi servability are unchanged.
- AC-ADM-C05.2 Given a Bab of Fizik T4 and a Sains T5 row selected, then the row is skipped and listed with the reason.
- AC-ADM-C05.3 (E2E) Given 50 questions set to Bab "X", when the T5 pupil opens Soalan by Chapter Sains, then Bab "X" shows 50 soalan and `Mula` starts a practice from them.
- Gap: no bulk path; at one question per click, 339,112 rows is impractical. Deviation: FD-C05 bulk action is new (V2 has none; D89 and the 0-of-408,197 fact make it a D9 fix).

### 4.C Content seen by pupils in 1.0 and settings

#### R1-ADM-N-01 `Video` | `/admin/videos` (new Pentadbiran list; user-shell `/video/tambah`, `/video/:id/edit` exist) | P0 (feeds Murid/Guru/AS 7; gap analysis rates it Tinggi) | GH BE ready, no admin list / UAT same
- **Action: Build** (list over the existing API) | gap: 4.V row N-01.

**Screen specification (from V2).** Not observed in V2 — V2 Video admin is a Filament page that was not captured (E-22); follow FR-ADM-N01.1..N01.2.
- Reference: V2 Filament `/admin-filament/videos` (no Blade page); admin or uploader adds, edits, deletes lessons per subject and Bab (PAR C05).
- FR-ADM-N01.1 List with filters Subjek, Tingkatan, Bab, status; actions add, edit, delete, hide (API `GET/POST/PUT/DELETE /api/videos`, `/videos/form-context`).
- FR-ADM-N01.2 Moderation: admin can hide any video; a hidden video disappears from Murid/Guru/AS Video.
- AC-ADM-N01.1 (E2E) Given the admin adds a video for Sains T5, the T5 pupil sees it in Video under the same subject.
- Gap: KK-08 not built. Deviation: V3 Blade list instead of Filament (D79 absorb).

#### R1-ADM-N-02 `Artikel` | `/admin/articles` | P1 (feeds the 1.0 Dashboard; ships with the first delivery, D106) | built both.
- **Action: Keep** | gap: 4.V row N-02.

**Screen specification (from V2).**
- Route and title: `/admin/articles`, "Artikel - Admin Panel".
- Regions: tiles `Jumlah Artikel` and `Diterbitkan` (counts); filter bar: select `Semua Kategori` (Tips Belajar, Berita, Motivasi, Panduan Ibu Bapa, Panduan Guru, Kejayaan, Umum), select `Semua Status` (Diterbitkan, Draf), text search, buttons `Cari`, `Reset`; the line "{n} artikel dijumpai"; table.
- Columns: `Tajuk` (with "Oleh: Admin PRESTASI+" underneath), `Kategori`, `Tahap`, `Status`, `Views`, `Tarikh`, and an actions cell.
- Create/edit form fields and the delete confirm are listed in R1-ADM-P2-18 (Reference); empty copy "Tiada artikel dijumpai." there.
- FR-ADM-N02.1 CRUD with publish state; the 1.0 Dashboard "Artikel Untuk Kamu" shows published articles. AC-ADM-N02.1 (E2E) Given a published article, the pupil Dashboard lists it. Gap: none. Also holds the Panduan text if Panduan reads articles (Evidence E-10).
#### R1-ADM-N-03 `Banner` | `/admin/banners` | P1 (feeds the 1.0 Dashboard, D106) | built both.
- **Action: Fix** | gap and differences: 4.V row N-03.

**Screen specification (from V2).**
- Route and title: `/admin/banners`, "Banner - Admin Panel".
- Regions: heading `Senarai Banner`, "Jumlah: 10 banner · 10 aktif", a create button, table.
- Columns: `#`, `Tajuk` (cut with "..."), `Jenis` (e.g. "HERO"), `Sasaran` (e.g. "ALL"), `Susunan`, `Mula` and `Tamat` (dd/mm/yyyy), `Aktif?` ("Aktif"), actions.
- Form fields (`Tajuk Banner *`, `Penerangan`, `URL Gambar`, `Jenis Banner *`, `Jenis Pautan`, `Sasaran Penonton *`, `Susunan Paparan`, `Tarikh Mula`, `Tarikh Tamat`, `Banner Aktif`, `Simpan Banner`): see R1-ADM-P2-18 Reference.
- FR-ADM-N03.1 CRUD with active dates; shown on the 1.0 Dashboard. AC-ADM-N03.1 (E2E) Given an active banner, the pupil Dashboard shows it. Gap: none.
#### R1-ADM-N-04 `Nota` | `/admin/notes` | P2 | built both.
- **Action: Fix** | gap and differences: 4.V row N-04.

**Screen specification (from V2).**
- Route and title: `/admin/notes`, "Nota - Admin Panel".
- Regions: filter bar: select `Semua Subjek` (Matematik, Sains, Bahasa Melayu, Bahasa Inggeris, Sejarah), select `Semua Jenis` (Ringkasan, Lengkap, Formula, Tips & Tricks), buttons `Cari`, `Reset`; heading `Senarai Nota` with "Jumlah: {n} nota"; table.
- Columns: `Tajuk` (with "Oleh: Admin PRESTASI+"), `Subjek`, `Jenis` (e.g. "lengkap"), `Tahap` (e.g. "Darjah 3"; V3 shows Tingkatan only), `Status`, `Statistik`, actions.
- Form and delete confirm: see R1-ADM-P2-18 Reference.
- FR-ADM-N04.1 CRUD per subject/Tingkatan for Buku Nota (Tingkatan only, D54-SEC). AC-ADM-N04.1 Given a note for T5 Sains, the T5 pupil's Buku Nota lists it. Gap: none. Audio KBAT (`/admin/audio-kbat`) is not required by a 1.0 module; stays built, no work (section 6).

#### R1-ADM-N-05 `Tetapan Permainan` | `/admin/permainan` | P0 (feeds Murid 21, rated Tinggi) | GH BE + client exist, no page / UAT same
- **Action: Build** (page over the existing API) | gap and differences: 4.V row N-05.

**Screen specification (from V2).**
- Route and title: `/admin/permainan`, "🎮 Tetapan Permainan - Admin Panel".
- Regions in order: four tiles `Jumlah Bilik`, `Sedang Aktif`, `Selesai`, `Pemain Unik`; card `Papan Bijak` ("Tetapan papan permainan ular & tangga (50 petak)"); card `Senarai Permainan` ("Permainan yang tersedia dalam sistem").
- `Papan Bijak` card: field `Bilangan Petak Soalan` (number, unit "petak"; hint "Maks 38 petak (48 available - 10 petak khas). Set 0 = tiada soalan."); a live breakdown `Pecahan Papan (50 petak)`: "Petak soalan (quiz):" 35, "Tangga (3) + Ular (3):" 6, "Bonus (2) + Perangkap (2):" 4, "Petak biasa (jalan kosong):" 3, "Mula + Tamat:" 2, with the summary chips "35 soalan", "10 khas", "3 biasa"; a save button (label not in the capture; follow FR-ADM-N05.1).
- `Senarai Permainan` rows (name, status word, description, link `Lihat`): `Papan Bijak` "Aktif" "Ular & tangga dengan soalan kuiz. Multiplayer 2-4 pemain."; `Kad Memori` "Aktif" "Padankan soalan dengan jawapan. 6 pasangan (12 kad)."; `Battle Arena` "Aktif" "1v1 kuiz battle masa nyata. Pilih lawan & subjek." `Lihat` opens the pupil game page (in V2 these links land on the admin Dashboard, so V3 gives them no pupil route; the enable/disable control of FR-ADM-N05.2 replaces them).
- Empty state: "Tiada permainan didaftarkan lagi." (from V2 code). Error copy not observed.
- Reference (V2 `admin/permainan.blade.php`): title "🎮 Tetapan Permainan", subtitle "Urus konfigurasi Papan Bijak, Kad Memori & permainan lain"; tiles `Jumlah Bilik`, `Sedang Aktif`, `Selesai`, `Pemain Unik`; section `Papan Bijak` "Tetapan papan permainan ular & tangga (50 petak)" with "Petak soalan (quiz):", "Tangga (3) + Ular (3):", "Bonus (2) + Perangkap (2):", "Petak biasa (jalan kosong):", "Mula + Tamat:"; `Senarai Permainan` "Permainan yang tersedia dalam sistem"; empty "Tiada permainan didaftarkan lagi."
- FR-ADM-N05.1 Page shows the tiles, Papan Bijak settings and the game list using `GET /api/admin/games` and `PUT /api/admin/games/settings` (exist; `games/rooms/admin/admin-games.controller.ts`).
- FR-ADM-N05.2 Each game can be enabled/disabled; a disabled game is absent from the pupil Zon Permainan.
- FR-ADM-N05.3 The game question pool rule (D85 U6: games exclude image or stimulus questions, with the reason shown to the admin) is unchanged; D105 lifts the text-only restriction for Latih Tubi, Databank and Soalan by Chapter only. Whether games should also serve figure questions is not decided (OQ-G1).
- AC-ADM-N05.1 (E2E) Given the admin disables one game, then the T5 pupil's Zon Permainan no longer lists it.
- Gap: PG-11 hidden, no page. Deviation: none.

#### R1-ADM-N-06 `Kawalan Ciri` (minimum) | `/admin/feature-toggles` | P1 | GH none / UAT none
- **Action: Build** | gap and differences: 4.V row N-06.

**Screen specification (from V2).**
- Route and title: `/admin/feature-toggles`, "Kawalan Ciri - Admin Panel".
- Regions: the notice "Semua ciri HIDUP secara lalai — item hanya tersembunyi apabila anda mematikannya."; group `Pelajar`; group `Guru`. Each row = module label, its state word ("Aktif" or "Off") and a toggle.
- Group `Pelajar` rows in order: Zona Permainan (Off in the capture), Misi Harian, Kombo, Leaderboard, Remedial, Cita-Cita, Universiti, Biasiswa, Target SPM, Analisa Item, Prestasi, Psikometrik, Profil Cerah, Kemajuan Saya, Sejarah Latihan, Video Pembelajaran, Perutusan, Panduan Pengguna, Tiket Bantuan (19 rows).
- Group `Guru` rows: Headcount, Misi Harian, Kelas, Prestasi, Monitoring, Analisis Item, Gamifikasi, Broadcast, Databank, Sumbang Soalan (10 rows).
- Flashes (V2 code): `Ciri "{label}" telah DIAKTIFKAN.` / `Ciri "{label}" telah DINYAHAKTIFKAN.` Empty "Tiada ciri didaftarkan."
- V2 has no `latih-tubi` or `kertas-subjektif` row; V3 adds `Latih Tubi` and no Kertas Subjektif switch (FR-ADM-N06.1).
- Reference (V2 `admin/feature-toggles.blade.php`): title "Kawalan Ciri", subtitle "Hidupkan / matikan ciri untuk Pelajar & Guru"; empty "Tiada ciri didaftarkan."; flashes `Ciri "{label}" telah DIAKTIFKAN.` / `Ciri "{label}" telah DINYAHAKTIFKAN.`; V2 labels (`config/features.php`): `Zona Permainan` (`permainan`), `Video Pembelajaran`, `Analisa Item`, `Misi Harian`, `Leaderboard`, `Remedial`, etc. V2 sends a blocked pupil home with the flash "Ciri ini tidak tersedia buat masa ini."; V3 does not: a switched-off module is removed from the menu and its URL returns the standard 404 page (D108(6)), never a "belum tersedia" page and never a 403 message.
- FR-ADM-N06.1 The 1.0 release needs two switches (D83 D-8, D104): `Zona Permainan` (`permainan`) and `Latih Tubi` (`latih-tubi`). There is no switch for Kertas Subjektif or the Subjektif lane (D104). The other V2 flags are added by P2-19.
- FR-ADM-N06.2 Defaults on UAT: `permainan` ON, `latih-tubi` ON (D80 (2), user-added 1.0).
- FR-ADM-N06.3 A switch write is Admin Pusat only, audited, and effective on the pupil's next request without redeploy.
- FR-ADM-N06.4 A flag with no row is ON (fail-open, as V2 `FeatureFlag::enabled`).
- AC-ADM-N06.1 (E2E) Given `latih-tubi` is switched OFF, when the T5 pupil opens the Latih Tubi URL, then the standard 404 page shows and the menu has no Latih Tubi item; switched ON, Latih Tubi works.
- Data: new flag table + `GET/POST /api/admin/feature-toggles` (S8.1 not built); in V3 visibility today is build-time (`prototype-scope`). Deviation: FD-N06 two switches here (V2 about 25, P2-19) and 404 instead of V2's redirect flash. OQ-06.

#### R1-ADM-N-07 `Tetapan` (support contact) | `/admin/settings` | P1 (feeds A3 Panduan, 1.0; and the tickets of P2-20) | GH none / UAT `/api/config/support` returns 404
- **Action: Build** | gap and differences: 4.V row N-07. V2 differs: no support-contact field exists in V2 Tetapan; this section is a V3 addition, FD-N07.

**Screen specification (from V2).**
- Route and title: `/admin/settings`, "Tetapan - Admin Panel". One long form with sections in order: `Logo Laman Web` ("Logo semasa: file"); `Had Percubaan & Soalan` (fields `Soalan Biasa (Trial)`, `PKSK (Trial)`, `Had Soalan/Bulan (Biasa)`, `Had Soalan/Bulan (Sekolah Basic)`, `Had Subjek Pilihan`); `Harga Pakej` (`Biasa — Sekali (Lifetime)`, `Biasa — Lifetime`, `PKSK — Bulanan`, `PKSK — Sekali`, `Personal — Bulanan`, `Personal — Sesi Persekolahan`); `Payment Gateway` ("Gateway aktif: toyyibpay"; blocks `ToyyibPay` and `BizAppay`, each `API Key` and `Category Code`; select `Gateway Aktif` with ToyyibPay / BizAppay); `Target SPM (Override)` (one number per subject code: BM, BI, MATH, SCI, SEJ, PI, PM, ADDMATH, PHY, CHEM, BIO, GEO, PSV, MUZ, PJK, RBT, SK, BA, BC ...); `Harga Pakej Mengikut Tahap`; button `Simpan Tetapan`.
- V3 builds none of these sections except the V3 addition `Hubungi Sokongan` (FR-ADM-N07.1); billing, payment and logo sections are deferred (section 6). No support-contact field exists in V2.
- Reference: V2 sidebar item `Tetapan` `/admin/settings` (group Sistem), observed in V2: sections `Logo Laman Web`, `Had Percubaan & Soalan`, `Harga Pakej`, `Payment Gateway`, `Gateway Aktif`, `Target SPM (Override)`, `Harga Pakej Mengikut Tahap`, button `Simpan Tetapan`. V2 has no support-contact field (E-18 closed), so this screen keeps V2's title "Tetapan" and its save button `Simpan Tetapan`, and adds one new section as a V3 addition (FD-N07). Evidence in V3: Panduan reads `GET /api/config/support`, which is 404 on UAT (GAP row A3), so the Panduan "hubungi sokongan" data has no source.
- FR-ADM-N07.1 The page `Tetapan` has one section `Hubungi Sokongan` [PROPOSED heading] with the support contact values Panduan and the ticket screens show: support e-mail, support phone/WhatsApp, service hours text. Further V2 settings are not built (nothing is shown that does nothing).
- FR-ADM-N07.2 `GET /api/config/support` returns the saved values to pupils, teachers and school admins; with no value saved it returns an empty object and Panduan hides the contact block instead of erroring.
- FR-ADM-N07.3 Saving is Admin Pusat only and audited; validation: e-mail format, phone digits, max lengths [PROPOSED 120 characters].
- AC-ADM-N07.1 (E2E) Given the admin saves a support e-mail, when a T5 pupil opens Panduan, then the e-mail shows and `/api/config/support` answers 200.
- AC-ADM-N07.2 Given an invalid e-mail, when the admin saves, then the form shows a field message and nothing is saved.
- AC-ADM-N07.3 Given no value saved, when a pupil opens Panduan, then there is no error and no empty contact box.
- Data: new setting store and `GET/PUT /api/admin/settings/support` (required work); task U-OP-16 sets the value on UAT. Deviation: FD-N07 only the support section of V2 Tetapan.

### 4.D Users, schools, classes (as far as 1.0 needs)

#### R1-ADM-U-01 `Pengguna` list | `/admin/users` | P0 | GH built / UAT built
- **Action: Fix** | gap and differences: 4.V row U-01.

**Screen specification (from V2).**
- Route and title: `/admin/users`, "Senarai Pengguna - Admin Panel".
- Regions in order: approval banner "{n} akaun menunggu kelulusan — belum boleh log masuk." with link `Semak & luluskan`; role cards with counts (`Pelajar`, `Guru`, `Admin Sekolah`, `Pegawai PPD`, `Admin`; each a link that filters by role); filter bar; the line "{n} pengguna dijumpai"; header actions `Eksport CSV`, `Tambah Pelajar`, `Import Pengguna`; table; pager.
- Filters: select `Peranan` (`Semua Peranan`, Pelajar, Guru, Admin Sekolah, Pegawai PPD, Admin); a searchable school picker `Sekolah` (first option `Semua Sekolah`; loads in pages: "Muat {n} lagi", "Memuat...", empty "Tiada sekolah ditemui" with "Cuba kod sekolah atau nama daerah.", error "Gagal memuat senarai." with `Cuba lagi`, footer "Menunjuk {n} daripada {m} · ↑ ↓ pilih · Enter sahkan"); select `Status` (`Semua`, `Aktif`, `Tidak Aktif`); a text search; buttons `Cari`, `Tapis`.
- Table columns: `#`, `Nama`, `Emel`, `Telefon`, `Peranan`, `Sekolah`, `Aktif?`, `Tarikh`, and an actions cell (`Sunting`). Personal data in rows is shown masked in V3 lists.
- V2 differs from the V1 reference above: no `Ibu Bapa` or `Penaja` role card, the create button reads `Tambah Pelajar`, and `Eksport CSV` exists. The dialog texts of the Reference (toggle, delete, bulk delete) were not captured.
- Reference (V1 M02 S1, title "Pengurusan Pengguna - Admin Panel"): role cards (Pelajar, Guru, Ibu Bapa, Penaja, Admin Sekolah, Pegawai PPD, Admin) linking `?role=`; filters `Peranan` ("Semua Peranan"), `Sekolah` ("Semua Sekolah"), `Status` ("Semua", "Aktif", "Tidak Aktif"), `Cari` ("Nama atau emel..."), button `Cari`; buttons `Tambah`, `Import Pelajar`, `Import Pengguna`; columns `#`, `Nama`, `Emel`, `Telefon`, `Peranan`, `Sekolah`, `Aktif?`, `Tarikh`, `Tindakan` (`Edit`, `Pakej` on Admin Sekolah rows, `Login As`, trash); toggle confirm "Pasti untuk menukar status pengguna ini?"; delete modal "Padam Pengguna?" "Anda pasti mahu memadam pengguna ini?" `Batal` / `Ya, Padam`; bulk bar "{n} dipilih" -> "Padam Pengguna Terpilih?" "Tindakan ini tidak boleh dibatalkan." `Ya, Padam Semua`; empty "Tiada pengguna dijumpai" / "Cuba ubah kriteria carian anda"; 25 per page.
- FR-ADM-U01.1 All of the above; the actor's own account is excluded from select-all.
- FR-ADM-U01.2 `Login As` is not offered in 1.0 (BE 404 by design, ADMIN-PUSAT row 41); the V1 button is removed (D9: it would be a dead control).
- FR-ADM-U01.3 Role and school filters work together; the pupil Tingkatan is visible in the row detail or a column (T4/T5).
- AC-ADM-U01.1 Given `?role=student` and a school, then only pupils of that school list, 25 per page.
- AC-ADM-U01.2 (E2E) Given the admin creates a pupil (U-02) and the pupil logs in on UAT, then the pupil lands on the Murid portal.
- Gap: V1 table is 1881 px wide and hides actions below 1280 (M02 §2.1 defect D-1) -> responsive rules in 4.R. Deviation: FD-U01 no `Login As`.

#### R1-ADM-U-02 `Tambah Pengguna` | `/admin/users/create` | P0 | GH built / UAT built
- **Action: Fix** | gap and differences: 4.V row U-02. V2 differs from V1: title "Tambah Pelajar", pupil form only.

**Screen specification (from V2).**
- Route and title: `/admin/users/create`, "Tambah Pelajar - Admin Panel".
- Fields in order: `Nama penuh *` (hint "Nama pengguna dijana automatik daripada nama ini dan dipaparkan selepas cipta."); `Sekolah *` (searchable picker, same states as R1-ADM-U-01); `Kelas`; `E-mel (pilihan)` (hint "Pelajar log masuk dengan sekolah + nama pengguna, jadi e-mel tidak wajib."); `Kata laluan` (hint "Biarkan kosong untuk guna kata laluan lalai •••••••• (minimum 8 aksara).").
- Buttons: `Cipta Pelajar`, `Batal`. Validation copy not observed.
- V2 has no role selector on this page; the role-driven form of the Reference above (V1) is kept for the other roles (FR-ADM-U02.1).
- Reference (V1 M02 S2, title "Tambah Pengguna - Admin Panel", card "Borang Pendaftaran Pengguna" / "Isi maklumat untuk mendaftarkan pengguna baru"): `Peranan *` ("-- Pilih Peranan --": Pelajar, Guru, Ibu Bapa, Penaja, Admin Sekolah, Pegawai PPD, Pegawai JPN, Admin); standard roles: `Nama *` ("Nama penuh"), `Emel *` ("contoh@email.com"), `No. Telefon (Pilihan)` ("Cth: 0191234567"), pupil `Tahap Pendidikan` radio cards, `No. Kad Pengenalan (Pilihan)` ("Cth: 031215101234", hint "12 digit MyKad. Dilindungi PDPA."), `Sekolah` search ("Cari nama sekolah..."), parent `Pautkan Anak (Pelajar)` ("Cari nama atau emel pelajar..."), `Kata Laluan *` ("Minimum 6 aksara"), `Sahkan Kata Laluan *` ("Taip semula kata laluan"), `Aktifkan Akaun` ("Pengguna yang tidak aktif tidak boleh log masuk"); Admin Sekolah generator: `Cari Sekolah *` ("Taipkan nama sekolah atau kod sekolah (cth: JBA0001)..."), panel "Sekolah Dipilih", button `Janakan Akaun Admin Sekolah` (disabled without KPM code; warning "Sekolah ini tiada kod KPM. Sila isi maklumat secara manual di bawah."), "Maklumat Dijana": `Nama Pentadbir`, `ID Login (Emel)`, `Kata Laluan`, `Telefon (Pilihan)`, copy toast "Disalin!", `Daftar Pengguna` disabled until generated; PPD/JPN: `Negeri (JPN) *`, `PPD *`; footer `Batal`, `Daftar Pengguna`.
- FR-ADM-U02.1 The form is role-driven as V1; a field is shown only after a role is chosen.
- FR-ADM-U02.2 Pupil: `Tahap Pendidikan` offers Tingkatan 1-5 only ("Ting. 1" to "Ting. 5"); the "Sekolah Rendah / Darjah 1-6" group is not offered (D72/D96; V1 shows both).
- FR-ADM-U02.3 Admin Sekolah: generator as V1; the generated password is shown once and copyable; the account is bound to the school.
- FR-ADM-U02.4 Passwords: minimum 8 characters (V2 hint "minimum 8 aksara" is primary; V1's 6 is superseded, F-20, D-A17); the same minimum applies to user create, reset (U-03), bulk import and the school-admin reset; duplicate email is refused with a field message; IC is PDPA-masked in lists.
- FR-ADM-U02.5 Teacher: school required.
- AC-ADM-U02.1 Given role Pelajar, then Tahap Pendidikan shows 5 options (Tingkatan 1-5) and no Darjah.
- AC-ADM-U02.2 Given Admin Sekolah and a school with a code, when `Janakan Akaun Admin Sekolah`, then Nama Pentadbir, ID Login and Kata Laluan are filled and `Daftar Pengguna` enables.
- AC-ADM-U02.3 (E2E) Given the admin creates an Admin Sekolah for a UAT school, when that account logs in, then it reaches Command Center scoped to that school (unblocks the AS audit that GAP 8 lists as unverified).
- Gap: none found functionally; UAT AS account not yet created (U-OP-07). Deviation: FD-U02 Darjah not offered.

#### R1-ADM-U-03 `Edit Pengguna` (incl. reset kata laluan) | `/admin/users/:id/edit` | P0 | built both
- **Action: Keep** | gap: 4.V row U-03.

**Screen specification (from V2).**
- Route and title: `/admin/users/{id}/edit`, "Sunting Pelajar - Admin Panel".
- Card `Maklumat pelajar`, fields: `Nama penuh *`; `Nama pengguna *` (hint "Unik dalam sekolah ini. Huruf kecil, nombor, titik, sengkang dan garis bawah sahaja."); `Sekolah *` (picker); `Kelas`; `E-mel (pilihan)`; `Peranan *` (Pelajar, Guru, Admin Sekolah, Pegawai PPD; hint "Menukar peranan mengubah apa yang pengguna ini boleh lihat dan buat. Medan di atas akan berubah mengikut peranan baharu selepas simpan."); a status choice `Aktif (boleh log masuk)` / `Digantung`; buttons `Simpan`, `Kembali`.
- Card `Tetapkan semula kata laluan`: field `Kata laluan baharu` (hint "Biarkan kosong untuk tetapkan semula kepada ••••••••. Kata laluan baharu dipaparkan sekali selepas simpan."); button `Tetapkan Semula`.
- Parent-link card: Not observed in V2 (E-24) — follow R1-ADM-P2-16.
- Reference (V1 M02 S3, title "Edit Pengguna - Admin Panel"): header "Daftar: dd/mm/yyyy", "Kemaskini: ..."; fields `Nama *`, `Emel *`, `No. Telefon (Pilihan)`, `Peranan *`; pupil `Tahap Pendidikan`, `No. Kad Pengenalan (Pilihan)`, `Sekolah` (chip + search), `Pakej Langganan`; parent card "Anak yang Dipautkan"; `Tukar Kata Laluan` -> `Kata Laluan Baru` ("Minimum 6 aksara"), `Sahkan Kata Laluan Baru`, hint "Kosongkan jika tidak mahu tukar kata laluan. Kata laluan baru akan berkuat kuasa serta-merta."; `Status Aktif`; `Batal`, `Kemaskini`; card "Nota Keselamatan".
- FR-ADM-U03.1 Edit, reset password, activate/deactivate; changing the school or Tingkatan updates the pupil's class/level lists on the next load.
- FR-ADM-U03.2 Pupil Tingkatan edit offers Tingkatan 1-5 only.
- FR-ADM-U03.4 (F-17, D-A15) Only Admin Pusat (here) and Admin Sekolah (for their own school's pupils) can change a pupil's Tingkatan (grade), school or role; a pupil or teacher cannot change them through their own profile. Admin Pusat changes are written to the audit log.
- AC-ADM-U03.2 Given the admin changes a pupil's school, then the pupil leaves the old school's lists and rankings and appears in the new school's on the next load; given the pupil sends `grade` or `schoolId` to their own profile update, then the stored values are unchanged.
- FR-ADM-U03.3 `Pakej Langganan` shows only what 1.0 needs (read: current package/expiry); selling packages is Kewangan (section 6).
- AC-ADM-U03.1 (E2E) Given the admin resets a pupil password, the pupil logs in with the new one and the old one is refused.
- Gap: none. Deviation: none.

#### R1-ADM-U-04 `Sekolah` | `/admin/schools` (+ create, `/:id/edit`) | P0 | built both
- **Action: Keep** | gap: 4.V row U-04.

**Screen specification (from V2).**
- List route and title: `/admin/schools`, "Sekolah - Admin Panel". Regions: tiles `Jumlah Sekolah`, `Aktif`, `Tidak Aktif`; filters: select `Semua Negeri` (Johor, Kedah, Kelantan, Kuala Lumpur, Labuan, Melaka, Negeri Sembilan, Pahang, Perak, Perlis, Pulau Pinang, Putrajaya, Sabah, Sarawak, Selangor, Terengganu; "16 negeri"), select `Semua Status` (`Aktif sahaja`, `Tidak Aktif sahaja`), a text search, button `Tapis`; button `Tambah Sekolah`; table.
- Columns: `Nama Sekolah`, `Kod`, `Kod Daftar`, `Jenis`, `Negeri`, `Daerah`, `Pelajar`, and actions.
- Create: `/admin/schools/create`, "Tambah Sekolah - Admin Panel": fields `Nama sekolah *`, `Kod sekolah` (hint "Unik jika diisi (cth. kod KPM)."), `Jenis *`, `Negeri *`, `Daerah`, `Aktif`; buttons `Cipta Sekolah`, `Batal`.
- Edit: `/admin/schools/{id}/edit`, "Sunting Sekolah - Admin Panel": the same fields; buttons `Simpan`, `Batal`.
- V2 differs from the V1 reference: `Kod Daftar` column, `Kod sekolah` optional, no `Bandar` field observed. Validation copy not observed. Classes are not shown on these pages (E-04).
- Reference (V1 M02 S9-S11, title "Urus Sekolah - Admin PRESTASIPLUS"): stat cards "Jumlah Sekolah", "Aktif", "Tidak Aktif"; button `Tambah Sekolah`; filters "Cari nama atau kod sekolah...", `Semua Negeri`, `Semua Jenis`, `Cari`, reset; columns `Nama Sekolah`, `Kod`, `Jenis`, `Negeri`, `Daerah`, `Pelajar`, `Guru`, `Status` (`Aktif` / `Tidak Aktif`), `Tindakan` (Edit, toggle); empty "Tiada sekolah dijumpai"; form `Nama Sekolah *` ("cth: SK TAMAN KLUANG BARU"), `Kod Sekolah *` ("cth: JBA1234"), `Jenis *` (SK, SMK, SJK(C), SJK(T), MRSM, SBP), `Negeri *`, `Daerah`, `Bandar`, `Sekolah Aktif`; `Simpan` / `Kemaskini`, `Batal`, "Kembali ke Senarai Sekolah".
- FR-ADM-U04.1 List/search/create/edit/toggle as V1; 30 per page; school code unique.
- FR-ADM-U04.2 Primary-school types (SK, SJK) stay in data but are hidden from lists by default per D72 (rows kept; migrated ETL unchanged) [OQ-U1].
- AC-ADM-U04.1 Given a new SMK school, then it appears in Pengguna's school picker and in Janakan Akaun search.
- Gap: none. Deviation: FD-U04 SK hidden default (OQ-U1).

#### R1-ADM-U-05 `Import Pelajar` (ID Delima) | `/admin/import-students` | P1 | built (PS-04) / UAT built
- **Action: Fix** | gap and differences: 4.V row U-05.

**Screen specification (from V2).**
- Route and title: `/admin/import-students`, "Import Pelajar - Admin Panel".
- Regions in order: heading "Import Pelajar via ID Delima" with "Import pelajar dari Darjah 1 hingga Tingkatan 5 menggunakan ID Delima KPM." (V3: Tingkatan 1 to 5); two credential labels `Kata laluan DELIMa` and `Email DELIMa` (explanatory); notice "Import mencipta akaun pelajar baharu sahaja — akaun yang sudah ada tidak akan ditulis ganti atau dipadam. Format: nama,email dengan kolum kelas pilihan. Kata lalu masuk lalai: ••••••••."; banner "{n} akaun menunggu kelulusan — belum boleh log masuk." with `Semak & luluskan`; card `Borang Import Pelajar` with buttons `Muat Turun CSV Pelajar` and `Tutorial`.
- Form fields: `Sekolah` (searchable picker, states as R1-ADM-U-01); `Tingkatan / Darjah` (select "— Pilihan —", Darjah 1 to 6, Tingkatan 1 to 5; hint "Digunakan jika baris tidak menyatakan kelas."); `Senarai Pelajar` (file drop zone "Klik untuk pilih fail atau seret & lepas di sini", ".csv atau .txt · maksimum 2 MB · lajur: nama, email, kelas", button `Tukar`); preview "Pratonton · semua {n} baris" with "Ini contoh sahaja. {n} baris lagi tidak dipaparkan — kesemua {n} pelajar akan diimport."; submit `Import Pelajar`.
- The quota panel states ("Baki kuota", "Kuota penuh!") appear after a school is chosen and were not captured — follow the Reference above (V1) and AC-ADM-U05.1.
- Reference (V1 M02 S5, title "Import Pelajar (ID Delima) - Admin PRESTASIPLUS"): school search ("Taip nama sekolah (min. 2 huruf)..."); quota panel "Memeriksa kuota...", "Kuota Pelajar", "Baki kuota: {n} pelajar", "Kuota penuh! Sila tingkatkan kuota dahulu.", "Sekolah ini tiada langganan aktif. Import pelajar tidak dibenarkan."; `Darjah / Tingkatan *`; `Kaedah Import *` (`Upload CSV` / `Paste Manual`); drop zone "Seret & Lepas fail CSV di sini"; format "Nama, Email DELIMa, Kata Laluan, No KP (pilihan)"; notes "ID yang sudah wujud akan dilangkau automatik", "Nama pelajar akan ditukar ke Title Case"; `Kembali`, `Import`.
- FR-ADM-U05.1 As V1 with quota check before import. FR-ADM-U05.2 The class-level choice offers Tingkatan 1-5 only (the V1 "Sekolah Rendah / Darjah" group is removed, D96). FR-ADM-U05.3 A template link is shown (V1 has the xlsx but no link: D9). FR-ADM-U05.4 Result lists created, skipped (existing ID) and rejected rows with reasons.
- FR-ADM-U05.5 As V2 (`/admin/import-students`): the page shows the notice "Import mencipta akaun pelajar baharu sahaja — akaun yang sudah ada tidak akan ditulis ganti atau dipadam. Format: nama,email dengan kolum kelas pilihan.", the buttons `Muat Turun CSV Pelajar` and `Tutorial`, and a banner "{n} akaun menunggu kelulusan — belum boleh log masuk." with the link `Semak & luluskan` when imported accounts await approval; an imported pupil can log in only after the admin approves (approval list: select rows, `Luluskan`).
- FR-ADM-U05.5 (F-20, D-A17) The import quota equals the subscription seat limit of the school (`student_quota`, U-09). When the rows exceed the remaining seats (limit minus pupils already counted), the whole file is refused and nothing is imported; Evidence E-06 is closed by this rule.
- AC-ADM-U05.1 Given a school with 5 seats left and 8 rows, then the whole file is refused with "Kuota penuh! Sila tingkatkan kuota dahulu." and no pupil is created; given 5 rows, then all 5 import.
- AC-ADM-U05.3 Given a pupil password shorter than 8 characters in user create or an import row, then it is refused with a field message naming the minimum.
- AC-ADM-U05.2 (E2E) Given 3 imported T5 pupils that the admin has approved through `Semak & luluskan`, a pupil logs in with the DELIMa email and sees the Murid portal; before approval the login is refused.
- Gap: none; menu present. Deviation: FD-U05 Darjah removed, template link added.

#### R1-ADM-U-06 `Import Pengguna` | `/admin/users/bulk-import` | P1 | route exists, no menu / UAT unverified
- **Action: Complete** (menu entry plus verification) | gap: 4.V row U-06.

**Screen specification (from V2).**
- Route and title: `/admin/users/bulk-import`, "Import Pengguna - Admin Panel".
- Regions in order: heading `Import Pengguna Pukal` with "Daftarkan guru, ibu bapa, atau pentadbir sekolah secara pukal." and role tags (Guru, Ibu Bapa, Admin); notice "Import mencipta akaun baharu sahaja — akaun sedia ada tidak ditulis ganti atau dipadam. Fail CSV: nama,email. Kata laluan lalai: ••••••••."; banner "{n} akaun menunggu kelulusan — belum boleh log masuk." with `Semak & luluskan`; card `Borang Import Pengguna` with buttons `Muat Turun CSV Pengguna`, `Tutorial`.
- Form fields: `Peranan` (select Guru, Admin Sekolah, Pegawai PPD); `Sekolah` (searchable picker); `Fail Pengguna (CSV)` (drop zone "Klik untuk pilih fail atau seret & lepas di sini", ".csv atau .txt · maksimum 2 MB · lajur: nama, email", `Tukar`); preview "Pratonton · semua {n} baris" with the "Ini contoh sahaja ..." note; submit `Import`.
- V2 differs from V1: no default-password or paste-manual option; role list is Guru, Admin Sekolah, Pegawai PPD.
- Reference (V1 M02 S4, title "Import Pengguna Pukal - Admin PRESTASIPLUS"): hero "Import Pengguna Pukal" / "Daftarkan guru, ibu bapa, atau pentadbir sekolah secara pukal."; `Peranan Pengguna *` (Guru, Ibu Bapa, Admin, PPD); `Sekolah * (taip untuk cari)`; `Kata Laluan Default (untuk pengguna tanpa kata laluan)`; `Kaedah Import *` (`Upload CSV` / `Paste Manual`); "Format CSV: Nama, Emel, Telefon (pilihan), Kata Laluan (pilihan)"; `Kembali`, `Import`; notes "Emel sedia ada akan dilangkau automatik".
- FR-ADM-U06.2 (F-20) There is no teacher bulk import for Admin Sekolah in R1; `Import Pengguna` here is the bulk path for teachers. A teacher account created one by one by the school admin is active at once; pupils imported through Import Pelajar are pending until Admin Pusat approves them (`Semak & luluskan`). Passwords follow FR-ADM-U02.4 (minimum 8).
- FR-ADM-U06.1 Menu entry added (PS-05); behaviour as V1; results as U05.4. AC-ADM-U06.1 Given a CSV of 5 teachers for a school, then 5 Guru accounts are linked to the school. Gap: PS-05 hidden (`menu.ts`). Deviation: none.

#### R1-ADM-U-07 `Pelajar Komplimen` | `/admin/comp-students` (+ create, `/:id`) | P2 | built (PS-06)
- **Action: Keep** | gap: 4.V row U-07.

**Screen specification (from V2).** Route and title: `/admin/comp-students`, "Pelajar Komplimen - Admin Panel". Regions: the count line "{n} pelajar komplimen" (0 in the capture); a search box with button `Cari`; table with columns `Nama`, `Username`, `IC`, `Sekolah`, `Kelas`, `Akaun`, `Syiling`. Bulk buttons, create form and empty copy are in the Reference above (V1); not captured in V2.
- Reference (V1 M02 S6-S8): "Syiling OFF: {n} / {m} pelajar komplimen", `Daftar Baru`; bulk buttons `Matikan syiling`, `Hidupkan syiling`, `Nyahaktif akaun`, `Aktifkan akaun`, `Batal pilihan`; empty "Tiada pelajar komplimen lagi. Daftar baru."; create: alert "Setiap pelajar dapat: username 6 digit akhir IC@prestasiplus.my, ...", `Guru`, `Kelas guru`, `Tarikh tamat pakej`, `Senarai pelajar` ("NAMA PENUH, NOMBOR KP").
- FR-ADM-U07.1 As V1; bulk actions ask for confirmation (V1 has none: D9). AC-ADM-U07.1 Given 3 selected, `Matikan syiling` asks "{n} dipilih" confirmation then switches coins OFF. Gap: none. Deviation: FD-U07 confirmation.

#### R1-ADM-U-08 `Kelas Sekolah` | `/admin/classes` | P1 | GH none in Pentadbiran (drill-down in Command Center) / UAT same
- **Action: Build** (list over the existing classes API) | gap: 4.V row U-08.

**Screen specification (from V2).** Not observed in V2 — no admin class page exists in the captured screens (E-04); follow FR-ADM-U08.1..U08.2.
- Reference: V1/V2 manage classes under Pengguna/Sekolah (ADMIN-PUSAT rows 8, 53); V3 classes owner M10 (`classes` module, API exists `apps/api/src/modules/classes`).
- FR-ADM-U08.1 List classes by school with columns class name, code, teacher, Tingkatan, pupils count, status; filters Sekolah, Guru, Tingkatan, `Cari`.
- FR-ADM-U08.2 Detail shows the pupils and lets the admin move/remove a pupil and change the class teacher; creating a class is by the teacher (Guru portal) — admin only corrects (assumption; Evidence E-04 V2 admin class management).
- AC-ADM-U08.1 (E2E) Given a pupil is added to a class by the admin, the pupil's Kelas Saya lists the class.
- Gap: PS-03 hidden. Deviation: none. OQ-U2.

#### R1-ADM-U-09 `Langganan Sekolah` | `/admin/school-subscriptions` (+ create, `/:id`, `/:id/renewal-invoice`) | P1 | built (KW-05)
- **Action: Keep** | gap: 4.V row U-09.

**Screen specification (from V2).** Route and title: `/admin/school-subscriptions`, "Langganan Sekolah - Admin Panel". Regions: tiles `Jumlah Langganan`, `Aktif`, `Tamat`; filter button `Tapis` (filter fields as the Reference above); table with columns `Sekolah`, `Tingkatan`, `Pakej`, `Kuota`, `Status`, `Mula`, `Tamat` (and a row link). The create form, detail and renewal invoice pages were not captured — follow the Reference above (V1).
- Reference (V1 M02 S12-S15): filters "Cari sekolah...", `Status` (Aktif, Tempoh Ihsan, Tamat, Dibatalkan), `Semua Tingkatan` (Tingkatan 4, Tingkatan 5); `Langganan Baru`; columns `Sekolah`, `Tingkatan`, `Pakej` (`Pemantauan` / `Penuh`), `Kuota`, `Status`, `Mula`, `Tamat`, `Lihat`; create cards T4 "Pakej SPM Tingkatan 4", T5 "Pakej SPM Tingkatan 5".
- FR-ADM-U09.1 As V1 for T4/T5 only; the D1_D6 and T1_T3 package cards are not offered (D72). FR-ADM-U09.2 Quota used feeds the Import Pelajar check.
- AC-ADM-U09.1 Given a school without a subscription, Import Pelajar refuses with "Sekolah ini tiada langganan aktif. Import pelajar tidak dibenarkan.". Gap: none. Deviation: FD-U09 only T4/T5 packages.

### 4.E Monitoring and reports

#### R1-ADM-M-01 `Dashboard` | `/admin` | P1 | GH redirect to Command Center / UAT same
- **Action: Build** | gap and differences: 4.V row M-01.

**Screen specification (from V2).**
- Route and title: `/admin`, "Dashboard - Admin Panel".
- Regions in order: stat tiles (label, big number, sub-line): `Soalan Aktif` ("Minggu ini: {n}"), `Diluluskan` ("Aktif digunakan: {n}"), `Menunggu Review` ("Perlu tindakan"), `Draf` ("Belum siap"), `Subjek` ("{n} Aktif"), `Tahap Pendidikan` ("Darjah & Tingkatan"), `Pengguna` ("{n} Pelajar"), `Battle Arena` ("PvP Quiz Battles", "{n} Total", "{n} Aktif", "{n} Selesai"); sponsor tiles `Jumlah Penaja`, `Menunggu Kelulusan` ("Tiada yang menunggu"), `Ditolak` ("Permohonan ditolak"), `Digantung` ("Akaun digantung") — not built in V3; card of three `Tindakan Pantas` links ("Tambah Soalan Baru", "Tambah Subjek Baru", "Import & Semakan Soalan"); card `Soalan Terkini` ("10 soalan terbaru", link `Lihat Semua`) with columns `Soalan` (stem cut, then type "Mcq" and "Kesukaran: 2/5"), `Subjek`, `Tahap`, `Status`, `Tarikh` (dd/mm/yyyy); the status-distribution chart `Taburan Status Soalan`; `Pautan Pantas` (Kurikulum, Banner, Artikel); `Muat Turun Data (CSV)` (Pengguna, Soalan, Pembayaran, Sekolah).
- Empty copy for the recent list: "Tiada soalan." (from V2 code). V3 differences: FR-ADM-M01.1..M01.4 (V3 status names, 5 levels, no payments).
- Reference (V2 `admin/dashboard.blade.php`, title "Dashboard", subtitle "Gambaran Keseluruhan Platform"): tiles `Soalan Aktif`, `Diluluskan`, `Menunggu Review`, `Draf`, `Subjek`, `Tahap Pendidikan`, `Pengguna`, `Battle Arena`; sponsor tiles (`Jumlah Penaja`, `Menunggu Kelulusan`, `Ditolak`, `Digantung`: out, section 6); quick actions "Tambah Soalan Baru", "Tambah Subjek Baru", "Import & Semakan Soalan"; "Soalan Terkini" ("10 soalan terbaru", columns `Soalan`, `Subjek`, `Tahap`, `Status`, `Tarikh`, empty "Tiada soalan."); chart "Taburan Status Soalan"; "Pautan Pantas" (Kurikulum, Banner, Artikel); "Muat Turun Data (CSV)" (Pengguna, Soalan, Pembayaran, Sekolah).
- FR-ADM-M01.1 `/admin` shows the tiles with V3 status names (Draft, Reviewed, Approved, Archived replace Draf/Menunggu Review/Diluluskan) computed from the same list endpoint counts as Studio (one source, so "3 vs 0" cannot recur).
- FR-ADM-M01.2 Quick actions point to Studio `Cipta baharu`, Subjek create, Import & Semakan.
- FR-ADM-M01.3 "Pendidikan" tile counts 5 Tingkatan (Darjah hidden). FR-ADM-M01.4 Payments tile and CSV for Pembayaran are omitted (section 6).
- AC-ADM-M01.1 Given 3 Reviewed questions, then the tile "Menunggu Review" [V3 label to be fixed with the status vocabulary] and the Studio tile show 3.
- Gap: `m17/routes/dashboard.ts` empty; `core-routes.ts:84-88` redirect. Deviation: FD-M01 vocabulary; D77 satisfied because the Dashboard is a V2 menu item the user asks to match. OQ-M1.

#### R1-ADM-M-02 `Langsung` and `Aktiviti Harian` | `/admin/command-center`, `/admin/command-center/daily-activity` | P1 | built both (PM-01, PM-02)
- **Action: Keep** | gap: 4.V row M-02.

**Screen specification (from V2).**
- Route and title: `/admin/command-center`, "Command Center - Admin Panel".
- Regions in order: header tag `LIVE`, "Data dikemaskini setiap 10 saat" and a running clock; four tiles `Sekolah Berdaftar` ("{n} langganan aktif"), `Pelajar Berdaftar` ("{n} pernah aktif menjawab"), `Soalan Dijawab` ("sepanjang masa"), `Ketepatan Purata` ("keseluruhan platform"); card "🏆 Top Sekolah" (ranked school names with counts); card "📈 Aktiviti Hari Ini" ("{n} soalan dijawab hari ini", "Minggu ini: {n}", link `Lihat Aktiviti Harian`); card "🤖 Wawasan" showing "Wawasan AI tidak disambung" / "Panel ini memerlukan perkhidmatan luaran" (V3 hides AI surfaces, so this card is not built); card "⚡ Live Feed" (rows: time, pupil name, subject, ✅ or ❌ for a right or wrong answer; the admin sees the pupil's full name, D-A12).
- Aktiviti Harian: `/admin/command-center/daily-activity`, linked from the card; per-day list — its fields were not captured in the admin set and are Not observed here — follow the built V3 screen (D77).
- Reference: V2/V1 Command Center LIVE with drill-down to school/teacher/class/pupil; D77 keeps the restored layout.
- FR-ADM-M02.2 (F-02, D-A1, F-10, D-A10, D-A12) `Soalan Dijawab`, `Ketepatan Purata`, `Aktiviti Hari Ini`, `Top Sekolah` and the Live Feed read the single answer store `practice_answers` with all modes (Latih Tubi, Soalan by Chapter, SPM Databank, Kuiz, Bijak sittings including Tracking A, Subjektif self-mark, Set Soalan Guru `question_set`, Simulasi, question games), each with the computation and precision of 40 FR-X4. Admin screens show pupils' full names (other pupils see the first name only, with no school).
- FR-ADM-M02.1 Unchanged; verify that data a new pupil/class creates (U-01, U-08) appears within one refresh. AC-ADM-M02.1 (E2E) Given a T5 pupil answers 10 questions on UAT, Aktiviti Harian shows the activity. Gap: none (ADMIN-PUSAT row 1). Deviation: none.

#### R1-ADM-M-03 `Monitoring` | `/admin/monitoring` | P1 | GH built at `/guru/monitoring` (wrong route) / UAT same
- **Action: Fix** | gap: 4.V row M-03.

**Screen specification (from V2).**
- Route and title: `/admin/monitoring`, "Monitoring Penglibatan - Admin Panel".
- Regions in order: filter bar: select `Tempoh` (`Semua Masa`, `7 Hari`, `30 Hari`, `3 Bulan`), select `Negeri` (`Semua Negeri` + 16 states from Johor to Terengganu), buttons `Tapis`, `Reset`; tiles `Jumlah Sekolah` ("Berdaftar"), `Pelajar Berdaftar` ("{n} pernah aktif"), `% Penglibatan` ("Min. 1 soalan dijawab"), `Soalan Dijawab` ("Purata {n}/pelajar aktif"), `Guru Berdaftar` ("Akaun bertaraf guru"), `Guru Pernah Login` ("Sejak penjejakan log masuk dimulakan"), `% Penglibatan Guru` ("{n} / {m} guru"); card `Panduan Monitoring Penglibatan` ("Penglibatan dikira sebagai pelajar yang pernah menjawab sekurang-kurangnya satu soalan, dibahagikan dengan pelajar berdaftar bagi sekolah itu. Tahap: Cemerlang ≥ 60%, Sederhana ≥ 20%, Rendah < 20%, Tiada = 0%."); chart `Tracking Mingguan` (columns M1 to M12; "Jumlah soalan dijawab setiap minggu (12 minggu terakhir)."); lists `Sekolah Terbaik` (rank, school, %) and `Perhatian Segera` (school, "{n} berdaftar · {m} aktif").
- CSV/PDF export controls named in the Reference were not visible in the text; follow FR-ADM-M03.2.
- Reference (V2 `admin/monitoring.blade.php`): title "Monitoring Penglibatan", subtitle "Pemantauan penglibatan pelajar & sekolah"; CSV/PDF export.
- FR-ADM-M03.1 Menu PM-03 opens `/admin/monitoring` (page exists, `m17/routes/monitoring.ts`), not the teacher route. FR-ADM-M03.2 Export CSV and PDF as V2 (P2). FR-ADM-M03.3 (F-02, D-A1, F-10, D-A10) Monitoring reads the single answer store `practice_answers` (all modes, 40 §X4a) and every metric it shows uses the definition and precision of 40 FR-X4; this screen defines none of its own.
- AC-ADM-M03.1 Given the admin clicks Monitoring, then the URL is `/admin/monitoring` and no 403 shows. Gap: `menu.ts:62`. Deviation: none.

#### R1-ADM-M-04 `Kirkpatrick` (7 screens) | `/admin/kirkpatrick`, `/reaction`, `/learning`, `/behavior`, `/results`, `/chain`, `/interventions` | P1 | built both
- **Action: Complete** (Tahap 1 collector) | gap: 4.V row M-04.

**Screen specification (from V2).**
- Overview: `/admin/kirkpatrick`, "Kirkpatrick - Admin Panel". Regions: filters `Sekolah` (searchable picker "Semua Sekolah", states as R1-ADM-U-01) and `Negeri` (`Semua Negeri` + 16 states) with `Tapis`; four level cards in order `Tahap 4: Hasil` ("5.17", "GPS Sekolah · {n} rekod headcount"), `Tahap 3: Tingkah Laku` ("30/6,162", "Pelajar aktif · {n} sesi · {p}% ketepatan"), `Tahap 2: Pembelajaran` ("71.3%", "Ketepatan · {n} soalan dijawab"), `Tahap 1: Reaksi` ("3.8/5", "Kepuasan purata · 17 respon"), each with a link `Lihat detail`; card "Kirkpatrick Evaluation Flow" ("Klik mana-mana tahap untuk lihat detail") with the four steps `T1: Reaksi` (Kepuasan pengguna), `T2: Pembelajaran` (Peningkatan kemahiran), `T3: Tingkah Laku` (Konsistensi penggunaan), `T4: Hasil` (Keputusan peperiksaan); card "Perbandingan Sebelum & Selepas" ("Januari 2026 vs November 2026", blocks `SEBELUM` / `SELEPAS` with date ranges).
- Pembelajaran: `/admin/kirkpatrick/learning`. Section `Prestasi Mengikut Subjek`: per subject name, accuracy %, a level word (`Mastered` or `Developing`) and "{n} soalan".
- Hasil: `/admin/kirkpatrick/results`. Tiles of candidates ("{n}" with "2.4% daripada 6,162") and `Rekod Headcount` ("Data OTR"); card `Taburan Gred (2025)` ("Berdasarkan {n} calon — sumber: Headcount OTR") with grades A+, A, A-, B+, B, C+, C, D, E, G each with count and %; table `GPS Mengikut Subjek (2026)` ("Sumber: Headcount OTR") with columns `#`, `Subjek`, `GPS`, `Gred`, `Calon`, `Trend`.
- Reaksi, Tingkah Laku, Rantaian Impak and Intervensi pages: Not observed in V2 — follow FR-ADM-M04.1..M04.3 and the Reference above. The V2 Overview has no school-less default; V3 scopes by role.
- Reference: V2 labels `Overview`, `T1: Reaksi`, `T2: Pembelajaran`, `T3: Tingkah Laku`, `T4: Hasil`, `Rantaian Impak`, `Intervensi` (used by the menu, section 3.1; V3 had `Ringkasan`, `Tahap 1: Reaksi`... restored by D77).
- Tahap 1 (Reaksi) data collector (F3): the Reaksi figures (NPS and satisfaction) come from the monthly feedback form `/maklum-balas` ("Maklum Balas — PrestasiPlus"), which pupils, teachers and admins fill once a month as in V2 (`routes/web.php:1570` `POST /maklum-balas`, `FeedbackController`). Owner: module M12 Kirkpatrick, screen S10; the V3 route fragment `src/modules/m12-kirkpatrick/routes/student.ts:3-4` is empty today, so Tahap 1 has no data source. States observed in V1 (M12 discovery S10): after submission "Terima Kasih!", "Anda sudah mengisi maklum balas untuk bulan ini. Sila kembali bulan depan.", button "Kembali ke Dashboard". The form fields (NPS 0-10, satisfaction 1-5) are inferred, not observed (E-19).
- FR-ADM-M04.1 The 7 items render for the Admin Pusat with their data; the Guru/AS scoping and the 7 school-scoped screens for Admin Sekolah (D108(5)) are owned by the Guru/AS PRDs (`m12 routes/mount.ts:33` "S1 only" is the cause there).
- FR-ADM-M04.2 The form `/maklum-balas` exists for pupil, teacher and admin roles, accepts one answer per user per calendar month, stores NPS and satisfaction, and shows the thank-you state when already answered.
- FR-ADM-M04.4 (F-02, D-A1, D-A10) The learning, behaviour and results screens (`T2` to `T4`, `Rantaian Impak`, `Intervensi`) read `practice_answers` including every mode (Latih Tubi, Soalan by Chapter, SPM Databank, Kuiz, Bijak sittings including Tracking A, Subjektif self-mark, Set Soalan Guru `question_set`, Simulasi and question games) and use the metric definitions of 40 FR-X4.
- FR-ADM-M04.3 `T1: Reaksi` and `Overview` read only the stored answers (scoped by role: Admin Pusat all, school admin their school) and show the empty state of the module when none exist.
- AC-ADM-M04.1 Given the Admin Pusat, when each of the 7 Kirkpatrick items is opened, then each renders its data with no error or 403.
- AC-ADM-M04.2 (E2E) Given a T5 pupil submits the monthly form with NPS 9, when the Admin Pusat opens `T1: Reaksi`, then the response count is 1 and NPS includes the 9; submitting again the same month shows "Anda sudah mengisi maklum balas untuk bulan ini. Sila kembali bulan depan.".
- Gap: no collector (empty route fragment). Deviation: none.

#### R1-ADM-M-05 `Analitik` | `/admin/analytics` | P1 | GH empty (PM-04) / UAT same
- **Action: Build** | gap and differences: 4.V row M-05.

**Screen specification (from V2).**
- Route and title: `/admin/analytics`, "Analitik & Statistik - Admin Panel".
- Regions in order: tiles `Jumlah Import` ("Keseluruhan batch"), `Import Bulan Ini` ("November 2026"), `Import Lepas` ("October 2026"), `Soalan Diimport` ("Berjaya dimuat naik"); card `Taburan Status Soalan` (Draf, Menunggu Review, Diluluskan, Ditolak, Diarkib, each "{n} ({p}%)", then "Jumlah: {n} soalan"); card `Kandungan Sokongan` (`Banner` "{n} aktif", `Artikel` "{n} draf", `Nota` "{n} draf"); list `Top 10 Subjek Aktif` (rank, subject, question count); table `Matriks Liputan Subjek` ("Bilangan soalan mengikut subjek dan tahap pendidikan"; columns `Subjek`, D1 to D6, T1 to T5, `Jumlah`; V3 shows T1 to T5 only).
- The Panel version (`/analitik`) shows platform figures instead; its tiles are in the register (4.V.1). V3 content follows FR-ADM-M05.1..M05.3.
- Reference (V2 `admin/analytics.blade.php`): title "Analitik & Statistik", subtitle "Analisis kandungan soalan platform"; middleware `pusat:Analitik Kandungan`.
- FR-ADM-M05.1 Content analytics of the question bank: counts per subject, Tingkatan, status, DSKP-tagged share, Bab coverage, servability per activity. FR-ADM-M05.2 Each figure is computed from the question list endpoint (no stored counts, D11/D12).
- FR-ADM-M05.4 (D-A10) Any pupil-performance figure on Analitik (Ketepatan, Soalan Diuji, mastery band) is computed and rounded exactly as defined in 40 FR-X4 (pooled accuracy; "Soalan Diuji" = distinct questions) and reads `practice_answers` of all modes (D-A1).
- FR-ADM-M05.3 The tile `Laporan Soalan` links to Q-22 (Panel tile; its content beyond the link is Evidence E-02).
- AC-ADM-M05.1 Given 3 approved Sains T5 questions with Bab "X", then Analitik shows Sains T5 = 3 and Bab "X" covered. Gap: `m17/routes/analytics.ts` empty. Deviation: Panel tiles left open (E-02).

#### R1-ADM-M-06 `Laporan` | `/admin/laporan` | P1 | GH empty / UAT same
- **Action: Build** | gap: 4.V row M-06.

**Screen specification (from V2).**
- Route and title: `/admin/laporan`, "Laporan - Admin Panel" (subtitle "Laporan aktiviti").
- Regions in order: tiles `Sekolah`, `Guru`, `Murid`, `Murid Pernah Akses` ("{n} / {m}" with a percentage), `Cikgu Pernah Akses`, `Murid Buat Latihan`, `Jumlah Aktiviti` ("30 hari lepas"), `Skor Purata` ("purata ketepatan sesi"); chart `Trend Aktiviti (14 hari)` (daily labels dd/mm); list `Pecahan Aktiviti` (activity type and count: Spm_tahun_lepas, Revision, Kuiz Bab, Latih Tubi, Battle Arena, PKSK, SPM, Spm_mock, Spm_ramalan — raw keys are shown in V2, V3 shows readable labels); table `Pelajar Paling Aktif (Top 10)`; notice "Semua guru telah mengakses platform." when applicable; card `Aktiviti Mengikut Sekolah`.
- Empty copies: "Tiada aktiviti dalam 14 hari lepas.", "Tiada aktiviti direkodkan.", "Tiada aktiviti pelajar.", "Tiada aktiviti sekolah." (from V2 code).
- Reference (V2 `admin/laporan.blade.php`): title "Laporan", subtitle "Laporan aktiviti"; tiles `Sekolah`, `Guru`, `Murid`, `Murid Pernah Akses`, `Cikgu Pernah Akses`, `Murid Buat Latihan`, `Jumlah Aktiviti`, `Skor Purata`; "Trend Aktiviti" (empty "Tiada aktiviti dalam 14 hari lepas."), "Pecahan Aktiviti" (empty "Tiada aktiviti direkodkan."), "Pelajar Paling Aktif" (empty "Tiada aktiviti pelajar."), notice "Semua guru telah mengakses platform.", "Aktiviti Mengikut Sekolah" (empty "Tiada aktiviti sekolah.").
- FR-ADM-M06.1 Page with the tiles and sections above, 14-day trend, from practice-session data (M05 owner). FR-ADM-M06.2 Uses the same read model as the Guru "Laporan" (row 42) so the figures agree; it monitors and does not feed that module. FR-ADM-M06.3 (F-02, D-A1, F-10, D-A10) `Laporan` counts activity from the single answer store `practice_answers` with all modes (Latih Tubi, Soalan by Chapter, SPM Databank, Kuiz, Bijak sittings including Tracking A, Subjektif self-mark, Set Soalan Guru `question_set`, Simulasi, question games); each accuracy metric is a pooled accuracy shown as a whole-number percent (40 FR-X4 precision list) and every other metric uses the computation and precision of 40 FR-X4, and the definitions XS-7 / XS-8 in 20 §5. Admin metrics for the 40 FR-X4 list: Jumlah Aktiviti, Murid Buat Latihan, Ketepatan (any accuracy figure), Soalan Diuji, Soalan Dijawab, the 14-day trend, mastery bands, Command Center counts (Langsung, Aktiviti Harian), Monitoring figures and the Kirkpatrick T2 to T4 measures.
- AC-ADM-M06.2 (E2E, AC-CHAIN-1 step) Given a pupil answers 3 questions (2 correct) in a Latih Tubi session, then `Jumlah Aktiviti` increases by 3 on the next load; given a pupil answers 3 questions in a Set Soalan Guru (`question_set`) session, then it increases by 3 as well (all modes, D-A1).
- AC-ADM-M06.1 (E2E) Given the T5 pupil completes a Latih Tubi session, then `Murid Buat Latihan` and `Jumlah Aktiviti` increase by the next load. Gap: `m17/routes/laporan.ts` empty. Deviation: none.

#### R1-ADM-M-07 Central views of school-admin reports and Headcount / Analisa Item | `/admin/...` (PM-12, 13, 15, 21, 22, 23, 24, 27, 28) | P2 | not built
- **Action: Build** | gap: 4.V row M-07.

**Screen specification (from V2).** Not observed in V2 — no central view of the school-admin screens was captured (E-23); follow FR-ADM-M07.1..M07.2. The V2 Kirkpatrick overview and Monitoring pages offer a school picker (R1-ADM-M-04, M-03) that shows the pattern.
- Reference: V2/V1 `Laporan`, `Analitik`, `Wellbeing Alerts`, `Sekolah Bersaing`; V3 school versions exist in M27/M08/M18.
- FR-ADM-M07.1 For each, a central view with a school picker reusing the school-level reads. FR-ADM-M07.2 Figures equal the school screens for the same school (no second model, GAP "angka bercanggah"). AC-ADM-M07.1 Given school S, the central Laporan Aktiviti equals S's Admin Sekolah screen. Deviation: none. Priority P2 because it feeds no 1.0 module: the school-level screens of Admin Sekolah 45-50 are built in M27/M18 and read their own data (section 2.3).

#### R1-ADM-M-08 `Laporan Eksekutif` | `/admin/laporan-eksekutif` | P2 | not built (PP-02)
- **Action: Build** | gap: 4.V row M-08.

**Screen specification (from V2).**
- Route and title: `/admin/laporan-eksekutif`, "Laporan Eksekutif - Admin Panel".
- Regions in order: heading "Laporan prestasi keseluruhan platform PRESTASIPLUS" with "Ringkasan Eksekutif 2026"; tiles `Jumlah Sekolah` ("{n} sekolah aktif"), `Pelajar Berdaftar` ("{n} aktif"), `Kadar Penglibatan` ("daripada pelajar daftar"), `Soalan Dijawab` ("sepanjang 2026"), `Ketepatan` ("purata jawapan betul"), `Guru` ("berdaftar"), `Soalan / Pelajar Aktif` ("purata kedalaman penggunaan"), `Bulan Paling Aktif` (month and "{n} sesi"); chart `Trend Penggunaan Bulanan 2026` (Jan to Dis with session counts).
- Buttons and error states: not observed.
- Reference: V2 title "Laporan Eksekutif", subtitle "Ringkasan eksekutif". FR-ADM-M08.1 Summary page from M07 figures. AC-ADM-M08.1 Given the Admin Pusat, when `Laporan Eksekutif` is opened, then it renders the summary from M-07 figures with no error. Evidence E-09 for content.

### 4.G DSKP guidance for question entry (reference for every entry screen)

Sources: `docs/reference/dskp/*.json` + `README.md` (13 subjects, T4-T5, audited 2026-10-16, `docs/qa/audit/dskp-extracts-audit.md`); official PDFs and 24 trial papers in `D:\prestasiplus-dskp\` (`sampel-percubaan\` matematik-johor-2025-set1, matematik-tambahan-selangor-2025-set1, fizik-selangor-2025-set1, sejarah-selangor-2025-set1, bahasa-melayu-selangor-2025-set1, bahasa-inggeris-selangor-2025-set1, each with question papers and skema); `docs/reference/blueprints/*.json` (1249-2, 1449-1, 1449-2, 3472-1, 3472-2, 4531-2); `docs/discovery/SPM-paper-patterns.md`; `docs/requirements/v2-exam-schema.md` D5/D6/D9; `docs/adr/0031-...`, `0036-...`, `docs/ops/r1-b05-dskp-gate.md`, `docs/ops/dskp-loader.md`. DSKPs describe classroom assessment (TP 1-6), not the SPM paper format; paper structure comes from the blueprints and trial papers (README "Not covered by any DSKP").

#### 4.G.1 The DSKP hierarchy and what a question must or may carry
Generic tree (exam schema D9): `Subjek -> Tingkatan -> Pengelompokan (Bidang / Tema) -> Unit (Tajuk / Bab-DSKP / skill) -> SK (Standard Kandungan) -> SP (Standard Pembelajaran) -> TP 1-6 descriptor (Standard Prestasi) per unit or per SK`, plus the KBAT tag. Printed codes are kept (e.g. `4.0`, `1.1`, `1.1.1`; Sejarah `Tajuk 11`, `9.1.1`).

| Subject (file; SP T4 / T5) | Hierarchy as printed (`structureNote`, README) | TP descriptors are per | Notes for entry |
|---|---|---|---|
| Matematik (70 / 57) | Bidang Pembelajaran -> Tajuk (N.0) -> SK -> SP | Tajuk | formulae drawn as images are missing from SP text: do not match on exact wording |
| Matematik Tambahan (94 / 77) | Learning Area -> Topic -> SK -> SP (BI edition) | Topic | four units carry an elective package; area inferred from Table 8 |
| Fizik (108 / 97) | Theme -> Learning Area (N.0) -> SK -> SP (BI edition) | Learning Area | formulae dropped |
| Sains (121 / 85) | BI edition, SK -> SP | per README: not stated here (Evidence E-11) | T4 4.3.1 is a reconstruction |
| Bahasa Melayu (54 / 48) | units are skills (1.0-5.0); SK 3.4; SP 3.4.3 | skill; 4.0 and 5.0 have no TP | |
| Bahasa Inggeris (35+2 / 34+3) | units are skills; printed "No learning standard" slots kept as rows | skill | Form 4 is "DRAF 1/2018" |
| Sejarah (102 / 96) | Tema -> Tajuk -> SK (9.1) -> SP (9.1.1); K-codes for citizenship | SK | `textbook_ref` {Bab, Tingkatan, Muka surat} printed in the skema (e.g. "B3T4 M56") |
| Pendidikan Islam (133 / 106), Tasawwur Islam (64 / 31) | SK -> SP | Tasawwur: SK | Jawi words in about 110 SPs unverified |
| Pendidikan Moral (72 / 72) | SK -> SP | per README | SP x.y.5-6 and TP5-6 are attitude, not testable on paper |
| Pendidikan Seni Visual (65 / 56) | SK -> SP | per README | only Persepsi and Apresiasi suit written questions |
| Landskap dan Nurseri (72 / 68), Katering dan Penyajian (140 / 100) | practical subjects | per README | T4 units 1.0, 3.0, 4.0 and T5 7.0 have unusable TP rows (loader rejects 4 rows) |

Rule per field (exam schema D2/D9; ADR-0031; `dskp-gate.ts`):
| Field | MUST (blocks Terbitkan) | MAY | Source of values |
|---|---|---|---|
| Subjek, Tingkatan (1-5) | yes | | `subjects`, `education_levels` |
| Tajuk DSKP (DSKP unit node) | yes ("Sila pilih unit DSKP.") | null only with `form_origin` T1-T3 for out-of-extract content | `curriculum_nodes` kind unit |
| SP | yes, 1 to 3 ("Sila pilih sekurang-kurangnya satu SP DSKP.") | | `curriculum_nodes` kind SP |
| SK | derived from SP, never typed | | |
| TP 1-6 | yes, per leaf part, inherits the question TP ("Bahagian (b) belum ada TP."); question TP = highest leaf TP | the AI suggests, the reviewer confirms | descriptor text shown is the unit's (or SK's) own |
| Aras pemikiran (cognitive level) per leaf | gate today for SPM-bound T4/T5 ("Bahagian (b) belum ada aras pemikiran.") | | mengingat, memahami, mengaplikasi, menganalisis, menilai, mencipta |
| KBAT | no separate gate: derived from the cognitive level above | leaf override; the 4 upper levels = KBAT; `bukan` explicit | derived from cognitive level, or explicit |
| Kertas | yes if SPM-bound (SPM-bound = subject in the SPM catalogue and Tingkatan 4 or 5; a flat MCQ with no paper placement takes Kertas 1 unless the admin sets another in the wizard) | | trailing digit of the paper code |
| Bab (Soalan by Chapter) | yes when the subject and Tingkatan have chapters (D-A5, with SP and TP/aras; otherwise the Bab item is not listed); "Sila pilih Bab." | | M03 chapters, a separate tree (4.G.3) |
| Tahap kesukaran 1-5 (`difficultyLevel`) | yes ("Sila pilih tahap kesukaran."); a separate field from TP (D-A6) | | fixed list 1 to 5 |
| textbook_ref {Bab, Tingkatan, Muka surat} | no | Sejarah mainly | optional |
| form_origin T1-T5 | only if the content is outside the loaded extract | | |
| Topik / Subtopik | no | yes (V2 Tag step) | M03 |
| Kesukaran (Mudah/Sederhana/Sukar) | not typed | display value derived from Tahap kesukaran by one mapping (50) | derived |
| year, exam type, board/negeri, set, paper code, source | declared once per batch (D99) | | batch header |
No tag is free text (exam schema 8.3 rule 5). The cognitive-level gate and the exam schema wording on KBAT: see OQ-QE2 (sources, dates, recommendation).

#### 4.G.2 How question parts map to SP and TP (ADR-0031)
- A question is a tree of parts, depth <= 3; marks live on leaf parts only; parents have no marks (exam schema D2).
- Curriculum link is on the question version: `unit_node_id` + `question_version_sp_nodes` (1 to 3 SP) + subject + level (`checkTagGate`).
- TP (`question_parts.difficulty_tp`) and `cognitive_level` are per leaf part; a leaf with no TP inherits the version TP; `question_versions.difficulty_tp` is derived at save as the highest leaf TP (ADR-0031 item 2, `r1-b05` line 13).
- KBAT is read per leaf; `kbat` follows `cognitive_level` unless explicit (`r1-b05` line 15). A question's KBAT marks = marks of its leaves with a level among mengaplikasi, menganalisis, menilai, mencipta.
- A multi-topic K2 question (e.g. Matematik K2 Q12: integers + inequality) carries up to 3 SP at question level; each leaf has its own TP.
- `dskp_complete` = unit + >= 1 SP + all leaves TP and cognitive level; its negation is the badge "Belum ditanda DSKP" (ADR-0031 item 5).
- Legacy rule (D80 DEC-2): untagged legacy MCQs stay servable in Latih Tubi, Soalan by Chapter and games; excluded from blueprint papers and Jana Kertas; the gate runs only on a transition into approved.

#### 4.G.3 Bab (Soalan by Chapter) versus the DSKP tree
- Two separate trees exist. (a) `curriculum_nodes` / `curriculum_tp_descriptors` = DSKP (loaded by `npm run dskp:load -w @pp/api`; UAT has 0 nodes until it runs, so tagging, blueprints and Jana Kertas cannot work there; the loader "does not touch chapters, topics, subtopics", `dskp-loader.md` lines 3, 13). (b) M03 chapters/topics/subtopics = the pupil-facing Bab tree (686 T4/T5 chapters on UAT) read by Soalan by Chapter, Peta Belajar, Heatmap Topik Lemah, Analisa Item.
- The link from a question to (b) is `question_versions.chapter_id` set by the admin (D89); the link to (a) is the DSKP tag. Neither is derived from the other (D89: "Not derived from DSKP; no data invented"). Real papers show Bab does not equal SK (10 Bab per form against 12 / 11 SK, exam schema D9).
- Consequence: after the DSKP load a question can be DSKP-complete and still have no Bab, and the reverse. The admin sets both: DSKP in the Tag step, Bab in the same step (C-05).
- R1 requirement (optional convenience, OQ-C1): an admin-maintained lookup Bab -> Unit (exam schema D9 "lookup Bab -> SK maintained by Admin") so the Tag step pre-filters units after the admin picks a Bab. It is a suggestion only; the admin still confirms.

#### 4.G.4 Paper structure follows the blueprint and the trial papers
Blueprint format (`docs/reference/blueprints/README.md`): `{code, sections:[{position, quota, kbatMarks?, marksBand?, notes}], kbatMarksTotal?}`; status per file: 1449-1 INCOMPLETE (Q13 KBAT unreadable), 1449-2 A,B complete / C INCOMPLETE, 3472-1 complete (single body), 3472-2 complete, 4531-2 A INCOMPLETE / B,C complete, 1249-2 A complete / B INCOMPLETE. Conflict O-1/O-3 open (README "Known conflict").
| Paper | Sections and rules (SPM-paper-patterns section 4) |
|---|---|
| Matematik K1 1449/1 | 1 jam 30 min; 40 MCQ, jawab semua, 1 mark each |
| Matematik K2 1449/2 | 2 jam 30 min; A Q1-10 (40) semua; B Q11-15 (45) semua; C Q16-17 (2 x 15) jawab satu |
| Matematik Tambahan K1 3472/1 | 2 jam; A Q1-12 [64] semua; B Q13-15 (3 x 8) jawab dua |
| Matematik Tambahan K2 3472/2 | 2 jam 30 min; A Q1-7 [50] semua; B Q8-11 (4 x 10) jawab tiga; C Q12-15 (4 x 10) jawab dua |
| Fizik K2 4531/2 | 2 jam 30 min; A Q1-8 [60] semua; B Q9-10 jawab satu [20]; C Q11 [20] (compulsory inferred) |
| Sejarah K2 1249/2 | 1 jam 30 min; A Q1-4 (4 x 10) semua; B Q5-9 (5 x 20) jawab tiga |
Other papers (Geografi, Sains Komputer, BM, BI, Sains, Sejarah K1, Fizik K1, Matematik Tambahan) have patterns in SPM-paper-patterns but no layer-2 blueprint JSON yet; their Kontrak stays Spec/Draf until evidence is added (D95).
- Entry rule: when the admin picks a paper (Subjek + Kertas), the Kertas / Bahagian selectors are filled from the contract (label, rule `all` or `choose n`, question count, `mark_budget`, `allowed_modes`, `compulsory`), so a question is entered into a real slot (exam schema D5).
- Stimuli by paper type (exam schema D6, trial papers): Matematik/Fizik/Sains K2 use a Rajah shared by consecutive questions; Sejarah uses a source per (c) part (part-level stimulus); BI Parts 1-5 use passages and a shared lettered option bank (Part 4 six gaps bank A-H; Part 5 four items bank A-F; type `match`); BM Rumusan/Pemahaman use a passage; Geografi uses maps and tables. All are stimulus groups (D90), never questions.

#### 4.G.5 Corrected manual entry, step by step (supersedes V2 Studio create for the same screens)
Stimulus grouping is the central rule (QE-01/02).
1. Admin opens `Bank Soalan (Studio)` and presses `Cipta baharu`; chooses `Soalan tunggal` or `Kumpulan rangsangan`.
2. Tag & pengelasan (DSKP): Subjek -> Tingkatan -> Unit -> SP (1-3; the page shows each SP's text and the unit's TP descriptors 1-6) -> TP (1-6) -> KBAT (optional) -> Bab (required to publish, D-A5; separate from the DSKP unit) -> Tahap kesukaran (1-5, required, separate from TP, D-A6) -> Topik (optional). Pickers only list `curriculum_nodes` of the subject and Tingkatan; if the list is empty the page says so [PROPOSED "DSKP belum dimuatkan untuk subjek ini."] and links to Kurikulum > DSKP (C-04).
3. Kertas & Bahagian: Kertas (optional unless SPM-bound), Bahagian (from the contract), Nombor soalan (printed label).
4. Rangsangan: for a group, enter the stimulus once (Jenis rangsangan, Kapsyen, editor). The group page keeps it and offers `Tambah soalan`; each next question reuses it. For a single question that has its own stimulus, the stimulus is created and becomes a 1-member group.
5. Jenis soalan: choose one of the 8 types (D1); the wizard builds the part tree template (MCQ = one leaf; `match` = N leaves sharing the group's option bank; `structured` = 2-10 leaves or nested (a)(i)).
6. Each leaf: prompt, mode, marks, key of the right kind (D3), scheme (D4: K/N/P codes, `@`, `//`, `atau setara`, accepted values, unit and tolerance for numeric), TP, aras pemikiran.
7. The completeness panel (QE-04) lists every missing DSKP/structure field live.
8. `Simpan draf` -> `Hantar untuk semakan` -> `Terbitkan`; the gate runs only at Terbitkan; the 422 lists the same items.
9. After Terbitkan the "Dilihat murid di" lines say where the question and its group are served and why not.
- AC-ADM-G5.1 Given the subject Fizik and Tingkatan 5, then the Unit picker lists only Fizik T5 learning areas and an SP outside the chosen Unit cannot be selected.
- AC-ADM-G5.2 Given a group "Rajah 3" with questions 5-8 entered by this flow, then one stimulus and four member questions exist and a pupil sees Rajah 3 once above them.
- AC-ADM-G5.3 Given Fizik K2 Bahagian B (jawab satu), when the admin picks Bahagian B, then the rule "Jawab satu" and the mark budget come from the contract and cannot be contradicted by the question.

#### 4.G.6 Corrected upload and extraction, step by step
1. `Muat Naik Kertas`: choose Subjek, Tingkatan, Kertas, Tahun, Negeri/badan, Jenis, Set, Kod kertas, and the D99 declaration; upload paper PDF (+ skema PDF).
2. The system reads the text layer, else OCR (Tesseract msa+eng); renders pages; detects Bahagian headers, printed numbers, "Jawab semua / jawab N" rules, option banks and stimuli (Rajah/Jadual/Petikan).
3. Extraction output = structure, not a flat list: Paper -> Bahagian -> questions -> parts, plus stimulus groups ("Rajah 3 -> soalan 5-8"), skema attached by number. Kertas and Bahagian from step 1 are copied to every item.
4. DSKP pre-fill: unit, SP, TP, KBAT per part with confidence bands from the DSKP descriptors (D80 US-41/42); nothing is accepted automatically.
5. Semak Ekstrak: the admin reviews a group header first (range adjust, detach, attach), then each item: stem, options, key, scheme, tags; corrects; `Terima (A)` / `Tolak (R)` / `Simpan Sunting (E)`.
6. Terima creates draft questions inside their groups with every tag already filled; unfilled DSKP fields show in the panel; the admin completes them in the same screen (no 422 at the end).
7. `Hantar untuk semakan` (batch) then `Terbitkan` per question or per paper from `Semak & Terbit`; a paper's questions must be Approved.
8. If extraction fails, the batch shows the reason and `Cuba lagi`; the admin may fall back to `Tulis Soalan Manual` with the same fields.
- AC-ADM-G6.1 Given the sample `Set1-MATEMATIK_K2_JOHOR-2025` PDF (Evidence E-12 for the real run), then the batch shows sections A/B/C with 10/5/2 questions and rules semua/semua/jawab satu from the contract.
- AC-ADM-G6.2 Given a Sejarah source printed with a (c) part, then the source is a part-level stimulus, not a question.
- AC-ADM-G6.3 Given BI P1 Part 4 (six gaps, one lettered bank A-H), then the bank is stored once in the group and six `match_letter` leaves reference it.

#### 4.G.7 Live defect on UAT: stimulus-less published questions (new evidence, 2026-11-04) | P0 data task U-OP-05
Observed in a visible browser: Studio question "Rajah 14 menunjukkan dua tin yang sama saiz berayun…" (Sains T4, id 812791) is Diterbitkan with no diagram attached; its stem is shown twice (once as title, again as "(1) …"); rows "Rajah 11…", "Rajah 9…", "Rajah 7…" are the same. They are served to pupils in Latih Tubi.
- FR-ADM-G7.1 Detection rule (server, pure, same code as `figure-links.ts`): a question whose stem, option or part prompt names a Rajah/Jadual/Graf/Petikan/Peta/Carta (keywords in QE-05.3) and has no stimulus, no group and no image is flagged `stimulus_missing`.
- FR-ADM-G7.2 Duplicate-stem detection: a question whose stem text equals (after trimming and normalising) the prompt of its only leaf is flagged `stem_duplicated`; the display shows the text once.
- FR-ADM-G7.3 A question flagged `stimulus_missing` or `figure_only` is excluded from every pupil surface (Latih Tubi, Databank, Soalan by Chapter, Kuiz, games, papers) with servability reason [PROPOSED] "Rangsangan tiada — soalan merujuk Rajah 14 tetapi tiada gambar." This is a servability reason, not a status change, so the question is not archived and need not pass the DSKP gate again when fixed (D80 DEC-2). A `stem_duplicated` question is **not** excluded: it is complete and answerable, so the text is shown once (FR-ADM-G7.2, AC-ADM-G7.3) and the data is cleaned (FR-ADM-G7.6, DM-40). Decided by principle 2026-11-04 (OD-3, OQ-API-19): excluding it would remove good content, and fixing a display rule is smaller than losing the question.
- FR-ADM-G7.4 The flag clears automatically when a stimulus/group is attached (QE-08) or when the admin marks "Bukan masalah".
- FR-ADM-G7.5 The regroup work-list (QE-08) is pre-filtered by these flags and shows counts per subject and Tingkatan; `Perhatian` on the hub lane Latih Tubi shows the same count.
- FR-ADM-G7.6 A one-off clean-up migration trims the duplicated leaf prompt where it equals the stem (data task, no content invented).
- AC-ADM-G7.1 Given question 812791 (no diagram), when the detector runs, then it is flagged, Studio shows "Dilihat murid di" Latih Tubi = Tidak boleh dilihat with the reason above, and the T4 pupil's Latih Tubi Sains never draws it.
- AC-ADM-G7.2 (E2E) Given the admin attaches the real Rajah 14 and regroups, then the flag clears and the pupil can draw the question with the diagram displayed once.
- AC-ADM-G7.3 Given a flat question whose prompt equals its stem, then Studio preview and the pupil view show the text once.
- Root cause (to be confirmed, Evidence E-13): the migration kept the V1/V2 body ("Rajah 14 menunjukkan...") but not the image (D80 Q-03 no image copy) and no group existed in V1/V2 (oldsystem findings A); the served-question rule only checks that a question has no linked image or stimulus, so it cannot tell that the text itself refers to a figure that is missing (the D92(1) text-only restriction no longer applies after D105, which makes this defect visible to pupils in drills).

### 4.V Screen register: V2 reference, Action and current V3 gap

Rule (FR-X1-5): close, fix and improve the existing V3 only; never rebuild. Action values: **Keep** (V3 already matches; verify only), **Fix** (the screen exists, it is wrong or incomplete), **Complete** (the screen exists, a defined part is missing), **Build** (no screen or no real backend behind it today; adds the missing piece, rebuilds nothing). The V2 screens are described in the "Screen specification (from V2)" subsection of each screen; nobody opens V1 or V2.
V2 entry structure never overrides FR-X1-4, D90 and D105: where V2 differs for that reason the row says "V2 differs ... PRD follows D90/D105".

#### 4.V.1 Evidence closed or narrowed by the screens
| Evidence | Result | Source |
|---|---|---|
| E-01 hub attention values | CLOSED. V2 production hub: `Databank Soalan` 449,503 "Semua elok"; `Tracking A` 60 "20 set tidak lengkap"; `Subjektif` 4,061 "2,428 tiada skema — tidak disajikan"; `Bijak SPM` 175 "Semua elok"; `Kertas Subjektif` "Flag OFF" 254 "Semua elok"; `Latih Tubi` "Flag OFF" 449,503 "Semua elok". Each card = big number (items in the lane) + attention text; buttons `Buka senarai`. Intro text "Setiap kad di bawah ialah satu laluan yang pelajar boleh buka. Nombor merah menunjukkan berapa banyak item yang perlu diperiksa." | `/admin/spm`, Panel `/spm` |
| E-02 Panel tiles | CLOSED. `Papan Pemuka`: `Pelajar` 6,162 "Jumlah pelajar berdaftar", `Guru` 784 "Jumlah guru berdaftar", `Sekolah` 10,207 "Jumlah sekolah berdaftar". `Analitik` ("Angka keseluruhan platform."): `Sekolah` 10,207 "9 langganan aktif"; `Pelajar Aktif` 19 "daripada 6,162 pelajar berdaftar"; `Soalan Dijawab` 7,587 "0 hari ini · 0 minggu ini"; `Ketepatan` 73.0% "purata jawapan betul, semua masa"; `Trend Mingguan` "7 hari lepas"; `Sekolah Teratas` (`Sekolah`, `Soalan Dijawab`); `Pelajar Teratas Minggu Ini` (`Pelajar`, `Dijawab`, `Betul`); `Mood Pelajar` ("😄 Gembira", "🙂 Okay", "😔 Sedih", "😣 Tertekan" with counts); `Laporan Soalan` "Baru · 0", "Selesai · 0" | Panel `/` and `/analitik` |
| E-09 Laporan Eksekutif | CLOSED. Heading "Laporan prestasi keseluruhan platform PRESTASIPLUS", "Ringkasan Eksekutif 2026"; tiles `Jumlah Sekolah` (note "4 sekolah aktif"), `Pelajar Berdaftar` ("147 aktif"), `Kadar Penglibatan` ("daripada pelajar daftar"), `Soalan Dijawab` ("sepanjang 2026"), `Ketepatan` ("purata jawapan betul"), `Guru` ("berdaftar"), `Soalan / Pelajar Aktif` | `/admin/laporan-eksekutif` |
| E-17 Studio vocabulary | CLOSED. V2 Studio statuses `Draft`, `Reviewed`, `Approved`, `Archived`; row source badge "Import (PDF/DOCX)"; row actions `Pratonton`, `Edit`, (Panel adds `Sembunyikan`); header `Import DOCX (ZIP)`, `Import BI Kertas 1`, `Cipta baharu`, link "Bank lama (legasi) →"; subtitle "Bank kanonikal (pokok peperiksaan v2.1). Soalan model lama masih di bank legasi." | `/admin/studio`, Panel `/studio` |
| E-18 Tetapan fields | CLOSED. V2 `Tetapan` sections: `Logo Laman Web`; `Had Percubaan & Soalan` (`Soalan Biasa (Trial)`, `PKSK (Trial)`, `Had Soalan/Bulan (Biasa)`, `Had Soalan/Bulan (Sekolah Basic)`, `Had Subjek Pilihan`); `Harga Pakej`; `Payment Gateway` (ToyyibPay, BizAppay, `API Key`, `Category Code`, `Gateway Aktif`); `Target SPM (Override)` per subject; `Harga Pakej Mengikut Tahap`; button `Simpan Tetapan`. There is NO support-contact field | `/admin/settings` |
| E-14 Phase-2 forms | PARTLY CLOSED. Captured: Kawalan Reward fields (`Bajet tebus / sesi` RM3.00, `Syiling flat / soalan betul`, `Tahun sesi semasa`, `Mini-games beri syiling?` "Tidak (XP sahaja)"; table `Hadiah`, `Kategori`, `Harga Token`, `Kos Sebenar`, `Status`; section "Cabutan Bertuah" `#`, `Tajuk`, `Status`, `Harga Tiket`, `Pemenang`), Hadiah catalogue, Permainan, Marketplace Penjual list, Notifikasi list. NOT captured: Rujuk Kawan settings, the `Beri Syiling` form, the redemption `Hantar kod` form, Cabutan create form, Kotak Misteri, Tournament, `/admin/marketplace/sellers/{id}`, `admin/parent-links` | `/admin/reward-control`, `/admin/hadiah`, `/admin/permainan`, `/admin/marketplace/sellers`, `/admin/notifications` |
| E-06 import quota | PARTLY CLOSED. V2 import page shows "1405 akaun menunggu kelulusan — belum boleh log masuk." with link `Semak & luluskan`, buttons `Muat Turun CSV Pelajar`, `Tutorial`. The quota panel appears only after a school is picked (state not captured) | `/admin/import-students` |
| E-07 Tracking A kind | CLOSED. V2 sets are legacy sets (`#1 · ramalan · 8 soalan`, "Hanya 8 daripada 40 soalan — 28471 tersedia untuk diisi"); 2025 sets for Fizik, Kimia, Geografi, Ekonomi, Prinsip Perakaunan have 40 soalan and "—" | Panel `/spm/tracking-a` |
| E-20 ticket reply | PARTLY CLOSED. List only: "Tiket Sokongan", "Permohonan bantuan daripada pengguna.", chip "Semua (3)", "dibuka (3)", columns `Tarikh`, `Pengguna`, `Subjek`, `Status`, `Dibalas`. A ticket detail or reply state is missing | `/admin/tiket` |
Still OPEN (page or state missing): E-03 (UAT database, not a screen), E-04 (no admin class page in the capture; needed: V2 `/admin/schools/{id}` detail with classes or a class list), E-05 (V2 has no upload; D81 flow is new; needed only the Kertas Subjektif OCR bake-off), E-08 (UAT data), E-10 (Panduan source, student side), E-11, E-12, E-13 (UAT data), E-15 (UAT data), E-16 (T1-T3 DSKP PDFs), E-19 (`/maklum-balas` is not in any capture folder; needed: the form state), E-21 (needed: `/admin/studio/imports/{batch}/review`), E-22 (needed: Filament `/admin-filament/videos`), E-23 (needed: any V2 central view of PM-12/13/15/21/22/23/24/27/28), E-24 (needed: `/admin/users/{id}/edit` of a parent record). Counts: 5 closed, 4 partly closed, 15 open (24 items).

#### 4.V.2 Register (73 screens and 8 entry-standard blocks)
Current gap cites V3 files; "V2 differs" lists contradictions found in the screens.
| ID | Action | V2 reference | Current gap (V3) | V2 differs / contradiction and decision |
|---|---|---|---|---|
| QE-01 | Complete | `/admin/studio/questions/{id}/preview`, `/admin/studio/sets/{id}/builder` | group API exists (`questions/http/stimuli.controller.ts:57-174`); no E2E; migrated rows ungrouped | V2 shows "Peta 2 menunjukkan..." as its own bank card without the map: PRD follows D90/D105 |
| QE-02 | Complete | `/admin/studio/questions/create` | `/admin/studio/groups/:id` (`m04 routes/studio.ts:31-35`); D93 blocker text "...sekurang-kurangnya 2 soalan." in contract | V2 has tabs Kertas/Rangsangan/Sub-bahagian/Tag, no groups: PRD follows D90/D93/D108(1) |
| QE-03 | Fix | `/admin/studio/questions/create` | wizard order and 13 modes; `m04/pages` StudioEdit; gate `dskp-gate.ts:18-24,58-65`; no separate TP and difficulty fields, "Unit (Bab)" wording replaced by "Tajuk DSKP", Bab not collected (FR-ADM-QE3.1, QE3.7, AC-QE3.3) | V2 first step is "Kertas & bahagian" with a Kertas picker listing 100+ papers, including test papers: V3 filters the picker by Subjek, Tahun, Negeri (D9) |
| QE-04 | Fix | `/admin/studio/questions/create` | "n belum lengkap" without names (E2E F1); `lifecycle.controller.ts:32` gate-check exists; gate now also requires Bab and difficulty (FR-ADM-QE4.5, AC-QE4.3) | none visible |
| QE-05 | Complete | `/admin/studio`, `/admin/studio/imports` | paper chosen at upload not carried (`intake/workflow/to-question.ts`); worker off (`jobs.config.ts:15,33`), OCR none (`ocr.config.ts:38`) | V2 imports DOCX/BI only: PRD follows PDF (D52) |
| QE-06 | Build | `/admin/questions/import` | CSV has no DSKP columns, no `bab_kod`, no difficulty (`m04 routes/imports.ts`, `questions/workflow/imports/imports.controller.ts:43-65`; FR-ADM-QE6.1) | V2 CSV columns `body, option_a-d, correct, [difficulty]` |
| QE-07 | Complete | `/admin/studio/sets/{id}/builder` | builder group-aware (`exam/builder/paper-check.ts`); Jana set unverified | V2 bank lists single questions: PRD follows D90 |
| QE-08 | Build | none | no list; 812791 etc. on UAT | V2 rows 14/13/7/6 of `admin_studio` have no stem: same defect |
| Q-01 | Fix | `/admin/spm`; Panel `/spm` | 3 routes `routes/admin-kandungan.ts:13-29`, 2 cards `admin/kandungan/lanes.ts` | V2 card = lane count + attention text; "Flag OFF" tags on Kertas Subjektif and Latih Tubi: PRD removes flags (D104) |
| Q-02 | Complete | `/admin/spm/databank`, `/admin/spm/tracking-a`; Panel `/spm/*` | only `LaneDatabankPage.vue`, `LaneSimulasiPage.vue`; no Tracking A/Subjektif/Latih Tubi/Kertas Subjektif lanes | Tracking A `Perhatian` copy: "Hanya 8 daripada 40 soalan — 28471 tersedia untuk diisi" counts raw questions, not groups: PRD follows D90 |
| Q-03 | Fix | `/admin/studio`; Panel `/studio` | 3 lists (`menu.ts:95,103,116`); "0/6" unexplained (`StudioListPage.vue:489`); no work-list `Soalan tanpa Bab` (FR-ADM-Q03.7) | V2 filters Subjek, Status, Tahun, Negeri (+ MRSM, SBP, SABK, SMKA, SPM(U), PPD), Kertas 1-3, Jenis (Percubaan, Sebenar, Modul); count "5,704 soalan"; V3 adds Tingkatan, Bab, DSKP filters |
| Q-04 | Fix | `/admin/studio/questions/create`, `.../{id}/edit`, `.../{id}/preview`; Panel `/spm/soalan/{id}/sunting` | no Bab-first tag step, missing-field list; `ChapterSelect.vue:70` exists | V2 preview header "Pratonton — Draft." "Soalan ini belum diterbitkan; pelajar tidak dapat melihatnya lagi." "Kembali ke Studio"; "0 patah perkataan" counters per part; edit status bar `Status`, `Draft`, "Belum dipapar kepada pelajar.", `Pratonton`, `Hantar untuk semakan`, `Arkib`; source line "Sumber soalan: Import (PDF/DOCX)"; draft banner "Terdapat kerja yang belum disimpan daripada sesi sebelum ini." `Pulihkan`/`Buang`. Keep these |
| Q-05 | Complete | none | page exists, E2E unproven | V2 has no group screen: PRD follows D90 |
| Q-06 | Complete | `/admin/spm`; Panel `/spm` | "0/6" for all rows; seven-value enum of API-Q-11 and `chapter_missing` reason (FR-ADM-Q06.1, Q06.4) | V2 shows only hub attention |
| Q-07 | Fix | `/admin/studio/imports` | list = `IntakeListPage.vue`; tabs `Kertas Diimport`, `Kiriman Guru` missing; batch stuck; no batch-to-paper step (FR-ADM-Q07.6..Q07.9, `POST /api/intake/batches/:id/paper`) | V2 tab names confirmed `Kelompok Item`, `Kertas Diimport`, `Kiriman Guru`; columns `Fail Sumber`, `Subjek`, `Bilangan Soalan`, `Disemak`, `Status`; 20 per page ("Showing 1 to 20 of 43 results") |
| Q-08 | Fix | `/admin/studio` | form works, extraction fails | V2 modal texts as in the reference (DOCX ZIP, BI Kertas 1: `Fail soalan (DOCX) *`, `Fail skema jawapan (DOCX) — pilihan`, `Tajuk kertas — pilihan`); V3 uses PDF |
| Q-09 | Fix | none (E-21) | `IntakeReviewPage.vue`; manual Terima rejects free-text SP | n/a |
| Q-10 | Fix | `/admin/studio/questions/create` | batch shows 0 questions after Terima | n/a |
| Q-11 | Fix | `/admin/questions/import` | no DSKP columns; success banner stays on error | n/a |
| Q-12 | Build | `/admin/question-submissions` | `m04 routes/submissions.ts:11-22`; `lib/submissions-unavailable.ts:7`; `question-sets.ports.ts:46-63`; `POST /api/guru/question-papers` 503 | V2 labels confirmed: "Kertas Soalan Guru"; intro "Kertas yang dihantar guru diproses melalui aliran import Studio (DOCX/OCR → semakan → terbit)."; tiles `Jumlah`, `Pending`, `Processing`, `Selesai`; filter `Semua Status` (Pending, Processing, Selesai, Ditolak), `Tapis`; columns `Guru / Sekolah`, `Tajuk`, `Fail`, `Status`, `Tarikh`; empty "Tiada kertas soalan dihantar oleh guru lagi." Update 2026-11-04: FR-ADM-Q12.6: teacher submissions arrive as `source=guru` intake batches; the admin completes DSKP fields in review. |
| Q-13 | Fix | `/admin/studio/sets` | two lists (`PaperListPage.vue`); Jana set lacks Tahun/Negeri/Bilangan | V2 `Subjek` list holds 31 subjects; V2 landing title "Bank soalan" / "Bina set soalan" |
| Q-14 | Fix | `/admin/studio/sets/{id}/builder` | no Pilih N control (`SetBuilderPage.vue`) | V2 builder header "Jumlah markah keseluruhan: 40 markah", `← Kembali`, `Terbitkan`, `Menerbitkan…`; bank filters `Tahun`, `Negeri` ("19 pilihan"), "100 soalan (dipaparkan 150 pertama)"; Bahagian "1 markah setiap satu" "Sumber: Kertas 1 · 2025"; each card "1 markah · Kertas 1 · 2025" + `Tambah`. Group members shown as separate cards: PRD follows D90 |
| Q-15 | Fix | Panel `/spm/simulasi-paper/{id}/review` | duplicate of Q-13; exception always needed | as DISC 3.4 |
| Q-16 | Fix | Panel `/spm/kontrak` | Disahkan not selectable (`kontrak/domain/form.ts:65,251`); 0 contracts on UAT | V2: 36 kontrak; banner "Kontrak dikongsi. Setiap kontrak di bawah ialah peraturan bagi satu subjek × kertas — bukan satu set soalan. Menyunting kontrak ini mengubah pintu terbitan (publish gate) untuk SEMUA kertas subjek tersebut, bukan hanya satu kertas."; card header "{Subjek} Kertas {n}" + badge `Spec` / "Draf — sahkan dengan LPM"; fields `Kod Kertas`, `Tempoh (minit)`, `Jumlah Markah`, `Sumber` (Draf, Spec, Disahkan), `Boleh tanda auto`, `Nota`; Bahagian `Label`, `Peraturan Pilihan` (Tiada, Jawab Semua, Pilih N), `Markah`, `Arahan (opsyenal)`, `Mod Jawapan Dijangka` (13 V2 modes incl. numbered list, essay choice, sequence order, code, gapped text match, cloze); empty "Tiada Bahagian lagi."; `Simpan`, `Padam kontrak`. V2 differs: 13 modes vs the 8 types (exam schema D1): PRD follows D1; `Sumber` Disahkan selectable in V2 vs verified flow (D76(4)): PRD follows D76 |
| Q-17 | Build | Panel `/spm/tracking-a`, `/spm/tracking-a/{id}/sunting`; `/admin/spm/tracking-a` | route 404; `spm_tracking_sets` seed only | V2 list: heading "Tracking A", "Set objektif penuh dan lane bahasa. · 60 item", filters `Subjek`, `Tapis`, `Set Semula`; columns `Tajuk`, `Status`, `Perhatian`, `Tindakan`; row "Bahasa Melayu · 2026 Set 1" "#1 · ramalan · 8 soalan" `Sunting`; 3 pages. Editor title "{Subjek} · 2026 · Set 1", `Isi set` "32 soalan lagi diperlukan.", "Soalan tersedia untuk Bahasa Melayu: 28,471", pane `Sunting Soalan` "Pilih soalan untuk menyunting.", keyboard drag help "To pick up a draggable item, press the space bar." V2 counts raw questions: PRD follows D90 |
| Q-18 | Build | `/admin/kertas-subjektif`; Panel `/spm/kertas` | 404 | V2 main page tiles `Jumlah Kertas` 254, `Diterbitkan` 254, `Ada Skema` 135; Panel list `Senarai Kertas` "254 kertas", `Baharu`; columns `Tajuk`, `Subjek`, `Kertas` (2, 3, 4), `Negeri`, `Tahun`, `Halaman` ("9 (+6 skema)"), `Status` (Terbit), `Tindakan` (`Sunting`, `Halaman`, `Sembunyikan`, `Padam`). V2 stores page images: PRD follows D81 (text, not pages) and D104 (no flag) |
| Q-19 | Build | `/admin/source-papers`, `/admin/source-papers/{id}` | none | as in the reference code |
| Q-20 | Fix | `/admin/questions` | duplicate label; `luluskan` gate | V2 page has tabs `Senarai`, `Kualiti`, `Laporan`; banner "Ini bank soalan lama (model flat). Soalan baharu dicipta dan diterbitkan di bank kanonikal."; link `Bank Soalan (Studio)`; buttons `Tambah Soalan`/`Tambah`, `Import CSV`/`Import`, `Arkib Semua`/`Arkib`; "Ringkasan Bank Soalan" "Jumlah: 451,518 soalan" with per-subject "{n}" and "{m} lulus" |
| Q-21 | Fix | `/admin/questions/quality` | separate menu item | V2: title "Dashboard Kualiti Soalan"; tiles `Jumlah Soalan` 451,518, `Disahkan (Verified/AI)` 0%, `Bertag DSKP` 90 (0%), `Perlu Semakan` 902,797 (greater than the total: V2 contradiction; V3 computes a count that cannot exceed the total); classes `Verified` ("Disahkan penuh terhadap sumber."), `AI Verified` ("Disahkan oleh semakan AI."), `Pending Mapping` ("Menunggu pemetaan kurikulum."), `Belum Diklasifikasi` |
| Q-22 | Fix | `/admin/question-reports` | row action unverified (`m04 routes/reports.ts:14-23`) | V2: heading "Laporan Soalan", "Soalan yang dilaporkan oleh pelajar dari kuiz, latihan & Papan Bijak", chips "Menunggu (0)", "Selesai (0)", "Semua (0)", empty "Tiada laporan soalan untuk status ini." |
| Q-23 | Complete | `/admin/structured-questions`, `/admin/structured-questions/{id}`; Panel `/spm/subjektif` | `m04 routes/structured.ts:12-35`, read-only `structured.controller.ts:15,24`, no menu | V2: "Semua soalan berstruktur SPM dalam sistem", 4,061 `Jumlah Soalan` / `Diluluskan`, "Agihan Mengikut Subjek"; lane attention "2,428 tiada skema — tidak disajikan" |
| Q-24 | Keep | Panel `/spm/soalan/{id}/sunting`, `/spm/soalan/{id}/pratonton` | `routes/admin-papers.ts:50-59` | n/a |
| C-01 | Complete | `/admin/curriculum` | `m03 routes/admin-curriculum.ts`; no per-Bab question count; no DSKP tab | V2 page opens with "Tapis Kurikulum" and `Subjek` "-- Pilih Subjek --" |
| C-02 | Keep | `/admin/subjects`, `/admin/subjects/create` | `m03 routes/admin-subjects-levels.ts:23-42` | V2 lists 31 subjects |
| C-03 | Fix | `/admin/education-levels` | UAT 11 levels active | V2: "Senarai Tahap Pendidikan", "Jumlah: 11 tahap"; columns `#`, `Nama (BM)`, `Nama (EN)`, `Kod`, `Peringkat` (Rendah), `Kurikulum` (KSSR), `Soalan` ("13,140 soalan"), `Subjek` ("19 subjek"), `Aktif?`; V3 lists Tingkatan only after D96 |
| C-04 | Build | none | loader `curriculum/dskp/*`; T4-T5 only | n/a |
| C-05 | Build | none | no bulk chapter action in `packages/contract/src/questions` | V2 has no Bab link |
| N-01 | Build | none (E-22) | no list page (`m09 routes/video.ts`) | n/a |
| N-02 | Keep | `/admin/articles` | `m09 routes/admin-articles-notes.ts:24-60` | n/a |
| N-03 | Fix | `/admin/banners` | `admin-media.ts:24-43`; edit does not preload types (V1 D-6) | as V1 M09 |
| N-04 | Fix | `/admin/notes` | `admin-articles-notes.ts:63-92`; filter and create defects (V1 D-1, D-7) | as V1 M09 |
| N-05 | Build | `/admin/permainan` | `games/rooms/admin/admin-games.controller.ts:10-22`; no page | V2 Papan Bijak: field "Bilangan Petak Soalan" (unit "petak"), "Maks 38 petak (48 available - 10 petak khas). Set 0 = tiada soalan.", "Pecahan Papan (50 petak)" with Petak soalan 35, Tangga+Ular 6, Bonus+Perangkap 4, Petak biasa 3, Mula+Tamat 2, "35 soalan", "10 khas", "3 biasa"; list `Senarai Permainan` "Permainan yang tersedia dalam sistem": `Papan Bijak` "Ular & tangga dengan soalan kuiz. Multiplayer 2-4 pemain." (Aktif, `Lihat`), `Kad Memori` "Padankan soalan dengan jawapan. 6 pasangan (12 kad)."; tiles 3 `Jumlah Bilik`, 0 `Sedang Aktif`, 0 `Selesai`, 1 `Pemain Unik` |
| N-06 | Build | `/admin/feature-toggles` | none | V2: "Semua ciri HIDUP secara lalai — item hanya tersembunyi apabila anda mematikannya."; groups `Pelajar` (19 flags) and `Guru` (10); state "Aktif" / "Off" (Zona Permainan = Off); V2 has no `latih-tubi` or `kertas-subjektif` switch (confirmed) |
| N-07 | Build | `/admin/settings` | none; `/api/config/support` 404 | V2 Tetapan has no support contact: this section is a V3 addition (FD-N07); pricing, payment and logo sections are not built (billing deferred) |
| U-01 | Fix | `/admin/users` | `m02 routes/users.ts:11` | as V1 M02 S1; remove `Login As` |
| U-02 | Fix | `/admin/users/create` | `m02 routes/user-form.ts:11` | V2 title "Tambah Pelajar": `Nama penuh *` ("Nama pengguna dijana automatik daripada nama ini dan dipaparkan selepas cipta."), `Sekolah *` (search "Cari kod sekolah atau nama daerah."), `Kelas`, `E-mel (pilihan)` ("Pelajar log masuk dengan sekolah + nama pengguna, jadi e-mel tidak wajib."), `Kata laluan` ("Biarkan kosong untuk guna kata laluan lalai •••••••• (minimum 8 aksara)."), `Cipta Pelajar`, `Batal`. V1 role form (Guru, Admin Sekolah via Janakan Akaun) is kept for the other roles; V3 pupil form follows V2 (no Darjah) and keeps V1 password minimum from V2 (8) Update 2026-11-04: FR-ADM-U02.4: password minimum 8 characters (create, reset, import). |
| U-03 | Fix | `/admin/users/{id}/edit` | `user-form.ts:28`; password minimum 8 on reset; grade/school/role changeable only by Admin Pusat / Admin Sekolah (FR-ADM-U03.4) | n/a |
| U-04 | Keep | `/admin/schools`, `/admin/schools/create`, `/admin/schools/{id}/edit`; Panel `/sekolah` | `schools.ts:13-42` | n/a |
| U-05 | Fix | `/admin/import-students` | `m02 routes/imports.ts`; Darjah offered; no approval queue; quota refuses the whole file over the seat limit (FR-ADM-U05.5) | V2 adds notice "1405 akaun menunggu kelulusan — belum boleh log masuk." + `Semak & luluskan`; notice "Import mencipta akaun pelajar baharu sahaja — akaun yang sudah ada tidak akan ditulis ganti atau dipadam. Format: nama,email dengan kolum kelas pilihan."; buttons `Muat Turun CSV Pelajar` (template link present, so V1 defect is gone), `Tutorial`; level list begins Darjah 1: hidden in V3 |
| U-06 | Complete | `/admin/users/bulk-import` | route exists, no menu; bulk path for teachers, password minimum 8 (FR-ADM-U06.2) | n/a |
| U-07 | Keep | `/admin/comp-students` | `comp-students.ts` | n/a |
| U-08 | Build | none (E-04) | classes only inside Command Center drill-down | n/a |
| U-09 | Keep | `/admin/school-subscriptions` | `subscriptions.ts:20-70` | n/a |
| M-01 | Build | `/admin`; Panel `/` (Papan Pemuka) | `m17/routes/dashboard.ts` empty; `core-routes.ts:84-88` | V2 tiles `Soalan Aktif` 408,353 ("Minggu ini: 0"), `Diluluskan` 408,197 ("Aktif digunakan"), `Menunggu Review` 0 ("Perlu tindakan"), `Draf` 155 ("Belum siap"), `Subjek` 31 ("31 Aktif"), `Tahap Pendidikan` 11 ("Darjah & Tingkatan"), `Pengguna` 7,026 ("6,162 Pelajar"), `Battle Arena` "796 Total · 0 Aktif · 796 Selesai", sponsor tiles (Jumlah Penaja, Menunggu Kelulusan, Ditolak, Digantung: not built). Panel Papan Pemuka has 3 tiles (E-02) |
| M-02 | Keep | `/admin/command-center` | built | n/a |
| M-03 | Fix | `/admin/monitoring` | `menu.ts:62` route `/guru/monitoring` | V2 title "Monitoring Penglibatan" |
| M-04 | Complete | `/admin/kirkpatrick`, `/learning`, `/results` | `m12-kirkpatrick/routes/student.ts:3-4` empty; `mount.ts:33` | V2 page starts with a school picker (`Sekolah` "Semua Sekolah", `Negeri`, "Cuba kod sekolah atau nama daerah.") |
| M-05 | Build | `/admin/analytics`; Panel `/analitik` | `m17/routes/analytics.ts` empty | V2 title "Analitik & Statistik"; Panel tiles in E-02 |
| M-06 | Build | `/admin/laporan` | `m17/routes/laporan.ts` empty | as reference |
| M-07 | Build | none (E-23) | school versions in M27/M18 | n/a |
| M-08 | Build | `/admin/laporan-eksekutif` | `m17/routes/laporan-eksekutif.ts` empty | tiles in E-09 |
| P2-01 | Build | `/admin/gamification` | `gamification/admin.controller.ts:26`; no page | V2 tiles `Pelajar Aktif` 3,172, `Syiling Dijana` 5,473,583, `Token Terkumpul` 21,729 (V1 label was "Token Ditukar"), `Penukaran` 158, `Cabaran Aktif` 15, `Siap Hari Ini` 0; `Taburan Tier` with "19 pelajar belum ditetapkan tier."; `Top 10 Pelajar` with level and syiling. V3 uses "Token Terkumpul" (V2) |
| P2-02 | Build | `/admin/gamification/tiers` | `admin.controller.ts:31-48` | as V1 M14 S2 |
| P2-03 | Build | `/admin/gamification/challenges` | `admin.controller.ts:55-79` | as V1 M14 S3 |
| P2-04 | Build | `/admin/gamification/students` | `admin.controller.ts:85-91` | as V1 M14 S4 |
| P2-05 | Build | `/admin/gamification/transactions` | `admin.controller.ts:99` | as V1 M14 S5 |
| P2-06 | Build | none (E-14) | `admin.controller.ts:105-110` | n/a |
| P2-07 | Build | `/admin/hadiah` | `shop/admin.controller.ts:24-66`; no page | V2 title "🎁 Kedai Hadiah Digital"; tiles `Total Hadiah` 50, `Aktif` 50, `Tebusan Bulan Ini` 0, `Pending Proses` 7; category chips `Semua`, ecommerce, ewallet, fnb, gaming, learning, streaming, telco (lower-case keys in V2: V3 shows the BM labels of V1 M15: "E-Commerce", "E-Wallet", "F&B", "Gaming", "Pembelajaran", "Streaming", "Telco"); section "Katalog Hadiah" columns `Hadiah`, `Kategori`, `RM`, `Token`, `Stok`, `Tebusan`, `Status`, pager "1–25 daripada 50" (25 per page) |
| P2-08 | Build | `/admin/hadiah` | `shop/admin.controller.ts:36-48` | V2 puts "Tebusan Queue" (status `Pending`, date, reward e.g. "TnG eWallet RM5") on the same page as the catalogue "Katalog Hadiah" ("1–25 daripada 50"); PRD follows V2: queue section on `/admin/hadiah` |
| P2-09 | Build | `/admin/reward-control` | `admin.controller.ts:122-143`; `flatCoins` is an editable setting, default 1, read by the wallet credit (FR-ADM-P2-09.3) | V2 "🛡️ Kawalan Reward": `Liabiliti sesi 2026` RM50.00, `Pelajar Menebus` 6, `Jumlah Tebusan` 7; settings `Bajet tebus / sesi` RM3.00, `Syiling flat / soalan betul` 1, `Tahun sesi semasa` 2026, `Mini-games beri syiling?` "Tidak (XP sahaja)"; V1's `Sub-had tebus / bulan` is absent in V2: V3 shows only fields V2 shows |
| P2-10 | Build | `/admin/reward-control` | `admin.controller.ts:143` | V2 section "🎟️ Cabutan Bertuah" columns `#`, `Tajuk`, `Status`, `Harga Tiket`, `Pemenang` |
| P2-11 | Build | none (E-14) | `shop.controller.ts:50-55` | n/a |
| P2-12 | Build | `/admin/marketplace/products` | `marketplace.controller.ts:18-43` read-only | as V1 M20 S1-S3 |
| P2-13 | Build | `/admin/marketplace/sellers` | no admin API | V2 tiles `Jumlah Penjual` 1, `Aktif` 1, `Menunggu Pengesahan` 0 (global); filter `Semua Status` (Pending, Aktif, Digantung, Diharamkan), `Tapis`, "1 penjual dijumpai", card "JomBelajar Official" "Active" "10 produk" |
| P2-14 | Build | none (E-14) | `battle/tournaments/tournaments.controller.ts:31-57` | n/a |
| P2-15 | Build | `/admin/battle/ranking-sekolah`, `/admin/battle/leaderboard` | `battle/standings/standings.controller.ts:36-51` | n/a |
| P2-16 | Build | none (E-24) | BE per ADMIN-PUSAT row 40 | n/a |
| P2-17 | Keep | `/admin/audio-kbat` | `m09 routes/admin-media.ts:53-72` | n/a |
| P2-18 | Fix | `/admin/articles`, `/admin/banners`, `/admin/notes` | see N-02..N-04 | V2 pages also contain the V1 defects in the notes of M09 |
| P2-19 | Build | `/admin/feature-toggles` | none | as N-06 |
| P2-20 | Build | `/admin/tiket` | `support.controller.ts:75` read-only; single reply, no thread, reply does not change status (FR-ADM-P2-20.2, OD-4) | V2 list has 3 tickets, all "dibuka"; no reply UI in the capture (E-20) |

#### 4.V.3 Corrections found while reading the screens
- Tile reading rule for the captures: in the text files a number precedes its label (for example "50 Total Hadiah", "50 Aktif", "0 Tebusan Bulan Ini", "7 Pending Proses"). V2 has 50 of 50 rewards active; V1 had 0 of 59 active, so U-OP-13 activates whatever V3 seeds, not a V1 figure.
- Hub, Studio and Kontrak numbers are V2 production snapshots; V3 values come from V3 data, never copied.
- Studio create/edit in V2 lists test paper names ("Alip Elyzian Test", "For Elyzian Dev", "Test Soalan"): these are V2 test data and must not be migrated (U-OP-14 covers V3 test data).

#### 4.V.4 Action summary
| Group | Keep | Fix | Complete | Build | Screens |
|---|---|---|---|---|---|
| Q (Q-01..Q-24) | 1 | 15 | 4 | 4 | 24 |
| C (C-01..C-05) | 1 | 1 | 1 | 2 | 5 |
| N (N-01..N-07) | 1 | 2 | 0 | 4 | 7 |
| U (U-01..U-09) | 3 | 4 | 1 | 1 | 9 |
| M (M-01..M-08) | 1 | 1 | 1 | 5 | 8 |
| P2 (P2-01..P2-20) | 1 | 1 | 0 | 18 | 20 |
| **Total screens** | **8** | **24** | **7** | **34** | **73** |
| QE blocks (QE-01..QE-08) | 0 | 2 | 4 | 2 | 8 |

### 4.R Responsive behaviour of every admin screen (375 / 768 / 1280 px)

Reference: `docs/prd/r1/40-cross-cutting.md` section X6.1, FR-X6-1..11. All FR-X6 apply to every screen; this section adds the admin specifics. Breakpoints: phone 375 (also down to 320), tablet 768, desktop 1280. Common rules (FR-ADM-R0.1): no horizontal page scroll (FR-X6-1); body text >= 14 px on phone and no truncation of question text, options or labels (FR-X6-2); touch targets >= 44 x 44 px (FR-X6-3); forms one column with labels above and a sticky action bar that never covers the active field (FR-X6-5); tables become stacked cards or keep key columns with an inner scroll (FR-X6-4); admin touch screens use `Naik` / `Turun` buttons in place of drag (D83 D-9); long text wraps and is never clipped (long maths scroll inside their own box).

#### 4.R.1 Question and paper screens (most detail; user reported these as bad)
**Studio list (Q-03).** 1280: table with all columns. 768: columns `No.`, `Soalan`, `Status`, `Dilihat murid di`, row menu; filters in a collapsible bar. 375: each question is a card (number, status badge, stem up to 3 lines with `Lihat penuh`, kertas line, indicator chip), actions in a bottom sheet (`Pratonton`, `Edit`, `Arkib`); status tiles become a horizontally scrollable chip row inside its own container; bulk select shows a sticky bar "{n} dipilih" with `Tetapkan Bab` and status actions; pagination 25 per page keeps prev/next >= 44 px.
**Studio editor (Q-04) and stimulus group (Q-05).** 1280: left sticky tab nav (`Tag`, `Kertas`, `Rangsangan`, `Sub-bahagian`) + form + right preview pane ("Pratonton pelajar") side by side. 768: tab nav on top, form full width, preview behind a `Pratonton` tab/segment (not beside). 375: one step per screen with a stepper header (Langkah 1/4) and `Seterusnya` / `Kembali`; the save bar is sticky at the bottom with `Simpan draf` and the count "n belum lengkap" that opens the completeness panel as a bottom sheet; the keyboard never hides the active field or the bar (FR-X6-5). The stimulus: in the editor a "Rangsangan" chip opens it in a bottom sheet (< 1024 px) or a pinned left panel (>= 1024 px) so the admin sees the figure while writing member questions (D83 D-3); in the group screen the stimulus sits on top and members are a vertical list of cards each with `Naik`/`Turun`/`Buang`. Part tree: depth shown with indentation capped (2 levels of indent on phone, deeper levels collapsed with a "(i)" label); MCQ option rows are full width, 44 px tall; the mark-scheme editor lists K/N/P rows as cards with the code select above the text; the rich editor toolbar scrolls inside itself; maths in the editor scrolls inside its box.
**Studio preview (Pratonton).** Opens as a full-screen sheet on phone; shows the question as the pupil sees it with stimulus once above members; a width switch (375 / 768 / 1280) is offered on desktop for the admin to check.
**Intake review with the PDF pane (Q-09).** 1280: PDF pane left (about 45%), editor right, group headers above the list, item counter "Item {i} / {n}". 768: two stacked panes with a sticky switch `Sumber PDF` | `Editor` (tabs), the PDF page and the highlighted item region stay in sync when the admin switches; `Terima (A)` `Tolak (R)` `Simpan Sunting (E)` stay in a sticky bar under the active pane. 375: the same tabs, the PDF pane supports pinch-zoom and page `Sebelum` / next buttons, and the figure crop opens full-screen; the editor is one column; keyboard shortcuts (A, R, E) remain on desktop only and the buttons carry the same labels on touch. The group-range control is a bottom sheet listing the questions with checkboxes.
**Set Builder landing (Q-13).** 1280: `Mula kosong` form and `Jana set` card side by side + list. 768/375: stacked; the paper list becomes cards (title, subjek, kertas, status chip `Terbit`/`Draf`, count, `Buka`); the "Kolam soalan" aside moves under the Jana set card.
**Set Builder (Q-14) and paper editor (Q-15).** 1280: left "Bank Soalan" browser, right Bahagian columns (as V2). 768: the browser and the paper are two tabs `Bank Soalan` | `Dalam set`; `Tambah` adds to the destination Bahagian chosen in a sticky select; a toast "ditambah" confirms; the tab `Dalam set` shows a running "Jumlah markah" header. 375: the same tabs; each Bahagian is a collapsible card showing "{n} / {N} dipilih", rule select `Jawab Semua` / `Pilih N` as a full-width control, member questions as cards with `Naik` / `Turun` / `Sunting` / `Buang` (no drag); a group is one card "Rajah 3 · 4 soalan" that expands; the contract panel and blockers are a bottom sheet from a persistent `Terbitkan (n masalah)` button; `Terbitkan` is never hidden under the keyboard. Long question text wraps (3 lines + `Lihat penuh`).
**Paper preview / "Semak Kertas Simulasi" (Q-15).** Renders the cover (title, Tempoh, Jumlah Markah, Arahan) then sections, parts and marks as a single readable column on phone; sections collapse; section totals stay visible in a sticky header; a "Peta soalan" drawer (FR-X6-9) lists question numbers with state; figures fit the width and open full-screen on tap (FR-X6-7); rotation keeps the scroll position (FR-X6-10). The `Penerbitan` panel is the first block on phone (blockers visible without scrolling past all sections).
**Import & Semakan (Q-07), Muat Naik Kertas (Q-08).** Tabs scroll inside their bar; batch table becomes cards (`Fail Sumber`, `Subjek`, `Bilangan Soalan`, `Disemak`, `Status`, `Semak`); the upload form is one column with the D99 declaration visible above the submit button.
**Kontrak (Q-16).** 1280: list table; editor with the section table. 768: section table keeps `Label`, `Peraturan`, `Markah` with `Butiran` expanding a row; 375: each Bahagian is a card; quota/unit tables scroll inside their own box with a sticky first column; the Pengesahan tab (checks, evidence) is a vertical list; `Sahkan` sits in a sticky bar.
**Tracking A editor (Q-17).** 1280: member list left, "Sunting Soalan" pane right. 768/375: list and editor are tabs; `Isi set`, `tukar`, `buang` are full-width row buttons; `Simpan` sticky.
**Kertas Subjektif (Q-18).** Upload/OCR/sunting: the same two-pane to tab rule as intake (paper | skema as two tabs; source PDF | editor as two tabs).
**Hub (Q-01), lanes (Q-02).** Cards 3 columns at 1280, 2 at 768, 1 at 375; lane tables become cards at 375; filters collapse.

#### 4.R.2 Other screens (short form)
| Screen | 375 | 768 | 1280 |
|---|---|---|---|
| Senarai Soalan, Kualiti, Laporan (Q-20..22) | cards, tabs scroll in own bar, bulk bar sticky | key columns + row menu | full table |
| Soalan Berstruktur, Quick Edit (Q-23, Q-24) | one column; part list as cards | one column | two columns (text / options) |
| Sumber Kertas (Q-19) | cards | key columns | table |
| Kurikulum, Subjek, Tahap (C-01..03) | tree as accordion; counts inline | accordion | tree + detail pane |
| Tetapkan Bab (C-05) | bottom sheet with Bab select and dry-run line | dialog | dialog |
| Video, Artikel, Banner, Nota (N-01..04) | cards | table with fewer columns | table |
| Tetapan Permainan, Kawalan Ciri (N-05, N-06) | stacked switches (44 px) | 2 columns | 2 columns |
| Pengguna (U-01) | cards (name, role badge, school, active switch, row menu); V1 table of 1881 px is not reproduced (V1 defect D-1) | key columns, row menu | full table |
| Tambah/Edit Pengguna, Sekolah, Import (U-02..U-07) | one column; school search results as full-width list; the generator panel stacks | one column wide | two columns (form + notes) |
| Kelas, Langganan (U-08, U-09) | cards | table | table |
| Dashboard, Laporan, Analitik, Monitoring, Kirkpatrick, Command Center (M-01..M-08) | tiles 1-2 per row, charts full width, tables inside their own scroll, no clipped legends | 2-3 tiles | grid |

#### 4.R.3 Responsive acceptance criteria
- AC-ADM-R1 Given any admin screen of this PRD at 375, 768 and 1280 px, when it loads with data, then the document has no horizontal scroll and no text is clipped (FR-X6-1, FR-X6-2).
- AC-ADM-R2 Given Studio editor at 375 px, when the keyboard opens on a stem field, then the field and the save bar both stay visible (FR-X6-5).
- AC-ADM-R3 Given the stimulus group editor at 375 px, when the admin writes member question 2, then the stimulus opens in a bottom sheet in one tap and closes without losing text.
- AC-ADM-R4 Given Semak Ekstrak at 768 px, when the admin switches between `Sumber PDF` and `Editor`, then the page and item stay in sync and the action bar remains reachable.
- AC-ADM-R5 Given Semak Ekstrak at 375 px, then the PDF supports pinch-zoom and a figure crop opens full-screen (FR-X6-7).
- AC-ADM-R6 Given Set Builder at 375 px, when the admin adds a group from `Bank Soalan`, then it appears as one card in the chosen Bahagian, can be moved with `Naik`/`Turun` and no drag is needed.
- AC-ADM-R7 Given a paper preview at 375 px with a 40-question section, then the question map drawer lists all numbers with state and rotation to landscape keeps the position (FR-X6-9, FR-X6-10).
- AC-ADM-R8 Given Kontrak with 3 Bahagian and a quota table at 375 px, then the table scrolls inside its own box and the page does not.
- AC-ADM-R9 Given Studio list at 375 px with 25 rows, then each row is a card with the stem wrapped (max 3 lines + `Lihat penuh`) and all row actions reachable in <= 2 taps.
- AC-ADM-R10 Given every button, tab, checkbox and link in these screens on a touch device, then its target is >= 44 x 44 px (FR-X6-3).
- AC-ADM-R11 Given Pengguna at 375 px, then Edit, Aktif toggle and Padam are reachable (V1 hid them below 1280).

### 4.H Admin screens for the rest of the matrix (user decisions D100-D102, D106, 2026-11-04)

Scope rule: every module ticked in the matrix must be fully working, so the admin must be able to feed and manage it. Sections A to E cover the 1.0 columns. This section (ID prefix `P2`, not a delivery phase) covers Murid A4 (Tiket Bantuan, also ticked for Guru and Admin Sekolah) and rows 16 to 40 except 15 (Mohon Keluarga Angkat) and 37 (Cikgu Alesa). Delivery order (D106): 1.0 columns first, then these screens; a screen a 1.0 page links to ships with the first delivery. Same template; priority P1 unless stated. **No placeholders in any screen** (FR-ADM-H0): no "akan datang", no "belum tersedia dalam demo", no mock-only path, no screen whose backend is absent. Where a backend is missing, this PRD lists it as required work. Labels come from V1 discovery docs (M14, M15, M16, M20, M21 where relevant) since V2 Blade views for these are the same family; where V2 differs it is marked Evidence.

- FR-ADM-H0.1 A screen is complete only with its real endpoint, persistence, audit entry for every write, and the pupil effect. FR-ADM-H0.2 No control may be present that does nothing; a feature that is not built is absent from the menu (not shown as a placeholder). FR-ADM-H0.3 All writes on these screens are Admin Pusat only, with an audit record (actor, time, before/after summary). FR-ADM-H0.4 Responsive rules of 4.R apply (cards at 375, inner scroll for tables).
- AC-ADM-H0.1 Given any menu item in the rendered Pentadbiran menu, when opened, then it shows a working screen from the real API (no text "akan datang" or "belum tersedia dalam demo"; Pratonton (admin preview action) is an allowed string when it opens a real preview, and a control that does nothing is a failure).

#### R1-ADM-P2-01 `Gamifikasi: Overview` | `/admin/gamification` | module rows 28, 33 | BE exists (`GET /api/admin/gamification/overview`, `gamification/admin.controller.ts:26`), no page
- **Action: Build** (page over the existing API) | gap and differences: 4.V row P2-01.
- **Screen specification (from V2).** Route `/admin/gamification`, page title "🎮 Gamifikasi Overview" (browser title "🎮 Gamifikasi Overview - Admin Panel"). Standard admin shell: left sidebar, top bar with page title and subtitle, content area, footer. Content regions in order:
  1. Row of six stat cards, each a big number over a label: `Pelajar Aktif`, `Syiling Dijana`, `Token Terkumpul`, `Penukaran`, `Cabaran Aktif`, `Siap Hari Ini`. Numbers use thousands separators (e.g. 5,473,583).
  2. Card `Taburan Tier`: one row per tier in tier order, each with the tier emoji and name (Gangsa, Perak, Emas, Platinum), "{count} · {percent}%" and a horizontal bar. Below the bars a note line "{n} pelajar belum ditetapkan tier." (shown when n > 0).
  3. Card `Top 10 Pelajar`: ten rows, each with rank "#1".."#10", pupil name, a line "{tier emoji} {tier} · Level {n}", and on the right the lifetime syiling total with the word "syiling" under it. Ties are listed as separate ranks (observed two pupils with the same total at #1 and #2).
  4. Card `Transaksi Terkini` with a link "Lihat semua" (goes to `/admin/gamification/transactions`) and a table with columns `Pelajar`, `Jenis`, `Jumlah`, `Sumber`, `Masa`. Rows show the latest 8 in V2 (FR says 10). `Jenis` was shown as a raw key (e.g. `earn`), `Jumlah` as "+24", `Sumber` as a raw key (`latihan`, `cabaran-harian`), `Masa` as relative time in English ("2 days ago", "1 week ago").
  No buttons other than "Lihat semua"; no forms. States: observed populated only; empty and error copy not observed, follow FR-ADM-P2-01.*. V2 defects to fix (D9): raw keys in `Jenis`/`Sumber` and English relative time; show BM labels and BM relative time. Pupil names are shown (V3 masks them, FR-ADM-P2-01.2).
- Reference (V2 `/admin/gamification`, V1 M14 S1; V2 label `Token Terkumpul` is used instead of V1 `Token Ditukar`; V2 adds "{n} pelajar belum ditetapkan tier."): "🎮 Gamifikasi Overview", subtitle "Pantau sistem gamifikasi PRESTASIPLUS"; six cards `Pelajar Aktif`, `Syiling Dijana`, `Token Ditukar`, `Penukaran`, `Cabaran Aktif`, `Siap Hari Ini`; `Taburan Tier` (bars with count and %); `Top 10 Pelajar` ("#{rank}", masked name, "{tier} · Level {n}", syiling; ranked by lifetime Jumlah Syiling); `Transaksi Terkini` (+ "Lihat semua →"; columns `Pelajar`, `Jenis`, `Jumlah`, `Sumber`, `Masa`).
- FR-ADM-P2-01.1 The page shows the six cards, tier distribution (ordered by tier order, fixing V1's alphabetical order = D9), Top 10, latest 10 transactions. FR-ADM-P2-01.2 Student names are masked in the list. FR-ADM-P2-01.3 Numbers come from the same ledger the pupil wallet reads.
- AC-ADM-P2-01.1 (E2E) Given a T5 pupil earns 18 syiling in Latih Tubi, then Overview "Transaksi Terkini" lists the row and `Syiling Dijana` rises by 18.
- Gap: PG-01 hidden. Deviation: tier order.

#### R1-ADM-P2-02 `Gamifikasi: Tier Config` | `/admin/gamification/tiers` | rows 28, 29 | BE exists (`tiers` GET/POST/PUT/toggle, lines 31-48)
- **Action: Build** (page over the existing API) | gap: 4.V row P2-02.
- **Screen specification (from V2).** Route `/admin/gamification/tiers`, title "👑 Tier Configuration". V2 shows a one-line intro "Paparan konfigurasi tier (baca sahaja). Ganjaran Syiling ditetapkan mengikut tier & level soalan." and is READ-ONLY (no inputs, no buttons observed); V3 must add the editing defined in FR-ADM-P2-02.* and then drop the "baca sahaja" wording. Layout: one card per tier, stacked, in `Urutan` order. Each card:
  - Header: tier emoji (🥉 🥈 🥇 💎), tier name, and the line "Urutan #{n} · {count} pelajar".
  - Three figures: `Min Syiling` (0 / 500 / 2,000 / 5,000), `Kadar Tukar` (50 / 40 / 30 / 20), and the tier colour as a swatch with hex (#b45309, #94a3b8, #f59e0b, #06b6d4).
  - Block "📝 Latih Tubi — Syiling / Betul": five values labelled `l1`..`l5` (1, 2, 3, 4, 5 in all four tiers).
  - Block "🛡️ PKSK — Syiling / Betul": one value (5) with the caption "Semua soalan PKSK (tiada level)".
  - Block "🎲 Papan Bijak — Syiling": one value (25) captioned "Menang".
  Tiers observed: Gangsa (#1, 2,508 pupils), Perak (#2, 481), Emas (#3, 81), Platinum (#4, 83). Editing form labels, the "Tambah Tier Baru" card, `Simpan`, `Nyahaktif` and the validation message are defined in FR-ADM-P2-02.* and AC-ADM-P2-02.3 (not observed in V2). Empty and error states not observed.
- Reference (V1 M14 S2): "👑 Tier Configuration", subtitle "Urus tier sistem gamifikasi — termasuk ganjaran Syiling per soalan"; card "Senarai Tier" with per-tier form: `Label BM`, `Icon`, `Warna`, `Min Syiling`, `Kadar` (conversion rate), `Urutan`; sub-block "📝 Latih Tubi — Syiling per Jawab Betul" `L1`..`L5`; "🛡️ PKSK — Syiling per Jawab Betul" (+ "Semua soalan PKSK (tiada level)"); "🎲 Papan Bijak — Syiling" `Jawab Betul`, `Menang`; button "🔴 Nyahaktif"; card "➕ Tambah Tier Baru" (`Nama Tier (eng)` "diamond", `Label BM` "Berlian", `Icon` "💎", `Warna`, `Min Syiling`, `Kadar Penukaran`, `Urutan`, `Perks` "Bonus 2x XP", L1-L5, PKSK, Papan Bijak) button `Tambah Tier`. Seed values observed: Gangsa (0, 50), Perak (500, 40), Emas (2000, 30), Platinum (5000, 20), rewards L1-L5 1..5, PKSK 5, Papan Bijak 5/25.
- FR-ADM-P2-02.1 CRUD and activate/deactivate per above; the per-tier save button carries a text label `Simpan` (V1 is icon-only = D9). FR-ADM-P2-02.2 `Perks` is editable for existing tiers (V1 cannot: D9). FR-ADM-P2-02.3 `Min Syiling` values must be strictly increasing by `Urutan`; the first tier has 0.
- FR-ADM-P2-02.4 A change applies to rewards earned from the next answer and to the conversion rate (Tukar Token) from the next conversion; history is not recalculated.
- AC-ADM-P2-02.1 (E2E) Given the admin sets Gangsa L1 reward to 2, when a Gangsa T5 pupil answers a Latih Tubi L1 question correctly, then the pupil earns 2 syiling and the ledger shows it.
- AC-ADM-P2-02.2 Given Platinum "Kadar" changed from 20 to 10, then the pupil's Tukar Token page shows the new rate.
- Gap: PG-02 hidden.

#### R1-ADM-P2-03 `Gamifikasi: Cabaran` | `/admin/gamification/challenges` | row 30 | BE exists (lines 55-79)
- **Action: Build** (page over the existing API) | gap: 4.V row P2-03.
- **Screen specification (from V2).** Route `/admin/gamification/challenges`, title "🎯 Cabaran Harian". Header of the list: "Senarai Cabaran (15)" with a badge "15 Aktif". Below it a grid of challenge cards (read-only in V2: no forms, buttons or toggles observed). Each card shows: emoji icon; title; difficulty badge; status badge "Aktif"; description line; a chip row with the type key, "Sasaran: {n}", the syiling reward "+{n}" and "+{n} XP"; and a footer with "{n} sertai" and "{n} siap".
  Observed data: 15 active challenges, e.g. "Rajin Berlatih" (Easy, "Selesaikan 3 kuiz hari ini", quiz_count, target 3, +15, +10 XP, 13 sertai / 13 siap), "Si Tepat" (accuracy 80, +20, +15 XP), "Kombo 10" (kombo 10, +120, +200 XP), "Belajar 15 Minit" (masa 15), "Latihan 10 Minit" (time_spent 10), "Kombo 2 Hari" (streak 2). Type keys appear raw and mixed English/Malay (quiz_count, accuracy, topic_variety, bilangan_kuiz, ketepatan, topik_berbeza, kombo, masa, time_spent, streak) and difficulty badges mix `Easy`, `Medium`, `Hard`, `Mudah`, `Sederhana`, `Susah` (D9: V3 shows the BM type labels `Bilangan Kuiz`, `Ketepatan (%)`, `Topik Berbeza`, `Kombo`, `Masa (min)` and the difficulty labels `Mudah`, `Sederhana`, `Sukar`, per FR-ADM-P2-03.2).
  Create/edit form, `Simpan`, `Nyahaktif`, `Padam` with confirm "Padam cabaran ini?" and `Tambah Cabaran` are not observed in V2; follow FR-ADM-P2-03.* (labels in the V1 reference line). Empty and error states not observed.
- Reference (V1 M14 S3): "🎯 Cabaran Harian", subtitle "Urus cabaran harian untuk pelajar", card "Senarai Cabaran ({n})"; per challenge `Tajuk`, `Keterangan`, `Icon`, `Jenis` (`Bilangan Kuiz`, `Ketepatan (%)`, `Topik Berbeza`, `Kombo`, `Masa (min)`), `Sasaran`, `Ganjaran Syiling`, `Ganjaran XP`, `Kesukaran` (`Mudah`, `Sederhana`, `Susah`), `Urutan`, `Simpan`, `🔴 Nyahaktif`, `Padam` (confirm "Padam cabaran ini?"); card "➕ Tambah Cabaran Baru" button `Tambah Cabaran`.
- FR-ADM-P2-03.1 CRUD + toggle. FR-ADM-P2-03.2 The difficulty label is "Susah" in the select and the badge (V1 mixes "Susah"/"Sukar": D9, use "Sukar" for both). FR-ADM-P2-03.3 The types `Ketepatan (%)`, `Masa (min)` and `Kombo` must have working progress evaluators; V1's seeded challenges 2, 7, 8, 9 use `quiz_count` for these (D-4), so the admin must not see a type that the pupil engine cannot measure.
- AC-ADM-P2-03.1 (E2E) Given a challenge "Jawab 5 Betul" (quiz_count 5), when the T5 pupil answers 5 correctly, then the pupil's Cabaran Harian shows complete and the reward is credited once.
- Gap: PG-03 hidden. OQ-H1 (types).

#### R1-ADM-P2-04 `Gamifikasi: Pelajar` | `/admin/gamification/students` | rows 28, 33 | BE exists (`students`, `award` lines 85-91)
- **Action: Build** (page over the existing API) | gap: 4.V row P2-04.
- **Screen specification (from V2).** Route `/admin/gamification/students`, title "👥 Pelajar Gamifikasi", subtitle "Pantau progress pelajar & baki syiling / token". Regions:
  1. Filter card, one row: select `Tier` (options `Semua Tier`, `🥉 Gangsa`, `🥈 Perak`, `🥇 Emas`, `💎 Platinum`), text input `Cari (nama / emel)` with placeholder "Cari pelajar...", button `Tapis` (magnifier icon).
  2. Table card with columns `Pelajar` (name with a second small line under it), `Tier` (badge), `Level`, `Baki Syiling`, `Token`, `Jumlah Syiling`, `XP`, `Streak`. Numbers are coloured by column (syiling orange, token green, XP purple, streak orange). The tier column in V2 is a coloured badge.
  3. Footer: "1–25 daripada {total}" (observed 3,012) and numbered pagination with previous/next arrows and ellipsis (25 per page, 121 pages).
  No award action, row action or form is present in V2; `Beri Syiling` with amount and reason is defined by FR-ADM-P2-04.1 (not observed). Note the V2 filter placeholder uses "emel"; in V3 the list shows role/school instead of e-mail where FR-ADM-P2-20.1 style applies, otherwise follow FR. Empty and error states not observed.
- Reference (V1 M14 S4): "👥 Pelajar Gamifikasi", subtitle "Pantau progress pelajar & berikan bonus syiling"; filter `Cari nama/email...`; award form.
- FR-ADM-P2-04.1 List with filters and the per-pupil balance, tier, level; `Beri Syiling` [label per V1 form; Evidence E-14] with amount and reason; a negative adjustment needs a reason; every award appears in Transaksi as `Bonus` / `Refund`.
- AC-ADM-P2-04.1 (E2E) Given the admin awards 50 syiling to a pupil, then the pupil's wallet shows +50 and the ledger row has the reason.
- Gap: PG-04 hidden.

#### R1-ADM-P2-05 `Gamifikasi: Transaksi` | `/admin/gamification/transactions` | row 28 | BE exists (line 99)
- **Action: Build** (page over the existing API) | gap: 4.V row P2-05.
- **Screen specification (from V2).** Route `/admin/gamification/transactions`, title "📋 Transaksi Syiling". Regions:
  1. Filter bar: select `Semua Jenis` with options `💰 Dapat`, `🛍️ Belanja`, `🔄 Tukar`, `🎁 Bonus`, `↩️ Refund`; filter button(s) and reset as in V1 reference (`Dari`, `Hingga`, `Tapis`, `Reset` are V1; the V2 capture shows the type select and its option list only).
  2. Table with columns `ID`, `Pelajar`, `Jenis`, `Jumlah`, `Baki Selepas`, `Sumber`, `Keterangan`, `Tarikh`.
  3. Footer "1–50 daripada {total}" (observed 33,475) and numbered pagination (670 pages at 50 per page) with previous/next and ellipsis.
  Row contents were not captured (rows load after the page text). CSV export is a [PROPOSED] item in FR-ADM-P2-05.1. Empty and error copy not observed; follow FR-ADM-P2-05.1 (human labels for `Jenis` and `Sumber`, consistent `Baki Selepas`).
- Reference (V1 M14 S5): "📋 Transaksi Syiling", subtitle "Log semua transaksi syiling dalam sistem"; filters `Semua Jenis` (`💰 Dapat`, `🛍️ Belanja`, `🔄 Tukar`, `🎁 Bonus`, `↩️ Refund`), `Dari`, `Hingga`, `Tapis`, `Reset`; columns `ID`, `Pelajar`, `Jenis`, `Jumlah`, `Baki Selepas`, `Sumber`, `Keterangan`, `Tarikh`.
- FR-ADM-P2-05.1 As V1 with human labels for Jenis and Sumber (V1 shows raw keys = D9); 50 per page; CSV export [PROPOSED]. AC-ADM-P2-05.1 Given a date filter, then only rows in range list and balances are consistent (Baki Selepas of row n = balance before + Jumlah). Gap: PG-05 hidden.

#### R1-ADM-P2-06 `Tetapan Gamifikasi` (Rujuk Kawan and economy settings) | `/admin/gamification/settings` | rows 36, 28 | BE exists (`GET/PUT settings`, lines 105-110)
- **Action: Build** (page over the existing API) | gap: 4.V row P2-06.
- **Not observed in V2 — follow FR-ADM-P2-06.\*.** No Rujuk Kawan or gamification-settings page exists in the capture. The FRs define: a settings form for the pupil-side values the backend exposes (referral reward for referrer and referee, caps), a `Simpan` button, values applying to the next referral (AC-ADM-P2-06.1), audit on every write (FR-ADM-H0.3). The exact field list must be read from the `settings` contract; no labels are invented here.
- Reference: V1 M14 S9 "Tetapan Gamifikasi Guru" is teacher-side; Rujuk Kawan setting labels are not captured (Evidence E-14).
- FR-ADM-P2-06.1 A settings form for the pupil-side values the BE exposes (referral reward for referrer and referee, caps) with `Simpan`; saved values apply to the next referral. AC-ADM-P2-06.1 (E2E) Given the referral reward is set to 30, when a new pupil registers with a pupil's referral code, then both ledgers show 30. Gap: no page; field list needs the contract (read `settings` schema).

#### R1-ADM-P2-07 `Kedai Hadiah Digital: Katalog` | `/admin/hadiah`, `/admin/hadiah/baharu`, `/admin/hadiah/:id/edit` | rows 31, 38 | BE exists (`admin/hadiah` list, bulk, get, post, put; `shop/admin.controller.ts:24-66`), no page
- **Action: Build** (page over the existing API) | gap and differences: 4.V row P2-07.
- **Screen specification (from V2).** Route `/admin/hadiah`, title "🎁 Kedai Hadiah Digital", subtitle "Urus catalog hadiah + proses tebusan pelajar". Layout, in order:
  1. Four coloured KPI cards (number over icon + label): `Total Hadiah` (50), `Aktif` (50), `Tebusan Bulan Ini` (0), `Pending Proses` (7).
  2. Category pill bar: `Semua` (selected by default) then one pill per category showing the raw key capitalised or lowercase (`ecommerce`, `ewallet`, `fnb`, `gaming`, `learning`, `streaming`, `telco`). D9: V3 uses the human labels in the V1 reference (`🏆 Mahkota`, `💳 E-Wallet`, `📱 Telco`, `🎮 Gaming`, `🎬 Streaming`, `🍔 F&B`, `🛒 E-Commerce`, `📚 Pembelajaran`, `🎭 Hiburan`).
  3. Two columns on desktop: left, card `Katalog Hadiah` with a table, columns `Hadiah`, `Kategori`, `RM`, `Token`, `Stok`, `Tebusan`, `Status` (the right-most column is clipped in V2; the Tindakan/`Edit` column of V1 is not visible); footer "1–25 daripada 50" and pagination (pages 1, 2, arrows). Right, card `Tebusan Queue` (see P2-08).
  No "Tambah Hadiah" button, bulk toolbar or edit form was visible in V2; the create/edit form (`/admin/hadiah/baharu`, `/admin/hadiah/:id/edit`), bulk toolbar and all field labels follow the V1 reference line and FR-ADM-P2-07.* (options `Manual (admin paste)`, `Instant`; `API (auto, future)` is not offered). Empty copy "Tiada hadiah dalam kategori ini." (V1) for category filters only. On mobile the page stacks: KPIs two per row, pills scroll horizontally, catalogue as cards, queue below.
- Reference (V1 M15 S1, S3, S4): "🎁 Admin — Kedai Hadiah Digital", "Urus catalog hadiah + proses tebusan pelajar."; buttons `Tebusan Queue`, `Tambah Hadiah`; KPI `Total Hadiah`, `Aktif`, `Tebusan Bulan Ini`, `Pending Proses`; category pills `Semua`, `🏆 Mahkota`, `💳 E-Wallet`, `📱 Telco`, `🎮 Gaming`, `🎬 Streaming`, `🍔 F&B`, `🛒 E-Commerce`, `📚 Pembelajaran`, `🎭 Hiburan`; bulk toolbar "{n} hadiah dipilih": `Aktifkan`, `Nyahaktifkan`, `Set Stok`, `Had/Bulan`, `Pelaras Token`, `Padam`, `Batal`; columns `Hadiah`, `Kategori`, `RM`, `Token`, `Stok` (∞), `Tebusan`, `Status` (On/Off), `Tindakan` (`Edit`); 50 per page; empty "Tiada hadiah dalam kategori ini."; form fields `Kategori *`, `Vendor *` ("cth: Roblox, Touch n Go, Hotlink"), `Tajuk *` ("cth: TnG eWallet RM50"), `Penerangan`, `Nilai (RM) *`, `Kos Token *` (hint "100 syiling = 1 token = RM1"), `Emoji Icon`, `Stok (kosong = tanpa had)`, `Maks/bulan/pelajar`, `Sah Hari (default 365)`, `Delivery` (`Manual (admin paste)`, `API (auto, future)`, `Instant`), `Vendor SKU (optional)`, `Display Order`, `Image URL (optional)`, `Terma Khas`, `Aktif`, `Perlu kelulusan ibu bapa`; buttons "➕ Tambah", "💾 Simpan", `Batal`.
- FR-ADM-P2-07.1 All of the above; "Aktif 0 / Off on all 59" in V1 means the catalogue must be activated by the admin before pupils see items (UAT data task U-OP-09). FR-ADM-P2-07.2 The out-of-range page shows the empty copy "Tiada hadiah dalam kategori ini." only for category filters; an out-of-range page redirects to the last page (D9: V1 shows wrong copy). FR-ADM-P2-07.3 The option `API (auto, future)` is not offered (it would be a placeholder). FR-ADM-P2-07.4 Delete is allowed only for rewards with no redemption; otherwise `Nyahaktifkan`.
- AC-ADM-P2-07.1 (E2E) Given the admin creates "Hotlink Topup RM10" active, token cost 10, stock 5, when a pupil with enough tokens opens Kedai Hadiah Digital, then the item is listed with the same price and stock 5.
- AC-ADM-P2-07.2 Given `Pelaras Token` +10% on 3 selected items, then their cost rises 10% (rounded) and the pupil view shows the new cost.
- Gap: PG-06 hidden; `m15/api/admin.ts` client exists.

#### R1-ADM-P2-08 `Tebusan Hadiah Pelajar` (redemption queue) | `/admin/hadiah/tebusan` | rows 31, 38 | BE exists (`redemptions`, `deliver`, `cancel`, lines 36-48)
- **Action: Build** (page over the existing API) | gap and differences: 4.V row P2-08.
- **Screen specification (from V2).** In V2 the queue is the section `Tebusan Queue`, a right-hand card on `/admin/hadiah` (next to `Katalog Hadiah`), not a separate page. Each row is a small card with: reward title (e.g. "TnG eWallet RM5", "TnG eWallet RM10"), a second grey line (pupil identity, hidden/blurred in capture), a status badge "Pending" and a date "DD/MM/YYYY" (observed 20/10/2026 to 22/10/2026; seven rows). KPI `Pending Proses` (7) above counts the same rows. No `Hantar kod` or `Batal` control, status filter pills, or empty copy were observed in V2; V1 status pills (`⏳ Pending Admin`, `⏳ Pending Ibu Bapa`, `🎁 Delivered`, `❌ Cancelled`, `Semua`), empty "Tiada tebusan dalam status ini." and the `Hantar kod` / `Batal` actions follow FR-ADM-P2-08.* . The route `/admin/hadiah/tebusan` links to this section. Date shows the year (already in V2).
- Reference (V1 M15 S2): "📋 Admin — Tebusan Hadiah Pelajar", "Beli kod dari reseller, paste kat sini untuk hantar kepada pelajar."; status pills `⏳ Pending Admin` (default), `⏳ Pending Ibu Bapa`, `🎁 Delivered`, `❌ Cancelled`, `Semua`; columns `Pelajar`, `Hadiah`, `RM`, `Token`, `Status`, `Tarikh`, `Tindakan`; empty "Tiada tebusan dalam status ini."; button `Kembali ke Catalog`.
- FR-ADM-P2-08.1 A `pending_admin` row has actions `Hantar kod` (paste the voucher code; the V1 row form was never captured, Evidence E-14) and `Batal`; delivering stores the code and notifies the pupil; cancelling refunds the tokens. The queue is a section "Tebusan Queue" on the same page as the catalogue "Katalog Hadiah" (V2, V2), with the route `/admin/hadiah/tebusan` kept as a link to that section. FR-ADM-P2-08.2 Tarikh shows the year (V1 omits it: D9). FR-ADM-P2-08.3 A double submission of the same reward within a minute by the same pupil is shown flagged [PROPOSED] (V1 rows 2 and 3 duplicate).
- FR-ADM-P2-08.4 (F-29) The pupil's "Tebusan Saya" uses these status words for the same states the admin sets: `Menunggu` (`pending_admin`), `Dihantar` (`delivered`, shows the code the admin pasted), `Dibatalkan` (`cancelled`, tokens refunded) [PROPOSED words; the admin queue keeps the V1/V2 pills].
- AC-ADM-P2-08.1 (E2E) Given a pupil redeems an item, when the admin pastes the code and presses `Hantar kod`, then the pupil's redemption history shows Delivered (`Dihantar`) and the code.
- AC-ADM-P2-08.2 Given the admin cancels, then the pupil's token balance is restored once. Gap: tebusan cannot be fulfilled today (ADMIN-PUSAT row 31).

#### R1-ADM-P2-09 `Kawalan Reward` (Kedai Hadiah fizikal, ekonomi) | `/admin/reward-control` | rows 31, 35 | BE exists (`GET /api/admin/reward-control`, `PUT settings`, `PUT rewards/:id/cost`, `POST draws`, lines 122-143)
- **Action: Build** (page over the existing API) | gap and differences: 4.V row P2-09.
- **Screen specification (from V2).** Route `/admin/reward-control`, title "🛡️ Kawalan Reward". Regions in order:
  1. Three tiles: `Liabiliti sesi 2026` with value "RM50.00" and caption "jumlah kos hadiah ditebus"; `Pelajar Menebus` (6); `Jumlah Tebusan` (7).
  2. Card "⚙️ Tetapan Kewangan": four read-only rows, each a label and value: `Bajet tebus / sesi` = "RM3.00"; `Syiling flat / soalan betul` = 1; `Tahun sesi semasa` = 2026; `Mini-games beri syiling?` = "Tidak (XP sahaja)". No inputs or save button observed (V2 appears read-only here); V3 needs editable inputs and a `Simpan Tetapan` button per FR-ADM-P2-09.1 and AC-ADM-P2-09.1.
  3. Card "🎁 Kos Sebenar Hadiah — digital = RM0, tidak makan bajet": table columns `Hadiah`, `Kategori`, `Harga Token`, `Kos Sebenar`, `Status` (no rows in capture).
  4. Card "🎟️ Cabutan Bertuah": table columns `#`, `Tajuk`, `Status`, `Harga Tiket`, `Pemenang` (no rows in capture); see P2-10.
  Refusal message for a redemption over budget is not observed; FR-ADM-P2-09.1 requires a clear message. Empty and error copy not observed.
- Reference (V1 M14 S10): "Kawalan Ekonomi Reward"; tiles `Liabiliti sesi 2026`, `Pelajar menebus`, `Jumlah tebusan`; "⚙️ Tetapan Kewangan": `Bajet tebus / sesi (sen) — RM10 = 1000`, `Sub-had tebus / bulan (sen) — RM3 = 300`, `Syiling flat / soalan betul`, `Tahun sesi semasa`, checkbox `Mini-games beri syiling? (jika tidak: XP sahaja — tutup exploit)`, `Simpan Tetapan`; "🎁 Kos Sebenar Hadiah (sen) — digital = 0, tak makan bajet" table `Hadiah`, `Jenis`, `Harga syiling`, `Kos sebenar (sen)`, `Simpan`.
- FR-ADM-P2-09.1 As V2 (V2 `/admin/reward-control`: title "🛡️ Kawalan Reward", tiles `Liabiliti sesi 2026`, `Pelajar Menebus`, `Jumlah Tebusan`; settings `Bajet tebus / sesi`, `Syiling flat / soalan betul`, `Tahun sesi semasa`, `Mini-games beri syiling?`; section "Kos Sebenar Hadiah — digital = RM0, tidak makan bajet" with columns `Hadiah`, `Kategori`, `Harga Token`, `Kos Sebenar`, `Status`; section "Cabutan Bertuah"); V1's field `Sub-had tebus / bulan` is not in V2 and is not built. The liability tile equals the sum of delivered cost; a redemption that would exceed the session or month budget is refused to the pupil with a clear message and shown to the admin as blocked. FR-ADM-P2-09.2 The catalogue listed here is the reward catalogue of Kedai Hadiah (types VOUCHER, PHYSICAL, EXPERIENCE, DIGITAL, SUBSCRIPTION); Evidence E-15 for how it maps to the 59-item digital catalogue in V3.
- FR-ADM-P2-09.3 (F-12, D-A11) `Syiling flat / soalan betul` (API `flatCoins`) is an admin setting, never a constant in code. Its default is the V2 observed value 1, and it is the single source of the Syiling a pupil earns per correct answer in every mode that credits Syiling; the wallet credit reads it at the time of the answer. Changing it affects only answers given after the save. `Mini-games beri syiling?` default `Tidak (XP sahaja)`. Per-mode rates, if different, are listed in 10 §4.4; this screen owns only the flat rate.
- AC-ADM-P2-09.1 (E2E) Given month budget 300 sen and a pupil redeeming a 1000-sen item, then the redemption is refused with the budget message.
- AC-ADM-P2-09.2 (E2E) Given a fresh install (default rate 1), when a pupil answers 7 of 10 correctly, then the wallet credit is 7 Syiling; given the admin sets the rate to 3 and saves, when a pupil answers 7 of 10 correctly in the next session, then the credit is 21 Syiling (7 x 3); a session finished before the save keeps its original credit.
- Gap: PG-10 hidden.

#### R1-ADM-P2-10 `Cabutan Bertuah` | `/admin/reward-control/cabutan` (section of Kawalan Reward) | row 22 | BE: `POST draws` only (`admin.controller.ts:143`); list, close and draw-winner endpoints are required work
- **Action: Build** | gap: 4.V row P2-10.
- **Screen specification (from V2).** Only the section "🎟️ Cabutan Bertuah" at the bottom of `/admin/reward-control` was observed: a table with columns `#`, `Tajuk`, `Status`, `Harga Tiket`, `Pemenang`. No rows, no create form, no `Tutup` or `Cabut pemenang` control and no empty copy were captured. The route `/admin/reward-control/cabutan` in V3 is this section. Create form, draw actions, ticket cap (`Max tiket / pelajar`) and winner publication follow FR-ADM-P2-10.* and the V1 reference line (`➕ Cipta Cabutan Baru`, `Harga tiket (syiling)`, empty "Tiada cabutan lagi."); do not add other labels.
- Reference (V1 M14 S10): table `#`, `Tajuk`, `Status`, `Tiket`, `Kolam`, `Pemenang`; empty "Tiada cabutan lagi."; `➕ Cipta Cabutan Baru` with `Tajuk`, `Penerangan`, `Harga tiket (syiling)` (50), `Max tiket / pelajar` (10) and prize/date fields (not fully captured, Evidence E-14).
- FR-ADM-P2-10.1 Create, list, edit before opening, `Tutup`, `Cabut pemenang` (random from ticket pool, recorded, one winner per prize), publish winner to the pupil. FR-ADM-P2-10.2 Ticket purchases by pupils (`POST /cabutan/:drawId/tickets`) deduct syiling and respect the cap.
- AC-ADM-P2-10.1 (E2E) Given an open draw with ticket 50 and cap 10, when a pupil buys 11 tickets, then the 11th is refused; after `Cabut pemenang` the winner sees the result on the Cabutan page.

#### R1-ADM-P2-11 `Kotak Misteri` | `/admin/reward-control/kotak-misteri` | row 35 | BE: pupil reads/open exist (`shop.controller.ts:50-55`); admin config endpoints required
- **Action: Build** | gap: 4.V row P2-11.
- **Not observed in V2 — follow FR-ADM-P2-11.\*.** No Kotak Misteri admin page in the capture. The FRs define: admin defines box types, cost in syiling, a prize pool with weights and stock; an open picks by stored weights and writes the ledger; the admin sees opens per day; AC-ADM-P2-11.1 (100%/0% weights). Labels must come from the design phase; none are invented here (OQ-H2 open).
- Reference: V1/V2 admin config not captured (Kawalan Reward only sets costs) (Evidence E-14).
- FR-ADM-P2-11.1 Admin defines box types, cost in syiling, prize pool with weights and stock; a box open picks a prize by the stored weights and writes the ledger; the admin sees opens per day. AC-ADM-P2-11.1 (E2E) Given a box with prizes weighted 100%/0%, when the pupil opens it, then only the 100% prize can be won and the ledger shows the cost. OQ-H2.

#### R1-ADM-P2-12 `Marketplace: Produk` | `/admin/marketplace/products` (+ `/create`, `/:id/edit`) | row 32 | BE reads only (`marketplace.controller.ts:18-43`); admin CRUD required work
- **Action: Build** | gap: 4.V row P2-12.
- **Screen specification (from V2).** Route `/admin/marketplace/products`, title "Marketplace — Produk". Regions in order:
  1. Two stat cards: `Jumlah Produk` (10) and `Aktif` (10).
  2. Filter bar: text search (no visible label; placeholder as V1 "Cari produk..."), select `Semua Kategori` (`Peralatan Sekolah`, `Buku & Rujukan`, `Uniform & Pakaian`, `Stationery`, `Digital & E-Book`, `Lain-lain`), select `Semua Status` (`Aktif`, `Draf`, `Ditolak`), buttons `Tapis` and `Reset`.
  3. Count line "{n} produk dijumpai" (observed "10 produk dijumpai").
  4. Product card grid. Each card: image area (placeholder when none), product name, price "RM 35.00", seller name, category badge, stock line "{n} stok", status badge (English "Active" in V2; V3 uses `Aktif`). Observed products are school goods, e.g. a school shoe at RM 35.00 with 7 stok, a school bag at RM 89.90 with 20 stok.
  `Tambah Produk`, card actions (open, `Nyahaktif`, edit, delete with confirm "Padam produk ini?"), the create form "Tambah Produk Marketplace" and the edit form are not visible in V2 and follow the V1 reference line and FR-ADM-P2-12.* (image delete and `Simpan Perubahan` are separate forms). Empty state (V1): "📦 Tiada Produk" with "Tambah produk pertama sekarang!".
- Reference (V1 M20 S1-S3): "Marketplace - Produk"; "{n} produk dijumpai"; `Tambah Produk`; filters `Cari produk...`, `Semua Kategori` (`Peralatan Sekolah`, `Buku & Rujukan`, `Uniform & Pakaian`, `Stationery`, `Digital & E-Book`, `Lain-lain`), `Semua Status` (`Aktif`, `Draf`, `Ditolak`), `Tapis`; cards (thumbnail, name, price "RM 89.90", seller, views, rating, condition `Baru`/`Terpakai`, status), actions open / `Nyahaktif` / edit / delete (confirm "Padam produk ini?"); empty "📦 Tiada Produk" / "Tambah produk pertama sekarang!"; create "Tambah Produk Marketplace": `Penjual` ("🏪 PRESTASIPLUS Official (Admin)"), `Nama Produk *`, `Kategori *`, `Harga (RM) *`, `Harga Asal (RM)` ("Untuk tunjukkan diskaun"), `Penerangan`, `Keadaan *` (`🆕 Baru`, `♻️ Terpakai`), `Status Stok *` (`✅ Ada`, `❌ Habis`), `Kaedah Penghantaran *` (`Ambil Sendiri`, `Pos / Kurier`, `COD`, `Percuma`), `Kos Penghantaran (RM)`, `Lokasi`, images up to 5 ("JPG, PNG, WEBP. Maks 2MB setiap gambar."), `Tambah Produk`; edit adds `Status Produk *` (`🟢 Aktif`, `⏸️ Draf`, `🔴 Ditolak`), "Gambar Sedia Ada ({n})", `Simpan Perubahan`.
- FR-ADM-P2-12.1 All of the above with one correction: image delete and product save are separate forms (V1 nests them so the first image's delete can delete the product and `Simpan Perubahan` does nothing = D9 defect D-M20-01). FR-ADM-P2-12.2 A published product appears in the pupil Marketplace; a draft/rejected one does not. FR-ADM-P2-12.3 Delete asks for confirm and is blocked if orders exist (then `Nyahaktif`).
- AC-ADM-P2-12.1 (E2E) Given the admin adds an active product with 2 images, then the pupil Marketplace lists it with price and first image as main.
- AC-ADM-P2-12.2 Given editing a product with 4 images, when deleting image 1 then saving, then the product and the other 3 images remain.
- Gap: PG-14 hidden; BE read-only. Deviation: FD-P2-12.

#### R1-ADM-P2-13 `Marketplace: Penjual` | `/admin/marketplace/sellers`, `/admin/marketplace/sellers/:id` | row 32 | BE none for admin
- **Action: Build** | gap and differences: 4.V row P2-13.
- **Screen specification (from V2).** Route `/admin/marketplace/sellers`, title "Marketplace — Penjual". Regions:
  1. Three global stat cards: `Jumlah Penjual` (1), `Aktif` (1), `Menunggu Pengesahan` (0). (`Verified` from V1 is not shown in V2.)
  2. Filter: select `Semua Status` (`Pending`, `Aktif`, `Digantung`, `Diharamkan`) and button `Tapis`.
  3. Count line "{n} penjual dijumpai" (observed "1 penjual dijumpai").
  4. Seller cards: circular initial avatar, shop name, owner line, status badge ("Active" in V2; V3 `Aktif`), and "{n} produk" (observed "10 produk").
  Row actions (`Lihat Detail`, `Haramkan` with confirm "Haramkan penjual ini?"), empty copy "Tiada penjual dijumpai", and the detail screen "Semak Penjual" with "Maklumat Perniagaan" come from the V1 reference; the extra transitions `Luluskan`, `Sahkan`, `Gantung` follow FR-ADM-P2-13.1 and were not observed in V2.
- Reference (V1 M20 S4-S5): "Marketplace - Penjual"; cards `Menunggu Pengesahan`, `Aktif`, `Jumlah Penjual`, `Verified` (V1 computes them from the filtered query = D9; they must be global); filter `Semua Status` (`Pending`, `Aktif`, `Digantung`, `Diharamkan`), `Tapis`; row (shop name, owner masked, status, "{n} produk"), `Lihat Detail`, `Haramkan` (confirm "Haramkan penjual ini?"); empty "Tiada penjual dijumpai"; detail "Semak Penjual" with "Maklumat Perniagaan".
- FR-ADM-P2-13.1 List, detail, and the missing transitions V1 does not show: `Luluskan` (pending -> active), `Sahkan` (verified tick), `Gantung`, `Haramkan`, each audited. FR-ADM-P2-13.2 A banned/suspended seller's products leave the pupil Marketplace at once.
- AC-ADM-P2-13.1 (E2E) Given a pending seller approved by the admin, then their active products show to pupils; given suspended, they disappear.
- Gap: PG-15 hidden. Evidence E-14 for seller registration flow.

#### R1-ADM-P2-14 `Tournament` and `Liga` | `/admin/tournament`, `/admin/tournament/create`, `/admin/tournament/:uuid` | row 23 | BE partly (`tournaments` list/create/get, `battle/tournaments/tournaments.controller.ts:31-57`); edit/close/results required
- **Action: Build** | gap: 4.V row P2-14.
- **Not observed in V2 — follow FR-ADM-P2-14.\*.** No tournament admin page in the capture. The FRs define: create (format, question source, registration dates), save as draft, open registration, close, view standings; the pupil banner and `/tournament` list reflect an open tournament (AC-ADM-P2-14.1). V1 titles for guidance only: "Liga & Tournament", "Cipta Tournament Baru", buttons "Cipta & Buka Pendaftaran" and "Simpan Draf". Field list is open (Evidence E-14).
- Reference (V1 M16): "Liga & Tournament" ("Senarai tournament antara sekolah"); "Cipta Tournament Baru" ("Tetapkan format, sumber soalan, dan jadual pendaftaran"), buttons "Cipta & Buka Pendaftaran" / "Simpan Draf"; "Cipta Liga" / "Sertai Liga Ini".
- FR-ADM-P2-14.1 Create (format, question source, registration dates), save as draft, open registration, close, and view the standings. FR-ADM-P2-14.2 The pupil banner `GET /tournament/active` shows an open tournament. AC-ADM-P2-14.1 (E2E) Given an opened tournament, then the pupil banner and `/tournament` list it and the pupil can join. Evidence E-14 for field list.

#### R1-ADM-P2-15 `Ranking Sekolah`, `Leaderboard` (Papan Pendahulu / Kedudukan, admin read views) | `/admin/battle/ranking-sekolah`, `/admin/battle/leaderboard` | rows 18, 33 | BE exists (`battle/standings/students|schools`)
- **Action: Build** (read views over the existing API) | gap: 4.V row P2-15.
- **Screen specification (from V2).** V2 has no admin-side page; the admin menu links to the pupil Battle pages, which were captured:
  - Ranking Sekolah (`/battle/ranking-sekolah`, title "Ranking Sekolah — Battle"): eyebrow "🏫 Pertandingan Antara Sekolah", heading "Ranking Sekolah", subtitle "Sekolah terbaik dinilai berdasarkan jumlah mata, kemenangan, dan ketepatan battle."; list area. Empty state: icon 🏫, "Tiada ranking lagi", "Belum ada sekolah yang menyertai battle. Mulakan pertandingan sekarang!".
  - Leaderboard (`/battle/leaderboard`, title "Papan Pemimpin — Battle"): eyebrow "🏆 Ranking Global", heading "Papan Pemimpin", subtitle "30 pelajar terbaik mengikut jumlah mata yang dikumpul dalam Battle Arena."; Empty state: icon 🏆, "Tiada rekod lagi", "Papan pemimpin masih kosong. Mulakan battle untuk mendapatkan mata!".
  Populated rows were not captured. V3 admin routes `/admin/battle/ranking-sekolah` and `/admin/battle/leaderboard` are read views that show the same ranks as the pupil pages; the empty copy above applies as-is; the period/scope filters and the period-reset note are [PROPOSED] in FR-ADM-P2-15.1.
- Reference: V1/V2 menu `Ranking Sekolah`, `Leaderboard`, `Battle Live` (links to the user pages). Titles "Ranking Pelajar Battle", "Papan Ranking Sekolah".
- FR-ADM-P2-15.1 Read views over the same standings the pupil sees, with filters for period and scope [PROPOSED] and an admin note on the period reset. AC-ADM-P2-15.1 Given a battle result, then admin Leaderboard and the pupil's Kedudukan show the same rank. Gap: PG-12/13 hidden.

#### R1-ADM-P2-16 `Pautan Ibu Bapa` (Jemput Ibu Bapa) | tab `Ibu Bapa` in Edit Pengguna + list in Pengguna (`?role=parent`) | row 40 | BE exists per ADMIN-PUSAT row 40 (`admin/parent-links`, route to confirm)
- **Action: Build** | gap: 4.V row P2-16.
- **Not observed in V2 — follow FR-ADM-P2-16.\*.** No parent record captured. The FRs define: the admin views, adds and removes parent-child links and sees pending invitations from pupils, as a tab `Ibu Bapa` in Edit Pengguna and a list in Pengguna filtered by role parent (AC-ADM-P2-16.1). V1 copy for guidance: card "Anak yang Dipautkan", search "Cari nama atau emel pelajar untuk dipautkan...", empty "Tiada pelajar dipautkan lagi", "Tiada pelajar dijumpai", action `Buang pautan`. V2 only offers `Ibu Bapa` as a role in the bulk user import.
- Reference (V1 M02 S3): card "Anak yang Dipautkan" (chips, `Buang pautan`, search "Cari nama atau emel pelajar untuk dipautkan...", "Tiada pelajar dipautkan lagi", "Tiada pelajar dijumpai", hint "Tambah atau buang pautan anak. Perubahan disimpan apabila klik "Kemaskini".").
- FR-ADM-P2-16.1 Admin views, adds and removes parent-child links and sees pending invitations from pupils. AC-ADM-P2-16.1 (E2E) Given the admin links a parent to a pupil, then the parent sees the child and the pupil's Jemput Ibu Bapa shows linked. Gap: BE has no FE.

#### R1-ADM-P2-17 `Audio KBAT` | `/admin/audio-kbat`, `/create`, `/template` | row 27 | built both (BS-07)
- **Action: Keep** | gap: 4.V row P2-17.
- **Screen specification (from V2).** Route `/admin/audio-kbat`, title "Audio KBAT" (page heading "Set Audio KBAT"; V1 header "Dashboard" is a defect). Regions in order:
  1. Heading "Set Audio KBAT", subtitle "Senarai set soalan audio — fixed sequence, bukan rawak." and an info note: "Set ini bukan soalan rawak. Setiap set lengkap mengandungi 30 soalan MCQ bersama 4 fail audio mengikut range tetap: audio 1 untuk soalan 1–8, audio 2 untuk soalan 9–16, audio 3 untuk soalan 17–24 dan audio 4 untuk soalan 25–30."
  2. Three stat cards: `Set`, `Approved`, `Draft/Pending` (all 0 in capture).
  3. Filter bar: select `Semua Tahap` (V2 lists Darjah 1-6 and Tingkatan 1-5; V3 offers Tingkatan 1-5 only, FR-ADM-P2-17.1), select `Semua Subjek` (full subject list, from Bahasa Melayu to Sains Sukan), select `Semua Status` (`Draft`, `Pending Review`, `Approved`, `Archived`), buttons `Tapis` and `Reset`.
  4. Table columns `#`, `Tajuk`, `Subjek`, `Tahap`, `Status`. Empty state: "Belum ada set Audio KBAT."
  Buttons `Template XLSX`, `Template Word`, `Cipta Set` and the create form (`/admin/audio-kbat/create`: set metadata, 4 audio sections, 30 questions, `Simpan Set Audio KBAT`) were not visible in the V2 capture; follow the V1 reference line and FR-ADM-P2-17.1 (audio file required for Approved, SP picker).
- Reference (V1 M09 S12-S13): "Set Audio KBAT" ("Senarai set soalan audio fixed sequence, bukan rawak."); `Template XLSX`, `Template Word`, `Cipta Set`; cards `Set`, `Approved`, `Draft/Pending`, `Soalan`; filters `Semua Tahap`, `Semua Subjek`, `Semua Status` (`Draft`, `Pending Review`, `Approved`, `Archived`), "Cari tajuk/sumber...", `Tapis`; empty "Belum ada set Audio KBAT."; create "Cipta Set Audio KBAT": format "4 audio section, 30 soalan MCQ", `Tajuk Set`, `Tahap`, `Subjek`, `Status`, `Sumber / Penyumbang`, `Arahan Umum`, 4 sections (`Tajuk Audio`, `Fail Audio`, `Transkrip Audio Untuk Audit`), 30 questions (`Teks Soalan`, `Pilihan A`-`D`, `Jawapan`, `Markah`, `KBAT Level`, `DSKP SP ID`, `Skema / Penjelasan`), `Simpan Set Audio KBAT`.
- FR-ADM-P2-17.1 Verify and complete: the audio file is required for an Approved set (V1 not required = D9); `Tahap` offers Tingkatan 1-5 only; `DSKP SP ID` becomes an SP picker from `curriculum_nodes`; the list header reads the page title (V1 header says "Dashboard" = D9). AC-ADM-P2-17.1 (E2E) Given an Approved set with audio, the pupil's Audio KBAT lists it and the audio plays. Gap: built; verify only. Deviation: FD-P2-17.

#### R1-ADM-P2-18 `Artikel`, `Banner`, `Nota`, `Video` (complete forms) | `/admin/articles|banners|notes`, `/admin/videos` | row 20 and Dashboard | built (Video: N-01)
- **Action: Fix** | gap: 4.V row P2-18.
- **Screen specification (from V2).** Three captured list pages plus Video (no V2 capture; follow N-01 and FR).
  - Artikel `/admin/articles`, title "Artikel": two stat cards `Jumlah Artikel` (92), `Diterbitkan` (92); filter bar with search (button `Cari`), select `Semua Kategori` (`Tips Belajar`, `Berita`, `Motivasi`, `Panduan Ibu Bapa`, `Panduan Guru`, `Kejayaan`, `Umum`), select `Semua Status` (`Diterbitkan`, `Draf`), `Reset`; count "{n} artikel dijumpai"; table `Tajuk` (with "Oleh: {author}" under it), `Kategori` (badge), `Tahap` (shows "Semua" or "Darjah {n}"; V3 shows Semua or Tingkatan only, D96), `Status` (badge `Diterbitkan`), `Views`, `Tarikh` (DD/MM/YYYY); 20 per page; pagination footer is English ("« Previous", "Next »", "Showing 1 to 20 of 92 results", D9: translate to BM, e.g. "Menunjukkan 1 hingga 20 daripada 92 keputusan").
  - Banner `/admin/banners`, title "Banner": heading "Senarai Banner", "Jumlah: 10 banner · 10 aktif"; table `#`, `Tajuk` (truncated with ellipsis), `Jenis` (badge; observed values HERO, FEATURE, PROMOTIONAL, ANNOUNCEMENT), `Sasaran` (ALL, STUDENT), `Susunan`, `Mula`, `Tamat` (DD/MM/YYYY), `Aktif?` (badge `Aktif`). D9: raw upper-case codes are shown as BM labels (audience `Semua`, `Pelajar`, `Guru`, `Admin`).
  - Nota `/admin/notes`, title "Nota": filter selects `Semua Subjek` (Matematik, Sains, Bahasa Melayu, Bahasa Inggeris, Sejarah), `Semua Jenis` (`Ringkasan`, `Lengkap`, `Formula`, `Tips & Tricks`), button `Cari`, `Reset`; heading "Senarai Nota", "Jumlah: 10 nota"; table `Tajuk` (with "Oleh: {author}"), `Subjek` (badge), `Jenis` (raw lower-case, e.g. "tips tricks"; D9: use the filter labels), `Tahap`, `Status` (`Diterbitkan`), `Statistik` ("{n} tontonan").
  - Video: not observed in V2 — follow FR-ADM-P2-18.1 and N-01.
  Add/edit forms, row actions and delete confirms ("Adakah anda pasti mahu padam artikel ini?", "Adakah anda pasti mahu padam nota ini?"; empty "Tiada artikel dijumpai.") are not in the V2 text; follow the V1 reference line and FR-ADM-P2-18.1 (the defects listed there must be fixed).
- Reference (V1 M09): Artikel list "Senarai Artikel" (`Cari artikel...`, categories `Tips Belajar`, `Berita`, `Motivasi`, `Panduan Ibu Bapa`, `Panduan Guru`, `Kejayaan`, `Umum`; status `Diterbitkan`/`Draf`; columns `Tajuk`, `Kategori`, `Tahap`, `Status`, `Views`, `Tarikh`, `Tindakan`; confirm "Adakah anda pasti mahu padam artikel ini?"; empty "Tiada artikel dijumpai."); form "Tambah Artikel Baru": `Tajuk Artikel *` ("cth: 10 Tips Belajar Matematik"), `Ringkasan`, `Kandungan *`, `URL Gambar Utama`, `Kategori *`, `Tahap Pendidikan`, `Terbitkan Sekarang`, `Artikel Featured`, `Simpan Artikel` / `Kemaskini Artikel`. Banner "Senarai Banner" (columns `#`, `Tajuk`, `Jenis`, `Sasaran`, `Susunan`, `Mula`, `Tamat`, `Aktif?`), form "Tambah Banner Baru" (`Tajuk Banner *`, `Penerangan`, `URL Gambar`, `Jenis Banner *`, `Jenis Pautan`, `Sasaran Penonton *`, `Susunan Paparan`, `Tarikh Mula`, `Tarikh Tamat`, `Banner Aktif`, `Simpan Banner`). Nota "Senarai Nota" (filters subject, `note_type`; confirm "Adakah anda pasti mahu padam nota ini?").
- FR-ADM-P2-18.1 Fix the V1 defects that make the forms unusable (D9): Nota create/edit must work (V1 HTTP 500, D-1); `note_type` filter matches stored types (D-7); Banner edit preloads Jenis, Jenis Pautan and Sasaran (D-6); Banner link types `Subjek`/`Kuiz`/`Artikel` show a target picker (D-8); Artikel body is rendered, not shown as escaped HTML, and the page does not scroll sideways (D-3, D-4); pagination keeps filters (D-5); the editor is a working rich editor or a documented plain format, not a blocked CKEditor (D-2). FR-ADM-P2-18.2 `Tahap Pendidikan` offers Semua and Tingkatan 1-5 only (Darjah hidden, D96); banner audience `Pelajar`/`Guru`/`Admin`/`Semua`.
- AC-ADM-P2-18.1 (E2E) Given a published article for Tingkatan 5, then the T5 pupil sees it under Artikel and on the Dashboard.
- AC-ADM-P2-18.2 Given a Nota created for Sains T5 and published, then the T5 pupil's Buku Nota lists it. Deviation: FD-P2-18.

#### R1-ADM-P2-19 `Kawalan Ciri` (full set for ticked modules) | `/admin/feature-toggles` | extends N-06 | BE required (S8.1)
- **Action: Build** | gap and differences: 4.V row P2-19.
- **Screen specification (from V2).** Route `/admin/feature-toggles`, title "Kawalan Ciri". Top line: "Semua ciri HIDUP secara lalai — item hanya tersembunyi apabila anda mematikannya." Two groups, each a heading followed by one row per flag; each row has the module name, a toggle switch and a state word, "Aktif" when on, "Off" when off.
  - Group `Pelajar` (19 rows, in this order): `Zona Permainan` (observed Off), `Misi Harian`, `Kombo`, `Leaderboard`, `Remedial`, `Cita-Cita`, `Universiti`, `Biasiswa`, `Target SPM`, `Analisa Item`, `Prestasi`, `Psikometrik`, `Profil Cerah`, `Kemajuan Saya`, `Sejarah Latihan`, `Video Pembelajaran`, `Perutusan`, `Panduan Pengguna`, `Tiket Bantuan` (all others Aktif).
  - Group `Guru` (10 rows): `Headcount`, `Misi Harian`, `Kelas`, `Prestasi`, `Monitoring`, `Analisis Item`, `Gamifikasi`, `Broadcast`, `Databank`, `Sumbang Soalan` (all Aktif).
  Toggling shows a flash: `Ciri "{label}" telah DIAKTIFKAN.` or `Ciri "{label}" telah DINYAHAKTIFKAN.` (V2 subtitle under the title: "Hidupkan / matikan ciri untuk Pelajar & Guru"). There is no save button observed; each switch acts at once. V3 differences: the switch list covers every ticked module (including `latih-tubi`, no Kertas Subjektif), a flag OFF hides the menu entry and the URL returns the standard 404 (not V2's text "Ciri ini tidak tersedia buat masa ini."), default ON.
- Reference (V2 `config/features.php` labels): pupil flags `Zona Permainan`, `Misi Harian`, `Kombo`, `Leaderboard`, `Remedial`, `Cita-Cita`, `Universiti`, `Biasiswa`, `Target SPM`, `Analisa Item`, `Prestasi`, `Psikometrik`, `Profil Cerah`, `Kemajuan Saya`, `Sejarah Latihan`, `Video Pembelajaran`, `Perutusan`, `Panduan Pengguna`, `Tiket Bantuan`; teacher flags `Headcount`, `Misi Harian`, `Kelas`, `Prestasi`, `Monitoring`, `Analisis Item`, `Gamifikasi`, `Broadcast`, `Databank`, `Sumbang Soalan`. Title "Kawalan Ciri"; V2 page text "Semua ciri HIDUP secara lalai — item hanya tersembunyi apabila anda mematikannya."; groups `Pelajar` and `Guru`; state shown as "Aktif" or "Off"; subtitle "Hidupkan / matikan ciri untuk Pelajar & Guru"; flashes `Ciri "{label}" telah DIAKTIFKAN.` / `Ciri "{label}" telah DINYAHAKTIFKAN.`.
- FR-ADM-P2-19.1 Every V3 module that is ticked and has a V2 flag gets a switch (modules without a V2 flag but needing one: `latih-tubi`). There is no switch for Kertas Subjektif (D104). FR-ADM-P2-19.2 A flag OFF removes the module from the pupil/teacher menu and its URL returns the standard 404 page (D108(6)); the V2 text "Ciri ini tidak tersedia buat masa ini." is not shown anywhere and no 403 page is used. FR-ADM-P2-19.3 Default ON for every flag. FR-ADM-P2-19.4 The switch list is grouped Pelajar / Guru and each row shows the module name and state.
- AC-ADM-P2-19.1 (E2E) Given `Leaderboard` OFF, then the pupil menu hides it and its URL shows the standard 404 page; ON restores it.

#### R1-ADM-P2-20 `Tiket Bantuan` | `/admin/tiket` | A4 (ticked for Murid, Guru and Admin Sekolah, D100, D108(4)) | BE: tickets are created by users and read (`support.controller.ts:75`, read-only); admin reply and status endpoints required work
- **Action: Build** | gap and differences: 4.V row P2-20.
- **Screen specification (from V2).** Route `/admin/tiket`, page title "Tiket Sokongan" (browser title "Tiket Sokongan - Admin Panel"). Layout, in order:
  1. Heading "Tiket Sokongan" and subtitle "Permohonan bantuan daripada pengguna."
  2. Status chips in a row: "Semua ({n})" (selected by default, observed "Semua (3)") then one chip per status with the count, in lower case as stored (observed "dibuka (3)").
  3. Table card with columns `Tarikh`, `Pengguna`, `Subjek`, `Status`, `Dibalas` (observed rows: date-time, user name, subject, status "dibuka", `Dibalas` "—"; "Ya" once replied). The page is read-only in V2: rows are not clickable, there is no reply box and no detail view.
  Empty states: "Belum ada tiket sokongan." (no tickets at all) and "Tiada tiket berstatus “{status}”." (a chip with 0). Pupil-side counterpart (for the thread): section "Balasan Sokongan", fields `Subjek` (placeholder "Ringkasan masalah atau permintaan anda") and `Butiran` (placeholder "Terangkan masalah anda dengan terperinci..."), "Jumlah tiket: {n}", empty "Tiada tiket lagi.".
  V3 additions, not observed in V2 (FR-ADM-P2-20.2 to .4): user shown by role label and school (not e-mail), 25 per page, role filter, row opens a detail with `Subjek`, `Butiran`, the single admin reply (no thread, OD-4), reply box with button [PROPOSED] `Balas` and a status select, and the support contact block in the header. Only Admin Pusat may open it.
- Reference (V2 `admin/tiket.blade.php`, route `routes/web.php:808`): title "Tiket Sokongan", subtitle "Permohonan bantuan daripada pengguna."; status chips "Semua ({n})" and one chip per status "{status} ({n})"; empty "Belum ada tiket sokongan." or "Tiada tiket berstatus “{status}”."; table columns `Tarikh`, `Pengguna`, `Subjek`, `Status`, `Dibalas` ("Ya" or "—"). The V2 page is read-only; the pupil page shows the section "Balasan Sokongan" and the form fields `Subjek` ("Ringkasan masalah atau permintaan anda") and `Butiran` ("Terangkan masalah anda dengan terperinci..."), with "Jumlah tiket: {n}" and the empty "Tiada tiket lagi." (`content/tiket.blade.php`). Where the V2 admin writes the reply is not in the Blade page (E-20).
- FR-ADM-P2-20.1 The list is as V2 (title, subtitle, chips with counts, columns, empty states) with 25 per page and the user shown by role label and school, not by e-mail.
- FR-ADM-P2-20.2 A ticket row opens a detail with the user's `Subjek` and `Butiran`, one reply box [PROPOSED label `Balas`] and a status select (OD-4 decided in 50 §7: a single admin reply per ticket, no thread; the user cannot reply and opens a new ticket instead). Saving the reply sets `Dibalas` to "Ya" and shows the text to the user under "Balasan Sokongan". Saving the reply does not change the status; the admin sets the status separately with the status select. The owner gets an in-app notification "Tiket anda telah dibalas." [PROPOSED]. The owner cannot reply. A later save replaces the single reply text.
- FR-ADM-P2-20.3 Only Admin Pusat replies; tickets of Murid, Guru and Admin Sekolah all appear here, filterable by role.
- FR-ADM-P2-20.4 The support contact block (N-07) is shown on the page header so the admin can see what users are told.
- AC-ADM-P2-20.1 (E2E) Given a T5 pupil submits a ticket from Tiket Bantuan, when the admin opens `/admin/tiket`, then the ticket is listed with the pupil's role and school, and after the admin saves a reply, the pupil sees it under "Balasan Sokongan".
- AC-ADM-P2-20.4 (consistent with AC-MUR-A4-2) Given the admin saves a reply and, separately, a status, then on reload the owner's ticket shows the reply under "Balasan Sokongan", the status label the admin set (an unchanged status if the admin set none), and no reply box; `GET /api/tiket` returns `adminReply` and `statusLabel`; the admin list row shows `Dibalas` "Ya".
- AC-ADM-P2-20.2 Given a status chip with 0 tickets, when selected, then the empty state reads "Tiada tiket berstatus “{status}”.".
- AC-ADM-P2-20.3 Given a Guru or Admin Sekolah account, when it opens `/admin/tiket`, then access is denied; and given the admin at 375 px, then the list is cards and the reply box and `Balas` stay visible above the keyboard.
- Gap: no admin page; "row not ticked" was wrong, A4 is ticked (D100). Deviation: FD-P2-20 reply form added because the pupil-visible reply needs a source.

#### Additional acceptance criteria for P2-01..P2-19 (permission, validation and 375 px; numbering continues each screen)
- AC-ADM-P2-01.2 Given a Guru, when opening `/admin/gamification`, then access is denied; given the admin, the same URL renders. AC-ADM-P2-01.3 Given 375 px, then the six cards show two per row, `Taburan Tier` and `Top 10 Pelajar` are cards and the page has no horizontal scroll.
- AC-ADM-P2-02.3 Given a new tier whose `Min Syiling` is not greater than the previous tier, when `Tambah Tier`, then the form shows the field message [PROPOSED] "Min Syiling mesti lebih besar daripada tier sebelumnya." and saves nothing. AC-ADM-P2-02.4 Given 375 px, then each tier form is one column with `Simpan` and `Nyahaktif` as 44 px buttons.
- AC-ADM-P2-03.2 Given `Padam`, then the confirm "Padam cabaran ini?" shows and, after OK, the challenge disappears from the pupil's Cabaran Harian. AC-ADM-P2-03.3 Given 375 px, then challenges are cards with all fields reachable.
- AC-ADM-P2-04.2 Given an award or deduction without a reason, when saved, then it is refused and no ledger row is written. AC-ADM-P2-04.3 Given 375 px, then rows are cards with the balance and `Beri Syiling` visible.
- AC-ADM-P2-05.2 Given the filter `🛍️ Belanja`, then only spend rows list. AC-ADM-P2-05.3 Given 375 px, then rows are cards (`Pelajar`, `Jenis`, `Jumlah`, `Baki Selepas`, `Tarikh`).
- AC-ADM-P2-06.2 Given a negative reward value, when saved, then it is refused with a field message. AC-ADM-P2-06.3 Given 375 px, then the form is one column.
- AC-ADM-P2-07.3 Given `Vendor`, `Tajuk`, `Nilai (RM)` or `Kos Token` empty, when `Tambah`, then the form is refused with a field message and nothing is saved. AC-ADM-P2-07.4 Given 375 px, then the category pills scroll inside their own bar and the bulk toolbar is sticky with `Aktifkan`, `Nyahaktifkan`, `Set Stok`, `Had/Bulan`, `Pelaras Token`, `Padam`, `Batal` as 44 px buttons.
- AC-ADM-P2-08.3 Given a row `⏳ Pending Ibu Bapa`, then `Hantar kod` is not offered until the parent approves. AC-ADM-P2-08.4 Given 375 px, then rows are cards with `Hantar kod` and `Batal` reachable.
- AC-ADM-P2-09.5 Given the tile `Liabiliti sesi 2026`, then it equals the sum of the real cost of delivered redemptions. AC-ADM-P2-09.3 Given 375 px, then the cost table is cards each with its own `Simpan`.
- AC-ADM-P2-10.2 Given `Cabut pemenang` pressed twice, then only one winner is recorded per prize. AC-ADM-P2-10.3 Given 375 px, then the draw list is cards and `Cipta Cabutan Baru` is a full-width form.
- AC-ADM-P2-11.2 Given prize weights that do not total 100, when saved, then it is refused with a field message. AC-ADM-P2-11.3 Given 375 px, then the prize table is cards.
- AC-ADM-P2-12.3 Given a product with orders, when `Padam` is confirmed ("Padam produk ini?"), then deletion is refused and `Nyahaktif` is offered. AC-ADM-P2-12.4 Given 375 px, then image upload accepts up to 5 images of JPG, PNG or WEBP up to 2MB each and the cards stack.
- AC-ADM-P2-13.2 Given `Haramkan` and the confirm "Haramkan penjual ini?", then the seller's products leave the pupil Marketplace at once. AC-ADM-P2-13.3 Given 375 px, then seller cards keep the status and actions visible.
- AC-ADM-P2-14.2 Given registration closed, then the pupil can no longer join. AC-ADM-P2-14.3 Given 375 px, then the tournament form is one column.
- AC-ADM-P2-15.2 Given a period reset, then both the admin views and the pupil Kedudukan restart together. AC-ADM-P2-15.3 Given 375 px, then rankings are cards with rank, name and score.
- AC-ADM-P2-16.2 Given the admin removes a link, then the parent no longer sees the child. AC-ADM-P2-16.3 Given 375 px, then the child chips wrap and the search box stays above the keyboard.
- AC-ADM-P2-17.2 Given status `Approved` and no audio file, when saved, then it is refused with a field message. AC-ADM-P2-17.3 Given 375 px, then the 4 sections and 30 question blocks are collapsible cards and `Simpan Set Audio KBAT` is a sticky bar.
- AC-ADM-P2-18.3 Given a new Nota, when `Simpan`, then it saves (V1 returned HTTP 500). AC-ADM-P2-18.4 Given an existing Banner with type `HERO` and audience `STUDENT`, when edited, then `Jenis Banner` and `Sasaran Penonton` show those values. AC-ADM-P2-18.5 Given an Artikel body, at 375 px the page has no horizontal scroll.
- AC-ADM-P2-19.2 Given a switch change, then an audit row (actor, flag, old, new) is written and the flash reads `Ciri "{label}" telah DINYAHAKTIFKAN.`. AC-ADM-P2-19.3 Given 375 px, then each switch row is 44 px with the module name above its state.

Not specified (one line each, no ticked module needs them): Penajaan / Anak Angkat / Permohonan / Duta (row 15 excluded, D74, D102), Chatbot and every `Pusat AI` page (row 37 excluded, D73, D102), Pembayaran / Billing / Dunning (finance), Prestasi Sistem, Log Audit viewer (audit is written by this PRD; a viewer is not needed for a pupil module), Push Notifikasi, Gamifikasi Guru / Lencana Guru, Pencapaian (row 34) and Timeline (row 39): no V1/V2 admin screen was found (ADMIN-PUSAT rows 34, 39), so nothing is specified (OQ-H3).

---

## 5. UAT data operations for 1.0 (one-off tasks, with owner)

Owner key (user decision D110, 2026-11-04): ADM = Admin Pusat users working in the Portal Pentadbiran screens; OPS = **the designated UAT developer** who has server access (no AI session acts on a server, D95); DEV = a developer builds the tool or screen, then ADM or OPS uses it. Each task has a done-check and a pupil check on UAT. Order matters.

Flow rules (D110):
- **Script operations (OPS).** Every data operation that runs a script or touches the server (for example the DSKP loader, regroup detection, stem clean-up, publishing Bijak papers in bulk) is run by the designated UAT developer in this order: dry-run, then a report, then the user's approval ("approve U-OP-nn"), then the real run. The user approves every write operation. Reports are kept in the gitignored `.evidence/` and carry no names.
- **Content work (ADM).** Mapping questions to the right Bab, supplying missing figure images for "Rajah n" questions and regrouping stimulus groups are done by ADMIN users in the Portal Pentadbiran: the improved question entry, the "Soalan tanpa Bab" work-list, the diagram audit and the regroup work-list. Developers build and fix those screens; they do not do the content work. A script may only produce a dry-run report or assist a bulk action that an admin confirms in the UI.
- **Environment.** UAT (`uat.prestasiplus.cloud`) is a clone of V2 production data and is the only acceptance environment (40 X5). It holds real pupil data: evidence stays in the gitignored `.evidence/`; issues and PRs carry only pass/fail and IDs, never names.

| ID | Task | Owner | Depends on | Done when |
|---|---|---|---|---|
| U-OP-01 | Run the DSKP loader on UAT for Tingkatan 1-5 (D101): `npm run dskp:load -w @pp/api -- --dry-run`, then real (`docs/ops/dskp-loader.md`). T4-T5 now from the packaged extracts. T1-T3 require the extraction task of FR-ADM-C04.3 first (source PDFs: official KPM DSKP KSSM Tingkatan 1, 2, 3 for Matematik, Sains, Bahasa Melayu, Bahasa Inggeris, Sejarah, Pendidikan Islam, Pendidikan Moral, Pendidikan Seni Visual; not in the repo; blocking evidence E-16); then rerun with the new files | OPS (the designated UAT developer runs: dry-run, report, user approval, real run), DEV (T1-T3 extraction) | backup, `education_levels` T1-T5, E-16 for T1-T3 | AC-R1-12.6: `curriculum_nodes` > 0 per in-scope subject and level that has an extract; second run inserts 0; sanity SELECTs return 0 rows; the report lists subjects/levels still without an extract |
| U-OP-02 | Environment for intake: `JOBS_WORKER_ENABLED=true`, `OCR_ENGINE=tesseract` with `OCR_LANG_DIR` (msa + eng), real extraction provider instead of `AI_PROVIDER=mock` | OPS (the designated UAT developer; user approves the change) | G2 provider decision (U1/U5) | a test PDF reaches "Selesai" within the timeout (AC-ADM-Q07.1) |
| U-OP-03 | Deactivate Darjah D1-D6 in `Tahap Pendidikan` (C-03); check public statistics, pickers, filters | ADM | none | UAT shows 5 levels; public stats 5 levels (now 11) |
| U-OP-04 | Create and verify contracts in Kontrak (D95): order Matematik Tambahan K2 3472/2 first (evidence sufficient), then Matematik 1449/1, Sejarah 1249/1, Fizik 4531/1, Sains K1 when 2+ bodies of evidence exist (`docs/ops/r1-k1-blueprint-evidence.md`, prepared by team A); also 1449/2, 3472/1, 4531/2, 1249/2 per `docs/reference/blueprints` | ADM | U-OP-01 (units), evidence list | each contract `Disahkan` with the recorded verifier; list counts show Disahkan > 0; AC-ADM-Q16.3 |
| U-OP-05 | Detect and quarantine stimulus-less and duplicated published questions (4.G.7): run the detector (DEV tool, server rule), hide flagged questions from pupils by servability reason, produce the regroup work-list (QE-08), then ADM regroups per subject/Tingkatan; start with Sains T4 "Rajah n menunjukkan..." (e.g. id 812791, Rajah 14/11/9/7) | DEV builds the detector and work-list; OPS runs the detector (dry-run, report, user approval, real run); ADM regroups and supplies the figure images in the UI (D110) | none | Count of open `stimulus_missing` shown per subject; flagged questions never drawn (AC-ADM-G7.1); the list reaches 0 or the rest stay hidden |
| U-OP-06 | Clean-up of duplicated stem/prompt on migrated questions (FR-ADM-G7.6) | DEV builds the tool; OPS runs it (dry-run, report, user approval, real run) | U-OP-05 detector | no question with stem equal to its only leaf prompt |
| U-OP-07 | Bab mapping for migrated questions (D89, C-05): admin sets the Bab by filter in bulk, starting with the T4-T5 subjects the pupils use (Matematik, Sains, Sejarah, BI, BM) and then T1-T3 (D101); 0 of 339,112 linked today | ADM does the mapping in the "Soalan tanpa Bab" work-list and bulk tool (DEV builds and fixes the screens; developers do not map, D110) | C-05 built, M03 chapters present (686 T4/T5 chapters; T1-T3 chapters: Evidence E-03) | Kurikulum shows question counts per Bab; the T5 pupil sees Bab with soalan (AC-ADM-C05.3); target for sign-off = every Bab of the launch subjects has >= 1 question, or an empty-state message |
| U-OP-08 | Seed the pool for blueprint papers: legacy untagged MCQs are excluded from Bijak papers (D80), so intake at least one real trial paper per launch paper via Import & Semakan (needs U-OP-01, U-OP-02) with full DSKP tags, or tag legacy questions through Studio; check "Pratonton kolam" of each contract | ADM | U-OP-01, 02, 04 | each contract's pool shows enough servable questions for the paper |
| U-OP-09 | Build and Terbit papers in Set Builder under the Disahkan contracts (one per launch paper) and verify as a T5 pupil | ADM | U-OP-04, 08 | pupil Bijak SPM lists the papers; `Terbit` with no exception record; one test sitting submits |
| U-OP-10 | Tracking A: fill each set to `target_count` (`Isi set`, `Simpan`) | ADM | Q-17 built | pupil Tracking A sets unlocked |
| U-OP-11 | Flags: `latih-tubi` ON, `permainan` ON, every other module flag ON as built; no switch exists for Kertas Subjektif or the Subjektif lane (D104) | ADM | N-06 / P2-19 | pupil menu matches; Kertas Subjektif and Subjektif visible |
| U-OP-12 | Accounts for acceptance: create a T5 pupil, a T4 and a T2 pupil (D101), a teacher, a school (SMK) and its Admin Sekolah with `Janakan Akaun` (unblocks the AS audit, GAP 8) | ADM | U-02 | each logs in and reaches its portal |
| U-OP-13 | Catalogues for the rest of the matrix: activate the digital rewards wanted (V1 shows all 59 Off), set tier values, challenges, reward budgets | ADM | P2-02, 03, 07, 09 | pupil Kedai Hadiah lists active items |
| U-OP-14 | Clear the extra test data left by QA (questions 1272-1276, batches 1-2, papers 6-8) if present on the target | ADM | none | none remain on UAT |
| U-OP-15 | Create Tingkatan 1-3 chapters/topics (F5, D101): for each subject with a T1-T3 syllabus, create Bab/Topik in Kurikulum (C-01.6) when the migrated data has none, then bulk-map questions (U-OP-07) | ADM | E-03 (is T1-T3 chapter data present?), C-01 | the T2 pupil sees subjects and Bab in Soalan by Chapter; Latih Tubi T1-T3 no longer says "akan datang" |
| U-OP-16 | Set the support contact in `Tetapan` (N-07) | ADM | N-07 built | `/api/config/support` answers 200 on UAT and Panduan shows the contact |
| U-OP-17 | Regroup work-list (QE-08): after U-OP-05 detection, regroup per subject and Tingkatan (Sains T4 first) and attach the real figures; re-run the detector until the open count is 0 or the remainder stays hidden | ADM (regroup and figure images in the regroup work-list and diagram audit; OPS only re-runs the detector report, D110) | U-OP-05, QE-08 built | AC-ADM-G7.2 per subject |

---

## 6. Rest of the matrix and deferred list (replaces the "out of 1.0" list; see 4.H for the full sections)

| Item | V2 screen | V3 state | Backend | Decision |
|---|---|---|---|---|
| Gamifikasi Overview / Tier / Cabaran / Pelajar / Transaksi | `/admin/gamification*` | no page | exists | in scope, P2-01..05 |
| Tetapan Gamifikasi / Rujuk Kawan | gamification settings | no page | `settings` exists | in scope, P2-06 |
| Kedai Hadiah Digital + Tebusan | `/admin/hadiah*` | no page | exists | in scope, P2-07, P2-08 |
| Kawalan Reward, Kotak Misteri, Cabutan | `/admin/reward-control` | no page | partly (cost, settings, `POST draws`) | in scope, P2-09..11 (backend work listed) |
| Marketplace Produk / Penjual | `/admin/marketplace/*` | no page | read-only | in scope, P2-12, P2-13 (backend work) |
| Tetapan Permainan | `/admin/permainan` | no page | exists | in scope, 1.0 column (row 21), N-05 |
| Tournament / Liga | `/tournament/admin/create` | no page | partly | in scope, P2-14 |
| Ranking Sekolah / Leaderboard | `/battle/*` | no admin page | exists | in scope, P2-15 |
| Jemput Ibu Bapa links | Pengguna | no FE | exists | in scope, P2-16 |
| Audio KBAT | `/admin/audio-kbat` | built | exists | in scope (verify), P2-17 |
| Tiket Bantuan (A4) | `/admin/tiket` | read-only | read | in scope, P2-20 (D108(4)) |
| Tetapan (support contact) | `/admin/settings` | none | none | in scope, N-07 |
| Kawalan Ciri (all ticked modules) | `/admin/feature-toggles` | none | none | in scope, two switches N-06, full list P2-19 |
| Penajaan, Anak Angkat, Permohonan, Duta | `/admin/sponsors`, `/anak-angkat*`, `/admin/duta-applications` | none | request only | deferred, hidden (rows 15 excluded; D74) |
| Chatbot, Pusat AI | `/admin/chatbot`, `/pusat-ai/*` | none | none | deferred, hidden (row 37 excluded; D73) |
| Pembayaran, Billing, Dunning | `/admin/payments`, `/billing`, `/dunning` | none | none | deferred, hidden; no ticked module needs them |
| Prestasi Sistem, Log Audit viewer, other Tetapan sections | `/admin/performance`, `/audit-logs`, `/admin/settings` | none | no audit endpoint | deferred, hidden |
| Notifikasi (Push) | `/admin/notifications` | none | none | deferred (D66 OD-21 C: no broadcasts) |
| Gamifikasi Guru, Lencana Guru | `/admin/gamifikasi/guru` | none | none | deferred; teacher modules outside Guru 1.0 |
| Tanda Karangan, Ramalan SPM, Set Soalan (Filament) | Panel / Filament | none | none | removed (AI D73; merged D30) |
| Export CSV (pengguna, soalan, sekolah, pembayaran) | `/admin/export/*` | none | none | deferred; pembayaran never; others P2 |
| Pencapaian, Timeline | not found | none | none | OQ-H3 |

---

## 7. Reconciliation with existing requirement IDs

Legend: VALID (unchanged), CHANGED (still applies with the stated change), SUPERSEDED (replaced).

### 7.1 `docs/requirements/v2-admin-student-pipeline.md` (PIPE, 20 stories, 155 ACs)
| ID | Status | Reason (gap evidence) |
|---|---|---|
| US-01 Single content source per activity | VALID | one store (A1); Q-03 and Studio list read the same endpoint |
| US-02 Lifecycle, labels, click counts | CHANGED | V3 keeps 4 clicks (Q-04); the completeness panel (QE-04) replaces the late 422 seen in E2E F1; AC-02.7 (Darjah visible to admin) SUPERSEDED by D96 |
| US-03 DSKP tagging as approval gate | CHANGED | gate stays (ADR-0031); added: Bab field (D89), tag step first, CSV and upload carry the fields (E2E F2), message list at entry; the aras-pemikiran gate is kept with a question-level default (D108(2)); AC-03.3 bulk approve runs per-row gate (Q-20) |
| US-04 Visible state "Dilihat murid di" | CHANGED | indicator exists but shows "0/6" for all 339,112 without explaining; Q-06 requires reasons and a pupil-equal rule |
| US-05 No silent drops | CHANGED | extended by D90 (5) and stimulus_missing/duplicated stem (4.G.7) |
| US-06 Blueprint and Disahkan gate | CHANGED | Disahkan cannot be chosen in UI and UAT has 0 contracts (E2E F7); Q-16 makes Disahkan reachable via Pengesahan and D95 UAT task |
| US-07 Paper assembly and publish | CHANGED | two builders, no Pilih N, Jana set lacks Tahun/Negeri (E2E F4); merged into Set Builder (Q-13..15) |
| US-08 SPM activities draw by DSKP and kertas | VALID | |
| US-09 Tracking A admin-authored [R2] | CHANGED | promoted to R1 P0: Tracking A is in Murid 1.0 and returns 404 (E2E F5), 0 sets on UAT |
| US-10 Student display of answer modes | VALID | pupil PRD |
| US-11 Stimuli, groups, images | CHANGED | adds the entry side as the centre (QE-01..08); AC-11.12 stays R2 |
| US-12 Practice family serves every approved shape [R2] | CHANGED | brought into the first delivery: D105 supersedes the R1 text-only restriction (D87 U2, D92(1), D91); drills serve figure questions and whole groups |
| US-13 Games read the admin bank [KIV] | CHANGED | games are ticked (row 21): N-05 and the rest-of-matrix screens; the game pool rule (D85 U6) is unchanged (OQ-G1) |
| US-14 Missing activities [R1: 14.1, 14.2, 14.7] | VALID | |
| US-15 Other authoring channels [KIV] | CHANGED | Kiriman Guru and CSV are in scope (Q-11, Q-12; teacher paper = 503) |
| US-16 Migration context, no copy | CHANGED | adds regroup work-list and quarantine for migrated questions (QE-08, G7) |
| US-17 Responsive | CHANGED | detailed per screen in 4.R (user report: paper screens bad) |
| US-18 Provable end-to-end | VALID | every screen here has an E2E AC; run on UAT |
| US-19 Fix .cloud inconsistencies | CHANGED | list of D9 deviations grows (FD-* tags in this PRD) |
| US-20 Student Simulasi display engine | VALID | pupil PRD |

### 7.2 `docs/requirements/v3-bijak-spm-scope.md` (R1-01..R1-21)
| ID | Status | Reason |
|---|---|---|
| R1-01..R1-10 (pupil) | VALID | pupil PRDs |
| R1-11 Databank fed by admin questions | VALID | reached via Q-03/Q-01 |
| R1-12 DSKP loader | CHANGED | Tingkatan 1-5 (D101: "Tingkatan 1-5 only" stays, T1-T3 extracts must be made, FR-ADM-C04.3); UAT run is task U-OP-01; AC-R1-12.2 (ignore Darjah) valid |
| R1-13 Studio create/edit | CHANGED | QE-02..04 (group first, DSKP order, 8 types, completeness) |
| R1-14 PDF intake, accept, approve | CHANGED | AC-R1-14.2 now blocks sign-off (worker + OCR off, E2E F2); paper/section carried (QE-05) |
| R1-15 Kontrak with Disahkan | CHANGED | AC-R1-15.2 stays; UI route to Disahkan fixed (Q-16) |
| R1-16 Set Builder, Terbit | CHANGED | one builder; AC-R1-16.2 override stays for Admin Pusat only |
| R1-17 Servability | CHANGED | reasons required (Q-06) |
| R1-18 Laporan Soalan | VALID | Q-22 verifies the row action |
| R1-19 Secondary-only guard | CHANGED | AC-R1-19.2 SUPERSEDED by D96 |
| R1-20 End-to-end | VALID | tasks U-OP-04..09 produce the data |
| R1-21 Panel parity (P1-P7) | CHANGED | AC-R1-21.1: all six lanes now (U6 superseded because the screens are built); AC-R1-21.5 Darjah part SUPERSEDED (D96); Panel items "not needed for R1" (Tracking A, Subjektif, Kertas Subjektif, Latih Tubi lane, Pengguna, Sekolah) are now in scope; the Kertas Subjektif "KIV, flag OFF" row is SUPERSEDED by D104 (fully working at release, no flag) |

### 7.3 `docs/architecture/v2-admin-student-pipeline.md` section 13 and `docs/design/v2-admin-student-pipeline.md`
| Item | Status | Reason |
|---|---|---|
| 13.6 Panel-to-Pentadbiran mapping | CHANGED | KS-09 merged into Set Builder; Tracking A, Kertas Subjektif, Kawalan Ciri built |
| 13.4 tasks B05, B09, B10, B11, F06-F09 | VALID | implemented; Q-13..Q-16 close the gaps |
| D83 D-2 (keep 9 groups) | SUPERSEDED | the admin menu follows the V2 sidebar groups (section 3, approved by D107) |
| D83 D-4 (cognitive level mandatory) | VALID | user-approved via D85 and built; the exam-schema text is to be aligned (OQ-QE2) |
| D83 D-10 (Sumber Kertas hidden) | SUPERSEDED | in the V2 SOALAN group and in D107's list (Q-19, P2 priority) |
| D83 D-5, D-6, D-8, D-9 | VALID | |
| D85 U4 (kertas required) | VALID with fix | carried from upload (QE-05) |
| D93 (group under 2 members blocked in paper) | SUPERSEDED in part | D108(1): groups of 1..n questions are allowed, including in papers; the "Kumpulan perlu sekurang-kurangnya 2 soalan." blocker is replaced (FR-ADM-QE2.4) |
| D92(1) / D87 U2 / D91 (R1 text-only drills) | SUPERSEDED | D105: drills serve figure questions and whole groups (FR-ADM-QE7.3) |
| D80(2) (Kertas Subjektif flag OFF) | SUPERSEDED | D104 (Q-18, Q-23) |
| D96 | VALID | applied to every picker |
| D99 | VALID | |
| Design doc screen specs S1-S4 | VALID except menu and responsive | 4.R adds phone/tablet rules |

---

## 8. Summary, open questions, evidence still needed

### 8.1 Summary table
Counts below were taken by grep of the IDs in this file (each ID counted once; cross-references not counted). Screens are the R1-ADM-Q/C/N/U/M/P2 items; QE, 4.G, 4.R and H0 are cross-screen requirement blocks (all P0 except H0/R0, which apply to every screen).
| Area | Screens | P0 screens | P1 screens | P2 screens | FRs | ACs |
|---|---|---|---|---|---|---|
| Entry standard QE-01..08 (cross-screen blocks) | 0 (8 blocks) | n/a | n/a | n/a | 38 | 20 |
| A Question pipeline Q-01..Q-24 | 24 | 20 (Q-01 to Q-18, Q-22, Q-23) | 2 (Q-20, Q-24) | 2 (Q-19, Q-21) | 107 | 50 |
| DSKP guidance 4.G: flows G5, G6 and stimulus-less defect G7 | 0 | n/a | n/a | n/a | 6 | 9 |
| B Curriculum and DSKP C-01..C-05 | 5 | 5 | 0 | 0 | 22 | 9 |
| C Content and settings N-01..N-07 | 7 | 2 (N-01, N-05) | 4 (N-02, 03, 06, 07) | 1 (N-04) | 15 | 9 |
| D Users and schools U-01..U-09 | 9 | 4 (U-01..04) | 4 (U-05, 06, 08, 09) | 1 (U-07) | 27 | 15 |
| E Monitoring and reports M-01..M-08 | 8 | 0 | 6 (M-01..06) | 2 (M-07, 08) | 23 | 10 |
| Responsive 4.R (FR-ADM-R0.1, AC-ADM-R1..R11) | 0 | n/a | n/a | n/a | 1 | 11 |
| Rule H0 (no placeholders) | 0 | n/a | n/a | n/a | 4 | 1 |
| Rest of the matrix P2-01..P2-20 | 20 | 0 | 20 | 0 | 47 | 68 |
| **Total** | **73** | **31** | **36** | **6** | **290** | **202** |
Sum checks (by grep of defined IDs): FR 38+107+6+22+15+27+23+1+4+47 = 290; AC 20+50+9+9+9+15+10+11+1+68 = 202; screens 24+5+7+9+8+20 = 73; priority 31+36+6 = 73. Examples of IDs in section 0 are not counted.
Other counts: UAT data operations 17 (U-OP-01..U-OP-17). Reconciliation rows: section 7.1 has 20 rows (PIPE US-01..US-20); section 7.2 has 12 rows (R1-01..R1-10 in one row, then R1-11 to R1-21 one row each, covering all 21 items); section 7.3 has 13 rows; 45 in total. Open questions in 8.2: 22 rows, 16 OPEN and 6 CLOSED. Evidence E-06 (import quota rule) is closed by FR-ADM-U05.5 (D-A17). Evidence items in 8.3: 24 (E-01..E-24): 5 closed (E-01, E-02, E-09, E-17, E-18), 4 partly closed (E-06, E-07, E-14, E-20), 15 open (E-03, 04, 05, 08, 10, 11, 12, 13, 15, 16, 19, 21, 22, 23, 24). Collected [PROPOSED] strings in 8.4: 27 rows. Action counts over the 73 screens (4.V.4): Keep 8, Fix 24, Complete 7, Build 34; over the 8 entry-standard blocks: Complete 4, Fix 2, Build 2. V2 reference lines: 81 of 81 headings (73 screens and 8 blocks). Screens with no V2 capture: Q-09, C-04, C-05, N-01, U-08, M-07, P2-06, P2-11, P2-14, P2-16 (10 screens, listed with the missing page in 4.V.1).

**P0 list (blocks a 1.0 module today):** (1) Kontrak Simulasi Disahkan reachable and verified, 0 contracts on UAT (Q-16, U-OP-04); (2) one Set Builder and Terbit, 0 papers on UAT (Q-13..15, U-OP-09); (3) Import & Semakan working: worker + OCR + tags and paper carried to items (Q-07..09, QE-05, U-OP-02); (4) stimulus-group entry, DSKP-correct form, completeness at entry, CSV with DSKP columns (QE-01..07, Q-04, Q-05); (5) stimulus-less published questions quarantined and regroup work-list (4.G.7, QE-08, U-OP-05); (6) Bab mapping, DSKP load, Darjah off (C-01, C-03..05, U-OP-01, 03, 07); (7) SPM hub with 6 lanes and Tracking A editor (Q-01, Q-17); (8) servability indicator with reasons and one review queue (Q-03, Q-06); (9) users, schools and Admin Sekolah account (U-01..U-04, U-OP-12); (10) the final V2-order menu with the question duplicates merged (section 3, approved by D107); (11) Kertas Subjektif and the Subjektif lane fully working with DSKP tags and stimulus groups (Q-18, Q-23; D104); (12) Kiriman Guru with a real backend (Q-12), Video (N-01), Tetapan Permainan (N-05) and Laporan Soalan (Q-22), because the 1.0 modules they feed are P0.

### 8.2 Consolidated open questions (recommendation first)
Status column: OPEN needs a decision; CLOSED has a recorded decision. 22 rows: 16 OPEN, 6 CLOSED.
| # | Question | Status | Blocks | Recommendation / decision |
|---|---|---|---|---|
| OQ-01 | Approve the target menu (section 3) | CLOSED by D107 | menu | Menu is final and follows the V2 sidebar |
| OQ-02 | Is "Kertas" required at approval (D85 U4) for questions that only feed Latih Tubi? | OPEN | CSV/manual publish | Keep U4 but carry the paper from upload/CSV so it is never re-asked; show the missing list |
| OQ-QE1 | Allow a 1-member stimulus group in a paper (changes D93) | CLOSED by D108(1) | Set Builder | Allowed; groups hold 1..n questions; only a 0-member group is blocked |
| OQ-QE2 | Is the per-leaf cognitive level ("aras pemikiran") an approval gate or optional? | CLOSED by D108(2) | approval of SPM-bound T4/T5 questions | Stays a gate with a question-level default; KBAT derived; exam-schema text to be aligned. Sources and dates in the closed paragraph of 4.0 |
| OQ-03 | Bab mapping of 339,112 migrated questions: bulk by filter only, or also keyword-assisted suggestions? | OPEN | U-OP-07 | Bulk by filter only (D89 forbids derived data); no auto-mapping |
| OQ-C1 | Maintain a Bab -> Unit lookup to pre-filter the Tag step | OPEN | Studio speed | Yes, suggestion only |
| OQ-04 | Hide Kontrak Simulasi from the sidebar (V2) while contracts are still empty on UAT | CLOSED by D107 | discoverability | Opened from Set Builder and paper review as in V2 |
| OQ-05 | Build Sumber Kertas (V2 has it; D83 D-10 hid it) | OPEN | none | Build read-only, P2 (D107 lists it in the Soalan group) |
| OQ-06 | Kawalan Ciri: server flags (new table) vs build-time | OPEN | N-06 | Server flags: 2 switches in N-06, full list in P2-19 |
| OQ-Q07 | What lists `Kertas Diimport` in V3 | CLOSED by D-A2 | Q-07 | Draft papers created from an accepted batch (FR-ADM-Q07.6..Q07.9) |
| OQ-Q12 | Kiriman Guru: reuse intake batches (D40) or rebuild V1's file submissions | OPEN | Q-12 | Reuse intake batches; one real backend |
| OQ-07 | Does "Subjektif" in Murid 13 mean the Subjektif lane or Kertas Subjektif | CLOSED by D104 | priority of Q-18 | Both are in the SPM module and fully working at release, no flag (Q-18, Q-23, both P0) |
| OQ-08 | Is the V2 free-text rubric editor replaced by Studio K/N/P scheme editing for structured questions | OPEN | Q-23 | Yes (oldsystem findings C) |
| OQ-U1 | Hide primary-school (SK, SJK) rows in the school list | OPEN | U-04 | Hide by default (D72), data kept |
| OQ-U2 | Can the admin create classes or only correct them | OPEN | U-08 | Only correct; teachers create |
| OQ-M1 | Dashboard status names: V2 "Diluluskan/Menunggu Review/Draf" or V3 lifecycle names | OPEN | M-01 | V3 names |
| OQ-D101 | T1-T3: the official T1-T3 DSKP PDFs are not in `D:\prestasiplus-dskp`; who supplies them? | **Decided (user, 2026-11-04, D109):** not required; T1-T3 use the same DSKP structure as T4-T5, built from the existing chapter and topic data. Until SP/TP are loaded, T1-T3 questions are approved without DSKP tags (R1-U1) | U-OP-01 (T1-T3), U-OP-07, U-OP-15 | Yes approve untagged meanwhile; extract T1-T3 in the same format and load with `--data-dir` |
| OQ-H1 | Gamifikasi Cabaran types that the engine cannot measure | OPEN | P2-03 | Offer only measurable types |
| OQ-H2 | Kotak Misteri admin model (no V1/V2 admin evidence) | OPEN | P2-11 | Specify from V2 code before build |
| OQ-H3 | Pencapaian (34) and Timeline (39): does any admin need exist | OPEN | scope | Confirm with the user; A4 is resolved (Tiket Bantuan, P2-20) |
| OQ-L1 | Sidebar labels: D77 restored V3 labels (`Langsung`, `Ringkasan`, `Tahap 1: Reaksi`, `Upload Screenshot`) while D107 says follow the V2 sidebar (`Command Center`, `Overview`, `T1: Reaksi`, `Screenshots`) | OPEN | menu labels | Follow D107 (later, V2 sidebar); keep `Upload Screenshot` as D77 restored it unless the user says otherwise |
| OQ-G1 | Do games (Zon Permainan, Battle) also serve figure questions and groups, or keep the D85 U6 exclusion? D105 names only Latih Tubi, Databank and Soalan by Chapter | OPEN | N-05 | Keep the exclusion until the user decides |

### 8.3 Evidence still needed (only live V2, DB access or documents can settle; not guessed)
| # | What | Why |
|---|---|---|
| E-01 | CLOSED by the V2 hub screens (4.V.1). Was: live V2 hub lane `Perhatian` values and what each lane shows in production | Q-01/Q-02 counts |
| E-02 | CLOSED by the V2 Panel home and Analitik screens (4.V.1). Was: Panel `Analitik` tile contents and `Papan Pemuka` tiles (PIPE OQ-3) | M-05 |
| E-03 | Relation between M03 `chapters` (686 T4/T5) and `curriculum_nodes`; whether T1-T3 chapters exist on UAT; whether `curriculum_nodes` already loaded on UAT | C-01, C-04, C-05 |
| E-04 | V2 admin class management screens | U-08 |
| E-05 | V2 Kertas Subjektif detail/OCR behaviour in the Panel (V2 could not upload pages) and bake-off on 5 scanned papers | Q-18 |
| E-06 | PARTLY CLOSED (4.V.1); still needed: the `/admin/import-students` state after a school is chosen (quota panel). Quota rule when an import exceeds the school quota (partial vs refuse) | U-05 |
| E-07 | CLOSED for V2 (legacy `ramalan` sets, Panel `/spm/tracking-a`); UAT state still unknown. Tracking A: legacy `spm_sets` vs canonical composites on UAT | Q-17 |
| E-08 | Whether UAT structured questions were migrated into canonical multi-part questions | Q-23 |
| E-09 | CLOSED by the V2 Laporan Eksekutif screen (4.V.1). Was: V2 Laporan Eksekutif content | M-08 |
| E-10 | Whether Panduan reads articles or a separate table | N-02 |
| E-11 | DSKP hierarchy of Sains (and TP unit) from `sains.json` / PDF | 4.G.1 |
| E-12 | Real run of sample trial papers (`D:\prestasiplus-dskp\sampel-percubaan`) through extraction | AC-ADM-G6.x |
| E-13 | Root cause on UAT of "Rajah n" questions: where the image went, and how many are flagged | 4.G.7 |
| E-14 | PARTLY CLOSED (4.V.1); still missing: Rujuk Kawan settings, `Beri Syiling` form, `Hantar kod` form, Cabutan create form, Kotak Misteri, Tournament form, `/admin/marketplace/sellers/{id}`, `admin/parent-links`. V2 field lists for Rujuk Kawan settings, `Beri Syiling` form, Hantar kod form, Cabutan prize fields, Kotak Misteri, Tournament form, Marketplace seller flow, `admin/parent-links` route | P2-06, 08, 10, 11, 13, 14, 16 |
| E-15 | How the 59-item digital catalogue relates to the 11-item reward catalogue in V3 data | P2-07, P2-09 |
| E-16 | NOT BLOCKING (D109: T1-T3 are built from existing chapter data in the same structure as T4-T5; official PDFs optional): the official KPM DSKP KSSM documents for Tingkatan 1, 2 and 3 (Matematik, Sains, Bahasa Melayu, Bahasa Inggeris, Sejarah, Pendidikan Islam, Pendidikan Moral, Pendidikan Seni Visual; and whether Fizik, Matematik Tambahan, Tasawwur Islam, Landskap dan Nurseri, Katering dan Penyajian have any T1-T3 content). `D:\prestasiplus-dskp` holds Form 4 and Form 5 or T4-T5 PDFs only | C-04, U-OP-01 (T1-T3), D101 |
| E-17 | CLOSED by the V2 Studio and SPM hub screens (4.V.1). Was: live V2 status vocabulary on Studio, hub copy for Latih Tubi lane | Q-03 |
| E-18 | CLOSED by the V2 Tetapan screen (4.V.1): V2 Tetapan has no support-contact field; N-07 is a V3 addition | N-07 |
| E-19 | `/maklum-balas` form fields and scale (NPS 0-10 and satisfaction 1-5 are inferred, not observed, because the V1 admin had already answered) | M-04 |
| E-20 | PARTLY CLOSED by the V2 `/admin/tiket` list (list only); still needed: a ticket detail or reply state of `/admin/tiket`. Where the V2 admin writes a ticket reply (the Blade page `admin/tiket` is read-only) | P2-20 |
| E-21 | Missing page: V2 `/admin/studio/imports/{batch}/review` (item review with PDF pane) | Q-09 |
| E-22 | Missing page: V2 Video admin (Filament `/admin-filament/videos`) | N-01 |
| E-23 | Missing pages: any V2 central view of PM-12, 13, 15, 21, 22, 23, 24, 27, 28 | M-07 |
| E-24 | Missing state: `/admin/users/{id}/edit` of a parent record (children linking) | P2-16 |

### 8.4 Collected [PROPOSED] copy and values (for user approval, D94)
Every inline [PROPOSED] tag and every label or value that is not found in V2/V1 is listed once. Approval of this table closes them.
| # | Where | String, label or value |
|---|---|---|
| 1 | FR-ADM-QE1.4 | "Rangsangan ini masih digunakan oleh {n} soalan." |
| 2 | FR-ADM-QE2.1 | start labels `Soalan tunggal`, `Kumpulan rangsangan` |
| 3 | FR-ADM-QE2.4 | "Kumpulan belum mempunyai soalan." and blocker "Kumpulan perlu sekurang-kurangnya 1 soalan." |
| 4 | FR-ADM-QE8.1, QE8.2, QE8.4 | tab `Perlu dikumpulkan semula`; action "Bukan masalah"; report label "gambar tiada" |
| 5 | FR-ADM-Q07.2 | "Pengekstrakan gagal: {sebab}" |
| 6 | FR-ADM-Q08.1 | maximum PDF size 30 MB |
| 7 | FR-ADM-Q09.5 | the reason prompt of `Tolak (R)` (text not yet written) |
| 8 | FR-ADM-Q18.3 | "“{title}” tiada kandungan — tidak boleh diterbitkan." |
| 9 | FR-ADM-Q20.3 | the typed-confirmation text of `Arkib Semua` (not yet written) |
| 10 | FR-ADM-C01.4 | "Bab ini masih mempunyai {n} soalan." |
| 11 | FR-ADM-C05.2 | button `Tetapkan Bab`; dry-run line "{n} soalan akan dipautkan ke Bab {nama}" |
| 12 | 4.G.5 step 2, AC-ADM-C04.2 | "DSKP belum dimuatkan untuk subjek ini." |
| 13 | FR-ADM-G7.3 | "Rangsangan tiada — soalan merujuk Rajah 14 tetapi tiada gambar." |
| 14 | FR-ADM-N07.1, N07.3 | section heading `Hubungi Sokongan`; maximum 120 characters per value |
| 15 | FR-ADM-P2-02.3 / AC-ADM-P2-02.3 | "Min Syiling mesti lebih besar daripada tier sebelumnya." |
| 16 | FR-ADM-P2-05.1 | CSV export of Transaksi |
| 17 | FR-ADM-P2-08.3 | duplicate-submission flag on a redemption row |
| 18 | FR-ADM-P2-15.1 | period and scope filters on Ranking/Leaderboard |
| 19 | FR-ADM-P2-20.2 | reply button `Balas` |
| 20 | 4.R.1 | phone labels `Lihat penuh`, `Seterusnya`, `Kembali`, "Langkah 1/4", `Peta soalan`, `Pilih kumpulan`, `Kumpulan baharu` |
| 21 | P2-08, P2-10, P2-13 | action labels `Hantar kod`, `Cabut pemenang`, `Luluskan`, `Sahkan`, `Gantung`, `Beri Syiling` (V1 forms were not captured; E-14) |
| 22 | FR-ADM-P2-10.1 | action `Tutup` (close a draw) |
| 23 | FR-ADM-QE4.5 | message "Sila pilih Bab." |
| 24 | FR-ADM-Q03.7 | note "Soalan tanpa Bab tidak akan muncul dalam Soalan by Chapter dan Heatmap Topik Lemah." |
| 25 | FR-ADM-Q06.4 | reason "Bab belum dipaut - tidak disajikan dalam Soalan by Chapter." (same text as API-Q-11 `chapter_missing`) |
| 26 | FR-ADM-Q12.6 | rejection reason shown to the teacher (word `Ditolak` is V2) |
| 27 | FR-ADM-P2-08.4, FR-ADM-P2-20.2 | pupil status words `Menunggu`, `Dihantar`, `Dibatalkan`; notification "Tiket anda telah dibalas." |





