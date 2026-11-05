// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import OptionCallout from '../../components/analisa-item/OptionCallout.vue'

describe('OptionCallout null correct option', () => {
  it('renders a dash and no letter when the key is null', () => {
    const w = mount(OptionCallout, {
      props: { variant: 'correct', title: 'Jawapan Betul', letter: null, text: '' },
    })
    expect(w.get('[data-testid="option-none"]').text()).toBe('—')
    expect(w.text()).not.toContain('A')
  })
  it('renders a dash when the text is empty', () => {
    const w = mount(OptionCallout, {
      props: { variant: 'correct', title: 'x', letter: 'A', text: '' },
    })
    expect(w.text()).not.toContain('A')
    expect(w.text()).toContain('—')
  })
  it('renders the letter and text otherwise', () => {
    const w = mount(OptionCallout, {
      props: { variant: 'correct', title: 'x', letter: 'B', text: 'Ayat' },
    })
    expect(w.text()).toContain('B')
    expect(w.text()).toContain('Ayat')
  })
})
