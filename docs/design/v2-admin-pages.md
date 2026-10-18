# Portal Pentadbiran: shell and admin list page pattern

Status: implemented on `/admin/questions` (Bank Soalan, M04) and in `src/shells/pentadbiran`.
Replaces the first v2 admin look (gradient hero per page, 37 identical tiles, two-row filter card,
sideways-scrolling table). Staff personality, light and dark. Spec owner: ui-ux-designer role.

## 1. Decision: build on the Nuxt UI dashboard kit

The shell and the list page use Nuxt UI 4.12 dashboard components, not hand-rolled layout. We
theme them through `src/theme/ui.config.ts` and `src/theme/tokens.css`, so they feel like
PrestasiPlus (kobalt primary, ink neutrals, layers instead of lines) but keep the structure and
polish of the kit.

| Need | Component |
|---|---|
| App frame, persisted sidebar size | `UDashboardGroup` (`storage="local"`) |
| Sidebar: resizable, collapses to an icon rail, slideover below `lg` | `UDashboardSidebar` (+ `UDashboardSidebarCollapse` / `Toggle`) |
| Menu groups with nested sub-groups, tooltips and popovers when collapsed | `UNavigationMenu` (items built in `menu-nav.ts`) |
| Content region with own scroll | `UDashboardPanel` |
| Top bar: title, search, theme, scope | `UDashboardNavbar` |
| Ctrl+K command palette over every visible screen | `UDashboardSearch` + `UDashboardSearchButton` |
| Account menu (Mod Pelajar, Log Keluar, theme) | `UDropdownMenu` in the sidebar footer |
| Data table | `UTable` (through `DsDataTable dense`), `UPagination`, `USelect` (page size) |
| Row actions | `UDropdownMenu` |
| Filter overflow | `UPopover` (desktop), `UDrawer` (mobile) |

Native `<select>` stays for filter selects (touch pickers, `required` bulk action, option lists that
reload under the user). It is themed with the same field tokens.

## 2. Shell

```
>= lg   [ sidebar 16-17% (14-26%, collapsible to 4%) ][ navbar 64px                              ]
        [ logo                                       ][ breadcrumb/title      search  scope  mode]
        [ grouped nav (scrolls only if needed)        ][ scrolling body, max 1600px, 16-24px pad  ]
        [ account + scope (footer)                    ]
< lg    navbar with a menu button; the sidebar is a slideover; search is an icon
```

- Full-height column: header (logo), body (menu), footer (account). No inner scrollbar unless the
  menu is longer than the screen.
- Navbar: group name as a small breadcrumb above the screen title (the single `h1`), `Cari menu`
  (Ctrl+K), scope chip (hidden below `lg`; always in the sidebar footer), theme toggle.
- No hero on list pages. The page row below the navbar holds one line of subtitle and the primary
  action. Heroes were removed from the layout (`heroes.ts` deleted); an overview page may add its
  own header block.
- Testids kept: `pentadbiran-sidebar`, `-header`, `-menu-button`, `-scope-chip`, `-theme-toggle`,
  `-account`, `-main`, `-nav`, `-legacy-island`. Group open state is still persisted under
  `pentadbiran_menu`. Pages without `meta.v2` render in the light island.
- Layers (dark): page `#0d1120`, panels and sidebar `#171c2d`, controls and hover `#262d40`.
  Light: page `#ebeef5`, panels `#ffffff`, controls `#ebeef5`. No borders; separation is tone plus
  the `shadow-ds-xs` of a panel.

## 3. Admin list page archetype

Order, top to bottom (all inside `DsPage`, gap 20-32px):

1. **Header row**: subtitle left, primary action right (never wraps).
2. **KPI strip**: 4-6 `DsStatTile` (2 columns on mobile with the first tile full width, 3 at `md`,
   5 at `xl`). Numbers computed from the data (Bank Soalan: Jumlah, Diluluskan, Belum diluluskan,
   Subjek Teras, Subjek Elektif).
3. **Breakdown panel**: collapsible, sortable `UTable` (full names, no truncation, sticky header,
   max height 24rem, collapsed by default, state remembered). Rows link to the filtered list.
4. **Filter toolbar** (`DsPanel`): search that grows plus its **Cari** button, then selects of equal
   width, then "Lagi penapis" (popover, count badge) and, when a filter is active, "Set Semula".
   Below `md` the toolbar is search + Cari + a "Penapis" button (count badge) that opens a drawer
   with every field. Active filters are listed as removable chips under the toolbar. The URL is the
   state.
5. **Bulk bar** (only when rows are selected): sticky `DsPanel tone="bulk"` with count, action
   select and the confirm button.
6. **Table** (`DsDataTable dense`): flush panel, sticky header, zebra and hover rows, row height
   about 56-80px, pager with summary, page-size select (20/50/100) and page buttons.
   - Columns: select, ID (small, muted), Soalan (2-line clamp, badges and source on one wrapping
     row), Subjek (Tahap under it below `2xl`), Tahap (`2xl`+), Kesukaran (stars), Status (badge +
     ACTIVE/INACTIVE), actions (Lihat, Edit, "..." menu with Padam).
   - No horizontal scroll from `xl` (1280) up. Below `md` rows become cards (title clamped to two
     lines, Subjek, Tahap, Status, Kesukaran, row menu).
7. **Empty / error**: unchanged copy ("Tiada soalan dijumpai", "Cuba Semula").

Reusable parts: `DsPanel` (surface), `DsDataTable` props `dense`, `pageSizeOptions` (event
`update:pageSize`), `DsStatTile`, `DsPage` (staff width now `max-w-none`; the shell caps at 1600px).

## 4. Fidelity notes (Bank Soalan)

Every filter, field, BM label and action is kept. Changes are presentation only: the 31 subject
tiles became the sortable breakdown (the 12-character tile cut is gone: full names), the 8 filters
are 3 inline selects + 5 in the popover/drawer, delete moved into the row menu, and the page size
select is new (server cap 100, URL `per_page`). The "Jumlah: N soalan" line is kept (hidden text,
`questions-total`) and shown as the first KPI.

## 5. Old-system reference

prestasiplus.my returned HTTP 500 / timed out during this session and admin.prestasiplus.cloud
redirects to a login with no credentials on file, so no live screenshots could be taken. The
reference for "better than the old system" is the user's own comparison (small, dense tables
that read at a glance) plus the v2 baseline screenshots in the session scratchpad.

## 6. Density

The global density scale is in `docs/design/v2-design-system.md` section "Density scale (cozy)".
