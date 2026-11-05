// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { setRouteOutcome } from '@/app/router/outcome'
import { useSessionStore } from '@/stores/session'

import type { StudentPerformance } from '../../api/types'
import Prestasi360Page from '../../pages/Prestasi360Page.vue'

/**
 * S10-T01 part 2 (FR-MUR-4-6): the Prestasi 360 "Headcount — Prestasi SPM" block of the pupil's own view. The API client is
 * mocked with the read model the API builds from the shared headcount facts (the `GET /headcounts/me` figures).
 */
const api = vi.hoisted(() => ({ fetchStudentPerformance: vi.fn() }))
vi.mock('../../api/performance', () => api)

let wrapper: VueWrapper | null = null

async function render(path: string, route: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  router.addRoute({ path: route, component: Prestasi360Page })
  await router.push(path)
  wrapper = mount(Prestasi360Page, {
    global: { plugins: [router], stubs: { ChartCanvas: { template: '<div />' } } },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

const t = (w: VueWrapper, id: string) => w.get(`[data-testid=${id}]`)
const exists = (w: VueWrapper, id: string) => w.find(`[data-testid=${id}]`).exists()

const signIn = (id: number, role: 'student' | 'teacher'): void => {
  useSessionStore().setSession({
    token: 't',
    remember: false,
    expiresAt: '2099-01-01T00:00:00+08:00',
    user: { id, role, landingPath: '/dashboard' } as never,
  })
}

const BASE: StudentPerformance = {
  user: { id: 3001, name: 'Murid Demo 01', initial: 'M' },
  heroAccuracy: null,
  streak: 0,
  stats: { sessions: 0, accuracy: null, answered: 0, seconds: 0 },
  trend: Array.from({ length: 12 }, (_, i) => ({ week: '2026-07-13', label: `Mgg ${String(i + 1)}`, accuracy: null, sessions: 0 })),
  headcount: [],
  mastery: [],
  activity: { streakCurrent: 0, streakBest: 0, koinTotal: 0, practiceDays: 0 },
  badges: [],
  heatmap: [],
  weakTopics: [],
  suggestions: [],
}

const CARDS: StudentPerformance['headcount'] = [
  {
    configId: 504,
    subject: 'Sejarah',
    className: '5 Contoh',
    year: 2026,
    status: 'on',
    tov: 40,
    chips: [
      { label: 'TOV', value: 40, tone: 'none' },
      { label: 'OTR1', value: 60, tone: 'on' },
      { label: 'OTR2', value: 70, tone: 'on' },
      { label: 'ETR', value: 80, tone: 'none' },
    ],
    etr: 80,
  },
  {
    configId: 501,
    subject: 'Kimia',
    className: '5 Contoh',
    year: 2026,
    status: 'below',
    tov: 50,
    chips: [
      { label: 'TOV', value: 50, tone: 'none' },
      { label: 'OTR1', value: 50, tone: 'below' },
      { label: 'ETR', value: 90, tone: 'none' },
    ],
    etr: 90,
  },
  {
    configId: 500,
    subject: 'Fizik',
    className: '5 Contoh',
    year: 2026,
    status: 'none',
    tov: 40,
    chips: [
      { label: 'TOV', value: 40, tone: 'none' },
      { label: 'ETR', value: null, tone: 'none' },
    ],
    etr: null,
  },
]

beforeEach(() => {
  setActivePinia(createPinia())
  setRouteOutcome(null)
  api.fetchStudentPerformance.mockReset()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('Prestasi 360 Headcount block, the pupil\'s own view (FR-MUR-4-6)', () => {
  it('shows one card per subject with the pill and the TOV, OTR and ETR chips of the API', async () => {
    signIn(3001, 'student')
    api.fetchStudentPerformance.mockResolvedValue({ ...BASE, headcount: CARDS })
    const w = await render('/prestasi', '/prestasi')
    expect(t(w, 'headcount-block').text()).toContain('Headcount — Prestasi SPM')
    expect(exists(w, 'headcount-empty')).toBe(false)
    expect(['504', '501', '500'].map((id) => t(w, `headcount-${id}`).find('h3').text())).toEqual(['Sejarah', 'Kimia', 'Fizik'])
    expect(['504', '501', '500'].map((id) => t(w, `headcount-${id}`).get('[data-testid=status-pill]').text())).toEqual(['On Track', 'Below', '—'])
    expect(t(w, 'headcount-504').findAll('[data-testid=chip]').map((c) => c.text())).toEqual(['TOV: 40%', 'OTR1: 60%', 'OTR2: 70%', 'ETR: 80%'])
    expect(t(w, 'headcount-501').findAll('[data-testid=chip]').map((c) => c.text())).toEqual(['TOV: 50%', 'OTR1: 50%', 'ETR: 90%'])
    expect(t(w, 'headcount-500').findAll('[data-testid=chip]').map((c) => c.text())).toEqual(['TOV: 40%', 'ETR: —'])
    expect(t(w, 'headcount-504').text()).toContain('5 Contoh · 2026')
  })

  it('a pupil with no headcount (or dropped from every config) sees the exact empty copy of the current year', async () => {
    signIn(3001, 'student')
    api.fetchStudentPerformance.mockResolvedValue(BASE)
    const w = await render('/prestasi', '/prestasi')
    expect(t(w, 'headcount-block').text()).toContain('Headcount — Prestasi SPM')
    expect(t(w, 'headcount-empty').text()).toBe(`Belum ada sasaran headcount daripada cikgu untuk sesi ${String(new Date().getFullYear())}.`)
    expect(exists(w, 'headcount-504')).toBe(false)
    expect(w.findAll('[data-testid=chip]')).toHaveLength(0)
  })

  it('staff opening a pupil without headcount keep the block hidden', async () => {
    signIn(7, 'teacher')
    api.fetchStudentPerformance.mockResolvedValue(BASE)
    const w = await render('/prestasi/3001', '/prestasi/:userId(\\d+)')
    expect(exists(w, 'headcount-block')).toBe(false)
  })
})
