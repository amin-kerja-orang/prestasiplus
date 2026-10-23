# Frontend Developer Guide (v2)

| Field | Value |
|---|---|
| Slug | `v2-frontend` |
| Audience | Every PC and Claude Code session that builds or changes a frontend screen |
| Verified against | branch `docs/v2-reference` (code read at commit `20f3fb6`), 2026-10-19 |
| Status | Handbook. Where it disagrees with a decision in `docs/TRACKER.md`, the TRACKER wins (AGENTS.md section 3). Contradictions found while writing are in section 10 |

This guide tells you **how** to build a screen without asking anyone. It links the design and architecture documents instead of repeating them. Read the linked doc when a rule here says "see".

Siblings: [onboarding](onboarding.md) (set up a PC, first day), [fullstack integration guide](fullstack-integration-guide.md) (mock/http/hybrid switch and backend cut-over), [test strategy](../qa/v2-test-strategy.md), [API catalogue](../architecture/v2-api-catalogue.md). Backend counterpart: [backend-dev-guide](backend-dev-guide.md).

Always-on rules come from [CLAUDE.md](../../CLAUDE.md) (process, fidelity section 6, conventions section 7, v2 section 8) and [AGENTS.md](../../AGENTS.md). Section numbers below that say "CLAUDE.md 6" mean those.

---

## 1. Folder layout and module anatomy

### 1.1 Top level of `src/`

| Folder | What lives there | Who may edit |
|---|---|---|
| `src/app/` | `bootstrap.ts` (installs the transport), `modules.ts` (the module registry), `router/` (meta, layouts, guards, core routes), `prototype-scope.ts` | Platform tasks only |
| `src/api/` | `ApiClient` (`api.get/list/post/...`), `Transport` contract, `HttpTransport`, envelope and `ApiError` | Platform tasks only |
| `src/stores/` | Pinia stores: `session`, `shell`, `flash`, `notification-badge`. Module state is not added here | Platform tasks only |
| `src/composables/` | Cross-module composables (`useApi`, `usePageMeta`, `useFlash`, `useDebounce`, ...) | Platform tasks only |
| `src/ds/` | The design-system composites (`Ds*`), `copy.ts` (default BM copy), `types.ts`. **The only component kit** | Design-system tasks only |
| `src/theme/` | `tokens.css`, `ui.config.ts` (Nuxt UI theme), `locale-ms.ts`, `color-mode.ts`, icon maps | Design-system tasks only |
| `src/shells/` | Layouts per audience: `pembelajaran/`, `pentadbiran/`, `public/`, plus frozen legacy `user/`, `admin/`; nav definitions in `shells/nav/` | Platform tasks only |
| `src/modules/mNN-slug/` | One folder per module (anatomy in 1.2) | The module's task |
| `src/mock/` | The in-browser mock server core: registry, router, repositories, datasets, persistence, determinism | Mock-core tasks only |
| `src/components/`, `src/styles/live-globals.css` | **Legacy, frozen.** Strict files may not import `@/components/*` or `@/shells/*` | Nobody (deleted by V2-T56) |
| `src/lib/`, `src/pages/`, `src/test-support/`, `src/dev/ds/` | Small utilities (time, number), core error pages, test stubs, the `/__ds` gallery | Platform / design-system tasks |
| `packages/contract/` | `@pp/contract`: zod schemas, `openapi.json`, access matrix. Shared with the NestJS backend | Contract tasks (backend lane) |
| `e2e/` | Playwright: `e2e/<mNN-slug>/*.spec.ts`, `e2e/global/`, `e2e/support/`, `e2e/fixtures/` | Module task (its own folder) |
| `config/` | `ds-strict.json` and the ratchet baselines | Append-only, see section 2.3 |

File ownership matters because several sessions share one tree. A module task edits **only** `src/modules/<its module>/**`, `e2e/<its module>/**` and appends to `config/ds-strict.json`. Changing `vite.config.ts`, `eslint.config.ts`, `src/theme/**`, `src/ds/**`, `src/app/**`, `src/shells/**` or `packages/contract/src/common|session` is a platform task: ask the Delivery Lead first (see [v2-frontend section 10.3](../architecture/v2-frontend.md)).

### 1.2 Module anatomy (model: `src/modules/m05-practice`)

```
src/modules/m05-practice/
  index.ts          # PUBLIC ENTRY: exports `manifest` + the typed client + public components/types
  routes.ts         # only spreads the fragments below
  routes/<group>.ts # RouteRecordRaw[] per screen group (dashboard.ts, practice.ts, ...)
  api/
    types.ts        # DTO types of the module's endpoints (UI and mock share them)
    <area>.ts       # typed client functions, one per endpoint, built on `api` from '@/api'
  pages/            # route components: <Name>Page.vue
  components/       # domain components, grouped by screen (components/quiz/, components/chapter/, ...)
  composables/      # optional: module composables (use<Name>.ts)
  lib/              # optional: pure helpers (formatting, rules) with unit tests
  mock/             # the mock plugin of this module (section 3.3); never imported by UI code
  __tests__/        # vitest: pages/, mock/, <area>/ (mirror the source layout)
```

