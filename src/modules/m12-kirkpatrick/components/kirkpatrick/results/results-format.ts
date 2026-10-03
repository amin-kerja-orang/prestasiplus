/**
 * Class strings of S5 (SRS M12 FN-M12-6.x; BR-M12-17/21/22). Full literals so Tailwind sees them. The hex values of
 * the spec are their Tailwind palette equivalents (A+ #15803d = green-700 ... G #991b1b = red-800).
 */

import type { AlesaRow, SpmGrade } from '../../../api/types'

export const GRADES: readonly SpmGrade[] = ['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E', 'G']

/** Solid fill of a grade (distribution bars, grade pills). */
export const GRADE_FILL: Record<SpmGrade, string> = {
  'A+': 'bg-green-700',
  A: 'bg-green-600',
  'A-': 'bg-green-500',
  'B+': 'bg-blue-600',
  B: 'bg-blue-500',
  'C+': 'bg-yellow-600',
  C: 'bg-yellow-500',
  D: 'bg-orange-600',
  E: 'bg-red-600',
  G: 'bg-red-800',
}

/** Text colour of the accuracy in the prediction table (by grade band, FN-M12-6.6.1). */
export const GRADE_TEXT: Record<SpmGrade, string> = {
  'A+': 'text-green-700',
  A: 'text-green-700',
  'A-': 'text-green-700',
  'B+': 'text-blue-600',
  B: 'text-blue-600',
  'C+': 'text-yellow-600',
  C: 'text-yellow-600',
  D: 'text-orange-600',
  E: 'text-orange-600',
  G: 'text-red-600',
}

/** Pill colours of the Anggaran Gred (A band, B band, C band, D/E, G; FN-M12-6.6.1). */
export const GRADE_PILL: Record<SpmGrade, string> = {
  'A+': 'bg-green-700',
  A: 'bg-green-700',
  'A-': 'bg-green-700',
  'B+': 'bg-blue-600',
  B: 'bg-blue-600',
  'C+': 'bg-yellow-600',
  C: 'bg-yellow-600',
  D: 'bg-orange-600',
  E: 'bg-orange-600',
  G: 'bg-red-600',
}

export const CONFIDENCE: Record<AlesaRow['confidence'], { label: string; cls: string }> = {
  rendah: { label: 'Rendah', cls: 'text-slate-500 bg-slate-100' },
  sederhana: { label: 'Sederhana', cls: 'text-amber-600 bg-amber-50' },
  tinggi: { label: 'Tinggi', cls: 'text-green-600 bg-green-50' },
}

/** The stored Cadangan band to its text (FN-M12-6.7.3). */
export const CADANGAN: Record<AlesaRow['cadanganBand'], string> = {
  A: 'Teruskan konsistensi latihan. Fokus pada topik yang masih lemah untuk capai kecemerlangan.',
  B: 'Tingkatkan latihan harian. Perlu tambah 20-30 soalan/minggu untuk naik ke gred A.',
  C: 'Pelajar ini perlu meningkatkan jumlah latihan. Cadangan: minimum 10 soalan sehari.',
  'D/E': 'Pelajar memerlukan intervensi segera. Cadangan: bimbingan guru dan program pemulihan.',
}

/** GPS colour of the trend table (BR-M12-20): <= 4.00 green-600, above amber-600. */
export const gpsText = (v: number) => (v <= 4 ? 'text-green-600' : 'text-amber-600')
