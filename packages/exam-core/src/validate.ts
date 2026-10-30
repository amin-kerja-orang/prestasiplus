/**
 * Blueprint validation (architecture 4.3, AC-25.7, AC-35.x, AC-36.x, AC-37.5) and the completeness
 * part of the Disahkan gate (AC-39.1 a to d and f). All problems are returned at once.
 */
import {
  ANSWER_MODES,
  offeredMarks,
  perQuestionMarks,
  unitKeyOf,
  type StandardBlueprint,
  type StandardSection,
  type UnitRef,
} from './standard-model'

export const BLUEPRINT_PROBLEM_CODES = [
  'TOTAL_MISMATCH',
  'CHOOSE_N_RANGE',
  'SLOT_OVERLAP',
  'SLOT_GAP',
  'PROFILE_SHAPE',
  'TP_COUNTS',
  'MARKS_BAND',
  'QUOTA_SUM',
  'QUOTA_UNIT',
  'LEVEL_SHARE',
  'KBAT_RANGE',
  'KBAT_TOTAL',
  'MODES',
] as const
export type BlueprintProblemCode = (typeof BLUEPRINT_PROBLEM_CODES)[number]

export interface BlueprintProblem {
  code: BlueprintProblemCode
  sectionPosition?: number
  groupIndex?: number
  unit?: UnitRef
  expected?: number
  actual?: number
}

export interface BlueprintWarning {
  code: 'KBAT_TP_BAND'
  warning: true
  sectionPosition?: number
}

export interface ValidateOptions {
  /** `curriculum_nodes.id` of every unit of the subject, with its level. Without it QUOTA_UNIT and LEVEL_SHARE are skipped. */
  unitLevels?: ReadonlyMap<string, 'T4' | 'T5'> | Readonly<Record<string, 'T4' | 'T5'>>
  /** Answer modes accepted; defaults to the leaf modes of M04. */
  validModes?: readonly string[]
}

export interface ValidateResult {
  problems: BlueprintProblem[]
  warnings: BlueprintWarning[]
}

function levelOf(opts: ValidateOptions, nodeId: string): 'T4' | 'T5' | undefined {
  const m = opts.unitLevels
  if (!m) return undefined
  return m instanceof Map ? m.get(nodeId) : (m as Readonly<Record<string, 'T4' | 'T5'>>)[nodeId]
}

function sectionProblems(
  s: StandardSection,
  opts: ValidateOptions,
  out: BlueprintProblem[],
  warnings: BlueprintWarning[],
): void {
  const pos = s.position
  const M = s.questionCount
  const offered = offeredMarks(s)
  const push = (p: Omit<BlueprintProblem, 'sectionPosition'>) => out.push({ ...p, sectionPosition: pos })

  if (s.rule.type === 'choose') {
    const n = s.rule.n
    if (n < 1 || n > M) push({ code: 'CHOOSE_N_RANGE', expected: M, actual: n })
    else if (s.markBudget % n !== 0)
      push({ code: 'CHOOSE_N_RANGE', expected: Math.floor(s.markBudget / n) * n, actual: s.markBudget })
  }

  const valid = opts.validModes ?? ANSWER_MODES
  for (const m of s.allowedModes) if (!valid.includes(m)) push({ code: 'MODES' })

  if (s.profile) profileProblems(s, offered, push)

  if (s.quota) {
    const q = s.quota
    const seen = new Set<string>()
    let sum = 0
    let bad = false
    for (const line of q.lines) {
      const key = unitKeyOf(line.unit)
      if (seen.has(key) || line.value < 0) {
        bad = true
        push({ code: 'QUOTA_SUM', unit: line.unit })
      }
      seen.add(key)
      sum += line.value
      if (line.unit.kind === 'unit' && opts.unitLevels && !levelOf(opts, line.unit.nodeId))
        push({ code: 'QUOTA_UNIT', unit: line.unit })
    }
    const target = q.basis === 'marks' ? offered : M
    if (!bad && sum !== target) push({ code: 'QUOTA_SUM', expected: target, actual: sum })
    if (q.levelShare && opts.unitLevels) {
      const implied = impliedShare(s, opts)
      if (implied && (implied.t4 !== q.levelShare.t4 || implied.t5 !== q.levelShare.t5))
        push({ code: 'LEVEL_SHARE', expected: implied.t4, actual: q.levelShare.t4 })
    }
  }

  if (s.kbatMarks !== null && s.kbatMarks !== undefined) {
    if (s.kbatMarks < 0 || s.kbatMarks > offered) push({ code: 'KBAT_RANGE', expected: offered, actual: s.kbatMarks })
    if (s.kbatMarks > 0 && s.profile && s.profile.groups.length > 0 && s.profile.groups.every((g) => g.tpMax <= 2))
      warnings.push({ code: 'KBAT_TP_BAND', warning: true, sectionPosition: pos })
  }
}

