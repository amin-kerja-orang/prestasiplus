# v2 visual smoke sweep

Slug: v2-frontend. Date: 2026-10-17. Target: production preview http://localhost:5191, Playwright lane 2.
Scope: quick smoke, not a full G5. Automated per-screen probe (title, blank page, console errors, `scrollWidth > clientWidth`, broken images, contrast heuristic) plus screenshots of suspect screens.

## Coverage actually executed

| Role | Screens probed | 1280x800 | 375x812 |
|---|---|---|---|
| Murid | 48 routes (all sidebar items plus Bijak SPM sub-routes) | dark, all 48 | light, 18 routes (plus all after theme toggle: 42 light) |
| Guru | 25 routes (all sidebar items incl. 7 Kirkpatrick) | dark, all 25 | light, 9 routes |
| Admin Sekolah | 22 routes (all sidebar items) | light only (see S-01, dark is not available) | light, 10 routes |
| Admin | 32 routes (all 21 built items, Kirkpatrick, 2 `/admin/p/*` placeholders, Profil/Tetapan/Tiket) | dark, all | dark (theme not switched), 13 routes |

Not done: the 52 `/admin/p/pm-*` placeholder pages were not opened one by one (2 sampled, both fine). Interactive states (modals, forms, hover) were not exercised. No console errors were raised on any probed route (console listener was attached for Guru, Admin Sekolah and Admin; for Murid the listener ran in the first pass only and also reported none). The contrast heuristic gives false positives on gradient or white-on-colour buttons, so low-contrast hits were only reported when confirmed visually.

## Findings

Severity: Blocker = unusable, Major = clearly wrong and user-visible, Minor = cosmetic or caveat.

| ID | Role | Screen | Path | Size / mode | Issue | Severity | Screenshot |
|---|---|---|---|---|---|---|---|
| S-01 | Admin Sekolah | All screens except Command Center (Dashboard, Prestasi, Analitik Adaptif, Analisa Item, Video, Pelajar, Guru, Kelas, Profil, Tetapan, Tiket, ...) | `/admin-sekolah`, `/prestasi`, `/analitik/pelajar`, `/analisa-item`, `/video`, etc. | 1280 dark and 375 light | Docs list Prestasi, Analitik Adaptif, Analisa Item and Video as "new theme", but all render inside the old light Admin Sekolah shell (old sidebar with "Pusat AI", "Visi & Pertandingan", white/blue gradient). There is no theme toggle, so dark mode does not exist for these screens. Only Command Center uses the new shell and supports dark (and its theme choice is lost on leaving it). | Major | `.playwright-mcp/qa-sweep/adminsekolah-dashboard-1280.png`, `adminsekolah-prestasi-dark.png`, `as-video-1280.png`, `as-pelajar-1280.png` |
| S-02 | Admin Sekolah | Prestasi, Dashboard Sekolah | `/prestasi/sekolah` | 1280 | Grade distribution chart bars render solid black (chart colour token missing in this theme). | Major | `.playwright-mcp/qa-sweep/adminsekolah-prestasi-dark.png` |
| S-03 | Murid | Menu item "Headcount" | `/headcount` | 1280 dark | Link is in the Murid sidebar and the role matrix marks it allowed for Murid, but it opens "403 Akses Ditolak". Dead or contradictory menu entry. | Major | `.playwright-mcp/qa-sweep/murid-headcount-403.png` |
| S-04 | Murid | Menu item "Analisa Item" | `/analisa-item` | 1280 dark | Redirects to the Murid dashboard instead of an Analisa Item screen (matrix says allowed for Murid). | Major | none (redirect, no distinct screen) |
| S-05 | Murid | Menu item "Prestasi" | `/prestasi` -> `/prestasi/sekolah` | 1280 dark | Murid lands on "Dashboard Sekolah" (school aggregate: 2 kelas, grade distribution) rather than a personal Prestasi view. Likely a route/role scoping mismatch. | Major | none |
| S-06 | Murid | Practice sub-nav links "Kemajuan" and "Sejarah Latihan" | `/practice/progress`, `/practice/history` | 1280 dark | Both links on the Practice screen lead to the 404 page. (`/leaderboard` and `/practice/revision` work.) | Major | none (404 page) |
| S-07 | Murid | Peta Belajar | `/peta-belajar` | 375 light | Horizontal page scroll (about 65px): the Darjah chip row spills outside its container, a chip is cut at the right edge. | Major | `.playwright-mcp/qa-sweep/murid-peta-belajar-375-light.png` |
| S-08 | Murid | Soalan Berstruktur | `/latihan-berstruktur` | 375 light | Horizontal page scroll (about 106px): pagination nav is 572px wide and not wrapped or scrollable. | Major | `.playwright-mcp/qa-sweep/murid-berstruktur-375-light.png` |
| S-09 | Murid | Marketplace, Kedudukan | `/marketplace`, `/ranking` | 375 | Pagination and tab buttons extend past the viewport edge (flagged, page-level scroll was 0 in dark/modal pass, not re-verified in light). | Minor | none |
| S-10 | Admin | Profil Saya and Tiket Bantuan | `/profile`, `/pusat-tuisyen/tiket` | 1280 dark | Opens inside the Murid learner shell, white and light-only while the portal is dark. Sidebar shows learner items (Target SPM, Misi Harian, Remedial, Kombo), koin/mata/streak chips and a "99+" notification badge for an Admin account. Portal Pentadbiran frame is lost. (Tetapan stays in portal and dark.) | Major | `.playwright-mcp/qa-sweep/admin-profile-dark.png` |
| S-11 | Murid | Panduan | `/panduan` | 1280 dark | Public marketing-style page: white, ignores dark mode and has no app shell, so it jumps out of the dark session. May be intended as public page, confirm. For Admin Sekolah the same content is at `/pusat-tuisyen/panduan` inside the shell. | Minor | `.playwright-mcp/qa-sweep/murid-panduan-dark.png` |
| S-12 | Guru | Monitoring, Kirkpatrick (7 pages), Headcount in old look | `/guru/monitoring`, `/guru/kirkpatrick/*` | 1280 dark | Rendered in the old Portal Guru shell (different logo, sidebar and header), white background, no dark mode, while the rest of the Guru portal is dark. Matches "Masih rupa lama" in `docs/AKAUN-DEMO.md`, so expected, but the shell switch is jarring and the sidebar menu differs. | Minor | `.playwright-mcp/qa-sweep/guru-monitoring-dark.png`, `guru-kirkpatrick-dark.png` |
| S-13 | Guru | Menu item "Laporan Mingguan" | `/laporan-mingguan` | 1280 | Link appears in the Guru sidebar but opens "403 Akses Ditolak". | Major | none |
| S-14 | Admin | Pengurusan Soalan and other legacy admin screens | `/admin/questions`, `/admin/users`, `/admin/schools`, ... | 1280 and 375 dark | Content panels are white cards on the dark portal frame (old-theme screens inside new shell). Readable, no clipping. Matches "Skrin admin lain masih rupa lama". | Minor | `.playwright-mcp/qa-sweep/admin-questions-dark.png`, `admin-users-375.png` |
| S-15 | Admin | Portal sidebar header | all `/admin/*` | 1280 | The "Pentadbiran" badge next to the logo is clipped ("Pentadbira"), and the sidebar shows a horizontal scrollbar at the bottom. | Minor | `.playwright-mcp/qa-sweep/admin-questions-dark.png` |
| S-16 | Murid / Guru | Shell header and bottom nav | all pages | 375 light | In headed Chrome with classic scrollbars the header theme button is clipped at the right edge (5px overflow, `scrollWidth` 380 vs 375) on most Murid screens. Probably an artefact of classic scrollbars, but the header is tight. Guru bottom nav labels truncate ("Dashbo...", "Comma..."). | Minor | `.playwright-mcp/qa-sweep/murid-spm-375-light-5px.png`, `guru-dashboard-375-light.png` |
| S-17 | Murid | First-run "Pilih rakan belajar awak" sheet | any page after login | 1280 / 375 | Companion picker opens over whatever page the Murid lands on first, including the Dashboard, and blocks the content until dismissed with Batal or Pilih. Works, but hides the first screen at review time. | Minor | `.playwright-mcp/qa-sweep/murid-dashboard-375-modal.png` |
| S-18 | Admin Sekolah | Dashboard Sekolah | `/admin-sekolah` | 1280 | Orange GPS figure "5.33" on white has low contrast (about 1.9:1). | Minor | `.playwright-mcp/qa-sweep/adminsekolah-dashboard-1280.png` |

