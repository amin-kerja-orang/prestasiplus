# BE-39 Paper builder and blueprint admin (write side of M28 papers)

| Field | Value |
|---|---|
| Size | L |
| Lane | PC-3 (folders: sessions.md section 5) |
| Priority | P1 |
| Wave | 3 |
| Depends on | BE-15, BE-10 |
| Parallel with | BE-38, BE-16, BE-12, BE-17 |
| Owner module | M28 Bijak SPM (papers and blueprints; questions stay with M04) |
| Security review | required (admin authoring and publish) |

## Goal

(D52) Persist the admin **paper builder**: create and edit papers (sections, placements, marks override, pinned question versions), choose a blueprint version, see conformance and shortages, and publish a paper to student Bijak SPM. Also blueprint admin (versioned "Kontrak" with provenance). BE-15 serves the read side and created the tables and status columns; this card adds the write endpoints and the publish workflow with no schema change.

## Inputs (read these)

- `docs/plan/AGENT-SYNC.md`, `docs/plan/sessions.md` section 5
- `docs/architecture/v2-backend-plan.md` section 15 (Paper builder row)
- `docs/requirements/v2-question-bank.md` 4.5 (paper assembly), 4.6 (versioning), 4.8 (publish gate: all questions Terbit and paper conforms to blueprint), and the stories around paper assembly and Sumber Kertas
- `docs/requirements/v2-exam-schema.md`: D5 (sections model), D6 (stimulus groups stay together), D7 (blueprints and provenance tags), section 6 (entities)
- BE-15 (tables incl. `papers.status`, blueprint `version`/`status`; endpoints; generation), BE-09/BE-10 (question lifecycle, `QuestionsService`), BE-14 (`@pp/exam-core` blueprint engine)
- No paper builder or blueprint admin screens exist in `src/` yet (checked: only `domain/blueprint.ts`, `domain/paper-model.ts`, `data/registry.ts` and the `BijakServer` read methods). The wire shapes are therefore defined by this card's contract PR from `src/modules/m28-bijak-spm/domain/{types,blueprint,paper-model}.ts` and the requirements above; the lead aligns the future UI through that PR.
- Requirements: BE-FR-20; BE-NFR-08 ([URS 9.2](../../requirements/v2-backend-urs.md))
- API catalogue part B2 (learning, question bank, exam): [learning-exam.md](../../architecture/v2-api-catalogue/learning-exam.md) (endpoint list, wire conventions and open questions for this card's scope)
- Data model: [v2-data-model.md](../../architecture/v2-data-model.md) (tables, keys and indexes of this card; being written 2026-10-19)

## Outputs

- Contract: `packages/contract/src/bijak/builder.ts` (paper draft, section, placement, blueprint CRUD, conformance report, publish request/outcome)
- **No Prisma change**: BE-15 already created `papers.status` (`draft | ready | published | withdrawn`), `papers.version` and the blueprint `version`/`status`/provenance columns. If a column is missing, raise a `cross-lane`/`question` issue instead of editing `exam.prisma` (it is shared with BE-16).
- `apps/api/src/modules/exam/builder/**`: draft CRUD, placement ordering (stimulus groups move as a unit), blueprint selection, conformance check using `@pp/exam-core` (marks budget per section, allowed modes, counts, choose-N rules), shortage report, publish/withdraw, audit events
- `apps/api/src/modules/exam/blueprints/**`: blueprint list/get/create/new version/retire (admin only)
- Tests under `apps/api/test/exam-builder/**`

## Files touched

Everything a PC may write for this card. A path outside this list needs a `cross-lane` issue first (sessions.md section 5).

- Folders written: `apps/api/src/modules/exam/builder/**`, `apps/api/src/modules/exam/blueprints/**`.
- Prisma file(s): none (no schema change).
- Contract: `packages/contract/src/bijak/builder.ts` (new files only), registered in `src/openapi.ts`; `openapi.json` is regenerated with `npm run contract:emit`, never hand-edited.
- Seeds: none.
- Tests: `apps/api/test/exam-builder/**`, and (after BE-31) new scenario files in `apps/api/test/conformance/bijak-builder/`.
- Append-only shared files (one line each, never reorder): `apps/api/src/modules/index.ts` (one import and one array entry); `docs/architecture/v2-backend-deviations.md` (a dated row only if you deviate); your own row in `docs/plan/backend-tracker.md`.
- No-clash note: No Prisma file is touched (the columns it needs come from BE-15), so BE-39 can run in parallel with BE-16 although both are in lane PC-3; it needs BE-10 (PC-5) to be merged for the `published` question status.

## Endpoints (new; Admin Pusat only; no mock route exists; paths fixed in this card's contract PR)

| Method and path | Notes |
|---|---|
| `GET /api/admin/papers`, `POST /api/admin/papers`, `GET /api/admin/papers/:id`, `PUT /api/admin/papers/:id`, `DELETE /api/admin/papers/:id` | paper drafts; delete only while `draft` |
| `PUT /api/admin/papers/:id/sections`, `PUT /api/admin/papers/:id/placements` | structure and ordered placements |
| `GET /api/admin/papers/:id/conformance` | blueprint conformance and shortages |
| `POST /api/admin/papers/:id/publish`, `POST /api/admin/papers/:id/withdraw` | publish gate; withdraw hides from Kertas Pilihan |
| `GET /api/admin/blueprints`, `POST /api/admin/blueprints`, `GET /api/admin/blueprints/:id`, `POST /api/admin/blueprints/:id/versions`, `POST /api/admin/blueprints/:id/retire` | versioned blueprints |

## DB tables touched

`papers`, `paper_sections`, `paper_placements`, `blueprints`, `blueprint_sections` (rows written; no schema change); questions are read through `QuestionsService`.

## Acceptance criteria

1. A draft paper can be assembled from Terbit (`published`) questions, ordered, sectioned, and checked against a blueprint version; the conformance report lists every gap with section and rule (test with one deliberately non-conforming paper per rule: marks budget, count, mode, choose-N).
2. Publish is refused with 422 `VALIDATION_ERROR` (new BM message, listed in the PR) unless every placed question is `published` at the pinned version and the paper conforms; publish pins versions so a later question edit (new version n+1) does not change the paper (v2-question-bank 4.6; test edits a question after publish and re-reads the paper).
3. Questions of one stimulus group cannot be split across sections or separated in order (test: a placement update that splits a group returns 422).
4. A published paper appears in the BE-15 paper list and cover for Murid; a withdrawn paper disappears from the list; attempts already started on it are unaffected (BE-16 integration test).
5. Blueprint versions are immutable once used by a published paper; editing creates a new version (the old row is unchanged).
6. Guru, Admin Sekolah and Murid get 403 on all `/api/admin/papers*` and `/api/admin/blueprints*` endpoints; no session 401; missing CSRF 403 `CSRF_INVALID`; unknown id 404.
7. The conformance engine is the shared `@pp/exam-core` code: a test imports the same function and compares outputs, and a grep test fails if the API defines its own marks-budget rule.
8. All state changes write audit events (who, when, from, to).

## Test commands

```
npm run be:test -- apps/api/test/exam-builder
npm run contract:check
npm run be:verify
npm run be:test -- apps/api/test/conformance   # only after BE-31 is merged
```

## Definition of Done

1. Plan section 10 (all ten items) is met.
2. `npm run contract:check && npm run be:verify` is green; if anything under `packages/**` changed, root `npm run typecheck && npm test` is green too. Paste the real tail of the output in the PR.
3. Conformance (BE-31): once BE-31 is merged, add this card's scenarios as new files in `apps/api/test/conformance/bijak-builder/` and run `npm run be:test -- apps/api/test/conformance`; a failure is a blocker. Before BE-31 merges, `be:verify` is the gate; write "conformance scenarios pending BE-31" in the PR.
4. This card creates no tables; the migration-first checklist (plan section 14.9) does not apply, but no change may break `npm run be:lint:migration` (once BE-34 is merged).
5. Label `security-review` on the PR; list the security decisions and the tests that prove them.
6. The card's tracker row is updated (status, PR number, one-line note) and the PR description follows the template in `docs/plan/backend-tasks/README.md`. Nothing stays only on your PC (AGENT-SYNC.md section 4).

**Status note (LEAD 2026-10-19, D54(a) corrected):** questions have five wire states `draft`, `review`, `approved`, `published`, `archived` (BM Draf, Semakan, Lulus, Diterbitkan, Diarkib). The prototype review action "Lulus & Terbit" moves a question through `approved` and then `published` in one step; both states still exist on the wire.

## Open questions

Do not guess these; write your working assumption in the PR and ask the lead (issue labelled `question`) if it blocks you.

1. Meaning of `ready`: working assumption is "all questions are Terbit and the paper conforms, set automatically by the conformance check"; `published` and `withdrawn` are explicit admin actions. Confirm the state machine.
2. The 19 empty .cloud blueprint skeletons are skipped by the migration (BE-15/BE-39 keep their `legacy_*` columns); nothing to do here.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-39 (paper-builder-blueprints). Work in this repo clone on branch be/BE-39-paper-builder-blueprints, created from the latest origin/feature/v2-backend.
Read first, in order: docs/plan/AGENT-SYNC.md (how to claim, commit and push); AGENTS.md; docs/plan/sessions.md section 5 (folder ownership); docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14, 15); docs/plan/backend-tasks/BE-39-paper-builder-blueprints.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/bijak/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend paper builder and mock (paths from the lead) are the behavioural spec: do not invent business rules; unknowns go under "Open questions" in the PR. Questions are owned by M04: read them only through QuestionsService. Marking and blueprint rules come from @pp/exam-core. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders. Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
Task: implement BE-39: paper drafts, placements, blueprint conformance and shortages, publish/withdraw, blueprint admin with versions. Needs a security review.
When finished run npm run be:verify and report: files changed, endpoints, tables, real test output, deviations, open questions. Update docs/plan/backend-tracker.md (your card row) in the same PR.
```
