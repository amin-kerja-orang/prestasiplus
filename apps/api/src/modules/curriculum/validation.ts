/**
 * Request validation that mirrors the mock: the contract schemas give the shape errors (Laravel-style
 * copy, trimmed input), and the rules that need the database ("The selected :attribute is invalid.",
 * "The :attribute has already been taken.") are added to the SAME `fields` map, so one 422 reports
 * every failing field like the mock does.
 */
import { CURRICULUM_VALIDATION_MESSAGES as MESSAGES } from '@pp/contract'
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

/** A body that is not a plain object is read as `{}` (the mock's `normalise`). */
export function asRecord(raw: unknown): Record<string, unknown> {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
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

/** First issue per path, like the shared `ZodValidationPipe`. */
function collectFields(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.map(String).join('.') : '_'
    fields[key] ??= issue.message
  }
  return fields
}

/** Parses `raw` with `schema`, then runs the database rules on the fields that parsed. */
export async function validateBody<S extends z.ZodObject>(
  schema: S,
  raw: unknown,
  checks: RuleCheck[] = [],
): Promise<z.output<S>> {
  const body = asRecord(raw)
  const parsed = schema.safeParse(body)
  const fields = parsed.success ? {} : collectFields(parsed.error)
  const shape = schema.shape as Record<string, z.ZodType>
  for (const check of checks) {
    if (fields[check.field] !== undefined) continue
    const field = shape[check.field]?.safeParse(body[check.field])
    if (!field?.success || field.data === null || field.data === undefined) continue
    if (!(await check.ok(field.data))) fields[check.field] = check.message
  }
  if (Object.keys(fields).length > 0) throw ApiError.of('VALIDATION_ERROR', { fields })
  if (!parsed.success) throw ApiError.of('VALIDATION_ERROR', { fields: collectFields(parsed.error) })
  return parsed.data
}
