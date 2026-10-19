/**
 * Compilation of a virtual dataset spec (overview §6.6 "Slots and anchors", ADR-0013 §3–§5).
 *
 * 1. **Prepare + feasibility** (`prepareSpec`): cells are validated and merged by facet
 *    combination; Σ counts is checked against the declared total; id ranges, the runtime floor,
 *    anchors (ids, cells, per-cell capacity) are checked. Every problem is returned as an issue.
 * 2. **Slots** (`layoutSlots`): `N` slots with strictly increasing ids spread evenly over
 *    `idRange` (`id(p) = min + ⌊p · span / N⌋`). Each slot gets a cell label: layout blocks first
 *    (contiguous or windowed), then a Fisher–Yates shuffle of the remaining multiset of labels
 *    (named stream `dataset:<name>:layout`), so cells interleave across ids.
 * 3. **Anchors** (`claimAnchors`): in ascending id order, each anchor claims the unclaimed slot of
 *    its own cell nearest to its id (ties: the lower id). The slot is removed and the anchor takes
 *    its own id. A remaining slot whose id equals an anchor id moves to a free integer, staying in
 *    its layout block: in a contiguous block, the first free id above the run of consecutive anchor
 *    ids (below the run only if nothing above is free), so no block row lands below the block
 *    start (M04 user-1 rows from 522425, M10 anchors 522425–522447); in a windowed block, the
 *    nearest free id inside the window; otherwise the nearest free id in `idRange` outside every
 *    contiguous block span (ties: the lower one). Cell counts and the total never change.
 *
 * 4. **Dense blocks** (`LayoutBlock.dense`, opt-in, contiguous blocks only): after step 3 the block's
 *    non-anchor rows are renumbered to consecutive ids from `fromId` (skipping anchor ids, holes and
 *    ids held by other rows), including rows an anchor or hole displaced above the run.
 *
 * Output: typed arrays only — `keys` (ascending) and `cellOf` — plus the anchor positions.
 */

import type { IdStrategy } from '../db/id-strategies'
import type { StoreId } from '../db/store'
import type { Prng, PrngRegistry } from '../determinism/prng'
import type { DatasetIssue } from './errors'
import { cellKey, isFacetValue, type CellSpec, type FacetRecord } from './spec'
import type { IdCodec, IdRange, LayoutBlock } from './types'

export const MAX_KEY = 0xffffffff

export interface PreparedCell {
  facets: Readonly<FacetRecord>
  key: string
  count: number
}

export interface PreparedAnchor<Row> {
  key: number
  row: Row
  /** 1-based cell index. */
  cell: number
  contributor: string
}

export interface PreparedSpec<Row> {
  facetNames: readonly string[]
  /** Index 0 is the tombstone; real cells are 1…n. */
  cells: PreparedCell[]
  cellIndex: Map<string, number>
  total: number
  /** Sorted by key. */
  anchors: PreparedAnchor<Row>[]
  /** Generated-range ids that must not exist (holes), sorted. */
  absent: number[]
}

export interface AnchorInput<Row> {
  row: Row
  contributor: string
}

export interface PrepareInput<Row extends { id: StoreId }> {
  name: string
  facetNames: readonly string[]
  cells: readonly CellSpec<Record<string, unknown>>[]
  total: number | undefined
  idRange: IdRange
  reservedAnchorRanges: readonly (readonly [number, number])[]
  runtimeIds: IdStrategy<Row['id']>
  codec: IdCodec<Row['id']>
  anchors: readonly AnchorInput<Row>[]
  /** Holes: ids inside `idRange` that no generated row may take (`absentIds`). */
  absentIds?: readonly number[]
}

function isKey(n: unknown): n is number {
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= MAX_KEY
}

