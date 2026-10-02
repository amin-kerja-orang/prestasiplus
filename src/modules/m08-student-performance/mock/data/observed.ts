/**
 * Observed and designed M08 store rows (SRS M08 v1.11 §6.8–§6.10). Values are literal: OBSERVED unless
 * marked INFERRED; nothing is tuned to make totals agree (CLAUDE.md §6). All people are fictitious.
 */

import type { Grade } from '../repository/rules'

// ---------------------------------------------------------------------------------------------
// SchoolSpmHistory (§6.8)
// ---------------------------------------------------------------------------------------------

/** Platform rows 2022–2025 (source "SPM Sebenar"); the current year has no row (S1 "Tiada data"). */
export const PLATFORM_SPM: readonly {
  year: number
  gps: number
  candidates: number
  gradeCounts: number[] | null
}[] = [
  { year: 2022, gps: 5.2, candidates: 150, gradeCounts: null },
  { year: 2023, gps: 4.8, candidates: 160, gradeCounts: null },
  { year: 2024, gps: 4.5, candidates: 175, gradeCounts: null },
  { year: 2025, gps: 4.3, candidates: 180, gradeCounts: [10, 18, 24, 32, 32, 26, 21, 11, 5, 1] },
]

/** Chart series of S1, hard-coded as live (discovery §6.1, DV-27). `null` = no data. */
export const GPS_CHART = {
  labels: [2022, 2023, 2024, 2025, 2026],
  overall: [5.2, 4.8, 4.5, 4.3, null] as (number | null)[],
  subjects: [
    { name: 'Bahasa Melayu', color: '#f87171', data: [4.8, 4.5, 4.2, 4, 2.8] },
    { name: 'Matematik', color: '#60a5fa', data: [5.5, 5.1, 4.75, 4.45, 2.5] },
    { name: 'Bahasa Inggeris', color: '#34d399', data: [5.2, 4.9, 4.55, 4.3, 3.2] },
    { name: 'Sains', color: '#fbbf24', data: [5.8, 5.4, 5, 4.7, 2.9] },
    { name: 'Pendidikan Islam', color: '#a78bfa', data: [4.2, 3.9, 3.65, 3.4, null] },
    { name: 'Sejarah', color: '#f472b6', data: [5.6, 5.2, 4.8, 4.5, 3] },
  ] as { name: string; color: string; data: (number | null)[] }[],
}

/** School rows (XL3-07): 8080 2026 (M12), 8880 2026 subject rows (M17 R-26 "GPS 2.88 · 5 subjek · 150 calon"). */
export const SCHOOL_SPM: readonly {
  schoolId: number
  year: number
  gps: number
  candidates: number
  gradeCounts: number[] | null
  subjects: { subjectName: string; gps: number; candidates: number }[]
}[] = [
  {
    schoolId: 8080,
    year: 2026,
    gps: 4,
    candidates: 1,
    gradeCounts: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
    subjects: [],
  },
  {
    schoolId: 8880,
    year: 2026,
    gps: 2.88,
    candidates: 150,
    gradeCounts: null,
    subjects: [
      { subjectName: 'Matematik', gps: 2.5, candidates: 30 },
      { subjectName: 'Bahasa Melayu', gps: 2.8, candidates: 30 },
      { subjectName: 'Sains', gps: 2.9, candidates: 30 },
      { subjectName: 'Sejarah', gps: 3, candidates: 30 },
      { subjectName: 'Bahasa Inggeris', gps: 3.2, candidates: 30 },
    ],
  },
]

// ---------------------------------------------------------------------------------------------
// Admin SP records (S7, §6.10): BM 79 answers 40.5 % (3 / 6 / 17 / 0), SEJ 40 answers 35.0 % (8 / 2 / 13 / 0)
// ---------------------------------------------------------------------------------------------

/** The seven observed weak cards (all 0 % correct): [spId, subjectId, answered]. */
export const ADMIN_WEAK_CARDS: readonly (readonly [
  spId: number,
  subjectId: number,
  answered: number,
])[] = [
  [221, 1, 3],
  [206, 1, 1],
  [222, 1, 1],
  [214, 1, 4],
  [179, 1, 1],
  [194, 1, 1],
  [418, 5, 1],
]