/** T4 and T5 totals implied by the lines (the T1-T3 bucket is excluded). null when a unit level is unknown. */
function impliedShare(s: StandardSection, opts: ValidateOptions): { t4: number; t5: number } | null {
  if (!s.quota) return null
  let t4 = 0
  let t5 = 0
  for (const line of s.quota.lines) {
    if (line.unit.kind === 't1_t3') continue
    const level = levelOf(opts, line.unit.nodeId)
    if (!level) return null
    if (level === 'T4') t4 += line.value
    else t5 += line.value
  }
  return { t4, t5 }
}

function profileProblems(
  s: StandardSection,
  offered: number,
  push: (p: Omit<BlueprintProblem, 'sectionPosition'>) => void,
): void {
  const profile = s.profile!
  const M = s.questionCount
  const indexed = profile.groups.map((g, i) => ({ g, i })).sort((a, b) => a.g.from - b.g.from || a.i - b.i)

  // Tiling of 1..M.
  let next = 1
  for (const { g, i } of indexed) {
    if (g.from < next) push({ code: 'SLOT_OVERLAP', groupIndex: i, expected: next, actual: g.from })
    else if (g.from > next) push({ code: 'SLOT_GAP', groupIndex: i, expected: next, actual: g.from })
    if (g.to > M) push({ code: 'SLOT_GAP', groupIndex: i, expected: M, actual: g.to })
    next = Math.max(next, g.to + 1)
  }
  if (next <= M) push({ code: 'SLOT_GAP', expected: M, actual: next - 1 })

  // Shape.
  if (s.rule.type === 'choose' && profile.groups.length !== 1)
    push({ code: 'PROFILE_SHAPE', expected: 1, actual: profile.groups.length })
  if (profile.kind === 'bahagian' && profile.groups.length !== 1 && s.rule.type !== 'choose')
    push({ code: 'PROFILE_SHAPE', expected: 1, actual: profile.groups.length })
  profile.groups.forEach((g, i) => {
    if (g.tpMin > g.tpMax || g.tpMin < 1 || g.tpMax > 6) push({ code: 'PROFILE_SHAPE', groupIndex: i })
    if (profile.kind === 'tema' && (!g.units || g.units.length === 0)) push({ code: 'PROFILE_SHAPE', groupIndex: i })
  })
  if (profile.kind === 'ladder') {
    for (let k = 1; k < indexed.length; k++) {
      const a = indexed[k - 1]!.g
      const b = indexed[k]!.g
      if (b.tpMin < a.tpMin || b.tpMax < a.tpMax) push({ code: 'PROFILE_SHAPE', groupIndex: indexed[k]!.i })
    }
  }

  // Exact TP counts.
  profile.groups.forEach((g, i) => {
    if (!g.tpCounts || g.tpCounts.length === 0) return
    const size = g.to - g.from + 1
    const sum = g.tpCounts.reduce((n, c) => n + c.count, 0)
    const dup = new Set(g.tpCounts.map((c) => c.tp)).size !== g.tpCounts.length
    const outside = g.tpCounts.some((c) => c.tp < g.tpMin || c.tp > g.tpMax)
    if (sum !== size || dup || outside) push({ code: 'TP_COUNTS', groupIndex: i, expected: size, actual: sum })
  })

  // Marks bands must be able to reach the section marks.
  let lo = 0
  let hi = 0
  let hiOpen = false
  profile.groups.forEach((g, i) => {
    const size = Math.max(0, g.to - g.from + 1)
    if (g.marksMin !== undefined && g.marksMax !== undefined && g.marksMin > g.marksMax)
      push({ code: 'MARKS_BAND', groupIndex: i })
    lo += size * (g.marksMin ?? 1)
    if (g.marksMax === undefined) hiOpen = true
    else hi += size * g.marksMax
  })
  const each = perQuestionMarks(s)
  if (each !== null) {
    const g = profile.groups[0]
    if (g && ((g.marksMin !== undefined && each < g.marksMin) || (g.marksMax !== undefined && each > g.marksMax)))
      push({ code: 'MARKS_BAND', groupIndex: 0, expected: each })
  } else if (lo > offered || (!hiOpen && hi < offered)) {
    push({ code: 'MARKS_BAND', expected: offered, actual: lo > offered ? lo : hi })
  }
}

