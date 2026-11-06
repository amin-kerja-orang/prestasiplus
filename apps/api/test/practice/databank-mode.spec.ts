/**
 * S3-T07 part A: the Databank page starts `mode = databank`. The session is stored as `databank`, its answers are written as
 * `databank` (S5-T15 answer store), it draws the SPM pool like the legacy `past_year`, and the legacy value still starts for old clients.
 */
import { StartSessionResponseSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { type Client, type PracticeTestApp, bootPracticeApp, fillBank, loadWorld, loginAs, play, resetPractice, type World } from './helpers'

let t: PracticeTestApp
let w: World
let pupil: Client

beforeAll(async () => {
  t = await bootPracticeApp()
  w = await loadWorld(t.db)
  fillBank(t.bank, w)
  pupil = await loginAs(t, 'pelajar@demo.test')
}, 180_000)
afterAll(async () => {
  await t.close()
})

describe('Databank starts and records the databank mode', () => {
  it('starts with mode databank (201), serves only SPM pool questions and stores the session and its answers as databank', async () => {
    await resetPractice(t.db)
    const nonPool = t.bank.add({ subjectId: w.subject.sej, levelId: w.level.t4, spmPool: false })
    const { started, submit } = await play(pupil, t.bank, { mode: 'databank', subjectCode: 'SEJ', count: 5 }, 2)
    expect(submit.status, JSON.stringify(submit.body)).toBe(200)
    expect(() => StartSessionResponseSchema.parse(started.body)).not.toThrow()
    expect(started.body.mode).toBe('databank')
    expect(started.questions).toHaveLength(5)
    expect(started.questions.map((q) => q.id)).not.toContain(nonPool)

    const session = (await t.db.query<{ mode: string }>('select mode from practice_sessions where id = $1', [started.sessionId]))[0]
    expect(session?.mode).toBe('databank')
    const answers = await t.db.query<{ mode: string }>('select mode from practice_answers where session_id = $1', [started.sessionId])
    expect(answers).toHaveLength(5)
    expect(new Set(answers.map((a) => a.mode))).toEqual(new Set(['databank']))
    expect(t.reward.calls.at(-1)).toMatchObject({ mode: 'databank', source: 'quiz_spm' })
  })

  it('keeps the same count options and errors as Tahun Lepas', async () => {
    const bad = await pupil.post('/api/practice/sessions', { mode: 'databank', subjectCode: 'SEJ', count: 7 })
    expect(bad.status).toBe(422)
    expect(bad.body.error.fields.count).toBe('Nilai tidak sah.')
    const none = await pupil.post('/api/practice/sessions', { mode: 'databank', subjectCode: 'BM', count: 5 })
    expect(none.body.error.code).toBe('NOT_ENOUGH_QUESTIONS')
  })

  it('a legacy past_year session still records its answers as databank', async () => {
    await resetPractice(t.db)
    const { started } = await play(pupil, t.bank, { mode: 'past_year', subjectCode: 'SEJ', count: 5 }, 1)
    const answers = await t.db.query<{ mode: string }>('select mode from practice_answers where session_id = $1', [started.sessionId])
    expect(new Set(answers.map((a) => a.mode))).toEqual(new Set(['databank']))
  })
})
