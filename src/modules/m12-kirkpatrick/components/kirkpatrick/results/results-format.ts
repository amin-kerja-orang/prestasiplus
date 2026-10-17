/**
 * Labels and token colours of S5 (SRS M12 FN-M12-6.x; BR-M12-17/21/22). Colours are theme tokens only
 * (success / info / warning / error); every badge also prints its word.
 */

import type { AlesaRow, SpmGrade } from '../../../api/types'
import type { KirkColor } from '../common/kirkpatrick-format'

export const GRADES: readonly SpmGrade[] = ['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E', 'G']

/** Colour of a grade badge in the prediction tables (A band, B band, C band, D/E, G; FN-M12-6.6.1). */
export const GRADE_PILL: Record<SpmGrade, KirkColor> = {
  'A+': 'success',
  A: 'success',
  'A-': 'success',
  'B+': 'info',
  B: 'info',
  'C+': 'warning',
  C: 'warning',
  D: 'warning',
  E: 'warning',
  G: 'error',
}

/** Text token of a colour (accuracy in the prediction table follows the grade band, FN-M12-6.6.1). */
export const COLOR_TEXT: Record<KirkColor, string> = {
  primary: 'text-primary',
  success: 'text-success',
  info: 'text-info',
  warning: 'text-warning',
  error: 'text-error',
  neutral: 'text-muted',
}

export const CONFIDENCE: Record<AlesaRow['confidence'], { label: string; color: KirkColor }> = {
  rendah: { label: 'Rendah', color: 'neutral' },
  sederhana: { label: 'Sederhana', color: 'warning' },
  tinggi: { label: 'Tinggi', color: 'success' },
}

/** The stored Cadangan band to its text (FN-M12-6.7.3). */
export const CADANGAN: Record<AlesaRow['cadanganBand'], string> = {
  A: 'Teruskan konsistensi latihan. Fokus pada topik yang masih lemah untuk capai kecemerlangan.',
  B: 'Tingkatkan latihan harian. Perlu tambah 20-30 soalan/minggu untuk naik ke gred A.',
  C: 'Pelajar ini perlu meningkatkan jumlah latihan. Cadangan: minimum 10 soalan sehari.',
  'D/E': 'Pelajar memerlukan intervensi segera. Cadangan: bimbingan guru dan program pemulihan.',
}

/** GPS colour of the trend table (BR-M12-20): <= 4.00 success, above warning. */
export const gpsText = (v: number) => (v <= 4 ? 'text-success' : 'text-warning')
