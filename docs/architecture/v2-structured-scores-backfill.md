# v2 structured-scores backfill (post-go-live design note)

Status: design, not built. Decision: LEAD, 23 Oct 2026, PR #122 comment 6367535142, option C: ".cloud structured-attempt scores are not migrated for 30 Oct. They stay in the kept archive and are backfilled after go-live, once the questions are reloaded."
Sources: `be/AM-08-etl-activity` (`not-migrated.ts`, `ddl/spec.ts`, `snapshot-dims/`), `be/AM-09-migrate-orchestration` (`backfill/link-questions.ts`, runbook sections 0, 17a, 18), `feature/v2-backend` (`practice.prisma`, migration `0022_practice_reads`, `docs/ops/v2-cutover-plan.md` section 7). Anything not defined by those is **Perlu pengesahan**.

## 1. Scope

In (OD-10 Q5 A, scores only):

| .cloud table | Columns used | Use |
|---|---|---|
| `structured_attempts` | `id`, `user_id`, `structured_question_id`, `score`, `status`, `created_at` | one v2 attempt per row |
| `structured_attempt_answers` | `structured_attempt_id`, `structured_sub_question_id`, `awarded_marks` | per sub-question marks |
| `structured_sub_questions` (archive) | `id`, `structured_question_id`, `label`, `marks` | max marks and sub-question label |
| `structured_questions` (archive) | `id` | mapping key only |

Out: `structured_attempt_answers.answer_text` (free text, never read or copied; the `ddl/spec.ts` column exists only because staging copies the table), `part_responses` (free text and AI grading), `exam_attempts`, `structured_rubric_points`, question stems and bodies, any AI grade or feedback.

**Finding 1 (the scores are not in `archive_cloud`).** In `ddl/spec.ts` `structured_attempts` and `structured_attempt_answers` are `STAGING` tables (`staging_cloud`); `archive_cloud` holds only the question tables (`structured_questions`, `structured_sub_questions`, `structured_rubric_points`, the canonical bank). Cutover plan section 7 drops `staging_cloud` at the latest 6 Nov 2026 and keeps `archive_cloud` 12 months. So "they stay in the kept archive" is not true today: the scores disappear with `staging_cloud` unless they are copied first (section 4).

**Finding 2 (stale reason).** `not-migrated.ts` says "no v2 target for the header either". Migration `0022_practice_reads` (BE-13) now creates `structured_attempts`; the blocker is only `question_id NOT NULL`. The reason text should be updated to "deferred to the post-go-live backfill (PC-4 note)".

## 2. Preconditions

1. The questions are reloaded through the intake and published (a live version with `status = 'published'`, `questions.is_active`, the same candidate rule as `link-questions`).
2. A legacy structured question maps to exactly one v2 question. `link-questions` finds it for MCQ answers by `practice_answers.source_natural_key` + `number_label` (copied by BE-29 `snapshot-dims` from `legacy_canonical_map` source `questions` -> `exam_questions` -> `exam_paper_questions` -> `source_papers.natural_key`), compared as `lower(btrim())` against `source_papers.natural_key` and `question_versions.number_label` through `question_versions.source_paper_id`, with a content-hash fallback.
3. For structured questions nothing is built. Proposed reuse of the same key route: `archive_cloud.legacy_canonical_map` rows with `source = 'structured'` (named in `v2-data-migration.md` section 2, but the test fixture only has `questions`, so **Perlu pengesahan** on real data) -> `exam_questions.number_label` + paper `natural_key` -> the same v2 match as `KEY_MATCH_SQL`. The hash fallback is not reused: `contentHash` is stem + sorted options and does not describe a multi-part question (**Perlu pengesahan** if a structured hash is wanted). No match or more than one match: reject, never guess.
4. `etl_id_map` entity `users` (kept "standing") resolves `user_id`; the dry-run must report users that do not resolve.
5. The scores are preserved before `staging_cloud` is dropped (section 4).
6. The sub-question mapping rule is **Perlu pengesahan**: BE-13 uses ids `<questionId>-<label path>` for sub-questions, so the legacy `label` would be mapped to the v2 part path of the matched question; whether labels line up after OCR/typed reload is unknown.

## 3. Target

`structured_attempts` (practice.prisma `StructuredAttempt`, migration `0022`). Unique key `uq_structured_attempts_legacy (legacy_source, legacy_id)`, `legacy_source = 'cloud'`, `legacy_id` = legacy `structured_attempts.id`; the write is an upsert on that pair, so a second run inserts nothing new.

| v2 column | Value | Note |
|---|---|---|
| `user_id` | `etl_id_map('users', legacy user_id)` | FK `users` |
| `question_id`, `question_version_no` | matched question, its live version | NOT NULL, no FK. The version answered is unknown, so the live one is a working assumption (**Perlu pengesahan**) |
| `total_max` | sum of `structured_sub_questions.marks` of the question | the marks of the v2 question are the alternative (**Perlu pengesahan**) |
| `total_awarded` | `score` | integer column; a fractional `score` or `score > total_max` breaks `ck_structured_attempts_totals`: reject `INVALID_VALUE` (rounding is a business rule, **Perlu pengesahan**) |
| `marks` | `[{ subQuestionId, awarded, max }]` from `awarded_marks` | if `structured_attempt_answers` is empty for an attempt, `[]` |
| `answers` | `[]` | never any text |
| `submitted_at` | `structured_attempts.created_at` (+08:00 as DT-1 A) | no other date column is staged |
| `scope`, `track`, `is_test` | NULL, NULL, false | **Perlu pengesahan** whether any `status` value (draft, abandoned) must be skipped |

