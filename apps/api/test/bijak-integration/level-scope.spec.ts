/**
 * S3-T02, PO decision 2026-11-05 item 6, on the real wiring (auth + BijakIntegrationModule): a pupil reaches only the papers of their own Tingkatan, on every path that
 * reads a paper: list, cover, attempt, kuiz page and kuiz check (the last hands out the answer key). Each refusal has a positive control through the same route.
 */
import { BijakKuizCheckResultSchema, BijakKuizPaperPageSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootIntegrationApp, type Client, type IntegrationApp, loginAs, START, STUDENT } from './helpers'

let t: IntegrationApp
/** Tingkatan 5. */
let t5: Client
/** Tingkatan 4. */
let t4: Client
let question: string

const setGrade = (who: Client, grade: number | null) => t.db.query(`update users set grade = $1 where id = $2`, [grade, BigInt(who.userId)])

async function paper(title: string, levelScope: string | null, opts: { kind?: string; owner?: string } = {}): Promise<string> {
  const subject = await t.db.prisma.subject.findFirstOrThrow({ where: { code: 'MATH' } })
  const row = await t.db.prisma.paper.create({
    data: {
      kind: opts.kind ?? 'pilihan',
      title,
      subjectId: subject.id,
      kertas: 1,
      paperCode: '1449/1',
      printedDurationMin: 60,
      status: 'published',
      publishedAt: new Date(START),
      levelScope,
      ...(opts.owner ? { generatedForUserId: BigInt(opts.owner) } : {}),
      sections: { create: [{ position: 1, label: 'Bahagian A', questionCount: 1, markBudget: 1, placements: { create: [{ questionId: BigInt(question), position: 1 }] } }] },
    },
  })
  return row.id.toString()
}
const listed = async (who: Client): Promise<string[]> => ((await who.get('/api/bijak/papers')).body.data as { id: string }[]).map((p) => p.id)
const start = (who: Client, paperId: string, restart = false) => who.post('/api/bijak/attempts', { paperId, mode: 'exam', ...(restart ? { restart } : {}) })
const kuizPage = (who: Client, id: string) => who.get(`/api/bijak/kuiz/papers/${id}`)

beforeAll(async () => {
  t = await bootIntegrationApp()
  t5 = await loginAs(t, STUDENT)
  t4 = await loginAs(t, 'pelajarmaju@demo.test')
  await setGrade(t5, 11)
  await setGrade(t4, 10)
  const rows = await t.db.query<{ id: string }>(
    `select q.id::text as id from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no where v.number_label = 'SEED-MCQ-MATH-T5'`,
  )
  question = rows[0]!.id
}, 180_000)
afterAll(async () => {
  await t.close()
})

describe('a Tingkatan 5 paper', () => {
  let id: string
  beforeAll(async () => {
    id = await paper('Kertas skop T5', 't5')
  })

  it('in scope: list, cover, attempt, kuiz page and check all answer', async () => {
    expect(await listed(t5)).toContain(id)
    expect((await t5.get(`/api/bijak/papers/${id}`)).status).toBe(200)
    const page = await kuizPage(t5, id)
    expect(page.status, JSON.stringify(page.body)).toBe(200)
    const item = BijakKuizPaperPageSchema.parse(page.body.data).items[0]!
    const check = await t5.post(`/api/bijak/kuiz/papers/${id}/check`, { itemId: item.id, optionId: item.options[0]!.id })
    expect(check.status, JSON.stringify(check.body)).toBe(200)
    expect(BijakKuizCheckResultSchema.parse(check.body.data).correctOptionId).toBeTruthy()
    const started = await start(t5, id)
    expect(started.status, JSON.stringify(started.body)).toBe(201)
  })

  it('out of scope: 404 on every path, the same as a paper that does not exist, and no sitting is written', async () => {
    expect(await listed(t4)).not.toContain(id)
    const unknown = '987654321'
    for (const target of [id, unknown]) {
      expect((await t4.get(`/api/bijak/papers/${target}`)).status, `cover ${target}`).toBe(404)
      expect((await start(t4, target)).status, `attempt ${target}`).toBe(404)
      expect((await kuizPage(t4, target)).status, `kuiz ${target}`).toBe(404)
      const check = await t4.post(`/api/bijak/kuiz/papers/${target}/check`, { itemId: question, optionId: 'A' })
      expect(check.status, `check ${target}`).toBe(404)
      expect(JSON.stringify(check.body)).not.toContain('correctOptionId')
    }
    expect(await t.db.query(`select 1 from exam_attempts where user_id = $1 and paper_id = $2`, [BigInt(t4.userId), BigInt(id)])).toEqual([])
    // A refused attempt does not unlock the list or the cover through the has-a-sitting rule.
    expect(await listed(t4)).not.toContain(id)
    expect((await t4.get(`/api/bijak/papers/${id}`)).status).toBe(404)
  })

  it('t4_t5 opens to both forms; t4 to the other form only', async () => {
    const both = await paper('Kertas skop T4 T5', 't4_t5')
    const four = await paper('Kertas skop T4', 't4')
    for (const who of [t4, t5]) expect((await kuizPage(who, both)).status).toBe(200)
    expect((await kuizPage(t4, four)).status).toBe(200)
    expect((await kuizPage(t5, four)).status).toBe(404)
    expect((await start(t5, four)).status).toBe(404)
  })

  it('a stored null scope and a generated paper are not restricted', async () => {
    const open = await paper('Kertas tanpa skop', null)
    expect((await kuizPage(t4, open)).status).toBe(200)
    const jana = await paper('Kertas jana', 't5', { kind: 'jana', owner: t4.userId })
    expect((await kuizPage(t4, jana)).status).toBe(200)
    expect((await t4.get(`/api/bijak/papers/${jana}`)).status).toBe(200)
  })
})

describe('a sitting already on a paper outside the Tingkatan', () => {
  it('resumes and stays reachable, and no new sitting starts', async () => {
    const id = await paper('Kertas sitting lama', 't5')
    await setGrade(t4, 11)
    const started = await start(t4, id)
    expect(started.status, JSON.stringify(started.body)).toBe(201)
    const attemptId = started.body.data.attemptId as string
    await setGrade(t4, 10) // the pupil's Tingkatan changes while the sitting is open
    try {
      const resumed = await start(t4, id)
      expect(resumed.status, JSON.stringify(resumed.body)).toBeLessThan(300)
      expect(resumed.body.data.attemptId).toBe(attemptId)
      expect(await listed(t4)).toContain(id)
      expect((await t4.get(`/api/bijak/papers/${id}`)).status).toBe(200)
      expect((await start(t4, id, true)).status).toBe(403)
    } finally {
      await setGrade(t4, 10)
    }
  })
})
