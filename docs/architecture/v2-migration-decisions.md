# v2 migration decisions: one-pass approval (OD-10, OD-21, OD-22, OD-23)

- **Slug:** `v2-migration-decisions`
- **Status:** Decided: LEAD, 21 Oct 2026 (all defaults), on issue #109. Q8 was not answered and stays as implemented in BE-11. The text below is kept as the decision history; the follow-through is in section 4.
- **Date:** 2026-10-21
- **Author:** AM1-3 (half AM), item MIG-03/06. Docs only, no code.
- **Sources:** [v2-data-migration.md](v2-data-migration.md) (section 7, lines 402-418), [v2-backend-plan.md](v2-backend-plan.md) (section 13 OD table, 14.7 matrix), [v2-data-model.md](v2-data-model.md) (GAP-6, GAP-15, GAP-16), [v2-migration-runbook.md](v2-migration-runbook.md), [v2-backend-deviations.md](v2-backend-deviations.md), [TRACKER](../TRACKER.md) (D28 to D31, D53, D60 to D65), [AGENT-SYNC](../plan/AGENT-SYNC.md), cards [BE-27](../plan/backend-tasks/BE-27-migration-staging-profiling.md), [BE-28](../plan/backend-tasks/BE-28-migration-etl-core.md), [BE-29](../plan/backend-tasks/BE-29-migration-etl-activity.md), [BE-30](../plan/backend-tasks/BE-30-migration-reconcile-rehearsal.md), [BE-35](../plan/backend-tasks/BE-35-anonymiser-fixtures.md), and the code under `apps/api` at `origin/feature/v2-backend` (tip `23c98226`).

**Why now.** D61 (TRACKER line 66) makes the .cloud migration a requirement for the 30 Oct go-live; the rehearsal target is 25 Oct. BE-28 is merged, BE-29 is draft/WIP and not on the tip, BE-30 is not started ([go-live doc](../ops/go-live-bijak-spm.md) section 2.3). BE-28 and BE-29 both say OD-10 must be answered before an `--apply` on real data. The third, fourth and fifth open items (OD-21, OD-22, OD-23) are the migration-shape gaps GAP-6, GAP-15 and GAP-16.

**How to answer (history).** Reply on issue #109 with one word per row of the summary table, for example `Q1 A, Q2 A, Q3 A, Q4 B, ... OD-21 C, OD-22 A, OD-23 B`. Or reply `all defaults` (the "Proposed default" column) or `all recommended` (the "Recommendation" column). Any row you do not mention keeps its recommendation. The LEAD replied `all defaults` on 21 Oct, so the "Decision" column is binding.

**Facts that are unknown.** Production data has not been profiled. Where an answer depends on real values (role strings, `target` values of notifications, row counts), this document says "unknown until the BE-27 profile runs on the dump" and the proposed answer is safe under both outcomes.

**Size legend** (relative, as in the cards): S = a few hours, M = about a day, L = several days.

## 1. Summary table

