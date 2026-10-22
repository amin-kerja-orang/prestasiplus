// @vitest-environment jsdom
import type { VueWrapper } from '@vue/test-utils'
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'

import type { SusunJawapanPayload } from '../../api'
import SoloSusunJawapanPage from '../../pages/SoloSusunJawapanPage.vue'
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

/** A keyless payload (D58a): string ids, no `answer`. The server key is "ABC". */
const keyless = (): SusunJawapanPayload => ({
  sessionId: 'ws_0123456789abc',
  personalBest: 0,
  canEarnSyiling: true,
  puzzles: Array.from({ length: 20 }, (_, i) => ({
    id: String(900 + i),
    question: `Susun ${String(i + 1)}`,
    scrambled: ['C', 'A', 'B'],
    type: 'letters' as const,
    difficulty: 1,
    points: 6,
  })),
})

const serverCheck = (_game: string, body: { answer: string }) =>
  Promise.resolve({ correct: body.answer === 'ABC', answer: 'ABC' })

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
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const byTestId = (id: string) => wrapper!.get(`[data-testid="${id}"]`)
const source = (letter: string) => wrapper!.findAll('[data-testid="solo-tile"]').find((t) => t.text() === letter)!
const dots = () => wrapper!.findAll('[data-testid="solo-dot"]').map((d) => d.attributes('data-state'))
async function spell(letters: string): Promise<void> {
  for (const l of letters) await source(l).trigger('click')
}
async function semak(): Promise<void> {
  await byTestId('solo-check').trigger('click')
  await flushPromises()
}
async function open(): Promise<void> {
  wrapper = await mountAt(SoloSusunJawapanPage, '/permainan/susun-jawapan?darjah=4')
}

