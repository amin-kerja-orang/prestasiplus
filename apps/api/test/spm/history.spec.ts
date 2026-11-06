import { SpmHistoryResponseSchema, SpmOverviewSchema, type SpmHistoryResponse } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { addAnswers, addAttempt, addLedger, addSession } from './activity-fixtures'
import { bootSpmApp, expectError, idOf, loginAs, loginModPelajar, parseData, type Client, type SpmTestApp } from './helpers'

/**
 * `GET /api/spm/history` (S3-T07 part F, ruling Q6): the merged Sejarah Kuiz SPM list. The fixture pupil has 23 listed rows
 * (14 databank, 1 past_year, 1 ramalan, 1 tracking_a, 1 latih_tubi, 1 kuiz, 4 sittings) at one minute apart, plus rows that must
 * never be listed.
 */
let t: SpmTestApp
let student: Client
let student2: Client

const uid = async (email: string) => (await t.db.query<{ id: string }>('select id::text from users where email = $1', [email]))[0]?.id as string

/** `minute` minutes after 2026-10-10 00:00 UTC, as an ISO instant. */
const at = (minute: number): string => new Date(Date.UTC(2026, 9, 10, 0, minute)).toISOString()

const ids: Record<string, string> = {}
let math = ''

beforeAll(async () => {
  t = await bootSpmApp()
  const { db } = t
  const p = await uid('pelajar@demo.test')
  const p2 = await uid('pelajar2@demo.test')
  const a = await uid('admin@demo.test')
  math = await idOf(db, 'subjects', 'MATH')
  const bm = await idOf(db, 'subjects', 'BM')

  // Listed practice sessions: databank at minutes 1 to 14, then one of each other SPM mode.
  for (let m = 1; m <= 14; m++) ids[`databank${String(m)}`] = await addSession(db, { user: p, mode: 'databank', subjectId: math, completedAt: at(m), questions: 10, correct: 7, coins: 7, seconds: 120 + m })
  ids.pastYear = await addSession(db, { user: p, mode: 'past_year', subjectId: bm, completedAt: at(15) })
  ids.ramalan = await addSession(db, { user: p, mode: 'ramalan', subjectId: math, completedAt: at(16) })
  ids.trackingA = await addSession(db, { user: p, mode: 'tracking_a', subjectId: math, completedAt: at(17) })
  ids.latihTubi = await addSession(db, { user: p, mode: 'latih_tubi', subjectId: math, completedAt: at(18), questions: 20, correct: 17, coins: 17, seconds: 754 })
  ids.kuiz = await addSession(db, { user: p, mode: 'latih_tubi', origin: 'bijak_kuiz', subjectId: bm, completedAt: at(19) })
  // Listed closed sittings (mode from paper_kind). The simulasi sitting ran past its deadline: the duration is capped at it.
  const sitting = { user: p, subject: 'MATH', subjectName: 'Matematik' }
  ids.simulasi = await addAttempt(db, { ...sitting, kind: 'pilihan', status: 'submitted', startedAt: at(-60), deadlineAt: at(-30), submittedAt: at(20), score: 18, max: 25, coins: 36 })
  ids.subjektif = await addAttempt(db, { ...sitting, kind: 'subjektif', status: 'auto_submitted', startedAt: at(-10), submittedAt: at(21), score: 3, max: 8 })
  ids.structured = await addAttempt(db, { ...sitting, kind: 'structured', status: 'submitted', startedAt: at(-10), submittedAt: at(22), score: 5, max: 10 })
  ids.jana = await addAttempt(db, { ...sitting, kind: 'jana', status: 'submitted', startedAt: at(-10), submittedAt: at(23), score: 0, max: 0 })

  // Never listed: swept (abandoned) and open sessions, other modes, a Mod Pelajar row, an abandoned and an open sitting, other users.
  await addSession(db, { user: p, mode: 'databank', status: 'abandoned', subjectId: math })
  await addSession(db, { user: p, mode: 'databank', status: 'in_progress', subjectId: math })
  await addSession(db, { user: p, mode: 'random', completedAt: at(30) })
  await addSession(db, { user: p, mode: 'chapter', completedAt: at(31) })
  await addSession(db, { user: p, mode: 'databank', isTest: true, completedAt: at(32), subjectId: math })
  await addAttempt(db, { ...sitting, kind: 'pilihan', status: 'abandoned', startedAt: at(-5) })
  await addAttempt(db, { ...sitting, kind: 'subjektif', status: 'in_progress', startedAt: at(-5) })
  await addAttempt(db, { ...sitting, kind: 'pilihan', status: 'submitted', startedAt: at(-5), submittedAt: at(33), score: 1, max: 1, isTest: true })
  await addSession(db, { user: p2, mode: 'databank', subjectId: math, completedAt: at(34) })
  await addAttempt(db, { user: p2, kind: 'pilihan', status: 'submitted', subject: 'MATH', subjectName: 'Matematik', startedAt: at(-5), submittedAt: at(35), score: 1, max: 1 })

  // Admin: one normal and one Mod Pelajar row (the admin reads the list only inside Mod Pelajar, as a pupil).
  await addSession(db, { user: a, mode: 'databank', subjectId: math, completedAt: at(40) })
  await addSession(db, { user: a, mode: 'latih_tubi', subjectId: math, completedAt: at(41), isTest: true })

  // Tile inputs: answers in the SPM modes and ledger credits (the history tiles must match the hub).
  await addAnswers(db, { user: p, mode: 'databank', n: 4, correct: 3, subjectId: math })
  await addAnswers(db, { user: p, mode: 'simulasi', n: 4, correct: 1, subjectId: math })
  await addAnswers(db, { user: p, mode: 'chapter', n: 9, correct: 9, subjectId: math })
  await addLedger(db, p, 'quiz_spm', 21)
  await addLedger(db, p, 'quiz_spm', 4)

  student = await loginAs(t, 'student')
  student2 = await loginAs(t, 'student2')
}, 240_000)

