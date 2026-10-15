# PrestasiPlus v2 — Portal Shells (Pentadbiran and Pembelajaran)

Slug: `v2-design-system` (shells part) · Gate: G2 · Status: Draft for user approval · Date: 2026-10-16 · Author: ui-ux-designer
Companion: `docs/design/v2-design-system.md` (tokens, components, density, guard rules). Requirements: `docs/requirements/v2-portals.md` (US-01…US-16, menu §5–§8). Decisions: D28–D32.

Conventions: widths **375 / 768 / 1280** are the design points (Tailwind: base, `md`, `xl`; the switch between "mobile" and "desktop" chrome is `lg` = 1024). All three must not scroll horizontally; 320 also must not. Components named `U*` are Nuxt UI; `Ds*` are design-system patterns (design-system doc §10.3). Wireframe legend: `[ ]` button · `( )` chip/badge · `{ }` data · `…` truncated · `▾` menu.

Supersedes `docs/design/shells.md` for visuals and chrome. Unchanged from it: the single menu definition feeding sidebar, drawer and Ctrl+K (DV-SH-04 fix), "hidden, not disabled" role filtering, header title derived from route meta (DV-SH-03).

---

## 1. Overview

| | Portal Pentadbiran | Portal Pembelajaran |
|---|---|---|
| Roles | Admin Pusat, Pegawai PPD/JPN, Admin Sekolah | Murid, Guru, Ibu Bapa, Penaja |
| Shell component | `DsShellPentadbiran` | `DsShellPembelajaran` (variants: `murid`, `guru`, `simple` for Ibu Bapa/Penaja) |
| Density | `staff` | Murid = `learner`; Guru, Ibu Bapa, Penaja = `staff` |
| Nav pattern ≥ lg (1024) | Left sidebar (rail 72px at 1024–1279, expanded 272px at ≥ 1280; user-togglable, choice stored) | Left sidebar 272px |
| Nav pattern < lg | Top bar + hamburger → slide-over drawer with the **complete** menu. **No bottom nav.** | Top bar + **bottom tab bar** (Murid, Guru) + "Lagi" opens the complete menu drawer; Ibu Bapa/Penaja: top bar + drawer |
| Search | Ctrl/Cmd+K palette + visible trigger on touch | Search not part of the learner shell (not on live); Ctrl+K is Pentadbiran only |
| Identity cue | Wordmark chip "Pentadbiran" (neutral) + role/scope chip in the top bar | Wordmark chip "Pembelajaran" (primary); Murid identity card with level/XP |
| Cross-portal ways | Role switcher (dual-role), Mod Pelajar, login/logout — nothing else (US-15) | Role switcher (dual-role), "Keluar Mod Pelajar" while in the mode, login/logout |
| Colour mode | Light / Gelap / Ikut Sistem (default: system), toggle in the account menu in both portals | same |

**Shared chrome rules**

- DOM order: skip link → mode banner (if any) → top bar → sidebar nav → `main` → bottom nav. Landmarks: `header`, `nav aria-label="Menu utama"`, `main id="kandungan"`, `nav aria-label="Navigasi bawah"` (mobile tab bar).
- Skip link copy: "Langkau ke kandungan" (first focusable element, visible on focus, 44px, `secondary` sticker).
- One scroll container per page: the `main` panel scrolls; the top bar is sticky; the sidebar scrolls on its own. Wide content (tables, charts) scrolls inside its own card.
- Safe areas: bottom bar and drawers add `env(safe-area-inset-*)` padding (set in `DsBottomNav` / shell config, not in pages).
- Page transition: 120ms opacity (none under reduced motion).
- Footer strip (copyright) stays as live: "© 2026 PRESTASIPLUS. Hakcipta Terpelihara." / "Didikan penuh ❤️ dari Malaysia 🇲🇾" — inside the drawer footer < lg, and at the end of `main` content ≥ lg (`text-caption text-muted`).

---

## 2. Portal Pentadbiran

### 2.1 Structure

```
UApp (isolate, bg-muted, data-density="staff", data-portal="pentadbiran")
└─ DsModeBanner            (only in Mod Pelajar — never present in Pentadbiran, see §3)
└─ UDashboardGroup
   ├─ UDashboardSidebar    (collapsible; slide-over < lg)
   │   ├ header : wordmark + (Pentadbiran) chip + collapse button
   │   ├ search : UDashboardSearchButton  "Cari…  Ctrl K"
   │   ├ body   : UNavigationMenu — 9 job groups, role-filtered, one active group open
   │   └ footer : account block (UAvatar, name, role) → UDropdownMenu
   └─ UDashboardPanel
       ├ UDashboardNavbar  : [toggle] [title/subtitle] … [search-icon] [DsServerStatus] [DsRoleChip] [account]
       └ main              : page content (DsPage)
UDashboardSearch (UCommandPalette in a modal) — mounted once, opens on Ctrl/Cmd+K
```

### 2.2 Menu (sidebar and drawer, identical)

Group order and item order are exactly `v2-portals.md` §5–§6 (94 items for Admin Pusat). Rendering rules:

