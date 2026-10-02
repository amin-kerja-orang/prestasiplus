import type { RouteLocationRaw } from 'vue-router'

import { isApiError } from '@/api'

/** M03-T3 route names and paths (S1-S5). Page URLs keep the live query names (SRS §2). */
export const CURRICULUM_PATH = '/admin/curriculum'

export const CURRICULUM_ROUTES = {
  tree: 'm03.admin.curriculum',
  chapterCreate: 'm03.admin.curriculum.chapter-create',
  chapterEdit: 'm03.admin.curriculum.chapter-edit',
  topicCreate: 'm03.admin.curriculum.topic-create',
  topicEdit: 'm03.admin.curriculum.topic-edit',
} as const

type Id = string | number | null | undefined

/** S1 for a pair; only the given (non-empty) parameters are carried (FR-M03-25). */
export function treeTo(subjectId?: Id, levelId?: Id): RouteLocationRaw {
  const query: Record<string, string> = {}
  if (subjectId !== null && subjectId !== undefined && String(subjectId) !== '') {
    query.subject_id = String(subjectId)
  }
  if (levelId !== null && levelId !== undefined && String(levelId) !== '') {
    query.education_level_id = String(levelId)
  }
  return { path: CURRICULUM_PATH, query }
}

/** S2 for a pair (FR-M03-06, FR-M03-07). */
export function chapterCreateTo(subjectId: Id, levelId: Id): RouteLocationRaw {
  return {
    path: `${CURRICULUM_PATH}/chapters/create`,
    query: { subject_id: String(subjectId ?? ''), education_level_id: String(levelId ?? '') },
  }
}

export function chapterEditTo(id: number): RouteLocationRaw {
  return { path: `${CURRICULUM_PATH}/chapters/${String(id)}/edit` }
}

export function topicCreateTo(chapterId: number): RouteLocationRaw {
  return { path: `${CURRICULUM_PATH}/topics/create`, query: { chapter_id: String(chapterId) } }
}

export function topicEditTo(id: number): RouteLocationRaw {
  return { path: `${CURRICULUM_PATH}/topics/${String(id)}/edit` }
}

/** "Bab {n}: {name}" (null number prints empty, as the live template: "Bab : {name}", Q3). */
export function chapterHeading(c: { chapterNumber: number | null; name: string | null }): string {
  return `Bab ${c.chapterNumber === null ? '' : String(c.chapterNumber)}: ${c.name ?? ''}`
}

/** "Topik {n}: {name}". */
export function topicHeading(t: { topicNumber: string | null; name: string }): string {
  return `Topik ${t.topicNumber ?? ''}: ${t.name}`
}

/** Shown when the request produced no usable message. INFERRED copy (as M02). */
export const GENERIC_ERROR = 'Ralat berlaku. Sila cuba lagi.'

/** SRS §8 placeholder for a failed page load. */
export const LOAD_ERROR = 'Ralat memuatkan data. Sila cuba semula.'

/** Red-alert lines of a failed call: one per field message (FR-M03-27), else the message. */
export function errorLines(err: unknown): string[] {
  if (!isApiError(err)) return [GENERIC_ERROR]
  if (err.status === 0 || err.code === 'NETWORK_ERROR') return [GENERIC_ERROR]
  const fieldTexts = err.fields ? Object.values(err.fields) : []
  if (fieldTexts.length > 0) return [...new Set(fieldTexts)]
  if (err.message === '' || /^HTTP \d+$/.test(err.message)) return [GENERIC_ERROR]
  return [err.message]
}

export function isNotFound(err: unknown): boolean {
  return isApiError(err) && err.status === 404
}

/** Flash copy of the BR-18 redirects (exact live text). */
export const FLASH_CHAPTER_NOT_FOUND = 'Bab tidak dijumpai.'
export const FLASH_TOPIC_NOT_FOUND = 'Topik tidak dijumpai.'
export const FLASH_CHAPTER_ID_REQUIRED = 'Chapter ID diperlukan.'

/** A trimmed string or `null` (empty optional fields). */
export function orNull(value: string): string | null {
  return value === '' ? null : value
}
