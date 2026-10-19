# Backend tracker (v2-backend)

Single source of truth for the **state of every backend card**. The lead's project tracker (`docs/TRACKER.md`) stays lead-only; this file is the one the backend sessions edit. Cards: [backend-tasks/](backend-tasks/README.md). Lanes, order and sync points: [sessions.md](sessions.md). Agent prompts: [agent-kickoff/](agent-kickoff/README.md). Design: [../architecture/v2-backend-plan.md](../architecture/v2-backend-plan.md).

- Last updated: 2026-10-19 (BE-41 to BE-48 added; all cards `todo`).
- Priority: **P0** blocks other lanes or the learning loop; **P1** needed for release B1; **P2** later in B1 or release gates.
- Status: `todo` / `in-progress` / `review` / `done` / `blocked`.
- Owner: the PC and session that holds the card, written as `PC-2/S3` (see sessions.md for session ids). Empty (`-`) until someone starts.
- A card is `done` only after the lead squash-merged its PR into `feature/v2-backend`.

## Summary

| Priority | Cards | Of which done |
|---|---|---|
| P0 | 13 | 0 |
| P1 | 23 | 0 |
| P2 | 12 | 0 |
| **Total** | **48** | **0** |

(The lead refreshes this table when merging; sessions do not need to.)

## Cards

