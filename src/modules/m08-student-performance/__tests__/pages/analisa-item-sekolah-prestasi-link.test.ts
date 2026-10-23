// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'

import { NOT_FOUND_ROUTE_NAME } from '@/composables/useRouteExists'

import type { SchoolItemAnalysis } from '../../api/types'
import AnalisaItemSekolahPage from '../../pages/AnalisaItemSekolahPage.vue'

const api = vi.hoisted(() => ({ fetchSchoolItemAnalysis: vi.fn() }))
vi.mock('../../api/performance', () => api)

/** SW3-02: the "Prestasi 360" link is shown only when `/sekolah/{id}/prestasi` is a real route. */
const DATA: SchoolItemAnalysis = {
  school: { id: 1, name: 'SMK Demo', code: null, type: null, district: null, state: null },
  variant: 'byId',
  tingkatan: null,
  students: 1,
  answers: 10,
  correct: 7,
  accuracy: 70,
  difficulty: { mudah: 0, sederhana: 0, sukar: 0 },
  gps: { value: null, band: null, entries: 0, years: [] },
  subjects: [],
  questions: [],
} as unknown as SchoolItemAnalysis

let wrapper: VueWrapper | undefined

async function mountWith(extra: RouteRecordRaw[]) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/analisa-item/sekolah/:id', component: AnalisaItemSekolahPage },
      ...extra,
      // The app's catch-all 404 route (name is what `routeExists` treats as "no real screen").
      { path: '/:pathMatch(.*)*', name: NOT_FOUND_ROUTE_NAME, component: { template: '<div />' } },
    ],
  })
  await router.push('/analisa-item/sekolah/1')
  wrapper = mount(AnalisaItemSekolahPage, {
    global: { plugins: [router], stubs: { ChartCanvas: { template: '<div />' } } },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

const link = (w: VueWrapper) => w.find('a[href="/sekolah/1/prestasi"]')

beforeEach(() => {
  setActivePinia(createPinia())
  api.fetchSchoolItemAnalysis.mockReset()
  api.fetchSchoolItemAnalysis.mockResolvedValue(DATA)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('S9 AnalisaItemSekolahPage: "Prestasi 360" link (DV-M08-38)', () => {
  it('is hidden while /sekolah/{id}/prestasi is not a route', async () => {
    const w = await mountWith([])
    expect(w.find('[data-testid=school-gps-card]').exists()).toBe(true)
    expect(link(w).exists()).toBe(false)
    expect(w.text()).not.toContain('Prestasi 360')
  })

  it('is shown once the route exists', async () => {
    const w = await mountWith([{ path: '/sekolah/:id/prestasi', component: { template: '<div />' } }])
    expect(link(w).exists()).toBe(true)
    expect(link(w).text()).toBe('Prestasi 360')
  })
})
