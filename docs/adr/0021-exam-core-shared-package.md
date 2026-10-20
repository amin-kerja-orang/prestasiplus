# ADR-0021: `@pp/exam-core` shared exam engine package

- **Status:** Accepted (BE-14, OD-5 approved by the LEAD 2026-10-20)
- **Date:** 2026-10-20
- **Related:** ADR-0018 (contract-first shared schemas, same workspace pattern), `docs/architecture/v2-backend-plan.md` sections 9 and 13 (OD-5), card `docs/plan/backend-tasks/BE-14-exam-core-package.md`.

## Context
Bijak SPM marking (answer keys, mark points, equivalence, ECF), the maths expression engine, blueprint composition and the paper model lived in `src/modules/m28-bijak-spm/domain/`. The server (BE-15, BE-16) must mark exactly like the UI, so one copy of this code has to serve both.

## Decision
- New workspace package `packages/exam-core` (`@pp/exam-core`), pure TypeScript with no runtime dependency. It ships source (`main: ./src/index.ts`), like `@pp/contract`.
- The five domain files moved with `git mv` (history kept); logic is unchanged.
- `src/index.ts` is the public API for new code: `gradePart`, `isBlank`, `numericValue`, `effectiveMarks`, `leavesOf`, `composeFromBlueprint`, `poolUnits` and the types they need. A test snapshots the keys.
- Subpath exports (`@pp/exam-core/{grading,math-expr,blueprint,paper-model,types}`) exist only so the frontend keeps its other imports (`latexToPlain`, `formatClock`, `shortageLine`, `ecfExpected`, ...). The old files under `src/modules/m28-bijak-spm/domain/` are one-line `export *` shims onto those subpaths, so no frontend importer changes.
- The frontend resolves the package through the npm workspace symlink; the API bundles it (`ssr.noExternal` in `apps/api/vite.build.config.ts`, same as `@pp/contract`) because Node cannot run extensionless TypeScript source.
- Boundary: an ESLint `no-restricted-imports` block (`app/boundaries-exam-core`) rejects imports of `src/**`, Vue, `node:` modules in `packages/exam-core/src`; a test bundles the entry with esbuild for the `node` and `browser` platforms and fails on any external import.

## Consequences
- Tests that need the mock bank (`BANK`, `BijakServer`) stay in `src/modules/m28-bijak-spm/__tests__` (they would otherwise import `src/**`); the two pure suites (equivalence, friendly) moved with the code.
- Deleting the shims later is a mechanical import rewrite in M28 once the frontend is cut over to the HTTP API.
- Any change to marking rules is now a change in one place and affects UI and server together.
