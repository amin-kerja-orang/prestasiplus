// @vitest-environment jsdom
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import SoloBetulSalahPage from '../../pages/SoloBetulSalahPage.vue'
import { betulSalahPayload, mountAt, rawOk } from './helpers'

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
  fetchSoloGame.mockImplementation(() => Promise.resolve(betulSalahPayload()))
  submitSoloGame.mockResolvedValue(rawOk({ is_new_record: true, syiling_awarded: 0 }))
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
})

const text = () => wrapper!.text()
const click = async (testid: string) => {
  await wrapper!.get(`[data-testid="${testid}"]`).trigger('click')
}

describe('S13 Betul atau Salah (FR-M16-71..75)', () => {
  it('shows the picker and starts nothing without ?darjah (DV-M16-18)', async () => {
    wrapper = await mountAt(SoloBetulSalahPage, '/permainan/betul-salah')
    expect(text()).toContain('Pilih darjah / tingkatan kamu:')
    expect(text()).toContain('🏫 Sekolah Rendah')
    for (const n of [1, 2, 3, 4]) expect(text()).toContain(`Darjah ${String(n)}`)
    expect(text()).not.toContain('Darjah 5')
    expect(text()).toContain('← Kembali ke Hub')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetchSoloGame).not.toHaveBeenCalled()
    expect(submitSoloGame).not.toHaveBeenCalled()
  })

  it('counts 3, 2, 1 in 800 ms steps, then plays', async () => {
    wrapper = await mountAt(SoloBetulSalahPage, '/permainan/betul-salah?darjah=4')
    expect(fetchSoloGame).toHaveBeenCalledWith('betul-salah', 4)
    expect(text()).toContain('✅❌ BETUL ATAU SALAH')
    expect(wrapper.get('[data-testid="solo-countdown-number"]').text()).toBe('3')
    await vi.advanceTimersByTimeAsync(800)
    expect(wrapper.get('[data-testid="solo-countdown-number"]').text()).toBe('2')
    await vi.advanceTimersByTimeAsync(800)
    expect(wrapper.get('[data-testid="solo-countdown-number"]').text()).toBe('1')
    await vi.advanceTimersByTimeAsync(800)
    expect(text()).toContain('Kenyataan 1')
    expect(wrapper.get('[data-testid="solo-clock"]').text()).toBe('45')
    expect(wrapper.get('[data-testid="solo-score"]').text()).toBe('0')
  })

  it('scores 6 correct in a row 102 with the hot KOMBO badge, then submits once at time up', async () => {
    wrapper = await mountAt(SoloBetulSalahPage, '/permainan/betul-salah?darjah=4')
    await vi.advanceTimersByTimeAsync(2400)
    // Statement 1 is true, 2 is false, ...: answer each one correctly.
    for (let i = 0; i < 6; i++) {
      await click(i % 2 === 0 ? 'solo-betul' : 'solo-salah')
      expect(wrapper.get('[data-testid="solo-feedback"]').text()).toBe('✅')
      await vi.advanceTimersByTimeAsync(700)
    }
    expect(wrapper.get('[data-testid="solo-score"]').text()).toBe('102')
    const badge = wrapper.get('[data-testid="solo-combo"]')
    expect(badge.text()).toBe('🔥 6 KOMBO')
    expect(badge.attributes('data-hot')).toBe('true')

    await vi.advanceTimersByTimeAsync(45_000)
    expect(submitSoloGame).toHaveBeenCalledTimes(1)
    expect(submitSoloGame).toHaveBeenCalledWith('betul-salah', {
      session_id: 'tf_0123456789abc',
      correct_count: 6,
      total_answered: 6,
      streak: 6,
      score: 102,
      syiling_earned: 20,
    })
    expect(wrapper.get('[data-testid="solo-result-emoji"]').text()).toBe('✅')
    expect(wrapper.get('[data-testid="solo-result-title"]').text()).toBe('HEBAT!')
    expect(text()).toContain('45 saat — Betul atau Salah!')
    expect(text()).toContain('Skor Total')
    expect(text()).toContain('6/6')
    expect(text()).toContain('6 🔥')
    // DV-M16-23: the tile shows the credited amount (0), not the counted 20.
    expect(text()).toContain('0 🪙')
    expect(text()).toContain('🏆 REKOD BARU!')
    expect(wrapper.find('[data-testid="coin-fly"]').exists()).toBe(false)
    expect(text()).toContain('🔄 Main Lagi')
    expect(text()).toContain('🎮 Hab')
  })

  it('a wrong answer resets the streak and no record shows when the server says so', async () => {
    submitSoloGame.mockResolvedValue(rawOk({ is_new_record: false, syiling_awarded: 3 }))
    wrapper = await mountAt(SoloBetulSalahPage, '/permainan/betul-salah?darjah=2')
    await vi.advanceTimersByTimeAsync(2400)
    await click('solo-betul') // statement 1 true: correct, streak 1
    await vi.advanceTimersByTimeAsync(700)
    await click('solo-betul') // statement 2 false: wrong
    expect(wrapper.get('[data-testid="solo-feedback"]').text()).toBe('❌')
    await vi.advanceTimersByTimeAsync(700)
    expect(wrapper.find('[data-testid="solo-combo"]').exists()).toBe(false)
    // 45 s after the game began (2400 ms countdown + 1400 ms spent so far): the coin-fly (1.4 s) is still on.
    await vi.advanceTimersByTimeAsync(45_000 - 1400)
    expect(text()).toContain('1/2')
    expect(text()).toContain('3 🪙')
    expect(text()).not.toContain('REKOD BARU')
    expect(wrapper.find('[data-testid="coin-fly"]').exists()).toBe(true)
  })

  it('"Main Lagi" loads a new session', async () => {
    wrapper = await mountAt(SoloBetulSalahPage, '/permainan/betul-salah?darjah=4')
    await vi.advanceTimersByTimeAsync(2400 + 45_000)
    expect(text()).toContain('Skor Total')
    await click('solo-again')
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchSoloGame).toHaveBeenCalledTimes(2)
    expect(text()).toContain('✅❌ BETUL ATAU SALAH')
  })

  it('a failed submit logs "Submit error:" and the result stays', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    submitSoloGame.mockResolvedValue({ status: 409, headers: {}, body: { message: 'x' } })
    wrapper = await mountAt(SoloBetulSalahPage, '/permainan/betul-salah?darjah=4')
    await vi.advanceTimersByTimeAsync(2400 + 45_000)
    expect(log).toHaveBeenCalledWith('Submit error:', 'x')
    expect(text()).toContain('Skor Total')
    expect(text()).not.toContain('REKOD BARU')
    log.mockRestore()
  })

  it('a session that loads after the page was left starts nothing and posts nothing', async () => {
    let release: (v: ReturnType<typeof betulSalahPayload>) => void = () => undefined
    fetchSoloGame.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve
        }),
    )
    wrapper = await mountAt(SoloBetulSalahPage, '/permainan/betul-salah?darjah=4')
    wrapper.unmount()
    wrapper = undefined
    release(betulSalahPayload())
    await vi.advanceTimersByTimeAsync(60_000)
    expect(vi.getTimerCount()).toBe(0)
    expect(submitSoloGame).not.toHaveBeenCalled()
  })

  it('leaves no timer running after unmount', async () => {
    wrapper = await mountAt(SoloBetulSalahPage, '/permainan/betul-salah?darjah=4')
    await vi.advanceTimersByTimeAsync(2400)
    wrapper.unmount()
    wrapper = undefined
    expect(vi.getTimerCount()).toBe(0)
  })
})
