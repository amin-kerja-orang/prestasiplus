import { describe, expect, it } from 'vitest'

import { prngStream } from '../../src/db/prng'
import { botAnswers } from '../../src/modules/battle/engine'

describe('robot answers (AC 11)', () => {
  it('the ten answers come from m16:battle:<uuid>: 2-12 s, correct with probability p, points 1000 - round(500 s / 15)', () => {
    const uuid = '3f0c3a52-0000-4000-8000-000000000001'
    const answers = botAnswers(uuid, 0.5)
    expect(answers).toHaveLength(10)
    expect(botAnswers(uuid, 0.5)).toEqual(answers)
    expect(botAnswers('3f0c3a52-0000-4000-8000-000000000002', 0.5)).not.toEqual(answers)
    const rng = prngStream(`m16:battle:${uuid}`)
    for (const a of answers) {
      const seconds = Math.min(15, Math.floor(2 + 10 * rng.next()))
      const correct = rng.next() < 0.5
      expect(a).toEqual({ seconds, correct, points: correct ? 1000 - Math.round((500 * seconds) / 15) : 0 })
    }
    expect(botAnswers(uuid, 0).every((a) => !a.correct && a.points === 0)).toBe(true)
    expect(botAnswers(uuid, 1).every((a) => a.correct && a.points > 0)).toBe(true)
    expect(botAnswers(uuid, 0.5).map((a) => a.seconds)).toEqual(answers.map((a) => a.seconds))
  })

  it('FR-GM-01.1: one answer per question of the chosen count (5, 10, 15, 20), the first ones the same as for 10', () => {
    const uuid = '3f0c3a52-0000-4000-8000-000000000003'
    const ten = botAnswers(uuid, 0.5)
    for (const n of [5, 10, 15, 20]) {
      const answers = botAnswers(uuid, 0.5, n)
      expect(answers).toHaveLength(n)
      expect(answers.slice(0, Math.min(n, 10))).toEqual(ten.slice(0, Math.min(n, 10)))
    }
  })
})
