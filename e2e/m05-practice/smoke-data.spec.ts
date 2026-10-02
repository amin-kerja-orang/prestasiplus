/**
 * M05-T1 developer smoke (no E2E ids; QA writes the E2E-M05-nn suite at G5): the M05 mock plugin
 * boots in the e2e build with its test hooks (SRS M05 v1.17 §6.13). M05-T1 has no screen; the
 * dashboard (M05-T3) and the other pages read the endpoints this task built, and their smoke specs
 * cover those. Here only the hooks are exercised through `window.__mock`.
 */

import { expect, test } from '../fixtures/test'
import { moduleTag, TAG } from '../support'

const HOOKS = ['addSession', 'addAnswer', 'setSubjectiveCounts', 'setSpmProgress', 'answerChapter']

test.describe('M05 mock hooks', { tag: [TAG.smoke, '@r1', moduleTag(5)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('window.__mock carries the M05 hooks', async ({ loginAs, gotoApp, mock }) => {
    await loginAs('pelajar@demo.test')
    await gotoApp('/')
    expect(await mock.names()).toEqual(expect.arrayContaining(HOOKS))
  })

  test('addSession and addAnswer store rows; setSubjectiveCounts and setSpmProgress answer', async ({
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs('pelajar2@demo.test')
    await gotoApp('/')

    const session = await mock.hook<{ userId: number; status: string; questionCount: number }>(
      'addSession',
      3,
      {
        mode: 'random',
        correct: 4,
        total: 5,
        timeSpentSec: 90,
        at: '2026-09-25T10:00:00+08:00',
      },
    )
    expect(session).toMatchObject({ userId: 3, status: 'completed', questionCount: 5 })

    // 600001 is the first M05 practice anchor (BM D1 Bab 1).
    const answer = await mock.hook<{ id: number; sessionId: null; subjectId: number }>(
      'addAnswer',
      {
        userId: 3,
        questionId: 600001,
        isCorrect: false,
        answeredAt: '2026-09-25T10:05:00+08:00',
      },
    )
    expect(answer.id).toBeGreaterThanOrEqual(9_000_001)
    expect(answer).toMatchObject({ sessionId: null, subjectId: 1 })

    expect(await mock.hook('setSubjectiveCounts', 'BM', { '1': 4 })).toEqual({ '1': 4 })
    expect(await mock.hook('setSpmProgress', 3, 1, { answered: 10, correct: 8 })).toEqual({
      answered: 10,
      correct: 8,
    })
  })

  test('a hook with a bad argument rejects with a clear message', async ({
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs('pelajar@demo.test')
    await gotoApp('/')
    await expect(mock.hook('addSession', 2, { mode: 'nope' })).rejects.toThrow(/unknown mode/)
  })
})
