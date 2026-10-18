# PrestasiPlus v2 - Design-System Consolidation Plan

| Field | Value |
|---|---|
| Slug | `v2-design-system` (consolidation part) |
| Version | 1.0, 2026-10-18 |
| Author | ui-ux-designer |
| Status | Proposed, needs user approval (section 7) before any developer task starts |
| Inputs | `v2-design-language.md`, `v2-copy-glossary.md`, `v2-design-system.md`, `v2-admin-pages.md`, `v2-screen-restyle-spec.md` section 1, `src/ds/*`, `config/ds-strict.json`, `eslint.config.ts`, `src/theme/*` |
| Goal | One implementation of each building block, in `src/ds`, used by every module. Modules keep only domain components. |

Scope note: this is an inventory by grep/glob on 2026-10-18 (file lists, a few full reads). Each owning developer re-confirms the diffs between copies before deleting (section 4 step 1).

---

## 1. What exists in `src/ds` today (relevant to this plan)

| Component | Role | Gap |
|---|---|---|
| `DsPage` | page root + optional title/subtitle/actions | header is inline, no back link, no breadcrumb, no tabs slot, always prints h1 |
| `DsPanel` | raised surface (`raised`, `bulk`, `bar`, `flush`) | no title/header slot |
| `DsFilterBar` | search + selects + Cari/Set Semula, mobile drawer | no "more filters" popover, no active chips; Bank Soalan re-implemented all of this inline in `m04 .../QuestionListPage.vue` |
| `DsDataTable` | `UCard` + `UTable` + pager; `dense`, `fixedLayout`, `pageSizeOptions` | three modes tangled in booleans; no bare mode; copy hard-coded |
| `DsPagedTable` | table + pager without card, `pageSizes`, `dense` | duplicate of the above; different pager copy and size label; used only by itself and the gallery (grep: 1 hit in `src`) |
| `DsDrillTable` | hierarchy drill | keep |
| `DsStatTile` | KPI tile (`roomy`, `valueClass`) | no `sub`, `to`, `delta`, `tone`; plays learner `rise` in staff |
| `DsIconChip`, `DsIcon` | chip and icon | chip takes a full class (`i-ph-x-duotone`) so pages choose the weight; staff `sm` (36) > `md` (32) |
| `DsEmptyState` | `UEmpty` + friend | no `size`, no filtered variant |
| `DsDialog`, `useConfirm`, `DsErrorPage` | overlays, 403/404 | keep |

---

## 2. Inventory of duplicated / local building blocks

Columns: where it lives, what it does, replacement. "Same copy" means the body is the same component with cosmetic differences found by file listing and sampling.

### 2.1 Form kit

| Local block | Paths | Canonical replacement |
|---|---|---|
| `AdminField` (label, `*`, hint, server error, `data-testid="field-error"`) | `m09-content/components/admin-kit/AdminField.vue`; `m07-pksk/components/admin/AdminField.vue`; `m02-users-schools/components/AdminField.vue`; related field wrappers `m16 .../lobby/GradeField.vue`, `m10 .../soalan/ImageField.vue`, `m02 .../ImportSourceFields.vue` | **`DsFormField`** |
| `AdminSection` (titled card with icon chip) | `m09 .../admin-kit/AdminSection.vue`; `m07 .../admin/AdminSection.vue` (+ `OptionsCard.vue` is domain, keep, rebuilt on it) | **`DsFormSection`** |
| `AdminFormBar` (sticky Batal + submit) | `m09 .../admin-kit/AdminFormBar.vue` (a `UCard` sticky, `Batal` hard-coded, `i-ph-floppy-disk`); `m07 .../admin/AdminFormBar.vue`; also `m03 .../subjects-levels/FormActions.vue`; per-page action rows in `m02 UserEditPage.vue:453-459`, `SchoolFormPage.vue:294`, `m08 TimelineCreatePage.vue:268` | **`DsFormBar`** (on `DsPanel tone="bar"`) |
| `AdminRowMenu` ("..." `UDropdownMenu`, danger group) | `m09 .../admin-kit/AdminRowMenu.vue`; `m07 .../admin/AdminRowMenu.vue`; inline Edit/Padam button pairs in `m03 SubjectListPage.vue:192-226`, `LevelListPage.vue:178-212`, `m02 UserListPage.vue:500,532`, `m04 QuestionListPage.vue:770-803` | **`DsRowActions`** |
| `AdminActiveFilters` (removable chips + "Set semula") | `m09 .../admin-kit/AdminActiveFilters.vue`; `m07 .../admin/AdminActiveFilters.vue`; inline chips in `m04 QuestionListPage.vue` | **`DsActiveFilters`** (also rendered by `DsFilterBar`) |
| `AdminAlert` | `m09 .../admin-kit/AdminAlert.vue`; `m07 .../admin/AdminAlert.vue`; `m02 .../components/AdminAlert.vue`; `m01 .../auth/AuthAlert.vue` | `UAlert` subtle (design system 12.1); auth keeps its variant until M01 migrates |
| `AdminSwitch` | `m09 .../admin-kit/AdminSwitch.vue`; `m03 .../subjects-levels/ActiveSwitch.vue` | `USwitch` inside `DsFormField` |
| `AdminBackLink` / `BackLink` / `CurriculumBackLink` | `m09 .../admin-articles-notes/AdminBackLink.vue`; `m07 .../components/BackLink.vue`; `m16 .../competition/BackLink.vue`; `m20 .../product/BackLink.vue`; `m03 .../curriculum/CurriculumBackLink.vue` | **`DsBackLink`** (and `DsPageHeader` prop `backTo`) |
| `AdminStatusPill` | `m09 .../admin-articles-notes/AdminStatusPill.vue` and ad-hoc badges in 87 files (191 status words) | **`DsStatusBadge`** |

