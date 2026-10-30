# Portal Pentadbiran - page templates (one design language, DS components only)

| Field | Value |
|---|---|
| Slug | `v2-admin-page-templates` |
| Version | 1.0, 2026-10-29 |
| Author | ui-ux-designer |
| Status | **Proposed - needs product-owner approval** (open questions in section 7) |
| Plan | Step 1 of 4: templates -> strict lint -> migrate pages by family -> re-audit |
| Evidence | Audit 2026-10-29 (`pp-design-audit`): visual (37 screens, families A-G, top-10 problems) and code (82 page components, 5,653 class tokens of debt) |
| Builds on | `v2-design-language.md` (anatomy 9.x, states 10), `v2-design-system.md` (tokens), `v2-admin-pages.md` (shell, list), `v2-ds-hardening.md` (primitives, lint 6.2), `v2-copy-glossary.md` (BM) |
| Scope | Portal Pentadbiran only (`/admin/**`, `/guru/monitoring/**` as listed in the admin menu). The learner portal reuses these templates later. |
| Language | Doc English; every UI string is exact BM |

## 0. Decisions this document implements (product owner, 2026-10-29)

1. The portal has **one design language**. A page is a *template* filled with design-system components. No custom or ad-hoc classes in pages.
2. Strictness = **FULL**: a page file may only compose `src/ds` `Ds*` components and the Nuxt UI components the DS sanctions (section 4, rule R7). Layout, spacing, typography, colour and surface utilities exist only inside `src/ds` (and `src/theme`). Lint fails the build otherwise.
3. `/admin` lands on a new simple **Dashboard** (KPIs + "Lihat Semua" links, design language 9.5). The Command Center stays as menu item "Langsung".
4. Command Center headers lose the LIVE badge, the MYT clock and the in-header "Dashboard" / "Aktiviti Harian" buttons (sidebar and navbar already navigate). "Cari menu" (Ctrl+K) moves from the top bar into the sidebar under the (centred) logo. Darjah / primary levels are hidden system-wide (secondary T1-T5 only).

## 1. Page anatomy (the rules every portal page follows)

**Owner priority (2026-10-29): a proper, consistent design language and aesthetic quality. When a template choice is a trade-off, favour visual consistency and polish.**

### 1.0 The one-line rules

| # | Item | Rule |
|---|---|---|
| 1.1 | Title | The shell navbar prints the one `h1` = the sidebar item label (bare noun). A page never prints a title (`DsPage` leaves `title` unset; `showTitle="auto"` already hides it). |
| 1.2 | Subtitle and actions | `DsPageHeader` row: at most one sentence of subtitle on the left; on the right at most two tonal secondary buttons, then exactly one primary (`UButton`, solid, `icon="plus"` for an add) last. |
| 1.3 | Count display | No "Jumlah: N ..." line in the header. The total is the first KPI tile (if the page has a KPI strip) or the pager summary "Menunjukkan 1-20 daripada 245 hasil". |
| 1.4 | Width and gutter | Every page fills the shell content area (shell caps at 1600px; shell pads 16px below `md`, 24px from `md`). Pages never set width, centre, or pad. Forms are not narrowed (no 768px centred column). |
| 1.5 | Vertical rhythm | `DsPage` gap only: 24px from `md`, 20px below. Inside a panel the gap is `DsStack gap="md"` (16px). No other spacing. |
| 1.6 | Back link | `DsPage backTo` only; label is always the default "Kembali" (never "Kembali ke X"); sits above the title row, left-aligned. Used only on pages deeper than a menu item (create, edit, detail, drill-down). Never right-aligned, never in `#actions`. |
| 1.7 | In-page navigation | **`DsPillNav`** in the `#tabs` slot, at most one per page. `UTabs`, button rows, link rows and icon-pill duplicates are removed. It is used only for sibling views that share one page frame (period switch, status filter with counts, the five Kirkpatrick screens, section 8). |
| 1.8 | Title and breadcrumb naming | BM only, **bare noun** (no "Pengurusan X"). Title = sidebar item label exactly. Breadcrumb = sidebar group (and sub-group) exactly. Create/edit pages: "Tambah {Entiti}" / "Edit {Entiti}" with the list noun as the last crumb. |
| 1.9 | Filter bar | One `DsFilterBar` per page: search grows + **Cari**, at most 3 inline selects, the rest in "Lagi Penapis" popover, active chips under the bar, "Set Semula" only when active, below `md` a "Penapis" button opens a bottom drawer with **Guna**. Never "Tapis", never visible field labels, never a second row. |
| 1.10 | Table | `DsDataTable variant="flush"` inside the page (no wrapper panel), `density="cozy"` (rows about 56px), sticky header, zebra, pager with page-size select, actions column last through `DsRowActions`, `layout="fixed"` with set column widths so nothing clips from `xl`, every table defines `cardTitle` + `cardFields` for the `< md` card list. |
| 1.11 | KPI strip | `DsStatRow density="roomy"`, 2 to 5 tiles, the last row always full (no orphan tile, section 1.7.1), numbers formatted with a thousands comma ("1,271"), one accent per tile from the fixed order. |
| 1.12 | States | Loading = skeleton from the component (`loading` prop or `DsStateView`), never a spinner. Empty = `DsEmptyState` (never raw "Tiada data."). Error = one `DsLoadError` per region. Copy from `dsCopy` and the glossary (section 1.8). |
| 1.13 | Add wording | One verb per object type, chosen by context (owner decision Q3): **Daftar {Entiti}** when registering an entity with an identity (a person, school, account or subscription: Pengguna, Sekolah, Pelajar Komplimen, Langganan); **Tambah {Item}** for every other record or content item (Soalan, Banner, Nota, Tindakan...); **Muat Naik {X}** for a file upload; **Import {X}** for a bulk import. "Cipta", "Daftar Baru", "Beri Akses Baru", "Langganan Baru", "Buat Baru", "Baharu" are retired. |

### 1.1 Anatomy wireframe (1280, list archetype, the model for the rest)

```
+----------------------------------------------------------------------------------------+
| sidebar (logo centred, [Cari menu  Ctrl K] under it, groups)  | navbar 64: [menu] Group / TITLE   scope  mode |
|                                                               +-----------------------------------------------+
|                                                               | [< Kembali]                  (only if deeper) |
|                                                               | subtitle (1 line)       [tonal][tonal][PRIMARY]|  DsPageHeader
|                                                               | [KPI][KPI][KPI][KPI][KPI]                     |  DsStatRow (2..5)
|                                                               | DsFilterBar [Cari....][Cari][v][v][v][Lagi]    |
|                                                               | Penapis aktif: [x][x]  Set Semula             |
|                                                               | DsDataTable flush (header sticky, zebra 56px) |
|                                                               | Menunjukkan 1-20 daripada 245 hasil  < 1 2 3 > |
+----------------------------------------------------------------------------------------+
```

Order is fixed: back link, header row, tabs (if any), KPI strip, filter bar, body panels. A template omits a slot; it never reorders.

### 1.2 Title source (1.1) - details

- `DsPage` is always `layout="..."` and never has `title`. The shell navbar already prints `Group / Title` (`provideShellTitle()`); this stays the single `h1`.
- Navbar `h1` size: the audit measured 16px on every page while the language doc says `text-title` 24px. Proposed default: navbar title uses `text-heading` (20px) at `lg`+ and `text-subheading` (16px) below `lg` (open question Q2). This is a shell-internal (DS) change, never a page decision.
- Detail pages (school, student, subscription): the navbar title stays the list noun. The shell gets one hook, `useShellEntityTitle(name)` (DS change D11, called S2 in the text), that appends the entity as the last crumb ("Pemantauan / Langsung / SMK Demo Satu"). Until it exists, the entity name goes in `#meta` of `DsPageHeader` as `DsText variant="heading"`. In-page breadcrumbs (`DsBreadcrumb` inside a page) are removed.
- The "Papan Pemuka" landing page title is the menu item "Dashboard" (open question Q4).

### 1.3 Header slot (1.2) - details

| Element | Spec |
|---|---|
| Subtitle | `DsPage subtitle="..."`, one sentence, no full stop needed, `max-w-prose` is built in. Explains the page, never repeats the title or a count. Optional; omit when the title is obvious. |
| Secondary actions | `UButton color="neutral" variant="soft"`, max two, e.g. "Import Pelajar", "Muat Turun Templat". Three or more = the third goes to a `DsRowActions`-style menu (`UDropdownMenu` with label "Lagi Tindakan"). |
| Primary action | One `UButton` (default colour, solid), last, `icon="plus"` and label "Tambah {Entiti}". Pages without a create action have no primary. |
| Placement | `DsPageHeader` already right-aligns `#actions` at `sm`+ and stacks them under the subtitle below `sm`; actions go full width in the order secondary, primary. |
| Status / meta | Entity status badges only on detail pages through `#meta` (`DsStatusBadge` or `DsBadge`). Boards have no status row (no LIVE badge, no clock). |
| Forbidden | Local `h1`/`h2` that repeats the navbar title (subjects, education-levels today), "Jumlah: N" sentences, a tab row above the subtitle, a back button inside `#actions`. |

### 1.4 Width, gutter, rhythm (1.4, 1.5)

| Property | Value | Owner |
|---|---|---|
| Content width | shell content, max 1600px, left edge identical on every page (x=280 at 1280 with the open sidebar) | `DsPage` staff = `max-w-none`, never `mx-auto` narrowing (DS change D1: `form` layout = full width in staff) |
| Gutter | 16px below `md`, 24px from `md` | shell `main` |
| Section gap | 24px (>= `md`), 20px below | `DsPage gap="section"` |
| Panel padding | 16px mobile / 20px | `DsPanel` |
| Card / form-section padding | 16 / 24 | `DsFormSection` |
| Grid gap inside a page | `DsGrid gap="md"` (16) for tiles, `DsSplit gap="lg"` (24) for main + aside | primitives |
| Max nesting | page -> panel -> (table | list | chart | `DsSurface` row). Never panel in panel, never a tile row inside a panel (put the `DsStatRow` on the page). | review rule R12 |

### 1.5 Back link (1.6) - details

| Page kind | Back target | Label |
|---|---|---|
| Create / edit | the list | Kembali |
| Detail | the list (or the parent board) | Kembali |
| Drill-down (Langsung > sekolah > guru/kelas/murid) | the parent board | Kembali |
| Import page | the list it feeds | Kembali |
| Menu-item pages, tabbed reports | none | - |

`DsBackLink` is rendered by `DsPage backTo` only. Pages never use `UButton to=... icon="i-ph-arrow-left"`.

### 1.6 Filter bar (1.9) - details

Component: `DsFilterBar` (one per page; no second filter surface). Fields are `UInput` (search, `#search` slot, placeholder "Cari {benda}...") and `DsNativeSelect` (default slot, first option "Semua {benda}"; no visible label, `aria-label` = the noun).

| Part | Spec |
|---|---|
| Inline controls | search + at most 3 selects at `md`+; everything else in `#more` ("Lagi Penapis" popover with the count badge `moreCount`) |
| Apply | **Cari** (inline), **Guna** (drawer footer). Reset = **Set Semula**, shown only when `activeCount > 0` or `chips` non-empty |
| Chips | pass `chips` for every applied filter; label = the value ("Tahun 2026"); the bar prints "Penapis aktif:" + removable chips (aria "Buang penapis {nama}") + "Set Semula" |
| State | URL query is the state; `apply` pushes the query |
| Below `md` | search + "Penapis" button (count chip); drawer lists the other fields, "Guna", "Set Semula" |
| Labelled-field filters today (curriculum, Kirkpatrick, behavior, monitoring) | become the same bar; the field's noun moves into the blank option ("Semua Sekolah", "Semua Negeri", "Semua Tahap") |
| Select-only pages (semakan, kirkpatrick) | same bar with no `#search`; the Cari button stays (one apply word) |

### 1.7 Table (1.10) and KPI strip (1.11) - details

**Table: `DsDataTable`** (spec for all list pages; `DsDrillTable` only for the Pemantauan sekolah > guru > kelas > murid drill-down, where it scrolls inside its own container by design).

| Property | Rule |
|---|---|
| Surface | `variant="flush"` on a list page; `variant="bare"` inside a `DsPanel padding="none"` (board and report panels) |
| Density | `cozy` default; `tight` only when a table has 7 or more columns; never smaller type |
| Columns | first = identity (title, 2-line clamp, badges under it), numbers right-aligned tabular, status = `DsStatusBadge`/`DsBadge`, last = actions (fixed width 112px = 2 icon buttons + "...") |
| Layout | `layout="fixed"` with explicit column widths so there is no clipping and no horizontal scroll from `xl`; `auto` is for tables in a panel that may scroll inside |
| Pager | summary "Menunjukkan {a}-{b} daripada {n} hasil", `pageSizeOptions` `[20, 50, 100]` (default 20), server-paged lists pass `total`; a mini table inside a panel passes `pager="none"` (DS change D3) |
| Actions | `DsRowActions :inline="2"`: Lihat, Edit as icon buttons (tooltip), "..." menu with "Padam" (danger, `confirm`). One row-action set across the portal (retire the single block icon of pksk/access and the toggle-with-two-icon-boxes of schools: the toggle is a column `USwitch`, view/edit stay icon buttons) |
| `< md` | rows become cards: `cardTitle`, `cardFields` (max 4 label/value pairs), row actions, "Isih" select. Required, not optional. |
| Bulk | `DsPanel behavior="bulk"` above the table when rows are selected ("{n} dipilih" + action select + **Laksana**) |
| Empty | `DsDataTable` empty state (`filtered` flag) - copy in 1.8 |

**KPI strip: `DsStatRow density="roomy"`**

| Rule | Spec |
|---|---|
| Count | 2 to 5 tiles. 6 or more metrics = pick the top five; the rest belong in a panel or a second page. Never 6-7 (users, monitoring today) and never two `DsStatRow`s stacked. |
| No orphan row | Layout by count (DS change D2): 2 -> 2 columns always. 3 -> base: tile 1 full width + 2 below, `md`+ 3 across. 4 -> 2x2 base and `md`, 4 across at `xl`. 5 -> base: tile 1 full width + 2x2, `md`: 3 + 2 (the two last tiles span half the row each on a 6-column track), `xl`: 5 across. |
| Number format | Numbers are passed as numbers; the tile formats with a thousands comma and no decimals ("1,271", "33"); ratios keep one decimal and a "%" ("73.3%"); empty value = "-". Pages never `toLocaleString` or `toFixed` (R14). |
| Label | `label` <= 24 characters (no ellipsis at 375: tile wraps to two lines, never truncates); `sub` <= 40 characters, one line |
| Accent | one `accent` per tile, taken in order from `action, friend, win, heat, trial` (design language 6.3, 2026-10-18 decision); semantic `tone` only where the number means good/bad (risk counts, Betul/Salah). Open question Q10. |
| Links | a tile that drills down has `to` (whole tile is the link, no "Lihat detail" text link inside it) |
| Optional | list pages with fewer than 2 meaningful aggregates have no strip (tiket, question-reports use pill counts instead) |
| Skeleton | `loading` prop |

