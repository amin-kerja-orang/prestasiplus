import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ApiError } from '../../src/common/errors/api-error'
import { QuestionsRepository, QuestionsService, type QuestionCreateInput } from '../../src/modules/questions'
import { QuestionBankAdapter, QuestionWorkflowPorts, QuestionWorkflowService } from '../../src/modules/questions/workflow'
import { bootWorkflowApp, count, loginAll, type Client, type WorkflowTestApp } from './helpers'
import { curriculumIds, uploadClient } from './imports-support'
import { actorOf, failure } from './lifecycle-support'

/** BE-10 on the REAL question bank (BE-09) through `QuestionBankAdapter`. */
describe('question bank adapter (real BE-09 bank)', () => {
  let t: WorkflowTestApp
  let c: Record<'admin' | 'teacher' | 'otherTeacher' | 'schoolAdmin' | 'student', Client>
  let svc: QuestionWorkflowService
  let repo: QuestionsRepository
  let questions: QuestionsService
  let tag: { subjectId: string; educationLevelId: string; unitId: string; spId: string; chapterId: string }

  /** A tagged MCQ draft created through BE-09, with the chapter the submit gate needs. */
  const draft = async (): Promise<string> => {
    const body = {
      questionType: 'mcq',
      questionText: 'Berapakah hasil tambah dua dan tiga?',
      subjectId: tag.subjectId,
      educationLevelId: tag.educationLevelId,
      difficultyLevel: 2,
      options: ['4', '5', '6', '7'],
      correctAnswer: 1,
      tag: { unitId: tag.unitId, spIds: [tag.spId], tp: 3 },
    } as unknown as QuestionCreateInput
    const view = await questions.create(body, { userId: c.admin.userId, role: 'admin' })
    await t.db.query('update question_versions set chapter_id = $1::bigint where question_id = $2::bigint', [tag.chapterId, view.id])
    return view.id
  }
  const eligible = (id: string) => repo.eligibleForPractice(id)

  beforeAll(async () => {
    t = await bootWorkflowApp({ bank: 'real' })
    c = await loginAll(t)
    svc = t.app.get(QuestionWorkflowService)
    repo = t.app.get(QuestionsRepository)
    questions = t.app.get(QuestionsService)
    const [row] = await t.db.query<{ subject_id: string; education_level_id: string; unit_node_id: string; chapter_id: string; sp: string }>(
      `select v.subject_id::text, v.education_level_id::text, v.unit_node_id::text, v.chapter_id::text,
              (select node_id::text from question_version_sp_nodes where question_version_id = v.id limit 1) as sp
         from question_versions v where v.number_label = 'SEED-MCQ-MATH-T4'`,
    )
    // The seed has no chapter on its questions: borrow any tree chapter of the same subject and level.
    const [ch] = await t.db.query<{ id: string }>('select id::text from chapters where subject_id = $1::bigint and education_level_id = $2::bigint limit 1', [row!.subject_id, row!.education_level_id])
    tag = { subjectId: row!.subject_id, educationLevelId: row!.education_level_id, unitId: row!.unit_node_id, spId: row!.sp, chapterId: ch!.id }
  })
  afterAll(async () => {
    await t.close()
  })

  it('the production adapter is what the port holds', () => {
    expect(t.app.get(QuestionWorkflowPorts).questionBank).toBe(t.app.get(QuestionBankAdapter))
  })

  it('a draft walks draft, review, approved, published with one event per step and becomes eligible', async () => {
    const id = await draft()
    const admin = actorOf(c.admin)
    for (const [from, to] of [['draft', 'review'], ['review', 'approved'], ['approved', 'published']] as const) {
      const r = await svc.transition(id, to, admin)
      expect(r).toMatchObject({ id, from, to, versionNo: 1 })
    }
    expect(await t.bank.getStatus(id)).toMatchObject({ status: 'published', latestVersionNo: 1, liveVersionNo: 1, isActive: true })
    expect(await eligible(id)).toBe(true)
    const ev = await t.db.query<{ from_status: string | null; to_status: string; actor_role: string }>(
      'select from_status, to_status, actor_role from question_status_events where question_id = $1::bigint order by id',
      [id],
    )
    expect(ev).toEqual([
      { from_status: 'draft', to_status: 'review', actor_role: 'admin' },
      { from_status: 'review', to_status: 'approved', actor_role: 'admin' },
      { from_status: 'approved', to_status: 'published', actor_role: 'admin' },
    ])
  })

  it('a pair outside the table is 409 and the gates read real data (an untagged draft cannot be submitted)', async () => {
    const id = await draft()
    expect((await failure(svc.transition(id, 'published', actorOf(c.admin)))).code).toBe('CONFLICT')
    const [untagged] = await t.db.query<{ question_id: string }>("select question_id::text from question_versions where number_label = 'SEED-DRAFT-BM-T4'")
    const err = await failure(svc.transition(untagged!.question_id, 'review', actorOf(c.admin)))
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(err.fields).toMatchObject({ chapterId: expect.any(String) })
  })

  it('a stale expectedFrom is a 409 and changes nothing', async () => {
    const id = await draft()
    const err = await failure(t.bank.setStatus(id, 'review', c.admin.userId, { expectedFrom: 'approved' }))
    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe('CONFLICT')
    expect((await t.bank.getStatus(id))?.status).toBe('draft')
    expect(await t.bank.setStatus('999999999', 'review', c.admin.userId)).toBeNull()
  })

  it('a takedown with live v1 and a draft v2 leaves nothing live and archives both versions', async () => {
    const id = await draft()
    for (const to of ['review', 'approved', 'published'] as const) await svc.transition(id, to, actorOf(c.admin))
    // Editing a published question adds version 2 as a draft; version 1 keeps serving.
    await questions.update(
      id,
      { subjectId: tag.subjectId, educationLevelId: tag.educationLevelId, difficultyLevel: 2, questionText: 'Berapakah hasil tambah dua dan empat?', options: ['4', '5', '6', '7'], correctAnswer: 2 } as never,
      { userId: c.admin.userId, role: 'admin' },
    )
    expect(await t.bank.getStatus(id)).toMatchObject({ status: 'draft', latestVersionNo: 2, liveVersionNo: 1 })
    const [paper] = await t.db.query<{ id: string }>("insert into source_papers (rights_status) values ('own') returning id::text")
    await t.db.query('update question_versions set source_paper_id = $1::bigint where question_id = $2::bigint', [paper!.id, id])
    expect(await t.bank.listIdsBySourcePaper(paper!.id)).toEqual([id])

    const res = await svc.takedownSource(paper!.id, actorOf(c.admin), 'Hak cipta ditarik balik')
    expect(res).toMatchObject({ archived: 1 })
    expect(await t.bank.getStatus(id)).toMatchObject({ status: 'archived', liveVersionNo: null })
    expect(await eligible(id)).toBe(false)
    const versions = await t.db.query<{ version_no: number; status: string; archive_reason: string | null }>(
      'select version_no, status, archive_reason from question_versions where question_id = $1::bigint order by version_no',
      [id],
    )
    expect(versions).toEqual([
      { version_no: 1, status: 'archived', archive_reason: 'source_takedown' },
      { version_no: 2, status: 'archived', archive_reason: 'source_takedown' },
    ])
  })

  it('a takedown also archives a review question (outside the transition table)', async () => {
    const id = await draft()
    await svc.transition(id, 'review', actorOf(c.admin))
    const [paper] = await t.db.query<{ id: string }>("insert into source_papers (rights_status) values ('own') returning id::text")
    await t.db.query('update question_versions set source_paper_id = $1::bigint where question_id = $2::bigint', [paper!.id, id])
    await svc.takedownSource(paper!.id, actorOf(c.admin), 'Ditarik balik')
    expect((await t.bank.getStatus(id))?.status).toBe('archived')
  })

  it('withdrawing a published question ends serving (published to archived with a reason)', async () => {
    const id = await draft()
    for (const to of ['review', 'approved', 'published'] as const) await svc.transition(id, to, actorOf(c.admin))
    await svc.transition(id, 'archived', actorOf(c.admin), { reason: 'Salah' })
    expect(await eligible(id)).toBe(false)
    expect(await t.bank.getStatus(id)).toMatchObject({ status: 'archived', liveVersionNo: null })
  })

  it('a student report on a published MCQ deactivates it in the real bank at once', async () => {
    const id = await draft()
    for (const to of ['review', 'approved', 'published'] as const) await svc.transition(id, to, actorOf(c.admin))
    expect(await eligible(id)).toBe(true)
    const res = await c.student.post('/api/question-reports', { questionId: id, reasons: ['wrong_answer'] })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(await t.bank.getStatus(id)).toMatchObject({ isActive: false, status: 'published' })
    expect(await eligible(id)).toBe(false)
  })

  it('describe gives names and the wire type', async () => {
    const [seed] = await t.db.query<{ question_id: string }>("select question_id::text from question_versions where number_label = 'SEED-MCQ-MATH-T4'")
    const [str] = await t.db.query<{ question_id: string }>("select question_id::text from question_versions where number_label = 'SEED-STR-TREE'")
    const m = await t.bank.describe([seed!.question_id, str!.question_id, '999999999'])
    expect(m.size).toBe(2)
    expect(m.get(seed!.question_id)).toMatchObject({ type: 'mcq', status: 'published', subjectName: expect.any(String), levelName: expect.any(String) })
    expect(m.get(str!.question_id)?.type).toBe('structured')
  })

  it('the quality audit scores every question of the real bank', async () => {
    const res = await c.admin.post('/api/question-quality/audit')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const total = await count(t.db, 'select count(*) n from questions')
    expect(total).toBeGreaterThan(15)
    expect(await count(t.db, 'select count(*) n from question_quality_scores')).toBe(total)
    expect(await count(t.db, 'select count(*) n from quality_audits')).toBe(1)
  })

  it('the AI explanation stub stores its text on the question and keeps it without force', async () => {
    const [seed] = await t.db.query<{ question_id: string }>("select question_id::text from question_versions where number_label = 'SEED-MCQ-SCI-T4'")
    const id = seed!.question_id
    const first = await c.admin.post(`/api/questions/${id}/ai-explanation`)
    expect(first.status, JSON.stringify(first.body)).toBe(200)
    expect(first.body).toMatchObject({ ok: true, stub: true })
    const [row] = await t.db.query<{ explanation_ms: string }>('select explanation_ms from question_versions where question_id = $1::bigint and version_no = 1', [id])
    expect(row?.explanation_ms).toContain('## Penjelasan')
    expect((await c.admin.post(`/api/questions/${id}/ai-explanation`)).body.message).toBe('Penjelasan AI sudah wujud.')
    expect((await c.admin.post('/api/questions/999999999/ai-explanation')).status).toBe(404)
  })

  it('a Guru CSV import creates real review questions owned by the Guru', async () => {
    const ids = await curriculumIds(t)
    const teacher = await uploadClient(t, 'teacher')
    const head = 'question_text,option_a,option_b,option_c,option_d,correct_answer,subject_id,education_level_id,difficulty_level,marks,explanation'
    const tail = `${ids.subject},${ids.level},2,1,`
    const file = [head, `"Apakah ibu negara Malaysia?",Kuala Lumpur,Putrajaya,Johor Bahru,Ipoh,a,${tail}`, `"Apakah warna langit biru?",Merah,Hijau,Biru,Kuning,C,${tail}`, `"Jawapan salah",A,B,C,D,E,${tail}`].join('\n')
    const mine = () => count(t.db, 'select count(*) n from questions where created_by_id = $1::bigint', [teacher.userId])
    const before = await mine()
    const res = await teacher.upload('/api/guru/questions/import', { name: 'guru.csv', body: file })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.imported).toBe(2)
    expect(res.body.data.failed).toEqual([{ row: 4, message: 'Jawapan betul mesti A, B, C atau D.' }])
    expect(await mine()).toBe(before + 2)
    const rows = await t.db.query<{ id: string; status: string; stem_ms: string; correct: string }>(
      `select q.id::text, v.status, v.stem_ms, k.content->>'correct' as correct
         from questions q join question_versions v on v.question_id = q.id and v.version_no = q.latest_version_no
         left join question_parts p on p.question_version_id = v.id left join answer_keys k on k.part_id = p.id
        where q.created_by_id = $1::bigint order by q.id desc limit 2`,
      [teacher.userId],
    )
    expect(rows.map((r) => r.status)).toEqual(['review', 'review'])
    expect(rows[0]?.stem_ms).toBe('Apakah warna langit biru?')
    expect(rows[0]?.correct).toBe('C')
    const other = await failure(svc.transition(rows[0]!.id, 'draft', actorOf(c.otherTeacher)))
    expect(other.code).toBe('NOT_FOUND')
    expect((await svc.transition(rows[0]!.id, 'draft', actorOf(c.admin), { reason: 'Semak semula' })).to).toBe('draft')
  })

  it('a row with fewer than 3 options is a failed row and the other rows still import', async () => {
    const ids = await curriculumIds(t)
    const teacher = await uploadClient(t, 'teacher')
    const head = 'question_text,option_a,option_b,option_c,option_d,correct_answer,subject_id,education_level_id,difficulty_level,marks,explanation'
    const tail = `${ids.subject},${ids.level},2,1,`
    const file = [head, `"Dua pilihan sahaja",A,B,,,B,${tail}`, `"Apakah warna rumput segar?",Merah,Hijau,Biru,,B,${tail}`].join('\n')
    const before = await count(t.db, 'select count(*) n from questions')
    const res = await teacher.upload('/api/guru/questions/import', { name: 'dua.csv', body: file })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data).toEqual({ imported: 1, failed: [{ row: 2, message: 'Pilihan jawapan mesti sekurang-kurangnya 3.' }] })
    expect(await count(t.db, 'select count(*) n from questions')).toBe(before + 1)
  })
})