export function prepareSpec<Row extends { id: StoreId }>(
  input: PrepareInput<Row>,
): { spec: PreparedSpec<Row>; issues: DatasetIssue[] } {
  const issues: DatasetIssue[] = []
  const { name, facetNames } = input
  const facetSet = new Set(facetNames)
  if (facetSet.size !== facetNames.length) {
    issues.push({ code: 'CELL', message: `${name}: duplicate facet names` })
  }
  if (facetSet.has('id')) issues.push({ code: 'CELL', message: `${name}: 'id' cannot be a facet` })

  // --- cells ---------------------------------------------------------------------------------
  const cells: PreparedCell[] = [{ facets: Object.freeze({}), key: '\u0000tombstone', count: 0 }]
  const cellIndex = new Map<string, number>()
  let total = 0
  input.cells.forEach((cell, i) => {
    const where = `${name}: cell[${String(i)}] ${JSON.stringify(cell.facets)}`
    if (!isKey(cell.count) || cell.count > MAX_KEY) {
      issues.push({
        code: 'CELL',
        message: `${where}: count ${String(cell.count)} is not a non-negative integer`,
      })
      return
    }
    const facets: FacetRecord = {}
    let ok = true
    for (const f of facetNames) {
      if (!(f in cell.facets)) {
        issues.push({ code: 'CELL', message: `${where}: missing facet '${f}'` })
        ok = false
        continue
      }
      const v = cell.facets[f]
      if (!isFacetValue(v)) {
        issues.push({
          code: 'CELL',
          message: `${where}: facet '${f}' is not a primitive (${typeof v})`,
        })
        ok = false
        continue
      }
      facets[f] = v
    }
    for (const f of Object.keys(cell.facets)) {
      if (!facetSet.has(f)) {
        issues.push({ code: 'CELL', message: `${where}: '${f}' is not a declared facet` })
        ok = false
      }
    }
    if (!ok) return
    const key = cellKey(facets, facetNames)
    const existing = cellIndex.get(key)
    if (existing !== undefined) {
      const prev = cells[existing] as PreparedCell
      prev.count += cell.count
    } else {
      cellIndex.set(key, cells.length)
      cells.push({ facets: Object.freeze(facets), key, count: cell.count })
    }
    total += cell.count
  })
  if (input.total !== undefined && input.total !== total) {
    issues.push({
      code: 'TOTAL',
      message: `${name}: cells sum to ${String(total)}, declared total is ${String(input.total)} (Δ ${String(total - input.total)})`,
    })
  }

  // --- id ranges -----------------------------------------------------------------------------
  const { min, max } = input.idRange
  const rangeOk = isKey(min) && isKey(max) && min <= max
  if (!rangeOk) {
    issues.push({
      code: 'RANGE',
      message: `${name}: idRange [${String(min)}, ${String(max)}] is invalid`,
    })
  } else if (max - min + 1 < total) {
    issues.push({
      code: 'RANGE',
      message: `${name}: idRange [${String(min)}, ${String(max)}] holds ${String(max - min + 1)} ids, fewer than the ${String(total)} slots`,
    })
  }
  const reserved = input.reservedAnchorRanges
  reserved.forEach(([lo, hi], i) => {
    const label = `${name}: reserved range [${String(lo)}, ${String(hi)}]`
    if (!isKey(lo) || !isKey(hi) || lo > hi) {
      issues.push({ code: 'RANGE', message: `${label} is invalid` })
      return
    }
    if (rangeOk && lo <= max && hi >= min) {
      issues.push({ code: 'RANGE', message: `${label} overlaps idRange` })
    }
    reserved.forEach(([lo2, hi2], j) => {
      if (j > i && lo <= hi2 && hi >= lo2) {
        issues.push({
          code: 'RANGE',
          message: `${label} overlaps [${String(lo2)}, ${String(hi2)}]`,
        })
      }
    })
  })

  // --- runtime ids (XL-37; relaxed by Delivery Lead decision, F-09 G4) ------------------------
  // The floor lies above idRange and outside every reserved range. Reserved ranges MAY lie above
  // the floor: the runtime allocator skips them (e.g. schools floor 10,301, reserved 900001–900099).
  const strategy = input.runtimeIds
  if (strategy.kind === 'floor') {
    const start = (strategy.create().getState().hw ?? 0) + 1
    if (rangeOk && start <= max) {
      issues.push({
        code: 'RANGE',
        message: `${name}: runtime floor ${String(start)} must lie above idRange (max ${String(max)})`,
      })
    }
    for (const [lo, hi] of reserved) {
      if (start >= lo && start <= hi) {
        issues.push({
          code: 'RANGE',
          message: `${name}: runtime floor ${String(start)} lies inside reserved range [${String(lo)}, ${String(hi)}]`,
        })
      }
    }
  } else if (strategy.kind === 'sequence' || strategy.kind === 'maxPlusOne') {
    issues.push({
      code: 'RANGE',
      message: `${name}: runtime ids must use floor({ start }) above idRange (or uuid/opaque for string ids), not ${strategy.kind}`,
    })
  }

  // --- anchors -------------------------------------------------------------------------------
  const anchors: PreparedAnchor<Row>[] = []
  const seen = new Map<number, string>()
  const perCell = new Map<number, number>()
  for (const { row, contributor } of input.anchors) {
    const id = row.id
    const key = input.codec.decode(id)
    const label = `${name}: anchor ${JSON.stringify(id)} (${contributor})`
    if (key === undefined || !isKey(key)) {
      issues.push({ code: 'ANCHOR_ID', message: `${label}: id has no numeric key` })
      continue
    }
    const inRange = rangeOk && key >= min && key <= max
    const inReserved = reserved.some(([lo, hi]) => key >= lo && key <= hi)
    if (!inRange && !inReserved) {
      issues.push({
        code: 'ANCHOR_ID',
        message: `${label}: key ${String(key)} is outside idRange and every reserved anchor range`,
      })
      continue
    }
    const dup = seen.get(key)
    if (dup !== undefined) {
      issues.push({ code: 'ANCHOR_ID', message: `${label}: duplicate of an anchor from ${dup}` })
      continue
    }
    seen.set(key, contributor)
    const facets: FacetRecord = {}
    let ok = true
    for (const f of facetNames) {
      const v = (row as Record<string, unknown>)[f]
      const value = v === undefined ? null : v
      if (!isFacetValue(value)) {
        issues.push({ code: 'CELL', message: `${label}: facet '${f}' is not a primitive` })
        ok = false
      } else facets[f] = value
    }
    if (!ok) continue
    const cell = cellIndex.get(cellKey(facets, facetNames))
    if (cell === undefined) {
      issues.push({
        code: 'ANCHOR_NO_CELL',
        message: `${label}: no cell for facets ${JSON.stringify(facets)}`,
      })
      continue
    }
    perCell.set(cell, (perCell.get(cell) ?? 0) + 1)
    anchors.push({ key, row, cell, contributor })
  }
  for (const [cell, n] of perCell) {
    const c = cells[cell] as PreparedCell
    if (n > c.count) {
      issues.push({
        code: 'ANCHOR_OVERFLOW',
        message: `${name}: cell ${JSON.stringify(c.facets)} has ${String(n)} anchors but count ${String(c.count)}`,
      })
    }
  }
  anchors.sort((a, b) => a.key - b.key)

  // --- holes (absentIds) -------------------------------------------------------------------
  const absentSet = new Set<number>()
  for (const id of input.absentIds ?? []) {
    const label = `${name}: absent id ${String(id)}`
    if (!isKey(id) || !rangeOk || id < min || id > max) {
      issues.push({ code: 'RANGE', message: `${label} must be an integer inside idRange` })
    } else if (seen.has(id)) {
      issues.push({ code: 'ANCHOR_ID', message: `${label} is also an anchor id` })
    } else absentSet.add(id)
  }
  if (
    absentSet.size > 0 &&
    rangeOk &&
    max - min + 1 >= total &&
    max - min + 1 - absentSet.size < total
  ) {
    issues.push({
      code: 'RANGE',
      message: `${name}: idRange minus ${String(absentSet.size)} absent ids cannot hold the ${String(total)} slots`,
    })
  }
  const absent = [...absentSet].sort((a, b) => a - b)

  return { spec: { facetNames, cells, cellIndex, total, anchors, absent }, issues }
}

