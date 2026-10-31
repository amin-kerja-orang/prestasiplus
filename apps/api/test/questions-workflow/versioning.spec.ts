import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionWorkflowService } from '../../src/modules/questions/workflow'
import { bootWorkflowApp, loginAll, type Client, type WorkflowTestApp } from './helpers'
import { actorOf } from './lifecycle-support'

describe('versioning (BE-10 AC 10)', () => {
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
  const events = (id: string) => t.db.query<{ to_status: string; version_no: number }>('select to_status, version_no from question_status_events where question_id = $1', [id])

  it('publishing version 2 goes through setStatus once and records version 2', async () => {
    t.fake.seed({ id: '7001', status: 'review', latestVersionNo: 2, liveVersionNo: 1 })
    await svc.transition('7001', 'approved', actorOf(c.admin))
    expect((await t.fake.getStatus('7001'))?.liveVersionNo).toBe(2)
    expect(await events('7001')).toEqual([{ to_status: 'approved', version_no: 2 }])
    expect(t.fake.calls.filter((x) => x.method === 'setStatus' && x.args[0] === '7001')).toHaveLength(1)
  })

  it('a failing publish rolls back: no status event, version 1 stays live', async () => {
    t.fake.seed({ id: '7002', status: 'review', latestVersionNo: 2, liveVersionNo: 1 })
    t.fake.failNextSetStatus = new Error('boom')
    await expect(svc.transition('7002', 'approved', actorOf(c.admin))).rejects.toThrow('boom')
    expect(await events('7002')).toHaveLength(0)
    const q = await t.fake.getStatus('7002')
    expect(q?.liveVersionNo).toBe(1)
    expect(q?.status).toBe('review')
  })
})
