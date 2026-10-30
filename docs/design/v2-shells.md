# PrestasiPlus v2 — Portal Shells (Pentadbiran and Pembelajaran)

| Field | Value |
|---|---|
| Slug | `v2-design-system` (shells part) |
| Version | **2.0** (supersedes the unnumbered 0.1 draft) |
| Status | **Approved (D33–D38)** |
| Date | 2026-10-16 |
| Author | ui-ux-designer |
| Companion | `docs/design/v2-design-system.md` (tokens, components, personalities, guard rules) |
| Visual sources | `docs/design/v2-learner-prototype.html` (learner), `docs/design/v2-theme-preview.html` variant B+ (staff) |
| Requirements | `docs/requirements/v2-portals.md` (US-01…US-16, menus §5–§8) |
| Supersedes | `docs/design/shells.md` visuals and chrome. Unchanged from it: one menu definition feeds sidebar, drawer and Ctrl+K (DV-SH-04 fix), "hidden, not disabled" role filtering, header title from route meta (DV-SH-03). |

**Change log:** 2.0 rewrote the draft to the approved visuals. Removed: 3px active-nav bars, bordered banners, 2px outline chips, pop-shadow buttons, songket brand panel, "Kebangsaan" label (now "Seluruh Negara"), the learner "Chat" tab, all-grey icons. Added: learner header (brand + friend avatar), filled-pill 5-tab nav, full-screen quiz and win screen, friend picker flow, staff B+ chrome.

Conventions: design widths **375 / 768 / 1280**; `lg` (1024) switches mobile ↔ desktop chrome; no horizontal page scroll at ≥ 320px. `U*` = Nuxt UI, `Ds*` = design-system pattern. Decisions D33: one SPA, two portals; Pentadbiran lives under `/admin/**` (per-host build); Mod Pelajar for Admin Pusat + Admin Sekolah; Murid 5 tabs + floating Cikgu Alesa; no Pentadbiran bottom nav.

---

## 1. Overview

| | Portal Pentadbiran | Portal Pembelajaran |
|---|---|---|
| Roles | Admin Pusat, Pegawai PPD/JPN, Admin Sekolah | Murid, Guru, Ibu Bapa, Penaja |
| Shell | `DsShellPentadbiran` | `DsShellPembelajaran` variants `murid`, `guru`, `simple` |
| Personality | `staff` (B+: layers not lines, kobalt on icons, semantic colour for meaning only) | Murid = `learner` (Elektrik); Guru / Ibu Bapa / Penaja = `staff` look in this shell |
| Default colour mode | System | Murid **dark**; others system |
| Nav ≥ lg | Sidebar (rail 72px at 1024–1279, 272px at ≥ 1280, user-toggle persisted) | Sidebar 272px |
| Nav < lg | Top bar + hamburger → drawer with the **complete** menu; **no bottom nav** | Murid, Guru: top bar + **bottom tab bar** + "Lagi" drawer. Ibu Bapa/Penaja: top bar + drawer |
| Identity cue | Wordmark chip "Pentadbiran" (`subtle`) + role/scope chip | Murid: brand + friend avatar; others: wordmark chip "Pembelajaran" |
| Cross-portal ways | Role switcher (dual role), Mod Pelajar, login/logout only (US-15) | Role switcher, "Keluar Mod Pelajar" in the mode, login/logout |
| Search | Ctrl/Cmd+K + visible trigger | none (not on live) |

**Shared rules**

- DOM order: skip link → mode banner → top bar → nav → `main#kandungan` → bottom nav. Landmarks `header`, `nav aria-label="Menu utama"`, `main`, `nav aria-label="Navigasi bawah"`.
- Skip link "Langkau ke kandungan": first focusable, shown on focus, 44px, primary fill.
- **Layers, not lines** everywhere: sidebar, bars and cards separate by surface level and soft shadow (`shadow-xs`, `shadow-bar`, `shadow-bar-up`); no dividers or borders. Page = `bg-muted`, raised = `bg-default`, elevated = `bg-elevated` (max 3).
- One scroll container: `main` scrolls; top bar sticky; sidebar scrolls on its own; wide tables/strips scroll inside their own card.
- Safe areas handled by `DsBottomNav`/shell config. Page transition 120ms opacity (none under reduced motion).
- Footer strip as live: "© 2026 PRESTASIPLUS. Hakcipta Terpelihara." / "Didikan penuh ❤️ dari Malaysia 🇲🇾" (`text-caption text-muted`; in the drawer < lg, end of `main` ≥ lg).
- Colour mode toggle (Cerah / Gelap / Ikut Sistem) in the account menu (staff) and as an icon button in the learner header (sun/moon).

---

## 2. Portal Pentadbiran (staff personality, B+)

### 2.1 Structure

```
UApp (isolate, bg-muted, data-personality="staff", data-density="staff", data-portal="pentadbiran")
└─ DsModeBanner      (never present here; Mod Pelajar lives in the Pembelajaran shell, §3)
└─ UDashboardGroup
   ├─ UDashboardSidebar   (bg-default, shadow-xs; collapsible; slide-over < lg)
   │   header: logo + "Pentadbiran" chip + collapse | search: UDashboardSearchButton
   │   body: UNavigationMenu (9 job groups, role-filtered)
   │   footer: account block (UAvatar, name, role) → UDropdownMenu
   └─ UDashboardPanel
       UDashboardNavbar (bg-default, shadow-bar): [toggle] [title/subtitle] … [search] [DsServerStatus] [DsRoleChip] [account]
       main: DsPage content
UDashboardSearch (command palette) mounted once; Ctrl/Cmd+K
```

### 2.2 Menu

Groups and items exactly `v2-portals.md` §5–§6 (94 items for Admin Pusat). Rendering:

