/**
 * Designed M10 records that the student side reads (SRS M10 v1.15 §6.11 "Designed data"): missions,
 * remedial tests and question sets. Nothing here is dated today (2026-09-25), so a student's
 * `/misi-harian` and `/remedial/saya` empty states hold (M05). Recipients of 7103 / 7104 are the
 * members of class 813 and the question ids of the remedial tests are resolved at compile time.
 */

import type { MissionRow, QuestionSetRow, RemedialTestRow } from '../repository/types'

/** Missions of teacher 5 (recipients = 3001–3008 = the members of 2001 / 2002). */
export const DESIGNED_MISSIONS_GURU: readonly MissionRow[] = [
  {
    id: 7101,
    teacherId: 5,
    title: 'Misi Harian 22/09/2026',
    missionType: 'latih_tubi',
    missionSource: 'bank_soalan',
    missionDate: '2026-09-22',
    subjectId: 10,
    chapterId: null,
    questionCount: 10,
    coinsPerCorrect: 3,
    resourceTitle: null,
    resourceUrl: null,
    resourceNote: null,
    recipientIds: [],
    createdAt: '2026-09-22T07:00:00+08:00',
  },
  {
    id: 7102,
    teacherId: 5,
    title: 'Misi Harian 24/09/2026',
    missionType: 'tracking_a',
    missionSource: 'bank_soalan',
    missionDate: '2026-09-24',
    subjectId: 1,
    chapterId: null,
    questionCount: 10,
    coinsPerCorrect: 3,
    resourceTitle: null,
    resourceUrl: null,
    resourceNote: null,
    recipientIds: [],
    createdAt: '2026-09-24T07:00:00+08:00',
  },
]

/** M17 XR-M17-12 (designed): teacher 4402's missions, recipients = the 44 members of class 813. */
export const DESIGNED_MISSIONS_4402: readonly MissionRow[] = [
  {
    id: 7103,
    teacherId: 4402,
    title: 'Misi Harian 08/09/2026',
    missionType: 'latih_tubi',
    missionSource: 'bank_soalan',
    missionDate: '2026-09-08',
    subjectId: 3,
    chapterId: null,
    questionCount: 10,
    coinsPerCorrect: 3,
    resourceTitle: null,
    resourceUrl: null,
    resourceNote: null,
    recipientIds: [],
    createdAt: '2026-09-08T07:00:00+08:00',
  },
  {
    id: 7104,
    teacherId: 4402,
    title: 'Misi Harian 22/09/2026',
    missionType: 'latih_tubi',
    missionSource: 'bank_soalan',
    missionDate: '2026-09-22',
    subjectId: 3,
    chapterId: null,
    questionCount: 10,
    coinsPerCorrect: 3,
    resourceTitle: null,
    resourceUrl: null,
    resourceNote: null,
    recipientIds: [],
    createdAt: '2026-09-22T07:00:00+08:00',
  },
]

/** 7601 (Murid Demo 08, active) and 7602 (Murid Demo 07, completed 33 → 60); question ids at compile. */
export const DESIGNED_REMEDIAL: readonly RemedialTestRow[] = [
  {
    id: 7601,
    teacherId: 5,
    studentId: 3008,
    subjectId: 10,
    subjectCode: 'CHEM',
    subjectName: 'Kimia',
    questionIds: [],
    totalQuestions: 5,
    status: 'active',
    beforeAccuracy: 12.5,
    afterAccuracy: null,
    createdAt: '2026-09-23T10:00:00+08:00',
    completedAt: null,
  },
  {
    id: 7602,
    teacherId: 5,
    studentId: 3007,
    subjectId: 10,
    subjectCode: 'CHEM',
    subjectName: 'Kimia',
    questionIds: [],
    totalQuestions: 5,
    status: 'completed',
    beforeAccuracy: 33,
    afterAccuracy: 60,
    createdAt: '2026-09-18T10:00:00+08:00',
    completedAt: '2026-09-19T20:00:00+08:00',
  },
]

/** M08 Kimia T5 anchors (M04 §6.13.2 700001–700008), preferred for the remedial tests. */
export const KIMIA_ANCHORS: readonly number[] = [700001, 700002, 700003, 700004, 700005]

/** M08 Sejarah anchors 700201–700210 (M04 §6.13.2), the questions of set 7402. */
export const SEJARAH_ANCHORS: readonly number[] = [
  700201, 700202, 700203, 700204, 700205, 700206, 700207, 700208, 700209, 700210,
]

/** Question sets created 2026-08-28 (designed; M17 XR-M17-12 needs none created in September). */
export const DESIGNED_QUESTION_SETS: readonly QuestionSetRow[] = [
  {
    id: 7401,
    teacherId: 5,
    classroomKind: 'classroom',
    classroomId: 2001,
    subjectId: 10,
    title: 'Latih Tubi Kimia Sep 2026 - Set 1',
    description: null,
    groupTag: 'Kimia Sep 2026',
    timeLimitMinutes: 30,
    maxAttempts: 0,
    status: 'draft',
    scheduledAt: null,
    questionIds: [],
    createdAt: '2026-08-28T09:00:00+08:00',
  },
  {
    id: 7402,
    teacherId: 5,
    classroomKind: 'classroom',
    classroomId: 2002,
    subjectId: 5,
    title: 'Sejarah Bab 1 - Set 1',
    description: null,
    groupTag: null,
    timeLimitMinutes: null,
    maxAttempts: 1,
    status: 'published',
    scheduledAt: null,
    questionIds: [...SEJARAH_ANCHORS],
    createdAt: '2026-08-28T09:05:00+08:00',
  },
]
