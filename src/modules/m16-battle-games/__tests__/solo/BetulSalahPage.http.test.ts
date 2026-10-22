// @vitest-environment jsdom
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'

import type { BetulSalahPayload } from '../../api'
import SoloBetulSalahPage from '../../pages/SoloBetulSalahPage.vue'
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

/** Keyless, as the real API sends it: string ids, no `is_true`. */
const keyless = (): BetulSalahPayload => ({
  sessionId: 'tf_0123456789abc',
  personalBest: 0,
  canEarnSyiling: false,
  statements: Array.from({ length: 40 }, (_, i) => ({
    id: String(430 + i),
    statement: `Soalan ${String(i + 1)}`,
    difficulty: 1,
  })),
})

const deferred = <T>() => {
  let resolve: (v: T) => void = () => undefined
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

let wrapper: VueWrapper | undefined

beforeEach(() => {
  vi.stubEnv('VITE_API_MODE', 'http')
  vi.useFakeTimers()
  fetchSoloGame.mockReset()
  submitSoloGame.mockReset()
  checkSoloAnswer.mockReset()
  fetchSoloGame.mockImplementation(() => Promise.resolve(keyless()))
  submitSoloGame.mockResolvedValue(rawOk({ is_new_record: false, syiling_awarded: 0 }))
  checkSoloAnswer.mockResolvedValue({ correct: true })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

const click = async (testid: string) => {
  await wrapper!.get(`[data-testid="${testid}"]`).trigger('click')
}
const start = async () => {
  wrapper = await mountAt(SoloBetulSalahPage, '/permainan/betul-salah?darjah=4')
  await vi.advanceTimersByTimeAsync(2400)
}

describe('S13 Betul atau Salah, http mode (D58a)', () => {
  it('sends the check body and scores a correct answer as in mock mode', async () => {
    await start()
    await click('solo-betul')
    await vi.advanceTimersByTimeAsync(0)
    expect(checkSoloAnswer).toHaveBeenCalledWith('betul-salah', {
      session_id: 'tf_0123456789abc',
      item_id: '430',
      answer: true,
    })
    expect(wrapper!.get('[data-testid="solo-feedback"]').text()).toBe('✅')
    expect(wrapper!.get('[data-testid="solo-score"]').text()).toBe('12')
    await vi.advanceTimersByTimeAsync(700)
    expect(wrapper!.text()).toContain('Kenyataan 2')
  })

  it('a wrong verdict gives no points and resets the streak', async () => {
    checkSoloAnswer.mockResolvedValueOnce({ correct: true }).mockResolvedValueOnce({ correct: false })
    await start()
    await click('solo-betul')
    await vi.advanceTimersByTimeAsync(700)
    await click('solo-betul')
    await vi.advanceTimersByTimeAsync(0)
    expect(wrapper!.get('[data-testid="solo-feedback"]').text()).toBe('❌')
    expect(checkSoloAnswer).toHaveBeenLastCalledWith('betul-salah', {
      session_id: 'tf_0123456789abc',
      item_id: '431',
      answer: true,
    })
    await vi.advanceTimersByTimeAsync(700)
    expect(wrapper!.find('[data-testid="solo-combo"]').exists()).toBe(false)
    expect(wrapper!.get('[data-testid="solo-score"]').text()).toBe('12')
  })

  it('blocks input while the check is pending', async () => {
    const d = deferred<{ correct: boolean }>()
    checkSoloAnswer.mockReturnValueOnce(d.promise)
    await start()
    await click('solo-betul')
    expect(wrapper!.get('[data-testid="solo-betul"]').attributes('disabled')).toBeDefined()
    expect(wrapper!.get('[data-testid="solo-salah"]').attributes('disabled')).toBeDefined()
    await wrapper!.get('[data-testid="solo-salah"]').trigger('click')
    expect(checkSoloAnswer).toHaveBeenCalledTimes(1)
    expect(wrapper!.find('[data-testid="solo-feedback"]').exists()).toBe(false)
    d.resolve({ correct: true })
    await vi.advanceTimersByTimeAsync(0)
    expect(wrapper!.get('[data-testid="solo-feedback"]').text()).toBe('✅')
  })

  it('a failed check (null) counts as wrong and the game keeps moving', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    checkSoloAnswer.mockRejectedValueOnce(new Error('boom'))
    await start()
    await click('solo-betul')
    await vi.advanceTimersByTimeAsync(0)
    expect(log).toHaveBeenCalledWith('Check error:', 'Error')
    expect(wrapper!.get('[data-testid="solo-feedback"]').text()).toBe('❌')
    await vi.advanceTimersByTimeAsync(700)
    expect(wrapper!.text()).toContain('Kenyataan 2')
    expect(wrapper!.get('[data-testid="solo-score"]').text()).toBe('0')
    log.mockRestore()
  })

  it('submits only the session id, after the pending check resolved and counted', async () => {
    const d = deferred<{ correct: boolean }>()
    checkSoloAnswer.mockReturnValueOnce(d.promise)
    await start()
    await click('solo-betul')
    await vi.advanceTimersByTimeAsync(45_000) // the clock runs out while the check is in flight
    expect(submitSoloGame).not.toHaveBeenCalled()
    d.resolve({ correct: true })
    await vi.advanceTimersByTimeAsync(0)
    expect(submitSoloGame).toHaveBeenCalledTimes(1)
    expect(submitSoloGame).toHaveBeenCalledWith('betul-salah', { session_id: 'tf_0123456789abc' })
    // counted, but no feedback and no advance after time-out
    expect(wrapper!.text()).toContain('1/1')
    expect(wrapper!.find('[data-testid="solo-feedback"]').exists()).toBe(false)
  })

  it('drops a result that arrives after a restart', async () => {
    const d = deferred<{ correct: boolean }>()
    checkSoloAnswer.mockReturnValueOnce(d.promise)
    await start()
    await click('solo-betul')
    await vi.advanceTimersByTimeAsync(45_000)
    d.resolve({ correct: true })
    await vi.advanceTimersByTimeAsync(0)
    await click('solo-again')
    await vi.advanceTimersByTimeAsync(2400)
    expect(wrapper!.get('[data-testid="solo-score"]').text()).toBe('0')
    expect(wrapper!.text()).toContain('Kenyataan 1')
  })

  it('a 409 resolves the item with 0 points, logs the status only and is never re-posted', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    checkSoloAnswer.mockRejectedValueOnce(new ApiError({ status: 409, code: 'CONFLICT', message: 'Soalan sudah dijawab.' }))
    await start()
    await click('solo-betul')
    await vi.advanceTimersByTimeAsync(0)
    expect(log).toHaveBeenCalledWith('Check error:', 409)
    expect(wrapper!.get('[data-testid="solo-feedback"]').text()).toBe('❌')
    await vi.advanceTimersByTimeAsync(700)
    expect(wrapper!.text()).toContain('Kenyataan 2')
    expect(wrapper!.get('[data-testid="solo-score"]').text()).toBe('0')
    expect(checkSoloAnswer).toHaveBeenCalledTimes(1)
    log.mockRestore()
  })

  it('shows the score and counts the server computed, not the local ones', async () => {
    submitSoloGame.mockResolvedValue(
      rawOk({ is_new_record: false, syiling_awarded: 0, score: 99, correct_count: 7, total_answered: 9 }),
    )
    await start()
    await click('solo-betul') // local: 12 points, 1/1
    await vi.advanceTimersByTimeAsync(45_000)
    const overlay = wrapper!.text()
    expect(overlay).toContain('99')
    expect(overlay).toContain('7/9')
    expect(overlay).not.toContain('1/1')
  })

  it('Cuba Semula after a failed load restarts the game and it plays', async () => {
    fetchSoloGame.mockRejectedValueOnce(new Error('offline'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    wrapper = await mountAt(SoloBetulSalahPage, '/permainan/betul-salah?darjah=4')
    const retry = wrapper.findAll('button').find((b) => b.text().includes('Cuba Semula'))!
    await retry.trigger('click')
    await vi.advanceTimersByTimeAsync(2400)
    await click('solo-betul')
    await vi.advanceTimersByTimeAsync(0)
    expect(checkSoloAnswer).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-testid="solo-score"]').text()).toBe('12')
  })
})
