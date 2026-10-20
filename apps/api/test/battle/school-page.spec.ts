import { BattleSchoolDetailSchema, ErrorBodySchema } from '@pp/contract'
import { z } from 'zod'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { LoggedIn } from '../auth/helpers'
import { addBattle, bootStandings, expectNotFound, getAs, S, schoolIdOf, userIdOf, type StandingsApp } from './standings-helpers'

const NOW = '2026-10-21T10:00:00+08:00'
const Envelope = z.object({ data: BattleSchoolDetailSchema })

describe('school battle page (M16-20)', () => {
  let t: StandingsApp
  let me: LoggedIn
  let d1: string
  let d3: string

  beforeAll(async () => {
    t = await bootStandings(NOW)
    me = await t.login(S.ADMIN) // full names and ids (the masking is covered in privacy.spec.ts)
    d1 = await schoolIdOf(t.db, 'DEMO001')
    d3 = await schoolIdOf(t.db, 'DEMO003')
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await t.db.query('delete from battles')
  })

  const page = async (id: string) => {
    const res = await getAs(me, `/battle/schools/${id}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.headers['cache-control']).toMatch(/no-store/)
    return Envelope.parse(res.body).data
  }

  it('unknown or malformed school id: 404 NOT_FOUND "Sekolah tidak dijumpai."', async () => {
    for (const id of ['999999', '0', 'abc', '-1', '1.5', '99999999999999999999', '%20']) {
      expectNotFound(await getAs(me, `/battle/schools/${id}`), 'Sekolah tidak dijumpai.')
    }
    expect(ErrorBodySchema.safeParse((await getAs(me, '/battle/schools/999999')).body).success).toBe(true)
  })

  it('a school without battles: zeros, week and month null, no fighters, no recent; school block from the owner', async () => {
    const data = await page(d1)
    expect(data).toEqual({
      school: { id: d1, name: 'SMK Demo Satu', ppd: expect.any(String), state: 'Selangor', type: 'SMK' },
      allTime: { battles: 0, menang: 0, ketepatan: 0, pelajar: 0 },
      week: null,
      month: null,
      fighters: [],
      recent: [],
    })
    expect(data.school.ppd).toBeTruthy()
  })

  it('all-time, week and month boxes use the school stored on the participant row, with the national rank', async () => {
    const at = '2026-10-20T10:00:00+08:00'
    await addBattle(t.db, { a: S.D1(1), b: S.D1(2), scoreA: 7000, scoreB: 3000, at, correctA: 7, correctB: 3 })
    await addBattle(t.db, { a: S.D1(1), b: S.D1(2), scoreA: 2000, scoreB: 2000, at: '2026-10-05T10:00:00+08:00', correctA: 2, correctB: 2 }) // month only
    await addBattle(t.db, { a: S.D1(1), b: S.D3(1), scoreA: 1000, scoreB: 4000, at: '2026-03-05T10:00:00+08:00', schoolB: 'DEMO003', correctA: 1, correctB: 4 }) // all time only
    await addBattle(t.db, { a: S.D3(1), b: S.D3(2), scoreA: 9000, scoreB: 0, at }) // a stronger school this week
    const data = await page(d1)
    expect(data.allTime).toEqual({ battles: 5, menang: 1, ketepatan: Math.round((7 + 3 + 2 + 2 + 1) / 50 * 100), pelajar: 2 })
    expect(data.week).toEqual({ rank: 1, battles: 2, menang: 1, seri: 0, kalah: 1, skor: 100 })
    expect(data.month).toEqual({ rank: 1, battles: 4, menang: 1, seri: 2, kalah: 1, skor: 70 + 30 + 20 + 20 })
    const other = await page(d3)
    expect(other.week).toMatchObject({ rank: 2, skor: 90 })
  })

  it('fighters: top 5 weekly students whose CURRENT school is this one, in standing order, name and skor only', async () => {
    const at = '2026-10-20T10:00:00+08:00'
    // Six DEMO001 students with skor 60, 50, 40, 30, 20, 10 (each wins against a DEMO002 student, stored school DEMO001).
    for (let i = 1; i <= 6; i++) {
      await addBattle(t.db, { a: S.D1(i), b: S.D2(1), scoreA: (7 - i) * 1000, scoreB: 0, at, schoolB: 'DEMO002' })
    }
    // A DEMO002 student who fought for DEMO001 (stored) but now belongs to DEMO002 is not a fighter of DEMO001.
    await addBattle(t.db, { a: S.D2(2), b: S.D2(3), scoreA: 9000, scoreB: 0, at, schoolA: 'DEMO001', schoolB: 'DEMO001' })
    // An old battle does not count for the weekly list.
    await addBattle(t.db, { a: S.D1(6), b: S.D2(1), scoreA: 9900, scoreB: 0, at: '2026-10-01T10:00:00+08:00' })
    const data = await page(d1)
    expect(data.fighters.map((f) => f.skor)).toEqual([60, 50, 40, 30, 20])
    expect(data.fighters.every((f) => Object.keys(f).sort().join() === 'name,skor,userId')).toBe(true)
    expect(data.fighters[0]!.userId).toBe(await userIdOf(t.db, S.D1(1)))
    const names = await t.db.query<{ name: string }>(`select name from users where id = $1`, [data.fighters[0]!.userId])
    expect(data.fighters[0]!.name).toBe(names[0]!.name)
  })

  it('recent: the 10 latest FINISHED battles with the school on either side (forfeits, active and is_test left out)', async () => {
    const ids: string[] = []
    for (let i = 0; i < 12; i++) {
      ids.push(await addBattle(t.db, { a: S.D1(1), b: S.D1(2), scoreA: 5000, scoreB: 100, at: `2026-10-${String(1 + i).padStart(2, '0')}T21:00:00+08:00` }))
    }
    await addBattle(t.db, { a: S.D1(1), b: S.D1(2), scoreA: 5000, scoreB: 100, at: '2026-10-20T21:00:00+08:00', status: 'forfeited' })
    await addBattle(t.db, { a: S.D1(1), b: S.D1(2), scoreA: 5000, scoreB: 100, at: '2026-10-20T22:00:00+08:00', status: 'active' })
    await addBattle(t.db, { a: S.D1(1), b: S.D1(2), scoreA: 5000, scoreB: 100, at: '2026-10-20T23:00:00+08:00', isTest: true })
    const opponentSide = await addBattle(t.db, { a: S.D2(1), b: S.D1(3), scoreA: 5000, scoreB: 100, at: '2026-10-19T21:00:00+08:00', schoolA: 'DEMO002', schoolB: 'DEMO001' })
    const data = await page(d1)
    expect(data.recent).toHaveLength(10)
    // Newest first by created_at: 12th..4th of October plus the 19th.
    expect(data.recent[0]!.uuid).toBe(opponentSide)
    expect(data.recent.slice(1).map((r) => r.uuid)).toEqual([...ids].reverse().slice(0, 9))
  })

  it('bot sides: not fighters, no school credit; recent keeps a battle only through a non-bot side of the school', async () => {
    const at = '2026-10-20T10:00:00+08:00'
    // DEMO001 pupil D1(1) is the bot side against a DEMO002 human: DEMO001 gets nothing, the battle is not in its recent list.
    await addBattle(t.db, { a: S.D2(1), b: S.D1(1), scoreA: 3000, scoreB: 9000, at, schoolA: 'DEMO002', schoolB: 'DEMO001', botB: true })
    // A DEMO001 human against a DEMO002 bot: counted and shown for DEMO001.
    const shown = await addBattle(t.db, { a: S.D1(2), b: S.D2(2), scoreA: 5000, scoreB: 100, at: '2026-10-19T10:00:00+08:00', schoolA: 'DEMO001', schoolB: 'DEMO002', botB: true })
    const d1page = await page(d1)
    expect(d1page.fighters.map((f) => f.userId)).toEqual([await userIdOf(t.db, S.D1(2))])
    expect(d1page.allTime).toMatchObject({ battles: 1, menang: 1, pelajar: 1 })
    expect(d1page.recent.map((r) => r.uuid)).toEqual([shown])
    const d2page = await page(await schoolIdOf(t.db, 'DEMO002'))
    expect(d2page.allTime).toMatchObject({ battles: 1, menang: 0, pelajar: 1 }) // only the human D2(1)
    expect(d2page.fighters.map((f) => f.userId)).toEqual([await userIdOf(t.db, S.D2(1))])
    expect(d2page.recent).toHaveLength(1) // the battle through its human side only
  })

  it('recent rows: homeHere is true when player A currently belongs to this school', async () => {
    await addBattle(t.db, { a: S.D1(1), b: S.D2(1), scoreA: 5000, scoreB: 100, at: '2026-10-20T21:00:00+08:00', schoolA: 'DEMO001', schoolB: 'DEMO002' })
    await addBattle(t.db, { a: S.D2(2), b: S.D1(2), scoreA: 5000, scoreB: 100, at: '2026-10-19T21:00:00+08:00', schoolA: 'DEMO002', schoolB: 'DEMO001' })
    const data = await page(d1)
    expect(data.recent.map((r) => r.playerA.homeHere)).toEqual([true, false])
    const raw = await getAs(me, `/battle/schools/${d1}`)
    const first = (raw.body as { data: { recent: Record<string, unknown>[] } }).data.recent[0]!
    expect(Object.keys(first.playerB as object).sort()).toEqual(['id', 'name'])
  })
})