// ---------------------------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------------------------

export interface SlotGeometry {
  min: number
  span: number
  n: number
}

/** Id of slot `p` (strictly increasing when span ≥ n). */
export function slotId(g: SlotGeometry, p: number): number {
  return g.min + Math.floor((p * g.span) / g.n)
}

/** Smallest slot position whose id is ≥ `id` (may be `n`). */
export function firstSlotAtOrAbove(g: SlotGeometry, id: number): number {
  if (id <= g.min) return 0
  let p = Math.ceil(((id - g.min) * g.n) / g.span)
  while (p > 0 && slotId(g, p - 1) >= id) p--
  while (p < g.n && slotId(g, p) < id) p++
  return Math.min(p, g.n)
}

/** Slot position whose id is exactly `id`, or -1. */
export function slotWithId(g: SlotGeometry, id: number): number {
  const p = firstSlotAtOrAbove(g, id)
  return p < g.n && slotId(g, p) === id ? p : -1
}

function fillLabels(
  cells: readonly number[],
  counts: readonly number[],
  total: number,
): Uint32Array {
  const labels = new Uint32Array(total)
  let at = 0
  cells.forEach((cell, i) => {
    const n = counts[i] as number
    labels.fill(cell, at, at + n)
    at += n
  })
  return labels
}

