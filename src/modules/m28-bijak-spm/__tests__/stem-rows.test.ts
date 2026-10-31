// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PartNode from '../components/PartNode.vue'
import { leavesOf } from '../domain/paper-model'
import type { PartView } from '../domain/types'

/**
 * T14 B-06: a structured question part that is only stem text (no answer mode, no children, 0 marks)
 * must read as text. V2 gives an answer widget to leaf parts only (cloud-student-mechanism section 1.3,
 * "only leaf parts get an answer widget"); the contract says `answer` is absent on a part that holds no answer.
 */
const stemRow: PartView = { id: 's1', label: 'I', prompt: 'Pernyataan pertama.', marks: 0 }
const leaf: PartView = {
  id: 'q1.a',
  label: '(a)',
  prompt: 'Terangkan.',
  marks: 2,
  answer: { kind: 'short_text' },
}

describe('B-06 stem rows', () => {
  it('leavesOf skips a stem row but keeps a real leaf and a legacy leaf without answer', () => {
    const legacy: PartView = { id: 'l', label: '(b)', prompt: 'x', marks: 1 }
    expect(leavesOf([stemRow, leaf, legacy]).map((l) => l.id)).toEqual(['q1.a', 'l'])
  })

  it('PartNode renders the stem row as text with no answer box and no marks tag', () => {
    const w = mount(PartNode, {
      props: { part: { id: 'g', label: '1', prompt: 'Stem', marks: 0, children: [stemRow, leaf] }, answers: {}, attemptId: 'a1' },
    })
    expect(w.find('[data-testid=part-s1]').text()).toContain('Pernyataan pertama.')
    expect(w.find('[data-testid=part-input-s1]').exists()).toBe(false)
    expect(w.find('[data-testid=part-s1]').text()).not.toContain('markah')
    expect(w.find('[data-testid=part-input-q1\\.a]').exists()).toBe(true)
  })
})
