/** Fixed lists of the M12 rules (SRS M12 v1.6 §4). */

/** SPM grades, best first; index = M08 grade point (A+ 0 ... G 9, BR-M08-01). */
export const SPM_GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E', 'G'] as const
export type SpmGrade = (typeof SPM_GRADES)[number]

/** The engagement bands (BR-M12-06), in display order. */
export const BAND_KEYS = [
  'champion',
  'konsisten',
  'berkembang',
  'minimum',
  'tidakTerlibat',
] as const
export type BandKey = (typeof BAND_KEYS)[number]

/** Alert types of an intervention (DATA-M12-02). */
export const ALERT_TYPES = ['mood', 'inactive', 'declining'] as const
export const MOODS = ['happy', 'okay', 'sad', 'stressed'] as const

/** The Malay month names are `monthName(m)` of `@/lib/time`; the English short forms are live's date style. */
export const ENGLISH_SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const
