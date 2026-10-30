/**
 * Table spec of the raw .cloud mirror (BE-27, v2-data-migration.md section 1, plan 14.3).
 *
 * This file is the source of `staging_cloud.sql` (`renderDdl`, regenerated with
 * `npm run staging:ddl -w @pp/api`; a test fails when the two differ). It also tells the profiler
 * which columns are enum-like and which declare a foreign key.
 *
 * Column notation: `name:type[:enum][:fk=<table>]`
 *   types: id and i = bigint, t = text, n = numeric, ts = timestamptz, d = date, j = jsonb.
 *   Flags and MySQL tinyint columns are `t` (permissive: the dump may hold 0/1, true/false or words).
 *   `enum`  the column is enum-like: the profiler lists its distinct values (cap 50).
 *   `fk=T`  the column references `T.id`: the profiler counts orphans.
 *   `idx`   the DDL also creates a btree index on the column (only where a loader reads by it in bulk, e.g. `question_options.question_id`).
 *   `redact` the loader writes NULL (PDPA data minimisation: login/invite secrets are never staged).
 *
 * Column names are the REAL .cloud (MariaDB) names, checked against a schema export (FIT-FIX): a listed column must
 * exist in .cloud, because the dump grants are column-level. Only columns that a reader needs (transform, loader,
 * snapshot SQL, export, backfill, verify) or that the 14.7 matrix names are listed, plus `id` and the usual
 * timestamps (lookups carry only `id` and `slug`). The loader REFUSES a dump that carries a column missing here
 * (see staging/load.ts) instead of dropping it silently.
 *
 * 127 tables: 89 in `staging_cloud` and 38 in `archive_cloud`.
 */

export type ColumnType = 'id' | 'i' | 't' | 'n' | 'ts' | 'd' | 'j'

export const SQL_TYPES: Record<ColumnType, string> = {
  id: 'bigint',
  i: 'bigint',
  t: 'text',
  n: 'numeric',
  ts: 'timestamptz',
  d: 'date',
  j: 'jsonb',
}

export type TableGroup = 'staging' | 'archive'

export interface ColumnSpec {
  name: string
  type: ColumnType
  enum: boolean
  /** Referenced table (its `id`), or null. */
  fk: string | null
  /** The loader stores NULL instead of the source value. */
  redact: boolean
  /** The DDL creates an index on this column (absent = no). */
  index?: boolean
}

export interface TableSpec {
  name: string
  group: TableGroup
  /** Primary key column, or null for pivot tables (no constraint at all, so a dirty source still loads). */
  pk: string | null
  columns: readonly ColumnSpec[]
}

function column(notation: string): ColumnSpec {
  const [name, type, ...flags] = notation.split(':')
  if (!name || !type || !(type in SQL_TYPES)) throw new RangeError(`Bad column notation "${notation}".`)
  let isEnum = false
  let fk: string | null = null
  let redact = false
  let index = false
  for (const flag of flags) {
    if (flag === 'enum') isEnum = true
    else if (flag === 'redact') redact = true
    else if (flag === 'idx') index = true
    else if (flag.startsWith('fk=')) fk = flag.slice(3)
    else throw new RangeError(`Bad column flag "${flag}" in "${notation}".`)
  }
  return { name, type: type as ColumnType, enum: isEnum, fk, redact, index }
}

const TS = ['created_at:ts', 'updated_at:ts']

function table(group: TableGroup, name: string, cols: readonly string[], opts: { pk?: string | null; ts?: boolean } = {}): TableSpec {
  const pk = opts.pk === undefined ? 'id' : opts.pk
  const notations = [...(pk === 'id' ? ['id:id'] : []), ...cols, ...(opts.ts === false ? [] : TS)]
  return { name, group, pk, columns: notations.map(column) }
}
const s = (name: string, cols: readonly string[], opts?: { pk?: string | null; ts?: boolean }) =>
  table('staging', name, cols, opts)
const a = (name: string, cols: readonly string[], opts?: { pk?: string | null; ts?: boolean }) =>
  table('archive', name, cols, opts)
