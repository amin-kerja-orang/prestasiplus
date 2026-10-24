// @vitest-environment jsdom
/**
 * audit-sistem DS additions: table card slots (FB-010), fixed-layout min width (FB-015) and the
 * form bar scroll padding (FB-019).
 */
import { mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { h } from 'vue'

import { DsDataTable, DsFormBar, DsStatRow, DsStatTile } from '@/ds'

const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms))

/** `matches` is decided per test: a phone (< 768px) or a desktop. */
let phone = false

beforeAll(() => {
  const g = globalThis as Record<string, unknown>
  g.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.matchMedia = (query: string) => ({
    matches: !phone,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
    onchange: null,
  })
})

afterEach(() => {
  document.body.innerHTML = ''
  phone = false
})

interface Row extends Record<string, unknown> {
  id: number
  title: string
  status: string
}
const rows: Row[] = [
  { id: 1, title: 'a^5 \\times a^3', status: 'terbit' },
  { id: 2, title: 'Soalan dua', status: 'draf' },
]
const columns = [
  { accessorKey: 'title', header: 'Soalan' },
  { accessorKey: 'status', header: 'Status' },
]

describe('DsStatTile compact sub line (FB-023)', () => {
  it('renders sub in the compact tile, clamped to three lines', () => {
    const w = mount(DsStatTile, {
      props: { value: 72, unit: 'Jumlah soalan', sub: '72 Terbit · 7 menunggu semakan', density: 'compact' },
    })
    const sub = w.find('[data-ds="stat-tile-sub"]')
    expect(sub.text()).toBe('72 Terbit · 7 menunggu semakan')
    expect(sub.classes()).toContain('line-clamp-3')
    expect(w.attributes('data-compact')).toBe('true')
  })
  it('compact without sub renders no sub element; the sub test id follows partPrefix', () => {
    const none = mount(DsStatTile, { props: { value: 1, unit: 'A', density: 'compact' } })
    expect(none.find('[data-ds="stat-tile-sub"]').exists()).toBe(false)
    const w = mount(DsStatTile, {
      props: { value: 1, unit: 'A', sub: 'x', density: 'compact', partPrefix: 'bank' },
    })
    expect(w.find('[data-testid="bank-sub"]').exists()).toBe(true)
  })
  it('DsStatRow passes the item sub to compact tiles', () => {
    const w = mount(DsStatRow, {
      props: {
        density: 'compact',
        items: [{ key: 'a', label: 'Matematik', value: 61, sub: '61 Terbit · 2 menunggu semakan' }],
      },
    })
    expect(w.find('[data-ds="stat-tile-sub"]').text()).toContain('61 Terbit')
  })
})

describe('DsDataTable phone cards', () => {
  it('a card field with cell: true renders the <key>-cell slot, others stay plain text', async () => {
    phone = true
    const w = mount(DsDataTable<Row>, {
      props: {
        data: rows,
        columns,
        cardTitle: 'title',
        cardFields: [
          { key: 'id', label: 'No' },
          { key: 'status', label: 'Status', cell: true },
        ],
      },
      slots: {
        'status-cell': (p: { row: { original: Row } }) =>
          h('b', { 'data-test': 'badge' }, `[${p.row.original.status}]`),
      },
    })
    await wait()
    const first = w.find('[data-ds="data-table-cards"] li')
    expect(first.find('[data-test="badge"]').text()).toBe('[terbit]')
    expect(first.text()).toContain('No')
    expect(first.text()).toContain('1')
    // the plain field does not go through a slot
    expect(first.findAll('[data-test="badge"]')).toHaveLength(1)
  })

  it('cell: true without a <key>-cell slot falls back to the raw value', async () => {
    phone = true
    const w = mount(DsDataTable<Row>, {
      props: {
        data: rows,
        columns,
        cardFields: [{ key: 'status', label: 'Status', cell: true }],
      },
    })
    await wait()
    expect(w.find('[data-ds="data-table-cards"] li').text()).toContain('terbit')
  })

  it('wide spans both card columns; a normal field does not', async () => {
    phone = true
    const w = mount(DsDataTable<Row>, {
      props: {
        data: rows,
        columns,
        cardFields: [
          { key: 'id', label: 'No' },
          { key: 'status', label: 'Status', wide: true },
        ],
      },
    })
    await wait()
    const cells = w.findAll('[data-ds="data-table-cards"] li:first-child dl > div')
    expect(cells[0]!.classes()).not.toContain('col-span-2')
    expect(cells[1]!.classes()).toContain('col-span-2')
  })

  it('the card-title slot replaces the plain label (rich title)', async () => {
    phone = true
    const w = mount(DsDataTable<Row>, {
      props: { data: rows, columns, cardTitle: 'title' },
      // `card-title` is not part of the typed UTable slots, so the slot object is passed untyped.
      slots: {
        'card-title': (p: { row: Row }) => h('em', { 'data-test': 'rich' }, `rich:${p.row.id}`),
      } as unknown as Record<string, never>,
    })
    await wait()
    const first = w.find('[data-ds="data-table-cards"] li')
    expect(first.find('[data-ds="data-table-card-title"] [data-test="rich"]').text()).toBe('rich:1')
    expect(first.text()).not.toContain('a^5')
  })

  it('without the slot the title is the plain text of the card-title key', async () => {
    phone = true
    const w = mount(DsDataTable<Row>, { props: { data: rows, columns, cardTitle: 'title' } })
    await wait()
    expect(w.find('[data-ds="data-table-cards"] li').text()).toContain('a^5 \\times a^3')
    expect(w.find('[data-ds="data-table-card-title"]').exists()).toBe(false)
  })
})

