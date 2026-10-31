/**
 * T40: R1 acceptance criteria of the attempts card that had no spec (docs/qa/r1-backend-ac-coverage.md). V2 truth:
 * docs/discovery/cloud-student-mechanism.md 1.3 (Bahagian: choose-N ticks are advisory, scoring is best-N), 1.4 (autosave, resume),
 * 1.6 (marking, written parts wait) and 1.7 (Semakan: band midpoint, self-mark).
 *
 * | AC | spec |
 * | R1-02.1 pick cap                        | "R1-02.1" |
 * | R1-05.2 resume returns answers/flags/picks | "R1-05.2" |
 * | R1-06.2 band midpoint                   | "R1-06.2" |
 * | R1-06.5 unmarked written part counts 0   | "R1-06.5" |
 */
import { BijakAttemptPaperViewSchema, BijakAttemptResultViewSchema, BijakAttemptSelfMarkResultSchema } from '@pp/contract'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { type AttemptsTestApp, bootAttemptsApp, change, type Client, loginAs, PAPER, startAttempt, STUDENT } from './helpers'

let t: AttemptsTestApp
let me: Client

beforeAll(async () => {
  t = await bootAttemptsApp()
  me = await loginAs(t, STUDENT)
})
afterAll(async () => {
  await t.close()
})
beforeEach(async () => {
  await t.db.query('truncate exam_attempts cascade')
})

const view = async (c: Client, id: string) => {
  const res = await c.get(`/api/bijak/attempts/${id}`)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return BijakAttemptPaperViewSchema.parse(res.body.data)
}
const result = async (c: Client, id: string) => {
  const res = await c.get(`/api/bijak/attempts/${id}/result`)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return BijakAttemptResultViewSchema.parse(res.body.data)
}

const SAINS_B = 'sn-k2-2025-a-s2' // Sains K2 Bahagian B: choose 1 of 2 (sn2-osmosis, sn2-fotosintesis)
const OSMOSIS_A = 'sn2-osmosis-a'
const FOTO_A = 'sn2-fotosintesis-a'
const SEL_B = 'sn2-sel-q2-b' // points scheme, 2 marks
const SEJ_ESSAY_1 = 'sej2-q3-a' // rubric, 10 marks

describe('R1-02.1: the pick cap of a choose-N Bahagian', () => {
  it('the server never refuses ticks above N (they are advisory in V2); it stores them as sent and scores the best N only', async () => {
    const id = await startAttempt(me, PAPER.sainsK2, 'exam', true)
    // Bahagian B is "Pilih 1": tick BOTH questions and answer both.
    const picks = { [SAINS_B]: ['sn2-osmosis', 'sn2-fotosintesis'] }
    const saved = await me.put(`/api/bijak/attempts/${id}/answers`, {
      changes: [
        change(OSMOSIS_A, { text: 'Air melalui membran separa telap ke dalam sel hingga sel menjadi turgid.' }),
        change(FOTO_A, { text: 'Cahaya, klorofil dan karbon dioksida menghasilkan glukosa.' }),
      ],
      picks,
    })
    expect(saved.status, JSON.stringify(saved.body)).toBe(200)
    expect((await view(me, id)).attempt.picks).toEqual(picks)
    const sub = await me.post(`/api/bijak/attempts/${id}/submit`, { idempotencyKey: 'cap', changes: [], picks })
    expect(sub.status, JSON.stringify(sub.body)).toBe(200)
    const section = (await result(me, id)).result.sections.find((s) => s.chooseN === 1 && s.label.length > 0 && s.counted.some((q) => q.startsWith('sn2-')))
    // exactly ONE question of the two counts, whatever was ticked
    expect(section?.counted).toHaveLength(1)
    expect((await result(me, id)).attempt.picks).toEqual(picks)
  })
})

describe('R1-05.2: resume restores the saved answers, flags, picks and position', () => {
  it('another device reading the same sitting gets everything that was autosaved', async () => {
    const id = await startAttempt(me, PAPER.sainsK2, 'exam', true)
    const q = (await view(me, id)).questions.map((x) => x.id)
    const save = await me.put(`/api/bijak/attempts/${id}/answers`, {
      changes: [change(OSMOSIS_A, { text: 'Air melalui membran separa telap.' }, 2), change(SEL_B, { text: 'bahan terlarut' }, 1)],
      flags: [q[0]!],
      picks: { [SAINS_B]: ['sn2-osmosis'] },
      position: 2,
    })
    expect(save.status, JSON.stringify(save.body)).toBe(200)
    // a second login (another device) lists the open sitting and reads it
    const other = await loginAs(t, STUDENT)
    const info = (await other.get(`/api/bijak/papers/${PAPER.sainsK2}/in-progress`)).body.data
    expect(info.attemptId).toBe(id)
    const again = await other.post('/api/bijak/attempts', { paperId: PAPER.sainsK2, mode: 'exam' })
    expect(again.status).toBe(200)
    expect(again.body.data.attemptId).toBe(id)
    const v = await view(other, id)
    expect(v.attempt.status).toBe('in_progress')
    expect(v.attempt.answers[OSMOSIS_A]).toMatchObject({ answer: { text: 'Air melalui membran separa telap.' }, rev: 2 })
    expect(v.attempt.answers[SEL_B]).toMatchObject({ answer: { text: 'bahan terlarut' } })
    expect(v.attempt).toMatchObject({ flags: [q[0]!], picks: { [SAINS_B]: ['sn2-osmosis'] }, position: 2 })
  })
})

