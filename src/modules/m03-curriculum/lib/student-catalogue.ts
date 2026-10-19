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

/** FR-M03-70: "Semua Darjah" + Darjah 1-6 (no Tingkatan chips, DV-M03-02 withdrawn). */
export const GRADE_CHIPS: readonly { code: string | null; label: string }[] = [
  { code: null, label: 'Semua Darjah' },
  ...[1, 2, 3, 4, 5, 6].map((n) => ({ code: `DARJAH_${String(n)}`, label: `Darjah ${String(n)}` })),
]

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
export function topicsTo(gradeLevel: string | null, subject: string | null) {
  const query: Record<string, string> = {}
  if (gradeLevel !== null) query.grade_level = gradeLevel
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

/** S14 grade chips (FR-M03-83). */
export const MAP_GRADES = ['DARJAH_1', 'DARJAH_2', 'DARJAH_3', 'DARJAH_4'] as const

export function gradeLabel(code: string): string {
  return `Darjah ${code.replace('DARJAH_', '')}`
}

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
