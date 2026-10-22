import type { AiCurriculumTag, AiTaxonomyUnit } from '@pp/contract'

/**
 * Prototype stand-in for the loaded DSKP (`admin/intake/lib/dskp.ts` at 9af43134): fictional unit codes and the
 * lower-case words that make the mock guess a unit. Used only by the mock provider, and only when the request carries no
 * taxonomy. The real curriculum (M03) reaches providers through the request's `taxonomy`.
 */
export interface MockUnit {
  code: string
  label: string
  subject: string
  form: 'T4' | 'T5'
  keywords: string[]
}

export const MOCK_UNITS: readonly MockUnit[] = [
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

export interface GuessUnit {
  code: string
  label: string
  form: 'T4' | 'T5' | undefined
  keywords: string[]
}

/** Words that suggest a taxonomy unit: the prototype keywords for a known code, else the label and its longer words. */
function keywordsFor(u: AiTaxonomyUnit): string[] {
  const known = MOCK_UNITS.find((m) => m.code === u.code)
  if (known) return known.keywords
  const label = u.label.toLowerCase()
  return [label, ...label.split(/\s+/).filter((w) => w.length >= 5)]
}

/** Candidate units for a request: its taxonomy when present, else the prototype units of the subject. */
export function candidateUnits(subject: string, taxonomy: readonly AiTaxonomyUnit[] | undefined): GuessUnit[] {
  if (taxonomy && taxonomy.length > 0) return taxonomy.map((u) => ({ code: u.code, label: u.label, form: u.form, keywords: keywordsFor(u) }))
  return MOCK_UNITS.filter((u) => u.subject === subject).map((u) => ({ code: u.code, label: u.label, form: u.form, keywords: u.keywords }))
}

export function guessUnit(units: readonly GuessUnit[], text: string): GuessUnit | undefined {
  const t = text.toLowerCase()
  return units.find((u) => u.keywords.some((k) => t.includes(k)))
}

export function emptyTag(subject: string): AiCurriculumTag {
  return { subject, level: 'T4+T5', unit: null, unitLabel: '', sp: [], tp: 3, formOrigin: 'T4' }
}

export function tagWithUnit(tag: AiCurriculumTag, unit: GuessUnit | undefined): AiCurriculumTag {
  if (!unit) return { ...tag, unit: null, unitLabel: '' }
  return {
    ...tag,
    unit: unit.code,
    unitLabel: unit.label,
    ...(unit.form ? { level: unit.form, formOrigin: unit.form } : {}),
  }
}