describe('R1-06.2: the band midpoint', () => {
  it('floor((from + to) / 2) of every band lies inside its range, and the server keeps that mark as sent (V2 midpointFor)', async () => {
    const id = await startAttempt(me, PAPER.sejK2, 'exam', true)
    const sub = await me.post(`/api/bijak/attempts/${id}/submit`, { idempotencyKey: 'band', changes: [change(SEJ_ESSAY_1, { text: 'Perlembagaan menjadi asas undang-undang negara.' })] })
    expect(sub.status, JSON.stringify(sub.body)).toBe(200)
    const part = (await result(me, id)).result.questions.flatMap((q) => q.parts).find((p) => p.partId === SEJ_ESSAY_1)!
    const bands = part.scheme.rubric?.bands ?? []
    expect(bands.length).toBeGreaterThan(1)
    for (const b of bands) {
      const from = Math.min(b.range[0], part.marks)
      const to = Math.min(b.range[1], part.marks)
      const mid = Math.floor((from + to) / 2) // the V2 rule the Semakan screen applies when a band is picked
      expect(mid).toBeGreaterThanOrEqual(from)
      expect(mid).toBeLessThanOrEqual(to)
      const r = BijakAttemptSelfMarkResultSchema.parse((await me.post(`/api/bijak/attempts/${id}/self-mark`, { partId: SEJ_ESSAY_1, mark: mid, band: b.name })).body.data)
      expect(r).toMatchObject({ awarded: mid, band: b.name })
    }
  })

  it('an odd-width band rounds DOWN, and the pupil can still adjust inside the range but not outside it', async () => {
    const id = await startAttempt(me, PAPER.sejK2, 'exam', true)
    await me.post(`/api/bijak/attempts/${id}/submit`, { idempotencyKey: 'band2', changes: [change(SEJ_ESSAY_1, { text: 'x' })] })
    const bands = (await result(me, id)).result.questions.flatMap((q) => q.parts).find((p) => p.partId === SEJ_ESSAY_1)!.scheme.rubric!.bands
    const baik = bands.find((b) => b.name === 'Baik')! // [6, 8] on 10 marks
    const mark = (n: number) => me.post(`/api/bijak/attempts/${id}/self-mark`, { partId: SEJ_ESSAY_1, mark: n, band: 'Baik' }).then((r) => BijakAttemptSelfMarkResultSchema.parse(r.body.data).awarded)
    expect(Math.floor((baik.range[0] + baik.range[1]) / 2)).toBe(7)
    expect(await mark(7)).toBe(7)
    expect(await mark(6)).toBe(6) // adjusted down inside the band
    expect(await mark(9)).toBe(8) // above the band: pulled into it
    expect(await mark(2)).toBe(6) // below the band: pulled into it
  })
})

describe('R1-06.5: an unmarked written part counts 0 and the result says it is pending', () => {
  it('the score and the Bahagian total leave it out, the attempt is provisional and counts it as pending review', async () => {
    const id = await startAttempt(me, PAPER.sainsK2, 'exam', true)
    // a written answer that matches no keyword is not stamped with a mark (V2 submit :408-414)
    const sub = await me.post(`/api/bijak/attempts/${id}/submit`, { idempotencyKey: 'pend', changes: [change(SEL_B, { text: 'tidak tahu langsung jawapannya' })] })
    expect(sub.status, JSON.stringify(sub.body)).toBe(200)
    const { result: r } = await result(me, id)
    const p = r.questions.flatMap((q) => q.parts).find((x) => x.partId === SEL_B)!
    expect(p).toMatchObject({ awarded: 0, status: 'belum_dimarkah' })
    expect(r.score).toBe(0)
    expect(r.provisional).toBe(true)
    expect(r.pendingReview).toBeGreaterThanOrEqual(1)
    const section = r.sections.find((s) => s.counted.some((q) => r.questions.find((x) => x.questionId === q)?.parts.some((x) => x.partId === SEL_B)))
    expect(section?.awarded).toBe(0)
    // marking it moves the score and clears one pending part
    const marked = BijakAttemptSelfMarkResultSchema.parse((await me.post(`/api/bijak/attempts/${id}/self-mark`, { partId: SEL_B, mark: 2 })).body.data)
    expect(marked.attemptScore).toBe(2)
    expect((await result(me, id)).result.pendingReview).toBe(r.pendingReview - 1)
  })
})
