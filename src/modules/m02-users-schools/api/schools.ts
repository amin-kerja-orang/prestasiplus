/**
 * M02 public school lookups (SRS v1.18 §7 #38, #40, #41; F-23). Public endpoints (guest allowed):
 * used by M01 (register S2, profile S8) before M02's own screens exist, and by M02 S2/S3/S4/S13.
 */

import { api } from '@/api'

/** M01 DATA-M01-06 / M02 DATA-M02-03 projection. `code` is `''` when the school has none. */
export interface SchoolSummary {
  id: number
  name: string
  code: string
  type: string
  state: string
  district: string | null
  city: string | null
}

/** DATA-M02-04. */
export interface Jpn {
  id: number
  code: string
  name: string
}

/** DATA-M02-05. */
export interface Ppd {
  id: number
  jpnId: number
  /** e.g. "PPD GOMBAK" (stored as `ppdDistrict`). */
  code: string
  /** e.g. "PPD Gombak". */
  name: string
}

export interface SchoolSearchQuery {
  /** Name or code substring. */
  q?: string
  state?: string | null
  /** Server default 20, no maximum (M01 S2 sends 15, S8 20). */
  limit?: number
  /** A single school by id. */
  id?: number
  signal?: AbortSignal
}

/** #38 `GET /api/schools/search`: active schools only, not paginated. */
export function searchSchools(query: SchoolSearchQuery = {}): Promise<SchoolSummary[]> {
  return api.get<SchoolSummary[]>('/api/schools/search', {
    query: {
      q: query.q ?? null,
      state: query.state ?? null,
      limit: query.limit ?? null,
      id: query.id ?? null,
    },
    ...(query.signal ? { signal: query.signal } : {}),
  })
}

/** #40 `GET /api/jpn`: the 16 JPN. */
export function fetchJpnList(options: { signal?: AbortSignal } = {}): Promise<Jpn[]> {
  return api.get<Jpn[]>('/api/jpn', options.signal ? { signal: options.signal } : {})
}

/** #41 `GET /api/jpn/:id/ppd`: the PPDs of one JPN (404 for an unknown JPN). */
export function fetchPpdList(
  jpnId: number,
  options: { signal?: AbortSignal } = {},
): Promise<Ppd[]> {
  return api.get<Ppd[]>(
    `/api/jpn/${String(jpnId)}/ppd`,
    options.signal ? { signal: options.signal } : {},
  )
}
