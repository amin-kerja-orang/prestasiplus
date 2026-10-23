/**
 * BE-28 `migrate:core`: ETL of reference data, identity and classes from `staging_cloud` into the v2 tables.
 * Entry points: `buildCoreSteps` (the ordered entity steps), `runCore` (guards + the kit runner + report).
 */
import { createHash } from 'node:crypto'

import type pg from 'pg'

import { STAGING_SCHEMA } from '../ddl/spec'
import { ApplyGuardError } from '../kit/apply-guard'
import { hashInput, tableDigest } from '../kit/sql'
import { Runner, type AnyEntityStep, type RunReport } from '../kit/runner'
import type { RunMode } from '../kit/types'
import { DUMMY_ARGON2_HASH, NOT_A_HASH, dummyBcryptHash } from '../anonymise/passwords'
import { classroomsStep, enrolmentsStep, subscriptionsStep } from './class-steps'
import { CoreContext, type CoreOptions } from './context'
import { parentLinksStep, usersStep } from './identity-steps'
import {
  chaptersStep,
  educationLevelsStep,
  jpnsStep,
  ppdsStep,
  schoolsStep,
  subjectLevelsStep,
  subjectsStep,
  topicsStep,
} from './reference-steps'

export { CoreContext, CoreNotes, type CoreOptions } from './context'

/** Load order: parents before children (v2-data-migration.md 6.1 steps 1 and 2). */
export function buildCoreSteps(core: CoreContext): AnyEntityStep[] {
  return [
    educationLevelsStep(core),
    subjectsStep(core),
    chaptersStep(core),
    topicsStep(core),
    subjectLevelsStep(core),
    jpnsStep(core),
    ppdsStep(core),
    schoolsStep(core),
    usersStep(core),
    parentLinksStep(core),
    classroomsStep(core),
    enrolmentsStep(core),
    subscriptionsStep(core),
  ]
}

/** Inventory tables of step 1 and 2 that this command does not load, with the reason (printed in the report). */
export const NOT_MIGRATED: readonly { table: string; reason: string }[] = [
  { table: 'packages', reason: 'OD-27: no v2 owner (Sistem store is backlog); listed only' },
  { table: 'settings', reason: 'no v2 table yet (plan 14.7 B1); staged and profiled only' },
  { table: 'feature_flags', reason: 'no v2 table yet (plan 14.7 B1); staged and profiled only' },
  { table: 'gamification_tiers', reason: 'BE-29 wave (wallet and rewards)' },
  { table: 'achievements', reason: 'BE-29 wave (gamification)' },
  { table: 'challenges', reason: 'BE-29 wave (gamification); teacher challenges have no v2 target (GAP-11)' },
  { table: 'pksk_packages / pksk_accesses', reason: 'BE-29 wave (PKSK)' },
  { table: 'student_wallets', reason: 'BE-29 wave (wallet)' },
  { table: 'users.parent_invite_token', reason: 'redacted at staging (M4); pending invites are re-issued by the product, not migrated' },
  { table: 'users.faith / google_id / referral_code / spm_targets / notifications_read_at', reason: 'dropped (Q7) or no v2 target' },
]

/** Known synthetic password markers (BE-35): staging data carrying them must never reach a production database. */
const SYNTHETIC_PASSWORDS = [dummyBcryptHash('2y'), dummyBcryptHash('2a'), dummyBcryptHash('2b'), DUMMY_ARGON2_HASH, NOT_A_HASH]

export class SyntheticDataRefusedError extends ApplyGuardError {}

const isProduction = (env: Readonly<Record<string, string | undefined>>): boolean => /^\s*prod(uction)?\s*$/i.test(env.NODE_ENV ?? '')

/** BE-35 deviation: an anonymised or synthetic dump (known dummy password) must not be migrated in production. */
export async function assertNotSyntheticInProduction(
  pool: Pick<pg.Pool, 'query'>,
  env: Readonly<Record<string, string | undefined>>,
): Promise<void> {
  if (!isProduction(env)) return
  const res = await pool.query(
    `SELECT 1 FROM "${STAGING_SCHEMA}"."users" WHERE password = ANY($1::text[]) LIMIT 1`,
    [SYNTHETIC_PASSWORDS],
  )
  if ((res.rowCount ?? 0) > 0) {
    throw new SyntheticDataRefusedError(
      'Refusing to migrate in production: staging_cloud holds the dummy password hashes of an anonymised or synthetic dump.',
    )
  }
}

/**
 * A fingerprint of the staged input: row count and a constant-memory digest of the loader's row hashes (`tableDigest`, shared with
 * BE-29), per table the command reads. Input hashes stored before MIG-07 used `md5(string_agg(...))`; there were no production
 * runs, so they are not kept valid: runs made before this change must be re-run, dry-run then apply.
 */
export async function stagingFingerprint(pool: Pick<pg.Pool, 'query'>): Promise<string[]> {
  const tables = [
    'education_levels', 'subjects', 'chapters', 'topics', 'schools', 'users', 'parent_student',
    'classrooms', 'classroom_student', 'school_subscriptions',
  ]
  const parts: string[] = []
  for (const t of tables) {
    const { n, h } = await tableDigest(pool, STAGING_SCHEMA, t)
    parts.push(`${t}=${n}:${h}`)
  }
  return parts
}

export interface CoreRunOptions extends Omit<CoreOptions, 'pool'> {
  pool: pg.Pool
  mode: RunMode
  batchSize?: number
  gitSha?: string | null
}

export interface CoreRunResult {
  report: RunReport
  core: CoreContext
}

/** Runs the whole command through the kit runner (dry-run by default; apply needs a passing dry-run on the same input). */
export async function runCore(options: CoreRunOptions): Promise<CoreRunResult> {
  const { mode, batchSize, gitSha, ...coreOptions } = options
  const core = new CoreContext(coreOptions)
  await assertNotSyntheticInProduction(options.pool, options.env)
  const steps = buildCoreSteps(core)
  const defaults = createHash('sha256').update([...core.defaultHashes].sort().join('\n')).digest('hex')
  const inputHash = hashInput([
    ...(await stagingFingerprint(options.pool)),
    `as-of=${options.asOf}`,
    `source=${options.source}`,
    `steps=${steps.map((s) => s.entity).join(',')}`,
    `default-hashes=${defaults}`,
  ])
  const runner = new Runner({ pool: options.pool, env: options.env })
  const report = await runner.run({ mode, steps, inputHash, gitSha, batchSize })
  return { report, core }
}
