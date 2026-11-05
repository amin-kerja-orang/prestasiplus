// @vitest-environment jsdom
// S8-T07: axe smoke over the main answer and paper components (jsdom cannot compute color-contrast).
import { mount } from '@vue/test-utils'
import { axe } from 'vitest-axe'
import * as matchers from 'vitest-axe/matchers'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { formStubs } from '@/test-support/form-stubs'

import EssayAnswer from '../EssayAnswer.vue'
import McqOptions from '../McqOptions.vue'
import NavigatorPanel from '../NavigatorPanel.vue'
import PaperView from '../PaperView.vue'
import TextAnswer from '../TextAnswer.vue'

expect.extend(matchers)
declare module 'vitest' {
  interface Assertion {
    toHaveNoViolations(): void
  }
}

const global = { components: formStubs }
const run = async (w: ReturnType<typeof mount>) => {
  const results = await axe(w.element as HTMLElement, { rules: { 'color-contrast': { enabled: false } } })
  expect(results).toHaveNoViolations()
}
const Drawer = defineComponent({ setup: () => () => h('div') })

describe('axe', () => {
  it('McqOptions', async () => {
    await run(
      mount(McqOptions, {
        props: {
          options: [
            { id: 'o1', letter: 'A', text: 'Satu' },
            { id: 'o2', letter: 'B', text: 'Dua' },
          ],
        },
        global,
        attachTo: document.body,
      }),
    )
  })
  it('TextAnswer', async () => {
    await run(mount(TextAnswer, { props: { mode: 'short_text' }, global, attachTo: document.body }))
  })
  it('EssayAnswer', async () => {
    await run(
      mount(EssayAnswer, {
        props: { mode: 'extended_essay', modelValue: 'a b', range: { min: 1, max: 5 } },
        global,
        attachTo: document.body,
      }),
    )
  })
  it('NavigatorPanel', async () => {
    await run(
      mount(NavigatorPanel, {
        props: {
          sections: [{ id: 's1', label: 'Bahagian A', rule: { type: 'all' } }] as never,
          questions: [1, 2].map((n) => ({ id: `q${n}`, number: n, sectionId: 's1' })) as never,
          states: { q1: 'answered', q2: 'none' },
          current: 'q1',
        },
        attachTo: document.body,
      }),
    )
  })
  it('PaperView', async () => {
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
      matches: false,
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })) as never
    await run(
      mount(PaperView, {
        props: {
          sections: [
            {
              id: 's1',
              label: 'Bahagian 1',
              marks: 5,
              questions: [
                { id: 'q1', number: 1, marks: 5, stem: 'Stem', parts: [{ id: 'a', label: '(a)', prompt: 'Nyatakan', marks: 5 }] },
              ],
            },
          ] as never,
        },
        global: { stubs: { UDrawer: Drawer, Drawer } },
        attachTo: document.body,
      }),
    )
  })
})
