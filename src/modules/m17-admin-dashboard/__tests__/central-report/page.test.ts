// @vitest-environment jsdom
/**
 * R1-ADM-M-07 (S6-T13): the Admin Pusat central view `AdminCentralReportPage` (PRD-30 M-07; AC-ADM-M07.1).
 * The picker "Sekolah" (placeholder "Pilih sekolah", required "Sila pilih sekolah."), the EXISTING school page
 * mounted for the picked school, `?schoolId=` on the client call, and the empty copy "Tiada data untuk sekolah ini.".
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'
import { usePageMeta } from '@/composables/usePageMeta'
import type { SchoolSummary } from '@/modules/m02-users-schools'

import AdminCentralReportPage from '../../pages/AdminCentralReportPage.vue'
import type { CentralReportView } from '../../routes/laporan'

const api = vi.hoisted(() => ({
  fetchSchoolActivityReport: vi.fn(),
  fetchSchoolUsage: vi.fn(),
  fetchSchoolDskpHeatmap: vi.fn(),
  fetchMonthlyReport: vi.fn(),
  fetchSchoolRisk: vi.fn(),
  searchSchools: vi.fn(),
}))
vi.mock('@/modules/m27-school-admin/api/school-admin', async (importActual) => ({
  ...(await importActual<typeof import('@/modules/m27-school-admin/api/school-admin')>()),
  fetchSchoolActivityReport: api.fetchSchoolActivityReport,
  fetchSchoolUsage: api.fetchSchoolUsage,
  fetchSchoolDskpHeatmap: api.fetchSchoolDskpHeatmap,
  fetchMonthlyReport: api.fetchMonthlyReport,
}))
vi.mock('@/modules/m27-school-admin/api/amaran', async (importActual) => ({
  ...(await importActual<typeof import('@/modules/m27-school-admin/api/amaran')>()),
  fetchSchoolRisk: api.fetchSchoolRisk,
}))
vi.mock('@/modules/m02-users-schools/api/schools', () => ({ searchSchools: api.searchSchools }))

const SCHOOL: SchoolSummary = {
  id: 900001,
  name: 'SMK Contoh Ujian',
  code: 'XYZ1',
  type: 'SMK',
  state: 'Selangor',
  district: 'PPD Contoh',
  city: null,
}

/** The fetcher each M27 view calls and the test id of its loading state (the call never settles). */
const VIEWS: ReadonlyArray<[Exclude<CentralReportView, 'sekolah-bersaing'>, keyof typeof api, string, string]> = [
  ['laporan-aktiviti', 'fetchSchoolActivityReport', 'la-loading', 'la-central-empty'],
  ['statistik-penggunaan', 'fetchSchoolUsage', 'su-loading', 'su-central-empty'],
  ['dskp-heatmap', 'fetchSchoolDskpHeatmap', 'dh-loading', 'dh-central-empty'],
  ['laporan-bulanan', 'fetchMonthlyReport', 'lb-loading', 'lb-central-empty'],
  ['amaran-wellbeing', 'fetchSchoolRisk', 'am-loading', 'am-central-empty'],
  ['amaran-awal', 'fetchSchoolRisk', 'am-loading', 'am-central-empty'],
]

let router: Router
let wrapper: VueWrapper | null = null

