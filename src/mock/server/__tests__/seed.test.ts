import { describe, expect, it, vi } from 'vitest'

import { createClock } from '@/lib/time'

import { maxPlusOne } from '../../db/id-strategies'
import { defineTable } from '../../db/table'
import { fnv1a32 } from '../../determinism/hash'
import { bootMock, type MockPersistence } from '../../index'
import { mockPlugins } from '../../registry'
import {
  checkModuleOrder,
  defineMockCore,
  defineMockModule,
  EMPTY_CORE,
  loadMockModules,
  toMockModule,
  type MockDatasetLike,
} from '../plugin'
import { computeSeedVersion, SEED_PRNG_BASE, splitOverrides } from '../seed'
import { authHeaders, bootTest, makeCore, makeNotesModule, TEST_NOW } from './helpers'

/** A fake virtual dataset: a table with `compile()` / `specHash()` (F-09 shape). */
function fakeDataset(name: string, spec: string, log: string[]): MockDatasetLike {
  const table = defineTable<{ id: number }>({ name, ids: maxPlusOne() })
  return Object.assign(table, {
    compile: () => void log.push(`compiled ${name}`),
    specHash: () => spec,
  })
}

describe('plugin definition and registry loader', () => {
  it('defineMockModule normalises defaults and keeps typed repositories', () => {
    const repo = { get: (id: number) => id }
    const m = defineMockModule({ id: 'M42', repositories: { repo } })
    expect(m).toMatchObject({ id: 'M42', dependsOn: [], version: '0', routes: [], overrides: [] })
    expect(m.repositories.repo.get(3)).toBe(3)
    expect(Object.isFrozen(m)).toBe(true)
    expect(() => defineMockModule({ id: 'X1' as 'M1' })).toThrow(/invalid id/)
    expect(() => defineMockModule({ id: 'M42', dependsOn: ['M42'] })).toThrow(/itself/)
    expect(() => defineMockModule({ id: 'M42', overrides: ['a', 'a'] })).toThrow(/duplicate/)
  })

  it('F-01 stubs `{ id }` load as empty modules', () => {
    expect(toMockModule({ id: 'M05' })).toMatchObject({ id: 'M05', routes: [], seed: null })
    expect(() => toMockModule({})).toThrow(/must export/)
    expect(() => toMockModule(EMPTY_CORE)).toThrow(/core/)
  })

  it('loads the real registry (21 modules) in order', async () => {
    const modules = await loadMockModules(mockPlugins)
    expect(modules.map((m) => m.id)).toEqual([
      'M01',
      'M02',
      'M03',
      'M04',
      'M05',
      'M06',
      'M07',
      'M08',
      'M09',
      'M10',
      'M11',
      'M12',
      'M13',
      'M14',
      'M15',
      'M16',
      'M17',
      'M18',
      'M20',
      'M21',
      'M25',
    ])
  })

  it('checks dependsOn against the registry order', () => {
    const a = defineMockModule({ id: 'M01', dependsOn: ['core'] })
    const b = defineMockModule({ id: 'M02', dependsOn: ['core', 'M01'] })
    expect(() => checkModuleOrder([a, b])).not.toThrow()
    expect(() => checkModuleOrder([b, a])).toThrow(/M02 depends on M01, which comes later/)
    const c = defineMockModule({ id: 'M03', dependsOn: ['M99'] })
    expect(() => checkModuleOrder([a, c])).toThrow(/unknown module M99/)
    expect(() => checkModuleOrder([a, a])).toThrow(/duplicate module id M01/)
  })

  it('override keys must be unique across plugins', () => {
    const a = defineMockModule({ id: 'M01', overrides: ['x'] })
    const b = defineMockModule({ id: 'M02', overrides: ['x'] })
    expect(() => splitOverrides([EMPTY_CORE, a, b], {}, true)).toThrow(/declared by M01 and M02/)
  })
})

