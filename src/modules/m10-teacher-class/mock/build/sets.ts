/**
 * Class memberships of the T4 classes and of the T5 sets of the M18 schools (SRS M10 v1.15 §6.2.1
 * A.1 "Swaps of the M18 schools", session neutrality R3-01, M02 v1.19 §6.15 C). Pure functions of
 * the people snapshot:
 *
 * - T4 card 149 = 75 pool + 38 re-homed + 21 school joiners (8765 14, 8767 5, 8772 2) + 15
 *   (3201–3215, class 516); Σ 356 memberships.
 * - The BM twins 4 / 5 / 6 and the SEJ twins 8 / 9 / 10 have the same members (58 / 53 / 54); 419
 *   has 5, school classes sc-419 5 and sc-806 1.
 * - The 8 M18 schools' in-class pupils sit in the trio (T4) and in the T5 twins "5 Bestari /
 *   Cemerlang / Dedikasi - BM / SEJ" by table A.1.
 */

import {
  M18_SCHOOL_SETS,
  PUPILS_516,
  REHOMED_IN_CLASS,
  SMALL_419,
  SMALL_SC419,
  SMALL_SC806,
  TRIO_TARGETS,
  type SchoolSets,
} from '../data/spec'
import type { People, Pupil } from './people'
import { dealQuotas, splitTotal } from './util'

/** The four T4 session holders H1–H4 (R4-01): generated pool rows, never swapped out. */
export interface T4Holders {
  /** H1: class 6/10 (4 sessions). */
  h1: number
  /** H2: class 5/9 (3 sessions). */
  h2: number
  /** H3: class 5/9 (2 sessions). */
  h3: number
  /** H4: class 5/9 (2 sessions). */
  h4: number
}

export interface SchoolPlan {
  school: number
  /** In-class pupils in layout order [T4-only][both][T5-only]. */
  classPupils: number[]
  t4Set: number[]
  t5Set: number[]
  /** Pupils in no class (never members of a T4 or T5 class). */
  noClass: number[]
  /** Answering pupils the plan expects M05 to give sessions to (8765 only). */
  answering: number[]
  /** Register pupils that join the T4 classes (the 21 joiners) / re-homed pupils in T4 classes. */
  joiners: number[]
  rehomedInT4: number[]
  /** Trio memberships by class id 4 / 5 / 6, and twin memberships by twin index 0 / 1 / 2. */
  trio: [number[], number[], number[]]
  twins: [number[], number[], number[]]
}

export interface T4Plan {
  holders: T4Holders
  /** Trio class (4 / 5 / 6) → member ids (the SEJ twin has the same). */
  trio: Record<number, number[]>
  c419: number[]
  sc419: number[]
  sc806: number[]
  c516: number[]
  schools: SchoolPlan[]
  /** All distinct T4-class members (149). */
  members: number[]
  /** Twin index → pupils in the T5 twin (BM = SEJ). */
  twins: [number[], number[], number[]]
  /** Pupils of the 8 schools (never generic T5 members). */
  schoolPupils: Set<number>
  /** The three pool pupils re-homed to filter schools (in the trio). */
  filterRehomed: number[]
  /** Pool pupils: small-class-only and trio. */
  poolSmall: number[]
  poolTrio: number[]
}

const byId = (a: Pupil, b: Pupil) => a.id - b.id

function fail(message: string): never {
  throw new Error(`M10 build (T4/T5 sets): ${message}`)
}

/** Ladder order M05 uses for a school's pupils: grade 11 first, then grade 10, each by id. */
function ladder(list: readonly Pupil[]): Pupil[] {
  // Only active pupils practise (M05 build note (b): an inactive user holds no answer or session).
  list = list.filter((p) => p.isActive)
  const g = (x: Pupil) => x.grade
  return [
    ...list.filter((p) => g(p) === 11).sort(byId),
    ...list.filter((p) => g(p) === 10).sort(byId),
  ]
}

export function planSchoolSets(people: People): SchoolPlan[] {
  const plans: SchoolPlan[] = []
  for (const s of M18_SCHOOL_SETS) {
    const at = people.pupils.filter((p) => p.schoolId === s.school)
    const rehomed = at.filter((p) => p.pool === 't4PoolRehomed').sort(byId)
    const plain = at.filter((p) => p.pool !== 't4PoolRehomed')
    const reg11 = plain.filter((p) => p.grade === 11).sort(byId)
    const reg10 = plain.filter((p) => p.grade === 10).sort(byId)
    const low = plain.filter((p) => p.grade !== null && p.grade < 10).sort(byId)
    const expectRehomed = REHOMED_IN_CLASS[s.school] ?? 0
    if (rehomed.length !== expectRehomed) {
      fail(
        `school ${String(s.school)} has ${String(rehomed.length)} re-homed pupils, expected ${String(expectRehomed)}`,
      )
    }
    const answering: Pupil[] = []
    let ordered: Pupil[]
    let none: Pupil[]
    switch (s.school) {
      case 8765: {
        // 21 pupils; the ladder's first 6 answer (M18: 6 with answers); 2 of them are T5-only class
        // members, the other 4 are in no class. The 15 non-answering pupils are all in classes.
        const lad = ladder(at)
        const a = lad.slice(0, 6)
        const nonAnswering = at.filter((p) => !a.includes(p)).sort(byId)
        ordered = [...nonAnswering, a[0] as Pupil, a[1] as Pupil]
        none = a.slice(2)
        answering.push(...a)
        break
      }
      case 8772:
        ordered = [...rehomed, ...reg10, ...reg11]
        none = low
        break
      case 8767:
        ordered = [...reg10, ...reg11]
        none = low
        break
      case 7780:
        ordered = [...rehomed, ...reg11]
        none = [...reg10, ...low]
        break
      default:
        ordered = [...rehomed]
        none = [...reg11, ...reg10, ...low]
    }
    const inClass = s.n4 + s.n5 - s.both
    if (ordered.length !== inClass) {
      fail(
        `school ${String(s.school)}: ${String(ordered.length)} in-class pupils, table A.1 needs ${String(inClass)}`,
      )
    }
    const ids = ordered.map((p) => p.id)
    const t4Only = ids.slice(0, s.n4 - s.both)
    const both = ids.slice(s.n4 - s.both, s.n4)
    const t5Only = ids.slice(s.n4)
    const t4Set = [...t4Only, ...both]
    const t5Set = [...both, ...t5Only]
    const joiners = ordered
      .filter((p) => t4Set.includes(p.id) && p.pool !== 't4PoolRehomed')
      .map((p) => p.id)
    const rehomedInT4 = rehomed.filter((p) => t4Set.includes(p.id)).map((p) => p.id)
    const trio = dealSchool(t4Set, s, 'trio')
    const twins = dealSchool(t5Set, s, 'twins')
    plans.push({
      school: s.school,
      classPupils: ids,
      t4Set,
      t5Set,
      noClass: none.map((p) => p.id),
      answering: answering.map((p) => p.id),
      joiners,
      rehomedInT4,
      trio,
      twins,
    })
  }
  return plans
}