Rules:

1. **Public entry only.** Another module imports yours only from `@/modules/<slug>` (its `index.ts`). Never its `pages/`, `components/`, `mock/*` internals. Inside your own module use relative imports. ESLint enforces it (ADR-0009): see the `boundaries-*` blocks in `eslint.config.ts`.
2. **`index.ts` exports a `ModuleManifest`** `{ id: 'M05', slug: 'm05-practice', routes }` and is added to `src/app/modules.ts` once (done at module creation; later tasks do not edit that list).
3. **Route fragments** live in `routes/<group>.ts`; `routes.ts` only spreads them. Pages are lazy: `component: () => import('../pages/XxxPage.vue')` with a plain string literal (non-literal `import()` and `import.meta.glob` are lint errors).
4. **Names.** Pages `<Name>Page.vue`; route names `mNN.<screen>` (e.g. `m05.dashboard`); components PascalCase; composables `useXxx.ts`; pure helpers `*-lib.ts` or `lib/*.ts`. Do not name a module-local component after a `Ds*` synonym (`*FormBar*`, `*PageHeader*`, `*StatRow*`, `*LoadError*`, `native/*`): a unit test fails on it (section 2.2).
5. **Route meta** (typed in `src/app/router/meta.ts`): `layout`, `access`, `roles`, `onForbidden`, `title` (exact tab title), `header`, `shellTitle`, `module`, `v2`. Defaults: `layout: 'bare'`, `access: 'auth'`. See the guard rules in section 4.2.
6. **Cross-module data** goes through the owner module's `api/` client (UI) or its `mock` repository exports (mock code only). Never its virtual ids or tables.
7. **Shared components** that two modules need go to `src/ds` (if generic) or are exported from the owner module's public entry (if domain), as M05 does with `QuizRunner`.

---

## 2. Design-system rules

Design sources (read, do not copy): [design language](../design/v2-design-language.md) (how pages are composed, archetypes, states, review checklist), [design system](../design/v2-design-system.md) (token values), [DS hardening](../design/v2-ds-hardening.md) (primitives, lint ratchet plan), [DS consolidation](../design/v2-ds-consolidation.md) (which `Ds*` replaces which local kit, props), [copy glossary](../design/v2-copy-glossary.md) (BM terms), [shells](../design/v2-shells.md), [screen restyle spec](../design/v2-screen-restyle-spec.md), [Nuxt UI spike](../architecture/v2-nuxtui-spike.md) (what Nuxt UI does with our setup), [ADR-0015](../adr/0015-nuxt-ui-design-system.md).

### 2.1 One kit: `src/ds`

- A page is built from `Ds*` composites (`@/ds`) and Nuxt UI parts (`U*`), styled by the theme. **Do not create a module-local kit** (form bar, page header, stat tile, native select wrapper, load-error box, pager, filter bar). If a block is used on two or more pages it belongs in `src/ds`: request it from the design-system owner, do not copy it.
- Import composites from the barrel: `import { DsPage, DsStatTile } from '@/ds'`. Deprecated: `DsPagedTable` and `@/components/data/*` (lint error; use `DsDataTable variant="bare"`).
- Default BM copy of every composite is in `src/ds/copy.ts` (`dsCopy`). Pages pass a label only for a live-exception string or a domain noun. Do not write "Cuba Semula", "Set Semula", "Menunjukkan ... daripada ... hasil" yourself.
- Page structure: root `DsPage`, header `DsPageHeader` (the shell prints the h1 when route meta `shellTitle: true`), sections in `DsPanel`/`DsFormSection`, filters `DsFilterBar`, forms `DsFormField`/`DsFormBar`, tables `DsDataTable`, states `DsEmptyState`/`DsLoadError`/`DsStateView`. The page anatomy per archetype (learner page, list, form, report, dashboard) is in [design language section 9](../design/v2-design-language.md); states in section 10; the G4 review checklist in section 11 is what the reviewer applies.
- Layout and type go through primitives where they exist: `DsStack`, `DsCluster`, `DsGrid`/`DsGridItem`, `DsSplit`, `DsSection`, `DsSurface`, `DsText`, `DsHeading`, `DsSpacer`. The hardening doc is moving pages from raw utilities to these primitives; new code should use them.

### 2.2 Nuxt UI directly, or through a `Ds*` wrapper

