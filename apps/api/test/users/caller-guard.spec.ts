import type { INestApplication } from '@nestjs/common'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { AuthContext } from '../../src/common/scope/auth-context'
import { PostgresSessionResolver } from '../../src/modules/auth/session-resolver.service'
import { callerOf } from '../../src/modules/users/caller'
import { ADMIN, apiOf, bootUsersApp, expectError, login, SCHOOL_ADMIN, type UsersTestApp } from './helpers'

const auth = (role: string, scope: object): AuthContext =>
  ({ sessionRowId: 's', userId: '7', roles: [], active: { role, portal: 'pentadbiran', scope }, mode: null, capabilities: [] }) as unknown as AuthContext
const req = (a: AuthContext) => ({ auth: a, ip: '127.0.0.1', socket: {} }) as never

describe('callerOf fails closed (a non-admin caller without a school)', () => {
  it('throws 404 NOT_FOUND for a school_admin or teacher whose scope has no school', () => {
    for (const role of ['school_admin', 'teacher']) {
      expect(() => callerOf(req(auth(role, { level: 'school', label: 'x' })))).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }))
      expect(() => callerOf(req(auth(role, { level: 'district', districtCode: 'PPD X', label: 'x' })))).toThrow(
        expect.objectContaining({ code: 'NOT_FOUND' }),
      )
    }
  })

  it('keeps the admin (national, no school) and a school-scoped caller working', () => {
    expect(callerOf(req(auth('admin', { level: 'national', label: 'x' }))).schoolId).toBeNull()
    expect(callerOf(req(auth('school_admin', { level: 'school', schoolId: '3', label: 'x' }))).schoolId).toBe('3')
  })
})

describe('HTTP: a school_admin whose scope has no school gets 404, and nothing is written', () => {
  let t: UsersTestApp
  let app: INestApplication
  beforeAll(async () => {
    t = await bootUsersApp()
    app = t.app
  })
  afterAll(async () => {
    await t.close()
  })

  it('GET and POST /api/admin/users and the bulk import are 404 (not 500); no user row is written', async () => {
    const real = apiOf(await login(t, SCHOOL_ADMIN))
    const who = await login(t, SCHOOL_ADMIN)
    const resolver = app.get(PostgresSessionResolver)
    const original = resolver.resolve.bind(resolver)
    const spy = vi.spyOn(resolver, 'resolve').mockImplementation(async (r) => {
      const a = await original(r)
      return a ? { ...a, active: { ...a.active, scope: { level: 'school', label: 'tanpa sekolah' } } } : a
    })
    const before = (await t.db.query<{ n: number }>(`select count(*)::int n from users`))[0]?.n
    const me = apiOf(who)
    expectError(await me.get('/admin/users'), 'NOT_FOUND')
    expectError(await me.post('/admin/users', { roles: ['teacher'], name: 'Tanpa Sekolah', email: 'tanpa.sekolah@ujian.test' }), 'NOT_FOUND')
    expectError(
      await me.post('/admin/users/bulk-import', { role: 'teacher', schoolId: '1', importMode: 'paste', pasteContent: 'A,tanpa.import@ujian.test' }),
      'NOT_FOUND',
    )
    spy.mockRestore()
    expect((await t.db.query<{ n: number }>(`select count(*)::int n from users`))[0]?.n).toBe(before)
    expect((await t.db.query(`select 1 from import_jobs`)).length).toBe(0)
    // Normal behaviour is back, and the admin was never affected.
    expect((await real.get('/admin/users')).status).toBe(200)
    expect((await apiOf(await login(t, ADMIN)).get('/admin/users')).status).toBe(200)
  })
})
