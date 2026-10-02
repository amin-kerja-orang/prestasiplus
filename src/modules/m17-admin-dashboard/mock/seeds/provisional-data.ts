/**
 * Seed values of the provisional stores hosted in M17 (F-33). OBSERVED values are marked; every
 * other value is INFERRED and named as such. Sources: M17 SRS §6.4, §6.8 XR-M17-16/17/18; M21 SRS
 * v1.2 §6.11 A (sponsors).
 */

import type { SponsorRow, TuitionCentreRow } from '../repository/provisional-types'

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

const NONE = {
  tagline: null,
  logoUrl: null,
  registrationNumber: null,
  contactPersonName: null,
  contactPersonPosition: null,
  contactEmail: null,
  contactPhone: null,
  address: null,
  city: null,
  state: null,
  postcode: null,
} as const

/**
 * OBSERVED (M21 §6.11 A): six sponsors, all `SYARIKAT_SWASTA` and `SUSPENDED`; ids 6-11, names,
 * descriptions, websites and dates as observed on live; time of day 12:00 MYT is designed by the
 * M21 SRS. Linked logins are M02 sponsor users 5501-5505 and the canonical sponsor 7.
 * INFERRED: sponsor 11's contact person name is left empty (a person name is never seeded here;
 * M21 designs a fictitious one) and its contact e-mail, phone and address are the M21 fictitious
 * values.
 */
export const SPONSORS: readonly SponsorRow[] = [
  {
    ...NONE,
    id: 6,
    userId: 5501,
    name: 'Kedai Buku Popular',
    category: 'SYARIKAT_SWASTA',
    description:
      'Rangkaian kedai buku terbesar Malaysia. Menyediakan buku-buku pendidikan berkualiti untuk semua peringkat umur.',
    website: 'https://www.popular.com.my',
    status: 'SUSPENDED',
    createdAt: '2026-02-06T12:00:00+08:00',
  },
  {
    ...NONE,
    id: 7,
    userId: 5502,
    name: 'Faber-Castell Malaysia',
    category: 'SYARIKAT_SWASTA',
    description:
      'Penyedia alat tulis premium untuk pelajar. Pensil, pen warna, dan set lukisan berkualiti tinggi.',
    website: 'https://www.faber-castell.com.my',
    status: 'SUSPENDED',
    createdAt: '2026-02-06T12:00:00+08:00',
  },
  {
    ...NONE,
    id: 8,
    userId: 5503,
    name: 'KidZania Kuala Lumpur',
    category: 'SYARIKAT_SWASTA',
    description:
      'Taman tema pendidikan interaktif di mana kanak-kanak boleh bermain sambil belajar tentang pelbagai kerjaya.',
    website: 'https://www.kidzania.com.my',
    status: 'SUSPENDED',
    createdAt: '2026-02-06T12:00:00+08:00',
  },
  {
    ...NONE,
    id: 9,
    userId: 5504,
    name: 'Petrosains Discovery Centre',
    category: 'SYARIKAT_SWASTA',
    description:
      'Pusat penemuan sains interaktif di KLCC. Jelajahi dunia sains dan teknologi melalui pameran menarik.',
    website: 'https://www.petrosains.com.my',
    status: 'SUSPENDED',
    createdAt: '2026-02-06T12:00:00+08:00',
  },
  {
    ...NONE,
    id: 10,
    userId: 5505,
    name: 'PRESTASIPLUS Official',
    category: 'SYARIKAT_SWASTA',
    description: 'Ganjaran rasmi dari PRESTASIPLUS — hadiah eksklusif untuk pelajar cemerlang!',
    website: 'https://jombelajar.my',
    status: 'SUSPENDED',
    createdAt: '2026-02-06T12:00:00+08:00',
  },
  {
    ...NONE,
    id: 11,
    userId: 7,
    name: 'Alesa It Services',
    category: 'SYARIKAT_SWASTA',
    description: 'Syarikat IT',
    website: 'https://alesa.my',
    contactPersonPosition: 'Pengurus',
    contactEmail: 'pegawai.alesa@demo.test',
    contactPhone: '0100000011',
    address: 'No. 1, Jalan Contoh 1/1',
    city: 'Shah Alam',
    state: 'Selangor',
    postcode: '40000',
    status: 'SUSPENDED',
    createdAt: '2026-03-31T12:00:00+08:00',
  },
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
