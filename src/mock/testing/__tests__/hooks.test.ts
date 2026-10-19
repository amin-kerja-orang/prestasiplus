import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it, vi } from 'vitest'

import { ApiClient } from '@/api/client'
import { ApiError } from '@/api/errors'
import { TransportNetworkError } from '@/api/transport'
import { CLOCK_ANCHOR_MS, createClock, toEpochMs } from '@/lib/time'

import { bootMock, type MockRuntime } from '../../index'
import { defineMockCore, defineMockModule, type MockHook } from '../../server/plugin'
import { bootTest, makeCore, makeNotesModule, TEST_NOW } from '../../server/__tests__/helpers'
import {
  bootWithTestHooks,
  BUILTIN_HOOK_NAMES,
  collectModuleHooks,
  createTestHooks,
  installTestHooks,
  parseMockInit,
  PLAYWRIGHT_CLOCK_BINDING,
  TEST_HOOKS_SENTINEL,
  type HookTarget,
} from '..'

function clientFor(runtime: MockRuntime, token = 'tok-student') {
  return new ApiClient({ transport: runtime.transport, getToken: () => token })
}

function moduleWithHooks(id: `M${number}`, hooks: Record<string, MockHook>) {
  return defineMockModule({ id, dependsOn: ['core'], hooks })
}

describe('collectModuleHooks (names are global)', () => {
  const noop: MockHook = () => undefined

  it('collects hooks in plugin order with their owner', () => {
    const core = defineMockCore({ hooks: { setUser: noop } })
    const a = moduleWithHooks('M01', { expireSession: noop, pushNotification: noop })
    const b = moduleWithHooks('M03', { setProgress: noop })
    expect(collectModuleHooks([core, a, b]).map((e) => `${e.owner}:${e.name}`)).toEqual([
      'core:setUser',
      'M01:expireSession',
      'M01:pushNotification',
      'M03:setProgress',
    ])
  })

  it('throws when two plugins register the same name', () => {
    const a = moduleWithHooks('M01', { pushNotification: noop })
    const b = moduleWithHooks('M05', { pushNotification: noop })
    expect(() => collectModuleHooks([a, b])).toThrow(
      "mock hooks: hook 'pushNotification' is registered by both M01 and M05",
    )
  })

  it('throws when the core and a module collide', () => {
    const core = defineMockCore({ hooks: { setUser: noop } })
    const m = moduleWithHooks('M04', { setUser: noop })
    expect(() => collectModuleHooks([core, m])).toThrow(
      /'setUser' is registered by both core and M04/,
    )
  })

  it.each([...BUILTIN_HOOK_NAMES])('throws when a module reuses the built-in name %s', (name) => {
    const m = moduleWithHooks('M02', { [name]: noop })
    expect(() => collectModuleHooks([m])).toThrow(/is a built-in hook of window.__mock/)
  })

  it('rejects invalid names and non-functions', () => {
    expect(() => collectModuleHooks([moduleWithHooks('M02', { 'set-x': noop })])).toThrow(
      /invalid hook name 'set-x'/,
    )
    const bad = moduleWithHooks('M02', { x: 1 as unknown as MockHook })
    expect(() => collectModuleHooks([bad])).toThrow(/hook 'x' is not a function/)
  })

  it('a collision fails at boot (bootWithTestHooks)', async () => {
    const a = moduleWithHooks('M01', { clipboard: noop })
    const b = moduleWithHooks('M08', { clipboard: noop })
    await expect(
      bootWithTestHooks(bootMock, {
        mode: 'test',
        core: makeCore(),
        plugins: [a, b],
        clock: createClock(),
        latencyMs: 0,
        target: {},
      }),
    ).rejects.toThrow(/'clipboard' is registered by both M01 and M08/)
  })
})

