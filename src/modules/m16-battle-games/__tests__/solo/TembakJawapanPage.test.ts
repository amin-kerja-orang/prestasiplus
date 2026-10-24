// @vitest-environment jsdom
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import SoloTembakJawapanPage from '../../pages/SoloTembakJawapanPage.vue'
import { mountAt, rawOk, tembakPayload } from './helpers'

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
  fetchSoloGame.mockImplementation(() => Promise.resolve(tembakPayload()))
  submitSoloGame.mockResolvedValue(rawOk({ is_new_record: false, syiling_awarded: 0 }))
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
})

const tiles = () => wrapper!.findAll('[data-testid="solo-tile"]')
const hearts = () => wrapper!.findAll('[data-testid="solo-heart"]')
const text = (id: string) => wrapper!.get(`[data-testid="${id}"]`).text()

async function startPlaying(): Promise<void> {
  wrapper = await mountAt(SoloTembakJawapanPage, '/permainan/tembak-jawapan?darjah=4')
  await vi.advanceTimersByTimeAsync(2400)
}

describe('S15 Tembak Jawapan (FR-M16-79..81)', () => {
  it('shows the picker without ?darjah', async () => {
    wrapper = await mountAt(SoloTembakJawapanPage, '/permainan/tembak-jawapan')
    expect(wrapper.text()).toContain('Pilih darjah / tingkatan kamu:')
    expect(fetchSoloGame).not.toHaveBeenCalled()
  })

  it('counts down with the hint, then shows the HUD, the zone and the death line', async () => {
    wrapper = await mountAt(SoloTembakJawapanPage, '/permainan/tembak-jawapan?darjah=4')
    expect(wrapper.text()).toContain('🎯 TEMBAK JAWAPAN')
    expect(wrapper.text()).toContain('Ketik jawapan yang betul sebelum jatuh!')
    await vi.advanceTimersByTimeAsync(2400)
    expect(text('solo-score')).toBe('0')
    expect(text('solo-level')).toBe('1')
    expect(hearts()).toHaveLength(3)
    expect(text('solo-coins')).toBe('🪙 0')
    expect(wrapper.text()).toContain('Soalan 1')
    expect(wrapper.text()).toContain('⚠ GARIS MAUT')
    expect(wrapper.get('[data-testid="solo-fall-zone"]').classes()).toContain('aspect-4/5')
    // Tiles fall 1.8 s apart: one at the start, two after 1.8 s.
    expect(tiles()).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1800)
    expect(tiles()).toHaveLength(2)
  })

  it('5 correct taps score 10 × level, show the LEVEL 2 banner for 1.2 s and count syiling', async () => {
    await startPlaying()
    for (let i = 0; i < 5; i++) await tiles()[0]!.trigger('click')
    expect(text('solo-score')).toBe('50')
    expect(text('solo-level')).toBe('2')
    expect(text('solo-coins')).toBe('🪙 5')
    expect(text('solo-level-banner')).toBe('⚡ LEVEL 2!')
    await vi.advanceTimersByTimeAsync(1200)
    expect(wrapper!.find('[data-testid="solo-level-banner"]').exists()).toBe(false)
  })

  it('a wrong tap costs a life, disables its tile and does not end the question', async () => {
    await startPlaying()
    await tiles()[0]!.trigger('click') // correct, level 1: on to question 2
    expect(wrapper!.text()).toContain('Soalan 2')
    await vi.advanceTimersByTimeAsync(1800)
    await tiles()[1]!.trigger('click') // wrong option
    expect(hearts().filter((h) => h.attributes('data-lost') === 'true')).toHaveLength(1)
    expect(wrapper!.text()).toContain('Soalan 2')
    expect(tiles()[1]!.attributes('disabled')).toBeDefined()
    expect(tiles()[1]!.attributes('data-wrong')).toBe('true')
    await tiles()[1]!.trigger('click') // disabled: no second life lost
    expect(hearts().filter((h) => h.attributes('data-lost') === 'true')).toHaveLength(1)
    // the question goes on: the correct tile (option 0) is still there and still scores
    await tiles()[0]!.trigger('click')
    expect(wrapper!.text()).toContain('Soalan 3')
    expect(text('solo-score')).toBe('20')
  })

  it('three lost lives end the game and submit once; wrong taps are not "answered"', async () => {
    await startPlaying()
    await tiles()[0]!.trigger('click') // correct, level 1
    for (let lost = 1; lost <= 3; lost++) {
      await vi.advanceTimersByTimeAsync(1800)
      await tiles()[lost]!.trigger('click') // wrong options 1, 2, 3 of question 2
      if (lost < 3)
        expect(hearts().filter((h) => h.attributes('data-lost') === 'true')).toHaveLength(lost)
    }
    await vi.advanceTimersByTimeAsync(0)
    expect(submitSoloGame).toHaveBeenCalledTimes(1)
    expect(submitSoloGame).toHaveBeenCalledWith('tembak-jawapan', {
      session_id: 'shoot_0123456789abc',
      correct_count: 1,
      total_answered: 1,
      max_level: 1,
      score: 10,
      syiling_earned: 1,
    })
    expect(wrapper!.text()).toContain('1/1')
    expect(wrapper!.get('[data-testid="solo-result-title"]').text()).toBe('CUBA LAGI!')
    expect(wrapper!.text()).toContain('Tembak Jawapan — Level 1')
    expect(wrapper!.text()).toContain('Tertinggi')
    expect(wrapper!.text()).toContain('Level 1')
    expect(wrapper!.text()).toContain('0 🪙')
  })

  it('a question nobody taps costs a life at its deadline', async () => {
    await startPlaying()
    await vi.advanceTimersByTimeAsync(28_900)
    expect(hearts().filter((h) => h.attributes('data-lost') === 'true')).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(200)
    expect(hearts().filter((h) => h.attributes('data-lost') === 'true')).toHaveLength(1)
    expect(wrapper!.text()).toContain('Soalan 2')
  })
})
