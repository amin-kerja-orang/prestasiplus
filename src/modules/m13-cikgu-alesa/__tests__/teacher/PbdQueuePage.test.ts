// @vitest-environment jsdom
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DsDataTable } from '@/ds'

import PbdQueuePage from '../../pages/PbdQueuePage.vue'
import { listMeta, mountAt } from './helpers'

const api = vi.hoisted(() => ({
  fetchPbdQueue: vi.fn(),
  fetchCikguClasses: vi.fn(),
  rollupPbd: vi.fn(),
  bulkApprovePbd: vi.fn(),
  downloadPbdCsv: vi.fn(),
}))
vi.mock('../../api/cikgu', () => api)
const saveBlob = vi.hoisted(() => vi.fn())
vi.mock('@/lib/save-blob', () => ({ saveBlob }))

const row = (id: number, name: string, skor: number, tp: number) => ({
  id,
  studentId: id,
  studentName: name,
  classroomId: 2001,
  sp: '5.1.1',
  skor,
  tp,
})

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})
beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset()
  saveBlob.mockReset()
  api.fetchCikguClasses.mockResolvedValue([])
})

const checks = () => wrapper!.findAll('tbody [role="checkbox"]')
const isOn = (el: { attributes: (n: string) => string | undefined }) =>
  el.attributes('aria-checked') === 'true'

