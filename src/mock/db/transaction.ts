/**
 * The mock database: a registry of stores plus `db.transaction` (overview §6.5 "Transactions",
 * ADR-0005 write-through).
 *
 * Phases:
 * 1. `seed` — the seed composer (F-06) writes the baseline. Nothing is tracked or emitted.
 * 2. `baseline()` — the current contents become the seed baseline; the phase becomes `live`.
 *    F-07 may then `loadDiff(...)` the persisted diff.
 * 3. `live` — every write is tracked. `transaction(fn)` groups the writes of one request; if `fn`
 *    throws, every touched store is rolled back and the error is rethrown. On success the net
 *    changes of all touched stores are emitted **once** to `onCommit` listeners (F-07 persists them
 *    in one IndexedDB transaction and broadcasts them). A write outside any transaction is its own
 *    implicit transaction.
 *
 * Rules:
 * - Transaction bodies are **synchronous** (handlers read request bodies/files before opening the
 *   transaction). A body that returns a promise is rolled back with `ASYNC_TRANSACTION`.
 * - Nested `transaction` calls join the outer one (no savepoints): the outermost call decides
 *   commit or rollback.
 * - Write-through: `settled(seq?)` resolves when the commit listeners have finished. Listener
 *   failures are tagged with the commit `seq` (`MockDbError` `COMMIT_FAILED`, `.seq`, `.cause`), so
 *   `settled(seqs)` reports only the failures of the caller's own commits. The mock transport
 *   (F-06) records the seqs of a request's commits (`lastSeq` before/after, or `onCommit`) and
 *   awaits them before answering, so a `page.reload()` right after a save sees the saved value.
 */

import { createPrngRegistry, type PrngRegistry } from '../determinism/prng'
import { MockDbError } from './errors'
import type { DbPhase, TransactionalStore, TxHost } from './store'

/** Net changes of one committed transaction, keyed by store name. */
export type ChangeSet = Record<string, unknown>

export interface CommitEvent {
  /** 1, 2, 3… per db instance. */
  seq: number
  changes: ChangeSet
}

export type CommitListener = (event: CommitEvent) => void | Promise<void>

export interface Db {
  readonly phase: DbPhase
  readonly prng: PrngRegistry
  readonly inTransaction: boolean
  /** Seq of the most recent committed (emitted) transaction; 0 before the first. */
  readonly lastSeq: number
  /** Registers a store (seed phase only); names are unique. Returns the store. */
  register<S extends TransactionalStore>(store: S): S
  store(name: string): TransactionalStore | undefined
  stores(): readonly TransactionalStore[]
  /** Runs `fn` atomically (see the file header). Returns `fn`'s result. */
  transaction<T>(fn: () => T): T
  /** End of seeding: snapshot the baseline of every store; phase → `live`. */
  baseline(): void
  /** Clears every store; phase → `seed` (used by `mock.reset()` before re-seeding). */
  reset(): void
  /** Subscribe to committed changes (F-07). Returns an unsubscribe function. */
  onCommit(listener: CommitListener): () => void
  /**
   * Waits for the commit listeners of the given commit(s) — or of every commit when `seq` is
   * omitted — and rejects with the first of their failures (a `COMMIT_FAILED` error carrying the
   * `seq`). Reported failures are consumed; failures of other commits are left for their callers.
   */
  settled(seq?: number | readonly number[]): Promise<void>
  /** Cumulative diff of every store against the baseline, keyed by store name. */
  diff(): Record<string, unknown>
  /** Loads persisted diffs (F-07 hydrate). Live phase, outside transactions. Not emitted. */
  loadDiff(diffs: Record<string, unknown>): void
  /** Applies another tab's `CommitEvent.changes` (F-07 broadcast). Not emitted. */
  applyChanges(changes: ChangeSet): void
}

export interface DbOptions {
  prng?: PrngRegistry
}

function commitFailed(commitSeq: number, cause: unknown): MockDbError {
  const reason = cause instanceof Error ? cause.message : String(cause)
  return new MockDbError('COMMIT_FAILED', `Commit #${String(commitSeq)} failed: ${reason}`, {
    seq: commitSeq,
    cause,
  })
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}

