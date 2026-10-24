# PrestasiPlus v2 — Design System (Nuxt UI + own theme)

| Field | Value |
|---|---|
| Slug | `v2-design-system` |
| Version | **2.0** (supersedes the unnumbered 0.1 draft "Gelanggang") |
| Status | **Approved (D33–D38)** — G2 design closed once these docs are merged |
| Date | 2026-10-16 |
| Author | ui-ux-designer |
| Companion | `docs/design/v2-shells.md` (portal shells, login, Langsung, learner quiz and win screens) |
| Visual sources of truth | `docs/design/v2-learner-prototype.html` (learner, accepted D37/D38), `docs/design/v2-theme-preview.html` variant **B+ "Warna Tema"** (staff), `docs/design/v2-visual-choices.html` (final choices D38) |
| Requirements | `docs/requirements/v2-portals.md`, `docs/requirements/v2-cloud-gap.md` |
| Supersedes (visuals only) | `docs/design/design-system.md`, `docs/design/shells.md`. The FA→icon meaning table (old §6) stays the authority for *which glyph* an FA name means; its target set changes from Lucide to Phosphor (§10). |
| Language | Doc in English; UI copy in Bahasa Melayu; existing functional BM copy stays verbatim; **PROPOSED** marks new copy. |

**Change log**

| Version | Change |
|---|---|
| 2.0 | Rewritten to the approved visuals. Two personalities on one token system: **Pentadbiran (staff, B+)** and **Pembelajaran learner (Elektrik)**. Removed (superseded, do not implement): Gelanggang version-A "pop" hard shadow and 2px outlines, lime "sticker" button with border, `reward`/mangga orange fills, all-grey icons, per-group rainbow icons, Lucide, songket pattern as a default surface. Added: Elektrik accents A1–A4, solid accent icon chips, gradient hero card, meaning-coloured character cards, Phosphor Duotone/Regular, Fluent Emoji 3D rewards, virtual friend (Aiman/Aisyah), motion catalogue, learner pattern mapping. |
| 0.1 | Draft concept "Gelanggang" (not approved). |

Nuxt UI facts relied on (ui.nuxt.com, 2026-10-16). Items marked **spike** are confirmed by task DS-T0 because the docs do not state them for plain Vue:

- Current major **v4**. Vue + Vite install: `@nuxt/ui` + `tailwindcss`; `ui()` from `@nuxt/ui/vite` after `vue()`; `app.use(ui)` from `@nuxt/ui/vue-plugin` after the router; CSS `@import "tailwindcss"; @import "@nuxt/ui";`; root wrapped in `<UApp>`; root container class `isolate`.
- Theme config in Vue = the object passed to `ui({...})` (`ui.colors`, `ui.<component>` slots/variants). Tokens are `--ui-*` CSS variables overridden in `:root` / `.dark`. Override priority: `class` > `ui` prop > `<UTheme>` > global config > default.
- Components used exist in the v4 index: Dashboard family, `UNavigationMenu`, `UCommandPalette`, `UBanner`, `UEmpty`, `UError`, `UChart`, `UTimeline`, `UStepper`, `UToast`, `UModal`, `UDrawer`, `USlideover`, `UCarousel`, `UTabs`, `UProgress`. **Spike:** Dashboard family + `UDashboardSearch` (Ctrl/Cmd+K) in plain Vue. Fallback: `USlideover` + `UNavigationMenu` + `UCommandPalette` in `UModal`; visuals unchanged.
- Icons: `UIcon` with Iconify names; `@iconify-json/ph` bundles Phosphor into the build (offline, no runtime API call).

---

## 1. Brand direction: two personalities, one token system

### 1.1 Concept

PrestasiPlus keeps one brand (name "PRESTASI+", fonts, kobalt as the staff theme colour, ink neutrals) but speaks in two registers:

| | **Portal Pentadbiran** (staff, calm) | **Portal Pembelajaran — Murid** (learner, "Elektrik") |
|---|---|---|
| Feel | Professional control room: quiet layers, one theme colour, meaning-only colour | Premium dark-first game feel for SPM candidates: charcoal base, electric focus points, friendly peer, celebrations at win moments |
| Attribute | `data-personality="staff"` | `data-personality="learner"` |
| Roles | Admin Pusat, Pegawai PPD/JPN, Admin Sekolah, **and** Guru, Ibu Bapa, Penaja (they use the staff look inside the Pembelajaran shell) | Murid only |
| Default colour mode | Follow system | **Dark** (user toggle; persisted) |
| Source | Preview B+ | Learner prototype (Elektrik) |

Tagline for brand surfaces: **"Sedia untuk SPM."** (accepted D33).

### 1.2 Principles (testable)

1. **60-30-10.** Neutral surfaces ≈ 60%, secondary surfaces/text ≈ 30%, accent ≈ 10% of any viewport. Colour appears only at **focus points**.
2. **Layers, not lines.** No borders, dividers or outline buttons anywhere. Hierarchy = surface level (page → raised → elevated, **max 3**) + soft shadow tokens.
3. **Colour is meaning.** Staff: kobalt is the only action/theme colour; semantic colours (success/warning/error/info) only where they carry meaning. Learner: 4 accents + semantic green/red, each with a fixed job (§3.3).
4. **No tone-on-tone in the learner portal and no over-festive tinting.** Accent icons sit on **solid** accent chips with white/ink glyphs, or are neutral glyphs on neutral cards. (Staff B+ keeps small 12% theme tints behind icons; see §3.2.)
5. **Numbers are the hero.** Scores, streaks, ranks use display numerals (tabular). A progress bar always shows its number.
6. **Colour is never the only signal** (WCAG 1.4.1): status = icon + word; active nav = tone + weight (staff) or filled pill with label (learner).
7. **Respect the exam context.** No celebration on wrong answers; the friend encourages, never shames; no streak-loss guilt copy.
8. **Reward = neutral icon + big number (staff) / Fluent 3D + big number (learner).** No orange reward fills.

---

## 2. Delivery mechanism

All brand customisation lives in three central files; pages contain no colour, radius, shadow, font, motion or icon-weight decisions.

```
src/design-system/
  tokens.css          # palettes (@theme static) + --ui-* overrides + --ds-* extras, per personality and colour mode
  theme.config.ts     # object given to ui({...}) in vite.config.ts: colors + component overrides
  density.ts          # staffUi / learnerUi passed to <UTheme :ui> at the shell root
  patterns/           # Ds* components (§12.3) — the only place that composes Nuxt UI into new parts
  assets/3d/          # Fluent Emoji 3D PNG/WebP (bundled, MIT) + LICENSE
  assets/friends/     # aiman_face.png, aisyah_face.png (+ mood variants if later added)
  illustrations/      # SVG empty-state art (token colours only)
  index.ts            # the only import path pages may use
```

Personality switch: the shell root sets `data-personality` and `data-density`; `tokens.css` defines the same token names under `[data-personality="staff"]` and `[data-personality="learner"]`, each with light and dark values (`.dark`). A `<UTheme :ui="staffUi|learnerUi">` wrapper applies component-level differences.

Aliases (`ui.colors`): `primary` = `kobalt` (staff) / `elektrik` (learner); `secondary` = `limau` (win); `success`, `info`, `warning`, `error`, `neutral` = `ink`. There is **no `reward` alias** (orange reward fills removed). Alias→palette resolution is per personality via the `--ui-*` overrides below, so components never know which personality they are in.

`theme.config.ts` shape (spec, not production code):

```ts
export default {
  colorMode: true,   // .dark on <html>; learner default 'dark', staff default 'system' (set by shell)
  ui: { colors: { primary:'kobalt', secondary:'limau', success:'daun', info:'laut',
                  warning:'mentari', error:'delima', neutral:'ink' },
        /* component overrides: §5 */ },
}
```

---

## 3. Colour

### 3.1 Palettes (`@theme static`, 11 steps; used only inside `tokens.css`/`theme.config.ts`)

