/**
 * Types of the virtual dataset primitive (overview §6.6, ADR-0013).
 */

import type { IdCounterState, IdStrategy } from '../db/id-strategies'
import type { QueryOptions, Store, StoreId, TransactionalStore, Where } from '../db/store'
import type { Prng } from '../determinism/prng'
import type { DatasetIssue } from './errors'
import type { CellSpec, Distribution, FacetValue } from './spec'

/** An inclusive id range `[min, max]`. */
export interface IdRange {
  min: number
  max: number
}

/**
 * Maps the dataset's external ids to the internal numeric keys that order the rows (uint32).
 * The default is the identity on integer ids. A string-id dataset (e.g. practice sessions
 * `"g1"…"g32096"`, anchors `"A2"`) supplies its own codec; `decode` returns `undefined` for ids
 * that have no key (e.g. opaque runtime ids), which are then ordered after every keyed row.
 */
export interface IdCodec<Id extends StoreId> {
  encode(key: number): Id
  decode(id: Id): number | undefined
}

/** A layout block: cells matching `cells` are laid out inside an id window (overview §6.6 step 2). */
export interface LayoutBlock<F> {
  /** Which cells belong to the block. */
  cells: (facets: Readonly<F>) => boolean
  /**
   * First id of the window (default: `idRange.min`). With `dense`, the first id of the consecutive
   * run the block's rows take.
   */
  fromId?: number
  /** Last id of the window (default: `idRange.max`). */
  toId?: number
  /**
   * `true`: the block's slots are the consecutive slots starting at the first slot ≥ `fromId`
   * (e.g. M04 "user-1 rows take ids from 522425 upwards"). `false` (default): the slots are
   * spread over the window by the layout shuffle.
   */
  contiguous?: boolean
  /**
   * Only with `contiguous`: the block's rows take **consecutive ids** from `fromId` (skipping anchor
   * ids and `absentIds`), instead of the consecutive slots, whose ids are spread by the id-range
   * density (about 1.21 ids per slot for M04). Used where an id run is a documented contract (M04
   * PKSK rows 177698–178460). Opt-in; datasets without it are unchanged.
   */
  dense?: boolean
  /** Name used in messages. */
  label?: string
}

/**
 * Fast path for sorting by a time field (overview §6.6 "newest first"): generated rows' `field`
 * is `generated(key)`, which must be non-decreasing in `key` and equal to what `derive` returns.
 * Anchors, runtime rows and overrides of `field` carry their own values and are merged in order.
 */
export interface OrderFieldSpec<Row> {
  field: keyof Row & string
  generated: (key: number) => unknown
}

export interface DeriveContext {
  /** The internal key of the row (= the numeric id for integer-id datasets). */
  key: number
  /** The dataset name. */
  dataset: string
}

/**
 * Cheap derived fields: pure functions of the row key and its facets (no PRNG stream), evaluated
 * without `derive`. Filters, sorts and `groupCount` on them avoid full derivation, which is what keeps
 * derived-field queries inside the 50 ms budget. Use `hashKey(key, salt)` for per-row variation.
 */
export type CheapFields<Row, K extends keyof Row, C extends keyof Row> = {
  [P in C]: (key: number, facets: Readonly<Pick<Row, K>>) => Row[P]
}

/** A search case mode: `insensitive` (default search) or `sensitive` (`caseSensitive: true`). */
export type SearchMode = 'insensitive' | 'sensitive'

export interface VirtualDatasetDef<
  Row extends { id: StoreId },
  K extends keyof Row & string,
  C extends Exclude<keyof Row & string, 'id' | K> = never,
