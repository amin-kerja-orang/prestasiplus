// @vitest-environment jsdom
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'

import type { CabaranKilatPayload } from '../../api'
import SoloCabaranKilatPage from '../../pages/SoloCabaranKilatPage.vue'
import { mountAt, rawOk } from './helpers'

const fetchSoloGame = vi.hoisted(() => vi.fn())
const submitSoloGame = vi.hoisted(() => vi.fn())
const checkSoloAnswer = vi.hoisted(() => vi.fn())
vi.mock('../../api/games', async (orig) => ({
  ...(await orig<typeof import('../../api/games')>()),
  fetchSoloGame,
  submitSoloGame,
  checkSoloAnswer,
}))

/** Keyless, as the real API sends it: string ids, no `correct` on the options. */
const keyless = (): CabaranKilatPayload => ({
  sessionId: 'speed_0123456789abc',
  personalBest: 0,
  canEarnSyiling: false,
  questions: Array.from({ length: 30 }, (_, i) => ({
    id: String(500 + i),
    question_text: `Soalan kilat ${String(i + 1)}`,
    difficulty: (i % 4) + 1,
    options: [0, 1, 2, 3].map((o) => ({ id: o, text: `Pilihan ${String(o)}` })),
  })),
})

const deferred = <T>() => {
  let resolve: (v: T) => void = () => undefined
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}
const verdict = (correct: boolean) => ({ correct, correct_option_id: 1 })

let wrapper: VueWrapper | undefined

beforeEach(() => {
  vi.stubEnv('VITE_API_MODE', 'http')
  vi.useFakeTimers()
  fetchSoloGame.mockReset()
  submitSoloGame.mockReset()
  checkSoloAnswer.mockReset()
  fetchSoloGame.mockImplementation(() => Promise.resolve(keyless()))
  submitSoloGame.mockResolvedValue(rawOk({ is_new_record: false, syiling_awarded: 0 }))
  checkSoloAnswer.mockResolvedValue(verdict(true))
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

const options = () => wrapper!.findAll('[data-testid="solo-option"]')
const start = async () => {
  wrapper = await mountAt(SoloCabaranKilatPage, '/permainan/cabaran-kilat?darjah=4')
  await vi.advanceTimersByTimeAsync(2400)
}

describe('S14 Cabaran Kilat, http mode (D58a)', () => {
  it('sends the check body and scores a correct answer, then moves on after 400 ms', async () => {
    await start()
    await options()[1]!.trigger('click')
    await vi.advanceTimersByTimeAsync(0)
    expect(checkSoloAnswer).toHaveBeenCalledWith('cabaran-kilat', {
      session_id: 'speed_0123456789abc',
      item_id: '500',
      option_id: 1,
    })
    expect(wrapper!.get('[data-testid="solo-score"]').text()).toBe('10')
    await vi.advanceTimersByTimeAsync(400)
    expect(wrapper!.text()).toContain('Soalan 2')
  })

  it('a wrong verdict gives no points and resets the combo', async () => {
    checkSoloAnswer.mockResolvedValueOnce(verdict(true)).mockResolvedValueOnce(verdict(false))
    await start()
    await options()[1]!.trigger('click')
    await vi.advanceTimersByTimeAsync(400)
    await options()[2]!.trigger('click')
    await vi.advanceTimersByTimeAsync(0)
    expect(wrapper!.get('[data-testid="solo-score"]').text()).toBe('10')
    expect(wrapper!.find('[data-testid="solo-combo"]').exists()).toBe(false)
  })

  it('blocks input while the check is pending', async () => {
    const d = deferred<ReturnType<typeof verdict>>()
    checkSoloAnswer.mockReturnValueOnce(d.promise)
    await start()
    await options()[1]!.trigger('click')
    await options()[2]!.trigger('click')
    expect(checkSoloAnswer).toHaveBeenCalledTimes(1)
    d.resolve(verdict(true))
    await vi.advanceTimersByTimeAsync(0)
    expect(wrapper!.get('[data-testid="solo-score"]').text()).toBe('10')
  })

  it('a failed check (null) counts as wrong and the game keeps moving', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    checkSoloAnswer.mockRejectedValueOnce(new Error('boom'))
    await start()
    await options()[1]!.trigger('click')
    await vi.advanceTimersByTimeAsync(400)
    expect(log).toHaveBeenCalledWith('Check error:', expect.any(Error))
    expect(wrapper!.text()).toContain('Soalan 2')
    expect(wrapper!.get('[data-testid="solo-score"]').text()).toBe('0')
    log.mockRestore()
  })

  it('submits only the session id, after the pending check resolved and counted', async () => {
    const d = deferred<ReturnType<typeof verdict>>()
    checkSoloAnswer.mockReturnValueOnce(d.promise)
    await start()
    await options()[1]!.trigger('click')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(submitSoloGame).not.toHaveBeenCalled()
    d.resolve(verdict(true))
    await vi.advanceTimersByTimeAsync(0)
    expect(submitSoloGame).toHaveBeenCalledTimes(1)
    expect(submitSoloGame).toHaveBeenCalledWith('cabaran-kilat', { session_id: 'speed_0123456789abc' })
    expect(wrapper!.text()).toContain('1/1')
  })

  it('drops a result that arrives after a restart', async () => {
    const d = deferred<ReturnType<typeof verdict>>()
    checkSoloAnswer.mockReturnValueOnce(d.promise)
    await start()
    await options()[1]!.trigger('click')
    await vi.advanceTimersByTimeAsync(60_000)
    d.resolve(verdict(true))
    await vi.advanceTimersByTimeAsync(0)
    await wrapper!.get('[data-testid="solo-again"]').trigger('click')
    await vi.advanceTimersByTimeAsync(2400)
    expect(wrapper!.get('[data-testid="solo-score"]').text()).toBe('0')
    expect(wrapper!.text()).toContain('Soalan 1')
  })

  it('a 409 resolves the item with 0 points, logs the status only and is never re-posted', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    checkSoloAnswer.mockRejectedValueOnce(new ApiError({ status: 409, code: 'CONFLICT', message: 'Soalan sudah dijawab.' }))
    await start()
    await options()[1]!.trigger('click')
    await vi.advanceTimersByTimeAsync(400)
    expect(log).toHaveBeenCalledWith('Check error:', 409)
    expect(wrapper!.text()).toContain('Soalan 2')
    expect(wrapper!.get('[data-testid="solo-score"]').text()).toBe('0')
    expect(checkSoloAnswer).toHaveBeenCalledTimes(1)
    log.mockRestore()
  })

  it('shows the score and counts the server computed, not the local ones', async () => {
    submitSoloGame.mockResolvedValue(
      rawOk({ is_new_record: false, syiling_awarded: 0, score: 99, correct_count: 7, total_answered: 9 }),
    )
    await start()
    await options()[1]!.trigger('click') // local: 10 points, 1/1
    await vi.advanceTimersByTimeAsync(60_000)
    const overlay = wrapper!.text()
    expect(overlay).toContain('99')
    expect(overlay).toContain('7/9')
    expect(overlay).not.toContain('1/1')
  })
})
