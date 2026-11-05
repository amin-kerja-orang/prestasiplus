import {
  IMAGE_STIMULUS_KINDS,
  INTAKE_GATE_MESSAGES as G,
  type IntakeIssue,
  type IntakeQuestion,
  type IntakeScheme,
  type IntakeStimulus,
} from '@pp/contract'

/** Kinds whose content is a picture (diagram, graph, map, infographic, image): they need a resolved figure crop. */
const isImageKind = (kind: string): boolean => (IMAGE_STIMULUS_KINDS as readonly string[]).includes(kind)

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
  /** The codes of `tag.sp` that are not an SP of the subject and level (REQ-B-034); empty when all are known or the subject/level is not. */
  unknownSp: readonly string[]
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

/** Collects the issues of one item; every issue carries the item id and the "Soalan {no}" place. */
function collector(q: IntakeQuestion) {
  const issues: IntakeIssue[] = []
  const where = `Soalan ${q.label}`
  const add = (w: string, message: string): void => {
    issues.push({ itemId: q.id, where: w, message })
  }
  return { issues, where, add, label: (part = ''): string => `${where}${part}` }
}
type Collector = ReturnType<typeof collector>

// The check helpers below are shared by `itemIssues` (review summary) and `draftIssues` (manual Terima).

function stemChecks(q: IntakeQuestion, c: Collector): void {
  if (!q.stem.trim() && q.parts.length === 0) c.add(c.where, G.stemEmpty)
  if (q.needsManual) c.add(c.where, G.needsManual)
}

/** Answer format: options, key, marks, parts and scheme totals. */
function formatChecks(q: IntakeQuestion, c: Collector): void {
  const { where, add, label } = c
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
}

function subjectLevelCheck(q: IntakeQuestion, facts: CurriculumFacts, c: Collector): void {
  const t = q.tag
  if (!t.subject || !t.level || !facts.subjectKnown || !facts.levelKnown) c.add(c.where, G.subjectLevelMissing)
}

function unitTaxonomyCheck(q: IntakeQuestion, facts: CurriculumFacts, c: Collector): void {
  if (q.tag.unit !== null && facts.unitKnown === false) c.add(c.where, G.unitNotInTaxonomy)
}

function spTaxonomyCheck(facts: CurriculumFacts, c: Collector): void {
  for (const code of facts.unknownSp) c.add(c.where, G.spNotInTaxonomy(code))
}

function stimulusChecks(q: IntakeQuestion, stimulus: IntakeStimulus | undefined, c: Collector): void {
  if (q.stimulusId !== undefined && !stimulus) c.add(c.where, G.stimulusMissing)
  if (stimulus) {
    if (!stimulus.alt.trim()) c.add(stimulus.label || c.where, G.stimulusAltMissing)
    if (isImageKind(stimulus.kind) && !stimulus.figureId && !stimulus.svg) c.add(stimulus.label || c.where, G.figureNotResolved)
  }
}

/** Every rule that applies to a single item (the item-level and stimulus-level rules); feeds the review summary. */
export function itemIssues(q: IntakeQuestion, stimulus: IntakeStimulus | undefined, facts: CurriculumFacts): IntakeIssue[] {
  const c = collector(q)
  const t = q.tag
  stemChecks(q, c)
  formatChecks(q, c)
  subjectLevelCheck(q, facts, c)
  if (t.unit === null && t.formOrigin !== 'T1-T3') c.add(c.where, G.unitMissing)
  unitTaxonomyCheck(q, facts, c)
  if (t.sp.length === 0) c.add(c.where, G.spMissing)
  spTaxonomyCheck(facts, c)
  if (!(t.tp >= 1 && t.tp <= 6)) c.add(c.where, G.tpRange)
  for (const f of q.lowFields) if (!q.confirmed.includes(f)) c.add(c.where, G.lowFieldUnconfirmed(f))
  stimulusChecks(q, stimulus, c)
  return c.issues
}

/**
 * What a manual Terima needs to create a Draf (S1-T04, FR-ADM-QE4.3): content, answer format, subject/level, a unit or SP that
 * is NOT in the curriculum list, and the stimulus. A missing unit, SP or TP and an unconfirmed low-confidence field do NOT block
 * (they are asked later at Hantar/Terbitkan). Each message is prefixed "Soalan {no}: " (the number as shown in review).
 */
export function draftIssues(q: IntakeQuestion, stimulus: IntakeStimulus | undefined, facts: CurriculumFacts): IntakeIssue[] {
  const c = collector(q)
  stemChecks(q, c)
  formatChecks(q, c)
  subjectLevelCheck(q, facts, c)
  unitTaxonomyCheck(q, facts, c)
  spTaxonomyCheck(facts, c)
  stimulusChecks(q, stimulus, c)
  const no = q.label.trim()
  return no === '' ? c.issues : c.issues.map((i) => ({ ...i, message: `Soalan ${no}: ${i.message}` }))
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
    if (isImageKind(s.kind) && !s.figureId && !s.svg) issues.push({ where: s.label || 'Rajah', message: G.figureNotResolved })
  }
  return issues
}
