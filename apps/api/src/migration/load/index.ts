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
import { prepareOutputDir } from '../profile'
import { DUMMY_ARGON2_HASH, NOT_A_HASH, dummyBcryptHash } from '../anonymise/passwords'
import { classroomsStep, enrolmentsStep, subscriptionsStep } from './class-steps'
import { CoreContext, type CoreOptions } from './context'
import { DEFAULT_OUT_DIR, writeRestrictedIds } from './restricted'
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
  /** Folder (a `.migration-out` folder) of the restricted id file. Default `<repo>/.migration-out`. */
  outDir?: string
  /** Test seam (as in `migrate:activity`): wraps the steps, for example to inject a failure after batch N. */
  transformSteps?: (steps: AnyEntityStep[]) => AnyEntityStep[]
}

export interface CoreRunResult {
  report: RunReport
  core: CoreContext
  /** Path of the mode-0600 restricted id file (Q11); set by an `--apply` (also a failed one) that had ids to write. */
  restrictedFile?: string
}

export const ROSTER_HASHES_WARNING =
  'warning: PP_MIGRATE_ROSTER_DEFAULT_HASHES is unset or empty; accounts holding the shared roster default password are NOT flagged must_reset_password.'

/** Q10: how many shared roster default hashes the run knows (never the hashes), and a warning flag when there are none. */
function noteRosterHashes(core: CoreContext, mode: RunMode): void {
  const n = core.defaultHashes.size
  core.notes.counters.set('rosterDefaultHashes', n)
  core.notes.counters.set('rosterDefaultHashesWarning', n === 0 ? 1 : 0)
  if (n === 0 && mode === 'apply') core.options.warn?.(ROSTER_HASHES_WARNING)
}

/**
 * Q11, after a resumed or interrupted apply: the notes only saw the batches this process loaded (a resume starts after the
 * checkpoint, and a failed batch was rolled back after its ids were noted). So the two counts and the id lists are rebuilt
 * from the committed v2 `users` rows (read-only), which is the truth whatever the batch history was. Also rebuilt:
 * `must_reset.roster_account` (night check C5).
 */
