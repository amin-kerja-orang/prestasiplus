# BE-15 Bijak SPM: papers, sections, blueprints, paper generation (read side)

| Field | Value |
|---|---|
| Size | M |
| Lane | PC-3 (folders: sessions.md section 5) |
| Priority | P1 |
| Wave | 2 |
| Depends on | BE-09, BE-14 |
| Parallel with | BE-10, BE-12, BE-17 |
| Owner module | M28 Bijak SPM (papers and blueprints); questions stay owned by M04 |

## Goal

Persist exam papers, sections, placements, blueprints ("Kontrak") and the PoC papers, and serve the paper list, paper cover, blueprint contracts and "Jana Kertas" generation (pool selection with shortage reporting). The Bijak mock has **no HTTP routes yet**; this card defines them from the public methods of `BijakServer`.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/requirements/v2-exam-schema.md` D5 (sections model), D6 (stimulus groups), D7 (blueprints and their provenance tags), section 6 (entities), section 10 (gap list m28 vs schema), section 7 (.cloud field mapping)
- `docs/requirements/v2-bijak-spm.md` (student stories on cover, Kertas Pilihan, Jana Kertas, shortages) and `docs/discovery/BIJAK-SPM-cloud.md`
- `src/modules/m28-bijak-spm/server/store.ts` (`listPapers`, `getCover`, `listContracts`, `subjects`, `generatePaper` and the private `resolvePaper`), `domain/{types,blueprint,paper-model}.ts`, seeds `data/{mat-k1,mat-k2,sains-k2,sejarah-k2,registry,builders}.ts`; mock tests `__tests__/{server,blueprint,schema}.test.ts`
- `packages/exam-core/` (created by BE-14), BE-09 question tables and `QuestionsService`

## Outputs

- Contract: `packages/contract/src/bijak/papers.ts` (`PaperSummary`, `PaperCover`, `BlueprintContract`, `GenerateRequest`, `GenerateOutcome` with `shortages`)
- `apps/api/prisma/schema/exam.prisma` + migration: `papers`, `paper_sections`, `paper_placements` (question + section + number label + marks override + pinned version), `blueprints`, `blueprint_sections`. Because BE-39 (paper builder) must add **no** schema change, create now: `papers.status` (`draft`, `ready`, `published`, `withdrawn`; seeded papers are `published`), `papers.version`, `papers.printed_duration_min`, and for `blueprints` a `version`, a `status` (`draft`, `active`, `retired`), the provenance `source` tag (`Draf` and the other tags of the m28 data) and a unique `(code, version)`.
- `apps/api/src/modules/exam/papers/**`
- Seed `apps/api/prisma/seed/exam.ts` loading the PoC papers (D45: 2 short papers showing stimulus groups, maths input, equivalence marking) and blueprints from the m28 `data/*` files into the BE-09 question tables through `QuestionsService`; invented content only, as in the m28 data files
- Tests under `apps/api/test/exam-papers/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/modules/exam/papers/**`.
- Prisma file(s): `apps/api/prisma/schema/exam.prisma` and one migration folder under `apps/api/prisma/migrations/`.
- Contract: `packages/contract/src/bijak/papers.ts` (new files only), registered in `src/openapi.ts`; `openapi.json` is regenerated with `npm run contract:emit`, never hand-edited.
- Seeds: `apps/api/prisma/seed/exam.ts`, plus one line in `apps/api/prisma/seed/index.ts`.
- Tests: `apps/api/test/exam-papers/**`, and (after BE-31) new scenario files in `apps/api/test/conformance/bijak/`.
- Append-only shared files (one line each, never reorder): `apps/api/src/modules/index.ts` (one import and one array entry); `apps/api/prisma/migratable-models.json` (model names, alphabetical); your own rows of the mapping matrix, plan section 14.7; `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: exam.prisma is shared with BE-16 and BE-39. BE-16 depends on BE-15; BE-39 adds no schema change (the columns it needs are created here), so BE-16 and BE-39 can run in parallel.

## Endpoints (new HTTP surface derived from the public methods of `BijakServer`; all under `/api`, student role)

The Bijak mock has no HTTP routes; the paths below are new and are fixed in this card's contract PR. Each maps to one mock method.

| Method and path | Mock method | Request | Response |
|---|---|---|---|
| `GET /api/bijak/papers` | `listPapers(userId)` | none (the mock has no server filters; the UI filters) | `{ data: PaperSummary[] }` with per-user in-progress and last-score info; only `published` papers |
| `GET /api/bijak/papers/:id` | `getCover(userId, paperId)` | none | `{ data: PaperCover }` (instructions, reference sheet, sections, marks, duration); 404 `NOT_FOUND` "Kertas tidak ditemui" for an unknown, unpublished or another user's generated paper |
| `GET /api/bijak/contracts` | `listContracts()` | none | `{ data: BlueprintContract[] }` (subject, subjectName, kertas, source, code, durationMin, sections with `take`) |
| `GET /api/bijak/subjects` | `subjects()` | none | `{ data: Subject[] }` for the hub |
| `POST /api/bijak/papers/generate` | `generatePaper(userId, subject, kertas)` | `{ subject, kertas }` | `201 { data: { paperId } }`; 422 with `error.code` `NO_BLUEPRINT` (no blueprint or source `Draf`) or `SHORTAGE` (`error.details.shortages[]`) |

Admin paper management (`/api/admin/papers`, `/api/admin/blueprints`) is BE-39, not this card.

## DB tables touched

`papers`, `paper_sections`, `paper_placements`, `blueprints`, `blueprint_sections`, `questions` and children (read), `curriculum_nodes` (read).

## Acceptance criteria

1. The seeded papers reproduce, section by section and question by question, the structure the m28 mock serves: a golden test compares marks totals, section rules (`all` or `choose n`), question counts and instructions with `domain/paper-model` helpers from `@pp/exam-core` for every seeded paper.
2. A paper's total marks are derived from the placements (never stored by hand, Q-S6); the printed duration is stored per paper (Q-S1).
3. A blueprint whose `source` is `Draf`, or a missing `(subject, kertas)`, gives 422 `NO_BLUEPRINT` and no paper row (mock `no_blueprint`).
4. `generate` uses `composeFromBlueprint` and `poolUnits` from `@pp/exam-core`; it keeps stimulus-group questions together, never repeats a question inside one paper, prefers questions the user has not been served before (the mock's `seen` set) when the pool allows, and returns `SHORTAGE` with the shortage list instead of a short paper. With a fixed seed (injected `Clock` and PRNG) two runs give the same paper.
5. A generated paper is private to the requesting user: another user's `GET /api/bijak/papers/:id` returns 404 "Kertas tidak ditemui". A new `generate` call creates a new paper id each time.
6. No answer key, mark scheme, accepted equivalent or explanation appears in any response of this card (recursive key scan over list, cover and generate responses).
7. Reference-sheet panels and section instructions are returned verbatim for the seeded papers; the default instruction text when a section has none is "Jawab semua soalan." or "Jawab {n} daripada {count} soalan." (mock `getCover`).
8. Roles: Murid (and the other signed-in roles that may use Bijak per the access matrix) only; no session 401; missing CSRF 403 `CSRF_INVALID` on the POST.

## Test commands

```
npm run be:db:seed
npm run be:test -- apps/api/test/exam-papers
npm run be:verify
npm run contract:check
npm run be:test -- apps/api/test/conformance   # only after BE-31 is merged
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green; if anything under `packages/**` changed, root `npm run typecheck && npm test` is green too. Paste the real tail of the output in the PR.
3. Conformance (BE-31): once BE-31 is merged, add this card's scenarios as new files in `apps/api/test/conformance/bijak/` and run `npm run be:test -- apps/api/test/conformance`; a failure is a blocker. Before BE-31 merges, `be:verify` is the gate; write "conformance scenarios pending BE-31" in the PR.
4. Migration-first checklist of plan section 14.9 (items 1 to 6) is complete for every table this card creates. Item 6 (insert a `legacy_source = 'cloud'` row twice through the BE-34 upsert helper and assert one row) applies once BE-34 is merged; state in the PR whether it was available.
5. No security review is required; list any security-relevant decision in the PR anyway.
6. The card's tracker row is updated (status, PR number, one-line note) and the PR description follows the template in `docs/plan/backend-tasks/README.md`. Nothing stays only on your PC (AGENT-SYNC.md section 4).

## Migration-first (plan sections 14 and 14.9)

- Follow the checklist of plan section 14.9 (items 1 to 6) for every table listed under "DB tables touched".
- Each table that could receive .cloud rows has `legacy_source text null`, `legacy_id text null` and `unique (legacy_source, legacy_id)`, and is listed in `apps/api/prisma/migratable-models.json`. These columns never appear in the contract or in an API response.
- Enums are `text` + `check` with English codes (no Postgres enum types); anything the source may lack is nullable or has a documented default; seeds never set `legacy_*` and are idempotent.
- Add or update this entity's row in the mapping matrix (plan section 14.7) in the same PR.

## Open questions

Do not guess these; write your working assumption in the PR and ask the lead (issue labelled `question`) if it blocks you.

1. Which roles may use the Bijak student endpoints (Murid only, or also Guru/Admin for preview)? Working assumption: Murid, plus admin and school_admin in Mod Pelajar (the session is a student then).

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-15 (bijak-papers). Work in this repo clone on branch be/BE-15-bijak-papers, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14; section 15 for intake and builder cards); docs/plan/sessions.md section 5 (folder ownership); docs/plan/backend-tasks/BE-15-bijak-papers.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/<domain>/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend mock handlers, the typed client and the SRS listed in the card are the behavioural spec: do not invent business rules; write every unknown under "Open questions" in the PR description. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders (BE-14 and BE-32 have the explicit exceptions stated in their cards). Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
When finished run npm run be:verify (and the card test commands) and report: files changed, endpoints done, tables, real test output, deviations from the mock/contract, open questions.
Task: implement BE-15. There is no HTTP surface for Bijak SPM yet: derive the contract from the public methods listPapers, getCover, listContracts and generatePaper of src/modules/m28-bijak-spm/server/store.ts and the types in domain/types.ts, align the data model with docs/requirements/v2-exam-schema.md (approved D47), and use @pp/exam-core for blueprint composition. Seed the PoC papers from the m28 data files (invented content only). Never return answer keys or schemes from these endpoints.
```
