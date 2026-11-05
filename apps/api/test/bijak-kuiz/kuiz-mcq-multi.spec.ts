/** S1-T09a part 6b (46:612, FR-PA-25): `mcq_multi` is served in the Simulasi Kuiz; the ticks are sent together and marked by M-MULTI. */
import { BijakKuizCheckResultSchema, BijakKuizSessionSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionsRepository } from '../../src/modules/questions'
import { ServabilityService, filterOf } from '../../src/modules/questions/serving'
import { bootIntegrationApp, type Client, type IntegrationApp, loginAs, STUDENT } from '../bijak-integration/helpers'

process.env.THROTTLE_BIJAK_KUIZ_START_PER_MINUTE = '60'

let t: IntegrationApp
let student: Client
let multiId = ''
let plainId = ''

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
}, 180_000)
afterAll(async () => {
  await t.close()
})

const startBm = async () => {
  const res = await student.post('/api/bijak/kuiz/sessions', { subject: 'BM', count: 5 })
  expect(res.status, JSON.stringify(res.body)).toBe(201)
  return BijakKuizSessionSchema.parse(res.body.data)
}
const check = (sessionId: string, itemId: string, optionIds: string[]) =>
  student.post(`/api/bijak/kuiz/sessions/${sessionId}/check`, { itemId, optionId: optionIds[0], optionIds })

describe('Simulasi Kuiz serves mcq_multi', () => {
  it('[CI] a kuiz draw includes the mcq_multi question, flagged `multiple`; a plain MCQ is unchanged', async () => {
    const s = await startBm()
    const multi = s.items.find((i) => i.id === multiId)
    expect(multi).toBeDefined()
    expect(multi!.multiple).toBe(true)
    expect(multi!.markable).toBe(true)
    const plain = s.items.find((i) => i.id === plainId)!
    expect(plain.multiple).toBeUndefined()
    expect(JSON.stringify(s)).not.toContain('correctOptionIds')
  })

  it('[CI] a multi-tick submit is marked by M-MULTI: all correct is right, a wrong or partial tick is not', async () => {
    const s = await startBm()
    const ok = await check(s.sessionId, multiId, ['A', 'B'])
    expect(ok.status, JSON.stringify(ok.body)).toBe(200)
    const good = BijakKuizCheckResultSchema.parse(ok.body.data)
    expect(good.correct).toBe(true)
    expect(good.correctOptionIds).toEqual(['A', 'B'])
    // A repeat returns the stored verdict.
    expect(BijakKuizCheckResultSchema.parse((await check(s.sessionId, multiId, ['C'])).body.data).correct).toBe(true)

    const s2 = await startBm()
    expect(BijakKuizCheckResultSchema.parse((await check(s2.sessionId, multiId, ['A', 'C'])).body.data).correct).toBe(false)
    const s3 = await startBm()
    expect(BijakKuizCheckResultSchema.parse((await check(s3.sessionId, multiId, ['A'])).body.data).correct).toBe(false)
    const s4 = await startBm()
    expect((await check(s4.sessionId, multiId, ['A', 'Z'])).status).toBe(422)
    // A single-choice question still takes `optionId` alone.
    const single = await student.post(`/api/bijak/kuiz/sessions/${s4.sessionId}/check`, { itemId: plainId, optionId: 'A' })
    expect(single.status).toBe(200)
  })

  it('[CI] the indicator matches the draw: simulasi_kuiz serves the mcq_multi question', async () => {
    const report = await t.app.get(ServabilityService).report(multiId)
    expect(report!.activities.find((a) => a.activity === 'simulasi_kuiz')!.served).toBe(true)
    const drawn = await t.app.get(QuestionsRepository).sampleIds(filterOf('simulasi_kuiz'), 20_000, 3)
    expect(drawn).toContain(multiId)
  })
})