| Rule | Spec |
|---|---|
| Groups | 9 groups in this order: Papan Pemuka, Pemantauan, Bank Soalan, Kertas & SPM, Kurikulum & Kandungan, Pengguna & Sekolah, Penglibatan, Kewangan, Sistem. A group with no visible item is not rendered (AC-03.5). |
| Group header | `text-overline text-dimmed`, 40px row, leading Lucide icon (below), trailing chevron. Collapsible (`UNavigationMenu` with children). Papan Pemuka (2 items) is always expanded and has no chevron. |
| Open state | Only the group that contains the active route is open on load/route change; others stay as the user left them; state persisted in `localStorage["pentadbiran_menu"]`. Keyboard: Enter/Space toggles, arrows move (Reka UI). |
| Nested groups | Pemantauan › Kirkpatrick (7 items) is a second-level collapsible; indented 16px; max depth 2. |
| Item | 40px row (48px under `pointer-coarse` and in the drawer), 20px icon at group level only (items inside groups have no icon, to stay calm), label `text-label`, truncates with tooltip + `title`. Badges: `LIVE` (`UBadge error solid`, pulse) on Langsung; count badges via `UChip`. |
| Active | `bg-primary/10`, `text-highlighted`, `font-semibold`, 3px leading primary bar, `aria-current="page"`. Active group header gets the same bar. Not colour-only. |
| Hover/focus | Hover `bg-elevated`; focus outline 2px primary. |
| Role filtering | Items are removed, never disabled or padlocked (AC-03.4). Pusat sees 9 groups; PPD/JPN: Pemantauan + Pengguna & Sekolah; Sekolah: Papan Pemuka, Pemantauan, Pengguna & Sekolah, Kewangan. |
| Collapsed rail (1024–1279 default) | 72px: group icons only, `UTooltip` with group name on hover/focus; clicking a group icon opens a flyout `UPopover` listing its items. Expand button at the top. |

Group icons (Lucide, single neutral colour, no per-group colours):

| Group | Icon | Group | Icon |
|---|---|---|---|
| Papan Pemuka | `i-lucide-layout-dashboard` | Pengguna & Sekolah | `i-lucide-school` |
| Pemantauan | `i-lucide-activity` | Penglibatan | `i-lucide-trophy` |
| Bank Soalan | `i-lucide-library-big` | Kewangan | `i-lucide-wallet` |
| Kertas & SPM | `i-lucide-scroll-text` | Sistem | `i-lucide-settings` |
| Kurikulum & Kandungan | `i-lucide-book-open` | | |

Item icons are not shown inside groups (calm staff density); the FA→Lucide mapping is used where an item appears as a Ctrl+K result (icon shown there).

### 2.3 Top bar

| Slot | ≥ md (768+) | < md (375) |
|---|---|---|
| Left | `UDashboardSidebarToggle` (< lg only) · page title (`text-heading`, one line, ellipsis) · subtitle (`text-caption text-muted`, ≥ md only) | Toggle (44px) · title (ellipsis) |
| Right | search trigger · `DsServerStatus` (Pusat, ≥ xl) · `DsRoleChip` · account menu | search icon button (44px, `aria-label="Cari"`) · account avatar button (44px) |
| Row 2 | none | **Scope bar** (44px, full width, `bg-elevated`, sticky with the top bar) holding the `DsRoleChip` (see 2.4) |
| Height | 56px (`--ui-header-height` 3.5rem) | row 1: 56px + row 2: 44px |

- Search trigger ≥ md: `UButton variant="outline" color="neutral"` "Cari halaman atau rekod…" + `UKbd` "Ctrl K" (macOS: "⌘ K"; the label is chosen by platform); width `w-64` at md, `w-80` at xl. At < md it is an icon button.
- There is **no notification bell** in the Pentadbiran top bar (replicated live omission, shells.md §2.3).
- Account menu (`UDropdownMenu`, trigger = avatar): header block (name, e-mel, role chip) · "Tetapan Peribadi" (→ `/tetapan`) · "Mod Paparan" sub-menu (Cerah / Gelap / Ikut Sistem, radio items) · "Masuk Mod Pelajar" (Admin Pusat and Admin Sekolah only, §3) · "Tukar Peranan" (only if ≥ 2 roles, opens the switcher) · separator · "Log Keluar" (`color="error"`). Rows ≥ 44px on touch.

### 2.4 Role and scope chip (`DsRoleChip`)

Copy (AC-04.1): "Admin Pusat · Kebangsaan" · "Pegawai PPD · {nama PPD}" · "Pegawai JPN · {negeri}" · "Admin Sekolah · {nama sekolah}". All strings from one copy table. Scope text is the same value the server applied.

| State | Spec |
|---|---|
| Single role | Static `UBadge variant="subtle" color="neutral" size="lg"`: leading role icon (`i-lucide-shield-check` Pusat, `i-lucide-map-pinned` PPD/JPN, `i-lucide-school` Sekolah), role (`font-semibold`) · scope. Not a button. |
| Dual role (≥ 2 roles) | Same look but a button (`UPopover`), trailing `i-lucide-chevrons-up-down`, `aria-haspopup="menu"`, label `aria-label="Peranan aktif: {peranan} {skop}. Tukar peranan"`. |
| Width | ≥ xl: full text. md–lg: full text, scope truncates at `max-w-64` with tooltip. < md: sits on the scope bar (row 2) at full text; scope ellipsis only if > 343px minus icon (tooltip + `title` carry the full value). |
| Pratonton/Mod | Not shown in Mod Pelajar (admin chrome is not rendered there). |

### 2.5 Role switcher

`UPopover` (≥ md) / `UDrawer` bottom sheet (< md), title "Tukar Peranan", description "Pilih peranan yang ingin anda gunakan. Menu dan data akan mengikut peranan itu."

```
┌ Tukar Peranan ───────────────────────┐
│ Pilih peranan yang ingin anda guna…  │
│ ( ) Guru · SK Taman Contoh      ✓    │  ← radio list, current has check + "Aktif"
│ ( ) Admin Sekolah · SK Taman Contoh  │
│                       [ Batal ]      │
└──────────────────────────────────────┘
```

