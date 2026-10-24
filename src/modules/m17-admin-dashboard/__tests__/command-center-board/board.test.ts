// @vitest-environment jsdom
/**
 * M17-T3b component tests: S2 (FR-M17-20..33) and its Admin Sekolah alias (FR-M17-101..112) against a mocked
 * client. Exact BM copy, placeholders, polling, failed poll, empty states, week-change branches, links under
 * the alias prefix and the school-only copy. Data-driven figures of the mock are covered by the E2E smoke.
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'

import type { CcLiveData } from '../../api/command-center-board-types'
import CommandCenterBoardPage from '../../pages/CommandCenterBoardPage.vue'
import { platformLive, schoolLive } from './fixtures'

const api = vi.hoisted(() => ({ fetchCcLiveData: vi.fn() }))
vi.mock('../../api/command-center-board', async (importActual) => ({
  ...(await importActual<typeof import('../../api/command-center-board')>()),
  fetchCcLiveData: api.fetchCcLiveData,
}))

async function mountBoard(alias: boolean): Promise<VueWrapper> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/')
  await router.isReady()
  const wrapper = mount(CommandCenterBoardPage, { props: { alias }, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

const text = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`).text()
const texts = (w: VueWrapper, id: string) => w.findAll(`[data-testid="${id}"]`).map((e) => e.text())
/** Lets the 800 ms counter animation end. */
const settle = () => vi.advanceTimersByTimeAsync(1000)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
  vi.setSystemTime(new Date('2026-09-25T15:40:00+08:00'))
  api.fetchCcLiveData.mockReset()
  setRouteOutcome(null)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('S2 admin board', () => {
  it('shows the server placeholders until the first response (FN-M17-3.1.2)', async () => {
    api.fetchCcLiveData.mockReturnValue(new Promise(() => undefined))
    const w = await mountBoard(false)
    expect(texts(w, 'cc-kpi-value')).toEqual(['--', '--', '--', '--'])
    expect(text(w, 'cc-alesa')).toBe('Memuatkan wawasan...')
    expect(w.text()).toContain('Memuatkan...')
    expect(text(w, 'cc-clock')).toBe('15:40:00')
    w.unmount()
  })

  it('renders header, counters, panels and footer with the exact copy', async () => {
    api.fetchCcLiveData.mockResolvedValue(platformLive())
    const w = await mountBoard(false)
    await settle()

    expect(text(w, 'cc-title')).toBe('PrestasiPlus Command Center')
    expect(text(w, 'cc-live-badge')).toBe('LIVE')
    expect(text(w, 'cc-s2-back')).toBe('Papan Pemuka')
    expect(w.get('[data-testid="cc-s2-back"]').attributes('href')).toBe('/admin')
    expect(w.get('[data-testid="cc-s2-daily"]').attributes('href')).toBe(
      '/admin/command-center/daily-activity',
    )
    expect(w.find('[data-testid="cc-s2-subtitle"]').exists()).toBe(false)

    expect(texts(w, 'cc-kpi-value')).toEqual(['9', '3,152', '477,743', '82.9%'])
    expect(texts(w, 'cc-kpi-sub')).toEqual([
      'langganan aktif',
      '1,563 aktif menjawab',
      'sepanjang masa',
      'keseluruhan platform',
    ])
    expect(texts(w, 'cc-top-school-count')).toEqual([
      '393 plj',
      '345 plj',
      '306 plj',
      '174 plj',
      '134 plj',
    ])
    expect(w.get('[data-testid="cc-top-school-link"]').attributes('href')).toBe(
      '/admin/command-center/school/8082',
    )
    expect(texts(w, 'cc-kirk-text')).toEqual([
      '★★★★★ 4.6/5',
      '82.9% ketepatan',
      '91 aktif 30h',
      'GPS 2.880',
    ])
    expect(text(w, 'cc-alesa')).toBe(
      '"Platform menunjukkan penurunan 67% minggu ini. 3.6% pelajar terlibat aktif. ' +
        'Ketepatan purata 82.9% dengan 9 sekolah aktif. GPS keseluruhan: 2.88."',
    )
    expect(text(w, 'cc-today-bar')).toBe('340 soalan')
    expect(text(w, 'cc-week')).toBe('Minggu ini: 2,508')
    expect(text(w, 'cc-change')).toBe('▼ -67% vs minggu lepas')
    expect(w.get('[data-testid="cc-change"]').classes()).toContain('text-error')
    expect(texts(w, 'cc-medal')).toEqual(['1', '2', '3', '4', '5'])
    expect(texts(w, 'cc-top-pupil-stat')[0]).toBe('452 jwb · 99.6%')
    expect(w.get('[data-testid="cc-top-pupil-link"]').attributes('href')).toBe(
      '/admin/command-center/student/2022',
    )
    expect(texts(w, 'cc-mood-count')).toEqual(['307', '280', '72', '91'])
    expect([
      ...texts(w, 'cc-correction-total'),
      ...texts(w, 'cc-correction-avg'),
      ...texts(w, 'cc-correction-rate'),
    ]).toEqual(['899Rekod', '+0.0%Purata Naik', '0%Kadar Baik'])
    expect(w.text()).not.toContain('Top Improvers')
    expect(w.find('[data-testid="cc-engagement-bands"]').exists()).toBe(true)
    expect(text(w, 'cc-footer')).toBe(
      'Dikuasakan oleh ALESA AI · PrestasiPlus © 2026 · Dijana automatik · Data dikemaskini setiap 10 saat',
    )
    w.unmount()
  })

  it('places the panels as live: column 2 ends with Mood, column 3 holds Pembetulan alone (S2 desktop)', async () => {
    api.fetchCcLiveData.mockResolvedValue(platformLive())
    const w = await mountBoard(false)
    const ids = (col: string) =>
      w
        .findAll(`[data-testid="${col}"] > [data-testid^="cc-panel"]`)
        .map((e) => e.attributes('data-testid'))
    expect(ids('cc-col-1')).toEqual([
      'cc-panel-top-schools',
      'cc-panel-kirkpatrick',
      'cc-panel-alesa',
    ])
    expect(ids('cc-col-2')).toEqual([
      'cc-panel-today',
      'cc-panel-feed',
      'cc-panel-top-pupils',
      'cc-panel-mood',
    ])
    expect(ids('cc-col-3')).toEqual(['cc-panel-correction'])
    w.unmount()
  })

  it('abbreviates the feed school name to SMK with the full name in title and escapes names', async () => {
    api.fetchCcLiveData.mockResolvedValue(platformLive())
    const w = await mountBoard(false)
    const school = w.get('[data-testid="cc-feed-school"]')
    expect(school.text()).toBe('SMK CONTOH SATU')
    expect(school.attributes('title')).toBe('SEKOLAH MENENGAH KEBANGSAAN CONTOH SATU')
    expect(school.attributes('href')).toBe('/admin/command-center/school/8082')
    const name = w.get('[data-testid="cc-feed-name"]')
    expect(name.text()).toBe('Pelajar <b>Contoh</b>')
    expect(name.find('b').exists()).toBe(false)
    expect(texts(w, 'cc-feed-mark')).toEqual(['✓', '✗'])
    w.unmount()
  })

  it('animates the big counters over 800 ms and ticks the clock every second', async () => {
    api.fetchCcLiveData.mockResolvedValue(platformLive())
    const w = await mountBoard(false)
    await vi.advanceTimersByTimeAsync(400)
    const mid = texts(w, 'cc-kpi-value')[2] ?? ''
    expect(mid).not.toBe('477,743')
    expect(mid).not.toBe('--')
    await vi.advanceTimersByTimeAsync(600)
    expect(texts(w, 'cc-kpi-value')[2]).toBe('477,743')
    expect(text(w, 'cc-clock')).toBe('15:40:01')
    w.unmount()
  })

  it('polls every 10 s and keeps the previous values (logging "Fetch error:") when a poll fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    api.fetchCcLiveData.mockResolvedValueOnce(platformLive())
    const w = await mountBoard(false)
    await settle()
    expect(api.fetchCcLiveData).toHaveBeenCalledTimes(1)

    api.fetchCcLiveData.mockRejectedValueOnce(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x' }),
    )
    await vi.advanceTimersByTimeAsync(10_000)
    expect(api.fetchCcLiveData).toHaveBeenCalledTimes(2)
    expect(error).toHaveBeenCalledWith('Fetch error:', expect.anything())
    expect(texts(w, 'cc-kpi-value')[2]).toBe('477,743')

    api.fetchCcLiveData.mockResolvedValueOnce(platformLive({ totalAnswered: 477744 }))
    await vi.advanceTimersByTimeAsync(10_000)
    await settle()
    expect(texts(w, 'cc-kpi-value')[2]).toBe('477,744')
    w.unmount()
  })

  it('aborts a hung poll after 15 s so the next tick still runs (the in-flight skip stays)', async () => {
    vi.useFakeTimers({
      toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'],
    })
    vi.setSystemTime(new Date('2026-09-25T15:40:00+08:00'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const signals: AbortSignal[] = []
    api.fetchCcLiveData.mockImplementation((o: { signal: AbortSignal }) => {
      signals.push(o.signal)
      return signals.length === 1
        ? new Promise((_, reject) =>
            o.signal.addEventListener('abort', () => reject(new Error('aborted'))),
          )
        : Promise.resolve(platformLive())
    })
    const w = await mountBoard(false)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(api.fetchCcLiveData).toHaveBeenCalledTimes(1) // the hung request skips the tick
    await vi.advanceTimersByTimeAsync(5_000)
    expect(signals[0]?.aborted).toBe(true)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(api.fetchCcLiveData).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1000)
    expect(texts(w, 'cc-kpi-value')[2]).toBe('477,743')
    w.unmount()
  })

  it('starts an interrupted counter animation from the value on screen', async () => {
    api.fetchCcLiveData.mockResolvedValueOnce(platformLive({ totalAnswered: 1000 }))
    const w = await mountBoard(false)
    await vi.advanceTimersByTimeAsync(1000)
    expect(texts(w, 'cc-kpi-value')[2]).toBe('1,000')
    api.fetchCcLiveData.mockResolvedValueOnce(platformLive({ totalAnswered: 2000 }))
    await vi.advanceTimersByTimeAsync(9000) // the poll fires 10 s after mount
    await vi.advanceTimersByTimeAsync(400)
    const mid = Number((texts(w, 'cc-kpi-value')[2] ?? '').replace(/,/g, ''))
    expect(mid).toBeGreaterThan(1000)
    expect(mid).toBeLessThan(2000)
    api.fetchCcLiveData.mockResolvedValueOnce(platformLive({ totalAnswered: 500 }))
    await vi.advanceTimersByTimeAsync(10_000)
    await vi.advanceTimersByTimeAsync(1000)
    expect(texts(w, 'cc-kpi-value')[2]).toBe('500')
    w.unmount()
  })

  it('shows the empty copy for no schools, no pupils and no feed', async () => {
    api.fetchCcLiveData.mockResolvedValue(
      platformLive({ topSchools: [], topStudents: [], recentFeed: [] }),
    )
    const w = await mountBoard(false)
    expect(texts(w, 'cc-empty')).toEqual(['Tiada data', 'Tiada aktiviti terkini', 'Tiada data'])
    w.unmount()
  })

  it('rises and equal week change branches (BR-M17-07)', async () => {
    api.fetchCcLiveData.mockResolvedValue(platformLive({ weekChange: 12 }))
    let w = await mountBoard(false)
    expect(text(w, 'cc-change')).toBe('▲ +12% vs minggu lepas')
    expect(w.get('[data-testid="cc-change"]').classes()).toContain('text-success')
    expect(text(w, 'cc-alesa')).toContain('peningkatan 12%')
    w.unmount()

    api.fetchCcLiveData.mockResolvedValue(platformLive({ weekChange: 0 }))
    w = await mountBoard(false)
    expect(text(w, 'cc-change')).toBe('Sama dengan minggu lepas')
    expect(text(w, 'cc-alesa')).toContain('stabil 0%')
    w.unmount()
  })

  it('renders the 403 page outcome when the first load is refused', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    api.fetchCcLiveData.mockRejectedValue(
      new ApiError({ status: 403, code: 'FORBIDDEN', message: 'x' }),
    )
    const w = await mountBoard(true)
    expect(useRouteOutcome().value).toBe(403)
    w.unmount()
  })
})

