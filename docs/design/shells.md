# PrestasiPlus Rebuild — Shell Specifications (Foundation)

## 0. Document control

| Field | Value |
|---|---|
| Document | Shells — Admin panel, User portal, Guest/public |
| Version | 1.2.1 |
| Date | 2026-09-30 |
| Status | Draft — v1.2 (task D-R1) for F-18; foundation and M01–M09 approved at G2, the Release 1.0 additions await OD-R9 |
| Author | ui-ux-designer (agent) |
| Sources | `docs/discovery/00-global-ui.md`, `docs/discovery/img/global/*` (all 9 screenshots viewed), `docs/requirements/SRS.md` §5 (FR-G-03), §6.2 (NFR-RESP), `docs/requirements/srs/M01-authentication.md` §10 + DV list, `docs/requirements/srs/M03-curriculum.md` §10. Added in v1.2: `docs/architecture/build-plan.md` v1.11 (§R, D-R1, F-18, OD-R5), `docs/requirements/srs/M10`, `M11`, `M12`, `M13`, `M17`, `M18` route tables, `docs/discovery/inventory/M01/SHA-admin-shell.json` (element inventory of the admin shell, desktop and "Lagi" states), `src/shells/**` and `src/app/router/meta.ts` as built (F-19, F-20), `roles-matrix/guru/*.jpeg` and `roles-matrix/admin sekolah/*.jpeg` (red ticks ignored) |
| Companion doc | `docs/design/design-system.md` v1.10 (tokens, components, icon map) — this document assumes those tokens |
| Scope rule | Replicate, don't redesign (D7). Only the approved D9 fixes below change live shell behaviour. |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.2.1 | 2026-09-30 | From the F-18 G4 review: §2.2 item 12 ("sticky at the sidebar's own bottom") contradicted §2.11 ("bottom of the scroll content, not fixed"). Both now say the user block is the last child of a `min-h-full flex-col` scroll column (viewport bottom on a short menu, end of scroll on a long one), marked INFERRED because the SHA inventory has no positioning data. No other change. |
| 1.2 | 2026-09-30 | **D-R1 (before F-18).** (a) §1 rewritten as a per-role, per-route-family shell map with evidence. Corrections to v1.1: `/guru/*` is **not** all admin shell (the teacher portal is user shell, except Monitoring `/guru/monitoring*` and Kirkpatrick `/guru/kirkpatrick*`, M11 S2–S5 and M12 S1–S8); `/ppd/*` and `/jpn/*` are user shell (M18 SRS: every screen is SHU except the standalone `/jpn/command-center`); the standalone screens (Command Centers, 404, 403) are added to the "no shell" row. (b) §2 defines the admin shell completely for F-18: structure, sidebar, header, mobile at 375 / 768 / 1280, states, nav data contract, the admin menu from the M01 admin-shell inventory (v1.1 put the groups Gamifikasi to Kewangan under the wrong heading: `PENGURUSAN` holds five groups and `SISTEM` six), and the **teacher variant** (OD-R5: the teacher's own menu inside the admin chrome, its own bottom nav, no server-status pill, caption "Portal Guru"). (c) §2.9 icon audit: 21 FA names missing from design-system §6 are listed and added in design-system v1.10. (d) §5 adds DV-SH-10 and DV-SH-11 and the provisional-decision table; §7 records the open items. No live behaviour changes beyond DV-SH-11 (touch target). |
| 1.1 | 2026-09-25 | Delivery Lead decisions recorded (D9/D10): DV-SH-02 and DV-SH-05 confirmed "not broken, replicate live, no IA/logout improvement" (§5, §7). DV-SH-03 generalisation accepted, scoped to "shell derives header title from the current route" and cited to the specific per-module DVs it implements (M01 DV-13, M04 DV-M04-02, M05 DV-M05-01, M06 DV-M06-07, M08 DV-01, M10 pending) — adds no new titles beyond what those modules specify (§5, §7). |
| 1.0 | 2026-09-25 | Initial foundation shell spec: admin shell, user portal shell, guest/auth layout, role→shell/route map, responsive defects + fixes, ASCII wireframes at 375/768/1280. |

---

## 1. Shell → role/route mapping

Per master SRS FR-G-03, the app renders exactly **two authenticated shells** plus an **unauthenticated layout** and full-page (standalone) screens. v1.2 fixes which **routes** use which shell, per role and per route family. The evidence is the G1-approved SRS route tables (column "Shell"), the built router and shells, and the discovery screenshots.

### 1.1 The layouts (router `meta.layout`, `src/app/router/meta.ts`)

| Layout | `meta.layout` | What it is | Spec |
|---|---|---|---|
| **User portal shell** | `user` | Sidebar (≥ `lg`) or drawer + bottom nav (< `lg`), header with chips and bell. Built (F-19). | §3 |
| **Admin panel shell** | `admin` | Sidebar (≥ `lg`) or bottom nav + "Lagi" popover (< `lg`), header with title, optional server-status pill, avatar, logout. **Not built yet (F-18).** The chrome is the same for every role; the **menu content depends on the role** (§2.6). | §2 |
| **Role-dependent** | `role` | Admin shell for `admin`, user shell for every other role (`/tetapan`, `/spm-mock*`, `/pusat-ai/spm`). Built in `LayoutHost`. | §1.4 |
| **Public layout** | `public-or-user` | Guest: public top bar + CTA + footer (F-20). Logged in: user shell. | F-20, M09 SRS |
| **Bare (no shell)** | `bare` | Auth pages (§4 guest/auth layout), the 404 and 403 pages (design-system §7.15), and every screen an SRS marks "standalone" (own page-level chrome): Command Centers (M10 S2, M17 S2–S7, M18 S11), the M11 S8 403 for admin. | §4, design-system §7.15 |

### 1.2 Route → shell map per role

"Family" = a group of routes with the same shell. `SHU` / `SHA` are the abbreviations used in the SRS route tables.

**Student (`student`)**

| Route family | Shell | Evidence |
|---|---|---|
| Every app route: `/dashboard`, `/practice*`, `/spm*`, `/permainan*`, `/topics*`, `/kelas-saya`, `/set-soalan-saya`, `/kirkpatrick`, `/maklum-balas`, `/profile`, `/notifikasi`, `/pricing`, … | User shell | `roles-matrix/murid/*.jpeg`; `user-nav.ts`; M10 S33/S34, M12 S9/S10 (SHU) |
| `/tetapan`, `/spm-mock*`, `/pusat-ai/spm` (`layout: role`) | User shell | M01 OQ-6 (INFERRED), build-plan §S.5 |
| `/artikel*`, `/video` (`public-or-user`) | User shell when logged in | F-20, M09 SRS |
| `/login`, `/register`, `/password/*`, 404, 403 | Bare | §4 |
| `/admin/*`, `/guru/monitoring*`, `/guru/kirkpatrick*` | none: the router denies the role (FR-M17-06, BR-M01-07) | M11 / M12 role matrices |

**Teacher (`teacher`)**

| Route family | Shell | Evidence |
|---|---|---|
| `/guru` (M10 S1), `/guru/remedial-progress`, `/guru/kelas*`, `/guru/pelajar*`, `/guru/kehadiran-digital`, `/guru/jadual-belajar`, `/guru/broadcast`, `/guru/live-kelas`, `/guru/misi-harian*`, `/guru/set-soalan*`, `/guru/soalan-guru*`, `/guru/soalan-berstruktur*`, `/guru/soalan*`, `/guru/audio-kbat*`, `/guru/databank*`, `/guru/artikel*`, `/guru/profil/edit` | **User shell** | M10 §2: every row "user" except S2 and S35; `roles-matrix/guru/*.jpeg` shows the hamburger header, "0 syiling" chip, bell and the sidebar on `/guru` |
| `/guru/laporan` (M11 S1), `/guru/analisis-item` (S6), `/guru/perbandingan-kelas` (S7), `/guru/laporan-mingguan-kelas` (S8, teacher provisional) | **User shell** | M11 §2 (SHU), FR-M11-04 |
| `/cikgu*` (M13), `/amaran*`, `/headcount*`, `/prestasi*`, `/analisa-item*`, `/kombo`, `/liga`, `/tournament`, `/perutusan`, `/video`, `/profile`, `/panduan`, `/pusat-ai/*`, `/wellbeing/alerts` | **User shell** | M13 §2 (SHU), M18 §2 (SHU), `user-nav.ts` teacher entries |
| `/guru/monitoring`, `/guru/monitoring/sekolah/{schoolId}` and its `/pelajar/{userId}` and `/guru/{userId}` children (M11 S2–S5) | **Admin shell, teacher variant (§2.6)** | FR-M11-04 ("for a teacher: same shell, provisional"); M11 §2 SHA. Provisional (UNVERIFIED: no teacher account was observed on it) |
| `/guru/kirkpatrick`, `…/reaction`, `…/learning`, `…/behavior`, `…/results`, `…/chain`, `…/interventions`, `…/pelajar/{id}` (M12 S1–S8) | **Admin shell, teacher variant (§2.6)** | M12 §2 (SHA, "Guru (prov.)"), E2E-M12-07. S8 is admin-only (the teacher gets the M12 denial) |
| `/guru/command-center` (M10 S2) and its drill-down pages | Bare (standalone, dark) | M10 §2 |
| `/kirkpatrick`, `/maklum-balas` (M12 S9/S10) | User shell | M12 §2 (SHU) |
| `/tetapan` (`layout: role`) | User shell | as student |
| `/admin/*` | none: denied → landing page | FR-M17-06 |

**School admin (`school_admin`)**

| Route family | Shell | Evidence |
|---|---|---|
| `/admin-sekolah` and every `/admin-sekolah/*` menu target | **User shell** | `roles-matrix/admin sekolah/*.jpeg` (hamburger header, bell, avatar, sidebar). These routes are in no SRS yet (OD-R1): shell PROVISIONAL |
| `/amaran*`, `/sekolah/{id}/*`, `/analisa-item/*`, `/headcount*`, `/prestasi*`, `/kombo`, `/liga`, `/tournament`, `/perutusan`, `/video`, `/pusat-ai/*`, `/wellbeing/alerts`, `/tetapan` | **User shell** | M18 §2 (SHU), `user-nav.ts` |
| `/admin/*` | none: denied → landing page | FR-M17-06 |
| Open: the menu targets `/admin/master-notes`, `/admin/audit-log`, `/admin/soalan-gambar` (teacher and school admin entries "Semakan Nota Master", "Audit Log", "Gambar Rajah") | Not decided: no G1 SRS gives them a shell for these roles | §7.2 item 4. Rule if they are ever built: admin shell with the role's own menu (§1.4) |

**Admin (`admin`)**

| Route family | Shell | Evidence |
|---|---|---|
| All `/admin/*` pages (M02, M03, M04, M07, M09, M12, M14, M15, M16 S29, M17 S1 and S8–S11, M19, M20, M21, …) | **Admin shell** | 00-global-ui §3, SHA inventories in every module |
| `/admin/command-center*` (M17 S2–S7, S4–S7 also mounted under `/guru`) | Bare (standalone) | M17 §2, FR-M17-04 |
| `/guru/monitoring*`, `/guru/kirkpatrick*` | **Admin shell** (admin menu; the Monitoring and Kirkpatrick items are active on the `/guru` twins, FR-M11-05, FR-M12-04) | M11/M12 §2 |
| `/tetapan`, `/spm-mock*`, `/pusat-ai/spm` (`layout: role`) | **Admin shell** (header "Tetapan Peribadi" on `/tetapan`, DV-SH-07) | M01 DV-13, M06 S11–S13 admin variant |
| Every other route: `/dashboard`, `/guru` (M10/M11 user-shell pages), `/ppd/*`, `/jpn/*`, `/amaran*`, `/cikgu*`, `/profile`, … | **User shell** (reached via "Ke Dashboard" / "Student View") | M10–M13, M18 SHU; `user-nav.ts` admin entries |
| `/jpn/command-center`, 404, 403 | Bare | M18 §2 |

**Other roles (for completeness): parent, sponsor, PPD officer, JPN officer.** User shell for every route in any SRS (M18 S1–S31 are all SHU; `/jpn/command-center` is standalone). They have no admin-shell route.

### 1.3 Corrections to v1.1

| v1.1 statement | v1.2 |
|---|---|
| "Admin panel shell used by `/admin/*`, `/guru/*`, `/ppd/*`, `/jpn/*` … teacher, ppd_officer, jpn_officer" | Admin shell is used by `/admin/*` (admin) plus the two `/guru` families Monitoring and Kirkpatrick (admin and teacher). `/guru/*` otherwise, `/ppd/*` and `/jpn/*` are **user shell** (M10, M11 S1/S6/S8, M18 route tables; F-19 as built; the screenshots). PPD and JPN officers never get the admin shell |
| "User portal shell: all routes not under `/admin`, `/guru`, `/ppd`, `/jpn`" | The user shell is used by every route **not** listed as admin shell above, including the `/guru`, `/ppd` and `/jpn` pages |
| "No shell: 404, 403" | Also every SRS-standalone screen: the Command Centers (M10 S2, M17 S2–S7, M18 S11) and the M11 S8 403 |
| §2.2 put six groups under `PENGURUSAN` and only "Sistem" under `SISTEM` | The M01 admin-shell inventory shows `PENGURUSAN` holds five groups (Kurikulum, Soalan, Pengguna, SPM, Premium) and `SISTEM` holds six (Gamifikasi, Battle & Permainan, Marketplace, Kandungan, Kewangan, Sistem). Corrected in §2.2 |

FR-G-03 itself stands: still two authenticated shells. Only the route assignment changed.

### 1.4 Shell selection and cross-shell rules

- The router picks the shell from `meta.layout` (`LayoutHost`, `resolveShell`). `layout: 'admin'` renders for any role the route guard lets through. The shell then chooses the **menu, bottom nav, header controls and caption from the logged-in role** (§2.6). One admin-shell component, one role switch; no second shell component for the teacher.
- Rule for a role other than `admin` and `teacher` on a future `layout: 'admin'` route: the admin chrome renders that role's own user-shell menu (`navFor(role)`), FR-G-04 (hidden, not disabled). Its bottom nav is not defined until such a route gets an SRS.
- `/tetapan` (`layout: role`): admin sees it inside the admin shell (header "Tetapan Peribadi", DV-13, §5); every other role sees it inside the user shell (INFERRED, OQ-6 in M01 SRS).
- "Ke Admin Panel" (user shell → `/admin`) and "Ke Dashboard" / "Student View" (admin shell → `/dashboard`) are the only cross-shell links from the shell menus, both **admin-only**. The teacher has no such link. A teacher who leaves the admin chrome does so through its own menu items (for example "Dashboard Guru" → `/guru`, user shell). The teacher menu keeps the same items, labels and order in both shells; only the chrome around it changes.
- Moving between route families of one role swaps the chrome without a full reload (for example teacher `/guru/laporan` (user shell) → `/guru/monitoring` (admin shell)). This is a consequence of the approved SRS mapping, not a design choice; the fallback in OD-R5 removes it (§7.2).

---

## 2. Admin panel shell (`/admin/*` and the `/guru/monitoring*`, `/guru/kirkpatrick*` families; §1.2)

Screenshots referenced: `docs/discovery/img/global/admin-shell-desktop.png`, `admin-shell-tablet.png`, `admin-shell-mobile.png`, `admin-mobile-lagi-menu.png`. Element inventory (labels, hrefs, icons, order, desktop and "Lagi" states): `docs/discovery/inventory/M01/SHA-admin-shell.json`. F-18 builds against this section; where a value is marked INFERRED or PROPOSED it was not observed (the teacher was never seen in this shell) and §2.10 lists it.

**One shell, two menus.** The chrome (§2.1–§2.4) is identical for every role. §2.2 and §2.5 give the **admin** content, §2.6 the **teacher** content. Anything not called out as different in §2.6 is the same for the teacher.

### 2.1 Structure summary

| Zone | ≥1024px (`lg`) | <1024px (`sm`/mobile & `md`/tablet — both use the **mobile shell**, per live's single 1024 breakpoint) |
|---|---|---|
| Sidebar | `aside.sidebar`: `fixed left-0 top-0 h-screen w-64 z-40 hidden lg:block overflow-y-auto`, white at 95%, `shadow-sidebar` (.08). 256px | Not rendered |
| Header | `header.topbar`: `sticky top-0 z-30 px-3 py-2 sm:px-6 sm:py-4`, white at 95%, `shadow-header`. Left: title + subtitle. Right: server-status pill (admin only), avatar, logout icon | Same element. Left: title + subtitle. Right: the logo (`h-8 sm:h-10`, → the role home: `/admin` admin, `/guru` teacher). No avatar, no pill, no logout icon (DV-SH-02: replicate, logout stays in "Lagi") |
| Bottom nav | Not rendered (`lg:hidden`) | `nav.bottom-nav`: `fixed bottom-0 inset-x-0 z-50 bg-white border-t shadow-lg`, 45px high + `pb-[env(safe-area-inset-bottom)]`. 5 items (§2.4) |
| Main | `main.flex-1 py-3 sm:py-6 mx-auto w-[95%] page-transition`, pushed right by the sidebar (`lg:ml-64`). Fluid, no max-width | Same, `w-[95%] mx-auto`. Bottom padding = 45px + safe-area + 16px so the last content is never under the bottom nav |
| Footer strip | None | Copyright strip (mobile only in the inventory), above the bottom-nav clearance: "© 2026 PRESTASIPLUS. Hakcipta Terpelihara." and "Didikan penuh ❤️ dari Malaysia 🇲🇾" (`text-xs`, `color-text-muted`, centred) |
| Body background | `bg-app-admin` (design-system §1.3) | same |
| Tab title | Set per route by the module (`<Page> - Admin Panel` on live admin pages; M11/M12 give the exact title per screen). The shell never invents one | same |

Widths that must not scroll sideways: 320, 375, 768, 1024, 1280 (NFR-RESP-01). The wide content (tables, charts) scrolls inside its own card; the shell itself only has the vertical scroll of the sidebar and of the "Lagi" popover.

### 2.2 Sidebar (≥1024px) — content, top to bottom, live order

Order and content are from the M01 admin-shell inventory (OBSERVED). The full item list (labels, routes, icons, colours, "Lagi" placement) is §2.7.

1. **Logo** (`/images/logo-custom.png`, `h-8 sm:h-10`) → `/admin`, caption "Panel Pentadbir" (`text-xs`, `color-text-muted`) below it. Block padding `p-5`.
2. **Pinned items** (not inside any section):
   - "Command Center" — card `gradient-command` (`#312E81 → #4F46E5`), `radius-card` (12px per live), white text `font-bold`, `SatelliteDish` icon (`text-indigo-200`), red pulsing **LIVE** pill (design-system §4) → `/admin/command-center`, `target="_blank"` (standalone page, M17 S2).
   - "Aktiviti Harian" (`ChartLine`) — `font-semibold`, text `emerald-700`, icon `emerald-600` → `/admin/command-center/daily-activity`, `target="_blank"`.
   - "Audio KBAT" (`Headphones`) — `font-semibold`, text `amber-700`, icon `amber-500` → `/admin/audio-kbat`.
3. **Section `HARIAN`** (teal): "Dashboard", "Laporan Eksekutif".
4. **Section `ANALITIK`** (indigo): "Analitik", "Monitoring", collapsible group **KIRKPATRICK** (7 items), "Laporan" (outside the group, after it).
5. **Section `PENGURUSAN`** (blue): five collapsible groups **KURIKULUM**, **SOALAN**, **PENGGUNA**, **SPM**, **PREMIUM**.
6. **Section `SISTEM`** (slate): six collapsible groups **GAMIFIKASI**, **BATTLE & PERMAINAN**, **MARKETPLACE**, **KANDUNGAN**, **KEWANGAN**, **SISTEM**.
7. **Section `🏆 BILIK DUTA`** (amber) with the **DEV** pill on the heading row: 6 items (Phase F, in scope per D3).
8. **Section `🤖 PUSAT AI`** (purple): 7 items.
9. **Section `✨ VISI & PERTANDINGAN`** (indigo): 4 items.
10. **Section `💎 KILLER FEATURES`** (fuchsia): 3 items.
11. **Footer links** (above the user block, `border-t`): "Tetapan Peribadi" (`Settings`, `color-text-muted`) → `/tetapan`; "Ke Dashboard" (`ArrowLeft`, emerald: text `emerald-600`) → `/dashboard` (admin-only student-view switch).
12. **User block** (last child of the scroll content, not fixed or sticky: the sidebar content is a `min-h-full flex-col` column, so the block sits at the viewport bottom on a short menu and at the end of the scroll on a long one; positioning is not in the SHA inventory, so this is INFERRED): avatar initials (`w-10 h-10`), name (`text-sm font-semibold`, truncates), role label "Admin" (`text-xs`, `color-text-muted`), logout icon (`LogOut`, `title="Log Keluar"`) → `/logout`.

**Section header markup** (OBSERVED for the first four, the same pattern for the rest): a row `pt-4 pb-2 px-4` with the label (`text-xs font-extrabold tracking-wider uppercase`, colour = the section's `-700` shade) followed by a rule `flex-1 h-[2px] rounded-full bg-gradient-to-r from-{colour}-300 to-transparent`. The emoji in the label is literal copy. Colours: HARIAN teal, ANALITIK indigo, PENGURUSAN blue, SISTEM slate (all OBSERVED); Bilik Duta amber, Pusat AI purple, Visi & Pertandingan indigo, Killer Features fuchsia (INFERRED from the same headings in `user-nav.ts`). The **DEV** pill sits on the heading row of "🏆 Bilik Duta" (not on the item as in the user shell, design-system §4), after the rule, `text-[8px]`.

**Collapsible group**: a `button` (`w-full flex items-center gap-3 px-4 py-2.5`), coloured group icon (`w-5`), label `text-xs font-bold tracking-wider uppercase`, right-aligned `ChevronDown` (rotates 180° when open, `transition-transform`). The group's items sit under it, indented (`pl-11`), one per row.

**Group state.** Keys: `kirkpatrick`, `kurikulum`, `soalan`, `pengguna`, `spm`, `premium`, `gamifikasi`, `battle`, `marketplace`, `kandungan`, `kewangan`, `sistem`. State persists in `localStorage["admin_sidebar"]` as `{key: boolean}`. All groups start closed. On every route change the group that contains the active item is opened (and saved as open); the user can collapse it afterwards. The teacher uses the same storage key and the one key that applies to it, `kirkpatrick`. (Live is server-rendered: it opens the active group on load, independent of the saved state. Opening on route change is the SPA equivalent, INFERRED.)

**Nav item visual states** (see `docs/design/design-system.md` §3.2/§7 for tokens; measured on the desktop screenshot):

| State | Style |
|---|---|
| Default | `nav-item flex items-center gap-3 px-4 py-2.5` (40px high), `radius-nav-item` (16px), `text-sm font-medium`, text `color-text-muted` (`slate-500`, 4.8:1 on white), icon `w-5` in its own colour (§2.7). Section and group text sizes as above |
| Active | White text (`font-semibold`), `gradient-primary` background, `shadow-active-nav`, icon white. The pill is slightly wider than its neighbours (`translateX(4px) scale(1.02)` as the user shell `.nav-item.active`, INFERRED from the screenshot) |
| Sub-item (inside an open group) | `text-xs`, icon `w-4` in `color-text-faint` (`slate-400`), text `color-text-muted`. Active sub-item: same gradient pill as a top-level item (INFERRED; only the group header was visible in the capture) |
| Hover (inactive) | Background `linear-gradient(135deg, #EFF6FF, #E0E7FF)`, `translateX(6px) scale(1.03)`, `shadow` `0 4px 8px rgba(99,102,241,.12)` (INFERRED: the same `.nav-item:hover` as the user shell). No hover on touch |
| Focus (keyboard) | The browser's default focus ring on the `a` / `button` (replicate-live baseline, D10: no added ring) |
| Pinned "Command Center" | Card is never "active" (it opens in a new tab) |
| LIVE pill | `animate-pulse`; static under `prefers-reduced-motion` only as far as the live CSS does it (design-system §3.4) |

The nav is an ordered list of sections, groups and items; "hidden, not disabled" (FR-G-04) applies to role filtering. A section with no visible item is dropped (as `navFor` does).

### 2.3 Header (≥1024px)

Left → right:
1. Page `H1` (Outfit 700, 24px, `color-text-strong`) + subtitle (`text-sm`, `color-text-muted`) — e.g. "Dashboard" / "Gambaran Keseluruhan Platform".
2. **Server-status pill** (admin-only, `hidden lg:block`): `bg-slate-50 border border-slate-200 rounded-xl`, 11px text; CPU / RAM / Disk / Uptime with `Cpu` / `MemoryStick` / `HardDrive` / `Clock` icons; polls `GET /admin/server-status` every 30s; colour thresholds per design-system §5 ("Server status pill thresholds"); tooltips "Load: x / n cores", "used GB / total GB".
3. Avatar (`w-10 h-10 rounded-full avatar-ring`, initials, indigo background).
4. Logout icon button (`w-9 h-9 rounded-lg`, `LogOut`, slate-400 default → red-600 on red-50 hover) → `/logout` (plain link, no confirm).

There is **no global search** and **no notification bell** in the admin header (replicate — this is an intentional live omission, not a gap to fill).

**Header details (F-18 contract)**

| Item | Spec |
|---|---|
| Title / subtitle source | The route's `meta.header` or `usePageMeta().setHeader()` (DV-SH-03: header derived from the current route). Screens whose module has not set one keep the live fallback: title "Dashboard", subtitle "Selamat datang, Admin" (OBSERVED on live for the admin). No teacher screen relies on the fallback: M11 S2–S5 and M12 S1–S8 set their own titles (FR-M11-02/03, FR-M12-05/06) |
| Title typography | `h1` Outfit 700, `text-base sm:text-2xl`, `color-text-strong`; truncates with an ellipsis on one line. Subtitle `text-xs sm:text-sm`, `color-text-muted`, one line, ellipsis. A screen with no subtitle (for example `/tetapan`, S6, S8) renders the title only |
| Breadcrumb | Not part of the header. M11 S3–S5 render their `ArrowLeft Monitoring` breadcrumb inside the page (FR-M11-03) |
| Server-status pill | `hidden lg:flex`, **only for `admin`**. Polls `GET /api/admin/server-status` every 30 s while the tab is visible (`useIntervalWhileVisible`). Order: `Cpu` {cpu}% · `MemoryStick` {ram}% · `HardDrive` {disk}% · `Clock` {uptime} (e.g. "204d 2h"), separated by 1px `slate-200` rules, `text-[11px]`, icons `w-3`. Value colours per design-system §5 (CPU > 80 red, > 50 amber; RAM > 85 / > 60; Disk > 90 / > 75; else emerald; uptime `slate-500`). Tooltips (`title`): CPU "Load: {load} / {cores} cores", RAM "{used}GB / {total}GB", Disk "{used}GB / {total}GB", Clock "Uptime". Loading (first request): "--" in each value, `slate-400`. Error: the last good values stay; if there was none, "--". No spinner, no error text (INFERRED, consistent with M17 "a failed poll keeps the last values") |
| Avatar | `w-10 h-10 rounded-full avatar-ring`, initials of the first two words of the name, `bg-indigo-500` text white, `font-bold text-sm`. Not a link |
| Logout | `w-9 h-9 rounded-lg` icon link (`title="Log Keluar"`), `LogOut` `slate-400`, hover `text-red-600 bg-red-50`, plain link to `/logout`, no confirm. Hit area is 36px on desktop only (this control does not exist below `lg`) |
| Sticky | The header stays on top while `main` scrolls; the sidebar has its own scroll |
| Page transition | `main` fades in on route change (`page-transition`; duration as the user shell's, none added under `prefers-reduced-motion`, as live) |

### 2.4 Mobile/tablet (<1024px)

- **Header**: title + subtitle only (no avatar, no server-status pill, no logout: DV-SH-02, decided not broken, replicate), logo on the right. Height ≈ 64px at 375 (`py-2`), ≈ 87px from `sm` (`py-4`).
- **Bottom nav** (admin: 5 items; teacher: §2.6). `nav.bottom-nav`, `fixed bottom-0`, white, `border-t`, `shadow-lg`, 45px + safe-area padding, `flex justify-around`, each item `flex-1 flex flex-col items-center justify-center`. Icon `text-lg sm:text-xl`, label `text-[10px] sm:text-[11px] font-semibold`. Inactive: icon and label `slate-400`; active: icon and label `indigo-600`. Hit area = the whole `flex-1` cell × 45px (≥ 44px). Admin items:
  1. "Dashboard" (`Gauge`, FA `fa-tachometer-alt`) → `/admin` (active on `/admin` exactly)
  2. "Soalan" (`CircleQuestionMark`) → `/admin/questions` (active on `/admin/questions*`)
  3. "Penaja" (`Handshake`) → `/admin/sponsors` (active on `/admin/sponsors*`)
  4. "Pengguna" (`Users`) → `/admin/users` (active on `/admin/users*`)
  5. "Lagi" (`Ellipsis`) → toggles the popover below. It is a `button`; it shows the active colour while the popover is open, or when the current route is only reachable through the popover (INFERRED)
- **"Lagi" popover** (one `div`, toggled by "Lagi"): `fixed z-50 right-4 bottom-[calc(45px+env(safe-area-inset-bottom)+8px)] w-56 max-h-[70vh] overflow-y-auto`, white, `rounded-2xl`, `shadow-xl`, `border border-slate-100`. Links grouped under small headings (`px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400`) that match the sidebar's section/group names. Each row: `flex items-center gap-3 px-4 py-3 text-sm text-slate-700`, coloured icon `w-4`, label; the row for the current page uses `bg-indigo-50 text-indigo-600 font-semibold`. Rows are ≥ 44px high (DV-SH-11; live rows measure ≈ 34px). The first four links have no heading; the other headings, links, routes and order are §2.7. It ends with **"Student View"** (`ArrowLeft`, `emerald-600`) → `/dashboard` and **"Log Keluar"** (`LogOut`, `red-600`) → `/logout`, separated by a `border-t`. Closing: a second tap on "Lagi", a tap outside the popover, or following a link (route change). Escape and focus trapping are not added (D10). Reachability of logout is 2 taps (FR-M01-36; DV-SH-02, replicate). Live does not list every sidebar page in the popover (for example "Laporan Eksekutif", "Penajaan" and "Senarai Pengguna" except through the bottom-nav items, the Bilik Duta / Pusat AI / Visi / Killer blocks, "Aktiviti Harian", "Audio KBAT", "Command Center"); a deliberate mobile subset, replicated (§2.7).
- Dashboard stat-card grid drops from 4 columns to **2 columns** at both tablet and mobile (confirmed identical at 768 and 375 from screenshots — the "card grid" breakpoint is `lg`, not `md`, matching the shell's single-breakpoint behaviour).
- **Widths.** 375: logo `h-8`, popover `w-56` (224px) leaves 135px to its left. 768: logo `h-10`, popover keeps `w-56`, anchored right; the bottom nav cells are wider (≈ 154px), icons `text-xl`. 320: bottom nav cells 64px; the longest teacher label "Kirkpatrick" (11 characters at 10px ≈ 58px) must fit, else it truncates with an ellipsis (`truncate` on the label, `min-w-0` on the cell). No horizontal page scroll.

### 2.5 ASCII wireframes — Admin shell

**1280px (desktop, sidebar shown)**
```
┌─────────┬──────────────────────────────────────────────────────────┐
│ LOGO    │ Dashboard                    [CPU 6% RAM 52% DSK 50% ⏱]  │
│ Panel   │ Gambaran Keseluruhan Platform            (AP)  [logout]  │
│ Pentad. ├──────────────────────────────────────────────────────────┤
│         │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐             │
│[Command │  │ Stat 1 │ │ Stat 2 │ │ Stat 3 │ │ Stat 4 │  ...4-up    │
│ Center  │  └────────┘ └────────┘ └────────┘ └────────┘             │
│  LIVE]  │  ┌──────────────────── hero stat card ─────────────────┐ │
│Aktiviti │  │ Battle Arena — PvP Quiz Battles           [ico][ico]│ │
│Audio KB │  └───────────────────────────────────────────────────┘ │
│ HARIAN  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐             │
│ Dashbrd │  │ ...    │ │ ...    │ │ ...    │ │ ...    │             │
│ Lap.Eks │  └────────┘ └────────┘ └────────┘ └────────┘             │
│ ANALITIK│                                                          │
│ Analitik│                                                          │
│ Monitor │                                                          │
│ >KIRKP. │                                                          │
│ Laporan │                                                          │
│PENGURUS.│                                                          │
│ >KURIK. │                                                          │
│ >SOALAN │                                                          │
│ >PENGG. │                                                          │
│  ...    │                                                          │
│ [scroll]│                                                          │
│─────────│                                                          │
│(AP) Nama│                                                          │
│ Admin   │                                                          │
│  [logout]│                                                          │
└─────────┴──────────────────────────────────────────────────────────┘
 256px fixed sidebar        main content, w-[95%], fluid, no max-width
```

**768px (tablet — mobile shell)**
```
┌────────────────────────────────────────────┐
│ Dashboard                        [LOGO]     │
│ Gambaran Keseluruhan Platform                │
├────────────────────────────────────────────┤
│ ┌───────────────┐ ┌───────────────┐         │
│ │ Soalan Aktif  │ │ Diluluskan    │  2-up   │
│ └───────────────┘ └───────────────┘         │
│ ┌───────────────┐ ┌───────────────┐         │
│ │ Menunggu Rev. │ │ Draf          │         │
│ └───────────────┘ └───────────────┘         │
│  ...                                         │
│ ┌──────────── hero stat card ─────────────┐  │
│ │ Battle Arena — PvP Quiz Battles         │  │
│ └──────────────────────────────────────────┘ │
│  ...                                         │
├────────────────────────────────────────────┤
│ [Dashboard][Soalan][Penaja][Pengguna][Lagi] │  <- bottom nav, no avatar/logout in header
└────────────────────────────────────────────┘
```

**375px (mobile)**
```
┌───────────────────────────┐
│ Dashboard          [LOGO] │
│ Gambaran Keseluruhan...   │
├───────────────────────────┤
│ ┌───────────┐┌───────────┐│
│ │Soalan Akt.││Diluluskan ││  2-up
│ └───────────┘└───────────┘│
│ ┌───────────┐┌───────────┐│
│ │Menunggu R.││Draf       ││
│ └───────────┘└───────────┘│
│  ...                      │
│ ┌───────── hero ─────────┐│
│ │ Battle Arena           ││
│ └────────────────────────┘│
│  ...                      │
├───────────────────────────┤
│[Dash][Soalan][Penaja][Pgn]│
│         [Lagi]            │
└───────────────────────────┘

"Lagi" tapped → popover overlay:
┌───────────────────────────┐
│              ┌───────────┐│
│              │ Analitik  ││
│              │ Lap.Aktiv.││
│              │ Monitoring││
│              │ Kirkpatr. ││
│              │ SPM       ││
│              │ Databank  ││
│              │  ...      ││
│              │ [scroll]  ││
│              │───────────││
│              │ Student   ││
│              │ View      ││
│              │ Log Keluar││
│              └───────────┘│
│[Dash][Soalan][Penaja][Pgn]│
└───────────────────────────┘
```

### 2.6 Teacher variant of the admin shell (OD-R5; M11 S2–S5, M12 S1–S8)

Decision recorded from OD-R5 (recommended option): F-18 stays in Release 1.0 and the teacher gets **its own menu inside the admin chrome**. Nothing was observed for this case, so every value below is **PROPOSED** (built from the observed teacher menu and the observed admin chrome) and is listed in §2.10. The teacher never sees an admin item; FR-G-04 (hidden, not disabled) and the route guard (`/admin/*` is denied) still apply.

| Part | Admin | Teacher (PROPOSED) |
|---|---|---|
| Routes | §1.2 | `/guru/monitoring*` (M11 S2–S5), `/guru/kirkpatrick*` (M12 S1–S8; S8 is admin-only) |
| Caption under the logo | "Panel Pentadbir" | "Portal Guru" (the tab-title suffix of the teacher pages, M11 S1/S6) |
| Logo link | `/admin` | `/guru` (Dashboard Guru, user shell) |
| Pinned block | Command Center + Aktiviti Harian + Audio KBAT | Command Center only → `/guru/command-center` (`_blank`, LIVE); it is the first entry of the observed teacher menu |
| Sidebar sections and items | §2.7 | The teacher's own menu, table below. It is **the same data** as the user-shell teacher menu (`USER_NAV` filtered by `navFor('teacher', 'sidebar')`): one definition, two renderings (DV-SH-04 extended). F-18 must import it, not copy it |
| Item rendering | admin item style | admin item style for every teacher entry (`nav-item px-4 py-2.5`, icon `w-5`), including the Pusat AI block and the "Audio KBAT" entry, which the user shell draws smaller. Badges keep their class strings from the data. Hover tooltips (`tip`) are not rendered: the admin shell has none |
| Collapsible groups | 12 keys | 1: `kirkpatrick` (items: Ringkasan, T1: Reaksi, T2: Pembelajaran, T3: Tingkah Laku, T4: Hasil, Rantaian Impak, Intervensi, with the teacher data's labels and icons) |
| Footer links | Tetapan Peribadi, Ke Dashboard | None. "Tetapan Peribadi" and "Profil Saya" are already menu items; a teacher has no student view |
| User block | name, role "Admin" | name, role "Guru" |
| Header right side ≥ `lg` | pill, avatar, logout | avatar, logout. **No server-status pill**: `GET /api/admin/server-status` answers 403 to a teacher (FR-M17-06, SEC-M17-10) and the widget would be an infrastructure disclosure |
| Bottom nav < `lg` | Dashboard, Soalan, Penaja, Pengguna, Lagi | Guru, Kelas, Monitoring, Kirkpatrick, Lagi (below) |
| "Lagi" popover | admin subset, ends "Student View", "Log Keluar" | teacher list (below), ends "Log Keluar" only |
| Tab title, header title and subtitle | set by the module per screen | same (M11/M12 values are exact) |

**Teacher sidebar, top to bottom** (label → route; the order is `user-nav.ts`; hrefs marked INFERRED there stay INFERRED)

| Section (heading colour) | Items |
|---|---|
| Pinned | Command Center (`SatelliteDish`, LIVE) → `/guru/command-center` |
| `HARIAN` (teal) | Dashboard Guru → `/guru` (exact); Headcount → `/headcount`; Misi Harian → `/guru/misi-harian`; Soalan by Chapter → `/practice/chapter`; Verify Soalan Struktur → `/guru/verify-soalan-struktur`; Verify Soalan MCQ → `/guru/verify-soalan-mcq`; Kelas Saya → `/guru/kelas`; Pelajar Saya → `/guru/pelajar`; Kehadiran Digital → `/guru/kehadiran-digital` |
| `PENGAJARAN` (blue) | Jadual Belajar → `/guru/jadual-belajar`; Broadcast → `/guru/broadcast`; Kelas Live → `/guru/live-kelas` |
| `PENILAIAN` (amber) | Prestasi → `/prestasi/kelas`; Laporan → `/guru/laporan`; Amaran Awal → `/amaran` |
| `ANALITIK` (indigo) | Monitoring → `/guru/monitoring`; **Kirkpatrick** (group: Ringkasan → `/guru/kirkpatrick`, T1: Reaksi → `…/reaction`, T2: Pembelajaran → `…/learning`, T3: Tingkah Laku → `…/behavior`, T4: Hasil → `…/results`, Rantaian Impak → `…/chain`, Intervensi → `…/interventions`); Analitik Adaptif → `/analitik/pelajar`; Analisa Item → `/analisa-item`; Perbandingan Kelas → `/guru/perbandingan-kelas`; Laporan Mingguan → `/guru/laporan-mingguan-kelas` |
| `PUSAT AI` (gradient heading, NEW) | `🤖 Cikgu Alesa AI`: Cikgu Alesa Chat (AI) → `/cikgu`. `✨ Visi & Pertandingan`: Sekolah Bersaing (NEW) → `/sekolah-bersaing`; Tetapan Peribadi → `/tetapan`. `🤖 AI Pintar (Pelajar)`: Wellbeing Alerts → `/wellbeing/alerts`; Kamus AI → `/pusat-ai/kamus`; Pendamping Motivasi → `/pusat-ai/pendamping`; Doa & Motivasi → `/pusat-ai/doa`. `🎯 AI Pintar (Guru)`: Aktiviti Advisor → `/pusat-ai/aktiviti`; Whiteboard → Quiz → `/pusat-ai/whiteboard`; RPH (Cikgu Alesa) → `/cikgu/rph`; Semak Karangan (Cikgu Alesa) → `/cikgu/essay`; PBD (Cikgu Alesa) → `/cikgu/pbd` |
| `BANK SOALAN` (emerald) | Sumbang Soalan → `/guru/soalan`; Soalan & Rujukan → `/guru/soalan-guru`; Soalan Berstruktur → `/guru/soalan-berstruktur`; Databank Soalan → `/guru/databank`; Set Soalan → `/guru/set-soalan`; Audio KBAT → `/audio-kbat`; Kertas Peperiksaan → `/guru/kertas-peperiksaan`; Penjana Peperiksaan → `/guru/penjana-peperiksaan` |
| `AKTIVITI` (purple) | Liga Pertandingan → `/liga`; Tournament → `/tournament`; Kombo → `/kombo`; Syiling & Ganjaran → `/guru/gamifikasi` |
| `LAIN-LAIN` (slate) | Perutusan → `/perutusan`; Video → `/video`; Sumbang Artikel → `/guru/artikel`; Profil Saya → `/profile`; Panduan → `/panduan`; Analisis Item → `/guru/analisis-item` |
| `BANTUAN` (red) | Tiket Bantuan → `/pusat-tuisyen/tiket`; Gambar Rajah (badge "6,144") → `/admin/soalan-gambar` (open item, §7.2) |

**Teacher bottom nav (< `lg`), 5 items** — same styling as §2.4:

| # | Label | Icon (FA → Lucide) | Route | Active on |
|---|---|---|---|---|
| 1 | Guru | `fa-chart-pie` → `ChartPie` | `/guru` | exactly `/guru` |
| 2 | Kelas | `fa-chalkboard-teacher` → `Presentation` | `/guru/kelas` | `/guru/kelas*` |
| 3 | Monitoring | `fa-binoculars` → `Binoculars` | `/guru/monitoring` | `/guru/monitoring*` (M11 S2–S5) |
| 4 | Kirkpatrick | `fa-microscope` → `Microscope` | `/guru/kirkpatrick` | `/guru/kirkpatrick*` (M12 S1–S8) |
| 5 | Lagi | `fa-ellipsis-h` → `Ellipsis` | button | while open |

**Teacher "Lagi" popover.** Generated from the same teacher data: every sidebar entry **except** (a) the pinned Command Center (as on the admin popover, which omits Command Center and Aktiviti Harian) and (b) the entries already in the bottom nav (Dashboard Guru, Kelas Saya, Monitoring, the Kirkpatrick group; the sub-pages T1 to Intervensi stay reachable from the Kirkpatrick overview cards, M12 S1). Headings are the sidebar's section and sub-heading labels; "Kirkpatrick" is not repeated. The popover ends with a `border-t` and **"Log Keluar"** → `/logout`. Row height ≥ 44px; the list scrolls inside `max-h-[70vh]`.

**Teacher wireframes**

1280px (sidebar shown; the header has no pill)
```
┌─────────┬──────────────────────────────────────────────────────────┐
│ LOGO    │ Monitoring Penglibatan                       (AM) [logout]│
│ Portal  │ {subtitle of M11 S2}                                     │
│ Guru    ├──────────────────────────────────────────────────────────┤
│[Command │  ┌────────────── M11 S2 content ──────────────────────┐  │
│ Center  │  │ (module-owned; table scrolls inside its own card)  │  │
│  LIVE]  │  └────────────────────────────────────────────────────┘  │
│ HARIAN  │                                                          │
│ Dash.Gu │                                                          │
│ Headcnt │                                                          │
│ ...     │                                                          │
│ ANALITIK│                                                          │
│ Monitor │  <- active (gradient pill)                               │
│ >KIRKP. │                                                          │
│ Analit. │                                                          │
│ ...     │                                                          │
│ [scroll]│                                                          │
│─────────│                                                          │
│(AM) Nama│                                                          │
│ Guru    │                                                          │
│ [logout]│                                                          │
└─────────┴──────────────────────────────────────────────────────────┘
```
The title is the M11 S2 header (module-owned, FR-M11-02); the subtitle is shown as a placeholder.

768px and 375px (bottom nav, "Lagi" open)
```
┌───────────────────────────┐
│ Monitoring Penglibatan [LG]│
│ {subtitle of M11 S2}       │
├───────────────────────────┤
│ (M11 S2 content)          │
│  ...                      │
│ © 2026 PRESTASIPLUS...    │
│         ┌───────────────┐ │
│         │ HARIAN        │ │
│         │ Headcount     │ │
│         │ Misi Harian   │ │
│         │ ...           │ │
│         │ ANALITIK      │ │
│         │ Analitik Adap.│ │
│         │ ...  [scroll] │ │
│         │───────────────│ │
│         │ Log Keluar    │ │
│         └───────────────┘ │
├───────────────────────────┤
│[Guru][Kelas][Monit][Kirk][Lagi]│
└───────────────────────────┘
```

### 2.7 Admin menu — full list

Source: `SHA-admin-shell.json` (M01, desktop and "Lagi" states), OBSERVED unless marked. **Route** is the app path (live origin dropped). **Icon** is the live FA name; the Lucide name is in §2.9. **Colour** is the icon colour class: (O) = read from a screenshot or an SRS, otherwise INFERRED from the same icon in `user-nav.ts` or from the cyclic palette (design-system §1.2). **Lagi** = where the item appears in the mobile popover (heading › label if different), "—" = not in the popover. Sub-items of a group have no colour (all `slate-400`, §2.2).

**Pinned**

| Label | Route | Icon | Notes | Lagi |
|---|---|---|---|---|
| Command Center | `/admin/command-center` | `fa-satellite-dish` | Card, LIVE, `_blank` | — |
| Aktiviti Harian | `/admin/command-center/daily-activity` | `fa-chart-line` | emerald, `_blank` | — |
| Audio KBAT | `/admin/audio-kbat` | `fa-headphones` | amber | — |

**HARIAN**

| Label | Route | Icon | Colour | Lagi |
|---|---|---|---|---|
| Dashboard | `/admin` (exact) | `fa-tachometer-alt` | `indigo-500` | bottom nav |
| Laporan Eksekutif | `/admin/laporan-eksekutif` (also `…/sekolah/{id}`, S9) | `fa-file-alt` | `slate-500` (O) | — |

**ANALITIK**

| Label | Route | Icon | Colour | Lagi |
|---|---|---|---|---|
| Analitik | `/admin/analytics` | `fa-chart-pie` | `fuchsia-500` (O) | first block (no heading) |
| Monitoring | `/admin/monitoring` (alias `/guru/monitoring`) | `fa-binoculars` | `teal-500` (O) | first block |
| Kirkpatrick (group `kirkpatrick`, icon `fa-microscope`, `cyan-500` (O)) | | | | Lagi: one link "Kirkpatrick" → `/admin/kirkpatrick`, `cyan-500` (O), first block |
| — Overview | `/admin/kirkpatrick` (exact; alias `/guru/kirkpatrick`) | `fa-th-large` | | |
| — T1: Reaksi | `/admin/kirkpatrick/reaction` | `fa-smile` | | |
| — T2: Pembelajaran | `/admin/kirkpatrick/learning` | `fa-brain` | | |
| — T3: Tingkah Laku | `/admin/kirkpatrick/behavior` | `fa-running` | | |
| — T4: Hasil | `/admin/kirkpatrick/results` | `fa-trophy` | | |
| — Rantaian Impak | `/admin/kirkpatrick/chain` | `fa-link` | | |
| — Intervensi | `/admin/kirkpatrick/interventions` | `fa-hand-holding-medical` | | |
| Laporan | `/admin/laporan` | `fa-chart-bar` | `orange-500` (O) | "Laporan Aktiviti", first block, `orange-500` (O) |

Each Kirkpatrick sub-item also matches its `/guru/kirkpatrick…` twin (FR-M12-04). "Overview" is exact-only, so it is not active on the T1 to Intervensi pages or on `…/pelajar/{id}` (S8: group open, no item active, INFERRED).

**PENGURUSAN** (five groups)

| Group (key, icon, colour) | Item → route (icon) | Lagi |
|---|---|---|
| Kurikulum (`kurikulum`, `fa-sitemap`, `teal-500` (O)) | Kurikulum → `/admin/curriculum` (`fa-sitemap`); Subjek → `/admin/subjects` (`fa-book`); Tahap Pendidikan → `/admin/education-levels` (`fa-graduation-cap`) | heading KURIKULUM: the same three, colours `teal-500` (O), `indigo-500`, `purple-500` |
| Soalan (`soalan`, `fa-question-circle`, `amber-500` (O)) | Senarai Soalan → `/admin/questions` (`fa-list`); Import CSV → `/admin/questions/import` (`fa-file-csv`); Kualiti Soalan → `/admin/questions/quality` (`fa-clipboard-check`); Laporan Soalan → `/admin/question-reports` (`fa-flag`); Soalan Berstruktur → `/admin/structured-questions` (`fa-list-ol`); Kertas Soalan Guru → `/admin/question-submissions` (`fa-file-upload`) | heading SOALAN: all except "Senarai Soalan" (it is the bottom-nav "Soalan"). Colours: Import CSV `indigo-500` (O), Kualiti Soalan `teal-500` (O), Laporan Soalan `red-500` (O), Soalan Berstruktur `cyan-500` (O), Kertas Soalan Guru `blue-500` (O) |
| Pengguna (`pengguna`, `fa-users`, `violet-500` (O)) | Senarai Pengguna → `/admin/users` (`fa-users`); Sekolah → `/admin/schools` (`fa-school`); Langganan Sekolah → `/admin/school-subscriptions` (`fa-file-contract`); Import Pelajar → `/admin/import-students` (`fa-user-plus`); Pelajar Komplimen → `/admin/comp-students` (`fa-gift`); Import Pengguna → `/admin/users/bulk-import` (`fa-users-cog`); Penajaan → `/admin/sponsors` (`fa-handshake`); Anak Angkat → `/admin/anak-angkat` (`fa-child`); Permohonan → `/admin/anak-angkat/permohonan` (`fa-file-alt`) | Not a heading. "Senarai Pengguna" and "Penajaan" are the bottom-nav items "Pengguna" and "Penaja"; Sekolah, Langganan Sekolah, Import Pelajar and Import Pengguna are under SISTEM. Pelajar Komplimen, Anak Angkat, Permohonan: not in the popover |
| SPM (`spm`, `fa-graduation-cap`, `orange-500`) | Databank Soalan → `/spm/tahun-lepas` (`fa-database`); Latih Tubi → `/spm/latih-tubi` (`fa-bolt`); Tracking A → `/spm/ramalan` (`fa-crosshairs`); Subjektif → `/spm/subjektif` (`fa-pen-fancy`) | heading SPM (first heading in the popover): the same four, `rose-500` (O), `amber-500` (O), `emerald-500` (O), `violet-500` (O) |
| Premium (`premium`, `fa-shield-halved`, `indigo-500`) | PKSK Soalan → `/admin/pksk/questions` (`fa-shield-halved`); PKSK Akses → `/admin/pksk/access` (`fa-key`) | heading PREMIUM: the same two, `indigo-500`, `amber-500` |

**SISTEM** (six groups)

| Group (key, icon, colour) | Item → route (icon) | Lagi |
|---|---|---|
| Gamifikasi (`gamifikasi`, `fa-gamepad`, `purple-500`) | Overview → `/admin/gamification` (`fa-gamepad`); Tier Config → `/admin/gamification/tiers` (`fa-crown`); Cabaran → `/admin/gamification/challenges` (`fa-bullseye`); Pelajar → `/admin/gamification/students` (`fa-users`); Transaksi → `/admin/gamification/transactions` (`fa-receipt`); Kedai Hadiah → `/admin/hadiah` (`fa-gift`); Gamifikasi Guru → `/admin/gamifikasi/guru` (`fa-chalkboard-teacher`); Kawalan Reward → `/admin/reward-control` (`fa-shield-halved`) | heading GAMIFIKASI: Overview `purple-500`, Tier Config `amber-500`, Cabaran `emerald-500`, Kedai Hadiah `pink-500` (O, M15), Gamifikasi Guru `amber-500`. Pelajar, Transaksi, Kawalan Reward: not in the popover |
| Battle & Permainan (`battle`, `fa-bolt`, `red-500`) | Battle Live → `/battle` (`fa-bolt`); Ranking Sekolah → `/battle/ranking-sekolah` (`fa-school`); Leaderboard → `/battle/leaderboard` (`fa-trophy`); Tetapan Permainan → `/admin/permainan` (`fa-dice`) | heading BATTLE & PERMAINAN: Battle Live `red-500` (O, M16), Tetapan Permainan `emerald-500` (O, M16) |
| Marketplace (`marketplace`, `fa-shopping-bag`, `emerald-500`) | Produk → `/admin/marketplace/products` (`fa-shopping-bag`); Penjual → `/admin/marketplace/sellers` (`fa-store`) | heading MARKETPLACE: the same two, `emerald-500`, `orange-500` |
| Kandungan (`kandungan`, `fa-newspaper`, `pink-500`) | Banner → `/admin/banners` (`fa-image`); Artikel → `/admin/articles` (`fa-newspaper`); Nota → `/admin/notes` (`fa-sticky-note`); Push Notifikasi → `/admin/notifications` (`fa-bell`); Upload Screenshot → `/admin/tools/screenshots` (`fa-cloud-upload-alt`) | heading KANDUNGAN: Banner `pink-500`, Artikel `orange-500`, Nota `yellow-500`, Push Notifikasi `amber-500`, **Chatbot** → `/admin/chatbot` (`fa-robot`, `purple-500`), Upload Screenshot `blue-500`. (The popover lists Chatbot here; the sidebar lists it under Sistem, below) |
| Kewangan (`kewangan`, `fa-credit-card`, `blue-500`) | Pembayaran → `/admin/payments` (`fa-credit-card`); Billing Dashboard → `/admin/billing` (`fa-chart-line`); Dunning Log → `/admin/dunning` (`fa-bell-slash`) | in the popover these three are under SISTEM, after "Tetapan" |
| Sistem (`sistem`, `fa-cog`, `slate-500`) | Performance → `/admin/performance` (`fa-gauge-high`); Tetapan → `/admin/settings` (`fa-cog`); Log Audit → `/admin/audit-logs` (`fa-clipboard-list`); Chatbot → `/admin/chatbot` (`fa-robot`) | heading SISTEM, in this order: Sekolah `indigo-500`, Langganan Sekolah `emerald-500`, Tetapan `slate-500`, Pembayaran `teal-500`, Billing Dashboard `emerald-500`, Dunning Log `red-500`, Log Audit `slate-500`, Performance `orange-500`, Import Pelajar `blue-500`, Import Pengguna `violet-500` (routes as above) |

**Sections after SISTEM** (all items are top-level rows; the icon colour is INFERRED from `user-nav.ts` for the same item, marked (i))

| Section (heading) | Items → route (icon, colour) | Lagi |
|---|---|---|
| `🏆 BILIK DUTA` + DEV | Bilik Duta → `/bilik-duta` (`fa-crown`, `amber-500`); Akademi Duta → `/akademi-duta` (`fa-graduation-cap`, `purple-500`); Permohonan Duta → `/admin/duta-applications` (`fa-clipboard-check`, `teal-500`); Duta Dashboard → `/duta-dashboard` (`fa-user-tie`, `indigo-500`); Jemput Duta → `/jemput-duta` (`fa-school`, `pink-500`); Kem & Bootcamp → `/bilik-duta/kem` (`fa-campground`, `rose-500`) | — |
| `🤖 PUSAT AI` | Kamus AI → `/pusat-ai/kamus` (`fa-book-open`, `cyan-600`); Aktiviti Advisor → `/pusat-ai/aktiviti` (`fa-lightbulb`, `green-600`); Pendamping Motivasi → `/pusat-ai/pendamping` (`fa-heart`, `purple-600`); SPM Walkthrough → `/pusat-ai/spm` (`fa-pen-to-square`, `rose-600`); Whiteboard → Quiz → `/pusat-ai/whiteboard` (`fa-clipboard-question`, `blue-600`); Parent Whisperer → `/pusat-ai/parent-whisperer` (`fa-comments`, `teal-600`); Doa & Motivasi → `/pusat-ai/doa` (`fa-mosque`, `emerald-600`) | — |
| `✨ VISI & PERTANDINGAN` | Profil Cerah → `/profil-cerah` (`fa-magic`, `indigo-500`); Sekolah Bersaing → `/sekolah-bersaing` (`fa-trophy`, `amber-500`); Cita-Cita Hijrah → `/cita-cita` (`fa-star`, `pink-500`); Streak / Kombo → `/kombo` (`fa-fire`, `orange-500`) | — |
| `💎 KILLER FEATURES` | Cikgu Suara → `/cikgu-suara` (`fa-microphone`, `fuchsia-500`); SPM Mock Exam → `/spm-mock` (`fa-file-pen`, `orange-700`); Wellbeing Alerts → `/wellbeing/alerts` (`fa-triangle-exclamation`, `red-500`) | — |

Popover order (OBSERVED): first block Analitik, Laporan Aktiviti, Monitoring, Kirkpatrick; then headings SPM, SOALAN, KURIKULUM, PREMIUM, GAMIFIKASI, BATTLE & PERMAINAN, KANDUNGAN, MARKETPLACE, SISTEM; then Student View, Log Keluar. The popover order of headings differs from the sidebar; it is replicated as observed (mobile subset, DV-SH-05 reasoning: it works).

**Not touched (replicate):** the labels "Laporan" (sidebar) and "Laporan Aktiviti" (popover) for `/admin/laporan`; "Overview" for the Kirkpatrick index and the Gamifikasi index; "Chatbot" listed under KANDUNGAN in the popover and under Sistem in the sidebar; the popover being a subset of the sidebar.

### 2.8 Nav data contract (`src/shells/nav/admin-nav.ts`) and active-state rules

- **One list per menu.** `ADMIN_NAV` is one ordered list of sections, groups and items with the same entry kinds as `user-nav.ts` (`section`, `item`, `group`), plus: `group` key (for `admin_sidebar`), `exact?: boolean`, `alias?: string[]` (extra path prefixes that also activate the item), `lagi?: { heading: string; label?: string; colour?: string; order: number }` (placement in the popover; absent = not in the popover), `bottomNav?: boolean`. The sidebar, the popover and the bottom nav render from it. The teacher list is `navFor('teacher', 'sidebar')` of `user-nav.ts` and a small `TEACHER_BOTTOM_NAV` constant (§2.6); the popover for the teacher is derived by the rule in §2.6, not stored twice.
- **Role selection.** `adminMenuFor(role)`: `admin` → `ADMIN_NAV`; `teacher` → the teacher list; any other role → that role's own `navFor(role, 'sidebar')` (§1.4).
- **Active item.** A path activates an item when it equals the item's `to` or an `alias`, or lies below it at a `/` boundary. `exact` items (`/admin`, `/guru`, Overview / Ringkasan of Kirkpatrick) match only themselves. If several items match, the longest match wins and **only one** item is active (menu order breaks ties). Aliases: Monitoring `/admin/monitoring` and `/guru/monitoring` (FR-M11-05); every Kirkpatrick item its `/admin/kirkpatrick…` and `/guru/kirkpatrick…` forms (FR-M12-04); Laporan Eksekutif also `/admin/laporan-eksekutif/sekolah/{id}` (S9, FR-M17-04). The popover row and the bottom-nav item use the same rule (FR-M17-04 "Lagi twin").
- The user shell's `isActivePath` (F-19) marks every item whose route is a prefix (so "Dashboard Guru" `/guru` is also active on `/guru/monitoring`). The admin shell does not reuse that behaviour: it needs the longest-match rule above. (The user shell is F-19's; §7.2 records the difference.)

### 2.9 Icon audit (design-system §6)

Every FA name in §2.6 and §2.7 has a row in design-system §6, except the 21 below, which were **missing** in v1.9 and are **added in design-system v1.10** (same Lucide components that `src/shells/shared/shell-icons.ts` already uses as fallbacks; the three new names were checked against `@lucide/vue` 1.48). F-14 adds the same rows to `fa-to-lucide.ts` and then the fallback table in `shell-icons.ts` is dead code (its unit test reports it).

| FA class | Lucide | Used by |
|---|---|---|
| `fa-crosshairs` | `Crosshair` | admin SPM "Tracking A" |
| `fa-dice` | `Dice5` | admin "Tetapan Permainan" |
| `fa-gauge-high` | `Gauge` | admin "Performance" (FA6 name of `fa-tachometer-alt`) |
| `fa-hand-holding-medical` | `HandHelping` (approx) | Kirkpatrick "Intervensi" (admin and teacher) |
| `fa-campground` | `Tent` | admin "Kem & Bootcamp" |
| `fa-pen-to-square` | `SquarePen` | admin "SPM Walkthrough" |
| `fa-clipboard-question` | `FileQuestionMark` (approx) | "Whiteboard → Quiz" (admin and teacher) |
| `fa-microphone` | `Mic` | admin "Cikgu Suara" |
| `fa-triangle-exclamation` | `TriangleAlert` | "Wellbeing Alerts" |
| `fa-tasks` | `ListChecks` | teacher "PBD (Cikgu Alesa)" |
| `fa-life-ring` | `LifeBuoy` | "Tiket Bantuan" |
| `fa-headset` | `Headset` | "Urus Tiket" (admin, user shell) |
| `fa-exchange-alt`, `fa-medal`, `fa-compass` | `ArrowLeftRight`, `Medal`, `Compass` | student items (user shell) |
| `fa-building-flag`, `fa-ranking-star`, `fa-map-location-dot`, `fa-file-export` | `Landmark` (approx), `Award` (approx), `MapPinned`, `FileOutput` | PPD / JPN items (user shell) |
| `fa-door-open`, `fa-table-cells` | `DoorOpen`, `Grid3x3` | school-admin items (user shell) |

All other icons are existing rows: for example `fa-tachometer-alt` `Gauge`, `fa-question-circle` `CircleQuestionMark`, `fa-th-large` `LayoutGrid`, `fa-users-cog` `UsersRound`, `fa-shield-halved` `Shield`, `fa-user-tie` `UserRound`, `fa-chalkboard-teacher` `Presentation`, `fa-bell-slash` `BellOff`, `fa-credit-card` `CreditCard`, `fa-shopping-bag` `ShoppingBag`, `fa-microscope` `Microscope`, `fa-broadcast-tower` `RadioTower`, `fa-file-upload` `FileUp`.

### 2.10 Provisional decisions (the teacher in the admin chrome was never observed)

| # | Decision | Basis | If wrong |
|---|---|---|---|
| P-1 | The teacher's admin-chrome menu is the user-shell teacher menu (one data definition) | OD-R5 recommendation; shells v1.1 §1 "each role sees only its own menu content"; roles-matrix/guru | Swap the data; no chrome change |
| P-2 | Kirkpatrick group labels for the teacher are "Ringkasan / T1: Reaksi …" (teacher data), not the admin's "Overview" | Teacher data in `user-nav.ts` (FR-M12-03) | Rename in the teacher data |
| P-3 | Caption "Portal Guru", logo → `/guru`, role label "Guru" | M11 S1/S6 tab suffix "Portal Guru" | Copy change |
| P-4 | Teacher bottom nav: Guru, Kelas, Monitoring, Kirkpatrick, Lagi | Built from the four teacher routes that use this chrome (and the teacher's home) | Swap items in `TEACHER_BOTTOM_NAV` |
| P-5 | Teacher "Lagi" = teacher menu minus Command Center and bottom-nav duplicates, ends with Log Keluar only | Same construction as the observed admin popover | Filter change |
| P-6 | No server-status pill and no tooltips for the teacher | FR-M17-06 / SEC-M17-10 (403); the admin shell has no nav tooltips | none |
| P-7 | Active group opens on route change (SPA), user can then collapse it | Live opens it on page load | Behaviour only |
| P-8 | Active sub-item style = the top-level active pill; server-status pill loading and error display ("--", keep last values); popover width `w-56` at 768 | Not visible in the captures | Style only |

### 2.11 Interaction, states and copy (admin shell)

| State | Behaviour and copy |
|---|---|
| Loading a route (lazy chunk) | Sidebar/header/bottom nav stay; `main` shows the shared shell loading state (M01) |
| Page error / 404 / 403 | The standalone 404/403 pages replace the whole shell (bare), except the M11/M12 in-place denials, which are the modules' |
| Session lost | `/login` (M01 guard) |
| Sidebar overflow | The `aside` scrolls (`overflow-y-auto`); the user block is the last child of the scroll content, not fixed (`min-h-full flex-col` column, same as §2.2 item 12; INFERRED, no positioning data in the inventory) |
| Group toggle | Click/Enter/Space on the `button`; chevron rotates; state saved |
| "Lagi" open | The popover opens above the bottom nav; scrolling inside it does not scroll the page behind (`overscroll-contain`) |
| Logout | Plain navigation to `/logout`; no confirmation (live) |
| Copy | All labels are literal live Bahasa Melayu (or English where live is English: "Student View", "Overview", "Tier Config", "Battle Live", "Command Center"). Not translated. There is no separate English copy: the app is not bilingual |
| Focus order | Sidebar (top to bottom) → header (logout) → main → footer strip; below `lg`: header → main → footer strip → bottom nav (DOM order of live) |

### 2.12 Responsive and accessibility checklist (admin shell, F-18 acceptance)

- [ ] 320, 375, 768: no horizontal page scroll; sidebar not rendered; header (title + logo) does not wrap the logo below the title; long titles ellipsis.
- [ ] 1024 and 1280: sidebar 256px, main offset 256px, header pill (admin only), no bottom nav, no footer strip.
- [ ] Bottom nav: 5 cells, each ≥ 44px wide and 45px high, labels do not overflow at 320 (ellipsis), safe-area padding present, `main` bottom padding clears it.
- [ ] "Lagi": rows ≥ 44px, list scrolls inside the popover, the last row "Log Keluar" is reachable at 320×568.
- [ ] Teacher on `/guru/monitoring` and `/guru/kirkpatrick` (account 5): admin chrome, teacher menu, no admin item present in the DOM, no pill, no request to `/api/admin/server-status`.
- [ ] Admin on the same routes: admin menu, Monitoring / Kirkpatrick items active (FR-M11-05, FR-M12-04).
- [ ] Exactly one active item per menu, at every width.
- [ ] Contrast (WCAG 2.2 AA, checked): `slate-500` `#64748B` on white 4.8:1; indigo-600 `#4F46E5` on white 6.3:1; white on the `gradient-primary` active pill 3.7:1 at the `#3B82F6` stop, 4.5:1 at `#6366F1`, 4.2:1 at `#8B5CF6` (below 4.5:1 for the 14px label; replicated from live, D10, §7.2 item 5). `slate-400` `#94A3B8` on white is 2.6:1 (inactive bottom-nav labels, popover headings, sub-item icons): replicated from live (D10); see §7.2 item 5.
- [ ] Keyboard: every link and button is reachable in DOM order with the browser default focus ring (D10); no extra ARIA beyond live.
- [ ] Reduced motion: no motion added; live's `prefers-reduced-motion` handling only.

---

## 3. User portal shell (every route not assigned to the admin shell in §1.2: student, teacher, school_admin, parent, sponsor, PPD, JPN, and admin on the user-shell pages)

Built in F-19 (`src/shells/user/**`, `src/shells/nav/user-nav.ts`). The teacher and school-admin menus are transcribed from `roles-matrix/*.jpeg`. Their rows in §3.2 point 5 are therefore OBSERVED (student, teacher, school_admin, admin); parent, sponsor, PPD and JPN stay INFERRED.

Screenshots referenced: `user-shell-desktop.png`, `user-shell-tablet.png`, `user-shell-tablet-drawer.png`, `user-shell-mobile.png`.

### 3.1 Structure summary

| Zone | ≥1024px (`lg`) | <1024px |
|---|---|---|
| Sidebar | Fixed 256px, collapsible via hamburger (state in `localStorage["sidebarOpen"]`) | Off-canvas drawer, opened by hamburger |
| Header | Hamburger, title/subtitle, gamification chips, bell, avatar, logout | Bell, hamburger (square, indigo-50), logo — chips move to a strip below the header |
| Chips strip | Inline in header | Separate cream-coloured strip under the header |
| Bottom nav | Not rendered | Fixed, 6 items |
| Footer | White strip, copyright + tagline | Same, at the end of scroll |

### 3.2 Sidebar (≥1024px) — content, top to bottom

1. **Logo**, caption "Platform Latih Tubi Nasional".
2. Nav items (`text-lg` icon, `py-3`, `radius-nav-item`), active = `gradient-primary` (same as admin).
3. **Confirmed top-of-list order from live** (screenshot, admin account): Dashboard, Target SPM, Misi Harian, Remedial, then section rule **SPM** → SPM (SPM badge pill), Headcount, Prestasi, Analitik Adaptif, Analisa Item, Kombo, Laporan (list continues below the fold).
4. **Badges observed on items**: "SPM" (amber pill), "NEW" (colour INFERRED — flagged in design-system §9), "AI" (purple), "DEV" (amber), "PRO" (indigo); emoji badges (🎮 🎟️ 🏆 💎); numeric count badges (e.g. "Gambar Rajah 6,144", "Urus Tiket 2", red).
5. **Section headings observed across the full (role-unfiltered, admin-visible) menu**: `SPM`, `PUSAT AI`, `🤖 CIKGU ALESA AI`, `✨ VISI & PERTANDINGAN`, `🏆 BILIK DUTA · 🔒 PREVIEW`, `🤖 AI PINTAR (PELAJAR)`, `🎯 AI PINTAR (GURU)`, `🛡️ KAWALAN KUALITI`, `💎 KILLER FEATURES`, `PEMBELAJARAN`, `CIKGU ALESA TOOLS`, `PORTAL GURU`, `PPD / JPN`, `ADMIN`, `BANTUAN`. Each section is filtered by role (INFERRED — only the admin account, which sees everything, has been observed; per-role visibility is confirmed module-by-module as each module's SRS documents its permissions matrix).
6. **Footer links**: admin-only "Ke Admin Panel" → `/admin`; "Profil Saya" → `/profile`; "Pakej 💎" → `/pricing`; "Invois Saya"; "Panduan"; "Tiket Bantuan"; then the user block with logout.

### 3.3 Header (≥1024px)

Left → right:
1. Hamburger (`Menu`) — toggles the sidebar collapsed/expanded (persists in `localStorage["sidebarOpen"]`).
2. Page title + subtitle (e.g. "Dashboard" / "Selamat datang kembali").
3. **Gamification chips** (rounded-full, 2px border):
   - "{n} koin" — amber/yellow, `Coins` icon.
   - "{n} mata" — purple, `Star` icon.
   - "{n} hari 🔥" — orange gradient, `Flame` icon (streak; the 🔥 is literal emoji content, kept as-is).
4. **Notification bell** (`Bell`) with red count badge, capped at "99+" → `/notifikasi`. Count from `GET /notifikasi/unread-count` → `{count:number}` (shared with M22).
5. Avatar (initials, ring).
6. Logout icon (`LogOut`) → `/logout`.

### 3.4 Mobile/tablet (<1024px)

- **Header**: title/subtitle (subtitle truncated with ellipsis if long), bell + badge, hamburger (square, `bg-indigo-50 rounded-xl`), logo.
- **Chips strip**: koin / mata / streak move to a thin cream-coloured bar directly under the header, same order as desktop.
- **Drawer** (opened by hamburger): slides in from the left, ~280px wide, dark blurred overlay behind it. Top: logo, close `X`, **user card** (avatar, name, role, cream background). Below: scrolling nav list, active item shown as an indigo-50 pill. "Command Center" (where visible to the role) renders as a dark gradient card with the **LIVE** pill, matching its admin-shell treatment.
- **Bottom nav** (`fixed bottom-0`, safe-area padding), 6 items, coloured icons, active item underlined:
  1. "Home" → `/dashboard`
  2. "SPM" → `/spm`
  3. "Game" → `/permainan`
  4. "Topik" → `/topics`
  5. "Chat" → opens the chatbot widget (not a route)
  6. "Lagi" → opens a menu (structure INFERRED as parallel to the admin "Lagi" popover; not separately screenshotted)
- Content cards stack to 1 column; the desktop "Artikel Terkini" side panel becomes a **horizontal carousel** with dot pagination (`1 / 5` counter observed).

### 3.5 Global widgets (present on every user-shell page, both breakpoints)

- **Chatbot floating action button** (`chatbotWidget()`): auto-hides after 30s idle, stays hidden for the rest of the tab session (`sessionStorage["chatbot_fab_hidden_session"]`); session id in `localStorage["chatbot_session_id"]`; guests get a lead-capture step (name/phone) before chatting, logged-in users skip it; streaming reply (EventSource). Full spec belongs to the chatbot's owning module — this shell doc only registers that the FAB is a shell-level fixture on every user-shell page.
- **Tournament banner** (`tournamentBanner()`): `GET /api/tournament/active`; renders nothing when the array is empty (observed state). Placement: top of the dashboard content area (M05's screen, not the shell chrome itself — noted here because the fetch call is shell-scoped `x-data`).

### 3.6 ASCII wireframes — User portal shell

**1280px (desktop, sidebar shown)**
```
┌─────────┬──────────────────────────────────────────────────────────┐
│ LOGO    │ ☰  Dashboard      [256 koin][8 mata][1 hari🔥] 🔔99+ (AP)⏻│
│ Platform│    Selamat datang kembali                                │
│ Latih   ├──────────────────────────────────────────────────────────┤
│ Tubi    │ ┌───────────── hero gradient card ─────────┐┌Artikel────┐│
│ Nasional│ │ Selamat Pagi, Admin PRESTASI+   🎓        ││ card 1    ││
│         │ │ Jom teruskan latihan hari ini! 🚀         ││ card 2    ││
│ Dashbrd │ └────────────────────────────────────────────┘│ card 3    ││
│ Target  │ ┌── PERCUBAAN PERCUMA — Baki 0/50 [Langgan]─┐│ card 4    ││
│ SPM     │ └────────────────────────────────────────────┘│ card 5    ││
│ Misi    │ ┌────── PROMOTIONAL banner carousel ─────────┐│Lihat Semua││
│ Harian  │ └────────────────────────────────────────────┘└───────────┘│
│ Remedial│                                                             │
│ ─SPM─   │                                                             │
│ SPM[SPM]│                                                             │
│Headcount│                                                             │
│Prestasi │                                                             │
│  ...    │                                                             │
│[scroll] │                                                             │
│─────────│                                                             │
│Ke Admin │                                                             │
│Profil   │                                                             │
│(AP) Nama│                                                             │
│  [logout]│                                                             │
└─────────┴──────────────────────────────────────────────────────────┘
 256px sidebar (collapsible)      main w-[95%]         Artikel side panel
```

**768px (tablet — mobile shell)**
```
┌────────────────────────────────────────────┐
│ Dashboard              🔔99+  [☰]   [LOGO] │
│ Selamat datang kembali                      │
├──────────────────────────────────────────── │
│  💰256 koin   ⭐8 mata   🔥1                 │  <- cream chips strip
├────────────────────────────────────────────┤
│ ┌────────── hero gradient card ───────────┐ │
│ │ Selamat Pagi, Admin PRESTASI+     🎓     │ │
│ └────────────────────────────────────────┘ │
│ ┌── PERCUBAAN PERCUMA — Baki 0/50 [Langgan]┐│
│ └────────────────────────────────────────┘ │
│ ┌──── HERO article carousel ● ● ● ● ○ 1/5 ┐│
│ └────────────────────────────────────────┘ │
├────────────────────────────────────────────┤
│ [Home][SPM][Game][Topik][Chat][Lagi]        │
└────────────────────────────────────────────┘

☰ tapped → drawer overlay (280px):
┌───────────────┬────────────────────────────┐
│ LOGO       [X]│ (blurred/dimmed background) │
│ Platform...    │                             │
│┌──────────────┐│                             │
││(AP) Admin     ││                             │
││   Admin       ││                             │
│└──────────────┘│                             │
│ Dashboard      │                             │
│ ─SPM─          │                             │
│ SPM       [SPM]│                             │
│ Headcount      │                             │
│ Prestasi       │                             │
│ Analisa Item   │                             │
│ Amaran Awal    │                             │
│ Kombo          │                             │
│ Cikgu Alesa[AI]│                             │
│  ...           │                             │
│[Command Center │                             │
│  LIVE]         │                             │
│  ... [scroll]  │                             │
└───────────────┴────────────────────────────┘
```

**375px (mobile)**
```
┌───────────────────────────┐
│ Dashboard       🔔 [☰][LG]│
│ Selamat datang kemb...    │
├───────────────────────────┤
│ 💰256 koin ⭐8 mata 🔥1    │
├───────────────────────────┤
│ ┌──── hero gradient ─────┐│
│ │Selamat Pagi, Admin  🎓 ││
│ │PRESTASI+               ││
│ │Jom teruskan latihan... ││
│ └─────────────────────────┘│
│ ┌── PERCUBAAN PERCUMA ───┐│
│ │ Baki 0/50    [Langgan] ││
│ └─────────────────────────┘│
│ ┌── HERO article ●●●●○1/5┐│
│ └─────────────────────────┘│
│ ┌── Kombo 1 hari akan ───┐│
│ │    putus! ⚠            ││
│ └─────────────────────────┘│
├───────────────────────────┤
│[Home][SPM][Game][Topik]   │
│      [Chat][Lagi]         │
└───────────────────────────┘
```

---

## 4. Guest / public layout (auth pages)

Used by `/login`, `/register`, `/password/reset`, `/password/reset/{token}`, `/password/reset-ic` (router `layout: 'bare'`, the page draws its own card). No sidebar, no header/footer chrome beyond the page's own card + small copyright line.

Two related layouts are **not** this one: the guest **public layout** for `/artikel*` and `/video` (`public-or-user`, F-20, `src/shells/public/**`, specified by M09 SRS FR-M09-29/31/39/82), and the **standalone** screens (Command Centers, 404, 403), which also use `layout: 'bare'` but draw their own full-page design (M10 S2, M17 S2–S7, M18 S11; design-system §7.15). §1.2 lists which routes use them.

### 4.1 Structure

- Full-viewport, `min-h-screen flex items-center justify-center p-3 sm:p-4`, background `bg-auth` (animated 15s gradient shift).
- Floating decorative emoji (`.float-icon`, `floatBounce` 6s, opacity 0.6): 📚 ✏️ ⭐ 🎨 🚀 💡 + a page-specific emoji.
- Decorative SVG wave at the bottom.
- White card: `rounded-2xl sm:rounded-3xl shadow-2xl p-5 sm:p-8 md:p-10`.
- Footer line under the card: "© 2026 PRESTASIPLUS. Platform Pendidikan Malaysia."

### 4.2 Two-column breakpoint — DV-07 (approved D9 fix)

Live switches the login/register pages from 1 column to 2 columns at `md` (768px), which is too narrow for the welcome/marketing panel's content (it gets cramped — a recorded live defect). **Approved fix (DV-07):** the rebuild switches to 2 columns only at **`lg` (1024px)**, matching the shell breakpoint used everywhere else in the app, giving the welcome panel enough room. Below `lg`, the form card is centred, single column, and the welcome/marketing panel (mascot bubble, H2, 3 feature tiles) is **hidden entirely** — not squeezed.

- Container (`lg`+): `max-w-6xl grid lg:grid-cols-2 gap-8 items-center`.
- Left panel (`lg`+ only): mascot bubble (🎓 in a soft-shadow circle), translucent white `rounded-3xl` card with H2 "Selamat Kembali! 👋" (or the register-page equivalent), a dynamic-number paragraph, and 3 pastel feature tiles.
- Right panel: logo, tagline "Platform Latih Tubi Nasional 🇲🇾", the form card, a stats strip ("❓ 128,989+ Soalan • 📚 31 Subjek • 🎓 11 Tahap"), footer line.

### 4.3 Form conventions (see design-system §7.2 for input/button states)

- Native HTML5 validation only (no custom BM client-side messages) — this is a **replicate-live** decision (D10), not a gap.
- Server-side failure shows the shared red alert box (design-system §5) above the fields, generic copy ("Email atau kata laluan tidak sah.") that never reveals whether an account exists.
- Primary submit button: full-width `gradient-cta`, `fa-sign-in-alt`→`LogIn`/`fa-user-plus`→`UserPlus` icon per screen, min-height 48px mobile / 56px desktop, loading state swaps the icon to `Loader2` + a BM "in progress" label and disables the button.
- Password fields include the `Eye`/`EyeOff` toggle.
- The 1-2-3 stepper on `/register` is **decorative only** (not wired to actual step state) — replicate as static decoration, not a functional stepper (per M01 discovery note; nothing to "fix" here since a decorative-but-working element is not broken under D9).

### 4.4 ASCII wireframes — Guest/auth layout (login)

**1280px (desktop, 2 columns)**
```
┌──────────────────────────────────────────────────────────────┐
│              (animated gradient bg, floating emoji)            │
│   ┌─────────────────────┐     ┌─────────────────────────┐    │
│   │  🎓                  │     │  LOGO                    │    │
│   │  Selamat Kembali! 👋 │     │  Platform Latih Tubi...  │    │
│   │  Teruskan pembelaja..│     │  ┌─────────────────────┐ │    │
│   │  ┌──────────────────┐│     │  │✉ Alamat Email       │ │    │
│   │  │🏆 Pencapaian...  ││     │  └─────────────────────┘ │    │
│   │  └──────────────────┘│     │  ┌─────────────────────┐ │    │
│   │  ┌──────────────────┐│     │  │🔒 Kata Laluan     👁 │ │    │
│   │  │📈 Jejak Kemajuan ││     │  └─────────────────────┘ │    │
│   │  └──────────────────┘│     │  ☐ Ingat saya            │    │
│   │  ┌──────────────────┐│     │           Lupa kata lal.?│    │
│   │  │🎯 Latihan Tersus.││     │           🪪 Reset No IC │    │
│   │  └──────────────────┘│     │  ┌─────────────────────┐ │    │
│   └─────────────────────┘     │  │   Log Masuk  →       │ │    │
│                                │  └─────────────────────┘ │    │
│                                │  Belum ada akaun? Daftar │    │
│                                │  ← Kembali ke Laman Utama│    │
│                                └───────────────────────────┘    │
│                    ❓128,989+ Soalan • 📚31 Subjek • 🎓11 Tahap  │
│                       © 2026 PRESTASIPLUS...                   │
│                              (wave svg)                         │
└──────────────────────────────────────────────────────────────┘
```

**768px and 375px (1 column — DV-07: welcome panel hidden below `lg`)**
```
┌───────────────────────────┐
│  (animated gradient bg)   │
│  ┌───────────────────────┐│
│  │  LOGO                 ││
│  │  Platform Latih Tubi..││
│  │ ┌───────────────────┐ ││
│  │ │✉ Alamat Email     │ ││
│  │ └───────────────────┘ ││
│  │ ┌───────────────────┐ ││
│  │ │🔒 Kata Laluan   👁 │ ││
│  │ └───────────────────┘ ││
│  │ ☐ Ingat saya          ││
│  │        Lupa kata lal? ││
│  │        🪪 Reset No IC ││
│  │ ┌───────────────────┐ ││
│  │ │   Log Masuk  →     │ ││
│  │ └───────────────────┘ ││
│  │ Belum ada akaun? Daf. ││
│  │ ← Kembali ke Laman Ut.││
│  └───────────────────────┘│
│  ❓128,989+ • 📚31 • 🎓11  │
│  © 2026 PRESTASIPLUS...   │
│         (wave svg)        │
└───────────────────────────┘
```

---

## 5. Responsive defects on the live shell and their approved fixes

All items are cited from `docs/discovery/00-global-ui.md` §2 ("Responsive defects on the live site — do NOT copy") and the M01/M03 SRS deviation tables. Per D9, only genuinely **broken** items are fixed; everything else replicates live exactly, including patterns that merely look inconsistent but still work.

| ID | Live defect (source) | Classification (D9) | Approved fix |
|---|---|---|---|
| DV-SH-01 | G-D1: `/dashboard` at 768px scrolls sideways (a decorative `w-64 h-64` absolute blob and an unclipped horizontal article carousel push `scrollWidth` to 762 vs a 753 viewport) | Broken — layout/responsive breakage (NFR-RESP-01 violation) | Clip the decorative blob and the article carousel inside `overflow-hidden` containers so neither can expand the page's scroll width. The carousel keeps its horizontal internal scroll (that's the intended card-carousel behaviour); only the page-level overflow is removed. Owned by M05 (dashboard screen), registered here because it's a shell-adjacent regression. |
| DV-SH-02 | G-D2: admin header has no avatar/logout below `lg`; logout is only reachable via bottom nav → "Lagi" → "Log Keluar" | **Not broken — DECIDED (Delivery Lead, 2026-09-25).** Reachable in 2 taps, matches FR-M01-36's specified mobile logout location (last item of the "Lagi" menu). Confirmed final: no IA or logout improvement. | **No fix.** Replicate exactly: admin mobile/tablet header shows title/subtitle + logo only; logout stays inside "Lagi". |
| DV-SH-03 | G-D3: admin header title stays "Dashboard / Selamat datang, Admin" on non-admin pages such as `/tetapan` instead of the page's own title | Broken — wrong/contradictory label (a title that doesn't match the page is a "wrong labels/titles" D9 case) | **DECIDED (Delivery Lead, 2026-09-25) — generalisation accepted, scoped as follows:** the shell derives the header title/subtitle from the **current route**. Pages where live already shows the correct title are unaffected — this rule changes nothing there. It only replaces the wrong fallback ("Dashboard / Selamat datang…") on pages where a module's own SRS already approved that specific fix: M01 DV-13 (`/tetapan`), M04 DV-M04-02 (all M04 admin screens, FR-M04-107), M05 DV-M05-01 (S3/S6/S7/S10/S13), M06 DV-M06-07 (S4/S6/S7/S9/S11–S13), M08 DV-01 (S1/S6/S12/S13 and others), and M10 (pending that module's own design). The shell rule **implements** those per-module DVs as one mechanism; it adds **no new titles** beyond what those modules specify — any admin-shell page not yet covered by an approved module DV keeps its current live title until its own module documents the fix. |
| DV-SH-04 | G-D4: the mobile drawer (user shell) and the desktop sidebar (user shell) show **different items in a different order** (e.g. drawer has "Amaran Awal" and "Command Center"; desktop sidebar shows "Target SPM" and "Misi Harian" at the top) | Broken — contradictory (two different menus for the same role is a "contradictory rules" case, and the live doc's own recommendation is to unify them) | The rebuild uses **one single menu definition** (one ordered list of sections/items, filtered by role) for both the desktop sidebar and the mobile drawer of the user portal shell. The canonical order is assembled incrementally as each module's design doc confirms its menu entry's exact position (see §6); no item is dropped and no item is duplicated between the two renderings. |
| DV-SH-05 | G-D5: the admin `/admin` sidebar is a very long single scroll (~90 links) mixing two different grouping mechanisms (plain section headers vs. collapsible groups) | **Not broken — DECIDED (Delivery Lead, 2026-09-25).** Working (scrolls, groups expand/collapse, active group auto-opens); mixing two grouping conventions is an IA inconsistency, not a functional defect. Confirmed final: no IA cleanup. | **No fix.** Replicate both patterns (plain section headers + collapsible groups) exactly as observed, in the order in §2.2 and §2.7. |
| DV-SH-06 (= M01 DV-01) | Live drawer's settings link points to `/settings`, which is a dead 404 route; `/tetapan` is the real settings page | Broken — dead link (404) | Drawer's "Tetapan" item (cog icon, in the account section) SHALL link to `/tetapan`, matching every other entry point to that screen (approved in M01 SRS). |
| DV-SH-07 (= M01 DV-13) | Admin-shell header on `/tetapan` shows "Dashboard" / "Selamat datang, Admin" instead of a title matching that page | Broken (subset of DV-SH-03, called out separately because it's the specific case already approved in M01's own G1) | Header reads "Tetapan Peribadi" with **no subtitle** on `/tetapan` for an admin user. Already covered by the general fix in DV-SH-03; listed here for direct traceability to the approved M01 deviation ID. |
| DV-SH-08 (= M01 DV-07) | Login/register pages switch to 2 columns at `md` (768px), which crams the welcome panel | Broken — layout/responsive breakage at a specific width | See §4.2: switch to 2 columns at `lg` (1024px) instead of `md`. |
| DV-SH-09 (= M01 DV-08) | `/tetapan` (personal settings) does not stack cleanly below `sm` (640px) on live | Broken — layout/responsive breakage | `/tetapan`'s content stacks to a single column below `sm` (640px); owned by M01's own screen spec, registered here for shell-breakpoint consistency since `/tetapan` is reachable from both shells. |
| DV-SH-10 (documentation only) | v1.1 §1 assigned `/guru/*`, `/ppd/*` and `/jpn/*` to the admin shell and put six sidebar groups under `PENGURUSAN`. Both contradict the approved SRS route tables and the M01 admin-shell inventory | Not a live behaviour. A contradiction inside this document | Corrected in §1 and §2.2 (v1.2). No rebuild behaviour differs from live |
| DV-SH-11 | Admin "Lagi" popover rows measure about 34px high on live (`admin-mobile-lagi-menu.png`), below the 44px touch target of NFR-RESP-03 (design-system §8) | Broken — control hard to use on touch (D9). The bottom-nav cells (45px) are fine and unchanged | Popover rows are `py-3`, min-height 44px (label size and colours unchanged). The list gets about 10px longer per row; it scrolls inside the popover, so no layout impact |

**Provisional, not a fidelity deviation:** the teacher variant of the admin shell (§2.6, §2.10, P-1 to P-8) has no live observation. It applies OD-R5 (build-plan v1.11) and is recorded there and in §7.2, not in this table.

**Explicitly not touched (replicate live — DV-SH-02 and DV-SH-05 confirmed final, 2026-09-25):** the "1-2-3" registration stepper being purely decorative (§4.3); the admin sidebar's ~90-item single scroll and mixed grouping (DV-SH-05); the "Lagi"-menu path to admin logout on mobile (DV-SH-02); the absence of a global search/notification bell in the admin header (§2.3); no dark theme (design-system §1); the admin "Lagi" popover being a subset of the sidebar with its own heading order and the label "Laporan Aktiviti" (§2.7); the admin footer strip and header controls at each width (§2.1).

---

## 6. Canonical menu assembly rule (fixing DV-SH-04)

Because the full ~90-item admin menu and the full user-portal menu are each spread across 26 modules (most not yet at design stage), this foundation document does not attempt to enumerate every item today. Instead it fixes the **rule**:

1. Each module's design doc (`docs/design/Mxx-<slug>.md`, once that module reaches G2) declares its menu entry/entries as `{ section, label, icon, badge?, route, order }`.
2. There is exactly **one** ordered list per shell (admin-shell menu tree; user-shell menu tree), assembled by appending each module's declared entries in the position their `order` value implies relative to already-declared modules from the same phase (per TRACKER's Phase A–F build order).
3. Both the desktop sidebar and the mobile drawer/"Lagi" popover render from that **same** list — never two separate lists. Role filtering (FR-G-04) is applied at render time, not by maintaining separate per-surface lists. The admin "Lagi" popover is the same list with a per-item `lagi` placement (§2.8), so its observed subset, heading order and label differences live as data on the entries, not as a second list.
3a. The teacher menu is defined once, in `user-nav.ts`, and is rendered by the user shell (sidebar and drawer) and by the admin shell's teacher variant (§2.6). `admin-nav.ts` must not restate it.
4. Until a module reaches design, its menu items stay exactly as captured in `docs/discovery/00-global-ui.md` §3.2/§4.2 and the relevant screenshots (used for the wireframes in §2.5/§3.6 above), so early modules (M01–M07) are not blocked waiting for later ones.

---

## 7. Decisions and open items

### 7.1 Decided (Delivery Lead, 2026-09-25, D9/D10)

1. **DV-SH-02 (admin mobile logout discoverability)** — confirmed **not broken**; no IA/logout improvement. Strict replication stands: reachable via "Lagi" → "Log Keluar", no header icon added.
2. **DV-SH-05 (admin sidebar's mixed grouping / long single scroll)** — confirmed **not broken**; no IA cleanup. Replicated exactly as observed.
3. **DV-SH-03 generalisation — accepted, scoped.** The shell derives the header title/subtitle from the current route; this changes nothing on pages where live already shows the correct title, and only replaces the wrong fallback on pages already covered by an approved per-module DV (M01 DV-13, M04 DV-M04-02, M05 DV-M05-01, M06 DV-M06-07, M08 DV-01, M10 pending — see §5). The shell rule implements those DVs; it does not add any new title beyond what the modules themselves specify.

4. **Teacher in the admin chrome (OD-R5) — applied in v1.2 as the build-plan recommends** (D-R1 brief): F-18 stays in Release 1.0, the teacher gets its own menu inside the admin chrome. Confirmation is part of the OD-R9 G2 report. Fallback if the user prefers it: the M11 and M12 analysts switch the teacher variant of S2–S5 and S1–S8 to the user shell and F-18 builds the admin variant only (§2.6 is then dropped; §1.2 teacher rows change).

### 7.2 Still open

1. **User portal role-based section visibility** (§3.2 point 5): OBSERVED for student, teacher, school_admin and admin (`roles-matrix`, `user-nav.ts`); still INFERRED for parent, sponsor, PPD and JPN. Each module's own SRS permissions matrix is the source of truth once available.
2. **NEW-badge colour** and **bottom-nav "Lagi" (user shell) contents** are not yet captured in any screenshot/inventory state — both are flagged as open in `docs/design/design-system.md` §9 and here for visibility; do not guess a structure for the user-shell "Lagi" menu until a state capture exists.
3. **Teacher in the admin chrome is unobserved.** Everything in §2.6 and §2.10 (P-1 to P-8) is PROPOSED from the observed teacher menu and the observed admin chrome. Verify with the teacher account (account 5) on `/guru/monitoring` and `/guru/kirkpatrick` when the live site can be probed, or accept at OD-R9.
4. **Menu targets with no owner or shell for their roles:** "Semakan Nota Master" `/admin/master-notes` and "Audit Log" `/admin/audit-log` (teacher/school_admin/admin "Kawalan Kualiti"), and "Gambar Rajah" `/admin/soalan-gambar` (teacher, school_admin, admin), live under `/admin/*`, which FR-M17-06 denies to non-admins. Which shell and which role can open them is a decision for the owning module's analyst (not decided here). Until then they resolve to the 404 page.
5. **Contrast on replicated live styles** (WCAG 2.2 AA, measured): `slate-400` text/icons on white 2.6:1 (inactive bottom-nav items, popover headings, group sub-item icons) and white on the `gradient-primary` active pill 3.7 to 4.5:1. Replicated per D10; not treated as D9 "unreadable". If the user wants AA on these two, the change is a token swap (`slate-400` → `slate-500`, a darker gradient stop) and is a new deviation, not made here.
6. **M11 breadcrumb for the teacher.** FR-M11-03 points the S3–S5 breadcrumb "Monitoring" to `/admin/monitoring` "whatever the route prefix", but FR-M17-06 denies `/admin/*` to a teacher. For a teacher the link should target `/guru/monitoring`. Report to the M11 analyst (F-18 does not own that link).
7. **Active state in the user shell (F-19).** `isActivePath` marks every prefix match, so "Dashboard Guru" (`/guru`) is active on every `/guru/*` page and several items can be active at once. Live behaviour on the teacher pages was not captured. The admin shell uses the single longest-match rule (§2.8). Whether F-19 should follow is for the F-19 owner and the reviewer; no design change is made here.
8. **Chrome swap for the teacher** between `/guru/laporan` or `/guru/analisis-item` (user shell) and `/guru/monitoring` or `/guru/kirkpatrick` (admin shell) is intended by the SRS mapping (§1.4). It is the main cost of keeping F-18 in 1.0.
