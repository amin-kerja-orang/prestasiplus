/**
 * M03 curriculum lookups (SRS v1.8 §7 #28/#29, FR-M03-96; F-24). Used by M04/M05 selectors (and
 * M01/M02/M06/M10 per their SRS). Active records only, BR-08 order (`order`, then id).
 */

import { api, type ListResult } from '@/api'

/** DATA-M03-01 `stage`. */
export type EducationStage = 'primary' | 'lower_secondary' | 'upper_secondary'

/** #28 `GET /api/subjects` item. */
export interface SubjectLookup {
  id: number
  code: string
  name: string
  nameEn: string
  /** Free text (BR-05): Lucide name, Font Awesome class or emoji; `null` when empty. */
  icon: string | null
  color: string
  isCore: boolean
  educationLevelIds: number[]
}

/** #29 `GET /api/education-levels` item. */
export interface EducationLevelLookup {
  id: number
  code: string
  name: string
  nameEn: string
  stage: EducationStage
  /** M01 `grade` link (BR-17), `null` for levels created later. */
  grade: number | null
}

export interface SubjectLookupQuery {
  /** Only subjects linked to this level. */
  educationLevelId?: number | null
  signal?: AbortSignal
}

/** #28: active subjects (optionally of one level). */
export function fetchSubjects(query: SubjectLookupQuery = {}): Promise<ListResult<SubjectLookup>> {
  return api.list<SubjectLookup>('/api/subjects', {
    query: { educationLevelId: query.educationLevelId ?? null },
    ...(query.signal ? { signal: query.signal } : {}),
  })
}

/** #29: active education levels. */
export function fetchEducationLevels(
  options: { signal?: AbortSignal } = {},
): Promise<ListResult<EducationLevelLookup>> {
  return api.list<EducationLevelLookup>(
    '/api/education-levels',
    options.signal ? { signal: options.signal } : {},
  )
}
