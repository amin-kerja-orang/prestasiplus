/**
 * Q10/Q11 on a real PostgreSQL and the BE-35 `cloud-tiny` fixture: the roster default hash warning and the login-less
 * account report of `migrate:core`. Fixture facts: 15 users are read and 12 load; users 9, 10 and 11 end with a NULL password hash
 * (plaintext-like, empty, null); user 3 is a roster account whose username repeats user 1's in the same school, so
 * `dropDuplicateLogins` leaves it with neither username nor e-mail. The spec also strips users 5 and 10 of both identifiers: user 10 is flagged (NULL hash), user 5 keeps a good bcrypt hash and is NOT
 * flagged, so it must not be counted.
 * Ids of those accounts may appear in the mode-0600 restricted file only.
 */
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../../prisma/seed'
import { schoolPackagesSeed } from '../../../prisma/seed/core/school-packages'
import { curriculumSeed } from '../../../prisma/seed/curriculum'
import type { AnyEntityStep } from '../../../src/migration/kit/runner'
import { ApplyRefusedError } from '../../../src/migration/kit'
import { ROSTER_HASHES_WARNING, runCore } from '../../../src/migration/load'
import { migrateCore } from '../../../src/migration/load/command'
import { loadStaging } from '../../../src/migration/staging/load'
import { DirReader } from '../../../src/migration/staging/readers'
import { capture, createStagingDb, FIXTURE_DIR, REPO_ROOT, stagingEnv, type StagingDb } from '../staging/helpers'

const AS_OF = '2026-06-01'
/** Not real hashes: the loader only compares the staged password text to this list. */
const TWO_HASHES = `$2y$10$${'a'.repeat(53)},$2y$10$${'b'.repeat(53)}`
let env: StagingDb
let baseEnv: Record<string, string>
let outDir: string
const strayFiles: string[] = []

beforeAll(async () => {
  env = await createStagingDb()
  baseEnv = { NODE_ENV: 'test', IC_HASH_KEY: 'fixture-ic-key-0123456789', PP_ALLOW_MIGRATE_APPLY: '1' }
  await loadStaging(env.pool, new DirReader(FIXTURE_DIR), { env: stagingEnv(env.db) })
  await runSeeds([schoolPackagesSeed, curriculumSeed], { prisma: env.db.prisma })
  await env.pool.query(`update staging_cloud.users set kelas = '4 Amanah' where role = 'pelajar'`)
  await env.pool.query(`update staging_cloud.education_levels set name_bm = 'Darjah 1' where id = 1`)
  await env.pool.query(`update staging_cloud.users set email = null, username = null where id in (5, 10)`)
  mkdirSync(join(REPO_ROOT, '.migration-out'), { recursive: true })
  outDir = mkdtempSync(join(REPO_ROOT, '.migration-out', 'q10-test-'))
}, 300_000)
afterAll(async () => {
  rmSync(outDir, { recursive: true, force: true })
  for (const f of strayFiles) rmSync(f, { force: true })
  await env?.close()
})

/** `etl_runs.counters -> 'notes'` of a run, and the entity counters next to it. */
async function ledgerNotes(pool: StagingDb['pool'], runId: string): Promise<{ notes: Record<string, unknown> | null; users: unknown }> {
  const r = await pool.query<{ notes: Record<string, unknown> | null; users: unknown }>(
    `select counters -> 'notes' as notes, counters -> 'users' as users from etl_runs where id = $1::bigint`,
    [runId],
  )
  return r.rows[0] as { notes: Record<string, unknown> | null; users: unknown }
}
const expectNumbersOnly = (notes: Record<string, unknown> | null): Record<string, number> => {
  expect(notes).not.toBeNull()
  for (const [k, v] of Object.entries(notes ?? {})) expect(typeof v, k).toBe('number')
  return notes as Record<string, number>
}

const failOnce = (entity: string, batch: number) => {
  let failed = false
  return (steps: AnyEntityStep[]): AnyEntityStep[] =>
    steps.map((st) =>
      st.entity !== entity
        ? st
        : {
            ...st,
            async load(rows: unknown[], ctx: Parameters<AnyEntityStep['load']>[1]) {
              const result = await st.load(rows, ctx) // the batch is loaded (and noted), then its transaction is rolled back
              if (ctx.batch === batch && !failed) {
                failed = true
                throw new Error('injected failure')
              }
              return result
            },
          },
    )
}