| Situation | Use |
|---|---|
| A Nuxt UI component with no project composite (`UButton`, `UInput`, `USelect`, `UTextarea`, `UCheckbox`, `USwitch`, `UModal`, `UTable`, `UAlert`, `USkeleton`, `ULink`, `UAvatar`, `UTabs`, ...) | Use the `U*` component directly. Raw `<button>`, `<input>`, `<select>`, `<textarea>`, `<a>`, `<table>`, `<dialog>`, `<img>` are lint errors in strict files |
| A project composite exists for the pattern (table with pager, filters, form field, stat tile, empty/error state, confirm dialog, page header, status badge) | Use the `Ds*` composite, not the raw `U*` parts |
| You need a look the theme does not give | Never restyle in the page. Change a lever instead: a token (`src/theme/tokens.css`), a `ui.config.ts` entry, or a `Ds*` prop. Ask the design-system owner (design language intro; hardening principle G-13) |
| Icons | Phosphor via the `i-ph-*` collection through component icon props or `DsIcon`. No icon packages (`@lucide/*`, `@iconify-json/*`) in strict files |
| Confirm dialogs | `useConfirm()` (`src/ds/useConfirm.ts`); never `window.confirm` |
| Charts, fonts | Owned by `DsChart` and the theme. Pages do not import `chart.js` or `@fontsource*` |
| `:ui="{...}"`, inline `style`, `<style>` blocks, remote assets, hex colours | Not allowed in strict files |

Nuxt UI facts you need (full detail in the spike): colour mode is **owned by the app** (`src/theme/color-mode.ts`, storage key `pp.theme`, `colorMode: false` in the Vite plugin); a `data-testid` passed to a Nuxt UI component lands on the interactive element for the 15 most used components, with four exceptions listed in the spike, so check the rendered DOM when you put a testid on `UTabs`, `UTable` or an overlay; `ms` locale is in `src/theme/locale-ms.ts`.

### 2.3 The ratchets (debt may only go down)

Three mechanisms keep the codebase moving toward "pages use components and tokens only". All are verified to exist in `package.json`, `scripts/`, `eslint/` and `config/`.

| Name | Command | What it checks | Rule of the ratchet |
|---|---|---|---|
| **Strict lint** (`ds-strict`) | `npm run lint:ds` (runs ESLint and Stylelint only on the globs in `config/ds-strict.json`; `npm run lint` already includes it) | For every listed glob: `pp/ds-class-allowlist` (level `page` or `ds`), no inline style, no `<style>` block, no remote assets, valid icon names, no raw HTML form/table/dialog elements, import bans (legacy `@/components`, `@/shells`, icon packages, fonts/charts on pages). Stylelint (`npm run lint:ds:css`): colour tokens only | `config/ds-strict.json` is **append-only**. `eslint/__tests__/ds-strict-ratchet.test.mjs` fails if an entry disappears or a `page` entry is relaxed to `ds`; the floor is `config/ds-strict.baseline.json`. To add folders append to **both** files in the same commit |
| **Debt counter** (`ds:debt`) | `npm run ds:debt` (readable), `node scripts/ds-debt.mjs --json` | Counts class-token debt per rule (`type`, `spacing`, `surface`, `colour`, `layout`, `ui-prop`, `class-on-ds`, `class-literal-in-ts`) per file in `src/modules`, `src/shells`, `src/components`, `src/pages` | `config/ds-debt.baseline.json` holds per-file counts. `eslint/__tests__/ds-debt-ratchet.test.mjs` fails if any file count goes **up** or a new file has debt. `node scripts/ds-debt.mjs --write-baseline` refuses to raise a number (`--force` is for the platform owner only). After you reduce debt, run `--write-baseline` and commit the lower baseline |
| **No local kits** | runs in `npm run test` (`eslint/__tests__/no-local-kits.test.mjs`) | Files outside `src/ds` named like `*FormBar*`, `*RowMenu*`, `*ActiveFilters*`, `*PageHeader*`, `*PillNav*`, `*StatRow*`, `*LoadError*`, `*ErrorBox*`, `native/*` | Allow-list `config/ds-local-kits.baseline.json` may only **shrink**; a new match, or an entry whose file no longer exists, fails |

Supporting commands: `npm run ds:census` (read-only codemod census, see [ds-census](../qa/ds-census.md)), `npm run report:e2e-class-selectors` (lists E2E selectors that depend on CSS classes, so a restyle does not break them), `node scripts/testid-diff.mjs --write|--compare <file>` (codemod safety net: test ids, routes and BM copy must not change).

**Definition for a restyled module:** append its folders to `config/ds-strict.json` (pages at level `page`; module components that are genuinely visual composites at level `ds` only when agreed), run `npm run lint:ds` until clean, then run `npm run ds:debt` and write a lower baseline. A `ds`-level glob inside a module defeats the page rules; it is a temporary leak the hardening plan wants at zero ([hardening 6.4](../design/v2-ds-hardening.md)).

### 2.4 Tokens, light and dark

- Colours come only from semantic utilities (`bg-default`, `bg-elevated`, `text-muted`, `text-primary`, ...) that `src/theme/tokens.css` resolves per personality (`staff` = Pentadbiran/Guru/Ibu Bapa/Penaja, `learner` = Murid) and per colour mode. Never a palette step (`bg-blue-500`), hex, arbitrary value or opacity hack.
- **Light and dark are mandatory** (D29f). The `.dark` class and `data-personality` are put on `<html>` while a portal layout is mounted (`useThemeMode`), so teleported modals inherit them. You write no `dark:` variants in pages: the tokens do it. Check every screen in both modes (use `/__ds`, `src/dev/ds`, and the page itself).
- Legacy pages that are not migrated render in a light island; migrated pages declare `meta.v2: true` and render directly in the layout.
- Learner-only classes in the theme must be literal strings (Tailwind cannot see interpolated class names).

