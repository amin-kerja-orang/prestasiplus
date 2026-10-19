/**
 * Seed values of the provisional stores hosted in M17 (F-33). OBSERVED values are marked; every
 * other value is INFERRED and named as such. Sources: M17 SRS §6.4, §6.8 XR-M17-17/18. The sponsor
 * seed moved to M21 (M21-T1).
 */

import type { TuitionCentreRow } from '../repository/provisional-types'

/** OBSERVED (XR-M17-17): the two centres, with the observed city, state and active pupils. */
export const TUITION_CENTRES: readonly TuitionCentreRow[] = [
  {
    id: 1,
    name: 'Pusat Tuisyen Demo PrestasiPlus',
    city: 'Johor Bahru',
    state: 'Johor',
    activePupils: 18,
  },
  { id: 2, name: 'Alesa IT Tuisyen', city: 'KLUANG', state: 'Johor', activePupils: 0 },
]

/**
 * OBSERVED (XR-M17-18): 750 check-ins, happy 307, okay 280, sad 72, stressed 91, all before
 * 1 Sep 2026; none for pupil 2022 or class 370 in the last 30 days.
 * INFERRED (nothing else observed): the dates are drawn deterministically from
 * 2026-01-05 … 2026-08-14 (so every check-in is more than 30 days before any clock from
 * 2026-09-13 on, which keeps S3 "Bulan Ini" 0, S6 "-" and S7 "Tiada data mood"); the pupils are
 * drawn from active students (pupil 2022 and the fixture-school pupils excluded); the reasons are
 * short generic Malay phrases.
 */
export const MOOD_WINDOW = { from: '2026-01-05', days: 222 } as const

export const MOOD_REASONS: Readonly<
  Record<'happy' | 'okay' | 'sad' | 'stressed', readonly (string | null)[]>
> = {
  happy: [null, 'Dapat markah baik', 'Bermain bersama kawan', 'Cuaca cerah'],
  okay: [null, 'Hari biasa', 'Tiada apa-apa'],
  sad: ['Bergaduh dengan kawan', 'Rindu keluarga', 'Markah kurang baik'],
  stressed: ['Terlalu banyak kerja rumah', 'Peperiksaan hampir', 'Tidak faham topik'],
}

/**
 * Excluded from mood check-ins: 2022 (XR-M17-18: none in the last 30 days), user 2 (a canonical demo
 * account) and 3001-3008 (the fixture-school demo pupils of class 2001, whose mood panels stay
 * empty, M17 R-37 "empty elsewhere"). Kept out entirely rather than only by date.
 *
 * The pupil whose check-ins must not exist in the last 30 days (XR-M17-18); excluded entirely. */
export const EXCLUDED_MOOD_USERS: readonly number[] = [
  2022, 2, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008,
]

/** How many distinct pupils the 750 check-ins are spread over (INFERRED). */
export const MOOD_PUPILS = 500
