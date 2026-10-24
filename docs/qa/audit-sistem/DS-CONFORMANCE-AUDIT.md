# DS conformance audit - v2 prototype UI (findings only, no fixes)

> **User request (2026-10-24, verbatim BM):** "aku perasan UI components ada yang tak consistent. tak properly guna design system dan guna custom class ke? kena fix semua screens" — the user wants this fixed on ALL screens. Fix rule from the user: improve, do not redesign ("jangan ubah pelik2"); no redundant components.
>
> **Lead verification:** confirmed that `src/modules/m28-bijak-spm/admin/**` is absent from `config/ds-strict.json` (only `m28-bijak-spm/pages/**` and `components/**` are listed), and that `npm run lint:ds:css` crashes on the brace glob at `config/ds-strict.json:138`. Screenshots and scripts referenced below are local to the auditing machine (not committed).

Date: 2026-10-24. Code: `D:\Dev Projects\pp-audit-verify` @ `4469dc02` (origin/claude/determined-dijkstra-ju5q60), read-only. Dev server `http://localhost:5199` (not started/stopped by this audit).
Evidence labels: **[Lint]** = tool output, **[Code]** = static read of source (AST census, `compiler-sfc`), **[Doc]** = design doc, **[Obs]** = observed in headless Chromium at 1280x800, light, `localStorage` default.
Scripts and raw data are in the same folder: `census.mjs`/`census.json` (per-file AST census), `props.mjs`/`props.json` (variant counts), `routemap2.mjs`/`routemap2.json` (route to component), `build-table.mjs` + `gen-table.mjs` (per-screen table), `browse.mjs` + `browse-*.json` (DOM probe), `shots/` (screenshots).

## Headline (read this first)

1. **The lint says "clean" because it is blind or lenient, not because the screens are consistent.** ESLint over `src` = 0 errors / 77 warnings; but (a) 68 `.vue` files (27 shell files, all 15 `m28-bijak-spm/admin/**` files = the whole admin Kertas & SPM authoring group, 12 other module files in m02/m03/m04/m14, 14 legacy `src/components`, `src/pages`, `App.vue` files) are **not in `config/ds-strict.json`**, so no DS rule runs on them; (b) the `page` level still **allows** hand-written layout, type-scale, spacing and colour-token utilities (ds:debt: 6,647 layout / 3,963 spacing / 3,152 type / 716 surface tokens); (c) 85 module `.vue` files are matched by a `ds`-level glob, which re-allows radius/shadow/gradient/font on them.
2. **The two project lint scripts do not run as shipped**: `npm run lint:ds` aborts ("The command line is too long."), `npm run lint:ds:css` crashes with `ENOTDIR` on a brace glob in `config/ds-strict.json:138`. The ds:debt ratchet unit test **fails** on this branch (4 raised counts, 59 new debt entries = the `m28-bijak-spm/admin` files, 5 stale). See section B.
3. **Where the user sees "tak consistent" is mostly inside the DS/theme itself**, not custom CSS: Nuxt UI `size="xl"` is used 96x on `UButton`, 21x on `UInput`, 12x on `USelect` and 12x on `UBadge`, but `ui.config.ts` themes only xs/sm/md/lg for button and md/lg for input/select, so xl renders with stock sizing; the same role (primary page action, row action, KPI strip, card, status badge) is built with 3-5 different DS/Nuxt UI recipes (section E).

---

## A. DS rules (what is allowed / forbidden) with citations

| # | Rule | Source |
|---|---|---|
| A1 | Pages import UI only from Nuxt UI (`U*`) and the DS (`Ds*` in `src/ds`); no `@lucide/vue`, `@iconify-json/*`, `@fontsource/*`, `chart.js`, `@/components/*` (legacy), shell internals. | `docs/design/v2-design-system.md:544` (G-6); enforced `eslint.config.ts:177-205`, `DS_IMPORT_PATTERNS`, `DS_PAGE_ONLY_IMPORTS` |
| A2 | **No raw `<button> <input> <select> <textarea> <a> <table> <thead> <tbody> <tr> <th> <td> <dialog> <img>`** in pages (use `UButton`, `UInput`, `USelect`/`DsNativeSelect`, `UTextarea`, `ULink`, `UTable`/`DsDataTable`, `UModal`/`DsDialog`, `UAvatar`/`DsArt3D`). Layout elements allowed. In `ds`-level files `<a>`/`<img>` are allowed. | `v2-design-system.md:543` (G-5); `eslint.config.ts:206-222` (`RAW_ELEMENT_NAMES`), blocks `eslint.config.ts:320-358` |
| A3 | Page-level class allowlist: layout utilities, spacing steps 0-16, type-scale `text-display..text-overline`, colour tokens, `i-ph-*`. **Banned**: arbitrary values `[..]`/`(--x)`, palette/hex colours, stock `text-xs..9xl`, `rounded-*`, `shadow-*`, `bg-gradient-*`/`from-/via-/to-`, `z/animate/transition/duration/ease/opacity`, `font-*/leading/tracking/uppercase`, `border/divide/ring/outline`. | `v2-design-system.md:538-541` (G-1, G-2, G-3, G-3b); `eslint/class-allowlist.mjs` (`PAGE_ONLY_BANNED`, `ALWAYS_BANNED`, `PALETTE_RE`) |
| A4 | No `<style>` block, no `style=` / `:style=` in pages; dynamic values via props. | `v2-design-system.md:542` (G-4); rules `pp/ds-no-style-block`, `pp/ds-no-inline-style` |
| A5 | Colour, radius, shadow, font, motion, icon weight are decided in `tokens.css` / `ui.config.ts` only; no hex/rgb outside `src/theme`. Stylelint: `color-no-hex`, `color-named`, no colour functions, no `border*`/`outline*` properties, no `!important`, no `@import`. | `v2-design-system.md:545` (G-7); `stylelint.config.mjs` |
| A6 | "Pages compose; they do not style." No type, colour, spacing, radius, shadow or motion decision in a page or domain component; typed variants only; the theme owns state and shape; **fix at the highest lever**; escape hatches (`class`, `:ui`, `.ts` class constants, `ds`-level module exemptions) are counted and must shrink. | `docs/design/v2-ds-hardening.md:66-73` (H1-H7); central levers `:48-57` |
| A7 | Target stage-1 rules (not yet in force): `ds-no-type-utility`, `ds-no-spacing-utility`, `ds-no-surface-utility`, `ds-no-colour-utility`, `ds-no-ui-prop`, `ds-no-class-on-ds`, `ds-no-class-literal-in-ts`; page allowlist reduced to `min-w-0 w-full h-full grow shrink-0 mx-auto display-toggles sr-only`. Debt measured by `npm run ds:debt` against `config/ds-debt.baseline.json`. | `v2-ds-hardening.md:577-640` (6.1-6.4), `:810-820` (exit criteria) |
| A8 | 40 `ds`-level module exemptions must be reduced to 0 / promoted (`ds-promote.json`) / share-print scopes. | `v2-ds-hardening.md:636` (6.4 step 5), `:818` (criterion 5) |
| A9 | One implementation per building block, in `src/ds`: `DsFormField`, `DsFormSection`, `DsFormBar`, `DsRowActions`, `DsActiveFilters`, `DsBackLink`, `DsStatusBadge`, `DsPageHeader`, `DsBreadcrumb`, `DsPillNav`, `DsStatRow`/`DsStatTile`, `DsDataTable`, `DsFilterBar`, `DsLoadError`, `DsEmptyState`, `DsFileField`. Local copies were listed for deletion. | `docs/design/v2-ds-consolidation.md` section 2 (2.1-2.7). Status now: the local copies in 2.1-2.7 are gone; only domain wrappers (`CcTable`, `ItemTable`, `ClassTable`, `MonthlyTable`, `HeadcountTable`, `TopTenTable`) remain. |
| A10 | Cozy density: 44px controls minimum on staff pages, 56px table rows, 20-24px card padding; radius strictly smaller than the container's (nesting rule); layers not lines. | `docs/design/v2-design-language.md` P4 (line 25), P7 (28), nesting rule (116); `v2-design-system.md:448` (density scale) |
| A11 | Copy: BM, one vocabulary (Set Semula, Simpan, Batal, Padam, "Edit" kept as live word; status words per section 4); English words only where live said so. | `docs/design/v2-copy-glossary.md:28-42`, `:73`, `:142-153` (C1, C10-C12) |
| A12 | Admin list page archetype: header row (subtitle + primary action), KPI strip of `DsStatTile`, filter toolbar in `DsPanel`, `DsDataTable dense`, native filter selects, one empty/error pattern. | `docs/design/v2-admin-pages.md` section 3 |

---

## B. Lint outputs (real)

### B1. `npm run lint:ds` (exit 1, tool failure)
```
> node scripts/lint-ds.mjs
The command line is too long.
node:internal/modules/run_main:123 ... [Error: ENOTDIR: not a directory, scandir '...\src\modules\m08-student-performance\components\LeaderboardPodium.vue']
  errno: -4052, code: 'ENOTDIR', syscall: 'scandir'
```
Cause [Code]: `scripts/lint-ds.mjs:16-21` passes all 215 strict globs as one `spawnSync(..., {shell:true})` command line, which exceeds the Windows `cmd` limit; the second step (`lint-ds-css.mjs`) then fails as in B2. Full text: `lint-ds.txt`.

### B2. `npm run lint:ds:css` (exit 1, tool failure)
```
Error: ENOTDIR: not a directory, scandir '...\src\modules\m08-student-performance\components\LeaderboardPodium.vue'
```
Cause [Code]: `config/ds-strict.json:138` is the brace glob `src/modules/m08-student-performance/components/{LeaderboardPodium.vue,timeline/**}`; `styleGlobs()` in `eslint/ds-strict.mjs` appends `/**/*.{css,vue}` to anything not ending in `.css|.vue`, producing a path that treats `LeaderboardPodium.vue` as a directory. Full text: `lint-ds-css.txt`.

### B3. Equivalent runs that do work (this audit)
| Run | Command | Result |
|---|---|---|
| ESLint, whole tree (applies strict blocks per `ds-strict.json`) | `npx eslint src --format json` (3 min 34 s; `eslint-src.json`) | 2,472 files, **0 errors, 77 warnings**: `pp/ds-no-dynamic-class` 69 (47 files; top `m08 .../headcount/StudentSection.vue` 5, `m21 .../MohonKeluargaAngkatPage.vue` 4, `m11 .../MonitoringSignals.vue` 3, `m17 .../DailySchoolsPanel.vue` 3, `m25 .../CikguPakarBlock.vue` 3), `vue/one-component-per-file` 8 (tests: `src/test-support/form-stubs.ts` 6, `src/ds/__tests__/primitives/DsSurface.test.ts` 2) |
| Stylelint API, `page` config over `src/**/*.{css,vue}` (ignore `src/theme/**`, tests) and `ds` config over `src/ds/**` (`stylelint-all.json`) | `css-lint.mjs` | page: 8 files / 467 warnings: `src/styles/theme.css` 300 (282 `color-no-hex`, 18 colour functions), `src/shells/user/user-shell.css` 100, `src/styles/live-globals.css` 35, `src/shells/admin/admin-shell.css` 12, `src/styles/main.css` 10 (`@import`), `src/styles/fonts.css` 4, `src/shells/user/UserHeader.vue` 5, `src/ds/states.css` 1. ds: **1 warning in a strict file**: `src/ds/states.css:13` `outline: none` (rule `property-disallowed-list`, G-3b). So `lint:ds:css` would FAIL on this one warning even if the script ran. |
| `npm run ds:debt` (`ds-debt.txt`, `ds-debt.json`) | scanner, 1,713 files | type 3,152 (502 files: role 2,270, typography 350, weight 306, stock-size 226); spacing 3,963 (560 files: gap 2,570, mt 399, p 237, px 172, py 166, off-step 109); surface 716 (164 files: radius 235, bg 209, lines 110, motion 78, shadow 58, gradient 26); colour 2,945 (509 files: token 2,620, **palette 270, arbitrary 28, opacity 27**); layout 6,647 (552 files); ui-prop 82 (51 files); class-on-ds 85 (31 files); class-literal-in-ts 804 (101 files; `src/shells/nav/user-nav.ts` 320) |
| ds:debt ratchet unit test (`vitest run --project unit eslint/__tests__/ds-debt-ratchet.test.mjs`, `ds-debt-ratchet.txt`) | 8 tests | **3 failed, 5 passed**. Raised: `src/shells/pembelajaran/PembelajaranLayout.vue` type 29->30 and colour 27->28, `src/modules/m05-practice/pages/StructuredAnswerPage.vue` spacing 17->21, `src/shells/nav/user-nav.ts` ts-literal 319->320. **59 new files with debt, all `src/modules/m28-bijak-spm/admin/**`** (`intake/*`, `papers/*`: e.g. `IntakeReviewPage.vue` spacing 46 / layout 64 / surface 25, `QuestionEditor.vue` type 29 / spacing 32 / layout 55). 5 stale baseline entries (`m28-bijak-spm/components/MathField.vue`, `MathKeyboard.vue` now clean). |
| `ds-strict-ratchet`, `ds-stylelint`, `ds-rules` unit tests | 337 tests | pass |
| `npm run report:e2e-class-selectors` (`e2e-class-selectors.txt`) | e2e specs that select by CSS class | 137 specs, 62 with class selectors, **329 hits** (top: `m08` 46, `m06-spm` 38, `m27` 38, `m12` 33, `m13` 28). These specs will break when classes are replaced by DS props. |

### B4. What the lint does NOT cover [Code]
- `config/ds-strict.json` (215 entries: 175 `page`, 40 `ds`) has **no entry** for `src/modules/m28-bijak-spm/admin/**` (15 .vue: every `/admin/spm/**` screen except the student-facing ones; `m28-bijak-spm/pages|components` ARE strict), `src/shells/**` (27 .vue), `src/components/**`, `src/pages/**`, 12 files under `m02/m03/m04/m14` (list in section D, pattern P1). Non-strict .vue files: **68 of 744** scanned.
- Effective level per module `.vue`: 507 `page`, 85 `ds` (re-allows radius/shadow/gradient/font/opacity), 27 none. Module **pages** at ds-level: `m02 JemputIbuBapaPage`, `m03 LearningMapPage / TopicDetailPage / TopicsPage`, `m13 ChatPage`, `m21 MohonKeluargaAngkatPage`, `m25 HeatmapTopikLemahPage`.
- Tailwind class literals inside `.ts` helpers (804) and `:ui="{..}"` overrides (82 by ds:debt, 89 by AST) are only counted, never failed.


---

## C. Per-screen table

Scope: every route record that resolves to a `.vue` component (257 records, 256 after dropping one duplicate, 241 unique page components). Each row aggregates the page file **plus all local `.vue` components it imports (transitively)**, so a violation in a shared child shows on every screen that renders it. Route paths come from `routes.ts`/`routes/*.ts` (`routemap2.json`); `:id(\\d+)` is the literal route pattern.

Result: **155 of 256 route records have at least one hard finding (148 of 241 unique page components)**; priority split P1 (score >= 30) 11, P2 (10-29) 21, P3 (1-9) 123, clean 101. The 15 `m28-bijak-spm/admin` files sit under 10 route records; of the 35 routes in the user-audited groups (`/admin/spm/**`, `/admin/questions/**`, `/admin/pksk/**`, `/spm/**`) **25 have findings**.

**10 worst screens (user-facing, by score; dev/e2e harnesses excluded)**