| Step | `kobalt` | `ink` | `limau` | `daun` | `laut` | `mentari` | `delima` | `ungu` (dot only) |
|---|---|---|---|---|---|---|---|---|
| 50 | #EEF3FF | #F5F7FB | #F8FFE0 | #EDFBF2 | #ECFCFF | #FFF9E6 | #FFF1F3 | #F6F0FF |
| 100 | #DDE6FF | #EBEEF5 | #EFFDB8 | #D3F6E0 | #D0F6FD | #FFF0BF | #FFE0E5 | #EBDDFF |
| 200 | #BFD0FF | #D5DBE8 | #E1FB86 | #A9EBC4 | #A6ECFA | #FFE185 | #FFC7D1 | #D8BFFF |
| 300 | #93AEFF | #A9B3C8 | #D0F54F | #72DAA0 | #67DCF3 | #FFCE47 | #FF9DAF | #BE96FF |
| 400 | #6283FF | #7D88A0 | #BCEB27 | #3CC57C | #2CC4E3 | #FFB91A | #FF6685 | #A06CFF |
| 500 | #3B5CFF | #5F6A84 | #A3D116 | #1FAA63 | #0FA6C7 | #F29A00 | #F43760 | #8447F5 |
| 600 | #2440F0 | #49536C | #7FA50E | #138A50 | #0B85A6 | #CC7600 | #D91A48 | #6B2AD8 |
| 700 | #1C31D1 | #3A4258 | #5F7D0F | #116E42 | #0E6A85 | #A35A02 | #B71240 | #5520B0 |
| 800 | #1D2EA6 | #262D40 | #4B6112 | #115737 | #135669 | #84470A | #991240 | #471D8D |
| 900 | #1D2C83 | #171C2D | #3F5213 | #0F482F | #144858 | #6E3B0E | #821340 | #3B1B70 |
| 950 | #141C52 | #0D1120 | #1F2D04 | #052919 | #082F3C | #401E03 | #490520 | #240E47 |

The learner "Elektrik" accents (§3.3) are separate named tokens, not palette steps, because they are exact approved values.

### 3.2 Staff personality tokens (Portal Pentadbiran and staff roles) — B+ "Warna Tema"

Layers (max 3): **page** `--ui-bg-muted`, **raised** `--ui-bg` (cards, sidebar, bars), **elevated** `--ui-bg-elevated` (inputs, hover, chips, segmented track). `bg-accented` is the pressed/hover-on-elevated step; `--ds-bg-soft` is the zebra row.

| Token (utility) | Light | Dark |
|---|---|---|
| `--ui-bg-muted` (`bg-muted`, page) | #EBEEF5 | #0D1120 |
| `--ui-bg` (`bg-default`, raised) | #FFFFFF | #171C2D |
| `--ui-bg-elevated` (`bg-elevated`) | #EBEEF5 | #262D40 |
| `--ui-bg-accented` (`bg-accented`) | #D5DBE8 | #3A4258 |
| `--ds-bg-soft` (`bg-soft`, zebra) | #F5F7FB | #1E2437 |
| `--ds-seg-active` (`bg-seg-active`, active tab chip) | #FFFFFF | #3A4258 |
| `--ui-bg-inverted` (`bg-inverted`, tooltips, selected neutral button; pairs with `--ui-text-inverted`) | #171C2D | #EBEEF5 |
| `--ui-text-highlighted` | #0D1120 | #FFFFFF |
| `--ui-text` | #262D40 | #EBEEF5 |
| `--ui-text-toned` | #3A4258 | #D5DBE8 |
| `--ui-text-muted` | #49536C | #A9B3C8 |
| `--ui-text-dimmed` | #5F6A84 | #7D88A0 |
| `--ui-text-inverted` | #FFFFFF | #0D1120 |
| `--ui-border`, `-muted`, `-accented`, `-inverted` | **transparent** (all four; the utilities exist only inside Nuxt UI internals and resolve to nothing) | transparent |
| `--ui-primary` (kobalt: actions, links, focus, active) | #2440F0 | #6283FF |
| `--ds-primary-on` (label on solid primary) | #FFFFFF | #0D1120 |
| `--ui-success` | #116E42 | #3CC57C |
| `--ui-info` | #0E6A85 | #2CC4E3 |
| `--ui-warning` | #84470A | #FFB91A |
| `--ui-error` | #B71240 | #FF6685 |
| `--ui-secondary` (lime, win/Mod Pelajar only) | #4B6112 | #BCEB27 |
| `--ds-highlight` / `--ds-on-highlight` | #BCEB27 / #0D1120 | #BCEB27 / #0D1120 |
| `--ds-ic-theme` (icon theme colour = kobalt) | #2440F0 | #6283FF |
| `--ds-overlay` | rgba(13,17,32,.6) | rgba(0,0,0,.6) |

**Staff icon rule (B+):** every icon in nav groups, stat tiles, reward/xp chips and subject tiles uses the single theme colour `--ds-ic-theme` (kobalt). Group/stat/subject icons sit on a 32px rounded-md chip filled with `--ds-ic-theme` at 12% (the staff tint; this is the only place tone-on-tone is allowed, and only for staff). Reward/streak/coin icons in staff views are the same kobalt glyph (no orange), numbers stay neutral display. Semantic colours (success/warning/error/info) never decorate icons unless they carry that meaning.

**Subjects (staff views, charts):** monochrome kobalt icon on its chip + an 8-slot **colour dot** for identity. Slots `--ds-cat-1..8`:

| Slot | Light | Dark | Slot | Light | Dark |
|---|---|---|---|---|---|
| 1 | kobalt-600 #2440F0 | kobalt-400 #6283FF | 5 | mentari-800 #84470A | mentari-400 #FFB91A |
| 2 | limau-800 #4B6112 | limau-400 #BCEB27 | 6 | mangga #A33F05 | #FF8A2B |
| 3 | delima-700 #B71240 | delima-400 #FF6685 | 7 | ungu-600 #6B2AD8 | ungu-400 #A06CFF |
| 4 | laut-700 #0E6A85 | laut-400 #2CC4E3 | 8 | daun-700 #116E42 | daun-400 #3CC57C |

Data stores a **slot number 1–8**, never hex (D33a). The dot is 12px, offset top-right of the icon chip, ringed in the raised surface colour. Slot 7 (ungu) is allowed as a dot (e.g. Fizik) per the lead. Slot 6 uses mangga #A33F05 / #FF8A2B as a dot-only value (not a palette alias).

**Shadow tokens (staff; same names in learner):**

| Token | Light | Dark |
|---|---|---|
| `shadow-xs` | 0 1px 2px rgba(13,17,32,.05), 0 2px 8px rgba(13,17,32,.05) | none (surface step instead) |
| `shadow-lift` | 0 6px 20px rgba(13,17,32,.10) | 0 6px 20px rgba(0,0,0,.35) |
| `shadow-card` | 0 8px 24px rgba(13,17,32,.08) | 0 8px 24px rgba(0,0,0,.35) |
| `shadow-modal` | 0 16px 40px rgba(13,17,32,.18) | 0 16px 40px rgba(0,0,0,.6) |
| `shadow-bar` / `shadow-bar-up` (top/bottom bars) | 0 2px 12px / 0 -2px 12px rgba(13,17,32,.06) | none |
| `shadow-cta` (primary button) | 0 4px 12px rgba(36,64,240,.28) | 0 4px 12px rgba(0,0,0,.4) |

### 3.3 Learner personality tokens — "Elektrik"

Neutral charcoal/white base; colour only at focus points. Four accents with fixed jobs plus semantic green/red.

| Accent | Job | Dark | Light | On-colour |
|---|---|---|---|---|
| **A1 Action** (`--ui-primary`, `--ds-c1`) | Primary actions, hero card, active nav/tab pill, links, progress, focus ring, subject icon chips | `#2F5BFF`; gradient end `--ds-primary-2` `#6A4DFF` (`--ds-primary-gradient: 135deg #2F5BFF → #6A4DFF`); text/link tone `--ds-primary-t` `#4D7CFF` | same fills; `--ds-primary-t` `#2F5BFF` | `#FFFFFF` |
| **A2 Win** (`--ui-secondary`, `--ds-highlight`, `--ds-c2`) | Win moments only: float "+XP", stickers, level/progress fill on win, achievements card, Mod Pelajar | `#C6F432` | fill `#C6F432`; `--ds-win-ring` (ring/bar on light surfaces) `#6FA300` | `#0B0D12` |
| **A3 Reward / heat** (`--ds-c3`, `--ds-ic-flame`) | Streak flame glyph, combo heat, warning character card, reward icon chip | `#FF7A1A`; flame glyph `#FF7A1A` | chip `#FF7A1A`; flame glyph on light `#D9480F` | `#0B0D12` |
| **A4 Friend / AI** (`--ds-c4`, `--ui-info`, `--ds-ai`) | Cikgu Alesa "AI" pill, info carousel card, friend avatar halo, picker selected state | chip `#7C3AED`; AI glow `#9B6BFF` (`--ds-ai-a` `#C3A2FF`, `--ds-ai-b` `#8A55F5`) | chip `#7C3AED`; AI `#7C3AED` (a `#A98BFF`, b `#7C3AED`) | `#FFFFFF` |
| Semantic green (`--ui-success`) | Correct, done | `#34D17F` | `#0B7D43` | dark: `#0B0D12`; light: `#FFFFFF` |
| Semantic red (`--ui-error`) | Wrong, destructive, LIVE | `#FF5A7A` | `#D11A48` | dark: `#0B0D12`; light: `#FFFFFF` |
| Amber (`--ds-amber`, trial card only) | "Percubaan Percuma" character card | `#FFB41F` | `#FFB41F` | `#0B0D12` |

