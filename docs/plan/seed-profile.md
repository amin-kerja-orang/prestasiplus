# PoC seed profile (BE-26)

What `npm run be:db:reset && npm run be:db:seed` (profile `poc`, the default) puts in the database, for the frontend lead to compare with the mock expectations. Everything is fictitious: demo accounts use `demo.test`, generated people use `example.test`. Demo passwords are never listed here (see `docs/AKAUN-DEMO.md`).

## How it is built

The profile is the whole `seedModules` registry in `apps/api/prisma/seed/index.ts`, run in this order (append-only; pinned by `apps/api/test/seed/poc.spec.ts`):

1. `core-identity`: demo schools and the canonical demo accounts
2. `core-schools`: extra fictitious schools
3. `core-school-packages`: REFERENCE module (runs in production, like `spm-subject-configs`)
4. `core-population`: generated pupils, teachers, officers and the out-of-scope demo accounts
5. `curriculum`: levels, subjects, chapters, topics, DSKP nodes
6. `questions`: the question bank
7. `wallet`: tiers, wallets, coin ledger of the demo accounts
8. `content`: articles, banners, videos, support
9. `exam`: blueprints, papers, placements
10. `exam-demo-blueprints`
11. `poc-classes`: classes and rosters
12. `poc-bijak-sittings`: submitted Bijak SPM sittings, results, aggregates
13. `battle` (BE-44): battle arena demo rows
14. `games` (BE-45): Permainan rooms, solo sessions, leagues, Sekolah Bersaing
15. `poc-cikgu`
16. `poc-performance` (BE-19): headcount configs and entries, timeline posts
17. `spm-subject-configs` (BE-41): REFERENCE module (also runs in production)
18. `spm` (BE-41): SPM hub demo rows
19. `practice`: practice sessions and answers
20. `gamification`
21. `poc-profile` (BE-26): runs `apps/api/prisma/seed/poc/verify.ts` and fails the run when a rule is violated

BE-26 adds no data of its own: every row comes from its owner module (one owner per store, ADR-0014). `apps/api/prisma/seed/poc/fixtures/` is not created because no cross-domain fixture was needed.

## Counts per table

Generated from the seeded database by `pocTableCounts` + `renderCountsTable` (`apps/api/prisma/seed/poc/profile.ts`); `apps/api/test/seed/poc.spec.ts` regenerates it and fails when this block differs. Tables not listed hold no rows.

<!-- poc-counts:begin -->
| Table | Rows |
|---|---:|
| achievements | 25 |
| answer_keys | 27 |
| articles | 3 |
| attempt_answers | 122 |
| attempt_results | 15 |
| banners | 3 |
| battle_participants | 142 |
| battles | 71 |
| blueprint_sections | 9 |
| blueprints | 5 |
| challenges | 10 |
| chapters | 1311 |
| chat_threads | 1 |
| classrooms | 15 |
| coin_ledger | 53 |
| curriculum_nodes | 2844 |
| curriculum_tp_descriptors | 1394 |
| draw_prizes | 2 |
| draws | 1 |
| duta_profiles | 5 |
| education_levels | 11 |
| enrolments | 34 |
| essay_markings | 1 |
| exam_attempts | 15 |
| game_room_players | 8 |
| game_rooms | 4 |
| game_sessions | 3 |
| game_settings | 1 |
| game_standings | 48 |
| gamification_settings | 10 |
| headcount_configs | 2 |
| headcount_entries | 13 |
| headcount_entry_marks | 36 |
| jpns | 2 |
| jutawan_stats | 8 |
| league_class_levels | 3 |
| league_schools | 5 |
| league_standings | 4 |
| leagues | 2 |
| learner_badges | 3 |
| legacy_subtopics | 335 |
| legacy_topics | 125 |
| mastery | 3 |
| paper_placements | 31 |
| paper_sections | 9 |
| papers | 5 |
| part_options | 60 |
| pbd_tags | 2 |
| personal_bests | 40 |
| ppds | 3 |
| practice_answers | 30 |
| practice_attempt_aggregate_items | 126 |
| practice_attempt_aggregates | 15 |
| practice_sessions | 4 |
| question_parts | 29 |
| question_tags | 3 |
| question_version_sp_nodes | 21 |
| question_version_stimuli | 7 |
| question_versions | 23 |
| questions | 23 |
| rewards | 59 |
| rph_plans | 2 |
| school_packages | 4 |
| schools | 4 |
| sekolah_bersaing_weeks | 16 |
| spin_stats | 8 |
| spm_subject_configs | 19 |
| spm_tracking_set_questions | 3 |
| spm_tracking_sets | 3 |
| stimuli | 2 |
| stimulus_group_options | 4 |
| stimulus_group_stimuli | 2 |
| stimulus_groups | 2 |
| streaks | 3 |
| subject_levels | 194 |
| subjects | 33 |
| subtopics | 234 |
| support_config | 1 |
| support_tickets | 1 |
| syiling_rewards | 11 |
| tiers | 4 |
| timeline_posts | 3 |
| topics | 2423 |
| user_roles | 52 |
| user_scopes | 14 |
| users | 51 |
| videos | 3 |
| wallets | 3 |

Tables with rows: 88 of 177. Total rows: 10323.
<!-- poc-counts:end -->

Mod Pelajar (`is_test`) rows: none are seeded; the profile counts and `verify` rules exclude them anyway.

## Comparison with D45 ("about 20 students, a few papers")

