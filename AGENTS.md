# AGENTS.md — entry point for AI coding agents

Read this first. It works for any agent (Claude Code, Codex, Cursor, ...). Human-facing setup is in
[README.md](README.md); the docs index is [docs/README.md](docs/README.md). Full process rules are in
[CLAUDE.md](CLAUDE.md) (Claude Code reads it automatically; other agents should read it too).

## 1. What this project is

- **Origin.** A faithful front-end prototype rebuild of the live education platform prestasiplus.my
  (modules **M01–M27**, mock data, no backend). All **59 role-matrix rows** are at 100% (G5 READY).
- **Now: v2.** The project is evolving into **v2, a NEW system** (decisions D28–D32 in
  [docs/TRACKER.md](docs/TRACKER.md)). Old systems (prestasiplus.my, prestasiplus.cloud) are **never modified**.
  - Frontend = this Vue 3 prototype, re-themed on **Nuxt UI** with our own theme (next-gen audience, SPM 2027+,
    light + dark). Pages use only design-system components and theme tokens; Tailwind utilities for layout only.
  - Backend (later) = **NestJS + PostgreSQL**. Data is migrated from prestasiplus.cloud, except exam questions,
    which are reloaded through a new OCR + AI intake into one canonical question bank.
  - **prestasiplus.cloud is the primary reference**; .my only for things not in .cloud. Unchanged flows are
    replicated; changed flows (two portals, question intake/display, UI theme) are redesigned.
  - Two portals: **Portal Pentadbiran** (one portal replacing the 3 old admin surfaces; admin / admin_sekolah /
    pegawai_ppd) and **Portal Pembelajaran** (murid / guru / ibu bapa).
- **Current phase:** v2 **G2 Design in progress** (no v2 build yet). Check the TRACKER for the latest.

## 2. Where to look

| Need | Go to |
|---|---|
| Progress, decisions, open questions, next actions | [docs/TRACKER.md](docs/TRACKER.md) (single source of truth) |
| Process rules, roles, gates | [CLAUDE.md](CLAUDE.md) |
| Docs index | [docs/README.md](docs/README.md) |
| Prototype scope (what is built / hidden) | [docs/SCOPE-STATUS.md](docs/SCOPE-STATUS.md) |
| Role to screen matrix (59 rows) | [docs/ROLES-MATRIX-LINES.md](docs/ROLES-MATRIX-LINES.md), [docs/requirements/role-access-matrix.md](docs/requirements/role-access-matrix.md) |
| Requirements (per module) | `docs/requirements/urs/`, `docs/requirements/srs/`, masters `URS.md` / `SRS.md` |
| v2 requirements | [v2-portals](docs/requirements/v2-portals.md), [v2-cloud-gap](docs/requirements/v2-cloud-gap.md) |
| Architecture | [overview](docs/architecture/overview.md), [build-plan](docs/architecture/build-plan.md), [v2-data-migration](docs/architecture/v2-data-migration.md) |
| Decisions (ADRs 0001–0014) | [docs/adr/](docs/adr/) (stack, mock layer, determinism, virtual datasets, store ownership, ...) |
| Design | [docs/design/](docs/design/) (`design-system.md`, `shells.md` are prototype-era specs; v2 specs are planned, see docs/README.md) |
| Live-site discovery, element inventories | [docs/discovery/](docs/discovery/) |
| QA reports | [docs/qa/](docs/qa/) |
| Demo accounts | [README.md](README.md) (demo password only; no real credentials anywhere) |

Code layout (`src/`):

- `src/app/` bootstrap, router, module registry (`modules.ts`), layout host.
- `src/modules/<mNN-slug>/` one folder per module: `api/ components/ composables/ lib/ mock/ pages/ routes/ __tests__/`.
  Boundaries are enforced by ESLint (ADR-0009): modules do not import each other's internals.
- `src/mock/` the mock server: registry, repositories, deterministic datasets/seeds, persistence
  (ADR-0004 to 0006, 0013, 0014). This is the layer the NestJS backend will replace; its contracts mirror the
  future API.
