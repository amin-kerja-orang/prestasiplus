# SRS — Guru & Admin Sekolah portals (R1)

> **Read this first.** V3 already exists. Each module's *Action* and *Current gap* say what to change. The *Screen specification* describes the target behaviour; it is **not** an instruction to rebuild the screen. Before coding a card: (1) run a code gap check of the existing V3 code against every FR/AC of the card and post it on the issue (FR/AC → works / broken / missing, with file:line); (2) change only what is broken or missing, in the existing files; (3) prove the ACs, including the AC-CHAIN that passes through the module (40 §X9).

| Item | Content |
|---|---|
| Purpose | Software requirements specification for the Guru (teacher) and Admin Sekolah (school admin) portals of PrestasiPlus V3, release R1. It is self-contained: a developer who never opens V1 or V2 and receives no screenshots can build every screen from the "Screen specification (from V2)" subsection, the FRs and the ACs of each module. |
| Scope | 22 Guru modules (A1-A5, 1, 2, 2b, 3-11, 8b, 41-44) and the Admin Sekolah modules (AS-0 preconditions, A1-A5, 1-7, 10, 11, 45-53), with their shells, data scope, functional requirements (FR) and acceptance criteria (AC). |
| Roles | Guru: sees the pupils of own classes (SC-G). Admin Sekolah: sees the own school only (SC-AS). Other roles are out of scope (see `30-admin-pusat.md`, `10-murid.md`). |
| Related documents | [00-index](00-index.md) · [01-product-overview](01-product-overview.md) · [02-urs](02-urs.md) · [40-cross-cutting](40-cross-cutting.md) · [50-data-model-erd](50-data-model-erd.md) · [60-api-contract](60-api-contract.md) |

Status: DRAFT v2 for user review, 2026-11-04 (fix pass after independent review; applies TRACKER D100-D108). Language: English. UI strings are quoted in exact Bahasa Melayu from V2, else V1.
Governing principle (user): "berdasarkan V2+V1 untuk betulkan V3". V2 = prestasiplus.cloud (primary). V1 = prestasiplus.my (fallback). V3 = the new build (branch `feature/v3-bijak-r1`).
Cross-cutting rules referenced: `40-cross-cutting.md` FR-X2-0 (fully working), FR-X6-1..5 (responsive), FR-X6-2 (body text >= 14 px on phone), FR-X6-3 (touch targets >= 44 px), AC-X6-1. Related parts: `10-murid.md` (R1-MUR-3 Headcount, R1-MUR-8 Kelas Saya, R1-MUR-26 Set Soalan Guru, R1-MUR-A4), `30-admin-pusat.md`.
Evidence basis: a gap analysis of the V3 build against V1 and V2, V2 screen observations (written into each module as "Screen specification (from V2)"), V2 server behaviour read from code, and V1 discovery notes. No real person's name, e-mail, IC, phone number, password or school-linked personal data appears in this file.

Tags used in the reference-behaviour parts:
- **[V2]** observed in V2 live screenshots or V2 code. **[V1]** observed in V1 discovery docs.
- **[PRINCIPLE]** "specified by principle": nothing was observed; derived from the closest V1/V2 analogue, the DSKP and consistency with the other 1.0 modules. The user should review each one.
- **[NOT OBSERVED]** a fact only live V2/V1 can settle; listed in 6.3.

---

## 0A. Shared rules for all screens in this file

Every module in sections 3 and 4 has a subsection **"Field & behaviour spec"** placed after its "Screen specification". It is the complete register of fields, options, validation, states and calculations of that screen, so that a developer or cloud agent builds the screen without asking a question. Rules that apply to every screen are defined once here (GLB-1 to GLB-6) and referenced by id. Generic form messages follow `40-cross-cutting.md` X10 (ERR-REQ-10..16) exactly: "Sila isi {medan}.", "Sila pilih {medan}.", "{Medan} mesti antara {a} dan {b}.", "{Medan} sudah digunakan."; a screen-specific text is kept only where GLB-1 or the table says so.

- **Master copies.** The shared option sets (OPT-*) are defined in `40-cross-cutting.md` §X11 and the error catalogue (ERR-*) in `40-cross-cutting.md` §X10. Until §X11 carries them, the sets used by this file are listed in full in §A1 of this file; §X11 is the master copy and wins on any difference. Error texts are not repeated in the module subsections: a behaviour line cites the ERR-id and only screen-specific texts are quoted.
- **Field messages.** The per-field messages in the tables are the screen-specific instances of ERR-REQ-10..16 with the field name filled in (for example ERR-REQ-10 gives "Sila isi nama kelas."). `{medan}` is the lower-case field label without "*"; `{Medan}` is the same with a capital letter.
- **Subject lists.** Every subject select in this file lists every active subject of the subjects table (`GET /api/subjects?active=1`), never a fixed count; the order named at each select (the V2 order, or A to Z) is the V2 observation and is kept for display. Soalan by Chapter and Heatmap keep their narrower rule (D72) in OPT-SUBJEK. (C-7 of 45 §10.5.)
- **Decisions.** A value followed by "(R1 decision D113)" was delegated by the product owner to the Delivery Lead (D112/D113). It is a requirement.
- **Data and API additions.** Everything this file needs that `50-data-model-erd.md` or `60-api-contract.md` does not yet carry is listed in §A2 as "ADD-n" and cited in the module subsections.
- **Modules without fields.** R1-AS-0 (infrastructure) and R1-GUR-A5 / R1-AS-A5 (a logout control) have no form fields; their subsections say so.
- **Order of the subsection.** Each module subsection holds: (1) a fields table with the columns label, type, required, default, options or data source, validation with exact BM error, dependencies, stored as, API-ID; (2) behaviour lines (errors by ERR-id, empty and loading copy, state machine, calculations with rounding, confirm dialogs, paging, sort, export); (3) the requirements added by this spec (FR and AC IDs that continue the numbering of the module).

### GLB-1 Field message patterns (exact BM)

| Case | Text | Catalogue id | Shown |
|---|---|---|---|
| Required text | "Sila isi {medan}." | ERR-REQ-10 | under the field, red, field focused |
| Required select or radio | "Sila pilih {medan}." | ERR-REQ-11 | same |
| Maximum length | "{Medan} tidak boleh melebihi {n} aksara." | ERR-REQ-12 | same |
| Minimum length | "{Medan} mesti sekurang-kurangnya {n} aksara." | ERR-REQ-13 | same |
| Format | "Format {medan} tidak sah." | ERR-REQ-14 | same |
| Number range | "{Medan} mesti antara {a} dan {b}." | ERR-REQ-15 | same |
| Duplicate (409) | "{Medan} sudah digunakan." | ERR-REQ-16 | same |
| Several errors at submit | banner "{n} medan perlu dibetulkan." plus the inline messages; first invalid field focused | ERR-REQ-01 | top of the form |
| TP | "Tahap Penguasaan (TP) mesti antara 1 dan 6." | ERR-REQ-15 instance | inline |
| Marks | "Markah mesti antara 0 dan 100." | ERR-REQ-15 instance | inline |
| Stimulus group split (422) | existing text of ERR-QST-02 | ERR-QST-02 | at the picker, picker highlighted |
| Seat quota | existing text of ERR-QUOTA-01 | ERR-QUOTA-01 | banner above the import form |
| File too large, wrong type, too many, none chosen | texts of ERR-REQ-05, ERR-REQ-04, ERR-REQ-06, ERR-REQ-07 (server side ERR-REQ-03) | ERR-REQ-03..07 | at the file field |
| Search shorter than 2 characters | "Taip sekurang-kurangnya 2 aksara." | screen text | under the search box |

### GLB-2 Error handling per request

| Condition | Rule | Catalogue id |
|---|---|---|
| 400 / 422 | inline field errors, typed values kept, first invalid field focused | ERR-REQ-01, ERR-REQ-02 |
| 401 | redirect to the login page with the return address; draft restored after login | ERR-AUTH-01 |
| 403 | page "Akses Ditolak" for a route; toast for an action on an open screen | ERR-ACC-01 |
| 404 | page "Halaman Tidak Dijumpai" for a route; toast and list refresh for an action on an open screen | ERR-ACC-02, ERR-ACC-04 |
| 409 duplicate value | inline at the field | ERR-REQ-16 |
| 409 other conflict, stale edit | toast, values kept | ERR-CON-01 |
| 429 | banner with countdown, submit disabled until it ends | ERR-RATE-01 |
| 5xx on an action | toast with reference number | ERR-SYS-01 |
| 5xx on a list or card load | in-place panel with "Cuba Semula" | ERR-SYS-01b |
| Network failure, timeout | banner / toast, form kept, button enabled again | ERR-NET-01, ERR-NET-02 |
| Background poll (Command Center and AS-1 live data, every 10 s) | a failed poll keeps the old values and shows nothing; a 401 follows ERR-AUTH-01 | ERR-NET-01 (silent) |

- **404 or 403.** An object of another teacher answers 404 everywhere (FR-X2-2). The documented exceptions answer 403 because the resource is a report on a known pupil or class: AC-GUR-4-2 (pupil), AC-GUR-6-1 / FR-GUR-6-1 (class page of Analisa Item) and AC-GUR-43-6 (class of Laporan Mingguan). An object of another school, requested by a school admin, answers 404.
- **Double-submit guard.** While a request runs, the button is disabled and shows its busy text ("Menyimpan...", "Menjana...", "Mengimport...", "Memuat naik...", else "Sedang diproses..."); Enter and a second click are ignored (`40-cross-cutting.md` §X10).

### GLB-3 Loading, empty, partial

- Loading: skeleton rows for lists, skeleton cards for KPI cards, the text "Memuatkan..." under the title for a screen without a skeleton.
- Partial failure of one panel: that panel shows ERR-SYS-01b with a "Cuba Semula" button; the other panels stay.
- A list that is empty after a filter or search: "Tiada rekod sepadan dengan tapisan ini." with a link "Set semula tapisan" (clears the filters). A first-time empty state uses the exact copy quoted for the screen.

### GLB-4 Paging, sort, search

- Pager copy: "Menunjukkan {a} hingga {b} daripada {n} keputusan", "Sebelumnya", "Seterusnya"; numbered pages; query `?page=`.
- Page size: 20 (Soalan Saya, Soalan Berstruktur, Databank, private questions); 50 per scroll batch (the Set Soalan and Kertas question picker); 25 (all Admin Sekolah lists, the Headcount table, the Prestasi ranking, any table over 50 rows); 12 (Video list); 10 (top lists); 5 (Top Performers, Paling Meningkat).
- Search is submitted with Enter or its button (no live search); case-insensitive, diacritics-insensitive, substring match, trimmed, at least 2 characters. The type-ahead comboboxes (school, pupil) search from 2 characters and return 20 results.
- Filters survive a page change and a range-pill change (they live in the query string).
- Time zone for "hari ini", week and month: `Asia/Kuala_Lumpur`; a week runs from Monday 00:00 to Sunday 23:59. Rounding is half away from zero.

### GLB-5 Confirm dialogs (exact BM)

| Id | Trigger | Title | Body | Cancel / confirm |
|---|---|---|---|---|
| CF-01 | Padam set (GUR-8b) | "Padam Set Soalan?" | "Padam set \"{title}\"? Tindakan ini tidak boleh diundur." | "Batal" / "Ya, Padam" |
| CF-02 | Padam soalan (GUR-44, 44a) | "Padam Soalan?" | "Padam soalan #{id}? Tindakan ini tidak boleh dibatalkan." | "Batal" / "Ya, Padam" |
| CF-03 | Padam Headcount | "Padam Headcount?" | "Anda pasti mahu padam headcount {subjek} ({n} Simulasi, {tahun})?" and the line "Semua data murid, TOV, ETR, OTR, AR & RS akan dipadam secara kekal." | "Batal" / "Ya, Padam" |
| CF-04 | Reset Data | "Reset Semua Data?" | "Semua markah murid akan dikosongkan — TOV, ETR, OTR, AR & RS." and a list of what is kept: "Senarai murid (tidak dipadam)", "Tetapan headcount (subjek, kelas, tahun)" | "Batal" / "Ya, Reset" |
| CF-05 | Kurangkan OTR | "Kurangkan Bilangan OTR?" | "OTR{k} ke atas mempunyai markah. Padam markah tersebut?" | "Batal" / "Ya, Padam" |
| CF-06 | Batal remedial | "Batal & Jana Semula" | "Batal set soalan remedial untuk {nama}? Anda boleh jana semula selepas ini." | "Kembali" / "Ya, Batal" |
| CF-07 | Padam misi | "Padam Misi?" | "Padam misi \"{tajuk}\"? Ganjaran yang telah diberikan kekal." | "Batal" / "Ya, Padam" |
| CF-08 | Keluarkan pelajar | "Keluarkan Pelajar?" | "Keluarkan {nama} daripada kelas {kelas}? Akaun pelajar tidak dipadam." | "Batal" / "Ya, Keluarkan" |
| CF-09 | Imbas lencana (Command Center) | "Imbas Lencana?" | "Imbas dan anugerahkan lencana kepada pelajar yang layak?" | "Batal" / "Ya, Imbas" |
| CF-10 | Gugurkan murid (Headcount) | "Gugurkan Murid?" | "Gugurkan {n} murid daripada headcount ini? Murid tidak lagi melihat headcount ini." | "Batal" / "Ya, Gugurkan" |
| CF-11 | Jadikan Draf (GUR-8b) | "Jadikan Draf?" | "Set ini tidak lagi kelihatan kepada pelajar. Rekod jawapan yang telah ada kekal." | "Batal" / "Ya, Jadikan Draf" |
| CF-12 | Reset kata laluan (AS-51, AS-52) | "Tetapkan Semula Kata Laluan?" | "Tetapkan semula kata laluan {nama}? Kata laluan baharu dipaparkan sekali sahaja." | "Batal" / "Ya, Tetapkan" |
| CF-13 | Padam kertas peperiksaan (GUR-44e) | "Padam Kertas?" | "Padam kertas \"{nama}\"? Tindakan ini tidak boleh diundur." | "Batal" / "Ya, Padam" |

CF-14 does not exist: the import of pupils has no dialog because the preview step is the confirmation. Dialogs are bottom sheets at 375 px (RP-MODAL); Escape and the overlay cancel; focus is trapped inside.

### GLB-6 Export formats

- CSV: UTF-8 with BOM, comma delimiter, CRLF line ends, a header row, dates `dd/mm/yyyy`, numbers with `.` as decimal separator, file name `{modul}-{yyyymmdd}.csv`. A teacher export never contains a pupil's password, IC number or e-mail. Failure and empty export: ERR-EXP-01, ERR-EXP-02; the button shows "Menyediakan..." while the file is prepared.
- Print or PDF: A4 portrait, no sidebar, header or buttons, a title line, footer "© PRESTASIPLUS".

---

## 1. Purpose, scope and reference rule

### 1.1 Rows and delivery order (D100, D106)

| Role | Delivery A: the 1.0 rows | Delivery B: the rest of the ticked matrix (full sections below) |
|---|---|---|
| Guru | A1, A2, A3, A5; 1 Command Center; 2 Dashboard Guru; 3 Headcount; 4 Prestasi; 5 Analitik Adaptif; 6 Analisa Item (+ "Analisis Item" under LAIN-LAIN); 7 Video; 8 Kelas Saya; 9 Soalan by Chapter; 10 Monitoring; 11 Kirkpatrick (Ringkasan, Tahap 1: Reaksi, Tahap 2: Pembelajaran, Tahap 3: Tingkah Laku, Tahap 4: Hasil, Rantaian Impak, Intervensi); 41 Pelajar Saya; 42 Laporan; 43 Laporan Mingguan; 44 Sumbang Soalan | A4 Tiket Bantuan |
| Admin Sekolah | A5; 1 Command Center; 3 Headcount; 4 Prestasi; 5 Analitik Adaptif; 6 Analisa Item; 7 Video; 10 Monitoring; 11 Kirkpatrick; 45 Sekolah Bersaing; 46 Statistik Penggunaan; 47 DSKP Heatmap; 48 Laporan Aktiviti; 49 Amaran Awal; 50 Laporan Bulanan; 51 Senarai Pelajar; 52 Senarai Guru; 53 Kelas Sekolah | 2 Dashboard; A1 Profil Saya; A2 Tetapan Peribadi; A3 Panduan; A4 Tiket Bantuan |

**D106 (no dead links):** a module that a Delivery-A screen links to ships in Delivery A. Therefore these child modules, although they are not matrix menu rows and get no sidebar item (D77), are built and delivered with 1.0: **R1-GUR-2b Misi Harian** (linked from the Dashboard Guru checklist), **R1-GUR-8b Set Soalan** (the teacher feed of Murid 26 "Set Soalan Guru" and of the "Set soalan guru" button of Murid 8 Kelas Saya), the pupil/class drill pages of Command Center, and the five tools of the Sumbang Soalan "Alat Soalan" block (decision OQ-G-15, 2026-11-04): **R1-GUR-44a Soalan & Rujukan**, **R1-GUR-44b Soalan Berstruktur**, **R1-GUR-44c Soalan Gambar Rajah**, **R1-GUR-44d Databank Soalan**, **R1-GUR-44e Kertas Peperiksaan** (the sixth tool, Set Soalan, is R1-GUR-8b). Everything else that no 1.0 screen links to stays out: Kehadiran Digital, Jadual Belajar, Broadcast Kelas, Live Kelas, Perbandingan Kelas, Verify Soalan, Penjana, Pusat AI (D73), Urus Pengguna, Aktiviti Guru, Langganan, Invois, Notifikasi. Their URLs return the standard 404 (D108(6)). The only hidden modules in the product are those of D102 (Cikgu Alesa, Mohon Keluarga Angkat).

### 1.2 Reference rule
V2 first. V1 where V2 lacks the module or V2 is broken (D9). Otherwise [PRINCIPLE]. Replicate what works, fix only what is broken, minimally, and log it under "Fidelity deviations" (D9/D10). Counts come from one dataset per owner module (D11/D12). Learner/teacher scope is Tingkatan 1-5 (D101); Darjah stays hidden (D72/D96). ALESA AI is hidden (D73). Privacy: no real names.

### 1.3 The V2 school-admin finding (confirmed from V2 code)
- V2 has **no `/admin-sekolah/*` routes and no school-admin portal**. `role_home()` sends `admin`, `admin_sekolah` and `pegawai_ppd` to `/admin` (`app/helpers.php:16-20`). The school is `users.school_id` (`app/Support/StaffScope.php:128-131`); a missing school is 403 (`openedScopeOrAbort()`, lines 142-148).
- V2 scopes to the school (`nav_school_scoped()`, `helpers.php:163-177`): `admin/command-center` (+ `daily-activity` "Aktiviti Sekolah"), `admin/monitoring/export`, **`admin/kirkpatrick` (all 7 screens + export-pdf)**, `admin/laporan-eksekutif`, `admin/schools`, `admin/laporan`. `admin/users` is scoped by `UserDirectory`. National-only (`nav_national_locked()`): `admin/analytics`, `admin/performance`, `admin/feature-toggles` and others.
- V2 write rule for the school admin: edit/reset only active pelajar and guru of the own school, never another admin_sekolah; activation by Admin Pusat (`StaffScope.php:83-97, 195-215`). The V1 Panduan says the school admin can "aktif/nyahaktif akaun guru" (OQ-AS-12).
- V2 analogues: AS rows 1, 10, 11, 48, 50, 51, 52 map to the scoped `/admin/*` pages; rows 3, 4, 5, 6, 7, 45, 46, 47, 49, 53 use V1 (docs M08, M16/M26, M18, M27) or [PRINCIPLE]. V1 content for 46, 47, 50, 51, 52, 53 was never observed.
- Route decision: AS pages keep the `/admin-sekolah/*` prefix of the V3 build (matrix menu names are V1's); see OQ-AS-1.
- **Working rule (user): close, fix and improve the gaps only; never rebuild from scratch** (`40-cross-cutting.md` FR-X1-5). Every module carries "Action: Keep | Fix | Complete | Build" (Keep = matches, verify only; Fix = wrong today; Complete = partly built; Build = missing) and a "Current gap" list of changes to the existing code. The Action table is 6.1b.
- **Self-sufficiency rule (user):** developers and cloud agents never open V1 or V2 and receive no screenshots (they contain live user data and the repository is public). Everything they need from V2 is written in words in the "Screen specification (from V2)" subsection of each module below: route and title, layout regions in order, every field, column, card, filter and tab with its exact BM label, what each button does, and every state and message. Where V2 was not observed the subsection says "Not observed in V2 — follow FR-…". Names of people seen in V2 are never reproduced (they are described as "teacher name" or "pupil name"). V2 pages observed for the school-admin account: the platform dashboard, Command Center, Aktiviti Harian, Monitoring, Laporan, Laporan Eksekutif (with the Kirkpatrick Tahap 1 and Tahap 2 pages), Kirkpatrick Ringkasan, Sekolah Bersaing, Senarai Pengguna, the pupil edit form, Import Pelajar and the Battle school ranking page (plus two admin-only pages, subjects/studio create, not used).
- **V2 facts recorded from the observations (school-admin account):** `/headcount` answers **HTTP 403 "Forbidden"**; `/prestasi`, `/analitik/kelas` and `/analisa-item` all **redirect to `/admin`** (HTTP 200, title "Dashboard - Admin Panel"). So V2 has **no** Headcount, Prestasi, Analitik Adaptif or Analisa Item screen for a school admin; for AS rows 3, 4, 5 and 6 the reference is V1 or [PRINCIPLE] (stated in each module). The `/admin` dashboard shown to a school admin is the platform-question dashboard ("Soalan Aktif 408,353", "Diluluskan 408,197", "Menunggu Review", "Draf", "Subjek 31", "Tahap Pendidikan 11", "Pengguna 1,042 / 864 Pelajar", "Battle Arena", "Tindakan Pantas", "Soalan Terkini", "Taburan Status Soalan", "Pautan Pantas", "Muat Turun Data (CSV)") with national question figures: a V2 defect, not a school dashboard (see AS-2).
- **V2 is itself inconsistent for the same school (what D11/section 5 fixes):** pupils "pernah aktif" = 15 (Command Center, Monitoring) versus 23 (Laporan Eksekutif, Kirkpatrick Tahap 3) versus 22 (Laporan "Murid Buat Latihan"); "Soalan Dijawab" 5,537 (Command Center, Monitoring, Laporan Eksekutif, Tahap 2 cards) versus 8,874 (Kirkpatrick Ringkasan); "Guru pernah login" 2 (Monitoring) versus 57 (Laporan "Cikgu Pernah Akses"). V3 shows one number per measure.

### 1.4 Conventions
- IDs: `R1-GUR-<row>` / `R1-AS-<row>`; `FR-GUR-<row>-<n>`; `AC-GUR-<row>-<n>`. In each module the responsive AC is marked "(R)" and the UAT-data AC is marked "(U)" in its text; when both exist, (R) comes before (U). Numbering has no gaps, so the last number of a module equals its count.
- Priority: P0 blocks 1.0, P1 important, P2 polish.
- UAT accounts used in ACs (fictitious, to be created, FR-AS-0-1): "Guru UAT" (teacher of class "5 UAT" with at least 10 migrated pupils who have answers), "Admin Sekolah UAT" (school admin of a migrated school with at least 50 pupils, 3 teachers, 4 classes and answers in the last 30 days).
- Standard states (exact BM, V1): 403 "Akses Ditolak" / "Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir."; 404 "Halaman Tidak Dijumpai" / "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?"; 500 "Ralat Pelayan" / "Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar lagi." with "Halaman Utama" and "Cuba Semula". Loading "Memuatkan...". A valid role never ends on 500 (V1 defect D-M27-01).

### 1.4b Fully-working rule (D100-D102, D106; `40-cross-cutting.md` FR-X2-0)
- Every ticked module is fully working: no "Pratonton", no "akan datang", no "belum tersedia dalam prototaip", no `PrototypeUnavailablePage`, no mock data, no dead link or button. A control whose target is a prototype page or a missing route gets a working target specified here; it is removed only if neither V2 nor V1 has it.
- No mock data: the release build uses the real API for every Guru/AS screen; `src/modules/*/mock/**` (for example `m08-student-performance/mock/handlers/headcount.ts`, `m10-teacher-class/mock/data/designed.ts`) is test-only and not in the bundle. Seed/UAT dates are relative to now.
- No prototype wording: the scope page copy (`src/app/prototype-scope.ts:56-59`) is never shown for a ticked row. The register of every current notice is **6.2b**.

### 1.4c Scope rules (one rule per role)
- **SC-G (Guru):** a teacher's data = the distinct pupils enrolled in the teacher's own classes ("kelas anda"), Tingkatan 1-5. It applies to Command Center, Dashboard, Headcount, Prestasi, Analitik Adaptif, Analisa Item, Kirkpatrick, Laporan, Laporan Mingguan, Pelajar Saya. **One documented exception: Monitoring**, whose V2 view carries the banner "Data ditapis untuk sekolah anda sahaja." (`guru/monitoring.blade.php:10`, `TeacherController::monitoring`): it covers the teacher's whole school. Evidence for the class rule: V2 `GuruAnalyticsController` (`studentIds($t)` over `classrooms.teacher_id`), V2 `KirkpatrickController` ("scoped to the authenticated guru's own classes"), V2 `TeacherAnalyticsController`. This closes OQ-G-8 and OQ-G-9. Captions never claim a wider scope than the data ("kelas anda" instead of V1's "keseluruhan sekolah").
- **Names (D-A12):** teachers, Admin Sekolah and Admin Pusat see pupils by full name within their scope; another pupil sees a pupil by first name only and no school (pupil screens, `10-murid.md`).
- **SC-AS (Admin Sekolah):** the school of the session user, Tingkatan 1-5, derived server-side; no school id from URL, query or body; no school = 403; an object of another school = 404; other roles on `/admin-sekolah/*` = 403 (never the V1 500 picker).

### 1.5 Responsive pattern catalogue (FR-X6-1..5; thresholds aligned with FR-X6-2/X6-3)
Every module has a closing "Responsive" FR and an "(R)" AC that instantiate these patterns. Below 1024 px the compact shell is used (drawer plus bottom tabs), so 375 and 768 share the shell; 1280 is the desktop shell.

| Pattern | Rule at 375 / 768 / 1280 |
|---|---|
| RP-PAGE | `document.documentElement.scrollWidth <= window.innerWidth` at all three widths. Body text >= 14 px on phone; no text under 12 px anywhere (V1 had 274 nodes under 12 px on Monitoring). |
| RP-TOUCH | Every button, link, tab, pill, chip, select, radio and checkbox hit area >= 44 x 44 px on touch widths, spaced so neighbours are not hit by mistake. |
| RP-KPI | KPI grids: 2 columns at 375, 3-4 at 768, full row at 1280 (7-card rows 2 / 4 / 7). Value >= 20 px, label >= 12 px, values wrap or shrink, never clip. |
| RP-TABLE-LIST | Operational lists (Senarai Pelajar/Guru, Kelas Sekolah, Pelajar Saya, Kelas Saya, Headcount list, Soalan Saya, Set Soalan, Intervensi, Amaran pupil list, Laporan lists, Misi list): at 375 and 768 each row is a **stacked card** (name as title, 2-4 label/value pairs, status chip, actions as >= 44 px buttons); table at 1280. |
| RP-TABLE-WIDE | Analytical tables (Monitoring, Kirkpatrick incl. the 24-hour heat table, Prestasi Kelas rows, Analisa Item rows, Headcount table with TOV/OTR/AR/ETR columns): scroll horizontally **inside their own container**, first column sticky, header row sticky, visible edge fade; > 50 rows paginated 25 per page. |
| RP-CHART | Charts fill the container (no fixed width), height 200-240 px at 375 and 280 px at 1280; axis ticks thinned; legend wraps below; every bar/ring has its value as text. |
| RP-FILTER | Filter bars: full-width stacked at 375, two per row at 768, inline at 1280; pill groups wrap or scroll in their own row. |
| RP-FORM | One column at 375, labels above fields, focused field and submit button stay visible with the keyboard open, sticky action bars never cover fields. |
| RP-MODAL | Modals/drawers are full-width bottom sheets at 375 with a >= 44 px close button and internal scroll. |

Standard wording of an "(R)" AC: "Given <data precondition>, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth, body text >= 14 px, <named controls> are visible and >= 44 px, and <layout outcome>."

---

## 2. The shell for each role

Both roles use the V3 learning shell (`src/shells/pembelajaran/*`; menus from `src/shells/nav/user-nav.ts` through `src/app/prototype-scope.ts`). One menu definition feeds the sidebar, drawer, Ctrl+K search and "Lagi" panel; hidden items are absent, not disabled (FR-G-04). A heading with no visible item is dropped.

### 2.1 Guru shell
**Sidebar (>= 1024 px), exact order** (user's V1 teacher screenshots; labels from the matrix):

| Position | Heading | Items |
|---|---|---|
| top | (none) | "Command Center" with pill "LIVE" (same tab, inside the shell) |
| 1 | HARIAN | "Dashboard Guru"; "Headcount"; "Soalan by Chapter"; "Kelas Saya"; "Pelajar Saya" |
| 2 | PENILAIAN | "Prestasi"; "Laporan" |
| 3 | ANALITIK | "Monitoring"; "Kirkpatrick" (one row with seven in-page tabs "Ringkasan", "Tahap 1: Reaksi", "Tahap 2: Pembelajaran", "Tahap 3: Tingkah Laku", "Tahap 4: Hasil", "Rantaian Impak", "Intervensi"); "Analitik Adaptif"; "Analisa Item"; "Laporan Mingguan" |
| 4 | BANK SOALAN | "Sumbang Soalan" |
| 5 | LAIN-LAIN | "Video"; "Profil Saya"; "Panduan"; "Analisis Item" |
| footer | user card | initials, name, school; opens the account menu |

Delivery B adds "Tiket Bantuan" under a "BANTUAN" heading and in the account menu. V2 labelled row 42 "Laporan Statistik"; the matrix label "Laporan" wins. V2 placed Command Center inside ANALITIK; the V1 position (top) wins.
Header (>= 1024): sidebar toggle; breadcrumb "{HEADING} / {Page title}"; "Cari menu" search (Ctrl+K) listing only permitted items; dark-mode toggle; avatar opening the account menu. No coin chip and no bell (not in the matrix; OQ-G-4).
Account menu: "Profil Saya" -> `/profile`; "Tetapan Peribadi" -> `/tetapan`; "Panduan" -> `/pusat-tuisyen/panduan`; "Log Keluar" -> `/logout` (plus "Tiket Bantuan" in Delivery B).
Responsive: **1280** fixed 256 px sidebar and full header; **768 and 375** no sidebar, hamburger opens a drawer (about 280 px, overlay closes it), header shows the page title only (ellipsis for long titles), bottom tab bar "Dashboard", "Kelas", "Command Center" (LIVE), "Penilaian" (-> Prestasi), "Lagi"; "Lagi" lists every sidebar entry, the account links and "Log Keluar"; main content has bottom padding equal to the tab bar height.

### 2.2 Admin Sekolah shell
**Sidebar (>= 1024 px), Delivery A order** (V1 admin-sekolah screenshots, M27 doc 1.1):

| Position | Heading | Items |
|---|---|---|
| top | (none) | "Command Center" with pill "LIVE"; child link "Aktiviti Harian" (kept by D77(b); not a matrix row, not a new menu) |
| 1 | VISI & PERTANDINGAN | "Sekolah Bersaing" with badge "NEW" |
| 2 | HARIAN | "Senarai Pelajar"; "Senarai Guru"; "Kelas Sekolah" |
| 3 | PENILAIAN | "Headcount"; "Prestasi"; "Amaran Awal"; "Laporan Bulanan" |
| 4 | ANALITIK | "Monitoring"; "Kirkpatrick" (one row, seven in-page tabs as 2.1); "Analitik Adaptif"; "Statistik Penggunaan"; "DSKP Heatmap"; "Analisa Item"; "Laporan Aktiviti" |
| 5 | LAIN-LAIN | "Video" |
| footer | user card | initials, name, school name |

**Delivery B additions:** "Dashboard" first in HARIAN (landing `/admin-sekolah`); "Profil Saya" and "Panduan" in LAIN-LAIN; account menu gains "Profil Saya", "Tetapan Peribadi", "Panduan", "Tiket Bantuan" (heading "BANTUAN"). Delivery A landing = `/admin-sekolah/command-center`.
Hidden: PUSAT AI / AI PINTAR / KAWALAN KUALITI (D73), PENGURUSAN block (Import Pelajar becomes an action on Senarai Pelajar), AKADEMIK, Perutusan menu item (the Delivery B Dashboard reaches it by link), Gambar Rajah.
Header as 2.1 with the school name as sub-line. Responsive as 2.1; bottom tabs (an absent item drops its tab): "Command Center" (LIVE), "Prestasi", "Pelajar" (-> Senarai Pelajar), "Lagi"; the "Dashboard" tab joins in Delivery B.

### 2.3 Shell requirements and acceptance
- **FR-SH-1** The sidebar, drawer, bottom tabs, Ctrl+K and "Lagi" show exactly the items of 2.1 / 2.2 for the delivery in force. A typed URL of anything outside the matrix shows the standard 404 (D108(6)).
- **FR-SH-2** Every menu item opens its own fully working page: never a 403, "Belum tersedia"/"akan datang"/prototype page, mock page or another role's page; every button and link inside reaches a working target (D100).
- **FR-SH-3** The active item is the longest matching route; child routes keep their parent active.
- **FR-SH-4** All pages of this PRD render in the role's learning shell; Guru Monitoring, Kirkpatrick and Command Center must not switch to the admin chrome (today `m12-kirkpatrick/routes/mount.ts:25-30`).
- **FR-SH-5** Responsive per 2.1/2.2, RP-PAGE, RP-TOUCH.
- **AC-SH-1** Given a Guru account, when the sidebar renders at 1280, then headings and items equal the table in 2.1 in that order.
- **AC-SH-2** Given an Admin Sekolah account in Delivery A, when the sidebar renders, then it equals 2.2 and contains no "Dashboard", "Urus Pengguna", "Perutusan" or Pusat AI item.
- **AC-SH-3** Given a Guru and an Admin Sekolah account, when every menu item is clicked in turn, then each page title equals the item label and none shows 403, 404 or "Belum tersedia".
- **AC-SH-4** Given 375 and 768 px, when any page loads, then no sidebar shows, the hamburger (>= 44 px) opens the drawer, the bottom tab bar shows the tabs of 2.1/2.2, and the last content row is not under the tab bar.
- **AC-SH-5** Given each page in this PRD, when measured at 375, 768 and 1280, then scrollWidth <= innerWidth and the header title is visible without overlap (AC-X6-1).

---

## 3. Guru modules

Data scope: SC-G (1.4c). Number definitions: section 5 (XS-1..XS-6).

### R1-GUR-A1 Profil Saya
- **Action: Complete**
- **Screen specification (from V2)**
  - **Route / title:** `/guru/profil/edit`; browser title "Edit Profil Guru — PRESTASIPLUS".
  - **Regions in order:** (1) card "Maklumat Peribadi"; (2) card "Sekolah"; (3) card "Maklumat Profesional"; (4) action row; (5) card "Profil Awam Anda".
  - **Card "Maklumat Peribadi":** "Nama Penuh *" (text, required); "E-mel" (read-only) with help **"E-mel log masuk tidak boleh ditukar di sini."**; "Bio" (multi-line); "No Kad Pengenalan" with help "Digunakan untuk reset kata laluan secara layan diri. Tanpa tanda sempang (-)."
  - **Card "Sekolah":** shows the teacher's current school name (the teacher's own school) with a change control (school search; placeholder/empty copy in the Reference line below).
  - **Card "Maklumat Profesional":** "Subjek Utama"; "Kelayakan"; "Pengalaman (tahun)". There is no "Kelas" field here.
  - **Buttons:** "Batal" (leaves without saving); "Simpan Profil" (saves the form).
  - **Card "Profil Awam Anda":** text "Kongsi profil anda dengan guru-guru lain di platform."; read-only link `https://{host}/guru/profil/{id}`; buttons "Salin Link" (copies the link) and "Lihat" (opens the public page).
  - **States:** populated form observed with values hidden (field values are not part of the specification). Empty, loading, error and success copy: Not observed in V2 — follow FR-GUR-A1-3.
  - **Corrections noted:** (1) the public-profile route is `/guru/profil/{id}` (not `/guru/{id}`): all earlier mentions of `/guru/{id}` below mean `/guru/profil/{id}`; (2) the public profile is shared "dengan guru-guru lain" (V1 said "pelajar dan ibu bapa"): V3 follows V2, so the public page is visible to logged-in teachers (and admins), not to the public or pupils [PRINCIPLE]; (3) the e-mail is read-only on the edit form.
#### Field & behaviour spec — R1-GUR-A1 Profil Saya

Route `/guru/profil/edit`. API: API-GUR-22 (body amended, ADD-11). Errors: ERR-REQ-01, ERR-AUTH-01, ERR-SYS-01, ERR-NET-01.

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Nama Penuh * | text | Yes | current name | max 255 | "Sila isi nama penuh."; over 255: "Nama penuh tidak boleh melebihi 255 aksara." | none | `users.name` | API-GUR-22 |
| E-mel | read-only text | n/a | login e-mail | help text "E-mel log masuk tidak boleh ditukar di sini." | none | none | `users.email` | none |
| Bio | textarea | No | empty | placeholder "Ceritakan tentang diri anda sebagai pendidik..."; max 1000 | "Bio tidak boleh melebihi 1000 aksara." | none | `users.bio` | API-GUR-22 |
| No Kad Pengenalan | text | No | masked value if stored, else empty | placeholder "cth: 860101015432"; exactly 12 digits, no hyphen | "No. IC mesti 12 digit tanpa sempang." | none | `users.ic_hash` (keyed hash), `users.ic_masked`; the full number is never returned | API-GUR-22 |
| Sekolah | combobox | No | current school | placeholder "Taip nama sekolah untuk cari..."; type-ahead from 2 characters, 20 results, sorted by name ascending; none found: "Tiada sekolah dijumpai" | a value not chosen from the list: "Sila pilih sekolah daripada senarai." | none | `users.school_id` | API-GUR-22 |
| Subjek Utama | text | No | empty | placeholder "cth: Matematik, Sains"; max 100 | "Subjek utama tidak boleh melebihi 100 aksara." | none | `teacher_profiles.subject` | API-GUR-22 |
| Kelayakan | text | No | empty | placeholder "cth: Ijazah Sarjana Pendidikan"; max 150 | "Kelayakan tidak boleh melebihi 150 aksara." | none | `teacher_profiles.qualification` | API-GUR-22 |
| Pengalaman (tahun) | integer | No | 0 | 0 to 60 | "Pengalaman mesti antara 0 dan 60 tahun." | none | `teacher_profiles.experience_years` | API-GUR-22 |

- Buttons: "Simpan Profil" saves (busy text "Menyimpan...") and shows the toast "Profil dikemaskini."; "Batal" leaves without saving and without a dialog; "Salin Link" copies the public profile link and shows "Disalin!" for 2 s.
- The IC number is checked for duplicates on `users.ic_hash`; a duplicate shows "No. IC sudah didaftarkan." (ERR-REQ-16 instance).
- Loading: skeleton fields. A failed load shows ERR-SYS-01b.

**Requirements added by this spec**
- **FR-GUR-A1-8** Every field of the table validates as written; a failed save keeps all typed values and shows ERR-REQ-01; the IC is stored only as hash and masked value.
- **AC-GUR-A1-6** Given the profile form with an 11-digit IC, when "Simpan Profil" is pressed, then "No. IC mesti 12 digit tanpa sempang." shows under the field and nothing is saved.
- **AC-GUR-A1-7** Given Pengalaman (tahun) 61, when saved, then "Pengalaman mesti antara 0 dan 60 tahun." shows; with 60 the profile saves and "Profil dikemaskini." shows.

- **Current gap (change the existing code only):** add the route and page `/guru/profil/edit` and the public page `/guru/{id}` (no route exists; `m10-teacher-class/components/dashboard/copy.ts:91` already links to it); add the "Kemaskini Profil" link to the existing `/profile` hero.
- **Name** "Profil Saya". **Route** `/profile` (hero) and `/guru/profil/edit` (Profil Guru). **Matrix** A1. **Priority** P1. **Delivery** A.
- **Current status** V3-GH/UAT: `/profile` generic hero (avatar, nama, emel, "Ahli sejak", "Kemaskini Profil"); no Profil Guru screen; the Dashboard tile "Edit Profil Guru" points to `/guru/profil/edit` which has no route.
- **Outcome** A teacher maintains professional details and shares a public profile.
- **Reference [V2] `guru/profil-edit.blade.php`** (sidebar "Profil Saya" -> `/guru/profil/edit`, title "Edit Profil Guru"; [V1] M10 S32): card "Maklumat Peribadi": "Nama Penuh *" (255), "E-mel" (V1 "E-mel / Username *", help "Ini adalah e-mel login anda. Tukar ke e-mel peribadi supaya lebih mudah diingati."), "Bio" (1000, placeholder "Ceritakan tentang diri anda sebagai pendidik..."), "No Kad Pengenalan" (20, placeholder "cth: 860101015432", help "Digunakan untuk reset kata laluan secara layan diri. Tanpa tanda sempang (-)."); card "Sekolah" (search "Taip nama sekolah untuk cari...", empty "Tiada sekolah dijumpai"); card "Maklumat Profesional": "Subjek Utama" (placeholder "cth: Matematik, Sains"), "Kelayakan" (placeholder "cth: Ijazah Sarjana Pendidikan"), "Pengalaman (tahun)" (0-60, default 0); button "Simpan Profil"; card "Profil Awam Anda" / "Kongsi profil anda dengan pelajar dan ibu bapa." with link `/guru/{id}`, "Salin Link" (becomes "Disalin!") and "Lihat". Public page [V2] `guru/profil-awam.blade.php`: heading "Profil Guru"; "Tentang" (empty "Guru ini belum menulis bio."); "Maklumat Profesional" (Kelayakan, Pengalaman, "—" when empty). V1 "Lihat" was 404 (D-06), fixed by building the page.
- **Functional requirements**
  - **FR-GUR-A1-1** "Profil Saya" in the sidebar opens `/profile`.
  - **FR-GUR-A1-2** `/profile` for a teacher shows the hero plus a "Kemaskini Profil" action that opens `/guru/profil/edit` (no new menu).
  - **FR-GUR-A1-3** `/guru/profil/edit` has the fields above with the V2 labels; "Nama Penuh" is required; IC accepts digits only; saving shows "Profil dikemaskini." ([PRINCIPLE] copy) and the values persist.
  - **FR-GUR-A1-4** `/guru/profil/{id}` is a read-only profile page for other logged-in teachers with nama, Subjek Utama, Bio, Kelayakan, Pengalaman; IC and e-mail are never shown; the e-mail field of the edit form is read-only.
  - **FR-GUR-A1-5** The sidebar "Profil Saya" -> "Kemaskini Profil" and the Pelajar Sekolah card "Tetapan Profil" open `/guru/profil/edit` (V2 has no "Edit Profil Guru" tile on the Dashboard).
  - **FR-GUR-A1-6** Changing school uses the M02 school search; the new school re-scopes the Monitoring data (SC-G exception).
  - **FR-GUR-A1-7** Responsive (RP-FORM, RP-TOUCH): single column at 375; "Salin Link", "Lihat" and "Simpan Profil" >= 44 px.
- **Data** Owner M01/M02. API needed: `GET/PUT /api/account/teacher-profile`, `GET /api/public/teachers/:id`.
- **Acceptance criteria**
  - **AC-GUR-A1-1** Given a teacher with an empty profile, when "Subjek Utama" = "Matematik" is saved, then reopening `/guru/profil/edit` shows "Matematik" and `/guru/profil/{id}` shows "Matematik".
  - **AC-GUR-A1-2** Given teacher B with a bio and an IC, when teacher A opens `/guru/profil/{B}`, then the bio shows and neither the IC nor the e-mail appears.
  - **AC-GUR-A1-3** Given the `/profile` hero, when "Kemaskini Profil" is clicked, then `/guru/profil/edit` opens with the title "Edit Profil Guru" and the e-mail field is read-only with its help text.
  - **AC-GUR-A1-4 (R)** Given a teacher with a saved profile, when `/guru/profil/edit` opens at 375, 768 and 1280 px, then scrollWidth <= innerWidth, labels sit above the fields at 375, and "Simpan Profil" and "Salin Link" are visible and >= 44 px.
  - **AC-GUR-A1-5 (U)** Given "Guru UAT", when "Pengalaman (tahun)" = 7 is saved and the user logs out and in again, then the field shows 7.
- **Gap/root cause** No route/page (`m10-teacher-class/components/dashboard/copy.ts:91`). **Deviations** DV-GUR-A1-1 public page built (V1 404). **Open** none (decided as OQ-G-2, section 6.2).

### R1-GUR-A2 Tetapan Peribadi
- **Action: Complete**
- **Screen specification (from V2)**
  - **Route / title:** `/tetapan`; browser title "Tetapan — PRESTASIPLUS".
  - **Regions in order:** page header; user card; account rows; footer note.
  - **Header:** small label "⚙️ Profil", heading "Tetapan Peribadi", sub-line "Maklumat akaun anda dalam mod baca sahaja." (an initials avatar sits beside it).
  - **User card:** initials avatar, the teacher's name, role "Guru".
  - **Rows (label / value, all read-only):** "📱 Telefon" ("—" when empty); "🏫 Sekolah" (school name); "👤 Peranan" ("Guru"); "✅ Status" ("● Aktif").
  - **Footer note (exact V2 copy):** "🔒 Untuk mengedit maklumat profil, sila log masuk dengan akaun anda. Halaman ini hanya menunjukkan data dalam mod demo."
  - **Buttons/links:** none observed.
  - **States:** populated only; empty/loading/error: Not observed in V2 — follow FR-GUR-A2-2.
  - **Corrections noted:** (1) V2's page is a read-only account card with no "Mod Rohani"; V1 has the "Mod Rohani" preference: V3 keeps both (the V2 card on top, the V1 preference below, already built); (2) the V2 footer note says "mod demo" and tells the user to log in again: this is a prototype/demo notice (forbidden, D100) and is replaced by "Untuk menukar maklumat akaun, buka Profil Saya." with a link to `/profile` (DV-GUR-A2-1).
#### Field & behaviour spec — R1-GUR-A2 Tetapan Peribadi

Route `/tetapan`. API: the existing account settings endpoint (contract `account/schema.ts`: `spiritualMode`, `faith`). Errors: ERR-REQ-01, ERR-SYS-01, ERR-NET-01.

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Mod Rohani | toggle | No | off | on / off | none | none | `user_settings.spiritualMode` | settings endpoint |
| Agama / kepercayaan (section "🌍 Latar Agama (opsyen)") | select `id="faith"` | No | stored value, else "— Tidak nyatakan —" | OPT-FAITH; sub-text "Bagi konteks supaya kandungan lebih relevan. Tidak diwajibkan."; help "Untuk mod rohani yang sesuai." | none | enabled only while Mod Rohani is on | `user_settings.faith` (null for "— Tidak nyatakan —") | settings endpoint |
| Telefon | read-only text | n/a | "—" if empty | none | none | none | `users.phone` | none |
| Sekolah | read-only text | n/a | school name | none | none | none | `users.school_id` | none |
| Peranan | read-only text | n/a | "Guru" | none | none | none | `user_roles.role` | none |
| Status | read-only text | n/a | "● Aktif" or "● Tidak Aktif" | none | none | none | `users.is_active` | none |

- "Simpan" saves (busy "Menyimpan...") and shows the toast "Tetapan disimpan." The footer line reads "Untuk menukar maklumat akaun, buka Profil Saya." with a link to `/guru/profil/edit`.
- The V2 help sentence about future Hindu, Buddhist and Christian content is a roadmap notice and is not shown (D102, R1 decision D113).
- Turning Mod Rohani off disables the select but keeps the stored value.

**Requirements added by this spec**
- **FR-GUR-A2-4** The Latar Agama select offers exactly the options of OPT-FAITH and is enabled only while Mod Rohani is on; the account block rows are read-only.
- **AC-GUR-A2-4** Given Mod Rohani off, when the page opens, then the Latar Agama select is disabled; when the toggle is switched on, then it is enabled with the six options of OPT-FAITH, and "Simpan" shows "Tetapan disimpan."

- **Current gap (change the existing code only):** the page of route `/tetapan` keeps its V1 content; add the read-only "Tetapan Akaun" block (e-mel, telefon, sekolah, peranan, status).
- **Route** `/tetapan`. **Matrix** A2. **Priority** P2. **Delivery** A. **Status** GH/UAT exists ("Mod Rohani", "Latar Agama", "Simpan"); equals V1.
- **Reference** [V1] only the spiritual-mode preference; [V2] "Tetapan Akaun" (e-mel, telefon, sekolah, peranan, status).
- **Functional requirements**
  - **FR-GUR-A2-1** Keep the V3 content (V1 parity: "Mod Rohani", "Latar Agama", "Simpan").
  - **FR-GUR-A2-2** Add the read-only block "Tetapan Akaun" with e-mel, telefon, sekolah, peranan, status as in V2 (OQ-G-3).
  - **FR-GUR-A2-3** Responsive (RP-FORM, RP-TOUCH).
- **Acceptance criteria**
  - **AC-GUR-A2-1** Given Mod Rohani off, when it is switched on and "Simpan" is pressed, then reloading shows it on.
  - **AC-GUR-A2-2 (R)** Given the page, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth and the toggle, the "Latar Agama" select and "Simpan" are visible and >= 44 px.
  - **AC-GUR-A2-3 (U)** Given "Guru UAT", when the block "Tetapan Akaun" opens, then e-mel, sekolah and peranan equal the user's M01/M02 record.
- **Gap** V2 account block absent. **Open** none (decided as OQ-G-3, section 6.2).

### R1-GUR-A3 Panduan
- **Action: Fix**
- **Screen specification (from V2)**
  - **Route / title:** `/panduan`; browser title "Panduan Pengguna — PRESTASIPLUS". Breadcrumb "Laman Utama" / "Dashboard".
  - **Regions in order:** hero; five role cards; the guide of the chosen role (three blocks: "Cara ..." steps, "what you can do" cards, FAQ accordion); help footer block.
  - **Hero:** icon 📖, heading "Panduan Pengguna PRESTASIPLUS", sub-line "Pilih peranan anda untuk mula. Semua maklumat di hujung jari!"
  - **Role cards (select a guide):** "👨‍🎓 Pelajar" / "Darjah 1 – Tingkatan 5"; "👩‍🏫 Guru" / "Guru Mata Pelajaran"; "👪 Ibu Bapa" / "Pemantauan Anak"; "🏫 Admin Sekolah" / "Pengetua / GPK"; "📊 PPD / JPN" / "Pegawai Daerah / Negeri". The first view shows the Pelajar guide.
  - **Pelajar guide:** "Cara Daftar Akaun Pelajar" (5 steps: 1 "Buka Laman Web", 2 "Klik "Daftar"", 3 "Isi Maklumat", 4 "Masuk Kelas", "✓ Siap! Mula Berlatih"); "Apa Yang Boleh Anda Buat" (cards "Latih Tubi", "Kombo Harian", "Battle", "Prestasi 360", "Ranking & Lencana", "Koin & Ganjaran"); "Soalan Lazim Pelajar" (5 questions, e.g. "Macam mana nak reset kata laluan?", "Saya tak ada e-mel. Boleh daftar?", "Apa itu Kombo?", "Boleh tukar kelas?", "Macam mana nak naikkan ketepatan?").
  - **Guru guide:** "Cara Daftar Akaun Guru" (steps "Daftar di ...", "Pilih Sekolah", "Cipta Kelas", "Kongsi Kod Kelas", "✓ Siap!"); "Alat-Alat Guru" (cards "Kelas Saya", "Prestasi Kelas", "Headcount", "Amaran Awal", "Log Intervensi", "Kombo Kelas", "Analisa Item", "Sumbang Soalan"); "Soalan Lazim Guru" (5 questions, e.g. "Macam mana nak import pelajar secara pukal?", "Apa itu Headcount?", "Bagaimana Log Intervensi berfungsi?").
  - **Ibu Bapa guide:** "Cara Daftar Akaun Ibu Bapa" (3 steps + "✓ Siap! Pantau Anak Anda"); "Apa Yang Ibu Bapa Boleh Lihat" ("Prestasi 360 Anak", "Penguasaan Subjek", "Peta Aktiviti", "Cadangan Pintar"); "Soalan Lazim Ibu Bapa" (3 questions).
  - **Admin Sekolah guide:** "Cara Mula Sebagai Admin Sekolah" (3 steps: "Hubungi Admin PRESTASIPLUS", "Daftar Guru", "Import Pelajar", then "✓ Siap!"); "Fungsi Admin Sekolah" ("Urus Guru", "Urus Pelajar", "Prestasi Sekolah", "Amaran Awal", "Ringkasan Eksekutif", "Statistik Penggunaan"); "Soalan Lazim Admin" (3 questions: CSV format, reset password, print Ringkasan Eksekutif).
  - **PPD / JPN guide:** "Cara Mula Sebagai PPD / JPN" (2 steps + "✓ Siap!"); "Fungsi PPD / JPN" (6 cards); "Soalan Lazim PPD / JPN" (4 questions).
  - **Help footer block:** 💬 "Perlukan Bantuan Lanjut?" / "Hubungi pasukan sokongan kami untuk sebarang pertanyaan." with the links "E-mel Kami" and "Tiket Bantuan"; page footer "© 2026 PRESTASIPLUS 🇲🇾" / "Platform Latih Tubi Nasional".
  - **States:** populated only. Empty/loading/error: Not observed in V2 — follow FR-GUR-A3-2.
  - **Corrections noted:** (1) V2 does **not** pre-select the user's role: the first view is the pupil guide and the user picks a role card; V3 follows V2 (the earlier "Guru tab by default" idea is dropped, FR-GUR-A3-1 rewritten); (2) the card text "Darjah 1 – Tingkatan 5" becomes "Tingkatan 1 – Tingkatan 5" (Darjah hidden, D72); (3) V2 text says "prestasiplus.my": the product's own host is shown instead.
#### Field & behaviour spec — R1-GUR-A3 Panduan

Route `/panduan`. API: API-SUP-04 (`GET /api/config/support`). The page has no form field.

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Role cards | single-choice cards | n/a | "Pelajar" (V2 does not pre-select the user's role) | "Pelajar", "Guru", "Ibu Bapa", "Admin Sekolah", "PPD / JPN"; the chosen guide replaces the three blocks below the cards | none | none | not stored (view state) | none |
| Soalan Lazim | accordion | n/a | all closed | one item open at a time | none | chosen role | static copy | none |
| E-mel Kami, Tiket Bantuan | links | n/a | n/a | e-mail address from API-SUP-04; "Tiket Bantuan" opens `/pusat-tuisyen/tiket` | none | support settings present | support settings | API-SUP-04 |

- Support contact block: shown only when API-SUP-04 returns at least one value; the endpoint answers 200 with empty values when nothing is configured (never 404), and then the contact block is hidden and the "Tiket Bantuan" link stays.
- The Guru guide step "Kongsi Kod Kelas" is shown as "Tambah Pelajar" with the sentence "Tambah pelajar ke kelas anda daripada Kelas Saya.", because class codes are not built (DV-GUR-8-1, R1 decision D113).
- The pupil card reads "Tingkatan 1 – Tingkatan 5" (Darjah hidden, D72). A failed load of the support contact shows nothing (no banner); ERR-SYS-01b applies to the page content only.

**Requirements added by this spec**
- **FR-GUR-A3-5** The Guru guide never mentions a class code or a join step; the contact block is hidden when API-SUP-04 returns no value.
- **AC-GUR-A3-5** Given API-SUP-04 returns empty values, when the page opens, then no error banner shows, the contact block is absent, and the Guru guide has no text "Kod Kelas".

- **Current gap (change the existing code only):** show "Tingkatan 1 – Tingkatan 5" on the pupil card; `GET /api/config/support` returns 404 on UAT (`apps/api/.../support.service.ts:113`): answer 200 with empty defaults and hide the contact block.
- **Route** `/panduan` (alias `/pusat-tuisyen/panduan`). **Matrix** A3. **Priority** P2. **Delivery** A. **Status** GH ok; UAT `GET /api/config/support` returns 404 "Konfigurasi sokongan tidak dijumpai." and the page shows an error.
- **Reference [V1] M09**: tabs per role (Pelajar, Guru, Ibu Bapa, Admin Sekolah, PPD); contact block fed by the support setting.
- **Functional requirements**
  - **FR-GUR-A3-1** The five role cards "Pelajar", "Guru", "Ibu Bapa", "Admin Sekolah", "PPD / JPN" are shown; the first view is the pupil guide "Cara Daftar Akaun Pelajar" as in V2, and choosing a card shows that role's guide.
  - **FR-GUR-A3-2** The support contact (e-mel, telefon, WhatsApp, waktu) is read from `GET /api/config/support`, fed by an **admin setting "Tetapan Sokongan"** (V2 `/admin/settings`) specified in `30-admin-pusat.md` FR-ADM-N07 (decision OQ-X-1, section 6.2); the endpoint always answers 200 (empty defaults when unset) and the page hides the contact block instead of showing an error.
  - **FR-GUR-A3-3** Every instruction names a control that exists.
  - **FR-GUR-A3-4** Responsive: tabs scroll inside their own row; content single column (RP-TOUCH).
- **Acceptance criteria**
  - **AC-GUR-A3-1** Given a teacher, when `/panduan` opens, then the five role cards show, the guide "Cara Daftar Akaun Pelajar" is shown first, and choosing "Guru" shows the teacher guide.
  - **AC-GUR-A3-2** Given the support setting is not yet saved, when `/panduan` opens, then HTTP 200 for `/api/config/support`, no error banner and no contact block.
  - **AC-GUR-A3-3 (R)** Given the Panduan page, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth and the five role tabs are reachable (scroll inside the tab row) at >= 44 px.
  - **AC-GUR-A3-4 (U)** Given UAT with the support row saved by an admin, when "Guru UAT" opens `/panduan`, then the saved e-mel and telefon show.
- **Gap** UAT support row missing (`support.service.ts:113`). **Open** none.

### R1-GUR-A4 Tiket Bantuan (Delivery B)
- **Action: Keep**
- **Screen specification (from V2)**
  - **Route / title:** `/pusat-tuisyen/tiket` (the "Semua" tab also resolves to `/tiket`); browser title "Tiket Bantuan — PRESTASIPLUS".
  - **Regions in order:** header (count + button); inline form "Tiket Baru"; status tabs; list or empty state.
  - **Header:** "Jumlah tiket: {n}" and button "Tiket Baru" (shows the form).
  - **Form "Tiket Baru":** fields **"Subjek"** and **"Butiran"** only (no category); button "Hantar Tiket".
  - **Status tabs:** "Semua", "Dibuka", "Dalam Proses", "Menunggu Balas", "Selesai", "Ditutup" (each filters the list).
  - **Empty state:** "Tiada tiket lagi." with button "Buat Tiket Pertama" (opens the form).
  - **States:** empty observed ("Jumlah tiket: 0"). Populated list rows, ticket thread page, replies, success/error messages: Not observed in V2 — follow FR-GUR-A4-2 and FR-GUR-A4-4.
#### Field & behaviour spec — R1-GUR-A4 Tiket Bantuan (shared with R1-AS-A4)

Routes `/pusat-tuisyen/tiket`, `/baru`, `/:id`. API: API-SUP-01 (list, `status` filter), API-SUP-02 (create). Errors: ERR-REQ-01, ERR-RATE-01, ERR-SYS-01.

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Subjek | text | Yes | empty | max 255 | "Sila isi subjek."; over 255: "Subjek tidak boleh melebihi 255 aksara." | none | `support_tickets.subject` | API-SUP-02 |
| Butiran | textarea | Yes | empty | max 5000 (the limit of API-SUP-02) | "Sila isi butiran."; over 5000: "Butiran tidak boleh melebihi 5000 aksara." | none | `support_tickets.body` | API-SUP-02 |
| Status tabs | tabs | n/a | "Semua" | OPT-STATUS-TIKET: "Semua" (no filter), "Dibuka", "Dalam Proses", "Menunggu Balas", "Selesai", "Ditutup" | none | none | `support_tickets.status` slugs `dibuka`, `dalam_proses`, `menunggu_balas`, `selesai`, `ditutup` | API-SUP-01 |

- There is no category and no attachment field (the attachment picker mentioned in FR-GUR-A4-5 is removed). "Tiket Baru" shows the inline form; "Hantar Tiket" saves (busy "Menyimpan...") and shows the toast "Tiket dihantar."; the form closes and the list reloads with the new ticket first.
- Counter "Jumlah tiket: {n}". List: newest first, 25 per page; a row shows subject, status chip, date `dd/mm/yyyy`. Empty: "Tiada tiket lagi." with the button "Buat Tiket Pertama". The thread page shows subject, status chip, body, date, and the admin reply (`support_tickets.admin_reply`) when present.
- Stored status values are the Malay slugs of OPT-STATUS-TIKET (40 X11); an English value (`open`, `in_progress`, `waiting_reply`, `resolved`, `closed`) is never stored, sent or filtered on. State machine: `dibuka` to `dalam_proses` to `menunggu_balas` to `selesai` to `ditutup`, moved by the admin only; the owner cannot reply and opens a new ticket instead. A ticket of another user answers 404 (ERR-ACC-02).

**Requirements added by this spec**
- **FR-GUR-A4-6** The ticket form has the two fields and limits of the table, no category and no attachment; the owner sees status and admin reply only.
- **AC-GUR-A4-6** Given an empty Subjek, when "Hantar Tiket" is pressed, then "Sila isi subjek." shows and no ticket is created; with both fields filled, the toast "Tiket dihantar." shows and "Jumlah tiket" rises by 1.
- **AC-GUR-A4-7** Given tickets in three statuses, when the tab "Selesai" is chosen, then only `selesai` tickets list; "Semua" lists all.

- **Current gap:** None in the screen (built). The scope filter hides the entry (`src/app/prototype-scope.ts`, `ACCOUNT_ITEMS`): show it in Delivery B; the support contact setting is FR-ADM-N07 (OQ-X-1). Verify the ACs only.
- **Route** `/pusat-tuisyen/tiket` (+ `/baru`, `/:id`). **Matrix** A4. **Priority** P2. **Status** GH/UAT built (list, "Tiket Baru", status filter, empty state), hidden by scope.
- **Reference [V2] sidebar "Bantuan" > "Tiket Bantuan"; [V1] M22; same screens as `10-murid.md` R1-MUR-A4**: list with status filters "Semua", "Dibuka", "Dalam Proses", "Menunggu Balas", "Selesai", "Ditutup"; "Tiket Baru" (Subjek, Butiran: no category); the ticket page shows the single admin reply (OD-4). The support contact shown on the page comes from the admin setting of A3.
- **Functional requirements**
  - **FR-GUR-A4-1** "Tiket Bantuan" appears under "BANTUAN" and in the account menu (A4 is ticked for every role, D108(4)).
  - **FR-GUR-A4-2** (OD-4 of `50-data-model-erd.md`: single reply, no thread) The teacher creates a ticket (Subjek, Butiran), sees only own tickets, and sees the single admin reply under "Balasan Sokongan" and the status; the teacher cannot reply to it (a new ticket is opened instead); the ticket reaches the Admin Pusat "Urus Tiket" screen (V2 `/admin/tiket`, Admin PRD).
  - **FR-GUR-A4-3** The support-contact block uses the same setting and 200-always endpoint as FR-GUR-A3-2.
  - **FR-GUR-A4-4** Every button works (Tiket Baru, filters, Kembali); there is no "Hantar balasan" for the owner (OD-4); no mock data.
  - **FR-GUR-A4-5** Responsive: RP-TABLE-LIST cards, RP-FORM, RP-TOUCH (there is no attachment picker).
- **Acceptance criteria**
  - **AC-GUR-A4-1** Given "Guru UAT" with no tickets, when "Tiket Baru" is sent with subjek "Ujian" and a message, then the list shows it with status "Dibuka" and the Admin Pusat tiket screen lists it.
  - **AC-GUR-A4-2** Given an admin reply on that ticket, when the teacher opens it, then the reply and the new status show.
  - **AC-GUR-A4-3** Given another user's ticket id, when the teacher opens it, then 404.
  - **AC-GUR-A4-4** Given an empty list, when the page opens, then the empty state and the "Tiket Baru" button show.
  - **AC-GUR-A4-5 (R)** Given 3 tickets, when the list opens at 375, 768 and 1280 px, then scrollWidth <= innerWidth, tickets are cards at 375 and 768, and "Tiket Baru", the status filter are visible and >= 44 px.
- **Open** none.

### R1-GUR-A5 Log Keluar
- **Action: Keep**
- **Screen specification (from V2):** Not observed in V2 as a page (the logout control sits in the V2 header, no screen of its own) — follow FR-GUR-A5-1.
- **Current gap:** None. Verify the ACs only.
- **Route** `/logout`. **Priority** P1. **Delivery** A. **Status** works.
- **Functional requirements**
  - **FR-GUR-A5-1** "Log Keluar" is the last row of the account menu and of "Lagi"; one action ends the session and opens `/login`.
  - **FR-GUR-A5-2** Responsive: the control is >= 44 px and visible without scrolling the "Lagi" panel at 375.
- **Acceptance criteria**
  - **AC-GUR-A5-1** Given a logged-in teacher, when "Log Keluar" is used, then `/login` shows and the browser back button does not restore the session.
  - **AC-GUR-A5-2 (R)** Given a logged-in teacher, when opened at 375, 768 and 1280 px, then "Log Keluar" is reachable (375/768 through "Lagi", 1280 through the avatar menu), >= 44 px, and scrollWidth <= innerWidth.

---

#### Field & behaviour spec — R1-GUR-A5 Log Keluar

No form field. "Log Keluar" ends the session, deletes the saved drafts of the browser session (`pp.draft.*`, `40-cross-cutting.md` §X10) and opens the login page. If the request fails the session is still cleared on the device (ERR-NET-01 is not shown).

**Requirements added by this spec**
- **FR-GUR-A5-3** Logging out deletes every saved form draft of the session before the login page opens.
- **AC-GUR-A5-3** Given a saved draft under `pp.draft.*`, when the user logs out, then the key no longer exists and the login page shows.

### R1-GUR-1 Command Center
- **Action: Complete**
- **Screen specification (from V2)** (authoritative; overrides the V1 text below where they differ)
  - **Route / title:** `/guru/command-center`; browser title "Command Center — PRESTASIPLUS".
  - **Regions in order:** (1) header; (2) action bar; (3) KPI row; (4) left column of panels; (5) right column of panels; (6) full-width panels (Ramalan SPM, Badges); (7) remedial panel; (8) footer; (9) drill modal (hidden until a card is clicked).
  - **Header:** "Command Center" / "Data pelajar & kelas anda — masa nyata setiap kali muat semula"; a "LIVE" dot with the clock "HH:MM:SS", a second clock and "MYT".
  - **Action bar (only two buttons):** "⚠ Evaluate"; "📊 Rekod"; hint "Klik kad KPI untuk drill-down · data kelas anda".
  - **KPI cards (value / sub-line):** "Pelajar Berdaftar 🔍" / "{n} aktif menjawab hari ini"; "Soalan Dijawab 🔍" / "{n} hari ini"; "Ketepatan Purata 🔍" / "keseluruhan kelas anda" (value as "{p}%"); "GPS Kelas" / "purata GPS (rendah = baik)" ("—" without data). Cards with 🔍 open the drill modal; "GPS Kelas" has no 🔍.
  - **Panel "📚 Kelas Saya":** list of classes; empty "Belum ada kelas."
  - **Panel "🔬 Kirkpatrick":** four bars "T1" ("{p}%"), "T2" ("{p}%"), "T3" ("{n} pelajar"), "T4" ("—").
  - **Panel "💚 Mood Pelajar":** four counters "😊 Gembira", "😐 OK", "😢 Sedih", "😣 Tertekan".
  - **Panel "🤖 ALESA — Ringkasan":** one sentence ("{p}% pelajar terlibat aktif. Ketepatan purata {p}%. GPS kelas: {x}."); hidden in V3 (D73).
  - **Panel "📈 Aktiviti Hari Ini":** "{n} soalan"; "Minggu ini: {n}"; comparison text "Sama dengan minggu lepas" (or the +/- variant).
  - **Panel "⚡ Live Feed":** recent answers; empty "Tiada aktiviti terkini."
  - **Panel "🏆 Leaderboard Minggu Ini":** empty "Tiada data minggu ini."
  - **Panel "📊 Engagement Pelajar":** "Jumlah: {n} pelajar"; five bars "Champion", "Konsisten", "Berkembang", "Minimum", **"Tidak Terlibat"**.
  - **Panel "🔮 Ramalan SPM — Predictive Analytics":** empty "Tiada data prestasi mencukupi untuk ramalan lagi."
  - **Panel "🏆 Badges — Achievement System":** tiles "{n}" "Lencana Baru Dianugerah" and "{n}" "Jenis Lencana Aktif" (observed 3); sub-heading "Lencana Terbaru"; empty "Belum ada lencana dianugerahkan kepada pelajar anda."
  - **Panel "🧪 Set Pemulihan AI":** button "🔍 Imbas Topik Lemah" (busy text "Mengimbas..."); button "Batal"; empty "Tiada topik lemah dikesan (semua ≥ 50% ketepatan atau data tidak mencukupi)."; sub-heading "📋 Set Pemulihan (soalan sedia ada)" (list of existing sets).
  - **Footer:** "Powered by ALESA · PRESTASIPLUS © 2026 · Data dikemas kini secara langsung setiap 10 saat" (V3 drops the ALESA words, D73).
  - **Drill modal:** close "×"; loading "Memuatkan data..."; empty "Tiada data."
  - **States:** the empty teacher state (all zeros) is the one observed; populated values are specified by the V1 text and FRs below. Error: Not observed in V2 — follow FR-GUR-1-3.
  - **Corrections noted:** (1) V2 has two top buttons only; "Remedial" is the panel "🧪 Set Pemulihan AI" ("Imbas Topik Lemah"), and "Ramalan SPM", "Badges" and "Kelas" are in-page panels, not modals: V3 follows V2 (its extra top-bar buttons become anchors to those panels, DV-GUR-1-5); (2) KPI sub-lines are "aktif menjawab hari ini" and "{n} hari ini" (V1: "aktif menjawab" and "sepanjang masa"), so the main figures are all-time and the sub-lines state "hari ini"; (3) the engagement label is "Tidak Terlibat" (V1 "Disengaged"); (4) V2 already says "keseluruhan kelas anda", confirming the class scope; (5) the Kirkpatrick panel is on this Guru board (V2) though it is not on the school-admin board.
#### Field & behaviour spec — R1-GUR-1 Command Center

Route `/guru/command-center`. API: API-GUR-13 (live data, drill, evaluate, predictive, achievements, badge holders), API-GUR-12 (remedial, Rekod), API-GUR-14 (drill pages). The page has no form field; it has controls and computed cards.

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| ⚠ Evaluate | button | n/a | n/a | opens the evaluation output of FR-GUR-1-5 | none | at least one class | not stored | API-GUR-13 |
| 📊 Rekod | link | n/a | n/a | opens `/guru/remedial-progress` | none | none | n/a | API-GUR-12 |
| KPI card "Pelajar Berdaftar" | card (click opens the drill modal) | n/a | n/a | XS-1; sub-line "{n} aktif menjawab hari ini" (XS-2, today) | none | none | computed | API-GUR-13 |
| KPI card "Soalan Dijawab" | card (drill) | n/a | n/a | XS-4 all time; sub-line "{n} hari ini" | none | none | computed | API-GUR-13 |
| KPI card "Ketepatan Purata" | card (drill) | n/a | n/a | XS-5 (wire one decimal, screen whole number rounded half up, D-T10-1) with "%", "—" when no answer; sub-line "keseluruhan kelas anda" | none | none | computed | API-GUR-13 |
| KPI card "GPS Kelas" | card (no drill) | n/a | n/a | mean GPS of pupils with a GPS, 2 decimals, "—" when none; sub-line "purata GPS (rendah = baik)" | none | OPT-GRED grade points | computed | API-GUR-13 |
| Panel "📊 Engagement Pelajar" | five bars | n/a | n/a | OPT-ENGAGEMENT over all-time answers of the teacher's pupils; "Jumlah: {n} pelajar" | none | none | computed | API-GUR-13 |
| "🔍 Imbas Topik Lemah" | button | n/a | n/a | scans topics with accuracy below 50% and enough data; busy text "Mengimbas..."; "Batal" stops a running scan | none | at least one class | remedial set rows | API-GUR-12 |
| Badges scan | button | n/a | n/a | awards badges to eligible pupils after CF-09 | none | none | achievement rows | API-GUR-13 |
| Drill modal | modal | n/a | closed | opens from a KPI card or a row; close "×"; loading "Memuatkan data..."; empty "Tiada data." | none | none | n/a | API-GUR-13 |

- Refresh: the board polls live data every 10 s (GLB-2: a failed poll keeps the old values silently). Footer line: "Data dikemas kini secara langsung setiap 10 saat".
- Empty copy per panel: as quoted in the Screen specification ("Belum ada kelas.", "Tiada aktiviti terkini.", "Tiada data minggu ini.", "Tiada data prestasi mencukupi untuk ramalan lagi.", "Belum ada lencana dianugerahkan kepada pelajar anda.", "Tiada topik lemah dikesan (semua ≥ 50% ketepatan atau data tidak mencukupi).").
- Panel failure: ERR-SYS-01b in that panel only. "Batal" on a generated remedial set opens CF-06; the badge scan opens CF-09.
- Mood counters count the latest check-in of each pupil in the last 7 days (R1 decision D113). Live Feed shows the latest 15 answers; Leaderboard shows the top 5 pupils by answers in the current week (ties: accuracy descending, then name).

**Requirements added by this spec**
- **FR-GUR-1-13** The engagement panel uses OPT-ENGAGEMENT (non-overlapping bands) and the KPI cards use XS-1, XS-2, XS-4 and XS-5 with the sub-lines of the table.
- **FR-GUR-1-14** The badge scan and the batal action of a remedial set each ask for confirmation (CF-09, CF-06) before they write.
- **AC-GUR-1-9** Given pupils with 0, 3, 12, 30 and 60 answers, when the engagement panel opens, then they fall into Tidak Terlibat, Minimum, Berkembang, Konsisten and Champion, one each.
- **AC-GUR-1-10** Given "Imbas Lencana" pressed, when CF-09 is cancelled, then no badge is awarded; when confirmed, the tile "Lencana Baru Dianugerah" updates.

- **Current gap (change the existing code only):** `m10-teacher-class/pages/CommandCenterPage.vue:86-170`: caption "kelas anda"; BM drill titles; make Remedial, Evaluate and Badges work end to end and click-test them; build the pupil and class drill pages (`/guru/command-center/student/:id`, `/classroom/:id`); keep all six actions reachable at 375 (chip row); no ALESA text.
- **Name** "Command Center". **Route** `/guru/command-center` (child `/guru/remedial-progress` "Rekod"; drills `/guru/command-center/classroom/:id`, `/guru/command-center/student/:id`). **Matrix** 1. **Priority** P1. **Delivery** A. **Status** GH/UAT built, function equals V1; seed shows 15 questions and 0 active.
- **Outcome** Live snapshot of the teacher's own pupils (SC-G); polling every 10 s.
- **Reference [V1] M10 S2 / [V2] `guru/command-center`**:
  - Top bar: "← Dashboard" (`/guru`); title "Command Center"; links "🔬 Remedial", "📊 Rekod", "⚠ Evaluate", "🔮 Ramalan SPM", "👩‍🏫 Kelas", "🏆 Badges"; "LIVE" dot and clock "HH:MM:SS MYT".
  - KPI tiles (each opens a drill): "Pelajar Berdaftar" ("{n} aktif menjawab"), "Soalan Dijawab" ("sepanjang masa"), "Ketepatan Purata", "GPS Sekolah" ("purata GPS").
  - Panels: "📚 Kelas Saya" ("Tiada data"); "🔬 Kirkpatrick" T1 "☆☆☆☆☆ 0/10", T2 "0% ketepatan", T3 "0 aktif 30h", T4 "GPS 0"; "💚 Mood Pelajar" (😊 Gembira, 😐 OK, 😢 Sedih, 😩 Tekanan); "📈 Aktiviti Hari Ini" ("{n} soalan", "Minggu ini:", "Sama dengan minggu lepas" or "▲ +n% vs minggu lepas"); "⚡ Live Feed" ("Tiada aktiviti terkini"); "🏆 Leaderboard Minggu Ini" ("Tiada data minggu ini"); "📊 Engagement Pelajar" (Champion >50 soalan, Konsisten 20-50, Berkembang 5-20, Minimum <5, Disengaged 0). ALESA panel and footer "Powered by ALESA AI" hidden (D73); keep "Data dikemaskini setiap 10 saat".
  - Drill modal: loading "Memuatkan data...", empty "Tiada data"; columns gps: Subjek · GPS · Gred · Pelajar · Sumber; subjects: Subjek · Jawapan · Betul · Ketepatan · Pelajar; today: Masa · Pelajar · Subjek · Soalan · Betul · Ketepatan; mood: Pelajar · Tarikh · Sebab. V1 defect D-04 (raw key as title, empty body) is fixed with BM titles.
  - "Gred" from GPS (V1 script): <=1.5 A+, <=2.0 A, <=2.5 A-, <=3.0 B+, <=3.5 B, <=4.0 C+, <=4.5 C, <=5.0 D, else E. Accuracy colours: >=70 emerald, <50 rose, else amber.
  - "Rekod" `/guru/remedial-progress`: "Remedial Progress Dashboard", "Jejak peningkatan pelajar melalui ujian pemulihan", cards "JUMLAH SET", "SELESAI", "PELAJAR", "PURATA PENINGKATAN", list "👥 Senarai Pelajar & Progress", empty "Belum ada ujian remedial dijana. Buka Command Center → klik Remedial untuk mula."
- **Functional requirements**
  - **FR-GUR-1-1** Scope SC-G; the "Ketepatan Purata" caption is "kelas anda" (V1 "keseluruhan sekolah" contradicted the scope, DV-GUR-1-1).
  - **FR-GUR-1-2** "Pelajar Berdaftar" = XS-1 for the teacher's classes with the sub-line "{n} aktif menjawab hari ini" (XS-2, window today); "Soalan Dijawab" = XS-4 all time with the sub-line "{n} hari ini"; "Ketepatan Purata" = XS-5 ("keseluruhan kelas anda"); "GPS Kelas" = mean grade point of the class headcount entries ("—" without data).
  - **FR-GUR-1-3** Poll `live-data` every 10 s; a failed poll keeps the old values silently.
  - **FR-GUR-1-4** Every KPI and panel click opens the drill modal with a BM title ("Pelajar Berdaftar", "Soalan Dijawab Hari Ini", "Ketepatan Mengikut Subjek", "GPS Mengikut Subjek", "Mood Pelajar", "Kirkpatrick Tahap n") and its rows or "Tiada data".
  - **FR-GUR-1-5** **Remedial** (V2 panel "🧪 Set Pemulihan AI" with the button "🔍 Imbas Topik Lemah" and "Mengimbas..."; V1 modal title "Smart Remedial — Scan Pelajar Lemah") lists pupils with a topic < 50% (table Pelajar · Topik Lemah · Accuracy Terendah · Tindakan; none: "Tiada pelajar dengan topik lemah (<50% accuracy). Tahniah!"; summary "{n} pelajar dikesan lemah dalam topik tertentu (accuracy <50%)"); "Jana" creates a remedial set per pupil and subject ("Menjana..." then "Selesai", "Lihat Quiz"); "Batal & Jana Semula" asks "Batal set soalan remedial untuk {nama}? Anda boleh jana semula selepas ini." and cancels; the set reaches the pupil's Remedial page (M05); "Rekod" lists the sets.
  - **FR-GUR-1-6** **Ramalan SPM** ("Ramalan SPM — Predictive Analytics") shows cards "Pelajar Dianalisis", "Ramalan GPS Purata", "Berisiko", "Gred Terbanyak", grade chips and the table Pelajar · Accuracy · Trend · Konsistensi · Ramalan; empty "Tiada data mencukupi untuk ramalan".
  - **FR-GUR-1-7** **Kelas** ("Kelas Saya — Ringkasan Prestasi") lists # · Kelas · Tingkatan · Pelajar · Aktif · Ketepatan; a row opens `/guru/command-center/classroom/:id` (built: class summary and its pupils).
  - **FR-GUR-1-8** **Evaluate** ("Auto Evaluate — Penilaian Risiko Pelajar", "Menilai semua pelajar...", all clear "Semua pelajar dalam keadaan baik! Tiada risiko dikesan.") lists the teacher's pupils that are Kritikal or Tinggi by the Analitik Adaptif risk rules with the reason and a "Rekod Intervensi" button that opens Kirkpatrick "Intervensi" with the pupil preselected; it writes nothing itself.
  - **FR-GUR-1-9** **Badges** ("Achievement System — Scan & Award Badges") lists badges with rarity Common, Uncommon, Rare, Epic, Legendary and holders (modal "Lencana: {nama}"); "Scan" awards newly earned badges to the teacher's pupils after a confirm dialog and then shows "Lencana Baru Dianugerah"; awards are written through M14.
  - **FR-GUR-1-10** Every link of the board resolves to a working page: "← Dashboard", pupil rows to `/prestasi/:id` (own pupils only) and `/guru/command-center/student/:id`, class rows, "Rekod".
  - **FR-GUR-1-11** No ALESA text or panel (D73).
  - **FR-GUR-1-12** Responsive: "Evaluate" and "Rekod" stay visible at 375 and the panels Remedial, Ramalan SPM, Badges and Kelas are reachable through anchor chips in a horizontally scrolling row (V1 hid five of six links, DV-GUR-1-4); KPI tiles RP-KPI; panels stack in one column; Live Feed and Engagement scroll inside their cards; drill modal is a bottom sheet (RP-MODAL) whose tables are RP-TABLE-WIDE.
- **Data** Owners M10 classes, M05 answers/mastery, M12 Kirkpatrick queries, M08 headcount GPS, M14 badges. API `GET /api/guru/command-center/live-data`, `/drill?type=`, `/predictive`, `/evaluate`, `/achievements`, `POST /remedial/scan|generate|cancel`.
- **Acceptance criteria**
  - **AC-GUR-1-1** Given a teacher with two classes of 4 and 3 pupils (7 distinct), when the board opens, then "Pelajar Berdaftar" = 7 and equals "Pelajar" on the Dashboard Guru and the "Pelajar Saya" count.
  - **AC-GUR-1-2** Given the KPI "Soalan Dijawab", when it is clicked, then the modal title is "Soalan Dijawab Hari Ini" (or the matching BM title) and rows or "Tiada data" show, never a raw key such as "today".
  - **AC-GUR-1-3** Given the board open for 10 s, when a pupil answers one question, then "Soalan Dijawab" increases by 1 at the next poll without a page reload.
  - **AC-GUR-1-4** Given a pupil with 30% accuracy in one topic, when "Remedial" scan runs and "Jana" is pressed, then the pupil row shows "Selesai", and "Rekod" lists one set and the pupil sees it in Remedial.
  - **AC-GUR-1-5** Given a pupil at accuracy 38% with 20 answers, when "Evaluate" opens, then the pupil is listed as Kritikal with "Rekod Intervensi", and no data is written until that button is used.
  - **AC-GUR-1-6** Given a pupil who qualifies for a badge, when "Badges" > "Scan" is confirmed, then the pupil holds the badge, "Lencana Baru Dianugerah" shows and the badge-holders modal lists the pupil.
  - **AC-GUR-1-7 (R)** Given a teacher with 2 classes, when the board opens at 375, 768 and 1280 px, then scrollWidth <= innerWidth, "Evaluate" and "Rekod" are visible and the four panel anchors are reachable by horizontal chip scroll, all >= 44 px, KPI tiles are 2 columns at 375, and the drill modal is a bottom sheet with a >= 44 px close button.
  - **AC-GUR-1-8 (U)** Given "Guru UAT" (class "5 UAT", >= 10 pupils with answers), when the board opens, then "Soalan Dijawab" equals the sum of answers of those pupils shown on Laporan "Jumlah Aktiviti" for "Semua Kelas" over all time, and is non-zero.
- **Gap** Not click-tested on GH: Remedial/Evaluate/Badges (`m10-teacher-class/pages/CommandCenterPage.vue:86-170`). **Deviations** DV-GUR-1-1 caption "kelas anda"; DV-GUR-1-2 BM drill titles; DV-GUR-1-3 Remedial must not 500 (V1 D-03); DV-GUR-1-4 all panels reachable at 375; DV-GUR-1-5 V2 layout (two buttons plus in-page panels) replaces the V1 six-button bar. **Open** none (OQ-G-5 closed by FR-GUR-1-8/1-9).

### R1-GUR-2 Dashboard Guru
- **Action: Fix**
- **Screen specification (from V2)** (authoritative; replaces the V1 list below where they differ)
  - **Route / title:** `/guru`; browser title "Dashboard Guru — PRESTASIPLUS".
  - **Regions in order:** (1) empty-state banner (only when the teacher has no class); (2) "Tindakan Pantas"; (3) guide toggle and "Mula Di Sini — 3 Langkah Mudah"; (4) "Checklist Guru"; (5) four stat cards; (6) "Ringkasan Mingguan" beside "Kelas Saya" and "Headcount TOV / RS / AR"; (7) "Tindakan Hari Ini" with the On Track / Off Track tiles; (8) "Penghantaran Terkini"; (9) three columns "Pelajar Perlu Dibantu", "Topik Kritikal", "Tindakan Disyorkan"; (10) "Peer Tutor Matching".
  - **Banner:** "👋 Anda belum ada kelas. Mula dengan mencipta kelas — data prestasi akan muncul di sini apabila pelajar mula berlatih."
  - **"Tindakan Pantas" (four tiles, each a link):** "Pelajar Saya" / "Semak & urus pelajar kelas anda."; "Sumbang Soalan" / "Hantar soalan ke bank kebangsaan."; "Set Soalan" / "Bina & terbitkan set latihan."; "Prestasi Kelas" / "Lihat ketepatan & pelajar terbaik."
  - **Guide:** button "Tunjuk panduan mula" (reopens the guide); card "Mula Di Sini — 3 Langkah Mudah" with text "Ikut 3 langkah ini untuk mula menggunakan PrestasiPlus. Ambil masa 5 minit sahaja." and a close control; steps "1 Buka Kelas" ("Cipta kelas atau lihat kelas sedia ada." / link "Buka Kelas →"), "2 Lihat Pelajar" ("Semak pelajar & siapa yang aktif." / "Lihat Pelajar →"), "3 Pantau Prestasi" ("Lihat penglibatan & topik lemah." / "Pantau Prestasi →"); tip "Tip: Hover atas mana-mana menu di sidebar untuk lihat penerangan ringkas."
  - **"Checklist Guru":** progress "0/3 langkah selesai" and "0%" with a bar; rows (each with link "Lihat"): "Kelas dah ada" / "Kelas anda sudah disediakan oleh admin"; "Pelajar dalam kelas" / "Pelajar sudah ditugaskan"; "Misi harian pertama" / "Cipta misi latih tubi untuk pelajar anda".
  - **Stat cards (label / value / sub-line):** "Kelas Aktif" / "{n} jumlah kelas"; "Pelajar" / "Merentasi semua kelas"; "Soalan" / "✅ {n} diluluskan"; "Tugasan" / "Jumlah tugasan dibuat".
  - **"Ringkasan Mingguan":** sub-title "Minggu {n} ({dd/mm} - {dd/mm})"; empty "😴 Tiada aktiviti pelajar minggu ini. Galakkan mereka untuk mula berlatih!"; tiles "{n}" "Pelajar Aktif" and "{p}%" "Ketepatan"; link "Lihat Analisis Penuh".
  - **"Kelas Saya":** link "Urus Kelas →"; empty "Belum ada kelas. Cipta kelas pertama anda."
  - **"Headcount TOV / RS / AR":** sub-title "Sasaran & pencapaian sebenar"; text "Tetapkan Take-Off Value & sasaran setiap subjek, dan pantau AR (ketepatan semasa) pelajar anda secara automatik."; button "Buka Headcount".
  - **"Tindakan Hari Ini":** "Fokus guru yang paling penting hari ini"; text "Panel ini memprioritikan pelajar, topik, dan tindakan yang paling wajar disemak dahulu."; counters "Pelajar", "Topik", "Tindakan".
  - **Tiles:** "{n}" "On Track" / "Ketepatan 55% atau lebih"; "{n}" "Off Track" / "Ketepatan di bawah 55%".
  - **"Penghantaran Terkini":** link "Urus set →"; empty "Belum ada penghantaran tugasan. Buat tugasan di kelas untuk mula mengumpul penghantaran."
  - **Columns:** "Pelajar Perlu Dibantu" (chip "Top 5"; empty "Tiada pelajar berisiko buat masa ini. 🎉"); "Topik Kritikal" (sub-title "Ketepatan terendah"; empty "Belum ada data."); "Tindakan Disyorkan" (chip "Rule-based"; one item: title "Semak analitik kelas untuk pecahan prestasi", tag "Analitik", text "Lihat ringkasan ketepatan dan risiko kelas untuk tentukan fokus intervensi seterusnya.", link "Buka Analitik Kelas →").
  - **"Peer Tutor Matching":** "Cadangan rakan pembimbing pelajar"; empty "Belum cukup signal yang yakin untuk cadangan peer tutor." and the footnote "Belum cukup signal yang yakin untuk cadangan peer tutor. Modul ini akan jadi lebih tepat apabila data pelajar dan subjek bertambah."
  - **States:** only the empty teacher (no class, all zeros) was observed; populated rows: Not observed in V2 — follow FR-GUR-2-1..2-4. Loading and error: Not observed in V2 — follow FR-X2-0.
  - **Corrections noted:** (1) the four quick-action tiles are V2's "Pelajar Saya", "Sumbang Soalan", "Set Soalan", "Prestasi Kelas": V1's "Cipta Kelas Baru" and "Edit Profil Guru" tiles are dropped and **"Set Soalan" (-> `/guru/set-soalan`) is the teacher's entry to R1-GUR-8b**, with "Urus set →"; (2) the checklist captions are V2's, not V1's ("Kelas anda sudah disediakan oleh admin"…); (3) new V2 cards "Ringkasan Mingguan" (link to Laporan Mingguan), "Headcount TOV / RS / AR" (link to Headcount) and "On Track / Off Track" (accuracy >= 55% versus < 55%) are added; (4) the V2 Dashboard counts "Soalan" and "Tugasan" as the teacher's own contributions and assignments.
#### Field & behaviour spec — R1-GUR-2 Dashboard Guru

Route `/guru`. API: API-GUR-07. The page has no form field. Errors: ERR-SYS-01b per card, ERR-AUTH-01.

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Tunjuk panduan mula | button | n/a | n/a | reopens the guide "Mula Di Sini — 3 Langkah Mudah" and clears the closed state | none | none | browser storage key `hideGuruGuide` | none |
| ✕ (close guide) | button | n/a | n/a | closes the guide and stores the closed state per browser | none | none | browser storage key `hideGuruGuide` | none |
| Checklist ticks | computed | n/a | n/a | class count > 0; pupil count > 0; at least one mission by this teacher; progress "{n}/3 langkah selesai" and "{p}%" = round(n ÷ 3 × 100) | none | none | computed | API-GUR-07 |
| Pelajar Perlu Dibantu (chip "Top 5") | list | n/a | n/a | up to 5 pupils with XS-5 below 50% or no answer for 7 days or more; order accuracy ascending, then days inactive descending; counter "Pelajar" = number listed | none | none | computed | API-GUR-07 |
| Topik Kritikal | list | n/a | n/a | up to 5 topics with accuracy below 50% and at least 10 answers, accuracy ascending; sub-title "Ketepatan terendah" | none | none | computed | API-GUR-07 |
| Tindakan Disyorkan (chip "Rule-based") | card | n/a | n/a | the single rule-based item of the Screen specification | none | none | computed | API-GUR-07 |
| Tiles "On Track" / "Off Track" | counters | n/a | n/a | pupils with XS-5 at least 55% / below 55% among pupils with answers; captions "Ketepatan 55% atau lebih" / "Ketepatan di bawah 55%"; a pupil without answers is in neither | none | none | computed | API-GUR-07 |
| Peer Tutor Matching | list | n/a | n/a | per subject, pair a pupil with accuracy below 50% (at least 10 answers) with a classmate of the same class with accuracy of 80% or more (at least 20 answers) in that subject; at most 3 pairs; row text "{pelajar pembimbing} boleh membantu {pelajar} dalam {subjek}"; no pair shows the empty copy of the Screen specification (R1 decision D113) | none | none | computed | API-GUR-07 |
| Ringkasan Mingguan | tiles | n/a | n/a | sub-title "Minggu {n} ({dd/mm} - {dd/mm})" (ISO week, Monday to Sunday, MYT); "Pelajar Aktif" (XS-2, week); "Ketepatan" (XS-5, week, "—" none) | none | none | computed | API-GUR-07 |
| Stat cards | cards | n/a | n/a | "Kelas Aktif" = `classrooms.is_active` count; "Soalan" = own contributions (XS-4b); "Tugasan" = own Set Soalan plus own Misi ("Jumlah tugasan dibuat") | none | none | computed | API-GUR-07 |
| Penghantaran Terkini | list | n/a | n/a | the 5 latest completed attempts of own sets: pupil, set title, score "{betul}/{jumlah}", date `dd/mm/yyyy`; link "Urus set →" opens `/guru/set-soalan`; empty "Belum ada penghantaran tugasan. Buat tugasan di kelas untuk mula mengumpul penghantaran." | none | none | computed | API-GUR-07 |

**Requirements added by this spec**
- **FR-GUR-2-6** The On Track / Off Track tiles, Pelajar Perlu Dibantu, Topik Kritikal and Peer Tutor Matching use the thresholds of the table; a pupil without answers is never counted as Off Track.
- **AC-GUR-2-7** Given pupils with accuracy 54%, 55% and no answers, when the Dashboard opens, then "Off Track" = 1, "On Track" = 1 and the third pupil is in neither.
- **AC-GUR-2-8** Given the guide closed with "✕", when the page reloads in the same browser, then the guide stays closed; "Tunjuk panduan mula" opens it again.

- **Current gap (change the existing code only):** `m10-teacher-class/pages/GuruDashboardPage.vue:147` (`allows(q.to)` hides tiles whose target is out of scope), `components/dashboard/copy.ts:84-96` and `ChecklistCard.vue`: replace the V1 quick-action tiles by the V2 four (Pelajar Saya, Sumbang Soalan, Set Soalan, Prestasi Kelas), add the V2 cards "Ringkasan Mingguan", "Headcount TOV / RS / AR" and "On Track / Off Track", point "Misi harian pertama" to `/guru/misi-harian`, keep the 3-row checklist with the V2 captions, make "Soalan" the teacher's contribution count.
- **Route** `/guru`. **Matrix** 2. **Priority** P2. **Delivery** A. **Status** GH/UAT built; tile "Edit Profil Guru" and checklist row "Misi harian pertama" are dead (targets filtered by scope: `GuruDashboardPage.vue:147`, `components/dashboard/copy.ts:84-96`, `ChecklistCard.vue`).
- **Reference [V1] M10 S1 / [V2] `guru/dashboard`**: "Mula Di Sini — 3 Langkah Mudah" ("Ikut 3 langkah ini untuk mula menggunakan PrestasiPlus. Ambil masa 5 minit sahaja.") with steps "Buka Kelas" -> "Kelas Saya →", "Lihat Pelajar" -> "Pelajar Saya →", "Pantau Prestasi" -> "Monitoring →", tip "Tip: Hover atas mana-mana menu di sidebar untuk lihat penerangan ringkas.", close ✕ stored per browser (`hideGuruGuide`), reopen "Tunjuk panduan Mula Di Sini"; "Checklist Guru" ("0/3 langkah selesai"; rows "Kelas dah ada" / "Admin sekolah akan sediakan kelas anda", "Pelajar dalam kelas" / "Admin akan import pelajar ke kelas anda", "Misi harian pertama" / "Cipta misi latih tubi untuk pelajar anda"; link "Lihat"); stat cards "Kelas Aktif" ("{n} jumlah kelas"), "Pelajar" ("Merentasi semua kelas"), "Soalan" ("✅ {n} diluluskan"), "Tugasan" ("Jumlah tugasan dibuat"); "Tindakan Hari Ini" ("Fokus guru yang paling penting hari ini") with counters Pelajar/Topik/Tindakan and columns "Pelajar Perlu Dibantu" (chip "Top 3", empty "Tiada pelajar berkeutamaan tinggi dikesan buat masa ini."), "Topik Kritikal" (link "Analitik Kelas →", empty "Tiada topik kritikal menonjol dikesan daripada data semasa."), "Tindakan Disyorkan" (chip "Rule-based"); "Peer Tutor Matching" ("Cadangan rakan pembimbing pelajar"); "Tindakan Pantas" tiles "Cipta Kelas Baru", "Sumbang Soalan", "Lihat Pelajar", "Edit Profil Guru"; "Kelas Saya" ("Semua →", empty "Belum ada kelas. Cipta sekarang!"); "Penghantaran Terkini" (empty "Belum ada penghantaran tugasan." / "Buat tugasan di kelas untuk lihat penghantaran di sini.").
- **Functional requirements**
  - **FR-GUR-2-1** "Pelajar" = XS-1 for "kelas anda"; "Kelas Aktif" = the teacher's active classes; "Soalan" = questions contributed by the teacher (XS-4b), the same count as Sumbang Soalan "Jumlah" (V1 mismatch 20,719 vs 16,817 fixed).
  - **FR-GUR-2-2** Every tile and link has a working target: the quick-action tiles "Pelajar Saya", "Sumbang Soalan", "Set Soalan" (-> `/guru/set-soalan`, GUR-8b) and "Prestasi Kelas", the cards "Ringkasan Mingguan" ("Lihat Analisis Penuh" -> Laporan Mingguan) and "Headcount TOV / RS / AR" ("Buka Headcount") and "Urus set →" open their modules; checklist row "Misi harian pertama" -> `/guru/misi-harian` (GUR-2b, delivered with 1.0); "Analitik Kelas →" -> `/analitik/kelas` (GUR-5); the checklist keeps 3 rows and ticks automatically (class count > 0, pupil count > 0, one mission exists).
  - **FR-GUR-2-3** The guide's close state persists per browser; reopening works.
  - **FR-GUR-2-4** "Tindakan Hari Ini" lists up to 3 pupils with accuracy < 50% or inactive 7+ days, topics with accuracy < 50%, and rule-based actions; empty copy as above.
  - **FR-GUR-2-5** Responsive: stat cards RP-KPI (2 columns at 375); guide steps stack; "Tindakan Hari Ini" columns stack; "Tindakan Pantas" tiles >= 44 px.
- **Data** M10, M05, M04 contributions. API `GET /api/guru/dashboard`.
- **Acceptance criteria**
  - **AC-GUR-2-1** Given 7 distinct pupils in the teacher's classes, when the Dashboard opens, then "Pelajar" = 7 equal to the "Pelajar Saya" tab count.
  - **AC-GUR-2-2** Given the Dashboard, when every tile, step link, checklist "Lihat" and "Semua →" is clicked in turn, then each opens a working page (no 404, "Belum tersedia" or dead click).
  - **AC-GUR-2-3** Given no mission yet, when one is created on `/guru/misi-harian`, then the checklist ticks "Misi harian pertama" and shows "3/3" when the other two are ticked.
  - **AC-GUR-2-4** Given a pupil with accuracy 30% over 20 answers, when the Dashboard opens, then the pupil is listed under "Pelajar Perlu Dibantu".
  - **AC-GUR-2-5 (R)** Given a teacher with 2 classes, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth, stat cards are 2 columns at 375 and 4 at 1280, and the four "Tindakan Pantas" tiles are visible and >= 44 px.
  - **AC-GUR-2-6 (U)** Given "Guru UAT", when the Dashboard opens, then "Kelas Aktif" equals the number of rows on Kelas Saya and "Pelajar" equals the Pelajar Saya count.
- **Deviations** none. **Open** none.

### R1-GUR-2b Misi Harian (child of the Dashboard checklist; delivered with 1.0, D106)
- **Action: Build**
- **Screen specification (from V2)** (authoritative)
  - **Route / title:** `/guru/misi-harian`; browser title "Misi Harian — PRESTASIPLUS".
  - **Regions in order:** (1) header with intro and button; (2) form card "Cipta Misi"; (3) list of mission cards.
  - **Header:** intro text "Assign misi harian kepada pelajar. Fokus: Latih Tubi SPM & Tracking A."; button "Misi Baru" (shows the form).
  - **Form "Cipta Misi":** "Tajuk Misi"; "Keterangan (opsional)"; "Sasaran Soalan" (number); "Ganjaran Syiling" (number); "Tarikh"; "Kelas (opsional)" (select: "Semua kelas saya" then the teacher's own classes); submit button "Cipta Misi".
  - **Mission card (one per mission):** title (for example "Rajin Berlatih"); description (for example "Selesaikan 3 kuiz hari ini"); three facts "{n} soalan", "+{n} syiling", date dd/mm/yyyy; a badge **"Global"** on missions that are platform missions (not the teacher's own); on the right a count "{n}" with the caption "pelajar selesai" (pupils who completed it; 0 is shown as "0").
  - **Observed examples (titles / target / reward):** "Rajin Berlatih" 3 / +15; "Si Tepat" 80 / +20; "Penjelajah Topik" 3 / +25; "Kilat Matematik" 10 / +30; "Mula Hari Ini" 1 / +10; "Jawab 5 Betul" 5 / +12; "Latihan 10 Minit" 10 / +20; "Kombo 2 Hari" 2 / +25; "Ketepatan 90%" 90 / +35; "Cabaran Kilat" 20 / +40; "Selesai 5 Kuiz" 5 / +50; "Ketepatan 80%" 80 / +80; "3 Topik Berbeza" 3 / +60; "Kombo 10" 10 / +120; "Belajar 15 Minit" 15 / +40. All observed missions carry the "Global" badge. The V2 page lists platform missions with their completion counts to the teacher as well as the teacher's own missions.
  - **States:** populated observed (15 missions). Empty list, validation and success/error messages: Not observed in V2 — follow FR-GUR-2b-*.
  - The V1 separate create page with a mission-type select is not in V2 and is not used.
#### Field & behaviour spec — R1-GUR-2b Misi Harian

Route `/guru/misi-harian`. API: API-GUR-11 (list, create, delete). Data additions: ADD-03 (DM-75, API-GUR-11).

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Tajuk Misi | text | Yes | empty | placeholder "cth: Jawab 20 soalan Matematik"; max 255 | "Sila isi tajuk misi."; over 255: "Tajuk misi tidak boleh melebihi 255 aksara." | none | `missions.title` | API-GUR-11 |
| Keterangan (opsional) | textarea | No | empty | placeholder "cth: Fokus Bab 3 Algebra sebelum ujian"; max 500 | "Keterangan tidak boleh melebihi 500 aksara." | none | `missions.description` | API-GUR-11 |
| Sasaran Soalan | integer | Yes | 10 | 1 to 1000 | "Sasaran soalan mesti antara 1 dan 1000." | none | `missions.question_count` | API-GUR-11 |
| Ganjaran Syiling | integer | Yes | 10 | 0 to 10000 | "Ganjaran syiling mesti antara 0 dan 10000." | none | `missions.reward_coins` | API-GUR-11 |
| Tarikh | date | Yes | today | today or later | "Tarikh tidak boleh lebih awal daripada hari ini." | none | `missions.mission_date` | API-GUR-11 |
| Kelas (opsional) | select | No | "Semua kelas saya" | OPT-KELAS-OWN with the first option "Semua kelas saya" (empty value = all own classes) | none | none | `missions.classroom_id` (null = all own classes); recipients in `mission_items` | API-GUR-11 |

- "Misi Baru" shows the form; "Cipta Misi" saves (busy "Menyimpan...") and shows the toast "Misi dicipta." List order: date descending, then created descending. Card layout as in the Screen specification.
- Delete: only own missions, after CF-07. A Global mission shows the badge "Global" and has no delete control; the API answers 403 with "Misi global tidak boleh dipadam.". Deleting keeps rewards already paid.
- Reward rule: the reward is paid once per pupil when the pupil reaches the sasaran of the mission (completed count derived from `practice_sessions.mission_id`).
- Empty: "Belum ada misi" / "Cipta misi harian pertama untuk pelajar anda." with the button "Cipta Misi".

**Requirements added by this spec**
- **FR-GUR-2b-5** The mission form validates the six fields as in the table; a Global mission cannot be deleted by a teacher; the reward is paid once per pupil.
- **AC-GUR-2b-5** Given Sasaran Soalan 0, when "Cipta Misi" is pressed, then "Sasaran soalan mesti antara 1 dan 1000." shows and no mission is created.
- **AC-GUR-2b-6** Given a Global mission in the list, when the teacher looks at its card, then no "Padam" control shows; a direct delete request answers 403.
- **AC-GUR-2b-7** Given a mission with sasaran 10 and reward 10, when a pupil reaches 10 answers twice on the same day, then the reward is paid once.

- **Current gap:** no route, page or API exists: add the route fragment under `src/modules/m10-teacher-class/routes/` (`/guru/misi-harian`, alias `/cipta`), the page, and `GET/POST/DELETE /api/guru/missions` over the M05 daily-mission store.
- **Route** `/guru/misi-harian` (alias `/guru/misi-harian/cipta` redirects to the create card). **Matrix** none (no sidebar item). **Priority** P1. **Status** not built (no route).
- **Reference [V2] `guru/misi-harian.blade.php`** (V2 is the reference; V1 had a separate create page with a broken type switch, D-02): heading "Misi Harian"; card "Cipta Misi": "Tajuk Misi" (required, placeholder "cth: Jawab 20 soalan Matematik"), "Keterangan (opsional)" (placeholder "cth: Fokus Bab 3 Algebra sebelum ujian"), "Sasaran Soalan" (1-1000, default 10), "Ganjaran Syiling" (0-10000, default 10), "Tarikh" (default today), "Kelas (opsional)" ("Semua kelas saya" + own classes), button "Cipta Misi"; list of missions; empty "Belum ada misi" / "Cipta misi harian pertama untuk pelajar anda." with "Cipta Misi". [V1] intro "Assign misi harian kepada pelajar. Fokus: Latih Tubi SPM & Tracking A.". Pupils see the mission on `/misi-harian` (M05).
- **Functional requirements**
  - **FR-GUR-2b-1** List missions as V2 cards (title, description, "{n} soalan", "+{n} syiling", date, badge "Global" for platform missions, "{n} pelajar selesai" counted over the teacher's pupils) and create one with the V2 fields; validation in BM; success message "Misi dicipta." ([PRINCIPLE] copy).
  - **FR-GUR-2b-2** A mission applies to the chosen class or all of the teacher's classes; each pupil sees it on Misi Harian and earns the syiling on reaching the sasaran (M05/M14).
  - **FR-GUR-2b-3** Delete a mission with a confirm; completed rewards stay.
  - **FR-GUR-2b-4** Responsive: RP-FORM; fields one column at 375; mission list RP-TABLE-LIST.
- **Data** Owner M05 daily missions; API `/api/guru/missions*`.
- **Acceptance criteria**
  - **AC-GUR-2b-1** Given a teacher with class "5 UAT", when a mission "Jawab 10 soalan" (sasaran 10, ganjaran 10, kelas "5 UAT") is created, then it appears in the list and in the Misi Harian of a pupil of "5 UAT".
  - **AC-GUR-2b-2** Given Sasaran Soalan = 0, when "Cipta Misi" is pressed, then a BM validation message shows and nothing is created.
  - **AC-GUR-2b-3** Given a pupil who answered 10 questions correctly, when the mission target is 10 and `rewardCoins` is 10 at coin rate 1, then the pupil's wallet increases by 10 (per-answer) + 10 (mission reward) syiling and the list shows "1 / {total}" completed.
  - **AC-GUR-2b-5** Given the coin rate 1 and a mission with `rewardCoins` 10 and target 5, when a pupil answers 5 questions correctly, then the wallet gains 5 + 10 = 15 Syiling (the 10 is paid once, at the target; 10 section 4.4).
  - **AC-GUR-2b-4 (R)** Given 3 missions, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth, missions are cards at 375 and 768, and "Cipta Misi" and the delete control are visible and >= 44 px.
- **Open** none (decided as OQ-G-13, section 6.2).

### R1-GUR-3 Headcount
- **Action: Complete**
- **Screen specification (from V2)**
  - **Route / title:** `/headcount`; browser title "Headcount — PRESTASIPLUS".
  - **Regions in order:** (1) header; (2) tip banner; (3) grid of subject cards; (4) save button; (5) modal "Auto-Setup Headcount" (hidden until opened).
  - **Header:** "Headcount" / "Tracking prestasi murid — TOV, AR & RS"; button "Auto-Setup Headcount".
  - **Tip banner:** "💡 Tetapkan TOV (Take-Off Value) dan RS (Realistic/Sasaran) bagi setiap subjek untuk menjejak sasaran pencapaian pelajar."
  - **Subject card (one per active subject, 31 observed):** subject name with the caption "Sasaran TOV → RS"; pill "AR {n}%" or "AR —" (current accuracy, computed); inputs "TOV" and "RS (Sasaran)"; line "Jurang: {RS−TOV}" ("—" when empty). Observed subjects in order: Bahasa Melayu, Bahasa Inggeris, Matematik, Sains, Sejarah, Pendidikan Islam, Pendidikan Moral, Matematik Tambahan, Fizik, Kimia, Biologi, Geografi, Pendidikan Seni Visual, Pendidikan Muzik, Pendidikan Jasmani & Kesihatan, Reka Bentuk & Teknologi, Sains Komputer, Bahasa Arab, Bahasa Cina, Bahasa Tamil, Prinsip Perakaunan, Ekonomi, Perniagaan, Pendidikan Al-Quran & As-Sunnah, Tasawwur Islam, Jawi, Pendidikan Syariah Islamiah, Sains Rumah Tangga, Pembuatan Pakaian Wanita, Pertanian, Sains Sukan.
  - **Save:** one button "💾 Simpan Sasaran" after the grid.
  - **Modal "Auto-Setup Headcount":** text "Pilih tingkatan untuk auto-cipta headcount bagi subjek aktif yang belum ada tetapan"; group "Tingkatan" with checkboxes "T1", "T2", "T3", "T4", "T5"; buttons "Batal" and "Auto-Setup ({n})" where n is the number of ticked levels (0 initially).
  - **States:** the empty-target state (all "AR —", "Jurang: —") observed; populated AR values, success/error messages and the per-class depth: Not observed in V2 — follow FR-GUR-3-*.
  - **Not in this V2 screen:** There is **no** class selector, mode (Auto/Manual), OTR count, per-pupil table, Dashboard Headcount, "Buat Baru", Key-in AR, Edit TOV/ETR, Unjuran or Tetapan in this V2 teacher screen (the V2 code redirects those routes to `/headcount`). **How V3 reconciles this (never rebuild):** the V2 per-subject card page is the landing of `/headcount` (TOV and "RS (Sasaran)" set per subject for all the teacher's classes, "AR" computed live, "Jurang", "Simpan Sasaran", Auto-Setup for T1-T5), and it is the same data the pupil reads in R1-MUR-3; the existing V3 config screens (list of class+subject configs, "Buat Baru", Dashboard Headcount, per-pupil tables, Manual mode) stay as the V1 depth reached from a subject card, and the class-level "TOV" and "RS (Sasaran)" of the V2 card are the defaults for every pupil (override per pupil on "Edit TOV/ETR"). **Corrections noted:** V2's subtitle names "TOV, AR & RS" (V1: "TOV, OTR, AR & RS"): V3 shows the V1 subtitle on the config pages and the V2 subtitle on the card page; V2 "Simpan Sasaran" must actually save (the V2 replica form did not).
#### Field & behaviour spec — R1-GUR-3 Headcount

Routes `/headcount` and sub-routes. API: API-RPT-09 (list, dashboard, form-options, create, auto-setup, summary, export, detail, drop, reset, delete), API-RPT-10 (`PUT .../ar` Key-in AR, `PUT .../tov` Edit TOV/ETR and RS, `PUT .../settings` Tetapan), API-RPT-16 (`PUT /api/headcounts/:id/defaults`, the subject-card targets). DM: `headcount_configs`, `headcount_entries`, `headcount_entry_marks`. Precision: the database keeps 2 decimals, the form accepts and shows 1 decimal (step 0.1).

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Subject card TOV | decimal | No | empty | 0 to 100, 1 decimal; one card per active subject in OPT-SUBJEK order | "Markah mesti antara 0 dan 100." | none | `headcount_configs.default_tov` | API-RPT-16 |
| Subject card RS (Sasaran) | decimal | No | empty | 0 to 100, 1 decimal; RS lower than TOV is allowed and Jurang then shows a negative number | "Markah mesti antara 0 dan 100." | none | `headcount_configs.default_etr` | API-RPT-16 |
| Jurang | computed | n/a | n/a | RS − TOV, 1 decimal, sign shown ("+40", "-5", "0"); "—" if either is empty | none | TOV and RS | computed | none |
| AR pill | computed | n/a | n/a | "AR {n}%" as a whole number, "AR —" when none | none | none | computed | API-RPT-09 |
| Simpan Sasaran | button | n/a | n/a | saves every card that changed by calling API-RPT-16 once for every config of that subject and year owned by the teacher; success "Sasaran disimpan."; failure "Gagal menyimpan sasaran. Cuba lagi." | none | at least one changed card | see TOV and RS | API-RPT-16 |
| Auto-Setup Tingkatan | checkbox group | No | none ticked | "T1" to "T5" (values 1 to 5, OPT-TINGKATAN); button "Auto-Setup ({n})" disabled while n = 0 | none | none | creates `headcount_configs` for each class of the teacher in the ticked Tingkatan that has none | API-RPT-09 |
| Pilih Kelas | select | Yes | "-- Pilih kelas --" | OPT-KELAS-OWN | "Sila pilih kelas." | none | `headcount_configs.classroom_id` | API-RPT-09 |
| Pilih Subjek | select | Yes | "-- Pilih subjek --" (the class subject is preselected and can be changed) | OPT-SUBJEK, option text "{nama} ({KOD})" | "Sila pilih subjek." | Pilih Kelas | `headcount_configs.subject_id` | API-RPT-09 |
| Tingkatan | read-only text | n/a | from the class | OPT-TINGKATAN | none | Pilih Kelas | `headcount_configs.education_level_id` | API-RPT-09 |
| Tahun Akademik | integer | Yes | current year | 2020 to 2100 | "Tahun mesti antara 2020 dan 2100." | none | `headcount_configs.academic_year` | API-RPT-09 |
| Bilangan OTR | radio | Yes | 3 | 2, 3, 4, 5; hint "Minimum 2 OTR · Default 3 OTR · Boleh tukar 2/3/4/5 ikut keperluan kelas." | none | none | `headcount_configs.active_otrs` | API-RPT-09 |
| Mod Pengiraan Markah | radio cards | Yes | Auto | "🤖 Auto — Markah dikira automatik dari soalan latih tubi SPM + Tracking A pelajar di platform PrestasiPlus." = `auto`; "✍️ Manual — Cikgu key-in markah pelajar sendiri (cth: dari peperiksaan formal sekolah)." = `manual` | duplicate (409): "Headcount Auto untuk kelas, subjek dan tahun ini sudah wujud." / "Headcount Manual untuk kelas, subjek dan tahun ini sudah wujud." | none | `headcount_configs.mode` (unique with class, subject, year) | API-RPT-09 |
| Tapis: | chips | No | "Semua ({n})" | then one chip per Tingkatan present, "Tingkatan n ({n})" | none | none | query string | API-RPT-09 |
| Susun: | toggle | No | "Ranking" | "Ranking" = latest AR descending, pupils without AR last, ties by name; "A-Z" = name ascending (Malay collation) | none | none | query string | API-RPT-09 |
| Row checkboxes | checkbox, select-all | No | none | bar "{n} murid dipilih" with "Gugurkan" (CF-10), "Kembalikan", "Batal" | none | at least one row | `headcount_entries.dropped` | API-RPT-09 |
| Key-in AR (Manual only) | decimal per pupil | No | empty | 0 to 100, step 0.1; checkpoint n outside 1..active OTRs answers 404 | "Markah mesti antara 0 dan 100."; success "AR OTR{n} disimpan." | mode Manual | `headcount_entry_marks` (AR of checkpoint n) | API-RPT-10 |
| Edit TOV / ETR | decimal x2 per pupil | No | the subject-card default | 0 to 100, step 0.1 | "Markah mesti antara 0 dan 100."; success "TOV/ETR disimpan." | none | `headcount_entries.tov`, `headcount_entries.etr` | API-RPT-10 |
| RS (SPM Sebenar) | decimal per pupil | No | empty | 0 to 100, 1 decimal, on the Edit TOV/ETR page, column "RS (SPM Sebenar)" | "Markah mesti antara 0 dan 100." | none | `headcount_entries.rs` | API-RPT-10 |
| Tarikh Rekod RS | date | No | date of the first save of RS | not in the future; shown as "Direkodkan: {dd Mon yyyy}" | "Tarikh tidak boleh lebih lewat daripada hari ini." | RS has a value | `headcount_entries.rs_recorded_at` (ADD-14 (DM-49, API-RPT-10)) | API-RPT-10 |
| Tetapan: Bilangan OTR | select | Yes | current value | 2 to 5; lowering below a checkpoint that has marks opens CF-05 | none | none | `headcount_configs.active_otrs` | API-RPT-10 |

- **Calculations (HC-SPEC).** OTR_k = round(TOV + (ETR − TOV) × r_k) with r_k = floor(100·k/n)/100 and OTR_n = ETR; grade by OPT-GRED; Auto AR = round(correct ÷ answered × 100) over `practice_answers` of all modes for the subject and year; status per checkpoint On Track when AR is at least OTR_k, else Below; the pupil status is that of the latest checkpoint with an AR; the config On Track % = round(on ÷ (on + below) × 100); Ringkasan bands Above (AR − OTR above 2), On Track (0 to 2), Below (below 0), Belum Diisi; Unjuran end = ETR if AR is at least TOV, else AR; trend Meningkat (above AR + 2), Menurun (below AR − 2), Stabil; Keyakinan Tinggi (AR at least ETR), Sederhana (AR at least TOV), Rendah. Rounding: half away from zero. Refresh: on page load only, no polling.
- **Pupil entry status.** `Active` when the pupil has TOV and ETR (own or default), else `Draft`; `dropped` through "Gugurkan" (CF-10), reversed by "Kembalikan".
- **Export CSV** `headcount-{subjek}-{kelas}-{yyyymmdd}.csv`: columns "Bil", "Nama", "TOV", "OTR1", "AR1", up to "OTR{n}", "AR{n}", "ETR", and a last row "Purata Kelas" (mean of the non-empty values, 1 decimal); row order = the current sort. Failure and empty: ERR-EXP-01, ERR-EXP-02.
- **Destructive actions.** "Padam" opens CF-03; "Reset Data" opens CF-04; lowering the OTR count opens CF-05; "Gugurkan" opens CF-10.
- **Empty and loading.** No headcount: "Belum ada headcount." with the button "Buat Sekarang"; a class without pupils: "Belum ada murid dalam kelas ini."; Auto mode with no AR: AR cells show "—". Panel failure: ERR-SYS-01b.

**Requirements added by this spec**
- **FR-GUR-3-10** The creation form enforces the fields, ranges and duplicate rule of the table (one config per class, subject, year and mode).
- **FR-GUR-3-11** "Simpan Sasaran" writes TOV and RS to every config of that subject and year owned by the teacher and reports the result with the exact messages.
- **FR-GUR-3-12** RS (SPM Sebenar) and its record date are stored per pupil; the date defaults to the day RS is first saved and cannot be in the future.
- **AC-GUR-3-14** Given a Manual headcount, when AR 101 is keyed for OTR1, then "Markah mesti antara 0 dan 100." shows and nothing is saved; with 66.5 the message "AR OTR1 disimpan." shows.
- **AC-GUR-3-15** Given the card Matematik with TOV 40 and RS 80, when "Simpan Sasaran" is pressed, then every Matematik config of the year of the teacher has default TOV 40 and default ETR 80, the card shows Jurang "+40", and "Sasaran disimpan." shows.
- **AC-GUR-3-16** Given an Auto headcount for class "5 Bestari", Matematik, 2026, when the same combination is created again, then "Headcount Auto untuk kelas, subjek dan tahun ini sudah wujud." shows and no second config exists.
- **AC-GUR-3-17** Given OTR3 has marks, when Bilangan OTR is lowered from 3 to 2, then CF-05 shows; "Batal" keeps 3, "Ya, Padam" removes the OTR3 marks and saves 2.

- **Current gap (change the existing code only):** replace the four placeholder routes `m08-student-performance/routes/headcount.ts:69-92` (`pages/HeadcountShellPage.vue:1-45`) by the Key-in AR, Edit TOV/ETR, Unjuran and Tetapan pages; add the endpoints for key-in AR, edit TOV/ETR and settings next to the existing ones in `apps/api/src/modules/reports/performance/headcount/headcount.controllers.ts:62-138`; apply the OTR/status rules of this module to `headcount.rules.ts`; add the pupil-facing Auto/Manual chip.
- **Route** `/headcount`, `/headcount/dashboard`, `/headcount/create`, `/headcount/:id` (table), `/headcount/:id/results/:n`, `/edit`, `/unjuran`, `/settings`, `/summary`, `/export`, `/headcount/student/:id`. **Matrix** 3. **Priority** P1. **Delivery** A. **Status** GH list with 2 configs, Auto-Setup works; `results/:n`, `edit`, `unjuran`, `settings` are placeholder shells (`routes/headcount.ts:69-92` -> `pages/HeadcountShellPage.vue`).
- **Reference [V1] M08 S12-S23 / [V2] `guru/headcount*.blade.php`, `HeadcountDashboardController`, `StudentParityController::headcountStudent`, `pelajar/headcount-detail.blade.php`.** V2 stores per (teacher, class, subject, year): TOV and RS, and computes AR live; V2 teacher screen "Headcount — Sasaran (TOV → RS)" has TOV/RS inputs ("Simpan Sasaran" does not save in V2: its form has `onsubmit="return false"`, a V2 defect fixed here), AR from attempts, "Padam Headcount?" and "Auto-Setup Headcount" (levels T1-T5). V1 adds OTR checkpoints (2-5), per-pupil rows and the modes Auto/Manual. V3 follows V1 for structure and V2 for the AR and OTR arithmetic that R1-MUR-3 already uses.
  - Screens (V1 copy): hero "Headcount" / "Tracking prestasi murid — TOV, OTR, AR & RS"; buttons "Dashboard", "Buat Baru", "Auto-Setup"; empty "Belum ada headcount." + "Buat Sekarang". Auto-Setup modal "Auto-Setup Headcount" / "Pilih tingkatan untuk auto-cipta headcount": checkboxes T1-T5 (Darjah hidden, D72), "Batal", "Auto-Setup (n)" disabled until one is ticked. "Dashboard Headcount" ("Ringkasan prestasi semua kelas anda", "Senarai Penuh"; filter "Tapis:" "Semua (n)" + levels; cards "Konfigurasi", "Jumlah Murid", "On Track", "Off Track"; "Keseluruhan On-Track {n}%" with legend "On Track:", "Off Track:", "Tiada Data:"). "Buat Headcount Baru": "Pilih Kelas", "Pilih Subjek" ("Name (CODE)"), "Tingkatan", "Tahun Akademik" (default current year, 2020-2100), "Bilangan OTR" (2/3/4/5, default 3; "Minimum 2 OTR · Default 3 OTR · Boleh tukar 2/3/4/5 ikut keperluan kelas."), "Mod Pengiraan Markah" ("🤖 Auto — Markah dikira automatik dari soalan latih tubi SPM + Tracking A pelajar di platform PrestasiPlus." / "✍️ Manual — Cikgu key-in markah pelajar sendiri (cth: dari peperiksaan formal sekolah)."; hint "Boleh ada 1 Auto + 1 Manual untuk kelas + subjek + tahun yang sama."), "Cipta Headcount"; duplicate "Headcount Auto untuk kelas, subjek dan tahun ini sudah wujud." (Manual likewise). Table page `/headcount/:id`: header subject, "{n} Simulasi · Tingkatan {n} · {tahun} · Guru: {nama}", pill "Active"; chips "On Track: {n} ({p}%)", "Below: {n} ({p}%)", "Belum Diisi: {n}", "Jumlah: {n}"; actions "Key-in AR", "Edit TOV/ETR", "Export CSV", "Ringkasan Kelas", "Unjuran", "Tetapan", "Reset Data", "Padam"; "Susun:" "Ranking" / "A-Z"; table select-all · # · Nama · TOV · OTR1 · AR1 … OTRn · ARn · ETR, last row "Purata Kelas"; row selection bar "{n} murid dipilih" with "Gugurkan", "Kembalikan", "Batal". Modals: "Reset Semua Data?" / "Semua markah murid akan dikosongkan — TOV, ETR, OTR, AR & RS." with the safe list "Senarai murid (tidak dipadam)", "Tetapan headcount (subjek, kelas, tahun)", "Batal" / "Ya, Reset"; "Padam Headcount?" / "Anda pasti mahu padam headcount {subjek} ({n} Simulasi, {tahun})?" / "Semua data murid, TOV, ETR, OTR, AR & RS akan dipadam secara kekal." / "Batal" / "Ya, Padam". "Ringkasan Kelas" (`/summary`): cards "Jumlah Murid", "Purata TOV (%)", "Purata ETR (%)", "OTR Aktif"; "Taburan Prestasi Per OTR"; buttons "Lihat Table Penuh", "Export CSV". Pupil page "Headcount — Prestasi Individu": chips TOV/ETR/RS, "Unjuran", trend ("Meningkat", "Stabil", "Menurun"), "Keyakinan", chart, table Checkpoint · Target (%) · Gred Target · AR (%) · Gred AR · Status, box "Ketepatan Ramalan ETR vs RS" ("Ramalan Tepat" |d| <= 5, "Hampir Tepat" <= 10, "Selisih Besar" > 10).
- **Headcount computation spec (HC-SPEC) — the ONE definition of TOV, ETR, OTR, AR, status, Jurang, Unjuran and Keyakinan.** The rules below (model, OTR targets, grade, AR in Auto and Manual mode, status per checkpoint, Ringkasan Kelas bands, Unjuran and Keyakinan) are cited by id: **HC-1** TOV/ETR/Jurang (Jurang = ETR − TOV); **HC-2** OTR targets and rounding; **HC-3** AR sources and modes; **HC-4** the single "On Track" rule; **HC-5** grade and rounding of bands; **HC-6** Unjuran and Keyakinan. `10-murid.md` R1-MUR-3 / R1-MUR-4 (pupil), R1-AS-3 (school admin, read-only), Prestasi, Dashboard and Command Center refer to HC-SPEC and define no rule of their own. **HC-4 (the only "On Track" rule): AR >= OTR_k of the checkpoint; pupil status = the latest checkpoint that has an AR.** The V2 teacher screen shows no headcount status, and V2 pupil-side variants (AR >= ETR, midpoint of TOV/ETR, AR >= TOV) are not consistent, so V1 applies (D9). The V2 Dashboard Guru tiles "On Track" / "Off Track" with the captions "Ketepatan 55% atau lebih" / "Ketepatan di bawah 55%" are a different, V2-observed pupil-accuracy band (XS-5 >= 55) in "Tindakan Hari Ini"; they keep their caption and are never counted as, or compared with, Headcount status. Worked example (TOV 40, ETR 80, n = 3, AR 60): OTR1 = 53, OTR2 = 66, OTR3 = 80; Jurang = +40; AR 60 is On Track at OTR1, Below at OTR2 and OTR3; pupil status "Below"; Keyakinan "Sederhana" (AR >= TOV, AR < ETR).
- **Headcount model and rules (single definition; consistent with `10-murid.md` R1-MUR-3 which the pupil reads)**
  - Config = class + subject + Tingkatan + year + mode (Auto or Manual) + `activeOtrs` n (2-5). At most one Auto and one Manual per class + subject + year.
  - Per pupil values: **TOV** (take-off value, 0-100, 1 decimal, teacher-entered), **ETR** (final target, "Sasaran Akhir", 0-100, teacher-entered; the pupil screen of R1-MUR-3 calls the same number "RS (Sasaran)"), **OTR1..OTRn** (interim targets), **AR1..ARn** (result at each checkpoint), and an optional **RS actual** (real SPM result, "RS (SPM Sebenar)", entered after the exam with its date "Direkod: {dd Mon yyyy}").
  - **OTR targets** are computed, never typed: for k = 1 .. n-1, OTR_k = round(TOV + (ETR − TOV) × r_k) where r_k = floor(100 × k / n) / 100 (n=2: 0.50; n=3: 0.33, 0.66; n=4: 0.25, 0.50, 0.75; n=5: 0.20, 0.40, 0.60, 0.80); OTR_n = ETR. `round` = half away from zero to a whole number, as the pupil view (R1-MUR-3 uses 0.33 and 0.66 for n = 3, matching V2 `headcount-detail.blade.php:151-153`). Displayed targets are whole numbers; TOV/ETR keep 1 decimal; Auto AR is a whole number; a Manual AR keyed by the teacher is the only figure that may show 1 decimal.
  - **Grade** from a percentage (the value is first rounded to a whole number, half away from zero, so 89.5 reads as 90 = A+): A+ 90-100, A 80-89, A- 70-79, B+ 65-69, B 60-64, C+ 55-59, C 50-54, D 45-49, E 40-44, G < 40; grade points A+ 0 … G 9; GPS = mean grade point.
  - **AR in Auto mode**: AR = round(correct ÷ answered × 100), a whole number, over the pupil's own rows in the single answer store `practice_answers` (M05) whose question belongs to the config's subject and whose answer date falls in the config's year, **from every mode** (Latih Tubi, Soalan by Chapter, SPM Databank, Kuiz, Bijak sittings including Tracking A, Subjektif self-marked parts, Set Soalan Guru `question_set`, Simulasi, Misi, remedial and question-based games; D-A1). The BM hint "Auto — Markah dikira automatik dari soalan latih tubi SPM + Tracking A pelajar di platform PrestasiPlus." stays as the exact V1 copy. The same current AR is compared with every checkpoint (V2 note "tiada sejarah AR per-checkpoint disimpan"); the AR columns are read-only and "Key-in AR" is not shown. "—" when the pupil has no answers.
  - **AR in Manual mode**: AR_k = the number the teacher keyed for OTR k (0-100, 1 decimal); empty = "—"; no computation from attempts. TOV and ETR are keyed in both modes.
  - **Status per checkpoint**: AR >= OTR_k = "On Track" (green row, check icon); AR < OTR_k = "Below" (red row, arrow-down); no AR = "—". **Status per pupil** = the latest checkpoint that has an AR. **Config On Track %** = on ÷ (on + below) × 100, `round`. A pupil without ETR has status "Belum Ada Data". This single rule feeds the pill, the chips, Dashboard Headcount, the class dashboard "On Track"/"Below" and Prestasi (fixes V1 D-28).
  - **"Ringkasan Kelas" bands** (refinement of the same rule, so counts agree): "Above Target" = AR − OTR > 2; "On Track" = 0 <= AR − OTR <= 2; "Below Target" = AR < OTR; "Belum Diisi" = no AR. On Track total everywhere = Above + On Track (legend copy "On Track (±2%)" becomes "On Track (0 hingga +2)", DV-GUR-3-1).
  - **Unjuran** per pupil: if AR (latest) >= TOV then end = ETR else end = AR; linear over the checkpoints; shown as "{n}% ({grade})", trend "Meningkat" (end > latest AR + 2), "Menurun" (end < latest AR − 2), else "Stabil"; **Keyakinan** "Tinggi" when AR >= ETR, "Sederhana" when AR >= TOV, else "Rendah" (as R1-MUR-3).
  - **What the pupil sees** (read-only, `10-murid.md` R1-MUR-3): the pupil lists one card per config of the pupil's class teachers for the current year, with a chip "Auto" or "Manual" (R1-MUR-3 refers to HC-SPEC in R1-GUR-3, OQ-X-2); in an Auto config the pupil's AR is the live attempt-based AR; in a Manual config the pupil sees only the AR values the teacher keyed for that pupil (and "—" where none), TOV, ETR/"RS (Sasaran)", the OTR targets above and the same status, Unjuran and Keyakinan; never classmates' data; a dropped pupil ("Gugurkan") does not see the config.
  - **Forms (new, built from the rules above):**
    - **Key-in AR** (`/headcount/:id/results/:n`, Manual configs only; n outside 1..activeOtrs = 404): heading "Key-in AR — OTR{n}"; table # · Nama · "AR (%)" input (0-100, step 0.1, empty allowed) · Target OTR{n} (read-only) · Status (live); buttons "Simpan" and "Batal"; success "AR OTR{n} disimpan."; invalid value "Markah mesti antara 0 dan 100." Tab through rows works; "Simpan" saves all rows at once.
    - **Edit TOV/ETR** (`/headcount/:id/edit`): table # · Nama · "TOV (%)" · "ETR (%)" (both 0-100, step 0.1); computed OTR targets shown read-only per row; "Simpan"; ETR must be >= 0 and a missing TOV with an ETR is allowed (OTR targets then show "—"); success "TOV/ETR disimpan.".
    - **Unjuran** (`/headcount/:id/unjuran`): read-only table Nama · TOV · AR terkini · Unjuran · Gred · Trend · Keyakinan and the class projection chart.
    - **Tetapan** (`/headcount/:id/settings`): "Bilangan OTR" (2-5; lowering below the number of OTRs that already have AR values asks "OTR{k} ke atas mempunyai markah. Padam markah tersebut?"), the mode is read-only after creation, "Simpan".
    - **Export CSV** (`/headcount/:id/export`): file with the table columns and "Purata Kelas".
- **Functional requirements**
  - **FR-GUR-3-1** The list and Dashboard Headcount show the teacher's configs; delete uses the "Padam Headcount?" modal; "Reset Data" uses the "Reset Semua Data?" modal and clears marks only.
  - **FR-GUR-3-2** "Buat Baru" and "Auto-Setup" (T1-T5) create configs; Auto-Setup creates one Auto config per class + subject of the chosen Tingkatan that has none; duplicates show the BM duplicate message.
  - **FR-GUR-3-3** The OTR, grade, status, Ringkasan Kelas, Unjuran and Keyakinan rules above are implemented exactly, for 2, 3, 4 and 5 OTRs.
  - **FR-GUR-3-4** Key-in AR, Edit TOV/ETR, Unjuran, Tetapan, Export CSV, Ringkasan Kelas, row selection ("Gugurkan"/"Kembalikan") and the two modals all work; no shell page remains.
  - **FR-GUR-3-5** The pupil page and list read these configs exactly as described under "What the pupil sees".
  - **FR-GUR-3-6** "On Track"/"Off Track" on Dashboard Headcount equal the class dashboard "On Track"/"Below" of Prestasi for the same configs, and the count "{n} entri headcount" equals what the school GPS card of Prestasi (AS-4) states.
  - **FR-GUR-3-8** HC-SPEC above is the only definition: the teacher pages, the pupil pages (R1-MUR-3), the school-admin pages (R1-AS-3), Prestasi, Dashboard and Command Center call the same rules; Auto AR reads `practice_answers` of all modes (HC-3).
  - **FR-GUR-3-9** "💾 Simpan Sasaran" on the per-subject card saves the typed TOV and RS (= ETR) as the default of every config of that subject and year of the teacher's classes; a pupil entry with its own TOV/ETR keeps it, an entry without reads the default. A pupil's entry counts as "Active" when it has TOV and ETR (own or default), else "Draft". (Storage and endpoint: `50-data-model-erd.md` / `60-api-contract.md`, finding F-11.)
  - **FR-GUR-3-7** Responsive: hero buttons wrap and are >= 44 px (V1 used 10 px text); the config list is RP-TABLE-LIST cards at 375; the pupil table (TOV, OTRs, ARs, ETR) is RP-TABLE-WIDE with sticky "Nama" column; Key-in AR rows are one input per row with >= 44 px height; chart RP-CHART; modals RP-MODAL.
- **Data** Owner M08 (`apps/api/src/modules/reports/performance/headcount/*`); M05 for Auto AR. Endpoints exist for list, dashboard, form-options, create, auto-setup, summary, export, detail, drop-students, reset, delete; **new**: key-in AR, edit TOV/ETR, settings.
- **Acceptance criteria**
  - **AC-GUR-3-1** Given class "5 UAT" with Sejarah and no config, when Auto-Setup is run for T5, then one Auto config "Sejarah" appears; when run again, then no second config is created.
  - **AC-GUR-3-2** Given TOV 40 and ETR 80 with n = 3, when the table opens, then OTR1 = 53, OTR2 = 66, OTR3 = 80; with n = 2, then OTR1 = 60, OTR2 = 80; with n = 4, then 50, 60, 70, 80; with n = 5, then 48, 56, 64, 72, 80.
  - **AC-GUR-3-3** Given a Manual config with TOV 40, ETR 80 and n = 3 (OTR1 = 53), when AR 62.5 is keyed for OTR1 of a pupil and "Simpan" is pressed, then the table shows 62.5 with grade "B" (62.5 rounds to 63), status "On Track", and Ringkasan Kelas counts the pupil under "Above Target" (62.5 − 53 = 9.5 > 2).
  - **AC-GUR-3-4** Given a pupil with AR 55 and OTR1 53, then "On Track" (Above Target not, since 55 − 53 = 2 is within 0..+2), and with AR 56 then "Above Target"; with AR 52 then "Below Target".
  - **AC-GUR-3-5** Given an Auto config, when the table opens, then no "Key-in AR" control exists and `/headcount/:id/results/1` returns 404.
  - **AC-GUR-3-6** Given a Manual config where the teacher keyed AR 70 for pupil P, when P opens `/headcount/student/:ownId`, then the Manual card shows AR 70 for that checkpoint, the targets of AC-GUR-3-2 and status "On Track", and no classmate value.
  - **AC-GUR-3-7** Given "Reset Data" confirmed, then all TOV, ETR, OTR and AR values are empty, the pupil list is unchanged, and the settings (subject, class, year) are unchanged.
  - **AC-GUR-3-8** Given 10 configs with 6 pupils On Track and 4 Below, when Dashboard Headcount opens, then "Keseluruhan On-Track" = 60% and it equals the class dashboard percentages for the same pupils.
  - **AC-GUR-3-9 (R)** Given a config with 15 pupils and 3 OTRs, when `/headcount/:id` opens at 375, 768 and 1280 px, then scrollWidth <= innerWidth, the table scrolls inside its card with the "Nama" column sticky, and "Key-in AR", "Edit TOV/ETR", "Export CSV" and "Padam" are visible (or in a >= 44 px overflow menu) and >= 44 px.
  - **AC-GUR-3-10 (U)** Given "Guru UAT" whose class has pupils with answers in Sejarah, when an Auto config is created, then every pupil with answers shows an AR equal to correct ÷ answered × 100 of that pupil's Sejarah rows in `practice_answers` (all modes), rounded to a whole number.
  - **AC-GUR-3-11** Given an Auto Sejarah config and a pupil with 6 Latih Tubi answers (4 correct) and 4 answers in a Bijak sitting (3 correct), when the table opens, then AR = round(7 ÷ 10 × 100) = 70, and with TOV 40, ETR 80, n = 3 the checkpoints read OTR1 53 On Track, OTR2 66 On Track, OTR3 80 Below; pupil status "Below" (latest checkpoint), grade "A-", Keyakinan "Sederhana".
  - **AC-GUR-3-12** Given TOV 40, ETR 80, n = 3 and AR 60, then OTR1 = 53, OTR2 = 66, OTR3 = 80, Jurang +40, status "Below", Keyakinan "Sederhana", and the pupil view (R1-MUR-3) and R1-AS-3 show exactly the same values.
  - **AC-GUR-3-13** Given the subject card "Sejarah" with TOV 40 and RS 80 saved with "Simpan Sasaran", when a pupil entry without its own TOV/ETR is opened, then it shows TOV 40 and ETR 80 and is "Active"; a pupil entry with TOV 50 keeps 50.
- **Gap/root cause** Placeholder pages `routes/headcount.ts:69-92`, `pages/HeadcountShellPage.vue:1-45`; V1/V2 forms were never observed, so the forms above are [PRINCIPLE] derived from the model and R1-MUR-3. **Deviations** DV-GUR-3-1 legend/band; DV-GUR-3-2 V2 "Simpan Sasaran" works. **Open** none (OQ-G-6 closed by this section).

### R1-GUR-4 Prestasi
- **Action: Complete**
- **Screen specification (from V2)**
  - **Route / title:** `/prestasi/kelas` (also reached from the Dashboard tile "Prestasi Kelas" via `/guru/prestasi`); browser title "Prestasi Kelas — PRESTASIPLUS".
  - **Regions in order:** (1) header "📊 Dashboard Kelas" / "Ringkasan prestasi kelas dan pelajar anda"; (2) section "Prestasi Mengikut Subjek"; (3) section "Pelajar Terbaik". The sidebar item opens this single **aggregate page**; no per-class picker was shown for the observed account.
  - **"Prestasi Mengikut Subjek":** per-subject accuracy rows; empty "Belum ada data latihan."
  - **"Pelajar Terbaik":** ranked list of the best pupils; empty copy, row layout, columns and buttons: Not observed in V2 — follow FR-GUR-4-*.
  - **States:** empty observed for "Prestasi Mengikut Subjek"; populated, loading, error: Not observed in V2 — follow FR-GUR-4-*.
  - **Corrections noted:** V1/V3 open a class picker first; V2 shows the aggregate of all the teacher's classes. V3 keeps the picker and the per-class dashboards (V1 depth) and adds the V2 aggregate sections "Prestasi Mengikut Subjek" and "Pelajar Terbaik" at the top of `/prestasi/kelas` above the class cards.
#### Field & behaviour spec — R1-GUR-4 Prestasi

Route `/prestasi/kelas`. API: API-RPT-02 (class performance), API-RPT-01 (pupil detail). Errors: ERR-ACC-01 for another teacher's pupil (AC-GUR-4-2), ERR-SYS-01b per panel.

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Class cards (picker) | card list | n/a | n/a | OPT-KELAS-OWN; card shows name, Tingkatan, pupils; empty: "Anda belum mempunyai kelas aktif." / "Cipta kelas terlebih dahulu untuk mula memantau prestasi murid." with the button "Cipta Kelas" | none | none | computed | API-RPT-02 |
| Tukar Kelas... | select | No | the current class | OPT-KELAS-OWN | none | none | query string | API-RPT-02 |
| Kedudukan Murid | table | n/a | sort Ketepatan descending | columns # · Nama · Sesi · Soalan · Ketepatan · Headcount · Terakhir Aktif · Aksi ("Lihat →"); ties by Soalan descending then name; a header click toggles ascending / descending on Nama, Sesi, Soalan, Ketepatan, Terakhir Aktif; 25 per page | none | none | computed | API-RPT-02 |
| Pelajar Terbaik | list | n/a | n/a | the top 10 pupils with at least 5 answers by Ketepatan descending (ties: Soalan descending); row = rank, name, "{x}% · {n} soalan"; empty "Tiada pelajar dengan sekurang-kurangnya 5 soalan." | none | none | computed | API-RPT-02 |
| Prestasi Mengikut Subjek | rows | n/a | accuracy descending | subjects with answers; row "{subjek} {x}% · {n} soalan" with a bar; empty "Belum ada data latihan." | none | none | computed | API-RPT-02 |

- Percentages are capped at 100 and use XS-5 (wire: one decimal; screen: whole number rounded half up, D-T10-1). The page refreshes on load only. "Terakhir Aktif" is `dd/mm/yyyy` of the latest answer, "—" when none.

**Requirements added by this spec**
- **FR-GUR-4-7** The ranking table, Pelajar Terbaik and the subject rows use the sort, tie-break, threshold and empty copy of the table.
- **AC-GUR-4-7** Given a class of 6 pupils where only 4 have at least 5 answers, when Prestasi opens, then Pelajar Terbaik lists those 4 in accuracy order; with none it shows "Tiada pelajar dengan sekurang-kurangnya 5 soalan."

- **Current gap (change the existing code only):** `/prestasi/kelas` (`m08-student-performance/pages/PrestasiKelasPilihPage.vue`) is only a picker: add the aggregate sections "Prestasi Mengikut Subjek" (accuracy per subject over the teacher's pupils, XS-5) and "Pelajar Terbaik" (top pupils by accuracy with at least 5 answers); keep the 100% cap and the 403 on another teacher's pupil; no join code in the class header.
- **Route** `/prestasi/kelas` (picker, V2 title "Prestasi Kelas"), `/prestasi/kelas/:id`, pupil `/prestasi/:userId`. **Matrix** 4. **Priority** P2. **Delivery** A. **Status** GH/UAT picker and class dashboard work.
- **Reference [V2] sidebar "Prestasi" -> `/prestasi/kelas` ("Analisis prestasi kelas mengikut subjek dan topik"); [V1] M08 S4-S6**: picker "Pilih kelas untuk lihat prestasi keseluruhan"; empty "Anda belum mempunyai kelas aktif." / "Cipta kelas terlebih dahulu untuk mula memantau prestasi murid." + "Cipta Kelas". Class dashboard: header "{kelas}" with "{sekolah} · {subjek} · {tahun}" (V1 also printed the join code, removed, see GUR-8), select "Tukar Kelas..."; 6 cards "Jumlah Murid", "Purata Ketepatan", "Jumlah Sesi", "Soalan Dijawab", "Purata Masa/Sesi" ("10.4m"), "Aktif 7 Hari"; "⚠️ Perlu Perhatian (n)" (no practice: "Belum mula berlatih" badge "Tak Aktif"; accuracy < 50%: "{n} sesi · {x}% ketepatan"); "📈 Trend Aktiviti Kelas (30 Hari)" (empty "Belum ada aktiviti dalam 30 hari terakhir."); "🏆 Kedudukan Murid" columns # · Nama · Sesi · Soalan · Ketepatan · Headcount · Terakhir Aktif · Aksi "Lihat →". Prestasi 360 `/prestasi/:userId`: hero "Prestasi 360 — Dashboard Individu", cards Sesi Kuiz / Ketepatan / Soalan Dijawab / Masa Belajar ("2j 9m"), "Headcount — Prestasi SPM", "Penguasaan Subjek", "Aktiviti", "Peta Aktiviti (90 Hari)", "Topik Perlu Perhatian", "Cadangan" (V1 M08 5.4 sentence rules).
- **Functional requirements**
  - **FR-GUR-4-1** The picker lists only the teacher's classes.
  - **FR-GUR-4-2** Class figures use XS-1, XS-2, XS-4, XS-5 for that class; "Headcount" column = the pupil's status of the latest checkpoint (GUR-3 rule) or "N/A".
  - **FR-GUR-4-3** Pupil links open Prestasi 360 only for pupils of the teacher's classes (others 403 "Akses Ditolak").
  - **FR-GUR-4-4** No percentage exceeds 100 (V1 D-8).
  - **FR-GUR-4-6** Every figure counts answers of **all modes** from the single answer store `practice_answers` (XS-8); a Bijak sitting also appears as one unit in the pupil's session list.
  - **FR-GUR-4-5** Responsive: class cards 1/2/3 columns; the six stat cards 2 columns at 375; "Kedudukan Murid" is RP-TABLE-WIDE paginated 25 per page with sticky name; trend chart RP-CHART; "Tukar Kelas" select full width and >= 44 px; Prestasi 360 headcount chips wrap (V1 overflowed at 375, D-9).
- **Data** M08 `/api/performance/classes*`, `/api/performance/students/:userId`.
- **Acceptance criteria**
  - **AC-GUR-4-1** Given a class of 7 pupils, when its dashboard opens, then "Jumlah Murid" = 7 and equals the member count of that class on Kelas Saya.
  - **AC-GUR-4-2** Given a pupil of another teacher's class, when `/prestasi/{thatId}` is opened by the teacher, then 403.
  - **AC-GUR-4-3** Given a pupil with 3 correct of 3, when "Kedudukan Murid" renders, then Ketepatan shows 100% and no value exceeds 100%.
  - **AC-GUR-4-4 (R)** Given a class with 40 pupils, when its dashboard opens at 375, 768 and 1280 px, then scrollWidth <= innerWidth, stat cards are 2 columns at 375, the ranking table scrolls inside its card with 25 rows per page, and "Tukar Kelas" and the pagination controls are visible and >= 44 px.
  - **AC-GUR-4-6** Given a pupil with 10 Latih Tubi answers (7 correct) and one Bijak sitting of 40 MCQ answers (30 correct), when the class dashboard opens, then the pupil's "Soalan" = 50 and Ketepatan = 74% (37 ÷ 50), the same as on the pupil's own Prestasi and on Admin Sekolah Prestasi.
  - **AC-GUR-4-5 (U)** Given "Guru UAT" whose only class "5 UAT" has >= 90 migrated pupils, when its dashboard opens, then the first 25 ranking rows load within 3 s and "Soalan Dijawab" equals the Command Center "Soalan Dijawab" of the same teacher.
- **Gap** none found. **Deviation** DV-GUR-4-1 cap at 100%. **Open** none.

### R1-GUR-5 Analitik Adaptif
- **Action: Fix**
- **Screen specification (from V2)** (matches the text below exactly)
  - **Route / title:** `/analitik/kelas`; browser title "Analitik Kelas — PRESTASIPLUS".
  - **Regions in order:** (1) intro line; (2) filter bar; (3) four KPI cards; (4) table card "Senarai Pelajar".
  - **Intro:** "Pantau prestasi pelajar dan kenal pasti yang memerlukan perhatian".
  - **Filters (selects):** "Kelas" (default "Semua Kelas", then the teacher's classes); "Mata Pelajaran" (default "Semua Subjek", then every active subject (§0A Subject lists; V2 order: Bahasa Melayu, Bahasa Inggeris, Matematik, Sains, Sejarah, Pendidikan Islam, Pendidikan Moral, Matematik Tambahan, Fizik, Kimia, Biologi, Geografi, Pendidikan Seni Visual, Pendidikan Muzik, Pendidikan Jasmani & Kesihatan, Reka Bentuk & Teknologi, Sains Komputer, Bahasa Arab, Bahasa Cina, Bahasa Tamil, Prinsip Perakaunan, Ekonomi, Perniagaan, Pendidikan Al-Quran & As-Sunnah, Tasawwur Islam, Jawi, Pendidikan Syariah Islamiah, Sains Rumah Tangga, Pembuatan Pakaian Wanita, Pertanian, Sains Sukan); "Risiko" ("Semua Risiko", "Kritikal", "Tinggi", "Sederhana", "Rendah").
  - **KPI cards (value / label):** "0" "Jumlah Pelajar"; "0%" "Purata Ketepatan"; "0" "Pelajar Berisiko"; "0" "Prestasi Baik".
  - **Table "Senarai Pelajar":** columns "#", "Pelajar", "Ketepatan", "Soalan", "Trend", "Unjuran", "Risiko", "Tindakan".
  - **States:** empty teacher (zeros, no rows) observed; row content, per-row action, empty-table copy, loading, error: Not observed in V2 — follow FR-GUR-5-*. Nothing to correct.
#### Field & behaviour spec — R1-GUR-5 Analitik Adaptif (also R1-AS-5)

Route `/analitik/kelas`. API: API-RPT-04 (`GET /api/analytics/classes`); for the school admin the same page with school scope (API-AS-16). Errors: ERR-SYS-01b, ERR-ACC-01.

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Kelas | select | No | "Semua Kelas" | OPT-KELAS-OWN (Guru); all classes of the school sorted by Tingkatan then name (Admin Sekolah) | none | none | query string `classroomId` | API-RPT-04 |
| Mata Pelajaran | select | No | "Semua Subjek" | OPT-SUBJEK | none | none | query string `subject` | API-RPT-04 |
| Risiko | select | No | "Semua Risiko" | OPT-RISIKO | none | none | query string `risk` | API-RPT-04 |

- The filters submit automatically on change. Table "Senarai Pelajar": columns # · Pelajar · Ketepatan · Soalan · Trend · Unjuran · Risiko · Tindakan. Actions: "Lihat Analitik" opens `/prestasi/:userId`; for Kritikal and Tinggi also "Rekod Intervensi" opens Kirkpatrick Intervensi with the pupil preselected (hidden for the school admin, OQ-AS-5). Sort: accuracy ascending, "Belum Bermula" last; 25 per page. Empty: "Tiada pelajar sepadan dengan tapisan ini."
- Calculations: Purata Ketepatan is pooled (XS-5); Trend compares the last 7 days with the previous 7: a change above +3 points reads "Meningkat berbanding minggu lepas", below −3 points "Menurun berbanding minggu lepas", only activity this week "BARU", else "Stabil"; Risiko by OPT-RISIKO on the whole-number accuracy.

**Requirements added by this spec**
- **FR-GUR-5-8** The three filters, the sort, the page size and the Trend and Risiko rules of this subsection apply to the teacher page and the school-admin page alike.
- **AC-GUR-5-8** Given pupils with accuracy 39%, 40%, 54%, 55%, 69%, 70%, when the Risiko filter is "Kritikal", then only the 39% pupil lists; "Tinggi" lists 40% and 54%; "Sederhana" lists 55% and 69%; "Rendah" lists 70%.

- **Current gap (change the existing code only):** `src/shells/nav/user-nav.ts:284` sends the Guru item to `/analitik/pelajar`: change it to `/analitik/kelas` (the page and route already exist, `m08-student-performance/routes/class.ts:27-33`); link "Lihat Analitik" to `/prestasi/:userId`; verify the risk rules and "Belum Bermula".
- **Route** `/analitik/kelas` (title "Analitik Kelas"). **Matrix** 5. **Priority** **P0**. **Delivery** A. **Status** GH/UAT: the sidebar item opens `/analitik/pelajar` (the pupil page, empty "Topik Perlu Perhatian Utama (0)") at `src/shells/nav/user-nav.ts:284`; `/analitik/kelas` exists (`routes/class.ts:27-33`, roles admin+teacher) but is unlinked.
- **Reference [V2] `guru/analitik-kelas.blade.php`, sidebar "Analitik Adaptif" -> `/analitik/kelas`**: intro "Pantau prestasi pelajar dan kenal pasti yang memerlukan perhatian"; filters (auto-submit) "Kelas" ("Semua Kelas" + own classes), "Mata Pelajaran" ("Semua Subjek"), "Risiko" ("Semua Risiko", "Kritikal", "Tinggi", "Sederhana", "Rendah"); cards "Jumlah Pelajar", "Purata Ketepatan", "Pelajar Berisiko", "Prestasi Baik"; table "Senarai Pelajar": # · Pelajar · Ketepatan · Soalan · Trend · Unjuran · Risiko · Tindakan with "Lihat Analitik" and, for Kritikal/Tinggi, "Rekod Intervensi"; empty "Tiada pelajar sepadan dengan tapisan ini." Rules: no answers = "Belum Bermula"; accuracy < 40 Kritikal; < 55 Tinggi; < 70 Sederhana; else Rendah. Trend: last 7 days vs the 7 before: delta > 3 points up ("Meningkat berbanding minggu lepas"), < −3 down ("Menurun berbanding minggu lepas"), only this week "BARU", else flat. Unjuran = projected SPM grade from the pupil's pooled accuracy (XS-5; grade scale of HC-5). "Purata Ketepatan" = pooled accuracy (XS-5: all correct ÷ all answered of the pupils with answers; no mean of per-pupil percentages); "Pelajar Berisiko" = Kritikal + Tinggi; "Prestasi Baik" = Rendah. Sorted by accuracy ascending, no-answer pupils last. V1 "Lihat Analitik" -> `/analitik/kelas/pelajar/{id}` was 403 (D-3).
- **Functional requirements**
  - **FR-GUR-5-1** Sidebar and "Lagi" item "Analitik Adaptif" open `/analitik/kelas`.
  - **FR-GUR-5-2** Content, filters, rules and copy as above; "Kelas" lists only the teacher's classes.
  - **FR-GUR-5-3** "Lihat Analitik" opens the pupil's Prestasi 360 `/prestasi/:userId` (V1 target 403; V2 `/pelajar/{id}` is a public profile outside 1.0: DV-GUR-5-1).
  - **FR-GUR-5-4** "Rekod Intervensi" opens Kirkpatrick "Intervensi" with the pupil preselected.
  - **FR-GUR-5-5** "Jumlah Pelajar" uses XS-1 and ketepatan XS-5 for the filtered scope.
  - **FR-GUR-5-7** Ketepatan, Soalan, Trend and Risiko count answers of all modes from `practice_answers` (XS-8), including Bijak sittings, Set Soalan Guru and games.
  - **FR-GUR-5-6** Responsive: RP-FILTER; four cards 2 x 2 at 375; the table is RP-TABLE-LIST cards at 375/768 (pupil name, Ketepatan, Soalan, Trend, Unjuran, Risiko, two >= 44 px buttons) and a table at 1280.
- **Data** M08 `GET /api/analytics/classes` (`performance.controllers.ts:54`), M05, M12.
- **Acceptance criteria**
  - **AC-GUR-5-1** Given a Guru, when "Analitik Adaptif" is clicked, then the page titled "Analitik Kelas" opens with the three filters.
  - **AC-GUR-5-2** Given a pupil with 8 of 20 correct (40%), when the table renders, then Risiko = "Tinggi"; with 7 of 20 (35%) then "Kritikal"; with 14 of 20 (70%) then "Rendah".
  - **AC-GUR-5-3** Given a pupil with no answers, then Risiko "Belum Bermula", Ketepatan "—", and the pupil is excluded from "Purata Ketepatan".
  - **AC-GUR-5-4** Given "Lihat Analitik" on a pupil row, when clicked, then that pupil's Prestasi 360 opens (no 403).
  - **AC-GUR-5-5 (R)** Given a class of 20 pupils, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth, the three selects are stacked and >= 44 px at 375, the four cards are 2 x 2, and pupil rows are cards at 375/768 with both action buttons visible.
  - **AC-GUR-5-7** Given the pupil of AC-GUR-4-6 (37 correct of 50), when the table renders, then Ketepatan 74%, Soalan 50 and Risiko "Rendah".
  - **AC-GUR-5-6 (U)** Given "Guru UAT" class "5 UAT" (>= 10 pupils), when "Semua Kelas" is selected, then "Jumlah Pelajar" equals the Pelajar Saya count.
- **Gap/root cause** `user-nav.ts:284` wrong target. **Deviations** DV-GUR-5-1. **Open** none.

### R1-GUR-6 Analisa Item (and "Analisis Item")
- **Action: Fix**
- **Screen specification (from V2)** (two screens)
  - **Screen A, class picker.** Route `/analisa-item/kelas`; title "Analisa Item — PRESTASIPLUS". Regions: header, class cards. Header: "Pilih Kelas untuk Analisis" / "Klik mana-mana kelas untuk melihat analisa item soalan". Each class is a clickable card (opens the class page). Empty (no class): "Anda belum mempunyai kelas. Cipta kelas dahulu di Kelas Saya." Card content with classes: Not observed in V2 — follow FR-GUR-6-*.
  - **Screen B, "Analisis Item Soalan".** Route `/guru/analisis-item`; title "Analisis Item Soalan — PRESTASIPLUS". Regions: (1) filter bar "Tapis:"; (2) legend; (3) table.
  - **Filters (selects):** **"Mata Pelajaran"** ("Semua Subjek", then every active subject (§0A Subject lists), A to Z: Bahasa Arab, Bahasa Cina, Bahasa Inggeris, Bahasa Melayu, Bahasa Tamil, Biologi, Ekonomi, Fizik, Geografi, Jawi, Kimia, Matematik, Matematik Tambahan, Pembuatan Pakaian Wanita, Pendidikan Al-Quran & As-Sunnah, Pendidikan Islam, Pendidikan Jasmani & Kesihatan, Pendidikan Moral, Pendidikan Muzik, Pendidikan Seni Visual, Pendidikan Syariah Islamiah, Perniagaan, Pertanian, Prinsip Perakaunan, Reka Bentuk & Teknologi, Sains, Sains Komputer, Sains Rumah Tangga, Sains Sukan, Sejarah, Tasawwur Islam); **"Tahap Kesukaran"** ("Semua Tahap", "> 70% (Mudah)", "40–70% (Sederhana)", "< 40% (Sukar)").
  - **Legend:** three colour keys "> 70% (Mudah)", "40–70% (Sederhana)", "< 40% (Sukar)" and the note "Diskriminasi: >0.3 = baik, <0 = semak semula".
  - **Table columns:** "#", "Soalan", "Subjek", "Cubaan", "Betul", "Salah", "% Betul", "Diskriminasi".
  - **Empty state:** "Tiada data cubaan lagi — analisis item akan muncul selepas pelajar anda menjawab soalan."
  - **States:** empty observed; populated rows, loading, error, and the class page `/analisa-item/kelas/{id}`: Not observed in V2 — follow FR-GUR-6-* (V1 text of the class page applies).
  - **Corrections noted:** V2's `/guru/analisis-item` has no "Kelas" filter (V1 had) but a "Tahap Kesukaran" filter and the columns above: V3 follows V2 (FR-GUR-6-5 amended); the class page `/analisa-item/kelas/{id}` was not captured (no class), so its V1 text applies; V2's bands confirm the % betul rule of DV-GUR-6-1.
#### Field & behaviour spec — R1-GUR-6 Analisa Item (also the class page of R1-AS-6)

Routes `/analisa-item/kelas`, `/guru/analisis-item`. API: API-RPT-07 (class item analysis), API-RPT-06 (school). Errors: ERR-ACC-01 (another teacher's class, FR-GUR-6-1), ERR-SYS-01b.

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Class cards | card list | n/a | n/a | OPT-KELAS-OWN; empty "Anda belum mempunyai kelas. Cipta kelas dahulu di Kelas Saya." | none | none | computed | API-RPT-07 |
| Tukar Kelas | chips | No | current class | OPT-KELAS-OWN | none | none | query string | API-RPT-07 |
| Mata Pelajaran | select | No | "Semua Subjek" | OPT-SUBJEK (A-Z variant) | none | none | query string | API-RPT-07 |
| Tahap Kesukaran | select | No | "Semua Tahap" | OPT-KESUKARAN-ITEM | none | none | query string | API-RPT-07 |
| Cari soalan... | text | No | empty | search over question text (GLB-4) | "Taip sekurang-kurangnya 2 aksara." | none | query string | API-RPT-07 |
| Susun | select | No | "Paling Sukar Dahulu" | "Paling Sukar Dahulu", "Paling Mudah Dahulu", "Ketepatan Rendah Dahulu", "Ketepatan Tinggi Dahulu", "Paling Banyak Percubaan" | none | none | query string | API-RPT-07 |
| Tabs | tabs | No | "Indeks Kesukaran" | "Indeks Kesukaran", "Indeks Diskriminasi" | none | none | query string | API-RPT-07 |

- Table columns: # · Soalan · Subjek · Cubaan · Betul · Salah · % Betul · Diskriminasi; default sort Cubaan descending; 25 per page; empty "Tiada data cubaan lagi — analisis item akan muncul selepas pelajar anda menjawab soalan."
- Difficulty index = 1 − p, 2 decimals (p = proportion correct). % Betul bands: OPT-KESUKARAN-ITEM on the whole-number %.
- **Diskriminasi (R1 decision D113).** Among the pupils in scope who answered the question, N = their number. Rank them by total accuracy on all their answers in scope; group size g = max(1, ceil(0.27 × N)); U = the top g, L = the bottom g (ties broken by pupil id ascending); D = round((correct in U − correct in L) ÷ g, 2), where a pupil counts as correct when the first attempt in scope on the question was correct. N below 10 shows "Data Tidak Mencukupi" in the cell and, on the tab, "Data Tidak Mencukupi" with the line "Perlu sekurang-kurangnya 10 pelajar dengan sesi latihan selesai untuk mengira indeks diskriminasi." Status chips: D at least 0.40 "Sangat Baik"; 0.30 to 0.39 "Baik"; 0.20 to 0.29 "Sederhana"; below 0.20 "Lemah". The legend "Diskriminasi: >0.3 = baik, <0 = semak semula" stays on `/guru/analisis-item`.

**Requirements added by this spec**
- **FR-GUR-6-9** The Diskriminasi index uses the 27% upper and lower group formula, the minimum of 10 pupils and the chip thresholds of this subsection.
- **FR-GUR-6-10** The class page offers the search, sort select and two tabs of the table, and the OPT-KESUKARAN-ITEM bands on whole-number % Betul.
- **AC-GUR-6-10** Given a question answered by 10 pupils, 3 of the top 3 correct and 0 of the bottom 3 correct, when the discrimination tab opens, then D = 1.00 and the chip is "Sangat Baik".
- **AC-GUR-6-11** Given % Betul of 70, 71, 40 and 39, when the filter "> 70% (Mudah)" is chosen, then only the 71% question lists; "40–70% (Sederhana)" lists 70 and 40; "< 40% (Sukar)" lists 39.

- **Current gap (change the existing code only):** one Tahap rule (% betul bands) in both `m08-student-performance/routes/analisa-item.ts:73-91` pages and `m11-teacher-analytics/routes/analisis-item.ts`; bind the sort select and the search to the rows (V1 defect); keep the data scoped to the teacher's classes; the empty tables are a seed/data matter (answers).
- **Routes** `/analisa-item` (V2 `/analisa-item/kelas`: picker "Pilih Kelas untuk Analisis"), `/analisa-item/kelas/:id` ("Analisa Item — Papan Guru"), `/guru/analisis-item` (sidebar "Analisis Item" under LAIN-LAIN, title "Analisis Item Soalan"). **Matrix** 6. **Priority** P1. **Delivery** A. **Status** GH/UAT both exist; the class pick works; tables show "Tiada data analisis item" because the seed has no answers.
- **Reference [V1] M08 S10-S11, M11 S6 / [V2] `guru/analisa-item-kelas`, `guru/analisis-item`**:
  - Picker: "Pilih Kelas untuk Analisis" / "Klik mana-mana kelas untuk melihat analisa item"; one card per own class (name, subject, "{n} pelajar", year, "Lihat Analisa").
  - Class page: counters "{n} Pelajar", "{n} Soalan Diuji"; cards "Mudah", "Sederhana", "Sukar" (count and "{p}% daripada soalan"); tabs "Indeks Kesukaran" and "Indeks Diskriminasi" with count badges. Difficulty tab: search "Cari soalan...", sort select ("Paling Sukar Dahulu" default, "Paling Mudah Dahulu", "Ketepatan Rendah Dahulu", "Ketepatan Tinggi Dahulu", "Paling Banyak Percubaan"); columns # · Soalan · Subjek / Topik · Percubaan · Ketepatan · Indeks · Tahap; expanded row "Jawapan Betul", "Jawapan Salah Popular (Nx dipilih)", "Pelajar Yang Salah"; empty "Tiada Data Lagi" / "Pelajar dalam kelas ini belum menjawab sebarang soalan lagi." Discrimination tab: "Panduan Indeks Diskriminasi" chips "≥ 0.40 = Sangat Baik", "0.30 – 0.39 = Baik", "0.20 – 0.29 = Sederhana", "< 0.20 = Lemah"; text "Indeks dikira berdasarkan perbezaan prestasi antara 27% pelajar terbaik dan 27% pelajar bawah dengan menggunakan semua sesi latihan."; columns Soalan · Kumpulan Atas · Kumpulan Bawah · Indeks · Status; fewer than 10 pupils with answers on the question (minimum of 10, R1 decision D113): "Data Tidak Mencukupi" / "Perlu sekurang-kurangnya 10 pelajar dengan sesi latihan selesai untuk mengira indeks diskriminasi."; "Tukar Kelas" chips.
  - `/guru/analisis-item` [V1 M11 S6]: filters "Mata Pelajaran" ("Semua Subjek") and "Kelas" ("Semua Kelas"); legend "> 70% (Mudah)", "40–70% (Sederhana)", "< 40% (Sukar)", "Diskriminasi: >0.3 = baik, <0 = semak semula"; empty "Tiada data analisis item untuk paparan ini." / "Pelajar perlu membuat latihan dahulu."
  - Rules: p = correct ÷ attempts; Ketepatan = p × 100 (XS-5; the API returns one decimal and the screen shows the whole number rounded half up, D-T10-1); difficulty index = 1 − p (2 decimals, shown as a number only); **Tahap by % betul on both screens: > 70 Mudah, 40-70 Sederhana, < 40 Sukar** (V1 used index cut-offs on one screen and % bands on the other, D-M11-9; DV-GUR-6-1); D = p(upper 27%) − p(lower 27%).
- **Functional requirements**
  - **FR-GUR-6-1** The picker lists only the teacher's classes; another teacher's class id = 403 "Akses Ditolak".
  - **FR-GUR-6-2** Counts and the Tahap rule above; the three tier counts sum to "Soalan Diuji".
  - **FR-GUR-6-3** The sort select and the search actually sort and filter the rows (V1 D-15: they were not bound).
  - **FR-GUR-6-4** Row expansion shows the three blocks; pupil names link to Prestasi 360 for own pupils.
  - **FR-GUR-6-5** `/guru/analisis-item` filters by "Mata Pelajaran" and "Tahap Kesukaran" (V2), lists the columns "#", "Soalan", "Subjek", "Cubaan", "Betul", "Salah", "% Betul", "Diskriminasi" for the teacher's pupils, with the exact V2 empty copy.
  - **FR-GUR-6-6** "Pelajar" uses XS-1 and "Soalan Diuji" XS-7 (distinct questions answered, not answer rows) for the class.
  - **FR-GUR-6-8** "Cubaan", "Betul", "Salah" and the discrimination index count answers of all modes from `practice_answers` (XS-8), so a question answered in Latih Tubi and in a Bijak sitting has both attempts counted; Ketepatan is pooled (XS-5), whole-number percent.
  - **FR-GUR-6-7** Responsive: picker cards 1/2/3 columns; tier cards stacked at 375, 3 across at 1280; the item table is RP-TABLE-WIDE (question text 2-line clamp, sticky first column) paginated 25 per page; tabs scroll inside their row; sort and search full width and >= 44 px.
- **Data** M08 `GET /api/item-analysis/classes`, `/classes/:id`, `/school`; M04, M05.
- **Acceptance criteria**
  - **AC-GUR-6-1** Given a class with 596 tested questions of which 381 > 70%, 78 in 40-70% and 137 < 40%, when the class page opens, then the cards show 381, 78 and 137 and sum to 596.
  - **AC-GUR-6-2** Given sort "Paling Mudah Dahulu", when selected, then the first row has the highest Ketepatan and the order changes from the default.
  - **AC-GUR-6-3** Given search "fakta", when typed, then only rows whose question text contains "fakta" remain.
  - **AC-GUR-6-4** Given a question answered by fewer than 10 pupils (minimum of 10, R1 decision D113), when the discrimination tab opens, then "Data Tidak Mencukupi" shows for it; with 10 or more pupils the index shows.
  - **AC-GUR-6-5** Given another teacher's class id, when opened, then 403.
  - **AC-GUR-6-6 (R)** Given a class with 120 tested questions, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth, the table scrolls inside its card with 25 rows per page, and the sort select, search field and tabs are visible and >= 44 px.
  - **AC-GUR-6-8** Given 3 pupils who each answered question A 5 times and question B once, when the class page opens, then "Soalan Diuji" = 2 (not 16) and A shows Percubaan 15.
  - **AC-GUR-6-9** Given question A answered once in Latih Tubi (correct) and once in a Bijak sitting (wrong), then A shows Percubaan 2, Betul 1, Salah 1, Ketepatan 50%.
  - **AC-GUR-6-7 (U)** Given "Guru UAT" class "5 UAT" with migrated answers, when the class page opens, then "Soalan Diuji" > 0 and "Pelajar" equals the class member count.
- **Gap** Data only on GH (no answers). **Deviations** DV-GUR-6-1 one Tahap rule; DV-GUR-6-2 working sort/search. **Open** none.

### R1-GUR-7 Video
- **Action: Keep**
- **Screen specification (from V2)**
  - **Route / title:** `/video`; browser title "Video Pembelajaran — PRESTASIPLUS".
  - **Regions in order:** (1) category tabs; (2) button "Tambah Video"; (3) add form "Tambah Video Pembelajaran" (hidden until the button is used); (4) video list or empty state.
  - **Category tabs (exact labels, each with a count):** "Semua ({n})", "Motivasi ({n})", "Tutorial ({n})", "Tips SPM ({n})", "Ceramah ({n})", "Lain-lain ({n})". Verify the V3 tabs equal them.
  - **Button:** "Tambah Video" (shows the form).
  - **Form "Tambah Video Pembelajaran":** "Tajuk Video"; "Pautan YouTube"; "Subjek (pilihan)" (select: "— Tiada subjek —" then every active subject (§0A Subject lists) in the V2 order Bahasa Melayu, Bahasa Inggeris, Matematik, Sains, Sejarah, Pendidikan Islam, Pendidikan Moral, Matematik Tambahan, Fizik, Kimia, Biologi, Geografi, Pendidikan Seni Visual, Pendidikan Muzik, Pendidikan Jasmani & Kesihatan, Reka Bentuk & Teknologi, Sains Komputer, Bahasa Arab, Bahasa Cina, Bahasa Tamil, Prinsip Perakaunan, Ekonomi, Perniagaan, Pendidikan Al-Quran & As-Sunnah, Tasawwur Islam, Jawi, Pendidikan Syariah Islamiah, Sains Rumah Tangga, Pembuatan Pakaian Wanita, Pertanian, Sains Sukan); submit button "Tambah Video". A category field is not visible in the observed form — Not observed in V2 — follow FR-GUR-7-*.
  - **Empty state:** icon, "Tiada video buat masa ini" / "Video pembelajaran akan dipaparkan di sini" (all counts "(0)").
  - **States:** empty observed; populated video cards, validation and success/error messages, loading: Not observed in V2 — follow FR-GUR-7-*.
#### Field & behaviour spec — R1-GUR-7 Video (read-only copy: R1-AS-7)

Route `/video`. API: the existing video list and create endpoints (additions: ADD-18 (DM-76, API-MUR-05)). Errors: ERR-REQ-01, ERR-SYS-01b.

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Category tabs | tabs | No | "Semua ({n})" | "Semua ({n})", "Motivasi ({n})", "Tutorial ({n})", "Tips SPM ({n})", "Ceramah ({n})", "Lain-lain ({n})"; counts of the visible videos | none | none | query string | video list endpoint |
| Tajuk Video * | text | Yes | empty | max 150 | "Sila isi tajuk video."; over 150: "Tajuk video tidak boleh melebihi 150 aksara." | none | `videos.title` | video create endpoint |
| Pautan YouTube * | url | Yes | empty | host `youtube.com`, `www.youtube.com`, `m.youtube.com` or `youtu.be` with a video id | "Sila isi pautan YouTube."; "Pautan mesti pautan YouTube yang sah." | none | `videos.url`, `videos.platform` = `Youtube` | video create endpoint |
| Subjek (pilihan) | select | No | "— Tiada subjek —" | OPT-SUBJEK | none | none | `videos.subject_id` | video create endpoint |
| Kategori * | select | Yes | "Lain-lain" | "Motivasi", "Tutorial", "Tips SPM", "Ceramah", "Lain-lain" | "Sila pilih kategori." | none | `videos.category` slugs `motivasi`, `tutorial`, `tips_spm`, `ceramah`, `lain` | video create endpoint |

- "Tambah Video" shows the form; submit "Tambah Video" (busy "Menyimpan...") shows the toast "Video ditambah.". A teacher-added video is stored with `visibility` = `school` and the teacher's `school_id`; teachers see all global videos plus the videos of their own school (R1 decision D113).
- List: newest first, 12 per page. Card = thumbnail, title, category chip, subject, views. A click opens the player page (16:9) and adds 1 to `videos.views`. Empty (all counts 0): "Tiada video buat masa ini" / "Video pembelajaran akan dipaparkan di sini".
- The V2 form shows no category; FR-GUR-7-2 and AC-GUR-7-2 require one, so V3 adds the select "Kategori *".
- R1-AS-7: the same list and tabs; the "Tambah Video" button and form are absent for the school admin.

**Requirements added by this spec**
- **FR-GUR-7-4** The video form validates the four fields of the table; only YouTube hosts are accepted; the category slugs are fixed.
- **AC-GUR-7-5** Given the link "https://example.org/video", when "Tambah Video" is pressed, then "Pautan mesti pautan YouTube yang sah." shows and nothing is saved.
- **AC-GUR-7-6** Given a video added by a teacher of school X, when a teacher of school Y opens Video, then it is not listed; a teacher of school X sees it.

- **Current gap:** None. Verify the ACs only.
- **Route** `/video`. **Matrix** 7. **Priority** P2. **Delivery** A. **Status** GH 3 videos, category tabs, "Tambah Video"; UAT same; equals V2/V1.
- **Reference [V2] "Video Pembelajaran"** (title "Video Pembelajaran"): category tabs and list; teachers/admins can add (`videoStore`).
- **Functional requirements**
  - **FR-GUR-7-1** List with category tabs; each video opens a player page.
  - **FR-GUR-7-2** "Tambah Video" saves a video (title, category, URL) and the video appears in the list ([NOT OBSERVED] form copy; fields as the M09 video form).
  - **FR-GUR-7-3** Responsive: cards 1/2/3 columns; tabs scroll in-row; the player is 16:9 full width at 375.
- **Data** M09; fed by Admin Pusat "Video".
- **Acceptance criteria**
  - **AC-GUR-7-1** Given categories "Sains" with 2 videos and "Matematik" with 1, when "Sains" is selected, then exactly 2 videos show.
  - **AC-GUR-7-2** Given "Tambah Video" with a title, a category and a valid URL, when saved, then the video is listed under that category.
  - **AC-GUR-7-3 (R)** Given 3 videos, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth, cards are 1 column at 375, and the category tabs and "Tambah Video" are visible and >= 44 px.
  - **AC-GUR-7-4 (U)** Given migrated videos on UAT, when "Guru UAT" opens `/video`, then the video count equals the Admin Pusat Video list count for the same categories.
- **Gap** none. **Open** none.

### R1-GUR-8 Kelas Saya
- **Action: Fix**
- **Screen specification (from V2)** (authoritative)
  - **Screen A, list.** Route `/guru/kelas`; title "Kelas Saya — PRESTASIPLUS". Regions: header; class cards or empty state. Header: heading "Kelas Saya", counter "{n} kelas · {n} pelajar", button "Cipta Kelas" (-> create form). Empty state: "Belum ada kelas. Cipta kelas pertama anda untuk mula." Class card content in the populated state: Not observed in V2 — follow the V1 reference line and FR-GUR-8-*.
  - **Screen B, create form.** Route `/guru/kelas/cipta`; title "Cipta Kelas — PRESTASIPLUS"; one card "Maklumat Kelas". Fields: "Nama Kelas" (text); "Tingkatan" (select; V2 lists Darjah 1 to 6 and Tingkatan 1 to 5; V3 lists Tingkatan 1 to 5 only, D72); **"Subjek (pilihan)"** (select: "— Tiada —" then every active subject (§0A Subject lists) in the order of R1-GUR-5); "Tahun Sesi" (number/year). Buttons: "Batal" (back to the list); "Cipta Kelas" (saves). Validation and success messages: Not observed in V2 — follow FR-GUR-8-*.
  - **Corrections noted:** V2's labels are "Nama Kelas", "Tingkatan", "Subjek (pilihan)", "Tahun Sesi" (the V2 replica code said "Nama", "Tahap Pendidikan", "Sesi"): the V2 screen wins; "Subjek" is optional (V1 required it); the list heading counter is "{n} kelas · {n} pelajar" (not "{n} kelas aktif"); the button is "Cipta Kelas" (V1 "Cipta Kelas Baru"); there is no join code, QR or "Set Soalan" link on the V2 list (the teacher reaches Set Soalan from the Dashboard tile "Set Soalan" and "Urus set →").
#### Field & behaviour spec — R1-GUR-8 Kelas Saya

Routes `/guru/kelas`, `/guru/kelas/cipta`, `/guru/kelas/:id/edit`. API: API-GUR-01 (list), API-GUR-02 (create), API-GUR-03 (edit), API-GUR-05 (add / remove pupil), API-GUR-06 (create pupil). DM: `classrooms`, `enrolments`. Additions: ADD-01 (DM-73), ADD-02 (DM-74).

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Nama Kelas | text | Yes | empty | max 100 | "Sila isi nama kelas."; over 100: "Nama kelas tidak boleh melebihi 100 aksara."; unique per teacher and Tahun Sesi (case-insensitive, trimmed), else 409 "Nama kelas sudah digunakan." | none | `classrooms.name` | API-GUR-02, API-GUR-03 |
| Tingkatan | select | Yes | "-- Pilih tingkatan --" | OPT-TINGKATAN | "Sila pilih tingkatan." | none | `classrooms.education_level_id` | API-GUR-02, API-GUR-03 |
| Subjek (pilihan) | select | No | "— Tiada —" | OPT-SUBJEK | none | none | `classrooms.subject_id` (null for none) | API-GUR-02, API-GUR-03 |
| Tahun Sesi | number | Yes | current calendar year (MYT) | integer 2020 to 2100 | "Tahun sesi mesti antara 2020 dan 2100." | none | `classrooms.academic_year` | API-GUR-02, API-GUR-03 |
| Tambah Pelajar Baharu: Nama | text | Yes | empty | max 255 | "Sila isi nama."; over 255: "Nama tidak boleh melebihi 255 aksara." | none | `users.name` | API-GUR-06 |
| Tambah Pelajar Baharu: Kelas | read-only text | n/a | this class | none | none | none | `enrolments.classroom_id` | API-GUR-06 |
| Tambah Pelajar Baharu: No. IC | text | No | empty | exactly 12 digits, no hyphen | "No. IC mesti 12 digit tanpa sempang."; duplicate (409) "No. IC sudah didaftarkan." | none | `users.ic_hash`, `users.ic_masked` | API-GUR-06 |
| Tambah pelajar sedia ada: Cari pelajar... | combobox | No | empty | type-ahead from 2 characters, 20 results over pupils of the teacher's school who are active, in Tingkatan 1-5 and not in this class; sorted by name ascending; display "{nama} · {Tingkatan n}"; none found "Tiada pelajar dijumpai." | none | school set | `enrolments` (source `teacher`) | API-GUR-05 |
| Member list | table | n/a | name ascending | columns Nama, Tingkatan, Terakhir Aktif; row action "Keluarkan" (CF-08); empty "Belum ada pelajar dalam kelas ini." | none | none | `enrolments.status` | API-GUR-05 |

- **Messages.** A teacher with no school sees, instead of the form, "Akaun anda belum dipautkan ke sekolah. Sila hubungi pentadbir." Success toasts: "Kelas dicipta." (then the list opens), "Kelas dikemaskini.", "Pelajar ditambah.", "Pelajar dikeluarkan.". A new pupil shows the message "Pelajar dicipta. Login: {username} / {kata laluan lalai}" until dismissed (the default password comes from configuration and is shown once).
- **Username generation (R1 decision D113).** The pupil's name words in lower case are joined by "." and a 2-digit suffix is added until the username is unique in the school (for example `murid.contoh01`).
- **List.** Counter "{n} kelas · {n} pelajar" (distinct pupils); empty "Belum ada kelas. Cipta kelas pertama anda untuk mula." There is no delete for a class (as in V2).
- **State machine.** `enrolments.status`: `active` to `removed` by "Keluarkan" (teacher); adding the pupil again creates `active`; every count of XS-1 updates on the next load.

**Requirements added by this spec**
- **FR-GUR-8-6** The class form enforces the limits of the table; a class name is unique per teacher and Tahun Sesi (case-insensitive).
- **FR-GUR-8-7** "Cipta & Tambah" creates the pupil in the school with a generated unique username and the configured default password, and adds the pupil to the class.
- **AC-GUR-8-7** Given a class "5 Bestari" of 2026 owned by the teacher, when the teacher creates "5 bestari" with Tahun Sesi 2026, then "Nama kelas sudah digunakan." shows; with Tahun Sesi 2027 it saves.
- **AC-GUR-8-8** Given "Cipta & Tambah" with No. IC of 11 digits, when pressed, then "No. IC mesti 12 digit tanpa sempang." shows and no pupil is created.
- **AC-GUR-8-9** Given a teacher whose account has no school, when "Cipta Kelas" opens, then "Akaun anda belum dipautkan ke sekolah. Sila hubungi pentadbir." shows and no form is offered.

- **Current gap (change the existing code only):** remove the V3-only join code and "Kod QR" modal from the class card and the pupil "Sertai" box (`m10-teacher-class/routes/kelas.ts:15-29` pages and their API fields); use the V2 labels above, make "Subjek" optional and show the counter "{n} kelas · {n} pelajar".
- **Route** `/guru/kelas`, `/guru/kelas/cipta`, `/guru/kelas/:id/edit`. **Matrix** 8. **Priority** P2. **Delivery** A. **Status** GH/UAT built (list, "Cipta Kelas", V3 adds a join code and "Kod QR").
- **Reference [V2] `guru/kelas.blade.php`, `kelas-form.blade.php`, `TeacherController` (V2 primary); [V1] M10 S4-S5 (header only)**: heading "Kelas Saya" ("{n} kelas aktif", button "Cipta Kelas Baru"); cards with class name, subject, level, pupil count; empty "Belum ada kelas. Cipta kelas pertama anda untuk mula." Form "Cipta Kelas" / "Simpan": "Nama" (required), "Tahap Pendidikan" (required, Tingkatan 1-5 only), "Subjek", "Sesi" (year, default current year); the class belongs to the teacher's own school (a teacher with no school gets "Akaun anda belum dipautkan ke sekolah. Sila hubungi pentadbir."). On the edit page: card "Tambah Pelajar Baharu" ("Nama", "Kelas", "No. IC" -> "Cipta & Tambah"; success "Pelajar dicipta. Login: {username} / {kata laluan lalai}" where the default password is a configuration value (environment/settings), never hard-coded or written in docs); card "Tambah pelajar sedia ada" (select of pupils of the teacher's school not yet in the class + "Tambah"); member list with "Keluarkan"; empty "Belum ada pelajar dalam kelas ini."
- **Decision (C7, follow V2):** pupils are added **by the teacher** ("Guru anda yang menambah pelajar ke dalam kelas", V2 pupil page; `10-murid.md` R1-MUR-8 empty text). The V3-only join code, "Kod QR", the join URL and the pupil "Sertai" box are **not built**; V1's QR modal and its "Pilih Sekolah" search at class creation are V1-only and dropped (DV-GUR-8-1; D77 original UX, V2 primary). Class codes are therefore not shown anywhere (Prestasi header, Kelas Sekolah). Cross-document: `10-murid.md` FR-MUR-8-3 ("Sertai" by code) must be removed (OQ-X-3).
- **Functional requirements**
  - **FR-GUR-8-1** List the teacher's own classes with the pupil count = XS-1 for that class and the counter "{n} kelas · {n} pelajar" (distinct pupils); the Set Soalan feed is reached from the Dashboard (R1-GUR-2), not from this page.
  - **FR-GUR-8-2** Create/edit with the V2 fields "Nama Kelas", "Tingkatan", "Subjek (pilihan)", "Tahun Sesi"; "Nama Kelas" and "Tingkatan" are required (BM validation).
  - **FR-GUR-8-3** "Tambah pelajar sedia ada" and "Tambah Pelajar Baharu" add a pupil to the class; "Keluarkan" removes the link only (the account stays); counts update on every screen (XS-1).
  - **FR-GUR-8-4** A pupil sees the class on the pupil's Kelas Saya as soon as the teacher adds them.
  - **FR-GUR-8-5** Responsive: class cards 1 column at 375; the form RP-FORM; the member list RP-TABLE-LIST with "Keluarkan" >= 44 px; the pupil select full width.
- **Data** Owner M10. API `/api/guru/classes*`.
- **Acceptance criteria**
  - **AC-GUR-8-1** Given a teacher with a school, when "Cipta Kelas" is saved with Nama Kelas "5 Bestari", Tingkatan "Tingkatan 5", Subjek "Matematik", Tahun Sesi 2026, then the card appears in the list with 0 pupils.
  - **AC-GUR-8-2** Given the create form with an empty Nama, when "Cipta Kelas" is pressed, then a BM validation message shows and no class is created.
  - **AC-GUR-8-3** Given "5 Bestari" with 0 pupils, when an existing school pupil is added, then the card shows 1 pupil, the Pelajar Saya count rises by 1 and the pupil's Kelas Saya shows "5 Bestari".
  - **AC-GUR-8-4** Given a member, when "Keluarkan" is pressed, then the pupil leaves the class list and the count falls by 1, and the user account still exists.
  - **AC-GUR-8-5 (R)** Given 3 classes, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth, cards are 1 column at 375, and "Cipta Kelas" and "Keluarkan" are visible and >= 44 px.
  - **AC-GUR-8-6 (U)** Given "Guru UAT" with migrated classes, when Kelas Saya opens, then each card's pupil count equals the member list length on its edit page.
- **Deviations** DV-GUR-8-1 join code/QR/"Sertai" removed; DV-GUR-8-2 Tingkatan 1-5 only. **Open** none.

### R1-GUR-8b Set Soalan (teacher; delivered with 1.0, D106/D108(3))
- **Action: Build**
- **Screen specification (from V2)** (matches the text below)
  - **Screen A, list.** Route `/guru/set-soalan`; title "Set Soalan Guru — PRESTASIPLUS". Regions: header with count and button; three counters; set cards or empty state. Header: "Set Soalan Anda" / "{n} set soalan"; button "Cipta Set Baru". Counters (value / label): "Diterbitkan", "Draf", "Penyertaan". Empty state: icon, "Belum ada set soalan" / "Cipta set soalan tersendiri dan kongsi dengan kelas anda." with the button "Cipta Set Pertama". Populated set cards and the results page ("Hasil"): Not observed in V2 — follow FR-GUR-8b-*.
  - **Screen B, create form.** V2 route `/guru/set/cipta`; title "Cipta Set Soalan — PRESTASIPLUS". Regions: (1) card "Tapis Bank Soalan"; (2) card "Maklumat Set"; (3) "Pilih Soalan Dari Bank"; (4) action row.
  - **Card "Tapis Bank Soalan":** selects "Semua subjek" (then every active subject, §0A Subject lists) and "Semua tingkatan" (V2: Darjah 1-6 and Tingkatan 1-5; V3: Tingkatan 1-5 only); a search box; button "Tapis".
  - **Card "Maklumat Set":** sub-line "Bina set daripada bank soalan dan terbitkan kepada kelas anda"; fields "Tajuk Set", "Subjek" (select of every active subject, §0A Subject lists), "Tingkatan (pilihan)" (select, default "— Tiada —").
  - **"Pilih Soalan Dari Bank":** counter "{n} dipilih" (0 initially); a scrolling checkable list. Each row shows the question text (long text cut with "..." after about 110 characters) and a second line "{subjek} · {tahap} · ⭐{kesukaran}" (for example "Sains · Tingkatan 4 · ⭐2"; difficulty 1 to 3). The V2 bank list includes figure questions ("Rajah ... menunjukkan ..."): the picker must show them with their figure (D105).
  - **Action row buttons:** "Batal"; "Simpan Draf"; "Terbitkan".
  - **States:** empty list observed; validation and success/error messages: Not observed in V2 — follow FR-GUR-8b-*.
  - **Corrections noted:** V2 offers Darjah levels in the filters: V3 offers Tingkatan 1-5 only (D72/D96). The routes are `/guru/set-soalan` (list) and `/guru/set-soalan/cipta`; V2's `/guru/set/cipta` is accepted as an alias. The results page ("Hasil") was not captured (no sets): the V2 code text below applies.
#### Field & behaviour spec — R1-GUR-8b Set Soalan

Routes `/guru/set-soalan`, `/cipta`, `/:id`, `/:id/keputusan`. API: API-GUR-16 (`GET/POST /api/guru/question-sets`, `GET/PUT/DELETE /:id`, `POST /:id/status`, `POST /:id/copy`; results route and copy body: A2 ADD-19, registered as API-GUR-16 (extended)). DM: `question_sets`, `question_set_items`, `question_set_classrooms`; addition: A2 ADD-04, registered as DM-46 (extended), `question_sets.education_level_id`.

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Tajuk Set | text | Yes (also for a draft) | empty | max 150 | "Sila isi tajuk set."; over 150: "Tajuk set tidak boleh melebihi 150 aksara." | none | `question_sets.title` | API-GUR-16 |
| Subjek | select | Yes | "-- Pilih subjek --" | OPT-SUBJEK | "Sila pilih subjek." | none | `question_sets.subject_id` | API-GUR-16 |
| Tingkatan (pilihan) | select | No | "— Tiada —" | OPT-TINGKATAN | none | none | `question_sets.education_level_id` (null for none) | API-GUR-16 |
| Kelas | checkbox list (multi-select) | Yes to publish | none ticked | OPT-KELAS-OWN with no placeholder; heading "Kelas", help "Pilih kelas yang akan melihat set ini." | on "Terbitkan" with none ticked: "Pilih sekurang-kurangnya satu kelas sebelum menerbitkan." | none | `question_set_classrooms(question_set_id, classroom_id)` | API-GUR-16 |
| Tapis Bank: Semua subjek / Semua tingkatan | select x2 | No | the set's Subjek and Tingkatan once chosen, else "Semua" | OPT-SUBJEK, OPT-TINGKATAN | none | none | query only | API-GUR-16 |
| Cari teks soalan... | text | No | empty | search over question text (GLB-4) | "Taip sekurang-kurangnya 2 aksara." | none | query only | API-GUR-16 |
| Tapis | button | n/a | n/a | reloads the picker at page 1 | none | none | n/a | API-GUR-16 |
| Pilih Soalan Dari Bank | checkbox list | Yes (1 to 100) | none | approved and servable questions only, newest first, 50 per scroll batch; row = preview of 120 characters plus "...", second line "{subjek} · {Tingkatan n} · ⭐{kesukaran}" (stars = difficulty 1 to 5), figure shown inline; a stimulus group is one row with one checkbox; empty "Tiada soalan sepadan. Laraskan penapis di atas." | none chosen: "Pilih sekurang-kurangnya satu soalan."; over 100: "Satu set boleh mengandungi paling banyak 100 soalan."; group split: ERR-QST-02 | Tapis Bank | `question_set_items(position, question_id, question_version_no)` | API-GUR-16 |
| Counter | text | n/a | "0 dipilih" | "{n} dipilih" | none | none | n/a | none |

- **Buttons.** "Batal" (back, nothing saved); "Simpan Draf" (needs title, subject and at least one question; classes optional); "Terbitkan" (needs all of these and at least one class). Success toasts: "Draf disimpan.", "Set diterbitkan.", "Set dijadikan draf.", "Set dipadam.", "Set disalin."
- **State machine.** `draft` to `published` by "Terbitkan" (the set then appears in Murid 26 and in the Dashboard block "Set Soalan Dari Cikgu" for pupils of the ticked classes only); `published` to `draft` by "Jadikan Draf" (CF-11, attempts are kept); any state to deleted by "Padam" (CF-01, attempt rows are kept for Prestasi). The value `scheduled` is never produced by this screen.
- **Edit lock.** In a published set the title and classes stay editable; the question list is locked once any pupil has an attempt: "Soalan tidak boleh diubah kerana pelajar telah menjawab set ini."
- **Salin.** Dialog "Salin Set ke Kelas" with the select "Pilih Kelas Sasaran" ("-- Pilih kelas --", error "Sila pilih kelas sasaran."), the note "Set baharu akan dicipta sebagai draf dengan semua soalan disalin.", buttons "Batal" / "Salin". The result is a draft assigned to the chosen class titled "{title} (Salinan)".
- **List.** Counters "Diterbitkan", "Draf", "Penyertaan" (pupils with at least one completed attempt on any set of the teacher). Card: title, status chip (OPT-STATUS-SET), subject, "{n} soalan", "{n} siap" (pupils who finished), buttons "Hasil", "Urus →", "Salin", "Terbit" or "Jadikan Draf", "Padam". Sort: newest update first. Empty: "Belum ada set soalan" / "Cipta set soalan tersendiri dan kongsi dengan kelas anda." with "Cipta Set Pertama".
- **Results.** Select "Kelas" (first option "Semua Kelas", then the classes ticked on the set); cards "Penyertaan", "Skor Purata" (mean of the per-attempt percentages correct ÷ total × 100, shown as a whole number rounded half up), "Jumlah Percubaan"; table # · Pelajar · Skor ("{betul}/{jumlah}") · Ketepatan (at least 70 green, at least 50 amber, else red) · Tarikh (`dd/mm/yyyy`); newest first, 25 per page; empty "Belum ada pelajar menjawab set ini."; link "Kembali ke Set Soalan".

**Requirements added by this spec**
- **FR-GUR-8b-9** A set holds 1 to 100 questions; the title (150), subject and class rules of the table apply, and "Simpan Draf" never needs a class.
- **FR-GUR-8b-10** Once any pupil has an attempt, the question list of the set cannot change; title and classes can.
- **FR-GUR-8b-11** "Salin" creates a draft titled "{title} (Salinan)" with all questions, assigned to the chosen class only.
- **AC-GUR-8b-11** Given a pick of 101 questions, when "Simpan Draf" is pressed, then "Satu set boleh mengandungi paling banyak 100 soalan." shows and nothing is saved.
- **AC-GUR-8b-12** Given a published set with one pupil attempt, when the teacher edits the question list, then the request is refused and "Soalan tidak boleh diubah kerana pelajar telah menjawab set ini." shows; changing the title saves.
- **AC-GUR-8b-13** Given "Ujian 1" copied to "5 Cekap", when the list opens, then "Ujian 1 (Salinan)" is a `draft` with 5 questions under "5 Cekap".

- **Current gap:** no teacher Set Soalan route, page or API in V3 (the pupil side R1-MUR-26 is empty): add the route fragment under `src/modules/m10-teacher-class/routes/`, the list/form/results pages and `GET/POST/PUT/DELETE /api/guru/question-sets*` plus status, copy and results (API-GUR-16, Missing-Build; the module `apps/api/src/modules/classes/question-sets` already exists but serves the pupil side only, API-GUR-15, so the teacher routes are added to it).
- **Route** `/guru/set-soalan` (list "Set Soalan Guru"), `/guru/set-soalan/cipta`, `/guru/set-soalan/:id` (urus), `/guru/set-soalan/:id/keputusan`. **Matrix** none (no Guru sidebar item; reached from Kelas Saya). **Priority** P1. **Status** not built in V3 for teachers (the pupil side R1-MUR-26 shows an empty state).
- **Reference [V2] `guru/set.blade.php`, `set-form.blade.php`, `set-keputusan.blade.php`; [V1] M10 S13-S14** (V1 title "Set Soalan Anda"): list: header "Set Soalan Anda" ("{n} set soalan"), button "Cipta Set Baru"; counters "Diterbitkan", "Draf", "Penyertaan"; empty "Belum ada set soalan" / "Cipta set soalan tersendiri dan kongsi dengan kelas anda." + "Cipta Set Pertama"; each set card: title, status "Diterbitkan" or "Draf", type, subject, "{n} soalan", "{n} siap", buttons "Hasil", "Urus →", "Salin", "Terbit" / "Jadikan Draf", "Padam" (confirm "Padam set \"{title}\"? Tindakan ini tidak boleh diundur."). "Salin Set ke Kelas": "Pilih Kelas Sasaran" ("-- Pilih kelas --"), note "Set baharu akan dicipta sebagai draf dengan semua soalan disalin.", "Batal" / "Salin". Form "Cipta Set Soalan" / "Urus Set Soalan": filter card "Tapis Bank Soalan" (subject "Semua subjek", tingkatan "Semua tingkatan", search "Cari teks soalan...", "Tapis"); card "Maklumat Set" ("Bina set daripada bank soalan dan terbitkan kepada kelas anda"): "Tajuk Set" (required), "Subjek" (required), "Tingkatan (pilihan)" ("— Tiada —"); "Pilih Soalan Dari Bank" (scroll list of approved questions, checkbox, 120-character preview, "{subjek} · {tahap} · ⭐{kesukaran}", counter "{n} dipilih"; empty "Tiada soalan sepadan. Laraskan penapis di atas."); buttons "Batal", "Simpan Draf", "Terbitkan". Results "Keputusan: {tajuk}": cards "Penyertaan", "Skor Purata", "Jumlah Percubaan"; table # · Pelajar · Skor ("{betul}/{jumlah}") · Ketepatan · Tarikh; empty "Belum ada pelajar menjawab set ini."; link "Kembali ke Set Soalan". Pupil side (`10-murid.md` R1-MUR-26): published sets assigned to the pupil's class; mode `question_set`.
- **Functional requirements**
  - **FR-GUR-8b-1** List the teacher's own sets with the three counters (Diterbitkan, Draf, Penyertaan = number of pupils who completed at least one attempt on any set of the teacher).
  - **FR-GUR-8b-2** Create and edit a set: title, subject, optional Tingkatan, and a selection of approved questions from the bank filtered by subject, Tingkatan and text; only approved questions can be chosen; "Simpan Draf" and "Terbitkan" set the status.
  - **FR-GUR-8b-3** (D-A7, decided by principle 2026-11-04) A set is assigned to **explicitly selected own class(es)**: the create/edit form has a required multi-select "Kelas" (the teacher's own classes; label "Kelas", R1 decision D113) and "Terbitkan" is refused with a BM message while no class is selected. A published set is visible only to pupils enrolled in a selected class (it appears in Murid 26 and on the Dashboard "Set Soalan Dari Cikgu"); a pupil of another class, even of the same teacher, does not see it. "Jadikan Draf" withdraws it; archived questions drop out at serve time. A set is never visible to "all classes" implicitly.
  - **FR-GUR-8b-4** "Salin" copies the set with all its questions as a draft assigned to the chosen own class.
  - **FR-GUR-8b-8** The picker selects questions as units: choosing part of a stimulus group is refused (422, "Soalan dalam kumpulan rangsangan mesti dipilih bersama.") or selects the whole group; the star scale of "⭐{kesukaran}" is 1 to 5 (the V2 sample shows 1 to 3).
  - **FR-GUR-8b-5** "Hasil" returns the results to the teacher **per class**: a "Kelas" filter (default all selected classes), cards and table per class; the results table is one row per pupil attempt, newest first; accuracy = correct ÷ total × 100, returned with one decimal (60 4.6, D-T10-1) and shown as a whole number rounded half up; colours on the whole number: >= 70 green, >= 50 amber, else red.
  - **FR-GUR-8b-6** "Padam" removes the set after the confirm; pupil attempt records are kept for Prestasi.
  - **FR-GUR-8b-7** Responsive: set cards single column with action buttons wrapping (>= 44 px); the question picker is a single-column scroll list with >= 44 px checkboxes; the results table is RP-TABLE-LIST at 375/768; the form RP-FORM with "Simpan Draf" and "Terbitkan" not covering the list.
- **Data** Owner M10 (sets), M04 (questions), M05 (attempts: `practice_answers`, mode `question_set`; they count in every report, XS-8). API `/api/guru/question-sets*` (API-GUR-16, **to be built**: the module `apps/api/src/modules/classes/question-sets` exists but holds only the pupil feed `GET /set-soalan-saya`, API-GUR-15; no teacher route exists; 60 API-GUR-16 is Missing-Build).
- **Acceptance criteria**
  - **AC-GUR-8b-1** Given the question bank with 20 approved Matematik questions, when a set "Ujian 1" with 5 chosen questions is saved with "Simpan Draf", then it is listed as "Draf" with "5 soalan" and the pupils do not see it.
  - **AC-GUR-8b-2** Given that draft assigned to class "5 Bestari", when "Terbit" is pressed, then it is "Diterbitkan", a pupil of "5 Bestari" sees "Ujian 1" in Set Soalan Guru with "5 soalan", and a pupil of another teacher, or of the teacher's other class "5 Cekap", does not.
  - **AC-GUR-8b-3** Given a pupil who completes the set with 4 of 5 correct, when "Hasil" opens, then "Penyertaan" = 1, "Skor Purata" = 80%, and the row shows "4/5" and "80%".
  - **AC-GUR-8b-4** Given "Salin" to class "5 Cekap", when confirmed, then a draft copy with 5 questions exists attached to "5 Cekap".
  - **AC-GUR-8b-5** Given a question archived after publication, when a pupil opens the set, then the set shows 4 questions and the list count shows "4 soalan".
  - **AC-GUR-8b-6 (R)** Given 3 sets and a bank of 100 questions, when the list and the form open at 375, 768 and 1280 px, then scrollWidth <= innerWidth, set cards are single column at 375, and "Cipta Set Baru", "Terbit", "Salin" and the question checkboxes are visible and >= 44 px.
  - **AC-GUR-8b-8** Given a draft with no class selected, when "Terbitkan" is pressed, then a BM message shows and the set stays "Draf".
  - **AC-GUR-8b-9** Given a stimulus group of a figure and 3 questions, when only 2 of them are sent in the selection, then the request is refused with "Soalan dalam kumpulan rangsangan mesti dipilih bersama." (or the whole group is selected) and no set holds 2 of the 3.
  - **AC-GUR-8b-10** Given the set assigned to "5 Bestari" and "5 Cekap" with 1 pupil done in each (4/5 and 3/5), when "Hasil" opens and the filter is "5 Cekap", then "Penyertaan" = 1 and "Skor Purata" = 60%; the filter "Semua" shows 2 and 70%.
  - **AC-GUR-8b-7 (U)** Given "Guru UAT" and the UAT bank, when a set of 5 migrated approved questions is published, then a UAT pupil of "5 UAT" can play it and the attempt appears in "Hasil".
- **Open** none.

### R1-GUR-9 Soalan by Chapter
- **Action: Complete**
- **Screen specification (from V2)**
  - **Screen A, subject list.** Route `/practice/chapter`; title "Soalan by Chapter — PRESTASIPLUS". Regions: hero; grid of subject cards. Hero: label "Mode Sistematik", heading "Soalan by Chapter", text "Pelajar jawab bab demi bab. Bab seterusnya hanya terbuka selepas bab sebelumnya lengkap dan mencapai sekurang-kurangnya 70%.", button "Latih Tubi Rawak". Subject card (a link to the subject page): icon, subject name, "{n} bab tersedia", "{n} soalan chapter" (observed: Bahasa Melayu 26 bab, Bahasa Inggeris 34, Matematik 52, Sains 81, Sejarah 51 ... and **"0 soalan chapter" on every card**).
  - **Screen B, chapter list of one subject.** Route `/latih-tubi/bab/{kod subjek}` (for example `/latih-tubi/bab/BM`); title "Soalan by Chapter — {subject} — PRESTASIPLUS". Regions: hero; mastery note; ordered list of chapters. Hero: label "Mode Sistematik", the subject name, text "Jawab bab demi bab. Bab seterusnya hanya terbuka selepas bab sebelumnya lengkap dan mencapai sekurang-kurangnya 70%.", button "Semua Subjek" (back to screen A). Note: "Nota penguasaan: capai sekurang-kurangnya 70% dalam sesuatu bab sebelum meneruskan ke bab seterusnya." Chapter row: a number badge, the chapter title (the DSKP learning-standard text, for example "Mendengar, memahami dan menuturkan ayat dalam pelbagai jenis komunikasi lisan dengan betul."), a level chip ("Tingkatan 5"), "{n} soalan", and a status label "Tiada soalan" when the chapter has no questions.
  - **Practice screen after choosing a chapter:** Not observed in V2 — follow FR-GUR-9-*.
  - **States:** populated cards and rows observed with zero questions; loading and error: Not observed in V2 — follow FR-GUR-9-*.
  - **Corrections noted:** (1) the 70% unlock sentence contradicts D98 (every chapter open) and is not shown (DV-GUR-9-1); (2) "0 soalan chapter" on every card is a V2 data defect (chapters exist but no question is mapped to them): in V3 a card shows the real mapped count, and the admin's chapter mapping (D89) is what fills it; (3) the cards list every subject including Darjah-only content: V3 lists subjects that have Tingkatan 1-5 content (D72).
#### Field & behaviour spec — R1-GUR-9 Soalan by Chapter

Routes `/practice/chapter`, `/latih-tubi/bab/{kod subjek}`. API: API-DSKP-01 (subjects, learning map) and the existing chapter practice endpoints of the pupil module. The screens have no form field.

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Subject card | link card | n/a | n/a | one card per subject with chapter-mapped questions for Tingkatan 1-5 (OPT-SUBJEK order); text "{n} bab tersedia" and "{n} soalan chapter" (real mapped count of approved servable questions) | none | none | computed | API-DSKP-01 |
| Latih Tubi Rawak | button | n/a | n/a | opens the random Latih Tubi start | none | none | n/a | none |
| Semua Subjek | button | n/a | n/a | back to the subject list | none | none | n/a | none |
| Chapter row | link row | n/a | n/a | number badge, chapter title, level chip ("Tingkatan n"), "{n} soalan"; the status label "Tiada soalan" when the chapter has none; every chapter is open (D98) | none | none | computed | API-DSKP-01 |

- Empty: "Belum ada bab tersedia. Bab akan dipaparkan sebaik sahaja bank soalan mengikut bab dimuatkan." Panel or page failure: ERR-SYS-01b. A subject without Tingkatan 1-5 content is not listed.

**Requirements added by this spec**
- **FR-GUR-9-6** A chapter with no mapped question shows "Tiada soalan" and "0 soalan" and remains openable without an error.
- **AC-GUR-9-6** Given a chapter with no mapped question, when the chapter list opens, then the row shows "Tiada soalan" and opening it shows an empty state without an error.

- **Current gap (change the existing code only):** verify the page text has no 70% sentence; the page already exists (`/practice/chapter`, shared with the pupil): the gap is data (chapter-mapped questions), delivered by the Admin PRD.
- **Route** `/practice/chapter` (V2 `/latih-tubi/bab/{CODE}`). **Matrix** 9. **Priority** P1. **Delivery** A. **Status** GH 1 subject (Sejarah, 1 bab); UAT T5 "Tiada subjek bab tersedia untuk tahap ini" because questions are not mapped to chapters.
- **Reference [V2] `guru/practice-chapter.blade.php`**: hero "Mode Sistematik", title "Soalan by Chapter", button "Latih Tubi Rawak"; subject cards "{n} bab tersedia" and "{n} soalan chapter"; empty "Belum ada bab tersedia. Bab akan dipaparkan sebaik sahaja bank soalan mengikut bab dimuatkan." V2's hero sentence about a 70% unlock contradicts D98 (every chapter open) and is not shown (DV-GUR-9-1).
- **Functional requirements**
  - **FR-GUR-9-1** Lists every subject with chapter-mapped questions for Tingkatan 1-5 (D101), with chapter and question counts.
  - **FR-GUR-9-2** Every chapter is open (D98); no lock copy.
  - **FR-GUR-9-3** The chapter page lets the teacher answer and preview the questions in chapter order, including figure questions and whole stimulus groups (D105, D90).
  - **FR-GUR-9-4** Chapters come from the admin's manual Bab choice (D89); unmapped questions are simply absent; nothing errors. The admin cannot publish a question without Bab, and the Admin Pusat work-list "Soalan tanpa Bab" (30, bulk set-chapter) clears legacy ones, so a question never silently misses this page.
  - **FR-GUR-9-5** Responsive: subject cards 1/2/3 columns; chapter list single column at 375; figures fit the width and can be opened full screen (FR-X6-7).
- **Data** Owner M03/M04; admin feed Studio/Kurikulum (Admin PRD).
- **Acceptance criteria**
  - **AC-GUR-9-1** Given 12 Sejarah questions mapped to "Bab 1" and 8 to "Bab 2", when the page opens, then the Sejarah card shows "2 bab tersedia" and "20 soalan chapter".
  - **AC-GUR-9-2** Given "Bab 2" with no answered "Bab 1", when "Bab 2" is opened, then it opens (no lock) and no text mentions 70%.
  - **AC-GUR-9-3** Given a chapter with one stimulus group of a figure and 2 questions, when opened, then the figure shows once above both questions.
  - **AC-GUR-9-4 (R)** Given 15 subjects, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth, cards are 1/2/3 columns, and each card is a >= 44 px target.
  - **AC-GUR-9-5 (U)** Given the UAT bank after the Admin PRD mapping, when "Guru UAT" opens the page, then each mapped subject card's "soalan chapter" count equals the Admin Studio count of questions mapped to that subject's chapters; if nothing is mapped the empty copy shows without an error.
- **Gap** Data: `curriculum_nodes` empty on UAT. **Open** none.

### R1-GUR-10 Monitoring
- **Action: Fix**
- **Screen specification (from V2)** (authoritative)
  - **Route / title:** `/guru/monitoring`; browser title "Detail Sekolah — PRESTASIPLUS". The sidebar item opens the **school detail page of the teacher's own school**, not a national overview.
  - **Regions in order:** (1) banner; (2) school header card; (3) five KPI cards; (4) section "Senarai Pelajar T4/T5"; (5) section "Senarai Guru ({n})".
  - **Banner:** "Data ditapis untuk sekolah anda sahaja."
  - **School header card:** school name; school code (letters and digits); negeri; subscription pill "Aktif"; a level pill "Rendah — {p}%" coloured by Tahap.
  - **KPI cards (label / value):** "Pelajar T4/T5"; "Pernah Aktif"; "Soalan Dijawab"; "Guru Berdaftar"; "Guru Pernah Login".
  - **Section "Senarai Pelajar T4/T5":** table columns "#", "Nama", "Tingkatan", "Soalan", "Status", "Login Terakhir", "Aktiviti Terakhir"; note below: "Pelajar dianggap "Aktif" apabila pernah menjawab soalan. Data dikemas kini secara automatik."
  - **Section "Senarai Guru ({n})":** filter pills "Semua ({n})", "Pernah Login ({n})", "Belum Login ({n})"; table columns "#", "Nama", "Status", "Login Terakhir", "Daftar"; note below: "\"Pernah Login\" dianggarkan daripada aktiviti guru (kelas/soalan/set dicipta) kerana sistem ini tidak merekod log masuk."
  - **Not on this screen:** filters, a nine-card KPI row, school tables, Tracking Mingguan, PDF/CSV export.
  - **States:** the school with no active pupils (pupil table without rows) observed; row content and the empty-row copy of both tables, loading and error: Not observed in V2 — follow FR-GUR-10-*.
  - **Corrections noted:** (1) the V1 national overview (S2) is not shown to a teacher: `/guru/monitoring` renders the school detail of the teacher's school (the existing V3 school-detail page, `/guru/monitoring/sekolah/:id`, opened for the teacher's school); (2) V2 labels "Pelajar T4/T5" and "Senarai Pelajar T4/T5": V3 drops "T4/T5" (D101, all Tingkatan 1-5) and labels "Pelajar" and "Senarai Pelajar" (DV-GUR-10-1); (3) V2's teacher "Pernah Login" is an estimate from activity because V2 records no logins: V3 uses recorded last-login dates (M01) and does not show that note; (4) the V2 level pill "Rendah — {p}%" uses the Tahap bands of R1-AS-10 (Cemerlang > 60, Sederhana 20 to 60, Rendah > 0 and < 20, Tiada 0) over % Penglibatan = Pernah Aktif ÷ Pelajar.
#### Field & behaviour spec — R1-GUR-10 Monitoring

Routes `/guru/monitoring`, school detail, pupil and teacher detail pages. API: API-RPT-12 (the teacher sees the own school; `state` is ignored). Errors: ERR-SYS-01b per panel, ERR-ACC-02 for another school.

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Senarai Guru pills | filter pills | No | "Semua ({n})" | "Semua ({n})", "Pernah Login ({n})" (last login recorded), "Belum Login ({n})" | none | none | query string | API-RPT-12 |
| Drill pupil list pills | filter pills | No | "Semua (n)" | "Semua (n)", "● Aktif (n)" (at least one answer), "Login sahaja", "Belum login" | none | none | query string | API-RPT-12 |
| Cari nama pelajar... | text | No | empty | name substring (GLB-4) | "Taip sekurang-kurangnya 2 aksara." | none | query string | API-RPT-12 |

- Pupil table: sorted by name ascending, 25 per page. The Tahap pill is computed from Pernah Aktif ÷ Pelajar × 100 (whole %): Cemerlang above 60, Sederhana 20 to 60, Rendah above 0 and below 20, Tiada 0. Empty pupil table: "Belum ada pelajar aktif di sekolah ini."; empty teacher table: "Belum ada guru berdaftar di sekolah ini." No auto-refresh.

**Requirements added by this spec**
- **FR-GUR-10-8** The pill filters, search, sort, page size and Tahap bands of this subsection apply; counts on the pills equal the rows listed.
- **AC-GUR-10-8** Given a school with 100 pupils of whom 60 answered at least once, when Monitoring opens, then the Tahap pill reads Sederhana (60%); with 61 answered it reads Cemerlang.

- **Current gap (change the existing code only):** `m11-teacher-analytics/routes/monitoring.ts:46-78` mounts the national overview at `/guru/monitoring`: make the route render the school-detail component for the teacher's school (resolve the school from the session), drop the overview-only parts (filters, KPI row, school tables, weekly tracking, recommendation lists, export, auto-refresh) from the Guru mount, keep the school-detail drill links (`/guru/monitoring/sekolah/:id/pelajar/:id`, `/guru/:id`), and fix the defects listed below.
- **Route** `/guru/monitoring` (+ `/guru/monitoring/sekolah/:id`, `/sekolah/:id/pelajar/:id`, `/sekolah/:id/guru/:id`). **Matrix** 10. **Priority** P1. **Delivery** A. **Status** GH/UAT built, all sections; the filters list the whole country.
- **Scope** SC-G exception: the teacher's own school (V2 banner "Data ditapis untuk sekolah anda sahaja."): the page is the school detail of the own school; another school's detail page is 404. All levels Tingkatan 1-5 (D101): V1's "T4/T5" in labels is dropped (DV-GUR-10-1): labels "Pelajar", "Analisis Penglibatan Pelajar", "Senarai Pelajar".
- **V1 reference (kept only for the drill pages and the pupil/teacher lists; the national-overview parts, that is the guide, filters, nine KPIs, school tables, Tracking Mingguan and recommendation lists, are NOT shown to a teacher because V2 shows the school detail page only)** [V1] M11 S2-S5: guide "Panduan Monitoring Penglibatan" (six tiles, tip "Guna Filter untuk tapis negeri/tempoh/tahap. Export PDF/CSV untuk pembentangan."), closable (`hideMonitoringGuide`), reopen "Tunjuk panduan penggunaan"; filter "Tempoh" ("Semua Masa", "7 Hari", "30 Hari", "3 Bulan"), "Tahap" ("Semua Tahap", "Cemerlang", "Sederhana", "Rendah", "Kritikal", "Tiada Langsung"), "Tapis", "Reset"; "PDF", "CSV", "Refresh"; "Auto-refresh dalam m:ss" (300 s, pause/play). 9 KPIs: "Jumlah Sekolah", "Pelajar" ("Berdaftar"), "Pernah Aktif" ("Min. 1 soalan"), "% Penglibatan" ("Keseluruhan"), "Soalan Dijawab" ("Total"), "Purata/Pelajar" ("Soalan/pelajar aktif"), "Guru Berdaftar", "Guru Pernah Login", "% Penglibatan Guru". Tables "Analisis Penglibatan Pelajar" (# · Sekolah · Daftar · Aktif · % · Tahap · Bar), "Analisis Penglibatan Guru" (# · Sekolah · Daftar · Login · % · Tahap · Bar), "Tracking Mingguan" (Sekolah · M1..Mn · Trend · Best), "Sekolah Terbaik", "Perhatian Segera", "Cadangan Tindakan" with the V1 sentence templates (for example "{sekolah}: Penglibatan sangat rendah. Cadangan: Sesi motivasi dan demonstrasi penggunaan platform kepada pelajar."); empty "Tiada pemerhatian yang perlu diberi perhatian buat masa ini." Tahap bands: Cemerlang > 60%, Sederhana 20-60, Rendah 5-<20, Kritikal > 0 and < 5, Tiada Langsung 0. School detail: header (name, kod, negeri, "Active — sehingga {tarikh}" / "Tiada langganan", tahap pill), 5 cards, "Senarai Pelajar" with pills "Semua (n)", "● Aktif (n)", "Login sahaja", "Belum login" and search "Cari nama pelajar...", "Senarai Guru (n)"; pupil detail tabs "Mengikut Subjek", "Mengikut Tajuk", "Senarai Soalan", "Jawapan Salah", "Gap Analysis"; teacher detail.
- **Defects fixed (D9):** Gap Analysis tab shows its content (V1 D-M11-2); "Jawapan Salah" has "Papar lagi" (D-M11-6); the filter form stays under `/guru/monitoring` (D-M11-4); no CSRF token in the URL (D-M11-5); S3 and S5 use the same active count (D-M11-11).
- **Functional requirements**
  - **FR-GUR-10-1** Scope as above; the five cards: "Pelajar" = XS-1 of the school, "Pernah Aktif" = XS-2 (all time), "Soalan Dijawab" = XS-4 (all time), "Guru Berdaftar" = XS-3, "Guru Pernah Login" = teachers with a recorded login; the header level pill "{Tahap} — {p}%" with % = Pernah Aktif ÷ Pelajar × 100 (1 decimal).
  - **FR-GUR-10-2** The page has exactly the V2 sections (school header, five cards, "Senarai Pelajar" with its note, "Senarai Guru ({n})" with the pills "Semua", "Pernah Login", "Belum Login" and its table); the V1 pupil pills ("Semua", "Aktif", "Login sahaja", "Belum login") and the search "Cari nama pelajar..." stay on the pupil list as already built (V1 fallback).
  - **FR-GUR-10-3** Pupil rows open `/guru/monitoring/sekolah/:id/pelajar/:id` and teacher rows `/guru/monitoring/sekolah/:id/guru/:id`; links stay under `/guru/monitoring/...`.
  - **FR-GUR-10-4** Gap Analysis, "Jawapan Salah" paging and the question modal work on the pupil detail.
  - **FR-GUR-10-5** The pupil list "Status" is "Aktif" (>= 1 answer), "Login sahaja" or "Belum login"; "Login Terakhir" and "Aktiviti Terakhir" print "dd/mm/yyyy HH:mm" or "-".
  - **FR-GUR-10-6** The teacher list "Status" is "Pernah login" or "Belum login"; "Daftar" prints "dd/mm/yyyy".
  - **FR-GUR-10-7** Responsive: the five cards 2 columns at 375; the pupil list (184+ rows, paginated 25) and the teacher list are RP-TABLE-LIST cards at 375/768 and tables at 1280; the pills and the search are full width and >= 44 px; text >= 12 px (body >= 14 px).
- **Data** Owner M11 (`apps/api/src/modules/reports/analytics/services/monitoring.service.ts`); M02, M05.
- **Acceptance criteria**
  - **AC-GUR-10-1** Given a teacher at "SMK Demo Satu", when "Monitoring" is clicked, then the page titled "Detail Sekolah" opens with the banner "Data ditapis untuk sekolah anda sahaja.", the school header of SMK Demo Satu, the five cards, and no other school name and no "Negeri" filter.
  - **AC-GUR-10-2** Given the school has 3 teachers, then "Guru Berdaftar" = 3 and equals "Senarai Guru" of the school admin.
  - **AC-GUR-10-3** Given a pupil with 3 wrong answers, when the pupil detail's "Gap Analysis" tab is chosen, then its content shows (topic gaps or "Tiada topik lemah dikesan!").
  - **AC-GUR-10-4** Given 17 pupils of whom 12 have answered, when the page opens, then "Pelajar" = 17, "Pernah Aktif" = 12, the header pill reads "Cemerlang — 70.6%" (12 ÷ 17, above 60), and the pupil list shows 12 rows with status "Aktif".
  - **AC-GUR-10-5** Given a school detail of another school by id, when opened, then 404.
  - **AC-GUR-10-6 (R)** Given a school with 184 pupils and 34 teachers, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth, the pupil and teacher lists are cards at 375/768 (25 per page), the five cards are 2 columns at 375, and the pupil search, the pills "Semua", "Pernah Login", "Belum Login" and the pagination are visible and >= 44 px.
  - **AC-GUR-10-7 (U)** Given "Guru UAT" at the migrated school of "Admin Sekolah UAT", when Monitoring opens, then "Pelajar", "Pernah Aktif" and "Guru Berdaftar" equal the same three figures on Admin Sekolah Monitoring (AS-10).
- **Deviations** DV-GUR-10-1 labels without "T4/T5" (D101); DV-GUR-10-2 school-detail page instead of the national overview (V2); DV-GUR-10-3 defect fixes and recorded logins. **Open** none (OQ-G-8 closed).

### R1-GUR-11 Kirkpatrick
- **Action: Fix**
- **Screen specification (from V2)** (authoritative for the Guru; replaces the V1 text below where they differ). The observed account has no class, so every page was seen in its empty state.
  - **Routes / titles:** `/guru/kirkpatrick` ("Kirkpatrick — PRESTASIPLUS"); `/guru/kirkpatrick/reaction` ("Kirkpatrick — T1 Reaksi — PRESTASIPLUS"); the Learning, Behavior, Results, Chain and Interventions pages follow the same pattern (V2 route names `learning`, `behavior`, `results`, `chain`, `interventions`).
  - **Common to every page:** banner "Data ditapis untuk sekolah anda sahaja."; tab strip "Overview", "T1: Reaksi", "T2: Pembelajaran", "T3: Tingkah Laku", "T4: Hasil", "Rantaian", "Intervensi" (V3 labels follow the 2026-10-31 rename "Ringkasan", "Tahap 1: Reaksi" ... "Rantaian Impak").
  - **Overview.** Intro: "🟦 Model penilaian 4 tahap keberkesanan pembelajaran bagi kelas anda — daripada reaksi pelajar hingga hasil pencapaian." Section "Kirkpatrick Evaluation Flow" / "Klik mana-mana tahap untuk lihat detail" with four clickable cards: "T1: Reaksi" ("{p}% positif" / "Kepuasan & mood pelajar"); "T2: Pembelajaran" ("{p}%" / "Ketepatan purata latihan"); "T3: Tingkah Laku" ("{n} pelajar" / "Aktif dalam 30 hari"); "T4: Hasil" ("{n} pelajar" / "Capai ketepatan ≥ 70%"). Section "Taburan Engagement Pelajar" ("{n} pelajar") with five tiles, each count, "{p}%" and range: "Champion" (">50 soalan"), "Konsisten" ("20-50 soalan"), "Berkembang" ("5-20 soalan"), "Minimum" ("<5 soalan"), "Tidak Terlibat" ("0 soalan"). Box "📌 Kesimpulan": "Penilaian menunjukkan perkaitan antara penglibatan pelajar (T3) dengan pencapaian (T4). Fokuskan intervensi pada pelajar kurang aktif untuk meningkatkan hasil keseluruhan."
  - **T1: Reaksi.** Four cards (value / note): "NPS Pelajar" ("—" / "Tinjauan NPS belum dijalankan"); "NPS Guru" (same); "NPS Admin" (same); "Kepuasan Purata" ("—" / "Belum ada mood check-in"). Four cards: "Jumlah Check-in" (0); "Pelajar Terlibat" ("0/0"); "Mood Positif" ("—" / "Gembira + Okay"); "Check-in 7 Hari" (0). Section "Taburan Mood Pelajar"; empty: "💭 Belum ada mood check-in" / "Pelajar perlu check-in mood harian untuk mengukur reaksi (T1)." Notice: "Tinjauan NPS belum dijalankan" / "Apabila tinjauan kepuasan (NPS) pelajar/guru dilaksanakan, skor sebenar akan dipaparkan di sini. Buat masa ini T1 diukur melalui proksi mood check-in sahaja."
  - **T2: Pembelajaran.** Six cards: "Soalan Dijawab" (0); "Ketepatan" ("—"); "Skor Purata" ("—"); "Sesi Selesai" ("0/0"); "Kadar Penyelesaian" ("—"); "Learning Gain" ("-" / "Perlu pre/post test"). Empty notice: "Pre-Test / Post-Test belum dimulakan" / "Apabila terdapat data latihan merentasi tempoh ≥ 2 minggu, Hake's Normalized Learning Gain akan dikira secara automatik (proksi: ketepatan minggu pertama vs 7 hari terakhir)." and the formula line "g = (Post - Pre) / (100 - Pre) · High: g≥0.7 · Medium: 0.3≤g<0.7 · Low: g<0.3". Table "Pembelajaran Mengikut Kelas": "#", "Kelas", "Pelajar", "Soalan", "Ketepatan", "Skor Purata", "Subjek".
  - **T3: Tingkah Laku.** Six cards: "Jumlah Pelajar", "Pernah Aktif", "Jumlah Sesi", "Soalan Dijawab", "Ketepatan" ("—"), "Aktif 7 Hari" ("0%" and "0/0"). Section "Taburan Tahap Engagement": five tiles "Champion" (">50 soalan"), "Konsisten" ("20-50 soalan"), "Berkembang" ("5-20 soalan"), "Minimum" ("<5 soalan"), "Tidak Terlibat" ("0 soalan"), each with a count, a bar and "{p}%". Table "Engagement Mengikut Kelas": "#", "Kelas", "Pelajar", "Aktif", "Soalan", "Sesi", "Purata/Aktif", "Skor", "Tahap". Section "Amaran & Pemerhatian"; empty: "Belum ada pelajar dalam kelas anda — tambah pelajar untuk mula memantau engagement." Notice: "💭 Data Mood Belum Mencukupi" / "Pelajar perlu check-in mood harian untuk analisis kesejahteraan vs prestasi."
  - **T4: Hasil.** Six cards (value / note): "GPS Headcount" ("—" / "Belum diimport"); "Kadar Lulus" ("—" / "Keputusan belum diimport"); "Pelajar Gred A" ("—" / "Keputusan belum diimport"); "Ketepatan Platform" ("—" / "{n} soalan"); "Pelajar Aktif" ("0" / "{p}% daripada {n}"); "Rekod Headcount" ("—" / "Data TOV/OTR"). Section "GPS Mengikut Subjek": empty "Data GPS / peperiksaan belum diimport" / "Apabila markah headcount (OTR) atau keputusan peperiksaan sebenar diimport, GPS mengikut subjek akan dipaparkan di sini."; note "GPS rendah = lebih baik. Trend: berbanding tahun sebelumnya." Section "Trend GPS": empty "Trend GPS memerlukan data berbilang tahun" / "Import keputusan peperiksaan tahunan untuk melihat trend GPS keseluruhan dan mengikut subjek." Table "Prestasi Mengikut Kelas (Platform)": "#", "Kelas", "Pelajar", "Aktif", "Ketepatan", "Soalan", "Tahap". Section "ROI Platform (Anggaran)": "Pelajar Aktif", "Purata Soalan/Pelajar", "Ketepatan Aktif", "GPS Headcount", and the text "ROI penuh akan dapat dikira apabila:" followed by a checklist (items not legible in the observation: follow FR-GUR-11-*). Section "Pemerhatian & Insight"; empty: "Belum ada pelajar dalam kelas anda — data impak tidak dapat dianalisis lagi." Footer: "Disclaimer: GPS & keputusan peperiksaan belum diimport — hanya metrik penggunaan platform sebenar dipaparkan. Tiada angka dianggarkan."
  - **Rantaian (Rantaian Impak).** Header "Model Kirkpatrick — Rantaian Impak" / "Bukti keberkesanan pembelajaran kelas anda berdasarkan 4 Tahap Kirkpatrick"; link "← Kembali". Four linked blocks, each with a mini-metric list and a "→" arrow to the next: "T1 Reaksi" ("Kepuasan pelajar (proksi: mood check-in)"; "NPS Purata", "Kepuasan", "Responden", "Check-in"); "T2 Pembelajaran" ("Ketepatan latihan (attempt-truth)"; "Ketepatan", "Soalan Dijawab", "Skor Purata"); "T3 Tingkah Laku" ("Konsistensi penggunaan platform (Mastery Learning)"; "Pelajar Aktif {n}/{n} ({p}%)", "Sesi Latihan", and "Taburan Konsistensi:" with Champion, Konsisten, Berkembang, Minimum, Tidak Terlibat); "T4 Hasil / Impak" ("Korelasi penggunaan dengan pencapaian"; "GPS", "Korelasi (r)", "Kekuatan" = "Tiada data"). Section "Analisis Korelasi: Penggunaan → Pencapaian": table "Tahap Penggunaan", "Bil. Pelajar", "Purata Ketepatan", "Visual"; conclusion line "Kesimpulan ALESA: Data tidak mencukupi untuk analisis korelasi." (V3 drops the word ALESA, D73: "Kesimpulan:"). Section "Kesimpulan Model Kirkpatrick": "Berdasarkan analisis empat tahap Model Kirkpatrick untuk kelas anda:" then four lines "Tahap 1 (Reaksi) diukur melalui mood check-in harian pelajar.", "Tahap 2 (Pembelajaran) diukur melalui ketepatan jawapan sebenar (attempt-truth).", "Tahap 3 (Tingkah Laku) diukur melalui konsistensi penggunaan platform (Mastery Learning).", "Tahap 4 (Hasil) diukur melalui korelasi antara penggunaan aktif dengan ketepatan jawapan." and the rule "Metrik yang belum mempunyai data sebenar dipaparkan sebagai "—" dan bukan angka anggaran."
  - **Intervensi.** Intro: "🧭 Pantau amaran kesejahteraan, kenal pasti pelajar berisiko, dan rekod tindakan intervensi anda. Data ini menggerakkan Kirkpatrick — Intervensi." Three counters: "Amaran Belum Selesai", "Pelajar Berisiko (<55%)", "Intervensi Hari Ini". Form "Rekod Intervensi Baru": "Pelajar" (select, default "— Pilih pelajar —"); "Jenis" (select: "Akademik (prestasi rendah)", "Kesejahteraan / mood", "Kehadiran", "Lain-lain"); "Catatan amaran (pilihan)"; "Tindakan diambil"; button "✓ Rekod Intervensi". Panels: "🚨 Amaran Kesejahteraan Belum Selesai" (empty "✅ Tiada amaran belum selesai."); "⚠️ Pelajar Berisiko" (empty "✅ Tiada pelajar di bawah 55%."); counters "Jumlah Intervensi", "Menunggu Semakan", "Meningkat"; list "🗂️ Senarai Intervensi" (empty "Tiada intervensi direkod lagi.").
  - **Not observed in V2:** pupil detail page, PDF export, populated rows of any table, loading and error states — follow FR-GUR-11-* and the V1 text below.
  - Overview (title "Kirkpatrick — PRESTASIPLUS"): intro "🟦 Model penilaian 4 tahap keberkesanan pembelajaran bagi kelas anda — daripada reaksi pelajar hingga hasil pencapaian."; "Kirkpatrick Evaluation Flow" ("Klik mana-mana tahap untuk lihat detail") with four cards: "T1: Reaksi" "{p}% positif" "Kepuasan & mood pelajar"; "T2: Pembelajaran" "{p}%" "Ketepatan purata latihan"; "T3: Tingkah Laku" "{n} pelajar" "Aktif dalam 30 hari"; "T4: Hasil" "{n} pelajar" "Capai ketepatan ≥ 70%"; "Taburan Engagement Pelajar" ("{n} pelajar"; tiles "{n}" / label / "{p}% · >50 soalan", "· 20-50 soalan", "· 5-20 soalan", "· <5 soalan", "· 0 soalan" for Champion, Konsisten, Berkembang, Minimum, Tidak Terlibat); card "📌 Kesimpulan": "Penilaian menunjukkan perkaitan antara penglibatan pelajar (T3) dengan pencapaian (T4). Fokuskan intervensi pada pelajar kurang aktif untuk meningkatkan hasil keseluruhan." **No** level-card row with "Lihat detail", **no** "Perbandingan Sebelum & Selepas", no KPI row, no info card on the Guru overview (those exist only on the school-admin overview, R1-AS-11).
  - T1 Reaksi (title "Kirkpatrick — T1 Reaksi"): cards "NPS Pelajar", "NPS Guru", "NPS Admin" (each "—" / "Tinjauan NPS belum dijalankan"), "Kepuasan Purata" ("—" / "Belum ada mood check-in"); tiles "Jumlah Check-in", "Pelajar Terlibat" ("0/0"), "Mood Positif" ("Gembira + Okay"), "Check-in 7 Hari"; "Taburan Mood Pelajar" (empty "Belum ada mood check-in" / "Pelajar perlu check-in mood harian untuk mengukur reaksi (T1)."); box "Tinjauan NPS belum dijalankan": "Apabila tinjauan kepuasan (NPS) pelajar/guru dilaksanakan, skor sebenar akan dipaparkan di sini. Buat masa ini T1 diukur melalui proksi mood check-in sahaja."
  - T2 Pembelajaran (title "Kirkpatrick — T2 Pembelajaran"): cards "Soalan Dijawab", "Ketepatan", "Skor Purata", "Sesi Selesai" ("{n}/{n}"), "Kadar Penyelesaian", "Learning Gain" ("-" / "Perlu pre/post test"); box "Pre-Test / Post-Test belum dimulakan" ("Apabila terdapat data latihan merentasi tempoh ≥ 2 minggu, Hake's Normalized Learning Gain akan dikira secara automatik (proksi: ketepatan minggu pertama vs 7 hari terakhir)." and "g = (Post - Pre) / (100 - Pre) · High: g≥0.7 · Medium: 0.3≤g<0.7 · Low: g<0.3"); table "Pembelajaran Mengikut Kelas" ("#", "Kelas", "Pelajar", "Soalan", "Ketepatan", "Skor Purata", "Subjek").
  - T3 Tingkah Laku (title "Kirkpatrick — T3 Tingkah Laku"): cards "Jumlah Pelajar", "Pernah Aktif", "Jumlah Sesi", "Soalan Dijawab", "Ketepatan", "Aktif 7 Hari" ("{p}%" and "{n}/{n}"); "Taburan Tahap Engagement" (Champion ">50 soalan", Konsisten "20-50 soalan", Berkembang "5-20 soalan", Minimum "<5 soalan", Tidak Terlibat "0 soalan", each with count, bar and %); table "Engagement Mengikut Kelas" ("#", "Kelas", "Pelajar", "Aktif", "Soalan", "Sesi", "Purata/Aktif", "Skor", "Tahap"); "Amaran & Pemerhatian" (empty "Belum ada pelajar dalam kelas anda — tambah pelajar untuk mula memantau engagement."); mood empty "💭 Data Mood Belum Mencukupi" / "Pelajar perlu check-in mood harian untuk analisis kesejahteraan vs prestasi." (No 24-hour heat table in V2.)
  - T4 Hasil (title "Kirkpatrick — T4 Hasil"): cards "GPS Headcount" ("Belum diimport"), "Kadar Lulus" ("Keputusan belum diimport"), "Pelajar Gred A" ("Keputusan belum diimport"), "Ketepatan Platform" ("{n} soalan"), "Pelajar Aktif" ("{p}% daripada {n}"), "Rekod Headcount" ("Data TOV/OTR"); "GPS Mengikut Subjek" (empty "Data GPS / peperiksaan belum diimport" / "Apabila markah headcount (OTR) atau keputusan peperiksaan sebenar diimport, GPS mengikut subjek akan dipaparkan di sini." and "GPS rendah = lebih baik. Trend: berbanding tahun sebelumnya."); "Trend GPS" (empty "Trend GPS memerlukan data berbilang tahun" / "Import keputusan peperiksaan tahunan untuk melihat trend GPS keseluruhan dan mengikut subjek."); table "Prestasi Mengikut Kelas (Platform)" ("#", "Kelas", "Pelajar", "Aktif", "Ketepatan", "Soalan", "Tahap"); "ROI Platform (Anggaran)" (tiles "Pelajar Aktif", "Purata Soalan/Pelajar", "Ketepatan Aktif", "GPS Headcount" and "ROI penuh akan dapat dikira apabila:" with a list); "Pemerhatian & Insight" (empty "Belum ada pelajar dalam kelas anda — data impak tidak dapat dianalisis lagi."); "Disclaimer: GPS & keputusan peperiksaan belum diimport — hanya metrik penggunaan platform sebenar dipaparkan. Tiada angka dianggarkan."
  - Rantaian (title "Kirkpatrick — Rantaian Impak"): heading "Model Kirkpatrick — Rantaian Impak" / "Bukti keberkesanan pembelajaran kelas anda berdasarkan 4 Tahap Kirkpatrick" and the link "← Kembali"; four cards T1 "Reaksi" ("Kepuasan pelajar (proksi: mood check-in)": "NPS Purata", "Kepuasan", "Responden", "Check-in"), T2 "Pembelajaran" ("Ketepatan latihan (attempt-truth)": "Ketepatan", "Soalan Dijawab", "Skor Purata"), T3 "Tingkah Laku" ("Konsistensi penggunaan platform (Mastery Learning)": "Pelajar Aktif {n}/{n} ({p}%)", "Sesi Latihan", "Taburan Konsistensi:" with Champion, Konsisten, Berkembang, Minimum, Tidak Terlibat), T4 "Hasil / Impak" ("Korelasi penggunaan dengan pencapaian": "GPS", "Korelasi (r)", "Kekuatan" "Tiada data"); table "Analisis Korelasi: Penggunaan → Pencapaian" ("Tahap Penggunaan", "Bil. Pelajar", "Purata Ketepatan", "Visual"); line "Kesimpulan ALESA: Data tidak mencukupi untuk analisis korelasi." (hidden, D73); card "Kesimpulan Model Kirkpatrick": "Berdasarkan analisis empat tahap Model Kirkpatrick untuk kelas anda:" then four lines "Tahap 1 (Reaksi) diukur melalui mood check-in harian pelajar.", "Tahap 2 (Pembelajaran) diukur melalui ketepatan jawapan sebenar (attempt-truth).", "Tahap 3 (Tingkah Laku) diukur melalui konsistensi penggunaan platform (Mastery Learning).", "Tahap 4 (Hasil) diukur melalui korelasi antara penggunaan aktif dengan ketepatan jawapan." and "Metrik yang belum mempunyai data sebenar dipaparkan sebagai "—" dan bukan angka anggaran." There is no PDF button in the V2 capture.
  - Intervensi: exactly the V2 text already quoted below.
  - **Corrections noted:** (1) **V2 banner contradiction:** every Guru Kirkpatrick page says "Data ditapis untuk sekolah anda sahaja." but its copy says "kelas anda" and its tables are "Mengikut Kelas": the data is the teacher's classes, so V3 prints "Data ditapis untuk kelas anda sahaja." (DV-GUR-11-5; Monitoring keeps "sekolah anda" because its data is the school); (2) the Guru tables are "…Mengikut Kelas" (not "…Mengikut Sekolah"); (3) the Guru overview is the V2 flow plus engagement plus "Kesimpulan": the V1 level cards, before/after panel, KPI row and info card are not shown to a teacher (DV-GUR-11-6); (4) T1 uses mood check-ins as the satisfaction proxy (V2 text); (5) the 24-hour heat table and the "Ramalan ALESA" table of V1 are not in V2 and are not shown to the Guru.
#### Field & behaviour spec — R1-GUR-11 Kirkpatrick (shared with R1-AS-11)

Routes `/guru/kirkpatrick` (Ringkasan), `/reaction`, `/learning`, `/behavior`, `/results`, `/chain`, `/intervention`, `/export-pdf`. API: API-RPT-11. Additions: ADD-05 (DM-30), ADD-15 (DM-30, API-RPT-17). The pages have no page filter for the Guru.

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Intervensi: Pelajar | select | Yes | "— Pilih pelajar —" (preselected from the query `pelajarId`) | own pupils (Admin Sekolah: active pupils of the school, name ascending); order Kritikal and Tinggi first, then name | "Sila pilih pelajar." | none | `interventions.student_id` | API-RPT-11 |
| Jenis | select | Yes | "-- Pilih jenis --" | OPT-JENIS-INTERVENSI | "Sila pilih jenis." | none | `interventions.alert_type` (`declining`, `mood`, `inactive`, `other`) | API-RPT-11 |
| Catatan amaran (pilihan) | text | No | empty | placeholder "cth: ketepatan menurun 3 minggu"; max 300 | "Catatan tidak boleh melebihi 300 aksara." | none | `interventions.alert_description` (empty string when blank) | API-RPT-11 |
| Tindakan diambil | textarea | Yes | empty | placeholder "cth: sesi bimbingan 1-1, hubungi penjaga"; max 500 | "Sila isi tindakan diambil."; over 500: "Tindakan diambil tidak boleh melebihi 500 aksara." | none | `interventions.action_taken` | API-RPT-11 |
| ✓ Rekod Intervensi | button | n/a | n/a | saves (busy "Menyimpan...") and shows the toast "Intervensi direkodkan."; `action_date` = today, `before_accuracy` = pupil accuracy of the 14 days before | none | none | `interventions.action_date`, `before_accuracy`, `created_by_id` | API-RPT-11 |
| Semak keputusan | button per row | n/a | n/a | enabled 7 or more days after the record (R1 decision D113); writes `after_accuracy` = pupil accuracy of the 14 days after the record | none | record age | `interventions.after_accuracy` | API-RPT-11 (ADD-15) |

- **Intervention state.** "Menunggu Semakan" while `after_accuracy` is empty; after "Semak keputusan" the row shows "Ketepatan Sebelum {a}% → Selepas {b}%" (whole %). The "Meningkat" counter counts reviewed interventions with b above a.
- **Engagement.** OPT-ENGAGEMENT (Champion 51 or more, Konsisten 20 to 50, Berkembang 5 to 19, Minimum 1 to 4, Tidak Terlibat 0; labels ">50 soalan", "20-50 soalan", "5-19 soalan", "1-4 soalan", "0 soalan").
- **Learning Gain.** g = (Post − Pre) ÷ (100 − Pre) with Pre = accuracy of the first week of data and Post = accuracy of the last 7 days (both as fractions), 2 decimals; High at 0.7 or more, Medium 0.3 to below 0.7, Low below 0.3; needs at least 14 days between the first and last answer, else "-".
- **Korelasi (r).** Pearson over pupils (x = answers count, y = accuracy %), 2 decimals; Kekuatan: |r| at least 0.7 "Kuat", 0.4 to below 0.7 "Sederhana", 0.1 to below 0.4 "Lemah", below 0.1 "Tiada"; fewer than 5 pupils with answers: "Tiada data". The correlation table has the bands "1-20 soalan", "21-50 soalan", "51-100 soalan", "100+ soalan" (each pupil in exactly one band; 100 belongs to "51-100 soalan", 101 and more to "100+ soalan") with pupils and mean accuracy. ROI and GPS show "—" without imported data.
- **Tahap 2** "Prestasi Mengikut Subjek" status: "Mastered" when accuracy is 80 or more, else "Developing" (V2 English words kept). **Tahap 1** sections "Butiran Maklum Balas", "Taburan Mood", "Komen Terkini" (table Komen · NPS · Kepuasan · Tarikh, newest first, 10 rows).
- **PDF export** `/export-pdf`: the Ringkasan cards and the seven-tab tables in tab order, file name `kirkpatrick-{kelas atau sekolah}-{yyyymmdd}.pdf`; failures ERR-EXP-01. Button "Muat Turun Laporan" on Rantaian Impak.
- **R1-AS-11.** The filter card is a locked read-only label "{nama sekolah}" with the line "{kod} · {PPD} · {negeri}" and no select and no "Tapis" button (FR-AS-11-2). Tabs "Ringkasan", "Tahap 1: Reaksi", "Tahap 2: Pembelajaran", "Tahap 3: Tingkah Laku", "Tahap 4: Hasil", "Rantaian Impak", "Intervensi". The panel "Perbandingan Sebelum & Selepas" compares the first month with data to the latest month with data (no input); otherwise "Data tidak mencukupi untuk perbandingan." Intervensi reads all interventions of the school; a `student_id` of another school answers 404 (ERR-ACC-02).

**Requirements added by this spec**
- **FR-GUR-11-11** The intervention form validates the four fields of the table and stores the Jenis mapping; "Catatan amaran" may be empty.
- **FR-GUR-11-12** "Semak keputusan" is available 7 days after the record and compares the 14 days before with the 14 days after.
- **FR-GUR-11-13** Learning Gain, Korelasi and the correlation bands use the formulas and minimums of this subsection.
- **AC-GUR-11-8** Given an empty "Tindakan diambil", when "✓ Rekod Intervensi" is pressed, then "Sila isi tindakan diambil." shows and nothing is saved; with all fields valid, "Intervensi direkodkan." shows and the row reads "Menunggu Semakan".
- **AC-GUR-11-9** Given an intervention recorded 6 days ago, when the row shows, then "Semak keputusan" is disabled; at 7 days it is enabled and the result reads "Ketepatan Sebelum {a}% → Selepas {b}%".
- **AC-GUR-11-10** Given 4 pupils with answers, when Korelasi is shown, then it reads "Tiada data"; with 5 pupils it shows r to 2 decimals and the Kekuatan word.

- **Current gap (change the existing code only):** `m12-kirkpatrick/routes/mount.ts:25-30` mounts the Guru twin in the admin chrome (`layout: 'admin'`): use the teacher shell; give the Guru overview the V2 sections above (props on `KirkpatrickOverviewPage.vue`) and hide the V1-only panels for the Guru; use "Mengikut Kelas" tables for the Guru; the comparison-panel false decline disappears with its removal from the Guru overview (it stays on the AS overview with the DV-GUR-11-2 rule).
- **Route** `/guru/kirkpatrick` (Ringkasan), `/reaction`, `/learning`, `/behavior`, `/results`, `/chain`, `/interventions`, `/pelajar/:id`, `/export-pdf`. **Matrix** 11. **Priority** P1. **Delivery** A. **Status** all 7 screens exist, rendered in the admin chrome; the comparison panel shows "Penurunan 73.3%" because the current month has no data.
- **Scope** SC-G: pupils of "kelas anda" (V2 `KirkpatrickController`); the filters "Sekolah" and "Negeri" are hidden for the Guru.
- **One label and scope definition (shared with AS-11, D101 T1-T5):** "Pelajar Berdaftar" = XS-1 of the scope (Tingkatan 1-5; V1's "(T4/T5)" is dropped, DV-GUR-11-1); "Pelajar aktif" / "Pernah Aktif" (Tahap 3, KPI "Guru Aktif" aside) = XS-2 all time; "Aktif 30h" (Command Center panel) = XS-2 with a 30-day window and carries its window label; Tahap 2 "Soalan Dijawab" = XS-4 all time; "Ketepatan" = XS-5. The Guru and the Admin Sekolah use the same definitions and differ only in scope (class versus school).
- **V1 reference (kept for the school-admin overview R1-AS-11 and for what V2 lacks; for the Guru the V2 facts above win)** [V1] M12 S1-S8 (labels "Tahap n" since the 2026-10-31 rename):
  - Ringkasan: level cards in the order Tahap 4, 3, 2, 1 ("Tahap 4: Hasil" "GPS Sekolah · {n} rekod headcount"; "Tahap 3: Tingkah Laku" "{n}/{total}" "Pelajar aktif · {n} sesi · {x}% ketepatan"; "Tahap 2: Pembelajaran" "{x}%" "Ketepatan · {n} soalan dijawab"; "Tahap 1: Reaksi" "{x}/5" "Kepuasan purata · {n} respon") each with "Lihat detail →"; "Kirkpatrick Evaluation Flow" ("Klik mana-mana tahap untuk lihat detail"); "Perbandingan Sebelum & Selepas" ("{bulan} vs {bulan}", panels "SEBELUM"/"SELEPAS", four delta tiles, "Ringkasan:"; no data "Data tidak mencukupi untuk perbandingan."); KPI row ("Pelajar Berdaftar", "Soalan Dijawab", "Guru Aktif", "Ketepatan Keseluruhan"); "Taburan Engagement Pelajar" (Champion, Konsisten, Berkembang, Minimum, Tidak Terlibat); info card "Model Kirkpatrick — 4 Tahap Penilaian Keberkesanan".
  - Tahap 1: "NPS Pelajar", "NPS Guru", "NPS Admin", "Kepuasan Purata". Tahap 2: "Soalan Dijawab", "Ketepatan", "Skor Purata", "Sesi Selesai", "Kadar Penyelesaian", "Learning Gain" ("Perlu pre/post test"), "Prestasi Mengikut Subjek" (Mastered, Developing, Beginning), "Pembelajaran Mengikut Sekolah". Tahap 3: six KPIs, "Taburan Tahap Engagement", "Engagement Mengikut Sekolah", "Corak Masa Aktiviti" (24-hour by 7-day heat table), "Amaran & Pemerhatian", mood empty "Data Mood Belum Mencukupi". Tahap 4: "GPS Headcount", "Kadar Lulus", "Pelajar Gred A", "Ketepatan Platform", "Pelajar Aktif", "Rekod Headcount", "Taburan Gred", "GPS Mengikut Subjek", "Trend GPS (2022–2026)", "Prestasi Mengikut Sekolah", "Ramalan Prestasi Pelajar Aktif", "ROI Platform (Anggaran)", "Pemerhatian & Insight", disclaimer "Disclaimer: Data GPS Anggaran berdasarkan markah OTR headcount, bukan keputusan SPM sebenar."; ALESA table and "Kesimpulan ALESA" hidden (D73). "Rantaian Impak": cards T1-T4, "Analisis Korelasi: Penggunaan → Pencapaian" (bands 1-20, 21-50, 51-100, 100+ soalan, each once: V1 duplicated the first and lost 21-50, D-M12-2), "Kesimpulan Model Kirkpatrick", button "Muat Turun Laporan" (PDF).
  - **Intervensi [V2] `guru/intervensi.blade.php`** (V1's form was unreachable, D-M12-1): info bar "🧭 Pantau amaran kesejahteraan, kenal pasti pelajar berisiko, dan rekod tindakan intervensi anda. Data ini menggerakkan Kirkpatrick — Intervensi."; cards "Amaran Belum Selesai", "Pelajar Berisiko (<55%)", "Intervensi Hari Ini"; form "Rekod Intervensi Baru": "Pelajar" ("— Pilih pelajar —"), "Jenis" ("Akademik (prestasi rendah)", "Kesejahteraan / mood", "Kehadiran", "Lain-lain"), "Catatan amaran (pilihan)" (placeholder "cth: ketepatan menurun 3 minggu"), "Tindakan diambil" (required, 500, placeholder "cth: sesi bimbingan 1-1, hubungi penjaga"), button "✓ Rekod Intervensi"; lists "🚨 Amaran Kesejahteraan Belum Selesai" (empty "✅ Tiada amaran belum selesai."), "⚠️ Pelajar Berisiko" ("{x}% ketepatan"; empty "✅ Tiada pelajar di bawah 55%."), KPIs "Jumlah Intervensi", "Menunggu Semakan", "Meningkat", "🗂️ Senarai Intervensi" (pupil, dd/mm/yyyy, type, action, "· asas {x}%"; "Semak keputusan" then "Ketepatan Sebelum {a}% → Selepas {b}%"; "Menunggu Semakan"; empty "Tiada intervensi direkod lagi."). The "after" values are read from real data at review time, never typed.
- **Functional requirements**
  - **FR-GUR-11-1** Sidebar "Kirkpatrick" is one row with seven in-page tabs in the order and labels of 2.1; the page renders in the teacher shell.
  - **FR-GUR-11-2** Scope and labels exactly as the "one label and scope definition" above (shared with R1-AS-11: same definitions, class scope here, school scope there); the filters "Sekolah"/"Negeri" are not shown; the banner reads "Data ditapis untuk kelas anda sahaja.".
  - **FR-GUR-11-3** Tahap 1 uses the monthly feedback data; empty shows "—".
  - **FR-GUR-11-4** The Guru overview has no before/after panel; wherever a before/after comparison is shown (school-admin overview, R1-AS-11) it compares the first month with data to the latest month with data, and if the latest month has no data it shows "Data tidak mencukupi untuk perbandingan." and never a decline computed against zero (DV-GUR-11-2).
  - **FR-GUR-11-5** Engagement bands (OPT-ENGAGEMENT, §A1; the V2 ranges overlap at 5, 20 and 50, so V3 uses non-overlapping bands, R1 decision D113): Champion 51 or more answers (label ">50 soalan"), Konsisten 20 to 50 ("20-50 soalan"), Berkembang 5 to 19 ("5-19 soalan"), Minimum 1 to 4 ("1-4 soalan"), Tidak Terlibat 0 ("0 soalan"). The same bands and labels apply to the Command Center panel "Engagement Pelajar" (R1-GUR-1) and every Kirkpatrick engagement tile.
  - **FR-GUR-11-6** Intervensi works as V2 and writes through M12; "Semak keputusan" fills "Selepas" from M05 and the mood fields from M17 check-ins.
  - **FR-GUR-11-7** The Rantaian Impak correlation table shows the four bands once each (1-20, 21-50, 51-100, 100+ soalan); the "← Kembali" link returns to Ringkasan; the PDF button exists only on the school-admin Rantaian Impak (V2 has none for the Guru).
  - **FR-GUR-11-8** Tahap 4 "Ramalan Prestasi Pelajar Aktif" is paginated 25 per page.
  - **FR-GUR-11-9** No ALESA surface (D73).
  - **FR-GUR-11-10** Responsive: the tab strip scrolls inside its own row (7 tabs); flow cards 1 column at 375, 2 at 768, 4 at 1280 (a vertical list below 640 px); KPI rows 2 columns; all tables RP-TABLE-WIDE (the Guru has no 24 x 7 heat table; the school-admin Tahap 3 keeps it); charts RP-CHART; Intervensi form single column; select controls >= 44 px (V1 filter selects were 18 px tall, D-M12-7).
- **Data** Owner M12 `/api/kirkpatrick/*`; M05, M08 headcount, M02.
- **Acceptance criteria**
  - **AC-GUR-11-1** Given a Guru, when each of the seven tabs is used, then every page opens (no 403/404) with its own title and none shows a "Sekolah" or "Negeri" filter.
  - **AC-GUR-11-2** Given a teacher whose pupils answered only in an earlier month, when the Guru Ringkasan opens, then it shows the flow cards, the engagement distribution and the "📌 Kesimpulan" card, and neither a before/after panel nor any "Penurunan" figure.
  - **AC-GUR-11-3** Given Intervensi with pupil P, jenis "Akademik (prestasi rendah)" and a tindakan, when "✓ Rekod Intervensi" is pressed, then the list shows it with today's date and "Menunggu Semakan"; after P answers more questions and "Semak keputusan" is pressed, then "Ketepatan Sebelum {a}% → Selepas {b}%" shows values read from the data.
  - **AC-GUR-11-4** Given 7 pupils in the teacher's classes of whom 5 have answers, then Ringkasan "Pelajar Berdaftar" = 7, Tahap 3 "Pelajar aktif" = 5, and 5 equals the Command Center "aktif menjawab".
  - **AC-GUR-11-5** Given the correlation table, then the bands "1-20", "21-50", "51-100" and "100+" each appear exactly once.
  - **AC-GUR-11-6 (R)** Given a teacher with 40 pupils, when each tab opens at 375, 768 and 1280 px, then scrollWidth <= innerWidth, the seven tabs are reachable by scrolling inside the tab row and are >= 44 px, level cards are 1 column at 375, and the heat table scrolls inside its card.
  - **AC-GUR-11-7 (U)** Given "Guru UAT" with migrated headcount for class "5 UAT", when Tahap 4 opens, then "Rekod Headcount" equals the number of pupil rows in the teacher's headcount configs shown on Headcount, and a teacher with no headcount configs sees "Belum Ada Data".
- **Deviations** DV-GUR-11-1 labels without "T4/T5"; DV-GUR-11-2 comparison rule; DV-GUR-11-3 Intervensi works; DV-GUR-11-4 duplicate correlation row; DV-GUR-11-5 banner "kelas anda"; DV-GUR-11-6 V1-only panels not shown to the Guru. **Open** none (OQ-G-9 closed).

### R1-GUR-41 Pelajar Saya
- **Action: Fix**
- **Screen specification (from V2)**
  - **Route / title:** `/guru/pelajar`; browser title "Pelajar Saya — PRESTASIPLUS".
  - **Regions in order:** (1) card "Cipta Pelajar"; (2) counter bar with button; (3) table.
  - **Card "Cipta Pelajar":** "Tambah pelajar baharu terus ke dalam salah satu kelas anda."; the create form (fields and messages: Not observed in V2 — follow FR-GUR-41-3). Without a class the card shows "Anda belum ada kelas aktif. Cipta kelas dahulu."
  - **Counter bar:** "{n}" "Pelajar dalam kelas saya"; button "+ Pelajar" (opens the "Cipta Pelajar" form).
  - **Table (single list):** columns "Pelajar", "Kelas", "Tahap", "Tugasan", "Skor Purata", "Terakhir Aktif". Row content and the empty-row copy: Not observed in V2 — follow FR-GUR-41-*.
  - **States:** the teacher with no class observed; populated, loading, error: Not observed in V2 — follow FR-GUR-41-*.
  - **Corrections noted:** V2 has one list (no "Pelajar Sekolah" / "Pelajar Saya" tabs): V3 keeps the V1 tab "Pelajar Sekolah" as already built (how an existing school pupil is added) and shows the V2 table columns on "Pelajar Saya"; the V2 button is "+ Pelajar" opening the "Cipta Pelajar" form.
#### Field & behaviour spec — R1-GUR-41 Pelajar Saya

Route `/guru/pelajar`, `/guru/pelajar/:id`. API: API-GUR-05 (`GET /api/guru/students?tab=mine|school&search&page`, add, remove), API-GUR-06 (create pupil). Additions: ADD-02 (DM-74).

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Tab "Pelajar Saya" / "Pelajar Sekolah" | tabs | No | "Pelajar Saya" | a count badge on each tab | none | none | query string `tab` | API-GUR-05 |
| Cipta Pelajar: Nama | text | Yes | empty | max 255 | "Sila isi nama."; over 255: "Nama tidak boleh melebihi 255 aksara." | none | `users.name` | API-GUR-06 |
| Cipta Pelajar: Kelas | select | Yes | "-- Pilih kelas --" (preselected when the teacher has exactly one class) | OPT-KELAS-OWN | "Sila pilih kelas." | none | `enrolments.classroom_id` | API-GUR-06 |
| Cipta Pelajar: No. IC | text | No | empty | exactly 12 digits, no hyphen | "No. IC mesti 12 digit tanpa sempang."; duplicate "No. IC sudah didaftarkan." | none | `users.ic_hash`, `users.ic_masked` | API-GUR-06 |
| Tambah pelajar ke: | select | Yes before an add | "-- Pilih kelas --" | OPT-KELAS-OWN | "Sila pilih kelas dahulu." | Pelajar Sekolah tab | `enrolments` (source `teacher`) | API-GUR-05 |
| Cari (Pelajar Sekolah) | text | No | empty | placeholder "Cari nama pelajar..."; name or username substring (GLB-4) | "Taip sekurang-kurangnya 2 aksara." | none | query string | API-GUR-05 |

- **Pelajar Saya columns.** Pelajar (name, username beneath), Kelas, Tahap ("Tingkatan n"), Tugasan (number of Set Soalan sets and Misi assigned to the pupil's class that the pupil completed, integer), Skor Purata (mean of per-session accuracies, whole number with "%", "—" without sessions), Terakhir Aktif (`dd/mm/yyyy` of the latest answer, "—" none). Default sort name ascending; 25 per page.
- **Empty.** "Belum ada pelajar dalam kelas anda" / "Buat kelas dan tambah pelajar dari senarai sekolah." with the button "Cipta Kelas". Pelajar Sekolah without a school: "Sekolah belum ditetapkan" / "Sila tetapkan sekolah anda di Profil atau semasa cipta kelas untuk melihat senarai pelajar sekolah." with the button "Tetapan Profil".
- **Row actions.** "Tambah" or "Keluarkan" (CF-08) on a Pelajar Sekolah row; toasts "Pelajar ditambah." / "Pelajar dikeluarkan."; creating a pupil shows "Pelajar dicipta. Login: {username} / {kata laluan lalai}" (username rule of R1-GUR-8).

**Requirements added by this spec**
- **FR-GUR-41-6** The columns, default sort, page size and empty copy of this subsection apply; "Tugasan" and "Skor Purata" follow the definitions given.
- **AC-GUR-41-6** Given a pupil with sessions of 60% and 80% accuracy, when Pelajar Saya opens, then Skor Purata reads "70%"; a pupil without sessions reads "—".
- **AC-GUR-41-7** Given the Pelajar Sekolah tab and no class chosen, when "Tambah" is pressed, then "Sila pilih kelas dahulu." shows and nobody is added.

- **Current gap (change the existing code only):** `m10-teacher-class/routes/pelajar.ts:25`: "Cipta Pelajar" redirects back silently (V1 defect): open the form and show the result message; add the V2 columns "Tahap", "Tugasan", "Skor Purata", "Terakhir Aktif" to the list.
- **Route** `/guru/pelajar`, `/guru/pelajar/:id`. **Matrix** 41. **Priority** P2. **Delivery** A. **Status** built: 7 pupils, tabs, "Cipta Pelajar".
- **Reference [V1] M10 S6 / [V2] `guru/pelajar`, `pelajar-detail`**: counter "{n}" "Pelajar dalam kelas saya"; "Cipta Pelajar" (V1 redirected silently, D-07; V2 creates the pupil inside a class); tabs "Pelajar Sekolah" and "Pelajar Saya" (count badge); "Pelajar Saya" empty "Belum ada pelajar dalam kelas anda" / "Buat kelas dan tambah pelajar dari senarai sekolah." / "Cipta Kelas"; "Pelajar Sekolah": bar "Tambah pelajar ke:" with a class select ("-- Pilih kelas --"), search, per-row add/remove; without a school: "Sekolah belum ditetapkan" / "Sila tetapkan sekolah anda di Profil atau semasa cipta kelas untuk melihat senarai pelajar sekolah." / "Tetapan Profil".
- **Functional requirements**
  - **FR-GUR-41-1** "Pelajar Saya" lists the distinct pupils of the teacher's classes (XS-1).
  - **FR-GUR-41-2** "Pelajar Sekolah" lists active pupils of the teacher's school (Tingkatan 1-5); add to a chosen own class, remove from it.
  - **FR-GUR-41-3** "Cipta Pelajar" opens a form (Nama, Kelas select of own classes, No. IC optional) that creates the pupil in that class with the V2 result message "Pelajar dicipta. Login: {username} / {kata laluan lalai}" (DV-GUR-41-1: V1 redirected silently). The default password is a configuration value (environment/settings), never hard-coded and never written in docs, seeds or tests.
  - **FR-GUR-41-4** Pupil detail shows the Prestasi 360 summary with a link.
  - **FR-GUR-41-5** Responsive: RP-TABLE-LIST cards (name, kelas, Ketepatan, status); tabs full width; class select full width; buttons >= 44 px.
- **Data** M10 enrolment, M02 users.
- **Acceptance criteria**
  - **AC-GUR-41-1** Given a school pupil not in any class of the teacher, when added to "5 Bestari", then "Pelajar Saya" count +1 and the class count +1.
  - **AC-GUR-41-2** Given "Cipta Pelajar" with Nama "Murid Contoh", Kelas "5 Bestari", when submitted, then the message "Pelajar dicipta. Login: {username} / {kata laluan lalai}" shows (the placeholder is replaced by the configured default password) and the pupil appears in "Pelajar Saya".
  - **AC-GUR-41-3** Given a teacher with no school, when "Pelajar Sekolah" opens, then "Sekolah belum ditetapkan" shows with "Tetapan Profil" opening `/guru/profil/edit`.
  - **AC-GUR-41-4 (R)** Given 7 pupils, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth, pupils are cards at 375 and 768, and the two tabs, the class select and "Cipta Pelajar" are visible and >= 44 px.
  - **AC-GUR-41-5 (U)** Given "Guru UAT" with class "5 UAT", when "Pelajar Saya" opens, then the count equals the class member count on Kelas Saya and "Pelajar Sekolah" lists active pupils of the same school.
- **Gap** none. **Deviation** DV-GUR-41-1. **Open** none.

### R1-GUR-42 Laporan
- **Action: Fix**
- **Screen specification (from V2)**
  - **Route / title:** `/guru/laporan`; browser title "Laporan Statistik — PRESTASIPLUS" (V3 title: "Laporan", the matrix label wins).
  - **Regions in order:** (1) filter bar "Tapis:"; (2) four KPI cards; (3) "Trend Aktiviti"; (4) "Paling Aktif"; (5) "Pelajar Belum Pernah Login ({n})"; (6) "Pelajar Belum Pernah Buat Latihan ({n})".
  - **Filter bar:** class select (default "Semua Kelas", then the teacher's classes); period pills "7 Hari", "30 Hari", "3 Bulan" (the active pill is highlighted; default 30 Hari).
  - **KPI cards:** "Pernah Login" ("{p}%", "{n} / {n} pelajar", note "Direkodkan sejak penjejakan log masuk dimulakan"); "Pernah Buat Latihan" ("{p}%", "{n} / {n} pelajar"); "Jumlah Aktiviti" ("{n}", period caption "30 hari lepas"); "Pecahan Skor Purata" ("—" or the average, caption "30 hari lepas").
  - **"Trend Aktiviti":** caption "30 hari lepas"; chart over the period; empty "Tiada aktiviti direkodkan dalam tempoh ini."
  - **"Paling Aktif":** ranked list; empty "Tiada aktiviti dalam tempoh ini."
  - **"Pelajar Belum Pernah Login ({n})":** list; empty "Belum ada pelajar dalam kelas anda." plus the note "Tiada rekod login sejak penjejakan dimulakan." when no login has been recorded.
  - **"Pelajar Belum Pernah Buat Latihan ({n})":** list; empty "Belum ada pelajar dalam kelas anda."
  - **States:** empty observed; populated rows and charts, loading, error: Not observed in V2 — follow FR-GUR-42-*.
  - **Corrections noted:** V2's fourth card is "Pecahan Skor Purata" (one card with the average score) where V1 had "Skor Purata" with per-type bars: V3 follows V2's label; the V2 sub-line "Direkodkan sejak penjejakan log masuk dimulakan" is kept only if logins are tracked from a start date (otherwise omitted).
#### Field & behaviour spec — R1-GUR-42 Laporan

Route `/guru/laporan`. API: API-RPT-07 (`GET /api/teacher/report`). Errors: ERR-SYS-01b per panel.

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Kelas | select | No | "Semua Kelas" | OPT-KELAS-OWN | none | none | query string `classroomId` | API-RPT-07 |
| Range | pills | No | "30 Hari" | OPT-JULAT ("7 Hari", "30 Hari", "3 Bulan"); any other value is treated as 30 | none | none | query string `range` | API-RPT-07 |

- Changing either control keeps the other. "Paling Aktif": the top 10 pupils by sessions (ties by name). Trend: one bar per day, label `dd/mm`. The lists "Pelajar Belum Pernah Login ({n})" and "Pelajar Belum Pernah Buat Latihan ({n})" are sorted by name ascending and show the first 10, with a link "+ {n} lagi" that expands to all. Formulas follow the Screen specification and XS-1..XS-5.

**Requirements added by this spec**
- **FR-GUR-42-7** Class and range both persist in the query string and filter every card, list and the trend.
- **AC-GUR-42-7** Given 15 pupils who never logged in, when Laporan opens, then the list shows 10 names and "+ 5 lagi"; pressing it shows all 15.

- **Current gap (change the existing code only):** `m11-teacher-analytics/routes/laporan.ts` page: keep the class filter when a range pill is chosen (V1 dropped it); make the card counts equal the panel counts; use the V2 card label "Pecahan Skor Purata".
- **Route** `/guru/laporan` (V2 sidebar "Laporan Statistik"). **Matrix** 42. **Priority** P2. **Delivery** A. **Status** built with all sections.
- **Reference [V1] M11 S1 / [V2] `TeacherAnalyticsController::laporan`**: "Tapis:" class select ("Semua Kelas") and range pills "7 Hari", "30 Hari" (default), "3 Bulan" (`range`=7/30/90; unknown = 30; V1 pills dropped the class filter, DV-GUR-42-1: kept). Cards "Pernah Login" ("{n} / {total} pelajar", "{n} belum pernah login", "Klik untuk lihat senarai"), "Pernah Buat Latihan", "Jumlah Aktiviti" ("{n} hari lepas"), "Skor Purata" ("Klik untuk lihat pecahan"); panels "Pelajar Belum Pernah Login ({n})" ("Semua pelajar sudah pernah login!"), "Pelajar Belum Pernah Buat Latihan ({n})" ("Semua pelajar sudah aktif buat latihan!"), "Pecahan Aktiviti ({range} Lepas)" (Kuiz, Struktur, Latih Tubi, Tracking A, Battle, Permainan, Jumlah), "Pecahan Skor Purata" (5 bars), "Trend Aktiviti", "Paling Aktif" ("Belum ada aktiviti"), "Belum Pernah Buat Latihan" (first 10 with e-mail and "Belum pernah login").
- Formulas (activity counts sessions and answers of all modes from the single answer store, XS-8): Pernah Login % = pupils with a recorded login ÷ XS-1 of the scope × 100 (integer); Pernah Buat Latihan % = pupils with >= 1 practice session ÷ the same XS-1 (V1 used different denominators, D-M11-1); Jumlah Aktiviti = sessions in range; Skor Purata = the mean of per-session accuracies in range, a separately named measure that is never labelled Ketepatan (XS-5 note; "-%" when none); card and panel counts of the same metric are equal (DV-GUR-42-2).
- **Functional requirements**
  - **FR-GUR-42-1** Scope: the chosen class or all "kelas anda".
  - **FR-GUR-42-2** Formulas above with one denominator.
  - **FR-GUR-42-3** Card counts equal panel counts.
  - **FR-GUR-42-4** Trend labels "dd/mm", one point per day of the range.
  - **FR-GUR-42-6** "Pernah Buat Latihan", "Jumlah Aktiviti", "Pecahan Aktiviti" and "Paling Aktif" include every mode of `practice_answers` / practice sessions (XS-8), including Bijak sittings and Set Soalan Guru.
  - **FR-GUR-42-5** Responsive: RP-FILTER; cards 2 columns at 375; expanded panels full width; activity tiles 2 per row; trend chart RP-CHART with thinned labels; lists RP-TABLE-LIST rows with wrapped names/e-mails; range pills >= 44 px.
- **Data** M11 `GET /api/guru/laporan?range&classroomId`; M05, M01 last login.
- **Acceptance criteria**
  - **AC-GUR-42-1** Given 7 pupils of whom 3 never logged in, when Laporan opens, then the card says "3 belum pernah login" and the panel title is "(3)".
  - **AC-GUR-42-2** Given class "5 Bestari" and "7 Hari" chosen, when the range pill is changed to "30 Hari", then the class stays selected (and vice versa).
  - **AC-GUR-42-3** Given 2 of 7 pupils with a practice session, then "Pernah Buat Latihan" = round(2 ÷ 7 × 100) = 29% with "2 / 7 pelajar".
  - **AC-GUR-42-4 (R)** Given a range of 90 days, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth, cards are 2 columns at 375, the trend chart fits its card with thinned labels, and the class select and the three range pills are visible and >= 44 px.
  - **AC-GUR-42-6** Given 7 pupils of whom 1 has only a Bijak sitting and 1 has only a Set Soalan attempt, then both count in "Pernah Buat Latihan" (2 / 7 = 29%) and in "Jumlah Aktiviti".
  - **AC-GUR-42-5 (U)** Given "Guru UAT" with migrated `last_login`, when Laporan opens, then "Pernah Login" = (pupils with a login) ÷ (class pupils) and the unlogged pupils listed equal the "belum pernah login" count.
- **Gap** none. **Deviations** DV-GUR-42-1/2. **Open** none.

### R1-GUR-43 Laporan Mingguan
- **Action: Build**
- **Screen specification (from V2)** (matches the text below exactly)
  - **Route / title:** `/guru/laporan-mingguan-kelas`; browser title "Laporan Mingguan — PRESTASIPLUS".
  - **Regions in order:** (1) toolbar; (2) print title; (3) card "Ringkasan Minggu Ini"; (4) card "Top Performers"; (5) card "Paling Meningkat"; (6) card "Subjek Perlu Perhatian".
  - **Toolbar:** select "Pilih Kelas" (empty list: "Tiada kelas lagi"); button "Cetak" (prints the page).
  - **Print title:** "Laporan Mingguan — {kelas} | {dd Mon} – {dd Mon yyyy}" (without a class it prints "Laporan Mingguan — — | 02 Nov – 08 Nov 2026", the week of the current date).
  - **Card "Ringkasan Minggu Ini":** the week range "02 Nov 2026 — 08 Nov 2026" and four tiles: "Soalan Dijawab", "Pelajar Aktif", "Pelajar Meningkat", "Subjek Perlu Perhatian".
  - **Card "Top Performers":** ranked pupils; empty "Tiada pelajar dengan sekurang-kurangnya 5 soalan minggu ini."
  - **Card "Paling Meningkat":** caption "(berbanding minggu lepas)"; empty "Tiada perbandingan minggu-ke-minggu yang mencukupi."
  - **Card "Subjek Perlu Perhatian":** caption "(ketepatan < 50%)"; empty "Tiada latihan direkodkan minggu ini."
  - **States:** empty observed; populated rows, loading, error: Not observed in V2 — follow FR-GUR-43-*.
  - **Correction noted:** with no class V2 prints "— —" in the print title: V3 prints "Laporan Mingguan — Semua Kelas | …" in that case ([PRINCIPLE]).
#### Field & behaviour spec — R1-GUR-43 Laporan Mingguan

Route `/guru/laporan-mingguan-kelas`. API: API-GUR-21 (`GET /api/guru/weekly-report?classroomId=&week=YYYY-MM-DD`; `week` is for tests only, no UI). Errors: ERR-ACC-01 for another teacher's class (AC-GUR-43-6), ERR-SYS-01b.

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Pilih Kelas | select | Yes | the first class | OPT-KELAS-OWN with no "all" option; with no class: "Tiada kelas lagi" | none | none | query string `classroomId` | API-GUR-21 |
| Cetak | button | n/a | n/a | prints per GLB-6; title "Laporan Mingguan — {kelas} \| {dd Mon} – {dd Mon yyyy}", and with no class "Laporan Mingguan — Semua Kelas \| {dd Mon} – {dd Mon yyyy}" | none | none | not stored | none |

- The week is the current Monday to Sunday (MYT). Accuracy is stored and returned by API-GUR-21 with 1 decimal (for example 66.7) and displayed as a whole-number percent (XS-5, half away from zero); every threshold, delta and sort key below uses the whole number. Accuracy of a subject or of the class is pooled (correct answers ÷ answered answers), never a mean of pupil percentages. Top Performers: at least 5 answers, accuracy descending, ties by answers descending then name, 5 rows. Paling Meningkat: delta above 0, delta descending, ties by name, 5 rows, shows "{from}% → {to}%" and "+{delta}%". Subjek Perlu Perhatian: weekly subject accuracy below 50, ascending; when none: "Syabas! Semua subjek melebihi 50% ketepatan." Other empty copies exactly as the Screen specification.

**Requirements added by this spec**
- **FR-GUR-43-9** Top Performers, Paling Meningkat and Subjek Perlu Perhatian use the thresholds, sort, row counts and empty copy of this subsection.
- **AC-GUR-43-11** Given a class where every subject has weekly accuracy of 50% or more, when the report opens, then "Syabas! Semua subjek melebihi 50% ketepatan." shows; a subject at 49.4% (shown "49%") lists instead, and a subject at 49.6% (shown "50%") does not list.

- **Current gap:** see the Status line (menu target `src/shells/nav/user-nav.ts:287`, `m08-student-performance/routes/prestasi.ts:95-106`, `m11-teacher-analytics/routes/laporan-mingguan.ts:12-27`, `apps/api/.../weekly-report.service.ts:5-11`): build the page and the teacher API.
- **Route** `/guru/laporan-mingguan-kelas` (alias `/guru/laporan-mingguan`). **Matrix** 43. **Priority** **P0**. **Delivery** A. **Status** GH/UAT: the sidebar item opens `/laporan-mingguan` = "403 Akses Ditolak" (`src/shells/nav/user-nav.ts:287`; the route has `roles: []`, `m08/routes/prestasi.ts:95-106`); the real route `/guru/laporan-mingguan-kelas` renders "Belum tersedia dalam prototaip" (`m11-teacher-analytics/routes/laporan-mingguan.ts:12-27`); the API `WeeklyReportService.report()` throws FORBIDDEN for every role (`apps/api/src/modules/reports/performance/services/weekly-report.service.ts:5-11`). The module does not exist: it is specified as a full working module.
- **Reference [V2] `guru/laporan-mingguan.blade.php`, `TeacherAnalyticsController::laporanMingguan` (V2 screenshot confirms)**: heading "Laporan Mingguan". Card (not printed): "Pilih Kelas" select (first class default; empty "Tiada kelas lagi") and button "Cetak". Print-only title "Laporan Mingguan — {kelas} | {dd Mon} – {dd Mon yyyy}". Card "Ringkasan Minggu Ini" with the week range ("02 Nov 2026 — 08 Nov 2026", Monday to Sunday) and four tiles "Soalan Dijawab", "Pelajar Aktif", "Pelajar Meningkat", "Subjek Perlu Perhatian". Card "Top Performers": up to 5 rows (rank, name, "{n} soalan minggu ini", "{x}% ketepatan"); empty "Tiada pelajar dengan sekurang-kurangnya 5 soalan minggu ini." Card "Paling Meningkat" ("(berbanding minggu lepas)"): rows "{from}% → {to}%" and "+{delta}%", up to 5; empty "Tiada perbandingan minggu-ke-minggu yang mencukupi." Card "Subjek Perlu Perhatian" ("(ketepatan < 50%)"): rows with subject, "{x}% ({n} soalan)" and a bar; empty with data "Syabas! Semua subjek melebihi 50% ketepatan."; empty without data "Tiada latihan direkodkan minggu ini."
- **Computation [V2 code]** week = Monday 00:00 to Sunday 23:59 of the current week; previous week = the 7 days before; pupils = the selected class; per pupil answered and correct in the week; accuracy = correct ÷ answered × 100, stored and returned with 1 decimal and displayed as a whole number (R1 decision D113, XS-5). "Soalan Dijawab" = sum of answered; "Pelajar Aktif" = pupils with >= 1 answer (XS-2, weekly window); Top Performers = pupils with >= 5 answers ranked by accuracy descending, top 5; "Paling Meningkat" = pupils active in both weeks with accuracy delta > 0 sorted by delta descending (tile counts all, list shows 5); "Subjek Perlu Perhatian" = subjects (by question subject) with weekly accuracy < 50%, ascending (tile counts them). V1 never showed the page (403): V2 is the only reference.
- **Functional requirements**
  - **FR-GUR-43-1** The sidebar and "Lagi" item "Laporan Mingguan" open `/guru/laporan-mingguan-kelas`.
  - **FR-GUR-43-2** The screen is built exactly as V2 above (copy, cards, empty states).
  - **FR-GUR-43-3** New API `GET /api/guru/weekly-report?classroomId=&week=YYYY-MM-DD` (teacher, own classes; another teacher's class = 403, a documented exception to the 404 default of 60 section 1.7 because the resource is a report on a known class, AC-GUR-43-6); the old student/parent `/laporan-mingguan` behaviour is unchanged and is not linked from the teacher menu.
  - **FR-GUR-43-4** Figures follow XS rules with the window "minggu ini".
  - **FR-GUR-43-5** No week navigation is added (V2 has none).
  - **FR-GUR-43-6** "Cetak" prints without sidebar, header and buttons, with the print-only title, A4 portrait.
  - **FR-GUR-43-8** All figures count answers of all modes from `practice_answers` (XS-8) in the Monday-Sunday week, including Bijak sittings and Set Soalan Guru.
  - **FR-GUR-43-7** Responsive: select and "Cetak" stack at 375 (select full width, "Cetak" >= 44 px with its text visible); the four tiles 2 x 2 at 375 and 4 across at 768 and 1280; list rows wrap names instead of truncating; subject bars full width.
- **Data** Owner M08/M11 reporting; M05 answers with subject; M10 classes.
- **Acceptance criteria**
  - **AC-GUR-43-1** Given a Guru, when "Laporan Mingguan" is clicked, then the page titled "Laporan Mingguan" opens with the class select and no 403.
  - **AC-GUR-43-2** Given a class where 3 pupils answered 6, 8 and 4 questions this week, then "Pelajar Aktif" = 3, "Soalan Dijawab" = 18 and Top Performers lists exactly the two pupils with >= 5 answers.
  - **AC-GUR-43-3** Given a subject at 45% this week, then it appears under "Subjek Perlu Perhatian" with "45% ({n} soalan)" and the tile counts it.
  - **AC-GUR-43-4** Given a pupil at 50% last week and 70% this week (both with answers), then "Paling Meningkat" shows "50% → 70%" and "+20%".
  - **AC-GUR-43-5** Given no activity this week, then each card shows its exact empty copy and the four tiles show 0.
  - **AC-GUR-43-6** Given `classroomId` of another teacher's class, when requested, then 403.
  - **AC-GUR-43-7** Given "Cetak", when the print preview opens, then the sidebar, header and the select are absent and the print title shows.
  - **AC-GUR-43-8 (R)** Given a class with 30 active pupils, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth, tiles are 2 x 2 at 375, and the class select and "Cetak" are visible and >= 44 px.
  - **AC-GUR-43-10** Given a pupil who answered 5 Latih Tubi and 4 Bijak-sitting questions this week, then "Soalan Dijawab" counts 9 for that pupil and the pupil is in Top Performers (>= 5 answers).
  - **AC-GUR-43-9 (U)** Given "Guru UAT" class "5 UAT" with migrated answers dated this week, when the report opens, then "Soalan Dijawab" equals the count of that class's answer rows of this Monday-Sunday week on Prestasi Kelas.
- **Deviations** none (replicates V2). **Open** none.

### R1-GUR-44 Sumbang Soalan
- **Action: Fix**
- **Screen specification (from V2)**
  - **Route / title:** `/guru/soalan`; browser title "Sumbang Soalan — PRESTASIPLUS".
  - **Regions in order:** (1) four stat cards; (2) info paragraph; (3) block "Alat Soalan"; (4) block "Pencapaian Badge Penyumbang"; (5) block "Import Soalan (CSV/Excel)"; (6) block "Soalan Saya"; (7) block "Hantar Kertas Soalan kepada Admin".
  - **Stat cards (value / label):** "📝 Jumlah"; "✅ Diluluskan"; "⏳ Menunggu"; "📊 Digunakan".
  - **Info paragraph:** "Sumbang Soalan adalah platform perkongsian soalan untuk manfaat semua pelajar di seluruh Malaysia. Setiap soalan yang anda sumbangkan akan melalui proses semakan dan seterusnya tersedia dalam bank soalan kebangsaan PrestasiPlus. Sumbangan anda amat dihargai dalam membina masa depan pendidikan negara."
  - **Block "Alat Soalan" (six tool tiles, each a link; title / caption):** "Soalan & Rujukan" / "Soalan peribadi + rujukan"; "Soalan Berstruktur" / "Soalan subjektif & esei"; "Soalan Gambar Rajah" / "Soalan perlu gambar rajah"; "Databank Soalan" / "Layari bank soalan SPM"; "Set Soalan" / "Cipta set soalan kustom"; "Kertas Peperiksaan" / "Muat naik & kongsi kertas". All six tools are in R1 scope (OQ-G-15 decided 2026-11-04): "Soalan & Rujukan" = R1-GUR-44a, "Soalan Berstruktur" = R1-GUR-44b, "Soalan Gambar Rajah" = R1-GUR-44c, "Databank Soalan" = R1-GUR-44d, "Set Soalan" = R1-GUR-8b, "Kertas Peperiksaan" = R1-GUR-44e.
  - **Block "Pencapaian Badge Penyumbang":** eight tiers in order "Penyumbang Baru (10)", "Penyumbang Aktif (100)", "Penyumbang Dedikasi (500)", "Penyumbang Cemerlang (1,000)", "Penyumbang Terbilang (2,500)", "Legenda Soalan (5,000)", "Guru Maestro (10,000)", "Legenda Terulung (50,000)"; progress line "Sasaran seterusnya: Penyumbang Baru — 10 soalan".
  - **Block "Import Soalan (CSV/Excel)":** caption "Muat naik banyak soalan sekaligus"; buttons "Template" (downloads the template) and "Import CSV" (reveals the form); form: file field "Pilih Fail CSV" and button "Import"; "Panduan:" with four bullets: "Muat turun template → isi soalan → import kembali"; "Format: subjek, tahap, soalan, 4 pilihan, jawapan (A/B/C/D), kesukaran, penerangan" (V3: the template and this bullet also list Bab, SP, TP and Aras, FR-GUR-44-9, [PRINCIPLE]); "Soalan akan dihantar sebagai "Menunggu Semakan" untuk kelulusan admin"; "Baris yang ada ralat akan dilaporkan — soalan sah tetap diimport".
  - **Block "Soalan Saya":** header with button "Tambah Soalan"; empty "Belum ada soalan dihantar" / "Klik "Tambah Soalan" untuk mula menyumbang!" with the button "Tambah Soalan Pertama". Populated rows: Not observed in V2 — follow FR-GUR-44-*.
  - **Block "Hantar Kertas Soalan kepada Admin":** caption "Admin akan proses dan upload ke databank soalan". Sub-block "Jenis Soalan Yang Diterima" (chips "Soalan Umum", "Trial Paper", "Soalan DSKP", "Buku Teks", "Buku Latihan", "Soalan Peperiksaan"). Sub-block "Syarat Fail Yang Dihantar": "Format diterima: PDF (teks), DOCX, XLSX"; "PDF scan imej TIDAK diterima — teks mesti boleh disalin"; "Skema jawapan WAJIB disertakan bersama soalan"; "Maksimum 5 fail, saiz maksimum 20MB setiap fail". Three steps: "1. Hantar" / "Upload fail anda"; "2. Proses" / "Admin extract soalan"; "3. Databank" / "Soalan tersedia". Form: "Jenis Soalan *" (select: "-- Pilih Jenis --", "Soalan Umum", "Trial Paper", "Soalan DSKP", "Buku Teks", "Buku Latihan", "Soalan Peperiksaan", "Lain-lain"); "Matapelajaran *" (text); "Tingkatan" (select: "-- Semua / Tidak Pasti --", Tingkatan 1 to 5); "Tahun"; "Disediakan Oleh"; "Catatan Tambahan"; "Fail Soalan + Skema *" (drop zone "Klik untuk pilih fail" / "PDF (teks), DOCX, XLSX — maks 5 fail, 20MB setiap fail"); submit "Hantar kepada Admin".
  - **Linked create form (tool "Soalan & Rujukan"), route `/guru/soalan-guru/cipta`, title "Cipta Soalan & Rujukan — PRESTASIPLUS"** (the tool "Soalan & Rujukan", specified in R1-GUR-44a; recorded here because V2's "Tambah Soalan" opens it, see DV-GUR-44a-1): link "Kembali ke Soalan & Rujukan"; heading "Soalan MCQ Peribadi" with text "Soalan ini hanya kelihatan kepada pelajar anda melalui Misi Harian."; "Subjek *" (select "-- Pilih subjek --" + subjects); "Tahap" (select "-- Semua tahap --", Darjah 1-6 and Tingkatan 1-5 in V2; V3 Tingkatan 1-5, D72); "Kesukaran *" (select "⭐ — Sangat mudah", "⭐⭐ — Mudah", "⭐⭐⭐ — Sederhana", "⭐⭐⭐⭐ — Sukar", "⭐⭐⭐⭐⭐ — Sangat sukar"); "Teks Soalan *"; "Pautan Rujukan (pilihan)" with help "Video YouTube, Anyflip, PDF atau apa-apa link rujukan."; "Pilihan Jawapan * (pilih jawapan betul)" with four options A, B, C, D, each a text field with a radio button, help "Butang radio menandakan jawapan yang betul."; buttons "Batal" and "Simpan Soalan".
  - **States:** empty observed; populated "Soalan Saya", validation and success/error messages, loading: Not observed in V2 — follow FR-GUR-44-*.
  - **Corrections noted:** (1) the "Alat Soalan" block is new relative to V1; all six tools are in R1 scope (decision 2026-11-04, OQ-G-15: every V2/V1 function under a module ticked for 1.0 must work in V3): "Set Soalan" is R1-GUR-8b and the other five are R1-GUR-44a to R1-GUR-44e below; the block shows six tiles and every tile resolves (FR-GUR-44-8); (2) the V2 "Import Soalan" card has no "AI Auto-Generate Soalan" card (V1 had one with no action): not built.
#### Field & behaviour spec — R1-GUR-44 Sumbang Soalan

Routes `/guru/soalan`, `/cipta`, `/:id`, `/:id/edit`. API: API-GUR-17 (paper upload), API-GUR-18 (questions), API-GUR-19 (CSV template and import), API-GUR-20 and API-DSKP-07 (DSKP lists), API-GUR-08 (chapters), API-GUR-09 (contribution counts). DM: `question_versions`, `question_version_sp_nodes`, `question_status_events`, `intake_batches`. Additions: ADD-06 to ADD-09 (DM-72; API-GUR-17 for ADD-09), ADD-12 (API-GUR-18), ADD-22 (API-GUR-19). D112 applies to the DSKP fields: Bab is required only when the chosen Subjek + Tingkatan has chapters; SP, TP and Aras are required only where DSKP nodes exist for that Subjek + Tingkatan.

**44-F1 Form "Tambah Soalan" (title "Tambah Soalan Baru"; the same form edits)**

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Tingkatan * | select | Yes | "-- Pilih tingkatan --" | OPT-TINGKATAN | "Sila pilih tingkatan." | none | question version level | API-GUR-18 |
| Subjek * | select | Yes | "-- Pilih subjek --" | OPT-SUBJEK | "Sila pilih subjek." | none | question version subject | API-GUR-18 |
| Bab * | select | Yes only if chapters exist (D112) | "-- Pilih bab --" | `GET /api/guru/chapters?subjectId&levelId` (API-GUR-08), label "{nombor}. {nama}" by number; when none: the control shows "Tiada bab untuk subjek dan tingkatan ini." and is not required | "Sila pilih bab." | Subjek + Tingkatan | chapter reference of the version (`chapterId`) | API-GUR-08, API-GUR-18 |
| SP * | select | Yes only if DSKP nodes exist (D112) | "-- Pilih SP --" | API-DSKP-07 limited to the chosen Bab, label "{kod} {nama}"; when none: not required | "Sila pilih Standard Pembelajaran (SP)." | Bab | `question_version_sp_nodes` | API-DSKP-07, API-GUR-18 |
| TP * | select | Yes only if DSKP nodes exist (D112) | "-- Pilih TP --" | OPT-TP | "Sila pilih TP."; "Tahap Penguasaan (TP) mesti antara 1 dan 6." | Subjek + Tingkatan | `question_versions.difficulty_tp` | API-GUR-18 |
| Aras Pemikiran * | select | Yes only if DSKP nodes exist (D112) | "-- Pilih aras --" | OPT-ARAS | "Sila pilih aras pemikiran." | Subjek + Tingkatan | `question_versions.cognitive_level` | API-GUR-18 |
| Kesukaran * | select | Yes | min(5, TP) once a TP is chosen and until the teacher touches it, else "-- Pilih kesukaran --" | OPT-KESUKARAN (typed, editable, separate from TP) | "Sila pilih kesukaran." | TP (default only) | `question_versions.difficulty_level` | API-GUR-18 |
| Soalan * | textarea | Yes | empty | max 2000 | "Sila isi soalan."; over 2000: "Soalan tidak boleh melebihi 2000 aksara." | none | question text | API-GUR-18 |
| Pilihan A, B, C, D * | 4 text inputs, each with a radio | Yes | empty | max 500 each | "Sila isi pilihan A." (B, C, D alike); over 500: "Pilihan A tidak boleh melebihi 500 aksara." | none | the four options | API-GUR-18 |
| Jawapan betul | radio A to D | Yes, exactly one | none preselected on create; the stored one on edit | A, B, C, D | "Sila tanda satu jawapan yang betul." | none | correct option | API-GUR-18 |
| Penerangan (Pilihan) | textarea | No | empty | max 2000 | "Penerangan tidak boleh melebihi 2000 aksara." | none | explanation | API-GUR-18 |

- Buttons "Batal", "Hantar untuk Semakan" (busy "Menyimpan..."). The V1 fields "Topik (Pilihan)" and "Jenis Soalan" are removed (the teacher form is multiple choice only: type `mcq`, exactly four options A to D and one correct answer). The other question types of OPT-JENIS-SOALAN are authored by Admin Pusat in the Studio (30); `mcq_multi` there has 2 to 8 options with 1 to (n − 1) correct, MCQ in general 2 to 8 (OPT-MCQ-PILIHAN in 40 X11), and a teacher sees such questions read-only in the Soalan by Chapter preview and Analisa Item. Success: "Soalan dihantar untuk semakan." with status `review`. Errors: ERR-REQ-01, ERR-SYS-01.
- **State machine.** `review` ("Menunggu Semakan") to `approved` ("Diluluskan") by Admin Pusat acceptance; `review` to `draft` ("Ditolak") by the admin with a reason, shown on the card as "Sebab: {reason}"; the teacher edits or deletes only `review` and `draft`; editing a `draft` and pressing "Hantar untuk Semakan" returns it to `review`; `approved` is read-only for the teacher (no Edit or Padam buttons). Delete asks CF-02.
- **Side effects.** Stat cards: "Jumlah" (all own), "Diluluskan", "Menunggu" (`review`), "Digunakan" (approved questions answered at least once in any mode); badge tiers use "Jumlah"; the Dashboard "Soalan" shows the same total. Badge line "Sasaran seterusnya: {tier} — {n} soalan" with n = threshold − Jumlah; at the last tier "Tahap tertinggi dicapai".

**44-F2 Soalan Saya list.** Own questions only, 20 per page, newest first; expandable card: text excerpt (120 characters), status chip (OPT-STATUS-SOALAN), the options with the correct one marked, "Penjelasan", "#{id}", buttons "Edit" and "Padam" (only for `review` and `draft`). Empty: "Belum ada soalan dihantar" / "Klik \"Tambah Soalan\" untuk mula menyumbang!" with "Tambah Soalan Pertama". "Pecahan Subjek" chips: subject name with count, sorted by count descending, ties by name.

**44-F3 Import Soalan (CSV)**

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Pilih Fail CSV | file | Yes | none | `.csv` only (an `.xlsx` is rejected), UTF-8, at most 2 MB, at most 500 data rows | not CSV: ERR-REQ-04 with "CSV"; over 2 MB: ERR-REQ-05 with 2; none chosen: ERR-REQ-07; over 500 rows: "Fail melebihi 500 baris."; missing header: ERR-IMP-02 | none | one `question_versions` row per valid line, status `review` | API-GUR-19 |
| Template | button | n/a | n/a | downloads `templat-soalan.csv`: header `subjek,tingkatan,bab,sp,tp,aras,kesukaran,soalan,pilihan_a,pilihan_b,pilihan_c,pilihan_d,jawapan,penerangan` and one example row `Matematik,4,Bab 1,1.1.1,3,mengaplikasi,3,Contoh soalan?,A,B,C,D,A,Contoh penerangan` | none | none | not stored | API-GUR-19 |
| Import | button | n/a | n/a | busy text "Mengimport..." | none | file chosen | see above | API-GUR-19 |

- **Row rules.** `subjek` = BM subject name of OPT-SUBJEK; `tingkatan` 1 to 5; `tp` 1 to 6; `aras` = stored value of OPT-ARAS; `kesukaran` 1 to 5 (empty with a valid `tp` = min(5, `tp`), the OPT-KESUKARAN default); `jawapan` one of A, B, C, D (case-insensitive). Empty `bab`, `sp`, `tp` or `aras` is accepted (the admin completes them in review, D112).
- **Result.** "{a} soalan diimport, {b} baris gagal." (ERR-IMP-01) and a table Baris · Sebab. Reasons: "Subjek tidak dikenali.", "Tingkatan mesti antara 1 dan 5.", "Tahap Penguasaan (TP) mesti antara 1 dan 6.", "Aras pemikiran tidak sah.", "Kesukaran mesti antara 1 dan 5.", "Jawapan mesti A, B, C atau D.", "Soalan diperlukan.", "Pilihan A diperlukan." (B, C, D alike). Valid rows are created as `review`; failed rows download as `ralat-import-{yyyymmdd}.csv` (columns Baris, Sebab, then the original columns).

**44-F4 Hantar Kertas Soalan kepada Admin**

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Jenis Soalan * | select | Yes | "-- Pilih Jenis --" | OPT-JENIS-HANTARAN | "Sila pilih jenis soalan." | none | `intake_batches.paper_type` | API-GUR-17 |
| Matapelajaran * | text | Yes | empty | free text by design (the admin classifies), max 100 | "Sila isi matapelajaran."; over 100: "Matapelajaran tidak boleh melebihi 100 aksara." | none | `intake_batches.subject` (free text for `source` = `guru`) | API-GUR-17 |
| Tingkatan | select | No | "-- Semua / Tidak Pasti --" | OPT-TINGKATAN | none | none | batch level (`levelId`) | API-GUR-17 |
| Tahun | integer | No | empty | 2000 to 2099 | "Tahun mesti antara 2000 dan 2099." | none | `intake_batches.year` (nullable) | API-GUR-17 |
| Disediakan Oleh | text | No | empty | max 150 | "Disediakan oleh tidak boleh melebihi 150 aksara." | none | `intake_batches.source_text` (default "Kiriman guru" when empty) | API-GUR-17 |
| Catatan Tambahan | textarea | No | empty | max 1000 | "Catatan tambahan tidak boleh melebihi 1000 aksara." | none | `intake_batches.note` | API-GUR-17 |
| Fail Soalan + Skema * | file picker, multiple | Yes | none | `.pdf`, `.docx`, `.xlsx`; 1 to 5 files; each at most 20 MB; drop zone text "Klik untuk pilih fail" / "PDF (teks), DOCX, XLSX — maks 5 fail, 20MB setiap fail" | none chosen: ERR-REQ-07; more than 5 files or over 20 MB: the teacher text of ERR-QUOTA-03 and ERR-REQ-05 with 20; wrong type: ERR-REQ-04 with "PDF, DOCX, XLSX"; scanned PDF (no extractable text on the first 3 pages, checked on the server): "PDF imbasan imej tidak diterima — teks mesti boleh disalin." | none | batch files | API-GUR-17 |
| Saya sahkan skema jawapan disertakan bersama soalan. | checkbox | Yes | unticked | the written rule "skema jawapan WAJIB" cannot be machine-checked, so the teacher confirms it | "Sila sahkan skema jawapan disertakan." | none | request flag, not stored | API-GUR-17 |

- Any invalid file rejects the whole submission (nothing is stored). Submit "Hantar kepada Admin" (busy "Memuat naik..."), upload progress per ERR/upload rules of `40-cross-cutting.md` §X10. Success: "Kertas dihantar kepada admin." The batch has `source` = `guru`, `rights_status` = `own`, and appears in Admin Pusat Import & Semakan tab "Kiriman Guru". The teacher has no list of submissions in R1 (V2 has none).

**Requirements added by this spec**
- **FR-GUR-44-11** The bank-contribution form enforces the fields of 44-F1 with the conditional DSKP rule of D112 and stores the version fields named in the table.
- **FR-GUR-44-12** The CSV import accepts `.csv` of at most 2 MB and 500 rows, reports failed rows with the reasons of 44-F3 and lets the teacher download the error file.
- **FR-GUR-44-13** "Hantar Kertas Soalan" accepts PDF, DOCX and XLSX (1 to 5 files, 20 MB each), refuses scanned PDFs and requires the answer-scheme confirmation.
- **AC-GUR-44-12** Given a Subjek + Tingkatan with chapters and DSKP nodes, when every field except Bab is filled and "Hantar untuk Semakan" is pressed, then "Sila pilih bab." shows and nothing is created.
- **AC-GUR-44-13** Given a CSV of 501 data rows, when imported, then "Fail melebihi 500 baris." shows and nothing is created; a 3-row file with one wrong `jawapan` shows "2 soalan diimport, 1 baris gagal." and the reason "Jawapan mesti A, B, C atau D.".
- **AC-GUR-44-14** Given a submission of 6 files, when "Hantar kepada Admin" is pressed, then the file error shows and nothing is stored; given a `.pdf` with no extractable text, then "PDF imbasan imej tidak diterima — teks mesti boleh disalin." shows; given a valid DOCX with the confirmation ticked, then "Kertas dihantar kepada admin." shows and the batch is listed under "Kiriman Guru".

- **Current gap (change the existing code only):** `m10-teacher-class/components/soalan/lib.ts:28`, `HantarKertasCard.vue:70-73` show "Muat naik kertas soalan belum tersedia buat masa ini." (503 from `UnavailablePaperIntake`, `apps/api/src/modules/classes/question-sets/question-sets.ports.ts:46,56`): connect the real intake (`provideIntake`) and remove the notice; add the "Alat Soalan" block with the "Set Soalan" tile; make "Template" a real download; show own-only counts; fix the edit form difficulty preselection.
- **Route** `/guru/soalan`, `/guru/soalan/cipta`, `/guru/soalan/:id`, `/guru/soalan/:id/edit`. **Matrix** 44. **Priority** P1. **Delivery** A. **Status** the page and single-question submit work; **"Hantar Kertas Soalan kepada Admin" fails**: POST `/api/guru/question-papers` = 503 (`apps/api/src/modules/classes/question-sets/question-sets.ports.ts:46,56` `UnavailablePaperIntake`), the card shows "Muat naik kertas soalan belum tersedia buat masa ini." (`m10-teacher-class/components/soalan/lib.ts:28`, `HantarKertasCard.vue:70-73`); admin "Kiriman Guru" shows "Fungsi ini belum tersedia dalam demo" (E2E F9).
- **Reference [V1] M10 S21-S24 / [V2] `guru/sumbang.blade.php`**: four stat cards "📝 Jumlah", "✅ Diluluskan", "⏳ Menunggu", "📊 Digunakan"; info "**Sumbang Soalan** adalah platform perkongsian soalan untuk manfaat semua pelajar di seluruh Malaysia. Setiap soalan yang anda sumbangkan akan melalui proses semakan dan seterusnya tersedia dalam bank soalan kebangsaan PrestasiPlus. Sumbangan anda amat dihargai dalam membina masa depan pendidikan negara."; "Pencapaian Badge Penyumbang" tiers Penyumbang Baru (10), Penyumbang Aktif (100), Penyumbang Dedikasi (500), Penyumbang Cemerlang (1,000), Penyumbang Terbilang (2,500), Legenda Soalan (5,000), Guru Maestro (10,000), Legenda Terulung (50,000), "Sasaran seterusnya: {tier} — {n} soalan"; "Pecahan Subjek" chips sorted by count descending (V1 "Lain" sat in the middle, D-14); "Import Soalan (CSV/Excel)" ("Muat naik banyak soalan sekaligus"; "Template" downloads a real file (V1 dead link, D-08); "Import CSV" with "Pilih Fail CSV", "Import"; guide "Muat turun template → isi soalan → import kembali", "Format: subjek, tahap, soalan, 4 pilihan, jawapan (A/B/C/D), kesukaran, penerangan", "Soalan akan dihantar sebagai "Menunggu Semakan" untuk kelulusan admin", "Baris yang ada ralat akan dilaporkan — soalan sah tetap diimport"); "Soalan Saya" (own questions only, 20 per page; V1's admin saw all 16,817) with "Tambah Soalan"; expandable cards (options, "Penjelasan", "#{id}", "Edit", "Padam" with confirm "Padam soalan #{id}? Tindakan ini tidak boleh dibatalkan."); "Hantar Kertas Soalan kepada Admin" ("Admin akan proses dan upload ke databank soalan"): "Jenis Soalan Yang Diterima" (Soalan Umum, Trial Paper, Soalan DSKP, Buku Teks, Buku Latihan, Soalan Peperiksaan), "Syarat Fail Yang Dihantar" ("Format diterima: PDF (teks), DOCX, XLSX"; "PDF scan imej TIDAK diterima — teks mesti boleh disalin"; "Skema jawapan WAJIB disertakan bersama soalan"; "Maksimum 5 fail, saiz maksimum 20MB setiap fail"), steps "1. Hantar", "2. Proses", "3. Databank", form "Jenis Soalan *", "Matapelajaran *" (100), "Tingkatan" ("-- Semua / Tidak Pasti --", Tingkatan 1-5), "Tahun" (2000-2099), "Disediakan Oleh" (150), "Catatan Tambahan" (1000), "Fail Soalan + Skema *" (`.pdf,.doc,.docx,.xls,.xlsx`), "Hantar kepada Admin". The V1 "Sumbang Set Audio KBAT" block and "AI Auto-Generate Soalan" card (no action on V1, D-10) are not built (no 1.0 target; AI is D73). Create form "Tambah Soalan Baru": "Tahap Pendidikan *", "Mata Pelajaran *", "Bab (Pilihan)", "Topik (Pilihan)", "Jenis Soalan *" (Aneka Pilihan (MCQ), Betul / Salah, Jawapan Pendek, Isi Tempat Kosong, Esei), "Tahap Kesukaran *" (Mudah, Sederhana, Sukar), "Pemetaan DSKP", "Soalan" (2000), options "Pilihan A".."Pilihan D" with the correct radio, "Penerangan (Pilihan)", "Batal", "Hantar untuk Semakan". V1's edit form showed difficulty "Tahap 4" unselected (D-15): fixed.
- **Functional requirements**
  - **FR-GUR-44-1** Stats and badges count the teacher's own contributions ("Diluluskan" = approved by admin, "Menunggu" = pending review, "Digunakan" = answered by pupils); the Dashboard "Soalan" shows the same total.
  - **FR-GUR-44-2** A submitted question has status "Menunggu Semakan", appears in "Soalan Saya" and in the Admin Pusat Studio "Menunggu Semakan"; the teacher edits or deletes only own pending questions.
  - **FR-GUR-44-3** **"Hantar kepada Admin" works with the real intake (D100):** valid files are stored, an intake batch with source "Kiriman Guru" is created, a success message "Kertas dihantar kepada admin." ([PRINCIPLE] copy) shows, and the batch is listed in Admin Pusat Import & Semakan tab "Kiriman Guru" (Admin PRD Q-12, D40). The 503 "belum tersedia" state must be unreachable. More than 5 files, a file > 20 MB or another type is rejected with a BM message before upload.
  - **FR-GUR-44-4** CSV import with a real template download; error rows are reported, valid rows still import.
  - **FR-GUR-44-5** No source/copyright gate per question (D99).
  - **FR-GUR-44-6** Edit shows the stored difficulty and the stored correct answer.
  - **FR-GUR-44-9** (D-A14) The bank-contribution form "Tambah Soalan" (and the CSV template) use the same DSKP fields as the admin form: Tingkatan and Subjek are always required; **Bab is required only when the chosen Subjek + Tingkatan has chapters, and SP (>= 1), TP (1 to 6) and Aras pemikiran are required only where DSKP nodes exist for that Subjek + Tingkatan (D112)**; when none exist the select shows "Tiada bab untuk subjek dan tingkatan ini." (or the matching empty text) and is not required; values are picked from the curriculum lists; **Kesukaran is a separate field, 1 to 5 stars** ("⭐ — Sangat mudah" … "⭐⭐⭐⭐⭐ — Sangat sukar"), stored as difficulty, never as TP; the V1 three-label "Tahap Kesukaran (Mudah, Sederhana, Sukar)" is replaced by it. A missing field shows a BM message and nothing is sent. Rows or questions that still arrive incomplete (old CSV, V1 imports) are accepted as "Menunggu Semakan" and the admin completes the fields during review; only publishing is blocked by the admin gate. Tools 44a and 44b use the same fields; 44c, 44d and 44e create no question (44e picks approved questions).
  - **FR-GUR-44-10** Status words shown to the teacher: "Menunggu Semakan" = `review`; "Diluluskan" = `approved`; "Ditolak" = `draft` returned by the admin, shown with the admin's rejection reason (R1 decision D113). "Digunakan" = the number of the teacher's approved questions answered at least once by any pupil in any mode (`practice_answers`).
  - **FR-GUR-44-8** The "Alat Soalan" block shows the six tiles in the V2 order with the V2 titles and captions; each tile opens its tool (routes in the tool modules R1-GUR-44a to 44e and R1-GUR-8b); none is a dead link or a 404.
  - **FR-GUR-44-7** Responsive: stat cards 2 x 2 at 375; badge tiers in a horizontally scrolling row; "Pecahan Subjek" chips wrap; question cards single column with options stacked; forms RP-FORM (options one per row, correct-answer radio >= 44 px, "Hantar" bar not covering inputs); the file picker full width.
- **Data** Owner M04 (questions, intake). API `GET/POST /api/guru/questions`, `POST /api/guru/question-papers`, `POST /api/guru/questions/import`. Feeds: Admin Pusat Studio "Menunggu Semakan" and "Kiriman Guru".
- **Acceptance criteria**
  - **AC-GUR-44-1** Given a teacher with 0 contributions, when one MCQ is submitted with "Hantar untuk Semakan", then "Menunggu" = 1, "Jumlah" = 1, and the Admin Pusat Studio "Menunggu Semakan" lists it.
  - **AC-GUR-44-2** Given a 2 MB PDF with an answer scheme and Jenis Soalan "Trial Paper", when "Hantar kepada Admin" is pressed, then the response is 2xx, "Kertas dihantar kepada admin." shows and Admin Pusat "Kiriman Guru" lists it with the teacher as source; no 503 or "belum tersedia" text appears.
  - **AC-GUR-44-3** Given a 25 MB file, when chosen, then a BM error shows and nothing is uploaded.
  - **AC-GUR-44-4** Given a CSV of 10 rows with 1 invalid answer letter, when imported, then 9 questions are created as "Menunggu Semakan" and the invalid row is reported.
  - **AC-GUR-44-5** Given another teacher's question id, when opened or edited, then 404 (the record is not revealed to exist; consistent with FR-X2-2 and API 1.7). Decided by principle 2026-11-04: the code returns 404 and a 403 would confirm that the id exists.
  - **AC-GUR-44-6** Given an own question with difficulty 4, when its edit form opens, then "⭐⭐⭐⭐ — Sukar" is preselected and TP shows its own stored value.
  - **AC-GUR-44-10** Given a Subjek + Tingkatan that has chapters and DSKP nodes and the form with Bab or SP left empty, when "Hantar untuk Semakan" is pressed, then a BM message names the field and nothing is created (D112); for a Subjek + Tingkatan without chapters or DSKP nodes, Bab, SP, TP and Aras are not required and the question saves; with every applicable DSKP field set, the question is "Menunggu Semakan".
  - **AC-GUR-44-11** Given a question from an old CSV without Bab and SP, when the admin opens it in review, then the admin can set them; before that the gate refuses "Terbitkan" and the teacher still sees "Menunggu Semakan".
  - **AC-GUR-44-7 (R)** Given 25 own questions, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth, stat cards are 2 x 2 at 375, question options stack, and "Tambah Soalan", "Hantar kepada Admin" and the correct-answer radios are visible and >= 44 px.
  - **AC-GUR-44-8 (U)** Given "Guru UAT" on UAT, when a PDF paper is sent, then the Admin Pusat UAT "Kiriman Guru" tab lists it within one minute; the send must succeed on UAT, it is not allowed to be unavailable.
  - **AC-GUR-44-9** Given "Guru UAT" opens `/guru/soalan`, when the "Alat Soalan" block is read and each of its six tiles is opened in turn, then six tiles show with the titles "Soalan & Rujukan", "Soalan Berstruktur", "Soalan Gambar Rajah", "Databank Soalan", "Set Soalan", "Kertas Peperiksaan", and every target loads with HTTP 200 and its own title (no 404, no "Akses Ditolak", no "belum tersedia").
- **Gap/root cause** see Status. **Deviations** DV-GUR-44-1 template download works; DV-GUR-44-2 own-only counts. **Open** none (OQ-G-12 closed: must work; OQ-G-15 decided).

### R1-GUR-44a Soalan & Rujukan (tool of Sumbang Soalan; personal MCQ with reference link)
- **Action: Build**
- **Screen specification (from V2)**
  - **Routes:** list `/guru/soalan-guru` (the list page was not captured: its title and rows are Not observed in V2 — follow FR-GUR-44a-1); create form `/guru/soalan-guru/cipta`, title "Cipta Soalan & Rujukan — PRESTASIPLUS". The captured V2 link to the form is the "Tambah Soalan" button of Sumbang Soalan.
  - **Create form (exact copy):** link "Kembali ke Soalan & Rujukan"; heading "Soalan MCQ Peribadi" with the text "Soalan ini hanya kelihatan kepada pelajar anda melalui Misi Harian."; fields "Subjek *" (select, "-- Pilih subjek --" then every active subject, §0A Subject lists), "Tahap" (select, "-- Semua tahap --"; V2 lists Darjah 1-6 and Tingkatan 1-5, V3 lists Tingkatan 1-5), "Kesukaran *" (select "⭐ — Sangat mudah", "⭐⭐ — Mudah", "⭐⭐⭐ — Sederhana", "⭐⭐⭐⭐ — Sukar", "⭐⭐⭐⭐⭐ — Sangat sukar"), "Teks Soalan *" (multi-line), "Pautan Rujukan (pilihan)" with help "Video YouTube, Anyflip, PDF atau apa-apa link rujukan.", "Pilihan Jawapan * (pilih jawapan betul)" with options A, B, C, D (a text field and a radio each) and help "Butang radio menandakan jawapan yang betul."; buttons "Batal" and "Simpan Soalan".
  - **States:** the empty form observed; the list, validation messages, success and error messages, delete confirm: Not observed in V2 — follow FR-GUR-44a-*.
  - **Corrections noted:** DV-GUR-44a-1 V2's "Tambah Soalan" on Sumbang Soalan opens this private-question form, but Sumbang Soalan says contributions go to the national bank after review: the two rules contradict. V3 keeps "Tambah Soalan" for the bank contribution form (R1-GUR-44, `/guru/soalan/cipta`) and opens this form only from its own tile (D9, minimal fix). DV-GUR-44a-2 Darjah levels not offered (D72).
#### Field & behaviour spec — R1-GUR-44a Soalan & Rujukan

Routes `/guru/soalan-guru`, `/guru/soalan-guru/cipta`. API: API-GUR-24 (`GET/POST/PUT/DELETE /api/guru/personal-questions`; body fields `subjectId`, `educationLevelId` (the Tahap), `chapterId`, `spIds`, `tp`, `cognitiveLevel`, `difficulty`, `text`, `options`, `correctIndex`, `referenceUrl`, with the conditional DSKP rules and 422 messages of the table below, identical in 60 API-GUR-24), API-GUR-08, API-DSKP-07. DM: `question_versions.visibility` (`teacher_private`), `owner_user_id`, `reference_url`. Additions: A2 ADD-21, registered as API-GUR-24 (extended: the 409 delete guard). D112 applies to Bab, SP, TP and Aras.

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Subjek * | select | Yes | "-- Pilih subjek --" | OPT-SUBJEK | "Sila pilih subjek." | none | question version subject | API-GUR-24 |
| Tahap * | select | Yes | "-- Pilih tahap --" | OPT-TINGKATAN (Tingkatan 1-5 only; "-- Semua tahap --" exists only as the first option of the list filter, never in the form) | "Sila pilih tingkatan." | none | question version level | API-GUR-24 |
| Bab, SP, TP, Aras Pemikiran | selects | Only where chapters or DSKP nodes exist for the Subjek + Tingkatan (D112) | placeholders as 44-F1 | as 44-F1 | "Sila pilih bab.", "Sila pilih Standard Pembelajaran (SP).", "Sila pilih TP.", "Sila pilih aras pemikiran." | Subjek + Tingkatan | as 44-F1 | API-GUR-24 |
| Kesukaran * | select | Yes | min(5, TP) once a TP is chosen and until the teacher touches it, else "-- Pilih kesukaran --" | OPT-KESUKARAN (typed, editable, separate from TP) | "Sila pilih kesukaran." | TP (default only) | `question_versions.difficulty_level` | API-GUR-24 |
| Teks Soalan * | textarea | Yes | empty | max 2000 | "Sila isi teks soalan."; over 2000: "Teks soalan tidak boleh melebihi 2000 aksara." | none | question text | API-GUR-24 |
| Pautan Rujukan (pilihan) | url | No | empty | help "Video YouTube, Anyflip, PDF atau apa-apa link rujukan."; must start with `http://` or `https://`; max 2048 | "Pautan mesti bermula dengan http:// atau https://."; over 2048: "Pautan tidak boleh melebihi 2048 aksara." | none | `question_versions.reference_url` | API-GUR-24 |
| Pilihan Jawapan * (pilih jawapan betul) | 4 text inputs with radios | Yes, one correct | empty | A to D, max 500 each; help "Butang radio menandakan jawapan yang betul." | "Sila isi pilihan A." (B, C, D alike); "Sila tanda satu jawapan yang betul." | none | options and correct option | API-GUR-24 |

- Buttons "Batal", "Simpan Soalan" (busy "Menyimpan..."); success "Soalan disimpan." There is no admin review and no status chip. List: own questions only, newest first, 20 per page; columns Teks (120 characters), Subjek, Tahap, Kesukaran (stars), Rujukan (a link icon when set), actions "Edit" and "Padam" (CF-02). Empty: "Belum ada soalan peribadi." with the button "Tambah Soalan".
- A question used by an active Misi cannot be deleted: 409 with "Soalan sedang digunakan dalam misi."

**Requirements added by this spec**
- **FR-GUR-44a-8** The private question form enforces the fields, limits and the 2048-character reference link rule of the table; a question used by an active Misi cannot be deleted.
- **AC-GUR-44a-8** Given a reference link "ftp://contoh", when "Simpan Soalan" is pressed, then "Pautan mesti bermula dengan http:// atau https://." shows and nothing is saved.
- **AC-GUR-44a-9** Given a private question drawn by an active Misi, when "Padam" is confirmed, then "Soalan sedang digunakan dalam misi." shows and the question stays.

- **Current gap:** no page and no route (`/guru/soalan-guru` is hidden by the `GURU_TOOLS` entry in `src/shells/nav/out-of-scope.ts`, with a nav item `t-soalan-rujukan` in `src/shells/nav/user-nav.ts`). The API `apps/api/src/modules/questions/http/guru.controller.ts` (`/api/guru/questions`) serves bank contributions saved as "review"; it has no private-question flag and no reference-link field, so API-GUR-24 is a separate route set (60 API-GUR-24).
- **Route** `/guru/soalan-guru`, `/guru/soalan-guru/cipta`. **Matrix** 44 (tool). **Priority** P1. **Delivery** A.
- **Functional requirements**
  - **FR-GUR-44a-1** The list at `/guru/soalan-guru` shows the teacher's own private questions (text, subject, tahap, kesukaran) with "Tambah Soalan"; the teacher can edit and delete only own questions; another teacher's id is 404.
  - **FR-GUR-44a-2** The create form has the V2 fields and labels above; required: Subjek, Kesukaran, Teks Soalan, the four options and one correct option; a missing required field shows a BM message and nothing is saved.
  - **FR-GUR-44a-3** "Pautan Rujukan" accepts only an http or https address; the pupil sees it as a link that opens in a new tab beside the question. Where it sits on the pupil screen is Not observed in V2 — follow FR-X6-*.
  - **FR-GUR-44a-4** A private question is visible only to the pupils of the teacher's own classes, through Misi Harian (R1-GUR-2b); it never enters the national bank, Databank (R1-GUR-44d), Set Soalan pickers or admin review, and it is not counted in the Sumbang Soalan stat cards or badges.
  - **FR-GUR-44a-5** "Tahap" offers Tingkatan 1-5 only; the question carries one correct option and no stimulus.
  - **FR-GUR-44a-7** (D-A14) The form uses the DSKP fields of FR-GUR-44-9 (Tingkatan from "Tahap" is required; Bab, SP, TP and Aras are required only where chapters or DSKP nodes exist for the Subjek + Tingkatan, D112) and keeps "Kesukaran" as the separate 1 to 5 stars; a private question never enters admin review or the bank, so no gate applies to it.
  - **FR-GUR-44a-6** Responsive: RP-FORM; options one per row; the correct-answer radios and "Simpan Soalan" are >= 44 px; no horizontal scroll at 375.
- **Data** Owner M04 (questions); an own-visibility flag and a reference link are needed in the question store or its contract; Misi Harian read by M05.
- **Acceptance criteria**
  - **AC-GUR-44a-1** Given the form with Subjek "Matematik", Kesukaran "⭐⭐⭐ — Sederhana", a text, four options with B correct and the Pautan "https://example.org/rujukan", when "Simpan Soalan" is pressed, then the question is listed in `/guru/soalan-guru` with the stored correct option B and the link.
  - **AC-GUR-44a-2** Given the form with Teks Soalan empty, when "Simpan Soalan" is pressed, then a BM message shows and the list count does not change.
  - **AC-GUR-44a-3** Given a Pautan "javascript:alert(1)", when saved, then it is rejected with a BM message.
  - **AC-GUR-44a-4** Given a saved private question, when a pupil of another teacher and a pupil of the teacher open Misi Harian, then only the second can be served it, and the Admin Pusat Studio "Menunggu Semakan" and Databank do not list it.
  - **AC-GUR-44a-5** Given the Tahap select, then it lists "-- Semua tahap --" and Tingkatan 1 to 5 and no Darjah.
  - **AC-GUR-44a-7** Given a Subjek + Tingkatan with DSKP nodes and the form with SP empty, when "Simpan Soalan" is pressed, then a BM message names SP and nothing is saved; where the Subjek + Tingkatan has no DSKP nodes, SP is not required (D112).
  - **AC-GUR-44a-6 (R)** Given the form at 375, 768 and 1280 px, then scrollWidth <= innerWidth, the options stack one per row and the radios and "Simpan Soalan" are >= 44 px.
- **Deviations** DV-GUR-44a-1, DV-GUR-44a-2. **Open** none (decided as OQ-G-16, section 6.2: "Tambah Soalan" on Sumbang Soalan opens the bank-contribution form; this form opens only from its own tile, DV-GUR-44a-1).

### R1-GUR-44b Soalan Berstruktur (tool of Sumbang Soalan; list and detail of structured questions)
- **Action: Complete** (the admin list and detail pages and `GET /api/structured-questions` exist; the teacher mount and the teacher submission are added)
- **Screen specification (from V2)**
  - **Screen A, list.** Route `/guru/soalan-berstruktur`; title "Soalan Berstruktur — PRESTASIPLUS". Heading "Soalan Berstruktur" with the sub-line "Cipta & urus soalan berstruktur mengikut piawaian SPM KPM — {n} soalan dalam bank" (V2 observed 4,061). Regions: filter card; table with pager.
  - **Filter card:** "Subjek" (select "Semua" + every active subject alphabetically (§0A Subject lists)), "Tingkatan" (select "Semua" + Darjah 1-6 and Tingkatan 1-5 in V2; V3 Tingkatan 1-5), "Status" (select "Semua", "Diluluskan"), button "Tapis".
  - **Table:** columns "#", "Soalan", "Subjek", "KBAT", "Sub", "Markah", "Status", and a last column with an eye icon. Row: the row number; the question text cut with "..." (first lines of the stimulus text) with a sub-line with the level ("Tingkatan 5"); the subject as a pill; the KBAT level as a chip (observed "MOTS 3"); the number of sub-questions (observed "1"); the marks as "{n}m" (observed "8m"); the status chip "Diluluskan"; the eye icon opens the detail. Twenty rows per page; summary "Showing 1 to 20 of 4061 results" with a numbered pager (V2 shows English words).
  - **Screen B, detail.** Route `/guru/soalan-berstruktur/{id}`; title "Soalan Berstruktur #{id} — PRESTASIPLUS". Regions: link "Kembali ke Senarai" and the status chip "Diluluskan"; summary row (subject, level chip "Tingkatan 5", KBAT "MOTS 3", "8 markah"); block "Rangsangan" with the stimulus text; block "Sub-Soalan ({n})" with each part as "(a) text [8 markah]" and its marks "8m", and under it a block "Skema Jawapan" with the answer text; a footer line "Dicipta oleh {pencipta} · {tarikh}".
  - **Create/edit form for a teacher:** the sub-line says "Cipta & urus", but no create or edit screen was captured: Not observed in V2 — follow FR-GUR-44b-5.
  - **States:** populated list and detail observed; empty list, loading, error: Not observed in V2 — follow FR-GUR-44b-*.
  - **Corrections noted:** DV-GUR-44b-1 the V2 pager text is English ("Showing ... results", "Previous", "Next"): V3 shows BM ("Menunjukkan {a} hingga {b} daripada {n} keputusan", "Sebelumnya", "Seterusnya") (D9: wrong-language label). DV-GUR-44b-2 Darjah levels not offered (D72). DV-GUR-44b-3 the V2 list text starts with a source line "Soalan Oleh: {nama guru}" inside the question text; V3 never shows a real teacher name from migrated text (privacy).
#### Field & behaviour spec — R1-GUR-44b Soalan Berstruktur

Routes `/guru/soalan-berstruktur`, `/cipta`, `/:id`, `/:id/edit`. API: API-GUR-26 (list and detail), teacher submission: ADD-13 (API-GUR-26). D112 applies to Bab, SP, TP and Aras.

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Subjek (filter) | select | No | "Semua" | OPT-SUBJEK (A-Z variant) | none | none | query string | API-GUR-26 |
| Tingkatan (filter) | select | No | "Semua" | OPT-TINGKATAN | none | none | query string | API-GUR-26 |
| Status (filter) | select | No | "Semua" | "Semua", "Diluluskan" (`approved`), "Menunggu Semakan" (`review`, the teacher's own submissions) | none | none | query string | API-GUR-26 |
| Tapis | button | n/a | n/a | page 1, filters in the query | none | none | n/a | API-GUR-26 |
| Tingkatan *, Subjek *, Kesukaran * | selects | Yes | placeholders as 44-F1 | OPT-TINGKATAN, OPT-SUBJEK, OPT-KESUKARAN | as 44-F1 | none | as 44-F1 | ADD-13 |
| Bab, SP, TP, Aras Pemikiran | selects | Only where chapters or DSKP nodes exist (D112) | placeholders as 44-F1 | as 44-F1 | as 44-F1 | Subjek + Tingkatan | as 44-F1 | ADD-13 |
| Rangsangan | textarea | No | empty | max 4000 | "Rangsangan tidak boleh melebihi 4000 aksara." | none | stimulus text | ADD-13 |
| Imej rangsangan (`question_image`) | file | No | none | `jpg`, `png`, `webp`; at most 5 MB | "Fail mesti berupa imej (jpg, png atau webp)."; "Saiz imej tidak boleh melebihi 5 MB." | none | stimulus image | ADD-13 |
| Sub-Soalan (1 to 10, repeatable): Teks sub-soalan * | textarea | Yes | empty | max 2000 | "Sila isi teks sub-soalan." | none | part text | ADD-13 |
| Sub-Soalan: Markah * | integer | Yes | empty | 1 to 20 | "Markah mesti antara 1 dan 20." | none | part marks | ADD-13 |
| Sub-Soalan: Skema Jawapan * | textarea | Yes | empty | max 2000 | "Sila isi skema jawapan." | none | part mark scheme | ADD-13 |
| Sub-Soalan: Aras Pemikiran | select | No | the question's Aras | OPT-ARAS | none | none | part cognitive level | ADD-13 |
| Tambah Sub-Soalan / Buang | buttons | n/a | one part | "Buang" is disabled at one part | "Sekurang-kurangnya satu sub-soalan diperlukan." | none | n/a | none |

- List: 20 per page, newest first; sub-line "Cipta & urus soalan berstruktur mengikut piawaian SPM KPM — {n} soalan dalam bank". Empty: "Tiada soalan berstruktur dijumpai."
- Form: route `/guru/soalan-berstruktur/cipta` (button "Cipta Soalan Berstruktur"), edit `/:id/edit` for own `review` or `draft`. "Jumlah markah: {n}" = sum of the part marks. "Hantar untuk Semakan" creates an intake batch with `source` = `guru`, status `review`; success "Soalan berstruktur dihantar untuk semakan." The state machine is the one of 44-F1.

**Requirements added by this spec**
- **FR-GUR-44b-8** The submission form enforces the fields and limits of the table (1 to 10 parts, marks 1 to 20, image rules) and shows the total marks.
- **AC-GUR-44b-8** Given a part with Markah 21, when "Hantar untuk Semakan" is pressed, then "Markah mesti antara 1 dan 20." shows and nothing is created.
- **AC-GUR-44b-9** Given a single part, when "Buang" is pressed, then the part stays and "Sekurang-kurangnya satu sub-soalan diperlukan." shows.

- **Current gap:** `src/modules/m04-question-bank/routes/structured.ts` mounts the list and detail only under `/admin/structured-questions` (admin only); `/guru/soalan-berstruktur` is hidden by `GURU_TOOLS` in `out-of-scope.ts`; `StructuredListPage.vue` already links to `/guru/soalan-berstruktur/cipta` and `/guru/soalan-berstruktur/:id/edit` (tests only), but those routes do not exist. API `GET /api/structured-questions` and `/:id` exist (`questions/http/structured.controller.ts`); there is no teacher create or update endpoint for structured questions; the admin intake (`apps/api/src/modules/intake/`) is the route for new questions.
- **Route** `/guru/soalan-berstruktur`, `/guru/soalan-berstruktur/:id`. **Matrix** 44 (tool). **Priority** P1. **Delivery** A.
- **Functional requirements**
  - **FR-GUR-44b-1** The teacher list shows approved structured questions with the filters Subjek, Tingkatan (1-5), Status and "Tapis"; the sub-line total is computed from the dataset (D11), 20 rows per page, newest first.
  - **FR-GUR-44b-2** Each row shows the number, text excerpt, level, subject, KBAT chip, number of sub-questions, marks as "{n}m" (the sum of its sub-questions) and the status; the eye opens the detail.
  - **FR-GUR-44b-3** The detail shows the V2 regions in the V2 order; "Skema Jawapan" is shown to the teacher; marks per part and the total agree with the list.
  - **FR-GUR-44b-4** A stimulus (rajah, petikan, jadual, graf) is shown once in "Rangsangan" above all its sub-questions and is never a question or carries marks; it belongs to a stimulus group of 1..n questions that is never split (FR-X1-4a, 4d, 4e); a figure displays with its image.
  - **FR-GUR-44b-5** Not observed in V2 — follow FR-X1-4 and the admin intake: a teacher can submit a new structured question or paper from this tool; the submission creates an intake batch with source "Kiriman Guru" (`source=guru`) in "Menunggu Semakan", with the DSKP fields of FR-GUR-44-9 (Bab, SP, TP and Aras required only where chapters or DSKP nodes exist, D112; the admin may complete missing ones in review), marks, mark scheme and its stimulus group (1..n questions) kept together; the teacher edits or deletes only own pending submissions; there is no separate submissions API.
  - **FR-GUR-44b-6** Pupils-side visibility of a structured question follows its admin status; a structured question that needs a diagram it does not have is not served (FR-X1-4f) and is listed in R1-GUR-44c.
  - **FR-GUR-44b-7** Responsive: the table becomes one card per question at 375 (RP-TABLE-LIST); filters stack; the pager wraps; all controls >= 44 px; figures fit the width and can be opened full screen (FR-X6-7).
- **Data** Owner M04 (structured questions, intake). API `GET /api/structured-questions*` (exists); API-GUR-26 (teacher POST/PUT, ADD-13); submission through the admin intake (exists, source `guru`).
- **Acceptance criteria**
  - **AC-GUR-44b-1** Given 4,061 approved structured questions, when the list opens, then the sub-line shows "4,061 soalan dalam bank", 20 rows show and the summary reads "Menunjukkan 1 hingga 20 daripada 4,061 keputusan" (BM, DV-GUR-44b-1).
  - **AC-GUR-44b-2** Given Subjek "Perniagaan" and Tingkatan "Tingkatan 5", when "Tapis" is pressed, then every row shows "Perniagaan" and "Tingkatan 5" and the count equals the dataset count.
  - **AC-GUR-44b-3** Given a question with one part of 8 marks, when the row and the detail are read, then both show "8m" / "8 markah" and "Sub" = 1.
  - **AC-GUR-44b-4** Given a stimulus with 3 questions, when its detail or the list is read, then the stimulus shows once above the 3 sub-questions and no question is listed without it.
  - **AC-GUR-44b-5** Given a teacher submits a structured question with a stimulus and 2 questions, then an intake batch with source "Kiriman Guru" lists it in Admin Pusat Import & Semakan, the stimulus is attached to both questions once, and the teacher sees it as "Menunggu Semakan" and can edit it.
  - **AC-GUR-44b-6** Given another teacher's pending submission id, when opened or edited, then 404 as the module rule of R1-GUR-44 (AC-GUR-44-5).
  - **AC-GUR-44b-7 (R)** Given the list and the detail at 375, 768 and 1280 px, then scrollWidth <= innerWidth, rows are cards at 375 and "Tapis", the eye and "Kembali ke Senarai" are >= 44 px.
- **Deviations** DV-GUR-44b-1 to 44b-3. **Open** none (the V2 create form was not captured: FR-GUR-44b-5 governs).

### R1-GUR-44c Soalan Gambar Rajah (tool of Sumbang Soalan; questions that need a diagram)
- **Action: Complete** (the admin audit page and `/api/diagram-audit` exist; teacher access is added)
- **Screen specification (from V2)**
  - **Teacher tile:** title "Soalan Gambar Rajah", caption "Soalan perlu gambar rajah". The V2 teacher screen behind the tile was **not captured**: Not observed in V2 for the teacher — follow FR-GUR-44c-*. The closest observation is the V2 admin screen of the same tool (route `/admin/soalan-gambar`, observed in the M04 URS S11), reached by teachers and school admins from the user-portal "BANTUAN" item "Gambar Rajah" with a red count badge.
  - **Observed admin screen (basis):** title "Soalan Perlu Gambar Rajah - Admin"; header "Soalan Perlu Gambar Rajah" / "Audit soalan yang memerlukan gambar rajah dilengkapkan"; three stat cards "MCQ Perlu Gambar", "Struktur Perlu Gambar", "Jumlah"; card "MCQ Perlu Gambar Mengikut Mata Pelajaran" with top-10 subject pills "{Subjek}: {n}"; filter "Semua Mata Pelajaran", "Semua Sekolah", "Tapis"; sections "MCQ ({n})" and "Struktur ({n})" of question cards ("#{id}", subject pill, text, source file and page) each with an image upload (accepts images) and "Dismiss"; empty "Semua soalan sudah lengkap dengan gambar rajah!".
  - **States:** the teacher's own states: Not observed in V2 — follow FR-GUR-44c-*.
#### Field & behaviour spec — R1-GUR-44c Soalan Gambar Rajah

Route `/admin/soalan-gambar`. API: API-GUR-09 (`galeri-rajah`), diagram image submission: ADD-17 (API-Q-21).

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Mata Pelajaran | select | No | "Semua Mata Pelajaran" | OPT-SUBJEK (A-Z variant) limited to subjects that have listed questions | none | none | query string | API-GUR-09 |
| Semua Sekolah | filter | n/a | n/a | hidden for the Guru and the Admin Sekolah (scope is the own school) | none | none | n/a | none |
| Tapis | button | n/a | n/a | applies the subject filter | none | none | n/a | API-GUR-09 |
| Upload per card | file | Yes to submit | none | `jpg`, `png`, `webp`; at most 5 MB | "Fail mesti berupa imej (jpg, png atau webp)."; "Saiz imej tidak boleh melebihi 5 MB." | none | question image, status pending acceptance | ADD-17 |

- Success: "Gambar dihantar untuk semakan."; the card stays in the list with the chip "Menunggu Semakan" until an admin accepts it. There is no "Dismiss" for a teacher. Empty: "Semua soalan sudah lengkap dengan gambar rajah!" Counts are computed from the dataset; the navigation badge reads "MCQ Perlu Gambar".

**Requirements added by this spec**
- **FR-GUR-44c-6** The upload accepts only `jpg`, `png` and `webp` up to 5 MB and the card shows "Menunggu Semakan" after a successful submit.
- **AC-GUR-44c-6** Given a 6 MB `png`, when uploaded, then "Saiz imej tidak boleh melebihi 5 MB." shows and the card is unchanged; given a valid `webp`, then "Gambar dihantar untuk semakan." shows and the chip "Menunggu Semakan" appears.

- **Current gap:** `src/modules/m04-question-bank/routes/diagrams.ts` allows `roles: ['admin']` only, although the nav items `gambar-rajah` (`src/shells/nav/user-nav.ts:584`, roles admin, teacher, school_admin) and the badge `src/shells/user/nav-badges.ts` already point teachers to it; the tile on Sumbang Soalan is absent. API `diagram-audit` (`apps/api/src/modules/questions/workflow/diagram-audit/`: `GET`, `POST :kind/:id/image`, `POST :kind/:id/dismiss`) exists.
- **Route** `/admin/soalan-gambar` (the V2 route, kept). **Matrix** 44 (tool). **Priority** P2. **Delivery** A.
- **Functional requirements**
  - **FR-GUR-44c-1** A teacher opens the tool from its tile and from the "Gambar Rajah" nav item without a 403 or 404; the page, header, stat cards, subject pills, filter, MCQ and Struktur sections and the empty copy are those of the admin screen above; every count is computed from the dataset (D11) and the nav badge equals "MCQ Perlu Gambar".
  - **FR-GUR-44c-2** The teacher can upload an image for a listed question; the image is attached once to the question's stimulus group (FR-X1-4a, 4c), so all questions of that group share it and it is never duplicated; the upload enters the admin review as a batch with source "Kiriman Guru" and the question stays listed until an admin accepts it [PRINCIPLE: teacher figures are reviewed before pupils see them].
  - **FR-GUR-44c-3** "Dismiss" (an admin decision that no diagram is needed) is not offered to a teacher [PRINCIPLE: it hides the question from the audit]; the teacher can still see the card.
  - **FR-GUR-44c-4** A file that is not an image or is larger than the platform image limit is rejected with a BM message before upload.
  - **FR-GUR-44c-5** Responsive: stat cards 1 / 3 columns, cards single column at 375, the upload control and "Tapis" >= 44 px, no horizontal scroll.
- **Data** Owner M04 (diagram audit, intake). API `/api/diagram-audit*` (exists; roles to be extended to teacher).
- **Acceptance criteria**
  - **AC-GUR-44c-1** Given "Guru UAT", when the tile "Soalan Gambar Rajah" is opened, then the page "Soalan Perlu Gambar Rajah" loads with the three stat cards and no 403/404.
  - **AC-GUR-44c-2** Given the stat "MCQ Perlu Gambar" = N, when the nav item "Gambar Rajah" is read, then its badge shows the same N.
  - **AC-GUR-44c-3** Given a question of a stimulus group of 3 questions, when the teacher uploads an image, then an intake batch "Kiriman Guru" lists it, the image is linked once to the group and no copy is made per question.
  - **AC-GUR-44c-4** Given a teacher, when the cards are read, then no "Dismiss" control shows.
  - **AC-GUR-44c-5 (R)** Given the page at 375, 768 and 1280 px, then scrollWidth <= innerWidth and the upload control is >= 44 px.
- **Deviations** none (basis is the V2 admin screen; teacher scope is a [PRINCIPLE] choice). **Open** none (decided as OQ-G-16, section 6.2: the FRs of this module govern).

### R1-GUR-44d Databank Soalan (tool of Sumbang Soalan; browse the question bank)
- **Action: Build** (a new teacher screen over the existing question list API)
- **Screen specification (from V2)**
  - **Route / title:** `/guru/databank`; title "Databank Soalan — PRESTASIPLUS". Regions: hero; two stat cards; hint; group "Subjek Teras ({n})"; group "Subjek Elektif ({n})"; block "Senarai Soalan".
  - **Hero:** "Databank Soalan SPM" / "Terokai koleksi soalan sedia ada dalam bank soalan PrestasiPlus".
  - **Stat cards (value / label):** "{n}" / "Jumlah Soalan" (observed 451,518); "{n}" / "Subjek Aktif" (observed 31). Hint: "Klik mana-mana subjek untuk lihat soalannya di bawah."
  - **Subject tiles:** "Subjek Teras (7)" (Bahasa Melayu, Bahasa Inggeris, Matematik, Sains, Sejarah, Pendidikan Islam, Pendidikan Moral) and "Subjek Elektif (24)" (the other 24 subjects); a tile shows the BM name, the English name (for example "Malay Language") and "{n} soalan" (zero shown as "0 soalan", observed for two subjects).
  - **Block "Senarai Soalan":** a search box with the button "Cari"; table columns "#", "Soalan", "Subjek", "Tahap", "Kesukaran", "Status"; a row shows the question id, the text cut with "..." after about 55 characters, the subject, the level ("Tingkatan 4"), the difficulty as stars (⭐ to ⭐⭐⭐) and "Diluluskan"; newest first. Figure questions ("Rajah ... menunjukkan ...") are listed as text only in V2.
  - **Not observed in V2:** the search box placeholder, page size and pager, the filtered state after a tile click, row actions, empty and error states — follow FR-GUR-44d-*.
  - **Corrections noted:** DV-GUR-44d-1 "Subjek Aktif" 31 contradicts two tiles with "0 soalan": V3 computes "Subjek Aktif" as the subjects with at least one servable question (D11). DV-GUR-44d-2 only Tingkatan 1-5 questions are counted and listed (D72, D101); the V2 total is not reproduced. DV-GUR-44d-3 figure questions show their figure (D105).
#### Field & behaviour spec — R1-GUR-44d Databank Soalan

Route `/guru/databank`. API: API-GUR-27 (`/api/guru/databank/overview`, `/questions`). Read-only.

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Subject tiles | toggle tiles | No | none selected | selecting highlights and filters the list, selecting again clears; "Subjek Teras (7)" = Bahasa Melayu, Bahasa Inggeris, Matematik, Sains, Sejarah, Pendidikan Islam, Pendidikan Moral; "Subjek Elektif (n)" = the rest; a tile shows the BM name, the English name and "{n} soalan" ("0 soalan" is kept) | none | none | query string | API-GUR-27 |
| Cari + "Cari" | text and button | No | empty | placeholder "Cari teks soalan..."; Enter or the button (GLB-4) | "Taip sekurang-kurangnya 2 aksara." | none | query string | API-GUR-27 |

- English tile names (seed constant, in OPT-SUBJEK order): Malay Language, English Language, Mathematics, Science, History, Islamic Education, Moral Education, Additional Mathematics, Physics, Chemistry, Biology, Geography, Visual Arts Education, Music Education, Physical and Health Education, Design and Technology, Computer Science, Arabic Language, Chinese Language, Tamil Language, Principles of Accounting, Economics, Business, Al-Quran and As-Sunnah Education, Islamic Tasawwur, Jawi, Islamic Syariah Education, Home Science, Women's Garment Making, Agriculture, Sports Science.
- Table "Senarai Soalan": columns # (question id), Soalan (55 characters plus "..."), Subjek, Tahap, Kesukaran (stars), Status ("Diluluskan"); 20 per page, newest first. Empty: "Tiada soalan sepadan dengan carian anda."

**Requirements added by this spec**
- **FR-GUR-44d-7** The tiles toggle the subject filter, show the English names listed, and the table follows the columns, truncation and paging above.
- **AC-GUR-44d-7** Given the tile "Matematik" selected, when pressed again, then the filter clears and all subjects list; a search of "x" shows "Taip sekurang-kurangnya 2 aksara."

- **Current gap:** no teacher page: `/guru/databank` is hidden by `GURU_TOOLS` in `out-of-scope.ts` (nav items `t-databank` and `databank-soalan` exist). The pupil "Databank Soalan SPM" (`/spm/tahun-lepas`, `src/modules/m06-spm/pages/DatabankPage.vue`, `GET /api/spm/databank`) is a different screen (past-year papers). The question list and counts must come from the M04 serving/listing read model (`apps/api/src/modules/questions/serving/`).
- **Route** `/guru/databank`. **Matrix** 44 (tool). **Priority** P1. **Delivery** A.
- **Functional requirements**
  - **FR-GUR-44d-1** The page shows the hero, the two stat cards and the two subject groups with BM and English names and live counts (D11); "Subjek Teras" = the core subjects.
  - **FR-GUR-44d-2** Choosing a tile filters "Senarai Soalan" to that subject and highlights the tile; choosing it again clears the filter; "Cari" searches the question text.
  - **FR-GUR-44d-3** The list shows only approved, servable questions of Tingkatan 1-5, newest first, with the V2 columns; long text is cut with "..."; a page size and a pager are used (Not observed in V2; 20 per page, BM pager as DV-GUR-44b-1).
  - **FR-GUR-44d-4** A question with a figure or a stimulus group shows the figure and the whole group as one unit (FR-X1-4d, 4e); a question that is only a figure, or says "Rajah n menunjukkan" with no figure, is excluded (flag `figure_only` or `stimulus_missing`) and listed for the admin (FR-X1-4f); a question with a duplicated stem is shown once and is not excluded (D113).
  - **FR-GUR-44d-5** The screen is read-only: no edit, archive or delete control; a teacher's private questions (R1-GUR-44a) and unapproved submissions are never listed.
  - **FR-GUR-44d-6** Responsive: tiles 1/2/3 columns; the table becomes cards at 375; search and "Cari" >= 44 px; figures fit and open full screen (FR-X6-7).
- **Data** Owner M04 (question list), M03 (subjects). API: the M04 list read model (to be exposed to the teacher role); `GET /api/spm/databank` is not reused.
- **Acceptance criteria**
  - **AC-GUR-44d-1** Given a dataset with N servable Tingkatan 1-5 questions in S subjects, when the page opens, then "Jumlah Soalan" = N, "Subjek Aktif" = S and each tile count equals the dataset count of its subject.
  - **AC-GUR-44d-2** Given a subject with 0 questions, when the page opens, then its tile shows "0 soalan" and is not counted in "Subjek Aktif".
  - **AC-GUR-44d-3** Given the tile "Sains", when clicked, then every list row shows "Sains" and the total equals the tile count.
  - **AC-GUR-44d-4** Given the text "Rajah 3" searched with "Cari", then rows whose text matches show and rows of another text do not.
  - **AC-GUR-44d-5** Given a group of a figure and 2 questions, when listed, then the figure shows once with both questions and no question shows without it.
  - **AC-GUR-44d-6 (R)** Given the page at 375, 768 and 1280 px, then scrollWidth <= innerWidth, tiles are 1/2/3 columns and tiles, search and "Cari" are >= 44 px.
- **Deviations** DV-GUR-44d-1 to 44d-3. **Open** none.

### R1-GUR-44e Kertas Peperiksaan (tool of Sumbang Soalan; teacher exam papers)
- **Action: Build**
- **Screen specification (from V2)**
  - **Route / title:** `/guru/kertas-peperiksaan`; title "Kertas Peperiksaan — PRESTASIPLUS". Regions: heading row; list or empty card; card "Cipta Kertas Baharu".
  - **Heading row:** "Kertas Peperiksaan Anda" and the button "Cipta Baharu". **Empty state:** icon and "Belum ada kertas peperiksaan. Cipta kertas pertama anda di bawah."
  - **Card "Cipta Kertas Baharu":** field "Nama Kertas" (placeholder "cth: Ujian Pertengahan Tahun"); select "Subjek" ("— Pilih Subjek —" then every active subject alphabetically (§0A Subject lists)); button "Cipta Baharu".
  - **Tile caption:** "Muat naik & kongsi kertas".
  - **Not observed in V2:** populated paper rows, the screen after "Cipta Baharu", upload and share actions, validation and success messages — follow FR-GUR-44e-*.
#### Field & behaviour spec — R1-GUR-44e Kertas Peperiksaan

Route `/guru/kertas-peperiksaan`. API: API-GUR-28 (`/api/guru/kertas-peperiksaan`, `/:id/share`, withdraw). DM: `question_sets.kind` = `kertas`, `question_set_classrooms`.

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Nama Kertas | text | Yes | empty | placeholder "cth: Ujian Pertengahan Tahun"; max 150 | "Sila isi nama kertas."; over 150: "Nama kertas tidak boleh melebihi 150 aksara." | none | `question_sets.title` | API-GUR-28 |
| Subjek | select | Yes | "— Pilih Subjek —" | OPT-SUBJEK (A-Z variant) | "Sila pilih subjek." | none | `question_sets.subject_id` | API-GUR-28 |
| Kelas (Kongsi) | checkbox list | Yes to share | none ticked | OPT-KELAS-OWN | "Pilih sekurang-kurangnya satu kelas sebelum berkongsi." | none | `question_set_classrooms` | API-GUR-28 |
| Question picker | checkbox list | Yes (1 to 100) | none | as 8b: approved questions only, whole stimulus groups, 50 per scroll batch | "Pilih sekurang-kurangnya satu soalan."; over 100: "Satu kertas boleh mengandungi paling banyak 100 soalan."; group split: ERR-QST-02 | none | `question_set_items` | API-GUR-28 |

- Statuses: `draft` = "Draf", `shared` = "Dikongsi" (stored as the set statuses `draft` and `published`). "Cipta Baharu" creates a draft. List row: name, subject, status chip, buttons "Urus", "Kongsi" or "Tarik Balik", "Padam" (CF-13). Toasts: "Kertas dicipta.", "Kertas dikongsi.", "Kertas ditarik balik.". Empty: "Belum ada kertas peperiksaan. Cipta kertas pertama anda di bawah."

**Requirements added by this spec**
- **FR-GUR-44e-6** A paper needs a name, a subject and 1 to 100 approved questions; sharing needs at least one own class; "Tarik Balik" returns it to `draft`.
- **AC-GUR-44e-6** Given a draft paper and no class ticked, when "Kongsi" is pressed, then "Pilih sekurang-kurangnya satu kelas sebelum berkongsi." shows and the status stays "Draf".

- **Current gap:** no teacher page: `/guru/kertas-peperiksaan` is hidden by `GURU_TOOLS` in `out-of-scope.ts` (nav item `t-kertas-peperiksaan`). The exam builder exists for the admin (`apps/api/src/modules/exam/builder/`, Set Builder UI); the teacher side has no endpoint. File submission to the admin already belongs to R1-GUR-44 ("Hantar Kertas Soalan kepada Admin").
- **Route** `/guru/kertas-peperiksaan`. **Matrix** 44 (tool). **Priority** P2. **Delivery** A.
- **Functional requirements**
  - **FR-GUR-44e-1** The page lists the teacher's own papers (name, subject, status) with "Cipta Baharu"; with none, the V2 empty copy shows.
  - **FR-GUR-44e-2** "Cipta Baharu" with a "Nama Kertas" and a "Subjek" creates a draft paper owned by the teacher and lists it; an empty name or no subject shows a BM message and creates nothing.
  - **FR-GUR-44e-3** [PRINCIPLE, Not observed in V2] The teacher builds the paper from approved questions with the same picker rules as R1-GUR-8b (FR-GUR-8b-2: approved only, filter by subject, Tingkatan and text), a stimulus group is one unit and never split (FR-X1-4e), and it carries the paper structure of `docs/requirements/v2-exam-schema.md`.
  - **FR-GUR-44e-4** [PRINCIPLE, Not observed in V2] "Kongsi" makes the paper visible to the pupils of the explicitly selected own class(es) only (as R1-GUR-8b-3) and can be withdrawn; a paper is never visible to another teacher's pupils. Uploading a document file is the R1-GUR-44 "Hantar Kertas Soalan kepada Admin" flow and is not duplicated here.
  - **FR-GUR-44e-5** Responsive: RP-FORM, the name and the select full width at 375 and the button >= 44 px; the paper list is single column at 375.
- **Data** Owner M10 (own papers) over M04 (questions) and the exam builder; API to be defined (a `/api/guru/` exam-paper resource over the existing builder service).
- **Acceptance criteria**
  - **AC-GUR-44e-1** Given a teacher with no paper, when the page opens, then "Belum ada kertas peperiksaan. Cipta kertas pertama anda di bawah." shows.
  - **AC-GUR-44e-2** Given Nama Kertas "Ujian 1" and Subjek "Matematik", when "Cipta Baharu" is pressed, then "Ujian 1" is listed as a draft and no other teacher sees it.
  - **AC-GUR-44e-3** Given an empty Nama Kertas, when "Cipta Baharu" is pressed, then a BM message shows and no paper is created.
  - **AC-GUR-44e-4** Given a draft with 5 approved questions including one stimulus group of 2, when shared, then a pupil of the teacher's class sees the paper with the group intact and a pupil of another teacher does not.
  - **AC-GUR-44e-5 (R)** Given the page at 375, 768 and 1280 px, then scrollWidth <= innerWidth and "Cipta Baharu", the name field and the select are >= 44 px.
- **Deviations** none. **Open** none (decided as OQ-G-16, section 6.2: the FRs of this module govern).

---

## 4. Admin Sekolah modules

Data scope for every module: SC-AS (1.4c). Definitions: section 5.

### R1-AS-0 Preconditions (all AS modules)
- **Action: Build** (the UAT account and the relative-date seed do not exist)
- **Screen specification (from V2):** none (infrastructure, no screen). **Current gap:** no school-admin account on UAT (create "Admin Sekolah UAT" through the account-creation form prepared by the lead); seeds with fixed dates (`m27-school-admin/mock/read-models/*`, `m16-battle-games/mock/data/sekolah-bersaing-seed.ts:219`) are replaced by data generated relative to now on the server; `schoolId` check on every `/api/admin-sekolah/*` controller (`apps/api/src/modules/school-admin/*`).
- **Priority** P0. **Delivery** A.
- **Functional requirements**
  - **FR-AS-0-1** A UAT school-admin account "Admin Sekolah UAT" exists (fictitious name) for a migrated school with at least 50 pupils, 3 teachers, 4 classes and answers in the last 30 days, so every AS "(U)" AC can run. Today none exists.
  - **FR-AS-0-2** A school admin without `schoolId` gets 403 on every AS route and API.
  - **FR-AS-0-3** Seed/UAT data dates are relative to now (deterministic offsets, not fixed calendar dates), so 7/30-day windows and "this month" are never empty by accident (cause of AS-45, AS-46, AS-50 gaps).
  - **FR-AS-0-4** One read model per measure (section 5); no AS screen recomputes its own.
- **Acceptance criteria**
  - **AC-AS-0-1** Given the UAT account "Admin Sekolah UAT", when logging in, then Delivery A lands on `/admin-sekolah/command-center` and the user card shows the school name.
  - **AC-AS-0-2** Given a school-admin account whose `schoolId` is empty, when any AS route or API is requested, then 403 "Akses Ditolak" and no figure.

#### Field & behaviour spec — R1-AS-0 Preconditions

No screen and no form field (infrastructure: UAT account, seed data with dates relative to now). Nothing to add to the fields register; the screens that depend on it are specified in the modules that follow.

### R1-AS-A5 Log Keluar
- **Action: Keep**
- **Screen specification (from V2):** Not observed in V2 as a page (the logout control sits in the V2 admin header, no screen of its own) — follow FR-AS-A5-1. **Current gap:** None. Verify the ACs only.
- **Route** `/logout`. **Priority** P1. **Delivery** A. **Status** works.
- **Functional requirements**
  - **FR-AS-A5-1** "Log Keluar" is the last row of the account menu and of "Lagi"; one action ends the session.
  - **FR-AS-A5-2** Responsive: >= 44 px and reachable at 375 through "Lagi" and at 1280 through the avatar menu.
- **Acceptance criteria**
  - **AC-AS-A5-1** Given a logged-in school admin, when "Log Keluar" is used, then `/login` shows and back navigation does not restore the session.
  - **AC-AS-A5-2 (R)** Given a logged-in school admin, when opened at 375, 768 and 1280 px, then "Log Keluar" is reachable, >= 44 px, and scrollWidth <= innerWidth.

#### Field & behaviour spec — R1-AS-A5 Log Keluar

No form field. Behaviour as R1-GUR-A5: the session ends, the saved drafts of the browser session are deleted and the login page opens.

**Requirements added by this spec**
- **FR-AS-A5-3** Logging out deletes every saved form draft of the session before the login page opens.
- **AC-AS-A5-3** Given a saved draft under `pp.draft.*`, when the school admin logs out, then the key no longer exists and the login page shows.

### R1-AS-1 Command Center
- **Action: Fix**
- **Screen specification (from V2)** (authoritative; overrides the older L06 reading below wherever they differ)
  - **Screen A, Command Center.** Route `/admin/command-center` in V2 (V3: `/admin-sekolah/command-center`); title "Command Center - Admin Panel". Regions in order: (1) status strip; (2) four KPI tiles; (3) "📈 Aktiviti Hari Ini" beside "🤖 Wawasan"; (4) "⚡ Live Feed" beside "⭐ Top Pelajar Minggu Ini" and "💚 Mood Pelajar"; (5) "🔄 Pembetulan Soalan" beside "📊 Engagement (7 Hari)".
  - **Status strip:** "LIVE" dot; "Data dikemaskini setiap 10 saat"; clock "HH:MM:SS".
  - **KPI tiles (label / value / sub-line), in order:** "Sekolah Berdaftar" / 1 / "1 langganan aktif"; "Pelajar Berdaftar" / 864 / "15 pernah aktif menjawab"; "Soalan Dijawab" / 5,537 / "sepanjang masa"; "Ketepatan Purata" / 86.6% / "sekolah anda".
  - **"📈 Aktiviti Hari Ini":** "0" with "soalan dijawab hari ini"; "Minggu ini: 0"; link "Lihat Aktiviti Harian" (-> Screen B).
  - **"🤖 Wawasan":** "Wawasan AI tidak disambung" / "Panel ini memerlukan perkhidmatan luaran" (hidden in V3, D73).
  - **"⚡ Live Feed":** 15 rows, each with time "HH:MM", pupil name, subject name, and ✅ (correct) or ❌ (wrong).
  - **"⭐ Top Pelajar Minggu Ini":** ranked pupils; empty "Tiada aktiviti minggu ini."
  - **"💚 Mood Pelajar":** four rows "😄 Gembira", "🙂 Okay", "😔 Sedih", "😣 Tertekan", each with a count and a bar; footer "{n} check-in direkod" (observed 3, 7, 0, 3 and "13 check-in direkod").
  - **"🔄 Pembetulan Soalan":** two counters "Laporan Baru" (0) and "Selesai" (0).
  - **"📊 Engagement (7 Hari)":** seven bars with weekday labels and the value above a bar.
  - **Not on this screen:** there is **no Kirkpatrick panel, no "Top Sekolah" and no "Aktiviti Mengikut Sekolah"**.
  - **Screen B, Aktiviti Harian.** Route `/admin/command-center/daily-activity` in V2; title "Aktiviti Sekolah - Admin Panel". Regions in order: tab row; six cards; "📚 Aktiviti Mengikut Subjek"; "⏰ Heatmap Jam (Hari Ini)"; "⚡ Live Feed"; "⭐ Top Pelajar"; "💚 Mood Pelajar". Tabs: "📅 Hari Ini", "🗓️ Minggu Ini", "🗒️ Bulan Ini"; link "Command Center" (back to Screen A).
  - **Screen B cards (label / value / sub-line):** "🏫 Sekolah Aktif" / 0 / "daripada 1"; "🎓 Pelajar Aktif" / 0 / "Engagement 0%"; "📝 Soalan Dijawab" / 0 / "Ketepatan: 0%"; "🕐 Sesi Latihan" / 0 / "Purata ketepatan: 0%"; "🔥 Engagement" / 0% / "pelajar aktif / berdaftar"; "👤 Login Hari Ini" / "—" / "Penjejakan login belum direkod".
  - **Screen B panels:** "📚 Aktiviti Mengikut Subjek" (empty "Tiada aktiviti subjek dalam tempoh ini."); "⏰ Heatmap Jam (Hari Ini)" (24 hour cells, hour labels 00, 03, 06, 09, 12, 15, 18, 21; empty "Tiada aktiviti hari ini setakat kini."); "⚡ Live Feed" (as Screen A); "⭐ Top Pelajar" (empty "Tiada aktiviti dalam tempoh ini."); "💚 Mood Pelajar" (empty "Tiada check-in mood dalam tempoh ini.").
  - **States:** populated Screen A and empty Screen B observed; loading and error: Not observed in V2 — follow FR-AS-1-*.
  - **Corrections noted:** (1) the card "Sekolah Berdaftar" stays as V2 shows it (value 1; sub-line "{0|1} langganan aktif" = the school's active subscription), replacing the earlier "hide it" decision (V3 showed 0, wrong); (2) the Kirkpatrick panel of the L06 text is dropped (not in V2); (3) mood labels are V2's "Okay", "Sedih", "Tertekan" (V1 had "OK", "Tekanan"); (4) V2 prints English weekday abbreviations on the Engagement bars ("Wed", "Thu" …): defect, V3 prints BM "Isn, Sel, Rab, Kha, Jum, Sab, Aha" ([PRINCIPLE]); (5) V2 prints "Ketepatan: 0%" with 0 answers, V3 prints "—" (XS-5).
#### Field & behaviour spec — R1-AS-1 Command Center and Aktiviti Harian

Routes Command Center and "Aktiviti Harian". API: API-AS-02 (`live-data`), API-AS-03 (daily activity, `date?`). No form field.

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Period tabs | tabs | No | "📅 Hari Ini" | "📅 Hari Ini", "🗓️ Minggu Ini", "🗒️ Bulan Ini"; query `period` = `hari`, `minggu`, `bulan` | none | none | query string | API-AS-03 |
| Command Center / Lihat Aktiviti Harian | links | n/a | n/a | navigation between the two pages | none | none | n/a | none |
| Top Pelajar Minggu Ini / Top Pelajar | list | n/a | n/a | top 5 pupils by answers in the window; ties by accuracy descending, then name | none | none | computed | API-AS-02 |
| ⚡ Live Feed | list | n/a | n/a | latest 15 answer rows of the school: HH:MM, pupil, subject, ✅ or ❌ | none | none | computed | API-AS-02 |
| 💚 Mood Pelajar | counters | n/a | n/a | check-ins over the window by "😄 Gembira", "🙂 Okay", "😔 Sedih", "😣 Tertekan"; footer "{n} check-in direkod" | none | none | computed | API-AS-02 |
| 📊 Engagement (7 Hari) | 7 bars | n/a | n/a | answers per day, labels "Isn, Sel, Rab, Kha, Jum, Sab, Aha" (Monday first) | none | none | computed | API-AS-02 |
| 🔄 Pembetulan Soalan | counters | n/a | n/a | "Laporan Baru" = question reports with status open; "Selesai" = resolved | none | none | computed | API-AS-02 |
| Hour heat | 24 cells | n/a | n/a | answers per hour of today (MYT), labels 00, 03, ... 21 | none | none | computed | API-AS-03 |

- The board polls `live-data` every 10 s; a failed poll keeps the old values silently (GLB-2). In Aktiviti Harian "Sekolah Aktif" reads "daripada 1" and "Login Hari Ini" = pupils with `last_login_at` today (MYT), "—" when no login is recorded. The other cards follow the Screen specification.

**Requirements added by this spec**
- **FR-AS-1-7** The period tabs, the Top Pelajar ordering, the Live Feed size and the mood and engagement definitions of this subsection apply.
- **AC-AS-1-8** Given pupils A and B with 10 answers each and accuracy 80% and 90%, when Top Pelajar opens, then B is listed before A; the Live Feed never lists more than 15 rows.

- **Current gap (change the existing code only):** (a) the "Sekolah Berdaftar" tile shows 0 and the sub-line "langganan aktif" without a number: make it 1 and "{n} langganan aktif" (`src/modules/m17-admin-dashboard/components/command-center-board/BoardKpis.vue:31`); (b) remove any Kirkpatrick panel from the AS board; (c) "Pelajar Berdaftar" shows 16 against 17 on Senarai Pelajar: read XS-1 from the M02 query instead of the M27/M17 read model (`m27-school-admin/mock/read-models/*`, to be confirmed); (d) BM weekday labels on Engagement; (e) "—" for accuracy with no answers.
- **Name** "Command Center" (+ "Aktiviti Harian"). **Route** `/admin-sekolah/command-center`, `…/daily-activity`, drills `…/school/:id`, `…/classroom/:id`, `…/student/:id`. **Matrix** 1. **Priority** P1. **Delivery** A. **Status** GH built with Aktiviti Harian; shows the platform card "Sekolah Berdaftar 0 / langganan aktif" and "Pelajar Berdaftar 16" versus 17 on Senarai Pelajar. UAT not tested (no account).
- **Reference [V2] `admin/command-center` scoped by `PlatformMetrics::forSchool()`; spec L06 (D-L06-01..09)**: sub-line "Pemantauan langsung sekolah anda"; LIVE strip "Data dikemaskini setiap 10 saat" + clock; KPIs "Pelajar Berdaftar" ("{n} pernah aktif menjawab"), "Soalan Dijawab" ("sepanjang masa"), "Ketepatan Purata" ("sekolah anda"); card "Sekolah Berdaftar" is shown (see the V2 screen facts above); "🏆 Top Sekolah" and "Aktiviti Mengikut Sekolah" removed. Panels: "📈 Aktiviti Hari Ini" ("{n} soalan dijawab hari ini", "Minggu ini: {n}", link "Lihat Aktiviti Harian"), "⚡ Live Feed" (empty "Tiada aktiviti terkini."), "⭐ Top Pelajar Minggu Ini" (empty "Tiada aktiviti minggu ini."), "💚 Mood Pelajar" (empty "Tiada check-in mood lagi."), "🔄 Pembetulan Soalan" (zeros), "📊 Engagement (7 Hari)" (the school's daily answers); no Kirkpatrick panel (V2 has none); ALESA hidden (D73). Aktiviti Harian: title "Aktiviti Sekolah", subtitle "Ringkasan aktiviti — {Hari Ini|Minggu Ini|Bulan Ini}", tabs "📅 Hari Ini", "🗓️ Minggu Ini", "🗒️ Bulan Ini", back link "Command Center", cards "Sekolah Aktif" ("daripada 1"), "Pelajar Aktif", "Soalan Dijawab", "Sesi Latihan", "Engagement", subject and hour-heat cards.
- **Functional requirements**
  - **FR-AS-1-1** Every figure is confined to the own school; poll `live-data` every 10 s; a client school id is ignored.
  - **FR-AS-1-2** "Pelajar Berdaftar" = XS-1, "aktif menjawab" = XS-2, "Soalan Dijawab" = XS-4 (all time), "Ketepatan Purata" = XS-5; they equal the same fields on Senarai Pelajar, Prestasi, Analisa Item and Statistik Penggunaan for the same window (fixes 16 vs 17 and 30 vs 122 vs 36).
  - **FR-AS-1-3** The card "Sekolah Berdaftar" shows 1 with the sub-line "{n} langganan aktif" (n = 1 when the school has an active subscription, else 0); "Top Sekolah", "Aktiviti Mengikut Sekolah" and any Kirkpatrick panel are not rendered; the Engagement bars use BM weekday labels.
  - **FR-AS-1-4** Drills open only for own-school ids; others 404.
  - **FR-AS-1-5** No data renders zeros and the empty copy, never an error.
  - **FR-AS-1-6** Responsive: KPI tiles 2 columns at 375; panels stack in one column and reflow without a hole; Live Feed and Top Pelajar scroll inside their cards; the hour-heat table RP-TABLE-WIDE; the Aktiviti Harian tabs full width and >= 44 px.
- **Data** Owner M17 over M02, M05, M12, M14. API `GET /api/admin/command-center/live-data` admitting `school_admin` with forced scope.
- **Acceptance criteria**
  - **AC-AS-1-1** Given a school with 17 pupils, when the board opens, then "Pelajar Berdaftar" = 17 and equals the count on Senarai Pelajar.
  - **AC-AS-1-2** Given school B has pupil "Murid B1" with answers, when school A's admin opens the board and the poll runs, then no name or school of B appears.
  - **AC-AS-1-3** Given the platform admin, when `/admin-sekolah/command-center` is opened, then 403 "Akses Ditolak".
  - **AC-AS-1-4** Given a school with an active subscription, when the board opens, then the card "Sekolah Berdaftar" shows 1 with "1 langganan aktif" (and "0 langganan aktif" without a subscription), and no card or text "Top Sekolah" exists.
  - **AC-AS-1-5** Given a pupil answers one question, when the next poll runs (<= 10 s), then "Soalan Dijawab" rises by 1.
  - **AC-AS-1-6 (R)** Given the board with data, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth, KPI tiles are 2 columns at 375, no empty hole remains where Top Sekolah was, and the Aktiviti Harian tabs are visible and >= 44 px.
  - **AC-AS-1-7 (U)** Given "Admin Sekolah UAT", when the board opens, then "Pelajar Berdaftar" and "Soalan Dijawab" equal the Senarai Pelajar count and the all-time Statistik Penggunaan figure of the same school.
- **Deviations** DV-AS-1-1 Kirkpatrick panel dropped and "Sekolah Berdaftar" corrected to V2; DV-AS-1-2 "—" instead of "0%" with no answers; DV-AS-1-3 BM weekday labels. **Open** none.

### R1-AS-3 Headcount
- **Action: Fix**
- **Screen specification (from V2):** V2 has no screen. The V2 route `/headcount` answers **HTTP 403 "Forbidden"** for the school-admin account (observed). V2 therefore has **no** Headcount screen for a school admin; this module is V1 (M08 S12-S23) plus [PRINCIPLE] (read-only school view). Do not replicate the V2 403.
#### Field & behaviour spec — R1-AS-3 Headcount (read-only)

Routes as R1-GUR-3. API: API-AS-15 (school scope through `classrooms.school_id`) and the read endpoints of API-RPT-09. The screens are read-only copies of R1-GUR-3.

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Tapis: | chips | No | "Semua ({n})" | then "Tingkatan n ({n})" per Tingkatan present; no filter select exists | none | none | query string | API-AS-15 |
| Susun: | toggle | No | "Ranking" | "Ranking", "A-Z" as R1-GUR-3 | none | none | query string | API-AS-15 |
| Guru column | read-only | n/a | n/a | the list and the dashboard add the teacher name beside class and subject | none | none | `headcount_configs.teacher_id` | API-AS-15 |

- Controls absent: "Buat Baru", "Auto-Setup", "Key-in AR", "Edit TOV/ETR", "Tetapan", "Reset Data", "Padam", "Gugurkan", "Kembalikan", "Simpan Sasaran". Every write endpoint answers 403 for `school_admin` (ERR-ACC-01). Calculations as HC-SPEC in R1-GUR-3. "{n} entri headcount" is the count of this list.

**Requirements added by this spec**
- **FR-AS-3-7** The school admin sees the headcounts of all classes of the school with the "Guru" column and no write control; every write endpoint refuses `school_admin`.
- **AC-AS-3-7** Given a school with 3 headcount configs of 2 teachers, when the school admin opens Headcount, then 3 entries list with the teacher name, no write button shows, and a direct write request answers 403.

- **Current gap (change the existing code only):** `apps/api/src/modules/reports/performance/headcount/headcount.service.ts:114,121` and `src/modules/m08-student-performance/mock/handlers/headcount.ts:105-113` list only the viewer's own configs: for `school_admin` return the configs of the school's classes (detail access already allows it, `mayUse` lines 50-61); hide or refuse the write actions for `school_admin` in the pages and the controller roles (`headcount.controllers.ts:62-138`); add the "Guru" column.
- **Route** `/headcount` (+ `/headcount/dashboard`, `/:id`, `/:id/summary`, `/:id/export`, `/student/:id`). **Matrix** 3. **Priority** **P0**. **Delivery** A. **Status** GH: "Belum ada headcount." although Dashboard Sekolah says "10 entri headcount" and Prestasi "berdasarkan 10 entri". UAT not tested.
- **Root cause** the list and dashboard read only the viewer's own configs for every role: `apps/api/src/modules/reports/performance/headcount/headcount.service.ts:114,121` (`configsOfTeacher(ctx.userId)`) and the mock `m08-student-performance/mock/handlers/headcount.ts:105-113`; detail access already allows the school (`mayUse`, lines 50-61).
- **Reference [V1] M08 S12-S23; school-level reading from the V1 "Dashboard Sekolah" GPS card**: the screens, model and rules of GUR-3, with data = every config of classes of the school, **read-only** [PRINCIPLE]: no "Buat Baru", "Auto-Setup", "Key-in AR", "Edit TOV/ETR", "Tetapan", "Reset Data", "Padam", "Gugurkan"/"Kembalikan" (configs belong to teachers); a column/line "Guru" next to class and subject; "Unjuran", "Ringkasan Kelas", "Export CSV" and the pupil page stay.
- **Functional requirements**
  - **FR-AS-3-1** List and dashboard show all configs of the school's classes, each with its teacher.
  - **FR-AS-3-2** The entry count equals the "{n} entri headcount" of Prestasi (AS-4) and of the Dashboard (AS-2).
  - **FR-AS-3-3** TOV, ETR, OTR, AR (all modes), grade, On Track / Below, Unjuran and Keyakinan are the GUR-3 computation spec (HC-SPEC, HC-1..HC-6) read-only; this module defines no rule of its own.
  - **FR-AS-3-4** Detail, summary, export and pupil pages open for configs of the school; another school's id = 404.
  - **FR-AS-3-5** Write actions are absent from the page and refused by the API (403).
  - **FR-AS-3-6** Responsive as FR-GUR-3-7.
- **Data** M08; fed by teachers' headcount (GUR-3).
- **Acceptance criteria**
  - **AC-AS-3-1** Given 10 configs of the school's classes owned by 2 teachers, when Headcount opens, then 10 cards show with the teacher names and Prestasi says "10 entri headcount".
  - **AC-AS-3-2** Given a config id of another school, when opened, then 404.
  - **AC-AS-3-3** Given the page, then no "Buat Baru", "Auto-Setup" or "Padam" control exists and `POST /api/headcounts` returns 403 for the school admin.
  - **AC-AS-3-4 (R)** Given a config with 15 pupils, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth, the pupil table scrolls inside its card with "Nama" sticky, and "Ringkasan Kelas" and "Export CSV" are visible and >= 44 px.
  - **AC-AS-3-6** Given a teacher's Auto config with TOV 40, ETR 80, n = 3 and a pupil with AR 60, when the school admin opens the pupil row, then OTR 53 / 66 / 80, Jurang +40 and status "Below" show, identical to the teacher's and the pupil's views.
  - **AC-AS-3-5 (U)** Given "Admin Sekolah UAT" at a school whose teachers have headcount configs, when Headcount opens, then the card count equals the sum of those teachers' configs.
- **Deviations** DV-AS-3-1 read-only. **Open** none (decided as OQ-AS-3, section 6.2).

### R1-AS-4 Prestasi
- **Action: Fix** (built; numbers inconsistent)
- **Screen specification (from V2):** V2 has no screen. The V2 route `/prestasi` **redirects to `/admin`** (the platform-question dashboard) for the school admin. V2 has **no** school Prestasi screen; this module is V1 (M08 S1-S5) with the V3 build as the base. Do not copy the V2 redirect.
#### Field & behaviour spec — R1-AS-4 Prestasi

Routes `/prestasi/sekolah`, `/prestasi/tingkatan`, `/prestasi/kelas`. API: API-RPT-02. No form field.

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Pills "Tingkatan" / "Kelas" | pills | No | n/a | "Tingkatan" opens `/prestasi/tingkatan`; "Kelas" opens `/prestasi/kelas` | none | none | n/a | API-RPT-02 |
| Tingkatan chips | links | n/a | n/a | `t1` to `t5` for each Tingkatan that has classes, label "Tingkatan n" | none | none | route | API-RPT-02 |
| GPS band | computed | n/a | n/a | GPS rounded to 2 decimals: at most 2.00 "Cemerlang", at most 4.00 "Baik", at most 6.00 "Sederhana", otherwise "Perlu Perhatian" | none | OPT-GRED | computed | API-RPT-02 |
| Taburan Gred (Anggaran) | bars | n/a | n/a | A+ to G with "Jumlah: {n} rekod" | none | OPT-GRED | computed | API-RPT-02 |
| Murid Terbaik | list | n/a | n/a | top 10 with at least 5 answers, accuracy descending, ties by answers | none | none | computed | API-RPT-02 |
| Murid Berisiko | list | n/a | n/a | accuracy below 50 or inactive, 10 rows, accuracy ascending | none | none | computed | API-RPT-02 |
| Perbandingan Kelas | list | n/a | accuracy descending | one row per class | none | none | computed | API-RPT-02 |

- Longer lists are paged 25 per page; percentages are capped at 100. Panel failure: ERR-SYS-01b.

**Requirements added by this spec**
- **FR-AS-4-7** The GPS bands, Murid Terbaik, Murid Berisiko and Perbandingan Kelas follow the thresholds and order of the table.
- **AC-AS-4-8** Given a school GPS of 4.001, when Prestasi opens, then the band reads "Sederhana"; with 4.00 it reads "Baik".

- **Current gap (change the existing code only):** the "Guru" card counts 4 against 3 on Senarai Guru (`apps/api/src/modules/reports/performance/services/school-performance.service.ts`: use XS-3); "Murid"/"Soalan Dijawab"/"Purata Ketepatan" must read the XS-1/XS-4/XS-5 queries; GPS band wording one rule; percentages capped at 100; "{n} entri headcount" equals the AS-3 list count; Tingkatan page for all levels that have classes (not only 4 and 5).
- **Route** `/prestasi` -> `/prestasi/sekolah` ("Dashboard Sekolah"), `/prestasi/tingkatan`, `/prestasi/tingkatan/t1..t5`, `/prestasi/kelas`, `/prestasi/kelas/:id`, `/prestasi/:userId`. **Matrix** 4. **Priority** P1. **Delivery** A. **Status** GH built (7 cards, GPS Anggaran, Taburan Gred, buttons "Tingkatan" and "Kelas"); UAT not tested.
- **Reference [V1] M08 S1-S3, S5**: header "Dashboard Sekolah" / "Ringkasan prestasi keseluruhan · {n} kelas · {n} murid"; pills "Tingkatan", "Kelas"; 7 cards "Murid", "Guru", "Kelas", "Subjek", "Sesi Latihan", "Soalan Dijawab", "Purata Ketepatan"; "📊 GPS Anggaran" ("Gred Purata Sekolah (lebih rendah = lebih baik)", "Berdasarkan {n} entri headcount", "* Anggaran dari markah OTR, bukan SPM sebenar"); "📈 Taburan Gred (Anggaran)" A+..G ("Jumlah: {n} rekod"); "📉 Trend GPS (5 Tahun)"; "📚 GPS Mengikut Subjek"; "🎓 Perbandingan Tingkatan"; "👩‍🏫 Prestasi Guru"; "🔗 Navigasi Pantas". Tingkatan page: cards Kelas, Murid, Purata Ketepatan, Jumlah Sesi, On Track, Below Target; "Headcount Keseluruhan"; "Perbandingan Kelas"; "Murid Terbaik"; "Murid Berisiko". V1 "Murid Terbaik" above 100% (D-8) and link `/prestasi?{id}` (D-5) are fixed. GPS = mean grade point of the school's headcount entries (A+ 0 … G 9); band by GPS: <= 2 "Cemerlang", <= 4 "Baik", <= 6 "Sederhana", else "Perlu Perhatian" (V1's badge contradicted its tooltip, D-22: one rule everywhere). Levels: all Tingkatan 1-5 that have classes (D101; V1 had T4/T5 only).
- **Functional requirements**
  - **FR-AS-4-1** Cards: "Murid" XS-1, "Guru" XS-3, "Kelas" = AS-53 count, "Soalan Dijawab" XS-4, "Purata Ketepatan" XS-5.
  - **FR-AS-4-2** Tingkatan and class drills for the own school; pupil links open Prestasi 360 for own-school pupils only; "On Track"/"Below" follow HC-4 (GUR-3).
  - **FR-AS-4-6** All figures count answers of all modes from `practice_answers` (XS-8), including Bijak sittings, Set Soalan Guru and games.
  - **FR-AS-4-3** GPS bands as above; "{n} entri headcount" equals the Headcount list count (AS-3).
  - **FR-AS-4-4** Percentages are capped at 100.
  - **FR-AS-4-5** Responsive: the 7 cards 2 columns at 375 (4 at 768, 7 at 1280); grade bars full width with value text; Trend GPS chart RP-CHART with the table RP-TABLE-WIDE; "Prestasi Guru" list scrolls in its box (RP-TABLE-LIST); class comparison RP-TABLE-WIDE paginated 25.
- **Data** M08 `/api/performance/school|levels|classes`.
- **Acceptance criteria**
  - **AC-AS-4-1** Given a school with 3 teachers and 17 pupils, when Dashboard Sekolah opens, then "Guru" = 3 and "Murid" = 17, equal to Senarai Guru and Senarai Pelajar.
  - **AC-AS-4-2** Given GPS 3.30, then the band reads "Baik" (<= 4) on the card and in the chart tooltip.
  - **AC-AS-4-3** Given a pupil with 3 correct of 3, when "Murid Terbaik" renders, then 100% and no value above 100%.
  - **AC-AS-4-4** Given a pupil of another school by id, when `/prestasi/{id}` is opened, then 404.
  - **AC-AS-4-5 (R)** Given the school page with data, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth, the 7 cards are 2 columns at 375, the GPS chart fits its card, and the buttons "Tingkatan" and "Kelas" are visible and >= 44 px.
  - **AC-AS-4-7** Given the pupil of AC-GUR-4-6 (10 Latih Tubi answers with 7 correct, one Bijak sitting of 40 with 30 correct), when the school page counts answers, then that pupil adds 50 to "Soalan Dijawab" and 37 correct to Purata Ketepatan, the same as the teacher's Prestasi.
  - **AC-AS-4-6 (U)** Given "Admin Sekolah UAT" with 10 headcount entries, when the page opens, then "Berdasarkan 10 entri headcount" and the Headcount list shows 10 configs.
- **Gap** none functional; numbers inconsistent (section 5). **Deviations** DV-AS-4-1 teacher count; DV-AS-4-2 GPS band wording. **Open** none.

### R1-AS-5 Analitik Adaptif
- **Action: Fix** (menu opens the wrong page; the page exists but is refused to the role)
- **Screen specification (from V2):** V2 has no screen. The V2 route `/analitik/kelas` **redirects to `/admin`** for the school admin. V2 has **no** such screen for a school admin (the page is teacher-only); this module is [PRINCIPLE] = the V2 teacher page of R1-GUR-5 with the school as scope.
#### Field & behaviour spec — R1-AS-5 Analitik Adaptif

Same page and fields as R1-GUR-5 (see its Field & behaviour spec), school scope: API-AS-16. The "Kelas" select lists all classes of the school sorted by Tingkatan then name; "Rekod Intervensi" is hidden (OQ-AS-5); "Lihat Analitik" opens `/prestasi/:userId` of a pupil of the school (another school answers 404, ERR-ACC-02).

**Requirements added by this spec**
- **FR-AS-5-7** The school-admin page uses the filters, sort, paging and Trend and Risiko rules of R1-GUR-5 over the pupils of the school.
- **AC-AS-5-6** Given a school pupil with accuracy 30% and one of another school with 20%, when the Risiko filter is "Kritikal", then only the school pupil lists, without a "Rekod Intervensi" action.

- **Current gap (change the existing code only):** `src/shells/nav/user-nav.ts:398` points the item to `/analitik/pelajar` (change to `/analitik/kelas`); `src/modules/m08-student-performance/routes/class.ts:33` allows only `admin`, `teacher` (add `school_admin`); API `apps/api/src/modules/reports/performance/http/performance.controllers.ts:54` (`GET /api/analytics/classes`) must accept `school_admin` with the forced school; add the "Kelas" column; hide "Rekod Intervensi".
- **Route** `/analitik/kelas` (title "Analitik Kelas"). **Matrix** 5. **Priority** **P0**. **Delivery** A. **Status** GH: the sidebar opens `/analitik/pelajar` (pupil page, empty "Topik Perlu Perhatian Utama (0)", `user-nav.ts:398`); `/analitik/kelas` is restricted to `admin`, `teacher` (`m08/routes/class.ts:33`). No analytics for the school admin.
- **Reference**: V2 has none for the school admin (`admin/analytics` national-only; `/analitik/kelas` is `role:guru`, `web.php:1760`); [V1] label only. **[PRINCIPLE]** the V2 teacher page "Analitik Kelas" with the school as scope.
- **Functional requirements**
  - **FR-AS-5-1** The sidebar item opens `/analitik/kelas`.
  - **FR-AS-5-2** Intro, filters, cards, table and rules as FR-GUR-5-2..5; "Kelas" = "Semua Kelas" of the school plus each class; an extra table column "Kelas".
  - **FR-AS-5-3** "Rekod Intervensi" is not shown (OQ-AS-5).
  - **FR-AS-5-4** The API admits `school_admin` with the forced school.
  - **FR-AS-5-5** Responsive as FR-GUR-5-6.
  - **FR-AS-5-6** Counts include all modes (FR-GUR-5-7, XS-8); accuracy is pooled (XS-5).
- **Data** M08 `/api/analytics/classes`.
- **Acceptance criteria**
  - **AC-AS-5-1** Given a school admin, when "Analitik Adaptif" is clicked, then "Analitik Kelas" opens and "Kelas" lists only classes of the school.
  - **AC-AS-5-2** Given 17 pupils in the school, when "Semua Kelas" is selected, then "Jumlah Pelajar" = 17 (XS-1).
  - **AC-AS-5-3** Given the page, then no "Rekod Intervensi" button exists.
  - **AC-AS-5-4 (R)** Given 17 pupils, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth, pupil rows are cards at 375/768, and the filters and "Lihat Analitik" are visible and >= 44 px.
  - **AC-AS-5-5 (U)** Given "Admin Sekolah UAT", when "Semua Kelas" is selected, then "Jumlah Pelajar" equals the Senarai Pelajar count of pupils enrolled in a class.
- **Deviations** DV-AS-5-1 added for the AS role. **Open** none (decided as OQ-AS-5, section 6.2).

### R1-AS-6 Analisa Item
- **Action: Fix** (built; counters disagree)
- **Screen specification (from V2):** V2 has no screen. The V2 route `/analisa-item` **redirects to `/admin`** for the school admin. V2 has **no** Analisa Item screen for a school admin (V2's class page is teacher-only); this module is V1 (M08 S9) plus the R1-GUR-6 tables.
#### Field & behaviour spec — R1-AS-6 Analisa Item

Routes `/analisa-item` (to `/analisa-item/sekolah`). API: API-AS-17, API-RPT-06. The class page and the Diskriminasi rules are those of R1-GUR-6.

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Tingkatan: | chips | No | "Semua" | then "Tingkatan n" for each Tingkatan with data; query `tingkatan` = `T1` to `T5` | none | none | query string | API-AS-17 |
| Cari soalan..., sort select, tabs | as R1-GUR-6 | No | as R1-GUR-6 | search "Cari soalan...", sort "Paling Sukar Dahulu" default, tabs "Indeks Kesukaran" / "Indeks Diskriminasi" | "Taip sekurang-kurangnya 2 aksara." | none | query string | API-AS-17 |

- School card: "{n} Pelajar", "{n} Jawapan". Empty: "Tiada Data Pelajar" / "Tiada data pelajar untuk sekolah ini. Pastikan pelajar telah berdaftar dan menjawab soalan latihan."

**Requirements added by this spec**
- **FR-AS-6-6** The school page filters by Tingkatan chips and offers the search, sort and tabs of R1-GUR-6; the school card counts equal XS-1 and XS-4.
- **AC-AS-6-6** Given a school with data only in Tingkatan 4 and 5, when the page opens, then the chips are "Semua", "Tingkatan 4", "Tingkatan 5".

- **Current gap (change the existing code only):** the page shows 16 pupils / 36 answers / 33.3% while the Dashboard says 122 answers / 57.9%: read XS-1/XS-4/XS-5 from the shared queries (`apps/api/src/modules/reports/performance/services/item-analysis.service.ts` school scope versus the M27 read model); Tingkatan chips for T1 to T5 that have data; Tahap rule of R1-GUR-6 (DV-GUR-6-1).
- **Route** `/analisa-item` (-> `/analisa-item/sekolah`). **Matrix** 6. **Priority** P1. **Delivery** A. **Status** GH built "Analisa Item Sekolah" (chips "Semua"/"Tingkatan 4"/"Tingkatan 5", Profil Kesukaran, GPS Anggaran, Trend GPS) with 16 pupils, 36 answers, 33.3% versus Dashboard 122 questions, 57.9%.
- **Reference [V1] M08 S9**: breadcrumb "Papan Pemuka" > "Analisa Item Sekolah"; school card (name, type pill, "PPD {ppd} • {negeri}", "{n} Pelajar", "{n} Jawapan"); "Tingkatan:" chips `?tingkatan=T1..T5` (D101); empty "Tiada Data Pelajar" / "Tiada data pelajar untuk sekolah ini. Pastikan pelajar telah berdaftar dan menjawab soalan latihan."; populated view = the class tables of GUR-6 over the whole school.
- **Functional requirements**
  - **FR-AS-6-1** "Pelajar" = XS-1 and "Jawapan" = XS-4 for the chip scope; "Semua" equals the Command Center and Prestasi all-time figures.
  - **FR-AS-6-2** Tabs, Tahap rule, search and sort as GUR-6 (DV-GUR-6-1).
  - **FR-AS-6-3** Pupil names only for own-school pupils.
  - **FR-AS-6-4** Responsive as FR-GUR-6-7.
  - **FR-AS-6-5** "Soalan Diuji" = XS-7 (distinct questions) and the counters include all modes (FR-GUR-6-8, XS-8).
- **Data** M08 `/api/item-analysis/school`.
- **Acceptance criteria**
  - **AC-AS-6-1** Given "Semua", when the page opens, then "Jawapan" equals the all-time "Soalan Dijawab" of the Command Center and "Pelajar" equals Senarai Pelajar.
  - **AC-AS-6-2** Given chip "Tingkatan 4", then "Pelajar" equals the count of Tingkatan 4 pupils on Senarai Pelajar.
  - **AC-AS-6-3 (R)** Given a school with 200 tested questions, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth, the table scrolls inside its card (25 rows per page), and the Tingkatan chips are visible and >= 44 px.
  - **AC-AS-6-5** Given the data of AC-GUR-6-8 and AC-GUR-6-9 for pupils of the school, then the school page shows the same Soalan Diuji and Percubaan values as the class page.
  - **AC-AS-6-4 (U)** Given "Admin Sekolah UAT", when the page opens, then "Soalan Diuji" > 0 and the tier counts sum to it.
- **Gap** counters from another read model. **Open** none.

### R1-AS-7 Video
- **Action: Keep**
- **Screen specification (from V2):** Not observed in V2 for the school admin (the `/video` page was not observed for this role) — follow FR-AS-7-*; the rule "read-only, no upload" comes from the V2 portal requirements (KK-12) and is [PRINCIPLE]. **Current gap:** None. Verify the ACs only (in particular that no "Tambah Video" control is shown to the school admin).
- **Route** `/video`. **Matrix** 7. **Priority** P2. **Delivery** A. **Status** built.
- **Reference [V2]** read-only view for the school admin ("Video Sekolah", KK-12 in v2-portals); no upload.
- **Functional requirements**
  - **FR-AS-7-1** List and categories; no "Tambah Video".
  - **FR-AS-7-2** Responsive as FR-GUR-7-3.
- **Acceptance criteria**
  - **AC-AS-7-1** Given videos in 2 categories, when a category is chosen, then only its videos show and no "Tambah Video" button exists.
  - **AC-AS-7-2 (R)** Given 3 videos, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth, cards are 1 column at 375, and the category tabs are visible and >= 44 px.
  - **AC-AS-7-3 (U)** Given migrated videos, when "Admin Sekolah UAT" opens `/video`, then the count equals the Admin Pusat Video list for the same categories.
- **Gap** none.

#### Field & behaviour spec — R1-AS-7 Video

Same list, category tabs and player as R1-GUR-7 (see its Field & behaviour spec). The button "Tambah Video" and the form are absent for `school_admin`; a create request answers 403 (ERR-ACC-01). The school admin sees global videos and the videos of the own school.

**Requirements added by this spec**
- **FR-AS-7-3** The school admin cannot add a video: no button, no form, and the create endpoint refuses the role.
- **AC-AS-7-4** Given the school admin opens Video, then no "Tambah Video" control shows; a direct create request answers 403.

### R1-AS-10 Monitoring
- **Action: Fix**
- **Screen specification (from V2)** (authoritative)
  - **Route / title:** `/admin/monitoring` in V2 (V3: `/admin-sekolah/monitoring`); title "Monitoring Penglibatan - Admin Panel".
  - **Regions in order:** (1) filter bar; (2) seven KPI cards; (3) card "Panduan Monitoring Penglibatan"; (4) "Tracking Mingguan"; (5) "Sekolah Terbaik"; (6) "Perhatian Segera"; (7) "Cadangan Tindakan"; (8) table "Analisis Penglibatan Pelajar"; (9) table "Analisis Penglibatan Guru".
  - **Filter bar:** "Tempoh" (select: "Semua Masa", "7 Hari", "30 Hari", "3 Bulan"); "Negeri" (select: "Semua Negeri", Johor, Kedah, Kelantan, Kuala Lumpur, Labuan, Melaka, Negeri Sembilan, Pahang, Perak, Perlis, Pulau Pinang, Putrajaya, Sabah, Sarawak, Selangor, Terengganu); buttons "Tapis" (applies) and "Reset" (clears). There is no "Tahap" filter and no PDF/CSV/Refresh row.
  - **KPI cards (label / value / sub-line), in order:** "Jumlah Sekolah" 1 "Berdaftar"; "Pelajar Berdaftar" 864 "15 pernah aktif"; "% Penglibatan" 1.7% "Min. 1 soalan dijawab"; "Soalan Dijawab" 5,537 "Purata 369.1/pelajar aktif"; "Guru Berdaftar" 174 "Akaun bertaraf guru"; "Guru Pernah Login" 2 "Sejak penjejakan log masuk dimulakan"; "% Penglibatan Guru" 1.1% "2 / 174 guru".
  - **Card "Panduan Monitoring Penglibatan":** "Penglibatan dikira sebagai pelajar yang pernah menjawab sekurang-kurangnya satu soalan, dibahagikan dengan pelajar berdaftar bagi sekolah itu. Tahap: Cemerlang ≥ 60%, Sederhana ≥ 20%, Rendah < 20%, Tiada = 0%."
  - **"Tracking Mingguan":** twelve bars labelled "M1" to "M12"; caption "Jumlah soalan dijawab setiap minggu (12 minggu terakhir)."
  - **"Sekolah Terbaik":** rows with rank, school name, "{p}%".
  - **"Perhatian Segera":** when none: "Setiap sekolah berdaftar mempunyai sekurang-kurangnya seorang pelajar aktif. 🎉"
  - **"Cadangan Tindakan":** list; empty (no copy shown).
  - **Table "Analisis Penglibatan Pelajar":** sub-title "Mengikut sekolah — disusun mengikut % penglibatan tertinggi"; badge "{n} sekolah"; columns "Sekolah", "Daftar", "Aktif", "Dijawab", "Penglibatan"; legend "Cemerlang >60%", "Sederhana 20-60%", "Rendah <20%", "Tiada 0%".
  - **Table "Analisis Penglibatan Guru":** columns "Sekolah", "Negeri", "Guru", "Pernah Login", "%"; note "\"Pernah Login\" dikira sejak penjejakan log masuk dimulakan."
  - **States:** populated (one school) observed; loading, error: Not observed in V2 — follow FR-AS-10-*.
  - **Corrections noted:** (1) V2 has 7 KPIs; V1's 9 (with "Pelajar T4/T5", "Pernah Aktif", "Purata/Pelajar") are replaced by V2's; no "T4/T5" label (D101); (2) four Tahap bands as V2's legend (Cemerlang > 60, Sederhana 20 to 60, Rendah > 0 and < 20, Tiada 0); V1's "Kritikal" band and "Tahap" filter are dropped; V2's guide sentence says "≥ 60%" while its legend says ">60%": V3 uses "> 60" in both (DV-AS-10-3); (3) 12 weeks, not 32; (4) V2 still shows "Negeri" to a school admin: V3 hides it (one school, DV-AS-10-2); (5) "Guru Pernah Login" (2) and Laporan "Cikgu Pernah Akses" (57) disagree in V2: V3 uses recorded last-login dates for both (XS-3). The school/pupil/teacher drill pages are not in the captures: use R1-GUR-10 (V1 text) with the school fixed.
#### Field & behaviour spec — R1-AS-10 Monitoring

Routes `/admin-sekolah/monitoring` and detail pages. API: API-RPT-12 (forced to the own school; `state` ignored).

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Tempoh | select | No | "Semua Masa" | OPT-TEMPOH: "Semua Masa", "7 Hari", "30 Hari", "3 Bulan" | none | none | query string | API-RPT-12 |
| Tapis | button | n/a | n/a | applies Tempoh | none | none | n/a | API-RPT-12 |
| Reset | button | n/a | n/a | resets Tempoh to "Semua Masa" | none | none | n/a | API-RPT-12 |

- No "Negeri" and no "Tahap" control (DV-AS-10-2). Table "Analisis Penglibatan Pelajar": sorted by Penglibatan descending, 25 per page, with 12 weekly columns "M1" to "M12". Tahap bands over Pernah Aktif ÷ Pelajar × 100 (whole %): Cemerlang above 60, Sederhana 20 to 60, Rendah above 0 and below 20, Tiada 0. Status "Aktif" = at least one answer.

**Requirements added by this spec**
- **FR-AS-10-6** The filter bar holds only Tempoh, "Tapis" and "Reset"; the table sort, paging and bands follow this subsection.
- **AC-AS-10-6** Given Tempoh "7 Hari" chosen, when "Reset" is pressed, then Tempoh reads "Semua Masa" and the list reloads over all time.

- **Current gap (change the existing code only):** the filter bar lists the whole country and has "Tahap" (`m11-teacher-analytics/routes/monitoring.ts:102` alias mount and the monitoring filter component): remove "Negeri" and "Tahap" for the school-admin mount; replace "Pelajar T4/T5" labels by "Pelajar" and drop the two extra KPI cards; limit "Tracking Mingguan" to 12 weeks; "Guru Berdaftar" 4 -> 3 (read XS-3); tables show the single school row.
- **Route** `/admin-sekolah/monitoring` (+ `/sekolah/:id`, `/pelajar/:id`, `/guru/:id`). **Matrix** 10. **Priority** P1. **Delivery** A. **Status** GH built; filters Negeri/Tahap list the whole country although the scope is one school; shows "13 pelajar T4/T5" and "4 guru" (vs 3 on Senarai Guru).
- **Reference:** the V2 screen facts above for the overview page; for the drill pages (school detail with pupil and teacher lists, pupil detail, teacher detail) the V1 text of R1-GUR-10 applies with the school fixed, under `/admin-sekolah/monitoring/...`, other schools 404. **No "T4/T5" in labels** (D101): "Pelajar" and "Analisis Penglibatan Pelajar" cover Tingkatan 1-5 (DV-AS-10-1).
- **Functional requirements**
  - **FR-AS-10-1** The overview follows the V2 screen facts (seven KPIs, filters "Tempoh" only plus "Reset", 12 weekly columns, four Tahap bands); the drill pages and defect fixes follow FR-GUR-10-3 and FR-GUR-10-4 with the school scope (V2's school detail page of GUR-10 is the page opened from the school row).
  - **FR-AS-10-2** "Guru Berdaftar" = XS-3 (equals Senarai Guru); "Pelajar" = XS-1; "Pernah Aktif" = XS-2; "Soalan Dijawab" = XS-4 within the period, labelled.
  - **FR-AS-10-3** Default period "Semua Masa".
  - **FR-AS-10-4** V1 defects fixed as in GUR-10 (Gap Analysis, "Jawapan Salah" paging, no CSRF in URL).
  - **FR-AS-10-5** Responsive as FR-GUR-10-7.
- **Data** M11 `/api/monitoring*` with forced scope.
- **Acceptance criteria**
  - **AC-AS-10-1** Given a school with 3 teachers and 17 pupils, when Monitoring opens, then "Guru Berdaftar" = 3 and "Pelajar" = 17, with no "T4/T5" text and no "Negeri" filter.
  - **AC-AS-10-2** Given answers only 3 days ago, when `Tempoh` = "7 Hari", then "Soalan Dijawab" counts only the last 7 days and the label states the period; "Semua Masa" is >= that value.
  - **AC-AS-10-3** Given a school detail of another school by id, when opened, then 404.
  - **AC-AS-10-4 (R)** Given a school with 184 pupils and 12 weeks of data, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth, every table scrolls inside its card with a sticky first column, KPI cards are 2 columns at 375, and "PDF", "CSV", "Tapis" are visible and >= 44 px.
  - **AC-AS-10-5 (U)** Given "Admin Sekolah UAT", when Monitoring opens, then "Pelajar", "Pernah Aktif" and "Guru Berdaftar" equal the same figures on Guru Monitoring (GUR-10) for the same school.
- **Deviations** DV-AS-10-1 labels without "T4/T5"; DV-AS-10-2 "Negeri" hidden; DV-AS-10-3 one ">60" threshold wording. **Open** none.

### R1-AS-11 Kirkpatrick
- **Action: Complete** (Ringkasan is built; the six other screens are missing)
- **Screen specification (from V2)** (authoritative). V2 routes: `/admin/kirkpatrick` (Ringkasan), its Tahap 1 page ("T1: Reaksi - Admin Panel") and Tahap 2 page ("T2: Pembelajaran - Admin Panel"); the same tab links also appear at the foot of the Laporan Eksekutif page. **Not observed in V2:** Tahap 3, Tahap 4, Rantaian Impak, Intervensi, pupil detail and the PDF — follow the Guru specification of R1-GUR-11 (same page layouts, school scope) and FR-AS-11-*. Regions, labels, cards and messages:
  - Ringkasan (title "Kirkpatrick - Admin Panel"): the filter card shows the school as a **locked read-only label** ("{nama sekolah}" and the line "{kod} · {PPD} · {negeri}") plus a "Negeri" select ("Semua Negeri") and "Tapis". Four level cards in this order with their exact text: "Tahap 4: Hasil" "4.39" "GPS Sekolah · 0 rekod headcount"; "Tahap 3: Tingkah Laku" "23/864" "Pelajar aktif · 508 sesi · 77.7% ketepatan"; "Tahap 2: Pembelajaran" "77.7%" "Ketepatan · 8,874 soalan dijawab"; "Tahap 1: Reaksi" "3.8/5" "Kepuasan purata · 13 respon"; each ends "Lihat detail". "Kirkpatrick Evaluation Flow" ("Klik mana-mana tahap untuk lihat detail"): T1 "Kepuasan pengguna" "3.8/5", T2 "Peningkatan kemahiran" "77.7% ketepatan", T3 "Konsistensi penggunaan" "23 pelajar aktif", T4 "Keputusan peperiksaan" "GPS 4.39". "Perbandingan Sebelum & Selepas" ("Januari 2026 vs November 2026"; panels "SEBELUM" "01 Jan 2026 - 31 Jan 2026" and "SELEPAS" "01 Nov 2026 - 03 Nov 2026" each with "Pelajar Aktif", "Ketepatan", "Jumlah Jawapan", "Champion"; four delta tiles "+1 Pelajar Aktif", "+30.0% Ketepatan", "+40 Jumlah Jawapan", "+0 Champion"; "Ringkasan:" "1 pelajar baru mula aktif berbanding Januari. Ketepatan jawapan meningkat 30.0%. Jumlah jawapan bertambah 40. 0 pelajar naik ke tahap Champion."). KPI row "Pelajar Berdaftar" 864, "Soalan Dijawab" 8,874, "Guru Aktif" "174/174", "Ketepatan Keseluruhan" 77.7%. "Taburan Engagement Pelajar": Champion 8 (0.9%), Konsisten 3 (0.3%), Berkembang 7 (0.8%), Minimum 5 (0.6%), Tidak Terlibat 841 (97.3%). Info card "Model Kirkpatrick — 4 Tahap Penilaian Keberkesanan": "Dashboard ini mengukur keberkesanan platform PrestasiPlus berdasarkan model Kirkpatrick (1959). Data Tahap 2 (Pembelajaran) dan Tahap 3 (Tingkah Laku) dijana secara automatik daripada aktiviti pelajar sebenar. Tahap 1 (Reaksi) menggunakan data mood check-in sebagai proksi kepuasan (data survey NPS penuh belum tersedia), dan Tahap 4 (Hasil) menggunakan ramalan GPS daripada ketepatan latihan (keputusan peperiksaan/head count sebenar belum tersedia)."
  - Tab strip on the sub-pages (V2): "Overview", "T1: Reaksi", "T2: Pembelajaran", "T3: Tingkah Laku", "T4: Hasil", "Intervensi" (V3 labels follow the 2026-10-31 rename: "Ringkasan", "Tahap 1: Reaksi" … and keeps "Rantaian Impak").
  - Tahap 1 page (title "T1: Reaksi - Admin Panel"): cards "NPS Pelajar" 9.0/10 "4 respons"; "NPS Guru" "—" "Tiada respons lagi"; "NPS Admin" "—" "Tiada respons lagi"; "Kepuasan Purata" 4.5/5 "4 respons". Section "Butiran Maklum Balas" ("— survei NPS (/maklum-balas)"): tiles "Jumlah Respons" 4, "Mudah Diguna" 4.8/5, "Relevan" 4.5/5, "Promoter (9–10)" 2, "Detractor (0–6)" 0, "Komen Bertulis" 1. Section "Taburan Mood" ("— proksi reaksi pelajar"): "Mood Positif" 77%, "Jumlah Check-in" 13, "7 Hari Lepas" 0 and a table "Mood / Bilangan / Peratus". Section "Komen Terkini": table "Komen / NPS / Kepuasan / Tarikh". (V1 had only the four cards: the V2 sections are added.)
  - Tahap 2 page (title "T2: Pembelajaran - Admin Panel"): six cards "Soalan Dijawab" 5,537, "Ketepatan" 86.6%, "Skor Purata" 77.7%, "Sesi Selesai" "508/508", "Kadar Penyelesaian" 100%, "Learning Gain" "-" "Perlu pre/post test"; box "Pre-Test / Post-Test belum dimulakan" ("Apabila ujian diagnostik dimulakan, Hake's Normalized Learning Gain akan dikira secara automatik." and "g = (Post - Pre) / (100 - Pre) · High: g≥0.7 · Medium: 0.3≤g<0.7 · Low: g<0.3"); "Prestasi Mengikut Subjek" rows "{subjek}", percentage bar, status "Mastered" (>= 80) or "Developing", "{n} soalan", sorted by accuracy descending; "Pembelajaran Mengikut Sekolah" table "# / Sekolah / Pelajar / Soalan / Ketepatan / Skor Purata / Subjek".
  - **Corrections noted:** (1) V2 shows a "Negeri" select to a school admin: V3 shows only the locked school label, no select; (2) V2 Ringkasan prints "Ketepatan" 77.7% and 8,874 answers while the Tahap 2 page prints 86.6% and 5,537: V2 mixes the session mean ("Skor Purata") with the pooled accuracy; V3 prints pooled accuracy (XS-5) under "Ketepatan" and keeps "Skor Purata" as the separately named mean of session scores (XS-5), and one answer count (XS-4); (3) Tahap 3 "23/864" differs from Command Center "15 pernah aktif": V3 uses XS-2 for both; (4) V2 prints "Mastered"/"Developing" in English: kept as V2 (V1 also had them).
#### Field & behaviour spec — R1-AS-11 Kirkpatrick

Same seven pages, forms, formulas and PDF export as R1-GUR-11 (see its Field & behaviour spec), with school scope (API-RPT-11). Differences are listed in the paragraph "R1-AS-11" there: a locked school label instead of a filter card, the Intervensi list reads all interventions of the school, the pupil select lists the active pupils of the school (name ascending), and a `student_id` of another school answers 404 (ERR-ACC-02). Additions: ADD-05, ADD-15.

**Requirements added by this spec**
- **FR-AS-11-6** The school admin records and reviews interventions with the fields, mapping and 7-day review rule of R1-GUR-11, for pupils of the own school only.
- **AC-AS-11-8** Given a `student_id` of another school, when the school admin records an intervention, then the request answers 404 and nothing is created.

- **Current gap (change the existing code only):** register the six missing school-admin routes by adding the school-admin mount to the existing route fragments `m12-kirkpatrick/routes/{reaction,learning,behavior,results,chain,interventions,pelajar}.ts` through `SCHOOL_ADMIN_MOUNT` (`routes/mount.ts:32-38`; also add it to the list of mounts that carry every screen, `mount.ts:41`); set `detailLinks: true` for the school-admin overview (`routes/overview.ts:39`, `pages/KirkpatrickOverviewPage.vue:5,37-38`) so "Lihat detail", the flow circles and the tab strip work; replace the school/state selects by the locked school label; allow `school_admin` with forced school on the M12 endpoints; add the V2 sections to the Tahap 1 page (Butiran Maklum Balas, Taburan Mood, Komen Terkini) if missing; `ALESA` stays hidden.
- **Route** `/admin-sekolah/kirkpatrick` (+ `/reaction`, `/learning`, `/behavior`, `/results`, `/chain`, `/interventions`, `/pelajar/:id`, `/export-pdf`). **Matrix** 11 (the row text lists all seven views). **Priority** **P0**. **Delivery** A. **Status** GH/live evidence: Ringkasan only; **clicking "Tahap 1" does nothing (dead control)**, `/admin-sekolah/kirkpatrick/reaction` returns **404 (the route is not registered, not 403)**, and the filter shows "Semua Sekolah" / "Semua Negeri" to a school admin although the scope is one school. Causes: `m12-kirkpatrick/routes/mount.ts:32-38` ("S1 only", decision "G4 F6", now reversed by D108(5)), `routes/overview.ts:39` (`detailLinks: false`), `pages/KirkpatrickOverviewPage.vue:5,37-38`.
- **Decision (D108(5))** the school admin sees **all seven screens plus the PDF, scoped to the school** (V2 `nav_school_scoped`: `admin/kirkpatrick` "all 7 screens + export-pdf"; matrix row 11).
- **Reference:** the V2 screen facts above for Ringkasan, Tahap 1 and Tahap 2; for Tahap 3, Tahap 4, Rantaian Impak, Intervensi and the pupil detail the text of R1-GUR-11 (V1/V2) applies with the school scope; "…Mengikut Sekolah" tables show the one school; Intervensi: the school admin reads all interventions of the school and may record one for an active pupil of the school.
- **Label and scope definition identical to GUR-11** (D101 T1-T5): "Pelajar Berdaftar" = XS-1 over Tingkatan 1-5 of the school (no "(T4/T5)"); Tahap 3 "Pelajar aktif" = XS-2 all time; Tahap 2 "Soalan Dijawab" = XS-4 all time; "Ketepatan" = XS-5; only the scope differs (school versus class).
- **Functional requirements**
  - **FR-AS-11-1** All seven tabs and the PDF open for the school admin; "Lihat detail", the flow circles and the level cards link to their pages (no dead control); the routes `/admin-sekolah/kirkpatrick/*` exist.
  - **FR-AS-11-2** Scope forced to the own school; other pupil/school ids 404; the filter card shows the locked school label ("{nama sekolah}", "{kod} · {PPD} · {negeri}") and no "Sekolah" or "Negeri" select.
  - **FR-AS-11-3** Same formulas, DV-GUR-11-2..4 fixes, no ALESA (D73).
  - **FR-AS-11-4** Figures equal the XS rules and Monitoring: Tahap 3 "Pelajar aktif" equals Monitoring "Pernah Aktif"; Tahap 2 "Soalan Dijawab" equals Monitoring "Soalan Dijawab" (all time); "Pelajar Berdaftar" equals Senarai Pelajar.
  - **FR-AS-11-5** Layout is the AS shell; Responsive as FR-GUR-11-10.
- **Data** M12 endpoints with forced scope.
- **Acceptance criteria**
  - **AC-AS-11-1** Given a school admin, when "Tahap 1: Reaksi" is clicked in the tab strip and on the level card, then `/admin-sekolah/kirkpatrick/reaction` opens (200) with the Tahap 1 cards; likewise for Tahap 2, 3, 4, Rantaian Impak and Intervensi.
  - **AC-AS-11-2** Given school A with pupils who answered and school B with different data, when A's admin opens any of the seven tabs, then every figure and every school/pupil name belongs to A only, no school selector exists, and `/admin-sekolah/kirkpatrick/pelajar/{id of a B pupil}` returns 404.
  - **AC-AS-11-3** Given the school has 17 pupils of whom 12 have answered, then Ringkasan "Pelajar Berdaftar" = 17, Tahap 3 "Pelajar aktif" = 12, equal to Senarai Pelajar and Monitoring "Pernah Aktif".
  - **AC-AS-11-4** Given "Muat Turun Laporan" on Rantaian Impak, when pressed, then a PDF for the school downloads.
  - **AC-AS-11-5** Given an intervention recorded for a pupil of the school, when Intervensi opens, then it is listed and `student_id` of another school is refused.
  - **AC-AS-11-6 (R)** Given a school with 50 pupils, when each tab opens at 375, 768 and 1280 px, then scrollWidth <= innerWidth, the seven tabs are reachable by scrolling inside the tab row and are >= 44 px, level cards are 1 column at 375, and the tables scroll inside their cards.
  - **AC-AS-11-7 (U)** Given "Admin Sekolah UAT", when Ringkasan and Tahap 3 open, then "Pelajar Berdaftar" and "Pelajar aktif" equal the Senarai Pelajar count and the Monitoring "Pernah Aktif" of the same school.
- **Deviations** DV-AS-11-1 all seven screens (reverses "G4 F6"); DV-AS-11-2 labels without "T4/T5". **Open** none (OQ-AS-4 closed by D108(5)).

### R1-AS-45 Sekolah Bersaing
- **Action: Fix** (data source and columns; the page and route already exist)
- **Screen specification (from V2)** (authoritative; V2 is primary and replaces the V1 weekly board)
  - **Route / title:** `/sekolah-bersaing` in V2 (V3: `/admin-sekolah/sekolah-bersaing`); title "Sekolah Bersaing — PRESTASIPLUS".
  - **Regions in order:** (1) hero; (2) ranking table.
  - **Hero:** 🏆, small label "Papan Pemimpin", heading "Sekolah Bersaing", sub-line "Kedudukan sekolah teratas berdasarkan purata ketepatan latihan pelajar." and decorative 🏅 ⭐.
  - **Table:** columns "#", "Sekolah", "Negeri", "Ketepatan", "Pelajar". Row rendering: rank (🥇 🥈 🥉 for 1-3, then the number); school name; negeri; "Ketepatan" as a pill "{avg}%" (green >= 70, amber >= 50, red < 50); "Pelajar" as a count.
  - **Empty state:** "Belum ada data" / "Tiada rekod latihan sekolah lagi."
  - **Not on this screen:** filter, week selector, "Kongsi" button, own-school highlight.
  - **States:** the table header was observed; populated rows: Not observed in V2 — follow FR-AS-45-*. Loading, error: Not observed in V2.
  - **Ranking rule (from the V2 server behaviour):** the ranking is **live, not a weekly snapshot**: schools with practice sessions, ordered by the average session accuracy descending, top 30; "Ketepatan" is a pill "{avg}%" (green >= 70, amber >= 50, red < 50), "Pelajar" = distinct pupils with a session, ranks 1-3 as 🥇 🥈 🥉 then the number; empty state "Belum ada data" / "Tiada rekod latihan sekolah lagi."; no filter, no week selector, no "Kongsi" button, no own-school highlight for a school admin. `/battle/ranking-sekolah` ("🏫 Pertandingan Antara Sekolah", "Ranking Sekolah", "Sekolah terbaik dinilai berdasarkan jumlah mata, kemenangan, dan ketepatan battle."; empty "Tiada ranking lagi" / "Belum ada sekolah yang menyertai battle. Mulakan pertandingan sekarang!") is the Battle league page linked from the V2 admin dashboard: it is not a matrix row and not part of this module.
- **Correction noted:** the earlier V1 board (weekly snapshot with "% Aktif", "Streak Avg", "Nota/Pelajar", a week line, "Sekolah anonim" and a WhatsApp tip) is dropped because V2 (primary, live) shows the accuracy ranking above; this also removes the need for a weekly job and closes the "Data minggu ini belum dijana." gap (DV-AS-45-1; OQ-AS-6 changes to "confirm V2 over V1").
#### Field & behaviour spec — R1-AS-45 Sekolah Bersaing

Route `/sekolah-bersaing`. API: API-AS-14 (no `week` parameter). No input field.

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Ranking board | list | n/a | accuracy descending | top 30 schools by average session accuracy (XS-5, whole number in the pill); ties by "Pelajar" descending then school name ascending (Malay collation); pill colours at least 70 green, at least 50 amber, below 50 red; ranks 1 to 3 shown as 🥇 🥈 🥉 | none | none | computed on request (no stored board) | API-AS-14 |

- Empty: "Belum ada data" / "Tiada rekod latihan sekolah lagi."

**Requirements added by this spec**
- **FR-AS-45-6** The board uses the ordering, tie-breaks and pill colours of the table and is computed on request.
- **AC-AS-45-6** Given two schools with equal accuracy and 50 and 40 pupils, when the board opens, then the school with 50 pupils ranks first; an accuracy of 70% shows a green pill and 69.6% (shown 70) also green, 49% red.

- **Current gap (change the existing code only):** `m16-battle-games/pages/SekolahBersaingPage.vue` and its repository read the weekly seed (`mock/data/sekolah-bersaing-seed.ts:219` `SB_WEEKS`, `mock/repository/sekolah-bersaing.ts:93`) and the API `GET /api/sekolah-bersaing?week=` (`apps/api/src/modules/games/leagues/sekolah-bersaing.controller.ts`): change the read model to the live ranking (average session accuracy per school over M05 sessions, M02 school name and state), change the columns to "#", "Sekolah", "Negeri", "Ketepatan", "Pelajar", remove the week line, week query and the footer tip; keep the hero and the route.
- **Route** `/sekolah-bersaing`. **Matrix** 45. **Priority** **P0**. **Delivery** A. **Status** GH shows "Data minggu ini belum dijana." / "Cron mingguan akan kira pada Isnin pagi. Tunggu kejap ya."
- **Functional requirements**
  - **FR-AS-45-1** The page lists the top 30 schools (Tingkatan 1-5 pupils' sessions only, D72) by average session accuracy descending; "Pelajar" = distinct pupils with a session at that school.
  - **FR-AS-45-2** Columns and copy as the V2 screen facts; the pill colours green >= 70, amber >= 50, red < 50; ranks 1-3 with medals.
  - **FR-AS-45-3** With no sessions anywhere the empty state "Belum ada data" / "Tiada rekod latihan sekolah lagi." shows (no error, no 500); an unknown query parameter is ignored.
  - **FR-AS-45-4** The ranking is computed on request from M05 (no weekly job); a school with no sessions is absent.
  - **FR-AS-45-5** Responsive: at 375 and 768 each school is a card (rank, school name, state, "Ketepatan" pill, "Pelajar") so no column is hidden; table at 1280; text >= 14 px at 375 (V2 hid "Negeri" below md and "Pelajar" below sm).
- **Data** Owner M16 (`GET /api/sekolah-bersaing`), M05 sessions, M02 schools.
- **Acceptance criteria**
  - **AC-AS-45-1** Given sessions of school A (average 80%, 5 pupils) and school B (average 60%, 3 pupils), when the page opens, then A is rank 1 with a green "80%" pill and "5", B is rank 2 with an amber "60%" pill and "3".
  - **AC-AS-45-2** Given no sessions in the system, when the page opens, then "Belum ada data" and "Tiada rekod latihan sekolah lagi." show and HTTP is 200.
  - **AC-AS-45-3** Given 40 schools with sessions, when the page opens, then exactly 30 rows show.
  - **AC-AS-45-4 (R)** Given 30 ranked schools, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth, every school shows rank, name, state, Ketepatan and Pelajar (as card fields at 375 and 768), and text is >= 14 px at 375.
  - **AC-AS-45-5 (U)** Given "Admin Sekolah UAT" and UAT sessions of at least 2 schools, when the page opens, then the school's own Ketepatan equals its average session accuracy computed from M05 and the order is descending.
- **Deviations** DV-AS-45-1 V2 live ranking replaces the V1 weekly board; DV-AS-45-2 no hidden columns on phone. **Open** none (decided as OQ-AS-6, section 6.2: V2 governs).

### R1-AS-46 Statistik Penggunaan
- **Action: Fix** (built; empty because of fixed-date seed)
- **Screen specification (from V2):** Not observed in V2 — follow FR-AS-46-*. V2 excludes this screen for the school admin (it is the PPD/JPN page, not observed); V1 gives the name and the Panduan sentence only. The layout below is [PRINCIPLE] and is already built.
#### Field & behaviour spec — R1-AS-46 Statistik Penggunaan

Route `/admin-sekolah/statistik-penggunaan`. API: API-AS-08 (`days`).

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Period pills | pills | No | "30 Hari" | OPT-TEMPOH second form: "Hari Ini" (1), "7 Hari" (7), "30 Hari" (30); query `days` | none | none | query string | API-AS-08 |

- Cards: "Pelajar", "Guru", "Pelajar Aktif" ("daripada {n}"), "Penglibatan" = round(aktif ÷ pelajar × 100) ("daripada pelajar daftar"), "Sesi Latihan", "Soalan Dijawab", "Purata Ketepatan" ("—" with the footnote of FR-AS-46-2). Table "Mengikut Mod Latihan": columns Mod · Sesi · Ketepatan Purata, sorted by Sesi descending, mode labels as R1-AS-48.
- Empty: "Tiada data untuk tempoh ini"; 7 days: "Tiada aktiviti latihan dalam tempoh 7 Hari yang lepas."; 30 days: "Tiada aktiviti latihan dalam tempoh 30 Hari yang lepas."; today: "Belum ada pelajar buat latihan hari ini. Cuba lihat 7 Hari atau 30 Hari."

**Requirements added by this spec**
- **FR-AS-46-5** The period pills, the Penglibatan rounding, the table order and the empty copy per period follow this subsection.
- **AC-AS-46-5** Given 7 active of 24 pupils, when the page opens, then Penglibatan reads 29% (7 ÷ 24 × 100 = 29.17, rounded); with no activity today the pill "Hari Ini" shows "Belum ada pelajar buat latihan hari ini. Cuba lihat 7 Hari atau 30 Hari."

- **Current gap (change the existing code only):** all figures are 0 in the 30-day window because the seed dates are fixed (`m27-school-admin/mock/read-models/usage.ts`); compute the window from now on the server (`apps/api/src/modules/school-admin/reports/` usage query behind `school-reports.controller.ts:40`) and read XS-1..XS-5; reword the footnote (DV-AS-46-1).
- **Route** `/admin-sekolah/statistik-penggunaan`. **Matrix** 46. **Priority** P1. **Delivery** A. **Status** GH built (pills "Hari Ini", "7 Hari", "30 Hari"; 7 cards; empty "Tiada data untuk tempoh ini" / "Tiada aktiviti latihan dalam tempoh 30 Hari yang lepas."); all zero in 30 days because the seed dates are fixed, while Dashboard shows 15 sessions / 122 answers.
- **Reference**: V1 name and Panduan sentence "Pelajar aktif, sesi latihan, soalan dijawab — gambaran engagement." [V1 M09]; V2 excludes the screen for the school admin; analogue PPD `/ppd/statistik-penggunaan` (pills "Hari Ini", "7 Hari", "30 Hari", default 30). **[PRINCIPLE]** layout as built: cards "Pelajar", "Guru", "Pelajar Aktif" ("daripada {n}"), "Penglibatan" ("daripada pelajar daftar"), "Sesi Latihan", "Soalan Dijawab", "Purata Ketepatan"; table "Mengikut Mod Latihan" (Mod · Sesi · Ketepatan Purata); empty states "Tiada data untuk tempoh ini" (7 days: "…dalam tempoh 7 Hari yang lepas."; today: "Belum ada pelajar buat latihan hari ini. Cuba lihat 7 Hari atau 30 Hari.").
- **Functional requirements**
  - **FR-AS-46-1** Windows are relative to now; default "30 Hari".
  - **FR-AS-46-2** "Pelajar" XS-1; "Guru" XS-3; "Pelajar Aktif" XS-2 in the window; "Penglibatan" = round(aktif ÷ pelajar × 100), 0 when no pupils; "Soalan Dijawab" XS-4 in the window; "Purata Ketepatan" XS-5 ("—" when no answers; footnote "Ketepatan dipaparkan sebagai “—” kerana belum ada soalan dijawab dalam tempoh ini.", DV-AS-46-1 because it is no longer session-based).
  - **FR-AS-46-3** The window is named wherever a number is shown; all-time figures elsewhere differ only by the window.
  - **FR-AS-46-4** Responsive: the three pills equal width and >= 44 px; cards 2 columns at 375; the mode table RP-TABLE-LIST.
- **Data** `GET /api/admin-sekolah/usage?period=` (`school-reports.controller.ts:40`); M05.
- **Acceptance criteria**
  - **AC-AS-46-1** Given answers 3 days ago by 5 of 17 pupils, when "7 Hari" is chosen, then "Pelajar Aktif" = 5 and "Penglibatan" = 29%; when "Hari Ini" is chosen, then 0 and the "Cuba lihat 7 Hari atau 30 Hari." copy.
  - **AC-AS-46-2** Given 30-day answers of 122, when "30 Hari" is chosen, then "Soalan Dijawab" = 122 and is <= the all-time figure on the Command Center.
  - **AC-AS-46-3 (R)** Given the page with data, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth, cards are 2 columns at 375, and the three period pills are visible and >= 44 px.
  - **AC-AS-46-4 (U)** Given "Admin Sekolah UAT" whose school has answers in the last 30 days, when "30 Hari" opens, then "Soalan Dijawab" > 0 and "Pelajar Aktif" <= "Pelajar".
- **Gap** fixed-date seed. **Open** none (decided as OQ-AS-7, section 6.2).

### R1-AS-47 DSKP Heatmap
- **Action: Complete** (built; all cells empty, two legends)
- **Screen specification (from V2):** V2 has no screen (and V1 has no content) — follow FR-AS-47-*. The spec below is [PRINCIPLE]; the V2 pupil DSKP map bands "Mahir (75%+)", "Sederhana (50-74%)", "Lemah (<50%)", "Belum Cuba" are reused.
#### Field & behaviour spec — R1-AS-47 DSKP Heatmap

Route `/admin-sekolah/dskp-heatmap`. API: API-AS-11 (`level` T1 to T5).

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Subjek | select | Yes | the first subject with content | OPT-SUBJEK limited to subjects with mapped answers or SP content; no placeholder | none | none | query string | API-AS-11 |
| Tingkatan | toggle buttons | Yes | the highest Tingkatan with content | "Tingkatan 1" to "Tingkatan 5" for levels with content | none | Subjek | query string `level` | API-AS-11 |

- Legend OPT-HEATBAND on one line. A cell = round(correct ÷ answered × 100) of the school's pupils on questions mapped to the SP; tooltip "{kod SP}: {tajuk} — {band} ({n} jawapan)"; tapping a cell opens the SP detail (topic, answers, accuracy). Empty subject: "Tiada data penguasaan untuk subjek ini."

**Requirements added by this spec**
- **FR-AS-47-6** The cell value, band legend, tooltip and defaults follow this subsection.
- **AC-AS-47-6** Given an SP with 75 correct of 100 answers and one with 74 of 100, when the grid shows, then the first cell is "Mahir (75%+)" and the second "Sederhana (50-74%)"; an SP without answers shows "-" as "Belum Cuba".

- **Current gap (change the existing code only):** no mastery data reaches the grid (`m27-school-admin/mock/read-models/dskp-heatmap.ts` has no SP seed; use the M05 answers joined to M04/M03 on the server through `school-reports.controller.ts:63`); merge the two legend lines into one in the page; add the cell tooltip and SP detail; Tingkatan toggle for all levels with content.
- **Route** `/admin-sekolah/dskp-heatmap`. **Matrix** 47. **Priority** P1. **Delivery** A. **Status** GH built (filters "Subjek", "Tingkatan 4"/"Tingkatan 5", grid Bidang x SP, two overlapping legend lines); every cell "-". No V1/V2 content exists (V1 500, R10; V2 only a pupil-level DSKP map).
- **[PRINCIPLE] spec**: card "Peta DSKP — Standard Pembelajaran", caption "KSSM {Subjek} Tingkatan {n}"; rows = Bidang, columns = Standard Pembelajaran number; cell = pooled accuracy of the school's pupils on questions mapped to that SP: round(correct ÷ answered × 100), band (V1 pupil map) "Mahir (75%+)", "Sederhana (50-74%)", "Lemah (<50%)", "Belum Cuba" (no answers, "-"); tooltip "{kod SP}: {tajuk} — {band} ({n} jawapan)"; one merged legend (DV-AS-47-1); filter Tingkatan 1-5 (those with content; V3 shows only 4 and 5 today, D101).
- **Functional requirements**
  - **FR-AS-47-1** Filters "Subjek" and "Tingkatan".
  - **FR-AS-47-2** Cell value and bands as above; "Belum Cuba" when 0 answers.
  - **FR-AS-47-3** Source: M05 answers joined to M04 questions and M03 SP; non-empty whenever mapped answers exist (needs the Admin Pusat DSKP mapping, D89).
  - **FR-AS-47-4** An empty subject shows "Tiada data penguasaan untuk subjek ini." ([PRINCIPLE] copy); tapping a cell opens its SP detail (topic, answers, accuracy).
  - **FR-AS-47-5** Responsive: the grid scrolls inside its card with a sticky Bidang column, cells >= 44 px; the "Subjek" select full width; the Tingkatan toggle >= 44 px; the legend wraps.
- **Data** Owners M03/M05; `GET /api/admin-sekolah/dskp-heatmap` (`school-reports.controller.ts:63`).
- **Acceptance criteria**
  - **AC-AS-47-1** Given 8 correct of 10 answers on SP 1.1 by the school's pupils, when the grid opens, then the cell shows "80%" with band "Mahir (75%+)" and the tooltip lists 10 jawapan.
  - **AC-AS-47-2** Given no answers on SP 2.1, then the cell shows "-" with band "Belum Cuba".
  - **AC-AS-47-3** Given the page, then exactly one legend exists.
  - **AC-AS-47-4 (R)** Given a subject with 5 Bidang x 6 SP, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth, the grid scrolls inside its card with a sticky first column, and the subject select and Tingkatan toggle are visible and >= 44 px.
  - **AC-AS-47-5 (U)** Given UAT after the Admin PRD DSKP mapping, when "Admin Sekolah UAT" opens a mapped subject, then at least one cell shows a percentage; with no mapping the empty copy shows and no error.
- **Open** none (decided as OQ-AS-8, section 6.2).

### R1-AS-48 Laporan Aktiviti
- **Action: Complete** (built; align labels and sections with V2 and fix the empty axis)
- **Screen specification (from V2)** (authoritative for the Overview page)
  - **Route / title:** `/admin/laporan` in V2 (V3: `/admin-sekolah/laporan`); title "Laporan - Admin Panel".
  - **Regions in order:** (1) three counters; (2) five KPI cards; (3) "Trend Aktiviti (14 hari)"; (4) "Pecahan Aktiviti"; (5) "Pelajar Paling Aktif (Top 10)"; (6) "Cikgu Belum Akses ({n})"; (7) "Aktiviti Mengikut Sekolah (Top 10)"; (8) note.
  - **Counters (label / value):** "Sekolah" 1; "Guru" 174; "Murid" 864. There are no tabs and no range pills.
  - **KPI cards (value / label / sub-line):** "48%" "Murid Pernah Akses" "412 / 864"; "33%" "Cikgu Pernah Akses" "57 / 174"; "3%" "Murid Buat Latihan" "22 / 864"; "457" "Jumlah Aktiviti" "30 hari lepas"; "77.7%" "Skor Purata" "purata ketepatan sesi".
  - **"Trend Aktiviti (14 hari)":** 14 bars labelled dd/mm for the last 14 days.
  - **"Pecahan Aktiviti":** bars with a count per activity mode; V2 prints the raw mode keys "Spm_tahun_lepas" 371, "Revision" 94, "Spm_mock" 26, "Spm_ramalan" 14, "Latih Tubi" 3.
  - **"Pelajar Paling Aktif (Top 10)":** rows with rank, pupil name, count.
  - **"Cikgu Belum Akses ({n})":** teacher names, then "+ {n} lagi".
  - **"Aktiviti Mengikut Sekolah (Top 10)":** rows "{n} sesi · {n} murid".
  - **Note:** "Nota: \"Pernah Akses\" menggunakan status pengesahan akaun (email_verified_at) sebagai proksi log masuk kerana log sesi mentah tidak disimpan dalam set data ini."
  - **States:** populated observed; empty copy, loading, error: Not observed in V2 — follow FR-AS-48-*.
  - **Corrections noted:** (1) the V2 labels are "Pernah Akses" / "Cikgu Belum Akses" (V1 said "Pernah Login"): V3 uses the V2 labels but defines them as a recorded login date (M01), so the proxy note is not shown (DV-AS-48-1); (2) V2 prints raw mode keys in "Pecahan Aktiviti": V3 prints BM labels "SPM Tahun Lepas", "Ulang Kaji", "SPM Mock", "Tracking A", "Latih Tubi" (plus "Battle" and "Permainan" when present; [PRINCIPLE]); (3) V2 has no range pills, tabs or per-person tables on this page; the V1 range pills ("7 Hari", "30 Hari", "3 Bulan") and the Guru/Murid tabs are kept as V1 additions already built (V1 fallback for the person lists that V2 shows only as top-10 and "+ {n} lagi"); (4) "Aktiviti Mengikut Sekolah (Top 10)" and the "Sekolah" counter are meaningless for one school and are hidden; (5) "Murid Buat Latihan" (22) disagrees with the Command Center "pernah aktif" (15) in V2: V3 uses XS-2.
#### Field & behaviour spec — R1-AS-48 Laporan Aktiviti

Route `/admin-sekolah/laporan-aktiviti`. API: API-AS-09 (`range`, `tab`).

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Range pills | pills | No | "30 Hari" | OPT-JULAT: "7 Hari", "30 Hari", "3 Bulan" | none | none | query string `range` | API-AS-09 |
| Tabs | tabs | No | "Overview" | "Overview", "Guru ({n})", "Murid ({n})"; query `tab` = `guru` or `murid` | none | none | query string | API-AS-09 |

- Overview cards: "Murid Pernah Akses", "Cikgu Pernah Akses" (a login is recorded), "Murid Buat Latihan", "Jumlah Aktiviti", "Skor Purata" ("purata ketepatan sesi" = mean of per-session accuracy, whole %), "Trend Aktiviti ({n} hari)" (one bar per day, label `dd/mm`), "Pecahan Aktiviti" (labels "SPM Tahun Lepas", "Ulang Kaji", "SPM Mock", "SPM Ramalan", "Latih Tubi", "Tracking A", "Battle", "Permainan"), "Pelajar Paling Aktif (Top 10)", "Cikgu Belum Akses ({n})" (first 10 names and a link "+ {n} lagi" that opens the Guru tab).
- Guru tab: columns # · Nama · Emel · Status ("Pernah Akses" or "Belum Akses") · Login Terakhir (`dd/mm/yyyy HH:mm` or "Belum login"), sorted by login descending, never-logged last. Murid tab: # · Nama · Kelas · Sesi · Soalan · Status · Login Terakhir, sorted by Soalan descending, "Top 200", 25 per page. Empty: "Tiada rekod sepadan."

**Requirements added by this spec**
- **FR-AS-48-6** The range pills, tabs, sorts and paging of the lists follow this subsection.
- **AC-AS-48-6** Given 30 teachers of whom 12 never logged in, when the Guru tab opens, then the 12 are last in the list with "Belum login"; the Overview shows the first 10 names under "Cikgu Belum Akses (12)" and "+ 2 lagi".

- **Current gap (change the existing code only):** rename the cards to the V2 labels and add "Skor Purata" ("purata ketepatan sesi"), "Pelajar Paling Aktif (Top 10)" and "Cikgu Belum Akses ({n})" to the Overview if missing; give "Pecahan Aktiviti" BM labels; scale the trend axis to the data (it is fixed 0 to 1, `m27-school-admin` Laporan Aktiviti page; read model `apps/api/src/modules/school-admin/reports/activity.service.ts`); the Guru and Murid tabs keep working (verify the pill filters).
- **Route** `/admin-sekolah/laporan-aktiviti` (V2 analogue `/admin/laporan`, h1 "Laporan Statistik"). **Matrix** 48. **Priority** P2. **Delivery** A. **Status** GH built (7H/30H/3B, tabs Overview/Guru(3)/Murid(17), 4 cards, Trend Aktiviti; the axis shows 0-1 because data is empty). V1's real href is unknown (inferred href 404).
- **Reference [V2] `Admin\LaporanController` (all queries confined to the school), [V1] M17 S11**: range pills "7 Hari", "30 Hari" (default), "3 Bulan"; tabs "Overview", "Guru ({n})", "Murid ({n})" ("Sekolah ({n})" hidden for one school, [PRINCIPLE]); Overview cards, sections and labels exactly as the V2 screen facts above ("Murid Pernah Akses", "Cikgu Pernah Akses", "Murid Buat Latihan", "Jumlah Aktiviti", "Skor Purata"; "Trend Aktiviti ({n} hari)"; "Pecahan Aktiviti"; "Pelajar Paling Aktif (Top 10)"; "Cikgu Belum Akses ({n})"); the V1 range pills change the window of the cards and the trend ("{n} hari lepas"). Guru tab "Senarai Guru ({n})" with pills "Semua", "Pernah Login", "Belum Login", search "Cari guru...", table # · Nama · Login · MCQ · Struktur · Syiling · Headcount · Login Terakhir. Murid tab "Senarai Murid ({n}) — Top 200" with pills, search, # · Nama · Kelas · Sesi · Ketepatan · Masa · Syiling · Login Terakhir. V1 defect D-M17-18 (Murid filters always empty) is fixed.
- **Functional requirements**
  - **FR-AS-48-1** "Guru ({n})" = XS-3, "Murid ({n})" = XS-1; "Pernah Akses" and "Belum Akses" use recorded login dates (M01), not e-mail verification.
  - **FR-AS-48-2** The trend axis scales to the data with thinned date labels.
  - **FR-AS-48-3** The pill filters work; an empty result shows "Tiada rekod sepadan." ([PRINCIPLE] copy).
  - **FR-AS-48-4** Teachers' e-mails are shown for own-school teachers only.
  - **FR-AS-48-5** Responsive: range pills equal width >= 44 px; tabs scroll in-row; cards 2 columns at 375; both lists RP-TABLE-LIST at 375/768 (Top 200 paginated 25) and tables at 1280; trend chart RP-CHART.
- **Data** `GET /api/admin-sekolah/laporan-aktiviti?range=` (`school-reports.controller.ts:48`).
- **Acceptance criteria**
  - **AC-AS-48-1** Given a school with 3 teachers and 17 pupils, when the tabs show, then "Guru (3)" and "Murid (17)" equal Senarai Guru and Senarai Pelajar.
  - **AC-AS-48-2** Given 2 of 3 teachers have logged in, when the Guru tab filter "Belum Login" is chosen, then exactly 1 row shows.
  - **AC-AS-48-3** Given the page, then there is no "Sekolah" tab.
  - **AC-AS-48-4 (R)** Given the Murid tab with 17 pupils, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth, pupils are cards at 375/768, and the range pills, tabs and search field are visible and >= 44 px.
  - **AC-AS-48-5 (U)** Given "Admin Sekolah UAT" with migrated `last_login_at` values, when the Overview opens, then "Murid Pernah Akses" = (pupils with a login) / (pupils) and equals the count of pupils with a login date on the Murid tab.
- **Open** none (decided as OQ-AS-9, section 6.2).

### R1-AS-49 Amaran Awal
- **Action: Fix** (built; the risk rule creates false alarms)
- **Screen specification (from V2):** Not observed in V2 — follow FR-AS-49-*. V2 has no school-level Amaran Awal page (the V2 `/amaran` is the teacher class gateway, not observed for the school admin); the page below is V1 (M18 S22) plus the V2 rule that a pupil with no answers is "Belum Bermula".
#### Field & behaviour spec — R1-AS-49 Amaran Awal

Route `/amaran/sekolah` (also `/amaran/ringkasan-eksekutif`). API: API-AS-13.

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Level pills | pills | No | "Semua Tingkatan" | then "Tingkatan n" for each Tingkatan with pupils | none | none | query string | API-AS-13 |
| Keberkesanan Intervensi | button | n/a | n/a | opens the effectiveness view | none | none | n/a | API-AS-13 |
| Ringkasan Eksekutif | button | n/a | n/a | opens the summary with "Cetak / PDF" | none | none | n/a | API-AS-13 |
| Muat Turun CSV | button | n/a | n/a | file `amaran-sekolah-{id}-{yyyymmdd}.csv`, columns "Bil", "Pelajar", "Sekolah", "Tingkatan / Kelas", "Skor Risiko", "Status", "Ketepatan", "Penglibatan", "Penguasaan" | ERR-EXP-01, ERR-EXP-02 | none | n/a | API-AS-13 |

- **Score.** Risk score = 0.4·A + 0.3·E + 0.3·M (A, E, M per the Screen specification), shown with 1 decimal. Groups: Hijau below 40, Kuning 40 to 59.9, Merah 60 or more. "Belum Bermula" is outside the three groups; Hijau + Kuning + Merah + Belum Bermula = XS-1 of the pill scope.
- "Senarai Pelajar Berisiko": 25 per page, score descending, "Belum Bermula" last. "Analisis Risiko Mengikut Subjek": rows "{Subjek}" and "{w}/{m} pelajar lemah ({p}%)" sorted by p descending.

**Requirements added by this spec**
- **FR-AS-49-7** The score formula, group thresholds, list order and CSV columns follow this subsection.
- **AC-AS-49-7** Given scores 39.9, 40.0, 59.9 and 60.0, when the groups are counted, then Hijau = 1, Kuning = 2 and Merah = 1; a pupil without answers is "Belum Bermula" and in none of the three.

- **Current gap (change the existing code only):** `apps/api/src/modules/school-admin/amaran/risk.rules.ts:63-76` (`computeRisk`) gives a never-active pupil score 80 (A 50, E 100, M 100) = Merah: expose `neverActive` as status "Belum Bermula" outside the three risk groups (the field already exists in `RiskComputed`), count it separately in `amaran.service.ts:159-171,242,371`, and show the line "{n} pelajar belum mula (tiada data latihan)" and the "Belum Bermula" row status in the page; render "Analisis Risiko Mengikut Subjek" (missing on GH).
- **Route** `/amaran/sekolah` (also `/amaran/ringkasan-eksekutif`, `/amaran/keberkesanan`, `/amaran/kelas/:id`, `/amaran/export/school/:id`). **Matrix** 49. **Priority** P1. **Delivery** A. **Status** GH built; all 17 pupils "Berisiko Tinggi" (score 80) because they have no practice data.
- **Reference [V1] M18 S22 (M27 doc 5, deck)**: header "Amaran Awal — Sekolah" with the school name; level pills "Semua Tingkatan", "Tingkatan 4", "Tingkatan 5" (all Tingkatan with pupils, D101); 4 tiles "Jumlah Pelajar", "On Track", "Perlu Perhatian", "Berisiko Tinggi"; card "Taburan Risiko Seluruh Sekolah" (stacked bar, "Hijau: n", "Kuning: n", "Merah: n"); buttons "Keberkesanan Intervensi", "Ringkasan Eksekutif", "Muat Turun CSV" (`amaran-sekolah-{id}-{yyyymmdd}.csv`, columns "Bil, Pelajar, Sekolah, Tingkatan / Kelas, Skor Risiko, Status, Ketepatan, Penglibatan, Penguasaan"); "Analisis Risiko Mengikut Subjek" ("{Subjek}", "{w}/{m} pelajar lemah ({p}%)"); "Senarai Pelajar Berisiko" ("Disusun mengikut skor risiko tertinggi": # · Pelajar · Tingkatan / Kelas · Skor · Status · Ketepatan · Penglibatan · Penguasaan). Score = 0.4·A + 0.3·E + 0.3·M (A = 100 − mean accuracy; E = min(100, days since last active × 100 ÷ 30); M = (10 − mean mastery level) × 10); status Hijau < 40, Kuning 40-59.9, Merah >= 60 (`apps/api/src/modules/school-admin/amaran/risk.rules.ts:25-76`). With no activity the formula gives A 50, E 100, M 100 = 80 = Merah (the false alarm).
- **Fix [V2 principle]** V2 gives a pupil with no answers the risk "none" shown "Belum Bermula" (`GuruAnalyticsController::riskLevel`). Pupils with no activity, no session and no mastery are excluded from Hijau/Kuning/Merah and from the tile "Jumlah Pelajar", reported on a line "{n} pelajar belum mula (tiada data latihan)" under the tiles, and shown in the list with status "Belum Bermula" and "—" scores (DV-AS-49-1, [PRINCIPLE]).
- **Functional requirements**
  - **FR-AS-49-1** Scope SC-AS; the level pills filter every block.
  - **FR-AS-49-2** Score and status unchanged for pupils with data.
  - **FR-AS-49-3** "Belum Bermula" handling as above; Hijau + Kuning + Merah + Belum Bermula = XS-1 for the pill scope.
  - **FR-AS-49-4** "Analisis Risiko Mengikut Subjek" renders (it did not show on GH).
  - **FR-AS-49-5** The CSV downloads with the nine columns; "Ringkasan Eksekutif" has "Cetak / PDF".
  - **FR-AS-49-6** Responsive: tiles 2 x 2 at 375; the three buttons stack full width and >= 44 px; the risk bar carries numbers; the pupil list RP-TABLE-LIST at 375/768 (pupil, status chip, Skor, Ketepatan) and a table at 1280, paginated 25.
- **Data** M18 `GET /api/amaran/schools/:id|summary|effectiveness|export/school/:id`.
- **Acceptance criteria**
  - **AC-AS-49-1** Given 17 pupils of whom 15 never practised, when the page opens, then "Belum Bermula" = 15 and the three risk groups count only the other 2.
  - **AC-AS-49-2** Given a pupil with accuracy 30%, active today, mastery mean 2, then score = 0.4·70 + 0.3·0 + 0.3·80 = 52 and status "Kuning".
  - **AC-AS-49-3** Given the four groups, then their sum equals the Senarai Pelajar count.
  - **AC-AS-49-4** Given "Muat Turun CSV", when pressed, then a file `amaran-sekolah-{id}-{yyyymmdd}.csv` with the nine columns downloads.
  - **AC-AS-49-5 (R)** Given 17 pupils, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth, tiles are 2 x 2 at 375, the three buttons are stacked and >= 44 px, and the pupil list is cards at 375/768.
  - **AC-AS-49-6 (U)** Given "Admin Sekolah UAT" with 50 pupils of whom 30 have recent answers, when the page opens, then "Belum Bermula" = 20 or fewer (pupils with no activity ever) and Hijau + Kuning + Merah + Belum Bermula = 50.
- **Open** none (decided as OQ-AS-10, section 6.2).

### R1-AS-50 Laporan Bulanan
- **Action: Complete** (built but thin; add the V2 cards and sections)
- **Screen specification (from V2)** (the closest V2 screen: a yearly "Laporan Eksekutif"; V2 has no monthly report by this name)
  - **Route / title:** `/admin/laporan-eksekutif` in V2; title "Laporan Eksekutif - Admin Panel".
  - **Regions in order:** (1) banner; (2) KPI row 1; (3) KPI row 2; (4) "Trend Penggunaan Bulanan 2026"; (5) "Prestasi Mengikut Subjek"; (6) note; (7) "Headcount TOV → RS (2026)"; (8) "Lencana Pencapaian 2026"; (9) block "Kirkpatrick Evaluation".
  - **Banner:** "Laporan prestasi sekolah anda" / "Ringkasan Eksekutif 2026".
  - **KPI row 1 (label / value / sub-line):** "Jumlah Sekolah" 1 "1 sekolah aktif"; "Pelajar Berdaftar" 864 "23 aktif"; "Kadar Penglibatan" 2.7% "daripada pelajar daftar"; "Soalan Dijawab" 5,537 "sepanjang 2026".
  - **KPI row 2:** "Ketepatan" 86.6% "purata jawapan betul"; "Guru" 174 "berdaftar"; "Soalan / Pelajar Aktif" 241 "purata kedalaman penggunaan"; "Bulan Paling Aktif" "Okt" "465 sesi".
  - **"Trend Penggunaan Bulanan 2026":** twelve bars labelled Jan, Feb, Mac, Apr, Mei, Jun, Jul, Ogo, Sep, Okt, Nov, Dis with the value above each bar.
  - **"Prestasi Mengikut Subjek":** ten rows, each "{subjek}" and "{n} sesi · {x}%" with a bar, ordered by sessions descending.
  - **Note:** "Semua angka dijana daripada pangkalan data langsung. Bahagian penanda aras luaran (GPS, pusat tuisyen, TOV→RS) tidak dipaparkan kerana data tersebut tiada dalam set data ini."
  - **"Headcount TOV → RS (2026)":** "TOV (purata)" 48.33; "RS (sasaran)" 66.42; "Jurang" "+18.09"; caption "Daripada 12 rekod headcount lengkap."
  - **"Lencana Pencapaian 2026":** "Lencana pelajar dibuka" 0; "Lencana guru dibuka" 0; "Jenis lencana pelajar" 3; "Jenis lencana guru" 3.
  - **Block "Kirkpatrick Evaluation":** links "T1: Reaksi", "T2: Pembelajaran", "T3: Tingkah Laku", "T4: Hasil", "Rantaian Impak" (each opens its Kirkpatrick page).
  - **States:** populated observed; empty copy, loading, error: Not observed in V2 — follow FR-AS-50-*.
  - **Corrections noted:** (1) V2's note says the TOV→RS section is not shown while the page shows it: contradiction; V3 shows the section when headcount exists and omits the note; (2) V2 is yearly: the matrix row is "Laporan Bulanan", so V3 shows the same cards and sections for one chosen month, plus the V2 12-month trend of the year (DV-AS-50-1); (3) the Kirkpatrick links are not repeated here (they are in the Kirkpatrick tabs); (4) "23 aktif" here and "15 pernah aktif" on the Command Center disagree in V2: V3 uses XS-2.
#### Field & behaviour spec — R1-AS-50 Laporan Bulanan

Route `/admin-sekolah/laporan-bulanan` with query `?bulan=YYYY-MM`. API: API-AS-10 (`month=YYYY-MM`). The conflict between the older "Bulan" and "Tahun" selects and the arrows is resolved in favour of the arrows (§A2).

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| ← {Bulan lepas} | link | n/a | n/a | previous month, query `?bulan=YYYY-MM` | none | none | query string | API-AS-10 |
| {Bulan depan} → | link | n/a | n/a | next month; absent for the current month (no future month) | none | none | query string | API-AS-10 |

- There are no "Bulan" or "Tahun" selects. An invalid or absent `bulan` means the current month. Month names come from OPT-BULAN. Header "Laporan {Bulan} {Tahun}", button "Cetak / PDF" (A4, print title "Laporan Bulanan — {Bulan} {tahun}"), footer "Laporan dijana: {dd/mm/yyyy HH:mm} · PrestasiPlus". "Trend Harian": one bar per day, labelled every 5th day. "Trend Penggunaan Bulanan {tahun}": 12 bars with short month labels, the chosen month highlighted.
- A month with no data shows the cards with "—", the note "Tiada data untuk bulan ini." and the subject section empty copy "Tiada aktiviti latihan pada bulan ini."

**Requirements added by this spec**
- **FR-AS-50-6** Month navigation uses the two arrow links and `?bulan=YYYY-MM`; the next-month link is absent for the current month and an invalid value falls back to the current month.
- **AC-AS-50-7** Given today in November 2026, when `?bulan=2026-12` is requested, then the current month (November 2026) shows and no "{Bulan depan} →" link exists; `?bulan=2026-10` shows October with both arrows.

- **Current gap (change the existing code only):** `m27-school-admin/pages/LaporanBulananPage.vue` shows 4 cards only; add the V2 cards ("Pelajar Berdaftar" "{n} aktif", "Kadar Penglibatan", "Soalan Dijawab", "Ketepatan", "Guru", "Soalan / Pelajar Aktif", "Bulan Paling Aktif"), render `components/monthly/SubjectPerformance.vue` always (it is hidden when the month is empty), add "Trend Penggunaan Bulanan {tahun}", the headcount and "Lencana Pencapaian" tiles; API `school-reports.controller.ts:56` returns the extra fields.
- **Route** `/admin-sekolah/laporan-bulanan` (`?bulan=YYYY-MM`). **Matrix** 50. **Priority** P1. **Delivery** A. **Status** GH built but thin: "Laporan November 2026", "← Oktober 2026", 4 cards (Penglibatan "0 aktif / 17 daftar", Soalan Dijawab, Ketepatan "—", Sesi Latihan), "Laporan dijana: …", "Cetak / PDF"; the subject section (`components/monthly/SubjectPerformance.vue`) does not show.
- **Reference**: V1 500 (never observed); the V2 screen facts above for the content; V1 M17 S8/S9 for the footer "Laporan dijana automatik oleh PrestasiPlus". **[PRINCIPLE]**: a one-month version of the V2 page.
- **Specification**: header "Laporan {Bulan} {Tahun}" and the V3 navigation "← {Bulan lepas}" and "{Bulan depan} →" (no future month); the V2 cards for the month: "Pelajar Berdaftar" ("{aktif} aktif": XS-2 in the month), "Kadar Penglibatan" ("daripada pelajar daftar": XS-2 ÷ XS-1), "Soalan Dijawab" ("sepanjang {bulan}"), "Ketepatan" ("purata jawapan betul": XS-5 in the month, "—" when none), "Guru" ("berdaftar"), "Soalan / Pelajar Aktif" ("purata kedalaman penggunaan"), "Sesi Latihan"; "Trend Penggunaan Bulanan {tahun}" (12 bars Jan to Dis, the chosen month highlighted); "Trend Harian" (answers per day of the month); "Prestasi Mengikut Subjek" ("{n} sesi · {x}%", top 10; empty "Tiada aktiviti latihan pada bulan ini."); "Headcount TOV → RS ({tahun})" ("TOV (purata)", "RS (sasaran)", "Jurang", "Daripada {n} rekod headcount lengkap."; hidden when none); "Lencana Pencapaian {tahun}" (four tiles); "Cetak / PDF" (print view); footer "Laporan dijana: {tarikh masa} · PrestasiPlus". Default month = current month; every section always renders its empty copy.
- **Functional requirements**
  - **FR-AS-50-1** Month navigation via the arrows and `?bulan=`; an invalid value = current month.
  - **FR-AS-50-2** Cards and sections as specified, XS rules with window "month".
  - **FR-AS-50-3** Empty sections show their copy and never disappear.
  - **FR-AS-50-4** Print/PDF hides the shell and buttons, A4 portrait.
  - **FR-AS-50-5** Responsive: cards 2 x 2 at 375; charts RP-CHART (30 daily bars with every 5th label); subject rows full width; "← {Bulan lepas}" and "Cetak / PDF" >= 44 px.
- **Data** `GET /api/admin-sekolah/laporan-bulanan?bulan=` (`school-reports.controller.ts:56`); M05, M08.
- **Acceptance criteria**
  - **AC-AS-50-1** Given October answers of 40 on 12 days, when "← Oktober 2026" is opened, then "Soalan Dijawab" window = October and the daily bars sum to 40.
  - **AC-AS-50-2** Given a month with no data, then every section shows its empty copy and "Ketepatan" shows "—".
  - **AC-AS-50-3** Given the current month, then "aktif" <= "daftar" and "daftar" equals the Senarai Pelajar count.
  - **AC-AS-50-4** Given "Cetak / PDF", when the print preview opens, then the sidebar and buttons are absent.
  - **AC-AS-50-5 (R)** Given a month with 30 days of data, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth, cards are 2 x 2 at 375, the daily chart fits with thinned labels, and the month arrows are visible and >= 44 px.
  - **AC-AS-50-6 (U)** Given "Admin Sekolah UAT" with answers in the previous month, when "← {Bulan lepas}" opens, then "Soalan Dijawab" > 0 and equals the sum of the school's answers dated in that month on Aktiviti Harian "Bulan Ini" of that month.
- **Deviations** DV-AS-50-1 content added from V2. **Open** none (decided as OQ-AS-11, section 6.2).

### R1-AS-51 Senarai Pelajar
- **Action: Complete** (list works; add class filter, status control, Import Pelajar page)
- **Screen specification (from V2)** (authoritative). Three V2 screens: the list `/admin/users`, the edit form `/admin/users/{id}/edit` and the import page `/admin/import-students`. The pupil rows of the list were not legible in the observation (names hidden), and the observed table header runs "#", "Nama", "Emel", "Telefon", "Peranan", "Sekolah", "Aktif?", "Tarikh", "Tindakan". Regions of the list in order: role cards; filter bar; counter and header buttons; table; pagination. Pagination (V2 prints English): "« Previous", "Next »", "Showing {a} to {b} of {n} results" and numbered pages (25 rows per page; V3 prints BM: "Sebelumnya", "Seterusnya", "Menunjukkan {a} hingga {b} daripada {n} keputusan", [PRINCIPLE] fix of an English-in-BM defect). Row content, empty-table copy, success and error messages of the three screens: Not observed in V2 — follow FR-AS-51-*. Regions, labels and messages observed:
  - List (title "Senarai Pengguna - Admin Panel"): role cards "864 Pelajar", "174 Guru", "3 Admin Sekolah", "0 Pegawai PPD", "0 Admin"; filters "Peranan" ("Semua Peranan", "Pelajar", "Guru", "Admin Sekolah", "Pegawai PPD", "Admin"), "Status" ("Semua", "Aktif", "Tidak Aktif"), "Cari" (text), button "Tapis"; counter "{n} pengguna dijumpai"; buttons "Eksport CSV", "Tambah Pelajar", "Import Pengguna"; table header "# / Nama / Emel / Telefon / Peranan / Sekolah / …" with a row action "Sunting".
  - Edit form (title "Sunting Pelajar - Admin Panel", section "Maklumat pelajar"): "Nama penuh *"; "Nama pengguna *" (help "Unik dalam sekolah ini. Huruf kecil, nombor, titik, sengkang dan garis bawah sahaja."); "Sekolah *" as a locked label (nama sekolah and "{kod} · {PPD} · {negeri}"); "Kelas"; "E-mel (pilihan)"; "Peranan" (a select listing Pelajar, Guru, Admin Sekolah, Pegawai PPD, with the note "Hanya admin pusat boleh menukar peranan."); status radios "Aktif (boleh log masuk)" and "Digantung"; buttons "Simpan" and "Kembali". Section "Tetapkan semula kata laluan": "Kata laluan baharu" (help "Biarkan kosong untuk tetapkan semula kepada ••••••••. Kata laluan baharu dipaparkan sekali selepas simpan.") and button "Tetapkan Semula".
  - Import page (title "Import Pelajar - Admin Panel"): top card "Import Pelajar via ID Delima" ("Import pelajar dari Darjah 1 hingga Tingkatan 5 menggunakan ID Delima KPM." with the fields "Kata laluan DELIMa" and "Email DELIMa"); info text "Import mencipta akaun pelajar baharu sahaja — akaun yang sudah ada tidak akan ditulis ganti atau dipadam. Format: nama,email dengan kolum kelas pilihan. Kata lalu masuk lalai: ••••••••."; card "Borang Import Pelajar" with buttons "Muat Turun CSV Pelajar" and "Tutorial"; "Sekolah" locked label; "Tingkatan / Darjah" select ("— Pilihan —", Darjah 1 to 6, Tingkatan 1 to 5; hint "Digunakan jika baris tidak menyatakan kelas."); "Senarai Pelajar" drop zone "Klik untuk pilih fail atau seret & lepas di sini" with ".csv atau .txt · maksimum 2 MB · lajur: nama, email, kelas"; after a file is chosen a preview "Pratonton · semua {n} baris" with the note "Ini contoh sahaja. {n} baris lagi tidak dipaparkan — kesemua {n} pelajar akan diimport." and the button "Tukar"; submit "Import Pelajar".
  - **Corrections noted:** (1) V2 shows staff roles (Admin Sekolah, Pegawai PPD, Admin) in the cards and the "Peranan" filter to a school admin: V3 splits the list into Senarai Pelajar (pupils) and Senarai Guru (teachers) and never shows staff roles; (2) the row action is "Sunting" (V2), so V3's "Edit" becomes "Sunting" (DV-AS-51-3); (3) the V2 status radios let the school admin suspend a pupil ("Digantung"): V3 provides the same for pupils (OQ-AS-12 for teachers); (4) the "Import Pelajar via ID Delima" card needs an external KPM service and has no V3 target: not built (DV-AS-51-2); V3 offers Tingkatan 1 to 5 only (Darjah hidden, D72); (5) the V2 import page does not state whether imported accounts are active or pending approval; the V2 server rule (inactive until Admin Pusat approves) is kept [NOT OBSERVED on live]; (6) the button "Tutorial" opens the Panduan tab "Admin Sekolah" (a working target, [PRINCIPLE]).
#### Field & behaviour spec — R1-AS-51 Senarai Pelajar

Routes `/admin-sekolah/pelajar` (+ `/baru`, `/:id`, `/import`). API: API-AS-05 (list, form-options, export, detail, create, update, reset password), API-AS-06 (import, `dryRun` = preview). DM: `users`, `enrolments`, `school_subscriptions.student_quota`. Additions: ADD-02 (DM-74), ADD-10 (API-AS-06), ADD-16 (API-AS-05). An object of another school answers 404 (ERR-ACC-02).

**List filters**

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Cari | text | No | empty | placeholder "Cari nama, e-mel atau nama pengguna..."; substring on name, e-mail and username | "Taip sekurang-kurangnya 2 aksara." | none | query string | API-AS-05 |
| Status | select | No | "Semua" | OPT-STATUS-AKAUN: "Semua", "Aktif", "Tidak Aktif" | none | none | query string | API-AS-05 |
| Tingkatan | select | No | "Semua Tingkatan" | OPT-TINGKATAN | none | none | query string `level` | API-AS-05 |
| Kelas | select | No | "Semua Kelas" | classes of the school (name); only classes of the chosen Tingkatan when one is chosen; sorted by Tingkatan then name | none | Tingkatan | query string `classroomId` | API-AS-05 |
| Tapis | button | n/a | n/a | applies the filters at page 1 | none | none | n/a | API-AS-05 |

- List: 25 per page, active first then newest; columns # · Nama (username beneath) · Emel · Telefon · Sekolah · Aktif · Tarikh (`dd/mm/yyyy`) · Tindakan ("Sunting", "Reset Kata Laluan", "Pratonton" for active pupils); counters "{n} pelajar" and "{n} aktif". Empty: "Tiada pelajar dijumpai." Export "Eksport CSV": the filtered list, file `pelajar-{yyyymmdd}.csv`, columns "Bil", "Nama", "Nama Pengguna", "Emel", "Telefon", "Tingkatan", "Kelas", "Status", "Tarikh Daftar".

**Add / edit form**

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Nama penuh * | text | Yes | empty | max 255 | "Sila isi nama penuh."; over 255: "Nama penuh tidak boleh melebihi 255 aksara." | none | `users.name` | API-AS-05 |
| Nama pengguna * | text | Yes | empty | 3 to 30 characters, pattern `^[a-z0-9._-]+$`, unique within the school | "Nama pengguna mesti antara 3 dan 30 aksara."; "Nama pengguna hanya boleh mengandungi huruf kecil, nombor, titik, sengkang dan garis bawah."; 409 "Nama pengguna sudah digunakan." | none | `users.username` | API-AS-05 |
| Sekolah * | locked label | n/a | the own school | none | none | none | `users.school_id` | API-AS-05 |
| Kelas | select | No | "-- Tiada --" | classes of the school; one primary class (teachers add more classes) | none | none | `enrolments.classroom_id` (source `school_admin`) | API-AS-05 |
| E-mel (pilihan) | text | No | empty | valid e-mail | "Format e-mel tidak sah."; 409 "E-mel sudah digunakan." | none | `users.email` | API-AS-05 |
| Peranan | read-only text | n/a | "Pelajar" | note "Hanya admin pusat boleh menukar peranan." | none | none | `user_roles.role` = `student` | none |
| Status | radios | Yes | "Aktif (boleh log masuk)" | OPT-STATUS-AKAUN edit form: "Aktif (boleh log masuk)", "Digantung" | none | none | `users.is_active`, `users.is_suspended` | API-AS-05 |
| Kata laluan baharu (reset) | password | No | empty | min 8; blank = default password | "Kata laluan mesti sekurang-kurangnya 8 aksara." | none | password hash | API-AS-05 |

- Buttons "Simpan" (busy "Menyimpan..."), "Kembali". Toasts "Pelajar disimpan." and "Kata laluan ditetapkan semula.". "Tetapkan Semula" opens CF-12; the resulting password is shown once in a banner "Kata laluan baharu: {kata laluan}. Salin sekarang — tidak dipaparkan lagi."
- **Account state machine.** Created by import: `pending` (inactive) until Admin Pusat approves, then `active`. Created by the school admin form: `active`. `active` and `suspended` toggle by the school admin (pupils only); a suspended pupil cannot log in ("Akaun anda digantung. Sila hubungi pentadbir sekolah.").

**Import (button "Import Pelajar", page `/admin-sekolah/pelajar/import`)**

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Tingkatan | select | No | "— Pilihan —" | OPT-TINGKATAN, sent as `level` = "T1" to "T5"; hint "Digunakan jika baris tidak menyatakan kelas." | none | none | `enrolments` level of rows without a class | API-AS-06 |
| File dropzone | file | Yes | none | text "Klik untuk pilih fail atau seret & lepas di sini"; caption ".csv atau .txt · maksimum 2 MB · lajur: nama, email, kelas"; UTF-8, comma or semicolon delimiter detected from the header, first row the header (`nama,email,kelas`, case-insensitive; `email` and `kelas` may be empty columns but the header must contain `nama`), at most 1000 data rows and not more than the remaining seats | wrong type: ERR-REQ-04 with "CSV, TXT"; over 2 MB: ERR-REQ-05 with 2; none chosen: ERR-REQ-07; no `nama` header: ERR-IMP-02; over 1000 rows: "Fail melebihi 1000 baris."; over the remaining seats: ERR-QUOTA-01 (whole file refused, nothing created) | none | see rows | API-AS-06 |

- **Preview** (the `dryRun` call): "Pratonton · semua {n} baris" shows the first 20 rows with "Ini contoh sahaja. {n} baris lagi tidak dipaparkan — kesemua {n} pelajar akan diimport." and a link "Tukar". Submit "Import Pelajar" (busy "Mengimport...").
- **Row rules.** `nama` required ("Sila isi nama."); e-mail valid if present ("Format e-mel tidak sah."); e-mail unique in the platform ("E-mel sudah digunakan."); `kelas` must match a class of the school (case-insensitive) else the select is used, and with neither: "Kelas tidak dijumpai."; a duplicate nama + kelas inside the file is allowed; a duplicate e-mail inside the file fails the later row ("E-mel berulang dalam fail.").
- **Outcome.** Valid rows are created as `inactive` pending Admin Pusat even when others fail. Result panel: "{a} pelajar berjaya diimport, {b} baris gagal." with "Pelajar yang diimport menunggu kelulusan Admin Pusat.", a table Baris · Nama · Sebab and the button "Muat Turun Ralat" (`ralat-import-pelajar-{yyyymmdd}.csv`, columns Baris, Sebab, nama, email, kelas) (ERR-IMP-01).
- **Template** "Muat Turun CSV Pelajar": `templat-pelajar.csv` with header `nama,email,kelas` and one fictitious row `Murid Contoh,murid.contoh@example.org,5 Bestari`. "Tutorial" opens `/panduan?peranan=admin-sekolah`.
- **Seats.** Remaining seats = `school_subscriptions.student_quota` − pupils of the school (active + pending).

**Requirements added by this spec**
- **FR-AS-51-11** The list filters (Cari, Status, Tingkatan, Kelas) and the export columns follow this subsection.
- **FR-AS-51-12** The pupil form enforces the username (3 to 30, pattern, unique per school), e-mail and password rules of the table.
- **FR-AS-51-13** The import accepts `.csv` or `.txt` of at most 2 MB and 1000 rows, shows a 20-row preview, creates the valid rows as pending and reports failed rows with a downloadable error file.
- **AC-AS-51-10** Given the filter Tingkatan "Tingkatan 4", when the "Kelas" select opens, then only classes of Tingkatan 4 list, sorted by name.
- **AC-AS-51-11** Given the username "Murid Satu" (capital and space), when "Simpan" is pressed, then "Nama pengguna hanya boleh mengandungi huruf kecil, nombor, titik, sengkang dan garis bawah." shows; given a username already used in the school, then "Nama pengguna sudah digunakan." shows.
- **AC-AS-51-12** Given 5 remaining seats and a file of 6 valid rows, when imported, then the quota message shows and no pupil is created; given a file of 3 rows with one invalid e-mail, then "2 pelajar berjaya diimport, 1 baris gagal." shows and the 2 pupils are `inactive` pending approval.
- **AC-AS-51-13** Given a file of 1001 data rows, when chosen, then "Fail melebihi 1000 baris." shows and nothing is created.

- **Current gap (change the existing code only):** add the class/Tingkatan filter to `m27-school-admin/components/users/SchoolUserList.vue`; add the status radios ("Aktif (boleh log masuk)" / "Digantung") and the optional new-password field to the edit page; rename "Edit" to "Sunting"; build the Import Pelajar page and its API (the menu item `sa-import-pelajar`, `src/shells/nav/user-nav.ts:385`, is hidden by scope: expose it as a button on this page, not as a menu item); reuse `people/pupils.controller.ts` for list, export and reset.
- **Route** `/admin-sekolah/pelajar` (+ `/baru`, `/:id`). **Matrix** 51. **Priority** P1. **Delivery** A. **Status** GH built: search, status, "Eksport CSV", "Tambah Pelajar", "Edit", impersonate, 17 pupils; no bulk import, no class filter, no active toggle on the row (`user-nav.ts:385` hides "Import Pelajar").
- **Reference:** the V2 screen facts above; V2 server: 25 per page, active first then newest; table columns # · Nama (+ username) · Emel · Telefon · Peranan · Sekolah · Aktif · Tarikh · Tindakan. [V1 Panduan] "Urus Pelajar: Import pelajar pukal, edit maklumat, pantau senarai seluruh sekolah"; FAQ "Boleh reset kata laluan guru/pelajar? Ya! Dari senarai guru/pelajar, klik nama pengguna, kemudian 'Reset Kata Laluan'." Rules [V2 `StaffScope`]: list confined to the own school; edit/reset only active pupils of the school; imports land inactive until Admin Pusat approves; no role change.
- **Functional requirements**
  - **FR-AS-51-1** List the school's pupils, 25 per page, with search (nama, e-mel, nama pengguna), status filter and a **class/Tingkatan filter**.
  - **FR-AS-51-2** "{n} pelajar" = XS-1 (all pupils, status chip shown) and "{n} aktif" beside it.
  - **FR-AS-51-3** "Tambah Pelajar" and "Sunting" use the V2 form ("Nama penuh *", "Nama pengguna *" unique in the school, locked "Sekolah *", "Kelas", "E-mel (pilihan)", role note, status "Aktif (boleh log masuk)" / "Digantung", "Simpan", "Kembali"); "Tetapkan semula kata laluan" with an optional "Kata laluan baharu" (blank = the default password) shows the resulting password once after saving.
  - **FR-AS-51-4** **"Import Pelajar"** is a button on this page opening the V2 import form ("Tingkatan" 1-5 select, drop zone for `.csv`/`.txt` up to 2 MB with columns nama, email, kelas, "Pratonton · semua {n} baris", "Tukar", "Import Pelajar", "Muat Turun CSV Pelajar", "Tutorial" opening the Panduan tab "Admin Sekolah"); only new accounts are created, existing accounts are never overwritten; per-row errors are reported; imported accounts stay inactive until Admin Pusat approves, with the message "Pelajar yang diimport menunggu kelulusan Admin Pusat." ([PRINCIPLE] copy; V2 server rule); no new menu (DV-AS-51-1).
  - **FR-AS-51-5** "Eksport CSV" exports the filtered list.
  - **FR-AS-51-6** Another school's pupil id = 404.
  - **FR-AS-51-7** "Pratonton" (impersonate) only for active pupils of the school, not self or staff.
  - **FR-AS-51-9** (D-A15, F-17) A pupil's Tingkatan (grade), school and role change only by Admin Pusat or by the school admin (Tingkatan of an own-school pupil); school and role are locked for the school admin ("Hanya admin pusat boleh menukar peranan."). A pupil, a teacher or a parent cannot change them, and `PUT /api/me` ignores `grade`, `schoolId` and `role`.
  - **FR-AS-51-10** (D-A17) The import quota equals the school's subscription seat limit (`student_quota`): remaining seats = limit − pupils already in the school (active and pending). A file with more rows than the remaining seats is refused whole with "Kuota penuh! Sila tingkatkan kuota dahulu." and nothing is imported. A new or reset password follows the platform minimum of `30-admin-pusat.md` FR-ADM-U02.4 (8 characters, the V2 hint).
  - **FR-AS-51-8** Responsive: RP-TABLE-LIST cards at 375/768 (name, kelas, status, last active; "Edit" and "Reset" >= 44 px); the filter bar RP-FILTER; "Tambah Pelajar", "Import Pelajar", "Eksport CSV" wrap full width at 375; table with sticky name column at 1280; pagination controls >= 44 px.
- **Data** Owner M02. API `GET/POST/PUT /api/admin-sekolah/pelajar`, `/export.csv`, `/form-options`, `POST /:id/reset-password` (`people/pupils.controller.ts`); **new** bulk import endpoint.
- **Acceptance criteria**
  - **AC-AS-51-1** Given 17 pupils, when the page opens, then "17 pelajar" shows and the Command Center, Prestasi and Dashboard show 17.
  - **AC-AS-51-2** Given class filter "Kelas Demo Matematik T4" with 6 members, then exactly 6 pupils show.
  - **AC-AS-51-3** Given an import CSV of 3 rows (2 valid, 1 invalid), when imported, then 2 pending accounts exist, the invalid row is reported, and the count rises by 2 only after approval in Admin Pusat.
  - **AC-AS-51-4** Given a pupil of another school by id, when opened or edited, then 404.
  - **AC-AS-51-5** Given "Reset Kata Laluan" on a pupil, when confirmed, then a new password shows once and the pupil can log in with it.
  - **AC-AS-51-6 (R)** Given 60 pupils, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth, rows are cards at 375/768, the three header buttons are visible and >= 44 px, and pagination shows 25 per page.
  - **AC-AS-51-8** Given a school with seat limit 100 and 95 pupils, when a CSV of 6 valid rows is imported, then "Kuota penuh! Sila tingkatkan kuota dahulu." shows and 0 accounts are created; with 5 rows, then 5 pending accounts are created.
  - **AC-AS-51-9** Given a pupil who sends `schoolId`, `grade` or `role` to `PUT /api/me`, then the stored values are unchanged; given the school admin edits an own-school pupil, then the school and role controls are locked.
  - **AC-AS-51-7 (U)** Given "Admin Sekolah UAT" with 50+ migrated pupils, when the page opens, then "{n} pelajar" equals the XS-1 value and 25 rows load per page with working pagination.
- **Deviations** DV-AS-51-1 Import as a button, not a menu; DV-AS-51-2 ID Delima card not built, Tingkatan 1-5 only; DV-AS-51-3 "Sunting". **Open** none (decided as OQ-AS-8, section 6.2).

### R1-AS-52 Senarai Guru
- **Action: Fix** (built; the count disagrees with other screens)
- **Screen specification (from V2):** the V2 list `/admin/users` filtered to role "Guru" (card "174 Guru", "Peranan" filter value "Guru"; the same header buttons "Eksport CSV", "Tambah Pelajar" (V3: "Tambah Guru"), "Import Pengguna", the same filter bar, counter and table columns as Senarai Pelajar in R1-AS-51). **The teacher edit form and the teacher rows are not observed in V2** — follow FR-AS-52-*: the pupil edit form of R1-AS-51 is the only V2 form seen (the teacher form is [PRINCIPLE] = the same fields plus "Subjek Utama", "Kelayakan"). V1 has the analogue tables below.
#### Field & behaviour spec — R1-AS-52 Senarai Guru

Routes `/admin-sekolah/guru` (+ `/baru`, `/:id`, `/menunggu`). API: API-AS-07 (list, export, detail, create, update, toggle-active, reset-password; body additions ADD-20 (API-AS-07)), API-AS-04 (pending list and verify).

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Cari | text | No | empty | placeholder "Cari nama atau e-mel..." (GLB-4) | "Taip sekurang-kurangnya 2 aksara." | none | query string | API-AS-07 |
| Status | select | No | "Semua" | OPT-STATUS-AKAUN | none | none | query string | API-AS-07 |
| Nama penuh * | text | Yes | empty | max 255 | "Sila isi nama penuh."; over 255: "Nama penuh tidak boleh melebihi 255 aksara." | none | `users.name` | API-AS-07 |
| E-mel * | text | Yes | empty | login e-mail, valid, unique | "Sila isi e-mel."; "Format e-mel tidak sah."; 409 "E-mel sudah digunakan." | none | `users.email` | API-AS-07 |
| Subjek Utama | text | No | empty | max 100 | "Subjek utama tidak boleh melebihi 100 aksara." | none | `teacher_profiles.subject` | API-AS-07 |
| Kelayakan | text | No | empty | max 150 | "Kelayakan tidak boleh melebihi 150 aksara." | none | `teacher_profiles.qualification` | API-AS-07 |
| No. IC | text | No | empty | exactly 12 digits | "No. IC mesti 12 digit tanpa sempang." | none | `users.ic_hash`, `users.ic_masked` | API-AS-07 |
| Kata laluan baharu | password | No | empty | min 8; blank = default password | "Kata laluan mesti sekurang-kurangnya 8 aksara." | none | password hash | API-AS-07 |
| Peranan | read-only text | n/a | "Guru" | none | none | none | `user_roles.role` = `teacher` | none |

- Columns # · Nama · Emel · Subjek Utama · Kelas (count) · Status · Login Terakhir (`dd/mm/yyyy HH:mm` or "Belum login"); 25 per page, name ascending. A teacher created by the school admin is `active`. The pending list "Guru Menunggu" has "Sahkan" (approve) per row. The school admin approves pending teachers and resets passwords (CF-12); deactivating follows OQ-AS-12 (the server rule). Export `guru-{yyyymmdd}.csv`, columns "Bil", "Nama", "Emel", "Subjek Utama", "Bilangan Kelas", "Status", "Login Terakhir". There is no import. Empty: "Tiada guru berdaftar untuk sekolah ini."

**Requirements added by this spec**
- **FR-AS-52-8** The create-teacher form enforces the fields of the table; the new teacher is `active` in the own school.
- **AC-AS-52-7** Given an e-mail already used, when "Simpan" is pressed, then "E-mel sudah digunakan." shows and no account is created; with a new valid e-mail the teacher lists as active.

- **Current gap (change the existing code only):** "Guru" shows 3 on this page but 4 on Prestasi and Monitoring: make `school-admin/people/teachers.controller.ts` list and the Prestasi/Monitoring counters read the same XS-3 query (find the 4th account and decide pending/admin exclusion); rename "Edit" to "Sunting" (as AS-51); verify "Guru Menunggu" (`m27-school-admin/routes/guru.ts:25-40`).
- **Route** `/admin-sekolah/guru` (+ `/baru`, `/:id`, `/menunggu`). **Matrix** 52. **Priority** P2. **Delivery** A. **Status** GH built: search, status, "Eksport CSV", "Cipta Pengguna", "Edit".
- **Reference [V2] `admin/users` (role Guru); [V1] Panduan**: "Dari panel admin, pergi ke 'Senarai Guru' → 'Cipta Pengguna'"; "Urus Guru: Daftar guru, edit profil, aktif/nyahaktif akaun guru"; analogue tables [V1 M18 S9] # · Nama · Email · Subjek · Kelayakan · Kelas, [V1 M11 S3] "Senarai Guru ({n})" # · Nama · Status · Login Terakhir · Daftar (empty "Tiada guru berdaftar untuk sekolah ini."); page "Guru Menunggu Pengesahan".
- **Functional requirements**
  - **FR-AS-52-1** Columns # · Nama · Emel · Subjek Utama · Kelas (count) · Status · Login Terakhir; "{n} guru" = XS-3 (pending teachers are on "Guru Menunggu").
  - **FR-AS-52-2** "Cipta Pengguna" creates a teacher of the own school only.
  - **FR-AS-52-3** "Edit" and "Reset Kata Laluan".
  - **FR-AS-52-4** Approving a pending teacher is allowed; deactivating an active teacher follows the V2 server rule (Admin Pusat), OQ-AS-12.
  - **FR-AS-52-5** "Eksport CSV".
  - **FR-AS-52-6** Responsive as FR-AS-51-8.
  - **FR-AS-52-7** (D-A17) There is no teacher bulk import in R1: the school admin creates teachers one by one with "Cipta Pengguna" (a teacher created by the school admin is approved and active at once [PRINCIPLE]); the bulk path for teachers is Admin Pusat "Import Pengguna". "Guru Menunggu" holds only self-registered teachers. The password minimum is that of FR-AS-51-10.
- **Data** M02 (`teachers.controller.ts`).
- **Acceptance criteria**
  - **AC-AS-52-1** Given 3 approved teachers, when the page opens, then "3 guru" shows and Prestasi, Monitoring and Statistik Penggunaan show 3.
  - **AC-AS-52-2** Given "Cipta Pengguna" with a name and e-mail, when saved, then the teacher belongs to the admin's school and appears in the list.
  - **AC-AS-52-3** Given 1 pending teacher, then the list shows 3 (not 4) and "Guru Menunggu" shows 1.
  - **AC-AS-52-4 (R)** Given 10 teachers, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth, rows are cards at 375/768, and "Cipta Pengguna", "Edit" and "Eksport CSV" are visible and >= 44 px.
  - **AC-AS-52-6** Given the page, then no teacher import control exists, and a teacher created with "Cipta Pengguna" can log in without waiting for approval.
  - **AC-AS-52-5 (U)** Given "Admin Sekolah UAT" with 3 migrated teachers, when the page opens, then "3 guru" and Monitoring "Guru Berdaftar" = 3.
- **Open** none (decided as OQ-AS-12, section 6.2).

### R1-AS-53 Kelas Sekolah
- **Action: Complete** (read-only list works; add drill links, remove the code column)
- **Screen specification (from V2):** V2 has no school class list for the school admin; nothing observed — follow FR-AS-53-*. The spec is [PRINCIPLE].
#### Field & behaviour spec — R1-AS-53 Kelas Sekolah

Route `/admin-sekolah/kelas`. API: API-AS-12.

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Cari kelas... | text | No | empty | substring on the class name (GLB-4) | "Taip sekurang-kurangnya 2 aksara." | none | query string | API-AS-12 |
| Tingkatan | select | No | "Semua Tingkatan" | OPT-TINGKATAN | none | none | query string | API-AS-12 |

- Table: # · Kelas · Subjek · Tingkatan · Guru · Murid; sorted by Tingkatan then name; counter "{n} Kelas Aktif"; empty "Tiada kelas dijumpai." There is no class code column.

**Requirements added by this spec**
- **FR-AS-53-5** The search, Tingkatan filter, columns, sort and counter follow this subsection.
- **AC-AS-53-6** Given classes in Tingkatan 4 and 5, when the filter "Tingkatan 4" is chosen, then only Tingkatan 4 classes list and the counter equals the rows shown.

- **Current gap (change the existing code only):** rows are not links (`m27-school-admin/routes/kelas.ts` page): link the row to `/prestasi/kelas/:id` and the "Murid" number to Senarai Pelajar filtered by class; remove the "Kod Kelas" column (join code dropped, GUR-8); API `school-reports.controller.ts:71`.
- **Route** `/admin-sekolah/kelas`. **Matrix** 53. **Priority** P2. **Delivery** A. **Status** GH built: "6 Kelas Aktif", search "Cari kelas...", filter "Tingkatan", table # · Kelas · Subjek · Tingkatan · Guru · Murid · Kod Kelas; read-only.
- **Reference**: none observed (V1 NOT FOUND; V2 has no school class list; the `school_class` versus teacher `classroom` naming trap, M27 doc 7.3). **[PRINCIPLE]** all classes of the school (teacher-owned classes) with the counter "{n} kelas dipaparkan"; a row opens the class dashboard (`/prestasi/kelas/:id`, allowed for school_admin) and "Murid" opens Senarai Pelajar filtered by that class. No "Cipta Kelas" (teachers create classes, GUR-8). The "Kod Kelas" column is removed because the join code is no longer a feature (DV-AS-53-1; see GUR-8).
- **Functional requirements**
  - **FR-AS-53-1** Lists active classes of the school; the "Kelas Aktif" count equals the number of rows and the "Kelas" card of Prestasi.
  - **FR-AS-53-2** "Murid" per class = XS-1 for that class; distinct pupils across classes <= XS-1.
  - **FR-AS-53-3** A row opens Prestasi Kelas; the "Murid" number opens Senarai Pelajar with the class filter.
  - **FR-AS-53-4** Responsive: RP-TABLE-LIST cards at 375/768; filter RP-FILTER; links >= 44 px.
- **Data** M10 `GET /api/admin-sekolah/kelas` (`school-reports.controller.ts:71`).
- **Acceptance criteria**
  - **AC-AS-53-1** Given 6 classes, when the page opens, then "6 Kelas Aktif" shows and Prestasi "Kelas" = 6.
  - **AC-AS-53-2** Given a row "Kelas Demo Matematik T4" with 6 pupils, when the row is clicked, then its class dashboard opens, and when "6" is clicked then Senarai Pelajar lists those 6.
  - **AC-AS-53-3** Given the filter "Tingkatan 4", then only Tingkatan 4 classes show.
  - **AC-AS-53-4 (R)** Given 6 classes, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth, classes are cards at 375/768, and the search, the Tingkatan select and the row links are visible and >= 44 px.
  - **AC-AS-53-5 (U)** Given "Admin Sekolah UAT" with 4 migrated classes, when the page opens, then "4 Kelas Aktif" and the sum of "Murid" equals the number of enrolments of those classes.
- **Open** none (decided as OQ-AS-13, section 6.2).

---

### Delivery B (ticked matrix rows after the 1.0 columns; same acceptance bar)

### R1-AS-2 Dashboard
- **Action: Complete** (built; the Perutusan route and card targets are missing)
- **Screen specification (from V2):** V2 has no school dashboard. The V2 route `/admin` for a school admin is the **platform-question dashboard** (title "Dashboard - Admin Panel") with the cards "Soalan Aktif 408,353", "Diluluskan 408,197", "Menunggu Review 0", "Draf 155", "Subjek 31", "Tahap Pendidikan 11", "Pengguna 1,042 / 864 Pelajar", "Battle Arena 508 Total / 0 Aktif / 508 Selesai", three "Tindakan Pantas" tiles, and the sections "Soalan Terkini", "Taburan Status Soalan", "Pautan Pantas", "Muat Turun Data (CSV)". It shows national question-bank figures to a school admin and is **not** a school dashboard; it is not replicated. The Dashboard Sekolah below is V1 (L07) and the V3 build — follow FR-AS-2-*.
#### Field & behaviour spec — R1-AS-2 Dashboard

Route `/admin-sekolah`. API: API-AS-01. The dashboard has no input field.

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Cards | read-only | n/a | n/a | "Jumlah Pelajar" (XS-1), "Jumlah Guru" (XS-3), "Kelas Aktif", "Langganan" (read-only status, no link), "Guru Menunggu" (link), GPS and "{n} entri headcount" | none | none | computed | API-AS-01 |
| Perutusan Terkini | card | n/a | n/a | the newest visible message and a link "Lihat semua →" to `/perutusan`; none: "Tiada perutusan." | none | none | computed | API-AS-01 |

- The Perutusan routes `/perutusan`, `/perutusan/:id`, `/perutusan/tulis`, `/perutusan/saya` belong to M09. Fields of "Tulis Perutusan": "Tajuk *" (max 150, "Sila isi tajuk perutusan.", over 150 "Tajuk perutusan tidak boleh melebihi 150 aksara."), "Kandungan *" (max 2000, "Sila isi kandungan perutusan.", over 2000 "Kandungan perutusan tidak boleh melebihi 2000 aksara."), "Skop" fixed to "Sekolah"; button "Hantar Perutusan"; success "Perutusan dihantar." (R1 decision D113).

**Requirements added by this spec**
- **FR-AS-2-6** "Tulis Perutusan" enforces Tajuk (150) and Kandungan (2000) and has the fixed scope "Sekolah".
- **AC-AS-2-7** Given an empty Tajuk, when "Hantar Perutusan" is pressed, then "Sila isi tajuk perutusan." shows and nothing is sent.

- **Current gap (change the existing code only):** the Perutusan card links to `/perutusan`, which has no route (`src/shells/nav/user-nav.ts:411`; M09 perutusan pages S22-S25 unbuilt): build the list, detail, "Tulis Perutusan" and "Perutusan Saya" pages; the "Langganan" card has no target (make it a read-only status card); stat cards and panels link to their pages; counts read XS-1/XS-3/AS-53/AS-3/AS-49 queries.
- **Route** `/admin-sekolah` (header "Dashboard Sekolah", breadcrumb "← Papan Pemuka" > "Dashboard Sekolah"). **Matrix** 2. **Priority** P1. **Status** GH built (banner, Perutusan card, stat cards, Ringkasan Prestasi, Taburan Gred); the Perutusan links go to `/perutusan` which has no route (M09-T4b not built; `user-nav.ts:411`); the "Langganan" card has no target.
- **Reference [V1] L07 (screenshot), M27 doc; V2 server `Panel\DashboardController`**: dark card "Perutusan Terkini" with "Lihat semua →" and the newest post ("Pengetua · {n} bulan yang lepas"); banner: school name in capitals, "Admin Sekolah", "📍 {negeri}", "{PPD}", "# Kod: {kod}"; stat cards "Jumlah Pelajar", "Jumlah Guru", "Kelas Aktif", "Langganan" ("Belum Ada" when none); "Ringkasan Prestasi" ("GPS, risiko murid, ketepatan latihan & perbandingan tingkatan") with panels "GPS Sekolah" (value, band, "{n} entri headcount"), "Amaran Awal" ("Selamat", "Berhati", "Berisiko", "{n} murid dinilai"), "Latihan" ("Purata Ketepatan", "{n} sesi · {n} soalan"), "Tingkatan" (bars per Tingkatan, "Click untuk detail"); "Taburan Gred (Anggaran)" with "Lihat penuh →"; callout "Guru Menunggu".
- **Functional requirements**
  - **FR-AS-2-1** Every card and link works: stat cards open Senarai Pelajar, Senarai Guru, Kelas Sekolah; "Langganan" shows the school's subscription status read from M19 and is a read-only card (no link); "Ringkasan Prestasi" panels open Prestasi, Amaran Awal, Statistik Penggunaan and the Tingkatan page; "Lihat penuh →" opens Prestasi; "Guru Menunggu" opens `/admin-sekolah/guru/menunggu`.
  - **FR-AS-2-2** "Perutusan Terkini" shows the newest visible perutusan (national plus own school); "Lihat semua →" opens a **working** `/perutusan` (list "Perutusan Rasmi" / "Maklumat & berita dari pihak pengurusan", detail `/perutusan/:id`, and for the school admin "Tulis Perutusan" `/perutusan/tulis`, "Perutusan Saya" `/perutusan/saya` with scope "Sekolah"; owner M09, V1 M09 S22-S25); with none: "Tiada perutusan." ([PRINCIPLE] copy).
  - **FR-AS-2-3** Figures: Jumlah Pelajar XS-1, Jumlah Guru XS-3, Kelas Aktif = AS-53 count, GPS and "{n} entri headcount" = the AS-3 count, Amaran counts = AS-49 groups (Belum Bermula excluded), Latihan = XS-4/XS-5 all time.
  - **FR-AS-2-4** The breadcrumb "← Papan Pemuka" is not shown on this page (it is the landing page) and returns here from child pages.
  - **FR-AS-2-5** Responsive: banner chips wrap; stat cards 2 x 2 at 375 and 4 across at 1280 (RP-KPI); "Ringkasan Prestasi" panels stack; Perutusan text wraps.
- **Data** `GET /api/admin-sekolah/dashboard` (`school-admin.controller.ts:30`), M09 perutusan, M19 subscription.
- **Acceptance criteria**
  - **AC-AS-2-1** Given 17 pupils, 3 teachers and 6 classes, when the Dashboard opens, then the three cards show 17, 3 and 6, equal to the three list pages.
  - **AC-AS-2-2** Given a published national perutusan, when "Lihat semua →" is clicked, then `/perutusan` opens and lists it.
  - **AC-AS-2-3** Given the Dashboard, when every card, panel link and "Lihat penuh →" is clicked, then each opens a working page and the "Langganan" card is not a link.
  - **AC-AS-2-4** Given the "Amaran Awal" panel, then its counts equal the groups on Amaran Awal.
  - **AC-AS-2-5 (R)** Given the Dashboard with data, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth, stat cards are 2 x 2 at 375, and every panel link is visible and >= 44 px.
  - **AC-AS-2-6 (U)** Given "Admin Sekolah UAT", when the Dashboard opens, then Jumlah Pelajar, Jumlah Guru and Kelas Aktif equal the Senarai Pelajar, Senarai Guru and Kelas Sekolah counts.
- **Open** none (decided as OQ-AS-14, section 6.2).

### R1-AS-A1 Profil Saya
- **Action: Complete** (generic hero exists; add the school block)
- **Screen specification (from V2):** Not observed in V2 for the school admin — follow FR-AS-A1-*. **Current gap:** `/profile` has no school block (nama sekolah, kod, PPD, negeri); add it from M02.
#### Field & behaviour spec — R1-AS-A1 Profil Saya

Route `/profile`. API: the existing account profile endpoint. Errors: ERR-REQ-01.

| Label | Type | Req. | Default | Options / data source | Validation + exact BM error | Depends on | Stored as | API-ID |
|---|---|---|---|---|---|---|---|---|
| Nama * | text | Yes | current name | max 255 | "Sila isi nama."; over 255: "Nama tidak boleh melebihi 255 aksara." | none | `users.name` | profile endpoint |
| Telefon | text | No | empty | digits with an optional leading "+", 9 to 14 digits | "Format telefon tidak sah." | none | `users.phone` | profile endpoint |
| E-mel * | text | Yes | current e-mail | valid e-mail | "Format e-mel tidak sah."; 409 "E-mel sudah digunakan." | none | `users.email` | profile endpoint |
| School block | read-only | n/a | n/a | school name, "# Kod", PPD, negeri | none | none | school record | none |

- Button "Kemaskini Profil" (busy "Menyimpan..."); success "Profil dikemaskini." (R1 decision D113 for the telephone rule).

**Requirements added by this spec**
- **FR-AS-A1-4** The profile form enforces the three editable fields of the table and keeps the school block read-only.
- **AC-AS-A1-4** Given Telefon "12345", when "Kemaskini Profil" is pressed, then "Format telefon tidak sah." shows and nothing is saved; "+60123456789" saves.

- **Route** `/profile`. **Matrix** A1. **Priority** P2. **Status** GH built (hero: avatar, nama, emel, "Ahli sejak", "Kemaskini Profil").
- **Reference [V1]** hero profile; for the school admin the school block (nama sekolah, "# Kod", PPD, negeri) is added (read-only).
- **Functional requirements**
  - **FR-AS-A1-1** Hero as V1 plus the school block.
  - **FR-AS-A1-2** "Kemaskini Profil" edits nama, telefon and e-mel (M01) with a BM message; password change by the existing flow.
  - **FR-AS-A1-3** Responsive RP-FORM, RP-TOUCH.
- **Acceptance criteria**
  - **AC-AS-A1-1** Given the name "Admin Contoh", when changed to "Admin Contoh B" and saved, then the avatar initials and the shell user card update.
  - **AC-AS-A1-2 (R)** Given the profile page, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth, the form is one column at 375, and "Kemaskini Profil" is visible and >= 44 px.
  - **AC-AS-A1-3 (U)** Given "Admin Sekolah UAT", when the page opens, then the school block shows the school's nama, kod and PPD from M02.

### R1-AS-A2 Tetapan Peribadi
- **Action: Complete** (V1 content exists; add the read-only account block)
- **Screen specification (from V2):** Not observed in V2 for the school admin — follow FR-AS-A2-*; the closest observed analogue is the Guru "Tetapan Peribadi" account card of R1-GUR-A2 (rows "Telefon", "Sekolah", "Peranan", "Status"; role value "Admin Sekolah"). **Current gap:** `/tetapan` lacks the V2 "Tetapan Akaun" block (e-mel, telefon, sekolah, peranan, status).
#### Field & behaviour spec — R1-AS-A2 Tetapan Peribadi

Same fields, options and messages as R1-GUR-A2 (Mod Rohani, Latar Agama with OPT-FAITH, "Simpan", toast "Tetapan disimpan.") plus the read-only "Tetapan Akaun" rows (Telefon, Sekolah, Peranan = "Admin Sekolah", Status).

**Requirements added by this spec**
- **FR-AS-A2-4** The page offers the Mod Rohani toggle and the Latar Agama select exactly as R1-GUR-A2; the account rows are read-only.
- **AC-AS-A2-4** Given the school admin changes Latar Agama to "Islam" with Mod Rohani on, when "Simpan" is pressed, then "Tetapan disimpan." shows and the value `muslim` is stored.

- **Route** `/tetapan`. **Matrix** A2. **Priority** P2. **Status** GH built ("Mod Rohani", "Latar Agama", "Simpan").
- **Functional requirements**
  - **FR-AS-A2-1** V3 content kept (V1 parity).
  - **FR-AS-A2-2** Read-only "Tetapan Akaun" block as V2 (e-mel, telefon, sekolah, peranan, status).
  - **FR-AS-A2-3** Responsive RP-FORM.
- **Acceptance criteria**
  - **AC-AS-A2-1** Given Mod Rohani off, when switched on and saved, then reload shows it on.
  - **AC-AS-A2-2 (R)** Given the page, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth and the toggle and "Simpan" are visible and >= 44 px.
  - **AC-AS-A2-3 (U)** Given "Admin Sekolah UAT", when "Tetapan Akaun" shows, then peranan reads "Admin Sekolah" and sekolah equals the user's school.

### R1-AS-A3 Panduan
- **Action: Fix**
- **Screen specification (from V2):** Not observed in V2 for the school admin as a separate screen — follow FR-AS-A3-*; the Panduan page is shared by all roles and is specified in R1-GUR-A3 (the "Admin Sekolah" guide: "Cara Mula Sebagai Admin Sekolah", "Fungsi Admin Sekolah", "Soalan Lazim Admin"). **Current gap:** UAT `GET /api/config/support` returns 404 (`apps/api/.../support.service.ts:113`): return 200 with empty defaults and read the admin setting (OQ-X-1); open on the "Admin Sekolah" tab; align the instructions with the final behaviour of AS-51/52.
#### Field & behaviour spec — R1-AS-A3 Panduan

Same page, cards, accordion and support block as R1-GUR-A3. The default view is the pupil guide; the card "Admin Sekolah" shows its own guide (steps "Hubungi Admin PRESTASIPLUS", "Daftar Guru", "Import Pelajar"). The page has no form field. The query `?peranan=admin-sekolah` opens the Admin Sekolah guide (used by the "Tutorial" link of Senarai Pelajar import). The contact block follows API-SUP-04 and is hidden when the endpoint returns no value.

**Requirements added by this spec**
- **FR-AS-A3-5** The query `?peranan=admin-sekolah` opens the Admin Sekolah guide; without it the pupil guide shows.
- **AC-AS-A3-6** Given `/panduan?peranan=admin-sekolah`, when the page opens, then the guide "Cara Mula Sebagai Admin Sekolah" shows; given `/panduan`, the pupil guide shows.

- **Route** `/panduan`. **Matrix** A3. **Priority** P2. **Status** GH built; UAT `/api/config/support` 404.
- **Reference [V1] M09 Panduan tab "Admin Sekolah"**: cards "Statistik Penggunaan" ("Pelajar aktif, sesi latihan, soalan dijawab — gambaran engagement."), "Urus Pelajar" ("Import pelajar pukal, edit maklumat, pantau senarai seluruh sekolah"), "Urus Guru" ("Daftar guru, edit profil, aktif/nyahaktif akaun guru"), FAQ "Boleh reset kata laluan guru/pelajar? Ya! Dari senarai guru/pelajar, klik nama pengguna, kemudian 'Reset Kata Laluan'." and "Macam mana nak cetak Ringkasan Eksekutif?" / "Amaran Awal → Ringkasan Eksekutif → Cetak / PDF.".
- **Functional requirements**
  - **FR-AS-A3-1** Shows the five role cards as V2 (first view the pupil guide "Cara Daftar Akaun Pelajar"); choosing "Admin Sekolah" shows its guide.
  - **FR-AS-A3-2** Every instruction names a control that exists, including the text about activating teachers (OQ-AS-12) and "Import pelajar pukal" (FR-AS-51-4).
  - **FR-AS-A3-3** The support contact comes from the admin setting "Tetapan Sokongan" through `GET /api/config/support` which always answers 200 (OQ-X-1); the block is hidden when unset.
  - **FR-AS-A3-4** Tabs scroll inside their row at 375.
- **Acceptance criteria**
  - **AC-AS-A3-1** Given a school admin, when `/panduan` opens and the card "Admin Sekolah" is chosen, then the Admin Sekolah guide shows with the FAQ "Boleh reset kata laluan guru/pelajar?".
  - **AC-AS-A3-2** Given the FAQ "Boleh reset kata laluan…", when its path is followed (Senarai Pelajar > pupil > "Reset Kata Laluan"), then the control exists.
  - **AC-AS-A3-3** Given the support setting is not yet saved, when the page opens, then `/api/config/support` returns 200 and no error banner shows.
  - **AC-AS-A3-4 (R)** Given the page, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth and the role tabs are reachable inside their row at >= 44 px.
  - **AC-AS-A3-5 (U)** Given UAT with the support row saved, when "Admin Sekolah UAT" opens the page, then the saved e-mel and telefon show.

### R1-AS-A4 Tiket Bantuan
- **Action: Keep** (built; verify, and show it in the menu in Delivery B)
- **Screen specification (from V2):** Not observed in V2 for the school admin as a separate screen — follow FR-AS-A4-*; the Tiket Bantuan screen is shared by all roles and is specified in R1-GUR-A4 (header "Jumlah tiket: {n}", form with "Subjek" and "Butiran", status tabs, empty "Tiada tiket lagi."). **Current gap:** None in the screen; only the scope filter hides it (`src/app/prototype-scope.ts`, `ACCOUNT_ITEMS` A4 for every role) and the support contact setting (OQ-X-1). Verify the ACs only.
#### Field & behaviour spec — R1-AS-A4 Tiket Bantuan

Same fields, limits, status tabs (OPT-STATUS-TIKET), state machine and messages as R1-GUR-A4 (Subjek max 255, Butiran max 5000, no attachment, toast "Tiket dihantar.", empty "Tiada tiket lagi." with "Buat Tiket Pertama", counter "Jumlah tiket: {n}"). The ticket carries the school of the sender.

**Requirements added by this spec**
- **FR-AS-A4-4** The school admin's ticket form and list behave as R1-GUR-A4 and the ticket stores the sender's school.
- **AC-AS-A4-4** Given a valid ticket from the school admin, when sent, then "Tiket dihantar." shows and the ticket row carries the school of the sender.

- **Route** `/pusat-tuisyen/tiket`. **Matrix** A4 (ticked for every role). **Priority** P2. **Status** built (hidden by scope).
- **Reference** as R1-GUR-A4 (M22; the ticket carries the school).
- **Functional requirements**
  - **FR-AS-A4-1** Create (Subjek, Butiran), list, read the single admin reply and status (OD-4: no thread, no owner reply); own tickets only; reaches the Admin Pusat "Urus Tiket" screen.
  - **FR-AS-A4-2** The support contact uses the same admin setting and 200-always endpoint (OQ-X-1).
  - **FR-AS-A4-3** Every control works; no mock data; responsive as FR-GUR-A4-5.
- **Acceptance criteria**
  - **AC-AS-A4-1** Given "Admin Sekolah UAT" with no tickets, when "Tiket Baru" is sent, then it lists as "Dibuka" and the Admin Pusat tiket screen shows it with the school name.
  - **AC-AS-A4-2** Given another user's ticket id, when opened, then 404.
  - **AC-AS-A4-3 (R)** Given 3 tickets, when opened at 375, 768 and 1280 px, then scrollWidth <= innerWidth, tickets are cards at 375/768, and "Tiket Baru" and the status filter are visible and >= 44 px.

---

## 5. Cross-screen consistency rules (D11/D12)

One definition per measure; each is one named query in the owner module; every listed screen shows the same number for the same scope and window. Scope: "sekolah anda" for AS, "kelas anda" for Guru (Monitoring: the school, 1.4c). Levels: Tingkatan 1-5 everywhere (D101); no screen hard-codes "T4/T5" in a label or a filter.

| Rule | Definition | Owner | Screens that must agree |
|---|---|---|---|
| XS-1 Pelajar berdaftar | Count of pupil accounts (`role = student`) of the scope, Tingkatan 1-5 (Darjah hidden, D72/D96). Inactive accounts are in the total and flagged; the active count is a separate figure. A screen that shows a Tingkatan subset names the subset ("Tingkatan 4") and equals XS-1 filtered to it. | M02 users, M10 enrolment | AS: Senarai Pelajar, Dashboard, Command Center, Prestasi, Analisa Item, Amaran Awal, Statistik Penggunaan, Laporan Bulanan, Laporan Aktiviti, Analitik Adaptif, Monitoring, Kirkpatrick. Guru: Dashboard Guru, Pelajar Saya, Kelas Saya, Command Center, Prestasi, Laporan, Analitik Adaptif, Analisa Item, Laporan Mingguan, Kirkpatrick, Headcount |
| XS-2 Pelajar aktif | Distinct pupils of XS-1 with at least one answer row in the stated window (default "pernah menjawab" = all time). Logging in is not activity. "Aktif 30h" = at least one answer in the last 30 days and says so. | M05 answer log | Command Center ("aktif menjawab"), Monitoring "Pernah Aktif", Kirkpatrick Tahap 3, Statistik Penggunaan, Laporan Bulanan, Laporan Mingguan, Laporan Aktiviti "Murid Buat Latihan", Prestasi class "Aktif 7 Hari" |
| XS-3 Guru | Teacher accounts (`role = teacher`) of the school, approved and not deleted; pending teachers ("Guru Menunggu") and school-admin accounts are excluded. | M02 | AS: Senarai Guru, Dashboard "Jumlah Guru", Prestasi "Guru", Statistik Penggunaan, Monitoring "Guru Berdaftar" (also for the Guru), Laporan Aktiviti "Guru (n)", Kirkpatrick "Guru Aktif" |
| XS-4 Soalan dijawab | Count of answer rows in `practice_answers` (M05, **all modes**, XS-8) of the scope's pupils within the window; default all time, labelled "sepanjang masa"; windowed figures carry the window ("7 hari", "bulan ini"). XS-4b "Soalan" on Dashboard Guru and Sumbang Soalan = questions contributed by the teacher (M04); it is never labelled "Soalan Dijawab". | M05 (M04 for 4b) | Command Center, Prestasi, Analisa Item "Jawapan", Statistik Penggunaan, Laporan Aktiviti, Monitoring, Kirkpatrick Tahap 2, Laporan, Laporan Mingguan, Laporan Bulanan; pupil Prestasi and Penguasaan Subjek; Admin Pusat Command Center, Monitoring, Analitik, Laporan, Kirkpatrick (`30-admin-pusat.md` M-02..M-06) |
| XS-5 Ketepatan | Pooled accuracy = correct answers ÷ answered × 100 over the same rows as XS-4, displayed as a whole-number percent on every screen (the only exception is a Manual headcount AR keyed by the teacher, which may show 1 decimal); a self-marked part counts as correct only at full marks; "—" when there are 0 answers (never 0%, never above 100%). Per-session accuracy appears only inside session tables. "Ketepatan", "Ketepatan Purata" and "Purata Ketepatan" all mean this number. "Skor Purata" (Kirkpatrick Tahap 2, Laporan) is a different, separately named measure: the mean of per-session accuracies; it is never labelled "Ketepatan". | M05 | all screens of XS-4 plus the Amaran Awal "Ketepatan" column, the pupil Analisa Item, Remedial and Analitik cards, and the Admin Pusat screens of XS-4. Display precision follows the precision list of `40-cross-cutting.md` (FR-X4): one precision per metric on every screen |
| XS-6 Scope, windows, headcount | (a) The scope comes from the session, never from the request. (b) Every number names its window or says "sepanjang masa". (c) Seed/UAT dates are relative to now (FR-AS-0-3). (d) "{n} entri headcount" on Dashboard, Prestasi and the Headcount list is one count. (e) Guru "Kelas Aktif" = the teacher's rows of Kelas Sekolah. (f) Headcount status On Track = AR >= OTR target (HC-4, GUR-3) on every screen, pupil view included. | all | all |
| XS-7 Soalan Diuji | Count of **distinct** `question_id` answered by the scope's pupils in the window (from `practice_answers`, all modes). It is not the number of answer rows (that is XS-4). | M05 | Analisa Item (class and school), Admin Pusat Analisa Item views, the pupil Analisa Item |
| XS-8 Answer source | Every pupil answering activity writes its answers to the single answer store `practice_answers` with a mode value: Latih Tubi, Soalan by Chapter, SPM Databank, Kuiz, Bijak sittings including Tracking A, Subjektif self-mark results, Set Soalan Guru (`question_set`), Simulasi, Misi, remedial and question-based games (D-A1). Every report reads that one store and includes all modes: Prestasi, Analisa Item, Analitik, Laporan, Laporan Mingguan, Headcount AR, AS reports, Command Center, Monitoring, Kirkpatrick, Admin Pusat monitoring and reports. A report that excludes a mode says so in its own caption. | M05 | all screens of XS-4, XS-5 and XS-7 |

- **AC-XS-1** Given the demo school (and again the school of "Admin Sekolah UAT"), when XS-1..XS-5 are read from every listed screen for the same scope and window, then they are identical; the current mismatches (pupils 17/16/13, teachers 3/4, answered 122/30/36, accuracy 57.9/73.3/33.3%) are closed or explained by a visible label (a Tingkatan subset, a window).
- **AC-XS-2** Given a pupil added to a teacher's class, when any listed Guru screen is refreshed, then its pupil count rises by exactly 1 on all of them.
- **AC-XS-3** Given the code, then no screen contains a hard-coded display constant for these measures (D11).
- **AC-XS-4** Given a pupil with 10 Latih Tubi answers (7 correct) and one Bijak sitting of 40 MCQ answers (30 correct) (all 50 questions distinct), when the pupil Prestasi, teacher Prestasi Kelas, Admin Sekolah Prestasi and Admin Pusat Laporan are read, then every one shows 50 answers and Ketepatan 74% for that pupil, and "Soalan Diuji" = 50 (XS-7).

---

## 6. Summary, consolidated open questions, register, evidence

### 6.1 Summary table (counts = last FR/AC number of the module; no gaps)

| Module | Role | Delivery | Priority | Current gap (short) | FR | AC |
|---|---|---|---|---|---|---|
| Shell | both | A | **P0** | wrong menu targets | 5 | 5 |
| GUR-A1 Profil Saya | Guru | A | P1 | no Profil Guru, public profile | 8 | 7 |
| GUR-A2 Tetapan Peribadi | Guru | A | P2 | V2 account block | 4 | 4 |
| GUR-A3 Panduan | Guru | A | P2 | default tab, support endpoint 404 | 5 | 5 |
| GUR-A4 Tiket Bantuan | Guru | B | P2 | hidden by scope | 6 | 7 |
| GUR-A5 Log Keluar | Guru | A | P1 | none | 3 | 3 |
| GUR-1 Command Center | Guru | A | P1 | scope caption, drill titles, Evaluate/Badges not click-tested | 14 | 10 |
| GUR-2 Dashboard Guru | Guru | A | P2 | dead tiles | 6 | 8 |
| GUR-2b Misi Harian (child) | Guru | A | P1 | no route | 5 | 7 |
| GUR-3 Headcount | Guru | A | P1 | placeholder pages, forms unspecified | 12 | 17 |
| GUR-4 Prestasi | Guru | A | P2 | none | 7 | 7 |
| GUR-5 Analitik Adaptif | Guru | A | **P0** | menu opens pupil page | 8 | 8 |
| GUR-6 Analisa Item | Guru | A | P1 | data, band contradiction | 10 | 11 |
| GUR-7 Video | Guru | A | P2 | none | 4 | 6 |
| GUR-8 Kelas Saya | Guru | A | P2 | join code to remove | 7 | 9 |
| GUR-8b Set Soalan (child) | Guru | A | P1 | no teacher screen | 11 | 13 |
| GUR-9 Soalan by Chapter | Guru | A | P1 | chapters empty (data) | 6 | 6 |
| GUR-10 Monitoring | Guru | A | P1 | scope, Gap tab | 8 | 8 |
| GUR-11 Kirkpatrick | Guru | A | P1 | admin chrome, false decline | 13 | 10 |
| GUR-41 Pelajar Saya | Guru | A | P2 | Cipta Pelajar silent | 6 | 7 |
| GUR-42 Laporan | Guru | A | P2 | class filter dropped | 7 | 7 |
| GUR-43 Laporan Mingguan | Guru | A | **P0** | 403, no screen, API forbids | 9 | 11 |
| GUR-44 Sumbang Soalan | Guru | A | P1 | paper submit 503, six-tool block | 13 | 14 |
| GUR-44a Soalan & Rujukan (tool) | Guru | A | P1 | no page, no private-question flag | 8 | 9 |
| GUR-44b Soalan Berstruktur (tool) | Guru | A | P1 | admin-only mount, no teacher submit | 8 | 9 |
| GUR-44c Soalan Gambar Rajah (tool) | Guru | A | P2 | admin-only role | 6 | 6 |
| GUR-44d Databank Soalan (tool) | Guru | A | P1 | no teacher page | 7 | 7 |
| GUR-44e Kertas Peperiksaan (tool) | Guru | A | P2 | no teacher page or API | 6 | 6 |
| AS-0 Preconditions | AS | A | **P0** | no UAT AS account | 4 | 2 |
| AS-A5 Log Keluar | AS | A | P1 | none | 3 | 3 |
| AS-1 Command Center | AS | A | P1 | platform card, 16 vs 17 | 7 | 8 |
| AS-3 Headcount | AS | A | **P0** | empty list | 7 | 7 |
| AS-4 Prestasi | AS | A | P1 | numbers | 7 | 8 |
| AS-5 Analitik Adaptif | AS | A | **P0** | empty page, forbidden route | 7 | 6 |
| AS-6 Analisa Item | AS | A | P1 | numbers | 6 | 6 |
| AS-7 Video | AS | A | P2 | none | 3 | 4 |
| AS-10 Monitoring | AS | A | P1 | filters, 4 vs 3 teachers | 6 | 6 |
| AS-11 Kirkpatrick | AS | A | **P0** | six screens not reachable (404), dead "Tahap 1" | 6 | 8 |
| AS-45 Sekolah Bersaing | AS | A | **P0** | empty board | 6 | 6 |
| AS-46 Statistik Penggunaan | AS | A | P1 | zero in 30 days | 5 | 5 |
| AS-47 DSKP Heatmap | AS | A | P1 | all cells empty | 6 | 6 |
| AS-48 Laporan Aktiviti | AS | A | P2 | empty axis | 6 | 6 |
| AS-49 Amaran Awal | AS | A | P1 | false alarms | 7 | 7 |
| AS-50 Laporan Bulanan | AS | A | P1 | thin report | 6 | 7 |
| AS-51 Senarai Pelajar | AS | A | P1 | no import, no class filter | 13 | 13 |
| AS-52 Senarai Guru | AS | A | P2 | count mismatch | 8 | 7 |
| AS-53 Kelas Sekolah | AS | A | P2 | no drill, code column | 5 | 6 |
| AS-2 Dashboard | AS | B | P1 | Perutusan route missing | 6 | 7 |
| AS-A1 Profil Saya | AS | B | P2 | school block | 4 | 4 |
| AS-A2 Tetapan Peribadi | AS | B | P2 | account block | 4 | 4 |
| AS-A3 Panduan | AS | B | P2 | support endpoint 404 | 5 | 6 |
| AS-A4 Tiket Bantuan | AS | B | P2 | hidden by scope | 4 | 4 |
| Cross-screen rules | both | A | **P0** | inconsistent numbers | XS-1..8 | 4 |

**Totals (unique IDs, verified by search on the file):** Guru 27 module sections (20 matrix rows: A1-A5, 1-11, 41-44, plus the child modules 2b, 8b and the five Sumbang Soalan tool modules 44a-44e; 26 in Delivery A, A4 in Delivery B) with 207 FR and 222 AC; Admin Sekolah 24 module sections (18 Delivery-A matrix rows A5, 1, 3-7, 10, 11, 45-53; 5 Delivery-B rows 2, A1-A4; plus the AS-0 precondition) with 141 FR and 146 AC; shell 5 FR and 5 AC; cross-screen rules XS-1..XS-8 with 4 AC. Combined: 51 module sections, 348 module FRs and 368 module ACs (353 FRs and 373 ACs with the shell items, plus 4 cross-screen ACs = 377). The merge of the field and behaviour register (§0A, the "Field & behaviour spec" subsections, §A1, §A2) added 63 FRs and 75 ACs: Guru +38 FR and +49 AC, Admin Sekolah +25 FR and +26 AC. The new FR and AC of a module are listed in its "Field & behaviour spec" subsection under "Requirements added by this spec" and continue the numbering of the module. Headcount computation spec: HC-SPEC (HC-1..HC-6) inside R1-GUR-3.
P0 list: GUR-43, GUR-5, AS-5, AS-11, AS-3, AS-45, AS-0, cross-screen consistency, shell menu targets.

### 6.1b Action table (user rule: close, fix and improve the gaps only; never rebuild from scratch; FR-X1-5)

| Action | Meaning | Guru modules | Admin Sekolah modules | Count |
|---|---|---|---|---|
| **Keep** | matches already; verify the ACs only | A4, A5, 7 | A4, A5, 7 | 3 + 3 = **6** |
| **Fix** | wrong today (change existing code) | A3, 2, 5, 6, 8, 10, 11, 41, 42, 44 | A3, 1, 3, 4, 5, 6, 10, 45, 46, 49, 52 | 10 + 11 = **21** |
| **Complete** | partly built (add the missing parts) | A1, A2, 1, 3, 4, 9, 44b, 44c | A1, A2, 2, 11, 47, 48, 50, 51, 53 | 8 + 9 = **17** |
| **Build** | missing (new code) | 2b, 8b, 43, 44a, 44d, 44e | 0 (the UAT account and seed) | 6 + 1 = **7** |
| Total | | 27 | 24 | **51** |

Notes: GUR-3 stays "Complete" because the config screens exist and only the four placeholder pages, the V2 per-subject landing and the Auto/Manual rules are added; GUR-4 is "Complete" (V2 aggregate sections added to the existing picker and class pages); AS-45 is "Fix" (same page and route, new data source and columns); the Guru Monitoring and Kirkpatrick are "Fix" (the V2 pages are existing components mounted and trimmed, not new screens).

### 6.2 Decisions on the former open questions (all decided; none open)

| ID | Question | Decision |
|---|---|---|
| OQ-AS-1 | `/admin-sekolah/*` in the learning shell conflicts with `v2-portals.md` (AS inside Portal Pentadbiran). | **Decided (by principle, 2026-11-04):** Keep `/admin-sekolah/*` in the learning shell for both deliveries; Delivery A landing = Command Center, Delivery B landing = `/admin-sekolah`. |
| OQ-AS-3 | May a school admin create headcount? | **Decided (by principle, 2026-11-04):** No; read-only (FR-AS-3-5). |
| OQ-AS-5 | "Rekod Intervensi" on AS Analitik Adaptif? | **Decided (by principle, 2026-11-04):** Hidden. |
| OQ-AS-6 | Sekolah Bersaing: V2 live (accuracy ranking, captured) versus V1 (weekly snapshot with "% Aktif", "Streak Avg"). | **Decided (by principle, 2026-11-04):** follow V2 (primary); the V1 weekly board is dropped (R1-AS-45), as already applied. |
| OQ-AS-7 | Statistik Penggunaan layout [PRINCIPLE]. | **Decided (by principle, 2026-11-04):** As built. |
| OQ-AS-8 | DSKP Heatmap axes [PRINCIPLE]; Import Pelajar approval rule. | **Decided (by principle, 2026-11-04):** As specified; imports pending Admin Pusat approval (V2). |
| OQ-AS-9 | Real V1 href of Laporan Aktiviti. | **Decided (by principle, 2026-11-04):** Keep `/admin-sekolah/laporan-aktiviti`. |
| OQ-AS-10 | No-data pupils in Amaran Awal. | **Decided (by principle, 2026-11-04):** "Belum Bermula" outside the risk groups. |
| OQ-AS-11 | Laporan Bulanan versus Ringkasan Eksekutif. | **Decided (by principle, 2026-11-04):** Keep both. |
| OQ-AS-12 | May the school admin deactivate teachers (Panduan yes, V2 server no)? | **Decided (by principle, 2026-11-04):** Follow the V2 server: approve pending only; update the Panduan text. |
| OQ-AS-13 | Drill links on Kelas Sekolah. | **Decided (by principle, 2026-11-04):** Add. |
| OQ-AS-14 | "Langganan" card target on the Dashboard. | **Decided (by principle, 2026-11-04):** None; read-only status. |
| OQ-G-2 | Public teacher profile in 1.0? | **Decided (by principle, 2026-11-04):** Yes, minimal (the tile and link exist). |
| OQ-G-3 | V2 read-only account block on Tetapan? | **Decided (by principle, 2026-11-04):** Add. |
| OQ-G-4 | V2 coin chip and bell for Guru? | **Decided (by principle, 2026-11-04):** No (not in the matrix). |
| OQ-G-13 | Misi Harian as a child page only? | **Decided (by principle, 2026-11-04):** Yes (D106; no sidebar item). |
| OQ-G-14 | Set visibility rule. | **Decided (by principle, 2026-11-04, D-A7):** a set is assigned to explicitly selected own class(es); pupils see only sets assigned to their class; results return per class (FR-GUR-8b-3, 8b-5). |
| OQ-G-15 | V2 Sumbang Soalan has an "Alat Soalan" block linking six teacher tools; only Set Soalan is specified here; the other five (Soalan & Rujukan, Soalan Berstruktur, Soalan Gambar Rajah, Databank Soalan, Kertas Peperiksaan) are not matrix rows but D106 says a module linked from a 1.0 screen ships with 1.0. | **Decided (2026-11-04): all six tools in R1 scope**, per the principle that every V2 function under a 1.0 matrix module must work. Specified as R1-GUR-8b (Set Soalan) and R1-GUR-44a to 44e (Soalan & Rujukan, Soalan Berstruktur, Soalan Gambar Rajah, Databank Soalan, Kertas Peperiksaan). |
| OQ-G-16 | New with OQ-G-15: V2 captures are incomplete for the tools (no list page of Soalan & Rujukan, no create form of Soalan Berstruktur, no teacher view of Soalan Gambar Rajah, no screen after "Cipta Baharu" of Kertas Peperiksaan); and V2's "Tambah Soalan" on Sumbang Soalan opens the private-question form. | **Decided (by principle, 2026-11-04):** Follow the [PRINCIPLE] FRs in R1-GUR-44a to 44e; they govern where V2 was not captured. |
| OQ-X-1 | The support contact ("Tetapan Sokongan": e-mel, telefon, WhatsApp, waktu) read by Panduan and Tiket Bantuan has no row in `30-admin-pusat.md` (its `/admin/settings` is "deferred, hidden"). | **Decided (by principle, 2026-11-04):** The Admin PRD carries the P1 row "Tetapan Sokongan" (V2 `/admin/settings`, `30-admin-pusat.md` FR-ADM-N07) and it is seeded on UAT; the endpoint stays 200-always. |
| OQ-X-2 | `10-murid.md` R1-MUR-3 follows HC-SPEC (R1-GUR-3, HC-1..HC-6) for the Auto/Manual chip, the Manual AR rule and OTR; the old 65 expectation (TOV 40, RS 80) was wrong because the formula (0.66) gives 66. | **Decided (2026-11-04, D-A3):** OTR2 = 66; R1-MUR-3 refers to HC-SPEC (GUR-3) and defines no rule of its own. |
| OQ-X-3 | `10-murid.md` FR-MUR-8-3 ("Sertai" by class code) contradicts V2 and D77. | **Closed (2026-11-04):** removed; the teacher adds pupils (GUR-8). |

Closed in this pass: OQ-AS-4 (D108(5)), OQ-G-5, OQ-G-6, OQ-G-8, OQ-G-9, OQ-G-12.

### 6.2b Register of current "akan datang" / "belum tersedia" / prototype notices and dead controls (D102), each is a gap

| # | Where (file:line) | Notice / defect | Module | Required outcome |
|---|---|---|---|---|
| 1 | `src/modules/m11-teacher-analytics/routes/laporan-mingguan.ts:12-27` (component `PrototypeUnavailablePage.vue` at 16; title "Belum Tersedia dalam Prototaip" at 21) | Guru Laporan Mingguan screen is a "belum tersedia" page | GUR-43 | Full screen (V2 `guru/laporan-mingguan.blade.php`) |
| 2 | `src/shells/nav/user-nav.ts:287`; `m08-student-performance/routes/prestasi.ts:95-106` (`roles: []`); `apps/api/.../weekly-report.service.ts:5-11` | Menu points to a route that is 403 for every role | GUR-43 | Menu -> `/guru/laporan-mingguan-kelas`; teacher API |
| 3 | `src/app/prototype-scope.ts:28-30,56-59`; `src/app/LayoutHost.vue:51,54` | Global "Belum tersedia dalam prototaip" page and the known-gaps note | all | Never shown for a ticked row; outside the matrix = standard 404 |
| 4 | `m08-student-performance/routes/headcount.ts:69-92` -> `pages/HeadcountShellPage.vue:1-45` | Four Headcount sub-pages are shells with only a back link | GUR-3, AS-3 | Working pages (GUR-3) |
| 5 | `m10-teacher-class/components/soalan/lib.ts:28`, `HantarKertasCard.vue:70-73`; `apps/api/.../question-sets.ports.ts:46,56` | "Muat naik kertas soalan belum tersedia buat masa ini." (503); admin "Kiriman Guru": "Fungsi ini belum tersedia dalam demo" | GUR-44 | Working paper intake and admin list |
| 6 | `m10-teacher-class/components/dashboard/copy.ts:84-96`, `ChecklistCard.vue`, `pages/GuruDashboardPage.vue:147` (`allows(q.to)`) | Checklist "Misi harian pertama" and tile "Edit Profil Guru" dead/hidden | GUR-2, GUR-A1, GUR-2b | Working targets |
| 7 | `m10-teacher-class/components/dashboard/copy.ts:91` | `/guru/profil/edit` has no route | GUR-A1 | Profil Guru page |
| 8 | `src/shells/nav/user-nav.ts:284`, `:398`; `m08-student-performance/routes/class.ts:33` | Analitik Adaptif opens the pupil page; AS not allowed on `/analitik/kelas` | GUR-5, AS-5 | `/analitik/kelas` for both |
| 9 | `m12-kirkpatrick/routes/mount.ts:32-38`; `routes/overview.ts:39`; `pages/KirkpatrickOverviewPage.vue:5,37-38` | AS Kirkpatrick: "Tahap 1" click does nothing; `/admin-sekolah/kirkpatrick/reaction` is 404; filter shows "Semua Sekolah/Semua Negeri" | AS-11 | All seven screens, school-scoped, no filter |
| 10 | `m12-kirkpatrick/routes/mount.ts:25-30` | Guru Kirkpatrick mounts in the admin chrome | GUR-11 | Teacher shell |
| 11 | `m08-student-performance/mock/handlers/headcount.ts:105-113`; `apps/api/.../headcount.service.ts:114,121` | AS Headcount list empty (own configs only) | AS-3 | School scope |
| 12 | `m16-battle-games/mock/data/sekolah-bersaing-seed.ts:219` (`SB_WEEKS`) | "Data minggu ini belum dijana." | AS-45 | Current or last week |
| 13 | `src/shells/nav/user-nav.ts:385` (`sa-import-pelajar`, hidden) | Import Pelajar unreachable | AS-51 | Action on Senarai Pelajar |
| 14 | `src/shells/nav/user-nav.ts:411` (`/perutusan`), M09-T4b not built | Dashboard "Lihat semua →" dead | AS-2 | Working `/perutusan` |
| 15 | `apps/api/.../amaran/risk.rules.ts:63-76` | No-data pupils scored Merah | AS-49 | "Belum Bermula" |
| 16 | `m27-school-admin/mock/read-models/*`, `components/monthly/SubjectPerformance.vue` | Fixed-date seed data, hidden subject section | AS-46, 47, 50 | Relative-date data, sections always rendered |
| 17 | `m10-teacher-class/mock/data/designed.ts` and other `mock/**` | Mock/designed data used by pages | all | Real API only (FR-X2-0) |
| 18 | `m18-ppd-jpn/routes.ts:14-22` | "Belum tersedia" for officers | not Guru/AS | Out of this PRD |
| 19 | UAT `GET /api/config/support` 404 | Panduan error banner | GUR-A3, AS-A3, A4 | 200 always; admin setting (OQ-X-1) |
| 20 | `m10-teacher-class/pages/CommandCenterPage.vue:86-170` | Remedial/Evaluate/Badges not click-tested | GUR-1 | FR-GUR-1-5, 1-8, 1-9 |
| 21 | V3 teacher Kelas Saya join code and "Kod QR" (V3-only) | Feature V2 does not have, conflicts with R1-MUR-8 text | GUR-8 | Removed (C7) |
| 22 | Pupil `Set Soalan Guru` empty state (R1-MUR-26) and no teacher Set Soalan screen | No feed for the pupil screen | GUR-8b | Teacher Set Soalan screens |

### 6.3 Evidence status after the V2 observations (user rule: nobody opens V1/V2; everything observed is written into the "Screen specification (from V2)" subsections)

**Closed by the captures (now facts in the modules):** (a) V2 for the school admin: Command Center, Aktiviti Harian, Monitoring, Laporan, Laporan Eksekutif, Kirkpatrick Ringkasan/T1/T2, Sekolah Bersaing, Senarai Pengguna, pupil edit form, Import Pelajar are captured; `/headcount` is 403 and `/prestasi`, `/analitik/kelas`, `/analisa-item` redirect to `/admin` (so AS rows 3, 4, 5, 6 have no V2 screen); (b) the school-admin Sekolah Bersaing is V2's live accuracy ranking (replaces the V1 weekly board, OQ-AS-6 now "confirm V2 over V1"); (c) V2 teacher Monitoring is the school detail page; all seven Guru Kirkpatrick screens and the Guru Dashboard, Command Center, Headcount (per-subject TOV/RS), Laporan, Laporan Mingguan, Analitik Kelas, Analisis Item, Kelas, Cipta Kelas, Pelajar, Set Soalan, Misi Harian, Sumbang Soalan, Profil, Tetapan, Panduan, Tiket, Video are captured (empty-state data only); (d) V2's Guru Kirkpatrick scope is the teacher's classes (tables "Mengikut Kelas") although its banner says "sekolah anda"; (e) the support-ticket form has only "Subjek" and "Butiran".

**Not observed in V2 (decided: the FRs of each module govern these pages and states, together with the generic loading, empty and error rules of FR-X6, D113; nothing here blocks a card):**
1. Admin Sekolah: Kirkpatrick Tahap 3, Tahap 4, Rantaian Impak, Intervensi, pupil detail and PDF; Video; Amaran Awal (school); Dashboard Sekolah (V1 only); Profil Saya, Tetapan, Panduan, Tiket for the school admin; the teacher edit form and teacher rows of the user list; populated rows of every list (names are blurred); the columns after "Sekolah" in the user table; the "Tambah Pelajar" form; whether V2 imported accounts are active or pending approval; whether the school admin may suspend a teacher.
2. Guru (populated states; the capture account has no class): class dashboard and its pupil list, Kelas edit page with "Tambah Pelajar Baharu" / "Tambah pelajar sedia ada", populated Headcount (values, "Simpan Sasaran" result), populated Laporan Mingguan, Analitik Kelas rows, Analisa Item class page, Analisis Item rows, Set Soalan results, Misi Harian own-mission rows, Monitoring pupil and teacher rows and the pupil/teacher detail pages, Kirkpatrick populated tables and the Intervensi after-review row, Command Center drill modals, "Imbas Topik Lemah" and Badges outputs, the public profile page `/guru/profil/{id}`, the second part of the Video form, the ticket thread page.
3. Both: the V3 UAT school-admin account (none), the origin of the 3 versus 4 teachers and 16 versus 17 pupils on GH, click tests on GH.

**Original list (kept for traceability; items closed above are struck by the block above):**
1. UAT school-admin account (none exists) to run all AS "(U)" ACs.
2. V2 live as school admin: the 41 of 80 admin menus not captured (IP block); the scoped views of `/admin/laporan`, `/admin/monitoring`, `/admin/kirkpatrick` and `/admin/laporan-eksekutif`.
3. V1 live school-admin content for rows 46, 47, 48 (real href), 50, 51, 52, 53 and the four Dashboard stat cards.
4. V1 live teacher account: what Monitoring and Kirkpatrick show a teacher; populated Analisa Item and Analisis Item; populated Headcount and any Key-in AR / Edit TOV/ETR / Unjuran / Tetapan forms (the forms in GUR-3 are derived, not observed); Evaluate and Badges behaviour; the V2 Set Soalan "Salin" class-visibility rule.
5. Which account is the 4th "guru" counted by Prestasi/Monitoring on GH (3 on Senarai Guru), why Command Center shows 16 pupils against 17, and the origin of 122/30/36 answers (`m27-school-admin/mock/read-models/*` versus M08/M11/M12).
6. Sekolah Bersaing for a school admin: own-school highlight, state filter, rank formula.
7. Click tests on GH for Command Center Remedial/Evaluate/Badges, Prestasi Tingkatan/Kelas buttons and the Laporan Aktiviti Guru/Murid tabs.
8. Whether UAT questions will be mapped to DSKP chapters (Admin PRD) for GUR-9, AS-47, GUR-6.

---

## A1. Option sets used here

`40-cross-cutting.md` §X11 is the master copy of every set below; if the two differ, §X11 wins. Each set is defined once; screens cite the id.

| OPT id | Definition |
|---|---|
| OPT-TINGKATAN | Display order and stored grade: "Tingkatan 1" = 1, "Tingkatan 2" = 2, "Tingkatan 3" = 3, "Tingkatan 4" = 4, "Tingkatan 5" = 5 (stored through the education level whose `grade` is 1 to 5). Darjah is never offered (D72, D96, D101). First option per screen (value empty): Set Soalan "— Tiada —"; Set Soalan filter "Semua tingkatan"; private question list filter "-- Semua tahap --"; Hantar Kertas "-- Semua / Tidak Pasti --"; Soalan Berstruktur "Semua"; Admin Sekolah filters "Semua Tingkatan"; class form "-- Pilih tingkatan --". Headcount Auto-Setup labels "T1" to "T5" mean 1 to 5. |
| OPT-SUBJEK | Every active subject of the subjects table (§0A Subject lists); stored value = the subject id, label = BM name; source the existing subject list (API-DSKP-01 `GET /api/subjects`). Order "V2": Bahasa Melayu, Bahasa Inggeris, Matematik, Sains, Sejarah, Pendidikan Islam, Pendidikan Moral, Matematik Tambahan, Fizik, Kimia, Biologi, Geografi, Pendidikan Seni Visual, Pendidikan Muzik, Pendidikan Jasmani & Kesihatan, Reka Bentuk & Teknologi, Sains Komputer, Bahasa Arab, Bahasa Cina, Bahasa Tamil, Prinsip Perakaunan, Ekonomi, Perniagaan, Pendidikan Al-Quran & As-Sunnah, Tasawwur Islam, Jawi, Pendidikan Syariah Islamiah, Sains Rumah Tangga, Pembuatan Pakaian Wanita, Pertanian, Sains Sukan. Variant "A-Z" (Analisa Item, Soalan Berstruktur filter, Kertas, Gambar Rajah): the same set sorted by BM name ascending with Malay collation. First option per screen: forms "-- Pilih subjek --" (Kertas "— Pilih Subjek —", class form "— Tiada —"); filters "Semua Subjek" (Analitik, Analisa Item), "Semua subjek" (Set Soalan filter), "Semua Mata Pelajaran" (Gambar Rajah), "Semua" (Soalan Berstruktur). Where a screen needs only subjects with Tingkatan 1-5 content (Soalan by Chapter, Heatmap) the list is limited to subjects with at least one servable question. |
| OPT-KESUKARAN | "⭐ — Sangat mudah" = 1, "⭐⭐ — Mudah" = 2, "⭐⭐⭐ — Sederhana" = 3, "⭐⭐⭐⭐ — Sukar" = 4, "⭐⭐⭐⭐⭐ — Sangat sukar" = 5; stored in `question_versions.difficulty_level` (smallint 1 to 5); lists show "⭐" repeated n times. Typed by the teacher and editable; independent of TP (D-A6). Default: once a TP is chosen the form pre-fills min(5, TP) until the teacher changes Kesukaran; changing TP afterwards never overwrites a value the teacher touched; with no TP chosen the first option is "-- Pilih kesukaran --" (OPT-KESUKARAN in 40 X11, R1 decision D113). |
| OPT-TP | "1" to "6" = 1 to 6; stored in `question_versions.difficulty_tp`; label "Tahap Penguasaan (TP)"; first option "-- Pilih TP --"; error "Tahap Penguasaan (TP) mesti antara 1 dan 6." |
| OPT-ARAS | Bloom cognitive level (the pupil "Aras KBAT" filter LOTS 1 to HOTS 6 is a different set, OPT-ARAS-KBAT in 40 X11), stored as the contract values: "Mengingat" = `mengingat`, "Memahami" = `memahami`, "Mengaplikasi" = `mengaplikasi`, "Menganalisis" = `menganalisis`, "Menilai" = `menilai`, "Mencipta" = `mencipta`. Label "Aras Pemikiran"; first option "-- Pilih aras --". The KBAT chip is derived and not stored: Mengingat and Memahami = "LOTS", Mengaplikasi = "MOTS", Menganalisis, Menilai and Mencipta = "HOTS". The BM labels are the R1 decision D113. |
| OPT-JENIS-HANTARAN (alias OPT-KERTAS in earlier drafts of this file; OPT-KERTAS now means Kertas 1 to 4 only) | Hantar Kertas type, label to stored `intake_batches.paper_type`: "Soalan Umum" = `umum`, "Trial Paper" = `trial`, "Soalan DSKP" = `dskp` (ADD-08 (DM-72)), "Buku Teks" = `buku_teks` (ADD-08), "Buku Latihan" = `buku_latihan`, "Soalan Peperiksaan" = `peperiksaan`, "Lain-lain" = `lain` (last, in the select only; the six information chips omit "Lain-lain"). First option "-- Pilih Jenis --". On acceptance the admin side maps the value to OPT-JENIS-KERTAS as written in 40 X11. |
| OPT-PERANAN (alias OPT-ROLE) | Stored in `user_roles.role`: "Pelajar" = `student`, "Guru" = `teacher`, "Admin Sekolah" = `school_admin`, "Pegawai PPD" = `ppd_officer`, "Admin" = `admin`. The school admin sees Pelajar and Guru only; the role control on the pupil form is read-only text. |
| OPT-STATUS-SOALAN | `review` = "Menunggu Semakan" (amber chip), `approved` = "Diluluskan" (green chip), `draft` returned by the admin = "Ditolak" (red chip, shows the reason). |
| OPT-STATUS-SET | `draft` = "Draf", `published` = "Diterbitkan". Paper (Kertas): `draft` = "Draf", `published` = "Dikongsi". |
| OPT-STATUS-TIKET | Label to stored `support_tickets.status`: "Dibuka" = `dibuka`, "Dalam Proses" = `dalam_proses`, "Menunggu Balas" = `menunggu_balas`, "Selesai" = `selesai`, "Ditutup" = `ditutup`; the tab "Semua" applies no filter. |
| OPT-STATUS-AKAUN | List filter: "Semua" (empty), "Aktif" = `active` (is_active and not suspended), "Tidak Aktif" = `inactive` (not is_active: imported and pending, includes pending). Edit radios: "Aktif (boleh log masuk)" = `active`, "Digantung" = `suspended` (`users.is_suspended`). A pending teacher has `users.pending_school_id` set. |
| OPT-STATUS-MISI | Nothing is stored; the display badge "Global" marks platform missions. |
| OPT-KELAS-OWN | Source API-GUR-01: classes with `classrooms.teacher_id` = the teacher, active, of the current year (past years only when a year filter is chosen). Option label = class name, value = `classrooms.id`; sort by Tingkatan ascending then name ascending (Malay collation). First option per screen: "Semua Kelas" (filters), "-- Pilih kelas --" (forms), "Semua kelas saya" (Misi). A teacher without classes sees the control disabled with the no-class copy of the screen. |
| OPT-JULAT | Pills "7 Hari" = 7, "30 Hari" = 30 (default), "3 Bulan" = 90; query `range`; any other value is treated as 30. |
| OPT-TEMPOH (alias OPT-TEMPOH-AS) | Select: "Semua Masa" = `all` (default), "7 Hari" = 7, "30 Hari" = 30, "3 Bulan" = 90. Statistik Penggunaan pills: "Hari Ini" = 1, "7 Hari" = 7, "30 Hari" = 30 (default 30). |
| OPT-RISIKO | Select: "Semua Risiko" (empty, default), "Kritikal" = `kritikal`, "Tinggi" = `tinggi`, "Sederhana" = `sederhana`, "Rendah" = `rendah`; the row-only value "Belum Bermula" = `belum_bermula` (no answers, not selectable). Rule on the whole-number accuracy: below 40 Kritikal; below 55 Tinggi; below 70 Sederhana; otherwise Rendah. |
| OPT-KESUKARAN-ITEM | Analisa Item filter: "Semua Tahap" (empty, default), "> 70% (Mudah)" = `mudah`, "40–70% (Sederhana)" = `sederhana`, "< 40% (Sukar)" = `sukar`. Bands on % Betul rounded to a whole number: above 70 Mudah; 40 to 70 inclusive Sederhana; below 40 Sukar. |
| OPT-ENGAGEMENT | Non-overlapping bands over each pupil's all-time answers in scope (R1 decision D113; the V2 ranges overlap at 5, 20 and 50): "Champion" 51 or more (label ">50 soalan"); "Konsisten" 20 to 50 ("20-50 soalan"); "Berkembang" 5 to 19 ("5-19 soalan"); "Minimum" 1 to 4 ("1-4 soalan"); "Tidak Terlibat" 0 ("0 soalan"). |
| OPT-GRED | After rounding to a whole number (half away from zero): A+ 90 to 100, A 80 to 89, A- 70 to 79, B+ 65 to 69, B 60 to 64, C+ 55 to 59, C 50 to 54, D 45 to 49, E 40 to 44, G below 40; grade points A+ 0, A 1, A- 2, B+ 3, B 4, C+ 5, C 6, D 7, E 8, G 9; GPS = mean grade point. |
| OPT-NEGERI | Used only by Admin Pusat and PPD views (first option "Semua Negeri", then the 16 states and federal territories); it is not shown to the Admin Sekolah (scope is one school). |
| OPT-JENIS-INTERVENSI | Label to stored `interventions.alert_type`: "Akademik (prestasi rendah)" = `declining`, "Kesejahteraan / mood" = `mood`, "Kehadiran" = `inactive`, "Lain-lain" = `other` (ADD-05); first option "-- Pilih jenis --". |
| OPT-HEATBAND | "Mahir (75%+)" accuracy 75 or more; "Sederhana (50-74%)" 50 to 74; "Lemah (<50%)" below 50; "Belum Cuba" no answers (the cell shows "-"). |
| OPT-BULAN | "Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember" = 1 to 12; chart short labels Jan, Feb, Mac, Apr, Mei, Jun, Jul, Ogo, Sep, Okt, Nov, Dis. |
| OPT-FAITH (alias OPT-LATAR-AGAMA) | Select `id="faith"` (the existing V3 `FAITH_OPTIONS`), section heading "🌍 Latar Agama (opsyen)", sub-text "Bagi konteks supaya kandungan lebih relevan. Tidak diwajibkan.", row label "Agama / kepercayaan", help "Untuk mod rohani yang sesuai." Options, label to stored `user_settings.faith`: "— Tidak nyatakan —" = not sent (null); "Islam" = `muslim`; "Hindu" = `hindu`; "Buddha" = `buddhist`; "Kristian" = `christian`; "Tiada" = `none`. Default = the stored value, else "— Tidak nyatakan —". |

---

## A2. Data/API additions required

These are needed by the merged field and behaviour spec and are registered in `50-data-model-erd.md` and `60-api-contract.md`. ADD-n are working labels cited in the module subsections; the registered IDs are in the last column.

| Id | Addition (name) | Purpose | Module | 50 / 60 ID |
|---|---|---|---|---|
| ADD-01 | Unique index on `classrooms (teacher_id, academic_year, lower(name))` where `kind` = `classroom` | Unique class name per teacher and year; duplicate answers 409 "Nama kelas sudah digunakan." | GUR-8 | DM-73 |
| ADD-02 | Unique index on `users (school_id, lower(username))` where username is not null | Unique username per school; generated pupil usernames and the AS-51 rule | GUR-8, GUR-41, AS-51 | DM-74 |
| ADD-03 | `missions`: `description text null`, `reward_coins smallint null` (0 to 10000), `scope text not null default 'teacher'` (`teacher` or `global`), `mission_type` value `harian`, `subject_id` made nullable; recipients in `mission_items` | Misi Harian fields (Tajuk, Keterangan, Sasaran = `question_count`, Ganjaran, Tarikh = `mission_date`, Kelas = `classroom_id`) and the Global badge | GUR-2b | DM-75, API-GUR-11 |
| ADD-04 | `question_sets.education_level_id bigint null` | Field "Tingkatan (pilihan)" of Set Soalan | GUR-8b | DM-46 (extended), API-GUR-16 |
| ADD-05 | `interventions.alert_type` check extended with `other` | "Lain-lain" of OPT-JENIS-INTERVENSI | GUR-11, AS-11 | DM-30 (extended) |
| ADD-06 | `intake_batches.source text not null default 'admin'` (`admin` or `guru`) | Tab "Kiriman Guru" and the origin of teacher submissions | GUR-44, GUR-44b | DM-72 |
| ADD-07 | `intake_batches`: `kertas` and `year` nullable; `subject` accepts free text up to 100 characters when `source` = `guru`; `rights_status` defaults to `own` for `guru`; `source_text` filled from "Disediakan Oleh" (max 200, default "Kiriman guru") | Teacher paper form has no Kertas, an optional Tahun and a free-text Matapelajaran | GUR-44 | DM-72 |
| ADD-08 | `intake_batches.paper_type` check extended with `dskp` and `buku_teks` (and the stored values of OPT-JENIS-HANTARAN replace the earlier English slugs) | "Soalan DSKP" and "Buku Teks" of OPT-JENIS-HANTARAN | GUR-44 | DM-72 (slugs `umum, trial, dskp, buku_teks, buku_latihan, peperiksaan, lain`; legacy `paper_type` values mapped by the migration; mapping to `source_papers.exam_type` on accept per 40 OPT-JENIS-HANTARAN) |
| ADD-09 | API-GUR-17 amended: file types PDF, DOCX and XLSX (images not accepted; the SRS wins over the contract); body gains `paperType`, free-text subject, `levelId?`, `year?`, `preparedBy?`, `note?` and the boolean answer-scheme confirmation | Hantar Kertas Soalan behaviour | GUR-44 | API-GUR-17 (extended) |
| ADD-10 | API-AS-06 amended: limits 2 MB and 1000 rows (the V2 caption), `level` T1 to T5, `dryRun` is the preview step | Student import | AS-51 | API-AS-06 (extended; 2 MB, 1000 rows) |
| ADD-11 | API-GUR-22 body amended: `{name, bio, ic?, schoolId, subject, qualification, experienceYears, phone?}` | Profil Saya fields (qualification, years of experience, IC and school) | GUR-A1 | API-GUR-22 (extended) |
| ADD-12 | API-GUR-18 create and update body gains `difficultyLevel`, `tp`, `cognitiveLevel`, `chapterId`, `spId` (the last four optional where D112 allows) | Teacher question form | GUR-44 | API-GUR-18 (extended) |
| ADD-13 | Teacher structured-question submission: `POST /api/guru/structured-questions` and `PUT /:id` (own `review` or `draft`) with stimulus text, image (`question_image`) and 1 to 10 parts; creates an intake batch with `source` = `guru` | Soalan Berstruktur form | GUR-44b | API-GUR-26 (extended with POST/PUT) |
| ADD-14 | API-RPT-10 `PUT /api/headcounts/:id/tov` accepts optional `rsRecordedAt` (not in the future) | "Tarikh Rekod RS" | GUR-3 | DM-49 (extended), API-RPT-10 |
| ADD-15 | Intervention review: `POST /api/kirkpatrick/interventions/:id/review` writes `after_accuracy` (accuracy of the 14 days after the record), allowed 7 days or more after `action_date` | "Semak keputusan" | GUR-11, AS-11 | DM-30 (extended), API-RPT-17 (new) |
| ADD-16 | API-AS-05 list accepts `level` (T1 to T5) and `classroomId` filters | Tingkatan and Kelas filters of Senarai Pelajar | AS-51 | API-AS-05 (extended) |
| ADD-17 | Teacher diagram image submission: `POST` of one image (`jpg`, `png`, `webp`, at most 5 MB) for a question that needs a figure; the image stays pending until an admin accepts | "Upload per card" of Soalan Gambar Rajah | GUR-44c | API-Q-21 (extended) |
| ADD-18 | Teacher video create: body `{title, url, subjectId?, category}`; `videos.category` accepts `motivasi`, `tutorial`, `tips_spm`, `ceramah`, `lain`; stored with `visibility` = `school` and the teacher's `school_id`; list shows global videos plus the own school's | Video form | GUR-7 | DM-76, API-MUR-05 (extended) |
| ADD-19 | API-GUR-16 gains `GET /api/guru/question-sets/:id/results?classroomId=` and the copy body `{classroomIds}` | Results per class and "Salin" | GUR-8b | API-GUR-16 (extended) |
| ADD-20 | API-AS-07 create-teacher body gains `subject`, `qualification`, `ic?`, `password?` | Cipta Pengguna form of Senarai Guru | AS-52 | API-AS-07 (extended) |
| ADD-21 | API-GUR-24 delete returns 409 "Soalan sedang digunakan dalam misi." while an active Misi draws the question | Private question delete guard | GUR-44a | API-GUR-24 (extended) |
| ADD-22 | API-GUR-19 limits: `.csv` only, 2 MB, 500 data rows; the error file is generated on the client from the response | Question CSV import | GUR-44 | API-GUR-19 (extended) |

**Conflicts between this file and 60 resolved here**

| Topic | Decision |
|---|---|
| API-GUR-17 file types | PDF, DOCX, XLSX (the SRS wins on behaviour); ADD-09 |
| Student import limits | 2 MB and 1000 rows (the V2 caption); API-AS-06 amended (ADD-10) |
| API-GUR-22 body | includes qualification, years of experience, IC and school (ADD-11) |
| Laporan Bulanan month navigation | arrows "← {Bulan lepas}" and "{Bulan depan} →" with `?bulan=YYYY-MM`; no month or year selects; API `month=YYYY-MM` unchanged |
| Ticket Butiran length | 5000 characters (API-SUP-02), replacing the earlier 2000 |
| Private question reference link | 2048 characters (DM `reference_url`), replacing 500 |
| Required-field message wording | the per-field "Sila isi {medan}." / "{Medan} sudah digunakan." / "{Medan} mesti antara {a} dan {b}." of this file are the field-specific instances of ERR-REQ-10, ERR-REQ-16 and ERR-REQ-15; the owner of §X10 aligns the generic pattern text to them |

