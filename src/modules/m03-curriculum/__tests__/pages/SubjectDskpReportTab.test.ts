// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'

import type { DskpReport } from '../../api/admin-curriculum'
import SubjectDskpReportTab from '../../pages/SubjectDskpReportTab.vue'

const api = vi.hoisted(() => ({ fetchDskpReport: vi.fn() }))
vi.mock('../../api/admin-curriculum', () => api)

const report = (over: Partial<DskpReport> = {}): DskpReport => ({
  rows: [
    { subject: { id: 3, name: 'Matematik' }, level: { id: 10, name: 'Tingkatan 4' }, state: 'dimuatkan', bab: 10, sk: 31, sp: 98, tp: 60, tpDescriptors: 6 },
    { subject: { id: 5, name: 'Kimia' }, level: { id: 10, name: 'Tingkatan 4' }, state: 'belum dimuatkan', bab: 0, sk: 0, sp: 0, tp: 0, tpDescriptors: 0 },
  ],
  nodes: null,
  ...over,
})

let wrapper: VueWrapper | null = null
async function render(props: Record<string, unknown> = {}): Promise<VueWrapper> {
  wrapper = mount(SubjectDskpReportTab, { props, attachTo: document.body })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  api.fetchDskpReport.mockReset()
  api.fetchDskpReport.mockResolvedValue(report())
})
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
  wrapper = null
})

describe('SubjectDskpReportTab (S4-T02, API-DSKP-11)', () => {
  it('shows one row per Subjek x Tingkatan with the live counts and the state', async () => {
    const w = await render()
    expect(api.fetchDskpReport).toHaveBeenCalledWith({ subjectId: null, levelId: null }, expect.objectContaining({ signal: expect.any(AbortSignal) }))
    const text = w.get('[data-testid=dskp-report-table]').text()
    for (const s of ['Subjek', 'Tingkatan', 'Status', 'Bab', 'SK', 'SP', 'TP', 'Matematik', 'Kimia', '98']) expect(text).toContain(s)
    expect(w.findAll('[data-testid=dskp-state]').map((b) => b.text())).toEqual(['dimuatkan', 'belum dimuatkan'])
    expect(w.find('[data-testid=dskp-node-list]').exists()).toBe(false)
  })

  it('with a subject and a level, lists the nodes read-only with their TP descriptors', async () => {
    api.fetchDskpReport.mockResolvedValue(
      report({
        rows: report().rows.slice(0, 1),
        nodes: [
          { id: 1, kind: 'grouping', code: 'nombor', title: 'Nombor dan Operasi', parentId: null, tpDescriptors: [] },
          { id: 2, kind: 'unit', code: '1.0', title: 'Fungsi Kuadratik', parentId: 1, tpDescriptors: [{ tp: 1, descriptor: 'Mempamerkan pengetahuan asas.' }] },
          { id: 3, kind: 'sp', code: '1.1.1', title: 'Mengenal pasti fungsi kuadratik', parentId: 2, tpDescriptors: [] },
        ],
      }),
    )
    const w = await render({ subjectId: 3, levelId: 10 })
    expect(api.fetchDskpReport).toHaveBeenCalledWith({ subjectId: 3, levelId: 10 }, expect.anything())
    const items = w.findAll('[data-testid=dskp-node]')
    // The badge and the code are separated by CSS margin (me-2), not by a text space.
    expect(items.map((i) => i.text())).toEqual([
      'Bidangnombor Nombor dan Operasi',
      'Bab1.0 Fungsi KuadratikTP1: Mempamerkan pengetahuan asas.',
      'SP1.1.1 Mengenal pasti fungsi kuadratik',
    ])
    expect(w.find('button, input, select, textarea').exists()).toBe(false)
  })

  it('below 768 px (cards) still shows the state of every Subjek x Tingkatan', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    })))
    try {
      const w = await render()
      // The card branch, not the table: no <table> is rendered below 768 px.
      expect(w.find('table').exists()).toBe(false)
      const text = w.get('[data-testid=dskp-report-tab]').text()
      expect(text).toContain('Status')
      expect(text).toContain('dimuatkan')
      expect(text).toContain('belum dimuatkan')
      expect(text).toContain('Kimia')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('reloads when the filter props change', async () => {
    const w = await render({ subjectId: 3, levelId: null })
    await w.setProps({ levelId: 11 })
    await flushPromises()
    expect(api.fetchDskpReport).toHaveBeenLastCalledWith({ subjectId: 3, levelId: 11 }, expect.anything())
  })

  it('shows the load error with a retry, and the empty state when nothing is offered', async () => {
    api.fetchDskpReport.mockRejectedValueOnce(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'HTTP 500' }))
    const w = await render()
    expect(w.get('[data-testid=dskp-report-error]').text()).toContain('Ralat memuatkan data. Sila cuba semula.')
    wrapper?.unmount()
    api.fetchDskpReport.mockResolvedValue(report({ rows: [] }))
    const empty = await render({ subjectId: 9 })
    expect(empty.find('[data-testid=dskp-report-empty]').exists()).toBe(true)
  })
})
