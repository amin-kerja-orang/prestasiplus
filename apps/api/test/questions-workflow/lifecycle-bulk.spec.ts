import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionWorkflowService } from '../../src/modules/questions/workflow'
import { bootWorkflowApp, count, loginAll, type Client, type WorkflowTestApp } from './helpers'
import { actorOf, failure } from './lifecycle-support'

describe('bulk transition (BE-10 AC 1 no bypass)', () => {
  let t: WorkflowTestApp
  let c: Record<'admin' | 'teacher' | 'otherTeacher' | 'schoolAdmin' | 'student', Client>
  let svc: QuestionWorkflowService
  beforeAll(async () => {
    t = await bootWorkflowApp()
    c = await loginAll(t)
    svc = t.app.get(QuestionWorkflowService)
  })
  afterAll(async () => {
    await t.close()
  })

  it('moves the passing questions and reports the rest with code and fields', async () => {
    t.fake.seed({ id: '5001', status: 'draft' })
    t.fake.seed({ id: '5002', status: 'draft', gate: { chapterId: null } })
    t.fake.seed({ id: '5003', status: 'published' }) // published -> review is not in the table
    const res = await svc.bulkTransition(['5001', '5002', '5003', '5999'], 'review', actorOf(c.admin))
    expect(res.affected).toBe(1)
    expect(res.skipped).toEqual([
      { id: '5002', code: 'VALIDATION_ERROR', fields: { chapterId: 'Sila pilih bab.' } },
      { id: '5003', code: 'CONFLICT', fields: {} },
      { id: '5999', code: 'NOT_FOUND', fields: {} },
    ])
    expect((await t.fake.getStatus('5001'))?.status).toBe('review')
    expect((await t.fake.getStatus('5002'))?.status).toBe('draft')
    expect(await count(t.db, "select count(*) n from question_status_events where question_id between 5001 and 5003")).toBe(1)
  })

  it('a Guru skips the questions of others (404) and an invalid status is 422 for the whole call', async () => {
    t.fake.seed({ id: '5010', status: 'draft', createdById: c.teacher.userId })
    t.fake.seed({ id: '5011', status: 'draft', createdById: c.otherTeacher.userId })
    const res = await svc.bulkTransition(['5010', '5011'], 'archived', actorOf(c.teacher))
    expect(res.affected).toBe(1)
    expect(res.skipped).toEqual([{ id: '5011', code: 'NOT_FOUND', fields: {} }])
    expect((await failure(svc.bulkTransition(['5010'], 'pending_review', actorOf(c.admin)))).getStatus()).toBe(422)
    expect((await failure(svc.bulkTransition(['5010'], 'review', actorOf(c.schoolAdmin)))).getStatus()).toBe(403)
  })
})
