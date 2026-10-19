import { verify } from '@node-rs/argon2'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { DEMO_ACCOUNTS, DEMO_PASSWORD, DEMO_SCHOOLS, identitySeed } from '../../prisma/seed/core/identity'
import { createTestDatabase, type TestDatabase } from '../support/db'

describe('core identity seed', () => {
  let db: TestDatabase

  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds([identitySeed], { prisma: db.prisma })
  })
  afterAll(async () => {
    await db.drop()
  })

  const snapshot = () =>
    db.query(
      `select u.email, u.username, u.name, u.password_hash, u.is_active, u.is_suspended, u.grade, s.code as school,
              (select string_agg(role, ',' order by role) from user_roles r where r.user_id = u.id) as roles
         from users u left join schools s on s.id = u.school_id order by u.email nulls last, u.username`,
    )

  it('seeds the canonical demo accounts and their schools', async () => {
    const rows = await snapshot()
    expect(rows).toHaveLength(DEMO_ACCOUNTS.length)
    const by = (email: string) => rows.find((r) => r.email === email)
    expect(by('pelajar@demo.test')).toMatchObject({ roles: 'student', school: 'DEMO001' })
    expect(by('pelajarmaju@demo.test')).toMatchObject({ roles: 'student' })
    expect(by('pelajar2@demo.test')).toMatchObject({ roles: 'student' })
    expect(by('guru@demo.test')).toMatchObject({ roles: 'teacher', school: 'DEMO001' })
    expect(by('adminsekolah@demo.test')).toMatchObject({ roles: 'school_admin', school: 'DEMO001' })
    expect(by('admin@demo.test')).toMatchObject({ roles: 'admin', school: null })
    expect(by('guruadmin@demo.test')).toMatchObject({ roles: 'school_admin,teacher', school: 'DEMO001' })
    expect(by('tidakaktif@demo.test')).toMatchObject({ is_active: false, is_suspended: false })
    expect(by('digantung@demo.test')).toMatchObject({ is_active: true, is_suspended: true })
    const schools = await db.query(`select code from schools order by code`)
    expect(schools.map((s) => s.code)).toEqual(DEMO_SCHOOLS.map((s) => s.code))
  })

  it('never combines student with another role and keeps admin single-role', async () => {
    const rows = await db.query<{ email: string; n: number }>(
      `select u.email, count(*)::int as n from users u join user_roles r on r.user_id = u.id
        where r.role in ('student', 'admin') group by u.id having count(*) > 0 and
        (select count(*) from user_roles x where x.user_id = u.id) > 1`,
    )
    expect(rows).toEqual([])
  })

  it('hashes the demo password with argon2id and stores no plaintext', async () => {
    const rows = await db.query<{ password_hash: string }>(`select password_hash from users`)
    for (const r of rows) {
      expect(r.password_hash).toMatch(/^\$argon2id\$/)
      expect(r.password_hash).not.toContain(DEMO_PASSWORD)
      expect(await verify(r.password_hash, DEMO_PASSWORD)).toBe(true)
      expect(await verify(r.password_hash, 'Salah1234')).toBe(false)
    }
  })

  it('shares one username across two schools (ambiguity case) with a school-less roster pupil', async () => {
    const rows = await db.query<{ code: string; email: string | null }>(
      `select s.code, u.email from users u join schools s on s.id = u.school_id where lower(u.username) = 'murid01' order by s.code`,
    )
    expect(rows).toEqual([
      { code: 'DEMO001', email: 'pelajar@demo.test' },
      { code: 'DEMO002', email: null },
    ])
  })

  it('writes an admin national scope row and never sets legacy_* or IC data', async () => {
    const scopes = await db.query(`select u.email, s.role, s.level from user_scopes s join users u on u.id = s.user_id`)
    expect(scopes).toEqual([{ email: 'admin@demo.test', role: 'admin', level: 'national' }])
    for (const t of ['users', 'user_roles', 'user_scopes', 'schools']) {
      const n = await db.query<{ n: number }>(
        `select count(*)::int as n from ${t} where legacy_source is not null or legacy_id is not null`,
      )
      expect(n[0]!.n, t).toBe(0)
    }
    const ic = await db.query<{ n: number }>(`select count(*)::int as n from users where ic_hash is not null or ic_masked is not null`)
    expect(ic[0]!.n).toBe(0)
  })

  it('uses fictitious names that mark them as demo records', () => {
    for (const a of DEMO_ACCOUNTS) expect(a.name).toMatch(/Demo/)
    for (const s of DEMO_SCHOOLS) expect(s.name).toMatch(/Demo/)
  })

  it('is idempotent: a second run changes no row, no id and no hash', async () => {
    const before = await snapshot()
    const ids = await db.query(`select id::text from users order by id`)
    await runSeeds([identitySeed], { prisma: db.prisma })
    expect(await snapshot()).toEqual(before)
    expect(await db.query(`select id::text from users order by id`)).toEqual(ids)
    expect(await db.query(`select count(*)::int as n from user_roles`)).toEqual([{ n: 11 }])
  })

  it('repairs a drifted account without touching other rows and keeps an existing hash', async () => {
    const [before] = await db.query<{ password_hash: string }>(
      `select password_hash from users where email = 'guru@demo.test'`,
    )
    await db.query(`update users set is_active = false, name = 'Ubah' where email = 'guru@demo.test'`)
    await db.query(`insert into user_roles (user_id, role) select id, 'parent' from users where email = 'guru@demo.test'`)
    await runSeeds([identitySeed], { prisma: db.prisma })
    const [after] = await db.query(
      `select is_active, name, password_hash, (select string_agg(role, ',') from user_roles r where r.user_id = u.id) as roles
         from users u where email = 'guru@demo.test'`,
    )
    expect(after).toMatchObject({ is_active: true, name: 'Guru Demo', roles: 'teacher', password_hash: before!.password_hash })
  })
})
