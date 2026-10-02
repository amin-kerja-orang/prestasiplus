/**
 * The one storage interface of the mock (overview §6.5). Materialised tables (`defineTable`, F-05)
 * and virtual datasets (`defineVirtualDataset`, F-09) both implement `Store`; only repositories
 * (§6.7) and the owning module's handlers touch them.
 *
 * It also defines the transaction/persistence contract every store implements so that
 * `db.transaction` (rollback) and F-07 persistence (diff, write-through, cross-tab apply) can treat
 * tables and datasets alike (`TransactionalStore`).
 */

import type { Prng, PrngRegistry } from '../determinism/prng'

export type StoreId = string | number

// ---------------------------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------------------------

/**
 * A per-field condition:
 * - `value` — equal (`null` matches `null` and `undefined`; `Date`s compare by time);
 * - `value[]` — equal to any (an empty array matches nothing);
 * - `{ ne }` — not equal (JS semantics: `null`/`undefined` values match unless `ne` is `null`);
 * - `{ gte?, lte? }` — inclusive range; `null`/`undefined` values never match;
 * - `{ isNull: true | false }` — value is (not) `null`/`undefined`.
 */
export type Condition<V> =
  V | null | readonly V[] | { ne: V | null } | { gte?: V; lte?: V } | { isNull: boolean }

export type Where<Row> = { [K in keyof Row]?: Condition<Row[K]> }

export type SortDirection = 'asc' | 'desc'
export type SortKey<Row> = (keyof Row & string) | { field: keyof Row & string; dir?: SortDirection }
/**
 * One key or several (priority order). Nulls sort first ascending and last descending (MySQL).
 * The sort is stable over the default id-ascending order, so ties keep ascending ids.
 */
export type SortSpec<Row> = SortKey<Row> | readonly SortKey<Row>[]

export interface QueryOptions<Row> {
  where?: Where<Row>
  /** Any other predicate (e.g. text search); forces a scan. */
  match?: (row: Row) => boolean
  /** Default: ascending id. */
  sort?: SortSpec<Row>
  /** 1-based. Requires `pageSize`. An out-of-range page returns no rows (Laravel), `total` is kept. */
  page?: number
  pageSize?: number
}

export interface QueryResult<Row> {
  rows: Row[]
  /** Matches before paging. */
  total: number
}

export type InsertInput<Row extends { id: StoreId }> = Omit<Row, 'id'> & { id?: Row['id'] }

export interface Store<Row extends { id: StoreId }, Id extends StoreId = Row['id']> {
  readonly name: string
  get(id: Id): Row | undefined
  /** Rows in the order of `ids`; unknown ids are skipped. */
  getMany(ids: readonly Id[]): Row[]
  query(q?: QueryOptions<Row>): QueryResult<Row>
  count(where?: Where<Row>, match?: (row: Row) => boolean): number
  groupCount<K extends keyof Row>(field: K, where?: Where<Row>): Map<Row[K], number>
  /** `n` distinct matching rows drawn uniformly with `rng` (all matches, shuffled, if fewer). */
  sample(where: Where<Row>, n: number, rng: Prng): Row[]
  insert(row: InsertInput<Row>): Row
  update(id: Id, patch: Partial<Row>): Row
  remove(id: Id): void
}

// ---------------------------------------------------------------------------------------------
// Transactions and persistence (consumed by `createDb` and by F-07)
// ---------------------------------------------------------------------------------------------

/** The database side a store talks to while it is attached (see `createDb`). */
export interface TxHost {
  readonly phase: DbPhase
  /** The db's named PRNG streams (used by the `uuid` / `opaque` id strategies). */
  readonly prng: PrngRegistry
  /**
   * Called by a store before each write. Inside a transaction it enlists the store (calling its
   * `beginTx()` once per transaction). Outside a transaction in the `live` phase it runs `write`
   * as an implicit single-write transaction. In the `seed` phase it just runs `write`.
   */
  write<T>(store: TransactionalStore, write: () => T): T
}

/**
 * `seed`: seeds write the baseline; nothing is tracked.
 * `live`: every write is tracked as a diff against the baseline and emitted on commit.
 */
export type DbPhase = 'seed' | 'live'

/**
 * What every store implements for `db.transaction` and persistence.
 * `C` = the change set of one transaction; `D` = the cumulative diff against the seed.
 */
export interface TransactionalStore<C = unknown, D = unknown> {
  readonly name: string
  /** Called once when the store is registered with a db. */
  attach(host: TxHost): void
  /** Start recording undo information for the current transaction. */
  beginTx(): void
  /** Finish the transaction; returns its net changes, or `null` when nothing changed. */
  commitTx(): C | null
  /** Undo every write since `beginTx()`. */
  rollbackTx(): void
  /** End of seeding: the current contents become the baseline; tracking starts. */
  markBaseline(): void
  /** Drop all contents and state; back to the seed phase (used by `mock.reset()`). */
  clear(): void
  /** The cumulative diff against the baseline (what F-07 stores under this store's key). */
  diff(): D
  /** Replace the diff with a stored one (F-07 hydrate at boot, after seeding). */
  loadDiff(diff: D): void
  /** Apply another tab's committed changes (F-07 `BroadcastChannel`). Not re-emitted. */
  applyChanges(changes: C): void
}
