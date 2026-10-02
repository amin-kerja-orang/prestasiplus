/**
 * Mock backend entry (overview §3, §6; ADR-0004): boots the in-process mock and returns its
 * transport. Only `src/app/bootstrap.ts` imports this file, dynamically and only in `mock` mode.
 *
 * Boot sequence (`bootMock`):
 * 1. load the **core** (`src/mock/core-data/index.ts`, F-11, found automatically; an empty core until
 *    it exists) and the **registry** modules (`src/mock/registry.ts`), checking ids, `dependsOn`
 *    order, override keys, dataset `specHash()` and the repository convention (D12, F-10);
 * 2. compute the **seed version** (`./server/seed.ts`);
 * 3. ask the persistence adapter (F-07) for the stored state of that version;
 * 4. set the **clock** offset (`initMockClock` with `mockClockPolicyForMode(mode)`: pre-boot `now`,
 *    else the persisted offset, else the 2026-09-25 15:40 anchor; e2e passes the browser clock);
 * 5. register every store, **compose the seeds** (core → modules → finalise → baseline) with the
 *    fixed seed streams, then load the persisted diff (diffs of unknown stores are dropped with a
 *    warning);
 * 6. build the server and `MockTransport`, and attach persistence (write-through, cross-tab).
 *
 * `window.__MOCK_INIT__` values are passed in as `init` (F-08 reads the global): `now`, `latency`,
 * `seed` (sampling seed base) and `overrides`. `session` is applied by F-08/F-11 after boot, before
 * the first request.
 */

import type { Clock, DateInput } from '@/lib/time'
import { clock as appClock } from '@/lib/time'

import { createDb, type Db } from './db/transaction'
import {
  createPrngRegistry,
  DEFAULT_SEED_BASE,
  initMockClock,
  mockClockPolicyForMode,
  type MockClockStart,
  type PrngRegistry,
} from './determinism'
import { createFaults, type FaultControl } from './faults'
import { createLatency, latencyFromEnv, type LatencyControl, type Sleep } from './latency'
import { mockPlugins } from './registry'
import { createRequestLog, type RequestLog } from './request-log'
import { createMockConfig, type MockConfig } from './server/config'
import { createMockEvents, type MockEvents } from './server/events'
import { createOutbox, type Outbox } from './server/outbox'
import {
  EMPTY_CORE,
  isMockPlugin,
  loadMockModules,
  overrideOwners,
  checkModuleOrder,
  toMockModule,
  type MockCore,
  type MockModule,
  type MockPlugin,
  type PluginLoader,
} from './server/plugin'
import { assertRepositoryConventions } from './repository'
import {
  composeSeeds,
  computeSeedVersion,
  registerStores,
  SEED_PRNG_BASE,
  splitOverrides,
} from './server/seed'
import { createMockServer, type MockServer } from './server/server'
import { MockTransport } from './server/transport'
import type { Middleware } from './server/types'

export { MockTransport } from './server/transport'
// `bootstrap.ts` loads everything through the one dynamic `@/mock` import (overview v1.4 §6.13).
export {
  createMockPersistence,
  type MockPersistenceAdapter,
  type MockPersistenceOptions,
} from './db/persistence'
export type { MockServer } from './server/server'

/** `window.__MOCK_INIT__` (overview §6.13). */
export interface MockInit {
  now?: DateInput | null
  /** Global latency in ms, or `{ [pathPattern]: ms }` (the key `'*'` sets the global value). */
  latency?: number | Readonly<Record<string, number>>
  /** Sampling seed base (`setRandomSeed`). Never changes seed data. */
  seed?: number
  overrides?: Readonly<Record<string, unknown>>
  /** Handled after boot by F-08/F-11 (fast login). */
  session?: unknown
}

/** State kept by F-07 for one seed version. */
export interface PersistedMockState {
  /** `db.diff()` as stored, keyed by store name. */
  diffs?: Record<string, unknown> | null
  clockOffset?: number | null
}

/**
 * The persistence adapter (F-07). `load` returns `null` when nothing is stored **or** the stored
 * seed version differs (the adapter discards it). `attach` starts write-through (`db.onCommit`) and
 * cross-tab apply; `clear(overrides)` wipes the stored diff on `reset(overrides)` and forwards the
 * overrides so other tabs re-seed identically.
 */
