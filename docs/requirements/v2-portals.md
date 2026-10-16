# v2 Portals & Role Architecture — Requirements (G1)

Slug: `v2-portals` · Track: Full · Status: Draft for G1 · Date: 2026-10-16 · Owner: product-analyst
Decisions in force (TRACKER): D28 (v2 direction), D29 (prototype update rules; .cloud primary), D30 (one Portal Pentadbiran). Visual design / Nuxt UI theming is out of scope here.

Evidence labels: **[C]** = prestasiplus.cloud reference code (`D:\Dev Projects\prestasiplus-reference\backend`, cited as `web.php:line`, `layout.blade.php`, `helpers.php`, `StaffScope.php`, `NationalOnly.php`, `EnsureRole.php`, `ImpersonateController.php`, `panel-layout.tsx`, Filament `navigationGroup`); **[P]** = current prototype (`admin-nav.ts`, `user-nav.ts`); **[.my]** = live finding 2026-10-16 / prototype-only item; **[D30]** = user decision.

---

## 1. Summary & goal

Today an admin sees three disconnected surfaces on .cloud (`/admin` Blade, `admin.` React panel, `/admin-filament`) and, on .my and in the prototype, an admin menu whose items silently switch to the student shell. v2 replaces this with **two strictly separated portals**:

| Portal | Host (concept) | Roles | Layout |
|---|---|---|---|
| **Portal Pentadbiran** | `admin.*` | Admin Pusat (`admin`), Pegawai PPD/JPN, Admin Sekolah | one admin layout |
| **Portal Pembelajaran** | main host | Murid, Guru, Ibu Bapa (+ Penaja, see Q3) | one learning layout (per-role menu) |

Rule: **one route = one portal = one layout**. A menu click never changes portal or layout. Goal: every admin function from all 3 .cloud surfaces lives in exactly one place of one menu, filtered by role and scope, with no visible-but-forbidden items.

## 2. Users / personas

| Persona | Role key (proposed) | Portal | Scope level | Primary jobs |
|---|---|---|---|---|
| Admin Pusat | `admin` | Pentadbiran | National | operate everything: bank, curriculum, content, users, finance, system |
| Pegawai PPD | `pegawai_ppd` (scope=district) | Pentadbiran | District | read-only monitoring of schools in district |
| Pegawai JPN | `pegawai_jpn` (scope=state) | Pentadbiran | State | read-only monitoring of schools in state |
| Admin Sekolah | `admin_sekolah` | Pentadbiran | One school | monitor own school, manage own pupils/teachers, own subscription/invoices |
| Murid | `student` | Pembelajaran | Self | practise, games, rewards |
| Guru | `teacher` | Pembelajaran | Own classes | classes, assessments, Command Center (guru), question contributions |
| Ibu Bapa | `parent` | Pembelajaran | Linked children | view linked child, approve consent items [P: M02/M15] |
| Penaja | `sponsor` | Pembelajaran (Q3) | Linked foster students | sponsor view [P: M21] |

