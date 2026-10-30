/**
 * Candidate pool of a section (architecture 5.3): units (single question or whole stimulus group),
 * slot groups and the question "types" the solver searches over. Internal to the generator; the same
 * code feeds the pre-checks (the "Pratonton kolam" table) and the search, so they cannot disagree.
 */
import {
  describeQuestion,
  eligibilityOf,
  type DescribedQuestion,
  type QuestionFacts,
} from './eligibility'
import {
  offeredMarks,
  perQuestionMarks,
  unitKeyOf,
  type StandardSection,
  type UnitKey,
} from './standard-model'

export function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** A single question or a whole stimulus group, taken as one unit of the paper. */
export interface Item {
  /** Question ids in published order. */
  ids: string[]
  members: DescribedQuestion[]
  facts: QuestionFacts[]
  size: number
  marks: number
  kbat: number
  groupId: string | null
  seen: boolean
}

export interface PoolContext {
  facts: readonly QuestionFacts[]
  described: ReadonlyMap<string, DescribedQuestion>
  byId: ReadonlyMap<string, QuestionFacts>
  /** Members of every stimulus group in the candidate list, in published order. */
  groups: ReadonlyMap<string, QuestionFacts[]>
  /** Per-section eligibility results (private to pool.ts). */
  cache: Map<string, { base: Item[]; modeExcluded: number }>
}

export function makePoolContext(candidates: readonly QuestionFacts[]): PoolContext {
  const facts = [...candidates].sort((a, b) => compareIds(a.id, b.id))
  const described = new Map<string, DescribedQuestion>()
  const byId = new Map<string, QuestionFacts>()
  const groups = new Map<string, QuestionFacts[]>()
  for (const f of facts) {
    described.set(f.id, describeQuestion(f))
    byId.set(f.id, f)
    if (f.groupId) groups.set(f.groupId, [...(groups.get(f.groupId) ?? []), f])
  }
  for (const list of groups.values())
    list.sort((a, b) => (a.groupPosition ?? 1e9) - (b.groupPosition ?? 1e9) || compareIds(a.id, b.id))
  return { facts, described, byId, groups, cache: new Map() }
}

export interface SectionPool {
  /** Eligible units that are not used by an earlier section. */
  items: Item[]
  /** Questions in `items` (a group counts all its members). */
  eligibleQuestions: number
  /** Questions that fail only because the section does not allow their answer mode. */
  modeExcluded: number
}

export interface PoolOptions {
  used?: ReadonlySet<string>
  seen?: ReadonlySet<string>
  unseenOnly?: boolean
  /** Probe: ignore the quota (a unit without a line is allowed). */
  ignoreQuota?: boolean
}

interface BaseCache {
  base: Item[]
  modeExcluded: number
}

function baseItems(ctx: PoolContext, section: StandardSection, ignoreQuota: boolean): BaseCache {
  const key = JSON.stringify([ignoreQuota, section.allowedModes, section.pool ?? null, ignoreQuota ? null : section.quota, perQuestionMarks(section)])
  const hit = ctx.cache.get(key)
  if (hit) return hit
  const eligSection = ignoreQuota ? { ...section, quota: null } : section
  const per = perQuestionMarks(section)
  const base: Item[] = []
  let modeExcluded = 0
  const ok = new Map<string, boolean>()
  for (const f of ctx.facts) {
    const d = ctx.described.get(f.id)!
    const e = eligibilityOf(f, eligSection, d)
    ok.set(f.id, e.eligible)
    if (!e.eligible && e.reasons.length === 1 && e.reasons[0] === 'mode_not_allowed') modeExcluded++
  }
  const done = new Set<string>()
  for (const f of ctx.facts) {
    if (done.has(f.id)) continue
    const group = f.groupId ? ctx.groups.get(f.groupId) : undefined
    let members: QuestionFacts[]
    if (group && group.length > 1) {
      for (const m of group) done.add(m.id)
      const declared = group[0]?.groupSize ?? group.length
      if (declared > group.length) continue
      members = group
    } else {
      done.add(f.id)
      members = [f]
    }
    if (!members.every((m) => ok.get(m.id))) continue
    const ds = members.map((m) => ctx.described.get(m.id)!)
    if (per !== null && ds.some((d) => d.marks !== per)) continue
    base.push({
      ids: members.map((m) => m.id),
      members: ds,
      facts: members,
      size: members.length,
      marks: ds.reduce((n, d) => n + d.marks, 0),
      kbat: ds.reduce((n, d) => n + d.kbatMarks, 0),
      groupId: members.length > 1 ? (f.groupId ?? null) : null,
      seen: false,
    })
  }
  const out = { base, modeExcluded }
  ctx.cache.set(key, out)
  return out
}

