/**
 * Business rules and fixed values of the M05 write path (SRS M05 v1.16 §4, §5, §8.3; M06 BR-M06-04
 * / 07 / 13 for the SPM modes that go through M05 #4).
 */

import type { PracticeMode } from '../datasets/types'

/** BR-35: practice modes (M08 BR-M08-11, M16 Q-WEEK-RANK count them); SPM modes. */
export const PRACTICE_MODES: readonly PracticeMode[] = [
  'random',
  'chapter',
  'revision',
  'mission',
  'remedial',
  'question_set',
  'pksk',
]
export const SPM_MODES: readonly PracticeMode[] = ['past_year', 'latih_tubi', 'ramalan']
export const ALL_MODES: readonly PracticeMode[] = [...PRACTICE_MODES, ...SPM_MODES]

export const isMode = (v: unknown): v is PracticeMode =>
  typeof v === 'string' && (ALL_MODES as readonly string[]).includes(v)

/** §5: question counts of random and chapter sessions (§6.10). */
export const COUNT_OPTIONS = [5, 10, 15, 20] as const
/** BR-14 / §6.10: revision length. */
export const REVISION_LENGTH = 20
/** BR-M06-13: `past_year` counts. */
export const PAST_YEAR_COUNTS = [5, 10, 20] as const
/** BR-M06-04: Latih Tubi counts of a subject without a target. */
export const LATIH_TUBI_COUNTS = [5, 10, 20, 30, 40, 50, 60] as const
/**
 * BR-M06-04: Latih Tubi target sizes per M03 subject id (custom 34 BM, 36 BI; spm 40 MATH, SCI,
 * SEJ, GEO, BIO, CHEM, PHY; latihan 40 PI, PM, EKON, BA, PSI; 20 ADDMATH; none PERNIAGA, AKAUN,
 * PSV, TI). M06 owns this configuration; M05 reads this copy until M06-T1 exposes it (INFERRED
 * seam, the values are M06's observed ones).
 */
export const LATIH_TUBI_TARGETS: Readonly<Record<number, number>> = {
  1: 34,
  2: 36,
  3: 40,
  4: 40,
  5: 40,
  12: 40,
  11: 40,
  10: 40,
  9: 40,
  6: 40,
  7: 40,
  22: 40,
  18: 40,
  27: 40,
  8: 20,
}
/**
 * BR-11 (reversed by D54, 2026-10-24: secondary school and SPM only): the offered practice levels
 * are Tingkatan 4 and 5 (M03 level ids 10, 11); live offered Darjah 1–4. The first offered level
 * (T4) is the default of the chapter and practice pages.
 */
export const OFFERED_LEVEL_IDS = [10, 11] as const
/** The SPM levels (T4, T5). */
export const SPM_LEVEL_IDS = [10, 11] as const

/** BR-30: `timeSpent` cap per question (3 × 60 s; SEC-M05-03). */
export const MAX_SECONDS_PER_QUESTION = 180
/** BR-09. */
export const POINTS_PER_CORRECT = 10
export { MISSION_COINS_PER_CORRECT, sessionCoins } from '../datasets/pins'
/** BR-16: chapter unlock score. */
export const UNLOCK_SCORE = 70

/** §8.3 PROPOSED mock messages of the session calls (and the observed S7 fallback). */
export const MESSAGES = {
  trialExhausted: 'Baki percubaan percuma anda telah habis.',
  chapterLocked: 'Bab ini masih dikunci.',
  notEnough: 'Soalan tidak mencukupi.',
  revisionFailed: 'Maaf, terdapat masalah memuatkan kuiz ulang kaji.',
  invalidAnswer: 'Jawapan tidak sah.',
  missionDone: 'Misi ini sudah diselesaikan.',
  remedialDone: 'Ujian ini sudah selesai.',
  noAttempts: 'Tiada percubaan lagi untuk set ini.',
} as const

/** S7 (revision, OBSERVED) and Q1/Q2 (PROPOSED) feedback titles. */
export function feedbackText(mode: PracticeMode, isCorrect: boolean): string {
  if (mode === 'revision') return isCorrect ? 'Betul! Kali ini berjaya!' : 'Masih belum tepat'
  return isCorrect ? 'Betul!' : 'Salah'
}

/** Error of a repository call that the handler maps to an HTTP answer. */
export class PracticeError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Readonly<Record<string, string>>,
  ) {
    super(message)
    this.name = 'PracticeError'
  }
}

export const LETTERS = ['A', 'B', 'C', 'D'] as const