const files = (): string[] => readdirSync(outDir).filter((f) => f.startsWith('core-login-gaps-'))

async function run(mode: 'dry-run' | 'apply', extra: Record<string, string> = {}) {
  const warnings: string[] = []
  const r = await runCore({
    pool: env.pool, env: { ...baseEnv, ...extra }, source: 'cloud', asOf: AS_OF, mode, batchSize: 2, outDir, warn: (l) => void warnings.push(l),
  })
  expect(r.report.status).toBe('succeeded')
  return { ...r, warnings }
}

describe('Q10: roster default hashes', () => {
  it('unset: a dry-run records count 0 and the warning flag, but logs nothing', async () => {
    const { core, warnings } = await run('dry-run')
    expect(core.notes.counters.get('rosterDefaultHashes')).toBe(0)
    expect(core.notes.counters.get('rosterDefaultHashesWarning')).toBe(1)
    expect(warnings).toEqual([])
  }, 120_000)

  it('unset or empty: --apply logs one warning line and records count 0 plus the flag', async () => {
    const { core, warnings } = await run('apply')
    expect(warnings).toEqual([ROSTER_HASHES_WARNING])
    expect(core.notes.counters.get('rosterDefaultHashes')).toBe(0)
    expect(core.notes.counters.get('rosterDefaultHashesWarning')).toBe(1)
    await run('dry-run', { PP_MIGRATE_ROSTER_DEFAULT_HASHES: ' , ' })
    const empty = await run('apply', { PP_MIGRATE_ROSTER_DEFAULT_HASHES: ' , ' })
    expect(empty.warnings).toEqual([ROSTER_HASHES_WARNING])
    expect(empty.core.notes.counters.get('rosterDefaultHashes')).toBe(0)
  }, 240_000)

  it('two hashes: count 2, flag 0, no warning, and no hash is printed', async () => {
    const extra = { PP_MIGRATE_ROSTER_DEFAULT_HASHES: TWO_HASHES }
    await run('dry-run', extra)
    const { core, warnings } = await run('apply', extra)
    expect(core.notes.counters.get('rosterDefaultHashes')).toBe(2)
    expect(core.notes.counters.get('rosterDefaultHashesWarning')).toBe(0)
    expect(warnings).toEqual([])
    expect(JSON.stringify([...core.notes.counters])).not.toContain('$2y$')
    expect(ROSTER_HASHES_WARNING).not.toMatch(/\$2[abxy]\$/)
  }, 240_000)
})

