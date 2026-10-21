/**
 * Mock handlers of the pending-teacher endpoints (contract `school-admin/pending-teachers.ts`): the mock data has no
 * pending teacher, so the list is empty and a verify is the contract's 404. The guard answers 401 / 403 first.
 */

import { beforeAll, describe, expect, it } from 'vitest'

import type { HttpMethod, TransportResponse } from '@/api/transport'
import { CLOCK_ANCHOR_ISO, createClock } from '@/lib/time'
import { setUser } from '@/mock/core-data/set-user'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01 from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m04 from '@/modules/m04-question-bank/mock'
import m05 from '@/modules/m05-practice/mock'
import m08 from '@/modules/m08-student-performance/mock'
import m09 from '@/modules/m09-content/mock'
import m10 from '@/modules/m10-teacher-class/mock'

import m27 from '../../mock'

const ADMIN = 1
const GURU = 5
const SCHOOL_ADMIN = 8
const BASE = '/api/admin-sekolah/guru'

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

async function call(userId: number | null, url: string, method: HttpMethod = 'GET') {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (userId !== null) headers.authorization = `Bearer ${setUser(userId).token}`
  const res: TransportResponse = await runtime.transport.request({ method, url, headers })
  return { status: res.status, body: res.body as { data?: unknown[]; meta?: Record<string, unknown> } }
}

describe('GET /admin-sekolah/guru/pending', () => {
  it('is an empty unpaged list for a school admin (and is not read as a teacher id)', async () => {
    const r = await call(SCHOOL_ADMIN, `${BASE}/pending`)
    expect(r.status).toBe(200)
    expect(r.body.data).toEqual([])
    expect(r.body.meta).toMatchObject({ page: 1, pageSize: 1, totalItems: 0, totalPages: 1 })
  })

  it.each([
    ['guest', null, 401],
    ['Admin Pusat', ADMIN, 403],
    ['teacher', GURU, 403],
  ])('%s gets %i', async (_n, user, status) => {
    expect((await call(user, `${BASE}/pending`)).status).toBe(status)
  })
})

describe('POST /admin-sekolah/guru/{id}/verify', () => {
  it('is 404 for any id (nobody is pending in the mock data)', async () => {
    expect((await call(SCHOOL_ADMIN, `${BASE}/5/verify`, 'POST')).status).toBe(404)
    expect((await call(SCHOOL_ADMIN, `${BASE}/zzz/verify`, 'POST')).status).toBe(404)
  })

  it('is guarded: 401 guest, 403 other roles', async () => {
    expect((await call(null, `${BASE}/5/verify`, 'POST')).status).toBe(401)
    expect((await call(GURU, `${BASE}/5/verify`, 'POST')).status).toBe(403)
    expect((await call(ADMIN, `${BASE}/5/verify`, 'POST')).status).toBe(403)
  })
})
