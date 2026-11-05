import { ACCOUNT_MOOD_MESSAGES, AccountMoodCheckinSchema, AccountMoodTodaySchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { MoodReadAdapter } from '../../src/modules/account/mood-read.adapter'
import { type AccountTestApp, bootAccountApp, errorOf, fieldsOf, get, login, post, type Who } from './account-helpers'

/** S5-T04 (API-MUR-11, DM-84, FR-MUR-2-12, AC-MUR-2-8, -10, -12): the pupil's daily mood check-in and the Command Center adapter. */
describe('POST /api/me/mood, GET /api/me/mood/today, MoodReadAdapter (S5-T04)', () => {
  let t: AccountTestApp
  let pupil: Who
  let other: Who

  const rowsOf = (email: string) =>
    t.db.query<{ mood: string; checked_on: string; reason: string | null; is_test: boolean }>(
      `select m.mood, m.checked_on::text, m.reason, m.is_test from mood_checkins m join users u on u.id = m.user_id where lower(u.email) = lower($1) order by m.checked_on, m.id`,
      [email],
    )
  const idOf = async (email: string) => (await t.db.query<{ id: string }>(`select id::text from users where lower(email) = lower($1)`, [email]))[0]!.id

  beforeAll(async () => {
    t = await bootAccountApp()
    pupil = await login(t, 'pelajar@demo.test')
    other = await login(t, 'pelajarmaju@demo.test')
  })
  afterAll(async () => {
    await t.close()
  })

  it('reads null before a check-in, then records the first choice and reads it back (AC-MUR-2-8)', async () => {
    const before = await get(pupil, '/me/mood/today')
    expect(before.status).toBe(200)
    expect(AccountMoodTodaySchema.parse(before.body.data)).toEqual({ mood: null })

    const res = await post(pupil, '/me/mood', { mood: 'sedih' })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(AccountMoodCheckinSchema.parse(res.body.data)).toEqual({ mood: 'sedih', checkedOn: '2026-10-19' })
    expect(res.headers['cache-control']).toContain('no-store')

    expect((await get(pupil, '/me/mood/today')).body.data).toEqual({ mood: 'sedih' })
    expect(await rowsOf('pelajar@demo.test')).toEqual([{ mood: 'sedih', checked_on: '2026-10-19', reason: null, is_test: false }])
  })

  it('a second submit the same day is 409 ALREADY_CHECKED_IN and the row is unchanged (AC-MUR-2-10)', async () => {
    const res = await post(pupil, '/me/mood', { mood: 'gembira' })
    expect(errorOf(res, 409, 'ALREADY_CHECKED_IN').message).toBe(ACCOUNT_MOOD_MESSAGES.alreadyCheckedIn)
    expect(await rowsOf('pelajar@demo.test')).toEqual([{ mood: 'sedih', checked_on: '2026-10-19', reason: null, is_test: false }])
    expect((await get(pupil, '/me/mood/today')).body.data).toEqual({ mood: 'sedih' })
  })

  it('the next Malaysia day accepts a new check-in, and one pupil does not block another', async () => {
    t.clock.set('2026-10-20T00:05:00+08:00')
    // The idle session lifetime is 120 minutes on the fixed clock, so sign in again after moving it.
    pupil = await login(t, 'pelajar@demo.test')
    other = await login(t, 'pelajarmaju@demo.test')
    expect((await get(pupil, '/me/mood/today')).body.data).toEqual({ mood: null })
    const res = await post(pupil, '/me/mood', { mood: 'okay' })
    expect(res.body.data).toEqual({ mood: 'okay', checkedOn: '2026-10-20' })
    expect((await post(other, '/me/mood', { mood: 'tertekan' })).status).toBe(200)
    expect((await rowsOf('pelajar@demo.test')).map((r) => r.checked_on)).toEqual(['2026-10-19', '2026-10-20'])
  })

  it('refuses a bad value with 422 on fields.mood and writes nothing', async () => {
    t.clock.set('2026-10-21T09:00:00+08:00')
    pupil = await login(t, 'pelajar@demo.test')
    for (const body of [{ mood: 'happy' }, { mood: '' }, { mood: 3 }, {}]) {
      expect(Object.keys(fieldsOf(await post(pupil, '/me/mood', body)))).toEqual(['mood'])
    }
    expect((await get(pupil, '/me/mood/today')).body.data).toEqual({ mood: null })
  })

  it('answers 401 without a session and 403 for every other role (AC-MUR-2-12)', async () => {
    expect((await t.http().get('/api/me/mood/today')).status).toBe(401)
    expect((await t.http().post('/api/me/mood').send({ mood: 'okay' })).status).toBe(401)
    for (const email of ['guru@demo.test', 'adminsekolah@demo.test', 'admin@demo.test']) {
      const who = await login(t, email)
      errorOf(await post(who, '/me/mood', { mood: 'okay' }), 403, 'FORBIDDEN')
      errorOf(await get(who, '/me/mood/today'), 403, 'FORBIDDEN')
    }
    expect(await rowsOf('guru@demo.test')).toEqual([])
  })

  describe('MoodReadAdapter (replaces NoMood)', () => {
    let adapter: MoodReadAdapter
    let a: string
    let b: string

    beforeAll(async () => {
      adapter = t.app.get(MoodReadAdapter)
      a = await idOf('pelajar@demo.test')
      b = await idOf('pelajarmaju@demo.test')
    })

    it('counts check-ins per mood, mapped to happy|okay|sad|stressed, for the given pupils or everybody', async () => {
      expect(await adapter.counts([a])).toEqual({ happy: 0, okay: 1, sad: 1, stressed: 0 })
      expect(await adapter.counts([b])).toEqual({ happy: 0, okay: 0, sad: 0, stressed: 1 })
      expect(await adapter.counts(null)).toEqual({ happy: 0, okay: 1, sad: 1, stressed: 1 })
      expect(await adapter.counts([])).toEqual({ happy: 0, okay: 0, sad: 0, stressed: 0 })
    })

    it('counts a window by Malaysia day, an end at 00:00 not adding the next day', async () => {
      const from = new Date('2026-10-19T00:00:00+08:00')
      expect(await adapter.counts([a], { from, to: new Date('2026-10-20T00:00:00+08:00') })).toEqual({ happy: 0, okay: 0, sad: 1, stressed: 0 })
      expect(await adapter.counts([a], { from, to: new Date('2026-10-20T12:00:00+08:00') })).toEqual({ happy: 0, okay: 1, sad: 1, stressed: 0 })
    })

    it('excludes rows written in Mod Pelajar (is_test) from counts, latest, trend and rows', async () => {
      await t.db.query(`insert into mood_checkins (user_id, mood, checked_on, is_test) values ($1::bigint, 'gembira', '2026-10-22', true)`, [a])
      expect(await adapter.counts([a])).toEqual({ happy: 0, okay: 1, sad: 1, stressed: 0 })
      expect(await adapter.counts(null)).toEqual({ happy: 0, okay: 1, sad: 1, stressed: 1 })
      expect((await adapter.latest([a])).get(a)).toBe('okay')
      expect((await adapter.rows([a])).map((r) => r.mood)).not.toContain('happy')
      expect((await adapter.trend(a, { from: new Date('2026-10-01T00:00:00+08:00'), to: new Date('2026-11-01T00:00:00+08:00') })).map((d) => d.mood)).toEqual(['sad', 'okay'])
    })

    it('latest, trend (oldest first) and rows (one per check-in) carry the port shapes', async () => {
      expect([...(await adapter.latest([a, b])).entries()].sort()).toEqual([[a, 'okay'], [b, 'stressed']].sort())
      expect(await adapter.latest([])).toEqual(new Map())
      expect(await adapter.trend(a, { from: new Date('2026-10-19T00:00:00+08:00'), to: new Date('2026-10-21T00:00:00+08:00') })).toEqual([
        { date: '2026-10-19', mood: 'sad', reason: null },
        { date: '2026-10-20', mood: 'okay', reason: null },
      ])
      const rows = await adapter.rows([a, b])
      expect(rows).toHaveLength(3)
      expect(rows).toContainEqual({ studentId: b, mood: 'stressed', date: '2026-10-20', reason: null })
      expect(await adapter.rows([])).toEqual([])
    })
  })
})
