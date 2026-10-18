/**
 * Small stand-in for the loaded DSKP (the real list comes from M03 curriculum later). Unit codes
 * here are prototype codes, not official ones. Controlled list: free text is not accepted (AC-05.2).
 */
import type { CurriculumTag, SubjectCode } from '../../../domain/types'

export interface DskpUnit {
  code: string
  label: string
  subject: SubjectCode
  form: 'T4' | 'T5'
  /** Lower-case words that suggest this unit in extracted text. */
  keywords: string[]
}

export const DSKP_UNITS: DskpUnit[] = [
  { code: 'MAT-T4-02', label: 'Asas Nombor', subject: 'MAT', form: 'T4', keywords: ['bentuk piawai', 'asas nombor'] },
  { code: 'MAT-T4-03', label: 'Fungsi dan Persamaan Kuadratik', subject: 'MAT', form: 'T4', keywords: ['kuadratik', 'fungsi'] },
  { code: 'MAT-T4-06', label: 'Gerakan dan Kecerunan', subject: 'MAT', form: 'T4', keywords: ['kecerunan', 'garis lurus'] },
  { code: 'MAT-T4-08', label: 'Teorem Pythagoras dan Trigonometri', subject: 'MAT', form: 'T4', keywords: ['pythagoras', 'sin ', 'kos ', 'tan '] },
  { code: 'MAT-T4-09', label: 'Statistik', subject: 'MAT', form: 'T4', keywords: ['min', 'median', 'mod', 'carta'] },
  { code: 'MAT-T5-01', label: 'Kebarangkalian', subject: 'MAT', form: 'T5', keywords: ['kebarangkalian', 'peristiwa'] },
  { code: 'MAT-T5-02', label: 'Ungkapan dan Persamaan Linear', subject: 'MAT', form: 'T5', keywords: ['persamaan', 'ungkapan', 'selesaikan'] },
  { code: 'SN-T4-02', label: 'Sel dan Organisasi Sel', subject: 'SN', form: 'T4', keywords: ['sel', 'organel'] },
  { code: 'SN-T4-05', label: 'Daya dan Gerakan', subject: 'SN', form: 'T4', keywords: ['laju', 'daya', 'halaju'] },
  { code: 'SN-T5-03', label: 'Elektrik', subject: 'SN', form: 'T5', keywords: ['litar', 'arus', 'voltan'] },
  { code: 'SEJ-T4-04', label: 'Kebangkitan Nasionalisme', subject: 'SEJ', form: 'T4', keywords: ['nasionalisme', 'kebangkitan'] },
  { code: 'SEJ-T5-02', label: 'Kemerdekaan Tanah Melayu', subject: 'SEJ', form: 'T5', keywords: ['merdeka', 'kemerdekaan'] },
]

export function unitsFor(subject: SubjectCode): DskpUnit[] {
  return DSKP_UNITS.filter((u) => u.subject === subject)
}

export function unitByCode(code: string | null): DskpUnit | undefined {
  return code ? DSKP_UNITS.find((u) => u.code === code) : undefined
}

export function guessUnit(subject: SubjectCode, text: string): DskpUnit | undefined {
  const t = text.toLowerCase()
  return unitsFor(subject).find((u) => u.keywords.some((k) => t.includes(k)))
}

export function emptyTag(subject: SubjectCode): CurriculumTag {
  return { subject, level: 'T4+T5', unit: null, unitLabel: '', sp: [], tp: 3, formOrigin: 'T4' }
}

export function tagWithUnit(tag: CurriculumTag, unit: DskpUnit | undefined): CurriculumTag {
  if (!unit) return { ...tag, unit: null, unitLabel: '' }
  return { ...tag, unit: unit.code, unitLabel: unit.label, level: unit.form, formOrigin: unit.form }
}
