/**
 * The canonical accounts' practice records (SRS M05 v1.16 §6.12; M14 v1.5 §6.11.3 hand-over in
 * `src/modules/m14-gamification/mock/data/designed.ts`). Admin values are observed on live; the
 * student values are the fictitious M06 v1.2 / M05 seed. Every person is fictitious (CLAUDE.md §6).
 *
 * | Account | Session | Mode · subject | Questions · correct | Time |
 * |---|---|---|---|---|
 * | admin (1) | — 2026-02-19 | 35 BM answers without a session (anchors 600001–600035) | 35 · 20 | — |
 * | admin | A2 2026-05-11 14:22 | latih_tubi · SEJ | 40 · 14 | 02:11 |
 * | admin | A3 2026-05-11 14:27 | latih_tubi · BM | 34 · 11 | 01:45 |
 * | admin | A4 2026-05-19 03:26 | past_year · BM | 5 · 1 | 00:36 |
 * | admin | A5 2026-05-19 03:49 | past_year · BM (one wrong answer repeats an A4 wrong question) | 5 · 0 | 00:14 |
 * | pelajar (2) | P1 2026-09-22 19:00 | past_year · MATH | 10 · 4 | 05:00 |
 * | pelajar | P2 2026-09-24 20:15 | latih_tubi · BM | 34 · 26 | 06:00 |
 * | pelajar | P3 2026-09-24 20:40 | past_year · SEJ | 10 · 6 | 04:30 |
 * | pelajar | P4 2026-09-25 08:30 | ramalan · AKAUN Set 1 | 40 · 34 | 15:00 |
 * | pelajarmaju (4) | M1 2026-09-23 16:10 | chapter · MATH D1 Bab 1 (questions 1–10) | 10 · 8 | 04:20 |
 * | pelajarmaju | M2 2026-09-24 17:05 | chapter · MATH D1 Bab 1 (questions 11–20) | 10 · 9 | 03:50 |
 * | pelajarmaju | M3 2026-09-25 09:15 | random · MATH D1 (5 of Bab 2, 3 correct; 5 of Bab 3, 3 correct) | 10 · 6 | 05:10 |
 * | pelajarmaju | M4 2026-09-25 10:00 | revision · MATH (the 7 queued; correct: 2 of Bab 1, 1 of Bab 3) | 7 · 3 | 02:30 |
 *
 * Questions: the M05 practice anchors 600001–600065 (M04 §6.15 groups, contributed by this module)
 * and, for the SPM sessions, M04 SPM pool rows drawn once when the answer log compiles (M04 has
 * compiled by then; `../repository/anchors.ts`). **INFERRED:** which answers of a group are the
 * correct ones (the first of each group), the answer times inside a session (evenly spread up to
 * `completedAt`), the admin's 19/02 times (21:00–21:34), and the SPM draw.
 *
 * The designed sessions are **not** passed to `gamification.onSessionCompleted` (M14 replays them).
 */

import type { PracticeMode } from './types'

/** M03 subject ids. */
export const SUBJECT = { BM: 1, MATH: 3, SEJ: 5, AKAUN: 21 } as const

/** M04 §6.15 anchor groups (ids, subject, level, M03 chapter id). */
export const M05_QUESTION_ANCHORS: readonly {
  ids: readonly [number, number]
  subjectId: number
  levelId: number
  chapterId: number
}[] = [
  { ids: [600001, 600018], subjectId: 1, levelId: 1, chapterId: 35 },
  { ids: [600019, 600023], subjectId: 1, levelId: 1, chapterId: 36 },
  { ids: [600024, 600033], subjectId: 1, levelId: 1, chapterId: 2 },
  { ids: [600034, 600035], subjectId: 1, levelId: 2, chapterId: 4 },
  { ids: [600036, 600055], subjectId: 3, levelId: 1, chapterId: 1 },
  { ids: [600056, 600060], subjectId: 3, levelId: 1, chapterId: 143 },
  { ids: [600061, 600065], subjectId: 3, levelId: 1, chapterId: 136 },
]

const ids = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i)

/** One answer of a designed record: a fixed question, or the i-th draw of an SPM pool. */
export type DesignedQuestion = { questionId: number } | { pool: number; draw: number }

export interface DesignedAnswer {
  question: DesignedQuestion
  isCorrect: boolean
}

export interface DesignedSession {
  id: string
  userId: number
  mode: PracticeMode
  subjectId: number
  levelId: number | null
  chapterId: number | null
  year: number | null
  setNo: number | null
  completedAt: string
  /** Seconds (M14 hand-over). */
  timeSpent: number
  answers: DesignedAnswer[]
}

