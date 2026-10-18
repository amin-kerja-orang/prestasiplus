# PrestasiPlus v2 - Design Language

| Field | Value |
|---|---|
| Slug | `v2-design-system` (language part) |
| Version | 1.0 |
| Date | 2026-10-18 |
| Author | ui-ux-designer |
| Status | **Proposed - needs user approval** (see section 12) |
| Why | User, 2026-10-18: "design system dan language kena main peranan penting juga. bukan asal siap asal ada." Parallel revamps fragmented the UI (module-local kits, mixed radii, mixed copy). |
| Sits on top of | `v2-design-system.md` (tokens, overrides, guard rules: stays the token authority), `v2-shells.md`, `v2-admin-pages.md`, `v2-screen-restyle-spec.md` |
| Companions | `v2-copy-glossary.md` (BM terms), `v2-ds-consolidation.md` (components, migration, lint) |

The design system says **what the values are**. This document says **how to use them so every screen feels like one product**: which decision applies where, and how a page is put together. If a page needs something this document does not allow, the answer is a change to the design system, never a local style.

---

## 1. Principles

| # | Principle | Test a reviewer can run |
|---|---|---|
| P1 | **One product, two personalities.** Learner "Elektrik" and staff "Kobalt" share tokens, anatomy and copy; only accent energy and density differ. | Swap `data-personality` on a page: layout and copy must not break, only colour/size/motion change. |
| P2 | **Compose, never re-invent.** Page = `Ds*` composites + Nuxt UI parts. A building block used on 2+ pages lives in `src/ds`. | `grep` finds no module-local `*FormBar*`, `*Field*`, `*Stat*`, `*Header*`, `native/*` (see consolidation doc, lint L1). |
| P3 | **Layers, not lines.** Page, raised, elevated; soft shadow; zero borders. | No `border`, `divide`, `ring` (except focus/error) in any class list. |
| P4 | **Cozy, not compact.** 16px body, 44px controls, 56px table rows, 20-24px card padding. The old system is the bar to beat, and it reads at a glance. | Bank Soalan row height >= 56px at 1280; no control under 44px on a staff page. |
| P5 | **Lively through meaning, not decoration.** Colour, motion and depth appear where they carry information: a KPI, a state change, a primary action. | Cover the colour: can you still tell what is primary, what is wrong, what is new? Uncover: colour only repeats it. |
| P6 | **Same thing, same words, same place.** One BM term per action; one slot per element (title, filters, actions, pager). | The glossary lint passes; the page matches an archetype in section 9. |
| P7 | **Hierarchy by size.** Radius, shadow and type step with importance; an inner element is always smaller than what holds it. | Nesting table in section 4 holds on every card. |
| P8 | **Fidelity where it works, fix where it does not (D9).** Live copy and behaviour stay; layout and styling follow this language. | Deviation noted in the module table only when live is broken. |
| P9 | **Respect the exam context** (learner): no guilt, no celebration on wrong answers, number is the hero. | Unchanged from design system 1.2 (7, 8). |

---

## 2. Two personalities and how each shows up

