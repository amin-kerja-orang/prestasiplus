/**
 * Distribution spec of the schools dataset (M02 SRS v1.18 §6.15 A; M18 §6.10, XR-M18-01).
 *
 * Facets: `state × district × type × isActive`.
 *
 * | Marginal | Value | Source |
 * |---|---|---|
 * | total | 10,220 | OBSERVED (S9) |
 * | `isActive` | 10,212 true · 8 false (8277, 8880, 2710 anchors + 5 generated) | OBSERVED |
 * | `type` | SK 7,779 · SMK 2,441 | OBSERVED |
 * | Perlis | 104 | OBSERVED |
 * | Johor | 1,189 register schools (11 PPD cells) | OBSERVED (M18) |
 * | Perak | 1,102 (PPD BATANG PADANG 122) | OBSERVED (M18) |
 * | the other 13 states | the rest (7,823), by the state weights below | INFERRED |
 *
 * Johor and Perak consist of their anchors only (every register school is an anchor). The fixture
 * schools 900001–900004 are not in the dataset (v1.21: stored rows outside every count, table
 * `schools.fixtures`), so the Johor facet is 1,189 and the other 13 states share 7,825 (named query
 * `S-STATE-REGISTER`). The other states: `fit2d` over state totals × the remaining SK / SMK totals
 * (bounded below by each state's anchors), then each state × type split equally over the state's
 * districts after its anchors, and the 5 generated inactive schools spread over types by share
 * (4 SK, 1 SMK; INFERRED states).
 */

import { exact, fit2d, split, type CellSpec } from '@/mock/dataset'

import { districtsOf } from '../data/geo'
import type { SchoolFacets, SchoolType } from '../repository/types'
import { SCHOOL_ANCHOR_ROWS } from './schools-anchors'

export const SCHOOLS_TOTAL = 10_220
export const SCHOOLS_ACTIVE = 10_212
export const SCHOOLS_BY_TYPE = { SK: 7_779, SMK: 2_441 } as const
export const PERLIS_SCHOOLS = 104
export const SCHOOL_STATE_PINS = { Johor: 1_189, Perak: 1_102, Perlis: 104 } as const
export const SCHOOL_DISTRICT_PINS = {
  'PPD BATU PAHAT': 176,
  'PPD JOHOR BAHRU': 146,
  'PPD KLUANG': 118,
  'PPD KOTA TINGGI': 97,
  'PPD KULAI': 73,
  'PPD MERSING': 47,
  'PPD MUAR': 129,
  'PPD PASIR GUDANG': 112,
  'PPD PONTIAN': 100,
  'PPD SEGAMAT': 110,
  'PPD TANGKAK': 81,
  'PPD BATANG PADANG': 122,
} as const

/** Relative school share of the 13 states whose counts were not observed (INFERRED). */
const STATE_WEIGHTS: readonly (readonly [string, number])[] = [
  ['Kedah', 780],
  ['Kelantan', 540],
  ['Kuala Lumpur', 300],
  ['Labuan', 38],
  ['Melaka', 300],
  ['Negeri Sembilan', 420],
  ['Pahang', 760],
  ['Pulau Pinang', 380],
  ['Putrajaya', 40],
  ['Sabah', 1_300],
  ['Sarawak', 1_480],
  ['Selangor', 1_000],
  ['Terengganu', 400],
]

/** The 5 generated inactive schools (state, type), spread over types by share (INFERRED). */
const GENERATED_INACTIVE: readonly (readonly [string, SchoolType])[] = [
  ['Sabah', 'SK'],
  ['Sarawak', 'SK'],
  ['Kedah', 'SK'],
  ['Kelantan', 'SK'],
  ['Pahang', 'SMK'],
]

type CellKeyed = CellSpec<SchoolFacets>

function key(f: SchoolFacets): string {
  return JSON.stringify([f.state, f.district, f.type, f.isActive])
}

/** Adds `count` to the cell `f` in `acc`. */
function add(acc: Map<string, CellKeyed>, f: SchoolFacets, count: number) {
  if (count <= 0) return
  const k = key(f)
  const cell = acc.get(k)
  if (cell) cell.count += count
  else acc.set(k, { facets: { ...f }, count })
}

