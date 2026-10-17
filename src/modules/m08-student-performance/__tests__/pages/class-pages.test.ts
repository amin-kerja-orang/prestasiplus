// @vitest-environment jsdom
import { DOMWrapper, flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import USelect from '@nuxt/ui/components/Select.vue'

import { ApiError } from '@/api'
import { useRouteOutcome } from '@/app/router'
import { setRouteOutcome } from '@/app/router/outcome'

import type { ClassAnalytics, ClassDashboard } from '../../api/types'
import AnalitikKelasPage from '../../pages/AnalitikKelasPage.vue'
import PrestasiKelasDetailPage from '../../pages/PrestasiKelasDetailPage.vue'

const api = vi.hoisted(() => ({
  fetchClassDashboard: vi.fn(),
  fetchClassAnalytics: vi.fn(),
  fetchOwnClasses: vi.fn(),
}))
vi.mock('../../api/class', () => ({
  fetchClassDashboard: api.fetchClassDashboard,
  fetchClassAnalytics: api.fetchClassAnalytics,
}))
vi.mock('../../api/performance', () => ({ fetchOwnClasses: api.fetchOwnClasses }))

const S5: ClassDashboard = {
  class: {
    id: 2001,
    name: '5 MARIKH - Kimia',
    school: 'SMK DEMO',
    subject: 'Kimia',
    year: 2026,
    joinCode: 'DMO101',
  },
  stats: { students: 8, accuracy: 42.6, sessions: 11, answered: 68, avgMinutes: 6.1, active7d: 6 },
  headcount: {
    configId: 504,
    onTrack: 0,
    below: 1,
    noData: 7,
    pct: { on: 0, below: 12.5, none: 87.5 },
    avgTov: 50,
    avgEtr: 65,
  },
  attention: [
    { userId: 3003, name: 'Murid A', sessions: 1, accuracy: 37.5 },
    { userId: 3099, name: 'Murid Z', sessions: 0, accuracy: null },
  ],
  trend: [{ date: '2026-09-15', sessions: 4, avgAccuracy: 56.3, activeStudents: 4 }],
  ranking: [
    {
      rank: 1,
      userId: 3001,
      name: 'Murid B',
      sessions: 2,
      answered: 9,
      accuracy: 88.9,
      headcount: 'below',
      lastActiveAt: '2026-09-24T10:00:00+08:00',
    },
    {
      rank: 2,
      userId: 3099,
      name: 'Murid Z',
      sessions: 0,
      answered: 0,
      accuracy: null,
      headcount: 'na',
      lastActiveAt: null,
    },
  ],
}

const S8: ClassAnalytics = {
  options: {
    classes: [{ id: 2001, name: '5 MARIKH - Kimia' }],
    subjects: [{ id: 10, name: 'Kimia' }],
    selected: { classroomId: 2001, subjectId: 10, riskLevel: '' },
  },
  summary: { students: 2, accuracy: 41.8, atRisk: 1, good: 1 },
  rows: [
    {
      userId: 3001,
      name: 'Murid B',
      accuracy: 88.9,
      answered: 9,
      trend: 'stable',
      projection: { low: 'A-', high: 'A+' },
      riskLevel: 'low',
    },
    {
      userId: 3007,
      name: 'Murid C',
      accuracy: 33.3,
      answered: 9,
      trend: 'down',
      projection: { low: 'G', high: 'D' },
      riskLevel: 'critical',
    },
  ],
}

let wrapper: VueWrapper | null = null
let router: ReturnType<typeof createRouter>

async function render(component: object, path: string, route: string) {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  router.addRoute({ path: route, component })
  await router.push(path)
  wrapper = mount(component, {
    global: {
      plugins: [router],
      stubs: { ChartCanvas: { template: '<div data-testid="chart" />' } },
    },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}
const t = (w: VueWrapper, id: string) => w.get(`[data-testid=${id}]`)
/** The big number of a stat tile. */
const num = (w: VueWrapper, id: string) => t(w, id).find('.tabular').text()
/** The table row (or card) that holds the element with this test id. */
const tr = (w: VueWrapper, id: string) =>
  new DOMWrapper(t(w, id).element.closest('tr') ?? t(w, id).element)
/** The Nuxt UI select with this test id. */
const select = (w: VueWrapper, id: string) => {
  const found = w
    .findAllComponents(USelect)
    .find((c) => c.element.matches(`[data-testid=${id}]`) || c.find(`[data-testid=${id}]`).exists())
  if (!found) throw new Error(`no select ${id}`)
  return found
}

beforeEach(() => {
  setActivePinia(createPinia())
  setRouteOutcome(null)
  for (const fn of Object.values(api)) fn.mockReset()
  api.fetchOwnClasses.mockResolvedValue([
    {
      id: 2001,
      name: '5 MARIKH - Kimia',
      subjectName: 'Kimia',
      color: '#10B981',
      students: 8,
      year: 2026,
      joinCode: 'DMO101',
      isActive: true,
    },
  ])
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('S5 PrestasiKelasDetailPage', () => {
  it('shows the header, the 6 stat cards and the headcount block', async () => {
    api.fetchClassDashboard.mockResolvedValue(S5)
    const w = await render(PrestasiKelasDetailPage, '/prestasi/kelas/2001', '/prestasi/kelas/:id')
    expect(t(w, 'class-name').text()).toBe('5 MARIKH - Kimia')
    expect(t(w, 'class-sub').text()).toBe('SMK DEMO · Kimia · 2026 · Kod: DMO101')
    expect(t(w, 'back-link').attributes('title')).toBe('Kembali ke senarai kelas')
    expect(t(w, 'back-link').attributes('href')).toBe('/prestasi/kelas')
    expect(
      ['murid', 'ketepatan', 'sesi', 'soalan', 'masa', 'aktif'].map((id) => num(w, `stat-${id}`)),
    ).toEqual(['8', '42.6%', '11', '68', '6.1m', '6'])
    expect(num(w, 'hc-on')).toBe('0')
    expect(num(w, 'hc-below')).toBe('1')
    expect(num(w, 'hc-none')).toBe('7')
    expect(t(w, 'hc-tov').text()).toBe('Purata TOV: 50%')
    expect(t(w, 'hc-full').attributes('href')).toBe('/headcount/504/summary')
  })

  it('omits the headcount block without a config; the subject part is left out without subject', async () => {
    api.fetchClassDashboard.mockResolvedValue({
      ...S5,
      class: { ...S5.class, subject: null, joinCode: 'DEMO-4S' },
      headcount: null,
    })
    const w = await render(PrestasiKelasDetailPage, '/prestasi/kelas/2001', '/prestasi/kelas/:id')
    expect(w.find('[data-testid=headcount-block]').exists()).toBe(false)
    expect(t(w, 'class-sub').text()).toBe('SMK DEMO · 2026 · Kod: DEMO-4S')
  })

  it('shows zeros as "0%" and "0m", and the empty trend message', async () => {
    api.fetchClassDashboard.mockResolvedValue({
      ...S5,
      stats: { students: 15, accuracy: 0, sessions: 0, answered: 0, avgMinutes: 0, active7d: 0 },
      trend: [],
    })
    const w = await render(PrestasiKelasDetailPage, '/prestasi/kelas/2001', '/prestasi/kelas/:id')
    expect(t(w, 'stat-ketepatan').text()).toContain('0%')
    expect(t(w, 'stat-masa').text()).toContain('0m')
    expect(t(w, 'trend-empty').text()).toContain('Belum ada aktiviti dalam 30 hari terakhir.')
    expect(w.find('[data-testid=chart]').exists()).toBe(false)
  })

  it('Perlu Perhatian rows and the ranking table (dash without practice, badges, medals)', async () => {
    api.fetchClassDashboard.mockResolvedValue(S5)
    const w = await render(PrestasiKelasDetailPage, '/prestasi/kelas/2001', '/prestasi/kelas/:id')
    expect(t(w, 'attention-count').text()).toBe('(2)')
    expect(t(w, 'attention-3003').text()).toContain('1 sesi · 37.5% ketepatan')
    expect(t(w, 'attention-3003').attributes('href')).toBe('/prestasi/3003')
    expect(t(w, 'attention-3099').text()).toContain('Belum mula berlatih')
    expect(t(w, 'attention-3099').text()).toContain('Tak Aktif')
    const first = tr(w, 'rank-row-3001')
    expect(first.text()).toContain('🥇')
    expect(first.text()).toContain('88.9%')
    expect(first.get('[data-testid=rank-badge]').text()).toBe('Below')
    expect(first.text()).toContain('yang lepas')
    const idle = tr(w, 'rank-row-3099')
    expect(idle.get('[data-testid=rank-acc]').text()).toBe('—')
    expect(idle.get('[data-testid=rank-badge]').text()).toBe('N/A')
  })

  it('the class select navigates to the chosen class', async () => {
    api.fetchClassDashboard.mockResolvedValue(S5)
    const w = await render(PrestasiKelasDetailPage, '/prestasi/kelas/2001', '/prestasi/kelas/:id')
    const switcher = select(w, 'switch-class')
    expect((switcher.props() as unknown as { items: unknown }).items).toEqual([
      { label: '5 MARIKH - Kimia', value: '/prestasi/kelas/2001' },
    ])
    switcher.vm.$emit('update:modelValue', '/prestasi/kelas/2001')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/prestasi/kelas/2001')
  })

  it('an unknown class is the 404 page', async () => {
    api.fetchClassDashboard.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }),
    )
    await render(PrestasiKelasDetailPage, '/prestasi/kelas/9', '/prestasi/kelas/:id')
    expect(useRouteOutcome().value).toBe(404)
  })
})

describe('S8 AnalitikKelasPage', () => {
  it('shows the 4 cards and the student table', async () => {
    api.fetchClassAnalytics.mockResolvedValue(S8)
    const w = await render(
      AnalitikKelasPage,
      '/analitik/kelas?classroom_id=2001',
      '/analitik/kelas',
    )
    expect(api.fetchClassAnalytics.mock.calls[0]?.[0]).toEqual({ classroomId: 2001, riskLevel: '' })
    expect(t(w, 'sum-pelajar').text()).toContain('2')
    expect(t(w, 'sum-ketepatan').text()).toContain('41.8%')
    expect(num(w, 'sum-berisiko')).toBe('1')
    expect(t(w, 'sum-baik').text()).toContain('1')
    expect(tr(w, 'student-row-3001').text()).toContain('88.9%')
    expect(tr(w, 'student-row-3001').text()).toContain('A- – A+')
    expect(tr(w, 'student-row-3001').get('[data-testid=risk-badge]').text()).toBe('Rendah')
    expect(tr(w, 'student-row-3007').get('[data-testid=risk-badge]').text()).toBe('Kritikal')
    expect(tr(w, 'student-row-3007').text()).toContain('Lihat Analitik')
    expect(tr(w, 'student-row-3007').get('a').attributes('href')).toBe('/prestasi/3007')
  })

  it('Pelajar Berisiko is green when 0; no card is hidden', async () => {
    api.fetchClassAnalytics.mockResolvedValue({
      ...S8,
      summary: { students: 6, accuracy: 0, atRisk: 0, good: 4 },
    })
    const w = await render(AnalitikKelasPage, '/analitik/kelas?classroom_id=4', '/analitik/kelas')
    expect(num(w, 'sum-berisiko')).toBe('0')
    expect(t(w, 'sum-ketepatan').text()).toContain('0.0%')
  })

  it('shows the empty state without data and keeps the filters', async () => {
    api.fetchClassAnalytics.mockResolvedValue({ ...S8, summary: null, rows: [] })
    const w = await render(AnalitikKelasPage, '/analitik/kelas', '/analitik/kelas')
    expect(t(w, 'analitik-empty').text()).toContain(
      'Tiada data analitik untuk kelas dan subjek ini.',
    )
    expect(w.find('[data-testid=student-table]').exists()).toBe(false)
    expect(
      (select(w, 'filter-risiko').props() as unknown as { items: { label: string }[] }).items.map(
        (o) => o.label,
      ),
    ).toEqual(['Semua Risiko', 'Kritikal', 'Tinggi', 'Sederhana', 'Rendah'])
  })

  it('a select change submits the GET form into the URL (the subject is dropped on a class change)', async () => {
    api.fetchClassAnalytics.mockResolvedValue(S8)
    const w = await render(
      AnalitikKelasPage,
      '/analitik/kelas?classroom_id=2001&subject_id=10',
      '/analitik/kelas',
    )
    select(w, 'filter-risiko').vm.$emit('update:modelValue', 'critical')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({
      classroom_id: '2001',
      subject_id: '10',
      risk_level: 'critical',
    })
    select(w, 'filter-kelas').vm.$emit('update:modelValue', '2001')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({
      classroom_id: '2001',
      risk_level: 'critical',
    })
  })

  it('a forbidden class is the 403 page', async () => {
    api.fetchClassAnalytics.mockRejectedValue(
      new ApiError({ status: 403, code: 'FORBIDDEN', message: 'x' }),
    )
    await render(AnalitikKelasPage, '/analitik/kelas?classroom_id=4', '/analitik/kelas')
    expect(useRouteOutcome().value).toBe(403)
  })
})