| Dimension | Pentadbiran / staff "Kobalt" (Admin Pusat, PPD/JPN, Admin Sekolah, Guru, Ibu Bapa, Penaja) | Pembelajaran / learner "Elektrik" (Murid) |
|---|---|---|
| Voice of the screen | Calm control room: scan, compare, act | Game-like coach: motivate, reward, move on |
| Base | Light: ink-50 page, white raised. Dark: `#0D1120` / `#171C2D` | Dark default: `#0B0D12` / `#15181F`; light available |
| Accent | Kobalt only (action, link, focus, active). Semantic colours only where meaning needs them | A1 blue gradient for action; A2 lime win, A3 orange heat, A4 violet friend/AI, each with one job |
| Where colour sits | KPI icon chip (12% tint), primary button, active nav item (tone + weight), status badge, chart series, zebra | Hero card gradient, active pill, solid icon chips, character cards, progress, win moments |
| Icons | Phosphor **Regular**, kobalt on 12% tint chip | Phosphor **Duotone**, white/ink on solid chip; Fluent 3D for rewards |
| Density | Cozy-wide: table row ~56px, control 44px, 16px body (14-15px label) | Roomy: control 52-56px, cards 20-28px radius feeling, 16px body |
| Page title | `text-title` (30-40px) in the shell navbar as the one h1 | `text-title` in-page, display weight |
| Surfaces | `shadow-ds-xs` cards, `shadow-card` for toolbar/featured | `shadow-lift` cards, `shadow-hero` hero |
| Motion | `press`, `count-up`, `live-pulse`, drawer/modal transitions, KPI `rise` entry (proposed, see section 7) | Full catalogue |
| Extras | Charts, tables, bulk bars, filters | Friend, 3D art, confetti, stickers |
| Never | 3D art, friend, gradient fills, orange reward fills | Data tables (use card lists), dense toolbars |

Guru, Ibu Bapa and Penaja live inside the learning shell but use the **staff** column everywhere on the page (decision already in design system 11). A page file never branches on role to style itself; `data-personality` does it.

---

## 3. Type scale and density

Authority: `tokens.css` `--text-*` and design system section 7 and "Density scale (cozy)". Pages use only these utilities (stock `text-xs...9xl` banned).

| Utility | Size (375 to 1280) | Staff size | Use | Never |
|---|---|---|---|---|
| `text-display` | 40 to 56px, Display 800 | same | Win score, hero numbers (learner), one per screen | Staff table cells |
| `text-title` | 30 to 40px; staff 24 to 28px | see tokens | The **one** h1 | Card titles |
| `text-heading` | 22 to 26px; staff 18 to 20px | | Section h2, KPI numbers (`DsStatTile`), dialog titles | Table text |
| `text-subheading` | 19 to 22px | | Card titles, sheet titles, h3 | Labels |
| `text-body` | 16px / 1.55 | 16px < md, 15-16px >= md | Paragraphs, table cells, input text | Hints |
| `text-label` | 15px / 600 | | Buttons, field labels, nav, badges, cell emphasis | Paragraphs |
| `text-caption` | 13px / 500 | | Hints, units, timestamps, pager summary | Essential content |
| `text-overline` | 13px caps +0.08em | | Table headers, nav group labels | Titles |
| `tabular` | | | Every number in a table, KPI or pager | |

Rules:

1. Max three type steps per card (title, body, caption). A KPI tile is number (`text-heading`), label (`text-label`), sub (`text-caption`).
2. Weight is part of the step; pages never add `font-bold`/`font-semibold` (G-3). The only page-level typographic utility besides the scale is `font-display` on a title, and it is baked into `DsPageHeader` and `DsStatTile`, so pages do not write it.
3. Body copy `max-w-prose`. Numbers right-aligned in tables.
4. Casing: titles and button labels are Title Case BM (as live: "Set Semula", "Tambah Soalan"); hints, descriptions and toasts are sentence case. Never ALL CAPS in copy (the overline style uppercases by CSS).
5. Density is a property of the **shell** (`data-density`), not of a page. A page that needs more columns uses `DsDataTable density="tight"` (3-4px less cell padding), not smaller type.

---

## 4. Radius hierarchy and nesting rule

Scale (tokens): **xs 4, sm 8, md 12, lg 16, xl 24, full**. Utilities: `rounded-xs/sm/md/lg/xl/full` plus semantic `rounded-card` (lg), `rounded-sheet` (xl), `rounded-chip` (sm). Pages never write `rounded-*` (G-3); composites do.

