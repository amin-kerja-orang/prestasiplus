/**
 * Client rules of the paper form 44-F4 "Hantar Kertas Soalan kepada Admin" (FR-GUR-44-13). Pure, so the server and the
 * client say the same texts. Any invalid file rejects the whole submission (nothing is sent).
 */
import type { PaperType } from '../../api/types'

/** OPT-JENIS-HANTARAN: label shown, slug stored (`lain` is the select only; the six chips omit it). */
export const PAPER_TYPES: readonly { value: PaperType; label: string }[] = [
  { value: 'umum', label: 'Soalan Umum' },
  { value: 'trial', label: 'Trial Paper' },
  { value: 'dskp', label: 'Soalan DSKP' },
  { value: 'buku_teks', label: 'Buku Teks' },
  { value: 'buku_latihan', label: 'Buku Latihan' },
  { value: 'peperiksaan', label: 'Soalan Peperiksaan' },
  { value: 'lain', label: 'Lain-lain' },
]

export const PAPER_LIMITS = {
  files: 5,
  fileMb: 20,
  subject: 100,
  preparedBy: 150,
  note: 1000,
} as const

/** The 44-F4 texts (ERR-REQ-04 with "PDF, DOCX, XLSX", ERR-REQ-05 with 20, ERR-REQ-07, the teacher text of ERR-QUOTA-03). */
export const PAPER_MESSAGES = {
  type: 'Sila pilih jenis soalan.',
  subject: 'Sila isi matapelajaran.',
  subjectLong: 'Matapelajaran tidak boleh melebihi 100 aksara.',
  year: 'Tahun mesti antara 2000 dan 2099.',
  preparedBy: 'Disediakan oleh tidak boleh melebihi 150 aksara.',
  note: 'Catatan tambahan tidak boleh melebihi 1000 aksara.',
  confirm: 'Sila sahkan skema jawapan disertakan.',
  noFile: 'Sila pilih fail.',
  tooMany: 'Maksimum 5 fail, saiz maksimum 20MB setiap fail',
  fileType: 'Jenis fail tidak disokong. Format dibenarkan: PDF, DOCX, XLSX.',
  fileSize: 'Fail melebihi saiz maksimum 20 MB.',
} as const

const PAPER_FILE = /\.(pdf|docx|xlsx)$/i

/** The one error of a picked file list (`null` = valid): none, more than 5, a wrong type, a file over 20 MB. */
export function validatePaperFiles(
  files: readonly { name: string; size: number }[],
): string | null {
  if (files.length === 0) return PAPER_MESSAGES.noFile
  if (files.length > PAPER_LIMITS.files) return PAPER_MESSAGES.tooMany
  if (files.some((f) => !PAPER_FILE.test(f.name))) return PAPER_MESSAGES.fileType
  if (files.some((f) => f.size > PAPER_LIMITS.fileMb * 1024 * 1024)) return PAPER_MESSAGES.fileSize
  return null
}

export interface PaperFormValues {
  paperType: string
  subject: string
  year: string
  preparedBy: string
  note: string
  confirmed: boolean
  files: readonly { name: string; size: number }[]
}

export type PaperField =
  'paperType' | 'subject' | 'year' | 'preparedBy' | 'note' | 'answerSchemeConfirmed' | 'files'

const len = (text: string): number => [...text].length

/** Field errors of the whole form (`{}` = valid), in the texts of 44-F4. */
export function validatePaper(v: PaperFormValues): Partial<Record<PaperField, string>> {
  const e: Partial<Record<PaperField, string>> = {}
  if (!PAPER_TYPES.some((t) => t.value === v.paperType)) e.paperType = PAPER_MESSAGES.type
  const subject = v.subject.trim()
  if (subject === '') e.subject = PAPER_MESSAGES.subject
  else if (len(subject) > PAPER_LIMITS.subject) e.subject = PAPER_MESSAGES.subjectLong
  if (v.year.trim() !== '') {
    const n = Number(v.year)
    if (!Number.isInteger(n) || n < 2000 || n > 2099) e.year = PAPER_MESSAGES.year
  }
  if (len(v.preparedBy.trim()) > PAPER_LIMITS.preparedBy) e.preparedBy = PAPER_MESSAGES.preparedBy
  if (len(v.note.trim()) > PAPER_LIMITS.note) e.note = PAPER_MESSAGES.note
  const fileError = validatePaperFiles(v.files)
  if (fileError) e.files = fileError
  if (!v.confirmed) e.answerSchemeConfirmed = PAPER_MESSAGES.confirm
  return e
}
