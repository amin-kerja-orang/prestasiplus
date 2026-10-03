/** Labels and styles of S7 (SRS M12 FN-M12-8.x; BR-M12-26/27). */

import type { AlertType, InterventionStatus, Mood } from '../../../api/types'

export const ALERT_TYPES: { value: AlertType; label: string }[] = [
  { value: 'mood', label: 'Mood / Kesejahteraan' },
  { value: 'inactive', label: 'Tidak Aktif' },
  { value: 'declining', label: 'Prestasi Menurun' },
]

export const MOODS: { value: Mood; label: string }[] = [
  { value: 'happy', label: 'Gembira' },
  { value: 'okay', label: 'Okay' },
  { value: 'sad', label: 'Sedih' },
  { value: 'stressed', label: 'Tertekan' },
]

export const alertLabel = (v: AlertType) => ALERT_TYPES.find((a) => a.value === v)?.label ?? v
export const moodLabel = (v: Mood | null) =>
  v === null ? '' : (MOODS.find((m) => m.value === v)?.label ?? v)

/** Status pill classes (PROPOSED layout, FN-M12-8.3.2). */
export const STATUS_PILL: Record<NonNullable<InterventionStatus>, string> = {
  'Menunggu Semakan': 'bg-amber-100 text-amber-700',
  Meningkat: 'bg-green-100 text-green-700',
  Menurun: 'bg-red-100 text-red-700',
}

/** The PROPOSED COPY of the server refusal (SRS §8.2). */
export const STUDENT_NOT_FOUND = 'Pelajar tidak dijumpai.'