| # | Route | Component | Score | Main reasons |
|---|---|---|---|---|
| 1 | `/admin/school-subscriptions/:id/renewal-invoice` | `m02 RenewalInvoicePage.vue` | 167.0 | raw `<table>` (`:183`) + 2 raw `<button>` (`:71,91`) + class constants `TH`/`TD` (`:61-62`), 39 palette classes, 3 arbitrary, 21 stock sizes, 27 weights, 23 `border` lines; print sheet outside any DS scope token |
| 2 | `/gamification/kad-kongsi` | `m14 KadKongsiPage.vue` (+ `Kad*Card`) | 137.5 | 40 palette classes (`from-indigo-500 via-violet-500`, `text-white`), 11 stock sizes; share cards not in a scope; "Muat Turun" lime-on-pale-lime contrast |
| 3 | `/admin/spm/soalan/ekstrak/:batchId` | `m28 admin IntakeReviewPage.vue` (+ `QuestionEditor`, `SchemeEditor`) | 119.5 | 4 raw `<button>`/`<img>`, 22 raw `<label>` (QuestionEditor 13, SchemeEditor 5, page 4), 4 arbitrary grid templates, 5 opacity tints, 45 stock sizes, 11 `UButton` combos, radius 32/24px nested in 16px panel; outside lint |
| 4 | `/admin/spm/soalan/:qid/sunting` | `m28 admin BankEditPage.vue` (+ editors) | 59.0 | raw `<input>`/`<label>`, 3 arbitrary, 29 stock sizes, 8 `UButton` combos; outside lint |
| 5 | `/admin/questions/create` | `m04 QuestionCreatePage.vue` (+ `ArabicKeyboardPanel`) | 50.0 | 8 raw `<button>` + inline `style` in `ArabicKeyboardPanel.vue:93 (style), 99-146+ (button)`; component outside lint |
| 6 | `/admin/questions/:id/edit` | `m04 QuestionEditPage.vue` | 50.0 | same as #5 |
| 7 | `/register` | `m01 RegisterPage.vue` | 33.0 | `DsPanel` + `UCard` mixed, 12 class-on-Ds, English labels ("Alamat Email", "No. Telefon (Pilihan)") |
| 8 | `/gamification/achievements` | `m14 AchievementsPage.vue` | 32.5 | `AchievementShareModal` 7 palette + 10 stock sizes; 4 `UButton` combos |
| 9 | `/login` | `m01 LoginPage.vue` | 23.0 | `AuthLayout` 12 class-on-Ds, gradients/opacity tints; 40px inputs r12 16px vs 44px r8 elsewhere |
| 10 | `/permainan/tembak-jawapan` | `m16 SoloTembakJawapanPage.vue` | 19.0 | 5 `UButton` combos, 4 `:ui`, English label |

Ranking by user-audited group: `/admin/spm/soalan/ekstrak/:batchId` 119.5, `/admin/spm/soalan/:qid/sunting` 59.0, `/admin/questions/create` and `/edit` 50.0, `/spm/bijak/percubaan/:attemptId` 12.5, `/admin/spm/soalan` 12.0, `/admin/spm/kertas/:id` 12.0, `/admin/spm/semakan/:key` 11.0 (see C1).

Columns: **Raw controls** = `button/input/select/textarea/table/dialog` in the template AST (examples `file:tag@line`); **Hard-coded colours** = palette classes + hex in template/script (examples `class@line`); **Arbitrary values** = `[..]`/`(--x)` classes (+ opacity modifiers like `bg-warning/10`); **Custom classes** = class tokens defined in project CSS/`<style>` (not Tailwind/DS) and `N/M files outside lint` = how many of the M files in the page tree are not covered by `ds-strict.json`; **Inconsistent variants / other** = mixed card kinds (`UCard`+`DsPanel`/`DsSurface`), mixed table kinds, `UButton` combo count (>= 4), English labels, `<style>`/inline style, stock `text-xs..xl`, radius/shadow/gradient/lines, `font-weight`, `:ui`, class on `Ds*`, number of files at `ds`-level lint, plus the ds:debt hand-styling totals `t`ype / `s`pacing / `su`rface.


### C0. Shell components (apply to every screen of the role; none is in `ds-strict.json`)

| Shell file | Used for | Raw controls | Hard-coded colours (palette / hex) | Arbitrary values | Custom classes | Other | Score |
|---|---|---|---|---|---|---|---|
| user/UserHeader.vue | legacy (non-prototype roles / unscoped build) | 2 | 36 / 3 | 4 | 15 (topbar@46; coin-pill@85; smooth-hover@85; coin-pill@92) | inline style x1; stock text-xs..xl x33; radius/shadow/gradient/lines 4/0/1/2; font-weight x17; ds:debt 50t/26s/14su | 156.0 |
| pembelajaran/PembelajaranLayout.vue | LIVE (student, teacher, school admin) | 3 | 0 / 0 | 2 | 0 | <style> x1; radius/shadow/gradient/lines 18/3/5/2; font-weight x12; :ui x9; ds:debt 30t/46s/41su | 54.0 |
| user/UserNavList.vue | legacy (non-prototype roles / unscoped build) | 1 | 9 / 1 | 1 | 9 (drawer-section-label@69; drawer-nav-item@99; drawer-nav-item@115; bg-command-gradient@129) | inline style x1; stock text-xs..xl x8; radius/shadow/gradient/lines 6/0/3/0; font-weight x9; ds:debt 19t/25s/10su | 51.0 |
| user/UserDrawer.vue | legacy (non-prototype roles / unscoped build) | 1 | 10 / 0 | 3 | 5 (mobile-drawer-overlay@45; mobile-drawer@53; pp-hit@63; drawer-nav-item@93) | stock text-xs..xl x1; radius/shadow/gradient/lines 3/0/1/8; font-weight x2; ds:debt 4t/10s/13su | 47.0 |
| admin/AdminNavList.vue | legacy (non-prototype roles / unscoped build) | 1 | 7 / 1 | 1 | 2 (nav-item@83; bg-command-gradient@98) | inline style x1; stock text-xs..xl x6; radius/shadow/gradient/lines 3/0/2/0; font-weight x9; ds:debt 18t/24s/6su | 42.5 |
| dev/ShellPreviewPicker.vue | dev preview | 2 | 9 / 0 | 0 | 0 | stock text-xs..xl x1; radius/shadow/gradient/lines 2/2/0/0; font-weight x4; ds:debt 5t/10s/4su | 33.0 |
| public/PublicCta.vue | LIVE (public/auth pages) | 0 | 6 / 0 | 0 | 1 (bg-primary-gradient@38) | inline style x1; stock text-xs..xl x10; radius/shadow/gradient/lines 2/3/0/0; font-weight x4; ds:debt 14t/17s/7su | 31.5 |
| user/ImpersonationBanner.vue | legacy (non-prototype roles / unscoped build) | 1 | 5 / 0 | 1 | 0 | <style> x1; stock text-xs..xl x2; radius/shadow/gradient/lines 1/0/0/5; font-weight x2; ds:debt 4t/5s/7su | 31.0 |
| admin/AdminSidebar.vue | legacy (non-prototype roles / unscoped build) | 0 | 7 / 0 | 0 | 3 (sidebar@28; nav-item@53; avatar-ring@72) | stock text-xs..xl x4; radius/shadow/gradient/lines 2/0/0/4; font-weight x4; ds:debt 9t/15s/8su | 26.0 |
| admin/AdminLagiPopover.vue | legacy (non-prototype roles / unscoped build) | 0 | 6 / 0 | 2 | 0 | radius/shadow/gradient/lines 1/1/0/4; font-weight x3; ds:debt 4t/5s/7su | 25.0 |
| public/PublicTopBar.vue | LIVE (public/auth pages) | 0 | 6 / 0 | 0 | 1 (bg-cta-gradient@60) | stock text-xs..xl x5; radius/shadow/gradient/lines 2/3/0/2; font-weight x4; ds:debt 9t/16s/10su | 25.0 |
| dev/PreviewHub.vue | dev preview | 0 | 5 / 0 | 0 | 0 | stock text-xs..xl x3; radius/shadow/gradient/lines 2/2/0/7; font-weight x4; ds:debt 8t/9s/11su | 24.0 |
| user/UserBottomNav.vue | legacy (non-prototype roles / unscoped build) | 1 | 0 / 0 | 3 | 1 (bottom-nav@33) | inline style x2; radius/shadow/gradient/lines 0/0/0/0; font-weight x2; ds:debt 4t/6s/1su | 21.5 |
| admin/AdminBottomNav.vue | legacy (non-prototype roles / unscoped build) | 1 | 5 / 0 | 1 | 1 (bottom-nav@28) | radius/shadow/gradient/lines 0/1/0/2; ds:debt 0t/3s/4su | 21.0 |
| user/UserSidebar.vue | legacy (non-prototype roles / unscoped build) | 0 | 6 / 0 | 0 | 3 (sidebar@30; user-card@50; avatar-ring@52) | stock text-xs..xl x3; radius/shadow/gradient/lines 2/0/0/0; font-weight x3; ds:debt 6t/10s/7su | 20.0 |
| admin/AdminHeader.vue | legacy (non-prototype roles / unscoped build) | 0 | 5 / 0 | 0 | 2 (topbar@35; avatar-ring@59) | stock text-xs..xl x4; radius/shadow/gradient/lines 2/0/0/2; font-weight x2; ds:debt 6t/7s/6su | 19.0 |
| pentadbiran/PentadbiranLayout.vue | LIVE (admin) | 1 | 0 / 0 | 0 | 0 | radius/shadow/gradient/lines 6/0/2/0; font-weight x6; :ui x6; ds:debt 13t/13s/13su | 16.5 |
| public/PublicFooter.vue | LIVE (public/auth pages) | 0 | 5 / 0 | 0 | 0 | stock text-xs..xl x2; radius/shadow/gradient/lines 1/0/0/2; font-weight x1; ds:debt 3t/8s/4su | 15.5 |
| dev/ShellPreviewAdmin.vue | dev preview | 0 | 5 / 0 | 0 | 0 | stock text-xs..xl x2; radius/shadow/gradient/lines 1/1/0/0; font-weight x3; ds:debt 5t/6s/2su | 14.5 |
| dev/ShellPreviewPage.vue | dev preview | 0 | 5 / 0 | 0 | 0 | stock text-xs..xl x2; radius/shadow/gradient/lines 1/1/0/0; font-weight x3; ds:debt 5t/6s/2su | 14.5 |
| admin/AdminServerStatus.vue | legacy (non-prototype roles / unscoped build) | 0 | 2 / 0 | 1 | 0 | radius/shadow/gradient/lines 1/0/0/4; font-weight x1; ds:debt 1t/3s/5su | 12.0 |
| admin/AdminShell.vue | legacy (non-prototype roles / unscoped build) | 0 | 2 / 0 | 1 | 2 (admin-shell@96; bg-app-admin@96) | stock text-xs..xl x1; radius/shadow/gradient/lines 0/0/0/0; font-weight x3; ds:debt 4t/8s/1su | 10.0 |
| user/UserShell.vue | legacy (non-prototype roles / unscoped build) | 0 | 1 / 0 | 1 | 7 (user-shell@126; bg-app-user@126; topbar@165; footer-text@166) | stock text-xs..xl x1; radius/shadow/gradient/lines 0/0/0/0; font-weight x3; ds:debt 4t/11s/2su | 8.5 |
| shared/ModPelajarBanner.vue | LIVE (shared by shells) | 1 | 0 / 0 | 0 | 0 | radius/shadow/gradient/lines 1/0/0/0; font-weight x1; ds:debt 3t/6s/3su | 7.5 |
| public/PublicLayout.vue | LIVE (public/auth pages) | 0 | 0 / 0 | 0 | 1 (bg-app-user@37) | radius/shadow/gradient/lines 0/0/0/0; font-weight x1; ds:debt 1t/4s/0su | 0.5 |
| shared/NavIcon.vue | LIVE (shared by shells) | 0 | 0 / 0 | 0 | 1 (pp-icon@17) | radius/shadow/gradient/lines 0/0/0/0; ds:debt 0t/0s/0su | 0.0 |
| shared/ShellLink.vue | LIVE (shared by shells) | 0 | 0 / 0 | 0 | 0 | radius/shadow/gradient/lines 0/0/0/0; ds:debt 0t/0s/0su | 0.0 |


### C1. Screens the user audited (admin Kertas & SPM, Bank Soalan, PKSK; student Bijak SPM / SPM) (35 routes)

