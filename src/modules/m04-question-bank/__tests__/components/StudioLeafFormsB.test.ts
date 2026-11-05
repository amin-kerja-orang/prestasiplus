// @vitest-environment jsdom
import { QuestionLeafPartV3Schema, QuestionWriteLeafPartSchema } from '@pp/contract'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

import EssayChoiceLeafForm from '../../components/studio/EssayChoiceLeafForm.vue'
import EssayLeafForm from '../../components/studio/EssayLeafForm.vue'
import MatchLeafForm from '../../components/studio/MatchLeafForm.vue'
import McqLeafForm from '../../components/studio/McqLeafForm.vue'
import StudioLeafEditor from '../../components/studio/StudioLeafEditor.vue'
import WorkingLeafForm from '../../components/studio/WorkingLeafForm.vue'
import { blankLeaf, draftGaps, blankDraft, leafToPart, type LeafDraft } from '../../lib/studio/draft'

vi.mock('../../api/studio', () => ({ uploadStudioImage: vi.fn() }))

const T = 'x'
const has = (w: ReturnType<typeof mount>, id: string) => w.find(`[data-testid="${id}"]`).exists()
const issues = (r: { error?: { issues: { message: string }[] } }) => (r.error?.issues ?? []).map((i) => i.message)
const writeOk = (leaf: LeafDraft) => issues(QuestionWriteLeafPartSchema.safeParse(leafToPart(leaf)))
const v3Ok = (leaf: LeafDraft) => issues(QuestionLeafPartV3Schema.safeParse(leafToPart(leaf)))
const filledMcq = (): LeafDraft => {
  const l = blankLeaf('a', 'mcq')
  l.prompt = 'Soalan?'
  l.options.forEach((o, i) => (o.text = `Pilihan ${String(i + 1)}`))
  return l
}

describe('MatchLeafForm (mode 2, FR-ADM-QE3.18)', () => {
  const bank = [{ label: 'A', text: 'ke' }, { label: 'B', text: 'di' }, { label: 'C', text: 'dari' }]
  const leaf = (): LeafDraft => ({ ...blankLeaf('33', 'match_letter'), prompt: 'Lengkapkan.' })

  it('lists the bank letters and emits a mapping key the contract accepts', async () => {
    const l = leaf()
    const w = mount(MatchLeafForm, { props: { modelValue: l, testid: T, bank } })
    expect(w.findAll('option').filter((o) => ['A', 'B', 'C'].includes(o.attributes('value') ?? ''))).toHaveLength(3)
    await w.get(`[data-testid="${T}-bank-letter"]`).setValue('C')
    expect(l.bankLetter).toBe('C')
    expect(leafToPart(l).key).toEqual({ kind: 'mapping', map: { '33': 'C' } })
    expect(writeOk(l)).toEqual([])
  })
  it('bankUnique (`Setiap huruf digunakan sekali`) is written to the key', async () => {
    const l = leaf()
    l.bankLetter = 'B'
    const w = mount(MatchLeafForm, { props: { modelValue: l, testid: T, bank } })
    expect(w.text()).toContain('Setiap huruf digunakan sekali')
    await w.get(`[data-testid="${T}-bank-unique"]`).trigger('click')
    expect(l.bankUnique).toBe(true)
    expect(leafToPart(l).key).toEqual({ kind: 'mapping', map: { '33': 'B' }, bankUnique: true })
  })
  it('without a group shows the PRD text and no select', () => {
    const w = mount(MatchLeafForm, { props: { modelValue: leaf(), testid: T, bank: null } })
    expect(w.text()).toContain('Padanan memerlukan kumpulan dengan bank pilihan.')
    expect(has(w, `${T}-bank-letter`)).toBe(false)
  })
  it('the completeness list carries the same text for a match leaf of a question without a group', () => {
    const d = { ...blankDraft(), leaves: [leaf()] }
    expect(draftGaps(d).map((g) => g.message)).toContain('Padanan memerlukan kumpulan dengan bank pilihan.')
  })
})

