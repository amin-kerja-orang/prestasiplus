// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router'

import type { GuruStructuredDetail, GuruStructuredRow } from '../../api/structured-guru'
import StructuredDetailPage from '../../pages/StructuredDetailPage.vue'
import StructuredListPage from '../../pages/StructuredListPage.vue'

const api = vi.hoisted(() => ({
  fetchGuruStructuredQuestions: vi.fn(),
  fetchGuruStructuredQuestion: vi.fn(),
}))
const admin = vi.hoisted(() => ({
  fetchStructuredQuestions: vi.fn(),
  fetchStructuredQuestion: vi.fn(),
}))
vi.mock('../../api/structured-guru', async (orig) => ({
  ...(await orig<typeof import('../../api/structured-guru')>()),
  ...api,
}))
vi.mock('../../api/structured', () => admin)
vi.mock('../../lib/lookup-options', () => ({
  fetchSubjectOptions: vi.fn(() =>
    Promise.resolve([
      { id: 9, name: 'Perniagaan' },
      { id: 12, name: 'Bahasa Melayu' },
    ]),
  ),
  fetchLevelOptions: vi.fn(() =>
    Promise.resolve([
      { id: 10, name: 'Tingkatan 4' },
      { id: 11, name: 'Tingkatan 5' },
      { id: 3, name: 'Darjah 3' },
    ]),
  ),
}))

function row(n: number): GuruStructuredRow {
  return {
    id: 4000 + n,
    number: n,
    textExcerpt: `Petikan ${String(n)}...`,
    level: 'Tingkatan 5',
    subject: 'Perniagaan',
    kbat: 'MOTS 3',
    subCount: 1,
    marks: 8,
    status: 'approved',
  }
}

function result(rows: GuruStructuredRow[], total: number, page = 1) {
  return {
    data: rows,
    meta: {
      page,
      pageSize: 20,
      totalItems: total,
      totalPages: Math.max(1, Math.ceil(total / 20)),
      from: rows.length ? (page - 1) * 20 + 1 : null,
      to: rows.length ? (page - 1) * 20 + rows.length : null,
    },
  }
}

const detail: GuruStructuredDetail = {
  id: 4001,
  subject: 'Perniagaan',
  level: 'Tingkatan 5',
  kbat: 'MOTS 3',
  status: 'approved',
  totalMarks: 10,
  stimulus: 'Rangsangan sekali sahaja',
  stimulusImage: null,
  subQuestions: [
    { id: 1, partLabel: 'a', questionText: 'Soalan A', marks: 2, modelAnswer: 'Jawapan A' },
    { id: 2, partLabel: 'b', questionText: 'Soalan B', marks: 8, modelAnswer: 'Jawapan B' },
  ],
}

let wrapper: VueWrapper | null = null

