// @vitest-environment jsdom
import { BIJAK_ATTEMPT_LEAF_KINDS, QUESTION_LEAF_MODES } from '@pp/contract'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PartInput from '../components/PartInput.vue'
import type { Leaf } from '../domain/paper-model'
import type { LeafKind } from '../domain/types'

/**
 * #78 78-09 (AZ-17): after the BE-42 contract re-sync the bank has a `pksk_choice` leaf. It is not a
 * Bijak answer kind: the attempt contract (`BijakAttemptLeafKind`) does not carry it and the question
 * bridge refuses PKSK questions, so PartInput never needs a PKSK control. A kind outside the contract
 * must show the "not yet available" notice, never the working/numeric inputs.
 */

const leaf = (kind: string): Leaf => ({
  id: 'p1',
  label: '(a)',
  prompt: 'Soalan contoh.',
  marks: 2,
  kind: kind as LeafKind,
  depth: 0,
})

const render = (kind: string) =>
  mount(PartInput, { props: { leaf: leaf(kind), modelValue: undefined, attemptId: 'a1', optionBank: [] } })

describe('PartInput answer kinds', () => {
  it('the Bijak attempt contract never serves the PKSK leaf mode', () => {
    expect(QUESTION_LEAF_MODES).toContain('pksk_choice')
    expect(BIJAK_ATTEMPT_LEAF_KINDS as readonly string[]).not.toContain('pksk_choice')
  })

  it('every contract kind renders its own control; only table_fill shows the notice', () => {
    for (const kind of BIJAK_ATTEMPT_LEAF_KINDS) {
      const w = render(kind)
      expect(w.find('[data-testid=kind-unavailable]').exists(), kind).toBe(kind === 'table_fill')
      w.unmount()
    }
  })

  it('pksk_choice (or any unknown kind) shows the notice, not the working/numeric inputs', () => {
    for (const kind of ['pksk_choice', 'mcq', 'something_new']) {
      const w = render(kind)
      expect(w.find('[data-testid=kind-unavailable]').exists(), kind).toBe(true)
      expect(w.text(), kind).not.toContain('Jawapan akhir')
      expect(w.find('[data-testid=photo-button]').exists(), kind).toBe(false)
      w.unmount()
    }
  })

  it('numeric still renders "Jawapan akhir"', () => {
    const w = render('numeric')
    expect(w.text()).toContain('Jawapan akhir')
    w.unmount()
  })
})
