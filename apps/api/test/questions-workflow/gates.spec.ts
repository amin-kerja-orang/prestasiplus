import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { approveGate, publishGate, submitGate } from '../../src/modules/questions/workflow/lifecycle'
import { QuestionWorkflowService, type QuestionGateData } from '../../src/modules/questions/workflow'
import { bootWorkflowApp, loginAll, type Client, type WorkflowTestApp } from './helpers'
import { actorOf, failure, workingPart } from './lifecycle-support'

type Gate = 'submit' | 'approve' | 'publish'
// ADR-0027: `publish` rules are part 2 of the one merged approve gate (review to approved, "Terbitkan"); a failure reports gate `approve`.
const START_STATUS = { submit: 'draft', approve: 'review', publish: 'review' } as const
const TARGET = { submit: 'review', approve: 'approved', publish: 'approved' } as const

/** One failing question per gate rule: [gate, rule, gate-data override, field expected in `fields`]. */
const RULES: [Gate, string, Partial<QuestionGateData>, string][] = [
  ['submit', 'required fields present', { missingRequiredFields: ['stem'] }, 'stem'],
  ['submit', 'low-confidence confirmed', { unconfirmedLowConfidenceFields: ['year'] }, 'year'],
  ['submit', 'subject set', { subjectId: null }, 'subjectId'],
  ['submit', 'level set', { educationLevelId: null }, 'educationLevelId'],
  ['submit', 'chapter set', { chapterId: null }, 'chapterId'],
  ['submit', 'duplicate resolved', { hasOpenDuplicateFlag: true }, 'duplicate'],
  ['submit', 'source declaration', { hasSourceDeclaration: false }, 'source'],
  ['approve', 'reviewer is not the AI service', { lastEditedByAi: true }, 'reviewer'],
  ['approve', 'tags valid (unit)', { unitId: null }, 'unitId'],
  ['approve', 'tags valid (SP)', { spIds: [] }, 'spIds'],
  ['approve', 'marks total equals part marks', { parts: [workingPart(3, 3)], marks: 5 }, 'marks'],
  ['approve', 'media resolved', { mediaResolved: false }, 'media'],
  ['publish', 'answer key matches marks', { parts: [workingPart(3, 2)], marks: 3 }, 'parts.a.key'],
  ['publish', 'difficulty set', { tp: null }, 'tp'],
  ['publish', 'DSKP unit chosen', { unitId: null }, 'unitId'],
  ['publish', 'copyright not "belum jelas"', { rightsStatus: 'unclear' }, 'rightsStatus'],
  ['publish', 'no copyright declaration', { rightsStatus: null }, 'rightsStatus'],
  ['publish', 'no open duplicate flag', { hasOpenDuplicateFlag: true }, 'duplicate'],
]

describe('lifecycle gates (BE-10 AC 1, 12)', () => {
  let t: WorkflowTestApp
  let c: Record<'admin' | 'teacher' | 'otherTeacher' | 'schoolAdmin' | 'student', Client>
  let svc: QuestionWorkflowService
  let seq = 3000
  beforeAll(async () => {
    t = await bootWorkflowApp()
    c = await loginAll(t)
    svc = t.app.get(QuestionWorkflowService)
  })
  afterAll(async () => {
    await t.close()
  })

  it.each(RULES)('%s gate: %s fails with 422, the gate name and the field', async (gate, _rule, override, field) => {
    const id = String(++seq)
    t.fake.seed({ id, status: START_STATUS[gate], createdById: c.teacher.userId, gate: override })
    const e = await failure(svc.transition(id, TARGET[gate], actorOf(c.admin)))
    expect(e.getStatus()).toBe(422)
    expect(e.code).toBe('VALIDATION_ERROR')
    expect(e.details).toEqual({ gate: gate === 'publish' ? 'approve' : gate })
    expect(e.fields).toHaveProperty([field])
    expect((await t.fake.getStatus(id))?.status).toBe(START_STATUS[gate])
    expect(await t.db.query('select 1 from question_status_events where question_id = $1', [id])).toHaveLength(0)
  })

  it('a Guru submitting their own draft hits the submit gate too', async () => {
    t.fake.seed({ id: '3900', status: 'draft', createdById: c.teacher.userId, gate: { chapterId: null } })
    const e = await failure(svc.transition('3900', 'review', actorOf(c.teacher)))
    expect(e.details).toEqual({ gate: 'submit' })
  })

  it('a passing question passes every gate; a Guru-archive of a draft needs no gate', async () => {
    t.fake.seed({ id: '3901', status: 'draft', createdById: c.teacher.userId, gate: { chapterId: null } })
    await expect(svc.transition('3901', 'archived', actorOf(c.teacher))).resolves.toMatchObject({ to: 'archived' })
    const ok = t.fake.seed({ id: '3903' }).gate
    expect(submitGate(ok)).toEqual({})
    expect(approveGate(ok)).toEqual({})
    expect(publishGate(ok)).toEqual({})
  })

  it('gate functions are pure and name each failing rule (AI reviewer flag, multiple fields at once)', () => {
    const base = t.fake.seed({ id: '3902' }).gate
    expect(approveGate(base, true)).toHaveProperty('reviewer')
    const f = submitGate({ ...base, subjectId: null, hasSourceDeclaration: false })
    expect(Object.keys(f).sort()).toEqual(['source', 'subjectId'])
  })
})
