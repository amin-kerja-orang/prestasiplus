/**
 * Materialised table (overview §6.5): rows in a `Map` with declared secondary indexes, implementing
 * `Store` and `TransactionalStore`.
 *
 * - Rows are stored as shallow-frozen copies; `get`/`query` return them directly, so callers must
 *   not mutate them (they will throw in strict mode). Use `update(id, patch)`.
 * - Default order is ascending id. `sort` is stable over it.
 * - Change tracking: after `markBaseline()` (end of seeding) every write is recorded as a diff
 *   against the baseline (`diff()`): upserted rows, deleted baseline ids, and the id counter.
 *   Inserting then deleting a runtime row leaves no trace. `db.transaction` gets the net changes of
 *   one transaction from `commitTx()` and can undo them with `rollbackTx()`.
 */

import { createPrngRegistry, type PrngRegistry } from '../determinism/prng'
import { MockDbError } from './errors'
import {
  mergeIdState,
  type IdAllocator,
  type IdCounterState,
  type IdStrategy,
} from './id-strategies'
import type {
  InsertInput,
  QueryOptions,
  QueryResult,
  Store,
  StoreId,
  TransactionalStore,
  TxHost,
  Where,
} from './store'
import { compareValues, compileSort, compileWhere, rowMatches, type CompiledWhere } from './where'
import type { Prng } from '../determinism/prng'

export interface TableDef<Row extends { id: StoreId }> {
  /** Unique store name, e.g. `'practice.sessions'`. It is also the persistence key (F-07). */
  name: string
  ids: IdStrategy<Row['id']>
  /** Fields with a secondary index (equality / `in` / `isNull` lookups). */
  indexes?: readonly (keyof Row & string)[]
}

/** Net changes of one transaction (and of one cross-tab broadcast). */
export interface TableChanges<Row extends { id: StoreId }> {
  kind: 'table'
  upserts: Row[]
  deletes: Row['id'][]
  ids: IdCounterState
}

/** Cumulative diff against the seed baseline (what F-07 stores under the table's name). */
export interface TableDiff<Row extends { id: StoreId }> {
  kind: 'table'
  upserts: Row[]
  /** Baseline ids that were deleted. */
  deletes: Row['id'][]
  /** The id counter, or `null` when it has not moved since the baseline. */
  ids: IdCounterState | null
}

export interface Table<Row extends { id: StoreId }>
  extends Store<Row>, TransactionalStore<TableChanges<Row>, TableDiff<Row>> {
  readonly size: number
  readonly indexedFields: readonly string[]
  has(id: Row['id']): boolean
}

const DELETED = Symbol('deleted')
const ABSENT = Symbol('absent')
type DirtyEntry<Row> = Row | typeof DELETED

interface TxState<Row extends { id: StoreId }> {
  /** Row before the transaction's first write to that id (`undefined` = did not exist). */
  undo: Map<Row['id'], Row | undefined>
  /** Dirty entry before the first write (`ABSENT` = none). */
  dirtyPrev: Map<Row['id'], DirtyEntry<Row> | typeof ABSENT>
  idState: IdCounterState
}

function indexKey(value: unknown): unknown {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.getTime()
  return value
}

function checkId(id: unknown, table: string): asserts id is StoreId {
  const ok =
    (typeof id === 'number' && Number.isSafeInteger(id)) || (typeof id === 'string' && id !== '')
  if (!ok) throw new MockDbError('INVALID', `${table}: invalid id ${JSON.stringify(id)}`)
}

