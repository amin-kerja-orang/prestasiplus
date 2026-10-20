/** Row to wire mappers: decimal-string ids (UD-1) and `+08:00` timestamps. */
import type {
  CurriculumChapter,
  CurriculumEducationLevel,
  CurriculumNode,
  CurriculumSubject,
  CurriculumSubtopic,
  CurriculumTopic,
} from '@pp/contract'

import { toMytTimestamp } from '../../common/time/myt'
import { idToString } from '../../db/ids'
import type {
  Chapter,
  CurriculumNode as NodeRow,
  EducationLevel,
  Subtopic,
  SubjectWithLevels,
  Topic,
} from './curriculum.repository'

export const levelView = (r: EducationLevel): CurriculumEducationLevel => ({
  id: idToString(r.id),
  code: r.code,
  name: r.name,
  nameEn: r.nameEn,
  stage: r.stage as CurriculumEducationLevel['stage'],
  curriculum: r.curriculum,
  order: r.sortOrder,
  isActive: r.isActive,
  grade: r.grade,
  createdAt: toMytTimestamp(r.createdAt),
  updatedAt: toMytTimestamp(r.updatedAt),
})

export const subjectView = (r: SubjectWithLevels): CurriculumSubject => ({
  id: idToString(r.id),
  code: r.code,
  name: r.name,
  nameEn: r.nameEn,
  icon: r.icon,
  color: r.color,
  isCore: r.isCore,
  order: r.sortOrder,
  isActive: r.isActive,
  educationLevelIds: r.educationLevelIds.map(idToString),
  createdAt: toMytTimestamp(r.createdAt),
  updatedAt: toMytTimestamp(r.updatedAt),
})

/** Only in-tree chapters reach this mapper, so level and name are present (check constraint). */
export const chapterView = (r: Chapter): CurriculumChapter => ({
  id: idToString(r.id),
  subjectId: idToString(r.subjectId),
  educationLevelId: idToString(r.educationLevelId as bigint),
  name: r.name as string,
  nameEn: r.nameEn,
  chapterNumber: r.chapterNumber,
  description: r.description,
  strand: r.strand,
  dskpCode: r.dskpCode,
  inTree: r.inTree,
  isActive: r.isActive,
  createdAt: toMytTimestamp(r.createdAt),
  updatedAt: toMytTimestamp(r.updatedAt),
})

export const topicView = (r: Topic): CurriculumTopic => ({
  id: idToString(r.id),
  chapterId: idToString(r.chapterId),
  name: r.name,
  nameEn: r.nameEn,
  topicNumber: r.topicNumber,
  description: r.description,
  learningStandard: r.learningStandard,
  isActive: r.isActive,
  createdAt: toMytTimestamp(r.createdAt),
  updatedAt: toMytTimestamp(r.updatedAt),
})

export const subtopicView = (r: Subtopic): CurriculumSubtopic => ({
  id: idToString(r.id),
  topicId: idToString(r.topicId),
  name: r.name,
  nameEn: r.nameEn,
  learningObjective: r.learningObjective,
  createdAt: toMytTimestamp(r.createdAt),
  updatedAt: toMytTimestamp(r.updatedAt),
})

export const nodeView = (r: NodeRow): CurriculumNode => ({
  id: idToString(r.id),
  subjectId: idToString(r.subjectId),
  educationLevelId: idToString(r.educationLevelId),
  kind: r.kind as CurriculumNode['kind'],
  code: r.code,
  title: r.title,
  titlePrinted: r.titlePrinted,
  parentId: r.parentId === null ? null : idToString(r.parentId),
  order: r.sortOrder,
  edition: r.edition,
  isElective: r.isElective,
})
