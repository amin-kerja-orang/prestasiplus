// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { Ranking } from '../../api/types'
import RankingPage from '../../pages/RankingPage.vue'

const api = vi.hoisted(() => ({ fetchRankings: vi.fn() }))
vi.mock('../../api/performance', () => api)

/** R1-MUR-18 Kedudukan: fictitious pupils only. */
function ranking(extra: Partial<Ranking> = {}): Ranking {
  return {
    syiling: 374,
    scopes: [
      {
        scope: 'kelas',
        rank: 2,
        total: 30,
        percentile: 7,
        nearby: [
          { rank: 1, name: 'Aina', syiling: 400, me: false },
          { rank: 2, name: 'Murid Contoh', syiling: 374, me: true },
          { rank: 3, name: 'Bakar', syiling: 300, me: false },
        ],
      },
      { scope: 'sekolah', rank: 406, total: 864, percentile: 47, nearby: [] },
      { scope: 'negeri', rank: null, total: null, percentile: null, nearby: [] },
      { scope: 'kebangsaan', rank: 2141, total: 4806, percentile: 45, nearby: [] },
    ],
    ...extra,
  }
}

let wrapper: VueWrapper | null = null

async function render(): Promise<VueWrapper> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/ranking', component: RankingPage }],
  })
  await router.push('/ranking')
  wrapper = mount(RankingPage, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  api.fetchRankings.mockReset()
  api.fetchRankings.mockResolvedValue(ranking())
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('RankingPage (R1-MUR-18 Kedudukan)', () => {
  it('shows the header, "Syiling anda" with its note and no filter or pill', async () => {
    const w = await render()
    expect(w.get('h1').text()).toBe('Kedudukan')
    expect(w.text()).toContain('Di mana anda berdiri — dalam kelas, sekolah, negeri dan seluruh negara')
    expect(document.title).toBe('Kedudukan | PRESTASIPLUS')
    expect(w.get('[data-testid=ranking-syiling]').text()).toContain('Syiling anda')
    expect(w.get('[data-testid=ranking-syiling-value]').text()).toBe('374')
    expect(w.get('[data-testid=ranking-syiling]').text()).toContain('Kedudukan dikira berdasarkan baki syiling.')
    // FR-MUR-18-6: Skop, Subjek and Tingkatan are not rendered
    expect(w.findAllComponents({ name: 'Select' })).toHaveLength(0)
    expect(w.find('form').exists()).toBe(false)
    expect(w.find('[data-testid=ranking-pills]').exists()).toBe(false)
    expect(api.fetchRankings).toHaveBeenCalledTimes(1)
  })

  it('one card per scope: "#{rank}", "/ {total}" and "Kumpulan {p}% teratas"; negeri without a state is "Belum tersedia"', async () => {
    const w = await render()
    const card = (k: string) => w.get(`[data-testid=ranking-card-${k}]`).text()
    expect(card('kelas')).toContain('Dalam kelas')
    expect(card('kelas')).toContain('#2')
    expect(card('kelas')).toContain('/ 30 · Kumpulan 7% teratas')
    expect(card('sekolah')).toContain('Dalam sekolah')
    expect(card('sekolah')).toContain('#406')
    expect(card('sekolah')).toContain('/ 864 · Kumpulan 47% teratas')
    expect(card('negeri')).toContain('Dalam negeri')
    expect(card('negeri')).toContain('Belum tersedia')
    expect(card('negeri')).not.toContain('Kumpulan')
    expect(card('kebangsaan')).toContain('Kebangsaan')
    expect(card('kebangsaan')).toContain('#2,141')
    expect(card('kebangsaan')).toContain('/ 4,806 · Kumpulan 45% teratas')
  })

  it('a pupil without a class has no class card', async () => {
    api.fetchRankings.mockResolvedValue(ranking({ scopes: ranking().scopes.slice(1) }))
    const w = await render()
    expect(w.find('[data-testid=ranking-card-kelas]').exists()).toBe(false)
    expect(w.find('[data-testid=ranking-card-sekolah]').exists()).toBe(true)
  })

  it('"Sekitar anda": the scope as sub-label, the own row marked ANDA, first names only', async () => {
    const w = await render()
    const box = w.get('[data-testid=ranking-nearby]')
    expect(box.text()).toContain('Sekitar anda')
    expect(w.get('[data-testid=ranking-nearby-scope]').text()).toBe('Dalam kelas')
    const rows = w.findAll('[data-testid=ranking-nearby-row]')
    expect(rows).toHaveLength(3)
    expect(rows[0]?.text()).toContain('Aina')
    expect(rows[1]?.text()).toContain('Murid Contoh')
    expect(rows[2]?.text()).toContain('Bakar')
    expect(rows[1]?.text()).toContain('ANDA')
    expect(rows[1]?.text()).toContain('374')
    expect(rows[0]?.text()).not.toContain('ANDA')
    expect(rows[1]?.attributes('aria-current')).toBe('true')
  })

  it('without a class "Sekitar anda" follows the school; a lone pupil sees the "no other pupil" line', async () => {
    api.fetchRankings.mockResolvedValue(
      ranking({
        scopes: [
          {
            scope: 'sekolah',
            rank: 1,
            total: 1,
            percentile: 100,
            nearby: [{ rank: 1, name: 'Murid Contoh', syiling: 374, me: true }],
          },
          { scope: 'kebangsaan', rank: 1, total: 1, percentile: 100, nearby: [] },
        ],
      }),
    )
    const w = await render()
    expect(w.get('[data-testid=ranking-nearby-scope]').text()).toBe('Dalam sekolah')
    expect(w.get('[data-testid=ranking-card-sekolah]').text()).toContain('#1')
    expect(w.get('[data-testid=ranking-card-sekolah]').text()).toContain('/ 1 · Kumpulan 100% teratas')
    expect(w.get('[data-testid=ranking-nearby-alone]').text()).toBe(
      'Tiada pelajar lain untuk dibandingkan dalam skop ini.',
    )
  })

  it('links to the full Papan Pendahulu', async () => {
    const w = await render()
    const link = w.get('[data-testid=ranking-full-board]')
    expect(link.text()).toContain('Lihat papan pendahulu penuh')
    expect(link.attributes('href')).toBe('/leaderboard')
  })

  it('no scopes: "Kedudukan belum tersedia" with the V2 sentence, no cards', async () => {
    api.fetchRankings.mockResolvedValue({ syiling: 0, scopes: [] })
    const w = await render()
    const empty = w.get('[data-testid=ranking-empty]')
    expect(empty.text()).toContain('Kedudukan belum tersedia')
    expect(empty.text()).toContain('Akaun anda belum dikaitkan dengan sekolah atau kelas.')
    expect(w.find('[data-testid=ranking-cards]').exists()).toBe(false)
    expect(w.find('[data-testid=ranking-full-board]').exists()).toBe(false)
  })

  it('shows the load error with a retry', async () => {
    api.fetchRankings.mockRejectedValueOnce(new Error('boom'))
    const w = await render()
    expect(w.get('[data-testid=ranking-error]').text()).toContain('Maaf, berlaku ralat.')
    await w.get('[data-testid=ranking-error] button').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid=ranking-cards]').exists()).toBe(true)
  })
})
