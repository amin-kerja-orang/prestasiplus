import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SERVABILITY_ACTIVITIES } from '@pp/contract'

import { QuestionsRepository, QuestionsService, type QuestionCreateInput } from '../../src/modules/questions'
import { ServabilityService } from '../../src/modules/questions/serving'
import { QuestionWorkflowService } from '../../src/modules/questions/workflow'
import { bootWorkflowApp, loginAll, type Client, type WorkflowTestApp } from './helpers'
import { actorOf, failure } from './lifecycle-support'

/**
 * R1-T45 / AC-05.3 (v2-admin-student-pipeline US-05): `Terbitkan` on a question that is unservable in SOME activity goes through, and
 * the admin reads the per-activity reasons (the servability report); on a question unservable EVERYWHERE it is refused, like the .cloud
 * PublishValidator, with the reasons in BM and nothing changed (status, live version, events).
 */
describe('AC-05.3 Terbitkan: notice when unservable somewhere, refused when unservable everywhere', () => {
  let t: WorkflowTestApp
  let c: Record<'admin', Client>
  let wf: QuestionWorkflowService
  let questions: QuestionsService
  let servability: ServabilityService
  let repo: QuestionsRepository
  let tag: { subjectId: string; educationLevelId: string; unitId: string; spId: string; chapterId: string }

  const base = () =>
    ({
      questionText: 'Soalan untuk ujian Terbitkan dan kebolehhidangan.',
      subjectId: tag.subjectId,
      educationLevelId: tag.educationLevelId,
      difficultyLevel: 2,
      tag: { unitId: tag.unitId, spIds: [tag.spId], tp: 3 },
    }) as const

  /** A review-ready question; `chapter` false leaves Bab empty (Latihan Bab then cannot serve it). */
  async function review(over: Record<string, unknown>, chapter = false): Promise<string> {
    const view = await questions.create({ ...base(), ...over } as unknown as QuestionCreateInput, { userId: c.admin.userId, role: 'admin' })
    if (chapter) await t.db.query('update question_versions set chapter_id = $1::bigint where question_id = $2::bigint', [tag.chapterId, view.id])
    await t.db.query(`update question_versions set status = 'review' where question_id = $1::bigint`, [view.id])
    return view.id
  }
  const events = async (id: string) => (await t.db.query('select 1 from question_status_events where question_id = $1::bigint', [id])).length

  beforeAll(async () => {
    t = await bootWorkflowApp({ bank: 'real' })
    c = (await loginAll(t)) as never
    wf = t.app.get(QuestionWorkflowService)
    questions = t.app.get(QuestionsService)
    servability = t.app.get(ServabilityService)
    repo = t.app.get(QuestionsRepository)
    const [row] = await t.db.query<{ subject_id: string; education_level_id: string; unit_node_id: string; sp: string }>(
      `select v.subject_id::text, v.education_level_id::text, v.unit_node_id::text,
              (select node_id::text from question_version_sp_nodes where question_version_id = v.id limit 1) as sp
         from question_versions v where v.number_label = 'SEED-MCQ-MATH-T4'`,
    )
    const [ch] = await t.db.query<{ id: string }>('select id::text from chapters where subject_id = $1::bigint and education_level_id = $2::bigint limit 1', [row!.subject_id, row!.education_level_id])
    tag = { subjectId: row!.subject_id, educationLevelId: row!.education_level_id, unitId: row!.unit_node_id, spId: row!.sp, chapterId: ch!.id }
  })
  afterAll(async () => {
    await t.close()
  })

  it('unservable in some activity: approval proceeds and the report lists each activity and its reason (the notice)', async () => {
    // Text MCQ without a chapter: served by the Bijak bridge, Kuiz and Jana, but Latihan Bab cannot take it (no chapter).
    const id = await review({ questionType: 'mcq', options: ['4', '5', '6', '7'], correctAnswer: 1 })
    const r = await wf.transition(id, 'approved', actorOf(c.admin))
    expect(r).toMatchObject({ id, from: 'review', to: 'approved' })
    expect(await repo.get(id, 'live')).not.toBeNull()
    const report = await servability.report(id)
    expect(report?.activities.map((a) => a.activity)).toEqual([...SERVABILITY_ACTIVITIES])
    const bab = report?.activities.find((a) => a.activity === 'bab')
    expect(bab?.served).toBe(false)
    expect(bab?.reasons[0]?.code).toBe('no_chapter')
    expect(bab?.reasons[0]?.message.length).toBeGreaterThan(10)
    expect(report?.servedCount).toBeGreaterThan(0)
    expect(report?.servedCount).toBeLessThan(report?.total ?? 0)
  })

  it('unservable everywhere: approval is refused (422, BM reasons per activity) and nothing changes', async () => {
    // A table_fill leaf: the Bijak bridge refuses it, and it is neither a plain MCQ (Databank, Latih Tubi, Bab, Kuiz) nor Jana-eligible.
    const id = await review({
      questionType: 'essay',
      questionText: 'Isikan jadual yang berikut.',
      parts: [{ label: '(a)', prompt: { ms: 'Isi jadual' }, mode: 'table_fill', marks: 2, key: { kind: 'mapping', cells: { r1: ['x'] } } }],
    })
    const before = await events(id)
    const e = await failure(wf.transition(id, 'approved', actorOf(c.admin)))
    expect(e.code).toBe('VALIDATION_ERROR')
    const fields = e.fields ?? {}
    expect(Object.keys(fields).length).toBeGreaterThan(0)
    for (const message of Object.values(fields)) expect(message.length).toBeGreaterThan(10)
    expect(await t.bank.getStatus(id)).toMatchObject({ status: 'review', liveVersionNo: null })
    expect(await events(id)).toBe(before)
    expect(await repo.get(id, 'live')).toBeNull()
  })

  it('a refused question can be approved once it is fixed (the refusal leaves it in review)', async () => {
    const id = await review({
      questionType: 'essay',
      questionText: 'Isikan jadual yang berikut (dibetulkan).',
      parts: [{ label: '(a)', prompt: { ms: 'Isi jadual' }, mode: 'table_fill', marks: 2, key: { kind: 'mapping', cells: { r1: ['x'] } } }],
    })
    await failure(wf.transition(id, 'approved', actorOf(c.admin)))
    // Fixed: the unservable table_fill leaf is replaced by a short-answer leaf the Bijak bridge serves.
    const fixed = { ...base(), questionType: 'essay', questionText: 'Soalan jawapan pendek selepas dibetulkan.', parts: [{ label: '(a)', prompt: { ms: 'Jawab' }, mode: 'short_text', marks: 2, key: { kind: 'accepted', values: ['x'] } }] }
    await questions.update(id, fixed as never, { userId: c.admin.userId, role: 'admin' })
    expect((await wf.transition(id, 'approved', actorOf(c.admin))).to).toBe('approved')
  })
})