### 2.5 UI taste rules stated in the docs

Only what the docs state ([design language section 1](../design/v2-design-language.md), user decisions D34 and later):

- **Cozy, not compact:** 16px body, controls at least 44px, table rows at least 56px, 20-24px card padding. The old system is the bar to beat.
- **Radius hierarchy and nesting:** xs 4 tags, sm 8 inputs/chips, md 12 buttons, lg 16 cards/tables, xl 24 modals/hero; a child is always strictly smaller than its container; never a card inside a card. Pages write no `rounded-*` (composites do).
- **Layers, not lines:** surfaces and soft shadow, no borders/dividers/rings except focus and error.
- **Lively through meaning:** colour, motion and depth only where they carry information.
- Official logo without a chip, status always icon plus word, numbers tabular, one `h1` per page.
- Cozy and lively do not mean new features: a restyle changes presentation only.

---

## 3. Data access

### 3.1 The path of a request

```
page / composable -> module api/ client fn -> `api` (ApiClient, src/api) -> Transport -> mock | http
```

- **Never call `fetch`, `XMLHttpRequest` or axios from UI code.** All traffic goes through the module's typed client functions, built on `api.get / api.list / api.post / api.put / api.patch / api.delete` from `@/api`.
- Client functions accept `{ signal }` and return typed DTOs. Example shape (from M05): `fetchDashboard(options) => api.get<Dashboard>('/api/dashboard', ...)`, `fetchPracticeSubjects(options) => api.list<PracticeSubject>(...)`.
- Page data: `useApi(fetcher, deps)` (`@/composables`): fetch on creation, abort the previous request when deps change, stale results never written, `data/error/loading/reload`. Errors are `ApiError` with a code and a BM message from the server; show it, do not invent your own.
- UI code may never import `@/mock` or any `mock/` folder (lint error). Only `src/app/bootstrap.ts` installs the mock.
- **Transport selection** is by `VITE_API_MODE` in `.env.*` (`mock` | `http`; `bootstrap.ts` tree-shakes the mock in `http` builds). The `hybrid` mode planned in [v2-frontend section 6](../architecture/v2-frontend.md) is **not in the code yet** (OQ-FE-1). The switch, base URL, cookies/CSRF and the cut-over order are in the [fullstack integration guide](fullstack-integration-guide.md).

### 3.2 Contract types

- `@pp/contract` (workspace `packages/contract`) is the single definition of API shapes, enums, error codes, session and the access matrix. The envelope and `ApiError` already import it (`src/api/envelope.ts`).
- Today most module DTOs are still hand-written in `src/modules/<slug>/api/types.ts` (UI and mock share them). For **new or changed endpoints that the backend will own**, take the type from `@pp/contract` (`z.infer`) and do not re-declare it; if the schema is missing, the backend lane adds it first (contract first, ADR-0018). Run `npm run contract:check` (fails if `openapi.json` is stale) after any contract change; `npm run contract:emit` regenerates it.
- Endpoint list and status: [API catalogue](../architecture/v2-api-catalogue.md).

### 3.3 Adding a mock handler for a new endpoint

Mock code lives in `src/modules/<slug>/mock/` and is the behavioural reference the NestJS backend replaces. Only the **owner module** of a store may define it (D11/D12, ADR-0013/0014): questions M04, practice sessions/answers/revision/mastery M05, users/schools M01/M02, curriculum M03. Other modules call the owner's repository exports (`@/modules/<owner>/mock`) from their own handlers and never define a second schema or virtual ids.

Steps:

1. Add the DTO type to `api/types.ts` (or take it from `@pp/contract`) and the client function to `api/<area>.ts`.
2. Add the handler in `mock/handlers/<area>.ts` as a `RouteDef[]` using the helpers from `@/mock/define`: `route(method, path, [middleware...], handler)`, `requireAuth()`, `requireRole(...)`, `ok()`, `created()`, `list()`/`paginate()`, `notFound()`, `forbidden()`, `validationError(fields, message)`, `conflict()`, validation helpers (`validate`, `rule`, `required`, `oneOf`, ...). Read `mock/handlers/targets.ts` in M05 for a small complete example. Return the exact BM messages of the SRS/glossary.
3. Register the routes in the module's plugin `mock/index.ts` (`defineMockModule({ id, dependsOn, version, tables, datasets, repositories, seed, finalise, routes, hooks })`). Declare `dependsOn` for every module whose repository you read while seeding.
4. Data: tables via `defineTable`; large collections are **deterministic virtual datasets** (D11) that report live totals and generate rows on demand, with observed anchor records overriding generated rows; every count is computed from the dataset. Seeds mirror observation: never invent records, never tune values so totals agree (CLAUDE.md 6). Use the clock and PRNG from the mock core (`ctx.clock.now()`), never `Date.now()` or `Math.random()` (determinism, ADR-0005/0006).
5. **Bump the plugin `version`** whenever a seed, spec, derive function or cheap field changes, so persisted browser state is rebuilt.
6. Scope and test-data rules for v2: scope is applied inside the handler/repository, never read from query or body; a record outside the caller's scope is a 404 (see [v2-frontend section 6](../architecture/v2-frontend.md)).
7. Tests: handler tests in `__tests__/mock/` (follow `read-handlers.test.ts`), and the boot guard `src/mock/server/__tests__/registry-boot.test.ts` must pass.
8. **Shared mock data changes** (M01 users, M05 practice, M10 classes, M04 questions, anything under `datasets/`, `seeds/`, or a `spec` file owned by another module) must be done in an isolated git worktree and merged back only when `registry-boot.test.ts` and the owner's tests pass (CLAUDE.md 6). Never leave half-done data edits in the shared tree.

