// @vitest-environment jsdom
// S8-T05 part 1: shared PaperView (FR-X6-10, FR-QA-48/49, FR-PA-20).
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { deductionLine, maksLabel } from '../copy'
import PaperView from '../PaperView.vue'
import type { PaperPart, PaperSection, StimulusData } from '../types'

enableAutoUnmount(afterEach)

const DrawerStub = defineComponent({ setup: () => () => h('div') })
const stubs = { UDrawer: DrawerStub, Drawer: DrawerStub }

const nested: PaperPart[] = [
  {
    id: 'a',
    label: '(a)',
    prompt: 'Nyatakan',
    marks: 3,
    children: [
      { id: 'a1', label: '(i)', prompt: 'Satu', marks: 1, children: [{ id: 'a1x', label: '(x)', prompt: 'Dalam', marks: 1 }] },
      { id: 'a2', label: '(ii)', prompt: 'Dua', marks: 2 },
    ],
  },
]
const paper = (): PaperSection[] =>
  [1, 2, 3].map((si) => ({
    id: `s${si}`,
    label: `Bahagian ${si}`,
    instruction: `Arahan ${si}`,
    marks: 20,
    compulsory: si === 1,
    questions: [1, 2, 3, 4].map((qi) => {
      const n = (si - 1) * 4 + qi
      return {
        id: `q${n}`,
        number: n,
        marks: 5,
        stem: `Stem ${n}`,
        parts: nested.map((p) => ({ ...p, id: `${p.id}-${n}`, children: p.children?.map((c) => ({ ...c, id: `${c.id}-${n}`, children: c.children?.map((g) => ({ ...g, id: `${g.id}-${n}` })) })) })),
      }
    }),
  }))

const mountPaper = (props: Record<string, unknown> = {}, slots: Record<string, string> = {}) =>
  mount(PaperView, { props: { sections: paper(), ...props }, slots: slots, global: { stubs }, attachTo: document.body })

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: false,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })) as never
})

