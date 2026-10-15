# V2-T02 Nuxt UI spike: findings (slug: v2-frontend)

| Field | Value |
|---|---|
| Task | V2-T02 (`docs/architecture/v2-frontend.md` section 10, risk R1) |
| Date | 2026-10-16 |
| Owner | frontend-developer |
| Decision it informs | ADR-0015 (Nuxt UI with our own theme), TRACKER D28 to D34 |
| Verdict | **Go.** Nuxt UI 4.12 works in plain Vue + Vite + vue-router 5. Two things must be handled by V2-T03 (colour-mode storage key, legacy CSS reaching new pages); the Dashboard fallback is not needed. |

Versions installed: `@nuxt/ui` 4.12.0, `@iconify-json/lucide` 1.2.144, on the existing `vue` 3.5, `vue-router` 5.3, `vite` 8.3, `tailwindcss` 4.3. `@nuxt/ui` peer ranges (`vue-router ^4.5 || ^5`, `tailwindcss ^4`) are satisfied.

## 1. Check table

| # | Check | Result | Evidence | Decision / fallback |
|---|---|---|---|---|
| a | vue-router 5 compatibility, plugin `router` option, links | **Pass** | `app.use(router)` then `app.use(ui)`; no console errors or warnings at 375/768/1280. `UButton to="/__dev/tokens"` navigated to `/__dev/tokens`. `UNavigationMenu` items with `to` render `<a>` and work. In the plugin source (`runtime/vue/plugins/router.js`) the `router` option is only a custom function provided as `nuxtui:router`; with vue-router installed the Vite plugin auto-selects the `vue-router` link override (`RouterLink`), so no option is needed. | Use the default. Install `ui` after `router`. Fallback `router: false` (own link component) not needed. |
| b | Does the plugin register Tailwind itself? | **Yes** (`unplugin.mjs` returns `tailwind()` from `@tailwindcss/vite` inside `NuxtUIPlugin`) | Removed our explicit `tailwindcss()` from `vite.config.ts`. Build plugin timings list exactly one `@tailwindcss/vite:generate:build` (15 calls). Dev server and build both fine. | Single registration through `@nuxt/ui/vite`. `@tailwindcss/vite` is now only a transitive dependency; V2-T03 may drop it from `devDependencies` (kept in the spike to avoid lockfile churn). `tailwindcss` stays (CSS `@import`). |
| c | Dashboard\* components and UDashboardSearch outside Nuxt | **Pass** | `UDashboardGroup` + `UDashboardSidebar` (collapsible) + `UDashboardPanel` + `UDashboardNavbar` + `UDashboardSidebarCollapse` render and collapse. `UDashboardSearch` opened with **Ctrl+K** (one dialog, one input). Internally they use the plugin's `#imports` stubs (`useNuxtApp` hooks, `defineShortcuts`), not Nuxt itself. Notes: `UDashboardGroup` is `fixed inset-0` by default (the sandbox overrides it with `!relative !inset-auto`); use `storage="local"` (default `cookie` is a stub with no SSR cookie); `storage` is typed `'local' | 'cookie'`. | Use Dashboard components for the portal layouts. Fallback (USlideover + UNavigationMenu + UCommandPalette in UModal) not needed. |
| d | `ms` locale | **Exists** | `@nuxt/ui/locale` exports `ms` (name "Melayu", code `ms`). `<UApp :locale="ms">` rendered the modal close button with `aria-label="Tutup"`. | Use the built-in `ms`. For wording we want to change, `defineLocale({ ...ms, messages: ... })` or `extendLocale(ms, {...})` in `src/theme/locale-ms.ts` (V2-T03); not needed to start. |
| e | `data-testid` forwarding on 15+ components | **Pass with 4 rules** | 31 testids probed (Playwright, `forward.mjs`). Lands on the interactive element for UButton (`button`), UInput (`input`), UTextarea (`textarea`), UCheckbox (`button[role=checkbox]`), USwitch (`button[role=switch]`), USelect (`button[role=combobox]`, not the listbox), UButton `to` (`a`), UBadge/UAvatar (`span`), UNavigationMenu/UPagination (`nav`), UColorModeButton (`button`), UIcon (`svg`). Lands on the **root wrapper** (a `div`): UTabs, UCard, UTable, UAlert, UProgress, UFormField, UDashboard\*. **Not forwarded**: UModal, USlideover, UDashboardSearch, UDropdownMenu (portal content, root attrs dropped). Interaction through `getByTestId` worked (`fill`, `click`, checkbox `aria-checked`). | Rules for E2E and `Pp*` composites: (1) put the id on the element you act on; (2) for overlays use `:content="{ 'data-testid': 'x' }"` (verified on UModal, gives `div[role=dialog]`; typed props reject it, cast needed) or ids on slot content; (3) for UTabs use `getByRole('tab', { name })`, for UTable `getByRole('table')` / `locator('table')`; (4) `Pp*` composites forward `data-testid` to the interactive part. R3 stays open for the module restyles, but nothing blocks. |
| f | CSS token or class collisions, existing pages unchanged | **Collisions found and fixed; pages unchanged** | See section 3. Legacy `--color-primary/success/warning/info` (theme.css) beat Nuxt UI's `@theme default inline` aliases, so `bg-primary` rendered indigo-500 `#6366f1` instead of kobalt. Renamed the four legacy tokens to `--color-live-*` (no page used the utilities; only `src/styles/tokens.ts` gallery and one unit test changed). Existing pages: 400 computed-style samples per page on `/login`, `/register`, `/tidak-wujud` at 375 and 1280, baseline build vs new build: **0 differences**; `<html>` class unchanged; body colour unchanged. | V2-T03 and V2-T21 must handle the three remaining hazards in section 3 (legacy `h1-h6` and `body` base rules, global radius scale, colour-mode storage key). |
| g | Bundle size vs `check-demo-bundle.mjs` | **Pass (guard); size grows** | `check-demo-bundle: OK (3 marker(s), 668 file(s) checked in dist)`. The script only scans for test-hook markers, it has no size budget. Deltas in section 4. | Add a size budget to the script in V2-T03 (R7). Evaluate `experimental.componentDetection` (CSS -17 %). |
| h | Theming: kobalt primary, ink neutral, no borders | **Pass** | `ui.colors.primary = 'kobalt'`, `neutral = 'ink'` through the plugin `ui` option; palettes declared with `@theme static` (`src/theme/tokens.css`). Computed: primary button bg `#3b5cff` (kobalt-500; light shade is set by `--ui-primary`, V2-T03), neutral surfaces ink (`bg-muted` `#f5f7fb`, `text-muted` `#5f6a84`). Tonal default button (`defaultVariants.variant: 'soft'`): bg `oklab` 10 % kobalt, text kobalt, no ring, no shadow, border 0. Filled borderless input (`defaultVariants.variant: 'soft'` + `bg-elevated`): bg `#ebeef5` (ink-100), box-shadow `none`, border 0; focus: `0 0 0 2px inset #3b5cff`. Dark: primary `#6283ff` (kobalt-400), input `#262d40` (ink-800). | Config shape is the final one: `src/theme/ui.config.ts` passed to the plugin (`ui:`); no `app.config.ts` needed in Vue. Note: Nuxt UI's default variant for input is `outline`; the borderless filled style is `soft`, so set `defaultVariants` rather than overriding `subtle`. |

