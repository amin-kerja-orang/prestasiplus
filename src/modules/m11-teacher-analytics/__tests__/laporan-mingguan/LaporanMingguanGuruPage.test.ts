// @vitest-environment jsdom
import type { GuruWeeklyReport } from '@pp/contract'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'

import LaporanMingguanGuruPage from '../../pages/LaporanMingguanGuruPage.vue'
import routes from '../../routes/laporan-mingguan'

const api = vi.hoisted(() => ({ fetchGuruWeeklyReport: vi.fn() }))
const m10 = vi.hoisted(() => ({ fetchGuruClasses: vi.fn() }))
vi.mock('../../api', () => api)
vi.mock('@/modules/m10-teacher-class', () => m10)

let wrapper: VueWrapper | undefined

const CLASSES = [
  { id: 11, name: '5 Bestari' },
  { id: 12, name: '4 Cemerlang' },
]

function report(over: Partial<GuruWeeklyReport> = {}): GuruWeeklyReport {
  return {
    classroom: { id: '11', name: '5 Bestari' },
    week: { from: '2026-11-02', to: '2026-11-08', label: '02 Nov 2026 — 08 Nov 2026' },
    summary: { answered: 18, activePupils: 3, improvedPupils: 1, attentionSubjects: 1 },
    topPerformers: [
      { rank: 1, name: 'Aina Fiktif', answered: 8, accuracy: 66.7 },
      { rank: 2, name: 'Budi Rekaan', answered: 6, accuracy: 50 },
    ],
    mostImproved: [{ name: 'Aina Fiktif', previousAccuracy: 50, accuracy: 70, delta: 20 }],
    attentionSubjects: [{ subject: 'Sains', accuracy: 45, answered: 12 }],
    ...over,
  }
}

const emptyReport = (): GuruWeeklyReport =>
  report({
    summary: { answered: 0, activePupils: 0, improvedPupils: 0, attentionSubjects: 0 },
    topPerformers: [],
    mostImproved: [],
    attentionSubjects: [],
  })

