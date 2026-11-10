// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { formStubs } from '@/test-support/form-stubs'

import AnswerWidget from '../AnswerWidget.vue'

const global = { components: formStubs }

describe.each([375, 768, 1280])('true_false at %ipx', (width) => {
  it('shows A Betul then B Salah, single choice, rows >= 44px', async () => {
    window.innerWidth = width
    const w = mount(AnswerWidget, { props: { mode: 'true_false' }, global })
    const rows = w.findAll('label')
    expect(rows.map((r) => r.text())).toEqual(['ABetul', 'BSalah'])
    for (const r of rows) expect(r.classes()).toContain('min-h-11')
    expect(w.find('[role=radiogroup]').exists()).toBe(true)
    await w.findAll('input')[1]!.setValue(true)
    expect(w.emitted('update:modelValue')![0]).toEqual(['B'])
  })
})

describe('true_false is never shuffled', () => {
  it('ignores reordered or foreign options and any shuffle attribute', () => {
    const reversed = [
      { id: 'B', letter: 'A', text: 'Salah' },
      { id: 'A', letter: 'B', text: 'Betul' },
    ]
    for (let i = 0; i < 5; i++) {
      const w = mount(AnswerWidget, {
        props: { mode: 'true_false', options: reversed, modelValue: 'A' },
        attrs: { shuffle: true, seed: i },
        global,
      })
      expect(w.findAll('input').map((x) => (x.element as HTMLInputElement).value)).toEqual(['A', 'B'])
      expect(w.findAll('label').map((r) => r.text())).toEqual(['ABetul', 'BSalah'])
      expect(w.find('[data-testid=mcq-option-A]').attributes('data-selected')).toBe('true')
    }
  })
})
