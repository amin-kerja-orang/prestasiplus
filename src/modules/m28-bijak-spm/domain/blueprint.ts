/**
 * Jana Kertas: build a paper from the question pool following a Kontrak Blueprint.
 * Rules: sections and counts come from the blueprint; a stimulus group is taken whole or not at
 * all and keeps its order; no question appears twice; unseen questions are preferred; when the pool
 * cannot fill a section exactly, nothing is created and the shortages are returned.
 */
import type { Blueprint, GroupDef, PoolEntry, SectionSnapshot, Shortage } from './types'

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface PoolUnit {
  /** Question ids of the unit, in published order (a group keeps its order). */
  ids: string[]
  groupId?: string
}

/** A single question or a whole group, per pool. A group with a member outside the pool is skipped. */
export function poolUnits(
  pool: string,
  entries: readonly PoolEntry[],
  groups: ReadonlyMap<string, GroupDef>,
  groupOf: (questionId: string) => string | undefined,
): PoolUnit[] {
  const inPool = new Set(entries.filter((e) => e.pool === pool).map((e) => e.questionId))
  const units: PoolUnit[] = []
  const doneGroups = new Set<string>()
  for (const e of entries) {
    if (e.pool !== pool) continue
    const gid = groupOf(e.questionId)
    if (!gid) {
      units.push({ ids: [e.questionId] })
      continue
    }
    if (doneGroups.has(gid)) continue
    doneGroups.add(gid)
    const g = groups.get(gid)
    if (g && g.questionIds.every((q) => inPool.has(q)))
      units.push({ ids: [...g.questionIds], groupId: gid })
  }
  return units
}

function shuffle<T>(xs: T[], rnd: () => number): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

/** Largest total <= target reachable with the unit sizes (each unit used at most once). */
function bestReachable(sizes: number[], target: number): number {
  const reach = new Array<boolean>(target + 1).fill(false)
  reach[0] = true
  for (const s of sizes) for (let t = target; t >= s; t--) if (reach[t - s]) reach[t] = true
  for (let t = target; t >= 0; t--) if (reach[t]) return t
  return 0
}

/** Picks units whose sizes add up to exactly `take`, preferring the order given. */
function fill(units: PoolUnit[], take: number): PoolUnit[] | null {
  const chosen: PoolUnit[] = []
  const walk = (i: number, left: number): boolean => {
    if (left === 0) return true
    for (let k = i; k < units.length; k++) {
      const u = units[k]!
      if (u.ids.length > left) continue
      chosen.push(u)
      if (walk(k + 1, left - u.ids.length)) return true
      chosen.pop()
    }
    return false
  }
  return walk(0, take) ? chosen : null
}

export type BlueprintOutcome =
  { ok: true; sections: Omit<SectionSnapshot, 'id'>[] } | { ok: false; shortages: Shortage[] }

export function composeFromBlueprint(
  blueprint: Blueprint,
  unitsByPool: ReadonlyMap<string, PoolUnit[]>,
  options: { seed: number; seen?: ReadonlySet<string> },
): BlueprintOutcome {
  const rnd = mulberry32(options.seed)
  const used = new Set<string>()
  const shortages: Shortage[] = []
  const sections: Omit<SectionSnapshot, 'id'>[] = []
  for (const bs of blueprint.sections) {
    const all = (unitsByPool.get(bs.pool) ?? []).filter((u) => u.ids.every((id) => !used.has(id)))
    const have = all.reduce((n, u) => n + u.ids.length, 0)
    const unseen = shuffle(
      all.filter((u) => !u.ids.some((id) => options.seen?.has(id))),
      rnd,
    )
    const seenUnits = shuffle(
      all.filter((u) => u.ids.some((id) => options.seen?.has(id))),
      rnd,
    )
    const ordered = [...unseen, ...seenUnits]
    const reachable =
      have >= bs.take
        ? bestReachable(
            all.map((u) => u.ids.length),
            bs.take,
          )
        : have
    const picked = reachable === bs.take ? fill(ordered, bs.take) : null
    if (!picked) {
      shortages.push({ section: bs.label, need: bs.take, have: reachable })
      continue
    }
    const ids = picked.flatMap((u) => u.ids)
    for (const id of ids) used.add(id)
    sections.push({
      label: bs.label,
      ...(bs.instruction ? { instruction: bs.instruction } : {}),
      rule: bs.rule,
      questionIds: ids,
    })
  }
  return shortages.length ? { ok: false, shortages } : { ok: true, sections }
}

/** BM line for one shortage (design: "{Bahagian}: perlu {n} soalan, hanya {m} tersedia"). */
export function shortageLine(s: Shortage): string {
  return `${s.section}: perlu ${s.need} soalan, hanya ${s.have} tersedia`
}