/**
 * Generated SP records that reach the observed band counts (INFERRED split; the SP ids are M08
 * M10 SP ids, see ADMIN_GENERATED_SP). [answered, correct] per record.
 * BM: 3 mahir + 6 sederhana + 11 lemah generated (with the 6 observed lemah = 17); SEJ: 8 mahir + 2
 * sederhana + 12 lemah generated (with 418 = 13).
 */
export const ADMIN_GENERATED: Readonly<
  Record<number, readonly (readonly [answered: number, correct: number])[]>
> = {
  1: [
    [8, 7],
    [6, 5],
    [5, 4],
    [6, 4],
    [5, 3],
    [5, 3],
    [4, 2],
    [4, 2],
    [3, 2],
    ...Array.from({ length: 11 }, () => [2, 0] as const),
  ],
  5: [
    [2, 2],
    [2, 2],
    [2, 2],
    [2, 2],
    [1, 1],
    [1, 1],
    [1, 1],
    [1, 1],
    [2, 1],
    [2, 1],
    ...Array.from({ length: 11 }, () => [2, 0] as const),
    [1, 0],
  ],
}

/**
 * The M10 DSKP SPs of the generated admin records, in the order of `ADMIN_GENERATED` (XR-M08-M10-01,
 * resolved: M10 seeded the filler block 9401+ and the Darjah 4 map tiles). The first records of each
 * subject sit on the Darjah 4 map tiles (BM 8024, 9401, 9402; SEJ 8104, 9403), so the map has no
 * unanswered tile and "Belum" stays 0 as observed. The assignment of records to SPs is INFERRED.
 */
export const ADMIN_GENERATED_SP: Readonly<Record<number, readonly number[]>> = {
  1: [
    8024, 9401, 9402, 9411, 9412, 9413, 9414, 9415, 9416, 9417, 9421, 9422, 9423, 9424, 9425, 9431,
    9432, 9433, 8030, 8031,
  ],
  5: [
    8104, 9403, 9441, 9442, 9443, 9444, 9445, 9446, 9451, 9452, 9453, 9454, 9455, 9461, 9462, 9463,
    9464, 9471, 9472, 9473, 9474, 8111,
  ],
}

// ---------------------------------------------------------------------------------------------
// Ranking entries (S19, §6.10): the three observed ranked students (Selangor, level 11)
// ---------------------------------------------------------------------------------------------

/**
 * `school` and `district` are INFERRED (the live values are not in the SRS; the fixture school SMK DEMO
 * is used). Figures are [tahap, correct, accuracy]: `all`, and Matematik (subject 3), in list order.
 */
export const RANKING_ENTRIES: readonly {
  name: string
  all: readonly [number, number, number]
  math: readonly [number, number, number]
}[] = [
  { name: 'Nur Aina Demo', all: [8, 2223, 93.48], math: [4, 128, 48.85] },
  { name: 'Adam Firdaus Demo', all: [10, 5293, 83.79], math: [7, 530, 35.5] },
  { name: 'Siti Hajar Demo', all: [10, 17612, 89.94], math: [8, 889, 99.78] },
]

// ---------------------------------------------------------------------------------------------
// Risk profiles (S8, §6.10)
// ---------------------------------------------------------------------------------------------

/** Class 4 subject 1 (six pupils): accuracy 0.0, risk and the observed grade ranges (they do not follow the accuracy). */
export const CLASS4_BM: readonly { risk: 'medium' | 'low'; low: Grade; high: Grade }[] = [
  { risk: 'medium', low: 'E', high: 'B' },
  { risk: 'low', low: 'D', high: 'A-' },
  { risk: 'low', low: 'A-', high: 'A+' },
  { risk: 'low', low: 'C+', high: 'A' },
  { risk: 'medium', low: 'G', high: 'B' },
  { risk: 'low', low: 'C', high: 'A-' },
]
/** Class 4 subject 5: risk only observed; the ranges follow BR-M08-14 for accuracy 0 (INFERRED). */
export const CLASS4_SEJ_RISK: readonly ('medium' | 'low')[] = [
  'medium',
  'low',
  'low',
  'medium',
  'medium',
  'medium',
]

/** Class 2001 (Kimia) risk levels by pupil (§6.10). */
export const RISK_2001: Readonly<Record<number, 'low' | 'medium' | 'high' | 'critical'>> = {
  3001: 'low',
  3002: 'medium',
  3003: 'medium',
  3004: 'high',
  3005: 'medium',
  3006: 'high',
  3007: 'critical',
  3008: 'critical',
}
