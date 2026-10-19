/**
 * Materialised M10 stores (F-30; SRS M10 v1.15 §6.2–§6.9). The class and enrolment rows depend on
 * the users dataset (owners, members), which cannot be read in the seed phase, so the repositories
 * fill them in `finalise` (`classrooms.compile()`); after the baseline every change is a diff.
 *
 * - `m10.classrooms`: key `"{kind}:{classId}"`, so classroom 419 and school class 419 stay apart.
 * - `m10.enrolments`: key `"{kind}:{classroomId}:{studentId}"`.
 * - DSKP Bidang / SK / SP with their live ids (runtime ids ≥ 9,000,001).
 * - Missions, remedial tests and question sets: numeric ids in the M10 blocks 7101…, 7601…, 7401…;
 *   runtime ids from 9,000,001 (`floor`).
 */

import { defineTable, floor, ID_RANGES, opaque } from '@/mock/define'

import type {
  ClassroomRow,
  DskpBidangRow,
  DskpSkRow,
  DskpSpRow,
  EnrolmentRow,
  MissionRow,
  QuestionSetRow,
  RemedialTestRow,
} from '../repository/types'

/** Natural string keys: inserts always pass the id. */
const naturalKey = (stream: string) => opaque('k_', stream, 12)

const RUNTIME = ID_RANGES.questionsRuntimeFloor

export const classroomsTable = defineTable<ClassroomRow>({
  name: 'm10.classrooms',
  ids: naturalKey('m10:classroom-keys'),
  indexes: ['kind', 'teacherId', 'schoolId', 'educationLevel', 'joinCode'],
})

export const enrolmentsTable = defineTable<EnrolmentRow>({
  name: 'm10.enrolments',
  ids: naturalKey('m10:enrolment-keys'),
  indexes: ['studentId', 'classKey', 'educationLevel', 'status'],
})

export const dskpBidangTable = defineTable<DskpBidangRow>({
  name: 'm10.dskpBidang',
  ids: floor({ start: RUNTIME }),
  indexes: ['subjectId', 'educationLevelId'],
})

export const dskpSkTable = defineTable<DskpSkRow>({
  name: 'm10.dskpSk',
  ids: floor({ start: RUNTIME }),
  indexes: ['bidangId'],
})

export const dskpSpTable = defineTable<DskpSpRow>({
  name: 'm10.dskpSp',
  ids: floor({ start: RUNTIME }),
  indexes: ['skId'],
})

export const missionsTable = defineTable<MissionRow>({
  name: 'm10.missions',
  ids: floor({ start: RUNTIME }),
  indexes: ['teacherId', 'missionDate'],
})

export const remedialTestsTable = defineTable<RemedialTestRow>({
  name: 'm10.remedialTests',
  ids: floor({ start: RUNTIME }),
  indexes: ['teacherId', 'studentId'],
})

export const questionSetsTable = defineTable<QuestionSetRow>({
  name: 'm10.questionSets',
  ids: floor({ start: RUNTIME }),
  indexes: ['teacherId', 'classroomId'],
})

export const M10_TABLES = {
  classrooms: classroomsTable,
  enrolments: enrolmentsTable,
  dskpBidang: dskpBidangTable,
  dskpSk: dskpSkTable,
  dskpSp: dskpSpTable,
  missions: missionsTable,
  remedialTests: remedialTestsTable,
  questionSets: questionSetsTable,
}
