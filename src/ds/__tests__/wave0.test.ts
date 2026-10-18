// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/unbound-method -- jsdom polyfill checks */
import { mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'

import {
  DsChart,
  DsConfirmHost,
  DsDataTable,
  DsErrorPage,
  DsFilterBar,
  DsPage,
  DsPagedTable,
  DsThemeScope,
  useConfirm,
} from '@/ds'

const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms))

beforeAll(() => {
  const g = globalThis as Record<string, unknown>
  g.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  g.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
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
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('DsPage', () => {
  it('prints one h1, the subtitle and the actions slot', () => {
    const w = mount(DsPage, {
      props: { title: 'Tajuk', subtitle: 'Sub' },
      slots: { actions: '<button>Aksi</button>', default: '<p>isi</p>' },
    })
    expect(w.findAll('h1')).toHaveLength(1)
    expect(w.text()).toContain('Sub')
    expect(w.text()).toContain('Aksi')
    expect(w.text()).toContain('isi')
  })
  it('has no header without title or actions', () => {
    expect(mount(DsPage).find('header').exists()).toBe(false)
  })
})

describe('DsFilterBar', () => {
  it('wide: inline fields, apply and reset emit', async () => {
    const w = mount(DsFilterBar, { slots: { default: '<input data-test="f">' } })
    await wait()
    expect(w.find('[data-test="f"]').exists()).toBe(true)
    await w.trigger('submit')
    expect(w.emitted('apply')).toHaveLength(1)
    const reset = w.findAll('button').find((b) => b.text() === 'Set Semula')!
    await reset.trigger('click')
    expect(w.emitted('reset')).toHaveLength(1)
  })
})

describe('DsDataTable', () => {
  const data = Array.from({ length: 12 }, (_, i) => ({ nama: `Murid ${i + 1}`, skor: i }))
  const columns = [
    { accessorKey: 'nama', header: 'Nama' },
    { accessorKey: 'skor', header: 'Skor' },
  ]
  it('pages client-side with BM summary copy', async () => {
    const w = mount(DsDataTable, { props: { data, columns, pageSize: 5 } })
    await wait()
    expect(w.text()).toContain('Menunjukkan 1-5 daripada 12 hasil')
    expect(w.text()).toContain('Murid 1')
    expect(w.text()).not.toContain('Murid 6')
  })
  it('shows the error alert and emits retry', async () => {
    const w = mount(DsDataTable, { props: { data: [], columns, error: 'Gagal memuatkan' } })
    await wait()
    expect(w.text()).toContain('Gagal memuatkan')
    await w
      .findAll('button')
      .find((b) => b.text() === 'Cuba Semula')!
      .trigger('click')
    expect(w.emitted('retry')).toHaveLength(1)
  })
})

describe('DsPagedTable', () => {
  const data = Array.from({ length: 45 }, (_, i) => ({ nama: `Murid #${i + 1}.`, skor: 'x' }))
  const columns = [
    { accessorKey: 'nama', header: 'Nama' },
    { accessorKey: 'skor', header: 'Skor' },
  ]
  it('pages 20 rows by default with the BM summary and a page-size selector', async () => {
    const w = mount(DsPagedTable, { props: { data, columns } })
    await wait()
    expect(w.text()).toContain('Menunjukkan 1-20 daripada 45 hasil')
    expect(w.text()).toContain('Murid #20.')
    expect(w.text()).not.toContain('Murid #21.')
    expect(w.find('[aria-label="Baris setiap halaman"]').exists()).toBe(true)
  })
  it('keeps the header and shows the empty label when there are no rows', async () => {
    const w = mount(DsPagedTable, { props: { data: [], columns, emptyLabel: 'Tiada pelajar' } })
    await wait()
    expect(w.find('thead').exists()).toBe(true)
    expect(w.text()).toContain('Tiada pelajar')
  })
})

describe('DsChart', () => {
  it('renders the title, a legend with labels and a hidden data table', () => {
    const w = mount(DsChart, {
      props: {
        title: 'Skor',
        labels: ['Jan', 'Feb'],
        series: [{ label: 'Purata', data: [60, 70] }],
        unit: '%',
      },
    })
    expect(w.get('[data-ds="chart-title"]').text()).toBe('Skor')
    expect(w.get('[data-ds="chart-legend"]').text()).toContain('Purata')
    const table = w.get('[data-ds="chart-table"]')
    expect(table.classes()).toContain('sr-only')
    expect(table.text()).toContain('70%')
    expect(w.get('canvas').attributes('role')).toBe('img')
  })
})

describe('useConfirm', () => {
  it('resolves true on confirm and false on cancel', async () => {
    mount(DsThemeScope, {
      props: { personality: 'staff', scheme: 'light' },
      slots: { default: () => h(DsConfirmHost) },
      attachTo: document.body,
    })
    await wait()
    const confirm = useConfirm()
    const first = confirm({ message: 'Padam?' })
    await wait(60)
    expect(document.body.textContent).toContain('Padam?')
    document.querySelector<HTMLElement>('[data-ds="confirm-ok"]')!.click()
    await expect(first).resolves.toBe(true)
    await wait()
    const second = confirm({ message: 'Lagi?' })
    await wait(60)
    document.querySelector<HTMLElement>('[data-ds="confirm-cancel"]')!.click()
    await expect(second).resolves.toBe(false)
  })
})

describe('DsErrorPage', () => {
  it('has default BM copy per code and one h1', () => {
    const w = mount(DsErrorPage, { props: { code: 403 } })
    expect(w.get('h1').text()).toBe('Akses Ditolak')
    expect(mount(DsErrorPage).get('h1').text()).toBe('Halaman Tidak Dijumpai')
  })
  it('learner shows the friend instead of the glyph', () => {
    const w = mount(DsThemeScope, {
      props: { personality: 'learner', scheme: 'dark' },
      slots: { default: () => h(DsErrorPage, { code: 404 }) },
    })
    expect(w.find('img').exists()).toBe(true)
  })
})
