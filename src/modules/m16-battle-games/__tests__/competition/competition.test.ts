// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Component } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { clock, CLOCK_ANCHOR_MS } from '@/lib/time'

import { formatCountdown, formatPct, formatWeekRange } from '../../components/competition/format'
import PertandinganPage from '../../pages/PertandinganPage.vue'
import SambungKataPage from '../../pages/SambungKataPage.vue'
import UjiMindaPage from '../../pages/UjiMindaPage.vue'
import routes from '../../routes/permainan-extra'

const api = vi.hoisted(() => ({ fetchWeeklyCompetition: vi.fn(), fetchUjiMinda: vi.fn() }))
vi.mock('../../api', () => api)

const DAY = 86_400_000

function weekly(me: { rank: number; betul: number } | null) {
  return {
    weekStart: '2026-09-21',
    weekEnd: '2026-09-27',
    endsAt: '2026-09-27T23:59:59+08:00',
    prizes: [100, 50, 25],
    me,
    rows: [
      { rank: 1, userId: 2022, name: 'Murid Satu', sesi: 23, betul: 450, tepat: 99.6 },
      { rank: 2, userId: 2013, name: 'Murid Dua', sesi: 18, betul: 329, tepat: 99.3 },
      { rank: 3, userId: 2015, name: 'Murid Tiga', sesi: 15, betul: 187, tepat: 90.7 },
      { rank: 4, userId: 2016, name: 'Murid Empat', sesi: 4, betul: 118, tepat: 100 },
    ],
  }
}

let wrapper: VueWrapper | undefined

async function mountPage(component: Component, path = '/') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path, component },
      { path: '/:rest(.*)*', component: { template: '<i />' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  wrapper = mount(component, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  clock.setNow(CLOCK_ANCHOR_MS)
  api.fetchWeeklyCompetition.mockResolvedValue(weekly(null))
  api.fetchUjiMinda.mockResolvedValue({ challenge: null })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  clock.reset()
  vi.useRealTimers()
})

describe('format helpers (BR-M16-31)', () => {
  it('counts down as "{d}h {h}j {m}m" with floors and ends with "Tamat!"', () => {
    const end = Date.parse('2026-09-27T23:59:59+08:00')
    expect(formatCountdown(end, Date.parse('2026-09-25T15:40:00+08:00'))).toBe('2h 8j 19m')
    expect(formatCountdown(end, Date.parse('2026-09-25T15:41:00+08:00'))).toBe('2h 8j 18m')
    expect(formatCountdown(end, end)).toBe('Tamat!')
    expect(formatCountdown(end, end + DAY)).toBe('Tamat!')
  })

  it('formats the week range and one-decimal percentages', () => {
    expect(formatWeekRange('2026-09-21', '2026-09-27')).toBe('21 Sep — 27 Sep 2026')
    expect(formatPct(99.6)).toBe('99.6%')
    expect(formatPct(100)).toBe('100.0%')
  })
})

describe('routes (FR-M16-03..05)', () => {
  const byPath = Object.fromEntries(routes.map((r) => [r.path, r.meta]))

  it('S20 and S21: user shell, live tab titles, page header with the user subtitle', () => {
    expect(byPath['/permainan/pertandingan']).toMatchObject({
      layout: 'user',
      access: 'auth',
      title: 'Pertandingan Mingguan — PRESTASIPLUS',
      header: { title: 'Pertandingan Mingguan', subtitle: 'Selamat datang kembali' },
    })
    expect(byPath['/permainan/uji-minda']).toMatchObject({
      layout: 'user',
      title: 'Uji Minda — Belum Ada Cabaran',
      header: { title: 'Uji Minda', subtitle: 'Selamat datang kembali' },
    })
  })

  it('S22 is a standalone page; no route restricts the role', () => {
    expect(byPath['/permainan/sambung-kata']).toMatchObject({ layout: 'bare', access: 'auth' })
    for (const r of routes) expect(r.meta?.roles).toBeUndefined()
  })
})

describe('S20 PertandinganPage', () => {
  it('shows the hero, the week, the countdown, the three prizes and the rows', async () => {
    const w = await mountPage(PertandinganPage)
    expect(w.get('h1').text()).toBe('🏆 Pertandingan Mingguan')
    expect(w.text()).toContain('Lumba dengan semua pelajar! 3 teratas dapat Syiling bonus.')
    expect(w.get('[data-testid="pertandingan-range"]').text()).toBe('21 Sep — 27 Sep 2026')
    expect(w.get('[data-testid="pertandingan-countdown"]').text()).toBe('2h 8j 19m')
    const prizes = w.findAll('[data-testid="pertandingan-prize"]').map((p) => p.text())
    expect(prizes).toEqual(['🥇Juara+100 🪙', '🥈Naib Juara+50 🪙', '🥉Tempat Ketiga+25 🪙'])
    const rows = w.findAll('[data-testid="pertandingan-row"]')
    expect(rows).toHaveLength(4)
    expect(rows[0]?.text()).toContain('🥇')
    expect(rows[0]?.text()).toContain('23 sesi')
    expect(rows[0]?.text()).toContain('450')
    expect(rows[0]?.text()).toContain('99.6%')
    expect(rows[3]?.text()).toContain('4')
    expect(rows[3]?.text()).toContain('100.0%')
  })

  it('refreshes the countdown every 60 s and ends with "Tamat!"', async () => {
    const w = await mountPage(PertandinganPage)
    const el = () => w.get('[data-testid="pertandingan-countdown"]').text()
    expect(el()).toBe('2h 8j 19m')
    clock.advance(60_000)
    vi.advanceTimersByTime(60_000)
    await flushPromises()
    expect(el()).toBe('2h 8j 18m')
    clock.advance(3 * DAY)
    vi.advanceTimersByTime(60_000)
    await flushPromises()
    expect(el()).toBe('Tamat!')
  })

  it('a viewer without a session this week sees the not-started card and the practice link', async () => {
    const w = await mountPage(PertandinganPage)
    const status = w.get('[data-testid="pertandingan-status"]')
    expect(status.text()).toContain('📝')
    expect(status.text()).toContain('Belum mula lagi minggu ini!')
    expect(status.text()).toContain('Buat Latih Tubi untuk masuk kedudukan.')
    expect(w.get('[data-testid="pertandingan-start"]').attributes('href')).toBe('/practice')
  })

  it('a ranked viewer sees the PROPOSED rank line instead', async () => {
    api.fetchWeeklyCompetition.mockResolvedValue(weekly({ rank: 14, betul: 26 }))
    const w = await mountPage(PertandinganPage)
    expect(w.get('[data-testid="pertandingan-my-rank"]').text()).toBe(
      '📊 Kedudukan kamu: #14 · 26 betul',
    )
    expect(w.find('[data-testid="pertandingan-start"]').exists()).toBe(false)
  })

  it('shows the load error with a working "Cuba Semula"', async () => {
    api.fetchWeeklyCompetition.mockRejectedValueOnce(new Error('boom'))
    const w = await mountPage(PertandinganPage)
    expect(w.get('[data-testid="m16-load-error"]').text()).toContain(
      'Maaf, berlaku ralat. Sila cuba semula.',
    )
    await w.get('[data-testid="m16-retry"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="m16-load-error"]').exists()).toBe(false)
    expect(w.findAll('[data-testid="pertandingan-row"]')).toHaveLength(4)
  })

  it('back link goes to /permainan', async () => {
    const w = await mountPage(PertandinganPage)
    expect(w.get('[data-testid="m16-back-link"]').attributes('href')).toBe('/permainan')
    expect(w.get('[data-testid="m16-back-link"]').text()).toBe('Permainan')
  })
})

