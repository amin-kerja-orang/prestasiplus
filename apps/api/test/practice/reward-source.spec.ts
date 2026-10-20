import { PRACTICE_MODES } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { PRACTICE_REWARD_SOURCE, practiceRewardSource } from '../../src/modules/practice'

describe('practiceRewardSource (M14 BR-M14-03 ledger source by mode)', () => {
  it('maps every practice mode to its ledger source', () => {
    const table = Object.fromEntries(PRACTICE_MODES.map((m) => [m, practiceRewardSource(m)]))
    expect(table).toEqual({
      random: 'quiz_practice',
      chapter: 'quiz_practice',
      revision: 'quiz_practice',
      past_year: 'quiz_spm',
      latih_tubi: 'quiz_spm',
      ramalan: 'quiz_spm',
      mission: 'quiz_practice',
      remedial: 'quiz_practice',
      question_set: 'quiz_practice',
      pksk: 'quiz_pksk',
    })
  })

  it('the default stays the practice source', () => {
    expect(PRACTICE_REWARD_SOURCE).toBe('quiz_practice')
  })
})
