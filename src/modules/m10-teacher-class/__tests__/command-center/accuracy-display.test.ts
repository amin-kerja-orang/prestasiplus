import { describe, expect, it } from 'vitest'

import { accuracyText, accuracyTone } from '../../components/command-center/copy'

/** XS-5 / 40 FR-X4-5: the guru Command Center shows the whole number, half up, and the dash for null (never 0%). */
describe('guru Command Center accuracy display', () => {
  it('rounds half up from the one-decimal wire value', () => {
    expect(accuracyText(57.9)).toBe('58%')
    expect(accuracyText(66.5)).toBe('67%')
    expect(accuracyText(49.4)).toBe('49%')
    expect(accuracyText(100)).toBe('100%')
  })

  it('shows the dash for null', () => {
    expect(accuracyText(null)).toBe('—')
  })

  it('bands compare the displayed whole number (49.5 shows 50, not below 50)', () => {
    expect(accuracyTone(49.5)).toBe('text-warning')
    expect(accuracyTone(49.4)).toBe('text-error')
    expect(accuracyTone(69.5)).toBe('text-success')
    expect(accuracyTone(null)).toBe('text-muted')
  })
})
