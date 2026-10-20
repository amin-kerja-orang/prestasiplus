import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { BijakAttemptPorts, NoAggregate, NoPapers, NoQuestions, NoReward } from '../../src/modules/bijak/attempts/ports'
import { type AttemptsTestApp, bootAttemptsApp, expectError, loginAs, STUDENT } from './helpers'

const input = { userId: '1', paperId: '1', isTest: false }

describe('BijakAttemptPorts', () => {
  it('defaults: no paper, no question, reward and aggregate do nothing', async () => {
    const p = new BijakAttemptPorts()
    expect(p.paperSource).toBeInstanceOf(NoPapers)
    expect(p.questionSource).toBeInstanceOf(NoQuestions)
    expect(p.reward).toBeInstanceOf(NoReward)
    expect(p.aggregate).toBeInstanceOf(NoAggregate)
    expect(await p.paperSource.resolveForAttempt(input)).toEqual({ ok: false, reason: 'not_found' })
    expect((await p.questionSource.loadQuestions(['1'])).size).toBe(0)
  })

  it('registering a port twice is a wiring error', () => {
    const p = new BijakAttemptPorts()
    p.provideReward(new NoReward())
    expect(() => p.provideReward(new NoReward())).toThrow(/already set/)
    p.providePaperSource(new NoPapers())
    expect(() => p.providePaperSource(new NoPapers())).toThrow(/already set/)
    p.provideQuestionSource(new NoQuestions())
    expect(() => p.provideQuestionSource(new NoQuestions())).toThrow(/already set/)
    p.provideAggregate(new NoAggregate())
    expect(() => p.provideAggregate(new NoAggregate())).toThrow(/already set/)
  })
})

describe('the module before BE-15 and BE-09 are plugged in (default ports)', () => {
  let t: AttemptsTestApp
  beforeAll(async () => {
    t = await bootAttemptsApp({}, { plugPorts: false })
  })
  afterAll(async () => {
    await t.close()
  })
  it('every paper is "Kertas tidak ditemui" and the history is empty', async () => {
    const c = await loginAs(t, STUDENT)
    expect((await c.get('/api/bijak/history')).body).toEqual({ data: [] })
    expectError(await c.post('/api/bijak/attempts', { paperId: '101', mode: 'exam' }), 'NOT_FOUND', 'Kertas tidak ditemui')
  })
})
