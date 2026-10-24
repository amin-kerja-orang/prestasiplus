// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/unbound-method -- jsdom polyfill checks */
/** audit-sistem FB-024: admin cosmetic consistency (page header, stat row and tile, filter bar). */
import { mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'

import { DsFilterBar, DsPageHeader, DsStatRow, DsStatTile } from '@/ds'

beforeAll(() => {
  const g = globalThis as Record<string, unknown>
  g.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.matchMedia ??= ((query: string) => ({
    matches: true,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
    onchange: null,
  })) as unknown as typeof window.matchMedia
})

describe('DsPageHeader (#9)', () => {
  it('a stacked (form) header does not centre its title block; a plain one still does on staff', () => {
    const stacked = mount(DsPageHeader, {
      props: { title: 'Kertas Baharu', subtitle: 'Pilih subjek.', stackActions: true, showTitle: true },
    })
    const row = stacked.find('[data-ds="page-header"] > div')
    expect(row.classes()).toContain('flex-col')
    expect(row.classes()).not.toContain('staff:items-center')
    const plain = mount(DsPageHeader, { props: { title: 'Senarai', showTitle: true } })
    expect(plain.find('[data-ds="page-header"] > div').classes()).toContain('staff:items-center')
  })
})

describe('DsStatRow (#10)', () => {
  it('a strip of three or more tiles is not capped; a strip of two is', () => {
    const item = (key: string) => ({ key, label: key, value: 1 })
    const three = mount(DsStatRow, { props: { items: [item('a'), item('b'), item('c')] } })
    expect(three.classes().join(' ')).not.toMatch(/max-w-/)
    const two = mount(DsStatRow, { props: { items: [item('a'), item('b')] } })
    expect(two.classes()).toContain('staff:max-w-3xl')
  })
})

describe('DsFilterBar (#13)', () => {
  it('fit marks the bar so the fields stay on one row from md', () => {
    expect(mount(DsFilterBar, { props: { fit: true } }).attributes('data-fit')).toBe('true')
    expect(mount(DsFilterBar).attributes('data-fit')).toBeUndefined()
  })
})

describe('DsStatTile selected (#16)', () => {
  it('shows a check mark and a clickable tile is aria-pressed', () => {
    const on = mount(DsStatTile, { props: { value: 1, unit: 'A', selected: true, clickable: true } })
    expect(on.find('[data-ds="stat-tile-check"]').exists()).toBe(true)
    expect(on.attributes('aria-pressed')).toBe('true')
    const off = mount(DsStatTile, { props: { value: 1, unit: 'A', clickable: true } })
    expect(off.find('[data-ds="stat-tile-check"]').exists()).toBe(false)
    expect(off.attributes('aria-pressed')).toBe('false')
    const compact = mount(DsStatTile, {
      props: { value: 1, unit: 'A', selected: true, density: 'compact' },
    })
    expect(compact.find('[data-ds="stat-tile-check"]').exists()).toBe(true)
  })
})