- Each row ≥ 56px: role icon, "{peranan}" (`text-label`), "{skop}" (`text-caption text-muted`), portal hint ("Portal Pembelajaran" / "Portal Pentadbiran"), `UBadge` "Aktif" on current.
- Selecting a different role immediately: closes, shows a 2px top progress bar (`UProgress` indeterminate, max 800ms), re-computes portal/menu/chip/Ctrl+K index, routes to that role's home, then `UToast` success: "Peranan aktif: {peranan} · {skop}".
- Blocked while in Mod Pelajar (the control is not rendered there, AC-08.6).
- First sign-in of a dual-role account only: one-time `UToast` info "Anda mempunyai lebih daripada satu peranan. Tukar peranan di menu profil." (PROPOSED).

### 2.6 Ctrl+K palette (`UDashboardSearch`)

Trigger: Ctrl/Cmd+K anywhere in Pentadbiran; the search button in sidebar/top bar; at < md the icon button (AC-10.6). Esc closes; focus returns to the trigger/previous element.

| Viewport | Layout |
|---|---|
| 1280 | Centered modal 640px wide, top offset 15vh, max height 70vh; input 56px; results list scrolls inside |
| 768 | Same, width `min(90vw, 560px)` |
| 375 | **Full-height sheet** (`UDrawer`-style, top inset 8px, rounded top), input 56px with a visible "Tutup" text button on the right; results rows 56px |

```
┌──────────────────────────────────────────────┐
│ 🔍 Cari halaman atau rekod…             Esc  │
├──────────────────────────────────────────────┤
│ HALAMAN                                      │
│  ▸ Langsung            Pemantauan            │
│  ▸ Pengguna            Pengguna & Sekolah    │
│ REKOD                                        │
│  ▸ {nama pengguna}     Pengguna · {sekolah}  │
│  ▸ {nama sekolah}      Sekolah · {negeri}    │
│ TINDAKAN                                     │
│  ▸ Masuk Mod Pelajar                         │
│  ▸ Tukar Mod Paparan                         │
├──────────────────────────────────────────────┤
│ ↑ ↓ pilih   ↵ buka   Esc tutup               │
└──────────────────────────────────────────────┘
```

- Groups (headings `text-overline`): "Halaman", "Rekod", "Tindakan". Empty query shows "Terkini" (last 5 visited pages) then "Halaman" top items.
- Page results come from the same menu definition as the sidebar (role-filtered; an item the role cannot read never appears, AC-10.3). Record results (Pengguna, Sekolah) are server-scoped, debounced 150ms; while loading a `USkeleton` row shows.
- Matching is case/diacritic-insensitive, BM terms; fuse threshold 0.1 default.
- States: **no results** `UEmpty` "Tiada hasil untuk “{kata kunci}”" + "Cuba kata kunci lain atau semak ejaan."; **loading records** skeleton rows + "Mencari rekod…" (`aria-live="polite"`); **error** "Carian rekod tidak tersedia buat masa ini." + [Cuba Lagi]; page results still shown.
- "Masuk Mod Pelajar" appears only for roles allowed (§3). "Tukar Peranan" appears only with ≥ 2 roles.
- Combobox semantics: input `role="combobox"`, list `role="listbox"`, active option via `aria-activedescendant`.

### 2.7 Server status (`DsServerStatus`, Admin Pusat only, ≥ xl)

`UPopover` trigger in the top bar: compact `UBadge` group "CPU {x}% · RAM {y}% · Disk {z}%". Colours by threshold (old design-system §5 numbers kept: CPU >80 / RAM >85 / Disk >90 = `error`; CPU >50 / RAM >60 / Disk >75 = `warning`; else `success`), each with an icon (`i-lucide-cpu`, `i-lucide-memory-stick`, `i-lucide-hard-drive`) and the word, not colour alone. Popover adds Uptime and tooltips "Load: x / n cores", "{used}GB / {total}GB". Polls 30s while the tab is visible. First load shows "--"; a failed poll keeps last values. Below xl it is reachable through Sistem › Prestasi Sistem only.

### 2.8 Wireframes — Pentadbiran

**1280 (sidebar expanded 272px, content fluid, max 100rem)**

```
┌──────────────────┬──────────────────────────────────────────────────────────────────────┐
│ ▣ PRESTASIPLUS   │ Pemantauan › Langsung                (Cari… Ctrl K) (CPU 12% RAM 41%…)│
│ (Pentadbiran)  « │ Subtitle…                              (Admin Pusat · Kebangsaan) (AB)│
│ [🔍 Cari…  Ctrl K]├──────────────────────────────────────────────────────────────────────┤
│                  │                                                                      │
│ ▌◫ Papan Pemuka  │   DsPage content                                                     │
│    Dashboard     │   ┌ DsStat ┐ ┌ DsStat ┐ ┌ DsStat ┐ ┌ DsStat ┐                        │
│    Laporan Ekse… │   └────────┘ └────────┘ └────────┘ └────────┘                        │
│  ⌁ Pemantauan  ▾ │   ┌ DsDataTable ───────────────────────────────────────────────┐    │
│  ▤ Bank Soalan ▾ │   │ Filter…                                      [ Eksport ]   │    │
│  ▤ Kertas & SPM▾ │   │ …rows…                                                      │    │
│  … (9 groups)    │   └────────────────────────────────────────────────────────────┘    │
│                  │                                                                      │
│ (AB) Nama Pengg… │   © 2026 PRESTASIPLUS. Hakcipta Terpelihara.                         │
│  Admin Pusat   ▾ │                                                                      │
└──────────────────┴──────────────────────────────────────────────────────────────────────┘
```

**768 (no persistent sidebar; hamburger opens the drawer)**

