// @vitest-environment jsdom
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import SoloCabaranKilatPage from '../../pages/SoloCabaranKilatPage.vue'
import { cabaranPayload, mountAt, rawOk } from './helpers'

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
  fetchSoloGame.mockImplementation(() => Promise.resolve(cabaranPayload()))
  submitSoloGame.mockResolvedValue(rawOk({ is_new_record: false, syiling_awarded: 6 }))
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
})

const options = () => wrapper!.findAll('[data-testid="solo-option"]')

describe('S14 Cabaran Kilat (FR-M16-76..78)', () => {
  it('shows the picker without ?darjah and fetches nothing', async () => {
    wrapper = await mountAt(SoloCabaranKilatPage, '/permainan/cabaran-kilat')
    expect(wrapper.text()).toContain('Cabaran Kilat')
    expect(wrapper.text()).toContain('Pilih tingkatan kamu:')
    expect(fetchSoloGame).not.toHaveBeenCalled()
  })

  it('plays: difficulty chip, A-D options, correct/wrong classes, 400 ms step, combo score', async () => {
    wrapper = await mountAt(SoloCabaranKilatPage, '/permainan/cabaran-kilat?darjah=4')
    expect(wrapper.text()).toContain('⚡ CABARAN KILAT')
    await vi.advanceTimersByTimeAsync(2400)
    expect(wrapper.text()).toContain('Soalan 1')
    expect(wrapper.get('[data-testid="solo-difficulty"]').text()).toBe('Mudah')
    expect(options().map((o) => o.text())).toEqual([
      'APilihan 0',
      'BPilihan 1',
      'CPilihan 2',
      'DPilihan 3',
    ])
    expect(wrapper.get('[data-testid="solo-clock"]').text()).toBe('60')

    // 3 correct in a row (option B): +10, +20, +30 and 1 + 2 + 3 syiling.
    for (let i = 0; i < 3; i++) {
      await options()[1]!.trigger('click')
      expect(options()[1]!.attributes('data-state')).toBe('correct')
      expect(options().every((o) => o.attributes('aria-disabled') === 'true')).toBe(true)
      await vi.advanceTimersByTimeAsync(400)
    }
    expect(wrapper.get('[data-testid="solo-score"]').text()).toBe('60')
    expect(wrapper.get('[data-testid="solo-combo"]').text()).toBe('🔥 3x COMBO')
    expect(wrapper.text()).toContain('Soalan 4')
    expect(wrapper.get('[data-testid="solo-difficulty"]').text()).toBe('Sukar')

    await options()[0]!.trigger('click')
    expect(options()[0]!.attributes('data-state')).toBe('wrong')
    await vi.advanceTimersByTimeAsync(400)
    expect(wrapper.find('[data-testid="solo-combo"]').exists()).toBe(false)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(submitSoloGame).toHaveBeenCalledTimes(1)
    expect(submitSoloGame).toHaveBeenCalledWith('cabaran-kilat', {
      session_id: 'speed_0123456789abc',
      correct_count: 3,
      total_answered: 4,
      max_combo: 3,
      score: 60,
      syiling_earned: 6,
    })
    expect(wrapper.get('[data-testid="solo-result-title"]').text()).toBe('TERUSKAN!')
    expect(wrapper.text()).toContain('60 saat penuh aksi!')
    expect(wrapper.text()).toContain('3/4')
    expect(wrapper.text()).toContain('3x')
    expect(wrapper.text()).toContain('6 🪙')
    expect(wrapper.text()).toContain('⚡ Main Lagi')
    expect(wrapper.text()).not.toContain('REKOD BARU')
  })
})
