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
  count: 'legacy' | 'idmap' | 'shared' | 'none'
  /** A required entity that did not run fails the gate (`not-run`). True for everything BE-28 and BE-29 register. */
  required: boolean
  /** One line for the report: the choice made for this row, when it is not the plain 1:1 copy. */
  note?: string
  /**
   * The step reads every row of `stagingTable` once (so `etl_recon.source_count` must equal the table's row count now).
   * False for derived and filtered reads (distinct pairs, pivots, users with a referral code, ...).
   */
  plainRead: boolean
  /**
   * `archive_cloud` table the step reads whole (every row once): `etl_recon.source_count` must equal its row count now (the same "staging
   * changed since the run" guard as `plainRead`, for the loaders that read the archive).
   */
  archiveTable?: string
  /** `legacy` counting: SQL condition (a constant, never data) that narrows the target rows to this entity when two entities share a table. */
  targetWhere?: string
  /** `idmap` counting: SQL condition on `legacy_id` that narrows the id-map rows to this entity (a step that also writes other keys). */
  idmapWhere?: string
  /**
   * Entities that write rows of the SAME target table under their own legacy pair: the target holds `loaded` of this entity plus theirs
   * (the question bank: a subjective question is a `questions` row of the `subjective_questions` step).
   */
  sharedWith?: readonly string[]
}

/** Entities whose read is NOT "every row of the staging table once". */
const NOT_PLAIN_READ: ReadonlySet<string> = new Set([
  'subject_levels', 'jpns', 'ppds', 'gamification_settings', 'reward_settings', 'challenge_completions', 'user_achievements',
  'referral_codes', 'referrals', 'spm_targets', 'questions',
])

const e = (
  entity: string,
  stagingTable: string | null,
  targetTable: string,
  note?: string,
  count: MatrixEntry['count'] = 'legacy',
): MatrixEntry => ({ entity, stagingTable, targetTable, count, required: true, plainRead: !NOT_PLAIN_READ.has(entity), ...(note ? { note } : {}) })

