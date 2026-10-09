// @vitest-environment jsdom
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import SoloKadMemoriPage from '../../pages/SoloKadMemoriPage.vue'
import { memoriPayload, mountAt, rawOk } from './helpers'

const fetchSoloGame = vi.hoisted(() => vi.fn())
const submitSoloGame = vi.hoisted(() => vi.fn())
vi.mock('../../api/games', async (orig) => ({
  ...(await orig<typeof import('../../api/games')>()),
  fetchSoloGame,
  submitSoloGame,
}))

let wrapper: VueWrapper | undefined

beforeEach(() => {
  vi.useFakeTimers()
  fetchSoloGame.mockReset()
  submitSoloGame.mockReset()
  fetchSoloGame.mockImplementation(() => Promise.resolve(memoriPayload()))
  submitSoloGame.mockResolvedValue(rawOk({ results: { syiling_earned: 0, accuracy: 50 } }))
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
})

const card = (id: number) => wrapper!.findAll('[data-testid="solo-card-item"]')[id - 1]!
// Cards: ids 1..6 are questions of pairs 0..5, ids 7..12 their answers.
const flipPair = async (pair: number) => {
  await card(pair + 1).trigger('click')
  await card(pair + 7).trigger('click')
}

describe('S17 Kad Memori (FR-M16-86..89)', () => {
  it('renders the header, the stats and 12 face-down cards without a picker', async () => {
    wrapper = await mountAt(SoloKadMemoriPage, '/permainan/kad-memori')
    expect(fetchSoloGame).toHaveBeenCalledWith('kad-memori', undefined)
    expect(wrapper.text()).toContain('🃏 Kad Memori')
    expect(wrapper.text()).toContain('Padankan soalan dengan jawapan yang betul!')
    expect(wrapper.get('[data-testid="solo-time"]').text()).toBe('⏱️ 0:00')
    expect(wrapper.get('[data-testid="solo-moves"]').text()).toBe('👆 0 langkah')
    expect(wrapper.get('[data-testid="solo-matched"]').text()).toBe('✅ 0 / 6 padan')
    expect(wrapper.findAll('[data-testid="solo-card-item"]')).toHaveLength(12)
    expect(wrapper.text()).not.toContain('Pilih darjah')
    await vi.advanceTimersByTimeAsync(4000)
    expect(wrapper.get('[data-testid="solo-time"]').text()).toBe('⏱️ 0:04')
  })

  it('a mismatch shows wrong and turns back after 800 ms; a match stays open', async () => {
    wrapper = await mountAt(SoloKadMemoriPage, '/permainan/kad-memori')
    await card(1).trigger('click') // question of pair 0
    await card(8).trigger('click') // answer of pair 1
    expect(wrapper.get('[data-testid="solo-moves"]').text()).toBe('👆 1 langkah')
    expect(card(1).classes()).toContain('wrong')
    // Locked while the mismatch shows.
    await card(2).trigger('click')
    expect(card(2).classes()).not.toContain('flipped')
    await vi.advanceTimersByTimeAsync(799)
    expect(card(1).classes()).toContain('wrong')
    await vi.advanceTimersByTimeAsync(1)
    expect(card(1).classes()).not.toContain('wrong')
    expect(card(1).text()).toBe('❓')

    await flipPair(0)
    expect(card(1).classes()).toContain('matched')
    expect(card(7).classes()).toContain('matched')
    expect(wrapper.get('[data-testid="solo-matched"]').text()).toBe('✅ 1 / 6 padan')
    expect(wrapper.get('[data-testid="solo-moves"]').text()).toBe('👆 2 langkah')
  })

  it('submits on completion, shows the overlay and a click outside does nothing', async () => {
    wrapper = await mountAt(SoloKadMemoriPage, '/permainan/kad-memori')
    await vi.advanceTimersByTimeAsync(5000)
    for (let p = 0; p < 6; p++) await flipPair(p)
    await vi.advanceTimersByTimeAsync(0)
    expect(submitSoloGame).toHaveBeenCalledTimes(1)
    expect(submitSoloGame).toHaveBeenCalledWith('kad-memori', {
      session_id: 'mem_0123456789abc',
      matches: 6,
      total_pairs: 6,
      moves: 6,
      time_seconds: 5,
    })
    const overlay = wrapper.get('[data-testid="solo-overlay"]')
    for (const s of [
      '🎉',
      'Tahniah!',
      'Semua kad berjaya dipadankan!',
      'Masa',
      'Langkah',
      '0:05',
      '50%',
      '+0',
      '🔄 Main Lagi',
      '🏠 Hub',
    ]) {
      expect(overlay.text()).toContain(s)
    }
    await overlay.trigger('click')
    expect(wrapper.find('[data-testid="solo-overlay"]').exists()).toBe(true)
  })
})
