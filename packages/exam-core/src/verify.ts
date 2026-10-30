/**
 * `verifyComposition`: the independent oracle (architecture 5.10, AC-34.6). It recomputes every
 * measure from the composed paper and the question facts. It shares nothing with the solver except the
 * eligibility rules. Two tiers: `structural` (counts, duplicates, groups, marks, eligibility) is what the
 * publish contract check reuses; `standard` (profile, quota, KBAT, level share) is a hard gate for
 * generated papers and never blocks a curated Kertas Pilihan (O-2).
 */
import { eligibilityOf, type QuestionFacts } from './eligibility'
import {
  offeredMarks,
  perQuestionMarks,
  T1_T3_KEY,
  unitKeyOf,
  unitRefOf,
  type QuotaBasis,
  type SlotGroup,
  type StandardBlueprint,
  type StandardSection,
  type UnitKey,
  type UnitRef,
} from './standard-model'

export interface ComposedSection {
  position: number
  /** Question ids in slot order (slot 1 first). */
  questionIds: readonly string[]
  /** Optional printed numbers; when present they must run continuously across sections. */
  numbers?: readonly number[]
}

export type ViolationTier = 'structural' | 'standard'

export const VIOLATION_CODES = [
  'SECTION_MISSING',
  'COUNT',
  'DUPLICATE',
  'UNKNOWN_QUESTION',
  'GROUP_BROKEN',
  'INELIGIBLE',
  'MARKS_TOTAL',
  'MARKS_EACH',
  'NUMBERING',
  'TP_BAND',
  'MARKS_BAND',
  'TP_COUNT',
  'TEMA_UNIT',
  'QUOTA',
  'LEVEL_SHARE',
  'KBAT',
  'KBAT_TOTAL',
] as const
export type ViolationCode = (typeof VIOLATION_CODES)[number]

export interface Violation {
  code: ViolationCode
  tier: ViolationTier
  sectionPosition?: number
  slot?: number
  questionId?: string
  unit?: UnitRef
  expected?: number
  actual?: number
  detail?: string
}

export type FactsInput = ReadonlyMap<string, QuestionFacts> | readonly QuestionFacts[]

function factsMap(facts: FactsInput): ReadonlyMap<string, QuestionFacts> {
  return facts instanceof Map ? facts : new Map((facts as readonly QuestionFacts[]).map((f) => [f.id, f]))
}

/* ------------------------------------------------------------------------------ measures */

interface Measured {
  marks: number
  tp: number
  kbat: number
  bucket: UnitKey | null
  unitMarks: Map<UnitKey, number>
  levelOfKey: Map<UnitKey, 'T4' | 'T5'>
}

function measure(q: QuestionFacts): Measured {
  let marks = 0
  let tp = 0
  let kbat = 0
  const unitMarks = new Map<UnitKey, number>()
  const levelOfKey = new Map<UnitKey, 'T4' | 'T5'>()
  for (const leaf of q.leaves) {
    const m = leaf.marks ?? 0
    marks += m
    tp = Math.max(tp, leaf.tp ?? 0)
    if ((leaf.cognitiveLevel ?? 0) >= 3) kbat += m
    const unit = leaf.unit !== undefined ? leaf.unit : q.unit
    const origin = leaf.formOrigin ?? q.formOrigin
    const key = unit ? `unit:${unit.nodeId}` : origin === 't1_t3' ? T1_T3_KEY : null
    if (key) {
      unitMarks.set(key, (unitMarks.get(key) ?? 0) + m)
      if (unit) levelOfKey.set(key, unit.level)
    }
  }
  const bucket = q.unit ? `unit:${q.unit.nodeId}` : q.formOrigin === 't1_t3' ? T1_T3_KEY : null
  if (q.unit) levelOfKey.set(`unit:${q.unit.nodeId}`, q.unit.level)
  return { marks, tp, kbat, bucket, unitMarks, levelOfKey }
}

export interface SectionMeasure {
  position: number
  label: string
  effectiveMarks: number
  offeredMarks: number
  slotTp: number[]
  /** Counts per quota unit in the quota basis (questions: primary unit; marks: leaf marks per effective unit). */
  unitCounts: { unit: UnitRef; basis: QuotaBasis; value: number }[]
  kbatMarks: number
}

