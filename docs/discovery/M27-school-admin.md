# M27 — School Admin Portal (`/admin-sekolah/*`) (Discovery)

- **Source:** live read-only walk-through of https://prestasiplus.my on **2026-09-30**, 11:40–11:47 MYT (03:40–03:47Z), the admin account (the only account, user decision D16), browser lane 1 (`playwright`). The sidebar comes from `roles-matrix/admin sekolah/*.jpeg` (two live screenshots, red ticks ignored) and `src/shells/nav/user-nav.ts` (hrefs INFERRED).
- **Result in one paragraph:** the admin can open **2 of the 12 school-admin routes**, and both are exact copies of pages other modules already own. `/admin-sekolah/monitoring` is `/admin/monitoring` (M11 S2) and `/admin-sekolah/kirkpatrick` is `/admin/kirkpatrick` (M12 S1). Their `<main>` text is identical (0 differing characters). **Every real M27 page is unrevealed**: 8 routes answer **302 → `/admin-sekolah/pilih-sekolah`**, which is **500** for the admin; `command-center` is **403**; five inferred hrefs are **404**. The content of the school-admin Dashboard, lists, DSKP Heatmap, Laporan Bulanan and Statistik Penggunaan cannot be captured with this account.
- **Screenshots:** `docs/discovery/img/M27/` (13 files, §10). The shell of the admin-panel pages is `SHA` (00-global-ui, M17), not repeated.
- **Element inventory:** **21 content elements** over 3 error-page screens and **9 captured states** (`EL-M27-S#-nnn`) in `docs/discovery/inventory/M27/S1…S3-*.json`. Counts, crawl and limits: `inventory/M27/_summary.md`. Seed snapshot: `inventory/M27/_snapshot-2026-09-30.json`. The two aliases are not re-inventoried (their inventories are M11 `S2-monitoring.json` and M12 `S1-overview.json`).
- **Language:** exact BM copy is quoted. The error pages are BM.
- **Personal data:** none of the pages reached shows a person. Alias pages show school names and codes (public anchors; only the M11/M18 anchor ids 8880 and 8765 are quoted here). The admin credentials were used only to log in and are in no file. `piiLeakCheck` = 0 leaks in all 9 states; the scripted scan is in §11.
- **R10 (screens "Heatmap Topik Lemah", DSKP Heatmap, Laporan Bulanan):** already captured on 2026-09-27 in [R10-release-1-0-screens.md](R10-release-1-0-screens.md) (S1 fully; S2/S3 only the 500 page). It was **verified as complete and not redone**. Today's probes reproduce its S2/S3 result unchanged (§1.2). The owner of "Heatmap Topik Lemah" is **M25** (R10 §1.2).

---

## 1. Overview and route status

### 1.1 The school-admin sidebar (from the two screenshots; order and labels OBSERVED)

Icons, colours and hrefs are not visible on the screenshots. Section headings are in capitals. The screenshot crop hides part of the AKADEMIK block (between "Soalan Berstruktur" and "Kombo Harian").

| Section | Items (in order) |
|---|---|
| top | "Command Center" (badge "LIVE", indigo button) |
| PUSAT AI ("NEW") · CIKGU ALESA AI | "Cikgu Alesa Chat" (badge "AI") |
| ✨ VISI & PERTANDINGAN | "Sekolah Bersaing" (badge "NEW"), "Tetapan Peribadi" |
| 🤖 AI PINTAR (PELAJAR) | "Wellbeing Alerts", "Kamus AI", "Pendamping Motivasi", "Doa & Motivasi" |
| 🎯 AI PINTAR (GURU) | "Aktiviti Advisor", "Whiteboard → Quiz", "RPH (Cikgu Alesa)", "Semak Karangan (Cikgu Alesa)", "PBD (Cikgu Alesa)" |
| 🛡️ KAWALAN KUALITI | "Semakan Nota Master", "Audit Log" |
| HARIAN | "Dashboard" (active), "Senarai Pelajar", "Senarai Guru", "Kelas Sekolah" |
| PENGURUSAN | "Urus Pengguna", "Import Pelajar", "Aktiviti Guru", "Langganan", "Invois" |
| PENILAIAN | "Headcount", "Prestasi", "Amaran Awal", "Laporan Bulanan" |
| ANALITIK | "Monitoring", "Kirkpatrick", "Analitik Adaptif", "Statistik Penggunaan", "DSKP Heatmap", "Analisa Item", "Laporan Aktiviti" |
| AKADEMIK | "Soalan Berstruktur", "Kombo Harian" |
| LAIN-LAIN | "Perutusan", "Video", "Profil Saya", "Panduan" |
| BANTUAN | "Tiket Bantuan", "Gambar Rajah" |
| footer card | school short name + code, logout icon |

