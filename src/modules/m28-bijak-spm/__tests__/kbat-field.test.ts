// @vitest-environment jsdom
/**
 * FB-026: optional "Aras KBAT" field in the Tag DSKP block. Stored as `tag.kbat` (nullable), never
 * required by any gate.
 */
import { mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'

import QuestionEditor from '../admin/intake/components/QuestionEditor.vue'
import { validateBatch } from '../admin/intake/domain/validation'
import type { IntakeQuestion } from '../admin/intake/types'
import type { TagLookup } from '../domain/tag-rule'
import { loadTagLookup, loadedState, t13Tag } from './tag-fixtures'

let lookup: TagLookup
beforeAll(async () => {
  lookup = await loadTagLookup()
})

function intakeQ(tag: Partial<IntakeQuestion['tag']> = {}): IntakeQuestion {
  return {
    id: 'q1',
    label: '1',
    type: 'mcq',
    stem: 'Hitung $2 + 3$.',
    options: [
      { id: 'A', text: '5' },
      { id: 'B', text: '6' },
    ],
    marks: 1,
    mode: 'short_text',
    parts: [],
    scheme: { kind: 'option', marks: 1, correct: 'A', reason: 'Kunci' },
    tag: t13Tag(tag),
    page: 1,
    lowFields: [],
    confirmed: [],
  }
}

describe('Aras KBAT field', () => {
  it('offers "Bukan KBAT" plus the four levels, defaulting to empty', async () => {
    const w = mount(QuestionEditor, { props: { modelValue: intakeQ(), dskp: await loadedState() } })
    const sel = w.get('[data-testid="q-kbat"]')
    const opts = sel.findAll('option').map((o) => o.text())
    expect(opts).toEqual(['Bukan KBAT', 'Mengaplikasi', 'Menganalisis', 'Menilai', 'Mencipta'])
    expect((sel.element as HTMLSelectElement).value).toBe('')
  })

  it('stores the chosen level in tag.kbat and clears it back to null', async () => {
    const w = mount(QuestionEditor, { props: { modelValue: intakeQ(), dskp: await loadedState() } })
    await w.get('[data-testid="q-kbat"]').setValue('menilai')
    const first = w.emitted('update:modelValue')!.at(-1)![0] as IntakeQuestion
    expect(first.tag.kbat).toBe('menilai')

    await w.setProps({ modelValue: first })
    expect((w.get('[data-testid="q-kbat"]').element as HTMLSelectElement).value).toBe('menilai')
    await w.get('[data-testid="q-kbat"]').setValue('')
    expect((w.emitted('update:modelValue')!.at(-1)![0] as IntakeQuestion).tag.kbat).toBeNull()
  })

  it('is not required by the intake gate', () => {
    const batch = (q: IntakeQuestion) => ({ questions: [q], stimuli: [], source: 'x', copyright: 'sendiri' })
    const none = validateBatch(batch(intakeQ()), lookup).map((i) => i.message)
    const some = validateBatch(batch(intakeQ({ kbat: 'mencipta' })), lookup).map((i) => i.message)
    expect(none.some((m) => /KBAT/i.test(m))).toBe(false)
    expect(some).toEqual(none)
  })
})
