/**
 * The distribution of the `questions` dataset (SRS v1.11 §6.13.1): N 466,041 = 465,278 objective
 * rows + 763 PKSK rows, built so that every §4.1 named query holds at once.
 *
 * Order of construction (each step carves rows from the previous cells; totals never change):
 *  1. Layer 1/2 — Table A (active; the M17 S10 matrix + the `coverageExcluded` rows) and Table B
 *     (inactive) by subject × level, plus the 9 level-less Matematik rows.
 *  2. Status — Pendidikan Moral archived-active rows (D5–T3); approved-inactive rows per subject
 *     (Q-APPROVED(subject) − Q-ELIGIBLE(subject)) spread over the Table B levels; the rest archived.
 *  3. SPM pool — the M06 §6.10 cells (subject × T4/T5 × difficulty), `spmPool = true`.
 *  4. Darjah 1–4 — chapter × difficulty per (subject, level): difficulty per M05 `difficultyByLevel`,
 *     Darjah 1 chapters as observed, Darjah 2–4 chapters an even split (PROPOSED); `fit2d` keeps
 *     room for the M05 anchors.
 *  5. `coverageExcluded` rows (BR-M04-38): per subject × level as observed, difficulty 1–3 only
 *     (Σ 473 / 731 / 542; per subject observed for Prinsip Perakaunan, Matematik and Geografi, the
 *     rest by fit, PROPOSED). Where a subject's S10 cell is below its pool, the excluded rows are
 *     pool rows.
 *  6. Covered active rows — per subject, difficulty by `fit2d` so that the covered rows equal the
 *     S10 difficulty tile, with the M10 anchor minimums (PROPOSED per cell).
 *  7. Inactive rows — difficulty 1 = 6,245, 2–5 even (PROPOSED per cell).
 *  8. Reservations — every documented anchor gets a locked row of its exact facet tuple: M04's own
 *     anchors, the M05 practice anchors (§6.15 there), the M08 Sejarah T4 (pool) and SP rows, the
 *     M10 teacher anchors (522425–522447, 525428–525433, 700302).
 *  9. Teacher databank (Bahasa Melayu 6,048), user 1 (16,817, Q-CONTRIB), teacher contributions
 *     (Q-TEACHER-CONTRIB 10,131 objective rows), named SPs.
 * 10. Secondary facets — needsDiagram, compliance, source, missing source file, untagged, scored
 *     rows (Table C), baik bucket, legacy rows, aiVerified.
 * 11. PKSK family — 15 domains × T1/T4 × difficulty (253/253/191/66), all approved and active.
 *
 * **D9 notes (listed for the M04 deviation table):**
 * - SP 418 (Sejarah T5) has no eligible non-pool row (Sejarah T5 = pool 762 = Table A 762), and the
 *   Bahasa Melayu T4 SPs need 114 rows where BM T4 has 52 non-pool rows: SP rows take non-pool rows
 *   first, then eligible **pool** rows of the same pair; pool counts are unchanged.
 * - The two quarantined anchors 129114/129216 are "Source: TIADA" (sourceType null) although null
 *   was specified as exactly the compliance-draft rows: null = 27,652 + 2; textbook absorbs −2.
 * - Teacher databank MCQ difficulty 3 = 950, but the S10 Bahasa Melayu tile leaves only 911
 *   difficulty-3 rows in BM D5–T5 non-pool cells (2,880 − 1,727 D1–D4 − 242 pool): the other 39
 *   databank rows are BM T4/T5 pool rows (pool counts unchanged).
 *
 * The builder is pure and deterministic; its result is memoised (the dataset reads it for
 * `specHash`, `feasibility` and `compile`).
 */

import { fit2d, split, type CellSpec } from '@/mock/dataset'

import { M04_ANCHORS, objectiveFacets, OTHER_CREATOR } from '../data/anchors'
import {
  APPROVED_BY_SUBJECT,
  BAIK_BY_SUBJECT,
  COMPLIANCE_TOTALS,
  COVERAGE_EXCLUDED,
  COVERAGE_EXCLUDED_DIFFICULTY,
  COVERAGE_EXCLUDED_DIFFICULTY_TOTAL,
  genericSpId,
  INACTIVE_DIFFICULTY_1,
  LEVELS,
  MISSING_SOURCE_TOTAL,
  NAMED_SPS,
  NEEDS_DIAGRAM,
  NEEDS_DIAGRAM_OTHER_SUBJECTS,
  NEEDS_DIAGRAM_OTHERS_TOTAL,
  NULL_LEVEL_ACTIVE,
  PKSK_DIFFICULTY,
  PKSK_DOMAINS,
  PM_ARCHIVED_ACTIVE,
  PRACTICE_LEVELS,
  S10_DIFFICULTY,
  SOURCE_TOTALS,
  SPM_POOL,
  TABLE_A,
  TABLE_B,
  TABLE_C,
  TEACHER_CONTRIB,
  TEACHER_DATABANK,
  UNTAGGED_TOTAL,
  USER1_BY_SUBJECT,
  USER1_OTHERS_TOTAL,
} from '../data/tables'
import type { QuestionFacets, QuestionType } from '../repository/types'
import { CellBuilder, type CellPred } from './cell-builder'
import { QUESTION_FACETS } from './question-row'