describe('PaperView', () => {
  it('FR-X6-10: a long paper renders every section, question number and marks', () => {
    const w = mountPaper()
    expect(w.findAll('section[data-testid^="paper-section-"]')).toHaveLength(3)
    expect(w.text()).toContain('Bahagian 2')
    expect(w.text()).toContain('Arahan 3')
    expect(w.text()).toContain('(wajib)')
    for (let n = 1; n <= 12; n++) {
      const q = w.get(`[data-testid="paper-q-q${n}"]`)
      expect(q.text()).toContain(`Soalan ${n}`)
      expect(q.text()).toContain('[5 markah]')
    }
    expect(w.text()).toContain('Dalam')
  })

  it('FR-X6-10: at 375 no fixed width class, parts indent ps-3 per depth, guards on stem', () => {
    const w = mountPaper()
    expect(w.html()).not.toMatch(/\b(w-\[\d|w-\d{2,}|min-w-\[|max-w-\[)/)
    const q = w.get('[data-testid="paper-q-q1"]')
    expect(q.get('[data-testid="paper-part-a-1"]').classes()).not.toContain('ps-3')
    expect(q.get('[data-testid="paper-part-a1-1"]').classes()).toContain('ps-3')
    expect(q.get('[data-testid="paper-part-a1x-1"]').classes()).toContain('ps-6')
    expect(q.get('[data-testid="paper-stem"]').classes()).toEqual(expect.arrayContaining(['min-w-0', 'overflow-x-auto']))
  })

  it('FR-X6-10: rotation keeps place, restores the anchor question offset', () => {
    vi.useFakeTimers()
    const el = document.createElement('div')
    el.scrollTop = 100
    const scrollTo = vi.fn()
    el.scrollTo = scrollTo as never
    el.getBoundingClientRect = () => ({ top: 0, bottom: 600 }) as DOMRect
    document.body.appendChild(el)
    const w = mountPaper({ scrollContainer: el })
    const q2 = w.get('[data-testid="paper-q-q2"]').element
    let y = 40
    for (const n of Array.from({ length: 12 }, (_, i) => i + 1)) {
      const e = w.get(`[data-testid="paper-q-q${n}"]`).element
      e.getBoundingClientRect = () => ({ top: e === q2 ? y : n === 1 ? -300 : 900, bottom: e === q2 ? y + 100 : n === 1 ? -10 : 1000 }) as DOMRect
    }
    ;(w.vm as unknown as { record: () => void }).record()
    y = 190 // layout shifted after rotation
    window.dispatchEvent(new Event('resize'))
    expect(scrollTo).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    expect(scrollTo).toHaveBeenCalledWith({ top: 250 })
    w.unmount()
    scrollTo.mockClear()
    window.dispatchEvent(new Event('resize'))
    vi.advanceTimersByTime(200)
    expect(scrollTo).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  describe('reveal', () => {
    const withScheme = (): PaperSection[] => [
      {
        id: 's',
        label: 'B1',
        questions: [
          {
            id: 'q',
            number: 1,
            marks: 6,
            stem: 'S',
            parts: [{ id: 'p', prompt: 'Huraikan', marks: 6, maxCap: 4, deductions: [{ label: 'kesalahan', n: 7, amount: 1, cap: 5 }] }],
          },
        ],
      },
    ]
    it('FR-PA-20: reveal=false renders no reveal lines', () => {
      const w = mountPaper({ sections: withScheme() })
      expect(w.text()).not.toContain('Maks')
      expect(w.text()).not.toContain('Potongan')
    })
    it('AC-QA-48/49: reveal=true shows "Maks 4" and the D115 deduction line', () => {
      const w = mountPaper({ sections: withScheme(), reveal: true })
      expect(w.get('[data-testid="paper-cap"]').text()).toBe(maksLabel(4))
      expect(w.get('[data-testid="paper-cap"]').text()).toBe('Maks 4')
      expect(w.get('[data-testid="paper-deduction"]').text()).toBe('Potongan: kesalahan 7 x 1 (maks 5)')
      expect(deductionLine('kesalahan', 7, 1, 5)).toBe('Potongan: kesalahan 7 x 1 (maks 5)')
    })
    it('reveal=true with no data renders nothing', () => {
      const w = mountPaper({ reveal: true })
      expect(w.find('[data-testid="paper-cap"]').exists()).toBe(false)
      expect(w.find('[data-testid="paper-deduction"]').exists()).toBe(false)
    })
  })

  it('slots override the defaults', () => {
    const w = mountPaper(
      { reveal: true },
      {
        'section-head': '<h2 data-testid="sh">custom {{ params.section.id }}</h2>',
        'question-head': '<b data-testid="qh">QH</b>',
        part: '<i data-testid="pp">P {{ params.depth }}</i>',
        'part-extra': '<u data-testid="px">X {{ params.reveal }}</u>',
        'question-foot': '<s data-testid="qf">F</s>',
      },
    )
    // string slots expose scope as `params`
    expect(w.findAll('[data-testid="sh"]')).toHaveLength(3)
    expect(w.findAll('[data-testid="qh"]')).toHaveLength(12)
    expect(w.findAll('[data-testid="qf"]')).toHaveLength(12)
    expect(w.findAll('[data-testid="pp"]').length).toBeGreaterThan(0)
    expect(w.findAll('[data-testid="px"]')[0]!.text()).toBe('X true')
    expect(w.text()).not.toContain('Soalan 1')
  })

  it('a stimulus group of 3 questions shows its stimuli once', () => {
    const st: StimulusData = { id: 'p1', kind: 'passage', label: 'Petikan A', text: 'Teks petikan unik.' }
    const sections: PaperSection[] = [
      {
        id: 's',
        label: 'B',
        questions: [1, 2, 3].map((n) => ({ id: `g${n}`, number: n, marks: 2, stem: `G${n}`, groupId: 'grp', stimuli: [st] })),
      },
    ]
    const w = mountPaper({ sections })
    expect(w.findAll('[data-testid="stimulus-group"]')).toHaveLength(1)
    expect(w.text().split('Teks petikan unik.').length - 1).toBeLessThanOrEqual(1)
    expect(w.findAll('[data-paper-q]')).toHaveLength(3)
  })
})