describe('Q11: accounts without a way to log in', () => {
  it('counts them, and writes their ids to the restricted file only', async () => {
    const before = new Set(files())
    const { core, restrictedFile, report } = await run('apply')
    expect(core.notes.counters.get('nullHashAccounts')).toBe(3)
    expect(core.notes.counters.get('flaggedWithoutLoginId')).toBe(2)
    // the per-reason flag counts exist already
    expect(core.notes.counters.get('must_reset.non_bcrypt')).toBeGreaterThanOrEqual(3)
    expect(core.notes.counters.get('must_reset.roster_account')).toBe(1) // user 3: username in the staged row, no e-mail
    expect(core.notes.counters.get('must_reset.shared_default')).toBe(0) // present as 0, not absent (night check C5)
    // ids are not in the aggregate notes
    expect(core.notes.ids.has('nullHashAccounts')).toBe(false)
    expect(core.notes.ids.has('flaggedWithoutLoginId')).toBe(false)

    // the ledger carries the same counters under counters -> 'notes' (numbers only), next to the runner's entity counters
    const ledger = await ledgerNotes(env.pool, report.runId)
    const notes = expectNumbersOnly(ledger.notes)
    expect(ledger.users, 'the runner counters are kept').toMatchObject({ read: 15 })
    expect(notes).toMatchObject({
      rosterDefaultHashes: 0, rosterDefaultHashesWarning: 1, nullHashAccounts: 3, flaggedWithoutLoginId: 2,
      'must_reset.roster_account': 1, 'must_reset.shared_default': 0,
    })
    expect(Object.keys(notes).every((k) => /^(must_reset\.|users\.role_rejected\.|nullHashAccounts$|flaggedWithoutLoginId$|rosterDefaultHashes|countsFromCommittedRows$)/.test(k))).toBe(true)
    expect(JSON.stringify(ledger.notes)).not.toMatch(/\[|"[0-9]+"/) // no id list, no id as a value

    expect(restrictedFile).toBeDefined()
    expect(files().filter((f) => !before.has(f))).toHaveLength(1)
    expect(statSync(restrictedFile as string).mode & 0o777).toBe(0o600)
    const body = JSON.parse(readFileSync(restrictedFile as string, 'utf8')) as { runId: string; ids: Record<string, string[]> }
    expect(body.runId).toBe(report.runId)
    expect(body.ids).toEqual({ flaggedWithoutLoginId: ['3', '10'], nullHashAccounts: ['9', '10', '11'] })
  }, 240_000)

  it('a dry-run writes no file and returns no path', async () => {
    const before = files()
    const { restrictedFile, core } = await run('dry-run')
    expect(restrictedFile).toBeUndefined()
    expect(files()).toEqual(before)
    expect(core.notes.counters.get('nullHashAccounts')).toBe(3) // the counts are still reported
  }, 120_000)

  it('migrate:core prints the counts and the file path, never the ids', async () => {
    const flags = new Map<string, string | true>([['as-of', AS_OF], ['batch-size', '5']])
    const exec = async (mode: 'dry-run' | 'apply') => {
      const io = capture()
      const code = await migrateCore.run({ mode, flags, positional: [] }, { pool: env.pool, env: { ...baseEnv, NODE_ENV: 'test' }, out: io.out, err: io.err })
      return { code, text: io.text() }
    }
    // the command writes into the default `.migration-out`; this run is only about what it prints
    const dry = await exec('dry-run')
    expect(dry.code, dry.text).toBe(0)
    expect(dry.text).toContain('note nullHashAccounts: 3')
    expect(dry.text).toContain('note flaggedWithoutLoginId: 2')
    expect(dry.text).toContain('note rosterDefaultHashes: 0')
    expect(dry.text).toContain('note rosterDefaultHashesWarning: 1')
    expect(dry.text).not.toContain('restricted id file')
    const applied = await exec('apply')
    expect(applied.code, applied.text).toBe(0)
    expect(applied.text).toContain(ROSTER_HASHES_WARNING)
    const path = /restricted id file \(mode 0600, delete within 7 days\): (.+)$/m.exec(applied.text)?.[1]
    expect(path).toBeDefined()
    if (path !== undefined) strayFiles.push(path) // removed in afterAll, also when an assertion below fails
    expect(applied.text).not.toMatch(/ids (nullHashAccounts|flaggedWithoutLoginId)/)
    expect(applied.text).not.toMatch(/(nullHashAccounts|flaggedWithoutLoginId)[^\n]*:[^\n]*[,\[]/)
    expect(statSync(path as string).mode & 0o777).toBe(0o600)
  }, 240_000)
})

describe('Q11 after an interrupted and resumed apply', () => {
  let env2: StagingDb
  const dir2 = (): string => mkdtempSync(join(REPO_ROOT, '.migration-out', 'q10-resume-'))
  const dirs: string[] = []
  beforeAll(async () => {
    env2 = await createStagingDb()
    await loadStaging(env2.pool, new DirReader(FIXTURE_DIR), { env: stagingEnv(env2.db) })
    await runSeeds([schoolPackagesSeed, curriculumSeed], { prisma: env2.db.prisma })
    await env2.pool.query(`update staging_cloud.users set kelas = '4 Amanah' where role = 'pelajar'`)
    await env2.pool.query(`update staging_cloud.education_levels set name_bm = 'Darjah 1' where id = 1`)
    await env2.pool.query(`update staging_cloud.users set email = null, username = null where id in (5, 10)`)
  }, 300_000)
  afterAll(async () => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true })
    await env2?.close()
  })

  it('writes the file of the committed batches when the apply fails, and counts everything after the resume', async () => {
    const out1 = dir2()
    const out2 = dir2()
    dirs.push(out1, out2)
    const base = { pool: env2.pool, env: baseEnv, source: 'cloud' as const, asOf: AS_OF, batchSize: 2 }
    expect((await runCore({ ...base, mode: 'dry-run' })).report.status).toBe('succeeded')

    // Users are read two per batch in id order: batches 1 to 4 hold users 1..8 (user 3 is login-less); batch 5 (users 9, 10:
    // NULL hash, 10 login-less) fails and is rolled back, although the notes already saw it.
    const warnings: string[] = []
    await expect(
      runCore({ ...base, mode: 'apply', outDir: out1, transformSteps: failOnce('users', 5), warn: (l) => void warnings.push(l) }),
    ).rejects.toThrow('injected failure')
    const written = readdirSync(out1).filter((f) => f.startsWith('core-login-gaps-'))
    expect(written).toHaveLength(1)
    expect(statSync(join(out1, written[0] as string)).mode & 0o777).toBe(0o600)
    expect((JSON.parse(readFileSync(join(out1, written[0] as string), 'utf8')) as { ids: unknown }).ids).toEqual({ flaggedWithoutLoginId: ['3'] })
    expect(warnings.some((w) => w.includes('restricted id file'))).toBe(true)

    const failedRun = await env2.pool.query<{ id: string }>(`select id::text from etl_runs where mode = 'apply' order by id desc limit 1`)
    const failedLedger = await ledgerNotes(env2.pool, failedRun.rows[0]?.id as string)
    expect(failedLedger.users, 'the committed batches keep their runner counters next to the notes').toMatchObject({ read: 8 })
    const afterFailure = expectNumbersOnly(failedLedger.notes)
    expect(afterFailure.flaggedWithoutLoginId).toBe(1) // committed batches only: user 3
    expect(afterFailure.nullHashAccounts).toBe(0)

    const resumed = await runCore({ ...base, mode: 'apply', outDir: out2, warn: (l) => void warnings.push(l) })
    expect(resumed.report.status).toBe('succeeded')
    expect(resumed.report.resumedBatches).toBeGreaterThan(0)
    // This process only loaded batch 5 onwards; the counts still cover the whole load.
    expect(resumed.core.notes.counters.get('nullHashAccounts')).toBe(3)
    expect(resumed.core.notes.counters.get('flaggedWithoutLoginId')).toBe(2)
    expect(resumed.core.notes.counters.get('countsFromCommittedRows')).toBe(1)
    // user 3 was committed in batch 2, before the failure, and its username was dropped as a duplicate afterwards: it is a roster
    // account by the staged row (transform / C5 definition), which neither this process' notes nor the committed row alone show.
    expect(resumed.core.notes.counters.get('must_reset.roster_account')).toBe(1)
    expect((await env2.pool.query(`select username, email from users where legacy_id = '3'`)).rows).toEqual([{ username: null, email: null }])
    expect(resumed.report.runId).toBe(failedRun.rows[0]?.id) // the resume continues the failed run, so notes and counts share one row
    const finalLedger = await ledgerNotes(env2.pool, resumed.report.runId)
    expect(finalLedger.users, 'the runner counters survive the notes merge').toMatchObject({ read: 15 })
    const final = expectNumbersOnly(finalLedger.notes)
    expect(final).toMatchObject({ nullHashAccounts: 3, flaggedWithoutLoginId: 2, countsFromCommittedRows: 1, 'must_reset.roster_account': 1 })
    const body = JSON.parse(readFileSync(resumed.restrictedFile as string, 'utf8')) as { ids: Record<string, string[]> }
    expect(body.ids).toEqual({ flaggedWithoutLoginId: ['3', '10'], nullHashAccounts: ['9', '10', '11'] })
  }, 300_000)

  it('a refused apply (no passing dry-run) leaves the notes of the earlier apply row of the same input untouched', async () => {
    // Runs after the test above: env2 holds the dry-run and the succeeded apply of this input.
    const latest = async () =>
      (await env2.pool.query<{ id: string; notes: unknown }>(`select id::text, counters -> 'notes' as notes from etl_runs where mode = 'apply' order by id desc limit 1`)).rows[0] as { id: string; notes: unknown }
    const runs = async () => (await env2.pool.query<{ n: number }>(`select count(*)::int as n from etl_runs`)).rows[0]?.n
    const before = await latest()
    expectNumbersOnly(before.notes as Record<string, unknown>)
    const runsBefore = await runs()
    await env2.pool.query(`update etl_runs set status = 'failed' where mode = 'dry-run'`) // the apply gate now finds no passing dry-run
    const out = dir2()
    dirs.push(out)
    const warnings: string[] = []
    await expect(
      runCore({ pool: env2.pool, env: baseEnv, source: 'cloud', asOf: AS_OF, batchSize: 2, mode: 'apply', outDir: out, warn: (l) => void warnings.push(l) }),
    ).rejects.toBeInstanceOf(ApplyRefusedError)
    expect(await runs(), 'the refused run created no row').toBe(runsBefore)
    expect(await latest()).toEqual(before)
    expect(readdirSync(out).filter((f) => f.startsWith('core-login-gaps-')), 'no id file for a run that loaded nothing').toEqual([])
    expect(warnings.some((w) => w.includes('restricted id file'))).toBe(false)
  }, 120_000)
})