> {
  /** Unique store name (also the persistence key), e.g. `'questions'`. */
  name: string
  /** Owner module (D12), e.g. `'M04'`. Informational. */
  owner?: string
  /** Declared total N; the feasibility check asserts Σ cells = total. */
  total?: number
  /** Generated id range (= the live id range). Slots spread evenly over it. */
  idRange: IdRange
  /**
   * Holes: ids inside `idRange` that must not exist (e.g. M04 108527, a deleted question that a
   * report still cites; 564156). The generated slot at such an id moves to the next free id above
   * it (below only if nothing above is free); no cell count or total changes. An anchor may not use
   * a hole. Part of `specHash`.
   */
  absentIds?: readonly number[]
  /** Id ranges outside `idRange` that anchors may use (e.g. schools 900001–900099). */
  reservedAnchorRanges?: readonly (readonly [number, number])[]
  /**
   * Runtime insert ids. For integer ids use `floor({ start })` with `start` above `idRange` and
   * every reserved range (XL-37); the feasibility check enforces it.
   */
  runtimeIds: IdStrategy<Row['id']>
  /** Required when `Row['id']` is not an integer (see `IdCodec`). */
  idCodec?: IdCodec<Row['id']>
  /** Count-relevant fields. Every cell has exactly these facets. */
  facets: readonly K[]
  /**
   * The distribution (a list of cells), or a thunk. A thunk must be **pure and deterministic**: it
   * is called more than once (`specHash`, `feasibility`, compile) and must return equal cells
   * each time, without reading mutable state or the clock.
   */
  distribution: Distribution<Pick<Row, K>> | (() => Distribution<Pick<Row, K>>)
  /**
   * Non-facet fields of a generated row: a pure function of `(id, facets, rng)`. `rng` is the
   * named stream `dataset:<name>:row:<key>`, fresh per call. Facet values always win over
   * derived ones. Cheap fields (`fields`) are not derived here.
   */
  derive: (
    id: Row['id'],
    facets: Readonly<Pick<Row, K>>,
    rng: Prng,
    ctx: DeriveContext,
  ) => Omit<Row, 'id' | K | C>
  /** Cheap derived fields (see `CheapFields`); they win over `derive`, facets win over them. */
  fields?: CheapFields<Row, K, C>
  /**
   * Cheap fields whose search index is built at `markBaseline()` (boot) instead of on the first
   * `search` (a one-time cost of a few hundred ms at ~470k rows), e.g. question text.
   */
  searchFields?: readonly C[]
  /**
   * Case modes prebuilt for `searchFields` at `markBaseline()` and after `loadDiff` (default: both),
   * so a cold case-insensitive or `caseSensitive` search never pays the index build.
   */
  searchModes?: readonly SearchMode[]
  /** Observed records (literal rows). Contributed anchors are added with `addAnchors`. */
  anchors?: readonly Row[]
  /** Fast "newest first" / time-ordered paging (optional). */
  order?: OrderFieldSpec<Row>
  /** Layout blocks, placed in the given order before the shuffle. */
  layout?: { blocks?: readonly LayoutBlock<Pick<Row, K>>[] }
  /**
   * PRNG seed base of the layout and row streams. Default **1** (Delivery Lead decision): the
   * dataset does not follow `mock.setRandomSeed`, so quiz randomness never changes the data.
   */
  seedBase?: number
  /**
   * PoC profile only: the fraction of a cell's rows to keep when the dataset's global PoC scale
   * (`POC_SCALE_BY_DATASET`) would keep fewer (a larger fraction wins; return `undefined` for the
   * global scale). Pure and deterministic in the cell's facets. Lets a dataset keep usable pools
   * for a feature (M04: at least ~30 questions per Tingkatan 4/5 chapter).
   */
  pocScale?: (facets: Readonly<Pick<Row, K>>) => number | undefined
  /** Derived-row LRU size (default 4096). */
  rowCacheSize?: number
  /** Slow-path (`match` / derived-field filter) result LRU size (default 16). */
  queryCacheSize?: number
}

/** A compiled cell. Index 0 is the tombstone cell (deleted rows); real cells start at 1. */
export interface DatasetCell<F> {
  index: number
  facets: Readonly<F>
  /** Count in the spec. */
  specCount: number
  /** Current count (spec + overlay deltas). */
  count: number
  /** `true` for cells created at runtime by a facet combination absent from the spec. */
  runtime: boolean
}

/** Net changes of one transaction / one broadcast, and the cumulative diff (same shape). */
export interface DatasetOverlay<Row extends { id: StoreId }> {
  kind: 'dataset'
  /** Patches of spec rows (generated or anchor). The patch is the full cumulative patch. */
  overrides: { id: Row['id']; patch: Partial<Row> }[]
  /**
   * In a diff: deleted spec rows. In changes: also runtime rows that were removed.
   */
  deletes: Row['id'][]
  /** Runtime rows, current state. */
  inserts: Row[]
  /** Runtime id counter, or `null` when unchanged since the baseline (diff only). */
  ids: IdCounterState | null
}

export type DatasetChanges<Row extends { id: StoreId }> = DatasetOverlay<Row>
export type DatasetDiff<Row extends { id: StoreId }> = DatasetOverlay<Row>

