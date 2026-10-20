import { Injectable, type PipeTransform } from '@nestjs/common'
import { COMMAND_CENTER_GURU_MESSAGES, COMMAND_CENTER_RANGE_INVALID, type COMMAND_CENTER_GURU_DRILL_TYPES } from '@pp/contract'

import { ApiError } from '../../../common/errors/api-error'
import { isIdString } from '../../../db/ids'
import { isOverloadError, rateLimited } from '../../auth/auth.errors'
import { QUERY_TEXT_MAX } from '../command-center.constants'
import { invalid } from './errors'

const QUERY_KEYS_MAX = 20
/** Seconds a client is told to wait after an overload answer. */
const OVERLOAD_RETRY_AFTER = 5

/** An overloaded database or pool is retryable: 429 with Retry-After, never a 500. */
export async function overloadTo429<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (err) {
    if (err instanceof ApiError) throw err
    if (isOverloadError(err)) throw rateLimited(OVERLOAD_RETRY_AFTER)
    throw err
  }
}

/**
 * A path id that is not a canonical decimal id can never exist. It becomes `'0'` (no row has id 0), so the route answers as for
 * any unknown id (404) and no raw client text reaches a query.
 */
@Injectable()
export class SafeIdPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    return typeof value === 'string' && isIdString(value) ? value : '0'
  }
}

/** Caps the number and length of query values before a schema reads them (422 on the key). Arrays are refused. */
@Injectable()
export class BoundedQueryPipe implements PipeTransform<unknown, unknown> {
  transform(value: unknown): unknown {
    const fields: Record<string, string> = Object.create(null) as Record<string, string>
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const entries = Object.entries(value as Record<string, unknown>)
      if (entries.length > QUERY_KEYS_MAX) fields._ = `The query must not have more than ${QUERY_KEYS_MAX} keys.`
      for (const [key, raw] of entries) {
        const shown = key.slice(0, QUERY_TEXT_MAX)
        if (Array.isArray(raw)) fields[shown] = `The ${shown} field must not be repeated.`
        else if (typeof raw === 'string' && raw.length > QUERY_TEXT_MAX) {
          fields[shown] = `The ${shown} field must not be greater than ${QUERY_TEXT_MAX} characters.`
        }
      }
    }
    if (Object.keys(fields).length > 0) throw ApiError.of('VALIDATION_ERROR', { fields })
    return value
  }
}

// ---------------------------------------------------------------------------------------------------------------------------
// Manual query parsing (the contract wants the specific BM message as the top-level `message`, which `ZodValidationPipe` does not set)
// ---------------------------------------------------------------------------------------------------------------------------

/** `period` of the daily board: any text is accepted and echoed; a non-string (repeated key) is treated as absent; capped at `QUERY_TEXT_MAX`. */
export function periodOf(raw: unknown): string | undefined {
  return typeof raw === 'string' ? raw.slice(0, QUERY_TEXT_MAX) : undefined
}

/** `code` of the subject list: trimmed; absent or not a string = undefined. */
export function subjectCodeOf(raw: unknown): string | undefined {
  return typeof raw === 'string' ? raw.trim().slice(0, QUERY_TEXT_MAX) : undefined
}

/** A path session id: letters, digits, `_` and `-` only; anything else becomes `''` (no session has it, so 404). */
@Injectable()
export class SessionIdPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    return typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value) ? value : ''
  }
}

function isRealDate(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false
  const d = new Date(`${key}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === key
}

/**
 * `start` and `end` of the student week list: both real `YYYY-MM-DD` dates with start <= end, else 422 `fields.start`
 * "Julat tarikh tidak sah." with the same text as `message`. Call it AFTER the scope check (an out-of-scope id is 404 even for a bad range).
 */
export function dateRangeOf(start: unknown, end: unknown): { start: string; end: string } {
  if (typeof start !== 'string' || typeof end !== 'string' || !isRealDate(start) || !isRealDate(end) || start > end) {
    throw invalid({ start: COMMAND_CENTER_RANGE_INVALID })
  }
  return { start, end }
}

export type CommandCenterGuruDrillType = (typeof COMMAND_CENTER_GURU_DRILL_TYPES)[number]

const GURU_FILTERS: Record<string, readonly string[]> = {
  students: ['', 'active'],
  today: ['', 'aktiviti'],
  subjects: [''],
  gps: [''],
  kirk: ['t1', 't2', 't3', 't4'],
  mood: ['', 'happy', 'okay', 'sad', 'stressed'],
  engagement: ['', 'champion', 'consistent', 'developing', 'minimum', 'disengaged'],
}

/** Guru drill query: `type` is checked first ("Jenis drill tidak sah."), then `filter` ("Penapis tidak sah."), 422 with the text as `message`. */
export function guruDrillQueryOf(raw: { type?: unknown; filter?: unknown }): { type: CommandCenterGuruDrillType; filter: string } {
  const type = typeof raw.type === 'string' && raw.type in GURU_FILTERS ? (raw.type as CommandCenterGuruDrillType) : null
  if (type === null) throw invalid({ type: COMMAND_CENTER_GURU_MESSAGES.drillType })
  const filter = raw.filter === undefined ? '' : typeof raw.filter === 'string' ? raw.filter.trim() : null
  if (filter === null || !(GURU_FILTERS[type] as readonly string[]).includes(filter)) throw invalid({ filter: COMMAND_CENTER_GURU_MESSAGES.drillFilter })
  return { type, filter }
}

/** `badgeId`: a positive integer in digits (no sign or leading zero), else 422 `fields.badgeId` "Lencana tidak sah.". */
export function badgeIdOf(raw: unknown): string {
  if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw) || !isIdString(raw)) throw invalid({ badgeId: COMMAND_CENTER_GURU_MESSAGES.badgeInvalid })
  return raw
}
