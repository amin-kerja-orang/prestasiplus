/**
 * The designed "{n} GURU" enrolments (SRS M10 §6.2.1 A, XR to M17 R2-06; data in `data/guru.ts`).
 *
 * Runs at the end of the class build, on the member lists only: for each plan school the answering pupils
 * of M05 (today / week-only / month-only) get class memberships so that the distinct owners of their classes
 * are the observed counts of M17 BR-M17-11 in each window (today ⊂ week ⊂ month). Only generated T5
 * classrooms may change (`eligible`); anchors, twins, the F-30 at-risk classes and the owners of the observed
 * teacher cards keep their members, so the sizes the SRS pins and the 442 / 1699 / 4186 cards do not move.
 * No pupil leaves T5 (each keeps a class) and no class, owner or id is added, so the totals are unchanged.
 *
 * INFERRED: which pupil takes which owner (hash order, owners of the school itself first and then the pool
 * schools) and how many classes a pupil sits in. The week counts of 8082 (50 owners for 5 week-only pupils
 * plus the today pupil in class 813 only) cannot be reached with at most 7 classes per pupil (M10 v1.8
 * assumed 8 week pupils); the build gives such a pupil as many classes as needed, spread evenly.
 */

import { GURU_PLANS, type GuruPlan } from '../data/guru'
import type { ClassroomRow } from '../repository/types'
import { byHash } from './util'

export interface GuruInput {
  /** Member lists by class key (mutated). */
  members: Map<string, number[]>
  /** Every classroom of an owner at the time of the call. */
  ownerClasses: ReadonlyMap<number, readonly ClassroomRow[]>
  /** Class ids whose members may change (generated T5 classrooms outside the pinned sets). */
  eligible: ReadonlySet<number>
  /** The owners of the generic classes of each school. */
  ownersBySchool: ReadonlyMap<number, readonly number[]>
  /** Owners that gain no pupil: owners of an anchor, special, at-risk or teacher-card class. */
  protectedOwners: ReadonlySet<number>
}

export interface GuruFacts {
  added: number
  removed: number
}

function fail(message: string): never {
  throw new Error(`M10 build (guru enrolments): ${message}`)
}