| Item | Target | Seeded | Note |
|---|---|---|---|
| Students (role student) | about 20 | 32 | 21 generated (`example.test`) + 10 demo accounts (`demo.test`) + 1 roster account with a username and no e-mail. The 21 generated pupils match the target; the demo accounts are anchors required by `docs/AKAUN-DEMO.md` and the Bijak sittings. Not reduced: removing them would break the documented logins. |
| Papers | a few | 5 | 4 Bijak PoC papers (Matematik K1 and K2, Sains K2, Sejarah K2; reserved question ids) + 1 bank paper (Matematik). |
| Seed time | under 60 s | about 6.5 s | See below. |

## Verify rules (`apps/api/prisma/seed/poc/verify.ts`)

Each rule is one SQL assertion with a failing-fixture test in `apps/api/test/seed/poc.spec.ts`:

| Rule | Meaning |
|---|---|
| `wallet_balance_equals_ledger_sum` | `wallets.current_syiling` = sum of the user's `coin_ledger.amount` (`is_test` excluded) |
| `ledger_user_has_wallet` | a user with ledger rows has a wallet |
| `answer_dimensions_valid` | each `practice_answers` row has subject and level, chapter in subject, topic in chapter, label A-H, difficulty 1-5 |
| `enrolment_classroom_exists`, `enrolment_student_exists` | enrolments reference an existing class and a user with the student role |
| `placement_question_published` | each `paper_placements` row points at an in-code PoC question (reserved id block) or an active bank question whose live version is published |
| `orphan_*` (7 rules) | relations without a database foreign key: question ids of session questions, answers, checks, revision queue and aggregate items; `exam_attempts.paper_id`; `session_credits.session_id` |

Not checked: `attempt_answers.part_id` (string key, not a foreign key) and the polymorphic `jobs.entity_id` / `audit_events.target_id` (runtime only).

## Determinism (AC1) and known gaps in earlier modules

Two seeded databases hash identically, and a second run on a seeded database changes nothing, with these documented exclusions (the owning module should fix them; BE-26 may not rewrite earlier modules):

- `updated_at` is stamped by the database clock on every upsert (Prisma `@updatedAt`), in many tables, so it is excluded from the fingerprint.
- `created_at` is stamped by the database clock instead of `ctx.clock` in `answer_keys`, `blueprints`, `mastery`, `papers`, `part_options`, `practice_attempt_aggregates` and `question_parts` (excluded in those tables only).
- `practice_sessions.id` is a random uuid generated by the database (the practice seed matches by `client_uuid`). The fingerprint swaps the id, and the references to it, for the `client_uuid`.

## Gaps versus the frontend expectations (`e2e/fixtures/**`, `e2e/*`)

The e2e suite runs against the mock (`src/mock`, `VITE_DATA_PROFILE=full`), whose datasets are far larger than the PoC profile; the backend seed is not meant to equal them. The gaps that matter when the frontend is switched to HTTP:

- Practice: 4 sessions and 30 answers for the two data-rich demo students. Answers have no `question_id` (the practice seed predates the question bank), so `revision_queue`, `practice_session_questions`, `practice_checks` and `session_credits` are empty: the wrong-answer list and the session replay screens render empty states.
- No seed at all for: missions and remedial tests, question sets, SPM targets, notifications, perutusan, parent links/invites, school subscriptions and user packages, user achievements and referrals, reward claims/redemptions, teacher profiles, feedback and interventions (Kirkpatrick), intake batches/files, question reports and quality scores, uploaded files. Screens fed by these tables show empty states.
- Wallets exist for 3 users only (`admin`, `pelajar`, `pelajarmaju`); the Bijak demo pupils (`murid4`..`murid8`) have sittings but no wallet or ledger rows.
- Monitoring/admin aggregates: 12 pupils counted in `/api/monitoring/overview` (`engaged`: 2, `answers`: 30), against the mock's much larger totals.
- M16 (battle, games) is seeded by `battle` and `games`. M21 (sponsorship) has only the BE-47 foster applications, with no seed rows. No backend domain exists yet for the e2e modules M20 (marketplace) and M25 (AI centre).
- `core-population` accounts for parent, sponsor, PPD and JPN exist and log in; their screens are out of prototype scope (D43, D48).
- `exam` logs "PoC questions not loaded (BE-09 wire-up TODO)": the PoC paper questions live in code (reserved ids), not in `questions`.

## Production gating (AC7)

`NODE_ENV=production` without an opt-in loads the reference module only and prints a warning (unchanged). The opt-in there is `ALLOW_DEMO_SEED=true` (used by the live demo, unchanged). The flag `--force-demo` on the seed command (`npm run be:db:seed -- --profile=poc --force-demo`) sets `ALLOW_DEMO_SEED=true` for the run; in production it needs both keys: the flag alone is refused (non-zero exit, nothing loaded, not even the reference module) unless `ALLOW_DEMO_SEED=true` is also set (LEAD decision 2026-10-21, #67). Outside production the flag behaves as before. Calling the `poc-profile` module directly in production without `ALLOW_DEMO_SEED` throws. Tests: `apps/api/test/seed/poc-guard.spec.ts`.

## Seed time (AC6)

Measured on a sandbox VM (2026-10-20) with the real command `tsx prisma/seed/index.ts` against a freshly migrated local Postgres 16 (fsync off): about 6.5 s from empty including the tsx start-up, about 4.2 s for a second (no-op) run. The largest module is `curriculum` (about 2.4 s). The limit is 60 s; `apps/api/test/seed/poc.spec.ts` asserts the in-process run stays under it.
