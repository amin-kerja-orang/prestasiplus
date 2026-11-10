import { describe, expect, it } from 'vitest'

import { accuracyText, ccAccuracyLabel, shownAccuracy } from '../api/command-center-board'
import { accuracyTone } from '../components/command-center/cc-format'

/** XS-5: the Command Center shows one decimal like V2 (CommandCenterController.php:128, a PHP round(x, 1), so 95 stays "95%") and the dash for null (never 0%). */
describe('Command Center accuracy display', () => {
  it('shows the one-decimal wire value, without a trailing .0', () => {
    expect(accuracyText(57.9)).toBe('57.9%')
    expect(accuracyText(66.5)).toBe('66.5%')
    expect(accuracyText(49.4)).toBe('49.4%')
    expect(accuracyText(95)).toBe('95%')
    expect(accuracyText(100)).toBe('100%')
  })

  it('shows the dash for null', () => {
    expect(accuracyText(null)).toBe('—')
    expect(ccAccuracyLabel(null)).toBe('Ketepatan: —')
    expect(ccAccuracyLabel(84.6)).toBe('Ketepatan: 84.6%')
  })

  it('bands compare the displayed whole number (49.5 shows 50, not below 50)', () => {
    expect(shownAccuracy(49.5)).toBe(50)
    expect(accuracyTone(49.5)).toBe('warning')
    expect(accuracyTone(49.4)).toBe('error')
    expect(accuracyTone(69.5)).toBe('success')
    expect(accuracyTone(69.4)).toBe('warning')
  })
})
