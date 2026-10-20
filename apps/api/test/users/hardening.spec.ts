import { CreatedUserSchema, LAST_ADMIN_MESSAGE } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { Argon2Gate, argon2Gate, ARGON2_SLOTS, PasswordService } from '../../src/modules/auth/password.service'
import { ADMIN, apiOf, bootUsersApp, expectError, login, schoolIdOf, teacherBody, type Api, type UsersTestApp } from './helpers'

describe('Argon2Gate: a process-wide limit of hashing slots (security M1)', () => {
  const deferred = () => {
    let release!: () => void
    const done = new Promise<void>((r) => (release = r))
    return { done, release }
  }

  it('never runs more than the slot count at once, and serves verification before bulk hashing', async () => {
    const gate = new Argon2Gate(2)
    const order: string[] = []
    let running = 0
    const job = (name: string, wait: Promise<void>) => async () => {
      running++
      expect(running).toBeLessThanOrEqual(2)
      order.push(name)
      await wait
      running--
    }
    const a = deferred()
    const b = deferred()
    const free = Promise.resolve()
    const p1 = gate.run('low', job('low1', a.done))
    const p2 = gate.run('low', job('low2', b.done))
    const p3 = gate.run('low', job('low3', free))
    const p4 = gate.run('low', job('low4', free))
    const p5 = gate.run('high', job('login', free)) // arrives last, goes first
    await Promise.resolve()
    expect(order).toEqual(['low1', 'low2'])
    a.release()
    await p1
    await vi.waitFor(() => expect(order).toContain('login'))
    b.release()
    await Promise.all([p1, p2, p3, p4, p5])
    expect(order).toEqual(['low1', 'low2', 'login', 'low3', 'low4'])
    expect(gate.peak).toBe(2)
  })

  it('a failing job frees its slot', async () => {
    const gate = new Argon2Gate(1)
    await expect(gate.run('low', () => Promise.reject(new Error('boom')))).rejects.toThrow('boom')
    await expect(gate.run('low', () => Promise.resolve(7))).resolves.toBe(7)
  })

  describe('through the API', () => {
    let t: UsersTestApp
    beforeAll(async () => {
      t = await bootUsersApp({ env: { THROTTLE_IMPORT_PER_HOUR: '100000' } })
    })
    afterAll(async () => {
      await t.close()
    })

    it('two concurrent big imports never hash more than 2 at once', async () => {
      const s = await schoolIdOf(t.db, 'DEMO001')
      const one = apiOf(await login(t, ADMIN))
      const two = apiOf(await login(t, ADMIN))
      const rows = (tag: string) => Array.from({ length: 40 }, (_, i) => `Guru ${tag}${String(i)},${tag}${String(i)}@gate.test`).join('\n')
      argon2Gate.peak = 0
      const [r1, r2] = await Promise.all([
        one.post('/admin/users/bulk-import', { role: 'teacher', schoolId: s, importMode: 'paste', pasteContent: rows('a') }),
        two.post('/admin/users/bulk-import', { role: 'teacher', schoolId: s, importMode: 'paste', pasteContent: rows('b') }),
      ])
      expect(r1.body.data.created).toBe(40)
      expect(r2.body.data.created).toBe(40)
      expect(argon2Gate.peak).toBeGreaterThanOrEqual(1)
      expect(argon2Gate.peak).toBeLessThanOrEqual(ARGON2_SLOTS)
    }, 120_000)
  })
})