### 1.8 States and copy (1.12, 1.13)

| State | Component | Copy (exact BM) |
|---|---|---|
| Loading, first | `loading` prop on `DsStatRow` / `DsDataTable`; `DsStateView status="loading" skeleton="table|cards|stats|chart"` for panels | sr-only "Memuatkan..." |
| Loading, refresh | keep content, table `loading` overlay; button `loading` | button "Menyimpan..." / "Memuat naik..." |
| Empty, never created | `DsEmptyState item="{benda}"` (+ primary action if allowed) | "Belum ada {benda}." |
| Empty, no match | `DsEmptyState filtered item="{benda}" @reset` | "Tiada {benda} dijumpai." + "Cuba ubah atau set semula penapis." + button "Set Semula" |
| Empty, report panel/period | `DsEmptyState size="sm"` | "Tiada data untuk tempoh ini." |
| Empty, all panels of a report empty | one page-level `DsEmptyState` instead of N panel empties (rule: if every region is empty, show one) | "Tiada data untuk tempoh ini." |
| Empty, selector page | `DsEmptyState icon="funnel"` | "Sila pilih {penapis} untuk melihat {benda}." (live wording kept) |
| Error, region | `DsLoadError` (alert) once per region; `variant="inline"` inside a panel; never per tile | "Tidak dapat memuatkan {benda}. Sila cuba semula." + "Cuba Semula" |
| Error, form submit | `DsCallout tone="error"` summary at the form top | "Sila betulkan {n} medan di bawah." |
| Success | toast 4s | "{Entiti} berjaya {disimpan}." |
| Destructive confirm | `DsRowActions confirm` / `useConfirm` | title "Padam {Entiti}?", buttons "Batal" / "Padam" |
| Raw strings | "Tiada data.", "Baris gilir kosong", "Tiada ... lagi", "Belum ada data" are retired | - |

**Add and action wording (one verb per object type)**

| Object type | Verb | Examples (button / page title) |
|---|---|---|
| Register an entity (person, school, account, subscription) | Daftar {Entiti} | Daftar Pengguna, Daftar Sekolah, Daftar Pelajar Komplimen, Daftar Langganan |
| Add a record or content item | Tambah {Item} | Tambah Soalan, Tambah Soalan PKSK, Tambah Subjek, Tambah Tahap Pendidikan, Tambah Banner, Tambah Artikel, Tambah Nota, Tambah Akses PKSK (granting is adding a record, not registering), Tambah Set Audio KBAT, Tambah Kertas, Tambah Bab, Tambah Topik, Tambah Tindakan |
| Edit | Edit {Entiti} | Edit Pengguna (title); row action "Edit" |
| Upload a file | Muat Naik {X} | Muat Naik Kertas |
| Bulk import | Import {X} | Import Pelajar, Import Pengguna, Import Soalan |
| Download a template | Muat Turun Templat {format} | Muat Turun Templat XLSX, Muat Turun Templat Word (replaces "Template XLSX/Word") |
| Save | Simpan | `DsFormBar` default |
| Open filters / apply / reset | Penapis / Cari (Guna in the drawer) / Set Semula | - |
| View all | Lihat Semua | panel header link (D4) |

## 2. Templates

All templates are `DsPage layout="..."` roots. Props are real `src/ds` props; slots are real slots. `UButton`, `UInput`, `USwitch` etc. are the sanctioned Nuxt UI parts (rule R7) and carry props only, never a `class`. No template contains a `class`, `:ui`, `<style>`, raw `h1-h6/p/div/span/label`.

Breakpoint key: **375** (base, phone), **768** (`md`, tablet), **1280** (`xl`, desktop). No horizontal page scroll at any width >= 320.

### 2.A List page (17 pages + 3 variants)

```
DsPage layout="list" subtitle="..."
  #actions
    UButton color="neutral" variant="soft" label="..."        (0-2)
    UButton icon="plus" label="Tambah {Entiti}" :to           (0-1)
  DsLoadError v-if="error" @retry                              (replaces the body)
  DsStatRow density="roomy" :items prefix="..." :loading        (optional, 2..5)
  DsFilterBar :chips :more-count :loading @apply @reset @remove-chip
    #search  UInput placeholder="Cari {benda}..."
    (default) DsNativeSelect x <= 3
    #more     DsNativeSelect / UInput ...
  DsPanel behavior="bulk" v-if="selection.length"             (only when rows selected)
  DsDataTable variant="flush" layout="fixed" :data :columns :total
    v-model:page v-model:pageSize :pageSizeOptions="[20,50,100]"
    :filtered :loading :error @retry
    cardTitle cardFields sortItems selectable?
    #actions-cell -> DsRowActions :actions :inline="2"
```

| Width | Behaviour |
|---|---|
| 375 | Header: subtitle then actions stacked, full width (secondary, primary). KPI: 2 columns, tile 1 full width if odd. Filter bar: search + "Penapis" (count chip); fields in bottom drawer. Table: card list, "Isih" select, pager summary above page buttons; page-size select hidden below `sm` (pager keeps previous/next + current page). |
| 768 | Header on one row. KPI 3 across (see 1.7 rule). Filter bar inline, selects equal width, "Lagi Penapis" holds the rest. Table: columns reduced (secondary columns merge under the identity column), `density="cozy"`. |
| 1280 | All columns, actions column fixed, pager row with page-size select. No clipping. |

Sub-variants fold into A, never new layouts: **count-only header pages** (banners, articles, notes) -> the count is the first KPI tile; **local-heading pages** (subjects, education-levels) -> delete the local heading; **zero-count sentence** (pksk/questions "0 soalan sepadan...") -> the table empty state; **multi-button header** (audio-kbat three buttons) -> "Muat Turun Templat XLSX" and "Muat Turun Templat Word" tonal, "Tambah Set Audio KBAT" primary.

### 2.B Form / wizard

```
DsPage layout="form" backTo="{list}"  subtitle="..."
  DsCallout tone="error" v-if="submitFailed"    (summary, focus moves here)
  DsSplit ratio="8-4" stack-below="lg" sticky-aside   (aside slot optional)
    DsFormSection title icon :columns="2" description
      DsFormField label required hint :error  -> UInput | UTextarea | DsNativeSelect | USwitch | DsFileField
    DsFormSection ... (one per step/group)
    DsFormSection tone="error" title="Zon Bahaya"   (edit pages only; "Padam {Entiti}" button)
    #aside  DsPanel title="Panduan" (help, DsText list)   (optional)
  DsFormBar :saving submitLabel="Simpan" :cancelTo     (sticky bottom)
```

| Width | Behaviour |
|---|---|
| 375 | One column; sections stack, fields one per row; aside content moves below the last section; `DsFormBar` sticky bottom, buttons full width ("Batal" then "Simpan"). |
| 768 | One column; section fields 2-up (`columns=2`); form bar sticky. |
| 1280 | 8/4 split when an aside exists; with no aside the sections use the full content width with 2-up fields. The left edge matches every other page (no 768px centred column). |

Wizard / multi-stage flows (Muat Naik Kertas -> Senarai Ekstrak -> review): each stage is its own page with `backTo` the previous stage; the current stage name is the page title (menu items already exist); no in-page stepper.

Split review editors (IntakeReviewPage, PaperEditorPage): `DsSplit ratio="5-7"` (D6) with `sticky-aside` and an internal scroll on the preview column; stacks below `lg` with the preview first.

Row editors with 5 columns (m28 QuestionEditor, SchemeEditor): `DsGrid cols` with `DsGridItem` spans; at 375 each field takes its own row.

### 2.C Import with help column

```
DsPage layout="form" backTo="{list}" subtitle="..."
  #actions  UButton color="neutral" variant="soft" icon="clock-counter-clockwise" label="Sejarah Import"
  DsSplit ratio="8-4" stack-below="lg"
    DsFormSection title="Muat Naik Fail" icon="upload-simple"
      DsFileField (label "Fail CSV" / "Fail XLSX", hint "Saiz maksimum 5MB. Format: CSV atau TXT.")
      DsFormField + DsNativeSelect (setting selects, e.g. "Subjek Lalai", "Tahap Pendidikan", "Kesukaran")
      DsCallout tone="info" description="Soalan disimpan sebagai draf"
    DsFormBar submitLabel="Mula Import" submitIcon="upload-simple"
    (result, after run) DsPanel title="Keputusan Import" padding="none" -> DsDataTable variant="bare" pager="none"
    #aside
      DsPanel title="Templat" icon="download-simple" -> UButton color="neutral" variant="soft" label="Muat Turun Templat"
      DsPanel title="Format" icon="list-checks"
        DsDefinitionList :items (column name -> description)   ("Kolum diperlukan" / "Kolum opsyenal")
      DsPanel title="Tips" icon="lightbulb" -> DsText variant="body" tone="muted"
```

| Width | Behaviour |
|---|---|
| 375 | Aside panels move below the form bar, order Templat, Format, Tips; help panels collapsible via `DsCallout`-style disclosure is not required. |
| 768 | One column, aside under the form. |
| 1280 | 8/4 split, aside sticky. |

### 2.D Live board (Command Center, Aktiviti Harian, sekolah/kelas/guru/murid drill-downs)

(Monitoring is not a live board: it is a list-style review screen, specified in section 9.4.)

After the header cleanup there is no status row, no LIVE badge, no clock, no header nav buttons.

```
DsPage layout="dashboard" subtitle="..."
  #tabs  DsPillNav label="Tempoh" :items (Hari Ini | Minggu Ini | Bulan Ini) :active    (Aktiviti Harian only; Command Center has none)
  DsLoadError v-if="error"
  DsStatRow density="roomy" :items prefix            (2..5 tiles: BoardKpis, PulseCards)
  DsGrid :cols="{ base: 1, md: 2, xl: 3 }" gap="md"  (panel grid; use DsSplit ratio="8-4" when one panel is the feature)
    DsGridItem
      DsPanel title icon accent moreTo="{list}"       (header "Lihat Semua" link; D4)
        (content = exactly one of)
          DsListRow x N                                (feed, ranked list: rank, name, sub, trailing metric; G-list)
          DsDataTable variant="bare" density="tight" pager="none"
          DsChart / DsHeatGrid / DsLiveTiles
          DsProgress rows
        DsEmptyState size="sm"  (empty region)
```

Live cue after the cleanup (open question Q9): default = a `DsLiveBadge` inside the "Live Feed" panel `#actions` only; no timestamp clock anywhere; auto-refresh text goes into the panel `description` ("Dikemas kini {masa}").

Drill-down pages (`/admin/command-center/school/:id`, student, teacher, classroom): `DsPage layout="detail" backTo="/admin/command-center"`, entity identity in `#meta` (`DsIdentity`), the in-page crumb is removed, then the same KPI + panel grid. Titles: the navbar shows "Langsung" with the entity as the last crumb (S2).

| Width | Behaviour |
|---|---|
| 375 | KPI 2 columns. Panel grid 1 column; every panel `max` height with its own internal scroll is **not** used (page scrolls); mini tables become card lists; feeds show 5 rows + "Lihat Semua". |
| 768 | KPI 3 across; panels 2 columns; `DsSplit` stacks. |
| 1280 | Panels 3 columns (2 when `DsSplit 8-4`); tables `bare tight`. |

### 2.E Tabbed report (Kirkpatrick, redesigned in section 8)

The Kirkpatrick area is no longer a generic "7 tabs" report. Its information architecture, screens, labels and layouts are specified in **section 8** (owner instruction 2026-10-29). Each of its five screens still uses this skeleton:

```
DsPage layout="report" subtitle="{one plain sentence: the question this screen answers}"
  #tabs     DsPillNav label="Keberkesanan Platform" :items (5) :active        (the only in-page nav)
  #actions  UButton color="neutral" variant="soft" (0-1)
  DsFilterBar (Sekolah, Negeri; apply "Cari")                                 (one bar)
  DsStatRow density="roomy" :items (2..5, each with `to`)
  DsGrid / DsSplit of DsPanel (DsDataTable bare tight | DsChart | DsListRow | DsProgress)
  DsEmptyState / DsCallout for "no data" (never 5 x "Tiada data.")
```

| Width | Behaviour |
|---|---|
| 375 | `DsPillNav` scrolls inside itself with the active item scrolled into view (short labels, full label as `aria-label`). Filter bar = search-less "Penapis" button + Cari. KPI 2 columns. Charts 220px; tables become cards. Panels one column; the most actionable panel ("Perlu Perhatian") first. |
| 768 | Tabs fit; KPI 3 across; charts one column. |
| 1280 | Charts two across; mini tables `tight` with fixed columns. |

### 2.F Tabbed list / report (Soalan Kualiti, Laporan Soalan, Tiket Sokongan, Monitoring panels)

```
DsPage layout="list" subtitle="..."
  #tabs  DsPillNav label="Status" :items (label + count) :active      (counts need DsPillNav `count`, D5)
  DsStatRow density="roomy"                (quality only; tiket and question-reports have none)
  DsFilterBar (optional)
  DsDataTable variant="flush" ...          (the active tab's list)  |  DsGrid of DsPanel (quality)
```

Tab content is chosen by the URL (`?status=`); switching a tab keeps the filter query. No nested empty cards: quality shows one `DsEmptyState` per panel only when that panel is empty; if every panel is empty, one page-level empty state.

| Width | Behaviour |
|---|---|
| 375 | Pill nav scrolls inside itself; counts stay visible; list becomes cards. |
| 768 / 1280 | As list page A. |

### 2.G Selector / utility

**Curriculum browser** (select Tahap + Subjek, then a tree):

```
DsPage layout="list" subtitle="Pilih tahap dan subjek untuk mengurus bab dan topik"
  DsStatRow density="roomy" (Bab, Topik, Subtopik; when a subject is chosen)
  DsFilterBar @apply  -> DsNativeSelect "Semua Tahap" -> DsNativeSelect "Semua Subjek"
  DsStateView status="empty" -> DsEmptyState icon="funnel" title="Sila pilih tahap dan subjek untuk melihat kurikulum."   (before a choice)
  DsPanel title="Bab" -> DsAccordion (chapter > topic > subtopic rows with DsRowActions)    (G5)
```

**Upload utility** (Upload Screenshot -> "Muat Naik Tangkapan Skrin"): `DsPage layout="form" subtitle` + one `DsFormSection` per upload card (`DsFileField` + `UButton "Muat Naik"`) + result `DsDefinitionList`. No form bar when each card has its own button.

| Width | Behaviour |
|---|---|
| 375 / 768 | One column; selects in the drawer; tree rows 44px minimum, actions in `DsRowActions` ("..." menu below `sm`). |
| 1280 | Filter bar inline, tree in one panel full width. |

### 2.H Detail page (definition list)