| Level | Radius | What |
|---|---|---|
| xs 4 | tags, checkbox, kbd, table-cell highlight, progress segments |
| sm 8 | **inputs, selects, textareas** (Nuxt field config `rounded-sm`), chips, icon chips (`rounded-chip`), zebra/inner rows inside a card, dropdown items |
| md 12 | **buttons**, segmented tabs and their triggers, toasts, popovers, nav items |
| lg 16 | **cards, panels, tables** (`rounded-card`), alerts |
| xl 24 | hero cards, character cards, modals, drawers/sheets (`rounded-sheet`), featured KPI band |
| full | badges, pills, avatars, dots, progress track |

**Nesting rule (testable).** An element's radius is **strictly smaller** than its container's, and when the gap between them is below 16px it steps down one level further. Concretely:

| Container | Allowed children |
|---|---|
| xl 24 (modal, hero) | lg card (inside a modal body), md button, sm input, sm chip |
| lg 16 card / table / panel | **md button**, **sm input and select**, sm chip, sm inner row. **Never another lg** (no card inside a card, no `rounded-card` list item inside a `UCard`) |
| md 12 (segmented list) | sm trigger chips (Nuxt does md on trigger; accepted: the list has 4px padding so visual gap is 8px) |
| sm 8 input | xs adornments |

Where a card needs an inner grouped surface (zebra row, nested block), use `bg-soft` or `bg-elevated` with **sm 8**, or no extra shape at all.

Violations found today (fix in consolidation):

| File | Problem | Fix |
|---|---|---|
| `src/ds/DsDataTable.vue` (mobile card list `li`) | `rounded-card` (16) row inside a `UCard` (16) | `rounded-sm` via DsDataTable internal change (token `rounded-chip`) |
| `m02/m03/m04/m10/m27 .../native/NativeSelect.vue` | `rounded-card` (16) on a 44px select; inputs are **sm 8** | replaced by `DsNativeSelect` (sm) |
| `m11 .../native/NativeSelect.vue` | `rounded-(--ds-r-md)` arbitrary value and `px-4` | same |
| `m07/m09 NativeSelect` | `rounded-md` (12) | same |
| 184 `.vue` files in `src/modules` | `rounded-2xl/3xl/[..]` per the grep count (527 hits) | owner module's migration task removes them; ratchet lint L4 |

---

## 5. Colour roles

Values live in design system section 3. This section is **how to choose**.

### 5.1 Accent usage (60-30-10)

| Role | Staff | Learner | Rule |
|---|---|---|---|
| **Primary action** | Kobalt solid button, one per view region | A1 gradient button | Exactly one solid primary per card/form/bar. Others are tonal (`soft`) or ghost |
| **Secondary action** | Tonal (`bg-elevated`) button | same | Never an outline button (redefined as tonal) |
| **Navigation active** | Kobalt 10% fill + `text-highlighted` + weight | Filled gradient pill | Colour + weight + label, not colour alone |
| **Link** | `text-primary` | `--ds-primary-t` | Underline on hover/focus, not at rest inside prose only |
| **Focus** | 2px primary ring | same | Only decorative-looking ring allowed |
| **Highlight / win** | Lime only for Mod Pelajar, "Baharu" badge | A2 on win moments only | Never as a section background |
| **Brand icon tint** | Kobalt 12% chip | Solid accent chip | One chip colour per page unless the chip encodes a category (rule in 6.3) |

### 5.2 Semantic colours

| Colour | Meaning | Always paired with | Typical use |
|---|---|---|---|
| success (daun) | done, correct, approved, active | check icon + word | `Diluluskan`, `Aktif`, positive delta |
| warning (mentari) | needs attention, pending, expiring | warning icon + word | `Menunggu`, `Hampir tamat`, risk "Sederhana" |
| error (delima) | failed, destructive, wrong, risk "Tinggi" | x/warning icon + word | form errors, `Ditolak`, delete button |
| info (laut) | neutral notice | info icon + word | tips, banners |

Semantic colours never decorate (no green icon just because "it looks fresh"). Status = `UBadge variant="subtle"` + icon + word (full list in the glossary). Delta numbers (up/down) use success/error **and** an arrow glyph.