| Route | Component file | Raw controls | Hard-coded colours | Arbitrary values | Custom classes | Inconsistent variants / other | Score / priority |
|---|---|---|---|---|---|---|---|
| `/admin/spm/soalan/ekstrak/:batchId` | m28-bijak-spm/admin/intake/pages/IntakeReviewPage.vue | 4 (IntakeReviewPage.vue:button@363; IntakeReviewPage.vue:button@386; IntakeReviewPage.vue:button@611) | 0 | 4 (IntakeReviewPage.vue:lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]@426; QuestionEditor.vue:@lg:grid-cols-[6rem_minmax(0,1fr)_6rem]@252; SchemeEditor.vue:grid-cols-[auto_minmax(0,1fr)_auto]@148) +5 opacity-mod (IntakeReviewPage.vue:bg-warning/10@363; IntakeReviewPage.vue:bg-success/10@363) | 0; 3/5 files outside lint (ds-strict) | UButton combos:11; stock text-xs..xl x45; radius/shadow/gradient/lines x16/0/0/19; font-weight x21; 2 file(s) at ds-level lint; hand-styling ds:debt 68t/99s/42su | 119.5 P1 |
| `/admin/spm/soalan/:qid/sunting` | m28-bijak-spm/admin/papers/BankEditPage.vue | 1 (QuestionEditor.vue:input@210) | 0 | 3 (QuestionEditor.vue:@lg:grid-cols-[6rem_minmax(0,1fr)_6rem]@252; SchemeEditor.vue:grid-cols-[auto_minmax(0,1fr)_auto]@148; SchemeEditor.vue:@lg:grid-cols-[6rem_5rem_minmax(0,1fr)_auto]@148) +1 opacity-mod (SchemeEditor.vue:bg-elevated/40@142) | 0; 3/5 files outside lint (ds-strict) | UButton combos:8; stock text-xs..xl x29; radius/shadow/gradient/lines x7/0/0/6; font-weight x11; 2 file(s) at ds-level lint; hand-styling ds:debt 42t/53s/17su | 59.0 P1 |
| `/admin/questions/create` | m04-question-bank/pages/QuestionCreatePage.vue | 8 (ArabicKeyboardPanel.vue:button@99; ArabicKeyboardPanel.vue:button@112; ArabicKeyboardPanel.vue:button@124) | 0 | 0 | 0; 1/5 files outside lint (ds-strict) | UButton combos:4; inline style x1; radius/shadow/gradient/lines x3/1/0/0; font-weight x2; :ui x3; class-on-Ds x2; hand-styling ds:debt 15t/47s/18su | 50.0 P1 |
| `/admin/questions/:id(\\d+)/edit` | m04-question-bank/pages/QuestionEditPage.vue | 8 (ArabicKeyboardPanel.vue:button@99; ArabicKeyboardPanel.vue:button@112; ArabicKeyboardPanel.vue:button@124) | 0 | 0 | 0; 1/5 files outside lint (ds-strict) | UButton combos:4; inline style x1; radius/shadow/gradient/lines x3/1/0/0; font-weight x2; :ui x3; class-on-Ds x2; hand-styling ds:debt 15t/47s/18su | 50.0 P1 |
| `/spm/bijak/percubaan/:attemptId` | m28-bijak-spm/pages/AttemptPage.vue | 0 | 0 | 0 +1 opacity-mod (QuestionBlock.vue:opacity-70@62) | 0 | cards:UCard+DsSurface; UButton combos:12; radius/shadow/gradient/lines x12/1/0/0; font-weight x5; class-on-Ds x1; 10 file(s) at ds-level lint; hand-styling ds:debt 50t/77s/28su | 12.5 P2 |
| `/admin/spm/soalan` | m28-bijak-spm/admin/papers/BankPage.vue | 0 | 0 | 0 | 0; 2/4 files outside lint (ds-strict) | tables:DsDataTable+UTable; UButton combos:5; EN labels:1; radius/shadow/gradient/lines x6/0/0/2; font-weight x9; :ui x1; 2 file(s) at ds-level lint; hand-styling ds:debt 33t/30s/14su | 12.0 P2 |
| `/admin/spm/kertas/:id` | m28-bijak-spm/admin/papers/PaperEditorPage.vue | 0 | 0 | 0 | 0; 2/4 files outside lint (ds-strict) | UButton combos:7; radius/shadow/gradient/lines x8/0/0/2; font-weight x10; :ui x2; 2 file(s) at ds-level lint; hand-styling ds:debt 40t/48s/18su | 12.0 P2 |
| `/admin/spm/semakan/:key` | m28-bijak-spm/admin/papers/ReviewItemPage.vue | 0 | 0 | 0 | 0; 2/4 files outside lint (ds-strict) | UButton combos:5; radius/shadow/gradient/lines x7/0/0/2; font-weight x10; 2 file(s) at ds-level lint; hand-styling ds:debt 40t/34s/16su | 10.5 P2 |
| `/admin/pksk/questions` | m07-pksk/pages/PkskQuestionListPage.vue | 0 | 0 | 0 | 0 | UButton combos:5; EN labels:4; hand-styling ds:debt 3t/4s/0su | 8.0 P3 |
| `/spm-mock/:id(\\d+)` | m06-spm/pages/MockRunPage.vue | 1 (MockRunPage.vue:input@146) | 0 | 0 | 0 | :ui x1; hand-styling ds:debt 6t/8s/0su | 5.5 P3 |
| `/spm-mock` | m06-spm/pages/MockExamPage.vue | 0 | 0 | 0 | 0 | cards:DsPanel+UCard; EN labels:2; :ui x2; hand-styling ds:debt 7t/13s/0su | 5.0 P3 |
| `/admin/spm/soalan/muat-naik` | m28-bijak-spm/admin/intake/pages/IntakeUploadPage.vue | 0 | 0 | 0 | 0; 2/2 files outside lint (ds-strict) | EN labels:1; stock text-xs..xl x2; font-weight x1; hand-styling ds:debt 3t/4s/0su | 4.5 P3 |
| `/spm-mock/:id(\\d+)/result` | m06-spm/pages/MockResultPage.vue | 0 | 0 | 0 | 0 | cards:UCard+DsPanel; EN labels:1; :ui x3; hand-styling ds:debt 18t/13s/0su | 3.5 P3 |
| `/spm/ramalan` | m06-spm/pages/TrackingAHubPage.vue | 0 | 0 | 0 | 0 | cards:DsPanel+UCard; EN labels:1; :ui x3; hand-styling ds:debt 28t/28s/0su | 3.5 P3 |
| `/admin/pksk/questions/create` | m07-pksk/pages/PkskQuestionFormPage.vue | 0 | 0 | 0 | 0 | EN labels:1; :ui x1; hand-styling ds:debt 0t/4s/0su | 2.5 P3 |
| `/admin/pksk/questions/:id([0-9]+)/edit` | m07-pksk/pages/PkskQuestionFormPage.vue | 0 | 0 | 0 | 0 | EN labels:1; :ui x1; hand-styling ds:debt 0t/4s/0su | 2.5 P3 |
| `/admin/spm/soalan/ekstrak` | m28-bijak-spm/admin/intake/pages/IntakeListPage.vue | 0 | 0 | 0 | 0; 1/1 files outside lint (ds-strict) | EN labels:1; font-weight x1; hand-styling ds:debt 2t/0s/0su | 2.5 P3 |
| `/admin/spm/soalan/manual` | m28-bijak-spm/admin/intake/pages/IntakeManualPage.vue | 0 | 0 | 0 | 0; 2/2 files outside lint (ds-strict) | EN labels:1; hand-styling ds:debt 0t/0s/0su | 2.0 P3 |
| `/admin/spm/kertas/baharu` | m28-bijak-spm/admin/papers/PaperNewPage.vue | 0 | 0 | 0 | 0; 1/1 files outside lint (ds-strict) | radius/shadow/gradient/lines x1/0/0/0; font-weight x1; hand-styling ds:debt 4t/4s/2su | 1.0 P3 |
| `/spm/bijak/percubaan/:attemptId/keputusan` | m28-bijak-spm/pages/ResultPage.vue | 0 | 0 | 0 | 0 | UButton combos:4; radius/shadow/gradient/lines x2/0/0/0; 2 file(s) at ds-level lint; hand-styling ds:debt 28t/33s/4su | 1.0 P3 |
| `/spm` | m06-spm/pages/SpmHubPage.vue | 0 | 0 | 0 | 0 | cards:UCard+DsPanel; :ui x1; hand-styling ds:debt 3t/11s/0su | 0.5 P3 |
| `/spm/tahun-lepas` | m06-spm/pages/DatabankPage.vue | 0 | 0 | 0 | 0 | :ui x1; hand-styling ds:debt 7t/8s/0su | 0.5 P3 |
| `/spm/latih-tubi` | m06-spm/pages/LatihTubiListPage.vue | 0 | 0 | 0 | 0 | :ui x1; hand-styling ds:debt 3t/8s/0su | 0.5 P3 |
| `/spm/ramalan/:code` | m06-spm/pages/TrackingACodePage.vue | 0 | 0 | 0 | 0 | :ui x1; hand-styling ds:debt 9t/13s/0su | 0.5 P3 |
| `/spm/subjektif` | m06-spm/pages/SubjektifPage.vue | 0 | 0 | 0 | 0 | :ui x1; hand-styling ds:debt 3t/11s/0su | 0.5 P3 |
| `/spm/tahun-lepas/:code/quiz` | m06-spm/pages/DatabankQuizPage.vue | 0 | 0 | 0 | 0 | hand-styling ds:debt 0t/0s/0su | 0.0 P0-clean |
| `/spm/latih-tubi/:code` | m06-spm/pages/LatihTubiConfigPage.vue | 0 | 0 | 0 | 0 | hand-styling ds:debt 13t/19s/0su | 0.0 P0-clean |
| `/spm/latih-tubi/:code/quiz` | m06-spm/pages/LatihTubiQuizPage.vue | 0 | 0 | 0 | 0 | hand-styling ds:debt 0t/1s/0su | 0.0 P0-clean |
| `/spm/history` | m06-spm/pages/HistoryPage.vue | 0 | 0 | 0 | 0 | hand-styling ds:debt 5t/8s/0su | 0.0 P0-clean |
| `/admin/pksk/access` | m07-pksk/pages/PkskAccessPage.vue | 0 | 0 | 0 | 0 | hand-styling ds:debt 2t/2s/0su | 0.0 P0-clean |
| `/admin/spm/semakan` | m28-bijak-spm/admin/papers/ReviewQueuePage.vue | 0 | 0 | 0 | 0; 1/2 files outside lint (ds-strict) | 1 file(s) at ds-level lint; hand-styling ds:debt 3t/2s/0su | 0.0 P0-clean |
| `/admin/spm/kertas` | m28-bijak-spm/admin/papers/PaperListPage.vue | 0 | 0 | 0 | 0; 1/1 files outside lint (ds-strict) | hand-styling ds:debt 3t/1s/0su | 0.0 P0-clean |
| `/spm/bijak` | m28-bijak-spm/pages/BijakHubPage.vue | 0 | 0 | 0 | 0 | hand-styling ds:debt 9t/12s/0su | 0.0 P0-clean |
| `/spm/bijak/sejarah` | m28-bijak-spm/pages/HistoryPage.vue | 0 | 0 | 0 | 0 | hand-styling ds:debt 4t/7s/0su | 0.0 P0-clean |
| `/spm/bijak/kertas/:paperId` | m28-bijak-spm/pages/PaperCoverPage.vue | 0 | 0 | 0 | 0 | UButton combos:4; 1 file(s) at ds-level lint; hand-styling ds:debt 6t/14s/0su | 0.0 P0-clean |

### C2. All other screens with findings (score > 0), worst first (130 routes)

