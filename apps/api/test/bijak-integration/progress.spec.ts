/**
 * #45 M1 on the REAL wiring: BE-16's `BijakAttemptProgress` is bound to BE-15's `provideProgress` and
 * `provideServed` by `BijakIntegrationModule`. The papers list shows the in-progress attempt and the last
 * score, and Jana Kertas prefers questions the student has not been served yet.
 */
import { BijakPaperSummarySchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootIntegrationApp, type Client, type IntegrationApp, loginAs, STUDENT } from './helpers'

let t: IntegrationApp
let student: Client

beforeAll(async () => {
  t = await bootIntegrationApp()
  student = await loginAs(t, STUDENT)
})
afterAll(async () => {
  await t.close()
})

async function listed(code: string, kertas: number) {
  const res = await student.get('/api/bijak/papers')
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  const p = (res.body.data as unknown[]).map((x) => BijakPaperSummarySchema.parse(x)).find((x) => x.code === code && x.kertas === kertas)
  if (!p) throw new Error(`paper ${code} not listed`)
  return p
}

async function start(paperId: string): Promise<string> {
  const res = await student.post('/api/bijak/attempts', { paperId, mode: 'exam' })
  expect(res.status, JSON.stringify(res.body)).toBeLessThan(300)
  return (res.body as { data: { attemptId: string } }).data.attemptId
}

const submit = (attemptId: string, key: string) => student.post(`/api/bijak/attempts/${attemptId}/submit`, { idempotencyKey: key, changes: [] })

/** Question ids placed on a paper (`paper_placements` through its sections). */
const placed = async (paperId: string): Promise<string[]> =>
  (
    await t.db.query<{ question_id: string }>(
      `select pl.question_id::text as question_id
         from paper_placements pl join paper_sections s on s.id = pl.paper_section_id
        where s.paper_id = $1`,
      [paperId],
    )
  ).map((r) => r.question_id)

describe('papers list progress (BE-16 progress source bound to BE-15)', () => {
  it('belum -> sedang with the attemptId -> selesai with the last score -> sedang again keeping the last score', async () => {
    const before = await listed('1449/1', 1)
    expect(before.status).toBe('belum')
    expect(before.attemptId).toBeUndefined()
    expect(before.lastScore).toBeUndefined()

    const first = await start(before.id)
    const during = await listed('1449/1', 1)
    expect(during).toMatchObject({ status: 'sedang', attemptId: first })
    expect(during.lastScore).toBeUndefined()

    t.clock.advance(60_000)
    expect((await submit(first, 'progress-1')).status).toBe(200)
    const r = await student.get(`/api/bijak/attempts/${first}/result`)
    expect(r.status, JSON.stringify(r.body)).toBe(200)
    const { score, max } = (r.body as { data: { result: { score: number; max: number } } }).data.result
    const after = await listed('1449/1', 1)
    expect(after).toMatchObject({ status: 'selesai', lastScore: { score, max } })
    expect(after.attemptId).toBeUndefined()

    t.clock.advance(60_000)
    const second = await start(before.id)
    expect(second).not.toBe(first)
    expect(await listed('1449/1', 1)).toMatchObject({ status: 'sedang', attemptId: second, lastScore: { score, max } })
    expect((await submit(second, 'progress-2')).status).toBe(200)
  })
})

describe('Jana Kertas prefers unseen questions (BE-16 served source bound to BE-15)', () => {
  it('a second generated paper avoids every question served in the first sitting', async () => {
    t.clock.advance(60_000)
    const gen1 = await student.post('/api/bijak/papers/generate', { subject: 'MAT', kertas: 1 })
    expect(gen1.status, JSON.stringify(gen1.body)).toBe(201)
    const paper1 = (gen1.body as { data: { paperId: string } }).data.paperId
    const attemptId = await start(paper1)
    const servedIds = (
      await t.db.query<{ qid: string }>(
        `select distinct q.qid from exam_attempts a
           cross join lateral jsonb_array_elements(a.composition) s
           cross join lateral jsonb_array_elements_text(s -> 'questionIds') as q(qid)
          where a.id = $1`,
        [attemptId],
      )
    ).map((r) => r.qid)
    expect(servedIds.length).toBeGreaterThan(0)
    expect(new Set(servedIds)).toEqual(new Set(await placed(paper1)))
    expect((await submit(attemptId, 'jana-1')).status).toBe(200)

    t.clock.advance(60_000)
    const gen2 = await student.post('/api/bijak/papers/generate', { subject: 'MAT', kertas: 1 })
    expect(gen2.status, JSON.stringify(gen2.body)).toBe(201)
    const second = await placed((gen2.body as { data: { paperId: string } }).data.paperId)
    expect(second.length).toBeGreaterThan(0)
    expect(second.filter((id) => servedIds.includes(id))).toEqual([])
  })
})
