/**
 * Ids between the M06 pages and the API (BE-41, UD-1). The in-browser mock uses numbers; the real
 * API sends opaque strings (decimal subject and question ids, a uuid for a mock exam) that must
 * never go through `Number()`. Mock mode keeps the number so its behaviour is unchanged.
 */

import { isHttpMode } from '@/api/mode'

import type { WireId } from '../api'

const first = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v)

/** A route param as an API id: the string on the real API, the number in the mock. */
export const routeId = (param: unknown): WireId => {
  const raw = first(param)
  if (!isHttpMode()) return Number(raw)
  return typeof raw === 'string' || typeof raw === 'number' ? String(raw) : ''
}

/**
 * The path pattern of a mock exam id: digits in the mock, the uuid (hex and dashes) on the real API.
 * Read when the route table is built.
 */
export const mockIdPattern = (): string => (isHttpMode() ? '[0-9a-fA-F-]+' : '\\d+')

/** An id query value (`?question_id=`, `?level=`): digits only; the string on the real API. */
export const queryId = (v: unknown): WireId | null => {
  const raw = first(v)
  if (typeof raw !== 'string') return null
  if (isHttpMode()) return /^\d{1,19}$/.test(raw) ? raw : null
  return /^\d{1,9}$/.test(raw) ? Number.parseInt(raw, 10) : null
}
