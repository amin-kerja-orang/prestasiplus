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

  it('FR-MUR-13-10: typing without a pause still reaches the server every 15 s while dirty, then the timer stops', async () => {
    const { auto, server, attemptId, view } = await setup()
    const q = view.questions[0]!.id
    const save = vi.spyOn(server, 'saveAnswers')
    // A keystroke every 500 ms: the 800 ms debounce never fires.
    for (let i = 1; i <= 29; i++) {
      auto.setAnswer(q, { choice: `c${i}` })
      await vi.advanceTimersByTimeAsync(500)
    }
    expect(save).not.toHaveBeenCalled()
    auto.setAnswer(q, { choice: 'c30' })
    await vi.advanceTimersByTimeAsync(500)
    expect(save).toHaveBeenCalledTimes(1)
    expect(server.debugSaved(attemptId)[q]!.answer.choice).toBe('c30')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(save).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('a choose-N tick made while a request is in flight stays unsent until a later request carries it', async () => {
    const { auto, server, view } = await setup()
    const q = view.questions[0]!.id
    const save = vi.spyOn(server, 'saveAnswers')
    auto.setAnswer(q, { choice: 'a' })
    const first = auto.flush()
    auto.setPicks({ s1: [q] })
    await first
    await vi.advanceTimersByTimeAsync(2000)
    const payloads = save.mock.calls.map((c) => c[2] as { picks: Record<string, string[]> })
    expect(payloads.at(-1)!.picks).toEqual({ s1: [q] })
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

describe('flushHidden (lead ruling Q4: keepalive PUT on pagehide / hidden tab)', () => {
  function bare(saveKeepalive?: (p: unknown) => boolean) {
    const calls: unknown[] = []
    const auto = createAutosave({
      attemptId: 'a1',
      storage: new MemoryStorage(),
      api: {
        save: () => Promise.resolve({ closed: false }),
        ...(saveKeepalive ? { saveKeepalive: (p) => (calls.push(p), saveKeepalive(p)) } : {}),
      },
    })
    auto.init({ answers: {}, flags: [], picks: {}, position: 0 })
    return { auto, calls }
  }

  it('sends only the dirty changes through the keepalive path, and keeps them pending', () => {
    const { auto, calls } = bare(() => true)
    auto.setAnswer('p1', { text: 'satu' })
    auto.setAnswer('p2', { text: 'dua' })
    expect(auto.flushHidden()).toBe(true)
    expect(calls).toHaveLength(1)
    const sent = calls[0] as { changes: { partId: string; rev: number }[] }
    expect(sent.changes.map((c) => c.partId)).toEqual(['p1', 'p2'])
    expect(auto.pendingCount()).toBe(2)
  })

  it('sends nothing when nothing is dirty', () => {
    const { auto, calls } = bare(() => true)
    expect(auto.flushHidden()).toBe(false)
    expect(calls).toHaveLength(0)
  })

  it('returns false when the api cannot send (too large, or no keepalive)', () => {
    const refusing = bare(() => false)
    refusing.auto.setAnswer('p1', { text: 'x' })
    expect(refusing.auto.flushHidden()).toBe(false)
    const none = bare()
    none.auto.setAnswer('p1', { text: 'x' })
    expect(none.auto.flushHidden()).toBe(false)
    expect(none.auto.pendingCount()).toBe(1)
  })

  it('sends nothing once disposed', () => {
    const { auto, calls } = bare(() => true)
    auto.setAnswer('p1', { text: 'x' })
    auto.dispose()
    expect(auto.flushHidden()).toBe(false)
    expect(calls).toHaveLength(0)
  })
})
