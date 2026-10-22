/**
 * `migrate:core` command against a real PostgreSQL on the BE-35 fixture: the git sha reaches `etl_runs`, and the users
 * are read in full when there are more than one page (the fixture has 13 users, so ids 9 -> 10 cross a digit boundary
 * with a page size of 4; a lexicographic page order skipped users there).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../../prisma/seed'
import { schoolPackagesSeed } from '../../../prisma/seed/core/school-packages'
import { curriculumSeed } from '../../../prisma/seed/curriculum'
import { runCore } from '../../../src/migration/load'
import { migrateCore } from '../../../src/migration/load/command'
import { loadStaging } from '../../../src/migration/staging/load'
import { DirReader } from '../../../src/migration/staging/readers'
import { capture, createStagingDb, FIXTURE_DIR, stagingEnv, type StagingDb } from '../staging/helpers'

const AS_OF = '2026-06-01'
const SHA = '0123456789abcdef0123456789abcdef01234567'
let env: StagingDb
let coreEnv: Record<string, string>

const q = async <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> =>
  (await env.pool.query(sql, params)).rows as T[]

beforeAll(async () => {
  env = await createStagingDb()
  coreEnv = { NODE_ENV: 'test', IC_HASH_KEY: 'fixture-ic-key-0123456789', PP_ALLOW_MIGRATE_APPLY: '1' }
  await loadStaging(env.pool, new DirReader(FIXTURE_DIR), { env: stagingEnv(env.db) })
  await runSeeds([schoolPackagesSeed, curriculumSeed], { prisma: env.db.prisma })
  await q(`update staging_cloud.users set kelas = '4 Amanah' where role = 'pelajar'`)
  await q(`update staging_cloud.education_levels set name_bm = 'Darjah 1' where id = 1`)
}, 300_000)
afterAll(async () => {
  await env?.close()
})

const reconOf = (r: { recon: { entity: string; sourceCount: number; eligibleCount: number; loaded: number; rejected: number }[] }) =>
  r.recon.map((x) => [x.entity, x.sourceCount, x.eligibleCount, x.loaded, x.rejected])

describe('migrate:core reads every staged row', () => {
  it('reads all users and all classrooms with a page size below the row count, same as the default page size', async () => {
    const staged = Number((await q<{ n: string }>('select count(*)::text n from staging_cloud.users'))[0]?.n)
    expect(staged).toBe(13)
    const small = await runCore({ pool: env.pool, env: coreEnv, source: 'cloud', asOf: AS_OF, mode: 'dry-run', batchSize: 2, pageSize: 4 })
    const big = await runCore({ pool: env.pool, env: coreEnv, source: 'cloud', asOf: AS_OF, mode: 'dry-run', batchSize: 2 })
    expect(small.report.status).toBe('succeeded')
    expect(small.report.recon.find((r) => r.entity === 'users')?.sourceCount).toBe(staged)
    expect(reconOf(small.report)).toEqual(reconOf(big.report))
    const sourceCounts = Object.fromEntries(small.report.recon.map((r) => [r.entity, r.sourceCount]))
    for (const [entity, table] of [['classrooms', 'classrooms'], ['schools', 'schools'], ['subjects', 'subjects']] as const) {
      const n = Number((await q<{ n: string }>(`select count(*)::text n from staging_cloud.${table}`))[0]?.n)
      expect(sourceCounts[entity], entity).toBe(n)
    }
  }, 120_000)
})

describe('migrate:core command ledger', () => {
  const run = async (env_: Record<string, string>) => {
    const io = capture()
    const flags = new Map<string, string | true>([['as-of', AS_OF], ['batch-size', '5']])
    const code = await migrateCore.run({ mode: 'dry-run', flags, positional: [] }, { pool: env.pool, env: { ...coreEnv, ...env_ }, out: io.out, err: io.err })
    return { code, text: io.text() }
  }

  it('stores the git sha it is given in etl_runs.git_sha', async () => {
    const { code, text } = await run({ GIT_SHA: SHA })
    expect(code, text).toBe(0)
    const last = await q<{ git_sha: string | null }>('select git_sha from etl_runs order by id desc limit 1')
    expect(last[0]?.git_sha).toBe(SHA)
  }, 120_000)

  it('stores the explicit PP_GIT_SHA over GIT_SHA', async () => {
    const other = 'fedcba9876543210fedcba9876543210fedcba98'
    const { code } = await run({ GIT_SHA: SHA, PP_GIT_SHA: other })
    expect(code).toBe(0)
    expect((await q<{ git_sha: string | null }>('select git_sha from etl_runs order by id desc limit 1'))[0]?.git_sha).toBe(other)
  }, 120_000)
})
