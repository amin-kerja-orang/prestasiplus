import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionWorkflowService } from '../../src/modules/questions/workflow'
import { bootWorkflowApp, loginAll, type Client, type WorkflowTestApp } from './helpers'
import { actorOf } from './lifecycle-support'

describe('publishing marks reports fixed (BE-10 AC 11)', () => {
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
  const file = async (qid: string, version: number) =>
    (await t.db.query<{ id: string }>(
      `insert into question_reports (question_id, question_version_no, reporter_id, reasons, source)
       values ($1::bigint, $2, $3::bigint, array['wrong_answer'], 'latihan') returning id::text`,
      [qid, version, c.student.userId],
    ))[0]!.id
  const state = async (id: string) =>
    (await t.db.query<{ status: string; fixed_in_version_no: number | null }>('select status, fixed_in_version_no from question_reports where id = $1::bigint', [id]))[0]!

  it('review to approved (version 2) marks older open reports fixed with the fixing version', async () => {
    t.fake.seed({ id: '8001', status: 'review', latestVersionNo: 2, liveVersionNo: 1 })
    const old = await file('8001', 1)
    const sameVersion = await file('8001', 2)
    await svc.transition('8001', 'approved', actorOf(c.admin))
    expect(await state(old)).toEqual({ status: 'fixed', fixed_in_version_no: 2 })
    expect((await state(sameVersion)).status).toBe('pending')
  })

  it('a failed publish leaves the report open', async () => {
    t.fake.seed({ id: '8003', status: 'review', latestVersionNo: 2, liveVersionNo: 1 })
    const r = await file('8003', 1)
    t.fake.failNextSetStatus = new Error('boom')
    await expect(svc.transition('8003', 'approved', actorOf(c.admin))).rejects.toThrow('boom')
    expect(await state(r)).toEqual({ status: 'pending', fixed_in_version_no: null })
  })
})