afterAll(async () => {
  await t.close()
})

const get = async (c: Client, query = ''): Promise<SpmHistoryResponse> => {
  const res = await c.get(`/api/spm/history${query}`)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return SpmHistoryResponseSchema.parse(res.body)
}

describe('merge order, page size and pager', () => {
  it('lists the sessions and the closed sittings together, newest first, 15 on the first page', async () => {
    const r = await get(student)
    expect(r.data).toHaveLength(15)
    expect(r.meta).toMatchObject({ page: 1, pageSize: 15, pageCount: 2, total: 23, mod: 'all' })
    expect(r.data.map((x) => x.id)).toEqual([
      ids.jana,
      ids.structured,
      ids.subjektif,
      ids.simulasi,
      ids.kuiz,
      ids.latihTubi,
      ids.trackingA,
      ids.ramalan,
      ids.pastYear,
      ...[14, 13, 12, 11, 10, 9].map((m) => ids[`databank${String(m)}`]),
    ])
    // Strictly newest first.
    const times = r.data.map((x) => Date.parse(x.completedAt))
    expect(times).toEqual([...times].sort((x, y) => y - x))
  })

  it('halaman 2 holds the remaining 8 rows; a page past the last has no rows but keeps the meta', async () => {
    const r = await get(student, '?halaman=2')
    expect(r.meta).toMatchObject({ page: 2, pageCount: 2, total: 23 })
    expect(r.data.map((x) => x.id)).toEqual([8, 7, 6, 5, 4, 3, 2, 1].map((m) => ids[`databank${String(m)}`]))
    const past = await get(student, '?halaman=3')
    expect(past.data).toEqual([])
    expect(past.meta).toMatchObject({ page: 3, pageCount: 2, total: 23 })
  })

  it('a page 1 and a page 2 never overlap and together hold every listed row once', async () => {
    const all = [...(await get(student)).data, ...(await get(student, '?halaman=2')).data].map((x) => x.id)
    expect(new Set(all).size).toBe(23)
  })

  it('a pupil with no sitting gets an empty list on one page', async () => {
    const r = await get(await loginAs(t, 'studentMaju'))
    expect(r.data).toEqual([])
    expect(r.meta).toMatchObject({ page: 1, pageCount: 1, total: 0 })
  })

  it('the response is Cache-Control: no-store', async () => {
    expect((await student.get('/api/spm/history')).headers['cache-control']).toMatch(/no-store/)
  })
})

