/**
 * S3-T07, AC-PA-36 clause (b), ruling 4 on issue #443 [CI]: a curated paper outside the pupil's form (`papers.level_scope`) is a 404 for
 * a NEW sitting on every path (attempt start, `getSittablePaper`, both Kuiz routes), but a pupil's OWN open sitting on it still resumes
 * (a re-scoped or promoted pupil keeps the card), on the real wiring.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PapersService } from '../../src/modules/bijak/papers'
import { bootIntegrationApp, type Client, type IntegrationApp, loginAs, START, STUDENT } from './helpers'

let t: IntegrationApp
let student: Client
let questionId: string

beforeAll(async () => {
  t = await bootIntegrationApp()
  student = await loginAs(t, STUDENT)
  const rows = await t.db.query<{ id: string }>(
    `select q.id::text as id from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no
      where v.number_label = 'SEED-MCQ-MATH-T4'`,
  )
  questionId = rows[0]!.id
}, 180_000)
afterAll(async () => {
  await t.close()
})

const setGrade = (grade: number) => t.db.query(`update users set grade = $1 where id = $2`, [grade, student.userId])
async function createPaper(levelScope: string | null): Promise<string> {
  const subject = await t.db.prisma.subject.findFirstOrThrow({ where: { code: 'MATH' } })
  const paper = await t.db.prisma.paper.create({
    data: {
      kind: 'pilihan',
      title: `Kertas skop ${levelScope ?? 'semua'}`,
      subjectId: subject.id,
      kertas: 2,
      paperCode: '1449/2',
      printedDurationMin: 60,
      status: 'published',
      publishedAt: new Date(START),
      levelScope,
      sections: {
        create: [{ position: 1, label: 'A', questionCount: 1, markBudget: 0, placements: { create: [{ questionId: BigInt(questionId), position: 1 }] } }],
      },
    },
  })
  return paper.id.toString()
}
const startSitting = (paperId: string, extra: Record<string, unknown> = {}) => student.post('/api/bijak/attempts', { paperId, mode: 'exam', ...extra })
const sittable = (paperId: string) => t.app.get(PapersService).getSittablePaper(student.userId, paperId)
const kuizPage = (paperId: string) => student.get(`/api/bijak/kuiz/papers/${paperId}`)
const kuizCheck = (paperId: string) => student.post(`/api/bijak/kuiz/papers/${paperId}/check`, { itemId: questionId, optionId: 'A' })

describe('level_scope: new sitting 404, own open sitting resumes (S3-T07, AC-PA-36 b, ruling 4) [CI]', () => {
  it('a hidden (out-of-scope) paper is 404 for a new sitting, a restart, getSittablePaper and both Kuiz routes', async () => {
    await setGrade(9)
    const hidden = await createPaper('t5')
    const res = await startSitting(hidden)
    expect(res.status, JSON.stringify(res.body)).toBe(404)
    expect((await startSitting(hidden, { restart: true })).status).toBe(404)
    await expect(sittable(hidden)).rejects.toMatchObject({ status: 404 })
    expect((await kuizPage(hidden)).status).toBe(404)
    expect((await kuizCheck(hidden)).status).toBe(404)
  })

  it('an in-scope paper starts and opens on every path', async () => {
    await setGrade(11)
    const visible = await createPaper('t5')
    expect((await startSitting(visible)).status).toBe(201)
    expect((await sittable(visible)).id).toBe(visible)
    expect((await kuizPage(visible)).status).toBe(200)
    expect([200, 422]).toContain((await kuizCheck(visible)).status)
  })

  it('a re-scoped or promoted pupil resumes the own open sitting (200, same attempt); restart and other pupils stay 404', async () => {
    await setGrade(11)
    const paperId = await createPaper('t5')
    const first = await startSitting(paperId)
    expect(first.status, JSON.stringify(first.body)).toBe(201)
    const attemptId = (first.body as { data: { attemptId: string } }).data.attemptId

    // Re-scoped: the paper now excludes T5.
    await t.db.query(`update papers set level_scope = 't4' where id = $1`, [paperId])
    const resumed = await startSitting(paperId)
    expect(resumed.status, JSON.stringify(resumed.body)).toBe(200)
    expect((resumed.body as { data: { attemptId: string } }).data.attemptId).toBe(attemptId)
    expect((await kuizPage(paperId)).status).toBe(200)
    expect((await sittable(paperId)).id).toBe(paperId)

    // A restart is a new sitting: refused, and the open one is left alone.
    expect((await startSitting(paperId, { restart: true })).status).toBe(404)
    expect((await student.get(`/api/bijak/papers/${paperId}/in-progress`)).status).toBe(200)

    // Promoted instead: the pupil moves out of the form; same result.
    await t.db.query(`update papers set level_scope = 't5' where id = $1`, [paperId])
    await setGrade(10)
    expect((await startSitting(paperId)).status).toBe(200)

    // Once the sitting is abandoned nothing is open: back to 404 everywhere.
    expect((await student.post(`/api/bijak/attempts/${attemptId}/abandon`)).status).toBeLessThan(300)
    expect((await startSitting(paperId)).status).toBe(404)
    expect((await kuizPage(paperId)).status).toBe(404)
  })
})

describe('cover `kuizAvailable` follows the Kuiz rule (S3-T07, AC-PA-36 b) [CI]', () => {
  const cover = async (paperId: string) => (await student.get(`/api/bijak/papers/${paperId}`)).body.data as { kuizAvailable?: boolean }

  it('is absent in scope, false out of scope with no open sitting, absent again with an own open sitting', async () => {
    await setGrade(11)
    const paperId = await createPaper('t5')
    expect((await cover(paperId)).kuizAvailable).toBeUndefined()
    const first = await startSitting(paperId)
    const attemptId = (first.body as { data: { attemptId: string } }).data.attemptId
    await t.db.query(`update papers set level_scope = 't4' where id = $1`, [paperId])
    expect((await cover(paperId)).kuizAvailable).toBeUndefined()
    // Sitting submitted: the cover stays (result, Semakan) but the Kuiz action goes.
    expect((await student.post(`/api/bijak/attempts/${attemptId}/submit`, { idempotencyKey: 'level-scope-cover', changes: [] })).status).toBeLessThan(300)
    const body = await cover(paperId)
    expect(body.kuizAvailable).toBe(false)
    expect((await kuizPage(paperId)).status).toBe(404)
  })
})
