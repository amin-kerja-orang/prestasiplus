// @vitest-environment jsdom
import { type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'

import type { Chain } from '../../../api/types'
import KirkpatrickChainPage from '../../../pages/KirkpatrickChainPage.vue'
import { all, flat, has, mountPage, squash, t } from '../fixtures'

const api = vi.hoisted(() => ({ fetchKirkpatrickChain: vi.fn() }))
vi.mock('../../../api', () => api)

const chain = (over: Partial<Chain> = {}): Chain => ({
  t1: { nps: 8.3, satisfaction: 4.6, responses: 336 },
  t2: { accuracy: 82.8, answers: 306133, avgScore: 80.3 },
  t3: {
    active: 946,
    t4t5: 4158,
    pct: 22.8,
    sessions: 20991,
    bands: [
      { key: 'champion', count: 513, pct: 12.3 },
      { key: 'konsisten', count: 259, pct: 6.2 },
      { key: 'berkembang', count: 169, pct: 4.1 },
      { key: 'minimum', count: 5, pct: 0.1 },
      { key: 'tidakTerlibat', count: 3212, pct: 77.2 },
    ],
  },
  t4: { gps: 4.3, r: 0.1298, strength: 'Lemah' },
  correlation: {
    bands: [
      { label: '1-20 soalan', n: 215, acc: 59.7 },
      { label: '51-100 soalan', n: 149, acc: 68.7 },
      { label: '100+ soalan', n: 348, acc: 75.2 },
    ],
    r: 0.1298,
  },
  ...over,
})

let wrapper: VueWrapper | undefined

async function open(prefix = '/admin/kirkpatrick') {
  const m = await mountPage(
    KirkpatrickChainPage,
    { basePath: prefix },
    `${prefix}/chain`,
    `${prefix}/chain`,
  )
  wrapper = m.wrapper
  return m.wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  setRouteOutcome(null)
  api.fetchKirkpatrickChain.mockResolvedValue(chain())
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('S6 header (AC-M12-25.1, 27.1)', () => {
  it('shows the title, subtitle, export button and back link, and no tab strip', async () => {
    const w = await open()
    expect(t(w, 'kirk-chain').get('h1').text()).toBe('Model Kirkpatrick — Rantaian Impak')
    expect(w.text()).toContain('Bukti keberkesanan Prestasi Plus berdasarkan 4 Tahap Kirkpatrick')
    expect(has(w, 'kirk-tabs')).toBe(false)
    expect(t(w, 'chain-back').attributes('href')).toBe('/admin/kirkpatrick')
    expect(t(w, 'chain-back').text()).toBe('Kembali')
    const exp = t(w, 'chain-export')
    expect(exp.text()).toBe('Muat Turun Laporan')
    expect(exp.attributes('href')).toBe('/admin/kirkpatrick/export-pdf')
    expect(exp.attributes('target')).toBe('_blank')
  })

  it('builds the export and back targets from the /guru prefix on the twin', async () => {
    const w = await open('/guru/kirkpatrick')
    expect(t(w, 'chain-export').attributes('href')).toBe('/guru/kirkpatrick/export-pdf')
    expect(t(w, 'chain-back').attributes('href')).toBe('/guru/kirkpatrick')
  })
})

describe('S6 level cards (AC-M12-25.2, 25.3)', () => {
  it('T1 shows NPS Purata, Kepuasan and Responden as success', async () => {
    const w = await open()
    const card = t(w, 'chain-t1')
    expect(flat(card)).toContain('T1 Reaksi Kepuasan pengguna terhadap Prestasi Plus')
    expect(card.findAll('[data-testid="chain-value"]').map((e) => e.text())).toEqual([
      '8.3/10',
      '4.6/5',
      '336',
    ])
    expect(card.attributes('data-tone')).toBe('success')
  })

  it('T2 shows Ketepatan, Soalan Dijawab and Skor Purata as success', async () => {
    const w = await open()
    const card = t(w, 'chain-t2')
    expect(flat(card)).toContain('Perkembangan akademik melalui Head Count')
    expect(card.findAll('[data-testid="chain-value"]').map((e) => e.text())).toEqual([
      '82.8%',
      '306,133',
      '80.3%',
    ])
    expect(card.attributes('data-tone')).toBe('success')
  })

  it('T3 shows 946/4158 (22.8%), Sesi Latihan with a separator and the English band labels as warning', async () => {
    const w = await open()
    const card = t(w, 'chain-t3')
    expect(flat(card)).toContain('Konsistensi penggunaan platform (Mastery Learning)')
    expect(card.findAll('[data-testid="chain-value"]').map((e) => squash(e.text()))).toEqual([
      '946/4158 (22.8%)',
      '20,991',
    ])
    expect(card.text()).toContain('Taburan Konsistensi:')
    expect(card.findAll('[data-testid="chain-bands"] li').map((l) => flat(l))).toEqual([
      'Champion 513',
      'Consistent 259',
      'Developing 169',
      'Minimal 5',
      'Disengaged 3212',
    ])
    expect(card.attributes('data-tone')).toBe('warning')
  })

  it('T4 shows GPS, r and Kekuatan as warning, and "-" without a GPS', async () => {
    const w = await open()
    const card = t(w, 'chain-t4')
    expect(card.findAll('[data-testid="chain-value"]').map((e) => e.text())).toEqual([
      '4.30',
      '0.1298',
      'Lemah',
    ])
    expect(card.attributes('data-tone')).toBe('warning')
    wrapper?.unmount()
    api.fetchKirkpatrickChain.mockResolvedValue(
      chain({ t4: { gps: null, r: 0.1298, strength: 'Lemah' } }),
    )
    const w2 = await open()
    expect(t(w2, 'chain-t4').findAll('[data-testid="chain-value"]')[0]?.text()).toBe('-')
  })

  it('stacks in one column below lg and shows the arrows only from lg', async () => {
    const w = await open()
    expect(t(w, 'chain-cards').classes()).toEqual(
      expect.arrayContaining(['flex-col', 'lg:flex-row']),
    )
    const arrows = all(w, 'chain-arrow')
    expect(arrows).toHaveLength(3)
    for (const a of arrows) {
      expect(a.classes()).toEqual(expect.arrayContaining(['hidden', 'lg:flex']))
    }
  })
})

describe('S6 correlation and conclusions (AC-M12-26.1, 26.2)', () => {
  it('shows exactly three rows with bars (warning below 60, success otherwise)', async () => {
    const w = await open()
    expect(all(w, 'corr-row')).toHaveLength(3)
    const rows = t(w, 'chain-correlation').findAll('tbody tr')
    expect(
      rows.map((r) =>
        r
          .findAll('td')
          .slice(0, 3)
          .map((c) => c.text()),
      ),
    ).toEqual([
      ['1-20 soalan', '215', '59.7%'],
      ['51-100 soalan', '149', '68.7%'],
      ['100+ soalan', '348', '75.2%'],
    ])
    const bars = all(w, 'corr-bar')
    expect(bars[0]?.html()).toContain('bg-warning')
    expect(bars[1]?.html()).toContain('bg-success')
    expect(bars[2]?.html()).toContain('bg-success')
    expect(bars[2]?.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('75.2')
  })

  it('composes the Kesimpulan ALESA sentence from the constants (+15.5%)', async () => {
    const w = await open()
    expect(squash(t(w, 'corr-conclusion').text())).toBe(
      'Kesimpulan ALESA: Pelajar yang menjawab 100+ soalan mencapai ketepatan 75.2%, berbanding 59.7% bagi pelajar dengan kurang 20 soalan (perbezaan +15.5%). Korelasi Pearson antara penggunaan dan ketepatan: r = 0.1298 (Lemah).',
    )
    expect(t(w, 'corr-conclusion').get('strong').text()).toBe('Kesimpulan ALESA:')
  })

  it('shows the static conclusion', async () => {
    const w = await open()
    const box = t(w, 'chain-conclusion')
    expect(box.get('h2').text()).toBe('Kesimpulan Model Kirkpatrick')
    expect(flat(box)).toContain('Empat-empat tahap Kirkpatrick dipenuhi dalam Prestasi Plus.')
    expect(box.findAll('strong').map((s) => s.text())).toEqual([
      'Tahap 1 (Reaksi)',
      'Tahap 2 (Pembelajaran)',
      'Tahap 3 (Tingkah Laku)',
      'Tahap 4 (Hasil)',
    ])
  })

  it('scrolls the correlation table inside its card', async () => {
    const w = await open()
    expect(t(w, 'chain-correlation').find('.overflow-x-auto').exists()).toBe(true)
  })
})

describe('S6 states', () => {
  it('shows the error line on a failed request', async () => {
    api.fetchKirkpatrickChain.mockRejectedValue(new Error('boom'))
    const w = await open()
    expect(has(w, 'kirk-error')).toBe(true)
  })

  it('renders the 403 page in place on a 403', async () => {
    api.fetchKirkpatrickChain.mockRejectedValue(
      new ApiError({ status: 403, code: 'FORBIDDEN', message: 'no' }),
    )
    await open('/guru/kirkpatrick')
    expect(useRouteOutcome().value).toBe(403)
  })
})
