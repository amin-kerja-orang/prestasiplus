// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { formStubs } from '@/test-support/form-stubs'

import AnswerWidget from '../AnswerWidget.vue'
import EssayAnswer from '../EssayAnswer.vue'
import McqOptions from '../McqOptions.vue'
import TextAnswer from '../TextAnswer.vue'
import type { McqOptionData } from '../types'
import { countWords } from '../words'

const global = { components: formStubs }
const opts: McqOptionData[] = [
  { id: 'o1', letter: 'A', text: 'Satu' },
  { id: 'o2', letter: 'B', text: 'Dua' },
  { id: 'o3', letter: 'C', text: 'Tiga' },
]
const topics = [
  { id: 't1', label: 'Tajuk satu' },
  { id: 't2', label: 'Tajuk dua' },
]

describe('countWords', () => {
  it('counts whitespace-separated words', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('  a  b\nc ')).toBe(3)
  })
})

describe('mcq', () => {
  it('is a radio group "Pilihan jawapan" with lettered options and emits the option id', async () => {
    const w = mount(McqOptions, { props: { options: opts }, global })
    expect(w.find('[role=radiogroup]').attributes('aria-label')).toBe('Pilihan jawapan')
    const inputs = w.findAll('input[type=radio]')
    expect(inputs).toHaveLength(3)
    expect(w.find('[data-testid=mcq-option-o2]').text()).toContain('B')
    await inputs[1]!.setValue(true)
    expect(w.emitted('update:modelValue')![0]).toEqual(['o2'])
    expect(new Set(inputs.map((i) => i.attributes('name'))).size).toBe(1)
  })

  it('highlights the selected option; each option is >= 44px (min-h-11)', () => {
    const w = mount(McqOptions, { props: { options: opts, modelValue: 'o3' }, global })
    expect(w.find('[data-testid=mcq-option-o3]').attributes('data-selected')).toBe('true')
    expect(w.find('[data-testid=mcq-option-o1]').attributes('data-selected')).toBe('false')
    expect(w.find('label').classes()).toContain('min-h-11')
  })

  it('disabled blocks input', () => {
    const w = mount(McqOptions, { props: { options: opts, disabled: true }, global })
    expect(w.findAll('input').every((i) => i.attributes('disabled') !== undefined)).toBe(true)
  })

  it('reveal marks correct and wrong with a word and an icon, and locks the group', () => {
    const w = mount(McqOptions, {
      props: { options: opts, modelValue: 'o1', reveal: true, correctId: 'o2' },
      global,
    })
    expect(w.find('[data-testid=mcq-option-o2]').attributes('data-verdict')).toBe('correct')
    expect(w.find('[data-testid=mcq-option-o1]').attributes('data-verdict')).toBe('wrong')
    expect(w.find('[data-testid=mcq-option-o3]').attributes('data-verdict')).toBeUndefined()
    expect(w.findAll('[data-testid=mcq-verdict]').map((v) => v.text())).toEqual(['Salah', 'Betul'])
    expect(w.find('input').attributes('disabled')).toBeDefined()
  })

  it('option images: lazy, alt, two columns from md; a broken image shows the failure line', async () => {
    const w = mount(McqOptions, {
      props: {
        options: [
          {
            id: 'a',
            letter: 'A',
            text: 'Bulat',
            imageSrc: '/a.png',
            imageAlt: 'Bulatan',
            imageWidth: 100,
            imageHeight: 50,
          },
          { id: 'b', letter: 'B', text: 'Segi' },
        ],
      },
      global,
    })
    expect(w.find('[data-testid=mcq-options]').classes()).toContain('md:grid-cols-2')
    const img = w.find('img')
    expect(img.attributes('loading')).toBe('lazy')
    expect(img.attributes('alt')).toBe('Bulatan')
    expect(img.attributes('style')).toContain('aspect-ratio: 100 / 50')
    await img.trigger('error')
    expect(w.find('[data-testid=mcq-image-failed]').text()).toContain('Rajah tidak dapat dimuatkan.')
    expect(w.emitted('image-error')![0]).toEqual(['a'])
  })

  it('without images stays one column', () => {
    const w = mount(McqOptions, { props: { options: opts }, global })
    expect(w.find('[data-testid=mcq-options]').classes()).not.toContain('md:grid-cols-2')
  })
})

describe('short_text and numeric', () => {
  it('short_text: verbatim placeholder and aria, emits text', async () => {
    const w = mount(TextAnswer, { props: { mode: 'short_text' }, global })
    const input = w.find('input')
    expect(input.attributes('placeholder')).toBe('Tulis jawapan…')
    expect(input.attributes('aria-label')).toBe('Jawapan')
    expect(input.attributes('inputmode')).toBeUndefined()
    await input.setValue('Merdeka')
    expect(w.emitted('update:modelValue')![0]).toEqual(['Merdeka'])
  })
  it('numeric: decimal keyboard, verbatim copy, unit suffix', () => {
    const w = mount(TextAnswer, { props: { mode: 'numeric', unit: 'cm', modelValue: '3.5' }, global })
    const input = w.find('input')
    expect(input.attributes('inputmode')).toBe('decimal')
    expect(input.attributes('placeholder')).toBe('cth. 3.14…')
    expect(input.attributes('aria-label')).toBe('Jawapan berangka')
    expect((input.element as HTMLInputElement).value).toBe('3.5')
    expect(w.find('[data-testid=answer-unit]').text()).toBe('cm')
  })
  it('readonly (Semakan)', () => {
    const w = mount(TextAnswer, {
      props: { mode: 'short_text', readonly: true, modelValue: 'x' },
      global,
    })
    expect(w.find('input').attributes('readonly')).toBeDefined()
  })
})

