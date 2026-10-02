/**
 * The M04 named count queries (SRS v1.10 §4.1; D11): every question count on every screen of M01,
 * M03, M04, M05, M06, M08 and M10 is one of these, on one dataset. `expected` carries the
 * documented values; `checkNamedQueries` (unit test) compares them with the compiled dataset.
 *
 * Parameters are optional where the SRS writes the per-subject / per-level forms, e.g.
 * `questions.count('Q-ELIGIBLE')` = 128,989 and `questions.count('Q-ELIGIBLE', 3)` = 13,872.
 * An omitted parameter adds no condition (never `= null`).
 *
 * Q-DIFFICULTY(d) = (Q-ACTIVE ∪ Q-PKSK) at difficulty d: every PKSK row is active (all approved and
 * active live), so the union is `isActive = true` over both families.
 */

import { defineNamedQueries, type NamedQuery } from '@/mock/dataset'
import { RepositoryError } from '@/mock/repository'
import type { Where } from '@/mock/define'

import {
  ACTIVE_BY_LEVEL,
  APPROVED_BY_SUBJECT,
  ELIGIBLE_BY_SUBJECT,
  NAMED_SPS,
  NEEDS_DIAGRAM,
  Q_DIFFICULTY,
  Q_M17_COV,
  S1_TOTAL_BY_SUBJECT,
  SPM_POOL,
  S10_DIFFICULTY,
  STRUCTURED_BY_SUBJECT,
  TEACHER_CONTRIB,
  TOTALS,
  USER1_BY_SUBJECT,
} from '../data/tables'
import { questionsDataset } from '../datasets/questions'
import { structuredDataset } from '../datasets/structured'
import type { Question, QuestionType, StructuredQuestion } from './types'

/** Drops `undefined` values, so an omitted parameter never becomes an `= null` condition. */
export function compact<T extends object>(w: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(w)) if (v !== undefined) out[k] = v
  return out as T
}

type QW = Where<Question>

const OBJECTIVE: QW = { pkskDomainId: null }
const ELIGIBLE: QW = { pkskDomainId: null, status: 'approved', isActive: true }

/** Levels of Q-PRACTICE (Darjah 1–4, M05 S3). */
export const PRACTICE_LEVEL_IDS = [1, 2, 3, 4] as const

const perSubject = (table: Readonly<Record<number, number>>) =>
  Object.entries(table).map(([s, value]) => ({ args: [Number(s)] as const, value }))

const poolExpected = Object.entries(SPM_POOL).flatMap(([s, [t4, t5]]) => [
  { args: [Number(s)] as const, value: [...t4, ...t5].reduce((a, b) => a + b, 0) },
  ...t4.map((value, i) => ({ args: [Number(s), 10, i + 1] as const, value })),
  ...t5.map((value, i) => ({ args: [Number(s), 11, i + 1] as const, value })),
])

