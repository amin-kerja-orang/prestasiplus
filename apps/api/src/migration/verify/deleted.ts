/**
 * Rows deleted at the source. The delta never deletes v2 rows (a source delete is not propagated, by design; the freeze
 * plan lists them for the LEAD), so after a delta on a re-staged dump a v2 table can hold more rows of the source than the
 * run loaded. `deletedAtSource` is that difference, measured directly: the v2 rows with `legacy_source = <source>` whose
 * legacy id the CURRENT staging no longer produces.
 *
 * `STAGING_KEYS` gives, per entity, the SQL that tells whether the staging still produces a v2 row's legacy id (read from the
 * step files). Three shapes: the id of one staging row (`byId`), a pair of ids (`pair`), and, for a legacy id that also
 * carries an ordinal or a key (`challenge:user:ordinal`, `user:subject-ref`, `settings-row:key`), the parents named in the id
 * (`parents`): the row counts as deleted when ANY parent is gone. That is an approximation (one claim or one SPM entry removed
 * from a user who stays is not seen), chosen because the ordinal and the subject reference cannot be rebuilt in plain SQL.
 *
 * Not listed, so `deletedAtSource` is null and the plain rule (`targetCount == loaded`) applies, because the rows are truly
 * derived by a TypeScript normalisation (`buildGeo`: case and spacing folding, code generation) that has no SQL form:
 *   jpns, ppds                 derived from the distinct state / district of schools
 *   wallet_ledger_drift        loads nothing
 *
 * The same key drives `survivorSql`, which the staging-versus-v2 checks use to leave the deleted rows out of the v2 side,
 * so a source delete alone never makes a comparison fail while a real mismatch still does.
 */
import type pg from 'pg'

import { STAGING_SCHEMA } from '../ddl/spec'
import { quoteIdent } from '../kit/sql'
import type { LegacySource } from '../kit/types'
import type { MatrixEntry } from './entities'

export interface StagingKey {
  /** `staging_cloud` tables the predicate reads (snake_case, from this file only); all must exist, else nothing is compared. */
  tables: readonly string[]
  /** SQL `EXISTS (...)` (or an AND of them): the staging still produces the legacy id in `<alias>.legacy_id`. */
  exists(alias: string): string
}

const ST = quoteIdent(STAGING_SCHEMA)
const from = (table: string): string => `${ST}.${quoteIdent(table)}`

/** The legacy id is `id` of the staging row. */
const byId = (table: string, where?: string): StagingKey => ({
  tables: [table],
  exists: (alias) => `EXISTS (SELECT 1 FROM ${from(table)} s WHERE ${where ? `${where} AND ` : ''}s.id::text = ${alias}.legacy_id)`,
})

/** The legacy id is `a:b`, built like `pairId` in the transforms (`x` stands for a null column). */
const pair = (table: string, a: string, b: string): StagingKey => ({
  tables: [table],
  exists: (alias) =>
    `EXISTS (SELECT 1 FROM ${from(table)} s WHERE coalesce(s."${a}"::text, 'x') || ':' || coalesce(s."${b}"::text, 'x') = ${alias}.legacy_id)`,
})

/**
 * The legacy id carries the ids of its parents in fixed `:` positions (1-based) and cannot be rebuilt from one staging row
 * (an ordinal, a subject reference or a setting key follows). A row counts as deleted at the source when ANY parent is gone.
 */
const parents = (...ps: { table: string; part: number }[]): StagingKey => ({
  tables: ps.map((p) => p.table),
  exists: (alias) =>
    ps.map((p) => `EXISTS (SELECT 1 FROM ${from(p.table)} s WHERE s.id::text = split_part(${alias}.legacy_id, ':', ${p.part}))`).join(' AND '),
})