describe('chips: mod, its alias type and the legacy values', () => {
  it('databank lists the databank and the legacy past_year sessions', async () => {
    const r = await get(student, '?mod=databank')
    expect(r.meta).toMatchObject({ mod: 'databank', total: 15, pageCount: 1 })
    expect(r.data[0]?.id).toBe(ids.pastYear)
    expect(r.data.every((x) => x.mode === 'databank')).toBe(true)
  })

  it('tracking_a lists the tracking_a and the legacy ramalan sessions', async () => {
    const r = await get(student, '?mod=tracking_a')
    expect(r.data.map((x) => x.id)).toEqual([ids.trackingA, ids.ramalan])
    expect(r.data.every((x) => x.mode === 'tracking_a')).toBe(true)
  })

  it('latih_tubi lists the Latih Tubi sessions only: a Kuiz session and the sittings are not in it', async () => {
    const r = await get(student, '?mod=latih_tubi')
    expect(r.data.map((x) => x.id)).toEqual([ids.latihTubi])
  })

  it('the legacy values are accepted as aliases: past_year is the databank chip, ramalan the tracking_a chip', async () => {
    const legacyDatabank = await get(student, '?mod=past_year')
    const databank = await get(student, '?mod=databank')
    expect(legacyDatabank.data).toEqual(databank.data)
    expect(legacyDatabank.meta.mod).toBe('databank')
    expect((await get(student, '?mod=ramalan')).data).toEqual((await get(student, '?mod=tracking_a')).data)
  })

  it('type is an alias of mod (old links); mod wins when both are sent', async () => {
    expect((await get(student, '?type=tracking_a')).data).toEqual((await get(student, '?mod=tracking_a')).data)
    expect((await get(student, '?type=past_year')).meta.mod).toBe('databank')
    expect((await get(student, '?mod=latih_tubi&type=databank')).meta.mod).toBe('latih_tubi')
  })

  it('a chip is paged too: halaman applies inside it', async () => {
    const r = await get(student, '?mod=databank&halaman=1')
    expect(r.data).toHaveLength(15)
    expect((await get(student, '?mod=databank&halaman=2')).data).toEqual([])
  })

  it('an unknown chip or a bad page is 422 VALIDATION_ERROR', async () => {
    for (const q of ['?mod=kuiz', '?mod=structured', '?type=x', '?halaman=0', '?halaman=-1', '?halaman=1.5', '?halaman=abc']) {
      expectError(await student.get(`/api/spm/history${q}`), 'VALIDATION_ERROR')
    }
  })
})

describe('rows', () => {
  it('Bijak, Subjektif, Berstruktur and Kuiz rows come from the closed sittings and sessions with their OPT-MODE-SESI mode', async () => {
    const r = await get(student)
    const mode = (id: string | undefined) => r.data.find((x) => x.id === id)?.mode
    expect(mode(ids.simulasi)).toBe('simulasi') // paper_kind pilihan
    expect(mode(ids.jana)).toBe('simulasi') // paper_kind jana
    expect(mode(ids.subjektif)).toBe('subjektif')
    expect(mode(ids.structured)).toBe('structured')
    expect(mode(ids.kuiz)).toBe('kuiz')
    expect(mode(ids.latihTubi)).toBe('latih_tubi')
    expect(mode(ids.pastYear)).toBe('databank') // legacy read as the lane
    expect(mode(ids.ramalan)).toBe('tracking_a')
  })

  it('a session row carries the session figures and the subject', async () => {
    const r = await get(student)
    expect(r.data.find((x) => x.id === ids.latihTubi)).toMatchObject({
      subject: { code: 'MATH', name: (await t.db.query<{ name: string }>(`select name from subjects where code = 'MATH'`))[0]?.name },
      correct: 17,
      total: 20,
      percent: 85,
      coins: 17,
      durationSeconds: 754,
      completedAt: '2026-10-10T08:18:00.000+08:00',
    })
  })

  it('a sitting row: marks, whole-number percent, the result coins and the elapsed time capped at the deadline', async () => {
    const r = await get(student)
    expect(r.data.find((x) => x.id === ids.simulasi)).toMatchObject({
      subject: { code: 'MATH', name: 'Matematik' },
      correct: 18,
      total: 25,
      percent: 72,
      coins: 36,
      durationSeconds: 1800, // started 60 min before, deadline 30 min before the submit: capped at 30 min
    })
    // 3 of 8 = 37.5 rounds half up to 38; a sitting with no marks is 0 percent.
    expect(r.data.find((x) => x.id === ids.subjektif)).toMatchObject({ correct: 3, total: 8, percent: 38, coins: 0, durationSeconds: 1860 })
    expect(r.data.find((x) => x.id === ids.jana)).toMatchObject({ correct: 0, total: 0, percent: 0 })
  })
})

