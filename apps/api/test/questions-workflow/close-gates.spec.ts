import { QuestionGateCheckSchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PUBLISH_TAG_MESSAGES } from '../../src/modules/questions/errors'
import { STIMULUS_FLAG_MESSAGES } from '../../src/modules/questions/publish-gate'
import { bootWorkflowApp, loginAll, type Client, type WorkflowTestApp } from './helpers'

/**
 * S1-T02 close-out on the real bank: AC-ADM-QE4.5 and AC-QA-42 (R-DSKP: unloaded subject publishes, loaded refuses), and AC-ADM-QE4.6 / AC-QA-11
 * (gate rows 25 STIMULUS_MISSING and 26 FIGURE_ONLY, S and A).
 */
describe('S1-T02 close-out: R-DSKP contrast and the stimulus flag rows', () => {
  let t: WorkflowTestApp
  let c: Record<'admin' | 'teacher' | 'otherTeacher' | 'schoolAdmin' | 'student', Client>
  let tag: { subjectId: string; levelId: string; unitId: string; spId: string; chapterId: string }

  beforeAll(async () => {
    t = await bootWorkflowApp({ bank: 'real', env: { THROTTLE_QUESTIONS_WRITE_PER_MINUTE: '100000' } })
    c = await loginAll(t)
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

  const stem = 'Berapakah hasil tambah dua dan tiga?'
  const gate = async (id: string, which: 'submit' | 'approve') => envelopeOf(QuestionGateCheckSchema).parse((await c.admin.get(`/api/questions/${id}/gate-check?gate=${which}`)).body).data
  const move = (id: string, to: string) => c.admin.post(`/api/questions/${id}/status`, { to })
  const create = async (over: Record<string, unknown>): Promise<string> => {
    const res = await c.admin.post('/api/questions', { questionType: 'mcq', questionText: stem, difficultyLevel: 2, options: ['4', '5', '6', '7'], correctAnswer: 1, ...over })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body.data.id as string
  }
  const statusOf = async (id: string) => (await t.db.query<{ status: string }>(`select status from question_versions where question_id = $1::bigint order by version_no desc limit 1`, [id]))[0]!.status

  describe('AC-ADM-QE4.5 and AC-QA-42: DSKP not loaded publishes, loaded refuses', () => {
    let free: { subjectId: string; levelId: string }
    beforeAll(async () => {
      const [s] = await t.db.query<{ id: string }>(`select s.id::text from subjects s where not exists (select 1 from curriculum_nodes n where n.subject_id = s.id and n.education_level_id = $1::bigint) and not exists (select 1 from chapters h where h.subject_id = s.id and h.education_level_id = $1::bigint) order by s.id limit 1`, [tag.levelId])
      expect(s, 'a subject with no curriculum nodes and no chapters at the level').toBeDefined()
      free = { subjectId: s!.id, levelId: tag.levelId }
    })
    const complete = () => create({ subjectId: free.subjectId, educationLevelId: free.levelId })

    it('without nodes a complete draft approves (200) and the panel never lists unit, SP or TP; once an SP node is loaded the same draft is refused', async () => {
      const id = await complete()
      expect((await move(id, 'review')).status).toBe(200)
      const before = await gate(id, 'approve')
      expect(before.ok, JSON.stringify(before.issues)).toBe(true)
      expect(before.issues.filter((i) => ['NO_UNIT', 'NO_SP', 'TP_MISSING', 'LEAF_NO_ARAS', 'LEAF_NO_TP'].includes(i.code))).toEqual([])
      const ok = await move(id, 'approved')
      expect(ok.status, JSON.stringify(ok.body)).toBe(200)
      expect(await statusOf(id)).toBe('approved')

      // QA-42 contrast, loaded side: the DSKP of the subject is loaded (an SP node), the same draft is refused.
      await t.db.query(`insert into curriculum_nodes (subject_id, education_level_id, kind, code, title, edition) values ($1::bigint, $2::bigint, 'sp', 'S1T02.1.1', 'SP ujian', 'test')`, [free.subjectId, free.levelId])
      const again = await create({ subjectId: free.subjectId, educationLevelId: free.levelId, questionText: 'Berapakah hasil tambah empat dan lima?' })
      // The create path derives the TP from the typed Kesukaran; an imported draft has none, so clear it to see the TP item.
      await t.db.query('update question_versions set difficulty_tp = null where question_id = $1::bigint', [again])
      expect((await move(again, 'review')).status).toBe(200)
      const refused = await move(again, 'approved')
      expect(refused.status, JSON.stringify(refused.body)).toBe(422)
      expect(refused.body.error.fields.spIds).toBe(PUBLISH_TAG_MESSAGES.spIds)
      expect(refused.body.error.fields.tp).toBe(PUBLISH_TAG_MESSAGES.tp)
      expect(PUBLISH_TAG_MESSAGES.spIds).toBe('Sila pilih sekurang-kurangnya satu SP DSKP.')
      expect(await statusOf(again)).toBe('review')
    })

    it('AC-QA-42: the unloaded subject publishes; MATH (loaded) refuses unit, SP, TP and the aras of the leaf', async () => {
      const [other] = await t.db.query<{ id: string }>(`select s.id::text from subjects s where not exists (select 1 from curriculum_nodes n where n.subject_id = s.id and n.education_level_id = $1::bigint) and not exists (select 1 from chapters h where h.subject_id = s.id and h.education_level_id = $1::bigint) and s.id <> $2::bigint order by s.id limit 1`, [tag.levelId, free.subjectId])
      expect(other, 'a second unloaded subject').toBeDefined()
      const unloaded = await create({ subjectId: other!.id, educationLevelId: tag.levelId, questionText: 'Soalan subjek belum dimuat untuk ujian QA-42.' })
      expect((await move(unloaded, 'review')).status).toBe(200)
      expect((await move(unloaded, 'approved')).status).toBe(200)

      const loaded = await create({ subjectId: tag.subjectId, educationLevelId: tag.levelId, curriculumChapterId: tag.chapterId, questionText: 'Soalan subjek termuat untuk ujian QA-42 hari ini.' })
      await t.db.query('update question_versions set unit_node_id = null, difficulty_tp = null where question_id = $1::bigint', [loaded])
      await t.db.query('delete from question_version_sp_nodes where question_version_id = (select id from question_versions where question_id = $1::bigint)', [loaded])
      expect((await move(loaded, 'review')).status).toBe(200)
      const refused = await move(loaded, 'approved')
      expect(refused.status, JSON.stringify(refused.body)).toBe(422)
      expect(Object.keys(refused.body.error.fields)).toEqual(expect.arrayContaining(['unitId', 'spIds', 'tp', 'parts.1.cognitiveLevel']))
      const codes = (await gate(loaded, 'approve')).issues.map((i) => i.code)
      expect(codes).toEqual(expect.arrayContaining(['NO_UNIT', 'NO_SP', 'TP_MISSING', 'LEAF_NO_ARAS']))
    })
  })

  describe('AC-ADM-QE4.6 and AC-QA-11: gate rows 25 STIMULUS_MISSING and 26 FIGURE_ONLY', () => {
    const tagged = (over: Record<string, unknown> = {}) => ({
      subjectId: tag.subjectId, educationLevelId: tag.levelId, curriculumChapterId: tag.chapterId, cognitiveLevel: 'mengaplikasi',
      tag: { unitId: tag.unitId, spIds: [tag.spId], tp: 3 }, ...over,
    })
    const flagOf = async (id: string) => (await t.db.query<{ stimulus_flag: string | null; stimulus_flag_ref: string | null }>(`select stimulus_flag, stimulus_flag_ref from question_versions where question_id = $1::bigint order by version_no desc limit 1`, [id]))[0]!

    it('a stem that names a figure with no stimulus: the detector flags it; submit and approve answer 422 with STIMULUS_MISSING; Bukan masalah lets it pass', async () => {
      const id = await create(tagged({ questionText: 'Rajah 1 menunjukkan sebuah segi tiga. Berapakah luasnya?' }))
      expect(await flagOf(id)).toEqual({ stimulus_flag: 'stimulus_missing', stimulus_flag_ref: 'numbered' })
      const text = 'Soalan menyebut Rajah 1 tetapi tiada rangsangan. Pilih kumpulan atau tambah rangsangan.'
      expect(STIMULUS_FLAG_MESSAGES.missing('Rajah 1')).toBe(text)
      for (const which of ['submit', 'approve'] as const) {
        const g = await gate(id, which)
        expect(g.issues).toContainEqual({ path: 'stimulusMissing', code: 'STIMULUS_MISSING', message: text, step: 2 })
      }
      const refusedSubmit = await move(id, 'review')
      expect(refusedSubmit.status, JSON.stringify(refusedSubmit.body)).toBe(422)
      expect(refusedSubmit.body.error.fields.stimulusMissing).toBe(text)

      await t.db.query(`update question_versions set flag_dismissed_at = now() where question_id = $1::bigint`, [id])
      expect((await gate(id, 'submit')).issues.map((i) => i.code)).not.toContain('STIMULUS_MISSING')
      expect((await move(id, 'review')).status).toBe(200)
      const ok = await move(id, 'approved')
      expect(ok.status, JSON.stringify(ok.body)).toBe(200)
    })

    it('an open figure_only flag refuses with FIGURE_ONLY at submit and approve; a stem_duplicated flag never blocks', async () => {
      const only = 'Soalan ini hanya mengandungi rangsangan. Tukarkan kepada rangsangan kumpulan.'
      const id = await create(tagged({ questionText: 'Berapakah hasil tambah lima dan enam?' }))
      await t.db.query(`update question_versions set stimulus_flag = 'figure_only', stimulus_flag_ref = null, flag_dismissed_at = null where question_id = $1::bigint`, [id])
      for (const which of ['submit', 'approve'] as const) {
        expect((await gate(id, which)).issues).toContainEqual({ path: 'figureOnly', code: 'FIGURE_ONLY', message: only, step: 2 })
      }
      expect((await move(id, 'review')).status).toBe(422)
      await t.db.query(`update question_versions set stimulus_flag = 'stem_duplicated' where question_id = $1::bigint`, [id])
      const codes = (await gate(id, 'approve')).issues.map((i) => i.code)
      expect(codes).not.toContain('FIGURE_ONLY')
      expect(codes).not.toContain('STIMULUS_MISSING')
      expect((await move(id, 'review')).status).toBe(200)
    })
  })

  describe('AC-ADM-QE3.3 and AC-QA-31: Kesukaran is required on its own', () => {
    it('a draft with a TP and no Kesukaran is refused on submit and approve with "Sila pilih tahap kesukaran."; once typed it passes', async () => {
      const id = await create({ subjectId: tag.subjectId, educationLevelId: tag.levelId, curriculumChapterId: tag.chapterId, cognitiveLevel: 'mengaplikasi', tag: { unitId: tag.unitId, spIds: [tag.spId], tp: 3 }, questionText: 'Soalan tanpa tahap kesukaran untuk ujian QE3.3.' })
      await t.db.query('update question_versions set difficulty_level = null where question_id = $1::bigint', [id])
      for (const which of ['submit', 'approve'] as const) {
        expect((await gate(id, which)).issues).toContainEqual({ path: 'difficultyLevel', code: 'NO_DIFFICULTY', message: 'Sila pilih tahap kesukaran.', step: 4 })
      }
      const refused = await move(id, 'review')
      expect(refused.status, JSON.stringify(refused.body)).toBe(422)
      expect(refused.body.error.fields.difficultyLevel).toBe('Sila pilih tahap kesukaran.')
      await t.db.query('update question_versions set difficulty_level = 4 where question_id = $1::bigint', [id])
      expect((await move(id, 'review')).status).toBe(200)
      expect((await move(id, 'approved')).status).toBe(200)
    })
  })

  describe('rows 25/26 on create-as-approved and the bulk action', () => {
    const okBody = (over: Record<string, unknown>) => ({
      questionType: 'mcq', difficultyLevel: 2, options: ['4', '5', '6', '7'], correctAnswer: 1, subjectId: tag.subjectId, educationLevelId: tag.levelId,
      curriculumChapterId: tag.chapterId, cognitiveLevel: 'mengaplikasi', tag: { unitId: tag.unitId, spIds: [tag.spId], tp: 3 }, ...over,
    })
    const count = async () => Number((await t.db.query<{ n: string }>('select count(*)::text n from questions'))[0]!.n)

    it('POST /api/questions with status approved and a stem that names a figure with no stimulus answers 422 STIMULUS_MISSING and creates nothing', async () => {
      const before = await count()
      const res = await c.admin.post('/api/questions', okBody({ status: 'approved', questionText: 'Rajah 1 menunjukkan sebuah bulatan. Berapakah jejarinya?' }))
      expect(res.status, JSON.stringify(res.body)).toBe(422)
      expect(res.body.error.fields.stimulusMissing).toBe(STIMULUS_FLAG_MESSAGES.missing('Rajah 1'))
      expect(await count()).toBe(before)
      const ok = await c.admin.post('/api/questions', okBody({ status: 'approved', questionText: 'Berapakah jejari bulatan berdiameter sepuluh sentimeter?' }))
      expect(ok.status, JSON.stringify(ok.body)).toBe(201)
    })

    it('bulk-action approved refuses the flagged question with the code and lets the unflagged one through', async () => {
      const flagged = await create(okBody({ questionText: 'Rajah 2 menunjukkan sebuah segi empat. Berapakah lilitnya?' }))
      const clean = await create(okBody({ questionText: 'Berapakah lilit segi empat bersisi empat sentimeter?' }))
      expect((await move(flagged, 'review')).status).toBe(422) // the submit gate already holds it back
      await t.db.query(`update question_versions set flag_dismissed_at = now() where question_id = $1::bigint`, [flagged])
      expect((await move(flagged, 'review')).status).toBe(200)
      await t.db.query(`update question_versions set flag_dismissed_at = null where question_id = $1::bigint`, [flagged])
      expect((await move(clean, 'review')).status).toBe(200)
      const res = await c.admin.post('/api/questions/bulk-action', { action: 'approved', ids: [flagged, clean] })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data.affected).toBe(1)
      expect(res.body.data.failed).toHaveLength(1)
      expect(JSON.stringify(res.body.data.failed)).toContain(flagged)
      expect(JSON.stringify(res.body.data.failed)).toContain(STIMULUS_FLAG_MESSAGES.missing('Rajah 2'))
      expect(await statusOf(flagged)).toBe('review')
      expect(await statusOf(clean)).toBe('approved')
    })
  })
})
