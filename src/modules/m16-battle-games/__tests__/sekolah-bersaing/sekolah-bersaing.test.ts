// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import SekolahBersaingPage from '../../pages/SekolahBersaingPage.vue'
import routes from '../../routes/sekolah-bersaing'

const api = vi.hoisted(() => ({ fetchSekolahBersaing: vi.fn() }))
vi.mock('../../api', () => api)

type Row = {
  rank: number
  schoolName: string
  state: string
  aktifPct: number
  streakAvg: number
  notaPer10: number
  anonymous: boolean
}

function row(rank: number, over: Partial<Row> = {}): Row {
  return {
    rank,
    schoolName: `Sekolah ${String(rank)}`,
    state: 'Kelantan',
    aktifPct: 0,
    streakAvg: 15,
    notaPer10: 0,
    anonymous: false,
    ...over,
  }
}

const week = (rows: Row[], weekStart = '2026-09-21') => ({ weekStart, count: rows.length, rows })

let wrapper: VueWrapper | undefined
let router: Router

async function open(url: string) {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/sekolah-bersaing', component: SekolahBersaingPage }],
  })
  await router.push(url)
  await router.isReady()
  wrapper = mount(SekolahBersaingPage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  api.fetchSekolahBersaing.mockResolvedValue(
    week([row(1), row(2), row(3), row(4, { aktifPct: 0.5, streakAvg: 1.6, notaPer10: 2.3 })]),
  )
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('route (FR-M16-127, DV-M16-02, roles-matrix L50)', () => {
  it('uses the user shell for every role, with the live tab title', () => {
    const r = routes.find((x) => x.path === '/sekolah-bersaing')
    expect(r?.meta).toMatchObject({
      layout: 'user',
      access: 'auth',
      title: 'Sekolah Bersaing — Leaderboard Mingguan',
      header: { title: 'Sekolah Bersaing', subtitle: 'Selamat datang kembali' },
    })
    expect(r?.meta?.roles).toBeUndefined()
    expect(r?.meta?.onForbidden).toBeUndefined()
  })
})

describe('S28 SekolahBersaingPage', () => {
  it('renders the hero, the week line, the header row, the rows and the footer tip', async () => {
    const w = await open('/sekolah-bersaing')
    expect(w.get('h1').text()).toBe('🏆 Sekolah Bersaing')
    expect(w.get('[data-testid="sb-hero"]').text()).toContain(
      'Leaderboard mingguan — bandingkan sekolah-sekolah di Malaysia. Anda rasa bangga? Kongsi.',
    )
    expect(w.get('[data-testid="sb-week"]').text()).toBe(
      'Minggu 21 Sep 2026 · 4 sekolah dalam pertandingan',
    )
    expect(
      w
        .get('[data-testid="sb-header"]')
        .findAll('div')
        .map((d) => d.text()),
    ).toEqual(['#', 'Sekolah', '% Aktif', 'Streak Avg', 'Nota/Pelajar'])
    const rows = w.findAll('[data-testid="sb-row"]')
    expect(rows).toHaveLength(4)
    expect(rows.map((r) => r.get('[data-testid="sb-rank"]').text())).toEqual([
      '🥇',
      '🥈',
      '🥉',
      '#4',
    ])
    expect(rows[0]?.get('[data-testid="sb-school"]').text()).toBe('Sekolah 1')
    expect(rows[0]?.get('[data-testid="sb-state"]').text()).toBe('Kelantan')
    expect(rows[0]?.get('[data-testid="sb-aktif"]').text()).toBe('0.0%aktif')
    expect(rows[0]?.get('[data-testid="sb-streak"]').text()).toBe('🔥 15.0hari')
    expect(rows[0]?.get('[data-testid="sb-nota"]').text()).toBe('0.0per 10')
    expect(rows[3]?.get('[data-testid="sb-aktif"]').text()).toBe('0.5%aktif')
    expect(rows[3]?.get('[data-testid="sb-streak"]').text()).toBe('🔥 1.6hari')
    expect(rows[3]?.get('[data-testid="sb-nota"]').text()).toBe('2.3per 10')
    const tip = w.get('[data-testid="sb-tip"]').text()
    expect(tip).toContain('💡 Untuk Cikgu Besar / PIBG:')
    expect(tip).toContain('Share ranking ini ke parent group WhatsApp.')
    expect(tip).toContain('"Sekolah anonim"')
  })

  it('styles the top three gold / silver / bronze', async () => {
    const w = await open('/sekolah-bersaing')
    const rows = w.findAll('[data-testid="sb-row"]')
    expect(rows[0]?.classes()).toContain('gold')
    expect(rows[1]?.classes()).toContain('silver')
    expect(rows[2]?.classes()).toContain('bronze')
    expect(rows[3]?.classes()).not.toContain('gold')
  })

  it('hides "Streak Avg" and "Nota/Pelajar" below 768 px (md:block)', async () => {
    const w = await open('/sekolah-bersaing')
    const cells = [
      ...w.findAll('[data-testid="sb-streak"]'),
      ...w.findAll('[data-testid="sb-nota"]'),
      ...w.get('[data-testid="sb-header"]').findAll('div.hidden'),
    ]
    expect(cells.length).toBeGreaterThan(2)
    for (const c of cells) {
      expect(c.classes()).toContain('hidden')
      expect(c.classes()).toContain('md:block')
    }
  })

  it('an anonymous school shows "Sekolah anonim" and no state', async () => {
    api.fetchSekolahBersaing.mockResolvedValue(
      week([row(1, { anonymous: true, schoolName: 'Rahsia' })]),
    )
    const w = await open('/sekolah-bersaing')
    expect(w.get('[data-testid="sb-school"]').text()).toBe('Sekolah anonim')
    expect(w.text()).not.toContain('Rahsia')
    expect(w.find('[data-testid="sb-state"]').exists()).toBe(false)
  })

  it('a week without a snapshot shows the hero and the empty state', async () => {
    api.fetchSekolahBersaing.mockResolvedValue(week([], '2025-01-06'))
    const w = await open('/sekolah-bersaing?week=2025-01-06')
    expect(w.get('h1').text()).toBe('🏆 Sekolah Bersaing')
    expect(w.get('[data-testid="sb-empty"]').text()).toContain('📊 Data minggu ini belum dijana.')
    expect(w.get('[data-testid="sb-empty"]').text()).toContain(
      'Cron mingguan akan kira pada Isnin pagi. Tunggu kejap ya.',
    )
    expect(w.find('[data-testid="sb-table"]').exists()).toBe(false)
    expect(w.find('[data-testid="sb-tip"]').exists()).toBe(false)
  })

  it("passes ?week= to #50 as typed (Monday normalisation and invalid values are the API's)", async () => {
    await open('/sekolah-bersaing?week=2026-09-16')
    expect(api.fetchSekolahBersaing).toHaveBeenCalledWith('2026-09-16', expect.anything())
    wrapper?.unmount()
    await open('/sekolah-bersaing')
    expect(api.fetchSekolahBersaing).toHaveBeenLastCalledWith(undefined, expect.anything())
  })

  it('reloads when the week query changes', async () => {
    const w = await open('/sekolah-bersaing')
    api.fetchSekolahBersaing.mockResolvedValue(week([row(1)], '2026-09-14'))
    await router.push('/sekolah-bersaing?week=2026-09-14')
    await flushPromises()
    expect(api.fetchSekolahBersaing).toHaveBeenCalledTimes(2)
    expect(w.get('[data-testid="sb-week"]').text()).toBe(
      'Minggu 14 Sep 2026 · 1 sekolah dalam pertandingan',
    )
  })

  it('shows the load error with a working retry', async () => {
    api.fetchSekolahBersaing.mockRejectedValueOnce(new Error('boom'))
    const w = await open('/sekolah-bersaing')
    expect(w.find('[data-testid="m16-load-error"]').exists()).toBe(true)
    await w.get('[data-testid="m16-retry"]').trigger('click')
    await flushPromises()
    expect(w.findAll('[data-testid="sb-row"]')).toHaveLength(4)
  })
})
