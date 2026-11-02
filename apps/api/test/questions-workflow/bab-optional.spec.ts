import { QuestionGateCheckSchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { OverviewRepository } from '../../src/modules/practice/reads/overview/overview.repository'
import { bootWorkflowApp, loginAll, type Client, type WorkflowTestApp } from './helpers'

/**
 * REQ-B-071 (Mandor Q17, V2): the Bab (chapter) is a filter and report tag, not a gate. Semakan (submit) and Terbitkan (approve) do not ask
 * for it; AC-03.2 keeps the DSKP check (unit, SP, TP, per-leaf cognitive level, kertas for SPM) at Terbitkan. When a question is approved
 * without a Bab and its DSKP unit maps to exactly one active Bab (`chapters.dskp_code` = the unit's printed code), the Bab is
 * filled so Soalan by Chapter, Peta Belajar and Latihan Bab still count it. Real bank, real routes.
 */
describe('REQ-B-071: the Bab is optional at Semakan and Terbitkan; it is derived from the DSKP node at Terbitkan', () => {
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
    tag: { unitId: tag.unitId, spIds: [tag.spId], tp: 3 },
    ...over,
  })
  /** A draft with NO Bab (what a CSV import row or an accepted intake item is). */
  async function chapterless(over: Record<string, unknown> = {}, status: 'draft' | 'review' = 'draft'): Promise<string> {
    const res = await c.admin.post('/api/questions', body({ status, ...over }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const id = res.body.data.id as string
    expect(await chapterOf(id)).toBeNull()
    return id
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
        [tag.subjectId, tag.levelId, `Bab REQ-B-071 ${String(++counter)}`, 900 + counter, dskpCode],
      )
    )[0]!.id
  const practiceCount = async (chapterId: string) => (await new OverviewRepository({ client: t.db.prisma } as never).chapterQuestionCounts([chapterId])).get(chapterId) ?? 0

  describe('Semakan (submit) without a Bab', () => {
    it('single and bulk: chapterless drafts (CSV rows, accepted intake items) enter Semakan, N of N, and gate-check submit is ok', async () => {
      const one = await chapterless()
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
      expect(JSON.stringify(res.body)).not.toContain('Sila pilih bab')
      expect(res.body.error.fields).not.toHaveProperty('chapterId')
    })
  })

  describe('Terbitkan (approve) without a Bab', () => {
    it('with a DSKP node and no Bab it passes (single, bulk) and asks for no Bab', async () => {
      const a = await chapterless({}, 'review')
      expect((await gate(a, 'approve')).ok).toBe(true)
      expect((await move(a, 'approved')).status).toBe(200)
      const b = await chapterless({}, 'review')
      const bulk = await c.admin.post('/api/questions/bulk-action', { action: 'approved', ids: [b] })
      expect(bulk.body.data).toEqual({ affected: 1, failed: [] })
      const created = await c.admin.post('/api/questions', body({ status: 'approved' })) // created already approved
      expect(created.status, JSON.stringify(created.body)).toBe(201)
    })

    it('with NO DSKP node it is refused with the issue list (unit, SP), no Bab message, and stays in Semakan', async () => {
      const id = await chapterless({}, 'review')
      await t.db.query(`update question_versions set unit_node_id = null where question_id = $1::bigint`, [id])
      await t.db.query(`delete from question_version_sp_nodes where question_version_id in (select id from question_versions where question_id = $1::bigint)`, [id])
      const check = await gate(id, 'approve')
      expect(check.ok).toBe(false)
      const codes = check.issues.map((i) => i.code)
      expect(codes).toEqual(expect.arrayContaining(['UNIT_MISSING', 'SP_MISSING']))
      expect(codes).not.toContain('CHAPTER_MISSING')
      const res = await move(id, 'approved')
      expect(res.status, JSON.stringify(res.body)).toBe(422)
      expect(res.body.error.fields).toMatchObject({ unitId: 'Sila pilih unit DSKP.', spIds: 'Sila pilih sekurang-kurangnya satu SP DSKP.' })
      expect(JSON.stringify(res.body)).not.toContain('Sila pilih bab')
      expect(await statusOf(id)).toBe('review')
    })
  })

  describe('the Bab is derived at Terbitkan from the DSKP unit (chapters.dskp_code = the unit printed code, exactly one)', () => {
    it('exactly one Bab matches: filled on single approve, bulk approve and create-as-approved; the question is then counted by the chapter read', async () => {
      const chapter = await newChapter(tag.unitCode)
      expect(await practiceCount(chapter)).toBe(0)
      const single = await chapterless({}, 'review')
      expect((await move(single, 'approved')).status).toBe(200)
      expect(await chapterOf(single)).toBe(chapter)
      const viaBulk = await chapterless({}, 'review')
      expect((await c.admin.post('/api/questions/bulk-action', { action: 'approved', ids: [viaBulk] })).body.data.affected).toBe(1)
      expect(await chapterOf(viaBulk)).toBe(chapter)
      const created = await c.admin.post('/api/questions', body({ status: 'approved' }))
      expect(created.status, JSON.stringify(created.body)).toBe(201)
      expect(await chapterOf(created.body.data.id as string)).toBe(chapter)
      // Soalan by Chapter / Latihan Bab: the three approved MCQs are counted for that Bab
      expect(await practiceCount(chapter)).toBe(3)
      await t.db.query(`update chapters set dskp_code = null where id = $1::bigint`, [chapter]) // isolate the next cases
    })

    it('an admin-chosen Bab is never overwritten, even when a different Bab matches the unit code', async () => {
      const matching = await newChapter(tag.unitCode)
      const chosen = await newChapter(null)
      const own = await chapterless({}, 'review')
      await t.db.query(`update question_versions set chapter_id = $2::bigint where question_id = $1::bigint`, [own, chosen])
      expect((await move(own, 'approved')).status).toBe(200)
      expect(await chapterOf(own)).toBe(chosen)
      await t.db.query(`update chapters set dskp_code = null where id = $1::bigint`, [matching])
    })

    it('an SP code is not a bridge (no other heuristic): a Bab carrying only the SP code is not derived', async () => {
      const bySp = await newChapter(tag.spCode)
      const q = await chapterless({}, 'review')
      expect((await move(q, 'approved')).status).toBe(200)
      expect(await chapterOf(q)).toBeNull()
      await t.db.query(`update chapters set dskp_code = null where id = $1::bigint`, [bySp])
    })

    it('no Bab matches (today seed: dskp_code is null everywhere): approved chapterless, and it is not in the chapter read of any Bab', async () => {
      const none = await chapterless({}, 'review')
      expect((await move(none, 'approved')).status).toBe(200)
      expect(await chapterOf(none)).toBeNull()
      const [{ n }] = await t.db.query<{ n: string }>(`select count(*)::text n from chapters where dskp_code is not null`) as [{ n: string }]
      expect(n).toBe('0')
    })

    it('several Babs match the unit code: the question is approved chapterless (never a guess)', async () => {
      const x = await newChapter(tag.unitCode)
      const y = await newChapter(tag.unitCode)
      const several = await chapterless({}, 'review')
      expect((await move(several, 'approved')).status).toBe(200)
      expect(await chapterOf(several)).toBeNull()
      await t.db.query(`update chapters set dskp_code = null where id = any($1::bigint[])`, [[x, y]])
    })
  })
})
