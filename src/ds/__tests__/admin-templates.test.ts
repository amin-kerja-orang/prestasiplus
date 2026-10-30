// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/unbound-method -- jsdom polyfill checks */
import { mount, RouterLinkStub } from '@vue/test-utils'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  DsBadge,
  DsCallout,
  DsDataTable,
  DsDefinitionList,
  DsPage,
  DsPageHeader,
  DsPanel,
  DsPillNav,
  DsSplit,
  DsStatRow,
  DsStatTile,
  formatCount,
  formatPercent,
  formatStat,
} from '@/ds'

const stubs = { RouterLink: RouterLinkStub }

beforeAll(() => {
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

describe('format', () => {
  it('formats counts, percentages and empties', () => {
    expect(formatCount(1271)).toBe('1,271')
    expect(formatPercent(73.34)).toBe('73.3%')
    expect(formatStat(33)).toBe('33')
    expect(formatStat(12.5)).toBe('12.5')
    expect(formatStat(null)).toBe('-')
    expect(formatStat('73.3%')).toBe('73.3%')
  })
})

describe('DsStatTile / DsStatRow', () => {
  it('formats the number and renders the sub slot', () => {
    const w = mount(DsStatTile, {
      props: { value: 1271, unit: 'Pengguna', valueTone: 'dimmed' },
      slots: { sub: '<b>+4</b>' },
    })
    expect(w.text()).toContain('1,271')
    expect(w.find('[data-ds=stat-tile-sub] b').exists()).toBe(true)
    expect(w.find('.text-dimmed').exists()).toBe(true)
  })
  const items = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ key: `k${i}`, label: `L${i}`, value: i }))
  it('5 tiles: first full below md, 3 + 2 on the 6-column track, 5 across at xl', () => {
    const w = mount(DsStatRow, { props: { items: items(5) } })
    expect(w.get('ul').classes()).toEqual(expect.arrayContaining(['md:grid-cols-6', 'xl:grid-cols-5']))
    const li = w.findAll('li')
    expect(li[0]!.classes()).toContain('col-span-2')
    expect(li[3]!.classes()).toContain('md:col-span-3')
  })
  it('3 tiles: first full below md; 4 tiles: 2x2 until xl', () => {
    expect(mount(DsStatRow, { props: { items: items(3) } }).findAll('li')[0]!.classes()).toContain(
      'col-span-2',
    )
    const four = mount(DsStatRow, { props: { items: items(4) } })
    expect(four.get('ul').classes()).toEqual(expect.arrayContaining(['grid-cols-2', 'xl:grid-cols-4']))
    expect(four.get('ul').classes()).not.toContain('md:grid-cols-3')
  })
})

describe('DsPage / DsPageHeader', () => {
  it('staff forms are full width', () => {
    expect(mount(DsPage, { props: { layout: 'form' } }).classes()).toContain('staff:max-w-none')
  })
  it('actions stack full width on a phone, source order kept', () => {
    const w = mount(DsPageHeader, {
      props: { subtitle: 's' },
      slots: { actions: '<button id="a">A</button><button id="b">B</button>' },
    })
    const box = w.get('[data-ds=page-header-actions]')
    expect(box.classes()).toEqual(expect.arrayContaining(['flex-col', 'sm:flex-row']))
    expect(box.findAll('button').map((b) => b.attributes('id'))).toEqual(['a', 'b'])
  })
  it('meta renders in the detail layout', () => {
    const w = mount(DsPage, { props: { layout: 'detail' }, slots: { meta: '<i id="m"></i>' } })
    expect(w.find('#m').exists()).toBe(true)
  })
})

describe('DsDataTable pager', () => {
  const columns = [{ accessorKey: 'n', header: 'N' }]
  const data = Array.from({ length: 25 }, (_, i) => ({ n: i }))
  it('pager="none" hides summary and pagination', () => {
    const on = mount(DsDataTable, { props: { data, columns, pageSize: 10 } })
    expect(on.find('[data-ds=data-table-pager]').exists()).toBe(true)
    const off = mount(DsDataTable, { props: { data, columns, pageSize: 10, pager: 'none' } })
    expect(off.find('[data-ds=data-table-pager]').exists()).toBe(false)
  })
})

describe('DsPanel moreTo', () => {
  it('prints a "Lihat Semua" link in the header with a descriptive name', () => {
    const w = mount(DsPanel, { props: { title: 'Tiket', moreTo: '/admin/tiket' }, global: { stubs } })
    const link = w.get('[data-ds=panel-more]')
    expect(link.text()).toContain('Lihat Semua')
    expect(link.attributes('aria-label')).toBe('Lihat Semua Tiket')
  })
})