const pivot = { pk: null } as const
const noTs = { ts: false } as const

/** 89 tables (83 data tables and 6 id -> slug lookups) that are migrated, reshaped or staged for profiling (`staging_cloud`). */
const STAGING: TableSpec[] = [
  // Identity, users, schools
  s('users', [
    'name:t', 'email:t', 'phone:t', 'ic:t', 'username:t', 'password:t', 'remember_token:t:redact', 'role:t:enum',
    'school_id:id:fk=schools', 'kelas:t', 'is_active:t:enum', 'is_suspended:t:enum',
    'is_complimentary:t:enum', 'referral_code:t', 'referred_by:id:fk=users',
    'parent_invite_token:t:redact', 'notifications_read_at:ts', 'bio:t', 'spm_targets:t', 'teaching_subject:t',
    'teaching_experience_years:i', 'teaching_qualification:t', 'last_login_at:ts',
  ]),
  s('schools', ['name:t', 'code:t', 'type:t:enum', 'state:t:enum', 'district:t:enum', 'join_code:t', 'is_active:t:enum']),
  s('school_subscriptions', ['school_id:id:fk=schools', 'package:t:enum', 'quota:i', 'starts_at:d', 'ends_at:d']),
  s('parent_student', ['parent_id:id:fk=users', 'student_id:id:fk=users', 'relationship:t:enum'], pivot),
  s('classrooms', [
    'name:t', 'code:t', 'teacher_id:id:fk=users', 'school_id:id:fk=schools', 'subject_id:id:fk=subjects',
    'session_year:t:enum',
  ]),
  s('classroom_student', ['classroom_id:id:fk=classrooms', 'student_id:id:fk=users'], pivot),
  // Curriculum
  s('education_levels', ['name_bm:t', 'name_en:t', 'sort_order:i', 'curriculum:t:enum', 'stage:t:enum']),
  s('subjects', ['name_bm:t', 'name_en:t', 'code:t', 'is_core:t:enum', 'color:t', 'sort_order:i']),
  s('chapters', [
    'subject_id:id:fk=subjects', 'education_level_id:id:fk=education_levels', 'number:i', 'title:t',
    'dskp_code:t', 'strand:t:enum',
  ]),
  s('topics', ['chapter_id:id:fk=chapters', 'subject_id:id:fk=subjects', 'name:t', 'sort_order:i']),
  // Practice and learning
  s('practice_sessions', [
    'user_id:id:fk=users', 'subject_id:id:fk=subjects', 'mode:t:enum', 'paper:t:enum',
    'question_set_id:id:fk=question_sets', 'client_uuid:t', 'total_questions:i', 'correct:i', 'accuracy:n',
    'duration_seconds:i', 'syiling_earned:i', 'started_at:ts',
  ]),
  s('question_attempts', [
    'user_id:id:fk=users', 'practice_session_id:id:fk=practice_sessions', 'question_id:id:fk=questions',
    'selected_option:t', 'is_correct:t:enum', 'time_seconds:i',
  ]),
  s('review_schedules', [
    'user_id:id:fk=users', 'question_id:id:fk=questions', 'ease_factor:n', 'interval_days:i', 'repetitions:i',
    'lapses:i', 'next_due_at:ts',
  ]),
  s('structured_attempts', ['user_id:id:fk=users', 'structured_question_id:id:fk=structured_questions', 'score:n', 'max_score:n', 'track:t:enum']),
  s('structured_attempt_answers', [
    'structured_attempt_id:id:fk=structured_attempts', 'structured_sub_question_id:id:fk=structured_sub_questions',
    'awarded:n', 'max_marks:n',
  ]),
  s('student_notes', ['user_id:id:fk=users', 'subject_id:id:fk=subjects']),
  s('study_schedules', [
    'teacher_id:id:fk=users', 'classroom_id:id:fk=classrooms', 'subject_id:id:fk=subjects', 'day:t:enum',
  ]),
  s('broadcasts', ['teacher_id:id:fk=users', 'classroom_id:id:fk=classrooms', 'type:t:enum', 'body:t']),
  s('timeline_entries', ['user_id:id:fk=users', 'title:t', 'body:t', 'happened_on:d']),
  s('headcounts', [
    'teacher_id:id:fk=users', 'classroom_id:id:fk=classrooms', 'subject_id:id:fk=subjects',
    'session_year:t:enum', 'tov:i', 'rs:i',
  ]),
  s('question_sets', [
    'teacher_id:id:fk=users', 'title:t', 'subject_id:id:fk=subjects', 'education_level_id:id:fk=education_levels',
    'status:t:enum',
  ]),
  // Wellbeing, career, feedback
  s('mood_checkins', ['user_id:id:fk=users', 'mood:t:enum', 'checked_in_on:d']),
  s('wellbeing_alerts', ['student_id:id:fk=users', 'type:t:enum', 'severity:t:enum', 'resolved:t:enum']),
  s('psychometric_results', ['user_id:id:fk=users']),
  s('interventions', [
    'student_id:id:fk=users', 'recorded_by:id:fk=users', 'alert_type:t:enum', 'action_date:d',
    'before_accuracy:n', 'after_accuracy:n',
  ]),
  s('aspirations', ['user_id:id:fk=users', 'career_path_id:id:fk=career_paths', 'target_university_id:id:fk=universities']),
  s('career_paths', ['name:t']),
  s('universities', ['name:t']),
  s('scholarships', ['name:t']),
  s('feedback', ['user_id:id:fk=users', 'score:i', 'satisfaction:i', 'usability:i', 'relevance:i', 'comment:t']),
  // Gamification and coins
  s('gamification_tiers', ['label_ms:t', 'perks:t', 'sort_order:i']),
  s('student_wallets', [
    'user_id:id:fk=users', 'syiling_balance:i', 'syiling_lifetime:i', 'streak_days:i',
    'gamification_tier_id:id:fk=gamification_tiers',
  ]),
  s('coin_transactions', [
    'user_id:id:fk=users', 'type:t:enum', 'source:t:enum', 'amount:i', 'balance_after:i',
  ]),
  s('challenges', ['created_by:id:fk=users', 'classroom_id:id:fk=classrooms', 'challenge_type:t:enum', 'title:t', 'target_value:n',
    'reward_syiling:i', 'reward_xp:i', 'difficulty:t:enum', 'is_active:t:enum', 'sort_order:i',
  ]),
  s('challenge_user', [
    'challenge_id:id:fk=challenges', 'user_id:id:fk=users', 'progress:i', 'completed_at:ts', 'claimed_on:d',
  ], pivot),
  s('gifts', [
    'name:t', 'price_rm:n', 'price_token:i', 'cost_value_sen:i', 'stock:i', 'status:t:enum', 'redemptions:i',
  ]),
  s('gift_redemptions', ['gift_id:id:fk=gifts', 'user_id:id:fk=users', 'status:t:enum']),
  s('teacher_badges', ['name:t', 'threshold:i', 'bonus_coins:i']),
  s('teacher_badge_user', ['teacher_badge_id:id:fk=teacher_badges', 'user_id:id:fk=users', 'awarded_at:ts'], pivot),
  s('achievements', ['name:t', 'criteria:t']),
  s('achievement_user', ['achievement_id:id:fk=achievements', 'user_id:id:fk=users', 'unlocked_at:ts'], pivot),
  s('lucky_draws', ['ticket_price:i', 'pool:i', 'winner_id:id:fk=users', 'drawn_at:ts']),
  s('reward_settings', [
    'reward_budget_sen_month:i', 'flat_quiz_reward:i', 'current_session_year:t', 'games_award_syiling:i',
  ]),
  // Battle and games
  s('battles', ['mode:t:enum', 'total_questions:i', 'duration_seconds:i', 'status:t:enum']),
  s('battle_participants', [
    'battle_id:id:fk=battles', 'user_id:id:fk=users', 'score:i', 'accuracy:n', 'is_bot:t:enum', 'target_score:i',
    'answered:i',
  ]),
  s('battle_queue', ['user_id:id:fk=users', 'grade:t:enum', 'status:t:enum']),
  s('battle_invites', ['from_user_id:id:fk=users', 'to_user_id:id:fk=users', 'uuid:t', 'status:t:enum']),
  s('games', ['name:t', 'type:t:enum', 'config:j']),
  s('game_sessions', ['game_id:id:fk=games', 'user_id:id:fk=users', 'score:i', 'result:t:enum']),
  s('game_rooms', ['state:j', 'status:t:enum']),
  s('game_room_players', ['game_room_id:id:fk=game_rooms', 'user_id:id:fk=users', 'current_q:i']),
  s('leagues', ['name:t', 'invite_code:t', 'created_by:id:fk=users']),
  s('league_members', ['league_id:id:fk=leagues', 'user_id:id:fk=users'], pivot),
  // Content
  s('banners', [
    'title:t', 'type:t:enum', 'target:t', 'image_path:t', 'starts_at:ts', 'ends_at:ts', 'sort_order:i',
    'is_active:t:enum',
  ]),
  // `body` (HTML): D1 (LEAD 29 Oct), the source of the v2 NOT NULL `articles.content`. The .cloud table has no `excerpt`
  // and no `content` column (LEAD's read-only schema export); the v2 `excerpt` stays null.
  s('articles', [
    'slug:t', 'category:t:enum', 'title:t', 'body:t', 'views:i', 'is_published:t:enum', 'author_id:id:fk=users',
  ]),
  s('notes', ['title:t', 'note_type:t:enum', 'body:t', 'views:i', 'is_published:t:enum']),
  s('videos', ['title:t', 'url:t', 'duration_seconds:i']),
  s('audio_kbat', ['title:t', 'audio_path:t', 'status:t:enum']),
  s('notifications', ['title:t', 'target:t:enum', 'recipients:i', 'sent_at:ts']),
  s('support_tickets', ['user_id:id:fk=users', 'subject:t', 'status:t:enum', 'admin_reply:t']),
  s('chatbot_conversations', ['user_id:id:fk=users']),
  s('chatbot_messages', ['chatbot_conversation_id:id:fk=chatbot_conversations', 'sender:t:enum', 'rating:i']),
  // System
  s('settings', ['key:t', 'value:t', 'group:t:enum']),
  s('feature_flags', ['slug:t', 'enabled:t:enum', 'audience:t:enum']),
  s('ai_usage_logs', ['user_id:id:fk=users', 'event:t:enum', 'tool:t:enum', 'tokens:i', 'cost_sen:i']),
  s('audit_logs', ['user_id:id:fk=users', 'action:t:enum', 'subject_type:t:enum']),
  // Billing
  s('packages', ['name:t', 'tier:t:enum', 'price:n', 'duration_days:i']),
  s('payments', ['user_id:id:fk=users', 'package_id:id:fk=packages', 'amount:n', 'status:t:enum']),
  s('invoices', ['payment_id:id:fk=payments', 'amount:n', 'status:t:enum']),
  s('dunning_logs', ['subscription_id:id', 'event:t:enum', 'sent_at:ts']),
  s('pksk_packages', ['name:t', 'price:n']),
  s('pksk_accesses', [
    'user_id:id:fk=users', 'pksk_package_id:id:fk=pksk_packages', 'granted_by:id:fk=users', 'expires_at:d',
    'status:t:enum',
  ]),
  // Marketplace, sponsorship, duta
  s('marketplace_sellers', ['user_id:id:fk=users', 'organisation:t', 'status:t:enum']),
  s('marketplace_products', ['marketplace_seller_id:id:fk=marketplace_sellers', 'name:t', 'price:n', 'status:t:enum']),
  s('marketplace_orders', [
    'marketplace_product_id:id:fk=marketplace_products', 'buyer_id:id:fk=users', 'quantity:i', 'total:n',
    'status:t:enum',
  ]),
  s('sponsors', ['organisation:t', 'category:t:enum', 'status:t:enum']),
  s('foster_sponsorships', [
    'sponsor_id:id:fk=sponsors', 'student_id:id:fk=users', 'category:t:enum', 'channel:t:enum', 'status:t:enum',
  ]),
  s('foster_applications', ['category:t:enum', 'status:t:enum']),
  s('duta_profiles', ['user_id:id:fk=users', 'is_active:t:enum']),
  s('duta_applications', ['user_id:id:fk=users', 'status:t:enum']),
  s('duta_bookings', ['duta_profile_id:id:fk=duta_profiles', 'status:t:enum']),
  // Exams (attempts)
  s('exam_attempts', [
    'user_id:id:fk=users', 'exam_paper_id:id:fk=exam_papers', 'mode:t:enum', 'status_id:id:fk=attempt_statuses', 'score:n', 'max_score:n',
    'section_scores:j', 'section_selections:j', 'served_composition:j',
  ]),
  s('part_responses', [
    'exam_attempt_id:id:fk=exam_attempts', 'question_part_id:id:fk=question_parts', 'response:j',
    'awarded_marks:n', 'ai_grade:j', 'grading_status:t:enum', 'graded_by:t',
  ]),
  // Lookups: id -> slug joins for the `*_id` columns (not migrated as v2 rows, no timestamps)
  s('attempt_statuses', ['slug:t'], noTs),
  s('paper_statuses', ['slug:t'], noTs),
  s('question_statuses', ['slug:t'], noTs),
  s('answer_modes', ['slug:t'], noTs),
  s('answer_key_kinds', ['slug:t'], noTs),
  s('stimulus_kinds', ['slug:t'], noTs),
]