describe('WorkingLeafForm (mode 5, minimal; the scheme editor is part C)', () => {
  it('adds points and a final answer and emits a points key the contract accepts', async () => {
    const l = { ...blankLeaf('a', 'working'), prompt: 'Hitung.', marks: 3 }
    const w = mount(WorkingLeafForm, { props: { modelValue: l, testid: T } })
    await w.get(`[data-testid="${T}-add-point"]`).trigger('click')
    await w.get(`[data-testid="${T}-point-0-label"]`).setValue('Guna F = ma')
    await w.get(`[data-testid="${T}-point-0-marks"]`).setValue('2')
    await w.get(`[data-testid="${T}-add-point"]`).trigger('click')
    await w.get(`[data-testid="${T}-point-1-label"]`).setValue('Jawapan')
    await w.get(`[data-testid="${T}-final-display"]`).setValue('12 N')
    await w.get(`[data-testid="${T}-final-accepted"]`).setValue('12\n12.0')
    await w.get(`[data-testid="${T}-final-unit"]`).setValue('N')
    expect(l.points.map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(leafToPart(l).key).toEqual({
      kind: 'points',
      marks: 3,
      points: [
        { id: 'p1', code: 'M', label: 'Guna F = ma', marks: 2 },
        { id: 'p2', code: 'M', label: 'Jawapan', marks: 1 },
      ],
      final: { display: '12 N', accept: ['12', '12.0'], unit: 'N' },
    })
    expect(writeOk(l)).toEqual([])
  })
  it('removes a point', async () => {
    const l = blankLeaf('a', 'working')
    l.points = [{ id: 'p1', code: 'K', label: 'a', marks: 1, rest: {} }, { id: 'p2', code: 'N', label: 'b', marks: 1, rest: {} }]
    const w = mount(WorkingLeafForm, { props: { modelValue: l, testid: T } })
    await w.get(`[data-testid="${T}-point-0-remove"]`).trigger('click')
    expect(l.points.map((p) => p.id)).toEqual(['p2'])
  })
  it('a stored scheme v2 key keeps its other fields and its own names for the final answer', async () => {
    const l = { ...blankLeaf('a', 'working'), prompt: 'Hitung.' }
    l.keyBase = { kind: 'points', scheme_v: 2, marks: 1, points: [{ id: 'p1', code: 'M', label: 'k', marks: 1 }], bonus: { ifAllCorrect: true, marks: 1, label: 'Bonus' }, finalAnswer: { display: '1', accepted: ['1'] } }
    l.points = [{ id: 'p1', code: 'M', label: 'k', marks: 1, rest: {} }]
    l.final = { display: '1', accepted: '1', tolerance: '', unit: '' }
    const w = mount(WorkingLeafForm, { props: { modelValue: l, testid: T } })
    await w.get(`[data-testid="${T}-final-tolerance"]`).setValue('0.5')
    const key = leafToPart(l).key as Record<string, unknown>
    expect(key.bonus).toEqual({ ifAllCorrect: true, marks: 1, label: 'Bonus' })
    expect(key.finalAnswer).toEqual({ display: '1', accepted: ['1'], tol: 0.5 })
    expect('final' in key).toBe(false)
    expect(v3Ok({ ...l, marks: 1 })).toEqual([])
  })
})

describe('EssayLeafForm (mode 6)', () => {
  const rubric = { kind: 'rubric', marks: 10, criteria: [{ id: 'c1', name: 'Isi' }], bands: [{ name: 'Baik', range: [0, 10] }] }
  const leaf = (): LeafDraft => ({ ...blankLeaf('a', 'essay'), prompt: 'Tulis.', marks: 10, keyBase: rubric })

  it('writes wordRange, hardLimit and answerSpace to modeConfig, accepted by the contract', async () => {
    const l = leaf()
    const w = mount(EssayLeafForm, { props: { modelValue: l, testid: T } })
    await w.get(`[data-testid="${T}-words-min`+`"]`).setValue('100')
    await w.get(`[data-testid="${T}-words-max"]`).setValue('200')
    await w.get(`[data-testid="${T}-hard-limit"]`).trigger('click')
    await w.get(`[data-testid="${T}-answer-space"]`).setValue('medium')
    expect(leafToPart(l).modeConfig).toEqual({ wordRange: { min: 100, max: 200 }, hardLimit: true, answerSpace: 'medium' })
    expect(writeOk(l)).toEqual([])
  })
  it('min above max shows "Julat perkataan tidak sah." and is listed as a gap, and writes no range', async () => {
    const l = leaf()
    const w = mount(EssayLeafForm, { props: { modelValue: l, testid: T } })
    await w.get(`[data-testid="${T}-words-min"]`).setValue('300')
    await w.get(`[data-testid="${T}-words-max"]`).setValue('200')
    expect(w.text()).toContain('Julat perkataan tidak sah.')
    expect(draftGaps({ ...blankDraft(), leaves: [l] }).map((g) => g.message)).toContain('Julat perkataan tidak sah.')
    expect(leafToPart(l).modeConfig).toBeUndefined()
  })
  it('a leaf without a scheme is listed as "tiada skema jawapan"', () => {
    const l = { ...leaf(), keyBase: null }
    expect(draftGaps({ ...blankDraft(), leaves: [l] }).map((g) => g.message)).toContain('Bahagian (a) tiada skema jawapan.')
  })
})

describe('EssayChoiceLeafForm (mode 7)', () => {
  const rubric = { kind: 'rubric', marks: 30, criteria: [{ id: 'c1', name: 'Isi' }], bands: [{ name: 'Baik', range: [0, 30] }] }
  const leaf = (): LeafDraft => ({ ...blankLeaf('a', 'essay_choice'), prompt: 'Pilih satu.', marks: 30, keyBase: rubric })
  const stimuli = [{ id: '70', label: 'E-mel 1' }, { id: '71', label: 'E-mel 2' }]

  it('starts with 2 alternatives, adds up to 6 and removes down to 2', async () => {
    const l = leaf()
    const w = mount(EssayChoiceLeafForm, { props: { modelValue: l, testid: T, stimuli } })
    expect(l.alternatives).toHaveLength(2)
    expect(has(w, `${T}-alt-0-remove`)).toBe(false)
    for (let i = 0; i < 4; i += 1) await w.get(`[data-testid="${T}-add-alt"]`).trigger('click')
    expect(l.alternatives).toHaveLength(6)
    expect(new Set(l.alternatives.map((a) => a.id)).size).toBe(6)
    expect(has(w, `${T}-add-alt`)).toBe(false)
    await w.get(`[data-testid="${T}-alt-5-remove"]`).trigger('click')
    expect(l.alternatives).toHaveLength(5)
  })
  it('emits topics (Tajuk) and modeConfig.alternatives (Teks gesaan, Rangsangan gesaan) the contract accepts', async () => {
    const l = leaf()
    const w = mount(EssayChoiceLeafForm, { props: { modelValue: l, testid: T, stimuli } })
    await w.get(`[data-testid="${T}-alt-0-title"]`).setValue('Surat rasmi')
    await w.get(`[data-testid="${T}-alt-0-prompt"]`).setValue('Tulis surat.')
    await w.get(`[data-testid="${T}-alt-0-stimulus"]`).setValue('70')
    await w.get(`[data-testid="${T}-alt-1-title"]`).setValue('Ucapan')
    await w.get(`[data-testid="${T}-alt-1-prompt"]`).setValue('Tulis ucapan.')
    const part = leafToPart(l)
    expect(part.topics).toEqual([{ id: 't1', label: 'Surat rasmi' }, { id: 't2', label: 'Ucapan' }])
    expect((part.modeConfig as { alternatives: unknown }).alternatives).toEqual([
      { id: 't1', prompt: { ms: 'Tulis surat.' }, stimulusId: '70' },
      { id: 't2', prompt: { ms: 'Tulis ucapan.' } },
    ])
    expect(writeOk(l)).toEqual([])
  })
  it('without a group there is no Rangsangan gesaan select; under 2 alternatives gives the PRD error', async () => {
    const l = reactive(leaf())
    const w = mount(EssayChoiceLeafForm, { props: { modelValue: l, testid: T, stimuli: [] } })
    expect(has(w, `${T}-alt-0-stimulus`)).toBe(false)
    l.alternatives = l.alternatives.slice(0, 1)
    await w.vm.$nextTick()
    expect(w.text()).toContain('Esei pilihan mesti mempunyai 2 hingga 6 topik.')
    expect(draftGaps({ ...blankDraft(), leaves: [l] }).map((g) => g.message)).toContain('Esei pilihan mesti mempunyai 2 hingga 6 topik.')
  })
})

describe('McqLeafForm extras (mode 1)', () => {
  it('Terima pilihan lain writes accepted labels and Nota kunci to the key', async () => {
    const l = filledMcq()
    l.correct = 'A'
    const w = mount(McqLeafForm, { props: { modelValue: l, testid: T } })
    expect(has(w, `${T}-accepted-options`)).toBe(false)
    await w.get(`[data-testid="${T}-accept-other"]`).trigger('click')
    await w.get(`[data-testid="${T}-accepted-D"]`).trigger('click')
    await w.get(`[data-testid="${T}-key-note"]`).setValue('D pun diterima')
    expect(leafToPart(l).key).toEqual({ kind: 'option', correct: 'A', accepted: ['D'], note: 'D pun diterima' })
    expect(writeOk(l)).toEqual([])
    await w.get(`[data-testid="${T}-accept-other"]`).trigger('click')
    expect(leafToPart(l).key).toEqual({ kind: 'option', correct: 'A' })
  })
  it('Pelbagai jawapan stores modeConfig.multi and the key `options`', async () => {
    const l = filledMcq()
    const w = mount(McqLeafForm, { props: { modelValue: l, testid: T } })
    await w.get(`[data-testid="${T}-multi"]`).trigger('click')
    const next = (w.emitted('update:modelValue')!.at(-1) as [LeafDraft])[0]
    await w.setProps({ modelValue: next })
    await w.get(`[data-testid="${T}-correct-A"]`).trigger('click')
    await w.get(`[data-testid="${T}-correct-C"]`).trigger('click')
    const part = leafToPart(next)
    expect(part.key).toEqual({ kind: 'options', correctOptionIds: ['A', 'C'] })
    expect(part.modeConfig).toEqual({ multi: true })
    expect(v3Ok(next)).toEqual([])
  })
  it('Betul / Salah gives two fixed rows that cannot be edited or removed', async () => {
    const l = filledMcq()
    const w = mount(McqLeafForm, { props: { modelValue: l, testid: T } })
    await w.get(`[data-testid="${T}-true-false"]`).trigger('click')
    const next = (w.emitted('update:modelValue')!.at(-1) as [LeafDraft])[0]
    await w.setProps({ modelValue: next })
    expect(next.options.map((o) => o.text)).toEqual(['Betul', 'Salah'])
    expect(w.get(`[data-testid="${T}-text-A"]`).attributes('disabled')).toBeDefined()
    expect(has(w, `${T}-add-option`)).toBe(false)
    expect(has(w, `${T}-option-A-remove`)).toBe(false)
  })
  it('allows 2 options now (min 2, max 8)', async () => {
    const l = filledMcq()
    l.options = l.options.slice(0, 3)
    const w = mount(McqLeafForm, { props: { modelValue: l, testid: T } })
    await w.get(`[data-testid="${T}-option-C-remove"]`).trigger('click')
    const next = (w.emitted('update:modelValue')!.at(-1) as [LeafDraft])[0]
    expect(next.options).toHaveLength(2)
    await w.setProps({ modelValue: next })
    expect(has(w, `${T}-option-A-remove`)).toBe(false)
  })
})

describe('StudioLeafEditor host: every mode and the example leaf (L-13)', () => {
  const host = (mode: LeafDraft['mode'], group: { bank: { label: string; text: string }[]; stimuli: { id: string; label: string }[] } | null = null) =>
    mount(StudioLeafEditor, { props: { modelValue: blankLeaf('a', mode), testid: 'l', canRemove: true, group } })

  it('mounts the form of each new mode and offers the seven modes in `Jenis jawapan`', () => {
    expect(has(host('match_letter'), 'l-match')).toBe(true)
    expect(has(host('working'), 'l-working')).toBe(true)
    expect(has(host('essay'), 'l-essay')).toBe(true)
    const ec = host('essay_choice')
    expect(has(ec, 'l-essay-choice')).toBe(true)
    expect(has(ec, 'l-essay')).toBe(true)
    const values = ec.get('[data-testid="l-mode"]').findAll('option').map((o) => o.attributes('value'))
    expect(values).toEqual(['mcq', 'match_letter', 'short_text', 'numeric', 'working', 'essay', 'essay_choice'])
  })
  it('hands the group bank to the match form', () => {
    const w = host('match_letter', { bank: [{ label: 'A', text: 'ke' }], stimuli: [] })
    expect(has(w, 'l-bank-letter')).toBe(true)
  })
  it('Contoh (tidak dimarkah): marks 0, required Jawapan contoh, then a valid 0-mark leaf', async () => {
    const leaf = { ...blankLeaf('a', 'short_text'), prompt: 'Contoh.' }
    const w = mount(StudioLeafEditor, { props: { modelValue: leaf, testid: 'l', canRemove: false } })
    expect(has(w, 'l-example-answer')).toBe(false)
    await w.get('[data-testid="l-example"]').trigger('click')
    expect(leaf.exampleAnswer).toBe('')
    expect(leaf.marks).toBe(0)
    expect(w.get('[data-testid="l-marks"]').attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('Jawapan contoh diperlukan.')
    expect(draftGaps({ ...blankDraft(), leaves: [leaf] }).map((g) => g.message)).toContain('Jawapan contoh diperlukan.')
    await w.get('[data-testid="l-example-answer"]').setValue('kuprum')
    expect(w.text()).not.toContain('Jawapan contoh diperlukan.')
    expect(leafToPart(leaf)).toMatchObject({ marks: 0, modeConfig: { example: { answer: 'kuprum' } }, key: { kind: 'accepted', values: ['kuprum'] } })
    expect(writeOk(leaf)).toEqual([])
    await w.get('[data-testid="l-example"]').trigger('click')
    expect(leaf.exampleAnswer).toBeNull()
    expect(leaf.marks).toBe(1)
  })
  it('the example answer of an mcq leaf is an option label', async () => {
    const leaf = filledMcq()
    const w = mount(StudioLeafEditor, { props: { modelValue: leaf, testid: 'l', canRemove: false } })
    await w.get('[data-testid="l-example"]').trigger('click')
    const sel = w.get('[data-testid="l-example-answer"]')
    expect(sel.element.tagName).toBe('SELECT')
    await sel.setValue('B')
    expect(leaf.exampleAnswer).toBe('B')
    expect(writeOk(leaf)).toEqual([])
  })
})