describe('DsPillNav count', () => {
  it('shows the formatted count', () => {
    const w = mount(DsPillNav, {
      props: {
        label: 'Status',
        active: 'a',
        items: [
          { key: 'a', label: 'Terbuka', count: 1271 },
          { key: 'b', label: 'Tutup' },
        ],
      },
    })
    expect(w.findAll('[data-ds=pill-count]').map((c) => c.text())).toEqual(['1,271'])
  })
})

describe('DsSplit ratios', () => {
  it('5-7 and scrollAside', () => {
    const w = mount(DsSplit, {
      props: { ratio: '5-7', stackBelow: 'lg', scrollAside: true },
      slots: { default: 'm', aside: 'a' },
    })
    expect(w.get('[data-ds=split-main]').classes()).toContain('lg:col-span-5')
    expect(w.get('aside').classes()).toEqual(
      expect.arrayContaining(['lg:col-span-7', 'lg:sticky', 'lg:overflow-y-auto']),
    )
    expect(
      mount(DsSplit, { props: { ratio: '1-1' }, slots: { default: 'm', aside: 'a' } }).get('aside').classes(),
    ).toContain('xl:col-span-6')
  })
})

describe('DsBadge', () => {
  it('tone, accent and slot', () => {
    expect(mount(DsBadge, { props: { label: 'Betul', tone: 'success' } }).attributes('data-tone')).toBe(
      'success',
    )
    const a = mount(DsBadge, { props: { accent: 'win', emphasis: 'soft' }, slots: { default: 'Mod' } })
    expect(a.text()).toBe('Mod')
    expect(a.attributes('data-accent')).toBe('win')
  })
})

describe('DsDefinitionList', () => {
  it('renders dl pairs, formats numbers, prints the empty value and value slots', () => {
    const w = mount(DsDefinitionList, {
      props: {
        columns: 2,
        items: [
          { key: 'a', label: 'Jumlah', value: 1271 },
          { key: 'b', label: 'Nota', value: null },
          { key: 'c', label: 'Pautan', value: 'x', to: '/x' },
        ],
      },
      slots: { 'value-c': '<em id="s">slot</em>' },
      global: { stubs: { ULink: RouterLinkStub } },
    })
    expect(w.element.tagName).toBe('DL')
    expect(w.findAll('dt').map((d) => d.text())).toEqual(['Jumlah', 'Nota', 'Pautan'])
    expect(w.get('[data-testid=def-a] dd').text()).toBe('1,271')
    expect(w.get('[data-testid=def-b] dd').text()).toContain('-')
    expect(w.find('#s').exists()).toBe(true)
  })
})

describe('DsCallout', () => {
  beforeEach(() => window.localStorage.clear())
  it('error tone is announced', () => {
    const w = mount(DsCallout, { props: { tone: 'error', title: 'Sila betulkan 2 medan.' } })
    expect(w.attributes('role')).toBe('alert')
    expect(mount(DsCallout, { props: { title: 'x' } }).attributes('role')).toBeUndefined()
  })
  it('collapsible toggles and remembers', async () => {
    const mk = () =>
      mount(DsCallout, {
        props: { title: 'Panduan', collapsible: true, defaultOpen: true, storageKey: 'g1' },
        slots: { default: '<p>Isi</p>' },
        attachTo: document.body,
      })
    const w = mk()
    const btn = w.get('[data-ds=callout-toggle]')
    expect(btn.attributes('aria-expanded')).toBe('true')
    await btn.trigger('click')
    expect(btn.attributes('aria-expanded')).toBe('false')
    expect(window.localStorage.getItem('pp:callout:g1')).toBe('collapsed')
    w.unmount()
    const again = mk()
    await again.vm.$nextTick()
    expect(again.get('[data-ds=callout-toggle]').attributes('aria-expanded')).toBe('false')
    again.unmount()
  })
  it('dismiss removes it and remembers', async () => {
    const w = mount(DsCallout, {
      props: { title: 'x', dismissible: true, storageKey: 'd1' },
      attachTo: document.body,
    })
    await w.get('[data-slot=close]').trigger('click')
    expect(w.find('[data-ds=callout]').exists()).toBe(false)
    expect(window.localStorage.getItem('pp:callout:d1')).toBe('dismissed')
    w.unmount()
  })
})