| Rule | Spec |
|---|---|
| Groups | Papan Pemuka, Pemantauan, Bank Soalan, Kertas & SPM, Kurikulum & Kandungan, Pengguna & Sekolah, Penglibatan, Kewangan, Sistem; empty groups not rendered |
| Group row | 40px (48 coarse/drawer); leading **32px icon chip: Phosphor Regular glyph in kobalt (`--ds-ic-theme`) on a 12% kobalt tint, radius 12**; label `text-label`; chevron. Papan Pemuka always open, no chevron. All nine group icons use the **same** theme colour (no rainbow, no grey). |
| Items | No icons inside groups; 40px rows, `text-label`, truncate with tooltip |
| Active | **Tone + weight, no bar and no outline**: row `bg-primary/10`, label `text-highlighted font-semibold`; active group chip becomes solid kobalt with white/ink glyph. `aria-current="page"`. |
| Hover/focus | Hover `bg-elevated`; focus 2px primary ring |
| Open state | Only the group of the active route opens on navigation; others as left; persisted `localStorage["pentadbiran_menu"]`. Nested Kirkpatrick group is a second-level collapsible (indent 16px; max depth 2) |
| Badges | `LIVE` on Langsung = `UBadge color="error" variant="solid"` + `live-pulse` (stays red); counts via `UChip` |
| Role filtering | Items removed, never disabled or padlocked (AC-03.4). Pusat: 9 groups. PPD/JPN: Pemantauan + Pengguna & Sekolah. Sekolah: Papan Pemuka, Pemantauan, Pengguna & Sekolah, Kewangan |
| Rail (1024–1279) | 72px, group chips only, tooltip with group name, click opens a `UPopover` flyout list; expand button on top |

Group icon bases (Phosphor, Regular via `DsIcon`): Papan Pemuka `squares-four`, Pemantauan `pulse`, Bank Soalan `books`, Kertas & SPM `scroll`, Kurikulum & Kandungan `book-open`, Pengguna & Sekolah `student`, Penglibatan `trophy`, Kewangan `wallet`, Sistem `gear`. (DS-T0 verifies glyphs.)

#### 2.2.1 Pentadbiran menu, crumbs and header (batch 1 unit 1d, `v2-admin-page-templates` 2.J, 8.3, 9.3)

Built in `DsAdminShell` (`src/ds`), fed by `src/shells/pentadbiran/menu.ts`. Supersedes the rows above where they differ (the shipped sidebar shows one icon chip per item).

| Item | Spec |
|---|---|
| Pemantauan | Langsung, Aktiviti Harian, Monitoring (`/guru/monitoring`), Analitik, then **Kirkpatrick** as ONE row that opens Ringkasan (`/admin/kirkpatrick`); its other pages (T1 Reaksi, T2 Pembelajaran, T3 Tingkah Laku, T4 Hasil, Rantaian Impak, Intervensi) are in-page tabs above the content (`sectionTabs`, `DsPillNav`). Original menu restored by D77. |
| Crumbs | Sidebar group, plus sub-group for its items, then the `h1` (menu label), then the entity. Generated from `menu.ts`, so crumb groups always equal sidebar groups (no page types a crumb). Shown from `xl`. |
| Entity title | `useShellEntityTitle(name)` (`@/ds`): a detail page names its entity; the shell adds it as the last crumb (from `md`) and the tab title becomes "{entity} · {label} | PRESTASIPLUS". `usePageMeta().setTitle` still wins over it. Cleared on unmount. |
| `h1` size | 16px (`text-subheading`) below `lg`, `text-heading` from `lg` (measured 20px at 1280). |
| Header rhythm | Sidebar header and navbar are both 64px with the same `shadow-bar` edge (the language has no border lines), logo centred in its row. |
| "Cari menu" | First control in the sidebar body, under the header: same inset (12px), width and height as a nav row, placeholder "Cari menu…", small `Ctrl K` hint right-aligned inside. Collapsed: an icon button the size of a rail row. Below `lg` the top bar keeps a search icon ("Cari menu"). |

### 2.3 Top bar

| Slot | ≥ md | < md (375) |
|---|---|---|
| Left | Sidebar toggle (< lg) · title `text-heading` (one line) · subtitle `text-caption text-muted` (≥ md) | Toggle 44px · title (ellipsis) |
| Right | Search trigger · `DsServerStatus` (Pusat, ≥ xl) · `DsRoleChip` · account menu | Search icon button 44px (`aria-label="Cari"`) · account avatar 44px |
| Row 2 | none | **Scope bar** 44px, `bg-elevated`, sticky with the bar, holds `DsRoleChip` |
| Height | 56px | 56 + 44px |

- Search trigger ≥ md: `UButton` tonal (filled `bg-elevated`, hover `bg-accented`) "Cari halaman atau rekod…" + `UKbd` "Ctrl K" ("⌘ K" on macOS); 288px at xl, 256px at md. No bell (replicated omission).
- Account menu (`UDropdownMenu`): name/e-mel/role chip · "Tetapan Peribadi" · "Mod Paparan" (Cerah/Gelap/Ikut Sistem) · "Masuk Mod Pelajar" (Admin Pusat, Admin Sekolah) · "Tukar Peranan" (≥ 2 roles) · "Log Keluar" (`color="error"`). Rows ≥ 44px; no separators (group gap + level step).

### 2.4 Role and scope chip (`DsRoleChip`)

Copy (single table): **"Admin Pusat · Seluruh Negara"** · "Pegawai PPD · {nama PPD}" · "Pegawai JPN · {negeri}" · "Admin Sekolah · {nama sekolah}". Scope text equals the server-applied scope.

