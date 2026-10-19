# Backend task cards (BE-01 to BE-48)

One card per task. Each card is self-contained: goal, inputs (exact paths), outputs, endpoints, tables, testable acceptance criteria, test commands, dependencies, size, and a **Prompt for Claude Code** block to paste as-is. Read [../../architecture/v2-backend-plan.md](../../architecture/v2-backend-plan.md) once before the first card. Sizes: S up to 0.5 day, M 1 to 2 days, L 3 to 5 days (one developer or one agent session).

Requirements and handbook: every card is traced to a requirement ID (BE-FR / BE-NFR / BE-MIG / BE-OPS) in [../../requirements/v2-backend-urs.md](../../requirements/v2-backend-urs.md) (section 9.2 lists the requirements per card); how to write the code is in [../backend-dev-guide.md](../backend-dev-guide.md).

Programme view: status per card is in [../backend-tracker.md](../backend-tracker.md); lanes, order and sync points are in [../sessions.md](../sessions.md); paste-ready agent prompts per lane are in [../agent-kickoff/](../agent-kickoff/README.md). BE-34 to BE-40 were added on 2026-10-19 (migration-first design and the D52 SPM intake / paper builder); BE-41 to BE-48 on 2026-10-19 (D53(a): every module reachable in the prototype is B1). Lanes of BE-41 to BE-48 approved by the LEAD 2026-10-19: BE-41 PC-3 P1; BE-42, BE-46, BE-47 PC-1 P2; BE-43 PC-5 P2; BE-48 PC-2 P1; BE-44, BE-45 new lane PC-7 "Games and competitions" P2.

Waves: 0 foundation, 1 identity and reference data, 2 learning loop, 3 Bijak attempts / teacher / reports / economy, 4 aggregates and integration, M = migration stream (independent of the API lanes, blocked only by OD-2 and OD-10).