### 5.3 Data-viz palette

| Case | Palette | Rule |
|---|---|---|
| Single series | kobalt (`--ui-primary`) | Default for one metric over time |
| Categorical (subjects, schools) | `--ds-cat-1..8` in slot order, subject keeps its stored slot | Max 6 series on one chart; beyond that group the tail as "Lain-lain" in `ink-400`. Legend always shows shape or label, not hue alone |
| Sequential (heatmap, mastery %) | kobalt 10 to 90% mix on the raised surface (`DsHeatGrid`) | 5 steps, number printed in the cell; text switches to `text-primary-on` at >= 60% |
| Good / bad (pass-fail, correct-wrong) | success / error | Only when the axis *is* good vs bad; always with label |
| Risk (low/mid/high) | success / warning / error with icon + word | Same triple everywhere (M08, M11, M12, M17, M27 share one `DsRiskBadge` proposal in consolidation doc) |
| Grid/axes | no gridlines; tick labels `text-dimmed` >= 12px | Value labels on bars |
| Learner charts | A1, A4, A2, A3 order | |

---

## 6. Iconography

### 6.1 One style per context

| Context | Weight | Colour |
|---|---|---|
| Staff UI (nav, buttons, tables, toolbar, forms, empty states) | Phosphor **Regular** (`i-ph-<name>`) | `text-muted` default; kobalt on chip/active; semantic on status |
| Learner UI | Phosphor **Duotone** (`i-ph-<name>-duotone`) | neutral, or white/ink on solid chip |
| Tiny status glyph (16px: check, x, arrow, caret) | **Bold**, in both | inherits text colour |
| Never | mixing Regular and Duotone in one portal view; Lucide; FA; emoji as an icon in staff UI | |

Pages pass **base names** (`funnel`, `trash`) and the weight is picked centrally by personality. Today `DsIconChip` takes a full class (`i-ph-fire-duotone`) and pages spell the weight themselves, which is how both weights ended up in staff screens. Fix: `DsIconChip`, `DsIcon` and `DsStatTile` accept `icon="funnel"` and resolve weight. (Task in consolidation doc, T0.)

### 6.2 Sizes

| Size | px | Use |
|---|---|---|
| xs | 16 | inline with `text-label`/`text-caption`, status badge, bold status glyphs |
| md (default) | 20 | buttons, nav items, table row actions, field adornments |
| lg | 24 | bottom nav, section header chip glyph (learner), empty-state staff icon on chip |
| xl | 40-64 | empty/error illustration, hero art |

Icon-only button: `aria-label` (BM) + tooltip, 44px hit area.

### 6.3 Icon-chip rule

1. A chip is a **rounded-sm** square (`rounded-chip`) that wraps one icon to give it a role. Sizes: xs 26 (full radius, dot-like), sm 36, md 32 staff / 40 learner, lg 48. (Known defect: staff `sm` (36) is larger than `md` (32). Fix: staff `sm` 28, `md` 32, `lg` 40; see consolidation T0.)
2. Staff chip: 12% kobalt tint + kobalt glyph (the only permitted tone-on-tone). Learner: solid accent + its `on` colour. Never tint + same-hue glyph in learner.
3. One chip per tile/section header. No chip next to a 3D image; no chip inside a button.
4. Chip colour is **per job**, not per taste: KPI/section = action (kobalt/A1); reward = A3; win = A2; AI/info = A4. **User decision 2026-10-18 (overrides the earlier "action for all" rule):** staff KPI tiles and icon chips use **varied categorical accents** (action, friend, win, heat, trial), a different one for each tile of a row, so colour sits at the focus points and pages are not monotone. Semantic tones (`success/warning/error`, e.g. Betul/Salah, risk counts) are kept where they carry meaning.
5. Chip is `aria-hidden`; the label beside it carries the meaning.

---

## 7. Elevation, layering and motion

### 7.1 Elevation

