/**
 * R1-B12 self-mark, R1-B13 keyword suggestion in the result, R1-B15 Cuba Lagi / Lihat semakan lepas.
 * V2 truth: ExamSimulationController selfMark / submit / retry / review (see the service comments).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BijakAttemptPastSittingsSchema,
  BijakAttemptResultViewSchema,
  BijakAttemptSelfMarkResultSchema,
  BijakAttemptStartResultSchema,
} from '@pp/contract'

import {
  ADMIN,
  type AttemptsTestApp,
  bootAttemptsApp,
  change,
  type Client,
  expectError,
  loginAs,
  MIN,
  OTHER_STUDENT,
  PAPER,
  START,
  startAttempt,
  STUDENT,
  TEACHER,
} from './helpers'

let t: AttemptsTestApp
let me: Client
let other: Client

beforeAll(async () => {
  t = await bootAttemptsApp()
  me = await loginAs(t, STUDENT)
  other = await loginAs(t, OTHER_STUDENT)
})
afterAll(async () => {
  await t.close()
})
beforeEach(async () => {
  t.clock.set(START)
  await t.db.query('truncate exam_attempts cascade')
  t.reward.calls.length = 0
  t.aggregate.calls.length = 0
  vi.restoreAllMocks()
})

const SEL_B = 'sn2-sel-q2-b' // Sains K2, points scheme, 2 marks: "Menyimpan air / bahan terlarut" + "Mengekalkan tekanan turgor / bentuk sel"
const SEJ_ESSAY_1 = 'sej2-q3-a' // Sejarah K2, rubric, 10 marks; Bahagian B: choose 1 of q3 / q4
const SEJ_ESSAY_2 = 'sej2-q4-a'
const MCQ_PART = '101' // never a part id; used as "part not on the attempt"

const selfMark = (c: Client, id: string, body: object) => c.post(`/api/bijak/attempts/${id}/self-mark`, body)
const result = async (c: Client, id: string) => {
  const res = await c.get(`/api/bijak/attempts/${id}/result`)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return BijakAttemptResultViewSchema.parse(res.body.data)
}
const partOf = (r: { questions: { parts: { partId: string }[] }[] }, partId: string) =>
  r.questions.flatMap((q) => q.parts).find((p) => p.partId === partId) as unknown as Record<string, unknown> & { awarded: number; status: string }

async function sit(c: Client, paperId: string, changes: ReturnType<typeof change>[], mode: 'exam' | 'latihan' = 'exam'): Promise<string> {
  const id = await startAttempt(c, paperId, mode, true)
  const res = await c.post(`/api/bijak/attempts/${id}/submit`, { idempotencyKey: `k-${id}`, changes })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return id
}
const sains = (text = 'bahan terlarut dalam sel itu') => sit(me, PAPER.sainsK2, [change(SEL_B, { text })])
const sejarah = () =>
  sit(me, PAPER.sejK2, [
    change(SEJ_ESSAY_1, { text: 'Perlembagaan menjadi asas undang-undang negara.' }),
    change(SEJ_ESSAY_2, { text: 'Kerjasama antara kaum membina perpaduan.' }),
  ])

describe('R1-B13 keyword suggestion in the result', () => {
  it('V2 submit :408-414: a matched suggestion is stored as the awarded mark, flagged autoSuggested, and the total stays provisional', async () => {
    const id = await sains()
    const r = await result(me, id)
    const p = partOf(r.result, SEL_B)
    expect(p).toMatchObject({ awarded: 1, status: 'belum_dimarkah', selfMarkable: true, autoSuggested: true })
    // "terlarut" is a keyword of point 1 only (V2: any token of 5+ letters of the point)
    expect(p.suggestion).toMatchObject({ suggestedMark: 1, matched: 1, total: 2 })
    expect((p.suggestion as { points: { matched: boolean }[] }).points.map((x) => x.matched)).toEqual([true, false])
    expect(r.result.score).toBe(1) // counts at once, as in V2
    expect(r.result.provisional).toBe(true)
    expect(r.result.pendingReview).toBe(1)
    expect(p.selfMarked).toBeUndefined()
  })

  it('a self-mark overrides the automatic suggestion and clears autoSuggested', async () => {
    const id = await sains()
    await selfMark(me, id, { partId: SEL_B, mark: 0 })
    const r = (await result(me, id)).result
    expect(partOf(r, SEL_B)).toMatchObject({ awarded: 0, status: 'salah', selfMarked: true })
    expect(partOf(r, SEL_B).autoSuggested).toBeUndefined()
    expect(r.score).toBe(0)
  })

  it('no keyword match: nothing is stamped (awarded 0), the suggestion is 0 and the part is not "betul" (AC-R1-07.3)', async () => {
    const id = await sains('tidak tahu langsung jawapannya')
    const p = partOf((await result(me, id)).result, SEL_B)
    expect(p.suggestion).toMatchObject({ suggestedMark: 0, matched: 0 })
    expect(p).toMatchObject({ awarded: 0, status: 'belum_dimarkah' })
    expect(p.autoSuggested).toBeUndefined()
  })

  it('same answer, same suggestion (AC-R1-07.4)', async () => {
    const a = partOf((await result(me, await sains('Bahan  TERLARUT dalam sel'))).result, SEL_B).suggestion
    const b = partOf((await result(me, await sains('bahan terlarut dalam sel'))).result, SEL_B).suggestion
    expect(a).toEqual(b)
  })

  it('a rubric part is self-markable but has no suggestion; an automatically marked part is neither', async () => {
    const id = await sejarah()
    const r = await result(me, id)
    const essay = partOf(r.result, SEJ_ESSAY_1)
    expect(essay).toMatchObject({ selfMarkable: true, status: 'belum_dimarkah' })
    expect(essay.suggestion).toBeUndefined()
    const mapping = partOf(r.result, 'sej2-q2-a')
    expect(mapping.selfMarkable).toBeUndefined()
    expect(mapping.suggestion).toBeUndefined()
  })

  it('the suggestion is not in the live attempt view or the autosave response (nothing leaks before Hantar)', async () => {
    const id = await startAttempt(me, PAPER.sainsK2, 'exam')
    const put = await me.put(`/api/bijak/attempts/${id}/answers`, { changes: [change(SEL_B, { text: 'bahan terlarut' })] })
    const view = await me.get(`/api/bijak/attempts/${id}`)
    for (const body of [JSON.stringify(put.body), JSON.stringify(view.body)]) {
      expect(body).not.toContain('suggestion')
      expect(body).not.toContain('selfMarkable')
    }
  })
})

describe('R1-B12 self-mark', () => {
  it('records a points-part mark, recomputes the totals and shows it again on re-opening', async () => {
    const id = await sains()
    const before = (await result(me, id)).result
    const res = await selfMark(me, id, { partId: SEL_B, mark: 2 })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const out = BijakAttemptSelfMarkResultSchema.parse(res.body.data)
    expect(out).toMatchObject({ partId: SEL_B, awarded: 2, max: 2, status: 'betul', attemptScore: 2, attemptMax: before.max })
    const again = (await result(me, id)).result
    expect(partOf(again, SEL_B)).toMatchObject({ awarded: 2, status: 'betul', selfMarked: true })
    expect(before.score).toBe(1) // the automatic suggestion, replaced (not added to) by the pupil's mark
    expect(again.score).toBe(2)
    expect(again.pendingReview).toBe(before.pendingReview - 1)
    // reward figures are the credited ones from submit (score 1 then), not recomputed from the self-marked score
    expect(again.coins).toBe(before.coins)
    expect(again.points).toBe(before.points)
    expect(again.coins).toBe(2)
    expect(out.result.coins).toBe(2)
    const row = (await t.db.query<{ coins: number; points: number }>(`select coins, points from attempt_results where attempt_id = $1`, [id]))[0]!
    expect(row).toMatchObject({ coins: 2, points: 10 })
    // a blank answer self-marked above 0 is a marked part (separa/betul), not "kosong"
    const blank = await sit(me, PAPER.sainsK2, [])
    const b = BijakAttemptSelfMarkResultSchema.parse((await selfMark(me, blank, { partId: SEL_B, mark: 2 })).body.data)
    expect(b).toMatchObject({ awarded: 2, status: 'betul' })
    // the Bahagian total moved too
    const sec = again.sections.find((s) => s.counted.includes('sn2-sel-q2'))!
    expect(sec.awarded).toBe(2)
  })

  it('clamps to 0..part marks instead of refusing', async () => {
    const id = await sains()
    expect(BijakAttemptSelfMarkResultSchema.parse((await selfMark(me, id, { partId: SEL_B, mark: 99 })).body.data).awarded).toBe(2)
    expect(BijakAttemptSelfMarkResultSchema.parse((await selfMark(me, id, { partId: SEL_B, mark: -5 })).body.data)).toMatchObject({ awarded: 0, status: 'salah' })
  })

  it('has no lock: the mark can be changed again and the total follows', async () => {
    const id = await sains()
    await selfMark(me, id, { partId: SEL_B, mark: 2 })
    const res = BijakAttemptSelfMarkResultSchema.parse((await selfMark(me, id, { partId: SEL_B, mark: 1 })).body.data)
    expect(res).toMatchObject({ awarded: 1, status: 'separa' })
    expect((await result(me, id)).result.score).toBe(res.attemptScore)
  })

  it('is idempotent: a repeat gives the same state and tells the aggregate once', async () => {
    const id = await sains()
    t.aggregate.calls.length = 0
    const first = (await selfMark(me, id, { partId: SEL_B, mark: 1 })).body.data
    const second = (await selfMark(me, id, { partId: SEL_B, mark: 1 })).body.data
    expect(second).toEqual(first)
    expect(t.aggregate.calls).toHaveLength(1)
  })

  it('records the change to the performance aggregate (regraded) and the score columns, without a second reward', async () => {
    const id = await sains()
    const rewards = t.reward.calls.length
    t.aggregate.calls.length = 0
    await selfMark(me, id, { partId: SEL_B, mark: 2 })
    expect(t.aggregate.calls).toHaveLength(1)
    expect(t.aggregate.calls[0]).toMatchObject({ attemptId: id, regraded: true, score: 2 })
    expect(t.reward.calls).toHaveLength(rewards)
    const row = (await t.db.query<{ score: string; pending_review: number }>(`select score::text, pending_review from attempt_results where attempt_id = $1`, [id]))[0]!
    expect(Number(row.score)).toBe(2)
    const hist = await me.get('/api/bijak/history')
    expect(hist.body.data.find((h: { attemptId: string }) => h.attemptId === id)).toMatchObject({ score: 2 })
  })

  it('the suggestion stays visible after the pupil marked (V2 keeps the line)', async () => {
    const id = await sains()
    await selfMark(me, id, { partId: SEL_B, mark: 2 })
    expect(partOf((await result(me, id)).result, SEL_B).suggestion).toMatchObject({ suggestedMark: 1 })
  })

  describe('band_rubric', () => {
    it('stores the band and keeps the mark inside the band range', async () => {
      const id = await sejarah()
      const hi = BijakAttemptSelfMarkResultSchema.parse((await selfMark(me, id, { partId: SEJ_ESSAY_1, mark: 10, band: 'Baik' })).body.data)
      expect(hi).toMatchObject({ awarded: 8, band: 'Baik' })
      const lo = BijakAttemptSelfMarkResultSchema.parse((await selfMark(me, id, { partId: SEJ_ESSAY_1, mark: 0, band: 'Baik' })).body.data)
      expect(lo).toMatchObject({ awarded: 6, band: 'Baik' })
      expect(partOf((await result(me, id)).result, SEJ_ESSAY_1)).toMatchObject({ awarded: 6, band: 'Baik', selfMarked: true })
    })

    it('without a band the mark is only clamped to 0..marks (the pupil can still adjust)', async () => {
      const id = await sejarah()
      const r = BijakAttemptSelfMarkResultSchema.parse((await selfMark(me, id, { partId: SEJ_ESSAY_1, mark: 4 })).body.data)
      expect(r).toMatchObject({ awarded: 4 })
      expect(r.band).toBeUndefined()
    })

    it('an unknown band is 422 on fields.band; a band on a points part is 422', async () => {
      const id = await sejarah()
      const bad = await selfMark(me, id, { partId: SEJ_ESSAY_1, mark: 5, band: 'Hebat' })
      expect(bad.status).toBe(422)
      expect(bad.body.error.fields.band).toBe('Band tidak sah untuk bahagian ini.')
      const s = await sains()
      const notRubric = await selfMark(me, s, { partId: SEL_B, mark: 1, band: 'Baik' })
      expect(notRubric.status).toBe(422)
      expect(notRubric.body.error.fields.band).toBe('Bahagian ini tidak menggunakan band.')
    })

    it('choose-N is re-ranked: marking the other essay higher changes which question counts', async () => {
      const id = await sejarah()
      const base = (await result(me, id)).result
      const secB = (r: typeof base) => r.sections.find((s) => s.label === 'Bahagian B')!
      expect(secB(base).counted).toEqual(['sej2-q3']) // tie at 0: the lower position
      const out = BijakAttemptSelfMarkResultSchema.parse((await selfMark(me, id, { partId: SEJ_ESSAY_2, mark: 9, band: 'Cemerlang' })).body.data)
      expect(secB(out.result)).toMatchObject({ counted: ['sej2-q4'], awarded: 9 })
      expect(out.attemptScore).toBe(base.score + 9)
      // marking the dropped essay lower does not change the total
      const lower = BijakAttemptSelfMarkResultSchema.parse((await selfMark(me, id, { partId: SEJ_ESSAY_1, mark: 5 })).body.data)
      expect(lower.attemptScore).toBe(base.score + 9)
      expect(secB(lower.result).counted).toEqual(['sej2-q4'])
    })
  })

  describe('server trust', () => {
    it('only after submit: an open attempt is 409 NOT_SUBMITTED with the Hantar message', async () => {
      const id = await startAttempt(me, PAPER.sainsK2, 'exam')
      expectError(await selfMark(me, id, { partId: SEL_B, mark: 1 }), 'NOT_SUBMITTED', 'Skema hanya didedahkan selepas Hantar')
    })

    it('only the owner: another pupil gets 403 "Akses ditolak", an unknown or malformed id 404', async () => {
      const id = await sains()
      expectError(await selfMark(other, id, { partId: SEL_B, mark: 2 }), 'FORBIDDEN', 'Akses ditolak')
      expectError(await selfMark(me, '00000000-0000-4000-8000-000000000000', { partId: SEL_B, mark: 2 }), 'NOT_FOUND', 'Percubaan tidak ditemui')
      expectError(await selfMark(me, 'abc', { partId: SEL_B, mark: 2 }), 'NOT_FOUND', 'Percubaan tidak ditemui')
      const r = (await result(me, id)).result
      expect(partOf(r, SEL_B).selfMarked).toBeUndefined() // the refused call changed nothing
      expect(r.score).toBe(1) // only the automatic keyword suggestion counts
    })

    it('students only: a teacher and an anonymous caller are refused; a missing CSRF header is refused', async () => {
      const id = await sains()
      const teacher = await loginAs(t, TEACHER)
      expect(teacher.post).toBeDefined()
      expectError(await selfMark(teacher, id, { partId: SEL_B, mark: 2 }), 'FORBIDDEN')
      expect((await t.http().post(`/api/bijak/attempts/${id}/self-mark`).send({ partId: SEL_B, mark: 2 })).status).toBe(401)
      const noCsrf = await me.noCsrf.post(`/api/bijak/attempts/${id}/self-mark`, { partId: SEL_B, mark: 2 })
      expect(noCsrf.status).toBe(403)
      expect(noCsrf.body.error.code).toBe('CSRF_INVALID')
      void ADMIN
    })

    it('the part must be on this attempt and be a written part (422 on fields.partId)', async () => {
      const id = await sains()
      const unknown = await selfMark(me, id, { partId: MCQ_PART, mark: 1 })
      expect(unknown.status).toBe(422)
      expect(unknown.body.error.fields.partId).toBe('Bahagian ini tiada dalam kertas ini.')
      // a part of ANOTHER paper cannot be borrowed to raise the score
      const borrowed = await selfMark(me, id, { partId: SEJ_ESSAY_1, mark: 10 })
      expect(borrowed.status).toBe(422)
      // an automatically marked part (short answer with accepted keywords is points, so use the mapping part of Sejarah)
      const s = await sejarah()
      const auto = await selfMark(me, s, { partId: 'sej2-q2-a', mark: 1 })
      expect(auto.status).toBe(422)
      expect(auto.body.error.fields.partId).toBe('Bahagian ini ditanda automatik; markah kendiri tidak diperlukan.')
    })

    it('rejects a malformed body (422): no partId, a fraction, a string', async () => {
      const id = await sains()
      for (const body of [{ mark: 1 }, { partId: SEL_B, mark: 1.5 }, { partId: SEL_B, mark: '2' }, { partId: SEL_B }, { partId: SEL_B, mark: 1, extra: true }]) {
        expect((await selfMark(me, id, body)).status, JSON.stringify(body)).toBe(422)
      }
    })

    it('a self-mark on an auto-submitted (timed out) attempt is accepted too', async () => {
      const id = await startAttempt(me, PAPER.sainsK2, 'exam')
      await me.put(`/api/bijak/attempts/${id}/answers`, { changes: [change(SEL_B, { text: 'bahan terlarut dalam sel' })] })
      const dur = (await me.get('/api/bijak/attempts/' + id)).body.data.attempt.durationMin as number
      t.clock.advance(dur * MIN + 302_000)
      expect(await t.sweeper.sweep()).toBe(1)
      const res = await selfMark(me, id, { partId: SEL_B, mark: 2 })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data.awarded).toBe(2)
    })
  })

  it('a pupil in Mod Pelajar (admin) is a student for this route and the row stays their own', async () => {
    const admin = await loginAs(t, ADMIN, true)
    const id = await sit(admin, PAPER.sainsK2, [change(SEL_B, { text: 'bahan terlarut dalam sel' })])
    const res = await selfMark(admin, id, { partId: SEL_B, mark: 1 })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
  })
})

describe('R1-B15 Cuba Lagi', () => {
  it('starts a new blank sitting of the same paper; the old attempt and its result stay as they were', async () => {
    const old = await sains()
    await selfMark(me, old, { partId: SEL_B, mark: 2 })
    t.clock.advance(MIN)
    const res = await me.post(`/api/bijak/attempts/${old}/retry`)
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const { attemptId } = BijakAttemptStartResultSchema.parse(res.body.data)
    expect(attemptId).not.toBe(old)
    const view = (await me.get(`/api/bijak/attempts/${attemptId}`)).body.data
    expect(view.attempt).toMatchObject({ status: 'in_progress', mode: 'exam', paperId: PAPER.sainsK2, answers: {} })
    expect(view.attempt.deadline).not.toBeNull()
    expect(partOf((await result(me, old)).result, SEL_B)).toMatchObject({ awarded: 2, selfMarked: true })
    const hist = (await me.get('/api/bijak/history')).body.data as { attemptId: string; status: string; score?: number }[]
    expect(hist.map((h) => h.attemptId)).toEqual([attemptId, old])
    expect(hist.find((h) => h.attemptId === old)).toMatchObject({ status: 'submitted', score: 2 })
  })

  it('keeps the mode (latihan stays latihan, with no deadline) and leaves another open sitting alone (V2 retry)', async () => {
    const old = await sit(me, PAPER.sainsK2, [change(SEL_B, { text: 'x' })], 'latihan')
    const open = await startAttempt(me, PAPER.sainsK2, 'exam')
    t.clock.advance(MIN)
    const { attemptId } = BijakAttemptStartResultSchema.parse((await me.post(`/api/bijak/attempts/${old}/retry`)).body.data)
    const view = (await me.get(`/api/bijak/attempts/${attemptId}`)).body.data
    expect(view.attempt).toMatchObject({ mode: 'latihan', deadline: null })
    expect((await me.get(`/api/bijak/attempts/${open}`)).body.data.attempt.status).toBe('in_progress')
    expect((await me.get(`/api/bijak/papers/${PAPER.sainsK2}/in-progress`)).body.data.attemptId).toBe(attemptId)
  })

  it('an attempt that is not closed cannot be retried (409), and nothing is created', async () => {
    const id = await startAttempt(me, PAPER.sainsK2, 'exam')
    expectError(await me.post(`/api/bijak/attempts/${id}/retry`), 'CONFLICT', 'Hantar percubaan ini dahulu sebelum mencuba semula.')
    expect(((await me.get('/api/bijak/history')).body.data as unknown[]).length).toBe(1)
  })

  it('a withdrawn paper is refused with a plain BM message (AC-R1-08.3); the old result still opens', async () => {
    const old = await sains()
    vi.spyOn(t.papers, 'resolveForAttempt').mockResolvedValue({ ok: false, reason: 'not_found' })
    expectError(await me.post(`/api/bijak/attempts/${old}/retry`), 'CONFLICT', 'Kertas ini sudah tidak tersedia untuk dicuba semula.')
    expect((await result(me, old)).attempt.status).toBe('submitted')
  })

  it('a paper the pupil may not sit any more (not eligible, e.g. it places an archived question) is the documented 409 retryPaperGone', async () => {
    const old = await sains()
    vi.spyOn(t.papers, 'resolveForAttempt').mockResolvedValue({ ok: false, reason: 'not_eligible' })
    expectError(await me.post(`/api/bijak/attempts/${old}/retry`), 'CONFLICT', 'Kertas ini sudah tidak tersedia untuk dicuba semula.')
  })

  it('owner only: 403 for another pupil, 404 for an unknown attempt, no CSRF refused', async () => {
    const old = await sains()
    expectError(await other.post(`/api/bijak/attempts/${old}/retry`), 'FORBIDDEN', 'Akses ditolak')
    expectError(await me.post('/api/bijak/attempts/00000000-0000-4000-8000-000000000000/retry'), 'NOT_FOUND', 'Percubaan tidak ditemui')
    expect((await me.noCsrf.post(`/api/bijak/attempts/${old}/retry`)).status).toBe(403)
  })
})

describe('R1-B15 Lihat semakan lepas', () => {
  const past = async (c: Client, paperId: string) => {
    const res = await c.get(`/api/bijak/papers/${paperId}/attempts`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return BijakAttemptPastSittingsSchema.parse(res.body.data)
  }

  it('is empty without a closed sitting (the control is not shown)', async () => {
    expect(await past(me, PAPER.sainsK2)).toEqual({ lastSubmittedAttemptId: null, sittings: [] })
    await startAttempt(me, PAPER.sainsK2, 'exam') // an open sitting does not count
    expect(await past(me, PAPER.sainsK2)).toEqual({ lastSubmittedAttemptId: null, sittings: [] })
  })

  it('lists the closed sittings newest first with their score, and the last one is the latest', async () => {
    const first = await sains()
    await selfMark(me, first, { partId: SEL_B, mark: 2 })
    t.clock.set(new Date(new Date(START).getTime() + 5 * MIN).toISOString())
    const second = await sains('tidak tahu langsung jawapannya')
    t.clock.set(new Date(new Date(START).getTime() + 10 * MIN).toISOString())
    await startAttempt(me, PAPER.sainsK2, 'exam') // open: excluded
    const list = await past(me, PAPER.sainsK2)
    expect(list.lastSubmittedAttemptId).toBe(second)
    expect(list.sittings.map((s) => s.attemptId)).toEqual([second, first])
    expect(list.sittings[1]).toMatchObject({ status: 'submitted', score: 2, provisional: false })
    expect(list.sittings[0]).toMatchObject({ score: 0, provisional: true })
    // "Lihat semakan lepas" then opens the latest result
    expect((await result(me, list.lastSubmittedAttemptId!)).attempt.id).toBe(second)
  })

  it('shows only the caller own sittings of that paper', async () => {
    await sit(other, PAPER.sainsK2, [change(SEL_B, { text: 'x' })])
    await sit(me, PAPER.sejK2, [change(SEJ_ESSAY_1, { text: 'x' })])
    expect(await past(me, PAPER.sainsK2)).toEqual({ lastSubmittedAttemptId: null, sittings: [] })
    expect((await past(me, PAPER.sejK2)).sittings).toHaveLength(1)
  })

  it('a malformed or unknown paper id is an empty list, not an error; students only', async () => {
    expect(await past(me, 'abc')).toEqual({ lastSubmittedAttemptId: null, sittings: [] })
    expect(await past(me, '999999')).toEqual({ lastSubmittedAttemptId: null, sittings: [] })
    const teacher = await loginAs(t, TEACHER)
    expectError(await teacher.get(`/api/bijak/papers/${PAPER.sainsK2}/attempts`), 'FORBIDDEN')
    expect((await t.http().get(`/api/bijak/papers/${PAPER.sainsK2}/attempts`)).status).toBe(401)
  })
})