| ID | Title | Size | Wave | Depends on | Can run in parallel with |
|---|---|---|---|---|---|
| [BE-01](BE-01-scaffold-ci.md) | Scaffold NestJS app + backend CI | M | 0 | none | none (first) |
| [BE-02](BE-02-db-orm.md) | PostgreSQL service, Prisma, test harness | M | 0 | BE-01 | BE-14, BE-34 (after BE-02 merges) |
| [BE-03](BE-03-auth-session.md) | Auth, session, roles, scope, Mod Pelajar | L | 0 | BE-02 | BE-14, BE-34 |
| [BE-14](BE-14-exam-core-package.md) | Shared `@pp/exam-core` package (needs OD-5) | M | 0/1 | BE-01 | BE-02, BE-03 and all wave 1 |
| [BE-04](BE-04-file-storage.md) | File storage + uploads | S | 1 | BE-03 | BE-05, BE-08, BE-11 |
| [BE-05](BE-05-users-schools.md) | Users and schools (M02 core) | L | 1 | BE-03 | BE-04, BE-08, BE-11 |
| [BE-08](BE-08-curriculum.md) | Curriculum (M03) | M | 1 | BE-03 | BE-04, BE-05, BE-11 |
| [BE-11](BE-11-wallet-streak-core.md) | Wallet, ledger, streak core (M14 core) | M | 1 | BE-03 | BE-04, BE-05, BE-08 |
| [BE-06](BE-06-account-notifications.md) | Account basics, notifications (M01) | M | 1 | BE-03, BE-04, BE-05 | BE-08, BE-11, BE-25 |
| [BE-07](BE-07-seed-core-accounts.md) | Seed: core population | S | 1 | BE-05 | BE-08, BE-11 |
| [BE-24](BE-24-content-support.md) | Content + support tickets (M09, M22) | M | 1 | BE-03, BE-04, BE-05, BE-06 | BE-08, BE-11, BE-25 |
| [BE-25](BE-25-subscriptions-parents.md) | Subscriptions, packages, parent invites (M02 rest) | M | 1 | BE-05 | BE-06, BE-08, BE-11 |
| [BE-09](BE-09-question-bank-core.md) | Question bank core (M04) | L | 2 | BE-08 | BE-11, BE-14, BE-17 |
| [BE-10](BE-10-question-workflow.md) | Question workflow, reports, imports (M04) | M | 2 | BE-09 | BE-12, BE-15, BE-17 |
| [BE-12](BE-12-practice-sessions.md) | Practice sessions + answer log (M05 write) | L | 2 | BE-09, BE-11, BE-25 | BE-10, BE-15, BE-17 |
| [BE-13](BE-13-practice-reads.md) | Practice read models (M05 reads) | M | 2 | BE-12 | BE-15, BE-16, BE-17 |
| [BE-15](BE-15-bijak-papers.md) | Bijak SPM papers, blueprints, generation | M | 2 | BE-09, BE-14 | BE-10, BE-12, BE-17 |
| [BE-17](BE-17-classes-teacher.md) | Classes and teacher basics (M10 A) | M | 2 | BE-05, BE-08 | BE-09, BE-10, BE-12, BE-15 |
| [BE-16](BE-16-bijak-attempts.md) | Bijak SPM attempts, timer, marking, results | L | 3 | BE-15, BE-14, BE-04, BE-11 | BE-18, BE-19, BE-23 |
| [BE-18](BE-18-missions-remedial-sets.md) | Missions, remedial, question sets (M10 B) | M | 3 | BE-17, BE-09, BE-12 | BE-16, BE-19, BE-23 |
| [BE-19](BE-19-student-performance.md) | Student performance read models (M08) | L | 3 | BE-12, BE-17 | BE-16, BE-18, BE-23 |
| [BE-23](BE-23-gamification-shop.md) | Gamification economy + rewards shop (M14, M15) | L | 3 | BE-11, BE-12 | BE-16, BE-18, BE-19 |
| [BE-20](BE-20-teacher-analytics-kirkpatrick.md) | Teacher analytics + Kirkpatrick (M11, M12) | L | 4 | BE-19 | BE-21, BE-22, BE-26 |
| [BE-21](BE-21-school-admin.md) | School admin (M27) | L | 4 | BE-05, BE-17, BE-19 | BE-20, BE-22, BE-26 |
| [BE-22](BE-22-command-center-admin.md) | Command Center + admin aggregates (M17, M10) | L | 4 | BE-17, BE-19, BE-23 | BE-20, BE-21, BE-26 |
| [BE-26](BE-26-seed-poc-profile.md) | Seed: PoC profile across domains | M | 4 | BE-07, BE-12, BE-16, BE-17, BE-19, BE-23, BE-24 | BE-20, BE-21, BE-22 |
| [BE-31](BE-31-conformance-suite.md) | Conformance suite + OpenAPI breaking-change gate | M | starts after BE-03, grows | BE-03 | all domain cards |
| [BE-32](BE-32-http-switch-e2e.md) | Compose stack, nginx proxy, e2e against real API (joint with lead) | M | 4 | BE-03, BE-07, BE-31 (+ lead V2-T31) | domain cards |
| [BE-33](BE-33-hardening-release.md) | Security hardening, ops runbook | M | 4 | BE-32 | BE-30 |
| [BE-27](BE-27-migration-staging-profiling.md) | .cloud staging loader + profiling (read-only) | M | M | BE-02, BE-34 + OD-2 | every API card |
| [BE-28](BE-28-migration-etl-core.md) | ETL: reference data, identity, classes | L | M | BE-27, BE-05, BE-08, BE-17, BE-25 + OD-10 | API cards |
| [BE-29](BE-29-migration-etl-activity.md) | ETL: activity, wallet, content (snapshot approach) | L | M | BE-28, BE-11, BE-12, BE-16, BE-23, BE-24 | API cards |
| [BE-30](BE-30-migration-reconcile-rehearsal.md) | Reconciliation, rehearsal, cutover scripts | M | M | BE-29, BE-35 | BE-33 |
| [BE-34](BE-34-migration-kit.md) | Migration kit: legacy-column lint, ETL control tables, upsert helper, dry-run runner | M | 0/1 | BE-02 | BE-03, BE-04, BE-05 |
| [BE-35](BE-35-anonymiser-fixtures.md) | Anonymiser tool + synthetic .cloud fixture generator | M | M | BE-27 | API cards, BE-28 |
| [BE-36](BE-36-ai-extraction-service.md) | AI extraction service (provider adapters, redaction, cost log, budget) | M | 1/2 | BE-03, BE-06 | BE-04, BE-05, BE-08, BE-37 |
| [BE-37](BE-37-intake-files-ocr.md) | Intake files, page images, figure crops, server OCR, job runner | L | 2 | BE-04 | BE-36, BE-08, BE-09 |
| [BE-38](BE-38-intake-workflow.md) | Intake batches, review workflow, accept-to-Draf, duplicates | L | 3 | BE-09, BE-10, BE-36, BE-37 | BE-39, BE-12, BE-16 |
| [BE-39](BE-39-paper-builder-blueprints.md) | Paper builder + blueprint admin (write side of M28 papers) | L | 3 | BE-15, BE-10 | BE-38, BE-16 |
| [BE-40](BE-40-intake-dashboard-ai-usage.md) | Intake dashboard, AI usage and budget endpoints | S | 4 | BE-36, BE-38 | BE-20, BE-21, BE-22 |
| [BE-41](BE-41-spm-hub.md) | SPM hub: Tahun Lepas, Latih Tubi, Tracking A, Subjektif, mock exams (M06) | M | 3 | BE-03, BE-08, BE-09, BE-12, BE-13 | BE-16, BE-18, BE-19, BE-23, BE-42 |
| [BE-42](BE-42-pksk.md) | PKSK: domains, practice, exam, access grants, admin questions (M07) | L | 3 | BE-03, BE-05, BE-09, BE-10, BE-12, BE-25 | BE-16, BE-18, BE-19, BE-23, BE-41 |
| [BE-43](BE-43-cikgu-alesa.md) | Cikgu Alesa: chat, RPH, essay markings, PBD tags (M13) | L | 4 | BE-36, BE-03, BE-05, BE-08, BE-12, BE-17 | BE-20, BE-21, BE-22, BE-40, BE-46, BE-47, BE-48 |
| [BE-44](BE-44-battle.md) | Battle arena, standings and tournaments (M16 part 1) | L | 4 | BE-03, BE-05, BE-08, BE-09, BE-12, BE-23 | BE-45, BE-20, BE-21, BE-22, BE-26 |
| [BE-45](BE-45-papan-bijak-games-hub.md) | Permainan hub, Papan Bijak, room and solo games, leagues, Sekolah Bersaing (M16 part 2) | L | 4 | BE-03, BE-05, BE-08, BE-09, BE-11, BE-13, BE-23 (BE-44 stubbed) | BE-44, BE-20, BE-21, BE-22, BE-26 |
| [BE-46](BE-46-marketplace.md) | Marketplace: buyer slice (M20) | M | 3 | BE-03, BE-05 | BE-16, BE-18, BE-19, BE-23, BE-47, BE-48 |
| [BE-47](BE-47-keluarga-angkat.md) | Mohon Keluarga Angkat: student-side application (M21) | S | 3 | BE-03, BE-05 | BE-16, BE-18, BE-19, BE-23, BE-46, BE-48 |
| [BE-48](BE-48-heatmap-topik-lemah.md) | Heatmap Topik Lemah read model (M25) | S | 3 | BE-12, BE-13, BE-08 | BE-15, BE-16, BE-17, BE-46, BE-47 |

