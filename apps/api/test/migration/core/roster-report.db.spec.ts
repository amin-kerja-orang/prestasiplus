/**
 * Q10/Q11 on a real PostgreSQL and the BE-35 `cloud-tiny` fixture: the roster default hash warning and the login-less
 * account report of `migrate:core`. Fixture facts: 11 users load; users 9, 10 and 11 end with a NULL password hash
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
  await env?.close()
})

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
    expect(core.notes.counters.get('must_reset.roster_account')).toBeGreaterThanOrEqual(1)
    // ids are not in the aggregate notes
    expect(core.notes.ids.has('nullHashAccounts')).toBe(false)
    expect(core.notes.ids.has('flaggedWithoutLoginId')).toBe(false)

    expect(restrictedFile).toBeDefined()
    expect(files().filter((f) => !before.has(f))).toHaveLength(1)
    expect(statSync(restrictedFile as string).mode & 0o777).toBe(0o600)
    const body = JSON.parse(readFileSync(restrictedFile as string, 'utf8')) as { runId: string; ids: Record<string, string[]> }
    expect(body.runId).toBe(report.runId)
    expect(body.ids).toEqual({ flaggedWithoutLoginId: ['3', '10'], nullHashAccounts: ['9', '10', '11'] })
  }, 240_000)

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
    try {
      expect(applied.text).not.toMatch(/ids (nullHashAccounts|flaggedWithoutLoginId)/)
      expect(applied.text).not.toMatch(/(nullHashAccounts|flaggedWithoutLoginId)[^\n]*:[^\n]*[,\[]/)
      expect(statSync(path as string).mode & 0o777).toBe(0o600)
    } finally {
      rmSync(path as string, { force: true })
    }
  }, 240_000)
})
