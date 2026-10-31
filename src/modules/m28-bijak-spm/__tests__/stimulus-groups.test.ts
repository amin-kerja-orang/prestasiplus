// @vitest-environment jsdom
/**
 * R1-B08 (D90): the student display of served stimuli. Seven kinds, option images, the stem picture, the
 * load-failure state (AC-07.4) and ONE group panel per group with every member question under it (pinned pane
 * from 1024px, chip "Lihat {label}" + sheet below).
 */
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import PartInput from '../components/PartInput.vue'
import QuestionBlock from '../components/QuestionBlock.vue'
import ResultGroup from '../components/ResultGroup.vue'
import StimulusChip from '../components/StimulusChip.vue'
import StimulusStack from '../components/StimulusStack.vue'
import StimulusView from '../components/StimulusView.vue'
import type { QuestionView, StimulusDef } from '../domain/types'
import { groupLabel, stimuliOf, toStimulusData } from '../lib/stimulus-data'

const DrawerStub = defineComponent({
  props: { open: Boolean, title: String, description: String },
  emits: ['update:open'],
  setup(p, { slots }) {
    return () =>
      h('div', { 'data-testid': 'drawer', 'data-open': String(p.open), 'data-title': p.title }, [
        p.open ? slots.body?.() : null,
      ])
  },
})
const stubs = { UDrawer: DrawerStub, Drawer: DrawerStub }

const picture = (kind: StimulusDef['kind'], id = 's1'): StimulusDef => ({
  id,
  kind,
  label: 'Rajah 1',
  alt: 'Gambar contoh',
  caption: 'Sumber: arkib',
  image: { url: `/api/files/tok-${id}` },
})

