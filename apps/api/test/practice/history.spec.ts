import { SessionListResponseSchema } from '@pp/contract'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { PracticeRepository } from '../../src/modules/practice'
import {
  type Client,
  type PracticeTestApp,
  type World,
  START,
  bootPracticeApp,
  fillBank,
  loadWorld,
  loginAs,
  play,
  resetPractice,
  userIdByEmail,
} from './helpers'

let t: PracticeTestApp
let w: World
let pelajar: Client
let maju: Client
let ids: { pelajar: string; maju: string }

beforeAll(async () => {
  t = await bootPracticeApp()
  w = await loadWorld(t.db)
  pelajar = await loginAs(t, 'pelajar@demo.test')
  maju = await loginAs(t, 'pelajarmaju@demo.test')
  ids = { pelajar: await userIdByEmail(t.db, 'pelajar@demo.test'), maju: await userIdByEmail(t.db, 'pelajarmaju@demo.test') }
}, 120_000)

afterAll(async () => {
  await t.close()
})

beforeEach(async () => {
  t.clock.set(START)
  await resetPractice(t.db)
  t.bank.reset()
})

interface Seeded {
  id?: string
  user: string
  mode: string
  subject: string | null
  count: number
  correct: number
  coins: number
  completedAt: string | null
  status?: string
  isTest?: boolean
}

async function insert(s: Seeded): Promise<string> {
  const rows = await t.db.query<{ id: string }>(
    `insert into practice_sessions (id, user_id, mode, subject_id, question_count, correct_count, coins_earned, points_earned, status, started_at, completed_at, is_test)
     values (coalesce($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, '2026-10-01T00:00:00Z', $10::timestamptz, $11) returning id::text`,
    [s.id ?? null, s.user, s.mode, s.subject, s.count, s.correct, s.coins, s.correct * 10, s.status ?? 'completed', s.completedAt, s.isTest ?? false],
  )
  return rows[0]?.id as string
}

/** The shape of the mock's admin SPM history: 4 sessions at 0, 20, 32 and 35 percent. */
async function spmHistory() {
  const base = { user: ids.pelajar }
  const s1 = await insert({ ...base, mode: 'past_year', subject: w.subject.bm, count: 25, correct: 0, coins: 0, completedAt: '2026-10-10T10:00:00+08:00' })
  const s2 = await insert({ ...base, mode: 'past_year', subject: w.subject.bm, count: 25, correct: 5, coins: 5, completedAt: '2026-10-11T10:00:00+08:00' })
  const s3 = await insert({ ...base, mode: 'latih_tubi', subject: w.subject.bm, count: 25, correct: 8, coins: 8, completedAt: '2026-10-12T10:00:00+08:00' })
  const s4 = await insert({ ...base, mode: 'ramalan', subject: w.subject.sej, count: 34, correct: 12, coins: 12, completedAt: '2026-10-13T10:00:00.000+08:00' })
  return { s1, s2, s3, s4 }
}

