/**
 * S1-T09a part 6b (46:612, FR-PA-25). The PER-PAPER Simulasi Kuiz serves `mcq_multi` (ticks sent together, marked by M-MULTI; nothing is stored).
 * The RANDOM quiz does not yet: it stores one letter per check (`practice_checks.selected_label` NOT NULL, `^[A-H]$`), waiting for the S5 migration.
 */
import { BijakKuizCheckResultSchema, BijakKuizPaperPageSchema, BijakKuizSessionSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionsRepository } from '../../src/modules/questions'
import { ServabilityService, filterOf } from '../../src/modules/questions/serving'
import { bootIntegrationApp, type Client, type IntegrationApp, loginAs, START, STUDENT } from '../bijak-integration/helpers'

process.env.THROTTLE_BIJAK_KUIZ_START_PER_MINUTE = '60'

let t: IntegrationApp
let student: Client
let multiId = ''
let plainId = ''
let paperId = ''

const idOf = async (ref: string): Promise<string> =>
  (
    await t.db.query<{ id: string }>(
      `select q.id::text as id from questions q join question_versions v on v.question_id = q.id and v.version_no = q.latest_version_no where v.number_label = $1`,
      [ref],
    )
  )[0]!.id

beforeAll(async () => {
  t = await bootIntegrationApp()
  student = await loginAs(t, STUDENT)
  multiId = await idOf('SEED-MCQ-BM-T4')
  plainId = await idOf('SEED-MCQ-BM-T5')
  // SEED-MCQ-BM-T4 becomes an mcq_multi question with the correct options A and B (a plain MCQ leaf stays leaf mode `mcq`).
  await t.db.query(`update question_versions v set type = 'mcq_multi' from questions q where q.id = $1::bigint and v.question_id = q.id`, [multiId])
  await t.db.query(
    `update answer_keys k set kind = 'options', content = '{"kind":"options","correctOptionIds":["A","B"]}'::jsonb
       from question_parts p join questions q on q.id = $1::bigint join question_versions v on v.question_id = q.id and v.id = p.question_version_id
      where k.part_id = p.id`,
    [multiId],
  )
  await t.db.query(
    `update question_parts p set mode_config = '{"multi":true}'::jsonb
       from questions q join question_versions v on v.question_id = q.id where q.id = $1::bigint and p.question_version_id = v.id`,
    [multiId],
  )
  const subject = await t.db.prisma.subject.findFirstOrThrow({ where: { code: 'BM' } })
  const paper = await t.db.prisma.paper.create({
    data: {
      kind: 'pilihan',
      title: 'Kertas pelbagai jawapan',
      subjectId: subject.id,
      kertas: 1,
      paperCode: '1449/1',
      printedDurationMin: 60,
      status: 'published',
      publishedAt: new Date(START),
      sections: {
        create: [
          {
            position: 1,
            label: 'A',
            instruction: 'Jawab semua soalan.',
            questionCount: 2,
            markBudget: 0,
            placements: { create: [{ questionId: BigInt(multiId), position: 1 }, { questionId: BigInt(plainId), position: 2 }] },
          },
        ],
      },
    },
  })
  paperId = paper.id.toString()
}, 180_000)
afterAll(async () => {
  await t.close()
})

const startBm = async () => {
  const res = await student.post('/api/bijak/kuiz/sessions', { subject: 'BM', count: 5 })
  expect(res.status, JSON.stringify(res.body)).toBe(201)
  return BijakKuizSessionSchema.parse(res.body.data)
}
const check = (itemId: string, optionIds: string[]) => student.post(`/api/bijak/kuiz/papers/${paperId}/check`, { itemId, optionId: optionIds[0], optionIds })
const verdictOf = async (optionIds: string[]) => {
  const res = await check(multiId, optionIds)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return BijakKuizCheckResultSchema.parse(res.body.data)
}

describe('mcq_multi in the Simulasi Kuiz', () => {
  it('[CI] the per-paper kuiz serves the mcq_multi item, flagged `multiple`; the plain MCQ is unchanged', async () => {
    const res = await student.get(`/api/bijak/kuiz/papers/${paperId}?page=1`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const items = BijakKuizPaperPageSchema.parse(res.body.data).items
    const multi = items.find((i) => i.id === multiId)!
    expect(multi.multiple).toBe(true)
    expect(multi.markable).toBe(true)
    expect(items.find((i) => i.id === plainId)!.multiple).toBeUndefined()
    expect(JSON.stringify(res.body)).not.toContain('correctOptionIds')
  })

  it('[CI] a multi-tick check is marked by M-MULTI: all correct is right; a wrong, partial or every-option tick is wrong', async () => {
    const good = await verdictOf(['A', 'B'])
    expect(good.correct).toBe(true)
    expect(good.correctOptionIds).toEqual(['A', 'B'])
    expect((await verdictOf(['A', 'C'])).correct).toBe(false)
    expect((await verdictOf(['A'])).correct).toBe(false)
    // Ticking every option scores 0 (M-MULTI), even though the correct ones are among them.
    expect((await verdictOf(['A', 'B', 'C', 'D'])).correct).toBe(false)
    // A single-choice question still takes `optionId` alone.
    const single = await student.post(`/api/bijak/kuiz/papers/${paperId}/check`, { itemId: plainId, optionId: 'A' })
    expect(single.status).toBe(200)
  })

  it('[CI] an mcq_multi check that sends only `optionId` is refused (422 Jawapan tidak sah): the ticks must be sent together as `optionIds`', async () => {
    const res = await student.post(`/api/bijak/kuiz/papers/${paperId}/check`, { itemId: multiId, optionId: 'A' })
    expect(res.status).toBe(422)
    const unknown = await check(multiId, ['A', 'Z'])
    expect(unknown.status).toBe(422)
  })

  it('[CI] the random quiz does not draw the mcq_multi question yet, and the indicator says so', async () => {
    const s = await startBm()
    expect(s.items.some((i) => i.id === multiId)).toBe(false)
    expect(s.items.some((i) => i.id === plainId)).toBe(true)
    const report = await t.app.get(ServabilityService).report(multiId)
    expect(report!.activities.find((a) => a.activity === 'simulasi_kuiz')!.served).toBe(false)
    expect(await t.app.get(QuestionsRepository).sampleIds(filterOf('simulasi_kuiz'), 20_000, 3)).not.toContain(multiId)
  })
})
