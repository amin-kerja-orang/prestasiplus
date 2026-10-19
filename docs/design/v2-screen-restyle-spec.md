# PrestasiPlus v2 - Per-Screen Restyle Spec (prototype scope)

| Field | Value |
|---|---|
| Slug | `v2-design-system` (screen restyle part) |
| Version | 1.0 |
| Date | 2026-10-16 |
| Author | ui-ux-designer |
| Scope | The 75 role-access-matrix rows: Murid 37, Guru 15, Admin Sekolah 18, plus section A (5 account rows). Source: `docs/requirements/role-access-matrix.md`, TRACKER D43. |
| Design sources | `docs/design/v2-design-system.md` v2.0 (tokens, overrides, learner patterns, guard rules G-1..G-13), `docs/design/v2-shells.md` v2.0, `docs/design/v2-learner-prototype.html`, `docs/design/v2-theme-preview.html` (B+) |
| Language | Doc in English. All UI copy stays the existing BM, verbatim. No new copy is introduced by this spec. |

## 0. How this document was built, and what to verify first

This was a docs-only task and no shell was available, so `git show origin/feature/v2-frontend:src/app/prototype-scope.ts` and `git show origin/v2/t05-ds:src/ds/index.ts` could **not** be run. What was used instead:

- Row-to-route mapping: `docs/ROLES-MATRIX-LINES.md` (L-rows) plus the module `routes.ts` and `routes/*.ts` fragments in the working tree (branch `v2/fast-boot`). Route paths and page file names below are read from those files.
- Composite list: the `src/ds` list given in the task brief, plus design-system §12.3.

Before a batch starts, the lead or the developer must check two things and report any difference (a diff would only change a route path or the "exists / missing" status of a composite, not the design):

| # | Check | Where |
|---|---|---|
| V-1 | Route paths in this doc equal the in-scope list in `src/app/prototype-scope.ts` (v2 branch). A route in this doc but not in scope: still restyle if cheap, else skip. A scope route missing here: apply the closest archetype in §1.9. | `git show origin/feature/v2-frontend:src/app/prototype-scope.ts` |
| V-2 | The composites marked "exists" in §4 are exported from `src/ds/index.ts` with the props assumed. | `git show origin/v2/t05-ds:src/ds/index.ts` |

Role-restriction facts found in code that affect the mapping (flagged per screen):

- `/headcount/**` has `roles: ['admin','teacher','school_admin']`: Murid has the menu item in the matrix (row 3) but the route would 403. The Murid screen is therefore the `DsErrorPage` 403 unless prototype-scope maps something else.
- `/analisa-item/kelas*` is `['admin','teacher']`; `/analisa-item` redirects by role (`analisaItemTarget`).
- `/laporan-mingguan` is `roles: []` with `onForbidden: '403'`: it is a 403 page for every role by design (live behaviour, OQ-M08-01). Guru row 43 = `DsErrorPage` only.
- `/prestasi/sekolah|tingkatan|kelas` and `/analitik/pelajar` and `/ranking`, `/leaderboard`, `/timeline`: open to any logged-in role.

Hard dependencies for all screens: the v2 shells (DS-T4: `DsShellPembelajaran` / `DsShellPentadbiran`) and the token layer (DS-T1) must be merged. A page migrated before its shell still renders correctly (tokens only) inside the legacy shell, so migration is never blocked on the shell, but QA of the 375/768/1280 chrome needs it.

---

## 1. Shared rules (apply to every screen)

### 1.1 Personality and file reuse

- Pages never branch on role for styling. The shell sets `data-personality` (`learner` for Murid, `staff` for Guru and Admin Sekolah) and `data-density`; the same page file therefore renders in the learner look for Murid and the calm B+ look for Guru/Admin Sekolah. Where a row is shared by several roles (rows 2-7, 8, 9, 10, 11), it is specified **once** in the first role section that lists it and the later roles list only a "role delta".
- Learner (Murid): dark by default, Elektrik accents, Phosphor Duotone, solid-chip icons, character-card colours on highlight cards only, 52-56px controls, bottom tab bar chrome, friend and 3D art where justified.
- Staff (Guru, Admin Sekolah): system colour mode, kobalt only, Phosphor Regular, 12% kobalt tint on nav/stat/subject icon chips, 36px controls (44 coarse), tables and charts, no 3D art, no friend.

### 1.2 Page skeleton

```
shell main (provides gutters 16 / 24 / 32 at 375 / 768 / 1280)
└─ page root: flex-col, gap-4 (375) / gap-6 (>= md)
   ├─ [title block]   only if the shell does not already print the route-meta header title
   │                  h1 text-title (learner 28->36px, staff 24->28px) + subtitle text-body text-muted max-w-prose
   ├─ [hero or summary row]  learner: DsHeroCard / DsStatTile row;  staff: DsStatTile row (4 across at 1280)
   ├─ [filter bar]    section 1.3
   ├─ [primary content]  cards / DsDataTable / DsDrillTable / DsChart
   └─ [secondary content]  helper cards, guidance, footnotes (text-caption text-muted)
```

- Exactly one `h1` per page. Section headings `h2` use `text-heading`, card titles `text-subheading`; stock `text-xs...9xl` is banned in pages (G-3).
- Max content width: learner 72rem (quiz column 40rem), staff 100rem. Content that is narrow by nature (forms, detail text) uses `max-w-prose` or a 2-column grid `lg:grid-cols-[...]` expressed with `grid-cols-12 col-span-*`.
- Spacing steps only 1, 2, 3, 4, 6, 8, 12, 16 (G-2). Card inner padding: learner `p-4`, staff `p-4 sm:p-6` (set by `UCard` override, do not repeat in pages).
- Layers, not lines: page = `bg-muted`, raised card = `UCard`, elevated = chips and inputs. No `border-*`, `divide-*`, `ring-*`, `shadow-*`, `rounded-*` in pages (G-1, G-3, G-3b).

### 1.3 Filter bar (`DsFilterBar`)

| Element | Staff | Learner |
|---|---|---|
| Container | One raised `UCard` row, `flex flex-wrap gap-3 items-end` | No card; controls sit directly on the page, `gap-2` |
| Select / text | `UFormField` (visible label) + `USelectMenu` / `UInput`, 40px (44 coarse), `min-w-0`, `w-full sm:w-48` | `USelectMenu` / `UInput` 52px, full width |
| Pills (period, level, mode) | `UTabs` segmented (`bg-elevated` track, `bg-seg-active` chip), `w-fit max-w-full`, scrolls inside itself if wider than the viewport | `UTabs` segmented with filled gradient active trigger |
| Actions | `UButton` solid "Cari"/"Tapis" (label as today) + ghost "Set Semula" | Same but 52px |
| < md (375) | Search field stays inline; all other fields collapse into one tonal `UButton` "Penapis" (icon `funnel`) with a count `UChip` of active filters, opening a `UDrawer` bottom sheet (max 90dvh) that holds the fields and a full-width primary "Guna" and ghost "Set Semula". Copy of the buttons: keep what the page uses today. | Chips row scrolls horizontally inside its own container (`overflow-x-auto`), no sheet unless there are > 3 selects |
| State | Filter values live in query params exactly as today; no change to behaviour or `data-testid`. | |

### 1.4 Tables and lists

| Case | Spec |
|---|---|
| Staff flat table | `DsDataTable` (`UCard` + `UTable` + `UPagination`): zebra rows (`bg-soft`), hover `bg-elevated`, no row/column lines, header `text-overline text-muted`, numbers right-aligned `tabular`, row min 44px (48 coarse), status = `UBadge` icon + word. Inside the card the table scrolls horizontally only when it has more than 6 columns at 768; first column sticky. |
| Staff drill table (hierarchy: Sekolah > Guru > Kelas > Murid) | `DsDrillTable`: breadcrumb row above (last two crumbs + overflow menu < md), row click/Enter drills in place via query params, trailing `caret-right` affordance, back works. |
| Staff table < md (375) | `DsDataTable` renders a card list: row title (`text-label`), 2-3 key values as label/value pairs, status badge, chevron or `UDropdownMenu` (44px) for row actions; header sort becomes a "Isih" `USelect` above the list. Never a horizontally scrolling page. |
| Pagination | `UPagination`, BM "Menunjukkan {dari}-{hingga} daripada {jumlah} hasil", "Sebelum", "Seterusnya" (replaces `LaravelPager`; same page param). |
| Learner lists | No data tables. Use card lists: `UCard` rows (min 64px) with leading `DsIconChip` or `DsArt3D`, title, one muted line, trailing number/chip, `caret-right`. Ranked lists use the leader row pattern (§4, `DsLeaderRow`). |
| Row actions that were native `confirm()` | `useConfirm()` with the same BM text. |

### 1.5 Charts (`DsChart`)

- One wrapper (Chart.js reading tokens at mount and on colour-mode change). No colour in pages.
- Series colours: staff `--ds-cat-1..8` in slot order (data stores slot numbers) and kobalt for a single series; learner series `A1, A4, A2, A3` in that order, semantic green/red only for correct/wrong.
- No grid lines (layers-not-lines). Value labels on bars and end-of-line values, y-axis tick labels in `--ui-text-dimmed` at 12px minimum, rounded bars (radius 4 inside the dataset config), tooltips on hover and keyboard focus.
- Every chart has: a visible title (`h2`/`h3`), a legend that uses shape or label as well as colour (WCAG 1.4.1), and a visually hidden data table alternative (the table already exists on most pages: keep it, collapsed by `UCollapsible` "Lihat jadual" where the page has none; copy PROPOSED only if absent today).
- Heights: 375 -> 220px, 768 -> 280px, 1280 -> 320px; width 100% of its card; legends wrap below the canvas.
- Heat/colour-scale grids (DSKP, topic weakness) use `DsHeatGrid` (§4), not Chart.js.

### 1.6 States (every data screen)

| State | Spec |
|---|---|
| Loading | `USkeleton` blocks shaped like the final layout (stat tiles, card list rows, table rows). `LoadingSpinner` is removed; a spinner glyph (`circle-notch`) only inside a `UButton loading`. Skeleton pulse is off under reduced motion. |
| Error (request failed) | `UAlert` subtle `color="error"` + icon `warning-circle` + the page's existing error text + `UButton` tonal "Cuba Lagi" (retry reloads the same query). Replaces `AlertBox`. Focus is not stolen except on form submit errors (summary alert gets focus, `role="alert"`). |
| Empty | `UEmpty` with the existing empty text as the title. Learner: `DsEmptyState` (friend with mood `encouraging`, size 96, in place of an illustration) + one primary action when the page has one today. Staff: spot illustration `kosong` (120px at 375, 160px above) and the primary action if permitted. Filtered-empty uses illustration `tiada-hasil` and a ghost "Set Semula Penapis" action (label as today if present). |
| Forbidden / not found | `DsErrorPage` (403 / 404) per `v2-shells.md` §7, rendered by the router, not by pages. |
| Success after a write | `useToast()` (4000 ms), same BM text as the current flash message; flash banners that persist across navigation stay `UAlert` via the shell flash outlet. |
| Offline / retry | Shell-level alert; pages do nothing extra. |

### 1.7 Forms

- `UForm` + `UFormField` (visible persistent label, hint, error with leading icon) + `UInput`/`UTextarea`/`USelectMenu`/`URadioGroup`/`UCheckbox`/`USwitch`/`UInputDate`/`UFileUpload`. Fills are borderless `bg-elevated` (accepted risk R-1); 16px text.
- Layout: single column on 375 and 768; at >= lg staff forms use `grid grid-cols-12 gap-4`, labels above fields (no left-label layout), field groups in `UCard` sections with an `h2`. Action row: primary left-to-right order as today, sticky bottom bar (`bg-default shadow-bar-up`) < md for long forms with the primary 52px (learner) / 44px (staff).
- Submit state: `UButton loading`, fields disabled, label as today ("Sedang ..." copy stays).
- Read-only/locked values (e.g. locked school) = filled field with `text-muted`, lock icon `lock-simple`, no input affordance.

