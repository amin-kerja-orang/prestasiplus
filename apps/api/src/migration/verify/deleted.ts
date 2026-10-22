/**
 * Rows deleted at the source. The delta never deletes v2 rows (a source delete is not propagated, by design; the freeze
 * plan lists them for the LEAD), so after a delta on a re-staged dump a v2 table can hold more rows of the source than the
 * run loaded. `deletedAtSource` is that difference, measured directly: the v2 rows with `legacy_source = <source>` whose
 * legacy id the CURRENT staging no longer produces.
 *
 * `STAGING_KEYS` gives, per entity, the staging table and the SQL that rebuilds the legacy id the step writes (read from
 * the step files). Entities that are not listed have no cheap key (derived or composite with an ordinal): their
 * `deletedAtSource` is null and the plain rule (`targetCount == loaded`) applies:
 *   jpns, ppds                 derived from the distinct state / district of schools
 *   gamification_settings      `<row id>:<setting key>`, a pivot of one row
 *   challenge_completions      `challenge:user:day-ordinal`, the ordinal comes from a window over the pivot
 *   spm_targets                `user:subject-ref`, parsed from a text column
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
  /** `staging_cloud` table (snake_case, from this file only). */
  table: string
  /** SQL over alias `s` giving the legacy id text the step writes. */
  key: string
  /** Rows of the table the step reads (SQL over alias `s`). */
  where?: string
}

const byId = (table: string, where?: string): StagingKey => ({ table, key: 's.id::text', ...(where ? { where } : {}) })
const pair = (table: string, a: string, b: string): StagingKey => ({
  table,
  // `x` stands for a null column, like `pairId` in the transforms.
  key: `coalesce(s."${a}"::text, 'x') || ':' || coalesce(s."${b}"::text, 'x')`,
})

export const STAGING_KEYS: Readonly<Record<string, StagingKey>> = {
  education_levels: byId('education_levels'),
  subjects: byId('subjects'),
  chapters: byId('chapters'),
  topics: byId('topics'),
  subject_levels: {
    table: 'chapters',
    key: `s.subject_id::text || ':' || s.education_level_id::text`,
    where: 's.subject_id IS NOT NULL AND s.education_level_id IS NOT NULL',
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
  wallets: byId('student_wallets'),
  coin_ledger: byId('coin_transactions'),
  practice_sessions: byId('practice_sessions'),
  practice_answers: byId('question_attempts'),
  streaks: byId('student_wallets'),
  exam_attempts: byId('exam_attempts'),
  user_achievements: pair('achievement_user', 'achievement_id', 'user_id'),
  referral_codes: byId('users', `s.referral_code IS NOT NULL AND btrim(s.referral_code) <> ''`),
  referrals: byId('users', 's.referred_by IS NOT NULL'),
  articles: byId('articles'),
  banners: byId('banners'),
  notes: byId('notes'),
  videos: byId('videos'),
  audio_kbat_sets: byId('audio_kbat'),
  support_tickets: byId('support_tickets'),
  timeline_posts: byId('timeline_entries'),
  feedback: byId('feedback'),
}

const stagingTableExists = async (pool: pg.Pool, table: string): Promise<boolean> =>
  (await pool.query<{ ok: boolean }>(`SELECT to_regclass($1) IS NOT NULL AS ok`, [`${quoteIdent(STAGING_SCHEMA)}.${quoteIdent(table)}`])).rows[0]?.ok === true

/** `EXISTS (...)`: the staging still produces the legacy id in `<alias>.legacy_id`. Null when the entity has no key. */
function existsSql(entity: string, alias: string): string | null {
  const k = STAGING_KEYS[entity]
  if (!k) return null
  return `EXISTS (SELECT 1 FROM ${quoteIdent(STAGING_SCHEMA)}.${quoteIdent(k.table)} s WHERE ${k.where ? `${k.where} AND ` : ''}${k.key} = ${alias}.legacy_id)`
}

/**
 * ` AND EXISTS (...)` to append to a WHERE over v2 rows of `entity` (alias `alias`): keeps the rows whose source row still
 * exists. Empty when the entity has no key or the staging table is not there (nothing to compare against).
 */
export async function survivorSql(pool: pg.Pool, entity: string, alias: string): Promise<string> {
  const k = STAGING_KEYS[entity]
  if (!k || !(await stagingTableExists(pool, k.table))) return ''
  return ` AND ${existsSql(entity, alias)}`
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
  if (!k || entry.count !== 'legacy' || !(await stagingTableExists(pool, k.table))) return null
  const target = quoteIdent(entry.targetTable)
  const gone = `t.legacy_source = $1 AND NOT ${existsSql(entry.entity, 't')}`
  const n = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${target} t WHERE ${gone}`, [source])
  const count = Number(n.rows[0]?.n ?? 0)
  if (count === 0) return { count, ids: [] }
  const ids = await pool.query<{ legacy_id: string }>(
    `SELECT t.legacy_id FROM ${target} t WHERE ${gone} ORDER BY t.legacy_id LIMIT ${MAX_DELETED_IDS}`,
    [source],
  )
  return { count, ids: ids.rows.map((r) => r.legacy_id) }
}