/** Spreads a school's set over the trio (T4) or the twins (T5) by the S29 counts when known. */
function dealSchool(
  set: readonly number[],
  s: SchoolSets,
  which: 'trio' | 'twins',
): [number[], number[], number[]] {
  if (set.length === 0) return [[], [], []]
  const given = which === 'trio' ? s.trio : s.twins
  let quotas: number[]
  if (given) quotas = [...given]
  else if (which === 'trio')
    quotas = splitTotal(
      set.length,
      TRIO_TARGETS.map(([, n]) => n),
    )
  else quotas = splitTotal(set.length, [1, 1, 0])
  const dealt = dealQuotas(set, quotas)
  return [dealt[0] as number[], dealt[1] as number[], dealt[2] as number[]]
}

export function planT4(people: People, schools: readonly SchoolPlan[]): T4Plan {
  const pool = people.pupils.filter((p) => p.pool === 't4Pool').sort(byId)
  const generatedPool = pool.filter((p) => p.generated)
  if (generatedPool.length < 4 + SMALL_419 + SMALL_SC419 + SMALL_SC806) {
    fail(`only ${String(generatedPool.length)} generated pool rows`)
  }
  // H1–H4: the first four generated pool rows (INFERRED; R4-01 says only "generated pool rows").
  const [h1, h2, h3, h4] = generatedPool.slice(0, 4).map((p) => p.id) as [
    number,
    number,
    number,
    number,
  ]
  const holders: T4Holders = { h1, h2, h3, h4 }
  const holderIds = new Set([h1, h2, h3, h4])
  // The 11 pupils of the small classes: the next generated pool rows.
  const small = generatedPool.slice(4, 4 + SMALL_419 + SMALL_SC419 + SMALL_SC806).map((p) => p.id)
  const c419 = small.slice(0, SMALL_419)
  const sc419 = small.slice(SMALL_419, SMALL_419 + SMALL_SC419)
  const sc806 = small.slice(SMALL_419 + SMALL_SC419)
  const smallIds = new Set(small)

  const filterRehomed = people.pupils
    .filter((p) => p.pool === 't4PoolRehomed' && !schools.some((s) => s.school === p.schoolId))
    .sort(byId)
    .map((p) => p.id)
  const poolTrio = [
    ...pool.filter((p) => !holderIds.has(p.id) && !smallIds.has(p.id)).map((p) => p.id),
    ...filterRehomed,
  ]

  // Trio targets less the school pupils' and the holders' memberships.
  const need = TRIO_TARGETS.map(([, n], c) => {
    let used = 0
    for (const s of schools) used += (s.trio[c] as number[]).length
    if (c === 2) used += 1 // H1
    if (c === 1) used += 3 // H2, H3, H4
    return n - used
  })
  if (need.some((n) => n < 0)) fail(`school memberships exceed the trio sizes (${need.join(', ')})`)
  const dealt = dealQuotas(poolTrio, need)

  const trio: Record<number, number[]> = { 4: [], 5: [], 6: [] }
  const classIds = [4, 5, 6]
  classIds.forEach((id, c) => {
    const members = trio[id] as number[]
    for (const s of schools) members.push(...(s.trio[c] as number[]))
    members.push(...(dealt[c] as number[]))
  })
  ;(trio[6] as number[]).push(h1)
  ;(trio[5] as number[]).push(h2, h3, h4)

  const c516 = [...PUPILS_516]
  const members = new Set<number>([...c516, ...c419, ...sc419, ...sc806])
  for (const id of classIds) for (const m of trio[id] as number[]) members.add(m)

  const twins: [number[], number[], number[]] = [[], [], []]
  for (const s of schools)
    for (let k = 0; k < 3; k++) (twins[k] as number[]).push(...(s.twins[k] as number[]))
  const schoolPupils = new Set<number>()
  for (const s of schools) {
    for (const p of people.pupils) if (p.schoolId === s.school) schoolPupils.add(p.id)
  }

  return {
    holders,
    trio,
    c419,
    sc419,
    sc806,
    c516,
    schools: [...schools],
    members: [...members].sort((a, b) => a - b),
    twins,
    schoolPupils,
    filterRehomed,
    poolSmall: small,
    poolTrio,
  }
}
