# L07 — Dashboard, Admin Sekolah part (`/admin-sekolah`) — Discovery (DRAFT, doc-only)

- **Status:** DRAFT for the Delivery Lead. Prepared 2026-10-03, doc-only (no browser, no SSH, no live request). Not yet audited. Nothing here is written as observed-live fact.
- **Roles-matrix row:** L07 "Dashboard / Dashboard Guru (2)", ticks M G AS, owner column "M17 / M05", progress 40% (`docs/ROLES-MATRIX-LINES.md` line 29; order table line 104: "M17 ... buat kemudian"). This file covers the **Admin Sekolah** part only.
- **User decision D24:** where live is unobservable, the server code/data is the source; no role account is requested. Server copy = `D:\Dev Projects\prestasiplus-reference\` (paths below relative to `backend/`).
- **Tags:** **SERVER** = server code/data (authoritative where live is not observable); **SCREENSHOT** = the user-supplied live screenshot `roles-matrix/admin sekolah/WhatsApp Image 2026-09-26 at 12.04.10.jpeg` (second-hand capture, not a browser observation by us; it is the only evidence of the real page and outranks SERVER on layout/copy per the L06 rule "live wins"); **INFERRED** = derived; **PROPOSED** = rebuild decision. REFERENCE is not used: under D24 it reads SERVER.
- **Privacy:** the screenshot shows a real school name, a school code and a post title. The school name and code are **not** copied here (placeholders `{school name}`, `{code}`); the server seeder `database/seeders/SchoolRosterSeeder.php` (a real-looking school-admin name and a default password) is cited by path only. Seeds use the M02 fictitious school.

---

## 0. Plain finding on the server source

**The server source for `/admin-sekolah` and `/admin-sekolah/pilih-sekolah` was NOT found.** There is no such route, controller, view or middleware in the server code:

- `routes/web.php` has no `admin-sekolah` or `pilih-sekolah` string. The only hits for `admin_sekolah` are role lists (lines 182, 481-502, 533, 766, 844, 857, 965, 1093, 1100, 1404). Whole-repo search for `admin-sekolah | pilih-sekolah | Dashboard Sekolah` finds only a nav label in `app/Http/Middleware/HandleInertiaRequests.php:63` ("Papan Pemuka", unrelated) and the slide `public/present.html:993` already cited by L06. (SERVER, negative result)
- The server lands **every** staff role on `/admin` (`app/helpers.php:16-20`, `role_home()`). So the live home `/admin-sekolah` (SCREENSHOT URL bar) is a path the server code does not define. (SERVER; same conclusion as L06 section 1 and M17 SRS OQ-M17-15.)
- No school picker exists in the server: the school of a school admin is always `users.school_id` (`app/Support/StaffScope.php:128-131`). (SERVER)

Consequence: the **layout, copy and figures of the live `/admin-sekolah` page come only from the screenshot** (partly unreadable), and the **data scoping rules** come from the server's closest adjacent screens (section 4). Where the screenshot is silent, this file says "unknown"; nothing is invented. This is the same situation as L06 (reference has no `/admin-sekolah/command-center`, only the shared `/admin/command-center` with a school scope).

## 1. Sources searched

| Source | Result |
|---|---|
| `docs/discovery/L06-command-center-sekolah.md` (template) | Read in full. Rules reused: scope is derived from the session school, a missing school is 403 not "all schools" (FR-M17-104), live wins over server on layout/URL/copy, Admin Sekolah screens are aliases/mounts with school scope. |
| `docs/discovery/M27-school-admin.md` section 1.1 (line 36), 1.2 rows 1-2, section 2.3, OQ-M27-01 / -05, D-M27-01 | The screenshot description (Perutusan Terkini card, breadcrumb, banner, four stat cards); `/admin-sekolah` = 302 to `/admin-sekolah/pilih-sekolah` = 500 for the platform admin; the picker content was never seen. |
| `docs/discovery/R10-release-1-0-screens.md` lines 80, 244 (C5), 274 | Same 302 to 500; open conflict C5: M01 BR-07 lands `school_admin` on `/dashboard` (INFERRED), live has `/admin-sekolah`. |
| `docs/requirements/srs/M17-admin-dashboard.md` FR-M17-112 (line 251), OQ-M17-15 (line 890) | "← Dashboard" on the school-admin Command Center goes to `/admin-sekolah` (INFERRED); the page itself is owned by M27, picker behaviour is OQ-M27-05. |
| `docs/requirements/srs/M11-teacher-analytics.md` FR-M11-88, BR-M11-27/35; M12 SRS Admin Sekolah alias rules | Monitoring / Kirkpatrick are mounted at `/admin-sekolah/…`, school forced from the session, other school ids answer 404 (INFERRED). |
| `docs/requirements/srs/M01-authentication.md` BR-07 (line 218) | `school_admin` lands on `/dashboard` (INFERRED, URS OQ-3). Conflicts with the screenshot home; open (OQ-L07-04). |
| `docs/requirements/srs/M02-users-schools.md` (lines 276, 369, 399) | School has name, code (`≤20`), state, district, type; `school_admin` has `ppdDistrict`; role labels. |
| `docs/TRACKER.md` D16 (line 24), M27 board row (line 222); `docs/architecture/build-plan.md` lines 109-130, 284, 320, 365 | M27 owns `/admin-sekolah/*`; "its own home `/admin-sekolah` is deferred by the user" (line 320); OD-R2 landing pages. |
| `src/shells/nav/user-nav.ts` lines 364-387; `src/shells/nav/admin-nav.ts:597` | Sidebar "Dashboard" to `/admin-sekolah` (OBSERVED label, href from the screenshot URL); `/admin-sekolah` is an exact-match active path. |
| Server `Admin/DashboardController.php` (108 lines), `resources/views/admin/dashboard.blade.php` (449 lines), `Panel/DashboardController.php`, `resources/js/panel/pages/dashboard.tsx`, `Support/StaffScope.php:128-148`, `helpers.php:16-20,163-177`, `tests/Feature/NationalOnlyNoticeTest.php:205-219` | The only dashboards a school admin reaches on the server. Adjacent, not the same screen (section 4). |

## 2. Route, gating, school-selection flow

| Item | Finding | Tag |
|---|---|---|
| URL | `/admin-sekolah` (sidebar item "Dashboard", active state on the screenshot; breadcrumb "Dashboard Sekolah") | SCREENSHOT |
| Server route | none. Server staff home = `GET /admin` `Admin\DashboardController@index` (`routes/web.php:535`), group `['auth','role:admin,admin_sekolah,pegawai_ppd']` (`web.php:533`); panel domain home `GET /` `Panel\DashboardController@index` (`web.php:182-185`), same role list | SERVER (adjacent) |
| Role gate | the page is the school admin's home, so `school_admin` only (INFERRED). Platform admin / teacher / pupil / parent / PPD / JPN: the global 403 "Akses Ditolak" is the proven pattern of the sibling route `/admin-sekolah/command-center` (M27 section 2.4); for `/admin-sekolah` itself the platform admin got 302 to the picker, not 403 (M27 row 1). Guest: `/login` (M01 guard) | INFERRED |
| School-selection middleware | live redirects a user with no chosen school to `/admin-sekolah/pilih-sekolah`; that picker answered 500 for the platform admin (M27 rows 1-2, D-M27-01). Content, query string, search, "one school skips it": **unknown** (OQ-M27-05). The server has no picker and always uses `users.school_id`. | OBSERVED by M27 probes (behaviour); unknown (content) |
| Proposed flow | (1) `school_admin` with exactly one school (`schoolId` set, M02 BR/`school_admin` requires a school at creation, `M02 FR-M02-27`) goes straight to the dashboard, no picker. (2) a user allowed on the route but with **no school** gets 403 "Akses Ditolak" (never national figures; mirrors L06 FR-M17-104 and `StaffScope::openedScopeOrAbort()` `StaffScope.php:142-148`). (3) The platform admin on `/admin-sekolah` gets the same 403 (live 500 is a D9 defect, D-M27-01; a picker is not invented). The route `/admin-sekolah/pilih-sekolah` is **not built** unless the user decides otherwise (OQ-L07-02). | PROPOSED (SERVER rule for the no-school case) |
| Server quirk to avoid | `Admin\DashboardController` does not abort a school admin with no school: `listScopeSchoolId()` returns null for them and the page then counts the whole platform (`DashboardController.php:49-56`, `StaffScope.php:128-131`). The rebuild must NOT copy this. | SERVER (defect) |
| Landing | after login the server sends every staff role to `/admin` (`helpers.php:19`); M01 BR-07 sends `school_admin` to `/dashboard` (INFERRED); the sidebar and screenshot show the home is `/admin-sekolah`. Live wins: landing `/admin-sekolah` requires an M01 change (OQ-L07-04). | SCREENSHOT / INFERRED |

## 3. The live page as far as the screenshot shows it (SCREENSHOT)

Screenshot 1 (tablet-width capture, 25 Sep 2026; parts are covered by a browser password popup, so some copy is unreadable). Top to bottom:

| # | Element | What is visible | Unknown |
|---|---|---|---|
| E1 | Top bar | hamburger (left, drawer), page title (first letter "D", sub-title "S…", covered by the popup), bell, round avatar with initials, logout icon | exact title and sub-title copy; bell badge/count; avatar menu |
| E2 | Dark card "Perutusan Terkini" | gold icon, heading "Perutusan Terkini", link "Lihat semua →" (right), one post row: small avatar (initials), title "{post title}", meta line "Pengetua · {n} bulan yang lepas" (relative time, BM) | max rows (one visible), unread state, row link target, empty-state copy, the post's author name (not copied) |
| E3 | Breadcrumb | "← Papan Pemuka" (link, left arrow) then separator then "Dashboard Sekolah" (current, bold) | link target of "← Papan Pemuka" |
| E4 | Red school banner | large building icon in a rounded square; school name in capitals (large, white); line "Admin Sekolah"; chips "📍 {state}", "{PPD name}" with a map-pin style icon (shows e.g. "PPD …"), "# Kod: {code}" | exact icons; whether the banner is a link; whether the name is the full or short name |
| E5 | Four pastel stat cards | one row of four rounded cards, tinted blue, teal/mint, pink/red, green; each has a coloured icon tile at top-left; **labels and values are cut off / unreadable** | labels, values, sub-lines, links, anything below them (page continues below the capture) |
| E6 | Sidebar | see M27 section 1.1; "Dashboard" is the active item (HARIAN); footer card with school short name + code + logout | — |

Screenshot 2 confirms only the sidebar (the "Dashboard" item is highlighted, first in HARIAN, URL `prestasiplus.my/admin-sekolah`). Nothing below the four cards (charts, tables, lists, empty states, further cards) is known.

**Inference about the four cards (INFERRED, weak):** the card colours match the HARIAN sidebar item colours in `user-nav.ts` (Senarai Pelajar indigo, Senarai Guru teal, Kelas Sekolah red; fourth green = unknown), and the server's own school-scoped dashboards use "Pelajar", "Guru" and "Sekolah"/"Pengguna" counts (section 4). So the cards are probably pupils, teachers, classes and one more figure. **Do not build labels from this**: OQ-L07-01.

## 4. Server adjacent screens (data scoping rules only; layout/copy not adopted over the screenshot)

### 4.1 `/admin` dashboard as rendered to a school admin (SERVER, `Admin\DashboardController.php`, `admin/dashboard.blade.php`)

Layout title "Dashboard", sub-title "Gambaran Keseluruhan Platform" (`dashboard.blade.php:7-8`), role label "Admin Sekolah" (`admin/layout.blade.php:51-55`). This is the national admin page (the M17 S1 twin) with a few school confinements; it does **not** have a banner, a "Perutusan Terkini" card or a breadcrumb, so it is not the live school-admin home. Blocks and scope for a school admin:

| Block (copy) | Query | Scope for `admin_sekolah` | Tag |
|---|---|---|---|
| "Soalan Aktif" / "Minggu ini: {n}", "Diluluskan", "Menunggu Review", "Draf" | `questions` grouped by status (`DashboardController.php:29-42`) | **national** (the question bank is national) | SERVER |
| "Subjek" / "{n} Aktif", "Tahap Pendidikan" | `Subject::count()`, `is_active`, `EducationLevel::count()` (lines 52-54) | national (curriculum is national, comment lines 45-48) | SERVER |
| "Pengguna" / "{n} Pelajar" | `User` count, `role='pelajar'` count (lines 55-56) | `where school_id = own` | SERVER |
| "Battle Arena" / "PvP Quiz Battles", "{n} Total", "{n} Aktif", "{n} Selesai" + icon links `/battle/ranking-sekolah`, `/battle/leaderboard` | `practice_sessions` via owner's school; selesai = `accuracy` not null (lines 60-66) | own school's users | SERVER |
| Sponsor cards ("Jumlah Penaja", "Menunggu Kelulusan", "Ditolak", "Digantung") | `Sponsor` counts | **hidden entirely** for a school admin (`$showSponsors = $scope === null`, line 72; view 157-231) | SERVER |
| "Tindakan Pantas" tiles: "Tambah Soalan Baru", "Tambah Subjek Baru", "Import & Semakan Soalan" | static links | shown to all staff (not scoped) | SERVER |
| "Soalan Terkini" / "10 soalan terbaru" table; empty "Tiada soalan." | 10 newest questions | national | SERVER |
| "Taburan Status Soalan", "Pautan Pantas" (Kurikulum, Analitik, Banner, Artikel), "Muat Turun Data (CSV)" (Pengguna, Soalan, Pembayaran, Sekolah) | status distribution, static links, `nav_allowed()` filters | links filtered per role (`helpers.php:34-177`) | SERVER |

### 4.2 Panel dashboard `GET /` on the admin domain (SERVER, `Panel\DashboardController.php:26-35`, `dashboard.tsx`)

Title "Papan Pemuka"; three stat cards: "Pelajar" ("Jumlah pelajar berdaftar"), "Guru" ("Jumlah guru berdaftar"), "Sekolah" ("Jumlah sekolah berdaftar"). For a school admin: `pelajar` = pupils with `school_id = own`, `guru` = teachers with `school_id = own`, `sekolah` = **1** ("the honest figure for someone who administers one", comment lines 21-25). This is the closest server evidence for "the school admin's home figures" and agrees in spirit with the screenshot's card row, but it has **three** cards, not four, and sits in a separate React panel. SERVER (adjacent). Note the label "Papan Pemuka" here is the server's own page title, which is the same word as the screenshot breadcrumb "← Papan Pemuka" (E3); INFERRED link: E3 returns to the generic dashboard.

### 4.3 Scope rules usable for the rebuild (SERVER)

- School of the viewer = `users.school_id` of the session user, never a request parameter (`StaffScope.php:128-131`; same as L06 FR-M17-105).
- A missing school must be an error (403), never "all" (`StaffScope::openedScopeOrAbort`, `StaffScope.php:142-148`; used by the school-scoped Command Center, L06).
- Curriculum and question-bank counts stay national; people/practice counts are confined; platform-business cards (sponsors) are hidden, not zeroed (`DashboardController.php:45-48,70-72`).
- `pegawai_ppd` is not a school admin and gets no school scope (`StaffScope.php:124-127`).

## 5. Element inventory of the rebuilt screen (what can be stated; the rest is blocked by OQ-L07-01)

| ID | Element | Copy (exact BM where known) | Source | Status |
|---|---|---|---|---|
| EL-L07-01 | Page title / sub-title in the top bar | unknown (starts "D…" / "S…") | SCREENSHOT | unknown |
| EL-L07-02 | Bell, avatar (initials), logout icon in the top bar | no text | SCREENSHOT | known by shape; behaviour belongs to the user shell (shells.md), not this screen |
| EL-L07-03 | Card "Perutusan Terkini" with "Lihat semua →" and the latest post row | "Perutusan Terkini", "Lihat semua →", post title, "Pengetua · {relative time}" | SCREENSHOT | row count, empty copy unknown |
| EL-L07-04 | Breadcrumb "← Papan Pemuka" > "Dashboard Sekolah" | exact | SCREENSHOT | target of the first link unknown |
| EL-L07-05 | School banner: name, "Admin Sekolah", "📍 {state}", "{PPD}", "# Kod: {code}" | exact labels | SCREENSHOT | icons exact unknown |
| EL-L07-06 | Four stat cards | unknown | SCREENSHOT (shape) | **blocked** |
| EL-L07-07 | Any content below the four cards | unknown | none | **unknown; do not invent** |
| EL-L07-08 | Empty states, loading, error | unknown (the global 403/404/500 pages exist: M27 Appendix B) | none | unknown |

## 6. Data definition of every known figure (query to owner contract in this app)

| Figure | Definition | Owner store / contract in this app (D12) | Tag |
|---|---|---|---|
| School name, code, state | the viewer's school record: `name`, `code` (`Tiada kod` when empty, M02 line 399), `state` | **M02** schools store (M02 section 6 school entity) | SCREENSHOT (what is shown) / PROPOSED (mapping) |
| PPD line "{PPD}" | the school's PPD / district: M02 has `district` on the school ("Daerah") and `ppdDistrict` on the school-admin user (M02 line 369). Whether live prints the PPD name or the district is **unknown** (screenshot shows "PPD …" followed by a district-like name) | **M02** (school `district`; M01/M02 lookup of PPD names, JPN/PPD lists M02 FR-M02-33) | INFERRED |
| "Admin Sekolah" | role label of `school_admin` (M02 BR-01) | M01/M02 | SCREENSHOT |
| Avatar initials | initials of the signed-in user's name (e.g. 2 letters) | M01 session user | SCREENSHOT |
| Latest perutusan (E2) | the newest announcement visible to the viewer's school (national by admin, school-scope by `school_admin` "Pengetua"; cross-module audit line 210: M09 writer roles) with title, author role label, relative time | **M09** perutusan store (S22-S25 are M09-T4b, not yet built; TRACKER line 351 `/perutusan` unchecked) | SCREENSHOT / INFERRED (visibility rule) |
| Stat card values | **unknown**. Candidates by the server (SERVER, adjacent): pupils of the school (M02 users, `role=student`, `schoolId`), teachers of the school (M02 users, `role=teacher`), school count = 1 (M02), classes of the school (M10 classes, owner M10 `classrooms`; M27 section 4 maps "Kelas Sekolah" to M10), pupils' answered questions (M05 practice answers). | M02 / M10 / M05 per column | INFERRED; **PROPOSED only after a user decision** |
| People counts must be computed from the dataset (D11/D12) | e.g. pupils of the school = count of M02 users with that `schoolId`; no hard-coded display constants | M02 | PROPOSED (CLAUDE.md section 6) |

## 7. Links and redirects (resolved against this rebuild)

| From | Target | Exists in the rebuild? | Notes |
|---|---|---|---|
| Sidebar "Dashboard" (all school-admin pages) | `/admin-sekolah` | **No route yet.** Sidebar entry exists (`user-nav.ts:364`, exact-active in `admin-nav.ts:597`). This is the page to build. | M17 board and tests already link back to it (`board.test.ts:232`) |
| Redirect when no school chosen | `/admin-sekolah/pilih-sekolah` | **No** | live 500 for the platform admin (D-M27-01); not built (OQ-L07-02) |
| E2 "Lihat semua →" | `/perutusan` (INFERRED from sidebar "Perutusan", `shells.md` lines 61, 74) | **Route not built yet** (M09-T4b, TRACKER line 351 / build-plan lines 423, 1100) | dead link until M09-T4b ships; do not ship a dead link (D9) |
| E2 post row | `/perutusan/{id}` (INFERRED, M09 S23) | **Not built yet** (M09-T4b) | |
| E3 "← Papan Pemuka" | `/dashboard` (INFERRED: generic dashboard, M05 S1; server also calls its home "Papan Pemuka") | `/dashboard` exists (M05 S1); whether `school_admin` may open it is **unknown** (M01 BR-07 lands them there, M05 role gating not checked) | OQ-L07-04 |
| Sidebar items on this page | `/admin-sekolah/pelajar`, `/guru`, `/kelas`, `/pengguna`, … | Only `/admin-sekolah/command-center` (M17), `/admin-sekolah/monitoring` (M11), `/admin-sekolah/kirkpatrick` (M12) exist as routes; the other hrefs are INFERRED and several are 404 on live (D-M27-02) | owned by M27 later |
| Reverse links into this page | M17 Command Center "← Dashboard" (FR-M17-112) | resolves once `/admin-sekolah` exists | |
| Banner (E4) | unknown whether clickable | — | |

## 8. Responsive and accessibility notes

- The screenshot is a single tablet-width capture with a hamburger in the top bar and the sidebar visible; the four stat cards sit in one row and the banner is full width. Behaviour at 375 / 768 / 1280 is **unknown** (M27 section 7: the school-admin shell was never rendered).
- Server views of the adjacent `/admin` dashboard are mobile-first (grids `grid-cols-2 sm:grid-cols-2 lg:grid-cols-4`, tables in `overflow-x-auto`, text from `text-[9px]`, `dashboard.blade.php:13,82,160,286`) and use text below 12px; the rebuild keeps the 12px minimum (M17 FR-M17-117, D-M27-03). SERVER (adjacent).
- Required by CLAUDE.md section 7: no page-level horizontal scroll at 375 / 768 / 1280; banner chips wrap; stat cards reflow 4 > 2 > 1 (PROPOSED). Accessibility replicates live (D10); nothing is known beyond the screenshot.

## 9. Privacy

- No real name is copied. The screenshot's school name, code, state/PPD values and post title/author are replaced in docs and seeds by the fictitious M02 school and a fictitious perutusan post. The post author is shown only as the role label "Pengetua" (a role, not a name).
- Seeds: the school-admin account of the dev fixtures (M02 fixture roles 3102-3104 per the cross-module audit) and its school come from M02/M09 seeds, never from the screenshot or the server seeder.

## 10. Module mapping — recommendation

**Recommended owner: M27 (School Admin Portal), as a new screen "S0 Dashboard Sekolah" (`/admin-sekolah`) in the M27 SRS, with M17 only supplying nothing new.** Reasons:

1. M27 was created (D16) precisely to own the undocumented `/admin-sekolah/*` screens; `/admin-sekolah` is row 1 of its route table (M27 section 1.2) and build-plan line 320 says "its own home `/admin-sekolah` is deferred".
2. M17's S1 (`/admin`) is the national admin dashboard (platform questions, subjects, sponsors). The live school-admin home is a different screen (banner, perutusan card, stat cards); the server only has a confined copy of S1, which the screenshot contradicts. Folding it into M17 would mix two different screens under one id. M17's Command Center alias already works the other way round: it sits under M17 because it reuses M17's own board component; the dashboard reuses nothing from M17.
3. Its figures come from M02 (school, people), M10 (classes), M05 (practice) and M09 (perutusan), and the page is the landing target of M17, M11 and M12 aliases, so it is a portal-level screen.
4. The matrix still says "M17 / M05" for L07 (line 29); the lead should either relabel the Admin Sekolah part as M27 or keep M17 as a placeholder. Counter-argument for M17: M17 has G1 approved and is already in build, so the owner could be M17 to avoid waiting for the M27 SRS; this is a lead/user decision (OQ-L07-03).

Track and dependency (PROPOSED): **Full** track (new screen, no stores of its own: read-only on M02/M10/M05/M09 owner contracts). Blocked on **OQ-L07-01** (the four cards and anything below them). Tasks: M27 G1 requirement note for S0 > task "M27-T1 dashboard sekolah" (page + 403 rule + route + landing change request to M01) > QA. It can be built without M09-T4b only if the "Perutusan Terkini" card is feature-complete against the M09 store (the "Lihat semua" target needs M09-T4b). Build-plan R.1.3 row for `/admin-sekolah` should be renamed from "Deferred - needs school-admin account" to "buildable after OQ-L07-01" (D24 withdrew the account requirement; lead to update TRACKER/build-plan, this file edits nothing else).

## 11. Open questions (needs a user or lead decision)

| ID | Question | Why it blocks | Suggested default |
|---|---|---|---|
| OQ-L07-01 | The four stat cards (labels, values, sub-lines, links) and everything below them are not readable in the only evidence (one covered screenshot) and are not defined anywhere in the server code. What is the content of the page below the banner? | Blocks the element inventory (EL-L07-06/07), the SRS and every AC for the figures. | Option A (recommended): the user supplies a clean full-page screenshot or a short list of the four cards and what is below (no account needed, D24). Option B: build only E1-E5 (shell, perutusan card, breadcrumb, banner) now and render four cards = Pelajar, Guru, Kelas, Soalan Dijawab as PROPOSED, flagged in the deviation table. Not recommended without the user. |
| OQ-L07-02 | Does `/admin-sekolah/pilih-sekolah` get built? Live gives 500 to the platform admin; the picker content is unknown; the server has no picker. | Decides the route table and the 403/redirect behaviour for users without a school. | Do not build; no school = 403 "Akses Ditolak"; platform admin = 403 (D9 fix of D-M27-01). |
| OQ-L07-03 | Owner module: M27 (recommended) or M17 (matrix text)? | Task numbering, SRS location, TRACKER row. | M27 as in section 10. |
| OQ-L07-04 | Landing and "← Papan Pemuka": after login should `school_admin` land on `/admin-sekolah` (screenshot, sidebar) instead of `/dashboard` (M01 BR-07, INFERRED)? Does "← Papan Pemuka" go to `/dashboard` and may `school_admin` open it? | M01 change request (landing.ts), link target, M05 role gating. | Landing `/admin-sekolah`; "← Papan Pemuka" to `/dashboard` only if M05 admits `school_admin`, else to `/admin-sekolah` itself. |
| OQ-L07-05 | "Perutusan Terkini": number of rows, which announcements a school admin sees (national + own school?), unread state, empty-state copy, and whether it ships before M09-T4b. | Dead link on "Lihat semua →" until M09-T4b. | Latest 1 row, national + own school visible; hide-card vs link decision by the lead; empty copy PROPOSED, flagged. |
| OQ-L07-06 | Banner "{PPD}": print the PPD name or the school's district? Is the banner clickable? | M02 field choice (`district` vs `ppdDistrict`). | School `district` prefixed "PPD " only if the M02 seed already stores PPD names; else raise with M02. |
| OQ-L07-07 | Does the Admin Sekolah dashboard use the shared user shell (shells.md v1.2, as the aliases) with the top-bar elements of E1? | Shell choice and page title copy. | User shell (same as aliases, INFERRED). |

Not asked of the user: any role account (D24).

## 12. Summary for the lead

- Server source for `/admin-sekolah` and the picker: **not found** (negative result in section 0); the real page's layout and copy come only from the user's screenshot, which is partly unreadable.
- What is known: top bar, "Perutusan Terkini" card, breadcrumb "← Papan Pemuka > Dashboard Sekolah", red school banner (name, "Admin Sekolah", state, PPD, "Kod"), four unreadable stat cards.
- What the server adds: scoping rules only (school from session, no school = 403 not national, curriculum/question counts national, sponsor card hidden, school count = 1).
- Targets: `/admin-sekolah` has no route yet; `/admin-sekolah/pilih-sekolah` not built (proposed); `/perutusan` not built (M09-T4b); `/dashboard` exists.
- Recommendation: owner M27 (S0), Full track, blocked on OQ-L07-01.
