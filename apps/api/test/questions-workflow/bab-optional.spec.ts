import { QuestionGateCheckSchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootWorkflowApp, loginAll, type Client, type WorkflowTestApp } from './helpers'

/**
 * S1-T02 (45 section 4.1 row 8, D-QA-12; supersedes REQ-B-071 "the Bab is optional"): the Bab is required to Terbitkan (`NO_CHAPTER`, "Sila pilih Bab.",
 * step 4) only where the Subjek + Tingkatan has chapters (an active `chapters` row in the tree); it is never asked at Semakan and it is no longer
 * derived from the DSKP unit. The unit, SP and TP items are listed only where DSKP nodes exist for the Subjek + Tingkatan (R-DSKP). Real bank, real routes.
 */
describe('S1-T02: NO_CHAPTER and the R-DSKP conditional items', () => {
  let t: WorkflowTestApp
  let c: Record<'admin' | 'teacher' | 'otherTeacher' | 'schoolAdmin' | 'student', Client>
  let tag: { subjectId: string; levelId: string; unitId: string; spId: string; unitCode: string; spCode: string }

  beforeAll(async () => {
    t = await bootWorkflowApp({ bank: 'real', env: { THROTTLE_QUESTIONS_WRITE_PER_MINUTE: '100000' } })
    c = await loginAll(t)
    const [row] = await t.db.query<{ subject_id: string; education_level_id: string; unit_node_id: string; sp: string; unit_code: string; sp_code: string }>(
      `select v.subject_id::text, v.education_level_id::text, v.unit_node_id::text,
              (select node_id::text from question_version_sp_nodes where question_version_id = v.id limit 1) as sp,
              (select code from curriculum_nodes where id = v.unit_node_id) as unit_code,
              (select n.code from curriculum_nodes n where n.id = (select node_id from question_version_sp_nodes where question_version_id = v.id limit 1)) as sp_code
         from question_versions v where v.number_label = 'SEED-MCQ-MATH-T4'`,
    )
    tag = { subjectId: row!.subject_id, levelId: row!.education_level_id, unitId: row!.unit_node_id, spId: row!.sp, unitCode: row!.unit_code, spCode: row!.sp_code }
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
    cognitiveLevel: 'mengaplikasi',
    tag: { unitId: tag.unitId, spIds: [tag.spId], tp: 3 },
    ...over,
  })
  /** A draft with NO Bab (what a CSV import row or an accepted intake item is). */
  async function chapterless(over: Record<string, unknown> = {}, status: 'draft' | 'review' = 'draft'): Promise<string> {
    const res = await c.admin.post('/api/questions', body({ status, ...over }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body.data.id as string
  }
  const chapterOf = async (id: string) => (await t.db.query<{ chapter_id: string | null }>(`select chapter_id::text from question_versions where question_id = $1::bigint order by version_no desc limit 1`, [id]))[0]!.chapter_id
  const statusOf = async (id: string) => (await t.db.query<{ status: string }>(`select status from question_versions where question_id = $1::bigint order by version_no desc limit 1`, [id]))[0]!.status
  const move = (id: string, to: string) => c.admin.post(`/api/questions/${id}/status`, { to })
  const gate = async (id: string, which: 'submit' | 'approve') => envelopeOf(QuestionGateCheckSchema).parse((await c.admin.get(`/api/questions/${id}/gate-check?gate=${which}`)).body).data
  let counter = 0
  const newChapter = async (dskpCode: string | null): Promise<string> =>
    (
      await t.db.query<{ id: string }>(
        `insert into chapters (subject_id, education_level_id, name, chapter_number, dskp_code, is_active) values ($1::bigint, $2::bigint, $3, $4, $5, true) returning id::text`,
        [tag.subjectId, tag.levelId, `Bab S1-T02 ${String(++counter)}`, 900 + counter, dskpCode],
      )
    )[0]!.id
  /** Runs `fn` with the chapters of the question's Subjek + Tingkatan switched off (`in_tree = false`), then restores them. */
  const withoutChapters = async (fn: () => Promise<void>): Promise<void> => {
    const ids = (await t.db.query<{ id: string }>(`select id::text from chapters where subject_id = $1::bigint and education_level_id = $2::bigint and is_active and in_tree`, [tag.subjectId, tag.levelId])).map((r) => r.id)
    await t.db.query(`update chapters set in_tree = false where id = any($1::bigint[])`, [ids])
    try {
      await fn()
    } finally {
      await t.db.query(`update chapters set in_tree = true where id = any($1::bigint[])`, [ids])
    }
  }

  describe('Semakan (submit) without a Bab', () => {
    it('single and bulk: chapterless drafts enter Semakan, N of N, and gate-check submit is ok', async () => {
      await newChapter(null)
      const one = await chapterless()
      expect(await chapterOf(one)).toBeNull()
      expect((await gate(one, 'submit')).ok).toBe(true)
      const single = await move(one, 'review')
      expect(single.status, JSON.stringify(single.body)).toBe(200)
      expect(await statusOf(one)).toBe('review')

      const ids = [await chapterless(), await chapterless(), await chapterless()]
      const bulk = await c.admin.post('/api/questions/bulk-action', { action: 'review', ids })
      expect(bulk.status, JSON.stringify(bulk.body)).toBe(200)
      expect(bulk.body.data).toEqual({ affected: 3, failed: [] })
      for (const id of ids) expect(await statusOf(id)).toBe('review')
    })

    it('the other submit rules still hold: no subject is refused with its own message, never with a Bab message', async () => {
      const id = await chapterless()
      await t.db.query(`update question_versions set subject_id = null where question_id = $1::bigint`, [id])
      const res = await move(id, 'review')
      expect(res.status).toBe(422)
      expect(res.body.error.fields).toMatchObject({ subjectId: 'Sila pilih subjek.' })
      expect(res.body.error.fields).not.toHaveProperty('chapterId')
    })
  })

  describe('Terbitkan (approve): the Bab where the Subjek + Tingkatan has chapters', () => {
    it('without a Bab: gate-check lists NO_CHAPTER (step 4); the status route, the bulk action and create-as-approved name the same field; nothing moves', async () => {
      const chapter = await newChapter(null)
      const id = await chapterless({}, 'review')
      const check = await gate(id, 'approve')
      expect(check.ok).toBe(false)
      expect(check.issues).toContainEqual({ path: 'chapterId', code: 'NO_CHAPTER', message: 'Sila pilih Bab.', step: 4 })
      const res = await move(id, 'approved')
      expect(res.status, JSON.stringify(res.body)).toBe(422)
      expect(res.body.error.fields).toEqual({ chapterId: 'Sila pilih Bab.' })
      expect(await statusOf(id)).toBe('review')
      const bulk = await c.admin.post('/api/questions/bulk-action', { action: 'approved', ids: [id] })
      expect(bulk.body.data).toMatchObject({ affected: 0, failed: [{ id, code: 'VALIDATION_ERROR', fields: { chapterId: 'Sila pilih Bab.' } }] })
      const created = await c.admin.post('/api/questions', body({ status: 'approved' }))
      expect(created.status).toBe(422)
      expect(created.body.error.fields).toEqual({ chapterId: 'Sila pilih Bab.' })

      // With a Bab chosen it passes (single, bulk, create-as-approved).
      await t.db.query(`update question_versions set chapter_id = $2::bigint where question_id = $1::bigint`, [id, chapter])
      expect((await gate(id, 'approve')).ok).toBe(true)
      expect((await move(id, 'approved')).status).toBe(200)
      const chosen = await chapterless({ curriculumChapterId: chapter }, 'review')
      expect((await c.admin.post('/api/questions/bulk-action', { action: 'approved', ids: [chosen] })).body.data).toEqual({ affected: 1, failed: [] })
      const ok = await c.admin.post('/api/questions', body({ status: 'approved', curriculumChapterId: chapter }))
      expect(ok.status, JSON.stringify(ok.body)).toBe(201)
    })

    it('a Subjek + Tingkatan without chapters has no NO_CHAPTER item and approves chapterless', async () => {
      await withoutChapters(async () => {
        const id = await chapterless({}, 'review')
        const check = await gate(id, 'approve')
        expect(check.issues.map((i) => i.code)).not.toContain('NO_CHAPTER')
        expect(check.ok).toBe(true)
        expect((await move(id, 'approved')).status).toBe(200)
        expect(await chapterOf(id)).toBeNull()
      })
    })

    it('the Bab is no longer derived from the DSKP unit: a chapter whose dskp_code is the unit code does not satisfy the gate', async () => {
      const chapter = await newChapter(tag.unitCode)
      const id = await chapterless({}, 'review')
      expect((await move(id, 'approved')).status).toBe(422)
      expect(await chapterOf(id)).toBeNull()
      await t.db.query(`update chapters set dskp_code = null where id = $1::bigint`, [chapter])
    })
  })

  describe('R-DSKP: unit, SP and TP only where DSKP nodes exist for the Subjek + Tingkatan', () => {
    it('with DSKP nodes and no unit or SP: the issue list names NO_UNIT and NO_SP (and the 422 the same fields)', async () => {
      await withoutChapters(async () => {
        const id = await chapterless({}, 'review')
        await t.db.query(`update question_versions set unit_node_id = null where question_id = $1::bigint`, [id])
        await t.db.query(`delete from question_version_sp_nodes where question_version_id in (select id from question_versions where question_id = $1::bigint)`, [id])
        const check = await gate(id, 'approve')
        expect(check.ok).toBe(false)
        expect(check.issues.map((i) => i.code)).toEqual(expect.arrayContaining(['NO_UNIT', 'NO_SP']))
        const res = await move(id, 'approved')
        expect(res.status, JSON.stringify(res.body)).toBe(422)
        expect(res.body.error.fields).toMatchObject({ unitId: 'Sila pilih unit DSKP.', spIds: 'Sila pilih sekurang-kurangnya satu SP DSKP.' })
        expect(await statusOf(id)).toBe('review')
      })
    })

    it('without DSKP nodes for the Subjek + Tingkatan: no unit, SP, TP or aras item', async () => {
      const [free] = await t.db.query<{ id: string }>(`select s.id::text from subjects s where not exists (select 1 from curriculum_nodes n where n.subject_id = s.id and n.education_level_id = $1::bigint) limit 1`, [tag.levelId])
      expect(free, 'a subject without DSKP nodes at the level').toBeDefined()
      const id = await chapterless({ subjectId: free!.id, tag: undefined, cognitiveLevel: undefined }, 'review')
      await t.db.query(`update question_versions set unit_node_id = null, difficulty_tp = null where question_id = $1::bigint`, [id])
      const check = await gate(id, 'approve')
      expect(check.issues.filter((i) => ['NO_UNIT', 'NO_SP', 'TP_MISSING', 'LEAF_NO_ARAS', 'LEAF_NO_TP'].includes(i.code))).toEqual([])
    })
  })
})
