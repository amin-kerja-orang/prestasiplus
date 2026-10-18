# BE-15 Bijak SPM: papers, sections, blueprints, paper generation (read side)

| Field | Value |
|---|---|
| Size | M |
| Wave | 2 |
| Depends on | BE-09, BE-14 |
| Parallel with | BE-10, BE-12, BE-17 |
| Owner module | M28 Bijak SPM (papers and blueprints); questions stay owned by M04 |

## Goal

Persist exam papers, sections, placements, blueprints ("Kontrak") and the PoC papers, and serve the paper list, paper cover, blueprint contracts and "Jana Kertas" generation (pool selection with shortage reporting). The Bijak mock has **no HTTP routes yet**; this card defines them from the public methods of `BijakServer`.

## Inputs (read these)

- `docs/requirements/v2-exam-schema.md` D5 (sections model), D6 (stimulus groups), D7 (blueprints and their provenance tags), section 6 (entities), section 10 (gap list m28 vs schema), section 7 (.cloud field mapping)
- `docs/requirements/v2-bijak-spm.md` (student stories on cover, Kertas Pilihan, Jana Kertas, shortages) and `docs/discovery/BIJAK-SPM-cloud.md`
- `src/modules/m28-bijak-spm/server/store.ts` (`listPapers`, `getCover`, `listContracts`, `generatePaper`, `subjects`), `domain/{types,blueprint,paper-model}.ts`, seeds `data/{mat-k1,mat-k2,sains-k2,sejarah-k2,registry,builders}.ts`
- `packages/exam-core` (BE-14), BE-09 question tables

## Outputs

- Contract: `packages/contract/src/bijak/papers.ts` (`PaperSummary`, `PaperCover`, `BlueprintContract`, `GenerateRequest`, `GenerateOutcome` with `shortages`)
- `apps/api/prisma/schema/exam.prisma` + migration: `papers`, `paper_sections`, `paper_placements` (question + section + number label + marks override + pinned version), `blueprints`, `blueprint_sections`
- `apps/api/src/modules/exam/papers/**`
- Seed: `apps/api/prisma/seed/exam.ts` loading the PoC papers (D45: 2 short papers showing stimulus groups, maths input, equivalence marking) and blueprints from the m28 `data/*` files into the BE-09 question tables; invented content only, as in the m28 data files
- Tests under `apps/api/test/exam-papers/**`

## Endpoints (new; relative to `/api`, student role unless stated)

| Method and path | Request | Response |
|---|---|---|
| `GET /bijak/papers` | filters `subject?`, `kertas?` | `{ data: PaperSummary[] }` incl. per-user in-progress/last-score info |
| `GET /bijak/papers/:id` | none | `{ data: PaperCover }` (instructions, reference sheet, sections, marks, duration); 404 for unpublished or other users' generated papers |
| `GET /bijak/contracts` | none | `{ data: BlueprintContract[] }` (subject, kertas, source tag, code, durationMin, sections with `take`) |
| `POST /bijak/papers/generate` | `{ subject, kertas }` | `201 { data: { paperId } }` or `422` with `{ error.code: 'NO_BLUEPRINT' }` / `{ code: 'SHORTAGE', details: { shortages[] } }` |
| `GET /admin/bijak/papers` (admin, proposed; check `docs/requirements/v2-bijak-spm.md` Admin ACs and drop it if no built screen needs it) | none | paper management list (read-only in B1) |

## DB tables touched

`papers`, `paper_sections`, `paper_placements`, `blueprints`, `blueprint_sections`, `questions` and children (read), `curriculum_nodes` (read).

## Acceptance criteria

1. The seeded papers reproduce, section by section and question by question, the structure the m28 mock serves (compare marks totals, section rules and counts with `domain/paper-model` helpers from `@pp/exam-core`).
2. A paper's `total_marks` is derived from placements, never stored by hand (Q-S6); the printed duration is stored per paper (Q-S1).
3. Draft blueprints (`source = 'Draf'`) cannot generate a paper (`NO_BLUEPRINT`), as the mock does.
4. `generate` uses `composeFromBlueprint`/`poolUnits` from `@pp/exam-core`, keeps stimulus-group questions together, never repeats a question in one paper, and returns a shortage list instead of a short paper; generation is deterministic for a fixed seed in tests.
5. Generated papers are private to the requesting user; the cover of another user's generated paper returns 404.
6. No answer key, scheme or explanation is present in any response of this card (cover and list only).
7. Reference sheet panels and section instructions are returned verbatim for the seeded papers.

## Test commands

```
npm run be:db:seed
npm run be:test -- apps/api/test/exam-papers
npm run be:verify
```

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-15 (bijak-papers). Work in this repo clone on branch be/BE-15-bijak-papers, created from the latest origin/feature/v2-backend.
Read first, in order: AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10); docs/plan/backend-tasks/BE-15-bijak-papers.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs.
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-15. There is no HTTP surface for Bijak SPM yet: derive the contract from the public methods listPapers, getCover, listContracts and generatePaper of src/modules/m28-bijak-spm/server/store.ts and the types in domain/types.ts, align the data model with docs/requirements/v2-exam-schema.md (approved D47), and use @pp/exam-core for blueprint composition. Seed the PoC papers from the m28 data files (invented content only). Never return answer keys or schemes from these endpoints.
```
