// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/unbound-method -- jsdom polyfill checks */
// v2-ds-hardening Wave 1 (T-H3/H4/H5): typed props, one vocabulary, deprecated aliases, new states.
import { mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  DsCharacterCard,
  DsDrillTable,
  DsFeedbackSheet,
  DsFilterBar,
  DsFormField,
  DsHeatGrid,
  DsLoadError,
  DsNativeSelect,
  DsPillNav,
  DsQuizOption,
  DsScoreRing,
  DsStatTile,
  DsStatRow,
  DsWinHero,
} from '@/ds'
import DsChart from '@/ds/DsChart.vue'
import DsDataTable from '@/ds/DsDataTable.vue'
import DsErrorPage from '@/ds/DsErrorPage.vue'
import DsGameTile from '@/ds/DsGameTile.vue'
import DsStatusBadge from '@/ds/DsStatusBadge.vue'
import { dsCopy } from '@/ds/copy'
import { resolveValueClass, toneFromValueClass } from '@/ds/valueTone'
import { confirmState, useConfirm, confirmHost, acceptConfirm, settleConfirm } from '@/ds/useConfirm'

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  const g = globalThis as Record<string, unknown>
  g.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
    onchange: null,
  })) as unknown as typeof window.matchMedia
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('value tone (R2)', () => {
  it('maps tones and the deprecated classes one-to-one', () => {
    expect(resolveValueClass('success', undefined)).toBe('text-success')
    expect(resolveValueClass(undefined, 'text-primary')).toBe('text-primary')
    expect(toneFromValueClass('text-error')).toBe('error')
    expect(resolveValueClass(undefined, undefined)).toBe('text-highlighted')
    expect(resolveValueClass(undefined, 'text-something-else')).toBe('text-something-else')
  })
  it('DsStatTile: valueTone wins over the deprecated valueClass', () => {
    const w = mount(DsStatTile, {
      props: { value: 5, unit: 'Murid', valueTone: 'error', valueClass: 'text-success' },
    })
    expect(w.get('.tabular').classes()).toContain('text-error')
    const old = mount(DsStatTile, { props: { value: 5, unit: 'Murid', valueClass: 'text-success' } })
    expect(old.get('.tabular').classes()).toContain('text-success')
  })
  it('DsStatRow passes valueTone through', () => {
    const w = mount(DsStatRow, {
      props: { items: [{ key: 'a', label: 'A', value: 1, valueTone: 'warning' }] },
    })
    expect(w.get('.tabular').classes()).toContain('text-warning')
  })
})

describe('density replaces the exclusive booleans (R4)', () => {
  it('DsStatTile: density and the deprecated compact / roomy agree', () => {
    expect(
      mount(DsStatTile, { props: { value: 1, unit: 'x', density: 'compact' } })
        .get('[data-ds="stat-tile"]')
        .attributes('data-compact'),
    ).toBe('true')
    expect(
      mount(DsStatTile, { props: { value: 1, unit: 'x', compact: true } })
        .get('[data-ds="stat-tile"]')
        .attributes('data-compact'),
    ).toBe('true')
    expect(
      mount(DsStatTile, { props: { value: 1, unit: 'x', density: 'roomy' } })
        .get('.tabular')
        .classes(),
    ).toContain('text-title')
    expect(
      mount(DsStatTile, { props: { value: 1, unit: 'x', roomy: true } })
        .get('.tabular')
        .classes(),
    ).toContain('text-title')
  })
  it('DsStatRow forwards density to the tiles', () => {
    const w = mount(DsStatRow, {
      props: { density: 'compact', items: [{ key: 'a', label: 'A', value: 1 }] },
    })
    expect(w.get('[data-ds="stat-tile"]').attributes('data-compact')).toBe('true')
  })
  it('DsDataTable: density="compact" equals the deprecated compactCells', () => {
    const cols = [{ accessorKey: 'n', header: 'N' }]
    const data = [{ n: 'a' }]
    const a = mount(DsDataTable, { props: { data, columns: cols, density: 'compact' } }).html()
    const b = mount(DsDataTable, { props: { data, columns: cols, compactCells: true } }).html()
    expect(a).toContain('px-3 py-3')
    expect(b).toContain('px-3 py-3')
  })
})

