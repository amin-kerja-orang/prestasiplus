import { CreatedUserSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ADMIN, apiOf, bootUsersApp, login, schoolIdOf, teacherBody, type Api, type UsersTestApp } from './helpers'

const activeAdmins = async (t: UsersTestApp): Promise<number> =>
  (
    await t.db.query<{ n: number }>(
      `select count(*)::int n from users u join user_roles r on r.user_id = u.id where r.role = 'admin' and u.is_active`,
    )
  )[0]?.n as number

describe('concurrency: the last active admin survives two racing requests (D58)', () => {
  let t: UsersTestApp
  let s1: string

  beforeAll(async () => {
    t = await bootUsersApp({ env: { THROTTLE_ADMIN_WRITE_PER_MINUTE: '100000', THROTTLE_ADMIN_READ_PER_MINUTE: '100000' } })
    s1 = await schoolIdOf(t.db, 'DEMO001')
  })
  afterAll(async () => {
    await t.close()
  })

  /** Back to one seed admin: no leftover second admin, the seed admin active with its admin role. */
  async function reset(): Promise<void> {
    await t.db.query(`delete from users where email like 'admin.balapan%'`)
    await t.db.query(`delete from user_roles where user_id = (select id from users where email = $1)`, [ADMIN])
    await t.db.query(`insert into user_roles (user_id, role) select id, 'admin' from users where email = $1`, [ADMIN])
    await t.db.query(`update users set is_active = true, school_id = null where email = $1`, [ADMIN])
  }

  /** A second admin with a live session; the two admins then act on each other at the same time. */
  async function pair(n: number): Promise<{ a: Api; b: Api; aId: string; bId: string }> {
    await reset()
    const first = apiOf(await login(t, ADMIN))
    const email = `admin.balapan${String(n)}@ujian.test`
    const created = CreatedUserSchema.parse(
      (await first.post('/admin/users', { roles: ['admin'], name: `Admin Balapan ${String(n)}`, email })).body.data,
    )
    const b = apiOf(await login(t, email, { password: created.generatedPassword }))
    const aId = (await t.db.query<{ id: string }>(`select id::text from users where email = $1`, [ADMIN]))[0]?.id as string
    return { a: apiOf(await login(t, ADMIN)), b, aId, bId: created.id }
  }

  /** A loser is 409 (the guard) or 401 (its session was revoked first); never a second success. */
  const outcome = (statuses: number[]) => {
    expect(statuses.filter((s) => s === 200)).toHaveLength(1)
    expect(statuses.filter((s) => s === 409 || s === 401)).toHaveLength(1)
  }

  it('two admins demote each other at once: one succeeds, one active admin remains', async () => {
    for (let i = 0; i < 3; i++) {
      const { a, b, aId, bId } = await pair(i)
      const [r1, r2] = await Promise.all([
        a.put(`/admin/users/${bId}`, { roles: ['teacher'], name: 'Turun A', schoolId: s1 }),
        b.put(`/admin/users/${aId}`, { roles: ['teacher'], name: 'Turun B', schoolId: s1 }),
      ])
      outcome([r1.status, r2.status])
      expect(await activeAdmins(t)).toBe(1)
      // Put the world back for the next round.
      await t.db.query(`delete from user_roles where user_id in ($1, $2)`, [aId, bId])
      await t.db.query(`insert into user_roles (user_id, role) values ($1, 'admin'), ($2, 'admin')`, [aId, bId])
      await t.db.query(`update users set school_id = null, is_active = true where id in ($1, $2)`, [aId, bId])
    }
  })

  it('two admins deactivate each other at once: one succeeds, one active admin remains', async () => {
    for (let i = 10; i < 13; i++) {
      const { a, b, aId, bId } = await pair(i)
      const [r1, r2] = await Promise.all([a.post(`/admin/users/${bId}/toggle-active`), b.post(`/admin/users/${aId}/toggle-active`)])
      outcome([r1.status, r2.status])
      expect(await activeAdmins(t)).toBe(1)
      await t.db.query(`update users set is_active = true where id in ($1, $2)`, [aId, bId])
    }
  })

  it('bulk-delete of one admin racing the toggle of the other: one active admin remains', async () => {
    for (let i = 20; i < 23; i++) {
      const { a, b, aId, bId } = await pair(i)
      const [r1, r2] = await Promise.all([a.post('/admin/users/bulk-delete', { ids: [bId] }), b.post(`/admin/users/${aId}/toggle-active`)])
      outcome([r1.status, r2.status])
      expect(await activeAdmins(t)).toBe(1)
      await t.db.query(`update users set is_active = true where id = $1`, [aId])
      await t.db.query(`delete from users where id = $1`, [bId])
    }
  })

  it('a duplicate e-mail created three times at once: one 201, the rest 422 (race past the pre-check)', async () => {
    await reset()
    const a = apiOf(await login(t, ADMIN))
    const body = teacherBody(s1, { email: 'serentak@ujian.test' })
    const rs = await Promise.all([a.post('/admin/users', body), a.post('/admin/users', body), a.post('/admin/users', body)])
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1)
    for (const r of rs.filter((x) => x.status !== 201)) {
      expect(r.status).toBe(422)
      expect(r.body.error.fields.email).toBe('The email has already been taken.')
    }
    expect((await t.db.query(`select 1 from users where email = 'serentak@ujian.test'`)).length).toBe(1)
  })
})

describe('import atomicity: a failure after the inserts rolls everything back', () => {
  it('a failing import_jobs insert leaves no user, no job and no audit row', async () => {
    const t = await bootUsersApp({ env: { THROTTLE_IMPORT_PER_HOUR: '100000' } })
    try {
      const a = apiOf(await login(t, ADMIN))
      const s = await schoolIdOf(t.db, 'DEMO001')
      await t.db.query(`create function zz_fail() returns trigger language plpgsql as $$ begin raise exception 'forced failure'; end $$`)
      await t.db.query(`create trigger zz_fail_trg before insert on import_jobs for each row execute function zz_fail()`)
      const users = (await t.db.query<{ n: number }>(`select count(*)::int n from users`))[0]?.n
      const audits = (await t.db.query<{ n: number }>(`select count(*)::int n from audit_events`))[0]?.n
      const res = await a.post('/admin/users/bulk-import', {
        role: 'teacher',
        schoolId: s,
        importMode: 'paste',
        pasteContent: 'Guru A,gagal1@import.test\nGuru B,gagal2@import.test',
      })
      expect(res.status).toBe(500)
      expect((await t.db.query<{ n: number }>(`select count(*)::int n from users`))[0]?.n).toBe(users)
      expect((await t.db.query(`select 1 from user_roles r join users u on u.id = r.user_id where u.email like 'gagal%'`)).length).toBe(0)
      expect((await t.db.query(`select 1 from import_jobs`)).length).toBe(0)
      expect((await t.db.query<{ n: number }>(`select count(*)::int n from audit_events`))[0]?.n).toBe(audits)
      // Without the trigger the same file imports.
      await t.db.query(`drop trigger zz_fail_trg on import_jobs`)
      const ok = await a.post('/admin/users/bulk-import', { role: 'teacher', schoolId: s, importMode: 'paste', pasteContent: 'Guru A,gagal1@import.test' })
      expect(ok.status).toBe(200)
    } finally {
      await t.close()
    }
  })
})