| Level | Surface token | Shadow | Use |
|---|---|---|---|
| 0 Page | `bg-muted` | none | canvas |
| 1 Raised | `bg-default` | `shadow-ds-xs` (staff) / `shadow-lift` (learner) | cards, tables, panels, sidebar |
| 1+ Featured | `bg-default` | `shadow-card` | toolbar panel, KPI band, sticky bars |
| 2 Elevated | `bg-elevated` | none | inputs, chips, segmented tracks, hover row, bulk bar (`shadow-lift` when sticky) |
| 3 Overlay | `bg-default` / `bg-elevated` (sheet) | `shadow-modal` | modal, drawer, popover, toast |
| Bars | `bg-default` | `shadow-bar` / `shadow-bar-up` | navbar, bottom nav, sticky form bar |

Rules: max 3 levels visible at once; control on raised card uses level 2 fill; interactive cards lift on hover (`shadow-ds-xs` to `shadow-lift`, 200ms) so the page feels alive without extra colour; dark mode swaps shadow for the surface step (tokens do it). Nothing outside these tokens (`shadow-*` named utilities only, via composites).

### 7.2 Motion

Authority: design system section 9. Staff subset, explicit:

| Moment | Motion | Duration |
|---|---|---|
| Press | `press` (translateY 1px) | 100ms |
| Hover (button, row, interactive card) | background/shadow step | 100-200ms `ease-out` |
| KPI entry | `rise` (opacity + 10px), 60ms stagger, **once per page load** | 400ms (proposed; today `DsStatTile` plays learner-length `rise` in staff too: decision section 12 D-3) |
| Numbers | `count-up` | 600ms |
| Drawer, popover, modal | slide/fade | 200ms |
| Page change | opacity fade | <= 120ms |
| Skeleton | pulse | 1.6s loop |
| LIVE | `live-pulse` | 1.6s |

Nothing else moves. `prefers-reduced-motion`: everything above becomes instant (design system section 9). Motion never conveys state alone.

---

## 8. Shared page rules

1. Exactly one `h1`. In **Pentadbiran** the shell navbar prints it (group breadcrumb above, `text-heading` title). In the learner shell and Guru/Ibu Bapa/Penaja layouts the page prints it through `DsPageHeader`. `DsPageHeader` knows which (route meta `shellTitle`), so pages stop deciding.
2. Page root is `DsPage` (width + gaps: 20/24/32px). No page sets its own `max-w-*` or `gap-*` on the root.
3. Order inside a page is fixed by the archetype (section 9). Slots are not reordered per module.
4. Sections are `DsSection`-style panels (`DsFormSection` for forms, `DsPanel` otherwise) with an `h2` `text-subheading` and optional description; never a bare heading over loose content in a staff page.
5. States (section 10) come from `DsEmptyState`, `DsLoadError` (proposed), skeletons shaped like the final layout, and `useToast`.
6. Forms and filters use `DsFormField` / `DsFilterBar`. No `<label>` + hand-built hint/error markup in pages or module kits.

---

## 9. Page anatomy per archetype

Widths: 375 / 768 / 1280. Every wireframe is the 1280 view; the responsive column says what changes. Slot names are the `Ds*` slot names to implement (consolidation doc).

### 9.1 Learner page (Murid)

```
+--------------------------------------------------------------+
| shell: logo / bell / avatar               (bottom tab bar < lg)|
+--------------------------------------------------------------+
|  [#leading back?]  h1 Tajuk Halaman        [#actions]          |  DsPageHeader (in-page h1)
|  subtitle (muted, max-w-prose)                                 |
|                                                                |
|  +-- DsHeroCard (A1 gradient, optional) ---------------+       |  hero OR stat row, not both heavy
|  +------------------------------------------------------+      |
|  [DsStatTile][DsStatTile][DsStatTile]   (3 across)             |
|  h2 Seksyen                                                    |
|  [card] [card] [card]   (card grid: 1 / 2 / 3 col)             |
|  [DsCharacterCard] only if the page has a notice today         |
|  floating Cikgu Alesa button (bottom-right)                    |
+--------------------------------------------------------------+
```

