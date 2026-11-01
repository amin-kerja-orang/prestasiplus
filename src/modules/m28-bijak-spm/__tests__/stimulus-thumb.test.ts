// @vitest-environment jsdom
/**
 * FB-043: the sticky stimulus strip below `lg` has a 48 px thumbnail slot. A passage or a table must
 * show an icon tile there (the full text only opens in the sheet), a figure still shrinks in.
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import StimulusView from '../components/StimulusView.vue'
import type { StimulusDef } from '../domain/types'

const stubs = {
  UTable: { template: '<table data-stub="table" />' },
}
const base = { id: 's', label: 'Bahan 1', alt: 'Petikan ringkas.' }
const passage: StimulusDef = {
  ...base,
  kind: 'passage',
  text: 'Sebelum merdeka, pemimpin pelbagai kaum berunding dan bersetuju tentang asas negara baharu.',
}
const table: StimulusDef = {
  ...base,
  kind: 'table',
  table: { head: ['Huruf', 'Tahun'], rows: [['A', '1946']] },
}
const figure: StimulusDef = { ...base, kind: 'diagram', image: { url: '/api/files/tok', width: 10, height: 10 } }

describe('StimulusView thumb (strip below lg)', () => {
  it('shows an icon tile, not the passage text, for a passage', () => {
    const w = mount(StimulusView, { props: { stimulus: passage, thumb: true }, global: { stubs } })
    expect(w.find('[data-testid=stimulus-thumb-icon]').attributes('data-kind')).toBe('passage')
    expect(w.text()).not.toContain('Sebelum merdeka')
  })
  it('shows a table icon for a table and renders no table', () => {
    const w = mount(StimulusView, { props: { stimulus: table, thumb: true }, global: { stubs } })
    expect(w.find('[data-testid=stimulus-thumb-icon]').attributes('data-kind')).toBe('table')
    expect(w.find('[data-stub="table"]').exists()).toBe(false)
  })
  it('keeps the shrunk picture for a diagram (a file URL, never inline markup)', () => {
    const w = mount(StimulusView, { props: { stimulus: figure, thumb: true }, global: { stubs } })
    expect(w.find('[data-testid=stimulus-thumb-img]').attributes('src')).toBe('/api/files/tok')
    expect(w.find('svg').exists()).toBe(false)
    expect(w.find('[data-testid=stimulus-thumb-icon]').exists()).toBe(false)
  })
  it('REQ-A-010: an `svg` field is ignored, never injected', () => {
    const w = mount(StimulusView, {
      props: { stimulus: { ...figure, image: undefined, svg: '<svg><script>x</script></svg>' } as never },
      global: { stubs },
    })
    expect(w.html()).not.toContain('<script')
    expect(w.find('svg').exists()).toBe(false)
  })
  it('renders the full passage in the sheet (no thumb)', () => {
    const w = mount(StimulusView, { props: { stimulus: passage }, global: { stubs } })
    expect(w.text()).toContain('Sebelum merdeka')
    expect(w.find('[data-testid=stimulus-thumb-icon]').exists()).toBe(false)
  })
})
