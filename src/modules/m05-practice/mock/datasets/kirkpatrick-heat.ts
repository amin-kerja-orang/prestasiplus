/**
 * The weekday × hour answer grids of the Kirkpatrick segment (SRS M12 v1.5 §6.5 Q-M12-HEAT, BR-M12-13;
 * M05 v1.17 §6.14.4). The grid is a stored aggregate that covers a **subset** of the answers (M12
 * OQ-M12-11: live's hour data exists for 71 % of them), so it is not derived from the session rows.
 *
 * - platform: the observed 26-Sep grid (`KA_HEAT_PLATFORM`, Σ 218,070) less the 70 answers of that
 *   day (Saturday 10:00 and 11:00, the drift removed from the 25-Sep value): Σ 218,000 (SRS "≈ 218,000
 *   on 25 Sep"); the observed cells "Selasa 14:00" 6,253 and "Isnin 06:00" 944 are untouched;
 * - 8080: the observed grid (max 736, Σ 12,008, 43 zero cells);
 * - 9167: 4 non-zero cells 10, 40, 5, 61 (Σ 116 of its 545 answers); their weekday × hour positions are
 *   not observed (INFERRED);
 * - every other school (INFERRED): an integer table whose rows are the schools' shares of the answers
 *   and whose columns are the platform cells left over, so the schools' grids add up to the platform
 *   grid exactly.
 */

import { fit2d, split } from '@/mock/dataset'

import { KA_HEAT_8080, KA_HEAT_PLATFORM, KA_SCHOOLS } from './kirkpatrick-observed'

export const HEAT_DAYS = 7
export const HEAT_HOURS = 18

/** Saturday (index 5) at 10:00 and 11:00 (hour indexes 4 and 5): the 26-Sep drift, 40 + 30. */
const DRIFT_CELLS: readonly (readonly [number, number, number])[] = [
  [5, 4, 40],
  [5, 5, 30],
]
/** School 9167: [weekday, hour index, answers]. */
const HEAT_9167: readonly (readonly [number, number, number])[] = [
  [1, 3, 10],
  [2, 5, 40],
  [3, 4, 5],
  [4, 6, 61],
]

export type HeatGrid = number[][]

const blank = (): HeatGrid =>
  Array.from({ length: HEAT_DAYS }, () => new Array<number>(HEAT_HOURS).fill(0))
const copy = (g: readonly (readonly number[])[]): HeatGrid => g.map((r) => r.slice())

let cached: Map<number, HeatGrid> | null = null
let cachedPlatform: HeatGrid | null = null

function build(): void {
  const platform = copy(KA_HEAT_PLATFORM)
  for (const [d, h, n] of DRIFT_CELLS)
    (platform[d] as number[])[h] = (platform[d] as number[])[h]! - n
  const grids = new Map<number, HeatGrid>()
  grids.set(8080, copy(KA_HEAT_8080))
  const g9167 = blank()
  for (const [d, h, n] of HEAT_9167) (g9167[d] as number[])[h] = n
  grids.set(9167, g9167)
  // What is left of the platform grid for the other schools.
  const cells: { d: number; h: number; left: number }[] = []
  for (let d = 0; d < HEAT_DAYS; d++) {
    for (let h = 0; h < HEAT_HOURS; h++) {
      const left =
        (platform[d] as number[])[h]! -
        (grids.get(8080) as HeatGrid)[d]![h]! -
        (g9167[d] as number[])[h]!
      if (left < 0) throw new Error(`M05 Kirkpatrick heat: cell ${String(d)}:${String(h)} < 0`)
      cells.push({ d, h, left })
    }
  }
  const total = cells.reduce((a, c) => a + c.left, 0)
  const others = KA_SCHOOLS.map((s) => s[0]).filter((id) => id !== 8080 && id !== 9167)
  const share = split(
    total,
    others.map((id) => [id, KA_SCHOOLS.find((s) => s[0] === id)?.[3] ?? 0] as const),
  )
  const table = fit2d({
    label: 'KA heat',
    rows: share.map(([id, n]) => [id, n] as const),
    cols: cells.map((c) => [`${String(c.d)}:${String(c.h)}`, c.left] as const),
  })
  for (const id of others) grids.set(id, blank())
  for (const { row, col, count } of table) {
    if (count === 0) continue
    const [d, h] = col.split(':').map(Number) as [number, number]
    ;((grids.get(row) as HeatGrid)[d] as number[])[h] = count
  }
  cached = grids
  cachedPlatform = platform
}

/** The stored grid of one school (all zero for a school without answers). */
export function kaHeatOfSchool(schoolId: number): HeatGrid {
  if (!cached) build()
  return copy((cached as Map<number, HeatGrid>).get(schoolId) ?? blank())
}

/** The platform grid (every school). */
export function kaHeatPlatform(): HeatGrid {
  if (!cachedPlatform) build()
  return copy(cachedPlatform as HeatGrid)
}

/** Sum of the grids of `schoolIds`. */
export function kaHeat(schoolIds: readonly number[] | null): HeatGrid {
  if (schoolIds === null) return kaHeatPlatform()
  const out = blank()
  for (const id of schoolIds) {
    const g = kaHeatOfSchool(id)
    for (let d = 0; d < HEAT_DAYS; d++)
      for (let h = 0; h < HEAT_HOURS; h++) (out[d] as number[])[h]! += (g[d] as number[])[h]!
  }
  return out
}