## Passed with no visible issue (sampled)

- Murid dark 1280: Dashboard, Bijak SPM hub and Sejarah, Latih Tubi, Soalan by Chapter, Ulangkaji, Remedial, PKSK, Kelas Saya, Syiling and Token (all sub-pages), Cabutan, Kotak Misteri, Marketplace, Cikgu Alesa, Kedai Hadiah Digital, Artikel, Video, Audio KBAT, Topik, Heatmap, Mohon Keluarga Angkat, Jemput Ibu Bapa, Profil, Tetapan, Tiket: non-blank, correct title, no horizontal scroll, no console errors.
- Guru new shell screens (Command Center, Dashboard, Kelas, Pelajar, Prestasi, Laporan, Analitik, Analisa Item, Sumbang Soalan, Video): fine at 1280 dark and 375 light.
- Admin: all 21 built items, Command Center, Aktiviti Harian: fine in dark at 1280, no horizontal scroll at 375.
- Old-look screens in the new shell (Permainan, Kedudukan, Timeline) are consistent with the dark chrome (page headers visible, dark background).

## Counts

| Severity | Count |
|---|---|
| Blocker | 0 |
| Major | 10 (S-01, S-02, S-03, S-04, S-05, S-06, S-07, S-08, S-10, S-13) |
| Minor | 8 (S-09, S-11, S-12, S-14, S-15, S-16, S-17, S-18) |
| Total | 18 |

## Suggested owners

| IDs | Owner |
|---|---|
| S-01, S-02, S-18 | Admin Sekolah shell and M08 (student performance / Prestasi) |
| S-03, S-04, S-05, S-13 | Routing and role guards (M08 Headcount, Analisa Item, Prestasi; Guru M11 Laporan Mingguan) |
| S-06 | M05 practice sub-navigation |
| S-07, S-08, S-09 | Murid responsive pass (Peta Belajar, Soalan Berstruktur, pagination component) |
| S-10, S-15 | Portal Pentadbiran frame (v2 portals) |
| S-11, S-12, S-14 | Known old-theme screens (expected per AKAUN-DEMO), batch for later restyle |
| S-16, S-17 | Shared shell (header, bottom nav, companion sheet) |