function shuffleInPlace(a: Uint32Array, rng: Prng) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    const t = a[i] as number
    a[i] = a[j] as number
    a[j] = t
  }
}

/** Where a layout block's rows live; displaced slots of the block are nudged inside it. */
export interface BlockWindow {
  /** Lowest id a row of the block may take. */
  lo: number
  /** Highest id a row of the block may take. */
  hi: number
  contiguous: boolean
  /** `LayoutBlock.dense`: the block's rows are re-numbered to consecutive ids from `denseFrom`. */
  dense: boolean
  denseFrom: number
  /** The cells of the block (rows of these cells are the block's rows). */
  cells: ReadonlySet<number>
  /** Contiguous blocks: id of the last slot of the block (rows of other cells stay out of lo…end). */
  end: number
}

export interface SlotPlacement {
  /** Block index per cell, or -1. */
  blockOfCell: Int32Array
  /** Per block (index = block order); `null` for blocks with no rows. */
  windows: (BlockWindow | null)[]
}

export function layoutSlots<Row>(
  name: string,
  spec: PreparedSpec<Row>,
  geometry: SlotGeometry,
  blocks: readonly LayoutBlock<Record<string, unknown>>[],
  prng: PrngRegistry,
): { cellOf: Uint32Array; issues: DatasetIssue[]; placement: SlotPlacement } {
  const issues: DatasetIssue[] = []
  const n = geometry.n
  const cellOf = new Uint32Array(n) // 0 = unassigned
  const owner = new Int32Array(spec.cells.length).fill(-1)
  const windows: (BlockWindow | null)[] = blocks.map(() => null)
  const maxId = geometry.min + geometry.span - 1

  blocks.forEach((block, b) => {
    const label = `${name}: layout block ${block.label ?? String(b)}`
    const members: number[] = []
    const counts: number[] = []
    let m = 0
    for (let c = 1; c < spec.cells.length; c++) {
      const cell = spec.cells[c] as PreparedCell
      if (owner[c] !== -1 || !block.cells(cell.facets)) continue
      owner[c] = b
      if (cell.count === 0) continue
      members.push(c)
      counts.push(cell.count)
      m += cell.count
    }
    if (m === 0) return
    const from = block.fromId ?? geometry.min
    const to = block.toId ?? geometry.min + geometry.span - 1
    const pa = firstSlotAtOrAbove(geometry, from)
    const pb = firstSlotAtOrAbove(geometry, to + 1) - 1
    const labels = fillLabels(members, counts, m)
    shuffleInPlace(labels, prng.fresh(`dataset:${name}:layout:block:${String(b)}`))
    if (block.contiguous) {
      if (pa + m - 1 > pb) {
        issues.push({
          code: 'LAYOUT',
          message: `${label}: ${String(m)} rows do not fit in the ${String(Math.max(0, pb - pa + 1))} slots from id ${String(from)}`,
        })
        return
      }
      for (let i = 0; i < m; i++) {
        if (cellOf[pa + i] !== 0) {
          issues.push({
            code: 'LAYOUT',
            message: `${label}: overlaps an earlier block at slot ${String(pa + i)}`,
          })
          return
        }
      }
      for (let i = 0; i < m; i++) cellOf[pa + i] = labels[i] as number
      windows[b] = {
        lo: slotId(geometry, pa),
        hi: block.toId ?? maxId,
        contiguous: true,
        dense: block.dense === true,
        denseFrom: from,
        cells: new Set(members),
        end: slotId(geometry, pa + m - 1),
      }
      return
    }
    const free: number[] = []
    for (let p = pa; p <= pb; p++) if (cellOf[p] === 0) free.push(p)
    if (free.length < m) {
      issues.push({
        code: 'LAYOUT',
        message: `${label}: ${String(m)} rows do not fit in the ${String(free.length)} free slots of ids ${String(from)}–${String(to)}`,
      })
      return
    }
    const rng = prng.fresh(`dataset:${name}:layout:window:${String(b)}`)
    for (let i = 0; i < m; i++) {
      const j = i + Math.floor(rng.next() * (free.length - i))
      const t = free[i] as number
      free[i] = free[j] as number
      free[j] = t
    }
    const chosen = free.slice(0, m).sort((a, c) => a - c)
    chosen.forEach((p, i) => (cellOf[p] = labels[i] as number))
    windows[b] = {
      lo: from,
      hi: to,
      contiguous: false,
      dense: false,
      denseFrom: from,
      cells: new Set(members),
      end: to,
    }
  })
  const placement: SlotPlacement = { blockOfCell: owner, windows }
  if (issues.length > 0) return { cellOf, issues, placement }

  const rest: number[] = []
  const restCounts: number[] = []
  let r = 0
  for (let c = 1; c < spec.cells.length; c++) {
    const cell = spec.cells[c] as PreparedCell
    if (owner[c] !== -1 || cell.count === 0) continue
    rest.push(c)
    restCounts.push(cell.count)
    r += cell.count
  }
  const labels = fillLabels(rest, restCounts, r)
  shuffleInPlace(labels, prng.fresh(`dataset:${name}:layout`))
  let i = 0
  for (let p = 0; p < n; p++) {
    if (cellOf[p] === 0) cellOf[p] = labels[i++] as number
  }
  return { cellOf, issues, placement }
}