describe('window.__mock built-ins', () => {
  it('installs __mock with the sentinel and an empty __charts registry', async () => {
    const { runtime } = await bootTest()
    const target: HookTarget = {}
    const hooks = installTestHooks(runtime, { mode: 'development', target })
    expect(target.__mock).toBe(hooks)
    expect(target.__charts).toEqual({})
    expect(hooks.ready).toBe(true)
    expect(hooks.sentinel).toBe(TEST_HOOKS_SENTINEL)
    expect(hooks.names()).toEqual(
      expect.arrayContaining([
        'reset',
        'setNow',
        'advanceTime',
        'setLatency',
        'failNext',
        'networkErrorNext',
        'setRandomSeed',
        'lastRequest',
        'config',
        'outbox',
        'setUser',
        'expireSession',
      ]),
    )
    expect(Object.isFrozen(hooks)).toBe(true)
  })

  it('keeps an existing __charts registry', async () => {
    const { runtime } = await bootTest()
    const charts = { 'm05-chart': { type: 'bar' } }
    const target: HookTarget = { __charts: charts }
    installTestHooks(runtime, { mode: 'development', target })
    expect(target.__charts).toBe(charts)
  })

  it('failNext / networkErrorNext / lastRequest / requests', async () => {
    const { runtime } = await bootTest()
    const hooks = createTestHooks(runtime, { mode: 'development', target: {} })
    const api = clientFor(runtime)

    hooks.failNext('GET /api/notes', 500)
    await expect(api.get('/api/notes')).rejects.toBeInstanceOf(ApiError)
    await expect(api.get('/api/notes')).resolves.toBeDefined()

    hooks.networkErrorNext('/api/notes')
    const err: unknown = await api.get('/api/notes').catch((e: unknown) => e)
    expect(err instanceof TransportNetworkError || (err as ApiError).code === 'NETWORK_ERROR').toBe(
      true,
    )

    await api.post('/api/notes', { body: { text: 'baru' } })
    const last = hooks.lastRequest('POST /api/notes')
    expect(last).toMatchObject({ method: 'POST', path: '/api/notes', body: { text: 'baru' } })
    expect(hooks.lastRequest('/api/nothing')).toBeNull()
    expect(hooks.requests('GET /api/notes')).toHaveLength(3)
  })

  it('setLatency / clearLatency', async () => {
    const { runtime } = await bootTest()
    const hooks = createTestHooks(runtime, { mode: 'development', target: {} })
    hooks.setLatency(1500, 'GET /api/notes/:id')
    hooks.setLatency(50)
    expect(runtime.latency.for('GET', '/api/notes/1')).toBe(1500)
    expect(runtime.latency.for('GET', '/api/notes')).toBe(50)
    hooks.clearLatency()
    expect(runtime.latency.for('GET', '/api/notes/1')).toBe(50)
  })

  it('reset(overrides) re-seeds and clears faults and the log', async () => {
    const { runtime, notes } = await bootTest()
    const hooks = createTestHooks(runtime, { mode: 'development', target: {} })
    await clientFor(runtime).post('/api/notes', { body: { text: 'x' } })
    hooks.failNext('/api/notes', 500)
    expect(notes.count()).toBe(4)
    await hooks.reset({ extraNotes: 2 })
    expect(notes.count()).toBe(5)
    expect(runtime.faults.pending()).toBe(0)
    expect(hooks.lastRequest()).toBeNull()
    await expect(hooks.reset({ nope: 1 })).rejects.toThrow()
  })

  it('setRandomSeed changes the sampling base only', async () => {
    const { runtime } = await bootTest()
    const hooks = createTestHooks(runtime, { mode: 'development', target: {} })
    hooks.setRandomSeed(42)
    expect(runtime.prng.seedBase).toBe(42)
    expect(() => hooks.setRandomSeed(1.5)).toThrow(RangeError)
  })

  it('config(key) reads and config(key, value) writes', async () => {
    const { runtime } = await bootTest()
    const hooks = createTestHooks(runtime, { mode: 'development', target: {} })
    expect(hooks.config('defaultPassword')).toBeUndefined()
    expect(hooks.config('defaultPassword', 'Demo1234')).toBe('Demo1234')
    expect(hooks.config('defaultPassword')).toBe('Demo1234')
    expect(runtime.config.get('defaultPassword')).toBe('Demo1234')
  })

  it('outbox.lastResetFor returns the newest reset token (case-insensitive e-mail)', async () => {
    const { runtime } = await bootTest()
    const hooks = createTestHooks(runtime, { mode: 'development', target: {} })
    expect(hooks.outbox.lastResetFor('pelajar@contoh.my')).toBeNull()
    runtime.outbox.send({ type: 'password-reset', to: 'pelajar@contoh.my', data: { token: 't1' } })
    runtime.outbox.send({ type: 'password-reset', to: 'Pelajar@Contoh.my', data: { token: 't2' } })
    runtime.outbox.send({ type: 'other', to: 'pelajar@contoh.my', data: { token: 'x' } })
    expect(hooks.outbox.lastResetFor('PELAJAR@contoh.my')).toBe('t2')
    expect(hooks.outbox.last('other')).toMatchObject({ type: 'other' })
    expect(hooks.outbox.all()).toHaveLength(3)
  })

  it('delegated hooks throw a clear error until a plugin provides them', async () => {
    const { runtime } = await bootTest()
    const hooks = createTestHooks(runtime, { mode: 'development', target: {} })
    await expect(hooks.setUser('pelajar@contoh.my')).rejects.toThrow(
      /__mock.setUser is not available yet: it is provided by the mock core \(F-11/,
    )
    await expect(hooks.expireSession()).rejects.toThrow(/M01/)
  })

  it('module hooks are exposed async and resolve after their commits settle', async () => {
    const { plugin, notes } = makeNotesModule('M90')
    const seen: unknown[] = []
    const hooked = moduleWithHooks('M91', {
      addNote: (text: string) => {
        seen.push(text)
        return notes.insert({ userId: 1, text, luck: 0 }).id
      },
    })
    const runtime = await bootMock({
      mode: 'test',
      core: defineMockCore({
        hooks: { setUser: (email: string) => `sess:${email}` },
      }),
      plugins: [plugin, hooked],
      clock: createClock(),
      latencyMs: 0,
    })
    const settled = vi.spyOn(runtime.db, 'settled')
    const hooks = createTestHooks(runtime, { mode: 'development', target: {} })
    const addNote = hooks.addNote as (text: string) => Promise<number>
    await expect(addNote('dari hook')).resolves.toBe(4)
    expect(seen).toEqual(['dari hook'])
    expect(settled).toHaveBeenCalled()
    await expect(hooks.setUser('a@b.my')).resolves.toBe('sess:a@b.my')
    expect(hooks.names()).toContain('addNote')
  })
})

describe('clock hooks', () => {
  it('development: setNow / advanceTime move the shared clock offset', async () => {
    const { runtime, clock } = await bootTest()
    const hooks = createTestHooks(runtime, { mode: 'development', target: {} })
    expect(hooks.clockMode).toBe('offset')
    await hooks.setNow('2026-09-26T08:00:00+08:00')
    expect(clock.now()).toBe(toEpochMs('2026-09-26T08:00:00+08:00'))
    expect(hooks.now()).toBe(clock.now())
    await hooks.advanceTime(60_000)
    expect(clock.now()).toBe(toEpochMs('2026-09-26T08:01:00+08:00'))
    await expect(hooks.setNow('bukan tarikh')).rejects.toThrow(RangeError)
    await expect(hooks.advanceTime(Number.NaN)).rejects.toThrow(RangeError)
  })

  it('e2e: setNow / advanceTime drive the Playwright clock bridge, not the offset', async () => {
    const { runtime, clock } = await bootTest({ mode: 'e2e' })
    const calls: [string, number][] = []
    const target: HookTarget = {
      [PLAYWRIGHT_CLOCK_BINDING]: (op: string, value: number) => {
        calls.push([op, value])
        return Promise.resolve()
      },
    }
    const hooks = createTestHooks(runtime, { mode: 'e2e', target })
    expect(hooks.clockMode).toBe('playwright')
    const offsetBefore = clock.getOffset()
    await hooks.setNow('2026-09-25T10:00:00+08:00')
    await hooks.advanceTime(5000)
    // The browser time is the target minus the mock offset, so mock now() lands on the target.
    expect(calls).toEqual([
      ['setNow', toEpochMs('2026-09-25T10:00:00+08:00') - offsetBefore],
      ['advanceTime', 5000],
    ])
    expect(clock.getOffset()).toBe(offsetBefore)
  })

  it('e2e without the bridge: a clear error', async () => {
    const { runtime } = await bootTest({ mode: 'e2e' })
    const hooks = createTestHooks(runtime, { mode: 'e2e', target: {} })
    await expect(hooks.setNow(TEST_NOW)).rejects.toThrow(/Playwright clock/)
    await expect(hooks.advanceTime(1)).rejects.toThrow(new RegExp(PLAYWRIGHT_CLOCK_BINDING))
  })
})

describe('pre-boot init (__MOCK_INIT__)', () => {
  it('parses a full init and splits off the session', () => {
    expect(
      parseMockInit({
        now: '2026-09-25T10:00:00+08:00',
        latency: { '*': 0, '/api/admin/*': 300 },
        seed: 7,
        overrides: { extraNotes: 1 },
        session: 'pelajar@contoh.my',
      }),
    ).toEqual({
      init: {
        now: '2026-09-25T10:00:00+08:00',
        latency: { '*': 0, '/api/admin/*': 300 },
        seed: 7,
        overrides: { extraNotes: 1 },
      },
      session: 'pelajar@contoh.my',
    })
    expect(parseMockInit(undefined)).toEqual({ init: {}, session: null })
    expect(parseMockInit({ session: ['student', 1] }).session).toEqual(['student', 1])
  })

  it.each([
    ['not an object', 5, /must be an object/],
    ['unknown key', { sesion: 'x' }, /unknown key 'sesion'/],
    ['bad now', { now: true }, /now/],
    ['negative latency', { latency: -1 }, /latency/],
    ['bad latency rule', { latency: { '/api/x': 'fast' } }, /latency\['\/api\/x'\]/],
    ['fractional seed', { seed: 1.5 }, /seed/],
    ['array overrides', { overrides: [] }, /overrides/],
    ['empty session', { session: '' }, /session/],
  ])('rejects %s', (_label, raw, message) => {
    expect(() => parseMockInit(raw)).toThrow(message)
  })

  it('bootWithTestHooks applies now, latency, seed and overrides at boot, then the session', async () => {
    const { plugin, notes } = makeNotesModule('M90')
    const order: string[] = []
    const core = defineMockCore({
      hooks: {
        setUser: (email: string, remember?: boolean) => {
          order.push(`setUser:${email}:${String(remember)}`)
        },
      },
    })
    const target: HookTarget = {
      __MOCK_INIT__: {
        now: '2026-09-25T10:00:00+08:00',
        latency: { '*': 0, 'GET /api/notes': 250 },
        seed: 99,
        overrides: { extraNotes: 3 },
        session: ['pelajar@contoh.my', true],
      },
    }
    const { runtime, hooks } = await bootWithTestHooks(
      async (options) => {
        order.push('boot')
        return bootMock(options)
      },
      { mode: 'development', core, plugins: [plugin], clock: createClock(), target },
    )
    expect(order).toEqual(['boot', 'setUser:pelajar@contoh.my:true'])
    expect(target.__mock).toBe(hooks)
    expect(runtime.clockStart).toBe('init')
    expect(runtime.clock.now()).toBeGreaterThanOrEqual(toEpochMs('2026-09-25T10:00:00+08:00'))
    expect(runtime.clock.now()).toBeLessThan(toEpochMs('2026-09-25T10:00:00+08:00') + 60_000)
    expect(runtime.latency.globalMs).toBe(0)
    expect(runtime.latency.for('GET', '/api/notes')).toBe(250)
    expect(runtime.prng.seedBase).toBe(99)
    expect(notes.count()).toBe(6)
  })

  it('a session without a setUser hook fails the boot loudly', async () => {
    await expect(
      bootWithTestHooks(bootMock, {
        mode: 'development',
        core: makeCore(),
        plugins: [],
        latencyMs: 0,
        clock: createClock(),
        target: { __MOCK_INIT__: { session: 'pelajar@contoh.my' } },
      }),
    ).rejects.toThrow(/__mock.setUser is not available yet/)
  })

  it('no __MOCK_INIT__: the development clock starts at the anchor', async () => {
    const { runtime } = await bootWithTestHooks(bootMock, {
      mode: 'development',
      core: makeCore(),
      plugins: [],
      latencyMs: 0,
      clock: createClock(),
      target: {},
    })
    expect(runtime.clockStart).toBe('anchor')
    expect(Math.abs(runtime.clock.now() - CLOCK_ANCHOR_MS)).toBeLessThan(60_000)
  })
})

describe('demo-bundle guard', () => {
  it('scripts/check-demo-bundle.mjs checks the sentinel and __charts', () => {
    const script = readFileSync(
      fileURLToPath(new URL('../../../../scripts/check-demo-bundle.mjs', import.meta.url)),
      'utf8',
    )
    const markers = /const MARKERS = \[([^\]]*)\]/.exec(script)?.[1] ?? ''
    expect(markers).toContain(`'${TEST_HOOKS_SENTINEL}'`)
    expect(markers).toContain(`'__charts'`)
    expect(TEST_HOOKS_SENTINEL).not.toMatch(/__mock|__MOCK_INIT__/)
  })
})
