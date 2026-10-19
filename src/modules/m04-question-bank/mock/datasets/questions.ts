/**
 * The `questions` virtual dataset (owner M04; D11/D12; SRS v1.11 §6.13.1): 466,041 rows = 465,278
 * objective questions + 763 PKSK rows, generated ids 1–564,161, reserved anchor ranges
 * 570001–570025 (M04), 600001–699999 (M05), 700001–700999 (M08 / M10 / M11) and 701001–701099
 * (M18), runtime ids from 9,000,001 (XL-37).
 *
 * - Facets: `QUESTION_FACETS` (every count-relevant field of §6.13.1).
 * - Cheap fields (filters, sorts and search without derivation, overview §6.6 owner rule):
 *   `questionText` (S1 search, indexed at boot via `searchFields`), `sourceFile`,
 *   `hasExplanation`, `qualityScore`, `createdAt`, `createdAtMs` (the "newest first" key),
 *   `chapterLabel`, `curriculumTopicId`, `usageAttempts`.
 * - Layout blocks: user-1 rows take consecutive ids from 522425 (Q-CONTRIB, M10 S21); PKSK rows
 *   take consecutive ids from 177698 (the M07 range; M07's anchors then replace them).
 *
 * Private to M04: other modules use the `questions` repository (D12).
 * Bump the M04 plugin `version` whenever `derive` or a cheap field changes (overview §6.9).
 */

import { floor } from '@/mock/define'
import { defineVirtualDataset } from '@/mock/dataset'
import { toIsoMyt } from '@/lib/time'

import { COVERAGE_CREATED_AT, M04_ANCHORS, type AnchorDef } from '../data/anchors'
import { PKSK_ID_RANGE, QUESTION_ABSENT_IDS, USER1_BLOCK_START } from '../data/tables'
import type {
  Question,
  QuestionCheapKey,
  QuestionFacetKey,
  QuestionFacets,
} from '../repository/types'
import {
  deriveQuestionFields,
  generatedCreatedAtMs,
  hasExplanationOf,
  questionTextOf,
  sourceFileOf,
} from './question-derive'
import { composeQuestion, QUESTION_FACETS, QUESTION_ID_RANGE } from './question-row'
import { DEFAULT_SCORE, solveQualityScores, type PinnedScore } from './quality'
import { facetKey, questionSpec } from './questions-spec'

/** Runtime ids (S2 create, S5 import, teacher writes): 9,000,001 upwards (XL-37). */
export const QUESTIONS_RUNTIME_FLOOR = 9_000_001

export const QUESTION_RESERVED_RANGES: readonly (readonly [number, number])[] = [
  [570001, 570025],
  [600001, 699999],
  [700001, 700999],
  [701001, 701099],
]

/** The literal row of an M04 anchor. */
export function anchorRowOf(a: AnchorDef): Question {
  const coverage = a.id >= 570001 && a.id <= 570025
  const overrides =
    coverage && a.overrides.createdAt === undefined
      ? { createdAt: COVERAGE_CREATED_AT, ...a.overrides }
      : a.overrides
  return composeQuestion(a.id, a.facets, a.qualityScore, overrides)
}

export const M04_ANCHOR_ROWS: readonly Question[] = M04_ANCHORS.map(anchorRowOf)

/** Pinned scores of the scored anchors (they count in the S6 means). */
export const PINNED_SCORES: readonly PinnedScore[] = M04_ANCHORS.filter(
  (a) => a.qualityScore !== null,
).map((a) => ({ facets: a.facets, score: a.qualityScore as number }))

// --- qualityScore (cheap) --------------------------------------------------------------------

let scoreByKey: Map<string, number> | null = null
const scoreCache = new WeakMap<object, number | null>()

function scoreTable(): Map<string, number> {
  scoreByKey ??= solveQualityScores(questionSpec().cells, PINNED_SCORES)
  return scoreByKey
}

/** The generated `qualityScore` of a cell (one value per facet tuple). */
export function qualityScoreOf(facets: Readonly<QuestionFacets>): number | null {
  const hit = scoreCache.get(facets)
  if (hit !== undefined) return hit
  const score =
    facets.qualityBucket === 'unscored'
      ? null
      : (scoreTable().get(facetKey(facets)) ?? DEFAULT_SCORE[facets.qualityBucket])
  scoreCache.set(facets, score)
  return score
}

// --- the dataset -----------------------------------------------------------------------------

export const questionsDataset = defineVirtualDataset<Question, QuestionFacetKey, QuestionCheapKey>({
  name: 'questions',
  owner: 'M04',
  idRange: QUESTION_ID_RANGE,
  reservedAnchorRanges: QUESTION_RESERVED_RANGES,
  runtimeIds: floor({ start: QUESTIONS_RUNTIME_FLOOR }),
  absentIds: QUESTION_ABSENT_IDS,
  facets: QUESTION_FACETS,
  distribution: () => questionSpec().cells,
  derive: (id, facets) => deriveQuestionFields(id, facets),
  fields: {
    questionText: (key, f) => questionTextOf(key, f),
    sourceFile: (key, f) => sourceFileOf(key, f),
    hasExplanation: (key) => hasExplanationOf(key),
    qualityScore: (_key, f) => qualityScoreOf(f),
    createdAt: (key) => toIsoMyt(generatedCreatedAtMs(key)),
    createdAtMs: (key) => generatedCreatedAtMs(key),
    chapterLabel: () => null,
    curriculumTopicId: () => null,
    usageAttempts: () => 0,
  },
  searchFields: ['questionText'],
  anchors: M04_ANCHOR_ROWS,
  order: { field: 'createdAtMs', generated: generatedCreatedAtMs },
  layout: {
    blocks: [
      {
        label: 'pksk',
        cells: (f) => f.pkskDomainId !== null,
        fromId: PKSK_ID_RANGE.min,
        contiguous: true,
        // The 763 PKSK ids are a documented run (SRS §6.13: 177698–178460, E2E-M04-62).
        dense: true,
      },
      {
        label: 'user-1',
        cells: (f) => f.createdBy === 1,
        fromId: USER1_BLOCK_START,
        contiguous: true,
      },
    ],
  },
})