type F = QuestionFacets

// ---------------------------------------------------------------------------------------------
// Documented anchor reservations of other modules (so their rows always find their cell)
// ---------------------------------------------------------------------------------------------

/** M05 §6.15: anchors per (subject, level, chapter); difficulty of the k-th = ((k − 1) mod 4) + 1. */
export const M05_ANCHOR_GROUPS: readonly {
  ids: readonly [number, number]
  subjectId: number
  levelId: number
  chapterId: number
}[] = [
  { ids: [600001, 600018], subjectId: 1, levelId: 1, chapterId: 35 },
  { ids: [600019, 600023], subjectId: 1, levelId: 1, chapterId: 36 },
  { ids: [600024, 600033], subjectId: 1, levelId: 1, chapterId: 2 },
  { ids: [600034, 600035], subjectId: 1, levelId: 2, chapterId: 4 },
  { ids: [600036, 600055], subjectId: 3, levelId: 1, chapterId: 1 },
  { ids: [600056, 600060], subjectId: 3, levelId: 1, chapterId: 143 },
  { ids: [600061, 600065], subjectId: 3, levelId: 1, chapterId: 136 },
]

/** Difficulty of the M05 anchor `id` (M05 §6.15 rule). */
export function m05AnchorDifficulty(id: number): number | null {
  for (const g of M05_ANCHOR_GROUPS) {
    if (id >= g.ids[0] && id <= g.ids[1]) return ((id - g.ids[0]) % 4) + 1
  }
  return null
}