async function mountPage(classes: unknown[] = CLASSES, data: GuruWeeklyReport = report()) {
  m10.fetchGuruClasses.mockResolvedValue({ data: classes, meta: {} })
  api.fetchGuruWeeklyReport.mockResolvedValue(data)
  wrapper = mount(LaporanMingguanGuruPage)
  await flushPromises()
  return wrapper
}
const t = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`)
const txt = (w: VueWrapper, id: string) => t(w, id).text().replace(/\s+/g, ' ')
const tileValue = (w: VueWrapper, k: string) =>
  t(w, `lm-tile-${k}`).get('[data-testid="lm-tile-value"]').text()

beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('route record', () => {
  it('AC-GUR-43-1: opens the page for the teacher only, titled Laporan Mingguan', () => {
    const rec = routes.find((r) => r.path === '/guru/laporan-mingguan-kelas')
    expect(rec?.meta?.roles).toEqual(['teacher'])
    expect(rec?.meta?.header).toEqual({ title: 'Laporan Mingguan' })
  })
})

describe('Laporan Mingguan Guru', () => {
  it('AC-GUR-43-1: shows the class select (first class) and calls the API with its id', async () => {
    const w = await mountPage()
    expect(w.find('[data-testid="lm-class"]').exists()).toBe(true)
    expect(w.text()).toContain('Pilih Kelas')
    expect(w.text()).toContain('Cetak')
    expect(api.fetchGuruWeeklyReport).toHaveBeenCalledTimes(1)
    expect(api.fetchGuruWeeklyReport.mock.calls[0]![0]).toBe('11')
    expect(txt(w, 'lm-week')).toBe('02 Nov 2026 — 08 Nov 2026')
  })

  it('AC-GUR-43-2: tiles 18 and 3, exactly the two top performers', async () => {
    const w = await mountPage()
    expect(tileValue(w, 'answered')).toBe('18')
    expect(tileValue(w, 'active')).toBe('3')
    expect(w.findAll('[data-testid="lm-top-row"]')).toHaveLength(2)
    expect(txt(w, 'lm-top')).toContain('8 soalan minggu ini')
  })

  it('rounding: 66.7 shows 67% ketepatan', async () => {
    const w = await mountPage()
    expect(txt(w, 'lm-top')).toContain('67% ketepatan')
    expect(txt(w, 'lm-top')).toContain('50% ketepatan')
  })

  it('AC-GUR-43-3: a subject at 45% lists with its bar and the tile counts it', async () => {
    const w = await mountPage()
    expect(txt(w, 'lm-attention')).toContain('45% (12 soalan)')
    expect(txt(w, 'lm-attention')).toContain('(ketepatan < 50%)')
    expect(w.findAll('[data-testid="lm-attention-bar"]')).toHaveLength(1)
    expect(tileValue(w, 'attention')).toBe('1')
  })

  it('AC-GUR-43-4: Paling Meningkat shows 50% → 70% and +20%', async () => {
    const w = await mountPage()
    expect(txt(w, 'lm-improved')).toContain('50% → 70%')
    expect(txt(w, 'lm-improved')).toContain('+20%')
    expect(txt(w, 'lm-improved')).toContain('(berbanding minggu lepas)')
  })

  it('AC-GUR-43-5: no activity gives four 0 tiles and the exact empty copies', async () => {
    const w = await mountPage(CLASSES, emptyReport())
    for (const k of ['answered', 'active', 'improved', 'attention'])
      expect(tileValue(w, k)).toBe('0')
    expect(txt(w, 'lm-top-empty')).toBe(
      'Tiada pelajar dengan sekurang-kurangnya 5 soalan minggu ini.',
    )
    expect(txt(w, 'lm-improved-empty')).toBe('Tiada perbandingan minggu-ke-minggu yang mencukupi.')
    expect(txt(w, 'lm-attention-empty')).toBe('Tiada latihan direkodkan minggu ini.')
  })

  it('AC-GUR-43-5: no class disables the select, makes no API call, prints "Semua Kelas"', async () => {
    const w = await mountPage([])
    expect(api.fetchGuruWeeklyReport).not.toHaveBeenCalled()
    const select = t(w, 'lm-class')
    expect(select.attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('Tiada kelas lagi')
    for (const k of ['answered', 'active', 'improved', 'attention'])
      expect(tileValue(w, k)).toBe('0')
    expect(txt(w, 'lm-top-empty')).toContain('Tiada pelajar')
    expect(txt(w, 'lm-print-title')).toMatch(
      /^Laporan Mingguan — Semua Kelas \| \d{2} [A-Z][a-z]{2} – \d{2} [A-Z][a-z]{2} \d{4}$/,
    )
    expect(txt(w, 'lm-week')).toMatch(/^\d{2} [A-Z][a-z]{2} \d{4} — \d{2} [A-Z][a-z]{2} \d{4}$/)
  })

  it('AC-GUR-43-7: Cetak prints; the toolbar is print:hidden; the print title is print-only', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    const w = await mountPage()
    await t(w, 'lm-print').trigger('click')
    expect(print).toHaveBeenCalledTimes(1)
    expect(t(w, 'lm-toolbar').classes()).toContain('print:hidden')
    const title = t(w, 'lm-print-title')
    expect(title.classes()).toEqual(expect.arrayContaining(['hidden', 'print:block']))
    expect(title.text()).toBe('Laporan Mingguan — 5 Bestari | 02 Nov – 08 Nov 2026')
    expect(t(w, 'lm-sheet').attributes('data-ds')).toBe('print-sheet')
    print.mockRestore()
  })

  it('FR-GUR-43-7: tiles are 2 columns, 4 from md; Cetak is at least 44px tall', async () => {
    const w = await mountPage()
    expect(t(w, 'lm-tiles').classes()).toEqual(
      expect.arrayContaining(['grid-cols-2', 'md:grid-cols-4']),
    )
    expect(t(w, 'lm-print').classes()).toContain('min-h-11')
  })

  it('AC-GUR-43-11: all subjects at 50% or more shows the congratulation line', async () => {
    const w = await mountPage(CLASSES, report({ attentionSubjects: [] }))
    expect(txt(w, 'lm-attention-empty')).toBe('Syabas! Semua subjek melebihi 50% ketepatan.')
  })

  it('AC-GUR-43-11: 49.4 shows 49% and 49.6 shows 50%', async () => {
    const w = await mountPage(
      CLASSES,
      report({
        attentionSubjects: [
          { subject: 'Sains', accuracy: 49.4, answered: 7 },
          { subject: 'Sejarah', accuracy: 49.6, answered: 9 },
        ],
      }),
    )
    expect(txt(w, 'lm-attention')).toContain('49% (7 soalan)')
    expect(txt(w, 'lm-attention')).toContain('50% (9 soalan)')
  })

  it('changing the class calls the API with the new id', async () => {
    const w = await mountPage()
    await w.get('select[name="classroomId"]').setValue('12')
    await flushPromises()
    expect(api.fetchGuruWeeklyReport.mock.calls.at(-1)![0]).toBe('12')
  })

  it('shows the API message in DsLoadError and retries', async () => {
    m10.fetchGuruClasses.mockResolvedValue({ data: CLASSES, meta: {} })
    api.fetchGuruWeeklyReport.mockRejectedValueOnce(
      new ApiError({ status: 403, code: 'FORBIDDEN', message: 'Akses ditolak.' }),
    )
    api.fetchGuruWeeklyReport.mockResolvedValue(report())
    wrapper = mount(LaporanMingguanGuruPage)
    await flushPromises()
    expect(wrapper.text()).toContain('Akses ditolak.')
    await wrapper.findAll('button').find((b) => b.text().includes('Cuba'))!.trigger('click')
    await flushPromises()
    expect(tileValue(wrapper, 'answered')).toBe('18')
  })

  it('shows an error when the classes fail to load', async () => {
    m10.fetchGuruClasses.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Ralat.' }),
    )
    wrapper = mount(LaporanMingguanGuruPage)
    await flushPromises()
    expect(wrapper.text()).toContain('Ralat.')
    expect(api.fetchGuruWeeklyReport).not.toHaveBeenCalled()
  })

  it('a class switch shows loading and never the old class rows while the new request is pending', async () => {
    const w = await mountPage()
    let resolveB!: (r: GuruWeeklyReport) => void
    api.fetchGuruWeeklyReport.mockReturnValueOnce(
      new Promise<GuruWeeklyReport>((res) => {
        resolveB = res
      }),
    )
    await w.get('select[name="classroomId"]').setValue('12')
    await flushPromises()
    expect(w.find('[data-testid="lm-loading"]').exists()).toBe(true)
    expect(w.find('[data-testid="lm-toolbar"]').exists()).toBe(true)
    expect(w.text()).not.toContain('Aina Fiktif')
    expect(w.find('[data-testid="lm-top"]').exists()).toBe(false)
    resolveB(
      report({
        classroom: { id: '12', name: '4 Cemerlang' },
        topPerformers: [{ rank: 1, name: 'Citra Rekaan', answered: 9, accuracy: 80 }],
        mostImproved: [],
      }),
    )
    await flushPromises()
    expect(w.text()).toContain('Citra Rekaan')
    expect(w.text()).not.toContain('Aina Fiktif')
    expect(txt(w, 'lm-print-title')).toBe('Laporan Mingguan — 4 Cemerlang | 02 Nov – 08 Nov 2026')
  })

  it('a report error keeps the toolbar and the select usable', async () => {
    m10.fetchGuruClasses.mockResolvedValue({ data: CLASSES, meta: {} })
    api.fetchGuruWeeklyReport.mockRejectedValueOnce(
      new ApiError({ status: 403, code: 'FORBIDDEN', message: 'Akses ditolak.' }),
    )
    api.fetchGuruWeeklyReport.mockResolvedValue(
      report({ classroom: { id: '12', name: '4 Cemerlang' } }),
    )
    wrapper = mount(LaporanMingguanGuruPage)
    await flushPromises()
    expect(wrapper.text()).toContain('Akses ditolak.')
    expect(wrapper.find('[data-testid="lm-toolbar"]').exists()).toBe(true)
    await wrapper.get('select[name="classroomId"]').setValue('12')
    await flushPromises()
    expect(wrapper.text()).not.toContain('Akses ditolak.')
    expect(tileValue(wrapper, 'answered')).toBe('18')
  })
})
