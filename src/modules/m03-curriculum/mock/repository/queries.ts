/**
 * M03 named count queries (SRS v1.9 §6.11; D11, overview §6.6/§6.7): every M03 figure a screen shows is one of
 * these, on the owner's tables. `expected` holds the values documented in SRS v1.8 §6.10 (the
 * default seed, without the test-only override); `checkNamedQueries` verifies them in the tests.
 *
 * | Query | Figure |
 * |---|---|
 * | LVL-ALL / LVL-ACTIVE / LVL-STAGE(stage) | S9 "Jumlah: n tahap"; M01 `levelCount`; stage split |
 * | SUBJ-ALL / SUBJ-ACTIVE / SUBJ-CORE | S6 "Jumlah: n subjek"; M01 `subjectCount`; Teras |
 * | LINK-ALL / LINK-LEVEL(level) / LINK-SUBJECT(subject) / LINK-LEVELS(levels) | S9 "Subjek"; M06 "Subjek SPM" (distinct `subjectId` of LINK-LEVELS([10, 11])) |
 * | CH-ALL / CH-LEVEL(level) / CH-SUBJECT(subject) / CH-PAIR(subject, level) | tree chapters only (`inTree`, BR-06): S1 "Jumlah Bab"; §6.10 per-level/per-subject counts |
 * | CH-ALL-INCL-ORPHAN / CH-SUBJECT-INCL-ORPHAN(subject) | tree + the 60 out-of-tree chapters: M17 S10 "Status Kurikulum" (1,311, per-subject tiles) |
 * | TP-ALL / TP-CHAPTER(chapter) / TP-CHAPTERS(chapters) | S1 "Topik"; §6.10 totals |
 * | ST-ALL / ST-TOPIC(topic) / ST-TOPICS(topics) | S1 "Subtopik"; §6.10 totals |
 * | LT-ALL / LT-GRADE(grade) / LT-SUBJECT(subject) / LT-FILTER(grade, subject) | S12 list size (BR-13, case-insensitive), §6.10 per grade/subject |
 * | LS-ALL / LS-TOPIC(topic) | S12/S13 "{n} Subtopik"; §6.10 total 335 |
 */

import { defineNamedQueries } from '@/mock/dataset'
import type { Where } from '@/mock/define'

import {
  chaptersTable,
  legacySubtopicsTable,
  legacyTopicsTable,
  levelsTable,
  subjectLevelsTable,
  subjectsTable,
  subtopicsTable,
  topicsTable,
} from './stores'
import type { LegacyTopicRow, Stage } from './types'

const SRS = 'M03 SRS v1.10 §6.10–6.11'

export const levelQueries = defineNamedQueries(levelsTable, {
  'LVL-ALL': { expected: 11, source: SRS },
  'LVL-ACTIVE': { where: { isActive: true }, expected: 11, source: SRS },
  'LVL-STAGE': {
    where: (stage: Stage) => ({ stage }),
    expected: [
      { args: ['primary'], value: 6 },
      { args: ['lower_secondary'], value: 3 },
      { args: ['upper_secondary'], value: 2 },
    ],
    source: SRS,
  },
})

export const subjectQueries = defineNamedQueries(subjectsTable, {
  'SUBJ-ALL': { expected: 31, source: SRS },
  'SUBJ-ACTIVE': { where: { isActive: true }, expected: 31, source: SRS },
  'SUBJ-CORE': { where: { isCore: true }, expected: 7, source: SRS },
})

/** Per-level "Subjek" (SRS §6.10): 16/16/16/17/17/17/15/15/15/25/25. */
const LINKS_PER_LEVEL = [16, 16, 16, 17, 17, 17, 15, 15, 15, 25, 25]

export const subjectLevelQueries = defineNamedQueries(subjectLevelsTable, {
  'LINK-ALL': { expected: 194, source: SRS },
  'LINK-LEVEL': {
    where: (educationLevelId: number) => ({ educationLevelId }),
    expected: LINKS_PER_LEVEL.map((value, i) => ({ args: [i + 1], value })),
    source: SRS,
  },
  'LINK-SUBJECT': {
    where: (subjectId: number) => ({ subjectId }),
    // 4 subjects with no level (28–31); Matematik 11 (SRS v1.9 §6.11).
    expected: [
      ...[28, 29, 30, 31].map((id) => ({ args: [id], value: 0 })),
      { args: [3], value: 11 },
    ],
    source: SRS,
  },
  'LINK-LEVELS': {
    where: (educationLevelIds: readonly number[]) => ({ educationLevelId: [...educationLevelIds] }),
  },
})

/** Chapters per level (SRS §6.10 `byLevel`): D1 … T5. */
const CHAPTERS_PER_LEVEL = [41, 41, 33, 34, 35, 36, 183, 329, 296, 117, 106]

