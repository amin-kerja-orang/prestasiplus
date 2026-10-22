// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { DsStickyActions } from '@/ds'

describe('DsStickyActions', () => {
  it('renders its slot in a sticky bar that is static from md', () => {
    const w = mount(DsStickyActions, { slots: { default: '<button>Hantar</button>' } })
    expect(w.attributes('data-ds')).toBe('sticky-actions')
    expect(w.classes()).toEqual(
      expect.arrayContaining(['sticky', 'bottom-16', 'md:static', 'flex', 'flex-wrap']),
    )
    expect(w.find('button').text()).toBe('Hantar')
  })
  it('reserves end clearance for the AI button below lg only', () => {
    const w = mount(DsStickyActions)
    expect(w.classes()).toEqual(expect.arrayContaining(['pe-20', 'lg:pe-0']))
  })
})