| Slot | Spec |
|---|---|
| Header | `DsPageHeader`: title `text-title`, optional subtitle, actions right (wraps below title at 375) |
| Hero/summary | One of `DsHeroCard` or `DsStatTile` row. Tiles: 3 across at all sizes on Home, 2 at 375 elsewhere |
| Content | Card lists (never data tables), min row 64px, leading `DsIconChip`/`DsArt3D`, trailing number/caret |
| Spacing | 20/24/32 gaps; side gutters 16/24/32; bottom padding clears tab bar + Alesa button |
| 375 / 768 / 1280 | 1 col, bottom tab bar / 2 col / 3 col, sidebar, max 72rem |

### 9.2 Staff list page (table of records)

```
+----------------------------------------------------------------------+
| shell navbar: [group] / h1 Senarai Pengguna           Cari menu  mod |
+----------------------------------------------------------------------+
| subtitle (1 line)                          [secondary] [PRIMARY +]   |  DsPageHeader #subtitle #actions
| [KPI][KPI][KPI][KPI][KPI]                                            |  DsStatRow (optional, 2..5)
| [ v Pecahan (collapsible breakdown) ]                                |  optional DsPanel
| +-- DsFilterBar (DsPanel raised, shadow-card) --------------------+ |
| | [Carian....................] [Cari]  [Pilih A v][Pilih B v][Lagi ▾]| |
| |                                           [Set Semula]            | |
| +-------------------------------------------------------------------+ |
| Penapis aktif: [Tahun 2026 x] [Aktif x]  Set Semula                  |  DsActiveFilters (only when any)
| (bulk bar, sticky, only when rows selected)                          |  DsPanel tone=bulk
| +-- DsDataTable (flush panel) ------------------------------------+ |
| | th overline | th | th | th                          | actions     | |
| | zebra rows ~56px, row actions DsRowActions        |  ...        | |
| | Menunjukkan 1-20 daripada 245 hasil  [20 / halaman]  < 1 2 3 > | |
| +-------------------------------------------------------------------+ |
+----------------------------------------------------------------------+
```

| Slot | Spec |
|---|---|
| Title | In shell navbar (h1) |
| `DsPageHeader` | subtitle left (optional), actions right: **one** primary ("Tambah ..."), then up to 2 tonal. Never wraps primary off the row at >= sm; at 375 actions stack below, full width |
| KPI strip | `DsStatRow` > `DsStatTile roomy`. 2 across at 375 (first full width), 3 at 768, up to 5 at 1280. Numbers computed from the data |
| Filters | `DsFilterBar`: search grows, then Cari; equal-width selects; "Lagi penapis" popover; Set Semula shown only when a filter is active. < md: search + Cari + "Penapis" button (count chip) opening a bottom drawer (fields, "Guna", "Set Semula") |
| Active chips | `DsActiveFilters` under the bar, removable, URL is the state |
| Table | `DsDataTable variant="flush"`; < md cards; row actions in `DsRowActions` (inline "Lihat"/"Edit" + "..." menu with "Padam") |
| Pager | Summary left, page-size select, `UPagination` right. Always shown for server-paged lists |
| States | Section 10 |

### 9.3 Staff form page (create / edit)

```
+----------------------------------------------------------------------+
| shell navbar: [group] / h1 Tambah Pengguna                            |
+----------------------------------------------------------------------+
| [< Kembali]  subtitle                                                 |
| [DsAlert/UAlert error summary - only after failed submit]             |
| +-- DsFormSection "Maklumat Asas" (icon chip, desc) -----+ +-- aside --+|
| | DsFormField label *      DsFormField label            | | help card ||
| | [input.........]         [select.......]              | | (optional)||
| | DsFormField (full row, textarea)                      | |           ||
| +-------------------------------------------------------+ +-----------+|
| +-- DsFormSection "Tetapan" ------------------------------+            |
| +--------------------------------------------------------+            |
| ====== DsFormBar (sticky bottom, shadow-bar-up) ==================== |
|  status text (left)                          [Batal]  [Simpan]        |
+----------------------------------------------------------------------+
```

