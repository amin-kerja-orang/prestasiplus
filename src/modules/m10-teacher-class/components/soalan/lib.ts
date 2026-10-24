/**
 * Shared copy, option lists and pure helpers of S21–S24 (M10-T6; FN-M10-7.1–7.4). Copy is the live
 * BM text of URS §7; flashes and server messages are UNVERIFIED COPY (SRS §8.3).
 */
import type { QuestionType, ScriptType } from '../../api/types'

/**
 * Texts that are not the live copy. Every entry except `confirmDelete` is UNVERIFIED COPY (SRS §8.3):
 * the live pages redirect with flashes that were never observed, or show nothing.
 */
export const COPY = {
  /** Live (FR-M10-97). */
  confirmDelete: (id: number): string =>
    `Padam soalan #${String(id)}? Tindakan ini tidak boleh dibatalkan.`,
  // UNVERIFIED COPY
  loadFailed: 'Gagal memuatkan data. Sila cuba lagi.',
  retry: 'Cuba Semula',
  deleted: 'Soalan berjaya dipadam.',
  created: 'Soalan berjaya dihantar untuk semakan.',
  updated: 'Soalan berjaya dikemas kini.',
  saveFailed: 'Gagal menyimpan soalan. Sila cuba lagi.',
  importDone: (n: number): string => `${String(n)} soalan berjaya diimport.`,
  templateFailed: 'Gagal memuat turun templat.',
  listEmpty: 'Belum ada soalan.',
  paperSent: 'Kertas soalan berjaya dihantar kepada admin.',
  paperFailed: 'Gagal menghantar kertas soalan.',
} as const

export const QUESTION_TYPES: readonly { value: QuestionType; label: string }[] = [
  { value: 'mcq', label: 'Aneka Pilihan (MCQ)' },
  { value: 'true_false', label: 'Betul / Salah' },
  { value: 'short_answer', label: 'Jawapan Pendek' },
  { value: 'fill_blank', label: 'Isi Tempat Kosong' },
  { value: 'essay', label: 'Esei' },
]

/** S22 difficulty (BR-M10-22): the three live options. */
export const DIFFICULTIES = [
  { value: 'easy', label: 'Mudah' },
  { value: 'medium', label: 'Sederhana' },
  { value: 'hard', label: 'Sukar' },
] as const

/** S24 options (DV-M10-15): M04 difficulty 2 / 3 / 4. */
export const EDIT_DIFFICULTIES = [
  { value: 2, label: 'Mudah' },
  { value: 3, label: 'Sederhana' },
  { value: 4, label: 'Sukar' },
] as const

export const SCRIPTS: readonly { value: ScriptType; label: string }[] = [
  { value: 'rumi', label: 'Rumi (Latin)' },
  { value: 'arab', label: 'Arab' },
  { value: 'jawi', label: 'Jawi' },
  { value: 'mixed', label: 'Campuran (Rumi + Arab/Jawi)' },
]

export const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const

/** `URadioGroup` items of the MCQ "Jawapan betul" group; the group `id` gives each radio the id `<id>:<index>`. */
export const correctItems = () => OPTION_LETTERS.map((letter, i) => ({ label: letter, value: i }))

/** `URadioGroup` items of the true / false answer. */
export const TF_ITEMS = [
  { label: 'Betul', value: 'true' },
  { label: 'Salah', value: 'false' },
]

/** `arab` / `jawi` write right to left; `mixed` stays left to right (R-M04-07). */
export const isRtlScript = (script: ScriptType): boolean => script === 'arab' || script === 'jawi'

/** "Bab {n}: {name}" in chapter-number order (FN-M10-11.1.1). */
export const chapterLabel = (c: { chapterNumber: number | null; name: string }): string =>
  c.chapterNumber === null ? c.name : `Bab ${String(c.chapterNumber)}: ${c.name}`

/** "{code} — {name}" (name alone when the code is empty). */
export const bidangLabel = (b: { code: string | null; name: string }): string =>
  b.code ? `${b.code} — ${b.name}` : b.name

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

/** A stored `blob:mock/...` image cannot load (D22): show nothing instead of a broken image. */
export const isLoadableImage = (value: string | null): value is string =>
  value !== null && value !== '' && !value.startsWith('blob:mock/')

/** A field of an inline add panel (AddRow). */
export interface PanelField {
  key: string
  placeholder: string
  type?: 'text' | 'number'
  min?: number
  max?: number
  /** Narrow field (the code / number input). */
  narrow?: boolean
}

export interface SelectOption {
  value: string
  label: string
}
