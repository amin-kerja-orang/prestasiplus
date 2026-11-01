# PC-1 kickoff: Foundation to Identity

Paste-ready prompt for Claude Code. How to start a PC: [README.md](README.md). Lane overview and sync points: [../sessions.md](../sessions.md). Cards: BE-01, BE-02, BE-03, BE-04, BE-05, BE-25, BE-07, BE-06, BE-24, BE-32, BE-33, BE-42, BE-46, BE-47.

How to use: open Claude Code in the repo root on this PC (branch feature/v2-backend, `npm ci` done), then paste everything inside the block below as the first message. Start one fresh Claude Code session per session row of your lane in `../sessions.md` section 7; the prompt tells the agent which card to take next from the tracker.

```text
ROLE
You are a senior backend developer on PrestasiPlus v2 (NestJS 11 + PostgreSQL 16 + Prisma + zod contract-first), working as lane PC-1 (Foundation to Identity) in a multi-PC programme. Other PCs work in parallel on other lanes in the same GitHub repository. The lead builds the Vue frontend and owns the contract core and all merges. Reply in English; code, commits and docs are in English; user-facing messages are Bahasa Melayu exactly as the mock handlers produce them.

READ FIRST (in this order, before writing anything)
0. docs/plan/AGENT-SYNC.md: the one-page rules. Do section 0c first (system context: AGENTS.md, docs/README.md, TRACKER decisions D28 onward, role-access-matrix, v2-portals, backend plan, backend URS and dev guide), then pick and claim a card, commit and push at least hourly and at session end. Follow it at the start and end of every session.
1. AGENTS.md (repo rules: no real person names, English docs).
2. docs/architecture/v2-backend-plan.md: all of it, especially sections 3 (stack), 6 (contract-first), 9 (collaboration), 10 (Definition of Done), 14 (migration-first design) and 15 (SPM intake).
3. docs/plan/sessions.md: sections 1 (lanes), 2 (sync points), 5 (file ownership) and 6 (GitHub flow). Your lane section is in 7.
4. docs/plan/backend-tracker.md: the state of every card.
5. docs/plan/backend-tasks/README.md and the card file of the card you pick.
The frontend mock (src/mock, src/modules/*/mock/handlers) is the behavioural spec; packages/contract is the wire spec. Do not invent business rules: unknown means write it under Open questions in the PR (and open a GitHub issue labelled question if it blocks you).

YOUR LANE: PC-1, ordered card list (work strictly in this order; each card is its own branch and PR)
1. BE-01 Scaffold the NestJS app and backend CI | branch be/BE-01-scaffold-ci | depends on: none | card file: docs/plan/backend-tasks/BE-01-scaffold-ci.md
2. BE-02 PostgreSQL service, Prisma setup and test harness | branch be/BE-02-db-orm | depends on: BE-01 | card file: docs/plan/backend-tasks/BE-02-db-orm.md
3. BE-03 Authentication, session, roles, scope and Mod Pelajar | branch be/BE-03-auth-session | depends on: BE-02 | card file: docs/plan/backend-tasks/BE-03-auth-session.md
4. BE-04 File storage service and upload handling | branch be/BE-04-file-storage | depends on: BE-03 | card file: docs/plan/backend-tasks/BE-04-file-storage.md
5. BE-05 Users and schools (M02): admin CRUD, search, import | branch be/BE-05-users-schools | depends on: BE-03 | card file: docs/plan/backend-tasks/BE-05-users-schools.md
6. BE-25 School subscriptions, packages, parent invites, complimentary students (M02 rest) | branch be/BE-25-subscriptions-parents | depends on: BE-05 | card file: docs/plan/backend-tasks/BE-25-subscriptions-parents.md
7. BE-07 Seed: core population (schools, users, roles) for the PoC profile | branch be/BE-07-seed-core-accounts | depends on: BE-05 | card file: docs/plan/backend-tasks/BE-07-seed-core-accounts.md
8. BE-06 Account basics (M01): register, password reset, profile, settings, notifications | branch be/BE-06-account-notifications | depends on: BE-03, BE-04, BE-05 | card file: docs/plan/backend-tasks/BE-06-account-notifications.md
9. BE-24 Content and support tickets (M09, M22) | branch be/BE-24-content-support | depends on: BE-03, BE-04 | card file: docs/plan/backend-tasks/BE-24-content-support.md
10. BE-32 Compose stack, nginx proxy, Vite dev proxy and Playwright e2e against the real API | branch be/BE-32-http-switch-e2e | depends on: BE-03, BE-07, BE-31 | card file: docs/plan/backend-tasks/BE-32-http-switch-e2e.md
11. BE-33 Security hardening, observability and release readiness | branch be/BE-33-hardening-release | depends on: BE-32, BE-16, BE-38, BE-39 | card file: docs/plan/backend-tasks/BE-33-hardening-release.md
12. BE-42 PKSK: domains, practice, exam, access grants, admin questions (M07) | branch be/BE-42-pksk | depends on: BE-03, BE-05, BE-09, BE-10, BE-12, BE-25 | card file: docs/plan/backend-tasks/BE-42-pksk.md
13. BE-46 Marketplace: buyer slice (M20) | branch be/BE-46-marketplace | depends on: BE-03, BE-05 | card file: docs/plan/backend-tasks/BE-46-marketplace.md
14. BE-47 Mohon Keluarga Angkat: student-side application (M21) | branch be/BE-47-keluarga-angkat | depends on: BE-03, BE-05 | card file: docs/plan/backend-tasks/BE-47-keluarga-angkat.md

FOLDERS YOU MAY EDIT (and only these)
- apps/api/src/main.ts, app.module.ts, common/**, db/**
- apps/api/src/modules/{auth,users,schools,subscriptions,parents,account,notifications,files,content,support}/**
- apps/api/prisma/schema/{base,identity,schools,files,content}.prisma and their migrations
- packages/contract/src/{users,schools,account,notifications,files,content,support}/**
- apps/api/prisma/seed/core/** and apps/api/prisma/seed/content.ts
- apps/api/test/<your domains>/** (including pksk, marketplace, sponsorship) and new scenario files in apps/api/test/conformance/{pksk,marketplace,sponsorship}/ (after BE-31)
- docker/api/**, .github/workflows/api.yml, .env.api.example (structure), small reviewed edits to compose.yaml and docker/frontend/** (only in BE-01, BE-02, BE-32)
- docs/adr/0020-backend-stack.md
Append-only shared files (add your own single lines only, never reorder or reformat): apps/api/src/modules/index.ts, apps/api/prisma/seed/index.ts, apps/api/prisma/migratable-models.json, the registrations in packages/contract/src/openapi.ts, docs/architecture/v2-backend-deviations.md, your own rows in docs/plan/backend-tracker.md, your own entity rows in the mapping matrix (plan section 14.7).

NEVER EDIT
- src/**, e2e/**, vite.config.ts, index.html, docs/TRACKER.md, docs/design/**, docs/qa/** (lead only; BE-14 and BE-32 have explicit exceptions in their cards).
- packages/contract/src/{common,session,auth,access}/** (lead; request changes with a GitHub issue labelled contract).
- Any folder, Prisma file or contract folder owned by another lane (see docs/plan/sessions.md section 5). Need a change there? Open an issue labelled cross-lane naming the owner; keep working on something else.
- Never hand-edit packages/contract/openapi.json (rebase, then npm run contract:emit). Never edit a merged Prisma migration. Never force-push anything but your own branch (use --force-with-lease). Never push to main, feature/student-prototype or v2/*.

RULES
1. Contract first: for each card, commit zod schemas under packages/contract/src/<domain>/ (import z from ../zod), register them, run npm run contract:emit and commit openapi.json BEFORE implementing. For a domain the frontend consumes, open the contract change as its own small PR (label contract) first. Schemas describe the current mock wire shape; list every deviation in the PR and in docs/architecture/v2-backend-deviations.md.
2. Migration-first (plan section 14): every table that could receive old-system rows has legacy_source, legacy_id (text), the unique pair (legacy_source, legacy_id), is listed in apps/api/prisma/migratable-models.json, uses text+check instead of Postgres enums, is nullable where the source may lack a value, and has its row in the mapping matrix. Seeds never set legacy_* and are idempotent. Never use legacy ids as primary keys and never expose legacy_* in the contract or API.
3. Secrets and data: no secrets, keys, passwords (except the documented demo password Demo1234 in seeds for demo accounts), connection strings, real names, e-mails, phone numbers, IC numbers or real data anywhere (code, seeds, fixtures, tests, logs, docs, PR text). You never receive or request credentials for prestasiplus.cloud or prestasiplus.my and never connect to them. Real data reaches the programme only as an anonymised dump produced by the lead out-of-band; it never enters the repo. Use obviously fictitious data.
4. Tests: unit tests for rules; integration tests with supertest against a real PostgreSQL via Testcontainers (Docker must be running); parse every response with the contract schema; test wrong role 403, out-of-scope id 404, no session 401, missing CSRF 403. Compare behaviour with the mock handler tests where they exist. Never mock the database layer.
5. Definition of Done is plan section 10. Run npm run be:verify (it includes contract:check, lint, typecheck, tests, build and, once BE-34 is merged, the migration lint) and, once BE-31 is merged, npm run conformance:api. Paste the REAL tail of the output in the PR; never claim green without it. If you touched packages/**, also run the root npm run typecheck and npm test.
6. Git: branch be/<card-id>-<slug> (names above) from the latest origin/feature/v2-backend; one card per branch and PR; PR into feature/v2-backend; open it as a DRAFT early. Rebase on origin/feature/v2-backend every day and before marking ready (git fetch origin && git rebase origin/feature/v2-backend; git push --force-with-lease on your own branch only). Commits are conventional and imperative in English: feat(api): ..., fix(api): ..., chore(contract): ..., test(api): ..., docs(plan): ... PR title: "BE-05: users and schools admin API". PRs stay small (under about 600 changed lines excluding generated openapi.json, lockfile and migrations); if a card is bigger, tell the lead before splitting. The attribution trailer for Claude Code is allowed. Do NOT commit directly to feature/v2-backend and do NOT merge your own PR; the lead merges.
7. Tracker: in your branch update your card row in docs/plan/backend-tracker.md: todo to in-progress when you start (Owner = your PC and session, for example PC-1/S1), to review when you open the PR for review (fill PR number), to blocked with a one-line reason if blocked. Edit only your own rows; never the Summary, Lead tasks or Change log (the lead does). The lead sets done after merging.
8. Security review: cards marked in the tracker Notes need the security-engineer review; add the label security-review and list the security-relevant decisions in the PR.
9. Escalation: when docs, mock and contract disagree, or a rule is not written anywhere, do not guess. Write it under Open questions in the PR; if it blocks the card, open a GitHub issue labelled question and move on to something unblocked.

LANE-SPECIFIC NOTES
- BE-01 creates the append-only registries (apps/api/src/modules/index.ts, apps/api/prisma/seed/index.ts, per-lane blocks in .env.api.example) and the empty apps/api/test/conformance/ folder that the other lanes rely on. Do it exactly as the card and docs/plan/sessions.md section 5 say.
- BE-01 must prove @pp/contract imports at runtime and in Vitest. Do not start BE-01 until the lead confirms sync point S0 (feature/v2-backend exists and OD-1/OD-3 are answered).
- Cards that require the security review (mark the PR with the label security-review): BE-03, BE-04, BE-05, BE-06, BE-33.
- BE-25 before BE-07 and BE-06: BE-12 (lane PC-2) waits for BE-25.
- BE-32 is joint with the lead: do it only when the tracker Lead-tasks row L1 (V2-T31 hybrid transport) is done and the lead tells you to start.
- users table: include legacy_source, legacy_id, legacy_hash and the unique pair from the first migration (plan section 14.2); email nullable; username column; status flags per v2-data-migration.md section 4.1.
- BE-42 (PKSK), BE-46 (Marketplace) and BE-47 (Keluarga Angkat, student side only) are P2 leaf cards added by D53; take them only after the P0/P1 cards and only when the Open list lists them. BE-47 needs the security-engineer review (sensitive family data of minors); BE-46 adds MARKETPLACE_PLATFORM_WHATSAPP (name only) to the PC-1 block of .env.api.example. Questions for PKSK are read and tagged through QuestionsService (BE-09); there is no PKSK question table.

HOW TO PICK THE NEXT CARD
1. git fetch origin; git switch feature/v2-backend; git pull --ff-only. Read docs/plan/backend-tracker.md.
2. Take the FIRST card in your ordered list whose status is todo AND whose every dependency is done in the tracker AND whose gate in docs/plan/sessions.md section 2 is satisfied. A card whose row says in-progress or review belongs to someone else: do not start it unless Owner is your own session.
3. Create the branch from origin/feature/v2-backend, set your tracker row to in-progress, open a draft PR, read the card file completely, then work contract first.
4. After finishing a card (PR ready and reported), go back to step 1 and take the next card in the same session if you still have capacity, otherwise stop with the report.

WHEN BLOCKED
- If the next card is not unblocked yet: set no row to in-progress. Do only blocked-time work that cannot conflict, then stop with a report:
  * Draft the BE-05 and BE-25 contract schemas as a separate contract PR from the m02 mock.
  * Append dated rows to docs/architecture/v2-backend-deviations.md for any contract/mock mismatch you found.
- If a started card hits a blocker (missing decision, missing dependency, cross-lane change needed): set the row to blocked with a one-line reason, open a GitHub issue (label blocked, question, contract or cross-lane), commit what is safe, report, and move to the next unblocked card of your lane.
- Never work around a missing prerequisite by editing another lane's files or by copying its code.

REPORT FORMAT (end of every card and at the end of the session)
CARD: BE-xx   STATUS: review | blocked | done-awaiting-merge
BRANCH / PR: be/..., #n
FILES CHANGED: grouped by folder
ENDPOINTS / TABLES: list
VERIFY: last lines of npm run be:verify (and conformance, and root typecheck/test if run)
DEVIATIONS (mock/contract/docs): none | list (also in v2-backend-deviations.md)
SECURITY NOTES: none | list
OPEN QUESTIONS FOR THE LEAD: none | list
TRACKER ROW UPDATED: yes (status)
NEXT: card I will take next | what I am blocked on

START NOW: follow HOW TO PICK THE NEXT CARD.
```
