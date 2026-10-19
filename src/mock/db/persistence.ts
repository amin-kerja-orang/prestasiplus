/**
 * Mock persistence (F-07; overview §6.11, §6.12; ADR-0005): the `MockPersistence` adapter that
 * `bootMock` (F-06) uses.
 *
 * What is stored (IndexedDB database `pp-mock`, object store `diff`, through `idb-keyval`):
 *
 * | Key | Value |
 * |---|---|
 * | `@meta` | `{ format, seedVersion }`; a different seed version (or format) discards everything |
 * | `@clock` | the clock offset in ms (overview §6.12) |
 * | `store:<name>` | `db.store(name).diff()`: one key per store. Tables: upserts, deletes and the id counter. Virtual datasets (F-09): their overlay. Rows are stored by structured clone, so `Date`s and `Blob`s (uploads) round-trip as they are. The auth session table is an ordinary table. |
 *
 * Behaviour:
 * - **Load** (`load(seedVersion)`, before the clock is set and before seeding): returns the stored
 *   diffs and clock offset, or `null` when nothing is stored or the seed version differs (the stale
 *   data is wiped).
 * - **Write-through** (`attach`): each `db` commit writes the cumulative diff of every store it
 *   touched, plus `@meta`, in **one** IndexedDB transaction. The commit listener's promise resolves
 *   only after that write, so the mock server answers a mutating request only once it is stored
 *   (`db.settled`). A failed write rejects the listener, which `db.settled` reports as
 *   `COMMIT_FAILED` (the server answers 500). Writes are serialised in commit order.
 * - **Clock:** the offset is written when the adapter attaches (so the first-boot anchor offset is
 *   kept) and on every change (`clock.subscribe`). Boot restores it (`initMockClock`).
 * - **Cross-tab** (`./broadcast.ts`): after the write, the commit is posted on
 *   `BroadcastChannel('pp-mock')`. Other tabs apply it with `db.applyChanges` (id counters only move
 *   forward) and re-store the diffs of the touched stores, so two tabs writing the same store at
 *   the same time still converge on disk.
 * - **Reset** (`clear(overrides?)`, called by `runtime.reset`): waits for pending writes, wipes the
 *   stored diff (keeping the current clock offset, as memory does) and posts `reset`; other tabs
 *   re-seed with the same overrides.
 * - **Degrades** to memory only when IndexedDB is missing or fails to open/read (private modes,
 *   Node tests), and to the current tab only when `BroadcastChannel` is missing. Neither is an error.
 */

import { createStore, entries, promisifyRequest, setMany, type UseStore } from 'idb-keyval'

import type { Clock } from '@/lib/time'

import type { MockPersistence, MockRuntime, PersistedMockState } from '../index'
import {
  MOCK_CHANNEL_NAME,
  openMockChannel,
  type ChannelFactory,
  type MockBroadcast,
  type MockChannel,
} from './broadcast'
import type { CommitEvent, Db } from './transaction'

/** IndexedDB database name (ADR-0005). */
export const PERSIST_DB_NAME = 'pp-mock'
/** Object store inside `pp-mock`. */
export const PERSIST_STORE_NAME = 'diff'
/** Bump when the stored layout changes; a different format is discarded like a seed-version change. */
export const PERSIST_FORMAT = 1

export const META_KEY = '@meta'
export const CLOCK_KEY = '@clock'
export const STORE_KEY_PREFIX = 'store:'

export interface PersistMeta {
  format: number
  seedVersion: string
}

export type PersistEntry = readonly [key: string, value: unknown]

/** Key-value storage behind the adapter (IndexedDB in the app; tests may inject their own). */
export interface PersistBackend {
  /** Every stored entry. */
  readAll(): Promise<Map<string, unknown>>
  /** Writes `entries` atomically (one IndexedDB transaction). */
  write(entries: readonly PersistEntry[]): Promise<void>
  /** Clears everything and writes `entries`, atomically. */
  replace(entries: readonly PersistEntry[]): Promise<void>
}

/** The runtime parts the adapter uses (a `MockRuntime` satisfies it). */
export type PersistRuntime = Pick<MockRuntime, 'db' | 'clock' | 'seedVersion' | 'reset'>

export interface MockPersistenceOptions {
  /**
   * Storage backend. Default: IndexedDB `pp-mock` via `idb-keyval` (`idbBackend()`); `null`
   * disables storage (memory only).
   */
  backend?: PersistBackend | null
  /** Cross-tab channel factory. Default: `BroadcastChannel`; `null` disables cross-tab sync. */
  channel?: ChannelFactory | null
  /** Default `'pp-mock'`. */
  channelName?: string
  /** Warnings for non-fatal problems (storage unavailable, a background write failed). */
  warn?: (message: string, error?: unknown) => void
}