The dashboard behind `prestasiplus.my/admin-sekolah` (screenshot 1, the only visible school-admin page) shows: a dark "Perutusan Terkini" card with "Lihat semua →" and one post; the breadcrumb "← Papan Pemuka | Dashboard Sekolah"; a red school banner with the school name, "Admin Sekolah", "📍 {negeri}", "{PPD}" and "# Kod: {code}"; then four pastel stat cards (values not readable). The top strip also shows the bell, an avatar "SI" and a logout icon. This is screenshot evidence only; live could not be opened (§1.2).

### 1.2 Route status with the admin account (GET, `maxRedirects: 0`, one request per route, 450 ms apart)

The 18 probes are all the routes in scope: 12 school-admin hrefs from `user-nav.ts`, `/admin-sekolah` itself, `/admin-sekolah/pilih-sekolah` (the redirect target) and one nonexistent control. No screen got more than 2 probes (the second only in the identity check).

| # | Sidebar item | Route probed (source) | Status | Owner | Content |
|---|---|---|---|---|---|
| 1 | Dashboard | `/admin-sekolah` (screenshot URL) | **302 → `/admin-sekolah/pilih-sekolah`** | **M27** | unrevealed (screenshot only) |
| 2 | (school picker) | `/admin-sekolah/pilih-sekolah` (302 target) | **500** "Ralat Pelayan" | **M27** | unrevealed (crashes for the admin) |
| 3 | Command Center | `/admin-sekolah/command-center` (user-nav INFERRED) | **403** "Akses Ditolak" | **M27** | unrevealed; the route exists (control is 404) |
| 4 | Monitoring | `/admin-sekolah/monitoring` (INFERRED) | **200** | **M11 S2** (alias) | identical to `/admin/monitoring` (§2.1) |
| 5 | Kirkpatrick | `/admin-sekolah/kirkpatrick` (INFERRED) | **200** | **M12 S1** (alias) | identical to `/admin/kirkpatrick` (§2.2) |
| 6 | Statistik Penggunaan | `/admin-sekolah/statistik-penggunaan` (INFERRED) | **302 → pilih-sekolah** | **M27** | unrevealed (M18 has `/ppd/statistik-penggunaan`, a different page) |
| 7 | Senarai Pelajar | `/admin-sekolah/pelajar` (INFERRED) | **302 → pilih-sekolah** | **M27** | unrevealed |
| 8 | Senarai Guru | `/admin-sekolah/guru` (INFERRED) | **302 → pilih-sekolah** | **M27** | unrevealed |
| 9 | Kelas Sekolah | `/admin-sekolah/kelas` (INFERRED) | **302 → pilih-sekolah** | **M27** | unrevealed |
| 10 | DSKP Heatmap | `/admin-sekolah/dskp-heatmap` (INFERRED; also R10 S2) | **302 → pilih-sekolah** | **M27** | unrevealed |
| 11 | Laporan Bulanan | `/admin-sekolah/laporan-bulanan` (INFERRED; also R10 S3) | **302 → pilih-sekolah** | **M27** | unrevealed |
| 12 | Urus Pengguna | `/admin-sekolah/pengguna` (INFERRED) | **302 → pilih-sekolah** | **M27** | unrevealed |
| 13 | Laporan Aktiviti | `/admin-sekolah/laporan-aktiviti` (INFERRED) | **404** | **M27** | the inferred href is wrong or the page is not a route; real href unknown |
| 14 | Import Pelajar | `/admin-sekolah/import-pelajar` (INFERRED) | **404** | **M27** | same (the admin equivalent `/admin/import-students` is M02) |
| 15 | Aktiviti Guru | `/admin-sekolah/aktiviti-guru` (INFERRED) | **404** | **M27** | same |
| 16 | Langganan | `/admin-sekolah/langganan` (INFERRED) | **404** | **M27** | same (`/admin/school-subscriptions` is M19, admin only) |
| 17 | Invois | `/admin-sekolah/invois` (INFERRED) | **404** | **M27** | same (`/billing/invoices` is M19 S7; `/guru/invois` is 404 per M19) |
| — | control | `/admin-sekolah/m27-control-nonexistent` | **404** | — | proves a 302/403 is route-specific: routes 1, 3, 6–12 **exist** (Laravel matches the route before its middleware) |