/** Numbers of one composed section, shared by the oracle and by the stored `standardReport`. */
export function measureSection(
  section: StandardSection,
  ids: readonly string[],
  facts: FactsInput,
): SectionMeasure {
  const byId = factsMap(facts)
  const per = perQuestionMarks(section)
  let total = 0
  let kbat = 0
  const slotTp: number[] = []
  const counts = new Map<UnitKey, number>()
  const basis: QuotaBasis = section.quota?.basis ?? 'questions'
  for (const id of ids) {
    const f = byId.get(id)
    if (!f) continue
    const m = measure(f)
    total += m.marks
    kbat += m.kbat
    slotTp.push(m.tp)
    if (basis === 'questions') {
      if (m.bucket) counts.set(m.bucket, (counts.get(m.bucket) ?? 0) + 1)
    } else for (const [k, v] of m.unitMarks) counts.set(k, (counts.get(k) ?? 0) + v)
  }
  const keys = new Set<UnitKey>(counts.keys())
  for (const l of section.quota?.lines ?? []) keys.add(unitKeyOf(l.unit))
  return {
    position: section.position,
    label: section.label,
    effectiveMarks: per !== null ? per * (section.rule.type === 'choose' ? section.rule.n : ids.length) : total,
    offeredMarks: total,
    slotTp,
    unitCounts: [...keys].sort().map((k) => ({ unit: unitRefOf(k), basis, value: counts.get(k) ?? 0 })),
    kbatMarks: kbat,
  }
}

/* -------------------------------------------------------------------------------- oracle */

function groupOfSlot(groups: readonly SlotGroup[], slot: number): { g: SlotGroup; index: number } | null {
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i]!
    if (slot >= g.from && slot <= g.to) return { g, index: i }
  }
  return null
}

export interface VerifyOptions {
  /** Default 'all'. 'structural' is what the publish contract check reuses (AC-26.2). */
  tier?: ViolationTier | 'all'
}

