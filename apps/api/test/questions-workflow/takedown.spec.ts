import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionWorkflowService } from '../../src/modules/questions/workflow'
import { bootWorkflowApp, loginAll, type Client, type WorkflowTestApp } from './helpers'
import { actorOf, failure } from './lifecycle-support'

describe('source takedown (BE-10 AC 6)', () => {
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
  const paper = async () => (await t.db.query<{ id: string }>("insert into source_papers (rights_status) values ('own') returning id::text"))[0]!.id

  it('marks the paper and archives every non-archived question with one event each', async () => {
    const id = await paper()
    const other = await paper()
    for (const [qid, status] of [['6001', 'draft'], ['6002', 'review'], ['6003', 'approved'], ['6004', 'published'], ['6005', 'archived']] as const) {
      t.fake.seed({ id: qid, status, sourcePaperId: id })
    }
    t.fake.seed({ id: '6006', status: 'published', sourcePaperId: other })
    const res = await svc.takedownSource(id, actorOf(c.admin), 'Hak cipta ditarik balik')
    expect(res).toEqual({ sourcePaperId: id, archived: 4, skipped: 1 })
    for (const qid of ['6001', '6002', '6003', '6004', '6005']) expect((await t.fake.getStatus(qid))?.status).toBe('archived')
    expect((await t.fake.getStatus('6004'))?.liveVersionNo).toBeNull()
    expect((await t.fake.getStatus('6006'))?.status).toBe('published')
    const ev = await t.db.query<{ question_id: string; from_status: string; reason: string }>(
      'select question_id::text, from_status, reason from question_status_events where question_id between 6001 and 6006 order by question_id',
    )
    expect(ev.map((e) => e.question_id)).toEqual(['6001', '6002', '6003', '6004'])
    expect(new Set(ev.map((e) => e.reason))).toEqual(new Set(['Hak cipta ditarik balik']))
    const hint = t.fake.calls.find((x) => x.method === 'setStatus' && x.args[0] === '6002')
    expect(hint?.args[3]).toMatchObject({ archiveReason: 'source_takedown' })
    const [row] = await t.db.query<{ takedown_at: Date | null; takedown_by_id: string | null }>(
      'select takedown_at, takedown_by_id::text from source_papers where id = $1',
      [id],
    )
    expect(row?.takedown_at).not.toBeNull()
    expect(row?.takedown_by_id).toBe(c.admin.userId)
  })

  it('is admin only, needs a reason and a known paper', async () => {
    const id = await paper()
    for (const who of ['teacher', 'schoolAdmin', 'student'] as const) {
      expect((await failure(svc.takedownSource(id, actorOf(c[who]), 'x'))).getStatus()).toBe(403)
    }
    expect((await failure(svc.takedownSource(id, actorOf(c.admin), '  '))).fields?.reason).toBeTruthy()
    expect((await failure(svc.takedownSource('99999', actorOf(c.admin), 'x'))).getStatus()).toBe(404)
    expect((await failure(svc.takedownSource('abc', actorOf(c.admin), 'x'))).getStatus()).toBe(404)
    const [row] = await t.db.query<{ takedown_at: Date | null }>('select takedown_at from source_papers where id = $1', [id])
    expect(row?.takedown_at).toBeNull()
  })

  it('a failure while archiving rolls the takedown back (paper mark and earlier events)', async () => {
    const id = await paper()
    t.fake.seed({ id: '6101', status: 'draft', sourcePaperId: id })
    t.fake.seed({ id: '6102', status: 'draft', sourcePaperId: id })
    const real = t.fake.setStatus.bind(t.fake)
    let n = 0
    t.fake.setStatus = async (...args: Parameters<typeof real>) => {
      if (++n === 2) throw new Error('boom')
      return real(...args)
    }
    await expect(svc.takedownSource(id, actorOf(c.admin), 'Sebab')).rejects.toThrow('boom')
    t.fake.setStatus = real
    expect(await t.db.query('select 1 from question_status_events where question_id in (6101, 6102)')).toHaveLength(0)
    const [row] = await t.db.query<{ takedown_at: Date | null }>('select takedown_at from source_papers where id = $1', [id])
    expect(row?.takedown_at).toBeNull()
  })
})
