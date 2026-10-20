import { BattleSchoolStandingsResultSchema, BattleStudentStandingSchema, ErrorBodySchema } from '@pp/contract'
import { z } from 'zod'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { LoggedIn } from '../auth/helpers'
import { addBattle, bootStandings, getAs, S, schoolIdOf, userIdOf, type StandingsApp } from './standings-helpers'

// Wednesday 2026-10-21 10:00 MYT: the week runs from Monday 2026-10-19 00:00 MYT, the month from 2026-10-01 00:00 MYT.
const NOW = '2026-10-21T10:00:00+08:00'
const StudentsEnvelope = z.object({ data: z.array(BattleStudentStandingSchema) })
const SchoolsEnvelope = z.object({ data: BattleSchoolStandingsResultSchema })

describe('battle standings (M16-18, M16-19)', () => {
  let t: StandingsApp
  let me: LoggedIn

  beforeAll(async () => {
    t = await bootStandings(NOW)
    me = await t.login(S.PELAJAR)
  })
  afterAll(async () => {
    await t.close()
  })
  /** Moves the clock and signs in again (a session does not outlive the days the clock jumps). */
  const setNow = async (at: string): Promise<void> => {
    t.clock.set(at)
    me = await t.login(S.PELAJAR)
  }
  beforeEach(async () => {
    if (t.clock.now().getTime() !== new Date(NOW).getTime()) await setNow(NOW)
    await t.db.query('delete from battles')
  })

  const students = async (q = '') => {
    const res = await getAs(me, `/battle/standings/students${q}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.headers['cache-control']).toMatch(/no-store/)
    return StudentsEnvelope.parse(res.body).data
  }
  const schools = async (q = '') => {
    const res = await getAs(me, `/battle/standings/schools${q}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return SchoolsEnvelope.parse(res.body).data
  }

  it('answers 401 UNAUTHORIZED to an anonymous caller on all four routes', async () => {
    for (const path of ['/battle/standings/students', '/battle/standings/schools', '/battle/schools/1', '/battle/history']) {
      const res = await t.http().get(`/api${path}`)
      expect(res.status, path).toBe(401)
      const body = ErrorBodySchema.parse(res.body)
      expect(body.error.code).toBe('UNAUTHORIZED')
      expect(body.error.message).toBe('Unauthenticated.')
    }
  })

  it('is readable by every signed-in role', async () => {
    for (const who of [S.ADMIN, S.TEACHER]) {
      const l = await t.login(who)
      expect((await getAs(l, '/battle/standings/students')).status).toBe(200)
      expect((await getAs(l, '/battle/standings/schools')).status).toBe(200)
    }
  })

  describe('students', () => {
    it('empty list when nobody fought; rows carry exactly the contract fields (no internal school id)', async () => {
      expect(await students()).toEqual([])
      await addBattle(t.db, { a: S.D1(1), b: S.D1(2), scoreA: 7000, scoreB: 3000, at: '2026-10-20T10:00:00+08:00', correctA: 7, correctB: 3 })
      const res = await getAs(me, '/battle/standings/students')
      const row = (res.body as { data: Record<string, unknown>[] }).data[0]!
      expect(Object.keys(row).sort()).toEqual(['kalah', 'ketepatan', 'menang', 'name', 'rank', 'school', 'seri', 'skor', 'streak', 'userId'])
    })

    it('weekly window starts on Monday 00:00 MYT (Sunday 23:59:59 is out, Monday 00:00:00 is in)', async () => {
      await addBattle(t.db, { a: S.D1(1), b: S.D1(2), scoreA: 5000, scoreB: 1000, at: '2026-10-18T23:59:59+08:00' })
      expect(await students()).toEqual([])
      await addBattle(t.db, { a: S.D1(1), b: S.D1(2), scoreA: 7000, scoreB: 3000, at: '2026-10-19T00:00:00+08:00' })
      const rows = await students()
      expect(rows.map((r) => [r.rank, r.skor])).toEqual([[1, 70], [2, 30]])
      // The next Monday is out of this week.
      await addBattle(t.db, { a: S.D1(3), b: S.D1(4), scoreA: 9000, scoreB: 1000, at: '2026-10-26T00:00:00+08:00' })
      expect(await students()).toHaveLength(2)
    })

    it('the week follows the MYT clock: Sunday 23:59 MYT is still the old week, Monday 00:00 MYT starts the next', async () => {
      await addBattle(t.db, { a: S.D1(1), b: S.D1(2), scoreA: 7000, scoreB: 3000, at: '2026-10-20T10:00:00+08:00' })
      await setNow('2026-10-25T23:59:59+08:00')
      expect(await students()).toHaveLength(2)
      await setNow('2026-10-26T00:00:00+08:00')
      expect(await students()).toEqual([])
      // 2026-10-18T16:30Z is Monday 00:30 MYT: the week already started.
      await setNow('2026-10-18T16:30:00Z')
      expect(await students()).toHaveLength(2)
      await setNow('2026-10-18T15:59:59Z') // Sunday 23:59:59 MYT: week of 2026-10-12
      expect(await students()).toEqual([])
    })

    it('monthly is the calendar month in MYT: 2026-09-30 23:59:59 is out, 2026-10-01 00:00:00 is in', async () => {
      await addBattle(t.db, { a: S.D1(1), b: S.D1(2), scoreA: 5000, scoreB: 1000, at: '2026-09-30T23:59:59+08:00' })
      expect(await students('?period=monthly')).toEqual([])
      await addBattle(t.db, { a: S.D1(3), b: S.D1(4), scoreA: 6000, scoreB: 2000, at: '2026-10-01T00:00:00+08:00' })
      await addBattle(t.db, { a: S.D1(5), b: S.D1(6), scoreA: 6000, scoreB: 2000, at: '2026-11-01T00:00:00+08:00' })
      const rows = await students('?period=monthly')
      expect(rows).toHaveLength(2)
      expect(rows.map((r) => r.skor)).toEqual([60, 20])
      // 2026-09-30T16:00Z is 2026-10-01 00:00 MYT.
      await setNow('2026-09-30T15:59:59Z')
      expect(await students('?period=monthly')).toHaveLength(2) // September: the 09-30 battle plus nothing else
    })

    it('any period other than monthly is weekly (empty, junk, all_time, repeated key takes the first)', async () => {
      await addBattle(t.db, { a: S.D1(1), b: S.D1(2), scoreA: 7000, scoreB: 3000, at: '2026-10-02T10:00:00+08:00' }) // month only
      await addBattle(t.db, { a: S.D1(3), b: S.D1(4), scoreA: 7000, scoreB: 3000, at: '2026-10-20T10:00:00+08:00' }) // week
      for (const q of ['', '?period=weekly', '?period=', '?period=all_time', '?period=junk', '?period=MONTHLY', '?period[a]=monthly', '?period=weekly&period=monthly']) {
        expect((await students(q)).map((r) => r.skor), q).toEqual([70, 30])
      }
      expect(await students('?period=monthly')).toHaveLength(4)
      expect(await students('?period=monthly&period=weekly')).toHaveLength(4)
    })

    it('counts only finished and forfeited battles of real play (active, abandoned, is_test excluded)', async () => {
      const at = '2026-10-20T10:00:00+08:00'
      await addBattle(t.db, { a: S.D1(1), b: S.D1(2), scoreA: 7000, scoreB: 3000, at })
      await addBattle(t.db, { a: S.D1(1), b: S.D1(2), scoreA: 4000, scoreB: 1000, at, status: 'forfeited' })
      await addBattle(t.db, { a: S.D1(1), b: S.D1(2), scoreA: 9000, scoreB: 100, at, status: 'active' })
      await addBattle(t.db, { a: S.D1(1), b: S.D1(2), scoreA: 9000, scoreB: 100, at, status: 'abandoned' })
      await addBattle(t.db, { a: S.D1(1), b: S.D1(2), scoreA: 9000, scoreB: 100, at, isTest: true, partIsTest: true })
      await addBattle(t.db, { a: S.D1(3), b: S.D1(4), scoreA: 9000, scoreB: 100, at, isTest: true })
      const rows = await students()
      expect(rows.map((r) => [r.menang, r.kalah, r.skor])).toEqual([[2, 0, 110], [0, 2, 40]])
    })

    it('skor is the sum of round(score / 100) per side (84.5 rounds up)', async () => {
      const at = '2026-10-20T10:00:00+08:00'
      await addBattle(t.db, { a: S.D1(1), b: S.D1(2), scoreA: 8450, scoreB: 8449, at })
      await addBattle(t.db, { a: S.D1(1), b: S.D1(2), scoreA: 49, scoreB: 50, at: '2026-10-20T11:00:00+08:00' })
      const rows = await students()
      const byName = new Map(rows.map((r) => [r.userId, r]))
      expect(byName.get(await userIdOf(t.db, S.D1(1)))!.skor).toBe(85 + 0)
      expect(byName.get(await userIdOf(t.db, S.D1(2)))!.skor).toBe(84 + 1)
    })

    it('ketepatan = round(correct / answered * 100) over all counted battles; 0 without answers', async () => {
      await addBattle(t.db, { a: S.D1(1), b: S.D1(2), scoreA: 7000, scoreB: 3000, at: '2026-10-20T10:00:00+08:00', answered: 10, correctA: 7, correctB: 3 })
      await addBattle(t.db, { a: S.D1(1), b: S.D1(2), scoreA: 1000, scoreB: 500, at: '2026-10-20T11:00:00+08:00', status: 'forfeited', answered: 3, correctA: 1, correctB: 0 })
      await addBattle(t.db, { a: S.D1(3), b: S.D1(4), scoreA: 100, scoreB: 50, at: '2026-10-20T11:00:00+08:00', status: 'forfeited', answered: 0 })
      const rows = await students()
      const of = (email: string) => rows.find((r) => r.name !== '' && r.userId === byId.get(email))!
      const byId = new Map<string, string>()
      for (const e of [S.D1(1), S.D1(2), S.D1(3)]) byId.set(e, await userIdOf(t.db, e))
      expect(of(S.D1(1)).ketepatan).toBe(62) // 8 / 13
      expect(of(S.D1(2)).ketepatan).toBe(23) // 3 / 13
      expect(of(S.D1(3)).ketepatan).toBe(0)
    })

    it('streak = wins in a row from the newest battle; a draw or a loss ends it; forfeits count as battles', async () => {
      const u = S.D1(1)
      const v = S.D1(2)
      // oldest to newest for u: win, loss, win, draw, win, win(forfeit by v)
      const plan: [number, number, string?][] = [[5000, 100], [100, 5000], [6000, 100], [3000, 3000], [7000, 100], [7000, 100, 'forfeited']]
      for (const [i, [sa, sb, status]] of plan.entries()) {
        await addBattle(t.db, { a: u, b: v, scoreA: sa, scoreB: sb, at: `2026-10-20T1${i}:00:00+08:00`, ...(status ? { status } : {}) })
      }
      const rows = await students()
      const byUser = { u: await userIdOf(t.db, u) }
      const mine = rows.find((r) => r.userId === byUser.u)!
      expect(mine.streak).toBe(2)
      expect([mine.menang, mine.seri, mine.kalah]).toEqual([4, 1, 1])
      expect(rows.find((r) => r.userId !== byUser.u)!.streak).toBe(0)
    })

    it('a student who only ever won keeps a streak equal to the number of battles', async () => {
      for (let i = 0; i < 3; i++) await addBattle(t.db, { a: S.D1(1), b: S.D1(2), scoreA: 5000, scoreB: 100, at: `2026-10-20T1${i}:00:00+08:00` })
      expect((await students())[0]!.streak).toBe(3)
    })

    it('orders by skor desc, then menang desc, then user id asc', async () => {
      const at = '2026-10-20T10:00:00+08:00'
      // D1(1): skor 50+50 = 100 from 2 wins.  D1(2): skor 100 from 1 win (a single 10000 side) -> fewer wins.
      await addBattle(t.db, { a: S.D1(1), b: S.D1(3), scoreA: 5000, scoreB: 0, at })
      await addBattle(t.db, { a: S.D1(1), b: S.D1(3), scoreA: 5000, scoreB: 0, at })
      await addBattle(t.db, { a: S.D1(2), b: S.D1(4), scoreA: 10000, scoreB: 0, at })
      // D1(5) and D1(6) tie on skor 20 and menang 1: lower user id first.
      await addBattle(t.db, { a: S.D1(6), b: S.D1(4), scoreA: 2000, scoreB: 0, at })
      await addBattle(t.db, { a: S.D1(5), b: S.D1(4), scoreA: 2000, scoreB: 0, at })
      const rows = await students()
      const ids = new Map([[S.D1(1), 0], [S.D1(2), 0], [S.D1(5), 0], [S.D1(6), 0]].map(([e]) => [e as string, 0]))
      for (const e of ids.keys()) ids.set(e, Number(await userIdOf(t.db, e)))
      const top = rows.slice(0, 4).map((r) => Number(r.userId))
      expect(top).toEqual([ids.get(S.D1(1))!, ids.get(S.D1(2))!, ...[ids.get(S.D1(5))!, ids.get(S.D1(6))!].sort((a, b) => a - b)])
      expect(rows.map((r) => r.rank)).toEqual(rows.map((_, i) => i + 1))
    })

    it('shows the CURRENT school of the student, whatever school the participant row stored', async () => {
      await addBattle(t.db, { a: S.D1(1), b: S.D2(1), scoreA: 7000, scoreB: 3000, at: '2026-10-20T10:00:00+08:00', schoolA: 'DEMO004', schoolB: null })
      const rows = await students()
      const names = new Map((await t.db.query<{ id: string; s: string }>(`select u.id::text, sc.name s from users u join schools sc on sc.id = u.school_id`)).map((r) => [r.id, r.s]))
      for (const r of rows) expect(r.school).toBe(names.get(r.userId))
      expect(rows[0]!.school).toBe('SMK Demo Satu')
    })
  })

  describe('schools', () => {
    const intra = (school: 'D1' | 'D2' | 'D3' | 'D4', x: number, y: number, sa: number, sb: number, at: string, extra = {}) =>
      addBattle(t.db, { a: S[school](x), b: S[school](y), scoreA: sa, scoreB: sb, at, ...extra })

    it('period handling: absent = weekly, weekly/monthly/all_time known, anything else = all time with activePeriod null', async () => {
      await intra('D1', 1, 2, 7000, 3000, '2026-10-02T10:00:00+08:00') // month only
      await intra('D2', 1, 2, 6000, 2000, '2026-10-20T10:00:00+08:00') // week
      await intra('D3', 1, 2, 5000, 1000, '2026-01-10T10:00:00+08:00') // all time only
      const weekly = await schools()
      expect(weekly.activePeriod).toBe('weekly')
      expect(weekly.rows.map((r) => r.name)).toEqual(['SK Demo Dua'])
      expect((await schools('?period=weekly')).rows).toHaveLength(1)
      const monthly = await schools('?period=monthly')
      expect([monthly.activePeriod, monthly.rows.length]).toEqual(['monthly', 2])
      const all = await schools('?period=all_time')
      expect([all.activePeriod, all.rows.length]).toEqual(['all_time', 3])
      for (const q of ['?period=junk', '?period=', '?period=Weekly', '?period=year']) {
        const r = await schools(q)
        expect([r.activePeriod, r.rows.length], q).toEqual([null, 3])
      }
    })

    it('figures: sides per school, menang/seri/kalah, ketepatan, pelajar = distinct students, skor; order skor desc then school id', async () => {
      const at = '2026-10-20T10:00:00+08:00'
      await intra('D1', 1, 2, 7000, 3000, at, { correctA: 7, correctB: 3 })
      await intra('D1', 1, 3, 4000, 4000, '2026-10-20T11:00:00+08:00', { correctA: 4, correctB: 4 })
      // DEMO002 and DEMO003 tie on skor 50: the lower school id comes first.
      await intra('D3', 1, 2, 3000, 2000, at)
      await intra('D2', 1, 2, 3000, 2000, at)
      const data = await schools()
      const [first, ...rest] = data.rows
      expect(first).toMatchObject({ rank: 1, name: 'SMK Demo Satu', state: 'Selangor', type: 'SMK', battles: 4, menang: 1, seri: 2, kalah: 1, pelajar: 3, skor: 70 + 30 + 40 + 40 })
      expect(first!.ketepatan).toBe(Math.round(((7 + 3 + 4 + 4) / 40) * 100))
      expect(rest.map((r) => [r.rank, r.name])).toEqual([[2, 'SK Demo Dua'], [3, 'SK Demo Tiga']])
      expect(Number(rest[0]!.schoolId)).toBeLessThan(Number(rest[1]!.schoolId))
    })

    it('uses the school STORED on the participant row, not the current school; a side without a stored school is ignored', async () => {
      const at = '2026-10-20T10:00:00+08:00'
      // Both students currently belong to DEMO001; the battle was fought for DEMO004 (A) and with no school (B).
      await addBattle(t.db, { a: S.D1(1), b: S.D1(2), scoreA: 7000, scoreB: 3000, at, schoolA: 'DEMO004', schoolB: null })
      const data = await schools()
      expect(data.rows.map((r) => [r.name, r.battles, r.menang, r.pelajar])).toEqual([['SJK(C) Demo Empat', 1, 1, 1]])
    })

    it('excludes is_test, active and abandoned battles', async () => {
      const at = '2026-10-20T10:00:00+08:00'
      await intra('D1', 1, 2, 7000, 3000, at, { isTest: true })
      await intra('D1', 1, 2, 7000, 3000, at, { status: 'active' })
      await intra('D1', 1, 2, 7000, 3000, at, { status: 'abandoned' })
      expect((await schools('?period=all_time')).rows).toEqual([])
      await intra('D1', 1, 2, 7000, 3000, at, { status: 'forfeited' })
      expect((await schools('?period=all_time')).rows).toHaveLength(1)
    })

    it('state filter keeps the national rank, filters rows only; the podium is the national top 3', async () => {
      const at = '2026-10-20T10:00:00+08:00'
      await intra('D1', 1, 2, 9000, 0, at) // Selangor, skor 90
      await intra('D3', 1, 2, 8000, 0, at) // Johor, skor 80
      await intra('D2', 1, 2, 7000, 0, at) // Selangor, skor 70
      await intra('D4', 1, 2, 6000, 0, at) // Johor, skor 60
      const johor = await schools('?state=Johor')
      expect(johor.rows.map((r) => [r.rank, r.name])).toEqual([[2, 'SK Demo Tiga'], [4, 'SJK(C) Demo Empat']])
      expect(johor.podium.map((p) => [p.column, p.name, p.state, p.skor])).toEqual([
        [1, 'SMK Demo Satu', 'Selangor', 90],
        [2, 'SK Demo Tiga', 'Johor', 80],
        [3, 'SK Demo Dua', 'Selangor', 70],
      ])
      expect((await schools('?state=Sabah')).rows).toEqual([])
      expect((await schools('?state=Sabah')).podium).toHaveLength(3)
      expect((await schools('?state=')).rows).toHaveLength(4) // empty = no filter (as the mock)
      expect((await schools('?state=johor')).rows).toEqual([]) // exact match
      expect((await schools('?state=Johor&state=Selangor')).rows).toHaveLength(2)
    })

    it('the podium has fewer than 3 entries when fewer schools fought; empty with nobody', async () => {
      expect(await schools()).toEqual({ activePeriod: 'weekly', rows: [], podium: [] })
      await intra('D1', 1, 2, 9000, 0, '2026-10-20T10:00:00+08:00')
      expect((await schools()).podium).toHaveLength(1)
    })

    it('weekly and monthly use the MYT windows', async () => {
      await intra('D1', 1, 2, 7000, 3000, '2026-10-18T23:59:59+08:00')
      await intra('D2', 1, 2, 7000, 3000, '2026-10-19T00:00:00+08:00')
      await intra('D3', 1, 2, 7000, 3000, '2026-09-30T23:59:59+08:00')
      expect((await schools()).rows.map((r) => r.name)).toEqual(['SK Demo Dua'])
      expect((await schools('?period=monthly')).rows.map((r) => r.name).sort()).toEqual(['SK Demo Dua', 'SMK Demo Satu'])
      expect(await schoolIdOf(t.db, 'DEMO001')).toBeTruthy()
    })
  })
})
