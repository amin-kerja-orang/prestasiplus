/**
 * Query parsing of the teacher and pupil lists and exports (pure; no DB). Nothing is rejected (contract): an unknown
 * `is_active` means all, an invalid `page` is 1, a page past the last is clamped by the repository. The school is NEVER read
 * from the query: a `schoolId` (or any other key) sent by the client is not looked at.
 */

/** Largest page number accepted, so `skip` stays inside a 32-bit integer. */
export const PEOPLE_PAGE_MAX = 10_000_000
/** Longest search term used (longer input is cut, never an error). */
export const PEOPLE_SEARCH_MAX = 100

export interface PeopleExportQuery {
  /** `true` = active only, `false` = inactive only, absent = all. */
  isActive?: boolean
  search?: string
}

export interface PeopleListQuery extends PeopleExportQuery {
  page: number
}

type Raw = Record<string, unknown>

const text = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

export function parseExportQuery(raw: Raw): PeopleExportQuery {
  const active = text(raw.is_active)?.trim()
  const search = [...(text(raw.search)?.trim() ?? '')].slice(0, PEOPLE_SEARCH_MAX).join('')
  return {
    ...(active === '1' ? { isActive: true } : active === '0' ? { isActive: false } : {}),
    ...(search === '' ? {} : { search }),
  }
}

export function parseListQuery(raw: Raw): PeopleListQuery {
  const page = text(raw.page)?.trim() ?? ''
  const n = /^\d{1,8}$/.test(page) ? Number(page) : 1
  return { ...parseExportQuery(raw), page: Math.min(Math.max(1, n), PEOPLE_PAGE_MAX) }
}

/** Date part (`yyyy-mm-dd`) of a Malaysia-time timestamp such as `2026-10-21T09:00:00+08:00`. */
export const mytDateOf = (mytTimestamp: string): string => mytTimestamp.slice(0, 10)

/** File name of a user export: `users-{guru|pelajar}-{yyyy-mm-dd}.csv`. */
export const exportFileName = (csvRole: 'guru' | 'pelajar', mytTimestamp: string): string => `users-${csvRole}-${mytDateOf(mytTimestamp)}.csv`