export function defineTable<Row extends { id: StoreId }>(def: TableDef<Row>): Table<Row> {
  type Id = Row['id']
  const { name } = def
  if (!name) throw new MockDbError('INVALID', 'defineTable: name is required')
  const indexedFields = [...new Set(def.indexes ?? [])] as string[]
  if (indexedFields.includes('id')) {
    throw new MockDbError('INVALID', `${name}: 'id' is the primary key; do not index it`)
  }

  const rows = new Map<Id, Row>()
  const indexes = new Map<string, Map<unknown, Set<Id>>>(indexedFields.map((f) => [f, new Map()]))
  const allocator: IdAllocator<Id> = def.ids.create()
  let orderedCache: Id[] | null = null
  let host: TxHost | null = null
  let ownPrng: PrngRegistry | null = null

  let baselineIds: Set<Id> | null = null
  let baselineIdState = ''
  const dirty = new Map<Id, DirtyEntry<Row>>()
  let tx: TxState<Row> | null = null

  // --- raw storage ---------------------------------------------------------------------------

  function indexAdd(row: Row) {
    for (const field of indexedFields) {
      const map = indexes.get(field) as Map<unknown, Set<Id>>
      const key = indexKey((row as Record<string, unknown>)[field])
      let set = map.get(key)
      if (!set) map.set(key, (set = new Set()))
      set.add(row.id)
    }
  }

  function indexRemove(row: Row) {
    for (const field of indexedFields) {
      const map = indexes.get(field) as Map<unknown, Set<Id>>
      const key = indexKey((row as Record<string, unknown>)[field])
      const set = map.get(key)
      if (!set) continue
      set.delete(row.id)
      if (set.size === 0) map.delete(key)
    }
  }

  function putRaw(row: Row) {
    const prev = rows.get(row.id)
    if (prev) indexRemove(prev)
    else orderedCache = null
    rows.set(row.id, row)
    indexAdd(row)
  }

  function deleteRaw(id: Id) {
    const prev = rows.get(id)
    if (!prev) return
    indexRemove(prev)
    rows.delete(id)
    orderedCache = null
  }

  function orderedIds(): Id[] {
    if (!orderedCache) orderedCache = [...rows.keys()].sort(compareValues)
    return orderedCache
  }

  // --- tracking ------------------------------------------------------------------------------

  function beforeWrite(id: Id) {
    if (!tx || tx.undo.has(id)) return
    tx.undo.set(id, rows.get(id))
    tx.dirtyPrev.set(id, dirty.has(id) ? (dirty.get(id) as DirtyEntry<Row>) : ABSENT)
  }

  function trackUpsert(row: Row) {
    if (baselineIds) dirty.set(row.id, row)
  }

  function trackDelete(id: Id) {
    if (!baselineIds) return
    if (baselineIds.has(id)) dirty.set(id, DELETED)
    else dirty.delete(id)
  }

  function run<T>(write: () => T): T {
    return host ? host.write(table, write) : write()
  }

  function prng(): PrngRegistry {
    if (host) return host.prng
    return (ownPrng ??= createPrngRegistry())
  }

  /**
   * `overwrite` (hydrate): the stored counter replaces the current one.
   * `merge` (another tab's commit): the counter only moves forward (`mergeIdState`), so a stale
   * or out-of-order broadcast can never make this tab reuse an id.
   */
  function applyRaw(
    upserts: readonly Row[],
    deletes: readonly Id[],
    ids: IdCounterState | null,
    counter: 'overwrite' | 'merge',
  ) {
    if (!baselineIds)
      throw new MockDbError('PHASE', `${name}: cannot apply a diff before the baseline`)
    if (tx) throw new MockDbError('PHASE', `${name}: cannot apply a diff inside a transaction`)
    for (const id of deletes) {
      deleteRaw(id)
      trackDelete(id)
    }
    for (const input of upserts) {
      checkId(input.id, name)
      const row = Object.freeze({ ...input }) as Row
      putRaw(row)
      allocator.observe(row.id)
      trackUpsert(row)
    }
    if (ids) {
      allocator.setState(counter === 'merge' ? mergeIdState(allocator.getState(), ids) : ids)
    }
  }

  // --- scans ---------------------------------------------------------------------------------

  /** Candidate ids from the most selective indexed condition, or `null` for a full scan. */
  function indexCandidates(compiled: CompiledWhere): Set<Id> | null {
    let best: Set<Id> | null = null
    for (const [field, cond] of compiled) {
      const map = indexes.get(field)
      if (!map) continue
      let set: Set<Id>
      if (cond.kind === 'eq') set = map.get(indexKey(cond.value)) ?? new Set()
      else if (cond.kind === 'isNull' && cond.isNull) set = map.get(null) ?? new Set()
      else if (cond.kind === 'in') {
        set = new Set()
        for (const v of cond.values) for (const id of map.get(indexKey(v)) ?? []) set.add(id)
      } else continue
      if (!best || set.size < best.size) best = set
    }
    return best
  }

  function scan(where?: Where<Row>, match?: (row: Row) => boolean): Row[] {
    const compiled = compileWhere(where)
    const candidates = indexCandidates(compiled)
    const ids = candidates ? [...candidates].sort(compareValues) : orderedIds()
    const out: Row[] = []
    for (const id of ids) {
      const row = rows.get(id) as Row
      if (rowMatches(row, compiled) && (!match || match(row))) out.push(row)
    }
    return out
  }

  // --- the table -----------------------------------------------------------------------------

  const table: Table<Row> = {
    name,
    indexedFields,
    get size() {
      return rows.size
    },
    has: (id) => rows.has(id),
    get: (id) => rows.get(id),
    getMany(ids) {
      const out: Row[] = []
      for (const id of ids) {
        const row = rows.get(id)
        if (row) out.push(row)
      }
      return out
    },

    query(q: QueryOptions<Row> = {}): QueryResult<Row> {
      let matched = scan(q.where, q.match)
      if (q.sort !== undefined) matched = matched.slice().sort(compileSort(q.sort))
      const total = matched.length
      if (q.page === undefined && q.pageSize === undefined) return { rows: matched, total }
      const pageSize = q.pageSize
      const page = q.page ?? 1
      if (pageSize === undefined || !Number.isSafeInteger(pageSize) || pageSize < 1) {
        throw new MockDbError('INVALID', `${name}.query: pageSize must be a positive integer`)
      }
      if (!Number.isSafeInteger(page) || page < 1) {
        throw new MockDbError('INVALID', `${name}.query: page must be a positive integer`)
      }
      const start = (page - 1) * pageSize
      return { rows: matched.slice(start, start + pageSize), total }
    },

    count(where, match) {
      if (!match && (!where || compileWhere(where).length === 0)) return rows.size
      return scan(where, match).length
    },

    groupCount<K extends keyof Row>(field: K, where?: Where<Row>) {
      // Keys are normalised like `where` equality: null and undefined form one `null` group, and
      // Dates group by epoch ms (the key is the number).
      const out = new Map<Row[K], number>()
      for (const row of scan(where)) {
        const key = indexKey(row[field]) as Row[K]
        out.set(key, (out.get(key) ?? 0) + 1)
      }
      return out
    },

    sample(where: Where<Row>, n: number, rng: Prng) {
      if (!Number.isSafeInteger(n) || n < 0) {
        throw new MockDbError('INVALID', `${name}.sample: n must be a non-negative integer`)
      }
      const pool = scan(where)
      const k = Math.min(n, pool.length)
      for (let i = 0; i < k; i++) {
        const j = i + Math.floor(rng.next() * (pool.length - i))
        const tmp = pool[i] as Row
        pool[i] = pool[j] as Row
        pool[j] = tmp
      }
      return pool.slice(0, k)
    },

    insert(input: InsertInput<Row>) {
      return run(() => {
        let id = input.id
        if (id === undefined || id === null) {
          id = allocator.next({ taken: (candidate) => rows.has(candidate), prng: prng() })
        } else {
          checkId(id, name)
          if (rows.has(id))
            throw new MockDbError('DUPLICATE_ID', `${name}: id ${String(id)} exists`)
          allocator.observe(id)
        }
        const row = Object.freeze({ ...input, id }) as unknown as Row
        beforeWrite(id)
        putRaw(row)
        trackUpsert(row)
        return row
      })
    },

    update(id, patch) {
      return run(() => {
        const prev = rows.get(id)
        if (!prev) throw new MockDbError('NOT_FOUND', `${name}: id ${String(id)} not found`)
        if ('id' in patch && patch.id !== undefined && patch.id !== id) {
          throw new MockDbError('ID_CHANGE', `${name}: cannot change id ${String(id)}`)
        }
        const row = Object.freeze({ ...prev, ...patch, id }) as Row
        beforeWrite(id)
        putRaw(row)
        trackUpsert(row)
        return row
      })
    },

    remove(id) {
      run(() => {
        if (!rows.has(id)) throw new MockDbError('NOT_FOUND', `${name}: id ${String(id)} not found`)
        beforeWrite(id)
        deleteRaw(id)
        trackDelete(id)
      })
    },

    // --- TransactionalStore --------------------------------------------------------------------

    attach(next) {
      if (tx) throw new MockDbError('PHASE', `${name}: cannot re-attach inside a transaction`)
      host = next
    },

    beginTx() {
      tx = { undo: new Map(), dirtyPrev: new Map(), idState: allocator.getState() }
    },

    commitTx() {
      if (!tx) return null
      const { undo, idState } = tx
      tx = null
      const upserts: Row[] = []
      const deletes: Id[] = []
      for (const [id, prev] of undo) {
        const cur = rows.get(id)
        if (cur) upserts.push(cur)
        else if (prev) deletes.push(id)
      }
      const ids = allocator.getState()
      const idsMoved = JSON.stringify(ids) !== JSON.stringify(idState)
      if (upserts.length === 0 && deletes.length === 0 && !idsMoved) return null
      upserts.sort((a, b) => compareValues(a.id, b.id))
      deletes.sort(compareValues)
      return { kind: 'table', upserts, deletes, ids }
    },

    rollbackTx() {
      if (!tx) return
      const { undo, dirtyPrev, idState } = tx
      tx = null
      for (const [id, prev] of undo) {
        if (prev) putRaw(prev)
        else deleteRaw(id)
        const d = dirtyPrev.get(id)
        if (d === ABSENT || d === undefined) dirty.delete(id)
        else dirty.set(id, d)
      }
      allocator.setState(idState)
    },

    markBaseline() {
      if (tx)
        throw new MockDbError('PHASE', `${name}: cannot mark the baseline inside a transaction`)
      baselineIds = new Set(rows.keys())
      baselineIdState = JSON.stringify(allocator.getState())
      dirty.clear()
    },

    clear() {
      rows.clear()
      for (const map of indexes.values()) map.clear()
      orderedCache = null
      allocator.reset()
      baselineIds = null
      baselineIdState = ''
      dirty.clear()
      tx = null
    },

    diff(): TableDiff<Row> {
      const upserts: Row[] = []
      const deletes: Id[] = []
      for (const [id, entry] of dirty) {
        if (entry === DELETED) deletes.push(id)
        else upserts.push(entry)
      }
      upserts.sort((a, b) => compareValues(a.id, b.id))
      deletes.sort(compareValues)
      const state = allocator.getState()
      const ids = baselineIds && JSON.stringify(state) !== baselineIdState ? state : null
      return { kind: 'table', upserts, deletes, ids }
    },

    loadDiff(diff) {
      applyRaw(diff.upserts, diff.deletes, diff.ids, 'overwrite')
    },

    applyChanges(changes) {
      applyRaw(changes.upserts, changes.deletes, changes.ids, 'merge')
    },
  }
  return table
}
