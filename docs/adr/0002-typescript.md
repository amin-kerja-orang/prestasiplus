# ADR-0002: TypeScript (strict) instead of JavaScript

- **Status:** Proposed
- **Date:** 2026-09-25

## Context
The prototype has 26 modules and about 210 routes, and it is built by several agents in parallel. The mock layer must match a future REST contract exactly (D2, FR-G-12, UR-G-12), and G3 requires "lint, type-check, and tests pass". Every module SRS §7 defines request and response shapes that both the UI and the mock must honour. D12 adds repositories that other modules call.

## Decision
Use **TypeScript ~5.9.3** in `strict` mode, with `noUncheckedIndexedAccess`, everywhere: SFCs (`<script setup lang="ts">`), mock, scripts and E2E. Type-check with `vue-tsc -b`.
- Each module's `api/types.ts` holds the DTOs of its SRS §7. The UI functions in `api/*.ts` and the mock handlers both compile against them. This makes it the machine-checked contract that the backend phase inherits.
- Repositories (D12) expose typed methods. Consumers cannot reach private fields or invent their own shapes.
- Route meta, the nav definitions, dataset specs (D11) and test hooks are typed too.

## Alternatives considered
- **JavaScript + JSDoc:** weaker checking, no `vue-tsc` gate, and contract drift between UI and mock goes unnoticed until E2E.
- **TypeScript 7 native:** not yet supported by typescript-eslint or the Vue language tools (ADR-0001).

## Consequences
- Contract drift between UI and mock, and misuse of another module's repository, become compile errors.
- There is a small learning and setup cost. The type-check becomes part of `npm run verify`, which is the G3 gate.
- The backend phase can generate OpenAPI from, or check it against, `api/types.ts`.
