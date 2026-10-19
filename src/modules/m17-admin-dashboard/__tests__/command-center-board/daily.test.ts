// @vitest-environment jsdom
/**
 * M17-T3b component tests: S3 (FR-M17-34..47) and its Admin Sekolah alias (FR-M17-116) against a mocked client:
 * header, tabs, pulse cards, school rows and drill, panels, empty copy, the 30 s reload and failures.
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'

import CommandCenterDailyPage from '../../pages/CommandCenterDailyPage.vue'
import { drillData, platformDaily, schoolDaily } from './fixtures'

const api = vi.hoisted(() => ({ fetchCcDailyActivity: vi.fn(), fetchCcSchoolDrill: vi.fn() }))
vi.mock('../../api/command-center-board', async (importActual) => ({
  ...(await importActual<typeof import('../../api/command-center-board')>()),
  fetchCcDailyActivity: api.fetchCcDailyActivity,
  fetchCcSchoolDrill: api.fetchCcSchoolDrill,
}))

async function mountDaily(alias: boolean, path = '/'): Promise<VueWrapper> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(CommandCenterDailyPage, { props: { alias }, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

const get = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`)
const texts = (w: VueWrapper, id: string) => w.findAll(`[data-testid="${id}"]`).map((e) => e.text())
const tab = (w: VueWrapper, period: string) =>
  w.get(`[data-testid="cc-tab"][data-period="${period}"]`)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
  vi.setSystemTime(new Date('2026-09-25T15:40:00+08:00'))
  api.fetchCcDailyActivity.mockReset().mockResolvedValue(platformDaily())
  api.fetchCcSchoolDrill.mockReset().mockResolvedValue(drillData())
  setRouteOutcome(null)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('S3 admin', () => {
  it('renders header, tabs on "Hari Ini" and ignores a ?period= query', async () => {
    const w = await mountDaily(false, '/?period=week')
    expect(get(w, 'cc-s3-subtitle').text()).toBe('Aktiviti Platform')
    expect(get(w, 'cc-s3-back').text()).toBe('◀ Command Center')
    expect(get(w, 'cc-s3-back').attributes('href')).toBe('/admin/command-center')
    expect(get(w, 'cc-s3-report').text()).toBe('Laporan Eksekutif')
    expect(get(w, 'cc-s3-report').attributes('href')).toBe('/admin/laporan-eksekutif')
    expect(get(w, 'cc-clock').text()).toBe('15:40:00')
    expect(texts(w, 'cc-tab')).toEqual(['Hari Ini', 'Minggu Ini', 'Bulan Ini'])
    expect(tab(w, 'today').attributes('data-active')).toBe('true')
    expect(api.fetchCcDailyActivity).toHaveBeenCalledWith('today', expect.anything())
    w.unmount()
  })

  it('renders the six pulse cards', async () => {
    const w = await mountDaily(false)
    expect(texts(w, 'cc-pulse-label')).toEqual([
      'Sekolah Aktif',
      'Login Hari Ini',
      'Pelajar Aktif',
      'Soalan Dijawab',
      'Sesi Latihan',
      'Engagement',
    ])
    expect(texts(w, 'cc-pulse-value')).toEqual(['1', '2', '1', '60', '3/3', '0'])
    expect(texts(w, 'cc-pulse-sub')).toEqual([
      'daripada 9',
      'student: 1 · admin: 1',
      'daripada 3,152',
      'Ketepatan: 95%',
      'Purata: 1m 0s',
      'Mood:0 Badge:0 Misi:0',
    ])
    w.unmount()
  })

  it('lists the school rows: GURU / LOGIN, colour, opacity and "-%"', async () => {
    const w = await mountDaily(false)
    const rows = w.findAll('[data-testid="cc-school-row"]')
    expect(texts(w, 'cc-school-name')).toEqual(['1. SMK CONTOH SATU', '2. SMK CONTOH EMPAT'])
    expect(rows[0]?.text()).toContain('GURU')
    expect(rows[1]?.text()).toContain('LOGIN')
    expect(texts(w, 'cc-school-accuracy')).toEqual(['95.0%', '-%'])
    expect(w.findAll('[data-testid="cc-school-accuracy"]')[0]?.classes()).toContain('text-success')
    w.unmount()
  })

  it('renders subjects, heatmap with its tooltip, feed, logins, top pupils, mood and badges', async () => {
    const w = await mountDaily(false)
    expect(w.find('[data-testid="cc-subjects-chart"]').exists()).toBe(true)
    expect(w.find('[data-testid="cc-heat-chart"]').exists()).toBe(true)
    expect(texts(w, 'cc-daily-feed-row')[0]).toContain('Pelajar Contoh Satu')
    expect(texts(w, 'cc-login-role')).toEqual(['admin', 'student', 'student', 'teacher'])
    expect(texts(w, 'cc-login-package')).toEqual(['ADMIN', 'SEKOLAH', 'FREE', 'SEKOLAH'])
    expect(texts(w, 'cc-login-school')).toEqual([
      'SMK CONTOH EMPAT',
      'Pelajar Luar',
      'SMK CONTOH EMPAT',
    ])
    const links = w.findAll('[data-testid="cc-login-name"]').map((e) => e.attributes('href'))
    expect(links).toEqual([
      undefined,
      '/admin/command-center/student/2017',
      '/admin/command-center/student/2030',
      '/admin/command-center/school/8080/teacher/1919',
    ])
    expect(texts(w, 'cc-daily-top-answers')).toEqual(['60 jwb'])
    expect(w.get('[data-testid="cc-panel-daily-mood"]').text()).toContain('Tiada data')
    expect(w.get('[data-testid="cc-panel-badges"]').text()).toContain('Tiada badge baru')
    w.unmount()
  })

  it('switches tab: new request, label per tab, heatmap only on today, drill closed', async () => {
    const w = await mountDaily(false)
    await get(w, 'cc-school-row').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="cc-drill"]').exists()).toBe(true)

    api.fetchCcDailyActivity.mockResolvedValue(platformDaily({ period: 'week' }))
    await tab(w, 'week').trigger('click')
    await flushPromises()
    expect(api.fetchCcDailyActivity).toHaveBeenLastCalledWith('week', expect.anything())
    expect(texts(w, 'cc-pulse-label')[1]).toBe('Login Minggu Ini')
    expect(w.find('[data-testid="cc-panel-heatmap"]').exists()).toBe(false)
    expect(w.find('[data-testid="cc-drill"]').exists()).toBe(false)

    await tab(w, 'month').trigger('click')
    await flushPromises()
    expect(texts(w, 'cc-pulse-label')[1]).toBe('Login Bulan Ini')
    await tab(w, 'today').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="cc-panel-heatmap"]').exists()).toBe(true)
    w.unmount()
  })

  it('toggles the school drill with its sections, links and "Lihat penuh →"', async () => {
    const w = await mountDaily(false)
    await get(w, 'cc-school-row').trigger('click')
    await flushPromises()
    expect(api.fetchCcSchoolDrill).toHaveBeenCalledWith(8082, 'today', expect.anything())
    expect(get(w, 'cc-drill-teachers').text()).toContain('Guru Aktif (1)')
    expect(get(w, 'cc-drill-teacher').text()).toContain('9 pelajar')
    expect(get(w, 'cc-drill-teacher').text()).toContain('80.2%')
    expect(get(w, 'cc-drill-teacher').find('a').attributes('href')).toBe(
      '/admin/command-center/school/8082/teacher/1919',
    )
    expect(get(w, 'cc-drill-students').text()).toContain('Pelajar (1)')
    expect(get(w, 'cc-drill-student').text()).toContain('60 soalan')
    expect(get(w, 'cc-drill-students').find('a').attributes('href')).toBe(
      '/admin/command-center/student/2022',
    )
    expect(get(w, 'cc-drill-logins').text()).toContain('Login (1)')
    expect(get(w, 'cc-drill-full').text()).toBe('Lihat penuh →')
    expect(get(w, 'cc-drill-full').attributes('href')).toBe('/admin/command-center/school/8082')

    await get(w, 'cc-school-row').trigger('click')
    expect(w.find('[data-testid="cc-drill"]').exists()).toBe(false)
    w.unmount()
  })

  it('shows "Tiada data terperinci" for an empty drill and "Gagal" for a failed one', async () => {
    api.fetchCcSchoolDrill.mockResolvedValueOnce(
      drillData({ teachers: [], students: [], logins: [] }),
    )
    const w = await mountDaily(false)
    await get(w, 'cc-school-row').trigger('click')
    await flushPromises()
    expect(get(w, 'cc-drill-empty').text()).toBe('Tiada data terperinci')

    await get(w, 'cc-school-row').trigger('click')
    api.fetchCcSchoolDrill.mockRejectedValueOnce(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x' }),
    )
    await get(w, 'cc-school-row').trigger('click')
    await flushPromises()
    expect(get(w, 'cc-drill-error').text()).toBe('Gagal')
    w.unmount()
  })

  it('reloads the current period every 30 s and keeps the open drill', async () => {
    const w = await mountDaily(false)
    await get(w, 'cc-school-row').trigger('click')
    await flushPromises()
    expect(api.fetchCcDailyActivity).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(api.fetchCcDailyActivity).toHaveBeenCalledTimes(2)
    expect(api.fetchCcDailyActivity).toHaveBeenLastCalledWith('today', expect.anything())
    expect(w.find('[data-testid="cc-drill"]').exists()).toBe(true)
    w.unmount()
  })

  it('shows the empty copy of every list', async () => {
    api.fetchCcDailyActivity.mockResolvedValue(
      platformDaily({
        schools: [],
        subjectBreakdown: [],
        hourlyHeatmap: {},
        liveFeed: [],
        topStudents: [],
        logins: { total: 0, byRole: {}, recent: [] },
      }),
    )
    const w = await mountDaily(false)
    expect(get(w, 'cc-schools-empty').text()).toBe('Tiada aktiviti')
    expect(texts(w, 'cc-empty')).toEqual([
      '-',
      'Tiada data',
      'Tiada aktiviti',
      'Tiada login',
      'Tiada data',
      'Tiada data',
      'Tiada badge baru',
    ])
    w.unmount()
  })

  it('shows "Gagal memuatkan" in the lists when the load fails', async () => {
    api.fetchCcDailyActivity.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x' }),
    )
    const w = await mountDaily(false)
    expect(w.findAll('[data-testid="daily-error"]').length).toBeGreaterThan(3)
    expect(get(w, 'daily-error').text()).toBe('Gagal memuatkan')
    w.unmount()
  })

  it('shows the 403 outcome when the first load is refused', async () => {
    api.fetchCcDailyActivity.mockRejectedValue(
      new ApiError({ status: 403, code: 'FORBIDDEN', message: 'x' }),
    )
    const w = await mountDaily(true)
    expect(useRouteOutcome().value).toBe(403)
    w.unmount()
  })
})

describe('S3 Admin Sekolah alias', () => {
  it('titles the page "AKTIVITI SEKOLAH", hides the school list and the report link', async () => {
    api.fetchCcDailyActivity.mockResolvedValue(schoolDaily())
    const w = await mountDaily(true)
    expect(get(w, 'cc-s3-subtitle').text()).toBe('Aktiviti Sekolah')
    expect(get(w, 'cc-s3-back').attributes('href')).toBe('/admin-sekolah/command-center')
    expect(w.find('[data-testid="cc-s3-report"]').exists()).toBe(false)
    expect(w.find('[data-testid="cc-panel-schools"]').exists()).toBe(false)
    expect(texts(w, 'cc-pulse-sub')[0]).toBe('daripada 1')
    expect(w.text()).not.toContain('AKTIVITI PLATFORM')
    expect(w.findAll('[data-testid="cc-daily-top-name"]').map((e) => e.attributes('href'))).toEqual(
      ['/admin-sekolah/command-center/student/2022'],
    )
    w.unmount()
  })
})