| Route | Component file | Raw controls | Hard-coded colours | Arbitrary values | Custom classes | Inconsistent variants / other | Score / priority |
|---|---|---|---|---|---|---|---|
| `/admin/school-subscriptions/:id(\\d+)/renewal-invoice` | m02-users-schools/pages/RenewalInvoicePage.vue | 3 (RenewalInvoicePage.vue:button@71; RenewalInvoicePage.vue:button@91; RenewalInvoicePage.vue:table@183) | 39 (RenewalInvoicePage.vue:bg-white@66; RenewalInvoicePage.vue:text-slate-800@66; RenewalInvoicePage.vue:bg-slate-100@67) | 3 (RenewalInvoicePage.vue:text-[11px]@145; RenewalInvoicePage.vue:text-[11px]@154; RenewalInvoicePage.vue:text-[11px]@164) | 0; 1/1 files outside lint (ds-strict) | tables:table; stock text-xs..xl x21; radius/shadow/gradient/lines x11/0/0/23; font-weight x27; hand-styling ds:debt 53t/46s/38su | 167.0 P1 |
| `/__e2e/report-modal` | m04-question-bank/pages/ReportModalHarnessPage.vue | 8 (ReportModalHarnessPage.vue:button@39; ReportModalHarnessPage.vue:button@48; ReportQuestionModal.vue:button@156) | 32 (ReportModalHarnessPage.vue:bg-white@37; ReportModalHarnessPage.vue:text-slate-500@38; ReportModalHarnessPage.vue:bg-red-500@39) | 0 +1 opacity-mod (ReportQuestionModal.vue:disabled:opacity-50@246) | 1 (); 2/2 files outside lint (ds-strict) | stock text-xs..xl x14; radius/shadow/gradient/lines x9/2/0/18; font-weight x10; hand-styling ds:debt 24t/26s/31su | 148.5 P1 |
| `/gamification/kad-kongsi` | m14-gamification/pages/student-b/KadKongsiPage.vue | 0 | 40 (KadRankingCard.vue:from-blue-800@12; KadRankingCard.vue:to-blue-400@12; KadRankingCard.vue:text-white@12) | 0 | 0; 4/7 files outside lint (ds-strict) | stock text-xs..xl x34; radius/shadow/gradient/lines x17/0/3/2; font-weight x20; 1 file(s) at ds-level lint; hand-styling ds:debt 58t/52s/22su | 137.5 P1 |
| `/__dev/feedback` | components/feedback/gallery/FeedbackGallery.vue | 8 (FeedbackGallery.vue:button@77; FeedbackGallery.vue:button@78; FeedbackGallery.vue:button@86) | 10 (FeedbackGallery.vue:bg-slate-50@50; FeedbackGallery.vue:text-slate-700@70; FeedbackGallery.vue:text-indigo-500@71) | 0 | 1 (); 5/5 files outside lint (ds-strict) | stock text-xs..xl x12; radius/shadow/gradient/lines x1/0/0/0; font-weight x9; hand-styling ds:debt 21t/24s/3su | 78.0 P1 |
| `/register` | m01-authentication/pages/RegisterPage.vue | 0 | 0 | 0 +4 opacity-mod (AuthWelcomePanel.vue:bg-primary-on/15@26; AuthLayout.vue:bg-primary-on/10@36) | 0 | cards:DsPanel+UCard; EN labels:3; radius/shadow/gradient/lines x6/3/2/0; font-weight x4; class-on-Ds x28; 3 file(s) at ds-level lint; hand-styling ds:debt 30t/44s/13su | 33.0 P1 |
| `/__dev/shell` | shells/dev/ShellPreviewPicker.vue | 2 (ShellPreviewPicker.vue:button@48; ShellPreviewPicker.vue:button@58) | 9 (ShellPreviewPicker.vue:bg-slate-50@40; ShellPreviewPicker.vue:text-slate-600@42; ShellPreviewPicker.vue:bg-indigo-600@48) | 0 | 0; 1/1 files outside lint (ds-strict) | stock text-xs..xl x1; radius/shadow/gradient/lines x2/2/0/0; font-weight x4; hand-styling ds:debt 5t/10s/4su | 33.0 P1 |
| `/gamification/achievements` | m14-gamification/pages/student-b/AchievementsPage.vue | 0 | 7 (AchievementShareModal.vue:bg-black/60@37; AchievementShareModal.vue:text-white@47; AchievementShareModal.vue:text-white/90@57) | 0 +1 opacity-mod (AchievementBadgeCard.vue:opacity-60@26) | 0; 1/4 files outside lint (ds-strict) | UButton combos:4; stock text-xs..xl x10; radius/shadow/gradient/lines x4/1/0/2; font-weight x5; 1 file(s) at ds-level lint; hand-styling ds:debt 29t/31s/10su | 32.5 P1 |
| `/admin` | shells/dev/PreviewHub.vue | 0 | 5 (PreviewHub.vue:text-slate-600@20; PreviewHub.vue:bg-white@37; PreviewHub.vue:text-slate-500@42) | 0 | 0; 1/1 files outside lint (ds-strict) | stock text-xs..xl x3; radius/shadow/gradient/lines x2/2/0/7; font-weight x4; hand-styling ds:debt 8t/9s/11su | 24.0 P2 |
| `/dashboard` | shells/dev/PreviewHub.vue | 0 | 5 (PreviewHub.vue:text-slate-600@20; PreviewHub.vue:bg-white@37; PreviewHub.vue:text-slate-500@42) | 0 | 0; 1/1 files outside lint (ds-strict) | stock text-xs..xl x3; radius/shadow/gradient/lines x2/2/0/7; font-weight x4; hand-styling ds:debt 8t/9s/11su | 24.0 P2 |
| `/login` | m01-authentication/pages/LoginPage.vue | 0 | 0 | 0 +4 opacity-mod (AuthWelcomePanel.vue:bg-primary-on/15@26; AuthLayout.vue:bg-primary-on/10@36) | 0 | EN labels:1; radius/shadow/gradient/lines x6/3/2/0; font-weight x4; class-on-Ds x16; 3 file(s) at ds-level lint; hand-styling ds:debt 13t/29s/13su | 23.0 P2 |
| `/permainan/tembak-jawapan` | m16-battle-games/pages/SoloTembakJawapanPage.vue | 0 | 0 | 0 +2 opacity-mod (ResultCard.vue:bg-inverted/60@50; CountdownView.vue:bg-default/95@12) | 0 | UButton combos:5; EN labels:1; radius/shadow/gradient/lines x4/2/1/0; font-weight x12; :ui x4; 4 file(s) at ds-level lint; hand-styling ds:debt 35t/27s/17su | 19.0 P2 |
| `/permainan/betul-salah` | m16-battle-games/pages/SoloBetulSalahPage.vue | 0 | 0 | 0 +3 opacity-mod (SoloBetulSalahPage.vue:bg-default/80@158; ResultCard.vue:bg-inverted/60@50) | 0 | UButton combos:6; radius/shadow/gradient/lines x4/2/1/0; font-weight x12; class-on-Ds x2; 4 file(s) at ds-level lint; hand-styling ds:debt 32t/28s/16su | 17.0 P2 |
| `/permainan/cabaran-kilat` | m16-battle-games/pages/SoloCabaranKilatPage.vue | 0 | 0 | 0 +2 opacity-mod (ResultCard.vue:bg-inverted/60@50; CountdownView.vue:bg-default/95@12) | 0 | UButton combos:4; radius/shadow/gradient/lines x4/2/1/0; font-weight x12; class-on-Ds x2; 4 file(s) at ds-level lint; hand-styling ds:debt 29t/26s/16su | 16.0 P2 |
| `/peta-belajar` | m03-curriculum/pages/LearningMapPage.vue | 0 | 0 | 0 +4 opacity-mod (LearningMapPage.vue:bg-primary-on/15@54; LearningMapPage.vue:bg-primary-on/15@60) | 0 | radius/shadow/gradient/lines x8/4/1/0; font-weight x5; 2 file(s) at ds-level lint; hand-styling ds:debt 18t/24s/18su | 15.0 P2 |
| `/__dev/shell/preview` | shells/dev/ShellPreviewPage.vue | 0 | 5 (ShellPreviewPage.vue:bg-white@23; ShellPreviewPage.vue:text-slate-600@25; ShellPreviewPage.vue:text-slate-600@28) | 0 | 0; 1/1 files outside lint (ds-strict) | stock text-xs..xl x2; radius/shadow/gradient/lines x1/1/0/0; font-weight x3; hand-styling ds:debt 5t/6s/2su | 14.5 P2 |
| `/__dev/shell/admin` | shells/dev/ShellPreviewAdmin.vue | 0 | 5 (ShellPreviewAdmin.vue:bg-white@19; ShellPreviewAdmin.vue:text-slate-600@21; ShellPreviewAdmin.vue:text-slate-600@24) | 0 | 0; 1/1 files outside lint (ds-strict) | stock text-xs..xl x2; radius/shadow/gradient/lines x1/1/0/0; font-weight x3; hand-styling ds:debt 5t/6s/2su | 14.5 P2 |
| `/admin/users` | m02-users-schools/pages/UserListPage.vue | 0 | 0 | 0 | 0 | EN labels:7; hand-styling ds:debt 4t/10s/0su | 14.0 P2 |
| `/headcount/:id([0-9]+)` | m08-student-performance/pages/HeadcountTablePage.vue | 0 | 0 | 0 | 0 | UButton combos:9; EN labels:6; hand-styling ds:debt 9t/20s/0su | 12.0 P2 |
| `/guru/kelas` | m10-teacher-class/pages/KelasListPage.vue | 0 | 4 | 0 | 0 | hand-styling ds:debt 8t/12s/0su | 12.0 P2 |
| `/buku-nota/heatmap` | m25-ai-centre/pages/HeatmapTopikLemahPage.vue | 0 | 0 | 0 +2 opacity-mod (HeatmapSubjectBlock.vue:hover:opacity-80@21; CikguPakarBlock.vue:bg-heat/15@24) | 1 () | radius/shadow/gradient/lines x9/3/0/0; font-weight x4; 5 file(s) at ds-level lint; hand-styling ds:debt 15t/24s/19su | 11.0 P2 |
| `/admin/users/create` | m02-users-schools/pages/UserCreatePage.vue | 0 | 0 | 0 | 0 | EN labels:5; :ui x1; hand-styling ds:debt 19t/44s/0su | 10.5 P2 |
| `/admin/users/:id(\\d+)/edit` | m02-users-schools/pages/UserEditPage.vue | 0 | 0 | 0 | 0 | EN labels:5; :ui x1; hand-styling ds:debt 22t/47s/0su | 10.5 P2 |
| `/topics/:id(\\d+)` | m03-curriculum/pages/TopicDetailPage.vue | 0 | 0 | 0 | 0 | radius/shadow/gradient/lines x6/5/1/0; font-weight x7; 1 file(s) at ds-level lint; hand-styling ds:debt 20t/26s/17su | 10.0 P2 |
| `/gamification` | m14-gamification/pages/GamificationDashboardPage.vue | 0 | 0 | 0 | 0 | EN labels:1; radius/shadow/gradient/lines x4/0/0/0; font-weight x12; 6 file(s) at ds-level lint; hand-styling ds:debt 42t/41s/10su | 10.0 P2 |
| `/password/reset-ic` | m01-authentication/pages/PasswordResetIcPage.vue | 0 | 0 | 0 +1 opacity-mod (AuthBrandStrip.vue:opacity-90@18) | 0 | EN labels:2; radius/shadow/gradient/lines x1/0/1/0; font-weight x2; class-on-Ds x4; 2 file(s) at ds-level lint; hand-styling ds:debt 7t/9s/4su | 9.5 P3 |
| `/practice/chapter/:code/:chapterId(\\d+)/quiz` | m05-practice/pages/ChapterQuizPage.vue | 0 | 1 | 0 | 1 () | UButton combos:4; radius/shadow/gradient/lines x5/0/0/0; font-weight x4; class-on-Ds x1; 3 file(s) at ds-level lint; hand-styling ds:debt 38t/43s/17su | 9.5 P3 |
| `/practice/revision/:code` | m05-practice/pages/RevisionQuizPage.vue | 0 | 1 | 0 | 1 () | UButton combos:4; radius/shadow/gradient/lines x5/0/0/0; font-weight x4; class-on-Ds x1; 3 file(s) at ds-level lint; hand-styling ds:debt 38t/43s/17su | 9.5 P3 |
| `/practice/:code/quiz` | m05-practice/pages/PracticeQuizPage.vue | 0 | 1 | 0 | 1 () | UButton combos:4; radius/shadow/gradient/lines x5/0/0/0; font-weight x4; class-on-Ds x1; 3 file(s) at ds-level lint; hand-styling ds:debt 38t/43s/17su | 9.5 P3 |
| `/remedial/:id` | m05-practice/pages/RemedialQuizPage.vue | 0 | 1 | 0 | 1 () | UButton combos:4; radius/shadow/gradient/lines x5/0/0/0; font-weight x4; class-on-Ds x1; 3 file(s) at ds-level lint; hand-styling ds:debt 43t/48s/17su | 9.5 P3 |
| `/misi-harian/:id` | m05-practice/pages/MissionQuizPage.vue | 0 | 1 | 0 | 1 () | UButton combos:4; radius/shadow/gradient/lines x5/0/0/0; font-weight x4; class-on-Ds x1; 3 file(s) at ds-level lint; hand-styling ds:debt 38t/43s/17su | 9.5 P3 |
| `/set-soalan-saya/:id/jawab` | m05-practice/pages/QuestionSetQuizPage.vue | 0 | 1 | 0 | 1 () | UButton combos:4; radius/shadow/gradient/lines x5/0/0/0; font-weight x4; class-on-Ds x1; 3 file(s) at ds-level lint; hand-styling ds:debt 38t/43s/17su | 9.5 P3 |
| `/permainan/susun-jawapan` | m16-battle-games/pages/SoloSusunJawapanPage.vue | 0 | 0 | 0 +1 opacity-mod (ResultCard.vue:bg-inverted/60@50) | 0 | UButton combos:7; radius/shadow/gradient/lines x3/1/0/0; font-weight x8; :ui x2; 3 file(s) at ds-level lint; hand-styling ds:debt 25t/33s/10su | 9.5 P3 |
| `/mohon-keluarga-angkat` | m21-sponsorship/pages/MohonKeluargaAngkatPage.vue | 0 | 0 | 0 +1 opacity-mod (MohonInfoBox.vue:bg-friend/16@9) | 0 | radius/shadow/gradient/lines x4/2/1/0; font-weight x3; :ui x4; 4 file(s) at ds-level lint; hand-styling ds:debt 18t/27s/9su | 8.5 P3 |
| `/admin/subjects` | m03-curriculum/pages/SubjectListPage.vue | 0 | 0 | 0 | 0; 2/3 files outside lint (ds-strict) | inline style x2; radius/shadow/gradient/lines x2/0/0/0; font-weight x2; hand-styling ds:debt 8t/5s/2su | 8.0 P3 |
| `/password/reset` | m01-authentication/pages/PasswordForgotPage.vue | 0 | 0 | 0 +1 opacity-mod (AuthBrandStrip.vue:opacity-90@18) | 0 | EN labels:1; radius/shadow/gradient/lines x1/0/1/0; font-weight x2; class-on-Ds x4; 2 file(s) at ds-level lint; hand-styling ds:debt 7t/9s/4su | 7.5 P3 |
| `/password/reset/:token` | m01-authentication/pages/PasswordResetPage.vue | 0 | 0 | 0 +1 opacity-mod (AuthBrandStrip.vue:opacity-90@18) | 0 | EN labels:1; radius/shadow/gradient/lines x1/0/1/0; font-weight x2; class-on-Ds x4; 2 file(s) at ds-level lint; hand-styling ds:debt 7t/9s/4su | 7.5 P3 |
| `/admin/subjects/create` | m03-curriculum/pages/SubjectFormPage.vue | 0 | 1 | 0 | 0 | EN labels:2; hand-styling ds:debt 2t/4s/0su | 7.0 P3 |
| `/admin/subjects/:id(\\d+)/edit` | m03-curriculum/pages/SubjectFormPage.vue | 0 | 1 | 0 | 0 | EN labels:2; hand-styling ds:debt 2t/4s/0su | 7.0 P3 |
| `/cikgu` | m13-cikgu-alesa/pages/ChatPage.vue | 0 | 0 | 0 +1 opacity-mod (ChatPage.vue:bg-friend/16@280) | 0 | radius/shadow/gradient/lines x7/2/0/0; font-weight x3; 1 file(s) at ds-level lint; hand-styling ds:debt 10t/18s/13su | 7.0 P3 |
| `/permainan/roda-nasib` | m16-battle-games/pages/RodaNasibPage.vue | 0 | 0 | 0 +1 opacity-mod (PrizeModal.vue:bg-inverted/60@16) | 0 | radius/shadow/gradient/lines x3/2/0/0; font-weight x4; 2 file(s) at ds-level lint; hand-styling ds:debt 12t/11s/9su | 7.0 P3 |
| `/ibu-bapa/terima/:token` | m01-authentication/pages/ParentInviteAcceptPage.vue | 0 | 0 | 0 +1 opacity-mod (InviteValidCard.vue:bg-primary-on/15@42) | 0 | radius/shadow/gradient/lines x3/2/1/0; font-weight x4; 2 file(s) at ds-level lint; hand-styling ds:debt 13t/29s/13su | 6.5 P3 |
| `/topics` | m03-curriculum/pages/TopicsPage.vue | 0 | 0 | 0 | 0 | radius/shadow/gradient/lines x7/3/0/0; font-weight x3; 1 file(s) at ds-level lint; hand-styling ds:debt 11t/19s/16su | 6.5 P3 |
| `${QUESTIONS_LIST_PATH}/:id(\\d+)` | m04-question-bank/pages/QuestionDetailPage.vue | 1 (MarkdownView.vue:table@56) | 0 | 0 | 0; 1/3 files outside lint (ds-strict) | cards:DsPanel+UCard; tables:table; UButton combos:5; :ui x1; class-on-Ds x2; hand-styling ds:debt 31t/50s/0su | 6.5 P3 |
| `/admin/schools` | m02-users-schools/pages/SchoolListPage.vue | 0 | 0 | 0 | 0 | EN labels:3; hand-styling ds:debt 5t/4s/0su | 6.0 P3 |
| `/pusat-ai/spm` | m06-spm/pages/WalkthroughPage.vue | 1 (WalkthroughPage.vue:input@129) | 0 | 0 | 0 | cards:DsPanel+UCard; :ui x2; hand-styling ds:debt 6t/8s/0su | 6.0 P3 |
| `/permainan/kad-memori` | m16-battle-games/pages/SoloKadMemoriPage.vue | 0 | 0 | 0 +1 opacity-mod (ResultCard.vue:bg-inverted/60@50) | 0 | UButton combos:4; radius/shadow/gradient/lines x2/1/0/0; font-weight x5; 2 file(s) at ds-level lint; hand-styling ds:debt 15t/14s/7su | 6.0 P3 |
| `/admin-sekolah/guru` | m27-school-admin/pages/SenaraiGuruPage.vue | 0 | 0 | 0 | 0 | UButton combos:4; EN labels:3; hand-styling ds:debt 1t/4s/0su | 6.0 P3 |
| `/admin-sekolah/guru/:id(\\d+)` | m27-school-admin/pages/EditGuruPage.vue | 0 | 0 | 0 | 0 | EN labels:3; hand-styling ds:debt 4t/13s/0su | 6.0 P3 |
| `/admin-sekolah/pelajar` | m27-school-admin/pages/SenaraiPelajarPage.vue | 0 | 0 | 0 | 0 | UButton combos:4; EN labels:3; hand-styling ds:debt 1t/4s/0su | 6.0 P3 |
| `/admin-sekolah/pelajar/:id(\\d+)` | m27-school-admin/pages/EditPelajarPage.vue | 0 | 0 | 0 | 0 | EN labels:3; hand-styling ds:debt 4t/13s/0su | 6.0 P3 |
| `/dashboard` | m05-practice/pages/DashboardPage.vue | 0 | 0 | 0 | 0 | UButton combos:7; :ui x9; class-on-Ds x1; hand-styling ds:debt 42t/60s/0su | 5.0 P3 |
| `/guru/soalan/cipta` | m10-teacher-class/pages/SumbangSoalanCiptaPage.vue | 0 | 0 | 0 | 0 | UButton combos:4; EN labels:2; class-on-Ds x2; hand-styling ds:debt 34t/51s/0su | 5.0 P3 |
| `/gamification/convert` | m14-gamification/pages/GamificationConvertPage.vue | 0 | 0 | 0 | 0 | UButton combos:4; radius/shadow/gradient/lines x2/0/0/0; font-weight x8; 2 file(s) at ds-level lint; hand-styling ds:debt 25t/17s/5su | 5.0 P3 |
| `/profile/edit` | m01-authentication/pages/ProfileEditPage.vue | 0 | 0 | 0 | 0 | EN labels:2; :ui x1; hand-styling ds:debt 14t/27s/1su | 4.5 P3 |
| `/papan-bijak` | m16-battle-games/pages/PapanBijakPage.vue | 0 | 0 | 0 | 1 () | UButton combos:6; radius/shadow/gradient/lines x3/1/0/0; font-weight x2; :ui x1; 4 file(s) at ds-level lint; hand-styling ds:debt 35t/32s/9su | 4.5 P3 |
| `/admin/schools/create` | m02-users-schools/pages/SchoolFormPage.vue | 0 | 0 | 0 | 0 | EN labels:2; hand-styling ds:debt 0t/6s/0su | 4.0 P3 |
| `/admin/schools/:id(\\d+)/edit` | m02-users-schools/pages/SchoolFormPage.vue | 0 | 0 | 0 | 0 | EN labels:2; hand-styling ds:debt 0t/6s/0su | 4.0 P3 |
| `/admin/question-reports` | m04-question-bank/pages/QuestionReportsPage.vue | 0 | 0 | 0 | 0 | cards:DsPanel+UCard; EN labels:2; hand-styling ds:debt 11t/14s/0su | 4.0 P3 |
| `/admin/structured-questions/:id(\\d+)` | m04-question-bank/pages/StructuredDetailPage.vue | 0 | 0 | 0 | 0 | cards:DsPanel+UCard; EN labels:2; hand-styling ds:debt 9t/15s/0su | 4.0 P3 |
| `/admin/question-submissions` | m04-question-bank/pages/SubmissionListPage.vue | 0 | 0 | 0 | 0 | EN labels:2; hand-styling ds:debt 13t/7s/0su | 4.0 P3 |
| `/admin/audio-kbat/create` | m09-content/pages/AudioSetCreatePage.vue | 0 | 0 | 0 | 0 | EN labels:2; hand-styling ds:debt 1t/6s/0su | 4.0 P3 |
| `${prefix}/sekolah/:schoolId(\\d+)/guru/:userId(\\d+)` | m11-teacher-analytics/pages/MonitoringTeacherPage.vue | 0 | 0 | 0 | 0 | EN labels:2; hand-styling ds:debt 19t/11s/0su | 4.0 P3 |
| `/permainan/jutawan` | m16-battle-games/pages/JutawanPage.vue | 0 | 0 | 0 | 0 | UButton combos:4; radius/shadow/gradient/lines x1/0/0/0; font-weight x3; :ui x3; 1 file(s) at ds-level lint; hand-styling ds:debt 22t/17s/3su | 4.0 P3 |
| `/__ds` | dev/ds/DsGallery.vue | 0 | 0 | 0 | 0 | cards:UCard+DsSurface+DsPanel; tables:DsDrillTable+DsDataTable; UButton combos:12; EN labels:2; hand-styling ds:debt 0t/0s/0su | 4.0 P3 |
| `/__ds/matrix` | dev/ds/DsMatrixApi.vue | 0 | 0 | 0 | 0 | tables:DsDataTable+DsDrillTable; UButton combos:4; EN labels:2; hand-styling ds:debt 0t/0s/0su | 4.0 P3 |
| `/pksk` | m07-pksk/pages/PkskHubPage.vue | 0 | 0 | 0 | 0 | radius/shadow/gradient/lines x2/1/1/0; font-weight x2; 2 file(s) at ds-level lint; hand-styling ds:debt 15t/16s/4su | 3.5 P3 |
| `${prefix}/daily-activity` | m17-admin-dashboard/pages/CommandCenterDailyPage.vue | 0 | 0 | 0 | 0 | UButton combos:6; EN labels:1; radius/shadow/gradient/lines x0/1/0/0; font-weight x1; 1 file(s) at ds-level lint; hand-styling ds:debt 63t/75s/9su | 3.5 P3 |
| `/admin/school-subscriptions/create` | m02-users-schools/pages/SubscriptionCreatePage.vue | 0 | 0 | 0 | 0 | EN labels:1; :ui x2; hand-styling ds:debt 12t/15s/0su | 3.0 P3 |
| `/target-spm` | m05-practice/pages/SpmTargetsPage.vue | 0 | 0 | 0 | 0 | class-on-Ds x6; hand-styling ds:debt 5t/5s/0su | 3.0 P3 |
| `/pksk/level/:level(T1\|T4)` | m07-pksk/pages/PkskDashboardPage.vue | 0 | 0 | 0 | 0 | radius/shadow/gradient/lines x1/1/1/0; :ui x1; 2 file(s) at ds-level lint; hand-styling ds:debt 10t/12s/3su | 2.5 P3 |
| `/prestasi/:userId(\\d+)` | m08-student-performance/pages/Prestasi360Page.vue | 0 | 0 | 0 | 0 | UButton combos:4; EN labels:1; class-on-Ds x1; hand-styling ds:debt 25t/55s/9su | 2.5 P3 |
| `/prestasi/sekolah` | m08-student-performance/pages/PrestasiSekolahPage.vue | 0 | 0 | 0 | 0 | EN labels:1; class-on-Ds x1; hand-styling ds:debt 29t/28s/2su | 2.5 P3 |
| `/timeline/create` | m08-student-performance/pages/TimelineCreatePage.vue | 0 | 0 | 0 | 0 | EN labels:1; radius/shadow/gradient/lines x1/0/0/0; 1 file(s) at ds-level lint; hand-styling ds:debt 6t/12s/3su | 2.5 P3 |
| `/panduan` | m09-content/pages/PanduanPage.vue | 0 | 0 | 0 | 0 | UButton combos:5; radius/shadow/gradient/lines x3/1/0/0; 2 file(s) at ds-level lint; hand-styling ds:debt 18t/41s/10su | 2.5 P3 |
| `/pusat-tuisyen/panduan` | m09-content/pages/PanduanPage.vue | 0 | 0 | 0 | 0 | UButton combos:5; radius/shadow/gradient/lines x3/1/0/0; 2 file(s) at ds-level lint; hand-styling ds:debt 18t/41s/10su | 2.5 P3 |
| `/cikgu/rph/:id(\\d+)` | m13-cikgu-alesa/pages/RphViewPage.vue | 0 | 0 | 0 | 0 | class-on-Ds x5; hand-styling ds:debt 9t/2s/0su | 2.5 P3 |
| `/cikgu/essay/:id(\\d+)` | m13-cikgu-alesa/pages/EssayViewPage.vue | 0 | 0 | 0 | 0 | class-on-Ds x5; hand-styling ds:debt 9t/2s/0su | 2.5 P3 |
| `/cikgu/pbd` | m13-cikgu-alesa/pages/PbdQueuePage.vue | 0 | 0 | 0 | 0 | class-on-Ds x5; hand-styling ds:debt 0t/4s/0su | 2.5 P3 |
| `/${game}/:code` | m16-battle-games/pages/RoomPage.vue | 0 | 0 | 0 | 0 | radius/shadow/gradient/lines x4/0/0/0; font-weight x1; 2 file(s) at ds-level lint; hand-styling ds:debt 25t/30s/5su | 2.5 P3 |
| `/admin/school-subscriptions` | m02-users-schools/pages/SubscriptionListPage.vue | 0 | 0 | 0 | 0 | EN labels:1; hand-styling ds:debt 5t/5s/0su | 2.0 P3 |
| `/admin/users/:id(\\d+)/packages` | m02-users-schools/pages/UserPackagesPage.vue | 0 | 0 | 0 | 0 | EN labels:1; hand-styling ds:debt 5t/12s/0su | 2.0 P3 |
| `/admin/education-levels/create` | m03-curriculum/pages/LevelFormPage.vue | 0 | 0 | 0 | 0 | EN labels:1; hand-styling ds:debt 0t/1s/0su | 2.0 P3 |
| `/admin/education-levels/:id(\\d+)/edit` | m03-curriculum/pages/LevelFormPage.vue | 0 | 0 | 0 | 0 | EN labels:1; hand-styling ds:debt 0t/1s/0su | 2.0 P3 |
| `/laporan-soalan` | m04-question-bank/pages/LaporanSoalanPage.vue | 0 | 0 | 0 | 0 | EN labels:1; hand-styling ds:debt 2t/4s/0su | 2.0 P3 |
| `/practice/progress` | m05-practice/pages/ProgressPage.vue | 0 | 0 | 0 | 0 | class-on-Ds x4; hand-styling ds:debt 11t/10s/0su | 2.0 P3 |
| `/pksk/level/:level(T1\|T4)/domains` | m07-pksk/pages/PkskDomainsPage.vue | 0 | 0 | 0 | 0 | radius/shadow/gradient/lines x1/0/0/0; font-weight x2; :ui x1; 2 file(s) at ds-level lint; hand-styling ds:debt 12t/6s/1su | 2.0 P3 |
| `/headcount` | m08-student-performance/pages/HeadcountListPage.vue | 0 | 0 | 0 | 0 | UButton combos:4; EN labels:1; hand-styling ds:debt 2t/6s/0su | 2.0 P3 |
| `/headcount/dashboard` | m08-student-performance/pages/HeadcountDashboardPage.vue | 0 | 0 | 0 | 0 | EN labels:1; hand-styling ds:debt 5t/9s/0su | 2.0 P3 |
| `/headcount/:id([0-9]+)/summary` | m08-student-performance/pages/HeadcountSummaryPage.vue | 0 | 0 | 0 | 0 | EN labels:1; hand-styling ds:debt 5t/10s/0su | 2.0 P3 |
| `/prestasi/tingkatan` | m08-student-performance/pages/TingkatanPilihPage.vue | 0 | 0 | 0 | 0 | EN labels:1; hand-styling ds:debt 2t/6s/0su | 2.0 P3 |
| `/prestasi/tingkatan/:code` | m08-student-performance/pages/TingkatanPage.vue | 0 | 0 | 0 | 0 | EN labels:1; hand-styling ds:debt 13t/17s/1su | 2.0 P3 |
| `/prestasi/kelas` | m08-student-performance/pages/PrestasiKelasPilihPage.vue | 0 | 0 | 0 | 0 | EN labels:1; hand-styling ds:debt 5t/7s/0su | 2.0 P3 |
| `/leaderboard` | m08-student-performance/pages/LeaderboardPage.vue | 0 | 0 | 0 | 0 | radius/shadow/gradient/lines x1/0/0/0; font-weight x3; 1 file(s) at ds-level lint; hand-styling ds:debt 19t/16s/1su | 2.0 P3 |
| `/timeline` | m08-student-performance/pages/TimelinePage.vue | 0 | 0 | 0 | 0 | radius/shadow/gradient/lines x1/0/0/0; font-weight x2; class-on-Ds x1; 1 file(s) at ds-level lint; hand-styling ds:debt 9t/12s/2su | 2.0 P3 |
| `/admin/articles` | m09-content/pages/AdminArticleListPage.vue | 0 | 0 | 0 | 0 | EN labels:1; hand-styling ds:debt 2t/3s/0su | 2.0 P3 |
| `/admin/articles/:id` | m09-content/pages/AdminArticlePreviewPage.vue | 0 | 0 | 0 | 0 | EN labels:1; hand-styling ds:debt 4t/10s/0su | 2.0 P3 |
| `/admin/notes/:id` | m09-content/pages/AdminNotePreviewPage.vue | 0 | 0 | 0 | 0 | EN labels:1; hand-styling ds:debt 10t/14s/0su | 2.0 P3 |
| `/admin/banners/create` | m09-content/pages/BannerFormPage.vue | 0 | 0 | 0 | 0 | EN labels:1; hand-styling ds:debt 2t/9s/1su | 2.0 P3 |
| `/admin/banners/:id(\\d+)/edit` | m09-content/pages/BannerFormPage.vue | 0 | 0 | 0 | 0 | EN labels:1; hand-styling ds:debt 2t/9s/1su | 2.0 P3 |
| `/admin/audio-kbat` | m09-content/pages/AudioSetListPage.vue | 0 | 0 | 0 | 0 | EN labels:1; hand-styling ds:debt 1t/2s/0su | 2.0 P3 |
| `/admin/tools/screenshots` | m09-content/pages/ScreenshotsPage.vue | 0 | 0 | 0 | 0 | EN labels:1; hand-styling ds:debt 3t/5s/1su | 2.0 P3 |
| `/guru/command-center` | m10-teacher-class/pages/CommandCenterPage.vue | 0 | 0 | 0 | 0 | UButton combos:5; EN labels:1; hand-styling ds:debt 76t/57s/1su | 2.0 P3 |
| `/admin/tiket` | m22-support-tickets/pages/AdminTicketsPage.vue | 0 | 0 | 0 | 0 | EN labels:1; hand-styling ds:debt 2t/1s/0su | 2.0 P3 |
| `/admin-sekolah/guru/baru` | m27-school-admin/pages/CiptaGuruPage.vue | 0 | 0 | 0 | 0 | EN labels:1; hand-styling ds:debt 3t/3s/0su | 2.0 P3 |
| `/admin-sekolah/kelas` | m27-school-admin/pages/KelasSekolahPage.vue | 0 | 0 | 0 | 0 | EN labels:1; hand-styling ds:debt 2t/3s/0su | 2.0 P3 |
| `/misi-harian` | m05-practice/pages/MissionListPage.vue | 0 | 0 | 0 | 0 | class-on-Ds x3; hand-styling ds:debt 4t/2s/0su | 1.5 P3 |
| `/pelajar/:id(\\d+)` | m08-student-performance/pages/PublicProfilePage.vue | 0 | 0 | 0 | 0 | radius/shadow/gradient/lines x1/0/0/0; font-weight x2; 1 file(s) at ds-level lint; hand-styling ds:debt 31t/52s/7su | 1.5 P3 |
| `${prefix}/school/:schoolId(\\d+)` | m17-admin-dashboard/pages/CommandCenterSchoolPage.vue | 0 | 0 | 0 | 0 | radius/shadow/gradient/lines x0/1/0/0; font-weight x1; 1 file(s) at ds-level lint; hand-styling ds:debt 7t/10s/4su | 1.5 P3 |
| `${prefix}/school/:schoolId(\\d+)/teacher/:userId(\\d+)` | m17-admin-dashboard/pages/CommandCenterTeacherPage.vue | 0 | 0 | 0 | 0 | radius/shadow/gradient/lines x0/1/0/0; font-weight x1; 1 file(s) at ds-level lint; hand-styling ds:debt 11t/11s/4su | 1.5 P3 |
| `${prefix}/classroom/:classroomId(\\d+)` | m17-admin-dashboard/pages/CommandCenterClassPage.vue | 0 | 0 | 0 | 0 | radius/shadow/gradient/lines x0/1/0/0; font-weight x1; 1 file(s) at ds-level lint; hand-styling ds:debt 9t/13s/4su | 1.5 P3 |
| `${prefix}/student/:userId(\\d+)` | m17-admin-dashboard/pages/CommandCenterStudentPage.vue | 0 | 0 | 0 | 0 | UButton combos:4; radius/shadow/gradient/lines x0/1/0/0; font-weight x1; 1 file(s) at ds-level lint; hand-styling ds:debt 37t/34s/6su | 1.5 P3 |
| `/prestasi/kelas/:id` | m08-student-performance/pages/PrestasiKelasDetailPage.vue | 0 | 0 | 0 | 0 | class-on-Ds x2; hand-styling ds:debt 13t/16s/1su | 1.0 P3 |
| `/artikel` | m09-content/pages/ArtikelListPage.vue | 0 | 0 | 0 | 0 | radius/shadow/gradient/lines x2/0/0/0; 3 file(s) at ds-level lint; hand-styling ds:debt 6t/10s/2su | 1.0 P3 |
| `${VIDEO_PATH}/:id(\\d+)` | m09-content/pages/VideoDetailPage.vue | 0 | 0 | 0 | 0 | radius/shadow/gradient/lines x1/0/0/0; :ui x1; 1 file(s) at ds-level lint; hand-styling ds:debt 9t/13s/2su | 1.0 P3 |
| `/guru/soalan` | m10-teacher-class/pages/SumbangSoalanPage.vue | 0 | 0 | 0 | 0 | UButton combos:4; class-on-Ds x2; hand-styling ds:debt 30t/71s/0su | 1.0 P3 |
| `/gamification/challenges` | m14-gamification/pages/GamificationChallengesPage.vue | 0 | 0 | 0 | 0 | font-weight x2; 1 file(s) at ds-level lint; hand-styling ds:debt 11t/10s/1su | 1.0 P3 |
| `/${game}` | m16-battle-games/pages/LobbyPage.vue | 0 | 0 | 0 | 0 | UButton combos:4; radius/shadow/gradient/lines x1/0/0/0; :ui x1; 2 file(s) at ds-level lint; hand-styling ds:debt 8t/17s/2su | 1.0 P3 |
| `/permainan/pertandingan` | m16-battle-games/pages/PertandinganPage.vue | 0 | 0 | 0 | 0 | :ui x2; hand-styling ds:debt 25t/14s/1su | 1.0 P3 |
| `/tournament` | m16-battle-games/pages/TournamentListPage.vue | 0 | 0 | 0 | 0 | radius/shadow/gradient/lines x1/1/0/0; 1 file(s) at ds-level lint; hand-styling ds:debt 4t/6s/3su | 1.0 P3 |
| `/admin/soalan-gambar` | m04-question-bank/pages/DiagramAuditPage.vue | 0 | 0 | 0 | 0 | cards:DsPanel+UCard; class-on-Ds x1; hand-styling ds:debt 9t/14s/0su | 0.5 P3 |
| `/practice` | m05-practice/pages/PracticeListPage.vue | 0 | 0 | 0 | 0 | :ui x1; hand-styling ds:debt 5t/7s/0su | 0.5 P3 |
| `/latihan-berstruktur/:id/jawab` | m05-practice/pages/StructuredAnswerPage.vue | 0 | 0 | 0 | 0 | radius/shadow/gradient/lines x1/0/0/0; 1 file(s) at ds-level lint; hand-styling ds:debt 6t/21s/2su | 0.5 P3 |
| `/analitik/pelajar` | m08-student-performance/pages/AnalitikPelajarPage.vue | 0 | 0 | 0 | 0 | class-on-Ds x1; hand-styling ds:debt 20t/32s/0su | 0.5 P3 |
| `/kelas-saya` | m10-teacher-class/pages/KelasSayaPelajarPage.vue | 0 | 0 | 0 | 0 | :ui x1; 1 file(s) at ds-level lint; hand-styling ds:debt 3t/14s/0su | 0.5 P3 |
| `/guru/soalan/:id([0-9]+)` | m10-teacher-class/pages/SumbangSoalanDetailPage.vue | 0 | 0 | 0 | 0 | class-on-Ds x1; hand-styling ds:debt 5t/9s/0su | 0.5 P3 |
| `${prefix}/sekolah/:schoolId(\\d+)` | m11-teacher-analytics/pages/MonitoringSchoolPage.vue | 0 | 0 | 0 | 0 | :ui x1; hand-styling ds:debt 37t/24s/0su | 0.5 P3 |
| `/gamification/history` | m14-gamification/pages/GamificationHistoryPage.vue | 0 | 0 | 0 | 0 | :ui x1; hand-styling ds:debt 9t/8s/1su | 0.5 P3 |
| `/permainan` | m16-battle-games/pages/PermainanPage.vue | 0 | 0 | 0 | 0 | :ui x1; hand-styling ds:debt 9t/12s/0su | 0.5 P3 |
| `/admin-sekolah/laporan-aktiviti` | m27-school-admin/pages/LaporanAktivitiPage.vue | 0 | 0 | 0 | 0 | class-on-Ds x1; hand-styling ds:debt 26t/24s/3su | 0.5 P3 |
| `/admin-sekolah` | m27-school-admin/pages/SchoolDashboardPage.vue | 0 | 0 | 0 | 0 | class-on-Ds x1; hand-styling ds:debt 35t/24s/0su | 0.5 P3 |

