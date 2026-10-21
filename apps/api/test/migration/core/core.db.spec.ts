/**
 * `migrate:core` against a real PostgreSQL (Testcontainers) on the BE-35 synthetic fixture (`cloud-tiny`).
 * The tests run in order and share one database: dry-run, refused apply, apply, second apply, seeds.
 * Fixture facts used below (apps/api/test/migration/fixtures/cloud-tiny): 13 users (id 4 points to a missing
 * school, id 13 has the unplanned role `super_guru`, id 2 repeats the e-mail of id 1, id 3 repeats the
 * username of id 1 in the same school), 3 schools, 3 classrooms, 6 roster rows (3 of them bad), 2 parent
 * links (1 orphan), 4 chapters (1 orphan), 5 topics (1 orphan).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../../prisma/seed'
import { schoolPackagesSeed } from '../../../prisma/seed/core/school-packages'
import { curriculumSeed } from '../../../prisma/seed/curriculum'
import { runCli } from '../../../src/migration/cli'
import { ApplyGuardError, ApplyRefusedError } from '../../../src/migration/kit'
import { runCore, SyntheticDataRefusedError } from '../../../src/migration/load'
import '../../../src/migration/load/command'
import { loadStaging } from '../../../src/migration/staging/load'
import { DirReader } from '../../../src/migration/staging/readers'
import { capture, createStagingDb, FIXTURE_DIR, stagingEnv, type StagingDb } from '../staging/helpers'

const FIXTURE_ICS = Array.from({ length: 13 }, (_, i) => String(i + 1).padStart(12, '0'))
const AS_OF = '2026-06-01'
const CORE_TABLES = [
  'education_levels', 'subjects', 'chapters', 'topics', 'subject_levels', 'jpns', 'ppds', 'schools', 'users', 'user_roles',
  'user_scopes', 'teacher_profiles', 'parent_links', 'classrooms', 'enrolments', 'school_subscriptions',
] as const

let env: StagingDb
let coreEnv: Record<string, string>

const q = async <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> =>
  (await env.pool.query(sql, params)).rows as T[]
const count = async (table: string, where = 'true'): Promise<number> =>
  Number((await q<{ n: string }>(`select count(*)::text as n from ${table} t where ${where}`))[0]?.n)

/** Row count and content hash per table, ids included. */
async function fingerprint(): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const t of CORE_TABLES) {
    const r = (await q<{ n: string; h: string | null }>(`select count(*)::text n, md5(string_agg(t::text, '|' order by id)) h from ${t} t`))[0]
    out[t] = `${r?.n}:${r?.h}`
  }
  out.etl_id_map = String(await count('etl_id_map'))
  return out
}

beforeAll(async () => {
  env = await createStagingDb()
  coreEnv = { NODE_ENV: 'test', IC_HASH_KEY: 'fixture-ic-key-0123456789', PP_ALLOW_MIGRATE_APPLY: '1' }
  await loadStaging(env.pool, new DirReader(FIXTURE_DIR), { env: stagingEnv(env.db) })
  // Reference rows a seeded environment has: the package catalogue and the curriculum (levels D1..T5 with grades).
  await runSeeds([schoolPackagesSeed, curriculumSeed], { prisma: env.db.prisma })
  // Make the tiny fixture placeable: pupils get a class label, and level 1 is named like a seeded level (adoption).
  await q(`update staging_cloud.users set kelas = '4 Amanah' where role = 'pelajar'`)
  await q(`update staging_cloud.education_levels set name_bm = 'Darjah 1' where id = 1`)
}, 300_000)
afterAll(async () => {
  await env.close()
})

const run = (mode: 'dry-run' | 'apply', asOf = AS_OF) => runCore({ pool: env.pool, env: coreEnv, source: 'cloud', asOf, mode, batchSize: 2 })