// ---------------------------------------------------------------------------------------------
// Anchors
// ---------------------------------------------------------------------------------------------

export interface CompiledSlots {
  /** Ascending keys of every row (generated and anchor). */
  keys: Uint32Array
  cellOf: Uint32Array
  /** 1 where the row is an anchor. */
  anchorFlag: Uint8Array
}

export function claimAnchors<Row>(
  name: string,
  spec: PreparedSpec<Row>,
  geometry: SlotGeometry,
  slotCells: Uint32Array,
  placement?: SlotPlacement,
): { slots: CompiledSlots; issues: DatasetIssue[] } {
  const issues: DatasetIssue[] = []
  const n = geometry.n
  const nCells = spec.cells.length

  // CSR: positions per cell, ascending.
  const start = new Uint32Array(nCells + 1)
  for (let p = 0; p < n; p++) {
    const c = slotCells[p] as number
    start[c + 1] = (start[c + 1] as number) + 1
  }
  for (let c = 0; c < nCells; c++) start[c + 1] = (start[c + 1] as number) + (start[c] as number)
  const fill = start.slice(0, nCells)
  const byCell = new Uint32Array(n)
  for (let p = 0; p < n; p++) {
    const c = slotCells[p] as number
    byCell[fill[c] as number] = p
    fill[c] = (fill[c] as number) + 1
  }

  const claimed = new Uint8Array(n)
  for (const anchor of spec.anchors) {
    const lo = start[anchor.cell] as number
    const hi = start[anchor.cell + 1] as number
    // First index in [lo, hi) whose slot id ≥ anchor key.
    let a = lo
    let b = hi
    while (a < b) {
      const mid = (a + b) >>> 1
      if (slotId(geometry, byCell[mid] as number) < anchor.key) a = mid + 1
      else b = mid
    }
    let left = a - 1
    let right = a
    while (left >= lo && claimed[byCell[left] as number]) left--
    while (right < hi && claimed[byCell[right] as number]) right++
    let pick = -1
    if (left >= lo && right < hi) {
      const dl = anchor.key - slotId(geometry, byCell[left] as number)
      const dr = slotId(geometry, byCell[right] as number) - anchor.key
      pick = dl <= dr ? (byCell[left] as number) : (byCell[right] as number)
    } else if (left >= lo) pick = byCell[left] as number
    else if (right < hi) pick = byCell[right] as number
    if (pick < 0) {
      // Only reachable when the prepare step's overflow check was skipped.
      issues.push({
        code: 'ANCHOR_OVERFLOW',
        message: `${name}: no free slot for anchor key ${String(anchor.key)}`,
      })
      continue
    }
    claimed[pick] = 1
  }

  // Remaining slots whose id collides with an anchor, or is a hole (`absentIds`), move.
  const anchorKeys = new Set(spec.anchors.map((x) => x.key))
  const absentKeys = new Set(spec.absent)
  const isBlocked = (id: number) => anchorKeys.has(id) || absentKeys.has(id)
  const displaced: number[] = []
  const displacedFlag = new Uint8Array(n)
  for (const key of [...spec.anchors.map((x) => x.key), ...spec.absent]) {
    const p = slotWithId(geometry, key)
    if (p >= 0 && !claimed[p] && !displacedFlag[p]) {
      displaced.push(p)
      displacedFlag[p] = 1
    }
  }
  displaced.sort((a, b) => a - b)
  const moved = new Map<number, number>() // position → new key
  const movedKeys = new Set<number>()
  const maxId = geometry.min + geometry.span - 1
  const taken = (id: number) => {
    if (isBlocked(id) || movedKeys.has(id)) return true
    const p = slotWithId(geometry, id)
    return p >= 0 && !claimed[p] && !displacedFlag[p]
  }
  // Rows of other cells never move into a contiguous block's id span.
  const contiguousSpans = (placement?.windows ?? [])
    .filter((w): w is BlockWindow => w !== null && w.contiguous)
    .map((w) => [w.lo, w.end] as const)
  const inContiguousSpan = (id: number) =>
    contiguousSpans.some(([lo, end]) => id >= lo && id <= end)

  const nearest = (k: number, lo: number, hi: number, avoidSpans: boolean): number => {
    const blocked = (id: number) => taken(id) || (avoidSpans && inContiguousSpan(id))
    for (let d = 1; ; d++) {
      const down = k - d
      const up = k + d
      if (down < lo && up > hi) return -1
      if (down >= lo && !blocked(down)) return down
      if (up <= hi && !blocked(up)) return up
    }
  }

  /** A hole's slot moves to the next free id above it (below only if nothing is free above). */
  const nextFree = (k: number, lo: number, hi: number, avoidSpans: boolean): number => {
    const blocked = (id: number) => taken(id) || (avoidSpans && inContiguousSpan(id))
    for (let id = k + 1; id <= hi; id++) if (!blocked(id)) return id
    for (let id = k - 1; id >= lo; id--) if (!blocked(id)) return id
    return -1
  }

  for (const p of displaced) {
    const k = slotId(geometry, p)
    const block = placement ? (placement.blockOfCell[slotCells[p] as number] as number) : -1
    const win = block >= 0 ? (placement?.windows[block] ?? null) : null
    const hole = absentKeys.has(k)
    let found = -1
    if (hole && !win?.contiguous) {
      found = win
        ? nextFree(k, Math.max(win.lo, geometry.min), Math.min(win.hi, maxId), false)
        : nextFree(k, geometry.min, maxId, contiguousSpans.length > 0)
    } else if (win?.contiguous) {
      // First free id above the run of consecutive anchor ids containing k (e.g. M04 user-1
      // rows after the M10 anchors 522425–522447); below the run only if nothing is free above.
      let runEnd = k
      while (isBlocked(runEnd + 1)) runEnd++
      for (let id = runEnd + 1; id <= win.hi && found < 0; id++) if (!taken(id)) found = id
      if (found < 0) {
        let runStart = k
        while (isBlocked(runStart - 1)) runStart--
        for (let id = runStart - 1; id >= win.lo && found < 0; id--) if (!taken(id)) found = id
      }
    } else if (win) {
      found = nearest(k, Math.max(win.lo, geometry.min), Math.min(win.hi, maxId), false)
    } else {
      found = nearest(k, geometry.min, maxId, contiguousSpans.length > 0)
    }
    if (found < 0) {
      issues.push({
        code: 'RANGE',
        message: `${name}: no free id for the slot displaced by ${hole ? 'absent id' : 'anchor'} ${String(k)}`,
      })
      continue
    }
    moved.set(p, found)
    movedKeys.add(found)
  }
  if (issues.length > 0) {
    return {
      slots: {
        keys: new Uint32Array(0),
        cellOf: new Uint32Array(0),
        anchorFlag: new Uint8Array(0),
      },
      issues,
    }
  }

  // Extras (anchors + moved slots), sorted by key, merged with the untouched slots.
  const extras: { key: number; cell: number; anchor: boolean }[] = spec.anchors.map((x) => ({
    key: x.key,
    cell: x.cell,
    anchor: true,
  }))
  for (const [p, key] of moved) extras.push({ key, cell: slotCells[p] as number, anchor: false })
  extras.sort((x, y) => x.key - y.key)

  const keys = new Uint32Array(n)
  const cellOf = new Uint32Array(n)
  const anchorFlag = new Uint8Array(n)
  let out = 0
  let e = 0
  for (let p = 0; p < n; p++) {
    if (claimed[p] || displacedFlag[p]) continue
    const k = slotId(geometry, p)
    while (e < extras.length && (extras[e] as { key: number }).key < k) {
      const x = extras[e++] as { key: number; cell: number; anchor: boolean }
      keys[out] = x.key
      cellOf[out] = x.cell
      anchorFlag[out] = x.anchor ? 1 : 0
      out++
    }
    keys[out] = k
    cellOf[out] = slotCells[p] as number
    out++
  }
  while (e < extras.length) {
    const x = extras[e++] as { key: number; cell: number; anchor: boolean }
    keys[out] = x.key
    cellOf[out] = x.cell
    anchorFlag[out] = x.anchor ? 1 : 0
    out++
  }
  if (out !== n) {
    issues.push({
      code: 'RANGE',
      message: `${name}: internal slot count mismatch (${String(out)} ≠ ${String(n)})`,
    })
  }
  for (const w of placement?.windows ?? []) {
    if (w?.contiguous && w.dense) densifyBlock(keys, cellOf, anchorFlag, w, isBlocked)
  }
  return { slots: { keys, cellOf, anchorFlag }, issues }
}

