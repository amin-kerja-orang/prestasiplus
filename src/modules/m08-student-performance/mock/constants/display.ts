/**
 * Documented display constants of M08 (overview §6.6 D11 exception; SRS DV-M08-32, BR-M08-28): observed
 * figures that no definition over the owners' datasets reproduces. They are excluded from the dataset
 * fit check and are never shown next to a contradicting computed figure: a view either shows the
 * constant or shows no computed header (see schoolItemAnalysis). DISPLAY_CONSTANTS lists them
 * all (a unit test pins the list).
 *
 * 8880 (all, T4) after XR-M08-M05-03: the log now reproduces the headlines (T4 15 pupils, 6,563 answers, 76.3 %;
 * all 59 pupils, 71.7 %, 10,196 answers vs observed 10,194), but NOT the subject tables (the log spreads 18
 * subjects, the S30 rows list 5), so the constants stay for the whole view; headline and table are never mixed.
 *
 * 8765 "all" (83.8 %) is kept only because 83.8 % is observed; the log gives 82.4 %, a 1.4-point gap it masks.
 */

import type { StandingPeriod } from '../repository/types'

/**
 * The observed S30 figures of M18 §6.11 C / the top-up snapshot, stored as **documented display
 * constants** (overview §6.6 D11 exception). After XR-M08-M05-03 the log reproduces the 8880 headlines
 * (T4 exactly; all within 2 answers) but not the subject tables (18 subjects in the log, 5 observed), so
 * S9 shows these observed rows for the scopes listed and computes every other school from the log, never
 * both on one screen.
 * `subjects`: [subject name, pupils, distinct questions, accuracy %, wrong answers] (accuracy ascending).
 * `tingkatan` null = the whole school. The 8765 / 2710 figures are the observed S30 rows; their T4 / T5
 * views are not observed, so a view with a stored question list but no constant shows no computed header.
 */
export const SCHOOL_ITEM_SUMMARIES: readonly {
  schoolId: number
  tingkatan: 'T4' | 'T5' | null
  students: number
  answers: number
  accuracy: number
  subjects: readonly (readonly [
    name: string,
    pupils: number,
    questions: number,
    accuracy: number,
    wrong: number,
  ])[]
}[] = [
  {
    schoolId: 8880,
    tingkatan: null,
    students: 59,
    answers: 10194,
    accuracy: 71.7,
    subjects: [
      ['Sains', 29, 1094, 70.9, 539],
      ['Sejarah', 29, 1109, 71, 615],
      ['Bahasa Inggeris', 29, 851, 71.9, 539],
      ['Bahasa Melayu', 30, 507, 72, 580],
      ['Matematik', 31, 817, 72.4, 614],
    ],
  },
  {
    schoolId: 8880,
    tingkatan: 'T4',
    students: 15,
    answers: 6563,
    accuracy: 76.3,
    subjects: [
      ['Sejarah', 15, 854, 75.7, 312],
      ['Bahasa Inggeris', 15, 720, 75.8, 314],
      ['Bahasa Melayu', 15, 471, 76, 327],
      ['Sains', 15, 831, 76.7, 272],
      ['Matematik', 15, 710, 77.4, 328],
    ],
  },
  {
    schoolId: 8765,
    tingkatan: null,
    students: 21,
    answers: 222,
    accuracy: 83.8,
    subjects: [
      ['Matematik', 6, 60, 77.3, 17],
      ['Bahasa Melayu', 1, 43, 83.7, 7],
      ['Sejarah', 1, 52, 84.6, 8],
      ['Pendidikan Islam', 1, 50, 92.3, 4],
    ],
  },
  {
    schoolId: 2710,
    tingkatan: null,
    students: 4,
    answers: 119,
    accuracy: 38.7,
    subjects: [
      ['Sejarah', 1, 40, 35, 26],
      ['Bahasa Melayu', 1, 79, 40.5, 47],
    ],
  },
]

/**
 * Observed standings [accuracy, coins]. Coins of rows 4–5 and every session count are NOT observed:
 * INFERRED as a value just below the podium (coins) and `round(coins ÷ 12)` (sessions), so the order
 * podium, 4, 5, generated holds. The accuracy of an observed row may exceed 100 (live data fault,
 * capped on display, DV-07).
 */
export const OBSERVED_STANDINGS: Readonly<
  Record<StandingPeriod, readonly (readonly [accuracy: number, coins: number])[]>
> = {
  week: [
    [98, 1547],
    [89, 1215],
    [99, 787],
    [68, 784],
    [100, 782],
  ],
  month: [
    [94, 5199],
    [99, 3363],
    [85, 2999],
    [79, 2900],
    [98, 2800],
  ],
  all: [
    [88, 64689],
    [101, 30510],
    [93, 25736],
    [98, 25000],
    [84, 24000],
  ],
}

/** Generated learners: count and coin ladder `start − step × i` (week 780 − 15 i is observed; the others INFERRED). */
export const GENERATED_STANDINGS: Readonly<
  Record<StandingPeriod, { count: number; start: number; step: number }>
> = {
  week: { count: 33, start: 780, step: 15 },
  month: { count: 60, start: 2790, step: 45 },
  all: { count: 1042, start: 23000, step: 20 },
}

export const DISPLAY_CONSTANTS: readonly { id: string; dv: string; where: string; why: string }[] =
  [
    {
      id: 'SCHOOL_ITEM_SUMMARIES',
      dv: 'DV-M08-32',
      where: 'S9 header and subject table of 8880 (all, T4), 8765 (all), 2710 (all)',
      why: 'observed S30 rows; the M05 log gives other figures (XR-M08-M05-03)',
    },
    {
      id: 'OBSERVED_STANDINGS',
      dv: 'BR-M08-28',
      where: 'S20 podium and rows 4–5 (week, month, all)',
      why: 'observed coins need more answers than the log holds',
    },
    {
      id: 'GENERATED_STANDINGS',
      dv: 'BR-M08-28',
      where: 'S20 generated learners (33 / 60 / 1,042)',
      why: 'participant counts are observed, their coins are not derivable',
    },
  ]
