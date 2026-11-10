/**
 * S1-T09a part 6b (46:612, FR-PA-25). The PER-PAPER Simulasi Kuiz serves `mcq_multi` (ticks sent together, marked by M-MULTI; nothing is stored).
 * The RANDOM quiz serves it too (D1, after S5 migration 0261): the check stores the comma-joined ticks in `selected_label` and the verdict in `is_correct`.
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

  it('[CI] the random quiz draws the ungrouped mcq_multi question, and the indicator says served and agrees with the draw', async () => {
    const s = await startBm()
    const multi = s.items.find((i) => i.id === multiId)
    expect(multi?.multiple).toBe(true)
    expect(s.items.some((i) => i.id === plainId)).toBe(true)
    expect(JSON.stringify(s)).not.toContain('correctOptionIds')
    const report = await t.app.get(ServabilityService).report(multiId)
    expect(report!.activities.find((a) => a.activity === 'simulasi_kuiz')!.served).toBe(true)
    expect(await t.app.get(QuestionsRepository).sampleIds(filterOf('simulasi_kuiz'), 20_000, 3)).toContain(multiId)
  })

  it('[CI] a random-quiz check on the mcq_multi stores the comma-joined ticks in selected_label and the all-ticks-right verdict in is_correct; optionId alone is 422', async () => {
    const stored = async (sessionId: string) =>
      (await t.db.query<{ selected_label: string; is_correct: boolean }>(`select selected_label, is_correct from practice_checks where session_id = $1::uuid and question_id = $2::bigint`, [sessionId, multiId]))[0]
    const wrong = await startBm()
    const post = (sid: string, body: object) => student.post(`/api/bijak/kuiz/sessions/${sid}/check`, { itemId: multiId, ...body })
    expect((await post(wrong.sessionId, { optionId: 'A' })).status).toBe(422)
    expect(await stored(wrong.sessionId)).toBeUndefined()
    const bad = await post(wrong.sessionId, { optionId: 'A', optionIds: ['A', 'C'] })
    expect(bad.status, JSON.stringify(bad.body)).toBe(200)
    expect(BijakKuizCheckResultSchema.parse(bad.body.data).correct).toBe(false)
    expect(await stored(wrong.sessionId)).toEqual({ selected_label: 'A,C', is_correct: false })
    // A repeat returns the stored verdict.
    expect(BijakKuizCheckResultSchema.parse((await post(wrong.sessionId, { optionId: 'A', optionIds: ['A', 'B'] })).body.data).correct).toBe(false)

    const right = await startBm()
    const good = await post(right.sessionId, { optionId: 'B', optionIds: ['B', 'A'] })
    expect(good.status, JSON.stringify(good.body)).toBe(200)
    const result = BijakKuizCheckResultSchema.parse(good.body.data)
    expect(result.correct).toBe(true)
    expect(result.correctOptionIds).toEqual(['A', 'B'])
    expect(await stored(right.sessionId)).toEqual({ selected_label: 'A,B', is_correct: true })
    expect(BijakKuizCheckResultSchema.parse((await post(right.sessionId, { optionId: 'C', optionIds: ['C'] })).body.data).correct).toBe(true)
  })

  it('[CI] finishing a random quiz regrades the mcq_multi row to the same score as the check, and records the question type mcq_multi', async () => {
    const run = async (ticks: string[]) => {
      const s = await startBm()
      const res = await student.post(`/api/bijak/kuiz/sessions/${s.sessionId}/check`, { itemId: multiId, optionId: ticks[0], optionIds: ticks })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const checked = BijakKuizCheckResultSchema.parse(res.body.data).correct
      const fin = await student.post(`/api/bijak/kuiz/sessions/${s.sessionId}/finish`, { timeSpent: 5 })
      expect(fin.status, JSON.stringify(fin.body)).toBe(200)
      return { checked, score: fin.body.data.score as number, total: fin.body.data.total as number, sessionId: s.sessionId }
    }
    const good = await run(['A', 'B'])
    expect(good).toMatchObject({ checked: true, score: 1 })
    const bad = await run(['A', 'C'])
    expect(bad).toMatchObject({ checked: false, score: 0 })
    const rows = await t.db.query<{ is_correct: boolean; question_type: string | null }>(
      `select a.is_correct, a.question_type from practice_answers a where a.session_id = $1::uuid and a.question_id = $2::bigint`,
      [good.sessionId, multiId],
    )
    expect(rows).toEqual([{ is_correct: true, question_type: 'mcq_multi' }])
  })

  it('[CI] the finished answer row of a multi check keeps the comma-joined ticks in practice_answers.selected_label (46:270, S5 0262)', async () => {
    const s = await startBm()
    expect((await student.post(`/api/bijak/kuiz/sessions/${s.sessionId}/check`, { itemId: multiId, optionId: 'A', optionIds: ['A', 'B'] })).status).toBe(200)
    expect((await student.post(`/api/bijak/kuiz/sessions/${s.sessionId}/finish`, { timeSpent: 5 })).status).toBe(200)
    const rows = await t.db.query<{ selected_label: string | null }>(`select selected_label from practice_answers where session_id = $1::uuid and question_id = $2::bigint`, [s.sessionId, multiId])
    expect(rows).toEqual([{ selected_label: 'A,B' }])
  })

  it('[CI] two concurrent random-quiz checks on the same mcq_multi item get the same verdict and leave one practice_checks row', async () => {
    const s = await startBm()
    const body = { itemId: multiId, optionId: 'A', optionIds: ['A', 'B'] }
    const [x, y] = await Promise.all([
      student.post(`/api/bijak/kuiz/sessions/${s.sessionId}/check`, body),
      student.post(`/api/bijak/kuiz/sessions/${s.sessionId}/check`, body),
    ])
    expect([x.status, y.status]).toEqual([200, 200])
    expect(BijakKuizCheckResultSchema.parse(x.body.data).correct).toBe(true)
    expect(BijakKuizCheckResultSchema.parse(y.body.data).correct).toBe(true)
    const rows = await t.db.query(`select 1 from practice_checks where session_id = $1::uuid and question_id = $2::bigint`, [s.sessionId, multiId])
    expect(rows).toHaveLength(1)
  })

  it('[CI] a GROUPED mcq_multi (a member of a stimulus group) is not drawn by the random quiz, and the indicator says shape_unsupported', async () => {
    const stim = (await t.db.query<{ id: string }>(`insert into stimuli (kind, label, body_ms) values ('passage', 'Petikan multi', 'Petikan untuk kumpulan.') returning id::text`))[0]!.id
    const groupId = (await t.db.query<{ id: string }>(`insert into stimulus_groups (scope) values ('section') returning id::text`))[0]!.id
    await t.db.query(`insert into stimulus_group_stimuli (group_id, stimulus_id, position) values ($1::bigint, $2::bigint, 1)`, [groupId, stim])
    await t.db.query(`update questions set group_id = $1::bigint, group_position = case id when $2::bigint then 1 else 2 end where id = any($3::bigint[])`, [groupId, multiId, [multiId, plainId]])
    try {
      const s = await startBm()
      expect(s.items.some((i) => i.id === multiId)).toBe(false)
      const kuiz = (await t.app.get(ServabilityService).report(multiId))!.activities.find((a) => a.activity === 'simulasi_kuiz')!
      expect(kuiz.served).toBe(false)
      expect(JSON.stringify(kuiz)).toContain('shape_unsupported')
      expect(await t.app.get(QuestionsRepository).sampleIds({ ...filterOf('simulasi_kuiz'), wholeGroups: true }, 20_000, 3)).not.toContain(multiId)
      expect(await t.app.get(QuestionsRepository).sampleIds(filterOf('simulasi_kuiz'), 20_000, 3)).not.toContain(multiId)
    } finally {
      await t.db.query(`update questions set group_id = null, group_position = null where id = any($1::bigint[])`, [[multiId, plainId]])
      await t.db.query(`delete from stimulus_group_stimuli where group_id = $1::bigint`, [groupId])
      await t.db.query(`delete from stimulus_groups where id = $1::bigint`, [groupId])
      await t.db.query(`delete from stimuli where id = $1::bigint`, [stim])
    }
  })
})