```
┌────────────────────────────────────────────────────────────┐
│ [☰] Pemantauan › Langsung        [🔍 Cari… Ctrl K] (AB)    │ 56
│     (Admin Pusat · Kebangsaan)                              │  chip inline at md
├────────────────────────────────────────────────────────────┤
│  page gutter 24                                             │
│  ┌ DsStat ┐ ┌ DsStat ┐   (2 columns)                        │
│  ┌ DsDataTable (scrolls inside card)───────────────────┐    │
└────────────────────────────────────────────────────────────┘
Drawer open (slide-over from left, 320px, overlay bg-inverted/60):
┌──────────────────────┐
│ ▣ PRESTASIPLUS    ✕  │  full menu, 48px rows, same groups/order
│ (Pentadbiran)        │  footer: account block + © lines
└──────────────────────┘
```

**375**

```
┌───────────────────────────────────┐
│ [☰] Langsung            [🔍] (AB) │ 56  (title one line, ellipsis)
│ (Admin Pusat · Kebangsaan)      ▾ │ 44  scope bar (chip), sticky
├───────────────────────────────────┤
│ 16px gutter                       │
│ ┌ DsStat ┐ ┌ DsStat ┐ (2 cols)    │
│ ┌ DsDataTable → card list ──────┐ │
│ │ {nama}              {badge}   │ │
│ │ {sekolah} · {nilai}           │ │
│ └───────────────────────────────┘ │
└───────────────────────────────────┘
```

### 2.9 States

| State | Spec (copy) |
|---|---|
| Shell loading (first paint after login / role switch) | Sidebar and top bar render from the cached menu definition; `main` shows `USkeleton` blocks matching the page; top progress bar. No blank screen. |
| Menu with zero visible groups (misconfigured role) | `UEmpty` in main: title "Tiada menu untuk peranan ini", description "Sila hubungi Admin Pusat untuk menyemak akses anda.", action [Log Keluar]. |
| Session expired | `UModal` (not dismissible): "Sesi anda telah tamat", "Sila log masuk semula untuk meneruskan.", [Log Masuk]. Unsaved-form warning is out of scope. |
| Offline | `UAlert` (warning, persistent) under the top bar: "Anda sedang luar talian. Perubahan tidak akan disimpan." |
| Forbidden / 404 | §7 |

---

## 3. Mod Pelajar (admin tests the student portal as themselves — D31c)

Design principle: a **deliberate role transition**, never a silent shell change. Three cues are always present while the mode is on: the banner, the lime frame, and the changed tab title.

### 3.1 Entry

Entry points: account menu "Masuk Mod Pelajar", Ctrl+K action "Masuk Mod Pelajar". (Not in the main menu, not in any user row.) Visible to Admin Pusat and Admin Sekolah; hidden for Pegawai PPD/JPN and for dual-role accounts that are not currently an admin role. Q1 below on exact roles.

Confirmation dialog (`DsDialog`, `UModal` ≥ sm / bottom sheet < sm):

| Element | Copy (PROPOSED) |
|---|---|
| Title | "Masuk Mod Pelajar?" |
| Body | "Anda akan beralih ke Portal Pembelajaran dan melihat paparan murid menggunakan akaun anda sendiri ({nama}). Data yang anda cipta dalam mod ini ditanda sebagai data ujian." |
| Actions | [Masuk Mod Pelajar] (primary, right) · [Batal] (outline, left) |

On confirm: top progress bar (≤ 600ms) → route to the Murid home → `UToast` info "Anda kini dalam Mod Pelajar. Gunakan “Keluar Mod Pelajar” di bahagian atas untuk kembali." Focus moves to the banner's exit button on arrival (announced), then the user continues.

### 3.2 While active

| Cue | Spec |
|---|---|
| Banner (`DsModeBanner` on `UBanner`, **not closable**) | Full-width, in normal flow above the shell (shell height = viewport − banner, so nothing is overlapped and no offset hacks are needed). Fill `bg-highlight` + `text-on-highlight` (13.5:1), 2px bottom `border-inverted`. Leading `i-lucide-flask-conical`. |
| Banner ≥ md (min-height 48px) | "**Mod Pelajar** — anda sedang menguji paparan murid sebagai {nama}. Data yang dicipta ditanda sebagai data ujian." · [Keluar Mod Pelajar] (`UButton color="neutral" variant="solid"` inverted, 44px) |
| Banner < md (375, 48px, one row) | `Mod Pelajar` · [Keluar Mod Pelajar]; the long sentence moves into an info button (`i-lucide-info`, 44px) that opens a `UPopover` with the same sentence. |
| Frame | While active the viewport has a 4px inset ring in `secondary` around the whole app (`data-mode="student-test"` on the shell root). Also visible at 375. |
| Tab title | Prefixed "[Mod Pelajar] ". |
| Admin chrome | Not rendered; the Murid shell is shown with the admin's own name and role chip hidden. The role switcher and "Masuk Mod Pelajar" are not rendered. The account menu keeps "Mod Paparan", "Tetapan Peribadi", "Log Keluar" and adds "Keluar Mod Pelajar" at the top. |
| Test data | Items the admin creates show a small `UBadge` "Data ujian" (`color="warning"`, solid, with `i-lucide-flask-conical`) wherever they would appear in lists the admin can see. |
| Guard | Navigating to any `/admin…` URL in this mode redirects to the Murid home with `UToast` warning "Keluar Mod Pelajar dahulu untuk ke Portal Pentadbiran." |

### 3.3 Exit