Neutrals:

| Token | Dark (default) | Light |
|---|---|---|
| `--ui-bg-muted` (page) | #0B0D12 | #F5F6F8 |
| `--ui-bg` (raised: cards, tab bar, sidebar) | #15181F | #FFFFFF |
| `--ui-bg-elevated` (chips, sheet, option letter) | #1E222B | #ECEEF2 |
| `--ds-bg-soft` | #191C24 | #F0F2F5 |
| `--ds-bg-device` (review frame only) | #101319 | #E6E8EC |
| `--ds-ink` | #0B0D12 | #0B0D12 |
| `--ui-text-highlighted` | #FFFFFF | #0B0D12 |
| `--ui-text` | #E6E8EE | #1E222B |
| `--ui-text-toned` | #C9CDD6 | #363B47 |
| `--ui-text-muted` | #A3A9B7 | #565C6B |
| `--ui-text-dimmed` | #7E8594 | #6F7585 |
| `--ui-text-inverted` | #0B0D12 | #FFFFFF |
| `shadow-lift` | 0 6px 20px rgba(0,0,0,.35) | 0 6px 20px rgba(11,13,18,.10) |
| `shadow-card` | 0 8px 24px rgba(0,0,0,.35) | 0 8px 24px rgba(11,13,18,.08) |
| `shadow-modal` | 0 16px 40px rgba(0,0,0,.6) | 0 16px 40px rgba(11,13,18,.18) |
| `shadow-cta` (`--e-cta`) | 0 6px 18px -4px primary @60% | same |
| `shadow-hero` | 0 14px 40px -14px primary @70% | same |
| Sheet scrim | rgba(5,7,10,.62) | same |

Meaning-coloured **character cards** (old Home content, D37): background = the meaning colour mixed into the raised surface (`color-mix` 12–16% into `--ui-bg`), an **accent solid icon chip** and a **solid accent CTA**:

| Card | Meaning | Chip / CTA fill |
|---|---|---|
| Percubaan Percuma / langganan | amber (trial) | `--ds-amber` + ink |
| Amaran (e.g. streak/limit) | orange (warning) | A3 + ink |
| Info carousel | violet (info) | A4 + white |
| Pencapaian / achievements | lime (win) | A2 + ink |
| Tindakan (default) | blue (action) | A1 gradient + white |

These tints are card **backgrounds** at low mix on purpose (meaning-coloured character cards); the rule "no tone-on-tone" forbids same-hue icon-on-tint, so icons on these cards always use a **solid** chip.

### 3.4 Contrast (WCAG 2.2 AA) — calculated

Ratios computed from the hex values with the WCAG luminance formula (hand-calculated; CI re-asserts, rule G-9). Text ≥ 4.5:1; large text, UI glyphs and focus ≥ 3:1.

| Pair | Ratio |
|---|---|
| **Staff** text #262D40 on white / on #EBEEF5 page | 13.7 / 11.6 |
| Staff `text-muted` #49536C on white / on #F5F7FB | 7.7 / 7.0 |
| Staff `text-dimmed` #5F6A84 on white / on #F5F7FB | 5.4 / 4.9 |
| Staff dark text #EBEEF5 on #171C2D | ≈14.5 |
| Staff kobalt #2440F0 on white; white on solid kobalt | 6.9 |
| Staff dark kobalt #6283FF on #171C2D; #0D1120 on solid kobalt-400 | 5.0 / 5.6 |
| Staff success/info/warning/error (light) on white | 6.3 / 6.1 / 7.3 / 6.6 |
| **Learner** white on A1 #2F5BFF / on #6A4DFF (hero, active pill) | 5.2 / 5.1 |
| Learner `--ds-primary-t` #4D7CFF on raised #15181F (dark) | 4.8 (not allowed on `bg-elevated`: 4.3) |
| Learner `--ds-primary-t` #2F5BFF on white / on #F5F6F8 (light) | 5.2 / 4.8 |
| Ink #0B0D12 on A2 lime #C6F432 | 15.2 |
| Ink on A3 #FF7A1A | 7.5 |
| White on A4 #7C3AED | 5.7 |
| Learner dimmed #7E8594 on raised dark / #6F7585 on white | 4.8 / 4.6 (not on page-level light surface #F5F6F8: 4.25) |
| Success #0B7D43 / error #D11A48 on white (light) | 5.2 / 5.3 |
| Focus ring (2px primary) vs adjacent surface | ≥ 4.8 in both modes |

Rules from the numbers: `text-dimmed` carries no essential info and never sits on `bg-elevated`; `--ds-primary-t` text only on page/raised surfaces; lime and orange fills always take ink labels; white labels only on A1, A4, error/success light fills.

### 3.5 Accepted risk R-1 — borderless filled inputs (WCAG 1.4.11)

Inputs, selects and search buttons have **no border**; they are filled with `bg-elevated` on a `bg-default` card. Fill contrast against the card is only ≈ 1.15:1 (light) / ≈ 1.3:1 (dark), below the 3:1 expected for a control boundary. The lead accepted the risk (D34) on this reasoning: (1) every field has a **visible persistent label**; (2) a visible **placeholder/hint** shows the expected input; (3) **focus** shows a 2px primary ring (≥ 4.8:1); (4) error shows a 2px inset `error` ring plus icon and text; (5) controls are ≥ 44px tall and full width so the target is obvious; (6) disabled/readonly fields differ by text colour and opacity; a **disabled primary button** (solid, and the staff tonal default) does not dim at all: it is a flat `bg-elevated` fill (dark: `bg-muted`), no gradient, no shadow, no hover lift, with the label in `text-dimmed` (learner: `text-muted`) at full opacity, so the label reads 4.7:1 (staff light), 5.3:1 (dark) and 6:1 (learner light); a button that is only `loading` keeps its fill and the stock 40% dimming. Revisit if the QA a11y audit fails the criterion; the fallback is a `ring-1` `--ds-ring-field` token (no change to pages).

---

## 4. Layers, shadows and shape

- **Levels (max 3):** page → raised → elevated. A control sitting on a raised card uses the elevated fill; on the page it uses raised. Never stack a fourth level; use `bg-accented`/hover step instead of nesting cards.
- **No lines:** `border-*`, `divide-*`, `outline-*` (as decoration), `ring-*` (as decoration) are not used. Separation = gaps, level steps, zebra rows. Focus and error rings are the only rings (2px).
- **Soft shadows:** use only `shadow-xs / lift / card / modal / bar / bar-up / cta / hero` (tokens in §3). The hard "pop" shadow, 2px sticker outlines, `--ds-pop-*`, `--ds-control-border` are **removed**.
- **Radius** (2026-10-18, user decision; supersedes the earlier values; `--ui-radius: 0.5rem` gives Nuxt xs 4 / sm 8 / md 12 / lg 16 / xl 24, tokens `--ds-r-xs..xl` in `tokens.css`): **xs 4** tags and checkboxes; **sm 8** inputs, chips and icon chips (`--ds-r-chip`); **md 12** buttons, segmented lists, toasts; **lg 16** cards and tables (`--ds-r-card`, both personalities); **xl 24** hero cards, feature cards, modals and sheets (`--ds-r-sheet`); **full** pills, badges, avatars, dots. Size follows importance, and an inner radius is the outer radius minus the padding between them (a button or chip is always smaller than the card around it). No `rounded-2xl` / `rounded-3xl` on pages or composites.
- **Bars:** top bar and bottom nav use `shadow-bar` / `shadow-bar-up` with their own z-order, never a border.

---

## 5. Component overrides (`theme.config.ts`) — how Nuxt UI achieves "no lines / tonal / filled"

