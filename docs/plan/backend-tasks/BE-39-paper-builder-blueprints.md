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

(D52) Persist the admin **paper builder**: create and edit papers (sections, placements, marks override, pinned question versions), choose a blueprint version, see conformance and shortages, and publish a paper to student Bijak SPM. Also blueprint admin (versioned "Kontrak" with provenance). BE-15 already serves the read side; this card adds writes and a publish workflow.

## Inputs (read these)

- `docs/architecture/v2-backend-plan.md` section 15 (Paper builder row)
- `docs/requirements/v2-question-bank.md` 4.5 (paper assembly), 4.8 (publish gate: all questions Terbit and paper conforms to blueprint), US around paper assembly and Sumber Kertas
- `docs/requirements/v2-exam-schema.md`: D5 (sections model), D6 (stimulus groups stay together), D7 (blueprints and provenance tags), section 6 (entities)
- BE-15 (tables, endpoints, generation), BE-09/BE-10 (question lifecycle, `QuestionsService`), BE-14 (`@pp/exam-core` blueprint engine)
- The frontend paper builder and blueprint screens/mocks (paths from the lead, OD-20)

## Outputs

- Contract: `packages/contract/src/bijak/builder.ts` (paper draft, section, placement, blueprint CRUD, conformance report, publish request/outcome)
- Prisma (`exam.prisma`, after BE-15 merged): add `status` (draft / ready / published / withdrawn) and version to `papers`, blueprint version fields and provenance tag handling; no duplicate tables for existing concepts
- `apps/api/src/modules/exam/builder/**`: draft CRUD, placement ordering (stimulus groups are moved as a unit), blueprint selection, conformance check using `@pp/exam-core` (marks budget per section, allowed modes, counts, choose-N rules), shortage report, publish/withdraw, audit events
- `apps/api/src/modules/exam/blueprints/**`: blueprint list/get/create/new version/retire (admin only)
- Tests under `apps/api/test/exam-builder/**`

## Endpoints (relative to `/api`; Admin Pusat only unless stated; final paths from the contract commit)

| Method and path (indicative) | Notes |
|---|---|
| `GET/POST /admin/papers`, `GET/PUT/DELETE /admin/papers/:id` | paper drafts; delete only while draft |
| `PUT /admin/papers/:id/sections`, `PUT /admin/papers/:id/placements` | structure and ordered placements |
| `GET /admin/papers/:id/conformance` | blueprint conformance and shortages |
| `POST /admin/papers/:id/publish`, `POST /admin/papers/:id/withdraw` | publish gate; withdraw hides from Kertas Pilihan |
| `GET/POST /admin/blueprints`, `GET /admin/blueprints/:id`, `POST /admin/blueprints/:id/versions`, `POST /admin/blueprints/:id/retire` | versioned blueprints |

## DB tables touched

`papers`, `paper_sections`, `paper_placements`, `blueprints`, `blueprint_sections` (extended); reads questions through `QuestionsService`.

## Acceptance criteria

1. A draft paper can be assembled from Terbit questions, ordered, sectioned, and checked against a blueprint version; the report lists every gap with section and rule.
2. Publish is refused (422, BM message) unless every placed question is Terbit at the pinned version and the paper conforms; publish pins versions so later question edits do not change the paper (v2-question-bank 4.6).
3. Questions of one stimulus group cannot be split across sections or separated in order (test).
4. A published paper appears in the BE-15 paper list/cover for Murid; withdrawn papers disappear; attempts already started are unaffected.
5. Blueprint versions are immutable once used by a published paper; editing creates a new version.
6. Guru, Admin Sekolah, Murid: 403 on all `/admin/papers` and `/admin/blueprints` endpoints; no session 401; no CSRF 403; unknown id 404.
7. The conformance engine is the shared `@pp/exam-core` code (no duplicated rules in the API; test imports it).
8. All state changes write audit events (who, when, from, to).

## Test commands

```
npm run be:test -- apps/api/test/exam-builder
npm run contract:check
npm run be:verify
```

## Migration-first (plan section 14)

- `papers`, `paper_sections`, `paper_placements`, `blueprints`, `blueprint_sections` keep the `legacy_*` columns added by BE-15 (the .cloud bank is not migrated; 19 empty .cloud blueprint skeletons are skipped). Do not remove them.

## Prompt for Claude Code

```text
You are the backend developer for PrestasiPlus v2 working on task BE-39 (paper-builder-blueprints). Work in this repo clone on branch be/BE-39-paper-builder-blueprints, created from the latest origin/feature/v2-backend.
Read first, in order: AGENTS.md; docs/architecture/v2-backend-plan.md (sections 3, 6, 9, 10, 14, 15); docs/plan/backend-tasks/BE-39-paper-builder-blueprints.md (this card, all of it).
Rules: contract first (zod schemas in packages/contract/src/bijak/, import z from ../zod, register in src/openapi.ts, run npm run contract:emit and commit openapi.json before the implementation). The frontend paper builder and mock (paths from the lead) are the behavioural spec: do not invent business rules; unknowns go under "Open questions" in the PR. Questions are owned by M04: read them only through QuestionsService. Marking and blueprint rules come from @pp/exam-core. Never commit secrets or real personal names. Do not edit src/**, e2e/**, docs/TRACKER.md or the contract common/session/auth/access folders. Keep the diff inside the card Outputs and its "Files touched" list; commit after every green step and push at least hourly and before the session ends (AGENT-SYNC.md).
Task: implement BE-39: paper drafts, placements, blueprint conformance and shortages, publish/withdraw, blueprint admin with versions. Needs a security review.
When finished run npm run be:verify and report: files changed, endpoints, tables, real test output, deviations, open questions. Update docs/plan/backend-tracker.md (your card row) in the same PR.
```
