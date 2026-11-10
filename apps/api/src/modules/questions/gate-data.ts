import type { QuestionPart } from '@pp/contract'

import { stimulusReferenceOf } from '../intake/workflow/figure-links'
import type { FlagPart } from './effective-leaf'
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
export type GateVersion = Pick<QuestionVersionRecord, 'stemMs' | 'parts' | 'subjectId' | 'educationLevelId' | 'chapterId' | 'unitId' | 'spIds' | 'difficultyTp' | 'difficultyLevel' | 'paperCode'> &
  Partial<Pick<QuestionVersionRecord, 'stimulusFlag' | 'stimulusFlagRef' | 'flagDismissedAt' | 'stemEn' | 'schemeRules'>>

/** The parts of a draft tree, flattened as the stimulus-flag detector reads them (the create-as-approved gate decides the flag before the row exists). */
export function flagPartsOf(parts: readonly QuestionPart[]): FlagPart[] {
  const out: FlagPart[] = []
  const walk = (list: readonly QuestionPart[]): void => {
    for (const p of list) {
      const options = 'options' in p ? p.options : []
      out.push({
        isLeaf: 'mode' in p,
        promptMs: p.prompt?.ms ?? null,
        promptEn: p.prompt?.en ?? null,
        optionTexts: options.flatMap((o) => [o.body?.ms ?? null, o.body?.en ?? null]),
        hasStimulus: (p as { stimulusId?: string }).stimulusId != null,
        hasOptionImage: options.some((o) => o.imageId != null),
      })
      if ('children' in p) walk(p.children)
    }
  }
  walk(parts)
  return out
}

/** The first figure reference the question text names ("Rajah 3"), as the servability read finds it (rows 25 text). */
function stimulusRefTextOf(v: GateVersion): string | null {
  const texts: (string | null | undefined)[] = [v.stemMs, v.stemEn]
  const walk = (parts: readonly QuestionPart[]): void => {
    for (const p of parts) {
      texts.push(p.prompt?.ms, p.prompt?.en)
      if ('options' in p) for (const o of p.options) texts.push(o.body?.ms, o.body?.en)
      if ('children' in p) walk(p.children)
    }
  }
  walk(v.parts)
  for (const t of texts) {
    const found = typeof t === 'string' && t !== '' ? stimulusReferenceOf(t) : null
    if (found !== null) return found.text
  }
  return null
}

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
    paperCode: v.paperCode ?? null,
    spmBound,
    difficultyLevel: v.difficultyLevel,
    stem: v.stemMs,
    hasDskpNodes: facts.hasDskpNodes,
    hasChapters: facts.hasChapters,
    spOutsideUnit: facts.spOutsideUnit,
    stimulusFlag: v.stimulusFlag ?? null,
    flagDismissedAt: v.flagDismissedAt ?? null,
    stimulusRefText: v.stimulusFlag === 'stimulus_missing' ? stimulusRefTextOf(v) : null,
    ...(v.schemeRules ? { schemeRules: v.schemeRules } : {}),
  }
}