export interface MockPersistence {
  load(seedVersion: string): Promise<PersistedMockState | null>
  attach(runtime: MockRuntime): void
  clear(overrides?: Readonly<Record<string, unknown>>): Promise<void>
}

export interface BootMockOptions {
  /** `import.meta.env.MODE` by default; selects the clock policy. */
  mode?: string
  /** Registry loaders or ready modules. Default: `src/mock/registry.ts`. */
  plugins?: readonly (PluginLoader | MockModule<object>)[]
  /** Default: `src/mock/core-data/index.ts` when it exists, else an empty core. */
  core?: MockCore<object>
  /** Default: the shared app clock (UI and mock share one clock). */
  clock?: Clock
  /** Default: `VITE_MOCK_LATENCY_MS` (400). */
  latencyMs?: number
  sleep?: Sleep
  init?: MockInit | null
  persistence?: MockPersistence | null
  /** Unknown override keys throw. Default `true`. */
  strictOverrides?: boolean
  /** Extra global guards (after session resolution, before route middleware). */
  middleware?: readonly Middleware[]
  requestLogSize?: number
  onError?: (error: unknown, req: { method: string; path: string }) => void
  /** Non-fatal boot and developer warnings. Default: `console.warn` (dev-only for handler warnings). */
  onWarn?: ((message: string) => void) | null
}

export interface MockRuntime {
  readonly transport: MockTransport
  readonly server: MockServer
  readonly db: Db
  readonly clock: Clock
  readonly clockStart: MockClockStart
  /** Sampling streams (`ctx.prng`). */
  readonly prng: PrngRegistry
  /** Seed streams (fixed base 1). */
  readonly seedPrng: PrngRegistry
  readonly config: MockConfig
  readonly outbox: Outbox
  readonly events: MockEvents
  readonly latency: LatencyControl
  readonly faults: FaultControl
  readonly log: RequestLog
  readonly core: MockCore<object>
  readonly modules: readonly MockModule<object>[]
  /** Core first, then modules in registry order. */
  readonly plugins: readonly MockPlugin<object>[]
  readonly seedVersion: string
  /** Steps of the last seed composition (for diagnostics and tests). */
  readonly seedSteps: readonly string[]
  /** Re-seeds from scratch with `overrides`, clears faults, log, outbox and the stored diff. */
  reset(overrides?: Readonly<Record<string, unknown>>): Promise<void>
  /** Changes the sampling seed base only (M06). */
  setRandomSeed(seedBase: number): void
}

/** The core written by F-11, if it exists yet. */
function discoverCore(): MockCore<object> {
  const found = import.meta.glob<unknown>('./core-data/index.ts', {
    eager: true,
    import: 'default',
  })
  const core = Object.values(found)[0]
  if (core === undefined) return EMPTY_CORE
  if (!isMockPlugin(core) || core.id !== 'core') {
    throw new Error('src/mock/core-data/index.ts must `export default defineMockCore({...})`')
  }
  return core as MockCore<object>
}

async function resolveModules(
  plugins: readonly (PluginLoader | MockModule<object>)[],
): Promise<MockModule<object>[]> {
  if (plugins.every((p) => typeof p === 'function')) return loadMockModules(plugins)
  const modules = await Promise.all(
    plugins.map(async (p) => (typeof p === 'function' ? toMockModule((await p()).default) : p)),
  )
  checkModuleOrder(modules)
  return modules
}

/**
 * Stored diffs of stores that no longer exist (e.g. a table removed without a seed-version change)
 * are dropped with a warning instead of failing the boot.
 */
export function knownDiffs(
  db: Db,
  diffs: Record<string, unknown>,
  warn: ((message: string) => void) | null,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [name, diff] of Object.entries(diffs)) {
    if (db.store(name)) out[name] = diff
    else warn?.(`mock: dropped the stored diff of unknown store '${name}'`)
  }
  return out
}

function applyInitLatency(latency: LatencyControl, value: MockInit['latency']) {
  if (value === undefined) return
  if (typeof value === 'number') {
    latency.set(value)
    return
  }
  for (const [pattern, ms] of Object.entries(value)) {
    if (pattern === '*') latency.set(ms)
    else latency.set(ms, pattern)
  }
}

