import { describe, expect, it } from 'vitest'

import { uiConfig } from '@/theme/ui.config'

// G5-M01 BUG-10: a labelled checkbox centres its label on the 44px box row.
describe('uiConfig.checkbox.slots', () => {
  it('keeps the 44px box container', () => {
    expect(uiConfig.checkbox.slots.container).toContain('min-h-11')
  })

  it('makes the label wrapper 44px tall and centres a one-line label on it', () => {
    const wrapper = uiConfig.checkbox.slots.wrapper.split(' ')
    expect(wrapper).toEqual(
      expect.arrayContaining(['flex', 'min-h-11', 'flex-col', 'justify-center']),
    )
  })
})