describe('Q10 after an interrupted and resumed apply: role rejects', () => {
  let env3: StagingDb
  let out: string
  beforeAll(async () => {
    env3 = await createStagingDb()
    await loadStaging(env3.pool, new DirReader(FIXTURE_DIR), { env: stagingEnv(env3.db) })
    await runSeeds([schoolPackagesSeed, curriculumSeed], { prisma: env3.db.prisma })
    await env3.pool.query(`update staging_cloud.users set kelas = '4 Amanah' where role = 'pelajar'`)
    await env3.pool.query(`update staging_cloud.education_levels set name_bm = 'Darjah 1' where id = 1`)
    await env3.pool.query(`update staging_cloud.users set email = null, username = null where id in (5, 10)`)
    out = mkdtempSync(join(REPO_ROOT, '.migration-out', 'q10-roles-'))
  }, 300_000)
  afterAll(async () => {
    if (out !== undefined) rmSync(out, { recursive: true, force: true })
    await env3?.close()
  })

  it('saves the rebuilt users.role_rejected.* counts together with the roster counters', async () => {
    const base = { pool: env3.pool, env: baseEnv, source: 'cloud' as const, asOf: AS_OF, batchSize: 2, outDir: out }
    expect((await runCore({ ...base, mode: 'dry-run' })).report.status).toBe('succeeded')

    // Users are read two per batch: batch 7 holds users 13 (unknown role `super_guru`, counted as `other`) and 14, committed;
    // batch 8 holds user 15 (`agent`, not migrated), which fails after being noted and is rolled back.
    await expect(runCore({ ...base, mode: 'apply', transformSteps: failOnce('users', 8) })).rejects.toThrow('injected failure')
    const failedRun = await env3.pool.query<{ id: string }>(`select id::text from etl_runs where mode = 'apply' order by id desc limit 1`)
    const failed = expectNumbersOnly((await ledgerNotes(env3.pool, failedRun.rows[0]?.id as string)).notes)
    expect(failed['users.role_rejected.other'], 'committed reject of user 13').toBe(1)
    expect(failed['users.role_rejected.agent'], 'the rolled-back batch is not counted').toBeUndefined()

    const resumed = await runCore({ ...base, mode: 'apply' })
    expect(resumed.report.status).toBe('succeeded')
    expect(resumed.report.resumedBatches).toBeGreaterThan(0)
    expect(resumed.report.runId).toBe(failedRun.rows[0]?.id)
    // This process only loaded batch 8: the `other` reject of batch 7 comes from the rebuild, not from this process.
    expect(resumed.core.notes.counters.get('users.role_rejected.other')).toBe(1)
    expect(resumed.core.notes.counters.get('users.role_rejected.agent')).toBe(1)
    const saved = expectNumbersOnly((await ledgerNotes(env3.pool, resumed.report.runId)).notes)
    expect(saved).toMatchObject({
      'users.role_rejected.other': 1, 'users.role_rejected.agent': 1, // rebuilt from the run's rejects
      nullHashAccounts: 3, flaggedWithoutLoginId: 2, countsFromCommittedRows: 1, 'must_reset.roster_account': 1, // Q10/Q11 recount
    })
    expect(Object.keys(saved).filter((k) => k.startsWith('users.role_rejected')).sort()).toEqual(['users.role_rejected.agent', 'users.role_rejected.other'])
  }, 300_000)
})