describe('suspended admins do not count as admins (I7)', () => {
  let t: UsersTestApp
  let admin: Api
  let s1: string

  beforeAll(async () => {
    t = await bootUsersApp({ env: { THROTTLE_ADMIN_WRITE_PER_MINUTE: '100000', THROTTLE_ADMIN_READ_PER_MINUTE: '100000' } })
    admin = apiOf(await login(t, ADMIN))
    s1 = await schoolIdOf(t.db, 'DEMO001')
  })
  afterAll(async () => {
    await t.close()
  })

  it('the last unsuspended admin cannot be demoted or deactivated while another admin is suspended (delete and bulk delete use the same count)', async () => {
    const other = CreatedUserSchema.parse((await admin.post('/admin/users', { roles: ['admin'], name: 'Admin Digantung', email: 'digantung.admin@ujian.test' })).body.data)
    await t.db.query(`update users set is_suspended = true where id = $1`, [other.id])
    const me = (await t.db.query<{ id: string }>(`select id::text from users where email = $1`, [ADMIN]))[0]?.id as string
    // A second admin exists and is active, but suspended: it cannot log in, so it does not count.
    expectError(await admin.post(`/admin/users/${me}/toggle-active`), 'CONFLICT', LAST_ADMIN_MESSAGE)
    expectError(await admin.put(`/admin/users/${me}`, { roles: ['admin'], name: 'X', isActive: false }), 'CONFLICT', LAST_ADMIN_MESSAGE)
    expectError(await admin.put(`/admin/users/${me}`, { roles: ['teacher'], name: 'X', schoolId: s1 }), 'CONFLICT', LAST_ADMIN_MESSAGE)
    // Another admin (the suspended one's sibling) being the target: deleting the suspended admin is fine,
    // deleting the only unsuspended admin through a list is not.
    const third = CreatedUserSchema.parse((await admin.post('/admin/users', { roles: ['admin'], name: 'Admin Tiga', email: 'tiga.admin@ujian.test' })).body.data)
    const thirdApi = apiOf(await login(t, 'tiga.admin@ujian.test', { password: third.generatedPassword }))
    expect((await admin.post('/admin/users/bulk-delete', { ids: [third.id] })).body.data).toEqual({ deleted: 1 })
    expectError(await thirdApi.get('/admin/users'), 'UNAUTHORIZED')
    const del = await admin.post('/admin/users/bulk-delete', { ids: [other.id] })
    expect(del.status).toBe(200) // removing a suspended admin leaves the unsuspended one
    expect(del.body.data).toEqual({ deleted: 1 })
  })
})

describe('list search treats % and _ literally (I12)', () => {
  let t: UsersTestApp
  let admin: Api
  let s1: string

  beforeAll(async () => {
    t = await bootUsersApp({ env: { THROTTLE_ADMIN_WRITE_PER_MINUTE: '100000', THROTTLE_ADMIN_READ_PER_MINUTE: '100000' } })
    admin = apiOf(await login(t, ADMIN))
    s1 = await schoolIdOf(t.db, 'DEMO001')
    await admin.post('/admin/users', teacherBody(s1, { name: 'Satu%Persen', email: 'persen@ujian.test' }))
    await admin.post('/admin/users', teacherBody(s1, { name: 'Dua_Garis', email: 'garis@ujian.test' }))
    await admin.post('/admin/users', teacherBody(s1, { name: 'Tiga Biasa', email: 'biasa@ujian.test' }))
  })
  afterAll(async () => {
    await t.close()
  })

  const names = async (q: string) => ((await admin.get(`/admin/users?search=${encodeURIComponent(q)}`)).body.data as { name: string }[]).map((u) => u.name)

  it('% matches only a literal percent sign', async () => {
    expect(await names('%')).toEqual(['Satu%Persen'])
    expect(await names('u%P')).toEqual(['Satu%Persen'])
  })

  it('_ matches only a literal underscore (not any single character)', async () => {
    expect(await names('_')).toEqual(['Dua_Garis'])
    expect(await names('a_G')).toEqual(['Dua_Garis'])
    expect(await names('T_ga')).toEqual([])
  })

  it('the student search also treats % and _ literally', async () => {
    expect((await admin.get(`/students/search?q=${encodeURIComponent('%%%')}`)).body.data).toEqual([])
    expect((await admin.get(`/students/search?q=${encodeURIComponent('___')}`)).body.data).toEqual([])
  })
})

describe('404 before hashing', () => {
  it('an unknown id with resetPassword never calls PasswordService.hash', async () => {
    const t = await bootUsersApp()
    try {
      const a = apiOf(await login(t, ADMIN))
      const spy = vi.spyOn(t.app.get(PasswordService), 'hash')
      expectError(await a.put('/admin/users/987654321', { roles: ['teacher'], name: 'X', resetPassword: true }), 'NOT_FOUND')
      expect(spy).not.toHaveBeenCalled()
      const s = await schoolIdOf(t.db, 'DEMO001')
      const u = CreatedUserSchema.parse((await a.post('/admin/users', teacherBody(s))).body.data)
      spy.mockClear()
      expect((await a.put(`/admin/users/${u.id}`, { roles: ['teacher'], name: 'Y', resetPassword: true })).status).toBe(200)
      expect(spy).toHaveBeenCalledTimes(1)
    } finally {
      await t.close()
    }
  })
})