| State | Spec |
|---|---|
| Single role | Static `UBadge` subtle (`bg-elevated text-toned`), size lg, role icon (kobalt) + role `font-semibold` + scope. Not a button |
| Dual role | Same look as a button (`UPopover`), trailing `chevrons-up-down`, `aria-label="Peranan aktif: {peranan} {skop}. Tukar peranan"` |
| Widths | ≥ md full text (scope truncates at 16rem with tooltip); < md on the scope bar at full text, ellipsis only beyond 343px |

### 2.5 Role switcher

`UPopover` (≥ md) / `UDrawer` bottom sheet (< md): title "Tukar Peranan", description "Pilih peranan yang ingin anda gunakan. Menu dan data akan mengikut peranan itu." Radio list, rows ≥ 56px: role icon, role + scope, portal hint ("Portal Pembelajaran"/"Portal Pentadbiran"), `UBadge` "Aktif" on current; cancel [Batal]. Select → close, top progress (≤ 800ms), recompute portal/menu/chip/Ctrl+K, route to the new role's home, toast "Peranan aktif: {peranan} · {skop}". Not rendered during Mod Pelajar. First dual-role sign-in only: toast "Anda mempunyai lebih daripada satu peranan. Tukar peranan di menu profil." (accepted, D33c; no role-picker screen).

### 2.6 Ctrl+K palette (`UDashboardSearch`)

Trigger Ctrl/Cmd+K, the search button, or the icon button < md. Esc closes; focus returns.

| Viewport | Layout |
|---|---|
| 1280 | Centered 640px, top offset 15vh, max 70vh, input 56px, `bg-default shadow-modal` |
| 768 | `min(90vw, 560px)` |
| 375 | Full-height sheet (top inset 8px, radius 24 top), input 56px, text button "Tutup" |

Groups "Halaman", "Rekod", "Tindakan" (`text-overline`); empty query shows "Terkini" (last 5). Pages come from the same role-filtered menu data; records (Pengguna, Sekolah) are server-scoped, debounced 150ms. Result rows 56px (hover/active = `bg-elevated`, no dividers). Matching is case/diacritic-insensitive BM. States: none → `UEmpty` "Tiada hasil untuk “{kata kunci}”" / "Cuba kata kunci lain atau semak ejaan."; loading → skeleton + "Mencari rekod…" (polite); error → "Carian rekod tidak tersedia buat masa ini." + [Cuba Lagi]. "Masuk Mod Pelajar" only for allowed roles; "Tukar Peranan" only with ≥ 2 roles. Combobox/listbox semantics with `aria-activedescendant`.

### 2.7 `DsServerStatus` (Admin Pusat, ≥ xl)

`UPopover` trigger "CPU {x}% · RAM {y}% · Disk {z}%" as three `UBadge`s with icon + word. Thresholds (kept): CPU >80 / RAM >85 / Disk >90 = `error`; >50 / >60 / >75 = `warning`; else `success` (semantic colour used because it carries meaning). Popover adds Uptime and "Load: x / n cores", "{used}GB / {total}GB". Poll 30s while visible; first load "--"; failed poll keeps last values. Below xl: Sistem › Prestasi Sistem.

### 2.8 Wireframes

```
1280  (sidebar 272, raised on bg-muted page; no lines)
┌───────────────────┬────────────────────────────────────────────────────────────────────┐
│ ▣ PRESTASI+       │ Pemantauan › Langsung        [🔍 Cari… Ctrl K] (CPU 12% RAM 41%…)  │
│ (Pentadbiran)  «  │ Subtitle                       (Admin Pusat · Seluruh Negara) (AB) │
│ [🔍 Cari… Ctrl K] ├────────────────────────────────────────────────────────────────────┤  ← shadow-bar, no line
│ [◫] Papan Pemuka  │  ┌ DsStat ┐ ┌ DsStat ┐ ┌ DsStat ┐ ┌ DsStat ┐                       │
│      Dashboard    │  └────────┘ └────────┘ └────────┘ └────────┘                       │
│  ░Laporan Ekse…░  │  ┌ DsDataTable (zebra, no row lines) ───────────────────────────┐ │
│ [⌁] Pemantauan ▾  │  │ Penapis…                                     [ Eksport ]     │ │
│ [▤] Bank Soalan ▾ │  │ rows…                                                        │ │
│ … 9 groups        │  └──────────────────────────────────────────────────────────────┘ │
│ (AB) Nama… ▾      │  © 2026 PRESTASIPLUS. Hakcipta Terpelihara.                        │
└───────────────────┴────────────────────────────────────────────────────────────────────┘
 ░ = active row (tone + weight)

768                                         375
┌───────────────────────────────────┐   ┌─────────────────────────────┐
│ [☰] Langsung  [🔍 Cari…] (AB)     │   │ [☰] Langsung      [🔍] (AB) │ 56
│     (Admin Pusat · Seluruh Negara)│   │ (Admin Pusat · Seluruh Neg…)│ 44 scope bar
├───────────────────────────────────┤   ├─────────────────────────────┤
│ 24px gutter, 2-col stats, table   │   │ 16px gutter, 2-col stats     │
│ scrolls inside its card           │   │ table → card list            │
└───────────────────────────────────┘   └─────────────────────────────┘
Drawer (320px, from left, scrim): logo, ✕, full menu 48px rows, account block, © lines
```

### 2.9 States

| State | Spec |
|---|---|
| Shell loading | Sidebar/top bar from cached menu; `main` skeleton blocks; top progress bar; never blank |
| No visible groups | `UEmpty` "Tiada menu untuk peranan ini" / "Sila hubungi Admin Pusat untuk menyemak akses anda." / [Log Keluar] |
| Session expired | Non-dismissible `UModal` "Sesi anda telah tamat" / "Sila log masuk semula untuk meneruskan." / [Log Masuk] |
| Offline | `UAlert` warning under the bar: "Anda sedang luar talian. Perubahan tidak akan disimpan." |
| Forbidden / 404 | §7 |