export const STAGING_KEYS: Readonly<Record<string, StagingKey>> = {
  education_levels: byId('education_levels'),
  subjects: byId('subjects'),
  chapters: byId('chapters'),
  topics: byId('topics'),
  subject_levels: {
    tables: ['chapters'],
    exists: (alias) =>
      `EXISTS (SELECT 1 FROM ${from('chapters')} s WHERE s.subject_id IS NOT NULL AND s.education_level_id IS NOT NULL
         AND s.subject_id::text || ':' || s.education_level_id::text = ${alias}.legacy_id)`,
  },
  schools: byId('schools'),
  users: byId('users'),
  parent_links: pair('parent_student', 'parent_id', 'student_id'),
  classrooms: byId('classrooms'),
  enrolments: pair('classroom_student', 'classroom_id', 'student_id'),
  school_subscriptions: byId('school_subscriptions'),
  tiers: byId('gamification_tiers'),
  achievements: byId('achievements'),
  challenges: byId('challenges'),
  gamification_settings: parents({ table: 'reward_settings', part: 1 }),
  wallets: byId('student_wallets'),
  coin_ledger: byId('coin_transactions'),
  practice_sessions: byId('practice_sessions'),
  practice_answers: byId('question_attempts'),
  streaks: byId('student_wallets'),
  exam_attempts: byId('exam_attempts'),
  // `challenge:user:day-ordinal`: gone when the challenge or the user is gone (a single claim row cannot be told apart).
  challenge_completions: parents({ table: 'challenges', part: 1 }, { table: 'users', part: 2 }),
  user_achievements: pair('achievement_user', 'achievement_id', 'user_id'),
  referral_codes: byId('users', `s.referral_code IS NOT NULL AND btrim(s.referral_code) <> ''`),
  referrals: byId('users', 's.referred_by IS NOT NULL'),
  // `user:subject-ref`: gone when the user is gone (an entry removed from the user's JSON is not detected).
  spm_targets: parents({ table: 'users', part: 1 }),
  articles: byId('articles'),
  banners: byId('banners'),
  notes: byId('notes'),
  videos: byId('videos'),
  audio_kbat_sets: byId('audio_kbat'),
  support_tickets: byId('support_tickets'),
  timeline_posts: byId('timeline_entries'),
  // A feedback row also counts as deleted at the source when its user is gone (staging has no cascade, BE-29 rejects it as an orphan).
  feedback: {
    tables: ['feedback', 'users'],
    exists: (alias) =>
      `EXISTS (SELECT 1 FROM ${from('feedback')} s WHERE s.id::text = ${alias}.legacy_id
         AND EXISTS (SELECT 1 FROM ${from('users')} u WHERE u.id = s.user_id))`,
  },
}

const stagingTablesExist = async (pool: pg.Pool, tables: readonly string[]): Promise<boolean> => {
  for (const t of tables) {
    const r = await pool.query<{ ok: boolean }>(`SELECT to_regclass($1) IS NOT NULL AS ok`, [from(t)])
    if (r.rows[0]?.ok !== true) return false
  }
  return true
}

/**
 * ` AND EXISTS (...)` to append to a WHERE over v2 rows of `entity` (alias `alias`): keeps the rows whose source row still
 * exists. Empty when the entity has no key or a staging table is not there (nothing to compare against).
 */
export async function survivorSql(pool: pg.Pool, entity: string, alias: string): Promise<string> {
  const k = STAGING_KEYS[entity]
  if (!k || !(await stagingTablesExist(pool, k.tables))) return ''
  return ` AND ${k.exists(alias)}`
}

export interface DeletedAtSource {
  count: number
  /** Surrogate legacy ids, capped (json report only). */
  ids: string[]
}

export const MAX_DELETED_IDS = 200

/** The v2 rows of the entity whose source row no longer exists, or null when this cannot be computed cheaply. */
export async function deletedAtSource(pool: pg.Pool, source: LegacySource, entry: MatrixEntry): Promise<DeletedAtSource | null> {
  const k = STAGING_KEYS[entry.entity]
  if (!k || entry.count !== 'legacy' || !(await stagingTablesExist(pool, k.tables))) return null
  const target = quoteIdent(entry.targetTable)
  const gone = `t.legacy_source = $1 AND NOT (${k.exists('t')})`
  const n = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${target} t WHERE ${gone}`, [source])
  const count = Number(n.rows[0]?.n ?? 0)
  if (count === 0) return { count, ids: [] }
  const ids = await pool.query<{ legacy_id: string }>(
    `SELECT t.legacy_id FROM ${target} t WHERE ${gone} ORDER BY t.legacy_id LIMIT ${MAX_DELETED_IDS}`,
    [source],
  )
  return { count, ids: ids.rows.map((r) => r.legacy_id) }
}
