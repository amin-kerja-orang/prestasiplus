// @vitest-environment jsdom
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'

import { GENERIC_ERROR } from '../../components/lobby/lobby-lib'
import SoloKadMemoriPage from '../../pages/SoloKadMemoriPage.vue'
import { mountAt, rawOk } from './helpers'

const fetchSoloGame = vi.hoisted(() => vi.fn())
const submitSoloGame = vi.hoisted(() => vi.fn())
const checkSoloAnswer = vi.hoisted(() => vi.fn())
const revealKadMemoriCard = vi.hoisted(() => vi.fn())
vi.mock('../../api/games', async (orig) => ({
  ...(await orig<typeof import('../../api/games')>()),
  fetchSoloGame,
  submitSoloGame,
  checkSoloAnswer,
  revealKadMemoriCard,
}))

let wrapper: VueWrapper | undefined

// Keyless board: opaque string ids "101".."112"; card 101+p is the question of pair p, 107+p its answer.
const keylessPayload = () => ({
  sessionId: 'mem_0123456789abc',
  personalBest: 0,
  canEarnSyiling: false,
  cards: Array.from({ length: 12 }, (_, i) => ({ id: String(101 + i) })),
})
const faceOf = (n: number) =>
  n <= 106
    ? { id: String(n), type: 'question' as const, content: `S${String(n - 101)}` }
    : { id: String(n), type: 'answer' as const, content: `J${String(n - 107)}` }
const pairOf = (n: number) => (n <= 106 ? n - 101 : n - 107)

const conflict = () => new ApiError({ status: 409, code: 'CONFLICT', message: 'Soalan sudah dijawab.' })

function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

