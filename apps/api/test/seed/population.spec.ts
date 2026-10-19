import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { SessionSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { runSeeds, seedModules, type SeedModule } from '../../prisma/seed'
import { FICTITIOUS_NAME_PATTERN } from '../../prisma/seed/core/fixtures/names'
import { identitySeed } from '../../prisma/seed/core/identity'
import {
  buildPopulation,
  EXTRA_DEMO_ACCOUNTS,
  populationSeed,
  SCHOOL_PLANS,
} from '../../prisma/seed/core/population'
import { schoolsSeed } from '../../prisma/seed/core/schools'
import { prngStream } from '../../src/db/prng'
import { bootAuthApp, DEMO_PASSWORD, expectError, loginAs, type AuthTestApp } from '../auth/helpers'
import { createTestDatabase, type TestDatabase } from '../support/db'

const MODULES = [identitySeed, schoolsSeed, populationSeed]
const SEED_DIR = fileURLToPath(new URL('../../prisma/seed/', import.meta.url))
const TABLES = ['schools', 'users', 'user_roles', 'user_scopes'] as const

/**
 * Stable content of the seeded tables: ids, names, e-mails, class labels. `updated_at` is excluded (an idempotent
 * re-run may touch it). Password hashes are salted, so they are compared only on the same database (`withHashes`).
 */
async function fingerprint(db: TestDatabase, withHashes = false): Promise<{ hash: string; counts: Record<string, number> }> {
  const h = createHash('sha256')
  const counts: Record<string, number> = {}
  const cols: Record<string, string> = {
    schools: `id, code, name, state, district, type, city, join_code, is_active, jpn_id, ppd_id`,
    users: `id, name, email, username, school_id, grade, class_label, is_active, is_suspended, created_at`,
    user_roles: `id, user_id, role`,
    user_scopes: `id, user_id, role, level, state_code, district_code, school_id`,
  }
  for (const t of TABLES) {
    const rows = await db.query(`select ${cols[t]} from ${t} order by id`)
    counts[t] = rows.length
    if (t === 'users' && withHashes) {
      h.update(JSON.stringify(await db.query(`select id::text, md5(password_hash) as hash_md5 from users order by id`)))
    }
    h.update(JSON.stringify(rows, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v)))
  }
  return { hash: h.digest('hex'), counts }
}

