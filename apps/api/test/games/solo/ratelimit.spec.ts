import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ACCOUNTS, bootGamesApp, expectCsrfInvalid, loginAs, type Client, type GamesTestApp } from '../helpers'

describe('rate limits of the solo area (D57)', () => {
  let t: GamesTestApp
  let c: Client
  beforeAll(async () => {
    t = await bootGamesApp({
      env: {
        THROTTLE_GAMES_SOLO_START_PER_MINUTE: '2',
        THROTTLE_GAMES_SOLO_CHECK_PER_MINUTE: '2',
        THROTTLE_GAMES_SPIN_PER_MINUTE: '1',
        THROTTLE_GAMES_WRITE_PER_MINUTE: '1',
        THROTTLE_GAMES_READ_PER_MINUTE: '2',
      },
    })
    c = await loginAs(t, ACCOUNTS.student)
  })
  afterAll(async () => {
    await t.close()
  })

  const expectLimited = (res: { status: number; body: { error?: { code: string; retryAfter?: number } }; headers: Record<string, string> }) => {
    expect(res.status).toBe(429)
    expect(res.body.error?.code).toBe('RATE_LIMITED')
    expect(res.body.error?.retryAfter).toBeGreaterThan(0)
    expect(Number(res.headers['retry-after'])).toBe(res.body.error?.retryAfter)
  }

  it('the solo GET (it creates a session) answers 429 over its ceiling, and recovers when the window ends', async () => {
    expect((await c.get('/api/games/solo/tidak-ada')).status).toBe(404)
    expect((await c.get('/api/games/solo/tidak-ada')).status).toBe(404)
    expectLimited(await c.get('/api/games/solo/tidak-ada'))
    t.clock.advance(61_000)
    c = await loginAs(t, ACCOUNTS.student)
    expect((await c.get('/api/games/solo/tidak-ada')).status).toBe(404)
  })

  it('check / reveal / submit share the check ceiling; a request refused for CSRF is not counted', async () => {
    const id = '3f2b8a6e-5c1d-4e7a-9b0f-1a2b3c4d5e6f'
    expectCsrfInvalid(await c.noCsrf.post('/api/games/solo/betul-salah/check', {}))
    expect((await c.post('/api/games/solo/betul-salah/check', { session_id: id, item_id: '1', answer: true })).status).toBe(404)
    expect((await c.post('/api/games/solo/kad-memori/reveal', { session_id: id, card_id: 'a' })).status).toBe(404)
    expectLimited(await c.post('/api/games/solo/betul-salah/submit', { session_id: id }))
  })

  it('Roda Nasib: the spin has its own ceiling; the page and the Jutawan writes theirs', async () => {
    expect((await c.post('/api/games/roda-nasib/spin')).status).toBe(200)
    expectLimited(await c.post('/api/games/roda-nasib/spin'))
    expect((await c.post('/api/games/jutawan/start', {})).status).toBe(422)
    expectLimited(await c.post('/api/games/jutawan/start', {}))
    expect((await c.get('/api/games/roda-nasib')).status).toBe(200)
    expect((await c.get('/api/games/jutawan')).status).toBe(200)
    expectLimited(await c.get('/api/games/pertandingan'))
  })
})