---

## 4. State, routing, guards, Mod Pelajar, copy

### 4.1 State

- Server data: `useApi` per page; no global cache. Cross-page client state only in Pinia stores (`src/stores`: `session`, `shell`, `flash`, `notification-badge`). A module that needs its own store creates it inside the module and keeps it private.
- One-time messages across navigation: `useFlash` / `flash` store (consumed by the router after navigation).
- Page title/header: static in route meta; data-driven via `usePageMeta().setHeader()`.
- Persisted browser keys in use: `pp.auth` (session), `pp.theme` (colour mode). Wrap any other `localStorage` use in try/catch; it must work without it.

### 4.2 Routing, roles, portals

- Frames: `meta.layout` chooses `admin`, `user`, `role`, `public-or-user` or `bare`; `src/app/router/layouts.ts` maps it to the shell for the session role (Pembelajaran and Pentadbiran layouts under the prototype scope, legacy shells otherwise). A page never picks a shell itself.
- Guard order (`src/app/router/guards.ts`): session check; `access: 'auth'` without a session goes to `/login`; `roles` mismatch follows `onForbidden` (`landing` redirect to the server-given `landingPath`, or in-place `403`/`404` with the URL unchanged). The guard never reads scope; scope is server-side.
- The target model (route meta `portal`, `menuId`, `capability`, build modes `VITE_PORTAL=all|admin|learn`) is in [v2-frontend sections 3 and 4](../architecture/v2-frontend.md). **It is not in the code yet** (OQ-FE-2). Until a platform task lands it, new routes use `layout` and `roles`; do not invent `portal` meta.
- Roles are English codes (`student`, `teacher`, `parent`, `sponsor`, `school_admin`, `ppd_officer`, `admin`; `jpn_officer` is dropped by D31a). Which screens each role may see is in [role-access-matrix](../requirements/role-access-matrix.md) and, for Pentadbiran, [v2-portals section 6](../requirements/v2-portals.md). Hide a menu item the role may not use; never show a visible-but-forbidden item (US-03).
- Two portals: Pentadbiran (admin, admin_sekolah, pegawai_ppd) and Pembelajaran (murid, guru, ibu bapa, penaja). Cross-portal movement only by role switch, Mod Pelajar, login/logout.

### 4.3 Mod Pelajar

- D31(c): the admin acts as themselves; "Mod Pelajar" is a session mode in which the admin sees the student portal and **everything they write is stamped as test data and excluded from aggregates**. A non-dismissible banner shows while on; "Keluar Mod Pelajar" returns to the previous role.
- Today's prototype implements it in the session store (`enterModPelajar`/exit, `ClientSession.mode`, parked parent session). Screens must not branch on it: write through the normal API and let the mock/backend stamp `is_test`. Only the layout shows the banner.
- [v2-portals US-07](../requirements/v2-portals.md) ("Pratonton sebagai Pelajar", a new tab, read-only) and D31(c) conflict; the architecture doc recommends dropping US-07 (OQ-FE-3). Follow D31(c) and the contract (`mode.kind = 'mod_pelajar'`).

### 4.4 Copy (BM) and fidelity

- UI strings are Bahasa Melayu; code, comments, commits and docs are English. Exact copy matters because tests assert it.
- **Unchanged flows** (CLAUDE.md 6, 8): replicate prestasiplus.cloud first (.my only for what .cloud lacks): every flow, field, button, message and state; do not add features or "improve" working behaviour; broken live behaviour (404, dead links, wrong labels, visual or touch breakage, contradictions) is fixed under the D9 deviation rule and listed in the module's "Fidelity deviations" table; accessibility replicates live (D10).
- **Changed flows** (the two portals, question intake and display, the UI theme, Portal Pentadbiran) follow D28-D32 and the v2 docs ([v2-portals](../requirements/v2-portals.md), [design language](../design/v2-design-language.md), [glossary](../design/v2-copy-glossary.md)). Live copy that works stays verbatim even when it differs from the glossary and is recorded as a live exception.
- Staff copy addresses the user as "anda", learner copy as "awak". Title Case for buttons, headings, table headers; sentence case for hints, toasts, errors. No new English strings.
- Defaults for shared patterns come from `dsCopy`; module-specific strings live next to the code as named constants (as M05 does), never repeated as scattered literals.
- **Privacy:** never write a real person's name (author, teacher, principal, student) in code, seeds, tests, docs or fixtures; use fictitious names. Credentials never go into the repo (they are in `<credentials file outside the repo>`, outside it).
- **Hide unbuilt screens.** Do not create a placeholder page or a menu entry that says "Belum tersedia". Items that are not built stay in the docs backlog only. (The existing prototype-scope page `Belum Tersedia dalam Prototaip` and the `/admin/p/*` placeholders are legacy; see OQ-FE-4.)

