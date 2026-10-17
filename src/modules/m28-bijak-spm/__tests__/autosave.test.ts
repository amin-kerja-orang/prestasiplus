import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BANK } from '../data/registry'
import { createAutosave, LOCAL_PREFIX, type SaveStatus } from '../lib/autosave'
import { BijakServer, MemoryStorage } from '../server/store'

const USER = 3

const correct = (qid: string): string => {
  const s = BANK.schemes.get(qid)!
  if (s.kind !== 'option') throw new Error('mcq')
  return s.correct
}

async function setup(debounceMs = 800) {
  const serverStorage = new MemoryStorage()
  const localStorage = new MemoryStorage()
  const server = new BijakServer({ storage: serverStorage })
  const { attemptId } = await server.startAttempt(USER, 'mat-k1-2025-a', 'exam')
  const view = await server.getAttemptView(USER, attemptId)
  const statuses: SaveStatus[] = []
  const make = () =>
    createAutosave({
      attemptId,
      storage: localStorage,
      debounceMs,
      retryMs: 1000,
      api: { save: (p) => server.saveAnswers(USER, attemptId, p) },
      onStatus: (s) => statuses.push(s),
    })
  const auto = make()
  auto.init({ answers: {}, flags: [], picks: {}, position: 0 })
  return { server, serverStorage, localStorage, attemptId, view, auto, statuses, make }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('autosave', () => {
  it('writes locally at once and reaches the server only after the debounce', async () => {
    const { auto, server, attemptId, view, localStorage } = await setup()
    const q = view.questions[0]!.id
    auto.setAnswer(q, { choice: 'x' })
    expect(
      JSON.parse(localStorage.getItem(`${LOCAL_PREFIX}${attemptId}`)!).answers[q].answer.choice,
    ).toBe('x')
    expect(server.debugSaved(attemptId)[q]).toBeUndefined()
    await vi.advanceTimersByTimeAsync(799)
    expect(server.debugSaved(attemptId)[q]).toBeUndefined()
    await vi.advanceTimersByTimeAsync(5)
    expect(server.debugSaved(attemptId)[q]!.answer.choice).toBe('x')
    expect(auto.status()).toBe('saved')
  })

  it('coalesces fast typing into one revision per part sent', async () => {
    const { auto, view } = await setup()
    const q = view.questions[0]!.id
    auto.setAnswer(q, { choice: 'a' })
    auto.setAnswer(q, { choice: 'b' })
    auto.setAnswer(q, { choice: 'c' })
    expect(auto.snapshot().answers[q]!.rev).toBe(3)
    expect(auto.pendingCount()).toBe(1)
  })

  it('survives a refresh: pending answers are restored from the device and sent', async () => {
    const { auto, server, attemptId, view, make } = await setup()
    const q = view.questions[0]!.id
    auto.setAnswer(q, { choice: 'kept' })
    auto.dispose() // the page is gone before the debounce fired
    const fresh = make()
    const sv = await server.getAttemptView(USER, attemptId)
    fresh.init({
      answers: {},
      flags: sv.attempt.flags,
      picks: sv.attempt.picks,
      position: sv.attempt.position,
    })
    expect(fresh.answers()[q]).toEqual({ choice: 'kept' })
    await vi.advanceTimersByTimeAsync(900)
    expect(server.debugSaved(attemptId)[q]!.answer.choice).toBe('kept')
  })

  it('keeps answers when offline and sends them when the connection returns', async () => {
    const { auto, server, attemptId, view, statuses } = await setup()
    const q = view.questions[0]!.id
    server.setOffline(true)
    auto.setAnswer(q, { choice: 'offline' })
    await vi.advanceTimersByTimeAsync(900)
    expect(auto.status()).toBe('offline')
    expect(auto.pendingCount()).toBe(1)
    server.setOffline(false)
    await vi.advanceTimersByTimeAsync(1100)
    expect(auto.status()).toBe('saved')
    expect(server.debugSaved(attemptId)[q]!.answer.choice).toBe('offline')
    expect(statuses).toContain('offline')
  })

  it('submit flushes pending answers first, so nothing typed before the tap is lost (N-01)', async () => {
    const { auto, server, attemptId, view } = await setup()
    const [q1, q2] = view.questions
    auto.setAnswer(q1!.id, { choice: correct(q1!.id) })
    auto.setAnswer(q2!.id, { choice: correct(q2!.id) })
    // the debounce has NOT fired: the server knows nothing yet
    expect(Object.keys(server.debugSaved(attemptId))).toHaveLength(0)
    await auto.flush()
    const snap = auto.snapshot()
    await server.submit(USER, attemptId, {
      idempotencyKey: 'k',
      changes: [],
      answers: snap.answers,
      flags: snap.flags,
    })
    expect((await server.getResult(USER, attemptId)).result.score).toBe(2)
  })

  it('submit still grades the carried answers when the flush cannot reach the server', async () => {
    const { auto, server, attemptId, view } = await setup()
    const q = view.questions[0]!.id
    auto.setAnswer(q, { choice: correct(q) })
    server.setOffline(true)
    expect(await auto.flush()).toBe(false)
    server.setOffline(false)
    const snap = auto.snapshot()
    await server.submit(USER, attemptId, {
      idempotencyKey: 'k',
      changes: [],
      answers: snap.answers,
    })
    expect((await server.getResult(USER, attemptId)).result.score).toBe(1)
  })

  it('a part edited while a save is in flight stays pending', async () => {
    const { auto, view, server, attemptId } = await setup()
    const q = view.questions[0]!.id
    auto.setAnswer(q, { choice: 'one' })
    const flushing = auto.flush()
    auto.setAnswer(q, { choice: 'two' })
    await flushing
    await vi.advanceTimersByTimeAsync(900)
    expect(server.debugSaved(attemptId)[q]!.answer.choice).toBe('two')
  })

  it('merges server and device by revision', async () => {
    const { make, localStorage, attemptId } = await setup()
    localStorage.setItem(
      `${LOCAL_PREFIX}${attemptId}`,
      JSON.stringify({
        answers: { p: { answer: { text: 'device' }, rev: 2, savedAt: 1 } },
        pending: ['p'],
        flags: [],
        picks: {},
        position: 0,
        metaDirty: false,
      }),
    )
    const a = make()
    a.init({
      answers: { p: { answer: { text: 'server' }, rev: 3, savedAt: 2 } },
      flags: [],
      picks: {},
      position: 0,
    })
    expect(a.answers().p).toEqual({ text: 'server' })
    expect(a.pendingCount()).toBe(0)
  })
})
