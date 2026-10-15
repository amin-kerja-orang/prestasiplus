# PrestasiPlus v2 — Design System (Nuxt UI + own theme)

Slug: `v2-design-system` · Gate: G2 (design) · Status: Draft for user approval · Date: 2026-10-16 · Author: ui-ux-designer

| Field | Value |
|---|---|
| Decisions in force | D28 (v2 direction), D29 (Nuxt UI + own theme, strict tokens, light + dark, Gen Z/Alpha audience), D30 (one Portal Pentadbiran), D31 (PPD single role, dual role, Mod Pelajar), D32 |
| Supersedes | The **visual** parts of `docs/design/design-system.md` (colours, type, radii, shadows, gradients, component styling) and `docs/design/shells.md` (chrome). Not superseded: the FA→Lucide mapping authority (§6 of the old doc) stays the source of icon meaning, see §9. |
| Companion | `docs/design/v2-shells.md` (the two portal shells, login, full-screen Langsung, states) |
| Inputs read | `docs/requirements/v2-portals.md`, `docs/requirements/v2-cloud-gap.md`, `docs/TRACKER.md` D28–D32, `src/components/*`, `src/shells/*`, `package.json`, Nuxt UI docs (checked 2026-10-16) |
| Language | Design doc in English; all UI copy in Bahasa Melayu. Functional copy that exists today is kept verbatim; copy marked **PROPOSED** is new. |

Nuxt UI facts this document relies on (from ui.nuxt.com, 2026-10-16). Items marked **spike** must be confirmed by the first build task (§13, T0) because the docs do not state them for plain Vue:

- Current major is **v4** (line documented up to 4.11). Install for Vue + Vite: `@nuxt/ui` + `tailwindcss`; `ui()` from `@nuxt/ui/vite` in `vite.config.ts` after `vue()`; `app.use(ui)` from `@nuxt/ui/vue-plugin` after the router; CSS `@import "tailwindcss"; @import "@nuxt/ui";`; root template wrapped in `<UApp>`; root container gets class `isolate`.
- In Vue the equivalent of Nuxt's `app.config.ts` is the object passed to `ui({ ... })` in `vite.config.ts` (`ui.colors`, `ui.<component>` slot/variant overrides). Tokens are CSS variables `--ui-*` overridden in `:root` / `.dark`.
- Override priority (highest first): `class` prop, `ui` prop, `<UTheme>`, global config, component default. `<UTheme :ui>` overrides a subtree — used here for **density** (§8).
- The Dashboard family (`UDashboardGroup`, `UDashboardSidebar`, `UDashboardPanel`, `UDashboardNavbar`, `UDashboardToolbar`, `UDashboardSearch`, `UDashboardSearchButton`, `UDashboardSidebarToggle`, `UDashboardSidebarCollapse`, `UDashboardResizeHandle`), `UCommandPalette`, `UNavigationMenu`, `UBanner`, `UEmpty`, `UError`, `UChart`, `UTimeline`, `UStepper`, `UToast`, `UDrawer`, `USlideover`, `UModal` are all listed in the v4 component index. **Spike:** that the Dashboard family and `UDashboardSearch` (Ctrl/Cmd+K via `defineShortcuts`) run in plain Vue + Vite without Nuxt. Fallback if they do not: compose from `USlideover` (mobile menu) + `UNavigationMenu` + `UCommandPalette` inside `UModal` + `useEventListener`. The visual spec in this document does not change.
- Icons: `UIcon` uses Iconify names `i-lucide-*`; installing `@iconify-json/lucide` embeds icons in the build (offline, no runtime API call).

---

## 1. Brand direction

### 1.1 Concept — "Gelanggang" (the arena)

PrestasiPlus is a **gelanggang**: a practice arena where SPM candidates train, see their score climb, and compete — confident like a sports scoreboard, not cute like a children's app. Everything on a learner screen answers one question: *"Berapa jauh saya sudah naik?"* — so progress, rank and streak are the hero, and chrome stays quiet.

The look is **ink + cobalt + one electric highlight**: deep blue-black "ink" surfaces, a saturated cobalt for action, and a single lime "highlight" used only for progress, wins and the Mod Pelajar frame. Flat colour, hairline-to-medium outlines, short hard "sticker" shadows on primary actions and hero cards, big tabular numerals. No gradients, no purple-indigo wash (that was the old look and is also what stock AI/Nuxt templates look like).

Working tagline for brand surfaces: **"Sedia untuk SPM."** (PROPOSED; only used on the login brand panel and empty hero cards).

### 1.2 Moodboard (described, no images)

| Reference | What we take | What we avoid |
|---|---|---|
| Scoreboards and league tables (football app, esports brackets) | Tabular numerals, rank chips, "LIVE" pulse, bold numeric hierarchy | Betting-site neon overload |
| Night revision at a library desk (ink-blue room, one lamp) | Dark-friendly ink surfaces, one warm/acid accent | Pure black backgrounds |
| Sticker sheets / stationery (thick outline, hard drop shadow) | 2px outline + 3px hard shadow on primary buttons and hero cards (learner density only) | Full neo-brutalism on every element; childish blobs |
| Songket and batik geometry (diamond lattice, tumpal) | One reusable lattice pattern, 6–8% opacity, on brand panel, hero cards, empty illustrations | Literal cultural motifs in the nav or on forms |
| Fitness-app rings and streak counters | Progress rings, streak flame, milestone burst | Mascots and cartoon characters (none are introduced) |

### 1.3 Design principles (rules a reviewer can test)

1. **One loud thing per screen.** At most one `solid` primary button and one highlight (lime) element visible per viewport on a learner screen; staff screens use `solid` only for the page's main action.
2. **Numbers are the hero.** Scores, ranks, streaks, counts use the display/numeric type (`text-display` / `text-title`, tabular figures). Never show a progress bar without its numeric value next to it.
3. **Flat colour, no gradients.** Depth comes from surface steps (`bg-default` → `bg-elevated`), outlines and the hard pop shadow. Gradient utilities are banned in pages and in theme config.
4. **Colour is never the only signal.** Every status has an icon and a word (WCAG 1.4.1). Chart series have labels/patterns.
5. **Calm for staff, bold for learners.** Same tokens, two densities (§8). Staff screens drop the pop shadow, the pattern and the heavy outline.
6. **No decoration without meaning.** Emoji are content (kept where the BM copy has them). Functional icons are Lucide only.
7. **Respect the exam context.** No confetti on wrong answers, no countdown panic colours except genuine timers, no streak-loss guilt copy.

---

## 2. How the theme is delivered (mechanism)

All brand customisation lives in **three central files**. Pages and feature components contain no colour, radius, shadow, font or motion decisions.

```
src/design-system/
  tokens.css          # @theme palettes + --ui-* overrides (light/dark) + --ds-* + type/motion tokens
  theme.config.ts     # the object handed to ui({...}) in vite.config.ts: colors + component overrides
  density.ts          # learnerUi / staffUi objects passed to <UTheme :ui>
  patterns/           # Ds* pattern components (§10) — the only place that composes Nuxt UI into new parts
  illustrations/      # SVG empty-state art (token colours via currentColor / var())
  index.ts            # the only import path pages may use for DS code
```

