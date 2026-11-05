// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { formStubs } from '@/test-support/form-stubs'

import AnswerWidget from '../AnswerWidget.vue'
import McqOptions from '../McqOptions.vue'
import type { McqOptionData } from '../types'

const global = { components: formStubs }
const make = (n: number): McqOptionData[] =>
  Array.from({ length: n }, (_, i) => {
    const l = String.fromCharCode(65 + i)
    return { id: l, letter: l, text: `Pilihan ${l}` }
  })

describe.each([375, 768, 1280])('mcq_multi at %ipx', (width) => {
  it('is a checkbox group with the helper line; each row is full width and >= 44px', () => {
    window.innerWidth = width
    const w = mount(McqOptions, { props: { options: make(4), multi: true, modelValue: [] }, global })
    expect(w.find('[role=group]').attributes('aria-label')).toBe('Pilihan jawapan')
    expect(w.find('[data-testid=mcq-multi-hint]').text()).toBe('Pilih semua jawapan yang betul.')
    expect(w.find('[role=group]').attributes('aria-describedby')).toBe(
      w.find('[data-testid=mcq-multi-hint]').attributes('id'),
    )
    expect(w.findAll('input[type=checkbox]')).toHaveLength(4)
    for (const l of w.findAll('label')) expect(l.classes()).toContain('min-h-11')
    expect(w.find('[role=group]').classes()).toContain('grid-cols-1')
  })
})

describe('mcq_multi v-model', () => {
  it('toggles on and off and always emits ids in option order', async () => {
    const w = mount(McqOptions, { props: { options: make(4), multi: true, modelValue: [] }, global })
    const boxes = w.findAll('input[type=checkbox]')
    await boxes[2]!.setValue(true)
    expect(w.emitted('update:modelValue')![0]).toEqual([['C']])
    await w.setProps({ modelValue: ['C'] })
    await boxes[0]!.setValue(true)
    expect(w.emitted('update:modelValue')![1]).toEqual([['A', 'C']])
    await w.setProps({ modelValue: ['A', 'C'] })
    expect(w.find('[data-testid=mcq-option-A]').attributes('data-selected')).toBe('true')
    await boxes[2]!.setValue(false)
    expect(w.emitted('update:modelValue')![2]).toEqual([['A']])
  })

  it('accepts 2 and 8 options and renders nothing for 1 or 9', () => {
    for (const [n, shown] of [
      [1, false],
      [2, true],
      [8, true],
      [9, false],
    ] as const) {
      const w = mount(McqOptions, { props: { options: make(n), multi: true, modelValue: [] }, global })
      expect(w.find('[data-testid=mcq-options]').exists()).toBe(shown)
    }
  })

  it('AnswerWidget mode mcq_multi binds a string[]; readonly disables the boxes', async () => {
    const w = mount(AnswerWidget, {
      props: { mode: 'mcq_multi', options: make(3), modelValue: ['B'] },
      global,
    })
    expect(w.find('[data-testid=mcq-option-B]').attributes('data-selected')).toBe('true')
    await w.findAll('input')[0]!.setValue(true)
    expect(w.emitted('update:modelValue')![0]).toEqual([['A', 'B']])
    await w.setProps({ readonly: true })
    expect(w.findAll('input').every((i) => i.attributes('disabled') !== undefined)).toBe(true)
  })

  it('single choice is unchanged (radio group, string value)', async () => {
    const w = mount(McqOptions, { props: { options: make(3) }, global })
    expect(w.find('[role=radiogroup]').exists()).toBe(true)
    expect(w.find('[data-testid=mcq-multi-hint]').exists()).toBe(false)
    await w.findAll('input')[1]!.setValue(true)
    expect(w.emitted('update:modelValue')![0]).toEqual(['B'])
  })
})
