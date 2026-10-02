import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TransportRequest } from '@/api/transport'
import { createClock } from '@/lib/time'

import { floor, maxPlusOne } from '../../db/id-strategies'
import { defineTable } from '../../db/table'
import { defineVirtualDataset } from '../../dataset'
import { bootMock, knownDiffs, startMock, type MockPersistence } from '../../index'
import { defineMockModule, EMPTY_CORE } from '../plugin'
import { authHeaders, bootTest, makeCore, makeNotesModule, TEST_NOW } from './helpers'

afterEach(() => {
  vi.unstubAllEnvs()
})

const post = (url: string, body: unknown, token = 'tok-student'): TransportRequest => ({
  method: 'POST',
  url,
  headers: authHeaders(token),
  body,
})

interface Item {
  id: number
  kind: 'a' | 'b'
  label: string
}

/** A real F-09 virtual dataset with the given cell counts. */
function items(countA: number, countB: number) {
  return defineVirtualDataset<Item, 'kind'>({
    name: 'm91.items',
    owner: 'M91',
    idRange: { min: 1, max: 1_000 },
    runtimeIds: floor({ start: 2_000 }),
    facets: ['kind'],
    distribution: [
      { facets: { kind: 'a' }, count: countA },
      { facets: { kind: 'b' }, count: countB },
    ],
    derive: (id) => ({ label: `item ${String(id)}` }),
  })
}

function datasetModule(countA: number, countB: number) {
  const ds = items(countA, countB)
  return {
    ds,
    plugin: defineMockModule({ id: 'M91', dependsOn: ['core'], datasets: { items: ds } }),
  }
}

const boot = (plugin: ReturnType<typeof defineMockModule>) =>
  bootMock({
    mode: 'test',
    core: EMPTY_CORE,
    plugins: [plugin],
    clock: createClock(),
    latencyMs: 0,
  })

describe('seed composer with a real virtual dataset (F-09)', () => {
  it('compiles the dataset in the finalise phase and serves its counts', async () => {
    const { ds, plugin } = datasetModule(30, 12)
    const runtime = await boot(plugin)
    expect(runtime.seedSteps).toContain('compile:M91.items')
    expect(ds.compiled).toBe(true)
    expect(ds.count()).toBe(42)
    expect(ds.count({ kind: 'b' })).toBe(12)
  })

  it('a different distribution gives a different seed version', async () => {
    const v1 = (await boot(datasetModule(30, 12).plugin)).seedVersion
    const same = (await boot(datasetModule(30, 12).plugin)).seedVersion
    const v2 = (await boot(datasetModule(29, 13).plugin)).seedVersion
    expect(same).toBe(v1)
    expect(v2).not.toBe(v1)
  })

  it('a dataset without specHash() is rejected loudly', () => {
    const table = defineTable<{ id: number }>({ name: 'm91.nohash', ids: maxPlusOne() })
    expect(() => defineMockModule({ id: 'M91', datasets: { plain: table as never } })).toThrow(
      /dataset 'plain' has no specHash\(\)/,
    )
  })
})

describe('reset', () => {
  it('an unknown override key fails before anything is cleared', async () => {
    const { runtime, notes } = await bootTest()
    await runtime.server.handle(post('/api/notes', { text: 'kept' }))
    runtime.faults.failNext('/api/x', 500)
    await expect(runtime.reset({ extraNotez: 1 })).rejects.toThrow(/unknown key/)
    expect(runtime.db.phase).toBe('live')
    expect(notes.size).toBe(4)
    expect(runtime.faults.pending()).toBe(1)
    const res = await runtime.server.handle({
      method: 'GET',
      url: '/api/notes',
      headers: authHeaders(),
    })
    expect(res.status).toBe(200)
  })

  it('passes the overrides to persistence.clear', async () => {
    const clear = vi.fn<(overrides?: Readonly<Record<string, unknown>>) => Promise<void>>(() =>
      Promise.resolve(),
    )
    const persistence: MockPersistence = {
      load: () => Promise.resolve(null),
      attach: () => undefined,
      clear,
    }
    const { runtime } = await bootTest({ persistence })
    await runtime.reset({ extraNotes: 2 })
    expect(clear).toHaveBeenCalledWith({ extraNotes: 2 })
  })
})

describe('persisted diffs of unknown stores', () => {
  it('are dropped with a warning instead of failing the boot', async () => {
    const warnings: string[] = []
    const persistence: MockPersistence = {
      load: () =>
        Promise.resolve({
          diffs: {
            'gone.table': { kind: 'table', upserts: [], deletes: [], ids: null },
            'm90.notes': { kind: 'table', upserts: [], deletes: [1], ids: null },
          },
        }),
      attach: () => undefined,
      clear: () => Promise.resolve(),
    }
    const { notes } = await bootTest({ persistence, onWarn: (m) => warnings.push(m) })
    expect(notes.get(1)).toBeUndefined()
    expect(warnings).toEqual(["mock: dropped the stored diff of unknown store 'gone.table'"])
  })

  it('knownDiffs keeps known stores only', async () => {
    const { runtime } = await bootTest()
    expect(knownDiffs(runtime.db, { 'm90.notes': 1, x: 2 }, null)).toEqual({ 'm90.notes': 1 })
  })
})

