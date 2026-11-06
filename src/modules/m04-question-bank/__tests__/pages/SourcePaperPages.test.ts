// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'

import SourcePaperDetailPage from '../../pages/SourcePaperDetailPage.vue'
import SourcePaperListPage from '../../pages/SourcePaperListPage.vue'

const api = vi.hoisted(() => ({ fetchSourcePapers: vi.fn(), fetchSourcePaper: vi.fn() }))
vi.mock('../../api/imports', () => api)

const row = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  batchId: id,
  title: 'Matematik 2025 Kertas 1 - Johor',
  subject: 'MAT',
  subjectName: 'Matematik',
  year: 2025,
  kertas: 1,
  negeri: 'Johor',
  paperType: 'trial',
  questions: 12,
  source: 'intake',
  sourceLabel: 'Import (PDF/DOCX)',
  needsReview: false,
  hasScheme: true,
  ...over,
})

const listResult = (rows: unknown[]) => ({
  data: rows,
  meta: {
    page: 1,
    pageSize: 25,
    totalItems: rows.length,
    totalPages: 1,
    from: rows.length ? 1 : null,
    to: rows.length || null,
    totalPapers: 82,
    needsReviewCount: 2,
    options: { years: [2025, 2024], negeri: ['Johor', 'Selangor'], subjects: [{ code: 'MAT', name: 'Matematik' }] },
  },
})

let wrapper: VueWrapper | null = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.clearAllMocks()
})