export const chapterQueries = defineNamedQueries(chaptersTable, {
  'CH-ALL': { where: { inTree: true }, expected: 1251, source: SRS },
  'CH-ALL-INCL-ORPHAN': { expected: 1311, source: SRS },
  'CH-LEVEL': {
    where: (educationLevelId: number) => ({ educationLevelId, inTree: true }),
    expected: CHAPTERS_PER_LEVEL.map((value, i) => ({ args: [i + 1], value })),
    source: SRS,
  },
  'CH-SUBJECT': {
    where: (subjectId: number) => ({ subjectId, inTree: true }),
    // The per-subject values the SRS cites (BM 84, MATH 94, SCI 109).
    expected: [
      { args: [1], value: 84 },
      { args: [3], value: 94 },
      { args: [4], value: 109 },
    ],
    source: SRS,
  },
  'CH-SUBJECT-INCL-ORPHAN': {
    where: (subjectId: number) => ({ subjectId }),
    // M17 S10 per-subject tiles: Pendidikan Muzik 56, PSI 9, Sains Rumah Tangga 1, Matematik 94.
    expected: [
      { args: [14], value: 56 },
      { args: [27], value: 9 },
      { args: [28], value: 1 },
      { args: [3], value: 94 },
    ],
    source: SRS,
  },
  'CH-PAIR': {
    where: (subjectId: number, educationLevelId: number) => ({
      subjectId,
      educationLevelId,
      inTree: true,
    }),
    // E2E-M03-02 (Matematik T4: 10), E2E-M03-07 (BI T3, Matematik Tambahan D1: 0).
    expected: [
      { args: [3, 10], value: 10 },
      { args: [2, 9], value: 0 },
      { args: [8, 1], value: 0 },
    ],
    source: 'M03 SRS v1.8 §12',
  },
})

export const topicQueries = defineNamedQueries(topicsTable, {
  'TP-ALL': { expected: 2423, source: SRS },
  'TP-CHAPTER': { where: (chapterId: number) => ({ chapterId }) },
  'TP-CHAPTERS': {
    where: (chapterIds: readonly number[]) => ({ chapterId: [...chapterIds] }),
  },
})

export const subtopicQueries = defineNamedQueries(subtopicsTable, {
  'ST-ALL': { expected: 234, source: SRS },
  'ST-TOPIC': { where: (topicId: number) => ({ topicId }) },
  'ST-TOPICS': { where: (topicIds: readonly number[]) => ({ topicId: [...topicIds] }) },
})

/**
 * BR-13 filter: `gradeLevel` and `subject` match case-insensitively (`darjah_1` = `DARJAH_1`);
 * `null`/`undefined`/`''` = no filter; an unknown code matches nothing.
 */
export function legacyTopicWhere(
  gradeLevel?: string | null,
  subject?: string | null,
): Where<LegacyTopicRow> {
  const where: Where<LegacyTopicRow> = {}
  if (gradeLevel) where.gradeLevel = gradeLevel.toUpperCase() as LegacyTopicRow['gradeLevel']
  if (subject) where.subject = subject.toUpperCase() as LegacyTopicRow['subject']
  return where
}

export const legacyTopicQueries = defineNamedQueries(legacyTopicsTable, {
  'LT-ALL': { expected: 125, source: SRS },
  'LT-GRADE': {
    where: (gradeLevel: string) => legacyTopicWhere(gradeLevel, null),
    expected: [
      { args: ['DARJAH_1'], value: 17 },
      { args: ['DARJAH_2'], value: 11 },
      { args: ['DARJAH_3'], value: 9 },
      { args: ['DARJAH_4'], value: 9 },
      { args: ['DARJAH_5'], value: 8 },
      { args: ['DARJAH_6'], value: 8 },
      { args: ['TINGKATAN_1'], value: 34 },
      { args: ['TINGKATAN_2'], value: 0 },
      { args: ['TINGKATAN_3'], value: 0 },
      { args: ['TINGKATAN_4'], value: 19 },
      { args: ['TINGKATAN_5'], value: 10 },
      { args: ['darjah_1'], value: 17 },
    ],
    source: SRS,
  },
  'LT-SUBJECT': {
    where: (subject: string) => legacyTopicWhere(null, subject),
    expected: [
      { args: ['MATEMATIK'], value: 34 },
      { args: ['SAINS'], value: 35 },
      { args: ['BAHASA_MELAYU'], value: 15 },
      { args: ['PENDIDIKAN_MORAL'], value: 12 },
      { args: ['SEJARAH'], value: 11 },
      { args: ['PENDIDIKAN_ISLAM'], value: 7 },
      { args: ['BAHASA_INGGERIS'], value: 6 },
      { args: ['GEOGRAFI'], value: 5 },
      { args: ['ZZZ'], value: 0 },
    ],
    source: SRS,
  },
  'LT-FILTER': {
    where: (gradeLevel: string | null, subject: string | null) =>
      legacyTopicWhere(gradeLevel, subject),
    // E2E-M03-36: DARJAH_1 + SAINS → 4 topics.
    expected: [
      { args: ['DARJAH_1', 'SAINS'], value: 4 },
      { args: [null, null], value: 125 },
    ],
    source: 'M03 SRS v1.8 §12',
  },
})

export const legacySubtopicQueries = defineNamedQueries(legacySubtopicsTable, {
  'LS-ALL': { expected: 335, source: SRS },
  'LS-TOPIC': {
    where: (legacyTopicId: number) => ({ legacyTopicId }),
    expected: [
      { args: [7], value: 4 },
      { args: [103], value: 6 },
    ],
    source: SRS,
  },
})
