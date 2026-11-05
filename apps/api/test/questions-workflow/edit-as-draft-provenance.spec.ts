import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootWorkflowApp, loginAll, type Client, type WorkflowTestApp } from './helpers'

/**
 * REQ-C-012 / SEC-C012-1: `POST /api/questions/:id/edit-as-draft` makes version n+1 through the same carry-forward as an edit (REQ-B-017 / B-037),
 * so the declaration and provenance travel with the content. Asserted on all 15 provenance columns themselves. D99 (user, 2026-11-01) removed
 * the per-question rights refusal, so a question declared `unclear` is edited as a draft, submitted and approved again: the spec asserts the columns
 * only, not a refusal.
 */
const PROVENANCE = [
  'rights_status',
  'source_kind',
  'contributor_id',
  'year',
  'exam_type',
  'exam_board',
  'textbook_bab',
  'textbook_tingkatan',
  'textbook_page',
  'source_paper_id',
  'source_file_id',
  'source_region',
  'ai_run_id',
  'ai_model',
  'intake_item_id',
] as const

describe('edit as draft keeps the declaration and provenance (SEC-C012-1)', () => {
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
    cognitiveLevel: 'mengaplikasi',
    curriculumChapterId: tag.chapterId,
    options: ['4', '5', '6', '7'],
    correctAnswer: 1,
    tag: { unitId: tag.unitId, spIds: [tag.spId], tp: 3 },
    ...over,
  })
  const move = (id: string, to: string) => admin.post(`/api/questions/${id}/status`, { to })
  const columns = async (id: string, versionNo: number) =>
    (await t.db.query<Record<string, unknown>>(`select ${PROVENANCE.join(', ')} from question_versions where question_id = $1::bigint and version_no = $2`, [id, versionNo]))[0]!

  /** An approved question whose v1 declares `unclear` rights and has every provenance column set. */
  async function approvedWithProvenance(): Promise<string> {
    const res = await admin.post('/api/questions', body({ status: 'approved' }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const id = res.body.data.id as string
    await t.db.query(
      `update question_versions set chapter_id = $2::bigint, rights_status = 'unclear', source_kind = 'lpm_official', year = 2019, exam_type = 'sebenar', exam_board = 'LPM',
              textbook_bab = 3, textbook_tingkatan = 4, textbook_page = 17, source_region = '{"page":2,"box":[1,2,3,4]}'::jsonb, ai_model = 'model-contoh'
        where question_id = $1::bigint`,
      [id, tag.chapterId],
    )
    return id
  }

  it('v(n+1) is equal to v(n) on all 15 provenance columns, including rights unclear', async () => {
    const id = await approvedWithProvenance()
    const before = await columns(id, 1)
    expect(before.rights_status).toBe('unclear')
    for (const key of ['source_kind', 'year', 'exam_type', 'exam_board', 'textbook_bab', 'textbook_tingkatan', 'textbook_page', 'source_region', 'ai_model']) {
      expect(before[key], key).not.toBeNull() // the fixture sets these, so the equality below is not vacuous
    }
    const res = await admin.post(`/api/questions/${id}/edit-as-draft`)
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const after = await columns(id, 2)
    expect(Object.keys(after).sort()).toEqual([...PROVENANCE].sort())
    expect(after).toEqual(before)
  })

  it('a second round (v3 from the approved v2) still carries them', async () => {
    const id = await approvedWithProvenance()
    expect((await admin.post(`/api/questions/${id}/edit-as-draft`)).status).toBe(201)
    expect((await move(id, 'review')).status).toBe(200)
    expect((await move(id, 'approved')).status).toBe(200) // D99: no rights refusal for `unclear`
    expect((await admin.post(`/api/questions/${id}/edit-as-draft`)).status).toBe(201)
    expect(await columns(id, 3)).toEqual(await columns(id, 1))
  })
})