async function recountFromCommitted(pool: Pick<pg.Pool, 'query'>, core: CoreContext): Promise<void> {
  const res = await pool.query<{ legacy_id: string; null_hash: boolean; loginless: boolean }>(
    `SELECT legacy_id,
            (password_hash IS NULL) AS null_hash,
            (must_reset_password AND username IS NULL AND email IS NULL) AS loginless
     FROM users
     WHERE legacy_source = $1
       AND (password_hash IS NULL OR (must_reset_password AND username IS NULL AND email IS NULL))
     ORDER BY length(legacy_id), legacy_id`,
    [core.source],
  )
  const nulls = res.rows.filter((r) => r.null_hash).map((r) => r.legacy_id)
  const loginless = res.rows.filter((r) => r.loginless).map((r) => r.legacy_id)
  core.notes.restricted.set('nullHashAccounts', nulls)
  core.notes.restricted.set('flaggedWithoutLoginId', loginless)
  core.notes.counters.set('nullHashAccounts', nulls.length)
  core.notes.counters.set('flaggedWithoutLoginId', loginless.length)
  // `must_reset.roster_account` follows the TRANSFORM's definition (and the night check C5): a username and no valid e-mail in the
  // STAGED row, judged before dropDuplicateLogins. The committed row alone cannot say it (a dropped duplicate username or e-mail
  // changes `username` / `email` after the decision), so the committed users are joined to their staged rows.
  const roster = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n
     FROM users x
     JOIN "${STAGING_SCHEMA}"."users" s ON s.id::text = x.legacy_id
     WHERE x.legacy_source = $1
       AND nullif(btrim(s.username, E' \\t\\r\\n\\f\\v'), '') IS NOT NULL
       AND (nullif(lower(btrim(s.email, E' \\t\\r\\n\\f\\v')), '') IS NULL
            OR lower(btrim(s.email, E' \\t\\r\\n\\f\\v')) !~ '^[^\\s@]+@[^\\s@]+$')`,
    [core.source],
  )
  core.notes.counters.set('must_reset.roster_account', Number(roster.rows[0]?.n ?? 0))
  // `must_reset.non_bcrypt` and `must_reset.shared_default` are NOT rebuilt (the second needs the secret list): after a resume
  // they only cover the batches of this process, which `countsFromCommittedRows` says.
  core.notes.counters.set('countsFromCommittedRows', 1)
}

/** Counters copied into `etl_runs.counters -> 'notes'` (numbers only; the night SQL checks read them). Never ids or hashes. */
const LEDGER_NOTES = /^(must_reset\..+|nullHashAccounts|flaggedWithoutLoginId|rosterDefaultHashes|rosterDefaultHashesWarning|countsFromCommittedRows)$/

/**
 * Merges the report counters into the apply run's `counters` JSON under `notes` (`jsonb_set`, so the runner's per-entity
 * counts stay). The run is the latest apply row of this input hash: the one that just finished or failed.
 */
async function saveNotesToRun(pool: Pick<pg.Pool, 'query'>, core: CoreContext, inputHash: string): Promise<void> {
  const notes = Object.fromEntries([...core.notes.counters].filter(([k, v]) => LEDGER_NOTES.test(k) && Number.isFinite(v)))
  await pool.query(
    `UPDATE etl_runs SET counters = jsonb_set(coalesce(counters, '{}'::jsonb), '{notes}', $2::jsonb)
     WHERE id = (SELECT max(id) FROM etl_runs WHERE mode = 'apply' AND input_hash = $1)`,
    [inputHash, JSON.stringify(notes)],
  )
}

/** Runs the whole command through the kit runner (dry-run by default; apply needs a passing dry-run on the same input). */
export async function runCore(options: CoreRunOptions): Promise<CoreRunResult> {
  const { mode, batchSize, gitSha, outDir, ...coreOptions } = options
  const core = new CoreContext(coreOptions)
  await assertNotSyntheticInProduction(options.pool, options.env)
  noteRosterHashes(core, mode)
  const steps = buildCoreSteps(core)
  const runSteps = options.transformSteps ? options.transformSteps(steps) : steps
  const defaults = createHash('sha256').update([...core.defaultHashes].sort().join('\n')).digest('hex')
  const inputHash = hashInput([
    ...(await stagingFingerprint(options.pool)),
    `as-of=${options.asOf}`,
    `source=${options.source}`,
    `steps=${steps.map((s) => s.entity).join(',')}`,
    `default-hashes=${defaults}`,
  ])
  const runner = new Runner({ pool: options.pool, env: options.env })
  const out = outDir ?? DEFAULT_OUT_DIR
  // Fail before anything is written when the restricted file could not be placed afterwards (an unsafe folder).
  if (mode === 'apply') prepareOutputDir(out)
  const writeFile = (runId: string): string | undefined =>
    writeRestrictedIds(core.notes.restricted, { runId, generatedAt: new Date().toISOString() }, out)
  let report: RunReport
  try {
    report = await runner.run({ mode, steps: runSteps, inputHash, gitSha, batchSize })
  } catch (err) {
    // An apply that stopped after committing user batches still needs its list (best effort; the original error wins).
    if (mode === 'apply' && core.notes.counters.has('nullHashAccounts')) {
      try {
        await recountFromCommitted(options.pool, core)
        const file = writeFile('interrupted')
        if (file !== undefined) core.options.warn?.(`restricted id file (mode 0600, delete within 7 days): ${file}`)
        await saveNotesToRun(options.pool, core, inputHash)
      } catch {
        // nothing more can be done here
      }
    }
    throw err
  }
  let restrictedFile: string | undefined
  if (mode === 'apply') {
    if (report.resumedBatches > 0) await recountFromCommitted(options.pool, core)
    await saveNotesToRun(options.pool, core, inputHash)
    restrictedFile = writeFile(report.runId)
  }
  return { report, core, restrictedFile }
}
