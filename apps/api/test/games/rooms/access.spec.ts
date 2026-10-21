import { ErrorBodySchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  ACCOUNTS,
  bootGamesApp,
  expectCsrfInvalid,
  expectError,
  loginAs,
  type Client,
  type GamesTestApp,
} from '../helpers'
import { FORM, P, createRoom } from './support'

type Route = { name: string; method: 'get' | 'post' | 'put'; url: string; body?: object }

const ROUTES: Route[] = [
  { name: 'hub', method: 'get', url: '/api/games/hub' },
  { name: 'lobby', method: 'get', url: '/api/games/papan-bijak/lobby' },
  { name: 'create', method: 'post', url: P('perang-fakta'), body: FORM },
  {
    name: 'join',
    method: 'post',
    url: P('perang-fakta', undefined, '/join'),
    body: { room_code: 'ABCDEF' },
  },
  { name: 'view', method: 'get', url: P('perang-fakta', 'ABCDEF') },
  { name: 'start', method: 'post', url: P('perang-fakta', 'ABCDEF', '/start') },
  {
    name: 'action',
    method: 'post',
    url: P('perang-fakta', 'ABCDEF', '/action'),
    body: { type: 'roll' },
  },
  {
    name: 'quick-match start',
    method: 'post',
    url: '/api/papan-bijak/quick-match',
    body: { subject: 'SAINS', match_mode: 'same_grade' },
  },
  { name: 'quick-match poll', method: 'get', url: '/api/papan-bijak/quick-match/poll' },
  { name: 'quick-match cancel', method: 'post', url: '/api/papan-bijak/quick-match/cancel' },
  { name: 'admin overview', method: 'get', url: '/api/admin/games' },
  {
    name: 'admin settings',
    method: 'put',
    url: '/api/admin/games/settings',
    body: { boardgame_quiz_tiles: 3 },
  },
]

describe('guards on every route (AC1)', () => {
  let t: GamesTestApp
  let student: Client
  let admin: Client

  beforeAll(async () => {
    t = await bootGamesApp()
    student = await loginAs(t, ACCOUNTS.student)
    admin = await loginAs(t, ACCOUNTS.admin)
  })
  afterAll(async () => {
    await t.close()
  })

  for (const r of ROUTES) {
    it(`${r.name}: 401 "Unauthenticated." without a session (standard envelope)`, async () => {
      const req = t.http()[r.method](r.url)
      const res = await (r.body ? req.send(r.body) : req)
      expectError(res, 'UNAUTHORIZED', 'Unauthenticated.')
    })
  }

  for (const r of ROUTES.filter((x) => x.method !== 'get')) {
    it(`${r.name}: CSRF_INVALID without the token (standard envelope even on the raw quick-match routes)`, async () => {
      const c = r.url.includes('/admin/') ? admin : student
      const res = await c.noCsrf[r.method as 'post' | 'put'](r.url, r.body)
      expectCsrfInvalid(res)
      const wrong = await (r.url.includes('/admin/') ? admin : student)
        [r.method as 'post' | 'put'](r.url, r.body)
        .set('X-CSRF-Token', 'wrong-token')
      expectCsrfInvalid(wrong)
    })
  }

  it('Cache-Control no-store is on the hub, create, join and the room view; errors thrown by the handler carry it too', async () => {
    expect((await student.get('/api/games/hub')).headers['cache-control']).toBe('no-store')
    const code = await createRoom(student, 'perang-fakta')
    const created = await student.post(P('perang-fakta'), FORM)
    expect(created.headers['cache-control']).toBe('no-store')
    const joined = await student.post(P('perang-fakta', undefined, '/join'), { room_code: code })
    expect(joined.headers['cache-control']).toBe('no-store')
    expect((await student.get(P('perang-fakta', code))).headers['cache-control']).toBe('no-store')
    expect((await student.get(P('perang-fakta', 'ZZZZZZ'))).headers['cache-control']).toBe(
      'no-store',
    )
  })
})

describe('rate limits (D57) on the room writes and reads', () => {
  let t: GamesTestApp
  let student: Client

  beforeAll(async () => {
    t = await bootGamesApp({
      env: { THROTTLE_GAMES_WRITE_PER_MINUTE: '3', THROTTLE_GAMES_READ_PER_MINUTE: '3' },
    })
    student = await loginAs(t, ACCOUNTS.student)
  })
  afterAll(async () => {
    await t.close()
  })

  it('429 RATE_LIMITED with retryAfter and Retry-After after the ceiling; a CSRF-refused write is not counted; the window reopens', async () => {
    expectCsrfInvalid(await student.noCsrf.post(P('perang-fakta'), FORM))
    for (let i = 0; i < 3; i++)
      expect((await student.post(P('perang-fakta'), FORM)).status).toBe(201)
    const res = await student.post(P('perang-fakta'), FORM)
    const err = expectError(res, 'RATE_LIMITED')
    expect(ErrorBodySchema.parse(res.body).error.retryAfter).toBeGreaterThan(0)
    expect(res.headers['retry-after']).toBe(String(err.retryAfter))
    // the other write routes share the bucket
    expectError(await student.post('/api/papan-bijak/quick-match/cancel'), 'RATE_LIMITED')
    // a different user has their own budget
    const other = await loginAs(t, ACCOUNTS.student2)
    expect((await other.post(P('perang-fakta'), FORM)).status).toBe(201)
    t.clock.advance(61_000)
    expect((await student.post(P('perang-fakta'), FORM)).status).toBe(201)
  })

  it('reads are limited per user too (hub)', async () => {
    t.clock.advance(61_000)
    for (let i = 0; i < 3; i++) expect((await student.get('/api/games/hub')).status).toBe(200)
    expectError(await student.get('/api/games/hub'), 'RATE_LIMITED')
    t.clock.advance(61_000)
    expect((await student.get('/api/games/hub')).status).toBe(200)
  })
})