describe('dry-run (AC6)', () => {
  it('writes nothing outside etl_*, reconciles every table and records rejects', async () => {
    const levelsBefore = await count('education_levels')
    const { report } = await run('dry-run')
    expect(report.status).toBe('succeeded')
    for (const r of report.recon) expect(r.eligibleCount - r.loaded - r.rejected, r.entity).toBe(0)
    for (const t of ['schools', 'users', 'user_roles', 'classrooms', 'enrolments', 'parent_links', 'school_subscriptions', 'jpns', 'ppds']) {
      expect(await count(t), t).toBe(0)
    }
    expect(await count('education_levels')).toBe(levelsBefore)
    expect(await count('education_levels', `legacy_source = 'cloud'`)).toBe(0)
    expect(await count('etl_rejects', `run_id = ${report.runId}`)).toBeGreaterThan(0)
    expect(await count('etl_recon', `run_id = ${report.runId}`)).toBe(report.recon.length)
  }, 120_000)

  it('refuses --apply when no passing dry-run exists for the same input', async () => {
    await expect(run('apply', '2026-06-02')).rejects.toBeInstanceOf(ApplyRefusedError)
    expect(await count('schools')).toBe(0)
  })

  it('refuses --apply without PP_ALLOW_MIGRATE_APPLY', async () => {
    await expect(runCore({ pool: env.pool, env: { ...coreEnv, PP_ALLOW_MIGRATE_APPLY: '0' }, source: 'cloud', asOf: AS_OF, mode: 'apply' })).rejects.toBeInstanceOf(ApplyGuardError)
  })
})