describe('Susun Jawapan, http mode (D58a)', () => {
  it('a correct arrangement scores as in mock and sends the exact check body', async () => {
    await open()
    await spell('ABC')
    await semak()
    expect(checkSoloAnswer).toHaveBeenCalledWith('susun-jawapan', {
      session_id: 'ws_0123456789abc',
      item_id: '900',
      answer: 'ABC',
    })
    expect(byTestId('solo-feedback').text()).toBe('🎉 BETUL! +6 mata')
    expect(byTestId('solo-score').text()).toContain('6')
    expect(dots()[0]).toBe('done')
  })

  it('a wrong arrangement shows the wrong panel', async () => {
    await open()
    await spell('CAB')
    await semak()
    expect(byTestId('solo-feedback').text()).toBe('❌ Cuba lagi atau langkau')
    expect(byTestId('solo-score').text()).toContain('0')
  })

  it('blocks Semak and tile moves while the check is pending', async () => {
    const d = deferred<{ correct: boolean; answer: string }>()
    checkSoloAnswer.mockImplementationOnce(() => d.promise)
    await open()
    await spell('ABC')
    await semak()
    expect(byTestId('solo-check').attributes('disabled')).toBeDefined()
    await byTestId('solo-check').trigger('click')
    await byTestId('solo-drop').trigger('click') // removeLast
    await wrapper!.get('[data-testid="solo-placed"]').trigger('click')
    expect(checkSoloAnswer).toHaveBeenCalledTimes(1)
    expect(wrapper!.findAll('[data-testid="solo-placed"]')).toHaveLength(3)
    d.resolve({ correct: true, answer: 'ABC' })
    await flushPromises()
    expect(byTestId('solo-feedback').text()).toBe('🎉 BETUL! +6 mata')
  })

  it('after Cuba lagi a match is judged locally: "+0 mata", no score, the dot ends red', async () => {
    await open()
    await spell('CAB')
    await semak()
    await byTestId('solo-retry').trigger('click')
    await spell('ABC')
    await semak()
    expect(checkSoloAnswer).toHaveBeenCalledTimes(1)
    expect(byTestId('solo-feedback').text()).toBe('🎉 BETUL! +0 mata')
    expect(byTestId('solo-score').text()).toContain('0')
    expect(byTestId('solo-coins').text()).toBe('🪙 0')
    await byTestId('solo-next').trigger('click')
    expect(dots()[0]).toBe('wrong')
    expect(wrapper!.text()).toContain('Soalan 2 daripada 20')
  })

  it('after Cuba lagi a non-match stays wrong without a server call', async () => {
    await open()
    await spell('CAB')
    await semak()
    await byTestId('solo-retry').trigger('click')
    await spell('BAC')
    await semak()
    expect(checkSoloAnswer).toHaveBeenCalledTimes(1)
    expect(byTestId('solo-feedback').text()).toBe('❌ Cuba lagi atau langkau')
  })

  it('a failed check (null) is wrong; the next try calls the server again', async () => {
    checkSoloAnswer.mockImplementationOnce(() => Promise.reject(new Error('boom')))
    await open()
    await spell('ABC')
    await semak()
    expect(byTestId('solo-feedback').text()).toBe('❌ Cuba lagi atau langkau')
    expect(byTestId('solo-score').text()).toContain('0')
    await byTestId('solo-retry').trigger('click')
    await spell('ABC')
    await semak()
    expect(checkSoloAnswer).toHaveBeenCalledTimes(2)
    expect(byTestId('solo-feedback').text()).toBe('🎉 BETUL! +6 mata')
  })

  it('submits only the session id, after the pending check resolved', async () => {
    await open()
    for (let i = 0; i < 19; i++) {
      await spell('ABC')
      await semak()
      await byTestId('solo-next').trigger('click')
    }
    const d = deferred<{ correct: boolean; answer: string }>()
    checkSoloAnswer.mockImplementationOnce(() => d.promise)
    await spell('ABC')
    await semak()
    expect(submitSoloGame).not.toHaveBeenCalled()
    d.resolve({ correct: true, answer: 'ABC' })
    await flushPromises()
    await byTestId('solo-next').trigger('click')
    await flushPromises()
    expect(submitSoloGame).toHaveBeenCalledTimes(1)
    expect(submitSoloGame).toHaveBeenCalledWith('susun-jawapan', { session_id: 'ws_0123456789abc' })
  })

  it('drops a stale result after a restart (darjah changed while pending)', async () => {
    const d = deferred<{ correct: boolean; answer: string }>()
    checkSoloAnswer.mockImplementationOnce(() => d.promise)
    await open()
    await spell('ABC')
    await semak()
    await wrapper!.vm.$router.push('/permainan/susun-jawapan?darjah=5')
    await flushPromises()
    d.resolve({ correct: true, answer: 'ABC' })
    await flushPromises()
    expect(byTestId('solo-score').text()).toContain('0')
    expect(wrapper!.find('[data-testid="solo-feedback"]').exists()).toBe(false)
  })

  it('a 409 is treated as a skip (0 points, red dot, next puzzle), logs the status only and never re-posts it', async () => {
    checkSoloAnswer.mockRejectedValueOnce(new ApiError({ status: 409, code: 'CONFLICT', message: 'Soalan sudah dijawab.' }))
    await open()
    await spell('ABC')
    await semak()
    expect(console.error).toHaveBeenCalledWith('Check error:', 409)
    expect(wrapper!.text()).not.toContain('BETUL!')
    expect(byTestId('solo-score').text()).toContain('0')
    expect(dots()[0]).toBe('wrong')
    expect(wrapper!.text()).toContain('Soalan 2 daripada 20')
    expect(checkSoloAnswer).toHaveBeenCalledTimes(1)
  })

  it('shows the score and solved count the server computed, not the local ones', async () => {
    submitSoloGame.mockResolvedValue(
      rawOk({ is_new_record: false, syiling_awarded: 0, score: 99, correct_count: 7, total_answered: 20 }),
    )
    await open()
    for (let i = 0; i < 20; i++) {
      await spell('ABC')
      await semak()
      await byTestId('solo-next').trigger('click')
    }
    await flushPromises()
    const overlay = wrapper!.text()
    expect(overlay).toContain('99')
    expect(overlay).toContain('7/20')
    expect(overlay).not.toContain('20/20')
  })

  it('Cuba Semula after a failed load restarts the game and it plays', async () => {
    fetchSoloGame.mockRejectedValueOnce(new Error('offline'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    wrapper = await mountAt(SoloSusunJawapanPage, '/permainan/susun-jawapan?darjah=4')
    const retry = wrapper.findAll('button').find((b) => b.text().includes('Cuba Semula'))!
    await retry.trigger('click')
    await flushPromises()
    await spell('ABC')
    await semak()
    expect(checkSoloAnswer).toHaveBeenCalledTimes(1)
    expect(byTestId('solo-feedback').text()).toBe('🎉 BETUL! +6 mata')
  })
})
