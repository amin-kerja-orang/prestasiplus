# ADR-0001: Front-end stack and versions

- **Status:** Proposed (awaiting user approval at G2)
- **Date:** 2026-09-25
- **Deciders:** solution-architect; user approval required

## Context
The user fixed the stack as Vue 3 + Vite + Tailwind CSS + Lucide (TRACKER, SRS §4.4). The architecture still has to choose exact packages and majors, the router and state libraries, a chart library (live uses Chart.js 4.4.0, M08 SQ-M08-04), fonts, and the runtime. The npm registry was checked on 2026-09-25:
- `lucide-vue-next` is **deprecated** with the message "Package deprecated. Please use @lucide/vue instead." (latest 1.0.0). `@lucide/vue` is at 1.48.0.
- TypeScript's latest is 7.0 (native compiler), but `typescript-eslint` supports `>=4.8.4 <6.1.0`.
- Vue Router 5.3 declares the optional peer `pinia ^3.0.4`. Pinia 4.0 was released 2026-07-14.
- Vite 8.3 needs Node `^20.19 || >=22.12`.

## Decision
| Concern | Package | Range |
|---|---|---|
| Runtime | Node.js 22 LTS, npm 10 | `.nvmrc` 22.22.2 |
| Framework | `vue` (Composition API, `<script setup lang="ts">`) | ^3.5.43 |
| Build | `vite`, `@vitejs/plugin-vue` | ^8.3, ^6.0 |
| Language | `typescript`, `vue-tsc` | ~5.9.3, ^3.3 (ADR-0002) |
| Styling | `tailwindcss`, `@tailwindcss/vite` | ^4.3 (ADR-0003) |
| Icons | **`@lucide/vue`** (successor of the deprecated `lucide-vue-next`) | ^1.48 (ADR-0010) |
| Routing | `vue-router`, classic `createRouter` API | ^5.3 (ADR-0008) |
| State | `pinia` | ^3.0.4 (ADR-0007) |
| Charts | `chart.js` (no wrapper package) | ^4.5 (ADR-0012) |
| Fonts | `@fontsource-variable/inter`, `@fontsource-variable/outfit`, `@fontsource/scheherazade-new` | ^5.3 |
| Mock persistence | `idb-keyval` | ^6.3 (ADR-0005) |
| Tests | `vitest`, `@vue/test-utils`, `jsdom`, `@vitest/coverage-v8`, `@playwright/test` | ^5.0, ^2.5, ^30, ^5.0, ^1.63 (ADR-0011) |
| Lint/format | `eslint` ^10, `eslint-plugin-vue` ^10.11, `typescript-eslint` ^8.70, `@vue/eslint-config-typescript` ^14.9, `eslint-config-prettier` ^10, `prettier` ^3.9, `prettier-plugin-tailwindcss` | |

The lockfile pins exact versions. Upgrades across majors need a new ADR.

**Deliberately not used:**
- a UI component library (every widget must replicate live markup);
- an i18n framework (static BM copy, SRS NFR-08);
- a data-fetching cache library (ADR-0007);
- MSW (ADR-0004);
- CSS-in-JS;
- `vue-chartjs` (ADR-0012).

## Alternatives considered
- **`lucide-vue-next`** (the name in the brief): rejected because it is deprecated and frozen at 1.0.0. `@lucide/vue` is the same Lucide icon set under its maintained name, so it stays within the user's "Lucide" decision.
- **TypeScript 7**: rejected for now. The lint toolchain does not support it yet, and `vue-tsc` relies on the JS compiler API.
- **Pinia 4**: rejected. It is outside Vue Router 5's declared peer range and only 2 months old. Pinia 3 is enough for the few global stores we need.
- **Vue Router 4.6**: rejected. It is in maintenance, and 5.x is the current major with the same classic API.
- **Google Fonts CDN** (as live): rejected. SRS §4.1 forbids external runtime calls. Fontsource serves the same font files locally.

## Consequences
- Every dependency is current, maintained and mutually compatible, and the peer ranges are satisfied.
- The icon package name differs from the brief. The user should confirm this (it is the same library).
- Moving to TS 7 or Pinia 4 later is a contained upgrade task.

## Amendment 1 (2026-09-26, overview v1.2)
- **Node minimum** is now `^22.22.2 || ^24.15.0 || >=26.0.0`, replacing ≥ 22.12. The strictest toolchain floor wins: jsdom 30 declares this range, because its undici 8 needs ≥ 22.19. `package.json` `engines` mirrors it, and `.nvmrc` pins 22.22.2.
- CI must pin an exact Node version inside this range (F-28).