### C3 = list (f): screens with zero findings (score 0) (91 routes)

The 10 score-0 routes inside C1 also belong to this list. No raw control, palette/hex colour, arbitrary value, custom class, style block/inline style, stock size or English label in the page tree. They still carry hand-written layout/type/spacing classes (ds:debt column) because lint allows them.

| Route | Component file | Files in tree | ds:debt type / spacing / surface |
|---|---|---|---|
| `/profile` | m01-authentication/pages/ProfilePage.vue | 1 | 3 / 5 / 0 |
| `/tetapan` | m01-authentication/pages/TetapanPage.vue | 2 | 8 / 15 / 0 |
| `${COMP_LIST_PATH}/:id(\\d+)` | m02-users-schools/pages/CompStudentDetailPage.vue | 1 | 20 / 17 / 0 |
| `/admin/school-subscriptions/:id(\\d+)` | m02-users-schools/pages/SubscriptionDetailPage.vue | 1 | 17 / 32 / 0 |
| `${CURRICULUM_PATH}/chapters/create` | m03-curriculum/pages/ChapterCreatePage.vue | 2 | 1 / 3 / 0 |
| `${CURRICULUM_PATH}/chapters/:id/edit` | m03-curriculum/pages/ChapterEditPage.vue | 2 | 1 / 3 / 0 |
| `${CURRICULUM_PATH}/topics/create` | m03-curriculum/pages/TopicCreatePage.vue | 3 | 3 / 6 / 0 |
| `${CURRICULUM_PATH}/topics/:id/edit` | m03-curriculum/pages/TopicEditPage.vue | 3 | 3 / 6 / 0 |
| `/admin/education-levels` | m03-curriculum/pages/LevelListPage.vue | 1 | 2 / 1 / 0 |
| `/admin/master-notes` | m04-question-bank/pages/MasterNotesPage.vue | 2 | 4 / 6 / 0 |
| `/admin/structured-questions` | m04-question-bank/pages/StructuredListPage.vue | 1 | 2 / 2 / 0 |
| `/practice/chapter` | m05-practice/pages/ChapterIndexPage.vue | 1 | 4 / 4 / 0 |
| `/practice/chapter/:code` | m05-practice/pages/ChapterSubjectPage.vue | 2 | 5 / 12 / 0 |
| `/practice/revision` | m05-practice/pages/RevisionListPage.vue | 1 | 4 / 8 / 0 |
| `/practice/:code` | m05-practice/pages/PracticeConfigPage.vue | 1 | 35 / 41 / 0 |
| `/practice/history` | m05-practice/pages/HistoryPage.vue | 1 | 5 / 9 / 0 |
| `/remedial/saya` | m05-practice/pages/RemedialListPage.vue | 1 | 4 / 5 / 0 |
| `/latihan-berstruktur` | m05-practice/pages/StructuredListPage.vue | 1 | 8 / 19 / 0 |
| `/pksk/level/:level(T1\|T4)/history` | m07-pksk/pages/PkskHistoryPage.vue | 1 | 0 / 0 / 0 |
| `/pksk/level/:level(T1\|T4)/domain/:code` | m07-pksk/pages/PkskPracticePage.vue | 2 | 2 / 3 / 0 |
| `/pksk/level/:level(T1\|T4)/exam` | m07-pksk/pages/PkskExamPage.vue | 2 | 3 / 4 / 0 |
| `/analisa-item/sekolah` | m08-student-performance/pages/AnalisaItemSekolahPage.vue | 3 | 29 / 33 / 0 |
| `/analisa-item/sekolah/:id([0-9]+)` | m08-student-performance/pages/AnalisaItemSekolahPage.vue | 3 | 29 / 33 / 0 |
| `/analisa-item/kelas` | m08-student-performance/pages/AnalisaItemKelasPilihPage.vue | 2 | 5 / 7 / 0 |
| `/analisa-item/kelas/:id` | m08-student-performance/pages/AnalisaItemKelasPage.vue | 5 | 34 / 30 / 0 |
| `/analitik/kelas` | m08-student-performance/pages/AnalitikKelasPage.vue | 1 | 4 / 4 / 0 |
| `/headcount/create` | m08-student-performance/pages/HeadcountCreatePage.vue | 1 | 0 / 5 / 0 |
| `/headcount/student/:id([0-9]+)` | m08-student-performance/pages/HeadcountStudentPage.vue | 2 | 11 / 10 / 0 |
| `/headcount/:id([0-9]+)/export` | m08-student-performance/pages/HeadcountExportPage.vue | 1 | 0 / 0 / 0 |
| `/headcount/:id([0-9]+)/results/:n([0-9]+)` | m08-student-performance/pages/HeadcountShellPage.vue | 1 | 0 / 1 / 0 |
| `/headcount/:id([0-9]+)/edit` | m08-student-performance/pages/HeadcountShellPage.vue | 1 | 0 / 1 / 0 |
| `/headcount/:id([0-9]+)/unjuran` | m08-student-performance/pages/HeadcountShellPage.vue | 1 | 0 / 1 / 0 |
| `/headcount/:id([0-9]+)/settings` | m08-student-performance/pages/HeadcountShellPage.vue | 1 | 0 / 1 / 0 |
| `/laporan-mingguan` | m08-student-performance/pages/LaporanMingguanPage.vue | 1 | 0 / 0 / 0 |
| `/ranking` | m08-student-performance/pages/RankingPage.vue | 1 | 13 / 6 / 0 |
| `/admin/articles/create` | m09-content/pages/AdminArticleFormPage.vue | 1 | 0 / 4 / 0 |
| `/admin/articles/:id/edit` | m09-content/pages/AdminArticleFormPage.vue | 1 | 0 / 4 / 0 |
| `/admin/notes` | m09-content/pages/AdminNoteListPage.vue | 1 | 3 / 5 / 0 |
| `/admin/notes/create` | m09-content/pages/AdminNoteFormPage.vue | 1 | 0 / 3 / 0 |
| `/admin/notes/:id/edit` | m09-content/pages/AdminNoteFormPage.vue | 1 | 0 / 3 / 0 |
| `/admin/banners` | m09-content/pages/BannerListPage.vue | 1 | 2 / 2 / 0 |
| `/admin/audio-kbat/template` | m09-content/pages/AudioTemplatePage.vue | 1 | 0 / 0 / 0 |
| `/admin/audio-kbat/template-word` | m09-content/pages/AudioTemplatePage.vue | 1 | 0 / 0 / 0 |
| `/artikel/:slug` | m09-content/pages/ArtikelDetailPage.vue | 4 | 18 / 22 / 0 |
| `/audio-kbat` | m09-content/pages/AudioKbatListPage.vue | 1 | 2 / 3 / 0 |
| `/audio-kbat/:id(\\d+)` | m09-content/pages/AudioKbatPlayerPage.vue | 2 | 8 / 6 / 0 |
| `${VIDEO_PATH}/tambah` | m09-content/pages/VideoFormPage.vue | 2 | 3 / 12 / 1 |
| `${VIDEO_PATH}/:id(\\d+)/edit` | m09-content/pages/VideoFormPage.vue | 2 | 3 / 12 / 1 |
| `/guru` | m10-teacher-class/pages/GuruDashboardPage.vue | 4 | 33 / 42 / 0 |
| `/guru/kelas/cipta` | m10-teacher-class/pages/KelasCreatePage.vue | 2 | 8 / 11 / 0 |
| `/guru/pelajar` | m10-teacher-class/pages/PelajarSayaPage.vue | 2 | 1 / 12 / 0 |
| `/set-soalan-saya` | m10-teacher-class/pages/SetSoalanSayaPage.vue | 2 | 2 / 11 / 0 |
| `/guru/soalan/:id([0-9]+)/edit` | m10-teacher-class/pages/SumbangSoalanEditPage.vue | 1 | 7 / 13 / 0 |
| `/guru/analisis-item` | m11-teacher-analytics/pages/AnalisisItemPage.vue | 3 | 6 / 6 / 0 |
| `/guru/laporan-mingguan-kelas` | pages/PrototypeUnavailablePage.vue | 1 | 0 / 2 / 0 |
| `/guru/laporan` | m11-teacher-analytics/pages/LaporanPage.vue | 6 | 35 / 38 / 3 |
| `${prefix}/sekolah/:schoolId(\\d+)/pelajar/:userId(\\d+)` | m11-teacher-analytics/pages/MonitoringStudentPage.vue | 7 | 59 / 65 / 8 |
| `${mount.prefix}/behavior` | m12-kirkpatrick/pages/KirkpatrickBehaviorPage.vue | 7 | 15 / 9 / 1 |
| `${mount.prefix}/chain` | m12-kirkpatrick/pages/KirkpatrickChainPage.vue | 4 | 10 / 13 / 0 |
| `${mount.prefix}/export-pdf` | m12-kirkpatrick/pages/KirkpatrickChainPdfPage.vue | 4 | 12 / 18 / 0 |
| `${mount.prefix}/interventions` | m12-kirkpatrick/pages/KirkpatrickInterventionsPage.vue | 4 | 2 / 5 / 0 |
| `${mount.prefix}/learning` | m12-kirkpatrick/pages/KirkpatrickLearningPage.vue | 5 | 8 / 5 / 0 |
| `${mount.prefix}/pelajar/:userId(\\d+)` | m12-kirkpatrick/pages/KirkpatrickPelajarPage.vue | 4 | 23 / 12 / 1 |
| `${mount.prefix}/reaction` | m12-kirkpatrick/pages/KirkpatrickReactionPage.vue | 1 | 1 / 1 / 0 |
| `${mount.prefix}/results` | m12-kirkpatrick/pages/KirkpatrickResultsPage.vue | 10 | 41 / 31 / 3 |
| `/cikgu/rph` | m13-cikgu-alesa/pages/RphListPage.vue | 1 | 0 / 1 / 0 |
| `/cikgu/rph/baharu` | m13-cikgu-alesa/pages/RphFormPage.vue | 1 | 0 / 4 / 0 |
| `/cikgu/essay` | m13-cikgu-alesa/pages/EssayListPage.vue | 1 | 0 / 1 / 0 |
| `/cikgu/essay/baharu` | m13-cikgu-alesa/pages/EssayFormPage.vue | 1 | 1 / 1 / 0 |
| `/gamification/leaderboard` | m14-gamification/pages/student-b/LeaderboardPage.vue | 3 | 6 / 7 / 0 |
| `/gamification/referral` | m14-gamification/pages/student-b/ReferralPage.vue | 3 | 13 / 10 / 0 |
| `/cikgu/hadiah` | m15-rewards-shop/pages/DigitalShopPage.vue | 2 | 5 / 7 / 0 |
| `/cikgu/hadiah/saya` | m15-rewards-shop/pages/MyRedemptionsPage.vue | 2 | 3 / 3 / 0 |
| `/gamification/rewards` | m15-rewards-shop/pages/RewardsShopPage.vue | 2 | 3 / 5 / 0 |
| `/gamification/mystery-box` | m15-rewards-shop/pages/MysteryBoxPage.vue | 4 | 13 / 12 / 0 |
| `/cabutan` | m15-rewards-shop/pages/CabutanPage.vue | 3 | 7 / 13 / 0 |
| `/permainan/uji-minda` | m16-battle-games/pages/UjiMindaPage.vue | 1 | 6 / 7 / 1 |
| `/permainan/sambung-kata` | m16-battle-games/pages/SambungKataPage.vue | 1 | 1 / 1 / 0 |
| `/sekolah-bersaing` | m16-battle-games/pages/SekolahBersaingPage.vue | 1 | 6 / 2 / 0 |
| `/permainan/jutawan/main` | m16-battle-games/pages/JutawanMainPage.vue | 3 | 3 / 13 / 0 |
| `/tournament/:uuid` | m16-battle-games/pages/TournamentDetailPage.vue | 1 | 3 / 5 / 0 |
| `/marketplace` | m20-marketplace/pages/MarketplacePage.vue | 5 | 6 / 14 / 1 |
| `/marketplace/penjual/:id` | m20-marketplace/pages/PenjualShopPage.vue | 4 | 9 / 20 / 1 |
| `/marketplace/:slug` | m20-marketplace/pages/ProductDetailPage.vue | 8 | 23 / 40 / 3 |
| `/marketplace/:slug/whatsapp` | m20-marketplace/pages/WhatsappHandoffPage.vue | 1 | 0 / 1 / 0 |
| `/pusat-tuisyen/tiket` | m22-support-tickets/pages/TicketsPage.vue | 1 | 7 / 16 / 1 |
| `/amaran/sekolah` | m27-school-admin/pages/AmaranSekolahPage.vue | 7 | 10 / 11 / 0 |
| `/admin-sekolah/laporan-bulanan` | m27-school-admin/pages/LaporanBulananPage.vue | 4 | 14 / 13 / 1 |
| `/admin-sekolah/dskp-heatmap` | m27-school-admin/pages/DskpHeatmapPage.vue | 3 | 4 / 7 / 0 |
| `/admin-sekolah/pelajar/baru` | m27-school-admin/pages/TambahPelajarPage.vue | 3 | 9 / 7 / 0 |
| `/admin-sekolah/statistik-penggunaan` | m27-school-admin/pages/StatistikPenggunaanPage.vue | 4 | 8 / 4 / 0 |

