// @vitest-environment jsdom
/**
 * S2 live-data failure (S6-T07): with no data yet, any failure shows the standard load error (DsLoadError, retry);
 * the 10 s poll keeps running; a failed poll after data keeps the old values silently (GLB-2).
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'

import CommandCenterBoardPage from '../../pages/CommandCenterBoardPage.vue'

const api = vi.hoisted(() => ({ fetchCcLiveData: vi.fn() }))
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
  generatedAt: '2026-10-21T00:00:00Z',
  scope: 'platform',
  school: null,
  totalSchools: 1,
  totalStudents: 1,
  activeStudents: 1,
  totalAnswered: 1,
  answeredToday: 1,
  answeredWeek: 1,
  answeredLastWeek: 1,
  weekChange: 0,
  accuracy: 50,
  topSchools: [],
  topStudents: [],
  gpsOverall: 0,
  kirk: { t1: { value: 0, scale: 5, count: 0 }, t2Accuracy: 0, t3Active: 0, t4Gps: 0 },
  engagement: { champion: 0, consistent: 0, developing: 0, minimum: 0, disengaged: 0 },
  dailyTrend: [],
  mood: { happy: 0, okay: 0, sad: 0, stressed: 0 },
  recentFeed: [],
  correction: { total: 0, avgImprovement: 0, improvedCount: 0, topImprovers: [] },
}
const err = (status: number) => new ApiError({ status, code: 'X', message: 'x' })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
  api.fetchCcLiveData.mockReset()
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('S2 live-data load error', () => {
  it.each([404, 500])(
    'shows the standard load error with retry on a %i and keeps polling',
    async (status) => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      api.fetchCcLiveData.mockRejectedValue(err(status))
      const w = await mountBoard()
      expect(w.find('[data-testid="cc-load-error"]').exists()).toBe(true)
      expect(w.text()).not.toContain('belum tersedia')
      await vi.advanceTimersByTimeAsync(20_000)
      expect(api.fetchCcLiveData).toHaveBeenCalledTimes(3)
      w.unmount()
    },
  )

  it('clears the error once a retry answers 200', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    api.fetchCcLiveData.mockRejectedValueOnce(err(500)).mockResolvedValue(LIVE)
    const w = await mountBoard()
    expect(w.find('[data-testid="cc-load-error"]').exists()).toBe(true)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(w.find('[data-testid="cc-load-error"]').exists()).toBe(false)
    w.unmount()
  })

  it('shows no error while live-data answers 200, and a later failed poll keeps the values silently', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    api.fetchCcLiveData.mockResolvedValueOnce(LIVE).mockRejectedValue(err(500))
    const w = await mountBoard()
    expect(w.find('[data-testid="cc-load-error"]').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(w.find('[data-testid="cc-load-error"]').exists()).toBe(false)
    w.unmount()
  })
})
