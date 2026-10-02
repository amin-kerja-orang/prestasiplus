# ADR-0003: Tailwind CSS v4 with CSS-first design tokens

- **Status:** Proposed
- **Date:** 2026-09-25

## Context
The live site is built with **Tailwind CSS v4** (oklch colours, rem breakpoints; `00-global-ui.md` §1). Discovery captured the live class lists for many elements. Fidelity (D7) favours reusing them verbatim. Tailwind v3 and v4 differ in defaults (colour space and palette values, ring width, default border colour, shadow and radius scale names), so v3 would render live class lists slightly differently. NFR-RESP-02 uses the Tailwind default breakpoints, which are identical to live.

## Decision
- Use **Tailwind CSS v4** (`tailwindcss` + `@tailwindcss/vite`), configured CSS-first in `src/styles/theme.css` with `@theme`.
- Tokens from `00-global-ui.md` §6:
  - fonts `--font-body` (Inter), `--font-heading` (Outfit), `--font-arabic` (Scheherazade New);
  - semantic colour aliases on top of the **unchanged default palette**;
  - named gradient, background and shadow utilities (`@utility`);
  - keyframes as `--animate-*`;
  - the custom variant `hover-none` for `(hover: none)`;
  - default breakpoints.
- Fonts are self-hosted through Fontsource, imported once in `src/styles/fonts.css`.
- Conventions:
  1. Copy live class lists where captured.
  2. **No dynamically built class names.** Data colours use inline styles; finite sets use maps of full class strings.
  3. Live page-specific CSS goes in `<style scoped>`.
  4. Shared components add no ARIA or motion handling beyond live (D10).
  5. No `overflow-x` clipping on `html`/`body` to hide overflow. Wide content scrolls inside its own container.

## Alternatives considered
- **Tailwind v3 with `tailwind.config.js`:** familiar, but its defaults differ from live, which would cause subtle visual drift and extra deviation risk.
- **Plain CSS or SCSS design system:** more work and a fidelity risk, and it contradicts the fixed stack.

## Consequences
- The same palette and class semantics as live. Screens can be rebuilt from captured markup with little guesswork.
- Browser floor is Safari 16.4+, Chrome 111+ and Firefox 128+. This is within SRS §4.3 ("latest two versions").
- Developers must follow the no-dynamic-classes rule. Lint cannot catch every case, so code review checks it.