const baseQuestionQueries = defineNamedQueries(questionsDataset, {
  'Q-ALL': {
    where: (subjectId?: number, levelId?: number): QW =>
      compact({ ...OBJECTIVE, subjectId, educationLevelId: levelId }),
    expected: [
      { args: [], value: TOTALS.all },
      ...perSubject(S1_TOTAL_BY_SUBJECT),
      { args: [undefined, 1], value: 14778 },
    ],
    source: 'M04 §4.1 (S1 "Jumlah", tiles, D1 filter)',
  },
  'Q-APPROVED': {
    where: (subjectId?: number): QW => compact({ ...OBJECTIVE, status: 'approved', subjectId }),
    expected: [{ args: [], value: TOTALS.approved }, ...perSubject(APPROVED_BY_SUBJECT)],
    source: 'M04 §4.1 (S1 "lulus", DV-M04-18)',
  },
  'Q-ARCHIVED': {
    where: (subjectId?: number): QW => compact({ ...OBJECTIVE, status: 'archived', subjectId }),
    expected: TOTALS.archived,
    source: 'M04 §4.1',
  },
  'Q-ACTIVE': {
    where: (subjectId?: number, levelId?: number): QW =>
      compact({ ...OBJECTIVE, isActive: true, subjectId, educationLevelId: levelId }),
    expected: [
      { args: [], value: TOTALS.active },
      { args: [7], value: 15414 },
      { args: [1], value: 11688 },
      { args: [3], value: 13872 },
      { args: [21], value: 2970 },
      ...Object.entries(ACTIVE_BY_LEVEL).map(([l, value]) => ({
        args: [undefined, Number(l)],
        value,
      })),
    ],
    source: 'M04 §4.1 (M03 "Soalan", M05 "Statistik Subjek")',
  },
  'Q-ELIGIBLE': {
    where: (subjectId?: number, levelId?: number): QW =>
      compact({ ...ELIGIBLE, subjectId, educationLevelId: levelId }),
    expected: [{ args: [], value: TOTALS.eligible }, ...perSubject(ELIGIBLE_BY_SUBJECT)],
    source: 'M04 §4.1 (M05 cards, M01 login stat)',
  },
  'Q-ARCHIVED-ACTIVE': {
    where: (subjectId?: number): QW =>
      compact({ ...OBJECTIVE, status: 'archived', isActive: true, subjectId }),
    expected: [
      { args: [], value: TOTALS.archivedActive },
      { args: [7], value: TOTALS.archivedActive },
    ],
    source: 'M04 §4.1',
  },
  'Q-APPROVED-INACTIVE': {
    where: (subjectId?: number): QW =>
      compact({ ...OBJECTIVE, status: 'approved', isActive: false, subjectId }),
    expected: TOTALS.approvedInactive,
    source: 'M04 §4.1',
  },
  'Q-PKSK': {
    where: (domainId?: number, targetLevel?: 'T1' | 'T4'): QW =>
      compact({ pkskDomainId: domainId ?? { ne: null }, pkskTargetLevel: targetLevel }),
    expected: [
      { args: [], value: TOTALS.pksk },
      { args: [undefined, 'T1'], value: 383 },
      { args: [undefined, 'T4'], value: 380 },
    ],
    source: 'M04 §4.1, M07 S5',
  },
  'Q-SCORED': {
    where: (subjectId?: number, levelId?: number): QW =>
      compact({
        ...OBJECTIVE,
        qualityBucket: ['cemerlang', 'baik', 'le50'],
        subjectId,
        educationLevelId: levelId,
      }),
    expected: TOTALS.scored,
    source: 'M04 §4.1 (S6)',
  },
  'Q-PRACTICE': {
    where: (subjectId: number, levelId?: number): QW =>
      compact({
        ...ELIGIBLE,
        questionType: 'mcq',
        subjectId,
        educationLevelId: levelId ?? [...PRACTICE_LEVEL_IDS],
      }),
    expected: [
      { args: [1], value: 4833 },
      { args: [1, 1], value: 958 },
      { args: [1, 2], value: 2540 },
      { args: [3, 1], value: 2734 },
    ],
    source: 'M04 §4.1 (M05 S3/S4)',
  },
  'Q-CHAPTER': {
    where: (chapterId: number): QW => ({
      ...ELIGIBLE,
      questionType: 'mcq',
      curriculumChapterId: chapterId,
    }),
    expected: [
      { args: [1], value: 464 },
      { args: [143], value: 302 },
      { args: [136], value: 316 },
      { args: [35], value: 320 },
      { args: [36], value: 317 },
      { args: [2], value: 321 },
    ],
    source: 'M04 §6.13.1 curriculumChapterId (M05 S5 chapter totals)',
  },
  'Q-DIFFICULTY': {
    where: (difficulty: number): QW => ({ isActive: true, difficultyLevel: difficulty }),
    expected: Q_DIFFICULTY.map((value, i) => ({ args: [i + 1], value })),
    source: 'M04 §4.1 (M05 S1 chart), XL-31',
  },
  'Q-SPM-POOL': {
    where: (subjectId?: number, levelId?: number, difficulty?: number): QW =>
      compact({
        ...ELIGIBLE,
        questionType: 'mcq',
        spmPool: true,
        educationLevelId: levelId ?? [10, 11],
        subjectId,
        difficultyLevel: difficulty,
      }),
    expected: [{ args: [], value: TOTALS.spmPool }, ...poolExpected],
    source: 'M04 BR-M04-32, M06 §6.10',
  },
  'Q-CONTRIB': {
    where: (userId: number, status?: Question['status'], subjectId?: number): QW =>
      compact({ ...OBJECTIVE, createdBy: userId, status, subjectId }),
    expected: [
      { args: [1], value: 16817 },
      { args: [1, 'approved'], value: 16817 },
      ...Object.entries(USER1_BY_SUBJECT).map(([s, value]) => ({
        args: [1, undefined, Number(s)],
        value,
      })),
      { args: [5], value: 1 },
    ],
    source: 'M04 §4.1 (M10 S1, S21)',
  },
  'Q-TEACHER-DATABANK': {
    where: (subjectId: number, questionType?: QuestionType, difficulty?: number): QW =>
      compact({
        ...ELIGIBLE,
        teacherDatabank: true,
        subjectId,
        questionType,
        difficultyLevel: difficulty,
      }),
    expected: [
      { args: [1], value: 6048 },
      { args: [1, 'mcq'], value: 5918 },
      { args: [1, 'essay'], value: 105 },
      { args: [1, 'mcq', 3], value: 950 },
      { args: [3], value: 0 },
    ],
    source: 'M04 §4.1 (M10 S28)',
  },
  'Q-SP-AVAILABLE': {
    where: (spId: number, levelId?: number): QW =>
      compact({ ...ELIGIBLE, dskpSpId: spId, educationLevelId: levelId }),
    expected: NAMED_SPS.map((s) => ({ args: [s.sp], value: s.count })),
    source: 'M04 §4.1 (M08 S6/S7)',
  },
  'Q-M17-COV': {
    where: (subjectId?: number, levelId?: number, difficulty?: number): QW =>
      compact({
        ...OBJECTIVE,
        isActive: true,
        coverageExcluded: false,
        educationLevelId: levelId ?? { isNull: false },
        subjectId,
        difficultyLevel: difficulty,
      }),
    expected: [
      { args: [], value: Q_M17_COV },
      { args: [3], value: 13_354 },
      ...Object.entries(S10_DIFFICULTY).flatMap(([s, byD]) => [
        { args: [Number(s)], value: byD.reduce((a, b) => a + b, 0) },
        ...byD.map((value, i) => ({ args: [Number(s), undefined, i + 1], value })),
      ]),
      ...[958, 2540, 805, 530, 407, 400, 2104, 1800, 1500, 257, 387].map((value, i) => ({
        args: [1, i + 1],
        value,
      })),
    ],
    source: 'M04 §4.1 (M17 S10 matrix and difficulty tiles), BR-M04-38',
  },
  'Q-FLAGGED-MCQ': {
    where: (subjectId?: number): QW => compact({ ...OBJECTIVE, needsDiagram: true, subjectId }),
    expected: [
      { args: [], value: TOTALS.flaggedMcq },
      ...Object.entries(NEEDS_DIAGRAM).map(([s, value]) => ({ args: [Number(s)], value })),
    ],
    source: 'M04 §4.1 (S11)',
  },
})