### 2.2 Native control wrappers (`components/native/*`)

| Local block | Paths | Canonical replacement |
|---|---|---|
| `NativeSelect` (8 copies, three different radii: `rounded-card` 16, `rounded-md` 12, `rounded-(--ds-r-md)`; `px-3` vs `px-4`) | `m02/.../native/NativeSelect.vue`, `m03/.../native/NativeSelect.vue`, `m04/.../native/NativeSelect.vue`, `m07/.../admin/native/NativeSelect.vue`, `m09/.../admin-kit/native/NativeSelect.vue`, `m10/.../native/NativeSelect.vue`, `m11/.../native/NativeSelect.vue`, `m27/.../native/NativeSelect.vue` | **`DsNativeSelect`** (radius sm 8, 44px, caret icon, error ring) |
| `NativeRadio`, `NativeChoice`, `NativeCheckbox`, `NativeCheck`, `NativeSwitch`, `NativeOption`, `ChoiceRadio` | m02 (`NativeChoice`, `NativeCheckbox`, `NativeRadio`, `NativeSwitch`, `NativeOption`), m04 (`NativeRadio`, `ChoiceRadio`), m07 (`NativeCheck`), m09 (`NativeSwitch`), m10 (`NativeRadio`) | `UCheckbox`, `URadioGroup`, `USwitch` (themed centrally). Spike first: where a test or live behaviour needs a real `input[type=radio]`, accept a `DsNativeChoice` fallback; default is none |
| `NativeFile`, `NativeDropZone`, `PreviewImage` | m02, m04, m09, m10 (`NativeFile` x4, `PreviewImage` x2, `NativeDropZone` x1) | **`DsFileField`** on `UFileUpload` (accept, max size, preview, drop) |
| `NativeInput` | `m11/.../native/NativeInput.vue` | `UInput` |
| `NativeColor` | `m03/.../native/NativeColor.vue` | `UInput type="color"` inside `DsFormField` (spike), else keep as `DsColorField` |
| `NativeDropdown`, `NativePanel` | `m02/.../native/NativeDropdown.vue`, `NativePanel.vue` | `UDropdownMenu` / `DsPanel` |
| `RtlScope` | `m04/.../native/RtlScope.vue`, `m10/.../native/RtlScope.vue` | **`DsRtlScope`** (Arabic text, one copy) |

### 2.3 Page header, breadcrumb, nav pills

| Local block | Paths | Canonical replacement |
|---|---|---|
| `PageHeader` (h1 + subtitle + leading + actions, "same look as DsPage's header") | `m08-student-performance/components/shared/PageHeader.vue` | **`DsPageHeader`** (props `titleTestid`, `subtitleTestid` kept through attrs) |
| Header row in `DsPage` | `src/ds/DsPage.vue` | `DsPage` delegates to `DsPageHeader` |
| `ReportCrumb`, `MonitoringCrumbs` | `m27/.../shared/ReportCrumb.vue`; `m11/.../monitoring/MonitoringCrumbs.vue` | **`DsBreadcrumb`** (collapses to last two on < md) |
| `PillNav` (button/link pills, `data-active`) | `m27/.../shared/PillNav.vue`; level/period chips in `m08 HeadcountDashboardPage.vue:62`, `m16 ...` | **`DsPillNav`** (segmented `UTabs` look, links or select) |
| Board/daily headers | `m17/.../command-center-board/BoardHeader.vue`, `DailyHeader.vue` | domain (kiosk board); keep, but use `DsPageHeader` tokens; out of scope |

### 2.4 KPI / stat blocks

