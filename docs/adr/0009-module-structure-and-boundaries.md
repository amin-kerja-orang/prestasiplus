# ADR-0009: Feature-module folders with public entry points and a single registry

- **Status:** Proposed
- **Date:** 2026-09-25

## Context
26 modules are built one at a time by parallel agents (CLAUDE.md §3, §5), and each module has its own URS/SRS slug. Modules share components (M04 `ReportQuestionModal` in M05/M06; the M05 quiz component in M06) and shared stores (D12). Merge hotspots and hidden coupling must stay small, and the backend phase should be able to replace the mock module by module (NFR-07).

## Decision
- One folder per module, `src/modules/mXX-<slug>/`, containing: `index.ts` (manifest and public exports), `routes.ts`, `pages/`, `components/`, `composables/`, `constants/`, `api/` (typed contract), `mock/` (plugin, tables, datasets, repositories, seeds, handlers, data) and `__tests__/`.
- Global frame code lives in `src/app`, `src/shells`, `src/components`, `src/composables`, `src/lib`, `src/stores`, `src/api` and `src/mock` (core only).
- **Single registries:** `src/app/modules.ts` (module manifests, in phase order) and `src/mock/registry.ts` (mock plugins, lazy imports). Adding a module adds one line to each.
- **Boundaries** (enforced with ESLint `no-restricted-imports`):
  - UI code may import another module only via `@/modules/<slug>` (its `index.ts`);
  - mock code may import another module only via `@/modules/<slug>/mock` (its repository exports, D12);
  - nobody imports another module's `pages`, `components`, `mock/tables`, `mock/datasets` or `mock/seeds`;
  - UI code never imports any `mock/`.
- Promote code to `src/components` or `src/lib` only when a second module needs it.

## Alternatives considered
- **Layer-first folders** (`src/pages`, `src/api`, `src/mock` for everything): every module build touches many shared folders, so conflicts and coupling grow.
- **Monorepo packages per module:** stronger isolation, but heavy tooling for a single SPA prototype.

## Consequences
- A module build is mostly additive inside one folder.
- Cross-module reuse is explicit and reviewable.
- The backend phase can delete `mock/` folders module by module.

## Amendment 1 (2026-09-26, overview v1.2 §3, §13)
- **Dynamic imports:** the boundary lint now also covers dynamic `import('…')`. It uses `no-restricted-syntax` with `ImportExpression` selectors built from the same patterns as `no-restricted-imports`. `src/app/bootstrap.ts` is the only UI-side exemption. Import specifiers must stay string literals so that the selectors can match them. F-10 owns this section of `eslint.config.ts` and keeps static and dynamic coverage together.
- **Registries:** F-01 wrote both registries with all 10 slice modules (M01–M10, including M02). F-06 defines the plugin type in `src/mock/define.ts`. The registry's structural `{ id }` loader type needs no edit, and no later task edits the registries.

## Amendment 2 (2026-09-27, overview v1.6 §6.10, build-plan v1.8 F-31)

Delivery Lead decision (XL batch 3, R2-11).

1. **One registry extension per module batch.** The registries were written once for the 10 student-slice modules. A later batch needs new entries. For each batch, exactly **one** task appends the batch's modules to `src/mock/registry.ts` and `src/app/modules.ts`, in phase order and in one change, and creates their stub folders. No other task edits the registries.
2. **First extension:** F-31 adds M11–M18 (`m11-teacher-analytics` … `m18-ppd-jpn`). It runs in the student slice, because the M14 store (F-26b) must be registered for the dashboard.
3. **Consequence:** the merge hotspot stays limited to one planned edit per batch, and phase order is kept for the `dependsOn` check.
