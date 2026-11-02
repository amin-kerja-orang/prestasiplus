import type { QuestionPart } from '@pp/contract'

import { leavesOf } from './grading'
import type { GateFacts, QuestionVersionRecord } from './types'
import type { QuestionGateData } from './workflow/ports'

/**
 * The ONE builder of the data the submit and approve gates read (`GATES`, R1-H-A18). The lifecycle transition, `gate-check`, the bulk
 * action, the create-as-approved shortcut and the workflow bank adapter all call it, so no path has its own "satisfied" defaults.
 * The facts that live in other rows (rights, duplicates, low-confidence fields, media, who edited last, declared marks) come from
 * `QuestionsRepository.gateFacts`; the rest is read from the version itself.
 */

/** Text of the question anywhere: the stem or the prompt of a leaf. */
const hasText = (stem: string | null, parts: readonly QuestionPart[]): boolean =>
  (stem ?? '').trim() !== '' || leavesOf(parts).some(({ leaf }) => (leaf.prompt?.ms ?? '').trim() !== '' || (leaf.prompt?.en ?? '').trim() !== '')

/** Field names of the required content that is empty: a question with no text at all, or with no leaf. */
export function missingRequiredFieldsOf(stem: string | null, parts: readonly QuestionPart[]): string[] {
  const missing: string[] = []
  if (!hasText(stem, parts)) missing.push('questionText')
  if (parts.length === 0) missing.push('parts')
  return missing
}

/** What the builder reads of a version (a stored one, or a draft that is not stored yet). */
export type GateVersion = Pick<QuestionVersionRecord, 'stemMs' | 'parts' | 'subjectId' | 'educationLevelId' | 'chapterId' | 'unitId' | 'spIds' | 'difficultyTp' | 'paperCode'>

export function gateDataOf(
  record: { id: string; version: GateVersion },
  facts: GateFacts,
  spmBound: boolean,
): QuestionGateData {
  const v = record.version
  return {
    id: record.id,
    parts: v.parts,
    marks: facts.declaredMarks,
    subjectId: v.subjectId,
    educationLevelId: v.educationLevelId,
    chapterId: v.chapterId,
    unitId: v.unitId,
    spIds: v.spIds,
    tp: v.difficultyTp,
    unconfirmedLowConfidenceFields: facts.unconfirmedLowConfidenceFields,
    hasOpenDuplicateFlag: facts.hasOpenDuplicateFlag,
    mediaResolved: facts.mediaResolved,
    missingRequiredFields: missingRequiredFieldsOf(v.stemMs, v.parts),
    lastEditedByAi: facts.lastEditedByAi,
    sourceTakenDown: facts.sourceTakenDown,
    paperCode: v.paperCode ?? null,
    spmBound,
  }
}