- `src/shells/` layouts and navigation per audience (`public`, `user`, `admin`; nav definitions in `shells/nav/`).
- `src/components/`, `src/composables/`, `src/lib/`, `src/stores/`, `src/styles/` shared UI and utilities.
- `e2e/<mNN-slug>/` Playwright specs per module; `scripts/` build/test helpers.

## 3. Source-of-truth order

When documents disagree, the higher one wins:

1. `docs/TRACKER.md` decisions table (D1–D32; newer decisions supersede older ones on the same topic)
2. Requirements (`docs/requirements/`)
3. Architecture and ADRs (`docs/architecture/`, `docs/adr/`)
4. Design (`docs/design/`)
5. Code

If code must diverge from a doc, update the doc in the same change. Report real conflicts instead of silently choosing.

## 4. Process (summary; full rules in CLAUDE.md)

Gates: **G1** Requirements, **G2** Design (architecture + UX spec, user-approved), **G3** Build (lint, typecheck,
tests green), **G4** Review (code-reviewer, plus security-engineer for auth/payments/personal data/uploads/new input),
**G5** Test (every acceptance criterion executed), **G6** Release (pipeline green, user confirms deploy).
Never claim a gate passed without real output as evidence.

Roles live in [.claude/agents/](.claude/agents/): `product-analyst`, `solution-architect`, `ui-ux-designer`,
`backend-developer`, `frontend-developer`, `code-reviewer`, `security-engineer`, `qa-engineer`, `devops-engineer`.
Other tools can treat these files as role briefs.

Change tracks: Full (new feature/schema/API) = G1 to G6; Standard (enhancement) = dev, review, targeted test;
Fast (bug/copy/config) = dev, review, retest the AC; Trivial (typo) = direct edit.

## 5. Conventions

- **Feature slug** (e.g. `user-login`, `m05-practice`) is used in `docs/*/<slug>.md`, branch `feature/<slug>`, commits.
- **Branches:** work on a feature branch; never commit directly to `main`. Current branch: `feature/student-prototype`.
- **Commits:** Conventional Commits style as in `git log`: `type(scope): summary`, e.g.
  `fix(m03-curriculum): ...`, `qa(m27): ...`, `docs(tracker): ...`, `test(m17): ...`, `docs(v2): ...`.
- **Language:** code, commits and `docs/` in English; UI copy is Bahasa Melayu (exact strings matter for replicated flows).
- **Responsive is mandatory:** 320px and up with no horizontal scroll; E2E runs at 375 / 768 / 1280.
- **Commands** (Node `^22.22.2 || ^24.15.0 || >=26`, see `.nvmrc`):

```bash
npm install && npx playwright install chromium   # once
npm run dev            # dev server (mock data + test hooks), http://localhost:5173
npm run lint           # ESLint incl. module-boundary rules
npm run typecheck      # vue-tsc strict
npm run test           # Vitest unit/component
npm run test:e2e:module -- m01-authentication   # Playwright, one module
npm run verify         # lint + typecheck + test + build  (G3 evidence)
```

- Boot guard: `src/mock/server/__tests__/registry-boot.test.ts` must stay green after any shared mock-data change.

## 6. Shared working tree safety

Several sessions may work in one checkout.

- An agent changing **another module's shared mock data** (M01 users, M05 practice, M10 classes, M04 questions, any
  `datasets/`, `seeds/` or spec file) works in an isolated git worktree and merges back only after the registry boot
  test and the owning module's tests pass.
- Never kill all `node`/Playwright/vite processes; stop only what you started. Port 5173 may belong to someone else.
- Never leave half-done data edits in the tree; a failing boot blocks everyone.
- Keep temp files and scripts in your own subfolder of the scratchpad. Do not edit `docs/TRACKER.md` unless you own
  the stage change you are recording.
- Do not touch `.claude/worktrees/`.

## 7. Privacy and secrets

- No real person's name (authors, teachers, principals, students) in docs, seeds, tests or code; use fictitious names.
  Public school names only where they are observed public anchors.