```
DsPage layout="detail" backTo="{list}"
  #meta     DsStatusBadge | DsBadge ...                (status, category)
  #actions  UButton color="neutral" variant="soft" icon="pencil-simple" label="Edit"
            UButton ... label="..." (primary, only if there is a main action)
  DsLoadError v-if="error"
  DsStatRow density="roomy" (optional)
  DsSplit ratio="8-4" stack-below="lg"
    DsPanel title="Maklumat" -> DsDefinitionList :items :columns="2"
    DsPanel title="Rekod Berkaitan" padding="none" -> DsDataTable variant="bare" pager="none"
    #aside  DsPanel title="Status" -> DsDefinitionList :items ; DsFormSection tone="error" title="Zon Bahaya" (Padam)
```

| Width | Behaviour |
|---|---|
| 375 | One column; definition list is one column (label above value); aside under main; actions stack. |
| 768 | One column; definition list two columns. |
| 1280 | 8/4 split; aside sticky. |

### 2.I Dashboard landing (new, `/admin`, menu "Dashboard")

Replaces the redirect to the Command Center. Design language 9.5, simplified for v1 of the landing: KPIs and "Lihat Semua" links only; no charts.

```
DsPage layout="dashboard" subtitle="Ringkasan platform dan pintasan ke pengurusan harian"
  #actions  UButton color="neutral" variant="soft" icon="arrow-clockwise" label="Muat Semula"
  DsLoadError v-if="error" @retry
  DsStatRow density="roomy" prefix="dash" :items
      Pengguna -> /admin/users ; Sekolah -> /admin/schools ; Bank Soalan -> /admin/questions ;
      Langganan Aktif -> /admin/school-subscriptions ; Tiket Terbuka -> /admin/tiket        (5 tiles, each `to`)
  DsSplit ratio="8-4" stack-below="xl"
    DsStack
      DsPanel title="Menunggu Semakan" icon="clipboard-text" moreTo="/admin/spm/semakan" padding="none"
        DsDataTable variant="bare" density="tight" pager="none" (5 rows) | DsEmptyState size="sm" item="soalan menunggu semakan"
      DsPanel title="Tiket Terbuka" icon="lifebuoy" moreTo="/admin/tiket" padding="none"    (5 rows)
      DsPanel title="Langganan Hampir Tamat" icon="calendar-x" moreTo="/admin/school-subscriptions" padding="none"
    #aside
      DsPanel title="Pintasan" icon="lightning"
        DsListRow x6 (to): Tambah Soalan, Daftar Pengguna, Daftar Sekolah, Import Pelajar, Muat Naik Kertas, Langsung
```

- Panel heading: one `h2` (the `DsPanel title`), at most one "Lihat Semua" (`moreTo`, label default from `dsCopy`).
- Data: each tile and list uses the existing list endpoints (`per_page=5` or the total only); no new analytics. Open question Q5 confirms the tile set and panels.
- Empty copy: "Belum ada tiket terbuka.", "Belum ada soalan menunggu semakan.", "Belum ada langganan hampir tamat." (`DsEmptyState size="sm" item=...`).
- Loading: `DsStatRow loading` + `DsStateView skeleton="table"` per panel. Error: one `DsLoadError` replaces the whole body (the dashboard has a single data source per tile, so one failure banner, plus per-panel `inline` errors if only a list fails).

| Width | Behaviour |
|---|---|
| 375 | KPI 2 columns, first tile full width (5 tiles: 1 + 2 + 2); panels stack: Menunggu Semakan, Tiket Terbuka, Langganan Hampir Tamat, Pintasan; tables become card lists of 5. |
| 768 | KPI `3 + 2` (6-column track); one column of panels; Pintasan after them. |
| 1280 | KPI 5 across; 8/4 split (panels left, Pintasan right, sticky). |

### 2.J Shell deltas that the templates assume

| Shell part | Change |
|---|---|
| Sidebar header | Logo centred; directly under it a full-width "Cari menu" field (Ctrl+K, `DsSearchEntry` inside `DsAppShell`, G12). Below `lg` it is inside the slide-over sidebar. |
| Navbar | `[menu button below lg] Group / Title`, scope chip (>= `lg`), theme toggle. The search button is removed. |
| Breadcrumb groups | = sidebar groups and sub-groups, generated from `menu.ts` (no page types a crumb). The audit found crumbs for tiket ("Penglibatan"), school-subscriptions and pksk/access ("Kewangan") and tools/screenshots ("Sistem") that the rendered sidebar did not show as groups; with one generator the two cannot differ. Items in a sub-group show it: "Pemantauan / Keberkesanan Platform / Pembelajaran". |
| Titles | Generated from `menu.ts` labels. Menu label changes: "Upload Screenshot" -> "Muat Naik Tangkapan Skrin"; "Dashboard" kept (Q4); the Kirkpatrick sub-group becomes "Keberkesanan Platform" with 5 items (section 8.3); page "Set Audio KBAT" -> "Audio KBAT". |

## 3. DS gaps to add

Priority (batch numbers follow the reordered section 5: batch 1 = Pemantauan pilot): **MUST-1** = needed before batch 1 starts (blocks the Pemantauan pilot and everything after); **MUST-4** = needed before batch 4 (forms); SHOULD = nice, no migration blocked. Every new component follows the hardening rules (typed variants, `dsCopy` copy, no `class`/`ui` props, state matrix in `/__ds`).

| # | Name | Purpose | Props / slots | Pages that need it | Priority |
|---|---|---|---|---|---|
| G1 | `DsBadge` (tone badge) | one pill for severity, mood, category, result (Betul/Salah); `DsStatusBadge` stays for the status enum | `label`, `tone: 'neutral' \| 'primary' \| 'success' \| 'warning' \| 'error' \| 'info'`, `accent?: DsAccent` (categorical), `icon?: DsIconName`, `size: 'sm' \| 'md'`, `emphasis: 'soft' \| 'strong'`; slot default | 143 `UBadge` uses: lists, Monitoring, Kirkpatrick, CC mood, m04 report cards | MUST-1 |
| G2 | `DsProgress` (meter with label) | replaces `UProgress` + percentage | `value` (0-100), `label?`, `showValue`, `tone: 'auto' \| 'primary' \| 'success' \| 'warning' \| 'error'` (`auto` = thresholds), `size: 'sm' \| 'md'`, `ariaLabel`; value printed tabular | CcAccuracyBar, StudentGaps, MonitoringSignals, Kirkpatrick bands | MUST-1 |
| G3 | `DsDefinitionList` | label/value pairs on detail pages and help panels | `items: {key,label,value,to?,mono?}[]`, `columns: 1 \| 2`, `emptyValue` (default "-"); slots `#value-{key}`; renders `dl/dt/dd` | QuestionDetail, SubscriptionDetail, CompStudentDetail, StructuredDetail, UserPackages, import help columns, drill-down heads | MUST-1 |
| G4 | `DsCallout` | inline notice with BM defaults; collapsible guide | `tone: 'info' \| 'success' \| 'warning' \| 'error'`, `title?`, `description?`, `icon?`, `dismissible?`, `storageKey?` (remembered), `collapsible?`; slots default, `#actions` | 55 `UAlert` uses, MonitoringGuide, import notes, form error summary | MUST-1 |
| G5 | `DsAccordion` / `DsTreeItem` | expandable row with leading chip, title, meta and row actions | `title`, `meta?`, `icon?`, `open` (v-model), `level: 1 \| 2 \| 3`; slots default (children), `#actions`, `#meta` | CurriculumBrowser (ChapterBlock, TopicBlock, SubtopicItem), report cards | MUST-4 |
| G6 | `DsEntityPicker` | one school / teacher / user search with state filter and selected chip | `kind: 'school' \| 'teacher' \| 'user' \| 'student'`, `v-model`, `required`, `label`, `negeriFilter?`, `loadOptions` (fn); slots `#option`, `#selected` | m02 AdminSchool / SubscriptionSchool / BulkSchool / StudentSchool pickers, Kirkpatrick and Command Center school filters, ParentStudentLinker, SchoolAdminGenerator | MUST-4 (SHOULD for filters) |
| G7 | `DsStatTile` upgrades | rich sub line, dimmed value, number format | new slot `#sub`; `valueTone: 'dimmed'`; numbers formatted by the tile (comma); `unit` wraps to 2 lines (no ellipsis) | PulseCards, OverviewLevelCards, BoardKpis, all strips | MUST-1 |
| G8 | `DsSwatch` | data-colour chip / icon tile without `:style` | `color: DsCategory (1..8) \| named token`, `icon?`, `label?`, `size`, `selected?`, `interactive?` | ColorSwatch, SubjectIconTile, GradeCards (m02), subject forms | MUST-4 |
| G9 | `DsPager` | pager for non-table lists | `page` (v-model), `pageSize` (v-model), `total`, `pageSizeOptions?`; same BM summary as `DsDataTable` | DiagramAuditPage, MasterNotesPage, SubscriptionDetail lists | SHOULD |
| G10 | `DsDrawer` | side slide-over (detail, editor) and bottom sheet below `sm` | `v-model:open`, `title`, `description?`, `side: 'right' \| 'left'`, `size: 'sm' \| 'md' \| 'lg'`, `dismissible`, `loading`; slots default, `#footer` | m28 BankPage and PaperEditorPage (`USlideover`), filter-style panels | MUST-1 |
| G11 | `DsListRow` | one row of a feed / ranked / shortcut list | `to?`, `leading?` (rank number \| `DsIconChip` \| `DsIdentity`), `title`, `sub?`, `meta?`, `badge?` (G1), `density`; slots `#leading`, `#meta`, `#actions` | DailySchoolsPanel, TopSchools/Pupils, FeedPanel, MoodPanel, dashboard Pintasan | MUST-1 |
| G12 | `DsAppShell` (+ `DsSearchEntry`) | the portal frame so `PentadbiranLayout.vue` holds no classes/`:ui`: sidebar (logo, search, nav, account), navbar | slots `#logo`, `#search`, `#nav`, `#account`, `#navbar-end`, default; props `title`, `crumbs`, `sidebarSize`; brand mark through `DsBrandLogo`, avatar through `DsIdentity`, group accents through `DsIconChip accent` (kills `group-accent.ts` literals) | the whole portal; shell lint scope | MUST-1 |
| G13 | `DsShow` | breakpoint visibility without `hidden md:block` | `above?: 'sm' \| 'md' \| 'lg' \| 'xl'`, `below?: same`, `print?: boolean` | any page needing a responsive toggle | SHOULD |
| G14 | `DsSwitchField` | switch + label + hint row in a form | `v-model`, `label`, `hint?`, `icon?`, `disabled`, `error?` | m02 `UserFormSwitch`, subject/tahap active switches, row column toggles | SHOULD (MUST-4 for forms) |
| G15 | `DsFloatingPanel` | non-modal floating tool panel (the Arabic keyboard) | `v-model:open`, `title`, `anchor?`; slot default | m04 `ArabicKeyboardPanel` | COULD (Q12) |

**Changes to existing DS components (D-list)**

| # | Component | Change | Why | Priority |
|---|---|---|---|---|
| D1 | `DsPage` | `layout="form"` in staff = full content width (no `max-w-3xl mx-auto`), left aligned; `layout="detail"` same | left edge jumps 280 -> 384 on B pages | MUST-1 |
| D2 | `DsStatRow` | no-orphan track by count (section 1.7); cap tiles at 5 (dev warning above 5) | orphan rows, 6-7 tile strips | MUST-1 |
| D3 | `DsDataTable` | `pager: 'auto' \| 'none'`; warn when `cardTitle`/`cardFields` are missing; `variant` default `flush`; `emptyTitle` only for live exceptions; fixed layout default at `xl` | mini tables, no clipping, mobile cards | MUST-1 |
| D4 | `DsPanel` | `moreTo` + `moreLabel` (default "Lihat Semua") in the header; header title/description use `DsHeading`/`DsText` (no raw `p`) | dashboard and board panels; raw `p` inside DS | MUST-1 |
| D5 | `DsPillNav` | `count?: number` per item; `size` stays; scroll-into-view of the active item at 375 | tiket, quality, question-reports, Kirkpatrick | MUST-1 |
| D6 | `DsSplit` | ratio `'5-7'`; `scrollAside` (internal scroll on `lg+`) | IntakeReviewPage 5/7 + `max-h` | MUST-1 |
| D7 | `DsFormSection` | header `h2` through `DsHeading`; `columns: 1 \| 2 \| 3` | raw `h2/p` inside DS, 3-up money fields | SHOULD |
| D8 | `DsFilterBar` | visible-label option is NOT added (decision 1.9); `DsNativeSelect` gets `label` as `aria-label` automatically | labelled-field filters | SHOULD |
| D9 | `DsPageHeader` | `#actions` order: primary always last on wrap; `#meta` slot also on `layout="detail"`; remove in-page `breadcrumb` use | one header rule | MUST-1 |
| D10 | `DsDataTable` / `DsDrillTable` | share the same column cell helpers (`DsBadge`, `DsIdentity`, `DsRowActions`) so mini tables look like the main table | 4 table dialects | MUST-1 |
| D11 | shell | `useShellEntityTitle(name)` appends the entity crumb (S2); navbar title size (Q2) | drill-down and detail titles | MUST-1 |

## 4. Lint rules for "full strict" (built in step 2)

Scope: every file reachable from a portal route plus the shell. Globs (appended to `config/ds-strict.json` and to a new `enforce` array): `src/modules/**/pages/**` for the portal modules (m02, m03, m04, m07, m09, m11, m12, m17, m22, m28), their `components/**`, **`src/modules/m28-bijak-spm/admin/**`** (never matched today), **`src/shells/pentadbiran/**`**, `m03 .../subjects-levels/**`, `m04 .../ArabicKeyboardPanel.vue`, `MarkdownView.vue`, `RenewalInvoicePage.vue`. Exempt only: `src/ds/**`, `src/theme/**`, `**/__tests__/**`, `src/dev/**`.

Mechanism: ratchet (hardening 6.4). `config/ds-debt.baseline.json` freezes today's counts for files not yet migrated; a file that is on an `enforce` glob has zero tolerance (error); any new file has zero tolerance. Each migration batch appends its glob to `enforce`. After batch 6 the baseline is deleted and the rules apply to all of `src/**` outside the exempt list. Severity below is the final severity; "enforce" files get it immediately.