export interface MockPersistenceAdapter extends MockPersistence {
  /** `false` once storage is known to be unavailable (memory only). */
  readonly storageEnabled: boolean
  /** Accepts any object with the runtime parts it uses (a full `MockRuntime` in the app). */
  attach(runtime: PersistRuntime): void
  /** `true` while attached with a working `BroadcastChannel`. */
  readonly crossTabEnabled: boolean
  /**
   * Wipes the stored diff and tells other tabs to re-seed. `overrides` are forwarded so the other
   * tabs re-seed identically (F-06 may pass the `reset` overrides; without them, other tabs re-seed
   * with none).
   */
  clear(overrides?: Readonly<Record<string, unknown>>): Promise<void>
  /** Resolves when every queued write has finished (failures are not rethrown). */
  flush(): Promise<void>
  /** Stops write-through, clock persistence and cross-tab sync, and closes the channel. */
  detach(): void
}

// ---------------------------------------------------------------------------------------------
// IndexedDB backend
// ---------------------------------------------------------------------------------------------

/**
 * IndexedDB backend (`idb-keyval`). Returns `null` when IndexedDB does not exist or cannot be
 * opened synchronously; an asynchronous open failure surfaces on the first read or write.
 */
export function idbBackend(
  dbName: string = PERSIST_DB_NAME,
  storeName: string = PERSIST_STORE_NAME,
): PersistBackend | null {
  if (typeof indexedDB === 'undefined') return null
  let store: UseStore
  try {
    store = createStore(dbName, storeName)
  } catch {
    return null
  }
  const putAll = (s: IDBObjectStore, list: readonly PersistEntry[]) => {
    for (const [key, value] of list) s.put(value, key)
    return promisifyRequest(s.transaction)
  }
  return {
    async readAll() {
      const all = await entries<string, unknown>(store)
      return new Map(all)
    },
    write(list) {
      if (list.length === 0) return Promise.resolve()
      return setMany(
        list.map(([k, v]) => [k, v]),
        store,
      )
    },
    replace(list) {
      return store('readwrite', (s) => {
        s.clear()
        return putAll(s, list)
      })
    },
  }
}

// ---------------------------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMeta(value: unknown): value is PersistMeta {
  return (
    isRecord(value) && typeof value.format === 'number' && typeof value.seedVersion === 'string'
  )
}

function defaultWarn(message: string, error?: unknown) {
  if (error === undefined) console.warn(`[mock] ${message}`)
  else console.warn(`[mock] ${message}`, error)
}

/** Snapshot of the stores' diffs taken synchronously at commit time (cloned, so later writes cannot leak in). */
function snapshotDiffs(db: Db, names: readonly string[]): PersistEntry[] {
  const out: PersistEntry[] = []
  for (const name of names) {
    const store = db.store(name)
    if (!store) continue
    out.push([STORE_KEY_PREFIX + name, structuredClone(store.diff())])
  }
  return out
}

/**
 * Creates the persistence adapter for `bootMock({ persistence })`. One adapter serves one runtime
 * at a time.
 */