| ID | Title | Lane | Priority | Depends on | Size | Status | Owner (PC/session) | Branch | PR | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| BE-01 | Scaffold the NestJS app and backend CI | PC-1 | P0 | none | M | done | pc-aminfaudzi/S2 | `be/BE-01-scaffold-ci` | - (LEAD merges by git) | Merged 2026-10-19 (LEAD review Approve, 3 minors). Sync S1 (workspace + CI). Writes ADR-0020. be:verify green (17 tests); image runs read-only, healthy; gitleaks full history clean (.gitleaks.toml). @swc/core pinned 1.15.47 (Windows native-cache ACL, ADR-0020). Open: add `apps/*/dist/**` to root ESLint ignores (lead-owned). |
| BE-02 | PostgreSQL service, Prisma setup and test harness | PC-1 | P0 | BE-01 | M | todo | - | `be/BE-02-db-orm` | - | Sync S2. Conventions: plan 14.2. Also creates the empty migratable-models.json and the seed runner `--profile`. |
| BE-03 | Authentication, session, roles, scope and Mod Pelajar | PC-1 | P0 | BE-02 | L | todo | - | `be/BE-03-auth-session` | - | Sync S3 (auth, scope). Security review. Users table already has legacy columns. |
| BE-04 | File storage service and upload handling | PC-1 | P0 | BE-03 | S | todo | - | `be/BE-04-file-storage` | - | Sync S4. Security review (uploads). Also derived files for BE-37. |
| BE-05 | Users and schools (M02): admin CRUD, search, import | PC-1 | P0 | BE-03 | L | review | s-aminfaudzi-mlcq | `be/BE-05-contract` | - | Contract only (users, schools): 24 routes; security-review fixes in 4f36948 (D55, D57), D58 fixes in 77596ca (403 copy pinned), D59 fix in c270c749, checks green; PR description in the empty commit after it (LEAD merges with git). Sync S5. Security review (IC, passwords). Unblocks BE-17, BE-25. |
| BE-06 | Account basics (M01): register, password reset, profile, settings, notifications | PC-1 | P1 | BE-03, BE-04, BE-05 | M | todo | - | `be/BE-06-account-notifications` | - | Contract merged 2026-10-19 (PR #4, be/BE-06-contract). Reset e-mail logged, not sent. Review fixes + D57 applied. |
| BE-07 | Seed: core population (schools, users, roles) for the PoC profile | PC-1 | P0 | BE-05 | S | todo | - | `be/BE-07-seed-core-accounts` | - | Demo accounts only (Demo1234). |
| BE-08 | Curriculum (M03): levels, subjects, chapters, topics, DSKP tree | PC-2 | P0 | BE-03 | M | todo | - | `be/BE-08-curriculum` | - | Contract merged 2026-10-19 (PR -, be/BE-08-contract). Sync S5. Unblocks BE-09. |
| BE-09 | Question bank core (M04): schema, repository, question CRUD and eligibility | PC-2 | P0 | BE-08 | L | todo | - | `be/BE-09-question-bank-core` | - | Contract merged 2026-10-19 (PR -, be/BE-09-contract). Sync S6 (question schema). Unblocks BE-10, BE-12, BE-15. |
| BE-10 | Question workflow: reports, submissions, imports, quality, DSKP source | PC-5 | P1 | BE-09 | M | todo | - | `be/BE-10-question-workflow` | - | Contract merged 2026-10-19 (PR #7, be/BE-10-contract). Lane PC-5. PDF/AI import is BE-38. Code in modules/questions/workflow/. |
| BE-11 | Wallet, ledger and streak core (M14 core) | PC-2 | P0 | BE-03 | M | todo | - | `be/BE-11-wallet-streak-core` | - | Contract merged 2026-10-19 (PR #1, be/BE-11-contract). Contract only (wallet): 3 routes, 13 Wallet* components; PR ready. Needed by BE-12, BE-16, BE-23. Includes `tiers` (read) and `token_movements`. |
| BE-12 | Practice sessions and answer log (M05 write path) | PC-2 | P0 | BE-09, BE-11, BE-25 | L | todo | - | `be/BE-12-practice-sessions` | - | Contract merged 2026-10-19 (PR -, be/BE-12-contract). Sync S7. Needs BE-25 (PC-1) and BE-11. |
| BE-13 | Practice read models: dashboard, subjects, mastery, revision, targets | PC-2 | P1 | BE-12 | M | todo | - | `be/BE-13-practice-reads` | - | Contract merged 2026-10-19 (PR #21, be/BE-13-contract). Missions/remedial reads moved to BE-18 (their tables are M10). Contract only: 16 routes, 44 PracticeRead* components, D57 429 on the two writes. Contract ready for review. |
| BE-14 | Shared exam engine package `@pp/exam-core` (marking, math expressions, blueprint) | PC-3 | P1 | BE-01 | M | todo | - | `be/BE-14-exam-core-package` | - | Needs OD-5 and one coordinated PR touching src/modules/m28-bijak-spm/domain (lead approves). |
| BE-15 | Bijak SPM: papers, sections, blueprints, paper generation (read side) | PC-3 | P1 | BE-09, BE-14 | M | todo | - | `be/BE-15-bijak-papers` | - | Contract merged 2026-10-19 (PR #8, be/BE-15-contract). Read side. Creates `papers.status/version` and blueprint version columns so BE-39 needs no schema change. |
| BE-16 | Bijak SPM: attempts, autosave, timer, marking, results, history | PC-3 | P1 | BE-15, BE-14, BE-04, BE-11 | L | todo | - | `be/BE-16-bijak-attempts` | - | Contract merged 2026-10-19 (PR #10, be/BE-16-contract). Security review (photos). Server timer. |
| BE-17 | Classes and teacher basics (M10 part A) | PC-6 | P1 | BE-05, BE-08 | M | todo | - | `be/BE-17-classes-teacher` | - | Contract merged 2026-10-19 (PR -, be/BE-17-contract).  |
| BE-18 | Teacher missions, remedial tests, question sets and DSKP picks (M10 part B) | PC-6 | P1 | BE-17, BE-09, BE-12 | M | todo | - | `be/BE-18-missions-remedial-sets` | - | Contract merged 2026-10-19 (PR -, be/BE-18-contract). Review fixes in bb2463a: provisional /guru/missions removed, D57 429 on writes, cancel deviation logged. Also owns GET /api/missions/today and /api/remedial-tests/*. |
| BE-19 | Student performance read models (M08) | PC-6 | P1 | BE-12, BE-17 | L | todo | - | `be/BE-19-student-performance` | - | Contract merged 2026-10-19 (PR -, be/BE-19-contract).  |
| BE-20 | Teacher analytics, monitoring and Kirkpatrick (M11, M12) | PC-6 | P2 | BE-19 | L | todo | - | `be/BE-20-teacher-analytics-kirkpatrick` | - |  |
| BE-21 | School admin (M27): dashboards, reports, staff and student management | PC-6 | P1 | BE-05, BE-17, BE-19 | L | todo | - | `be/BE-21-school-admin` | - | Contract merged 2026-10-19 (PR #6, be/BE-21-contract). Security review (school scope). Review fixes + D57 applied. |
| BE-22 | Command Center and admin dashboard aggregates (M17, M10 Command Center) | PC-6 | P1 | BE-17, BE-19, BE-23 | L | todo | - | `be/BE-22-command-center-admin` | - | Contract merged 2026-10-19 (PR -, be/BE-22-contract). Deviations: string ids (mock numeric); server-status follows mock host readings, not the card's build/DB/queue flags; ETag/no-store only in descriptions. Admin aggregates; Command Center. Needs BE-23 (badges and achievements). |
| BE-23 | Gamification economy and rewards shop (M14 rest, M15) | PC-2 | P1 | BE-11, BE-12 | L | todo | - | `be/BE-23-gamification-shop` | - | Contract merged 2026-10-19 (PR #3, be/BE-23-contract). Contract only (gamification, rewards): 42 in-B1 routes, 94 components; PR ready. 58 routes (M14 rest + M15). Prisma `gamification.prisma`; modules gamification and shop. |
| BE-24 | Content and support tickets (M09, M22) | PC-1 | P1 | BE-03, BE-04, BE-05, BE-06 | M | todo | - | `be/BE-24-content-support` | - | Contract merged 2026-10-19 (PR #2, be/BE-24-contract). Contract only (content, support): 47 routes, 103 components; PR ready. Needs BE-06 `NotificationsService` and BE-05 for school scoping. |
| BE-25 | School subscriptions, packages, parent invites, complimentary students (M02 rest) | PC-1 | P0 | BE-05 | M | todo | - | `be/BE-25-subscriptions-parents` | - | Contract merged 2026-10-19 (PR -, be/BE-25-contract). Needed by BE-12; do before BE-07/06. |
| BE-26 | Seed: PoC data profile across all carded domains | PC-6 | P2 | BE-07, BE-12, BE-16, BE-17, BE-19, BE-23, BE-24 | M | todo | - | `be/BE-26-seed-poc-profile` | - | May include intake/builder seed once BE-38/39 exist. Reads BE-24 content seed. |
| BE-27 | .cloud migration: staging schema, loader and profiling report (read-only source) | PC-4 | P1 | BE-02, BE-34 | M | todo | - | `be/BE-27-migration-staging-profiling` | - | Needs OD-2 for real data; fixtures meanwhile. Security review. |
| BE-28 | .cloud migration: ETL for reference data, identity and classes | PC-4 | P1 | BE-27, BE-05, BE-08, BE-17, BE-25 | L | todo | - | `be/BE-28-migration-etl-core` | - | Needs OD-10. Security review. |
| BE-29 | .cloud migration: ETL for activity, wallet, content and operations | PC-4 | P2 | BE-28, BE-11, BE-12, BE-16, BE-23, BE-24 | L | todo | - | `be/BE-29-migration-etl-activity` | - | Needs OD-10. |
| BE-30 | .cloud migration: reconciliation, rehearsal and cutover scripts | PC-4 | P2 | BE-29, BE-35 | M | todo | - | `be/BE-30-migration-reconcile-rehearsal` | - | Go/no-go gate for rehearsal. |
| BE-31 | Contract conformance suite and OpenAPI breaking-change gate | PC-6 | P0 | BE-03 | M | todo | - | `be/BE-31-conformance-suite` | - | Starts as skeleton; grows with every domain. Idle-time card for PC-6. |
| BE-32 | Compose stack, nginx proxy, Vite dev proxy and Playwright e2e against the real API | PC-1 + LEAD | P1 | BE-03, BE-07, BE-31 | M | todo | - | `be/BE-32-http-switch-e2e` | - | Joint with LEAD (V2-T31 hybrid transport). Raise nginx body size for uploads. |
| BE-33 | Security hardening, observability and release readiness | PC-1 | P2 | BE-32, BE-16, BE-38, BE-39 | M | todo | - | `be/BE-33-hardening-release` | - | Final security pass: uploads, AI keys, SSRF, migration data handling. Release gate. |
| BE-34 | Migration kit: legacy-column convention, ETL control tables, upsert helper, dry-run runner | PC-4 | P0 | BE-02 | M | todo | - | `be/BE-34-migration-kit` | - | Parallel with BE-03. Blocks BE-27/28. |
| BE-35 | Anonymiser tool and synthetic .cloud fixture generator | PC-4 | P1 | BE-27 | M | todo | - | `be/BE-35-anonymiser-fixtures` | - | Lead runs the anonymiser (OD-18). Security review. |
| BE-36 | AI extraction service: provider adapters, redaction, rate limit, cost log, budget cap | PC-5 | P1 | BE-03, BE-06 | M | todo | - | `be/BE-36-ai-extraction-service` | - | D52. Security review. Mock provider default. Needs BE-06 (budget notification). |
| BE-37 | Intake files, page images, figure crops, server OCR and job runner | PC-5 | P1 | BE-04 | L | todo | - | `be/BE-37-intake-files-ocr` | - | D52. Security review (untrusted PDFs). |
| BE-38 | Intake batches, extraction orchestration, review workflow, accept-to-Draf, duplicates | PC-5 | P1 | BE-09, BE-10, BE-36, BE-37 | L | todo | - | `be/BE-38-intake-workflow` | - | D52. Security review. Needs OD-20 paths. |
| BE-39 | Paper builder and blueprint admin (write side of M28 papers) | PC-3 | P1 | BE-15, BE-10 | L | todo | - | `be/BE-39-paper-builder-blueprints` | - | D52. No Prisma change (BE-15 creates the columns). Needs BE-10 (PC-5) and BE-15. |
| BE-40 | Intake dashboard, AI usage and budget endpoints | PC-5 | P2 | BE-36, BE-38 | S | todo | - | `be/BE-40-intake-dashboard-ai-usage` | - | D52. Admin only. |
| BE-41 | SPM hub: Tahun Lepas, Latih Tubi, Tracking A, Subjektif, mock exams (M06) | PC-3 | P1 | BE-03, BE-08, BE-09, BE-12, BE-13 | M | todo | - | `be/BE-41-spm-hub` | - | Contract merged 2026-10-19 (PR #9, be/BE-41-contract). Added 2026-10-19 (D53); lane approved by LEAD 2026-10-19 |
| BE-42 | PKSK: domains, practice, exam, access grants, admin questions (M07) | PC-1 | P2 | BE-03, BE-05, BE-09, BE-10, BE-12, BE-25 | L | todo | - | `be/BE-42-pksk` | - | Contract merged 2026-10-19 (PR -, be/BE-42-contract). Deviations: string ids, strict bodies, D57 429/no-store, proposed caps; PKSK question statuses kept as mock pending/approved/rejected (OQ). Added 2026-10-19 (D53); lane approved by LEAD 2026-10-19 |
| BE-43 | Cikgu Alesa: chat, RPH, essay markings, PBD tags (M13) | PC-5 | P2 | BE-36, BE-03, BE-05, BE-08, BE-12, BE-17 | L | todo | - | `be/BE-43-cikgu-alesa` | - | Contract merged 2026-10-19 (PR #22, be/BE-43-contract). Added 2026-10-19 (D53); lane approved by LEAD 2026-10-19. Contract only (cikgu): 10 routes, 18 Cikgu* components, 6 deviation rows in docs/architecture/v2-backend-deviations.md; BE-36 contract not on base, no ai import. contract ready for review |
| BE-44 | Battle arena, standings and tournaments (M16 part 1) | PC-7 | P2 | BE-03, BE-05, BE-08, BE-09, BE-12, BE-23 | L | todo | - | `be/BE-44-battle` | - | Contract merged 2026-10-19 (PR #12, be/BE-44-contract). Added 2026-10-19 (D53); lane approved by LEAD 2026-10-19 |
| BE-45 | Permainan hub, Papan Bijak, room and solo games, leagues, Sekolah Bersaing (M16 part 2) | PC-7 | P2 | BE-03, BE-05, BE-08, BE-09, BE-11, BE-13, BE-23 | L | todo | - | `be/BE-45-papan-bijak-games-hub` | - | Contract merged 2026-10-19 (PR #13, be/BE-45-contract). Added 2026-10-19 (D53); lane approved by LEAD 2026-10-19 |
| BE-46 | Marketplace: buyer slice (M20) | PC-1 | P2 | BE-03, BE-05 | M | todo | - | `be/BE-46-marketplace` | - | Contract merged 2026-10-19 (PR #14, be/BE-46-contract). Added 2026-10-19 (D53); lane approved by LEAD 2026-10-19 |
| BE-47 | Mohon Keluarga Angkat: student-side application (M21) | PC-1 | P2 | BE-03, BE-05 | S | todo | - | `be/BE-47-keluarga-angkat` | - | Contract merged 2026-10-19 (PR #15, be/BE-47-contract). Added 2026-10-19 (D53); lane approved by LEAD 2026-10-19 |
| BE-48 | Heatmap Topik Lemah read model (M25) | PC-2 | P1 | BE-12, BE-13, BE-08 | S | todo | - | `be/BE-48-heatmap-topik-lemah` | - | Contract merged 2026-10-19 (PR #5, be/BE-48-contract). Added 2026-10-19 (D53); lane approved by LEAD 2026-10-19 |

## Lead tasks (not BE cards)

| ID | Task | Needed by | Status |
|---|---|---|---|
| L0 | Create and push `feature/v2-backend`, protect it (OD-12), invite collaborators (OD-1), answer OD-1/3/5/19/20 (sync point S0) | everything | todo |
| L1 | V2-T31: `hybrid` API mode, `credentials: 'include'`, CSRF header, 401 handling in `HttpTransport` | BE-32 | todo |
| L2 | Produce the anonymised dump on the lead PC with the BE-35 tool; share out-of-band (OD-18) | BE-28 to BE-30 rehearsal | todo |
| L3 | Merge `feature/student-prototype` into `feature/v2-backend` at S3, S6, S8 and after each frontend milestone; announce in the change log | all lanes rebase | todo |
| L4 | Review and squash-merge PRs; contract PRs first; security review (`security-engineer`) for cards marked in Notes | all | todo |
| L5 | Per domain after merge: "switch Mnn to http" frontend PR | BE-32 and cut-over | todo |

## How to update this file

1. **When you start a card:** in the PR for that card (open it as a draft early), set your row to `in-progress`, fill Owner (`PC-2/S3`), and Branch if it differs from the planned name. Commit this edit on your own `be/<id>-<slug>` branch.
2. **When you open the PR for review:** set `review`, fill PR (`#123`), and put anything the next person needs in Notes (max one line; details go in the PR).
3. **When blocked:** set `blocked`, say on what (`waits BE-09`, `OD-20`) in Notes, open a GitHub issue labelled `blocked` or `question`, and take the next card in your lane list that is unblocked.
4. **Only edit your own rows.** Never touch another lane's rows, the Summary table or the Lead tasks table (the lead does). One row = one line; do not reflow the table.
5. **The lead merges:** the squash-merge of your PR brings your row edit in; the lead sets `done` after the merge, refreshes the Summary and appends a Change log line. If two PRs conflict on this file, keep both sides' row edits (rows are independent lines) and re-check the table renders.
6. Rebase daily (`git fetch origin && git rebase origin/feature/v2-backend`) so the table you edit is current.
7. Do not record dates of work in the table; the Change log carries dates.

## Change log

Newest first. The lead appends a line when a card merges, a decision is made or a sync point is reached. Sessions may add a line only for a blocker or a decision request that is not already in an issue.

| Date | Entry |
|---|---|
| 2026-10-19 | LEAD merged contract-only PRs: BE-13(#21) BE-43(#22) after code review (Approve). Append-only conflicts resolved; openapi.json regenerated; contract:check, contract tests and tsc green. Cards back to `todo` for their full implementation. |
| 2026-10-19 | LEAD merged contract-only PRs: BE-25(-) BE-16(#10) BE-44(#12) BE-46(#14) BE-47(#15) after code review (Approve). Append-only conflicts resolved; openapi.json regenerated; contract:check, contract tests and tsc green. Cards back to `todo` for their full implementation. |
| 2026-10-19 | LEAD merged contract-only PRs: BE-06(#4) BE-21(#6) BE-09(-) BE-18(-) BE-19(-) BE-42(-) after code review (Approve). Append-only conflicts resolved; openapi.json regenerated; contract:check, contract tests and tsc green. Cards back to `todo` for their full implementation. |
| 2026-10-19 | LEAD merged **BE-01** (NestJS 11 scaffold, error envelope, request id, config, logging redaction, health, non-root read-only image, backend CI with verify/docker/secret-scan, .gitleaks.toml). Review: Approve, no Blocker/Major. LEAD follow-ups in the merge: eslint ignores `apps/*/dist/**`; ids.ts comment now says legacy_source + legacy_id. Sync point S1 reached; BE-02 (stacked) continues. |
| 2026-10-19 | LEAD merged contract-only PRs: BE-22(-) BE-44(#12) BE-45(#13) BE-46(#14) BE-47(#15) BE-16(#10) after code review (Approve). Append-only conflicts resolved; openapi.json regenerated; contract:check, contract tests and tsc green. Cards back to `todo` for their full implementation. |
| 2026-10-19 | LEAD merged contract-only PRs: BE-08(-) BE-12(-) BE-17(-) after code review (Approve). Append-only conflicts resolved; openapi.json regenerated; contract:check, contract tests and tsc green. Cards back to `todo` for their full implementation. |
| 2026-10-19 | LEAD merged contract-only PRs: BE-10(#7) BE-15(#8) BE-41(#9) BE-48(#5) after code review (Approve). Append-only conflicts resolved; openapi.json regenerated; contract:check, contract tests and tsc green. Cards back to `todo` for their full implementation. |
| 2026-10-19 | LEAD merged contract-only PRs #1 BE-11 (wallet), #2 BE-24 (content, support), #3 BE-23 (gamification, rewards) after code review (Approve, no Blocker/Major). openapi.ts/index.ts conflicts resolved append-only; openapi.json regenerated; contract:check ok, packages/contract 182 tests pass. Cards back to `todo` for their full implementation. |
| 2026-10-19 | LEAD approved the lanes and priorities of BE-41 to BE-48: BE-41 PC-3 P1; BE-42, BE-46, BE-47 PC-1 P2; BE-43 PC-5 P2; BE-48 PC-2 P1; BE-44 and BE-45 in the new lane PC-7 "Games and competitions" P2. Summary counts unchanged (P0 13, P1 22, P2 13). |
| 2026-10-19 | Cards BE-41 to BE-48 added (D53(a): every module reachable in the prototype is B1): M06 SPM hub, M07 PKSK, M13 Cikgu Alesa, M16 battle and games (two cards), M20 buyer slice, M21 student side, M25 heatmap. Lanes and priorities are proposals (new lane PC-7 for M16); the LEAD confirms. |
| 2026-10-19 | Programme created: 40 cards (BE-34 to BE-40 added: migration kit, anonymiser + fixtures, AI extraction service, intake files + OCR, intake workflow, paper builder, intake dashboard), tracker, sessions plan and agent kickoff prompts written. All cards `todo`. Waiting for sync point S0. |