### 1.8 Copy, ids, behaviour

- BM copy is **unchanged**, including emoji in headings. English is not added. No new strings; strings listed "PROPOSED" in other design docs are not used here.
- **`data-testid`, `id`, `name`, `aria-*`, route names, query-param names and `for` links are preserved 1:1** so unit and e2e tests keep passing. Moving a testid to the new component's root or inner `<button>` is allowed only if the old element no longer exists; pass it through the component's `data-testid` attr (Nuxt UI forwards attrs).
- No behaviour change: same API calls, stores, guards and timers. Visual layer only (decision D9/D10: replicate; accessibility replicates live).
- Native `confirm/alert/prompt` -> `useConfirm()`; `FORM_*_CLASS`, `feedback/classes.ts` and `@/components/*` imports disappear from migrated files (G-6).

### 1.9 Archetypes (referred to by every screen)

| Code | Archetype | Skeleton |
|---|---|---|
| AR-HUB | Hub / chooser | Optional `DsHeroCard` -> `DsSubjectStrip` or a grid of choice cards (`UCard` + `DsIconChip` + title + muted line + `caret-right`) |
| AR-CFG | Quiz configuration | `UCard` form: `UFormField` rows, `URadioGroup variant="card"` for modes/difficulty, count stepper `UInputNumber`, sticky full-width primary "Mula" (label as today) |
| AR-QUIZ | Full-screen quiz | Shell chrome hidden; `DsQuizHeader` (close, 10px progress, combo chip, subject chip, counter, timer if the mode has one) -> question `text-heading` -> `DsQuizOption` list (60px) -> check button -> `DsFeedbackSheet` -> repeat -> `DsWinScreen`. Specified in `v2-shells.md` §5.2/5.3; **do not redesign per screen**. |
| AR-LIST | Card list + filters | Filter bar -> list (1 col 375, 2 col 768, 3 col 1280 for cards; rows for lists) -> pager |
| AR-DETAIL | Detail | Back link (`ghost` button, icon `arrow-left`) -> hero card or title -> content `UCard`s -> actions row |
| AR-DASH | Stats + charts | Row of `DsStatTile` (2 across 375, 3 at 768, 4 at 1280) -> chart cards (1 col, 2 col at xl) -> table/list |
| AR-RANK | Ranking | Podium (top 3, 3D medals, learner only) -> `DsLeaderRow` list with own row highlighted (A1 12% mix + "Anda"-style label as today) |
| AR-SHOP | Catalogue | Balance `DsRewardChip` row -> filter pills -> card grid (`DsShopCard` or `UCard` + `DsArt3D`) -> confirm dialog on redeem |
| AR-FORM | Form page | §1.7 |
| AR-TABLE | Staff table page | Filter bar -> `DsDataTable` |
| AR-REPORT | Staff report | Period pills -> `DsStatTile` row -> `DsChart` cards -> `DsDataTable`; export button top-right of the title block |
| AR-DRILL | Staff drill-down | Breadcrumb -> `DsLiveTiles`/`DsStatTile` -> `DsDrillTable` |

### 1.10 Meaning-colour policy for learner pages (outside Home)

| Job | Colour | Use |
|---|---|---|
| Action | A1 (gradient on primary buttons, hero, active pill, progress; flat `primary-t` text links) | Every CTA, tabs, progress bars, focus ring |
| Win | A2 lime (`win-ring` on light surfaces) | Only win moments: result rings >= 3/5, new-record/new-badge stickers, "+n" floats, achievement unlock, `NEW`/`BARU` badges, Mod Pelajar. Never a page background. |
| Reward / heat | A3 orange | Streak flame, Koin/Mata chips, combo heat, warnings, "perlu perhatian" character cards |
| Friend / AI | A4 violet | Cikgu Alesa "AI" pill, AI explanations, info cards, friend halo |
| Correct / wrong | Semantic green / red | Answer states, status chips with icon + word; never decorative |
| Trial | Amber | Only the "Percubaan Percuma" character card (Home); no other page uses amber |

Character cards (`DsCharacterCard`, tinted by meaning) are used on pages **only** when a page already shows a highlighted notice/promo box today (e.g. trial, warning, info, achievement, call to action); the card colour then follows the table above. Ordinary list items are plain raised `UCard`s.

### 1.11 Icons and 3D art policy

- Icons by base name through `DsIcon` (Phosphor, personality picks Duotone/Regular). Names below are recommendations; DS-T0 verifies each against `@iconify-json/ph`. The FA-to-Phosphor meaning table remains authoritative where an FA name exists on the page today.
- Learner chips: `DsIconChip` solid A1 (white glyph) by default; A3 for reward/streak/heat, A2 for win/achievement, A4 for AI/friend/info. Never tone-on-tone.
- Staff chips: 32px kobalt 12% tint with kobalt glyph. Staff screens: **no 3D art**.
- 3D (`DsArt3D`, Fluent set, "Ganjaran 3D" on by default, off = Duotone glyph on solid chip): used only (a) where the item **is** a reward or achievement (coin, bolt, fire, trophy, medal, gift, crown), (b) on hero cards and win/empty-win moments, (c) game hub tiles. Decorative: `alt=""`. Max one 3D image per card, 40-64px in lists, 76-120px on heroes. Extra file names beyond the prototype set are chosen at DS-T1 (open point O3 in the design system).

### 1.12 Responsive defaults (all screens, 375 / 768 / 1280)

| Pattern | 375 | 768 | 1280 |
|---|---|---|---|
| Gutter | 16 | 24 | 32 |
| `DsStatTile` row | 2 across (3rd wraps; learner Home keeps 3 across) | 3 across | 4 across |
| Card grid | 1 col | 2 col | 3 col (learner max 72rem; staff 4 at xl when cards <= 280px) |
| Split layouts (list + side panel) | stacked, side panel after content | stacked until `lg` | `lg:grid-cols-12` 8/4 |
| Tables | card list | table in card, inner scroll if > 6 cols | full table |
| Modals | `UDrawer` bottom sheet (radius 28 top, max 90dvh) | centered `UModal` 480-640px | same |
| Sticky action bar | yes for long forms | no | no |
| Horizontal strips (subjects, chips) | `overflow-x-auto snap-x` inside own container | same | wraps if it fits |
| Floating Cikgu Alesa button (Murid) | reserve bottom padding for tab bar + button (page `pb-16` rhythm via shell) | same | no tab bar; button stays bottom-right |

No page may produce horizontal page scroll at 320 or wider; wide content scrolls inside its own container.

### 1.13 Definition of done (per screen)

1. No imports from `@/components/*`, `@/shells/*` internals, `@lucide/vue`; no `<style>`, `style=`, hex, `border*`, `shadow-*`, `rounded-*`, arbitrary values (G-1..G-7 lint passes).
2. All states of §1.6 present; copy and testids unchanged (diff review).
3. Light and dark checked for both personalities that can reach the screen.
4. Playwright 375 / 768 / 1280 with `scrollWidth <= clientWidth` and axe 0 serious/critical.
5. Targets >= 44px on `pointer-coarse`; focus order follows DOM; one `h1`.
6. Size estimates: S <= 0.5 day, M about 1 day, L 2+ days for one developer.

---

## 2. Screens

Format per screen: route and files -> personality -> size and dependencies -> mapping table -> colour/icons/art -> responsive -> special.
"Dep" lists only what is not already guaranteed by §1 (composites marked **NEW** are specified in §4).

### Section A. Account basics (all roles)

#### A1 Profil Saya (L01)
- Routes: `/profile` (`ProfilePage.vue`), `/profile/edit` (`ProfileEditPage.vue`). Module M01. Files owned by batch B09.
- Personality: follows role (learner for Murid, staff for others). Size: M. Dep: `DsDialog`, `UFileUpload`.

