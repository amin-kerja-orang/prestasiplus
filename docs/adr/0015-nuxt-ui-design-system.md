# ADR-0015: Nuxt UI (plain Vue + Vite) as the v2 design system, with a strict "components + tokens only" rule

- **Status:** Proposed
- **Date:** 2026-10-16
- **Related:** TRACKER D29(d,e,f), D28; `docs/architecture/v2-frontend.md` §5 and §7; `docs/design/v2-design-system.md` (visual spec, owned by ui-ux-designer)
- **Supersedes in part:** ADR-0003 (Tailwind v4 and styling). Tailwind v4 itself stays. What is superseded: "unchanged default palette", "copy live class lists where captured" and the live-fidelity styling conventions, for every file listed in the strict ratchet (see Decision 6). ADR-0003 remains valid for code not yet migrated. ADR-0010 (icons) gains an Iconify path for Nuxt UI `icon` props (Decision 5).

## Context
- D29(d) fixes the design system as Nuxt UI with our own theme (it must not look like stock Nuxt UI). D29(e): pages use only design-system components and theme tokens; Tailwind utilities are allowed for layout only, with no arbitrary colours or values. D29(f): light and dark mode.
- The app is a plain Vue 3 + Vite SPA (not Nuxt) with Tailwind v4 already installed (`@tailwindcss/vite`), 660 `.vue` files, 5,016 `data-testid` attributes in source and 135 Playwright specs that mostly select by test id and role.
- Nuxt UI documents a plain Vue + Vite install: the `@nuxt/ui/vite` plugin after `vue()`, `app.use(ui)` from `@nuxt/ui/vue-plugin`, `@import "tailwindcss"; @import "@nuxt/ui";` in the main stylesheet, a `<UApp>` root wrapper, a `router` option (true = vue-router), a `ui` option in the plugin that replaces Nuxt's `app.config.ts`, and `colorMode` driven by `@vueuse/core`.
- Known friction of the plain-Vue path (from the Nuxt UI docs): generated `auto-imports.d.ts` and `components.d.ts` need tsconfig and gitignore entries, type-checking can fail on a clean checkout before the first build, and component detection picks up newly used components only after a dev-server restart.

## Decision
1. **Adopt Nuxt UI (current major, v4 line) through its Vite plugin.** Components are auto-registered (`U*`). The project does not wrap every component. It adds a thin composite layer `src/ds/` (prefix `Pp`) only for patterns the design spec names (page header, stat card, data table with our defaults, empty state, scope chip, and similar).
2. **Theme lives in `src/theme/`:** `tokens.css` (the `@theme` block: palette, radius, shadow, type scale, motion, plus the `--ui-*` overrides for light and `.dark`) and `ui.config.ts` (colour aliases and per-component slot/variant overrides, passed to the Vite plugin's `ui` option). Token values come from `docs/design/v2-design-system.md`; this ADR fixes only the location and mechanism.
3. **Light and dark** through Nuxt UI's `colorMode` (class strategy, storage key `pp.theme`, default = system). Semantic tokens only; no `dark:` utilities in pages.
4. **Strictness is enforced by tooling, not review** (rule from D29(e)):
   - ESLint: a small local rule `pp/ds-class-allowlist` checks every static `class` attribute and static `:class` string/object key in `.vue` templates. Allowed: layout and spacing utilities on the token scale (display, flex, grid, gap, padding/margin on the scale, width/height keywords, alignment, `col-span`, responsive and `hidden` variants, `truncate`, `sr-only`). Rejected: any arbitrary value (`[...]`), any colour/ring/shadow/gradient/opacity/font-size/radius utility, `!` important modifier, `style` attributes with colour or size values.
   - ESLint `vue/no-restricted-syntax` rejects raw `button`, `input`, `select`, `textarea`, `table`, `dialog` elements and `<style>` blocks in strict files (use `UButton`, `UInput`, `USelect`, `UTable`, `UModal`, ...).
   - ESLint import restriction: strict files do not import legacy `@/components/*` or `@/shells/*`.
   - Stylelint on CSS: `color-no-hex` and no raw `rgb()/hsl()/oklch()` literals outside `src/theme/tokens.css`; no `!important`.
5. **Icons:** Nuxt UI components take Iconify names (`i-lucide-*`). Install the Lucide Iconify collection locally so the static demo build has no runtime icon fetch. Existing `@lucide/vue` + `NavIcon` stay for legacy code (ADR-0010). Migrated code uses Iconify names only.
6. **Ratchet, not big bang.** The strict rules apply to the globs in `config/ds-strict.json`. A module task adds its folders to that file when its pages are migrated; the closing task (V2-T56) makes the rules apply to all of `src/`. Legacy code keeps ADR-0003 until then.
7. **Test contract:** a migrated component keeps every `data-testid`, role and BM visible text it had. Composites forward `$attrs` so a test id lands on the interactive element (the spike V2-T02 verifies attribute forwarding of the 15 most used Nuxt UI components against the E2E conventions; where it differs, the `Pp` composite normalises it).
8. **Locale:** BM copy stays in the project's own copy tables; Nuxt UI's built-in strings (`UTable` empty text, pagination, calendar) use the Malay locale if the library ships it, otherwise a project locale object in `src/theme/locale-ms.ts`.

## Alternatives considered
- **Keep hand-written Tailwind components and add a theme:** no library lock-in, but every component (overlay, combobox, calendar, table, command palette) would be built and made accessible by us across 660 files. Rejected: contradicts D29(d).
- **PrimeVue / Vuetify / Element Plus:** mature, but a second styling system next to Tailwind v4; D29 names Nuxt UI.
- **Nuxt migration to use Nuxt UI natively:** adds SSR/Nitro and a new routing system for no stated need (the app is a static SPA with a mock layer). Rejected.
- **Wrap every Nuxt UI component in a `Pp*` component:** maximum control, large upfront cost and a second API to learn. Rejected; wrap only where the design spec needs a composite.
- **Stricter lint via a third-party Tailwind plugin only:** Tailwind v4 support in lint plugins is uneven; a ~100 line local rule has no dependency risk. A third-party rule may be added later.

## Consequences
- Adds a dependency chain: `@nuxt/ui`, Reka UI, `@vueuse/core`, Iconify. Bundle size must be watched through the existing `scripts/check-demo-bundle.mjs` (add a budget in V2-T02).
- Legacy and new styling coexist for the whole migration: legacy pages render inside `LegacyScope` (light surface, scoped legacy CSS), see `v2-frontend.md` §7.
- The theme is the single place where look is decided. Changing the brand later is a token change, not a page change.
- The strict rules make some quick fixes impossible in strict folders (no one-off colour). That is intended; a missing token goes to the design owner.
- Risks: Nuxt UI major upgrades (pin the version, upgrade by a task); vue-router 5 compatibility of `router: true` (verified in V2-T02); first-build type generation order in CI (typecheck runs after `vite build` or after a generation step).