describe('S6 PBD queue', () => {
  it('admin: header, toolbar, empty row, no nested form', async () => {
    api.fetchPbdQueue.mockResolvedValue({ data: [], meta: listMeta(0) })
    const m = await mountAt(PbdQueuePage, '/cikgu/pbd')
    wrapper = m.wrapper
    expect(wrapper.get('h1').text()).toBe('📊 PBD Auto-Tag — Antrian Semakan')
    expect(wrapper.text()).toContain(
      'AI cadangan Tahap Penguasaan (TP1-6) berdasarkan aktiviti pelajar. Cikgu sah dahulu sebelum eksport ke KPM idMe.',
    )
    const select = wrapper.get('[data-testid="pbd-class"]')
    expect(select.attributes('required')).toBeUndefined()
    expect(select.findAll('option').map((o) => o.text())).toEqual(['Pilih kelas untuk rollup'])
    expect(wrapper.get('[data-testid="pbd-rollup"]').text()).toBe('Jalankan Auto-Tag')
    const exp = wrapper.get('[data-testid="pbd-export"]')
    expect(exp.attributes('href')).toBe('/cikgu/pbd/export.csv')
    expect(exp.text()).toBe('Eksport CSV (Approved)')
    expect(wrapper.get('[data-testid="pbd-bulk"]').text()).toBe('Lulus pukal (TP cadangan)')
    expect(wrapper.get('#bulk-form').text()).toContain('Pilih semua')
    expect(wrapper.get('[data-testid="pbd-empty"]').text()).toBe(
      'Tiada antrian semakan. Klik "Jalankan Auto-Tag" untuk scan aktiviti pelajar.',
    )
    expect(wrapper.get('#bulk-form').element.querySelector('form')).toBeNull()
    expect(wrapper.findAll('thead th').map((t) => t.text())).toEqual([
      '',
      'Pelajar',
      'SP',
      'Skor',
      'TP Cadangan',
      'Tindakan',
    ])
  })

  it('teacher: class options and rows with skor, TP and "-"', async () => {
    api.fetchCikguClasses.mockResolvedValue([
      { id: 2001, name: '5 MARIKH - Kimia' },
      { id: 2002, name: '5 MARIKH - Sejarah' },
    ])
    api.fetchPbdQueue.mockResolvedValue({
      data: [row(13311, 'Murid Demo 03', 40, 3), row(13301, 'Murid Demo 01', 88.9, 5)],
      meta: listMeta(2),
    })
    const m = await mountAt(PbdQueuePage, '/cikgu/pbd')
    wrapper = m.wrapper
    expect(wrapper.findAll('[data-testid="pbd-class"] option').map((o) => o.text())).toEqual([
      'Pilih kelas untuk rollup',
      '5 MARIKH - Kimia',
      '5 MARIKH - Sejarah',
    ])
    const trs = wrapper.findAll('tbody tr')
    const first = trs[0]!.findAll('td')
    expect(first.map((c) => c.text())).toEqual(['', 'Murid Demo 03', '5.1.1', '40.0%', 'TP3', '-'])
    expect(first[0]!.find('[role="checkbox"]').exists()).toBe(true)
    expect(trs[1]!.findAll('td')[3]!.text()).toBe('88.9%')
  })

  it('"Pilih semua" ticks every row on click and clears on the second click', async () => {
    api.fetchPbdQueue.mockResolvedValue({
      data: [row(1, 'A', 10, 1), row(2, 'B', 20, 2)],
      meta: listMeta(2),
    })
    const m = await mountAt(PbdQueuePage, '/cikgu/pbd')
    wrapper = m.wrapper
    const all = wrapper.get('#select-all')
    await all.trigger('click')
    expect(checks().every(isOn)).toBe(true)
    await all.trigger('click')
    expect(checks().some(isOn)).toBe(false)
  })

  it('"Pilih semua" and the row ticks reset when the page changes', async () => {
    api.fetchPbdQueue.mockResolvedValue({
      data: [row(1, 'A', 10, 1), row(2, 'B', 20, 2)],
      meta: listMeta(45),
    })
    const m = await mountAt(PbdQueuePage, '/cikgu/pbd')
    wrapper = m.wrapper
    await wrapper.get('#select-all').trigger('click')
    expect(checks().every(isOn)).toBe(true)
    wrapper.getComponent(DsDataTable).vm.$emit('update:page', 2)
    await flushPromises()
    expect(isOn(wrapper.get('#select-all'))).toBe(false)
    expect(checks().some(isOn)).toBe(false)
  })

  it('bulk approve sends the ticked ids, then reloads with everything unticked', async () => {
    api.fetchPbdQueue.mockResolvedValue({
      data: [row(1, 'A', 10, 1), row(2, 'B', 20, 2)],
      meta: listMeta(2),
    })
    api.bulkApprovePbd.mockResolvedValue({ approved: 1 })
    const m = await mountAt(PbdQueuePage, '/cikgu/pbd')
    wrapper = m.wrapper
    await checks()[1]!.trigger('click')
    await wrapper.get('#bulk-form').trigger('submit')
    await flushPromises()
    expect(api.bulkApprovePbd).toHaveBeenCalledWith([2])
    expect(api.fetchPbdQueue).toHaveBeenCalledTimes(2)
    expect(checks().some(isOn)).toBe(false)
  })

  it('bulk approve with nothing ticked still submits (no confirm)', async () => {
    const confirm = vi.spyOn(window, 'confirm')
    api.fetchPbdQueue.mockResolvedValue({ data: [row(1, 'A', 10, 1)], meta: listMeta(1) })
    api.bulkApprovePbd.mockResolvedValue({ approved: 0 })
    const m = await mountAt(PbdQueuePage, '/cikgu/pbd')
    wrapper = m.wrapper
    await wrapper.get('#bulk-form').trigger('submit')
    await flushPromises()
    expect(api.bulkApprovePbd).toHaveBeenCalledWith([])
    expect(confirm).not.toHaveBeenCalled()
    confirm.mockRestore()
  })

  it('rollup: null for the placeholder, the class id otherwise; reloads and resets the select', async () => {
    api.fetchCikguClasses.mockResolvedValue([{ id: 2001, name: '5 MARIKH - Kimia' }])
    api.fetchPbdQueue.mockResolvedValue({ data: [], meta: listMeta(0) })
    api.rollupPbd.mockResolvedValue({ created: 0, updated: 0, skipped: 0 })
    const m = await mountAt(PbdQueuePage, '/cikgu/pbd')
    wrapper = m.wrapper
    await wrapper.get('#rollup-form').trigger('submit')
    await flushPromises()
    expect(api.rollupPbd).toHaveBeenLastCalledWith(null)
    await wrapper.get('[data-testid="pbd-class"]').setValue('2001')
    await wrapper.get('#rollup-form').trigger('submit')
    await flushPromises()
    expect(api.rollupPbd).toHaveBeenLastCalledWith(2001)
    expect(wrapper.get<HTMLSelectElement>('[data-testid="pbd-class"]').element.value).toBe('')
    expect(api.fetchPbdQueue).toHaveBeenCalledTimes(3)
  })

  it('export downloads the file through the client under the server name', async () => {
    api.fetchPbdQueue.mockResolvedValue({ data: [], meta: listMeta(0) })
    const blob = new Blob(['x'])
    api.downloadPbdCsv.mockResolvedValue({ blob, filename: 'pbd-approved.csv' })
    const m = await mountAt(PbdQueuePage, '/cikgu/pbd')
    wrapper = m.wrapper
    await wrapper.get('[data-testid="pbd-export"]').trigger('click')
    await flushPromises()
    expect(saveBlob).toHaveBeenCalledWith(blob, 'pbd-approved.csv')
  })
})