Other results of the sandbox:

| Item | Result |
|---|---|
| `/__ds` renders every required component | Pass: UButton solid/soft, UInput, USelect, UTabs, UCard, UBadge, UModal, toast via `useToast` (message shown), UTable, UDashboard\*, UDashboardSearch (Ctrl+K), UNavigationMenu, UColorModeButton (toggles `light`/`dark` on `<html>`), UIcon `i-lucide-*` (offline; Iconify JSON bundled, no network request). |
| No horizontal page scroll at 375 / 768 / 1280 | Pass: `scrollWidth == clientWidth` at all three. |
| Console | No errors or warnings during the whole interaction run. |
| Extra components exercised | UFormField, UTextarea, UCheckbox, USwitch, UAlert, UProgress, UPagination, UAvatar, UDropdownMenu, USlideover. |
| Type-check without generated d.ts | `vue-tsc -b` passes without `components.d.ts` (unknown components are untyped, not errors); with the files present, props are typed. `vite dev` and `vite build` regenerate both files. |

## 2. Install steps (exact)

1. `npm i @nuxt/ui @iconify-json/lucide`
2. `vite.config.ts`: remove the explicit `tailwindcss()` plugin, add after `vue()`:

   ```ts
   import ui from '@nuxt/ui/vite'
   import { uiConfig } from './src/theme/ui.config.ts' // keep the `.ts` extension (Vite native config loader)

   plugins: [
     vue(),
     ui({
       colorMode: true,
       theme: { colors: ['primary', 'secondary', 'success', 'info', 'warning', 'error', 'neutral'] },
       ui: uiConfig,
     }),
   ],
   ```

