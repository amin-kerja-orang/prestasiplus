/**
 * Request validation that mirrors the mock: the contract schemas give the shape errors (Laravel-style
 * copy, trimmed input), and the rules that need the database ("The selected :attribute is invalid.",
 * "The :attribute has already been taken.") are added to the SAME `fields` map, so one 422 reports
 * every failing field like the mock does.
 */
import { CURRICULUM_VALIDATION_MESSAGES as MESSAGES } from '@pp/contract'
import { Injectable, type PipeTransform } from '@nestjs/common'
import type { z } from 'zod'

import { ApiError } from '../../common/errors/api-error'
import { idFromString } from '../../db/ids'

/** Laravel `:attribute`: `educationLevelId` becomes "education level id". */
export function attributeName(field: string): string {
  return field
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .trim()
}

export const existsMessage = (field: string): string => MESSAGES.exists.replaceAll(':attribute', attributeName(field))
export const uniqueMessage = (field: string): string => MESSAGES.unique.replaceAll(':attribute', attributeName(field))
export const requiredMessage = (field: string): string => MESSAGES.required.replaceAll(':attribute', attributeName(field))
export const integerMessage = (field: string): string => MESSAGES.integer.replaceAll(':attribute', attributeName(field))

/** Query objects (GET) are read leniently: anything that is not a plain object is `{}`. */
export function asRecord(raw: unknown): Record<string, unknown> {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
}

// --- strict write bodies (BE-NFR-05) -------------------------------------------------------------
// New 422 copy. Laravel's own "prohibited" and "array max" templates are used where they exist;
// the body-shape sentence has no Laravel equivalent. All three are [PROPOSED] (not in the contract).
export const BODY_NOT_OBJECT_MESSAGE = 'The request body must be a JSON object.' // [PROPOSED]
export const prohibitedMessage = (field: string): string => `The ${attributeName(field)} field is prohibited.` // [PROPOSED]
export const maxItemsMessage = (field: string, n: number): string =>
  `The ${attributeName(field)} field must not have more than ${n} items.` // [PROPOSED]
export const maxCharsMessage = (field: string, n: number): string =>
  MESSAGES.maxString.replaceAll(':attribute', attributeName(field)).replaceAll(':n', String(n))

export const maxValueMessage = (field: string, n: number): string =>
  `The ${attributeName(field)} field must not be greater than ${n}.` // Laravel numeric `max`; new to this contract

/** Input bounds of this module (BE-NFR-25); the contract fields stay as merged. */
export const LIMITS = {
  /** `description`, `learningStandard`, `learningObjective`. */
  longText: 2000,
  /** Items of an id array (`educationLevelIds`). */
  idList: 50,
  /** A learner or tree query-string value. */
  queryValue: 64,
  /** Echoed length of an unknown key name in an error message. */
  keyEcho: 64,
  /** Unknown keys reported in one 422. */
  unknownKeysReported: 20,
} as const

/** The body of a write: `undefined` (no body) is `{}`; an array, null or a scalar is a 422. */
export function bodyRecord(raw: unknown): Record<string, unknown> {
  if (raw === undefined) return {}
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) return raw as Record<string, unknown>
  throw ApiError.of('VALIDATION_ERROR', { fields: { _: BODY_NOT_OBJECT_MESSAGE } })
}

/** A decimal bigint id or null (opaque ids that are not canonical decimals never exist). */
export function parseId(text: unknown): bigint | null {
  if (typeof text !== 'string') return null
  try {
    return idFromString(text)
  } catch {
    return null
  }
}

export interface RuleCheck {
  field: string
  /** Message when the check fails. */
  message: string
  /** Receives the already-parsed field value (never null or undefined). */
  ok(value: unknown): Promise<boolean> | boolean
}

/**
 * A `fields` map without a prototype: a client-chosen key such as `constructor` or `__proto__` must be
 * an ordinary own property, never an inherited member that `??=` would take for "already set".
 */
const newFields = (): Record<string, string> => Object.create(null) as Record<string, string>

/** First issue per path, like the shared `ZodValidationPipe`. */
function collectFields(error: z.ZodError): Record<string, string> {
  const fields = newFields()
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.map(String).join('.') : '_'
    fields[key] ??= issue.message
  }
  return fields
}

