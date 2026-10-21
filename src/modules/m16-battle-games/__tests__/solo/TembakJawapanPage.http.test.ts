// @vitest-environment jsdom
import type { VueWrapper } from '@vue/test-utils'
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { TembakJawapanPayload } from '../../api'
import SoloTembakJawapanPage from '../../pages/SoloTembakJawapanPage.vue'
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

/** A keyless payload (D58a): string ids, no `correct`. The server key is option 0 of every question. */
const keyless = (): TembakJawapanPayload => ({
  sessionId: 'shoot_0123456789abc',
  personalBest: 0,
  canEarnSyiling: true,
  questions: Array.from({ length: 30 }, (_, i) => ({
    id: String(430 + i),
    question: `Soalan tembak ${String(i + 1)}`,
    difficulty: 1,
    options: [0, 1, 2, 3].map((o) => ({ text: `Jawapan ${String(o)}` })),
  })),
})

const serverCheck = (_game: string, body: { option_index: number }) =>
  Promise.resolve({ correct: body.option_index === 0, correct_option_index: 0 })

function deferred<T>() {
  let resolve!: (v: T) => void
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
  checkSoloAnswer.mockImplementation(serverCheck)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const tiles = () => wrapper!.findAll('[data-testid="solo-tile"]')
const lost = () => wrapper!.findAll('[data-testid="solo-heart"]').filter((h) => h.attributes('data-lost') === 'true')
const text = (id: string) => wrapper!.get(`[data-testid="${id}"]`).text()

async function startPlaying(): Promise<void> {
  wrapper = await mountAt(SoloTembakJawapanPage, '/permainan/tembak-jawapan?darjah=4')
  await vi.advanceTimersByTimeAsync(2400)
}
async function tap(i: number): Promise<void> {
  await tiles()[i]!.trigger('click')
  await flushPromises()
}

describe('Tembak Jawapan, http mode (D58a)', () => {
  it('a correct answer scores as in mock and sends the exact check body', async () => {
    await startPlaying()
    await tap(0)
    expect(checkSoloAnswer).toHaveBeenCalledWith('tembak-jawapan', {
      session_id: 'shoot_0123456789abc',
      item_id: '430',
      option_index: 0,
    })
    expect(text('solo-score')).toBe('10')
    expect(text('solo-coins')).toBe('🪙 1')
    expect(wrapper!.text()).toContain('Soalan 2')
  })

  it('a wrong answer costs a life, turns the tile red and keeps the question', async () => {
    await startPlaying()
    await vi.advanceTimersByTimeAsync(1800)
    await tap(1)
    expect(lost()).toHaveLength(1)
    expect(tiles()[1]!.attributes('data-wrong')).toBe('true')
    expect(wrapper!.text()).toContain('Soalan 1')
    expect(text('solo-score')).toBe('0')
  })

  it('a later tap uses the revealed key locally: wrong costs a life, the right tile scores nothing', async () => {
    await startPlaying()
    await vi.advanceTimersByTimeAsync(3600)
    await tap(1) // server: wrong, reveals option 0
    await tap(2) // local wrong
    expect(lost()).toHaveLength(2)
    await tap(0) // local correct: resolves the question, scores nothing
    expect(checkSoloAnswer).toHaveBeenCalledTimes(1)
    expect(wrapper!.text()).toContain('Soalan 2')
    expect(text('solo-score')).toBe('0')
    expect(text('solo-coins')).toBe('🪙 0')
    expect(text('solo-level')).toBe('1')
  })

  it('ignores taps while the check is pending', async () => {
    const d = deferred<{ correct: boolean; correct_option_index: number }>()
    checkSoloAnswer.mockImplementationOnce(() => d.promise)
    await startPlaying()
    await vi.advanceTimersByTimeAsync(1800)
    await tap(0)
    await tap(1)
    expect(checkSoloAnswer).toHaveBeenCalledTimes(1)
    expect(lost()).toHaveLength(0)
    d.resolve({ correct: true, correct_option_index: 0 })
    await flushPromises()
    expect(text('solo-score')).toBe('10')
  })

  it('a failed check (null) changes nothing and allows the tap again', async () => {
    checkSoloAnswer.mockImplementationOnce(() => Promise.reject(new Error('boom')))
    await startPlaying()
    await tap(0)
    expect(lost()).toHaveLength(0)
    expect(text('solo-score')).toBe('0')
    await tap(0)
    expect(checkSoloAnswer).toHaveBeenCalledTimes(2)
    expect(text('solo-score')).toBe('10')
  })

  it('holds a deadline miss back until the pending check answers', async () => {
    const d = deferred<{ correct: boolean; correct_option_index: number }>()
    checkSoloAnswer.mockImplementationOnce(() => d.promise)
    await startPlaying()
    await tap(0)
    await vi.advanceTimersByTimeAsync(40_000) // far past the deadline
    expect(lost()).toHaveLength(0)
    expect(wrapper!.text()).toContain('Soalan 1')
    d.resolve({ correct: false, correct_option_index: 0 })
    await flushPromises()
    expect(wrapper!.text()).toContain('Soalan 2') // wrong tap (-1) then the miss (-1)
    expect(lost()).toHaveLength(2)
  })

  it('submits only the session id, after the last pending check resolved', async () => {
    const d = deferred<{ correct: boolean; correct_option_index: number }>()
    await startPlaying()
    for (let i = 0; i < 29; i++) await tap(0)
    checkSoloAnswer.mockImplementationOnce(() => d.promise)
    await tiles()[0]!.trigger('click')
    await flushPromises()
    expect(submitSoloGame).not.toHaveBeenCalled()
    d.resolve({ correct: true, correct_option_index: 0 })
    await flushPromises()
    expect(submitSoloGame).toHaveBeenCalledTimes(1)
    expect(submitSoloGame).toHaveBeenCalledWith('tembak-jawapan', { session_id: 'shoot_0123456789abc' })
  })

  it('drops a stale result after a restart (darjah changed while pending)', async () => {
    const d = deferred<{ correct: boolean; correct_option_index: number }>()
    checkSoloAnswer.mockImplementationOnce(() => d.promise)
    await startPlaying()
    await tap(0)
    await wrapper!.vm.$router.push('/permainan/tembak-jawapan?darjah=5')
    await vi.advanceTimersByTimeAsync(2400)
    d.resolve({ correct: true, correct_option_index: 0 })
    await flushPromises()
    expect(text('solo-score')).toBe('0')
    expect(wrapper!.text()).toContain('Soalan 1')
    expect(checkSoloAnswer).toHaveBeenCalledTimes(1)
  })
})
