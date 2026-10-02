/**
 * `defineVirtualDataset` (D11, overview §6.6, ADR-0013): a large live collection that reports the
 * live total and produces any row on demand, deterministically, without materialising the rows.
 * It implements the same `Store` and `TransactionalStore` contracts as materialised tables
 * (`defineTable`, F-05), so repositories (F-10), `db.transaction` and persistence (F-07) treat both
 * alike.
 *
 * Storage after compilation: `keys: Uint32Array` (ascending internal keys = ids for integer
 * datasets), `cellOf: Uint32Array` (cell index per row; 0 = deleted) and the cell table. Rows are
 * `derive(id, facets, rng)` for generated slots, the literal row for anchors, plus the overlay.
 *
 * Overlay (mutations): `overrides` (patches of spec rows), `deleted` (spec rows) and `inserted`
 * (runtime rows with `runtimeIds`, e.g. `floor`). A patch that changes a facet moves the row's
 * `cellOf` entry to the matching cell (created if new) and updates the per-cell counts, so every
 * facet count stays exact and O(cells). The overlay is exactly the persisted diff. Every change
 * increments `version`, which keys the slow-path query cache.
 *
 * Queries:
 * - `count` / `groupCount` on facet conditions: O(cells).
 * - `query` in id order (asc/desc): a typed-array scan with a cell mask and early exit; only the
 *   returned rows are derived.
 * - `query` sorted by `order.field` ("newest first"): the generated stream (monotone in id) merged
 *   with anchors, runtime rows and overridden rows by their own values.
 * - `query` sorted by facet fields (optionally then `id`): bucketed by cell rank, no derivation.
 * - conditions on derived fields, `match`, or any other sort: the slow path, which derives rows for
 *   the mask-matching slots only and caches the matching refs per `(version, query)` (LRU).
 * - `sample`: uniform, without repetition; the same draws as `defineTable().sample` over the same
 *   rows in id order.
 *
 * Phases: anchors are added (`addAnchors`) and the spec overridden (`overrideSpec`) before
 * compilation. Compilation happens at `markBaseline()` (db `baseline()`, after every seed has
 * contributed) or lazily on the first read. Writes are rejected in the db seed phase: a dataset is
 * seeded by its spec and anchors only ("fixtures are anchors, not additions").
 */

import { MockDbError } from '../db/errors'
import type { IdAllocator } from '../db/id-strategies'
import type { InsertInput, QueryResult, SortSpec, StoreId, TxHost, Where } from '../db/store'
import {
  compareValues,
  compileSort,
  compileWhere,
  rowMatches,
  testCondition,
  type CompiledWhere,
  type ParsedCondition,
} from '../db/where'
import { fnv1a32 } from '../determinism/hash'
import { createPrngRegistry, mulberry32, type PrngRegistry } from '../determinism/prng'
import {
  claimAnchors,
  layoutSlots,
  prepareSpec,
  type AnchorInput,
  type PreparedSpec,
  type SlotGeometry,
} from './compile'
import { DatasetSpecError, type DatasetIssue } from './errors'
import { Lru } from './lru'
import { cellKey, isFacetValue, type CellSpec, type FacetRecord } from './spec'
import type {
  DatasetCell,
  DatasetCountOptions,
  DatasetChanges,
  DatasetDiff,
  DatasetOverlay,
  DatasetQueryOptions,
  DatasetSearch,
  FeasibilityReport,
  IdCodec,
  LayoutBlock,
  VirtualDataset,
  VirtualDatasetDef,
} from './types'

/** Default seed base of dataset layout and row streams (Delivery Lead decision). */
export const DATASET_SEED_BASE = 1

interface InsertedEntry<Row> {
  row: Row
  cell: number
  key: number | undefined
}

type EntryState<Row> =
  | { k: 'base' }
  | { k: 'override'; patch: Partial<Row> }
  | { k: 'deleted' }
  | { k: 'absent' }
  | { k: 'inserted'; row: Row }

interface Compiled<Row> {
  n: number
  keys: Uint32Array
  cellOf: Uint32Array
  anchorFlag: Uint8Array
  /** Positions of the anchors, ascending. */
  anchorPos: number[]
  anchorRows: Map<number, Row>
  fingerprint: string
}

interface Plan<Row> {
  mask: Uint8Array
  idConds: ParsedCondition[]
  /** Conditions on cheap fields (evaluated without derivation). */
  cheap: CompiledWhere
  /** Conditions on other derived fields (need the full row). */
  full: CompiledWhere
  match: ((row: Row) => boolean) | undefined
  /**
   * `match` reads only `matchFields` (id, facets, cheap fields): it gets one reused partial row
   * per scan, filled from the value columns (no derivation, no per-row allocation).
   */
  partial: PartialPlan | null
  /** Needs a per-row test beyond the cell mask and id (cheap/full conditions or `match`). */
  slow: boolean
  /** Needs full rows (`derive`). */
  needFull: boolean
  /** Compiled cheap-field conditions. */
  cheapEvals: { col: unknown[]; test: (v: unknown) => boolean }[]
  /**
   * Row bitmap of the conditions that have one (cheap-field conditions, and the search when it has
   * no facet/id fields), ANDed, with its hits per cell: the per-row test is one lookup and the
   * total of such plans is a sum over the cell mask.
   */
  rowHits: Uint8Array | null
  rowCellHits: Uint32Array | null
  /**
   * Narrow plans (candidates ≤ N/32): the candidate positions in id order (lazy, `narrowPositions`),
   * so their scans and counts cost O(candidates) instead of O(N). `null` = wide (scan the window).
   */
  narrow?: Uint32Array | null
  /** Rows in the masked cells (current counts), computed with the mask. */
  candidates: number
  /** Lowercased search term and its fields, or null. */
  search: SearchPlan | null
  /** Per-position test of a plan that needs no full rows (`compileTest`). */
  test: (p: number) => boolean
  /** Count is a sum over matching cells. */
  countable: boolean
  /** Key bounds implied by numeric `id` conditions (inclusive). */
  idLo: number
  idHi: number
  /** Every `id` condition is expressed by the bounds (no per-row id test needed). */
  idBounded: boolean
}

interface SearchPlan {
  /** The term: lowercased unless `cs`. */
  term: string
  /** Case-sensitive search. */
  cs: boolean
  fields: string[]
  /** Positions whose cheap search fields contain the term (from the search indexes), or null. */
  hits: Uint8Array | null
  /** Hits per cell (index = cell), so a search-only total is a sum over the cell mask. */
  cellHits: Uint32Array | null
  /** Facet / id fields, read per row. */
  direct: string[]
}

interface PartialPlan {
  /** The reused row object handed to `match`. */
  fly: Record<string, unknown>
  cheapCols: [field: string, col: unknown[]][]
  facetFields: string[]
  withId: boolean
}

/**
 * Search index of one cheap field (both case modes). Built in one pass: each row's value is read
 * once and interned in a dictionary of distinct values (`idOf[p]` → `raw[id]`; NONE for deleted
 * rows and empty values). Lowercase is computed once per distinct value. A search then either
 * tests each distinct value once (few distinct values, e.g. generated question texts) or sweeps a
 * joined string of every row's value with `indexOf` (mostly distinct values). Rows written since
 * the build are `dirty` and checked individually; past 2 % dirty rows the index is rebuilt.
 */
interface SearchIndex {
  idOf: Uint32Array
  raw: string[]
  lower: string[] | null
  /** Joined per-row text per case mode, built on first use in joined mode. */
  joined: { ci?: JoinedText; cs?: JoinedText }
  dictMode: boolean
  dirty: Set<number>
}

interface JoinedText {
  text: string
  starts: Int32Array
}

const NONE = 0xffffffff

interface NormSortKey {
  field: string
  dir: 'asc' | 'desc'
}

interface RefSet<Row> {
  refs: number[]
  ins: InsertedEntry<Row>[]
}

function identityCodec<Id extends StoreId>(): IdCodec<Id> {
  return {
    encode: (key) => key as Id,
    decode: (id) =>
      typeof id === 'number' && Number.isSafeInteger(id) && id >= 0 && id <= 0xffffffff
        ? id
        : undefined,
  }
}