describe('GET /practice/sessions: the caller\'s own completed sessions', () => {
  it('newest first with percent, subjectCode and the stats over every row of modes; parses as SessionListResponse', async () => {
    const s = await spmHistory()
    const res = await pelajar.get('/api/practice/sessions?modes=past_year,latih_tubi,ramalan')
    expect(res.status).toBe(200)
    const parsed = SessionListResponseSchema.parse(res.body)
    expect(parsed.data.map((r) => r.id)).toEqual([s.s4, s.s3, s.s2, s.s1])
    expect(parsed.data.map((r) => r.percent)).toEqual([35, 32, 20, 0])
    expect(parsed.data.map((r) => r.subjectCode)).toEqual(['SEJ', 'BM', 'BM', 'BM'])
    expect(parsed.data[0]).toEqual({
      id: s.s4,
      mode: 'ramalan',
      subjectId: w.subject.sej,
      subjectCode: 'SEJ',
      questionCount: 34,
      correctCount: 12,
      percent: 35,
      coinsEarned: 12,
      timeSpent: 0,
      completedAt: '2026-10-13T10:00:00.000+08:00',
    })
    expect(parsed.meta).toMatchObject({
      page: 1,
      totalItems: 4,
      totalPages: 1,
      activeType: null,
      stats: { sessions: 4, avgAccuracyPct: 21.8, coins: 25, answered: 109 },
    })
    expect(res.headers['cache-control']).toContain('no-store')
  })

  it('"type" narrows the rows only; the stats keep covering every mode in modes', async () => {
    await spmHistory()
    const res = await pelajar.get('/api/practice/sessions?modes=past_year,latih_tubi,ramalan&type=past_year')
    expect(res.body.data).toHaveLength(2)
    expect(res.body.data.every((r: { mode: string }) => r.mode === 'past_year')).toBe(true)
    expect(res.body.meta).toMatchObject({ activeType: 'past_year', totalItems: 2, stats: { sessions: 4, coins: 25, answered: 109 } })
    // A type outside modes is ignored.
    const ignored = await pelajar.get('/api/practice/sessions?modes=past_year&type=ramalan')
    expect(ignored.body.meta.activeType).toBeNull()
    expect(ignored.body.data).toHaveLength(2)
  })

  it('unpaged without page and pageSize; paged with a default size of 15; page beyond the end is empty', async () => {
    const s = await spmHistory()
    const unpaged = await pelajar.get('/api/practice/sessions?modes=past_year,latih_tubi,ramalan')
    expect(unpaged.body.meta).toMatchObject({ page: 1, pageSize: 4, totalItems: 4, totalPages: 1, from: 1, to: 4 })
    const paged = await pelajar.get('/api/practice/sessions?modes=past_year,latih_tubi,ramalan&page=2&pageSize=3')
    expect(paged.body.data.map((r: { id: string }) => r.id)).toEqual([s.s1])
    expect(paged.body.meta).toMatchObject({ page: 2, pageSize: 3, totalItems: 4, totalPages: 2, from: 4, to: 4 })
    const defaults = await pelajar.get('/api/practice/sessions?modes=past_year,latih_tubi,ramalan&page=1')
    expect(defaults.body.meta.pageSize).toBe(15)
    const onlySize = await pelajar.get('/api/practice/sessions?modes=past_year,latih_tubi,ramalan&pageSize=2')
    expect(onlySize.body.data).toHaveLength(2)
    expect(onlySize.body.meta).toMatchObject({ page: 1, pageSize: 2, totalPages: 2 })
    const beyond = await pelajar.get('/api/practice/sessions?modes=past_year&page=9&pageSize=5')
    expect(beyond.body.data).toEqual([])
    expect(beyond.body.meta.stats.sessions).toBe(2)
  })

  it('an empty history is 200 with zero stats', async () => {
    const res = await maju.get('/api/practice/sessions?modes=random')
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
    expect(res.body.meta).toMatchObject({ totalItems: 0, totalPages: 1, from: null, to: null, activeType: null, stats: { sessions: 0, avgAccuracyPct: 0, coins: 0, answered: 0 } })
  })

  it('only completed sessions of the caller are listed; a mixed session (no subject) is "UMUM"; ties are broken by id descending', async () => {
    await spmHistory()
    await insert({ user: ids.maju, mode: 'random', subject: w.subject.math, count: 5, correct: 5, coins: 5, completedAt: '2026-10-14T10:00:00+08:00' })
    await insert({ user: ids.pelajar, mode: 'random', subject: w.subject.math, count: 5, correct: 1, coins: 1, completedAt: null, status: 'in_progress' })
    const a = await insert({ id: '00000000-0000-4000-8000-00000000000a', user: ids.pelajar, mode: 'random', subject: null, count: 0, correct: 0, coins: 0, completedAt: '2026-10-20T10:00:00+08:00' })
    const b = await insert({ id: '00000000-0000-4000-8000-00000000000b', user: ids.pelajar, mode: 'random', subject: null, count: 10, correct: 5, coins: 5, completedAt: '2026-10-20T10:00:00+08:00' })
    const res = await pelajar.get('/api/practice/sessions?modes=random')
    expect(res.body.data.map((r: { id: string }) => r.id)).toEqual([b, a])
    expect(res.body.data.map((r: { subjectCode: string | null }) => r.subjectCode)).toEqual(['UMUM', 'UMUM'])
    // A session without questions has 0 percent and is left out of the mean.
    expect(res.body.data.map((r: { percent: number }) => r.percent)).toEqual([50, 0])
    expect(res.body.meta.stats).toMatchObject({ sessions: 2, avgAccuracyPct: 50, coins: 5, answered: 10 })
  })

  it('every unknown or empty modes value is 422 "Mod tidak sah." with fields.modes', async () => {
    for (const q of ['modes=spm', 'modes=random,spm', 'modes=', 'modes=,', '', 'modes=past_year&modes=random']) {
      const res = await pelajar.get(`/api/practice/sessions?${q}`)
      expect(res.status, q).toBe(422)
      expect(res.body.error).toMatchObject({ code: 'VALIDATION_ERROR', message: 'Mod tidak sah.', fields: { modes: 'Mod tidak sah.' } })
    }
    const page = await pelajar.get('/api/practice/sessions?modes=random&page=0')
    expect(page.status).toBe(422)
    expect(page.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('a session played through the API is listed with its figures', async () => {
    const bank = fillBank(t.bank, w)
    expect(bank.random.length).toBeGreaterThan(0)
    const { started } = await play(pelajar, t.bank, { mode: 'random', subjectCode: 'MATH', count: 10 }, 7, 95)
    const res = await pelajar.get('/api/practice/sessions?modes=random')
    expect(res.body.data).toEqual([
      {
        id: started.sessionId,
        mode: 'random',
        subjectId: w.subject.math,
        subjectCode: 'MATH',
        questionCount: 10,
        correctCount: 7,
        percent: 70,
        coinsEarned: 7,
        timeSpent: 95,
        completedAt: '2026-10-19T09:00:00.000+08:00',
      },
    ])
  })
})

describe('AC8 / AC-18.3 repository reads leave out Mod Pelajar rows by default', () => {
  it('history and answers of the repository exclude is_test unless asked; the user\'s own list includes them', async () => {
    const repo = t.app.get(PracticeRepository)
    await insert({ user: ids.pelajar, mode: 'random', subject: w.subject.math, count: 5, correct: 5, coins: 5, completedAt: '2026-10-14T10:00:00+08:00' })
    await insert({ user: ids.pelajar, mode: 'random', subject: w.subject.math, count: 5, correct: 4, coins: 4, completedAt: '2026-10-15T10:00:00+08:00', isTest: true })
    await t.db.query(
      `insert into practice_answers (user_id, question_id, subject_id, is_correct, answered_at, is_test) values ($1, 11, $2, true, now(), false), ($1, 12, $2, true, now(), true)`,
      [ids.pelajar, w.subject.math],
    )
    expect(await repo.history(ids.pelajar, { modes: ['random'] })).toHaveLength(1)
    expect(await repo.history(ids.pelajar, { modes: ['random'], includeTest: true })).toHaveLength(2)
    expect((await repo.historyStats(ids.pelajar, { modes: ['random'] })).sessions).toBe(1)
    expect((await repo.historyStats(ids.pelajar, { modes: ['random'], includeTest: true })).sessions).toBe(2)
    expect(await repo.answers(ids.pelajar)).toHaveLength(1)
    expect(await repo.answers(ids.pelajar, { includeTest: true })).toHaveLength(2)
    const own = await pelajar.get('/api/practice/sessions?modes=random')
    expect(own.body.data).toHaveLength(2)
    expect(own.body.meta.stats.sessions).toBe(2)
  })

  it('statsOf, lastActivityOf and masteryOf equal the per-user reads, leave out is_test, and skip users without rows', async () => {
    const repo = t.app.get(PracticeRepository)
    await insert({ user: ids.pelajar, mode: 'random', subject: w.subject.math, count: 10, correct: 7, coins: 7, completedAt: '2026-10-14T10:00:00+08:00' })
    await insert({ user: ids.pelajar, mode: 'random', subject: w.subject.math, count: 10, correct: 5, coins: 5, completedAt: '2026-10-16T10:00:00+08:00' })
    await insert({ user: ids.pelajar, mode: 'random', subject: w.subject.math, count: 10, correct: 0, coins: 0, completedAt: '2026-10-18T10:00:00+08:00', isTest: true })
    await t.db.query(`insert into mastery (user_id, subject_id, correct, answered) values ($1, $2, 3, 4) on conflict do nothing`, [ids.pelajar, w.subject.math])
    const opts = { modes: ['random'] as const }
    const list = [ids.pelajar, ids.maju]
    const stats = await repo.statsOf(list, opts)
    const one = await repo.historyStats(ids.pelajar, opts)
    expect(stats.get(ids.pelajar)).toEqual({ sessions: one.sessions, avgAccuracyPct: one.avgAccuracyPct })
    expect(stats.get(ids.pelajar)?.sessions).toBe(2)
    const last = await repo.lastActivityOf(list, opts)
    expect(last.get(ids.pelajar)?.toISOString()).toBe((await repo.history(ids.pelajar, { ...opts, take: 1 }))[0]?.completedAt?.toISOString())
    expect(last.get(ids.pelajar)?.toISOString()).toBe(new Date('2026-10-16T10:00:00+08:00').toISOString())
    expect(await repo.statsOf([], opts)).toEqual(new Map())
    const many = await repo.masteryOf(list)
    expect(many.get(ids.pelajar)).toEqual(await repo.mastery(ids.pelajar))
    if (!stats.has(ids.maju)) expect(last.has(ids.maju)).toBe(false)
  })

  it('queue and mastery reads return the stored rows in BR-14 order and by subject', async () => {
    const repo = t.app.get(PracticeRepository)
    await t.db.query(
      `insert into revision_queue (user_id, question_id, subject_id, wrong_times, last_wrong_at) values
         ($1, 21, $2, 1, '2026-10-01T00:00:00Z'), ($1, 22, $2, 2, '2026-10-01T00:00:00Z'), ($1, 23, $2, 2, '2026-10-02T00:00:00Z'), ($1, 24, $3, 5, '2026-10-02T00:00:00Z')`,
      [ids.pelajar, w.subject.math, w.subject.bm],
    )
    expect((await repo.queue(ids.pelajar)).map((q) => q.questionId)).toEqual(['24', '23', '22', '21'])
    expect((await repo.queue(ids.pelajar, { subjectId: w.subject.math })).map((q) => q.questionId)).toEqual(['23', '22', '21'])
    await t.db.query(`insert into mastery (user_id, subject_id, correct, answered) values ($1, $2, 3, 4)`, [ids.pelajar, w.subject.math])
    expect(await repo.mastery(ids.pelajar)).toEqual([{ subjectId: w.subject.math, correct: 3, answered: 4, lastAnsweredAt: null }])
  })
})
