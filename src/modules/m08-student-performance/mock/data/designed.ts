/**
 * M08 designed data (SRS M08 v1.11 §6.10 "Designed data"; all people fictitious): the 51 fixture
 * questions (M04 §6.13.2 block 700001–700299), the 14 designed sessions H01–H14 of the pupils
 * 3001–3008 with their answers, and the classes / SP ids they refer to. Values are literal; the
 * resulting anchors (Kimia accuracies, class 2001 S5 / S11 figures) are asserted by the tests.
 *
 * INFERRED (unspecified by the SRS): the completion time of day (16:00 MYT), the answer times inside a
 * session (evenly spread), the fixture question texts and options, the correct option of each fixture
 * question (id mod 4) and the answer order of the Sejarah session (the first k answers are correct).
 */

import { toIsoMyt } from '@/lib/time'

export const KIMIA = { subjectId: 10, levelId: 11 } as const
export const SEJARAH = { subjectId: 5, levelId: 10 } as const

/** Class ids of the designed data (teacher 5, SMK DEMO). */
export const CLASS_KIMIA = 2001
export const CLASS_SEJARAH = 2002
export const DESIGNED_PUPILS: readonly number[] = [3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008]

/** Kimia T5 fixture questions: Q1–Q8 (SP 9001–9004, two each) and the 28 unanswered of SP 9001. */
export const KIMIA_Q: readonly number[] = [
  700001, 700002, 700003, 700004, 700005, 700006, 700007, 700008,
]
export const KIMIA_UNANSWERED: readonly number[] = Array.from({ length: 28 }, (_, i) => 700101 + i)
export const SEJARAH_Q: readonly number[] = Array.from({ length: 15 }, (_, i) => 700201 + i)

/** SP of each Kimia fixture question (Q1–Q2 → 9001, Q3–Q4 → 9002, Q5–Q6 → 9003, Q7–Q8 → 9004). */
export const KIMIA_SP: readonly number[] = [9001, 9001, 9002, 9002, 9003, 9003, 9004, 9004]

export interface FixtureQuestion {
  id: number
  subjectId: number
  levelId: number
  dskpSpId: number | null
  spmPool: boolean
  difficultyLevel?: number
  text: string
  options: string[]
  correct: number
}

const SP_TITLE: Readonly<Record<number, string>> = {
  9001: 'sel elektrolisis',
  9002: 'polimer',
  9003: 'siri homolog',
  9004: 'getah asli',
}

function fixtureQuestion(
  id: number,
  base: Omit<FixtureQuestion, 'id' | 'text' | 'options' | 'correct'>,
  label: string,
  n: number,
): FixtureQuestion {
  const correct = id % 4
  return {
    id,
    ...base,
    text: `${label} no. ${String(n)}: pilih jawapan yang betul.`,
    options: ['A', 'B', 'C', 'D'].map((l) => `Pilihan ${l} bagi soalan ${String(id)}`),
    correct,
  }
}

/** The 51 fixture questions (§6.13.2), each an anchor of its own cell. */
export function fixtureQuestions(): FixtureQuestion[] {
  const out: FixtureQuestion[] = []
  KIMIA_Q.forEach((id, i) => {
    const sp = KIMIA_SP[i] as number
    out.push(
      fixtureQuestion(
        id,
        { ...KIMIA, dskpSpId: sp, spmPool: false },
        `Kimia Tingkatan 5 (${SP_TITLE[sp] as string})`,
        i + 1,
      ),
    )
  })
  KIMIA_UNANSWERED.forEach((id, i) => {
    out.push(
      fixtureQuestion(
        id,
        { ...KIMIA, dskpSpId: 9001, spmPool: false },
        'Kimia Tingkatan 5 (sel elektrolisis)',
        i + 9,
      ),
    )
  })
  SEJARAH_Q.forEach((id, i) => {
    out.push(
      fixtureQuestion(
        id,
        { ...SEJARAH, dskpSpId: null, spmPool: true, difficultyLevel: 2 },
        'Sejarah Tingkatan 4',
        i + 1,
      ),
    )
  })
  return out
}