| # | Rule | What it fails | Severity | Allowed exceptions |
|---|---|---|---|---|
| R1 | `pp/ds-no-class-attr` | any `class` / `:class` (static, bound, array, object) on any element or component in a page or domain component; subsumes the five hardening rules (type, spacing, surface, colour, layout utilities) and promotes `ds-no-dynamic-class` from warn to error; report keeps the `classifyToken` code | error | none. Test ids and `data-*` are fine. |
| R2 | `pp/ds-no-class-literal-in-script` | class-like string literals in `<script>` and `.ts` files of the scope (e.g. `group-accent.ts`, `NAV_UI`, `TH/TD` constants, route/menu helpers) | error | none; move the mapping into `src/ds` (accent keys, not classes) |
| R3 | `pp/ds-no-ui-prop` | `:ui`, `ui=`, `:class` on any Nuxt UI or Ds tag (23 today incl. 6 in the shell) | error | none |
| R4 | `pp/ds-no-style` | `style`, `:style`, `<style>` blocks, `<style scoped>` (extends `ds-no-inline-style` and `ds-no-style-block`) | error | none |
| R5 | `pp/ds-no-raw-html` | native `div span p h1-h6 label ul ol li section article header footer nav aside main a button input select textarea form table thead tbody tr th td dialog img svg hr strong em small pre`; use `DsStack/DsCluster/DsGrid/DsText/DsHeading/DsFormField/UInput/...`; `<template>`, `<slot>`, `<component>`, `<RouterView>`, `<Teleport>`, `<KeepAlive>` allowed | error | rendered markdown through `DsProse`; the print invoice through `DsPrintSheet`; inline `<code>`/`kbd` through `DsText as` (add `code`); no other |
| R6 | `pp/ds-no-ui-duplicate` | a Nuxt UI component that has a Ds twin: `UCard`->`DsPanel`/`DsSurface`, `UBadge`->`DsBadge`/`DsStatusBadge`/`DsTag`, `UTable`->`DsDataTable`/`DsDrillTable`, `UPagination`->`DsPager`/`DsDataTable`, `UTabs`->`DsPillNav`, `USlideover`->`DsDrawer`, `UModal`/`UDrawer`->`DsDialog`/`DsDrawer`, `UAlert`->`DsCallout`/`DsLoadError`, `UProgress`->`DsProgress`, `UBreadcrumb`->`DsBreadcrumb`, `UEmpty`->`DsEmptyState`, `UForm*`->`DsFormField` | error | none |
| R7 | `pp/ds-ui-allowlist` | any Nuxt UI tag not on the sanctioned list in `config/ds-ui-allowlist.json`: `UButton`, `UInput`, `UTextarea`, `USwitch`, `UCheckbox`, `URadioGroup`, `USelectMenu`, `UInputNumber`, `UTooltip`, `UDropdownMenu`, `UPopover`, `UKbd`; and any `Ds*` prop outside the documented API (types) | error | adding to the list needs a design review + a line of justification in the file |
| R8 | `pp/ds-no-local-kit` | a module-local component whose template root is `DsPanel`/`DsSurface`/`UCard` and only titles/wraps a slot or list (the `*Panel`, `*Card(s)`, `*Picker`, `*Block`, `*Kpis` copies the name-based test cannot see) | error | domain widgets listed in `config/ds-domain-widgets.json` with owner + reason (data mappers around `DsStatRow` with zero template markup are always allowed) |
| R9 | `pp/ds-icon-names` (existing, extended) | `i-ph-*` / `i-lucide-*` strings or `AppIcon` from `@/components/icon` on pages; icon props must be base names | error | none |
| R10 | `pp/ds-imports` (existing, extended) | imports from `@/components/**`, `@/shells/**` (outside the layout), `**/native/**`, module-local kits that duplicate DS; remote assets (`ds-no-remote-assets`); allowed: `@/ds`, module composables/types, `vue`, `vue-router` | error | the shell imports `src/shells/pentadbiran/menu.ts` data only |
| R11 | `pp/ds-copy-glossary` | banned strings in templates and script text: "Tapis", "Reset", "Cuba Lagi", "Showing ... results", "Tiada rekod ditemui", "Tiada data." outside `DsEmptyState size="sm"`, "Pengurusan " prefix in a title, "Kembali ke ", "Kirkpatrick Evaluation", "Upload", "Download", "Template", "Daftar Baru", "Beri Akses Baru", "Langganan Baru", "Kertas Baharu", "Cipta Set", "Buat Baru", "Rekod Intervensi Baru"; add-button must match `Tambah |Daftar |Muat Naik |Import `, and `Daftar` only with Pengguna, Sekolah, Pelajar Komplimen, Langganan | error | `config/copy-exceptions.json` (live exceptions with module + SRS reference; each entry needs `reason`) |
| R12 | `pp/ds-page-template` | structural check on every routed page: root is `DsPage` with `layout` set and no `title`; at most one `DsFilterBar`, one `DsPillNav`, one `DsStatRow` (static `items` literal of 2-5), one `DsDataTable variant="flush"` on a `list` layout; `DsDataTable` has `cardTitle` and `cardFields`; no `DsPanel` directly inside `DsPanel`; `DsBackLink` only via `backTo` and no `backLabel` | error | print pages (`layout: 'bare'`, `DsPrintSheet` root) |
| R13 | `pp/ds-no-deprecated-ds-props` | deprecated Ds props still accepted today: `DsPanel flush/tone`, `DsStatRow roomy/compact`, `valueClass`, `compactCells`, `DsLoadError inline`, `DsFormSection tone="danger"`, `DsFilterBar tone`, full `i-ph-*` icon strings | error | none |
| R14 | `pp/ds-no-adhoc-format` | `toLocaleString`, `Intl.NumberFormat`, `.toFixed(` and hand-built "%" / thousands formatting in a page; use the DS formatters (`@/ds/format`: `formatCount`, `formatPercent`) or let `DsStatTile`/`DsDataTable` format | error | none |

Non-ESLint tests (run in the normal test job):

| # | Test | Fails when |
|---|---|---|
| T1 | `eslint/__tests__/ds-strict-scope.test.mjs` (route walker) | a file reachable from a portal route (`/admin/**`, `/guru/monitoring/**`) or under `src/shells/pentadbiran/**` is matched by neither an `enforce` glob nor the baseline; the 19 + 5 files the audit found unlinted would fail it today |
| T2 | `eslint/__tests__/ds-debt-ratchet.test.mjs` (existing) | a baseline count rises, a new file has any count, or an `enforce` glob is removed |

Tooling fixes required for step 2 to be usable: `scripts/lint-ds.mjs` must pass globs to ESLint through config (the Windows "command line is too long" error makes `npm run lint:ds` exit 1 today); `pp/ds-no-dynamic-class` warnings (26) are cleared by R1.

Summary: **14 ESLint rules + 2 tests** (R1-R14, T1-T2); the existing `ds-api-types.test.ts` (typed props) stays.

## 5. Migration map

Batch order (CHANGED 2026-10-29: owner said the whole Pemantauan group is bad today, so it goes first as the **pilot / reference implementation** of the templates; each batch ends by appending its glob to `enforce` and re-running the visual screenshot set at 375/768/1280):

0. Prerequisites: DS gaps and changes MUST-1 (G1, G2, G3, G4, G7, G10, G11, G12, D1-D6, D9, D10, D11) and the step-2 lint infra.
1. **Pemantauan pilot** (split into parallel units 1a-1d below): Langsung, Aktiviti Harian, Pantau Sekolah and drill-downs, the single pupil page, the five Keberkesanan Platform screens (section 8).
2. m28 Bijak SPM admin (922 debt, no lint coverage).
3. List pages (A, F) + the Dashboard landing.
4. Forms, imports, selectors (B, C, G) (needs G5, G6, G8, G14).
5. Detail pages (H) and print sheets.
6. Shell tidy-up, baseline removal, final audit.

The visual demo (Ringkasan desktop + 390 phone, Penggunaan Platform, Pantau Sekolah; sample numbers, not real data) is the visual target of batch 1: https://claude.ai/artifact/Fdw8BqKKT7ZSPxkRdBPq9u. Where section 9 (P2) differs from the Penggunaan Platform demo (the school table, alerts and heat map become previews/links), section 9 wins.

### Batch 1 - Pemantauan pilot (decisions K1-K6 and P1-P6 all approved, 2026-10-29)

Parallel task units. Files are disjoint between units; shared files have exactly one owner (stated). Each unit also updates the owning module's URS/SRS deviation table (new DV rows) and the E2E specs listed, in the same task. All units need batch 0 first.

| Unit | Scope | Owns (files) | Depends on |
|---|---|---|---|
| **1a** | Langsung + Aktiviti Harian + the live drill-down (school, class, teacher) | `src/modules/m17-admin-dashboard/pages/CommandCenterBoardPage.vue`, `CommandCenterDailyPage.vue`, `CommandCenterSchoolPage.vue`, `CommandCenterClassPage.vue`, `CommandCenterTeacherPage.vue`; `components/command-center-board/**` (BoardKpis, PulseCards, BoardPanel, DailyPanel, DailySchoolsPanel, TopSchoolsPanel, TopPupilsPanel, DailyTopPanel, FeedPanel, DailyFeedPanel, DailyLoginsPanel, DailyMoodBadgePanels, MoodPanel, CcHeadcountModal, CcSessionsModal), `components/command-center/**` (CcAccuracyBar, CcFrame), `components/frame/CcBoardFrame.vue` | batch 0 (G2, G11, D11) |
| **1b** | Pantau Sekolah + school page + teacher page + the ONE pupil page (incl. absorbing the Kirkpatrick and Langsung pupil pages) | `src/modules/m11-teacher-analytics/pages/MonitoringPage.vue`, `MonitoringSchoolPage.vue`, `MonitoringTeacherPage.vue`, `MonitoringStudentPage.vue`; `components/monitoring/**`; `m12-kirkpatrick/pages/KirkpatrickPelajarPage.vue` + `components/kirkpatrick/pelajar/**` (moved into the pupil page); `m17-admin-dashboard/pages/CommandCenterStudentPage.vue` (becomes a redirect); the redirect routes | batch 0 (G2, G11, D11) |
| **1c** | Keberkesanan Platform: Ringkasan, Pembelajaran, Penggunaan Platform, Keputusan Peperiksaan, Tindakan Susulan | `src/modules/m12-kirkpatrick/pages/Kirkpatrick{Overview,Reaction,Learning,Behavior,Results,Chain,ChainPdf,Interventions}Page.vue`; `components/kirkpatrick/{overview,learning,behavior,results,chain,interventions,common}/**`; the old-route redirects; the `/guru/kirkpatrick*` twin mounts | batch 0 (G2, G4, G10, D10); links to the pupil page of 1b (stub route is enough) |
| **1d** | Shell and menu for the group (small, do first or alongside) | `src/shells/pentadbiran/menu.ts` (labels: "Pantau Sekolah", sub-group "Keberkesanan Platform" with 5 items), crumb/title generation from the menu, sidebar "Cari menu" move, entity-title hook (D11); the rest of `PentadbiranLayout.vue` strictness stays in batch 6 | G12 |

#### 1a - Langsung and Aktiviti Harian

| Route | Template | Main replacements |
|---|---|---|
| `/admin/command-center` | D | `CcBoardFrame`/`CcFrame` -> `DsPage`; remove LIVE badge (kept only inside the Live Feed panel), MYT clock, header "Dashboard"/"Aktiviti Harian" buttons; `BoardKpis`/`PulseCards` -> `DsStatRow` (`#sub` slot); `BoardPanel` -> `DsPanel`; ranked lists -> `DsListRow`; "Kirkpatrick" mini panel -> one tile linking to Ringkasan; "Top Sekolah" = top 5 by today's activity |
| `/admin/command-center/daily-activity` | D | `DsPillNav` period (Hari Ini / Minggu Ini / Bulan Ini); `DailyPanel` -> `DsPanel`; `DailySchoolsPanel` -> `DsListRow`; duplicate "Engagement" h2 removed; owns heat map and Mood Pelajar (9.2); back button removed |
| `/admin/command-center/school/:id`, `/classroom/:id`, `/school/:id/teacher/:id` | D drill | `DsPage layout="detail" backTo`; in-page crumb removed; entity title via D11; cross-link "Lihat di Pantau Sekolah" |
| Spec rows | | M17 URS/SRS S2, S3, S4-S6 (headers: status row, clock, back buttons; DV-M17-53 header), new DV rows for the header cleanup and the Kirkpatrick tile |
| E2E | | `e2e/m17-admin-dashboard/smoke-command-center-board.spec.ts`, `smoke-command-center-drill.spec.ts`, `e2e/m10-teacher-class/smoke-command-center.spec.ts` (teacher variant shares the components); `e2e/api/m17-command-center.spec.ts` unaffected (API only) |

#### 1b - Pantau Sekolah, drill-downs, the pupil page

| Route | Template | Main replacements |
|---|---|---|
| `/guru/monitoring` ("Pantau Sekolah", 9.4) | list (A) | `UTabs` + link row removed (no in-page nav); 9 tiles -> `DsStatRow` of 4; toolbar -> "Muat Turun" menu (Admin Pusat only) + "Muat Semula" + auto-refresh switch; labelled filters -> one `DsFilterBar`; `MonitoringGuide` -> `DsCallout collapsible storageKey`; `MonitoringSignals` -> "Perlu Perhatian" `DsListRow` panel; `MonitoringEngagementTable` -> one merged `DsDataTable`; `MonitoringWeekly` -> `DsDrillTable` panel |
| `/guru/monitoring/sekolah/:id` (9.4.2) | H | `MonitoringSchoolPage` (144 debt): `DsPillNav` Pelajar/Guru with counts, `DsFilterBar` per list, `DsDataTable flush` paged at 50 (P5), `DsCallout` flagged accounts, `DsBadge` |
| `/guru/monitoring/sekolah/:id/guru/:id` | H | `MonitoringTeacherPage`: `DsStatRow` 4, `DsDataTable bare` |
| `/guru/monitoring/sekolah/:id/pelajar/:id` (9.5) | pupil page | `StudentSubjects/Topics/QuestionList/WrongAnswers/Gaps` -> `DsPillNav` sections + `DsPanel`; `StudentGaps` -> `DsProgress`+`DsListRow`; question modal -> `DsDialog`; absorbs the Kirkpatrick pelajar panels (Alesa, Headcount, platform accuracy); action "Tambah Tindakan" |
| `/admin/command-center/student/:id`, `/admin/kirkpatrick/pelajar/:id` | redirect | to the pupil page (P3; if the M17 pupil data differs from M11 data, only the Kirkpatrick route redirects, 9.6 item 5) |
| Spec rows | | M11 URS/SRS FT-3.1-3.8 (guide, toolbar FN-3.2.4/3.2.5 countdown and pause, 9 KPI tiles, 5-tab row, legends), FT-4.1-4.3 (school, pupil, teacher; pagination FN-4.1.6), DV-M11 table; M12 S8 (FT-9.x) merged into M11 S4; M17 S7 redirect |
| E2E | | `e2e/m11-teacher-analytics/smoke-monitoring.spec.ts` (tabs, tiles, countdown selectors change), `e2e/m12-kirkpatrick/*` (pelajar links), `e2e/m17-admin-dashboard/smoke-command-center-drill.spec.ts` (pupil step now redirects) |