const fixed = (qids: readonly number[], correct: number): DesignedAnswer[] =>
  qids.map((questionId, i) => ({ question: { questionId }, isCorrect: i < correct }))

/** `n` draws `from…` of a pool, the first `correct` of them correct. */
const drawn = (pool: number, from: number, n: number, correct: number): DesignedAnswer[] =>
  Array.from({ length: n }, (_, i) => ({
    question: { pool, draw: from + i },
    isCorrect: i < correct,
  }))

/**
 * SPM pools (subject → draws). BM (admin): A3 0–33, A4 34–38, A5 39–42 + A4's second draw (wrong
 * in A4 and again in A5: 47 wrong BM answers → 46 queued questions, live S6).
 */
const BM_ADMIN = SUBJECT.BM
const A5: DesignedAnswer[] = [
  { question: { pool: BM_ADMIN, draw: 35 }, isCorrect: false },
  ...drawn(BM_ADMIN, 39, 4, 0),
]

/** pelajarmaju's queue after M3 and the M4 revision answers (§6.12 resulting anchors). */
const MJ_BAB1 = ids(600036, 600055)
const MJ_BAB2 = ids(600056, 600060)
const MJ_BAB3 = ids(600061, 600065)
// M1 answers Bab 1 q1–10, 8 correct (q9, q10 wrong); M2 q11–20, 9 correct (q20 wrong).
// M3: Bab 2 q1–3 correct, q4–5 wrong; Bab 3 q1–3 correct, q4–5 wrong.
// M4 (the 7 queued, `wrongTimes` desc then latest wrong first is the served order; stored here in
// that order): Bab 3 q4 ✓, Bab 3 q5 ✗, Bab 2 q4 ✗, Bab 2 q5 ✗, Bab 1 q20 ✗, Bab 1 q9 ✓, Bab 1 q10 ✓.
const M4: DesignedAnswer[] = [
  { question: { questionId: MJ_BAB3[3] as number }, isCorrect: true },
  { question: { questionId: MJ_BAB3[4] as number }, isCorrect: false },
  { question: { questionId: MJ_BAB2[3] as number }, isCorrect: false },
  { question: { questionId: MJ_BAB2[4] as number }, isCorrect: false },
  { question: { questionId: MJ_BAB1[19] as number }, isCorrect: false },
  { question: { questionId: MJ_BAB1[8] as number }, isCorrect: true },
  { question: { questionId: MJ_BAB1[9] as number }, isCorrect: true },
]