| Slot | Spec |
|---|---|
| Layout | Single column 375/768; `lg:grid-cols-12`: sections `col-span-8`, aside `col-span-4`, fields in sections as 2-up grid (`sm:grid-cols-2`), full-row for textarea/upload |
| Section | `DsFormSection`: icon chip + `h2 text-subheading` + description; fields `gap-5`; section gap 24 |
| Field | `DsFormField`: label above, `*` for required (error colour, with text "wajib" in `aria-label`), hint `text-caption`, error with icon below. Control is 44px filled |
| Action bar | `DsFormBar` sticky bottom at all sizes in staff; left slot for unsaved/status text; right "Batal" (tonal) then "Simpan"/live submit label (primary, `loading` state, disabled while saving). Never above the form |
| Validation | Native `required` kept where live behaviour depends on it (DsFormField native mode); server errors under the field + summary `UAlert` with focus |
| Destructive | "Padam" is **not** in the bar; it lives in a "Zon Bahaya" `DsFormSection` or the row menu, confirmed by `useConfirm()` |

### 9.4 Staff report page (filters + KPI + charts + table)

```
+----------------------------------------------------------------------+
| shell navbar: [group] / h1 Laporan ...                                |
+----------------------------------------------------------------------+
| subtitle                                   [Muat Turun / Cetak]       |
| [ Tab / pill nav: Minggu Ini | Bulan Ini | Tahun ]  (DsPillNav/UTabs)|
| DsFilterBar (class, subject, period)                                  |
| [KPI][KPI][KPI][KPI]                                                  |
| +-- DsPanel: chart ------------+ +-- DsPanel: chart ------------+    |
| | h2 + legend                  | | h2 + legend                  |    |
| | DsChart 320px                | | DsChart                      |    |
| +------------------------------+ +------------------------------+    |
| +-- DsPanel: DsDataTable (breakdown, drill rows) ----------------+   |
+----------------------------------------------------------------------+
```

| Slot | Spec |
|---|---|
| Header actions | export/print as tonal button; period switch is **tabs** (`UTabs` segmented through `DsPillNav`), not buttons in the header |
| Breadcrumb | `ReportCrumb` becomes `DsPageHeader #breadcrumb` (last two crumbs on < md) |
| KPI | `DsStatRow`, number + label + sub, varied categorical accent per tile (user decision 2026-10-18); semantic tone where it carries meaning (risk counts, Betul/Salah) |
| Charts | two across at >= xl, one below; `DsChart` heights 220/280/320; legend wraps below; hidden data table alternative |
| Table | `DsDataTable` or `DsDrillTable` inside the last panel |

### 9.5 Dashboard (overview / command centre)

```
+----------------------------------------------------------------------+
| h1 Dashboard (shell)                           scope chip   [Muat Semula]|
| [DsStatTile x4-6] roomy, count-up, rise                                |
| +-- featured panel (8 col): trend chart ---+ +-- side (4 col) --------+|
| +-- list/table (top N, "Lihat semua") -----+ | alerts / quick actions ||
| +-- DsLiveTiles (Command Center only)  ---------------------------------+|
+----------------------------------------------------------------------+
```

| Slot | Spec |
|---|---|
| Tiles | 2/3/4-6 across; first tile may span 2 on mobile; each tile links to its filtered list (whole tile is a link, hover lift) |
| Grid | `lg:grid-cols-12`; panels `DsPanel`; no more than 6 panels above the fold's second screen; each panel has one `h2` and at most one "Lihat semua" link (trailing caret icon, not an arrow glyph in the label) |
| Alerts | `UAlert` subtle inside a panel, never a full-width banner unless system-wide |
| Learner dashboard | uses 9.1 (hero + tiles + character cards), not this |