/** All problems of a blueprint at once, plus the warnings (KBAT_TP_BAND). */
export function validateBlueprint(bp: StandardBlueprint, opts: ValidateOptions = {}): ValidateResult {
  const problems: BlueprintProblem[] = []
  const warnings: BlueprintWarning[] = []
  const total = bp.sections.reduce((n, s) => n + s.markBudget, 0)
  if (bp.totalMarks !== undefined && bp.totalMarks !== null && bp.totalMarks !== total)
    problems.push({ code: 'TOTAL_MISMATCH', expected: total, actual: bp.totalMarks })
  for (const s of bp.sections) sectionProblems(s, opts, problems, warnings)

  const withKbat = bp.sections.filter((s) => s.kbatMarks !== null && s.kbatMarks !== undefined)
  if (bp.kbatMarks !== undefined && bp.kbatMarks !== null && withKbat.length === bp.sections.length) {
    const sum = withKbat.reduce((n, s) => n + (s.kbatMarks ?? 0), 0)
    if (sum !== bp.kbatMarks) problems.push({ code: 'KBAT_TOTAL', expected: sum, actual: bp.kbatMarks })
  }

  if (bp.levelShare && opts.unitLevels) {
    const quotaSections = bp.sections.filter((s) => s.quota)
    const bases = new Set(quotaSections.map((s) => s.quota!.basis))
    if (bases.size > 1) problems.push({ code: 'LEVEL_SHARE' })
    else {
      let t4 = 0
      let t5 = 0
      let known = true
      for (const s of quotaSections) {
        const im = impliedShare(s, opts)
        if (!im) known = false
        else {
          t4 += im.t4
          t5 += im.t5
        }
      }
      if (known && (t4 !== bp.levelShare.t4 || t5 !== bp.levelShare.t5))
        problems.push({ code: 'LEVEL_SHARE', expected: t4, actual: bp.levelShare.t4 })
    }
  }
  return { problems, warnings }
}

/* ------------------------------------------------------------------ Disahkan completeness */

export const COMPLETENESS_CODES = [
  'NO_PROFILE',
  'NO_QUOTA',
  'NO_KBAT',
  'NO_SHARE',
  'NO_DURATION',
  'UNREVIEWED',
] as const

export interface CompletenessGap {
  code: (typeof COMPLETENESS_CODES)[number]
  sectionPosition?: number
  /** UNREVIEWED only: the quota line still "Belum disemak". */
  unit?: UnitRef
}

export interface VerificationGate {
  problems: BlueprintProblem[]
  warnings: BlueprintWarning[]
  completeness: CompletenessGap[]
}

export interface VerificationGateOptions extends ValidateOptions {
  /** True when the subject has both T4 and T5 in the DSKP: a share must then be derivable (AC-39.1(c)). */
  subjectHasBothLevels?: boolean
}

/**
 * The blueprint part of the Disahkan gate (AC-39.1 a to d, f). The evidence part (e) is
 * `checkEvidence`. `NO_EVIDENCE_BODIES` therefore does not appear here.
 */
export function validateForVerification(bp: StandardBlueprint, opts: VerificationGateOptions = {}): VerificationGate {
  const { problems, warnings } = validateBlueprint(bp, opts)
  const completeness: CompletenessGap[] = []
  if (!bp.durationMin || bp.durationMin < 1) completeness.push({ code: 'NO_DURATION' })
  for (const s of bp.sections) {
    const pos = s.position
    if (!s.profile) completeness.push({ code: 'NO_PROFILE', sectionPosition: pos })
    if (!s.quota) completeness.push({ code: 'NO_QUOTA', sectionPosition: pos })
    if (s.kbatMarks === null || s.kbatMarks === undefined) completeness.push({ code: 'NO_KBAT', sectionPosition: pos })
    if (s.quota && opts.subjectHasBothLevels && !impliedShare(s, { ...opts, unitLevels: opts.unitLevels ?? {} }))
      completeness.push({ code: 'NO_SHARE', sectionPosition: pos })
    if (s.quota)
      for (const line of s.quota.lines)
        if (line.reviewed === false) completeness.push({ code: 'UNREVIEWED', sectionPosition: pos, unit: line.unit })
    if (s.kbatReviewed === false && s.kbatMarks !== null && s.kbatMarks !== undefined)
      completeness.push({ code: 'UNREVIEWED', sectionPosition: pos })
  }
  return { problems, warnings, completeness }
}

