import { LAST_ADMIN_MESSAGE, V } from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'

export const notFound = (): ApiError => ApiError.of('NOT_FOUND')
export const forbidden = (message?: string): ApiError => ApiError.of('FORBIDDEN', message ? { message } : {})

/** 422 with `fields`; the message of the response is the first field message, like the mock. */
export function invalid(fields: Record<string, string>): ApiError {
  const first = Object.values(fields)[0]
  return ApiError.of('VALIDATION_ERROR', { fields, ...(first ? { message: first } : {}) })
}

/** 409 of a change that would leave no active admin (D58, message pinned by the contract). */
export const lastAdmin = (): ApiError => ApiError.of('CONFLICT', { message: LAST_ADMIN_MESSAGE })

export const FIELD_MESSAGES = {
  emailTaken: V.taken('email'),
  usernameTaken: V.taken('username'),
  schoolInvalid: V.invalid('school id'),
  ppdStateInvalid: V.invalid('ppd state'),
  ppdDistrictInvalid: V.invalid('ppd district'),
  linkedInvalid: V.invalid('linked student ids'),
  icFormat: 'The ic number field format is invalid.',
  gradeRequired: V.requiredWhen('grade', 'role is student'),
  schoolRequired: V.requiredWhen('school id', 'role is school_admin'),
  emailRequired: V.required('email'),
  ppdStateRequired: V.required('ppd state'),
  ppdDistrictRequired: V.requiredWhen('ppd district', 'role is ppd_officer'),
  idsInteger: 'The ids field must be an array of integers.',
  idsTooMany: (max: number): string => `The ids field must not have more than ${String(max)} items.`,
} as const
