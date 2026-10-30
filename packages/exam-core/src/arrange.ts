/**
 * Concretise and arrange (architecture 5.8): turn the type counts of a solution into real questions
 * (unseen first, seeded shuffle) and order them per profile kind. The mixed-topic rule (AC-36.6, O-4) is
 * best effort and never causes a refusal.
 */
import type { Item } from './pool'
import { shuffleInPlace, type SectionSolution } from './solver'

export interface OrderUnit {
  level: 'T4' | 'T5' | null
  code: string
}

function chapterNo(code: string): number {
  const m = /\d+(?:\.\d+)?/.exec(code)
  return m ? Number.parseFloat(m[0]) : 0
}

/**
 * AC-36.6 as amended by O-4. For a section with at least 4 distinct units the sequence must not follow the
 * DSKP chapter order; for a section with at least 2 T4 and 2 T5 questions it must not be "all T4 before all T5".
 * Sections that do not qualify always pass. `units` is the primary unit of every question in slot order
 * (null for the T1-T3 bucket, which is left out of the sequence).
 */
export function orderOk(units: readonly (OrderUnit | null)[]): boolean {
  const seq = units.filter((u): u is OrderUnit => u !== null)
  const distinct = new Set(seq.map((u) => `${u.level}|${u.code}`))
  if (distinct.size >= 4) {
    const rank = (u: OrderUnit) => (u.level === 'T5' ? 1000 : 0) + chapterNo(u.code)
    let sorted = true
    for (let i = 1; i < seq.length; i++) if (rank(seq[i]!) < rank(seq[i - 1]!)) sorted = false
    if (sorted) return false
  }
  const t4 = seq.filter((u) => u.level === 'T4').length
  const t5 = seq.filter((u) => u.level === 'T5').length
  if (t4 >= 2 && t5 >= 2) {
    const lastT4 = seq.map((u) => u.level).lastIndexOf('T4')
    const firstT5 = seq.map((u) => u.level).indexOf('T5')
    if (lastT4 < firstT5) return false
  }
  return true
}

/** Questions of each slot group (real picks), unseen first within every type. */
function concretise(sol: SectionSolution, rnd: () => number): Item[][] {
  const P = sol.problem
  const queues = new Map<number, Item[]>()
  const perGroup: Item[][] = P.groups.map(() => [])
  for (const t of P.types) {
    if (!sol.picks.some((p) => p.type === t.idx)) continue
    const unseen = shuffleInPlace(
      t.members.filter((m) => !m.seen),
      rnd,
    )
    const seen = shuffleInPlace(
      t.members.filter((m) => m.seen),
      rnd,
    )
    queues.set(t.idx, [...unseen, ...seen])
  }
  for (const p of sol.picks) {
    const q = queues.get(p.type)!
    for (let i = 0; i < p.count; i++) perGroup[p.group]!.push(q.shift()!)
  }
  return perGroup
}

const MAX_ORDER_TRIES = 25

/** Question ids of a section in slot order. */
export function arrangeSection(sol: SectionSolution, rnd: () => number): string[] {
  const P = sol.problem
  const M = P.slots
  const perGroup = concretise(sol, rnd)
  const out: (string | null)[] = new Array<string | null>(M).fill(null)
  const kind = P.section.profile?.kind ?? null

  const unitOf = (f: Item['facts'][number]): OrderUnit | null => {
    const u = f.unit
    return u ? { level: u.level, code: u.code } : null
  }

  if (P.fixedStarts) {
    for (const s of sol.stim) s.cand.item.ids.forEach((id, i) => (out[s.start - 1 + i] = id))
    P.groups.forEach((g, gi) => {
      const free: number[] = []
      for (let slot = g.from; slot <= g.to; slot++) if (out[slot - 1] === null) free.push(slot)
      const singles = shuffleInPlace([...perGroup[gi]!], rnd)
      free.forEach((slot, i) => (out[slot - 1] = singles[i]?.ids[0] ?? null))
    })
    return out.map((x) => x ?? '')
  }

  const units: Item[] = [...(perGroup[0] ?? []), ...sol.stim.map((s) => s.cand.item)]
  let best: Item[] = shuffleInPlace([...units], rnd)
  if (kind !== 'ladder') {
    for (let tries = 0; tries < MAX_ORDER_TRIES; tries++) {
      const flat = best.flatMap((i) => i.facts.map(unitOf))
      if (orderOk(flat)) break
      best = shuffleInPlace([...units], rnd)
    }
  }
  return best.flatMap((i) => i.ids)
}