---

## 3. Mod Pelajar (D31c, D33b)

An admin (Admin Pusat or Admin Sekolah) tests the student portal **as themselves**. It is an explicit, visible role transition; never a silent shell change. This replaces the "Pratonton" new-tab design and drops the "Pratonton" row action in Pengguna.

### 3.1 Entry

Account menu "Masuk Mod Pelajar" or Ctrl+K action. Confirmation (`DsDialog`; bottom sheet < sm): title **"Masuk Mod Pelajar?"**; body "Anda akan beralih ke Portal Pembelajaran dan melihat paparan murid menggunakan akaun anda sendiri ({nama}). Data yang anda cipta dalam mod ini ditanda sebagai data ujian."; [Masuk Mod Pelajar] / [Batal]. On confirm: progress bar (≤ 600ms) → Murid home (learner personality, dark by default for this view unless the admin's mode choice is explicit) → toast "Anda kini dalam Mod Pelajar. Gunakan “Keluar Mod Pelajar” di bahagian atas untuk kembali." Focus moves to the banner exit button.

### 3.2 While active

| Cue | Spec |
|---|---|
| Banner (`DsModeBanner` on `UBanner`, not closable) | In normal flow above the shell (shell = viewport − banner; no overlap). Fill `bg-highlight`, text `text-on-highlight` (15.2:1), leading `flask` glyph, no border. Lime is reserved for win moments **and** Mod Pelajar. |
| ≥ md (48px) | "**Mod Pelajar** — anda sedang menguji paparan murid sebagai {nama}. Data yang dicipta ditanda sebagai data ujian." + [Keluar Mod Pelajar] (solid ink button, 44px) |
| < md (375, 48px, one row) | `Mod Pelajar` + [Keluar Mod Pelajar]; the sentence moves to an info button (44px) opening a `UPopover` |
| Frame | 4px inset ring in `secondary` (lime) around the viewport (`data-mode="student-test"`). This is a **mode indicator**, the only decorative ring allowed, defined in shell config |
| Tab title | Prefix "[Mod Pelajar] " |
| Chrome | Murid shell with the admin's name; role switcher and "Masuk Mod Pelajar" hidden; account menu adds "Keluar Mod Pelajar" first |
| Test data | Items created show `UBadge` "Data ujian" (warning solid + `flask`) where an admin sees them |
| Guard | Any `/admin/**` URL → Murid home + toast "Keluar Mod Pelajar dahulu untuk ke Portal Pentadbiran." |

### 3.3 Exit

[Keluar Mod Pelajar] (banner or menu): no confirmation; progress bar; returns to the Pentadbiran page the admin came from (fallback Papan Pemuka); toast "Anda telah keluar daripada Mod Pelajar."; history entry replaced so Back does not re-enter.

---

## 4. Pemantauan › Langsung and full-screen

### 4.1 Normal view (same tab, inside Pentadbiran — AC-09.1)

`DsPage` "Langsung" using `DsLiveTiles` and `DsDrillTable` (thin wrappers over `DsStat`/`DsDataTable`, same data contract as the Guru Command Center; Guru starts at own classes, Pusat at national list, PPD at district, Sekolah at own school).

```
1280
┌ Langsung  (● LANGSUNG) Dikemas kini 14:32:05      [ Jeda ] [ ⤢ Skrin Penuh ] ┐
│ Skop: Seluruh Negara                                                           │
│ ┌ DsStat ┐ ┌ DsStat ┐ ┌ DsStat ┐ ┌ DsStat ┐   metrik langsung (kandungan M17)  │
│ Semua Sekolah › {Sekolah} › {Guru} › {Kelas} › {Murid}                       │
│ ┌ DsDrillTable (zebra rows, › affordance) ─────────────────────────────────┐  │
└────────────────────────────────────────────────────────────────────────────────┘
```

- "● LANGSUNG" = `UBadge color="error" variant="solid"` + `live-pulse` (static dot under reduced motion); the word is always present.
- [Jeda]/[Sambung] pauses auto-update (WCAG 2.2.2); paused badge "DIJEDA" (neutral). States: "Menyambung…", LANGSUNG, "Terputus — mencuba semula…" (warning, [Cuba Lagi]).
- Row click/Enter drills in place (query params; Back works). Out-of-scope target → 404 (AC-09.5).
- < md: tiles 2×2; breadcrumb shows last two crumbs + overflow menu; table → card list; [Skrin Penuh] in the page header.

### 4.2 Full-screen (AC-09.2, AC-16.4)

Enter via [⤢ Skrin Penuh] (`aria-pressed`) or `F` (focus inside the page, not in an input). Hides sidebar, top bar, footer (pseudo full-screen fixed layer at `100dvh`) and also requests the browser Fullscreen API when available (iOS Safari falls back to the pseudo mode). Same component instance: updates continue.

```
Full-screen 1280 (wall scale: data-view="wall" raises type one step)
┌──────────────────────────────────────────────────────────────────────────────┐
│ ● LANGSUNG  Langsung · Seluruh Negara  Kemas kini 14:32:05  [Jeda] [✕ Keluar Esc]│ 56 (bg-default, shadow-bar)
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   display numerals       │
│ │  {angka} │ │  {angka} │ │  {angka} │ │  {angka} │                           │
│ Semua Sekolah › {Sekolah} › {Guru}                                           │
│ ┌ table / cards (internal scroll) ────────────────────────────────────────┐   │
Full-screen 375:  ● LANGSUNG  [Jeda] [✕] (56) · tiles 2×2 · "‹ {Sekolah}" back crumb (44) · card list
```

- Exit is always visible, labelled, 44px, with `UKbd` "Esc" on keyboard devices; Esc and the browser's own exit both restore (synced to `fullscreenchange`); focus returns to [Skrin Penuh]. The strip never auto-hides.
- Tile values update in place via an `aria-live="off"` region; [Jeda] announces "Kemas kini dijeda pada 14:32:05". Reduced motion: no pulse, no number tick.

---

## 5. Portal Pembelajaran

### 5.1 Murid (learner personality, dark default)

Menu groups: BM labels exactly per `v2-portals.md` §8 (top items Dashboard, Target SPM, Misi Harian, Remedial · SPM · Pembelajaran · Pusat AI · 🏆 Bilik Duta · ✨ Visi & Pertandingan · 💎 Killer Features · Akaun & Bantuan); emoji in group labels kept as copy. One definition feeds sidebar, drawer and tab bar. No admin/guru blocks.

**Header (< lg and as the sidebar head ≥ lg)**

```
375
┌───────────────────────────────────────┐
│ PRESTASI+   (🔥 5) (🪙 120)  [☾] (🔔3)│ ← brand (the "+" in --ds-primary-t), reward chips, mode toggle, bell
│ (friend avatar 56 in greeting below)  │
└───────────────────────────────────────┘
```

- Brand wordmark "PRESTASI+" (display, "+" in `text-primary` tone); header height 4rem with safe-area top padding; raised on page, `shadow-bar`.
- **Friend avatar**: the 56px `DsFriendAvatar` button sits in the Home greeting (with bubble) and in the sidebar identity card ≥ lg; on other screens the header carries a 40px avatar button (touch area 56). Tap → picker (§5.4).
- Reward chips: 3D fire + streak number, 3D coin + koin; labels "hari"/"Koin" from ≥ md; at 375 numbers only with `aria-label`. Bell = `UChip` count (99+).
- Icon buttons 44px, radius 14, raised.

**Sidebar ≥ lg (272px, raised, `shadow-xs`)**: brand, identity card (friend avatar 56, name, level, XP `UProgress` with number), groups via `UNavigationMenu` (group `text-overline`, item rows 44px with Phosphor **Duotone** neutral glyphs), **active item = filled gradient pill** (white label, glyph white), no bar. Footer: Akaun & Bantuan.

**Bottom tab bar (`DsBottomNav`, < lg)**: 5 tabs **Home · SPM · Game · Topik · Lagi** (live labels), raised bar with 22px top radius and `shadow-bar-up`, tab min 56px high (64 incl. padding + safe area), glyph 24 + `text-caption` label. **Active tab = filled gradient pill** (A1→A1b, white glyph and label), glyph plays `hop`. Inactive = `text-muted`. "Lagi" opens `USlideover` from the right (`min(88vw, 360px)`) with the complete menu. The live "Chat" tab is replaced by the **floating Cikgu Alesa button** (56px, A4 chip, violet, "AI" pill; bottom-right above the tab bar, 16px offset, all sizes; opens the M13 chat). Pages reserve bottom padding for tab bar + button.

```
375 Home (Murid)                                      1280 Home (Murid)
┌───────────────────────────────────┐   ┌──────────────┬───────────────────────────────────┐
│ PRESTASI+  (🔥5)(🪙120) [☾] (🔔)  │   │ PRESTASI+    │ Selamat datang, {nama}   [☾](🔔)   │
│ (👦) ┌ bubble: Lima soalan… Jom? ┐ │   │ (👦) {nama}  │ (👦) ┌ bubble ─────────┐            │
│ ┌ stat ┐┌ stat ┐┌ stat ┐ 3 across  │   │ Lvl 2 ▓▓░░ 5 │ ┌ stat ┐┌ stat ┐┌ stat ┐            │
│ ┌ HERO gradient A1 ─────────────┐ │   │ [▣ Home] ▓▓▓ │ ┌ HERO gradient ──────────┐        │
│ │ overline / Tajuk / sub  ◔ 68% │ │   │  SPM         │ │ …            ◔ 68%  3D │        │
│ │ [ Mula ]              (3D art)│ │   │  Pembelajaran│ └─────────────────────────┘        │
│ └───────────────────────────────┘ │   │  Pusat AI …  │ Subjek (scroll strip)               │
│ Subjek ▸ [🧮][📖][🔬] scroll      │   │              │ ┌ character cards in 2 columns ┐    │
│ ┌ gcard: Percubaan Percuma ─────┐ │   │              │ └──────────────────────────────┘    │
│ ┌ info carousel (violet) ───────┐ │   └──────────────┴───────────────────────────────────┘
│ ┌ achievements (lime) ──────────┐ │
│                          (💬 AI)  │   ← floating Cikgu Alesa
│ [⌂ Home][SPM][Game][Topik][⋯Lagi] │   ← active tab = filled gradient pill
└───────────────────────────────────┘
```

Home content (all old Home content replicated as meaning-coloured character cards, D37a): friend greeting, 3 stat tiles (Hari Berturut / Syiling Kamu / Mata (Lvl 2)), hero (next action + ring), subject strip, then cards in this order: Percubaan Percuma (amber), amaran (orange), info carousel (violet, with "Baca lagi/Tutup"), pencapaian (lime), misi/quests, recent items, articles strip. Card anatomy and colours: design-system §3.3/§6. Gutters 16 / 24 / 32; at ≥ md the card stack becomes 2 columns; stat tiles stay 3 across (4 at ≥ xl if a fourth exists).

### 5.2 Quiz (Latihan) — full-screen, one question at a time

Chrome (sidebar, top bar, tab bar, floating button) is hidden; the quiz owns the viewport (`100dvh`). Applies to the redesigned question display (D35b); question content comes from the M04/M05 contract.

```
375                                              1280 (column max 40rem, centred on bg-muted)
┌───────────────────────────────────┐          ┌────────────────────────────────────────────┐
│ [✕] ▓▓▓▓░░░░░░░░░░░░░░  (🔥 3)    │ top      │        ┌─ column 640 ────────────────┐     │
│ (Matematik) 4/10        ⏱ 0:42    │ meta     │        │ [✕] ▓▓▓▓░░░░░░░░░ (🔥 3)    │     │
│                                   │          │        │ (Matematik) 4/10             │     │
│  Soalan (display 20→24px)         │ question │        │ Soalan …                     │     │
│  centred vertically, scrolls      │          │        │ [A] Pilihan 1                │     │
│ ┌ [A] Pilihan 1               ┐   │ options  │        │ [B] Pilihan 2                │     │
│ ┌ [B] Pilihan 2               ┐   │ 60px     │        │ [  Semak  ]                  │     │
│ ┌ [  Semak  ] (disabled until) ┐  │ footer   │        └──────────────────────────────┘     │
└───────────────────────────────────┘          └────────────────────────────────────────────┘
```

- Top: close button (44px, `aria-label="Keluar latihan"`) (prototype: `aria-label="Tutup latihan dan kembali ke Home"`; closes the quiz and returns to Home, no extra confirm dialog is specified). **Progress bar** 10px, track `bg-elevated`, fill gradient primary → AI, animated width. **Combo chip** 44px raised pill with flame (lit = display number + A3 flicker; `hot` = soft A3 glow, no ring line).
- Meta row: subject chip (solid A1 icon chip + label), counter "n/N", timer only if the mode has one (neutral text; never alarming red except the last 10s using `text-error` plus icon).
- Question: `text-heading` display, 1.35 line height; options `DsOption` 60px, gap 10px, letter chips; selecting does not submit; [Semak] primary full-width 52px enabled after selection.
- After check: option states (correct = success mix + solid green chip + check; wrong = error mix + solid red chip + x + `nudge`); `DsFloatScore` "+10" (lime pill) floats from the correct option; **feedback sheet** slides up (500ms) over the footer: green/red title with round glyph, explanation, friend line (happy/encouraging) and, for AI explanations, an elevated bubble tagged "AI"; combo chip `+n`; CTA "Teruskan". Copy (prototype): correct title cycles through the GOOD list "Betul!", "Mantap!", "Tepat sekali!", "Kemas!", "Terbaik!" with a peer line from the GOODMSG list; wrong title is "Hampir!" with "Jawapan: {huruf}." plus a BADMSG line and a "Penjelasan" AI-tagged explanation. Explanation text comes from the question's data; friend lines per design-system §10.3.
- Keyboard: 1–4 / A–D select, Enter checks/continues, Esc opens the exit confirm. All controls ≥ 44px; the sheet is `role="status"` (polite).
- Reduced motion: no flicker/nudge/float/sheet slide; correct/wrong still shown by glyph + text.

### 5.3 Win screen

Full-screen after the last question (and level-ups). Layout (375; ≥ md the same single column, max 30rem, centred):

Order (top to bottom, per the prototype): 3D achievement hero → title → score ring → friend congratulation dialog → +Mata / +Koin → stickers → buttons.

```
┌───────────────────────────────────┐   soft lime glow behind the hero (win moments only)
│ 3D hero 96–128: 🎉 party popper (5/5) · 🏆 trophy (3–4/5) · 📚 books (0–2/5) │
│ Title (display 28): "Sempurna, {nama}!" / "Hebat, …" / "Bagus, …" / "Teruskan, …"│
│        ┌─ ring 168 ─────────────────┐             │
│        │   {skor}  (display 48)     │ ← count-up  │  bar LIME if ≥ 3/5, A1 below 3
│        │   daripada 5               │             │
│        └────────────────────────────┘             │
│ (friend 46, party/hop) ┌ {Nama rakan}            ┐ │  chat bubble; typing dots (≈400–600ms)
│                        │ {mesej tahniah} · · ·   │ │  then the message
│ ┌ 3D ⚡ +{n} Mata ┐ ┌ 3D 🪙 +{n} Koin ┐           │
│  [ STICKER: Streak {n} hari! ] [ Tahap naik! ]    │  lime, −4° / +3°, stamp-in 0.9s / 1.15s
│ [ Kongsi ] (tonal)                                │
│ [ Kembali ke Home ] (primary)                     │
└───────────────────────────────────┘   + confetti burst (28 particles)
```

Copy (prototype, verbatim): titles "Sempurna, {nama}!" (5/5), "Hebat, {nama}!" (4), "Bagus, {nama}!" (3), "Teruskan, {nama}!" (< 3). Friend congratulation: 5/5 "Tahniah, {nama}! Semua betul! 🎉"; 3–4 "Tahniah, {nama}! Awak dapat {n}/5. Hebat!"; < 3 "Bagus sebab awak cuba, {nama}. Jom ulang kaji soalan yang salah, awak pasti boleh! 💪". Labels "daripada 5", "Mata", "Koin"; stickers "Streak {n} hari!" and (when level rises, ≥ 4/5) "Tahap naik!"; buttons **"Kongsi"** and **"Kembali ke Home"**; ring `aria-valuetext` "{n} daripada 5 betul"; screen label "Kemenangan". The "Tukar rakan" link is on Home and the avatar, not on this screen.

Rules: **lime** appears at win moments only (ring bar when ≥ 3/5, stickers, float score, glow); below 3/5 the ring bar is A1 and the lime glow is off (the streak sticker still shows), friend `encouraging` with `hop`; with ≥ 3/5 friend `celebrating` with `party`. Reward tiles are raised with 3D art and display numbers; numbers count up (1.2–1.4s). Reduced motion: no typing dots (message shown at once), static ring at final value, stickers in place, no confetti.

### 5.4 Friend picker flow

- **First run** (Murid without a friend): sheet opens over Home after the first paint: title **"Pilih rakan belajar awak"**, description "Dia akan temankan awak sepanjang latihan. Boleh tukar bila-bila masa.", two radio cards (Aiman, Aisyah: 96px face, name display, trait lines "Tenang & suka cabaran" (Aiman) and "Ceria & sentiasa beri semangat" (Aisyah)), [Pilih] (disabled until a card is chosen; [Batal] appears when changing). Dismiss without choosing → default Aiman for the session, re-offered once next login.
- **Change anytime**: tap the friend avatar (Home, header button, sidebar card) or the "Tukar rakan" link (win screen, Home footer link) → same sheet with current friend preselected → toast "Rakan belajar: {nama}".
- Sheet layout: `UDrawer` bottom sheet < md (radius 28 top, `bg-elevated`, scrim rgba(5,7,10,.62)); centered `UModal` 480px ≥ md. Cards 2 columns, selected = violet surface mix + ✓ badge + scale 1.02. Radiogroup semantics, Arrow keys, Esc closes, focus returns to the avatar.
- The friend appears on Home (greeting), quiz feedback, win, and learner empty states; Cikgu Alesa remains a separate entry (floating button; "AI" pill).

### 5.5 Guru (staff look inside the learning shell)

Menu per `v2-portals.md` §8 (Command Center (LIVE), HARIAN, PENGAJARAN, PENILAIAN, ANALITIK, PUSAT AI, BANK SOALAN, AKTIVITI, LAIN-LAIN, Bantuan); Monitoring, Kirkpatrick and Command Center render in this layout. Staff personality and B+ rules (kobalt glyph chips, tone-and-weight active item). ≥ lg sidebar + top bar (title, bell, avatar; chip "Guru · {sekolah}" only for dual-role). < lg: top bar + **bottom tab bar** `Dashboard · Kelas · Command Center · Penilaian · Lagi` (accepted, D33c) where the active tab is a **tonal pill** (`bg-primary/10` radius 12, label `font-semibold`; no top bar). Command Center tab carries the red live dot. Labels truncate with `title` if needed at 320.

### 5.6 Ibu Bapa and Penaja (simple variant, staff look)

Top bar with logo and a horizontal `UNavigationMenu` (≤ 5 items) at ≥ md; hamburger + drawer < md. Content max 64rem. Items per `v2-portals.md` §8.

---

## 6. Authentication and portal routing (`DsShellAuth`)

One login for all roles (D33; no separate admin login).

**Look:** auth uses the **learner Elektrik personality** (dark by default on first visit, then the user's saved mode). ≥ xl split layout: left brand panel (gradient A1 surface, "PRESTASI+", **"Sedia untuk SPM."** display, 3D rocket art, footer line "Didikan penuh ❤️ dari Malaysia 🇲🇾"); right form on `bg-muted`. 768: centered card (`bg-default shadow-card`, max 28rem) under a slim gradient brand strip. 375: single column, logo 40px, fields full width, [Log Masuk] 52px full width, 16px gutters.

Fields: "Alamat Email atau Nama Pengguna" (accepted) · "Sekolah" (`USelectMenu` searchable, appears only when the identifier has no "@"; hint "Pilih sekolah anda jika log masuk dengan nama pengguna.") · "Kata Laluan" (show/hide toggle `aria-pressed`) · "Ingat saya" · [Log Masuk]. Links verbatim (FR-M01-06): "Lupa kata laluan?", "Reset melalui No IC", "Belum ada akaun? Daftar Sekarang 🚀", "Kembali ke Laman Utama". Heading "Selamat Kembali! 👋". Google sign-in button (tonal) only if SSO is enabled. Inputs are filled, 52px, 2px primary focus ring, error = 2px inset error ring + message.

Errors (`UAlert` error above fields, `role="alert"`, focus moves to it):

| State | Copy |
|---|---|
| Invalid | "E-mel/Nama pengguna atau kata laluan tidak sah." |
| Inactive/suspended | "Akaun anda tidak aktif atau telah digantung. Sila hubungi pentadbir." |
| School off | "Sekolah anda belum diaktifkan oleh pentadbir. Sila hubungi pihak sekolah." |
| Ambiguous username | M01 ambiguity message; Sekolah field focused |
| Submitting | button `loading` "Sedang Memasuki…", fields disabled |
| Network | "Ralat rangkaian. Sila cuba lagi." |
| Already signed in | redirect to role home (AC-01.8), no form flash |

**Routing after login (AC-01.2/3/10, US-02):** Admin Pusat / Admin Sekolah → Pentadbiran Papan Pemuka; Pegawai PPD/JPN → Pemantauan › Papan Pemuka Wilayah; Guru → Dashboard Guru; Murid → Home (first run: friend picker); Ibu Bapa/Penaja → their home; dual role → last-active role (default first), no chooser. Transition: shell skeleton + top progress (≤ 800ms). Guest on protected URL → `/login?redirect=<path>` (D51). Learner opening a Pentadbiran URL → own home + toast "Halaman itu hanya untuk Portal Pentadbiran."; staff-only user opening a Pembelajaran role page → own home + toast "Halaman itu hanya untuk Portal Pembelajaran." Logout → `/login`; Back must not show protected data.

---

## 7. Empty, forbidden, 404 and error states

Rendered inside the user's own portal shell (unauthenticated: `DsShellAuth`). Component `DsErrorPage` on `UError`/`UEmpty`; centred, max 28rem, padding 48/64px; illustration 160px (120 at 375); actions in a row ≥ sm, stacked full-width 48px < sm. No gradient pages and no lines. Learner shell may show the friend (encouraging) in place of the illustration.

| State | Illustration | Heading | Body | Actions |
|---|---|---|---|---|
| 403 Pentadbiran, Pusat-only page | `403` | "Akses Ditolak" (+ page name above) | "Halaman ini diuruskan oleh Admin Pusat sahaja." | [Kembali ke Papan Pemuka] (PPD/JPN: [Kembali ke Papan Pemuka Wilayah]); item absent from menu |
| 403 Pentadbiran, other | `403` | "Akses Ditolak" | "Halaman ini tidak tersedia untuk peranan anda." | same |
| 403 Pembelajaran | `403` | "Akses Ditolak" | "Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir." | [Halaman Utama] · [Log Masuk] (tonal) |
| 404 Pentadbiran | `404` | "Halaman Tidak Dijumpai" | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?" | [Kembali ke Papan Pemuka] · [Cari (Ctrl K)] |
| 404 Pembelajaran | `404` | same | same | [Halaman Utama] · [Mula Latihan] (tonal) |
| Out-of-scope record | `404` | same as 404 | same | same (existence not disclosed) |
| Unexpected error | `ralat` | "Sesuatu tidak kena" (PROPOSED) | "Kami tidak dapat memuatkan halaman ini. Cuba lagi sebentar." | [Cuba Lagi] · [Kembali] |
| Empty list | `kosong` | "Tiada {item} lagi" | context | primary create action if permitted |
| Empty (filter) | `tiada-hasil` | "Tiada {item} dijumpai" | "Tiada hasil untuk penapis semasa." | [Set Semula Penapis] |
| Loading | — | — | `USkeleton` shapes | spinner only inside buttons |

Titles: `document.title` "Akses Ditolak - PRESTASIPLUS" / "Halaman Tidak Dijumpai - PRESTASIPLUS".

---

## 8. Interaction notes

- Menu data is the single source for sidebar, drawer, tab bar, Ctrl+K and 403 checks; no padlocked items.
- Sidebar rail/expanded persisted (`pentadbiran_sidebar`), width animates 200ms (none under reduced motion).
- Drawer closes on route change, Esc, scrim tap, swipe-left; traps focus; returns to the trigger. Tab bar "Lagi" uses the same menu.
- Colour mode instant, persisted, set before first paint (no flash). Murid default dark; staff default system.
- Long labels truncate with tooltip; never wrap the nav, never scroll the page sideways.
- Keyboard: tab order follows DOM order; Ctrl/Cmd+K global in Pentadbiran; Esc closes the top overlay; `F` toggles full-screen only on Langsung outside inputs; quiz shortcuts §5.2.
- Back button: drill-down uses query params; drawer, full-screen and sheets add no history entries.

## 9. Accessibility checklist (shells)

| # | Check |
|---|---|
| 1 | Skip link first, visible on focus, 44px |
| 2 | Landmarks named; one `h1` per page |
| 3 | `aria-current="page"` on active menu item and tab; active state not colour-only (tone + weight; filled pill + label) |
| 4 | Targets ≥ 44×44 on touch: hamburger, search, avatar, friend avatar (56), chips, tabs (56), palette rows, exit full-screen, banner button, quiz options (60) |
| 5 | Focus ring 2px primary on every control; focus returns after drawer/palette/sheet/dialog close |
| 6 | Palette combobox/listbox with `aria-activedescendant`; result count announced politely |
| 7 | Role chip accessible name (role, scope, action); switcher is a radio list |
| 8 | Mod Pelajar: labelled region, exit button first focus on entry, state via text + frame (not colour alone) |
| 9 | Langsung: pause control (2.2.2), LIVE has the word, no per-tick announcements, pulse removed under reduced motion |
| 10 | Full-screen exits via Esc and a visible button; works without the Fullscreen API |
| 11 | Forms: persistent labels, hints/placeholders, error summary, 16px inputs, `autocomplete`, password toggle `aria-pressed` (R-1 mitigations for borderless inputs) |
| 12 | Contrast per design-system §3.4 in both personalities and modes (lime banner 15.2:1; white on A1 5.2:1) |
| 13 | No horizontal page scroll at 320/375/768/1280, light and dark: login, both home pages, a group's first page, quiz, win, picker, 403/404, Langsung (both modes), Ctrl+K, switcher, banner |
| 14 | Reduced motion and 200% zoom keep the chrome intact (top bar wraps to scope bar; chips truncate) |
| 15 | Quiz/win: result conveyed by glyph + text; feedback `role="status"`; friend and 3D images decorative |
| 16 | `<html lang="ms">`; document title per route; "[Mod Pelajar] " prefix in the mode |

---

## 10. Decisions applied and open points

Applied: two personalities (D35/D36); Elektrik learner, B+ staff (D34–D36); Phosphor Duotone for learners, 3D rewards on, friend style 4+ (D38); Aiman/Aisyah and Alesa as separate AI tutor (D37); scope label "Seluruh Negara"; LIVE red; filled borderless inputs (risk R-1 accepted); dark default for Murid; no Pentadbiran bottom nav; Murid 5 tabs + floating Cikgu Alesa; Mod Pelajar for Admin Pusat + Admin Sekolah; Guru tabs Dashboard/Kelas/Command Center/Penilaian; no role-picker screen.

Open, non-blocking (default applied above):

| # | Point | Default |
|---|---|---|
| O1 | Quiz, win, picker and Home copy now follow the prototype verbatim; no new learner copy is proposed. Remaining PROPOSED strings are non-learner (Mod Pelajar, role switcher, login hints, "Sesuatu tidak kena") | Use as written until the user edits |
| O2 | Auth screens use the learner Elektrik look for all roles | Yes; staff see the same login |
| O3 | Staff icon weight Regular (design-system O1) | Regular |
| O4 | Timer in the quiz exists only for modes that define one | Follows the M05 contract |
