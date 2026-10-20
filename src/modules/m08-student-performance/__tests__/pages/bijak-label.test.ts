// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { setRouteOutcome } from '@/app/router/outcome'

import type { ClassDashboard, StudentPerformance } from '../../api/types'
import Prestasi360Page from '../../pages/Prestasi360Page.vue'
import PrestasiKelasDetailPage from '../../pages/PrestasiKelasDetailPage.vue'

/** US-33: teacher views say "Keputusan Bijak SPM" in http mode only; empty data shows "Tiada data". */

const api = vi.hoisted(() => ({
  fetchStudentPerformance: vi.fn(),
  fetchClassDashboard: vi.fn(),
  fetchOwnClasses: vi.fn(),
}))
vi.mock('../../api/performance', () => ({
  fetchStudentPerformance: api.fetchStudentPerformance,
  fetchOwnClasses: api.fetchOwnClasses,
}))
vi.mock('../../api/class', () => ({ fetchClassDashboard: api.fetchClassDashboard }))

const PUPIL: StudentPerformance = {
  user: { id: 3001, name: 'Murid Demo 01', initial: 'M' },
  heroAccuracy: 86,
  streak: 0,
  stats: { sessions: 3, accuracy: 85.7, answered: 14, seconds: 0 },
  headcount: [],
  mastery: [],
  activity: { streakCurrent: 0, streakBest: 0, koinTotal: 0, practiceDays: 0 },
  badges: [],
  heatmap: [],
  weakTopics: [],
  suggestions: [],
}

const CLASS: ClassDashboard = {
  class: {
    id: 2001,
    name: '5 MARIKH - Kimia',
    school: 'SMK DEMO',
    subject: 'Kimia',
    year: 2026,
    joinCode: 'DMO101',
  },
  stats: { students: 8, accuracy: 42.6, sessions: 11, answered: 68, avgMinutes: 0, active7d: 0 },
  headcount: null,
  attention: [],
  trend: [],
  ranking: [],
}

let wrapper: VueWrapper | null = null

async function render(component: object, path: string, route: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  router.addRoute({ path: route, component })
  await router.push(path)
  wrapper = mount(component, {
    global: { plugins: [router], stubs: { ChartCanvas: { template: '<div />' } } },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}
const has = (w: VueWrapper, id: string) => w.find(`[data-testid=${id}]`).exists()

beforeEach(() => {
  setActivePinia(createPinia())
  setRouteOutcome(null)
  for (const fn of Object.values(api)) fn.mockReset()
  api.fetchOwnClasses.mockResolvedValue([])
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.unstubAllEnvs()
})

describe('Prestasi360Page Bijak SPM label (US-33)', () => {
  it('http mode: shows the Bijak SPM heading, the figures and hides the neutral panels', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    api.fetchStudentPerformance.mockResolvedValue(PUPIL)
    const w = await render(Prestasi360Page, '/prestasi/3001', '/prestasi/:userId')
    expect(w.get('[data-testid=bijak-summary]').text()).toContain('Keputusan Bijak SPM')
    expect(has(w, 'stat-sesi')).toBe(true)
    expect(has(w, 'stat-masa')).toBe(false)
    expect(has(w, 'activity-card')).toBe(false)
    expect(has(w, 'bijak-empty')).toBe(false)
  })

  it('http mode: shows "Tiada data" without sittings', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    api.fetchStudentPerformance.mockResolvedValue({
      ...PUPIL,
      stats: { sessions: 0, accuracy: 0, answered: 0, seconds: 0 },
    })
    const w = await render(Prestasi360Page, '/prestasi/3001', '/prestasi/:userId')
    expect(w.get('[data-testid=bijak-empty]').text()).toContain('Tiada data')
    expect(has(w, 'stat-cards')).toBe(false)
  })

  it('mock mode: no Bijak heading, practice tiles unchanged', async () => {
    api.fetchStudentPerformance.mockResolvedValue(PUPIL)
    const w = await render(Prestasi360Page, '/prestasi/3001', '/prestasi/:userId')
    expect(has(w, 'bijak-summary')).toBe(false)
    expect(has(w, 'stat-masa')).toBe(true)
    expect(has(w, 'activity-card')).toBe(true)
  })
})

describe('PrestasiKelasDetailPage Bijak SPM label (US-33)', () => {
  it('http mode: shows the Bijak SPM heading and leaves out the neutral tiles', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    api.fetchClassDashboard.mockResolvedValue(CLASS)
    const w = await render(PrestasiKelasDetailPage, '/prestasi/kelas/2001', '/prestasi/kelas/:id')
    expect(w.get('[data-testid=bijak-summary]').text()).toContain('Keputusan Bijak SPM')
    expect(has(w, 'stat-sesi')).toBe(true)
    expect(has(w, 'stat-masa')).toBe(false)
    expect(has(w, 'stat-aktif')).toBe(false)
  })

  it('http mode: shows "Tiada data" without sittings', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    api.fetchClassDashboard.mockResolvedValue({
      ...CLASS,
      stats: { ...CLASS.stats, accuracy: 0, sessions: 0, answered: 0 },
    })
    const w = await render(PrestasiKelasDetailPage, '/prestasi/kelas/2001', '/prestasi/kelas/:id')
    expect(w.get('[data-testid=bijak-empty]').text()).toContain('Tiada data')
  })

  it('mock mode: no Bijak heading, six tiles', async () => {
    api.fetchClassDashboard.mockResolvedValue(CLASS)
    const w = await render(PrestasiKelasDetailPage, '/prestasi/kelas/2001', '/prestasi/kelas/:id')
    expect(has(w, 'bijak-summary')).toBe(false)
    expect(has(w, 'stat-masa')).toBe(true)
    expect(has(w, 'stat-aktif')).toBe(true)
  })
})
