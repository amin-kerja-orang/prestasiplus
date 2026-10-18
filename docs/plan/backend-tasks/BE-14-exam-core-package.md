# BE-14 Shared exam engine package `@pp/exam-core` (marking, math expressions, blueprint)

| Field | Value |
|---|---|
| Size | M |
| Wave | 0/1 (start right after BE-01; independent of the database) |
| Depends on | BE-01; user decision OD-5 |
| Parallel with | BE-02, BE-03, BE-04, BE-05, BE-08, BE-11 |
| Owner module | M28 Bijak SPM (domain logic) |

## Goal

Extract the pure TypeScript domain logic of Bijak SPM into a workspace package so the **server marks exactly like the UI**: grading of parts against answer keys and mark points, equivalence matching, the maths expression engine, paper model helpers and blueprint composition. The frontend re-imports from the package; no behaviour change.

## Inputs (read these)

- `docs/architecture/v2-backend-plan.md` section 13 (OD-5), section 9 (folder ownership)
- `docs/requirements/v2-exam-schema.md` D3, D4, D5, D7; `docs/requirements/v2-bijak-spm.md` (grading ACs, equivalence marking, false-positive rules)
- `src/modules/m28-bijak-spm/domain/{grading,math-expr,blueprint,paper-model,types}.ts` and their tests `src/modules/m28-bijak-spm/__tests__/{grading,equivalence,falsepositives,friendly,blueprint,schema}.test.ts`
- `src/modules/m28-bijak-spm/server/store.ts` (how the domain functions are called)

## Outputs

- `packages/exam-core/` (`package.json` name `@pp/exam-core`, `src/index.ts`, `tsconfig.json`, no runtime dependencies beyond zod if already used): the five domain files moved **with git history** (`git mv`) plus their tests
- In `src/modules/m28-bijak-spm/**`: the minimal import changes (`../domain/...` becomes `@pp/exam-core`) and re-export shims so existing frontend imports keep working. **This is the only card allowed to touch `src/`**, and only these files; the lead must have approved OD-5 and be told when the PR is opened because it touches frontend-owned folders.
- Root `package.json`: `@pp/exam-core` in `dependencies` of the frontend and `@pp/api`
- `docs/adr/0020-exam-core-shared-package.md`

## Endpoints

None.

## DB tables touched

None.

## Acceptance criteria

1. All existing M28 tests that cover the moved code pass unchanged from the new package location (`npm test` at the root and the package's own test run).
2. `npm run typecheck` and `npm run build` at the root still pass (frontend consumes the package through the workspace).
3. The package has zero imports from `src/**`, Vue, DOM or Node-only APIs (verified by an ESLint boundary rule or a test that bundles it for both node and browser).
4. The package exports a stable public API (`gradePart`, `isBlank`, `numericValue`, `effectiveMarks`, `leavesOf`, `composeFromBlueprint`, `poolUnits`, types); anything else stays private.
5. The server can import it in Vitest (proof test in `apps/api/test/exam-core-import.spec.ts`).
6. No behaviour changes: no edits to logic, only moves and import paths.

## Test commands

```
npm test                       # frontend unit tests (includes moved M28 tests)
npm -w @pp/exam-core run test
npm run typecheck && npm run build
npm run be:verify
```

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-14 (exam-core-package). Work in this repo clone on branch be/BE-14-exam-core-package, created from the latest origin/feature/v2-backend.
Read first, in order: AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10); docs/plan/backend-tasks/BE-14-exam-core-package.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs.
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-14. This card is explicitly allowed to touch src/modules/m28-bijak-spm (imports only). Move domain/{grading,math-expr,blueprint,paper-model,types}.ts and their tests into packages/exam-core with git mv, expose a clean index.ts, update imports and add compatibility re-exports so the frontend compiles. Change no logic. Verify the root typecheck, unit tests and build are green, and that apps/api can import the package.
```