/** A fresh staging database set up like the other Q11 specs. */
async function freshEnv(): Promise<StagingDb> {
  const e = await createStagingDb()
  await loadStaging(e.pool, new DirReader(FIXTURE_DIR), { env: stagingEnv(e.db) })
  await runSeeds([schoolPackagesSeed, curriculumSeed], { prisma: e.db.prisma })
  await e.pool.query(`update staging_cloud.users set kelas = '4 Amanah' where role = 'pelajar'`)
  await e.pool.query(`update staging_cloud.education_levels set name_bm = 'Darjah 1' where id = 1`)
  await e.pool.query(`update staging_cloud.users set email = null, username = null where id in (5, 10)`)
  return e
}

describe('Q10/Q11 when every users batch was committed before the failure', () => {
  let envA: StagingDb
  const dirsA: string[] = []
  const newDir = (): string => {
    const d = mkdtempSync(join(REPO_ROOT, '.migration-out', 'q10-allusers-'))
    dirsA.push(d)
    return d
  }
  beforeAll(async () => {
    envA = await freshEnv()
  }, 300_000)
  afterAll(async () => {
    for (const d of dirsA) rmSync(d, { recursive: true, force: true })
    await envA?.close()
  })

  it('a resume that skips every users batch keeps the report counters out of the entity counters and the notes complete', async () => {
    const base = { pool: envA.pool, env: baseEnv, source: 'cloud' as const, asOf: AS_OF, batchSize: 2 }
    expect((await runCore({ ...base, mode: 'dry-run' })).report.status).toBe('succeeded')
    await expect(runCore({ ...base, mode: 'apply', outDir: newDir(), transformSteps: failOnce('classrooms', 1) })).rejects.toThrow('injected failure')

    const resumed = await runCore({ ...base, mode: 'apply', outDir: newDir() })
    expect(resumed.report.status).toBe('succeeded')

    // `notes` is not an entity
    expect.soft(resumed.report.counters).not.toHaveProperty('notes')
    for (const [entity, c] of Object.entries(resumed.report.counters)) expect.soft(typeof c.read, entity).toBe('number')
    expect.soft(Object.keys(resumed.report.counters)).toContain('users')

    // the always-present counters survive the notes overwrite
    const saved = expectNumbersOnly((await ledgerNotes(envA.pool, resumed.report.runId)).notes)
    for (const k of ['must_reset.roster_account', 'must_reset.non_bcrypt', 'must_reset.shared_default', 'nullHashAccounts', 'flaggedWithoutLoginId']) {
      expect.soft(saved, k).toHaveProperty([k])
    }
    expect.soft(saved).toMatchObject({ nullHashAccounts: 3, flaggedWithoutLoginId: 2, countsFromCommittedRows: 1 })
  }, 300_000)
})