type SW = Where<StructuredQuestion>

export const structuredQueries = defineNamedQueries(structuredDataset, {
  'Q-STRUCT-ALL': {
    where: (subjectId?: number, kbatLevel?: number): SW => compact({ subjectId, kbatLevel }),
    expected: [
      { args: [], value: 4064 },
      ...Object.entries(STRUCTURED_BY_SUBJECT).map(([s, value]) => ({ args: [Number(s)], value })),
      { args: [undefined, 5], value: 483 },
      { args: [1, 6], value: 3 },
      { args: [3, 6], value: 0 },
    ],
    source: 'M04 §4.1 (S8)',
  },
  'Q-STRUCT-VISIBLE': {
    where: (subjectId?: number, kbatLevel?: number): SW =>
      compact({
        status: 'published',
        isActive: true,
        educationLevelId: [10, 11],
        subjectId,
        kbatLevel,
      }),
    expected: [
      { args: [], value: 4059 },
      { args: [2], value: 773 },
      { args: [1], value: 559 },
      { args: [3], value: 298 },
      { args: [11], value: 217 },
      { args: [4], value: 204 },
      { args: [23], value: 763 },
    ],
    source: 'M04 §4.1 (M05 S10, M06 S7–S9)',
  },
  'Q-TEACHER-CONTRIB-STR': {
    where: (schoolId?: number): SW => compact({ contribSchoolId: schoolId ?? { ne: null } }),
    expected: [
      { args: [], value: TEACHER_CONTRIB.reduce((a, t) => a + t.structured, 0) },
      ...TEACHER_CONTRIB.map((t) => ({ args: [t.schoolId], value: t.structured })),
    ],
    source: 'M04 §4.1 Q-TEACHER-CONTRIB, structured part (M17 S11)',
  },
  'Q-FLAGGED-STR': {
    where: (subjectId?: number): SW => compact({ needsDiagram: true, subjectId }),
    expected: [
      { args: [], value: 522 },
      { args: [9], value: 6 },
    ],
    source: 'M04 §4.1 (S11)',
  },
})

// ---------------------------------------------------------------------------------------------
// Q-TEACHER-CONTRIB: one figure over two stores (SRS §4.1, BR-M04-38 c; E2E-M04-69)
// ---------------------------------------------------------------------------------------------

const teacherWhere = (schoolId?: number) => ({ contribSchoolId: schoolId ?? { ne: null } })

/**
 * Q-TEACHER-CONTRIB(scope?) = objective + structured rows credited to the active teachers of the
 * scope (school id; omitted = every contributing school; 0 = the "other active teachers" sentinel).
 * 11,414 = 8087 2,432 · 8107 1,403 · 8880 13 · 8090 1 · rest 7,565. It spans the question and the
 * structured store, so only `count` is meaningful; `where` and the row methods throw `CONTRACT`.
 */
const teacherContribQuery: NamedQuery<Question, [schoolId?: number]> = {
  id: 'Q-TEACHER-CONTRIB',
  source: 'M04 §4.1 Q-TEACHER-CONTRIB (objective + structured; M17 S11)',
  expected: [
    { args: [], value: TEACHER_CONTRIB.reduce((a, t) => a + t.mcq + t.structured, 0) },
    ...TEACHER_CONTRIB.map((t) => ({ args: [t.schoolId], value: t.mcq + t.structured })),
  ],
  where: () => crossStore('where'),
  count: (schoolId) =>
    questionsDataset.count(compact({ ...OBJECTIVE, ...teacherWhere(schoolId) })) +
    structuredDataset.count(teacherWhere(schoolId)),
  groupCount: () => crossStore('groupCount'),
  query: () => crossStore('query'),
  sample: () => crossStore('sample'),
}

function crossStore(method: string): never {
  throw new RepositoryError(
    'CONTRACT',
    `questions: Q-TEACHER-CONTRIB spans the question and structured stores; only count() is defined (${method})`,
  )
}

export const questionQueries = { ...baseQuestionQueries, 'Q-TEACHER-CONTRIB': teacherContribQuery }