describe('what is never listed', () => {
  it('lists no swept, open, other-mode, test, other-user or unfinished-sitting row', async () => {
    const listed = [...(await get(student)).data, ...(await get(student, '?halaman=2')).data]
    expect(listed).toHaveLength(23)
    const ownIds = await t.db.query<{ id: string }>(
      `select id::text from practice_sessions where user_id = $1 and (status <> 'completed' or mode in ('random', 'chapter') or is_test)
       union all select id::text from exam_attempts where user_id = $1 and (status in ('abandoned', 'in_progress') or is_test)`,
      [await uid('pelajar@demo.test')],
    )
    expect(ownIds).toHaveLength(8)
    for (const { id } of ownIds) expect(listed.map((x) => x.id)).not.toContain(id)
    const other = await t.db.query<{ id: string }>(`select id::text from practice_sessions where user_id = $1 union all select id::text from exam_attempts where user_id = $1`, [await uid('pelajar2@demo.test')])
    for (const { id } of other) expect(listed.map((x) => x.id)).not.toContain(id)
  })

  it('another pupil sees only their own two sittings', async () => {
    const r = await get(student2)
    expect(r.meta.total).toBe(2)
    expect(r.data).toHaveLength(2)
  })
})

describe('the tiles (meta.stats)', () => {
  it('are over all modes: the chip and the page never change them, and they equal the hub figures', async () => {
    const all = await get(student)
    // 4 + 4 answers in the SPM modes (the 9 chapter answers do not count): 4 correct of 8 = 50 percent. Sessions: 19 completed
    // practice sessions of the SPM session modes (14 + 1 + 1 + 1 + 1 + the Kuiz one) minus nothing + 4 closed sittings = 23.
    expect(all.meta.stats).toEqual({ sessions: 23, avgAccuracy: 50, coins: 25, answered: 8 })
    for (const q of ['?mod=databank', '?mod=tracking_a', '?mod=latih_tubi', '?halaman=2', '?halaman=9']) expect((await get(student, q)).meta.stats, q).toEqual(all.meta.stats)
    expect(parseData(await student.get('/api/spm/overview'), SpmOverviewSchema).me).toEqual(all.meta.stats)
  })

  it('a pupil with no answer has accuracy null ("—")', async () => {
    expect((await get(await loginAs(t, 'studentMaju'))).meta.stats).toEqual({ sessions: 0, avgAccuracy: null, coins: 0, answered: 0 })
  })
})

describe('access and Mod Pelajar scoping', () => {
  it('without a session it is 401, and a role other than the pupil is 403', async () => {
    expectError(await t.http().get('/api/spm/history'), 'UNAUTHORIZED')
    for (const role of ['teacher', 'admin', 'schoolAdmin'] as const) expectError(await (await loginAs(t, role)).get('/api/spm/history'), 'FORBIDDEN')
  })

  it('Mod Pelajar reads as a pupil and sees its own test rows with the normal ones; a pupil never sees test rows', async () => {
    const mod = await loginModPelajar(t, 'admin')
    const r = await get(mod)
    expect(r.meta.total).toBe(2)
    expect(r.data.map((x) => x.mode)).toEqual(['latih_tubi', 'databank'])
    // The pupil's own test rows (a databank session, a sitting) stay out of the pupil's list.
    expect((await get(student)).meta.total).toBe(23)
  })
})