- Credentials (live logins, server access) are kept **outside the repo** and are never committed or pasted into docs,
  issues, PRs or summaries. Live sites are read-only.
- Demo accounts in README use the demo password only.

## 8. Backend programme (v2-backend)

The NestJS + PostgreSQL backend is built by several PCs and Claude Code sessions in parallel lanes, from the plan [docs/architecture/v2-backend-plan.md](docs/architecture/v2-backend-plan.md) (section 14 migration-first, section 15 SPM question intake and provider-agnostic AI, D52).

- **Every backend agent reads [docs/plan/AGENT-SYNC.md](docs/plan/AGENT-SYNC.md) first:** the LEAD (owner's PC and session) is the central guide; how to pick and claim a card, commit and push hourly and at session end.
- Status of all 40 cards (BE-01 to BE-40): [docs/plan/backend-tracker.md](docs/plan/backend-tracker.md). Backend sessions edit only their own rows; `docs/TRACKER.md` stays lead-only.
- Lanes, order, sync points, Gantt, file-ownership map and the GitHub flow: [docs/plan/sessions.md](docs/plan/sessions.md).
- Paste-ready agent prompts per lane and how to start a PC: [docs/plan/agent-kickoff/](docs/plan/agent-kickoff/README.md). Task cards: [docs/plan/backend-tasks/](docs/plan/backend-tasks/README.md).
- Backend requirements (functional, non-functional, migration, ops, traceability to cards): [docs/requirements/v2-backend-urs.md](docs/requirements/v2-backend-urs.md). Developer handbook (layout, module anatomy, errors and BM copy, Prisma, testing, Definition of Done): [docs/plan/backend-dev-guide.md](docs/plan/backend-dev-guide.md). Read both before working on a card.
- New PC: [docs/plan/onboarding.md](docs/plan/onboarding.md) (setup from zero, env names, Docker, common errors).
- API catalogue (every mock endpoint with roles, shapes, errors and exact BM messages, card, contract status): [docs/architecture/v2-api-catalogue.md](docs/architecture/v2-api-catalogue.md).
- Data model (ERD per domain, store owners, legacy columns, mapping gaps): [docs/architecture/v2-data-model.md](docs/architecture/v2-data-model.md).
- Frontend/backend switch (contract, mock, hybrid/http, cookies, CSRF, compose e2e): [docs/plan/fullstack-integration-guide.md](docs/plan/fullstack-integration-guide.md).
- Frontend handbook (design system, ratchets, responsive, testids): [docs/plan/frontend-dev-guide.md](docs/plan/frontend-dev-guide.md).
- Test strategy and gate evidence: [docs/qa/v2-test-strategy.md](docs/qa/v2-test-strategy.md).
- Backend agents: branch `be/<card-id>-<slug>` from `feature/v2-backend`, PR into it, contract first, work only in your lane's folders, never `src/**`, `e2e/**` or `docs/TRACKER.md`, no secrets and no access to the old systems' databases (the lead supplies anonymised dumps out-of-band).

## 9. How to pick up a task

1. Read [docs/TRACKER.md](docs/TRACKER.md): sections 0 (next actions), 2 (summary), 3 (module board), the decisions table.
2. Find your module/slice on the board and open its docs: URS/SRS in `docs/requirements/`, discovery in
   `docs/discovery/`, QA in `docs/qa/`, and the architecture task list (task IDs) in `docs/architecture/`.
3. For v2 work also read the v2 docs listed in [docs/README.md](docs/README.md) and decisions D28–D32.
4. Confirm the change track (section 4), branch from the feature branch, implement, and run `npm run verify`.
5. Update the module doc if behaviour changed; report what you did with evidence (command output, test results).
6. For backend tasks (see section 8 first; claim the card in the backend tracker) or tasks assigned via GitHub issues: reference the task ID, follow the API contract and data model in
   `docs/architecture/`, and use the mock contracts in `src/mock/` as the behavioural reference until replaced.
