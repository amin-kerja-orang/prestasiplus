// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import type { Leaderboard } from '../../api/types'
import LeaderboardPage from '../../pages/LeaderboardPage.vue'

const api = vi.hoisted(() => ({ fetchLeaderboard: vi.fn() }))
vi.mock('../../api/performance', () => api)

function board(extra: Partial<Leaderboard> = {}): Leaderboard {
  const rows = Array.from({ length: 5 }, (_, i) => ({
    rank: i + 1,
    userId: null,
    name: `Pelajar Demo ${String(i + 1)}`,
    avatarUrl: null,
    coins: 1547 - i * 100,
    sessions: 30 - i,
    accuracy: [98, 89, 99, 68, 59.6][i] as number,
  }))
  return {
    period: 'week',
    me: { rank: null, coins: 0, sessions: 0, accuracy: 0 },
    rows,
    participants: rows.length,
    ...extra,
  }
}

let wrapper: VueWrapper | null = null
let router: Router

async function render(url = '/leaderboard'): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/leaderboard', component: LeaderboardPage }],
  })
  await router.push(url)
  wrapper = mount(LeaderboardPage, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  api.fetchLeaderboard.mockReset()
  api.fetchLeaderboard.mockResolvedValue(board())
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('LeaderboardPage (M08 S20)', () => {
  it('shows the hero and the period links, the week active by default', async () => {
    const w = await render()
    expect(w.get('h2').text()).toBe('Papan Pendahulu')
    expect(w.get('[data-testid=leaderboard-hero]').text()).toContain('Siapa juara minggu ini?')
    const tabs = w.findAll('[data-testid=leaderboard-tabs] a')
    expect(tabs.map((t) => t.text())).toEqual(['Semua Masa', 'Minggu Ini', 'Bulan Ini'])
    expect(tabs.map((t) => t.attributes('data-active'))).toEqual(['false', 'true', 'false'])
    expect(tabs.map((t) => t.attributes('href'))).toEqual([
      '/leaderboard?period=all',
      '/leaderboard?period=week',
      '/leaderboard?period=month',
    ])
    expect(api.fetchLeaderboard).toHaveBeenLastCalledWith('week', expect.anything())
  })

  it('treats an unknown period as the week and passes a known one through', async () => {
    await render('/leaderboard?period=xyz')
    expect(api.fetchLeaderboard).toHaveBeenLastCalledWith('week', expect.anything())
    wrapper?.unmount()
    const w = await render('/leaderboard?period=month')
    expect(api.fetchLeaderboard).toHaveBeenLastCalledWith('month', expect.anything())
    expect(
      w.findAll('[data-testid=leaderboard-tabs] a').map((t) => t.attributes('data-active')),
    ).toEqual(['false', 'false', 'true'])
  })

  it('shows "#-", 0, 0, 0% for an unranked viewer', async () => {
    const w = await render()
    expect(w.get('[data-testid=me-rank]').text()).toBe('#-')
    expect(w.get('[data-testid=me-coins]').text()).toBe('0')
    expect(w.get('[data-testid=me-sessions]').text()).toBe('0')
    expect(w.get('[data-testid=me-accuracy]').text()).toBe('0%')
  })

  it('shows the viewer position with separators and a rounded accuracy', async () => {
    api.fetchLeaderboard.mockResolvedValue(
      board({ me: { rank: 1050, coins: 12345, sessions: 4, accuracy: 21.8 } }),
    )
    const w = await render('/leaderboard?period=all')
    expect(w.get('[data-testid=me-rank]').text()).toBe('#1050')
    expect(w.get('[data-testid=me-coins]').text()).toBe('12,345')
    expect(w.get('[data-testid=me-accuracy]').text()).toBe('22%')
  })

  it('orders the podium 2-1-3 with the crown on rank 1', async () => {
    const w = await render()
    const names = w.findAll('[data-testid=podium-name]').map((n) => n.text())
    expect(names).toEqual(['Pelajar Demo 2', 'Pelajar Demo 1', 'Pelajar Demo 3'])
    expect(w.get('[data-testid=podium-1]').text()).toContain('👑')
    expect(w.get('[data-testid=podium-2]').text()).not.toContain('👑')
    expect(w.get('[data-testid=podium-1] [data-testid=podium-accuracy]').text()).toBe(
      '98% ketepatan',
    )
    expect(w.get('[data-testid=podium-1] [data-testid=podium-coins]').text()).toBe('1,547')
    expect(w.findAll('[data-testid=podium-base]').map((b) => b.text())).toEqual(['2', '1', '3'])
  })

  it('renders the table with the responsive columns, plain names and colour pills', async () => {
    const w = await render()
    expect(w.findAll('thead th').map((th) => th.text())).toEqual([
      '#',
      'Pelajar',
      'Koin',
      'Sesi',
      'Ketepatan',
    ])
    const heads = w.findAll('thead th')
    expect(heads[3]?.classes()).toEqual(expect.arrayContaining(['hidden', 'md:table-cell']))
    expect(heads[4]?.classes()).toEqual(expect.arrayContaining(['hidden', 'lg:table-cell']))
    expect(w.find('[data-testid=leaderboard-table] a').exists()).toBe(false)
    const rows = w.findAll('[data-testid=leaderboard-row]')
    expect(rows).toHaveLength(5)
    const pill = (i: number) => rows[i]?.get('[data-testid=row-accuracy]').classes() ?? []
    expect(pill(0)).toContain('bg-green-100')
    expect(pill(3)).toContain('bg-amber-100')
    expect(pill(4)).toContain('bg-red-100')
    expect(rows[4]?.get('[data-testid=row-accuracy]').text()).toBe('60%')
    expect(rows[0]?.get('[data-testid=row-rank]').classes()).toContain('bg-amber-100')
  })

  it('shows the footer count and the real-time note', async () => {
    const w = await render()
    expect(w.get('[data-testid=leaderboard-footer]').text()).toBe(
      '5 peserta bersaing Dikemaskini real-time',
    )
    expect(w.get('[data-testid=leaderboard-footer] .hidden').classes()).toContain('md:inline-flex')
  })

  it('shows the load error with a retry', async () => {
    api.fetchLeaderboard.mockRejectedValueOnce(new Error('boom'))
    const w = await render()
    expect(w.get('[data-testid=leaderboard-error]').text()).toContain('Maaf, berlaku ralat.')
    await w.get('[data-testid=leaderboard-retry]').trigger('click')
    await flushPromises()
    expect(w.findAll('[data-testid=leaderboard-row]')).toHaveLength(5)
  })
})
