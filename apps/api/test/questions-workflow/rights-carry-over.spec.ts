import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { GATE_MESSAGES } from '../../src/modules/questions/workflow/lifecycle/gates'
import { bootWorkflowApp, loginAll, type Client, type WorkflowTestApp } from './helpers'

/**
 * REQ-B-017: a new version made by editing an approved question keeps the declaration and provenance of the version it came from. Before, the
 * new version had rights_status NULL, which the approve gate reads as `own`: one edit of a question declared `unclear` skipped the rights rule.
 */
describe('editing keeps the rights declaration and provenance (REQ-B-017)', () => {
  let t: WorkflowTestApp
  let admin: Client
  let tag: { subjectId: string; levelId: string; unitId: string; spId: string; chapterId: string }

  beforeAll(async () => {
    t = await bootWorkflowApp({ bank: 'real', env: { THROTTLE_QUESTIONS_WRITE_PER_MINUTE: '100000' } })
    admin = (await loginAll(t)).admin
    const [row] = await t.db.query<{ subject_id: string; education_level_id: string; unit_node_id: string; sp: string }>(
      `select v.subject_id::text, v.education_level_id::text, v.unit_node_id::text,
              (select node_id::text from question_version_sp_nodes where question_version_id = v.id limit 1) as sp
         from question_versions v where v.number_label = 'SEED-MCQ-MATH-T4'`,
    )
    const [ch] = await t.db.query<{ id: string }>('select id::text from chapters where subject_id = $1::bigint and education_level_id = $2::bigint limit 1', [row!.subject_id, row!.education_level_id])
    tag = { subjectId: row!.subject_id, levelId: row!.education_level_id, unitId: row!.unit_node_id, spId: row!.sp, chapterId: ch!.id }
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
  const move = (id: string, to: string) => admin.post(`/api/questions/${id}/status`, { to })
  const columns = async (id: string, versionNo: number) =>
    (
      await t.db.query<Record<string, unknown>>(
        `select rights_status, source_kind, year, exam_type, exam_board, textbook_bab, textbook_tingkatan, textbook_page, ai_model from question_versions where question_id = $1::bigint and version_no = $2`,
        [id, versionNo],
      )
    )[0]!

  /** An approved question whose v1 declares `unclear` rights (a legacy import), then edited into a draft v2. */
  async function editedFromUnclear(): Promise<string> {
    const res = await admin.post('/api/questions', body({ status: 'approved' }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const id = res.body.data.id as string
    await t.db.query('update question_versions set chapter_id = $1::bigint where question_id = $2::bigint', [tag.chapterId, id])
    await t.db.query(
      `update question_versions set rights_status = 'unclear', source_kind = 'lpm_official', year = 2019, exam_type = 'sebenar', exam_board = 'LPM', textbook_bab = 3, textbook_tingkatan = 4, textbook_page = 17, ai_model = 'model-contoh' where question_id = $1::bigint`,
      [id],
    )
    const edit = await admin.put(`/api/questions/${id}`, body({ questionText: 'Berapakah hasil tambah empat dan lima?' }))
    expect(edit.status, JSON.stringify(edit.body)).toBe(200)
    return id
  }

  it('the new version carries the rights declaration and the provenance columns of the one it was made from', async () => {
    const id = await editedFromUnclear()
    expect(await columns(id, 2)).toEqual(await columns(id, 1))
    expect((await columns(id, 2)).rights_status).toBe('unclear')
  })

  it('v1 unclear -> edit (v2 draft) -> submit -> Terbit is still refused with fields.rightsStatus, in a single transition and in bulk', async () => {
    const id = await editedFromUnclear()
    expect((await move(id, 'review')).status).toBe(200)
    const single = await move(id, 'approved')
    expect(single.status, JSON.stringify(single.body)).toBe(422)
    expect(single.body.error.fields.rightsStatus).toBe(GATE_MESSAGES.rights)
    const bulk = (await admin.post('/api/questions/bulk-action', { action: 'approved', ids: [id] })).body.data
    expect(bulk.affected).toBe(0)
    expect(bulk.failed[0]).toMatchObject({ id, code: 'VALIDATION_ERROR', fields: { rightsStatus: GATE_MESSAGES.rights } })
    // the declaration is read from the version being approved: once the person declares the rights on v2, it passes
    await t.db.query(`update question_versions set rights_status = 'own' where question_id = $1::bigint and version_no = 2`, [id])
    expect((await move(id, 'approved')).status).toBe(200)
  })

  it('a question with no declaration stays undeclared (null counts as own) and keeps going through', async () => {
    const res = await admin.post('/api/questions', body({ status: 'approved' }))
    const id = res.body.data.id as string
    await t.db.query('update question_versions set chapter_id = $1::bigint where question_id = $2::bigint', [tag.chapterId, id])
    expect((await admin.put(`/api/questions/${id}`, body({ questionText: 'Berapakah hasil tambah enam dan tujuh?' }))).status).toBe(200)
    expect((await columns(id, 2)).rights_status).toBeNull()
    expect((await move(id, 'review')).status).toBe(200)
    expect((await move(id, 'approved')).status).toBe(200)
  })
})
