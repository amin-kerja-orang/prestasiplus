/**
 * Pure marking and view building for attempts (port of the mock `BijakServer`: `gradeQuestion`,
 * `gradeAttempt`, `buildView`, `allowedParts`, `lockedParts`). No database, no clock, no HTTP: the
 * service hands in the frozen composition, the question bundles and the saved answers.
 *
 * Reveal rule (US-15): the VIEW builders below copy fields one by one (a whitelist), so a bundle
 * that carries extra data (a key, a scheme, an accepted value) can never leak into a served paper.
 * Keys and schemes appear only in what `gradeQuestion` / `gradeAttempt` return.
 */
import type {
  BijakAttemptGroup,
  BijakAttemptPartView,
  BijakAttemptQuestion,
  BijakAttemptQuestionResult,
  BijakAttemptResult,
  BijakAttemptSection,
  BijakAttemptStimulus,
} from '@pp/contract'

import {
  effectiveMarks,
  gradePart,
  isBlank,
  leavesOf,
  numericValue,
  type Leaf,
  type McqOption,
  type PartAnswer,
  type PartDef,
  type QuestionResult,
  type SectionResult,
  type SectionSnapshot,
  type StimulusDef,
} from './exam-core.adapter'
import { seedSuggestions } from './keyword-suggest'
import type { BijakQuestionBundle } from './ports'

export type Bundles = ReadonlyMap<string, BijakQuestionBundle>
/** Part id to the saved answer. */
export type AnswerMap = ReadonlyMap<string, PartAnswer>

export const MAX_CHECKS_PER_QUESTION = 3

export function bundleOf(bundles: Bundles, questionId: string): BijakQuestionBundle {
  const b = bundles.get(questionId)
  if (!b) throw new Error(`Question ${questionId} is not available`)
  return b
}

/** An MCQ question is its own leaf (id = question id); a structured one has leaf parts. */
export function leavesOfBundle(b: BijakQuestionBundle): Leaf[] {
  const q = b.question
  if (q.mcq) {
    return [{ id: q.id, label: '', prompt: q.stem, marks: questionMarks(b), kind: 'short_text', depth: 0 }]
  }
  return leavesOf(q.parts ?? [])
}

export function questionMarks(b: BijakQuestionBundle): number {
  const q = b.question
  if (q.mcq) return b.schemes[q.id]?.marks ?? 1
  return leavesOf(q.parts ?? []).reduce((n, l) => n + l.marks, 0)
}

/** Question ids of the composition in paper order. */
export function questionIdsOf(composition: readonly SectionSnapshot[]): string[] {
  return composition.flatMap((s) => s.questionIds)
}

/* --------------------------------------------------------------------------- leaf index */

export interface LeafInfo {
  questionId: string
  /** `mcq` for a multiple-choice question; else the leaf answer mode. */
  kind: string
  /** `essay_choice`: the topic ids the pupil may pick (REQ-B-014). Undefined for any other part. */
  topicIds?: readonly string[]
}

export interface LeafIndex {
  /** Every part id that takes an answer in this attempt. */
  parts: ReadonlyMap<string, LeafInfo>
  /** Part ids per question id. */
  byQuestion: ReadonlyMap<string, readonly string[]>
}

export function buildLeafIndex(composition: readonly SectionSnapshot[], bundles: Bundles): LeafIndex {
  const parts = new Map<string, LeafInfo>()
  const byQuestion = new Map<string, string[]>()
  for (const qid of questionIdsOf(composition)) {
    const b = bundleOf(bundles, qid)
    const leaves = leavesOfBundle(b)
    byQuestion.set(
      qid,
      leaves.map((l) => l.id),
    )
    for (const l of leaves) {
      parts.set(l.id, {
        questionId: qid,
        kind: b.question.mcq ? 'mcq' : l.kind,
        ...(!b.question.mcq && l.kind === 'essay_choice' ? { topicIds: (l.topics ?? []).map((t) => t.id) } : {}),
      })
    }
  }
  return { parts, byQuestion }
}

/** Latihan: after the check cap the answers of a question are final. */
export function lockedParts(mode: string, checkCounts: ReadonlyMap<string, number>, index: LeafIndex): Set<string> {
  const locked = new Set<string>()
  if (mode !== 'latihan') return locked
  for (const [qid, n] of checkCounts) {
    if (n < MAX_CHECKS_PER_QUESTION) continue
    for (const id of index.byQuestion.get(qid) ?? []) locked.add(id)
  }
  return locked
}

/* ------------------------------------------------------------------------------ grading */

