/**
 * Lookups the M04 forms use (SRS v1.16 §7 #28–#30, #32, #33; build-plan M04-T1).
 *
 * - #32 / #33 are **owned by M03** (`GET /api/subjects`, `GET /api/education-levels`, any session);
 *   the functions here are typed M04 wrappers of the same URLs, because a module's UI code cannot
 *   import another module's `api/` folder (ADR-0009).
 * - #28–#30 are the DSKP cascade of S2/S4 (`/api/guru/dskp/*`, M10 #39–#41): bare arrays, as live.
 *   Admin and teacher sessions may read them.
 */

import { api, type ListResult } from '@/api'

/** M03 #32 item. */
export interface SubjectLookup {
  id: number
  code: string
  name: string
  nameEn: string
  icon: string | null
  color: string
  isCore: boolean
  educationLevelIds: number[]
}

/** M03 #33 item. */
export interface EducationLevelLookup {
  id: number
  code: string
  name: string
  nameEn: string
  stage: 'primary' | 'lower_secondary' | 'upper_secondary'
  grade: number | null
}

/** #28: `[{id, code, name}]`; `code` is `null` for a Bidang without one (shown as the name alone). */
export interface BidangOption {
  id: number
  code: string | null
  name: string
}

/** #29 / #30. */
export interface SkOption {
  id: number
  code: string
  description: string
}
export type SpOption = SkOption

type Signal = { signal?: AbortSignal }
const withSignal = (o: Signal) => (o.signal ? { signal: o.signal } : {})

/** #32 `GET /api/subjects`: active subjects, optionally those linked to one level. */
export function fetchSubjects(
  query: { educationLevelId?: number | null } & Signal = {},
): Promise<ListResult<SubjectLookup>> {
  return api.list<SubjectLookup>('/api/subjects', {
    query: { educationLevelId: query.educationLevelId ?? null },
    ...withSignal(query),
  })
}

/** #33 `GET /api/education-levels`: active education levels. */
export function fetchEducationLevels(
  options: Signal = {},
): Promise<ListResult<EducationLevelLookup>> {
  return api.list<EducationLevelLookup>('/api/education-levels', withSignal(options))
}

/** #28 `GET /api/guru/dskp/bidang?subjectId=&educationLevelId=` (a bare array). */
export function fetchDskpBidang(
  params: { subjectId: number | string; educationLevelId: number | string },
  options: Signal = {},
): Promise<BidangOption[]> {
  return api.get<BidangOption[]>('/api/guru/dskp/bidang', {
    query: params,
    raw: true,
    ...withSignal(options),
  })
}

/** #29 `GET /api/guru/dskp/sk?bidangId=`. */
export function fetchDskpSk(bidangId: number, options: Signal = {}): Promise<SkOption[]> {
  return api.get<SkOption[]>('/api/guru/dskp/sk', {
    query: { bidangId },
    raw: true,
    ...withSignal(options),
  })
}

/** #30 `GET /api/guru/dskp/sp?skId=`. */
export function fetchDskpSp(skId: number, options: Signal = {}): Promise<SpOption[]> {
  return api.get<SpOption[]>('/api/guru/dskp/sp', {
    query: { skId },
    raw: true,
    ...withSignal(options),
  })
}