#### 1c - Keberkesanan Platform (Kirkpatrick redesign, section 8: 7 pages become 5 screens + shared pupil page)

Old routes stay as redirects (bookmarks, E2E, `/guru/kirkpatrick` twin; school-admin alias = Ringkasan; students keep `/kirkpatrick`, K6).

| Old route | New screen (menu label) | Template | Main replacements |
|---|---|---|---|
| `/admin/kirkpatrick` (Overview) | **Ringkasan** (route kept) | E + 8.4.1 | one `DsPillNav`; the 4 level cards + "Kirkpatrick Evaluation Flow" merge into one `DsStatRow` of 4 tiles with `to`; before/after -> `DsDataTable bare`; new "Perlu Perhatian" (top-5 preview of Pantau Sekolah) and "Kesimpulan" panels; purpose `DsCallout` |
| `/admin/kirkpatrick/reaction` (T1) | section "Kepuasan Pengguna" inside Ringkasan; route redirects to `/admin/kirkpatrick#kepuasan` | - | `OverviewKpis`/NPS cards -> a `DsPanel` of `DsDataTable bare` by role |
| `/admin/kirkpatrick/chain` (Rantaian Impak) | merged into Ringkasan ("Kesimpulan" + header action "Muat Turun Laporan"); route redirects | - | back link and `ChainCards` deleted; correlation panel hidden (K3, 8.7) |
| `/admin/kirkpatrick/learning` (T2) | **Pembelajaran** (route kept) | E + 8.4.2 | `LearningGainCard` -> `DsStatTile`; fix overflow (x=164); `LearningSubjects` (weakest first, K4)/`LearningSchools` -> `DsDataTable bare` + `DsProgress` + `DsBadge` |
| `/admin/kirkpatrick/behavior` (T3) | **Penggunaan Platform** (route kept) | E + 8.4.3, P2 | alerts and school table become top-5 previews linking to Pantau Sekolah; `BehaviorBands` -> `DsDataTable bare` + `DsProgress`; heat map and mood panel removed (owned by Aktiviti Harian); fix overflow (x=158); KPI 6 -> 5 |
| `/admin/kirkpatrick/results` (T4) | **Keputusan Peperiksaan** (route kept) | E + 8.4.4 | 5 tables -> `DsDataTable bare`; "Tiada data." x5 -> one page-level `DsEmptyState` + `DsCallout`; `ResultsRoi` removed (K3); `ResultsInsights` -> `DsCallout`; KPI 6 -> 5 |
| `/admin/kirkpatrick/interventions` | **Tindakan Susulan** (route kept) | A + 8.4.5 | `InterventionForm` collapsible card -> `DsDrawer` with `DsFormSection` (numeric student id first, K5); `InterventionList` -> `DsDataTable flush`; status select in `DsFilterBar`; button "Tambah Tindakan" |
| `/admin/kirkpatrick/chain/pdf` | print | print | `DsPrintSheet`; same figures as Ringkasan |
| Spec rows | | M12 URS/SRS S1-S7 (FT-2.x to FT-8.x, FN-M12-1.1.1 menu entries, DV-M12 table: new DVs for the merge, plain labels K2, hidden correlation, removed ROI, weakest-first sort); S9/S10 unchanged |
| E2E | | `e2e/m12-kirkpatrick/smoke-kirkpatrick-overview.spec.ts`, `smoke-kirkpatrick-levels.spec.ts`; `e2e/global/prototype-scope.spec.ts` (menu) |

### Batch 2 - m28 Bijak SPM admin (`src/modules/m28-bijak-spm/admin/**`)

| Route | Template | Main replacements |
|---|---|---|
| `/admin/spm/soalan/muat-naik` | B (wizard stage) | `DsFormSection`+`DsFormField`+`DsFileField`; drop 768 column; "Kembali" |
| `/admin/spm/soalan/manual` | B | `IntakeMetaFields` -> `DsFormField`/`DsNativeSelect`/`UInput`; `DsFormBar` |
| `/admin/spm/soalan/ekstrak` | A | `DsFilterBar` (one bar, not stacked), `DsDataTable flush`; "Muat Naik Kertas" primary |
| `/admin/spm/soalan/ekstrak/:batchId` | B split | `DsSplit 5-7` + `scrollAside`; `QuestionEditor`/`SchemeEditor`: raw `input/select/textarea/label` -> `DsFormField` + `UInput`/`DsNativeSelect`/`UTextarea`; 5-col grid -> `DsGrid`/`DsGridItem` |
| `/admin/spm/soalan` | A | `BankPage` `UTable` -> `DsDataTable`; `USlideover` -> `DsDrawer`; badges -> `DsBadge` |
| `/admin/spm/soalan/:qid/sunting` | B | `BankEditPage` + `QuestionEditor` (as above) |
| `/admin/spm/kertas` | A | `PaperListPage`: add pager and fixed columns (fix clipped "Dikemas kini") |
| `/admin/spm/kertas/baharu` | B | `PaperNewPage`: `DsFormSection`; title "Tambah Kertas" |
| `/admin/spm/kertas/:id` | B split | `PaperEditorPage`: `DsSplit`, `DsDrawer`, `QuestionPreview` -> `DsPanel`+`DsText` |
| `/admin/spm/semakan` | A | `ReviewQueuePage`: `DsFilterBar`, `DsDataTable`, empty "Belum ada soalan menunggu semakan." |
| `/admin/spm/semakan/:key` | H | `ReviewItemPage`: `DsDefinitionList`, `DsCallout`, actions in `#actions` |

### Batch 3 - list pages (A, F) and Dashboard

| Route | Template | Main replacements |
|---|---|---|
| `/admin` (new) | Dashboard (2.I) | new `DashboardPage`; replaces redirect |
| `/admin/questions` | A | `QuestionListPage` is the model; drop `QuestionSummaryCard` own `UTable`; badges |
| `/admin/users` | A | KPI 7 -> 5; 3 header buttons -> 2 tonal + "Daftar Pengguna"; `UserStatCards` kept as data mapper |
| `/admin/schools` | A | row actions per 1.10; "Daftar Sekolah" |
| `/admin/school-subscriptions` | A | one filter row; "Daftar Langganan" |
| `/admin/comp-students` | A | "Daftar Pelajar Komplimen"; `DsDataTable` |
| `/admin/subjects` | A | delete local heading; fix clipped actions; `DsSwitchField` column; KPI 4 |
| `/admin/education-levels` | A | delete local heading; "Tambah Tahap Pendidikan" |
| `/admin/banners` | A | "Jumlah" line -> KPI; "Tambah Banner" |
| `/admin/articles` | A | one filter row; "Tambah Artikel" |
| `/admin/notes` | A | one filter row; "Tambah Nota" |
| `/admin/pksk/questions` | A | zero-count sentence -> empty state |
| `/admin/pksk/access` | A | one filter row (Cari not alone); row-action set; "Tambah Akses PKSK" |
| `/admin/audio-kbat` | A | 3 buttons -> 2 tonal + primary; one filter row |
| `/admin/structured-questions` | A | `DsDataTable`, `DsBadge` |
| `/admin/question-submissions` | A | `DsFilterBar` "Tapis" -> "Cari"; "Reset" -> "Set Semula" |
| `/admin/soalan-gambar` | A | `UPagination` -> `DsDataTable` pager / `DsPager` |
| `/admin/master-notes` | A | `UPagination` -> `DsPager` |
| `/admin/questions/import-history` | A | `DsDataTable` |
| `/admin/questions/quality` | F | KPI strip 4; nested empty cards -> panel empties; no cards in cards |
| `/admin/question-reports` | F | `DsPillNav` with counts; `DsDataTable` |
| `/admin/tiket` | F | `DsPillNav` with counts (Inter-only font bug disappears with DS) |

### Batch 4 - forms, imports, selectors (B, C, G)

| Route | Template | Main replacements |
|---|---|---|
| `/admin/users/create`, `/admin/users/:id/edit` | B | `UserEditPage`, `UserFormSwitch` -> `DsSwitchField`, school pickers -> `DsEntityPicker`, `SchoolAdminGenerator`, `ParentStudentLinker`, `GradeCards` -> `DsSwatch`; titles "Daftar Pengguna"/"Edit Pengguna" |
| `/admin/schools/create` (+edit) | B | `SchoolFormPage` |
| `/admin/school-subscriptions/create` | B | `SubscriptionCreatePage`, `SubscriptionSchoolPicker` -> `DsEntityPicker`; title "Daftar Langganan" |
| `/admin/comp-students/create` | B | `CompStudentCreatePage` |
| `/admin/banners/create` (+edit) | B | `BannerFormPage` |
| `/admin/articles/create` (+edit) | B | `AdminArticleFormPage` |
| `/admin/notes/create` (+edit) | B | `AdminNoteFormPage` |
| `/admin/subjects/create` (+edit) | B | `SubjectFormPage`, `ColorSwatch`/`SubjectIconTile` -> `DsSwatch` (no `:style`) |
| `/admin/education-levels/create` (+edit) | B | `LevelFormPage` |
| `/admin/pksk/questions/create` (+edit) | B | `PkskQuestionFormPage` |
| `/admin/audio-kbat/create` | B | `AudioSetCreatePage` |
| `/admin/audio-kbat/template` (+1) | n/a | `AudioTemplatePage` empty stub: either a real page (B) or the route is dropped (open question Q13) |
| `/admin/curriculum/chapters/create`, `.../:id/edit`, `/topics/create`, `/topics/:id/edit` | B | thin wrappers; `ChapterContextCard` -> `DsPanel` |
| `/admin/questions/create`, `/admin/questions/:id/edit` | B | `QuestionCreatePage`/`QuestionEditPage` (+4 local comps), `AiExplanationCard` -> `DsPanel`, `ArabicKeyboardPanel` -> `DsFloatingPanel` (or `DsDialog`) |
| `/admin/questions/import` | C | `QuestionImportPage` (116 debt): `DsFileField`, `DsDefinitionList` help, `DsCallout` |
| `/admin/import-students` | C | `StudentImportPage`, `StudentSchoolPicker` -> `DsEntityPicker`, `ExistingStudentsPanel` -> `DsPanel` |
| `/admin/bulk-import` | C | `BulkImportPage`, `BulkSchoolPicker` |
| `/admin/curriculum` | G | `CurriculumBrowserPage`, `ChapterBlock`/`TopicBlock`/`SubtopicItem` -> `DsAccordion`; empty state |
| `/admin/tools/screenshots` | G | `ScreenshotsPage`: two `DsFormSection`; title "Muat Naik Tangkapan Skrin" |

### Batch 5 - detail pages and print sheet (H)

| Route | Template | Main replacements |
|---|---|---|
| `/admin/questions/:id` | H | `QuestionDetailPage` (160 debt): `DsDefinitionList`, `DsBadge`, `DsPanel` |
| `/admin/structured-questions/:id` | H | `StructuredDetailPage` |
| `/admin/school-subscriptions/:id` | H | `SubscriptionDetailPage` (132): `DsDefinitionList`, `DsDataTable`, `DsPager` |
| `/admin/comp-students/:id` | H | `CompStudentDetailPage` |
| `/admin/users/:id/packages` | H | `UserPackagesPage` |
| `/admin/notes/:id`, `/admin/articles/:id` | H | `AdminNotePreviewPage`, `AdminArticlePreviewPage`: `DsProse` |
| `/admin/school-subscriptions/:id/renewal-invoice` | print | `RenewalInvoicePage`: `DsPrintSheet` + `DsDataTable`; palette classes removed (47) |

### Batch 6 - shell and close-out

`PentadbiranLayout.vue` -> `DsAppShell` composition (no `:ui`, no gradient tiles); `group-accent.ts` literals into `src/ds`; sidebar search; navbar delta; delete the baseline; re-audit with the same probe (37 screens at 375/768/1280) and compare to the top-10 problems.

## 6. Accessibility checklist (WCAG 2.2 AA)

| Check | Rule |
|---|---|
| Heading order | one `h1` (navbar), panel titles `h2`, sub-sections `h3` through `DsPanel`/`DsSection` only |
| Focus order | back link, header actions, tabs, KPI links, filter bar, table, pager; `DsFormBar` last; the first focusable after route change is the main region |
| Targets | every control >= 44px (buttons, pill items, switches, row icon buttons 44 on coarse pointers); tile links whole tile |
| Colour | status = icon + word; KPI accent never the only cue; contrast >= 4.5:1 body, 3:1 large and UI (tokens already satisfy) |
| Labels | filter selects have `aria-label` = the noun (no visible label); icon-only buttons have BM `aria-label`; `DsPillNav` items `aria-current="page"` (links) or `aria-pressed` |
| Tables | sr-only caption "Jadual {benda}", sortable headers `aria-sort`, card list at `< md` keeps the same text and the row actions |
| Live regions | `DsLoadError` `role="alert"`; loading skeleton `role="status"` "Memuatkan..."; toast `aria-live="polite"` |
| Keyboard | Ctrl+K opens "Cari menu"; Esc closes drawers and popovers; drawer focus trap; accordion rows operable with Enter/Space |
| Reflow | no horizontal page scroll from 320; tables scroll only inside `DsDrillTable`; 400% zoom keeps one column |
| Motion | `prefers-reduced-motion` honoured by `DsStatTile` rise and count-up (unchanged DS behaviour; no live enhancements, D10) |

## 7. Open questions for the product owner (each has a default)

| # | Question | Default applied here |
|---|---|---|
| Q1 | **Replaced by section 8** (owner: Kirkpatrick is not a nav question; redesign from context). Owner decisions needed are listed in 8.8. | See section 8 |
| Q2 | Navbar `h1` size: audit measured 16px while the language doc says 24px. | `text-heading` 20px at `lg`+, 16px below |
| Q3 | **ANSWERED 2026-10-29: "ikut context".** "Daftar {Entiti}" for registering an entity (Pengguna, Sekolah, Pelajar Komplimen, Langganan), "Tambah {Item}" for other records; "Muat Naik" and "Import" stay. Mapping per page in section 5. | Applied (1.13) |
| Q4 | Landing item label "Dashboard" is English inside the group "Papan Pemuka"; rename to "Ringkasan" (Kirkpatrick also uses it) or keep? | Keep "Dashboard" (menu label PP-01 as designed) |
| Q5 | Dashboard KPI set (Pengguna, Sekolah, Bank Soalan, Langganan Aktif, Tiket Terbuka) and the three list panels plus "Pintasan": correct and available from existing endpoints? | **ANSWERED: approved as proposed** (2.I) |
| Q6 | Detail/drill-down title: navbar entity crumb through a new shell hook (S2), or entity name in the page header `#meta`? | S2 hook; `#meta` until it exists |
| Q7 | Number format "1,271" (comma) as the single format, also in Bahasa Melayu context? | Yes, comma, no decimals; ratios 1 decimal |
| Q8 | Edit forms: "Simpan" everywhere, or keep live "Kemaskini" on user edit? | "Simpan" |
| Q9 | Where does the "live" cue live after removing the LIVE badge and clock from the header? | `DsLiveBadge` inside the Live Feed panel only |
| Q10 | KPI tile accents: keep varied categorical accents (2026-10-18 decision; the audit calls the "rainbow" competing with the primary) or one accent per strip? | Keep varied, max 5 in fixed order |
| Q11 | Forms: full width with 2-up fields (default) vs a narrow readable column left-aligned at 768px. | **ANSWERED: full width, same left edge as every page** |
| Q12 | Arabic keyboard floating panel: new `DsFloatingPanel` or move it into a `DsDialog`? | `DsFloatingPanel` (COULD) |
| Q13 | `/admin/audio-kbat/template`: empty stub page; build it or drop the route? | Drop the route unless live has the page |
| Q14 | Table density: cozy 56px rows with `tight` only for 7+ columns - is `tight` acceptable on report mini tables? | Yes |
| Q15 | Menu label fixes ("Upload Screenshot" -> "Muat Naik Tangkapan Skrin", "Set Audio KBAT" -> "Audio KBAT", "Kirkpatrick Evaluation" -> "Ringkasan"): approve the renames? | Approved as written |
| Q16 | Retire the Kirkpatrick bordered mini tables, "Overview" tab label and "Template XLSX/Word" English wording (-> "Ringkasan", "Templat")? | Yes |

