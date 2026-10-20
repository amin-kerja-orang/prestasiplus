import { BattleListRowSchema } from '@pp/contract'
import { z } from 'zod'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { LoggedIn } from '../auth/helpers'
import { addBattle, bootStandings, getAs, S, userIdOf, type StandingsApp } from './standings-helpers'

const NOW = '2026-10-21T10:00:00+08:00'
const Envelope = z.object({ data: z.array(BattleListRowSchema) })

describe('own battle history (M16-21)', () => {
  let t: StandingsApp
  let me: LoggedIn

  beforeAll(async () => {
    t = await bootStandings(NOW)
    me = await t.login(S.PELAJAR)
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await t.db.query('delete from battles')
  })

  const history = async (who: LoggedIn = me) => {
    const res = await getAs(who, '/battle/history')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.headers['cache-control']).toMatch(/no-store/)
    return Envelope.parse(res.body).data
  }

  it('is empty for a caller who never fought (the staff accounts too)', async () => {
    expect(await history()).toEqual([])
    expect(await history(await t.login(S.ADMIN))).toEqual([])
  })

  it('lists only the caller finished and forfeited battles, newest first, unpaged', async () => {
    const ids: string[] = []
    for (let i = 0; i < 12; i++) {
      ids.push(await addBattle(t.db, { a: S.PELAJAR, b: S.D1(1), scoreA: 5000 + i, scoreB: 100, at: `2026-10-${String(1 + i).padStart(2, '0')}T10:00:00+08:00` }))
    }
    const forfeited = await addBattle(t.db, { a: S.D1(2), b: S.PELAJAR, scoreA: 6000, scoreB: 100, at: '2026-10-20T10:00:00+08:00', status: 'forfeited' })
    await addBattle(t.db, { a: S.PELAJAR, b: S.D1(1), scoreA: 1, scoreB: 1, at: '2026-10-20T11:00:00+08:00', status: 'active' })
    await addBattle(t.db, { a: S.PELAJAR, b: S.D1(1), scoreA: 0, scoreB: 0, at: '2026-10-20T12:00:00+08:00', status: 'abandoned' })
    await addBattle(t.db, { a: S.PELAJAR, b: S.D1(1), scoreA: 9000, scoreB: 0, at: '2026-10-20T13:00:00+08:00', isTest: true })
    await addBattle(t.db, { a: S.D1(3), b: S.D1(4), scoreA: 9000, scoreB: 0, at: '2026-10-20T14:00:00+08:00' }) // someone else's
    const rows = await history()
    expect(rows).toHaveLength(13)
    expect(rows[0]!.uuid).toBe(forfeited)
    expect(rows.slice(1).map((r) => r.uuid)).toEqual([...ids].reverse())
    const times = rows.map((r) => Date.parse(r.createdAt))
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })

  it('row shape: A is the first side, B the second, winner A|B|null, createdAt in +08:00, homeHere false, names only', async () => {
    const me1 = await userIdOf(t.db, S.PELAJAR)
    const other = await userIdOf(t.db, S.D2(1))
    await addBattle(t.db, { a: S.D2(1), b: S.PELAJAR, scoreA: 3000, scoreB: 3000, at: '2026-10-20T10:00:00+08:00' })
    await addBattle(t.db, { a: S.PELAJAR, b: S.D2(1), scoreA: 0, scoreB: 0, at: '2026-10-19T10:00:00+08:00' }) // 0-0 goes to B
    const res = await getAs(me, '/battle/history')
    const rows = Envelope.parse(res.body).data
    expect(rows[0]).toMatchObject({ playerA: { id: other, homeHere: false }, playerB: { id: me1 }, scoreA: 3000, scoreB: 3000, winner: null })
    expect(rows[0]!.createdAt).toBe('2026-10-20T10:00:00.000+08:00')
    expect(rows[1]).toMatchObject({ playerA: { id: me1, homeHere: false }, playerB: { id: other }, winner: 'B' })
    const raw = (res.body as { data: Record<string, unknown>[] }).data[0]!
    expect(Object.keys(raw).sort()).toEqual(['createdAt', 'playerA', 'playerB', 'scoreA', 'scoreB', 'uuid', 'winner'])
    expect(Object.keys(raw.playerA as object).sort()).toEqual(['homeHere', 'id', 'name'])
    expect(Object.keys(raw.playerB as object).sort()).toEqual(['id', 'name'])
    const names = await t.db.query<{ name: string }>(`select name from users where id in ($1, $2)`, [me1, other])
    expect(new Set(names.map((n) => n.name))).toEqual(new Set([rows[0]!.playerA.name, rows[0]!.playerB.name]))
  })

  it('a pupil who was only the bot side never sees that battle; the human side does', async () => {
    const id = await addBattle(t.db, { a: S.D1(1), b: S.PELAJAR, scoreA: 3000, scoreB: 9000, at: '2026-10-20T10:00:00+08:00', botB: true })
    expect(await history()).toEqual([])
    expect((await history(await t.login(S.D1(1)))).map((r) => r.uuid)).toEqual([id])
  })

  it('both sides see the same battle in their own history', async () => {
    const id = await addBattle(t.db, { a: S.PELAJAR, b: S.D1(1), scoreA: 7000, scoreB: 3000, at: '2026-10-20T10:00:00+08:00' })
    const other = await t.login(S.D1(1))
    expect((await history(other)).map((r) => r.uuid)).toEqual([id])
    expect((await history()).map((r) => r.uuid)).toEqual([id])
  })
})