async function mountView(view: Exclude<CentralReportView, 'sekolah-bersaing'>): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push(`/admin/laporan-sekolah/${view}`)
  await router.isReady()
  wrapper = mount(AdminCentralReportPage, {
    props: { view },
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

const t = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`)
const has = (w: VueWrapper, id: string) => w.find(`[data-testid="${id}"]`).exists()

async function pickSchool(w: VueWrapper): Promise<void> {
  api.searchSchools.mockResolvedValue([SCHOOL])
  await t(w, 'admin-school-search').setValue('Contoh')
  await vi.advanceTimersByTimeAsync(300)
  await flushPromises()
  await t(w, 'admin-school-result').trigger('click')
  await flushPromises()
  // the school page is a lazy component: wait for its import, then for its first render
  await vi.dynamicImportSettled()
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers()
  for (const fn of Object.values(api)) fn.mockReset()
  for (const key of [
    'fetchSchoolActivityReport',
    'fetchSchoolUsage',
    'fetchSchoolDskpHeatmap',
    'fetchMonthlyReport',
    'fetchSchoolRisk',
  ] as const) {
    api[key].mockReturnValue(new Promise(() => undefined))
  }
  setRouteOutcome(null)
  usePageMeta().reset()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.useRealTimers()
})

describe('picker (PRD-30 M-07: `Sekolah`, required)', () => {
  it('shows the field "Sekolah" with the placeholder "Pilih sekolah" and no school page yet', async () => {
    const w = await mountView('laporan-aktiviti')
    expect(w.text()).toContain('Sekolah')
    expect(t(w, 'admin-school-search').attributes('placeholder')).toBe('Pilih sekolah')
    expect(has(w, 'field-error')).toBe(false)
    expect(api.fetchSchoolActivityReport).not.toHaveBeenCalled()
    expect(has(w, 'la-loading')).toBe(false)
  })

  it('shows "Sila pilih sekolah." when the form is submitted empty', async () => {
    const w = await mountView('laporan-aktiviti')
    await t(w, 'central-form').trigger('submit')
    expect(t(w, 'field-error').text()).toContain('Sila pilih sekolah.')
    expect(api.fetchSchoolActivityReport).not.toHaveBeenCalled()
  })

  it('shows "Sila pilih sekolah." again once the picked school is cleared, and drops the page', async () => {
    const w = await mountView('laporan-aktiviti')
    await pickSchool(w)
    expect(has(w, 'field-error')).toBe(false)
    await t(w, 'admin-school-clear').trigger('click')
    await flushPromises()
    expect(t(w, 'field-error').text()).toContain('Sila pilih sekolah.')
    expect(has(w, 'la-loading')).toBe(false)
  })
})

describe('each view mounts the existing school page for the picked school (AC-ADM-M07.1)', () => {
  it.each(VIEWS)('%s calls the client with the picked schoolId', async (view, fetcher, loading) => {
    const w = await mountView(view)
    await pickSchool(w)
    expect(has(w, loading)).toBe(true)
    expect(api[fetcher]).toHaveBeenCalledTimes(1)
    const call = api[fetcher].mock.calls[0] as unknown[]
    // the M27 clients take `{ schoolId }`; the Amaran client takes the id first (M18 #21)
    if (fetcher === 'fetchSchoolRisk') expect(call[0]).toBe(SCHOOL.id)
    else expect(call[0]).toMatchObject({ schoolId: SCHOOL.id })
  })

  it.each(VIEWS)('%s shows "Tiada data untuk sekolah ini." for a 404 and a 422', async (view, fetcher, _l, empty) => {
    for (const status of [404, 422]) {
      api[fetcher].mockReset().mockRejectedValue(
        new ApiError({ status, code: 'x', message: 'x', method: 'GET', url: '/api/x' }),
      )
      const w = await mountView(view)
      await pickSchool(w)
      expect(t(w, empty).text()).toContain('Tiada data untuk sekolah ini.')
      expect(has(w, 'am-error')).toBe(false)
      wrapper?.unmount()
      wrapper = null
    }
  })

  it('a 403 still renders the 403 outcome, not the empty copy', async () => {
    api.fetchSchoolUsage.mockReset().mockRejectedValue(
      new ApiError({ status: 403, code: 'FORBIDDEN', message: 'x', method: 'GET', url: '/api/x' }),
    )
    const w = await mountView('statistik-penggunaan')
    await pickSchool(w)
    expect(has(w, 'su-central-empty')).toBe(false)
    expect(useRouteOutcome().value).toBe(403)
  })

  it('analisa-item opens the M08 school page of the picked school', async () => {
    const w = await mountView('analisa-item')
    await pickSchool(w)
    expect(router.currentRoute.value.path).toBe(`/analisa-item/sekolah/${String(SCHOOL.id)}`)
  })
})

describe('the central view does not link to the school-admin dashboard', () => {
  it('pills stay on the central route', async () => {
    api.fetchSchoolUsage.mockReset().mockResolvedValue({
      school: { id: SCHOOL.id, name: SCHOOL.name },
      period: '30days',
      label: '30 Hari',
      tiles: {
        pupils: 10,
        teachers: 1,
        activePupils: 5,
        participationPct: 50,
        sessions: 3,
        answers: 30,
        accuracy: 60,
      },
      modes: [{ label: 'Latihan', sessions: 3, accuracy: 60 }],
    })
    const w = await mountView('statistik-penggunaan')
    await pickSchool(w)
    expect(has(w, 'su-pills')).toBe(true)
    const hrefs = w.findAll('[data-testid="su-pills"] a').map((a) => a.attributes('href'))
    expect(hrefs.length).toBeGreaterThan(0)
    for (const href of hrefs) expect(href).toContain('/admin/laporan-sekolah/statistik-penggunaan')
    expect(has(w, 'su-breadcrumb')).toBe(false)
    expect(w.html()).not.toContain('/admin-sekolah')
    expect(usePageMeta().state.header).toEqual({
      title: 'Statistik Penggunaan',
      subtitle: SCHOOL.name,
    })
  })
})
