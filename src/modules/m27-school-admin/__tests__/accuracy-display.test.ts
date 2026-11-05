import { describe, expect, it } from 'vitest'

import { percent, shownAccuracy } from '../components/dashboard/dashboard-format'
import { accuracy as activityAccuracy } from '../components/activity/activity-format'
import { pct1 } from '../components/monthly/monthly-format'
import { accuracy as usageAccuracy } from '../components/usage/usage-format'

/** XS-5 / 40 FR-X4-5: every screen shows the whole number, half up, and the dash for null (never 0%). */
const formatters = {
  dashboard: percent,
  usage: usageAccuracy,
  monthly: pct1,
  activity: activityAccuracy,
}

describe.each(Object.entries(formatters))('whole-number accuracy: %s', (_name, format) => {
  it('rounds half up from the one-decimal wire value', () => {
    expect(format(57.9)).toBe('58%')
    expect(format(66.5)).toBe('67%')
    expect(format(49.4)).toBe('49%')
    expect(format(100)).toBe('100%')
    expect(format(0)).toBe('0%')
  })

  it('shows the dash for null, never 0%', () => {
    expect(format(null)).toBe('—')
  })
})

describe('shownAccuracy (band comparisons use the displayed number)', () => {
  it('49.5 shows 50, which is not below 50', () => {
    expect(shownAccuracy(49.5)).toBe(50)
    expect(shownAccuracy(49.4)).toBe(49)
    expect(shownAccuracy(null)).toBeNull()
  })
})
