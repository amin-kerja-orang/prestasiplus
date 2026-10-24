/**
 * Preflight and input fingerprint of `migrate:activity` (BE-29).
 *
 * The command needs BE-28's ids: every row it loads points at a user, school, subject, chapter, topic or
 * class through `etl_id_map`. So it refuses to start (dry-run too) unless
 *   1. the `users` id map for the source is not empty, and
 *   2. a BE-28 `--apply` run finished `succeeded` on the SAME staged input as the one in the database now.
 * Only the existing kit / BE-28 run tables are read; this file adds no table.
 */
import { createHash } from 'node:crypto'

import type pg from 'pg'

import { ARCHIVE_SCHEMA, STAGING_SCHEMA, findTable } from '../../ddl/spec'
import { ApplyGuardError } from '../../kit/apply-guard'
import { hashInput, tableDigest } from '../../kit/sql'
import type { LegacySource } from '../../kit/types'
import { originsOf } from '../../../modules/content/shared/sanitize-html.sanitizer'
import { parseDefaultHashes } from '../../transform/secrets'
import { stagingFingerprint } from '../index'

/** Raised when BE-28 has not run (or ran on other data). The CLI maps it to exit code 2 like the apply guard. */
export class PreflightError extends ApplyGuardError {}

export const RUN_CORE_FIRST = 'run `migrate:core --apply` first'

/**
 * Every table BE-29 may read, so a change in any of them changes the input hash (a dry-run then no longer
 * authorises an apply). `archive_cloud.` marks the question-bank tables read for the snapshot join.
 * The sensitive categories (Q7, see not-migrated.ts) are NOT here: they are never read.
 */
export const ACTIVITY_READ_TABLES: readonly string[] = [
  'users',
  'gamification_tiers', 'achievements', 'achievement_user', 'challenges', 'challenge_user', 'reward_settings',
  'student_wallets', 'coin_transactions',
  'practice_sessions', 'question_attempts', 'exam_attempts', 'attempt_statuses',
  'banners', 'articles', 'notes', 'videos', 'audio_kbat', 'question_sets',
  'support_tickets', 'timeline_entries', 'feedback',
  'archive_cloud.question_set_items',
  'archive_cloud.questions', 'archive_cloud.question_options', 'archive_cloud.legacy_canonical_map',
  'archive_cloud.exam_questions', 'archive_cloud.source_papers', 'archive_cloud.exam_papers',
]

/** The BE-28 entities whose id maps the activity steps resolve (their count is part of the input hash). */
export const CORE_ID_MAP_ENTITIES: readonly string[] = [
  'users', 'schools', 'education_levels', 'subjects', 'chapters', 'topics', 'classrooms',
]

function qualified(name: string): { schema: string; table: string } {
  const dot = name.indexOf('.')
  if (dot === -1) return { schema: STAGING_SCHEMA, table: name }
  const prefix = name.slice(0, dot)
  if (prefix !== ARCHIVE_SCHEMA) throw new RangeError(`Unknown schema prefix in "${name}".`)
  return { schema: ARCHIVE_SCHEMA, table: name.slice(dot + 1) }
}

/**
 * `table=<rows>:<digest>` for each table, with the constant-memory digest shared with BE-28's `stagingFingerprint`
 * (`tableDigest` in the kit): order-independent and deterministic.
 */
export async function tableFingerprints(pool: Pick<pg.Pool, 'query'>, names: readonly string[]): Promise<string[]> {
  const parts: string[] = []
  for (const name of [...new Set(names)].sort()) {
    const { schema, table } = qualified(name)
    const spec = findTable(table)
    if (!spec) throw new RangeError(`Table "${table}" is not in the staging spec.`)
    const { n, h } = await tableDigest(pool, schema, table)
    parts.push(`${schema === ARCHIVE_SCHEMA ? `${ARCHIVE_SCHEMA}.` : ''}${table}=${n}:${h}`)
  }
  return parts
}

/** Counts of the BE-28 id maps this command depends on, e.g. `users=11,schools=3,...`. */
export async function coreMapCounts(pool: Pick<pg.Pool, 'query'>, source: LegacySource): Promise<string> {
  const res = await pool.query<{ entity: string; n: string }>(
    `SELECT entity, count(*)::text AS n FROM etl_id_map WHERE legacy_source = $1 AND entity = ANY($2::text[]) GROUP BY entity`,
    [source, [...CORE_ID_MAP_ENTITIES]],
  )
  const by = new Map(res.rows.map((r) => [r.entity, r.n]))
  return CORE_ID_MAP_ENTITIES.map((e) => `${e}=${by.get(e) ?? '0'}`).join(',')
}