/**
 * `LayoutBlock.dense`: renumbers the non-anchor rows of the block (by cell membership, so rows an
 * anchor or a hole displaced above the run are included) to consecutive ids from `w.denseFrom`,
 * skipping every id another row holds (anchors, foreign-cell rows) and holes (`isBlocked`; O(1)
 * per id via sets). The k-th block row gets the k-th free id, which is never above its old key, so
 * rows stay ascending; the affected key range is merged and sorted again. Cells, counts and the
 * order of cells inside the block do not change. The scan starts at `denseFrom`, so a row of
 * another cell in `[denseFrom, first block slot)` is never renumbered.
 */
function densifyBlock(
  keys: Uint32Array,
  cellOf: Uint32Array,
  anchorFlag: Uint8Array,
  w: BlockWindow,
  isBlocked: (id: number) => boolean,
): void {
  let i0 = 0
  let i1 = keys.length
  while (i0 < i1) {
    const mid = (i0 + i1) >>> 1
    if ((keys[mid] as number) < w.denseFrom) i0 = mid + 1
    else i1 = mid
  }
  const isBlockRow = (p: number) => !anchorFlag[p] && w.cells.has(cellOf[p] as number)
  let last = -1
  for (let p = i0; p < keys.length; p++) if (isBlockRow(p)) last = p
  if (last < 0) return
  const occupied = new Set<number>()
  for (let p = i0; p <= last; p++) if (!isBlockRow(p)) occupied.add(keys[p] as number)
  const entries: { key: number; cell: number; anchor: number }[] = []
  let id = w.denseFrom
  for (let p = i0; p <= last; p++) {
    let key = keys[p] as number
    if (isBlockRow(p)) {
      while (isBlocked(id) || occupied.has(id)) id++
      key = id++
    }
    entries.push({ key, cell: cellOf[p] as number, anchor: anchorFlag[p] as number })
  }
  entries.sort((x, y) => x.key - y.key)
  entries.forEach((e, i) => {
    keys[i0 + i] = e.key
    cellOf[i0 + i] = e.cell
    anchorFlag[i0 + i] = e.anchor
  })
}