async function mountPage(component: object, path: string, props: Record<string, unknown> = {}): Promise<VueWrapper> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/source-papers', component },
      { path: '/admin/source-papers/:id', component },
      { path: '/admin/studio/questions/:id/sunting', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  wrapper = mount(component, { props, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

describe('SourcePaperListPage', () => {
  it('shows the two tiles, the filter bar copy, the columns and the OK badge with a Lihat link', async () => {
    api.fetchSourcePapers.mockResolvedValue(listResult([row('7')]))
    const w = await mountPage(SourcePaperListPage, '/admin/source-papers')
    const text = w.text()
    for (const t of ['Jumlah Kertas', 'Perlu Semakan', 'Semua Subjek', 'Semua Tahun', 'Semua Negeri', 'Semua Kertas', 'Semua Jenis', 'Cari']) expect(text).toContain(t)
    expect(w.find('[data-testid="source-papers-tile-total"]').text()).toContain('82')
    for (const h of ['Subjek', 'Tahun', 'Negeri', 'Kertas', 'Jenis', 'Bilangan Soalan', 'Sumber', 'Status']) expect(text).toContain(h)
    expect(text).toContain('Import (PDF/DOCX)')
    expect(text).toContain('Percubaan SPM')
    expect(w.find('[data-testid="source-paper-badge"]').text()).toBe('OK')
    expect(w.find('a[href="/admin/source-papers/7"]').text()).toBe('Lihat')
    expect(w.find('[data-testid="sp-filter-negeri"]').text()).toContain('Selangor')
    expect(w.find('[data-testid="sp-filter-kertas"]').text()).toContain('Kertas 4')
  })

  it('badges: Perlu Semakan wins, then Skema; a missing Negeri is a dash', async () => {
    api.fetchSourcePapers.mockResolvedValue(
      listResult([row('1', { needsReview: true, hasScheme: false }), row('2', { hasScheme: false, negeri: null }), row('3', { needsReview: false, hasScheme: true })]),
    )
    const w = await mountPage(SourcePaperListPage, '/admin/source-papers')
    expect(w.findAll('[data-testid="source-paper-badge"]').map((b) => b.text())).toEqual(['Perlu Semakan', 'Skema', 'OK'])
    expect(w.text()).toContain('—')
  })

  it('Tapis sends the chosen filters and the checkbox to the API and returns to page 1', async () => {
    api.fetchSourcePapers.mockResolvedValue(listResult([row('7')]))
    const w = await mountPage(SourcePaperListPage, '/admin/source-papers')
    await w.find('[data-testid="sp-filter-negeri"]').setValue('Johor')
    await w.find('[data-testid="sp-filter-year"]').setValue('2025')
    await w.find('[data-testid="sp-filter-jenis"]').setValue('trial')
    await w.find('[data-testid="sp-filter-review"]').trigger('click')
    await w.find('[data-testid="source-papers-filters"]').trigger('submit')
    await flushPromises()
    const last = api.fetchSourcePapers.mock.calls.at(-1)?.[0]
    expect(last).toMatchObject({ negeri: 'Johor', year: '2025', jenis: 'trial', page: 1 })
  })

  it('empty result prints "Tiada kertas dijumpai."', async () => {
    api.fetchSourcePapers.mockResolvedValue(listResult([]))
    const w = await mountPage(SourcePaperListPage, '/admin/source-papers')
    expect(w.text()).toContain('Tiada kertas dijumpai.')
  })

  it('a load failure shows the retry box', async () => {
    api.fetchSourcePapers.mockRejectedValue(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x' }))
    const w = await mountPage(SourcePaperListPage, '/admin/source-papers')
    expect(w.find('[data-testid="source-papers-error"]').exists()).toBe(true)
  })
})

const detail = (over: Record<string, unknown> = {}) => ({
  ...row('7'),
  fileNames: ['mat-2025-k1.pdf'],
  issues: [],
  questionList: [
    { no: '1', questionId: '501', excerpt: 'Berapakah hasil tambah dua dan tiga...', parts: 2 },
    { no: '2', questionId: '502', excerpt: 'Soalan kedua.', parts: 1 },
  ],
  ...over,
})

describe('SourcePaperDetailPage', () => {
  it('shows the back link, the facts, the question section title and the Studio links', async () => {
    api.fetchSourcePaper.mockResolvedValue(detail({ hasScheme: false, needsReview: true }))
    const w = await mountPage(SourcePaperDetailPage, '/admin/source-papers/7', { id: '7' })
    const text = w.text()
    const back = w.find('a[href="/admin/source-papers"]')
    expect(back.text()).toContain('Kembali')
    for (const t of ['Subjek', 'Tahun', 'Negeri', 'Kertas', 'Jenis', 'Sumber', 'Skema?', 'Perlu Semakan', 'Fail:', 'mat-2025-k1.pdf', 'Johor']) expect(text).toContain(t)
    expect(w.find('[data-testid="def-scheme"]').text()).toContain('Tidak')
    expect(w.find('[data-testid="def-review"]').text()).toContain('Ya')
    expect(text).toContain('Soalan Diimport (2) — semuanya draf')
    for (const h of ['No.', 'Soalan', 'Bilangan Bahagian']) expect(text).toContain(h)
    const links = w.findAll('a[href^="/admin/studio/questions/"]')
    expect(links.map((l) => l.attributes('href'))).toContain('/admin/studio/questions/501/sunting')
    expect(links[0]?.text()).toBe('Sunting di Studio')
  })

  it('prints "Isu Import" only when there are issues', async () => {
    api.fetchSourcePaper.mockResolvedValue(detail())
    let w = await mountPage(SourcePaperDetailPage, '/admin/source-papers/7', { id: '7' })
    expect(w.text()).not.toContain('Isu Import')
    w.unmount()
    api.fetchSourcePaper.mockResolvedValue(detail({ issues: [{ itemId: null, where: 'Kertas', message: 'Pemprosesan kertas gagal.' }] }))
    w = await mountPage(SourcePaperDetailPage, '/admin/source-papers/7', { id: '7' })
    expect(w.text()).toContain('Isu Import')
    expect(w.text()).toContain('Pemprosesan kertas gagal.')
  })

  it('empty questions print "Belum ada soalan diimport untuk kertas ini."', async () => {
    api.fetchSourcePaper.mockResolvedValue(detail({ questionList: [] }))
    const w = await mountPage(SourcePaperDetailPage, '/admin/source-papers/7', { id: '7' })
    expect(w.text()).toContain('Soalan Diimport (0) — semuanya draf')
    expect(w.text()).toContain('Belum ada soalan diimport untuk kertas ini.')
  })
})
