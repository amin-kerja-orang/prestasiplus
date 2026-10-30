/**
 * Evidence comparison (architecture 6.6, AC-39.2, AC-39.7): compares the values a blueprint states
 * with the values read from trial papers, skema and LPM format documents.
 */
import type { SectionRule, StandardBlueprint } from './standard-model'

export type EvidenceKind = 'trial_paper' | 'skema' | 'lpm_format'

export interface EvidenceValues {
  durationMin?: number
  totalMarks?: number
  sections?: {
    position: number
    label?: string
    markBudget?: number
    offeredMarks?: number
    rule?: SectionRule
    questionCount?: number
  }[]
}

export interface EvidenceItem {
  id: string
  kind: EvidenceKind
  /** Lowercase snake_case id of the issuing body (sbp, selangor_mpsm, lpm). */
  body: string
  values: EvidenceValues
}

export type EvidenceField = 'durationMin' | 'totalMarks' | 'markBudget' | 'rule' | 'questionCount'
export type EvidenceStatus = 'ok' | 'differs' | 'not_covered' | 'tidak_disahkan'

export interface EvidenceLine {
  field: EvidenceField
  sectionPosition?: number
  expected: unknown
  statements: { evidenceId: string; body: string; kind: EvidenceKind; value: unknown }[]
  supportingBodies: number
  status: EvidenceStatus
}

export interface EvidenceCheck {
  lines: EvidenceLine[]
  /** `NO_EVIDENCE_BODIES` when the two-body rule (paper and skema each) is not met (gate e). */
  completeness: { code: 'NO_EVIDENCE_BODIES' }[]
  /** Gate (e): every line ok and the body rule met. */
  passes: boolean
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

function ruleValue(r: SectionRule): unknown {
  return r.type === 'all' ? { type: 'all' } : { type: 'choose', n: r.n }
}

interface Probe {
  field: EvidenceField
  sectionPosition?: number
  expected: unknown
  read: (v: EvidenceValues) => unknown
}

function buildLine(probe: Probe, items: readonly EvidenceItem[]): EvidenceLine {
  const statements: EvidenceLine['statements'] = []
  for (const item of items) {
    const value = probe.read(item.values)
    if (value !== undefined) statements.push({ evidenceId: item.id, body: item.body, kind: item.kind, value })
  }
  // A body supports the value when all of its statements equal it; it contradicts when any differs.
  const byBody = new Map<string, typeof statements>()
  for (const st of statements) byBody.set(st.body, [...(byBody.get(st.body) ?? []), st])
  let contradicts = false
  let supporting = 0
  let lpmSupport = false
  for (const list of byBody.values()) {
    if (list.every((st) => same(st.value, probe.expected))) {
      supporting++
      if (list.some((st) => st.kind === 'lpm_format')) lpmSupport = true
    } else contradicts = true
  }
  // An lpm_format item counts as two supporting bodies (AC-39.2).
  const supportingBodies = supporting + (lpmSupport ? 1 : 0)
  const status: EvidenceStatus = contradicts
    ? 'differs'
    : statements.length === 0
      ? 'not_covered'
      : supportingBodies < 2
        ? 'tidak_disahkan'
        : 'ok'
  const line: EvidenceLine = {
    field: probe.field,
    expected: probe.expected,
    statements,
    supportingBodies,
    status,
  }
  if (probe.sectionPosition !== undefined) line.sectionPosition = probe.sectionPosition
  return line
}

/**
 * Compares duration, total marks and, per section matched by position, mark budget, rule and question
 * count. Topic and KBAT quotas are author-set and not compared. Gate (e): every line `ok`, and at least
 * two distinct bodies each with a trial paper AND a skema, unless an `lpm_format` item exists.
 */
export function checkEvidence(bp: StandardBlueprint, evidence: readonly EvidenceItem[]): EvidenceCheck {
  const probes: Probe[] = []
  if (bp.durationMin) probes.push({ field: 'durationMin', expected: bp.durationMin, read: (v) => v.durationMin })
  probes.push({
    field: 'totalMarks',
    expected: bp.sections.reduce((n, s) => n + s.markBudget, 0),
    read: (v) => v.totalMarks,
  })
  for (const s of [...bp.sections].sort((a, b) => a.position - b.position)) {
    const at = (v: EvidenceValues) => v.sections?.find((x) => x.position === s.position)
    probes.push({ field: 'markBudget', sectionPosition: s.position, expected: s.markBudget, read: (v) => at(v)?.markBudget })
    probes.push({ field: 'rule', sectionPosition: s.position, expected: ruleValue(s.rule), read: (v) => {
      const r = at(v)?.rule
      return r === undefined ? undefined : ruleValue(r)
    } })
    probes.push({ field: 'questionCount', sectionPosition: s.position, expected: s.questionCount, read: (v) => at(v)?.questionCount })
  }
  const lines = probes.map((p) => buildLine(p, evidence))

  const bodiesWith = (kind: EvidenceKind) => new Set(evidence.filter((e) => e.kind === kind).map((e) => e.body))
  const papers = bodiesWith('trial_paper')
  const skemas = bodiesWith('skema')
  const both = [...papers].filter((b) => skemas.has(b))
  const hasLpm = evidence.some((e) => e.kind === 'lpm_format')
  const bodiesOk = hasLpm || both.length >= 2
  const completeness: EvidenceCheck['completeness'] = bodiesOk ? [] : [{ code: 'NO_EVIDENCE_BODIES' }]
  return { lines, completeness, passes: bodiesOk && lines.every((l) => l.status === 'ok') }
}