export interface ActivityHashInput {
  pool: Pick<pg.Pool, 'query'>
  source: LegacySource
  asOf: string
  /** Entity names of the selected steps, in run order. */
  stepNames: readonly string[]
  /** Extra tables a group declared in `reads`. */
  extraTables?: readonly string[]
  /** `--content-owner` (a v2 user id): the owner of the content rows is part of what an apply writes. */
  contentOwnerUserId?: string
  /** The run's raw `PUBLIC_ORIGINS`: it decides which absolute image URLs survive HTML sanitising, so it is part of what an apply writes. */
  publicOrigins?: string
  /** SHA-256 of the `SHA256SUMS` of `--files-dir` (absent without the flag): the files an apply copies are part of its input. */
  filesManifestHash?: string
}

/** The sanitiser configuration as it is hashed: the normalised origins, sorted and de-duplicated, or `none`. */
export function sanitizerConfigOf(publicOrigins: string | undefined): string {
  return [...new Set(originsOf(publicOrigins))].sort().join(',') || 'none'
}

/** The input hash of a run: staged fingerprints, as-of, source, step list, the BE-28 id-map counts, the content owner and the sanitiser origins. */
export async function activityInputHash(input: ActivityHashInput): Promise<string> {
  const tables = [...ACTIVITY_READ_TABLES, ...(input.extraTables ?? [])]
  return hashInput([
    ...(await tableFingerprints(input.pool, tables)),
    `as-of=${input.asOf}`,
    `source=${input.source}`,
    `steps=${input.stepNames.join(',')}`,
    `core-map=${await coreMapCounts(input.pool, input.source)}`,
    `content-owner=${input.contentOwnerUserId?.trim() || 'none'}`,
    `sanitizer-origins=${sanitizerConfigOf(input.publicOrigins)}`,
    `files-manifest=${input.filesManifestHash ?? 'none'}`,
  ])
}

const DAY_MS = 86_400_000

/** Candidate `--as-of` values BE-28 may have been run with: the given one, else the run's own date (UTC, KL) and the day before. */
function coreAsOfCandidates(given: string | undefined, fallback: string, startedAt: Date): string[] {
  if (given) return [given]
  const iso = (ms: number): string => new Date(ms).toISOString().slice(0, 10)
  const t = startedAt.getTime()
  return [...new Set([fallback, iso(t), iso(t + 8 * 3_600_000), iso(t - DAY_MS), iso(t + 8 * 3_600_000 - DAY_MS)])]
}

export interface PreflightOptions {
  pool: Pick<pg.Pool, 'query'>
  env: Readonly<Record<string, string | undefined>>
  source: LegacySource
  /** This run's `--as-of` (a fallback guess for the as-of BE-28 used). */
  asOf: string
  /** The `--as-of` that `migrate:core` was run with, when it is not the run's own date. */
  coreAsOf?: string
}

/**
 * Refuses to go on unless BE-28 loaded the ids this command needs from the staged data that is in the
 * database now. The BE-28 input hash is recomputed (staging fingerprint, as-of, source, its step list, its
 * default-hash setting) and compared with the stored hash of its succeeded apply runs.
 *
 * @returns the number of mapped users.
 */
export async function assertCorePreflight(options: PreflightOptions): Promise<number> {
  const { pool, env, source } = options
  const users = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM etl_id_map WHERE legacy_source = $1 AND entity = 'users'`,
    [source],
  )
  const mapped = Number(users.rows[0]?.n ?? 0)
  if (mapped === 0) {
    throw new PreflightError(`Preflight failed: no migrated users in etl_id_map. ${RUN_CORE_FIRST}.`)
  }

  const runs = await pool.query<{ entity_set: string[]; input_hash: string | null; started_at: Date }>(
    `SELECT entity_set, input_hash, started_at FROM etl_runs
     WHERE mode = 'apply' AND status = 'succeeded' AND input_hash IS NOT NULL
       AND sources @> ARRAY[$1]::text[] AND entity_set @> ARRAY['users', 'classrooms']::text[]
     ORDER BY id DESC LIMIT 20`,
    [source],
  )
  if (runs.rows.length > 0) {
    const fingerprint = await stagingFingerprint(pool)
    const defaults = createHash('sha256')
      .update([...parseDefaultHashes(env.PP_MIGRATE_ROSTER_DEFAULT_HASHES)].sort().join('\n'))
      .digest('hex')
    for (const run of runs.rows) {
      for (const asOf of coreAsOfCandidates(options.coreAsOf, options.asOf, run.started_at)) {
        const expected = hashInput([
          ...fingerprint,
          `as-of=${asOf}`,
          `source=${source}`,
          `steps=${run.entity_set.join(',')}`,
          `default-hashes=${defaults}`,
        ])
        if (expected === run.input_hash) return mapped
      }
    }
  }
  throw new PreflightError(
    `Preflight failed: no succeeded migrate:core --apply run matches the staged data now in staging_cloud (or it was run ` +
      `with another --as-of or roster default-hash setting). ${RUN_CORE_FIRST}; pass --core-as-of=YYYY-MM-DD if it ran on another date.`,
  )
}