General method: set every border-producing slot to `border-0`/`ring-0` globally, replace `outline` variants with the tonal look, and drive fills from the surface tokens. Slot names are Nuxt UI 4.x; **DS-T0 confirms them**; the table is the spec of intent. Token utilities only.

| Component | Override | Result |
|---|---|---|
| `button` | `base`: `font-semibold transition-[transform,box-shadow,background-color] duration-200 ease-pop active:scale-[.97] pointer-coarse:min-h-11`. `variants.variant`: **`outline` redefined** as tonal (`bg-elevated text-highlighted hover:bg-accented`, no ring); `soft/subtle` → `bg-elevated`; `ghost`, `link` unchanged. `compoundVariants`: `solid`+`primary` → learner `bg-gradient-primary text-primary-on shadow-cta`; staff `bg-primary text-primary-on shadow-cta`. `solid`+`secondary` → `bg-highlight text-on-highlight`. `solid`+`error` → `bg-error text-on-sem`. Sizes: learner `md` 52px/`lg` 56px, radius 16px; staff `md` 36px (44px coarse), radius `md`. Disabled `opacity-40 cursor-not-allowed`. | Filled/tonal buttons, no outline |
| `input`, `textarea`, `select`, `selectMenu`, `inputMenu`, `inputNumber`, `inputDate`, `inputTime`, `inputTags`, `pinInput` | `base`: `bg-elevated text-default placeholder:text-muted ring-0 border-0 rounded-md hover:bg-accented focus-visible:ring-2 focus-visible:ring-primary`; error: `ring-2 ring-inset ring-error` (inset 2px); 16px text always; height learner 52px / staff 40px (44px coarse). | Filled inputs, 2px primary focus ring, 2px inset error ring |
| `formField` | `label` `text-label text-default`; `hint/help` `text-caption text-muted`; `error` `text-caption text-error` + leading icon | Label + placeholder carry the control (R-1) |
| `checkbox`, `radioGroup`, `switch` | Unchecked box/track `bg-elevated`, checked `bg-primary`, glyph check/dash (not colour-only); hit area `min-h-11`. | Filled |
| `card` | `root`: `bg-default rounded-lg shadow-lift ring-0`; `header/body/footer` no dividers (`divide-0`); padding learner `p-4`, staff `p-4 sm:p-6`. Variant `hero` (learner): `bg-gradient-primary text-primary-on shadow-hero rounded-xl`. | Raised surface + soft shadow |
| `tabs` | **Segmented** (both personalities): `list` `bg-elevated rounded-lg p-1 gap-1 w-fit max-w-full`; `trigger` `rounded-md min-h-11 text-muted`; active trigger `bg-seg-active text-highlighted shadow-xs`; `indicator` removed (no underline/bar). Learner variant: active trigger = `bg-gradient-primary text-primary-on` (filled). Counts via `UBadge`. | Raised chip, no lines |
| `navigationMenu` | `link`: `rounded-md min-h-10 pointer-coarse:min-h-12 text-muted hover:bg-elevated`; **active (staff)**: `bg-primary/10 text-highlighted font-semibold` (tone + weight, **no bar**); **active (learner)**: filled `bg-gradient-primary text-primary-on font-semibold` pill; group label `text-overline text-dimmed`; icons via `DsIcon`. | Active by tone/weight (staff), filled pill (learner) |
| `dashboardSidebar` | `root`: `bg-default shadow-xs` (no `border-e`); `header/footer` `p-4`. | Layer, no line |
| `dashboardNavbar` | `root`: `h-(--ui-header-height) bg-default shadow-bar`. | |
| `modal`, `drawer`, `slideover` | `overlay` `bg-(--ds-overlay)`; `content` `bg-default rounded-lg shadow-modal`; learner bottom sheet uses `bg-elevated rounded-t-[28px]` (via `--ds-r-sheet`); `< sm` modals become bottom sheets (`UDrawer`), max height 90dvh (config-only value). No dividers between header/body/footer. | |
| `table` | `root`: `bg-default rounded-lg shadow-xs` ; `thead th`: `text-overline text-muted bg-transparent`; `tbody tr:nth-child(even)`: `bg-soft`; hover `bg-elevated`; **no row borders**; numeric cells `tabular`; row min-height 44px (48 coarse). < md → card list in `DsDataTable`. | Zebra on raised, no lines |
| `pagination` | Buttons tonal (`bg-elevated`), active `bg-primary text-primary-on`; 44px hit; BM copy "Menunjukkan {dari}–{hingga} daripada {jumlah} hasil", "Sebelum", "Seterusnya". | |
| `badge`, `chip` | `rounded-full font-bold text-xs`; variants `solid` (accent fills with their `on` colour) and `subtle` (`bg-elevated text-toned`); **LIVE** = `color="error" variant="solid"` + `live-pulse` (stays red); count chip `bg-primary text-primary-on` (staff) / `bg-error text-on-sem` (learner bell). Status badges always icon + word. | |
| `alert` | `variant="subtle"`: meaning tint (`bg-error/10`, etc.) + leading icon + title; no border/left bar. | |
| `toast` | `bg-elevated shadow-modal rounded-lg`, no left border; bottom-centre mobile / bottom-right desktop; 2000 (copy), 4000 (success), 6000 (error). | |
| `progress` | track `bg-elevated h-2.5 rounded-full`; indicator learner `bg-gradient-primary-h` (primary → AI, as quiz bar) / win fill `bg-win-ring`; staff `bg-primary`; numeric value in `status` slot. | |
| `tooltip`, `popover` | `bg-inverted text-inverted` / `bg-elevated shadow-modal`. | |
| `avatar` | staff `rounded-lg bg-elevated text-highlighted font-display`; learner friend: circle (see `DsFriendAvatar`). | |
| `empty`, `banner`, `kbd`, `skeleton`, `breadcrumb`, `stepper`, `timeline`, `accordion`, `collapsible`, `calendar`, `carousel`, `fileUpload`, `commandPalette`, `error` | Token-only tweaks (no borders, tonal fills). `kbd`: `bg-default shadow-xs`. | |

New Tailwind tokens declared in `tokens.css` `@theme`: `--color-highlight`, `--color-on-highlight`, `--color-win-ring`, `--color-seg-active`, `--color-soft`, `--color-primary-on`, `--color-on-sem`, `--shadow-xs/lift/card/modal/bar/bar-up/cta/hero`, `--background-image-gradient-primary` (`linear-gradient(135deg, var(--ds-c1), var(--ds-primary-2))`; staff: flat primary), `--background-image-gradient-primary-h`. Gradient is a **token**, so `bg-gradient-primary` is the only allowed gradient and appears only on: hero card, primary button, active pill, quiz progress.

---

## 6. Learner patterns (Portal Pembelajaran — Murid)

All built from Nuxt UI (L1) or a thin `Ds*` composite (L2). Anatomy from the prototype; sizes are minimums.