3. `src/styles/main.css`, right after `@import 'tailwindcss' source('../');`:

   ```css
   @import '@nuxt/ui';
   @import '../theme/tokens.css';
   ```

4. `src/app/bootstrap.ts`: `import ui from '@nuxt/ui/vue-plugin'` and `app.use(ui)` **after** `app.use(router)`.
5. Wrap pages that use overlays (toast, modal, tooltip) in `<UApp :locale="ms">` (`import { ms } from '@nuxt/ui/locale'`). The spike wraps only `/__ds`, so the legacy app is untouched.
6. `.gitignore`: `auto-imports.d.ts` and `components.d.ts`. `tsconfig.app.json` `include`: add both files.
7. Vitest: alias `@nuxt/ui/vue-plugin` to a stub (`src/test-support/nuxt-ui-plugin-stub.ts`). The real module is a virtual module (`virtual:nuxt-ui-plugins`) that Vitest's Node loader cannot load (`bootstrap.test.ts` failed with `Only URLs with a scheme in: file, data, and node are supported ... 'virtual:'`). `src/styles/__tests__/tokens.test.ts` compiles `main.css` itself and replaces `@nuxt/ui` with an empty sheet (`#build/ui.css` exists only inside Vite).
8. Dev-only route `/__ds` (`dev.ds-sandbox` in `core-routes.ts`, registered when `import.meta.env.DEV` or mode `demo`, never in the e2e build) lazy-loads `src/dev/ds/DsSandbox.vue`.
9. `bootstrap.ts` seeds `localStorage['vueuse-color-scheme'] = 'light'` when unset (reason in section 3, hazard 3).

## 3. Collisions and hazards for V2-T03 and V2-T21