---

## 5. Responsive: 375 / 768 / 1280

- **Mandatory** (CLAUDE.md 7): works from 320px up, tablet and desktop, **no horizontal page scroll**, controls at least 44px on staff pages, nothing hidden behind the bottom navigation. Design specs define each screen at 375 / 768 / 1280.
- Build mobile-first: let `Ds*` primitives and `DsDataTable` (card list on mobile) do the reflow; long text containers need `min-w-0` and `truncate`; flex children that hold long strings must be allowed to shrink (the cause of the two Major defects in the [responsive sweep](../qa/v2-responsive-sweep.md)).
- Shell breakpoints: sidebar from 1024px (Tailwind `lg`); below it a drawer and bottom navigation. Specs branch on `isDesktopShell(page)`, never on the project name.
- **How E2E covers it:** `playwright.config.ts` defines three projects, `mobile` 375x812, `tablet` 768x1024, `desktop` 1280x800 (Chromium); every spec runs on all three automatically. Assert layout with `expectNoHorizontalScroll(page)` from `e2e/support` (`scrollWidth <= clientWidth`), and `expectTouchTarget(locator, 44)` where relevant. A screen that breaks at any of the three fails G4/G5.
- Also check 320px manually when you touch headers, filter bars or wide tables, and light + dark at 375.

---

## 6. Test ids

- Attribute `data-testid`, kebab-case, `<scope>-<screen>-<element>[-<key>]` ([overview 12.3](../architecture/overview.md)). Scope is the module (`m05`...), `shell-admin`, `shell-user`, `public`, or `cmp` for shared components. Repeated rows include the record id (`m02-users-row-5001-toggle`).
- **Required coverage:** every page root, every primary action (submit, save, next), every form control that a test must fill, every list/table row (with id), every state container (loading, empty, error), every toast/banner, every dialog and its confirm/cancel. Text that is unique and exact is preferred as a locator (`getByRole`, `getByText` with exact BM copy); a testid is for absent, ambiguous or repeated text.
- **Never remove or rename an existing testid, role or BM text in a restyle** (ADR-0015 rule 7; DoD item 3). Use `scripts/testid-diff.mjs` when doing mechanical edits. Test ids stay in the demo build.
- Put the testid on the component that renders the interactive element and verify it lands there (spike: UButton, UInput, UTextarea, UCheckbox, USwitch, USelect and `UButton to` forward it; check wrappers for `UTabs`, `UTable`, overlays).
- Never assert Tailwind class names in tests; use `toHaveCSS` for style ACs.

---

## 7. Tests and commands

All names below were checked against `package.json` and `scripts/`.

| Purpose | Command | Notes |
|---|---|---|
| Dev server | `npm run dev` | Mock server with test hooks, http://localhost:5173. Check the port is free first (another session may own it); do not start servers you will not stop |
| Type-check | `npm run typecheck` | `vue-tsc -b --noEmit`, strict |
| Lint (everything) | `npm run lint` | ESLint (module boundaries + strict DS rules) then Stylelint (`scripts/lint-ds-css.mjs`); both always run |
| Lint, autofix | `npm run lint:fix` | |
| Strict DS lint only | `npm run lint:ds` | Quick loop over `config/ds-strict.json` globs |
| DS debt | `npm run ds:debt` | Section 2.3 |
| Format check | `npm run format:check` | Prettier: single quotes, no semicolons, width 100, Tailwind class order |
| Unit/component tests | `npm run test` | Vitest, project `unit`: `src/**/__tests__/**/*.test.ts`, `packages/**`, `scripts/**/*.test.mjs`, `eslint/**/*.test.mjs` (the ratchet tests run here) |
| One test file | `npx vitest run --project unit <path>` | Component tests opt into jsdom with `// @vitest-environment jsdom`; the default is node |
| Perf budgets | `npm run test:perf` | Only when you touch dataset/aggregate code |
| Contract | `npm run contract:check` | After any `@pp/contract` change; `contract:emit` regenerates |
| E2E, one module | `npm run test:e2e:module -- m05-practice` | Runs `e2e/<slug>` on all three viewports; the Playwright `webServer` builds `build:e2e` and serves it on port 4173 |
| E2E, all | `npm run test:e2e` | Heavy; per gate or nightly |
| E2E without unverified | `npm run test:e2e:observed` | Excludes `@provisional` |
| E2E trace check | `npm run check:trace` | Every `E2E-Mxx-nn` id of an approved SRS appears in exactly one test title |
| Build | `npm run build` | `vue-tsc -b`, demo build, bundle budget check |
| Full G3 evidence | `npm run verify` | lint + typecheck + test + build |