| Pattern | Anatomy and rules | Nuxt UI mapping |
|---|---|---|
| **Hero card** | Gradient A1 card, radius 24, `shadow-hero`; overline + title (`text-heading`) + sub + white pill CTA (`primary-on` bg, A1 text); 84px progress ring (track `primary-on` @30%, bar `primary-on`, centre number display); optional 76px 3D art overlapping top-right. | `DsHeroCard` (shipped V2-T05: gradient surface + `DsScoreRing tone="onPrimary"` + `UButton` + `DsArt3D` over a glow) |
| **Stat tile** | Raised, radius 20, `shadow-lift`, left-aligned: 40px **solid accent icon chip** (A1 white glyph / A3 ink / A2 ink / A4 white), display number (fluid 22→30px), 12px unit. With 3D rewards on, the chip is replaced by the 40px Fluent 3D image (no chip background). Entrance `rise` staggered 80ms. | `DsStatTile` (`DsIconChip`/`DsArt3D`; staggered entrance deferred, see 12.4) |
| **Icon chip** | 40px (26/36/48 variants) rounded 14px, **solid** accent fill, white or ink glyph per accent's `on` colour. Never tint + same-hue glyph. | `DsIconChip` (div + `UIcon`) |
| **Subject tile** | 88×104 scroll-snap tile, solid A1 icon chip + label; subject identity is the label, not a hue. Horizontal scroll inside its own strip. | `DsSubjectStrip` (flex + own overflow-x container; scroll-snap deferred, see 12.4) |
| **Character card** | Radius 28, meaning-tinted surface (§3.3), solid icon chip or 3D art (56–64px), title, one-line muted text, solid accent CTA (48px). Variants: trial (amber), warning (orange), info carousel (violet; `UCarousel` with dots, "Baca lagi"/"Tutup" toggle), achievements (lime), action (blue). | `DsCharacterCard` (UCard + `UBadge` + `UButton`); info carousel = `UCarousel` |
| **Friend greeting** | Friend avatar (56px, tap target) + speech bubble (raised, radius 18/18/18/6, `shadow-lift`) with friend name caption + peer-voice line. | `DsFriendAvatar` + `DsSpeechBubble` (+ typing dots) |
| **Friend avatar** | Circle, face PNG with 6% padding on `--ds-ai` @20% bg, 5px halo ring of `--ds-ai` @22% + glow shadow; mood badge (emoji, raised circle, bottom-right); idle `bob` 4s. Sizes 40 / 56 / 96 / 120. Tap opens the picker. Min hit 56px. | `DsFriendAvatar` + internal `DsFriendFace` (one AI tint on the halo; glow shadow deferred) |
| **Picker sheet** | Bottom sheet (`UDrawer`), `bg-elevated`, radius 28 top, title "Pilih rakan belajar awak", description "Dia akan temankan awak sepanjang latihan. Boleh tukar bila-bila masa.", two radio cards (`role="radio"`): friend avatar 96px, name (display), one trait line ("Tenang & suka cabaran" / "Ceria & sentiasa beri semangat"); selected = A4 22% surface + ✓ A4 badge top-right + scale 1.02; primary CTA "Pilih" (disabled until a card is chosen; "Batal" when changing); on confirm toast "Rakan belajar: {nama}". | `DsFriendPicker` (UDrawer + URadioGroup `variant="card"`) |
| **Bottom nav** | 5 tabs on raised bar, radius 22 top, `shadow-bar-up`; tab 56px min, icon 24 + 12px label; **active = filled gradient pill** with white label, icon `hop`; safe-area padding. | `DsBottomNav` (UNavigationMenu horizontal) |
| **Quiz option** | Full-width 60px, raised, radius 18; leading 36px letter chip (elevated; selected: solid A1 + white); text 17px/600; marker circle at right when locked. States: default, selected (A1 18% mix), correct (success 22% mix, solid green chip + check), wrong (error 20% mix, solid red chip + x, `nudge`), dimmed 55%. 2px inset ring only for focus. | `DsQuizOption` (UButton composite; locked states carry `aria-disabled`) |
| **Combo chip** | 44px high raised pill with flame; lit state = number highlight + flame A3 flicker; `hot` adds soft A3 glow (no ring line). | combo chip inside `DsQuizHeader` (close + gradient progress + combo); amber glow deferred |
| **Feedback sheet** | Bottom panel radius 22: good (success 16% mix) / bad (error 14% mix); h3 with solid green/red round glyph, explanation, friend/AI line in an elevated bubble, `+n` combo chip, full-width CTA "Teruskan" (check button before it is "Semak"); titles "Betul!/Mantap!/Tepat sekali!/Kemas!/Terbaik!" or "Hampir!". Enters `sheet` 500ms. | `DsFeedbackSheet` (only its text block is the live region) |
| **Win screen** | Order: 3D achievement hero (party popper 5/5, trophy 3–4/5, books 0–2/5) → title ("Sempurna/Hebat/Bagus/Teruskan, {nama}!") → score ring 168px (track elevated; bar lime `win-ring` when ≥ 3/5, A1 below 3; display number 48px + "daripada 5") → friend congratulation dialog (avatar + chat bubble with typing dots) → reward tiles +Mata / +Koin (3D icon + display number + label) → **stickers** ("Streak {n} hari!", "Tahap naik!"; lime A2, rotate −4°/+3°, stamp-in) → buttons "Kongsi" (tonal) and "Kembali ke Home" (primary); confetti burst. | `DsWinScreen` (composes `DsWinHero`, `DsScoreRing`, `DsStatTile`, `DsSticker`; friend dialog and actions are slots; confetti deferred) |
| **Reward chip** | Pill with 3D coin/flame/bolt + display number (+ small label ≥ md). | `DsRewardChip` (`DsArt3D` or `DsIcon`) |
| **Toast / float** | `+n Mata` float-up pill in A2 above the tapped option. | `DsFloatScore` (CSS animation only, `aria-hidden`; callers announce the score via `DsFeedbackSheet`) |

---

## 7. Typography

| Role | Family | Delivery |
|---|---|---|
| Display + numerals | **Bricolage Grotesque** variable 600–800 (`--font-display`) | `@fontsource-variable/bricolage-grotesque` (self-hosted, latin) |
| Body + UI | **Plus Jakarta Sans** variable 400–800 (`--font-sans`) | `@fontsource-variable/plus-jakarta-sans` |
| Arabic | Scheherazade New (unchanged) | existing dependency |

Replaces Outfit + Inter. The prototype loads from Google Fonts for review only; production bundles the fontsource files.

Scale (utilities `text-display … text-overline`, fluid via `clamp`, pages use only these; stock `text-xs…9xl` stay for Nuxt UI internals and are banned in pages):

| Utility | Family · weight | Size 375 → 1280 | Line | Tracking | Use |
|---|---|---|---|---|---|
| `text-display` | Display 800 | 2.5rem → 3.5rem (win number 3rem fixed) | 1.05 | -0.02em | Scores, win/hero numbers |
| `text-title` | Display 700 | 1.75rem → 2.25rem; staff 1.5rem → 1.75rem | 1.15 | -0.015em | Page H1 |
| `text-heading` | Display 700–800 | 1.25rem → 1.5rem; staff 1.125rem → 1.25rem | 1.25 | -0.01em | Section H2, card titles, quiz question 1.25→1.5rem |
| `text-subheading` | Sans 700 | 1.125rem → 1.25rem | 1.35 | 0 | H3, sheet titles |
| `text-body` | Sans 400–600 | 1rem (staff ≥ md 0.875rem) | 1.5 | 0 | Body. **16px on mobile always** |
| `text-label` | Sans 600–700 | 0.875rem | 1.4 | 0 | Buttons, field labels, cells |
| `text-caption` | Sans 500–600 | 0.75rem | 1.35 | 0 | Hints, units, tab labels. **Minimum 12px** |
| `text-overline` | Sans 700 uppercase | 0.75rem | 1.3 | 0.08em | Nav group labels, table headers |
| `tabular` | — | — | — | — | `font-variant-numeric: tabular-nums` on all numbers |

Colour from text tokens only. Running copy `max-w-prose` (≤ 65ch).

---

## 8. Spacing, layout

4px base; pages use steps **1, 2, 3, 4, 6, 8, 12, 16** only. Gutters 16 / 24 / 32 at 375 / 768 / 1280. Grid gaps 12 / 16 / 24 (learner stat tiles use 10px via `DsStatTile` grid, config-only). Max content width: learner 72rem (quiz column 40rem), staff 100rem. Breakpoints Tailwind default (`lg` = 1024 switches mobile ↔ desktop chrome). No horizontal page scroll at ≥ 320px; wide tables/strips scroll inside their own container.

---

## 9. Motion

| Token | Value |
|---|---|
| `--ease-out` | cubic-bezier(0.22, 1, 0.36, 1) |
| `--ease-pop` | cubic-bezier(0.34, 1.56, 0.64, 1) |
| Durations | fast 100 / base 200 / slow 500 ms |

**Catalogue** (`@theme --animate-*`; learner uses all, staff only *press*, *count-up*, *live-pulse*, 120ms page fade):

| Name | Effect | Where |
|---|---|---|
| `press` | `active:scale(.97)` 200ms ease-pop (staff: translateY 1px) | Every button/tab/option |
| `rise` | opacity 0→1, translateY 10px scale .96→1, 600ms ease-pop, stagger 80ms | Stat tiles, hero, cards on entry |
| `count-up` | Number rolls from 0/previous to value, 600–1100ms (JS tween, tabular figures) | Stats, win number, XP, ring offset 1.1–1.3s |
| `bob` | translateY ±3px, 4s loop | Friend avatar idle, character-card art |
| `hop` | scale .9→1.08→1 with −6px, 700ms ease-pop, once | Friend on correct/greeting, active tab icon, combo bump |
| `party` | rotate ±3° and −10px, 1.1s loop | Friend on win only |
| `flicker` | scale/rotate jitter, 1.6s loop | Streak flame, lit combo |
| `nudge` | translateX −5/+4px, 400ms | Wrong option |
| `sheet` | translateY 40px→0 + fade, 500ms ease-pop | Feedback sheet, picker sheet |
| `floatup` | +n pill rises 54px and fades, 1s | "+10" on correct |
| `confetti` | ~28 particles, 9×14px rounded 2px, A1/A2/A3/A4, 1.5–2.2s | Win screen, level-up |
| `sticker-stamp` | scale 2.2→1 and rotate −14°→−4°, 700ms ease-pop, delays 0.9s/1.15s | Win stickers |
| `live-pulse` | opacity 1→.45, 1.6s loop | LIVE badge/dot (red) |