export async function bootMock(options: BootMockOptions = {}): Promise<MockRuntime> {
  const mode = options.mode ?? import.meta.env.MODE
  const init = options.init ?? {}
  const clock = options.clock ?? appClock
  const core = options.core ?? discoverCore()
  const modules = await resolveModules(options.plugins ?? mockPlugins)
  const plugins: MockPlugin<object>[] = [core, ...modules]
  overrideOwners(plugins)
  assertRepositoryConventions(plugins)
  const warn = options.onWarn === undefined ? (m: string) => console.warn(m) : options.onWarn

  const seedVersion = computeSeedVersion(plugins)
  const persistence = options.persistence ?? null
  const persisted = persistence ? await persistence.load(seedVersion) : null

  const clockStart = initMockClock(clock, {
    policy: mockClockPolicyForMode(mode),
    persistedOffset: persisted?.clockOffset ?? null,
    now: init.now ?? null,
  })

  const seedPrng = createPrngRegistry({ seedBase: SEED_PRNG_BASE })
  const prng = createPrngRegistry({ seedBase: init.seed ?? DEFAULT_SEED_BASE })
  const db = createDb({ prng: seedPrng })
  registerStores(db, plugins)
  db.reset() // module stores are singletons: drop anything a previous runtime left in them

  const config = createMockConfig()
  const outbox = createOutbox(clock)
  const events = createMockEvents()
  const strictOverrides = options.strictOverrides ?? true

  const composed = await composeSeeds({
    db,
    plugins,
    seedPrng,
    clock,
    config,
    overrides: init.overrides ?? {},
    strictOverrides,
  })
  let seedSteps: readonly string[] = composed.steps
  if (persisted?.diffs) db.loadDiff(knownDiffs(db, persisted.diffs, warn))

  const latency = createLatency({
    defaultMs: options.latencyMs ?? latencyFromEnv(import.meta.env.VITE_MOCK_LATENCY_MS),
    ...(options.sleep ? { sleep: options.sleep } : {}),
  })
  applyInitLatency(latency, init.latency)
  const faults = createFaults()
  const log = createRequestLog(options.requestLogSize)

  const server = createMockServer({
    db,
    clock,
    prng,
    config,
    outbox,
    events,
    routes: plugins.flatMap((p) => p.routes),
    middleware: options.middleware ?? [],
    resolveSession: core.resolveSession,
    ...(options.onError ? { onError: options.onError } : {}),
    ...(options.onWarn === undefined ? {} : { onWarn: options.onWarn }),
  })
  const transport = new MockTransport({ server, latency, faults, log, clock })

  const runtime: MockRuntime = {
    transport,
    server,
    db,
    clock,
    clockStart,
    prng,
    seedPrng,
    config,
    outbox,
    events,
    latency,
    faults,
    log,
    core,
    modules,
    plugins,
    seedVersion,
    get seedSteps() {
      return seedSteps
    },
    async reset(overrides = {}) {
      // Validate first: a typo must not leave the runtime cleared and stuck in the seed phase.
      splitOverrides(plugins, overrides, strictOverrides)
      await db.settled().catch(() => undefined)
      faults.clear()
      log.clear()
      outbox.clear()
      config.clear()
      db.reset()
      const result = await composeSeeds({
        db,
        plugins,
        seedPrng,
        clock,
        config,
        overrides,
        strictOverrides,
      })
      seedSteps = result.steps
      prng.setSeedBase(prng.seedBase) // restart the sampling streams
      if (persistence) await persistence.clear(overrides)
    },
    setRandomSeed(seedBase) {
      prng.setSeedBase(seedBase)
    },
  }

  persistence?.attach(runtime)
  return runtime
}

/**
 * The app entry (what `bootstrap.ts` calls). In dev and e2e builds (`VITE_TEST_HOOKS === 'true'`)
 * it applies `window.__MOCK_INIT__` and installs `window.__mock` (F-08); the static env check lets
 * the demo build drop the test hooks entirely.
 */
export async function startMock(options: BootMockOptions = {}): Promise<MockRuntime> {
  if (import.meta.env.VITE_TEST_HOOKS === 'true') {
    const { bootWithTestHooks } = await import('./testing')
    return (await bootWithTestHooks(bootMock, options)).runtime
  }
  return bootMock(options)
}

/** Boots the mock and returns its transport. */
export async function createMockTransport(options: BootMockOptions = {}): Promise<MockTransport> {
  return (await bootMock(options)).transport
}