function stableStringify(value: unknown): string {
  if (value === undefined) return 'u'
  if (value instanceof Date) return `D${String(value.getTime())}`
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (typeof value === 'object' && value !== null) {
    const keys = Object.keys(value).sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'u'
}

function normSort(sort: SortSpec<unknown> | undefined): NormSortKey[] {
  if (sort === undefined) return []
  const list = (Array.isArray(sort) ? sort : [sort]) as readonly (
    string | { field: string; dir?: 'asc' | 'desc' }
  )[]
  return list.map((k) =>
    typeof k === 'string' ? { field: k, dir: 'asc' } : { field: k.field, dir: k.dir ?? 'asc' },
  )
}

const FNV_OFFSET_32 = 0x811c9dc5
const FNV_PRIME_32 = 0x01000193

/** FNV-1a continuation (same byte feed as `fnv1a32`), without the final `>>> 0`. */
function fnvFeed(hash: number, input: string): number {
  let h = hash
  for (let i = 0; i < input.length; i++) {
    const unit = input.charCodeAt(i)
    h = Math.imul(h ^ (unit & 0xff), FNV_PRIME_32)
    if (unit > 0xff) h = Math.imul(h ^ (unit >>> 8), FNV_PRIME_32)
  }
  return h
}

/**
 * Seed of the row stream `dataset:<dataset>:row:<key>` under `seedBase`: identical to
 * `createPrngRegistry({ seedBase }).seedFor(...)`, without building the string per row.
 */
export function rowStreamSeed(seedBase: number, dataset: string, key: number): number {
  const prefix = fnvFeed(FNV_OFFSET_32, `${String(seedBase)}:dataset:${dataset}:row:`)
  return fnvFeed(prefix, String(key)) >>> 0
}

/**
 * A fast, stable 32-bit hash of a row key and a salt (murmur3 finaliser). Use it inside cheap
 * fields (`fields`) for per-row variation, e.g. `score: (key) => hashKey(key, 1) % 101`.
 */
export function hashKey(key: number, salt = 0): number {
  let h = Math.imul(key ^ Math.imul(salt + 0x9e3779b9, 0x85ebca6b), 0xcc9e2d51)
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

/** The row bitmap is built when a plan's candidates exceed 1/BITMAP_MIN_SHARE of the rows (F09-7). */
const BITMAP_MIN_SHARE = 32

/**
 * Test-only work counters (deterministic, load-independent): a silent regression of a narrow plan
 * to the O(N) bitmap path shows up here, not only in the perf gates.
 */
export const planStats = { bitmapBuilds: 0, narrowGathers: 0, csrBuilds: 0 }

/**
 * Evaluates one condition over a whole value column into `out` (AND): tight typed loops for the
 * common shapes (numeric range, primitive equality, primitive `in`), `testCondition` otherwise.
 * One monomorphic loop per condition keeps the cost independent of which plans ran before.
 */
function andConditionBitmap(
  col: readonly unknown[],
  cond: ParsedCondition,
  out: Uint8Array,
  start = 0,
  end = out.length,
): void {
  const n = end
  if (cond.kind === 'range') {
    const { gte, lte } = cond
    if (
      (gte === undefined || typeof gte === 'number') &&
      (lte === undefined || typeof lte === 'number')
    ) {
      const lo = gte ?? Number.NEGATIVE_INFINITY
      const hi = lte ?? Number.POSITIVE_INFINITY
      for (let p = start; p < n; p++) {
        if (out[p] === 0) continue
        const v = col[p]
        if (typeof v === 'number') {
          if (!(v >= lo && v <= hi)) out[p] = 0
        } else if (!testCondition(cond, v)) out[p] = 0
      }
      return
    }
  }
  if (
    cond.kind === 'eq' &&
    cond.value !== null &&
    cond.value !== undefined &&
    typeof cond.value !== 'object'
  ) {
    const value = cond.value
    for (let p = start; p < n; p++) if (out[p] === 1 && col[p] !== value) out[p] = 0
    return
  }
  const test = fastTest(cond)
  for (let p = start; p < n; p++) if (out[p] === 1 && !test(col[p])) out[p] = 0
}

/**
 * A specialised test for one parsed condition (same semantics as `testCondition`): primitive
 * equality by `===`, `in` through a `Set`, numeric ranges by comparison; anything else falls back.
 */
function fastTest(cond: ParsedCondition): (v: unknown) => boolean {
  const nullish = (x: unknown) => x === null || x === undefined
  const primitive = (x: unknown) => typeof x !== 'object' || x === null
  switch (cond.kind) {
    case 'eq': {
      const value = cond.value
      if (nullish(value)) return nullish
      if (!primitive(value)) return (x) => testCondition(cond, x)
      return (x) => x === value
    }
    case 'in': {
      if (!cond.values.every(primitive)) return (x) => testCondition(cond, x)
      const hasNull = cond.values.some(nullish)
      const set = new Set(cond.values.filter((x) => !nullish(x)))
      return (x) => (nullish(x) ? hasNull : set.has(x))
    }
    case 'range': {
      const { gte, lte } = cond
      if (
        (gte === undefined || typeof gte === 'number') &&
        (lte === undefined || typeof lte === 'number')
      ) {
        const lo = gte ?? Number.NEGATIVE_INFINITY
        const hi = lte ?? Number.POSITIVE_INFINITY
        return (x) => (typeof x === 'number' ? x >= lo && x <= hi : testCondition(cond, x))
      }
      return (x) => testCondition(cond, x)
    }
    default:
      return (x) => testCondition(cond, x)
  }
}

/**
 * Dev/Vitest (`import.meta.env.DEV`) reject a full-row `match` without `cacheKey` (see
 * `makePlan`). Off in production builds, including the e2e build.
 */
const STRICT_QUERIES = import.meta.env.DEV

let fnSeq = 0
const fnIds = new WeakMap<object, number>()
function fnId(fn: object): number {
  let id = fnIds.get(fn)
  if (id === undefined) fnIds.set(fn, (id = ++fnSeq))
  return id
}

export function defineVirtualDataset<
  Row extends { id: StoreId },
  K extends keyof Row & string,
  C extends Exclude<keyof Row & string, 'id' | K> = never,
>(def: VirtualDatasetDef<Row, K, C>): VirtualDataset<Row, K> {
  type Id = Row['id']
  type F = Pick<Row, K>
  const { name } = def
  if (!name) throw new MockDbError('INVALID', 'defineVirtualDataset: name is required')
  const facetNames = [...def.facets] as string[]
  const facetSet = new Set(facetNames)
  const codec: IdCodec<Id> = def.idCodec ?? identityCodec<Id>()
  const seedBase = def.seedBase ?? DATASET_SEED_BASE
  const prng: PrngRegistry = createPrngRegistry({ seedBase })
  const rowSeedPrefix = fnvFeed(FNV_OFFSET_32, `${String(seedBase)}:dataset:${name}:row:`)
  type CheapFn = (key: number, facets: Readonly<F>) => unknown
  const cheapFns = (def.fields ?? {}) as Record<string, CheapFn>
  const cheapNames = Object.keys(cheapFns)
  const cheapSet = new Set(cheapNames)
  let specHashCache: string | null = null
  const searchFieldSet = new Set<string>(def.searchFields ?? [])
  const warnedMatch = new Set<string>()
  const reserved = def.reservedAnchorRanges ?? []
  const blocks = (def.layout?.blocks ?? []) as readonly LayoutBlock<Record<string, unknown>>[]

  let host: TxHost | null = null
  let ownIdPrng: PrngRegistry | null = null
  const allocator: IdAllocator<Id> = def.runtimeIds.create()

  // Seed-phase inputs.
  let contributed: AnchorInput<Row>[] = []
  let transforms: ((cells: CellSpec<F>[]) => CellSpec<F>[])[] = []

  // Compiled state.
  let compiled: Compiled<Row> | null = null
  let cells: DatasetCell<F>[] = []
  let cellIndex = new Map<string, number>()
  /** Live rows: Σ current cell counts, kept in step by `addCount` (O(1) totals for unfiltered plans). */
  let liveTotal = 0

  // Overlay (positions refer to the compiled arrays).
  const overrides = new Map<number, Partial<Row>>()
  const deleted = new Set<number>()
  const baseCell = new Map<number, number>()
  const inserted = new Map<Id, InsertedEntry<Row>>()
  let insOrder: { list: InsertedEntry<Row>[]; nKeyed: number } | null = null

  let tx: {
    undo: Map<Id, EntryState<Row>>
    idState: ReturnType<IdAllocator<Id>['getState']>
  } | null = null
  let baselineIdState: string | null = null
  let version = 0

  const rowCache = new Lru<number, Row>(def.rowCacheSize ?? 4096)
  const queryCache = new Lru<string, RefSet<Row>>(def.queryCacheSize ?? 16)

  // --- compilation ---------------------------------------------------------------------------

  function allAnchors(): AnchorInput<Row>[] {
    const own = (def.anchors ?? []).map((row) => ({ row, contributor: def.owner ?? name }))
    return [...own, ...contributed]
  }

  function resolveCells(): CellSpec<F>[] {
    const base = typeof def.distribution === 'function' ? def.distribution() : def.distribution
    let cellsSpec = base.map((c) => ({ facets: { ...c.facets }, count: c.count }))
    for (const t of transforms) cellsSpec = t(cellsSpec)
    return cellsSpec
  }

  function build(): {
    issues: DatasetIssue[]
    spec?: PreparedSpec<Row>
    slots?: ReturnType<typeof claimAnchors>['slots']
  } {
    let cellsSpec: CellSpec<F>[]
    try {
      cellsSpec = resolveCells()
    } catch (err) {
      if (err instanceof DatasetSpecError) return { issues: [...err.issues] }
      throw err
    }
    const { spec, issues } = prepareSpec<Row>({
      name,
      facetNames,
      cells: cellsSpec,
      total: def.total,
      idRange: def.idRange,
      reservedAnchorRanges: reserved,
      runtimeIds: def.runtimeIds,
      codec,
      anchors: allAnchors(),
      absentIds: def.absentIds,
    })
    if (issues.length > 0) return { issues, spec }
    const geometry: SlotGeometry = {
      min: def.idRange.min,
      span: def.idRange.max - def.idRange.min + 1,
      n: spec.total,
    }
    const layout = layoutSlots(name, spec, geometry, blocks, prng)
    if (layout.issues.length > 0) return { issues: layout.issues, spec }
    const claim = claimAnchors(name, spec, geometry, layout.cellOf, layout.placement)
    if (claim.issues.length > 0) return { issues: claim.issues, spec }
    return { issues: [], spec, slots: claim.slots }
  }

  function compile() {
    if (compiled) return
    const { issues, spec, slots } = build()
    if (issues.length > 0 || !spec || !slots) {
      throw new DatasetSpecError(`virtual dataset '${name}'`, issues)
    }
    const anchorRows = new Map<number, Row>()
    for (const a of spec.anchors) anchorRows.set(a.key, Object.freeze({ ...a.row }))
    liveTotal = spec.total
    cells = spec.cells.map((c, index) => ({
      index,
      facets: c.facets as unknown as Readonly<F>,
      specCount: c.count,
      count: c.count,
      runtime: false,
    }))
    cellIndex = new Map(spec.cellIndex)
    const fpParts = [
      name,
      `${String(def.idRange.min)}-${String(def.idRange.max)}`,
      stableStringify(reserved),
      `absent:${spec.absent.join(',')}`,
      facetNames.join(','),
      ...spec.cells.slice(1).map((c) => `${c.key}=${String(c.count)}`),
      ...spec.anchors.map((a) => `${String(a.key)}@${String(a.cell)}:${stableStringify(a.row)}`),
    ]
    const anchorPos: number[] = []
    for (let p = 0; p < slots.anchorFlag.length; p++) if (slots.anchorFlag[p]) anchorPos.push(p)
    compiled = {
      n: spec.total,
      keys: slots.keys,
      cellOf: slots.cellOf,
      anchorFlag: slots.anchorFlag,
      anchorPos,
      anchorRows,
      fingerprint: fnv1a32(fpParts.join('\n')).toString(16).padStart(8, '0'),
    }
    rowCache.clear()
    queryCache.clear()
    columns.clear()
    valueColumns.clear()
    csr = null
    version++
  }

  function ensure(): Compiled<Row> {
    if (!compiled) compile()
    return compiled as Compiled<Row>
  }

  // --- rows ----------------------------------------------------------------------------------

  function posOfKey(key: number): number {
    const c = ensure()
    let lo = 0
    let hi = c.n - 1
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1
      const k = c.keys[mid] as number
      if (k < key) lo = mid + 1
      else if (k > key) hi = mid - 1
      else return mid
    }
    return -1
  }

  function posOfId(id: Id): number {
    const key = codec.decode(id)
    return key === undefined ? -1 : posOfKey(key)
  }

  function baseCellAt(pos: number): number {
    return baseCell.get(pos) ?? ((compiled as Compiled<Row>).cellOf[pos] as number)
  }

  /** A generated row: derived fields, then cheap fields, then facets, then the id. */
  function generate(key: number, cell: number): Record<string, unknown> {
    const facets = (cells[cell] as DatasetCell<F>).facets
    const id = codec.encode(key)
    const rng = mulberry32(fnvFeed(rowSeedPrefix, String(key)) >>> 0)
    const row = { ...def.derive(id, facets, rng, { key, dataset: name }) } as Record<
      string,
      unknown
    >
    for (const f of cheapNames) row[f] = (cheapFns[f] as CheapFn)(key, facets)
    Object.assign(row, facets)
    row.id = id
    return row
  }

  function baseRow(pos: number): Row {
    const cached = rowCache.get(pos)
    if (cached) return cached
    const c = compiled as Compiled<Row>
    const key = c.keys[pos] as number
    const row =
      c.anchorRows.get(key) ?? (Object.freeze(generate(key, baseCellAt(pos))) as unknown as Row)
    rowCache.set(pos, row)
    return row
  }

  /** A full row for a predicate during a scan: no row-cache churn, no freezing. */
  function scanRow(pos: number): Row {
    const c = compiled as Compiled<Row>
    if (c.anchorFlag[pos] || rowCache.get(pos)) return rowAt(pos)
    const row = generate(c.keys[pos] as number, baseCellAt(pos))
    const patch = overrides.size > 0 ? overrides.get(pos) : undefined
    if (patch) Object.assign(row, patch, { id: row.id })
    return row as unknown as Row
  }

  function baseFacetsAt(pos: number): Readonly<F> {
    const c = compiled as Compiled<Row>
    const cell = baseCell.size > 0 ? baseCellAt(pos) : (c.cellOf[pos] as number)
    return (cells[cell] as DatasetCell<F>).facets
  }

  /** Value of a cheap field at position `pos` (override > anchor > field function). */
  function cheapValue(pos: number, field: string): unknown {
    const c = compiled as Compiled<Row>
    if (overrides.size > 0) {
      const patch = overrides.get(pos) as Record<string, unknown> | undefined
      if (patch && field in patch) return patch[field]
    }
    const key = c.keys[pos] as number
    if (c.anchorFlag[pos]) return (c.anchorRows.get(key) as Record<string, unknown>)[field]
    return (cheapFns[field] as CheapFn)(key, baseFacetsAt(pos))
  }

  /** A partial row (id, facets, the given cheap fields, overrides) without derivation. */
  function partialRow(pos: number, fields: readonly string[]): Row {
    const c = compiled as Compiled<Row>
    if (c.anchorFlag[pos]) return rowAt(pos)
    const key = c.keys[pos] as number
    const facets = baseFacetsAt(pos)
    const row: Record<string, unknown> = { ...facets, id: codec.encode(key) }
    for (const f of fields) {
      const fn = cheapFns[f]
      if (fn) row[f] = fn(key, facets)
    }
    const patch = overrides.size > 0 ? overrides.get(pos) : undefined
    if (patch) Object.assign(row, patch, { id: row.id })
    return row as unknown as Row
  }

  function rowAt(pos: number): Row {
    const base = baseRow(pos)
    const patch = overrides.get(pos)
    return patch ? Object.freeze({ ...base, ...patch, id: base.id }) : base
  }

  // --- cells ---------------------------------------------------------------------------------

  function cellFor(values: Record<string, unknown>): number {
    const facets: FacetRecord = {}
    for (const f of facetNames) {
      const v = values[f] === undefined ? null : values[f]
      if (!isFacetValue(v)) {
        throw new MockDbError(
          'INVALID',
          `${name}: facet '${f}' must be a primitive, got ${typeof v}`,
        )
      }
      facets[f] = v
    }
    const key = cellKey(facets, facetNames)
    let idx = cellIndex.get(key)
    if (idx === undefined) {
      idx = cells.length
      cellIndex.set(key, idx)
      cells.push({
        index: idx,
        facets: Object.freeze(facets) as unknown as Readonly<F>,
        specCount: 0,
        count: 0,
        runtime: true,
      })
    }
    return idx
  }

  function touchesFacets(patch: Partial<Row>): boolean {
    for (const f of facetNames) if (f in patch) return true
    return false
  }

  function addCount(cell: number, d: number) {
    if (cell === 0) return
    const c = cells[cell] as DatasetCell<F>
    c.count += d
    liveTotal += d
  }

  // --- overlay state machine -----------------------------------------------------------------

  function stateOf(id: Id): EntryState<Row> {
    const pos = posOfId(id)
    if (pos >= 0) {
      if (deleted.has(pos)) return { k: 'deleted' }
      const patch = overrides.get(pos)
      return patch ? { k: 'override', patch } : { k: 'base' }
    }
    const e = inserted.get(id)
    return e ? { k: 'inserted', row: e.row } : { k: 'absent' }
  }

  function setState(id: Id, st: EntryState<Row>) {
    const c = ensure()
    const pos = posOfId(id)
    if (pos >= 0) {
      if (st.k === 'absent' || st.k === 'inserted') {
        throw new MockDbError('INVALID', `${name}: id ${String(id)} belongs to a spec row`)
      }
      const base = baseCellAt(pos)
      let target = base
      if (st.k === 'deleted') {
        overrides.delete(pos)
        deleted.add(pos)
        target = 0
      } else if (st.k === 'override' && Object.keys(st.patch).length > 0) {
        overrides.set(pos, st.patch)
        deleted.delete(pos)
        if (touchesFacets(st.patch)) {
          target = cellFor({ ...(cells[base] as DatasetCell<F>).facets, ...st.patch })
        }
      } else {
        overrides.delete(pos)
        deleted.delete(pos)
      }
      const cur = c.cellOf[pos] as number
      if (cur !== target) {
        if (!baseCell.has(pos)) baseCell.set(pos, base)
        addCount(cur, -1)
        addCount(target, 1)
        c.cellOf[pos] = target
      }
      if (columns.size > 0 || valueColumns.size > 0) refreshColumns(pos)
    } else {
      if (st.k === 'base' || st.k === 'override' || st.k === 'deleted') {
        throw new MockDbError('INVALID', `${name}: id ${String(id)} is not a spec row`)
      }
      const prev = inserted.get(id)
      if (prev) {
        addCount(prev.cell, -1)
        inserted.delete(id)
      }
      if (st.k === 'inserted') {
        const cell = cellFor(st.row)
        addCount(cell, 1)
        inserted.set(id, { row: st.row, cell, key: codec.decode(id) })
      }
      insOrder = null
    }
    version++
  }

  function insList(): { list: InsertedEntry<Row>[]; nKeyed: number } {
    if (!insOrder) {
      const keyed: InsertedEntry<Row>[] = []
      const unkeyed: InsertedEntry<Row>[] = []
      for (const e of inserted.values()) (e.key === undefined ? unkeyed : keyed).push(e)
      keyed.sort((a, b) => (a.key as number) - (b.key as number))
      unkeyed.sort((a, b) => compareValues(a.row.id, b.row.id))
      insOrder = { list: [...keyed, ...unkeyed], nKeyed: keyed.length }
    }
    return insOrder
  }

  function touch(id: Id) {
    if (tx && !tx.undo.has(id)) tx.undo.set(id, stateOf(id))
  }

  function requireWritable(action: string) {
    if (host && host.phase === 'seed') {
      throw new MockDbError(
        'PHASE',
        `${name}.${action}: a virtual dataset is seeded by its spec and anchors; write after baseline()`,
      )
    }
    ensure()
  }

  function run<T>(write: () => T): T {
    return host ? host.write(dataset, write) : write()
  }

  function inReserved(id: Id): boolean {
    const key = codec.decode(id)
    return key !== undefined && reserved.some(([lo, hi]) => key >= lo && key <= hi)
  }

  function idPrng(): PrngRegistry {
    if (host) return host.prng
    return (ownIdPrng ??= createPrngRegistry())
  }

  function resetOverlay() {
    const c = compiled
    // Positions whose values change back to the spec: their column entries are refreshed below
    // (the indexes, e.g. prebuilt `searchFields`, survive a reload).
    const touched = c
      ? new Set<number>([...overrides.keys(), ...deleted, ...baseCell.keys()])
      : null
    if (c) {
      for (const [pos, cell] of baseCell) c.cellOf[pos] = cell
      // Runtime cells were appended after the spec cells; drop them with the overlay.
      const firstRuntime = cells.findIndex((cell) => cell.runtime)
      if (firstRuntime >= 0) {
        for (const cell of cells.slice(firstRuntime)) {
          cellIndex.delete(cellKey(cell.facets, facetNames))
        }
        cells.length = firstRuntime
      }
      for (const cell of cells) cell.count = cell.specCount
      liveTotal = c.n
    }
    overrides.clear()
    deleted.clear()
    baseCell.clear()
    inserted.clear()
    insOrder = null
    if (!c) {
      columns.clear()
      valueColumns.clear()
    } else if (touched && (columns.size > 0 || valueColumns.size > 0)) {
      for (const pos of touched) refreshColumns(pos)
    }
  }

  function applyOverlay(ov: DatasetOverlay<Row>, action: string) {
    ensure()
    if (tx) throw new MockDbError('PHASE', `${name}.${action}: not allowed inside a transaction`)
    for (const id of ov.deletes) {
      setState(id, posOfId(id) >= 0 ? { k: 'deleted' } : { k: 'absent' })
    }
    for (const { id, patch } of ov.overrides) {
      if (posOfId(id) < 0) {
        throw new MockDbError('INVALID', `${name}.${action}: override of unknown id ${String(id)}`)
      }
      const clean = { ...patch }
      delete (clean as { id?: unknown }).id
      setState(id, Object.keys(clean).length > 0 ? { k: 'override', patch: clean } : { k: 'base' })
    }
    for (const row of ov.inserts) {
      const frozen = Object.freeze({ ...row })
      setState(row.id, { k: 'inserted', row: frozen })
      allocator.observe(row.id)
    }
    if (ov.ids) allocator.setState(ov.ids)
    queryCache.clear()
  }

  // --- query planning ------------------------------------------------------------------------

  function makePlan(
    where: Where<Row> | undefined,
    match: ((row: Row) => boolean) | undefined,
    matchFields?: readonly string[],
    search?: DatasetSearch<Row>,
    cacheKey?: string,
  ): Plan<Row> {
    const compiledWhere = compileWhere(where)
    const facetConds: [string, ParsedCondition][] = []
    const idConds: ParsedCondition[] = []
    const cheap: CompiledWhere = []
    const full: CompiledWhere = []
    for (const entry of compiledWhere) {
      if (entry[0] === 'id') idConds.push(entry[1])
      else if (facetSet.has(entry[0])) facetConds.push(entry)
      else if (cheapSet.has(entry[0])) cheap.push(entry)
      else full.push(entry)
    }
    const partial: PartialPlan | null =
      match &&
      matchFields &&
      matchFields.every((f) => f === 'id' || facetSet.has(f) || cheapSet.has(f))
        ? {
            fly: {},
            cheapCols: matchFields
              .filter((f) => cheapSet.has(f))
              .map((f) => [f, valueColumn(f)] as [string, unknown[]]),
            facetFields: matchFields.filter((f) => facetSet.has(f)),
            withId: matchFields.includes('id'),
          }
        : null
    // A `match` over a field that has a search index is almost always a substring test: `search`
    // does it with one native sweep (declared budget 50 ms) instead of a JS call per row (budget
    // exception, 100 ms). Warn once per field in dev/Vitest; never throw.
    if (match && matchFields && STRICT_QUERIES && searchFieldSet.size > 0) {
      for (const f of matchFields) {
        if (searchFieldSet.has(f) && !warnedMatch.has(f)) {
          warnedMatch.add(f)
          console.warn(
            `[${name}] \`match\` reads '${f}', which is a search field: use \`search: { term, fields: ['${f}'], caseSensitive? }\` instead of a substring predicate`,
          )
        }
      }
    }
    // A `match` that needs full rows is keyed by closure identity unless the caller names it, so
    // it would never hit the result cache across requests: require `cacheKey` (dev/Vitest).
    if (match && !partial && cacheKey === undefined && STRICT_QUERIES) {
      throw new MockDbError(
        'INVALID',
        `${name}: a \`match\` without \`matchFields\` derives every row; pass \`cacheKey\` (a stable name for the predicate, e.g. 'search:' + term) so repeated requests hit the cache, or declare the fields it reads as cheap fields and pass \`matchFields\``,
      )
    }
    const mask = new Uint8Array(cells.length)
    const facetTests = facetConds.map(([field, cond]) => [field, fastTest(cond)] as const)
    let candidatesAll = 0
    if (facetTests.length === 0) {
      mask.fill(1, 1)
      candidatesAll = liveTotal
    } else {
      for (let i = 1; i < cells.length; i++) {
        const cell = cells[i] as DatasetCell<F>
        const facets = cell.facets as unknown as Record<string, unknown>
        let ok = true
        for (const [field, test] of facetTests) {
          if (!test(facets[field])) {
            ok = false
            break
          }
        }
        if (ok) {
          mask[i] = 1
          candidatesAll += cell.count
        }
      }
    }
    const cs = search?.caseSensitive === true
    const term = search ? (cs ? search.term : search.term.toLowerCase()) : ''
    const searchFields = term !== '' && search ? ([...search.fields] as string[]) : null
    const searchNeedsFull =
      searchFields !== null &&
      !searchFields.every((f) => f === 'id' || facetSet.has(f) || cheapSet.has(f))
    const found =
      searchFields && !searchNeedsFull
        ? searchHits(
            searchFields.filter((f) => cheapSet.has(f)),
            term,
            cs,
          )
        : null
    const searchPlan: SearchPlan | null = searchFields
      ? {
          term,
          cs,
          fields: searchFields,
          hits: found?.hits ?? null,
          cellHits: found?.cellHits ?? null,
          direct: searchFields.filter((f) => !cheapSet.has(f)),
        }
      : null
    const cheapEvals = cheap.map(([field, cond]) => ({
      col: valueColumn(field),
      test: fastTest(cond),
    }))
    const searchInBitmap =
      searchPlan !== null && searchPlan.hits !== null && searchPlan.direct.length === 0
    const slow = cheap.length > 0 || full.length > 0 || match !== undefined || searchPlan !== null
    const needFull = full.length > 0 || (match !== undefined && partial === null) || searchNeedsFull
    // Integer ids (identity codec): numeric eq / range conditions on `id` become key bounds, so the
    // scan only visits the positions inside them (binary search on `keys`).
    let idLo = 0
    let idHi = Number.POSITIVE_INFINITY
    let idBounded = idConds.length > 0 && def.idCodec === undefined
    if (idConds.length > 0 && def.idCodec === undefined) {
      for (const cond of idConds) {
        if (cond.kind === 'eq' && typeof cond.value === 'number') {
          idLo = Math.max(idLo, Math.ceil(cond.value))
          idHi = Math.min(idHi, Math.floor(cond.value))
        } else if (
          cond.kind === 'range' &&
          (cond.gte === undefined || typeof cond.gte === 'number') &&
          (cond.lte === undefined || typeof cond.lte === 'number')
        ) {
          if (typeof cond.gte === 'number') idLo = Math.max(idLo, Math.ceil(cond.gte))
          if (typeof cond.lte === 'number') idHi = Math.min(idHi, Math.floor(cond.lte))
        } else {
          idBounded = false
        }
      }
    }
    // Row bitmap (F09-7): worth building only when the plan's candidate rows are a sizeable share
    // of the dataset (> N/32), or when a search already swept every row. Narrow plans (one user's
    // cells, a small id window) keep the per-row path: their cost stays proportional to their
    // candidates. When built, the bitmap only covers the id window.
    let rowHits: Uint8Array | null = null
    let rowCellHits: Uint32Array | null = null
    if (cheap.length > 0 && full.length === 0) {
      const c = compiled as Compiled<Row>
      const wStart = idLo > 0 ? lowerBound(idLo) : 0
      const wEnd = idHi === Number.POSITIVE_INFINITY ? c.n : lowerBound(idHi + 1)
      const candidates = Math.min(candidatesAll, Math.max(0, wEnd - wStart))
      if (searchInBitmap || candidates * BITMAP_MIN_SHARE > c.n) {
        planStats.bitmapBuilds++
        rowHits = new Uint8Array(c.n)
        if (searchInBitmap)
          rowHits.set((searchPlan.hits as Uint8Array).subarray(wStart, wEnd), wStart)
        else rowHits.fill(1, wStart, wEnd)
        for (const [field, cond] of cheap) {
          andConditionBitmap(valueColumn(field), cond, rowHits, wStart, wEnd)
        }
        rowCellHits = new Uint32Array(cells.length)
        const { cellOf } = c
        for (let p = wStart; p < wEnd; p++) {
          if (rowHits[p] === 1) {
            const cell = cellOf[p] as number
            rowCellHits[cell] = (rowCellHits[cell] as number) + 1
          }
        }
      }
    } else if (searchInBitmap) {
      rowHits = searchPlan.hits
      rowCellHits = searchPlan.cellHits
    }
    const plan: Plan<Row> = {
      test: () => true,
      candidates: candidatesAll,
      mask,
      idConds,
      cheap,
      full,
      match,
      partial,
      slow,
      needFull,
      cheapEvals,
      rowHits,
      rowCellHits,
      search: searchPlan,
      countable: !slow && idConds.length === 0,
      idLo,
      idHi,
      idBounded,
    }
    plan.test = compileTest(plan)
    return plan
  }

  /** First position whose key is ≥ `key`. */
  function lowerBound(key: number): number {
    const c = compiled as Compiled<Row>
    let lo = 0
    let hi = c.n
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if ((c.keys[mid] as number) < key) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  function maskSum(plan: Plan<Row>): number {
    let n = 0
    for (let i = 1; i < cells.length; i++) if (plan.mask[i]) n += (cells[i] as DatasetCell<F>).count
    return n
  }

  function idPasses(plan: Plan<Row>, id: unknown): boolean {
    for (const cond of plan.idConds) if (!testCondition(cond, id)) return false
    return true
  }

  /** Per-row test on a materialised row (anchors, runtime rows, overridden rows). */
  function rowPasses(plan: Plan<Row>, row: Row): boolean {
    return (
      rowMatches(row, plan.cheap) &&
      rowMatches(row, plan.full) &&
      (!plan.search || rowSearch(plan.search, row)) &&
      (!plan.match || plan.match(row))
    )
  }

  /** Text of a searchable value (strings, numbers, booleans; '' for anything else). */
  function text(v: unknown): string {
    if (typeof v === 'string') return v
    if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v)
    return ''
  }

  /** Lowercase text of a searchable value. */
  function lower(v: unknown): string {
    return text(v).toLowerCase()
  }

  /** The searchable form of a value: as-is (case-sensitive search) or lowercase. */
  function norm(v: unknown, cs: boolean): string {
    return cs ? text(v) : lower(v)
  }

  function rowSearch(search: SearchPlan, row: Row): boolean {
    const r = row as Record<string, unknown>
    return search.fields.some((f) => norm(r[f], search.cs).includes(search.term))
  }

  // Column indexes per cheap field, built on first use and kept in step with writes
  // (`setState`): value columns for conditions and `matchFields`, joined text indexes for
  // `search` (one per field and case mode). Deleted positions hold '' / undefined (masked out).
  const columns = new Map<string, SearchIndex>()
  const valueColumns = new Map<string, unknown[]>()

  function valueColumn(field: string): unknown[] {
    let col = valueColumns.get(field)
    if (!col) {
      const c = compiled as Compiled<Row>
      // Built with push so V8 keeps a packed array (faster element reads than a holey one).
      col = []
      for (let p = 0; p < c.n; p++) col.push(c.cellOf[p] === 0 ? undefined : cheapValue(p, field))
      valueColumns.set(field, col)
    }
    return col
  }

  /** The search index of a cheap field (see `SearchIndex`), built on first use. */
  function searchIndex(field: string): SearchIndex {
    let idx = columns.get(field)
    if (idx && idx.dirty.size <= (compiled as Compiled<Row>).n / 50) return idx
    const c = compiled as Compiled<Row>
    const n = c.n
    const idOf = new Uint32Array(n)
    const raw: string[] = []
    // Dictionary of distinct values. If it outgrows a quarter of the rows (mostly distinct
    // values), switch to one entry per row and stop hashing (joined mode).
    const limit = Math.max(1, Math.floor(n / 4))
    let ids: Map<string, number> | null = new Map<string, number>()
    for (let p = 0; p < n; p++) {
      if (c.cellOf[p] === 0) {
        idOf[p] = NONE
        continue
      }
      const v = text(cheapValue(p, field))
      if (v === '') {
        idOf[p] = NONE
        continue
      }
      if (ids === null) {
        idOf[p] = raw.length
        raw.push(v)
        continue
      }
      let id = ids.get(v)
      if (id === undefined) {
        id = raw.length
        raw.push(v)
        ids.set(v, id)
        if (raw.length > limit) {
          // Re-express the rows so far as one entry each, then continue without the Map.
          const perRow: string[] = []
          for (let q = 0; q <= p; q++) {
            const old = idOf[q] as number
            if (q === p) {
              idOf[q] = perRow.length
              perRow.push(v)
            } else if (old !== NONE) {
              idOf[q] = perRow.length
              perRow.push(raw[old] as string)
            }
          }
          raw.length = 0
          for (const v2 of perRow) raw.push(v2)
          ids = null
          continue
        }
      }
      idOf[p] = id
    }
    idx = { idOf, raw, lower: null, joined: {}, dictMode: ids !== null, dirty: new Set() }
    columns.set(field, idx)
    return idx
  }

  /** Distinct values of an index in a case mode (lowercase computed once per distinct value). */
  function distinctValues(idx: SearchIndex, cs: boolean): string[] {
    if (cs) return idx.raw
    idx.lower ??= idx.raw.map((v) => v.toLowerCase())
    return idx.lower
  }

  /** Joined per-row text of an index in a case mode (for mostly distinct values). */
  function joinedText(idx: SearchIndex, cs: boolean): JoinedText {
    const mode = cs ? 'cs' : 'ci'
    let jt = idx.joined[mode]
    if (!jt) {
      const values = distinctValues(idx, cs).map((v) => v.replaceAll('\u0000', ''))
      const n = idx.idOf.length
      const parts = new Array<string>(n)
      const starts = new Int32Array(n + 1)
      let at = 0
      for (let p = 0; p < n; p++) {
        const id = idx.idOf[p] as number
        const v = id === NONE ? '' : (values[id] as string)
        parts[p] = v
        starts[p] = at
        at += v.length + 1
      }
      starts[n] = at
      jt = { text: parts.join('\u0000'), starts }
      idx.joined[mode] = jt
    }
    return jt
  }

  /**
   * Marks the positions where any of `fields` (cheap) contains `term` (already normalised), and
   * counts the hits per cell.
   */
  function searchHits(
    fields: readonly string[],
    term: string,
    cs: boolean,
  ): { hits: Uint8Array; cellHits: Uint32Array } {
    const c = compiled as Compiled<Row>
    const { cellOf } = c
    const hits = new Uint8Array(c.n)
    const cellHits = new Uint32Array(cells.length)
    if (term.includes('\u0000')) return { hits, cellHits }
    const mark = (p: number) => {
      if (hits[p] === 1) return
      hits[p] = 1
      const cell = cellOf[p] as number
      cellHits[cell] = (cellHits[cell] as number) + 1
    }
    const dirtyAll = new Set<number>()
    for (const field of fields) {
      const idx = searchIndex(field)
      if (idx.dictMode) {
        // Test each distinct value once, then one typed-array pass.
        const values = distinctValues(idx, cs)
        const hit = new Uint8Array(values.length)
        let any = false
        for (let d = 0; d < values.length; d++) {
          if ((values[d] as string).includes(term)) {
            hit[d] = 1
            any = true
          }
        }
        if (any) {
          const { idOf } = idx
          for (let p = 0; p < idOf.length; p++) {
            const id = idOf[p] as number
            if (id !== NONE && hit[id] === 1) mark(p)
          }
        }
      } else {
        const { text: joined, starts } = joinedText(idx, cs)
        let from = 0
        let p = 0
        for (;;) {
          const o = joined.indexOf(term, from)
          if (o < 0) break
          while ((starts[p + 1] as number) <= o) p++
          mark(p)
          from = starts[p + 1] as number
        }
      }
      for (const d of idx.dirty) dirtyAll.add(d)
    }
    // Rows written since an index was built: recompute from the current values of every field.
    for (const d of dirtyAll) {
      const now = cellOf[d] !== 0 && fields.some((f) => norm(cheapValue(d, f), cs).includes(term))
      if (now) mark(d)
      else if (hits[d] === 1) {
        hits[d] = 0
        const cell = cellOf[d] as number
        cellHits[cell] = (cellHits[cell] as number) - 1
      }
    }
    return { hits, cellHits }
  }

  /** Builds (or refreshes, if too dirty) the `searchFields` indexes in every `searchModes` mode. */
  function prebuildSearchIndexes() {
    const modes = def.searchModes ?? ['insensitive', 'sensitive']
    for (const field of def.searchFields ?? []) {
      const idx = searchIndex(field)
      for (const mode of modes) {
        const cs = mode === 'sensitive'
        if (idx.dictMode) distinctValues(idx, cs)
        else joinedText(idx, cs)
      }
    }
  }

  function refreshColumns(pos: number) {
    const c = compiled as Compiled<Row>
    for (const idx of columns.values()) idx.dirty.add(pos)
    for (const [field, col] of valueColumns) {
      col[pos] = c.cellOf[pos] === 0 ? undefined : cheapValue(pos, field)
    }
  }

  function searchPos(search: SearchPlan, p: number): boolean {
    const c = compiled as Compiled<Row>
    const { hits, direct, term, cs } = search
    if (hits && hits[p] === 1) return true
    for (const f of direct) {
      let v: string
      if (f === 'id') v = norm(codec.encode(c.keys[p] as number), cs)
      else {
        const facets = (cells[c.cellOf[p] as number] as DatasetCell<F>).facets
        v = norm((facets as unknown as Record<string, unknown>)[f], cs)
      }
      if (v.includes(term)) return true
    }
    return false
  }

  /** Per-row test on a spec position, deriving as little as possible. */
  function posPasses(plan: Plan<Row>, p: number): boolean {
    if (!plan.needFull) return plan.test(p)
    // Value columns already hold anchor values and overrides.
    const evals = plan.cheapEvals
    for (let i = 0; i < evals.length; i++) {
      const e = evals[i] as Plan<Row>['cheapEvals'][number]
      if (!e.test(e.col[p])) return false
    }
    const row = scanRow(p)
    return (
      rowMatches(row, plan.full) &&
      (!plan.search || rowSearch(plan.search, row)) &&
      (!plan.match || plan.match(row))
    )
  }

  /**
   * The per-position test of a plan that needs no full rows, as one closure: cheap-field
   * conditions read the value columns, `search` reads the hit bitmap, and a partial-row `match`
   * gets one reused object filled from the current cell (which reflects edited facets) and the
   * value columns (which hold anchor values and overrides). No row is derived or allocated, so the
   * object handed to `match` must not be retained.
   */
  function compileTest(plan: Plan<Row>): (p: number) => boolean {
    if (plan.needFull) return () => true // unused: posPasses handles full-row plans
    const c = compiled as Compiled<Row>
    const { cellOf, keys } = c
    const evals = plan.cheapEvals
    const ne = evals.length
    const search = plan.search
    const hits = search?.hits ?? null
    const direct = search && search.direct.length > 0 ? search : null
    const match = plan.match
    const pp = plan.partial
    const fly = pp?.fly ?? {}
    const cc = pp?.cheapCols ?? []
    const ff = pp?.facetFields ?? []
    const withId = pp?.withId === true
    // Specialised shapes (the hot ones): a match over one cheap field and nothing else — only the
    // reused object's single slot is written per row.
    if (match && ne === 0 && !search && !withId && ff.length === 0 && cc.length === 1) {
      const [field, col] = cc[0] as [string, unknown[]]
      const one: Record<string, unknown> = { [field]: undefined }
      return (p) => {
        one[field] = col[p]
        return match(one as Row)
      }
    }
    const rowHits = plan.rowHits
    // The bitmap covers the cheap conditions, and the search when it has no facet/id fields.
    const searchCovered = rowHits !== null && search !== null && direct === null
    if (rowHits && !match && (!search || searchCovered)) {
      return (p) => rowHits[p] === 1
    }
    return (p) => {
      if (rowHits) {
        if (rowHits[p] !== 1) return false
      } else {
        for (let i = 0; i < ne; i++) {
          const e = evals[i] as Plan<Row>['cheapEvals'][number]
          if (!e.test(e.col[p])) return false
        }
      }
      if (
        search &&
        !searchCovered &&
        !(hits !== null && hits[p] === 1) &&
        !(direct && searchPos(direct, p))
      ) {
        return false
      }
      if (!match) return true
      if (withId) fly.id = codec.encode(keys[p] as number)
      if (ff.length > 0) {
        const facets = (cells[cellOf[p] as number] as DatasetCell<F>).facets as unknown as Record<
          string,
          unknown
        >
        for (let i = 0; i < ff.length; i++) {
          const f = ff[i] as string
          fly[f] = facets[f]
        }
      }
      for (let i = 0; i < cc.length; i++) {
        const entry = cc[i] as [string, unknown[]]
        fly[entry[0]] = entry[1][p]
      }
      return match(fly as Row)
    }
  }

  // Positions per base cell (CSR over the compiled layout), built on first use. Rows an overlay
  // moved to another cell are found through `baseCell`; the current cell is always re-checked.
  let csr: { start: Uint32Array; pos: Uint32Array } | null = null

  function cellCsr(): { start: Uint32Array; pos: Uint32Array } {
    if (csr) return csr
    planStats.csrBuilds++
    const c = compiled as Compiled<Row>
    const nCells = cells.length
    const start = new Uint32Array(nCells + 1)
    const base = new Uint32Array(c.n)
    for (let p = 0; p < c.n; p++) {
      const b = baseCell.size > 0 ? baseCellAt(p) : (c.cellOf[p] as number)
      base[p] = b
      start[b + 1] = (start[b + 1] as number) + 1
    }
    for (let i = 0; i < nCells; i++) start[i + 1] = (start[i + 1] as number) + (start[i] as number)
    const fill = start.slice(0, nCells)
    const pos = new Uint32Array(c.n)
    for (let p = 0; p < c.n; p++) {
      const b = base[p] as number
      pos[fill[b] as number] = p
      fill[b] = (fill[b] as number) + 1
    }
    csr = { start, pos }
    return csr
  }

  /** The candidate positions of a narrow plan (see `Plan.narrow`), or null when it is wide. */
  function narrowPositions(plan: Plan<Row>): Uint32Array | null {
    if (plan.narrow !== undefined) return plan.narrow
    const c = compiled as Compiled<Row>
    const { mask } = plan
    const wStart = plan.idLo > 0 ? lowerBound(plan.idLo) : 0
    const wEnd = plan.idHi === Number.POSITIVE_INFINITY ? c.n : lowerBound(plan.idHi + 1)
    const candidates = plan.candidates
    if (candidates * BITMAP_MIN_SHARE > c.n || candidates >= wEnd - wStart) {
      plan.narrow = null
      return null
    }
    const { start, pos } = cellCsr()
    const out: number[] = []
    const baseCells = start.length - 1
    for (let i = 1; i < Math.min(cells.length, baseCells); i++) {
      if (mask[i] !== 1) continue
      for (let j = start[i] as number; j < (start[i + 1] as number); j++) {
        const p = pos[j] as number
        if (p >= wStart && p < wEnd) out.push(p)
      }
    }
    // Rows moved into a masked cell by an overlay edit.
    for (const [p, b] of baseCell) {
      const cur = c.cellOf[p] as number
      if (
        cur !== 0 &&
        mask[cur] === 1 &&
        !(b < baseCells && mask[b] === 1) &&
        p >= wStart &&
        p < wEnd
      ) {
        out.push(p)
      }
    }
    // Typed-array sort (numeric, native): much cheaper than an array sort with a comparator.
    const sorted = new Uint32Array(out)
    sorted.sort()
    planStats.narrowGathers++
    plan.narrow = sorted
    return sorted
  }

  interface ScanOptions {
    /** Skip spec positions (order-field exceptions). */
    exclude?: (pos: number) => boolean
    /** Include runtime rows (default true). */
    inserted?: boolean
  }

  /**
   * Visits matching refs in id order (`dir` 1 = asc, -1 = desc). A ref is a position (≥ 0) or
   * `-(i + 1)` for runtime row `i` of `list`. `visit` returns `false` to stop.
   */
  function scan(
    plan: Plan<Row>,
    dir: 1 | -1,
    visit: (ref: number) => boolean,
    opts: ScanOptions = {},
  ): InsertedEntry<Row>[] {
    const c = ensure()
    const { keys, cellOf, n } = c
    const { mask } = plan
    const withIns = opts.inserted !== false
    const { list, nKeyed } = withIns ? insList() : { list: [] as InsertedEntry<Row>[], nKeyed: 0 }
    const exclude = opts.exclude
    const needIdIns = plan.idConds.length > 0
    const needId = needIdIns && !plan.idBounded
    const slow = plan.slow
    const simple = !needId && !slow && !exclude
    // Position window from the id bounds (whole array without id conditions).
    const pStart = plan.idLo > 0 ? lowerBound(plan.idLo) : 0
    const pEnd = plan.idHi === Number.POSITIVE_INFINITY ? n : lowerBound(plan.idHi + 1)

    const passPos = (p: number): boolean => {
      if (exclude && exclude(p)) return false
      if (needId && !idPasses(plan, codec.encode(keys[p] as number))) return false
      if (slow && !posPasses(plan, p)) return false
      return true
    }
    const passIns = (e: InsertedEntry<Row>): boolean =>
      mask[e.cell] === 1 &&
      (!needIdIns || idPasses(plan, e.row.id)) &&
      (!slow || rowPasses(plan, e.row))

    // Only for plans with a per-row test: a facet-only page stops early on its own, cheaper than
    // gathering and sorting every candidate.
    const narrow = plan.slow ? narrowPositions(plan) : null
    if (narrow) {
      // O(candidates): the same merge as below over the narrow plan's sorted positions.
      const step = (p: number): boolean => {
        if (mask[cellOf[p] as number] === 0) return true
        if (!simple && !passPos(p)) return true
        return visit(p)
      }
      if (dir === 1) {
        let i = 0
        for (let j = 0; j < narrow.length; j++) {
          const p = narrow[j] as number
          const k = keys[p] as number
          while (i < nKeyed && ((list[i] as InsertedEntry<Row>).key as number) < k) {
            if (passIns(list[i] as InsertedEntry<Row>) && !visit(-(i + 1))) return list
            i++
          }
          if (!step(p)) return list
        }
        for (; i < list.length; i++) {
          if (passIns(list[i] as InsertedEntry<Row>) && !visit(-(i + 1))) return list
        }
        return list
      }
      let i = list.length - 1
      for (; i >= nKeyed; i--) {
        if (passIns(list[i] as InsertedEntry<Row>) && !visit(-(i + 1))) return list
      }
      for (let j = narrow.length - 1; j >= 0; j--) {
        const p = narrow[j] as number
        const k = keys[p] as number
        while (i >= 0 && ((list[i] as InsertedEntry<Row>).key as number) > k) {
          if (passIns(list[i] as InsertedEntry<Row>) && !visit(-(i + 1))) return list
          i--
        }
        if (!step(p)) return list
      }
      for (; i >= 0; i--) {
        if (passIns(list[i] as InsertedEntry<Row>) && !visit(-(i + 1))) return list
      }
      return list
    }

    if (dir === 1) {
      let i = 0
      for (let p = pStart; p < pEnd; p++) {
        if (i < nKeyed) {
          const k = keys[p] as number
          while (i < nKeyed && ((list[i] as InsertedEntry<Row>).key as number) < k) {
            if (passIns(list[i] as InsertedEntry<Row>) && !visit(-(i + 1))) return list
            i++
          }
        }
        if (mask[cellOf[p] as number] === 0) continue
        if (!simple && !passPos(p)) continue
        if (!visit(p)) return list
      }
      for (; i < list.length; i++) {
        if (passIns(list[i] as InsertedEntry<Row>) && !visit(-(i + 1))) return list
      }
      return list
    }

    let i = list.length - 1
    for (; i >= nKeyed; i--) {
      if (passIns(list[i] as InsertedEntry<Row>) && !visit(-(i + 1))) return list
    }
    for (let p = pEnd - 1; p >= pStart; p--) {
      if (i >= 0) {
        const k = keys[p] as number
        while (i >= 0 && ((list[i] as InsertedEntry<Row>).key as number) > k) {
          if (passIns(list[i] as InsertedEntry<Row>) && !visit(-(i + 1))) return list
          i--
        }
      }
      if (mask[cellOf[p] as number] === 0) continue
      if (!simple && !passPos(p)) continue
      if (!visit(p)) return list
    }
    for (; i >= 0; i--) {
      if (passIns(list[i] as InsertedEntry<Row>) && !visit(-(i + 1))) return list
    }
    return list
  }

  function refRow(ref: number, ins: readonly InsertedEntry<Row>[]): Row {
    return ref >= 0 ? rowAt(ref) : (ins[-ref - 1] as InsertedEntry<Row>).row
  }

  function refCell(ref: number, ins: readonly InsertedEntry<Row>[]): number {
    return ref >= 0
      ? ((compiled as Compiled<Row>).cellOf[ref] as number)
      : (ins[-ref - 1] as InsertedEntry<Row>).cell
  }

  function planKey(
    where: Where<Row> | undefined,
    match: unknown,
    cacheKey: string | undefined,
    search?: DatasetSearch<Row>,
  ): string {
    const m =
      match === undefined
        ? '-'
        : cacheKey !== undefined
          ? `k:${cacheKey}`
          : `f:${String(fnId(match as object))}`
    const q = search && search.term !== '' ? stableStringify(search) : '-'
    return `${stableStringify(where)}|${m}|${q}`
  }

  /** All matching refs in id order, cached for slow plans. */
  function collect(plan: Plan<Row>, dir: 1 | -1, key: string): RefSet<Row> {
    const cacheId = `${String(version)}|${String(dir)}|${key}`
    if (plan.slow) {
      const hit = queryCache.get(cacheId)
      if (hit) return hit
    }
    const refs: number[] = []
    const ins = scan(plan, dir, (ref) => {
      refs.push(ref)
      return true
    })
    const set = { refs, ins }
    if (plan.slow) queryCache.set(cacheId, set)
    return set
  }

  function countPlan(plan: Plan<Row>, key: string): number {
    const known = plan.countable ? null : knownTotal(plan)
    if (known !== null) return known
    if (plan.slow && !plan.needFull) {
      // Direct loop: cell mask, id window, then the compiled per-position test.
      const c = ensure()
      const { keys, cellOf } = c
      const { mask, test } = plan
      const needId = plan.idConds.length > 0 && !plan.idBounded
      const pStart = plan.idLo > 0 ? lowerBound(plan.idLo) : 0
      const pEnd = plan.idHi === Number.POSITIVE_INFINITY ? c.n : lowerBound(plan.idHi + 1)
      let n = 0
      const narrow = narrowPositions(plan)
      if (narrow) {
        for (let j = 0; j < narrow.length; j++) {
          const p = narrow[j] as number
          if (mask[cellOf[p] as number] !== 1) continue
          if (needId && !idPasses(plan, codec.encode(keys[p] as number))) continue
          if (test(p)) n++
        }
      } else {
        for (let p = pStart; p < pEnd; p++) {
          if (mask[cellOf[p] as number] !== 1) continue
          if (needId && !idPasses(plan, codec.encode(keys[p] as number))) continue
          if (test(p)) n++
        }
      }
      for (const e of insList().list) {
        if (mask[e.cell] === 1 && idPasses(plan, e.row.id) && rowPasses(plan, e.row)) n++
      }
      return n
    }
    if (plan.slow) return collect(plan, 1, key).refs.length
    return fastCount(plan)
  }

  /**
   * Count of a plan without derived-field conditions: O(cells) when there is no `id` condition,
   * otherwise a callback-free loop over the id window (plus the runtime rows).
   */
  function fastCount(plan: Plan<Row>): number {
    if (plan.countable) return maskSum(plan)
    const c = ensure()
    const { keys, cellOf } = c
    const { mask } = plan
    const pStart = plan.idLo > 0 ? lowerBound(plan.idLo) : 0
    const pEnd = plan.idHi === Number.POSITIVE_INFINITY ? c.n : lowerBound(plan.idHi + 1)
    let n = 0
    const narrow = narrowPositions(plan)
    if (narrow) {
      for (let j = 0; j < narrow.length; j++) {
        const p = narrow[j] as number
        if (mask[cellOf[p] as number] !== 1) continue
        if (plan.idBounded || idPasses(plan, codec.encode(keys[p] as number))) n++
      }
    } else if (plan.idBounded) {
      for (let p = pStart; p < pEnd; p++) n += mask[cellOf[p] as number] as number
    } else {
      for (let p = pStart; p < pEnd; p++) {
        if (mask[cellOf[p] as number] === 1 && idPasses(plan, codec.encode(keys[p] as number))) n++
      }
    }
    for (const e of insList().list) {
      if (mask[e.cell] === 1 && idPasses(plan, e.row.id)) n++
    }
    return n
  }

  function paging(q: DatasetQueryOptions<Row>): { start: number; size: number } | null {
    if (q.page === undefined && q.pageSize === undefined) return null
    const pageSize = q.pageSize
    const page = q.page ?? 1
    if (pageSize === undefined || !Number.isSafeInteger(pageSize) || pageSize < 1) {
      throw new MockDbError('INVALID', `${name}.query: pageSize must be a positive integer`)
    }
    if (!Number.isSafeInteger(page) || page < 1) {
      throw new MockDbError('INVALID', `${name}.query: page must be a positive integer`)
    }
    return { start: (page - 1) * pageSize, size: pageSize }
  }

  function sliceRefs(
    refs: readonly number[],
    ins: readonly InsertedEntry<Row>[],
    pg: { start: number; size: number } | null,
  ): Row[] {
    const part = pg ? refs.slice(pg.start, pg.start + pg.size) : refs
    return part.map((r) => refRow(r, ins))
  }

  // --- query modes ---------------------------------------------------------------------------

  /**
   * The total of a plan without visiting its rows, when that is possible: facet-only plans
   * (cell counts) and search-only plans (per-cell hit counts over the cell mask, plus runtime
   * rows). `null` otherwise.
   */
  function knownTotal(plan: Plan<Row>): number | null {
    if (plan.countable) return maskSum(plan)
    const search = plan.search
    const cellHits = plan.rowCellHits
    if (
      !cellHits ||
      (search !== null && search.direct.length > 0) ||
      plan.needFull ||
      plan.match ||
      plan.idConds.length > 0
    ) {
      return null
    }
    let n = 0
    for (let i = 1; i < cells.length; i++) {
      if (plan.mask[i] === 1) n += cellHits[i] as number
    }
    for (const e of insList().list) {
      if (plan.mask[e.cell] === 1 && rowPasses(plan, e.row)) n++
    }
    return n
  }

  function queryById(
    plan: Plan<Row>,
    dir: 1 | -1,
    pg: { start: number; size: number } | null,
    key: string,
  ): QueryResult<Row> {
    if (pg && plan.slow && !plan.needFull) {
      // Cheap-field / search conditions: one pass keeps only the page (no ref array, no cache).
      // When the total is known from per-cell hit counts, the pass stops at the page end.
      const known = knownTotal(plan)
      const page: number[] = []
      let seen = 0
      const end = pg.start + pg.size
      const ins = scan(plan, dir, (ref) => {
        if (seen >= pg.start && seen < end) page.push(ref)
        seen++
        return known === null || seen < end
      })
      return { rows: page.map((r) => refRow(r, ins)), total: known ?? seen }
    }
    if (plan.slow || !pg) {
      const { refs, ins } = collect(plan, dir, key)
      return { rows: sliceRefs(refs, ins, pg), total: refs.length }
    }
    // Not slow: the total comes from a callback-free count, so the page scan can exit early.
    const page: number[] = []
    let seen = 0
    const end = pg.start + pg.size
    const ins = scan(plan, dir, (ref) => {
      if (seen >= pg.start) page.push(ref)
      seen++
      return seen < end
    })
    return { rows: page.map((r) => refRow(r, ins)), total: fastCount(plan) }
  }

  function queryByOrderField(
    plan: Plan<Row>,
    dir: 'asc' | 'desc',
    tieDir: 'asc' | 'desc',
    pg: { start: number; size: number } | null,
  ): QueryResult<Row> {
    const c = ensure()
    const order = def.order as NonNullable<typeof def.order>
    const field = order.field
    const overridden = new Set<number>()
    for (const [pos, patch] of overrides) if (field in patch) overridden.add(pos)

    // Exceptions: anchors, overridden-order rows and runtime rows that match.
    interface Exc {
      ref: number
      value: unknown
      id: unknown
    }
    const { list } = insList()
    const exc: Exc[] = []
    const candidates = [...new Set([...c.anchorPos, ...overridden])].sort((a, b) => a - b)
    for (const p of candidates) {
      if (plan.mask[c.cellOf[p] as number] !== 1) continue
      if (plan.idConds.length > 0 && !idPasses(plan, codec.encode(c.keys[p] as number))) continue
      const row = rowAt(p)
      if (plan.slow && !rowPasses(plan, row)) continue
      exc.push({ ref: p, value: (row as Record<string, unknown>)[field], id: row.id })
    }
    list.forEach((e, i) => {
      if (plan.mask[e.cell] !== 1) return
      if (plan.idConds.length > 0 && !idPasses(plan, e.row.id)) return
      if (plan.slow && !rowPasses(plan, e.row)) return
      exc.push({ ref: -(i + 1), value: (e.row as Record<string, unknown>)[field], id: e.row.id })
    })
    const sign = dir === 'asc' ? 1 : -1
    const tieSign = tieDir === 'asc' ? 1 : -1
    const cmp = (av: unknown, aid: unknown, bv: unknown, bid: unknown) =>
      compareValues(av, bv) * sign || compareValues(aid, bid) * tieSign
    exc.sort((a, b) => cmp(a.value, a.id, b.value, b.id))

    const out: number[] = []
    let seen = 0
    const end = pg ? pg.start + pg.size : Number.POSITIVE_INFINITY
    const known = knownTotal(plan)
    const early = pg !== null && (!plan.slow || known !== null)
    const emit = (ref: number): boolean => {
      if (!pg || (seen >= pg.start && seen < end)) out.push(ref)
      seen++
      return !(early && seen >= end)
    }
    let ei = 0
    let stopped = false
    scan(
      plan,
      dir === 'asc' ? 1 : -1,
      (p) => {
        const gv = order.generated(c.keys[p] as number)
        const gid = codec.encode(c.keys[p] as number)
        while (ei < exc.length) {
          const e = exc[ei] as Exc
          if (cmp(e.value, e.id, gv, gid) >= 0) break
          ei++
          if (!emit(e.ref)) {
            stopped = true
            return false
          }
        }
        if (!emit(p)) {
          stopped = true
          return false
        }
        return true
      },
      { exclude: (p) => c.anchorFlag[p] === 1 || overridden.has(p), inserted: false },
    )
    if (!stopped) {
      while (ei < exc.length) {
        if (!emit((exc[ei++] as Exc).ref)) break
      }
    }
    const total = known ?? (plan.slow ? seen : fastCount(plan))
    return { rows: out.map((r) => refRow(r, list)), total }
  }

  function queryByFacets(
    plan: Plan<Row>,
    sortKeys: readonly NormSortKey[],
    tieDir: 'asc' | 'desc',
    pg: { start: number; size: number } | null,
    key: string,
  ): QueryResult<Row> {
    // Rank matching cells by the facet tuple; equal tuples share a rank.
    const idx: number[] = []
    for (let i = 1; i < cells.length; i++) if (plan.mask[i]) idx.push(i)
    const cmpCells = (a: number, b: number) => {
      const fa = (cells[a] as DatasetCell<F>).facets as unknown as Record<string, unknown>
      const fb = (cells[b] as DatasetCell<F>).facets as unknown as Record<string, unknown>
      for (const k of sortKeys) {
        const d = compareValues(fa[k.field], fb[k.field])
        if (d !== 0) return k.dir === 'asc' ? d : -d
      }
      return 0
    }
    idx.sort(cmpCells)
    const rank = new Int32Array(cells.length).fill(-1)
    let r = -1
    idx.forEach((cell, i) => {
      if (i === 0 || cmpCells(idx[i - 1] as number, cell) !== 0) r++
      rank[cell] = r
    })
    const dir = tieDir === 'asc' ? 1 : -1
    if (plan.countable && pg) {
      // Rank sizes come from the cell counts, so only the ranks that overlap the page are scanned
      // (each with a rank-only mask and early exit).
      const rankCount = new Array<number>(r + 1).fill(0)
      for (const cell of idx) {
        const rk = rank[cell] as number
        rankCount[rk] = (rankCount[rk] as number) + (cells[cell] as DatasetCell<F>).count
      }
      const total = rankCount.reduce((a, b) => a + b, 0)
      const out: number[] = []
      let ins: InsertedEntry<Row>[] = []
      const end = pg.start + pg.size
      let before = 0
      for (let rk = 0; rk <= r && before < end; rk++) {
        const size = rankCount[rk] as number
        if (before + size > pg.start && size > 0) {
          const sub: Plan<Row> = { ...plan, mask: new Uint8Array(cells.length) }
          for (const cell of idx) if (rank[cell] === rk) sub.mask[cell] = 1
          const skip = Math.max(0, pg.start - before)
          const take = Math.min(size, end - before) - skip
          let seen = 0
          ins = scan(sub, dir, (ref) => {
            if (seen >= skip) out.push(ref)
            seen++
            return seen < skip + take
          })
        }
        before += size
      }
      return { rows: out.map((ref) => refRow(ref, ins)), total }
    }
    const buckets: number[][] = Array.from({ length: r + 1 }, () => [])
    const { refs, ins } = collect(plan, dir, key)
    for (const ref of refs) (buckets[rank[refCell(ref, ins)] as number] as number[]).push(ref)
    const ordered = buckets.flat()
    return { rows: sliceRefs(ordered, ins, pg), total: ordered.length }
  }

  function queryGeneric(
    plan: Plan<Row>,
    sort: SortSpec<Row>,
    pg: { start: number; size: number } | null,
    key: string,
  ): QueryResult<Row> {
    const cacheId = `${String(version)}|sorted:${stableStringify(sort)}|${key}`
    let hit = queryCache.get(cacheId)
    if (!hit) {
      const { refs, ins } = collect(plan, 1, key)
      // Sorting only by id, facets and cheap fields needs no derivation (partial rows).
      const sortFields = normSort(sort as SortSpec<unknown>).map((k) => k.field)
      const cheapOnly = sortFields.every((f) => f === 'id' || facetSet.has(f) || cheapSet.has(f))
      const cheapSort = sortFields.filter((f) => cheapSet.has(f))
      const rows = refs.map((ref) => ({
        ref,
        row: cheapOnly && ref >= 0 ? partialRow(ref, cheapSort) : refRow(ref, ins),
      }))
      const cmp = compileSort(sort)
      rows.sort((a, b) => cmp(a.row, b.row))
      hit = { refs: rows.map((x) => x.ref), ins }
      queryCache.set(cacheId, hit)
    }
    return { rows: sliceRefs(hit.refs, hit.ins, pg), total: hit.refs.length }
  }

  // --- the dataset ---------------------------------------------------------------------------

  const dataset: VirtualDataset<Row, K> = {
    kind: 'virtual',
    name,
    owner: def.owner,
    facets: def.facets,
    get version() {
      return version
    },
    get compiled() {
      return compiled !== null
    },
    get runtimeCellCount() {
      return cells.filter((c) => c.runtime).length
    },

    has(id) {
      const pos = posOfId(id)
      if (pos >= 0) return !deleted.has(pos)
      return inserted.has(id)
    },

    get(id) {
      const pos = posOfId(id)
      if (pos >= 0) return deleted.has(pos) ? undefined : rowAt(pos)
      return inserted.get(id)?.row
    },

    getMany(ids) {
      const out: Row[] = []
      for (const id of ids) {
        const row = dataset.get(id)
        if (row) out.push(row)
      }
      return out
    },

    query(q: DatasetQueryOptions<Row> = {}): QueryResult<Row> {
      ensure()
      const pg = paging(q)
      const plan = makePlan(q.where, q.match, q.matchFields, q.search, q.cacheKey)
      const key = planKey(q.where, q.match, q.cacheKey, q.search)
      const sortKeys = normSort(q.sort as SortSpec<unknown> | undefined)
      const first = sortKeys[0]
      if (!first) return queryById(plan, 1, pg, key)
      if (first.field === 'id') return queryById(plan, first.dir === 'asc' ? 1 : -1, pg, key)
      const tail = sortKeys[sortKeys.length - 1] as NormSortKey
      if (
        def.order &&
        first.field === def.order.field &&
        (sortKeys.length === 1 || (sortKeys.length === 2 && tail.field === 'id'))
      ) {
        return queryByOrderField(plan, first.dir, sortKeys.length === 2 ? tail.dir : 'asc', pg)
      }
      const head = tail.field === 'id' ? sortKeys.slice(0, -1) : sortKeys
      if (head.every((k) => facetSet.has(k.field))) {
        return queryByFacets(plan, head, tail.field === 'id' ? tail.dir : 'asc', pg, key)
      }
      return queryGeneric(plan, q.sort as SortSpec<Row>, pg, key)
    },

    count(where, match, options?: DatasetCountOptions<Row>) {
      ensure()
      const plan = makePlan(where, match, options?.matchFields, options?.search, options?.cacheKey)
      return countPlan(plan, planKey(where, match, options?.cacheKey, options?.search))
    },

    groupCount<G extends keyof Row>(field: G, where?: Where<Row>) {
      ensure()
      const plan = makePlan(where, undefined)
      const out = new Map<Row[G], number>()
      const f = field as string
      if (facetSet.has(f)) {
        const perCell = new Map<number, number>()
        if (plan.countable) {
          // Aggregate straight from the cell table (one map, O(cells)).
          for (let i = 1; i < cells.length; i++) {
            const cell = cells[i] as DatasetCell<F>
            if (plan.mask[i] !== 1 || cell.count <= 0) continue
            const v = (cell.facets as unknown as Record<string, unknown>)[f] as Row[G]
            const prev = out.get(v)
            out.set(v, prev === undefined ? cell.count : prev + cell.count)
          }
          return out
        } else {
          const { refs, ins } = collect(plan, 1, planKey(where, undefined, undefined))
          for (const ref of refs) {
            const cell = refCell(ref, ins)
            perCell.set(cell, (perCell.get(cell) ?? 0) + 1)
          }
        }
        for (const [cell, n] of perCell) {
          const v = ((cells[cell] as DatasetCell<F>).facets as unknown as Record<string, unknown>)[
            f
          ] as Row[G]
          out.set(v, (out.get(v) ?? 0) + n)
        }
        return out
      }
      const { refs, ins } = collect(plan, 1, planKey(where, undefined, undefined))
      const cheapCol = cheapSet.has(f) ? valueColumn(f) : null
      for (const ref of refs) {
        const v = (cheapCol && ref >= 0 ? cheapCol[ref] : refRow(ref, ins)[field]) as Row[G]
        out.set(v, (out.get(v) ?? 0) + 1)
      }
      return out
    },

    sample(where, n, rng) {
      if (!Number.isSafeInteger(n) || n < 0) {
        throw new MockDbError('INVALID', `${name}.sample: n must be a non-negative integer`)
      }
      ensure()
      const plan = makePlan(where, undefined)
      const key = planKey(where, undefined, undefined)
      const set = plan.countable ? null : collect(plan, 1, key)
      const m = set ? set.refs.length : maskSum(plan)
      const k = Math.min(n, m)
      // Sparse Fisher–Yates over ranks 0…m-1 (same draws as defineTable().sample).
      const swapped = new Map<number, number>()
      const chosen: number[] = []
      for (let i = 0; i < k; i++) {
        const j = i + Math.floor(rng.next() * (m - i))
        const vj = swapped.get(j) ?? j
        const vi = swapped.get(i) ?? i
        swapped.set(j, vi)
        chosen.push(vj)
      }
      if (set) return chosen.map((r) => refRow(set.refs[r] as number, set.ins))
      const wanted = [...chosen].sort((a, b) => a - b)
      const refByRank = new Map<number, number>()
      let rank = 0
      let w = 0
      const ins = scan(plan, 1, (ref) => {
        if (rank === wanted[w]) {
          refByRank.set(rank, ref)
          w++
        }
        rank++
        return w < wanted.length
      })
      return chosen.map((r) => refRow(refByRank.get(r) as number, ins))
    },

    insert(input: InsertInput<Row>) {
      return run(() => {
        requireWritable('insert')
        let id = input.id
        if (id === undefined || id === null) {
          id = allocator.next({
            // Reserved anchor ranges above the floor are skipped (Delivery Lead decision).
            taken: (candidate) =>
              posOfId(candidate) >= 0 || inserted.has(candidate) || inReserved(candidate),
            prng: idPrng(),
          })
        } else {
          const ok =
            (typeof id === 'number' && Number.isSafeInteger(id)) ||
            (typeof id === 'string' && id !== '')
          if (!ok) throw new MockDbError('INVALID', `${name}: invalid id ${JSON.stringify(id)}`)
          if (posOfId(id) >= 0 || inserted.has(id)) {
            throw new MockDbError('DUPLICATE_ID', `${name}: id ${String(id)} exists`)
          }
          allocator.observe(id)
        }
        const row = Object.freeze({ ...input, id }) as unknown as Row
        touch(id)
        setState(id, { k: 'inserted', row })
        return row
      })
    },

    update(id, patch) {
      return run(() => {
        requireWritable('update')
        if ('id' in patch && patch.id !== undefined && patch.id !== id) {
          throw new MockDbError('ID_CHANGE', `${name}: cannot change id ${String(id)}`)
        }
        const st = stateOf(id)
        const clean = { ...patch }
        delete (clean as { id?: unknown }).id
        if (st.k === 'base' || st.k === 'override') {
          touch(id)
          const merged = { ...(st.k === 'override' ? st.patch : {}), ...clean } as Partial<Row>
          setState(
            id,
            Object.keys(merged).length > 0 ? { k: 'override', patch: merged } : { k: 'base' },
          )
          return rowAt(posOfId(id))
        }
        if (st.k === 'inserted') {
          touch(id)
          const row = Object.freeze({ ...st.row, ...clean, id }) as Row
          setState(id, { k: 'inserted', row })
          return row
        }
        throw new MockDbError('NOT_FOUND', `${name}: id ${String(id)} not found`)
      })
    },

    remove(id) {
      run(() => {
        requireWritable('remove')
        const st = stateOf(id)
        if (st.k === 'base' || st.k === 'override') {
          touch(id)
          setState(id, { k: 'deleted' })
          return
        }
        if (st.k === 'inserted') {
          touch(id)
          setState(id, { k: 'absent' })
          return
        }
        throw new MockDbError('NOT_FOUND', `${name}: id ${String(id)} not found`)
      })
    },

    // --- seed-phase API --------------------------------------------------------------------------

    addAnchors(rows, contributor = 'unknown') {
      if (compiled) {
        throw new MockDbError(
          'PHASE',
          `${name}.addAnchors(${contributor}): the dataset is already compiled; contribute anchors during seeding`,
        )
      }
      for (const row of rows) contributed.push({ row, contributor })
    },

    overrideSpec(transform) {
      if (compiled) {
        throw new MockDbError('PHASE', `${name}.overrideSpec: the dataset is already compiled`)
      }
      transforms.push(transform)
    },

    feasibility(): FeasibilityReport {
      const { issues, spec } = build()
      return {
        ok: issues.length === 0,
        issues,
        total: spec?.total ?? 0,
        cells: spec ? spec.cells.length - 1 : 0,
        anchors: spec?.anchors.length ?? 0,
      }
    },

    compile,

    cells() {
      ensure()
      return cells.slice(1).map((c) => ({ ...c }))
    },

    isAnchor(id) {
      const pos = posOfId(id)
      return pos >= 0 && (compiled as Compiled<Row>).anchorFlag[pos] === 1
    },

    contributions() {
      const out = new Map<string, Id[]>()
      for (const { row, contributor } of allAnchors()) {
        let list = out.get(contributor)
        if (!list) out.set(contributor, (list = []))
        list.push(row.id)
      }
      return out
    },

    fingerprint() {
      return ensure().fingerprint
    },

    specHash() {
      if (specHashCache !== null) return specHashCache
      const base = typeof def.distribution === 'function' ? def.distribution() : def.distribution
      const baseCells = base.map((c) => ({
        key: cellKey(c.facets as unknown as Record<string, unknown>, facetNames),
        facets: c.facets,
        count: c.count,
      }))
      const parts = [
        'specHash:v1',
        name,
        stableStringify(def.idRange),
        stableStringify(reserved),
        `absent:${[...(def.absentIds ?? [])].sort((a, b) => a - b).join(',')}`,
        facetNames.join(','),
        `ids:${def.runtimeIds.kind}:${stableStringify(def.runtimeIds.create().getState())}`,
        `seed:${String(seedBase)}`,
        `order:${def.order?.field ?? ''}`,
        `cheap:${cheapNames.join(',')}`,
        // Cell order matters: it feeds the layout shuffle.
        ...baseCells.map((c) => `${c.key}=${String(c.count)}`),
        ...(def.anchors ?? []).map((row) => `anchor:${stableStringify(row)}`),
        ...blocks.map((b) =>
          stableStringify({
            label: b.label ?? null,
            fromId: b.fromId ?? null,
            toId: b.toId ?? null,
            contiguous: b.contiguous === true,
            ...(b.dense === true && b.contiguous === true ? { dense: true } : {}),
            // The predicate is captured by the base cells it selects.
            cells: baseCells.filter((c) => b.cells(c.facets)).map((c) => c.key),
          }),
        ),
      ].join('\n')
      specHashCache =
        fnv1a32(parts).toString(16).padStart(8, '0') +
        fnv1a32(`#${parts}`).toString(16).padStart(8, '0')
      return specHashCache
    },

    // --- TransactionalStore --------------------------------------------------------------------

    attach(next) {
      if (tx) throw new MockDbError('PHASE', `${name}: cannot re-attach inside a transaction`)
      host = next
    },

    beginTx() {
      tx = { undo: new Map(), idState: allocator.getState() }
    },

    commitTx(): DatasetChanges<Row> | null {
      if (!tx) return null
      const { undo, idState } = tx
      tx = null
      const changes: DatasetChanges<Row> = {
        kind: 'dataset',
        overrides: [],
        deletes: [],
        inserts: [],
        ids: null,
      }
      let any = false
      for (const [id, prev] of undo) {
        const cur = stateOf(id)
        const same =
          cur.k === prev.k &&
          (cur.k !== 'override' || cur.patch === (prev as { patch: unknown }).patch) &&
          (cur.k !== 'inserted' || cur.row === (prev as { row: unknown }).row)
        if (same) continue
        any = true
        if (cur.k === 'override') changes.overrides.push({ id, patch: cur.patch })
        else if (cur.k === 'base') changes.overrides.push({ id, patch: {} })
        else if (cur.k === 'inserted') changes.inserts.push(cur.row)
        else changes.deletes.push(id)
      }
      const ids = allocator.getState()
      const idsMoved = JSON.stringify(ids) !== JSON.stringify(idState)
      if (!any && !idsMoved) return null
      changes.ids = ids
      changes.overrides.sort((a, b) => compareValues(a.id, b.id))
      changes.deletes.sort(compareValues)
      changes.inserts.sort((a, b) => compareValues(a.id, b.id))
      queryCache.clear()
      return changes
    },

    rollbackTx() {
      if (!tx) return
      const { undo, idState } = tx
      tx = null
      for (const [id, prev] of [...undo].reverse()) setState(id, prev)
      allocator.setState(idState)
      queryCache.clear()
      version++
    },

    markBaseline() {
      if (tx)
        throw new MockDbError('PHASE', `${name}: cannot mark the baseline inside a transaction`)
      ensure()
      prebuildSearchIndexes()
      baselineIdState = JSON.stringify(allocator.getState())
    },

    clear() {
      compiled = null
      cells = []
      cellIndex = new Map()
      liveTotal = 0
      resetOverlay()
      contributed = []
      transforms = []
      allocator.reset()
      baselineIdState = null
      tx = null
      rowCache.clear()
      queryCache.clear()
      version++
    },

    diff(): DatasetDiff<Row> {
      const c = compiled
      const out: DatasetDiff<Row> = {
        kind: 'dataset',
        overrides: [],
        deletes: [],
        inserts: [],
        ids: null,
      }
      if (c) {
        for (const [pos, patch] of overrides) {
          out.overrides.push({ id: codec.encode(c.keys[pos] as number), patch })
        }
        for (const pos of deleted) out.deletes.push(codec.encode(c.keys[pos] as number))
      }
      for (const e of inserted.values()) out.inserts.push(e.row)
      out.overrides.sort((a, b) => compareValues(a.id, b.id))
      out.deletes.sort(compareValues)
      out.inserts.sort((a, b) => compareValues(a.id, b.id))
      const state = allocator.getState()
      if (baselineIdState !== null && JSON.stringify(state) !== baselineIdState) out.ids = state
      return out
    },

    loadDiff(diff) {
      ensure()
      if (tx) throw new MockDbError('PHASE', `${name}.loadDiff: not allowed inside a transaction`)
      resetOverlay()
      if (baselineIdState !== null) {
        allocator.setState(JSON.parse(baselineIdState) as ReturnType<IdAllocator<Id>['getState']>)
      }
      applyOverlay(diff, 'loadDiff')
      // Keep the boot-time search indexes warm (rebuilt here only if too many rows changed).
      prebuildSearchIndexes()
    },

    applyChanges(changes) {
      applyOverlay(changes, 'applyChanges')
    },
  }
  return dataset
}
