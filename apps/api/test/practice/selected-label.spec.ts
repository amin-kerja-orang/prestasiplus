import { describe, expect, it } from 'vitest'

import { selectedLabelOf } from '../../src/modules/practice/rules'

describe('selectedLabelOf (DM-44)', () => {
  it('keeps a single label', () => expect(selectedLabelOf(['B'])).toBe('B'))
  it('sorts and joins a multi selection', () => expect(selectedLabelOf(['C', 'A'])).toBe('A,C'))
  it('drops duplicates', () => expect(selectedLabelOf(['C', 'A', 'C'])).toBe('A,C'))
  it('gives null for no label', () => expect(selectedLabelOf([])).toBeNull())
})