1. **Colour aliases (fixed).** Nuxt UI declares `--color-primary: var(--ui-primary)` (and secondary, success, info, warning, error, neutral) in `@theme default inline`. User `@theme` wins, so the legacy `--color-primary/-success/-warning/-info` shadowed them. Renamed to `--color-live-*`. Other legacy semantic names (`--color-muted`, `--color-text`, `--color-border`, `--color-surface`, `--color-danger`, ...) do **not** collide in practice: Nuxt UI uses the `--text-color-*`, `--background-color-*` and `--border-color-*` namespaces, which take precedence for `text-muted`, `bg-muted`, `border-default` (verified: `bg-muted` = ink-50, `text-muted` = ink-500). The legacy gallery tokens `bg-muted` and `bg-border` now show the Nuxt value; no page uses them.
2. **Legacy base rules reach new pages (open, V2-T21).** `base.css` sets `h1-h6 { color: var(--color-text-strong) }` (slate-800) and `body { color }`. On a Nuxt UI page in dark mode, headings are invisible (seen in the `/__ds` dark screenshot). The `.legacy-ui` nesting plan in v2-frontend section 5.3 must also wrap the `@layer base` rules, not only `live-globals.css`. Until then new pages must set heading colour explicitly.
3. **Colour mode (open, V2-T03).** The plugin hard-codes `useDark()` of VueUse: storage key **`vueuse-color-scheme`** (not configurable, so the planned key `pp.theme` is not available unless we drop the plugin's colour mode and write our own `UColorModeButton`), values `light | dark | auto`, class `.dark` on `<html>`. With nothing stored it follows the OS, which turned the body of `/login` dark (`rgb(23, 28, 45)`) for OS-dark users. Fixed for now by seeding `light` when unset; verified `<html>` class and body background unchanged under `prefers-color-scheme: dark`. Decision needed in V2-T03: accept the key `vueuse-color-scheme` (recommended, no code) or set `colorMode: false` and own the toggle. When the user toggles dark on a new page then opens a legacy page, `.dark` stays on `<html>`: `LegacyScope` must force a light surface (already planned).
4. **Radius scale (open, V2-T03).** Nuxt UI redefines `--radius-xs..3xl` as `calc(var(--ui-radius) * n)` (inline, resolved on the element). With `--ui-radius: 0.25rem` (default) the legacy `rounded-*` values are identical to Tailwind's (verified `rounded-lg` = 8px). The design spec wants 0.5rem or 0.375rem: set `--ui-radius` **on the portal layout root**, never on `:root`, or every legacy `rounded-*` changes.
5. **Fonts.** The spike keeps `fonts: false` (plugin default in Vue) and Inter/Outfit. The design spec names Bricolage Grotesque and Plus Jakarta Sans: self-host them in V2-T03 as the legacy ones are.
6. **Auto-import and components.** The plugin brings `unplugin-auto-import` and `unplugin-vue-components`; a second instance of either throws at config time. Components resolve by `U` prefix without imports (the project's ESLint rule on explicit imports does not apply to them). `useColorMode` is not available to app code (only inside the plugin's `#imports` stubs); read the `<html>` class or import from `@vueuse/core` (add it as a direct dependency first).
7. **Build time.** The demo build went from about 14 s to 20 s (icons, auto-import and component plugins).
8. **Pre-existing test failure (not caused by this work).** `src/modules/m04-question-bank/__tests__/mock/questions-store.test.ts` "PKSK rows take ids from 177698 ..." fails with and without Nuxt UI (verified with a config that has no Nuxt UI plugin): a PKSK question text contains "inovasi". Belongs to M04 data.

## 4. Bundle impact (demo build, `vite build --mode demo`)

| Measure | Baseline (before) | With Nuxt UI | Delta |
|---|---|---|---|
| Entry JS `index-*.js` (raw / gzip) | 186,303 / 49,186 B | 227,733 / 62,406 B | **+41,430 / +13,220 B** |
| Entry CSS `index-*.css` (raw / gzip) | 252,186 / 39,831 B | 435,483 / 60,707 B | **+183,297 / +20,876 B** |
| All `.js` in `dist` (raw / gzip) | 6,897,354 / 1,952,851 B | 7,721,272 / 2,177,052 B | +823,918 / +224,201 B |
| All `.css` in `dist` (raw / gzip) | 275,481 / 46,630 B | 458,778 / 67,506 B | +183,297 / +20,876 B |
| Lazy `/__ds` chunk (dev and demo only) | n/a | 483,612 / 113,592 B | all of the JS delta except the entry; not shipped by the e2e build |
| Files in `dist` | 722 | 732 | +10 |

With `experimental: { componentDetection: true }` (Tailwind scans only the 42 components the sandbox uses): entry CSS 359,737 B (51,855 gzip), i.e. -75,746 B raw, -8,852 B gzip against the default. Not enabled (keeps default behaviour); V2-T03 should evaluate it once the real component set is known, and add `dynamic` ones through the array form.

The entry JS includes the plugin runtime (icons, head, router, colour mode) and is paid by every page; a learner build with the split portals (V2-T23) shares it.

## 5. Test and quality evidence

Run in the worktree on branch `worktree-agent-a74414a970827f075`.

| Command | Result |
|---|---|
| `npm run typecheck` | Pass (also pass after deleting the generated d.ts files). |
| `npm run lint` | 9 errors, 2 warnings, **all pre-existing and in files this task did not touch** (four `e2e/**/qa-g5-*.spec.ts` unused vars, four `playwright.*.config.ts` parsing errors, one `vue/one-component-per-file` warning pair in an M06 test). No finding in any changed file. |
| `npm run test` | Final full run: 410 of 412 files pass, 7042 tests pass, 2 fail. (1) `questions-store.test.ts` PKSK test: the pre-existing failure of section 3 item 8. (2) `app/__tests__/registry.test.ts` "lazy-load one mock plugin per module" timed out at 30 s while the whole suite ran; run alone it passes (4 of 4, 19 s). It loads every module's mock plugin, so the extra plugin transforms (auto-import, components) make it slower under load; V2-T03 should raise its timeout or exclude the Nuxt UI transform plugins from Vitest. Before the fixes in section 2 step 7, `bootstrap.test.ts` and `tokens.test.ts` failed because of Nuxt UI; both pass now. On a loaded machine the `questions-store` `beforeAll` can also exceed the 60 s hook timeout. |
| `npm run build` | Pass: `vue-tsc -b`, `vite build --mode demo`, `check-demo-bundle: OK (3 marker(s), 668 file(s) checked in dist)`. |
| E2E smoke (`playwright test`, own port, e2e build): `global/not-found`, `global/guards`, `global/user-shell`, `m01-authentication/smoke-auth` at mobile, tablet and desktop | 48 of 48 pass. |
| `/__ds` smoke (dev server on port 5199, Playwright script) | Renders at 375, 768, 1280 with no console error, no horizontal scroll; modal, toast, Ctrl+K, colour-mode toggle, link navigation work. |

## 6. Recommendations

**V2-T03 (theme)**
- Keep the config shape: `src/theme/ui.config.ts` (plugin `ui:` option) and `src/theme/tokens.css` (`@theme static` palettes plus `--ui-*` overrides under `:root` and `.dark`). The spike files are a deliberately small subset (kobalt, ink only).
- Remaining palettes from `docs/design/v2-design-system.md` section 3.1 must be declared with `@theme static` and listed in `theme.colors` (custom aliases such as `reward` work the same way).
- Set `--ui-primary` to `var(--ui-color-primary-600)` (light) and `-400` (dark); the default shade is 500.
- Decide the colour-mode key (section 3, hazard 3) and the default scheme per portal (D34: dark recommended default for Murid is a per-role preference, not the plugin default).
- Scope `--ui-radius` to the portal layout root.
- Add the size budget to `scripts/check-demo-bundle.mjs` and decide `componentDetection`.
- Remove `@tailwindcss/vite` from `devDependencies` if nothing else imports it.
- Keep `src/test-support/nuxt-ui-plugin-stub.ts` and the Vitest alias; remove the sandbox `DsSandbox.vue` when V2-T05 delivers the gallery.

**V2-T04 (strict tooling)**
- The class allowlist must know the Nuxt UI semantic utilities (`bg-default`, `bg-muted`, `bg-elevated`, `text-muted`, `text-dimmed`, `ring-primary`, ...) and the project aliases, and reject palette steps (`bg-kobalt-500`) outside `src/theme`.
- ESLint for `.vue`: components resolve through the plugin, so `vue/no-undef-components` must be off or fed the generated `components.d.ts`.
- The E2E selector report should flag selectors on a wrapper for UTabs, UTable and overlays (check e rules).
- The generated `components.d.ts` and `auto-imports.d.ts` need to be ignored by ESLint and Prettier (they are already `.gitignore`d; `npx eslint` on them reported nothing in this run, keep it that way).
- Lint rules that forbid raw `<table>`, `<dialog>` and form elements will not trip on Nuxt UI's own output (rules run on our templates only).