export function createDb(options: DbOptions = {}): Db {
  const prng = options.prng ?? createPrngRegistry()
  const stores = new Map<string, TransactionalStore>()
  const listeners = new Set<CommitListener>()
  /** Pending listener promises per commit seq. */
  const pending = new Map<number, Set<Promise<void>>>()
  /** Unreported listener failures, in order. */
  const errors: MockDbError[] = []
  let phase: DbPhase = 'seed'
  let depth = 0
  let enlisted: TransactionalStore[] = []
  let seq = 0

  function enlist(store: TransactionalStore) {
    if (enlisted.includes(store)) return
    store.beginTx()
    enlisted.push(store)
  }

  function fail(commitSeq: number, cause: unknown) {
    errors.push(commitFailed(commitSeq, cause))
  }

  function track(commitSeq: number, promise: Promise<void>) {
    let set = pending.get(commitSeq)
    if (!set) pending.set(commitSeq, (set = new Set()))
    const tracked = promise.then(
      () => undefined,
      (err: unknown) => fail(commitSeq, err),
    )
    set.add(tracked)
    void tracked.finally(() => {
      set.delete(tracked)
      if (set.size === 0) pending.delete(commitSeq)
    })
  }

  function emit(changes: ChangeSet) {
    const event: CommitEvent = { seq: ++seq, changes }
    for (const listener of listeners) {
      try {
        const result = listener(event)
        if (isThenable(result)) track(event.seq, Promise.resolve(result))
      } catch (err) {
        fail(event.seq, err)
      }
    }
  }

  function pendingFor(seqs: ReadonlySet<number> | null): Promise<void>[] {
    const out: Promise<void>[] = []
    for (const [s, set] of pending) if (!seqs || seqs.has(s)) out.push(...set)
    return out
  }

  function outsideTx(action: string) {
    if (depth > 0) throw new MockDbError('PHASE', `db.${action}: not allowed inside a transaction`)
  }

  function forEachKnown(
    entries: Record<string, unknown>,
    action: string,
    fn: (s: TransactionalStore, v: unknown) => void,
  ) {
    if (phase !== 'live') throw new MockDbError('PHASE', `db.${action}: only after baseline()`)
    outsideTx(action)
    for (const [name, value] of Object.entries(entries)) {
      const store = stores.get(name)
      if (!store) throw new MockDbError('INVALID', `db.${action}: unknown store '${name}'`)
      fn(store, value)
    }
  }

  const host: TxHost = {
    get phase() {
      return phase
    },
    prng,
    write(store, write) {
      if (depth > 0) {
        enlist(store)
        return write()
      }
      if (phase === 'live') {
        return db.transaction(() => {
          enlist(store)
          return write()
        })
      }
      return write()
    },
  }

  const db: Db = {
    get phase() {
      return phase
    },
    prng,
    get inTransaction() {
      return depth > 0
    },
    get lastSeq() {
      return seq
    },

    register(store) {
      if (phase !== 'seed') {
        throw new MockDbError(
          'PHASE',
          `db.register(${store.name}): stores register before baseline()`,
        )
      }
      if (stores.has(store.name)) {
        throw new MockDbError('DUPLICATE_STORE', `Store '${store.name}' is already registered`)
      }
      stores.set(store.name, store)
      store.attach(host)
      return store
    },
    store: (name) => stores.get(name),
    stores: () => [...stores.values()],

    transaction<T>(fn: () => T): T {
      if (depth > 0) {
        depth++
        try {
          return fn()
        } finally {
          depth--
        }
      }

      depth = 1
      enlisted = []
      let result: T
      try {
        result = fn()
        if (isThenable(result)) {
          Promise.resolve(result).catch(() => undefined)
          throw new MockDbError(
            'ASYNC_TRANSACTION',
            'db.transaction: the body must be synchronous; await I/O before opening the transaction',
          )
        }
      } catch (err) {
        for (const store of [...enlisted].reverse()) store.rollbackTx()
        enlisted = []
        depth = 0
        throw err
      }

      const changes: ChangeSet = {}
      let changed = false
      for (const store of enlisted) {
        const c = store.commitTx()
        if (c !== null) {
          changes[store.name] = c
          changed = true
        }
      }
      enlisted = []
      depth = 0
      if (changed && phase === 'live') emit(changes)
      return result
    },

    baseline() {
      outsideTx('baseline')
      if (phase !== 'seed') throw new MockDbError('PHASE', 'db.baseline: already live')
      for (const store of stores.values()) store.markBaseline()
      phase = 'live'
    },

    reset() {
      outsideTx('reset')
      for (const store of stores.values()) store.clear()
      phase = 'seed'
    },

    onCommit(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    async settled(which) {
      const seqs = which === undefined ? null : new Set(typeof which === 'number' ? [which] : which)
      for (let waiting = pendingFor(seqs); waiting.length > 0; waiting = pendingFor(seqs)) {
        await Promise.all(waiting)
      }
      const mine = errors.filter((e) => !seqs || seqs.has(e.seq ?? -1))
      const [first] = mine
      if (!first) return
      for (const e of mine) errors.splice(errors.indexOf(e), 1)
      throw first
    },

    diff() {
      const out: Record<string, unknown> = {}
      for (const [name, store] of stores) out[name] = store.diff()
      return out
    },

    loadDiff(diffs) {
      forEachKnown(diffs, 'loadDiff', (store, diff) => store.loadDiff(diff))
    },

    applyChanges(changes) {
      forEachKnown(changes, 'applyChanges', (store, c) => store.applyChanges(c))
    },
  }
  return db
}