export function verifyComposition(
  bp: StandardBlueprint,
  composed: readonly ComposedSection[],
  facts: FactsInput,
  opts: VerifyOptions = {},
): Violation[] {
  const byId = factsMap(facts)
  const out: Violation[] = []
  const v = (x: Violation) => out.push(x)
  const sections = [...bp.sections].sort((a, b) => a.position - b.position)
  const membersOf = new Map<string, QuestionFacts[]>()
  for (const f of byId.values())
    if (f.groupId) membersOf.set(f.groupId, [...(membersOf.get(f.groupId) ?? []), f])

  // Paper-level: every section present once, in order; no question twice.
  const seen = new Map<string, number>()
  const orderedComposed = [...composed]
  if (orderedComposed.length !== sections.length || orderedComposed.some((c, i) => c.position !== sections[i]?.position))
    for (const s of sections)
      if (!composed.some((c) => c.position === s.position)) v({ code: 'SECTION_MISSING', tier: 'structural', sectionPosition: s.position })
  let kbatPaper = 0
  let kbatSections = 0
  let nextNumber: number | null = null
  const levelTotals = { t4: 0, t5: 0 }
  const shareBases = new Set<QuotaBasis>()
  let shareSections = 0

  for (const s of sections) {
    const c = composed.find((x) => x.position === s.position)
    if (!c) continue
    const pos = s.position
    const ids = c.questionIds
    const per = perQuestionMarks(s)
    const offered = offeredMarks(s)

    if (ids.length !== s.questionCount)
      v({ code: 'COUNT', tier: 'structural', sectionPosition: pos, expected: s.questionCount, actual: ids.length })

    // Numbering.
    if (c.numbers) {
      if (c.numbers.length !== ids.length || c.numbers.some((n, i) => n !== (c.numbers![0] ?? 0) + i))
        v({ code: 'NUMBERING', tier: 'structural', sectionPosition: pos })
      if (nextNumber !== null && c.numbers[0] !== nextNumber)
        v({ code: 'NUMBERING', tier: 'structural', sectionPosition: pos, expected: nextNumber, actual: c.numbers[0] })
      nextNumber = (c.numbers[0] ?? 0) + ids.length
    }

    const rows: { id: string; f: QuestionFacts; m: Measured }[] = []
    ids.forEach((id, i) => {
      const f = byId.get(id)
      if (!f) {
        v({ code: 'UNKNOWN_QUESTION', tier: 'structural', sectionPosition: pos, slot: i + 1, questionId: id })
        return
      }
      if (seen.has(id)) v({ code: 'DUPLICATE', tier: 'structural', sectionPosition: pos, slot: i + 1, questionId: id })
      seen.set(id, pos)
      rows.push({ id, f, m: measure(f) })
      const e = eligibilityOf(f, s)
      for (const r of e.reasons)
        v({
          code: 'INELIGIBLE',
          tier: r === 'unit_not_in_quota' ? 'standard' : 'structural',
          sectionPosition: pos,
          slot: i + 1,
          questionId: id,
          detail: r,
        })
    })

    // Stimulus groups: whole, adjacent, in published order.
    const seenGroups = new Set<string>()
    ids.forEach((id, i) => {
      const f = byId.get(id)
      if (!f?.groupId || seenGroups.has(f.groupId)) return
      seenGroups.add(f.groupId)
      const members = [...(membersOf.get(f.groupId) ?? [])].sort(
        (a, b) => (a.groupPosition ?? 0) - (b.groupPosition ?? 0) || (a.id < b.id ? -1 : 1),
      )
      if (members.length <= 1) return
      const declared = members[0]?.groupSize ?? members.length
      const run = ids.slice(i, i + members.length)
      const ok = declared <= members.length && members.every((mm, k) => run[k] === mm.id)
      if (!ok) v({ code: 'GROUP_BROKEN', tier: 'structural', sectionPosition: pos, slot: i + 1, detail: f.groupId })
    })

    // Marks.
    const total = rows.reduce((n, r) => n + r.m.marks, 0)
    if (per !== null) {
      rows.forEach((r, i) => {
        if (r.m.marks !== per)
          v({ code: 'MARKS_EACH', tier: 'structural', sectionPosition: pos, slot: i + 1, questionId: r.id, expected: per, actual: r.m.marks })
      })
      if (rows.length === ids.length && total !== offered)
        v({ code: 'MARKS_TOTAL', tier: 'structural', sectionPosition: pos, expected: offered, actual: total })
    } else if (total !== s.markBudget) {
      v({ code: 'MARKS_TOTAL', tier: 'structural', sectionPosition: pos, expected: s.markBudget, actual: total })
    }

    // Profile: TP band, marks band, exact TP counts, theme units.
    if (s.profile) {
      const perGroupTp = new Map<number, Map<number, number>>()
      ids.forEach((id, i) => {
        const f = byId.get(id)
        if (!f) return
        const hit = groupOfSlot(s.profile!.groups, i + 1)
        if (!hit) return
        const m = measure(f)
        const { g, index } = hit
        if (m.tp < g.tpMin || m.tp > g.tpMax)
          v({ code: 'TP_BAND', tier: 'standard', sectionPosition: pos, slot: i + 1, questionId: id, expected: g.tpMin, actual: m.tp })
        if ((g.marksMin !== undefined && m.marks < g.marksMin) || (g.marksMax !== undefined && m.marks > g.marksMax))
          v({ code: 'MARKS_BAND', tier: 'standard', sectionPosition: pos, slot: i + 1, questionId: id, expected: g.marksMin ?? g.marksMax, actual: m.marks })
        const tally = perGroupTp.get(index) ?? new Map<number, number>()
        tally.set(m.tp, (tally.get(m.tp) ?? 0) + 1)
        perGroupTp.set(index, tally)
        if (s.profile!.kind === 'tema' && g.units && g.units.length > 0) {
          const allowed = new Set(g.units.map(unitKeyOf))
          if ([...m.unitMarks.keys()].some((k) => !allowed.has(k)))
            v({ code: 'TEMA_UNIT', tier: 'standard', sectionPosition: pos, slot: i + 1, questionId: id })
        }
      })
      s.profile.groups.forEach((g, index) => {
        if (!g.tpCounts || g.tpCounts.length === 0) return
        const tally = perGroupTp.get(index) ?? new Map<number, number>()
        const wanted = new Map(g.tpCounts.map((x) => [x.tp, x.count]))
        for (const tp of new Set([...wanted.keys(), ...tally.keys()])) {
          const want = wanted.get(tp) ?? 0
          const got = tally.get(tp) ?? 0
          if (want !== got) v({ code: 'TP_COUNT', tier: 'standard', sectionPosition: pos, expected: want, actual: got, detail: `tp${tp}@${index}` })
        }
      })
    }

    // Quota per line.
    const measured = measureSection(s, ids, byId)
    if (s.quota) {
      const want = new Map(s.quota.lines.map((l) => [unitKeyOf(l.unit), l.value]))
      for (const u of measured.unitCounts) {
        const k = unitKeyOf(u.unit)
        const w = want.get(k) ?? 0
        if (u.value !== w) v({ code: 'QUOTA', tier: 'standard', sectionPosition: pos, unit: u.unit, expected: w, actual: u.value })
      }
      if (s.quota.levelShare) {
        let t4 = 0
        let t5 = 0
        for (const r of rows) {
          if (s.quota.basis === 'questions') {
            const lvl = r.m.bucket ? r.m.levelOfKey.get(r.m.bucket) : undefined
            if (lvl === 'T4') t4++
            else if (lvl === 'T5') t5++
          } else
            for (const [k, val] of r.m.unitMarks) {
              const lvl = r.m.levelOfKey.get(k)
              if (lvl === 'T4') t4 += val
              else if (lvl === 'T5') t5 += val
            }
        }
        if (t4 !== s.quota.levelShare.t4 || t5 !== s.quota.levelShare.t5)
          v({ code: 'LEVEL_SHARE', tier: 'standard', sectionPosition: pos, expected: s.quota.levelShare.t4, actual: t4 })
      }
      shareBases.add(s.quota.basis)
      shareSections++
      for (const r of rows) {
        if (s.quota.basis === 'questions') {
          const lvl = r.m.bucket ? r.m.levelOfKey.get(r.m.bucket) : undefined
          if (lvl === 'T4') levelTotals.t4++
          else if (lvl === 'T5') levelTotals.t5++
        } else
          for (const [k, val] of r.m.unitMarks) {
            const lvl = r.m.levelOfKey.get(k)
            if (lvl === 'T4') levelTotals.t4 += val
            else if (lvl === 'T5') levelTotals.t5 += val
          }
      }
    }

    // KBAT.
    if (s.kbatMarks !== null && s.kbatMarks !== undefined && measured.kbatMarks !== s.kbatMarks)
      v({ code: 'KBAT', tier: 'standard', sectionPosition: pos, expected: s.kbatMarks, actual: measured.kbatMarks })
    kbatPaper += measured.kbatMarks
    kbatSections++
  }

  if (bp.kbatMarks !== undefined && bp.kbatMarks !== null && kbatSections === sections.length && kbatPaper !== bp.kbatMarks)
    v({ code: 'KBAT_TOTAL', tier: 'standard', expected: bp.kbatMarks, actual: kbatPaper })
  if (bp.levelShare && shareSections > 0 && shareBases.size === 1 && (levelTotals.t4 !== bp.levelShare.t4 || levelTotals.t5 !== bp.levelShare.t5))
    v({ code: 'LEVEL_SHARE', tier: 'standard', expected: bp.levelShare.t4, actual: levelTotals.t4 })

  const tier = opts.tier ?? 'all'
  return tier === 'all' ? out : out.filter((x) => x.tier === tier)
}

/** Frozen composition report stored on a generated paper (3.6, AC-34.7). */
export interface StandardReport {
  blueprintVersion: number
  seed: number
  solverVersion: string
  sections: SectionMeasure[]
  kbatMarksTotal: number
}

export function buildStandardReport(
  bp: StandardBlueprint,
  composed: readonly ComposedSection[],
  facts: FactsInput,
  meta: { seed: number; solverVersion: string },
): StandardReport {
  const sections = [...bp.sections]
    .sort((a, b) => a.position - b.position)
    .flatMap((s) => {
      const c = composed.find((x) => x.position === s.position)
      return c ? [measureSection(s, c.questionIds, facts)] : []
    })
  return {
    blueprintVersion: bp.version,
    seed: meta.seed,
    solverVersion: meta.solverVersion,
    sections,
    kbatMarksTotal: sections.reduce((n, x) => n + x.kbatMarks, 0),
  }
}
