import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { EmptyQuestionBank, QuestionWorkflowPorts, QuestionWorkflowService } from '../../src/modules/questions/workflow'
import { FakeQuestionBank } from './fake-question-bank'
import { bootWorkflowApp, loginAll, type Client, type WorkflowTestApp } from './helpers'

describe('question workflow foundation', () => {
  let t: WorkflowTestApp
  let c: Record<'admin' | 'teacher' | 'otherTeacher' | 'schoolAdmin' | 'student', Client>
  beforeAll(async () => {
    t = await bootWorkflowApp()
    c = await loginAll(t)
  })
  afterAll(async () => {
    await t.close()
  })

  it('boots with the module registered and signs in as every role', () => {
    expect(t.app.get(QuestionWorkflowService).bank).toBe(t.fake)
    expect(new Set(Object.values(c).map((x) => x.userId)).size).toBe(5)
  })

  it('the second teacher is a different user from the first, and the roles are as named', () => {
    expect(Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.role]))).toEqual({
      admin: 'admin', teacher: 'teacher', otherTeacher: 'teacher', schoolAdmin: 'school_admin', student: 'student',
    })
    expect(c.otherTeacher.userId).not.toBe(c.teacher.userId)
  })

  it('the question bank port can be provided only once', () => {
    expect(() => t.app.get(QuestionWorkflowPorts).provideQuestionBank(new FakeQuestionBank())).toThrow(/already set/)
  })

  it('the default bank is empty: every id unknown, every list empty', async () => {
    const bank = new QuestionWorkflowPorts().questionBank
    expect(bank).toBeInstanceOf(EmptyQuestionBank)
    expect(await bank.getStatus('1')).toBeNull()
    expect(await bank.getForGates('1')).toBeNull()
    expect(await bank.setStatus('1', 'review', '1')).toBeNull()
    expect(await bank.deactivate('1')).toBe(false)
    expect(await bank.listForQuality()).toEqual([])
    expect(await bank.listDiagramCandidates('mcq')).toEqual([])
    expect((await bank.describe(['1'])).size).toBe(0)
  })

  it('the fake bank follows the port contract for publish and withdraw', async () => {
    t.fake.seed({ id: '501', status: 'approved' })
    expect((await t.fake.setStatus('501', 'approved', '1'))?.liveVersionNo).toBe(1)
    expect((await t.fake.setStatus('501', 'archived', '1'))?.liveVersionNo).toBeNull()
    expect(await t.fake.getStatus('999')).toBeNull()
  })
})