| ID | Question (one line) | Options | Proposed default | Recommendation | Answer word | Decision |
|---|---|---|---|---|---|---|
| Q1 | Is the role set exactly the seven .cloud codes? | A map the seven, reject unknown to a review list. B add extra v2 roles (for example a JPN role). | A | A | A / B | **A** (LEAD, 21 Oct) |
| Q2 | Duplicate people (roster plus self-registered): merge or keep both? | A keep both, report duplicates. B auto-merge. | A | A | A / B | **A** (LEAD, 21 Oct) |
| Q3 | How is a `pegawai_ppd` scoped; is there a JPN role? | A `user_scopes`, PPD scope derived from the officer's school, data owner checks the report. B data owner supplies each scope before load. | A | A | A / B | **A** (LEAD, 21 Oct) |
| Q4 | Teacher question sets and revision queue (question-bound). | A keep set headers as "needs rebuild". B drop the sets (queue is dropped in both). | A | **B** (header cannot load today) | A / B | **A** (LEAD, 21 Oct) |
| Q5 | Keep students' structured and exam answers (free text, AI grade)? | A scores only. B keep answers. C drop these attempts entirely. | A | A | A / B / C | **A** (LEAD, 21 Oct) |
| Q6 | How is user subscription status derived? | A school subscription plus paid payments plus PKSK access. B interim rule already in code: school subscription, complimentary, PKSK; payments leg after go-live. | A | **B** (payments tables are out of B1) | A / B | **A** (LEAD, 21 Oct) |
| Q7 | Migrate sensitive records (mood, psychometric, alerts, interventions, foster, faith)? | A default list. B = A and also hold back `interventions` and `feedback.comment`. C migrate all. | A | **B** (data minimisation, less work) | A / B / C | **A** (LEAD, 21 Oct) |
| Q9 | Keep `question_reports` and `question_submissions` history? | A export open reports to a file, drop the rest. B drop all. | A | **B** | A / B | **A** (LEAD, 21 Oct) |
| Q10 | Do teachers have wallet rows; is a cash-out feature present? | A profile first, drop if absent. B student wallets only, always; report teacher rows by count. | A | **B** (teacher economy is backlog, D53) | A / B | **A** (LEAD, 21 Oct) |
| Q11 | How do we get a read-only, access-controlled dump? | A schema and counts first, then an anonymised dump. B anonymised dump only. C fixtures only. | A | A | A / B / C | **A** (LEAD, 21 Oct) |
| Q12 | Retention of `archive_cloud`; are the roster JSON files real data? | A 12 months, all archive tables. B 12 months, five user-linked tables left out. C no archive. Roster files purged in all options. | A | **B** (minors' ids not needed for backfill) | A / B / C | **A** (LEAD, 21 Oct) |
| Q13 | Keep user-created leagues (.cloud) or only school leagues? | A keep both. B migrate no leagues at go-live. | A | **B** (new feature scope, no card) | A / B | **A** (LEAD, 21 Oct) |
| OD-21 | Notification broadcasts (GAP-6) | A fan out per-user rows. B `notification_broadcasts` plus `notification_reads`. C do not load. | C (plan default: not loaded until decided) | C; if ever wanted, A not B | A / B / C | **C** (LEAD, 21 Oct) |
| OD-22 | School subscription `quota` (GAP-15) | A `quota` is `student_quota`, `question_limit` null (already applied). B `student_quota` nullable. | A (supersedes the plan default B, see section 3) | A | A / B | **A** (LEAD, 21 Oct) |
| OD-23 | `ai_usage_logs` tokens (GAP-16) | A load, `tokens` to `tokens_in`. B do not load at go-live. | B (plan default: loader optional) | B | A / B | **B** (LEAD, 21 Oct) |

Not in this table: Q8 (see section 6) and the two AM-10 operating questions OD-18 and DT-1 (see section 7).

## 2. OD-10: migration questions

### Q1. Role set

**Decided:** A (LEAD, 21 Oct).

- **Context.** The seven codes are from reference-repo docs and are marked "to profile" ([v2-data-migration.md](v2-data-migration.md) section 4.1, line 264; Q1 at line 406). Production values are unknown until the BE-27 profile runs on the dump.
- **Options.** A: map the seven, send any other value to a review list (`etl_rejects`, reason `UNKNOWN_ENUM`). B: also add v2 roles for any extra production value (for example `jpn_officer`): changes the role enum in `packages/contract/**` (LEAD-only, flagged), the `user_roles` check constraint, auth and scope code: L, and nothing in the 30 Oct scope needs it.
- **Code today.** Done. `ROLE_MAP` in `apps/api/src/migration/transform/enums.ts:9-17` maps the seven (`pegawai_ppd` to `ppd_officer`); `transform/users.ts:90-93` rejects any other value with `UNKNOWN_ENUM`, logging the offending enum value only. v2 allows exactly seven roles (check in `prisma/migrations/0002_identity`), and the auth module states there is no `jpn_officer` role (`modules/auth/auth.config.ts:15`). The reject is counted in the BE-28 reconciliation.
- **Default and recommendation.** A. Safe under both outcomes: an unexpected role costs a rejected account on the review list, never a guessed role.
- **If approved.** Mark Q1 answered in [v2-data-migration.md](v2-data-migration.md) section 7; remove Q1 from BE-28's open question 1; MIG-07 rehearsal: the data owner reads the review list (ids and counts only) after the first dry-run.

### Q2. Duplicate people

**Decided:** A (LEAD, 21 Oct).

- **Context.** [v2-data-migration.md](v2-data-migration.md) Q2 (line 407), risk "Duplicates" (line 369).
- **Options.** A: keep both accounts, report duplicates for manual merge. B: auto-merge by e-mail or IC hash: needs merge rules and also merging each account's attempts, wallet and class rows; wrong merges would mix minors' records: L, not recommended.
- **Code today.** Done, with one caveat. `load/identity-steps.ts:114-153` keeps both accounts. Because v2 enforces unique `lower(email)` and unique `(school_id, lower(username))` (plan 14.7, row "Identity tables, as built"), the later account loses the colliding e-mail or username and its id is listed (`load/command.ts:42`, notes `duplicate_email`, `duplicate_username`). That account may therefore have no login identifier until an admin fixes it or issues a reset.
- **Default and recommendation.** A. The caveat is a data-owner task after the dry-run, not code.
- **If approved.** Add to the rehearsal checklist (BE-30 runbook section): the data owner reviews the duplicate id lists and decides which accounts need a manual login fix before 30 Oct.

### Q3. PPD scope and JPN

**Decided:** A (LEAD, 21 Oct).

- **Context.** D31(a) ([TRACKER](../TRACKER.md) line 36): PPD follows the old model, scope derived from the officer's school. [v2-data-migration.md](v2-data-migration.md) X6 (line 258), Q3 (line 408).
- **Options.** A: scope rows in `user_scopes` (admin national, PPD district derived from the officer's school); unscoped officers are listed by id; the data owner confirms the list after the dry-run; fixes use the existing admin function. B: the data owner supplies every officer's scope before load (new input file and loader): S to M, adds a human step on the critical path.
- **Code today.** Done for A. `transform/users.ts:129-138`: admin gets a national scope; a `ppd_officer` gets a district scope from the school's state and district, otherwise `ppdUnscoped` and the id goes to the report (`ppd_officer_without_scope`). A scope can be set or cleared afterwards through `UsersRepository.setPpdScope` (`modules/users/users.repository.ts:740`). **Officer without a scope row (verified):** at login `modules/auth/session-view.ts` (`buildGrants`, lines 113-125) uses the stored row, else `derivedScope` (lines 93-104): a `ppd_officer` gets `districtScope(school)` (lines 49-58, 100-101) when the school has a district, otherwise no scope and the session is refused (fail-closed). One gap remains: a school with a district but **no state** gives a district scope without `stateCode`, and `common/scope/scope-filter.ts:47-49` filters district scopes on the district string only, so such an officer would see every school with the same district string in any state. The migration lists the officer (`ppd_officer_without_scope`) but does not stop the session. Mitigation before `--apply`: the BE-27 profile counts schools with a district and no state and district strings that repeat across states; the data owner fixes or confirms each listed officer through `UsersRepository.setPpdScope`. A code fix (refuse a derived district scope without a state) is a PC-1 follow-up for the LEAD to schedule; it is personal-data scope and is not chosen here. A JPN role does not exist in v2; a production JPN-like value would land on the Q1 review list.
- **Default and recommendation.** A.
- **If approved.** Mark Q3 answered; BE-28 AC4 already matches. Rehearsal checklist: the data owner checks the unscoped list and the district values of PPD officers.

### Q4. Teacher question sets

**Decided:** A (LEAD, 21 Oct).

- **Context.** Items are question-bound and questions are not migrated (D29a); [v2-data-migration.md](v2-data-migration.md) section 3.3 item 4 (line 237), Q4 (line 409).
- **Options.** A: keep the set header with `needs_rebuild = true` (the default). B: drop the sets; the report lists the count as "not migrated (Q4)". The revision queue (`review_schedules`) is dropped in both (plan 14.7, row "Revision schedule").
- **Code today.** Not implemented. The plan matrix says ETL is "none until a card adds it (GAP-11)" (plan line 581), and BE-29's table list omits `question_sets` ([BE-29](../plan/backend-tasks/BE-29-migration-etl-activity.md) line 53). The schema has `needs_rebuild` (`prisma/schema/classes.prisma:184-200`), **but `question_sets.classroom_id` is NOT NULL**, while a .cloud set has teacher, title, subject, level and status and no classroom ([v2-data-migration.md](v2-data-migration.md) line 156). A header cannot load as the schema stands.
- **Cost of A.** A migration making `classroom_id` nullable (range 0070-0099) on a table owned by BE-18, which sits in half AZ's lane (AGENT-SYNC rule 5: a cross-half request), null handling in the BE-18 services, plus a new BE-29 step: M to L, on the critical path. Deriving a classroom by a rule would be an invented rule.
- **Default and recommendation.** Default A. **Recommend B.** A is not loadable without a cross-half schema change, and an empty "needs rebuild" header adds little because the teacher must rebuild the set either way. No PDPA difference.
- **If approved (B).** Plan 14.7 row "Teacher question set": change to "drop (Q4)"; BE-29 recon lists `question_sets` as not migrated; no schema work. If A: LEAD files a cross-half request to BE-18's owner and a card for the nullable column.

### Q5. Students' structured and exam answers

**Decided:** A (LEAD, 21 Oct).

- **Context.** These contain free-text student writing and AI grading; they need the question stem to make sense ([v2-data-migration.md](v2-data-migration.md) section 3.3 item 4, Q5 at line 410). Students are minors.
- **Options.** A: scores only (exam attempt headers and scores; no answer text, no AI feedback). B: keep answers and AI feedback. C: drop these attempts entirely, scores included (loses exam history that users see).
- **Code today.** Not implemented (BE-29 not on the tip). The design is already in the matrix: `part_responses` dropped (plan line 560), `structured_attempt_answers` dropped (line 556), `exam_attempts` header migrates with `paper_id` null (`prisma/schema/bijak-attempts.prisma:12`; matrix line 558). BE-29 AC2 requires a test that no free-text column reaches a v2 table. **Note:** `structured_attempts.question_id` and `question_version_no` are NOT NULL (`prisma/schema/practice.prisma:284-289`), so structured attempt headers cannot load without a nullable-column migration on a table owned by BE-13 (half AZ lane). At go-live, A therefore loads Bijak exam attempts and scores; structured attempt headers are reported as not loaded unless the LEAD asks for that migration.
- **Default and recommendation.** A. It is also the PDPA-minimal choice that still keeps exam history.
- **If approved.** BE-29 AC2 stays as written; plan matrix row "Structured attempt" gets a note "not loaded at go-live (question_id NOT NULL)" or a follow-up card if the LEAD wants the headers.

### Q6. Subscription status

**Decided:** A (LEAD, 21 Oct).

- **Context.** v2 has no user-level subscription column; .cloud derives access from payments, packages, school subscriptions, PKSK access and `is_complimentary` ([v2-data-migration.md](v2-data-migration.md) line 268, Q6 at line 411).
- **Options.** A: the three-leg derivation of the default, including the latest paid, unexpired payment. Needs `payments` and `packages` tables, which are "Out of B1" (plan line 621; `packages` itself is open as OD-27), plus a loader and a change to the subscription service: L, new migration, not realistic before 30 Oct. B: the interim rule already in code, school subscription plus a `comp_students` row (which BE-28 does not create, see the risks below, so migrated complimentary students are not covered unless an expiry date is supplied), with PKSK served by `PkskAccessService`; the payments leg joins after go-live: no work.
- **Code today.** B is live. `modules/subscriptions/subscription.service.ts:22-31` and the deviations rows 128, 136 and 482 ([v2-backend-deviations.md](v2-backend-deviations.md)) say Q6 stays open and the payments leg is absent. **Two risks, both unknown until the BE-27 profile:** (1) individually paying users without a school subscription fall back to the 50-question trial; the profile must count users with a paid, unexpired payment and no active school subscription; (2) `users.is_complimentary` is copied, but `comp_students.package_expires_on` is NOT NULL and has no .cloud source (plan matrix line 548), so BE-28 creates no `comp_students` rows and migrated complimentary students are not "subscribed" until the data owner supplies an expiry rule (a date) or an admin registers them.
- **Default and recommendation.** Default A. **Recommend B** for go-live, with the profile counts above as a go/no-go input, and A as a post-go-live card. If you want complimentary students covered at go-live, add a date after your answer, for example `Q6 B, comp-expiry 2026-12-31`; with no date they stay on trial.
- **If approved (A, decided).** A card adds the `payments`/`packages` loader and the payments leg in `SubscriptionService` (new migration in 0070-0089, cross-checked with OD-27); until it is rehearsed green, the interim rule stays in force and the LEAD fallback in section 4 applies. Complimentary students still need an expiry rule from the data owner (risk 2 above).
- **If approved (B, history).** [v2-data-migration.md](v2-data-migration.md) Q6 gets "interim rule, payments leg after go-live"; deviations row 136 becomes "decided"; BE-28 report prints the two counts; rehearsal checklist gets the profile counts as a criterion.

### Q7. Sensitive records

**Decided:** A (LEAD, 21 Oct).

- **Context.** Mood, psychometric, wellbeing alerts, interventions, foster applications and `faith` are sensitive personal data of mostly minors ([v2-data-migration.md](v2-data-migration.md) section 5, "PII volume" and "Faith field"; Q7 at line 412).
- **Options.** A: the default: do not migrate `faith`, psychometric results or wellbeing alerts; migrate the others only if a v2 feature exists. B: A, and also hold back `interventions` (welfare notes and mood values about students) and the free-text `feedback.comment` (the `feedback` rows and their structured scores still load, with `comment` null); both can be loaded after go-live if the data owner asks. C: migrate everything: against PDPA minimisation, not recommended.
- **Code today.** `faith` and `google_id` are never read by the user transform (`transform/users.ts`; listed as dropped at `load/index.ts:61`). Mood check-ins, psychometric and wellbeing alerts have no v2 table and BE-29 AC5 forbids reading them (plan lines 575, 621). Foster applications are not loaded in B1 (plan lines 613, 624). `interventions` and `feedback` have v2 tables (`prisma/schema/reports.prisma:57-70`) and are BE-29 candidates "only if the feature exists" ([BE-29](../plan/backend-tasks/BE-29-migration-etl-activity.md) line 53), not yet implemented.
- **Default and recommendation.** Default A. **Recommend B**: welfare notes about minors are not needed to run the 30 Oct Bijak SPM go-live, and leaving two steps out of BE-29 saves work.
- **If approved (B, history; A was decided).** Plan 14.7 row "Intervention": ETL card becomes "none at go-live (Q7)"; row "Feedback": load the rows with `comment` set to null; BE-29 AC5 gets `interventions` and `feedback.comment` added to the "never read" test.

### Q9. Question reports and submissions

**Decided:** A (LEAD, 21 Oct).

- **Context.** Both refer to old question ids that do not exist in the new bank ([v2-data-migration.md](v2-data-migration.md) line 211, Q9 at line 414). `question_submissions` is already dropped (plan line 616, OWN-1).
- **Options.** A: export open reports to a file for the content team, drop the rest. B: drop all; open reports stay in staging only until the dump is deleted (7 days at most, [runbook](v2-migration-runbook.md) section 0 rule 4).
- **Code today.** Not implemented; no export script exists.
- **Cost and impact.** A needs a small export script and a new file that must follow runbook retention; it is worth little because the reported items are old OCR output that the new intake replaces. Under A the file should carry no reporter id (the tables have a `user_id`). A is S, B is zero.
- **Default and recommendation.** Default A. **Recommend B.** If you choose A, strip the reporter id.
- **If approved (B).** Plan 14.7 row "Question bank (all)" note: reports and submissions dropped; BE-29 recon lists them as not migrated.

### Q10. Teacher wallets and cash-out

**Decided:** A (LEAD, 21 Oct).

- **Context.** [v2-data-migration.md](v2-data-migration.md) Q10 (line 415), section 4.9. D28(c) puts contributor rewards out of scope. Teacher economy is backlog by owner decision (data model OWN-10, [v2-data-model.md](v2-data-model.md) line 116; plan row "Teacher badge", line 570). Plan OD-8 (line 417) still says "keep teacher wallets as in the mock until profiling", which predates OWN-10.
- **Options.** A: profile first; drop teacher wallets if absent (the default leaves the "present" case undecided). B: load wallets and ledger rows of migrated students only; teacher rows are reported by count and not loaded. Same result as A when no teacher rows exist.
- **Code today.** Not implemented (BE-29). The v2 `wallets` table is keyed by `user_id` only (`prisma/schema/wallet.prisma:48`) and BE-11 builds the student economy only ([BE-11](../plan/backend-tasks/BE-11-wallet-streak-core.md) line 116). Whether teacher rows or a cash-out feature exist is unknown until the BE-27 profile.
- **Default and recommendation.** Default A. **Recommend B**: it removes the open "present" case and a loaded teacher wallet would have no screen.
- **If approved (B).** Plan OD-8 text: teacher wallets "not migrated (OWN-10)"; BE-29 wallet and ledger steps filter by migrated role `student`.

### Q11. Dump access

**Decided:** A (LEAD, 21 Oct).

- **Context.** OD-2 and OD-18 ([plan](v2-backend-plan.md) lines 411 and 427): live credentials are never shared; the human who holds the read-only .cloud access (OD-18: the LEAD, on the LEAD's PC) produces the dump. The runbook records the confirmed hand-over format `pp-staging-dump/1` plus a PostgreSQL restore ([runbook](v2-migration-runbook.md) section 11), and the dump is anonymised by the BE-35 tool. That is the next item, AM-10 (dump pipeline).
- **Options.** A: first a schema-and-counts export (aggregates only), then the anonymised dump through the BE-35 anonymiser. B: the anonymised dump only. C: fixtures only, no real dump: not compatible with D61, because enum values, orphans and real role values cannot be learned.
- **Code today.** Done. `staging:load`, `staging:profile`, `anonymise:run`, `anonymise:scan` and `fixtures:generate` exist ([runbook](v2-migration-runbook.md) sections 2, 8, 9); the anonymiser is default-deny per column and the key is new for every rehearsal. The schema export in A is needed anyway: the staging table spec "will be completed after a real schema export" (runbook section 7 item 4) and an unknown column fails the load.
- **Default and recommendation.** A. It costs minutes in the same sitting and protects the 25 Oct rehearsal from a column mismatch.
- **Flagged, not asked.** An anonymised dump is for rehearsals only: `assertNotSyntheticInProduction` (`load/index.ts:72`) refuses to migrate it in production. The 30 Oct apply needs real data in a staging schema loaded by the human who holds access. OD-2 and OD-18 as written cover the rehearsal dump; the LEAD should confirm separately how the production apply input is handled (same custody rules, 7-day retention, runbook section 0).
- **If approved.** AM-10 produces the anonymised dump from a real schema export; MIG-07 rehearsal runs on it; runbook section 7 item 4 and section 11 note "schema export done".

### Q12. Archive retention and roster files

**Decided:** A (LEAD, 21 Oct).

- **Context.** [v2-data-migration.md](v2-data-migration.md) section 3.3 item 5 (line 240), Q12 (line 417). `archive_cloud` holds 35 question-bank tables for the optional backfill (BE-30). Five of them carry a `user_id`: `question_reports`, `question_submissions`, `question_imports`, `spm_sets`, `teacher_reference_documents` (`apps/api/src/migration/ddl/spec.ts:250-290`).
- **Conflict to resolve.** The runbook deletes real dumps within 7 days and drops `archive_cloud` with staging ([runbook](v2-migration-runbook.md) section 0 rule 4 and section 5). A 12-month archive needs an explicit carve-out. Question content is not personal data; the five user-linked tables are.
- **Options.** A: 12 months, all 35 tables, as the default says. B: 12 months, but the five user-linked tables are not retained (the backfill needs only question content, `source_papers.natural_key` and `content_hash`). C: no archive; delete with the dump; the backfill (MIG-09) cannot run later and old answers stay unlinked, which the design already accepts (data migration line 234).
- **Code today.** `staging:load` creates and drops `archive_cloud` with `staging_cloud`; there is no retention or export step. The backfill is post go-live and optional, so the storage form (encrypted export or a DB schema not served by the API) is decided by devops under MIG-08 and is not needed before then.
- **Roster JSON files.** The reference repo's roster JSON files are probably real people (to confirm, data migration line 363). The default, purge them from any shared copy, costs nothing and applies in all options; BE-28 AC7 already has a test that migration code never reads them.
- **Default and recommendation.** Default A. **Recommend B**: it keeps the backfill option and removes minors' linkage from a long-lived store.
- **If approved (B).** Runbook gets a carve-out: "question-content archive, 12 months, custodian the LEAD, user-linked tables excluded"; BE-30 backfill reads only the retained tables; plan 14.3 row `archive_cloud` updated.

### Q13. Leagues

**Decided:** A (LEAD, 21 Oct).

- **Context.** .cloud leagues are user-created groups with invite codes and member users; v2 leagues are school-based ([v2-data-migration.md](v2-data-migration.md) line 343; matrix row "League and member", plan line 608 "none until Q13"; Q13 at line 418).
- **Options.** A: keep both kinds, which means a new user-league feature (tables, API, screens) that no card describes: L plus frontend. B: migrate no leagues at go-live; users create new leagues in v2; revisit after go-live.
- **Code today.** No league ETL. v2 `leagues`, `league_schools` have **no** `legacy_source` / `legacy_id` columns and are not in `prisma/migratable-models.json` (`prisma/schema/games.prisma:245-300`), so even a school-league load needs a migration first. The tables belong to BE-45 (half AZ lane).
- **Default and recommendation.** Default A. **Recommend B**: new scope on a table owned by the other half, no value for the Bijak SPM go-live, and league membership of pupils is not needed for a first release.
- **If approved (B).** Plan 14.7 row "League and member": "not migrated at go-live (Q13)"; data migration Q13 closed with "revisit after go-live".

## 3. OD-21, OD-22, OD-23

### OD-21. Notification broadcasts (GAP-6)

**Decided:** C (LEAD, 21 Oct).

- **Context.** .cloud `notifications` are admin broadcasts (`target`, `recipients`, `sent_at`) with read state in `users.notifications_read_at` ([v2-data-model.md](v2-data-model.md) GAP-6 line 3276 and line 603; plan OD-21 line 430, row at line 579). v2 `notifications` is per user (`user_id`, `read_at`).
- **Options.**
  - A fan-out: one row per recipient with `read_at` derived from `notifications_read_at`. No schema change, no read-path change. Cost: one BE-29 step (S to M). Row count is broadcasts times audience: unknown until the profile. The `target` vocabulary and the meaning of `recipients` are also unknown; an unrecognised `target` is rejected, never guessed.
  - B two tables `notification_broadcasts` and `notification_reads`: new migration (0070+), a changed read path in the BE-06 notification service, and v2 has no admin-broadcast feature in B1 to justify it (data model line 603: delivery out of B1): L. A contract change is possible if list or unread-count semantics change (flagged, LEAD-only).
  - C do not load.
- **Code today.** Nothing loads notifications. The v2 table already has the legacy pair (`prisma/schema/identity.prisma:283-301`, `uq_notifications_legacy`); BE-28 lists `notifications_read_at` as dropped (`load/index.ts:61`) but it remains in staging, so a later step can still read it. The plan matrix assigns notifications to BE-29, but BE-29's table list does not include them.
- **Impact.** A user who never opened the bell has no `notifications_read_at`, so under A every historic broadcast arrives unread on first login: a flood of old announcements to minors on go-live day. Historic announcements have little value.
- **Default and recommendation.** C (the plan's own interim default). If broadcasts are wanted later, choose A, not B.
- **If approved (C).** Plan 14.7 row "Notification": "not loaded at go-live (OD-21 C)"; GAP-6 status "decided: not loaded"; BE-29 recon lists `notifications` as not migrated.

### OD-22. School subscription `quota` (GAP-15)

**Decided:** A (LEAD, 21 Oct).

- **Status: already decided and built.** The LEAD decided on 2026-10-20: `student_quota` is NOT NULL (check at least 1) and BE-28 maps the .cloud `quota` to it, `question_limit` stays null ([v2-backend-deviations.md](v2-backend-deviations.md) line 133). The code does exactly this: `apps/api/src/migration/transform/subscriptions.ts:3,46-47,59` and `prisma/schema/schools.prisma:120-126`.
- **Stale text to correct.** Plan section 13 OD-22 (line 431) and the plan 14.7 row "School subscription" (line 547) still say "open / nullable"; [v2-data-model.md](v2-data-model.md) lines 748 and 3290 (GAP-15) too.
- **Options.** A: ratify the applied decision. B: go back to a nullable `student_quota`: a migration and service changes that the LEAD already removed.
- **Residual risk (unknown until the profile).** If .cloud `quota` is not a student count, the value is wrong but still loads. A null, zero or non-numeric quota is rejected (`INVALID_VALUE`), so that school gets no subscription and its students lose subscribed status (Q6 B). The BE-27 profile shows the distribution of `quota`; the LEAD or data owner checks it before `--apply`.
- **Default and recommendation.** A.
- **If approved.** Docs only: close OD-22 and GAP-15, fix plan line 547 and data-model lines 748 and 3290.

### OD-23. `ai_usage_logs` tokens (GAP-16)

**Decided:** B (LEAD, 21 Oct).

- **Context.** .cloud logs tutor and tool usage (`event`, `tool`, `tokens`, `cost_sen`); the v2 table logs paper-extraction calls ([v2-data-model.md](v2-data-model.md) GAP-16 line 3291; plan OD-23 line 432, row at line 582). The mapping `tokens` to `tokens_in` is already the written proposal.
- **Options.** A: load, with `tokens` to `tokens_in`, `event` and `tool` kept. B: do not load at go-live; the table stays staged and profiled.
- **Code today.** The columns exist (`event`, `tool`, `tokens_in`, legacy pair; `prisma/schema/ai.prisma:45-65`), and BE-29 is "optional" for this table. No loader exists. **Loading is not just a column map:** `provider` and `model` are NOT NULL and `provider` is restricted to five values by `ck_ai_usage_logs_provider` (`prisma/migrations/0037_ai_extraction/migration.sql:73`), and `mock` rows count 0 cost in the budget sums (`modules/ai-extraction/ai-budget.service.ts:45`). Legacy rows need a schema change (nullable provider or a legacy code; migration in 0070-0099 on a table owned by BE-36, half AZ lane) and possibly a change to the provider enum in `packages/contract/**` (LEAD-only, flagged). Migrated rows dated in the current month would also count against the new monthly extraction cap.
- **Default and recommendation.** B. A is M plus a cross-half schema change for a cost log that no go-live screen needs.
- **If approved (B).** Plan 14.7 row "AI usage": ETL card "none at go-live (OD-23 B)"; GAP-16 status "decided: not loaded, mapping tokens to tokens_in kept for later".

## 4. Follow-through (decided)

All defaults were approved (Q1 to Q7, Q9 to Q13 A; OD-21 C; OD-22 A; OD-23 B; OD-18 A; DT-1 A). Owners below come from the #109 thread. The "blocked" findings in section 2 are real and are handled as shown.

| Item | Owner and state | Notes |
|---|---|---|
| Q1, Q2, Q3, OD-22 A | BE-28 (merged) | No code change. List the defaults relied on in the BE-28 PR notes and mark OD-10 Q1 to Q3 answered in the BE-28 card. Rehearsal: data owner reviews the Q1 review list, the duplicate-login ids (Q2) and the unscoped PPD ids (Q3), and the `quota` distribution (OD-22). |
| Q5 A, Q10 A, Q12 A, OD-21 C, OD-23 B | BE-29 / AM-08, PR #122 (AM1-1) | The PR conforms: exam headers and scores only (structured attempt headers stay not loaded because `structured_attempts.question_id` is NOT NULL, section 2 Q5); wallet rule per Q10 A; no `notifications` step; no `ai_usage_logs` step. |
| Q7 A | BE-29 / AM-08, PR #122 | `interventions` is deferred: `interventions.alert_description` is NOT NULL and its .cloud source column is unknown until the profile (OD-2). `feedback` follows the PR. |
| Q9 A | AM-09, PR #123 | The open-report export is done as `migrate:export-question-reports`. |
| Q12 A | MIG-08, PR #124, runbook section 18 | 12-month retention of `archive_cloud` with the carve-out from the 7-day dump rule. |
| Q4 A | Half AZ (BE-18 owner): AZ-31, PR #135 | Migration `0042_question_sets_nullable_classroom` (nullable `question_sets.classroom_id` with `ck_question_sets_classroom_or_migrated`), null handling in the BE-18 readers. BE-29 then loads headers with `classroom_id` null, `legacy_*` and `needs_rebuild = true`, no items. |
| Q6 A (payments leg), Q13 A (leagues) | LEAD fallback rule | If either cannot be rehearsed green by the evening of 24 Oct, a DECISION NEEDED with the recommended option (Q6 B, Q13 B) goes to the LEAD. Until then the interim Q6 rule in code stays in force; there is no league card or schema. |
| Q11 A, OD-18 A | AM-10, PR #125 | Schema-and-counts export, then the anonymised dump by the half-AM operator (OD-18 A); output shared out-of-band, deleted within 7 days. |
| DT-1 A | AM-10, PR #125 | `dump:cloud` writes `DATETIME` values with `+08:00` and `TIMESTAMP` values with `Z`. |
| MIG-07 rehearsal (25 Oct target) | Half AM | Runs on the AM-10 anonymised dump; records every default relied on; items still blocked stay on the report as "not migrated". |
| Doc catch-up | Docs owner, after the PRs | Plan section 13 rows OD-10, OD-21, OD-22, OD-23; plan 14.7 rows Notification, School subscription, AI usage, Teacher question set; data model GAP-6, GAP-15, GAP-16 and line 748; TRACKER decisions log (new D-number, entered by the LEAD); deviations log for Q6. [v2-data-migration.md](v2-data-migration.md) section 7 already marked decided. |

**Contract note (unchanged).** None of the decided answers needs a change to `packages/contract/**` or `openapi.json`. The Q4 draft checks this explicitly.

## 5. Interactions between answers

- Q9 A and Q12 A together: open reports are exported (AM-09) and the archive keeps all 35 tables, including the five user-linked ones, so those minors' ids live for 12 months. The retention controls are in MIG-08 and runbook section 18.
- Q6 and OD-22 A: a school subscription that fails the quota check is rejected, and while the interim Q6 rule is in force that school's students then have no subscription. Check the `quota` profile before `--apply`.
- Q1 and Q3: a JPN-like production role is a Q1 review-list item; there is no JPN scope level in the migration (`user_scopes` carries national, district and others, but no v2 JPN role exists).
- Q11 and Q12: the 7-day dump rule and the 12-month archive are reconciled by the runbook edits in MIG-08 (section 18) and AM-10 before the real dump is issued.

## 6. Not covered

- **Q8 (day boundary).** Not asked here. Its default, Malaysia time, is carried by plan OD-8 (line 417) and by transform T-05 (plan line 634). It is implemented in BE-11 (`modules/wallet/streak.service.ts`, `Asia/Kuala_Lumpur`) and specified in BE-29 AC4. Q8 was not answered on #109 and stays as implemented in BE-11. (DT-1 A, section 7, fixes only the export time zone, not this day-boundary rule.)
- **OD-24 to OD-27** (practice `mode`, challenge `metric`, `practice_answers.difficulty`, `packages` target) are out of scope of this item. OD-28 is already resolved (plan line 437).
- Production hosting and go-live scope (D65, D-1 to D-3 in the [go-live doc](../ops/go-live-bijak-spm.md)) are not decided here.

## 7. Two operating questions raised by AM-10 (dump pipeline)

These are not part of OD-10 but the AM-10 procedure (`docs/ops/cloud-dump-procedure.md`, PR on branch `be/AM-10-dump-pipeline`) needs them answered before the real sitting.

| ID | Question (one line) | Options | Proposed default | Recommendation | Answer word | Decision |
|---|---|---|---|---|---|---|
| OD-18 | Who runs the dump and the anonymiser on real data? The plan default names "the lead, on the lead PC" ([plan](v2-backend-plan.md) line 427); issue #109 AM-10 names the half-AM operator as the human with read-only .cloud access. | A the half-AM operator runs it, the LEAD approves and receives the deletion confirmation. B the LEAD runs it. | A | A (the operator is the person who holds the access; no credential changes hands) | A / B | **A** (LEAD, 21 Oct) |
| DT-1 | In which time zone are .cloud `DATETIME` values stored? `TIMESTAMP` columns are exported in UTC by the server; `DATETIME` columns carry no zone and the export must add one. | A `+08:00` (Malaysia time, matches Q8). B `+00:00` (UTC). | A | A, cross-checked against the server time zones in the `dump:check` report and the application setting known to the data owner | A / B | **A** (LEAD, 21 Oct) |