/** `coin_ledger` rows of the V2 ledger and the opening-balance rows (`load/activity/wallet-steps.ts` OPENING_ID_PREFIX). */
export const OPENING_NOT = `legacy_id NOT LIKE 'opening:%'`
export const OPENING_ONLY = `legacy_id LIKE 'opening:%'`

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
  e('gamification_settings', 'reward_settings', 'gamification_settings', 'pivot: the key/value row of reward_budget_sen_month'),
  e('reward_settings', 'reward_settings', 'reward_settings', 'pivot: the DM-48 values of the source row fill the singleton (DM-38)', 'idmap'),
  e('rewards', 'gifts', 'rewards', 'T-B8: the V2 gift catalogue with its own token price (KP-6)'),
  // ---- BE-29 wallet
  e('wallets', 'student_wallets', 'wallets'),
  { ...e('coin_ledger', 'coin_transactions', 'coin_ledger', 'the V2 ledger rows (the opening-balance rows of wallet_opening are counted apart)'), targetWhere: OPENING_NOT },
  {
    ...e('wallet_opening', 'student_wallets', 'coin_ledger', 'one legacy_opening ledger row per wallet its V2 ledger does not explain, so SUM(ledger) = balance (T-B5b follow-up)'),
    targetWhere: OPENING_ONLY,
    plainRead: true,
  },
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
  e('reward_redemptions', 'gift_redemptions', 'reward_redemptions', 'T-B8: the V2 token redemptions (pending ones wait for the admin)'),
  // ---- BE-29 content
  e('articles', 'articles', 'articles'),
  e('banners', 'banners', 'banners'),
  e('notes', 'notes', 'notes'),
  e('videos', 'videos', 'videos'),
  e('audio_kbat_sets', 'audio_kbat', 'audio_kbat_sets'),
  e('question_sets', 'question_sets', 'question_sets', 'teacher headers only, as needs-rebuild with no class (OD-10 Q4 A); the items are not migrated'),
  // ---- BE-29 ops
  e('support_tickets', 'support_tickets', 'support_tickets'),
  e('timeline_posts', 'timeline_entries', 'timeline_posts'),
  e('feedback', 'feedback', 'feedback'),
  e('headcount_configs', 'headcounts', 'headcount_configs', 'T-B7: class-subject-year TOV and RS; the V2 values are kept as legacy and as the class defaults'),
  // ---- QLOAD: standalone `migrate:questions`, run AFTER `migrate:all`. Not required (migrate:all --apply verifies before it
  // exists, so a missing run must not fail the gate); once it has a succeeded apply run it is verified like any other row.
  {
    ...e('questions', null, 'questions', 'archive_cloud MCQs of every status loaded by migrate:questions; versions, parts, options, keys and tags share the legacy id; the target also holds the subjective questions'),
    required: false,
    archiveTable: 'questions',
    sharedWith: ['subjective_questions'],
  },
  ...standalone([
    ['question_stimuli', 'stimuli', 'stimuli', 'idmap', 'stimuli of the rajah plan (carriers, owners, shared images, canonical stimuli); the stem stimulus of a plain question is not an entry of this step', { idmapWhere: `legacy_id NOT LIKE 'i:%'` }],
    ['stimulus_groups', null, 'stimulus_groups', 'shared', 'rajah groups (all members show the rajah, V2 order) and the stem links of image owners; checked by the group checks, not by a row count'],
    ['question_files', null, 'files', 'shared', 'question pictures by distinct V2 path; a picture that cannot be used is a reject of this entity and keeps its questions held (never dropped), see the file checks'],
    ['structured_questions', 'structured_questions', 'questions', 'idmap', 'structured questions with sub-questions and rubric points (no legacy pair: the id map links them)', { archiveTable: 'structured_questions' }],
    ['subjective_questions', 'questions', 'questions', 'shared', 'subjective questions: rows of questions with their own legacy id (counted with the questions entity); the type migrate:questions leaves to this loader'],
    ['exam_questions', 'exam_questions', 'questions', 'idmap', 'canonical-only questions (no legacy_canonical_map row; no legacy pair: the id map links them)'],
    ['pksk_questions', 'pksk_questions', 'questions', 'idmap', 'V2 PKSK questions (body only): loaded as DRAFTS for the admin to complete (OC-4)', { archiveTable: 'pksk_questions' }],
    ['spm_sets', 'spm_sets', 'spm_tracking_sets', 'idmap', 'SPM tracking sets (kinds the loader does not own are excluded)', { archiveTable: 'spm_sets' }],
    ['paper_blueprints', 'paper_blueprints', 'blueprints', 'idmap', 'blueprints (a subject and kertas that already has an active Kontrak is excluded)', { archiveTable: 'paper_blueprints' }],
    ['exam_papers', 'exam_papers', 'papers', 'idmap', 'papers with sections and placements, loaded as drafts (the Terbit pass publishes)', { archiveTable: 'exam_papers' }],
    ['paper_documents', 'paper_documents', 'paper_documents', 'legacy', 'Kertas Subjektif page-image documents', { archiveTable: 'paper_documents' }],
    ['paper_document_pages', 'paper_document_pages', 'paper_document_pages', 'legacy', 'pages of the documents (needs --files-dir; without it every page is excluded)', { archiveTable: 'paper_document_pages' }],
  ]),
]

type Extra = Partial<Pick<MatrixEntry, 'archiveTable' | 'targetWhere' | 'idmapWhere' | 'sharedWith'>>

/**
 * Entities of the standalone loaders (`migrate:questions`, `migrate:structured`, `migrate:papers`): run after `migrate:all`, so never
 * required (migrate:all --apply verifies before they exist); once an entity has a succeeded apply run it is verified like any other row.
 * `stagingTable` names the source table for the report only (their reads are checked through `archiveTable`).
 */
function standalone(rows: readonly (readonly [string, string | null, string, MatrixEntry['count'], string, Extra?])[]): MatrixEntry[] {
  return rows.map(([entity, source, target, count, note, extra]) => ({ entity, stagingTable: source, targetTable: target, count, required: false, plainRead: false, note, ...extra }))
}

const BY_ENTITY = new Map(ENTITY_MATRIX.map((m) => [m.entity, m]))

export function matrixEntry(entity: string): MatrixEntry | undefined {
  return BY_ENTITY.get(entity)
}

/**
 * v2 tables that the ETL fills WITHOUT `legacy_*` columns, reachable only through a migrated parent (rollback):
 * `attempt_results` (one row per migrated exam attempt, ON DELETE CASCADE from `exam_attempts`). Everything else the
 * ETL writes carries the legacy pair.
 */
export const ETL_DERIVED_CHILDREN: readonly { table: string; parent: string }[] = [
  { table: 'attempt_results', parent: 'exam_attempts' },
  // QLOAD: the other tables of a migrated question (parts, options, keys) cascade through `question_versions`.
  { table: 'question_versions', parent: 'questions' },
  { table: 'question_tags', parent: 'questions' },
]

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
