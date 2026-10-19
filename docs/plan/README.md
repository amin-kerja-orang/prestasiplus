# Backend collaboration: start here

## Programme files (multi-PC, multi-session)

| Need | File |
|---|---|
| Status of every card (40), owners, branches, PRs | [backend-tracker.md](backend-tracker.md) |
| Lanes (PC-1 to PC-6 + lead), order, sync points S0 to S10, Gantt, file ownership, GitHub flow, sessions | [sessions.md](sessions.md) |
| Paste-ready Claude Code prompt per lane, and how to start a new PC | [agent-kickoff/README.md](agent-kickoff/README.md) |
| Task cards BE-01 to BE-40 | [backend-tasks/README.md](backend-tasks/README.md) |
| Backend requirements (BE-FR, BE-NFR, BE-MIG, BE-OPS, traceability to cards) | [../requirements/v2-backend-urs.md](../requirements/v2-backend-urs.md) |
| Developer handbook (layout, module anatomy, mock-to-endpoint worked example, errors, Prisma, tests, Definition of Done) | [backend-dev-guide.md](backend-dev-guide.md) |
| Design: migration-first (section 14), SPM intake and AI (section 15), open decisions OD-1 to OD-20 | [../architecture/v2-backend-plan.md](../architecture/v2-backend-plan.md) |
| New PC setup from zero (prerequisites, worktrees, env names, Docker, common errors) | [onboarding.md](onboarding.md) |
| Every endpoint the mock serves: roles, shapes, errors with exact BM messages, card, contract status | [../architecture/v2-api-catalogue.md](../architecture/v2-api-catalogue.md) |
| Data model: ERD per domain, store owners, legacy columns, mapping-matrix gaps | [../architecture/v2-data-model.md](../architecture/v2-data-model.md) |
| Frontend/backend integration: contract, mock, hybrid/http switch, cookies, CSRF, compose e2e | [fullstack-integration-guide.md](fullstack-integration-guide.md) |
| Frontend handbook (design system, ratchets, responsive, testids) | [frontend-dev-guide.md](frontend-dev-guide.md) |
| Test strategy and what each gate requires | [../qa/v2-test-strategy.md](../qa/v2-test-strategy.md) |

If you are one of several people or PCs, read [sessions.md](sessions.md) and your lane prompt instead of section 3 below ("pick the first task"); the sections here still apply.

You are building the **v2 backend** (NestJS + PostgreSQL) of PrestasiPlus while the lead keeps building the Vue frontend on another PC. You work with **Claude Code**; every task card has a prompt you can paste. Nothing here assumes you saw any earlier conversation.

## 1. Read (30 minutes, once)

1. [AGENTS.md](../../AGENTS.md) (repo rules: no real person names, English code/docs; the lead's own `CLAUDE.md` is the lead's workflow, you do not need to follow its role/gate system).
2. [docs/architecture/v2-backend-plan.md](../architecture/v2-backend-plan.md): goals, stack, layout, contract-first rule, collaboration rules, Definition of Done, open decisions.
3. [docs/plan/backend-tasks/README.md](backend-tasks/README.md): the task list with dependencies and parallel lanes.
4. Skim only when a card points to them: `docs/architecture/v2-data-migration.md`, `docs/requirements/v2-exam-schema.md`, `docs/requirements/srs/Mnn-*.md`, `packages/contract/README.md`.

The frontend mock (`src/mock/`, `src/modules/*/mock/handlers/`) is the **behavioural spec**; `@pp/contract` (`packages/contract`) is the **wire spec**. Do not invent business rules; when something is unknown, write it under "Open questions" in your PR.

## 2. Set up (first day)

```
git clone https://github.com/amin-kerja-orang/prestasiplus.git
cd prestasiplus
git fetch origin
git switch feature/v2-backend          # integration branch created by the lead
node -v                                # Node 22.22.2+ (see package.json engines)
npm ci                                 # installs every workspace
npm run contract:check                 # should pass on a clean checkout
npm run typecheck && npm test          # frontend baseline must be green before you start
```

Prerequisite: Docker Desktop (Compose v2) for PostgreSQL and Testcontainers.

After BE-01 and BE-02 are merged, the database comes up with:

```
docker compose up -d db                # PostgreSQL 16, no host port by default
npm run be:db:migrate
npm run be:dev
```

