/**
 * Runtime ownership guard of shared stores (D12, ADR-0014 §5).
 *
 * `defineRepository` installs a guard on every store it owns:
 *
 * - **Writes** (`insert`, `update`, `remove`, and on a virtual dataset the seed-phase inputs
 *   `addAnchors` and `overrideSpec`) are allowed only while an **owner scope** of the store's
 *   owner is active. Repository methods run inside that scope automatically, so the owner's repository is the only code that can write the store. A
 *   write from anywhere else (a non-owner handler holding the raw store through `plugin.datasets`,
 *   an owner handler that bypasses its repository, a seed) throws `RepositoryError('OWNERSHIP')`.
 *   An owner that applies seed overrides (or accepts distribution cells from another module, e.g.
 *   the M06 SPM pool) does it in a repository method that calls `overrideSpec` (seed phase,
 *   owner-validated).
 * - **Reads of a virtual dataset before it is compiled** throw `RepositoryError('PHASE')`. A dataset
 *   compiles on its first read, after which `addAnchors` fails; blocking early reads keeps the
 *   contribute phase open until the composer compiles every dataset at finalise (overview §6.9), so
 *   every module's `seed(ctx)` can contribute anchors whatever the registry order.
 * - `attach(host)` is wrapped to learn the db phase (`seed` / `live`) the store is attached to.
 *
 * The guard is installed in place (the store object keeps its identity, so the db, transactions and
 * persistence see the same object). A store has exactly one owner: guarding it for a second owner
 * throws.
 */

import type { StoreId, TxHost } from '../db/store'
import { RepositoryError } from './errors'

/** What the guard needs from a store: the `Store` write methods plus `name` and `attach`. */
export interface GuardableStore {
  readonly name: string
  insert(row: never): unknown
  update(id: never, patch: never): unknown
  remove(id: never): unknown
  attach(host: TxHost): void
}

/** A virtual dataset (F-09) as seen by the guard: compile state and the seed-phase anchor API. */
export interface ContributableStore<
  Row extends { id: StoreId } = { id: StoreId },
> extends GuardableStore {
  readonly kind: 'virtual'
  readonly compiled: boolean
  addAnchors(rows: readonly Row[], contributor?: string): void
  compile(): void
}

export function isVirtualStore(store: GuardableStore): store is ContributableStore {
  const s = store as Partial<ContributableStore>
  return s.kind === 'virtual' && typeof s.addAnchors === 'function'
}

// ---------------------------------------------------------------------------------------------
// Owner scope
// ---------------------------------------------------------------------------------------------

const scopes: string[] = []

/** The owner whose repository code is running, or `null`. */
export function currentOwner(): string | null {
  return scopes.length > 0 ? (scopes[scopes.length - 1] as string) : null
}

/**
 * Runs `fn` as `owner`. Internal to the framework: repository methods are wrapped with it. Writes
 * made after an `await` inside an async method are outside the scope (repository methods are
 * synchronous, like `db.transaction` bodies).
 */
export function runAsOwner<T>(owner: string, fn: () => T): T {
  scopes.push(owner)
  try {
    return fn()
  } finally {
    scopes.pop()
  }
}

// ---------------------------------------------------------------------------------------------
// Guard
// ---------------------------------------------------------------------------------------------

export interface StoreGuard {
  readonly owner: string
  /** Name of the repository that installed the guard (for messages). */
  readonly repository: string
  /** The db host the store is attached to (`null` before `db.register`). */
  readonly host: TxHost | null
}

interface MutableGuard {
  owner: string
  repository: string
  host: TxHost | null
}

const guards = new WeakMap<object, MutableGuard>()

const WRITE_METHODS = ['insert', 'update', 'remove'] as const
/** Seed-phase inputs of a virtual dataset: anchors and spec transforms both change owner totals. */
const VIRTUAL_WRITE_METHODS = ['addAnchors', 'overrideSpec'] as const
/** Methods of a virtual dataset that compile it (read methods of `Store` plus compiled views). */
const VIRTUAL_READ_METHODS = [
  'get',
  'getMany',
  'has',
  'query',
  'count',
  'groupCount',
  'sample',
  'cells',
  'isAnchor',
  'fingerprint',
] as const

export function storeGuard(store: object): StoreGuard | undefined {
  return guards.get(store)
}

type AnyMethod = (...args: unknown[]) => unknown

function wrap(store: object, method: string, before: () => void) {
  const target = store as Record<string, unknown>
  const original = target[method]
  if (typeof original !== 'function') return
  const fn = original as AnyMethod
  target[method] = function guarded(this: unknown, ...args: unknown[]) {
    before()
    return fn.apply(this, args)
  }
}

/**
 * Guards `store` for `owner`. Idempotent for the same owner (a store may back several repositories
 * of one module); throws when the store already belongs to another owner.
 */
export function guardStore(store: GuardableStore, owner: string, repository: string): StoreGuard {
  const existing = guards.get(store)
  if (existing) {
    if (existing.owner !== owner) {
      throw new RepositoryError(
        'OWNERSHIP',
        `Store '${store.name}' is owned by ${existing.owner} (repository '${existing.repository}'); ${owner} cannot define repository '${repository}' over it. Use the ${existing.owner} repository contract (D12).`,
      )
    }
    return existing
  }
  if (Object.isFrozen(store)) {
    throw new RepositoryError(
      'CONTRACT',
      `Store '${store.name}' is frozen; a repository cannot guard it`,
    )
  }

  const guard: MutableGuard = { owner, repository, host: null }
  guards.set(store, guard)

  const denyWrite = (method: string) => () => {
    const active = currentOwner()
    if (active === owner) return
    throw new RepositoryError(
      'OWNERSHIP',
      `${store.name}.${method}: store '${store.name}' is owned by ${owner} (D12). Write through the ${owner} repository '${repository}'; direct writes are refused (current scope: ${active ?? 'none'}).`,
    )
  }
  for (const m of WRITE_METHODS) wrap(store, m, denyWrite(m))

  if (isVirtualStore(store)) {
    const virtual = store
    for (const m of VIRTUAL_WRITE_METHODS) wrap(store, m, denyWrite(m))
    for (const m of VIRTUAL_READ_METHODS) {
      wrap(store, m, () => {
        if (virtual.compiled) return
        throw new RepositoryError(
          'PHASE',
          `${store.name}.${m}: read before finalise. Every module contributes anchors in seed(ctx); the composer compiles the dataset at finalise, and reads start there (use the plugin's finalise(ctx), or call finaliseRepositories() in tests).`,
        )
      })
    }
  }

  const attach = store.attach.bind(store)
  ;(store as { attach: (host: TxHost) => void }).attach = (host: TxHost) => {
    attach(host)
    guard.host = host
  }
  return guard
}
