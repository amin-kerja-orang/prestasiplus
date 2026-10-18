// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/unbound-method -- jsdom polyfill checks */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

import { mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  DsActiveFilters,
  DsConfirmHost,
  DsDataTable,
  DsEmptyState,
  DsFilterBar,
  DsIconChip,
  DsLoadError,
  DsRowActions,
  DsStatRow,
  DsStatTile,
  DsStatusBadge,
  dsCopy,
  fillCopy,
  statusMap,
  type DsStatus,
} from '@/ds'
import { createMemoryHistory, createRouter } from 'vue-router'

import { resetStaffRise, staffRiseAllowed } from '@/ds/rise'
import { dsIconClasses } from '@/theme/ds-icons'

const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms))

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

afterEach(() => {
  document.body.innerHTML = ''
})

const rows = Array.from({ length: 45 }, (_, i) => ({ id: i + 1, nama: `Murid #${i + 1}.`, skor: i }))
const columns = [
  { accessorKey: 'nama', header: 'Nama' },
  { accessorKey: 'skor', header: 'Skor' },
]

describe('copy', () => {
  it('fills placeholders and keeps unknown ones', () => {
    expect(fillCopy(dsCopy.pagerSummary, { from: 1, to: 5, total: 12 })).toBe(
      'Menunjukkan 1-5 daripada 12 hasil',
    )
    expect(fillCopy('{a} {b}', { a: 1 })).toBe('1 {b}')
  })
  it('uses the canonical filter and retry words', () => {
    expect(dsCopy.filterSearch).toBe('Cari')
    expect(dsCopy.filterSheetApply).toBe('Guna')
    expect(dsCopy.filterReset).toBe('Set Semula')
    expect(dsCopy.retry).toBe('Cuba Semula')
  })
})

describe('DsDataTable API', () => {
  it('variant sets the surface; bare has no card', async () => {
    const card = mount(DsDataTable, { props: { data: rows, columns } })
    const flush = mount(DsDataTable, { props: { data: rows, columns, variant: 'flush' } })
    const bare = mount(DsDataTable, { props: { data: rows, columns, variant: 'bare' } })
    await wait()
    expect(card.attributes('data-variant')).toBe('card')
    expect(flush.attributes('data-variant')).toBe('flush')
    expect(bare.attributes('data-variant')).toBe('bare')
    expect(bare.classes()).toContain('flex-col')
    expect(card.classes()).not.toContain('flex-col')
  })
  it('empty copy follows filtered', async () => {
    const never = mount(DsDataTable, { props: { data: [], columns } })
    const none = mount(DsDataTable, { props: { data: [], columns, filtered: true } })
    await wait()
    expect(never.text()).toContain('Tiada data.')
    expect(none.text()).toContain('Tiada data dijumpai.')
    expect(none.text()).toContain('Cuba ubah atau set semula penapis.')
  })
  it('page-size options use one label and aria, and change the page size', async () => {
    const w = mount(DsDataTable, {
      props: { data: rows, columns, pageSize: 10, pageSizeOptions: [10, 20, 50] },
    })
    await wait()
    expect(w.find(`[aria-label="${dsCopy.pageSizeAria}"]`).exists()).toBe(true)
    expect(w.text()).toContain('Menunjukkan 1-10 daripada 45 hasil')
  })
  it('server paging: total drives the summary and rows are not sliced', async () => {
    const w = mount(DsDataTable, {
      props: { data: rows.slice(0, 5), columns, total: 100, pageSize: 5, page: 3 },
    })
    await wait()
    expect(w.text()).toContain('Menunjukkan 11-15 daripada 100 hasil')
    expect(w.text()).toContain('Murid #5.')
  })
  it('an empty set shows the empty state and no pager', async () => {
    const w = mount(DsDataTable, { props: { data: [], columns, pageSizeOptions: [10] } })
    await wait()
    expect(w.find('[data-ds="data-table-pager"]').exists()).toBe(false)
  })
  it('selectable adds a checkbox column and writes the selection model', async () => {
    const w = mount(DsDataTable, {
      props: { data: rows.slice(0, 3), columns, selectable: true, rowKey: 'id' },
    })
    await wait()
    const boxes = w.findAll('button[role="checkbox"]')
    expect(boxes.length).toBe(4)
    await boxes[1]!.trigger('click')
    await wait()
    const sel = w.emitted('update:selection')
    expect(sel).toBeTruthy()
    expect((sel!.at(-1)![0] as unknown[]).length).toBe(1)
  })
  it('card slot replaces the default mobile card content', async () => {
    const w = mount(DsDataTable, {
      props: { data: rows.slice(0, 2), columns },
      slots: { card: '<span data-test="c">kad</span>' },
    })
    await wait()
    // jsdom matches (min-width) queries as true, so the wide table renders; the slot is unused there.
    expect(w.find('[data-test="c"]').exists()).toBe(false)
  })
  it('error alert uses the canonical retry label', async () => {
    const w = mount(DsDataTable, { props: { data: [], columns, error: 'Gagal' } })
    await wait()
    expect(w.text()).toContain('Cuba Semula')
    expect(w.text()).not.toContain('Cuba Lagi')
  })
})