describe('S21 UjiMindaPage', () => {
  it('renders the empty state copy of FN-M16-7.4.1', async () => {
    const w = await mountPage(UjiMindaPage)
    expect(w.get('h1').text()).toBe('Uji Minda')
    const text = w.text()
    expect(text).toContain('🧠')
    expect(text).toContain(
      'Cabaran khas dari ibu/bapa kamu! Tapi ibu/bapa kamu belum tetapkan cabaran lagi.',
    )
    expect(text).toContain('Bagaimana nak mula?')
    expect(text).toContain('"Cabaran Uji Minda"')
    expect(text).toContain('📋 Apa Ibu/Bapa boleh tetap:')
    expect(w.findAll('[data-testid="uji-minda-list"] li').map((l) => l.text())).toEqual([
      '✅ Bilangan soalan setiap set',
      '✅ Syiling bagi setiap jawapan betul',
      '✅ Hadiah custom (cth: buku, jajan, trip)',
      '✅ Syiling minimum untuk menuntut hadiah',
    ])
  })
})

describe('S22 SambungKataPage (DV-M16-03)', () => {
  it('renders the handled 500 page and "Cuba Semula" reloads', async () => {
    const reload = vi.fn()
    const original = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, reload },
    })
    try {
      const w = await mountPage(SambungKataPage)
      const text = w.text()
      for (const part of [
        '500',
        '⚙️',
        'Ralat Pelayan',
        'Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar lagi.',
        'Halaman Utama',
        'Cuba Semula',
        'PRESTASIPLUS',
      ]) {
        expect(text).toContain(part)
      }
      expect(w.get('[data-testid="m16-error-home"]').attributes('href')).toBe('/')
      await w.get('[data-testid="m16-error-retry"]').trigger('click')
      expect(reload).toHaveBeenCalledTimes(1)
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original })
    }
  })
})
