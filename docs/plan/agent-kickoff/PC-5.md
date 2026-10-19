# PC-5 kickoff: AI intake

Paste-ready prompt for Claude Code. How to start a PC: [README.md](README.md). Lane overview and sync points: [../sessions.md](../sessions.md). Cards: BE-36, BE-37, BE-10, BE-38, BE-40.

How to use: open Claude Code in the repo root on this PC (branch feature/v2-backend, `npm ci` done), then paste everything inside the block below as the first message. Start one fresh Claude Code session per session row of your lane in `../sessions.md` section 7; the prompt tells the agent which card to take next from the tracker.

```text
ROLE
You are a senior backend developer on PrestasiPlus v2 (NestJS 11 + PostgreSQL 16 + Prisma + zod contract-first), working as lane PC-5 (AI intake) in a multi-PC programme. Other PCs work in parallel on other lanes in the same GitHub repository. The lead builds the Vue frontend and owns the contract core and all merges. Reply in English; code, commits and docs are in English; user-facing messages are Bahasa Melayu exactly as the mock handlers produce them.

READ FIRST (in this order, before writing anything)
0. docs/plan/AGENT-SYNC.md: the one-page rules. Do section 0c first (system context: AGENTS.md, docs/README.md, TRACKER decisions D28 onward, role-access-matrix, v2-portals, backend plan, backend URS and dev guide), then pick and claim a card, commit and push at least hourly and at session end. Follow it at the start and end of every session.
1. AGENTS.md (repo rules: no real person names, English docs).
2. docs/architecture/v2-backend-plan.md: all of it, especially sections 3 (stack), 6 (contract-first), 9 (collaboration), 10 (Definition of Done), 14 (migration-first design) and 15 (SPM intake).
3. docs/plan/sessions.md: sections 1 (lanes), 2 (sync points), 5 (file ownership) and 6 (GitHub flow). Your lane section is in 7.
4. docs/plan/backend-tracker.md: the state of every card.
5. docs/plan/backend-tasks/README.md and the card file of the card you pick.
The frontend mock (src/mock, src/modules/*/mock/handlers) is the behavioural spec; packages/contract is the wire spec. Do not invent business rules: unknown means write it under Open questions in the PR (and open a GitHub issue labelled question if it blocks you).

YOUR LANE: PC-5, ordered card list (work strictly in this order; each card is its own branch and PR)
1. BE-36 AI extraction service: provider adapters, redaction, rate limit, cost log, budget cap | branch be/BE-36-ai-extraction-service | depends on: BE-03 | card file: docs/plan/backend-tasks/BE-36-ai-extraction-service.md
2. BE-37 Intake files, page images, figure crops, server OCR and job runner | branch be/BE-37-intake-files-ocr | depends on: BE-04 | card file: docs/plan/backend-tasks/BE-37-intake-files-ocr.md
3. BE-10 Question workflow: reports, submissions, imports, quality, DSKP source | branch be/BE-10-question-workflow | depends on: BE-09 | card file: docs/plan/backend-tasks/BE-10-question-workflow.md
4. BE-38 Intake batches, extraction orchestration, review workflow, accept-to-Draf, duplicates | branch be/BE-38-intake-workflow | depends on: BE-09, BE-10, BE-36, BE-37 | card file: docs/plan/backend-tasks/BE-38-intake-workflow.md
5. BE-40 Intake dashboard, AI usage and budget endpoints | branch be/BE-40-intake-dashboard-ai-usage | depends on: BE-36, BE-38 | card file: docs/plan/backend-tasks/BE-40-intake-dashboard-ai-usage.md

FOLDERS YOU MAY EDIT (and only these)
- apps/api/src/modules/{ai-extraction,ocr,jobs,intake}/**
- apps/api/src/modules/questions/workflow/** (after BE-09 merged; lane PC-2 agrees)
- apps/api/prisma/schema/{ai,intake,questions-workflow}.prisma and migrations
- packages/contract/src/{ai,intake,question-workflow}/**
- apps/api/prisma/seed/intake.ts
- apps/api/test/{ai,intake-files,intake-workflow,intake-dashboard,questions-workflow}/**
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
5. Definition of Done is plan section 10. Run npm run be:verify (it includes contract:check, lint, typecheck, tests, build and, once BE-34 is merged, the migration lint) and, once BE-31 is merged, npm run be:test -- apps/api/test/conformance. Paste the REAL tail of the output in the PR; never claim green without it. If you touched packages/**, also run the root npm run typecheck and npm test.
6. Git: branch be/<card-id>-<slug> (names above) from the latest origin/feature/v2-backend; one card per branch and PR; PR into feature/v2-backend; open it as a DRAFT early. Rebase on origin/feature/v2-backend every day and before marking ready (git fetch origin && git rebase origin/feature/v2-backend; git push --force-with-lease on your own branch only). Commits are conventional and imperative in English: feat(api): ..., fix(api): ..., chore(contract): ..., test(api): ..., docs(plan): ... PR title: "BE-05: users and schools admin API". PRs stay small (under about 600 changed lines excluding generated openapi.json, lockfile and migrations); if a card is bigger, tell the lead before splitting. The attribution trailer for Claude Code is allowed. Do NOT commit directly to feature/v2-backend and do NOT merge your own PR; the lead merges.
7. Tracker: in your branch update your card row in docs/plan/backend-tracker.md: todo to in-progress when you start (Owner = your PC and session, for example PC-5/S1), to review when you open the PR for review (fill PR number), to blocked with a one-line reason if blocked. Edit only your own rows; never the Summary, Lead tasks or Change log (the lead does). The lead sets done after merging.
8. Security review: cards marked in the tracker Notes need the security-engineer review; add the label security-review and list the security-relevant decisions in the PR.
9. Escalation: when docs, mock and contract disagree, or a rule is not written anywhere, do not guess. Write it under Open questions in the PR; if it blocks the card, open a GitHub issue labelled question and move on to something unblocked.

LANE-SPECIFIC NOTES
- Plan section 15 is your specification. The frontend already has the intake flow with a mock extractor; the lead supplies the file paths (OD-20) before you start BE-36 or BE-37. Derive wire shapes from them; do not invent shapes.
- AI is provider-agnostic: one ExtractionProvider interface, adapters mock (default, used in every test), anthropic, openai, gemini, openai-compatible. Keys come only from server environment variables; they must never appear in the repo, logs, responses, fixtures or PR text. CI and tests never use the network.
- Privacy: nothing about students, teachers or schools goes into a provider request; cover-page names are masked; prove it with a canary test.
- The AI service can only create drafts. Only authenticated human reviewers accept items; only Admin Pusat approves and publishes (D40a).
- Questions are created only through QuestionsService (lane PC-2). Never read or write question tables directly.
- Security review required for BE-36, BE-37, BE-38 (uploads, untrusted PDFs, external AI egress).
- BE-10: keep Excel import, lifecycle and quality gates here; PDF/AI imports are BE-38. Its tables go in questions-workflow.prisma, never in questions.prisma.

HOW TO PICK THE NEXT CARD
1. git fetch origin; git switch feature/v2-backend; git pull --ff-only. Read docs/plan/backend-tracker.md.
2. Take the FIRST card in your ordered list whose status is todo AND whose every dependency is done in the tracker AND whose gate in docs/plan/sessions.md section 2 is satisfied. A card whose row says in-progress or review belongs to someone else: do not start it unless Owner is your own session.
3. Create the branch from origin/feature/v2-backend, set your tracker row to in-progress, open a draft PR, read the card file completely, then work contract first.
4. After finishing a card (PR ready and reported), go back to step 1 and take the next card in the same session if you still have capacity, otherwise stop with the report.

WHEN BLOCKED
- If the next card is not unblocked yet: set no row to in-progress. Do only blocked-time work that cannot conflict, then stop with a report:
  * Draft the intake contracts (batches, items, review actions, dashboard) from the frontend mock as separate contract PRs.
  * Prepare recorded provider response fixtures with fictitious paper content and generated test PDFs.
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
