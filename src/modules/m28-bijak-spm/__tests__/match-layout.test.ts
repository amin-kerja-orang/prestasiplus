// @vitest-environment jsdom
/** FB-064: the compact match_letter draft is one row of letters per sub-part; the list stays the default. */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PartInput from '../components/PartInput.vue'
import type { Leaf } from '../domain/paper-model'

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

describe('match_letter layouts', () => {
  it('default: full-width "A — 1946" buttons (current version)', () => {
    const w = mount(PartInput, {
      props: { leaf, modelValue: undefined, attemptId: 'a', optionBank: bank },
      global: { stubs },
    })
    expect(w.find('[data-testid=match-bank]').exists()).toBe(true)
    expect(w.find('[data-testid=match-row]').exists()).toBe(false)
    expect(w.get('[data-testid=match-A]').text()).toBe('A — 1946')
  })
  it('compact: one row of letters, aria-pressed on the chosen one, click emits the choice', async () => {
    const w = mount(PartInput, {
      props: {
        leaf,
        modelValue: { choice: 'B' },
        attemptId: 'a',
        optionBank: bank,
        matchLayout: 'compact',
      },
      global: { stubs },
    })
    expect(w.find('[data-testid=match-bank]').exists()).toBe(false)
    const row = w.get('[data-testid=match-row]')
    expect(row.findAll('button')).toHaveLength(5)
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
})
