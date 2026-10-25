// @vitest-environment jsdom
/** FB-064: a match_letter sub-part is one row of letters (the bank is listed once by QuestionBlock). */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PartInput from '../components/PartInput.vue'
import QuestionBlock from '../components/QuestionBlock.vue'
import type { Leaf } from '../domain/paper-model'
import type { PartView, QuestionView } from '../domain/types'

const leaf: Leaf = {
  id: 'p1',
  label: '(a)',
  prompt: 'Persekutuan Tanah Melayu ditubuhkan.',
  marks: 1,
  kind: 'match_letter',
  depth: 0,
}
const bank = ['A', 'B', 'C', 'D', 'E'].map((id, i) => ({ id, text: String(1946 + i) }))
const stubs = { MathField: true }

describe('match_letter layout', () => {
  it('one row of letters, aria-pressed on the chosen one, click emits the choice', async () => {
    const w = mount(PartInput, {
      props: {
        leaf,
        modelValue: { choice: 'B' },
        attemptId: 'a',
        optionBank: bank,
      },
      global: { stubs },
    })
    const row = w.get('[data-testid=match-row]')
    expect(row.findAll('button')).toHaveLength(5)
    expect(w.text()).not.toContain('A — 1946')
    expect(w.get('[data-testid=match-A]').text()).toBe('A')
    expect(w.get('[data-testid=match-A]').attributes('aria-label')).toBe('A, 1946')
    expect(w.get('[data-testid=match-B]').attributes('aria-pressed')).toBe('true')
    expect(w.get('[data-testid=match-C]').attributes('aria-pressed')).toBe('false')
    await w.get('[data-testid=match-C]').trigger('click')
    const emitted = w.emitted('update:modelValue')!
    expect((emitted[0]![0] as { choice?: string }).choice).toBe('C')
    await w.get('[data-testid=match-B]').trigger('click')
    expect((w.emitted('update:modelValue')![1]![0] as { choice?: string }).choice).toBeUndefined()
  })

  it('QuestionBlock lists the letter bank once and gives each sub-part its own row', () => {
    const w = mount(QuestionBlock, {
      props: {
        question: {
          id: 'q',
          number: 2,
          sectionId: 's',
          topic: 't',
          formOrigin: 'T4',
          stem: 'Padankan peristiwa dengan tahun.',
          marks: 2,
          optionBank: bank,
          parts: [
            {
              id: 'q-a',
              label: '(a)',
              prompt: 'Satu.',
              marks: 1,
              answer: { kind: 'match_letter' },
            },
            { id: 'q-b', label: '(b)', prompt: 'Dua.', marks: 1, answer: { kind: 'match_letter' } },
          ],
        },
        answers: {},
        attemptId: 'a',
        flagged: false,
      },
      global: { stubs },
    })
    expect(w.findAll('[data-testid=match-bank-once]')).toHaveLength(1)
    expect(w.get('[data-testid=match-bank-once]').text()).toContain('Pilihan jawapan')
    expect(w.findAll('[data-testid=match-row]')).toHaveLength(2)
    // the old full buttons ("A — 1946") are gone: no button carries the bank text
    for (const b of w.findAll('[data-testid=match-row] button')) expect(b.text()).toMatch(/^[A-E]$/)
  })

  const baseQ = {
    id: 'q',
    number: 2,
    sectionId: 's',
    topic: 't',
    formOrigin: 'T4' as const,
    stem: 'Padankan.',
    marks: 2,
  }
  const matchPart = (id: string, label: string): PartView => ({
    id,
    label,
    prompt: 'Satu.',
    marks: 1,
    answer: { kind: 'match_letter' },
  })
  const mountQ = (question: QuestionView) =>
    mount(QuestionBlock, {
      props: { question, answers: {}, attemptId: 'a', flagged: false },
      global: { stubs },
    })

  it('an 8-letter bank gives 8 buttons per row (nothing is fixed to A-E)', () => {
    const big = 'ABCDEFGH'.split('').map((id, i) => ({ id, text: String(1946 + i) }))
    const w = mountQ({
      ...baseQ,
      optionBank: big,
      parts: [matchPart('q-a', '(a)'), matchPart('q-b', '(b)')],
    })
    const rows = w.findAll('[data-testid=match-row]')
    expect(rows).toHaveLength(2)
    for (const r of rows) expect(r.findAll('button')).toHaveLength(8)
    expect(w.get('[data-testid=match-bank-once]').findAll('li')).toHaveLength(8)
  })

  it('an mcq question with a bank shows no bank block', () => {
    const w = mountQ({
      ...baseQ,
      optionBank: bank,
      mcq: {
        options: [
          { id: 'o1', text: 'Satu' },
          { id: 'o2', text: 'Dua' },
        ],
      },
    })
    expect(w.find('[data-testid=match-bank-once]').exists()).toBe(false)
  })

  it('one match part plus one short-text part: exactly one bank and one letter row', () => {
    const w = mountQ({
      ...baseQ,
      optionBank: bank,
      parts: [
        matchPart('q-a', '(a)'),
        { id: 'q-b', label: '(b)', prompt: 'Terangkan.', marks: 1, answer: { kind: 'short_text' } },
      ],
    })
    expect(w.findAll('[data-testid=match-bank-once]')).toHaveLength(1)
    expect(w.findAll('[data-testid=match-row]')).toHaveLength(1)
  })

  it('a short-text-only question with a bank shows no empty "Pilihan jawapan"', () => {
    const w = mountQ({
      ...baseQ,
      optionBank: bank,
      parts: [
        { id: 'q-a', label: '(a)', prompt: 'Terangkan.', marks: 1, answer: { kind: 'short_text' } },
      ],
    })
    expect(w.find('[data-testid=match-bank-once]').exists()).toBe(false)
  })
})
