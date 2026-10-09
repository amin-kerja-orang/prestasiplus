/**
 * M25 test hook (`window.__mock`, dev and e2e builds; SRS M25 v1.2 §6.9, §6.7 F; XL-R10-03):
 * `loadFixture('m25-bands' | 'm25-ties')`, built on M05 `practice.addAnswer` with M04 `Q-CHAPTER`
 * questions of each chapter (a question repeats when the chapter has fewer than the answers needed).
 * Both fixtures belong to Pelajar 2 (id 3) and ADD answers: never load them with the observed-figure
 * checks (reset the mock first).
 *
 * | Fixture | Chapter (M03 id) · attempts · correct |
 * |---|---|
 * | `m25-bands` | 12 · 10 · 4, 13 · 10 · 5, 14 · 100 · 79, 15 · 200 · 159, 16 · 10 · 8 |
 * | `m25-ties` | 12, 13, 14 · 10 · 5 each |
 */

import { clock } from '@/lib/time'
import { questions } from '@/modules/m04-question-bank/mock'
import { practice } from '@/modules/m05-practice/mock'

/** The user both fixtures are written for (Pelajar 2). */
export const FIXTURE_USER_ID = 3

/** `[chapterId, attempts, correct]` per fixture. */
export const M25_FIXTURES: Readonly<
  Record<string, readonly (readonly [number, number, number])[]>
> = {
  'm25-bands': [
    [12, 10, 4],
    [13, 10, 5],
    [14, 100, 79],
    [15, 200, 159],
    [16, 10, 8],
  ],
  'm25-ties': [
    [12, 10, 5],
    [13, 10, 5],
    [14, 10, 5],
  ],
}

/** `mock.loadFixture(name)`; returns the number of answers written. */
export function loadFixture(name: string): number {
  const plan = typeof name === 'string' ? M25_FIXTURES[name] : undefined
  if (!plan) throw new RangeError(`loadFixture: unknown fixture ${String(name)}`)
  const now = clock.now()
  let written = 0
  for (const [chapterId, attempts, correct] of plan) {
    const ids = questions.query('Q-CHAPTER', { sort: 'id' }, chapterId).rows.map((q) => q.id)
    if (ids.length === 0)
      throw new RangeError(`loadFixture: chapter ${String(chapterId)} has no question`)
    for (let i = 0; i < attempts; i++) {
      practice.addAnswer(
        {
          userId: FIXTURE_USER_ID,
          questionId: ids[i % ids.length] as number,
          isCorrect: i < correct,
        },
        now,
      )
      written += 1
    }
  }
  return written
}

export const m25Hooks = { loadFixture }