export function designGuruEnrolments(
  input: GuruInput,
  plans: readonly GuruPlan[] = GURU_PLANS,
): GuruFacts {
  const { members, ownerClasses, eligible, ownersBySchool, protectedOwners } = input
  const facts: GuruFacts = { added: 0, removed: 0 }

  const ownerOfKey = new Map<string, number>()
  for (const [owner, list] of ownerClasses) {
    for (const c of list) if (c.kind === 'classroom') ownerOfKey.set(c.id, owner)
  }
  const idOfKey = (key: string): number => Number(key.slice(key.indexOf(':') + 1))
  const isGeneric = (key: string): boolean => eligible.has(idOfKey(key))

  // The memberships of the pupils of the plans.
  const wanted = new Set<number>(plans.flatMap((p) => [...p.today, ...p.week, ...p.month]))
  const index = new Map<number, Set<string>>([...wanted].map((p) => [p, new Set<string>()]))
  for (const [key, list] of members) {
    for (const p of list) index.get(p)?.add(key)
  }
  const keysOf = (p: number): Set<string> => index.get(p) ?? fail(`pupil ${String(p)} is unknown`)

  const add = (p: number, key: string): void => {
    ;(members.get(key) ?? fail(`class ${key} has no member list`)).push(p)
    keysOf(p).add(key)
    facts.added++
  }
  const remove = (p: number, key: string): void => {
    const list = members.get(key) ?? fail(`class ${key} has no member list`)
    const at = list.indexOf(p)
    if (at >= 0) list.splice(at, 1)
    keysOf(p).delete(key)
    facts.removed++
  }
  const fixedKeys = (p: number): string[] => [...keysOf(p)].filter((k) => !isGeneric(k))
  const genericKeys = (p: number): string[] =>
    [...keysOf(p)].filter(isGeneric).sort((a, b) => idOfKey(a) - idOfKey(b))

  const ownersOf = (pupils: Iterable<number>): Set<number> => {
    const out = new Set<number>()
    for (const p of pupils) {
      for (const key of keysOf(p)) {
        const o = ownerOfKey.get(key)
        if (o !== undefined) out.add(o)
      }
    }
    return out
  }
  /** Owners a pupil may be newly enrolled with: not protected, and with at least one eligible class. */
  const clean = (o: number): boolean =>
    !protectedOwners.has(o) && (ownerClasses.get(o) ?? []).some((c) => eligible.has(c.classId))
  /** An eligible class of `owner` that `p` is not in (hash order). */
  const classFor = (owner: number, p: number): string | undefined =>
    byHash(
      (ownerClasses.get(owner) ?? []).filter((c) => eligible.has(c.classId)).map((c) => c.id),
      `m10:guru:class:${String(p)}:${String(owner)}`,
      (k) => k,
    ).find((k) => !keysOf(p).has(k))

  for (const plan of plans) {
    const label = String(plan.school)
    const all = [...plan.today, ...plan.week, ...plan.month]
    for (const p of all) keysOf(p)

    const own = byHash(
      (ownersBySchool.get(plan.school) ?? []).filter(clean),
      `m10:guru:own:${label}`,
      (o) => o,
    )
    const poolOwners = byHash(
      [...new Set(plan.pool.flatMap((s) => ownersBySchool.get(s) ?? []))].filter(
        (o) => clean(o) && !own.includes(o),
      ),
      `m10:guru:pool:${label}`,
      (o) => o,
    )
    const candidates = [...own, ...poolOwners]

    /** Gives `p` a class of an owner in `refill` when it has none left. */
    const keepOne = (p: number, refill: ReadonlySet<number>): void => {
      if (keysOf(p).size > 0) return
      const owner = byHash(
        [...refill].filter(clean),
        `m10:guru:refill:${label}:${String(p)}`,
        (o) => o,
      ).find((o) => classFor(o, p) !== undefined)
      if (owner === undefined) fail(`${label}: pupil ${String(p)} would be left without a class`)
      add(p, classFor(owner, p) as string)
    }

    // ---- today: one class (owner) per pupil, none beside a pinned class ------------------------------
    const takenToday = new Set<number>()
    for (const p of plan.today)
      for (const k of fixedKeys(p)) takenToday.add(ownerOfKey.get(k) as number)
    for (const p of plan.today) {
      const generic = genericKeys(p)
      if (fixedKeys(p).length > 0) {
        for (const key of generic) remove(p, key)
        continue
      }
      const keep = generic.find((k) => !takenToday.has(ownerOfKey.get(k) as number))
      if (keep === undefined) fail(`${label}: today pupil ${String(p)} has no class of a new owner`)
      for (const key of generic) if (key !== keep) remove(p, key)
      takenToday.add(ownerOfKey.get(keep) as number)
    }
    const today = ownersOf(plan.today)
    if (today.size !== plan.targets.today)
      fail(`${label}: today ${String(today.size)} owners, ${String(plan.targets.today)} wanted`)

    // ---- week: the today owners plus the week-only pupils' ----------------------------------------------
    const weekPupils = [...plan.today, ...plan.week]
    if (ownersOf(weekPupils).size > plan.targets.week)
      fail(`${label}: week owners exceed ${String(plan.targets.week)}`)
    // New owners go to the week-only pupil with the fewest classes (the today pupils keep their classes).
    for (const owner of candidates) {
      if (ownersOf(weekPupils).size >= plan.targets.week) break
      if (ownersOf(weekPupils).has(owner)) continue
      const order = [...plan.week].sort((a, b) => keysOf(a).size - keysOf(b).size || a - b)
      const pupil = order.find((p) => classFor(owner, p) !== undefined)
      if (pupil === undefined) continue
      add(pupil, classFor(owner, pupil) as string)
    }
    if (ownersOf(weekPupils).size !== plan.targets.week)
      fail(
        `${label}: week ${String(ownersOf(weekPupils).size)} owners, ${String(plan.targets.week)} wanted`,
      )
    const week = ownersOf(weekPupils)

    // ---- month: the week owners plus (target − week) new owners of the month-only pupils ---------------
    const allowedNew = plan.targets.month - plan.targets.week
    const newOwners = (): number[] => [...ownersOf(plan.month)].filter((o) => !week.has(o))
    if (newOwners().length > allowedNew) {
      // Drop the month-only pupils' classes of surplus owners (each keeps a class of a week owner).
      const fixedOwners = new Set(
        plan.month.flatMap((p) => fixedKeys(p).flatMap((k) => ownerOfKey.get(k) ?? [])),
      )
      while (newOwners().length > allowedNew) {
        const victim = byHash(
          newOwners().filter((o) => !fixedOwners.has(o)),
          `m10:guru:drop-month:${label}`,
          (o) => o,
        ).at(-1)
        if (victim === undefined) fail(`${label}: month owners cannot be reduced`)
        for (const p of plan.month) {
          for (const key of genericKeys(p)) if (ownerOfKey.get(key) === victim) remove(p, key)
          keepOne(p, week)
        }
      }
    }
    if (newOwners().length < allowedNew) {
      // New owners must be outside the week owners (else they would not be new).
      const need = allowedNew - newOwners().length
      let given = 0
      for (const owner of candidates) {
        if (given >= need) break
        if (week.has(owner) || ownersOf(plan.month).has(owner)) continue
        const order = [...plan.month].sort((a, b) => keysOf(a).size - keysOf(b).size || a - b)
        const pupil = order.find((p) => classFor(owner, p) !== undefined)
        if (pupil === undefined) continue
        add(pupil, classFor(owner, pupil) as string)
        given++
      }
      if (given < need)
        fail(`${label}: only ${String(given)} of ${String(need)} month owners found`)
    }
    const month = ownersOf(all)
    if (month.size !== plan.targets.month)
      fail(`${label}: month ${String(month.size)} owners, ${String(plan.targets.month)} wanted`)
  }
  return facts
}