/** M05 anchor needs per (subject, level, chapter, difficulty). */
function m05Needs(): Map<string, number> {
  const out = new Map<string, number>()
  for (const g of M05_ANCHOR_GROUPS) {
    for (let id = g.ids[0]; id <= g.ids[1]; id++) {
      const d = m05AnchorDifficulty(id) as number
      const k = `${String(g.subjectId)}:${String(g.levelId)}:${String(g.chapterId)}:${String(d)}`
      out.set(k, (out.get(k) ?? 0) + 1)
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// Predicates and small helpers
// ---------------------------------------------------------------------------------------------

const objective: CellPred<F> = (f) => f.pkskDomainId === null
const eligible: CellPred<F> = (f) =>
  f.pkskDomainId === null && f.status === 'approved' && f.isActive
const at =
  (s: number, l: number | null): CellPred<F> =>
  (f) =>
    f.subjectId === s && f.educationLevelId === l && f.pkskDomainId === null
const and =
  (...preds: CellPred<F>[]): CellPred<F> =>
  (f) =>
    preds.every((p) => p(f))
const archivedInactive: CellPred<F> = (f) =>
  f.pkskDomainId === null && f.status === 'archived' && !f.isActive
const inactivePriority = (f: Readonly<F>): number =>
  f.isActive ? 2 : f.status === 'archived' ? 0 : 1
const isGenericSp = (f: Readonly<F>) =>
  f.educationLevelId !== null && f.dskpSpId === genericSpId(f.subjectId ?? 0, f.educationLevelId)

function row11(table: Readonly<Record<number, readonly (number | null)[]>>, s: number, l: number) {
  return table[s]?.[l - 1] ?? 0
}

function subjectIds(table: Readonly<Record<number, unknown>>): number[] {
  return Object.keys(table)
    .map(Number)
    .sort((a, b) => a - b)
}

/** Pool rows of (subject, level, difficulty) (M06 §6.10). */
function poolOf(s: number, l: number, d: number): number {
  const p = SPM_POOL[s]
  if (!p || (l !== 10 && l !== 11) || d < 1 || d > 4) return 0
  return (l === 10 ? p[0] : p[1])[d - 1] ?? 0
}
const poolTotal = (s: number, l: number) => [1, 2, 3, 4].reduce((a, d) => a + poolOf(s, l, d), 0)

/** Q-ELIGIBLE(subject) from Table A (+ the level-less rows, − the PM archived-active rows). */
export function eligibleOf(s: number): number {
  let n = 0
  for (const l of LEVELS) n += row11(TABLE_A, s, l)
  if (s === NULL_LEVEL_ACTIVE.subjectId) n += NULL_LEVEL_ACTIVE.count
  if (s === 7) n -= Object.values(PM_ARCHIVED_ACTIVE).reduce((a, b) => a + b, 0)
  return n
}

/** User-1 rows per subject: the observed split plus "others 763" by Q-ELIGIBLE (PROPOSED). */
export function user1BySubject(): Map<number, number> {
  const out = new Map<number, number>()
  for (const [s, n] of Object.entries(USER1_BY_SUBJECT)) out.set(Number(s), n)
  const others = subjectIds(TABLE_A).filter((s) => !out.has(s) && eligibleOf(s) > 0)
  for (const [s, n] of split(
    USER1_OTHERS_TOTAL,
    others.map((s) => [s, eligibleOf(s)] as const),
  )) {
    out.set(s, n)
  }
  return out
}

/** Excluded rows of (subject, level); level `null` = the level-less rows. */
export function excludedOf(s: number, l: number | null): number {
  if (l === null) return s === NULL_LEVEL_ACTIVE.subjectId ? NULL_LEVEL_ACTIVE.count : 0
  return row11(COVERAGE_EXCLUDED, s, l)
}

/** Levels at which a subject's excluded rows must be pool rows (the S10 cell is below the pool). */
function excludedArePool(s: number, l: number): boolean {
  const e = excludedOf(s, l)
  if (e === 0 || (l !== 10 && l !== 11)) return false
  return row11(TABLE_A, s, l) - e < poolTotal(s, l)
}

/**
 * Excluded rows by difficulty 1–3 per subject: observed for 21/3/12, the others fitted to the rest
 * of 473 / 731 / 542 within the room of their levels (PROPOSED).
 */
export function excludedDifficultyBySubject(): Map<number, readonly [number, number, number]> {
  const out = new Map<number, readonly [number, number, number]>()
  for (const [s, v] of Object.entries(COVERAGE_EXCLUDED_DIFFICULTY)) out.set(Number(s), v)
  const rest = subjectIds(COVERAGE_EXCLUDED).filter((s) => !out.has(s))
  const cols = COVERAGE_EXCLUDED_DIFFICULTY_TOTAL.map((t, i) => {
    let used = 0
    for (const v of out.values()) used += v[i] as number
    return [i + 1, t - used] as const
  })
  const table = fit2d({
    label: 'questions excluded difficulty',
    rows: rest.map((s) => [s, LEVELS.reduce((a, l) => a + excludedOf(s, l), 0)] as const),
    cols,
    bounds: (s, d) => ({ min: coveredDeficit(s, d), max: excludedRoom(s, d) }),
  })
  for (const s of rest) {
    const v: [number, number, number] = [0, 0, 0]
    for (const c of table) if (c.row === s) v[c.col - 1] = c.count
    out.set(s, v)
  }
  return out
}

/**
 * Covered-row deficit of subject `s` at difficulty `d`: the D1–D4 pins plus the pool pins exceed
 * the S10 tile, so at least this many excluded rows must be D1–D4 or pool rows at `d` (e.g.
 * Prinsip Perakaunan difficulty 1: pool 286 > tile 240 → 46 excluded pool rows).
 */
export function coveredDeficit(s: number, d: number): number {
  const tile = S10_DIFFICULTY[s]
  if (!tile) return 0
  let base = 0
  for (const l of [1, 2, 3, 4]) base += PRACTICE_LEVELS[s]?.[l]?.difficulty[d - 1] ?? 0
  base += poolOf(s, 10, d) + poolOf(s, 11, d)
  return Math.max(0, base - (tile[d - 1] ?? 0))
}

/** Room for excluded rows of subject `s` at difficulty `d` over its excluded levels. */
function excludedRoom(s: number, d: number): number {
  let room = 0
  for (const l of LEVELS) {
    const e = excludedOf(s, l)
    if (e === 0) continue
    const pinned = PRACTICE_LEVELS[s]?.[l]
    if (pinned) room += Math.min(e, pinned.difficulty[d - 1] ?? 0)
    else if (excludedArePool(s, l)) room += Math.min(e, poolOf(s, l, d))
    else room += e
  }
  return room + (s === NULL_LEVEL_ACTIVE.subjectId ? NULL_LEVEL_ACTIVE.count : 0)
}

// ---------------------------------------------------------------------------------------------
// The builder
// ---------------------------------------------------------------------------------------------

export interface QuestionSpec {
  cells: CellSpec<F>[]
  /** Cell keys that hold a reservation (anchor cells); `contributeCells` never shrinks them. */
  reserved: ReadonlySet<string>
}

function baseFacets(s: number, l: number | null, active: boolean): F {
  return objectiveFacets(s, l, {
    status: active ? 'approved' : 'archived',
    isActive: active,
    difficultyLevel: 0,
    dskpTagged: l !== null,
  })
}

/** Takes rows of one group with difficulty 0 and gives them the fitted difficulties. */
function assignDifficulty(
  b: CellBuilder<F>,
  pred: CellPred<F>,
  cells: readonly { col: number; count: number }[],
): void {
  for (const c of cells) {
    if (c.count > 0)
      b.take(
        and(pred, (f) => f.difficultyLevel === 0),
        c.count,
        { difficultyLevel: c.col },
        { inOrder: true },
      )
  }
}

function buildObjective(b: CellBuilder<F>): void {
  // 1. Layers 1/2.
  for (const s of subjectIds(TABLE_A)) {
    for (const l of LEVELS) b.add(baseFacets(s, l, true), row11(TABLE_A, s, l))
  }
  b.add(
    { ...baseFacets(NULL_LEVEL_ACTIVE.subjectId, null, true), coverageExcluded: true },
    NULL_LEVEL_ACTIVE.count,
  )
  for (const s of subjectIds(TABLE_B)) {
    for (const l of LEVELS) b.add(baseFacets(s, l, false), row11(TABLE_B, s, l))
  }

  // 2. Status.
  for (const [l, n] of Object.entries(PM_ARCHIVED_ACTIVE)) {
    b.take(
      and(at(7, Number(l)), (f) => f.isActive),
      n,
      { status: 'archived' },
    )
  }
  for (const s of subjectIds(TABLE_B)) {
    const approvedInactive = (APPROVED_BY_SUBJECT[s] ?? 0) - eligibleOf(s)
    if (approvedInactive < 0)
      throw new Error(`questions spec: subject ${String(s)} approved < eligible`)
    const perLevel = split(
      approvedInactive,
      LEVELS.map((l) => [l, row11(TABLE_B, s, l)] as const),
    )
    for (const [l, n] of perLevel) {
      b.take(
        and(at(s, l), (f) => !f.isActive),
        n,
        { status: 'approved' },
      )
    }
  }

  // 3. SPM pool (M06 §6.10).
  for (const s of subjectIds(SPM_POOL)) {
    for (const l of [10, 11]) {
      for (const d of [1, 2, 3, 4]) {
        b.take(
          and(at(s, l), eligible, (f) => !f.spmPool),
          poolOf(s, l, d),
          { spmPool: true, difficultyLevel: d },
          { inOrder: true },
        )
      }
    }
  }

  // 4. Darjah 1–4: chapter × difficulty (M05).
  const needs = m05Needs()
  for (const s of subjectIds(PRACTICE_LEVELS)) {
    const byLevel = PRACTICE_LEVELS[s] ?? {}
    for (const l of [1, 2, 3, 4]) {
      const data = byLevel[l]
      if (!data) continue
      const cell = b.cells.find((c) => c.lock === null && at(s, l)(c.f) && eligible(c.f))
      if (!cell) throw new Error(`questions spec: no D${String(l)} cell for subject ${String(s)}`)
      const total = cell.n
      const observed = data.chapters.every(([, n]) => n !== null)
      const chapterTotals = observed
        ? data.chapters.map(([id, n]) => [id, n as number] as const)
        : split(
            total,
            data.chapters.map(([id]) => [id, 1] as const),
          )
      const table = fit2d({
        label: `questions D${String(l)} subject ${String(s)}`,
        rows: chapterTotals,
        cols: data.difficulty.map((n, i) => [i + 1, n] as const),
        bounds: (ch, d) => {
          const need = needs.get(`${String(s)}:${String(l)}:${String(ch)}:${String(d)}`)
          return need ? { min: need } : undefined
        },
      })
      b.replace(
        cell,
        table.map((c) => ({
          patch: { curriculumChapterId: c.row, difficultyLevel: c.col },
          n: c.count,
        })),
      )
    }
  }

  // 5. coverageExcluded rows (BR-M04-38). Groups per level: D1–D4 rows (pinned), pool rows
  //    (forced where the S10 cell is below the pool, or needed to cover a deficit), other rows.
  const excludedDiff = excludedDifficultyBySubject()
  for (const s of subjectIds(COVERAGE_EXCLUDED)) {
    const byD = excludedDiff.get(s) ?? [0, 0, 0]
    const levels = LEVELS.filter((l) => excludedOf(s, l) > 0)
    const poolCapable = (l: number) => (l === 10 || l === 11) && poolTotal(s, l) > 0
    type Group = { key: string; l: number; kind: 'pinned' | 'pool' | 'free' | 'null'; n: number }
    const groups = new Map<string, Group>()
    const minOf = new Map<string, number>()
    const add = (key: string, l: number, kind: Group['kind'], n: number) => {
      const g = groups.get(key)
      if (g) g.n += n
      else groups.set(key, { key, l, kind, n })
    }
    // Deficits first: forced pool levels, then pool-capable levels, then D1–D4 levels.
    const left = new Map(levels.map((l) => [l, excludedOf(s, l)]))
    for (const d of [1, 2, 3]) {
      let need = coveredDeficit(s, d)
      const order = [
        ...levels.filter((l) => excludedArePool(s, l)),
        ...levels.filter((l) => !excludedArePool(s, l) && poolCapable(l)),
        ...levels.filter((l) => PRACTICE_LEVELS[s]?.[l] !== undefined),
      ]
      for (const l of order) {
        if (need === 0) break
        const pinned = PRACTICE_LEVELS[s]?.[l]
        const cap = pinned ? (pinned.difficulty[d - 1] ?? 0) : poolOf(s, l, d)
        const key = pinned ? String(l) : `${String(l)}:pool`
        const t = Math.min(need, cap - (minOf.get(`${key}|${String(d)}`) ?? 0), left.get(l) ?? 0)
        if (t <= 0) continue
        minOf.set(`${key}|${String(d)}`, (minOf.get(`${key}|${String(d)}`) ?? 0) + t)
        if (!pinned && !excludedArePool(s, l)) {
          add(key, l, 'pool', t)
          left.set(l, (left.get(l) ?? 0) - t)
        }
        need -= t
      }
      if (need > 0)
        throw new Error(
          `questions spec: subject ${String(s)} difficulty ${String(d)} deficit not covered`,
        )
    }
    for (const l of levels) {
      const rest = left.get(l) ?? 0
      if (PRACTICE_LEVELS[s]?.[l]) add(String(l), l, 'pinned', rest)
      else if (excludedArePool(s, l)) add(`${String(l)}:pool`, l, 'pool', rest)
      else if (rest > 0) add(`${String(l)}:free`, l, 'free', rest)
    }
    if (s === NULL_LEVEL_ACTIVE.subjectId) add('null', 0, 'null', NULL_LEVEL_ACTIVE.count)
    const table = fit2d({
      label: `questions excluded subject ${String(s)}`,
      rows: [...groups.values()].filter((g) => g.n > 0).map((g) => [g.key, g.n] as const),
      cols: byD.map((n, i) => [i + 1, n] as const),
      bounds: (key, d) => {
        const g = groups.get(key)
        if (!g) return undefined
        const min = minOf.get(`${key}|${String(d)}`)
        if (g.kind === 'pinned')
          return { min, max: PRACTICE_LEVELS[s]?.[g.l]?.difficulty[d - 1] ?? 0 }
        if (g.kind === 'pool') return { min, max: poolOf(s, g.l, d) }
        return undefined
      },
    })
    for (const c of table) {
      if (c.count === 0) continue
      const g = groups.get(c.row) as Group
      const l = g.l
      if (g.kind === 'null') {
        b.take((f) => at(s, null)(f) && f.coverageExcluded && f.difficultyLevel === 0, c.count, {
          difficultyLevel: c.col,
        })
      } else if (g.kind === 'pinned') {
        b.take(
          and(at(s, l), eligible, (f) => f.difficultyLevel === c.col && !f.coverageExcluded),
          c.count,
          { coverageExcluded: true },
        )
      } else if (g.kind === 'pool') {
        b.take(
          and(
            at(s, l),
            eligible,
            (f) => f.spmPool && f.difficultyLevel === c.col && !f.coverageExcluded,
          ),
          c.count,
          { coverageExcluded: true },
          { inOrder: true },
        )
      } else {
        b.take(
          and(at(s, l), eligible, (f) => !f.spmPool && f.difficultyLevel === 0),
          c.count,
          { coverageExcluded: true, difficultyLevel: c.col },
          { inOrder: true },
        )
      }
    }
  }

  // 6. Covered active rows: per subject, the S10 tile minus the pinned D1–D4 and pool rows.
  for (const s of subjectIds(TABLE_A)) {
    const tile = S10_DIFFICULTY[s]
    const covered = (f: Readonly<F>) =>
      f.subjectId === s && f.pkskDomainId === null && f.isActive && !f.coverageExcluded
    const pinned = [0, 0, 0, 0]
    const groups = new Map<string, { l: number; status: string; n: number }>()
    for (const c of b.cells) {
      if (!covered(c.f)) continue
      if (c.f.difficultyLevel > 0)
        pinned[c.f.difficultyLevel - 1] = (pinned[c.f.difficultyLevel - 1] ?? 0) + c.n
      else {
        const k = `${String(c.f.educationLevelId)}:${c.f.status}`
        const g = groups.get(k)
        if (g) g.n += c.n
        else groups.set(k, { l: c.f.educationLevelId as number, status: c.f.status, n: c.n })
      }
    }
    if (groups.size === 0) continue
    if (!tile)
      throw new Error(`questions spec: subject ${String(s)} has covered rows but no S10 tile`)
    const cols = tile.map((t, i) => [i + 1, t - (pinned[i] ?? 0)] as const)
    const fit = fit2d({
      label: `questions covered difficulty subject ${String(s)}`,
      rows: [...groups.entries()].map(([k, g]) => [k, g.n] as const),
      cols,
      bounds: (k, d) => {
        const g = groups.get(k)
        if (!g || s !== 1 || g.status !== 'approved') return undefined
        // M10 teacher anchors (§6.13.2): D6 × 23 at difficulty 4, T1 × 3 at 1, T3 × 3 at 3,
        // T5 × 1 (700302) at 2.
        const min =
          (g.l === 6 && d === 4 ? 23 : 0) +
          (g.l === 7 && d === 1 ? 3 : 0) +
          (g.l === 9 && d === 3 ? 3 : 0) +
          (g.l === 11 && d === 2 ? 1 : 0)
        return min > 0 ? { min } : undefined
      },
    })
    for (const [k, g] of groups) {
      assignDifficulty(
        b,
        (f) => covered(f) && f.educationLevelId === g.l && f.status === g.status,
        fit.filter((c) => c.row === k),
      )
    }
  }

  // 7. Inactive rows: difficulty 1 = 6,245, 2–5 even.
  const inactiveGroups = new Map<string, { s: number; l: number; status: string; n: number }>()
  for (const c of b.cells) {
    if (c.f.isActive || c.f.difficultyLevel !== 0) continue
    const k = `${String(c.f.subjectId)}:${String(c.f.educationLevelId)}:${c.f.status}`
    const g = inactiveGroups.get(k)
    if (g) g.n += c.n
    else
      inactiveGroups.set(k, {
        s: c.f.subjectId as number,
        l: c.f.educationLevelId as number,
        status: c.f.status,
        n: c.n,
      })
  }
  const inactiveTotal = [...inactiveGroups.values()].reduce((a, g) => a + g.n, 0)
  const even = split(inactiveTotal - INACTIVE_DIFFICULTY_1, [
    [2, 1],
    [3, 1],
    [4, 1],
    [5, 1],
  ] as const)
  const inactiveFit = fit2d({
    label: 'questions inactive difficulty',
    rows: [...inactiveGroups.entries()].map(([k, g]) => [k, g.n] as const),
    cols: [[1, INACTIVE_DIFFICULTY_1] as const, ...even],
    bounds: (k, d) => {
      const g = inactiveGroups.get(k)
      if (!g || g.s !== 3 || g.l !== 11) return undefined
      // Anchors 129114/129216 (archived, d1) and 136891 (approved-inactive, d2); 124733 below.
      if (g.status === 'archived' && d === 1) return { min: 2 }
      if (g.status === 'approved' && d === 2) return { min: 1 }
      return undefined
    },
  })
  for (const [k, g] of inactiveGroups) {
    assignDifficulty(
      b,
      (f) =>
        !f.isActive && f.subjectId === g.s && f.educationLevelId === g.l && f.status === g.status,
      inactiveFit.filter((c) => c.row === k),
    )
  }

  // 8. Reservations. The host of an anchor has its primary facets; the patch sets the rest.
  const reserveTuple = (tuple: F, n: number, lock: string) => {
    b.reserve(
      (f) =>
        f.subjectId === tuple.subjectId &&
        f.educationLevelId === tuple.educationLevelId &&
        f.pkskDomainId === null &&
        f.status === tuple.status &&
        f.isActive === tuple.isActive &&
        f.questionType === 'mcq' &&
        f.spmPool === tuple.spmPool &&
        f.difficultyLevel === tuple.difficultyLevel &&
        f.curriculumChapterId === tuple.curriculumChapterId &&
        f.coverageExcluded === tuple.coverageExcluded &&
        f.createdBy === OTHER_CREATOR &&
        f.contribSchoolId === null &&
        !f.teacherDatabank,
      n,
      tuple,
      lock,
    )
  }
  // M04 own anchors (literal tuples).
  for (const a of M04_ANCHORS) reserveTuple(a.facets, 1, `m04:${String(a.id)}`)
  // M05 practice anchors: untagged, verified textbook (M05 §6.15).
  for (const [k, n] of needs) {
    const [s, l, ch, d] = k.split(':').map(Number) as [number, number, number, number]
    reserveTuple(
      objectiveFacets(s, l, { difficultyLevel: d, curriculumChapterId: ch, dskpTagged: false }),
      n,
      'm05',
    )
  }
  // M08: Sejarah T4 × 15 pool rows at difficulty 2, untagged (XL3-11); Kimia T5 SP rows 9001–9004.
  reserveTuple(
    objectiveFacets(5, 10, { spmPool: true, difficultyLevel: 2, dskpTagged: false }),
    15,
    'm08',
  )
  for (const sp of NAMED_SPS.filter((x) => x.subjectId === 10)) {
    let need = sp.count
    while (need > 0) {
      const host = b.cells.find(
        (c) =>
          c.lock === null &&
          at(10, 11)(c.f) &&
          eligible(c.f) &&
          !c.f.spmPool &&
          !c.f.coverageExcluded &&
          c.n > 0,
      )
      if (!host) throw new Error(`questions spec: no room for SP ${String(sp.sp)}`)
      const t = Math.min(need, host.n)
      reserveTuple(
        objectiveFacets(10, 11, { difficultyLevel: host.f.difficultyLevel, dskpSpId: sp.sp }),
        t,
        'm08',
      )
      need -= t
    }
  }
  // M10 teacher anchors (§6.13.2).
  reserveTuple(objectiveFacets(1, 11, { difficultyLevel: 2, createdBy: 5 }), 1, 'm10:700302')
  const bmNonPool = (l: number, d: number): CellPred<F> =>
    and(
      at(1, l),
      eligible,
      (f) => !f.spmPool && f.difficultyLevel === d && f.questionType === 'mcq',
    )
  b.take(
    bmNonPool(6, 4),
    23,
    { teacherDatabank: true, createdBy: 1 },
    { lock: 'm10:522425', inOrder: true },
  )
  b.take(bmNonPool(7, 1), 3, { teacherDatabank: true }, { lock: 'm10:525431', inOrder: true })
  b.take(bmNonPool(9, 3), 3, { teacherDatabank: true }, { lock: 'm10:525428', inOrder: true })

  // 9a. Teacher databank (Bahasa Melayu D5–T5 eligible non-pool; M10 S28). Difficulty 3: every
  //     non-pool row, then BM T4/T5 pool rows (D9 note).
  const bmD5T5 = new Set([5, 6, 7, 8, 9, 10, 11])
  const bmBank = (f: Readonly<F>) =>
    f.subjectId === 1 &&
    f.educationLevelId !== null &&
    bmD5T5.has(f.educationLevelId) &&
    eligible(f) &&
    !f.spmPool
  b.takeTo(
    (f) =>
      f.subjectId === 1 &&
      f.educationLevelId !== null &&
      bmD5T5.has(f.educationLevelId) &&
      eligible(f) &&
      f.difficultyLevel === 3 &&
      f.questionType === 'mcq',
    TEACHER_DATABANK.mcqDifficulty3,
    { teacherDatabank: true },
    { priority: (f) => (f.spmPool ? 1 : 0), inOrder: true },
  )
  for (const [type, n] of Object.entries(TEACHER_DATABANK.nonMcq)) {
    b.take(
      (f) =>
        bmBank(f) &&
        (f.educationLevelId as number) >= 7 &&
        f.difficultyLevel !== 3 &&
        !f.teacherDatabank &&
        f.questionType === 'mcq',
      n,
      { teacherDatabank: true, questionType: type as QuestionType },
      { mode: 'spread' },
    )
  }
  b.takeTo(
    (f) => bmBank(f) && f.questionType === 'mcq' && f.difficultyLevel !== 3,
    TEACHER_DATABANK.mcq - TEACHER_DATABANK.mcqDifficulty3,
    { teacherDatabank: true },
    { mode: 'spread' },
  )

  // 9b. User 1 (Q-CONTRIB(1)): approved, active rows per subject.
  for (const [s, n] of user1BySubject()) {
    b.takeTo(
      (f) =>
        f.subjectId === s && eligible(f) && (f.createdBy === 1 || f.createdBy === OTHER_CREATOR),
      n,
      { createdBy: 1 },
      { mode: 'spread' },
    )
  }

  // 9c. Teacher contributions (Q-TEACHER-CONTRIB, objective part): eligible generated rows outside
  //     the databank and user 1 (placement PROPOSED).
  for (const t of TEACHER_CONTRIB) {
    b.take(
      (f) =>
        eligible(f) &&
        f.createdBy === OTHER_CREATOR &&
        f.contribSchoolId === null &&
        !f.teacherDatabank,
      t.mcq,
      t.teacherId === null
        ? { contribSchoolId: t.schoolId }
        : { contribSchoolId: t.schoolId, createdBy: t.teacherId },
    )
  }

  // 9d. Named SPs (Q-SP-AVAILABLE); 9001–9004 are reserved above for M08. Non-pool rows first.
  for (const sp of NAMED_SPS) {
    if (sp.subjectId === 10) continue
    b.take(
      and(at(sp.subjectId, sp.levelId), eligible, (f) => isGenericSp(f)),
      sp.count,
      { dskpSpId: sp.sp },
      { priority: (f) => (f.spmPool ? 1 : 0), inOrder: true },
    )
  }

  // 10. Secondary facets (placement PROPOSED; locked anchor rows count towards every total).
  for (const [s, n] of neededDiagramBySubject()) {
    b.takeTo(
      (f) => f.subjectId === s && objective(f),
      n,
      { needsDiagram: true },
      {
        priority: inactivePriority,
      },
    )
  }
  b.takeTo(archivedInactive, COMPLIANCE_TOTALS.quarantined, { complianceStatus: 'quarantined' })
  b.takeTo(
    (f) =>
      objective(f) &&
      (f.complianceStatus === 'verified' || f.complianceStatus === 'pending_mapping'),
    COMPLIANCE_TOTALS.pending_mapping,
    { complianceStatus: 'pending_mapping' },
    { priority: inactivePriority },
  )
  b.takeTo(
    (f) => objective(f) && (f.complianceStatus === 'verified' || f.complianceStatus === 'draft'),
    COMPLIANCE_TOTALS.draft,
    { complianceStatus: 'draft' },
    { priority: inactivePriority },
  )
  b.patchAll((f) => objective(f) && f.complianceStatus === 'draft', {
    sourceType: null,
    hasSourceFile: false,
  })
  b.takeTo(
    (f) => objective(f) && (f.sourceType === 'textbook' || !f.hasSourceFile),
    MISSING_SOURCE_TOTAL,
    { hasSourceFile: false },
    { priority: inactivePriority },
  )
  for (const source of ['trial', 'dskp', 'marking_scheme'] as const) {
    b.takeTo(
      (f) => objective(f) && (f.sourceType === 'textbook' || f.sourceType === source),
      SOURCE_TOTALS[source],
      { sourceType: source },
      { priority: inactivePriority },
    )
  }
  // Untagged rows: named-SP rows keep their SP (Q-SP-AVAILABLE); only generic-SP rows are untagged.
  b.takeTo(
    (f) => objective(f) && (!f.dskpTagged || isGenericSp(f)),
    UNTAGGED_TOTAL,
    { dskpTagged: false, dskpSpId: null },
    { priority: inactivePriority },
  )
  // Scored rows (Table C), then baik, then legacy.
  for (const s of subjectIds(TABLE_C)) {
    for (const l of LEVELS) {
      const target = row11(TABLE_C, s, l)
      if (target === 0) continue
      const current = b.count((f) => at(s, l)(f) && f.qualityBucket !== 'unscored')
      b.take(
        (f) => at(s, l)(f) && f.qualityBucket === 'unscored',
        target - current,
        { qualityBucket: 'cemerlang' },
        { priority: inactivePriority },
      )
    }
  }
  for (const [s, n] of Object.entries(BAIK_BY_SUBJECT)) {
    b.takeTo(
      (f) =>
        f.subjectId === Number(s) &&
        objective(f) &&
        (f.qualityBucket === 'cemerlang' || f.qualityBucket === 'baik'),
      n,
      { qualityBucket: 'baik' },
    )
  }
  b.takeTo(
    (f) =>
      objective(f) &&
      (f.qualityBucket === 'cemerlang' || f.qualityBucket === 'baik') &&
      (f.sourceType === 'textbook' || f.legacyGeneric),
    SOURCE_TOTALS.ai_generated,
    { sourceType: 'ai_generated', legacyGeneric: true },
    { priority: inactivePriority },
  )
  // aiVerified: the verified SPM-pool rows of Sains (the observed "AI Verified" samples; PROPOSED).
  b.patchAll((f) => f.subjectId === 4 && f.spmPool && f.complianceStatus === 'verified', {
    aiVerified: true,
  })
}

/** needsDiagram targets per subject (top-10 observed + BA 5 + 167 spread evenly, PROPOSED). */
export function neededDiagramBySubject(): Map<number, number> {
  const out = new Map<number, number>()
  for (const [s, n] of Object.entries(NEEDS_DIAGRAM)) out.set(Number(s), n)
  for (const [s, n] of split(
    NEEDS_DIAGRAM_OTHERS_TOTAL,
    NEEDS_DIAGRAM_OTHER_SUBJECTS.map((s) => [s, 1] as const),
  )) {
    out.set(s, (out.get(s) ?? 0) + n)
  }
  return out
}

/** The PKSK facet tuple of a (domain, level, difficulty). */
export function pkskFacets(domainId: number, level: 'T1' | 'T4', difficulty: number): F {
  const bahagian = PKSK_DOMAINS[domainId]?.[0] ?? 'B'
  return {
    subjectId: null,
    educationLevelId: null,
    pkskDomainId: domainId,
    pkskTargetLevel: level,
    status: 'approved',
    isActive: true,
    questionType: bahagian === 'C' ? 'essay' : 'mcq',
    spmPool: false,
    difficultyLevel: difficulty,
    complianceStatus: 'verified',
    aiVerified: false,
    sourceType: null,
    hasSourceFile: false,
    dskpTagged: false,
    dskpSpId: null,
    needsDiagram: false,
    qualityBucket: 'unscored',
    legacyGeneric: false,
    curriculumChapterId: null,
    createdBy: OTHER_CREATOR,
    teacherDatabank: false,
    coverageExcluded: false,
    contribSchoolId: null,
  }
}

/** Observed PKSK anchor difficulties (M07 §6.8) that the default cells must hold. */
const PKSK_ANCHOR_MIN: Readonly<Record<string, number>> = {
  '7:T4:3': 1, // 178460
  '1:T1:2': 1, // 178359
  '14:T4:2': 1, // 178174
  '4:T1:2': 1, // 177919
  '14:T4:3': 1, // 178175
}

/** Default PKSK cells: domain × level totals × difficulty 253/253/191/66 (fit2d, PROPOSED split). */
export function defaultPkskCells(): CellSpec<F>[] {
  const rows: (readonly [string, number])[] = []
  for (const [id, [, t1, t4]] of Object.entries(PKSK_DOMAINS)) {
    rows.push([`${id}:T1`, t1], [`${id}:T4`, t4])
  }
  const table = fit2d({
    label: 'questions PKSK difficulty',
    rows,
    cols: PKSK_DIFFICULTY.map((n, i) => [i + 1, n] as const),
    bounds: (r, d) => {
      const min = PKSK_ANCHOR_MIN[`${r}:${String(d)}`]
      return min ? { min } : undefined
    },
  })
  return table
    .filter((c) => c.count > 0)
    .map((c) => {
      const [domain, level] = c.row.split(':') as [string, 'T1' | 'T4']
      return { facets: pkskFacets(Number(domain), level, c.col), count: c.count }
    })
}

let memo: QuestionSpec | null = null

/** The memoised default spec (objective cells, then the PKSK family). */
export function questionSpec(): QuestionSpec {
  if (memo) return memo
  const b = new CellBuilder<F>(QUESTION_FACETS, 'questions spec')
  buildObjective(b)
  const reserved = new Set<string>()
  const objectiveCells = b.build()
  for (const c of b.cells) {
    if (c.lock !== null && c.n > 0) reserved.add(facetKey(c.f))
  }
  memo = { cells: [...objectiveCells, ...defaultPkskCells()], reserved }
  return memo
}

/** Cell key in the dataset's facet order. */
export function facetKey(f: Readonly<F>): string {
  let out = ''
  for (const name of QUESTION_FACETS) {
    const v = f[name]
    out += `${JSON.stringify(v === undefined ? null : v)}\u0001`
  }
  return out
}