describe('apply', () => {
  let rejectsByReason: Record<string, number>

  it('loads the fixture, reconciles source = loaded + rejected per table', async () => {
    const { report } = await run('apply')
    expect(report.status).toBe('succeeded')
    const by = Object.fromEntries(report.recon.map((r) => [r.entity, r]))
    for (const r of report.recon) expect(r.eligibleCount - r.loaded - r.rejected, r.entity).toBe(0)
    expect(by.users).toMatchObject({ sourceCount: 13, loaded: 11, rejected: 2 })
    expect(by.schools).toMatchObject({ sourceCount: 3, loaded: 3, rejected: 0 })
    expect(by.chapters).toMatchObject({ sourceCount: 4, loaded: 3, rejected: 1 })
    expect(by.topics).toMatchObject({ sourceCount: 5, loaded: 4, rejected: 1 })
    expect(by.parent_links).toMatchObject({ sourceCount: 2, loaded: 1, rejected: 1 })
    expect(by.enrolments).toMatchObject({ sourceCount: 6, loaded: 3, rejected: 3 })
    expect(by.school_subscriptions).toMatchObject({ sourceCount: 1, loaded: 1, rejected: 0 })
    const rows = await q<{ reason: string; n: string }>(`select reason, count(*)::text n from etl_rejects where run_id = $1 group by reason`, [report.runId])
    rejectsByReason = Object.fromEntries(rows.map((r) => [r.reason, Number(r.n)]))
    expect(rejectsByReason.UNKNOWN_ENUM).toBeGreaterThanOrEqual(1)
    expect(rejectsByReason.ORPHAN_PARENT).toBeGreaterThanOrEqual(5)
  }, 120_000)

  it('quarantines the planted unknown role and the orphan user, and migrates no default role (AC1, AC5)', async () => {
    const rejects = await q<{ legacy_id: string; reason: string; column_name: string; offending: string | null }>(
      `select legacy_id, reason, column_name, offending from etl_rejects where entity = 'users' order by legacy_id::int`,
    )
    expect(rejects).toEqual([
      { legacy_id: '4', reason: 'ORPHAN_PARENT', column_name: 'school_id', offending: null },
      { legacy_id: '13', reason: 'UNKNOWN_ENUM', column_name: 'role', offending: 'super_guru' },
    ].map((r) => expect.objectContaining(r)))
    expect(await count('users', `legacy_source = 'cloud' and legacy_id in ('4', '13')`)).toBe(0)
    const roles = await q<{ legacy_id: string; role: string }>(`select legacy_id, role from user_roles where legacy_source = 'cloud'`)
    const byId = Object.fromEntries(roles.map((r) => [r.legacy_id, r.role]))
    expect(byId).toMatchObject({ 1: 'student', 7: 'teacher', 9: 'parent', 10: 'school_admin', 11: 'ppd_officer', 12: 'admin' })
    expect(roles).toHaveLength(11)
  })

  it('adopts the seeded level of the same code and keeps one row per code (AC8)', async () => {
    const d1 = await q<{ legacy_id: string | null; legacy_source: string | null }>(`select legacy_id, legacy_source from education_levels where code = 'D1'`)
    expect(d1).toEqual([{ legacy_id: '1', legacy_source: 'cloud' }])
    expect(await count('education_levels', `code = 'LVL2'`)).toBe(1)
  })

  it('maps passwords, flags resets and drops tokens (AC2)', async () => {
    const u = async (id: string) => (await q<{ password_hash: string | null; must_reset_password: boolean }>(`select password_hash, must_reset_password from users where legacy_id = $1`, [id]))[0]
    expect((await u('1'))?.password_hash).toMatch(/^\$2y\$10\$F+$/)
    expect((await u('1'))?.must_reset_password).toBe(false)
    expect(await u('8')).toMatchObject({ must_reset_password: true }) // argon2
    expect(await u('9')).toEqual({ password_hash: null, must_reset_password: true }) // plaintext-like value
    expect(await u('10')).toEqual({ password_hash: null, must_reset_password: true }) // empty
    expect((await u('3'))?.must_reset_password).toBe(true) // roster account: username, no e-mail
  })

  it('hashes and masks the IC, and no clear IC, token or password text reaches any table (AC3)', async () => {
    const masked = await q<{ ic_masked: string }>(`select ic_masked from users where legacy_id = '1'`)
    expect(masked[0]?.ic_masked).toBe('xxxxxx-xx-xx01')
    const forbidden = [...FIXTURE_ICS, 'fixture-remember-token', 'fixture-invite-token', 'not-a-hash-fixture']
    for (const table of [...CORE_TABLES, 'etl_rejects', 'etl_recon', 'etl_id_map', 'etl_runs', 'etl_checkpoints']) {
      for (const text of forbidden) {
        expect(await count(table, `t::text like '%${text}%'`), `${table} / ${text}`).toBe(0)
      }
    }
  })

  it('keeps duplicate people as separate accounts and drops the clashing login of the later one (Q2)', async () => {
    const dup = await q<{ legacy_id: string; email: string | null; username: string | null }>(
      `select legacy_id, email, username from users where legacy_id in ('1', '2', '3') order by legacy_id`,
    )
    expect(dup[0]).toMatchObject({ email: 'pengguna001@contoh.invalid', username: 'contoh001' })
    expect(dup[1]).toMatchObject({ email: null, username: 'contoh002' })
    expect(dup[2]).toMatchObject({ email: null, username: null })
  })

  it('derives the PPD officer scope from the school and the admin scope as national (AC4)', async () => {
    const scopes = await q<{ legacy_id: string; role: string; level: string; state_code: string | null; district_code: string | null }>(
      `select legacy_id, role, level, state_code, district_code from user_scopes where legacy_source = 'cloud' order by legacy_id::int`,
    )
    expect(scopes).toEqual([
      expect.objectContaining({ legacy_id: '11', role: 'ppd_officer', level: 'district', state_code: 'Negeri B', district_code: 'Daerah B2' }),
      expect.objectContaining({ legacy_id: '12', role: 'admin', level: 'national' }),
    ])
  })

  it('normalises the state and district spellings into one JPN and three PPDs', async () => {
    expect(await q(`select code, name from jpns`)).toEqual([{ code: 'NEGERI B', name: 'Negeri B' }])
    expect((await q<{ code: string }>(`select code from ppds order by code`)).map((r) => r.code)).toEqual(['Daerah B1', 'Daerah B2', 'Daerah B3'])
    expect(await count('schools', `state = 'Negeri B' and jpn_id is not null and ppd_id is not null`)).toBe(3)
  })

  it('places classes by pupil grade, derives the kind and rosters active code joins', async () => {
    const classes = await q<{ legacy_id: string; kind: string; code: string }>(
      `select c.legacy_id, c.kind, l.code from classrooms c join education_levels l on l.id = c.education_level_id order by c.legacy_id::int`,
    )
    expect(classes).toEqual([
      { legacy_id: '1', kind: 'classroom', code: 'D4' },
      { legacy_id: '2', kind: 'classroom', code: 'D4' },
    ])
    expect(await count('enrolments', `status = 'active' and source = 'code'`)).toBe(3)
    expect(rejectsByReason).toBeDefined()
  })

  it('builds the subscription from the quota and the school type', async () => {
    const s = await q<{ package_tier: string; student_quota: number; code: string; status: string }>(
      `select s.package_tier, s.student_quota, p.code, s.status from school_subscriptions s join school_packages p on p.id = s.school_package_id`,
    )
    expect(s).toEqual([{ package_tier: 'basic', student_quota: 100, code: 'D1_D6', status: 'active' }])
  })
})

