import { QuestionGateCheckSchema, QuestionStatusResultSchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { expectError, bootWorkflowApp, loginAll, type Client, type WorkflowTestApp } from './helpers'

/**
 * R1-B05 (ADR-0031, D76, D80 DEC-2, D83 D-4, D85 U4) on the REAL question bank: the cognitive level of a leaf, the merged approve gate
 * for a NEW approval of an SPM-bound question, the gate-check read and the status route with its servability report.
 */
describe('DSKP-complete approve gate, gate-check and status route (real bank)', () => {
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
  /** A draft with the chapter the submit gate needs, owned by `who`. */
  async function draft(over: Record<string, unknown> = {}, who: Client = c.admin): Promise<string> {
    const res = await who.post('/api/questions', body(over))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const id = res.body.data.id as string
    await t.db.query('update question_versions set chapter_id = $1::bigint where question_id = $2::bigint', [tag.chapterId, id])
    return id
  }
  const check = (who: Client, id: string, gate = 'approve') => who.get(`/api/questions/${id}/gate-check?gate=${gate}`)
  const status = (who: Client, id: string, to: string, reason?: string) => who.post(`/api/questions/${id}/status`, { to, ...(reason ? { reason } : {}) })
  const issues = async (who: Client, id: string, gate = 'approve') => envelopeOf(QuestionGateCheckSchema).parse((await check(who, id, gate)).body).data
  const leafOf = async (id: string) => (await t.db.query<{ cognitive_level: string | null; kbat: string | null }>(`select p.cognitive_level, p.kbat from question_parts p join question_versions v on v.id = p.question_version_id where v.question_id = $1::bigint order by p.id limit 1`, [id]))[0]!

  describe('a subject outside the SPM catalogue (nothing new to satisfy)', () => {
    it('approves without a cognitive level or a kertas, and the answer carries a servability report', async () => {
      const id = await draft()
      expect((await issues(c.admin, id)).ok).toBe(true)
      expect((await status(c.admin, id, 'review')).status).toBe(200)
      const res = await status(c.admin, id, 'approved')
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const out = envelopeOf(QuestionStatusResultSchema).parse(res.body).data
      expect(out.question.status).toBe('approved')
      expect(out.servability).not.toBeNull()
      expect(out.servability?.questionId).toBe(id)
    })
  })

  describe('an SPM-bound question (MATH is in the SPM catalogue, Tingkatan 4)', () => {
    beforeAll(async () => {
      await t.db.query(`insert into spm_subject_configs (subject_id, grp, display_order) values ($1::bigint, 'teras', 1) on conflict do nothing`, [tag.subjectId])
    })

    it('gate-check lists the missing cognitive level (Bahagian copy, step 3) and the kertas (step 1); the status route answers 422 with the same keys', async () => {
      const id = await draft()
      const g = await issues(c.admin, id)
      expect(g.ok).toBe(false)
      expect(g.gate).toBe('approve')
      expect(g.issues).toContainEqual({ path: 'parts.1.cognitiveLevel', code: 'LEAF_COGNITIVE_LEVEL_MISSING', message: 'Bahagian (1) belum ada aras pemikiran.', step: 3 })
      expect(g.issues).toContainEqual({ path: 'kertas', code: 'KERTAS_MISSING', message: 'Sila pilih kertas untuk soalan SPM.', step: 1 })

      expect((await status(c.admin, id, 'review')).status).toBe(200) // the submit gate does not ask for DSKP-complete
      const refused = await status(c.admin, id, 'approved')
      const err = expectError(refused, 'VALIDATION_ERROR', 'Soalan belum memenuhi syarat untuk diterbitkan.')
      expect(err.fields).toMatchObject({ 'parts.1.cognitiveLevel': 'Bahagian (1) belum ada aras pemikiran.', kertas: 'Sila pilih kertas untuk soalan SPM.' })
      expect(err.details).toEqual({ gate: 'approve' })
      expect((await t.db.query<{ status: string }>(`select status from question_versions where question_id = $1::bigint`, [id]))[0]!.status).toBe('review')
    })

    it('once the leaf has its level and the kertas is set, the gate passes and the approval returns the servability report', async () => {
      const id = await draft()
      expect((await status(c.admin, id, 'review')).status).toBe(200)
      const put = await c.admin.put(`/api/questions/${id}`, body({ cognitiveLevel: 'menganalisis', kertas: '1' }))
      expect(put.status, JSON.stringify(put.body)).toBe(200)
      expect(await leafOf(id)).toEqual({ cognitive_level: 'menganalisis', kbat: 'menganalisis' }) // the four upper levels are KBAT
      expect((await issues(c.admin, id)).ok).toBe(true)
      const res = await status(c.admin, id, 'approved')
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const out = envelopeOf(QuestionStatusResultSchema).parse(res.body).data
      expect(out.question.status).toBe('approved')
      expect(out.servability?.questionId).toBe(id)
    })

    it('a lower level (mengingat, memahami) is not KBAT', async () => {
      const id = await draft({ cognitiveLevel: 'memahami' })
      expect(await leafOf(id)).toEqual({ cognitive_level: 'memahami', kbat: 'bukan' })
    })

    it('a structured question names every leaf that lacks a level, by its label', async () => {
      const leaf = (label: string, extra: Record<string, unknown> = {}) => ({ label, prompt: { ms: `Soalan ${label}` }, marks: 1, mode: 'short_text', key: { kind: 'accepted', values: ['x'] }, ...extra })
      const id = await draft({ parts: [leaf('a', { cognitiveLevel: 'mengingat' }), leaf('b'), leaf('c', { cognitiveLevel: 'menilai', difficultyTp: 5 })], questionType: 'essay', questionText: 'Jawab semua bahagian di bawah dengan ringkas.' })
      const g = await issues(c.admin, id)
      const paths = g.issues.map((i) => i.path)
      expect(paths).toContain('parts.b.cognitiveLevel')
      expect(paths).not.toContain('parts.a.cognitiveLevel')
      expect(paths).not.toContain('parts.c.cognitiveLevel')
      expect(g.issues.find((i) => i.path === 'parts.b.cognitiveLevel')?.message).toBe('Bahagian (b) belum ada aras pemikiran.')
    })

    it('legacy rule (D80 DEC-2): an approved question that was never tagged stays approved and servable; only a NEW approval of an edit asks', async () => {
      const id = await draft()
      await status(c.admin, id, 'review')
      // Approved before the rule existed: written straight to the tables, as the migration of legacy rows left it.
      await t.db.query(`update question_versions set status = 'approved', published_at = now() where question_id = $1::bigint`, [id])
      await t.db.query(`update questions set live_version_no = 1 where id = $1::bigint`, [id])
      expect((await t.db.query(`select 1 from question_versions where question_id = $1::bigint and status = 'approved'`, [id])).length).toBe(1)
      // Editing makes version 2 as a draft; the live version keeps serving.
      const put = await c.admin.put(`/api/questions/${id}`, body({ questionText: 'Berapakah hasil tambah dua dan tiga hari ini?' }))
      expect(put.status, JSON.stringify(put.body)).toBe(200)
      expect((await t.db.query<{ live: number | null }>(`select live_version_no live from questions where id = $1::bigint`, [id]))[0]!.live).toBe(1)
      await status(c.admin, id, 'review')
      const refused = await status(c.admin, id, 'approved')
      expect(refused.status).toBe(422)
      expect(refused.body.error.fields['parts.1.cognitiveLevel']).toBe('Bahagian (1) belum ada aras pemikiran.')
    })

    it('bulk-action approve runs the same rule per question (no bypass)', async () => {
      const id = await draft()
      await status(c.admin, id, 'review')
      const res = await c.admin.post('/api/questions/bulk-action', { action: 'approved', ids: [id] })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data.affected).toBe(0)
      expect(res.body.data.failed).toHaveLength(1)
    })

    it('creating directly as approved is refused the same way', async () => {
      const res = await c.admin.post('/api/questions', body({ status: 'approved' }))
      expect(res.status).toBe(422)
      expect(res.body.error.fields['parts.1.cognitiveLevel']).toBe('Bahagian (1) belum ada aras pemikiran.')
      const ok = await c.admin.post('/api/questions', body({ status: 'approved', cognitiveLevel: 'mengaplikasi', kertas: '2' }))
      expect(ok.status, JSON.stringify(ok.body)).toBe(201)
    })
  })

  describe('read side: "Belum ditanda DSKP"', () => {
    it('the detail carries dskpStatus { complete, issues } and the list row carries dskpComplete', async () => {
      const legacy = await draft() // a plain MCQ: unit, SP and TP, but no cognitive level
      const detail = await c.admin.get(`/api/questions/${legacy}`)
      expect(detail.status).toBe(200)
      expect(detail.body.data.dskpStatus).toEqual({
        complete: false,
        issues: [{ path: 'parts.1.cognitiveLevel', code: 'LEAF_COGNITIVE_LEVEL_MISSING', message: 'Bahagian (1) belum ada aras pemikiran.', step: 3 }],
      })
      expect(detail.body.data.dskp).toBeDefined() // the DSKP chain keeps its own key

      const tagged = await draft({ cognitiveLevel: 'menilai' })
      const done = await c.admin.get(`/api/questions/${tagged}`)
      expect(done.body.data.dskpStatus).toEqual({ complete: true, issues: [] })

      const list = await c.admin.get('/api/questions?pageSize=100')
      expect(list.status).toBe(200)
      const row = (id: string) => (list.body.data as { id: string; dskpComplete?: boolean }[]).find((r) => r.id === id)
      expect(row(legacy)?.dskpComplete).toBe(false)
      expect(row(tagged)?.dskpComplete).toBe(true)
    })

    it('an untagged question (no unit, no SP) lists unit and SP first, in the Tag step', async () => {
      const res = await c.admin.post('/api/questions', body({ tag: undefined }))
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const detail = await c.admin.get(`/api/questions/${res.body.data.id as string}`)
      const issues = detail.body.data.dskpStatus.issues as { path: string; step: number }[]
      expect(issues.filter((i) => i.step === 4).map((i) => i.path)).toEqual(['unitId', 'spIds'])
      expect(detail.body.data.dskpStatus.complete).toBe(false)
    })
  })

  describe('routes', () => {
    it('gate=submit is the draft-to-review gate; a bad gate name is 422', async () => {
      const id = await draft()
      expect((await issues(c.admin, id, 'submit')).gate).toBe('submit')
      expect((await check(c.admin, id, 'publish')).status).toBe(422)
    })

    it('roles: the owning Guru checks and submits their own question; another Guru gets 404; Admin Sekolah, a pupil and anonymous are refused', async () => {
      const own = await draft()
      await t.db.query('update questions set created_by_id = $1::bigint where id = $2::bigint', [c.teacher.userId, own]) // the Guru owns it
      expect((await check(c.teacher, own)).status).toBe(200)
      expect((await status(c.teacher, own, 'review')).status).toBe(200)
      expect((await status(c.teacher, own, 'approved')).status).toBe(403) // approving is Admin Pusat only
      expect((await check(c.otherTeacher, own)).status).toBe(404)
      expect((await status(c.otherTeacher, own, 'archived')).status).toBe(404)
      expect((await check(c.schoolAdmin, own)).status).toBe(403)
      expect((await status(c.schoolAdmin, own, 'archived')).status).toBe(403)
      expect((await check(c.student, own)).status).toBe(403)
      expect((await t.http().get(`/api/questions/${own}/gate-check`)).status).toBe(401)
      expect((await t.http().post(`/api/questions/${own}/status`).send({ to: 'archived' })).status).toBe(401)
    })

    it('status: a pair outside the table is 409 with the BM message, an unknown status or a missing reason is 422, a missing id is 404', async () => {
      const id = await draft()
      const conflict = await status(c.admin, id, 'approved') // draft -> approved is not in the table
      expectError(conflict, 'CONFLICT', 'Perubahan status daripada Draf kepada Diterbitkan tidak dibenarkan.')
      expect((await status(c.admin, id, 'published')).status).toBe(422)
      expect((await c.admin.post(`/api/questions/${id}/status`, {})).status).toBe(422)
      await status(c.admin, id, 'review')
      const noReason = await status(c.admin, id, 'draft') // review -> draft needs a reason
      expect(noReason.status).toBe(422)
      expect(noReason.body.error.fields.reason).toBe('Sila nyatakan sebab.')
      expect((await status(c.admin, id, 'draft', 'Jawapan tidak jelas.')).status).toBe(200)
      expect((await status(c.admin, '987654321', 'review')).status).toBe(404)
      expect((await check(c.admin, '987654321')).status).toBe(404)
    })

    it('a CSRF-less status call is refused', async () => {
      const id = await draft()
      const res = await c.admin.noCsrf.post(`/api/questions/${id}/status`, { to: 'review' })
      expect(res.status).toBe(403)
    })
  })

  describe('migration 0102', () => {
    it('only the six cognitive levels are stored, and only on a leaf', async () => {
      const id = await draft()
      const part = (await t.db.query<{ id: string }>(`select p.id::text id from question_parts p join question_versions v on v.id = p.question_version_id where v.question_id = $1::bigint limit 1`, [id]))[0]!.id
      await expect(t.db.query(`update question_parts set cognitive_level = 'kreatif' where id = $1::bigint`, [part])).rejects.toThrow()
      await expect(t.db.query(`update question_parts set cognitive_level = 'mencipta' where id = $1::bigint`, [part])).resolves.toBeDefined()
      const branch = (await t.db.query<{ id: string }>(`insert into question_parts (question_version_id, position, depth, label, prompt_ms) select question_version_id, 9, 1, 'z', 'x' from question_parts where id = $1::bigint returning id::text id`, [part]))[0]!.id
      await expect(t.db.query(`update question_parts set cognitive_level = 'menilai' where id = $1::bigint`, [branch])).rejects.toThrow()
    })
  })
})