describe('seed composer', () => {
  it('runs core → modules in registry order → compile datasets → finalise → baseline', async () => {
    const log: string[] = []
    const core = defineMockCore({
      seed: (ctx) => void log.push(`seed ${ctx.module} (${ctx.db.phase})`),
      datasets: { users: fakeDataset('core.users', 'u1', log) },
    })
    const m1 = defineMockModule({
      id: 'M01',
      dependsOn: ['core'],
      seed: async () => {
        await Promise.resolve()
        log.push('seed M01')
      },
    })
    const m4 = defineMockModule({
      id: 'M04',
      dependsOn: ['core', 'M01'],
      datasets: { questions: fakeDataset('m04.questions', 'q1', log) },
      seed: () => void log.push('seed M04'),
      finalise: (ctx) => void log.push(`finalise M04 (${ctx.db.phase})`),
    })
    const runtime = await bootMock({
      mode: 'test',
      core,
      plugins: [m1, m4],
      clock: createClock({ at: TEST_NOW }),
      latencyMs: 0,
    })
    expect(log).toEqual([
      'seed core (seed)',
      'seed M01',
      'seed M04',
      'compiled core.users',
      'compiled m04.questions',
      'finalise M04 (seed)',
    ])
    expect(runtime.seedSteps).toEqual([
      'seed:core',
      'seed:M01',
      'seed:M04',
      'compile:core.users',
      'compile:M04.questions',
      'finalise:M04',
      'baseline',
    ])
    expect(runtime.db.phase).toBe('live')
  })

  it('a registry out of dependsOn order fails the boot', async () => {
    const m2 = defineMockModule({ id: 'M02', dependsOn: ['M03'] })
    const m3 = defineMockModule({ id: 'M03' })
    await expect(
      bootMock({ mode: 'test', core: EMPTY_CORE, plugins: [m2, m3], clock: createClock() }),
    ).rejects.toThrow(/comes later/)
  })

  it('an unknown override key throws (typo guard); known keys reach only their module', async () => {
    await expect(bootTest({ init: { overrides: { extraNotez: 2 } } })).rejects.toThrow(
      /unknown key\(s\) 'extraNotez'. Known: extraNotes/,
    )
    const { runtime, notes } = await bootTest({ init: { overrides: { extraNotes: 2 } } })
    expect(notes.size).toBe(5)
    await runtime.reset()
    expect(notes.size).toBe(3)
    await runtime.reset({ extraNotes: 1 })
    expect(notes.size).toBe(4)
    await expect(runtime.reset({ bogus: 1 })).rejects.toThrow(/unknown key/)
    // Non-strict mode ignores unknown keys.
    await expect(
      bootTest({ strictOverrides: false, init: { overrides: { bogus: 1 } } }),
    ).resolves.toBeDefined()
  })

  it('seed data uses fixed seed streams: setRandomSeed changes sampling only', async () => {
    const a = await bootTest()
    const b = await bootTest({ init: { seed: 99 } })
    expect(a.runtime.seedPrng.seedBase).toBe(SEED_PRNG_BASE)
    expect(b.runtime.seedPrng.seedBase).toBe(SEED_PRNG_BASE)
    const luckA = a.notes.query().rows.map((n) => n.luck)
    expect(b.notes.query().rows.map((n) => n.luck)).toEqual(luckA)

    const sample = async (t: typeof a) =>
      (await t.runtime.server.handle({ method: 'GET', url: '/api/notes-sample', headers: {} })).body
    const sA = await sample(a)
    const sB = await sample(b)
    expect(sB).not.toEqual(sA)

    // setRandomSeed + reset: seed data identical, sampling follows the new base.
    a.runtime.setRandomSeed(99)
    await a.runtime.reset()
    expect(a.notes.query().rows.map((n) => n.luck)).toEqual(luckA)
    expect(await sample(a)).toEqual(sB)
  })

  it('reset clears runtime writes, faults, the log and the outbox', async () => {
    const { runtime, notes } = await bootTest()
    await runtime.server.handle({
      method: 'POST',
      url: '/api/notes',
      headers: authHeaders(),
      body: { text: 'runtime' },
    })
    runtime.faults.failNext('/api/x', 500)
    runtime.outbox.send({ type: 'password-reset', to: 'a@demo.test' })
    runtime.config.set('defaultPassword', 'x')
    await runtime.transport.request({ method: 'GET', url: '/api/notes', headers: authHeaders() })
    expect(notes.size).toBe(4)

    await runtime.reset()
    expect(notes.size).toBe(3)
    expect(runtime.db.diff()).toEqual({
      'm90.notes': { kind: 'table', upserts: [], deletes: [], ids: null },
    })
    expect(runtime.faults.pending()).toBe(0)
    expect(runtime.log.size).toBe(0)
    expect(runtime.outbox.all()).toEqual([])
    expect(runtime.config.has('defaultPassword')).toBe(false)
  })

  it('module stores are cleared when a new runtime boots with the same plugin', async () => {
    const { plugin, notes } = makeNotesModule()
    const boot = () =>
      bootMock({
        mode: 'test',
        core: makeCore(),
        plugins: [plugin],
        clock: createClock(),
        latencyMs: 0,
      })
    const first = await boot()
    await first.server.handle({
      method: 'POST',
      url: '/api/notes',
      headers: authHeaders(),
      body: { text: 'x' },
    })
    expect(notes.size).toBe(4)
    await boot()
    expect(notes.size).toBe(3)
  })
})

