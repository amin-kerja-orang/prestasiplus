/**
 * `seedSchoolAdminWithoutSchool` test hook (M27 SRS §6.4, XR-M27-05): a `school_admin` with `schoolId` null,
 * written through the M01 users store; the M27 guard refuses it; `mock.reset()` removes it.
 */

import { beforeAll, describe, expect, it } from 'vitest'

import { CLOCK_ANCHOR_ISO, createClock } from '@/lib/time'
import { DEMO_PASSWORD } from '@/mock/core-data/accounts'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01, { users } from '@/modules/m01-authentication/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m04 from '@/modules/m04-question-bank/mock'
import m05 from '@/modules/m05-practice/mock'
import m08 from '@/modules/m08-student-performance/mock'
import m09 from '@/modules/m09-content/mock'
import m10 from '@/modules/m10-teacher-class/mock'
import m27 from '@/modules/m27-school-admin/mock'

import m02 from '../../mock'
import { ORPHAN_SCHOOL_ADMIN_EMAIL, seedSchoolAdminWithoutSchool } from '../../mock/hooks'

let runtime: MockRuntime

beforeAll(async () => {
  runtime = await bootMock({
    mode: 'test',
    plugins: [m01, m02, m03, m04, m05, m08, m09, m10, m27],
    clock: createClock({ at: CLOCK_ANCHOR_ISO }),
    latencyMs: 0,
    onWarn: null,
  })
}, 600_000)

async function post(url: string, body: unknown, token?: string) {
  const headers: Record<string, string> = {
    accept: 'application/json',
    'content-type': 'application/json',
  }
  if (token) headers.authorization = `Bearer ${token}`
  return runtime.transport.request({ method: 'POST', url, headers, body })
}

describe('seedSchoolAdminWithoutSchool (XR-M27-05)', () => {
  it('is registered as an M02 hook', () => {
    expect(m02.hooks).toHaveProperty('seedSchoolAdminWithoutSchool')
  })

  it('creates one school_admin with schoolId null, a runtime id and a demo e-mail', () => {
    const a = seedSchoolAdminWithoutSchool()
    expect(a.email).toBe(ORPHAN_SCHOOL_ADMIN_EMAIL)
    expect(a.email.endsWith('@demo.test')).toBe(true)
    expect(a.id).toBeGreaterThanOrEqual(1000)
    const row = users.get(a.id)
    expect(row?.role).toBe('school_admin')
    expect(row?.schoolId).toBeNull()
  })

  it('is idempotent', () => {
    const a = seedSchoolAdminWithoutSchool()
    const b = seedSchoolAdminWithoutSchool()
    expect(b).toEqual(a)
    expect(users.findByEmail(a.email)?.id).toBe(a.id)
  })

  it('lets the account log in, and M27 answers 403 to it', async () => {
    const a = seedSchoolAdminWithoutSchool()
    const login = await post('/api/auth/login', { email: a.email, password: a.password })
    expect(login.status).toBe(200)
    const token = (login.body as { data: { token: string } }).data.token
    const res = await runtime.transport.request({
      method: 'GET',
      url: '/api/admin-sekolah/dashboard',
      headers: { accept: 'application/json', authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(403)
    expect(a.password).toBe(DEMO_PASSWORD)
  })

  it('is removed by mock.reset()', async () => {
    const a = seedSchoolAdminWithoutSchool()
    await runtime.reset()
    expect(users.findByEmail(a.email)).toBeUndefined()
    expect(users.get(a.id)).toBeUndefined()
  })
})
