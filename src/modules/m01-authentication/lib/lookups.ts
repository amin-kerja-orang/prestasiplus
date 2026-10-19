/** M01 static lookups (SRS §6.7 DATA-M01-08). */

export interface StateOption {
  /** Sent to `GET /api/schools/search?state=` (the full name). */
  value: string
  label: string
}

/** The 16 states and territories: value = full name; the register select shows the short labels. */
const STATE_VALUES = [
  'Johor',
  'Kedah',
  'Kelantan',
  'Kuala Lumpur',
  'Labuan',
  'Melaka',
  'Negeri Sembilan',
  'Pahang',
  'Perak',
  'Perlis',
  'Pulau Pinang',
  'Putrajaya',
  'Sabah',
  'Sarawak',
  'Selangor',
  'Terengganu',
] as const

const REGISTER_LABELS: Readonly<Record<string, string>> = {
  'Kuala Lumpur': 'KL',
  'Negeri Sembilan': 'N.Sembilan',
  'Pulau Pinang': 'P.Pinang',
}

/** Register select (S2): "Negeri" placeholder option first, then the 16 states with short labels. */
export const REGISTER_STATE_OPTIONS: readonly StateOption[] = STATE_VALUES.map((value) => ({
  value,
  label: REGISTER_LABELS[value] ?? value,
}))

/** Role cards (S2, DATA-M01-08). */
export const ROLE_CARDS = [
  { value: 'student', emoji: '👨‍🎓', title: 'Pelajar', text: 'Saya ingin belajar' },
  { value: 'teacher', emoji: '👨‍🏫', title: 'Guru', text: 'Saya ingin mengajar' },
  { value: 'parent', emoji: '👨‍👩‍👧', title: 'Ibu Bapa', text: 'Pantau anak saya' },
] as const

export type RegisterRole = (typeof ROLE_CARDS)[number]['value']

/** Darjah 1-6 (value n) and Ting. 1-5 (value n + 6), FR-M01-20. */
export const DARJAH_GRADES = [1, 2, 3, 4, 5, 6] as const
export const TINGKATAN_GRADES = [1, 2, 3, 4, 5] as const

/** Profile select (S8): the select adds "Semua Negeri" first, then the 16 states with full names. */
export const PROFILE_STATE_OPTIONS: readonly StateOption[] = STATE_VALUES.map((value) => ({
  value,
  label: value,
}))
