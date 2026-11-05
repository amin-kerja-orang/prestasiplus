// @vitest-environment jsdom
// S8-T07 part 1: copy per PRD and labels (D01-D05, D10-D12).
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { formStubs } from '@/test-support/form-stubs'
import type { Leaf } from '@pp/exam-core/paper-model'

import { kindFallbackCaption, notServedLine, overLabel, shortLabel, visibleSummary, wordTargetLabel } from '../copy'
import EssayAnswer from '../EssayAnswer.vue'
import PartInput from '../PartInput.vue'
import StimulusFigure from '../StimulusFigure.vue'
import VisibilityList from '../VisibilityList.vue'

const global = { components: formStubs }
const words = (n: number) => Array.from({ length: n }, () => 'a').join(' ')
const leaf = (over: Partial<Leaf>): Leaf =>
  ({ id: 'p1', label: '(a)', prompt: 'S', marks: 2, kind: 'essay', depth: 0, ...over })

describe('S8-T07 copy helpers', () => {
  it('D02 word target, over and short lines follow 46 2.2.1', () => {
    expect(wordTargetLabel(120, 150, 200)).toBe('120 / 150-200 patah perkataan')
    expect(overLabel(200)).toBe('Jawapan melebihi 200 patah perkataan.')
    expect(shortLabel(120, 150)).toBe('Jawapan terlalu pendek (120 patah perkataan; minimum 150).')
  })
  it('D10 not-served line says "disajikan"', () => {
    expect(notServedLine('x')).toBe('Tidak disajikan kerana x.')
  })
  it('D11 fallback total is 6', () => {
    expect(visibleSummary(2)).toBe('Dilihat murid di 2 daripada 6 aktiviti')
    const w = mount(VisibilityList, { props: { rows: [] } })
    expect(w.find('[data-testid=visibility-summary]').text()).toContain('daripada 6 aktiviti')
  })
  it('D04 every stimulus kind has a fallback caption', () => {
    for (const k of ['image', 'infographic', 'passage', 'diagram', 'map', 'graph', 'table']) {
      expect(kindFallbackCaption[k], k).toBeTruthy()
    }
  })
})

describe('S8-T07 EssayAnswer word hints (D02)', () => {
  const mk = (n: number) =>
    mount(EssayAnswer, {
      props: { mode: 'essay_choice', topics: [], range: { min: 5, max: 8 }, choice: { topic: 't', text: words(n) } },
      global,
    })
  it('below min shows the short hint, within shows none, above max shows the over hint; never blocks', () => {
    expect(mk(3).find('[data-testid=word-hint]').text()).toBe('Jawapan terlalu pendek (3 patah perkataan; minimum 5).')
    expect(mk(6).find('[data-testid=word-hint]').exists()).toBe(false)
    const over = mk(9)
    expect(over.find('[data-testid=word-hint]').text()).toBe('Jawapan melebihi 8 patah perkataan.')
    expect(over.find('[data-testid=word-count]').text()).toBe('9 / 5-8 patah perkataan')
    expect(over.find('textarea').attributes('disabled')).toBeUndefined()
  })
})

describe('S8-T07 PartInput', () => {
  const render = (l: Leaf, value = {}) =>
    mount(PartInput, { props: { leaf: l, modelValue: value, attemptId: 'a1' }, global })
  it('D01 essay never says the teacher grades by band; D02 uses the helpers', () => {
    const w = render(leaf({ wordRange: { min: 5, max: 8 } }), { text: words(9) })
    expect(w.text()).not.toContain('Guru akan menilai')
    expect(w.find('[data-testid=word-count]').text()).toBe('9 / 5-8 patah perkataan')
    expect(w.text()).toContain('Jawapan melebihi 8 patah perkataan.')
    const s = render(leaf({ wordRange: { min: 5, max: 8 } }), { text: words(2) })
    expect(s.text()).toContain('Jawapan terlalu pendek (2 patah perkataan; minimum 5).')
  })
  it('D03 an unknown kind renders no notice', () => {
    const w = render(leaf({ kind: 'bogus' as never }))
    expect(w.find('[data-testid=kind-unavailable]').exists()).toBe(false)
    expect(w.text()).not.toContain('akan tersedia')
  })
  it('D12 the photo list label follows the leaf kind', () => {
    const photos = [{ key: 'k', name: 'a.png' }]
    expect(render(leaf({ kind: 'drawing' }), { photos }).find('ul').attributes('aria-label')).toBe(
      'Gambar jawapan lukisan',
    )
    expect(render(leaf({ kind: 'working' }), { photos }).find('ul').attributes('aria-label')).toBe(
      'Gambar jalan kerja',
    )
  })
})

describe('S8-T07 StimulusFigure (D04, D05)', () => {
  const open = async (stimulus: Record<string, unknown>) => {
    const w = mount(StimulusFigure, {
      props: { stimulus: { id: 'f', kind: 'image', src: '/x.png', ...stimulus } as never },
    })
    await w.find('img').trigger('load')
    return w
  }
  it('D04 accessible name falls back to label, title, then the kind caption', async () => {
    expect((await open({ label: 'Rajah 3' })).find('img').attributes('alt')).toBe('Rajah 3')
    expect((await open({ title: 'Tajuk X' })).find('img').attributes('alt')).toBe('Tajuk X')
    const w = await open({ kind: 'infographic' })
    expect(w.find('img').attributes('alt')).toBe('Infografik')
    expect(w.find('[data-testid=stimulus-zoom-open]').attributes('aria-label')).toBe('Infografik')
  })
  it('D05 the zoom trigger is transparent, not opacity 0, so the focus ring shows', async () => {
    const b = (await open({ label: 'Rajah 1' })).find('[data-testid=stimulus-zoom-open]')
    expect(b.attributes('style') ?? '').not.toContain('opacity')
    expect(b.classes()).toContain('bg-transparent')
  })
})