/**
 * Question tables kept read-only for the optional backfill (v2-data-migration.md 3.3 item 5):
 * 12 legacy tables and the 23 canonical tables (`question_sets` is a migrated header, so it is staged),
 * plus 3 lookups (`exam_boards`, `exam_types`, `selection_rules`) = 38 tables. The 6 other lookups
 * (`attempt_statuses`, `paper_statuses`, `question_statuses`, `answer_modes`, `answer_key_kinds`,
 * `stimulus_kinds`) are staged. Lookups are copied only for id -> slug joins, never migrated as v2 rows.
 */
const ARCHIVE: TableSpec[] = [
  a('questions', [
    'subject_id:id:fk=subjects', 'education_level_id:id:fk=education_levels', 'chapter_id:id:fk=chapters',
    'topic_id:id:fk=topics', 'difficulty_level:t:enum', 'type:t:enum', 'status:t:enum', 'body:t',
    // QLOAD (LEAD 24 Oct, #113): loaded into the v2 bank at cutover, so the archive keeps them.
    'explanation:t', 'image_path:t',
  ]),
  a('question_options', ['question_id:id:fk=questions:idx', 'label:t', 'body:t', 'image_path:t', 'is_correct:t:enum']),
  a('structured_questions', ['subject_id:id:fk=subjects', 'status:t:enum', 'stimulus:t']),
  a('structured_sub_questions', ['structured_question_id:id:fk=structured_questions', 'number:t', 'marks:i']),
  a('structured_rubric_points', ['structured_sub_question_id:id:fk=structured_sub_questions', 'marks:i', 'text:t']),
  a('pksk_questions', ['bahagian:t:enum', 'domain:t:enum', 'body:t', 'status:t:enum']),
  a('question_reports', ['question_id:id:fk=questions', 'reporter_id:id:fk=users', 'status:t:enum', 'report_type:t:enum', 'description:t']),
  a('question_submissions', ['teacher_id:id:fk=users', 'status:t:enum']),
  a('question_imports', ['imported_by:id:fk=users', 'status:t:enum']),
  a('question_set_items', ['question_set_id:id:fk=question_sets', 'question_id:id:fk=questions', 'sort_order:i']),
  a('spm_sets', ['subject_id:id:fk=subjects']),
  a('spm_set_question', ['spm_set_id:id:fk=spm_sets', 'question_id:id:fk=questions', 'position:i'], { pk: null, ts: false }),
  // canonical bank
  a('exam_papers', ['status_id:id:fk=paper_statuses', 'title:t']),
  a('paper_sections', ['exam_paper_id:id:fk=exam_papers', 'label:t', 'position:i', 'selection_rule_id:id:fk=selection_rules']),
  a('exam_questions', [
    'source_paper_id:id:fk=source_papers', 'exam_paper_id:id:fk=exam_papers', 'paper_section_id:id:fk=paper_sections',
    'status_id:id:fk=question_statuses', 'number_label:t',
  ]),
  a('exam_paper_questions', ['exam_question_id:id:fk=exam_questions', 'paper_section_id:id:fk=paper_sections']),
  a('question_stimulus', ['exam_question_id:id:fk=exam_questions', 'stimulus_id:id:fk=stimuli']),
  a('question_parts', ['exam_question_id:id:fk=exam_questions', 'answer_mode_id:id:fk=answer_modes', 'marks:i']),
  a('part_options', ['question_part_id:id:fk=question_parts', 'label:t', 'body:t']),
  a('part_answer_keys', ['question_part_id:id:fk=question_parts', 'answer_key_kind_id:id:fk=answer_key_kinds', 'content:t']),
  a('stimuli', ['stimulus_kind_id:id:fk=stimulus_kinds', 'body:t']),
  a('media_assets', ['path:t', 'kind:t:enum']),
  a('question_revisions', ['exam_question_id:id:fk=exam_questions']),
  a('question_snapshots', ['exam_question_id:id:fk=exam_questions', 'content:j']),
  a('source_papers', [
    'natural_key:t', 'file_hash:t', 'year:i', 'exam_board_id:id:fk=exam_boards', 'exam_type_id:id:fk=exam_types',
  ]),
  a('import_batches', ['status:t:enum']),
  a('import_items', ['import_batch_id:id:fk=import_batches', 'exam_question_id:id:fk=exam_questions', 'review_status:t:enum']),
  a('legacy_canonical_map', ['source:t:enum', 'legacy_id:t', 'canonical_type:t:enum', 'canonical_id:id']),
  a('unify_quarantine', ['source:t:enum', 'legacy_id:t', 'reason:t:enum']),
  a('paper_documents', []),
  a('paper_document_pages', ['paper_document_id:id:fk=paper_documents', 'position:i']),
  a('paper_blueprints', ['subject_id:id:fk=subjects']),
  a('blueprint_sections', ['paper_blueprint_id:id:fk=paper_blueprints', 'label:t', 'position:i', 'selection_rule_id:id:fk=selection_rules']),
  a('teacher_reference_documents', ['teacher_id:id:fk=users']),
  a('teacher_reference_papers', ['teacher_id:id:fk=users']),
  // Lookups (id, slug): referenced by `source_papers`, `paper_sections` and `blueprint_sections`
  a('exam_boards', ['slug:t'], noTs),
  a('exam_types', ['slug:t'], noTs),
  a('selection_rules', ['slug:t'], noTs),
]

export const STAGING_SCHEMA = 'staging_cloud'
export const ARCHIVE_SCHEMA = 'archive_cloud'

export const TABLES: readonly TableSpec[] = [...STAGING, ...ARCHIVE]

const byName = new Map(TABLES.map((t) => [t.name, t]))
if (byName.size !== TABLES.length) throw new Error('Duplicate table name in the staging spec.')

export function findTable(name: string): TableSpec | undefined {
  return byName.get(name)
}

export function schemaOf(spec: TableSpec): string {
  return spec.group === 'staging' ? STAGING_SCHEMA : ARCHIVE_SCHEMA
}

/** Column names a dump row may carry. `_loaded_at` and `_row_hash` are added by the loader. */
export function columnNames(spec: TableSpec): string[] {
  return spec.columns.map((c) => c.name)
}
