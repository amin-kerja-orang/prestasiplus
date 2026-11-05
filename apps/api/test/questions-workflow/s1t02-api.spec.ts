import { INTAKE_GATE_MESSAGES, QuestionGateCheckSchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootWorkflowApp, expectError, loginAll, type Client, type WorkflowTestApp } from './helpers'

/**
 * S1-T02 part 1 over HTTP on the real bank: the typed Kesukaran (DM-47, migration 0128), Rujukan buku teks (DM-56), "Tolak" with its reason (DM-58,
 * API-Q-06, FR-QA-32) and the SP-outside-the-unit item of gate-check (FR-ADM-QE4.3).
 */
describe('S1-T02 part 1: difficulty_level, textbook_ref, rejection, SP outside the unit', () => {
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
    const chapterId = (
      await t.db.query<{ id: string }>(
        `insert into chapters (subject_id, education_level_id, name, chapter_number, is_active) values ($1::bigint, $2::bigint, 'Bab S1-T02 API', 977, true) returning id::text`,
        [row!.subject_id, row!.education_level_id],
      )
    )[0]!.id
    tag = { subjectId: row!.subject_id, levelId: row!.education_level_id, unitId: row!.unit_node_id, spId: row!.sp, chapterId }
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
    curriculumChapterId: tag.chapterId,
    tag: { unitId: tag.unitId, spIds: [tag.spId], tp: 3 },
    ...over,
  })
  const create = async (over: Record<string, unknown> = {}): Promise<string> => {
    const res = await c.admin.post('/api/questions', body(over))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body.data.id as string
  }
  const row = async (id: string) =>
    (
      await t.db.query<{ status: string; difficulty_level: number | null; difficulty_tp: number | null; textbook_ref: unknown; textbook_bab: number | null; textbook_tingkatan: number | null; textbook_page: number | null; rejection_reason: string | null }>(
        `select status, difficulty_level, difficulty_tp, textbook_ref, textbook_bab, textbook_tingkatan, textbook_page, rejection_reason from question_versions where question_id = $1::bigint order by version_no desc limit 1`,
        [id],
      )
    )[0]!
  const status = (id: string, to: string, reason?: string) => c.admin.post(`/api/questions/${id}/status`, { to, ...(reason === undefined ? {} : { reason }) })
  const gate = async (id: string, which: 'submit' | 'approve') => envelopeOf(QuestionGateCheckSchema).parse((await c.admin.get(`/api/questions/${id}/gate-check?gate=${which}`)).body).data

  describe('Kesukaran (difficulty_level)', () => {
    it('the typed value is written to difficulty_level on every save and TP stays in difficulty_tp', async () => {
      const id = await create({ difficultyLevel: 4, tag: { unitId: tag.unitId, spIds: [tag.spId], tp: 6 } })
      expect(await row(id)).toMatchObject({ difficulty_level: 4, difficulty_tp: 6 })
      const put = await c.admin.put(`/api/questions/${id}`, body({ difficultyLevel: 2, tag: { unitId: tag.unitId, spIds: [tag.spId], tp: 6 } }))
      expect(put.status, JSON.stringify(put.body)).toBe(200)
      expect(put.body.data.difficultyLevel).toBe(2)
      expect(await row(id)).toMatchObject({ difficulty_level: 2, difficulty_tp: 6 })
    })

    it('reads the typed value, else least(5, TP) (TP 6 reads 5), else 3', async () => {
      const id = await create({ difficultyLevel: 1, tag: { unitId: tag.unitId, spIds: [tag.spId], tp: 2 } })
      const read = async () => (await c.admin.get(`/api/questions/${id}`)).body.data.difficultyLevel as number
      expect(await read()).toBe(1)
      await t.db.query(`update question_versions set difficulty_level = null, difficulty_tp = 6 where question_id = $1::bigint`, [id])
      expect(await read()).toBe(5)
      await t.db.query(`update question_versions set difficulty_tp = 4 where question_id = $1::bigint`, [id])
      expect(await read()).toBe(4)
      await t.db.query(`update question_versions set difficulty_tp = null where question_id = $1::bigint`, [id])
      expect(await read()).toBe(3)
    })

    it('NO_DIFFICULTY (step 4) at both gates only when the typed value and the TP are both missing', async () => {
      const id = await create({}) // review below
      await t.db.query(`update question_versions set difficulty_level = null where question_id = $1::bigint`, [id])
      expect((await gate(id, 'submit')).issues.map((i) => i.code)).not.toContain('NO_DIFFICULTY') // TP 3 is there
      await t.db.query(`update question_versions set difficulty_tp = null where question_id = $1::bigint`, [id])
      const submit = await gate(id, 'submit')
      expect(submit.issues).toContainEqual({ path: 'difficultyLevel', code: 'NO_DIFFICULTY', message: 'Sila pilih tahap kesukaran.', step: 4 })
      const refused = await status(id, 'review')
      expect(refused.status).toBe(422)
      expect(refused.body.error.fields.difficultyLevel).toBe('Sila pilih tahap kesukaran.')
      expect((await gate(id, 'approve')).issues.map((i) => i.code)).toContain('NO_DIFFICULTY')
    })
  })

  describe('Rujukan buku teks (textbook_ref)', () => {
    const ref = { bab: '3', tingkatan: 'T4', mukaSurat: 56 }
    it('saves the jsonb and the int columns together, reads it back, keeps it on an edit that omits it and clears it on null', async () => {
      const id = await create({ textbookRef: { ...ref, hingga: 58 } })
      expect(await row(id)).toMatchObject({ textbook_ref: { ...ref, hingga: 58 }, textbook_bab: 3, textbook_tingkatan: 4, textbook_page: 56 })
      expect((await c.admin.get(`/api/questions/${id}`)).body.data.textbookRef).toEqual({ ...ref, hingga: 58 })
      expect((await c.admin.put(`/api/questions/${id}`, body({}))).status).toBe(200)
      expect(await row(id)).toMatchObject({ textbook_ref: { ...ref, hingga: 58 }, textbook_page: 56 })
      expect((await c.admin.put(`/api/questions/${id}`, body({ textbookRef: null }))).status).toBe(200)
      expect(await row(id)).toMatchObject({ textbook_ref: null, textbook_bab: null, textbook_tingkatan: null, textbook_page: null })
    })

    it('a text Bab that is not a number keeps the jsonb and leaves the int column null; a page outside 1..999 is 422 with the BM message', async () => {
      const id = await create({ textbookRef: { bab: 'Pengenalan', tingkatan: 'T5', mukaSurat: 7 } })
      expect(await row(id)).toMatchObject({ textbook_ref: { bab: 'Pengenalan', tingkatan: 'T5', mukaSurat: 7 }, textbook_bab: null, textbook_tingkatan: 5, textbook_page: 7 })
      const bad = await c.admin.post('/api/questions', body({ textbookRef: { ...ref, mukaSurat: 1000 } }))
      expect(bad.status).toBe(422)
      expect(JSON.stringify(bad.body.error.fields)).toContain('Muka surat mesti nombor antara 1 dan 999.')
    })
  })

  describe('Tolak (to: "rejected", API-Q-06)', () => {
    const inReview = async () => {
      const id = await create({ status: 'review' })
      expect((await row(id)).status).toBe('review')
      return id
    }

    it('stores the reason, returns the question as Draf with the reason, and sending for review again clears it', async () => {
      const id = await inReview()
      const res = await status(id, 'rejected', '  Gambar rajah tidak jelas.  ')
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data.question).toMatchObject({ status: 'draft', rejectionReason: 'Gambar rajah tidak jelas.' })
      expect(await row(id)).toMatchObject({ status: 'draft', rejection_reason: 'Gambar rajah tidak jelas.' })
      const event = (await t.db.query<{ from_status: string; to_status: string; reason: string }>(`select from_status, to_status, reason from question_status_events where question_id = $1::bigint order by id desc limit 1`, [id]))[0]
      expect(event).toEqual({ from_status: 'review', to_status: 'draft', reason: 'Gambar rajah tidak jelas.' })
      expect((await c.admin.get(`/api/questions/${id}`)).body.data.rejectionReason).toBe('Gambar rajah tidak jelas.')
      expect((await status(id, 'review')).status).toBe(200)
      expect(await row(id)).toMatchObject({ status: 'review', rejection_reason: null })
    })

    it('the reason is required, 5 to 500 characters: 422 fields.reason with the BM text, and nothing changes', async () => {
      const id = await inReview()
      const message = 'Sila nyatakan sebab penolakan (sekurang-kurangnya 5 aksara).'
      for (const reason of [undefined, '', '   ', 'abcd', ' abc ']) {
        const res = await status(id, 'rejected', reason)
        expect(res.status, String(reason)).toBe(422)
        expect(res.body.error.fields.reason).toBe(message)
      }
      expect((await status(id, 'rejected', 'a'.repeat(501))).status).toBe(422)
      expect(await row(id)).toMatchObject({ status: 'review', rejection_reason: null })
      expect((await status(id, 'rejected', 'a'.repeat(500))).status).toBe(200)
      expect((await row(id)).rejection_reason).toHaveLength(500)
    })

    it('only from Semakan (409 ERR-CON-04 text) and only for Admin Pusat (403); a plain to:"draft" from review stays allowed and stores no rejection reason', async () => {
      const draft = await create({})
      expectError(await status(draft, 'rejected', 'Sebab yang sah.'), 'CONFLICT', 'Perubahan status ini tidak dibenarkan daripada status semasa.')
      const mine = await inReview()
      await t.db.query('update questions set created_by_id = $1::bigint where id = $2::bigint', [c.teacher.userId, mine])
      expect((await c.teacher.post(`/api/questions/${mine}/status`, { to: 'rejected', reason: 'Sebab yang sah.' })).status).toBe(403)
      expect((await status(mine, 'draft', 'Jawapan tidak jelas.')).status).toBe(200)
      expect(await row(mine)).toMatchObject({ status: 'draft', rejection_reason: null })
    })

    it('a bulk draft move or a status the contract does not know is unchanged (422 Status tidak sah.)', async () => {
      const id = await inReview()
      expectError(await status(id, 'published'), 'VALIDATION_ERROR')
    })
  })

  describe('SP outside the unit (FR-ADM-QE4.3, gate-check repeats the blur check)', () => {
    it('lists SP_NOT_IN_TAXONOMY with the intake text and the step 4 for a saved question whose SP is not under its unit', async () => {
      const [other] = await t.db.query<{ id: string; code: string }>(
        `insert into curriculum_nodes (subject_id, education_level_id, kind, code, title, edition)
         select subject_id, education_level_id, 'sp', '99.9', 'SP luar unit', edition from curriculum_nodes where id = $1::bigint returning id::text, code`,
        [tag.spId],
      )
      const id = await create({ status: 'review' })
      expect((await gate(id, 'approve')).issues.map((i) => i.code)).not.toContain('SP_NOT_IN_TAXONOMY')
      await t.db.query(`update question_version_sp_nodes set node_id = $2::bigint where question_version_id in (select id from question_versions where question_id = $1::bigint)`, [id, other!.id])
      const check = await gate(id, 'approve')
      expect(check.issues).toContainEqual({ path: 'spIds', code: 'SP_NOT_IN_TAXONOMY', message: INTAKE_GATE_MESSAGES.spNotInTaxonomy('99.9'), step: 4 })
      const res = await status(id, 'approved')
      expect(res.status).toBe(422)
      expect(res.body.error.fields.spIds).toBe(INTAKE_GATE_MESSAGES.spNotInTaxonomy('99.9'))
    })
  })
})
