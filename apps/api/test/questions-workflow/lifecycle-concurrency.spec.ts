import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionWorkflowService } from '../../src/modules/questions/workflow'
import { bootWorkflowApp, loginAll, type Client, type WorkflowTestApp } from './helpers'
import { actorOf, failure } from './lifecycle-support'

describe('lifecycle concurrency and live version (BE-10 review M3, M4)', () => {
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

  it('a status change between the read and the write is 409 and writes no event', async () => {
    const q = t.fake.seed({ id: '9101', status: 'draft' })
    const real = t.fake.getForGates.bind(t.fake)
    t.fake.getForGates = async (id) => {
      q.status = 'archived' // another request wins the race after our read
      return real(id)
    }
    const e = await failure(svc.transition('9101', 'review', actorOf(c.admin)))
    t.fake.getForGates = real
    expect(e.getStatus()).toBe(409)
    expect(e.code).toBe('CONFLICT')
    expect(await t.db.query('select 1 from question_status_events where question_id = 9101')).toHaveLength(0)
    expect(q.status).toBe('archived')
  })

  it('setStatus is called with the status that was read', async () => {
    t.fake.seed({ id: '9102', status: 'published' })
    await svc.transition('9102', 'archived', actorOf(c.admin), { reason: 'x' })
    const call = t.fake.calls.filter((x) => x.method === 'setStatus' && x.args[0] === '9102').at(-1)
    expect(call?.args[3]).toMatchObject({ expectedFrom: 'published' })
  })
})