describe('stat tile states', () => {
  it('selected, disabled and error carry data-state and aria', () => {
    const sel = mount(DsStatTile, { props: { value: 1, unit: 'x', selected: true, clickable: true } })
    expect(sel.get('[data-ds="stat-tile"]').attributes('data-state')).toBe('selected')
    expect(sel.get('[data-ds="stat-tile"]').attributes('aria-current')).toBe('true')
    const dis = mount(DsStatTile, { props: { value: 1, unit: 'x', disabled: true, clickable: true } })
    expect(dis.get('button').attributes('disabled')).toBeDefined()
    expect(dis.get('[data-ds="stat-tile"]').attributes('aria-disabled')).toBe('true')
    const err = mount(DsStatTile, { props: { value: 1, unit: 'x', error: true } })
    expect(err.get('[data-ds="stat-tile-error"]').text()).toBe(dsCopy.loadError)
    expect(err.get('[data-ds="stat-tile"]').attributes('data-state')).toBe('error')
  })
  it('DsStatRow active tile is selected and keeps data-active', () => {
    const w = mount(DsStatRow, {
      props: { items: [{ key: 'a', label: 'A', value: 1, active: true }] },
    })
    expect(w.get('li').attributes('data-active')).toBe('true')
    expect(w.get('[data-ds="stat-tile"]').attributes('data-state')).toBe('selected')
  })
})

describe('DsPillNav states', () => {
  it('a disabled item is a disabled button and never emits', async () => {
    const w = mount(DsPillNav, {
      props: {
        items: [
          { key: 'a', label: 'A' },
          { key: 'b', label: 'B', disabled: true },
        ],
        active: 'a',
        label: 'Status',
      },
    })
    const b = w.findAll('button')[1]!
    expect(b.attributes('disabled')).toBeDefined()
    expect(b.attributes('aria-disabled')).toBe('true')
    await b.trigger('click')
    expect(w.emitted('select')).toBeUndefined()
  })
  it('size lg raises the item height', () => {
    const w = mount(DsPillNav, {
      props: { items: [{ key: 'a', label: 'A' }], active: 'a', label: 'S', size: 'lg' },
    })
    expect(w.get('button').classes()).toContain('min-h-12')
  })
})

describe('DsNativeSelect (R8)', () => {
  const items = [{ label: 'Satu', value: '1' }]
  it('blank adds the default "Pilih"; placeholder text sets it; true is the old form', () => {
    expect(mount(DsNativeSelect, { props: { items, blank: true } }).get('option').text()).toBe('Pilih')
    expect(mount(DsNativeSelect, { props: { items, placeholder: 'Pilih satu' } }).get('option').text()).toBe(
      'Pilih satu',
    )
    expect(mount(DsNativeSelect, { props: { items, placeholder: true } }).get('option').text()).toBe('Pilih')
    expect(mount(DsNativeSelect, { props: { items } }).findAll('option')).toHaveLength(1)
  })
  it('read-only, loading, invalid and size set state attributes', () => {
    const ro = mount(DsNativeSelect, { props: { items, readonly: true } }).get('select')
    expect(ro.attributes('aria-readonly')).toBe('true')
    expect(ro.attributes('data-state')).toBe('read-only')
    const ld = mount(DsNativeSelect, { props: { items, loading: true } }).get('select')
    expect(ld.attributes('aria-busy')).toBe('true')
    const lg = mount(DsNativeSelect, { props: { items, size: 'lg' } })
    expect(lg.get('[role=combobox]').classes()).toContain('min-h-12')
    const nat = mount(DsNativeSelect, { props: { items, native: true, size: 'lg' } }).get('select')
    expect(nat.classes()).toEqual(expect.arrayContaining(['min-h-12', 'pe-10']))
  })
})

describe('DsFormField readonly / loading (R9)', () => {
  it('native mode hands readonly and disabled to the slot and marks the state', () => {
    const w = mount(DsFormField, {
      props: { label: 'X', native: true, readonly: true },
      slots: { default: `<template #default="{ readonly, disabled }"><i :data-ro="readonly" :data-dis="disabled" /></template>` },
    })
    expect(w.get('i').attributes('data-ro')).toBe('true')
    expect(w.get('[data-ds="form-field"]').attributes('data-state')).toBe('read-only')
  })
  it('loading replaces the control with a skeleton', () => {
    const w = mount(DsFormField, {
      props: { label: 'X', native: true, loading: true },
      slots: { default: '<i data-control />' },
    })
    expect(w.find('[data-control]').exists()).toBe(false)
    expect(w.get('[data-ds="form-field"]').attributes('aria-busy')).toBe('true')
  })
})