interface KimiaSession {
  date: string
  seconds: number
  /** [Kimia question number 1–8, correct]. */
  answers: readonly (readonly [number, 0 | 1])[]
}

const full = (bits: readonly (0 | 1)[]) => bits.map((b, i) => [i + 1, b] as const)

/** §6.10 Kimia answers per pupil (a comma value is the repeat in the second session). */
export const KIMIA_SESSIONS: Readonly<Record<number, readonly KimiaSession[]>> = {
  3001: [
    { date: '2026-09-15', seconds: 480, answers: full([1, 1, 1, 1, 0, 1, 1, 1]) },
    { date: '2026-09-24', seconds: 60, answers: [[3, 1]] },
  ],
  3002: [
    { date: '2026-09-15', seconds: 480, answers: full([1, 1, 1, 0, 0, 0, 1, 1]) },
    {
      date: '2026-09-24',
      seconds: 60,
      answers: [
        [2, 0],
        [3, 0],
      ],
    },
  ],
  3003: [{ date: '2026-09-15', seconds: 480, answers: full([1, 1, 1, 0, 0, 0, 0, 0]) }],
  3004: [{ date: '2026-09-15', seconds: 480, answers: full([1, 0, 0, 0, 0, 0, 1, 1]) }],
  3005: [{ date: '2026-09-22', seconds: 480, answers: full([1, 1, 0, 0, 0, 0, 1, 0]) }],
  3006: [{ date: '2026-09-22', seconds: 480, answers: full([1, 0, 1, 0, 0, 0, 0, 1]) }],
  3007: [
    { date: '2026-09-22', seconds: 480, answers: full([0, 0, 1, 0, 1, 0, 0, 0]) },
    { date: '2026-09-24', seconds: 60, answers: [[2, 1]] },
  ],
  3008: [{ date: '2026-09-22', seconds: 480, answers: full([0, 0, 0, 1, 0, 0, 0, 0]) }],
}

/** Sejarah session 2026-09-18 (300 s, 700201–700205): correct answers per pupil. */
export const SEJARAH_SESSION = {
  date: '2026-09-18',
  seconds: 300,
  correct: { 3001: 4, 3002: 3, 3003: 2 },
}

export interface DesignedSession {
  id: string
  userId: number
  subjectId: number
  levelId: number
  completedAt: string
  seconds: number
  questionIds: number[]
  correct: boolean[]
}

const at = (date: string) => toIsoMyt(Date.parse(`${date}T16:00:00+08:00`))

/** H01–H14 ordered by (pupil, completion time). */
export function designedSessions(): DesignedSession[] {
  const rows: Omit<DesignedSession, 'id'>[] = []
  for (const userId of DESIGNED_PUPILS) {
    const own: Omit<DesignedSession, 'id'>[] = []
    for (const s of KIMIA_SESSIONS[userId] ?? []) {
      own.push({
        userId,
        ...KIMIA,
        completedAt: at(s.date),
        seconds: s.seconds,
        questionIds: s.answers.map(([q]) => KIMIA_Q[q - 1] as number),
        correct: s.answers.map(([, c]) => c === 1),
      })
    }
    const sej = (SEJARAH_SESSION.correct as Record<number, number>)[userId]
    if (sej !== undefined) {
      own.push({
        userId,
        ...SEJARAH,
        completedAt: at(SEJARAH_SESSION.date),
        seconds: SEJARAH_SESSION.seconds,
        questionIds: SEJARAH_Q.slice(0, 5),
        correct: [0, 1, 2, 3, 4].map((i) => i < sej),
      })
    }
    own.sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt))
    rows.push(...own)
  }
  return rows.map((r, i) => ({ id: `H${String(i + 1).padStart(2, '0')}`, ...r }))
}

/** First designed answer id (M08's anchor block 510,001–999,999 of the answer log). */
export const ANSWER_ID_START = 510_001