Reading of the table:
- A **302 to `/admin-sekolah/pilih-sekolah`** is a school-scope middleware: it wants a chosen school. INFERRED: a real `school_admin` has one school and passes; the platform admin has none and is sent to a picker that crashes (500). What the picker or the pages look like for a working role was never observed (OD-M27-01).
- **Command Center is 403** for the admin, unlike the other two centers (M10 `/guru/command-center`, M17 `/admin/command-center`): it is gated to the school-admin role.
- The **five 404 routes** are the INFERRED hrefs of `user-nav.ts` that do not exist on live. The real hrefs of "Laporan Aktiviti", "Import Pelajar", "Aktiviti Guru", "Langganan" and "Invois" are not visible in any markup the admin can reach (its menu has no school-admin block, §1.3). No further URLs were guessed.
- R10's finding is unchanged three days later: S2 and S3 give 302 → pilih-sekolah → 500.

### 1.3 How the routes were looked for (no brute force, GET only)

- **Admin menus:** `/admin` (154 links) and `/dashboard` (277 links, 174 unique) have **no** `/admin-sekolah` link and no school-admin block. Related links only: `/ppd/statistik-penggunaan`, `/jpn/statistik-penggunaan`, `/sekolah-bersaing`, `/guru/monitoring`, `/guru/kirkpatrick*`, `/guru/laporan`, `/laporan-mingguan`, `/admin/schools`, `/admin/school-subscriptions`.
- **Alias pages:** `/admin-sekolah/monitoring` and `/admin-sekolah/kirkpatrick` contain **no** "admin-sekolah" string in their HTML (0 occurrences). Their form actions, export links and drill-down links all point to `/admin/…`. So the alias pages reveal no `/admin-sekolah/*` sub-route.
- **Earlier discovery files:** the only `/admin-sekolah` routes in the repo's crawls are R10's (`dskp-heatmap`, `laporan-bulanan`, `pilih-sekolah`, control).
- `robots.txt` (R10) disallows `/admin-sekolah`.

## 2. Screens

### 2.1 `/admin-sekolah/monitoring` — "Monitoring Penglibatan Sekolah - Admin" (owner **M11 S2**; alias)