**Reduced motion** (`prefers-reduced-motion: reduce`): durations → 1ms; `rise`, `bob`, `hop`, `party`, `flicker`, `nudge`, `sheet`, `floatup`, `confetti`, `sticker-stamp`, `live-pulse`, skeleton pulse and press-scale are disabled; `count-up` jumps to the final value; stickers appear in place; the friend shows a static mood badge; win highlight = a static lime ring. State is still conveyed by icon, text and colour. Page fade ≤ 100ms opacity only.

---

## 10. Iconography, 3D art, friend, illustration

### 10.1 Icons — Phosphor (`ph:`), via Iconify

- **Learner: Phosphor Duotone** (`i-ph-<name>-duotone`); **Staff: Phosphor Regular** (`i-ph-<name>`) — *staff weight is the designer's recommendation; the user chose Duotone for learners only (D38a)*. Lucide is **retired** for v2; `@lucide/vue` and the Lucide `AppIcon` resolver are removed from pages. Install `@iconify-json/ph` so icons are bundled.
- Weight is chosen centrally: pages and nav data store the **base name** (`house`); `DsIcon` (L2, wraps `UIcon`) builds `i-ph-house-duotone` or `i-ph-house` from the personality. Bold weight (`-bold`) is used for tiny status glyphs (check, x, arrow) at 16px.
- Sizes 16 / 20 (default) / 24 (tab bar) / 40–64 (illustration). Icon-only buttons need `aria-label` (BM) and a tooltip; hit area ≥ 44px on coarse pointers.
- Colour: learner glyphs are neutral (`text-toned`/`text-muted`) on neutral surfaces, or white/ink on **solid** accent chips; the active tab icon is white on the gradient pill; streak flame uses A3 (`--ds-ic-flame`). Staff glyphs use the theme colour `--ds-ic-theme` (kobalt) on the 12% chip in nav/stat/subject tiles; elsewhere `text-muted`.

Prototype icon keys → Phosphor names (recommended; DS-T0 verifies each glyph against the installed collection):

| Key | Phosphor base | Key | Phosphor base |
|---|---|---|---|
| flame | `fire` | spark (Alesa/AI) | `sparkle` |
| coin | `coins` | mat (Matematik) | `calculator` |
| bolt (Mata) | `lightning` | bm (B. Melayu) | `book-open-text` |
| home | `house` | bi (B. Inggeris) | `translate` |
| spm | `graduation-cap` | sej (Sejarah) | `scroll` |
| game | `game-controller` | sci (Sains) | `flask` |
| topik | `books` | check / x / arrow | `check-bold` / `x-bold` / `arrow-right-bold` |
| more (Lagi) | `dots-three-circle` | share | `share-network` |
| sun / moon (mode) | `sun` / `moon` | palette (review only) | `palette` |

The old FA→Lucide table (`fa-to-lucide.ts`, ~280 rows) is converted by a script to `fa-to-ph.ts` (FA name → Phosphor base name; same-name match first, manual overrides for the ~60 non-matching names, recorded in the Galeri DS). The meaning column of the old table stays authoritative. Guard test `srs-coverage` keeps running against the same FA keys.

### 10.2 3D rewards and hero art — Microsoft Fluent Emoji 3D (MIT)

- Learner rewards use Fluent Emoji 3D: streak `fire_3d`, koin `coin_3d`, mata `high_voltage_3d`, hero `graduation_cap_3d` / `rocket_3d`, win `trophy_3d`, learning `books_3d`, achievements as needed. Setting **"Ganjaran 3D" is on by default** (user-toggleable; off = Phosphor Duotone glyph on a solid chip).
- Assets are **bundled** (PNG/WebP in `assets/3d/`, ≤ 2 sizes, lazy for off-screen), never hot-linked. Ship the MIT licence text and attribution ("Microsoft Fluent Emoji, MIT") in the app's "Tentang" page and repository `assets/3d/LICENSE`. D22-consistent: recolour/crop only.
- Decorative: `alt=""` + `aria-hidden`; the adjacent number/label carries meaning. Drop shadow `0 4–10px` soft (token `shadow-art`).
- Staff views do not use 3D art.

### 10.3 Virtual friend "rakan belajar" (D37/D38) — Aiman and Aisyah

- Style **"4+"**: 3D face close-ups, no mortarboard. **Aiman** = Fluent "Boy", medium-light skin, dark hair (hair pixels from the medium tone, because light tones ship blond). **Aisyah** = Fluent "Woman with headscarf" (tudung), medium-light, cropped to a face close-up. Assets (MIT-derived, recolour/crop only): `docs/design/assets/v2/aiman_face.png`, `docs/design/assets/v2/aisyah_face.png` → shipped to `src/design-system/assets/friends/`.
- **First run:** after the first login of a Murid with no friend chosen, the picker sheet opens over Home: title "Pilih rakan belajar awak"; two cards (Aiman "Tenang & suka cabaran"; Aisyah "Ceria & sentiasa beri semangat"); [Pilih]. Dismissing without choosing keeps a default (Aiman) for the session and re-offers once next login. No account change is required to continue.
- **Change anytime:** tapping the friend avatar (Home greeting, header avatar button, win screen "Tukar rakan" link) opens the same sheet with the current friend preselected. Accessible name: "Tukar rakan belajar. Rakan sekarang: {nama}". Toast "Rakan belajar: {nama}". Choice persists to the profile.
- **Moods** (motion + emoji badge; assets stay one image per friend): `neutral` (idle `bob`, no badge) · `happy` 😊 (`hop`) · `encouraging` 💪 (`hop` once) · `celebrating` 🎉 (`party` loop on win only). Badge is a raised 22px circle bottom-right. Mood follows events: greeting = happy, correct = happy, wrong = encouraging, win = celebrating. Reduced motion: badge only.
- **Voice:** the friend speaks as a peer, **"awak"** (never "kamu"/"anda"), short, warm, no guilt. Examples from the prototype: "Lima soalan pun dah cukup untuk jaga streak. Jom?", "Cara awak betul. Teruskan rentak ini.", "Langkah awak kemas dan tersusun.", "Konsep ini memang dah masuk kepala.", "Bagus, awak tak tergesa-gesa.", "Sebiji macam jawapan peperiksaan.", win: "Tahniah, {nama}! Awak dapat {n}/5. Hebat!" / "Bagus sebab awak cuba, {nama}. Jom ulang kaji soalan yang salah, awak pasti boleh! 💪", sticker "Streak {n} hari!".
- **Cikgu Alesa stays the separate AI tutor (M13):** she is an AI persona with an "AI" pill (A4 chip, white text) and her own entry (floating button, chat); explanations from Alesa appear in an elevated bubble tagged "AI". The friend never presents itself as the tutor and gives no new feature behaviour beyond encouragement and presence.

### 10.4 Emoji and illustration

- Existing emoji in BM copy stay as literal characters (e.g. "Selamat Kembali! 👋"); one per heading max; never the only carrier of meaning; none in staff nav.
- Spot illustrations (SVG, `illustrations/`): `kosong`, `tiada-hasil`, `ralat`, `403`, `404`, `berjaya`, drawn with token colours (`currentColor`, primary, highlight, `bg-elevated`), flat, no outlines, no gradients, no people. Learner empty/error states may instead show the friend (mood `encouraging`) — the friend replaces the Alesa placeholder face on Home, quiz, win and learner empty states (D37b).

---

## 11. Personalities and density

`data-personality` + `data-density` are set at the shell root from the **role**.