describe('re-run and coexistence (AC6, AC8)', () => {
  it('a second --apply changes nothing (row counts and content hash)', async () => {
    const before = await fingerprint()
    await run('dry-run')
    const { report } = await run('apply')
    expect(report.status).toBe('succeeded')
    expect(report.counters.users).toMatchObject({ inserted: 0, updated: 0 })
    expect(await fingerprint()).toEqual(before)
  }, 120_000)

  it('seeds run after the migration add and change no migrated row', async () => {
    const before = {
      levels: await count('education_levels'),
      subjects: await count('subjects'),
      chapters: await count('chapters'),
      topics: await count('topics'),
      packages: await count('school_packages'),
      cloud: await count('education_levels', `legacy_source = 'cloud'`),
      cloudUsers: await count('users', `legacy_source = 'cloud'`),
    }
    await runSeeds([schoolPackagesSeed, curriculumSeed], { prisma: env.db.prisma })
    expect({
      levels: await count('education_levels'),
      subjects: await count('subjects'),
      chapters: await count('chapters'),
      topics: await count('topics'),
      packages: await count('school_packages'),
      cloud: await count('education_levels', `legacy_source = 'cloud'`),
      cloudUsers: await count('users', `legacy_source = 'cloud'`),
    }).toEqual(before)
  }, 180_000)
})

describe('CLI and guards', () => {
  it('prints counts and ids only: no e-mail, IC, name or hash in the output', async () => {
    const c = capture()
    const code = await runCli(['migrate:core', '--dry-run', '--as-of', AS_OF], { env: coreEnv, out: c.out, err: c.err, pool: env.pool })
    expect(code).toBe(0)
    const text = c.text()
    expect(text).toContain('entity | source | eligible | loaded | rejected | status')
    expect(text).toContain('not migrated packages')
    for (const needle of ['@contoh.invalid', 'Contoh', 'xxxxxx', '$2y$', ...FIXTURE_ICS]) expect(text, needle).not.toContain(needle)
  }, 120_000)

  it('exits non-zero for --apply without a passing dry-run on the same input', async () => {
    const c = capture()
    const code = await runCli(['migrate:core', '--apply', '--as-of', '2026-07-07'], { env: coreEnv, out: c.out, err: c.err, pool: env.pool })
    expect(code).toBe(3)
  })

  it('refuses a production run on staged synthetic data (BE-35 dummy hashes)', async () => {
    await q(`update staging_cloud.users set password = 'not-a-hash-anonymised' where id = 1`)
    try {
      await expect(
        runCore({ pool: env.pool, env: { ...coreEnv, NODE_ENV: 'production' }, source: 'cloud', asOf: AS_OF, mode: 'dry-run' }),
      ).rejects.toBeInstanceOf(SyntheticDataRefusedError)
    } finally {
      await q(`update staging_cloud.users set password = '$2y$10$FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF' where id = 1`)
    }
  })
})
