/**
 * Entity matrix of `migrate:verify` (plan 14.7): for every entity a BE-28 / BE-29 step registers, the staging table it
 * is read from and the v2 table it is written to. It is built by reading the step files (`load/*-steps.ts`,
 * `load/activity/*-steps.ts`); `test/migration/verify/verify.matrix.spec.ts` builds the real registries and fails when a
 * step is added without a row here, so the matrix cannot drift unnoticed.
 *
 * `count` says how `targetCount` is taken:
 *  - `legacy`  rows of `targetTable` with `legacy_source = <source>`; consistent when equal to the run's `loaded`
 *              (every step upserts keyed by `(legacy_source, legacy_id)`, so one loaded row is one target row).
 *              This also holds for the entities that ADOPT a seeded row (education_levels, subjects, chapters, topics,
 *              subject_levels, jpns, ppds, tiers, achievements, gamification_settings): an adopted row receives the
 *              legacy pair, so it is counted in `loaded` and in `targetCount` alike.
 *  - `none`    the step loads nothing by design (the wallet-versus-ledger scan marks every row `excluded`): `loaded`
 *              must be 0 and there is no target count.
 *
 * Derived entities are rows built from other rows, not copies: `subject_levels` (distinct pairs of `chapters`),
 * `jpns` / `ppds` (distinct state / district of `schools`), `streaks` (recomputed from the sessions), and
 * `challenge_completions`, `user_achievements`, `referral_codes`, `referrals`, `spm_targets`, `gamification_settings`
 * (pivots and column pivots). They all carry `legacy_source` / `legacy_id` themselves, so `legacy` counting works for
 * them too and no `etl_id_map` count is needed; the `idmap` mode exists for a derived table that has no legacy columns.
 *
 * Children written next to an entity under the SAME legacy id (`user_roles`, `user_scopes`, `teacher_profiles` with the
 * user; `attempt_results` with the exam attempt) are not entities of their own: they are covered by the derived
 * count checks in `checks.ts`.
 */

export interface MatrixEntry {
  /** The `EntityStep.entity` name (the `etl_recon.entity` value). */
  entity: string
  /** `staging_cloud` table the step reads (null when it reads none). */
  stagingTable: string | null
  /** v2 table the step writes. */
  targetTable: string
  count: 'legacy' | 'idmap' | 'none'
  /** A required entity that did not run fails the gate (`not-run`). True for everything BE-28 and BE-29 register. */
  required: boolean
  /** One line for the report: the choice made for this row, when it is not the plain 1:1 copy. */
  note?: string
}

const e = (
  entity: string,
  stagingTable: string | null,
  targetTable: string,
  note?: string,
  count: MatrixEntry['count'] = 'legacy',
): MatrixEntry => ({ entity, stagingTable, targetTable, count, required: true, ...(note ? { note } : {}) })

/** In load order: BE-28 (`migrate:core`), then BE-29 (`migrate:activity`, groups catalogue, wallet, activity, content, ops). */
export const ENTITY_MATRIX: readonly MatrixEntry[] = [
  // ---- BE-28 core
  e('education_levels', 'education_levels', 'education_levels', 'adopts seeded levels by code'),
  e('subjects', 'subjects', 'subjects', 'adopts seeded subjects by code'),
  e('chapters', 'chapters', 'chapters', 'adopts seeded chapters by subject, level and number'),
  e('topics', 'topics', 'topics', 'adopts seeded topics by chapter and name'),
  e('subject_levels', 'chapters', 'subject_levels', 'derived: distinct (subject, level) pairs of chapters (T-09)'),
  e('jpns', 'schools', 'jpns', 'derived: distinct state of schools (T-09)'),
  e('ppds', 'schools', 'ppds', 'derived: distinct (state, district) of schools (T-09)'),
  e('schools', 'schools', 'schools'),
  e('users', 'users', 'users', 'split: user_roles, user_scopes and teacher_profiles share the legacy id (see the derived counts)'),
  e('parent_links', 'parent_student', 'parent_links'),
  e('classrooms', 'classrooms', 'classrooms'),
  e('enrolments', 'classroom_student', 'enrolments'),
  e('school_subscriptions', 'school_subscriptions', 'school_subscriptions'),
  // ---- BE-29 catalogue
  e('tiers', 'gamification_tiers', 'tiers', 'adopts the seeded tier of the same label; never inserts'),
  e('achievements', 'achievements', 'achievements', 'adopts seeded achievements by name'),
  e('challenges', 'challenges', 'challenges', 'platform challenges only; teacher challenges are excluded'),
  e('gamification_settings', 'reward_settings', 'gamification_settings', 'pivot: one key/value row per non-empty column'),
  // ---- BE-29 wallet
  e('wallets', 'student_wallets', 'wallets'),
  e('coin_ledger', 'coin_transactions', 'coin_ledger'),
  e('wallet_ledger_drift', 'student_wallets', '(report only)', 'loads nothing; the drift is shown as a check', 'none'),
  // ---- BE-29 activity
  e('practice_sessions', 'practice_sessions', 'practice_sessions'),
  e('practice_answers', 'question_attempts', 'practice_answers', 'snapshot join with the archived question (T-07)'),
  e('streaks', 'student_wallets', 'streaks', 'recomputed from the migrated sessions, one row per migrated wallet (T-05)'),
  e('exam_attempts', 'exam_attempts', 'exam_attempts', 'attempt_results share the legacy id (see the derived counts)'),
  e('challenge_completions', 'challenge_user', 'challenge_completions', 'one row per claimed day'),
  e('user_achievements', 'achievement_user', 'user_achievements'),
  e('referral_codes', 'users', 'referral_codes', 'from users.referral_code'),
  e('referrals', 'users', 'referrals', 'from users.referred_by'),
  e('spm_targets', 'users', 'spm_targets', 'from users.spm_targets, one row per subject'),
  // ---- BE-29 content
  e('articles', 'articles', 'articles'),
  e('banners', 'banners', 'banners'),
  e('notes', 'notes', 'notes'),
  e('videos', 'videos', 'videos'),
  e('audio_kbat_sets', 'audio_kbat', 'audio_kbat_sets'),
  // ---- BE-29 ops
  e('support_tickets', 'support_tickets', 'support_tickets'),
  e('timeline_posts', 'timeline_entries', 'timeline_posts'),
  e('feedback', 'feedback', 'feedback'),
]

const BY_ENTITY = new Map(ENTITY_MATRIX.map((m) => [m.entity, m]))

export function matrixEntry(entity: string): MatrixEntry | undefined {
  return BY_ENTITY.get(entity)
}

/**
 * v2 tables that the ETL fills WITHOUT `legacy_*` columns, reachable only through a migrated parent (rollback):
 * `attempt_results` (one row per migrated exam attempt, ON DELETE CASCADE from `exam_attempts`). Everything else the
 * ETL writes carries the legacy pair.
 */
export const ETL_DERIVED_CHILDREN: readonly { table: string; parent: string }[] = [{ table: 'attempt_results', parent: 'exam_attempts' }]

/**
 * Tables whose loader ADOPTS rows that exist before the migration (`claimSeeded`): a seed row receives the legacy pair
 * and is indistinguishable afterwards from a row the ETL inserted. Rollback never deletes an adopted row that other
 * tables use; it releases it (see `rollback.ts`). Keep in sync with the `claimSeeded(` calls in `load/`.
 */
export const CLAIMABLE_TABLES: readonly string[] = [
  'education_levels',
  'subjects',
  'chapters',
  'topics',
  'subject_levels',
  'jpns',
  'ppds',
  'tiers',
  'achievements',
  'gamification_settings',
]