Scope levels: `national` > `state` > `district` > `school` > `class` (guru) > `self`. A role has exactly one base scope level; the concrete scope value (state, district, school id) is stored on the account, not derived from a query string [C `PpdJpnController::scope()` derives it from the officer's school — see Q2].

## 3. Scope

### In scope
- Single login, role-based landing, portal separation and guards.
- Complete Portal Pentadbiran menu (§6) with per-role visibility, scope rules, topbar role/scope chip.
- "Pratonton sebagai Pelajar" mode; role switcher for dual-role users; Pemantauan › Langsung (full-screen + shared drill-down); Ctrl+K quick search.
- Resolution of every live shell-switch item (§7).
- Portal Pembelajaran menus per role at group level (§8).
- Responsive behaviour at 375 / 768 / 1280.

### Out of scope
- Visual design, Nuxt UI theme, component choice, URL scheme, host/cookie technology (architect).
- Question intake/display redesign (D28e) — only its **menu placement** (Bank Soalan › Import & Semakan) is here.
- Data migration from .cloud; redirects from old .cloud URLs.
- Item-level content of student/guru screens (existing module docs apply).
- .my-only features not in .cloud and not already built (listed in §6.11 "Not placed").

### Assumptions
- A1 .cloud is the primary reference (D29c); .my items are kept only where the prototype already built them (M27 L51–L58) — Q6.
- A2 Existing BM copy is kept verbatim unless this doc says otherwise; new copy marked PROPOSED.
- A3 `pusat:`-gated screens in .cloud (NationalOnly) = **Admin Pusat only** in v2.
- A4 Server-side scope enforcement is mandatory; hiding menu items is never the only control (.cloud lesson: "every controller that forgot became a leak", `NationalOnly.php`).
- A5 .cloud ships `pegawai_ppd` with no district column and left admin pages unscoped for it (`StaffScope::listScopeSchoolId`, `helpers.php` nav_allowed). v2 must not replicate that gap (R-02).

## 4. Role & scope model

### 4.1 Roles and landing
| Role | Portal | Landing after login | Source |
|---|---|---|---|
| admin | Pentadbiran | Papan Pemuka | [C] `role_home` → `/admin` |
| admin_sekolah | Pentadbiran | Papan Pemuka (own school) | [C] same |
| pegawai_ppd / pegawai_jpn | Pentadbiran | Pemantauan › Papan Pemuka Wilayah (PM-14) because Papan Pemuka is hidden for them | [D30]; [P] M01 BR-07 `/ppd/dashboard`, `/jpn/dashboard` |
| teacher | Pembelajaran | Dashboard Guru | [C] `/guru` |
| student | Pembelajaran | Dashboard | [C] `/pelajar`, [P] `/dashboard` |
| parent, sponsor | Pembelajaran | Dashboard / Penaja home | [P] BR-07, M21 FR-M21-57 |

### 4.2 Permission model
- Permission = (role, function, access mode, scope). Access modes: **F** full (read+write, within scope), **R** read-only, **S** scoped (own school; writes per `StaffScope` rules), **D** scoped to district/state, read-only, **—** hidden.
- Write rules carried over from `StaffScope.php`: Pusat manages all but cannot grant/demote another Pusat or self; Sekolah manages only active pelajar/guru of own school, cannot move users between schools, cannot create peers or PPD/JPN, imports start inactive until Pusat approves; PPD/JPN never write.
- Menu visibility = permission **read** (any non-"—" mode). A function with no read permission has no menu entry, no Ctrl+K result, no direct-URL data.

### 4.3 Dual-role rules
- A user may hold more than one role (e.g. Guru + Admin Sekolah). [.cloud has one role per user — new capability; Q1.]
- Exactly **one role is active** per session; permissions are those of the active role only, never a union.
- Switching role re-computes portal, landing, menu, scope chip, Ctrl+K index; no re-login.
- A Murid may not hold a staff role (default, Q1). Admin Pusat is not combined with other roles.
- Switcher is shown only when the account has ≥ 2 roles.

## 5. Portal Pentadbiran — structure

Menu groups, in this order (D30): **Papan Pemuka · Pemantauan · Bank Soalan · Kertas & SPM · Kurikulum & Kandungan · Pengguna & Sekolah · Penglibatan · Kewangan · Sistem**.
Group visibility: Pusat all nine. PPD/JPN: Pemantauan, Pengguna & Sekolah. Sekolah: Papan Pemuka, Pemantauan, Kurikulum & Kandungan (Video only, KK-12), Pengguna & Sekolah, Kewangan [D30; KK-12 per D43]. A group with no visible item for the active role is not rendered.

Legend for the tables: Pusat / PPD·JPN / Sekolah columns use F, R, S, D, — (§4.2). "PPD" = district only, "JPN" = state only. `*` = scope enforcement in .cloud for that page was not verified or was absent; v2 must scope it (R-02).

## 6. Complete Portal Pentadbiran menu (admin function → menu item)

Surfaces: **B** = `/admin` Blade, **P** = `admin.` React panel, **F** = `/admin-filament`.

### 6.1 Papan Pemuka (2)
| ID | Item | Function(s) merged | Pusat | PPD·JPN | Sekolah | Evidence |
|---|---|---|---|---|---|---|
| PP-01 | Dashboard | platform counts, widgets (PlatformOverview, QuestionStatusChart) | F national | — | S own school | B `web.php:535`; P `/` `:185`; F Dashboard (group Harian) |
| PP-02 | Laporan Eksekutif | executive report; league tables withheld when scoped | F | — | S | B `:725`; `helpers.php` nav_school_scoped |

### 6.2 Pemantauan (28)
| ID | Item | Function(s) merged | Pusat | PPD·JPN | Sekolah | Evidence |
|---|---|---|---|---|---|---|
| PM-01 | **Langsung** (was Command Center) | live metrics, drill school→teacher→class→student, full-screen mode | F national | R PPD district; JPN — (Q7) | S own school | B `:738-739` (+ `:1048-1049` school/student drill); `/ppd/command-center` `:831`; guru twin `:1749-1754` |
| PM-02 | Aktiviti Harian | daily activity | F | — | S | B `:740`; F DailyActivity |
| PM-03 | Monitoring | school engagement drill-down; CSV/PDF export (`:791`, `:798`) | F | — | S | B `:731`; F Monitoring |
| PM-04 | Analitik | **merges** B "Analitik Kandungan" (`pusat:`) and P `/analitik` (school-scoped) into one page; content analytics tab Pusat-only | F national | — | S own school (usage tabs only) | B `:727`; P `:187`; F Analitik; `panel-layout.tsx` SCHOOL_SCOPED_HREFS |
| PM-05 | Kirkpatrick › Ringkasan | overview; PDF export (`:797`) | F | — | S | B `:741`; F Kirkpatrick |
| PM-06 | Kirkpatrick › T1: Reaksi | | F | — | S | B `:742` |
| PM-07 | Kirkpatrick › T2: Pembelajaran | | F | — | S | B `:743` |
| PM-08 | Kirkpatrick › T3: Tingkah Laku | | F | — | S | B `:744` |
| PM-09 | Kirkpatrick › T4: Hasil | | F | — | S | B `:745` |
| PM-10 | Kirkpatrick › Rantaian Impak | | F | — | S | B `:746` |
| PM-11 | Kirkpatrick › Intervensi | | F | — | S | B `:747` |
| PM-12 | Laporan Aktiviti | activity report (label in [P] Lagi; = M27 L53) | F | — | S* | B `:726`; [P] `admin-nav.ts` lagi label; M27 |
| PM-13 | Amaran Wellbeing | wellbeing alerts of pupils (staff-facing) | F | — | S | [C] `:1489` (shared portal pages); [P] roles admin/teacher/school_admin |
| PM-14 | Papan Pemuka Wilayah | PPD/JPN dashboard (district/state) | F national view | D (PPD district / JPN state) | — | `:830-861` dashboard; `PpdJpnController` |
| PM-15 | Statistik Penggunaan | usage statistics at the viewer's scope (**one page** for ppd/jpn `statistik-penggunaan` and M27 L51) | F | D | S | `:831-832`; M27 L51 |
| PM-16 | Ranking Kebangsaan | national ranking (ppd + jpn) | F | D (see scope note) | — | `:831-832` |
| PM-17 | Benchmark Sekolah | PPD only | F | D PPD | — | `:830` |
| PM-18 | Leaderboard Sekolah | PPD only | F | D PPD | — | `:831` |
| PM-19 | Peta Haba | heat map, PPD only | F | D PPD | — | `:831` |
| PM-20 | Export Laporan | CSV export, PPD only | F | D PPD | — | `:831` |
| PM-21 | DSKP Heatmap | [.my/M27 L52] | F | — | S | M27 L52; Q6 |
| PM-22 | Amaran Awal | early-warning (school) [.my/M27 L54] | F | — | S | M27 L54; Q6 |
| PM-23 | Laporan Bulanan | monthly report [.my/M27 L55] | F | — | S | M27 L55; Q6 |
| PM-24 | Headcount | school headcount (matrix row 3) | F | — | S | role-access-matrix.md row 3; D43/D-RAM-2 |
| PM-25 | Prestasi | performance (matrix row 4) | F | — | S | role-access-matrix.md row 4; D43/D-RAM-2 |
| PM-26 | Analitik Adaptif | adaptive analytics (matrix row 5) | F | — | S | role-access-matrix.md row 5; D43/D-RAM-2 |
| PM-27 | Analisa Item | item analysis (matrix row 6) | F | — | S | role-access-matrix.md row 6; D43/D-RAM-2 |
| PM-28 | Sekolah Bersaing | competing schools (matrix row 45); restored from §6.11 | F | D | S | role-access-matrix.md row 45; D43/D-RAM-2 |

Scope note PM-16: ranking compares schools; PPD/JPN see ranking positions of all schools but detail only in scope — detail left to design; default = show full national ranking (it is what .cloud ppd/jpn pages render) with in-scope schools highlighted. [Confirm in Q8-adjacent design review; not blocking.]

### 6.3 Bank Soalan (7) — Pusat only [D30]
| ID | Item | Function(s) merged | Pusat | PPD·JPN | Sekolah | Evidence |
|---|---|---|---|---|---|---|
| BS-01 | Bank Soalan | **single canonical bank** (D28e): Studio list/create/edit/preview/submit/publish/archive; legacy "Senarai Soalan" list, archive/enable, archive-all, enable-filtered, export questions; "Soalan Berstruktur" listing; "Gambar Rajah" filter | F | — | — | B `:590-607`, `:751-755`, `:918-924`, `:862`; P `/studio` `:305-334`; F Questions, StructuredQuestions |
| BS-02 | Import & Semakan | intake + review queue: Studio imports (upload/accept/reject/edit/accept-all, paper publish/unpublish), "Kertas Soalan Guru" submissions + download, Import CSV | F | — | — | B `:608-648`, `:756`, `:822`; F QuestionSubmissions, QuestionImport. **Pipeline itself redesigned (D28e), separate spec.** |
| BS-03 | Sumber Kertas | provenance registry list + detail | F | — | — | B `:678-680` |
| BS-04 | Kualiti Soalan | quality dashboard | F | — | — | B `:752`; F QuestionQuality |
| BS-05 | Laporan Soalan | student-reported question problems | F | — | — | B `:754`; F QuestionReports |
| BS-06 | Soalan PKSK | premium question bank | F | — | — | B `:895` (`pusat:`); F PkskQuestions |
| BS-07 | Audio KBAT | audio KBAT items | F | — | — | B `:900`; F AudioKbats |

### 6.4 Kertas & SPM (12) — Pusat only [D30]
| ID | Item | Function(s) merged | Pusat | PPD·JPN | Sekolah | Evidence |
|---|---|---|---|---|---|---|
| KS-01 | Gambaran SPM | hub of lanes (landing page of the group) | F | — | — | B `:691`; P `/spm` `:196` |
| KS-02 | Databank Soalan | lane `databank` + quick edit/preview | F | — | — | B `:692`, `:716-721`; F SpmDatabank; [.my] `/spm/tahun-lepas` |
| KS-03 | Latih Tubi | lane `latih-tubi` (admin view) | F | — | — | B `:692`; `SpmLane`; [.my] `/spm/latih-tubi` |
| KS-04 | Tracking A | lane + set editor (fill/swap/save) | F | — | — | B `:704-714`; P `:201-208`; F Ramalan; [.my] `/spm/ramalan` |
| KS-05 | Subjektif | lane + rubric/mark-scheme editor (includes "Soalan Berstruktur") | F | — | — | B `:818-819`; P `:253-256`; [.my] `/spm/subjektif` |
| KS-06 | Bijak SPM (Simulasi) | lane `simulasi`: paper review, section/stimulus/reference-asset edit, publish/unpublish/duplicate, soalan tambahan | F | — | — | P `:276-302` |
| KS-07 | Kertas Subjektif | page-image papers CRUD + publish toggle | F | — | — | B `:683-686`; P `:237-246` |
| KS-08 | Kontrak Simulasi | per-subject paper blueprints | F | — | — | P `:262-267` |
| KS-09 | Set Builder | composite sets: sections, add/reorder/remove, attach document, publish | F | — | — | B `:655-675`; P `:341-375`; F — |
| KS-10 | Tanda Karangan | AI essay-review confirm queue (feature-flag `essayGrading`) | F | — | — (Q5) | P `:219-222`; `panel-layout.tsx` ESSAY_REVIEW_ITEM |
| KS-11 | Ramalan SPM | grade prediction | F | — | — | F RamalanGred |
| KS-12 | Set Soalan | SPM question sets | F | — | — | F SpmSets |

### 6.5 Kurikulum & Kandungan (12) — Pusat only, except KK-12 (Sekolah R)
| ID | Item | Pusat | PPD·JPN | Sekolah | Evidence |
|---|---|---|---|---|---|
| KK-01 | Kurikulum | F | — | — | B `:748`; F CurriculumOverview |
| KK-02 | Subjek | F | — | — | B `:749`, `:916-917`; F Subjects |
| KK-03 | Bab | F | — | — | F Chapters only (no B/P page) |
| KK-04 | Tahap Pendidikan | F | — | — | B `:750`; F EducationLevels |
| KK-05 | Banner | F | — | — | B `:898`; F Banners |
| KK-06 | Artikel | F | — | — | B `:899`; F Articles |
| KK-07 | Nota | F | — | — | B `:904`; F Notes |
| KK-08 | Video | F | — | — | F Videos only (Sistem group) |
| KK-09 | Laluan Kerjaya | F | — | — | F CareerPaths only |
| KK-10 | Universiti | F | — | — | F Universities only |
| KK-11 | Biasiswa | F | — | — | F Scholarships only |
| KK-12 | Video Sekolah | F | — | R | role-access-matrix.md row 7 (Video): read-only view for Admin Sekolah, separate from KK-08 content management; D43/D-RAM-2 |

### 6.6 Pengguna & Sekolah (6)
| ID | Item | Function(s) merged | Pusat | PPD·JPN | Sekolah | Evidence |
|---|---|---|---|---|---|---|
| PS-01 | Pengguna | one list with role tabs (Pelajar · Guru · Staf [Pusat only]): create/edit/reset password, activate/bulk-activate (Pusat approves imports), Tukar Peranan, export users, **Pratonton** action. Replaces M27 "Senarai Pelajar"/"Senarai Guru" as tabs | F | D R (pelajar+guru list, no writes) | S pelajar+guru of own school; activate = Pusat only | B `:757-773`, `:865-869`, `:787`; P `/pengguna` `:188-189`; F Users; `StaffScope`; M27 L56-L57 |
| PS-02 | Sekolah | school list/create/edit/toggle active/rotate join code, school picker search, export schools | F | D R | S own school: view + join code; no create/edit/toggle | B `:777-784`, `:876`, `:864`; P `:193-195`; F Schools; `StaffScope::canManageSchools` |
| PS-03 | Kelas Sekolah | classes of a school [.my/M27 L58] | F | D R | S | M27 L58; Q6 |
| PS-04 | Import Pelajar | bulk create pelajar (create-only, per-row validation) | F | — | S (rows start inactive) | B `:877-881`; F ImportStudents |
| PS-05 | Import Pengguna | bulk create guru (Pusat also admin_sekolah, PPD/JPN) | F | — | S guru only | B `:760-764`; F UserBulkImport; `StaffScope::importableRoles` |
| PS-06 | Pelajar Komplimen | complimentary-access flag list | F | — | — | B `:882`, `:812-814`; F CompStudents |

### 6.7 Penglibatan (22) — Pusat only [D30]; Sekolah deviation recorded (Q5)
| ID | Item | Function(s) merged | Pusat | PPD·JPN | Sekolah | Evidence |
|---|---|---|---|---|---|---|
| PG-01 | Gamifikasi › Overview | | F | — | — | B `:887`; F GamificationOverview |
| PG-02 | Gamifikasi › Tier Config (Kadar Tukaran Syiling) | | F | — | — | B `:888` (`pusat:`); F GamificationTiers |
| PG-03 | Gamifikasi › Cabaran | daily challenges | F | — | — | B `:889` (`pusat:`); F Challenges |
| PG-04 | Gamifikasi › Pelajar | | F | — | — | B `:890`; F GamificationStudents |
| PG-05 | Gamifikasi › Transaksi | | F | — | — | B `:891`; F GamificationTransactions |
| PG-06 | Gamifikasi › Kedai Hadiah | gift catalogue + redemptions | F | — | — | B `:892`; F KedaiHadiah, Gifts |
| PG-07 | Gamifikasi › Gamifikasi Guru | teacher ledger (tebusan/tunai) | F | — | — | B `:893`, `:801-802`; F GamifikasiGuru |
| PG-08 | Gamifikasi › Lencana Guru | teacher badges | F | — | — | F TeacherBadges only |
| PG-09 | Gamifikasi › Cabutan | lucky draws | F | — | — | F LuckyDraws only |
| PG-10 | Gamifikasi › Kawalan Reward | | F | — | — | B `:894` (`pusat:`); F RewardControl |
| PG-11 | Permainan › Tetapan Permainan | games settings | F | — | — | B `:897` (`pusat:`); F TetapanPermainan, Games |
| PG-12 | Permainan › Ranking Sekolah (Battle) | read-only report in admin layout | R | — | — | [.my] `/battle/ranking-sekolah`; layout.blade.php battle group; Q8 |
| PG-13 | Permainan › Leaderboard (Battle) | read-only report in admin layout | R | — | — | [.my] `/battle/leaderboard`; Q8 |
| PG-14 | Marketplace › Produk | | F | — | — | B `:913` (`pusat:`); F MarketplaceProducts |
| PG-15 | Marketplace › Penjual | | F | — | — | B `:914`; F MarketplaceSellers |
| PG-16 | Penajaan | sponsors | F | — | — | B `:883` (`pusat:`); F Sponsors |
| PG-17 | Anak Angkat | foster sponsorships | F | — | — | B `:884`; F FosterSponsorships |
| PG-18 | Permohonan Anak Angkat | applications queue | F | — | — | B `:885`; F FosterApplications |
| PG-19 | Permohonan Duta | ambassador applications | F | — | — | B `:886`; F DutaApplications; [.my] `/admin/duta-applications` |
| PG-20 | Push Notifikasi | list, compose, send | F | — | — | B `:820-821`, `:911`; F PushNotifications |
| PG-21 | Chatbot | conversations, analytics, knowledge base (Pusat only tab) | F | — | — | B `:805-807`, `:912`; F Chatbot |
| PG-22 | Tiket Bantuan (Urus Tiket) | support tickets | F | — | — | B `:808` |

### 6.8 Kewangan (6)
| ID | Item | Pusat | PPD·JPN | Sekolah | Evidence |
|---|---|---|---|---|---|
| KW-01 | Pembayaran (+ export payments) | F | — | S | B `:901`, `:863`; F Payments |
| KW-02 | Billing Dashboard | F | — | S | B `:902`; F BillingDashboard |
| KW-03 | Invois | F | — | S | F Invoices ("Billing"); [P] M27 Invois |
| KW-04 | Dunning Log | F | — | S | B `:903`; F DunningLogs |
| KW-05 | Langganan Sekolah | F | — | S own subscription | B `:872`; F SchoolSubscriptions |
| KW-06 | Akses PKSK | F | — | S | B `:896`; F PkskAccesses |

### 6.9 Sistem (5) — Pusat only
| ID | Item | Evidence |
|---|---|---|
| SY-01 | Tetapan (system settings, editable keys) | B `:905-909`; F Settings |
| SY-02 | Kawalan Ciri (feature toggles) | B `:870-871` (`pusat:`) |
| SY-03 | Prestasi Sistem (+ server-status pill in topbar) | B `:732-733` |
| SY-04 | Log Audit (+ export) | B `:910`, `:792`; F AuditLogs; [.my] `/admin/audit-logs` |
| SY-05 | Upload Screenshot (tools) | B `:915`; F ScreenshotsTool |

### 6.10 Cross-cutting admin functions (not menu items)
| Function | Where in v2 | Evidence |
|---|---|---|
| Impersonate ("Log masuk sebagai") | becomes Pratonton (US-07) from PS-01 | `ImpersonateController`, B `:758` |
| Server status CPU/RAM/disk pill | topbar, Pusat only | `layout.blade.php` serverStatus |
| School picker (type-to-search) | shared field in forms | B `:876` |
| Exports (CSV/PDF) | on their own page (PM-03, PM-05, PM-20, PS-01, PS-02, KW-01, SY-04) | B `:786-798` |
| Logout | topbar user menu | `layout.blade.php` |
| Quick search | Ctrl+K (US-10) | [D30] |

### 6.11 Not placed (unresolved) and removed from the admin menu
**Could not place (no .cloud admin function; .my/prototype only, not built):** Aktiviti Guru (`/admin-sekolah/aktiviti-guru`), Semakan Nota Master (`/admin/master-notes`), Admin Tebusan (`/admin/hadiah/tebusan`), Kelulusan Hadiah (admin view), Mark/PBD/RPH "Cikgu Alesa Tools" admin copies. Proposed disposition: **Won't (v2)** per D28c, listed in Q6/Q9.
**Removed from admin menu (student/teacher pages, reachable only via Pratonton or their own portal):** Bilik Duta, Akademi Duta, Duta Dashboard, Jemput Duta, Kem & Bootcamp, all Pusat AI tools, Profil Cerah, Cita-Cita Hijrah, Kombo, Cikgu Suara, SPM Mock Exam, Tetapan Peribadi (becomes account menu), "Ke Dashboard"/"Student View", "Ke Admin Panel", PPD/JPN section of the user menu, admin's "Portal Guru" block, Pakej/Invois Saya.

### 6.12 Function count per group
| Group | Items |
|---|---|
| Papan Pemuka | 2 |
| Pemantauan | 28 (Kirkpatrick = 7) |
| Bank Soalan | 7 |
| Kertas & SPM | 12 |
| Kurikulum & Kandungan | 12 |
| Pengguna & Sekolah | 6 |
| Penglibatan | 22 |
| Kewangan | 6 |
| Sistem | 5 |
| **Total** | **100** |

Merges applied ("one function = one place"): Analitik (B+P) → PM-04; Users (B+P+F) → PS-01; Schools (B+P+F) → PS-02; Studio (B+P) → BS-01/BS-02/KS-09; SPM hub (B+P) → KS-01..; legacy "Bank Lama" list and Soalan Berstruktur → BS-01/KS-05; Statistik Penggunaan (ppd, jpn, M27) → PM-15; Laporan (B) = Laporan Aktiviti (M27) → PM-12.

## 7. Resolution of the live shell-switch list

| Live item (switches to student shell) | v2 resolution | Item |
|---|---|---|
| `/spm/tahun-lepas` Databank Soalan | admin-layout lane page | KS-02 |
| `/spm/latih-tubi` Latih Tubi | admin-layout lane page | KS-03 |
| `/spm/ramalan` Tracking A | admin-layout lane + set editor | KS-04 |
| `/spm/subjektif` Subjektif | admin-layout lane + rubric editor | KS-05 |
| `/battle` Battle Live | removed from admin menu (student lobby); reachable only via Pratonton | — |
| `/battle/ranking-sekolah` | admin-layout read-only report (Pusat) | PG-12 |
| `/battle/leaderboard` | admin-layout read-only report (Pusat) | PG-13 |
| `/admin/audit-logs` | admin-layout page | SY-04 |
| `/admin/duta-applications` | admin-layout page | PG-19 |
| `/cita-cita` | removed; Pratonton only | — |
| `/kombo` | removed; Pratonton only | — |
| `/dashboard` ("Ke Dashboard"/"Student View") | removed; replaced by "Pratonton sebagai Pelajar" | US-07 |

Principle: any route whose content is an administrative function renders in the admin layout; any route whose content is the student/teacher experience is never linked from the admin menu.

## 8. Portal Pembelajaran — role menus (group level)
Replicates .cloud `pelajar/layout.blade.php` and `guru/layout.blade.php` section labels; items inside groups follow existing module docs/`user-nav.ts`. **Changes** are marked ▲.

| Role | Groups (in order) | Changes vs prototype |
|---|---|---|
| Murid | Top (Dashboard, Target SPM, Misi Harian, Remedial) · SPM · Pembelajaran · Pusat AI (✨ Cita-Cita Hijrah, 🔥 Streak & Syiling, 📝 Nota Ringkas, 🤖 Cikgu Alesa AI, ✨ Visi & Pertandingan, 🤖 AI Pintar (Pelajar)) · 🏆 Bilik Duta · ✨ Visi & Pertandingan · 💎 Killer Features · Akaun & Bantuan (Profil Saya, Tetapan Peribadi, Panduan, Tiket Bantuan, Log Keluar) | ▲ no admin-only blocks; ▲ no role-union rendering |
| Guru | Command Center (LIVE) · HARIAN · PENGAJARAN · PENILAIAN · ANALITIK (Monitoring, Kirkpatrick) · PUSAT AI · BANK SOALAN · AKTIVITI · LAIN-LAIN · Bantuan | ▲ Monitoring/Kirkpatrick/Command Center render in the **learning** layout (prototype renders them in the admin chrome); ▲ Command Center drill-down shares components with PM-01 |
| Ibu Bapa | Dashboard · linked-child views and consent approvals · Akaun & Bantuan | [P] only (no .cloud login role: parent invite = `/ibu-bapa/terima/{token}` `:1429`); minimal menu |
| Penaja | Penaja home (`/sponsor`) · Akaun & Bantuan | [P] M21 only; Q3 |

Items visible to Admin Pusat that duplicated other roles' blocks (Portal Guru, PPD/JPN, Cikgu Alesa Tools, Admin) are **removed** from the learning menu; admins reach those experiences only through Pratonton.

## 9. User stories and acceptance criteria

Priority (MoSCoW) in brackets.

### US-01 [Must] Single login, role-based routing
As any user, I want one login screen, so that I land in the right portal without choosing a URL.
- AC-01.1 Given a guest on any protected URL, when it is requested, then the user is sent to the login screen with no redirect parameter (replicates BR-08; avoids `intended()` hijack noted in `web.php:472`).
- AC-01.2 Given valid credentials of a staff user (email), when login succeeds, then the browser lands on the Portal Pentadbiran home for that role (§4.1).
- AC-01.3 Given valid credentials of a Murid/Guru (school + username or email), when login succeeds, then the browser lands on the Portal Pembelajaran home for that role.
- AC-01.4 Given invalid credentials, then the exact message is "E-mel/Nama pengguna atau kata laluan tidak sah." and no field reveals which part was wrong. [C `web.php:478`]
- AC-01.5 Given an inactive/suspended account, then "Akaun anda tidak aktif atau telah digantung. Sila hubungi pentadbir." [C `:456`]
- AC-01.6 Given a user of a deactivated school, then "Sekolah anda belum diaktifkan oleh pentadbir. Sila hubungi pihak sekolah." [C `:463`]
- AC-01.7 Given a username shared by several schools, then the ambiguity message is shown and no account is chosen silently. [C `:448`]
- AC-01.8 Given an already signed-in user opens the login screen, then they are sent to their portal home.
- AC-01.9 Given logout, then the session ends for both portals; going Back does not show protected data.
- AC-01.10 Given a dual-role user logs in, then they land in the portal of their last-active role (default: first role in a fixed order) — see US-08.

### US-02 [Must] Strict portal separation
As a product owner, I want one route = one portal = one layout, so that users never see the wrong shell.
- AC-02.1 Every route belongs to exactly one portal and one layout; navigating any menu item of a portal never changes layout or host.
- AC-02.2 Given a Murid/Guru/Ibu Bapa opens a Portal Pentadbiran URL, then no admin page or data is shown; the user is redirected to their own portal home. (.cloud: `EnsureRole.php` redirect / 403 on admin host.)
- AC-02.3 Given a staff user (no learning role) opens a Portal Pembelajaran role page, then they are redirected to their portal home.
- AC-02.4 Given the 12 live shell-switch items (§7), when the admin menu is audited, then none links outside Portal Pentadbiran.
- AC-02.5 Automated check: for every admin menu item, the target route's layout equals the admin layout.

### US-03 [Must] Role-filtered menu, no visible-but-forbidden items
As a staff user, I want to see only items I can use, so that I am never shown a door that refuses me.
- AC-03.1 Given Admin Pusat, then all nine groups and all 100 items of §6 are present.
- AC-03.2 Given PPD/JPN, then only Pemantauan and Pengguna & Sekolah groups appear, and only items whose PPD·JPN cell is D or R (PPD-only items hidden for JPN).
- AC-03.3 Given Admin Sekolah, then only Papan Pemuka, Pemantauan, Kurikulum & Kandungan (Video Sekolah only, KK-12), Pengguna & Sekolah, Kewangan appear, with Sekolah-cell items only.
- AC-03.4 No lock icon, greyed or disabled item exists for any role (replaces .cloud padlock + "Diuruskan oleh Admin Pusat" tooltip).
- AC-03.5 A group with zero visible items is not rendered.
- AC-03.6 The menu is the single definition used for desktop sidebar and mobile navigation (same items, same order).
- AC-03.7 Item order within groups follows §6; group order follows §5.

### US-04 [Must] Topbar role and scope chip
As a staff user, I want to see my role and scope at all times, so that I know whose data I am looking at.
- AC-04.1 The topbar shows role label and scope value on every Pentadbiran page: "Admin Pusat · Kebangsaan"; "Pegawai PPD · {nama PPD}"; "Pegawai JPN · {negeri}"; "Admin Sekolah · {nama sekolah}" (labels PROPOSED, existing role labels from `layout.blade.php`: Admin, Admin Sekolah, Pegawai PPD).
- AC-04.2 The scope shown equals the scope applied by the server to the page data (test: change scope → counts change accordingly).
- AC-04.3 The chip is visible at 375 / 768 / 1280 (may abbreviate, must remain readable and reachable without horizontal scroll).
- AC-04.4 During Pratonton the chip is replaced/augmented per US-07.

### US-05 [Must] Scope enforced on the server
As a data owner, I want scoping to be enforced server-side, so that URL tampering cannot widen access.
- AC-05.1 Given Admin Sekolah requests any list/export with another school's id in path/query/body, then the result is empty/403 and no other school's rows are returned.
- AC-05.2 Given PPD/JPN, then every shared page returns only schools in the officer's district/state; scope comes from the account, never a query parameter. (Fixes A5.)
- AC-05.3 Given PPD/JPN sends any non-GET request to any admin API, then 403.
- AC-05.4 Given Admin Sekolah, write rules of `StaffScope` hold: cannot edit another admin_sekolah, an inactive account, a user of another school; cannot activate accounts; imports are created inactive.
- AC-05.5 Given Admin Pusat edits their own role or another Pusat, then refused.

### US-06 [Must] Forbidden direct-URL handling
As a staff user who opens or bookmarks a URL I cannot use, I want a clear answer, so that I understand and can go back.
- AC-06.1 Given an unauthenticated request, then see AC-01.1.
- AC-06.2 Given a signed-in staff user opens an admin URL outside their permissions (GET), then the portal layout renders a 403 page (status 403) with the page name, the message "Halaman ini diuruskan oleh Admin Pusat sahaja." for Pusat-only pages (generalised PROPOSED copy for other cases: "Halaman ini tidak tersedia untuk peranan anda."), and a "Kembali ke Papan Pemuka" link to their landing page. No controller query runs and no data is rendered. [C `NationalOnly.php`, `khas-pusat.blade.php`]
- AC-06.3 Given a non-GET request to such a URL, then bare 403, no page.
- AC-06.4 The forbidden page itself exposes no menu entry for the forbidden item.
- AC-06.5 Given a URL that does not exist, then the standard 404 page in the user's own portal layout.
- AC-06.6 Given a record id outside scope (e.g. another school's user) under an otherwise permitted page, then 404 (not 403) so existence is not disclosed.

### US-07 [Must] Pratonton sebagai Pelajar
As an admin, I want to preview the student experience without leaving my admin context, so that I can verify content safely.
- AC-07.1 The only entry point is the "Pratonton sebagai Pelajar" action (PS-01 row action, and Ctrl+K); there is no "Ke Dashboard"/"Student View" link anywhere in the admin layout.
- AC-07.2 Activating it opens a **new browser tab** in Portal Pembelajaran showing the chosen student's view; the admin tab is unchanged.
- AC-07.3 A persistent banner in the preview tab shows (PROPOSED copy, adapted from `impersonation-banner.blade.php`): "Pratonton sebagai Pelajar — anda melihat sebagai {nama murid}" and a "Keluar Pratonton" control. The banner cannot be dismissed.
- AC-07.4 "Keluar Pratonton" ends the preview and closes/returns the tab to the admin portal; the original admin session is intact (no re-login).
- AC-07.5 Preview is **read-only by default** (Q4): no practice results, coins, notes or other student data are written while previewing; write actions are blocked with a clear message.
- AC-07.6 Preview target rules replicate `ImpersonateController`: not self, not another staff account, only active non-suspended users; Admin Sekolah only own-school students; PPD/JPN cannot preview; no nesting.
- AC-07.7 Every start and stop is written to the audit log (actor, target, time, ip). [C]
- AC-07.8 The student's own sessions are unaffected and the student is not notified.

### US-08 [Should] Role switcher for dual-role users
As a user with two roles, I want to switch role, so that I can work in each portal without logging in twice.
- AC-08.1 Given an account with ≥ 2 roles, then a role switcher is in the topbar/account menu listing each role with its scope.
- AC-08.2 Given an account with exactly 1 role, then no switcher is rendered.
- AC-08.3 When the user switches, then portal, landing page, menu, chip and Ctrl+K index are recomputed for the new role and the user lands on that role's home; no password prompt.
- AC-08.4 Permissions are those of the active role only (e.g. Guru+Admin Sekolah sees no school-admin data while Guru).
- AC-08.5 The active role is recorded in the audit log for writes.
- AC-08.6 Switching is blocked during Pratonton.

### US-09 [Must] Pemantauan › Langsung with full-screen and shared drill-down
As a monitoring user, I want a live view I can run full-screen and drill into, so that I can monitor activity on a large display.
- AC-09.1 "Langsung" opens in the same tab (no new-tab, no separate layout) inside Pemantauan.
- AC-09.2 A full-screen control hides sidebar/topbar chrome and fills the viewport; "Esc" or an exit control restores it; live data keeps updating across the toggle.
- AC-09.3 Drill-down path school → teacher → class → student is available at the user's scope: Pusat starts at national/school list; PPD at district schools; Sekolah starts at own school.
- AC-09.4 The drill-down uses the same components and data contract as the guru Command Center (guru starts at own classes); a change in one is visible in both (checked by a shared component).
- AC-09.5 Given a drill target outside scope, then 404 (AC-06.6).
- AC-09.6 PPD sees Langsung at district scope; JPN does not see it (Q7).
- AC-09.7 Works at 375 / 768 / 1280 (see US-16).

### US-10 [Must] Ctrl+K quick search respects permissions
As a staff user, I want to jump to any allowed page or record by typing, so that I work faster.
- AC-10.1 Ctrl+K (Cmd+K on macOS) opens a search dialog from any Pentadbiran page; Esc closes it; focus returns to the previous element.
- AC-10.2 Results include only menu items the active role can read (§6 visibility) and, for Pusat/Sekolah/PPD-JPN, records (users, schools) **within scope**.
- AC-10.3 Typing a name of a hidden item (e.g. "Tetapan" as Admin Sekolah) returns no result for it.
- AC-10.4 Selecting a result navigates within Portal Pentadbiran; the "Pratonton sebagai Pelajar" command appears only for roles allowed to preview.
- AC-10.5 Search works with Bahasa Melayu terms (labels as in §6) and is case/diacritic-insensitive.
- AC-10.6 On touch devices an equivalent visible search trigger exists (no keyboard needed).

### US-11 [Must] Admin Pusat has the complete menu
As Admin Pusat, I want every former admin function reachable once, so that nothing is lost in the merge.
- AC-11.1 Each of the 100 functions in §6 is reachable from exactly one menu item (no duplicates across groups).
- AC-11.2 Every route in the three .cloud surfaces listed in §6 "Evidence" has a destination in v2 or an entry in §6.11.
- AC-11.3 No "Filament", "Panel", "Blade" or legacy "Bank Lama (Legasi)" grouping appears in the UI.

### US-12 [Must] PPD/JPN read-only scoped monitoring
As Pegawai PPD/JPN, I want to monitor schools in my district/state, so that I can support schools without changing data.
- AC-12.1 Only Pemantauan and Pengguna & Sekolah are visible; landing is PM-14.
- AC-12.2 All figures are limited to the officer's district (PPD) or state (JPN); the chip shows it.
- AC-12.3 No create/edit/delete/activate/import control exists on any page for these roles.
- AC-12.4 PS-01 shows pelajar/guru of in-scope schools read-only; personal contact fields follow M02 privacy rules (Q: field list in design; default = hide phone/IC).

### US-13 [Must] Admin Sekolah own-school administration
As Admin Sekolah, I want to monitor and administer my own school, so that I do not depend on Admin Pusat for routine tasks.
- AC-13.1 Menu is limited to the five groups of AC-03.3.
- AC-13.2 Every list/figure shows own school only; the school name is in the chip.
- AC-13.3 Imported accounts are created inactive and a note tells the user that Admin Pusat must approve them.
- AC-13.4 School create/edit/toggle and join-code rotation controls are not shown (join code is displayed read-only).
- AC-13.5 Langganan/Invois/Pembayaran/Billing/Dunning show own school's records only.

### US-14 [Must] Portal Pembelajaran menus per role
As a Murid/Guru/Ibu Bapa, I want a menu with only my role's items, so that I am not shown admin or other-role entries.
- AC-14.1 Each role sees the group list of §8 and nothing from other roles.
- AC-14.2 No item links into Portal Pentadbiran.
- AC-14.3 Guru Monitoring, Kirkpatrick and Command Center render in the learning layout.
- AC-14.4 Group labels use the exact BM copy of §8.
- AC-14.5 Desktop sidebar and mobile drawer come from one definition (replicates DV-SH-04 fix).

### US-15 [Should] Cross-portal navigation affordances
As a dual-role user or admin, I want clear, deliberate ways between portals, so that I never switch by accident.
- AC-15.1 The only ways between portals are: role switcher (US-08), Pratonton (US-07), login/logout.
- AC-15.2 No menu item or breadcrumb crosses portals.

### US-16 [Must] Responsive
As any user, I want the shell and the new components to work on phone, tablet and desktop.
- AC-16.1 At 375, 768 and 1280 px width there is no horizontal page scroll on: login, Portal Pentadbiran home, each group's first page, forbidden page, Langsung (normal and full-screen), Ctrl+K dialog, role switcher, Pratonton banner.
- AC-16.2 Below the desktop breakpoint the 9-group menu is reachable via a navigation control and keeps the same items/order as desktop.
- AC-16.3 Topbar chip (US-04) and role switcher (US-08) remain usable at 375 px (touch target ≥ 44 px).
- AC-16.4 Full-screen Langsung is usable at 375 px (drill-down and exit control visible).
- AC-16.5 Pratonton banner never covers the top-most content on 375 px (content is offset).

## 10. Non-functional requirements
| Area | Requirement |
|---|---|
| Security | Server-side authorisation on every endpoint; scope from account not request; non-GET denied for read-only roles; audit log for Pratonton, role switch, role change, activate, imports, settings, feature-toggle changes. Session fixation: regenerate session on login and on role switch. Cookie/session shared across the two portal hosts without exposing the Pembelajaran session to Pentadbiran pages beyond the active role. |
| Privacy | PDPA: PPD/JPN and Pusat Pratonton minimise personal data; no real names in docs/seeds (rule §6 CLAUDE.md). Wellbeing alerts (PM-13) not available to PPD/JPN. |
| Performance | Menu + role/scope resolved in one call at login/role switch; menu render < 100 ms after data; Ctrl+K index of menu is client-side, record search debounced and server-scoped; Langsung updates without full page reload. |
| Accessibility | Replicates live (D10): keyboard reachability of menu and Ctrl+K dialog, focus return, `aria-current` on active item, reduced-motion respected; no enhancements beyond that. |
| Localisation | All UI copy in Bahasa Melayu (exact labels as §5–§8); date/number formats `ms-MY`; role/scope chip strings from a single copy table. |
| Theme | Light + dark (D29f) for shell, banner, forbidden page. |
| Availability | Permission change (role/scope) takes effect on the next request without re-login. |
| Testability | Menu definition is data; test asserts per-role item sets (§6) and that no item's target route has a different layout (AC-02.5). |

## 11. Risks
| ID | Risk | Mitigation |
|---|---|---|
| R-01 | D30 hides items that .cloud gave Sekolah (Penglibatan scoped pages, Tanda Karangan, Log Audit); a school loses capability | Q5 default follows D30; list of affected items is in §6 |
| R-02 | .cloud left PPD/officer scoping unfinished (no district column); copying pages blindly leaks national data | AC-05.2, explicit scope on account (Q2) |
| R-03 | M27 Senarai Pelajar/Guru built as separate pages; merging into PS-01 tabs changes built UI | Treat as v2 update under D29b; re-test L56/L57 |
| R-04 | Student/guru menus were verified from prototype + .cloud layout labels only, not item by item against .cloud views | Re-check item lists at design time |
| R-05 | Dual-role is new; .cloud data has single role per user | Q1 |
| R-06 | Scoping of Laporan Aktiviti (PM-12) in .cloud not evidenced | marked `*`, must be scoped |

## 12. Open questions

### Blocking before G2 (each has a recommended default so work can proceed)
| # | Question | Recommended default |
|---|---|---|
| Q1 | Can one account hold several roles, and which pairs are allowed? | Yes. Role set per account; allowed: any two staff/teacher roles (e.g. Guru + Admin Sekolah; Guru + Pegawai); never Murid + staff; Admin Pusat is single-role. One active role per session. |
| Q2 | PPD and JPN: one role with a scope level, or two roles? How is scope stored? | One "Pegawai" family with scope level `district` or `state`, scope value stored explicitly on the account (migration derives it from the officer's school, as `PpdJpnController::scope()` does today). Prototype labels `ppd_officer`/`jpn_officer` kept as display names. |
| Q3 | Penaja (sponsor) and Ibu Bapa: placement and whether in v2 scope (neither has a login role in .cloud; both exist in the prototype)? | Both in Portal Pembelajaran with a minimal menu (§8), kept as built (M02/M15/M21); no new features. |
| Q4 | Pratonton: read-only preview of a chosen student, or full act-as like .cloud impersonation? Also teacher preview? | Read-only preview of a chosen student (Murid only). "Pratonton sebagai Guru" is Could, not v2.0. |

### Confirm (default applied unless user objects)
| # | Question | Default |
|---|---|---|
| Q5 | Follow D30 literally for Admin Sekolah (no Penglibatan, Bank Soalan/SPM, Log Audit, Tanda Karangan) although .cloud scoped some of these to schools? | Follow D30; Tanda Karangan marking is done by Guru in Portal Pembelajaran. |
| Q6 | Keep .my-only M27 items already built (DSKP Heatmap, Amaran Awal, Laporan Bulanan, Kelas Sekolah) despite D28c? Drop unbuilt .my-only items (Aktiviti Guru, Semakan Nota Master, Admin Tebusan, Kelulusan Hadiah admin view)? | Keep the four built; drop the unbuilt ones (§6.11). |
| Q7 | JPN gets Langsung (state level)? .cloud has `/ppd/command-center` only. | No; PPD only. |
| Q8 | Battle Ranking Sekolah / Leaderboard as read-only admin reports (Pusat) and "Battle Live" removed from admin? | Yes. |
| Q9 | Single login form: replicate .cloud `/login` (school + username + password, email accepted for any role) and retire the separate admin login page? | Yes. |

## Change log
- 2026-10-16: D43/D-RAM-2 — Admin Sekolah matrix rows 3–7, 45 restored as items (PM-24 to PM-28, KK-12); Sekolah Bersaing removed from the §6.11 removal list; total 94 → 100.
