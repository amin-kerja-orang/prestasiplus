// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import McqLeafForm from '../../components/studio/McqLeafForm.vue'
import NumericLeafForm from '../../components/studio/NumericLeafForm.vue'
import ShortTextLeafForm from '../../components/studio/ShortTextLeafForm.vue'
import StudioLeafEditor from '../../components/studio/StudioLeafEditor.vue'
import { blankLeaf, MAX_OPTIONS, MIN_OPTIONS, type LeafDraft } from '../../lib/studio/draft'

vi.mock('../../api/studio', () => ({ uploadStudioImage: vi.fn() }))

const has = (w: ReturnType<typeof mount>, id: string) => w.find(`[data-testid="${id}"]`).exists()

describe('McqLeafForm', () => {
  it('renders the correct-answer select and one block per option', () => {
    const leaf = blankLeaf('a', 'mcq')
    const w = mount(McqLeafForm, { props: { modelValue: leaf, testid: 'x' } })
    expect(has(w, 'x-correct')).toBe(true)
    expect(w.findAll('[data-testid^="x-option-"][data-testid$="-remove"]')).toHaveLength(leaf.options.length > MIN_OPTIONS ? leaf.options.length : 0)
  })
  it('adds and removes options through update:modelValue', async () => {
    const leaf = blankLeaf('a', 'mcq')
    const w = mount(McqLeafForm, { props: { modelValue: leaf, testid: 'x' } })
    await w.get('[data-testid="x-add-option"]').trigger('click')
    const next = (w.emitted('update:modelValue')![0] as [LeafDraft])[0]
    expect(next.options.length).toBe(leaf.options.length + 1)
    expect(next.options.length).toBeLessThanOrEqual(MAX_OPTIONS)
  })
  it('shows an option error', () => {
    const w = mount(McqLeafForm, { props: { modelValue: blankLeaf('a', 'mcq'), testid: 'x', errors: { 'options.0': 'Teks pilihan A wajib diisi.' } } })
    expect(w.text()).toContain('Teks pilihan A wajib diisi.')
  })
})

describe('ShortTextLeafForm', () => {
  it('edits the accepted answers', async () => {
    const w = mount(ShortTextLeafForm, { props: { modelValue: blankLeaf('a', 'short_text'), testid: 'x' } })
    await w.get('[data-testid="x-accepted"]').setValue('satu\ndua')
    expect(w.get('[data-testid="x-accepted"]').element).toBeTruthy()
  })
})

describe('NumericLeafForm', () => {
  it('has value, tolerance and unit', async () => {
    const leaf = blankLeaf('a', 'numeric')
    const w = mount(NumericLeafForm, { props: { modelValue: leaf, testid: 'x' } })
    await w.get('[data-testid="x-value"]').setValue('3.5')
    expect(leaf.numeric.value).toBe('3.5')
    expect(has(w, 'x-tolerance')).toBe(true)
    expect(has(w, 'x-unit')).toBe(true)
  })
})

describe('StudioLeafEditor host', () => {
  const host = (mode: 'mcq' | 'short_text' | 'numeric') =>
    mount(StudioLeafEditor, { props: { modelValue: blankLeaf('a', mode), testid: 'l', canRemove: true } })
  it('mounts one form per mode', () => {
    expect(has(host('mcq'), 'l-options')).toBe(true)
    expect(has(host('short_text'), 'l-accepted')).toBe(true)
    expect(has(host('numeric'), 'l-value')).toBe(true)
    expect(has(host('numeric'), 'l-options')).toBe(false)
  })
  it('the prompt carries the rich-text toolbar and the tags stay', () => {
    const w = host('mcq')
    expect(has(w, 'l-prompt-tb-bold')).toBe(true)
    expect(has(w, 'l-tp')).toBe(true)
    expect(has(w, 'l-cognitive')).toBe(true)
  })
})
