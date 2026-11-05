/**
 * The shared point-scheme engine (45 section 7.0): reachable points and the group, pair, cap, bonus, `countMarks` and alternative logic.
 * Pure: no database, no clock. Imported by the publish gate (best reachable marks) and by grading (marks of the hit points), so the two
 * can never disagree on what a group or a cap means. No imports on purpose (the gate and grading import each other's neighbours).
 */

export interface SchemePoint {
  id: string
  label?: string
  marks: number
  requires?: readonly string[]
  ecf?: { fromPart: string }
}
export interface SchemeGroup {
  id: string
  pointIds: readonly string[]
  type?: 'pair'
  anyN?: number
  eachMarks?: number
  cap?: number
}
export interface SchemeDeduction {
  code: string
  amount: number
  cap?: number
  scope?: 'question' | 'part'
}
/** A key as the engine reads it: v1 (`scheme_v` absent) or v2 (`scheme_v: 2`). Other kinds only carry `kind`. */
export interface SchemeKeyLike {
  kind: string
  scheme_v?: number
  marks?: number
  points?: readonly SchemePoint[]
  groups?: readonly SchemeGroup[]
  paths?: readonly { id: string; pointIds: readonly string[] }[]
  alternatives?: readonly { id: string; pointIds: readonly string[] }[]
  bonus?: { marks: number }
  countMarks?: { items: number; marks: readonly number[] }
  deductions?: readonly SchemeDeduction[]
  scoring?: 'overall' | 'perCriterion'
  criteria?: readonly { id: string; max?: number }[]
  bands?: readonly { range: readonly [number, number] }[]
  floorBand?: { range: readonly [number, number] }
  contentPoints?: { points?: readonly SchemePoint[] }
}

/**
 * Ids reachable inside the point set: a point is reachable only when every `requires` id is reachable (least fixpoint, so a cycle is
 * unreachable). With `live` (grading) a point must also be hit; without it (the gate) every point can be hit.
 */
export function reachableIds(points: readonly SchemePoint[], live?: (id: string) => boolean): Set<string> {
  const ok = new Set<string>()
  for (let changed = true; changed; ) {
    changed = false
    for (const p of points) {
      if (!ok.has(p.id) && (live === undefined || live(p.id)) && (p.requires ?? []).every((r) => ok.has(r))) {
        ok.add(p.id)
        changed = true
      }
    }
  }
  return ok
}

/**
 * One alternative of a v2 points key (45 7.0 steps 2 to 5). `ids` is the point set it holds.
 * Without `live` this is the best reachable total of the gate (every point hit, an `anyN` group keeps its N highest units, `countMarks`
 * its highest value). With `live` (grading, S1-T09a part 5) it is the total of the hit points: an `anyN` group keeps its first N hit
 * units in key order and `countMarks` is indexed by the number of hit points. The group, pair, cap and bonus logic is this one code path.
 */
function alternativeTotal(key: SchemeKeyLike, ids: ReadonlySet<string>, live?: (id: string) => boolean): number {
  const points = (key.points ?? []).filter((p) => ids.has(p.id))
  const ok = reachableIds(points, live)
  const marksOf = new Map(points.map((p) => [p.id, p.marks]))
  const used = new Set<string>()
  let sum = 0
  for (const g of key.groups ?? []) {
    const members = g.pointIds.filter((id) => ids.has(id) && !used.has(id))
    members.forEach((id) => used.add(id))
    // Units: a plain group counts each reachable member; a pair group counts consecutive (first, second) pairs, the second only with the first.
    const units: number[] = []
    const mark = (id: string): number => g.eachMarks ?? marksOf.get(id) ?? 0
    if (g.type === 'pair') {
      for (let i = 0; i < members.length; i += 2) {
        const first = members[i]!
        const second = members[i + 1]
        if (!ok.has(first)) continue
        units.push(mark(first) + (second !== undefined && ok.has(second) ? mark(second) : 0))
      }
    } else {
      for (const id of members) if (ok.has(id)) units.push(mark(id))
    }
    if (live === undefined) units.sort((x, y) => y - x)
    const taken = g.anyN === undefined ? units : units.slice(0, g.anyN)
    const total = taken.reduce((s, x) => s + x, 0)
    sum += g.cap === undefined ? total : Math.min(total, g.cap)
  }
  for (const p of points) if (!used.has(p.id) && ok.has(p.id)) sum += p.marks
  if (key.countMarks) {
    // marks[0] is the mark for `items` correct, marks[1] for items - 1, ..., the last for none.
    sum = live === undefined ? Math.max(0, ...key.countMarks.marks) : (key.countMarks.marks[Math.max(0, key.countMarks.items - ok.size)] ?? 0)
  }
  if (key.bonus && points.every((p) => ok.has(p.id))) sum += key.bonus.marks
  return sum
}

/**
 * The total of a v2 points key before deductions and the leaf-marks cap: the best single alternative (`alternatives`; none = one alternative
 * holding every point). `live` absent = best reachable (the gate); present = the marks of the hit points (grading).
 */
export function schemeTotal(key: SchemeKeyLike, live?: (id: string) => boolean): number {
  const all = new Set((key.points ?? []).map((p) => p.id))
  if (!key.alternatives || key.alternatives.length === 0) return alternativeTotal(key, all, live)
  return Math.max(0, ...key.alternatives.map((a) => alternativeTotal(key, new Set(a.pointIds), live)))
}