`vite.config.ts` imports `theme.config.ts` (`ui({ ...themeConfig })`). Because Vite bundles the config file, a relative TS import is fine.

### 2.1 Semantic colour aliases (`ui.colors`)

Nuxt UI resolves a component's `color` prop through aliases. Ours:

| Alias | Palette | Role | Notes |
|---|---|---|---|
| `primary` | `kobalt` | Actions, links, selected state, focus | Default `color` of every component |
| `secondary` | `limau` | Highlight: progress, wins, "Langsung" frame, Mod Pelajar | Solid variant is the lime "sticker" (§3.4) |
| `success` | `daun` | Correct, active, paid, online | |
| `info` | `laut` | Neutral information, hints | |
| `warning` | `mentari` | Attention, pending, near-limit | Solid variant keeps bright yellow-amber fill (§3.4) |
| `error` | `delima` | Wrong, destructive, failed | |
| `neutral` | `ink` | Text, surfaces, borders | Custom blue-tinted grey (not Tailwind slate) |
| `reward` (new alias via `ui.theme.colors`) | `mangga` | Coins, XP, streak flame, rank medals | Warm orange so rewards never read as "warning" |

Config shape (spec, not production code):

```ts
// theme.config.ts (spec)
export default {
  colorMode: true,                       // light | dark | system via .dark on <html>
  theme: { colors: ['primary','secondary','success','info','warning','error','neutral','reward'] },
  ui: {
    colors: { primary:'kobalt', secondary:'limau', success:'daun', info:'laut',
              warning:'mentari', error:'delima', neutral:'ink', reward:'mangga' },
    // component overrides: see §4 (one block per component)
  },
}
```

(`theme.colors` / `theme.defaultVariants` option names: **spike** to confirm against the installed 4.x; fallback is to register through CSS only.)

### 2.2 Why this does not look like stock Nuxt UI (checklist the reviewer ticks on the gallery page)

| # | Stock Nuxt UI | PrestasiPlus |
|---|---|---|
| 1 | Green primary, slate neutral | Cobalt primary, ink neutral, lime highlight, mangga reward (§3) |
| 2 | System/Inter-like fonts | Bricolage Grotesque (display + numerals) + Plus Jakarta Sans (body) (§5) |
| 3 | `--ui-radius` 0.25rem (squarish) | 0.5rem learner / 0.375rem staff base → 12/16px controls and cards (§6.2) |
| 4 | Hairline ring buttons, no shadow | Learner buttons and hero cards: 2px ink outline + 3px hard "pop" shadow, pressed state sinks 2px (§4.1) |
| 5 | Soft grey page, white cards | Page `bg-muted` (ink-50 / ink-950), cards `bg-default` with 1px border; hero cards inverted ink with songket lattice |
| 6 | Pill-less tabs with underline | Segmented "pill track" tabs for status filters; underline tabs only inside staff tables |
| 7 | Linear progress only | Linear progress with numeric label + progress **ring** (DsProgressRing) + segmented XP bar |
| 8 | Round avatars | Rounded-square (squircle) avatars for people, round only for chips |
| 9 | Subtle fades | Short "pop" overshoot easing for rewards and sheet entrances; reduced-motion safe (§7) |
| 10 | Generic empty states | Tokenised geometric illustrations (§9.3) |
| 11 | Lucide icons at stroke 1.5–2 | Lucide at 2px stroke in learner, 1.75px in staff (set once on `UIcon`) |
| 12 | Inter numerals | Tabular, display-weight numerals on every score/rank/count |

---

## 3. Colour

### 3.1 Palettes (declared once in `tokens.css` with `@theme static`, all 11 steps 50–950)

Hex below are the exact values. Names are Bahasa Melayu so the system has its own vocabulary.

| Step | `kobalt` (primary) | `ink` (neutral) | `limau` (secondary) | `daun` (success) | `laut` (info) | `mentari` (warning) | `delima` (error) | `mangga` (reward) | `ungu` (chart only) |
|---|---|---|---|---|---|---|---|---|---|
| 50 | #EEF3FF | #F5F7FB | #F8FFE0 | #EDFBF2 | #ECFCFF | #FFF9E6 | #FFF1F3 | #FFF4E8 | #F6F0FF |
| 100 | #DDE6FF | #EBEEF5 | #EFFDB8 | #D3F6E0 | #D0F6FD | #FFF0BF | #FFE0E5 | #FFE6CC | #EBDDFF |
| 200 | #BFD0FF | #D5DBE8 | #E1FB86 | #A9EBC4 | #A6ECFA | #FFE185 | #FFC7D1 | #FFCB99 | #D8BFFF |
| 300 | #93AEFF | #A9B3C8 | #D0F54F | #72DAA0 | #67DCF3 | #FFCE47 | #FF9DAF | #FFAA5C | #BE96FF |
| 400 | #6283FF | #7D88A0 | #BCEB27 | #3CC57C | #2CC4E3 | #FFB91A | #FF6685 | #FF8A2B | #A06CFF |
| 500 | #3B5CFF | #5F6A84 | #A3D116 | #1FAA63 | #0FA6C7 | #F29A00 | #F43760 | #F26A0A | #8447F5 |
| 600 | #2440F0 | #49536C | #7FA50E | #138A50 | #0B85A6 | #CC7600 | #D91A48 | #CC5003 | #6B2AD8 |
| 700 | #1C31D1 | #3A4258 | #5F7D0F | #116E42 | #0E6A85 | #A35A02 | #B71240 | #A33F05 | #5520B0 |
| 800 | #1D2EA6 | #262D40 | #4B6112 | #115737 | #135669 | #84470A | #991240 | #82350B | #471D8D |
| 900 | #1D2C83 | #171C2D | #3F5213 | #0F482F | #144858 | #6E3B0E | #821340 | #6A2E0D | #3B1B70 |
| 950 | #141C52 | #0D1120 | #1F2D04 | #052919 | #082F3C | #401E03 | #490520 | #3A1504 | #240E47 |

Pages never reference palette steps. Palettes are used only inside `tokens.css` / `theme.config.ts`.

### 3.2 Semantic tokens (what everything else consumes)

