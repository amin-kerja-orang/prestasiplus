// @vitest-environment jsdom
// S8-T03 part 5: matching bank shown once in the stimulus panel (FR-PA-10).
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import MatchingBank from '../MatchingBank.vue'
import StimulusGroup from '../StimulusGroup.vue'

const options = [
  { id: 'A', text: 'Pilihan satu' },
  { id: 'B', text: 'Pilihan dua' },
]
const media = (wide: boolean) => {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: wide,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

describe('FR-PA-10 matching bank', () => {
  it('lists the lettered options, read-only', () => {
    const w = mount(MatchingBank, { props: { options } })
    expect(w.findAll('li').map((l) => l.text())).toEqual(['APilihan satu', 'BPilihan dua'])
    expect(w.find('button').exists()).toBe(false)
  })
  it('StimulusGroup shows it once in the pinned panel (1280)', async () => {
    media(true)
    const w = mount(StimulusGroup, {
      props: {
        stimulus: { id: 'p1', kind: 'passage', label: 'Petikan', text: 'T' },
        matchingBank: options,
      },
      slots: { default: '<p>S1</p><p>S2</p>' },
    })
    await nextTick()
    expect(w.findAll('[data-testid=matching-bank]')).toHaveLength(1)
    expect(w.find('[data-testid=stimulus-pane] [data-testid=matching-bank]').exists()).toBe(true)
  })
  it('without the prop no bank is drawn', async () => {
    media(true)
    const w = mount(StimulusGroup, {
      props: { stimulus: { id: 'p1', kind: 'passage', label: 'Petikan', text: 'T' } },
      slots: { default: '<p>S1</p>' },
    })
    await nextTick()
    expect(w.find('[data-testid=matching-bank]').exists()).toBe(false)
  })
})
