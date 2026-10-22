import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ErrorBodySchema } from '@pp/contract'

import { addMcqs, bootBattleApp, client, STUDENT_G10, STUDENT_G10_B, STUDENT_G11, subjectsOf, type BattleTestApp, type Client } from './arena-helpers'

const UUID = '00000000-0000-4000-8000-000000000001'

/** The 16 routes of the queue, invitation, forfeit, lobby and arena part of BE-44 (catalogue M16-02 to M16-17). */
const ROUTES: { method: 'get' | 'post'; path: string }[] = [
  { method: 'post', path: '/battle/quick-match' },
  { method: 'post', path: '/battle/school-battle' },
  { method: 'get', path: '/battle/poll-match/1' },
  { method: 'post', path: '/battle/accept-challenger/1' },
  { method: 'post', path: '/battle/reject-challenger/1' },
  { method: 'post', path: '/battle/join-queue/1' },
  { method: 'get', path: '/battle/poll-challenger/1' },
  { method: 'get', path: '/battle/search-opponent?q=murid' },
  { method: 'post', path: '/battle/invite' },
  { method: 'get', path: '/battle/invitations' },
  { method: 'post', path: `/battle/invite/${UUID}/accept` },
  { method: 'post', path: `/battle/invite/${UUID}/decline` },
  { method: 'post', path: `/battle/forfeit/${UUID}` },
  { method: 'get', path: '/battle/lobby' },
  { method: 'get', path: `/battle/arena/${UUID}` },
  { method: 'post', path: `/battle/arena/${UUID}/answer` },
]

describe('guards of the queue, invitation, forfeit, lobby and arena routes (AC 1)', () => {
  let t: BattleTestApp
  let a: Client

  beforeAll(async () => {
    t = await bootBattleApp()
    a = await client(t, STUDENT_G10)
  }, 180_000)
  afterAll(async () => t.close())

  it('covers the 16 routes', () => {
    expect(ROUTES.length).toBe(16)
    expect(new Set(ROUTES.map((r) => `${r.method} ${r.path.split('?')[0]?.replace(UUID, ':uuid')}`)).size).toBe(16)
  })

  it.each(ROUTES.map((r) => [`${r.method.toUpperCase()} ${r.path}`, r] as const))('%s without a session is 401 UNAUTHORIZED "Unauthenticated."', async (_n, r) => {
    const res = r.method === 'get' ? await t.http().get(`/api${r.path}`) : await t.http().post(`/api${r.path}`).send({})
    expect(res.status).toBe(401)
    expect(ErrorBodySchema.parse(res.body).error).toMatchObject({ code: 'UNAUTHORIZED', message: 'Unauthenticated.' })
  })

  it.each(ROUTES.filter((r) => r.method === 'post').map((r) => [r.path, r] as const))('POST %s without the CSRF header is 403 CSRF_INVALID', async (_n, r) => {
    const res = await a.who.agent.post(`/api${r.path}`).send({})
    expect(res.status).toBe(403)
    expect(ErrorBodySchema.parse(res.body).error.code).toBe('CSRF_INVALID')
  })

  it('every signed-in role reaches the routes (staff and teachers get answers, not 403)', async () => {
    for (const email of ['guru@demo.test', 'admin@demo.test', 'adminsekolah@demo.test']) {
      const who = await client(t, email)
      expect((await who.get('/battle/lobby')).status, email).toBe(200)
      expect((await who.get('/battle/invitations')).status, email).toBe(200)
      expect((await who.get('/battle/poll-match/1')).status, email).toBe(200)
    }
  })

  it('answers of the arena flow are never cached (Cache-Control: no-store), errors included', async () => {
    for (const [path, post] of [['/battle/lobby', false], ['/battle/invitations', false], ['/battle/search-opponent?q=murid', false], [`/battle/arena/${UUID}`, false], ['/battle/poll-match/1', false], [`/battle/forfeit/${UUID}`, true], ['/battle/quick-match', true]] as const) {
      const res = post ? await a.post(path, {}) : await a.get(path)
      expect(res.headers['cache-control'], path).toBe('no-store')
    }
  })
})

describe('rate limits (D57)', () => {
  let t: BattleTestApp
  let b: Client
  let c: Client

  beforeAll(async () => {
    t = await bootBattleApp({ env: { THROTTLE_BATTLE_WRITE_PER_MINUTE: '3', THROTTLE_BATTLE_SEARCH_PER_MINUTE: '2', THROTTLE_BATTLE_POLL_PER_MINUTE: '2' } })
    const s = await subjectsOf(t)
    await addMcqs(t, s.math, s.t4, 1)
    ;[b, c] = [await client(t, STUDENT_G10_B), await client(t, STUDENT_G11)]
  }, 180_000)
  afterAll(async () => t.close())

  it('a write route answers 429 RATE_LIMITED with retryAfter and a Retry-After header once the user\'s bucket is full', async () => {
    for (let i = 0; i < 3; i++) expect((await b.post('/battle/reject-challenger/1')).status).toBe(404)
    const res = await b.post('/battle/reject-challenger/1')
    expect(res.status).toBe(429)
    const err = ErrorBodySchema.parse(res.body).error
    expect(err.code).toBe('RATE_LIMITED')
    expect(err.retryAfter).toBeGreaterThan(0)
    expect(Number(res.headers['retry-after'])).toBe(err.retryAfter)
    // the bucket is per user and shared by every write route
    expect((await b.post('/battle/forfeit/' + UUID)).status).toBe(429)
    expect((await c.post('/battle/reject-challenger/1')).status).toBe(404)
    // a minute later it is open again
    t.clock.advance(61_000)
    expect((await b.post('/battle/reject-challenger/1')).status).toBe(404)
  })

  it('the name search and the polls have their own buckets', async () => {
    for (let i = 0; i < 2; i++) expect((await c.get('/battle/search-opponent?q=murid')).status).toBe(200)
    expect((await c.get('/battle/search-opponent?q=murid')).status).toBe(429)
    for (let i = 0; i < 2; i++) expect((await c.get('/battle/poll-match/1')).status).toBe(200)
    const limited = await c.get('/battle/poll-match/1')
    expect(limited.status).toBe(429)
    expect(ErrorBodySchema.parse(limited.body).error.code).toBe('RATE_LIMITED')
    // reads are not limited by those buckets
    expect((await c.get('/battle/lobby')).status).toBe(200)
  })
})
