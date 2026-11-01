import { describe, expect, it } from 'vitest'

import { sectionRuleLine } from '../src/paper-model'

/**
 * Copy row 39 (AC-06.1, AC-10.6): the rule line a pupil reads on the attempt and result pages when the Bahagian has no authored instruction.
 * Choose-N follows the V2 text "Jawab {N} soalan sahaja." (the .cloud .blade text); answer-all stays "Jawab semua soalan."; an authored
 * instruction always wins. This is the shared derivation (`@pp/exam-core/paper-model`); the API's cover uses the same wording in `bijak/papers/rules.ts`.
 */
const section = (over: { rule: { type: 'all' } | { type: 'choose'; n: number }; instruction?: string; ids?: string[] }) => ({
  rule: over.rule,
  ...(over.instruction ? { instruction: over.instruction } : {}),
  questionIds: over.ids ?? ['q1', 'q2', 'q3'],
})

describe('sectionRuleLine (USER Q13)', () => {
  it('choose-N reads "Jawab N soalan sahaja." and does not mention how many questions the Bahagian has', () => {
    expect(sectionRuleLine(section({ rule: { type: 'choose', n: 2 } }))).toBe('Jawab 2 soalan sahaja.')
    expect(sectionRuleLine(section({ rule: { type: 'choose', n: 1 }, ids: ['q1', 'q2'] }))).toBe('Jawab 1 soalan sahaja.')
  })

  it('N equal to the question count is still "Jawab N soalan sahaja."', () => {
    expect(sectionRuleLine(section({ rule: { type: 'choose', n: 3 }, ids: ['q1', 'q2', 'q3'] }))).toBe('Jawab 3 soalan sahaja.')
  })

  it('answer-all stays "Jawab semua soalan."', () => {
    expect(sectionRuleLine(section({ rule: { type: 'all' } }))).toBe('Jawab semua soalan.')
  })

  it('an authored instruction wins over the derived line, for both rules', () => {
    expect(sectionRuleLine(section({ rule: { type: 'choose', n: 2 }, instruction: 'Jawab dua daripada tiga.' }))).toBe('Jawab dua daripada tiga.')
    expect(sectionRuleLine(section({ rule: { type: 'all' }, instruction: 'Jawab dengan teliti.' }))).toBe('Jawab dengan teliti.')
  })
})