Overrides placed in `tokens.css` after `@import "@nuxt/ui"` (Nuxt UI's documented override point). Light in `:root`, dark in `.dark`.

**Text (`--ui-text-*`)** — utilities `text-default`, `text-toned`, `text-muted`, `text-dimmed`, `text-highlighted`, `text-inverted`

| Token | Light | Dark |
|---|---|---|
| `--ui-text-highlighted` | ink-950 | white |
| `--ui-text` | ink-800 | ink-100 |
| `--ui-text-toned` | ink-700 | ink-200 |
| `--ui-text-muted` | ink-600 | ink-300 |
| `--ui-text-dimmed` | ink-500 | ink-400 |
| `--ui-text-inverted` | white | ink-950 |

**Surfaces (`--ui-bg-*`)** — utilities `bg-default`, `bg-muted`, `bg-elevated`, `bg-accented`, `bg-inverted`

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--ui-bg` | white | ink-900 | Cards, sidebar, modals, inputs |
| `--ui-bg-muted` | ink-50 | ink-950 | **Page background** (root wrapper has `bg-muted`) |
| `--ui-bg-elevated` | ink-100 | ink-800 | Hover rows, popovers, table header |
| `--ui-bg-accented` | ink-200 | ink-700 | Pressed, selected row |
| `--ui-bg-inverted` | ink-950 | white | Hero cards, tooltips, brand panel |

**Border (`--ui-border-*`)** — utilities `border-default`, `border-muted`, `border-accented`, `border-inverted`

| Token | Light | Dark |
|---|---|---|
| `--ui-border` | ink-200 | ink-700 |
| `--ui-border-muted` | ink-100 | ink-800 |
| `--ui-border-accented` | ink-400 (inputs, checkboxes: 3:1 vs white) | ink-400 |
| `--ui-border-inverted` | ink-950 | white |

**Brand/status (`--ui-<alias>`)**: the value used for text, ring, icon and the `solid` fill.

| Alias | Light | Dark | Solid label colour (light / dark) |
|---|---|---|---|
| `--ui-primary` | kobalt-600 | kobalt-400 | white / ink-950 |
| `--ui-secondary` | limau-800 | limau-400 | white / ink-950 (solid is overridden to the sticker, §3.4) |
| `--ui-success` | daun-700 | daun-400 | white / ink-950 |
| `--ui-info` | laut-700 | laut-400 | white / ink-950 |
| `--ui-warning` | mentari-800 | mentari-400 | (solid overridden, §3.4) / ink-950 |
| `--ui-error` | delima-700 | delima-400 | white / ink-950 |
| `--ui-reward` | mangga-700 | mangga-400 | white / ink-950 |

**Design-system extras (`--ds-*`, our own namespace; each also exposed as a Tailwind token via `@theme inline` when a utility is needed)**

| Token | Light | Dark | Utility |
|---|---|---|---|
| `--ds-highlight` | limau-400 | limau-400 | `bg-highlight` |
| `--ds-on-highlight` | ink-950 | ink-950 | `text-on-highlight` |
| `--ds-warning-fill` | mentari-400 | mentari-400 | `bg-warning-fill` |
| `--ds-pop-color` | ink-950 | kobalt-900 | used by `shadow-pop` |
| `--ds-pop-offset` | 3px (learner) / 0px (staff) | same | used by `shadow-pop` |
| `--ds-control-border` | 2px (learner) / 1px (staff) | same | used in component config only |
| `--ds-pattern-songket` | SVG lattice, stroke ink-950 at 7% | stroke white at 8% | `bg-songket` (hero cards and brand panel only) |
| `--ds-cat-1 … --ds-cat-8` | kobalt-600, limau-800, delima-700, laut-700, mentari-800, mangga-700, ungu-600, daun-700 | the 400 step of the same palettes | chart/subject colours (§3.6) |

`--ui-container`: 72rem learner, 100rem staff (set by density, §8). `--ui-header-height`: 4rem learner, 3.5rem staff.

### 3.3 Contrast verification (WCAG 2.2 AA)

Ratios were calculated from the hex values above with the WCAG relative-luminance formula (hand-calculated for this draft; the build must re-assert them, see lint rule G-9). Thresholds: text ≥ 4.5:1, large text and UI boundaries/focus ≥ 3:1.

| Pair | Ratio | Result |
|---|---|---|
| `text` ink-800 on white | 13.7 | AA / AAA |
| `text` ink-800 on ink-50 | 12.5 | AA / AAA |
| `text-muted` ink-600 on white / on ink-50 | 7.7 / 7.0 | AA |
| `text-dimmed` ink-500 on white / on ink-50 | 5.4 / 4.9 | AA |
| `text` ink-100 on ink-900 (dark) | ≈14.5 | AA |
| `text-muted` ink-300 on ink-800 (dark) | ≈6.5 | AA |
| `text-dimmed` ink-400 on ink-900 (dark) | 4.8 | AA (see rule below for elevated surfaces) |
| `primary` kobalt-600 on white / on ink-50 | 6.9 / 6.3 | AA |
| white on `primary` solid (kobalt-600) | 6.9 | AA |
| `primary` kobalt-400 on ink-900 (dark) | 5.0 | AA |
| ink-950 on kobalt-400 solid (dark) | 5.6 | AA |
| `secondary` limau-800 on white | 6.9 | AA |
| ink-950 on `--ds-highlight` limau-400 | 13.5 | AAA |
| limau-400 on ink-900 (dark) | 12.1 | AAA |
| `success` daun-700 on white | 6.3 | AA |
| daun-400 on ink-900 | 7.6 | AA |
| `info` laut-700 on white | 6.1 | AA |
| `warning` mentari-800 on white | 7.3 | AA |
| ink-950 on `--ds-warning-fill` mentari-400 | 10.9 | AAA |
| `error` delima-700 on white | 6.6 | AA |
| delima-400 on ink-900 | 6.0 | AA |
| `reward` mangga-700 on white | 6.4 | AA |
| mangga-400 on ink-900 | 7.2 | AA |
| Input/checkbox border ink-400 on white | 3.6 | passes 3:1 (1.4.11) |
| Dark input border ink-400 on ink-900 | 4.8 | passes 3:1 |
| Focus ring kobalt-600 on white / kobalt-400 on ink-900 | 6.9 / 5.0 | passes 3:1 |
| Soft variants (`color` text on `color`/10 tint) | ≥ 5.3 for primary, success, info, error, reward, secondary, warning (light); ≥ 6 in dark | AA |

Rules that follow from the numbers:

- Light-mode `secondary`/`warning`/`error` use the darker steps (800/800/700) precisely because the 600 steps fail on the `soft` tint (error-600 on its tint = 4.3:1). Do not "brighten" them.
- `text-dimmed` is for non-essential meta (timestamps, secondary hints). It never carries essential information, and in **dark mode never sits on `bg-elevated`/`bg-accented`** (3.9:1). Placeholders use `text-muted`.
- The lime highlight in **light mode** has 1.4:1 against white, so any lime fill carries a 2px `border-inverted` outline (the sticker) or sits on an inverted surface. A lime fill never relies on its own edge.
- White text on any 400-step fill fails (kobalt-400: 3.4:1). Dark mode therefore inverts solid label colour to ink-950 (`--ui-text-inverted`).

### 3.4 Variant behaviour that differs from Nuxt UI defaults

| Component / variant | Rule |
|---|---|
| Button, Badge `solid` + `secondary` | Fill `bg-highlight`, label `text-on-highlight`, 2px `border-inverted` (light) / no border (dark). This is the "lime sticker". |
| Button, Badge `solid` + `warning` | Fill `bg-warning-fill`, label `text-on-highlight`, same outline rule. |
| Button `solid` + `primary` (learner) | Kobalt fill, 2px `border-inverted`, `shadow-pop`; pressed: `translate-y-0.5` and `shadow-none`. Staff: fill only, 1px border, no pop. |
| Button `outline` | 2px (learner) / 1px (staff) `border-accented`, `bg-default`, hover `bg-elevated`. |
| Button `soft` / `subtle` | Nuxt defaults (tint + text) — uses the safe steps above. |
| Button `ghost` / `link` | Nuxt defaults; `link` underlines on hover and always on focus. |
| Disabled (any) | 45% opacity **and** `cursor-not-allowed`; labels keep contrast of the enabled state against their own fill because opacity is applied to the whole control (WCAG exempts disabled controls). |

### 3.5 Gradients

None. `bg-gradient-*`, `from-*`, `via-*`, `to-*` are banned by lint. The old `gradient-primary/cta/save/warn/command` and the animated auth background are retired. Hero emphasis = inverted surface + songket lattice + `shadow-pop`.

### 3.6 Categorical colours (subjects, charts, class colours)

Eight slots `--ds-cat-1..8` (table in §3.2). Order is chosen to stay distinguishable for the common colour-vision deficiencies (blue/lime/red/cyan/amber/orange/violet/green alternate luminance). Rules:

- Data records store a **slot number 1–8**, not a hex. (See open question Q3: existing seeds with hex subject colours are mapped to the nearest slot.)
- A colour is always paired with a label or icon; charts use direct labels and a distinct marker/dash per series where there are more than 3 series.
- Chart.js reads colours from CSS variables at mount and on colour-mode change (`getComputedStyle`), never from literals in configs.
- Status colours (success/warning/error) are not reused as category colours inside the same chart.

---

## 4. Components: global overrides

The full set of Nuxt UI components in the product, and the exact brand overrides in `theme.config.ts`. Class names below use only token utilities and our `@theme` tokens. Slot names are those of Nuxt UI 4.x; **spike T0 confirms slot names against the installed version** and the table is the spec of intent.

### 4.1 Overrides (global; density-specific differences are in §8)

| Component | Override (slot → classes / variants) | Intent |
|---|---|---|
| `button` | `base`: `font-semibold tracking-tight transition-[transform,box-shadow,background-color] duration-150 ease-pop pointer-coarse:min-h-11 pointer-coarse:min-w-11`. `variants.size`: `md` = 40px, `lg` = 48px, `xl` = 56px (desktop-fine pointers), all **≥ 44px under `pointer-coarse`**. `compoundVariants` for `solid`+`primary` (pop + outline), `solid`+`secondary`, `solid`+`warning` as §3.4. `defaultVariants`: `color: primary`, `size: md`. | Chunky, tactile, thumb-safe |
| `badge` | `base`: `rounded-full font-bold tracking-wide`; `size.md`: `text-xs px-2.5 py-1` (min 12px text). Status badges always render an icon + word. | Stickers/chips |
| `chip` | Count chip: `bg-error text-inverted font-bold tabular-nums min-w-5 h-5`; cap `99+` (copy from the old `CountBadge` cap behaviour). | Bell/notification counts |
| `card` | `root`: `rounded-lg border border-default bg-default`; `variant.hero`: `bg-inverted text-inverted bg-songket shadow-pop`. Padding: `header/body/footer` `p-4 sm:p-6` (learner), `p-4` (staff). | Surfaces |
| `input`, `textarea`, `select`, `selectMenu`, `inputMenu`, `inputNumber`, `inputDate`, `inputTime`, `inputTags`, `pinInput` | `base`: `border-(length:--ds-control-border) border-accented bg-default text-default placeholder:text-muted rounded-md`; focus: `focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2`; error: `border-error`. Text size 16px at all widths (prevents iOS zoom). Height 44px (learner `md`), 40px (staff `md`, 44px coarse). | Legible, 44px |
| `formField` | `label`: `text-label text-default`; `hint/help`: `text-caption text-muted`; `error`: `text-caption text-error` + leading `i-lucide-circle-alert`. Required marker: `*` with `sr-only` "wajib". | Forms |
| `checkbox`, `radioGroup`, `switch` | Hit area wrapper `min-h-11`; `switch` on = `bg-primary`, off = `bg-accented` with `border-accented`; thumb has a check/dash glyph (not colour-only). | Toggle clarity |
| `tabs` | Learner: pill track (`list`: `bg-elevated rounded-lg p-1`, `trigger`: `rounded-md min-h-11`, `indicator`: `bg-default shadow-sm rounded-md`). Staff: underline (`variant="link"`). Each trigger may carry a count in a `UBadge`. | Status filters |
| `navigationMenu` | `link`: `rounded-md min-h-10 pointer-coarse:min-h-12 text-muted hover:text-highlighted hover:bg-elevated`; active: `text-highlighted bg-primary/10` + 3px leading `bg-primary` bar (not colour-only: bar + weight `font-semibold`); group labels use `text-overline text-dimmed`; no per-group rainbow colours. | Menus |
| `dashboardSidebar` | `root`: `bg-default border-e border-default`; `header`/`footer`: `p-4`; width 17rem expanded / 4.5rem rail; slideover below `lg`. | Shell |
| `dashboardNavbar` | `root`: `h-(--ui-header-height) border-b border-default bg-default/95 backdrop-blur`; `title`: `text-heading`. | Shell |
| `modal`, `drawer`, `slideover` | `overlay`: `bg-inverted/60`; `content`: `rounded-lg bg-default border border-default shadow-modal`; on `< sm` modals render as a **bottom sheet** (`UDrawer`) with `max-h-[90dvh]` (config-only value) and internal scroll; actions: primary right, cancel left, stacked full-width on mobile. | Mobile-safe overlays |
| `table` | `root`: `rounded-lg border border-default`; `th`: `text-overline text-muted bg-elevated`; `td`: `text-default tabular-nums` for numeric columns; row min-height 52px learner / 44px staff (48px coarse). Wide tables scroll **inside** `root` (`overflow-x-auto`), never the page. Mobile (< md) switches to the card-list layout of `DsDataTable` (§10). | Data |
| `pagination` | `size md`; 44px hit areas; BM copy (Q5): "Menunjukkan {dari}–{hingga} daripada {jumlah} hasil", "Sebelum", "Seterusnya". Keeps filter query params. | Lists |
| `alert` | `variant="subtle"` default; always leading icon + `title`; closable only where the old `FlashOutlet` was dismissible (it was not: persistent until navigation). | Inline feedback |
| `toast` | Bottom-centre on mobile, bottom-right on desktop, `duration` 4000 (success), 6000 (error), `closable`; announce via `aria-live`. | Replaces `ToastMessage` |
| `progress` | `base`: `h-3 rounded-full bg-elevated`; `indicator`: `rounded-full bg-primary` (`color="secondary"` allowed on inverted surfaces). Numeric value always in the `status` slot. | Progress |
| `tooltip` | `content`: `bg-inverted text-inverted text-caption rounded-md`; delay 300ms; hover **and** focus; never the only carrier of a label on touch. | Hints |
| `avatar` | `root`: `rounded-lg bg-primary/10 text-primary font-display font-bold` (initials); `size` md = 40, lg = 48. | People |
| `empty` | Illustration slot uses `illustrations/*`; title `text-subheading`, description `text-muted`, actions below. | Empty states |
| `banner` | Used for Mod Pelajar (§ shells). Not closable when `persistent`; `color` mapped per state. | Mode banners |
| `kbd` | `rounded-sm border border-accented bg-elevated text-caption font-semibold`. | Shortcuts (Ctrl K) |
| `skeleton` | `bg-elevated animate-pulse` (static under reduced motion). | Loading |
| `breadcrumb`, `stepper`, `timeline`, `accordion`, `collapsible`, `calendar`, `carousel`, `fileUpload`, `commandPalette`, `dashboardSearch`, `error` | Defaults + token-only tweaks in `theme.config.ts` (radius, focus, min-heights). Anything beyond a token tweak becomes a DS pattern (§10). | |

### 4.2 Elevation

| Token | Value (light) | Dark | Used for |
|---|---|---|---|
| `shadow-xs` | `0 1px 2px` ink-950 at 6% | none (border only) | Cards at rest (staff) |
| `shadow-card` | `0 4px 12px` ink-950 at 8% | none; surface step instead | Hoverable cards |
| `shadow-pop` | `0 var(--ds-pop-offset) 0 0 var(--ds-pop-color)` | same, colour kobalt-900 | Learner primary buttons, hero cards, selected tile |
| `shadow-modal` | `0 16px 40px` ink-950 at 22% | `0 16px 40px` black at 60% | Modal, drawer, popover, command palette |

Elevation in dark mode is expressed by surface lightness (ink-950 page → ink-900 card → ink-800 popover), not by shadow.

---

## 5. Typography

### 5.1 Fonts

| Role | Family | Why | Delivery |
|---|---|---|---|
| Display + numerals | **Bricolage Grotesque** (variable, 600–800) | Characterful, confident grotesque with good tabular figures for scores/ranks; clearly not Inter/Outfit | `@fontsource-variable/bricolage-grotesque` |
| Body + UI | **Plus Jakarta Sans** (variable, 400–700) | Friendly, highly legible at 14–16px, familiar to Malaysian/Indonesian youth, full Latin range for BM | `@fontsource-variable/plus-jakarta-sans` |
| Arabic (spiritual copy on `/tetapan`) | Scheherazade New (unchanged) | Existing dependency | `@fontsource/scheherazade-new` |

Replaces Outfit + Inter (Q1). Fallback stacks: `--font-display: 'Bricolage Grotesque Variable', 'Plus Jakarta Sans Variable', system-ui, sans-serif`; `--font-sans: 'Plus Jakarta Sans Variable', system-ui, sans-serif`. Fonts are self-hosted (fontsource), `font-display: swap`, latin subset only. Numerals: `font-variant-numeric: tabular-nums` is applied by the utility `tabular` (defined in `tokens.css`) and by `UTable`'s numeric cells.

### 5.2 Scale (Tailwind `@theme` tokens → utilities `text-display`, `text-title`, …)

Fluid with `clamp()` so pages need no responsive type classes. Pages use **only** these utilities for type (the stock `text-xs … text-9xl` stay available to Nuxt UI internals but are banned in pages).

| Token / utility | Family · weight | Size (375 → 1280) | Line height | Tracking | Use |
|---|---|---|---|---|---|
| `text-display` | Display 800 | 2.5rem → 3.5rem (40 → 56px) | 1.05 | -0.02em | Scores, hero numbers, login heading on brand panel |
| `text-title` | Display 700 | 1.75rem → 2.25rem (28 → 36px); staff 1.5rem → 1.75rem | 1.15 | -0.015em | Page H1 |
| `text-heading` | Display 700 | 1.375rem → 1.5rem (22 → 24px); staff 1.125rem → 1.25rem | 1.25 | -0.01em | Section H2, card titles |
| `text-subheading` | Sans 700 | 1.125rem → 1.25rem (18 → 20px) | 1.35 | 0 | H3, modal titles |
| `text-body` | Sans 400 | 1rem (16px); staff ≥ md: 0.875rem (14px) | 1.5 | 0 | Body copy. **16px on mobile always** (inputs and copy) |
| `text-label` | Sans 600 | 0.875rem (14px) | 1.4 | 0 | Field labels, buttons, table cells |
| `text-caption` | Sans 500 | 0.75rem (12px) | 1.35 | 0.005em | Hints, meta. **Minimum 12px anywhere** (D9 rule retained) |
| `text-overline` | Sans 700, uppercase | 0.75rem (12px) | 1.3 | 0.08em | Nav group labels, table headers |

Colour for text always comes from `text-default / toned / muted / dimmed / highlighted / inverted` or a status alias (`text-primary`, `text-error` …). Semantic heading levels (`h1`–`h3`) are chosen for document structure, independent of the visual token.

Line length: running copy `max-w-prose` (layout utility, ≤ 65ch).

---

## 6. Spacing, layout, radius

### 6.1 Spacing

4px base. Pages may use only these steps (Tailwind numeric): **1 (4px), 2 (8px), 3 (12px), 4 (16px), 6 (24px), 8 (32px), 12 (48px), 16 (64px)** for `gap-*`, `p*-*`, `m*-*`, `space-*`. No `0.5`, `1.5`, `5`, `7`, `9`+ other than listed, no arbitrary `[…]`.

Page structure (provided by `DsPage`, §10, so pages don't repeat it):

| Zone | 375 | 768 | 1280 |
|---|---|---|---|
| Page gutter | 16px | 24px | 32px |
| Vertical rhythm between sections | 24px | 24px | 32px |
| Card padding | 16px | 24px (learner) / 16px (staff) | same |
| Grid gap | 12px | 16px | 24px |
| Max content width | fluid | fluid | 72rem learner / 100rem staff (centred) |

Breakpoints are Tailwind defaults (`sm` 640, `md` 768, `lg` 1024, `xl` 1280). The design is specified at 375 / 768 / 1280; 320 must also not scroll horizontally.

### 6.2 Radius

`--ui-radius` is the base; Nuxt UI derives `rounded-xs 0.5×, sm 1×, md 1.5×, lg 2×, xl 3×`.

| Density | `--ui-radius` | sm / md / lg / xl | Controls | Cards | Sheets |
|---|---|---|---|---|---|
| Learner | 0.5rem | 8 / 12 / 16 / 24 px | md (12px) | lg (16px) | xl top corners (24px) |
| Staff | 0.375rem | 6 / 9 / 12 / 18 px | md (9px) | lg (12px) | lg top corners |

Chips and badges: `rounded-full`. Avatars: `rounded-lg`.

---

## 7. Motion

| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | Default enter |
| `--ease-pop` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Buttons, rewards, sheet enter (small overshoot) |
| `--duration-fast / base / slow` | 100 / 160 / 260 ms | Hover & press / overlays / reward bursts |
| Animations (`@theme --animate-*`) | `pop-in` (scale .92 → 1, 160ms), `count-tick` (translateY 4px → 0, 160ms), `live-pulse` (opacity 1 → .45, 1.6s, infinite), `burst` (12 particles, 600ms, learner reward moments only) | |

Rules:

- Motion explains cause and effect (press, enter, reward). No looping decoration except `live-pulse` on "LIVE" and skeleton pulse.
- **Reduced motion:** under `@media (prefers-reduced-motion: reduce)` all `--duration-*` become 1ms, `translate`/`scale` transitions are removed, `live-pulse`, skeleton pulse and `burst` are disabled and replaced by a static state (solid LIVE dot; a 2s outline highlight `outline-secondary` on the rewarded element; the numeric change is announced via `aria-live="polite"`). Opacity cross-fades ≤ 100ms are allowed.
- Page transition: 120ms opacity only; none under reduced motion.
- Staff density halves the animation set: no `pop-in` overshoot, no `burst`.

---

## 8. Density: learner vs staff

Density is a property of the **role**, set once at the shell root (`data-density="learner|staff"`) and applied through a `<UTheme :ui>` wrapper (`learnerUi` / `staffUi` in `density.ts`) plus CSS variables.

| Role | Density | Rationale |
|---|---|---|
| Murid | `learner` | Touch-first, bold, gamified |
| Guru, Ibu Bapa, Penaja | `staff` | Adult, task-oriented, calmer (Q4) |
| Admin Pusat, Pegawai PPD/JPN, Admin Sekolah | `staff` | Data-dense |

| Property | Learner | Staff |
|---|---|---|
| `--ui-radius` | 0.5rem | 0.375rem |
| `--ui-header-height` | 4rem | 3.5rem |
| `--ui-container` | 72rem | 100rem |
| Button `md` / `lg` height | 44 / 52px | 36 / 40px; **44px under `pointer-coarse`** |
| Input `md` height | 48px | 40px; 44px coarse |
| Control border (`--ds-control-border`) | 2px | 1px |
| Pop shadow offset (`--ds-pop-offset`) | 3px | 0 |
| Card padding | 16 / 24px | 16px |
| Table row min-height | 52px | 44px (48px coarse) |
| Body text | 16px | 16px < md, 14px ≥ md |
| Page title | `text-title` 28 → 36px | 24 → 28px |
| Pattern (songket), burst, pop-in | allowed | pattern only on brand panel/hero; no burst/pop |
| Emoji in UI copy | allowed where the BM copy has them | none in nav/labels; allowed in user-generated content |
| Progress visual | rings + segmented bars | linear bars + numbers |

Touch targets: every interactive control is ≥ 44×44 CSS px on `pointer-coarse` regardless of density; on fine pointers staff controls may be 36px (WCAG 2.2 target-size minimum is 24px).

---

## 9. Iconography, emoji, illustration

### 9.1 Icons

- **Lucide only**, through `UIcon` (`i-lucide-*`) with `@iconify-json/lucide` installed so icons are bundled. The `@lucide/vue` component imports and the `AppIcon` resolver are retired for pages.
- The FA→Lucide table in `docs/design/design-system.md` §6 remains the authority for *which glyph* a legacy FA name means; the only change is the **spelling**: PascalCase `ArrowLeftRight` → `i-lucide-arrow-left-right` (kebab-case). The mapping data (`fa-to-lucide.ts`) is converted once to kebab-case strings and consumed by `<UIcon :name>`; the guard test `srs-coverage` keeps working against the same keys.
- Sizes: 16 (inline with caption), 20 (default, buttons and nav), 24 (tab bar, empty-state header), 40–64 (illustration). Stroke: 2px learner, 1.75px staff (one `UIcon` config).
- Icon-only buttons need `aria-label` (BM) and a `UTooltip`; their hit area is ≥ 44px on coarse pointers.
- Icon colour follows the text colour of its context; status icons use their status alias.
- No category-coloured nav icons (the old cyclic teal/amber/violet… scheme is retired).

### 9.2 Emoji

- Emoji that are part of existing BM copy stay as literal characters (e.g. "Selamat Kembali! 👋", learner group labels "✨ Visi & Pertandingan"). They are content, rendered with the system emoji font.
- Max one emoji per heading or label; never as the only carrier of meaning; never in staff nav or in error/forbidden copy.
- New copy introduced by v2 uses no emoji unless it is a learner celebration line.

### 9.3 Illustration

- Six spot illustrations (SVG, 160×160 viewBox, drawn with `currentColor`, `--ui-primary`, `--ds-highlight`, `--ui-border-accented` only) shipped in `illustrations/`: `kosong` (empty list), `tiada-hasil` (no search result), `ralat` (error), `403`, `404`, `berjaya` (success/complete).
- Style: geometric, flat, 2px outlines, one highlight shape in lime, optional songket lattice behind. No people, no mascots, no gradients.
- Learner empty states may use the burst/pop on first appearance; staff empty states are static.
- Cikgu Alesa (AI persona) is represented by `UAvatar` with `i-lucide-sparkles`; no character art is introduced.

---

## 10. Component mapping (current → Nuxt UI → DS pattern)

Layers: **L1 Nuxt UI** (use as-is, themed centrally) · **L2 DS pattern** (`src/design-system/patterns/*`, named `Ds*`, composed from L1 only, documented here) · **L3 pages** (L1 + L2 only). A new L2 pattern requires an entry in this document first (design-system owner approval).

### 10.1 `src/components/*`

| Current | Replacement | Notes |
|---|---|---|
| `icon/AppIcon.vue` + `fa-to-lucide.ts` + `icon/maps/*` | `UIcon` (`i-lucide-*`) | Keep the FA→Lucide data (kebab-case); remove the `@lucide/vue` runtime import from pages |
| `feedback/AlertBox.vue` | `UAlert` (`variant="subtle"`, `color` error/success/warning/info, leading icon) | Messages list → `description` with one line per message |
| `feedback/FlashOutlet.vue` | `UAlert` rendered by the shell/page slot from `useFlash()` | Persists until next navigation (as today); not a toast |
| `feedback/ToastMessage.vue` | `useToast()` + `UToast` (via `UApp`) | 2s "Disalin!" → `duration: 2000`; 4s report toast → 4000 |
| `feedback/LoadingSpinner.vue` | `UIcon name="i-lucide-loader-circle"` with `animate-spin` inside buttons (`loading` prop on `UButton`), `USkeleton` for blocks | Reduced motion: spinner replaced by static `i-lucide-loader` + "Memuatkan…" |
| `feedback/gallery/FeedbackGallery.vue` | Dev-only "Galeri DS" route (kitchen sink of every L1/L2 component × state × light/dark) | Not shipped to demo build |
| `badge/AppBadge.vue` (+ live class strings LIVE, DEV, NEW, BARU, AI, PRO, SPM) | `UBadge` | LIVE → `color="error" variant="solid"` + `live-pulse`; DEV → `warning` solid; NEW/BARU → `secondary` solid (sticker); AI → `primary` soft; PRO → `primary` soft; SPM → `reward` soft. Text stays literal English words as today |
| `badge/CountBadge.vue` | `UChip` with `:text` and cap `99+` | |
| `chart/ChartCanvas.vue` + `register.ts` | `DsChart` (L2 wrapper around Chart.js reading `--ds-cat-*` / `--ui-*`) | Evaluate `UChart` in the T0 spike; keep Chart.js behind `DsChart` unless `UChart` covers line/bar/doughnut/radar and band-shading used by M08/M11/M17 |
| `data/DataTableCard.vue` | `DsDataTable` = `UCard` + `UTable` + toolbar slot + `UPagination` + empty/loading/error states | In-card horizontal scroll rule kept; < md renders cards |
| `data/LaravelPager.vue` | `UPagination` (inside `DsDataTable`) | URL query preserved (`?page=`), BM copy (Q5) |
| `overlay/BaseModal.vue` (margin / sheet variants) | `UModal` (≥ sm) / `UDrawer` (< sm bottom sheet) via `DsDialog` | One component picks by breakpoint (`useBreakpoints`); close on Esc/backdrop/X without submit |
| `overlay/native-dialogs.ts` (`confirm`, `alert`) | `useConfirm()` → `UModal` (DS composable) | Q2: replaces native `confirm()`/`alert()` with a themed dialog; exact BM text unchanged; focus returns to the trigger |
| `form/classes.ts` | `UInput`, `UTextarea`, `USelect`/`USelectMenu`, `UCheckbox`, `URadioGroup`, `USwitch`, `UFormField`, `UForm` | Server-side error list → `UForm :state` errors + a summary `UAlert` |
| `feedback/classes.ts`, `overlay/classes.ts`, `data/classes.ts` | Deleted | Class-string constants are exactly what the new rules prohibit |
| (inline) stat card | `DsStat` | `UCard` + label + display numeral + trend + icon tile |
| (inline) filter strip | `DsFilterBar` | `UForm` row of `UInput`/`USelect`/`UButton`; wraps (no scroll) |
| (inline) progress ring / XP bar | `DsProgressRing`; `UProgress` | SVG ring (no Nuxt UI equivalent) |
| (inline) empty state | `UEmpty` + `illustrations/*` | |
| (inline) 404 / 403 | `DsErrorPage` on `UError` | Shell variant |
| (inline) tabs / status pills | `UTabs` | |
| (inline) avatar / initials | `UAvatar` | |
| (inline) tooltips (`title=`) | `UTooltip` | |
| (inline) accordions / collapsible menu groups | `UAccordion` / `UCollapsible` | |
| (inline) steppers (setup wizards) | `UStepper` | |
| (inline) timeline (Timeline Saya M08) | `UTimeline` | |
| (inline) date / time pickers | `UInputDate`, `UInputTime`, `UCalendar` | |
| (inline) file upload / import | `UFileUpload` | |
| (inline) copy-to-clipboard | `UButton` + `useClipboard` + `useToast` | |

### 10.2 `src/shells/*`

| Current | Replacement | Notes |
|---|---|---|
| `admin/AdminShell.vue` | `DsShellPentadbiran` = `UApp` > banner slot (`UBanner`) > `UDashboardGroup` > (`UDashboardSidebar` + `UDashboardPanel`) | Specified in `v2-shells.md` §2 |
| `admin/AdminSidebar.vue`, `admin/AdminNavList.vue` | `UDashboardSidebar` + `UNavigationMenu` (items from `admin-nav` data, grouped, role-filtered) | Single menu definition feeds sidebar, drawer and Ctrl+K |
| `admin/AdminHeader.vue` | `UDashboardNavbar` + `DsRoleChip` + `UDashboardSearchButton` + user `UDropdownMenu` | |
| `admin/AdminBottomNav.vue` | **Dropped** for Pentadbiran (9 groups; drawer instead) | `v2-shells.md` §2.4 |
| `admin/AdminLagiPopover.vue` | **Dropped**: the drawer shows the complete menu (fixes the live "mobile subset") | |
| `admin/AdminServerStatus.vue` | `DsServerStatus` = `UBadge` ×3 in a `UPopover` (CPU/RAM/Disk/Uptime) | Pusat only; colour = status alias + icon |
| `user/UserShell.vue` | `DsShellPembelajaran` = `UApp` > banner slot > `UDashboardGroup` (≥ lg) / top bar + `DsBottomNav` (< lg) | |
| `user/UserSidebar.vue`, `user/UserDrawer.vue`, `user/UserNavList.vue` | `UDashboardSidebar` (slideover mode below `lg`) + `UNavigationMenu` | One list on both surfaces (DV-SH-04 fix retained) |
| `user/UserHeader.vue` | `UDashboardNavbar` + reward chips (`UBadge reward`) + `UChip` bell + `UAvatar` menu | |
| `user/UserBottomNav.vue` | `DsBottomNav` (L2) built on `UNavigationMenu orientation="horizontal"`; safe-area padding in config | Nuxt UI has no bottom tab bar |
| `user/ImpersonationBanner.vue` | `UBanner` via `DsModeBanner` (L2) | Becomes **Mod Pelajar** banner (D31c) |
| `shared/ShellLink.vue`, `shared/NavIcon.vue` | `ULink`, `UIcon` | |
| `public/PublicLayout.vue`, `PublicTopBar.vue`, `PublicFooter.vue`, `PublicCta.vue` | `UHeader`, `UFooter`, `UPageHero`/`UPageSection`, `UButton` | Guest/auth layout, see shells doc §4 |
| `dev/ShellPreview*.vue`, `PreviewHub.vue` | Replaced by the Galeri DS dev route | Not shipped |
| `user-shell.css`, `admin-shell.css`, `live-globals.css`, `dashboard.css` | Deleted as modules migrate | No page-level CSS (rule G-4) |

### 10.3 L2 pattern inventory (the complete list; additions need approval)

`DsPage` (title/subtitle from route meta, gutters, optional toolbar slot) · `DsDataTable` · `DsFilterBar` · `DsStat` · `DsProgressRing` · `DsChart` · `DsDialog` · `useConfirm` · `DsErrorPage` · `DsBottomNav` · `DsModeBanner` · `DsRoleChip` (+ switcher) · `DsServerStatus` · `DsShellPentadbiran` · `DsShellPembelajaran` · `DsShellAuth`. Question card / question intake UI is **out of scope** (D28e, separate spec).

---

## 11. Guard rules ("components + tokens only")

Enforced by tooling; any failure blocks G3/G4. Scope: `src/**/*.vue` and `src/**/*.ts` except `src/design-system/**` (the one place allowed to use palettes and arbitrary values).

| # | Rule | Enforcement |
|---|---|---|
| G-1 | **Allowed utility families in pages**: layout only — `flex`, `inline-flex`, `grid`, `grid-cols-*`, `col-span-*`, `gap-*`, `items-*`, `justify-*`, `self-*`, `place-*`, `order-*`, `grow`, `shrink`, `basis-*`, `block`, `inline-block`, `hidden`, `contents`, `w-*`, `h-*`, `min-*`, `max-*`, `size-*`, `p*-*`, `m*-*`, `space-*`, `relative`, `sticky`, `top-0`/`inset-*` (only with `relative` parent), `overflow-*`, `truncate`, `text-start/center/end`, `aspect-*`, plus responsive/state prefixes `sm: md: lg: xl: 2xl: pointer-coarse:`. Plus the **semantic token utilities**: `text-{default,toned,muted,dimmed,highlighted,inverted}`, `text-{primary,secondary,success,info,warning,error,reward}`, `bg-{default,muted,elevated,accented,inverted}`, `border-{default,muted,accented}`, type scale (`text-display … text-overline`, `tabular`). | ESLint rule `ds/class-allowlist` (custom flat-config rule scanning `class`/`:class` strings; dynamic expressions must resolve to allowed literals) |
| G-2 | Spacing steps limited to 1, 2, 3, 4, 6, 8, 12, 16 (and `0`, `auto`, `full`, fractions, `screen`/`dvh` for sizing). | Same rule |
| G-3 | **Banned**: arbitrary values `[...]` and `(--var)` syntax; palette/colour utilities with a palette name or step (`bg-red-500`, `text-kobalt-600`, `border-ink-200`); `#hex`, `rgb()`, `hsl()`, `oklch()` anywhere in templates, scripts, `style`; gradients (`bg-gradient-*`, `from-/via-/to-`); `shadow-*` except none; `rounded-*`; `z-*`; `animate-*`; `transition-*`/`duration-*`/`ease-*`; `font-*` and stock `text-xs…text-9xl`; `opacity-*`; `ring-*`/`outline-*`/`border-{width}`. Those belong to components/config. | Same rule + regex test |
| G-4 | No `<style>` blocks, no `style=` or `:style=` attributes in pages (dynamic widths go through component props: `UProgress :model-value`, `DsProgressRing :value`). No per-page CSS files. | ESLint `vue/no-restricted-syntax` + file glob check |
| G-5 | No raw interactive or structural HTML in pages where a component exists: `<button> <input> <select> <textarea> <a> <table> <dialog> <img>` (use `UButton`, `UInput`, `USelect`, `UTextarea`, `ULink`, `UTable`/`DsDataTable`, `DsDialog`, `UAvatar`; user-uploaded images render through `UAvatar` or a DS pattern, never a bare `<img>`). Layout elements (`div`, `section`, `main`, `ul`, `li`, `p`, `h1`–`h6`, `span`, `form` via `UForm`) are allowed. | ESLint `vue/no-restricted-html-elements` |
| G-6 | Imports: pages import UI only from `@nuxt/ui` (auto-registered) and `@/design-system`. Banned in pages: `@lucide/vue`, `@fontsource/*`, `chart.js`, `@/components/*` (legacy, frozen), `@/shells/*` internals. | ESLint `no-restricted-imports` |
| G-7 | Colour/radius/shadow/font/motion decisions exist only in `tokens.css`, `theme.config.ts`, `density.ts`. Hex/rgb literals outside `tokens.css` fail. | Stylelint `color-no-hex` with allowlist path; ESLint literal check |
| G-8 | Tailwind IntelliSense/Prettier class-order plugin stays; `eslint-plugin-tailwindcss` `no-custom-classname` + `no-arbitrary-value` run with the G-1 allowlist as the `whitelist`. | ESLint |
| G-9 | **Token tests (Vitest)**: parse `tokens.css`, assert every pair in §3.3 meets its ratio in light and dark; assert every `--ui-*`/`--ds-*` token has both modes; assert `ui.colors` aliases all exist as palettes with 11 steps. | `design-system/__tests__/tokens.test.ts` |
| G-10 | **Visual/a11y e2e**: Playwright captures the Galeri DS and each shell at 375/768/1280 in light and dark; `axe-core` must report 0 serious/critical; no horizontal page scroll assertion (`scrollWidth <= clientWidth`) at 320/375/768/1280. | `e2e/ds/*.spec.ts` |
| G-11 | Every new Ds pattern has a Galeri DS entry covering all states (default, hover, focus, active, disabled, loading, error, empty) and both modes. | Review checklist at G4 |
| G-12 | No exceptions in pages. A need that the allowlist cannot meet becomes a design-system change request (new token, config override or L2 pattern) approved by the design-system owner. | Process |

Migration note: legacy modules keep their old components until each is migrated module-by-module; G-1…G-8 apply to migrated files via an `eslint` override list (`files: migrated.txt`) that only grows. The old `theme.css` (Tailwind v3 hex palette overrides) is removed when the last legacy module is migrated; the new palettes use unique names so both can coexist.

---

## 12. Accessibility baseline (WCAG 2.2 AA) for the system

- Contrast: §3.3, re-asserted in CI (G-9).
- Focus: 2px outline `outline-primary`, 2px offset, visible on every interactive element (WCAG 2.4.7/2.4.11); never removed. Skip link "Langkau ke kandungan" is the first focusable element in every shell.
- Target size ≥ 44px on `pointer-coarse` (2.5.8 exceeded); spacing between adjacent targets ≥ 8px.
- Text: 16px minimum for body/inputs on mobile, 12px minimum anywhere; reflow at 320px; supports 200% zoom and OS text-scale; no fixed pixel heights on text containers.
- Colour is never the only indicator (icon + text on status, bar + weight on active nav, check glyph in switches).
- Forms: visible labels (no placeholder-only), `aria-describedby` for hint/error, errors announced on submit (`role="alert"` summary + focus first invalid field), required marked.
- Motion: §7; no content flashes > 3/s.
- Dialogs: focus trap, Esc, focus return, labelled title (Reka UI handled), `aria-modal`.
- Language: `<html lang="ms">`; English words (LIVE, PRO, AI) in badges keep `lang="en"` where the badge is a sentence.
- Dark mode ships with parity: every component state verified in both modes (G-10).

---

## 13. Build tasks implied (for the architect's task list)

| ID (proposed) | Task | Exit |
|---|---|---|
| DS-T0 | **Spike**: Vue + Vite + `@nuxt/ui` v4 on a scratch route: `UApp`, `UDashboardGroup/Sidebar/Navbar/Panel`, `UDashboardSearch` (Ctrl+K), `UNavigationMenu`, `UToast`, `UModal/UDrawer`, `UBanner`, `UEmpty`, `UError`, `UTable`, colour mode, `i-lucide` bundling; confirm option names (`theme.colors`, slots) | Written result; fallbacks chosen where a component fails |
| DS-T1 | `tokens.css`, `theme.config.ts`, `density.ts`, fonts, `@iconify-json/lucide` | Galeri DS shows palette/type/radius in both modes |
| DS-T2 | Guard rules G-1…G-9 and migrated-file list | Lint fails on seeded violations |
| DS-T3 | L2 patterns (§10.3) with Galeri DS entries and a11y e2e (G-10, G-11) | axe clean, 3 widths × 2 modes |
| DS-T4 | Shells (`v2-shells.md`) | Shell e2e at 375/768/1280 |
| DS-T5+ | Module-by-module re-skin in the order set by the tracker | per module G4/G5 |

---

## 14. Open questions (blocking only; each has a recommended default applied in this draft)

| # | Question | Recommended default |
|---|---|---|
| Q1 | Approve the brand direction: "Gelanggang" concept; cobalt primary + lime highlight + mangga reward on ink neutral; fonts Bricolage Grotesque + Plus Jakarta Sans replacing Outfit + Inter. | Approve as drawn. If a different primary hue is preferred, only `kobalt` (and its contrast row) changes; the system is palette-agnostic. |
| Q2 | Replace native `confirm()`/`alert()` (replicated since D10) with a themed in-app confirm dialog (same exact BM text)? Native dialogs cannot be themed and look broken on mobile in a branded UI. | Yes, themed `useConfirm()`; text unchanged. |
| Q3 | Subject/class colours are stored as free hex in M03 seeds and picked with a colour picker. Map them to the 8 category slots (picker becomes a slot picker)? Needed for "no arbitrary colours". | Yes; seed hex mapped to the nearest slot, recorded in the module's deviation table. |
| Q4 | Density by role: only **Murid** uses the bold learner density; Guru, Ibu Bapa, Penaja use the calm staff density. | Yes. |
| Q5 | Pagination copy is English Laravel default today ("Showing x to y of z results"). Change to BM? | Yes, BM ("Menunjukkan … daripada … hasil", "Sebelum", "Seterusnya"). |
| Q6 | Tagline "Sedia untuk SPM." on brand surfaces (PROPOSED copy). | Approve, or supply the official line. |
| Q7 | Nuxt UI Dashboard family / `UDashboardSearch` in plain Vue is unverified in docs. Accept the DS-T0 spike with the stated fallback (same visuals, composed parts)? | Yes. |