/** Units of a section: eligible singles and complete stimulus groups, sorted by first id. */
export function buildSectionPool(ctx: PoolContext, section: StandardSection, opts: PoolOptions = {}): SectionPool {
  const { base, modeExcluded } = baseItems(ctx, section, !!opts.ignoreQuota)
  const used = opts.used
  const seen = opts.seen
  const items: Item[] = []
  for (const it of base) {
    if (used && used.size > 0 && it.ids.some((id) => used.has(id))) continue
    const isSeen = !!seen && seen.size > 0 && it.ids.some((id) => seen.has(id))
    if (opts.unseenOnly && isSeen) continue
    items.push(isSeen ? { ...it, seen: true } : it)
  }
  return { items, eligibleQuestions: items.reduce((n, i) => n + i.size, 0), modeExcluded }
}

/* --------------------------------------------------------------------------- slot groups */

export interface GroupSpec {
  index: number
  from: number
  to: number
  size: number
  tpMin: number
  tpMax: number
  /** Exact count per TP (index 1..6) or null. */
  counts: number[] | null
  mMin: number
  mMax: number
  units: Set<UnitKey> | null
}

export type Relax = 'kbat' | 'tp' | 'marks' | 'quota' | null

export function groupSpecs(section: StandardSection, relax: Relax = null): GroupSpec[] {
  const M = section.questionCount
  const per = perQuestionMarks(section)
  const profile = section.profile
  const base: GroupSpec[] =
    profile && profile.groups.length > 0
      ? [...profile.groups]
          .sort((a, b) => a.from - b.from)
          .map((g, index) => {
            let counts: number[] | null = null
            if (g.tpCounts && g.tpCounts.length > 0) {
              counts = [0, 0, 0, 0, 0, 0, 0]
              for (const c of g.tpCounts) counts[c.tp] = (counts[c.tp] ?? 0) + c.count
            }
            return {
              index,
              from: g.from,
              to: g.to,
              size: Math.max(0, g.to - g.from + 1),
              tpMin: g.tpMin,
              tpMax: g.tpMax,
              counts,
              mMin: g.marksMin ?? 1,
              mMax: g.marksMax ?? Number.POSITIVE_INFINITY,
              units: profile.kind === 'tema' && g.units ? new Set(g.units.map(unitKeyOf)) : null,
            }
          })
      : [{ index: 0, from: 1, to: M, size: M, tpMin: 1, tpMax: 6, counts: null, mMin: 1, mMax: Number.POSITIVE_INFINITY, units: null }]
  return base.map((g) => {
    const out = { ...g }
    if (per !== null) {
      out.mMin = per
      out.mMax = per
    }
    if (relax === 'tp') {
      out.tpMin = 1
      out.tpMax = 6
      out.counts = null
    }
    if (relax === 'marks' && per === null) {
      out.mMin = 1
      out.mMax = Number.POSITIVE_INFINITY
    }
    return out
  })
}

/* ---------------------------------------------------------------------------------- lines */

export interface LineSpec {
  keys: UnitKey[]
  values: number[]
  basis: 'questions' | 'marks'
  /** true when the section has no quota (one pseudo-line "any unit" carries the slots). */
  pseudo: boolean
}

export function lineSpec(section: StandardSection, relax: Relax = null): LineSpec {
  if (!section.quota || relax === 'quota') {
    return { keys: ['*'], values: [section.questionCount], basis: 'questions', pseudo: true }
  }
  const keys: UnitKey[] = []
  const values: number[] = []
  const seen = new Set<UnitKey>()
  for (const l of section.quota.lines) {
    const k = unitKeyOf(l.unit)
    if (seen.has(k)) continue
    seen.add(k)
    keys.push(k)
    values.push(l.value)
  }
  return { keys, values, basis: section.quota.basis, pseudo: false }
}

/** Credit of one question to the lines: [lineIndex, amount, ...]. Units without a line credit nothing. */
export function creditOf(d: DescribedQuestion, spec: LineSpec): number[] {
  if (spec.pseudo) return [0, 1]
  const out: number[] = []
  if (spec.basis === 'questions') {
    const i = d.bucket === null ? -1 : spec.keys.indexOf(d.bucket)
    if (i >= 0) out.push(i, 1)
  } else {
    for (const [k, v] of Object.entries(d.unitMarks)) {
      const i = spec.keys.indexOf(k)
      if (i >= 0) out.push(i, v)
    }
  }
  return out
}

export { offeredMarks }