E2E conventions (from `e2e/support` and `e2e/fixtures/test`): import `test`/`expect` from `../fixtures/test`; use the `loginAs(who)` fixture (demo accounts from README), `gotoApp(path)` (never bare `page.goto`), the `mock` fixture for hooks, `mockInit` for latency/clock; tag with `moduleTag(n)` and `TAG.smoke`, mark unverified behaviour `@provisional`; name tests `E2E-Mxx-nn ...` when an SRS id exists; keep a spec file per screen group in `e2e/<mNN-slug>/`. The extra `playwright.*.config.mjs` files (own ports 5021, 5024, 5142, 5190...) exist so a session can run without clashing with the shared 4173/5173; copy that pattern with your own port, and never kill other sessions' node, vite or Playwright processes.

### Which to run when

| Change | Run (targeted) |
|---|---|
| Copy/style tweak in one page | `npm run lint:ds` (if the page is strict), `npx vitest run --project unit <that module's __tests__>`, `npm run typecheck` |
| New or changed page/component in a module | The above plus `npm run test:e2e:module -- <slug>` |
| New endpoint / mock handler | Module `__tests__/mock`, `registry-boot.test.ts`, `npm run typecheck`, E2E of the module |
| Change to `src/ds`, `src/theme`, `eslint/`, `config/` | `npm run lint`, `npm run test` (full unit incl. ratchets), `/__ds` gallery in light and dark |
| Contract change | `npm run contract:check`, `npm run test`, `npm run typecheck` |
| **Per gate (G3 evidence)** | `npm run verify`; G4/G5 add E2E of the touched modules at all three sizes |
| Release (G6) | Full `npm run verify` plus full `npm run test:e2e` by the devops/QA role |

Report real command output, never "should pass" (CLAUDE.md 7). Strategy and role split: [test strategy](../qa/v2-test-strategy.md).

---

## 8. Checklists (copy into the PR description)

### 8.1 New screen

```
Screen: <name>   Module: mNN-slug   Route: <path>   Roles: <list>   Doc/AC: <URS/SRS/v2 doc ids>
[ ] Requirement + design spec exist for this screen (docs/requirements, docs/design); copy is exact BM
[ ] Role access matches docs/requirements/role-access-matrix.md or v2-portals section 6
[ ] DTO types (api/types.ts or @pp/contract) and typed client fn in api/; no direct fetch
[ ] Mock handler + seed in the OWNER module only (D11/D12); plugin version bumped; registry-boot test green
[ ] Route fragment in routes/<group>.ts: lazy string-literal import, name mNN.x, meta layout/access/roles/title/header/module
[ ] Page uses DsPage + DsPageHeader + Ds*/U* components only; no local kit, no raw HTML controls, no :ui, no <style>, no rounded/shadow/hex
[ ] All states built: loading (skeleton), empty (never created / no match), error (DsLoadError + retry), submit error, success toast, permission (403/404)
[ ] BM strings: dsCopy defaults used; live exceptions listed; no real person names
[ ] data-testid on page root, actions, controls, rows (with ids), states, dialogs
[ ] Light and dark checked; radius nesting holds; numbers tabular; status = icon + word
[ ] 375 / 768 / 1280 (+320): no horizontal scroll, controls >= 44px
[ ] Unit/component tests + mock handler tests written; E2E spec in e2e/<slug>/ runs at all 3 viewports
[ ] Module folders appended to config/ds-strict.json (+ ds-strict.baseline.json); npm run lint:ds clean; ds:debt not higher
[ ] npm run lint, typecheck, test, test:e2e:module -- <slug> pasted with real output
[ ] Docs updated if behaviour diverges (module doc, deviations table); TRACKER row left to the Delivery Lead
```

### 8.2 Changed screen (restyle or behaviour change)

```
Screen: <name>   Change type: restyle | behaviour | copy   Track: Fast | Standard | Full
[ ] A restyle changes NO behaviour (flows changes are their own task); no flow change hidden in a style PR
[ ] Existing data-testid, roles and BM texts unchanged (run scripts/testid-diff.mjs if mechanical); copy changes listed with the doc that requires them
[ ] Selectors that depend on CSS classes fixed (npm run report:e2e-class-selectors)
[ ] Local kits replaced by Ds* (name-pattern test passes; baseline shrinks, never grows)
[ ] Strict folders appended; ds:debt baseline lowered with --write-baseline
[ ] Mock/contract change? then owner module, version bump, worktree if shared store, registry-boot green
[ ] Re-test the affected ACs at 375 / 768 / 1280, light and dark
[ ] lint, typecheck, unit, module E2E output attached
```