describe('core population seed (BE-07)', () => {
  let db: TestDatabase
  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds(MODULES, { prisma: db.prisma })
  })
  afterAll(async () => {
    await db.drop()
  })

  it('is registered after identity and schools', () => {
    const names = seedModules.map((m) => m.name)
    expect(names.indexOf('core-population')).toBeGreaterThan(names.indexOf('core-schools'))
  })

  it('AC1: two fresh runs give identical rows (ids, names, e-mails, labels); a re-run keeps rows, ids and password hashes', async () => {
    const first = await fingerprint(db)
    const firstWithHashes = await fingerprint(db, true)
    const other = await createTestDatabase()
    try {
      await runSeeds(MODULES, { prisma: other.prisma })
      expect(await fingerprint(other)).toEqual(first)
    } finally {
      await other.drop()
    }
    await runSeeds(MODULES, { prisma: db.prisma })
    expect(await fingerprint(db)).toEqual(first)
    expect(await fingerprint(db, true)).toEqual(firstWithHashes)
  })

  it('AC2: counts by query', async () => {
    const one = async (sql: string) => (await db.query<{ n: number }>(sql))[0]!.n
    expect(
      await one(`select count(*)::int n from users u join user_roles r on r.user_id = u.id where r.role = 'student'`),
    ).toBeGreaterThanOrEqual(20)
    expect(
      await one(
        `select count(distinct s.id)::int n from users u join user_roles r on r.user_id = u.id join schools s on s.id = u.school_id where r.role = 'student'`,
      ),
    ).toBeGreaterThanOrEqual(3)
    expect(
      await one(
        `select count(distinct s.state)::int n from users u join user_roles r on r.user_id = u.id join schools s on s.id = u.school_id where r.role = 'student'`,
      ),
    ).toBe(2)
    expect(await one(`select count(*)::int n from user_roles where role = 'teacher'`)).toBeGreaterThanOrEqual(4)
    expect(await one(`select count(*)::int n from user_roles where role = 'admin'`)).toBe(1)
    // Exactly one school_admin-only account per school; the single dual-role (teacher + school_admin)
    // account is the BE-03 `guruadmin@demo.test` and is not counted as a pure school admin.
    const perSchool = await db.query<{ code: string; n: number }>(
      `select s.code, count(*)::int n from users u join schools s on s.id = u.school_id
        where (select string_agg(role, ',') from user_roles r where r.user_id = u.id) = 'school_admin'
        group by s.code order by s.code`,
    )
    expect(perSchool.map((r) => r.n)).toEqual([1, 1, 1, 1])
    expect(
      await one(
        `select count(*)::int n from users u where (select count(*) from user_roles r where r.user_id = u.id and r.role in ('teacher','school_admin')) = 2`,
      ),
    ).toBe(1)
    const rolesOf = async (email: string) =>
      (await db.query<{ r: string }>(`select string_agg(role, ',' order by role) r from user_roles x join users u on u.id = x.user_id where u.email = $1`, [email]))[0]!.r
    expect(await rolesOf('guruadmin@demo.test')).toBe('school_admin,teacher')
    expect(await rolesOf('digantung@demo.test')).toBe('student')
    expect(
      (await db.query<{ is_suspended: boolean }>(`select is_suspended from users where email = 'digantung@demo.test'`))[0]!.is_suspended,
    ).toBe(true)
    const emails = await db.query<{ email: string }>(`select email from users where email is not null`)
    for (const e of ['pelajar', 'pelajarmaju', 'pelajar2', 'guru', 'adminsekolah', 'admin', 'tidakaktif', 'ibubapa', 'penaja', 'ppd', 'jpn']) {
      expect(emails.map((r) => r.email)).toContain(`${e}@demo.test`)
    }
  })

  it('AC3: names and e-mails are synthetic', async () => {
    const generated = buildPopulation(prngStream('core-population'))
    expect(generated.length).toBeGreaterThanOrEqual(30)
    for (const a of generated) {
      expect(a.name).toMatch(FICTITIOUS_NAME_PATTERN)
      expect(a.email).toMatch(/^[a-z0-9.]+@example\.test$/)
    }
    expect(new Set(generated.map((a) => a.name)).size).toBe(generated.length)
    // Rows in the database: generated accounts match the pattern, the rest are the canonical Demo accounts.
    const rows = await db.query<{ name: string; email: string }>(`select name, email from users where email like '%@example.test'`)
    expect(rows).toHaveLength(generated.length)
    for (const r of rows) expect(r.name).toMatch(FICTITIOUS_NAME_PATTERN)
    for (const a of EXTRA_DEMO_ACCOUNTS) expect(a.name).toMatch(/ Demo$/)
    const nonExample = await db.query<{ name: string }>(`select name from users where email not like '%@example.test' or email is null`)
    for (const r of nonExample) expect(r.name).toMatch(/Demo/)
    const noPii = await db.query<{ n: number }>(
      `select count(*)::int n from users where ic_hash is not null or ic_masked is not null or phone is not null or bio is not null`,
    )
    expect(noPii[0]!.n).toBe(0)
  })

  it('AC3: the seed files use no e-mail domain other than example.test and demo.test', () => {
    const files: string[] = []
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f)
        if (statSync(p).isDirectory()) walk(p)
        else if (p.endsWith('.ts')) files.push(p)
      }
    }
    walk(SEED_DIR)
    expect(files.length).toBeGreaterThan(3)
    for (const f of files) {
      const text = readFileSync(f, 'utf8')
      for (const m of text.matchAll(/[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g)) {
        expect(['example.test', 'demo.test'], `${f}: ${m[0]}`).toContain(m[1])
      }
    }
  })

  it('AC3: only the documented demo password is used, hashed with argon2id', async () => {
    const { verify } = await import('@node-rs/argon2')
    const rows = await db.query<{ password_hash: string }>(`select distinct password_hash from users`)
    for (const r of rows) {
      expect(r.password_hash).toMatch(/^\$argon2id\$/)
      expect(await verify(r.password_hash, DEMO_PASSWORD)).toBe(true)
    }
  })

  it('AC5: never sets legacy_* and leaves rows from the ETL untouched', async () => {
    for (const t of TABLES) {
      const n = await db.query<{ n: number }>(
        `select count(*)::int n from ${t} where legacy_source is not null or legacy_id is not null`,
      )
      expect(n[0]!.n, t).toBe(0)
    }
    const hashN = await db.query<{ n: number }>(`select count(*)::int n from users where legacy_hash is not null`)
    expect(hashN[0]!.n).toBe(0)

    // A migrated user that collides with a seeded e-mail, with its own role, is left completely alone.
    await db.query(`delete from users where email = 'murid.demo003.01@example.test'`)
    await db.query(
      `insert into users (name, email, legacy_source, legacy_id, is_active, is_suspended, grade) values ('Murid Warisan', 'murid.demo003.01@example.test', 'cloud', 'u-1', false, true, 3)`,
    )
    await db.query(`insert into user_roles (user_id, role) select id, 'parent' from users where legacy_source = 'cloud'`)
    const snap = () =>
      db.query(
        `select u.*, (select string_agg(role, ',' order by role) from user_roles r where r.user_id = u.id) as roles,
                (select count(*)::int from user_scopes x where x.user_id = u.id) as scopes
           from users u where legacy_source = 'cloud'`,
      )
    const before = await snap()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await runSeeds(MODULES, { prisma: db.prisma })
    const warned = warn.mock.calls.map((c) => String(c[0])).join(' ')
    warn.mockRestore()
    expect(await snap()).toEqual(before)
    expect(before[0]).toMatchObject({ name: 'Murid Warisan', is_active: false, is_suspended: true, roles: 'parent', scopes: 0 })
    expect(warned).toMatch(/skipped 1 account/)
    expect(warned).not.toContain('example.test')
    const n = await db.query<{ n: number }>(`select count(*)::int n from users where legacy_source is not null`)
    expect(n[0]!.n).toBe(1)
    await db.query(`delete from users where legacy_source = 'cloud'`)
    // Restore the seeded account for the tests that follow.
    await runSeeds(MODULES, { prisma: db.prisma })
  })

  it('the plan fits the name fixture and every plan school exists', async () => {
    const codes = (await db.query<{ code: string }>(`select code from schools`)).map((r) => r.code)
    for (const p of SCHOOL_PLANS) expect(codes).toContain(p.code)
  })

  // The list is kept outside the repo; without the variable the test shows as skipped.
  it.skipIf(!process.env.SEED_NAME_DENYLIST)('AC6: no seeded name matches the deny-list in SEED_NAME_DENYLIST', async () => {
    const path = process.env.SEED_NAME_DENYLIST as string
    const patterns = readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    const names = (await db.query<{ name: string }>(`select name from users`)).map((r) => r.name.toLowerCase())
    for (const p of patterns) {
      for (const n of names) expect(n.includes(p.toLowerCase()), `denied term in a seeded name`).toBe(false)
    }
  })
})

