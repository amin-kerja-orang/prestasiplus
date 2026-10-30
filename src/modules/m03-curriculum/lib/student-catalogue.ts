import type { LocationQueryValue } from 'vue-router'

/** M03-T4 constants and helpers for S12 Topik, S13 detail and S14 Peta Belajar (SRS §2, FR-M03-69..90). */
export const TOPICS_PATH = '/topics'
export const MAP_PATH = '/peta-belajar'

export const STUDENT_ROUTES = {
  topics: 'm03.topics',
  topic: 'm03.topic',
  map: 'm03.peta-belajar',
} as const

export const TOPIC_TAB_TITLE = 'Topik - PRESTASIPLUS'
export const EMPTY_TOPICS = 'Tiada topik tersedia buat masa ini.'
/** Placeholder (SRS §8, no live equivalent). */
export const LOAD_ERROR = 'Ralat memuatkan data. Sila cuba semula.'

/** Secondary-school scope (D54): the only grade levels S12/S14 serve. */
export const SCOPE_GRADES = ['TINGKATAN_4', 'TINGKATAN_5'] as const
export type ScopeGrade = (typeof SCOPE_GRADES)[number]
export const DEFAULT_GRADE: ScopeGrade = 'TINGKATAN_4'
/** `grade_level` value of the "Semua Tingkatan" chip (T4 + T5). A bare URL means the student's form. */
export const ALL_GRADES = 'SEMUA'

/** `Tingkatan 4` for `TINGKATAN_4`. */
export function gradeLabel(code: string): string {
  return `Tingkatan ${code.replace('TINGKATAN_', '')}`
}

/**
 * FR-M03-70 (D54, supersedes DV-M03-02): "Semua Tingkatan" + Tingkatan 4 + Tingkatan 5. No Darjah
 * chips: the new system serves secondary school and SPM only.
 */
export const GRADE_CHIPS: readonly { code: string; label: string }[] = [
  { code: ALL_GRADES, label: 'Semua Tingkatan' },
  ...SCOPE_GRADES.map((code) => ({ code, label: gradeLabel(code) })),
]

/** The student's form (`UserMe.grade`: 10 = Tingkatan 4, 11 = Tingkatan 5), else Tingkatan 4. */
export function formGrade(grade: number | null | undefined): ScopeGrade {
  return grade === 11 ? 'TINGKATAN_5' : DEFAULT_GRADE
}

const isScope = (code: string | null): code is ScopeGrade =>
  code !== null && (SCOPE_GRADES as readonly string[]).includes(code)

/**
 * The grade S12 shows for the `grade_level` query value: `SEMUA` (all), Tingkatan 4 or 5, else the
 * student's form (absent or out-of-scope values, e.g. an old Darjah link).
 */
export function effectiveTopicGrade(raw: string | null, grade: number | null | undefined): string {
  const code = raw?.toUpperCase() ?? null
  if (code === ALL_GRADES) return ALL_GRADES
  return isScope(code) ? code : formGrade(grade)
}

/** The grade S14 asks for: Tingkatan 4 or 5 from the query, else the student's form. */
export function effectiveMapGrade(raw: string | null, grade: number | null | undefined): string {
  const code = raw?.toUpperCase() ?? null
  return isScope(code) ? code : formGrade(grade)
}

/** FR-M03-71: the live subject chips (no GEOGRAFI). */
export const SUBJECT_CHIPS: readonly { code: string | null; label: string }[] = [
  { code: null, label: 'Semua Subjek' },
  ...[
    'MATEMATIK',
    'BAHASA_MELAYU',
    'BAHASA_INGGERIS',
    'SAINS',
    'PENDIDIKAN_ISLAM',
    'PENDIDIKAN_MORAL',
    'SEJARAH',
  ].map((code) => ({ code, label: code.replaceAll('_', ' ') })),
]

type Raw = LocationQueryValue | LocationQueryValue[] | undefined

/** A filter value from the query: the first value, `null` when absent or empty. */
export function readFilter(value: Raw): string | null {
  const first = Array.isArray(value) ? value[0] : value
  return first === undefined || first === null || first === '' ? null : first
}

/** S12 chip target: keeps the other filter (FR-M03-70/71). */
export function topicsTo(gradeLevel: string, subject: string | null) {
  const query: Record<string, string> = { grade_level: gradeLevel }
  if (subject !== null) query.subject = subject
  return { path: TOPICS_PATH, query }
}

export function topicPath(id: number): string {
  return `${TOPICS_PATH}/${String(id)}`
}

/** "+{n-3} lagi..." (FR-M03-73). */
export function moreSubtopics(count: number, shown: number): string | null {
  return count > shown ? `+${String(count - shown)} lagi...` : null
}

/** S14 grade chips (FR-M03-83, D54): Tingkatan 4 and 5. */
export const MAP_GRADES = SCOPE_GRADES

/** S14 selector target (FR-M03-82/83): both parameters always carried. */
export function mapTo(subject: string, grade: string) {
  return { path: MAP_PATH, query: { subject, grade } }
}

export const ISLAND_LABEL: Record<string, string> = {
  mastered: '⭐ DIKUASAI',
  started: '📘 SEDANG BELAJAR',
  unlocked: '🎯 BUKA',
  locked: '🔒 TERKUNCI',
}

export function practiceHref(id: number): string {
  return `/practice?topic_id=${String(id)}`
}

/** Dot position along the path: 0 % ... 100 % (FR-M03-85). */
export function dotTop(index: number, total: number): string {
  return total <= 1 ? '0%' : `${String((index / (total - 1)) * 100)}%`
}

export function sessionsLine(sessions: number, questions: number): string {
  return `${String(sessions)} sesi · ${String(questions)} soalan dijawab`
}