(Before BE-02 exists there is no `db` service: it is commented out in `compose.yaml`; BE-02 activates it.)

Secrets: copy `.env.api.example` to `.env.api` and `.env.db.example` to `.env.db` (both git-ignored) and fill in **local** values. Never commit them. You will not receive credentials for prestasiplus.cloud; migration cards use anonymised data or synthetic fixtures (open decision OD-2).

## 3. Pick the first task

Order for a single developer: **BE-01, BE-02, BE-03**, then run in parallel (separate Claude Code sessions, separate branches):

- BE-14 (shared exam engine package; needs the lead's OK on OD-5) and BE-05 / BE-08 / BE-11 / BE-04.
- Open `docs/plan/backend-tasks/BE-01-scaffold-ci.md`, read it fully, create the branch `be/BE-01-scaffold-ci` from `origin/feature/v2-backend`, start Claude Code in the repo root and paste the card's **Prompt for Claude Code** block.

Rules for each task (details in the plan, sections 6.2, 9 and 10):

1. **Contract first:** zod schemas in `packages/contract/src/<domain>/`, `npm run contract:emit`, commit `openapi.json`, then implement.
2. One card = one branch `be/<id>-<slug>` = one PR into `feature/v2-backend`. Do not push to `feature/student-prototype`, `v2/*` or `main`.
3. Stay inside the card's Outputs. Do not edit `src/**`, `e2e/**` or `docs/TRACKER.md` (BE-14 and BE-32 have explicit exceptions).
4. Run `npm run be:verify` and paste real output in the PR. No secrets, no real names or personal data anywhere.

## 4. Report back (every task)

1. Open a PR to `feature/v2-backend` titled `BE-05: users and schools admin API`, using the template in [backend-tasks/README.md](backend-tasks/README.md) (what changed, endpoints, tables, test output, deviations, open questions).
2. Add a **short note** to the PR (3 to 5 lines): done / blocked / next card you plan to take, and anything the lead must decide.
3. Blocking question? Open a GitHub issue with the label `question`, mention the card id, and keep working on another card meanwhile.
4. After review the lead squash-merges. Then update your local base: `git fetch origin && git switch feature/v2-backend && git pull`, and rebase any in-flight branch: `git rebase origin/feature/v2-backend` (use `git push --force-with-lease` only on your own branch).

## 5. How the lead and you stay in sync

| Channel | Used for |
|---|---|
| GitHub PRs into `feature/v2-backend` | all code and doc changes; the lead reviews and merges |
| GitHub issues with labels `question`, `contract`, `blocked` | decisions, contract change requests, blockers |
| `docs/TRACKER.md` change log | **the lead** records each merged card, decisions and sync points. You never edit it; your PR description is the source of the log entry |
| `feature/student-prototype` to `feature/v2-backend` merges | the lead merges the frontend branch into the integration branch regularly and says so in the TRACKER change log; you then rebase |
| `docs/architecture/v2-backend-deviations.md` | append-only list of contract/mock/doc deviations you made and who agreed |

Contract changes touching `common`, `session`, `auth` or `access` folders need the lead (open a PR labelled `contract` and mention the lead). Everything else in `packages/contract/src/<domain>/` is yours for your card's domain.

## 6. Things to know before you start

- The frontend e2e suite relies on mock-only hooks and large "full profile" data; against the real API only the specs tagged `@api` (BE-32) will run. Backend correctness is proven by your integration and conformance tests first.
- The frontend currently authenticates the mock with a Bearer token; the real API uses the **cookie session + CSRF** defined in the contract. The lead adapts `HttpTransport` (V2-T31). Do not add Bearer support.
- The contract says ids are opaque **strings**; the mock still uses numbers in places. Follow the contract (OD-9).
- Ports already used on the lead's PC: 5173, 5191, 5192, 5432, 5433, 6380, 8080, 8081. Your PC is free to differ; the `db` service publishes no host port by default.

## 7. Open decisions waiting for the user

Listed in plan section 13 (OD-1 to OD-20). The ones that can block you early: OD-1 (repo access), OD-3 (confirm stack), OD-5 (BE-14), OD-2 and OD-10 (only the migration cards). If a card needs an answer that is missing, take another card and note it in the PR.
