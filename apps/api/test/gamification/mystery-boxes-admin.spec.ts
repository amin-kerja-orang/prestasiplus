import { GamificationMysteryBoxesAdminSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { mytDay } from '../../src/db/clock'
import { ADMIN, STUDENT, TEACHER, bootGamificationApp, dataOf, fail, signIn, userIdOf, type Client, type GamificationTestApp } from './helpers'

/**
 * S7-T07 part P7, DM-37, API-GAME-09 (boxes): the Kotak Misteri admin routes. FR-GM-23.1 (one box, seven rows),
 * AC-GM-23.5 (weights must total 100), AC-GM-23.6 (stock on prize rows), AC-ADM-P2-11.1 and 11.2 (backend half: boxes,
 * daily limit, openings per day). The pupil flow is unchanged and is not tested here.
 */
const SUMMARY = 'Sila lengkapkan semua medan wajib.'
const ODDS = 'Jumlah peluang mesti 100%.'
const PATH = '/admin/reward-control/mystery-boxes'

const SEVEN = [
  { label: '10 syiling', kind: 'syiling', amount: 10, weight: 40, stock: null },
  { label: '25 syiling', kind: 'syiling', amount: 25, weight: 25, stock: null },
  { label: '60 syiling', kind: 'syiling', amount: 60, weight: 15, stock: null },
  { label: '1 token', kind: 'token', amount: 1, weight: 10, stock: null },
  { label: '150 syiling', kind: 'syiling', amount: 150, weight: 6, stock: null },
  { label: '3 token', kind: 'token', amount: 3, weight: 3, stock: null },
  { label: '500 syiling — jackpot!', kind: 'syiling', amount: 500, weight: 1, stock: null },
]
const body = (over: Record<string, unknown> = {}) => ({ label: 'Kotak Misteri', costSyiling: 50, isActive: true, prizes: SEVEN, ...over })

describe('Kotak Misteri admin (S7-T07 P7, DM-37, API-GAME-09)', () => {
  let t: GamificationTestApp
  let admin: Client
  let student: Client
  let teacher: Client
  let adminId: string

  const view = async () => GamificationMysteryBoxesAdminSchema.parse(dataOf(await admin.get(PATH)))
  const auditCount = async () => Number((await t.db.query<{ n: string }>(`select count(*)::text n from audit_events where action = 'shop.mystery_box.updated'`))[0]!.n)
  const dailyMaxRow = async () => Number((await t.db.query<{ v: string }>(`select value::text v from gamification_settings where key = 'mystery_box_daily_max'`))[0]!.v)

  beforeAll(async () => {
    t = await bootGamificationApp({ env: { THROTTLE_ADMIN_WRITE_PER_MINUTE: '1000' } })
    admin = await signIn(t, ADMIN)
    student = await signIn(t, STUDENT)
    teacher = await signIn(t, TEACHER)
    adminId = await userIdOf(t.db, ADMIN)
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  describe('guards', () => {
    it('anonymous is 401, a pupil or teacher is 403, a write without CSRF is 403 CSRF_INVALID', async () => {
      fail(await t.http().get(`/api${PATH}`), 401, 'UNAUTHORIZED')
      fail(await t.http().put(`/api${PATH}/5`).send(body()), 401, 'UNAUTHORIZED')
      for (const who of [student, teacher]) {
        fail(await who.get(PATH), 403, 'FORBIDDEN')
        fail(await who.put(`${PATH}/5`, body()), 403, 'FORBIDDEN')
      }
      fail(await admin.noCsrfPut(`${PATH}/5`, body()), 403, 'CSRF_INVALID')
    })

    it('there is no POST: a box is never created through the API (ruling R1)', async () => {
      const res = await admin.post(PATH, body())
      expect(res.status).toBe(404)
    })
  })

  describe('GET', () => {
    it('answers the five seeded boxes: ids 1 to 4 inactive without prizes, id 5 active with the seven rows of 48 GAME-23 (FR-GM-23.1)', async () => {
      const v = await view()
      expect(v.boxes.map((b) => [b.id, b.isActive, b.prizes.length])).toEqual([['1', false, 0], ['2', false, 0], ['3', false, 0], ['4', false, 0], ['5', true, 7]])
      const active = v.boxes[4]!
      expect(active).toMatchObject({ label: 'Kotak Misteri', costSyiling: 50 })
      expect(active.prizes).toEqual(SEVEN)
      expect(active.prizes.reduce((n, p) => n + p.weight, 0)).toBe(100)
    })

    it('carries dailyMax (5 by default) and openingsPerDay: seven MYT days, oldest first, zeros without openings (ruling N3)', async () => {
      const v = await view()
      expect(v.dailyMax).toBe(5)
      expect(v.openingsPerDay).toHaveLength(7)
      expect(v.openingsPerDay.every((d) => d.count === 0)).toBe(true)
      const days = v.openingsPerDay.map((d) => d.day)
      expect([...days].sort()).toEqual(days)
      expect(days.at(-1)).toBe(mytDay(t.clock.now()))
    })

    it('counts the openings of each Malaysia day, all boxes; an opening older than seven days is left out', async () => {
      const u = await userIdOf(t.db, STUDENT)
      const today = (await view()).openingsPerDay.at(-1)!.day
      const at = (d: string, hh: string) => `${d}T${hh}+08:00`
      const prev = (await view()).openingsPerDay.at(-2)!.day
      const old = (await view()).openingsPerDay[0]!.day
      await t.db.query(`delete from mystery_box_openings`)
      for (const [box, when] of [[5, at(today, '00:00:30')], [5, at(today, '23:59:00')], [2, at(prev, '23:59:59')], [1, at(old, '00:00:00')], [5, '2000-01-01T12:00:00+08:00']] as const) {
        await t.db.query(`insert into mystery_box_openings (user_id, box_id, coins, xp, created_at) values ($1, $2, 10, 0, $3)`, [u, box, when])
      }
      const v = await view()
      expect(v.openingsPerDay.find((d) => d.day === today)!.count).toBe(2)
      expect(v.openingsPerDay.find((d) => d.day === prev)!.count).toBe(1)
      expect(v.openingsPerDay[0]).toEqual({ day: old, count: 1 })
      expect(v.openingsPerDay.reduce((n, d) => n + d.count, 0)).toBe(4)
      await t.db.query(`delete from mystery_box_openings`)
    })
  })

  describe('PUT', () => {
    it('saves label, cost, active flag and prize rows, replaces the old rows, saves dailyMax and writes one audit row; answers the list', async () => {
      const before = await auditCount()
      const prizes = [
        { label: '20 syiling', kind: 'syiling', amount: 20, weight: 70, stock: 100 },
        { label: '2 token', kind: 'token', amount: 2, weight: 30 },
      ]
      const res = await admin.put(`${PATH}/5`, body({ label: 'Kotak Bijak', costSyiling: 80, prizes, dailyMax: 7 }))
      expect(res.status).toBe(200)
      const v = GamificationMysteryBoxesAdminSchema.parse(dataOf(res))
      expect(v.boxes[4]).toMatchObject({ id: '5', label: 'Kotak Bijak', costSyiling: 80, isActive: true })
      expect(v.boxes[4]!.prizes).toEqual([
        { label: '20 syiling', kind: 'syiling', amount: 20, weight: 70, stock: 100 },
        { label: '2 token', kind: 'token', amount: 2, weight: 30, stock: null },
      ])
      expect(v.dailyMax).toBe(7)
      expect(await dailyMaxRow()).toBe(7)
      expect(await auditCount()).toBe(before + 1)
      const row = (await t.db.query<{ actor_user_id: string; target_type: string; target_id: string }>(`select actor_user_id::text, target_type, target_id from audit_events where action = 'shop.mystery_box.updated' order by id desc limit 1`))[0]!
      expect(row).toMatchObject({ actor_user_id: adminId, target_type: 'mystery_box', target_id: '5' })
      // The other boxes are untouched, and the stored rows are exactly the two posted.
      expect((await view()).boxes.slice(0, 4).every((b) => !b.isActive && b.prizes.length === 0)).toBe(true)
      expect(await t.db.query(`select 1 from mystery_box_prizes where box_id = 5`)).toHaveLength(2)
    })

    it('a stock of 0 is kept on the row (AC-GM-23.6 data half); restoring the seven rows answers them again', async () => {
      const out = [{ label: '10 syiling', kind: 'syiling', amount: 10, weight: 60, stock: 0 }, { label: '1 token', kind: 'token', amount: 1, weight: 40, stock: null }]
      const saved = GamificationMysteryBoxesAdminSchema.parse(dataOf(await admin.put(`${PATH}/5`, body({ prizes: out }))))
      expect(saved.boxes[4]!.prizes[0]!.stock).toBe(0)
      const back = GamificationMysteryBoxesAdminSchema.parse(dataOf(await admin.put(`${PATH}/5`, body({ dailyMax: 5 }))))
      expect(back.boxes[4]).toMatchObject({ label: 'Kotak Misteri', costSyiling: 50 })
      expect(back.boxes[4]!.prizes).toEqual(SEVEN)
      expect(back.dailyMax).toBe(5)
    })

    it('422 "Jumlah peluang mesti 100%." when the weights of an active box do not total 100 (AC-GM-23.5: 50 / 40 / 20); nothing is saved', async () => {
      const prizes = [50, 40, 20].map((weight, i) => ({ label: `P${String(i)}`, kind: 'syiling', amount: 10, weight }))
      const err = fail(await admin.put(`${PATH}/5`, body({ costSyiling: 99, prizes })), 422, 'VALIDATION_ERROR', ODDS)
      expect(err.fields).toEqual({ prizes: ODDS })
      const v = await view()
      expect(v.boxes[4]!.costSyiling).toBe(50)
      expect(v.boxes[4]!.prizes).toEqual(SEVEN)
    })

    it('422 for an active box with no prize; an inactive box with no prizes saves (the old four)', async () => {
      fail(await admin.put(`${PATH}/5`, body({ prizes: [] })), 422, 'VALIDATION_ERROR', ODDS)
      const res = await admin.put(`${PATH}/3`, body({ label: 'Kotak Emas', isActive: false, prizes: [] }))
      expect(res.status).toBe(200)
      // An inactive box that has prizes still has to total 100.
      fail(await admin.put(`${PATH}/3`, body({ isActive: false, prizes: [SEVEN[0]] })), 422, 'VALIDATION_ERROR', ODDS)
      await t.db.query(`delete from mystery_box_prizes where box_id = 3`)
    })

    it('422 per field with the summary: blank label, cost out of 1..500, isActive not a boolean, bad prize rows, dailyMax out of 1..20', async () => {
      const bad = body({
        label: '   ',
        costSyiling: 501,
        isActive: 'yes',
        dailyMax: 21,
        prizes: [{ label: '', kind: 'xp', amount: 0, weight: 101, stock: -1 }, { kind: 'token' }, 'x'],
      })
      const err = fail(await admin.put(`${PATH}/5`, bad), 422, 'VALIDATION_ERROR', SUMMARY)
      expect(err.fields).toMatchObject({
        label: 'Medan ini diperlukan.',
        costSyiling: 'Medan ini tidak sah.',
        isActive: 'Medan ini tidak sah.',
        dailyMax: 'Medan ini tidak sah.',
        'prizes.0.label': 'Medan ini diperlukan.',
        'prizes.0.kind': 'Medan ini tidak sah.',
        'prizes.0.amount': 'Medan ini tidak sah.',
        'prizes.0.weight': 'Medan ini tidak sah.',
        'prizes.0.stock': 'Medan ini tidak sah.',
        'prizes.1.label': 'Medan ini diperlukan.',
        'prizes.1.amount': 'Medan ini diperlukan.',
        'prizes.1.weight': 'Medan ini diperlukan.',
        'prizes.2.kind': 'Medan ini diperlukan.',
      })
      const missing = fail(await admin.put(`${PATH}/5`, {}), 422, 'VALIDATION_ERROR', SUMMARY)
      expect(Object.keys(missing.fields!).sort()).toEqual(['costSyiling', 'isActive', 'label', 'prizes'])
      // No XP prize exists; fractional and numeric-string numbers are refused.
      expect(fail(await admin.put(`${PATH}/5`, body({ costSyiling: '50' })), 422, 'VALIDATION_ERROR').fields).toEqual({ costSyiling: 'Medan ini tidak sah.' })
      expect(fail(await admin.put(`${PATH}/5`, body({ costSyiling: 49.5 })), 422, 'VALIDATION_ERROR').fields).toEqual({ costSyiling: 'Medan ini tidak sah.' })
      expect(fail(await admin.put(`${PATH}/5`, body({ prizes: Array.from({ length: 21 }, () => SEVEN[0]) })), 422, 'VALIDATION_ERROR').fields).toEqual({ prizes: 'Medan ini tidak sah.' })
    })

    it('activating box 3 while 5 is active leaves only 3 active, with one audit row naming the deactivated box; 5 comes back the same way', async () => {
      const before = await auditCount()
      const res = await admin.put(`${PATH}/3`, body({ label: 'Kotak Emas', isActive: true }))
      expect(res.status).toBe(200)
      const v = GamificationMysteryBoxesAdminSchema.parse(dataOf(res))
      expect(v.boxes.filter((b) => b.isActive).map((b) => b.id)).toEqual(['3'])
      expect(await auditCount()).toBe(before + 1)
      const row = (await t.db.query<{ d: string }>(`select detail::text d from audit_events where action = 'shop.mystery_box.updated' order by id desc limit 1`))[0]!
      expect(JSON.parse(row.d)).toMatchObject({ deactivatedBoxIds: [5] })
      const back = GamificationMysteryBoxesAdminSchema.parse(dataOf(await admin.put(`${PATH}/5`, body())))
      expect(back.boxes.filter((b) => b.isActive).map((b) => b.id)).toEqual(['5'])
      await t.db.query(`delete from mystery_box_prizes where box_id = 3`)
    })

    it('two concurrent activations of different boxes end with exactly one active box and no error', async () => {
      const [a, b] = await Promise.all([admin.put(`${PATH}/3`, body({ label: 'Kotak Emas' })), admin.put(`${PATH}/4`, body({ label: 'Kotak Legenda' }))])
      expect([a.status, b.status]).toEqual([200, 200])
      const active = await t.db.query<{ id: number }>(`select id from mystery_boxes where is_active`)
      expect(active).toHaveLength(1)
      expect([3, 4]).toContain(active[0]!.id)
      await admin.put(`${PATH}/5`, body())
      await t.db.query(`delete from mystery_box_prizes where box_id in (3, 4)`)
      expect((await t.db.query(`select id from mystery_boxes where is_active`)).map((r) => (r as { id: number }).id)).toEqual([5])
    })

    it('an active box whose every prize has stock 0 is saved as is today (pins the behaviour; TODO-P8 answers an empty box at draw time)', async () => {
      const empty = SEVEN.map((p) => ({ ...p, stock: 0 }))
      const res = await admin.put(`${PATH}/5`, body({ prizes: empty }))
      expect(res.status).toBe(200)
      expect(GamificationMysteryBoxesAdminSchema.parse(dataOf(res)).boxes[4]!.prizes.every((p) => p.stock === 0)).toBe(true)
      await admin.put(`${PATH}/5`, body())
    })

    it('404 "Kotak tidak dijumpai." for an id that does not exist; a non-numeric id is the plain 404', async () => {
      fail(await admin.put(`${PATH}/999`, body()), 404, 'NOT_FOUND', 'Kotak tidak dijumpai.')
      expect((await admin.put(`${PATH}/abc`, body())).status).toBe(404)
    })

    it('a failed save writes no audit row and keeps the stored rows', async () => {
      const before = await auditCount()
      fail(await admin.put(`${PATH}/5`, body({ prizes: [{ ...SEVEN[0], weight: 99 }] })), 422, 'VALIDATION_ERROR')
      expect(await auditCount()).toBe(before)
      expect(await t.db.query(`select 1 from mystery_box_prizes where box_id = 5`)).toHaveLength(7)
    })
  })
})
