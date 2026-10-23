import { V } from '@pp/contract'
import { z } from 'zod'

import { ApiError } from '../../../common/errors/api-error'
import { notAllowed, setFieldOnce, unknownKeysOf } from '../../../common/validation/strict-body'
import { isIdString } from '../../../db/ids'

/**
 * Body validation of the teacher and pupil writes (pure; no DB). The contract schemas carry no Laravel text, so the rules are
 * applied here and the messages are the contract's English ones (`V`). Only the fields below are ever read from the body:
 * every other key (`role`, `schoolId`, `isActive`, `grade`, `icNumber`, `password`, ...) is ignored, never bound (the
 * mass-assignment waiver of BE-NFR-05). Exception: the teacher create body is STRICT (BE-33 AC1c, #97, LEAD decision
 * 22 Oct): there an unknown key is a 422 naming it.
 */

export const NAME_MAX = 255
export const PUPIL_NAME_MIN = 3
export const EMAIL_MAX = 255
export const PHONE_MAX = 14
/** Password bounds of every admin-typed password (contract `password8`). */
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 255

export type Fields = Record<string, string>

const MORE = (n: number): string => `(and ${String(n)} more error${n === 1 ? '' : 's'})`

/** 422 with `fields`; the message is the first field message plus " (and N more error(s))" like Laravel. */
export function invalidFields(fields: Fields): ApiError {
  const messages = Object.values(fields)
  const first = messages[0] ?? V.required('name')
  const more = messages.length - 1
  return ApiError.of('VALIDATION_ERROR', { fields, message: more > 0 ? `${first} ${MORE(more)}` : first })
}

const bodyOf = (raw: unknown): Record<string, unknown> => (typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {})
const isBlank = (v: unknown): boolean => v === undefined || v === null || (typeof v === 'string' && v.trim() === '')
const EMAIL = z.email()

function requiredText(fields: Fields, key: string, label: string, raw: unknown, max: number, min = 0): string | null {
  if (isBlank(raw)) {
    fields[key] = V.required(label)
    return null
  }
  if (typeof raw !== 'string') {
    fields[key] = V.string(label)
    return null
  }
  const value = raw.trim()
  const length = [...value].length
  if (length > max) fields[key] = V.max(label, max)
  else if (length < min) fields[key] = V.min(label, min)
  else return value
  return null
}

function emailField(fields: Fields, raw: unknown): string | null {
  const value = requiredText(fields, 'email', 'email', raw, EMAIL_MAX)
  if (value === null) return null
  if (!EMAIL.safeParse(value).success) {
    fields.email = V.email('email')
    return null
  }
  return value
}

/** Optional phone: absent keeps (`undefined`), blank or null clears (`null`). */
function phoneField(fields: Fields, raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined
  if (isBlank(raw)) return null
  if (typeof raw !== 'string') {
    fields.phone = V.string('phone')
    return undefined
  }
  const value = raw.trim()
  if ([...value].length > PHONE_MAX) {
    fields.phone = V.max('phone', PHONE_MAX)
    return undefined
  }
  return value
}

export interface TeacherCreateInput {
  name: string
  email: string
  phone: string | null
}

export interface PupilCreateInput {
  name: string
  email: string
  /** Decimal id as typed; the service checks it is an active classroom of the school. `null` = no class. */
  classId: string | null
}

export interface UserUpdateInput {
  name: string
  email: string
  /** `undefined` keeps the stored phone, `null` clears it. */
  phone?: string | null
  /** The admin-typed password to set, or absent. */
  newPassword?: string
}

/** The keys of `SchoolAdminTeacherCreateRequestSchema`; any other key of the create body is refused (#97). */
const TEACHER_CREATE_KEYS = ['name', 'email', 'phone'] as const

export function parseTeacherCreate(raw: unknown): { value: TeacherCreateInput | null; fields: Fields } {
  const body = bodyOf(raw)
  const fields: Fields = {}
  const name = requiredText(fields, 'name', 'name', body.name, NAME_MAX)
  const email = emailField(fields, body.email)
  const phone = phoneField(fields, body.phone)
  for (const key of unknownKeysOf(body, TEACHER_CREATE_KEYS)) setFieldOnce(fields, key, notAllowed(key))
  if (Object.keys(fields).length > 0 || name === null || email === null) return { value: null, fields }
  return { value: { name, email, phone: phone ?? null }, fields }
}

export function parsePupilCreate(raw: unknown): { value: PupilCreateInput | null; fields: Fields } {
  const body = bodyOf(raw)
  const fields: Fields = {}
  const name = requiredText(fields, 'name', 'name', body.name, NAME_MAX, PUPIL_NAME_MIN)
  const email = emailField(fields, body.email)
  let classId: string | null = null
  if (!isBlank(body.classId)) {
    if (typeof body.classId === 'string' && isIdString(body.classId.trim())) classId = body.classId.trim()
    else fields.classId = V.invalid('class id')
  }
  if (Object.keys(fields).length > 0 || name === null || email === null) return { value: null, fields }
  return { value: { name, email, classId }, fields }
}

/** The new-password pair. `required` is true for the reset route; on an update an absent password means "keep". */
function passwordPair(fields: Fields, body: Record<string, unknown>, required: boolean): string | undefined {
  const raw = body.newPassword
  if (raw === undefined || raw === null || raw === '') {
    if (required) fields.newPassword = V.required('new password')
    return undefined
  }
  if (typeof raw !== 'string') {
    fields.newPassword = V.string('new password')
    return undefined
  }
  if (raw.length < PASSWORD_MIN) fields.newPassword = V.min('new password', PASSWORD_MIN)
  else if (raw.length > PASSWORD_MAX) fields.newPassword = V.max('new password', PASSWORD_MAX)
  else if (body.newPasswordConfirmation !== raw) fields.newPassword = V.confirmed('new password')
  else return raw
  return undefined
}

export function parseUserUpdate(raw: unknown): { value: UserUpdateInput | null; fields: Fields } {
  const body = bodyOf(raw)
  const fields: Fields = {}
  const name = requiredText(fields, 'name', 'name', body.name, NAME_MAX)
  const email = emailField(fields, body.email)
  const phone = phoneField(fields, body.phone)
  const newPassword = passwordPair(fields, body, false)
  if (Object.keys(fields).length > 0 || name === null || email === null) return { value: null, fields }
  return { value: { name, email, ...(phone !== undefined ? { phone } : {}), ...(newPassword !== undefined ? { newPassword } : {}) }, fields }
}

export function parseReset(raw: unknown): { value: string | null; fields: Fields } {
  const fields: Fields = {}
  const password = passwordPair(fields, bodyOf(raw), true)
  return { value: password ?? null, fields }
}