function media(wide: boolean): void {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: wide,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

afterEach(() => vi.restoreAllMocks())

describe('StimulusView: the seven kinds', () => {
  it.each(['image', 'diagram', 'map', 'infographic', 'graph'] as const)(
    '%s with a stored file loads the token URL lazily, with alt and caption',
    (kind) => {
      const w = mount(StimulusView, { props: { stimulus: picture(kind) }, global: { stubs } })
      const img = w.find('img')
      expect(img.attributes('src')).toBe('/api/files/tok-s1')
      expect(img.attributes('alt')).toBe('Gambar contoh')
      expect(img.attributes('loading')).toBe('lazy')
      expect(w.find('figcaption').text()).toContain('Sumber: arkib')
    },
  )

  it('passage shows its text, title and source; table shows a table', () => {
    const p = mount(StimulusView, {
      props: {
        stimulus: { id: 'p', kind: 'passage', label: 'Petikan A', alt: '', text: 'Isi petikan', title: 'Tajuk', source: 'Buku' },
      },
      global: { stubs },
    })
    expect(p.text()).toContain('Isi petikan')
    expect(p.text()).toContain('Tajuk')
    expect(p.text()).toContain('Buku')
    const t = mount(StimulusView, {
      props: { stimulus: { id: 't', kind: 'table', label: 'Jadual 1', alt: 'j', table: { head: ['a'], rows: [['1']] } } },
      global: { stubs },
    })
    expect(t.find('table').exists()).toBe(true)
  })

  it('a picture that fails shows "Rajah tidak dapat dimuatkan." with Cuba lagi and Lapor and emits error', async () => {
    const w = mount(StimulusView, { props: { stimulus: picture('image') }, global: { stubs } })
    await w.find('img').trigger('error')
    expect(w.text()).toContain('Rajah tidak dapat dimuatkan.')
    expect(w.find('[data-testid=stimulus-retry]').exists()).toBe(true)
    expect(w.find('[data-testid=stimulus-report]').exists()).toBe(true)
    expect(w.emitted('error')).toHaveLength(1)
  })

  it('the thumb of a picture is a small image, not the full figure', () => {
    const w = mount(StimulusView, { props: { stimulus: picture('image'), thumb: true }, global: { stubs } })
    expect(w.find('[data-testid=stimulus-thumb-img]').attributes('src')).toBe('/api/files/tok-s1')
    expect(w.find('figcaption').exists()).toBe(false)
  })
})

describe('adapters', () => {
  it('toStimulusData maps the file URL to src and keeps the label', () => {
    expect(toStimulusData(picture('map'))).toMatchObject({ kind: 'map', src: '/api/files/tok-s1', label: 'Rajah 1' })
  })
  it('stimuli falls back to the single stimulus of an older server; labels join with "dan"', () => {
    const a = picture('image', 'a')
    const b: StimulusDef = { id: 'b', kind: 'passage', label: 'Petikan A', alt: '', text: 'x' }
    expect(stimuliOf({ stimulus: a })).toEqual([a])
    expect(stimuliOf({ stimulus: a, stimuli: [a, b] })).toEqual([a, b])
    expect(groupLabel([a, b])).toBe('Rajah 1 dan Petikan A')
  })
})

describe('D90: one stimulus panel per group, members below it', () => {
  const members = '<article data-testid="member">Soalan 1</article><article data-testid="member">Soalan 2</article>'

  it('from 1024px: ONE pinned pane with the image once and both questions beside it', async () => {
    media(true)
    const w = mount(ResultGroup, {
      props: { groupId: 'qb-g9', stimuli: [picture('image')] },
      slots: { default: members },
      global: { stubs },
    })
    await nextTick()
    expect(w.findAll('[data-testid=result-group]')).toHaveLength(1)
    expect(w.find('[data-testid=result-group]').attributes('data-layout')).toBe('split')
    expect(w.findAll('[data-testid=result-group-pane] img')).toHaveLength(1)
    expect(w.findAll('[data-testid=member]')).toHaveLength(2)
    expect(w.findAll('img')).toHaveLength(1)
  })

  it('below 1024px: a chip "Lihat Rajah 1" and a sheet; the image is not repeated per question', async () => {
    media(false)
    const w = mount(ResultGroup, {
      props: { groupId: 'qb-g9', stimuli: [picture('image')] },
      slots: { default: members },
      global: { stubs },
    })
    await nextTick()
    expect(w.find('[data-testid=result-group]').attributes('data-layout')).toBe('stacked')
    expect(w.find('[data-testid=stimulus-chip]').text()).toContain('Lihat Rajah 1')
    expect(w.findAll('[data-testid=member]')).toHaveLength(2)
    expect(w.find('[data-testid=drawer]').attributes('data-open')).toBe('false')
    await w.find('[data-testid=stimulus-chip]').trigger('click')
    expect(w.find('[data-testid=drawer]').attributes('data-open')).toBe('true')
    expect(w.find('[data-testid=drawer] img').exists()).toBe(true)
  })

  it('a group of several stimuli stacks them in one panel, one chip', () => {
    media(true)
    const two = [picture('image', 'a'), { id: 'b', kind: 'passage' as const, label: 'Petikan A', alt: '', text: 'Isi' }]
    const w = mount(StimulusStack, { props: { stimuli: two }, global: { stubs } })
    expect(w.find('[data-testid=group-stimuli]').attributes('data-count')).toBe('2')
    expect(w.findAll('figure')).toHaveLength(2)
    const chip = mount(StimulusChip, { props: { stimuli: two }, global: { stubs } })
    expect(chip.text()).toContain('Lihat Rajah 1 dan Petikan A')
  })
})

describe('QuestionBlock: stem picture, option pictures, blocked hint', () => {
  const q = (over: Partial<QuestionView> = {}): QuestionView => ({
    id: '501',
    number: 1,
    sectionId: 's',
    topic: 'Bab 1',
    formOrigin: 'T4',
    groupId: 'qb-g9',
    stem: 'Lihat gambar.',
    marks: 2,
    mcq: {
      options: [
        { id: 'A', text: 'Satu', image: { url: '/api/files/tA', alt: 'Pilihan satu' } },
        { id: 'B', text: 'Dua' },
      ],
    },
    ...over,
  })
  const mountQ = (question: QuestionView, extra: Record<string, unknown> = {}) =>
    mount(QuestionBlock, {
      props: { question, answers: {}, attemptId: 'a1', flagged: false, ...extra },
      global: { stubs },
    })

  it('option images switch to the radio list with the picture and its alt', () => {
    const w = mountQ(q())
    expect(w.find('[data-testid=mcq-options]').exists()).toBe(true)
    expect(w.find('[data-testid=mcq-option-image]').attributes('src')).toBe('/api/files/tA')
    expect(w.find('[data-testid=mcq-option-image]').attributes('alt')).toBe('Pilihan satu')
  })

  it('picking an option with a picture emits the answer for the question id', async () => {
    const w = mountQ(q())
    await w.find('input[value="B"]').setValue(true)
    expect(w.emitted('answer')?.[0]).toEqual(['501', { choice: 'B' }])
  })

  it('text-only options keep the existing quiz options', () => {
    const w = mountQ(q({ mcq: { options: [{ id: 'A', text: 'Satu' }, { id: 'B', text: 'Dua' }] } }))
    expect(w.find('[data-testid=mcq-options]').exists()).toBe(false)
    expect(w.find('[data-testid="option-A"]').exists()).toBe(true)
  })

  it('shows the stem picture under the stem and the "Muatkan rajah" hint when the group figure failed', () => {
    const w = mountQ(q({ stemImage: picture('image', 'stem') }), { stimulusBlocked: true })
    expect(w.find('[data-testid=stem-image] img').attributes('src')).toBe('/api/files/tok-stem')
    expect(w.find('[data-testid=need-stimulus]').text()).toBe('Muatkan rajah untuk meneruskan.')
  })
})

describe('PartInput: essay_choice', () => {
  it('picks one topic first, then writes; the answer carries choice and text', async () => {
    const leaf = {
      id: '1.a',
      label: '(a)',
      prompt: 'Pilih',
      marks: 10,
      kind: 'essay_choice' as const,
      wordRange: { min: 100, max: 200 },
      topics: [{ id: 'T1', label: 'Tajuk satu' }, { id: 'T2', label: 'Tajuk dua' }],
      depth: 0,
    }
    const w = mount(PartInput, {
      props: { leaf, modelValue: undefined, attemptId: 'a1' },
      global: { stubs },
    })
    expect(w.findAll('[data-testid=topic-list] input')).toHaveLength(2)
    await w.find('input[value="T2"]').setValue(true)
    expect(w.emitted('update:modelValue')?.[0]?.[0]).toMatchObject({ choice: 'T2', text: '' })
  })
})
