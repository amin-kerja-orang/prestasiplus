/**
 * Shared copy, option lists and pure helpers of S21–S24 (M10-T6; FN-M10-7.1–7.4). Copy is the live
 * BM text of URS §7; flashes and server messages are UNVERIFIED COPY (SRS §8.3).
 */
import type { DsStatus } from '@/ds'
import type { QuestionStatus, ScriptType } from '../../api/types'

/**
 * Texts that are not the live copy. Every entry except `confirmDelete` is UNVERIFIED COPY (SRS §8.3):
 * the live pages redirect with flashes that were never observed, or show nothing. `created`, `paperSent`,
 * `importDone` and the empty state are the R1 texts of PRD-20 R1-GUR-44.
 */
export const COPY = {
  /** Live (FR-M10-97). */
  confirmDelete: (id: number): string =>
    `Padam soalan #${String(id)}? Tindakan ini tidak boleh dibatalkan.`,
  // UNVERIFIED COPY
  loadFailed: 'Gagal memuatkan data. Sila cuba lagi.',
  retry: 'Cuba Semula',
  deleted: 'Soalan berjaya dipadam.',
  /** 44-F1 success. */
  created: 'Soalan dihantar untuk semakan.',
  updated: 'Soalan berjaya dikemas kini.',
  saveFailed: 'Gagal menyimpan soalan. Sila cuba lagi.',
  /** ERR-IMP-01 as 44-F3 words it. */
  importDone: (imported: number, failed: number): string =>
    `${String(imported)} soalan diimport, ${String(failed)} baris gagal.`,
  templateFailed: 'Gagal memuat turun template.',
  /** 44-F2 empty state. */
  emptyTitle: 'Belum ada soalan dihantar',
  emptyHint: 'Klik "Tambah Soalan" untuk mula menyumbang!',
  addFirst: 'Tambah Soalan Pertama',
  /** 44-F4 success. */
  paperSent: 'Kertas dihantar kepada admin.',
  paperFailed: 'Gagal menghantar kertas soalan.',
} as const

/** Kesukaran (OPT-KESUKARAN, FR-GUR-44-9): five typed options, stored 1 to 5, never derived from TP. */
export const DIFFICULTY_OPTIONS = [
  { value: 1, label: '⭐ — Sangat mudah' },
  { value: 2, label: '⭐⭐ — Mudah' },
  { value: 3, label: '⭐⭐⭐ — Sederhana' },
  { value: 4, label: '⭐⭐⭐⭐ — Sukar' },
  { value: 5, label: '⭐⭐⭐⭐⭐ — Sangat sukar' },
] as const

/** The list display of a Kesukaran: the star repeated n times (OPT-KESUKARAN). */
export const difficultyStars = (level: number): string =>
  '⭐'.repeat(Math.min(5, Math.max(0, level)))

/** The word of a Kesukaran (OPT-KESUKARAN). */
export const difficultyWord = (level: number): string =>
  ['', 'Sangat Mudah', 'Mudah', 'Sederhana', 'Sukar', 'Sangat Sukar'][level] ?? ''

/** Kesukaran pre-filled from a chosen TP until the teacher touches it: min(5, TP) (44-F1). */
export const difficultyFromTp = (tp: number): number => Math.min(5, tp)

/** FR-GUR-44-10: the status words shown to the teacher. */
export const STATUS_WORDS: Readonly<Record<QuestionStatus, string>> = {
  pending: 'Menunggu Semakan',
  approved: 'Diluluskan',
  rejected: 'Ditolak',
}

/** The `DsStatusBadge` status (icon and colour) of each word: Ditolak is the error tone. */
export const STATUS_BADGE: Readonly<Record<QuestionStatus, DsStatus>> = {
  pending: 'awaiting-review',
  approved: 'approved',
  rejected: 'rejected',
}

/** "Sebab: {reason}" of a rejected item. */
export const rejectionLine = (reason: string): string => `Sebab: ${reason}`

export const SCRIPTS: readonly { value: ScriptType; label: string }[] = [
  { value: 'rumi', label: 'Rumi (Latin)' },
  { value: 'arab', label: 'Arab' },
  { value: 'jawi', label: 'Jawi' },
  { value: 'mixed', label: 'Campuran (Rumi + Arab/Jawi)' },
]

export const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const

/** `URadioGroup` items of the MCQ "Jawapan betul" group; the group `id` gives each radio the id `<id>:<index>`. */
export const correctItems = () => OPTION_LETTERS.map((letter, i) => ({ label: letter, value: i }))

/** `arab` / `jawi` write right to left; `mixed` stays left to right (R-M04-07). */
export const isRtlScript = (script: ScriptType): boolean => script === 'arab' || script === 'jawi'

/** "{nombor}. {nama}" in chapter-number order (44-F1; name alone without a number). */
export const chapterLabel = (c: { chapterNumber: number | null; name: string }): string =>
  c.chapterNumber === null ? c.name : `${String(c.chapterNumber)}. ${c.name}`

/** "{kod} {nama}" of an SP option (44-F1). */
export const spLabel = (sp: { code: string; description: string }): string =>
  `${sp.code} ${sp.description}`

/** "{x.xx} MB" of FN-M10-7.1.11. */
export const megabytes = (bytes: number): string => `${(bytes / (1024 * 1024)).toFixed(2)} MB`

/** The extension icon family of the Hantar Kertas file list. */
export function fileKind(name: string): 'pdf' | 'word' | 'excel' | 'file' {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'doc' || ext === 'docx') return 'word'
  if (ext === 'xls' || ext === 'xlsx') return 'excel'
  return 'file'
}