## D. Cross-cutting patterns (top 10 recurring violations)

Counts are **[Code]** unless marked. "Files" = `.vue` files in `src/modules`, `src/shells`, `src/components`, `src/pages`. Examples are `file:line` under `src/`.

| # | Pattern | Count | Where it hits (screens) | Example file:line |
|---|---|---|---|---|
| P1 | **Lint blind spot: files with no DS rule at all** (not in `config/ds-strict.json`). Every other finding below is amplified here. | 68 of 744 `.vue` files: 15 `m28-bijak-spm/admin/**`, 27 `shells/**`, 12 other module files (`m02 RenewalInvoicePage`; `m03 ColorSwatch`, `SubjectIconTile`; `m04 ArabicKeyboardPanel`, `MarkdownView`, `ReportQuestionModal`, `ReportModalHarnessPage`; `m14 student-b/AchievementShareModal`, `KadKomboCard`, `KadMasteryCard`, `KadProfilCard`, `KadRankingCard`), 14 legacy `components/pages/App` | **All 15 admin Kertas & SPM authoring screens** (`/admin/spm/kertas*`, `/admin/spm/semakan*`, `/admin/spm/soalan*`), every route (shells), `/gamification/kad-kongsi`, `/gamification/achievements`, `/admin/questions/create|edit` (via `ArabicKeyboardPanel`), `/admin/school-subscriptions/:id/renewal-invoice` | `config/ds-strict.json` (no `m28-bijak-spm/admin` glob); `modules/m28-bijak-spm/admin/papers/BankPage.vue` (0 lint errors, ds:debt 33 type / 30 spacing / 14 surface) |
| P2 | **Hand-written styling on pages instead of Ds primitives** (lint allows it at page level): type-scale roles on raw `p/span/div`, `gap/p/m` spacing, `flex` layout, `rounded/bg/shadow` surfaces | type 3,152 (502 files), spacing 3,963 (560), surface 716 (164), layout 6,647 (552). In `src/modules`+`src/shells`: `DsText` 18, `DsHeading` 0, `DsStack` 17, `DsCluster` 16, `DsGrid` 2, `DsSurface` 7 vs 2,194 raw `div`, 1,093 `p`, 1,268 `span`, 91 raw `<h1>` | every screen; worst: `m05 PracticeConfigPage` layout 78, `m16 BattleLobbyPage` 69, `m28 admin IntakeReviewPage` 64 layout / 46 spacing / 26 type / 25 surface | `modules/m05-practice/pages/PracticeConfigPage.vue`; `modules/m28-bijak-spm/admin/papers/QuestionPreview.vue` (hand-built card) |
| P3 | **Size scale used beyond what the theme defines**: `size="xl"` and unthemed `lg/xl` | `UButton` size: lg 149, **xl 96**, sm 38, md 15; `UInput` size: **xl 21**, lg 19, md 19; `USelect` lg 18, **xl 12**; `UTextarea` xl 1; `UBadge` lg 82, **xl 12**. `ui.config.ts` themes button `xs/sm/md/lg` (`ui.config.ts:177-190`), input/select/textarea `md/lg` only (`:42-45`), badge `lg/xl` as bare `rounded-full` (`:383-384`) | auth, `m02` admin (`InviteLinkCard.vue:58-93`, `JemputIbuBapaPage.vue:97`), `m03`, `m07`, `m09`, `m10`, `m14`, `m16` (44 xl buttons), `m13`, `m15` | `modules/m02-users-schools/components/jemput/InviteLinkCard.vue:58`; `modules/m16-battle-games` solo pages |
| P4 | **Same role, different button recipe** (size/variant/colour). Button size by module (AST, count of `UButton` by size; `-` = default md): m02 `-`53 / xl 4; m04 `-`36 / sm 1; m09 `-`37 / xl 6 / sm 2 / md 1 / lg 1; m10 `-`65 / sm 3 / xl 3; m08 **lg 48** / `-`19; m27 **lg 12** / `-`3; m22 **lg 6**; m11 **md 10**; m16 xl 44 / lg 16; **m28 admin sm 25 / lg 6 / md 1 / `-`31**; toolbar/row actions mix `neutral/soft` (222 soft), `ghost` (118), `link` (67), `outline` (18; "no outline buttons" per D34, `ui.config.ts:166-168`) | 134 distinct (colour/variant/size) combos over 708 `UButton` in modules+shells; top: `neutral/soft` 96, no props 92, `neutral/ghost` 84, `neutral/soft/lg` 46, `neutral/link` 39, no props+lg 36, `neutral/soft/xl` 29, no props+xl 20 | all admin/staff screens | `modules/m28-bijak-spm/admin/intake/components/QuestionEditor.vue:144,236,319` (`size="sm"` outline) vs `modules/m04-question-bank/pages/QuestionListPage.vue:542` (default); `modules/m22-support-tickets/pages/TicketsPage.vue:135` (`lg`) |
| P5 | **Palette colours, hex and arbitrary values in lint-blind files** (breaks G-3/G-7: dark mode and theme cannot reach them) | palette 260 in 28 files (`bg-slate-*`, `text-indigo-*`, `bg-red-500`, `from-indigo-500`), hex 5 in template + 6 in script, arbitrary 28 in 16 files, opacity modifiers 28 in 22 files, inline `style=` 9 in 8 files, `<style>` blocks 2 (modules + shells) | `/admin/school-subscriptions/:id/renewal-invoice` (39), shells (`UserHeader` 36, `UserDrawer` 10, `AdminNavList`, `PublicCta`...), `ReportQuestionModal` 26, `Kad*Card` 47, `FeedbackGallery` 10, dev pages | `modules/m02-users-schools/pages/RenewalInvoicePage.vue:61-62` (print sheet), `shells/user/UserHeader.vue:42,55,95` (hex gradient in `style=`), `modules/m14-gamification/components/student-b/KadProfilCard.vue:13`, `modules/m28-bijak-spm/admin/intake/pages/IntakeReviewPage.vue:616` (`bg-warning/10`) |
| P6 | **Stock type sizes and weights** (`text-xs/sm/base/lg/xl`, `font-bold/semibold`) instead of the type scale | stock size 214 in 29 files, `font-*` weight 298 in 86 files | `m28 admin` (`QuestionEditor` 20 + 9 weights, `IntakeReviewPage` 16 + 10), `UserHeader` 33, `RenewalInvoicePage` 21, `PembelajaranLayout` 12 weights | `modules/m28-bijak-spm/admin/intake/components/QuestionEditor.vue:151,160,170,187` (`text-sm`, `font-medium`); `shells/user/UserHeader.vue:189` (`text-[9px]`) |
| P7 | **Raw HTML controls and raw `<label>` field wrappers** instead of `UButton`/`UInput`/`DsFormField` | raw `button/input/textarea/table` 41 in 20 files (`button` 34, `input` 4, `textarea` 1, `table` 2 + thead/tr/th/td; 49 in 21 files incl. `src/components` gallery); raw `<label>` 44 in 16 files (field wrappers; `label` is not in `RAW_ELEMENT_NAMES`); `<img>` 18 | `/admin/spm/soalan/ekstrak/:batchId`, `/admin/spm/soalan/:qid/sunting` (13 + 5 `<label>`), `/admin/questions/create|edit` (8 raw `<button>` in `ArabicKeyboardPanel`), report modal, `RenewalInvoicePage` (raw `<table>`), shells (`PembelajaranLayout.vue:354,468,592`, `PentadbiranLayout.vue:207`) | `modules/m28-bijak-spm/admin/intake/pages/IntakeReviewPage.vue:363,386,611` (`<button>`), `:458,508` (`<img>`), `:514,523,533,650` (`<label>`); `modules/m04-question-bank/components/ArabicKeyboardPanel.vue:99,112,124,146` |
| P8 | **Hand-built card surfaces** and `ds`-level exemption leak: radius/shadow/gradient decided on pages; stock radius names bypass the `rounded-card/sheet/chip` tokens | radius 234 in 92 files, shadow 58 in 40 files, gradient 26 in 18 files, lines (`border/ring/divide`) 110 in 21 files; stock names in modules (single-line grep): `rounded-xl` 32, `rounded-2xl` 17, `rounded-lg` 20, `rounded-3xl` 7 vs `rounded-card` 46, `rounded-chip` 15; **[Obs] stock names compute to 16px (`lg`), 24px (`xl`), 32px (`2xl`)**, so e.g. `rounded-2xl` inside a 16px `DsPanel` breaks the nesting rule. 85 module `.vue` files are at `ds` level (config order lets `ds` override `page`) | `/peta-belajar`, `/topik*`, `/topik/:id`, `/cikgu-alesa` (ChatPage), `m28 admin QuestionPreview`, `IntakeReviewPage` (radius 9, lines 13), auth screens | `modules/m03-curriculum/pages/TopicDetailPage.vue` (radius 6, shadow 5, ds-level); `modules/m28-bijak-spm/admin/papers/QuestionPreview.vue` (type 21 / spacing 17 / surface 8, no Ds surface); `modules/m13-cikgu-alesa/pages/ChatPage.vue:78,262,282` |
| P9 | **Card/panel container drift**: `UCard` vs `DsPanel` vs `DsFormSection` vs `DsSurface` for the same "content block" | `DsPanel` 318, `UCard` 251 (variant `soft` 15, `subtle` 14, default outline; **`:ui` override 42**, extra `class` on ~70 tags), `DsFormSection` 72, `DsSurface` 7, `DsMediaCard` 5, `DsHeroCard` 4. `DsPanel` deprecated alias `tone="inset"` 47 and `tone="tint"` 4 still the dominant use. Paddings in DS: Panel `p-4 sm:p-5`, FormSection `p-4 sm:p-6`, UCard `p-4 sm:p-5`, MediaCard `p-3 sm:p-4`, StatTile `p-4 md:p-5` (roomy `p-6`, learner `px-2.5 pt-3.5 pb-3`), HeroCard `p-4.5` | all dashboards (`m05 dashboard-v2` `UCard :ui` x7), `m04 QuestionDetailPage` (DsPanel x7 + UCard inside), `m17 BoardKpis` | `modules/m05-practice/components/dashboard-v2/HomeLevels.vue:18` (`UCard :ui="{ body: 'flex flex-col gap-4 p-4' }"`); `modules/m04-question-bank/pages/QuestionDetailPage.vue:184,215`; `modules/m02-users-schools/components/QuotaPanel.vue:31,73` (`tone="inset"`) |
| P10 | **Form-field kit drift and icon-weight drift** | Fields: `DsFormField` 239 vs raw `UFormField` 57 (in 10 modules: `m28` 5 files, `m16` 5, `m08` 4, `m01` 2, ...); selects: `DsNativeSelect` 126 vs `USelect` 41 (`m05`, `m08`, `m09`, `m01`; sizes lg 18 / xl 12) vs `UNativeSelect` 2 - the two look different (observed: native select 44px r12 with browser chevron vs USelect 52px). Icons: 518 hard-coded `i-ph-*` weights (duotone 427, bold 92, fill 21) and `UIcon` 394 vs `DsIcon` 8, bypassing `DsIcon`'s personality rule (staff Regular, learner Duotone, `DsIcon.vue:4-6`): staff module `m10-teacher-class` has 93 duotone vs `m27` 1, `m11` 0, `m12` 0, `m04` 0 | admin forms (`/admin/spm/kertas/baharu` mixes `UFormField`+`UInput` with `DsNativeSelect`), Bijak hub (`USelect` lg), guru screens (duotone) vs Admin Sekolah screens (regular) | `modules/m28-bijak-spm/admin/papers/PaperNewPage.vue` (`UFormField` x3 + `DsNativeSelect` x2); `modules/m28-bijak-spm/pages/BijakHubPage.vue` (`UFormField` x4 + `USelect` x4); `modules/m10-teacher-class` (93 duotone literals) |