describe('DsQuizOption disabled (R9)', () => {
  it('is a real disabled button and does not emit', async () => {
    const w = mount(DsQuizOption, { props: { letter: 'A', disabled: true } })
    expect(w.get('button').attributes('disabled')).toBeDefined()
    await w.get('button').trigger('click')
    expect(w.emitted('select')).toBeUndefined()
  })
  it('uses the copy defaults', () => {
    const w = mount(DsQuizOption, { props: { letter: 'A', state: 'correct' } })
    expect(w.text()).toContain(dsCopy.quizCorrect)
  })
})

describe('one vocabulary (R3)', () => {
  it('DsScoreRing: accent + inverted; tone="onPrimary" still works', () => {
    expect(
      mount(DsScoreRing, { props: { value: 5, label: 'S', accent: 'win' } })
        .get('[data-ds="ring-bar"]')
        .classes(),
    ).toContain('text-win-ring')
    expect(
      mount(DsScoreRing, { props: { value: 5, label: 'S', inverted: true } })
        .get('[data-ds="ring-bar"]')
        .classes(),
    ).toContain('text-primary-on')
    expect(
      mount(DsScoreRing, { props: { value: 5, label: 'S', tone: 'onPrimary' } })
        .get('[data-ds="ring-bar"]')
        .classes(),
    ).toContain('text-primary-on')
    expect(
      mount(DsScoreRing, { props: { value: 5, label: 'S', tone: 'win' } })
        .get('[data-ds="ring-bar"]')
        .classes(),
    ).toContain('text-win-ring')
  })
  it('DsCharacterCard: accent, with variant warning = heat as the alias', () => {
    const a = mount(DsCharacterCard, { props: { accent: 'heat', title: 'T', ctaLabel: 'Go' } })
    const v = mount(DsCharacterCard, { props: { variant: 'warning', title: 'T', ctaLabel: 'Go' } })
    expect(a.html()).toContain('bg-heat/15')
    expect(v.html()).toContain('bg-heat/15')
    expect(mount(DsCharacterCard, { props: { title: 'T' } }).get('article').attributes('data-variant')).toBe(
      'action',
    )
  })
  it('DsFeedbackSheet: success / error; good / bad still work', () => {
    for (const [tone, glyph] of [
      ['success', 'check'],
      ['good', 'check'],
      ['error', 'x'],
      ['bad', 'x'],
    ] as const) {
      const w = mount(DsFeedbackSheet, { props: { tone, title: 'T', continueLabel: 'C' } })
      expect(w.get('[data-glyph]').attributes('data-glyph')).toBe(glyph)
    }
  })
  it('DsWinHero: accent="action" equals the old tone="keep"', () => {
    const a = mount(DsWinHero, { props: { art: 'trophy', title: 'T', accent: 'action' } })
    const k = mount(DsWinHero, { props: { art: 'trophy', title: 'T', tone: 'keep' } })
    expect(a.html()).toContain('bg-primary/10')
    expect(k.html()).toContain('bg-primary/10')
  })
  it('DsFilterBar: surface decides the card; tone is the old name', () => {
    expect(mount(DsFilterBar, { props: { surface: 'panel' } }).get('form').classes()).toContain('bg-default')
    expect(mount(DsFilterBar, { props: { tone: 'panel' } }).get('form').classes()).toContain('bg-default')
    expect(mount(DsFilterBar, { props: { surface: 'plain' } }).get('form').classes()).not.toContain('bg-default')
  })
  it('DsLoadError: variant="inline" equals the old inline flag', () => {
    expect(mount(DsLoadError, { props: { variant: 'inline' } }).get('[data-ds="load-error"]').classes()).toContain(
      'flex',
    )
    expect(mount(DsLoadError, { props: { inline: true } }).get('[data-ds="load-error"]').classes()).toContain('flex')
    expect(mount(DsLoadError, { props: { variant: 'inline', loading: true } }).get('button').attributes('disabled')).toBeDefined()
  })
  it('DsStatusBadge: emphasis strong is a solid badge', () => {
    const s = mount(DsStatusBadge, { props: { status: 'live', emphasis: 'strong' } })
    expect(s.find('[data-ds="status-badge"]').exists()).toBe(true)
  })
})

