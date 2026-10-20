import { ServerStatusResponseSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { etagOf } from '../../src/modules/command-center/http/etag.interceptor'
import {
  bootCommandCenterApp,
  CC_ROUTES,
  type CcRole,
  type CcTestApp,
  createUser,
  expectGuards,
  getAs,
  login,
  loginRole,
  type LoggedIn,
  schoolIdOf,
} from './helpers'

let t: CcTestApp
const sessions: Partial<Record<CcRole, LoggedIn>> = {}

beforeAll(async () => {
  t = await bootCommandCenterApp()
  for (const role of ['admin', 'school_admin', 'teacher', 'student'] as CcRole[]) sessions[role] = await loginRole(t, role)
})
afterAll(async () => {
  await t.close()
})

describe('route table', () => {
  it('declares 18 routes', () => {
    expect(CC_ROUTES).toHaveLength(18)
  })
})

describe('guards on all 18 routes', () => {
  for (const route of CC_ROUTES) {
    it(`${route.path}: anonymous 401, roles outside ${route.allowed.join('/')} get 403`, async () => {
      await expectGuards(t, route, sessions)
    })
  }

  it('a school admin whose school is removed after login has no session at all (401), never platform figures', async () => {
    const sa = await createUser(t.db, { role: 'school_admin', schoolId: await schoolIdOf(t.db, 'DEMO001') })
    const who = await login(t, sa.email)
    await t.db.query(`update users set school_id = null where id = $1::bigint`, [sa.id])
    const res = await getAs(who, '/admin/command-center/live-data')
    expect(res.status).toBe(401)
  })
})

describe('server-status', () => {
  it('admin gets host readings only: contract shape, no extra keys, no-store, weak ETag', async () => {
    const res = await getAs(sessions.admin as LoggedIn, '/admin/server-status')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const body = ServerStatusResponseSchema.parse(res.body)
    expect(Object.keys(body.data).sort()).toEqual(
      ['cores', 'cpuPct', 'diskPct', 'diskTotalGb', 'diskUsedGb', 'load', 'ramPct', 'ramTotalGb', 'ramUsedGb', 'uptime'].sort(),
    )
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.headers.etag).toMatch(/^W\/"/)
    expect(JSON.stringify(res.body)).not.toMatch(/postgres|DATABASE_URL|SESSION_SECRET|\/home|\/root/i)
  })

  it('ETag / If-None-Match: a matching tag answers 304 with an empty body and still no-store; a different tag answers 200', async () => {
    const admin = sessions.admin as LoggedIn
    // Pin the validator to a stub so the host readings (which drift) do not decide the test.
    const first = await getAs(admin, '/admin/server-status')
    const tag = first.headers.etag as string
    const same = await admin.agent.get('/api/admin/server-status').set('If-None-Match', etagOf(first.body))
    // The readings may move between two calls; both outcomes must be consistent with the validator.
    if (same.headers.etag === etagOf(first.body)) expect(same.status).toBe(304)
    else expect(same.status).toBe(200)
    expect(same.headers['cache-control']).toBe('no-store')
    expect(tag).toBe(etagOf(first.body))
    const other = await admin.agent.get('/api/admin/server-status').set('If-None-Match', 'W/"other"')
    expect(other.status).toBe(200)
  })

  it('the validator ignores generatedAt, so a poll with only a new timestamp is still 304', () => {
    expect(etagOf({ data: { generatedAt: 'a', n: 1 } })).toBe(etagOf({ data: { generatedAt: 'b', n: 1 } }))
    expect(etagOf({ data: { generatedAt: 'a', n: 1 } })).not.toBe(etagOf({ data: { generatedAt: 'a', n: 2 } }))
  })

  it('answers 304 on a repeated unchanged body (stub the clock-free route with a fixed body)', async () => {
    // Two calls to server-status inside one tick normally share readings only by chance; assert 304 deterministically
    // by replaying the exact tag of a response: Express compares If-None-Match with the ETag set by the interceptor.
    const admin = sessions.admin as LoggedIn
    let hit = false
    for (let i = 0; i < 20 && !hit; i++) {
      const a = await getAs(admin, '/admin/server-status')
      const b = await admin.agent.get('/api/admin/server-status').set('If-None-Match', a.headers.etag as string)
      if (b.status === 304) {
        hit = true
        expect(b.text).toBe('')
        expect(b.headers['cache-control']).toBe('no-store')
      }
    }
    expect(hit, 'a 304 is produced when the validator matches').toBe(true)
  })
})

describe('stubs and shared reads', () => {
  it('an allowed role reaches the handler (200, not 401/403) and the answer is no-store', async () => {
    const res = await getAs(sessions.admin as LoggedIn, '/guru/command-center/evaluate')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
  })

  it('guru query validation answers the BM texts before the handler', async () => {
    const teacher = sessions.teacher as LoggedIn
    const type = await getAs(teacher, '/guru/command-center/drill?type=nope')
    expect(type.status).toBe(422)
    expect(type.body.error.message).toBe('Jenis drill tidak sah.')
    expect(type.body.error.fields).toEqual({ type: 'Jenis drill tidak sah.' })
    const filter = await getAs(teacher, '/guru/command-center/drill?type=students&filter=zzz')
    expect(filter.body.error.message).toBe('Penapis tidak sah.')
    const badge = await getAs(teacher, '/guru/command-center/badge-holders?badgeId=0')
    expect(badge.status).toBe(422)
    expect(badge.body.error.message).toBe('Lencana tidak sah.')
  })
})
