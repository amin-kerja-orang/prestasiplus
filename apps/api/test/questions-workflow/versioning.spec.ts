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
    t.fake.seed({ id: '7001', status: 'approved', latestVersionNo: 2, liveVersionNo: 1 })
    await svc.transition('7001', 'published', actorOf(c.admin))
    expect((await t.fake.getStatus('7001'))?.liveVersionNo).toBe(2)
    expect(await events('7001')).toEqual([{ to_status: 'published', version_no: 2 }])
    expect(t.fake.calls.filter((x) => x.method === 'setStatus' && x.args[0] === '7001')).toHaveLength(1)
  })

  it('a failing publish rolls back: no status event, version 1 stays live', async () => {
    t.fake.seed({ id: '7002', status: 'approved', latestVersionNo: 2, liveVersionNo: 1 })
    t.fake.failNextSetStatus = new Error('boom')
    await expect(svc.transition('7002', 'published', actorOf(c.admin))).rejects.toThrow('boom')
    expect(await events('7002')).toHaveLength(0)
    const q = await t.fake.getStatus('7002')
    expect(q?.liveVersionNo).toBe(1)
    expect(q?.status).toBe('approved')
  })

  it('a failure in the second step of Lulus & Terbit rolls back the first event', async () => {
    t.fake.seed({ id: '7003', status: 'review', latestVersionNo: 2, liveVersionNo: 1 })
    const real = t.fake.setStatus.bind(t.fake)
    let n = 0
    t.fake.setStatus = async (...args: Parameters<typeof real>) => {
      if (++n === 2) throw new Error('boom')
      return real(...args)
    }
    await expect(svc.transition('7003', 'published', actorOf(c.admin))).rejects.toThrow('boom')
    t.fake.setStatus = real
    expect(await events('7003')).toHaveLength(0)
    expect((await t.fake.getStatus('7003'))?.liveVersionNo).toBe(1)
  })
})