| Property | Learner (Murid) | Staff (all other roles) |
|---|---|---|
| Colour mode default | Dark | System |
| Primary | A1 gradient fill | Kobalt flat |
| Accents | A1–A4 (jobs fixed, §3.3) | Kobalt + semantic only |
| Icons | Phosphor Duotone, neutral/solid-chip | Phosphor Regular, kobalt on 12% chip |
| Rewards | Fluent 3D + display numbers | Kobalt glyph + display numbers |
| Active nav / tab | Filled gradient pill | Staff nav: tone + weight; tab: raised chip |
| Buttons | 52–56px, radius 16, press squish | 36px (44 coarse), radius 12 |
| Inputs | 52px filled | 40px filled (44 coarse) |
| Table row min | n/a (cards) | 44px (48 coarse) |
| Cards | `shadow-lift`, radius 20–28 | `shadow-xs`, radius 16 |
| Motion | Full catalogue | press, count-up, live-pulse |
| Body text | 16px | 16px < md, 14px ≥ md |
| Page title | 28 → 36px | 24 → 28px |
| Friend / 3D / confetti | yes | no |
| Header height | 4rem | 3.5rem |


### Density scale (cozy), 2026-10-18 (supersedes the "Staff" sizes above)

The user found both portals too compact and small. The scale below is set centrally in
`src/theme/tokens.css` and `src/theme/ui.config.ts`; pages inherit it.

| Property | Value |
|---|---|
| Body | 16px, line-height 1.55 |
| Label (dense tables, nav, chips) | 15px (was 14px), weight 600 |
| Caption / overline | 13px (was 12px) |
| Heading / subheading / title | 22-26px / 19-22px / 30-40px (one step up) |
| Button `md` (default) | min-height 44px, padding 16px, text 16px; `lg` 48px; `sm` 40px; `xs` 36px |
| Inputs, selects | min-height 44px (learner 52px), padding 14px, text 16px |
| Card padding | 20px (24px from `sm`) |
| Section gaps (`DsPage`) | 20px, 24px from `md`, 32px from `lg` |
| Table cell | padding 16px x 14px, text 16px; header 15px caps 13px; rows about 56px |
| Badge `md` | 15px text, padding 12px x 4px; `sm` 13px |
| Sidebar item | 44px high, 15px text, 20px icons |
| Navbar | 64px |
| Icons in nav and buttons | 20px |

Checked at 1280, 1440, 1920 and 375 on Bank Soalan and the learner dashboard.

---

## 12. Mapping: current components → Nuxt UI → DS patterns

Layers: **L1** Nuxt UI as-is (themed centrally) · **L2** `Ds*` pattern composed only from L1 (§12.3) · **L3** pages (L1 + L2 only). A new L2 needs an entry here first.

### 12.1 `src/components/*`

| Current | Replacement | Notes |
|---|---|---|
| `icon/AppIcon.vue`, `fa-to-lucide.ts`, `icon/maps/*` | `DsIcon` → `UIcon` (`i-ph-*`); data `fa-to-ph.ts` | Lucide retired |
| `feedback/AlertBox.vue` | `UAlert` subtle | |
| `feedback/FlashOutlet.vue` | `UAlert` from `useFlash()` in the shell | Persists until navigation |
| `feedback/ToastMessage.vue` | `useToast()` + `UToast` | |
| `feedback/LoadingSpinner.vue` | `UButton loading`, `USkeleton`; spinner glyph `i-ph-circle-notch` | |
| `feedback/gallery/FeedbackGallery.vue` | Galeri DS dev route | Not shipped |
| `badge/AppBadge.vue` (+ LIVE, DEV, NEW, BARU, AI, PRO, SPM class strings) | `UBadge` | LIVE red solid + pulse; DEV `warning` solid; NEW/BARU `secondary` (lime, win job only: allowed because it marks new content); AI = A4 chip; PRO/SPM `subtle` |
| `badge/CountBadge.vue` | `UChip` (cap `99+`) | |
| `chart/ChartCanvas.vue`, `register.ts` | `DsChart` (Chart.js reading `--ds-cat-*`/`--ui-*` at mount and on mode change) | Evaluate `UChart` in DS-T0 |
| `data/DataTableCard.vue`, `data/LaravelPager.vue` | `DsDataTable` (`UCard`+`UTable`+`UPagination`, zebra, no lines) | BM pagination |
| `overlay/BaseModal.vue` | `DsDialog` (`UModal` ≥ sm / `UDrawer` < sm) | |
| `overlay/native-dialogs.ts` | `useConfirm()` (themed dialog, same BM text) | D33a |
| `form/classes.ts`, `feedback/classes.ts`, `overlay/classes.ts`, `data/classes.ts` | Deleted | Class-string constants are what G-3 forbids |
| (inline) stat card / progress ring / empty / 404-403 / tabs / avatar / tooltip / accordion / stepper / timeline / date pickers / upload | `DsStatTile`, `DsScoreRing`, `UEmpty`, `DsErrorPage`, `UTabs`, `UAvatar`, `UTooltip`, `UAccordion`, `UStepper`, `UTimeline`, `UInputDate`/`UCalendar`, `UFileUpload` | |

### 12.2 `src/shells/*`

| Current | Replacement |
|---|---|
| `admin/AdminShell`, `AdminSidebar`, `AdminNavList`, `AdminHeader` | `DsShellPentadbiran` (`UDashboardGroup` + `UDashboardSidebar` + `UNavigationMenu` + `UDashboardNavbar`) |
| `admin/AdminBottomNav`, `AdminLagiPopover` | Dropped (drawer shows the full menu) |
| `admin/AdminServerStatus` | `DsServerStatus` |
| `user/UserShell`, `UserSidebar`, `UserDrawer`, `UserNavList`, `UserHeader` | `DsShellPembelajaran` (variants `murid`, `guru`, `simple`) |
| `user/UserBottomNav` | `DsBottomNav` |
| `user/ImpersonationBanner` | `DsModeBanner` on `UBanner` (Mod Pelajar) |
| `shared/ShellLink`, `NavIcon` | `ULink`, `DsIcon` |
| `public/*` | `DsShellAuth` (`UHeader`/`UFooter`/`UPageSection`) |
| `dev/ShellPreview*`, css files (`user-shell.css`, `admin-shell.css`, `live-globals.css`, `dashboard.css`) | Deleted / Galeri DS |

### 12.3 L2 pattern inventory (complete)

**Shipped in V2-T05 (`src/ds/`; these names are the source of truth):** `DsIcon` · `DsIconChip` · `DsArt3D` · `DsStatTile` · `DsRewardChip` · `DsHeroCard` · `DsCharacterCard` · `DsCarousel` · `DsSubjectStrip` · `DsFriendAvatar` (+ internal `DsFriendFace`) · `DsSpeechBubble` · `DsFriendPicker` · `DsQuizHeader` · `DsQuizOption` · `DsFeedbackSheet` · `DsFloatScore` · `DsScoreRing` · `DsWinHero` · `DsSticker` · `DsWinScreen` · `DsLiveBadge` · `DsLiveTiles` · `DsDrillTable` · `DsEmptyState` · `DsThemeScope` (gallery / preview scope) · `usePersonality()`.

**Still to build (owner task in brackets):** `DsPage`, `DsDataTable`, `DsFilterBar` [V2-T32, first consumer: Urus Tiket]; `DsChart` [V2-T34, dashboards; evaluates `UChart` first]; `DsDialog`, `useConfirm`, `DsServerStatus`, `DsShellPentadbiran` [V2-T13]; `DsBottomNav`, `DsShellPembelajaran` [V2-T15]; `DsShellAuth` [V2-T16]; `DsErrorPage` [V2-T17]; `DsModeBanner`, `DsRoleChip` (+ switcher) [V2-T18]. Old names map as: `DsStat` = `DsStatTile`, `DsProgressRing` = `DsScoreRing`, `DsBubble` = `DsSpeechBubble`, `DsOption` = `DsQuizOption`, `DsFeedback` = `DsFeedbackSheet`. Question card/intake UI is out of scope (D28e).

#### 12.4 Visual details deferred from V2-T05 (listed in the gallery as "Jurang diketahui")