### Further recurring items (counted, lower rank)
| Pattern | Count | Example |
|---|---|---|
| `:ui="{...}"` overrides on pages (ds-hardening H4/H7: "no ui prop") | 82 in 51 files (AST = ds:debt); shells `PembelajaranLayout` 9, `PentadbiranLayout` 6 | `shells/pembelajaran/PembelajaranLayout.vue:611` (`max-w-[min(88vw,360px)]` inside `:ui`) |
| `class` on `Ds*` tags beyond layout hooks | 85 in 31 files (`AuthLayout` 12, `RegisterPage` 12, `m05 SpmTargetsPage` 6) | `modules/m01-authentication/components/auth/AuthLayout.vue` |
| Tailwind class literals inside `.ts` | 804 in 101 files; `shells/nav/user-nav.ts` 320, `m16 hub-cards.ts` 31, `shells/pentadbiran/group-accent.ts` 31, `m05 practice-config.ts` 25, `src/components/feedback/classes.ts` 13, `src/components/overlay/classes.ts` 13 | `modules/m16-battle-games/components/hub/hub-cards.ts` |
| Raw `text-primary` (ds-hardening 2.2 flags learner-dark contrast ~3.4:1; `text-primary-t` is the readable token) | exactly 2 uses, both in lint-blind `m28 admin` files (vs 180 `text-primary-t`) | `modules/m28-bijak-spm/admin/intake/pages/IntakeListPage.vue:154`, `modules/m28-bijak-spm/admin/papers/QuestionPreview.vue:100` |
| Mixed BM / English / vocabulary (details in section E7) | 112 hits in 72 files by heuristic; confirmed examples below | `m04 QuestionListPage.vue:666` `ACTIVE/INACTIVE` vs `m02 UserListPage.vue:161` `Aktif/Tidak Aktif` |
| Table implementation: `DsDataTable` 65 (variant flush 23, bare 16, density compact 8, tight 2), `DsDrillTable` 12, raw `<table>` 2 (`RenewalInvoicePage`, `FeedbackGallery`), `UTable` direct 2 (`m28 StimulusView`, `m28 admin BankPage` slideover) | | `modules/m28-bijak-spm/components/StimulusView.vue` |
| Legacy shells and global CSS still shipped: `src/styles/theme.css` (282 hex), `live-globals.css` (`.card`, `.coin-pill`, `.streak-pill`, `.avatar-ring`, `[class*='-hero'] !important`), `user-shell.css` (100 stylelint warnings), `admin-shell.css`; custom classes `.topbar .sidebar .nav-item .drawer-nav-item .coin-pill .streak-pill .user-card .mobile-drawer .pp-hit .bottom-nav .avatar-ring .smooth-hover .footer-text` used in 9 shell files (61 uses). In prototype scope these shells serve only non-prototype roles / the unscoped build; the live shells are `PembelajaranLayout` and `PentadbiranLayout` (`app/router/layouts.ts:26-44`) | | `shells/user/UserHeader.vue:47,85,94,103`, `shells/admin/AdminSidebar.vue:29` |
| Native-label drift in the two live shells: raw `<button>` x4, arbitrary values (`h-[calc(...)]`, `text-[0.6875rem]`, `max-w-[1600px]`), one `<style scoped>`, 21 `rounded/shadow/gradient` tokens | | `shells/pembelajaran/PembelajaranLayout.vue:354,468,521-522,580,592,611,700`; `shells/pentadbiran/PentadbiranLayout.vue:207,301` |

---

## E. Inconsistencies between DS components themselves (not page misuse)

| # | Role | Competing implementations | Evidence |
|---|---|---|---|
| E1 | **Content card / panel** | `DsPanel` (header `p-4 sm:p-5`, raised/inset/tint layers, shadow `auto`), `UCard` themed in `ui.config.ts:246-261` (`rounded-card`, body `p-4 sm:p-5`, `outline` = `shadow-lift`, `soft`/`subtle` = `bg-elevated`), `DsFormSection` (`p-4 sm:p-6`, gap-5 grid), `DsSurface` (padding scale, tints via `bg-primary/10`), `DsMediaCard` (UCard with `p-0` body + `p-3 sm:p-4`) | `DsPanel.vue:83,100`; `DsFormSection.vue:28,41`; `DsMediaCard.vue:57-68`; `DsSurface.vue:67-75`. Hardening doc already lists "seven card paddings" (`v2-ds-hardening.md` 0.1). Off-grid values inside the DS: `p-4.5` (`DsHeroCard.vue:43`), `px-2.5 pt-3.5 pb-3` (`DsStatTile.vue:191`) |
| E2 | **KPI / stat tile** | `DsStatTile` has three layouts selected by personality + density (default vertical learner tile `px-2.5 pt-3.5 pb-3`; staff compact row `p-4 md:p-5`; roomy `p-6`); `DsStatRow` density is chosen per page (69 uses: 16 `roomy`, 12 `compact`, 41 default; `cols` 4 x34, 3 x19, 5 x7, 2 x1); `DsLiveTiles` wraps `DsStatTile` in its own `grid-cols-2 lg:grid-cols-4` instead of `DsStatRow cols`; `m17 BoardKpis` builds KPI tiles from `UCard` | `DsStatTile.vue:147,188-191`; `DsStatRow.vue:79`; `DsLiveTiles.vue:30`; `m17-admin-dashboard/components/command-center-board/BoardKpis.vue:64`. **[Obs]** `/admin/spm/kertas` shows 3 wide horizontal tiles, `/admin/questions` shows narrow stacked tiles ("Jumlah soalan" wraps to two lines), `/admin/pksk/questions` 5 narrow tiles, `/admin/users` 4+3 tiles: same role, four silhouettes |
| E3 | **Status badge / tag / chip** | `DsStatusBadge` (UBadge + bold icon, `sm|md`), `DsTag` (neutral subtle), raw `UBadge` (variant subtle 208, soft 124, solid 41; colour neutral 143; size lg 82), `DsRewardChip`, `DsLiveBadge`, `DsIconChip`. `UBadge` `size` themes only `xs/sm/md`; `lg`/`xl` are bare `rounded-full` (`ui.config.ts:384-385`) and used 94x. 48 `DsStatusBadge` vs 391 `UBadge` | `ui.config.ts:375-398`; `DsStatusBadge.vue:17-36`. **[Obs]** admin list statuses are green "Diluluskan" with check, grey "Draf" with pencil, orange "Menunggu Semakan" with clock, "ACTIVE" caps, "Belum sepadan" amber: different pill height/weight/case on `/admin/spm/kertas`, `/admin/questions`, `/admin/spm/semakan` |
| E4 | **Buttons** | Theme default variant is `soft` (`ui.config.ts:173`); in **staff** `color=primary soft` is restyled to a solid gradient (`:210-215`), in learner it stays tonal; `outline`/`subtle` render as the neutral tonal fill (D34). So `<UButton>` with no props = primary solid in staff but primary soft in learner. `size` has xs/sm/md/lg only (`:177-190`) while pages use `xl` 96x | `ui.config.ts:166-231`; counts section D P3/P4. **[Obs]** button heights across 4 roles: see section F2 |
| E5 | **Form controls** | `DsNativeSelect` (native, 136 uses) vs `USelect` (44) vs `UNativeSelect` (2); `UInput` themed `md/lg` (`fieldConfig`, `ui.config.ts:37-47`) but used with `xl` 21x; error state: `DsFormField` vs `UFormField` + `:color="invalid(..) ? 'error' : undefined"` (>10 pages) | `props.json`; `PaperNewPage.vue`, `BijakHubPage.vue`. Admin archetype doc says native selects are intentional for filters (`v2-admin-pages.md:34-36`), but forms and student hub use `USelect` |
| E6 | **Tables** | `DsDataTable` (variants `flush`, `bare`, densities `compact`, `tight`), `DsDrillTable` (own `UTable` config, `DsDrillTable.vue:30`), pages/components using `UTable` or `<table>` directly (4), 6 domain wrapper tables (`CcTable`, `ItemTable`, `ClassTable`, `MonthlyTable`, `HeadcountTable`, `TopTenTable`) | `DsDataTable.vue:150-179,328`; `m28 StimulusView.vue`; `RenewalInvoicePage.vue` (`<table>` with `TH/TD` class constants at :61-62). **[Obs]** `/admin/spm/kertas`: last column "Dikemas kini" clipped at the panel edge at 1280 (text `24 Okt 2026, 9:15 PTG` cut) |
| E7 | **Copy vocabulary** (glossary `v2-copy-glossary.md`) | Reset button: "Set Semula" (DsFilterBar default) vs `reset-label="Reset"` (`m04 SubmissionListPage.vue:161`), "Reset Data" (`m08 HeadcountTablePage.vue:256`), "Reset Kata Laluan" (`m01 PasswordResetIcPage.vue:105`) [C1]. Status: `ACTIVE/INACTIVE` (`m04 QuestionListPage.vue:666`), `Published/Draft` (`m04 StructuredListPage.vue:96`, `StructuredDetailPage.vue:130`), `Aktif/Tidak Aktif` (`m02 UserListPage.vue:161`) [C10]. E-mail: "Alamat Email" (5 auth pages), "Email" (`m01 ProfileEditPage.vue:136`), "Emel" (11 hits; `m02 UserListPage` placeholder "Cari nama atau emel..."). English UI strings: "SPM Mock Exam", "Paper" (`m06 MockExamPage.vue:101,150`), "Export CSV" (`m08 HeadcountSummaryPage.vue:150`), "Pernah Login/Belum Login" (`m11 MonitoringTeacherPage.vue:236`), "Upload CSV" (`m02 ImportSourceFields.vue:57`), "Subjek Teras (Core Subject)" | glossary rows 28, 73, 142-153; "Edit" is a sanctioned live word (`glossary:37`) |
| E8 | **Deprecated DS API still the main use** | `DsPanel tone` (`inset` 47, `tint` 4) while `behavior`/`padding` are the new props; `DsStatTile`/`DsStatRow` `compact`/`roomy` bare attr 1 (`m14 KadKongsiPage.vue:116`), `valueClass` 2 (`m11 MonitoringStudentPage.vue:109`, `m12 LearningKpis.vue:47`); full `i-ph-*` class for `icon` on `DsIconChip` 10x | `DsPanel.vue:21-22`; `warnDeprecated` calls listed in `src/ds/*.vue` (13) |
| E9 | **DS stylelint violation inside the DS** | `src/ds/states.css:13` `outline: none; box-shadow: 0 0 0 2px var(--ui-primary)` (focus ring) breaks G-3b `border*/outline*` rule; makes `lint:ds:css` fail once the glob bug is fixed | section B3 |
| E10 | **Token / theme fidelity** | `src/styles/theme.css` re-declares the whole Tailwind v3 palette as hex and `--color-text*`; `base.css:13,22` still colours `body`/headings with `var(--color-text)` outside `[data-personality]` (so legacy islands and the 404/403/global error pages use legacy slate colours); `main.css` imports both `theme/tokens.css` and `styles/theme.css` | `styles/main.css:5-13`, `styles/base.css:11-23`, `styles/theme.css:316-322` |