---

## 10. Empty, loading and error states

One component per state, one wording (glossary section 7). Staff and learner differ only by the illustration (staff: spot icon on chip / illustration `kosong`; learner: friend `encouraging`).

| State | Component | Anatomy | Notes |
|---|---|---|---|
| **Empty - never created** | `DsEmptyState` | icon chip (lg) or illustration, `text-subheading` title ("Belum ada {benda}"), one-line description, primary action if the user can create | Inside the panel/table area, not the full page |
| **Empty - no match** | `DsEmptyState` | title "Tiada {benda} dijumpai", description "Cuba ubah atau set semula penapis.", ghost button "Set Semula" | Only when a filter or search is active |
| **Empty - no data for a chart/period** | `DsEmptyState size="sm"` | "Tiada data untuk tempoh ini" (no action) | Inside the chart card, same height as the chart to avoid layout jump |
| **Loading (first)** | `USkeleton` blocks matching the final layout | KPI row = tiles; table = 5 rows at final row height; cards = card shapes | Never a bare spinner. Spinner only inside a loading button |
| **Loading (refresh)** | keep content, table `loading` overlay at 60% opacity, filter button `loading` | no layout shift | |
| **Error - load** | `DsLoadError` (proposed; today 11 variants) | `UAlert` subtle error, warning icon, message, tonal "Cuba Semula" | Replaces `LoadError`, `PageLoadError`, `ErrorBox`, `PageState`, `*LoadState` copies. `role="alert"` |
| **Error - field** | `DsFormField` | text-caption error with icon, 2px inset error ring | |
| **Error - submit** | `UAlert` summary at the form top, focus moves to it | message from server (BM) | |
| **Error - route** | `DsErrorPage` 403/404/500 | per `v2-shells.md` section 7 | Router-level |
| **Success** | `useToast` 4s | `{Entiti} berjaya {dikemaskini}.` | Persistent flash only when navigating away |
| **Confirm destructive** | `useConfirm()` | title "Padam {entiti}?", body, "Batal" + "Padam" (error) | Never native `confirm()` |

---

## 11. Review checklist (applied at G4 to every UI change)

1. Page root is `DsPage`; header is `DsPageHeader`; slots follow the archetype.
2. No module-local kit, wrapper or `native/` file; no `Admin*`/`Native*`/`Stat*` copy.
3. Radius nesting holds; no `rounded-*` on pages.
4. Icons by base name, one weight per portal, chips per section 6.3.
5. Every button/label/empty/error string matches the glossary or is listed as a live exception.
6. All numbers `tabular`; all status = icon + word.
7. 375 / 768 / 1280 no horizontal page scroll; controls >= 44px.
8. Light and dark checked.

---

## 12. Decisions needing user approval

| # | Decision | Default applied |
|---|---|---|
| D-1 | One `DsFilterBar` (evolved) instead of a separate `DsToolbar`; the "Lagi penapis" popover and active chips become part of it | Yes |
| D-2 | Canonical filter wording: Cari / Guna (sheet) / Set Semula; live "Tapis" and "Reset" screens keep theirs only if observed on live (flagged in the glossary) | Yes |
| D-3 | Staff KPI tiles keep a short `rise` entry (400ms, once) to make the portal "lively"; design system 9 currently limits staff to press/count-up/live-pulse | Yes (amend section 9 of the design system) |
| D-4 | Staff icon-chip sizes re-based (sm 28 / md 32 / lg 40) to remove the sm > md defect | Yes |
| D-5 | Pager is BM everywhere ("Menunjukkan ... daripada ... hasil"), including the legacy `LaravelPager` screens that print English "Showing x to y of z results" (D33a already says BM) | Yes |
| D-6 | Breadcrumb/group above the title only in the shell; no in-page eyebrow | Yes |