[Keluar Mod Pelajar] (banner, account menu) → no confirmation (non-destructive) → progress bar → returns to the **Pentadbiran page the admin came from** (stored on entry; fallback Papan Pemuka) → `UToast` success "Anda telah keluar daripada Mod Pelajar." Browser Back after exit does not re-enter the mode (history entry replaced). If the session ends while in the mode, normal logout rules apply.

### 3.4 Wireframes

```
1280                                                             375
┌─────────────────────────────────────────────────────────┐  ┌───────────────────────────────┐
│▒ ⚗ Mod Pelajar — anda sedang menguji paparan murid sebagai {nama}…    [Keluar Mod Pelajar] ▒│  │▒ ⚗ Mod Pelajar  (i) [Keluar Mod Pelajar]▒│
│▒┌──────────────┬────────────────────────────────────┐▒│  │▒ [logo]   (🔥3) (🪙120) (🔔) (AB)  ▒│
│▒│ Murid shell  │ …                                  │▒│  │▒ …content…                         ▒│
│▒└──────────────┴────────────────────────────────────┘▒│  │▒ [Utama][SPM][Game][Topik][Lagi]  ▒│
└─────────────────────────────────────────────────────────┘  └───────────────────────────────┘
▒ = 4px secondary (lime) inset frame
```

---

## 4. Pemantauan › Langsung (live monitoring) and full-screen

### 4.1 Normal view (inside the Pentadbiran shell, same tab — AC-09.1)

Page = `DsPage` titled "Langsung". Content uses the **shared drill-down components** with the guru Command Center (AC-09.4): `DsLiveTiles`, `DsDrillTable` are *props-driven* views of one data contract; Guru starts at own classes, Pusat at national list, PPD at district, Sekolah at own school. (These two are added to the L2 inventory only as thin wrappers over `DsStat` / `DsDataTable`: no new visual language. Approval item Q4.)

```
1280
┌ Langsung  ( ● LANGSUNG ) Dikemas kini 14:32:05      [ Jeda ] [ ⤢ Skrin Penuh ] ┐
│ Skop: {Kebangsaan}                                                              │
│ ┌ DsStat ─┐ ┌ DsStat ─┐ ┌ DsStat ─┐ ┌ DsStat ─┐   metrik langsung (kandungan M17)│
│ Breadcrumb:  Semua Sekolah › {Sekolah} › {Guru} › {Kelas} › {Murid}            │
│ ┌ DsDataTable (level semasa: sekolah / guru / kelas / murid) ──────────────────┐│
│ │ Nama | Aktif sekarang | Aktiviti terakhir | Skor purata | ›                  ││
│ └──────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

- "● LANGSUNG" = `UBadge color="error"`, `live-pulse` (static dot under reduced motion), word always present.
- [Jeda] / [Sambung] toggles auto-update (WCAG 2.2.2). While paused the badge reads "DIJEDA" (`neutral`) and the timestamp stops.
- Connection states: "Menyambung…" (spinner), "LANGSUNG" (ok), "Terputus — mencuba semula…" (`warning`, with [Cuba Lagi]).
- Drill-down row click or Enter opens the next level in place (same route with query, back button works). Row chevron `i-lucide-chevron-right`. Out-of-scope target → 404 page (AC-09.5).
- < md: tiles 2×2, breadcrumb collapses to `UBreadcrumb` showing the last two crumbs with an ellipsis menu, table becomes a card list; [Skrin Penuh] stays visible in the page header (icon + label).

### 4.2 Full-screen mode (AC-09.2, US-16 AC-16.4)

Enter via [⤢ Skrin Penuh] (`aria-pressed`), or key `F` when focus is inside the page. Implementation intent: hide sidebar, top bar and footer (pseudo full-screen — a fixed layer filling `100dvh`) **and** request the browser Fullscreen API where available (iOS Safari does not support it for non-video; the pseudo mode alone is then used). Live updates keep running across the toggle (same component instance, no remount).

```
Full-screen 1280 (wall-display type scale: `data-view="wall"` raises the type tokens one step)
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ● LANGSUNG  Langsung · {Kebangsaan}   Kemas kini 14:32:05      [Jeda] [✕ Keluar Skrin Penuh  Esc]│ 56
├──────────────────────────────────────────────────────────────────────────────────┤
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐                       │
│ │   {angka}  │ │   {angka}  │ │   {angka}  │ │   {angka}  │  display numerals     │
│ │   label    │ │   label    │ │   label    │ │   label    │                       │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘                       │
│ Semua Sekolah › {Sekolah} › {Guru}                                               │
│ ┌ table / cards (internal scroll) ───────────────────────────────────────────────┐│
└──────────────────────────────────────────────────────────────────────────────────┘