async function renderList(url = '/guru/soalan-berstruktur'): Promise<VueWrapper> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/guru/soalan-berstruktur',
        component: StructuredListPage,
        props: { portal: 'guru' },
      },
      {
        path: '/guru/soalan-berstruktur/:id',
        name: 'm10.soalan.berstruktur.detail',
        component: { template: '<div />' },
      },
    ],
  })
  await router.push(url)
  wrapper = mount(StructuredListPage, { props: { portal: 'guru' }, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

async function renderDetail(id = 4001): Promise<VueWrapper> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/guru/soalan-berstruktur', component: { template: '<div />' } },
      { path: '/guru/soalan-berstruktur/:id', component: StructuredDetailPage },
    ],
  })
  await router.push(`/guru/soalan-berstruktur/${String(id)}`)
  wrapper = mount(StructuredDetailPage, {
    props: { id, portal: 'guru' },
    global: { plugins: [router] },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  setRouteOutcome(null)
  for (const f of [...Object.values(api), ...Object.values(admin)]) f.mockReset()
  api.fetchGuruStructuredQuestions.mockResolvedValue(
    result(
      Array.from({ length: 20 }, (_, i) => row(i + 1)),
      4061,
    ),
  )
  api.fetchGuruStructuredQuestion.mockResolvedValue(detail)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('StructuredListPage portal="guru" (R1-GUR-44b)', () => {
  it('uses the guru client only, with the PRD sub-line and no admin parts', async () => {
    const w = await renderList()
    expect(api.fetchGuruStructuredQuestions).toHaveBeenCalledTimes(1)
    expect(admin.fetchStructuredQuestions).not.toHaveBeenCalled()
    expect(w.text()).toContain(
      'Cipta & urus soalan berstruktur mengikut piawaian SPM KPM — 4,061 soalan dalam bank',
    )
    for (const id of [
      'structured-add',
      'structured-stat-total',
      'structured-by-subject',
      'structured-subject-pill',
      'structured-kbat',
    ])
      expect(w.find(`[data-testid=${id}]`).exists(), id).toBe(false)
    expect(w.findAll('a').some((a) => (a.attributes('href') ?? '').includes('/admin/'))).toBe(false)
    expect(w.findAll('a').some((a) => (a.attributes('href') ?? '').includes('/cipta'))).toBe(false)
  })

  it('shows the PRD columns, chips and status words', async () => {
    const w = await renderList()
    const heads = w.findAll('thead th').map((t) => t.text())
    expect(heads.slice(0, 7)).toEqual(['#', 'Soalan', 'Subjek', 'KBAT', 'Sub', 'Markah', 'Status'])
    const first = w.findAll('tbody tr')[0]!
    expect(first.text()).toContain('Petikan 1...')
    expect(first.text()).toContain('Tingkatan 5')
    expect(first.text()).toContain('MOTS 3')
    expect(first.text()).toContain('8m')
    expect(first.text()).toContain('Diluluskan')
    expect(first.find('a').attributes('href')).toBe('/guru/soalan-berstruktur/4001')
  })

  it('has the filters Subjek A-Z, Tingkatan 1-5, Status and the Tapis button', async () => {
    const w = await renderList()
    const text = (sel: string) => w.findAll(`${sel} option`).map((o) => o.text())
    expect(text('[data-testid=structured-subject]')).toEqual([
      'Semua',
      'Bahasa Melayu',
      'Perniagaan',
    ])
    expect(text('[data-testid=structured-level]')).toEqual(['Semua', 'Tingkatan 4', 'Tingkatan 5'])
    expect(text('[data-testid=structured-status]')).toEqual([
      'Semua',
      'Diluluskan',
      'Menunggu Semakan',
    ])
    expect(w.get('[data-testid=structured-filter] button[type=submit]').text()).toBe('Tapis')
  })

  it('passes the status filter and the page to the client', async () => {
    await renderList('/guru/soalan-berstruktur?status=review&page=2')
    expect(api.fetchGuruStructuredQuestions.mock.calls[0]![0]).toMatchObject({
      status: 'review',
      page: 2,
    })
  })

  it('shows 20 rows per page with the BM pager', async () => {
    const w = await renderList()
    expect(w.findAll('tbody tr')).toHaveLength(20)
    expect(w.get('[data-testid=structured-counter]').text()).toBe(
      'Menunjukkan 1 hingga 20 daripada 4,061 keputusan',
    )
    const pager = w.get('[data-testid=structured-pager]')
    expect(pager.text()).toContain('Seterusnya')
    expect(pager.text()).not.toContain('Next')
  })

  it('shows the empty text and no pager', async () => {
    api.fetchGuruStructuredQuestions.mockResolvedValue(result([], 0))
    const w = await renderList('/guru/soalan-berstruktur?status=review')
    expect(w.get('[data-testid=structured-empty]').text()).toBe(
      'Tiada soalan berstruktur dijumpai.',
    )
    expect(w.find('[data-testid=structured-pager]').exists()).toBe(false)
  })

  it('shows the load error with a retry', async () => {
    api.fetchGuruStructuredQuestions.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'HTTP 500' }),
    )
    const w = await renderList()
    expect(w.find('[data-testid=structured-error]').exists()).toBe(true)
  })
})

describe('StructuredDetailPage portal="guru" (R1-GUR-44b)', () => {
  it('shows the regions once with the PRD copy and no admin fields', async () => {
    const w = await renderDetail()
    expect(admin.fetchStructuredQuestion).not.toHaveBeenCalled()
    const back = w.get('[data-testid=structured-back]')
    expect(back.text()).toBe('Kembali ke Senarai')
    expect(back.attributes('href')).toBe('/guru/soalan-berstruktur')
    expect(w.get('[data-testid=structured-status]').text()).toBe('Diluluskan')
    expect(w.get('[data-testid=structured-pill-marks]').text()).toBe('10 markah')
    expect(w.get('[data-testid=structured-pill-kbat]').text()).toBe('MOTS 3')
    expect(w.text()).toContain('Rangsangan')
    expect(w.text().split('Rangsangan sekali sahaja')).toHaveLength(2)
    expect(w.get('[data-testid=structured-subs-heading]').text()).toBe('Sub-Soalan (2)')
    const subs = w.findAll('[data-testid=structured-sub]')
    expect(subs).toHaveLength(2)
    expect(subs[1]!.text()).toContain('(b) Soalan B [8 markah]')
    expect(subs[1]!.text()).toContain('8m')
    expect(subs[1]!.text()).toContain('Skema Jawapan')
    expect(subs[1]!.text()).toContain('Jawapan B')
    for (const t of [
      'ID: #',
      'Visiliti',
      'Visibiliti',
      'Dicipta oleh',
      'Edit Soalan',
      'Jawapan Model',
    ])
      expect(w.text()).not.toContain(t)
    expect(w.find('[data-testid=structured-edit]').exists()).toBe(false)
  })

  it('an unknown id is the standard 404', async () => {
    api.fetchGuruStructuredQuestion.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Tidak dijumpai.' }),
    )
    await renderDetail(9)
    expect(useRouteOutcome().value).toBe(404)
  })
})