| Detail | Why | Owner |
|---|---|---|
| Second sticker rotation +3° (the first is -4° from the stamp animation) | no `rotate-*` utility and no per-element rotation token | V2-T48 (may add a token) |
| Picker selected card scale 1.02 | no `scale-*` utility | V2-T48 |
| Drop shadow under 3D art | no `drop-shadow-*` utility or `shadow-art` token | V2-T48 |
| Radial glow behind the win hero and hero-card art (flat translucent discs shipped) | no radial-gradient token | V2-T48 |
| Confetti burst | screen-level effect, not a composite | V2-T48 |
| Staggered `rise` delay on stat tiles | Tailwind `delay-*` is `transition-delay` only | V2-T48 |
| Subject strip scroll-snap | no `snap-*` utility | V2-T48 |
| Combo chip `hot` glow | no coloured-shadow token | V2-T48 |
| axe-core accessibility pass on `/__ds` | `axe-core` is not a dependency yet | V2-T21 (cut-over E2E) |

---

## 13. Guard rules ("components + tokens only")

Scope: `src/**/*.vue`, `src/**/*.ts` except `src/design-system/**`.

| # | Rule | Enforcement |
|---|---|---|
| G-1 | **Allowed utilities in pages**: layout only — `flex`, `inline-flex`, `grid`, `grid-cols-*`, `col-span-*`, `gap-*`, `items-*`, `justify-*`, `self-*`, `place-*`, `order-*`, `grow`, `shrink`, `basis-*`, `block`, `hidden`, `contents`, `w-*`, `h-*`, `min-*`, `max-*`, `size-*`, `p*-*`, `m*-*`, `space-*`, `relative`, `sticky` (+ `top-0`), `overflow-*`, `truncate`, `text-start/center/end`, `aspect-*`, prefixes `sm: md: lg: xl: 2xl: pointer-coarse:`. Plus **token utilities**: `text-{default,toned,muted,dimmed,highlighted,inverted}`, `text-{primary,success,info,warning,error}`, `bg-{default,muted,elevated,soft}`, the type scale (`text-display…text-overline`, `tabular`). | ESLint `ds/class-allowlist` |
| G-2 | Spacing steps only 1, 2, 3, 4, 6, 8, 12, 16 (+ 0, auto, full, fractions, screen/dvh). | same |
| G-3 | **Banned in pages**: arbitrary values `[...]`/`(--x)`; palette/colour utilities with palette name or step; `#hex/rgb()/hsl()/oklch()`; gradients (`bg-gradient-*`, `from-/via-/to-`; the gradient lives inside component variants); `shadow-*`, `rounded-*`, `z-*`, `animate-*`, `transition-*`, `duration-*`, `ease-*`, `font-*`, stock `text-xs…9xl`, `opacity-*`. | same |
| **G-3b** | **No lines: `border`, `border-*`, `divide`, `divide-*`, `outline`, `outline-*`, `ring`, `ring-*`, `ring-offset-*` utilities are forbidden in pages** (and in `design-system/**` except focus/error ring definitions in `theme.config.ts`). `border-default/-muted/-accented` tokens are transparent. | same + stylelint `declaration-property-value-disallowed-list` for `border*`/`outline*` outside `tokens.css`/`theme.config.ts` |
| G-4 | No `<style>`, `style=`/`:style=` in pages; dynamic values through props (`UProgress :model-value`, `DsScoreRing :value`). | ESLint |
| G-5 | No raw `<button> <input> <select> <textarea> <a> <table> <dialog> <img>` in pages (use `UButton`, `UInput`, …, `DsArt3D`, `DsFriendAvatar`, `UAvatar`). Layout elements allowed. | `vue/no-restricted-html-elements` |
| G-6 | Pages import UI only from `@nuxt/ui` and `@/design-system`. Banned in pages: `@lucide/vue`, `@iconify-json/*`, `@phosphor-icons/*`, `@fontsource/*`, `chart.js`, `@/components/*` (legacy, frozen), `@/shells/*` internals. Icons are referenced by base name via `DsIcon`. | `no-restricted-imports` |
| G-7 | Colour/radius/shadow/font/motion/icon-weight decisions only in `tokens.css`, `theme.config.ts`, `density.ts`. Hex/rgb outside `tokens.css` fail. | stylelint `color-no-hex` + path allowlist |
| G-8 | `eslint-plugin-tailwindcss` `no-custom-classname` + `no-arbitrary-value` run with the G-1 allowlist; prettier-plugin-tailwindcss stays. | ESLint |
| G-9 | **Token tests (Vitest)**: parse `tokens.css`; assert every pair in §3.4 meets its ratio in each personality × mode; every token has staff and learner and light and dark values; `--ui-border*` are transparent; no `reward` alias; alias palettes have 11 steps. | `design-system/__tests__/tokens.test.ts` |
| G-10 | **Visual/a11y e2e**: Playwright snapshots each shell/screen at 375/768/1280 × light/dark × both personalities; axe-core 0 serious/critical; `scrollWidth <= clientWidth` at 320/375/768/1280; reduced-motion run asserts no running animations. | `e2e/ds/*.spec.ts` |
| G-11 | Every Ds pattern has a Galeri DS entry for all states (default, hover, focus, active, disabled, loading, error, empty) in both modes/personalities. | G4 checklist |
| G-12 | 3D assets only from `design-system/assets/3d` (no remote `src`); no external image/font hosts in `index.html` (CSP-checkable). | build check |
| G-13 | No exceptions in pages; a need the allowlist cannot meet becomes a design-system change request. | process |

Migration: guards apply to migrated files through an override list that only grows; old `theme.css` (Tailwind v3 hex overrides) is removed after the last legacy module migrates. New palettes have unique names, so both coexist.

---

## 14. Accessibility baseline (WCAG 2.2 AA)

Contrast per §3.4 (CI-asserted). Focus: 2px primary ring offset by the surface, always visible (no `outline: none` without replacement). Skip link first in every shell. Targets ≥ 44px on `pointer-coarse` (learner controls ≥ 44px always). Body/inputs 16px on mobile, 12px minimum anywhere; reflow at 320px; 200% zoom. Colour never the sole signal (icon + word; filled pill + label; quiz correct/wrong carries a check/x glyph and text). Forms: visible labels, `aria-describedby`, error summary focus (R-1 mitigations). Motion §9. Quiz: options are `aria-pressed`/`aria-checked` buttons in a group, feedback sheet is `role="status"` (polite), full-screen quiz keeps an exit control. Friend/3D images decorative (`alt=""`); the picker is a `radiogroup`. Dialogs: trap, Esc, focus return. `<html lang="ms">`. Dark and light parity verified per component (G-10).

---

## 15. Build tasks implied

| ID | Task |
|---|---|
| DS-T0 | Spike on Vue + Vite: Dashboard family, `UDashboardSearch`, `UNavigationMenu`, `UCarousel`, `UDrawer`, `UToast`, `UBanner`, `UEmpty`, `UError`, `UTable`, colour mode, `i-ph-*` bundling (duotone + regular), option names (`theme.colors`, slots), `UChart` vs Chart.js, outline-variant override |
| DS-T1 | `tokens.css` (two personalities × two modes), `theme.config.ts`, `density.ts`, fonts, `@iconify-json/ph`, 3D + friend assets with licences |
| DS-T2 | Guard rules G-1…G-12 and the migrated-file list |
| DS-T3 | L2 patterns (§12.3) + Galeri DS + a11y e2e |
| DS-T4 | Shells per `v2-shells.md` |
| DS-T5 | `fa-to-ph.ts` conversion script and coverage test |
| DS-T6+ | Module-by-module re-skin |

---

## 16. Decisions applied and open points

Applied from the user/lead (no further approval needed): Elektrik palette and accent jobs (D36); Phosphor Duotone for learners, 3D rewards on, friend style 4+ (D38); Aiman/Aisyah, "awak", Alesa stays AI tutor (D37); Versi B layering for staff, B+ single theme colour on icons (D34/D35); LIVE red; filled inputs kept (R-1 accepted); subject dot slots with ungu allowed; scope label "Seluruh Negara"; dark default for Murid, system for staff; themed dialogs, BM pagination, 8 subject slots (D33a).

Open, non-blocking (each has a default applied above):

| # | Point | Default |
|---|---|---|
| O1 | Phosphor **Regular** for staff (recommendation, not user-confirmed) | Regular; one-line change in `DsIcon` if the user wants Duotone for staff too |
| O2 | Learner copy (picker traits, quiz, win, Home) follows the prototype verbatim; no new learner copy is proposed | Closed |
| O3 | Exact Fluent 3D files beyond the prototype set (fire, coin, high-voltage, graduation cap, rocket, trophy, books) | Same set, pick extras at DS-T1 under the same licence |
| O4 | Learner palette chooser (Neon, Tropika) in the prototype is review-only | Ship Elektrik only |
