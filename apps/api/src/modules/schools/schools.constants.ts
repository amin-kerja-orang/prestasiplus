/** The 16 states and federal territories (mock `STATE_NAMES`); `state` on a school must be one of them. */
export const STATE_NAMES: readonly string[] = [
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
]

/** Audit action names of the school writes (ids and changed field names only, never personal data). */
export const SCHOOL_AUDIT = {
  CREATED: 'school.created',
  UPDATED: 'school.updated',
  TOGGLED: 'school.toggled',
} as const

/** Join code alphabet: upper-case letters and digits without 0/O/1/I/L. */
export const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const JOIN_CODE_LENGTH = 8