describe('Q11 recovery when the resume fails after every users batch was skipped', () => {
  let envB: StagingDb
  const dirsB: string[] = []
  const newDir = (): string => {
    const d = mkdtempSync(join(REPO_ROOT, '.migration-out', 'q10-skipfail-'))
    dirsB.push(d)
    return d
  }
  const idFiles = (d: string): string[] => readdirSync(d).filter((f) => f.startsWith('core-login-gaps-'))
  beforeAll(async () => {
    envB = await freshEnv()
  }, 300_000)
  afterAll(async () => {
    for (const d of dirsB) rmSync(d, { recursive: true, force: true })
    await envB?.close()
  })

  it('writes the id file and saves the notes although no users batch ran in the failing process', async () => {
    const base = { pool: envB.pool, env: baseEnv, source: 'cloud' as const, asOf: AS_OF, batchSize: 2 }
    expect((await runCore({ ...base, mode: 'dry-run' })).report.status).toBe('succeeded')
    const out1 = newDir()
    await expect(runCore({ ...base, mode: 'apply', outDir: out1, transformSteps: failOnce('classrooms', 1) })).rejects.toThrow('injected failure')
    // Simulate a process that died hard after the users commits, before any file or notes were written.
    for (const f of idFiles(out1)) rmSync(join(out1, f))
    await envB.pool.query(`update etl_runs set counters = counters - 'notes' where mode = 'apply'`)

    const out2 = newDir()
    await expect(runCore({ ...base, mode: 'apply', outDir: out2, transformSteps: failOnce('classrooms', 1) })).rejects.toThrow('injected failure')
    const written = idFiles(out2)
    expect(written, 'the problem accounts are committed, so the failed resume still writes their list').toHaveLength(1)
    const body = JSON.parse(readFileSync(join(out2, written[0] as string), 'utf8')) as { runId: string; interrupted?: boolean; ids: Record<string, string[]> }
    expect(body.ids).toEqual({ flaggedWithoutLoginId: ['3', '10'], nullHashAccounts: ['9', '10', '11'] })
    const run = await envB.pool.query<{ id: string }>(`select id::text from etl_runs where mode = 'apply' order by id desc limit 1`)
    expect(body.runId, 'the file names its etl_runs row, not a placeholder').toBe(run.rows[0]?.id)
    expect(body.interrupted).toBe(true)
    const notes = expectNumbersOnly((await ledgerNotes(envB.pool, run.rows[0]?.id as string)).notes)
    expect(notes).toMatchObject({ nullHashAccounts: 3, flaggedWithoutLoginId: 2, countsFromCommittedRows: 1 })

    // The success path covers the same state through resumedBatches > 0.
    const out3 = newDir()
    await envB.pool.query(`update etl_runs set counters = counters - 'notes' where mode = 'apply'`)
    const done = await runCore({ ...base, mode: 'apply', outDir: out3 })
    expect(done.report.resumedBatches).toBeGreaterThan(0)
    expect(idFiles(out3)).toHaveLength(1)
    const doneBody = JSON.parse(readFileSync(join(out3, idFiles(out3)[0] as string), 'utf8')) as Record<string, unknown>
    expect(doneBody.runId).toBe(done.report.runId)
    expect(doneBody).not.toHaveProperty('interrupted')
    expect(expectNumbersOnly((await ledgerNotes(envB.pool, done.report.runId)).notes)).toMatchObject({ nullHashAccounts: 3, flaggedWithoutLoginId: 2 })
  }, 300_000)
})