export interface BodyOptions {
  /** Keys accepted although they are not in the schema (the topic PUT `chapterId`, BR-07: ignored). */
  allow?: readonly string[]
  /** Longest parsed string per field. */
  maxLength?: Readonly<Record<string, number>>
  /** Longest parsed array per field. */
  maxItems?: Readonly<Record<string, number>>
  /** Largest parsed integer per field. */
  maxValue?: Readonly<Record<string, number>>
}

/**
 * Parses `raw` with `schema`, rejects keys the schema does not know (422 `prohibited`), applies the
 * module bounds, then runs the database rules on the fields that parsed. Everything lands in one
 * `fields` map, like the mock's single 422.
 */
export async function validateBody<S extends z.ZodObject>(
  schema: S,
  raw: unknown,
  checks: RuleCheck[] = [],
  options: BodyOptions = {},
): Promise<z.output<S>> {
  const body = bodyRecord(raw)
  const parsed = schema.safeParse(body)
  const fields = parsed.success ? newFields() : collectFields(parsed.error)
  const shape = schema.shape as Record<string, z.ZodType>

  const known = new Set([...Object.keys(shape), ...(options.allow ?? [])])
  let reported = 0
  for (const key of Object.keys(body)) {
    if (known.has(key) || reported >= LIMITS.unknownKeysReported) continue
    reported += 1
    const shown = key.length > LIMITS.keyEcho ? key.slice(0, LIMITS.keyEcho) : key
    fields[shown] ??= prohibitedMessage(shown)
  }

  const parsedValue = (field: string): unknown => {
    if (parsed.success) return (parsed.data as Record<string, unknown>)[field]
    const one = shape[field]?.safeParse(body[field])
    return one?.success ? one.data : undefined
  }
  for (const [field, max] of Object.entries(options.maxLength ?? {})) {
    const v = parsedValue(field)
    if (fields[field] === undefined && typeof v === 'string' && v.length > max) fields[field] = maxCharsMessage(field, max)
  }
  for (const [field, max] of Object.entries(options.maxValue ?? {})) {
    const v = parsedValue(field)
    if (fields[field] === undefined && typeof v === 'number' && v > max) fields[field] = maxValueMessage(field, max)
  }
  for (const [field, max] of Object.entries(options.maxItems ?? {})) {
    const v = parsedValue(field)
    if (fields[field] === undefined && Array.isArray(v) && v.length > max) fields[field] = maxItemsMessage(field, max)
  }

  for (const check of checks) {
    if (fields[check.field] !== undefined) continue
    const v = parsedValue(check.field)
    if (v === null || v === undefined) continue
    if (!(await check.ok(v))) fields[check.field] = check.message
  }
  if (Object.keys(fields).length > 0) throw ApiError.of('VALIDATION_ERROR', { fields })
  if (!parsed.success) throw ApiError.of('VALIDATION_ERROR', { fields: collectFields(parsed.error) })
  return parsed.data
}

/** `sort_order` and `chapter_number` are 32-bit integers in the database. */
export const INT_BOUNDS: Readonly<Record<string, number>> = { order: 2147483647, chapterNumber: 2147483647 }

/** Bounds shared by the write routes (validated, then stored). */
export const LONG_TEXT_BOUNDS: BodyOptions = {
  maxLength: { description: LIMITS.longText, learningStandard: LIMITS.longText, learningObjective: LIMITS.longText },
}

/**
 * Caps every query-string value at `LIMITS.queryValue` characters (BE-NFR-25) before the contract
 * schema reads it. A repeated key (`?subject=a&subject=b`) is checked per value. Over the cap is a
 * 422 on that key, so a long string never reaches a `LIKE`/`=` comparison.
 */
@Injectable()
export class BoundedQueryPipe implements PipeTransform<unknown, unknown> {
  transform(value: unknown): unknown {
    const fields = newFields()
    for (const [key, raw] of Object.entries(asRecord(value))) {
      const values = Array.isArray(raw) ? raw : [raw]
      if (values.some((v) => typeof v === 'string' && v.length > LIMITS.queryValue)) {
        fields[key.slice(0, LIMITS.keyEcho)] = maxCharsMessage(key.slice(0, LIMITS.keyEcho), LIMITS.queryValue)
      }
    }
    if (Object.keys(fields).length > 0) throw ApiError.of('VALIDATION_ERROR', { fields })
    return value
  }
}
