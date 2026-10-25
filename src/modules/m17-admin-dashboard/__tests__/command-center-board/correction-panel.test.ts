// @vitest-environment jsdom
/**
 * RS3-02 / DV-M17-49: the S2 "Pembetulan" tiles sit in the DS auto-fit grid (never narrower than the DS
 * minimum), not in 3 fixed columns; the loading copy shows while the figures are not loaded.
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import CorrectionPanel from '../../components/command-center-board/CorrectionPanel.vue'

const correction = { total: 1234, avgImprovement: 4.5, improvedCount: 3, topImprovers: [] }

describe('CorrectionPanel', () => {
  it('renders the three tiles in a DS auto-fit list, not 3 fixed columns', () => {
    const w = mount(CorrectionPanel, { props: { correction } })
    const list = w.get('ul')
    expect(list.attributes('data-ds')).toBe('grid')
    expect(list.classes()).toContain('grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]')
    expect(list.classes()).not.toContain('grid-cols-3')
    const items = list.findAll(':scope > li')
    expect(items).toHaveLength(3)
    expect(items.map((li) => li.attributes('data-testid'))).toEqual([
      'cc-correction-total',
      'cc-correction-avg',
      'cc-correction-rate',
    ])
    for (const li of items) expect(li.classes()).toContain('min-w-0')
    expect(items.map((li) => li.text())).toEqual([
      expect.stringContaining('Rekod'),
      expect.stringContaining('Purata Naik'),
      expect.stringContaining('Kadar Baik'),
    ])
  })

  it('shows the loading copy and no list while the correction is null', () => {
    const w = mount(CorrectionPanel, { props: { correction: null } })
    expect(w.text()).toContain('Memuatkan...')
    expect(w.find('ul').exists()).toBe(false)
  })
})