| Current | v2 |
|---|---|
| Profile header (avatar, name, role, school) | `UCard`; learner: `DsFriendAvatar` is **not** used (it is the learner's friend); user photo/initials in `UAvatar` size 3xl (96px), name `text-heading`, role + school as `UBadge subtle`. Staff: `UAvatar rounded-lg`, same text. |
| Info rows (label/value pairs) | `UCard` with a definition grid: `grid grid-cols-1 sm:grid-cols-2 gap-4`; label `text-caption text-muted`, value `text-body`; no dividers |
| Edit button | `UButton` tonal, icon `pencil-simple` |
| Edit form (`ProfileEditPage`) | AR-FORM; photo upload `UFileUpload` compact; save primary, cancel ghost; sticky bar < md |
| Alerts/flash | `UAlert` / toast per §1.6 |

- Colour: none beyond A1/primary actions. Icons: `user-circle`, `pencil-simple`, `envelope`, `buildings`. 3D: none.
- Responsive: 375 single column, header centred; 768 header left-aligned beside avatar, info grid 2 cols; 1280 two cards side by side (header card 4 cols, info card 8 cols).

#### A2 Tetapan Peribadi (L02)
- Route `/tetapan` (`TetapanPage.vue`), M01. Personality: role. Size: M. Dep: none.

| Current | v2 |
|---|---|
| Setting groups (notifications, privacy, password etc. as on page) | One `UCard` per group with `h2`; rows = label + hint (left) and `USwitch` / `USelect` (right) at >= sm, stacked < sm; row min 56px; no dividers (gap-4) |
| Password change form | AR-FORM block inside its card, show/hide toggle `aria-pressed` |
| Colour-mode / 3D reward preference (if present on page) | `UTabs` segmented "Cerah / Gelap / Ikut Sistem" labels exactly as in the shell account menu; 3D toggle `USwitch` |
| Save | primary button end of card; success toast |

- Icons: `gear`, `lock-key`, `bell`, `moon`. 3D: none. Responsive: single column up to lg, 2 columns at xl only for group cards.

#### A3 Panduan (L03)
- Routes `/panduan`, `/pusat-tuisyen/panduan` (`PanduanPage.vue`), M09. Personality: role. Size: S. Dep: none.

| Current | v2 |
|---|---|
| Guide sections | `UAccordion` (one `UCard` per item, chevron `caret-down`, header `text-subheading`), first item open as today; guide screenshots use `DsArt3D variant="plain"` (G-5: no raw `<img>`), with the existing `alt` text, several images in a `UCarousel` |
| Search (if present) | `UInput` with `magnifying-glass` leading |

- Icons: `question`, `book-open`. Responsive: single column max-w-prose centred at 768+.
- Note: if the page shows raster screenshots, wrap them with the DS image slot added in `DsArt3D`'s non-3D mode (§4 `DsArt3D` `variant="plain"`).

#### A4 Tiket Bantuan (L04)
- Route `/pusat-tuisyen/tiket` (`TicketsPage.vue`), M22. Personality: role. Size: M. Dep: `DsDialog`.

| Current | v2 |
|---|---|
| Ticket list | Learner: card list (title, status chip icon + word, date, caret). Staff: `DsDataTable` (card list < md). |
| Status | `UBadge`: baru = `info`, dalam proses = `warning`, selesai = `success`, each icon + word (labels as today) |
| "Tiket Baharu" button | primary `UButton` icon `plus`, opens `DsDialog` (bottom sheet < sm) with AR-FORM fields (Kategori `USelect`, Subjek `UInput`, Mesej `UTextarea`, Lampiran `UFileUpload`) |
| Ticket detail/thread (if shown) | chat-like `UCard` bubbles: user bubble `bg-elevated`, staff reply `bg-default`; timestamps `text-caption text-muted` |

- Icons: `lifebuoy`, `chat-circle-text`, `paperclip`. Learner may show the friend (mood `encouraging`) in the empty state. Responsive: dialog = sheet at 375, 560px modal at >= md.

#### A5 Log Keluar (L05)
- Not a page: an account-menu action in the shell (`DsShellPembelajaran` / `DsShellPentadbiran`). Colour `error` text with icon `sign-out`; confirm only if it is confirmed today (then `useConfirm()` with the same text). Size: S, part of the shell task. Dep: shell.

---

### Murid (learner personality, dark default) - matrix order

Legend: M-nn = matrix row number. Rows 2 (Dashboard) and 13 (SPM) are separate tasks.

#### M-2 Dashboard (Murid Home) - IN PROGRESS, SEPARATE TASK
- Route `/dashboard` (`m05-practice/pages/DashboardPage.vue` and `components/dashboard/*`). Being built separately as "Murid Home" per `v2-shells.md` §5.1 (friend greeting, 3 stat tiles, hero, subject strip, character cards). **Not part of any batch below.** Related M05 pages that hang off Home and are decided by that task, not here: `/misi-harian` (`MissionListPage`), `/misi-harian/:id` (`MissionQuizPage`), `/target-spm` (`SpmTargetsPage`). When Home lands, those use AR-LIST and AR-QUIZ with the same rules.

#### M-13 SPM - IN PROGRESS, SEPARATE TASK ("Bijak SPM")
- Routes `/spm`, `/spm/tahun-lepas`, `/spm/latih-tubi*`, `/spm/ramalan*`, `/spm/subjektif`, `/spm/history`, `/spm-mock*`, `/pusat-ai/spm` (M06). Being rebuilt as Bijak SPM (D44). **Not part of any batch below.** It must consume the shared quiz kit (§4, from batch B01) for its runners.

#### M-3 Headcount (row 3; Murid, Guru, Admin Sekolah)
- Routes: `/headcount` (`HeadcountListPage`), `/headcount/dashboard` (`HeadcountDashboardPage`), `/headcount/create` (`HeadcountCreatePage`), `/headcount/student/:id` (`HeadcountStudentPage`), `/headcount/:id` (`HeadcountTablePage`), `/headcount/:id/summary` (`HeadcountSummaryPage`), `/headcount/:id/export` (`HeadcountExportPage`), `/headcount/:id/results/:n|edit|unjuran|settings` (all `HeadcountShellPage`). Module M08, batch B14.
- Murid variant: route is role-gated (see §0): render `DsErrorPage` 403 (learner variant: friend `encouraging`, copy exactly as the router's 403 today). No other Murid work. The full spec for the staff variant is under **G-3** below.

#### M-4 Prestasi (row 4)
- Routes: `/prestasi` (redirect), `/prestasi/sekolah` (`PrestasiSekolahPage`), `/prestasi/tingkatan` (`TingkatanPilihPage`), `/prestasi/tingkatan/:code` (`TingkatanPage`), `/prestasi/kelas` (`PrestasiKelasPilihPage`), `/prestasi/:userId` (`Prestasi360Page`), `/prestasi/kelas/:id` (`PrestasiKelasDetailPage`, Guru/AS). Module M08, batch B08a. One set of files serves Murid, Guru and Admin Sekolah.
- Personality: Murid learner; Guru/AS staff (same file). Size: L (7 pages). Dep: `DsChart`, `DsDrillTable`, `DsHeatGrid` (NEW) only if the page has colour-scale cells.

| Current | v2 |
|---|---|
| Page header "Dashboard Sekolah" + subtitle (route meta) | Shell prints h1 (keep the existing header strings) |
| Summary cards (counts, averages) | `DsStatTile` row (4 across at 1280); learner chips: A1 for scores, A3 for streak/Mata where present; staff kobalt chips |
| Trend / subject / difficulty charts | `DsChart` cards, two per row at xl |
| Choice pages (`TingkatanPilih`, `PrestasiKelasPilih`) | AR-HUB: one `UCard` per Tingkatan/Kelas, `DsIconChip` (`graduation-cap` / `chalkboard`), name, muted line with counts, `caret-right`; grid 1/2/3 cols |
| Class / level detail tables | Staff: `DsDataTable`; Learner (Murid sees own school/level views): `DsLeaderRow` list for ranked data, no wide tables |
| Prestasi 360 (per pupil) | Header card (avatar, name, class); below `DsStatTile` row; `DsChart` radar/line; weak-topic list as card rows with A3 "perlu perhatian" chip; staff gets the same layout |

- Meaning colours (learner): A1 for primary data, A3 for weak topics, semantic green/red for improvement/decline arrows (icon `trend-up`/`trend-down` + text). 3D: none (data page).
- Icons: `chart-line-up`, `graduation-cap`, `chalkboard`, `users-three`, `trend-up`, `trend-down`.
- Responsive: charts stack to 1 column below `xl`; choice grid 1/2/3.
- Special: S1 title strings exact (tab title logic unchanged); drilling keeps query params.

#### M-5 Analitik Adaptif (row 5)
- Routes `/analitik/pelajar` (`AnalitikPelajarPage`), `/analitik/kelas` (`AnalitikKelasPage`, Guru/AS roles `['admin','teacher']`). M08, batch B08a. Personality: role. Size: M. Dep: `DsChart`.

| Current | v2 |
|---|---|
| Intro "Pantau prestasi dan kenal pasti topik ..." | Subtitle in the shell header |
| Subject selector / pupil picker | `DsFilterBar` (learner: `UTabs` segmented for subject; staff: `USelectMenu`) |
| Mastery bars / topic levels | `UProgress` (learner gradient-h; staff primary) **with number in `status` slot**; level label chips |
| Weak-topic list | Card rows with `DsIconChip` A3 (learner) and "Latih" ghost button; staff table |
| Charts | `DsChart` |

- Icons: `brain`, `target`, `chart-bar`. Responsive per §1.12. Special: adaptive recommendation card at top uses `DsCharacterCard` variant action (A1) **only if** the page already shows a recommendation box.

#### M-6 Analisa Item (row 6)
- Routes `/analisa-item` (redirect by role), `/analisa-item/sekolah` and `/analisa-item/sekolah/:id` (`AnalisaItemSekolahPage`), `/analisa-item/kelas` (`AnalisaItemKelasPilihPage`), `/analisa-item/kelas/:id` (`AnalisaItemKelasPage`). M08, batch B08a. Size: L (item-analysis tables). Dep: `DsDataTable`, `DsChart`.

| Current | v2 |
|---|---|
| Exam / paper selector | `DsFilterBar` |
| Item table (item no., % correct, difficulty, discrimination, distractor columns) | Staff: `DsDataTable` with difficulty as `UBadge` icon + word; > 6 columns -> inner horizontal scroll at 768, card list at 375. Murid (school view): same table, learner density, rows 48px, no sticky actions |
| Per-item detail / distractor chart | `DsChart` stacked bars; option letters in letter chips |
| Choice pages | AR-HUB cards |

- Colours: difficulty badges use semantic success/warning/error with icon + word; no other colour. Icons: `list-numbers`, `chart-bar`, `target`. 3D none.

#### M-7 Video (row 7)
- Routes `/video` (`VideoListPage`), `/video/:id` (`VideoDetailPage`), `/video/tambah` and `/video/:id/edit` (`VideoFormPage`, staff/admin only if gated; Guru/AS reach them only if the role allows today). M09, batch B04. Size: M. Dep: `DsMediaCard` (NEW), `DsVideoPlayer` slot (use native video inside a `UCard`; G-5 allows `video`? it forbids listed raw elements only: `video`/`iframe` are not on the list).

| Current | v2 |
|---|---|
| Filters (subject, form, topic, search) | `DsFilterBar`; learner: subject `UTabs` segmented / chips strip |
| Video grid | `DsMediaCard` (thumbnail 16:9, duration chip `bg-inverted` bottom-right, title 2 lines, subject chip, progress `UProgress` if watched); grid 1/2/3-4 |
| Detail | Player card full width (`aspect-video`), title `text-heading`, meta chips, description `text-body max-w-prose`, "related" strip of `DsMediaCard`s; learner "tandakan ditonton" button primary if present |
| Form (tambah/edit) | AR-FORM, URL field + preview card |
| Pager | `UPagination` |

- Icons: `play-circle`, `video`, `clock`, `check-circle` (watched). Colour: watched state = green chip icon + word; no tint cards. 3D none.
- Responsive: player is edge-to-edge at 375 (negative margins are not allowed: keep gutters, 16px radius via card), related strip scrolls inside itself.

#### M-8 Kelas Saya (row 8; Murid, Guru)
- Murid: `/kelas-saya` (`KelasSayaPelajarPage`) with `JoinClassForm`, `JoinedClassCard`. M10, batch B03. Guru: `/guru/kelas` (`KelasListPage`, `ClassCard`, `QrModal`), `/guru/kelas/cipta` (`KelasCreatePage`) -> see **G-8**. Size (Murid): S. Dep: none.

| Current (Murid) | v2 |
|---|---|
| Join-by-code form | `UCard` with `UFormField` "Kod kelas" (labels as today), `UInput` 52px, primary button; hint text-muted; error inline |
| Joined classes | Card list: `JoinedClassCard` -> `UCard` with `DsIconChip` (`chalkboard`, A1), class name `text-subheading`, teacher + school muted, subject `UBadge subtle` |
| Empty | `DsEmptyState` (friend `encouraging`) + the join form stays visible |

- Colour: A1 only. Responsive: join form above list at 375; side-by-side 4/8 at xl.

#### M-9 Soalan by Chapter (row 9; Murid, Guru)
- Routes `/practice/chapter` (`ChapterIndexPage`), `/practice/chapter/:code` (`ChapterSubjectPage` with `ChapterCardItem`), `/practice/chapter/:code/:chapterId/quiz` (`ChapterQuizPage`). Sibling routes of the same group: `/practice/revision` (`RevisionListPage`), `/practice/revision/:code` (`RevisionQuizPage`). M05, batch B01. Size: M (hub) + quiz via kit. Dep: quiz kit.

| Current | v2 |
|---|---|
| Subject list (`ChapterIndexPage`) | AR-HUB: `DsSubjectStrip` on top (subject chips) + grid of subject cards (`DsIconChip` A1 with subject glyph via existing `SubjectIcon` key map -> `DsIcon`), question count, progress `UProgress` |
| Chapter cards (`ChapterCardItem`) | `UCard`: chapter number chip (A1 solid), title, question count, mastery `UProgress` (number visible), `caret-right`; whole card is the link |
| Quiz | AR-QUIZ via `QuizRunner`/`QuizResults` (kit) |
| Revision list/quiz | Same patterns |

- Colour: A1; mastery complete (100%) shows a green check chip. Icons: subject keys per design-system §10.1 (`calculator`, `book-open-text`, `translate`, `scroll`, `flask`), `bookmarks`. 3D: win screen only.
- Guru variant: same pages (Guru can open the chapter list for review); staff density.

#### M-12 Remedial (row 12)
- Routes `/remedial/saya` (`RemedialListPage`, `RemedialPreview`), `/remedial/:id` (`RemedialQuizPage`). M05, batch B01. Size: M. Dep: quiz kit.

| Current | v2 |
|---|---|
| Remedial items list | Card list; each `UCard` with `DsIconChip` A3 (heat/perlu perhatian, `lifebuoy`), topic title, weak-score `UProgress` with number, "Mula" primary button |
| `RemedialPreview` | `DsCharacterCard` **variant warning (orange)** only if the preview is a highlighted "why this remedial" box; otherwise plain `UCard` |
| Quiz | AR-QUIZ |
| Empty ("tiada remedial") | `DsEmptyState`, friend `happy` (good news), copy as today |

#### M-14 Heatmap Topik Lemah (row 14)
- Route `/buku-nota/heatmap` (`HeatmapTopikLemahPage`). M25, batch B02. Size: M. Dep: `DsHeatGrid` (NEW).

| Current | v2 |
|---|---|
| Subject/level filters | learner `DsFilterBar` chips |
| Heatmap grid (topics x strength) | `DsHeatGrid`: cells use 5 steps of a **single hue ramp** from `--ui-bg-elevated` (strong/empty) up to A3 orange (weak) - never green-red only; each cell shows its % number (not colour-only) and has a tooltip/popover with topic name |
| Legend | Row of 5 swatches with labels as today |
| Weak topic callouts | `DsCharacterCard` warning (A3) if page shows a callout; "Latih" button A1 |

- Icons: `fire`, `target`, `warning`. Responsive: grid scrolls inside its card at 375 with sticky first column; topic list alternative (card list sorted by weakness) is the default view < md.

#### M-15 Mohon Keluarga Angkat (row 15)
- Route `/mohon-keluarga-angkat` (`MohonKeluargaAngkatPage`). M21, batch B02. Size: M. Dep: none.

| Current | v2 |
|---|---|
| Explanation text / eligibility | `DsCharacterCard` **variant info (violet)** if it is a highlighted info box today; else `UCard` with `text-body max-w-prose` |
| Application form | AR-FORM in a `UCard`; consent `UCheckbox`; primary submit |
| Application status (submitted/approved/rejected) | `UAlert` subtle with icon + word + date; or status `UBadge` |

- Icons: `hand-heart`, `heart`, `paper-plane-tilt`. Colour: A4 info only for the info box. 3D: none (sensitive topic; keep calm). Responsive: single column max-w-prose.

#### M-16 Latih Tubi (row 16)
- Routes `/practice` (`PracticeListPage`), `/practice/:code` (`PracticeConfigPage`), `/practice/:code/quiz` (`PracticeQuizPage`). M05, batch B01. Size: L (includes the **quiz kit**, used by every runner). Dep: `DsQuizHeader`, `DsQuizOption`, `DsFeedbackSheet`, `DsWinScreen` (exist), `DsFloatScore`.

| Current | v2 |
|---|---|
| Subject list | AR-HUB: grid of subject cards (A1 chip + subject glyph, question count) |
| Config (mode, difficulty, number of questions) | AR-CFG: `URadioGroup variant="card"` for difficulty/mode; `UInputNumber` count; selected card = A1 18% mix + check; primary "Mula" 56px full width |
| `QuizRunner` | `DsQuizHeader` + `DsQuizOption` + check button + `DsFeedbackSheet` + friend lines (`v2-design-system.md` §6/§10.3). `CoinFly` -> `DsFloatScore` ("+n" float, A2). |
| `QuizResults` | `DsWinScreen` (3D hero by score, ring 168px, friend dialog, +Mata/+Koin tiles, stickers, "Kongsi", "Kembali ke Home" -> label as today where it differs) |

- Special: full-screen, chrome hidden (`100dvh`); keyboard 1-4/A-D, Enter, Esc; timer only if the mode has one; reduced-motion rules in `v2-shells.md` §5.2/5.3. **No celebration on wrong answers.**
- Owning files for the kit: `m05-practice/components/quiz/QuizRunner.vue`, `QuizResults.vue`, `CoinFly.vue`, `SubjectIcon.vue`. All other M05 quiz pages must render through `QuizRunner`/`QuizResults`; no page re-implements options.

#### M-17 Soalan Berstruktur (row 17)
- Routes `/latihan-berstruktur` (`StructuredListPage`), `/latihan-berstruktur/:id/jawab` (`StructuredAnswerPage`). M05 (data M04), batch B01. Size: M. Dep: none new.

| Current | v2 |
|---|---|
| List | AR-LIST rows: `UCard` with `DsIconChip` A1 (`list-checks`), title, marks chip, status chip (belum dijawab / dihantar, icon + word) |
| Answer page | Question card (`text-body` 17px, context text in `UCard` `bg-elevated`), sub-questions each in a `UCard`; answer `UTextarea` (min 6 rows), marks hint `text-caption text-muted`; sticky bar: "Hantar" primary. After submit: model answer in a `UAccordion`, AI-marked feedback bubble with "AI" pill (A4) only if AI feedback exists today |

- Responsive: single column; sticky submit bar < md. Not a quiz-runner (no per-option UI): do not force `DsQuizOption`.

#### M-18 Kedudukan (row 18)
- Route `/ranking` (`RankingPage`). M08, batch B08b. Size: M. Dep: `DsLeaderRow` (NEW).

| Current | v2 |
|---|---|
| Scope/tab selector (national, state, school ...) | `UTabs` segmented (learner filled active) |
| Ranking list | AR-RANK: top 3 podium with 3D medals (`1st/2nd/3rd place medal`), then `DsLeaderRow` list; own row pinned/highlighted with A1 12% mix and "Anda"-style label as today |
| Pager | `UPagination` |

- Colour: rank 1-3 chips A2 (lime, win job), others neutral; points in display numerals. Icons: `medal`, `crown`. 3D: medals on podium only. Responsive: podium 3 across at all widths (compact 375: avatar 48, name truncates); list full width.

#### M-19 PKSK (row 19)
- Routes (M07 student): `/pksk` (`PkskHubPage`), `/pksk/level/:L` (`PkskDashboardPage`), `/pksk/level/:L/domains` (`PkskDomainsPage`), `/pksk/level/:L/history` (`PkskHistoryPage`), `/pksk/level/:L/domain/:code` (`PkskPracticePage`), `/pksk/level/:L/exam` (`PkskExamPage`). Batch B03. Size: L. Dep: quiz kit (for practice/exam).

| Current | v2 |
|---|---|
| Hub (levels) | AR-HUB cards per level (`DsIconChip` A1, level name, progress) |
| Level dashboard | AR-DASH: `DsStatTile` row, domain progress `UProgress` list, "Mula Peperiksaan" `DsHeroCard` (A1 gradient) |
| Domains list | Card grid with domain name, mastery number, caret |
| History | Card list: date, score ring small (`DsScoreRing` 48px), mode chip |
| Practice / Exam | AR-QUIZ (exam adds the timer: neutral text, `text-error` + icon in last 10 s) |

- Colour: A1; scores >= pass use A2 ring on result only. Icons: `exam`, `clipboard-text`, `clock-counter-clockwise`, `target`. 3D: win screen only.

#### M-20 Artikel (row 20)
- Routes `/artikel` (`ArtikelListPage`), `/artikel/:slug` (`ArtikelDetailPage`). M09, batch B04. Size: M. Dep: `DsMediaCard`.

| Current | v2 |
|---|---|
| Category/search | `DsFilterBar` (learner chips strip) |
| Article cards | `DsMediaCard` (cover image 16:9, category chip, title 2 lines, date + reading time) - grid 1/2/3 |
| Detail | Title `text-title`, meta chips, cover, body in a `max-w-prose` column using a `DsProse` wrapper (typography token styles for headings, lists, quotes, images; no borders on blockquote - use `bg-elevated` surface) -> **NEW** `DsProse` |
| Related | Strip of `DsMediaCard` |

- Icons: `article`, `newspaper`, `clock`. 3D: none.

#### M-21 Permainan (row 21)
- Routes: hub `/permainan` (`PermainanPage`); solo `/permainan/betul-salah|cabaran-kilat|tembak-jawapan|susun-jawapan|kad-memori|roda-nasib|jutawan|jutawan/main` (`Solo*Page`, `RodaNasibPage`, `JutawanPage`, `JutawanMainPage`); lobbies `/{game}` (`LobbyPage`) and `/{game}/:code` (`RoomPage`) and `/papan-bijak` (`PapanBijakPage`); `/permainan/pertandingan`, `/permainan/uji-minda`, `/permainan/sambung-kata`; battle pages (`BattleLobbyPage`, `BattleArenaPage`, `BattleLeaderboardPage`, `BattleSchoolRankingPage`, `BattleSchoolDetailPage`, `BattleHistoryPage`). M16. Batches B07a (hub + solo + pertandingan/uji-minda/sambung-kata/papan-bijak) and B07b (lobbies, rooms, battle). Size: L each. Dep: `DsGameTile` (NEW), `DsLeaderRow`, `DsWheel` (NEW, roda nasib/cabutan).

| Current | v2 |
|---|---|
| Hub tiles | `DsGameTile` grid (2 across 375, 3 at 768, 4 at 1280): 64px 3D image or glyph on solid chip, game name, "Solo"/"Berpasukan" chip, `LIVE` badge where live today |
| Solo game play screens | Full-screen like the quiz (`DsQuizHeader`-style top bar with close, score, timer; game area `UCard`; controls 56px); outcomes through `DsWinScreen` |
| Lobby / room | `UCard` with room code in display numerals + copy button, player list as avatar chips (`UAvatar`, circle), ready state icon + word, host controls primary |
| Battle arena | Two-sided score header (`DsStatTile`-like), question area as quiz, opponent answer state with icon + word, live updates `aria-live="polite"` off for ticks |
| Leaderboards / history | `DsLeaderRow` lists |

- Colour: A1 actions, A2 only on wins/new records, A3 on combo/timer pressure, semantic green/red on answers, `LIVE` red solid + pulse. 3D: hub tiles and result heroes only. Icons: `game-controller`, `sword`, `timer`, `brain`, `target`, `users-three`. Special: games with motion honour reduced motion (no spin/shake; show result instantly). Responsive: game boards fit `100dvh - header`; no page scroll inside a game at 375.

#### M-22 Cabutan Bertuah (row 22)
- Route `/cabutan` (`CabutanPage`). M15, batch B06. Size: M. Dep: `DsWheel` or draw animation (NEW, shares with Roda Nasib).

| Current | v2 |
|---|---|
| Draw explanation, entries count | `DsCharacterCard` **variant achievement/win (lime)** only for the "prize / you won" box; page intro plain `UCard` |
| Draw button | primary 56px, disabled state when not eligible (reason text-muted below) |
| Result | Win overlay `DsDialog`: 3D `wrapped gift`, prize text, A2 sticker; "Tutup" ghost |
| History/winners list | `DsLeaderRow`-style list |

- Icons: `ticket`, `gift`. 3D gift on result only. Reduced motion: no spin; result shown at once.

#### M-23 Tournament (row 23)
- Routes `/tournament` (`TournamentListPage`), `/tournament/:uuid` (`TournamentDetailPage`). M16, batch B07b. Size: M. Dep: `DsLeaderRow`.

| Current | v2 |
|---|---|
| Tournament cards | `UCard` list: 3D `trophy` 56px, name, dates, status chip (akan datang / sedang berlangsung with `LIVE` red / tamat; icon + word), prize chip, "Sertai" primary |
| Detail | `DsHeroCard` (A1 gradient: name, countdown in display numerals, join CTA), rules `UAccordion`, standings `DsLeaderRow` list, my result `DsStatTile` |

- Colour: A1 hero, A2 only for winner state, red for LIVE. Responsive: hero stacks art below text < md.

#### M-24 Topik (row 24)
- Routes `/topics` (`TopicsPage`), `/topics/:id` (`TopicDetailPage`). M03, batch B02. Size: M. Dep: none new.

| Current | v2 |
|---|---|
| Subject/form filters | `DsFilterBar` (learner `UTabs`/chips) |
| Topic list | Accordion-like grouped cards: chapter `h2` + topic cards (`DsIconChip` A1, title, mastery `UProgress`, count of questions) |
| Topic detail | Header card (title, chapter chip, progress ring `DsScoreRing` 84px), content sections (notes link, video link, practice button) as `UCard`s with `DsIconChip` actions; primary "Latih" |

- Icons: `books`, `bookmark-simple`, `play-circle`, `note-pencil`. 3D none.

#### M-25 Peta Belajar (row 25)
- Route `/peta-belajar` (`LearningMapPage`). M03, batch B02. Size: M. Dep: `DsLevelMap` (NEW) - or `UTimeline` vertical if the page is a sequence.

| Current | v2 |
|---|---|
| Map of nodes (chapters/topics with locked/in-progress/done) | `DsLevelMap`: vertical path of node cards, node chip states: done = solid green + check, current = A1 solid + pulse-less glow `shadow-hero`, locked = elevated + `lock-simple` + word "Dikunci" (label as today); connectors are spacing only (no lines): use the node column rhythm and a `bg-elevated` rail 4px (a tonal bar, not a border) |
| Legend | Row of chips |

- Responsive: single column path at all widths; at 1280 two columns (path left, selected node detail right 5/7).

#### M-26 Set Soalan Guru (row 26)
- Routes `/set-soalan-saya` (`SetSoalanSayaPage`, `QuestionSetRow`; M10, batch B03) and `/set-soalan-saya/:id/jawab` (`QuestionSetQuizPage`; M05, batch B01). Size: S + quiz via kit.

| Current | v2 |
|---|---|
| Sets assigned by teachers | Card list: `UCard` with `DsIconChip` A1 (`clipboard-text`), set title, teacher + class muted, due date chip (warning if near, icon + word), status chip, "Jawab" primary |
| Quiz | AR-QUIZ |
| Empty | `DsEmptyState` |

#### M-27 Audio KBAT (row 27)
- Routes `/audio-kbat` (`AudioKbatListPage`), `/audio-kbat/:id` (`AudioKbatPlayerPage`). M09, batch B04. Size: M. Dep: `DsAudioPlayer` (NEW).

| Current | v2 |
|---|---|
| List | `DsMediaCard` compact rows: `DsIconChip` A1 (`headphones`), title, duration, subject chip, play button 44px |
| Player | `DsAudioPlayer`: large `UCard` with play/pause 64px primary button, seek slider (`USlider`, current/total time `tabular`), speed `USelect`, transcript `UAccordion`; keyboard space toggles |
| Questions after audio (if any) | AR-QUIZ-style options inside the card |

- Icons: `headphones`, `play`, `pause`. A4 not used (not AI). 3D none.

#### M-28 Syiling & Token (row 28)
- Routes `/gamification` (`GamificationDashboardPage`), `/gamification/history` (`GamificationHistoryPage`). M14, batch B05. Size: M. Dep: `DsRewardChip`, `DsLedgerRow` (use `DsLeaderRow` generic; see §4).

| Current | v2 |
|---|---|
| Balance cards (Koin, Mata/Token, streak) | `DsStatTile` with **3D** coin / bolt / fire (reward items), display numerals count-up |
| Quick links (Tukar Token, Cabaran Harian ...) | Row of `DsIconChip` action cards |
| History list | Card/list rows: reason, date, `+n`/`-n` with `DsRewardChip` (green for +, neutral for -; sign and word as today), grouped by day with `text-overline` day labels; `UPagination` |

- Colours: A3 for Koin/Mata chips, A2 only when a new milestone is shown. Responsive: tiles 2 across 375 (3rd wraps), 3 across 768.

#### M-29 Tukar Token (row 29)
- Route `/gamification/convert` (`GamificationConvertPage`). M14, batch B05. Size: S. Dep: none.

| Current | v2 |
|---|---|
| Conversion form (amount, rate) | `UCard`: balance `DsRewardChip` -> `UInputNumber` (52px) -> result line in display numerals (`tabular`) -> primary "Tukar"; confirm via `useConfirm()` if confirmed today |
| Result | toast + balances count-up |

#### M-30 Cabaran Harian (row 30)
- Route `/gamification/challenges` (`GamificationChallengesPage`). M14, batch B05. Size: M. Dep: none.

| Current | v2 |
|---|---|
| Challenge list (today's quests) | Card rows: `DsIconChip` A3 (`target`), title, progress `UProgress` with "n/N", reward `DsRewardChip` (3D coin/bolt), state: done = green check chip; "Tuntut" primary when claimable (A2 sticker animation on claim, reduced-motion: static) |
| Streak/summary | `DsStatTile` with 3D fire |

#### M-31 Kedai Hadiah (row 31)
- Route `/gamification/rewards` (`RewardsShopPage`). M15, batch B06. Size: M. Dep: `DsShopCard` (NEW).

| Current | v2 |
|---|---|
| Balance | `DsRewardChip` row (sticky under header on scroll at 375: `sticky top-0 bg-muted`) |
| Category filter | `UTabs` segmented / chips |
| Reward cards | `DsShopCard`: image or 3D 64px, name, price `DsRewardChip`, stock/limit chip, "Tebus" primary (disabled + reason chip if insufficient: icon `lock-simple` + word) |
| Redeem | `DsDialog` confirm (`useConfirm` text as today) -> success toast; balance count-up |

- Colour: price chips A3; "stok habis" neutral chip with word. Grid 1/2/3-4.

#### M-32 Marketplace (row 32)
- Routes `/marketplace` (`MarketplacePage`), `/marketplace/penjual/:id` (`PenjualShopPage`), `/marketplace/:slug` (`ProductDetailPage`), `/marketplace/:slug/whatsapp` (`WhatsappHandoffPage`). M20, batch B06. Size: L. Dep: `DsShopCard`, `DsFilterBar`.

| Current | v2 |
|---|---|
| Search + category + sort | `DsFilterBar` |
| Product grid | `DsShopCard` (image 1:1 via `DsArt3D variant="plain"`, price display, seller chip, rating) |
| Seller page | Header card (avatar, name, rating) + product grid |
| Product detail | Gallery `UCarousel` with dots; title, price `text-title`, seller card, description `DsProse`, primary "Hubungi Penjual" (WhatsApp) |
| WhatsApp handoff | Centered `UCard` max-w-prose: notice text, primary "Buka WhatsApp" (icon `whatsapp-logo`), ghost "Kembali"; countdown text if any |

- Colour: A1 only; price in display numerals neutral. 3D none (real products). External-link buttons show `arrow-square-out` icon + `aria-label` "(tab baharu)" suffix only if the current link opens a new tab (copy keep).

#### M-33 Papan Pendahulu (row 33)
- Route `/leaderboard` (`LeaderboardPage`; M08; also `/gamification/leaderboard`, M14 `student-b/LeaderboardPage`, which should be the same pattern). Batch B08b (M08 page) and B05 (M14 page). Size: M. Dep: `DsLeaderRow`. Spec: AR-RANK as M-18, header subtitle "Siapa juara minggu ini?" kept; period `UTabs` (weekly/monthly as today); 3D crown/trophy on first place.

#### M-34 Pencapaian (row 34)
- Route `/gamification/achievements` (`AchievementsPage`). M14, batch B05. Size: M. Dep: `DsBadgeTile` (NEW) or `DsStatTile`.

| Current | v2 |
|---|---|
| Summary (n earned / total) | `DsHeroCard` variant win? No: `DsStatTile` + `UProgress`; hero not needed |
| Badge grid | `DsBadgeTile`: earned = 3D medal/trophy 64px + title + date; locked = grayscale Duotone glyph on `bg-elevated` + word "Belum dibuka" (label as today); progress `UProgress` for in-progress badges. Newly earned shows A2 `BARU` badge (win job) |
| Detail popover/dialog | `DsDialog` with art 96px, description, progress |

- Responsive: grid 2 across 375, 3 at 768, 4-5 at 1280.

#### M-35 Kotak Misteri (row 35)
- Route `/gamification/mystery-box` (`MysteryBoxPage`). M15, batch B06. Size: M. Dep: `DsWheel`/reveal animation (shared NEW spec).

| Current | v2 |
|---|---|
| Box intro + cost | `UCard` with 3D `wrapped gift` 120px (bob), cost `DsRewardChip`, primary "Buka" (disabled with reason) |
| Reveal | `DsDialog` result: prize 3D/glyph, A2 sticker "BARU"/prize text as today; confetti (learner only, reduced motion off) |
| Past prizes | card list |

#### M-36 Rujuk Kawan (row 36)
- Routes `/gamification/referral` (`ReferralPage`), `/gamification/kad-kongsi` (`KadKongsiPage`). M14, batch B05. Size: M. Dep: none.

| Current | v2 |
|---|---|
| Referral code + share | `DsCharacterCard` **variant action (A1)** with code in display numerals + `UButton` tonal "Salin" (icon `copy`) + primary "Kongsi" (icon `share-network`, Web Share API as today) |
| Rewards explanation | `UCard` list with `DsIconChip` A3 |
| Invited friends list | card rows with status chip |
| Kad Kongsi | The shareable card preview in a `UCard` (art stays as the page's own canvas/image); "Muat Turun" tonal, "Kongsi" primary |

#### M-37 Cikgu Alesa (row 37)
- Route `/cikgu` (`ChatPage`). M13, batch B02. Size: L. Dep: floating button (shell). Teacher RPH/essay/PBD pages under `/cikgu/*` are not in the matrix and are out of scope.

| Current | v2 |
|---|---|
| Chat header | Alesa identity: A4 `DsIconChip` (`sparkle`) + name + "AI" pill (A4 solid, white text); the **friend avatar is not used here** (Alesa is the separate AI tutor) |
| Messages | Bubbles: user = A1 gradient-free filled `bg-primary text-primary-on` right aligned; Alesa = `bg-default shadow-lift` left with "AI" tag; markdown content in `DsProse`; typing indicator three dots (static under reduced motion) |
| Quick prompts | chips strip above composer |
| Composer | sticky bottom bar `bg-default shadow-bar-up`: `UTextarea` autosize (min 52px) + send `UButton` icon `paper-plane-tilt` 52px; above the tab bar offset handled by the shell (full-screen chat hides the floating button) |
| Usage limit notice | `UAlert` warning subtle |
| Empty first state | greeting card with `sparkle` chip and 3 suggestion chips |

- Responsive: chat column max 40rem centred at >= md; 375 full-bleed to gutters; composer sticky; messages list scrolls inside `main`. Special: `aria-live="polite"` on the message list for new Alesa messages; Esc blurs composer.

#### M-38 Kedai Hadiah Digital (row 38)
- Routes `/cikgu/hadiah` (`DigitalShopPage`), `/cikgu/hadiah/saya` (`MyRedemptionsPage`). M15, batch B06. Size: M. Dep: `DsShopCard`.

| Current | v2 |
|---|---|
| Digital rewards catalogue | Same as M-31 with a "digital" `UBadge subtle` and delivery note |
| My redemptions | Card list: reward name, date, status chip icon + word, code with "Salin" button (code in `text-heading` tabular, `bg-elevated` field) |

#### M-39 Timeline Saya (row 39)
- Routes `/timeline` (`TimelinePage`), `/timeline/create` (`TimelineCreatePage`), `/pelajar/:id` (`PublicProfilePage`). M08, batch B08b. Size: M. Dep: none new (`UTimeline`).

| Current | v2 |
|---|---|
| Feed of posts/milestones | `UTimeline` vertical (icon chip per event: A1 solid; 3D only for milestone events), card per item with date `text-caption`, text, reactions as tonal buttons 44px |
| Create post | AR-FORM in a `UCard`/sheet; photo upload `UFileUpload`; privacy `USelect` |
| Public profile | Header card (avatar, name, school, level, streak/Mata `DsRewardChip`s), achievements strip of `DsBadgeTile`, recent activity timeline |

- Responsive: header card 4-col sticky at xl, timeline 8-col.

#### M-40 Jemput Ibu Bapa (row 40)
- Route `/jemput-ibu-bapa` (`JemputIbuBapaPage`). M02, batch B02. Size: S. Dep: none.

| Current | v2 |
|---|---|
| Invite form (parent e-mail/name) | AR-FORM `UCard`; primary "Jemput" as today |
| Generated link/token | Field with copy button (`UInput readonly` + `UButton` tonal "Salin"), share button; status badges for pending/accepted invites (icon + word) |
| Invites list | card rows |
| Explanation | `DsCharacterCard` info (A4) if it is a highlighted info box today |

Murid account basics A1-A5 are specified above and apply with the learner personality.

---

### Guru (staff personality, B+) - matrix order

#### G-1 Command Center (row 1)
- Routes: `/guru/command-center` (`CommandCenterPage.vue`), mounted drill-downs under `/guru/command-center/...` (M17 pages reused). Panels in `m10-teacher-class/components/command-center/*` (`TopBar`, `KpiTile`, `ClassPanel`, `ActivityPanel`, `EngagementPanel`, `FeedPanel`, `InsightPanel`, `KirkPanel`, `LeaderboardPanel`, `MoodPanel`, and modals `AchievementsModal`, `ClassSummaryModal`, `DrillModal`, `EvaluateModal`, `PredictiveModal`, `RemedialModal`). Batch B11. Admin Sekolah uses the same page through the M17 alias `/admin-sekolah/command-center` (see AS-1).
- Personality: staff. The v1 "standalone dark layout" is dropped; v2 renders it **inside the staff shell** with the same live behaviour as `Pemantauan > Langsung` (`v2-shells.md` §4). Size: L. Dep: `DsLiveTiles`, `DsDrillTable`, `DsLiveBadge` (exist), `DsChart`.

| Current | v2 |
|---|---|
| `TopBar` (title, live status, controls) | Page header row: h1 "Command Center" (as today), `DsLiveBadge` "LANGSUNG" (error solid + pulse), updated-at time, `UButton` tonal "Jeda"/"Sambung" and "Skrin Penuh" (icon `corners-out`, `aria-pressed`) - labels as in the page today if they exist, else the Langsung labels in `v2-shells.md` §4 |
| `KpiTile` (several KPIs with count-up) | `DsLiveTiles` (`DsStatTile` grid 2/3/4), count-up on update, `aria-live="off"` |
| `ClassPanel`, `EngagementPanel`, `ActivityPanel`, `MoodPanel`, `InsightPanel`, `KirkPanel`, `LeaderboardPanel` | Each = `UCard` (staff `shadow-xs`) with `h2`, content as lists (`DsDrillTable` for classes and pupils) or `DsChart`; mood uses semantic icons + words (not colour only); Kirkpatrick panel keeps level tiles with links to `/guru/kirkpatrick` |
| `FeedPanel` (live event feed) | `UCard` list, newest first, each row time `text-caption`, icon chip, text; auto-scroll off under reduced motion; `aria-live="off"` |
| Modals | `DsDialog` (bottom sheet < sm) with the existing content; `DrillModal` content = `DsDrillTable` |

- Colour: kobalt only; semantic colour for risk (`error`) and engaged (`success`) with icon + word. Icons: `pulse`, `users-three`, `chalkboard`, `flame`, `smiley`, `warning`, `trophy`. 3D none.
- Responsive: 375 tiles 2x2, panels stacked, `DsDrillTable` as card list, controls collapse to icon buttons (44px) with tooltips; 768 two columns of panels; 1280 grid of 12 (KPI row full width, panels 6/6 and 4/4/4).
- Special: full-screen mode per `v2-shells.md` §4.2 (`F`, Esc, 56px strip, wall scale); pause control mandatory (WCAG 2.2.2); reduced motion removes pulse and number tick.

#### G-2 Dashboard Guru (row 2)
- Route `/guru` (`GuruDashboardPage.vue`; components `StatCards`, `TodayPanel`, `ChecklistCard`, `GuideCard`). M10, batch B10. Size: M. Dep: none new.

| Current | v2 |
|---|---|
| Welcome line (`welcomeSubtitle`) | Shell header subtitle |
| `StatCards` | `DsStatTile` row (4 across at 1280), kobalt 12% chips (`chalkboard`, `student`, `clipboard-text`, `chart-bar`) |
| `TodayPanel` | `UCard` with `h2` and an agenda list (time, class, subject) |
| `ChecklistCard` | `UCard` with `UCheckbox`-like read-only rows (icon `check-circle`/`circle` + text) and `UProgress` with number |
| `GuideCard` | `UCard` with `DsIconChip` kobalt and ghost link button (not a character card; staff has no meaning-coloured cards) |

- Responsive: stats 2/3/4; cards 1 col -> 2 col at xl (Today 8, Checklist 4).

#### G-3 Headcount (row 3; Guru, Admin Sekolah; Murid 403)
- Files: see M-3. Module M08, batch B14. Personality: staff. Size: L (8 files, 12 routes). Dep: `DsDataTable`, `DsFilterBar`, `DsChart`, `useConfirm`, `UFileUpload`.

| Page | v2 |
|---|---|
| `HeadcountListPage` | AR-TABLE: filter bar (class, date) + `DsDataTable` of headcounts (date, class, total, hadir %, status badge) + "Cipta" primary (icon `plus`) |
| `HeadcountDashboardPage` | AR-DASH (stat tiles + attendance chart + class table) |
| `HeadcountCreatePage` | AR-FORM: class `USelectMenu`, date `UInputDate`, student checklist as a `DsDataTable` with `UCheckbox` and "pilih semua"; sticky bar |
| `HeadcountTablePage` | `DsDataTable` with per-student status (`USelect` or `URadioGroup` segmented: Hadir/Tidak hadir ... labels as today) |
| `HeadcountSummaryPage` | AR-REPORT |
| `HeadcountExportPage` | `UCard` with format `URadioGroup`, "Muat Turun" primary |
| `HeadcountStudentPage` | Pupil header + attendance `DsChart` + table |
| `HeadcountShellPage` (results/edit/unjuran/settings) | Kept as the shell/placeholder screen: `DsErrorPage`-style `UEmpty` with the page's existing text |

- Icons: `clipboard-text`, `user-check`, `calendar-blank`, `export`. Colour: attendance statuses icon + word with success/warning/error. Responsive: tables -> card lists at 375 with the status control inline; sticky action bar.

#### G-4 Prestasi (row 4) - delta only
- Spec: M-4 (same files, batch B08a). Staff delta: `DsDataTable` replaces learner `DsLeaderRow` lists; kobalt chips; charts use `--ds-cat-*`; `PrestasiKelasPilihPage`/`PrestasiKelasDetailPage` are Guru-relevant (class picker + detail), `/prestasi/:userId` opens from Pelajar Saya.

#### G-5 Analitik Adaptif (row 5) - delta only
- Spec: M-5. Staff delta: class view `/analitik/kelas` is the primary page (class mastery heat, weak topics table with `DsHeatGrid` if present); table density staff.

#### G-6 Analisa Item / Analisis Item (row 6)
- Spec: M-6 (M08 pages, batch B08a) **plus** `/guru/analisis-item` (`AnalisisItemPage`, M11, batch B12; labelled "Analisis Item" under Lain-lain). Same patterns; `AnalisisItemPage` = AR-REPORT: paper/class filters -> item `DsDataTable` -> distractor `DsChart`. Size: M.

#### G-7 Video (row 7) - delta only
- Spec: M-7. Staff delta: staff look, "Tambah Video" primary button visible where the role allows it today; form pages AR-FORM.

#### G-8 Kelas Saya (row 8)
- Routes `/guru/kelas` (`KelasListPage`, `ClassCard`, `QrModal`), `/guru/kelas/cipta` (`KelasCreatePage`, `SchoolPicker`, `subjects`). M10, batch B10. Size: M. Dep: `DsDialog`.

| Current | v2 |
|---|---|
| Class cards | `UCard` per class: kobalt chip `chalkboard`, name `text-subheading`, subject/form `UBadge subtle`, student count `DsStatTile`-mini (number `tabular`), join code with "Salin"; actions in `UDropdownMenu` (44px): "QR", edit, etc. (labels as today); grid 1/2/3 |
| `QrModal` | `DsDialog`: QR image centered 240px on a white `bg-default` tile (QR needs white), code under it, "Muat Turun" tonal |
| Create form | AR-FORM; school picker `USelectMenu`; subject tiles (`tilesForSchoolType`) as `URadioGroup variant="card"` / `UCheckbox` cards with subject glyph chips |

#### G-9 Soalan by Chapter (row 9) - delta only
- Spec: M-9 (batch B01), staff density, no 3D, no win screen (Guru previews questions). Size: S delta.

#### G-10 Monitoring (row 10; Guru, Admin Sekolah)
- Routes `/guru/monitoring` (`MonitoringPage`), `.../sekolah/:schoolId` (`MonitoringSchoolPage`), `.../sekolah/:schoolId/pelajar/:userId` (`MonitoringStudentPage`), `.../sekolah/:schoolId/guru/:userId` (`MonitoringTeacherPage`); AS mount `/admin-sekolah/monitoring` uses the same pages with `basePath`. M11, batch B12. Size: L. Dep: `DsDrillTable`, `DsLiveTiles`, `DsChart`.

| Current | v2 |
|---|---|
| Scope header (school/teacher/pupil) | Page header with breadcrumb row (`DsDrillTable` crumb pattern) |
| KPI tiles | `DsStatTile` row |
| School/teacher/pupil lists | `DsDrillTable` (zebra, `caret-right`, status badges icon + word) |
| Pupil / teacher detail | Header card + `DsStatTile` row + `DsChart` + activity list |

- Responsive: tiles 2/3/4; drill tables card list < md with last two crumbs and overflow menu.

#### G-11 Kirkpatrick (row 11; Guru, Admin Sekolah)
- Routes under `/guru/kirkpatrick` (and `/admin-sekolah/kirkpatrick`): overview (`KirkpatrickOverviewPage`), `/reaction` (`KirkpatrickReactionPage`), `/learning` (`KirkpatrickLearningPage`), `/behavior` (`KirkpatrickBehaviorPage`), `/results` (`KirkpatrickResultsPage`), `/chain` (`KirkpatrickChainPage`), `/export-pdf` (`KirkpatrickChainPdfPage`), `/interventions` (`KirkpatrickInterventionsPage`), `/pelajar/:userId` (`KirkpatrickPelajarPage`). M12, batch B13. Size: L (9 pages). Dep: `DsChart`, `DsDataTable`, `DsStepper` (`UStepper`).

| Current | v2 |
|---|---|
| Level navigation (Ringkasan, T1..T4, Rantaian Impak, Intervensi) | `UTabs` segmented on top (scrolls inside itself at 375), labels exactly as the menu: "Ringkasan", "T1: Reaksi", "T2: Pembelajaran", "T3: Tingkah Laku", "T4: Hasil", "Rantaian Impak", "Intervensi" |
| Overview | AR-DASH: 4 level tiles (`DsStatTile` with kobalt chips `smiley`, `brain`, `footprints`, `trophy`) linking to levels |
| T1-T4 pages | AR-REPORT: filter bar, KPI tiles, `DsChart`, `DsDataTable` |
| Rantaian Impak (chain) | Four-step `UStepper`-like horizontal chain of `UCard`s (vertical at < lg) with metric and delta (icon `trend-up/down` + number); "Eksport PDF" tonal button |
| `KirkpatrickChainPdfPage` | Print layout: staff look in light mode only, no chrome, A4 width, `print:` utilities allowed here only through a `DsPrintSheet` wrapper (NEW, one-line spec §4) |
| Interventions | `DsDataTable` + "Tambah" `DsDialog` form; status badges |
| Pupil page | header + tiles + chart |

- Colour: kobalt + semantic (delta up success, down error, with arrows and words). Responsive: tabs scroll, charts stack.

#### G-41 Pelajar Saya (row 41)
- Route `/guru/pelajar` (`PelajarSayaPage`, `StudentRow`). M10, batch B10. Size: M. Dep: `DsDataTable`, `useConfirm`.

| Current | v2 |
|---|---|
| Class/search filters | `DsFilterBar` |
| Pupil list rows | `DsDataTable`: avatar+name, class, last active, level, status badge; row actions `UDropdownMenu` ("Lihat Prestasi", remove with `useConfirm()` as the native confirm today); card list < md |
| Link to `/prestasi/:userId` | Name is a link (`ULink`) |

#### G-42 Laporan (row 42)
- Route `/guru/laporan` (`LaporanPage`). M11, batch B12. Size: M. Dep: `DsChart`, `DsDataTable`.
- AR-REPORT: filters (class, subject, period) -> KPI tiles -> charts -> table; "Eksport" tonal button. Responsive per §1.12.

#### G-43 Laporan Mingguan (row 43)
- Route `/laporan-mingguan` (`LaporanMingguanPage`) is a 403 for every role (live behaviour). v2: router renders `DsErrorPage` 403 (staff variant, copy as today). The page component may be left untouched. Size: S (verify only). Batch B08b.

#### G-44 Sumbang Soalan (row 44)
- Routes `/guru/soalan` (`SumbangSoalanPage`), `/guru/soalan/cipta` (`SumbangSoalanCiptaPage`), `/guru/soalan/:id` (`SumbangSoalanDetailPage`), `/guru/soalan/:id/edit` (`SumbangSoalanEditPage`). M10, batch B10. Components: `AudioKbatCard`, `ContributionSummary`, `HantarKertasCard`, `ImportCard`, `QuestionCard`, `QuestionForm`. Size: L. Dep: `DsFilterBar`, `UFileUpload`, `UTabs`. Note: question-card/intake UI is out of scope of the DS for visual redesign of the question *content* (D28e); restyle chrome only.

| Current | v2 |
|---|---|
| `ContributionSummary` | `DsStatTile` row (submitted, approved, pending) |
| Action cards (`AudioKbatCard`, `HantarKertasCard`, `ImportCard`) | Row of three `UCard`s with kobalt chips and ghost/tonal buttons |
| Filters | `DsFilterBar` (status segmented `UTabs`) |
| Questions list (`QuestionCard`) | Card list/table: question excerpt (2 lines), subject/topic chips, status badge icon + word, actions menu |
| `LaravelPager` | `UPagination` |
| Create/Edit form | AR-FORM: question `UTextarea`, options A-D as `UInput` rows with letter chips and a `URadioGroup` for the correct answer (indicated by check icon + word), difficulty `USelect`, topic cascade selects, image upload; sticky bar |
| Detail | `UCard` read view; options in `bg-elevated` rows, correct one with check icon + word |

---

### Admin Sekolah (staff personality, B+) - matrix order

#### AS-1 Command Center (row 1)
- Route `/admin-sekolah/command-center` (M17 alias route reusing the M10 Command Center components). Same spec as **G-1** with school scope (breadcrumb root = own school). No separate file work if the alias reuses `CommandCenterPage`; verify in the B11 PR. Size: S delta.

#### AS-2 Dashboard (row 2)
- Route `/admin-sekolah` (`SchoolDashboardPage`; components `SchoolBanner`, `SummaryCards`, `PerformanceSummary`, `PerutusanCard`). M27, batch B15. Size: M. Dep: `DsChart`.

| Current | v2 |
|---|---|
| `SchoolBanner` (school name, logo, welcome) | Hero-less header card: `UAvatar` (school logo, rounded-lg), name `text-title`, subtitle; staff has no gradient hero (gradient appears only in learner components) |
| `SummaryCards` | `DsStatTile` row (guru, pelajar, kelas, aktif ...) with kobalt chips |
| `PerformanceSummary` | `UCard` with `DsChart` + top/bottom subject list |
| `PerutusanCard` | `UAlert subtle color="info"` style card with icon `megaphone` + text + link (`/perutusan` is deferred per L07 note: link stays inert or hidden exactly as today) |

#### AS-3 Headcount, AS-4 Prestasi, AS-5 Analitik Adaptif, AS-6 Analisa Item, AS-7 Video
- Role deltas only (specs: G-3, M-4, M-5, M-6, M-7). Scope = own school (filters pre-set and locked fields show the lock treatment of §1.7). `/analitik/kelas` and `/analisa-item/kelas*` are not available to this role (route roles exclude it): they never render here. Sizes: delta S each.

#### AS-10 Monitoring (row 10)
- Route `/admin-sekolah/monitoring` (+ nested), spec **G-10**, scope root = own school page (the list page starts at the school level). Delta S.

#### AS-11 Kirkpatrick (row 11)
- Route `/admin-sekolah/kirkpatrick`, spec **G-11**, school scope; overview route is registered for this mount as a separate record (`SCHOOL_ADMIN_MOUNT.prefix`). Delta S.

#### AS-45 Sekolah Bersaing (row 45)
- Route `/sekolah-bersaing` (`SekolahBersaingPage`; M16 S28). Batch B16. Size: M. Dep: `DsLeaderRow` (staff variant `DsDataTable` is acceptable).

| Current | v2 |
|---|---|
| NEW badge on menu | `UBadge` secondary "BARU/NEW" exactly as the menu copy (lime win-job exception documented in design-system §12.1) |
| Filters (state, period) | `DsFilterBar` |
| School ranking | `DsDataTable`: rank, school (own school row highlighted with `bg-primary/10` and bold + "(sekolah anda)" only if copy exists today), points, trend arrow icon + number; card list < md |
| Own school summary | `DsStatTile` row |

#### AS-46 Statistik Penggunaan (row 46)
- Route `/admin-sekolah/statistik-penggunaan` (`StatistikPenggunaanPage`; `UsageBreadcrumb`, `UsageModeCard`, `UsagePeriodPills`, `UsageTiles`). M27, batch B15. Size: M. Dep: `DsChart`.

| Current | v2 |
|---|---|
| `UsagePeriodPills` | `UTabs` segmented |
| `UsageBreadcrumb` | `UBreadcrumb` (drill crumb pattern) |
| `UsageTiles` | `DsStatTile` row |
| `UsageModeCard` | `UCard` per mode with `DsChart` (bar/donut) + number |

#### AS-47 DSKP Heatmap (row 47)
- Route `/admin-sekolah/dskp-heatmap` (`DskpHeatmapPage`; `HeatmapFilters`, `HeatmapMap`). M27, batch B15. Size: M. Dep: `DsHeatGrid` (NEW).

| Current | v2 |
|---|---|
| `HeatmapFilters` | `DsFilterBar` |
| `HeatmapMap` | `DsHeatGrid` (5-step single-hue ramp in kobalt tint, number in each cell, popover with the DSKP standard name; legend row) |
| Detail panel | `UCard` / `DsDialog` on selection |

#### AS-48 Laporan Aktiviti (row 48)
- Route `/admin-sekolah/laporan-aktiviti` (`LaporanAktivitiPage`; `ActivityBreadcrumb`, `ActivityOverview`, `ActivityPupilsTab`, `ActivityRangePills`, `ActivityTabs`, `ActivityTeachersTab`). M27, batch B15. Size: M. Dep: `DsDataTable`.

| Current | v2 |
|---|---|
| `ActivityRangePills` | `UTabs` segmented |
| `ActivityTabs` (Ringkasan / Pelajar / Guru) | `UTabs` segmented (second row) |
| `ActivityOverview` | `DsStatTile` row + `DsChart` |
| `ActivityPupilsTab`, `ActivityTeachersTab` | `DsDataTable` (card list < md), status badges, links to detail |

#### AS-49 Amaran Awal (row 49)
- Route `/amaran/sekolah` (`AmaranSekolahPage`; `AmaranActions`, `AmaranDistribution`, `AmaranLevelPills`, `AmaranPupilTable`, `AmaranSubjectCard`, `AmaranTiles`). M27, batch B15. Size: L. Dep: `DsDataTable`, `DsChart`.

| Current | v2 |
|---|---|
| `AmaranTiles` | `DsStatTile` row; risk counts use semantic chips (tinggi = error, sederhana = warning, rendah = success) with icon + word |
| `AmaranLevelPills` | `UTabs` segmented with count `UBadge` per level |
| `AmaranDistribution` | `DsChart` stacked bar (risk levels) |
| `AmaranSubjectCard` | `UCard` per subject with number and `UProgress` |
| `AmaranPupilTable` | `DsDataTable`, risk badge icon + word, sort, row link; card list < md |
| `AmaranActions` | action row: tonal export, primary "Hantar Amaran" labels as today with `useConfirm` if confirmed today |

#### AS-50 Laporan Bulanan (row 50)
- Route `/admin-sekolah/laporan-bulanan` (`LaporanBulananPage`; `MonthlyCards`, `MonthlyTable`, `SubjectPerformance`). M27, batch B15. Size: M. Dep: `DsDataTable`, `DsChart`.
- Month picker `USelect`/`UInputDate` (month) in the filter bar; `MonthlyCards` -> `DsStatTile`; `SubjectPerformance` -> `DsChart` horizontal bars with numbers; `MonthlyTable` -> `DsDataTable`; "dijana pada ..." line (`generatedAtLabel`) `text-caption text-muted`; export/print button tonal.

#### AS-51 Senarai Pelajar (row 51)
- Routes `/admin-sekolah/pelajar` (`SenaraiPelajarPage` -> `SchoolUserList`), `/admin-sekolah/pelajar/baru` (`TambahPelajarPage`, `LockedSchoolLabel`, `PupilCredentialBlock`), `/admin-sekolah/pelajar/:id` (`EditPelajarPage` -> `SchoolUserEditForm`). M27, batch B16. Size: L (shared `SchoolUserList` / `SchoolUserEditForm` also serve guru). Dep: `DsDataTable`, `DsDialog`, `useConfirm`.

| Current | v2 |
|---|---|
| `SchoolUserList` (search, class filter, table, pager, actions) | AR-TABLE: `DsFilterBar` + `DsDataTable` (name, no. IC/ID as today, class, status badge, last login); row actions `UDropdownMenu`; "Tambah" primary above; `UPagination` |
| `TambahPelajarPage` | AR-FORM; `LockedSchoolLabel` = locked field treatment (§1.7); after create, `PupilCredentialBlock` = `UCard` with generated username/password in `tabular` mono-free text, "Salin" buttons, warning `UAlert` text as today (shown once) |
| `SchoolUserEditForm` | AR-FORM, status `USwitch`, reset password `UButton` tonal + `useConfirm` |

#### AS-52 Senarai Guru (row 52)
- Routes `/admin-sekolah/guru` (`SenaraiGuruPage` -> `SchoolUserList`), `/admin-sekolah/guru/baru` (`CiptaGuruPage`), `/admin-sekolah/guru/:id` (`EditGuruPage` -> `SchoolUserEditForm`). M27, batch B16. Size: M (reuses AS-51 components; same developer). Spec = AS-51 with teacher columns (subjects, classes).

#### AS-53 Kelas Sekolah (row 53)
- Route `/admin-sekolah/kelas` (`KelasSekolahPage`; `ClassFilters`, `ClassTable`). M27, batch B16. Size: M. Dep: `DsDataTable`.
- `ClassFilters` -> `DsFilterBar`; `ClassTable` -> `DsDataTable` (class, form, teacher, pupil count, join code with "Salin"); `LaravelPager` -> `UPagination`; card list < md.

---

## 3. Batching plan

Rules: one batch = one developer = files in one module only (no two batches touch the same file); screens that are shared across roles are migrated **once**, in the batch of their module, with the staff/learner variants covered by that batch's spec entries. Waves are ordered by user value (Murid, then Guru, then Admin Sekolah); batches inside a wave run in parallel. A batch with a "kit" dependency can start in parallel but its quiz runner pages merge after the kit.

Prerequisite wave 0 (not screens): missing composites in §4 that are used by many batches (`DsFilterBar`, `DsDataTable`, `DsLeaderRow`, `DsMediaCard`, `DsShopCard`, `DsHeatGrid`, `DsChart`, `DsDialog`/`useConfirm`, `DsProse`) and the shells. If these are not yet in `src/ds`, a "DS composites" developer builds them first (about 3-4 days) while Wave 1 batches that do not need them (B01, B03, B09) start.

### Wave 1 - Murid (and account basics)

| Batch | Module / files | Screens (matrix rows) | Pages | Size | Needs |
|---|---|---|---|---|---|
| **B01 Practice and quiz kit** | M05 `pages/*` (Practice*, Chapter*, Revision*, Remedial*, Structured*, QuestionSetQuiz) and `components/quiz/*`, `components/chapter/*`, `components/remedial/*` | M-16 Latih Tubi, M-9 Soalan by Chapter (+ G-9), M-12 Remedial, M-17 Soalan Berstruktur, M-26b Set Soalan quiz | 13 | L (kit first, then pages) | DS quiz composites (exist) |
| **B02 Curriculum, AI, sponsorship, invites** | M03 `TopicsPage`, `TopicDetailPage`, `LearningMapPage`; M25 `HeatmapTopikLemahPage`; M21 `MohonKeluargaAngkatPage`; M13 `ChatPage`; M02 `JemputIbuBapaPage` | M-24, M-25, M-14, M-15, M-37, M-40 | 7 | M-L | `DsHeatGrid`, `DsLevelMap`, `DsProse` |
| **B03 PKSK and kelas** | M07 student pages; M10 `KelasSayaPelajarPage`, `SetSoalanSayaPage` (+ components in `kelas-saya/`, `set-soalan-saya/`) | M-19 PKSK, M-8 (Murid), M-26a | 8 | L | quiz kit from B01 for PkskPractice/Exam (merge after B01) |
| **B04 Content** | M09 `ArtikelList/Detail`, `AudioKbatList/Player`, `VideoList/Detail/Form`, `PanduanPage` | M-20, M-27, M-7 / G-7 / AS-7, A3 | 8 | M-L | `DsMediaCard`, `DsAudioPlayer`, `DsProse` |
| **B05 Gamification** | M14 `GamificationDashboard/Convert/Challenges/History`, `student-b/*` | M-28, M-29, M-30, M-34, M-36, M-33 (M14 leaderboard page) | 9 | M-L | `DsLeaderRow`, `DsBadgeTile`, `DsRewardChip` |
| **B06 Rewards and marketplace** | M15 `RewardsShop`, `MysteryBox`, `Cabutan`, `DigitalShop`, `MyRedemptions`; M20 all pages | M-22, M-31, M-35, M-38, M-32 | 9 | L | `DsShopCard`, `DsWheel` |
| **B07a Games (hub and solo)** | M16 `PermainanPage`, `Solo*`, `RodaNasib`, `Jutawan*`, `PapanBijak`, `Pertandingan`, `UjiMinda`, `SambungKata` | M-21 (part 1) | 14 | L | `DsGameTile`, `DsWheel` |
| **B07b Games (lobbies, battle, tournament)** | M16 `LobbyPage`, `RoomPage`, `Battle*` (6), `TournamentList/Detail` | M-21 (part 2), M-23 | 11 | L | `DsLeaderRow` |
| **B08a Performance** | M08 `Prestasi*`, `Tingkatan*`, `Prestasi360`, `AnalitikPelajar/Kelas`, `AnalisaItem*` (and class detail) | M-4/G-4, M-5/G-5, M-6/G-6 (+ AS-4/5/6) | 12 | L | `DsChart`, `DsDataTable`, `DsHeatGrid` |
| **B08b Ranking and timeline** | M08 `RankingPage`, `LeaderboardPage`, `Timeline*`, `PublicProfilePage`, `LaporanMingguanPage` (verify 403) | M-18, M-33, M-39, G-43 | 7 | M | `DsLeaderRow` |
| **B09 Account basics** | M01 `ProfilePage`, `ProfileEditPage`, `TetapanPage`; M22 `TicketsPage` | A1, A2, A4 (A3 in B04, A5 in the shell task) | 4 | M | `DsDialog`, `UFileUpload` |

Wave 1 batches that exceed 10 pages (B01, B07a) are single-module and uniform (the same archetype repeats), so they stay one batch; split by page after the kit/hub is merged if the team has spare developers (B01 -> kit+Latih Tubi / Chapter+Revision / Remedial+Structured+Set).

### Wave 2 - Guru

| Batch | Module / files | Screens | Pages | Size | Needs |
|---|---|---|---|---|---|
| **B10 Teacher class tools** | M10 `GuruDashboardPage`, `KelasListPage`, `KelasCreatePage`, `PelajarSayaPage`, `SumbangSoalan*` (4) + `components/dashboard/*`, `kelas/*`, `pelajar/*`, `soalan/*` | G-2, G-8, G-41, G-44 | 8 | L | `DsFilterBar`, `DsDataTable`, `useConfirm` |
| **B11 Command Center** | M10 `CommandCenterPage` + `components/command-center/*`; M17 alias route (verify only) | G-1, AS-1 | 1 (+ 6 modals, 10 panels) | L | `DsLiveTiles`, `DsDrillTable`, `DsLiveBadge` (exist), `DsChart` |
| **B12 Teacher analytics** | M11 `MonitoringPage`, `MonitoringSchoolPage`, `MonitoringStudentPage`, `MonitoringTeacherPage`, `LaporanPage`, `AnalisisItemPage` | G-10, G-42, G-6 (b), AS-10 | 6 | L | `DsDrillTable`, `DsChart` |
| **B13 Kirkpatrick** | M12 all `Kirkpatrick*Page` | G-11, AS-11 | 9 | L | `DsChart`, `DsPrintSheet` |
| **B14 Headcount** | M08 `Headcount*` pages (8 files) | G-3, AS-3, M-3 (403 only) | 8 | L | `DsDataTable`, `DsFilterBar` |

Within Wave 2, B10-B14 are all file-disjoint and can run in parallel. B14 touches M08 `Headcount*` files only; B08a/B08b do not.

### Wave 3 - Admin Sekolah

| Batch | Module / files | Screens | Pages | Size | Needs |
|---|---|---|---|---|---|
| **B15 School reports** | M27 `SchoolDashboardPage`, `StatistikPenggunaanPage`, `DskpHeatmapPage`, `LaporanAktivitiPage`, `AmaranSekolahPage`, `LaporanBulananPage` + their `components/*` | AS-2, AS-46, AS-47, AS-48, AS-49, AS-50 | 6 | L | `DsChart`, `DsHeatGrid`, `DsDataTable` |
| **B16 School users and competition** | M27 `SenaraiPelajarPage`, `SenaraiGuruPage`, `TambahPelajarPage`, `CiptaGuruPage`, `EditPelajarPage`, `EditGuruPage`, `KelasSekolahPage` + `components/users/*`, `classes/*`; M16 `SekolahBersaingPage` | AS-51, AS-52, AS-53, AS-45 | 8 | L | `DsDataTable`, `DsDialog`, `useConfirm` |

Admin Sekolah rows 1-7, 10, 11 (shared with Guru) are covered by B04, B08a, B11, B12, B13, B14 and need no extra batch; their deltas are listed in the AS sections so QA can verify the scope-locked behaviour.

Separate tasks not in any batch: Murid Home (row 2), Bijak SPM (row 13), shell account menu "Log Keluar" (A5), shells themselves.

Total coverage: 75 matrix rows (37 + 15 + 18 + 5). Murid Home (row 2) and Bijak SPM (row 13) are separate tasks; Log Keluar (A5) belongs to the shell task. All other rows are in 16 batch IDs (B01-B16, with B07 and B08 split into a/b = 18 IDs including the splits; at most 18 developers in parallel, normally 5-6 per wave).

---

## 4. Missing composites

Existing per the brief (verify with V-2): `DsCharacterCard`, `DsStatTile`, `DsIconChip`, `DsArt3D`, `DsFriendAvatar`, `DsSpeechBubble`, `DsFriendPicker`, `DsScoreRing`, `DsQuizOption`, `DsFeedbackSheet`, `DsWinHero`/`DsWinScreen`, `DsCarousel`, `DsLiveBadge`, `DsLiveTiles`, `DsDrillTable`, `DsEmptyState`, `DsHeroCard`, `DsIcon`, `DsRewardChip`, `DsQuizHeader`, `DsSubjectStrip`.

The design system (§12.3) also requires the following, which are **not** in that list. If any is absent from `src/ds/index.ts`, build it before the batches that need it. Each is composed only from Nuxt UI parts and tokens (no new colours).

| Composite | One-line spec | Needed by |
|---|---|---|
| `DsPage` | Page root helper: optional title block (h1 + subtitle), max-width by personality, standard gaps, slot for actions; pages without it follow §1.2 manually. | all |
| `DsFilterBar` | Responsive filter container per §1.3 (inline fields at >= md, "Penapis" drawer < md with active-count chip, "Guna"/"Set Semula" actions, query-param binding via v-model). | B04, B08, B10-B16 |
| `DsDataTable` | `UCard` + `UTable` + `UPagination`: zebra, no lines, tabular numbers, sticky first column, card-list rendering < md, sort select, empty/loading/error slots, BM pager copy. | B08, B10-B16, A4 |
| `DsChart` | Chart.js wrapper reading `--ds-cat-*`/`--ui-*` tokens at mount and on colour-mode change; no gridlines; accessible data-table alternative; fixed heights 220/280/320. | B08, B11-B15 |
| `DsDialog` + `useConfirm` | `UModal` >= sm / `UDrawer` bottom sheet < sm, no dividers; `useConfirm()` returns a promise with the same BM text (replaces `confirmNative`). | B03, B06, B09, B10, B16 |
| `DsErrorPage` | 403/404/error page per `v2-shells.md` §7 with learner friend variant. | M-3, G-43 |
| `DsProgressRing` | Same as `DsScoreRing` if that is the generic ring; otherwise alias. | B02, B03 |
| `DsLeaderRow` | Ranked row: rank chip (1-3 lime A2 with 3D medal option, others neutral), avatar, name + school muted, points display numeral, own-row highlight (A1 12% mix), staff variant renders as table row. | M-18, M-33, M-21, M-23, AS-45 |
| `DsHeatGrid` | CSS-grid colour-scale cells (5-step single-hue ramp from `bg-elevated`; learner ramp ends in A3, staff ramp in kobalt), % number in every cell, keyboard-focusable cells with popover, legend, card-list fallback < md. | M-14, M-4 (if grid), AS-47 |
| `DsMediaCard` | Card for video/article/audio: 16:9 thumbnail slot (plain image via `DsArt3D variant="plain"`), duration/category chips, 2-line title, meta line, optional `UProgress`. | B04 |
| `DsAudioPlayer` | Card with play/pause 64px, `USlider` seek with `tabular` times, speed select, transcript accordion; Space toggles. | M-27 |
| `DsShopCard` | Catalogue card: image or 3D 64px, name, price `DsRewardChip`, stock chip, primary action with disabled-reason chip. | M-31, M-32, M-38 |
| `DsBadgeTile` | Achievement tile: earned (3D medal + title + date), locked (Duotone glyph on `bg-elevated` + word), in-progress `UProgress`, `BARU` chip. | M-34, M-39 |
| `DsGameTile` | Hub tile: 3D/glyph 64px on solid chip, name, mode chip, optional `DsLiveBadge`; min 56px target. | M-21 |
| `DsWheel` | Reveal/draw animation container (spin wheel or box open) with `prefers-reduced-motion` fallback that shows the result at once; slots for prize and result sticker. | M-21 (Roda Nasib), M-22, M-35 |
| `DsLevelMap` | Vertical node path (done / current / locked states by chip + word, tonal rail not a line) with detail slot. | M-25 |
| `DsProse` | Typography wrapper for rich text (headings, lists, quotes on `bg-elevated`, images with radius, max-w-prose) using DS tokens. | M-20, M-32, M-37 |
| `DsPrintSheet` | Print-only A4 layout wrapper (light tokens forced, chrome hidden) for the Kirkpatrick PDF page. | G-11 |
| `DsArt3D variant="plain"` | Extend `DsArt3D` with a non-3D image mode (alt text, rounded token radius, lazy) so pages never use a raw `<img>` (G-5). | B04, B06, A3 |

Open design points needing user approval before the batches start:

| # | Decision | Default applied here |
|---|---|---|
| D-RS-1 | Charts have no gridlines (consistent with "no lines"). | Yes |
| D-RS-2 | Guru and Admin Sekolah Command Center moves into the staff shell (drops the v1 standalone dark layout). | Yes, per `v2-shells.md` §4/§5.5 |
| D-RS-3 | Murid Headcount (row 3) is a 403 page because the route is role-gated in code, unless prototype-scope says otherwise. | 403 |
| D-RS-4 | Staff heat grids use a kobalt single-hue ramp; learner heat uses the A3 orange ramp. | Yes |
| D-RS-5 | Marketplace and Kad Kongsi remain images the page already provides (no 3D replacement). | Yes |