export function gradeQuestion(
  composition: readonly SectionSnapshot[],
  bundles: Bundles,
  answers: AnswerMap,
  questionId: string,
  number: number,
  counted: boolean,
): QuestionResult {
  const b = bundleOf(bundles, questionId)
  const section = composition.find((s) => s.questionIds.includes(questionId))
  if (!section) throw new Error(`Question ${questionId} is not in the composition`)
  const finals: Record<string, number | null> = {}
  const parts = leavesOfBundle(b).map((leaf) => {
    const scheme = b.schemes[leaf.id]
    if (!scheme) throw new Error(`No scheme for part ${leaf.id}`)
    const answer = answers.get(leaf.id)
    const res = gradePart({
      part: { id: leaf.id, label: leaf.label, prompt: leaf.prompt, marks: leaf.marks, kind: b.question.mcq ? 'mcq' : leaf.kind },
      scheme,
      answer,
      ctx: { previousFinals: finals },
    })
    finals[leaf.id] = numericValue(answer?.final ?? '')
    return res
  })
  return {
    questionId,
    number,
    sectionId: section.id,
    marks: parts.reduce((n, p) => n + p.marks, 0),
    awarded: parts.reduce((n, p) => n + p.awarded, 0),
    counted,
    attempted: leavesOfBundle(b).some((l) => !isBlank(answers.get(l.id))),
    parts,
  }
}

export function gradeAttempt(composition: readonly SectionSnapshot[], bundles: Bundles, answers: AnswerMap): BijakAttemptResult {
  let n = 0
  const questions: QuestionResult[] = []
  for (const s of composition) for (const qid of s.questionIds) questions.push(gradeQuestion(composition, bundles, answers, qid, ++n, true))
  seedSuggestions(questions, bundles, answers)
  return assembleResult(composition, questions)
}

/**
 * Sections, choose-N ranking and totals from graded questions. Used by the first grading and again when
 * a self-mark changes a part (R1-B12), so a raised mark can change WHICH questions count (V2 recomputeScore
 * -> ExamBestNScorer). Sets `counted` on the questions it is given.
 */
export function assembleResult(composition: readonly SectionSnapshot[], questions: QuestionResult[]): BijakAttemptResult {
  const byId = new Map(questions.map((q) => [q.questionId, q]))
  const sections: SectionResult[] = []
  for (const s of composition) {
    const qs = s.questionIds.map((qid) => byId.get(qid) as QuestionResult)
    for (const q of qs) q.counted = true
    let counted = qs
    if (s.rule.type === 'choose') {
      // Best N attempted by marks (ties: the lower position). Ticks never change the score.
      const ranked = qs
        .map((q, pos) => ({ q, pos }))
        .filter((x) => x.q.attempted)
        .sort((x, y) => y.q.awarded - x.q.awarded || x.pos - y.pos)
        .slice(0, s.rule.n)
      const ids = new Set(ranked.map((x) => x.q.questionId))
      for (const q of qs) q.counted = ids.has(q.questionId)
      counted = qs.filter((q) => q.counted)
    }
    sections.push({
      sectionId: s.id,
      label: s.label,
      marks: effectiveMarks(s.rule, qs.map((q) => q.marks)),
      awarded: counted.reduce((x, q) => x + q.awarded, 0),
      ...(s.rule.type === 'choose' ? { chooseN: s.rule.n } : {}),
      counted: counted.map((q) => q.questionId),
    })
  }
  const score = sections.reduce((x, s) => x + s.awarded, 0)
  const max = sections.reduce((x, s) => x + s.marks, 0)
  const pending = questions
    .filter((q) => q.counted)
    .flatMap((q) => q.parts)
    .filter((p) => p.status === 'belum_dimarkah').length
  return {
    score,
    max,
    percent: max ? Math.round((score / max) * 1000) / 10 : 0,
    provisional: pending > 0,
    pendingReview: pending,
    sections,
    questions,
    coins: score * 2,
    points: score * 10,
  }
}

/** The graded question of a "Semak" check or a `checks` entry of the view. */
export function checkResult(
  composition: readonly SectionSnapshot[],
  bundles: Bundles,
  answers: AnswerMap,
  questionId: string,
): BijakAttemptQuestionResult {
  const number = questionIdsOf(composition).indexOf(questionId) + 1
  return gradeQuestion(composition, bundles, answers, questionId, number, true)
}

/* ---------------------------------------------------------------------- the served paper */