## F. Visual / DOM spot check [Obs]

Method: headless Chromium (playwright-core from the repo), 1280x800, light, against `http://localhost:5199` (prototype scope on). Logged in as `admin@demo.test`, `pelajar@demo.test`, `guru@demo.test`, `adminsekolah@demo.test` (demo password not stored). `browse2.mjs`/`browse3.mjs` visited **151 distinct non-parameter routes** (admin 50, student 83, teacher 17, school-admin 14; 2 timeouts: `/admin/audio-kbat/create`, `/ranking`; 3 "not available / 403" screens: `/analisa-item/kelas`, `/laporan-mingguan`, `/guru/laporan-mingguan-kelas`) and measured every visible `button`, native `input/select/textarea`, `table` and large surface. Raw per-page data: `browse-admin.json`, `browse-student.json`, `browse-teacher.json`, `browse-school.json`, `dom-per-page.json`. Parameter routes (e.g. `/admin/spm/soalan/ekstrak/:batchId`) were opened via links in `shots-admin-spm.mjs`.

### F1. Page-level checks (all 151 routes)
- Horizontal page scroll at 1280: **0 pages**. Pages rendered in a "legacy island": **0** (every visited route is treated as v2 by the shells). `h1` count != 1: `/login` 0, `/register` 0, `/permainan/uji-minda` 0 (the page prints its title elsewhere).
- Native `<table>` visible on 37 pages (all `DsDataTable`/`UTable` output; no hand-built table visible except the invoice).

### F2. Measured control shapes (same role, different result)
| Measure | Result across the 151 pages | Where it differs (examples) |
|---|---|---|
| Button height (excluding 16-24px checkbox-like) | 44px 447, **40px 162**, 52px 141, 56px 70, 48px 15, 64px 9; 114-159px tile-buttons in Command Center | **40px row-action buttons on admin lists** (`/admin/questions` 20, `/admin/pksk/questions` 20, `/admin/users` 25, `/admin/subjects`, `/admin/education-levels`, `/admin/articles`, `/admin/notes`, `/admin/banners`) while the same pages' other buttons are 44px and the design language requires >= 44px on staff (`v2-design-language.md` P4) |
| Button radius | r12 800, **pill (rounded-full) 142**, r4 82 (checkbox-like), **r8 23**, r16 6 | r8 buttons beside r12 buttons on `/admin/spm/soalan`, `/admin/questions`, `/spm/bijak`, `/tetapan`, `/timeline/create`, `/audio-kbat`, `/marketplace`, `/analitik/kelas`, `/headcount/create`, `/guru/pelajar`; r16 on `/profile/edit`, `/guru/soalan/cipta`; pill buttons on 11 student screens (`/tetapan`, `/dashboard`, `/misi-harian`, `/target-spm`, `/spm-mock`, `/cikgu/*`...) |
| Buttons per page with 3+ distinct heights | 15 pages | `/spm/bijak` (44/52/56, r12+r8), `/profile/edit` (36/52/56, r16+r12), `/latihan-berstruktur` (40/44/52), `/papan-bijak` (40/48/56), `/guru/command-center` (44/58/72/92/114) |
| Native/Nuxt field shape | `select` 44px r8 14px 89, `input` 44px r8 14px 77, **`input` 40px r12 16px 17**, **`input` 52px r8 14px 11**, `textarea` r8 | 40px/r12/16px inputs on `/login`, `/register`, `/password/reset*`, `/artikel`, `/cikgu`, `/gamification/convert`, `/papan-bijak`, `/mohon-keluarga-angkat` (auth and learner forms); 52px inputs (`UInput size="xl"`) on `/profile/edit`, `/tetapan`, `/timeline/create`, `/marketplace`, `/admin/question-reports`; everything else 44px |
| Surface radius (blocks > 160x60) | r16 1,589, r8 65, r24 51, r12 23, r32 1 | r12 panels on `/panduan`, `/pusat-tuisyen/panduan`, `/gamification/mystery-box`, `/guru`, `/kelas-saya`, `/set-soalan-saya`, `/guru/command-center`; r24 sheets on learner screens (`/dashboard`, `/misi-harian`, `/target-spm`, `/cikgu/*`) |

### F3. Screens inspected (screenshots in `shots/`) and visible inconsistencies, by element label
Admin screens (staff light). Each bullet = one thing a user can see.

| Screen | Screenshot | Visible inconsistencies |
|---|---|---|
| `/admin/spm/kertas` (Pembina Kertas) | `shots/admin-_admin_spm_kertas.png`, `admin-spm-kertas2.png` | KPI strip = 3 wide horizontal tiles ("Jumlah kertas", "Draf", "Diterbitkan"); the table's last column "Dikemas kini" is cut at the right edge (`24 Okt 2026, 9:15 PTG` clipped); status chips "Draf" (grey, pencil) and "Belum sepadan" (amber, warning icon) have different height/weight; primary button "Kertas Baharu" is the large gradient CTA |
| `/admin/spm/kertas/baharu` | `shots/admin-_admin_spm_kertas_baharu.png` | Form column is a 768px centred column (other admin forms are full-width 2-column); back link text "Pembina Kertas"; intro line starts at x=481 (indented) while on `/admin/spm/soalan/muat-naik` the intro is centred at x=538; sticky `DsFormBar` shows ghost-style disabled "Cipta Kertas" |
| `/admin/spm/soalan` (Bank Soalan SPM) | `shots/admin-spm-soalan.png` | Filter bar wraps to **two rows** (search + 3 selects, then 1 select + "Cari") with uneven select widths, unlike Bank Soalan (3 selects + "Lagi Penapis" + "Cari" on one row); row action is a large soft button "Pratonton" (44px) while `/admin/questions` and `/admin/pksk/questions` use 3 icon-only 40px ghost actions; KPI tiles are 4 horizontal tiles with a blue selected ring on "Jumlah soalan"; status chip "Diterbitkan" (green, upload icon) |
| `/admin/spm/semakan` (Baris Gilir Semakan) | `shots/admin-_admin_spm_semakan.png` | Row action = solid large "Semak" (gradient, eye icon) vs "Pratonton" soft on the sibling screen; status chip "Menunggu Semakan" (amber, clock) is a different chip recipe from "Diterbitkan"; confidence chips "Keyakinan rendah/tinggi/sederhana" are a third chip style (neutral subtle) |
| `/admin/spm/soalan/ekstrak/:batchId` (Semak Ekstrak) | `shots/admin-spm-ekstrak-review.png` | Source-page tabs "1" / "2" are raw `<button>`s (black active chip) instead of `DsPillNav` (blue segmented pill); field labels ("Nombor soalan", "Jenis soalan", "Markah", "Teks soalan") are raw `<label class="text-sm">` while `DsFormField` labels elsewhere are semibold 14px with required asterisk; notice "9 perkara perlu dibaiki sebelum dihantar" is a raw `<button>` (h44, r16, `IntakeReviewPage.vue:363`), not `UAlert`; computed radii of the hand-built inner cards: `<article class="rounded-2xl">` = **32px** and `<li class="rounded-xl">` = **24px** inside a `DsPanel` (`rounded-card` = 16px), `<pre class="rounded-lg">` = 16px (the nesting rule "inner strictly smaller than outer" is broken; stock radius names resolve to 16/24/32px, see `tokens.css:375` `--ui-radius`); inner question-item buttons "Tambah rajah", "Tambah petikan", "Tambah mata", page chips "1"/"2" are 40px (`size="sm"`) next to 44px buttons; `border border-default` (transparent token) is still written on those cards; "Simpan draf" / "Hantar untuk semakan" are neutral soft buttons while the page's primary action is not emphasised |
| `/admin/spm/soalan/muat-naik`, `/admin/spm/soalan/manual` | `shots/admin-spm-muat-naik.png`, `admin-spm-manual.png` | Form sections use "Maklumat kertas" (sentence case) with a subtitle; `/admin/questions/create` uses "Maklumat Soalan" (Title Case) without a subtitle (glossary prefers one capitalisation style); back link "Kembali ke Senarai Ekstrak" vs "Kembali" vs "Pembina Kertas" |
| `/admin/questions` (Bank Soalan) | `shots/admin-_admin_questions.png` | KPI tiles are narrow stacked tiles ("Jumlah soalan" wraps in 2 lines) different from the 3-4 wide horizontal tiles on `/admin/spm/*`; status shows two chips per row: "Diluluskan" and the uppercase English "ACTIVE"; row actions are 40px icon buttons; tag chips "DSKP", "VERIFIED", "AI Verified" mix caps and sentence case; source line "Source: TEXTBOOK" is English |
| `/admin/questions/create` | `shots/admin-_admin_questions_create.png` | Two-column form where the DSKP block is a tinted inset panel with selects of a lighter fill and different label weight; option cards "Pilihan A..D" are another tint (bg-soft); sticky bar buttons "Batal" (plain text) and "Simpan Soalan" (solid) |
| `/admin/pksk/questions` | `shots/admin-_admin_pksk_questions.png` | Table header has an empty-looking "Tindakan" column with the actions right-aligned far away from its header; 5 KPI tiles (one faded/animating) versus 4 on sibling screens; filter bar = full-width search row + 3 selects row + "Cari" (third layout of the same `DsFilterBar`) |
| `/admin/users` | `shots/admin-_admin_users.png` | Header actions: two ghost buttons "Import Pelajar"/"Import Pengguna" + solid "Tambah" (3 recipes); 7 KPI tiles wrap 4+3 with an empty slot; status chips "Aktif" green vs "Tidak Aktif" grey, role chip "Pelajar" neutral; placeholder "Cari nama atau emel..." |
| `/spm` (Persediaan SPM) | `shots/student-_spm.png` | Large display `h1` "Persediaan SPM" in the body plus a "MOD SPM" eyebrow chip that repeats the breadcrumb "Mod SPM"; hero CTA "Buka" is a black inverted button; KPI tiles are vertical (icon on top) with lime/blue/purple/orange chips (4 different accent hues) vs admin horizontal tiles |
| `/spm/bijak` (Bijak SPM) | `shots/student-_spm_bijak.png` | No body title (the hub relies on a back link "Mod SPM" and the breadcrumb) unlike `/spm`; hero CTA "Mula" is a white button (vs black "Buka" on `/spm`); segmented tabs "Kertas Pilihan / Jana Kertas" (gradient active) + `USelect` fields "Subjek"/"Kertas" at 52px (`size="lg"`) vs 44px native selects in admin; section heading "Kertas Pilihan" display size |
| `/gamification/kad-kongsi` | `shots/student-_gamification_kad_kongsi.png` | The two buttons under the card: "Muat Turun" pale-lime fill with lime text (very low contrast) and "WhatsApp" green soft; card uses hex-free but palette gradient (`from-indigo-500 via-violet-500`) |
| `/gamification/achievements` | `shots/student-_gamification_achievements.png` | Page `h1` "Pencapaian Anda" (with a medal emoji) repeats the shell breadcrumb title; hero card + streak card use a different display scale than other learner pages; rarity chips "BIASA/JARANG" are a fourth chip recipe |

Not exhaustively visited at 375/768 or dark mode (scope: 1280 light only).

---

## G. Notes on measurement limits
- The score in section C is a transparent weighted sum (not a severity): `5*rawControls + 3*(arbitrary + hex + inline style + <style> + script hex) + 2*palette + 2*English labels + 1*(opacity + stock size + lines + gradient) + 0.5*(radius + shadow + weight + motion + :ui + class-on-Ds)` over the page file **and every local component it imports** (transitive, same module + shell components for layout). P1 >= 30, P2 10-29, P3 1-9, P0 = 0. Hand-written layout/type/spacing (ds:debt) is shown but is not in the score because the current `page` lint allows it (A3/A7).
- "Raw controls" counts `button, input, select, textarea, table, dialog` from the Vue template AST (not regex), so multi-line tags are counted correctly. `<a>`, `<img>`, `<label>` are listed in the patterns table but not in the score.
- English-label detection is a heuristic over `label/title/placeholder/description/aria-label/subtitle/text` attributes; glossary-sanctioned live words ("Edit") are included in the 112 and must be filtered by a human; only the items quoted in E7 were checked by hand.
- Component-to-route mapping comes from `import('...vue')` in `routes.ts` / `routes/*.ts` (`routemap2.json`, 257 route records, 242 components). A route whose component is reached only through a nested router child or a computed path would be missing; the 12 route records with `${...}` path constants were resolved from `const` declarations.
- `Raw controls`/`palette` counts for `RenewalInvoicePage`, `Kad*Card`, `AchievementShareModal` are in documented print/share scopes (`v2-ds-hardening.md` 2.7, decision D-H4) but are still not behind a scope token, so they stay counted.
