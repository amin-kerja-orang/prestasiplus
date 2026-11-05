// @vitest-environment jsdom
// S8-T03 part 5: hard word limit (FR-PA-35, AC-PA-37) and the capWords helper.
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { formStubs } from '@/test-support/form-stubs'
import type { Leaf } from '@pp/exam-core/paper-model'

import { capLabel, maxWordsLabel } from '../copy'
import PartInput from '../PartInput.vue'
import { capWords, countWords } from '../words'

const global = { components: formStubs }
const words = (n: number) => Array.from({ length: n }, () => 'a').join(' ')
const leaf = (over: Record<string, unknown>) =>
  ({ id: 'p1', label: '(a)', prompt: 'S', marks: 2, kind: 'essay', depth: 0, ...over }) as Leaf

/** Mount with a live v-model so the answer round-trips like the page does. */
function essay(over: Record<string, unknown>) {
  const w = mount(PartInput, {
    props: {
      leaf: leaf(over),
      modelValue: {},
      attemptId: 'a1',
      'onUpdate:modelValue': (v: unknown) => void w.setProps({ modelValue: v as never }),
    },
    global,
  })
  return w
}
const type = async (w: ReturnType<typeof essay>, v: string) => {
  const ta = w.find('textarea')
  ;(ta.element as HTMLTextAreaElement).value = v
  await ta.trigger('input')
}

describe('capWords', () => {
  it('keeps the whitespace of the kept part and drops the rest', () => {
    expect(capWords('a  b\nc d', 3)).toBe('a  b\nc')
    expect(capWords('a b', 5)).toBe('a b')
    expect(capWords('a b ', 2)).toBe('a b ')
    expect(capWords('a b c', 0)).toBe('')
    expect(countWords(capWords(words(300), 120))).toBe(120)
  })
  it('copy lines', () => {
    expect(capLabel(120)).toBe('Had 120 patah perkataan dicapai.')
    expect(maxWordsLabel(20)).toBe('Maksimum 20 patah perkataan.')
  })
})

describe('AC-PA-37 essay hardLimit', () => {
  const range = { min: 50, max: 120 }
  it('125 typed words keep 120 and show the cap hint', async () => {
    const w = essay({ wordRange: range, hardLimit: true })
    await type(w, words(125))
    expect(countWords((w.props('modelValue') as { text: string }).text)).toBe(120)
    expect(w.find('[data-testid=word-cap-hint]').text()).toBe('Had 120 patah perkataan dicapai.')
    expect(w.find('[data-testid=word-count]').text()).toContain('120 /')
    expect(countWords((w.find('textarea').element as HTMLTextAreaElement).value)).toBe(120)
  })
  it('300 pasted words are cut at 120', async () => {
    const w = essay({ wordRange: range, hardLimit: true })
    await type(w, words(300))
    expect(countWords((w.props('modelValue') as { text: string }).text)).toBe(120)
  })
  it('typing past the cap again is ignored and the box is put back', async () => {
    const w = essay({ wordRange: range, hardLimit: true })
    await type(w, words(120))
    await type(w, `${words(120)} more`)
    await w.vm.$nextTick()
    expect(countWords((w.props('modelValue') as { text: string }).text)).toBe(120)
    expect(countWords((w.find('textarea').element as HTMLTextAreaElement).value)).toBe(120)
  })
  it('below the minimum only the short hint shows; nothing disables the box', async () => {
    const w = essay({ wordRange: range, hardLimit: true })
    await type(w, words(10))
    expect(w.find('[data-testid=word-cap-hint]').exists()).toBe(false)
    expect(w.find('[data-testid=word-hint]').text()).toBe(
      'Jawapan terlalu pendek (10 patah perkataan; minimum 50).',
    )
    expect(w.find('textarea').attributes('disabled')).toBeUndefined()
  })
  it('hardLimit off keeps 125 words and shows the over line', async () => {
    const w = essay({ wordRange: range })
    await type(w, words(125))
    expect(countWords((w.props('modelValue') as { text: string }).text)).toBe(125)
    expect(w.find('[data-testid=word-cap-hint]').exists()).toBe(false)
    expect(w.find('[data-testid=word-hint]').text()).toBe('Jawapan melebihi 120 patah perkataan.')
  })
})

describe('short_text maxWords', () => {
  it('shows the maximum line when over and keeps the text', async () => {
    const w = essay({ kind: 'short_text', maxWords: 5 })
    await type(w, words(8))
    expect(w.find('[data-testid=word-hint]').text()).toBe('Maksimum 5 patah perkataan.')
    expect(countWords((w.props('modelValue') as { text: string }).text)).toBe(8)
  })
  it('no line within the maximum', async () => {
    const w = essay({ kind: 'short_text', maxWords: 5 })
    await type(w, words(5))
    expect(w.find('[data-testid=word-hint]').exists()).toBe(false)
  })
})