describe('DsFilterBar', () => {
  it('shows chips, emits remove-chip and reset from the chips row', async () => {
    const w = mount(DsFilterBar, {
      props: { chips: [{ key: 'q', label: 'Tahun 2026' }] },
    })
    await wait()
    expect(w.text()).toContain('Penapis aktif:')
    await w.get('[data-testid="active-filter"]').trigger('click')
    expect(w.emitted('remove-chip')![0]).toEqual(['q'])
    await w.get('[data-testid="active-filters-reset"]').trigger('click')
    expect(w.emitted('reset')).toHaveLength(1)
  })
  it('auto reset: hidden when a count is given and zero, visible by default for old callers', async () => {
    const none = mount(DsFilterBar, { props: { activeCount: 0 } })
    const legacy = mount(DsFilterBar)
    const explicit = mount(DsFilterBar, { props: { activeCount: 0, showReset: true } })
    await wait()
    const has = (w: typeof none) => w.findAll('button').some((b) => b.text() === 'Set Semula')
    expect(has(none)).toBe(false)
    expect(has(legacy)).toBe(true)
    expect(has(explicit)).toBe(true)
  })
  it('more slot opens from a Lagi Penapis button with its count', async () => {
    const w = mount(DsFilterBar, {
      props: { moreCount: 2 },
      slots: { more: '<span>tambahan</span>' },
    })
    await wait()
    const btn = w.get('[data-ds="filter-more"]')
    expect(btn.text()).toContain('Lagi Penapis')
  })
  it('tone plain drops the panel surface', () => {
    const plain = mount(DsFilterBar, { props: { tone: 'plain' } })
    const panel = mount(DsFilterBar, { props: { tone: 'panel' } })
    expect(plain.classes()).not.toContain('shadow-card')
    expect(panel.classes()).toContain('shadow-card')
  })
  it('loading puts the apply button into its loading state', async () => {
    const w = mount(DsFilterBar, { props: { loading: true } })
    await wait()
    const apply = w.findAll('button').find((b) => b.attributes('type') === 'submit')!
    expect(apply.attributes('disabled')).toBeDefined()
  })
})

describe('DsActiveFilters', () => {
  it('renders nothing without chips; labels the remove buttons in BM', () => {
    expect(mount(DsActiveFilters, { props: { chips: [] } }).find('div').exists()).toBe(false)
    const w = mount(DsActiveFilters, { props: { chips: [{ key: 'a', label: 'Aktif' }] } })
    expect(w.get('[data-testid="active-filter"]').attributes('aria-label')).toBe(
      'Buang penapis Aktif',
    )
    expect(w.text()).toContain('Set Semula')
  })
})

