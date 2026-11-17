import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { OverviewService, overviewOptionsFrom } from '../../../src/modules/practice/reads/overview/overview.service'

/**
 * `recentQuestions` of the dashboard is shared by every pupil of a form: reused for 60 s, stale-while-revalidate, single flight.
 * The service is built with empty collaborators and the two private steps (`formLevelId`, `loadRecentQuestions`) are stubbed, so only
 * the memo is under test.
 */
type Row = { id: string }
const row = (id: string): Row => ({ id })

function build(options: { bankTtlMs: number; recentTtlMs?: number }, forms: Record<string, string | null | 'none'>) {
  const svc = new (OverviewService as unknown as new (...args: unknown[]) => OverviewService)(...Array.from({ length: 10 }, () => ({})), options, {})
  const loads: { form: string | null; resolve: (r: Row[]) => void; reject: (e: Error) => void }[] = []
  const priv = svc as unknown as {
    formLevelId: (id: string) => Promise<string | null | 'none'>
    loadRecentQuestions: (form: string | null) => Promise<Row[]>
    recentQuestions: (who: { userId: string }) => Promise<Row[]>
  }
  vi.spyOn(priv, 'formLevelId').mockImplementation((id) => Promise.resolve(forms[id] ?? null))
  vi.spyOn(priv, 'loadRecentQuestions').mockImplementation(
    (form) =>
      new Promise<Row[]>((resolve, reject) => {
        loads.push({ form, resolve, reject })
      }),
  )
  return { loads, read: (userId: string) => priv.recentQuestions({ userId }) }
}

const flush = () => new Promise<void>((r) => setImmediate(r))

describe('dashboard latest questions memo', () => {
  let now = 1_000_000
  beforeEach(() => {
    now = 1_000_000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
  })
  afterEach(() => vi.restoreAllMocks())

  it('pupils of one form share one read; another form reads its own', async () => {
    const { loads, read } = build({ bankTtlMs: 60_000 }, { a: 'T4', b: 'T4', c: 'T5' })
    const first = [read('a'), read('b')]
    await flush()
    expect(loads).toHaveLength(1) // single flight on a cold start
    loads[0]?.resolve([row('1')])
    expect(await Promise.all(first)).toEqual([[row('1')], [row('1')]])
    expect(await read('a')).toEqual([row('1')])
    expect(loads).toHaveLength(1) // reused, nothing read
    const other = read('c')
    await flush()
    expect(loads.map((l) => l.form)).toEqual(['T4', 'T5'])
    loads[1]?.resolve([row('5')])
    expect(await other).toEqual([row('5')])
  })

  it('a role without a form shares one list; a form without a level row is empty and never read', async () => {
    const { loads, read } = build({ bankTtlMs: 60_000 }, { staff: null, odd: 'none' })
    const a = read('staff')
    const b = read('staff')
    await flush()
    expect(loads).toHaveLength(1)
    expect(loads[0]?.form).toBeNull()
    loads[0]?.resolve([row('9')])
    expect(await Promise.all([a, b])).toEqual([[row('9')], [row('9')]])
    expect(await read('odd')).toEqual([])
    expect(loads).toHaveLength(1)
  })

  it('after 60 s the old list is served at once and ONE refresh runs behind it', async () => {
    const { loads, read } = build({ bankTtlMs: 60_000 }, { a: 'T4' })
    const cold = read('a')
    await flush()
    loads[0]?.resolve([row('old')])
    await cold
    now += 59_999
    await read('a')
    expect(loads).toHaveLength(1) // still inside the TTL
    now += 2
    const served = await Promise.all([read('a'), read('a'), read('a')])
    expect(served).toEqual([[row('old')], [row('old')], [row('old')]]) // nobody waits for the refresh
    expect(loads).toHaveLength(2) // exactly one refresh
    loads[1]?.resolve([row('new')])
    await flush()
    expect(await read('a')).toEqual([row('new')])
    expect(loads).toHaveLength(2) // the TTL restarted at the refresh
  })

  it('a failed first read is not remembered; a failed refresh keeps the stale list', async () => {
    const { loads, read } = build({ bankTtlMs: 60_000 }, { a: 'T4' })
    const failing = read('a')
    await flush()
    loads[0]?.reject(new Error('db down'))
    await expect(failing).rejects.toThrow('db down')
    const retry = read('a')
    await flush()
    expect(loads).toHaveLength(2)
    loads[1]?.resolve([row('ok')])
    await retry
    now += 61_000
    expect(await read('a')).toEqual([row('ok')])
    loads[2]?.reject(new Error('still down'))
    await flush()
    expect(await read('a')).toEqual([row('ok')]) // stale kept
    expect(loads).toHaveLength(4) // and the next read tries again (one at a time)
  })

  it('a zero TTL (tests, OVERVIEW_BANK_TTL_SECONDS=0) reads every time', async () => {
    const { loads, read } = build({ bankTtlMs: 0 }, { a: 'T4' })
    const a = read('a')
    await flush()
    loads[0]?.resolve([row('1')])
    await a
    const b = read('a')
    await flush()
    expect(loads).toHaveLength(2)
    loads[1]?.resolve([row('2')])
    expect(await b).toEqual([row('2')])
  })

  it('the list TTL follows the bank TTL but never exceeds 60 s unless set', async () => {
    const { loads, read } = build({ bankTtlMs: 300_000 }, { a: 'T4' })
    const a = read('a')
    await flush()
    loads[0]?.resolve([row('1')])
    await a
    now += 61_000
    await read('a')
    expect(loads).toHaveLength(2)
  })
})

describe('overviewOptionsFrom', () => {
  it('OVERVIEW_BANK_TTL_SECONDS: blank or invalid = 60 s, 0 = never, a number = seconds', () => {
    expect(overviewOptionsFrom(undefined).bankTtlMs).toBe(60_000)
    expect(overviewOptionsFrom('').bankTtlMs).toBe(60_000)
    expect(overviewOptionsFrom('x').bankTtlMs).toBe(60_000)
    expect(overviewOptionsFrom('-1').bankTtlMs).toBe(60_000)
    expect(overviewOptionsFrom('0').bankTtlMs).toBe(0)
    expect(overviewOptionsFrom('300').bankTtlMs).toBe(300_000)
  })
})