describe('icons are base names (R1)', () => {
  it('DsGameTile defaults to a base name resolved by the personality', () => {
    const w = mount(DsGameTile, { props: { name: 'Permainan' } })
    expect(w.find('[data-ds="icon-chip"]').exists()).toBe(true)
  })
  it('DsGameTile: disabled and loading', () => {
    const w = mount(DsGameTile, { props: { name: 'P', disabled: true } })
    expect(w.get('button').attributes('disabled')).toBeDefined()
    expect(mount(DsGameTile, { props: { name: 'P', loading: true } }).get('button').attributes('aria-busy')).toBe(
      'true',
    )
  })
})

describe('DsChart states (R9, R12)', () => {
  const base = { title: 'Markah', labels: ['A'], series: [{ label: 'M', data: [1] }] }
  it('ready, loading, empty and error', () => {
    expect(mount(DsChart, { props: base }).get('[data-ds="chart"]').attributes('data-state')).toBe('ready')
    const l = mount(DsChart, { props: { ...base, loading: true } })
    expect(l.get('[data-ds="chart"]').attributes('data-state')).toBe('loading')
    expect(l.get('[data-ds="chart"]').attributes('aria-busy')).toBe('true')
    expect(l.find('[data-ds="chart-loading"]').exists()).toBe(true)
    const e = mount(DsChart, { props: { ...base, series: [] } })
    expect(e.get('[data-ds="chart"]').attributes('data-state')).toBe('empty')
    expect(e.text()).toContain(dsCopy.chartEmpty)
    const r = mount(DsChart, { props: { ...base, error: true } })
    expect(r.get('[data-ds="chart"]').attributes('data-state')).toBe('error')
  })
  it('error retry bubbles up; headingLevel and the old level both set the tag', async () => {
    const r = mount(DsChart, { props: { ...base, error: true } })
    await r.get('[data-ds="load-error"] button').trigger('click')
    expect(r.emitted('retry')).toHaveLength(1)
    expect(mount(DsChart, { props: { ...base, headingLevel: 2 } }).find('h2').exists()).toBe(true)
    expect(mount(DsChart, { props: { ...base, level: 2 } }).find('h2').exists()).toBe(true)
    expect(mount(DsChart, { props: base }).find('h3').exists()).toBe(true)
  })
  it('height sets a fixed plot height', () => {
    expect(mount(DsChart, { props: { ...base, height: 'lg' } }).html()).toContain('h-80')
  })
})

describe('useConfirm tone and run (R3, R9)', () => {
  it('danger maps to error, run keeps the dialog loading until it settles', async () => {
    confirmHost.count = 1
    const confirm = useConfirm()
    void confirm({ message: 'x', tone: 'danger' })
    expect(confirmState.tone).toBe('error')
    expect(confirmState.title).toBe(dsCopy.confirmTitle)
    expect(confirmState.confirmLabel).toBe(dsCopy.confirmYes)
    settleConfirm(false)
    let done!: () => void
    const run = () => new Promise<void>((r) => (done = r))
    const p = confirm({ message: 'y', run })
    const accept = acceptConfirm()
    expect(confirmState.loading).toBe(true)
    done()
    await accept
    expect(await p).toBe(true)
    expect(confirmState.loading).toBe(false)
    confirmHost.count = 0
  })
})

describe('copy defaults come from copy.ts (R10)', () => {
  it('error page, heat grid and drill table error', () => {
    expect(mount(DsErrorPage, { props: { code: 403 } }).text()).toContain(dsCopy.error403Title)
    const heat = mount(DsHeatGrid, {
      props: { columns: ['A'], rows: [{ id: 'r', label: 'R', cells: [null] }], label: 'L' },
    })
    expect(heat.text()).toContain(dsCopy.heatLow)
    const dt = mount(DsDrillTable, { props: { data: [], columns: [], error: true } })
    expect(dt.find('[data-ds="load-error"]').exists()).toBe(true)
    const hl = mount(DsHeatGrid, {
      props: { columns: ['A'], rows: [], label: 'L', loading: true },
    })
    expect(hl.find('[data-ds="heat-loading"]').exists()).toBe(true)
  })
})
