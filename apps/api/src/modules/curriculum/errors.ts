import { CURRICULUM_NOT_FOUND_MESSAGES as NF } from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'
import { uniqueMessage } from './validation'

/** 404 with the exact BR-18 flash copy. */
export const notFound = (message: string): ApiError => ApiError.of('NOT_FOUND', { message })

export const chapterNotFound = (): ApiError => notFound(NF.chapter)
export const topicNotFound = (): ApiError => notFound(NF.topic)
export const subtopicNotFound = (): ApiError => notFound(NF.subtopic)
export const subjectNotFound = (): ApiError => notFound(NF.subject)
export const levelNotFound = (): ApiError => notFound(NF.level)

/** A concurrent insert lost the race on a unique code: report it like the pre-check does. */
export function uniqueViolationAs422(e: unknown, field: string): never {
  if (typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'P2002') {
    throw ApiError.of('VALIDATION_ERROR', { fields: { [field]: uniqueMessage(field) } })
  }
  throw e
}
