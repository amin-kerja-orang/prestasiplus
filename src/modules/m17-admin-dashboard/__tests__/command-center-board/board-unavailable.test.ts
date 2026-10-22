// @vitest-environment jsdom
/**
 * P3 demo polish: in http mode a 404 from `live-data` (endpoint not built yet) stops the 10 s poll and shows
 * "Fungsi ini belum tersedia dalam demo"; any other failure (500) keeps polling as before.
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'

import CommandCenterBoardPage from '../../pages/CommandCenterBoardPage.vue'

const api = vi.hoisted(() => ({ fetchCcLiveData: vi.fn(), http: { value: true } }))
vi.mock('@/api/mode', () => ({ isHttpMode: () => api.http.value }))
vi.mock('../../api/command-center-board', async (importActual) => ({
  ...(await importActual<typeof import('../../api/command-center-board')>()),
  fetchCcLiveData: api.fetchCcLiveData,
}))

async function mountBoard(): Promise<VueWrapper> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/')
  await router.isReady()
  const wrapper = mount(CommandCenterBoardPage, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

const LIVE = {
  generatedAt: '2026-10-21T00:00:00Z', scope: 'platform', school: null, totalSchools: 1, totalStudents: 1,
  activeStudents: 1, totalAnswered: 1, answeredToday: 1, answeredWeek: 1, answeredLastWeek: 1, weekChange: 0,
  accuracy: 50, topSchools: [], topStudents: [], gpsOverall: 0,
  kirk: { t1: { value: 0, scale: 5, count: 0 }, t2Accuracy: 0, t3Active: 0, t4Gps: 0 },
  engagement: { champion: 0, consistent: 0, developing: 0, minimum: 0, disengaged: 0 }, dailyTrend: [],
  mood: { happy: 0, okay: 0, sad: 0, stressed: 0 }, recentFeed: [],
  correction: { total: 0, avgImprovement: 0, improvedCount: 0, topImprovers: [] },
}
const err = (status: number) => new ApiError({ status, code: 'X', message: 'x' })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
  api.fetchCcLiveData.mockReset()
  api.http.value = true
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('S2 live-data unavailable (http mode)', () => {
  it('stops polling after the first 404 and shows the demo copy', async () => {
    api.fetchCcLiveData.mockRejectedValue(err(404))
    const w = await mountBoard()
    expect(w.get('[data-testid="cc-unavailable"]').text()).toContain(
      'Fungsi ini belum tersedia dalam demo',
    )
    await vi.advanceTimersByTimeAsync(60_000)
    expect(api.fetchCcLiveData).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('keeps polling with no banner while live-data answers 200 (BE-22)', async () => {
    api.fetchCcLiveData.mockResolvedValue(LIVE)
    const w = await mountBoard()
    await vi.advanceTimersByTimeAsync(20_000)
    expect(api.fetchCcLiveData).toHaveBeenCalledTimes(3)
    expect(w.find('[data-testid="cc-unavailable"]').exists()).toBe(false)
    w.unmount()
  })

  it('keeps polling and shows no demo copy on a 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    api.fetchCcLiveData.mockRejectedValue(err(500))
    const w = await mountBoard()
    await vi.advanceTimersByTimeAsync(20_000)
    expect(api.fetchCcLiveData).toHaveBeenCalledTimes(3)
    expect(w.find('[data-testid="cc-unavailable"]').exists()).toBe(false)
    w.unmount()
  })

  it('treats a 404 as before in mock mode', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    api.http.value = false
    api.fetchCcLiveData.mockRejectedValue(err(404))
    const w = await mountBoard()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(api.fetchCcLiveData).toHaveBeenCalledTimes(2)
    expect(w.find('[data-testid="cc-unavailable"]').exists()).toBe(false)
    w.unmount()
  })
})
