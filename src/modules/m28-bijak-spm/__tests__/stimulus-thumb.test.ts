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
const figure: StimulusDef = { ...base, kind: 'diagram', svg: '<svg viewBox="0 0 10 10"></svg>' }

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
  it('keeps the shrunk figure for a diagram', () => {
    const w = mount(StimulusView, { props: { stimulus: figure, thumb: true }, global: { stubs } })
    expect(w.find('svg').exists()).toBe(true)
    expect(w.find('[data-testid=stimulus-thumb-icon]').exists()).toBe(false)
  })
  it('renders the full passage in the sheet (no thumb)', () => {
    const w = mount(StimulusView, { props: { stimulus: passage }, global: { stubs } })
    expect(w.text()).toContain('Sebelum merdeka')
    expect(w.find('[data-testid=stimulus-thumb-icon]').exists()).toBe(false)
  })
})