/** `total` over `n` equal parts on top of per-part minimums (largest remainder). */
function overMinimums(total: number, mins: readonly number[]): number[] {
  const floor = mins.reduce((a, b) => a + b, 0)
  if (total < floor) throw new Error(`schools spec: ${String(total)} < anchors ${String(floor)}`)
  const extra = split(
    total - floor,
    mins.map((_, i) => [i, 1] as const),
  )
  return mins.map((m, i) => m + (extra[i]?.[1] ?? 0))
}

let cached: CellKeyed[] | null = null

/** The compiled cell list (pure; memoised). */
export function schoolsDistribution(): CellKeyed[] {
  if (cached) return cached.map((c) => ({ facets: { ...c.facets }, count: c.count }))
  const acc = new Map<string, CellKeyed>()

  // Anchors per (state, district, type, isActive).
  const anchorCount = new Map<string, number>()
  for (const a of SCHOOL_ANCHOR_ROWS) {
    const k = key(a)
    anchorCount.set(k, (anchorCount.get(k) ?? 0) + 1)
  }

  // 1. Johor and Perak: exactly their anchors.
  for (const a of SCHOOL_ANCHOR_ROWS) {
    if (a.state === 'Johor' || a.state === 'Perak') {
      add(acc, { state: a.state, district: a.district, type: a.type, isActive: a.isActive }, 1)
    }
  }
  const jp = [...acc.values()]
  const jpTotal = jp.reduce((n, c) => n + c.count, 0)
  const jpSk = jp.filter((c) => c.facets.type === 'SK').reduce((n, c) => n + c.count, 0)

  // 2. State totals of Perlis and the other 13 states.
  const rest = SCHOOLS_TOTAL - jpTotal - PERLIS_SCHOOLS
  const stateTotals: [string, number][] = [
    ['Perlis', PERLIS_SCHOOLS],
    ...split(rest, STATE_WEIGHTS),
  ]
  const otherStates = new Set(stateTotals.map(([s]) => s))

  // Anchors of those states by (state, type).
  const anchorsBy = (state: string, type: SchoolType) =>
    SCHOOL_ANCHOR_ROWS.filter((a) => a.state === state && a.type === type).length

  // 3. state × type, matching the SK / SMK totals exactly.
  const table = fit2d<string, SchoolType>({
    label: 'schools state × type',
    rows: stateTotals,
    cols: [
      ['SK', SCHOOLS_BY_TYPE.SK - jpSk],
      ['SMK', SCHOOLS_BY_TYPE.SMK - (jpTotal - jpSk)],
    ],
    bounds: (state, type) => ({ min: anchorsBy(state, type) }),
  })

  // 4. Each state × type over the state's districts (after the anchors), active / inactive.
  for (const { row: state, col: type, count } of table) {
    if (!otherStates.has(state)) continue
    const districts = districtsOf(state)
    if (districts.length === 0) throw new Error(`schools spec: no districts for ${state}`)
    const inactiveGenerated = GENERATED_INACTIVE.filter(
      ([s, t]) => s === state && t === type,
    ).length
    const minsActive = districts.map(
      (d) => anchorCount.get(key({ state, district: d, type, isActive: true })) ?? 0,
    )
    const inactiveAnchors = districts.map(
      (d) => anchorCount.get(key({ state, district: d, type, isActive: false })) ?? 0,
    )
    const inactiveTotal = inactiveAnchors.reduce((a, b) => a + b, 0) + inactiveGenerated
    const activeParts = overMinimums(count - inactiveTotal, minsActive)
    districts.forEach((district, i) => {
      add(acc, { state, district, type, isActive: true }, activeParts[i] ?? 0)
      // Generated inactive schools go to the state's first district.
      const inactive = (inactiveAnchors[i] ?? 0) + (i === 0 ? inactiveGenerated : 0)
      add(acc, { state, district, type, isActive: false }, inactive)
    })
  }

  // Anchors with a district outside the state's list (none expected) would be unplaced.
  for (const a of SCHOOL_ANCHOR_ROWS) {
    if (!acc.has(key(a))) throw new Error(`schools spec: anchor ${String(a.id)} has no cell`)
  }
  cached = exact([...acc.values()])
  return cached.map((c) => ({ facets: { ...c.facets }, count: c.count }))
}
