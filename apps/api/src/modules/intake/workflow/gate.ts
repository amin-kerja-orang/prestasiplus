import {
  INTAKE_GATE_MESSAGES as G,
  type IntakeIssue,
  type IntakeQuestion,
  type IntakeScheme,
  type IntakeStimulus,
} from '@pp/contract'

/**
 * Quality gate of one intake item (prototype `admin/intake/domain/validation.ts` + `marks.ts`, v2-question-bank 4.8).
 * Pure: everything it needs from the database is passed in as `CurriculumFacts` and the stimulus. The messages are the
 * contract copy (`INTAKE_GATE_MESSAGES`); the rules are the prototype's one for one, plus the two [PROPOSED] rules of the
 * card (unit in the curriculum list, figure resolved to a stored crop).
 */

/** What the curriculum owner (BE-08) says about the tag of an item. `null` = not looked up. */
export interface CurriculumFacts {
  subjectKnown: boolean
  levelKnown: boolean
  /** Is `tag.unit` a unit of the curriculum list for the subject and level; null when the item has no unit. */
  unitKnown: boolean | null
}

/** Marks a scheme can award, counting "any N of M" groups as N points (prototype `schemeTotal`). */
export function schemeTotal(scheme: IntakeScheme | undefined): number {
  if (!scheme) return 0
  if (scheme.kind !== 'points') return scheme.marks
  const grouped = new Set<string>()
  let total = 0
  for (const g of scheme.groups ?? []) {
    const pts = scheme.points.filter((p) => g.pointIds.includes(p.id))
    pts.forEach((p) => grouped.add(p.id))
    const marks = pts.map((p) => p.marks).sort((a, b) => b - a)
    total += marks.slice(0, g.anyN).reduce((n, m) => n + m, 0)
  }
  for (const p of scheme.points) if (!grouped.has(p.id)) total += p.marks
  return total
}

export function questionMarks(q: Pick<IntakeQuestion, 'parts' | 'marks'>): number {
  return q.parts.length > 0 ? q.parts.reduce((n, p) => n + p.marks, 0) : q.marks
}

/** Every rule that stops a single accept for this item (the item-level and stimulus-level rules). */
export function itemIssues(q: IntakeQuestion, stimulus: IntakeStimulus | undefined, facts: CurriculumFacts): IntakeIssue[] {
  const issues: IntakeIssue[] = []
  const where = `Soalan ${q.label}`
  const add = (w: string, message: string): void => {
    issues.push({ itemId: q.id, where: w, message })
  }
  const label = (part = ''): string => `${where}${part}`

  if (!q.stem.trim() && q.parts.length === 0) add(where, G.stemEmpty)
  if (q.needsManual) add(where, G.needsManual)

  if (q.type === 'mcq') {
    if (q.options.length < 2) add(where, G.mcqOptionsMin)
    if (q.options.some((o) => !o.text.trim())) add(where, G.mcqOptionEmpty)
    const key = q.scheme?.kind === 'option' ? q.scheme.correct : ''
    if (!q.options.some((o) => o.id === key)) add(where, G.mcqKeyMissing)
    if (q.marks <= 0) add(where, G.marksPositive)
  } else if (q.parts.length > 0) {
    for (const p of q.parts) {
      const pw = label(p.label)
      if (!p.prompt.trim()) add(pw, G.partPromptEmpty)
      if (p.marks <= 0) add(pw, G.marksPositive)
      if (!p.scheme) add(pw, G.schemeMissing)
      else if (schemeTotal(p.scheme) !== p.marks) add(pw, G.schemeTotalPart(schemeTotal(p.scheme), p.marks))
      if (p.scheme?.kind === 'points' && p.scheme.points.some((pt) => !pt.label.trim())) add(pw, G.schemePointNoLabel)
    }
  } else {
    if (q.marks <= 0) add(where, G.marksPositive)
    if (!q.scheme) add(where, G.schemeMissing)
    else if (schemeTotal(q.scheme) !== q.marks) add(where, G.schemeTotalQuestion(schemeTotal(q.scheme), q.marks))
  }
  if (questionMarks(q) <= 0 && q.type !== 'mcq' && q.parts.length > 0) add(where, G.questionMarksZero)

  const t = q.tag
  if (!t.subject || !t.level || !facts.subjectKnown || !facts.levelKnown) add(where, G.subjectLevelMissing)
  if (t.unit === null && t.formOrigin !== 'T1-T3') add(where, G.unitMissing)
  if (t.unit !== null && facts.unitKnown === false) add(where, G.unitNotInTaxonomy)
  if (t.sp.length === 0) add(where, G.spMissing)
  if (!(t.tp >= 1 && t.tp <= 6)) add(where, G.tpRange)
  for (const f of q.lowFields) if (!q.confirmed.includes(f)) add(where, G.lowFieldUnconfirmed(f))

  if (q.stimulusId !== undefined && !stimulus) add(where, G.stimulusMissing)
  if (stimulus) {
    if (!stimulus.alt.trim()) add(stimulus.label || where, G.stimulusAltMissing)
    if (stimulus.kind === 'diagram' && !stimulus.figureId && !stimulus.svg) add(stimulus.label || where, G.figureNotResolved)
  }
  return issues
}

export interface BatchLevelInput {
  itemCount: number
  source: string
  copyright: string | null
  groups: ReadonlyArray<{ stimulusId: string; contiguous: boolean }>
  stimuli: ReadonlyArray<IntakeStimulus>
}

/** The rules that do NOT block a single accept: they are enforced later by the BE-10 submit gate. */
export function batchLevelIssues(input: BatchLevelInput): IntakeIssue[] {
  const issues: IntakeIssue[] = []
  if (input.itemCount === 0) issues.push({ where: 'Kertas', message: G.noQuestions })
  if (!input.source.trim()) issues.push({ where: 'Kertas', message: G.sourceRequired })
  if (!input.copyright) issues.push({ where: 'Kertas', message: G.copyrightRequired })
  for (const g of input.groups) {
    if (!g.contiguous) {
      const s = input.stimuli.find((x) => x.id === g.stimulusId)
      issues.push({ where: s?.label || 'Kumpulan', message: G.groupNotContiguous })
    }
  }
  return issues
}

/** Stimulus-level rules of the whole batch (no item id), in stimulus order. */
export function stimulusIssues(stimuli: ReadonlyArray<IntakeStimulus>): IntakeIssue[] {
  const issues: IntakeIssue[] = []
  for (const s of stimuli) {
    if (!s.alt.trim()) issues.push({ where: s.label || 'Rajah', message: G.stimulusAltMissing })
    if (s.kind === 'diagram' && !s.figureId && !s.svg) issues.push({ where: s.label || 'Rajah', message: G.figureNotResolved })
  }
  return issues
}