export interface DatasetQueryOptions<Row> extends QueryOptions<Row> {
  /**
   * Cache key of `match` for the slow-path LRU (default: the function's identity, so a new closure
   * per request never hits the cache).
   */
  cacheKey?: string
  /**
   * The fields `match` reads. When all of them are `id`, facets or cheap fields, `match` gets a
   * partial row with just those fields and no row is derived (fast path). The partial row is **one
   * reused object** per scan: `match` must not keep it. Omit `matchFields` to pass full rows; a
   * full-row `match` then needs `cacheKey` (dev/Vitest throw without it; off in production builds, including the e2e build).
   */
  matchFields?: readonly (keyof Row & string)[]
  /** Case-insensitive substring search over fields (see `DatasetSearch`). */
  search?: DatasetSearch<Row>
}

/**
 * A text search: rows where **any** of `fields` contains `term`, case-insensitively by default
 * (like the live `LIKE '%term%'` on a case-insensitive collation) or with `caseSensitive`. An
 * empty term matches everything. On cheap fields it runs over a joined text index per field and
 * case mode, built lazily on first use (or at boot via `searchFields`) and kept up to date on
 * writes; facets and `id` are read directly; other fields need full rows.
 *
 * **Rule (Delivery Lead decision, F-09 G4):** substring predicates use `search`, never `match`.
 * Budgets at ~478k rows: `search` and every other query shape ≤ 50 ms; an arbitrary JS `match`
 * over cheap fields (`matchFields`) is a declared exception at ≤ 100 ms (one predicate call per
 * row). In dev/Vitest a `match` reading a `searchFields` field logs a warning.
 */
export interface DatasetSearch<Row> {
  term: string
  fields: readonly (keyof Row & string)[]
  /** Match the term's exact case (default: case-insensitive, like the live collation). */
  caseSensitive?: boolean
}

/** Options of `count` beyond the `Store` contract. */
export interface DatasetCountOptions<Row> {
  cacheKey?: string
  matchFields?: readonly (keyof Row & string)[]
  search?: DatasetSearch<Row>
}

export interface FeasibilityReport {
  ok: boolean
  issues: DatasetIssue[]
  /** Σ cell counts. */
  total: number
  cells: number
  anchors: number
}

export interface VirtualDataset<
  Row extends { id: StoreId },
  K extends keyof Row & string = keyof Row & string,
>
  extends Store<Row>, TransactionalStore<DatasetChanges<Row>, DatasetDiff<Row>> {
  readonly kind: 'virtual'
  readonly owner: string | undefined
  readonly facets: readonly K[]
  /** Increments on every mutation, applied change, rollback, compile and clear. */
  readonly version: number
  readonly compiled: boolean
  query(q?: DatasetQueryOptions<Row>): { rows: Row[]; total: number }
  count(
    where?: Where<Row>,
    match?: (row: Row) => boolean,
    options?: DatasetCountOptions<Row>,
  ): number
  has(id: Row['id']): boolean
  /** Adds anchors before compilation (seed phase; `contributeAnchors` of F-10 calls this). */
  addAnchors(rows: readonly Row[], contributor?: string): void
  /** Transforms the distribution before compilation (test/seed overrides, overview §6.10). */
  overrideSpec(transform: (cells: CellSpec<Pick<Row, K>>[]) => CellSpec<Pick<Row, K>>[]): void
  /** Validates spec + anchors without compiling (does not throw). */
  feasibility(): FeasibilityReport
  /** Compiles (idempotent). Throws `DatasetSpecError` when the spec is infeasible. */
  compile(): void
  /** Current cells (index ≥ 1), including runtime cells. */
  cells(): readonly DatasetCell<Pick<Row, K>>[]
  isAnchor(id: Row['id']): boolean
  /** Anchor contributors (for reviews): contributor → anchor ids. */
  contributions(): ReadonlyMap<string, readonly Row['id'][]>
  /** Stable hash of the compiled spec (cells, id ranges, anchors); part of the seed version. */
  fingerprint(): string
  /**
   * Hash of the dataset **definition** for the seed version (F-06): name, id ranges, facets,
   * runtime id strategy, seed base, base distribution, own anchors and layout blocks. Computable
   * before compilation; excludes `overrideSpec` transforms and contributed anchors.
   */
  specHash(): string
  /** Number of runtime cells created by overlay facet combinations. */
  readonly runtimeCellCount: number
}

export type { FacetValue }