All other questions: the proposed defaults are accepted (owner, 2026-10-29).

## 8. Kirkpatrick redesign (context-first, 2026-10-29)

> **SUPERSEDED 2026-10-29 (D77):** the product owner revoked this restructuring of the Pemantauan area; the original menu, pages, tabs and sections stay. Kept for reference only; do not build from it.

Owner: "aku tak faham page ni ... fahami context dan pastikan UI/UX yang terbaik dulu. sekarang ni sangat teruk". This section redesigns the whole area from its purpose, not from its seven tabs. Sources: URS/SRS M12 v1.7, API `apps/api/src/modules/reports/kirkpatrick` (rules, services levels/student/feedback/interventions/export), the 7 pages and their 1280 screenshots.

### 8.1 What it is and who uses it

The Kirkpatrick model is a standard way to judge whether a programme works, in four steps: did people like it (Reaksi), did they learn (Pembelajaran), did their behaviour change (Tingkah Laku), did the real results improve (Hasil). The portal applies it to PrestasiPlus itself.

- **Who:** Admin Pusat for everything; the school admin has the old-system alias `/admin-sekolah/kirkpatrick` = the Ringkasan screen scoped to their own school (URS v1.6, INFERRED; K6 keeps it as is); teachers get the full twin under `/guru/kirkpatrick*` with their own scope (unverified, URS Q-M12-1); students keep `/kirkpatrick` ("Kirkpatrick — Prestasi Saya").
- **Decision it supports:** (1) is the platform really helping students, and (2) which schools or students need help now, so an action is recorded and its effect checked later.
- **What the data really is today (API):** T1 = monthly survey scores (NPS 0-10 per role, satisfaction 1-5), always platform-wide. T2 = accuracy of answered questions, per subject and school. T3 = number of answered questions per student, grouped in 5 bands, school alerts, hourly heat map. T4 = estimated grade (GPS) from imported school test results ("headcount", OTR), not real SPM results. Interventions = hand-typed records whose status (Meningkat / Menurun / Menunggu Semakan) is derived from before/after accuracy. Scope is secondary students (T4/T5).

### 8.2 The page's plain-language purpose (this is the intro copy)

Exact BM, shown once at the top of Ringkasan in a collapsible `DsCallout tone="info" title="Tentang halaman ini" storageKey="kirkpatrick-intro"` (open the first time, then remembered):

> "Halaman ini menunjukkan sama ada PrestasiPlus benar-benar membantu pelajar belajar. Ia menyemak empat perkara mengikut turutan: adakah pengguna berpuas hati, adakah pelajar menjawab dengan lebih tepat, adakah mereka menggunakan platform dengan tetap, dan adakah keputusan peperiksaan bertambah baik. Gunakannya untuk mencari sekolah atau pelajar yang perlu dibantu, kemudian rekodkan tindakan susulan."

Each screen's subtitle (one sentence, the question it answers) is in 8.4.

### 8.3 Information architecture: 7 pages -> 5 screens (+ student detail)

Primary story: **"Adakah platform berkesan? Di mana perlu dibantu? Apa tindakan dan adakah ia berkesan?"** The admin reads top to bottom (Ringkasan), drills into a step, then acts.

| New screen (menu label, sub-group "Keberkesanan Platform") | Question it answers | Replaces | Kirkpatrick name (secondary text) |
|---|---|---|---|
| 1. **Ringkasan** | "Adakah platform berkesan secara keseluruhan?" | Overview + T1 Reaksi + Rantaian Impak + PDF | Tahap 1-4 |
| 2. **Pembelajaran** | "Adakah pelajar menjawab dengan lebih tepat?" | T2 | Tahap 2 |
| 3. **Penggunaan Platform** | "Adakah pelajar menggunakan platform dengan tetap, dan di mana kurang?" | T3 | Tahap 3 · Tingkah Laku |
| 4. **Keputusan Peperiksaan** | "Adakah keputusan peperiksaan bertambah baik?" | T4 | Tahap 4 · Hasil |
| 5. **Tindakan Susulan** | "Apa tindakan yang telah diambil dan adakah ia berkesan?" | Intervensi | - |
| Student detail (not in menu) | "Bagaimana prestasi pelajar ini?" | pelajar/:id | - |

Why merge: T1 is four numbers (not a screen), the impact chain repeats the four level cards plus a conclusion (so it becomes the "Kesimpulan" panel of Ringkasan), and Overview already shows all four levels. Result: one summary, three evidence screens, one action screen.

**Plain labels (jargon replaced; formal term kept as secondary text, owner to approve, 8.8):**

| Today (live) | New label | Explanation line (caption) |
|---|---|---|
| T1 Reaksi / NPS | Kepuasan Pengguna / Skor Cadangan | "Sejauh mana pengguna sanggup mengesyorkan PrestasiPlus (0-10)." |
| T2 Pembelajaran / Learning Gain | Pembelajaran / Peningkatan Pembelajaran | "Perubahan ketepatan jawapan berbanding bulan lepas." |
| T3 Tingkah Laku / Engagement | Penggunaan Platform / Tahap Penggunaan | "Berapa banyak soalan dijawab oleh setiap pelajar." |
| Champion / Konsisten / Berkembang / Minimum / Tidak Terlibat | Sangat Aktif (50+ soalan) / Aktif (20-49) / Mula Aktif (5-19) / Sangat Sedikit (1-4) / Tidak Aktif (0) | - |
| Mastered / Developing / Beginning | Mahir / Sedang Berkembang / Baru Bermula | ">= 80% / 50-79% / bawah 50% ketepatan" |
| T4 Hasil / GPS | Keputusan Peperiksaan / Gred Purata Sekolah (GPS) | "GPS lebih rendah = lebih baik. Anggaran daripada keputusan ujian sekolah (OTR), bukan keputusan SPM sebenar." |
| Head Count / OTR | Data Headcount | "Keputusan ujian sekolah yang diimport." |
| Rantaian Impak | Kesimpulan | - |
| Intervensi / Rekod Intervensi Baru | Tindakan Susulan / Tambah Tindakan | - |
| Predictive Grade | Anggaran Gred | - |
| Streak etc. | unchanged unless they appear on these screens | - |

Menu: sub-group "Keberkesanan Platform" (was "Kirkpatrick") in group "Pemantauan"; the five items above; the page text "Model Kirkpatrick" appears only in the intro (8.2) and as the caption of each screen ("Tahap 2 daripada 4 dalam model Kirkpatrick").

### 8.4 Screens

Common: `DsPage layout="report"`, no title (navbar prints it), `#tabs` = `DsPillNav label="Keberkesanan Platform"` with the 5 screens (items: Ringkasan, Pembelajaran, Penggunaan Platform, Keputusan Peperiksaan, Tindakan Susulan; the one in-page nav), one `DsFilterBar` (Sekolah, Negeri; "Cari") where the data supports a filter, KPI strip 2-5. Every KPI tile has a plain label, a value and a `sub` that says what it means ("Baik", "Perlu perhatian") with a `DsBadge`, and a `to`.

#### 8.4.1 Ringkasan

Subtitle: "Ringkasan keberkesanan PrestasiPlus dalam empat langkah."

```
DsPage layout="report" subtitle
  #tabs DsPillNav (5)    #actions UButton color="neutral" variant="soft" icon="download-simple" label="Muat Turun Laporan"
  DsCallout tone="info" title="Tentang halaman ini" collapsible storageKey  (8.2)
  DsFilterBar  Sekolah | Negeri | Cari            (T1 ignores it: see note below)
  DsStatRow density="roomy" prefix="kirk"  (4 tiles, each `to`)
     Kepuasan Pengguna  "4.6/5"   sub "336 respon"                 -> #kepuasan (same page)
     Pembelajaran       "73.3%"   sub "ketepatan jawapan"          -> /admin/kirkpatrick/learning
     Penggunaan         "2 / 12"  sub "pelajar aktif"              -> /admin/kirkpatrick/behavior
     Keputusan          "GPS 4.30" or "Belum ada data" sub "anggaran" -> /admin/kirkpatrick/results
  DsSplit ratio="8-4" stack-below="xl"
     DsStack
        DsPanel title="Bulan Ini Berbanding Bulan Lepas" description="September 2026 dan Oktober 2026" padding="none"
           DsDataTable variant="bare" density="tight" pager="none"  columns: Ukuran | Bulan lepas | Bulan ini | Perubahan (DsBadge up/down with icon)
           rows: Pelajar Aktif, Ketepatan, Jumlah Jawapan, Pelajar Sangat Aktif
        DsPanel title="Kepuasan Pengguna" id="kepuasan" description="Skor Cadangan (0-10) dan kepuasan (1-5) daripada tinjauan bulanan" padding="none"
           DsDataTable variant="bare" pager="none"  rows: Pelajar | Guru | Admin | Kepuasan purata ; cols Skor, Bilangan respon
        DsPanel title="Kesimpulan"  -> DsDefinitionList (4 plain sentences, one per step; from ChainConclusion)
     #aside
        DsPanel title="Perlu Perhatian" icon="warning" moreTo="/admin/kirkpatrick/behavior" moreLabel="Lihat Semua"
           DsListRow x<=5 (school alert: icon, text, DsBadge) | DsEmptyState size="sm" title="Tiada perkara yang memerlukan perhatian."
        DsPanel title="Tindakan Terkini" moreTo="/admin/kirkpatrick/interventions"  DsListRow x3 (student, status badge) | DsEmptyState size="sm" item="tindakan"
```

Note under the filter: the satisfaction block says "Kepuasan pengguna meliputi semua pengguna dan tidak mengikut penapis." (`DsCallout tone="info"` inline, only when a school/state filter is on).

| Width | Behaviour |
|---|---|
| 375 | Intro callout collapsed after first view; KPI 2x2; panels in this order: Perlu Perhatian, Bulan Ini Berbanding Bulan Lepas, Kepuasan Pengguna, Kesimpulan, Tindakan Terkini; tables become 4-field cards; "Muat Turun Laporan" full width under the subtitle. |
| 768 | KPI 4 in 2x2; one column of panels. |
| 1280 | KPI 4 across; 8/4 split, aside sticky. |

Empty: no activity at all -> one page-level `DsEmptyState icon="chart-line-up" title="Belum ada data untuk dinilai." description="Data akan muncul apabila pelajar mula menjawab soalan."` replacing the panels; the KPI row stays with "-" values. Loading: `DsStatRow loading` + `DsStateView skeleton="table"`. Error: `DsLoadError`.

#### 8.4.2 Pembelajaran

Subtitle: "Adakah pelajar menjawab dengan lebih tepat? Ketepatan jawapan mengikut subjek dan sekolah."

```
DsPage layout="report"  #tabs DsPillNav   DsFilterBar (Sekolah)
DsStatRow roomy (4): Ketepatan Platform | Soalan Dijawab | Skor Purata | Peningkatan Pembelajaran (DsBadge up/down vs bulan lepas)
DsSplit ratio="1-1"
  DsPanel title="Subjek" description="Subjek paling lemah di atas" padding="none"
     DsDataTable bare tight pager="none": Subjek | Ketepatan (DsProgress) | Status (DsBadge Mahir / Sedang Berkembang / Baru Bermula)
  DsPanel title="Sekolah" moreTo="/guru/monitoring" moreLabel="Lihat Semua" padding="none"
     DsDataTable bare tight: Sekolah | Ketepatan (DsProgress) | Soalan Dijawab ; row click -> Monitoring sekolah
```