describe('demo gate (population seed)', () => {
  let db: TestDatabase
  beforeAll(async () => {
    db = await createTestDatabase()
  })
  afterAll(async () => {
    await db.drop()
    vi.unstubAllEnvs()
  })

  const userCount = async () => (await db.query<{ n: number }>(`select count(*)::int n from users`))[0]!.n

  it('refuses or skips in production without ALLOW_DEMO_SEED and touches nothing', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ALLOW_DEMO_SEED', '')
    // The runner throws (BE-03) or skips demo modules and warns (BE-25 reference/demo split); both leave no rows.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    let ran: string[] = []
    let refused = false
    try {
      ran = await runSeeds(MODULES, { prisma: db.prisma })
    } catch (e) {
      refused = true
      expect(String(e)).toMatch(/ALLOW_DEMO_SEED/)
    }
    warn.mockRestore()
    vi.unstubAllEnvs()
    expect(refused || !ran.includes('core-population')).toBe(true)
    expect(await userCount()).toBe(0)
  })

  it('the module itself refuses when run directly in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ALLOW_DEMO_SEED', '')
    const direct: SeedModule = populationSeed
    await expect(direct.run({ profile: 'poc', prisma: db.prisma } as never)).rejects.toThrow(/ALLOW_DEMO_SEED/)
    vi.unstubAllEnvs()
    expect(await userCount()).toBe(0)
  })

  it('runs in production only with the explicit flag', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ALLOW_DEMO_SEED', 'true')
    await runSeeds(MODULES, { prisma: db.prisma })
    vi.unstubAllEnvs()
    expect(await userCount()).toBeGreaterThan(30)
  })
})