export function createMockPersistence(
  options: MockPersistenceOptions = {},
): MockPersistenceAdapter {
  const warn = options.warn ?? defaultWarn
  const channelName = options.channelName ?? MOCK_CHANNEL_NAME
  /** `undefined` → `openMockChannel`'s default (`BroadcastChannel`). */
  const channelFactory = options.channel

  let backendResolved = options.backend !== undefined
  let backend: PersistBackend | null = options.backend ?? null
  function getBackend(): PersistBackend | null {
    if (!backendResolved) {
      backendResolved = true
      backend = idbBackend()
      if (!backend) warn('IndexedDB unavailable; mock data will not survive a reload')
    }
    return backend
  }
  function disableStorage(reason: string, error: unknown) {
    if (backend) warn(reason, error)
    backend = null
    backendResolved = true
  }

  /** Serial write queue: writes land in commit order. */
  let tail: Promise<void> = Promise.resolve()
  function enqueue(write: (b: PersistBackend) => Promise<void>): Promise<void> {
    const b = getBackend()
    if (!b) return Promise.resolve()
    const run = tail.then(() => write(b))
    tail = run.catch(() => undefined)
    return run
  }
  function background(write: (b: PersistBackend) => Promise<void>, what: string) {
    enqueue(write).catch((error: unknown) => warn(`could not store ${what}`, error))
  }

  let runtime: PersistRuntime | null = null
  let channel: MockChannel | null = null
  let cleanups: (() => void)[] = []
  /** Set while this tab re-seeds because another tab reset: `clear()` must not wipe or re-post. */
  let remoteReset = false

  function meta(rt: PersistRuntime): PersistMeta {
    return { format: PERSIST_FORMAT, seedVersion: rt.seedVersion }
  }

  function post(message: MockBroadcast) {
    channel?.post(message)
  }

  function onCommit(rt: PersistRuntime, event: CommitEvent): Promise<void> | void {
    const names = Object.keys(event.changes)
    const message: MockBroadcast = {
      type: 'commit',
      seedVersion: rt.seedVersion,
      seq: event.seq,
      changes: event.changes,
    }
    if (!getBackend()) {
      post(message)
      return
    }
    const list = [...snapshotDiffs(rt.db, names), [META_KEY, meta(rt)] as const]
    return enqueue((b) => b.write(list)).then(() => post(message))
  }

  /** Remote messages are handled in arrival order; a commit that arrives during a re-seed waits for it. */
  let remoteTail: Promise<void> = Promise.resolve()
  function onRemote(rt: PersistRuntime, message: MockBroadcast) {
    if (message.seedVersion !== rt.seedVersion) return
    remoteTail = remoteTail.then(() => handleRemote(rt, message))
  }

  async function handleRemote(rt: PersistRuntime, message: MockBroadcast): Promise<void> {
    if (runtime !== rt) return // detached meanwhile
    if (message.type === 'reset') {
      remoteReset = true
      try {
        await rt.reset(message.overrides)
      } catch (error) {
        warn('re-seed after another tab reset failed', error)
      } finally {
        remoteReset = false
      }
      return
    }
    try {
      rt.db.applyChanges(message.changes)
    } catch (error) {
      warn('could not apply another tab’s changes', error)
      return
    }
    // Re-store the merged diffs so concurrent writers from two tabs converge on disk.
    const list = snapshotDiffs(rt.db, Object.keys(message.changes))
    background((b) => b.write(list), 'merged cross-tab changes')
  }

  const adapter: MockPersistenceAdapter = {
    get storageEnabled() {
      return getBackend() !== null
    },
    get crossTabEnabled() {
      return channel !== null
    },

    async load(seedVersion: string): Promise<PersistedMockState | null> {
      const b = getBackend()
      if (!b) return null
      let stored: Map<string, unknown>
      try {
        stored = await b.readAll()
      } catch (error) {
        disableStorage('IndexedDB unreadable; mock data will not survive a reload', error)
        return null
      }
      if (stored.size === 0) return null
      const m = stored.get(META_KEY)
      if (!isMeta(m) || m.format !== PERSIST_FORMAT || m.seedVersion !== seedVersion) {
        // Stale (another seed version) or foreign data: start from fresh seeds.
        await enqueue((w) => w.replace([])).catch((error: unknown) =>
          warn('could not discard stale mock data', error),
        )
        return null
      }
      const diffs: Record<string, unknown> = {}
      for (const [key, value] of stored) {
        if (key.startsWith(STORE_KEY_PREFIX)) diffs[key.slice(STORE_KEY_PREFIX.length)] = value
      }
      const offset = stored.get(CLOCK_KEY)
      return {
        diffs,
        clockOffset: typeof offset === 'number' && Number.isFinite(offset) ? offset : null,
      }
    },

    attach(rt: PersistRuntime) {
      adapter.detach()
      runtime = rt
      const clock: Clock = rt.clock
      cleanups.push(rt.db.onCommit((event) => onCommit(rt, event)))
      cleanups.push(
        clock.subscribe((offset) => {
          background((b) => b.write([[CLOCK_KEY, offset]]), 'the clock offset')
        }),
      )
      // Keep the boot offset (first boot: the anchor) and stamp the seed version.
      background(
        (b) =>
          b.write([
            [META_KEY, meta(rt)],
            [CLOCK_KEY, clock.getOffset()],
          ]),
        'the clock offset',
      )
      channel = openMockChannel(channelName, channelFactory)
      if (channel) {
        const ch = channel
        cleanups.push(ch.subscribe((message) => onRemote(rt, message)))
        cleanups.push(() => ch.close())
      }
    },

    async clear(overrides = {}) {
      if (remoteReset) return // the resetting tab already wiped the storage
      const rt = runtime
      await tail
      if (rt) {
        await enqueue((b) =>
          b.replace([
            [META_KEY, meta(rt)],
            [CLOCK_KEY, rt.clock.getOffset()],
          ]),
        )
        post({ type: 'reset', seedVersion: rt.seedVersion, overrides })
      } else {
        await enqueue((b) => b.replace([]))
      }
    },

    flush() {
      return tail
    },

    detach() {
      for (const cleanup of cleanups.reverse()) cleanup()
      cleanups = []
      channel = null
      runtime = null
    },
  }
  return adapter
}
