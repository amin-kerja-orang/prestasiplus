# BE-14 Shared exam engine package `@pp/exam-core` (marking, math expressions, blueprint)

| Field | Value |
|---|---|
| Size | M |
| Lane | PC-3 (folders: sessions.md section 5) |
| Priority | P1 |
| Wave | 0/1 (start right after BE-01; independent of the database) |
| Depends on | BE-01; user decision OD-5 |
| Parallel with | BE-02, BE-03, BE-04, BE-05, BE-08, BE-11 |
| Owner module | M28 Bijak SPM (domain logic) |

## Goal

Extract the pure TypeScript domain logic of Bijak SPM into a workspace package so the **server marks exactly like the UI**: grading of parts against answer keys and mark points, equivalence matching, the maths expression engine, paper model helpers and blueprint composition. The frontend re-imports from the package; no behaviour change.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5 (the BE-14 exception for `src/`)
- `docs/architecture/v2-backend-plan.md` section 13 (OD-5), section 9 (folder ownership)
- `docs/requirements/v2-exam-schema.md` D3, D4, D5, D7; `docs/requirements/v2-bijak-spm.md` (grading ACs, equivalence marking, false-positive rules)
- `src/modules/m28-bijak-spm/domain/{grading,math-expr,blueprint,paper-model,types}.ts` and their tests `src/modules/m28-bijak-spm/__tests__/{grading,equivalence,falsepositives,friendly,blueprint,schema}.test.ts`
- `src/modules/m28-bijak-spm/server/store.ts` (how the domain functions are called) and every other importer of `m28-bijak-spm/domain/*` (find them with a search before the move)
- Prerequisite: OD-5 answered by the lead and the lead told when the PR is opened (it touches frontend-owned folders).

## Outputs

- `packages/exam-core/` (`package.json` name `@pp/exam-core`, `src/index.ts`, `tsconfig.json`, no runtime dependencies beyond zod if already used): the five domain files moved **with git history** (`git mv`) plus their tests
- In `src/modules/m28-bijak-spm/**`: the minimal import changes (`../domain/...` becomes `@pp/exam-core`) and re-export shims so existing frontend imports keep working. **This is the only card allowed to touch `src/`** (pre-approved in sessions.md section 5), and only these files.
- Root `package.json`: `@pp/exam-core` in the dependencies of the frontend, and in `apps/api/package.json` for `@pp/api`
- `docs/adr/0021-exam-core-shared-package.md` (0019 and 0020 are taken; the lead renumbers on merge if two ADRs collide)
- `apps/api/test/exam-core/import.spec.ts` (proof that the server can import the package)

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `packages/exam-core/**`, `src/modules/m28-bijak-spm/**`, `apps/api/test/exam-core/**`, `docs/adr/0021-exam-core-shared-package.md`.
- Prisma file(s): none (no schema change).
- Contract: none.
- Seeds: none.
- Tests: `packages/exam-core/**/*.test.ts`, `apps/api/test/exam-core/**`.
- Other files: inside `src/modules/m28-bijak-spm/**` only import paths and re-export shims change; root `package.json`, `package-lock.json`, `apps/api/package.json` (dependency lines).
- Append-only shared files (one line each, never reorder): `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: No Prisma file. It touches `src/modules/m28-bijak-spm/**`, which no other backend card edits; BE-15/16/39 depend on this package.

## Endpoints

None.

## DB tables touched

None.

## Acceptance criteria

1. All existing M28 tests that cover the moved code pass unchanged from the new package location: `npm test` at the root (frontend project) and `npm -w @pp/exam-core run test` both pass, and the list of moved test files equals the list in Inputs.
2. `npm run typecheck` and `npm run build` at the root still pass (the frontend consumes the package through the workspace).
3. The package has zero imports from `src/**`, Vue, the DOM or Node-only APIs: an ESLint `no-restricted-imports` boundary rule fails on any such import (demonstrated by a deliberate violation in the PR), and a test bundles the package for both `node` and `browser` platforms.
4. The package exports exactly the public API `gradePart`, `isBlank`, `numericValue`, `effectiveMarks`, `leavesOf`, `composeFromBlueprint`, `poolUnits` and the types they need (a test snapshots `Object.keys(require('@pp/exam-core'))`); anything else stays private.
5. `apps/api/test/exam-core/import.spec.ts` imports the package in Vitest and calls `gradePart` on one fixture part.
6. No behaviour change: `git diff -M` shows the moved files as renames with import-path changes only; no edit to logic (reviewer check, listed in the PR).

## Test commands

```
npm test                       # frontend unit tests (includes moved M28 tests)
npm -w @pp/exam-core run test
npm run typecheck && npm run build
npm run be:verify
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green. Paste the real tail of the output in the PR.
3. This card has no HTTP endpoints, so it adds no conformance scenarios; after BE-31 merges, `npm run be:test -- apps/api/test/conformance` must still pass.
4. This card creates no tables; the migration-first checklist (plan section 14.9) does not apply, but no change may break `npm run be:lint:migration` (once BE-34 is merged).
5. No security review is required; list any security-relevant decision in the PR anyway.
6. The card's tracker row is updated (status, PR number, one-line note) and the PR description follows the template in `docs/plan/backend-tasks/README.md`. Nothing stays only on your PC (AGENT-SYNC.md section 4).

## Open questions

None known. If you meet a rule that neither the mock, the SRS nor this card states, do not invent it: write it under "Open questions" in the PR, and open a GitHub issue labelled `question` if it blocks you.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-14 (exam-core-package). Work in this repo clone on branch be/BE-14-exam-core-package, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-14-exam-core-package.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-14. This card is explicitly allowed to touch src/modules/m28-bijak-spm (imports only). Move domain/{grading,math-expr,blueprint,paper-model,types}.ts and their tests into packages/exam-core with git mv, expose a clean index.ts, update imports and add compatibility re-exports so the frontend compiles. Change no logic. Verify the root typecheck, unit tests and build are green, and that apps/api can import the package.
```