describe('S2 Admin Sekolah alias', () => {
  const load = async (over: Partial<CcLiveData> = {}) => {
    api.fetchCcLiveData.mockResolvedValue(schoolLive(over))
    const w = await mountBoard(true)
    await settle()
    return w
  }

  it('reflows without "Sekolah Teratas": Mood moves under Pembetulan so no column has a hole', async () => {
    const w = await load()
    const ids = (col: string) =>
      w
        .findAll(`[data-testid="${col}"] > [data-testid^="cc-panel"]`)
        .map((e) => e.attributes('data-testid'))
    expect(ids('cc-col-1')).toEqual(['cc-panel-kirkpatrick', 'cc-panel-alesa'])
    expect(ids('cc-col-2')).toEqual(['cc-panel-today', 'cc-panel-feed', 'cc-panel-top-pupils'])
    expect(ids('cc-col-3')).toEqual(['cc-panel-correction', 'cc-panel-mood'])
    w.unmount()
  })

  it('shows the school copy, hides "Sekolah Teratas" and never says "keseluruhan platform"', async () => {
    const w = await load()
    expect(text(w, 'cc-s2-subtitle')).toBe('Pemantauan langsung sekolah anda')
    expect(texts(w, 'cc-kpi-sub')[3]).toBe('sekolah anda')
    expect(w.find('[data-testid="cc-panel-top-schools"]').exists()).toBe(false)
    expect(w.text()).not.toContain('keseluruhan platform')
    expect(w.text()).not.toContain('Sekolah Teratas')
    expect(texts(w, 'cc-kpi-value')).toEqual(['1', '12', '3', '66.7%'])
    expect(text(w, 'cc-alesa')).toContain('Sekolah anda menunjukkan stabil 0%')
    expect(w.text()).not.toContain('Platform menunjukkan')
    w.unmount()
  })

  it('links the header and the drill-down under the alias prefix', async () => {
    const w = await load()
    expect(w.get('[data-testid="cc-s2-back"]').attributes('href')).toBe('/admin-sekolah')
    expect(w.get('[data-testid="cc-s2-daily"]').attributes('href')).toBe(
      '/admin-sekolah/command-center/daily-activity',
    )
    expect(w.get('[data-testid="cc-feed-school"]').attributes('href')).toBe(
      '/admin-sekolah/command-center/school/900001',
    )
    expect(w.get('[data-testid="cc-top-pupil-link"]').attributes('href')).toBe(
      '/admin-sekolah/command-center/student/5001',
    )
    w.unmount()
  })

  it('shows zeros for "Pembetulan" and the school own 7 days under "Engagement"', async () => {
    const w = await load()
    expect([
      ...texts(w, 'cc-correction-total'),
      ...texts(w, 'cc-correction-avg'),
      ...texts(w, 'cc-correction-rate'),
    ]).toEqual(['0Rekod', '+0.0%Purata Naik', '0%Kadar Baik'])
    expect(w.find('[data-testid="cc-engagement-days"]').exists()).toBe(true)
    expect(w.find('[data-testid="cc-engagement-bands"]').exists()).toBe(false)
    w.unmount()
  })

  it('renders zeros and empty states for a school without activity', async () => {
    const w = await load({
      totalAnswered: 0,
      answeredToday: 0,
      answeredWeek: 0,
      accuracy: 0,
      activeStudents: 0,
      recentFeed: [],
      topStudents: [],
    })
    expect(texts(w, 'cc-kpi-value')[2]).toBe('0')
    expect(texts(w, 'cc-empty')).toEqual(['Tiada aktiviti terkini', 'Tiada data'])
    expect(text(w, 'cc-today-bar')).toBe('0 soalan')
    w.unmount()
  })
})
