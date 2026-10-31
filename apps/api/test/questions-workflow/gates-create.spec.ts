import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionWorkflowService, type CreateGateInput } from '../../src/modules/questions/workflow'
import { bootWorkflowApp, loginAll, type Client, type WorkflowTestApp } from './helpers'
import { actorOf, failure, workingPart } from './lifecycle-support'

const passing = (status: CreateGateInput['status'], over: Partial<CreateGateInput> = {}): CreateGateInput => ({
  status,
  parts: [workingPart(3, 3)],
  marks: 3,
  subjectId: '1',
  educationLevelId: '1',
  chapterId: '1',
  unitId: '1',
  spIds: ['1'],
  tp: 3,
  rightsStatus: 'own',
  hasSourceDeclaration: true,
  unconfirmedLowConfidenceFields: [],
  hasOpenDuplicateFlag: false,
  mediaResolved: true,
  missingRequiredFields: [],
  lastEditedByAi: false,
  ...over,
})

describe('create gate hook (BE-10 AC 1 "no bypass", LEAD note)', () => {
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

  it('draft needs no gate for admin or Guru, even when incomplete', () => {
    const bare = passing('draft', { subjectId: null, hasSourceDeclaration: false })
    expect(() => svc.assertCreateAllowed(bare, actorOf(c.admin))).not.toThrow()
    expect(() => svc.assertCreateAllowed(bare, actorOf(c.teacher))).not.toThrow()
  })

  it('created as review runs the submit gate', async () => {
    expect(() => svc.assertCreateAllowed(passing('review'), actorOf(c.teacher))).not.toThrow()
    const e = await failure(() => svc.assertCreateAllowed(passing('review', { chapterId: null }), actorOf(c.teacher)))
    expect(e.getStatus()).toBe(422)
    expect(e.details).toEqual({ gate: 'submit' })
    expect(e.fields).toHaveProperty('chapterId')
  })

  it('created as approved runs submit and the merged approve gate, including the key marks check', async () => {
    expect(() => svc.assertCreateAllowed(passing('approved'), actorOf(c.admin))).not.toThrow()
    const keys = await failure(() => svc.assertCreateAllowed(passing('approved', { parts: [workingPart(3, 2)] }), actorOf(c.admin)))
    expect(keys.getStatus()).toBe(422)
    expect(keys.details).toEqual({ gate: 'approve' }) // the former publish rules run in the merged approve gate
    expect(keys.fields?.['parts.a.key']).toBe('Jumlah markah tidak sepadan dengan skema.')
    const submit = await failure(() => svc.assertCreateAllowed(passing('approved', { hasSourceDeclaration: false }), actorOf(c.admin)))
    expect(submit.details).toEqual({ gate: 'submit' })
    const approve = await failure(() => svc.assertCreateAllowed(passing('approved', { marks: 9 }), actorOf(c.admin)))
    expect(approve.details).toEqual({ gate: 'approve' })
  })

  it('a Guru may create only draft or review; other roles 403; archived and unknown codes 422', async () => {
    for (const status of ['approved'] as const) {
      expect((await failure(() => svc.assertCreateAllowed(passing(status), actorOf(c.teacher)))).getStatus()).toBe(403)
    }
    expect((await failure(() => svc.assertCreateAllowed(passing('draft'), actorOf(c.schoolAdmin)))).getStatus()).toBe(403)
    expect((await failure(() => svc.assertCreateAllowed(passing('archived'), actorOf(c.admin)))).getStatus()).toBe(422)
    const bad = { ...passing('draft'), status: 'rejected' } as unknown as CreateGateInput
    expect((await failure(() => svc.assertCreateAllowed(bad, actorOf(c.admin)))).getStatus()).toBe(422)
  })

  it('recordCreation writes the creation event with from_status null', async () => {
    await svc.recordCreation('4001', 'review', actorOf(c.teacher), 1)
    const rows = await t.db.query<{ from_status: string | null; to_status: string; version_no: number; actor_role: string }>(
      'select from_status, to_status, version_no, actor_role from question_status_events where question_id = 4001',
    )
    expect(rows).toEqual([{ from_status: null, to_status: 'review', version_no: 1, actor_role: 'teacher' }])
  })
})
