/** D58a answer checking (components/solo/solo-check.ts): synchronous key in mock mode, check route in http mode. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createInflight,
  judgeBetulSalah,
  judgeCabaranKilat,
  judgePair,
  judgeSusunJawapan,
  judgeTembakJawapan,
  revealCard,
  settle,
} from '../../components/solo/solo-check'

const checkSoloAnswer = vi.hoisted(() => vi.fn())
const revealKadMemoriCard = vi.hoisted(() => vi.fn())
vi.mock('../../api/games', async (orig) => ({
  ...(await orig<typeof import('../../api/games')>()),
  checkSoloAnswer,
  revealKadMemoriCard,
}))

beforeEach(() => {
  checkSoloAnswer.mockReset()
  revealKadMemoriCard.mockReset()
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('mock mode: the key of the payload, synchronously, no request', () => {
  beforeEach(() => vi.stubEnv('VITE_API_MODE', 'mock'))

  it('judges each game from the payload', () => {
    expect(judgeBetulSalah('s', { id: 1, is_true: false }, false)).toEqual({ correct: true })
    expect(
      judgeCabaranKilat('s', { id: 1, options: [{ id: 0, correct: false }, { id: 1, correct: true }] }, 0),
    ).toEqual({ correct: false, correctOptionId: 1 })
    expect(judgeTembakJawapan('s', { id: 1, options: [{ correct: true }, { correct: false }] }, 0)).toEqual({
      correct: true,
      correctIndex: 0,
    })
    expect(judgeSusunJawapan('s', { id: 1, type: 'words', answer: 'Kuala Lumpur' }, ['kuala', 'lumpur'])).toEqual({
      correct: true,
      answer: 'Kuala Lumpur',
    })
    const q = { id: 1, pair_id: 2, type: 'question' as const, content: '7 + 5' }
    const a = { id: 2, pair_id: 2, type: 'answer' as const, content: '12' }
    expect(revealCard('s', q)).toEqual({ type: 'question', content: '7 + 5' })
    expect(judgePair('s', q, a)).toEqual({
      correct: true,
      faces: [
        { type: 'question', content: '7 + 5' },
        { type: 'answer', content: '12' },
      ],
    })
    expect(judgePair('s', q, { ...a, type: 'question' })).toMatchObject({ correct: false })
    expect(checkSoloAnswer).not.toHaveBeenCalled()
    expect(revealKadMemoriCard).not.toHaveBeenCalled()
  })

  it('settle applies a value at once', () => {
    let got = 0
    settle(3, (v) => (got = v))
    expect(got).toBe(3)
  })
})

describe('http mode: the check / reveal routes with string ids', () => {
  beforeEach(() => vi.stubEnv('VITE_API_MODE', 'http'))

  it('posts the contract bodies and maps the results', async () => {
    checkSoloAnswer.mockResolvedValueOnce({ correct: true, is_true: true })
    await expect(judgeBetulSalah('S', { id: '430' }, true)).resolves.toMatchObject({ correct: true })
    expect(checkSoloAnswer).toHaveBeenLastCalledWith('betul-salah', { session_id: 'S', item_id: '430', answer: true })

    checkSoloAnswer.mockResolvedValueOnce({ correct: false, correct_option_id: 3 })
    await expect(judgeCabaranKilat('S', { id: 9, options: [] }, 1)).resolves.toEqual({
      correct: false,
      correctOptionId: 3,
    })
    expect(checkSoloAnswer).toHaveBeenLastCalledWith('cabaran-kilat', { session_id: 'S', item_id: '9', option_id: 1 })

    checkSoloAnswer.mockResolvedValueOnce({ correct: false, correct_option_index: 2 })
    await expect(judgeTembakJawapan('S', { id: '7', options: [] }, 0)).resolves.toEqual({
      correct: false,
      correctIndex: 2,
    })
    expect(checkSoloAnswer).toHaveBeenLastCalledWith('tembak-jawapan', {
      session_id: 'S',
      item_id: '7',
      option_index: 0,
    })

    checkSoloAnswer.mockResolvedValueOnce({ correct: true, answer: 'Muharam' })
    await expect(judgeSusunJawapan('S', { id: '264', type: 'letters' }, ['M', 'u', 'h', 'a', 'r', 'a', 'm'])).resolves.toEqual({
      correct: true,
      answer: 'Muharam',
    })
    expect(checkSoloAnswer).toHaveBeenLastCalledWith('susun-jawapan', { session_id: 'S', item_id: '264', answer: 'Muharam' })

    revealKadMemoriCard.mockResolvedValueOnce({ id: 'c7', type: 'question', content: '7 + 5' })
    await expect(revealCard('S', { id: 'c7' })).resolves.toEqual({ type: 'question', content: '7 + 5' })
    expect(revealKadMemoriCard).toHaveBeenLastCalledWith({ session_id: 'S', card_id: 'c7' })

    checkSoloAnswer.mockResolvedValueOnce({
      correct: true,
      pair_id: 3,
      cards: [
        { id: 'c7', type: 'question', content: '7 + 5' },
        { id: 'c2', type: 'answer', content: '12' },
      ],
    })
    await expect(judgePair('S', { id: 'c7' }, { id: 'c2' })).resolves.toMatchObject({ correct: true })
    expect(checkSoloAnswer).toHaveBeenLastCalledWith('kad-memori', { session_id: 'S', card_id: 'c7', other_card_id: 'c2' })
  })

  it('a failed call resolves to null and logs "Check error:"', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    checkSoloAnswer.mockRejectedValueOnce(new Error('409'))
    revealKadMemoriCard.mockRejectedValueOnce(new Error('409'))
    await expect(judgeBetulSalah('S', { id: 1 }, true)).resolves.toBeNull()
    await expect(revealCard('S', { id: 'x' })).resolves.toBeNull()
    expect(log).toHaveBeenCalledWith('Check error:', expect.any(Error))
    log.mockRestore()
  })

  it('the inflight tracker waits for every pending check', async () => {
    let release: (v: unknown) => void = () => undefined
    checkSoloAnswer.mockReturnValueOnce(new Promise((r) => (release = r)))
    const inflight = createInflight()
    void judgeBetulSalah('S', { id: 1 }, true, inflight)
    expect(inflight.size).toBe(1)
    let idle = false
    const waiting = inflight.idle().then(() => (idle = true))
    await Promise.resolve()
    expect(idle).toBe(false)
    release({ correct: true, is_true: true })
    await waiting
    expect(idle).toBe(true)
    expect(inflight.size).toBe(0)
  })
})