- Identity proof: `<main>` text of `/admin-sekolah/monitoring` and `/admin/monitoring` fetched in the same minute: 16,437 characters each, **0 differing characters**. The HTML contains the **admin-panel shell** (SHA: "Panel Pentadbir", "Command Center LIVE" … "Ke Dashboard"), not the school-admin sidebar; the header is "Monitoring Penglibatan" / "Pantau penglibatan sekolah & pelajar T4/T5 dalam platform" (the same as M17's note on `/admin/monitoring`).
- Content = M11 S2 (see [M11-teacher-analytics.md](M11-teacher-analytics.md) §2): filter form (GET, action `/admin/monitoring`) with "Tempoh" (4 options), "Negeri" (11 options), "Tahap" (6 options), button "Tapis"; "PDF" and "CSV" links (`/admin/monitoring/export/pdf?`, `/export/csv?`, not opened), "Refresh", "Auto-refresh dalam 4:59"; 9 KPI cards; the tables "Analisis Penglibatan Pelajar T4/T5" (badge "34 sekolah"; columns #, Sekolah, Daftar, Aktif, %, Tahap, Bar) and "Analisis Penglibatan Guru" ("13 sekolah"; #, Sekolah, Daftar, Login, %, Tahap, Bar); legend "Cemerlang (> 60%)", "Sederhana (20-60%)", "Rendah (5-20%)", "Kritikal (< 5%)", "Tiada Langsung (0%)"; "Tracking Mingguan" (M1…M33, Trend, Best); "Sekolah Terbaik", "Perhatian Segera", "Cadangan Tindakan"; the guide card "Panduan Monitoring Penglibatan". 35 drill-down links `/admin/monitoring/sekolah/{id}` (M11 S3).
- What a real school admin sees (scoped to one school? a different view?) is **unrevealed** (OD-M27-02). The rebuild must not assume either.
- Layout (measured): no page overflow at 375 (scrollWidth 360 = viewport − scrollbar), 768 or 1280; the three tables scroll inside their wrappers at 375 (603, 565 and 1976 px wide).

### 2.2 `/admin-sekolah/kirkpatrick` — "Kirkpatrick Evaluation Dashboard" (owner **M12 S1**; alias)

- Identity proof: 3,969 characters each, **0 differing characters** against `/admin/kirkpatrick`. Header "Kirkpatrick Evaluation" / "Analisis Keberkesanan Platform — Model Penilaian 4 Tahap". Filter form GET `/admin/kirkpatrick` with "Sekolah" (`school_id`, 59 options, first "Semua Sekolah") and "Negeri" (`state`, 11), button "Tapis". Level links `/admin/kirkpatrick/reaction|learning|behavior|results` and `/admin/monitoring`. The seven-view tree of M12 (reaction, learning, behavior, results, chain, interventions, pelajar) is reached through `/admin/…`; whether `/admin-sekolah/kirkpatrick/reaction` etc. exist was **not probed** (no evidence of them in any markup).
- Layout: **horizontal page overflow at 375** (scrollWidth 487): the `school_id` select is 466 px wide. This is the already recorded **D-M12-7**; 768 and 1280 are fine.

### 2.3 `/admin-sekolah/pilih-sekolah` — "500 - Ralat Pelayan | PRESTASIPLUS" (S1; owner **M27**)

Standalone global error page, no shell, the same at 375 / 768 / 1280 (7 elements, no overflow, no text under 12px). Elements: "500"; "⚙️"; h1 "Ralat Pelayan"; "Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar lagi."; links "Halaman Utama" → `/` and "Cuba Semula" → `javascript:location.reload()`; footer "PRESTASIPLUS". It is the landing page of eight routes (§1.2 rows 1, 6–12). Screenshots: `admin-sekolah-pilih-sekolah-500-{desktop,tablet,mobile}.png`.

### 2.4 `/admin-sekolah/command-center` — "403 - Akses Ditolak | PRESTASIPLUS" (S2; owner **M27**)

Standalone global error page (7 elements, same at all widths): "403"; "🚫"; h1 "Akses Ditolak"; "Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir."; links "Halaman Utama" → `/` and "Log Masuk" → `/login`; footer "PRESTASIPLUS". The Command Center content (badge "LIVE", opens in a new tab per `user-nav.ts` `target=_blank`) is unrevealed. Screenshots `admin-sekolah-command-center-403-*.png`.

### 2.5 `/admin-sekolah/laporan-aktiviti` — "404 - Halaman Tidak Dijumpai | PRESTASIPLUS" (S3; the shared 404 of the five wrong hrefs)

Standalone global 404 page (7 elements): "404"; "🔍"; h1 "Halaman Tidak Dijumpai"; "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?"; links "Halaman Utama" → `/` and "Mula Latihan" → `/latih-tubi`; footer "PRESTASIPLUS". Inventoried once for the five 404 routes of §1.2 (rows 13–17). Screenshots `admin-sekolah-laporan-aktiviti-404-*.png`.

## 3. Flows

- **School admin → any M27 page (INFERRED from behaviour):** sidebar item → `/admin-sekolah/…` → school-scope middleware → page. With no school → 302 → `/admin-sekolah/pilih-sekolah` (500 for the platform admin: dead end, D-M27-01).
- **Admin (platform) → alias pages:** typing `/admin-sekolah/monitoring` or `/kirkpatrick` opens the same page as `/admin/…` with the admin shell. All links inside stay under `/admin/…`.
- **Login landing for the admin:** `POST /login` → `/admin` (as in every discovery). The M01 rule that `school_admin` lands on `/dashboard` is INFERRED; the screenshot shows `prestasiplus.my/admin-sekolah` is the school-admin home.

## 4. Data entities implied

| Entity | Used by | Owner |
|---|---|---|
| School (id, code, state, PPD) | picker, dashboard banner ("Kod: {code}", "📍 {negeri}", "{PPD}") | M02 |
| School membership of `school_admin` | scope middleware | M01 / M02 |
| Students, teachers, classes of the school | Senarai Pelajar / Guru / Kelas Sekolah | M02 / M10 |
| Monitoring aggregates | alias Monitoring | M11 |
| Kirkpatrick aggregates | alias Kirkpatrick | M12 |
| DSKP, monthly report, usage statistics, activity report | DSKP Heatmap, Laporan Bulanan, Statistik Penggunaan, Laporan Aktiviti | not observable |

## 5. Figures: sources, definitions, conflicts

### 5.1 Alias figures today (2026-09-30) against the earlier discoveries

| Figure | Today | M11 (2026-09-25) / M12 | Note |
|---|---|---|---|
| Jumlah Sekolah | 58 | 57 | +1 school |
| Pelajar T4/T5 | 4,162 | 4,158 | +4 |
| Pernah Aktif | 1,467 | 1,462 | +5 |
| % Penglibatan | 35.2% | 35.2% | 1,467 ÷ 4,162 = 35.25 → "35.2%" (rounding as in M11 BR-M11-11) |
| Soalan Dijawab | 474,106 | 472,371 | +1,735 (live activity) |
| Purata/Pelajar | 323.2 | 323.1 | 474,106 ÷ 1,467 = 323.18 |
| Guru Berdaftar / Pernah Login / % | 522 / 277 / 53.1% | same | 277 ÷ 522 = 53.07 |
| Pelajar table / Guru table rows | 34 / 13 | 33 / 13 | the new school (a "Tiada Langsung" row) |
| Tahap counts (pelajar table) | 8 Cemerlang, 7 Sederhana, 1 Rendah, 2 Kritikal, 16 Tiada Langsung | 8 / 7 / 1 / 2 / 15 | +1 Tiada Langsung |
| Kirkpatrick T3 "Pelajar aktif" | 953 / 4162 | 951 / 4158 | 4162 agrees with M11 S2 today |
| Kirkpatrick T3 sessions | 21060 | 20991 | live growth |
| Kirkpatrick T2 answered | 307,162 | 306,133 | differs from Monitoring's 474,106 on the same day (different source or window; Perlu pengesahan, the definition belongs to M11/M12) |
| Kirkpatrick T1 | 4.6/5, 336 respon | same | no change |
| Kirkpatrick T4 | GPS 4.30, 4393 rekod | 4.30, 4378 | +15 headcount records |
| Sebelum / Selepas | "Januari 2026 vs September 2026": 2 → 66 aktif, 33.3% → 86.3%, 3 → 14,992 jawapan, 0 → 33 champion | (date-driven) | the periods move with the calendar |

**Conflicts with existing SRS figures:** none in definition. The differences are live drift and are not seed anchors; the SRS anchors of M11/M12 (dated 2026-09-25) stay. M17 and M18 school figures (anchors 8880 / 8765) are not shown on M27 pages that the admin can reach, so no M17/M18 figure could be compared. The Monitoring answers (474,106) and the Kirkpatrick answers (307,162) differ on the same day (Perlu pengesahan; cross-check the M11/M12 definitions).

### 5.2 Figures of the unrevealed pages

None. Every figure on the dashboard screenshot is unreadable. Definitions of "Statistik Penggunaan", DSKP Heatmap, Laporan Bulanan and Laporan Aktiviti figures are **not observable**; the writers must mark them PROPOSED.

## 6. Scripts and endpoints

- Alias pages: same scripts as M11/M12; the only own fetch is the shell's `GET /admin/server-status` (poll, 23 cached hits). The tournament partial `GET /api/tournament/active`, `/notifikasi/unread-count` and `/api/offline/snapshot` are shell fetches.
- Endpoints touched by M27: only the GETs of §1.2. No `/admin-sekolah` JSON/API endpoint was seen.
- Error pages: "Cuba Semula" is `javascript:location.reload()`.

## 7. Responsive behaviour (375 / 768 / 1280; `tools/jobs/M27-measure.js`)

| Screen | 375 | 768 | 1280 |
|---|---|---|---|
| 500 / 403 / 404 pages | centred, no overflow (scrollWidth 375), no text < 12px | same (768) | same (1280) |
| Kirkpatrick alias | **overflow: scrollWidth 487** (select 466 px), 41 text nodes < 12px | 753 (viewport − 15 px scrollbar), 37 < 12px | 1265, 37 < 12px |
| Monitoring alias | 360 (no overflow), tables scroll in wrappers, 274 text nodes < 12px | 753, 212 < 12px | 1265, 212 < 12px |

The school-admin shell (sidebar in §1.1) was never rendered, so its 375/768/1280 behaviour is unrevealed.

## 8. Live defects (D9 class)

| ID | Defect | Class | Suggested rebuild |
|---|---|---|---|
| D-M27-01 | `/admin-sekolah/pilih-sekolah` returns **500** for the platform admin, so 8 school-admin routes end in a "Ralat Pelayan" page | broken page | rebuild: an admin without a chosen school gets a working school picker or a clear 403/redirect, not a 500. The picker's content was never observed and must not be invented (PROPOSED). Perlu pengesahan |
| D-M27-02 | Five sidebar items have no reachable route under the inferred hrefs (404); their real hrefs are unknown | dead links (INFERRED hrefs) | the rebuild's `user-nav.ts` must not ship the five 404 hrefs; the M27 writers choose the routes (PROPOSED) |
| D-M27-03 | Text under 12px on the alias pages (Monitoring 274 / 212 / 212 nodes, Kirkpatrick 41 / 37 / 37 at 375 / 768 / 1280) | unreadable text | follow M11/M12 decisions (12px minimum) |
| D-M27-04 | Kirkpatrick alias page overflows horizontally at 375 | layout | as D-M12-7 |

## 9. Unrevealed (open questions)

| # | Question | Why not observable |
|---|---|---|
| OQ-M27-01 | The whole content of: Dashboard (`/admin-sekolah`), Senarai Pelajar, Senarai Guru, Kelas Sekolah, Urus Pengguna, Statistik Penggunaan, DSKP Heatmap, Laporan Bulanan (all filters, columns, charts, exports, empty states, messages); and of the school picker | 302 → picker → 500 for the admin; a `school_admin` account is needed |
| OQ-M27-02 | Command Center content and its data source (LIVE badge, new tab) | 403 for the admin |
| OQ-M27-03 | Real hrefs and content of Laporan Aktiviti, Import Pelajar, Aktiviti Guru, Langganan, Invois | inferred hrefs are 404; no markup shows the real ones |
| OQ-M27-04 | Whether Monitoring/Kirkpatrick are school-scoped for a real school admin, and whether `/admin-sekolah/kirkpatrick/{reaction…}` sub-routes exist | the admin sees the platform view |
| OQ-M27-05 | Whether a `school_admin` can pass the middleware without a picker, and what the picker offers (list, search, query string) | 500 for the admin |
| OQ-M27-06 | The AKADEMIK block between "Soalan Berstruktur" and "Kombo Harian", and the collapsed state of "Kirkpatrick" in the sidebar | screenshot crop |
| OQ-M27-07 | Read/write actions of the pages (import, create user, edit class) | unreachable, and writes are forbidden |

Sidebar items that other modules own were not re-discovered here: Headcount, Prestasi, Amaran Awal (M08/M18), Analitik Adaptif, Analisa Item (M08), Soalan Berstruktur (M05/M06), Kombo (M14), Sekolah Bersaing (M16), Video (M09), Profil Saya, Tetapan (M01), Panduan (M09), Perutusan (`/perutusan`, owner Perlu pengesahan), Tiket Bantuan (`/pusat-tuisyen/tiket`, M22), Gambar Rajah (`/admin/soalan-gambar`, M04), Pusat AI items (M25).

## 10. Screenshot index (`docs/discovery/img/M27/`, 13 files, all `.png`, masked in the DOM before capture)

- 500: `admin-sekolah-pilih-sekolah-500-desktop`, `-tablet`, `-mobile`.
- 403: `admin-sekolah-command-center-403-desktop`, `-tablet`, `-mobile`.
- 404: `admin-sekolah-laporan-aktiviti-404-desktop`, `-tablet`, `-mobile`.
- Kirkpatrick alias: `admin-sekolah-kirkpatrick-alias-desktop`, `-mobile`.
- Monitoring alias: `admin-sekolah-monitoring-alias-desktop`, `-mobile`.

## 11. Safety and privacy record

- **Guard** (`tools/jobs/M27-guard.js`, a copy of R10's) installed before the first navigation and re-run on `/login` for probes. All 11 probes blocked: POST, DELETE, toggle-GET, mark-read-GET, export-csv-GET, logout-GET, `/api/ai/…`, `/pusat-ai/…/generate`, `/cikgu-alesa/chat`, `api.openai.com`, `example.com`. The guard aborts every non-GET except `POST /login`, external hosts, downloads/exports/print, write-shaped GETs and every AI path. During the run it also blocked Cloudflare beacon scripts (56 blocked requests in total, 12 of them probes).
- **Nothing** was submitted, generated, exported, downloaded or approved; no AI call, no practice/quiz session, no validation probe. The PDF/CSV export links of the Monitoring alias were read from `href` only.
- **Load once:** every browser page reached the server once and was then served from the guard cache. The route probes used `context.request.get` with `maxRedirects: 0`, so a 302 was never followed and `/admin-sekolah/pilih-sekolah` was not hit once per probe (the mistake R10 made 16 times). Extra server GETs: the four identity-check pages fetched a second time, and `pilih-sekolah`, `command-center`, `laporan-aktiviti` fetched twice each (probe + one browser load). The 500 page says the technical team is notified, so about 2 error-log entries may have been created. No live counter or value changed. `POST /login` updated the admin's last-login time, as in every discovery.
- **Load:** one browser, 450 ms or more between requests.
- **PII:** no personal data on any page reached (error pages; school names on the aliases are public). `piiLeakCheck` 0 in 9/9 states, `m27mask` masked 0 nodes. The scripted scan for e-mail, phone, IC and BIN/BINTI patterns over all M27 files is in `inventory/M27/_summary.md` (0 hits). The credentials appear in no file. Scratch: `scratchpad/m27/mkraw.js` (no data) only; no unmasked dump was written.
- Browser closed at the end.

## Appendix A — Enumerations

| Enum | Values |
|---|---|
| Monitoring "Tahap" (alias) | Cemerlang (> 60%), Sederhana (20-60%), Rendah (5-20%), Kritikal (< 5%), Tiada Langsung (0%) |
| Monitoring "Tempoh" (alias) | Semua Masa, 7 Hari, 30 Hari, 3 Bulan |
| Status of a school-admin route for the admin | 200 alias, 302 picker, 403, 404, 500 (§1.2) |

## Appendix B — Exact DOM strings (inventory reconciliation)

- 500: "500", "⚙️", "Ralat Pelayan", "Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar lagi.", "Halaman Utama", "Cuba Semula", "PRESTASIPLUS".
- 403: "403", "🚫", "Akses Ditolak", "Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir.", "Halaman Utama", "Log Masuk", "PRESTASIPLUS".
- 404: "404", "🔍", "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama", "Mula Latihan", "PRESTASIPLUS".
- Aliases: see M11 S2 and M12 S1 (identical text).
