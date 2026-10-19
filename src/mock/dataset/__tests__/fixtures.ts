/**
 * Synthetic datasets for the F-09 tests (not a module spec). The shape mimics the M04 questions
 * dataset: subject × level via `fit2d`, then status, active flag and difficulty via `nestSplit`.
 */

import { floor } from '../../db/id-strategies'
import { defineTable, type Table } from '../../db/table'
import { defineVirtualDataset, hashKey } from '../dataset'
import { fit2d } from '../fit2d'
import { nestSplit, split, type CellSpec } from '../spec'
import type { LayoutBlock, VirtualDataset } from '../types'

export interface Q {
  id: number
  subjectId: number
  levelId: number | null
  status: 'approved' | 'archived'
  isActive: boolean
  difficulty: number
  text: string
  score: number
  createdAt: number
}

export type QFacet = 'subjectId' | 'levelId' | 'status' | 'isActive' | 'difficulty'
export type QFacets = Pick<Q, QFacet>

export const Q_FACETS: readonly QFacet[] = [
  'subjectId',
  'levelId',
  'status',
  'isActive',
  'difficulty',
]

export const T0 = Date.UTC(2020, 0, 1)
export const createdAtOf = (key: number) => T0 + key * 60_000

const STEMS = ['Apakah', 'Manakah', 'Mengapakah', 'Bagaimanakah', 'Berapakah', 'Siapakah']

export interface BuildOptions {
  total: number
  idMax: number
  subjects?: number
  levels?: number
  anchors?: Q[]
  reserved?: [number, number][]
  runtimeFloor?: number
  blocks?: LayoutBlock<QFacets>[]
  name?: string
  /** Counter incremented on every derive call. */
  deriveCalls?: { n: number }
  /** Cheap datasets: prebuild the `text` search index at `markBaseline()`. */
  searchText?: boolean
  /**
   * Cheap datasets: generated texts repeat (M04-like: a stem list per subject), about 16k distinct
   * texts instead of one per row.
   */
  repetitiveText?: boolean
}

export function questionCells(total: number, subjects = 27, levels = 11): CellSpec<QFacets>[] {
  const subjectTotals = split(
    total,
    Array.from({ length: subjects }, (_, i) => [i + 1, 10 + ((i * 7) % 13)] as const),
  )
  const levelTotals = split(
    total,
    Array.from({ length: levels }, (_, i) => [i + 1, 5 + ((i * 3) % 7)] as const),
  )
  const base = fit2d({
    rows: subjectTotals,
    cols: levelTotals,
    // Elective subjects (id > 20) only at the three upper levels.
    allowed: (s, l) => s <= 20 || l >= levels - 3,
    label: 'test subject×level',
  }).map((c) => ({ facets: { subjectId: c.row, levelId: c.col }, count: c.count }))
  const withStatus = nestSplit(base, 'status', [
    ['approved', 31],
    ['archived', 69],
  ] as const)
  const withActive = nestSplit(withStatus, 'isActive', (c) =>
    c.facets.status === 'approved'
      ? ([
          [true, 88],
          [false, 12],
        ] as const)
      : ([
          [true, 0],
          [false, 1],
        ] as const),
  )
  return nestSplit(withActive, 'difficulty', [
    [1, 30],
    [2, 36],
    [3, 26],
    [4, 8],
    [5, 0],
  ] as const)
}

export function buildQuestions(opts: BuildOptions): VirtualDataset<Q, QFacet> {
  const cells = questionCells(opts.total, opts.subjects, opts.levels)
  const calls = opts.deriveCalls
  return defineVirtualDataset<Q, QFacet>({
    name: opts.name ?? 'test.questions',
    owner: 'TEST',
    total: opts.total,
    idRange: { min: 1, max: opts.idMax },
    reservedAnchorRanges: opts.reserved ?? [[900_001, 900_099]],
    runtimeIds: floor({ start: opts.runtimeFloor ?? 9_000_001 }),
    facets: Q_FACETS,
    distribution: cells,
    derive: (id, f, rng, ctx) => {
      if (calls) calls.n++
      return {
        text: `${rng.pick(STEMS)} soalan ${String(id)} (subjek ${String(f.subjectId)})?`,
        score: rng.int(0, 100),
        createdAt: createdAtOf(ctx.key),
      }
    },
    anchors: opts.anchors ?? [],
    order: { field: 'createdAt', generated: createdAtOf },
    layout: opts.blocks ? { blocks: opts.blocks } : undefined,
  })
}

/** Interned repetitive texts: 27 subjects × 600 stems (like per-subject stem lists). */
const REPETITIVE: string[][] = Array.from({ length: 28 }, (_, s) =>
  Array.from(
    { length: 600 },
    (_, i) =>
      `${STEMS[i % STEMS.length] as string} soalan topik ${String(i)} bagi subjek ${String(s)}?`,
  ),
)

function repetitiveText(key: number, subjectId: number): string {
  const list = REPETITIVE[subjectId % REPETITIVE.length] as string[]
  return list[hashKey(key, 4) % list.length] as string
}

/**
 * The same shape with `text` and `score` as **cheap fields** (functions of key + facets): the
 * pattern owners use for derived fields that screens filter, search or sort on.
 */
export function buildCheapQuestions(opts: BuildOptions): VirtualDataset<Q, QFacet> {
  const cells = questionCells(opts.total, opts.subjects, opts.levels)
  const calls = opts.deriveCalls
  return defineVirtualDataset<Q, QFacet, 'text' | 'score'>({
    name: opts.name ?? 'test.questions.cheap',
    owner: 'TEST',
    total: opts.total,
    idRange: { min: 1, max: opts.idMax },
    reservedAnchorRanges: opts.reserved ?? [[900_001, 900_099]],
    runtimeIds: floor({ start: opts.runtimeFloor ?? 9_000_001 }),
    facets: Q_FACETS,
    distribution: cells,
    fields: {
      text: opts.repetitiveText
        ? (key, f) => repetitiveText(key, f.subjectId)
        : (key, f) =>
            `${STEMS[hashKey(key, 2) % STEMS.length] as string} soalan ${String(key)} (subjek ${String(f.subjectId)})?`,
      score: (key) => hashKey(key, 1) % 101,
    },
    derive: (_id, _f, _rng, ctx) => {
      if (calls) calls.n++
      return { createdAt: createdAtOf(ctx.key) }
    },
    anchors: opts.anchors ?? [],
    order: { field: 'createdAt', generated: createdAtOf },
    searchFields: opts.searchText ? ['text'] : undefined,
  })
}

/** A materialised table holding exactly the dataset's current rows (reference model). */
export function materialise(ds: VirtualDataset<Q, QFacet>): Table<Q> {
  const table = defineTable<Q>({ name: `${ds.name}.ref`, ids: floor({ start: 9_000_001 }) })
  for (const row of ds.query().rows) table.insert(row)
  return table
}

export function anchor(partial: Partial<Q> & Pick<Q, 'id'>): Q {
  return {
    subjectId: 1,
    levelId: 1,
    status: 'approved',
    isActive: true,
    difficulty: 1,
    text: `Anchor ${String(partial.id)}`,
    score: 99,
    createdAt: T0,
    ...partial,
  }
}
