import type { RemedialStatus } from '../../api/types'

/** Exact BM copy of S3 (URS FN-M10-2.3.1..3; the populated list is PROPOSED, L-M10-04). */
export const REMEDIAL_PROGRESS_COPY = {
  title: 'Remedial Progress Dashboard',
  subtitle: 'Jejak peningkatan pelajar melalui ujian pemulihan',
  listTitle: 'Senarai Pelajar & Progress',
  emptyTitle: 'Belum ada ujian remedial dijana.',
  emptyBody: 'Buka Command Center → klik Remedial untuk mula.',
  loadFailed: 'Gagal memuatkan data remedial. Sila cuba lagi.',
  retry: 'Cuba Lagi',
  statTotal: 'JUMLAH SET',
  statCompleted: 'SELESAI',
  statStudents: 'PELAJAR',
  statImprovement: 'PURATA PENINGKATAN',
} as const

/** PROPOSED status labels of a remedial test row. */
export const REMEDIAL_STATUS_LABEL: Record<RemedialStatus, string> = {
  active: 'Aktif',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
}