describe('seed version', () => {
  const base = () => {
    const log: string[] = []
    const m = (over: Partial<Parameters<typeof defineMockModule>[0]> = {}) =>
      defineMockModule({
        id: 'M04',
        version: 1,
        tables: {
          reports: defineTable<{ id: number }>({ name: 'm04.reports', ids: maxPlusOne() }),
        },
        datasets: { questions: fakeDataset('m04.questions', 'spec-a', log) },
        fixtures: { anchors: [{ id: 570001 }] },
        ...over,
      })
    return m
  }

  it('is a stable 8-hex-digit FNV-1a hash', () => {
    const make = base()
    const v1 = computeSeedVersion([EMPTY_CORE, make()])
    expect(v1).toMatch(/^[0-9a-f]{8}$/)
    expect(computeSeedVersion([EMPTY_CORE, make()])).toBe(v1)
    // Golden value of the empty registry, so an accidental format change is caught.
    const empty = ['format:1', 'seedBase:1', 'plugin:core@0'].join('\n')
    expect(computeSeedVersion([EMPTY_CORE])).toBe(fnv1a32(empty).toString(16).padStart(8, '0'))
  })

  it('changes with the module version, a dataset spec, a fixture, a store name or the order', () => {
    const make = base()
    const log: string[] = []
    const v = computeSeedVersion([EMPTY_CORE, make()])
    expect(computeSeedVersion([EMPTY_CORE, make({ version: 2 })])).not.toBe(v)
    expect(
      computeSeedVersion([
        EMPTY_CORE,
        make({ datasets: { questions: fakeDataset('m04.questions', 'spec-b', log) } }),
      ]),
    ).not.toBe(v)
    expect(
      computeSeedVersion([EMPTY_CORE, make({ fixtures: { anchors: [{ id: 570002 }] } })]),
    ).not.toBe(v)
    expect(
      computeSeedVersion([
        EMPTY_CORE,
        make({
          tables: {
            reports: defineTable<{ id: number }>({ name: 'm04.reports2', ids: maxPlusOne() }),
          },
        }),
      ]),
    ).not.toBe(v)
    const a = defineMockModule({ id: 'M01' })
    const b = defineMockModule({ id: 'M02' })
    expect(computeSeedVersion([EMPTY_CORE, a, b])).not.toBe(computeSeedVersion([EMPTY_CORE, b, a]))
  })

  it('does not depend on overrides or the sampling seed', async () => {
    const a = await bootTest()
    const b = await bootTest({ init: { seed: 7, overrides: { extraNotes: 3 } } })
    expect(b.runtime.seedVersion).toBe(a.runtime.seedVersion)
  })
})

describe('boot: clock and persistence hand-off (F-07 contract)', () => {
  it('sets the clock by policy: init.now, persisted offset, anchor, e2e passthrough', async () => {
    const clock = createClock({ source: () => 0 })
    const withNow = await bootTest({ clock, init: { now: '2026-01-01T00:00:00Z' } })
    expect(withNow.runtime.clockStart).toBe('init')
    expect(clock.now()).toBe(Date.parse('2026-01-01T00:00:00Z'))

    const anchored = await bootTest({ clock })
    expect(anchored.runtime.clockStart).toBe('anchor')
    expect(clock.now()).toBe(Date.parse(TEST_NOW))

    const e2e = await bootTest({ clock, mode: 'e2e' })
    expect(e2e.runtime.clockStart).toBe('passthrough')
    expect(clock.getOffset()).toBe(0)
  })

  it('loads the stored state of its seed version, applies the diff after seeding, then attaches', async () => {
    const calls: string[] = []
    const attach = vi.fn<(runtime: unknown) => void>(() => void calls.push('attach'))
    let version = ''
    const persistence: MockPersistence = {
      load: vi.fn((v: string) => {
        version = v
        calls.push('load')
        return Promise.resolve({
          clockOffset: 1234,
          diffs: {
            'm90.notes': {
              kind: 'table',
              upserts: [{ id: 50, userId: 1, text: 'stored', luck: 0 }],
              deletes: [2],
              ids: null,
            },
          },
        })
      }),
      attach,
      clear: vi.fn(() => {
        calls.push('clear')
        return Promise.resolve()
      }),
    }
    const clock = createClock({ source: () => 0 })
    const { runtime, notes } = await bootTest({ clock, persistence })
    expect(version).toBe(runtime.seedVersion)
    expect(runtime.clockStart).toBe('persisted')
    expect(clock.getOffset()).toBe(1234)
    expect(notes.get(50)?.text).toBe('stored')
    expect(notes.get(2)).toBeUndefined()
    expect(attach).toHaveBeenCalledWith(runtime)
    await runtime.reset()
    expect(notes.get(50)).toBeUndefined()
    expect(calls).toEqual(['load', 'attach', 'clear'])
  })
})
