/**
 * S5-T04 API-MUR-11 mock parity: `POST /api/me/mood` and `GET /api/me/mood/today` (student only, one check-in per Malaysia
 * day, 409 ALREADY_CHECKED_IN on the second and the stored choice unchanged, 422 on a bad value).
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { CLOCK_ANCHOR_ISO, createClock } from '@/lib/time'
import { setUser } from '@/mock/core-data/set-user'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01 from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m04 from '@/modules/m04-question-bank/mock'
import m14 from '@/modules/m14-gamification/mock'

import m05 from '../../mock'
import { MOOD_ALREADY_CHECKED_IN } from '../../mock/handlers/mood'
import { ADMIN, GURU, MemoryStorage, PELAJAR, PELAJAR2, type ErrorBody } from './boot-all'

let runtime: MockRuntime
const clock = createClock({ at: CLOCK_ANCHOR_ISO })

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  runtime = await bootMock({ mode: 'test', plugins: [m01, m02, m03, m04, m05, m14], clock, latencyMs: 0, onWarn: null })
}, 120_000)
afterAll(() => {
  vi.unstubAllGlobals()
})

async function call(userId: number | null, method: 'GET' | 'POST', url: string, body?: unknown) {
  const res = await runtime.transport.request({
    method,
    url,
    headers: {
      accept: 'application/json',
      ...(userId === null ? {} : { authorization: `Bearer ${setUser(userId).token}` }),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body } : {}),
  })
  return { status: res.status, body: res.body as { data?: unknown } & ErrorBody }
}

describe('API-MUR-11 mock', () => {
  it('reads null, records the first choice, reads it back, and refuses the second with 409 leaving the row unchanged', async () => {
    expect((await call(PELAJAR, 'GET', '/api/me/mood/today')).body.data).toEqual({ mood: null })

    const first = await call(PELAJAR, 'POST', '/api/me/mood', { mood: 'sedih' })
    expect(first.status).toBe(200)
    expect(first.body.data).toEqual({ mood: 'sedih', checkedOn: '2026-09-25' })

    const second = await call(PELAJAR, 'POST', '/api/me/mood', { mood: 'gembira' })
    expect(second.status).toBe(409)
    expect(second.body.error.code).toBe('ALREADY_CHECKED_IN')
    expect(second.body.error.message).toBe(MOOD_ALREADY_CHECKED_IN)
    expect(MOOD_ALREADY_CHECKED_IN).toBe('Anda sudah merekodkan perasaan hari ini.')
    expect((await call(PELAJAR, 'GET', '/api/me/mood/today')).body.data).toEqual({ mood: 'sedih' })
  })

  it('keeps pupils apart and starts a new day after midnight in Malaysia', async () => {
    expect((await call(PELAJAR2, 'GET', '/api/me/mood/today')).body.data).toEqual({ mood: null })
    expect((await call(PELAJAR2, 'POST', '/api/me/mood', { mood: 'tertekan' })).status).toBe(200)
    clock.advance(10 * 3_600_000)
    expect((await call(PELAJAR, 'GET', '/api/me/mood/today')).body.data).toEqual({ mood: null })
    expect((await call(PELAJAR, 'POST', '/api/me/mood', { mood: 'okay' })).body.data).toEqual({ mood: 'okay', checkedOn: '2026-09-26' })
  })

  it.each([{ mood: 'happy' }, { mood: '' }, { mood: 4 }, {}])('answers 422 on fields.mood for %j', async (body) => {
    const r = await call(PELAJAR2, 'POST', '/api/me/mood', body)
    expect(r.status).toBe(422)
    expect(Object.keys((r.body.error as { fields?: Record<string, string> }).fields ?? {})).toEqual(['mood'])
  })

  it('answers 401 without a session and 403 for a teacher or an admin', async () => {
    expect((await call(null, 'GET', '/api/me/mood/today')).status).toBe(401)
    expect((await call(null, 'POST', '/api/me/mood', { mood: 'okay' })).status).toBe(401)
    for (const who of [GURU, ADMIN]) {
      expect((await call(who, 'POST', '/api/me/mood', { mood: 'okay' })).status).toBe(403)
      expect((await call(who, 'GET', '/api/me/mood/today')).status).toBe(403)
    }
  })
})
