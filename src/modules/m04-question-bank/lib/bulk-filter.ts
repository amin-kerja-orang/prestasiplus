/**
 * Copy and pure helpers of the S3.2 "Luluskan Hasil Tapisan" / "Arkib Semua" bulk-by-filter actions
 * (REQ-A-021; docs/design/v2-admin-student-pipeline.md S3.2, UX-78). Verbatim V2 text unless marked
 * [PROPOSED] in the design spec section 16.
 */

import type { QuestionFilterAction, QuestionFilterBulkResult } from '../api/questions'

export const BULK_FILTER_LABELS: Record<QuestionFilterAction, string> = {
  approved: 'Luluskan Hasil Tapisan',
  archived: 'Arkib Semua',
}
export const BULK_FILTER_TITLES: Record<QuestionFilterAction, string> = {
  approved: 'Luluskan semua soalan yang sepadan dengan tapisan semasa',
  archived: 'Arkibkan semua soalan — sembunyikan daripada pelajar',
}
export const BULK_FILTER_CONFIRM: Record<QuestionFilterAction, string> = {
  approved: 'Luluskan SEMUA soalan hasil tapisan ini? Ia akan kelihatan kepada pelajar.',
  archived:
    'ARKIB SEMUA soalan?\n\nBank soalan pelajar akan menjadi KOSONG sehingga anda luluskan soalan secara manual (per soalan atau per tapisan). Tindakan ini boleh dibalikkan.',
}
/** V2: shown when "Luluskan Hasil Tapisan" is used without a filter. */
export const BULK_FILTER_NEEDED =
  'Sila pilih sekurang-kurangnya satu penapis (subjek/aras/status/carian) sebelum meluluskan secara pukal.'

/** [PROPOSED] UX-78. */
export const BULK_FILTER_NONE_ELIGIBLE: Record<QuestionFilterAction, string> = {
  approved: 'Tiada soalan hasil tapisan ini yang boleh diluluskan (hanya soalan berstatus Menunggu Semakan).',
  archived: 'Tiada soalan yang boleh diarkibkan.',
}

/** Success banner: V2 text for the approve case and the archive case. */
export function bulkFilterSuccess(action: QuestionFilterAction, affected: number): string {
  return action === 'approved'
    ? `Berjaya luluskan ${String(affected)} soalan (hasil tapisan) — kini kelihatan kepada pelajar.`
    : `Berjaya arkib ${String(affected)} soalan. Bank pelajar kini kosong — luluskan soalan secara manual untuk memaparkannya semula.`
}

/** [PROPOSED] UX-78: the count line added to the confirm dialog after the dry run. */
export function bulkFilterCountLine(action: QuestionFilterAction, r: QuestionFilterBulkResult): string {
  const verb = action === 'approved' ? 'diluluskan' : 'diarkibkan'
  const cap =
    r.eligible > r.cap ? ` Hanya ${String(r.cap)} soalan diproses setiap kali; jalankan semula untuk baki.` : ''
  return `${String(r.eligible)} daripada ${String(r.matched)} soalan sepadan akan ${verb}.${cap}`
}

/** [PROPOSED] UX-78: notes under the success banner (rows left alone, rows left for another run). */
export function bulkFilterNotes(r: QuestionFilterBulkResult): string[] {
  const notes: string[] = []
  if (r.skipped > 0) {
    notes.push(`${String(r.skipped)} soalan dilangkau kerana statusnya tidak membenarkan tindakan ini.`)
  }
  if (r.remaining > 0) {
    notes.push(`Baki ${String(r.remaining)} soalan belum diproses. Jalankan tindakan sekali lagi.`)
  }
  return notes
}

/** [PROPOSED] AC-03.3 heading of the refused-rows panel. */
export function bulkFilterFailedHeading(action: QuestionFilterAction, m: number): string {
  return action === 'approved'
    ? `${String(m)} soalan tidak diluluskan kerana DSKP belum lengkap:`
    : `${String(m)} soalan tidak diarkibkan:`
}

/** Rows listed before the "Lihat {m - 10} lagi" expander. */
export const BULK_FILTER_FAILED_SHOWN = 10