describe('extended_essay', () => {
  it('verbatim copy and live counter', () => {
    const w = mount(EssayAnswer, {
      props: { mode: 'extended_essay', modelValue: 'satu dua tiga' },
      global,
    })
    const ta = w.find('textarea')
    expect(ta.attributes('placeholder')).toBe('Tulis jawapan anda di sini…')
    expect(ta.attributes('aria-label')).toBe('Jawapan esei')
    expect(w.find('[data-testid=word-count]').text()).toBe('3 patah perkataan')
    expect(w.find('[data-testid=word-count]').attributes('data-over')).toBe('false')
  })
  it('turns over with icon and words past the limit', () => {
    const w = mount(EssayAnswer, {
      props: { mode: 'extended_essay', modelValue: 'a b c', wordLimit: 2 },
      global,
    })
    const c = w.find('[data-testid=word-count]')
    expect(c.attributes('data-over')).toBe('true')
    expect(c.text()).toContain('melebihi had')
    expect(c.find('svg').exists()).toBe(true)
  })
  it('emits typed text; readonly in Semakan', async () => {
    const ro = mount(EssayAnswer, { props: { mode: 'extended_essay', readonly: true }, global })
    expect(ro.find('textarea').attributes('readonly')).toBeDefined()
    const w = mount(EssayAnswer, { props: { mode: 'extended_essay' }, global })
    await w.find('textarea').setValue('hai dunia')
    expect(w.emitted('update:modelValue')![0]).toEqual(['hai dunia'])
  })
})

describe('essay_choice', () => {
  it('no topic: textarea disabled with the hint, range in the counter', () => {
    const w = mount(EssayAnswer, {
      props: { mode: 'essay_choice', topics, range: { min: 120, max: 150 } },
      global,
    })
    expect(w.find('textarea').attributes('disabled')).toBeDefined()
    expect(w.find('[data-testid=topic-hint]').text()).toBe('Pilih satu tajuk dahulu.')
    expect(w.find('textarea').attributes('placeholder')).toBe('Tulis karangan anda di sini…')
    expect(w.find('textarea').attributes('aria-label')).toBe('Karangan')
    expect(w.find('[data-testid=word-count]').text()).toBe('0 patah perkataan · sasaran 120–150')
  })
  it('picking a topic emits the choice and enables writing', async () => {
    const w = mount(EssayAnswer, { props: { mode: 'essay_choice', topics }, global })
    expect(w.findAll('input[type=radio]')).toHaveLength(2)
    await w.findAll('input')[1]!.setValue(true)
    expect(w.emitted('update:choice')![0]).toEqual([{ topic: 't2', text: '' }])
    const w2 = mount(EssayAnswer, {
      props: { mode: 'essay_choice', topics, choice: { topic: 't2', text: 'a b' } },
      global,
    })
    expect(w2.find('textarea').attributes('disabled')).toBeUndefined()
    expect(w2.find('[data-testid=topic-hint]').exists()).toBe(false)
    expect(w2.find('[data-testid=topic-t2]').classes()).toContain('ring-primary')
    await w2.find('textarea').setValue('a b c d')
    expect(w2.emitted('update:choice')![0]).toEqual([{ topic: 't2', text: 'a b c d' }])
  })
  it('readonly locks the topics', () => {
    const w = mount(EssayAnswer, {
      props: { mode: 'essay_choice', topics, readonly: true, choice: { topic: 't1', text: 'x' } },
      global,
    })
    expect(w.findAll('input').every((i) => i.attributes('disabled') !== undefined)).toBe(true)
    expect(w.find('textarea').attributes('readonly')).toBeDefined()
  })
})

describe('AnswerWidget dispatcher', () => {
  it.each([
    ['mcq', '[data-testid=mcq-options]'],
    ['short_text', '[data-testid=answer-short_text]'],
    ['numeric', '[data-testid=answer-numeric]'],
    ['extended_essay', '[data-testid=answer-extended_essay]'],
    ['essay_choice', '[data-testid=answer-essay_choice]'],
  ] as const)('%s renders its widget', (mode, sel) => {
    const w = mount(AnswerWidget, { props: { mode, options: opts, topics }, global })
    expect(w.find(sel).exists()).toBe(true)
  })
  it('never shows the unknown-mode fallback text', () => {
    const w = mount(AnswerWidget, { props: { mode: 'bogus' as never }, global })
    expect(w.text()).not.toContain('akan tersedia tidak lama lagi')
  })
  it('routes values through update:modelValue', async () => {
    const w = mount(AnswerWidget, { props: { mode: 'mcq', options: opts }, global })
    await w.findAll('input')[0]!.setValue(true)
    expect(w.emitted('update:modelValue')![0]).toEqual(['o1'])
    const e = mount(AnswerWidget, { props: { mode: 'essay_choice', topics }, global })
    await e.find('input').setValue(true)
    expect(e.emitted('update:modelValue')![0]).toEqual([{ topic: 't1', text: '' }])
  })
})
