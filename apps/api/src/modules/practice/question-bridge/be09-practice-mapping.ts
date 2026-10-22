/**
 * BE-09 question bank -> BE-12 practice mapping. PURE: no database, no clock.
 *
 * Practice serves single-answer MCQ questions only (`PracticeQuestion.questionType` is `mcq`; the quiz
 * screen has four option buttons and no stimulus panel). A stored version is servable when ALL hold:
 * - `question_versions.type` is `mcq` and its part tree is exactly ONE `mcq` leaf;
 * - every option is text only (no `imageId`): the quiz screen shows option text only;
 * - no stimulus is attached (version stimuli, a leaf `stimulusId` or a stimulus group): the quiz screen
 *   cannot show it, and the question would be unanswerable without it;
 * - the key names one of the options (the contract already enforces it; checked again, fail closed).
 * Anything else is refused (`null` + a reason) and never served half-mapped.
 */
import type { QuestionPart } from '@pp/contract'

import { directionOf, scriptOf } from '../../questions/projection'
import type { QuestionRecord } from '../../questions/types'
import type { PracticeQuestion } from '../ports'

type Leaf = Extract<QuestionPart, { mode: string }>
type McqLeaf = Extract<Leaf, { mode: 'mcq' }>

const isLeaf = (p: QuestionPart): p is Leaf => 'mode' in p

/** Mock difficulty scale (1 to 5): TP 6 reads back as 5 (same rule as the flat projection). */
export const difficultyOfTp = (tp: number | null): number | null => (tp === null ? null : Math.min(5, Math.max(1, tp)))

/** The TPs a mock difficulty (1 to 5) selects: 5 also takes TP 6, the inverse of `difficultyOfTp`. */
export const tpsOfDifficulty = (difficulty: number): number[] => (difficulty >= 5 ? [5, 6] : [difficulty])

export type Refusal = { ok: false; reason: string }

/** The single MCQ leaf of a servable version, or why it is refused. */
export function servableMcq(record: QuestionRecord): { ok: true; leaf: McqLeaf } | Refusal {
  const v = record.version
  if (v.type !== 'mcq') return { ok: false, reason: `type ${v.type} is not served by practice` }
  if (v.parts.length !== 1) return { ok: false, reason: 'an MCQ must have exactly one part' }
  const only = v.parts[0] as QuestionPart
  if (!isLeaf(only) || only.mode !== 'mcq') return { ok: false, reason: 'the only part is not an MCQ leaf' }
  if (record.groupId !== null || v.stimulusIds.length > 0 || only.stimulusId != null)
    return { ok: false, reason: 'a stimulus cannot be shown on the practice screen' }
  if (only.options.some((o) => o.imageId != null)) return { ok: false, reason: 'an option image cannot be shown' }
  if (!only.options.some((o) => o.label === only.key.correct)) return { ok: false, reason: 'the key names no option' }
  return { ok: true, leaf: only }
}

/**
 * One servable version as practice serves and grades it. `contributor` is resolved by the caller (the
 * teacher who created the question, else null). Returns null when the version is not servable.
 */
export function toPracticeQuestion(
  record: QuestionRecord,
  contributor: PracticeQuestion['contributor'],
): PracticeQuestion | null {
  const m = servableMcq(record)
  if (!m.ok) return null
  const v = record.version
  const stem = v.stemMs ?? ''
  const prompt = m.leaf.prompt.ms
  const questionText = stem && prompt && stem !== prompt ? `${stem}\n\n${prompt}` : stem || prompt
  return {
    id: record.id,
    versionNo: v.versionNo,
    subjectId: v.subjectId,
    educationLevelId: v.educationLevelId,
    chapterId: v.chapterId,
    topicId: v.topicId,
    difficulty: difficultyOfTp(v.difficultyTp),
    questionType: 'mcq',
    spmPool: record.spmPool,
    questionText,
    textDirection: directionOf(v.language),
    scriptType: scriptOf(v.language),
    // Contract: `hasDskp` = the question is linked to a curriculum chapter.
    hasDskp: v.chapterId !== null,
    contributor,
    options: m.leaf.options.map((o) => ({ label: o.label, text: o.body.ms })),
    correctLabel: m.leaf.key.correct,
    explanation: v.explanationMs,
  }
}