describe('repository convention (F-10)', () => {
  it('boot rejects a plugin that exports a raw store as a repository', async () => {
    const table = defineTable<{ id: number }>({ name: 'm92.raw', ids: maxPlusOne() })
    const plugin = defineMockModule({ id: 'M92', tables: { table }, repositories: { table } })
    await expect(boot(plugin)).rejects.toThrow(/repository convention/)
  })
})

describe('outbox and emit follow the transaction', () => {
  async function setup() {
    const t = await bootTest({ onWarn: null })
    const events: unknown[] = []
    t.runtime.events.on('note-created', (payload) => events.push(payload))
    return { ...t, events }
  }

  it('a committed sync request delivers its messages and events', async () => {
    const { runtime, events } = await setup()
    const res = await runtime.server.handle(post('/api/notes/notify', { mode: 'ok' }))
    expect(res.status).toBe(201)
    expect(runtime.outbox.all()).toHaveLength(1)
    expect(events).toEqual([{ mode: 'ok' }])
  })

  it('a thrown or aborted request sends nothing', async () => {
    const { runtime, events, notes } = await setup()
    expect((await runtime.server.handle(post('/api/notes/notify', { mode: 'throw' }))).status).toBe(
      500,
    )
    expect((await runtime.server.handle(post('/api/notes/notify', { mode: 'abort' }))).status).toBe(
      409,
    )
    expect(runtime.outbox.all()).toEqual([])
    expect(events).toEqual([])
    expect(notes.size).toBe(3)
  })

  it('async handlers: ctx.transaction delivers on commit and drops on rollback', async () => {
    const { runtime, events } = await setup()
    expect(
      (await runtime.server.handle(post('/api/notes/async', { mode: 'tx-throw' }))).status,
    ).toBe(409)
    expect(runtime.outbox.all()).toEqual([])
    expect(events).toEqual([])
    expect((await runtime.server.handle(post('/api/notes/async', { mode: 'tx' }))).status).toBe(201)
    expect(runtime.outbox.all()).toHaveLength(1)
    expect(events).toEqual([{ mode: 'tx' }])
  })

  it('the shared server context still delivers at once (hooks, tests)', async () => {
    const { runtime } = await setup()
    runtime.server.context.outbox.send({ type: 'x', to: 'a@demo.test' })
    expect(runtime.outbox.all()).toHaveLength(1)
  })
})

describe('dev warning for untracked writes in async handlers', () => {
  it('warns when an async handler commits outside ctx.transaction', async () => {
    const warnings: string[] = []
    const { runtime, notes } = await bootTest({ onWarn: (m) => warnings.push(m) })
    await runtime.server.handle(post('/api/notes/async', { mode: 'tx' }))
    expect(warnings).toEqual([])
    const res = await runtime.server.handle(post('/api/notes/async', { mode: 'untracked' }))
    expect(res.status).toBe(201)
    expect(notes.size).toBe(5)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(
      /POST \/api\/notes\/async \(async handler\) committed #\d+ outside ctx\.transaction/,
    )
  })

  it('does not blame an async handler for a concurrent sync request', async () => {
    const warnings: string[] = []
    const { runtime } = await bootTest({ onWarn: (m) => warnings.push(m) })
    await Promise.all([
      runtime.server.handle(post('/api/notes/async', { mode: 'tx' })),
      runtime.server.handle(post('/api/notes', { text: 'sync' })),
    ])
    expect(warnings).toEqual([])
  })
})

describe('startMock', () => {
  const options = () => {
    const { plugin } = makeNotesModule()
    return {
      mode: 'test',
      core: makeCore(),
      plugins: [plugin],
      clock: createClock({ at: TEST_NOW }),
      latencyMs: 0,
    }
  }

  it('boots without test hooks when VITE_TEST_HOOKS is not "true"', async () => {
    vi.stubEnv('VITE_TEST_HOOKS', 'false')
    const runtime = await startMock(options())
    expect(runtime.db.phase).toBe('live')
    expect('__mock' in globalThis).toBe(false)
  })

  it('installs window.__mock when VITE_TEST_HOOKS is "true"', async () => {
    vi.stubEnv('VITE_TEST_HOOKS', 'true')
    const g = globalThis as { __mock?: unknown }
    try {
      const runtime = await startMock(options())
      expect(runtime.db.phase).toBe('live')
      expect(g.__mock).toBeDefined()
    } finally {
      delete g.__mock
    }
  })
})