beforeEach(() => {
  vi.stubEnv('VITE_API_MODE', 'http')
  vi.useFakeTimers()
  for (const m of [fetchSoloGame, submitSoloGame, checkSoloAnswer, revealKadMemoriCard]) m.mockReset()
  fetchSoloGame.mockImplementation(() => Promise.resolve(keylessPayload()))
  submitSoloGame.mockResolvedValue(rawOk({ results: { syiling_earned: 3, accuracy: 100 } }))
  revealKadMemoriCard.mockImplementation((b: { card_id: string }) => Promise.resolve(faceOf(Number(b.card_id))))
  checkSoloAnswer.mockImplementation((_g: string, b: { card_id: string; other_card_id: string }) => {
    const a = Number(b.card_id)
    const o = Number(b.other_card_id)
    return Promise.resolve({
      correct: pairOf(a) === pairOf(o) && (a <= 106) !== (o <= 106),
      pair_id: pairOf(a),
      cards: [faceOf(a), faceOf(o)],
    })
  })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

const card = (n: number) => wrapper!.findAll('[data-testid="solo-card-item"]')[n - 101]!
const tap = async (n: number) => {
  await card(n).trigger('click')
  await vi.advanceTimersByTimeAsync(0)
}
const mount = async () => (wrapper = await mountAt(SoloKadMemoriPage, '/permainan/kad-memori'))

describe('S17 Kad Memori, http mode (keyless, D58a)', () => {
  it('reveals the first card through the reveal route and shows its face', async () => {
    await mount()
    expect(card(101).text()).toBe('❓')
    await tap(101)
    expect(revealKadMemoriCard).toHaveBeenCalledWith({ session_id: 'mem_0123456789abc', card_id: '101' })
    expect(card(101).attributes('data-state')).toBe('flipped')
    expect(card(101).attributes('data-type')).toBe('question')
    expect(card(101).text()).toBe('S0')
  })

  it('a correct pair matches; the check body carries the string ids', async () => {
    await mount()
    await tap(101)
    await tap(107)
    expect(checkSoloAnswer).toHaveBeenCalledWith('kad-memori', {
      session_id: 'mem_0123456789abc',
      card_id: '101',
      other_card_id: '107',
    })
    expect(card(101).attributes('data-state')).toBe('matched')
    expect(card(107).text()).toBe('J0')
    expect(wrapper!.get('[data-testid="solo-matched"]').text()).toBe('✅ 1 / 6 padan')
    expect(wrapper!.get('[data-testid="solo-moves"]').text()).toBe('👆 1 langkah')
  })

  it('a wrong pair shows wrong and flips back after 800 ms', async () => {
    await mount()
    await tap(101)
    await tap(108)
    expect(card(101).attributes('data-state')).toBe('wrong')
    expect(card(108).text()).toBe('J1')
    await tap(102) // locked
    expect(card(102).attributes('data-state')).toBe('hidden')
    await vi.advanceTimersByTimeAsync(800)
    expect(card(101).attributes('data-state')).toBe('hidden')
    expect(card(101).text()).toBe('❓')
    await tap(102)
    expect(card(102).attributes('data-state')).toBe('flipped')
  })

  it('blocks input while the reveal is pending; a failed reveal toasts and restarts the session', async () => {
    const d = deferred<null>()
    revealKadMemoriCard.mockImplementationOnce(() => d.promise.then(() => Promise.reject(new Error('boom'))))
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await mount()
    await tap(101)
    expect(card(101).attributes('data-state')).toBe('flipped')
    expect(card(101).text()).toBe('')
    await tap(107) // locked
    expect(checkSoloAnswer).not.toHaveBeenCalled()
    expect(card(107).attributes('data-state')).toBe('hidden')
    d.resolve(null)
    await vi.advanceTimersByTimeAsync(0)
    expect(err).toHaveBeenCalledWith('Check error:', 'Error')
    expect(useToast().toasts.value.map((t) => t.title)).toContain(GENERIC_ERROR)
    expect(fetchSoloGame).toHaveBeenCalledTimes(2) // a new session
    expect(card(101).attributes('data-state')).toBe('hidden')
    await tap(102) // the new board is playable
    expect(card(102).attributes('data-state')).toBe('flipped')
    err.mockRestore()
  })

  it('a reveal that is a 409 (card already open) toasts and restarts too', async () => {
    revealKadMemoriCard.mockRejectedValueOnce(conflict())
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await mount()
    await tap(101)
    expect(err).toHaveBeenCalledWith('Check error:', 409)
    expect(useToast().toasts.value.map((t) => t.title)).toContain(GENERIC_ERROR)
    expect(fetchSoloGame).toHaveBeenCalledTimes(2)
    expect(card(101).attributes('data-state')).toBe('hidden')
    err.mockRestore()
  })

  it('blocks input while the pair check is pending; a failed check toasts and restarts the session', async () => {
    const d = deferred<never>()
    checkSoloAnswer.mockImplementationOnce(() => d.promise)
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await mount()
    await tap(101)
    await tap(107)
    expect(wrapper!.get('[data-testid="solo-moves"]').text()).toBe('👆 1 langkah')
    await tap(103) // locked
    expect(card(103).attributes('data-state')).toBe('hidden')
    d.resolve(Promise.reject(conflict()) as never)
    await vi.advanceTimersByTimeAsync(0)
    expect(err).toHaveBeenCalledWith('Check error:', 409)
    expect(useToast().toasts.value.map((t) => t.title)).toContain(GENERIC_ERROR)
    expect(fetchSoloGame).toHaveBeenCalledTimes(2)
    expect(card(101).attributes('data-state')).toBe('hidden')
    expect(wrapper!.get('[data-testid="solo-moves"]').text()).toBe('👆 0 langkah')
    await tap(102)
    expect(card(102).attributes('data-state')).toBe('flipped')
    err.mockRestore()
  })

  it('a pair check that fails on the network toasts and restarts too', async () => {
    checkSoloAnswer.mockRejectedValueOnce(new Error('boom'))
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await mount()
    await tap(101)
    await tap(107)
    expect(useToast().toasts.value.map((t) => t.title)).toContain(GENERIC_ERROR)
    expect(fetchSoloGame).toHaveBeenCalledTimes(2)
    err.mockRestore()
  })

  it('submits only the session id, after the pending last check resolves', async () => {
    await mount()
    for (let p = 0; p < 5; p++) {
      await tap(101 + p)
      await tap(107 + p)
    }
    const last = deferred<unknown>()
    checkSoloAnswer.mockImplementationOnce(() => last.promise)
    await tap(106)
    await tap(112)
    expect(submitSoloGame).not.toHaveBeenCalled()
    last.resolve({ correct: true, pair_id: 5, cards: [faceOf(106), faceOf(112)] })
    await vi.advanceTimersByTimeAsync(0)
    expect(submitSoloGame).toHaveBeenCalledTimes(1)
    expect(submitSoloGame).toHaveBeenCalledWith('kad-memori', { session_id: 'mem_0123456789abc' })
    const overlay = wrapper!.get('[data-testid="solo-overlay"]')
    expect(overlay.text()).toContain('+3')
    expect(overlay.text()).toContain('100%')
  })

  it('ignores a pair result that lands after a restart', async () => {
    const d = deferred<unknown>()
    checkSoloAnswer.mockImplementationOnce(() => d.promise)
    await mount()
    for (let p = 0; p < 5; p++) {
      await tap(101 + p)
      await tap(107 + p)
    }
    await tap(106)
    await tap(112)
    void (wrapper!.vm as unknown as { $: { setupState: { start(): Promise<void> } } }).$.setupState.start()
    await vi.advanceTimersByTimeAsync(0)
    d.resolve({ correct: true, pair_id: 5, cards: [faceOf(106), faceOf(112)] })
    await vi.advanceTimersByTimeAsync(0)
    expect(wrapper!.get('[data-testid="solo-matched"]').text()).toBe('✅ 0 / 6 padan')
    expect(card(106).attributes('data-state')).toBe('hidden')
  })

  it('shows the moves and time the server counted, not the local ones', async () => {
    submitSoloGame.mockResolvedValue(
      rawOk({ results: { syiling_earned: 3, accuracy: 75, moves: 8, time_seconds: 41 } }),
    )
    await mount()
    for (let p = 0; p < 6; p++) {
      await tap(101 + p)
      await tap(107 + p)
    }
    const overlay = wrapper!.get('[data-testid="solo-overlay"]').text()
    expect(overlay).toContain('0:41')
    expect(overlay).toContain('8') // Langkah from the server (the local count is 6)
    expect(overlay).toContain('75%')
    expect(overlay).not.toContain('100%')
  })

  it('Cuba Semula after a failed load restarts the game and it plays', async () => {
    fetchSoloGame.mockRejectedValueOnce(new Error('offline'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    wrapper = await mountAt(SoloKadMemoriPage, '/permainan/kad-memori')
    const retry = wrapper.findAll('button').find((b) => b.text().includes('Cuba Semula'))!
    await retry.trigger('click')
    await vi.advanceTimersByTimeAsync(0)
    await tap(101)
    expect(card(101).attributes('data-state')).toBe('flipped')
    await vi.advanceTimersByTimeAsync(2000)
    expect(wrapper.get('[data-testid="solo-time"]').text()).toContain('0:02')
  })

  it('a result that settles after the page was left shows no toast and starts no session', async () => {
    useToast().clear()
    const d = deferred<null>()
    revealKadMemoriCard.mockImplementationOnce(() => d.promise.then(() => Promise.reject(new Error('boom'))))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await mount()
    await tap(101)
    wrapper!.unmount()
    wrapper = undefined
    d.resolve(null)
    await vi.advanceTimersByTimeAsync(0)
    expect(useToast().toasts.value).toHaveLength(0)
    expect(fetchSoloGame).toHaveBeenCalledTimes(1)
  })

  it('a pair check that throws while being read unlocks the board', async () => {
    checkSoloAnswer.mockResolvedValueOnce({ correct: true }) // no `cards`: reading the faces throws
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await mount()
    await tap(101)
    await tap(107)
    expect(err).toHaveBeenCalledWith('Check error:', 'TypeError')
    expect(card(101).attributes('data-state')).toBe('hidden')
    await tap(102)
    expect(card(102).attributes('data-state')).toBe('flipped')
  })
})