export const DESIGNED_SESSIONS: readonly DesignedSession[] = [
  {
    id: 'A2',
    userId: 1,
    mode: 'latih_tubi',
    subjectId: SUBJECT.SEJ,
    levelId: null,
    chapterId: null,
    year: null,
    setNo: null,
    completedAt: '2026-05-11T14:22:00+08:00',
    timeSpent: 131,
    answers: drawn(SUBJECT.SEJ, 0, 40, 14),
  },
  {
    id: 'A3',
    userId: 1,
    mode: 'latih_tubi',
    subjectId: SUBJECT.BM,
    levelId: null,
    chapterId: null,
    year: null,
    setNo: null,
    completedAt: '2026-05-11T14:27:00+08:00',
    timeSpent: 105,
    answers: drawn(BM_ADMIN, 0, 34, 11),
  },
  {
    id: 'A4',
    userId: 1,
    mode: 'past_year',
    subjectId: SUBJECT.BM,
    levelId: null,
    chapterId: null,
    year: null,
    setNo: null,
    completedAt: '2026-05-19T03:26:00+08:00',
    timeSpent: 36,
    answers: drawn(BM_ADMIN, 34, 5, 1),
  },
  {
    id: 'A5',
    userId: 1,
    mode: 'past_year',
    subjectId: SUBJECT.BM,
    levelId: null,
    chapterId: null,
    year: null,
    setNo: null,
    completedAt: '2026-05-19T03:49:00+08:00',
    timeSpent: 14,
    answers: A5,
  },
  {
    id: 'P1',
    userId: 2,
    mode: 'past_year',
    subjectId: SUBJECT.MATH,
    levelId: null,
    chapterId: null,
    year: null,
    setNo: null,
    completedAt: '2026-09-22T19:00:00+08:00',
    timeSpent: 300,
    answers: drawn(-SUBJECT.MATH, 0, 10, 4),
  },
  {
    id: 'P2',
    userId: 2,
    mode: 'latih_tubi',
    subjectId: SUBJECT.BM,
    levelId: null,
    chapterId: null,
    year: null,
    setNo: null,
    completedAt: '2026-09-24T20:15:00+08:00',
    timeSpent: 360,
    answers: drawn(-SUBJECT.BM, 0, 34, 26),
  },
  {
    id: 'P3',
    userId: 2,
    mode: 'past_year',
    subjectId: SUBJECT.SEJ,
    levelId: null,
    chapterId: null,
    year: null,
    setNo: null,
    completedAt: '2026-09-24T20:40:00+08:00',
    timeSpent: 270,
    answers: drawn(-SUBJECT.SEJ, 0, 10, 6),
  },
  {
    id: 'P4',
    userId: 2,
    mode: 'ramalan',
    subjectId: SUBJECT.AKAUN,
    levelId: null,
    chapterId: null,
    year: 2026,
    setNo: 1,
    completedAt: '2026-09-25T08:30:00+08:00',
    timeSpent: 900,
    answers: drawn(-SUBJECT.AKAUN, 0, 40, 34),
  },
  {
    id: 'M1',
    userId: 4,
    mode: 'chapter',
    subjectId: SUBJECT.MATH,
    levelId: 1,
    chapterId: 1,
    year: null,
    setNo: null,
    completedAt: '2026-09-23T16:10:00+08:00',
    timeSpent: 260,
    answers: fixed(MJ_BAB1.slice(0, 10), 8),
  },
  {
    id: 'M2',
    userId: 4,
    mode: 'chapter',
    subjectId: SUBJECT.MATH,
    levelId: 1,
    chapterId: 1,
    year: null,
    setNo: null,
    completedAt: '2026-09-24T17:05:00+08:00',
    timeSpent: 230,
    answers: fixed(MJ_BAB1.slice(10, 20), 9),
  },
  {
    id: 'M3',
    userId: 4,
    mode: 'random',
    subjectId: SUBJECT.MATH,
    levelId: 1,
    chapterId: null,
    year: null,
    setNo: null,
    completedAt: '2026-09-25T09:15:00+08:00',
    timeSpent: 310,
    answers: [...fixed(MJ_BAB2, 3), ...fixed(MJ_BAB3, 3)],
  },
  {
    id: 'M4',
    userId: 4,
    mode: 'revision',
    subjectId: SUBJECT.MATH,
    levelId: null,
    chapterId: null,
    year: null,
    setNo: null,
    completedAt: '2026-09-25T10:00:00+08:00',
    timeSpent: 150,
    answers: M4,
  },
]

/**
 * The admin's 35 answers of 2026-02-19 without a session (live): BM D1 Bab 1 × 18 (8 correct),
 * Bab 2 × 5 (3), Bab 3 × 10 (8), BM D2 × 2 (1). Times 21:00 + 1 minute each (INFERRED).
 */
export const ADMIN_SESSIONLESS = {
  userId: 1,
  from: '2026-02-19T21:00:00+08:00',
  answers: [
    ...fixed(ids(600001, 600018), 8),
    ...fixed(ids(600019, 600023), 3),
    ...fixed(ids(600024, 600033), 8),
    ...fixed(ids(600034, 600035), 1),
  ],
} as const

/** Ids of the canonical answer anchors (the M05 block of the anchor range, `./ids.ts`). */
export const CANONICAL_ANSWER_ID_START = 500_001

/**
 * DATA-M05-11 SubjectMastery seed (§6.12, stored counters; admin values live). `lastAnsweredAt` of
 * the students = their latest designed answer of that subject (INFERRED).
 */
export const DESIGNED_MASTERY: readonly (readonly [number, number, number, number, string])[] = [
  [1, SUBJECT.BM, 46, 94, '2026-05-19T03:49:00+08:00'],
  [1, SUBJECT.SEJ, 14, 40, '2026-05-11T14:22:00+08:00'],
  [2, SUBJECT.BM, 26, 34, '2026-09-24T20:15:00+08:00'],
  [2, SUBJECT.MATH, 4, 10, '2026-09-22T19:00:00+08:00'],
  [2, SUBJECT.SEJ, 6, 10, '2026-09-24T20:40:00+08:00'],
  [2, SUBJECT.AKAUN, 34, 40, '2026-09-25T08:30:00+08:00'],
  [4, SUBJECT.MATH, 26, 37, '2026-09-25T10:00:00+08:00'],
]

/** DATA-M05-04 SPM targets of `pelajar@demo.test` (§6.12). */
export const DESIGNED_SPM_TARGETS: readonly (readonly [number, number, string])[] = [
  [2, SUBJECT.BM, 'A'],
  [2, SUBJECT.MATH, 'B+'],
  [2, SUBJECT.SEJ, 'A-'],
]
