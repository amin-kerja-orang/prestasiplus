/**
 * Seed reports (SRS v1.10 §6.11 "Reports"): live ids kept where known (10, 9, 6, 4, 3), ids 8, 7,
 * 5, 2, 1 INFERRED from the live newest-first order, 11 = the added dismissed report.
 *
 * Reporters "Pelajar Demo 01"–"08" are fictitious; they are mapped to the M02 fixture students
 * 5001–5008 (PROPOSED mapping, the SRS names no user ids). "Pelajar Demo 01" owns 10, 6 and 2 (S13);
 * "Pelajar Demo 05" owns none (E2E-M04-44 empty state).
 *
 * Dates: 10 is "2 minggu yang lepas" and 9 "3 bulan yang lepas" at the mock anchor 2026-09-25 15:40
 * (observed relative times); the others are PROPOSED, older in id order. The redacted live source
 * set of report 6 is replaced by a fictitious token (privacy).
 */

import type { QuestionReport } from '../repository/types'

/** "Pelajar Demo 0n" → user id (PROPOSED). */
export const PELAJAR_DEMO = (n: number): number => 5000 + n

const NOTES_DEACTIVATED = 'Dinyahaktifkan segera oleh admin'

function report(
  r: Omit<QuestionReport, 'updatedAt' | 'sourceSet' | 'quizSessionId' | 'roomCode'> &
    Partial<QuestionReport>,
): QuestionReport {
  return {
    sourceSet: null,
    quizSessionId: null,
    roomCode: null,
    updatedAt: r.createdAt,
    ...r,
  }
}

export const SEED_REPORTS: readonly QuestionReport[] = [
  report({
    id: 1,
    questionType: 'mcq',
    questionId: 108527,
    reporterId: PELAJAR_DEMO(2),
    reasons: ['wrong_answer'],
    comment: null,
    source: 'spm',
    status: 'fixed',
    adminNotes: null,
    createdAt: '2026-04-01T10:15:00+08:00',
  }),
  report({
    id: 2,
    questionType: 'mcq',
    questionId: 124733,
    reporterId: PELAJAR_DEMO(1),
    reasons: ['other'],
    comment: 'SILUBUS LAMA',
    source: 'spm',
    status: 'fixed',
    adminNotes:
      'Soalan telah dikeluarkan daripada live bank kerana sumber prediction legacy / silibus tidak relevan. Ditutup selepas semakan admin.',
    createdAt: '2026-04-20T20:30:00+08:00',
  }),
  report({
    id: 3,
    questionType: 'structured',
    questionId: 2509,
    reporterId: PELAJAR_DEMO(4),
    reasons: ['wrong_answer'],
    comment: 'Bende ni AI',
    source: 'structured_attempt',
    status: 'reviewed',
    adminNotes: NOTES_DEACTIVATED,
    createdAt: '2026-05-10T21:05:00+08:00',
  }),
  report({
    id: 4,
    questionType: 'structured',
    questionId: 3703,
    reporterId: PELAJAR_DEMO(3),
    reasons: ['wrong_options'],
    comment: 'The marks given for this part do not match the answer scheme.',
    source: 'structured_attempt',
    status: 'reviewed',
    adminNotes: NOTES_DEACTIVATED,
    createdAt: '2026-05-15T19:40:00+08:00',
  }),
  report({
    id: 5,
    questionType: 'structured',
    questionId: 3699,
    reporterId: PELAJAR_DEMO(8),
    reasons: ['confusing_question'],
    comment: null,
    source: 'structured_attempt',
    status: 'fixed',
    adminNotes: null,
    createdAt: '2026-05-20T16:20:00+08:00',
  }),
  report({
    id: 6,
    questionType: 'mcq',
    questionId: 136891,
    reporterId: PELAJAR_DEMO(1),
    reasons: ['unclear'],
    comment: null,
    source: 'spm',
    roomCode: 'Y31OBA',
    sourceSet: 'tracking_a_demo_math_20260326',
    status: 'reviewed',
    adminNotes: NOTES_DEACTIVATED,
    createdAt: '2026-05-28T11:00:00+08:00',
  }),
  report({
    id: 7,
    questionType: 'structured',
    questionId: 3699,
    reporterId: PELAJAR_DEMO(7),
    reasons: ['confusing_question'],
    comment: 'tidak dapat melihat petikan tersebut.',
    source: 'structured_attempt',
    status: 'fixed',
    adminNotes: null,
    createdAt: '2026-06-05T09:45:00+08:00',
  }),
  report({
    id: 8,
    questionType: 'structured',
    questionId: 3699,
    reporterId: PELAJAR_DEMO(6),
    reasons: ['other'],
    comment: 'Tiada soalan???',
    source: 'structured_attempt',
    status: 'fixed',
    adminNotes: null,
    createdAt: '2026-06-10T14:10:00+08:00',
  }),
  report({
    id: 9,
    questionType: 'structured',
    questionId: 3700,
    reporterId: PELAJAR_DEMO(2),
    reasons: ['other'],
    comment: null,
    source: 'structured_attempt',
    status: 'pending',
    adminNotes: null,
    createdAt: '2026-06-25T15:40:00+08:00',
  }),
  report({
    id: 10,
    questionType: 'structured',
    questionId: 3698,
    reporterId: PELAJAR_DEMO(1),
    reasons: ['other'],
    comment: 'Lambat',
    source: 'structured_attempt',
    sourceSet: 'trial',
    status: 'pending',
    adminNotes: null,
    createdAt: '2026-09-11T15:40:00+08:00',
  }),
  report({
    id: 11,
    questionType: 'mcq',
    questionId: 564160,
    reporterId: PELAJAR_DEMO(3),
    reasons: ['typo'],
    comment: null,
    source: 'spm',
    status: 'dismissed',
    adminNotes: 'Soalan dan jawapan disemak — tiada masalah',
    createdAt: '2026-09-20T12:00:00+08:00',
  }),
]