describe('DsDataTable layout="fixed" minWidth', () => {
  const scroller = (w: ReturnType<typeof mount>) =>
    w.find('table').element.closest('.overflow-x-auto')
  const minWidthHost = (w: ReturnType<typeof mount>, cls: string) =>
    w.find(`table`).element.closest(`.${cls}`)

  it('fixed + minWidth scrolls inside its container and carries the min-w class', async () => {
    const w = mount(DsDataTable<Row>, {
      props: { data: rows, columns, layout: 'fixed', minWidth: '60rem' },
    })
    await wait()
    expect(scroller(w)).not.toBeNull()
    expect(minWidthHost(w, 'min-w-240')).not.toBeNull()
  })

  it('maps each width to its own class', async () => {
    for (const [mw, cls] of [
      ['56rem', 'min-w-224'],
      ['64rem', 'min-w-256'],
    ] as const) {
      const w = mount(DsDataTable<Row>, {
        props: { data: rows, columns, layout: 'fixed', minWidth: mw },
      })
      await wait()
      expect(minWidthHost(w, cls)).not.toBeNull()
    }
  })

  it('fixed without minWidth keeps the old behaviour: no scroller, no min width', async () => {
    const w = mount(DsDataTable<Row>, { props: { data: rows, columns, layout: 'fixed' } })
    await wait()
    expect(scroller(w)).toBeNull()
    expect(w.html()).not.toMatch(/min-w-2(24|40|56)/)
  })

  it('minWidth is ignored for the auto layout, which already scrolls inside its container', async () => {
    const w = mount(DsDataTable<Row>, { props: { data: rows, columns, minWidth: '60rem' } })
    await wait()
    expect(scroller(w)).not.toBeNull()
    expect(w.html()).not.toContain('min-w-240')
  })
})

describe('DsFormBar scroll padding', () => {
  function withHeight(px: number): () => void {
    const orig = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => px })
    return () => {
      if (orig) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', orig)
    }
  }

  it('pads the scrolling ancestor by the bar height + 16 and restores it on unmount', async () => {
    const restore = withHeight(60)
    const host = document.createElement('div')
    host.style.overflowY = 'auto'
    host.style.scrollPaddingBottom = '3px'
    document.body.appendChild(host)
    const w = mount(DsFormBar, { attachTo: host })
    await wait()
    expect(host.style.scrollPaddingBottom).toBe('76px')
    w.unmount()
    expect(host.style.scrollPaddingBottom).toBe('3px')
    restore()
  })

  it('falls back to the root element when the window scrolls', async () => {
    const restore = withHeight(50)
    const w = mount(DsFormBar, { attachTo: document.body })
    await wait()
    expect(document.documentElement.style.scrollPaddingBottom).toBe('66px')
    w.unmount()
    expect(document.documentElement.style.scrollPaddingBottom).toBe('')
    restore()
  })

  it('does nothing for a non-sticky bar and follows the sticky prop', async () => {
    const restore = withHeight(60)
    const host = document.createElement('div')
    host.style.overflowY = 'auto'
    document.body.appendChild(host)
    const w = mount(DsFormBar, { attachTo: host, props: { sticky: false } })
    await wait()
    expect(host.style.scrollPaddingBottom).toBe('')
    await w.setProps({ sticky: true })
    expect(host.style.scrollPaddingBottom).toBe('76px')
    await w.setProps({ sticky: false })
    expect(host.style.scrollPaddingBottom).toBe('')
    w.unmount()
    restore()
  })
})