---

## 9. Process reminders

- Branch `feature/<slug>`, Conventional Commits `type(scope): summary`; never commit to `main`; commit only when the user asks (checkpoints per the project memory). v2 frontend task branches are `feature/v2-<task-id>` from `feature/v2-frontend` ([v2-frontend 10.3](../architecture/v2-frontend.md)).
- Pick the lightest change track (Full, Standard, Fast, Trivial) and say which; gates G1-G6 and roles are in CLAUDE.md. Parallel agents get disjoint file sets.
- Several sessions share one tree: keep scratch files in your own scratchpad subfolder, do not touch `.claude/worktrees/`, never kill all node processes.
- When code and doc disagree, the TRACKER decisions win, then requirements, architecture/ADR, design, code (AGENTS.md section 3). Report real conflicts; if code must diverge, update the doc in the same change.

---

## 10. Open questions and contradictions (OQ-FE)

| ID | Question or contradiction | Impact | Suggested default |
|---|---|---|---|
| OQ-FE-1 | [v2-frontend section 6](../architecture/v2-frontend.md) plans `HybridTransport` (`VITE_API_MODE=hybrid` with path prefixes) and `HttpTransport` cookie/CSRF hardening (V2-T31). The code has only `mock` and `http` modes; `VITE_API_MODE` is typed `'mock' \| 'http'` | Screens cannot yet be cut over one domain at a time | Write clients against `api` only; the switch is documented in the integration guide when T31 lands |
| OQ-FE-2 | The architecture defines route meta `portal`/`menuId`/`capability`, `src/portals/*`, `config` build modes `VITE_PORTAL`. The code still uses `layout` + `roles`, layouts in `src/shells/{pembelajaran,pentadbiran}` and `meta.v2` | A new route cannot declare its portal | Use `layout`/`roles`/`v2` now; platform task converts manifests (V2-T11/T12) |
| OQ-FE-3 | v2-portals US-07 (open a real student's view in a new tab, read-only) conflicts with D31(c) Mod Pelajar (admin acts as self, writes stamped test data). The prototype implements Mod Pelajar in the client session store, while the architecture specifies server `POST /session/mode`. Also `Role` in `src/stores/session-types.ts` still lists `jpn_officer`, which D31a drops | Mod Pelajar-aware screens may need rework | Follow D31(c); do not branch screens on the mode |
| OQ-FE-4 | The "hide unbuilt screens, no placeholder pages" rule (project memory) vs. code that still ships the prototype-scope "Belum tersedia dalam prototaip" page and `/admin/p/*` placeholders | New work must not add placeholders; existing ones remain until removed | Do not add; ask the Delivery Lead before deleting existing ones |
| OQ-FE-5 | Test-id convention `<scope>-<screen>-<element>` with module scope (`m05-...`, overview 12.3) vs. M05 specs that use short ids such as `dash-hero`, `dash-continue` | A new reader cannot tell which style is current | New ids use the documented convention; never rename existing ids |
| OQ-FE-6 | [DS hardening](../design/v2-ds-hardening.md) names rules (`pp/ds-no-type-utility`, `ds-no-spacing-utility`, `ds-no-surface-utility`, `ds-no-colour-utility`, `ds-no-ui-prop`, `ds-no-class-on-ds`, `enforce` list, `pnpm ds:debt`) that do not exist in `eslint/rules/` yet (only `ds-class-allowlist`, `ds-icon-names`, `ds-no-dynamic-class`, `ds-no-inline-style`, `ds-no-remote-assets`, `ds-no-style-block`). The project uses npm, not pnpm. The "strict" ratchet has no npm script of its own (`lint:ds`) | The set of banned utilities on pages differs from the hardening plan | Treat `eslint/class-allowlist.mjs` as the truth today; use primitives (`DsStack`, `DsText`, ...) in new code anyway |
| OQ-FE-7 | Hardening plan lint L2 (raw `<select>/<label>/<table>` banned in all `src/modules`) and L5 (copy lint, `config/copy-exceptions.json`) are not present in `config/` or tests | Raw controls and off-glossary copy in non-strict files are not caught | Follow the rules by hand; they bind at G4 review |
| OQ-FE-8 | Several `config/ds-strict.json` entries grant level `ds` to module folders (leak). Which module components may legitimately be `ds` level? | Contributors may copy the leak | New module work uses level `page`; ask the design-system owner for `ds` |
| OQ-FE-9 | `e2e/` has no `m18` or `m28-bijak-spm` folder although modules exist; extra `playwright.*.config.mjs` files with fixed ports exist per session | Module E2E command fails for those slugs | Create `e2e/<slug>/` with the first spec; use a private port config when sharing a PC |
| OQ-FE-10 | The architecture doc names composites with a `Pp` prefix in places (`Pp scope chip`) while shipped components are `Ds*` | Naming confusion | Shipped `Ds*` names are the source of truth ([ds-consolidation](../design/v2-ds-consolidation.md)) |