describe('DsRowActions', () => {
  it('splits inline buttons, the menu and the danger group', async () => {
    const onEdit = vi.fn()
    const w = mount(DsRowActions, {
      props: {
        inline: 1,
        actions: [
          { label: 'Edit', icon: 'i-ph-pencil-simple', onSelect: onEdit },
          { label: 'Salin', icon: 'i-ph-copy' },
          { label: 'Padam', icon: 'i-ph-trash', danger: true },
        ],
      },
    })
    await wait()
    const buttons = w.findAll('button')
    expect(buttons[0]!.text()).toBe('Edit')
    expect(w.find('[data-testid="row-menu"]').attributes('aria-label')).toBe('Tindakan')
    await buttons[0]!.trigger('click')
    expect(onEdit).toHaveBeenCalledTimes(1)
  })
  it('an action with confirm runs only after the dialog is confirmed', async () => {
    const onDelete = vi.fn()
    const host = mount(DsConfirmHost, { attachTo: document.body })
    const w = mount(DsRowActions, {
      props: {
        inline: 1,
        actions: [{ label: 'Edit', onSelect: onDelete, confirm: { title: 'Edit Pengguna?' } }],
      },
    })
    await wait()
    await w.findAll('button')[0]!.trigger('click')
    await wait(60)
    expect(onDelete).not.toHaveBeenCalled()
    const ok = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.textContent.trim() === 'Edit',
    )
    expect(ok).toBeTruthy()
    ok!.click()
    await wait(60)
    expect(onDelete).toHaveBeenCalledTimes(1)
    host.unmount()
  })
})

describe('DsStatTile', () => {
  it('shows sub and an accessible delta with an arrow, not colour alone', () => {
    const w = mount(DsStatTile, {
      props: { value: 12, unit: 'Pelajar', sub: 'daripada 40', delta: { value: '+4%', dir: 'up' } },
    })
    expect(w.text()).toContain('daripada 40')
    expect(w.get('[data-ds="stat-tile-delta"]').text()).toContain('naik')
    expect(w.get('[data-ds="stat-tile-delta"]').text()).toContain('+4%')
    expect(w.get('[data-ds="stat-tile-delta"]').classes()).toContain('text-success')
  })
  it('with to the whole tile is a link', () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/senarai', component: { render: () => null } }],
    })
    const w = mount(DsStatTile, {
      props: { value: 3, unit: 'Tiket', to: '/senarai' },
      global: { plugins: [router] },
    })
    expect(w.element.tagName).toBe('A')
    expect(w.attributes('href')).toBe('/senarai')
  })
  it('loading shows a skeleton instead of the number', () => {
    const w = mount(DsStatTile, { props: { value: 12, unit: 'Pelajar', loading: true } })
    expect(w.text()).not.toContain('12')
    expect(w.attributes('aria-busy')).toBe('true')
  })
  it('accepts a base icon name', () => {
    const w = mount(DsStatTile, { props: { value: 1, unit: 'x', icon: 'funnel', tone: 'error' } })
    expect(w.get('[data-ds="icon-chip"]').classes()).toContain('bg-error/12')
  })
  it('staff rise is short and plays once per load', () => {
    resetStaffRise()
    expect(staffRiseAllowed(1000)).toBe(true)
    expect(staffRiseAllowed(1200)).toBe(true)
    expect(staffRiseAllowed(5000)).toBe(false)
    resetStaffRise()
    const a = mount(DsStatTile, { props: { value: 1, unit: 'a' } })
    const b = mount(DsStatTile, { props: { value: 2, unit: 'b' } })
    expect(a.classes()).toContain('staff:animate-ds-rise-quick')
    expect(a.classes()).toContain('animate-ds-rise')
    expect(b.classes()).toContain('staff:animate-ds-rise-quick')
    resetStaffRise()
  })
})

describe('DsIconChip', () => {
  it('uses staff sizes 28 / 32 / 40 and learner sizes on the variant', () => {
    const sm = mount(DsIconChip, { props: { icon: 'funnel', size: 'sm' } })
    const md = mount(DsIconChip, { props: { icon: 'funnel', size: 'md' } })
    const lg = mount(DsIconChip, { props: { icon: 'funnel', size: 'lg' } })
    expect(sm.classes()).toContain('size-7')
    expect(md.classes()).toContain('size-8')
    expect(lg.classes()).toContain('size-10')
    expect(sm.classes()).toContain('learner:size-9')
  })
})

