/** Labels and styles of S7 (SRS M12 FN-M12-8.x; BR-M12-26/27). */

import type { AlertType, InterventionStatus, Mood } from '../../../api/types'

export const ALERT_TYPES: { value: AlertType; label: string }[] = [
  { value: 'mood', label: 'Mood / Kesejahteraan' },
  { value: 'inactive', label: 'Tidak Aktif' },
  { value: 'declining', label: 'Prestasi Menurun' },
  { value: 'other', label: 'Lain-lain' },
]

/**
 * The Admin Pusat mount offers the three V2 types only (V2 admin/kirkpatrick/interventions.blade.php:119-121; SRS
 * FN-M12-8.2.2); "Lain-lain" (`other`, ADD-05, DM-30) is for the guru and school-admin mounts. The stored value set is unchanged.
 */
export const ADMIN_ALERT_TYPES = ALERT_TYPES.filter((t) => t.value !== 'other')

export const MOODS: { value: Mood; label: string }[] = [
  { value: 'happy', label: 'Gembira' },
  { value: 'okay', label: 'Okay' },
  { value: 'sad', label: 'Sedih' },
  { value: 'stressed', label: 'Tertekan' },
]

export const alertLabel = (v: AlertType) => ALERT_TYPES.find((a) => a.value === v)?.label ?? v
export const moodLabel = (v: Mood | null) =>
  v === null ? '' : (MOODS.find((m) => m.value === v)?.label ?? v)

/** Status badge colour (PROPOSED layout, FN-M12-8.3.2); the badge also prints the status word. */
export const STATUS_COLOR: Record<
  NonNullable<InterventionStatus>,
  'warning' | 'success' | 'error'
> = {
  'Menunggu Semakan': 'warning',
  Meningkat: 'success',
  Menurun: 'error',
}

/** The PROPOSED COPY of the server refusal (SRS §8.2). */
export const STUDENT_NOT_FOUND = 'Pelajar tidak dijumpai.'
