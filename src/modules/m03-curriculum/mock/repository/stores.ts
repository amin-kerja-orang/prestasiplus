/**
 * The eight M03 curriculum stores (SRS v1.8 §6.10): all small, seeded, materialised tables (not
 * virtual datasets; the live site shows every row). Private to M03: other modules use the
 * `curriculum*` repositories (D12), which guard every write.
 *
 * Id strategies (overview §6.5): `maxPlusOne()` — seeded rows keep their fixed ids (live ids and
 * fixture seed ids), a runtime create gets the highest id + 1 (chapters: 1342 — above the out-of-tree ids 1282–1341, topics: 2424,
 * subtopics: 235; subjects: 32; levels: 12). The pivot has a composite string id and never
 * allocates one.
 */

import { defineTable, maxPlusOne, opaque } from '@/mock/define'

import type {
  ChapterRow,
  EducationLevelRow,
  LegacySubtopicRow,
  LegacyTopicRow,
  SubjectLevelRow,
  SubjectRow,
  SubtopicRow,
  TopicRow,
} from './types'

export const levelsTable = defineTable<EducationLevelRow>({
  name: 'curriculum.levels',
  ids: maxPlusOne(),
})

export const subjectsTable = defineTable<SubjectRow>({
  name: 'curriculum.subjects',
  ids: maxPlusOne(),
  indexes: ['code'],
})

export const subjectLevelsTable = defineTable<SubjectLevelRow>({
  name: 'curriculum.subjectLevels',
  // Ids are always given ("{subjectId}:{educationLevelId}"); the strategy is never drawn.
  ids: opaque('sl-', 'm03:subject-levels'),
  indexes: ['subjectId', 'educationLevelId'],
})

export const chaptersTable = defineTable<ChapterRow>({
  name: 'curriculum.chapters',
  ids: maxPlusOne(),
  indexes: ['subjectId', 'educationLevelId'],
})

export const topicsTable = defineTable<TopicRow>({
  name: 'curriculum.topics',
  ids: maxPlusOne(),
  indexes: ['chapterId'],
})

export const subtopicsTable = defineTable<SubtopicRow>({
  name: 'curriculum.subtopics',
  ids: maxPlusOne(),
  indexes: ['topicId'],
})

export const legacyTopicsTable = defineTable<LegacyTopicRow>({
  name: 'curriculum.legacyTopics',
  ids: maxPlusOne(),
  indexes: ['gradeLevel', 'subject'],
})

export const legacySubtopicsTable = defineTable<LegacySubtopicRow>({
  name: 'curriculum.legacySubtopics',
  ids: maxPlusOne(),
  indexes: ['legacyTopicId'],
})

/** Every M03 store, keyed as the plugin registers them. */
export const curriculumTables = {
  levels: levelsTable,
  subjects: subjectsTable,
  subjectLevels: subjectLevelsTable,
  chapters: chaptersTable,
  topics: topicsTable,
  subtopics: subtopicsTable,
  legacyTopics: legacyTopicsTable,
  legacySubtopics: legacySubtopicsTable,
} as const
