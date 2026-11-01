import { QuestionBulkResultSchema, mutationEnvelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootWorkflowApp, expectError, loginAll, type Client, type WorkflowTestApp } from './helpers'

const GATE_RIGHTS = 'Sila isi pengisytiharan hak cipta (bukan "belum jelas").'

/**
 * R1-T33 / B3 (BE-09 bulk approve): `POST /questions/bulk-action` with `approved`, and a question created already approved, run the SAME
 * merged approve gate as `POST /questions/:id/status` (rights, DSKP-complete, tag, keys). Failures are per-row `failed` entries; the rest go through.
 */
describe('bulk approve and create-as-approved run the merged approve gate (real bank)', () => {
  let t: WorkflowTestApp
  let admin: Client
  let tag: { subjectId: string; levelId: string; unitId: string; spId: string }

  beforeAll(async () => {
    t = await bootWorkflowApp({ bank: 'real', env: { THROTTLE_QUESTIONS_WRITE_PER_MINUTE: '100000' } })
    admin = (await loginAll(t)).admin
    const [row] = await t.db.query<{ subject_id: string; education_level_id: string; unit_node_id: string; sp: string }>(
      `select v.subject_id::text, v.education_level_id::text, v.unit_node_id::text,
              (select node_id::text from question_version_sp_nodes where question_version_id = v.id limit 1) as sp
         from question_versions v where v.number_label = 'SEED-MCQ-MATH-T4'`,
    )
    tag = { subjectId: row!.subject_id, levelId: row!.education_level_id, unitId: row!.unit_node_id, spId: row!.sp }
  })
  afterAll(async () => {
    await t.close()
  })

  const body = (over: Record<string, unknown> = {}) => ({
    questionType: 'mcq',
    questionText: 'Berapakah hasil tambah dua dan tiga?',
    subjectId: tag.subjectId,
    educationLevelId: tag.levelId,
    difficultyLevel: 2,
    options: ['4', '5', '6', '7'],
    correctAnswer: 1,
    tag: { unitId: tag.unitId, spIds: [tag.spId], tp: 3 },
    ...over,
  })
  /** A question in Semakan. */
  async function review(over: Record<string, unknown> = {}): Promise<string> {
    const res = await admin.post('/api/questions', body({ status: 'review', ...over }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body.data.id as string
  }
  const bulk = async (ids: string[]) => {
    const res = await admin.post('/api/questions/bulk-action', { action: 'approved', ids })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return mutationEnvelopeOf(QuestionBulkResultSchema).parse(res.body).data
  }
  const statusOf = async (id: string) => (await t.db.query<{ status: string }>(`select status from question_versions where question_id = $1::bigint`, [id]))[0]!.status

  it('an unclear-rights question is refused with the BM rights message; a valid one in the same batch passes', async () => {
    const [bad, good] = [await review(), await review()] as [string, string]
    await t.db.query(`update question_versions set rights_status = 'unclear' where question_id = $1::bigint`, [bad])
    const out = await bulk([bad, good])
    expect(out.affected).toBe(1)
    expect(out.failed).toHaveLength(1)
    expect(out.failed[0]).toMatchObject({ id: bad, code: 'VALIDATION_ERROR', fields: { rightsStatus: GATE_RIGHTS } })
    expect(out.failed[0]!.message).toContain(GATE_RIGHTS)
    expect(await statusOf(bad)).toBe('review')
    expect(await statusOf(good)).toBe('approved')
  })

  describe('an SPM-bound subject (MATH, Tingkatan 4)', () => {
    beforeAll(async () => {
      await t.db.query(`insert into spm_subject_configs (subject_id, grp, display_order) values ($1::bigint, 'teras', 1) on conflict do nothing`, [tag.subjectId])
    })

    it('a DSKP-incomplete question (no cognitive level, no kertas) is refused per row; a complete one passes', async () => {
      const incomplete = await review()
      const complete = await review({ cognitiveLevel: 'menganalisis', kertas: '1' })
      const out = await bulk([incomplete, complete])
      expect(out.affected).toBe(1)
      expect(out.failed).toHaveLength(1)
      expect(out.failed[0]).toMatchObject({
        id: incomplete,
        code: 'VALIDATION_ERROR',
        fields: { 'parts.1.cognitiveLevel': 'Bahagian (1) belum ada aras pemikiran.', kertas: 'Sila pilih kertas untuk soalan SPM.' },
      })
      expect(await statusOf(incomplete)).toBe('review')
      expect(await statusOf(complete)).toBe('approved')
    })

    it('creating a question already approved runs the same gate: incomplete is 422 and nothing is stored; complete is 201 and live', async () => {
      const before = Number((await t.db.query<{ n: string }>('select count(*)::text n from questions'))[0]!.n)
      const refused = await admin.post('/api/questions', body({ status: 'approved' }))
      const err = expectError(refused, 'VALIDATION_ERROR')
      expect(err.fields).toMatchObject({ kertas: 'Sila pilih kertas untuk soalan SPM.' })
      expect(Number((await t.db.query<{ n: string }>('select count(*)::text n from questions'))[0]!.n)).toBe(before)
      const ok = await admin.post('/api/questions', body({ status: 'approved', cognitiveLevel: 'mengaplikasi', kertas: '2' }))
      expect(ok.status, JSON.stringify(ok.body)).toBe(201)
      expect(await statusOf(ok.body.data.id as string)).toBe('approved')
    })
  })
})