Command: `migrate:backfill-structured` (new, next to `migrate:link-questions`), dry-run by default. `--apply` needs `PP_ALLOW_MIGRATE_APPLY=1` through `assertApplyAllowed` (production also `PP_MIGRATE_TARGET_DB` equal to `current_database()`), takes the advisory locks `etl:backfill-structured:cloud` and `etl:source:cloud`, refuses while an `etl_runs` apply is `running`, one transaction per batch (default 1,000), dry-run is one `READ ONLY REPEATABLE READ` transaction rolled back, exit codes as the runbook (2 guard, 4 busy). It reuses the `link-questions` structure (batched keyset read, `decide()`, busy error, `sanitizeDbError`).

## 4. Data retention: the hard limit for option C

Dates are from cutover plan section 7 and runbook sections 0, 17a, 18 (cap 6 Nov 2026 is itself **Perlu pengesahan**: 5 Nov by the 7-day rule).

| Event | Date | Effect on C |
|---|---|---|
| `migrate:archive-minimise` (C5) | after go-live, before `post_drop` | nulls `user_id` in 5 archive tables. The scores-only tables are not on that list, but a preserved copy that holds `user_id` is personal data and would need its own rule (see 2 below) |
| `staging_cloud` dropped, backups and WAL with a raw copy deleted, restore points purged | at the latest 6 Nov 2026 | **the score rows are gone** unless copied first |
| `archive_cloud` dropped | on or after 30 Oct 2027 | the mapping tables and any preserved copy are gone |

To keep C possible, before the drop of `staging_cloud` and before C5 the operator must copy a scores-only extract into `archive_cloud` (proposed `archive_cloud.structured_scores` and `structured_score_marks`, columns of section 1 without `answer_text`, via a small step added to the `staging:load`/cutover flow or a one-off `INSERT ... SELECT`, counts logged). Then: (1) the extract is read-only, not served by the API, same grant as the archive; (2) its `user_id` column is either excluded from `migrate:archive-minimise` or replaced by the v2 user id and a retention date, **Perlu pengesahan (LEAD, PDPA)**; (3) the run uses `etl_id_map`, so `etl_id_map` must stay.

**After the extract is lost (staging dropped without the copy) or `archive_cloud` is dropped, option C is no longer possible**: the scores cannot be rebuilt from any v2 table or from `.cloud` (read-only, no re-export planned). The latest safe date is the day before the `staging_cloud` drop (6 Nov 2026) for the copy, and 29 Oct 2027 for the backfill run itself. If the reload of the questions is not finished by 6 Nov, the copy still has to be taken on time.

## 5. Reconciliation and rejects (counts only)

The command prints only integers and reason codes, never a legacy id, user id or score; rejects go to `etl_rejects` with surrogate `legacy_id` only (kit `Rejects`, reason codes). Report lines:

| Count | Meaning |
|---|---|
| `examined` | source attempts in the extract, per `legacy_source` |
| `inserted` / `unchanged` | new v2 rows / already present (idempotent re-run: `inserted = 0`) |
| `rejected` by reason | `ORPHAN_PARENT` (user not in `etl_id_map`), `UNSUPPORTED` (question has no or more than one v2 match, or a sub-question that does not map), `INVALID_VALUE` (score fractional, negative, above max), `DUPLICATE_KEY` |
| `marksRows` | sub-question mark rows read / written into `marks` |
| `raced` | skipped because another writer inserted the key first |

Identity: `examined = inserted + unchanged + rejected`. After `--apply`, `count(structured_attempts where legacy_source='cloud')` equals `inserted + unchanged` of all runs; `sum(total_awarded)` of the written rows is compared with the sum of the source `score` of the accepted rows, printed as two numbers. Unmatched rows stay in the extract, so a later run can pick them up once more questions are published. Printing surrogate ids (as `link-questions` does for answers) is not done here.

## 6. Size and open questions

Estimate: about 5 files and 700 to 800 lines. `backfill/backfill-structured.ts` (~280, modelled on the 358-line `link-questions.ts`), a pure mapper `backfill/structured-map.ts` (~90), the CLI entry in `orchestrate.ts` and `package.json` (~40), the extract step and DDL in `ddl/spec.ts` or a new SQL file (~80), unit tests for the mapper (~120) and a DB spec for dry-run/apply/idempotency/guards (~200, like the 393-line `backfill.link-questions.db.spec.ts`), plus runbook and cutover-plan edits (~40). The size of the data is not known (counts of `structured_attempts` are not in the repo): **Perlu pengesahan**.

Open questions for the LEAD:
1. Finding 1: copy a scores-only extract into `archive_cloud` before the `staging_cloud` drop (proposed), or delay the drop for these two tables? Who takes the copy and by which date (before 6 Nov)?
2. PDPA: may the extract keep `legacy user_id` (excluded from `archive-minimise`) and until when? Alternative: store only the resolved v2 `user_id`.
3. Which legacy structured question maps to which v2 question when the reload is OCR/typed: is the `legacy_canonical_map` `source = 'structured'` route and paper key + number label accepted? Is "no match" simply a reject?
4. Business rules: live version as `question_version_no`; `total_max` source; rounding of a fractional `score`; which `status` values count; `submitted_at` = `created_at`.
5. Deadline: backfill window end (proposal: before 30 Oct 2027, the `archive_cloud` drop) and whether the cap date is 5 or 6 Nov.
6. Will the learner see the old scores on the Struktur counters (BE-20, BE-41 read `structured_attempts`), and should a backfilled attempt be flagged as historical in the UI?
