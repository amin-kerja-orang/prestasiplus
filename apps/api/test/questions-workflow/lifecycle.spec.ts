import { QUESTION_WORKFLOW_STATUSES, QUESTION_WORKFLOW_TRANSITIONS, type QuestionWorkflowStatus } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionWorkflowService } from '../../src/modules/questions/workflow'
import { count, bootWorkflowApp, loginAll, type Client, type WorkflowTestApp } from './helpers'
import { actorOf, failure } from './lifecycle-support'

const events = (t: WorkflowTestApp, id: string) =>
  t.db.query<{ from_status: string | null; to_status: string; actor_role: string; reason: string | null; version_no: number }>(
    'select from_status, to_status, actor_role, reason, version_no from question_status_events where question_id = $1 order by id',
    [id],
  )

describe('lifecycle transition (BE-10 AC 1, 2, 12)', () => {
  let t: WorkflowTestApp
  let c: Record<'admin' | 'teacher' | 'otherTeacher' | 'schoolAdmin' | 'student', Client>
  let svc: QuestionWorkflowService
  let seq = 1000
  beforeAll(async () => {
    t = await bootWorkflowApp()
    c = await loginAll(t)
    svc = t.app.get(QuestionWorkflowService)
  })
  afterAll(async () => {
    await t.close()
  })

  type Role = 'admin' | 'teacher' | 'otherTeacher' | 'schoolAdmin'
  const roles: Role[] = ['admin', 'teacher', 'otherTeacher', 'schoolAdmin']

  function expected(role: Role, from: QuestionWorkflowStatus, to: QuestionWorkflowStatus): 'ok' | 403 | 404 | 409 {
    if (role === 'schoolAdmin') return 403
    if (role === 'otherTeacher') return 404
    const rule = QUESTION_WORKFLOW_TRANSITIONS.find((r) => r.from === from && r.to === to)
    if (!rule) return 409
    return rule.actors.includes(role === 'admin' ? 'admin' : 'owner_teacher') ? 'ok' : 403
  }

  const cases = QUESTION_WORKFLOW_STATUSES.flatMap((from) =>
    QUESTION_WORKFLOW_STATUSES.flatMap((to) => roles.map((role) => [from, to, role] as const)),
  )
  it.each(cases)('%s -> %s as %s', async (from, to, role) => {
    const id = String(++seq)
    t.fake.seed({ id, status: from, createdById: c.teacher.userId })
    const want = expected(role, from, to)
    const run = () => svc.transition(id, to, actorOf(c[role]), { reason: 'Sebab ujian' })
    if (want === 'ok') {
      const res = await run()
      expect(res.to).toBe(to)
      expect((await t.fake.getStatus(id))?.status).toBe(to)
      const rows = await events(t, id)
      expect(rows).toHaveLength(1)
      expect(rows.at(-1)).toMatchObject({ to_status: to, actor_role: c[role].role, version_no: 1 })
      expect(rows[0]?.from_status).toBe(from)
    } else {
      const e = await failure(run)
      expect(e.getStatus()).toBe(want)
      expect(e.code).toBe(want === 403 ? 'FORBIDDEN' : want === 404 ? 'NOT_FOUND' : 'CONFLICT')
      expect(await events(t, id)).toHaveLength(0)
      expect((await t.fake.getStatus(id))?.status).toBe(from)
    }
  })

  it('a status outside the v2 codes is 422, an unknown id is 404', async () => {
    t.fake.seed({ id: '2001', status: 'review' })
    for (const bad of ['pending_review', 'rejected', '']) {
      const e = await failure(svc.transition('2001', bad, actorOf(c.admin)))
      expect(e.getStatus()).toBe(422)
      expect(e.code).toBe('VALIDATION_ERROR')
      expect(e.fields?.status).toBe('Status tidak sah.')
    }
    expect((await failure(svc.transition('999999', 'review', actorOf(c.admin)))).getStatus()).toBe(404)
  })

  it('a reason is mandatory for return to Draf, withdraw: blank is 422 and is recorded when given', async () => {
    t.fake.seed({ id: '2002', status: 'approved' })
    for (const reason of [undefined, null, '   ']) {
      const e = await failure(svc.transition('2002', 'archived', actorOf(c.admin), { reason }))
      expect(e.getStatus()).toBe(422)
      expect(e.fields?.reason).toBe('Sila nyatakan sebab.')
    }
    expect(await events(t, '2002')).toHaveLength(0)
    await svc.transition('2002', 'archived', actorOf(c.admin), { reason: '  Silap fakta ' })
    expect((await events(t, '2002'))[0]?.reason).toBe('Silap fakta')
    // restore from archived needs no reason (table)
    await svc.transition('2002', 'draft', actorOf(c.admin))
    expect(await count(t.db, 'select count(*) n from question_status_events where question_id = 2002')).toBe(2)
  })

  it('review to approved (Terbitkan) is one step: one merged gate, one event, no approved-to-published hop (ADR-0027)', async () => {
    t.fake.seed({ id: '2003', status: 'review', gate: { rightsStatus: 'unclear' } })
    const e = await failure(svc.transition('2003', 'approved', actorOf(c.admin)))
    expect(e.details).toEqual({ gate: 'approve' })
    expect(e.fields).toHaveProperty('rightsStatus') // a former publish-gate rule now runs in the approve gate
    expect(await events(t, '2003')).toHaveLength(0)
    t.fake.seed({ id: '2004', status: 'review' })
    const res = await svc.transition('2004', 'approved', actorOf(c.admin))
    expect(res.events).toEqual([{ from: 'review', to: 'approved' }])
    expect((await events(t, '2004')).map((r) => r.to_status)).toEqual(['approved'])
    // `published` is no longer a status: a request for it is a 422, never a transition
    t.fake.seed({ id: '2006', status: 'review' })
    const gone = await failure(svc.transition('2006', 'published', actorOf(c.admin)))
    expect(gone.getStatus()).toBe(422)
    expect(gone.fields?.status).toBe('Status tidak sah.')
  })

  it('the bank is told who acted and the archive hint', async () => {
    t.fake.seed({ id: '2005', status: 'draft', createdById: c.teacher.userId })
    await svc.transition('2005', 'review', actorOf(c.teacher))
    const call = t.fake.calls.filter((x) => x.method === 'setStatus' && x.args[0] === '2005').at(-1)
    expect(call?.args[2]).toBe(c.teacher.userId)
    expect(call?.args[3]).toMatchObject({ actor: 'owner_teacher' })
  })
})
