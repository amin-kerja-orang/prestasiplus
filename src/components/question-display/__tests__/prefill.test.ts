// @vitest-environment jsdom
// S8-T03 part 5: answer template block (FR-PA-38, AC-PA-40).
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { formStubs } from '@/test-support/form-stubs'
import type { Leaf } from '@pp/exam-core/paper-model'

import PartInput from '../PartInput.vue'

const global = { components: formStubs }
const words = (n: number) => Array.from({ length: n }, () => 'a').join(' ')
const leaf = {
  id: 'p1',
  label: '(a)',
  prompt: 'S',
  marks: 2,
  kind: 'essay',
  depth: 0,
  preFill: 'Pendahuluan:\nIsi:\nPenutup:',
} as Leaf

describe('AC-PA-40 answer template', () => {
  it('shows the frame as a read-only block above the textarea, line breaks kept', () => {
    const w = mount(PartInput, { props: { leaf, modelValue: {}, attemptId: 'a' }, global })
    const block = w.find('[data-testid=answer-prefill]')
    expect(block.text()).toBe('Pendahuluan:\nIsi:\nPenutup:')
    expect(block.attributes('role')).toBe('note')
    expect(block.attributes('aria-label')).toBe('Templat jawapan')
    expect(block.classes()).toContain('whitespace-pre-line')
    expect(block.element.tagName).not.toBe('TEXTAREA')
    const html = w.html()
    expect(html.indexOf('answer-prefill')).toBeLessThan(html.indexOf('<textarea'))
    expect((w.find('textarea').element as HTMLTextAreaElement).value).toBe('')
  })
  it('the template is not counted: 80 typed words count as 80', () => {
    const w = mount(PartInput, {
      props: { leaf, modelValue: { text: words(80) }, attemptId: 'a' },
      global,
    })
    expect(w.find('[data-testid=word-count]').text()).toBe('80 patah perkataan')
  })
  it('no template, no block', () => {
    const w = mount(PartInput, {
      props: { leaf: { ...leaf, preFill: undefined }, modelValue: {}, attemptId: 'a' },
      global,
    })
    expect(w.find('[data-testid=answer-prefill]').exists()).toBe(false)
  })
})
