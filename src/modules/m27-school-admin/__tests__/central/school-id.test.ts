// @vitest-environment jsdom
/**
 * R1-ADM-M-07 (S6-T13, API-ADM-22): the five M27 report clients add `?schoolId=` only when the caller names a school
 * (Admin Pusat, central views); the school admin's calls are unchanged. The pages take the optional `schoolId` prop.
 */
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { usePageMeta } from '@/composables/usePageMeta'

const http = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/api', async (importActual) => ({
  ...(await importActual<typeof import('@/api')>()),
  api: { get: http.get, configure: vi.fn() },
}))

import {
  CENTRAL_EMPTY,
  fetchMonthlyReport,
  fetchSchoolActivityReport,
  fetchSchoolDskpHeatmap,
  fetchSchoolUsage,
  isSchoolDataMissing,
} from '../../api/school-admin'
import LaporanAktivitiPage from '../../pages/LaporanAktivitiPage.vue'

const CALLS = [
  ['usage', () => fetchSchoolUsage({ period: '7days', schoolId: 900001 }), () => fetchSchoolUsage({ period: '7days' })],
  ['laporan-aktiviti', () => fetchSchoolActivityReport({ range: 7, schoolId: 900001 }), () => fetchSchoolActivityReport({ range: 7 })],
  ['laporan-bulanan', () => fetchMonthlyReport({ bulan: '2026-01', schoolId: 900001 }), () => fetchMonthlyReport({ bulan: '2026-01' })],
  ['dskp-heatmap', () => fetchSchoolDskpHeatmap({ tingkatan: 'T4', schoolId: 900001 }), () => fetchSchoolDskpHeatmap({ tingkatan: 'T4' })],
] as const

beforeEach(() => {
  setActivePinia(createPinia())
  http.get.mockReset().mockResolvedValue({})
  setRouteOutcome(null)
  usePageMeta().reset()
})

describe('clients (API-ADM-22)', () => {
  it.each(CALLS)('%s sends query.schoolId when given', async (path, withSchool) => {
    await withSchool()
    expect(http.get).toHaveBeenCalledWith(
      `/api/admin-sekolah/${path}`,
      expect.objectContaining({ query: expect.objectContaining({ schoolId: 900001 }) }),
    )
  })

  it.each(CALLS)('%s leaves schoolId undefined for the school admin', async (path, _with, without) => {
    await without()
    const [url, options] = http.get.mock.calls[0] as [string, { query: Record<string, unknown> }]
    expect(url).toBe(`/api/admin-sekolah/${path}`)
    expect(options.query.schoolId).toBeUndefined()
  })
})

describe('isSchoolDataMissing', () => {
  const err = (status: number) =>
    new ApiError({ status, code: 'x', message: 'x', method: 'GET', url: '/api/x' })

  it('is true for a 404 and a 422 only', () => {
    expect(isSchoolDataMissing(err(404))).toBe(true)
    expect(isSchoolDataMissing(err(422))).toBe(true)
    expect(isSchoolDataMissing(err(403))).toBe(false)
    expect(isSchoolDataMissing(err(500))).toBe(false)
    expect(isSchoolDataMissing(new Error('x'))).toBe(false)
    expect(isSchoolDataMissing(null)).toBe(false)
  })

  it('the copy is the M-07 empty line', () => {
    expect(CENTRAL_EMPTY).toBe('Tiada data untuk sekolah ini.')
  })
})

describe('page without the schoolId prop (school admin)', () => {
  it('keeps the dashboard crumb and never shows the central empty state, even on a 404', async () => {
    http.get.mockRejectedValue(
      new ApiError({ status: 404, code: 'x', message: 'x', method: 'GET', url: '/api/x' }),
    )
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
    })
    await router.push('/admin-sekolah/laporan-aktiviti')
    await router.isReady()
    const w = mount(LaporanAktivitiPage, { global: { plugins: [router] } })
    await flushPromises()
    expect(w.find('[data-testid="la-central-empty"]').exists()).toBe(false)
    expect(w.find('[data-testid="la-error"]').exists()).toBe(true)
    const [, options] = http.get.mock.calls[0] as [string, { query: Record<string, unknown> }]
    expect(options.query.schoolId).toBeUndefined()
  })
})
