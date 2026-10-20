import { GAMES_MESSAGES, GamesRawMessageSchema, GamesSpinPageSchema, GamesSpinRefusedSchema, GamesSpinResponseSchema } from '@pp/contract'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { prngStream } from '../../../src/db/prng'
import { drawSegment, SPIN_SEGMENTS } from '../../../src/modules/games/solo/spin/spin.rules'
import { ACCOUNTS, bootGamesApp, expectCsrfInvalid, expectError, FakeRewards, loginAs, parseData, START, type GamesTestApp } from '../helpers'

const M = GAMES_MESSAGES
const rewards = new FakeRewards()

describe('Roda Nasib (M16-34, M16-35)', () => {
  let t: GamesTestApp
  beforeAll(async () => {
    t = await bootGamesApp({ ports: { rewards } })
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(() => {
    rewards.calls.length = 0
    rewards.canEarn = true
    t.clock.set(START)
  })

  const spinsOf = (userId: string) => t.db.query<{ spin_date: string; segment_index: number; credited: number; is_test: boolean }>(`select spin_date::text, segment_index, credited, is_test from spins where user_id = $1::bigint order by spin_date`, [userId])

  it('401 without a session, CSRF_INVALID on the spin', async () => {
    expectError(await t.http().get('/api/games/roda-nasib'), 'UNAUTHORIZED', M.unauthenticated)
    expectError(await t.http().post('/api/games/roda-nasib/spin'), 'UNAUTHORIZED', M.unauthenticated)
    const c = await loginAs(t, ACCOUNTS.student)
    expectCsrfInvalid(await c.noCsrf.post('/api/games/roda-nasib/spin'))
  })

  it('page: the 8 fixed segments, counters, today state, canEarnSyiling', async () => {
    const c = await loginAs(t, ACCOUNTS.student)
    const page = parseData(await c.get('/api/games/roda-nasib'), GamesSpinPageSchema)
    expect(page.segments.map((s) => s.label)).toEqual(['1 Syiling', '3 Syiling', '5 Syiling', '10 Syiling', '20 Syiling', 'Cuba Lagi', '2 Syiling', '7 Syiling'])
    expect(page.segments.map((s) => s.weight)).toEqual([25, 20, 15, 8, 3, 15, 10, 4])
    expect(page).toMatchObject({ spins: 0, won: 0, alreadySpun: false, canEarnSyiling: true })
    rewards.canEarn = false
    expect(parseData(await c.get('/api/games/roda-nasib'), GamesSpinPageSchema).canEarnSyiling).toBe(false)
  })

  it('a spin draws the segment server side from the named stream, credits through the port once, and a second spin that day is 409 raw', async () => {
    const c = await loginAs(t, ACCOUNTS.student)
    const index = drawSegment(prngStream(`games:spin:${c.userId}:2026-10-19`))
    const seg = SPIN_SEGMENTS[index] as (typeof SPIN_SEGMENTS)[number]
    const res = await c.post('/api/games/roda-nasib/spin')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const body = GamesSpinResponseSchema.parse(res.body)
    expect(body).toEqual({
      success: true,
      message: '',
      result: { segment_index: index, label: seg.label, icon: seg.icon, type: seg.type, value: seg.value },
      coinsCredited: seg.value,
    })
    expect(rewards.calls).toHaveLength(1)
    expect(rewards.calls[0]).toMatchObject({ userId: c.userId, isTest: false, input: { game: 'roda_nasib', event: 'spin', coins: seg.value, xp: 0, key: 'spin:2026-10-19' } })
    expect(await spinsOf(c.userId)).toEqual([{ spin_date: '2026-10-19', segment_index: index, credited: seg.value, is_test: false }])

    const again = await c.post('/api/games/roda-nasib/spin')
    expect(again.status).toBe(409)
    expect(GamesSpinRefusedSchema.parse(again.body)).toEqual({ success: false, message: M.spinAlreadySpun })
    expect(rewards.calls).toHaveLength(1)

    const page = parseData(await c.get('/api/games/roda-nasib'), GamesSpinPageSchema)
    expect(page).toMatchObject({ spins: 1, won: seg.value, alreadySpun: true })
  })

  it('two concurrent spins of one user: exactly one succeeds and one reward report', async () => {
    const c = await loginAs(t, ACCOUNTS.studentMaju)
    const out = await Promise.all([c.post('/api/games/roda-nasib/spin'), c.post('/api/games/roda-nasib/spin'), c.post('/api/games/roda-nasib/spin')])
    expect(out.map((r) => r.status).sort()).toEqual([200, 409, 409])
    for (const r of out) (r.status === 200 ? GamesSpinResponseSchema : GamesSpinRefusedSchema).parse(r.body)
    expect(await spinsOf(c.userId)).toHaveLength(1)
    expect(rewards.calls).toHaveLength(1)
    const [stats] = await t.db.query<{ spins: number }>(`select spins from spin_stats where user_id = $1::bigint`, [c.userId])
    expect(stats?.spins).toBe(1)
  })

  it('the Malaysia day decides: 00:30 MYT and 08:00 MYT are one day, 23:59 and 00:00 MYT are two (UTC dates differ from MYT dates)', async () => {
    // 2026-10-19 00:30 +08:00 = 2026-10-18 16:30 UTC: the UTC date is the day before
    t.clock.set('2026-10-19T00:30:00+08:00')
    let c = await loginAs(t, ACCOUNTS.student2)
    expect((await c.post('/api/games/roda-nasib/spin')).status).toBe(200)
    t.clock.set('2026-10-19T08:00:00+08:00')
    c = await loginAs(t, ACCOUNTS.student2)
    expect((await c.post('/api/games/roda-nasib/spin')).status).toBe(409)
    expect(parseData(await c.get('/api/games/roda-nasib'), GamesSpinPageSchema).alreadySpun).toBe(true)
    t.clock.set('2026-10-19T23:59:00+08:00')
    c = await loginAs(t, ACCOUNTS.student2)
    expect((await c.post('/api/games/roda-nasib/spin')).status).toBe(409)
    // 2026-10-20 00:00:30 +08:00 = 2026-10-19 16:00:30 UTC: still the previous UTC date, a new Malaysia day
    t.clock.set('2026-10-20T00:00:30+08:00')
    c = await loginAs(t, ACCOUNTS.student2)
    expect(parseData(await c.get('/api/games/roda-nasib'), GamesSpinPageSchema).alreadySpun).toBe(false)
    const next = await c.post('/api/games/roda-nasib/spin')
    expect(next.status).toBe(200)
    expect(rewards.calls.map((x) => x.input.key)).toEqual(['spin:2026-10-19', 'spin:2026-10-20'])
    expect((await spinsOf(c.userId)).map((s) => s.spin_date)).toEqual(['2026-10-19', '2026-10-20'])
    expect(GamesSpinResponseSchema.parse(next.body).result.segment_index).toBe(drawSegment(prngStream(`games:spin:${c.userId}:2026-10-20`)))
  })

  it('nothing is credited when syiling cannot be earned, but the spin is recorded', async () => {
    rewards.canEarn = false
    const c = await loginAs(t, ACCOUNTS.teacher)
    const res = await c.post('/api/games/roda-nasib/spin')
    expect(GamesSpinResponseSchema.parse(res.body).coinsCredited).toBe(0)
    expect(rewards.calls).toHaveLength(0)
    expect(await spinsOf(c.userId)).toHaveLength(1)
  })

  it('Mod Pelajar: the row is stamped is_test, no reward call, coinsCredited 0, page reports canEarnSyiling false', async () => {
    const admin = await loginAs(t, ACCOUNTS.admin, { mod: true })
    const res = await admin.post('/api/games/roda-nasib/spin')
    expect(GamesSpinResponseSchema.parse(res.body).coinsCredited).toBe(0)
    expect(rewards.calls).toHaveLength(0)
    expect((await spinsOf(admin.userId))[0]).toMatchObject({ is_test: true, credited: 0 })
    expect(parseData(await admin.get('/api/games/roda-nasib'), GamesSpinPageSchema).canEarnSyiling).toBe(false)
    const [stats] = await t.db.query<{ is_test: boolean }>(`select is_test from spin_stats where user_id = $1::bigint`, [admin.userId])
    expect(stats?.is_test).toBe(true)
  })

  it('the raw refusal body is not the standard envelope', async () => {
    const c = await loginAs(t, ACCOUNTS.schoolAdmin)
    await c.post('/api/games/roda-nasib/spin')
    const again = await c.post('/api/games/roda-nasib/spin')
    expect(again.body.error).toBeUndefined()
    expect(() => GamesRawMessageSchema.parse(again.body)).toThrow() // has "success" too: not the {message}-only solo body
    expect(Object.keys(again.body).sort()).toEqual(['message', 'success'])
  })
})
