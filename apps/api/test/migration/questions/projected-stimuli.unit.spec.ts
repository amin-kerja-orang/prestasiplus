/** The pure rule of the projected rajah (T-B9-6): a text stimulus that only repeats the stem is not linked. */
import { describe, expect, it } from 'vitest'

import { isCopyOfStem } from '../../../src/migration/load/questions/projected-stimuli'

describe('isCopyOfStem', () => {
  it('an empty or missing stimulus adds nothing', () => {
    expect(isCopyOfStem(null, 'Petikan.')).toBe(true)
    expect(isCopyOfStem('  ', 'Petikan.')).toBe(true)
  })

  it('the stem text again (any case, spacing or markup) is a copy', () => {
    expect(isCopyOfStem('petikan   struktur\ncontoh.', 'Petikan struktur contoh.')).toBe(true)
    expect(isCopyOfStem('<p>Petikan struktur contoh.</p>', 'Petikan struktur contoh.')).toBe(true)
  })

  it('a text that is not in the stem is a rajah of its own', () => {
    expect(isCopyOfStem('Rajah 1.1 menunjukkan sebuah litar.', 'Petikan struktur contoh.')).toBe(false)
  })
})
