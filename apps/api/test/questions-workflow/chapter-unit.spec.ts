import { CHAPTER_UNIT_MISMATCH_MESSAGE } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootWorkflowApp, loginAll, type Client, type WorkflowTestApp } from './helpers'

/**
 * G-02 (gap analysis 8 Nov): the Tajuk DSKP (unit) and the Bab of a question must be able to belong together. A Bab 7 question with
 * unit 2.0 was saved and then missing from Soalan by Chapter. The link is read from the printed numbers (`unitsOfChapter`) and only
 * where it is certain; a Bab with no known link never refuses a unit. Real bank, real routes.
 */
describe('G-02: Bab and Tajuk DSKP', () => {
  let t: WorkflowTestApp
  let c: Record<'admin' | 'teacher' | 'otherTeacher' | 'schoolAdmin' | 'student', Client>
  let tag: { subjectId: string; levelId: string; unitId: string; spId: string; unitCode: string }
  let otherUnitCode: string

  beforeAll(async () => {
    t = await bootWorkflowApp({ bank: 'real', env: { THROTTLE_QUESTIONS_WRITE_PER_MINUTE: '100000' } })
    c = await loginAll(t)
    const [row] = await t.db.query<{ subject_id: string; education_level_id: string; unit_node_id: string; sp: string; unit_code: string }>(
      `select v.subject_id::text, v.education_level_id::text, v.unit_node_id::text,
              (select node_id::text from question_version_sp_nodes where question_version_id = v.id limit 1) as sp,
              (select code from curriculum_nodes where id = v.unit_node_id) as unit_code
         from question_versions v where v.number_label = 'SEED-MCQ-MATH-T4'`,
    )
    tag = { subjectId: row!.subject_id, levelId: row!.education_level_id, unitId: row!.unit_node_id, spId: row!.sp, unitCode: row!.unit_code }
    const [other] = await t.db.query<{ code: string }>(
      `select code from curriculum_nodes where kind = 'unit' and subject_id = $1::bigint and education_level_id = $2::bigint and id <> $3::bigint
          and split_part(code, '.', 1) <> split_part($4, '.', 1) order by sort_order, id limit 1`,
      [tag.subjectId, tag.levelId, tag.unitId, tag.unitCode],
    )
    otherUnitCode = other!.code
  })
  afterAll(async () => {
    await t.close()
  })

  let counter = 0
  const newChapter = async (dskpCode: string | null): Promise<string> =>
    (
      await t.db.query<{ id: string }>(
        `insert into chapters (subject_id, education_level_id, name, chapter_number, dskp_code, is_active) values ($1::bigint, $2::bigint, $3, $4, $5, true) returning id::text`,
        [tag.subjectId, tag.levelId, `Bab G-02 ${String(++counter)}`, 800 + counter, dskpCode],
      )
    )[0]!.id
  const body = (over: Record<string, unknown> = {}) => ({
    questionType: 'mcq',
    questionText: 'Berapakah hasil tambah dua dan tiga?',
    subjectId: tag.subjectId,
    educationLevelId: tag.levelId,
    difficultyLevel: 2,
    options: ['4', '5', '6', '7'],
    correctAnswer: 1,
    cognitiveLevel: 'mengaplikasi',
    status: 'draft',
    tag: { unitId: tag.unitId, spIds: [tag.spId], tp: 3 },
    ...over,
  })

  it('refuses a Bab whose printed DSKP code is another unit, naming the Tajuk DSKP field', async () => {
    const chapter = await newChapter(otherUnitCode)
    const res = await c.admin.post('/api/questions', body({ curriculumChapterId: chapter }))
    expect(res.status, JSON.stringify(res.body)).toBe(422)
    expect(res.body.error.fields).toEqual({ 'tag.unitId': CHAPTER_UNIT_MISMATCH_MESSAGE })
  })

  it('accepts the Bab whose printed DSKP code is the question unit', async () => {
    const chapter = await newChapter(tag.unitCode)
    const res = await c.admin.post('/api/questions', body({ curriculumChapterId: chapter }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
  })

  it('a Bab with no known link to the units does not refuse any unit', async () => {
    const chapter = await newChapter(null) // number 80x, more chapters than units: no one-to-one alignment
    const res = await c.admin.post('/api/questions', body({ curriculumChapterId: chapter }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
  })

  it('an edit that keeps the stored pair is not refused, but changing to a mismatched Bab is', async () => {
    const mismatched = await newChapter(otherUnitCode)
    const ok = await newChapter(null)
    const created = await c.admin.post('/api/questions', body({ curriculumChapterId: ok }))
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    const id = created.body.data.id as string
    // Force a stored pair that the rule would refuse today (an old question), then edit another field.
    await t.db.query(`update question_versions set chapter_id = $2::bigint where question_id = $1::bigint`, [id, mismatched])
    const kept = await c.admin.put(`/api/questions/${id}`, body({ curriculumChapterId: mismatched, questionText: 'Berapakah hasil tambah tiga dan empat?' }))
    expect(kept.status, JSON.stringify(kept.body)).toBe(200)
    const moved = await c.admin.put(`/api/questions/${id}`, body({ curriculumChapterId: mismatched, tag: { unitId: tag.unitId, spIds: [tag.spId], tp: 3 }, questionText: 'Berapakah hasil tambah lima dan enam?' }))
    expect(moved.status).toBe(200) // same pair as stored: still not re-checked
    const back = await c.admin.put(`/api/questions/${id}`, body({ curriculumChapterId: ok }))
    expect(back.status, JSON.stringify(back.body)).toBe(200)
    const again = await c.admin.put(`/api/questions/${id}`, body({ curriculumChapterId: mismatched }))
    expect(again.status, JSON.stringify(again.body)).toBe(422)
    expect(again.body.error.fields).toEqual({ 'tag.unitId': CHAPTER_UNIT_MISMATCH_MESSAGE })
  })
})
