/**
 * Composition of a complete question row from its facets: derived fields, cheap fields, facets,
 * then literal overrides (anchors). Used by the dataset (`derive` + `fields`), by the M04 anchor
 * fixtures and by `questions.anchorRow` (contributed anchors), so every path yields the same shape.
 */

import { hashKey } from '@/mock/dataset'
import { toIsoMyt } from '@/lib/time'

import type { Question, QuestionFacets } from '../repository/types'
import {
  deriveQuestionFields,
  generatedCreatedAtMs,
  hasExplanationOf,
  questionTextOf,
  sourceFileOf,
} from './question-derive'

/** The live id range of generated rows (SRS §6.13.1). */
export const QUESTION_ID_RANGE = { min: 1, max: 564_161 } as const

/** Facet names in the dataset's order (the cell key order). */
export const QUESTION_FACETS = [
  'subjectId',
  'educationLevelId',
  'pkskDomainId',
  'pkskTargetLevel',
  'status',
  'isActive',
  'questionType',
  'spmPool',
  'difficultyLevel',
  'complianceStatus',
  'aiVerified',
  'sourceType',
  'hasSourceFile',
  'dskpTagged',
  'dskpSpId',
  'needsDiagram',
  'qualityBucket',
  'legacyGeneric',
  'curriculumChapterId',
  'createdBy',
  'teacherDatabank',
  'coverageExcluded',
  'contribSchoolId',
] as const satisfies readonly (keyof QuestionFacets)[]

/** `createdAt` (ms) of a row that is not a generated slot (anchors outside the live range). */
export function anchorCreatedAtMs(key: number): number {
  return key <= QUESTION_ID_RANGE.max
    ? generatedCreatedAtMs(key)
    : generatedCreatedAtMs(1 + (hashKey(key, 41) % QUESTION_ID_RANGE.max))
}

export function pickFacets(row: object): QuestionFacets {
  const r = row as Readonly<Record<string, unknown>>
  const out: Record<string, unknown> = {}
  for (const f of QUESTION_FACETS) out[f] = r[f] === undefined ? null : r[f]
  return out as QuestionFacets
}

/**
 * A complete row for `id` with `facets`; `qualityScore` is the caller's (the dataset's cheap field
 * for generated rows, the literal value for anchors); `overrides` win over everything else.
 */
export function composeQuestion(
  id: number,
  facets: QuestionFacets,
  qualityScore: number | null,
  overrides: Partial<Question> = {},
): Question {
  const createdAtMs = overrides.createdAtMs ?? anchorCreatedAtMs(id)
  const createdAt = overrides.createdAt ?? toIsoMyt(createdAtMs)
  const row: Question = {
    ...deriveQuestionFields(id, facets),
    questionText: questionTextOf(id, facets),
    sourceFile: sourceFileOf(id, facets),
    hasExplanation: hasExplanationOf(id),
    qualityScore,
    createdAt,
    createdAtMs,
    updatedAt: createdAt,
    chapterLabel: null,
    curriculumTopicId: null,
    usageAttempts: 0,
    ...facets,
    ...overrides,
    id,
  }
  // Keep the derived pairs consistent with the overrides.
  if (overrides.explanation !== undefined) row.hasExplanation = overrides.explanation !== null
  if (overrides.usage !== undefined) row.usageAttempts = overrides.usage.attempts
  if (overrides.createdAt !== undefined && overrides.createdAtMs === undefined) {
    row.createdAtMs = Date.parse(overrides.createdAt)
  }
  return row
}