Default sort for subjects: weakest first (the page's job is to find where to help); live order (strongest first) is a deviation, flagged 8.8. 375: one column, subjects first; tables as cards. Empty: `DsEmptyState size="sm" title="Tiada data untuk tempoh ini."` per panel; if both empty, one page-level empty state.

#### 8.4.3 Penggunaan Platform

Subtitle: "Adakah pelajar menggunakan platform dengan tetap? Lihat sekolah dan pelajar yang kurang aktif."

```
DsStatRow roomy (5): Pelajar T4/T5 | Pernah Aktif | Jumlah Sesi | Soalan Dijawab | Guru Aktif (sub "2 daripada 10")     (Ketepatan moved to Pembelajaran)
DsPanel title="Perlu Perhatian" icon="warning"          (FIRST: this is what the admin acts on)
   DsListRow x N  (alert text; DsBadge Merah/Hijau; #actions UButton "Tambah Tindakan" -> opens Tindakan drawer with the school prefilled)
   (3 kinds, existing: "{sekolah}: {n} pelajar tidak pernah login langsung." / "{n} guru telah login tetapi tiada pelajar yang menjawab soalan." / "{x}% pelajar aktif menjawab soalan.")
DsSplit ratio="8-4" stack-below="xl"
   DsPanel title="Tahap Penggunaan" description="Mengikut bilangan soalan yang dijawab"
      DsDataTable bare pager="none": Tahap | Bilangan pelajar | Peratus (DsProgress) ; the 5 plain band names
   DsPanel title="Waktu Paling Aktif" -> DsHeatGrid (hari x jam 06-23, number in each cell)
DsPanel title="Sekolah" padding="none" -> DsDataTable bare tight: Sekolah | Pelajar | Aktif | % Aktif (DsProgress) | Risiko (DsBadge Rendah/Sederhana/Tinggi)   ; row click -> /guru/monitoring/sekolah/:id
DsPanel title="Mood Pelajar" -> DsEmptyState size="sm" title="Data mood belum mencukupi." description="Pelajar perlu check-in mood harian untuk analisis kesejahteraan." (until M26 supplies data)
```

375: Perlu Perhatian first (already), bands as cards, heat grid scrolls inside its panel with day labels sticky (it is a data grid; allowed to scroll inside only), school table as cards. Empty alerts: "Tiada perkara yang memerlukan perhatian."

#### 8.4.4 Keputusan Peperiksaan

Subtitle: "Adakah keputusan peperiksaan bertambah baik? Anggaran daripada keputusan ujian sekolah yang diimport."

States first: if there is no headcount data (the common demo and early state) the screen shows **one** `DsEmptyState icon="trophy" title="Keputusan peperiksaan belum diimport." description="Keputusan akan dipaparkan di sini selepas data Headcount sekolah diimport. Sementara itu, lihat ketepatan jawapan di Pembelajaran."` with `UButton "Pergi ke Pembelajaran"`, instead of six zero tiles and five "Tiada data." boxes.

With data:

```
DsCallout tone="warning" description="GPS ialah anggaran daripada markah ujian sekolah (OTR), bukan keputusan SPM sebenar. GPS lebih rendah = lebih baik."
DsStatRow roomy (5): GPS Headcount | Kadar Lulus | Pelajar Gred A | Anggaran Gred Platform | Pelajar Aktif (sub "x% daripada y")
DsSplit ratio="8-4": DsPanel "Taburan Gred" (DsChart) | DsPanel "Trend GPS" (DsChart)
DsPanel "GPS Mengikut Subjek" (DsDataTable bare: Subjek | GPS | Gred | Calon | Trend)
DsPanel "Sekolah" (DsDataTable bare)   DsPanel "Anggaran Gred Pelajar" (DsDataTable bare, row -> student detail)
DsPanel "Cadangan Alesa AI" (ResultsAlesa content)
DsCallout tone="info" (3 plain insight sentences from ResultsInsights)
```

Removed: "ROI Platform (Anggaran)" panel (cannot be computed, see 8.7), "Rekod Headcount" tile (a data-quality number, goes into the callout sentence). 375: one column, charts 220px, tables as cards.

#### 8.4.5 Tindakan Susulan

Subtitle: "Rekod tindakan yang diambil untuk membantu pelajar, dan lihat sama ada ia meningkatkan ketepatan."

```
DsPage layout="list"  #tabs DsPillNav (5 screens)   #actions UButton icon="plus" label="Tambah Tindakan"
DsStatRow roomy (4): Jumlah Tindakan | Menunggu Semakan | Meningkat | Menurun
DsFilterBar -> DsNativeSelect "Semua Status" (Menunggu Semakan | Meningkat | Menurun), "Cari"
DsDataTable variant="flush" cardTitle cardFields: Tarikh | Pelajar | Jenis Amaran | Tindakan Diambil | Ketepatan Sebelum | Selepas | Status (DsBadge)
DsDrawer v-model:open title="Tambah Tindakan"
   DsFormSection "Pelajar dan Amaran": DsEntityPicker kind="student" | DsNativeSelect Jenis Amaran | UInput date Tarikh Tindakan | UTextarea Penerangan Amaran
   DsFormSection "Tindakan": UTextarea Tindakan Diambil
   DsFormSection "Kesan" columns=2: Ketepatan Sebelum (%) | Mood Sebelum | Ketepatan Selepas (%) | Mood Selepas
   #footer DsFormBar-style actions: "Batal" + "Simpan"
```

The status filter is a select (not a second pill nav), so the 5-screen `DsPillNav` stays the only one. 375: drawer = bottom sheet, rows as cards. Empty: `DsEmptyState item="tindakan" description="Tambah tindakan apabila anda membantu seorang pelajar."` with primary "Tambah Tindakan" (the dead line "Klik Ambil Tindakan..." is removed, it pointed at a button that never existed). Success toast "Tindakan berjaya disimpan." Entry points: "Tambah Tindakan" on each alert (Penggunaan, Ringkasan) and on the student detail (prefilled).

#### 8.4.6 Student detail

**Superseded by section 9.5**: Kirkpatrick, Monitoring and Langsung share ONE pupil page; this block is its Kirkpatrick content (Alesa, Headcount, platform accuracy), which becomes panels of that page. Original spec follows. Title in navbar: "Penggunaan Platform" with the student name as last crumb (D11). `DsPage layout="detail" backTo="/admin/kirkpatrick/behavior"` (label "Kembali"), `#meta` `DsIdentity` (name, "{sekolah} · Tingkatan {n}"), `#actions` `UButton "Tambah Tindakan"`. Body: `DsSplit 8-4`: `DsPanel "Ringkasan Alesa AI"` + `DsPanel "Ketepatan di Platform"` (`DsDefinitionList` + `DsProgress`) left; `DsPanel "Data Headcount"` aside. No-answer state: `DsEmptyState icon="user" title="Pelajar ini belum menjawab soalan."`. 375: one column.

### 8.5 What the admin does next (actions)

| From | Action | Goes to |
|---|---|---|
| Ringkasan, a tile | open the evidence | Pembelajaran / Penggunaan / Keputusan |
| Ringkasan or Penggunaan, "Perlu Perhatian" | "Tambah Tindakan" | Tindakan Susulan drawer (school prefilled) |
| Pembelajaran / Penggunaan school row | see that school's detail | Monitoring sekolah (M11) |
| Penggunaan / Keputusan student row | see one student | Student detail |
| Student detail (the one shared pupil page, section 9.5) | "Tambah Tindakan" | drawer (student prefilled) |
| School admin (alias) | sees Ringkasan of their own school only, as in the old system; other screens refuse (403) | - |
| Ringkasan | "Muat Turun Laporan" | PDF of the Kesimpulan (content PROPOSED, URS Q-M12-8) |

### 8.6 Accessibility and responsive notes specific to this area

- Status is never colour alone: every `DsBadge` has icon + word (Baik / Perlu perhatian / Naik / Turun).
- The `DsPillNav` is the single nav; `aria-label` "Keberkesanan Platform"; the current screen has `aria-current="page"`.
- Explanation captions use `DsText variant="caption"`; abbreviations (NPS, GPS, OTR) are written out on first use in the panel description.
- Heat grid and charts have a text alternative (`DsChart` hidden table; `DsHeatGrid` prints the number in each cell).

### 8.7 What the data cannot support today (flags)

1. **T1 is platform-wide only**: it ignores the school and state filter and the NPS cards show no respondent count (the count appears only in the chain page: 336 in the observed data). The redesign shows "Responden" in a column and a note under the filter. A per-school satisfaction needs API work.
2. **Correlation panel ("Analisis Korelasi", r = 0.1298, "Lemah", bands 215/149/348)** is a fixed display constant (DC-M12-03), not computed from data; it presents as evidence while being static. Default: hidden; show only if the API computes it.
3. **ROI Platform** cannot be computed (needs costs and real results; the page itself says so). Default: removed.
4. **T4 is estimated** (OTR headcount, not SPM), and demo data usually has none: the "Belum ada data" state is the common state, designed as one honest empty state.
5. **Alerts are school-level and only three kinds** (never logged in, teacher active without student answers, active above 50%); there is no student-level "who to help" list. "Tambah Tindakan" from an alert can prefill the school only; the student is chosen in the drawer. A student-level at-risk list needs API work.
6. **Student picker:** the intervention API takes a numeric student id typed by hand today. `DsEntityPicker kind="student"` needs a student search endpoint (scoped to the school); until then the field stays "Pelajar (ID)" with the existing server-side refusal message.
7. **Before/after accuracy is typed by hand**; prefilling "Ketepatan Sebelum" from the student's platform accuracy is possible from the student-detail data but is not in the contract (PROPOSED).
8. **School filter on T2 and T4 is URL-only** today; the redesign adds the visible Sekolah select (the API already accepts `school_id`).
9. **Mood analysis** has no data owner yet (M26 provisional): the panel stays an empty state.
10. **Fidelity (§6 / D9):** the live copy (English band names, "Learning Gain", "Kirkpatrick Evaluation Flow", the 7 routes) mostly works, so renaming and merging is a **deliberate deviation** by the owner's instruction. M12 URS/SRS, E2E tests (`/admin/kirkpatrick/reaction|chain|...`) and the deviation table (DV-M12-nn) must be updated by the owning role when this is approved; old routes redirect.

### 8.8 Owner decisions (2026-10-29: "ok la.. yang penting ada proper design language dan aestetik values")

| # | Decision | Status |
|---|---|---|
| K1 | Merge 7 -> 5 screens (T1 and Rantaian Impak folded into Ringkasan); old routes redirect | **APPROVED** |
| K2 | Plain BM labels (Sangat Aktif..Tidak Aktif, Mahir.., Skor Cadangan, Keberkesanan Platform) replace live English words | **APPROVED** |
| K3 | Hide the static "Analisis Korelasi"; remove "ROI Platform" | **APPROVED** |
| K4 | Subjects sorted weakest first | **APPROVED** |
| K5 | Numeric student id in the intervention form first; `DsEntityPicker kind="student"` later | **APPROVED** |
| K6 | **CHANGED: access stays as in the old systems (.my and .cloud).** Teachers keep the full `/guru/kirkpatrick*` twin of all five screens (their own scope); students keep their own page "Kirkpatrick — Prestasi Saya" (`/kirkpatrick`, out of this redesign's scope); the school admin keeps the old-system alias (Ringkasan of their own school) | **DECIDED** |

Context sources: the `.my` discovery `docs/discovery/M12-kirkpatrick.md` and the `.cloud` gap list `docs/requirements/v2-cloud-gap.md` row 9 (`.cloud` also has `/admin/kirkpatrick/*` with PDF export).

Visual demo (sample numbers, not real data): Ringkasan (desktop and 390 phone) and Penggunaan Platform: https://claude.ai/artifact/Fdw8BqKKT7ZSPxkRdBPq9u

## 9. Pemantauan information architecture (context-first, 2026-10-29)

> **SUPERSEDED 2026-10-29 (D77):** the product owner revoked this restructuring of the Pemantauan area; the original menu, pages, tabs and sections stay. Kept for reference only; do not build from it.

Owner: `/guru/monitoring` is "berterabur betul"; the screens of the group overlap. Sources: M11 URS (FT-3.x Monitoring, FT-4.x drill-down), M17 URS (Command Center, Aktiviti Harian, drill S4-S7), M12 (section 8), `docs/requirements/v2-cloud-gap.md` rows F-84, F-85, F-122, F-123, F-126, F-174 (.cloud: Monitoring with school/student/teacher drill, CSV and PDF export national-only for Admin Pusat; Command Center shared with the teacher view), screenshots `guru_monitoring_1280.png`, `admin_command-center_daily-activity_1280.png`.

### 9.1 Each screen: one question, one audience

| Screen (today) | Single question it answers | Audience |
|---|---|---|
| **Langsung** (Command Center board) | "Apa yang sedang berlaku di platform sekarang?" (live: login, sesi, live feed, mood, kedudukan sekolah; drills school > teacher > class > pupil) | Admin Pusat; school admin and teacher see their own scope (variant) |
| **Aktiviti Harian** | "Berapa banyak aktiviti hari ini, minggu ini, bulan ini?" (volume over a chosen period, hourly heat map, top pupils) | Admin Pusat (school admin scoped) |
| **Monitoring** (`/guru/monitoring`, "Monitoring Penglibatan") | "Sekolah mana yang kurang menggunakan platform, dan siapa perlu dihubungi?" (rank schools by pupil and teacher engagement, weekly trend, suggested action; drill to a school's pupils and teachers) | Admin Pusat (exports Admin Pusat only); school admin sees their own school; teacher scope unverified |
| **Keberkesanan Platform** (section 8; 5 screens) | "Adakah platform berkesan, dan di mana perlu campur tangan?" (the 4-step model over time, results, actions) | Admin Pusat; teacher twin; school admin alias = Ringkasan of own school |
| **Pelajar** (detail of one pupil; today 3 different pages) | "Bagaimana prestasi pelajar ini, di mana lemah?" | whoever reached it from the above |

Difference in one line: Langsung = now, Aktiviti Harian = volume over time, Pantau Sekolah = who to contact, Keberkesanan = is it working.

### 9.2 Overlaps and single owners

Rule: a metric is **shown in full in one place (the owner)**; every other screen shows at most a tile or a top-5 preview that links to the owner. The definition is one: e.g. "Pernah Aktif" = at least one answered question in scope (M12 DV-M12-08 and M11 FN-3.8.2 already agree).

| Metric / table | Where it appears today | OWNER (full view) | Others |
|---|---|---|---|
| School engagement table (Daftar, Aktif, %, Tahap) | Monitoring "Analisis Sekolah"; Penggunaan Platform "Sekolah" table; Langsung "Top Sekolah"; Aktiviti Harian "Sekolah" | **Pantau Sekolah** | Penggunaan Platform keeps only the 5-band distribution and a top-5 "Sekolah Perlu Perhatian" preview with "Lihat Semua"; Langsung "Top Sekolah" shows top 5 by today's activity (different metric, own definition: aktiviti hari ini); Aktiviti Harian "Sekolah" = activity today per school |
| Alerts and suggested action (Perhatian Segera, Cadangan Tindakan, Amaran & Pemerhatian) | Monitoring; Penggunaan Platform alerts; Ringkasan "Perlu Perhatian" | **Pantau Sekolah** ("Perlu Perhatian") | Ringkasan and Penggunaan Platform show a top-5 preview + "Lihat Semua" to Pantau Sekolah; the "Tambah Tindakan" action lives on the alert wherever it is shown |
| Pupils registered / active / % penglibatan; guru berdaftar / login | Monitoring 9 tiles; Penggunaan Platform tiles; Langsung and Aktiviti Harian tiles | **Pantau Sekolah** (period filter, all-time default) | Penggunaan Platform keeps its tiles (step 3 of the model) but reads the same numbers; Langsung and Aktiviti Harian show the **period** figure ("Pelajar Aktif hari ini") labelled by period |
| Soalan dijawab / ketepatan | Langsung, Aktiviti Harian, Monitoring, Pembelajaran, Penggunaan | **Pembelajaran** (accuracy), **Aktiviti Harian** (volume per period) | Monitoring tile shows the total only |
| Hourly heat map | Aktiviti Harian ("Heatmap Jam", today); Penggunaan Platform (day x hour) | **Aktiviti Harian** | Penggunaan Platform drops its heat map and links ("Lihat waktu paling aktif") |
| Mood Pelajar | Aktiviti Harian panel; Penggunaan Platform panel | **Aktiviti Harian** | Penggunaan Platform removes the empty mood panel (no data either place; M26 not built) |
| Teacher login | Monitoring "Analisis Guru"; Penggunaan "Guru Aktif"; Langsung "Login Terkini"; Aktiviti Harian "Login" | **Pantau Sekolah** (per school) | Langsung and Aktiviti Harian show the live/period login counts |
| Kirkpatrick mini panel on Langsung | Langsung | **Keberkesanan Platform / Ringkasan** | Langsung keeps one tile "Keberkesanan" linking to Ringkasan |
| Weekly trend (M1...M32) | Monitoring only | **Pantau Sekolah** | - |
| One pupil's detail | Monitoring pupil page (answers, subjects, topics, gaps); Kirkpatrick pelajar (Alesa, Headcount, accuracy); Langsung pupil page | **ONE shared pupil page** (9.5) | all other routes redirect to it |
| One teacher / school page | Monitoring teacher and school; Langsung teacher and school | **Monitoring pages** for roster and engagement; **Langsung pages** stay for the live drill (class level exists only there) | cross-links "Lihat di Pantau Sekolah" / "Lihat di Langsung" in `#actions` |

### 9.3 Menu for the group "Pemantauan" (BM)

| Item | Route | Note |
|---|---|---|
| Langsung | `/admin/command-center` | unchanged |
| Aktiviti Harian | `/admin/command-center/daily-activity` | unchanged |
| **Pantau Sekolah** | `/guru/monitoring` | was "Monitoring" (English; page h1 "Monitoring Penglibatan"). Not "Penglibatan Sekolah", because "Penglibatan" is also a menu group (gamification). Owner may keep "Monitoring" (P1) |
| Keberkesanan Platform (sub-group) | `/admin/kirkpatrick*` | Ringkasan, Pembelajaran, Penggunaan Platform, Keputusan Peperiksaan, Tindakan Susulan (section 8.3) |

Other Pemantauan items that are not built stay in the backlog menu and need BM names before they are built (for example "Headcount", "Analitik Adaptif", "Benchmark Sekolah", "Leaderboard Sekolah", "Export Laporan", "DSKP Heatmap": flagged, owner to decide).

### 9.4 Pantau Sekolah (redesign of `/guru/monitoring`)

Template A-style review screen (`DsPage layout="list"`), **no in-page nav**: the five old tabs were anchors to sections that exist on one page; they are now simply the sections in the order the admin acts.

Purpose line (subtitle): "Semak sekolah mana yang kurang menggunakan PrestasiPlus, lihat puncanya, dan putuskan siapa yang perlu dihubungi."

```
DsPage layout="list" subtitle
  #meta     DsText variant="caption" "Dikemas kini {jj:mm}. Muat semula automatik setiap 5 minit."     USwitch label="Muat semula automatik" (on)
  #actions  UDropdownMenu trigger UButton color="neutral" variant="soft" icon="download-simple" label="Muat Turun"
               items "Muat Turun PDF", "Muat Turun CSV"          (Admin Pusat only; hidden for the school admin)
            UButton color="neutral" variant="soft" icon="arrow-clockwise" label="Muat Semula"
  DsCallout tone="info" title="Panduan Monitoring" collapsible storageKey="monitoring-guide"     (the old guide; band legend inside)
  DsFilterBar :chips :active-count @apply @reset
     DsNativeSelect aria-label="Tempoh"  "Semua Masa | 7 Hari | 30 Hari | 3 Bulan"
     DsNativeSelect aria-label="Negeri"  "Semua Negeri | ..."
     DsNativeSelect aria-label="Tahap Penglibatan"  "Semua Tahap | Cemerlang | Sederhana | Rendah | Kritikal | Tiada Langsung"
  DsStatRow density="roomy" prefix="mon" (4 tiles)
     Sekolah            "4"        sub "berdaftar"
     Pelajar Aktif      "2 / 12"   sub "16.7% penglibatan, pelajar T4/T5"
     Soalan Dijawab     "30"       sub "purata 15 bagi setiap pelajar aktif"
     Guru Pernah Login  "2 / 10"   sub "20% penglibatan guru"
  DsSplit ratio="8-4" stack-below="xl"
     DsPanel title="Perlu Perhatian" icon="warning" description="Sekolah yang perlu dihubungi, dengan cadangan tindakan"
        DsListRow x N (to=school)  leading DsBadge (Kritikal | Rendah | Tiada Langsung)  title school  sub "{aktif}/{daftar} pelajar aktif ({p}%). Cadangan: {tindakan}"
        DsEmptyState size="sm" title="Tiada pemerhatian yang perlu diberi perhatian buat masa ini."
     #aside DsPanel title="Sekolah Terbaik" icon="trophy" -> DsListRow x<=3 "{sekolah}: {p}% penglibatan ({aktif}/{daftar} pelajar aktif)"
  DsDataTable variant="flush" layout="fixed" density="cozy" :total  (sorted by % penglibatan, highest first; sort select)
     columns: Sekolah (name, kod, negeri) | Pelajar (aktif / daftar) | Penglibatan (DsProgress, tone auto) | Tahap (DsBadge) | Guru (login / daftar, %) | Trend (DsBadge Meningkat / Menurun / Sama, icon + word)
     pageSizeOptions [20,50,100]   cardTitle="Sekolah"   cardFields (Pelajar aktif, Penglibatan, Tahap, Guru login)   row -> /guru/monitoring/sekolah/:id
  DsPanel title="Soalan Dijawab Mengikut Minggu" description="Warna menunjukkan naik atau turun berbanding minggu lalu" padding="none"
     DsDrillTable (scrolls inside its panel; sticky first column "Sekolah"; columns M{n} + Trend + Terbaik); select "8 minggu terkini | Semua minggu" in the panel #actions
```

Rules applied: 4 tiles instead of 9 (all nine figures remain: Jumlah Sekolah, Pelajar, Pernah Aktif, % Penglibatan, Soalan Dijawab, Purata/Pelajar, Guru Berdaftar, Guru Pernah Login, % Penglibatan Guru are in the tile values or subs); one toolbar rule: export actions in ONE "Muat Turun" menu, refresh = one button plus an auto-refresh switch (the countdown text and the separate pause icon are removed: the switch is the pause; D9 "messy", the data refresh itself is unchanged: every 5 minutes); one filter bar (labels become the first option of each select; button "Cari", never "Tapis"); status by `DsBadge` icon + word.

Fidelity map (every old function stays reachable):

| Old element | Now |
|---|---|
| Panduan card, "Tunjuk panduan" | `DsCallout collapsible storageKey` (hide/show remembered per browser) |
| Auto-refresh countdown + pause, Refresh, PDF, CSV | `#meta` caption + switch, "Muat Semula", "Muat Turun" menu |
| Tempoh / Negeri / Tahap + Tapis + Reset | `DsFilterBar` (Cari, Set Semula) |
| 9 KPI tiles | 4 tiles with subs |
| Tab "Analisis Sekolah" | table columns Pelajar, Penglibatan, Tahap |
| Tab "Analisis Guru" | table column Guru (login/daftar, %); the teacher figures ignore Tempoh and Tahap as on live (column description "tidak ikut tempoh") |
| Tab "Tracking Mingguan" (M1...M32, trend, best week) | panel "Soalan Dijawab Mengikut Minggu"; "Semua minggu" shows M1...Mn; the week-date footer becomes the column `title` |
| Tab "Sekolah Cemerlang / Perhatian Segera" | panel "Sekolah Terbaik" + panel "Perlu Perhatian" |
| Tab "Cadangan Tindakan" | the `sub` line (Cadangan) of each "Perlu Perhatian" row |
| Empty "0 sekolah" with blank table | `DsEmptyState filtered item="sekolah"` ("Tiada sekolah dijumpai." + "Set Semula") |

| Width | Behaviour |
|---|---|
| 375 | Header: subtitle, then switch caption, actions stacked full width ("Muat Turun", "Muat Semula"). Guide collapsed after first view. Filter bar = "Penapis" button with count, fields in a bottom drawer. KPI 2x2. Order: Perlu Perhatian, Sekolah Terbaik, school list as cards (name, progress, Tahap badge, Guru), weekly panel scrolls inside with sticky school name. |
| 768 | KPI 2x2; Perlu Perhatian then Sekolah Terbaik (one column); table without the Trend and Guru % columns (Trend merges under the school name). |
| 1280 | KPI 4 across; 8/4 split; full table, fixed columns, no clipping. |

Empty / error: no schools at all: `DsEmptyState item="sekolah"`; load failure `DsLoadError` replacing the body; weekly panel empty "Tiada data untuk tempoh ini."

#### 9.4.2 School drill-down (`/guru/monitoring/sekolah/:id`)

Question: "Siapa di sekolah ini yang aktif, dan siapa perlu dihubungi?" Template H plus one list nav.

```
DsPage layout="detail" backTo="/guru/monitoring"   (navbar crumb: Pemantauan / Pantau Sekolah / {sekolah})
  #meta     DsText "{kod} · {negeri}"   DsBadge tahap "Rendah — 16.7%"   DsStatusBadge subscription ("Aktif — sehingga 12 Dis 2026" | "Tamat Tempoh — sehingga ..." | "Dibatalkan — sehingga ..." | text "Tiada langganan")
  #actions  UButton color="neutral" variant="soft" icon="pulse" label="Lihat di Langsung" :to command-center/school/:id
  DsStatRow density="roomy" (5): Pelajar T4/T5 | Pernah Aktif | Soalan Dijawab | Guru Berdaftar | Guru Pernah Login
  DsCallout tone="warning" v-if flagged  "{n} akaun menunjukkan aktiviti luar biasa (kelajuan menjawab tidak munasabah - perlu semak). ..."  (live text kept)
  #tabs DsPillNav label="Senarai" items "Pelajar ({n})" | "Guru ({n})"          (the only nav; URL ?bahagian=)
  Pelajar: DsFilterBar -> UInput "Cari nama pelajar..." + DsNativeSelect "Semua Status | Aktif | Login sahaja | Belum login" + Cari
           DsDataTable flush: Nama (e-mel under; DsBadge "Perlu Semak") | Tingkatan | Soalan | Status (DsStatusBadge) | Login Terakhir | Aktiviti Terakhir ; pager 50 ; row -> pupil page
  Guru:    DsFilterBar -> DsNativeSelect "Semua | Pernah Login | Belum Login"; DsDataTable flush: Nama | Status | Login Terakhir | Daftar ; empty "Tiada guru berdaftar untuk sekolah ini."
```

375: KPI 5 = first tile full width + 2x2; table cards (name, status, soalan). 768: KPI `3 + 2` (6-column track); 1280: 5 across. Deviation to approve (P5): the live pupil list is not paginated (up to 174 rows); the redesign pages at 50.

Teacher page (`.../guru/:id`): `DsPage layout="detail" backTo` school; `#meta` DsIdentity + "Login Terakhir: ..." + DsBadge "Pernah Login"; `DsStatRow` 4 (Pelajar T4/T5, Pelajar Aktif, % Aktif, Perlu Perhatian); `DsPanel "Prestasi Pelajar"` with `DsDataTable bare` (Pelajar, Tingkatan, Soalan, Ketepatan with `DsProgress`, Status).

### 9.5 The one pupil page

Today three pages (Monitoring pupil detail, Kirkpatrick pelajar, Langsung pupil) answer the same question. One page, route `/guru/monitoring/sekolah/:sid/pelajar/:id`; the other two routes redirect (P3).

```
DsPage layout="detail" backTo="{where the admin came from: school list}"   (crumb: ... / {sekolah} / {nama})
  #meta DsIdentity (nama, "{e-mel} · T{n}")  DsText "Aktiviti Terakhir: ..."
  #actions UButton "Tambah Tindakan" (opens the Tindakan Susulan drawer, student prefilled)
  DsStatRow density="roomy" (4): Soalan Dijawab | Betul | Salah | Ketepatan
  #tabs DsPillNav label="Bahagian" : Mengikut Subjek | Mengikut Tajuk | Senarai Soalan | Jawapan Salah ({n}) | Gap Analysis ({n})   (the only nav)
  DsSplit ratio="8-4" stack-below="xl"
     (main) the chosen section: DsDataTable bare + DsProgress (subjek, tajuk with DsBadge Kuat/Sederhana/Lemah), question list (DsDataTable, row -> DsDialog "Soalan"), wrong answers (DsPanel per answer), gaps (DsListRow + DsProgress + "Topik Kuat")
     #aside DsPanel "Pemerhatian" (the live observation sentences)  DsPanel "Ringkasan Alesa AI"  DsPanel "Data Headcount"  DsPanel "Ketepatan di Platform"   (the Kirkpatrick pupil content)
  empty: DsEmptyState icon="user" title="Pelajar ini belum menjawab soalan." (keeps the live zero-state numbers in the tiles)
```

375: tiles 2x2; sections nav scrolls; aside panels below the main section. The question modal is `DsDialog` (bottom sheet below `sm`).

### 9.6 What the data cannot support / needs checking

1. The weekly "Trend" and "Terbaik" rules and the row order are INFERRED in the M11 URS (FN-M11-3.6.1); the redesign shows them as `DsBadge` but they stay provisional.
2. Teacher figures ignore Tempoh and Tahap (live rule), so a merged table mixes two filter scopes; labelled in the column description. If confusing in testing, split into a second table (fallback).
3. Exports are national-only for Admin Pusat (cloud gap F-123/F-174); the school admin sees no "Muat Turun".
4. Admin Sekolah scope of the Pantau Sekolah screens is INFERRED (M11 FN-3.8.6); teacher scope on `/guru/monitoring` is unverified (M11 Q-M11-1).
5. The Langsung drill-down data (class level, pupil page) comes from the M17 store; whether its pupil data equals the M11 pupil data (needed for the single pupil page) is unverified; if not, only the Monitoring and Kirkpatrick pupil pages merge and Langsung keeps its own.
6. Langsung and Aktiviti Harian "Sekolah" tables use *activity today*, not engagement %; the two definitions are labelled differently ("Aktiviti hari ini" versus "Penglibatan").
7. Several unbuilt Pemantauan items have English names; not designed here.
8. Fidelity: M11 and M17 SRS (tab names, 9 tiles, the countdown, the 5-tab row) and their E2E tests change; the owning role updates the deviation tables when approved.

### 9.7 Owner decisions (2026-10-29: "semua bawah pemantauan ni buruk la sekarang ni"): P1-P6 all APPROVED as defaulted

The visual demo now also includes Pantau Sekolah (sample numbers, not real data): https://claude.ai/artifact/Fdw8BqKKT7ZSPxkRdBPq9u. Batch order changed: Pemantauan is batch 1, the pilot (section 5).

| # | Decision | Status |
|---|---|---|
| P1 | Rename the menu item "Monitoring" to "Pantau Sekolah" | **APPROVED** |
| P2 | Single owner per metric (9.2): Penggunaan Platform loses its school table, alerts and heat map to previews and links (where the Penggunaan Platform demo shows them in full, this section wins) | **APPROVED** |
| P3 | One shared pupil page; the Kirkpatrick and Langsung pupil routes redirect to it | **APPROVED** |
| P4 | One scrolling Monitoring page (4 tiles, sections in order of action) and a merged school table | **APPROVED** |
| P5 | Page the school pupil list at 50 rows | **APPROVED** |
| P6 | Auto-refresh countdown text removed; an on/off switch replaces countdown and pause icon | **APPROVED** |