Totals: 48 cards. Sizes: S 5, M 24, L 19.

## Parallel lanes (superseded by [../sessions.md](../sessions.md): seven lanes (PC-7 "Games and competitions" opened 2026-10-19) plus the lead lane; the list below is the original one-collaborator view)

1. **Critical path:** BE-01, BE-02, BE-03, then BE-05, BE-09 (via BE-08), BE-12, BE-13, BE-19, then the wave 4 reports.
2. **Bijak lane (starts at BE-01):** BE-14, then BE-15 (after BE-09), BE-16.
3. **Identity lane:** BE-04, BE-06, BE-07, BE-25, BE-24 (small, mostly independent after BE-03).
4. **Migration lane:** BE-27 to BE-30 (independent; blocked by OD-2/OD-10 only for real data).
5. **Always-on:** BE-31 (add scenarios with every domain), BE-32 (grows per domain).

Never run two sessions that edit the same `apps/api/prisma/schema/<module>.prisma` at once (plan section 9: one migration PR per owner module at a time).

## Wave 4+ backlog and routes not built by decision

Since D53(a) (2026-10-19) every module reachable in the prototype is B1: the former backlog items M06, M07, M13, M16, M20, M21 (student side) and M25 are cards BE-41 to BE-48, and the M09 student Audio KBAT play is in BE-24. What is left:

| Item | Mock routes (count) | Notes |
|---|---|---|
| Not built by user decision (2026-10-19, D53(b) to (g)) | UD-2: the 2 impersonation routes (BE-05, BE-21); UD-3: the 3 parent approval routes `/api/parent/hadiah-approvals*` | the mock routes are intentionally not ported; M18 Amaran (4 routes) is built by BE-21 (UD-4) |
| Not in B1 (D53/OWN-10, D28c) | the teacher economy: 6 teacher routes and 7 admin routes of M14 | backlog; the frontend hides the entry points |
| Sistem stores (`audit_logs` UI, `settings`, `feature_flags`, `ai_usage_logs`), Kewangan (`payments`, `invoices`, `dunning_logs`, `packages`) | new | V2-T27/V2-T28 in `docs/architecture/v2-frontend.md` |

## PR description template (copy into every PR)

```
## Card
BE-xx title (link to the card)

## What changed
- ...

## Endpoints / tables
- ...

## Contract
- Contract commit: <sha>; `npm run contract:check` output pasted below

## Test evidence (real output)
npm run be:verify -> ...

## Deviations from mock / contract / docs
- none | list (also appended to docs/architecture/v2-backend-deviations.md)

## Open questions for the lead
- none | list

## Checklist
- [ ] No secrets, no real names, no personal data in code, seeds, logs, fixtures
- [ ] Scope/role tests included
- [ ] Definition of Done (plan section 10) met
- [ ] Migration-first checklist (plan section 14.9) done; mapping-matrix row added/updated
- [ ] My row(s) in `docs/plan/backend-tracker.md` updated (status, branch, PR, notes)
```