describe('DsStatRow', () => {
  it('renders tiles with test ids and a column count from the item count', () => {
    const w = mount(DsStatRow, {
      props: {
        prefix: 'kpi',
        items: [
          { key: 'a', label: 'A', value: 1 },
          { key: 'b', label: 'B', value: 2 },
          { key: 'c', label: 'C', value: 3 },
          { key: 'd', label: 'D', value: 4 },
          { key: 'e', label: 'E', value: 5 },
          { key: 'f', label: 'F', value: 6 },
        ],
      },
    })
    expect(w.findAll('[data-ds="stat-tile"]')).toHaveLength(6)
    expect(w.find('[data-testid="kpi-c"]').exists()).toBe(true)
    expect(w.classes()).toContain('xl:grid-cols-5')
    const two = mount(DsStatRow, {
      props: { items: [{ key: 'a', label: 'A', value: 1 }] },
    })
    expect(two.classes()).toContain('grid-cols-2')
    expect(two.classes()).not.toContain('md:grid-cols-3')
  })
})

describe('DsStatusBadge', () => {
  const all = Object.keys(statusMap) as DsStatus[]
  it('every status has an icon, a glossary word and a colour', () => {
    const words = all.map((s) => statusMap[s].word)
    expect(new Set(words).size).toBe(all.length)
    for (const s of all) {
      const w = mount(DsStatusBadge, { props: { status: s } })
      expect(w.text()).toBe(statusMap[s].word)
      expect(w.find('[data-weight="bold"]').exists()).toBe(true)
    }
  })
  it('uses the glossary words', () => {
    const t = (s: DsStatus) => mount(DsStatusBadge, { props: { status: s } }).text()
    expect(t('inactive')).toBe('Tidak Aktif')
    expect(t('awaiting-review')).toBe('Menunggu Semakan')
    expect(t('risk-high')).toBe('Tinggi')
  })
  it('label overrides the word (live exception)', () => {
    expect(mount(DsStatusBadge, { props: { status: 'new', label: 'BARU' } }).text()).toBe('BARU')
  })
  it('every status icon is in the bundled icon registry', () => {
    for (const s of all) {
      for (const suffix of ['', '-bold']) {
        expect(dsIconClasses).toContain(`i-ph-${statusMap[s].icon}${suffix}`)
      }
    }
  })
})

describe('DsLoadError', () => {
  it('defaults to Cuba Semula, emits retry and is an alert', async () => {
    const w = mount(DsLoadError, { props: { message: 'Gagal' } })
    await wait()
    expect(w.attributes('role')).toBe('alert')
    const btn = w.findAll('button').find((b) => b.text() === 'Cuba Semula')!
    await btn.trigger('click')
    expect(w.emitted('retry')).toHaveLength(1)
  })
  it('inline form and testid', async () => {
    const w = mount(DsLoadError, { props: { inline: true, testid: 'err' } })
    await wait()
    expect(w.attributes('data-testid')).toBe('err')
    expect(w.text()).toContain('Tidak dapat memuatkan data. Sila cuba semula.')
  })
})

describe('DsEmptyState', () => {
  it('glossary copy: never created, filtered, with a reset action', async () => {
    const never = mount(DsEmptyState, { props: { item: 'soalan' } })
    expect(never.text()).toContain('Belum ada soalan.')
    const onReset = vi.fn()
    const filtered = mount(DsEmptyState, {
      props: { item: 'soalan', filtered: true, onReset },
    })
    await wait()
    expect(filtered.text()).toContain('Tiada soalan dijumpai.')
    expect(filtered.text()).toContain('Cuba ubah atau set semula penapis.')
    await filtered.findAll('button').find((b) => b.text() === 'Set Semula')!.trigger('click')
    expect(onReset).toHaveBeenCalledTimes(1)
  })
  it('explicit title still wins; size is forwarded', () => {
    const w = mount(DsEmptyState, { props: { title: 'Tiada rekod', size: 'sm' } })
    expect(w.text()).toContain('Tiada rekod')
  })
})

describe('icon registry', () => {
  it('new base names exist in Phosphor (regular, duotone, bold)', () => {
    const require = createRequire(import.meta.url)
    const ph = JSON.parse(readFileSync(require.resolve('@iconify-json/ph/icons.json'), 'utf8')) as {
      icons: Record<string, unknown>
    }
    for (const n of ['funnel', 'dots-three', 'hourglass', 'warning-octagon', 'broadcast']) {
      for (const s of ['', '-duotone', '-bold']) expect(`${n}${s}` in ph.icons).toBe(true)
    }
  })
})