Full-screen 375
┌───────────────────────────────┐
│ ● LANGSUNG        [Jeda] [✕]  │ 56  (✕ = 44px, aria-label "Keluar skrin penuh")
├───────────────────────────────┤
│ ┌ tile ┐ ┌ tile ┐  2×2        │
│ ┌ tile ┐ ┌ tile ┐             │
│ ‹ {Sekolah}   (back crumb)    │ 44  last crumb + back, full path in a menu
│ card list (internal scroll)   │
└───────────────────────────────┘
```

- Exit control is always visible (top-right, 44px, labelled, with `UKbd` "Esc" on keyboard devices). Esc exits (also when the browser exits Fullscreen itself — state is synced to the `fullscreenchange` event). Focus returns to the [Skrin Penuh] button.
- The strip does not auto-hide (accessibility); the page content scrolls below it.
- Wall view: type tokens step up (`text-display` becomes the tile value), grid becomes 4×1 at ≥ 1280 and 2×2 below; contrast and colour rules unchanged. `prefers-reduced-motion` stops the pulse and number tick animations.
- Tile values update in place; a visually hidden `aria-live="off"` region is used (not chatty); a polite summary is announced only when the user presses [Jeda] ("Kemas kini dijeda pada 14:32:05").

---

## 5. Portal Pembelajaran

### 5.1 Murid (learner density)

Menu groups (BM labels exactly as `v2-portals.md` §8; items per `user-nav.ts`; emoji in group labels are kept as copy): top items (Dashboard, Target SPM, Misi Harian, Remedial) · SPM · Pembelajaran · Pusat AI · 🏆 Bilik Duta · ✨ Visi & Pertandingan · 💎 Killer Features · Akaun & Bantuan (Profil Saya, Tetapan Peribadi, Panduan, Tiket Bantuan, Log Keluar). One definition feeds sidebar and drawer. "Command Center" and other admin/guru blocks are not shown (US-14).

| Region | 1280 | 768 | 375 |
|---|---|---|---|
| Nav | Sidebar 272px: logo, identity card (avatar, name, level, XP `UProgress` with numbers), groups as `UNavigationMenu` (group headers `text-overline`, items 44px, 20px coloured-neutral icons, badges LIVE/NEW/AI/PRO/SPM as `UBadge`) | Bottom tab bar (5 tabs) + drawer | Bottom tab bar (5 tabs) + drawer |
| Top bar | Title, reward chips, bell, avatar menu | logo, title, chips, bell, avatar | logo (→ Utama), streak chip, coin chip, bell, avatar |
| Content | `--ui-container` 72rem centred, gutters 32 | gutters 24 | gutters 16 |
| Chat | Floating Cikgu Alesa button (56px, bottom-right) | same, above the tab bar | same |

**Bottom tab bar (`DsBottomNav`)**: 64px + safe area, `bg-default`, top border `border-default`. Five tabs: **Home**, **SPM**, **Game**, **Topik**, **Lagi** (labels as live; "Home"/"Game" are live copy). Each tab: icon 24px + label `text-caption` (12px), `flex-1`, min 64×64 hit area. Active: `text-primary`, filled icon weight swap (stroke 2.5) + 3px top bar `bg-primary` + `aria-current="page"` (not colour-only). "Lagi" opens the complete drawer (`USlideover` from the right, width `min(88vw, 360px)`), same menu as the sidebar. The live "Chat" tab moves to the floating Cikgu Alesa button (Q3).

```
375 — Murid
┌───────────────────────────────────┐
│ ▣        (🔥 5) (🪙 120) (🔔3) (AB)│ 56
├───────────────────────────────────┤
│  Selamat datang, {nama}           │
│  ┌ hero card (inverted+songket) ─┐│
│  │ Tahap 4   ◔ 68%   [Mula]      ││  shadow-pop
│  └───────────────────────────────┘│
│  ┌ DsStat ┐ ┌ DsStat ┐            │
│                         (💬) 56px │ ← Cikgu Alesa
├───────────────────────────────────┤
│ [⌂ Home][SPM][Game][Topik][⋯ Lagi]│ 64
└───────────────────────────────────┘
```

Header chips: streak (`UBadge reward soft` + flame icon + number + word "hari" visible ≥ md, `aria-label` at < md), coin (`reward` + `i-lucide-coins`), bell (`UChip` count, 99+ cap). Tap targets 44px.

### 5.2 Guru (staff density)

Same shell with the staff density and the Guru menu (v2-portals §8: Command Center (LIVE), HARIAN, PENGAJARAN, PENILAIAN, ANALITIK (Monitoring, Kirkpatrick), PUSAT AI, BANK SOALAN, AKTIVITI, LAIN-LAIN, Bantuan). Monitoring, Kirkpatrick and Command Center render **in this learning layout** (US-14). ≥ lg sidebar + top bar (title, bell, avatar; role chip "Guru · {sekolah}" only for dual-role accounts). < lg: top bar + **bottom tab bar** with four primary destinations and "Lagi": proposed Dashboard Guru · Kelas · Command Center · Penilaian · Lagi (the first four are configured in the nav data `bottomNav` field; final picks by the owning modules). Labels use group names as in the menu; a 12px label must fit 64px or truncate with `title`.

### 5.3 Ibu Bapa and Penaja (simple variant, staff density)

Few items (§8: Dashboard, linked-child views, consent approvals, Akaun & Bantuan; Penaja home, Akaun & Bantuan). No sidebar and no bottom bar: top bar with logo, **horizontal `UNavigationMenu`** at ≥ md (max 5 items), hamburger + drawer < md. Content max width 64rem centred.

---

## 6. Authentication and portal routing

One login (US-01, Q9 default). The guest layout `DsShellAuth` is shared; there is no separate admin login.

### 6.1 Login (`/login`)

Fields (labels as M01 S1 unless noted): "Alamat Email atau Nama Pengguna" (PROPOSED; the .cloud model accepts both) · "Sekolah" (`USelectMenu` searchable, shown **only** when the identifier contains no "@"; hint PROPOSED "Pilih sekolah anda jika log masuk dengan nama pengguna.") · "Kata Laluan" (show/hide toggle `aria-pressed`, label "Tunjuk kata laluan") · "Ingat saya" (`UCheckbox`, unticked) · [Log Masuk]. Links verbatim from FR-M01-06: "Lupa kata laluan?", "Reset melalui No IC", "Belum ada akaun? Daftar Sekarang 🚀", "Kembali ke Laman Utama". Google sign-in: [Log masuk dengan Google] (outline) only if SSO is enabled (F-04).
Heading: "Selamat Kembali! 👋" (existing). Sub-heading unchanged from M01.

```
1280 (split 5/7)                                       768 (centered card, brand strip on top)
┌───────────────────────┬─────────────────────────┐   ┌─────────────────────────────────┐
│ ink-950 + songket     │  Selamat Kembali! 👋     │   │ ▣ PRESTASIPLUS   (songket strip)│
│  ▣ PRESTASIPLUS       │  Alamat Email atau Nama… │   │ ┌ card max-w-md ─────────────┐ │
│  Sedia untuk SPM.     │  [______________________]│   │ │ Selamat Kembali! 👋        │ │
│  (display, white)     │  Sekolah [____________▾] │   │ │ fields…   [ Log Masuk ]    │ │
│                       │  Kata Laluan [____] (👁) │   │ └────────────────────────────┘ │
│  Didikan penuh ❤️ …   │  [x] Ingat saya          │   └─────────────────────────────────┘
│                       │  [      Log Masuk      ] │   375: single column, no brand panel,
│                       │  Lupa kata laluan? …     │   logo 40px on top, fields full width,
└───────────────────────┴─────────────────────────┘   [Log Masuk] 48px full width, 16px gutters
```

States and exact errors (AC-01.4–01.7; shown in a `UAlert color="error"` above the fields, focus moves to it, `role="alert"`):

| State | Copy |
|---|---|
| Invalid credentials | "E-mel/Nama pengguna atau kata laluan tidak sah." |
| Inactive/suspended | "Akaun anda tidak aktif atau telah digantung. Sila hubungi pentadbir." |
| School not active | "Sekolah anda belum diaktifkan oleh pentadbir. Sila hubungi pihak sekolah." |
| Ambiguous username | The ambiguity message from M01 (exact copy per `web.php:448` in the SRS); the Sekolah field receives focus. |
| Submitting | [Log Masuk] → `loading` ("Sedang Memasuki…" as live), fields disabled |
| Throttled / network | "Ralat rangkaian. Sila cuba lagi." (existing generic) |
| Already signed in | Redirect to the role home (AC-01.8); no flash of the form. |

### 6.2 Post-login routing (AC-01.2/01.3/01.10, US-02)

| Account state | Lands on | Transition |
|---|---|---|
| Admin Pusat / Admin Sekolah | Pentadbiran › Papan Pemuka | Shell skeleton + progress bar (≤ 800ms) |
| Pegawai PPD / JPN | Pentadbiran › Pemantauan › Papan Pemuka Wilayah (PM-14) | same |
| Guru | Dashboard Guru | Pembelajaran shell skeleton |
| Murid | Dashboard Murid | same |
| Ibu Bapa / Penaja | Dashboard / Penaja home | same |
| Dual role | Portal of the last-active role (default: first role in fixed order) — **no chooser screen**; one-time info toast (§2.5) | same |
| Guest on a protected URL | `/login` with no redirect parameter (AC-01.1) | — |
| Learner opens a Pentadbiran URL | Redirect to own home (AC-02.2) + `UToast` info "Halaman itu hanya untuk Portal Pentadbiran." (PROPOSED) | — |
| Staff-only user opens a Pembelajaran role page | Redirect to own home (AC-02.3), same toast pattern ("Halaman itu hanya untuk Portal Pembelajaran.") | — |

Logout: account menu → "Log Keluar" → `/login`; Back must not show protected data (AC-01.9). Registration, password reset and the ibu-bapa invitation screens use `DsShellAuth` with the same split/centered/single-column rules (copy per M01).

---

## 7. Empty, forbidden, 404 and error states

All render **inside the user's own portal shell** (sidebar and top bar stay), except unauthenticated, which uses `DsShellAuth`. Component: `DsErrorPage` on `UError`/`UEmpty` with an illustration; centred, `max-w-md`, vertical padding 48/64px. No gradient backgrounds (old 404/403 gradient pages retired).

| State | Illustration | Heading (`text-title`) | Body (`text-body text-muted`) | Actions |
|---|---|---|---|---|
| **403 Pentadbiran, Pusat-only page** | `403` | Name of the page, then "Akses Ditolak" | "Halaman ini diuruskan oleh Admin Pusat sahaja." | [Kembali ke Papan Pemuka] (PPD/JPN: landing "Kembali ke Papan Pemuka Wilayah"); the item is absent from the menu (AC-06.4) |
| **403 Pentadbiran, other** | `403` | "Akses Ditolak" | "Halaman ini tidak tersedia untuk peranan anda." | same button |
| **403 Pembelajaran (legacy copy)** | `403` | "Akses Ditolak" | "Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir." | [Halaman Utama] · [Log Masuk] (outline) |
| **404 Pentadbiran** | `404` | "Halaman Tidak Dijumpai" | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?" | [Kembali ke Papan Pemuka] · [Cari (Ctrl K)] |
| **404 Pembelajaran** | `404` | "Halaman Tidak Dijumpai" | same | [Halaman Utama] · [Mula Latihan] (outline) |
| Out-of-scope record (AC-06.6) | `404` | same as 404 | same (existence is not disclosed) | same |
| **Unexpected error** | `ralat` | "Sesuatu tidak kena" (PROPOSED) | "Kami tidak dapat memuatkan halaman ini. Cuba lagi sebentar." | [Cuba Lagi] · [Kembali] |
| **Empty list (first use)** | `kosong` | "Tiada {item} lagi" | context line | Primary create action if permitted (e.g. "Tambah Soalan Pertama") |
| **Empty (filter)** | `tiada-hasil` | "Tiada {item} dijumpai" | "Tiada hasil untuk penapis semasa." | [Set Semula Penapis] |
| **Loading** | — | — | `USkeleton` shapes matching the layout; spinner only on buttons | — |

Layout across widths: illustration 160px (120px at 375); actions row at ≥ sm, stacked full-width (48px) at < sm. Status codes: 403/404 pages return the matching HTTP status when served by the real backend; the prototype sets `document.title` "Akses Ditolak - PRESTASIPLUS" / "Halaman Tidak Dijumpai - PRESTASIPLUS".

---

## 8. Interaction notes

- **Menu data is the single source.** Sidebar, drawer, bottom bar, Ctrl+K pages and 403 checks read the same role-filtered definition; there is no padlocked item anywhere.
- **Sidebar toggle** persisted per user/device (`localStorage["pentadbiran_sidebar"]`), keyboard shortcut none (avoid conflicts); rail ↔ expanded animates width 160ms (none under reduced motion).
- **Drawer** closes on route change, Esc, overlay tap, swipe-left (touch); focus trapped inside; returns to the hamburger.
- **Tab bar** ("Lagi") opens the same drawer component as the hamburger (< lg) with the complete menu.
- **Colour mode** change is instant, persisted, and respects `prefers-color-scheme` when "Ikut Sistem"; no flash of wrong theme (script sets `.dark` before first paint).
- **Long labels**: nav and chip text truncate with ellipsis plus `title`/tooltip; they never wrap and never force horizontal scroll.
- **Keyboard**: Tab order follows DOM order (§1); Ctrl/Cmd+K global in Pentadbiran; Esc closes the topmost overlay; `F` toggles full-screen only when focus is inside the Langsung page and not in an input.
- **Back button**: drill-down levels, full-screen state and drawer do not add junk history entries (drawer/full-screen use no history; drill-down uses query params).

## 9. Accessibility checklist (shells)

| # | Check | Where |
|---|---|---|
| 1 | Skip link first, visible on focus, 44px | all shells |
| 2 | Landmarks: header, nav (named), main, bottom nav (named), single `h1` per page | all |
| 3 | `aria-current="page"` on active menu item and tab; active state not colour-only | menus, tab bar |
| 4 | Every interactive target ≥ 44×44 on touch: hamburger, search, avatar, chips, tabs, rows in drawers/palette, exit full-screen, banner button | 375/768 |
| 5 | Focus visible 2px outline (≥ 3:1) everywhere; no focus loss when drawer/palette/switcher/dialogs close (returns to trigger) | all |
| 6 | Palette is a combobox/listbox with `aria-activedescendant`; results count announced politely | Ctrl+K |
| 7 | Role chip has an accessible name with role, scope and (if switchable) the action; switcher is a radio list | chip/switcher |
| 8 | Mod Pelajar: banner is a labelled region (`aria-label="Mod Pelajar"`), exit button first focus on entry, state also conveyed by text + frame, not colour alone | §3 |
| 9 | Live data: pause control present (2.2.2), LIVE status has the word, updates are not announced per tick, reduced motion removes pulse | §4 |
| 10 | Full-screen: exit via Esc and a visible button; focus returns; works without the Fullscreen API | §4.2 |
| 11 | Forms: labels, hint/error association, error summary focus, 16px inputs, `autocomplete` (`username`, `current-password`), password toggle `aria-pressed` | login |
| 12 | Contrast per design-system §3.3 in light and dark for every chrome element, including lime banner (13.5:1) and chips | all |
| 13 | No horizontal page scroll at 320/375/768/1280 in light and dark: login, home of each portal, a group's first page, 403/404, Langsung (normal and full-screen), Ctrl+K, switcher, banner (checked by e2e G-10) | all |
| 14 | Reduced motion and 200% zoom / text spacing do not break the chrome (top bar rows wrap to the scope bar; chips truncate with tooltip) | all |
| 15 | `<html lang="ms">`; document title set per route; tab title prefixed in Mod Pelajar | all |

---

## 10. Open questions (blocking only; each with a recommended default applied above)

| # | Question | Recommended default |
|---|---|---|
| Q1 | **Mod Pelajar** (D31c) vs `v2-portals.md` US-07 "Pratonton" (new tab, chosen student, read-only): D31c supersedes it. Confirm: same tab, admin acts as themselves, full actions, data marked as test data, available to **Admin Pusat and Admin Sekolah** (not PPD/JPN), and the "Pratonton" row action in Pengguna is dropped. | Yes to all. Same tab so it is a visible role transition, not a hidden second session. |
| Q2 | Pentadbiran mobile has **no bottom nav** (9 groups cannot fit); drawer + search + scope bar instead. Dropping the live "Lagi" popover subset means the full menu is reachable on mobile. | Approve. |
| Q3 | Murid bottom bar becomes 5 tabs (Home, SPM, Game, Topik, Lagi) and the live "Chat" tab becomes a floating Cikgu Alesa button on all sizes. | Approve. |
| Q4 | Two thin L2 wrappers for the shared Langsung/Command Center components (`DsLiveTiles`, `DsDrillTable`) are added to the pattern inventory (built only from `DsStat`/`DsDataTable`). | Approve. |
| Q5 | Dual-role first sign-in lands in the last/first role with a one-time toast instead of a role-chooser screen (AC-01.10 default). | Approve. |
| Q6 | Which Guru destinations occupy the four guru tab-bar slots (proposed Dashboard Guru, Kelas, Command Center, Penilaian)? | Use the proposal; owning modules may adjust through the nav data without design change. |
| Q7 | Login identifier: one "Alamat Email atau Nama Pengguna" field with the Sekolah picker appearing only for non-email input (PROPOSED labels/hints), replacing the two-mode .cloud form. | Approve; exact M01 labels used where they exist. |