describe('login as every seeded role (AC4)', () => {
  let t: AuthTestApp
  beforeAll(async () => {
    t = await bootAuthApp({ seed: false, env: { THROTTLE_LOGIN_PER_MINUTE: '10000', LOGIN_IDENTIFIER_FAIL_LIMIT: '10000' } })
    await runSeeds(MODULES, { prisma: t.db.prisma })
  }, 60_000)
  afterAll(async () => {
    await t.close()
  })

  const expectations: ReadonlyArray<[string, string, string, string]> = [
    // email, role, landingPath, scope level
    ['pelajar@demo.test', 'student', '/dashboard', 'self'],
    ['pelajarmaju@demo.test', 'student', '/dashboard', 'self'],
    ['pelajar2@demo.test', 'student', '/dashboard', 'self'],
    ['guru@demo.test', 'teacher', '/dashboard', 'school'],
    ['adminsekolah@demo.test', 'school_admin', '/admin', 'school'],
    ['admin@demo.test', 'admin', '/admin', 'national'],
    ['ibubapa@demo.test', 'parent', '/dashboard', 'self'],
    ['penaja@demo.test', 'sponsor', '/dashboard', 'self'],
    ['ppd@demo.test', 'ppd_officer', '/admin/pemantauan/wilayah', 'district'],
    ['jpn@demo.test', 'ppd_officer', '/admin/pemantauan/wilayah', 'state'],
    ['murid.demo003.01@example.test', 'student', '/dashboard', 'self'],
    ['guru.demo004.02@example.test', 'teacher', '/dashboard', 'school'],
    ['adminsekolah.demo002@example.test', 'school_admin', '/admin', 'school'],
  ]

  it.each(expectations)('%s logs in as %s', async (email, role, landing, level) => {
    const { session } = await loginAs(t, email)
    SessionSchema.parse(session)
    expect(session.active.role).toBe(role)
    expect(session.landingPath).toBe(landing)
    expect(session.active.scope.level).toBe(level)
    expect(session.roles.map((g) => g.role)).toContain(role)
  })

  it('scopes point at the right school, district and state', async () => {
    const guru = (await loginAs(t, 'guru.demo003.01@example.test')).session
    const [row] = await t.db.query<{ id: string }>(`select id::text from schools where code = 'DEMO003'`)
    expect(guru.active.scope).toMatchObject({ level: 'school', schoolId: row!.id })
    expect((await loginAs(t, 'ppd@demo.test')).session.active.scope).toMatchObject({
      level: 'district',
      districtCode: 'Petaling',
      stateCode: 'Selangor',
    })
    expect((await loginAs(t, 'jpn@demo.test')).session.active.scope).toMatchObject({ level: 'state', stateCode: 'Selangor' })
  })

  it('every seeded account with an e-mail can log in', async () => {
    const rows = await t.db.query<{ email: string }>(
      `select email from users where email is not null and is_active and not is_suspended order by id`,
    )
    expect(rows.length).toBeGreaterThan(35)
    for (const r of rows) {
      const res = await t.http().post('/api/auth/login').send({ identifier: r.email, password: DEMO_PASSWORD })
      expect(res.status, r.email).toBe(200)
    }
  }, 120_000)

  it('the inactive account gets the BE-03 inactive response', async () => {
    const res = await t.http().post('/api/auth/login').send({ identifier: 'tidakaktif@demo.test', password: DEMO_PASSWORD })
    expectError(res, 'ACCOUNT_INACTIVE')
  })
})
