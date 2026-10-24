/**
 * Jana Kertas: build a paper from the question pool following a Kontrak Blueprint.
 * Rules: sections and counts come from the blueprint; a stimulus group is taken whole or not at
 * all and keeps its order; no question appears twice; no two questions of one paper share a stem
 * (FB-060, see `stemKeys`); unseen questions are preferred; when the pool cannot fill a section
 * exactly, nothing is created and the shortages are returned.
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
  /** Stem keys of the unit's questions (see `stemKeys`); two units sharing a key are the same stem. */
  keys?: string[]
}

/** A masked stem shorter than this is a generic lead-in ("Berdasarkan Rajah 1,"), not an identity. */
const MIN_STEM_KEY = 25

/**
 * What "the same stem" means (FB-060): two questions repeat each other when they share
 *  - a family id: the question id without its trailing variant suffix (`sn2-laju-v2` -> `sn2-laju`,
 *    the seed builders number the variants of one template `-v1`, `-v2`, ...), or
 *  - a masked stem: the stem lower-cased, `$` removed and every number replaced by `#`, so
 *    "... sejauh 600 m dalam masa 40 s." and "... sejauh 450 m dalam masa 30 s." are one stem.
 *    Masked stems shorter than 25 characters are generic lead-ins and are not compared.
 */
export function stemKeys(id: string, stem: string): string[] {
  const keys = [`id:${id.replace(/-v\d+$/, '')}`]
  const masked = stem
    .toLowerCase()
    .replace(/\$/g, '')
    .replace(/\d+(?:[.,]\d+)?/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
  if (masked.length >= MIN_STEM_KEY) keys.push(`stem:${masked}`)
  return keys
}

/** A single question or a whole group, per pool. A group with a member outside the pool is skipped. */
export function poolUnits(
  pool: string,
  entries: readonly PoolEntry[],
  groups: ReadonlyMap<string, GroupDef>,
  groupOf: (questionId: string) => string | undefined,
  keysOf?: (questionId: string) => string[],
): PoolUnit[] {
  const withKeys = (u: PoolUnit): PoolUnit =>
    keysOf ? { ...u, keys: [...new Set(u.ids.flatMap((id) => keysOf(id)))] } : u
  const inPool = new Set(entries.filter((e) => e.pool === pool).map((e) => e.questionId))
  const units: PoolUnit[] = []
  const doneGroups = new Set<string>()
  for (const e of entries) {
    if (e.pool !== pool) continue
    const gid = groupOf(e.questionId)
    if (!gid) {
      units.push(withKeys({ ids: [e.questionId] }))
      continue
    }
    if (doneGroups.has(gid)) continue
    doneGroups.add(gid)
    const g = groups.get(gid)
    if (g && g.questionIds.every((q) => inPool.has(q)))
      units.push(withKeys({ ids: [...g.questionIds], groupId: gid }))
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

/** Search budget of `fill`: a pool that cannot be solved fast is reported as a shortage. */
const MAX_STEPS = 200_000

const clashes = (u: PoolUnit, taken: ReadonlySet<string>): boolean =>
  !!u.keys?.some((k) => taken.has(k))

/**
 * Picks units whose sizes add up to exactly `take`, preferring the order given, with no two units
 * sharing a stem key (and none sharing one with `taken`, the keys of the sections already built).
 */
function fill(units: PoolUnit[], take: number, taken: ReadonlySet<string>): PoolUnit[] | null {
  const chosen: PoolUnit[] = []
  const keys = new Set(taken)
  // suffix[i] = how many questions remain from unit i on, to stop searches that cannot finish
  const suffix = new Array<number>(units.length + 1).fill(0)
  for (let i = units.length - 1; i >= 0; i--) suffix[i] = suffix[i + 1]! + units[i]!.ids.length
  let steps = 0
  const walk = (i: number, left: number): boolean => {
    if (left === 0) return true
    if (suffix[i]! < left || ++steps > MAX_STEPS) return false
    for (let k = i; k < units.length; k++) {
      const u = units[k]!
      if (u.ids.length > left || clashes(u, keys)) continue
      chosen.push(u)
      for (const key of u.keys ?? []) keys.add(key)
      if (walk(k + 1, left - u.ids.length)) return true
      chosen.pop()
      for (const key of u.keys ?? []) if (!taken.has(key)) keys.delete(key)
      if (steps > MAX_STEPS) return false
    }
    return false
  }
  return walk(0, take) ? chosen : null
}

/** How many questions a greedy pass can take without repeating a stem (for the shortage line). */
function greedyDistinct(units: PoolUnit[], take: number, taken: ReadonlySet<string>): number {
  const keys = new Set(taken)
  let n = 0
  for (const u of units) {
    if (clashes(u, keys) || n + u.ids.length > take) continue
    n += u.ids.length
    for (const key of u.keys ?? []) keys.add(key)
  }
  return n
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
  const usedKeys = new Set<string>()
  const shortages: Shortage[] = []
  const sections: Omit<SectionSnapshot, 'id'>[] = []
  for (const bs of blueprint.sections) {
    const all = (unitsByPool.get(bs.pool) ?? []).filter(
      (u) => u.ids.every((id) => !used.has(id)) && !clashes(u, usedKeys),
    )
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
    const picked = reachable === bs.take ? fill(ordered, bs.take, usedKeys) : null
    if (!picked) {
      const distinct = greedyDistinct(ordered, bs.take, usedKeys)
      shortages.push({
        section: bs.label,
        need: bs.take,
        have: Math.min(reachable, distinct, bs.take - 1),
      })
      continue
    }
    const ids = picked.flatMap((u) => u.ids)
    for (const id of ids) used.add(id)
    for (const u of picked) for (const key of u.keys ?? []) usedKeys.add(key)
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