| Local block | Paths | Canonical replacement |
|---|---|---|
| `StatRow` (grid of tiles, test-id prefix) | `m27/.../shared/StatRow.vue` (2/4 cols, `UCard` + `DsIconChip`); `m16/.../battle/StatRow.vue` | **`DsStatRow`** (+ `DsStatTile`) |
| `StatGrid` | `m08/.../shared/StatGrid.vue` | `DsStatRow` |
| `StatCards` | `m10/.../dashboard/StatCards.vue`, `m10/.../command-center/StatCards.vue`, `m05/.../dashboard/StatCards.vue`, `m05/.../dashboard-v2/HomeStats.vue`, `m05/.../dashboard/PlatformStats.vue`, `SubjectStats.vue`, `HomeSubjectStats.vue`, `m02/.../UserStatCards.vue`, `m03/.../curriculum/CurriculumStatCards.vue`, `m14/.../student-a/S11StatCards.vue`, `GamStat.vue` | `DsStatRow`; learner Home keeps `HomeStats` as the learner composition **of** `DsStatTile` (3 across) |
| Stat cards (single) | `m17/.../command-center/CcStatCard.vue`, `CcModalStats.vue`; `m11/.../monitoring/MonitoringStatCard.vue`; `m12/.../common/KirkpatrickStatCard.vue`; `m16/.../solo/StatBar.vue`; `m02/.../native/StatLink.vue` | `DsStatTile` (add `sub`, `to`, `tone`, `delta`) |

### 2.5 Tables and pagers

| Local block | Paths | Canonical replacement |
|---|---|---|
| `CardTable` / `CardRow` / `CardCell` (raw table + scoped CSS to dodge the "no raw table" lint) | `m02/.../native/CardTable.vue`, `CardRow.vue`, `CardCell.vue` | **`DsDataTable`** (slots per column cell, `#card`) |
| `KirkpatrickTable`, `KirkpatrickTableSection` | `m12/.../kirkpatrick/common/KirkpatrickTable.vue`, `KirkpatrickTableSection.vue` | `DsDataTable` inside `DsPanel` |
| Feature tables | `m10/.../command-center/CcTable.vue`; `m11/.../analisis-item/ItemTable.vue`, `monitoring/MonitoringEngagementTable.vue`; `m27/.../classes/ClassTable.vue`, `monthly/MonthlyTable.vue`, `amaran/AmaranPupilTable.vue`; `m08/.../headcount/HeadcountTable.vue`, `prestasi/SubjectGpsTable.vue`; `m16/.../lobby/TopTenTable.vue` | `DsDataTable` (keep each file as a thin **domain** component that only declares columns and cell slots) |
| Legacy table + pager | `src/components/data/DataTableCard.vue`, `LaravelPager.vue` (English "Showing x to y of z results") | `DsDataTable` pager (BM) |
| `DsPagedTable` | `src/ds/DsPagedTable.vue` | merged into `DsDataTable variant="bare"`, then deleted |

### 2.6 Filters

| Local block | Paths | Canonical replacement |
|---|---|---|
| Module filter forms | `m27/.../classes/ClassFilters.vue`, `heatmap/HeatmapFilters.vue`; `m11/.../laporan/FilterCard.vue`, `analisis-item/ItemFilterCard.vue`, `monitoring/MonitoringFilters.vue`; `m12/.../common/KirkpatrickFilterBar.vue`; `m20/.../product/ProductFilters.vue`; `m04 QuestionListPage.vue:~480-560` (inline drawer + popover) | **`DsFilterBar`** (extended) with fields in slots |

### 2.7 Load / error / empty

| Local block | Paths | Canonical replacement |
|---|---|---|
| Load error boxes | `m05/.../quiz/LoadError.vue`, `m06-spm/.../LoadError.vue`, `m07-pksk/.../LoadError.vue`, `m15/.../LoadError.vue`, `m20/.../product/LoadError.vue`, `m16/.../competition/PageLoadError.vue`, `m08/.../shared/PageLoadError.vue`, `m03/.../ErrorBox.vue`, `m04/.../ErrorBox.vue`, `m13/.../teacher/PageState.vue`, `m14/.../student-b/StudentBLoadState.vue`, `m12/.../common/KirkpatrickLoadState.vue`, `m16/.../solo/LoadState.vue` | **`DsLoadError`** (+ skeleton via `USkeleton`) |
| Empty states | `m25/.../heatmap/HeatmapEmpty.vue` and inline `<p>Tiada ...</p>` blocks (grep: 50+ in `src/modules`) | `DsEmptyState` (+ `size`, `filtered`) |

### 2.8 Other candidates noticed (decide per module)

