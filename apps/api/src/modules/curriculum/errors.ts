import { CURRICULUM_NOT_FOUND_MESSAGES as NF } from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'
import { existsMessage, uniqueMessage } from './validation'

/** 404 with the exact BR-18 flash copy. */
export const notFound = (message: string): ApiError => ApiError.of('NOT_FOUND', { message })

export const chapterNotFound = (): ApiError => notFound(NF.chapter)
export const topicNotFound = (): ApiError => notFound(NF.topic)
export const subtopicNotFound = (): ApiError => notFound(NF.subtopic)
export const subjectNotFound = (): ApiError => notFound(NF.subject)
export const levelNotFound = (): ApiError => notFound(NF.level)

export interface DbErrorMap {
  /** The 404 for a row that vanished between the check and the write (Prisma P2025). */
  notFound?: () => ApiError
  /** The body field to blame when a referenced row vanished (Prisma P2003). */
  fkField?: string | ((e: unknown) => string)
  /** The body field to blame when a concurrent insert took the code (Prisma P2002). */
  uniqueField?: string
}

const codeOf = (e: unknown): string | undefined =>
  typeof e === 'object' && e !== null && typeof (e as { code?: unknown }).code === 'string' ? (e as { code: string }).code : undefined

/**
 * Check-then-write races: the pre-checks (404, unique, exists) can pass and the row still changes
 * before the write. P2025 (record to update or delete not found) becomes the card's 404 copy,
 * P2003 (foreign key) the "selected ... is invalid" 422 on the referencing field, P2002 (unique)
 * the "has already been taken" 422. Anything else is rethrown untouched (a real 500).
 */
export function translateDbError(e: unknown, map: DbErrorMap): never {
  const code = codeOf(e)
  if (code === 'P2025' && map.notFound) throw map.notFound()
  if (code === 'P2003' && map.fkField) {
    const field = typeof map.fkField === 'function' ? map.fkField(e) : map.fkField
    throw ApiError.of('VALIDATION_ERROR', { fields: { [field]: existsMessage(field) } })
  }
  if (code === 'P2002' && map.uniqueField) throw ApiError.of('VALIDATION_ERROR', { fields: { [map.uniqueField]: uniqueMessage(map.uniqueField) } })
  throw e
}