describe('Q10 notes and id file after a committed apply', () => {
  let envC: StagingDb
  const dirsC: string[] = []
  const newDir = (): string => {
    const d = mkdtempSync(join(REPO_ROOT, '.migration-out', 'q10-warn-'))
    dirsC.push(d)
    return d
  }
  const idFiles = (d: string): string[] => readdirSync(d).filter((f) => f.startsWith('core-login-gaps-'))
  beforeAll(async () => {
    envC = await freshEnv()
  }, 300_000)
  afterAll(async () => {
    for (const d of dirsC) rmSync(d, { recursive: true, force: true })
    await envC?.close()
  })

  it('a failed notes save is a warning: the apply resolves, and the id file was written first', async () => {
    // The notes are the only writes that put a `notes` key into etl_runs.counters on a fresh run: make exactly those fail.
    await envC.pool.query(`
      create function pp_test_refuse_notes() returns trigger language plpgsql as $$ begin raise exception 'notes refused'; end $$;
      create trigger pp_test_refuse_notes before update on etl_runs for each row when (new.counters ? 'notes') execute function pp_test_refuse_notes();`)
    try {
      const warnings: string[] = []
      const base = { pool: envC.pool, env: baseEnv, source: 'cloud' as const, asOf: AS_OF, batchSize: 2, warn: (l: string) => void warnings.push(l) }
      expect((await runCore({ ...base, mode: 'dry-run' })).report.status).toBe('succeeded')

      // interrupted apply: the swallowed notes failure is a warning too, and the id file is still written
      const out1 = newDir()
      await expect(runCore({ ...base, mode: 'apply', outDir: out1, transformSteps: failOnce('classrooms', 1) })).rejects.toThrow('injected failure')
      expect(idFiles(out1)).toHaveLength(1)
      expect(warnings.some((w) => w.includes('could not save the report notes to the interrupted run'))).toBe(true)

      warnings.length = 0
      const out2 = newDir()
      const done = await runCore({ ...base, mode: 'apply', outDir: out2 })
      expect(done.report.status).toBe('succeeded')
      expect(warnings.some((w) => w.includes('could not save the report notes to etl_runs'))).toBe(true)
      expect(done.restrictedFile, 'the file is written before the notes').toBeDefined()
      expect(idFiles(out2)).toHaveLength(1)
      const row = await envC.pool.query<{ status: string }>(`select status from etl_runs where id = $1::bigint`, [done.report.runId])
      expect(row.rows[0]?.status).toBe('succeeded')
    } finally {
      await envC.pool.query(`drop trigger pp_test_refuse_notes on etl_runs; drop function pp_test_refuse_notes()`)
    }
  }, 300_000)
})

