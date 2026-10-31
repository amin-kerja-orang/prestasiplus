// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'

import { blankQuestion } from '../admin/intake/domain/blank'
import QuestionEditor from '../admin/intake/components/QuestionEditor.vue'
import type { IntakeQuestion } from '../admin/intake/types'
import { itemPatch, questionFromItem, type WireItem } from '../server/intake-wire'

/** R1-B05: the reviewer sets "Aras pemikiran" per leaf in the intake editor; the T33 approve gate needs it. */
const mounted: { unmount: () => void }[] = []
afterEach(() => {
  for (const w of mounted.splice(0)) w.unmount()
})

const mountEditor = (q: IntakeQuestion, showCognitive = true) => {
  const w = mount(QuestionEditor, {
    props: { modelValue: q, showCognitive },
    global: { stubs: { RouterLink: true, teleport: true } },
    attachTo: document.body,
  })
  mounted.push(w)
  return w
}

describe('intake editor: Aras pemikiran per leaf', () => {
  it('a question without parts has one select with the six Studio levels, and emits the chosen level', async () => {
    const q = { ...blankQuestion('MAT', 1), type: 'mcq' as const, parts: [] }
    const w = mountEditor(q)
    const sel = w.get('[data-testid="q-cognitive"]')
    expect(sel.findAll('option').map((o) => o.text())).toEqual([
      'Pilih aras pemikiran',
      'Mengingat',
      'Memahami',
      'Mengaplikasi',
      'Menganalisis',
      'Menilai',
      'Mencipta',
    ])
    await sel.setValue('menganalisis')
    const out = w.emitted('update:modelValue')!.at(-1)![0] as IntakeQuestion
    expect(out.cognitiveLevel).toBe('menganalisis')
    await w.setProps({ modelValue: out })
    await w.get('[data-testid="q-cognitive"]').setValue('')
    const cleared = w.emitted('update:modelValue')!.at(-1)![0] as IntakeQuestion
    expect('cognitiveLevel' in cleared).toBe(false)
  })

  it('a structured question has one select per part and writes it on that part only', async () => {
    const base = blankQuestion('MAT', 1)
    const part = (id: string, label: string) => ({ id, label, prompt: 'p', marks: 1, mode: 'short_text' as const })
    const q: IntakeQuestion = { ...base, type: 'structured', parts: [part('p1', '(a)'), part('p2', '(b)')] }
    const w = mountEditor(q)
    expect(w.find('[data-testid="q-cognitive"]').exists()).toBe(false)
    const sels = w.findAll('[data-testid="part-cognitive"]')
    expect(sels).toHaveLength(2)
    await sels[1]!.setValue('menilai')
    const out = w.emitted('update:modelValue')!.at(-1)![0] as IntakeQuestion
    expect(out.parts[0]!.cognitiveLevel).toBeUndefined()
    expect(out.parts[1]!.cognitiveLevel).toBe('menilai')
  })

  it('the field is shown only where the review page asks for it', () => {
    const w = mountEditor({ ...blankQuestion('MAT', 1), type: 'mcq' as const, parts: [] }, false)
    expect(w.find('[data-testid="q-cognitive"]').exists()).toBe(false)
  })
})

describe('intake wire: cognitiveLevel travels with the item', () => {
  const item = {
    id: '9',
    label: '1',
    type: 'mcq',
    stem: 's',
    options: [],
    marks: 1,
    mode: 'short_text',
    parts: [],
    tag: { subject: 'MAT', level: 'T4', unit: null, sp: [], tp: 1, formOrigin: 'T4' },
    page: 1,
    lowFields: [],
    confirmed: [],
    cognitiveLevel: 'memahami',
  } as unknown as WireItem

  it('is read from the item and diffed into the patch (null clears it)', () => {
    const prev = questionFromItem(item)
    expect(prev.cognitiveLevel).toBe('memahami')
    expect(itemPatch(prev, { ...prev, cognitiveLevel: 'mencipta' })).toEqual({ cognitiveLevel: 'mencipta' })
    const { cognitiveLevel: _c, ...without } = prev
    void _c
    expect(itemPatch(prev, without as IntakeQuestion)).toEqual({ cognitiveLevel: null })
    expect(itemPatch(prev, { ...prev })).toBeNull()
  })

  it('a part level goes inside the parts array of the patch', () => {
    const prev = questionFromItem({ ...item, type: 'structured', parts: [{ id: 'a', label: '(a)', prompt: 'x', marks: 1, mode: 'short_text' }] } as unknown as WireItem)
    const next = { ...prev, parts: [{ ...prev.parts[0]!, cognitiveLevel: 'mengaplikasi' as const }] }
    expect(itemPatch(prev, next)).toEqual({ parts: next.parts })
  })
})