function partView(p: PartDef): BijakAttemptPartView {
  return {
    id: p.id,
    label: p.label,
    prompt: p.prompt,
    marks: p.marks,
    ...(p.answer
      ? {
          answer: {
            kind: p.answer.kind,
            ...(p.answer.unit !== undefined ? { unit: p.answer.unit } : {}),
            ...(p.answer.wordRange ? { wordRange: { min: p.answer.wordRange.min, max: p.answer.wordRange.max } } : {}),
            ...(p.answer.topics ? { topics: p.answer.topics.map((t) => ({ id: t.id, label: t.label })) } : {}),
          },
        }
      : {}),
    ...(p.children ? { children: p.children.map(partView) } : {}),
  }
}

export function stimulusView(s: StimulusDef): BijakAttemptStimulus {
  return {
    id: s.id,
    kind: s.kind,
    label: s.label,
    ...(s.title !== undefined ? { title: s.title } : {}),
    ...(s.caption !== undefined ? { caption: s.caption } : {}),
    alt: s.alt,
    ...(s.svg !== undefined ? { svg: s.svg } : {}),
    ...(s.text !== undefined ? { text: s.text } : {}),
    ...(s.source !== undefined ? { source: s.source } : {}),
    ...(s.table ? { table: { head: [...s.table.head], rows: s.table.rows.map((r) => [...r]) } } : {}),
    ...(s.image ? { image: { ...s.image } } : {}),
  }
}

/** An option as served: text, plus its picture when it has one (the URL is a file token URL, never a key). */
function optionView(o: McqOption): { id: string; text: string; image?: { url: string; width?: number; height?: number; alt?: string } } {
  return { id: o.id, text: o.text, ...(o.image ? { image: { ...o.image } } : {}) }
}

export interface ServedPaper {
  sections: BijakAttemptSection[]
  questions: BijakAttemptQuestion[]
  groups: BijakAttemptGroup[]
}

export function buildServedPaper(composition: readonly SectionSnapshot[], bundles: Bundles): ServedPaper {
  let n = 0
  const numberOf = new Map<string, number>()
  for (const s of composition) for (const qid of s.questionIds) numberOf.set(qid, ++n)
  const questions: BijakAttemptQuestion[] = []
  const sections: BijakAttemptSection[] = composition.map((s) => {
    const marks = s.questionIds.map((qid) => questionMarks(bundleOf(bundles, qid)))
    for (const qid of s.questionIds) {
      const b = bundleOf(bundles, qid)
      const q = b.question
      questions.push({
        id: q.id,
        number: numberOf.get(q.id) as number,
        sectionId: s.id,
        topic: q.curriculum.unitLabel,
        formOrigin: q.curriculum.formOrigin,
        ...(q.groupId && b.group?.optionBank
          ? { optionBank: b.group.optionBank.map(optionView) }
          : {}),
        ...(q.groupId ? { groupId: q.groupId } : {}),
        stem: q.stem,
        ...(q.stemImage ? { stemImage: stimulusView(q.stemImage) } : {}),
        ...(q.stimuli && q.stimuli.length > 0 ? { stimuli: q.stimuli.map(stimulusView) } : {}),
        marks: questionMarks(b),
        ...(q.mcq ? { mcq: { options: q.mcq.options.map(optionView) } } : {}),
        ...(q.parts ? { parts: q.parts.map(partView) } : {}),
      })
    }
    return {
      id: s.id,
      label: s.label,
      ...(s.compulsory ? { compulsory: true as const } : {}),
      ...(s.instruction ? { instruction: s.instruction } : {}),
      rule: s.rule.type === 'all' ? { type: 'all' as const } : { type: 'choose' as const, n: s.rule.n },
      questionIds: [...s.questionIds],
      marks: marks.reduce((x, y) => x + y, 0),
      effectiveMarks: effectiveMarks(s.rule, marks),
    }
  })
  const groups: BijakAttemptGroup[] = []
  const seen = new Set<string>()
  for (const q of questions) {
    if (!q.groupId || seen.has(q.groupId)) continue
    seen.add(q.groupId)
    const b = bundleOf(bundles, q.id)
    if (!b.group) continue
    const ids = questions.filter((x) => x.groupId === q.groupId).map((x) => x.id)
    const nums = ids.map((id) => numberOf.get(id) as number)
    groups.push({
      id: b.group.id,
      stimulus: stimulusView(b.group.stimulus),
      stimuli: (b.group.stimuli ?? [b.group.stimulus]).map(stimulusView),
      from: Math.min(...nums),
      to: Math.max(...nums),
      questionIds: ids,
    })
  }
  return { sections, questions, groups }
}