describe('VTAB-FU: the roster recount after a resume trims whitespace, not the letter v', () => {
  let envV: StagingDb
  let outV: string
  beforeAll(async () => {
    envV = await freshEnv()
    // Users 6 to 8 are committed in batches 3 and 4, before the injected failure. The staged logins start with "v" on purpose:
    // PostgreSQL E-strings have no `\v` escape (it is the letter v), so a `\v` in the btrim set stripped a leading or trailing "v".
    //  6, 8: valid e-mail whose local part is just "v" (old trim gave "@x.invalid", invalid: wrongly a roster account, +2)
    //  7:    username "v" and no e-mail                 (old trim gave "", no username: wrongly NOT a roster account, -1)
    // so a wrong trim gives 3, not the right 2 (a single +1 and -1 would cancel out).
    await envV.pool.query(`update staging_cloud.users set username = 'vina', email = 'v@x.invalid' where id = 6`)
    await envV.pool.query(`update staging_cloud.users set username = 'v', email = null where id = 7`)
    await envV.pool.query(`update staging_cloud.users set username = 'uv', email = 'v@y.invalid' where id = 8`)
    outV = mkdtempSync(join(REPO_ROOT, '.migration-out', 'q10-vtab-'))
  }, 300_000)
  afterAll(async () => {
    if (outV !== undefined) rmSync(outV, { recursive: true, force: true })
    await envV?.close()
  })

  it('must_reset.roster_account counts user 3 and the username "v" only, after the recount of a resumed apply', async () => {
    const base = { pool: envV.pool, env: baseEnv, source: 'cloud' as const, asOf: AS_OF, batchSize: 2, outDir: outV }
    expect((await runCore({ ...base, mode: 'dry-run' })).report.status).toBe('succeeded')
    await expect(runCore({ ...base, mode: 'apply', transformSteps: failOnce('users', 5) })).rejects.toThrow('injected failure')
    // the three users are committed before the failure, so the recount joins them to their staged rows
    const committed = await envV.pool.query<{ legacy_id: string }>(`select legacy_id from users where legacy_id in ('6', '7', '8') order by legacy_id`)
    expect(committed.rows.map((r) => r.legacy_id)).toEqual(['6', '7', '8'])

    const resumed = await runCore({ ...base, mode: 'apply' })
    expect(resumed.report.status).toBe('succeeded')
    expect(resumed.core.notes.counters.get('countsFromCommittedRows')).toBe(1) // the recount ran
    // user 3 (username, no e-mail left) and user 7 (username "v", no e-mail): two. Users 6 and 8 have a valid e-mail.
    expect(resumed.core.notes.counters.get('must_reset.roster_account')).toBe(2)
    const saved = expectNumbersOnly((await ledgerNotes(envV.pool, resumed.report.runId)).notes)
    expect(saved['must_reset.roster_account']).toBe(2)
  }, 300_000)
})