`m05 BadgeShelf / CountNumber` (count-up: use `DsStatTile`'s), `m16 RingTimer` (use `DsScoreRing`), `m04 QuestionSummaryCard`, `m10 ClassCard` (domain cards, restyle only), `m06/m05 SubjectIcon` x2 (identical; move to one `DsSubjectIcon` mapping subject slot to icon + dot). These are listed so they are not forgotten; they are not part of the numbered tasks.

---

## 3. New and changed Ds components - props API

Conventions for all: Vue 3 `<script setup lang="ts">`; pass-through attrs (so `data-testid`, `id`, `aria-*` of the old element are kept 1:1); default BM copy from `src/ds/copy.ts` (glossary); colour/radius/shadow inside the component; tests + a gallery entry in `src/dev/ds`.

### 3.1 `DsPageHeader` (new; `DsPage` uses it)

```ts
props: {
  title?: string            // h1 text. Suppressed automatically when the shell prints the title
  subtitle?: string
  backTo?: RouteLocationRaw // shows DsBackLink; label from backLabel
  backLabel?: string        // default 'Kembali'
  titleTestid?: string; subtitleTestid?: string
  showTitle?: 'auto' | boolean // default 'auto' = from route meta `shellTitle` (staff Pentadbiran true)
}
slots: leading, breadcrumb, subtitle (rich), actions, tabs, meta   // actions right; wrap below title at 375, primary stays last
```
Layout: row `justify-between`; `tabs` row below with gap 16; `meta` = KPI/chips right under subtitle. Title `text-title` display; one `h1` only.

### 3.2 `DsFilterBar` (evolved; no separate DsToolbar)

```ts
props: {
  activeCount?: number                  // mobile chip count
  chips?: { key: string; label: string }[]   // renders DsActiveFilters under the bar
  moreCount?: number                    // count badge on "Lagi Penapis"
  tone?: 'panel' | 'plain'              // default: panel (staff), plain (learner) as today
  showReset?: 'auto' | boolean          // auto = activeCount>0
  loading?: boolean
  applyLabel?: string; resetLabel?: string; moreLabel?: string; sheetTitle?: string; sheetApplyLabel?: string  // defaults from copy.ts (Cari / Set Semula / Lagi Penapis / Penapis / Guna)
}
slots: search, default (inline fields), more (popover on >= md, inside the drawer on < md), actions
emits: apply, reset, remove-chip(key)
```
Behaviour as the restyle spec 1.3; the URL stays the state; callers bind fields to query params.

### 3.3 `DsActiveFilters` (new)

```ts
props: { chips: { key: string; label: string }[]; label?: string /* 'Penapis aktif:' */; resetLabel?: string /* 'Set Semula' */ }
emits: remove(key), reset
```
Testids kept: `active-filters`, `active-filter`, `active-filters-reset`.

### 3.4 `DsDataTable` (one API, replaces `DsPagedTable`)

```ts
props: {
  data: T[]; columns: TableColumn<T>[]; caption?: string; rowKey?: string
  variant?: 'card' | 'flush' | 'bare'   // card = UCard (today default); flush = edge-to-edge in a panel (today `dense`); bare = no surface (today DsPagedTable, inside tabs/panels)
  layout?: 'auto' | 'fixed'             // fixed = table-fixed (today `fixedLayout`)
  density?: 'cozy' | 'tight'            // tight = px-3 (today PagedTable `dense`); cozy default (rows ~56px)
  stickyHeader?: boolean; stickyFirstColumn?: boolean
  loading?: boolean; error?: string; retryLabel?: string
  emptyTitle?: string; emptyDescription?: string; filtered?: boolean   // picks 'Tiada ... dijumpai' vs 'Belum ada ...'
  total?: number; pageSize?: number; pageSizeOptions?: number[]        // total => server paging
  cardTitle?: string; cardFields?: CardField[]; sortItems?: ...        // < md fallback (today)
  selectable?: boolean                                                 // adds checkbox column; v-model:selection
}
v-model: page, pageSize, sort, selection
slots: all UTable cell/header slots, empty, card (full custom mobile card, replaces DsPagedTable `card`), card-actions, toolbar
emits: retry, row-click
```
Deprecated aliases for one release: `dense` (= `variant="flush"`), `fixedLayout` (= `layout="fixed"`), `emptyLabel` (= `emptyTitle`). `DsPagedTable` becomes a re-export wrapper (`variant="bare"`, `pageSizes` -> `pageSizeOptions`) and is deleted at T9. Pager copy: "Menunjukkan {dari}-{hingga} daripada {jumlah} hasil", "{n} / halaman". Mobile card `li` uses `rounded-chip` (sm), not `rounded-card`, inside the card variant.

### 3.5 `DsFormField`

```ts
props: {
  label: string; name?: string; for?: string
  required?: boolean         // visual '*' (text-error) + sr-only 'wajib'
  hint?: string; help?: string; description?: string
  error?: string             // server/manual error; testid field-error kept
  native?: boolean           // native control mode: no UFormField context; slot props wire id/aria
  size?: 'md' | 'lg'
}
slots: default (props: { id, describedby, invalid }), label-extra, hint
```
Default mode wraps `UFormField` (validation from `UForm`). `native` mode keeps browser `required` validation and `reportValidity`, binds `for`/`id`/`aria-describedby`/`aria-invalid` for the slotted `DsNativeSelect` or `<input>` from `UInput`. Label `text-label`, hint `text-caption text-muted`, error `text-caption text-error` + icon `warning-circle`, `role="alert"`.

### 3.6 `DsFormSection`

```ts
props: { title: string; description?: string; icon?: string /* base name */; accent?: DsAccent; tone?: 'default' | 'danger'; columns?: 1 | 2 }
slots: default (fields, grid gap-5; columns=2 => sm:grid-cols-2), actions (header right), footer
```
`UCard` raised (lg), padding 20/24, header with `DsIconChip sm` + `h2 text-subheading`; `tone="danger"` ("Zon Bahaya") uses error-tinted chip, no red border.

### 3.7 `DsFormBar`

```ts
props: {
  submitLabel?: string        // default 'Simpan'
  cancelLabel?: string        // default 'Batal'
  cancelTo?: RouteLocationRaw // link; otherwise emits cancel
  saving?: boolean; disabled?: boolean
  showCancel?: boolean        // default true
  sticky?: boolean            // default true (bottom, shadow-bar-up)
  submitIcon?: string         // default 'floppy-disk'
}
emits: cancel
slots: status (left), extra (before Batal), submit (replace)
```
On `DsPanel tone="bar"`. Submit is `type="submit"` with `loading`. Testids `form-cancel`, `form-submit`. Right-aligned order: extra, Batal (tonal), submit (primary).

### 3.8 `DsRowActions`

```ts
props: {
  actions: { label: string; icon?: string; to?: RouteLocationRaw; onSelect?: () => void; danger?: boolean; disabled?: boolean; confirm?: { title: string; body?: string; confirmLabel?: string } }[]
  inline?: number            // first N non-danger actions as ghost icon+label buttons before the '...' menu (Bank Soalan: 2)
  label?: string             // aria for the menu, 'Tindakan'
  testid?: string            // default 'row-menu'
}
```
Danger items in their own group (no divider; level gap). `confirm` calls `useConfirm()` with the glossary dialog. Trigger 44px.

### 3.9 `DsStatRow` (+ `DsStatTile` additions)

```ts
// DsStatRow
props: {
  items: { key: string; label: string; value: string | number; icon?: string; accent?: DsAccent; tone?: 'success'|'warning'|'error'; sub?: string; to?: RouteLocationRaw; delta?: { value: string; dir: 'up'|'down'|'flat' } }[]
  prefix?: string          // testid prefix: `${prefix}-${key}` (+ -label|-value|-sub)
  cols?: 'auto' | 2 | 3 | 4 | 5   // auto: 2 / 3 / up to 5 by count at 375/768/1280
  roomy?: boolean; loading?: boolean
}
// DsStatTile gains: sub?: string, to?: RouteLocationRaw (tile is a link), tone?, delta?, loading? (skeleton)
```
`rise` entry limited to once per load (decision D-3 in the language doc).

### 3.10 `DsStatusBadge`

```ts
props: { status: 'active'|'inactive'|'approved'|'pending-approval'|'awaiting-review'|'rejected'|'draft'|'published'|'done'|'in-progress'|'expired'|'risk-low'|'risk-mid'|'risk-high'|'new'|'live'; label?: string /* live exception */; size?: 'sm'|'md' }
```
Maps to icon + word + colour per glossary section 4. Replaces `AdminStatusPill` and ad-hoc `UBadge` strings.

### 3.11 `DsLoadError`

```ts
props: { message: string; title?: string; retryLabel?: string /* 'Cuba Semula' */; inline?: boolean; testid?: string }
emits: retry
```
`UAlert` subtle error + `warning-circle` + tonal retry button; `role="alert"`; `inline` for in-panel use.

### 3.12 `DsPillNav`, `DsBreadcrumb`, `DsBackLink`

```ts
// DsPillNav: segmented UTabs look, one control for tabs/links/period switch
props: { items: { key: string|number; label: string; icon?: string; to?: RouteLocationRaw; testid?: string }[]; active: string|number|null; ariaLabel: string; testidPrefix?: string }
emits: select(key)   // when items have no `to`
// DsBreadcrumb
props: { items: { label: string; to?: RouteLocationRaw }[]; collapseBelow?: 'md' }   // < md shows last two + overflow menu
// DsBackLink
props: { to: RouteLocationRaw; label?: string /* 'Kembali' */ }   // ghost button, icon arrow-left, 44px
```
`DsPillNav` keeps `data-active` and `${prefix}-${key}` testids from M27's `PillNav`.

### 3.13 `DsNativeSelect`, `DsFileField`, `DsRtlScope`

```ts
// DsNativeSelect  (native <select>; the only native control kept, because of browser `required`, blank 'Pilih' option, options reloading under the user)
props: { modelValue: string|number; placeholder?: string /* adds empty first option */; required?: boolean; disabled?: boolean; invalid?: boolean; items?: { label: string; value: string|number; disabled?: boolean }[] }
slots: default (raw <option>/<optgroup> when items not used)
// look: bg-elevated, rounded-sm, min-h-11, px-3.5, text-body, caret-down icon, 2px inset error ring when invalid
// DsFileField   (UFileUpload wrapper)
props: { modelValue: File|File[]|null; accept?: string; maxSizeMb?: number; multiple?: boolean; preview?: 'none'|'image'; label?: string; hint?: string }
// DsRtlScope: wraps Arabic text: dir="rtl", Scheherazade New, text-body.
```

### 3.14 Small changes to existing

| Component | Change |
|---|---|
| `DsIcon`, `DsIconChip`, `DsStatTile` | accept a **base name** (`funnel`), resolve weight by personality; full `i-ph-*` classes still accepted for one release (lint warns). Staff chip sizes sm 28 / md 32 / lg 40 |
| `DsPanel` | add `title`, `description`, `icon`, `#actions` slot for the standard panel header |
| `DsEmptyState` | add `size: 'sm'|'md'`, `filtered`, default actions slot hint "Set Semula" |
| `src/ds/copy.ts` (new) | single source of default BM strings from the glossary; no component writes a literal default |

---

## 4. Ordered migration plan

Rule for every task: no behaviour change; keep every `data-testid`, `id`, `name`, route, query param (restyle spec 1.8); keep live copy and list it as a live exception; update the module's tests; run lint, type-check, the module tests and `registry-boot.test.ts`; check 375/768/1280 and light/dark. Module tasks touch **only their own module folders** (plus adding their globs to `config/ds-strict.json`), so they can run in parallel. No shared mock data is changed, so no worktree is required; per the shared-tree rule do not leave half-done edits.

### Step 1 - confirm (each owner, 30 min, in their task)
Diff the copies in their module against the canonical API; list any behaviour the Ds version lacks and report it before deleting.

### Phase 0 - core (must merge first; four parallel Ds tasks, then one integrator)

| ID | Task | Files owned (no overlap) |
|---|---|---|
| **T0a** | `DsFormField`, `DsFormSection`, `DsFormBar`, `DsNativeSelect`, `DsFileField`, `DsRtlScope` + tests + gallery | new `src/ds/DsForm*.vue`, `DsNativeSelect.vue`, `DsFileField.vue`, `DsRtlScope.vue`, `src/ds/__tests__/form.test.ts`, `src/dev/ds/DsGalleryForms.vue` |
| **T0b** | `DsPageHeader`, `DsBackLink`, `DsBreadcrumb`, `DsPillNav`; `DsPage` delegates; `DsPanel` header props | `src/ds/DsPageHeader.vue`, `DsBackLink.vue`, `DsBreadcrumb.vue`, `DsPillNav.vue`, edits `DsPage.vue`, `DsPanel.vue`, tests, `src/dev/ds/DsGalleryPage.vue` |
| **T0c** | `DsDataTable` unified API (merge `DsPagedTable`), `DsFilterBar` extended, `DsActiveFilters`, `DsRowActions` | edits `DsDataTable.vue`, `DsFilterBar.vue`, `DsPagedTable.vue` (wrapper), new `DsActiveFilters.vue`, `DsRowActions.vue`, tests, `src/dev/ds/DsGalleryTables.vue` |
| **T0d** | `DsStatRow`, `DsStatTile` additions, `DsStatusBadge`, `DsLoadError`, `DsEmptyState` changes, `DsIcon`/`DsIconChip` base names + chip sizes, `rise` staff rule | edits `DsStatTile.vue`, `DsEmptyState.vue`, `DsIcon.vue`, `DsIconChip.vue`, new `DsStatRow.vue`, `DsStatusBadge.vue`, `DsLoadError.vue`, tests, `src/dev/ds/DsGalleryStates.vue` |
| **T0e** (after a-d) | Integrator: `src/ds/copy.ts` (glossary strings), `src/ds/index.ts` exports, lint L1-L7 scaffolding and baselines, `docs/design/v2-design-system.md` section 12.3 update, run full gates | `src/ds/copy.ts`, `src/ds/index.ts`, `eslint/*`, `config/*.json`, `src/ds/__tests__/no-local-kits.test.ts`, `copy-lint.test.ts`, doc edit |

T0a-T0d own disjoint files; they must not edit `index.ts` or `copy.ts`: they export through the names above and T0e wires them (each task lists its exports in its report). To start T0a-d in parallel before `copy.ts` exists, components import defaults from `./copy` which T0e creates first as a stub with the glossary strings (T0e-stub, 15 minutes, runs before T0a-d).

### Phase 1 - module migrations (parallel after T0e; each owns its folders exclusively)

| ID | Modules / folders owned | Replace | Delete |
|---|---|---|---|
| **M-A** | `src/modules/m09-content/**`, `src/modules/m07-pksk/**` (the two admin kits are the same component) | `AdminField/Section/FormBar/RowMenu/ActiveFilters/Alert/Switch`, `AdminBackLink`, `AdminStatusPill`, `native/*`, `m07 BackLink`, `LoadError`, list pages to `DsPageHeader` + `DsFilterBar` + `DsDataTable` | `m09 .../admin-kit/**`, `m07 .../admin/{Admin*,native}/**`, `m07 BackLink/LoadError` |
| **M-B** | `src/modules/m02-users-schools/**` | `native/*` (13 files), `AdminField`, `AdminAlert`, `CardTable/Row/Cell` to `DsDataTable`, `UserStatCards`, `StatLink` to `DsStatRow`, list/form action rows | `m02 .../native/**`, `AdminField`, `AdminAlert` |
| **M-C** | `src/modules/m04-question-bank/**`, `src/modules/m03-curriculum/**` | `native/*`, `ErrorBox` x2, `QuestionListPage` inline filter/popover/active chips to `DsFilterBar` + `DsActiveFilters` + `DsRowActions`, `FormActions`, `ActiveSwitch`, `CurriculumStatCards`, `CurriculumBackLink` | `m04/.../native/**`, `m03/.../native/**`, `ErrorBox` x2 |
| **M-D** | `src/modules/m10-teacher-class/**`, `src/modules/m27-school-admin/**` | `native/*`, `StatRow`, `PillNav`, `ReportCrumb`, `ClassFilters`, `HeatmapFilters`, `ClassTable`, `MonthlyTable`, `AmaranPupilTable`, `StatCards` x2, `CcTable` | `m10/.../native/**`, `m27/.../native/**`, `m27/.../shared/{StatRow,PillNav,ReportCrumb}` |
| **M-E** | `src/modules/m08-student-performance/**` | `PageHeader`, `StatGrid`, `PageLoadError`, `HeadcountTable`, `SubjectGpsTable`, level/period chips to `DsPillNav`, "Lihat →" copy | `m08 .../shared/{PageHeader,StatGrid,PageLoadError}` |
| **M-F** | `src/modules/m11-teacher-analytics/**`, `src/modules/m12-kirkpatrick/**`, `src/modules/m17-admin-dashboard/**` | `native/*`, `FilterCard/ItemFilterCard/MonitoringFilters/KirkpatrickFilterBar`, `ItemTable`, `MonitoringEngagementTable`, `KirkpatrickTable(+Section)`, `*StatCard`, `MonitoringCrumbs`, `KirkpatrickLoadState` | the replaced files |
| **M-G** | `src/modules/{m05-practice,m06-spm,m13-cikgu-alesa,m14-gamification,m15-rewards-shop,m16-battle-games,m20-marketplace,m25-ai-centre,m22-support-tickets,m28-bijak-spm}/**` and `src/modules/m01-authentication/**` (only `AuthAlert` stays) | `LoadError/PageLoadError/PageState/LoadState` to `DsLoadError`, `StatRow/StatBar/StatCards` to `DsStatRow`, `BackLink` x2 to `DsBackLink`, `ProductFilters` to `DsFilterBar`, `SubjectIcon` x2 | the replaced files |
| **M-H** | `src/shells/**`, `src/components/**` (legacy), `src/pages/**` | `components/data/LaravelPager`, `DataTableCard` removed after M-A..M-G finish; shells use `DsBreadcrumb`; `NotFound/Forbidden` copy to `copy.ts` | legacy `components/data/*` |

Groups were chosen so each owns whole folders; any task that needs a file in another task's folder asks the owner (use the continue-the-subagent rule) instead of editing it.

### Phase 2 - close-out

| ID | Task |
|---|---|
| **T9** | Delete `DsPagedTable.vue` and the deprecated aliases; flip lint baselines to empty; update `v2-design-system.md` section 12.3 and the Galeri DS; QA: responsive sweep at 375/768/1280, light/dark, axe, copy lint, `registry-boot` test |
| **QA** | `qa-engineer` runs the affected ACs per module (targeted G5) after each M-task; final cross-module smoke over the archetypes (list, form, report, dashboard) |

Suggested order of waves: T0e-stub, then T0a-d in parallel, T0e, then M-A..M-G in parallel (up to the usual 3 browser lanes for visual checks), then M-H, T9.

---

## 5. Lint / ratchet proposals (stop new local copies)

All follow the existing ratchet idea in `config/ds-strict.json`: an **append-only / shrink-only baseline** file plus a unit test.

| ID | Rule | Mechanism | Baseline |
|---|---|---|---|
| **L1** | No module-local building blocks: files matching `components/**/native/**`, `*FormBar*`, `*RowMenu*`, `*ActiveFilters*`, `Admin(Field|Section|Alert|Switch|BackLink|StatusPill)*`, `*PageHeader*`, `*PillNav*`, `*Crumb*`, `*StatRow*`, `*StatGrid*`, `*StatCards*` (domain exceptions listed), `*LoadError*`, `*ErrorBox*`, `*LoadState*`, `CardTable*` outside `src/ds` | Vitest `src/ds/__tests__/no-local-kits.test.ts` globbing `src/modules/**`; fails on any match not in the baseline, **and fails if a baseline path no longer exists** (forces cleanup) | `config/ds-local-kits.baseline.json` (generated from section 2; each module task removes its entries; final target `[]`) |
| **L2** | Raw `<select>`, `<label>`, `<table>` only inside `src/ds` | extend ESLint `vue/no-restricted-html-elements` (already G-5 for strict files) to all `src/modules/**`, with a per-file override list that only shrinks (`eslint/ds-strict.mjs` pattern) | override list in `config/ds-strict.json` `"rawHtmlAllowed"` |
| **L3** | Deprecated imports: `DsPagedTable`, `@/components/data/*` banned | `no-restricted-imports` patterns, per-file allowlist shrinking | same json |
| **L4** | Radius/shadow/arbitrary values in modules | when a module finishes, append its glob to `strict` with level `page` (G-1..G-3b ban `rounded-*`, `shadow-*`, arbitrary values). A unit test already prevents relaxing. Done-criterion of each M-task: its folders in `ds-strict.json` | `config/ds-strict.json` |
| **L5** | Copy lint: banned literals in `src/modules/**` and `src/ds/**`: `Cuba Lagi`, `label="Reset"`, `Set semula`, `Showing`, `Tiada rekod ditemui`, `INACTIVE`/`ACTIVE` as labels, `(optional)`, ` →` inside `label`, `Hapus` | Vitest `copy-lint.test.ts` with regexes read from `docs/design/v2-copy-glossary.md` table section 9 (or a JSON mirror) | `config/copy-exceptions.json`: `{ file, literal, reason, liveRef }`; reason `live` requires a `liveRef` (URL or SRS id); new entries need review |
| **L6** | Icon weight: staff modules may not contain `-duotone` icon names; `DsIconChip`/`DsStatTile` `icon=` must be a base name | Vitest scan + ESLint `vue/no-restricted-syntax` on `icon="i-ph-*"` for `Ds*` icon props | `config/ds-local-kits.baseline.json` section `icons` (shrinks to empty) |
| **L7** | New `.vue` under `src/modules/**/components/**` whose name collides with a `Ds*` synonym fails with a hint "use DsXxx" | part of L1 name patterns | |
| **L8** | Token tests (G-9) extended: staff chip sizes, radius scale values, `--ds-r-*` ordering (`xs < sm < md < lg < xl`) | existing `tokens.test.ts` | |

Order of introduction: T0e adds L1, L3, L5, L6 baselines from the current tree (everything currently offending is listed, nothing new can be added); L2 and L4 tighten as M-tasks land; T9 asserts every baseline is empty.

---

## 6. Acceptance criteria for the whole effort

| # | Criterion | Check |
|---|---|---|
| 1 | No file matches L1 outside `src/ds` | `no-local-kits.test.ts` baseline `[]` |
| 2 | Every list, form, report, dashboard page matches its archetype (design language section 9) | review checklist section 11 |
| 3 | One pager text, one empty-state wording, one retry label | `copy-lint.test.ts` passes with only documented live exceptions |
| 4 | Inputs, selects are radius sm everywhere; no `rounded-*` in modules | L4 + visual review |
| 5 | One icon weight per portal | L6 |
| 6 | All existing tests green; no `data-testid` lost | CI + `registry-boot` |
| 7 | 375 / 768 / 1280, light / dark: no horizontal page scroll | e2e responsive sweep |

---

## 7. Decisions needing user approval

| # | Decision | Default |
|---|---|---|
| A1 | One `DsDataTable` (variants `card`/`flush`/`bare`) replacing `DsPagedTable`; deprecated props kept one release | Yes |
| A2 | Evolve `DsFilterBar` rather than add `DsToolbar` | Yes |
| A3 | Keep **one** native control (`DsNativeSelect`); replace native radio/check/switch/file wrappers with Nuxt UI parts (fallback `DsNativeChoice` only if a spike shows a test/live dependency) | Yes |
| A4 | `DsPageHeader` hides the h1 when the shell prints it (route meta `shellTitle`); needs the shell to set that meta | Yes |
| A5 | BM pager and glossary wording (D-5 in the design language) including legacy English pager screens | Yes |
| A6 | Task order: Phase 0 core before any module work (modules would otherwise re-fork the kits) | Yes |
| A7 | Lint baselines as above (shrink-only), enforced from T0e | Yes |
