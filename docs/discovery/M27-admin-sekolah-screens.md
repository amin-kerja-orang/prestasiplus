# M27 — Admin Sekolah screens L51–L58 (code-based discovery under D24)

- **Status:** DRAFT for the Delivery Lead, 2026-10-03. Code/doc-only discovery (no browser, no SSH, no live request). Not yet audited. Nothing is written as observed-live fact unless tagged LIVE-*.
- **Rows (roles matrix `docs/ROLES-MATRIX-LINES.md` lines 73–80, role-access-matrix rows 46–53, all "Admin Sekolah 1.0"):** L51 Statistik Penggunaan (#46), L52 DSKP Heatmap (#47), L53 Laporan Aktiviti (#48), L54 Amaran Awal (#49), L55 Laporan Bulanan (#50), L56 Senarai Pelajar (#51), L57 Senarai Guru (#52), L58 Kelas Sekolah (#53). Owner module **M27 School Admin Portal** (`/admin-sekolah/*`).
- **Scope guard:** Session 8 owns S0 `/admin-sekolah` (L07). Nothing here edits `docs/requirements/{urs,srs}/M27-school-admin.md` or any M27 code; where this file touches S0 it is a finding for Session 8 (§9).
- **D24:** where live cannot be observed (the six `/admin-sekolah/*` routes of these rows answer 302 to `/admin-sekolah/pilih-sekolah`, which is 500 for the platform admin; one answers 404; one is not under `/admin-sekolah` at all), the server code/data is the specification, tagged **SERVER**.
- **Privacy:** no real person's name, e-mail, phone or IC is copied. The deck and screenshot school names/codes are replaced by `{school}`, `{code}`. The reference repo's school-admin roster seeder (real-looking names, default password) is cited by path only and was not read for values. Aggregate counts from a screenshot are quoted without the school identity.

---

## 0. Plain finding

**The server has no `/admin-sekolah/*` route at all, and `ripped/` does not exist in the local replica.** So for L51–L58:

1. There is **no server controller/view** for Statistik Penggunaan, DSKP Heatmap, Laporan Aktiviti, Amaran Awal (school-admin variant), Laporan Bulanan, Senarai Pelajar, Senarai Guru or Kelas Sekolah *as school-admin pages*. `routes/web.php` has no `admin-sekolah` or `pilih-sekolah` string; every staff role lands on `/admin` (`backend/app/helpers.php:16-20`); the school of a school admin is always `users.school_id` (`backend/app/Support/StaffScope.php:128-131`); there is no picker (the `SchoolPicker` Blade component collapses to a locked label for `admin_sekolah`, `backend/app/View/Components/SchoolPicker.php:54-58`). (SERVER, negative result, same as L06/L07.)
2. What the server **does** hold is the **adjacent, school-scoped logic** that a school admin reaches through `/admin/*` (`role:admin,admin_sekolah,pegawai_ppd`, `routes/web.php:533`): `StaffScope`, `SchoolAggregates`, `LaporanController`, `LaporanEksekutifController`, `UserDirectory`, the guru Amaran logic, `dskpMap`. These give **formulas and scoping rules** (SERVER) but **not the screens' layout or copy**.
3. The **only evidence of real layout/copy** comes from four places, in this order of strength:
   - **LIVE-CAPTURE (our own, other modules):** M18 live captures of the same-template pages (`/amaran/sekolah/{id}`, `/ppd/statistik-penggunaan`, `/ppd/sekolah/{id}`), M17 `/admin/laporan`, M11 S3 school detail, M08 S3/S7, M09 `/panduan` Admin Sekolah tab. These are real live pages of **adjacent** roles/scopes, not the school-admin pages.
   - **LIVE-SCREENSHOT:** the two roles-matrix screenshots of 25 Sep 2026 (sidebar labels/order, S0 header). Nothing of L51–L58 content.
   - **SERVER-DECK:** `backend/public/present.html` and `backend/public/images/present/ss-*.png` in the replica: a sales deck of screenshots whose browser bars claim `prestasiplus.my/admin-sekolah` and `prestasiplus.my/amaran/sekolah`. They show **real school-admin pages** (S0 Dashboard Sekolah, Amaran Awal — Sekolah, Prestasi school dashboard) with an **older school-admin sidebar**. Undated (file time 2026-08-05 = copy time); second-hand; **not** observed by us. Treat as strong but unverified evidence, below LIVE-SCREENSHOT where they disagree.
   - **NOT FOUND:** no evidence at all of DSKP Heatmap, Laporan Bulanan, Kelas Sekolah, Senarai Pelajar and Senarai Guru page content (only labels, sidebar position, a Panduan sentence and analogous M18 school-detail sections).

### 0.1 Provenance legend

| Tag | Meaning | Rank |
|---|---|---|
| LIVE-SCREENSHOT | user roles-matrix screenshot (`roles-matrix/admin sekolah/*.jpeg`, 25 Sep 2026) | observed (second-hand) |
| LIVE-CAPTURE | our own live capture in another module's discovery (name the file) | observed, adjacent page |
| LIVE-PROBE | M27/R10 route probe (status code only) | observed |
| SERVER-DECK | screenshot in the replica's `present.html` / `images/present` | bundled evidence, undated |
| SERVER | replica backend code/data (`D:\Dev Projects\prestasiplus-reference\backend\…`) | spec under D24 |
| INFERRED / PROPOSED | derived / rebuild choice | — |
| NOT FOUND | searched, nothing | — |

Replica root `D:\Dev Projects\prestasiplus-reference`; server paths below are relative to `backend/`.

### 0.2 What was searched (negative results recorded)

| Search | Result |
|---|---|
| `admin-sekolah`, `pilih-sekolah`, `Dashboard Sekolah` across the whole replica | only role lists; the nav string in `HandleInertiaRequests.php:63` ("Papan Pemuka", unrelated); `public/present.html:993` (deck URL label). No route, controller, view, middleware. |
| `Laporan Bulanan`, `laporan-bulanan`, `monthly report` | **NOT FOUND** anywhere. Only monthly *sections* inside `LaporanEksekutifController` / `admin/laporan-eksekutif.blade.php` ("Trend Penggunaan Bulanan"). |
| `DSKP Heatmap`, `dskp-heatmap` | **NOT FOUND** as a school page. Student-level DSKP heatmap exists (`StudentController::dskpMap`, `BukuNotaController::heatmap`, `PetaBelajarController`). |
| `Kelas Sekolah`, `Senarai Pelajar`, `Senarai Guru`, `Cipta Pengguna` | no school-admin page. The labels exist only as section headings of teacher/monitoring views (`guru/monitoring.blade.php:70,132`, `guru/analitik-kelas`, `guru/kehadiran`). `Cipta Pengguna` appears only in the deck sidebar and in the Panduan sentence. |
| `Statistik Penggunaan` | `PpdJpnController::statistik` + `admin/ppd/statistik.blade.php` (PPD/JPN, not school). Route is **excluded for `admin_sekolah`** by the `pusat:` middleware (`routes/web.php:844-860`). |
| `ripped/` (clone, ADMIN-RIP.md) | **directory does not exist** in the local copy (`ls ripped` fails). No `ripped/clone/**` evidence is available for any row. |
| `docs/screenshots`, `docs/mockups`, `docs/prd*.md`, `docs/gap-analysis.md`, `.planning/**` | PRD lists "Amaran Awal `/amaran`" (teacher gateway) and school-admin one-liners only; gap-analysis: "Amaran Awal ... MISSING" (older state). Nothing for the other rows. |

---

## 1. Common behaviour of the school-admin pages

### 1.1 Route, method, middleware, shell

| Item | Finding | Provenance |
|---|---|---|
| Methods | GET only for every row below (read-only pages). Exports are GET links (CSV/print). | INFERRED from M18/M17 analogues |
| Live route status with the admin account | `/admin-sekolah/statistik-penggunaan`, `/pelajar`, `/guru`, `/kelas`, `/dskp-heatmap`, `/laporan-bulanan` → **302 `/admin-sekolah/pilih-sekolah`** (routes exist: the nonexistent control is 404); `/admin-sekolah/laporan-aktiviti` → **404** | LIVE-PROBE (`M27-school-admin.md` §1.2 rows 6–11, 13; `R10` §1.1) |
| Meaning of the 302 | a school-scope step that wants a chosen school; for the platform admin (no school) it goes to the picker, which crashes (500). For a `school_admin` the picker is presumably skipped (one school). | INFERRED (`M27-school-admin.md` §1.2 reading) |
| Middleware / roles (server adjacent) | group `['auth','role:admin,admin_sekolah,pegawai_ppd']` (`routes/web.php:533`); `EnsureRole` is variadic. School scope applied **inside controllers** by `StaffScope::listScopeSchoolId($actor)` = `actor.school_id` for `admin_sekolah`, else null (`StaffScope.php:128-131`); `openedScopeOrAbort()` (`StaffScope.php:142-148`) = 403 for a school admin without school and for `pegawai_ppd`. | SERVER |
| Server defect not to copy | `Admin\DashboardController` and any caller of `listScopeSchoolId()` without `openedScopeOrAbort()` treat a school admin with **no school** as national (null = all). | SERVER (defect; same as L07 §2) |
| Shell | user shell (SHU) with the school-admin sidebar (live screenshots: breadcrumb/page header style as S0). In the deck the pages use the same shell (white header with title + sub-line `{school name}`, avatar, logout icon). | LIVE-SCREENSHOT / SERVER-DECK |
| Header pattern | title = page name, sub-line = school name in capitals (deck: "Amaran Awal — Sekolah" / `{SCHOOL}`; "Dashboard Sekolah" / `{SCHOOL}`). Live M18 pages use the same `title` / `sub` pair. | SERVER-DECK / LIVE-CAPTURE (`M18-ppd-jpn.md` §2.18) |
| Guards to reuse | S0 rules of the (read-only) M27 SRS: non-`school_admin` → global 403 "Akses Ditolak" in place; `school_admin` with no school → 403, never "all schools"; guest → `/login`; ids of another school → 404 (M11/M17 alias rule, BR-M11-35 / BR-M17-34); `/admin-sekolah/pilih-sekolah` not built (answers 404). | PROPOSED (consistent with M27 SRS FR-M27-07/08/10, BR-M27-01/02) |

### 1.2 "pilih-sekolah" behaviour

- **Live:** `/admin-sekolah/pilih-sekolah` is a real route (target of 8 redirects) but returns **500 "Ralat Pelayan"** for the platform admin on every request (LIVE-PROBE; D-M27-01). Content for a working role: **NOT FOUND**. Whether a `school_admin` is ever sent there: unknown.
- **Server:** no picker exists. The school is `users.school_id`; the locked `SchoolPicker` component shows the school as a label with name and `{code} · {district} · {state}` meta (SERVER `SchoolPicker.php:45-70`).
- **Rebuild (PROPOSED, consistent with M27 SRS FR-M27-08/10):** no picker route; platform admin and every non-school-admin gets 403 on the `/admin-sekolah/*` family. Open question OQ-M27D-01.

### 1.3 Sidebar facts that matter to these rows

| Fact | Evidence |
|---|---|
| Live sidebar of 25 Sep 2026 (second screenshot): HARIAN: Dashboard, **Senarai Pelajar**, **Senarai Guru**, **Kelas Sekolah**; PENILAIAN: Headcount, Prestasi, **Amaran Awal**, **Laporan Bulanan**; ANALITIK: Monitoring, Kirkpatrick, Analitik Adaptif, **Statistik Penggunaan**, **DSKP Heatmap**, Analisa Item, **Laporan Aktiviti** | LIVE-SCREENSHOT (labels and order only; no hrefs, no icons) |
| Older sidebar in the deck (first block of `ss-admin.png`, `ss-amaran-awal.png`): Dashboard; PENGURUSAN: Kelas Sekolah, Senarai Pelajar, Senarai Guru, Statistik Penggunaan; TINDAKAN: Cipta Pengguna, Import Pelajar; AKADEMIK: Headcount … | SERVER-DECK. Order and grouping differ from the live screenshot (the product changed). **Live screenshot wins.** |
| `src/shells/nav/user-nav.ts:364-392` hrefs: `/admin-sekolah/pelajar`, `/guru`, `/kelas`, `/statistik-penggunaan`, `/dskp-heatmap`, `/laporan-bulanan` exist on live (302); `/admin-sekolah/laporan-aktiviti` is **404 on live**; Amaran Awal uses `/amaran` | INFERRED hrefs, probe results from `M27-school-admin.md` |
| Amaran Awal: deck URL label is `prestasiplus.my/amaran/sekolah` (school view of the school admin); the nav uses `/amaran` (M18 S16 class gateway; the admin sees every class) | SERVER-DECK vs INFERRED — open question OQ-M27D-04 |
| Laporan Aktiviti: the real href is unknown; the **admin-panel** item "Laporan Aktiviti" (M17 drawer) is `/admin/laporan` (M17 S11 "Laporan Statistik"), and the server's school-admin-visible sidebar item "Laporan" is `/admin/laporan` and the controller is scoped to the school (`Admin/LaporanController.php` header, `layout.blade.php:292,882`) | LIVE-CAPTURE (M17) + SERVER → proposed route, OQ-M27D-03 |

---

## 2. L51 — Statistik Penggunaan (#46)

### 2.1 Routes

| Route | Status | Provenance |
|---|---|---|
| `/admin-sekolah/statistik-penggunaan` | 302 → pilih-sekolah (exists) | LIVE-PROBE |
| `/ppd/statistik-penggunaan?period=today\|7days\|30days`, `/jpn/statistik-penggunaan` (different roles) | 200, empty states only (admin account scope PPD KLUANG / Johor, no data) | LIVE-CAPTURE `M18-ppd-jpn.md` §2.3, §2.12 |
| Server `/ppd|jpn/statistik-penggunaan` → `PpdJpnController::statistik` | for `admin_sekolah` the `pusat:` middleware answers the "diuruskan oleh Admin Pusat" notice: the server **deliberately does not give a school admin this screen** | SERVER (`routes/web.php:844-860`) |

### 2.2 Inventory and copy

| Element | Copy / value | Provenance |
|---|---|---|
| Sidebar label | "Statistik Penggunaan" (ANALITIK; deck: PENGURUSAN, icon pie) | LIVE-SCREENSHOT / SERVER-DECK |
| Panduan description (Admin Sekolah tab) | card "Statistik Penggunaan": "Pelajar aktif, sesi latihan, soalan dijawab — gambaran engagement." | LIVE-CAPTURE `M09-content.md` lines 1138–1150 (also SERVER `content/panduan.blade.php:241`) |
| Header / title | not observed for the school variant. Analogue live PPD page: h1/shell "Statistik Penggunaan Daerah", header "PPD KLUANG" "Johor", sub "Statistik Penggunaan PRESTASIPLUS Dalam Daerah", breadcrumb "Dashboard PPD" › "Statistik Penggunaan" | LIVE-CAPTURE (analogue, M18 S3) |
| Counters (analogue) | "0" "Sekolah", "0" "Pelajar Aktif" | LIVE-CAPTURE (analogue) |
| Period pills (analogue) | "Hari Ini" (`period=today`), "7 Hari" (`7days`), "30 Hari" (`30days`, default) | LIVE-CAPTURE (analogue; labels per M18 S3 "Period pills", empty-state copy uses "7 Hari", "30 Hari") |
| Empty states (analogue) | 30/7 days: card "Tiada data untuk tempoh ini" + "Tiada aktiviti latihan dalam tempoh 30 Hari yang lepas." (7 days: "… 7 Hari …"); today: "Belum ada pelajar buat latihan hari ini. Cuba lihat **7 Hari** atau **30 Hari**." (words are links) | LIVE-CAPTURE (analogue) |
| Filled layout (cards, table, chart) | **NOT FOUND** for live (M18 Q-M18-4: never observed filled) | NOT FOUND |
| Server analogue sections | summary strip "Sekolah / Guru / Pelajar / Pelajar Aktif / Penglibatan / Ketepatan"; table "Mengikut Mod Latihan" (Mod · Sesi · Ketepatan Purata); table "Mengikut Sekolah"; empty "Belum ada sesi latihan direkodkan dalam skop ini."; footnote "Ketepatan dipaparkan sebagai “—” kerana belum ada sesi latihan direkodkan dalam skop ini." | SERVER (`admin/ppd/statistik.blade.php`, `_shell.blade.php`) — reconstruction, copy not live |

### 2.3 Formulas (SERVER, `Support/SchoolAggregates.php`)

- **Pelajar (daftar)** = count(`users` role=pelajar, school_id = S). **Guru** = count(role=guru, school_id = S).
- **Pelajar Aktif** = `COUNT(DISTINCT question_attempts.user_id)` over pupils of S ("an active student is one with at least one answer; logging in is not activity").
- **Soalan** = count(`question_attempts`) of users of S.
- **Penglibatan %** = `reg > 0 ? (int) round(aktif / reg * 100) : 0` (a school with no roll is 0 %, never 100 %).
- **Ketepatan** = `AVG(practice_sessions.accuracy)` over sessions of users of S, one decimal; **null ("—")** when no session ("no attempts" is not "averaging zero").
- **Mod split** = `practice_sessions.mode`, `COUNT(*)` and `AVG(accuracy)` grouped by mode, ordered by count desc.
- Windowing by `period` (today / 7 / 30 days): **not in the server** (the server page has no period); live PPD page has it (LIVE-CAPTURE). Window rule for the school variant: PROPOSED = same as M18 S3 once M18 defines it.

### 2.4 Data mapping to our stores (D12)

| Need | Owner / contract | Note |
|---|---|---|
| Pupils/teachers of the school | M02 users (`schoolId`, role) | `Q` = M02 list scoped to the school |
| Active pupils / answers | M05 answer log (Q-M11 / M17 engagement definition) | reuse M17/M11 `Q-…ENGAGED`-style named query; do not recompute differently (M11 BR: active = ≥ 1 answer) |
| Sessions / mode / accuracy | M05 practice sessions (`mode`, `correctCount ÷ questionCount`) | accuracy = mean of session accuracies (M08 BR-M08-07 definition) |
| School header (name, code, state, PPD) | M02 schools | as S0 banner (BR-M27-03) |
| Read model | **M27 owns a small `SchoolUsageStats` query** (period → counts); PPD/M18 `Q-M18-*` aggregates are district-scoped and could be called with a one-school scope | no stored schema |

### 2.5 States, exports

- Empty / no-data and period handling: see 2.2 (analogue). **Export:** none observed for Statistik (PPD page has none). PROPOSED none.
- Error: 403 global page (role/no school); 404 for foreign ids (n/a, page has no id).

### 2.6 Live-probe checklist (when a school-admin account exists)

1. Page title/h1/sub, breadcrumb target ("← Papan Pemuka"?), period pills (labels, default, query names).
2. Counters and cards: labels, values, which windows change them.
3. Table(s)/chart(s): columns, sort, pagination, per-class or per-level rows.
4. Empty copy for a new school (compare with the PPD copy above).
5. Export buttons (CSV/PDF), downloaded columns.
6. Mobile layout at 375/768/1280, overflow.

### 2.7 Open questions

OQ-M27D-05: is the school page a copy of the PPD S3 template (period pills, "Pelajar Aktif" counter) or the deck-era "Pelajar aktif, sesi latihan, soalan dijawab" trio? OQ-M27D-06: does it list classes/levels? (NOT FOUND.)

---

## 3. L52 — DSKP Heatmap (#47)

### 3.1 Routes

`/admin-sekolah/dskp-heatmap` → 302 → pilih-sekolah (exists) — LIVE-PROBE (R10 S2; M27 §1.2 row 10). Server: **no school route**. A student-level DSKP heatmap exists in the server as a card inside the student analytics page (`StudentController@dskpMap`, line 825) and links to `/latih-tubi/{code}/kuiz?chapter={id}`.

### 3.2 Inventory

| Element | Evidence | Provenance |
|---|---|---|
| Label "DSKP Heatmap" (ANALITIK, after Statistik Penggunaan, before Analisa Item) | roles-matrix screenshot | LIVE-SCREENSHOT |
| All page content (title, filters, axes, legend, cells, export, empty) | none | **NOT FOUND** (R10 OQ-R10-01 unchanged) |
| Analogue 1, student: card "Peta DSKP — Standard Pembelajaran" (`fa-map`), caption "{KSSR \| KSSM} {Subjek} {level name}", one tile per SP (title "{code}: {title} — {Mahir\|Sederhana\|Lemah\|Belum cuba}"), legend "Mahir (75%+)", "Sederhana (50-74%)", "Lemah (<50%)", "Belum Cuba", badge "Fokus" "Klik untuk latihan fokus" | LIVE-CAPTURE `M08-student-performance.md` §2.7 (live student/admin own data) |
| Analogue 2, student: "Heatmap Topik Lemah" legend "Lemah (< 50%)", "Sederhana (50-79%)", "Mantap (≥ 80%)", "Belum cuba"; cell "{n} cuba · {p}% betul" | LIVE-CAPTURE `R10` §2.1 |
| Analogue 3, school × subject matrix: M18 S6 `/ppd/peta-haba` (school × 7 core subjects, "Purata" row, hint and footer text) | LIVE-CAPTURE `M18-ppd-jpn.md` §2.6 / SRS FR-M18-41 |
| Analogue 4, server: tile grid per school coloured by Penglibatan (≥ 75 emerald-600, ≥ 50 emerald-300, ≥ 25 amber-300, else rose-400, no roll grey): text "Setiap petak ialah satu sekolah. Warna mengikut kadar penglibatan pelajar." / "Petak kelabu bermaksud sekolah itu belum mempunyai pelajar berdaftar." | SERVER `admin/ppd/peta-haba.blade.php` (reconstruction, **not school/DSKP**) |
| Student heatmap grouping in the server: subject → **strand/bidang** (`chapters.strand`, fallback "Bidang {leading code segment}" / "Lain-lain") → tile per chapter with `dskp_code` or "BAB{n}"; `acc = round(betul/soalan*100)` or null; bands <50 red, <80 amber, else green, null gray | SERVER `StudentController.php:825-907`, `BukuNotaController.php:144-204` |

### 3.3 Formulas (SERVER, student-level, the only DSKP-coloured logic)

- Per chapter c and student u: `soalan = count(question_attempts of u whose question.chapter_id = c)`, `betul = sum(is_correct)`, `acc = soalan > 0 ? round(100·betul/soalan) : null`.
- Colour bands: `null` gray "Belum cuba"; `< 50` red; `50–79` amber; `≥ 80` green (matches live R10 S1 legend). M08 live uses a different banding for the SP map (75/50).
- A school-level DSKP heatmap would aggregate this over the pupils of S: **the aggregation rule (mean of pupil accuracies vs pooled answers, which tile axis, which levels) is NOT FOUND.** Proposal only: pooled `betul/soalan` over S's pupils per SP (M08 `PupilSubjectAccuracy`/M05 answer log), banded as M08 FR-M08-52. PROPOSED, must be confirmed.

### 3.4 Data mapping

DSKP structure Bidang → SK → SP: M03 curriculum (F-30 DSKP store). Pupil answers: M05 answer log joined to M04 question → M03 chapter/SP. Mastery bands: M08 (`Mahir/Sederhana/Lemah/Belum cuba`). School scope: M02. Candidate read model owned by M27: `Q-M27-DSKP(schoolId, subjectId?, levelId?)` returning `{subject, bidang, sp, answered, correct, band}` (no new store). Reuse of M25 R10 S1 grouping is possible but M25 is per-student.

### 3.5 Live-probe checklist

Title, filters (subject, level, class, Bidang/SK/SP?), axes (classes × SP? SP × level?), cell content (% or count), thresholds and legend, tooltip/`title`, cell link target (practice? list?), export, empty state, behaviour for a school with no answers, mobile layout.

### 3.6 Open questions

OQ-M27D-07: axes and unit of the school DSKP heatmap. OQ-M27D-08: levels (T4/T5 only, as M11/M12, or D1–T5?). Both **NOT FOUND**.

---

## 4. L53 — Laporan Aktiviti (#48)

### 4.1 Routes

| Route | Status | Provenance |
|---|---|---|
| `/admin-sekolah/laporan-aktiviti` | **404** (inferred href wrong; D-M27-02) | LIVE-PROBE |
| `/admin/laporan?range=7\|30\|90` ("Laporan Statistik", Admin) | 200 for platform admin; drawer label "Laporan Aktiviti" | LIVE-CAPTURE `M17-admin-dashboard.md` §2.11 (drawer label line 52, S11) |
| Server `GET /admin/laporan` → `Admin\LaporanController@index` | accessible to `admin_sekolah`, **all 13 queries confined to the school** since 21 Sep 2026; sidebar "Laporan" (`layout.blade.php:292`, mobile drawer `:882`) | SERVER |

**Finding:** the school admin's "Laporan Aktiviti" is very probably the same page as the admin's (`/admin/laporan`, label "Laporan Aktiviti" in the drawer, h1 "Laporan Statistik"), scoped to the school. The real live href is unseen. PROPOSED: mount as an alias `/admin-sekolah/laporan-aktiviti` (OQ-M27D-03), reusing M17 S11.

### 4.2 Inventory (M17 S11, live for the platform admin; school-scoped version SERVER-defined)

Title tab "Laporan Statistik - Admin Panel"; shell "Laporan Statistik" / "Penglibatan pengguna seluruh platform" (LIVE-CAPTURE). Elements (all LIVE-CAPTURE for the platform view, see `M17-admin-dashboard.md` §2.11):

- Tabs "Overview", "Sekolah ({n})", "Guru ({n})", "Murid ({n})"; "Tempoh:" pills "7 Hari" `?range=7`, "30 Hari" (default), "3 Bulan" `?range=90`; any other value → 30.
- Overview cards: "Murid Pernah Login" (% · "{n} / {total}" · "{n} belum pernah login"), "Cikgu Pernah Login", "Murid Buat Latihan", "Jumlah Aktiviti" ("{n} hari lepas"), "Skor Purata" (+ chip "Struktur: {p}%").
- "Trend Aktiviti" line chart; "Pecahan Aktiviti" (Kuiz Objektif, Soalan Berstruktur, Battle Arena, Permainan); "Pelajar Paling Aktif" (top 10); "Cikgu Belum Login" (first 20, with e-mail).
- Sekolah tab "Aktiviti Mengikut Sekolah" (pills Semua/Aktif/Kurang/Tidak Aktif, search "Cari sekolah...", table); Guru tab "Senarai Guru ({n})" (pills Semua/Pernah Login/Belum Login, search "Cari guru...", school select, table #, Nama, Sekolah, Login, MCQ, Struktur, Syiling, Headcount, Login Terakhir); Murid tab "Senarai Murid ({n}) — Top 200" (pills, search, table #, Nama, Sekolah, Kelas, Sesi, Ketepatan, Masa, Syiling, Login Terakhir).
- Known live defects: D-M17-18 (Murid tab filters "Login Sahaja"/"Belum Login" always empty), no empty row on no-match search.

**School-scope differences, SERVER:** every figure confined; "schools" figure = 1 (`$totalSchools = $scope !== null ? 1 : …`); the two person lists (top pupils, teachers who never logged in **with e-mails**) are confined to the school (`LaporanController.php` header comment and queries `$ownUsers`, `$ownSessions`). What the live school-admin variant does with the Sekolah tab (a one-row table? hidden?): **NOT FOUND**; PROPOSED hide the Sekolah tab for a one-school scope, label the rest unchanged (open OQ-M27D-09).

### 4.3 Formulas

Live definitions of "Pernah Login", "Buat Latihan" etc. are M17's (M17 SRS Q-M17 / §6.x; reuse). SERVER proxies differ and must **not** be copied: server "logged in" = `email_verified_at IS NOT NULL` ("honest proxy", `LaporanController.php`), "practised" = distinct users with a `practice_sessions` row, 30-day volume = count(`practice_sessions.started_at ≥ now-30d`). Live M17 values are the specification where they exist (M17 SRS DC-M17-… and BR over `lastLoginAt`).

### 4.4 Data mapping

M17 `StatsReport` (§7 #18 `GET /api/admin/laporan?range=`): add a school-scoped guard **AS** (admin or `school_admin` forced to own school, same as FR-M17-105 for Command Center). Stores: M02 users (login date, school), M05 sessions/answers, M16 battles/games, M14 syiling. **No new schema.**

### 4.5 Export / states

No export observed on S11. 403 for other roles; 404 route for the wrong href must not ship (D-M27-02).

### 4.6 Live-probe checklist

Real href of the sidebar item; title and sub; whether tabs exist for a school admin; Sekolah tab (hidden?); whether "Cikgu Belum Login" lists e-mails; range pills; mobile.

### 4.7 Open questions

OQ-M27D-03 (href), OQ-M27D-09 (Sekolah tab for one school), OQ-M27D-10 (does the school admin see the same "Skor Purata/Struktur" chip).

---

## 5. L54 — Amaran Awal (#49)

### 5.1 Routes (the best-evidenced row)

| Route | Meaning | Provenance |
|---|---|---|
| `/amaran` | M18 S16 "Amaran Awal — Kelas" class gateway (teacher; admin sees every class). Used by `user-nav.ts` for school admin. | LIVE-CAPTURE `M18` §2.14; INFERRED nav |
| `/amaran/sekolah/{id}` (and `/sekolah/{id}/amaran`, `?tingkatan=T4\|T5`) | M18 S22/S28 school overview, "Amaran Awal — Sekolah" / `{SEKOLAH}` | LIVE-CAPTURE `M18` §2.18 |
| `/amaran/sekolah` (no id; deck URL bar, school-admin sidebar) | the same template for the school admin's own school | SERVER-DECK (`present.html:796-809`, `ss-amaran-awal.png`) |
| `/amaran/kelas/{id}`, `/amaran/keberkesanan`, `/amaran/ringkasan-eksekutif?scope=school&school_id=`, `/amaran/intervensi/{studentId}`, `/amaran/export/school/{id}`, `/amaran/export/class/{id}` | child pages/exports | LIVE-CAPTURE `M18` §2.15–2.20; SRS S16–S24, #29–#31 |
| Server `GET /amaran`, `/guru/amaran` → `TeacherAnalyticsController@amaran` | **teacher-only** gateway (class cards + at-risk list with reasons), not the school page | SERVER (`routes/web.php:1701-1702`) |

**Reuse:** M18 already has a G1-approved spec for this template (`docs/requirements/srs/M18-ppd-jpn.md`: S16, S17, S21, S22, S23, S24, BR-M18-01 "school admin → own school", BR-M18-13/14 risk score and status, FR-M18-75…77, build-plan row #49). **L54 needs no new discovery of its own layout**; it needs the route/href decision and the school-admin guards.

### 5.2 Inventory of the school-admin page (SERVER-DECK, matches the live M18 S22 template)

| Element | Copy | Provenance |
|---|---|---|
| Header | title "Amaran Awal — Sekolah", sub `{SCHOOL}` | SERVER-DECK; LIVE-CAPTURE M18 |
| Level pills | "Semua Tingkatan" (active, amber), "Tingkatan 4", "Tingkatan 5" | SERVER-DECK; LIVE-CAPTURE M18 §2.18 |
| 4 tiles | "Jumlah Pelajar", "On Track", "Perlu Perhatian", "Berisiko Tinggi" (deck values 9 / 0 / 6 / 3) | both |
| Card | "Taburan Risiko Seluruh Sekolah": stacked bar with integer % per segment (deck 67 % / 33 %), legend "Hijau: 0", "Kuning: 6", "Merah: 3" | both |
| Buttons | "Ringkasan Eksekutif" (dark, `fa-file-alt`), "Muat Turun CSV" (amber, `fa-download`). **Live M18 S22 also has "Keberkesanan Intervensi" (first button); the deck lacks it** (deck is older). Live wins. | SERVER-DECK vs LIVE-CAPTURE |
| Card | "Analisis Risiko Mengikut Subjek": rows "{Subject}" + red bar "{w}/{m} pelajar lemah ({p}%)" (deck: Fizik 5/5, Biologi 3/3, Matematik 6/6, Sejarah 3/3, Kimia 5/5, Perniagaan 2/2, Matematik Tambahan 2/2, all 100 %) | SERVER-DECK; LIVE-CAPTURE M18 |
| Table (below the capture) | "Senarai Pelajar Berisiko", "Disusun mengikut skor risiko tertinggi": # · Pelajar · Tingkatan / Kelas · Skor · Status · Ketepatan · Penglibatan · Penguasaan | LIVE-CAPTURE M18 §2.18 (the deck is cut off) |
| Sidebar active item | "Amaran Awal" is the school-admin entry whose page is the school overview | SERVER-DECK |

Other live M18 child states (empty "Belum Ada Intervensi", "Tiada data intervensi lagi.", CSV `amaran-sekolah-{id}-{yyyymmdd}.csv` columns "Bil, Pelajar, Sekolah, Tingkatan / Kelas, Skor Risiko, Status, Ketepatan, Penglibatan, Penguasaan", print view "Ringkasan Eksekutif") are in M18 SRS §7.2 and §8.1; not repeated.

### 5.3 Formulas

Risk score, status cut-offs, school aggregates: **M18 BR-M18-13 (score = 0.4·A + 0.3·E + 0.3·M), BR-M18-14 (Hijau < 40, Kuning 40–59.9, Merah ≥ 60), BR-M18-16 (subject weakness), BR-M18-22 (order)**. Reuse by name; do not restate.

Cross-check against S0 (Session 8): the deck Dashboard tile "AMARAN AWAL" shows "0 Selamat · 6 Berhati · 3 Berisiko · 9 murid dinilai" — the same 0 / 6 / 3 / 9 as this page's "On Track / Perlu Perhatian / Berisiko Tinggi / Jumlah Pelajar" (SERVER-DECK, same school). The tile labels differ from the page labels ("Selamat", "Berhati", "Berisiko" vs "On Track", "Perlu Perhatian", "Berisiko Tinggi"); both are observed copy.

The server's own at-risk rule (`TeacherAnalyticsController::riskReasons`) is **different and binary** (accuracy < 40 % with ≥ 10 attempts, no activity 7+ days or never active, two low-mood check-ins) and has **no score or status**; it is teacher-class-scoped. **Do not use it for the school page** (live M18 captures define the score).

### 5.4 Data mapping and scoping

M18 `Q-M18-RISK(scope|classId|schoolId)` already defined; the school admin calls it with `schoolId` forced from the session (BR-M18-01). Stores: M05 sessions/mastery, M02/M01 `lastActiveAt`, M10 classes, M18 interventions (DATA-M18-01). M18 SRS §9 already lists S22/S23/S24 for "school admin" (own school) — M27 adds only the **route/sidebar binding** and the 403/404 rules (foreign `{id}` → 404 like BR-M17-34).

### 5.5 Live-probe checklist

Which URL the sidebar item opens for a school admin (`/amaran` vs `/amaran/sekolah` vs `/amaran/sekolah/{ownId}`); whether `/amaran` for a school admin lists own-school classes or redirects; foreign id behaviour (403 or 404); presence of "Keberkesanan Intervensi"; button targets; CSV name/columns; "Intervensi" write permission for a school admin (M18 BR-M18-18).

### 5.6 Open questions

OQ-M27D-04 (target href of the sidebar item). OQ-M27D-11 (foreign school id: 403 or 404 on live; M18 S17 shows unknown class → 403).

---

## 6. L55 — Laporan Bulanan (#50)

### 6.1 Routes

`/admin-sekolah/laporan-bulanan` → 302 → pilih-sekolah (exists) — LIVE-PROBE (R10 S3, M27 §1.2 row 11). Server: **NOT FOUND** (no route, controller, view, or string; searched `bulanan`, `monthly`, `laporan-bulanan` in routes, app, resources, docs, `.planning`).

### 6.2 Inventory

| Element | Evidence | Provenance |
|---|---|---|
| Label "Laporan Bulanan", PENILAIAN, after "Amaran Awal" (before ANALITIK) | screenshot | LIVE-SCREENSHOT |
| Page content: month selector, KPIs, tables, charts, print/export, empty state | none | **NOT FOUND** |
| Nearest observed analogues (not S3 fact): M17 S8/S9 "Trend Penggunaan Bulanan {year}" (12 bars, answers + "{n}p" active pupils), "Trend Aktiviti Bulanan" per school, "Prestasi Mengikut Subjek", "Headcount TOV → RS", footer "Laporan dijana automatik oleh PrestasiPlus"; M18 S9 "Statistik Bulanan" table (Bulan · Soalan Dijawab · Soalan Betul · Pelajar Aktif · Purata/Pelajar · Accuracy; "12 bulan terakhir"); M18 S23 print view "Ringkasan Eksekutif" (Cetak / PDF, "Dijana: …"); weekly reports M08 `/laporan-mingguan`, M11 `/guru/laporan-mingguan-kelas` | LIVE-CAPTURE (analogues): `M17` §2.8–2.9, `M18` §2.9, §2.19, `R10` §2.3 |
| Server analogue: scoped school focus report (monthly activity bars, subject strongest/weakest, headcount) | SERVER `Admin/LaporanEksekutifController.php` (scoped via `openedScopeOrAbort`, league tables withheld when scoped), `admin/laporan-eksekutif.blade.php`; sidebar nav list note "league tables withheld when scoped" (`helpers.php` `nav_school_scoped`) | SERVER (adjacent) |
| Panduan sentence on the print flow ("Macam mana nak cetak Ringkasan Eksekutif?" "Amaran Awal → Ringkasan Eksekutif → Cetak / PDF.") | the school admin's printable one-page report is the **Ringkasan Eksekutif** under Amaran Awal; no mention of a monthly report | LIVE-CAPTURE `M09-content.md` §Panduan Admin Sekolah |

### 6.3 Formulas

NOT FOUND for the page. If the page is a monthly slice, the observed monthly definitions are M17 S8 (answers per month, active pupils per month) and M18 S9 (Soalan Dijawab, Soalan Betul, Pelajar Aktif, Purata/Pelajar = answers ÷ active pupils, Accuracy). PROPOSED only.

### 6.4 Data mapping

M05 answers/sessions (month buckets), M02 users, M18 risk aggregates, M17 report builders. Candidate M27-owned read model `Q-M27-MONTHLY(schoolId, month)`; **not to be built until the page is observed**.

### 6.5 Live-probe checklist

Everything: title, month/year picker (query names), sections, KPIs and definitions, charts, comparison with previous month, per-class/per-subject tables, print/PDF/CSV export (filename, columns), empty state for a month without activity, whether it reuses "Ringkasan Eksekutif".

### 6.6 Open questions

OQ-M27D-12: does Laporan Bulanan exist as a distinct report or is it a month filter over Ringkasan Eksekutif? **NOT FOUND**.

---

## 7. L56 — Senarai Pelajar, L57 — Senarai Guru, L58 — Kelas Sekolah (#51, #52, #53)

### 7.1 Routes

| Row | Route | Status | Provenance |
|---|---|---|---|
| L56 | `/admin-sekolah/pelajar` | 302 → pilih-sekolah (exists) | LIVE-PROBE |
| L57 | `/admin-sekolah/guru` | 302 → pilih-sekolah (exists) | LIVE-PROBE |
| L58 | `/admin-sekolah/kelas` | 302 → pilih-sekolah (exists) | LIVE-PROBE |
| analogues | `/admin/users?role=student\|teacher` (M02 S1, platform admin); `/ppd/sekolah/{id}` S9 sections "Senarai Pelajar — Terperinci", "Senarai Guru", "Prestasi Per Kelas"; `/admin/monitoring/sekolah/{id}` M11 S3 "Senarai Pelajar T4/T5", "Senarai Guru ({n})"; `/prestasi/kelas` M08 S3 class table | 200 | LIVE-CAPTURE (M02, M18, M11, M08) |
| server | `/admin/users` scoped (`UsersController@index`, `UserDirectory`), `/admin/import-students`, `/admin/users/bulk-import` for a school admin; **no school-wide class list** (`TeacherController@kelas` lists only the teacher's own classes) | SERVER |

Sidebar facts: the live labels sit under HARIAN (the three together, after Dashboard). Deck-era: PENGURUSAN with "Cipta Pengguna" and "Import Pelajar" under TINDAKAN. Panduan: "Dari panel admin, pergi ke 'Senarai Guru' → 'Cipta Pengguna'" (LIVE-CAPTURE `M09-content.md`), so **Senarai Guru contains (or links to) a "Cipta Pengguna" action**; "Urus Pelajar: Import pelajar pukal, edit maklumat, pantau senarai seluruh sekolah"; "Urus Guru: Daftar guru, edit profil, aktif/nyahaktif akaun guru"; FAQ "Boleh reset kata laluan guru/pelajar? Ya! Dari senarai guru/pelajar, klik nama pengguna, kemudian 'Reset Kata Laluan'." (all LIVE-CAPTURE, M09 Panduan Admin Sekolah tab).

### 7.2 Inventory per screen (what exists as evidence)

**L56 Senarai Pelajar** (page layout NOT FOUND):

| Candidate element | Source | Provenance |
|---|---|---|
| Table of the school's pupils; row opens a detail page where "Reset Kata Laluan" exists; edit; bulk import link | Panduan sentences above | LIVE-CAPTURE (text) |
| M02 S1 table columns: [checkbox], #, Nama, Emel, Telefon, Peranan, Sekolah, "Aktif?" toggle, Tarikh, Tindakan; 25 per page; role cards; filters Peranan / Sekolah / status / search | M02 FR-M02-02/03/06 | LIVE-CAPTURE (platform admin) |
| Server `UserDirectory::paginate`: filters `role`, `school`, `is_active`, `search` (name, e-mail, username LIKE), order **active first then newest id**, 25 per page; role counter cards from `roleStats`; "pending approval" count for inactive pelajar/guru | SERVER |
| M18 S9 table "Senarai Pelajar — Terperinci": one accordion per class ("{class}" "{n} pelajar" "{n} guna" "{n} belum"; "Tiada Kelas"), columns # · Nama Pelajar · No. IC (masked; "Tunjuk IC Penuh" with PDPA confirm, badge "PDPA Dilindungi") · Status ("Belum Guna"/"Sudah Guna") · Sesi · Soalan · Accuracy · Terakhir Aktif ("Tiada rekod"); empty "Tiada data pelajar" / "Tiada pelajar dalam sekolah ini buat masa ini" | LIVE-CAPTURE `M18` §2.9 (officer view) |
| M11 S3 table "Senarai Pelajar T4/T5": filters pills Semua/Aktif/Login sahaja/Belum login, search "Cari nama pelajar...", columns # · Nama · Tingkatan · Soalan · Status · Login Terakhir · Aktiviti Terakhir | LIVE-CAPTURE `M11` §2.3 |
| Create/import actions ("Cipta Pengguna", "Import Pelajar"), deck-era sidebar items | deck sidebar | SERVER-DECK |

**L57 Senarai Guru** (NOT FOUND layout): candidates: M18 S9 "Senarai Guru" "Guru berdaftar di {SEKOLAH}": # · Nama · Email · Subjek (chips) · Kelayakan · Kelas, empty "Tiada guru berdaftar" / "Sekolah ini belum mempunyai guru yang berdaftar dalam sistem" (LIVE-CAPTURE); M11 S3 "Senarai Guru ({n})": # · Nama · Status ("Pernah login") · Login Terakhir · Daftar, empty "Tiada guru berdaftar untuk sekolah ini." / server "Tiada guru lain di sekolah ini." (LIVE-CAPTURE / SERVER); "Cipta Pengguna" (Panduan; creates a guru; server `importableRoles` for admin_sekolah = `['guru']`).

**L58 Kelas Sekolah** (NOT FOUND layout): candidates: M18 S9 "Prestasi Per Kelas" "{n} kelas dipaparkan": Kelas · Tingkatan · Jumlah · Sudah Guna · Belum Guna · % · Accuracy · Penggunaan (bar), empty "Tiada kelas dijumpai" / "Sila cipta kelas terlebih dahulu" (LIVE-CAPTURE); the class cards of the teacher page (`/guru/kelas`, M10 S4: class name, subject, level, join code, member count) (LIVE-CAPTURE M10; server `TeacherController@kelas`: `classrooms` joined to `education_levels`, `schools`, member counts from `classroom_student`); M08 S3 class table with group "Kelas Sekolah" (see 7.3); deck: the sidebar item "Kelas Sekolah" is the first item under PENGURUSAN (SERVER-DECK) and the Dashboard tile "KELAS AKTIF". Also the `SchoolDashboard` in the deck-era Prestasi page states "26 kelas · 171 murid" (SERVER-DECK `ss-prestasi-sekolah.png`).

### 7.3 Naming trap: "Kelas Sekolah"

In M08/M10, **"Kelas Sekolah"** is also the group heading/record kind `school_class` (rows `sc-{n}`, no teacher), versus `classroom` (teacher-owned, join code) — `M10 SRS §6.2 kind`, `M08 BR-M08-09` ("Kelas Sekolah" last in the S3 table). Whether the school admin's "Kelas Sekolah" lists **all classes of the school** (both kinds) or only `school_class` rows is **NOT FOUND**. PROPOSED reading (to be confirmed): all classes of the school, both kinds, because the dashboard tile is "KELAS AKTIF" and the Panduan says "Guru boleh cipta kelas".

### 7.4 Server rules for what a school admin may do on these lists (SERVER, `Support/StaffScope.php`)

- **List scope:** `listScopeSchoolId()` applied **before** any filter; a school filter in the query string is dropped; the school dropdown offers only the own school; `onlyRoles` hides staff roles (a school admin never lists platform staff).
- **Edit/reset:** a school admin may edit/reset **pelajar and guru of own school**, **only if the account is active**, never a peer `admin_sekolah` (`canManageAccount`, lines 195-215). Server comment: inactive accounts are out of the school admin's hands (decision "Desa, 22 Sep 2026").
- **Activate:** national admin only (`canActivate`, lines 83-97): a school-admin import lands switched off and a national admin approves (`importsNeedApproval`). **Conflict:** Panduan (LIVE-CAPTURE) says the school admin can "aktif/nyahaktif akaun guru". Server rule is a reconstruction decision; live copy wins on capability; record as OQ-M27D-13.
- **Create/import:** school admin may create **guru** only (`importableRoles`), pelajar through Import Pelajar; school forced to own (`resolveSchoolId`); no role change (`canChangeRole` admin only).
- **Export/IC:** M18 live S9 shows a masked IC with a PDPA-confirm reveal for officers; whether the school admin sees IC: **NOT FOUND**. Rebuild seeds use fictitious IC only.

### 7.5 Data mapping

| Need | Owner (D12) |
|---|---|
| Pupils/teachers of S, status `isActive`, registration date, login | M02 users (list contract `GET /api/admin/users`-style scoped by `schoolId`), M01 `lastLoginAt`/`lastActiveAt` |
| Class list, members, join code, teacher, level | M10 Classroom + Enrolment (DATA-M10-01/02; `kind classroom\|school_class`) |
| Pupil Sesi/Soalan/Accuracy/Terakhir Aktif | M05 sessions/answers; M18 `lastActiveAt` read |
| Teacher subjects/qualification ("Kelayakan") | M02 teacher profile (M18 S9 column) |
| Create/import/reset | M02 users + imports (S4/S5 contracts), M01 password reset |
| Read model owned by M27 | **none required**: three scoped list queries over M02/M10/M05. Only the route/guard layer is M27's. |

### 7.6 Live-probe checklist

L56/L57: columns, filters (class, level, status, search), pagination, sort, row actions (Edit, Reset Kata Laluan, Aktif toggle, "Cipta Pengguna", "Import Pelajar" placement), IC display, empty state, counts in headers, mobile. L58: card grid vs table, columns (level, subject, teacher, members, code), create-class button, detail page route, `school_class` rows, empty state, export.

### 7.7 Open questions

OQ-M27D-13 (activation capability, conflict above). OQ-M27D-14 (L58 content/kinds). OQ-M27D-15 (do L56/L57 duplicate "Urus Pengguna" `/admin-sekolah/pengguna`, which is also 302-existing? M02 S1-style user manager vs these two role-fixed lists?).

---

## 8. Cross-row reuse matrix and proposed M27 shape (PROPOSED, for the SRS writer)

| Row | Reuse | M27 adds |
|---|---|---|
| L54 Amaran Awal | M18 S16/S17/S21/S22/S23/S24 (G1-approved) with `schoolId` forced | route/sidebar binding, 403/404 guards |
| L53 Laporan Aktiviti | M17 S11 `/admin/laporan` with guard AS | alias route (or nav href to `/admin/laporan`), hide Sekolah tab for one school |
| L51 Statistik Penggunaan | M18 S3 template (PPD) over a one-school scope; M05/M11 engagement definitions | page + `Q-M27-USAGE` read model (no store) |
| L52 DSKP Heatmap | M08 SP bands/legend, M03 DSKP, M05 answer log | page + `Q-M27-DSKP`; layout NOT FOUND |
| L55 Laporan Bulanan | M17 S8/S9, M18 S9 monthly | page + `Q-M27-MONTHLY`; layout NOT FOUND |
| L56 Senarai Pelajar, L57 Senarai Guru | M02 users list + actions, M18 S9/M11 S3 table patterns | two scoped list pages |
| L58 Kelas Sekolah | M10 Classroom/Enrolment, M08 S3 "Kelas Sekolah", M18 S9 "Prestasi Per Kelas" | one scoped list page |

D12 check: no new parallel schema is needed for any row. Shared owners: users/schools M01/M02, classes M10, answers/sessions/mastery M05, curriculum/DSKP M03, questions M04, analytics aggregates M11/M12/M17/M18.

Suggested D9 notes (not decisions): do not ship the five 404 hrefs of `user-nav.ts` (`laporan-aktiviti` among them, D-M27-02); a missing/foreign school must be 403/404, not the live 500 picker (D-M27-01); the deck's older sidebar order is superseded by the live screenshot.

---

## 9. Findings for other sessions (not edited here)

- **Session 8 / S0 `/admin-sekolah` (L07):** `ss-admin.png` and `ss-prestasi-sekolah.png` (SERVER-DECK) show the S0 below the banner: four stat cards "JUMLAH PELAJAR", "JUMLAH GURU", "KELAS AKTIF", "LANGGANAN" (value "Belum Ada" when none); then a card "Ringkasan Prestasi" ("GPS, risiko murid, ketepatan latihan & perbandingan tingkatan") with four panels: "GPS SEKOLAH" (value, band "B · Sederhana", "{n} entri headcount"), "AMARAN AWAL" ("Selamat / Berhati / Berisiko", "{n} murid dinilai"), "LATIHAN" ("Purata Ketepatan", "{n} sesi · {n} soalan"), "TINGKATAN" ("Tingkatan 4 / Tingkatan 5" with % bars, "Click untuk detail"); then "Taburan Gred (Anggaran)" with "Lihat penuh →". The linked full page is the school Prestasi dashboard ("Dashboard Sekolah", "Ringkasan prestasi keseluruhan sekolah · {n} kelas · {n} murid", buttons "Tingkatan", "Kelas", seven KPI tiles, "GPS Anggaran" ring "Berdasarkan {n} entri headcount", "* Anggaran dari markah OTR, bukan SPM sebenar", grade distribution A+ … G). Undated and older than the 25 Sep screenshot; the sidebar differs. This resolves part of L07's "four unreadable cards" (OQ-M27-01) as **SERVER-DECK, unverified**; the M27 SRS S0 must still follow LIVE-SCREENSHOT where they disagree. This is the M18 S27 `/sekolah/{id}/prestasi` template.
- **Nav (`src/shells/nav/user-nav.ts`):** `sa-laporan-aktiviti` href 404 on live; probable real href `/admin/laporan` (§4.1).
- **M18:** its G1 SRS lists S16–S24 as school-admin readable; the L54 binding is route-only (§5).
- **M09:** Panduan Admin Sekolah tab is the only live copy that describes L51, L56, L57 in words; keep it in sync.

---

## 10. Coverage summary (per screen)

Share of what a builder needs (layout + copy + formulas + states), honest estimate.

| Row | Screen | LIVE (direct) | LIVE-CAPTURE of same template (adjacent role/scope) | SERVER (formulas/rules) | NOT FOUND |
|---|---|---|---|---|---|
| L51 | Statistik Penggunaan | label, position, Panduan sentence, route exists | PPD S3 header/pills/empty copy | SchoolAggregates formulas, mode split | filled layout, school header, windows, export (~45 %) |
| L52 | DSKP Heatmap | label, position, route exists | M08 SP map legend/bands, M18 heat map | student heatmap grouping/bands (`dskpMap`) | **all page content (~85 %)** |
| L53 | Laporan Aktiviti | label, position, 404 of inferred href | M17 S11 full inventory | scoped LaporanController rules | real href, school variant of tabs (~25 %) |
| L54 | Amaran Awal | label, position | **M18 S22 template + CSV + children (full)** | (teacher logic, not used) | nav target href (~10 %) |
| L55 | Laporan Bulanan | label, position, route exists | only analogues (M17/M18 monthly) | — | **all page content (~90 %)** |
| L56 | Senarai Pelajar | label, position, Panduan sentences | M02 S1, M18 S9, M11 S3 tables | UserDirectory, StaffScope write rules | layout, columns, actions (~60 %) |
| L57 | Senarai Guru | label, position, Panduan ("Cipta Pengguna") | M18 S9 / M11 S3 teacher tables | StaffScope (guru create/reset) | layout, columns (~60 %) |
| L58 | Kelas Sekolah | label, position | M18 S9 "Prestasi Per Kelas", M10/M08 class pages | classrooms columns | layout, kinds, actions (~70 %) |

There is **no `ripped/clone` evidence** for any row (directory absent). **L54 is effectively specified** (M18 + deck); **L52 and L55 are almost entirely NOT FOUND**; L51, L53, L56–L58 are analogue-driven.

---

## 11. Consolidated live-probe checklist (when a `school_admin` account exists)

1. Open every route of §1.1 once (GET): record final URL (redirects), status, tab title, header title/sub, breadcrumb.
2. Sidebar hrefs: read the real `href` of all eight items and of "Command Center" (resolves OQ-M27D-03/04).
3. `/admin-sekolah/pilih-sekolah` with the school-admin account: is it ever reached?
4. Foreign school id on `/amaran/sekolah/{id}` and a foreign class id: 403 vs 404.
5. Per-screen checklists of §2.6, 3.5, 4.6, 5.5, 6.5, 7.6.
6. 375 / 768 / 1280 layout for each; text under 12 px; overflow.
7. Exports: only read `href`s unless the lead approves downloads.
8. Capture figures from one school only and store them as seed anchors with fictitious people.

## 12. Open questions (all new, `OQ-M27D-nn`)

| # | Question | Why unresolved |
|---|---|---|
| 01 | Does a `school_admin` ever see `/admin-sekolah/pilih-sekolah`? What does it show? | 500 for admin; no server picker |
| 02 | Real URLs of the school-admin pages vs the INFERRED hrefs (all except Dashboard) | only status codes known |
| 03 | Laporan Aktiviti real href (probably `/admin/laporan` scoped) | inferred href 404 |
| 04 | Amaran Awal sidebar target: `/amaran` (class gateway) or `/amaran/sekolah[/{id}]` (school view, deck) | deck vs INFERRED nav |
| 05 | Statistik Penggunaan layout for a school (copy of PPD S3 or trio of counters?) | never observed filled |
| 06 | Statistik Penggunaan: class/level breakdown? export? | NOT FOUND |
| 07 | DSKP Heatmap axes/unit/thresholds | NOT FOUND |
| 08 | DSKP Heatmap levels in scope | NOT FOUND |
| 09 | Laporan Aktiviti: Sekolah tab and e-mail lists for a one-school scope | NOT FOUND |
| 10 | Laporan Aktiviti: same "Skor Purata/Struktur" chip? | NOT FOUND |
| 11 | Foreign `{id}` on Amaran pages: 403 (M18 S17 unknown class) or 404 (M11/M17 alias rule) | live behaviour for school admin unknown |
| 12 | Laporan Bulanan: distinct report or month filter over Ringkasan Eksekutif? | NOT FOUND |
| 13 | School admin activate/deactivate capability (Panduan: yes; server: no) | live copy vs reconstruction decision |
| 14 | Kelas Sekolah content: all classes, only `school_class` rows, create/edit actions? | NOT FOUND |
| 15 | Relation of L56/L57 to "Urus Pengguna" (`/admin-sekolah/pengguna`) | NOT FOUND |

## Appendix — Evidence index

- Live docs: `docs/discovery/M27-school-admin.md`, `R10-release-1-0-screens.md`, `L07-dashboard-admin-sekolah.md`, `M18-ppd-jpn.md` §2.3, 2.9, 2.14–2.20, `M17-admin-dashboard.md` §2.8–2.11, `M11-teacher-analytics.md` §2.3, `M08-student-performance.md` §2.7, `M09-content.md` (Panduan Admin Sekolah), `docs/requirements/srs/M18-ppd-jpn.md` (S16–S24, BR-M18-01/13/14/16/22), `M02` FR-M02-02/03/06, `M10` §6.2.
- Screenshots: `roles-matrix/admin sekolah/WhatsApp Image 2026-09-26 at 12.04.10.jpeg` and `…12.04.11g.jpeg` (LIVE-SCREENSHOT).
- Server replica (`D:\Dev Projects\prestasiplus-reference`): `backend/routes/web.php` (182-185, 533, 830-860, 1701-1702), `backend/app/Support/StaffScope.php`, `backend/app/Support/SchoolAggregates.php`, `backend/app/Support/Directory/UserDirectory.php`, `backend/app/helpers.php`, `backend/app/Http/Controllers/Admin/{LaporanController,LaporanEksekutifController,PpdJpnController,UsersController}.php`, `backend/app/Http/Controllers/{TeacherAnalyticsController,TeacherController,StudentController,BukuNotaController}.php`, `backend/app/View/Components/SchoolPicker.php`, `backend/resources/views/admin/{layout,ppd/statistik,ppd/peta-haba,ppd/_shell}.blade.php`, `backend/resources/views/guru/{amaran,monitoring}.blade.php`, `backend/resources/views/content/panduan.blade.php`, `backend/public/present.html`, `backend/public/images/present/{ss-admin,ss-amaran-awal,ss-prestasi-sekolah,ss-amaran-guru,ss-guru-kelas}.png`.
